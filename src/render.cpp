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
#include "DubSiren.h"
#include "HardwareConfig.h"
#include "SoftwareConfig.h"

HardwareManager gHardwareManager;
ChannelStrip    gChannelStrip;   // IN0 → master (CH1)
ChannelStrip    gChannelStrip2;  // IN1 → master (CH2)
ChannelStrip    gChannelStrip3;  // IN2 → master (AUX3)
ChannelStrip    gChannelStrip4;  // IN3 → master (AUX4)
MasterFx        gMasterFx;
DubSiren        gDubSiren;
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
 * Maps a centred pot value [0.0, 1.0] to a symmetric gain in dB.
 *   0.0 → -range dB  |  0.5 → 0 dB  |  1.0 → +range dB
 * Used for channel EQ (kEqGainRangeDb) and master EQ (kMasterEqGainRangeDb),
 * both of which default to ±6 dB.
 */
static inline float potToGainDb(float pot, float rangeDb = kEqGainRangeDb) {
    return (pot - 0.5f) * (rangeDb * 2.f);
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

/**
 * Returns the logical (display) value for a pot, applying the reversed flag
 * if a matching PotRef exists in kAllNamedPots.
 */
static float logicalPotValue(int mux, int pot) {
    float raw = gHardwareManager.getPotValue(mux, pot);
    for(const auto& ref : kAllNamedPots)
        if(ref.mux == mux && ref.pot == pot)
            return ref.reversed ? 1.f - raw : raw;
    return raw;
}

/** Prints pots that moved since the last call. Silent when nothing changed. */
static void printChangedPots() {
    static float prevValues[kNumMux * kPotsPerMux] = {};
    static bool  initialised = false;

    if(!initialised) {
        for(int m = 0; m < kNumMux; m++)
            for(int p = 0; p < kPotsPerMux; p++)
                prevValues[m * kPotsPerMux + p] = logicalPotValue(m, p);
        initialised = true;
        return;
    }

    for(int m = 0; m < kNumMux; m++) {
        for(int p = 0; p < kPotsPerMux; p++) {
            bool ignored = false;
            for(int i = 0; i < kIgnoredPotsCount; i++)
                if(kIgnoredPots[i].mux == m && kIgnoredPots[i].pot == p) { ignored = true; break; }
            if(ignored) continue;

            float current = logicalPotValue(m, p);
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

/**
 * Named switch registry for debug logging.
 * Each entry holds a SwitchRef and a label.
 * getSwitchState(SwitchRef) already applies the reversed flag, so
 * "active" here means the switch is logically ON (kill engaged, trigger pressed…).
 */
struct NamedSwitch {
    const char* name;
    SwitchRef   ref;
    const char* activeLabel;   // printed when logically active
    const char* inactiveLabel; // printed when logically inactive
};

static const NamedSwitch kNamedSwitches[] = {
    { "KILL_KICK",      KILL_KICK,      "KILL",   "open"  },
    { "KILL_SUB",       KILL_SUB,       "KILL",   "open"  },
    { "KILL_MID",       KILL_MID,       "KILL",   "open"  },
    { "KILL_TOP",       KILL_TOP,       "KILL",   "open"  },
    { "SIREN_TRIGGER",  SIREN_TRIGGER,  "ON",     "off"   },
};
static constexpr int kNamedSwitchCount =
    sizeof(kNamedSwitches) / sizeof(kNamedSwitches[0]);

/** Prints named switches when their logical state changes. */
static void printChangedSwitches() {
    static bool prevStates[kNamedSwitchCount];
    static bool initialised = false;

    for(int i = 0; i < kNamedSwitchCount; ++i) {
        bool state = gHardwareManager.getSwitchState(kNamedSwitches[i].ref);
        if(!initialised || state != prevStates[i]) {
            rt_printf("[SW]  %-16s  →  %s\n",
                kNamedSwitches[i].name,
                state ? kNamedSwitches[i].activeLabel
                      : kNamedSwitches[i].inactiveLabel);
            prevStates[i] = state;
        }
    }
    initialised = true;
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
    gChannelStrip3.setup(context->audioSampleRate);
    gChannelStrip4.setup(context->audioSampleRate);
    gMasterFx.setup(context->audioSampleRate);
    gDubSiren.setup(context->audioSampleRate);

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

    // --- AUX 3 controls ---
    gChannelStrip3.setInputGain(gHardwareManager.getPotValue(AUX3_INPUT_GAIN));
    gChannelStrip3.setEqGains(
        potToGainDb(gHardwareManager.getCenteredPotValue(AUX3_EQ_LOW)),
        potToGainDb(gHardwareManager.getCenteredPotValue(AUX3_EQ_MID)),
        potToGainDb(gHardwareManager.getCenteredPotValue(AUX3_EQ_HIGH))
    );
    gChannelStrip3.setFxSendLevel(gHardwareManager.getPotValue(AUX3_FX_SEND));

    // --- AUX 4 controls ---
    gChannelStrip4.setInputGain(gHardwareManager.getPotValue(AUX4_INPUT_GAIN));
    gChannelStrip4.setEqGains(
        potToGainDb(gHardwareManager.getCenteredPotValue(AUX4_EQ_LOW)),
        potToGainDb(gHardwareManager.getCenteredPotValue(AUX4_EQ_MID)),
        potToGainDb(gHardwareManager.getCenteredPotValue(AUX4_EQ_HIGH))
    );
    gChannelStrip4.setFxSendLevel(gHardwareManager.getPotValue(AUX4_FX_SEND));

    // --- Master parametric EQ ---
    gMasterFx.setParamEqBand(ParametricEq::SUB,
        gHardwareManager.getPotValue(MASTER_EQ_SUB_FREQ),
        potToGainDb(gHardwareManager.getCenteredPotValue(MASTER_EQ_SUB_GAIN), kMasterEqGainRangeDb)
    );
    gMasterFx.setParamEqBand(ParametricEq::KICK,
        gHardwareManager.getPotValue(MASTER_EQ_KICK_FREQ),
        potToGainDb(gHardwareManager.getCenteredPotValue(MASTER_EQ_KICK_GAIN), kMasterEqGainRangeDb)
    );
    gMasterFx.setParamEqBand(ParametricEq::MID,
        gHardwareManager.getPotValue(MASTER_EQ_MID_FREQ),
        potToGainDb(gHardwareManager.getCenteredPotValue(MASTER_EQ_MID_GAIN), kMasterEqGainRangeDb)
    );
    gMasterFx.setParamEqBand(ParametricEq::TOP,
        gHardwareManager.getPotValue(MASTER_EQ_TOP_FREQ),
        potToGainDb(gHardwareManager.getCenteredPotValue(MASTER_EQ_TOP_GAIN), kMasterEqGainRangeDb)
    );

    // --- Master graphic EQ — 12 bands, pots centred = 0 dB ---
    static const PotRef kGeqPots[GraphicEq::kNumBands] = {
        GEQ_40HZ, GEQ_60HZ, GEQ_80HZ, GEQ_100HZ, GEQ_125HZ, GEQ_250HZ,
        GEQ_500HZ, GEQ_1KHZ, GEQ_2KHZ, GEQ_4KHZ, GEQ_8KHZ, GEQ_16KHZ
    };
    for(int i = 0; i < GraphicEq::kNumBands; ++i) {
        float pot = gHardwareManager.getCenteredPotValue(kGeqPots[i]);
        gMasterFx.setGraphicEqBand(i, potToGainDb(pot, kGEqGainRangeDb));
    }

    // --- Master filter section (HPF + LPF — pot at 0 = filter OFF) ---
    gMasterFx.setHpf(
        gHardwareManager.getPotValue(MASTER_HPF_FREQ),
        gHardwareManager.getPotValue(MASTER_HPF_RES)
    );
    gMasterFx.setLpf(
        gHardwareManager.getPotValue(MASTER_LPF_FREQ),
        gHardwareManager.getPotValue(MASTER_LPF_RES)
    );

    // --- Master kill switches — targets updated here, ramp advances per sample ---
    gMasterFx.setKills(
        gHardwareManager.getSwitchState(KILL_SUB),
        gHardwareManager.getSwitchState(KILL_KICK),
        gHardwareManager.getSwitchState(KILL_MID),
        gHardwareManager.getSwitchState(KILL_TOP)
    );

    // --- Dub siren controls ---
    gDubSiren.setControls(
        gHardwareManager.getPotValue(SIREN_TYPE),
        gHardwareManager.getPotValue(SIREN_MOD),
        gHardwareManager.getPotValue(SIREN_GAIN),
        gHardwareManager.getPotValue(SIREN_FX_SEND),
        gHardwareManager.getSwitchState(SIREN_TRIGGER)
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
        float dry3 = gChannelStrip3.process(readChannelInput(context, n, AUX3_CONFIG));
        float dry4 = gChannelStrip4.process(readChannelInput(context, n, AUX4_CONFIG));

        // Siren: process before FX send to include its FX output
        float sirenOut = gDubSiren.process();

        // FX send: all channel strips + siren → OUT2 (external effect unit)
        float fxSend = gChannelStrip.fxOut()  + gChannelStrip2.fxOut()
                     + gChannelStrip3.fxOut() + gChannelStrip4.fxOut()
                     + gDubSiren.fxOut();
        audioWrite(context, n, FX1_SEND_OUT, fxSend);

        // FX return: noise-gated to suppress idle hum from the effect unit
        float fxReturn = gMasterFx.processFxReturn(audioRead(context, n, FX1_RETURN_IN));

        // Master bus: all channels + siren + FX return → EQ → filters → kills
        float out = gMasterFx.process(dry1 + dry2 + dry3 + dry4 + sirenOut + fxReturn);

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
