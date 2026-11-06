/*
 * OutRenderTest.cpp -- Test et diagnostic des sorties audio Bela / Bela GEM Multi
 * 
 * Ce fichier est autonome et prêt à être copié dans un projet Bela IDE (render.cpp).
 *
 * CE QU'IL FAIT :
 * -------------------------------------------------------------
 * 1. Génère un balayage de fréquence sinusoïdal continu (sine sweep logarithmique 30 Hz -> 16 kHz)
 *    en boucle sur TOUTES les sorties audio actives de la Bela (context->audioOutChannels).
 * 2. Applique un fondu anti-clic (fade-in / fade-out) à chaque fin de cycle pour une répétition
 *    continue sans aucun bruit de transition.
 * 3. Permet 3 modes d'écoute configurables :
 *      - MODE_ALL_SIMULTANEOUS (défaut) : le sweep joue sur TOUTES les sorties en même temps.
 *      - MODE_SEQUENTIAL                : le sweep tourne de sortie en sortie (OUT 0 -> OUT 1 -> OUT 2...).
 *      - MODE_SINGLE_CHANNEL            : le sweep joue uniquement sur une sortie spécifique (solo).
 * 4. Affiche en temps réel dans la console la fréquence instantanée et une barre de progression visuelle.
 * 5. Initialise les gains DAC / Casque à 0 dB (Bela_setHpLevel).
 * 6. Alerte si la Bela GEM Multi est configurée avec moins de 10 sorties audio.
 */

#include <Bela.h>
#include <cmath>
#include <cstdio>
#include <algorithm>

// ============================================================================
// MODES DE TEST
// ============================================================================
enum SweepMode {
    MODE_ALL_SIMULTANEOUS = 0, // Toutes les sorties en même temps (défaut)
    MODE_SEQUENTIAL       = 1, // Une sortie après l'autre en boucle (OUT0, puis OUT1, etc.)
    MODE_SINGLE_CHANNEL   = 2  // Uniquement la sortie spécifiée par gSoloChannel
};

// ============================================================================
// CONFIGURATION DU SWEEP
// ============================================================================

// Mode de fonctionnement sélectionné
static constexpr SweepMode kSweepMode = MODE_ALL_SIMULTANEOUS;

// Canal cible si kSweepMode == MODE_SINGLE_CHANNEL (0 = OUT0, 1 = OUT1, etc.)
static int gSoloChannel = 0;

// Amplitude crête du signal (0.25f ≈ -12 dBFS, niveau d'écoute confortable et sûr)
static constexpr float kSweepAmplitude = 0.25f;

// Durée d'un cycle de sweep (en secondes)
static constexpr float kSweepDurationSec = 3.0f;

// Fréquence de départ (basses) et de fin (aigus) en Hertz
static constexpr float kSweepFreqStart = 30.0f;
static constexpr float kSweepFreqEnd   = 16000.0f;

// Durée des fondus d'entrée/sortie à chaque cycle pour éviter les clics (en millisecondes)
static constexpr float kFadeDurationMs = 15.0f;

// Nombre maximum de canaux de sortie gérés
static constexpr unsigned int kMaxChannels = 16;

// ============================================================================
// VARIABLES D'ÉTAT TEMPS RÉEL
// ============================================================================

static unsigned int gSweepTotalSamples = 0;
static unsigned int gFadeSamples       = 0;
static unsigned int gCurrentSample     = 0;
static unsigned int gCurrentOutputIdx  = 0;

// Constantes précalculées pour le sweep logarithmique :
// f(t) = f0 * (f1 / f0)^(t / T)
// phase(t) = 2 * PI * f0 * T / ln(f1 / f0) * ( (f1 / f0)^(t / T) - 1 )
static double gSweepK     = 0.0; // f1 / f0
static double gSweepScale = 0.0; // 2 * PI * f0 * T / ln(k)

// Fréquence instantanée courante pour l'affichage console
static float gCurrentFreq = kSweepFreqStart;

// Compteur pour le rafraîchissement régulier de la console (~10 fois par seconde)
static unsigned int gPrintCounter = 0;
static unsigned int gPrintIntervalFrames = 4410;

// ============================================================================
// SETUP
// ============================================================================

bool setup(BelaContext* context, void* userData)
{
    float sr = context->audioSampleRate;
    gSweepTotalSamples = (unsigned int)(sr * kSweepDurationSec);
    if(gSweepTotalSamples == 0) gSweepTotalSamples = 44100;

    gFadeSamples = (unsigned int)(sr * (kFadeDurationMs / 1000.0f));
    if(gFadeSamples < 1) gFadeSamples = 1;
    if(gFadeSamples * 2 > gSweepTotalSamples) gFadeSamples = gSweepTotalSamples / 4;

    gPrintIntervalFrames = (unsigned int)(sr * 0.15f); // Affichage toutes les 150 ms

    // Précalcul des coefficients mathématiques du sweep
    gSweepK = (double)kSweepFreqEnd / (double)kSweepFreqStart;
    gSweepScale = (2.0 * M_PI * (double)kSweepFreqStart * (double)kSweepDurationSec) / std::log(gSweepK);

    rt_printf("\n=======================================================\n");
    rt_printf("   BELA AUDIO OUTPUTS SWEEP TEST (OutRenderTest.cpp)   \n");
    rt_printf("=======================================================\n");
    rt_printf("Frequence d'echantillonnage : %.0f Hz\n", sr);
    rt_printf("Taille de bloc audio        : %u echantillons\n", context->audioFrames);
    rt_printf("Sorties audio actives       : %u\n", context->audioOutChannels);
    rt_printf("Plage de frequence          : %.0f Hz -> %.0f Hz (logarithmique)\n", kSweepFreqStart, kSweepFreqEnd);
    rt_printf("Duree d'un cycle            : %.1f s\n", kSweepDurationSec);
    rt_printf("Amplitude                   : %.2f (-12 dBFS)\n", kSweepAmplitude);

    // Initialisation des niveaux de sortie casque / DAC à 0 dB
    for(unsigned int ch = 0; ch < context->audioOutChannels; ++ch) {
        Bela_setHpLevel(ch, 0.0f);
    }

    if(kSweepMode == MODE_ALL_SIMULTANEOUS) {
        rt_printf("Mode                        : TOUTES LES SORTIES EN SIMULTANE\n");
    } else if(kSweepMode == MODE_SEQUENTIAL) {
        rt_printf("Mode                        : SEQUENTIEL (Sortie par sortie)\n");
    } else {
        rt_printf("Mode                        : SOLO SUR SORTIE %d\n", gSoloChannel);
    }

    // Diagnostic pour cape Bela GEM Multi (10 sorties)
    if(context->audioOutChannels < 10) {
        rt_printf("\n-------------------------------------------------------\n");
        rt_printf(" [ATTENTION] Seulement %u sortie(s) audio active(s) !\n", context->audioOutChannels);
        rt_printf(" Si vous utilisez la cape BELA GEM MULTI (10 sorties) :\n");
        rt_printf(" Dans l'IDE Bela -> Settings (icone engrenage) :\n");
        rt_printf("   -> Reglez 'Audio outputs' sur 10\n");
        rt_printf("   -> Reglez 'Audio inputs' sur 10\n");
        rt_printf(" (Ou ajoutez dans Project Settings / Arguments : -o 10 -i 10)\n");
        rt_printf(" Sans ce reglage, les sorties OUT2 a OUT9 restent muettes !\n");
        rt_printf("-------------------------------------------------------\n\n");
    } else {
        rt_printf("-> Toutes les %u sorties audio sont bien actives.\n\n", context->audioOutChannels);
    }

    return true;
}

// ============================================================================
// RENDER
// ============================================================================

void render(BelaContext* context, void* userData)
{
    unsigned int numOuts = context->audioOutChannels;

    for(unsigned int n = 0; n < context->audioFrames; ++n) {
        double progress = (double)gCurrentSample / (double)gSweepTotalSamples; // 0.0 à 1.0

        // Fréquence instantanée f(t) = f0 * (f1 / f0)^progress
        double currentF = (double)kSweepFreqStart * std::pow(gSweepK, progress);
        gCurrentFreq = (float)currentF;

        // Phase analytique exacte intégrée :
        double phase = gSweepScale * (std::pow(gSweepK, progress) - 1.0);
        float sample = (float)(kSweepAmplitude * std::sin(phase));

        // Enveloppe de fondu anti-clic aux extrémités du sweep
        if(gCurrentSample < gFadeSamples) {
            float fade = 0.5f * (1.0f - std::cos(M_PI * (float)gCurrentSample / (float)gFadeSamples));
            sample *= fade;
        } else if(gCurrentSample > (gSweepTotalSamples - gFadeSamples)) {
            unsigned int rem = gSweepTotalSamples - gCurrentSample;
            float fade = 0.5f * (1.0f - std::cos(M_PI * (float)rem / (float)gFadeSamples));
            sample *= fade;
        }

        // Distribution du signal selon le mode choisi
        for(unsigned int ch = 0; ch < numOuts; ++ch) {
            bool outputActive = false;

            if(kSweepMode == MODE_ALL_SIMULTANEOUS) {
                outputActive = true;
            } else if(kSweepMode == MODE_SEQUENTIAL) {
                outputActive = (ch == gCurrentOutputIdx);
            } else if(kSweepMode == MODE_SINGLE_CHANNEL) {
                outputActive = ((int)ch == gSoloChannel);
            }

            audioWrite(context, n, ch, outputActive ? sample : 0.0f);
        }

        // Avancement de l'échantillon
        gCurrentSample++;
        if(gCurrentSample >= gSweepTotalSamples) {
            gCurrentSample = 0;
            // En mode séquentiel, on passe à la sortie suivante
            if(kSweepMode == MODE_SEQUENTIAL && numOuts > 0) {
                gCurrentOutputIdx = (gCurrentOutputIdx + 1) % numOuts;
            }
        }
    }

    // Affichage console régulier
    gPrintCounter += context->audioFrames;
    if(gPrintCounter >= gPrintIntervalFrames) {
        gPrintCounter = 0;

        float pct = ((float)gCurrentSample / (float)gSweepTotalSamples) * 100.0f;

        // Jauge visuelle ASCII de 20 crans
        char bar[21];
        int filled = (int)(pct / 5.0f);
        if(filled > 20) filled = 20;
        for(int i = 0; i < 20; ++i) {
            bar[i] = (i < filled) ? '=' : '-';
        }
        bar[20] = '\0';

        if(kSweepMode == MODE_ALL_SIMULTANEOUS) {
            rt_printf("\r[SWEEP OUT 0..%u] %5.0f Hz | [%s] %3.0f %%",
                      numOuts > 0 ? numOuts - 1 : 0, gCurrentFreq, bar, pct);
        } else if(kSweepMode == MODE_SEQUENTIAL) {
            rt_printf("\r[SWEEP -> OUT %u] %5.0f Hz | [%s] %3.0f %%",
                      gCurrentOutputIdx, gCurrentFreq, bar, pct);
        } else {
            rt_printf("\r[SWEEP SOLO OUT %d] %5.0f Hz | [%s] %3.0f %%",
                      gSoloChannel, gCurrentFreq, bar, pct);
        }
    }
}

// ============================================================================
// CLEANUP
// ============================================================================

void cleanup(BelaContext* context, void* userData)
{
    rt_printf("\nOutRenderTest arrete.\n");
}

