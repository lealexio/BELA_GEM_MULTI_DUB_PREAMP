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
#include <libraries/Gui/Gui.h>
#include <cmath>
#include <unistd.h>
#include <cstdio>
#include <cstring>
#include <vector>
#include <atomic>
#include <algorithm>
#include "HardwareManager.h"
#include "ChannelStrip.h"
#include "MasterFx.h"
#include "DubSiren.h"
#include "SamplePlayer.h"
#include "HardwareConfig.h"
#include "SoftwareConfig.h"
#include "ConfigLoader.h"

HardwareManager gHardwareManager;
ChannelStrip    gChannelStrip;   // IN0 → master (CH1)
ChannelStrip    gChannelStrip2;  // IN1 → master (CH2)
ChannelStrip    gChannelStrip3;  // IN2 → master (AUX3)
ChannelStrip    gChannelStrip4;  // IN3 → master (AUX4)

MasterFx        gMasterFx;
DubSiren        gDubSiren;
SamplePlayer    gSamplePlayer;
AuxiliaryTask   gI2cTask;
AuxiliaryTask   gCpuTempTask;

// FX send 1 band filters (PA5 = MIDS, PA6 = TOPS)
BiquadFilter    gFxHpf4k;    // TOPS mode : HPF at kFxMidHighFreq
BiquadFilter    gFxMidHpf;   // MIDS mode : HPF at kFxMidLowFreq
BiquadFilter    gFxMidLpf;   // MIDS mode : LPF at kFxMidHighFreq

// FX send 2 band filters (PA4 = MIDS, PA7 = TOPS)
BiquadFilter    gFx2Hpf4k;   // TOPS mode : HPF at kFxMidHighFreq
BiquadFilter    gFx2MidHpf;  // MIDS mode : HPF at kFxMidLowFreq
BiquadFilter    gFx2MidLpf;  // MIDS mode : LPF at kFxMidHighFreq

// VU meter band-split filters (post-MasterFx, one biquad per crossover edge).
BiquadFilter    gVuSubLpf;  // SUB  : LPF  @ kKillFc0 (80 Hz)
BiquadFilter    gVuKickHpf; // KICK : HPF  @ kKillFc0 (80 Hz)
BiquadFilter    gVuKickLpf; // KICK : LPF  @ kKillFc1 (200 Hz)
BiquadFilter    gVuMidHpf;  // MID  : HPF  @ kKillFc1 (200 Hz)
BiquadFilter    gVuMidLpf;  // MID  : LPF  @ kKillFc2 (1200 Hz)
BiquadFilter    gVuTopHpf;  // TOP  : HPF  @ kKillFc2 (1200 Hz)

// Mic-mode dry HPF: 24 dB/oct (kMicHpfStages × Butterworth) per AUX.
BiquadFilter    gMicHpf[4][kMicHpfStages];
bool            gMicHpfActive[4] = { false, false, false, false };
/// Bits 0–3 set by gui_control callback; consumed at start of render() to rebuild coeffs.
static std::atomic<uint8_t> gMicHpfPendingMask{0};

Scope scope;

// ---------------------------------------------------------------------------
// Bela GUI — data bridge between render() and the browser UI (sketch.js)
// ---------------------------------------------------------------------------

Gui gGui;

// Pre-allocated send buffers (sized in setup, written in render, never resized).
static std::vector<float> gPotValuesBuf;      // [kAllNamedPotsCount]
static std::vector<float> gSwitchBuf;         // [9]
static std::vector<float> gSirenBuf;          // [3] presetIdx / gate / mod
static std::vector<float> gSamplerStateBuf;   // [5] folderOk / count / slot / playing / playhead
static std::vector<float> gSamplerNamesBuf;   // [kGuiSamplerNamesSize] packed ASCII names
static std::vector<float> gAudioLevelsBuf;    // [13] peak levels
static std::vector<float> gPotMappingBuf;     // [kAllNamedPotsCount×4] pot mapping for GUI
static std::vector<float> gSwitchMappingBuf;  // [9×3] switch mapping for GUI
static std::vector<float> gConfigMetaBuf;     // [kGuiConfigMetaSize] mux/routing/ignoredPots
static std::vector<float> gMuxRawBuf;         // [kGuiMuxRawBufSize] raw pot values per MUX channel

// Codec gain state — written at boot from config.json and by the gui_control
// callback (seasocks thread). Broadcast to every connected GUI client via
// buffer 8 at ~20 fps.
// Layout: [0..9] = ADC input gain by physical channel (dB),
//         [10..19] = DAC output gain by physical channel (dB).
static float              gCodecGains[20]   = {};
static std::vector<float> gCodecGainsBuf;   // [20]

/** Applies ADC input PGA gain for one physical channel and mirrors into gCodecGains. */
static void applyCodecInputGain(int ch, float gainDb) {
    if(ch < 0 || ch >= kCodecChannels) return;
    float gain = std::max(kCodecInputGainMinDb, std::min(kCodecInputGainMaxDb, gainDb));
    Bela_setAudioInputGain(ch, gain);
    gCodecGains[ch] = gain;
}

/** Applies DAC output level for one physical channel and mirrors into gCodecGains. */
static void applyCodecOutputGain(int ch, float gainDb) {
    if(ch < 0 || ch >= kCodecChannels) return;
    float gain = std::max(kCodecOutputGainMinDb, std::min(kCodecOutputGainMaxDb, gainDb));
    Bela_setHpLevel(ch, gain);
    gCodecGains[10 + ch] = gain;
}

/** Loads config.json codec defaults into the hardware codec and gCodecGains[]. */
static void applyCodecGainsFromConfig() {
    for(int ch = 0; ch < kCodecChannels; ++ch) {
        applyCodecInputGain(ch, CODEC_INPUT_GAIN_DB[ch]);
        applyCodecOutputGain(ch, CODEC_OUTPUT_GAIN_DB[ch]);
    }
    rt_printf("[Config] Codec gains applied from config.json (ADC + DAC)\n");
}

// CPU temperature (°C) — written by the non-RT AuxTask, read in render for GUI.
// Negative means "not yet read / unavailable".
static volatile float     gCpuTempC      = -1.f;
static std::vector<float> gCpuTempBuf;   // [1] buffer 9

// Per-block peak accumulators — one entry per tracked audio channel.
// Index map: 0-3 = in0-in3 | 4-5 = fxRet1-2 | 6 = master out
//            7-8 = fxSend1-2 | 9-12 = vuSub/Kick/Mid/Top
static float gAudioPeaks[13] = {};

static int  gGuiUpdateSampleCount = 0;      // accumulates context->audioFrames per block
static int  gGuiStaticSendCount   = kGuiStaticBufSendDivisor; // force static send on first tick

// Path built in setup() from context->projectName — never hardcoded.
static char kGuiConfigPath[256] = {};

// Switch globals in the same order as the JS SWITCH_NAMES array.
static SwitchRef* const kGuiSwitchRefs[9] = {
    &KILL_SUB, &KILL_KICK, &KILL_MID, &KILL_TOP,
    &FX_FILTER_MIDS, &FX_FILTER_TOPS, &FX2_FILTER_TOPS, &FX2_FILTER_MIDS,
    &SIREN_TRIGGER
};

/** Packs sample filenames into gSamplerNamesBuf as fixed-width ASCII floats (buffer 11). */
static void fillSamplerNamesBuf() {
    gSamplerNamesBuf.assign(kGuiSamplerNamesSize, 0.f);
    const int count = gSamplePlayer.sampleCount();
    for(int i = 0; i < count && i < kMaxSamples; ++i) {
        const char* name = gSamplePlayer.sampleName(i);
        const int base = i * kMaxSampleNameLen;
        for(int c = 0; c < kMaxSampleNameLen; ++c) {
            char ch = name[c];
            gSamplerNamesBuf[base + c] = (float)(unsigned char)ch;
            if(ch == '\0') break;
        }
    }
}

/** Fills gConfigMetaBuf with mux/calibration/routing/ignoredPots (buffer 6 layout). */
static void fillConfigMetaBuf() {
    gConfigMetaBuf.assign(kGuiConfigMetaSize, 0.f);
    gConfigMetaBuf[0]  = (float)kActiveMux;
    gConfigMetaBuf[1]  = kPotScaleRecovery;
    gConfigMetaBuf[2]  = kPotMax;
    gConfigMetaBuf[3]  = kPotMin;
    gConfigMetaBuf[4]  = (float)kMcpAddress;
    gConfigMetaBuf[5]  = (float)MASTER_OUTS_COUNT;
    gConfigMetaBuf[6]  = (float)(MASTER_OUTS_COUNT > 0 ? MASTER_OUTS[0] : 0);
    gConfigMetaBuf[7]  = (float)(MASTER_OUTS_COUNT > 1 ? MASTER_OUTS[1] : 0);
    gConfigMetaBuf[8]  = (float)FX1_SEND_OUT;
    gConfigMetaBuf[9]  = (float)FX2_SEND_OUT;
    gConfigMetaBuf[10] = (float)VU_SUB_OUT;
    gConfigMetaBuf[11] = (float)VU_KICK_OUT;
    gConfigMetaBuf[12] = (float)VU_MID_OUT;
    gConfigMetaBuf[13] = (float)VU_TOP_OUT;
    gConfigMetaBuf[14] = (float)FX1_RETURN_IN;
    gConfigMetaBuf[15] = (float)FX2_RETURN_IN;
    gConfigMetaBuf[16] = (float)AUX1_CONFIG.audioIns[0];
    gConfigMetaBuf[17] = (float)AUX2_CONFIG.audioIns[0];
    gConfigMetaBuf[18] = (float)AUX3_CONFIG.audioIns[0];
    gConfigMetaBuf[19] = (float)AUX4_CONFIG.audioIns[0];
    gConfigMetaBuf[20] = AUX1_CONFIG.micMode ? 1.f : 0.f;
    gConfigMetaBuf[21] = AUX2_CONFIG.micMode ? 1.f : 0.f;
    gConfigMetaBuf[22] = AUX3_CONFIG.micMode ? 1.f : 0.f;
    gConfigMetaBuf[23] = AUX4_CONFIG.micMode ? 1.f : 0.f;
    gConfigMetaBuf[24] = AUX1_CONFIG.hpfHz;
    gConfigMetaBuf[25] = AUX2_CONFIG.hpfHz;
    gConfigMetaBuf[26] = AUX3_CONFIG.hpfHz;
    gConfigMetaBuf[27] = AUX4_CONFIG.hpfHz;
    gConfigMetaBuf[28] = (float)kIgnoredPotsCount;
    for(int i = 0; i < kIgnoredPotsCount; ++i) {
        gConfigMetaBuf[29 + i*2 + 0] = (float)kIgnoredPots[i].mux;
        gConfigMetaBuf[29 + i*2 + 1] = (float)kIgnoredPots[i].pot;
    }
}

// ---------------------------------------------------------------------------

static unsigned int gClipWarnCounter     = 0;
static int          gStartupRampRemaining = 0;
static int          gStartupRampTotal     = 0;

// Populated in setup() after ConfigLoader::load() — not recomputed every block.
static PotRef gGeqPots[GraphicEq::kNumBands];

// ---------------------------------------------------------------------------
// I2C auxiliary task — reads MCP23017 in a non-RT thread every ~5 ms
// ---------------------------------------------------------------------------

void readI2cTask(void*) {
    while(!Bela_stopRequested()) {
        gHardwareManager.readMcp23017();
        usleep(5000);
    }
}

/**
 * Reads SoC die temperature from sysfs (millidegrees → °C).
 * Non-RT only — blocking file I/O must never run in render().
 */
void readCpuTempTask(void*) {
    while(!Bela_stopRequested()) {
        FILE* f = fopen(kCpuTempSysfsPath, "r");
        if(f) {
            int milli = 0;
            if(fscanf(f, "%d", &milli) == 1)
                gCpuTempC = milli / 1000.f;
            fclose(f);
        }
        usleep(kCpuTempPollUs);
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
 * Scales a raw FX send pot value so that kFxSendPotCeiling maps to 1.0.
 * Values above the ceiling are clamped to 1.0, giving full range over
 * a reduced pot travel without any hard snap.
 */
static inline float scaleFxSendPot(float pot) {
    return pot >= kFxSendPotCeiling ? 1.f : pot / kFxSendPotCeiling;
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

/**
 * Configures one AUX mic HPF from ChannelConfig.
 * hpfHz <= 0 or !micMode → inactive bypass.
 * Safe to call from the audio thread (start of render block).
 */
static void setupMicHpf(int idx, const ChannelConfig& cfg, float sampleRate) {
    gMicHpfActive[idx] = false;
    if(!cfg.micMode || cfg.hpfHz <= 0.f)
        return;
    float fc = cfg.hpfHz;
    if(fc < kMicHpfFMin) fc = kMicHpfFMin;
    if(fc > kMicHpfFMax) fc = kMicHpfFMax;
    for(int s = 0; s < kMicHpfStages; ++s) {
        gMicHpf[idx][s].reset();
        gMicHpf[idx][s].setHighPass(fc, kMicHpfQ, sampleRate);
    }
    gMicHpfActive[idx] = true;
}

/** Returns AUX1–4 config by 0-based index, or nullptr. */
static ChannelConfig* auxConfigByIndex(int idx) {
    switch(idx) {
        case 0: return &AUX1_CONFIG;
        case 1: return &AUX2_CONFIG;
        case 2: return &AUX3_CONFIG;
        case 3: return &AUX4_CONFIG;
        default: return nullptr;
    }
}

/** Updates buffer-6 mic/hpf slots from current AUX*_CONFIG (multi-client sync). */
static void refreshMicMetaSlots() {
    if(gConfigMetaBuf.size() < 28) return;
    gConfigMetaBuf[20] = AUX1_CONFIG.micMode ? 1.f : 0.f;
    gConfigMetaBuf[21] = AUX2_CONFIG.micMode ? 1.f : 0.f;
    gConfigMetaBuf[22] = AUX3_CONFIG.micMode ? 1.f : 0.f;
    gConfigMetaBuf[23] = AUX4_CONFIG.micMode ? 1.f : 0.f;
    gConfigMetaBuf[24] = AUX1_CONFIG.hpfHz;
    gConfigMetaBuf[25] = AUX2_CONFIG.hpfHz;
    gConfigMetaBuf[26] = AUX3_CONFIG.hpfHz;
    gConfigMetaBuf[27] = AUX4_CONFIG.hpfHz;
}

/** Applies the mic-path HPF cascade when active; otherwise returns x unchanged. */
static inline float applyMicHpf(int idx, float x) {
    if(!gMicHpfActive[idx]) return x;
    for(int s = 0; s < kMicHpfStages; ++s)
        x = gMicHpf[idx][s].process(x);
    return x;
}

// ---------------------------------------------------------------------------
// Debug helpers (compiled-out when kDebug = false)
// ---------------------------------------------------------------------------

/**
 * Returns the logical (display) value for a pot.
 * Uses getPotValue(PotRef) when a named PotRef exists, so both the reversed
 * flag and the centered snap (0.5 dead-zone) are visible in the debug logs.
 * Falls back to the raw value for unassigned pots.
 */
static float logicalPotValue(int mux, int pot) {
    for(int i = 0; i < kAllNamedPotsCount; ++i)
        if(kAllNamedPots[i].mux == mux && kAllNamedPots[i].pot == pot)
            return gHardwareManager.getPotValue(kAllNamedPots[i]);
    return gHardwareManager.getPotValue(mux, pot);
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

// Populated in setup() after ConfigLoader::load() so that SwitchRef values
// reflect any JSON overrides before the array is frozen for render().
static NamedSwitch kNamedSwitches[8];
static int         kNamedSwitchCount = 0;

/** Returns true if a (port, pin) pair is already covered by kNamedSwitches or handled separately. */
static bool isSwitchNamed(bool portB, int pin) {
    for(int i = 0; i < kNamedSwitchCount; ++i)
        if(kNamedSwitches[i].ref.portB == portB && kNamedSwitches[i].ref.pin == pin)
            return true;
    // Handled by dedicated logging outside kNamedSwitches
    if(portB == SIREN_TRIGGER.portB && pin == SIREN_TRIGGER.pin) return true;
    return false;
}

/** Prints named switches (logical state) and unassigned pins (raw state) on change. */
static void printChangedSwitches() {
    static bool prevNamed[8] = {};  // sized for kNamedSwitches[8]
    static int  prevRawA = -1;
    static int  prevRawB = -1;
    static bool initialised = false;

    // Named switches — logical state with labels
    for(int i = 0; i < kNamedSwitchCount; ++i) {
        bool state = gHardwareManager.getSwitchState(kNamedSwitches[i].ref);
        if(!initialised || state != prevNamed[i]) {
            rt_printf("[SW]  %-16s  →  %s\n",
                kNamedSwitches[i].name,
                state ? kNamedSwitches[i].activeLabel
                      : kNamedSwitches[i].inactiveLabel);
            prevNamed[i] = state;
        }
    }

    // Unassigned pins — raw electrical state (HIGH/LOW)
    int curA = 0, curB = 0;
    for(int pin = 0; pin < 8; ++pin) {
        curA |= (gHardwareManager.getSwitchState (pin) ? 1 : 0) << pin;
        curB |= (gHardwareManager.getSwitchStateB(pin) ? 1 : 0) << pin;
    }

    if(!initialised || curA != prevRawA) {
        for(int pin = 0; pin < 8; ++pin) {
            if(isSwitchNamed(false, pin)) continue;
            bool prev = (prevRawA >> pin) & 1;
            bool now  = (curA    >> pin) & 1;
            if(!initialised || prev != now)
                rt_printf("[SW]  PA%-2d  (unassigned)  →  %s\n", pin, now ? "HIGH" : "LOW");
        }
        prevRawA = curA;
    }

    if(!initialised || curB != prevRawB) {
        for(int pin = 0; pin < 8; ++pin) {
            if(isSwitchNamed(true, pin)) continue;
            bool prev = (prevRawB >> pin) & 1;
            bool now  = (curB    >> pin) & 1;
            if(!initialised || prev != now)
                rt_printf("[SW]  PB%-2d  (unassigned)  →  %s\n", pin, now ? "HIGH" : "LOW");
        }
        prevRawB = curB;
    }

    initialised = true;
}

// ---------------------------------------------------------------------------
// Bela callbacks
// ---------------------------------------------------------------------------

bool setup(BelaContext* context, void* userData) {
    // Build project-directory paths from the runtime project name so the code
    // works regardless of what the project was named in Bela IDE.
    snprintf(kGuiConfigPath, sizeof(kGuiConfigPath),
             "/root/Bela/projects/%s/config.json", context->projectName);

    // Load hardware mappings from JSON before any other initialisation.
    ConfigLoader::load(kGuiConfigPath);

    // Apply routing.*.gain defaults to the codec (same APIs as the Meters UI).
    applyCodecGainsFromConfig();

    // Populate the named-switch table after JSON overrides are applied.
    kNamedSwitches[0] = { "KILL_KICK",       KILL_KICK,       "KILL",    "open"     };
    kNamedSwitches[1] = { "KILL_SUB",        KILL_SUB,        "KILL",    "open"     };
    kNamedSwitches[2] = { "KILL_MID",        KILL_MID,        "KILL",    "open"     };
    kNamedSwitches[3] = { "KILL_TOP",        KILL_TOP,        "KILL",    "open"     };
    kNamedSwitches[4] = { "FX_FILTER_MIDS",  FX_FILTER_MIDS,  "mids",    "fullband" };
    kNamedSwitches[5] = { "FX_FILTER_TOPS",  FX_FILTER_TOPS,  "tops",    "fullband" };
    kNamedSwitches[6] = { "FX2_FILTER_MIDS", FX2_FILTER_MIDS, "mids",    "fullband" };
    kNamedSwitches[7] = { "FX2_FILTER_TOPS", FX2_FILTER_TOPS, "tops",    "fullband" };
    kNamedSwitchCount = 8;

    // Snapshot graphic EQ PotRefs once — avoids 12 struct copies every render block.
    const PotRef geqInit[GraphicEq::kNumBands] = {
        GEQ_40HZ, GEQ_60HZ, GEQ_80HZ, GEQ_100HZ, GEQ_125HZ, GEQ_250HZ,
        GEQ_500HZ, GEQ_1KHZ, GEQ_2KHZ, GEQ_4KHZ, GEQ_8KHZ, GEQ_16KHZ
    };
    for(int i = 0; i < GraphicEq::kNumBands; ++i) gGeqPots[i] = geqInit[i];

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
    gSamplePlayer.setup(context->audioSampleRate, context->projectName);

    float sr = context->audioSampleRate;
    gFxHpf4k .setHighPass(kFxMidHighFreq, kFxFilterQ, sr); // FX1 TOPS: HPF @ 4 kHz
    gFxMidHpf.setHighPass(kFxMidLowFreq,  kFxFilterQ, sr); // FX1 MIDS: HPF @ 250 Hz
    gFxMidLpf.setLowPass (kFxMidHighFreq, kFxFilterQ, sr); // FX1 MIDS: LPF @ 4 kHz

    gFx2Hpf4k .setHighPass(kFxMidHighFreq, kFxFilterQ, sr); // FX2 TOPS: HPF @ 4 kHz
    gFx2MidHpf.setHighPass(kFxMidLowFreq,  kFxFilterQ, sr); // FX2 MIDS: HPF @ 250 Hz
    gFx2MidLpf.setLowPass (kFxMidHighFreq, kFxFilterQ, sr); // FX2 MIDS: LPF @ 4 kHz

    // VU meter crossover filters (Butterworth, no resonance)
    gVuSubLpf .setLowPass (kKillFc0, 0.707f, sr); // SUB  < 80 Hz
    gVuKickHpf.setHighPass(kKillFc0, 0.707f, sr); // KICK > 80 Hz
    gVuKickLpf.setLowPass (kKillFc1, 0.707f, sr); // KICK < 200 Hz
    gVuMidHpf .setHighPass(kKillFc1, 0.707f, sr); // MID  > 200 Hz
    gVuMidLpf .setLowPass (kKillFc2, 0.707f, sr); // MID  < 1200 Hz
    gVuTopHpf .setHighPass(kKillFc2, 0.707f, sr); // TOP  > 1200 Hz

    // Mic-mode dry HPF (24 dB/oct) — coeffs from config.json routing.in.*.hpf
    setupMicHpf(0, AUX1_CONFIG, sr);
    setupMicHpf(1, AUX2_CONFIG, sr);
    setupMicHpf(2, AUX3_CONFIG, sr);
    setupMicHpf(3, AUX4_CONFIG, sr);

    // Startup mute ramp: suppress DAC initialisation transient
    gStartupRampTotal     = (int)(sr * kStartupRampMs / 1000.f);
    gStartupRampRemaining = gStartupRampTotal;

    if(!gHardwareManager.initMcp23017())
        return false;

    gI2cTask = Bela_createAuxiliaryTask(readI2cTask, 50, "i2c-reader", nullptr);
    Bela_scheduleAuxiliaryTask(gI2cTask);

    // Low-priority sysfs poll — must stay far below audio / I2C priorities.
    gCpuTempTask = Bela_createAuxiliaryTask(readCpuTempTask, 1, "cpu-temp", nullptr);
    Bela_scheduleAuxiliaryTask(gCpuTempTask);

    // ---- GUI setup --------------------------------------------------------
    // Allocate live send buffers (never resized after this point).
    gPotValuesBuf.assign(kAllNamedPotsCount, 0.f);
    gSwitchBuf.assign(9, 0.f);
    gSirenBuf.assign(3, 0.f);
    gSamplerStateBuf.assign(kGuiSamplerStateSize, 0.f);
    gAudioLevelsBuf.assign(13, 0.f);
    gMuxRawBuf.assign(kGuiMuxRawBufSize, 0.f);
    gCodecGainsBuf.assign(20, 0.f);
    gCpuTempBuf.assign(1, -1.f);

    // Fill static mapping buffers from the (possibly JSON-overridden) globals.
    gPotMappingBuf.resize(kAllNamedPotsCount * 4);
    for(int i = 0; i < kAllNamedPotsCount; ++i) {
        gPotMappingBuf[i*4 + 0] = (float)kAllNamedPots[i].mux;
        gPotMappingBuf[i*4 + 1] = (float)kAllNamedPots[i].pot;
        gPotMappingBuf[i*4 + 2] = kAllNamedPots[i].reversed ? 1.f : 0.f;
        gPotMappingBuf[i*4 + 3] = kAllNamedPots[i].centered ? 1.f : 0.f;
    }
    gSwitchMappingBuf.resize(9 * 3);
    for(int i = 0; i < 9; ++i) {
        gSwitchMappingBuf[i*3 + 0] = (float)kGuiSwitchRefs[i]->pin;
        gSwitchMappingBuf[i*3 + 1] = kGuiSwitchRefs[i]->portB    ? 1.f : 0.f;
        gSwitchMappingBuf[i*3 + 2] = kGuiSwitchRefs[i]->reversed ? 1.f : 0.f;
    }

    fillConfigMetaBuf();
    fillSamplerNamesBuf();

    gGui.setup(context->projectName);

    // Real-time codec gain + mic-mode control from the GUI.
    // Receives JSON sent by Bela.control.send() on the gui_control WebSocket.
    // Runs on the seasocks thread (non-RT) — safe to call Bela_set*() codec APIs.
    // Mic/HPF mutations only touch ChannelConfig + a pending mask; biquad coeffs
    // are rebuilt at the start of the next render() block (audio thread).
    //
    // Supported messages (all require { event: 'custom' }):
    //   { hpGain: N, channel: C }     — DAC output level for physical ch C, range [-63, 0] dB
    //   { inputGain: N, channel: C }  — ADC PGA gain for physical ch C, range [-12, 10] dB
    //   { auxMic: N, mic: bool }      — AUX N (1–4) mic-mode flag (live, not persisted)
    //   { auxHpf: N, hpf: Hz }        — AUX N (1–4) mic HPF cutoff (0 = off)
    gGui.setControlDataCallback([](JSONObject& root, void*) -> bool {
        if (root.find(L"event") == root.end() ||
            !root[L"event"]->IsString() ||
            root[L"event"]->AsString() != L"custom")
            return true;

        // DAC output gain — any physical output channel (wire key remains hpGain).
        if (root.find(L"hpGain") != root.end() &&
            root[L"hpGain"]->IsNumber() &&
            root.find(L"channel") != root.end() &&
            root[L"channel"]->IsNumber())
        {
            int   ch   = (int)root[L"channel"]->AsNumber();
            float gain = (float)root[L"hpGain"]->AsNumber();
            applyCodecOutputGain(ch, gain);
            if (ch >= 0 && ch < kCodecChannels)
                rt_printf("[GUI] DAC Out ch %d → %.1f dB\n", ch, gCodecGains[10 + ch]);
        }

        // ADC input PGA gain — codec supports [kCodecInputGainMinDb, kCodecInputGainMaxDb].
        if (root.find(L"inputGain") != root.end() &&
            root[L"inputGain"]->IsNumber() &&
            root.find(L"channel") != root.end() &&
            root[L"channel"]->IsNumber())
        {
            int   ch   = (int)root[L"channel"]->AsNumber();
            float gain = (float)root[L"inputGain"]->AsNumber();
            applyCodecInputGain(ch, gain);
            if (ch >= 0 && ch < kCodecChannels)
                rt_printf("[GUI] Input ch %d → %.1f dB\n", ch, gCodecGains[ch]);
        }

        // Live mic-mode toggle for AUX1–4 (1-based index in JSON).
        if (root.find(L"auxMic") != root.end() &&
            root[L"auxMic"]->IsNumber() &&
            root.find(L"mic") != root.end())
        {
            int idx = (int)root[L"auxMic"]->AsNumber() - 1;
            ChannelConfig* cfg = auxConfigByIndex(idx);
            if(cfg) {
                bool mic = false;
                if(root[L"mic"]->IsBool())
                    mic = root[L"mic"]->AsBool();
                else if(root[L"mic"]->IsNumber())
                    mic = root[L"mic"]->AsNumber() > 0.5;
                cfg->micMode = mic;
                gMicHpfPendingMask.fetch_or((uint8_t)(1u << idx));
                refreshMicMetaSlots();
                rt_printf("[GUI] AUX%d mic → %s\n", idx + 1, mic ? "on" : "off");
            }
        }

        // Live mic HPF cutoff (Hz) for AUX1–4 (1-based index in JSON).
        if (root.find(L"auxHpf") != root.end() &&
            root[L"auxHpf"]->IsNumber() &&
            root.find(L"hpf") != root.end() &&
            root[L"hpf"]->IsNumber())
        {
            int idx = (int)root[L"auxHpf"]->AsNumber() - 1;
            ChannelConfig* cfg = auxConfigByIndex(idx);
            if(cfg) {
                float hz = (float)root[L"hpf"]->AsNumber();
                if(hz <= 0.f)
                    hz = 0.f;
                else {
                    if(hz < kMicHpfFMin) hz = kMicHpfFMin;
                    if(hz > kMicHpfFMax) hz = kMicHpfFMax;
                }
                cfg->hpfHz = hz;
                gMicHpfPendingMask.fetch_or((uint8_t)(1u << idx));
                refreshMicMetaSlots();
                rt_printf("[GUI] AUX%d hpf → %.0f Hz\n", idx + 1, hz);
            }
        }

        // Sampler one-shot trigger from the Live Sampler tile (zero-based slot).
        if (root.find(L"samplerPlay") != root.end() &&
            root[L"samplerPlay"]->IsNumber())
        {
            int slot = (int)root[L"samplerPlay"]->AsNumber();
            gSamplePlayer.trigger(slot);
            rt_printf("[GUI] Sampler play slot %d\n", slot);
        }

        return true; // let the default handler process connection-reply etc.
    }, nullptr);
    // -----------------------------------------------------------------------

    return true;
}

void render(BelaContext* context, void* userData) {
    // Apply live mic/HPF changes queued by the gui_control callback (non-RT).
    {
        uint8_t pending = gMicHpfPendingMask.exchange(0);
        if(pending) {
            const float sr = context->audioSampleRate;
            for(int i = 0; i < 4; ++i) {
                if(pending & (uint8_t)(1u << i)) {
                    ChannelConfig* cfg = auxConfigByIndex(i);
                    if(cfg) setupMicHpf(i, *cfg, sr);
                }
            }
        }
    }

    gHardwareManager.scanStep(context);

    // --- Channel Strip 1 controls ---
    gChannelStrip.setInputGain(gHardwareManager.getPotValue(AUX1_INPUT_GAIN));
    gChannelStrip.setEqGains(
        potToGainDb(gHardwareManager.getPotValue(AUX1_EQ_LOW)),
        potToGainDb(gHardwareManager.getPotValue(AUX1_EQ_MID)),
        potToGainDb(gHardwareManager.getPotValue(AUX1_EQ_HIGH))
    );
    gChannelStrip.setFxSend1Level(scaleFxSendPot(gHardwareManager.getPotValue(AUX1_FX_SEND)));
    gChannelStrip.setFxSend2Level(scaleFxSendPot(gHardwareManager.getPotValue(AUX1_FX2_SEND)));

    // --- Channel Strip 2 controls ---
    gChannelStrip2.setInputGain(gHardwareManager.getPotValue(AUX2_INPUT_GAIN));
    gChannelStrip2.setEqGains(
        potToGainDb(gHardwareManager.getPotValue(AUX2_EQ_LOW)),
        potToGainDb(gHardwareManager.getPotValue(AUX2_EQ_MID)),
        potToGainDb(gHardwareManager.getPotValue(AUX2_EQ_HIGH))
    );
    gChannelStrip2.setFxSend1Level(scaleFxSendPot(gHardwareManager.getPotValue(AUX2_FX_SEND)));
    gChannelStrip2.setFxSend2Level(scaleFxSendPot(gHardwareManager.getPotValue(AUX2_FX2_SEND)));

    // --- AUX 3 controls ---
    gChannelStrip3.setInputGain(gHardwareManager.getPotValue(AUX3_INPUT_GAIN));
    gChannelStrip3.setEqGains(
        potToGainDb(gHardwareManager.getPotValue(AUX3_EQ_LOW)),
        potToGainDb(gHardwareManager.getPotValue(AUX3_EQ_MID)),
        potToGainDb(gHardwareManager.getPotValue(AUX3_EQ_HIGH))
    );
    gChannelStrip3.setFxSend1Level(scaleFxSendPot(gHardwareManager.getPotValue(AUX3_FX_SEND)));
    gChannelStrip3.setFxSend2Level(scaleFxSendPot(gHardwareManager.getPotValue(AUX3_FX2_SEND)));

    // --- AUX 4 controls ---
    gChannelStrip4.setInputGain(gHardwareManager.getPotValue(AUX4_INPUT_GAIN));
    gChannelStrip4.setEqGains(
        potToGainDb(gHardwareManager.getPotValue(AUX4_EQ_LOW)),
        potToGainDb(gHardwareManager.getPotValue(AUX4_EQ_MID)),
        potToGainDb(gHardwareManager.getPotValue(AUX4_EQ_HIGH))
    );
    gChannelStrip4.setFxSend1Level(scaleFxSendPot(gHardwareManager.getPotValue(AUX4_FX_SEND)));
    gChannelStrip4.setFxSend2Level(scaleFxSendPot(gHardwareManager.getPotValue(AUX4_FX2_SEND)));

    // --- Master parametric EQ ---
    gMasterFx.setParamEqBand(ParametricEq::SUB,
        gHardwareManager.getPotValue(MASTER_EQ_SUB_FREQ),
        potToGainDb(gHardwareManager.getPotValue(MASTER_EQ_SUB_GAIN), kMasterEqGainRangeDb)
    );
    gMasterFx.setParamEqBand(ParametricEq::KICK,
        gHardwareManager.getPotValue(MASTER_EQ_KICK_FREQ),
        potToGainDb(gHardwareManager.getPotValue(MASTER_EQ_KICK_GAIN), kMasterEqGainRangeDb)
    );
    gMasterFx.setParamEqBand(ParametricEq::MID,
        gHardwareManager.getPotValue(MASTER_EQ_MID_FREQ),
        potToGainDb(gHardwareManager.getPotValue(MASTER_EQ_MID_GAIN), kMasterEqGainRangeDb)
    );
    gMasterFx.setParamEqBand(ParametricEq::TOP,
        gHardwareManager.getPotValue(MASTER_EQ_TOP_FREQ),
        potToGainDb(gHardwareManager.getPotValue(MASTER_EQ_TOP_GAIN), kMasterEqGainRangeDb)
    );

    // --- Master graphic EQ — 12 bands (centered=true in each PotRef → snap at 0.5) ---
    for(int i = 0; i < GraphicEq::kNumBands; ++i)
        gMasterFx.setGraphicEqBand(i, potToGainDb(gHardwareManager.getPotValue(gGeqPots[i]), kGEqGainRangeDb));

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
    const bool killSub  = gHardwareManager.getSwitchState(KILL_SUB);
    const bool killKick = gHardwareManager.getSwitchState(KILL_KICK);
    const bool killMid  = gHardwareManager.getSwitchState(KILL_MID);
    const bool killTop  = gHardwareManager.getSwitchState(KILL_TOP);
    gMasterFx.setKills(killSub, killKick, killMid, killTop);

    // --- Band Trim (SUB / KICK / MID / TOP) ---
    gMasterFx.setBandTrim(BandTrim::SUB,  potToGainDb(gHardwareManager.getPotValue(BTRIM_SUB),  kBandTrimGainDb));
    gMasterFx.setBandTrim(BandTrim::KICK, potToGainDb(gHardwareManager.getPotValue(BTRIM_KICK), kBandTrimGainDb));
    gMasterFx.setBandTrim(BandTrim::MID,  potToGainDb(gHardwareManager.getPotValue(BTRIM_MID),  kBandTrimGainDb));
    gMasterFx.setBandTrim(BandTrim::TOP,  potToGainDb(gHardwareManager.getPotValue(BTRIM_TOP),  kBandTrimGainDb));

    // --- Master output gain ---
    gMasterFx.setMasterGain(gHardwareManager.getPotValue(MASTER_GAIN));

    // --- FX send 1 filter mode (PA5 = MIDS, PA6 = TOPS) ---
    const bool fxModeMids = gHardwareManager.getSwitchState(FX_FILTER_MIDS);
    const bool fxModeTops = gHardwareManager.getSwitchState(FX_FILTER_TOPS);

    static bool prevFxMids = false;
    static bool prevFxTops = false;
    if(fxModeMids != prevFxMids || fxModeTops != prevFxTops) {
        gFxHpf4k .reset();
        gFxMidHpf.reset();
        gFxMidLpf.reset();
        prevFxMids = fxModeMids;
        prevFxTops = fxModeTops;
        const char* mode = fxModeTops ? "TOPS (>4kHz)"
                         : fxModeMids ? "MIDS (250Hz-4kHz)"
                                      : "MID+TOP (>250Hz)";
        rt_printf("[FX1] Send mode  →  %s\n", mode);
    }

    // --- FX send 2 filter mode (PA4 = MIDS, PA7 = TOPS) ---
    const bool fx2ModeMids = gHardwareManager.getSwitchState(FX2_FILTER_MIDS);
    const bool fx2ModeTops = gHardwareManager.getSwitchState(FX2_FILTER_TOPS);

    static bool prevFx2Mids = false;
    static bool prevFx2Tops = false;
    if(fx2ModeMids != prevFx2Mids || fx2ModeTops != prevFx2Tops) {
        gFx2Hpf4k .reset();
        gFx2MidHpf.reset();
        gFx2MidLpf.reset();
        prevFx2Mids = fx2ModeMids;
        prevFx2Tops = fx2ModeTops;
        const char* mode = fx2ModeTops ? "TOPS (>4kHz)"
                         : fx2ModeMids ? "MIDS (250Hz-4kHz)"
                                       : "MID+TOP (>250Hz)";
        rt_printf("[FX2] Send mode  →  %s\n", mode);
    }

    // --- Dub siren controls ---
    const float sirenGain    = gHardwareManager.getPotValue(SIREN_GAIN);
    const float sirenFxSend  = scaleFxSendPot(gHardwareManager.getPotValue(SIREN_FX_SEND));
    const float sirenFxSend2 = scaleFxSendPot(gHardwareManager.getPotValue(SIREN_FX2_SEND));

    gDubSiren.setControls(
        gHardwareManager.getPotValue(SIREN_TYPE),
        gHardwareManager.getPotValue(SIREN_MOD),
        sirenGain,
        sirenFxSend,
        sirenFxSend2,
        gHardwareManager.getSwitchState(SIREN_TRIGGER)
    );
    // Sampler shares siren gain / FX sends; trigger comes from the GUI only.
    gSamplePlayer.setControls(sirenGain, sirenFxSend, sirenFxSend2);

    // --- FX return input gains (0 = mute, 1 = unity) ---
    const float fx1ReturnGain = gHardwareManager.getPotValue(FX1_RETURN_GAIN);
    const float fx2ReturnGain = gHardwareManager.getPotValue(FX2_RETURN_GAIN);

    // Mic-mode flags are config-time only — compute once per block.
    const bool anyMic = AUX1_CONFIG.micMode || AUX2_CONFIG.micMode
                     || AUX3_CONFIG.micMode || AUX4_CONFIG.micMode;

    // --- Sample loop ---
    bool clipCh0 = false;
    bool clipCh1 = false;

    for(unsigned int n = 0; n < context->audioFrames; n++) {
        float in0 = readChannelInput(context, n, AUX1_CONFIG);
        float in1 = readChannelInput(context, n, AUX2_CONFIG);

        if(fabsf(in0) >= kClipThreshold) clipCh0 = true;
        if(fabsf(in1) >= kClipThreshold) clipCh1 = true;

        float in2  = readChannelInput(context, n, AUX3_CONFIG);
        float in3  = readChannelInput(context, n, AUX4_CONFIG);
        float dry1 = applyMicHpf(0, gChannelStrip.process(in0));
        float dry2 = applyMicHpf(1, gChannelStrip2.process(in1));
        float dry3 = applyMicHpf(2, gChannelStrip3.process(in2));
        float dry4 = applyMicHpf(3, gChannelStrip4.process(in3));

        // Siren + sampler: process before FX send to include their FX outputs
        float sirenOut   = gDubSiren.process();
        float samplerOut = gSamplePlayer.process();

       // FX send 1: all channel strips + siren + sampler → filtered by mode → OUT2
       float fxSend = gChannelStrip.fxOut()  + gChannelStrip2.fxOut()
                    + gChannelStrip3.fxOut() + gChannelStrip4.fxOut()
                    + gDubSiren.fxOut() + gSamplePlayer.fxOut();
        if(fxModeTops)
            fxSend = gFxHpf4k.process(fxSend);                           // > 4 kHz only
        else if(fxModeMids)
            fxSend = gFxMidLpf.process(gFxMidHpf.process(fxSend));      // 250 Hz – 4 kHz
        else
            fxSend = gFxMidHpf.process(fxSend);                          // > 250 Hz (MID+TOP)

        // FX send 2: all channel strips + siren/sampler fx2 → filtered by mode → OUT3
        float fxSend2 = gChannelStrip.fxOut2()  + gChannelStrip2.fxOut2()
                      + gChannelStrip3.fxOut2() + gChannelStrip4.fxOut2()
                      + gDubSiren.fxOut2() + gSamplePlayer.fxOut2();
        if(fx2ModeTops)
            fxSend2 = gFx2Hpf4k.process(fxSend2);                        // > 4 kHz only
        else if(fx2ModeMids)
            fxSend2 = gFx2MidLpf.process(gFx2MidHpf.process(fxSend2));  // 250 Hz – 4 kHz
        else
            fxSend2 = gFx2MidHpf.process(fxSend2);                       // > 250 Hz (MID+TOP)

        // FX returns: gain-trimmed (MUX0 CH00/CH15) then noise-gated to suppress idle hum
        float fxReturn  = gMasterFx.processFxReturn (audioRead(context, n, FX1_RETURN_IN) * fx1ReturnGain);
        float fxReturn2 = gMasterFx.processFxReturn2(audioRead(context, n, FX2_RETURN_IN) * fx2ReturnGain);

        // Master bus mix — routing controlled by kFxReturnPostMaster (SoftwareConfig.h).
        // POST (true) : FX returns bypass all master DSP; only masterGain applies.
        // PRE  (false): FX returns enter the full chain (EQ → filters → kills).
        // Mic-mode AUX dry is summed separately and processed via processMicPath()
        // (bypasses ParamEq / HPF-LPF / kills; still gets GEQ + BandTrim + gain).
        float dryNormal = 0.f;
        float dryMic    = 0.f;
        if(AUX1_CONFIG.micMode) dryMic    += dry1; else dryNormal += dry1;
        if(AUX2_CONFIG.micMode) dryMic    += dry2; else dryNormal += dry2;
        if(AUX3_CONFIG.micMode) dryMic    += dry3; else dryNormal += dry3;
        if(AUX4_CONFIG.micMode) dryMic    += dry4; else dryNormal += dry4;
        dryNormal += sirenOut + samplerOut;

        float out;
        if(kFxReturnPostMaster) {
            out = gMasterFx.process(dryNormal);
            if(anyMic)
                out += gMasterFx.processMicPath(dryMic);
            out += (fxReturn + fxReturn2) * gMasterFx.getMasterGain();
        } else {
            // PRE: FX returns join the normal (non-mic) path through the full chain.
            out = gMasterFx.process(dryNormal + fxReturn + fxReturn2);
            if(anyMic)
                out += gMasterFx.processMicPath(dryMic);
        }

        out = gMasterFx.limitOutput(out);

        // Startup mute ramp: linear fade 0→1 over kStartupRampMs to suppress DAC pop
        float startupGain = 1.f;
        if(gStartupRampRemaining > 0) {
            startupGain = 1.f - (float)gStartupRampRemaining / (float)gStartupRampTotal;
            --gStartupRampRemaining;
        }

        scope.log(dry1 + dry2 + fxReturn, out);
        audioWrite(context, n, FX1_SEND_OUT, fxSend  * startupGain);
        audioWrite(context, n, FX2_SEND_OUT, fxSend2 * startupGain);
        for(int i = 0; i < MASTER_OUTS_COUNT; ++i)
            audioWrite(context, n, MASTER_OUTS[i], out * startupGain);

        // VU meters — band-split the actual master out (kills already applied
        // on the normal path; mic-mode energy remains visible when present).
        float vuSub  = gVuSubLpf.process(out);
        float vuKick = gVuKickLpf.process(gVuKickHpf.process(out));
        float vuMid  = gVuMidLpf .process(gVuMidHpf .process(out));
        float vuTop  = gVuTopHpf.process(out);
        audioWrite(context, n, VU_SUB_OUT,  vuSub  * startupGain);
        audioWrite(context, n, VU_KICK_OUT, vuKick * startupGain);
        audioWrite(context, n, VU_MID_OUT,  vuMid  * startupGain);
        audioWrite(context, n, VU_TOP_OUT,  vuTop  * startupGain);

        // GUI peak tracking — one max(|x|) per channel per update interval.
        // Uses pre-gain values so the meters reflect true DSP levels.
        #define GUI_PEAK(i, x) { float _a = fabsf(x); if(_a > gAudioPeaks[i]) gAudioPeaks[i] = _a; }
        GUI_PEAK(0,  in0)
        GUI_PEAK(1,  in1)
        GUI_PEAK(2,  in2)
        GUI_PEAK(3,  in3)
        GUI_PEAK(4,  fxReturn)
        GUI_PEAK(5,  fxReturn2)
        GUI_PEAK(6,  out)
        GUI_PEAK(7,  fxSend)
        GUI_PEAK(8,  fxSend2)
        GUI_PEAK(9,  vuSub)
        GUI_PEAK(10, vuKick)
        GUI_PEAK(11, vuMid)
        GUI_PEAK(12, vuTop)
        #undef GUI_PEAK
    }

    // --- Clip warnings (rate-limited) ---
    ++gClipWarnCounter;
    if((clipCh0 || clipCh1) && gClipWarnCounter >= kClipWarnIntervalBlocks) {
        if(clipCh0) rt_printf("WARNING Canal 0 clipping\n");
        if(clipCh1) rt_printf("WARNING Canal 1 clipping\n");
        gClipWarnCounter = 0;
    }

    // --- GUI update (~20 fps) — count samples, not render blocks ---
    gGuiUpdateSampleCount += (int)context->audioFrames;
    if(gGuiUpdateSampleCount >= kGuiUpdateIntervalSamples) {
        gGuiUpdateSampleCount -= kGuiUpdateIntervalSamples;

        // Buffer 0: all pot values in kAllNamedPots order
        for(int i = 0; i < kAllNamedPotsCount; ++i)
            gPotValuesBuf[i] = gHardwareManager.getPotValue(kAllNamedPots[i]);
        gGui.sendBuffer(0, gPotValuesBuf);

        // Buffer 1: switch states
        gSwitchBuf[0] = gHardwareManager.getSwitchState(KILL_SUB)        ? 1.f : 0.f;
        gSwitchBuf[1] = gHardwareManager.getSwitchState(KILL_KICK)       ? 1.f : 0.f;
        gSwitchBuf[2] = gHardwareManager.getSwitchState(KILL_MID)        ? 1.f : 0.f;
        gSwitchBuf[3] = gHardwareManager.getSwitchState(KILL_TOP)        ? 1.f : 0.f;
        gSwitchBuf[4] = gHardwareManager.getSwitchState(FX_FILTER_MIDS)  ? 1.f : 0.f;
        gSwitchBuf[5] = gHardwareManager.getSwitchState(FX_FILTER_TOPS)  ? 1.f : 0.f;
        gSwitchBuf[6] = gHardwareManager.getSwitchState(FX2_FILTER_TOPS) ? 1.f : 0.f;
        gSwitchBuf[7] = gHardwareManager.getSwitchState(FX2_FILTER_MIDS) ? 1.f : 0.f;
        gSwitchBuf[8] = gHardwareManager.getSwitchState(SIREN_TRIGGER)   ? 1.f : 0.f;
        gGui.sendBuffer(1, gSwitchBuf);

        // Buffer 2: siren state [presetIdx, gate, mod]
        float sirenTypePot = gHardwareManager.getPotValue(SIREN_TYPE);
        gSirenBuf[0] = floorf(sirenTypePot * (float)DubSiren::kNumPresets);
        if(gSirenBuf[0] >= (float)DubSiren::kNumPresets)
            gSirenBuf[0] = (float)(DubSiren::kNumPresets - 1);
        gSirenBuf[1] = gHardwareManager.getSwitchState(SIREN_TRIGGER) ? 1.f : 0.f;
        gSirenBuf[2] = gHardwareManager.getPotValue(SIREN_MOD);
        gGui.sendBuffer(2, gSirenBuf);

        // Buffer 10: sampler state [folderOk, count, playingSlot, isPlaying, playhead]
        gSamplerStateBuf[0] = gSamplePlayer.folderOk() ? 1.f : 0.f;
        gSamplerStateBuf[1] = (float)gSamplePlayer.sampleCount();
        gSamplerStateBuf[2] = (float)gSamplePlayer.playingSlot();
        gSamplerStateBuf[3] = gSamplePlayer.isPlaying() ? 1.f : 0.f;
        gSamplerStateBuf[4] = gSamplePlayer.playhead();
        gGui.sendBuffer(10, gSamplerStateBuf);

        // Buffer 3: audio peak levels — copy accumulators, then reset
        for(int i = 0; i < 13; ++i) {
            gAudioLevelsBuf[i] = gAudioPeaks[i];
            gAudioPeaks[i]     = 0.f;
        }
        gGui.sendBuffer(3, gAudioLevelsBuf);

        // Buffer 7: raw MUX grid (unmapped pot discovery in GUI)
        for(int m = 0; m < kActiveMux; ++m)
            for(int p = 0; p < kPotsPerMux; ++p)
                gMuxRawBuf[m * kPotsPerMux + p] = gHardwareManager.getPotValue(m, p);
        gGui.sendBuffer(7, gMuxRawBuf);

        // Buffer 8: codec gain state — synchronises all connected GUI clients.
        // Layout: [0..9] ADC input gain by physical ch, [10..19] DAC output gain by physical ch.
        for(int i = 0; i < 20; ++i) gCodecGainsBuf[i] = gCodecGains[i];
        gGui.sendBuffer(8, gCodecGainsBuf);

        // Buffer 9: CPU temperature °C (updated ~every 2 s by AuxTask; one float).
        gCpuTempBuf[0] = gCpuTempC;
        gGui.sendBuffer(9, gCpuTempBuf);

        // Buffers 4+5+6+11: mapping + config + sample names — resend for (re)connects.
        // First tick is forced (gGuiStaticSendCount starts at the divisor).
        if(++gGuiStaticSendCount >= kGuiStaticBufSendDivisor) {
            gGuiStaticSendCount = 0;
            gGui.sendBuffer(4, gPotMappingBuf);
            gGui.sendBuffer(5, gSwitchMappingBuf);
            gGui.sendBuffer(6, gConfigMetaBuf);
            gGui.sendBuffer(11, gSamplerNamesBuf);
        }
    }

    // --- Debug logging ---
    if(kDebug) {
        printChangedPots();
        printChangedSwitches();

        // Siren trigger: log gate state with the active preset name
        static bool prevSirenTrigger = false;
        bool sirenTrigger = gHardwareManager.getSwitchState(SIREN_TRIGGER);
        if(sirenTrigger != prevSirenTrigger) {
            if(sirenTrigger)
                rt_printf("[SW]  SIREN_TRIGGER      →  ON  [%s]\n", gDubSiren.getPresetName());
            else
                rt_printf("[SW]  SIREN_TRIGGER      →  off\n");
            prevSirenTrigger = sirenTrigger;
        }
    }
}

void cleanup(BelaContext* context, void* userData) {
    gHardwareManager.closeMcp23017();
    gGui.cleanup();
}
