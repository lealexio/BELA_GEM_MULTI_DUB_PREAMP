/*
 * renderTest.cpp -- Test et diagnostic des entrées audio Bela / Bela GEM Multi
 * 
 * Ce fichier est autonome et prêt à être copié dans un nouveau projet Bela IDE.
 * 
 * Ce qu'il fait :
 * 1. Lit TOUTES les entrées audio actives de la Bela (context->audioInChannels).
 * 2. Somme les signaux et les envoie sur la SORTIE 0 (context->audioOutChannels[0]).
 *    (Optionnellement dupliqué sur la sortie 1 pour une écoute au casque).
 * 3. Affiche en temps réel dans la console de l'IDE Bela les niveaux crête (VU-mètres ASCII
 *    et valeurs en dBFS) de chaque entrée pour identifier immédiatement quelle entrée reçoit du signal.
 * 4. Détecte et signale l'écrêtage (clipping) si une entrée sature.
 * 5. Alerte si moins de 10 entrées sont actives (configuration fréquente sur Bela GEM Multi).
 */

#include <Bela.h>
#include <cmath>
#include <algorithm>
#include <cstdio>

// ============================================================================
// CONFIGURATION DU TEST
// ============================================================================

// Gain appliqué à chaque entrée avant sommation (1.0 = gain unitaire).
// Si vous testez plusieurs entrées simultanées très fortes, vous pouvez réduire à 0.5.
static constexpr float kInputGain = 1.0f;

// Mode SOLO :
// -1   = Mixe TOUTES les entrées disponibles vers la sortie 0.
//  0..N = Écoute uniquement le canal spécifié (ex: 2 pour écouter seulement IN 2).
static int gSoloChannel = -1;

// Duplication sur la sortie 1 :
// true  = copie la sortie 0 vers la sortie 1 (permet d'entendre dans les deux oreilles au casque).
// false = sortie STRICTEMENT sur la sortie 0 (OUT 0).
static constexpr bool kMirrorToOutput1 = true;

// Intervalle d'affichage du VU-mètre dans la console Bela (en secondes).
static constexpr float kMeterIntervalSec = 1.0f;

// Seuil de détection de saturation (0.99 sur échelle [-1.0, 1.0]).
static constexpr float kClipThreshold = 0.99f;

// Nombre maximum d'entrées audio gérées pour les mesures de crête.
static constexpr unsigned int kMaxChannels = 16;

// ============================================================================
// VARIABLES GLOBALES (Temps réel)
// ============================================================================

static float        gPeakPerChannel[kMaxChannels] = {0.0f};
static bool         gClipPerChannel[kMaxChannels] = {false};
static unsigned int gMeterFrameCount = 0;
static unsigned int gMeterIntervalFrames = 44100;

// ============================================================================
// SETUP
// ============================================================================

bool setup(BelaContext* context, void* userData)
{
    gMeterIntervalFrames = (unsigned int)(context->audioSampleRate * kMeterIntervalSec);
    if(gMeterIntervalFrames == 0) gMeterIntervalFrames = 44100;

    rt_printf("\n=======================================================\n");
    rt_printf("   BELA AUDIO INPUTS DIAGNOSTIC TEST (renderTest.cpp)  \n");
    rt_printf("=======================================================\n");
    rt_printf("Frequence d'echantillonnage : %.0f Hz\n", context->audioSampleRate);
    rt_printf("Taille de bloc audio        : %u echantillons\n", context->audioFrames);
    rt_printf("Entrees audio actives       : %u\n", context->audioInChannels);
    rt_printf("Sorties audio actives       : %u\n", context->audioOutChannels);

    // Initialisation des gains PGA du codec à 0 dB (gain unitaire)
    for(unsigned int ch = 0; ch < context->audioInChannels; ++ch) {
        Bela_setAudioInputGain(ch, 0.0f);
        if(ch < kMaxChannels) {
            gPeakPerChannel[ch] = 0.0f;
            gClipPerChannel[ch] = false;
        }
    }
    for(unsigned int ch = 0; ch < context->audioOutChannels; ++ch) {
        Bela_setHpLevel(ch, 0.0f);
    }

    // Avertissement spécifique pour Bela GEM Multi (10 entrées)
    if(context->audioInChannels < 10) {
        rt_printf("\n-------------------------------------------------------\n");
        rt_printf(" [ATTENTION] Seulement %u entree(s) audio active(s) !\n", context->audioInChannels);
        rt_printf(" Si vous utilisez la cape BELA GEM MULTI (10 entrees) :\n");
        rt_printf(" Dans l'IDE Bela -> Onglet Settings (icone engrenage) :\n");
        rt_printf("   -> Reglez 'Audio inputs' sur 10\n");
        rt_printf("   -> Reglez 'Audio outputs' sur 10\n");
        rt_printf(" (Ou ajoutez dans Project Settings / Arguments : -i 10 -o 10)\n");
        rt_printf(" Sans ce reglage, les entrees 2 a 9 restent inactives !\n");
        rt_printf("-------------------------------------------------------\n\n");
    } else {
        rt_printf("-> Toutes les %u entrees sont detectees et actives.\n\n", context->audioInChannels);
    }

    if(gSoloChannel >= 0 && (unsigned int)gSoloChannel < context->audioInChannels) {
        rt_printf("-> Mode SOLO : seule l'entree IN %d est dirigee vers OUT 0.\n", gSoloChannel);
    } else {
        rt_printf("-> Mode MIX : toutes les entrees (0 a %u) sont mixees vers OUT 0.\n", context->audioInChannels - 1);
    }

    if(kMirrorToOutput1 && context->audioOutChannels > 1) {
        rt_printf("-> Duplication active : le signal de OUT 0 est egalement envoye sur OUT 1 (casque).\n");
    }

    rt_printf("-> Affichage des niveaux audio dans la console toutes les %.1f s...\n", kMeterIntervalSec);
    rt_printf("=======================================================\n\n");

    return true;
}

// ============================================================================
// RENDER (Traitement audio temps réel)
// ============================================================================

void render(BelaContext* context, void* userData)
{
    const unsigned int inChannels = context->audioInChannels;
    const unsigned int outChannels = context->audioOutChannels;

    for(unsigned int n = 0; n < context->audioFrames; ++n)
    {
        float mixedSample = 0.0f;

        if(gSoloChannel >= 0 && (unsigned int)gSoloChannel < inChannels)
        {
            // Mode SOLO : écoute d'un canal spécifique
            float in = audioRead(context, n, gSoloChannel);
            mixedSample = in * kInputGain;

            // Mesure des crêtes de toutes les entrées même en solo
            for(unsigned int ch = 0; ch < inChannels && ch < kMaxChannels; ++ch) {
                float sample = (ch == (unsigned int)gSoloChannel) ? in : audioRead(context, n, ch);
                float absVal = std::fabs(sample);
                if(absVal > gPeakPerChannel[ch]) gPeakPerChannel[ch] = absVal;
                if(absVal >= kClipThreshold) gClipPerChannel[ch] = true;
            }
        }
        else
        {
            // Mode MIX : sommation de toutes les entrées audio
            for(unsigned int ch = 0; ch < inChannels; ++ch) {
                float in = audioRead(context, n, ch);
                mixedSample += in * kInputGain;

                if(ch < kMaxChannels) {
                    float absVal = std::fabs(in);
                    if(absVal > gPeakPerChannel[ch]) gPeakPerChannel[ch] = absVal;
                    if(absVal >= kClipThreshold) gClipPerChannel[ch] = true;
                }
            }
        }

        // Limiteur doux / saturation douce pour protéger les haut-parleurs / écouteurs
        if(mixedSample > 1.0f) {
            mixedSample = 1.0f;
        } else if(mixedSample < -1.0f) {
            mixedSample = -1.0f;
        }

        // Écriture sur la sortie 0 (OUT 0)
        if(outChannels > 0) {
            audioWrite(context, n, 0, mixedSample);
        }

        // Duplication sur la sortie 1 si activée (écoute au casque)
        if(outChannels > 1) {
            audioWrite(context, n, 1, kMirrorToOutput1 ? mixedSample : 0.0f);
        }

        // Mise à zéro des autres sorties éventuelles (OUT 2..N)
        for(unsigned int ch = 2; ch < outChannels; ++ch) {
            audioWrite(context, n, ch, 0.0f);
        }
    }

    // Affichage périodique du monitoring des entrées dans la console
    gMeterFrameCount += context->audioFrames;
    if(gMeterFrameCount >= gMeterIntervalFrames)
    {
        gMeterFrameCount = 0;

        rt_printf("--- [Niveaux Entrees Audio (Crete)] -----------------------\n");
        for(unsigned int ch = 0; ch < inChannels && ch < kMaxChannels; ++ch)
        {
            float peak = gPeakPerChannel[ch];
            bool clip = gClipPerChannel[ch];

            // Calcul en dBFS (avec plancher à -99.9 dB)
            float dB = -99.9f;
            if(peak > 0.00001f) {
                dB = 20.0f * std::log10(peak);
            }

            // VUmètre ASCII (10 caractères)
            char bar[11];
            int barsCount = (int)(peak * 10.0f);
            if(barsCount > 10) barsCount = 10;
            for(int b = 0; b < 10; ++b) {
                bar[b] = (b < barsCount) ? '#' : '.';
            }
            bar[10] = '\0';

            // Diagnostic d'état
            const char* status = "";
            if(clip) {
                status = " [SATURATION / CLIP!]";
            } else if(peak < 0.002f) {
                status = " (silence)";
            } else if(peak >= 0.05f) {
                status = " [SIGNAL OK]";
            }

            rt_printf(" IN %02u: [%s] crete=%0.3f (%5.1f dBFS)%s\n",
                      ch, bar, peak, dB, status);

            // Réinitialisation des crêtes pour la période suivante
            gPeakPerChannel[ch] = 0.0f;
            gClipPerChannel[ch] = false;
        }
        rt_printf("----------------------------------------------------------\n");
    }
}

// ============================================================================
// CLEANUP
// ============================================================================

void cleanup(BelaContext* context, void* userData)
{
    rt_printf("Arret du test des entrees audio.\n");
}
