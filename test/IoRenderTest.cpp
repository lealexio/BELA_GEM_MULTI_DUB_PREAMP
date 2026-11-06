/*
 * IoRenderTest.cpp -- Test d'agrégation E/S audio Bela / Bela GEM Multi
 *
 * Ce fichier est autonome et peut être copié directement comme render.cpp
 * dans un projet de test Bela IDE.
 *
 * OBJECTIF :
 * -------------------------------------------------------------
 * 1. Lit TOUTES les entrées audio actives de la Bela
 * (context->audioInChannels).
 * 2. Agrège (somme) l'ensemble des signaux audio entrants.
 * 3. Applique un gain d'entrée et un gain master configurables avec
 * soft-clipping (protection anti-saturation pour enceintes et casques).
 * 4. Distribue ce signal agrégé sur TOUTES les sorties audio actives
 * (context->audioOutChannels).
 * 5. Affiche périodiquement dans la console de l'IDE Bela les niveaux crête de
 * chaque entrée et du mix de sortie pour faciliter le diagnostic du câblage
 * physique.
 */

#include <Bela.h>
#include <algorithm>
#include <cmath>
#include <cstdio>

// ============================================================================
// CONFIGURATION DU TEST
// ============================================================================

// Gain individuel appliqué à chaque entrée audio avant sommation
static constexpr float kInputGain = 1.0f;

// Coefficient statique de gain appliqué aux sorties audio :
//   1.0f = aucun gain (gain unitaire x1)
//   2.0f = gain x2 (+6 dB)
//   0.5f = gain x0.5 (-6 dB), etc.
static float gOutputGain = 1.0f;

// Si true, active la saturation douce (soft-clip) pour éviter l'écrêtage
// numérique dur
static constexpr bool kEnableSoftClip = true;

// Si true, divise la somme par le nombre d'entrées actives ayant du signal
// pour éviter que la sommation de 10 canaux ne sature automatiquement le bus
// master. Si false, sommation pure 1:1 avec limitation douce.
static constexpr bool kAutoNormalize = false;

// Seuil de détection de saturation (clip)
static constexpr float kClipThreshold = 0.99f;

// Seuil de détection de présence de signal (en amplitude linéaire)
static constexpr float kActivityThreshold = 0.005f; // ≈ -46 dBFS

// Période d'affichage du monitoring console (en secondes)
static constexpr float kMeterIntervalSec = 1.0f;

// Nombre maximum d'entrées / sorties gérées pour les statistiques d'affichage
static constexpr unsigned int kMaxTrackedChannels = 16;

// ============================================================================
// VARIABLES GLOBALES (Temps réel)
// ============================================================================

static float gInputPeaks[kMaxTrackedChannels] = {0.0f};
static bool gInputClips[kMaxTrackedChannels] = {false};
static float gMasterOutPeak = 0.0f;
static bool gMasterOutClip = false;

static unsigned int gMeterFrameCount = 0;
static unsigned int gMeterIntervalFrames = 44100;

// ============================================================================
// FONCTIONS UTILITAIRES AUDIO
// ============================================================================

/**
 * Saturation douce (soft-clipping) pour éviter les distorsions numériques dures
 * en cas de sommation de plusieurs entrées à fort niveau.
 */
static inline float softClip(float x) {
  if (x > 1.0f)
    return 1.0f;
  if (x < -1.0f)
    return -1.0f;
  // Polynôme de saturation douce Cubique pour |x| > 0.66
  if (x > 0.666667f) {
    return (x - (x - 0.666667f) * (x - 0.666667f) * 0.75f);
  }
  if (x < -0.666667f) {
    float absX = -x;
    return -(absX - (absX - 0.666667f) * (absX - 0.666667f) * 0.75f);
  }
  return x;
}

// ============================================================================
// SETUP
// ============================================================================

bool setup(BelaContext *context, void *userData) {
  gMeterIntervalFrames =
      (unsigned int)(context->audioSampleRate * kMeterIntervalSec);
  if (gMeterIntervalFrames == 0) {
    gMeterIntervalFrames = 44100;
  }

  rt_printf("\n=======================================================\n");
  rt_printf("   BELA AUDIO I/O AGGREGATOR TEST (IoRenderTest.cpp)   \n");
  rt_printf("=======================================================\n");
  rt_printf("Frequence d'echantillonnage : %.0f Hz\n",
            context->audioSampleRate);
  rt_printf("Taille du bloc audio        : %u frames\n", context->audioFrames);
  rt_printf("Nombre d'entrees audio      : %u\n", context->audioInChannels);
  rt_printf("Nombre de sorties audio     : %u\n", context->audioOutChannels);
  rt_printf("Gain entree par canal       : %.2f\n", kInputGain);
  rt_printf("Coefficient gain sorties    : %.2fx (1 = aucun gain, 2 = x2)\n",
            gOutputGain);
  rt_printf("Auto-normalisation          : %s\n",
            kAutoNormalize ? "ACTIVE" : "DESACTIVE");

  // Initialisation des gains PGA du codec d'entrée
  for (unsigned int ch = 0; ch < context->audioInChannels; ++ch) {
    Bela_setAudioInputGain(ch, 0.0f);
    if (ch < kMaxTrackedChannels) {
      gInputPeaks[ch] = 0.0f;
      gInputClips[ch] = false;
    }
  }

  // Initialisation du volume casque / DAC de sortie
  for (unsigned int ch = 0; ch < context->audioOutChannels; ++ch) {
    Bela_setHpLevel(ch, 0.0f);
  }

  // Avertissement pour la configuration GEM Multi (10 I/O)
  if (context->audioInChannels < 10 || context->audioOutChannels < 10) {
    rt_printf("\n-------------------------------------------------------\n");
    rt_printf(" [INFO / AVERTISSEMENT] Configuration I/O detectee :\n");
    rt_printf(" Entrees actives : %u  |  Sorties actives : %u\n",
              context->audioInChannels, context->audioOutChannels);
    rt_printf(" Si vous utilisez la cape BELA GEM MULTI (10 In / 10 Out) :\n");
    rt_printf(" Dans l'IDE Bela -> Project Settings (icone engrenage) :\n");
    rt_printf("   -> Reglez 'Audio inputs' sur 10\n");
    rt_printf("   -> Reglez 'Audio outputs' sur 10\n");
    rt_printf(" (Ou specifiez dans Arguments : -i 10 -o 10)\n");
    rt_printf("-------------------------------------------------------\n\n");
  } else {
    rt_printf("-> Configuration 10 In / 10 Out detectee et prete.\n\n");
  }

  rt_printf(
      "-> Toutes les entrees sont sommees et envoyees a TOUTES les sorties.\n");
  rt_printf("=======================================================\n\n");

  return true;
}

// ============================================================================
// RENDER (Traitement audio temps réel)
// ============================================================================

void render(BelaContext *context, void *userData) {
  const unsigned int inChannels = context->audioInChannels;
  const unsigned int outChannels = context->audioOutChannels;

  // Facteur d'échelle éventuel
  const float normFactor = (kAutoNormalize && inChannels > 1)
                               ? (1.0f / std::sqrt((float)inChannels))
                               : 1.0f;

  for (unsigned int n = 0; n < context->audioFrames; ++n) {
    float aggregatedSample = 0.0f;

    // 1. Lecture et agrégation de toutes les entrées audio
    for (unsigned int ch = 0; ch < inChannels; ++ch) {
      float in = audioRead(context, n, ch);
      aggregatedSample += in * kInputGain;

      // Suivi des crêtes pour diagnostic
      if (ch < kMaxTrackedChannels) {
        float absIn = std::fabs(in);
        if (absIn > gInputPeaks[ch]) {
          gInputPeaks[ch] = absIn;
        }
        if (absIn >= kClipThreshold) {
          gInputClips[ch] = true;
        }
      }
    }

    // 2. Normalisation et application du coefficient de gain des sorties (x1,
    // x2, etc.)
    aggregatedSample *= (normFactor * gOutputGain);

    // 3. Protection anti-saturation (soft-clip ou clamp strict à [-1.0, +1.0])
    float outSample = kEnableSoftClip
                          ? softClip(aggregatedSample)
                          : std::max(-1.0f, std::min(1.0f, aggregatedSample));

    // Suivi de crête de la sortie agrégée
    float absOut = std::fabs(outSample);
    if (absOut > gMasterOutPeak) {
      gMasterOutPeak = absOut;
    }
    if (absOut >= kClipThreshold) {
      gMasterOutClip = true;
    }

    // 4. Écriture sur TOUTES les sorties audio actives
    for (unsigned int ch = 0; ch < outChannels; ++ch) {
      audioWrite(context, n, ch, outSample);
    }
  }

  // 5. Affichage périodique du monitoring dans la console Bela
  gMeterFrameCount += context->audioFrames;
  if (gMeterFrameCount >= gMeterIntervalFrames) {
    gMeterFrameCount = 0;

    rt_printf(
        "--- [IoRenderTest Monitoring (1s)] ----------------------------\n");

    unsigned int activeCount = 0;
    for (unsigned int ch = 0; ch < inChannels && ch < kMaxTrackedChannels;
         ++ch) {
      float peak = gInputPeaks[ch];
      bool clip = gInputClips[ch];

      float dB = -99.9f;
      if (peak > 0.00001f) {
        dB = 20.0f * std::log10(peak);
      }

      char bar[9];
      int barsCount = (int)(peak * 8.0f);
      if (barsCount > 8)
        barsCount = 8;
      for (int b = 0; b < 8; ++b) {
        bar[b] = (b < barsCount) ? '#' : '.';
      }
      bar[8] = '\0';

      const char *status = " (silence)";
      if (clip) {
        status = " [CLIP!]";
        activeCount++;
      } else if (peak >= kActivityThreshold) {
        status = " [ACTIF]";
        activeCount++;
      }

      rt_printf(" IN %02u: [%s] crt=%0.3f (%5.1f dBFS)%s\n", ch, bar, peak, dB,
                status);

      // Remise à zéro pour la période suivante
      gInputPeaks[ch] = 0.0f;
      gInputClips[ch] = false;
    }

    float outDb = -99.9f;
    if (gMasterOutPeak > 0.00001f) {
      outDb = 20.0f * std::log10(gMasterOutPeak);
    }

    rt_printf(" >> SORTIE AGREGATION (distribuee sur OUT 0..%u) :\n",
              outChannels > 0 ? outChannels - 1 : 0);
    rt_printf("    Crete = %0.3f (%5.1f dBFS) | Actives: %u/%u in | Clip: %s\n",
              gMasterOutPeak, outDb, activeCount, inChannels,
              gMasterOutClip ? "OUI (limite)" : "NON");
    rt_printf(
        "---------------------------------------------------------------\n");

    gMasterOutPeak = 0.0f;
    gMasterOutClip = false;
  }
}

// ============================================================================
// CLEANUP
// ============================================================================

void cleanup(BelaContext *context, void *userData) {
  rt_printf("Arret de IoRenderTest.\n");
}
