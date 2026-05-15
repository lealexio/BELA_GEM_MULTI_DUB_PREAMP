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

HardwareManager gHardwareManager;

// Throttle print rate (~0.5 s)
unsigned int gPrintCounter = 0;

float gPhase     = 0;
float gFrequency = 440;
Scope scope;

bool setup(BelaContext *context, void *userData)
{
    scope.setup(1, context->audioSampleRate);

    if(!gHardwareManager.setup(context)) {
        rt_fprintf(stderr, "HardwareManager init failed\n");
        return false;
    }
    return true;
}

void render(BelaContext *context, void *userData)
{
    // Scan one MUX channel per render callback (safe: runs in the RT audio thread)
    gHardwareManager.scanStep(context);

    for(unsigned int n = 0; n < context->audioFrames; n++) {
        float out = 0.8f * sinf(gPhase);
        gPhase += 2.0f * M_PI * gFrequency / context->audioSampleRate;
        if(gPhase > 2.0f * M_PI)
            gPhase -= 2.0f * M_PI;

        scope.log(out);
        for(unsigned int ch = 0; ch < context->audioOutChannels; ch++)
            audioWrite(context, n, ch, out);
    }

    // Print all 16 MUX channels (C0–C15) every ~0.5 seconds
    if(++gPrintCounter >= (context->audioSampleRate / context->audioFrames * 0.5f)) {
        rt_printf("--- MUX Channel Values ---\n");
        for(int i = 0; i < 16; i++)
            rt_printf("C%02d: %.3f\n", i, gHardwareManager.getPotValue(i));
        rt_printf("--------------------------\n");
        gPrintCounter = 0;
    }
}

void cleanup(BelaContext *context, void *userData) {}
