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

HardwareManager gHardwareManager;
ChannelStrip    gChannelStrip;   // IN0 → master
ChannelStrip    gChannelStrip2;  // IN1 → master
MasterFx        gMasterFx;       // sum of channels → OUT0 + OUT1
AuxiliaryTask   gI2cTask;

static const bool DEBUG = true;

// I2C auxiliary task: reads MCP23017 in a non-RT thread every ~5 ms
void readI2cTask(void*) {
    while(!Bela_stopRequested()) {
        gHardwareManager.readMcp23017();
        usleep(5000);
    }
}

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

// Returns true when a kill switch is active, honouring the reversed flag.
// By default a switch is active when its PA pin is LOW (button pressed).
static inline bool readSwitch(const SwitchRef& sw) {
    bool state = gHardwareManager.getSwitchState(sw.pin);
    return sw.reversed ? state : !state;
}

// Reads all valid audio inputs (audioIns[i] != -1) and returns their average.
// Single input → direct pass-through. Two inputs → averaged to mono.
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

/**
 * Detects which potentiometers moved since the last call and prints their
 * address and current value. Silent if nothing changed.
 * Only active when DEBUG = true.
 */
static void printChangedPots() {
    // Total pots across all MUX (4 × 16 = 64)
    static float prevValues[4 * 16] = {};
    static bool  initialised        = false;

    // Seed previous values on first call so we don't flood the console at startup
    if(!initialised) {
        for(int m = 0; m < 4; m++)
            for(int p = 0; p < 16; p++)
                prevValues[m * 16 + p] = gHardwareManager.getPotValue(m, p);
        initialised = true;
        return;
    }

    for(int m = 0; m < 4; m++) {
        for(int p = 0; p < 16; p++) {
            float current = gHardwareManager.getPotValue(m, p);
            float prev    = prevValues[m * 16 + p];
            bool ignored = false;
            for(int i = 0; i < kIgnoredPotsCount; i++)
                if(kIgnoredPots[i].mux == m && kIgnoredPots[i].pot == p) { ignored = true; break; }
            if(ignored) continue;

            if(fabsf(current - prev) >= 0.01f) {
                const char* name = getPotName(m, p);
                if(name)
                    rt_printf("[POT] %-14s  MUX%d/C%02d  →  %.3f\n", name, m, p, current);
                else
                    rt_printf("[POT] %-14s  MUX%d/C%02d  →  %.3f\n", "unassigned", m, p, current);
                prevValues[m * 16 + p] = current;
            }
        }
    }
}

/** Prints MCP23017 PA switches only when their state changes. */
static void printChangedSwitches() {
    static int prevStates = -1; // -1 forces print on first call

    // Read all 8 PA pins as a bitmask
    int current = 0;
    for(int pin = 0; pin < 8; pin++)
        current |= (gHardwareManager.getSwitchState(pin) ? 1 : 0) << pin;

    if(current == prevStates) return;

    // Print only pins whose state changed
    for(int pin = 0; pin < 8; pin++) {
        bool prev = (prevStates >> pin) & 1;
        bool now  = (current   >> pin) & 1;
        if(prev != now || prevStates == -1)
            rt_printf("[SW]  PA%d  →  %s\n", pin, now ? "OPEN" : "CLOSED");
    }
    prevStates = current;
}


bool setup(BelaContext *context, void *userData)
{
    scope.setup(2, context->audioSampleRate);

    if(!gHardwareManager.setup(context)) {
        rt_fprintf(stderr, "HardwareManager init failed\n");
        return false;
    }

    gChannelStrip.setup(context->audioSampleRate);
    gChannelStrip2.setup(context->audioSampleRate);
    gMasterFx.setup(context->audioSampleRate);

    // Initialise MCP23017 and launch I2C reading task
    if(!gHardwareManager.initMcp23017())
        return false;

    gI2cTask = Bela_createAuxiliaryTask(readI2cTask, 50, "i2c-reader", nullptr);
    Bela_scheduleAuxiliaryTask(gI2cTask);

    return true;
}

void render(BelaContext *context, void *userData)
{
    // Scan one MUX channel per render callback
    gHardwareManager.scanStep(context);

    // --- Channel Strip 1 controls (IN0 → OUT0) ---
    gChannelStrip.setInputGain(gHardwareManager.getPotValue(CH1_INPUT_GAIN));
    gChannelStrip.setEqGains(
        potToGainDb(gHardwareManager.getCenteredPotValue(CH1_EQ_LOW)),
        potToGainDb(gHardwareManager.getCenteredPotValue(CH1_EQ_MID)),
        potToGainDb(gHardwareManager.getCenteredPotValue(CH1_EQ_HIGH))
    );

    // --- Channel Strip 2 controls (IN1 → OUT1) ---
    gChannelStrip2.setInputGain(gHardwareManager.getPotValue(CH2_INPUT_GAIN));
    gChannelStrip2.setEqGains(
        potToGainDb(gHardwareManager.getCenteredPotValue(CH2_EQ_LOW)),
        potToGainDb(gHardwareManager.getCenteredPotValue(CH2_EQ_MID)),
        potToGainDb(gHardwareManager.getCenteredPotValue(CH2_EQ_HIGH))
    );

    // Update master kill switches — routing and polarity defined in HardwareConfig.h
    gMasterFx.setKills(
        readSwitch(KILL_SUB),
        readSwitch(KILL_KICK),
        readSwitch(KILL_MID),
        readSwitch(KILL_TOP)
    );

    bool clipCh0 = false;
    bool clipCh1 = false;
    for(unsigned int n = 0; n < context->audioFrames; n++) {
        float in0 = readChannelInput(context, n, CH1_CONFIG);
        float in1 = readChannelInput(context, n, CH2_CONFIG);

        if(fabsf(in0) >= kClipThreshold) clipCh0 = true;
        if(fabsf(in1) >= kClipThreshold) clipCh1 = true;

        // Sum channels then pass through master effects bus
        float mix = gChannelStrip.process(in0) + gChannelStrip2.process(in1);
        float out = gMasterFx.process(mix);

        scope.log(mix, out);
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


    if(DEBUG)
        // Print any pot that moved (immediate, no throttle)
        printChangedPots();

    // Print switch state changes immediately
    if(DEBUG)
        printChangedSwitches();
}

void cleanup(BelaContext *context, void *userData) {
    gHardwareManager.closeMcp23017();
}
