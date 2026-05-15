/*
 ____  _____ _        _
| __ )| ____| |      / \
|  _ \|  _| | |     / _ \
| |_) | |___| |___ / ___ \
|____/|_____|_____/_/   \_\
https://bela.io
*/

#include <Bela.h>
#include <libraries/Scope/Scope.h>
#include <cmath>
#include "HardwareManager.h"
#include "DspEngine.h"

HardwareManager gHardwareManager;
DspEngine       gDspEngine;

// Throttle print rate (~0.5 s)
unsigned int gPrintCounter = 0;

Scope scope;

// Snaps a pot value to 0.5 if it falls within the centre dead-zone.
// kSnapRadius defines the half-width of the magnetic zone around 0.5.
static constexpr float kSnapRadius = 0.10f;
static inline float snapToCenter(float pot) {
    return (fabsf(pot - 0.5f) <= kSnapRadius) ? 0.5f : pot;
}

// Maps a pot value [0.0, 1.0] to a gain in dB [-6, +6].
// 0.0 → -6 dB  |  0.5 → 0 dB  |  1.0 → +6 dB
static inline float potToGainDb(float pot) {
    return (snapToCenter(pot) - 0.5f) * 12.0f;
}

bool setup(BelaContext *context, void *userData)
{
    scope.setup(2, context->audioSampleRate);

    if(!gHardwareManager.setup(context)) {
        rt_fprintf(stderr, "HardwareManager init failed\n");
        return false;
    }

    gDspEngine.setup(context->audioSampleRate);
    return true;
}

void render(BelaContext *context, void *userData)
{
    // Scan one MUX channel per render callback
    gHardwareManager.scanStep(context);

    // Input gain from C01 (index 1): 0.0 = silence, 1.0 = unity
    float inputGain = gHardwareManager.getPotValue(1);

    // EQ gains: C00=low, C15=mid, C14=high  →  pot 0.5 = 0 dB
    gDspEngine.setGains(
        potToGainDb(gHardwareManager.getPotValue(0)),   // C00 → low shelf
        potToGainDb(gHardwareManager.getPotValue(15)),  // C15 → mid peak
        potToGainDb(gHardwareManager.getPotValue(14))   // C14 → high shelf
    );

    for(unsigned int n = 0; n < context->audioFrames; n++) {
        // Mix stereo inputs to mono
        float mono = (audioRead(context, n, 0) + audioRead(context, n, 1)) * 0.5f;

        // Apply 3-band EQ then input gain
        float out = gDspEngine.process(mono) * inputGain;

        scope.log(mono, out);
        audioWrite(context, n, 0, out);
        audioWrite(context, n, 1, out);
    }

    // Print DSP input gains and MUX channels every ~0.5 seconds
    if(++gPrintCounter >= (context->audioSampleRate / context->audioFrames * 0.5f)) {
        float gainLow  = potToGainDb(gHardwareManager.getPotValue(0));
        float gainMid  = potToGainDb(gHardwareManager.getPotValue(15));
        float gainHigh = potToGainDb(gHardwareManager.getPotValue(14));
        rt_printf("--- DSP Input Gains ------\n");
        rt_printf("Input gain (C01): %.3f\n",   inputGain);
        rt_printf("Low  shelf (C00): %+.2f dB\n", gainLow);
        rt_printf("Mid  peak  (C15): %+.2f dB\n", gainMid);
        rt_printf("High shelf (C14): %+.2f dB\n", gainHigh);
        rt_printf("--- MUX Channel Values ---\n");
        for(int i = 0; i < 16; i++)
            rt_printf("C%02d: %.3f\n", i, gHardwareManager.getPotValue(i));
        rt_printf("--------------------------\n");
        gPrintCounter = 0;
    }
}

void cleanup(BelaContext *context, void *userData) {}
