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
#include "ChannelStrip.h"
#include "HardwareConfig.h"

HardwareManager gHardwareManager;
ChannelStrip    gChannelStrip;

static const bool DEBUG = true;

// Throttle print rate (~0.5 s)
unsigned int gPrintCounter = 0;

// Clip detection: samples at or above this absolute value are considered clipped.
// ADC hard clip occurs at 1.0; 0.99 gives a small early-warning margin.
static constexpr float kClipThreshold = 0.99f;
// Minimum number of render blocks between two clip warnings (avoids log spam).
static constexpr unsigned int kClipWarnInterval = 4410; // ~0.5 s at 44.1 kHz / 16 frames
unsigned int gClipWarnCounter = 0;

Scope scope;

// Maps a centred pot value [0.0, 1.0] to a gain in dB [-6, +6].
// 0.0 → -6 dB  |  0.5 → 0 dB  |  1.0 → +6 dB
static inline float potToGainDb(float pot) {
    return (pot - 0.5f) * 12.0f;
}

/** Prints current ChannelStrip gains to the console. */
static void printChannelStrip() {
    float gainLow  = potToGainDb(gHardwareManager.getCenteredPotValue(EQ_LOW_GAIN));
    float gainMid  = potToGainDb(gHardwareManager.getCenteredPotValue(EQ_MID_GAIN));
    float gainHigh = potToGainDb(gHardwareManager.getCenteredPotValue(EQ_HIGH_GAIN));
    rt_printf("--- Channel Strip --------\n");
    rt_printf("INPUT_GAIN  : %.3f\n",     gHardwareManager.getPotValue(INPUT_GAIN));
    rt_printf("EQ_LOW_GAIN : %+.2f dB\n", gainLow);
    rt_printf("EQ_MID_GAIN : %+.2f dB\n", gainMid);
    rt_printf("EQ_HIGH_GAIN: %+.2f dB\n", gainHigh);
    rt_printf("--------------------------\n");
}

bool setup(BelaContext *context, void *userData)
{
    scope.setup(2, context->audioSampleRate);

    if(!gHardwareManager.setup(context)) {
        rt_fprintf(stderr, "HardwareManager init failed\n");
        return false;
    }

    gChannelStrip.setup(context->audioSampleRate);
    return true;
}

void render(BelaContext *context, void *userData)
{
    // Scan one MUX channel per render callback
    gHardwareManager.scanStep(context);

    gChannelStrip.setInputGain(gHardwareManager.getPotValue(INPUT_GAIN));
    gChannelStrip.setEqGains(
        potToGainDb(gHardwareManager.getCenteredPotValue(EQ_LOW_GAIN)),
        potToGainDb(gHardwareManager.getCenteredPotValue(EQ_MID_GAIN)),
        potToGainDb(gHardwareManager.getCenteredPotValue(EQ_HIGH_GAIN))
    );

    bool clipCh0 = false;
    bool clipCh1 = false;
    for(unsigned int n = 0; n < context->audioFrames; n++) {
        float in0 = audioRead(context, n, 0);
        float in1 = audioRead(context, n, 1);

        if(fabsf(in0) >= kClipThreshold) clipCh0 = true;
        if(fabsf(in1) >= kClipThreshold) clipCh1 = true;

        float mono = (in0 + in1) * 0.5f;
        float out  = gChannelStrip.process(mono);

        scope.log(mono, out);
        audioWrite(context, n, 0, out);
        audioWrite(context, n, 1, out);
    }

    // Warn once per interval per channel to avoid log spam
    ++gClipWarnCounter;
    if((clipCh0 || clipCh1) && gClipWarnCounter >= kClipWarnInterval) {
        if(clipCh0) rt_printf("WARNING Canal 0 clipping\n");
        if(clipCh1) rt_printf("WARNING Canal 1 clipping\n");
        gClipWarnCounter = 0;
    }

    // Print DSP input gains every ~0.5 seconds
    if(DEBUG && ++gPrintCounter >= (context->audioSampleRate / context->audioFrames * 0.5f)) {
        printChannelStrip();
        gPrintCounter = 0;
    }
}

void cleanup(BelaContext *context, void *userData) {}
