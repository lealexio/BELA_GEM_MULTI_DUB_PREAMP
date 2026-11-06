#include <Bela.h>

// Broches digitales reliées à S0 (D0), S1 (D1), S2 (D2)
const int kPinS0 = 0;
const int kPinS1 = 1;
const int kPinS2 = 2;
/**
 * MuxTestRender.cpp -- Diagnostic et test du MUX0 sur Bela
 *
 * Câblage physique :
 *   - Lignes d'adresse :
 *       S0 -> D0 (Bela Digital 0)
 *       S1 -> D1 (Bela Digital 1)
 *       S2 -> D2 (Bela Digital 2)
 *       S3 -> D3 (Bela Digital 3) [actif si kChannelsPerMux = 16]
 *   - Sortie signal (COM / SIG) :
 *       COM -> A0 (Bela Analog In 0)  <-- ATTENTION : brancher sur A0 (Analog 0), pas sur D0 !
 *   - Alimentation :
 *       VCC / VDD -> 3.3V (Bela)
 *       GND / VEE -> GND (Bela)
 *       E / EN    -> GND (Enable = actif à l'état bas)
 */

// Stockage des 8 MUX x 8 canaux = 64 valeurs
float gMuxValues[8][8] = {{0.0f}};
// Choisir 8 (CD74HC4051) ou 16 (CD74HC4067) selon votre puce
static constexpr int kChannelsPerMux = 8;

// Broches digitales reliées aux sélecteurs d'adresse
const int kPinS0 = 0; // D0
const int kPinS1 = 1; // D1
const int kPinS2 = 2; // D2
const int kPinS3 = 3; // D3 (utilisé seulement si kChannelsPerMux = 16)

// Entrée analogique de la Bela connectée à la sortie COM du MUX0
const int kMux0AnalogIn = 0; // A0

// Stockage des valeurs lues pour le MUX0 (8 ou 16 canaux)
float gMux0Values[kChannelsPerMux] = {0.0f};

int gCurrentMuxChannel = 0;
int gSampleCount = 0;
int gPrintCounter = 0;

bool setup(BelaContext *context, void *userData)
{
    // Vérifie que les entrées analogiques et digitales sont activées
    if(context->analogInChannels < 8) {
        rt_printf("Erreur: active 8 canaux analogiques dans les parametres du projet.\n");
    // Vérifie que les entrées analogiques sont activées dans l'IDE Bela
    if(context->analogFrames == 0 || context->analogInChannels < 1) {
        rt_printf("ERREUR: Activez au moins 1 entree analogique (A0) dans les parametres du projet Bela !\n");
        return false;
    }

    // Configure D0, D1, D2 en sortie (OUTPUT)
    // Configure les broches d'adresses en sortie (OUTPUT)
    pinMode(context, 0, kPinS0, OUTPUT);
    pinMode(context, 0, kPinS1, OUTPUT);
    pinMode(context, 0, kPinS2, OUTPUT);
    if(kChannelsPerMux > 8) {
        pinMode(context, 0, kPinS3, OUTPUT);
    }

    rt_printf("===================================================\n");
    rt_printf(" Test MUX0 initialise :\n");
    rt_printf("   - COM / SIG  -> Analog In %d (A%d)\n", kMux0AnalogIn, kMux0AnalogIn);
    rt_printf("   - Adresses   -> D0, D1, D2%s\n", (kChannelsPerMux > 8 ? ", D3" : ""));
    rt_printf("   - Canaux     -> 0 a %d\n", kChannelsPerMux - 1);
    rt_printf("===================================================\n");

    return true;
}

void render(BelaContext *context, void *userData)
{
    // Nombre de frames audio par frame analogique (souvent 2 à 44.1kHz -> 22.05kHz analog)
    int analogFrameRatio = context->audioFrames / context->analogFrames;

    for(unsigned int n = 0; n < context->audioFrames; n++) {
        
        // Pilote en continu les broches D0, D1, D2 avec l'adresse courante (0 à 7)
        // Pilote les broches d'adresse avec le canal courant
        digitalWriteOnce(context, n, kPinS0, (gCurrentMuxChannel >> 0) & 1);
        digitalWriteOnce(context, n, kPinS1, (gCurrentMuxChannel >> 1) & 1);
        digitalWriteOnce(context, n, kPinS2, (gCurrentMuxChannel >> 2) & 1);
        if(kChannelsPerMux > 8) {
            digitalWriteOnce(context, n, kPinS3, (gCurrentMuxChannel >> 3) & 1);
        }

        gSampleCount++;

        // Toutes les 16 frames audio (~0.36 ms), le CD74HC4051E est parfaitement stabilisé :
        // on lit A0..A7 puis on passe à l'adresse suivante (0 -> 7)
        // Laisser 16 frames audio (~0.36 ms) au multiplexeur pour stabiliser la tension
        if(gSampleCount >= 16 && (n % analogFrameRatio == 0)) {
            unsigned int analogFrame = n / analogFrameRatio;

            for(int mux = 0; mux < 8; mux++) {
                gMuxValues[mux][gCurrentMuxChannel] = analogRead(context, analogFrame, mux);
            }
            // Lecture du MUX0 sur l'entrée analogique A0
            gMux0Values[gCurrentMuxChannel] = analogRead(context, analogFrame, kMux0AnalogIn);

            // Passe au pas suivant du multiplexeur (0 à 7)
            gCurrentMuxChannel = (gCurrentMuxChannel + 1) & 0x07;
            // Passe au canal suivant
            gCurrentMuxChannel = (gCurrentMuxChannel + 1) % kChannelsPerMux;
            gSampleCount = 0;
        }
    }

    // Affichage dans la console toutes les ~250 ms
    gPrintCounter += context->audioFrames;
    if(gPrintCounter >= (int)(context->audioSampleRate / 4)) {
        gPrintCounter = 0;

        rt_printf("\n--- Etat des 8 Multiplexeurs (Canaux 0 a 7) ---\n");
        rt_printf("      Ch0   Ch1   Ch2   Ch3   Ch4   Ch5   Ch6   Ch7\n");
        for(int mux = 0; mux < 8; mux++) {
            rt_printf("MUX%d: ", mux);
            for(int ch = 0; ch < 8; ch++) {
                rt_printf("%.2f  ", gMuxValues[mux][ch]);
            }
            rt_printf("\n");
        rt_printf("\n--- MUX0 (Analog In A%d) ---\n", kMux0AnalogIn);
        rt_printf(" Canal | Brut (0..0.8) | Normalise (0..1) | Jauge\n");
        rt_printf("--------------------------------------------------\n");

        for(int ch = 0; ch < kChannelsPerMux; ch++) {
            float raw = gMux0Values[ch];
            // Échelle : 3.3V / 4.096V = ~0.806. Donc raw * (4.096 / 3.3) donne 0.0 à 1.0 (100%)
            float norm = raw * (4.096f / 3.3f);
            if(norm > 1.0f) norm = 1.0f;
            if(norm < 0.0f) norm = 0.0f;

            // Barre visuelle ASCII de 10 crans
            char bar[11] = "..........";
            int steps = (int)(norm * 10.0f + 0.5f);
            if(steps > 10) steps = 10;
            for(int b = 0; b < steps; b++) bar[b] = '#';

            rt_printf("  Ch%2d |     %0.2f      |      %3.0f %%       | [%s]\n",
                      ch, raw, norm * 100.0f, bar);
        }
    }
}

void cleanup(BelaContext *context, void *userData) {}