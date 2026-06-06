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
#include <unistd.h>
#include "HardwareManager.h"
#include "ChannelStrip.h"
#include "MasterFx.h"
#include "HardwareConfig.h"
#include "SoftwareConfig.h"

HardwareManager gHardwareManager;
ChannelStrip    gChannelStrip;   // IN0 → master
ChannelStrip    gChannelStrip2;  // IN1 → master
MasterFx        gMasterFx;
AuxiliaryTask   gI2cTask;

Scope scope;

static unsigned int gClipWarnCounter = 0;

// ---------------------------------------------------------------------------
// I2C auxiliary task — reads MCP23017 in a non-RT thread every ~5 ms
// ---------------------------------------------------------------------------

void readI2cTask(void*) {
    while(!Bela_stopRequested()) {
        gHardwareManager.readMcp23017();
        usleep(5000);
    }
}

// ---------------------------------------------------------------------------
// Audio helpers
// ---------------------------------------------------------------------------

/**
 * Maps a centred pot value [0.0, 1.0] to a gain in dB.
 *   0.0 → -kEqGainRangeDb   |   0.5 → 0 dB   |   1.0 → +kEqGainRangeDb
 */
static inline float potToGainDb(float pot) {
    return (pot - 0.5f) * (kEqGainRangeDb * 2.f);
}

/**
 * Reads all valid audio inputs for the given config and returns their average.
 * Single input → direct pass-through. Two inputs → averaged to mono.
 */
static inline float readChannelInput(BelaContext* ctx, unsigned int frame,
                                     const ChannelConfig& cfg) {
    float sum   = 0.f;
    int   count = 0;
    for(int i = 0; i < 2; ++i) {
        if(cfg.audioIns[i] != -1) {
            sum += audioRead(ctx, frame, cfg.audioIns[i]);
            ++count;
        }
    }
    return (count > 0) ? sum / count : 0.f;
}

// ---------------------------------------------------------------------------
// Debug helpers (compiled-out when kDebug = false)
// ---------------------------------------------------------------------------

/** Prints pots that moved since the last call. Silent when nothing changed. */
static void printChangedPots() {
    static float prevValues[kNumMux * kPotsPerMux] = {};
    static bool  initialised = false;

    if(!initialised) {
        for(int m = 0; m < kNumMux; m++)
            for(int p = 0; p < kPotsPerMux; p++)
                prevValues[m * kPotsPerMux + p] = gHardwareManager.getPotValue(m, p);
        initialised = true;
        return;
    }

    for(int m = 0; m < kNumMux; m++) {
        for(int p = 0; p < kPotsPerMux; p++) {
            bool ignored = false;
            for(int i = 0; i < kIgnoredPotsCount; i++)
                if(kIgnoredPots[i].mux == m && kIgnoredPots[i].pot == p) { ignored = true; break; }
            if(ignored) continue;

            float current = gHardwareManager.getPotValue(m, p);
            float prev    = prevValues[m * kPotsPerMux + p];
            if(fabsf(current - prev) >= kDebugPotMinMove) {
                const char* name = getPotName(m, p);
                rt_printf("[POT] %-16s  MUX%d/C%02d  →  %.3f\n",
                          name ? name : "unassigned", m, p, current);
                prevValues[m * kPotsPerMux + p] = current;
            }
        }
    }
}

/** Prints MCP23017 PA switches only when their state changes. */
static void printChangedSwitches() {
    static int prevStates = -1;

    int current = 0;
    for(int pin = 0; pin < 8; pin++)
        current |= (gHardwareManager.getSwitchState(pin) ? 1 : 0) << pin;

    if(current == prevStates) return;

    for(int pin = 0; pin < 8; pin++) {
        bool prev = (prevStates >> pin) & 1;
        bool now  = (current   >> pin) & 1;
        if(prev != now || prevStates == -1)
            rt_printf("[SW]  PA%d  →  %s\n", pin, now ? "OPEN" : "CLOSED");
    }
    prevStates = current;
}

// ---------------------------------------------------------------------------
// Bela callbacks
// ---------------------------------------------------------------------------

bool setup(BelaContext* context, void* userData) {
    scope.setup(2, context->audioSampleRate);

    if(!gHardwareManager.setup(context)) {
        rt_fprintf(stderr, "HardwareManager init failed\n");
        return false;
    }

    gChannelStrip.setup(context->audioSampleRate);
    gChannelStrip2.setup(context->audioSampleRate);
    gMasterFx.setup(context->audioSampleRate);

    if(!gHardwareManager.initMcp23017())
        return false;

    gI2cTask = Bela_createAuxiliaryTask(readI2cTask, 50, "i2c-reader", nullptr);
    Bela_scheduleAuxiliaryTask(gI2cTask);

    return true;
}

void render(BelaContext* context, void* userData) {
    gHardwareManager.scanStep(context);

    // --- Channel Strip 1 controls ---
    gChannelStrip.setInputGain(gHardwareManager.getPotValue(CH1_INPUT_GAIN));
    gChannelStrip.setEqGains(
        potToGainDb(gHardwareManager.getCenteredPotValue(CH1_EQ_LOW)),
        potToGainDb(gHardwareManager.getCenteredPotValue(CH1_EQ_MID)),
        potToGainDb(gHardwareManager.getCenteredPotValue(CH1_EQ_HIGH))
    );
    gChannelStrip.setFxSendLevel(gHardwareManager.getPotValue(CH1_FX_SEND));

    // --- Channel Strip 2 controls ---
    gChannelStrip2.setInputGain(gHardwareManager.getPotValue(CH2_INPUT_GAIN));
    gChannelStrip2.setEqGains(
        potToGainDb(gHardwareManager.getCenteredPotValue(CH2_EQ_LOW)),
        potToGainDb(gHardwareManager.getCenteredPotValue(CH2_EQ_MID)),
        potToGainDb(gHardwareManager.getCenteredPotValue(CH2_EQ_HIGH))
    );
    gChannelStrip2.setFxSendLevel(gHardwareManager.getPotValue(CH2_FX_SEND));

    // --- Master kill switches — targets updated here, ramp advances per sample ---
    gMasterFx.setKills(
        gHardwareManager.getSwitchState(KILL_SUB),
        gHardwareManager.getSwitchState(KILL_KICK),
        gHardwareManager.getSwitchState(KILL_MID),
        gHardwareManager.getSwitchState(KILL_TOP)
    );

    // --- Sample loop ---
    bool clipCh0 = false;
    bool clipCh1 = false;

    for(unsigned int n = 0; n < context->audioFrames; n++) {
        float in0 = readChannelInput(context, n, CH1_CONFIG);
        float in1 = readChannelInput(context, n, CH2_CONFIG);

        if(fabsf(in0) >= kClipThreshold) clipCh0 = true;
        if(fabsf(in1) >= kClipThreshold) clipCh1 = true;

        float dry1 = gChannelStrip.process(in0);
        float dry2 = gChannelStrip2.process(in1);

        // FX send: post-fader sum → OUT2 (external effect unit)
        float fxSend = gChannelStrip.fxOut() + gChannelStrip2.fxOut();
        audioWrite(context, n, FX1_SEND_OUT, fxSend);

        // FX return: noise-gated to suppress idle hum from the effect unit
        float fxReturn = gMasterFx.processFxReturn(audioRead(context, n, FX1_RETURN_IN));

        // Master bus: dry + FX return → kill crossover → stereo output
        float out = gMasterFx.process(dry1 + dry2 + fxReturn);

        scope.log(dry1 + dry2 + fxReturn, out);
        audioWrite(context, n, MASTER_OUT_L, out);
        audioWrite(context, n, MASTER_OUT_R, out);
    }

    // --- Clip warnings (rate-limited) ---
    ++gClipWarnCounter;
    if((clipCh0 || clipCh1) && gClipWarnCounter >= kClipWarnIntervalBlocks) {
        if(clipCh0) rt_printf("WARNING Canal 0 clipping\n");
        if(clipCh1) rt_printf("WARNING Canal 1 clipping\n");
        gClipWarnCounter = 0;
    }

    // --- Debug logging ---
    if(kDebug) {
        printChangedPots();
        printChangedSwitches();
    }
}

void cleanup(BelaContext* context, void* userData) {
    gHardwareManager.closeMcp23017();
}
