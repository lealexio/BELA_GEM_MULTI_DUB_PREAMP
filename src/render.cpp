/*
 ____  _____ _        _
| __ )| ____| |      / \
|  _ \|  _| | |     / _ \
| |_) | |___| |___ / ___ \
|____/|_____|_____/_/   \_\
https://bela.io
*/

#include "ChannelStrip.h"
#include "ConfigLoader.h"
#include "DigitalFxManager.h"
#include "DspUtils.h"
#include "DubSiren.h"
#include "HardwareConfig.h"
#include "HardwareManager.h"
#include "MasterFx.h"
#include "SamplePlayer.h"
#include "SoftwareConfig.h"
#include <Bela.h>
#include <algorithm>
#include <atomic>
#include <cerrno>
#include <cmath>
#include <csignal>
#include <cstdio>
#include <cstring>
#include <libraries/Gui/Gui.h>
#include <libraries/Scope/Scope.h>
#include <string>
#include <sys/types.h>
#include <sys/wait.h>
#include <unistd.h>
#include <vector>

HardwareManager gHardwareManager;

// 4 auxiliary channels, each with a Left/Mono (0) and Right (1) strip.
ChannelStrip gChannelStrips[kNumAuxChannels][2];

MasterFx gMasterFx;  // left / mono master bus
MasterFx gMasterFxR; // right master bus (used only when MASTER_OUTS_COUNT >= 2)
MasterFx *const gMasterBuses[2] = {&gMasterFx, &gMasterFxR};

DigitalFxManager gDigitalFxManager; // multi-effects digital engine (SUB ROAR & ECHO DUB)

struct AuxPotBinding {
  const PotRef &gain;
  const PotRef &eqLow;
  const PotRef &eqMid;
  const PotRef &eqHigh;
  const PotRef &fx1;
  const PotRef &fx2;
};

static const AuxPotBinding kAuxPotBindings[kNumAuxChannels] = {
    {AUX1_INPUT_GAIN, AUX1_EQ_LOW, AUX1_EQ_MID, AUX1_EQ_HIGH, AUX1_FX_SEND,
     AUX1_FX2_SEND},
    {AUX2_INPUT_GAIN, AUX2_EQ_LOW, AUX2_EQ_MID, AUX2_EQ_HIGH, AUX2_FX_SEND,
     AUX2_FX2_SEND},
    {AUX3_INPUT_GAIN, AUX3_EQ_LOW, AUX3_EQ_MID, AUX3_EQ_HIGH, AUX3_FX_SEND,
     AUX3_FX2_SEND},
    {AUX4_INPUT_GAIN, AUX4_EQ_LOW, AUX4_EQ_MID, AUX4_EQ_HIGH, AUX4_FX_SEND,
     AUX4_FX2_SEND},
};

static ChannelConfig *const kAuxConfigs[kNumAuxChannels] = {
    &AUX1_CONFIG, &AUX2_CONFIG, &AUX3_CONFIG, &AUX4_CONFIG};
DubSiren gDubSiren;
SamplePlayer gSamplePlayer;
AuxiliaryTask gI2cTask;
AuxiliaryTask gCpuTempTask;
AuxiliaryTask gSampleReloadTask;

// Channel Mute / Solo, GUI Kill Overrides, & Master Bus DSP controls (atomic)
static std::atomic<bool>    gAuxMute[kNumAuxChannels];
static std::atomic<bool>    gAuxSolo[kNumAuxChannels];
static std::atomic<uint8_t> gGuiKillsMask{0};
static std::atomic<bool>    gGuiSirenGate{false};

static std::atomic<float> gMasterWarmth{kMasterWarmthDefaultDrive};
static std::atomic<bool>  gBassMonoEnabled{kBassMonoEnabledDefault};
static std::atomic<float> gBassMonoFreqHz{kBassMonoFreqDefaultHz};
static std::atomic<float> gStereoWidth{kStereoWidthDefault};
static std::atomic<float> gMasterDynamics{kMasterDynamicsDefault};

static BiquadFilter gBassMonoHpf;
static float gLastBassMonoFreqHz = -1.f;
static float gSmoothStereoWidth  = kStereoWidthDefault;
static float gSmoothBassMonoMix  = kBassMonoEnabledDefault ? 1.f : 0.f;
static float gMasterBusSlewCoeff = 0.f;
static float gMonoWarmthSmooth   = kMasterWarmthDefaultDrive;
static float gMonoWarmthCoeff    = 0.f;

// FX send 1 band filters (PA5 = MIDS, PA6 = TOPS)
BiquadFilter gFxHpf4k;  // TOPS mode : HPF at kFxMidHighFreq
BiquadFilter gFxMidHpf; // MIDS mode : HPF at kFxMidLowFreq
BiquadFilter gFxMidLpf; // MIDS mode : LPF at kFxMidHighFreq

// FX send 2 band filters (PA4 = MIDS, PA7 = TOPS)
BiquadFilter gFx2Hpf4k;  // TOPS mode : HPF at kFxMidHighFreq
BiquadFilter gFx2MidHpf; // MIDS mode : HPF at kFxMidLowFreq
BiquadFilter gFx2MidLpf; // MIDS mode : LPF at kFxMidHighFreq

// VU meter band-split filters (post-MasterFx, one biquad per crossover edge).
BiquadFilter gVuSubLpf;  // SUB  : LPF  @ kKillFc0 (80 Hz)
BiquadFilter gVuKickHpf; // KICK : HPF  @ kKillFc0 (80 Hz)
BiquadFilter gVuKickLpf; // KICK : LPF  @ kKillFc1 (200 Hz)
BiquadFilter gVuMidHpf;  // MID  : HPF  @ kKillFc1 (200 Hz)
BiquadFilter gVuMidLpf;  // MID  : LPF  @ kKillFc2 (1200 Hz)
BiquadFilter gVuTopHpf;  // TOP  : HPF  @ kKillFc2 (1200 Hz)

// Mic-mode dry HPF: 24 dB/oct (kMicHpfStages × Butterworth) per AUX.
// Separate L and R instances so both can run in the same sample iteration.
BiquadFilter gMicHpf[kNumAuxChannels][kMicHpfStages];  // left bus
BiquadFilter gMicHpfR[kNumAuxChannels][kMicHpfStages]; // right bus
bool gMicHpfActive[kNumAuxChannels] = {false, false, false, false};
/// Bits 0–3 set by gui_control callback; consumed at start of render() to
/// rebuild coeffs.
static std::atomic<uint8_t> gMicHpfPendingMask{0};
static std::atomic<bool> gMasterStereo{true};

// Dedicated brickwall limiter for mono fold-down master output.
static BrickwallLimiter gMonoLimiter;
// Mono high-shelf air compensation filter to counteract comb-filtering loss.
static BiquadFilter gMonoAirFilter;
// Smooth crossfade state between Stereo (1.f) and Mono (0.f).
static float gStereoMonoMix = 1.f;
static float gStereoMonoSlewCoeff = 0.f;

// Direct FX Send Trigger state (driven from GUI FX tab, works in Physical & Dev mode).
static std::atomic<bool> gFxSendTrigger[DigitalFxManager::kNumSendSources][2];
static std::atomic<bool> gFxTestToneEnabled{false};
static std::atomic<bool> gSirenFxTrigger{false};
static float gFxTestTonePhase = 0.f;
static float gFxTestToneEnv[kNumAuxChannels][2] = {};
static float gFxTestAttackCoeff = 0.f;
static float gFxTestReleaseCoeff = 0.f;

Scope scope;

// ---------------------------------------------------------------------------
// Bela GUI — data bridge between render() and the browser UI (sketch.js)
// ---------------------------------------------------------------------------

Gui gGui;

// Pre-allocated send buffers (sized in setup, written in render, never
// resized).
static std::vector<float> gPotValuesBuf; // [kAllNamedPotsCount]
static std::vector<float> gSwitchBuf;    // [9]
static std::vector<float> gSirenBuf;     // [3] presetIdx / gate / mod
static std::vector<float>
    gSamplerStateBuf; // [5] folderOk / count / slot / playing / playhead
static std::vector<float>
    gSamplerNamesBuf; // [kGuiSamplerNamesSize] packed ASCII names
static std::vector<float> gAudioLevelsBuf; // [13] peak levels
static std::vector<float>
    gPotMappingBuf; // [kAllNamedPotsCount×4] pot mapping for GUI
static std::vector<float> gSwitchMappingBuf; // [9×3] switch mapping for GUI
static std::vector<float>
    gConfigMetaBuf; // [kGuiConfigMetaSize] mux/routing/ignoredPots
static std::vector<float>
    gMuxRawBuf; // [kGuiMuxRawBufSize] raw pot values per MUX channel
static std::vector<float>
    gFxStateBuf; // [kGuiFxStateBufSize=12] digital FX peaks [0..3] and routing destinations [4..11]

// Codec gain state — written at boot from config.json and by the gui_control
// callback (seasocks thread). Broadcast to every connected GUI client via
// buffer 8 at ~20 fps.
// Layout: [0..9] = ADC input gain by physical channel (dB),
//         [10..19] = DAC output gain by physical channel (dB).
static float gCodecGains[20] = {};
static std::vector<float> gCodecGainsBuf; // [20]

/** Applies ADC input PGA gain for one physical channel and mirrors into
 * gCodecGains. */
static void applyCodecInputGain(int ch, float gainDb) {
  if (ch < 0 || ch >= kCodecChannels)
    return;
  float gain =
      std::max(kCodecInputGainMinDb, std::min(kCodecInputGainMaxDb, gainDb));
  Bela_setAudioInputGain(ch, gain);
  gCodecGains[ch] = gain;
}

/** Applies DAC output level for one physical channel and mirrors into
 * gCodecGains. */
static void applyCodecOutputGain(int ch, float gainDb) {
  if (ch < 0 || ch >= kCodecChannels)
    return;
  float gain =
      std::max(kCodecOutputGainMinDb, std::min(kCodecOutputGainMaxDb, gainDb));
  Bela_setHpLevel(ch, gain);
  gCodecGains[10 + ch] = gain;
}

/** Loads config.json codec defaults into the hardware codec and gCodecGains[].
 */
static void applyCodecGainsFromConfig() {
  for (int ch = 0; ch < kCodecChannels; ++ch) {
    applyCodecInputGain(ch, CODEC_INPUT_GAIN_DB[ch]);
    applyCodecOutputGain(ch, CODEC_OUTPUT_GAIN_DB[ch]);
  }
  rt_printf("[Config] Codec gains applied from config.json (ADC + DAC)\n");
}

// CPU temperature (°C) — written by the non-RT AuxTask, read in render for GUI.
// Negative means "not yet read / unavailable".
// std::atomic<float> gives correct cross-thread visibility without volatile's
// non-standard memory-model semantics.
static std::atomic<float> gCpuTempC{-1.f};
static std::vector<float> gCpuTempBuf; // [1] buffer 9

// Per-block peak accumulators — one entry per tracked audio channel.
// Index map: 0-3 = in0-in3 | 4-5 = fxRet1-2 | 6 = master out
//            7-8 = fxSend1-2 | 9-12 = vuSub/Kick/Mid/Top
static float gAudioPeaks[13] = {};

static int gGuiUpdateSampleCount =
    0; // accumulates context->audioFrames per block
static int gGuiStaticSendCount =
    kGuiStaticBufSendDivisor; // force static send on first tick
static std::atomic<bool> gForceStaticMetaSend{false};

// Path built in setup() from context->projectName — never hardcoded.
static char kGuiConfigPath[256] = {};
static char kGuiProjectName[128] = {};
static std::atomic<bool> gRestartOrRebootPending{false};

// Switch globals in the same order as the JS SWITCH_NAMES array.
static SwitchRef *const kGuiSwitchRefs[9] = {
    &KILL_SUB,        &KILL_KICK,       &KILL_MID,
    &KILL_TOP,        &FX_FILTER_MIDS,  &FX_FILTER_TOPS,
    &FX2_FILTER_TOPS, &FX2_FILTER_MIDS, &SIREN_TRIGGER};

/** Packs sample filenames into gSamplerNamesBuf as fixed-width ASCII floats
 * (buffer 11). Zero allocations — safe if called on RT thread after bank swap. */
static void fillSamplerNamesBuf() {
  std::fill(gSamplerNamesBuf.begin(), gSamplerNamesBuf.end(), 0.f);
  const int count = gSamplePlayer.sampleCount();
  for (int i = 0; i < count && i < kMaxSamples; ++i) {
    const char *name = gSamplePlayer.sampleName(i);
    const int base = i * kMaxSampleNameLen;
    for (int c = 0; c < kMaxSampleNameLen; ++c) {
      char ch = name[c];
      gSamplerNamesBuf[base + c] = (float)(unsigned char)ch;
      if (ch == '\0')
        break;
    }
  }
}

/** Encodes one ClipLedRef into an exact integer float (-1 = disabled). */
static float encodeClipLedMeta(const ClipLedRef &ref) {
  if (!ref.enabled || ref.pin < 0 || ref.pin > 7)
    return -1.f;
  return (float)((ref.portB ? 8 : 0) + ref.pin + (ref.activeLow ? 16 : 0));
}

/** Fills gConfigMetaBuf with mux/calibration/routing/ignoredPots/boot/clipLeds
 * (buffer 6 layout). */
static void fillConfigMetaBuf() {
  gConfigMetaBuf.assign(kGuiConfigMetaSize, 0.f);
  gConfigMetaBuf[0] = (float)kActiveMux;
  gConfigMetaBuf[1] = kPotScaleRecovery;
  gConfigMetaBuf[2] = kPotMax;
  gConfigMetaBuf[3] = kPotMin;
  gConfigMetaBuf[4] = (float)kMcpAddress;
  gConfigMetaBuf[5] = (float)MASTER_OUTS_COUNT;
  gConfigMetaBuf[6] = (float)(MASTER_OUTS_COUNT > 0 ? MASTER_OUTS[0] : 0);
  gConfigMetaBuf[7] = (float)(MASTER_OUTS_COUNT > 1 ? MASTER_OUTS[1] : -1);
  gConfigMetaBuf[8] = (float)FX1_SEND_OUT;
  gConfigMetaBuf[9] = (float)FX2_SEND_OUT;
  gConfigMetaBuf[10] = (float)VU_SUB_OUT;
  gConfigMetaBuf[11] = (float)VU_KICK_OUT;
  gConfigMetaBuf[12] = (float)VU_MID_OUT;
  gConfigMetaBuf[13] = (float)VU_TOP_OUT;
  gConfigMetaBuf[14] = (float)FX1_RETURN_IN;
  gConfigMetaBuf[15] = (float)FX2_RETURN_IN;
  // AUX channel routing & settings (L, mic, HPF, R)
  for (int i = 0; i < kNumAuxChannels; ++i) {
    gConfigMetaBuf[16 + i] = (float)kAuxConfigs[i]->audioIns[0];
    gConfigMetaBuf[20 + i] = kAuxConfigs[i]->micMode ? 1.f : 0.f;
    gConfigMetaBuf[24 + i] = kAuxConfigs[i]->hpfHz;
    gConfigMetaBuf[28 + i] = (float)kAuxConfigs[i]->audioIns[1];
  }
  // Master stereo mode (1 = stereo, 0 = mono L+R)
  gConfigMetaBuf[32] = gMasterStereo.load() ? 1.f : 0.f;
  // UI Control (Dev) mode (1 = active, 0 = hardware)
  gConfigMetaBuf[33] = gHardwareManager.isUiControlMode() ? 1.f : 0.f;
  // Ignored pots
  gConfigMetaBuf[34] = (float)kIgnoredPotsCount;
  for (int i = 0; i < kIgnoredPotsCount; ++i) {
    gConfigMetaBuf[35 + i * 2 + 0] = (float)kIgnoredPots[i].mux;
    gConfigMetaBuf[35 + i * 2 + 1] = (float)kIgnoredPots[i].pot;
  }
  // Boot developer mode (distinct from live UI_DEV_MODE) & Clip LEDs
  gConfigMetaBuf[kGuiConfigMetaExtraBase] = DEV_MODE ? 1.f : 0.f;
  gConfigMetaBuf[kGuiConfigMetaExtraBase + 1] =
      encodeClipLedMeta(CLIP_LED_MASTER);
  gConfigMetaBuf[kGuiConfigMetaExtraBase + 2] =
      encodeClipLedMeta(CLIP_LED_AUX1);
  gConfigMetaBuf[kGuiConfigMetaExtraBase + 3] =
      encodeClipLedMeta(CLIP_LED_AUX2);
  gConfigMetaBuf[kGuiConfigMetaExtraBase + 4] =
      encodeClipLedMeta(CLIP_LED_AUX3);
  gConfigMetaBuf[kGuiConfigMetaExtraBase + 5] =
      encodeClipLedMeta(CLIP_LED_AUX4);
}

// ---------------------------------------------------------------------------

static unsigned int gClipWarnCounter = 0;
static int gStartupDelayRemaining = 0;
static int gStartupRampRemaining = 0;
static int gStartupRampTotal = 0;

// Shutdown fade-out state (suppresses pop when stopping via Bela IDE or
// SIGINT/SIGTERM)
static std::atomic<bool> gShutdownSignalReceived{false};
static std::atomic<int> gShutdownSignalCount{0};
static bool gShutdownInProgress = false;
static int gShutdownRampTotal = 0;
static int gShutdownRampRemaining = 0;

static void shutdownSignalHandler(int sig) {
  if (++gShutdownSignalCount > 2) {
    Bela_requestStop();
    return;
  }
  rt_printf("[Audio] Stop signal intercepted! Fading out in %d ms...\n",
            (int)kShutdownRampMs);
  gShutdownSignalReceived.store(true, std::memory_order_relaxed);
}

// Populated in setup() after ConfigLoader::load() — not recomputed every block.
static PotRef gGeqPots[GraphicEq::kNumBands];

// ---------------------------------------------------------------------------
// I2C auxiliary task — reads MCP23017 in a non-RT thread every ~5 ms
// ---------------------------------------------------------------------------

void readI2cTask(void *) {
  const int reconnectTicksMax =
      (int)(kMcpReconnectIntervalMs / kMcpPollIntervalMs);
  int reconnectTicks = 0;
  while (!Bela_stopRequested()) {
    if (gHardwareManager.isMcpConnected()) {
      gHardwareManager.readMcp23017();
      usleep(kMcpPollIntervalUs);
    } else {
      // When MCP is not connected, retry probe periodically without blocking
      // audio
      if (++reconnectTicks >= reconnectTicksMax) {
        reconnectTicks = 0;
        gHardwareManager.initMcp23017(false);
      }
      usleep(kMcpPollIntervalUs);
    }
  }
}

/**
 * Reads SoC die temperature from sysfs (millidegrees → °C).
 * Non-RT only — blocking file I/O must never run in render().
 */
void readCpuTempTask(void *) {
  while (!Bela_stopRequested()) {
    FILE *f = fopen(kCpuTempSysfsPath, "r");
    if (f) {
      int milli = 0;
      if (fscanf(f, "%d", &milli) == 1)
        gCpuTempC.store(milli / 1000.f, std::memory_order_relaxed);
      fclose(f);
    }
    usleep(kCpuTempPollUs);
  }
}

/** Reloads samples/ directory into standby bank (non-RT AuxTask). */
void reloadSamplesTask(void *) {
  gSamplePlayer.reloadFromDisk();
}

/** Validates uploaded sample filename (safe basename ending in .wav or .mp3). */
static bool isValidSampleUploadName(const std::string &name) {
  if (name.empty() || name.size() >= (size_t)kMaxSampleNameLen)
    return false;
  if (name.find("..") != std::string::npos ||
      name.find('/') != std::string::npos ||
      name.find('\\') != std::string::npos)
    return false;
  for (unsigned char c : name) {
    bool ok = (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') ||
              (c >= '0' && c <= '9') || c == '_' || c == '-' || c == '.' ||
              c == ' ';
    if (!ok)
      return false;
  }
  if (name.size() < 4)
    return false;
  std::string ext = name.substr(name.size() - 4);
  for (char &ch : ext)
    if (ch >= 'A' && ch <= 'Z')
      ch = (char)(ch - 'A' + 'a');
  return (ext == ".wav" || ext == ".mp3");
}

/** Decodes base64 string into bytes (non-RT only). */
static bool decodeBase64Bytes(const std::string &b64, std::vector<uint8_t> &out) {
  static const int kLookup[256] = {
      -1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,
      -1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,
      -1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,62,-1,-1,-1,63,
      52,53,54,55,56,57,58,59,60,61,-1,-1,-1,-1,-1,-1,
      -1, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9,10,11,12,13,14,
      15,16,17,18,19,20,21,22,23,24,25,-1,-1,-1,-1,-1,
      -1,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40,
      41,42,43,44,45,46,47,48,49,50,51,-1,-1,-1,-1,-1,
      -1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,
      -1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,
      -1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,
      -1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,
      -1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,
      -1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,
      -1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,
      -1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1};
  out.clear();
  out.reserve((b64.size() * 3) / 4);
  int val = 0, valb = -8;
  for (unsigned char c : b64) {
    if (c == '=' || c == ' ' || c == '\r' || c == '\n')
      continue;
    int d = kLookup[c];
    if (d == -1)
      return false;
    val = (val << 6) + d;
    valb += 6;
    if (valb >= 0) {
      out.push_back((uint8_t)((val >> valb) & 0xFF));
      valb -= 8;
    }
  }
  return !out.empty();
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
  return (pot - kPotCenter) * (rangeDb * 2.f);
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
 * Scales a raw input channel gain pot value [0.0, 1.0] to linear gain [0.0,
 * kInputMaxGain].
 */
static inline float scaleInputGainPot(float pot) { return pot * kInputMaxGain; }

/**
 * Scales a raw master gain pot value [0.0, 1.0] to linear gain [0.0,
 * kMasterMaxGain].
 */
static inline float scaleMasterGainPot(float pot) {
  return pot * kMasterMaxGain;
}

/**
 * Scales a raw FX return gain pot value [0.0, 1.0] to linear gain [0.0,
 * kFxReturnMaxGain].
 */
static inline float scaleFxReturnGainPot(float pot) {
  return pot * kFxReturnMaxGain;
}

/**
 * Returns the left (or only) input sample for the given config and frame.
 * audioIns[0] is always the left/mono channel.
 */
static inline float readChannelInputL(BelaContext *ctx, unsigned int frame,
                                      const ChannelConfig &cfg) {
  int ch = cfg.audioIns[0];
  return (ch >= 0 && (unsigned int)ch < ctx->audioInChannels)
             ? audioRead(ctx, frame, ch)
             : 0.f;
}

/**
 * Returns the right input sample for the given config and frame.
 * When audioIns[1] == -1 (mono channel), mirrors the left sample.
 */
static inline float readChannelInputR(BelaContext *ctx, unsigned int frame,
                                      const ChannelConfig &cfg) {
  int ch = (cfg.audioIns[1] != -1) ? cfg.audioIns[1] : cfg.audioIns[0];
  return (ch >= 0 && (unsigned int)ch < ctx->audioInChannels)
             ? audioRead(ctx, frame, ch)
             : 0.f;
}

/**
 * Configures one AUX mic HPF from ChannelConfig (both L and R instances).
 * hpfHz <= 0 or !micMode → inactive bypass.
 * Safe to call from the audio thread (start of render block).
 */
static void setupMicHpf(int idx, const ChannelConfig &cfg, float sampleRate) {
  gMicHpfActive[idx] = false;
  if (!cfg.micMode || cfg.hpfHz <= 0.f)
    return;
  float fc = cfg.hpfHz;
  if (fc < kMicHpfFMin)
    fc = kMicHpfFMin;
  if (fc > kMicHpfFMax)
    fc = kMicHpfFMax;
  for (int s = 0; s < kMicHpfStages; ++s) {
    gMicHpf[idx][s].reset();
    gMicHpfR[idx][s].reset();
    gMicHpf[idx][s].setHighPass(fc, kMicHpfQ, sampleRate);
    gMicHpfR[idx][s].setHighPass(fc, kMicHpfQ, sampleRate);
  }
  gMicHpfActive[idx] = true;
}

/** Returns AUX1–4 config by 0-based index, or nullptr. */
static ChannelConfig *auxConfigByIndex(int idx) {
  if (idx < 0 || idx >= kNumAuxChannels)
    return nullptr;
  return kAuxConfigs[idx];
}

/** Updates buffer-6 mic/hpf slots from current AUX*_CONFIG (multi-client sync).
 */
static void refreshMicMetaSlots() {
  if (gConfigMetaBuf.size() < 28)
    return;
  for (int i = 0; i < kNumAuxChannels; ++i) {
    gConfigMetaBuf[20 + i] = kAuxConfigs[i]->micMode ? 1.f : 0.f;
    gConfigMetaBuf[24 + i] = kAuxConfigs[i]->hpfHz;
  }
}

/** Updates buffer-6 master stereo slot (multi-client sync). */
static void refreshMasterMetaSlot() {
  if (gConfigMetaBuf.size() > 32)
    gConfigMetaBuf[32] = gMasterStereo.load() ? 1.f : 0.f;
}

/** Updates buffer-6 UI Dev mode slot (multi-client sync). */
static void refreshUiDevModeMetaSlot() {
  if (gConfigMetaBuf.size() > 33)
    gConfigMetaBuf[33] = gHardwareManager.isUiControlMode() ? 1.f : 0.f;
}

/** Applies the left mic-path HPF cascade when active; otherwise returns x
 * unchanged. */
static inline float applyMicHpf(int idx, float x) {
  if (!gMicHpfActive[idx])
    return x;
  for (int s = 0; s < kMicHpfStages; ++s)
    x = gMicHpf[idx][s].process(x);
  return x;
}

/** Applies the right mic-path HPF cascade when active; otherwise returns x
 * unchanged. */
static inline float applyMicHpfR(int idx, float x) {
  if (!gMicHpfActive[idx])
    return x;
  for (int s = 0; s < kMicHpfStages; ++s)
    x = gMicHpfR[idx][s].process(x);
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
  for (int i = 0; i < kAllNamedPotsCount; ++i)
    if (kAllNamedPots[i].mux == mux && kAllNamedPots[i].pot == pot)
      return gHardwareManager.getPotValue(kAllNamedPots[i]);
  return gHardwareManager.getPotValue(mux, pot);
}

/** Prints pots that moved since the last call. Silent when nothing changed. */
static void printChangedPots() {
  static float prevValues[kNumMux * kPotsPerMux] = {};
  static bool initialised = false;

  if (!initialised) {
    for (int m = 0; m < kNumMux; m++)
      for (int p = 0; p < kPotsPerMux; p++)
        prevValues[m * kPotsPerMux + p] = logicalPotValue(m, p);
    initialised = true;
    return;
  }

  for (int m = 0; m < kNumMux; m++) {
    for (int p = 0; p < kPotsPerMux; p++) {
      bool ignored = false;
      for (int i = 0; i < kIgnoredPotsCount; i++)
        if (kIgnoredPots[i].mux == m && kIgnoredPots[i].pot == p) {
          ignored = true;
          break;
        }
      if (ignored)
        continue;

      float current = logicalPotValue(m, p);
      float prev = prevValues[m * kPotsPerMux + p];
      if (fabsf(current - prev) >= kDebugPotMinMove) {
        const char *name = getPotName(m, p);
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
 * "active" here means the switch is logically ON (kill engaged, trigger
 * pressed…).
 */
struct NamedSwitch {
  const char *name;
  SwitchRef ref;
  const char *activeLabel;   // printed when logically active
  const char *inactiveLabel; // printed when logically inactive
};

// Populated in setup() after ConfigLoader::load() so that SwitchRef values
// reflect any JSON overrides before the array is frozen for render().
static NamedSwitch kNamedSwitches[8];
static int kNamedSwitchCount = 0;

/** Returns true if a (port, pin) pair is already covered by kNamedSwitches or
 * handled separately. */
static bool isSwitchNamed(bool portB, int pin) {
  for (int i = 0; i < kNamedSwitchCount; ++i)
    if (kNamedSwitches[i].ref.portB == portB &&
        kNamedSwitches[i].ref.pin == pin)
      return true;
  // Handled by dedicated logging outside kNamedSwitches
  if (portB == SIREN_TRIGGER.portB && pin == SIREN_TRIGGER.pin)
    return true;
  return false;
}

/** Prints named switches (logical state) and unassigned pins (raw state) on
 * change. */
static void printChangedSwitches() {
  if (!gHardwareManager.isMcpConnected())
    return;
  static bool prevNamed[8] = {}; // sized for kNamedSwitches[8]
  static int prevRawA = -1;
  static int prevRawB = -1;
  static bool initialised = false;

  // Named switches — logical state with labels
  for (int i = 0; i < kNamedSwitchCount; ++i) {
    bool state = gHardwareManager.getSwitchState(kNamedSwitches[i].ref);
    if (!initialised || state != prevNamed[i]) {
      rt_printf("[SW]  %-16s  →  %s\n", kNamedSwitches[i].name,
                state ? kNamedSwitches[i].activeLabel
                      : kNamedSwitches[i].inactiveLabel);
      prevNamed[i] = state;
    }
  }

  // Unassigned pins — raw electrical state (HIGH/LOW)
  int curA = 0, curB = 0;
  for (int pin = 0; pin < 8; ++pin) {
    curA |= (gHardwareManager.getSwitchState(pin) ? 1 : 0) << pin;
    curB |= (gHardwareManager.getSwitchStateB(pin) ? 1 : 0) << pin;
  }

  if (!initialised || curA != prevRawA) {
    for (int pin = 0; pin < 8; ++pin) {
      if (isSwitchNamed(false, pin))
        continue;
      bool prev = (prevRawA >> pin) & 1;
      bool now = (curA >> pin) & 1;
      if (!initialised || prev != now)
        rt_printf("[SW]  PA%-2d  (unassigned)  →  %s\n", pin,
                  now ? "HIGH" : "LOW");
    }
    prevRawA = curA;
  }

  if (!initialised || curB != prevRawB) {
    for (int pin = 0; pin < 8; ++pin) {
      if (isSwitchNamed(true, pin))
        continue;
      bool prev = (prevRawB >> pin) & 1;
      bool now = (curB >> pin) & 1;
      if (!initialised || prev != now)
        rt_printf("[SW]  PB%-2d  (unassigned)  →  %s\n", pin,
                  now ? "HIGH" : "LOW");
    }
    prevRawB = curB;
  }

  initialised = true;
}

/** Converts an ASCII string to wstring safely (masks bytes >= 0x80 to '?'). */
static std::wstring asciiToWstring(const std::string &s) {
  std::wstring out;
  out.reserve(s.size());
  for (unsigned char c : s)
    out.push_back((c < 0x80) ? (wchar_t)c : L'?');
  return out;
}

/** Sends a config-action ACK JSON back to the GUI control WebSocket.
 *  Must be called from inside the Seasocks gui_control callback thread. */
static void sendConfigActionAck(const char *action, bool ok,
                                const std::string &reqId,
                                const std::string &error = "",
                                const std::string &content = "") {
  JSONObject ack;
  ack[L"event"] = new JSONValue(L"custom");
  ack[L"configAction"] = new JSONValue(asciiToWstring(action));
  ack[L"ok"] = new JSONValue(ok);
  if (!reqId.empty())
    ack[L"reqId"] = new JSONValue(asciiToWstring(reqId));
  if (!error.empty())
    ack[L"error"] = new JSONValue(asciiToWstring(error));
  if (!content.empty())
    ack[L"content"] = new JSONValue(asciiToWstring(content));
  JSONValue *val = new JSONValue(ack);
  gGui.sendControl(val, WSServer::kThreadCallback);
  delete val;
}

/** Validates project name contains only safe path characters. */
static bool isValidProjectName(const char *name) {
  if (!name || name[0] == '\0')
    return false;
  if (std::strstr(name, "..") != nullptr)
    return false;
  for (const char *p = name; *p != '\0'; ++p) {
    char c = *p;
    bool ok = (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') ||
              (c >= '0' && c <= '9') || c == '_' || c == '-' || c == '.';
    if (!ok)
      return false;
  }
  return true;
}

/**
 * Spawns a detached transient systemd unit via `systemd-run --no-block --collect`
 * so the helper survives both `bela_startup.service` and `bela_daemon.service`
 * cgroup tear-down. Non-RT only.
 */
static bool spawnTransientSystemdUnit(const char *scriptBody, const char *arg1,
                                      const char *arg2) {
  pid_t pid = ::fork();
  if (pid < 0)
    return false;
  if (pid == 0) {
    // Child: close inherited FDs (WebSocket, I2C, etc.) before exec.
    for (int fd = 3; fd < 1024; ++fd)
      ::close(fd);
    const char *const argv[] = {"/usr/bin/systemd-run",
                                "--no-block",
                                "--collect",
                                "--quiet",
                                "/bin/sh",
                                "-c",
                                scriptBody,
                                "_",
                                arg1,
                                arg2 ? arg2 : "",
                                nullptr};
    ::execv("/usr/bin/systemd-run", const_cast<char *const *>(argv));
    _exit(127);
  }
  int status = 0;
  while (::waitpid(pid, &status, 0) < 0 && errno == EINTR) {
  }
  return WIFEXITED(status) && WEXITSTATUS(status) == 0;
}

// ---------------------------------------------------------------------------
// Bela callbacks
// ---------------------------------------------------------------------------

bool setup(BelaContext *context, void *userData) {
  // Build project-directory paths from the runtime project name so the code
  // works regardless of what the project was named in Bela IDE.
  snprintf(kGuiProjectName, sizeof(kGuiProjectName), "%s", context->projectName);
  snprintf(kGuiConfigPath, sizeof(kGuiConfigPath),
           "/root/Bela/projects/%s/config.json", context->projectName);

  // Load hardware mappings from JSON before any other initialisation.
  ConfigLoader::load(kGuiConfigPath);
  gHardwareManager.setUiControlMode(DEV_MODE);
  gHardwareManager.resetVirtualControlsToDefaults();

  // Apply routing.*.gain defaults to the codec (same APIs as the Meters UI).
  applyCodecGainsFromConfig();

  rt_printf("[Audio] Channels active: %u in, %u out @ %.0f Hz\n",
            context->audioInChannels, context->audioOutChannels,
            context->audioSampleRate);
  if (context->audioInChannels < 10) {
    rt_printf(
        "[WARNING] Only %u audio inputs active! Channels 2-9 will be silent.\n"
        "          Set 'Audio input channels' to 10 in Bela IDE Project "
        "Settings (or pass -i 10 -o 10).\n",
        context->audioInChannels);
  }

  // Populate the named-switch table after JSON overrides are applied.
  kNamedSwitches[0] = {"KILL_KICK", KILL_KICK, "KILL", "open"};
  kNamedSwitches[1] = {"KILL_SUB", KILL_SUB, "KILL", "open"};
  kNamedSwitches[2] = {"KILL_MID", KILL_MID, "KILL", "open"};
  kNamedSwitches[3] = {"KILL_TOP", KILL_TOP, "KILL", "open"};
  kNamedSwitches[4] = {"FX_FILTER_MIDS", FX_FILTER_MIDS, "mids", "fullband"};
  kNamedSwitches[5] = {"FX_FILTER_TOPS", FX_FILTER_TOPS, "tops", "fullband"};
  kNamedSwitches[6] = {"FX2_FILTER_MIDS", FX2_FILTER_MIDS, "mids", "fullband"};
  kNamedSwitches[7] = {"FX2_FILTER_TOPS", FX2_FILTER_TOPS, "tops", "fullband"};
  kNamedSwitchCount = 8;

  // Snapshot graphic EQ PotRefs once — avoids 12 struct copies every render
  // block.
  const PotRef geqInit[GraphicEq::kNumBands] = {
      GEQ_40HZ,  GEQ_60HZ, GEQ_80HZ, GEQ_100HZ, GEQ_125HZ, GEQ_250HZ,
      GEQ_500HZ, GEQ_1KHZ, GEQ_2KHZ, GEQ_4KHZ,  GEQ_8KHZ,  GEQ_16KHZ};
  for (int i = 0; i < GraphicEq::kNumBands; ++i)
    gGeqPots[i] = geqInit[i];

  scope.setup(2, context->audioSampleRate);

  if (!gHardwareManager.setup(context)) {
    rt_fprintf(stderr, "HardwareManager init failed\n");
    return false;
  }

  for (int ch = 0; ch < kNumAuxChannels; ++ch) {
    gChannelStrips[ch][0].setup(context->audioSampleRate);
    gChannelStrips[ch][1].setup(context->audioSampleRate);
  }
  for (MasterFx *bus : gMasterBuses) {
    bus->setup(context->audioSampleRate);
  }
  gMonoLimiter.setup(context->audioSampleRate);
  if (kMonoAirCompEnabled) {
    gMonoAirFilter.setHighShelf(kMonoAirCompFreqHz, kMonoAirCompGainDb,
                                context->audioSampleRate);
  }
  gStereoMonoSlewCoeff =
      onePoleLpCoeff(kMonoCrossfadeMs, context->audioSampleRate);
  gMasterBusSlewCoeff =
      onePoleLpCoeff(kMasterBusSmoothMs, context->audioSampleRate);
  gMonoWarmthCoeff =
      onePoleLpCoeff(kMasterWarmthSmoothMs, context->audioSampleRate);
  gBassMonoHpf.setHighPass(kBassMonoFreqDefaultHz, kButterworthQ,
                           context->audioSampleRate);
  gLastBassMonoFreqHz = kBassMonoFreqDefaultHz;
  for (int ch = 0; ch < kNumAuxChannels; ++ch) {
    gAuxMute[ch].store(false, std::memory_order_relaxed);
    gAuxSolo[ch].store(false, std::memory_order_relaxed);
  }
  gDubSiren.setup(context->audioSampleRate);
  gSamplePlayer.setup(context->audioSampleRate, context->projectName);
  gDigitalFxManager.setup(context->audioSampleRate);

  for (int s = 0; s < DigitalFxManager::kNumSendSources; ++s) {
    gFxSendTrigger[s][0].store(false, std::memory_order_relaxed);
    gFxSendTrigger[s][1].store(false, std::memory_order_relaxed);
  }
  gFxTestToneEnabled.store(false, std::memory_order_relaxed);
  gSirenFxTrigger.store(false, std::memory_order_relaxed);
  gFxTestTonePhase = 0.f;
  for (int ch = 0; ch < kNumAuxChannels; ++ch) {
    gFxTestToneEnv[ch][0] = 0.f;
    gFxTestToneEnv[ch][1] = 0.f;
  }
  gFxTestAttackCoeff =
      onePoleLpCoeff(kFxTestToneAttackMs, context->audioSampleRate);
  gFxTestReleaseCoeff =
      onePoleLpCoeff(kFxTestToneReleaseMs, context->audioSampleRate);

  float sr = context->audioSampleRate;
  gFxHpf4k.setHighPass(kFxMidHighFreq, kFxFilterQ, sr); // FX1 TOPS: HPF @ 4 kHz
  gFxMidHpf.setHighPass(kFxMidLowFreq, kFxFilterQ,
                        sr); // FX1 MIDS: HPF @ 250 Hz
  gFxMidLpf.setLowPass(kFxMidHighFreq, kFxFilterQ, sr); // FX1 MIDS: LPF @ 4 kHz

  gFx2Hpf4k.setHighPass(kFxMidHighFreq, kFxFilterQ,
                        sr); // FX2 TOPS: HPF @ 4 kHz
  gFx2MidHpf.setHighPass(kFxMidLowFreq, kFxFilterQ,
                         sr); // FX2 MIDS: HPF @ 250 Hz
  gFx2MidLpf.setLowPass(kFxMidHighFreq, kFxFilterQ,
                        sr); // FX2 MIDS: LPF @ 4 kHz

  // VU meter crossover filters (Butterworth, no resonance)
  gVuSubLpf.setLowPass(kKillFc0, kButterworthQ, sr);   // SUB  < 80 Hz
  gVuKickHpf.setHighPass(kKillFc0, kButterworthQ, sr); // KICK > 80 Hz
  gVuKickLpf.setLowPass(kKillFc1, kButterworthQ, sr);  // KICK < 200 Hz
  gVuMidHpf.setHighPass(kKillFc1, kButterworthQ, sr);  // MID  > 200 Hz
  gVuMidLpf.setLowPass(kKillFc2, kButterworthQ, sr);   // MID  < 1200 Hz
  gVuTopHpf.setHighPass(kKillFc2, kButterworthQ, sr);  // TOP  > 1200 Hz

  // Mic-mode dry HPF (24 dB/oct) — coeffs from config.json routing.in.*.hpf
  for (int ch = 0; ch < kNumAuxChannels; ++ch) {
    setupMicHpf(ch, *kAuxConfigs[ch], sr);
  }

  // Startup mute & ramp: suppress DAC initialisation transient and pop
  gStartupDelayRemaining = (int)msToSamples(kStartupMuteDelayMs, sr);
  gStartupRampTotal = (int)msToSamples(kStartupRampMs, sr);
  gStartupRampRemaining = gStartupRampTotal;

  // Initialise MCP23017 — non-blocking if disconnected (preamp starts anyway)
  if (!gHardwareManager.initMcp23017(true)) {
    rt_printf("render: MCP23017 not detected — running without hardware "
              "switches (all switches OFF)\n");
  }

  gI2cTask = Bela_createAuxiliaryTask(readI2cTask, 50, "i2c-reader", nullptr);
  Bela_scheduleAuxiliaryTask(gI2cTask);

  // Low-priority sysfs poll — must stay far below audio / I2C priorities.
  gCpuTempTask =
      Bela_createAuxiliaryTask(readCpuTempTask, 1, "cpu-temp", nullptr);
  Bela_scheduleAuxiliaryTask(gCpuTempTask);

  gSampleReloadTask =
      Bela_createAuxiliaryTask(reloadSamplesTask, 1, "sample-reload", nullptr);

  // ---- GUI setup --------------------------------------------------------
  // Allocate live send buffers (never resized after this point).
  gPotValuesBuf.assign(kAllNamedPotsCount, 0.f);
  gSwitchBuf.assign(9, 0.f);
  gSirenBuf.assign(3, 0.f);
  gSamplerStateBuf.assign(kGuiSamplerStateSize, 0.f);
  gSamplerNamesBuf.assign(kGuiSamplerNamesSize, 0.f);
  gAudioLevelsBuf.assign(13, 0.f);
  gMuxRawBuf.assign(kGuiMuxRawBufSize, 0.f);
  gCodecGainsBuf.assign(20, 0.f);
  gCpuTempBuf.assign(1, -1.f);
  gFxStateBuf.assign(kGuiFxStateBufSize, 0.f);

  // Fill static mapping buffers from the (possibly JSON-overridden) globals.
  gPotMappingBuf.resize(kAllNamedPotsCount * 4);
  for (int i = 0; i < kAllNamedPotsCount; ++i) {
    gPotMappingBuf[i * 4 + 0] = (float)kAllNamedPots[i].mux;
    gPotMappingBuf[i * 4 + 1] = (float)kAllNamedPots[i].pot;
    gPotMappingBuf[i * 4 + 2] = kAllNamedPots[i].reversed ? 1.f : 0.f;
    gPotMappingBuf[i * 4 + 3] = kAllNamedPots[i].centered ? 1.f : 0.f;
  }
  gSwitchMappingBuf.resize(9 * 3);
  for (int i = 0; i < 9; ++i) {
    gSwitchMappingBuf[i * 3 + 0] = (float)kGuiSwitchRefs[i]->pin;
    gSwitchMappingBuf[i * 3 + 1] = kGuiSwitchRefs[i]->portB ? 1.f : 0.f;
    gSwitchMappingBuf[i * 3 + 2] = kGuiSwitchRefs[i]->reversed ? 1.f : 0.f;
  }

  gMasterStereo.store(MASTER_STEREO);
  gStereoMonoMix = ((MASTER_OUTS_COUNT >= 2) && MASTER_STEREO) ? 1.f : 0.f;
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
  //   { hpGain: N, channel: C }     — DAC output level for physical ch C, range
  //   [-63, 0] dB { inputGain: N, channel: C }  — ADC PGA gain for physical ch
  //   C, range [-12, 10] dB { auxMic: N, mic: bool }      — AUX N (1–4)
  //   mic-mode flag (live, not persisted) { auxHpf: N, hpf: Hz }        — AUX N
  //   (1–4) mic HPF cutoff (0 = off)
  gGui.setControlDataCallback(
      [](JSONObject &root, void *) -> bool {
        if (root.find(L"event") == root.end() || !root[L"event"]->IsString() ||
            root[L"event"]->AsString() != L"custom")
          return true;

        // DAC output gain — any physical output channel (wire key remains
        // hpGain).
        if (root.find(L"hpGain") != root.end() && root[L"hpGain"]->IsNumber() &&
            root.find(L"channel") != root.end() &&
            root[L"channel"]->IsNumber()) {
          int ch = (int)root[L"channel"]->AsNumber();
          float gain = (float)root[L"hpGain"]->AsNumber();
          applyCodecOutputGain(ch, gain);
          if (ch >= 0 && ch < kCodecChannels)
            rt_printf("[GUI] DAC Out ch %d → %.1f dB\n", ch,
                      gCodecGains[10 + ch]);
        }

        // ADC input PGA gain — codec supports [kCodecInputGainMinDb,
        // kCodecInputGainMaxDb].
        if (root.find(L"inputGain") != root.end() &&
            root[L"inputGain"]->IsNumber() &&
            root.find(L"channel") != root.end() &&
            root[L"channel"]->IsNumber()) {
          int ch = (int)root[L"channel"]->AsNumber();
          float gain = (float)root[L"inputGain"]->AsNumber();
          applyCodecInputGain(ch, gain);
          if (ch >= 0 && ch < kCodecChannels)
            rt_printf("[GUI] Input ch %d → %.1f dB\n", ch, gCodecGains[ch]);
        }

        // Live mic-mode toggle for AUX1–4 (1-based index in JSON).
        if (root.find(L"auxMic") != root.end() && root[L"auxMic"]->IsNumber() &&
            root.find(L"mic") != root.end()) {
          int idx = (int)root[L"auxMic"]->AsNumber() - 1;
          ChannelConfig *cfg = auxConfigByIndex(idx);
          if (cfg) {
            bool mic = false;
            if (root[L"mic"]->IsBool())
              mic = root[L"mic"]->AsBool();
            else if (root[L"mic"]->IsNumber())
              mic = root[L"mic"]->AsNumber() > 0.5;
            cfg->micMode = mic;
            gMicHpfPendingMask.fetch_or((uint8_t)(1u << idx));
            refreshMicMetaSlots();
            rt_printf("[GUI] AUX%d mic → %s\n", idx + 1, mic ? "on" : "off");
          }
        }

        // Live Master Stereo/Mono mode toggle
        if (root.find(L"masterStereo") != root.end()) {
          bool st = false;
          if (root[L"masterStereo"]->IsBool())
            st = root[L"masterStereo"]->AsBool();
          else if (root[L"masterStereo"]->IsNumber())
            st = root[L"masterStereo"]->AsNumber() > 0.5;
          gMasterStereo.store(st);
          // Note: MASTER_STEREO (the non-atomic global in HardwareConfig.h) is
          // NOT written here — render() reads gMasterStereo (atomic) only.
          // Writing a non-atomic global from this seasocks thread would race
          // with any reader. The atomic store above is the single source of
          // truth for the audio thread.
          refreshMasterMetaSlot();
          rt_printf("[GUI] Master mode → %s\n",
                    st ? "Stereo" : "Mono (Canal L + R)");
        }

        // Live mic HPF cutoff (Hz) for AUX1–4 (1-based index in JSON).
        if (root.find(L"auxHpf") != root.end() && root[L"auxHpf"]->IsNumber() &&
            root.find(L"hpf") != root.end() && root[L"hpf"]->IsNumber()) {
          int idx = (int)root[L"auxHpf"]->AsNumber() - 1;
          ChannelConfig *cfg = auxConfigByIndex(idx);
          if (cfg) {
            float hz = (float)root[L"hpf"]->AsNumber();
            if (hz <= 0.f)
              hz = 0.f;
            else {
              if (hz < kMicHpfFMin)
                hz = kMicHpfFMin;
              if (hz > kMicHpfFMax)
                hz = kMicHpfFMax;
            }
            cfg->hpfHz = hz;
            gMicHpfPendingMask.fetch_or((uint8_t)(1u << idx));
            refreshMicMetaSlots();
            rt_printf("[GUI] AUX%d hpf → %.0f Hz\n", idx + 1, hz);
          }
        }

        // Sampler one-shot trigger from the Live Sampler tile (zero-based
        // slot).
        if (root.find(L"samplerPlay") != root.end() &&
            root[L"samplerPlay"]->IsNumber()) {
          int slot = (int)root[L"samplerPlay"]->AsNumber();
          gSamplePlayer.trigger(slot);
          rt_printf("[GUI] Sampler play slot %d\n", slot);
        }

        // Sampler stop: { samplerStop: true }
        if (root.find(L"samplerStop") != root.end()) {
          gSamplePlayer.stop();
        }

        // Sampler per-slot settings: { samplerSlotCfg: { slot, loop, gain, pitch } }
        if (root.find(L"samplerSlotCfg") != root.end() &&
            root[L"samplerSlotCfg"]->IsObject()) {
          const JSONObject &sc = root[L"samplerSlotCfg"]->AsObject();
          auto itSlot = sc.find(L"slot");
          if (itSlot != sc.end() && itSlot->second->IsNumber()) {
            int slot = (int)itSlot->second->AsNumber();
            bool loop = false;
            float gain = 1.0f;
            float pitch = 0.0f;
            auto itLoop = sc.find(L"loop");
            if (itLoop != sc.end())
              loop = itLoop->second->IsBool() ? itLoop->second->AsBool()
                                              : (itLoop->second->AsNumber() > 0.5);
            auto itGain = sc.find(L"gain");
            if (itGain != sc.end() && itGain->second->IsNumber())
              gain = (float)itGain->second->AsNumber();
            auto itPitch = sc.find(L"pitch");
            if (itPitch != sc.end() && itPitch->second->IsNumber())
              pitch = (float)itPitch->second->AsNumber();
            gSamplePlayer.setSlotParams(slot, loop, gain, pitch);
          }
        }

        // Sampler upload WAV/MP3 from browser: { uploadSample: { name, dataB64 }, reqId? }
        if (root.find(L"uploadSample") != root.end() &&
            root[L"uploadSample"]->IsObject()) {
          std::string reqId;
          if (root.find(L"reqId") != root.end() && root[L"reqId"]->IsString())
            reqId = JSON::ws2s(root[L"reqId"]->AsString());
          const JSONObject &uo = root[L"uploadSample"]->AsObject();
          auto itName = uo.find(L"name");
          auto itData = uo.find(L"dataB64");
          if (itName == uo.end() || !itName->second->IsString() ||
              itData == uo.end() || !itData->second->IsString()) {
            sendConfigActionAck("uploadSample", false, reqId, "Missing name or data");
          } else {
            std::string name = JSON::ws2s(itName->second->AsString());
            std::string b64  = JSON::ws2s(itData->second->AsString());
            std::vector<uint8_t> bytes;
            if (!isValidSampleUploadName(name)) {
              sendConfigActionAck("uploadSample", false, reqId, "Invalid WAV/MP3 filename");
            } else if (b64.size() > 6 * 1024 * 1024 || !decodeBase64Bytes(b64, bytes)) {
              sendConfigActionAck("uploadSample", false, reqId, "Decode error or file > 4 MB");
            } else {
              std::string dir = gSamplePlayer.samplesDir();
              if (dir.empty()) dir = "samples";
              std::string fullPath = dir + "/" + name;
              FILE *fp = fopen(fullPath.c_str(), "wb");
              if (!fp) {
                sendConfigActionAck("uploadSample", false, reqId, "Cannot open destination file");
              } else {
                size_t written = fwrite(bytes.data(), 1, bytes.size(), fp);
                fclose(fp);
                if (written != bytes.size()) {
                  sendConfigActionAck("uploadSample", false, reqId, "Short write");
                } else {
                  Bela_scheduleAuxiliaryTask(gSampleReloadTask);
                  rt_printf("[GUI] Uploaded sample %s (%zu bytes)\n", name.c_str(), bytes.size());
                  sendConfigActionAck("uploadSample", true, reqId);
                }
              }
            }
          }
        }

        // Channel Mute: { auxMute: { aux: 0..3, muted: bool } }
        if (root.find(L"auxMute") != root.end() && root[L"auxMute"]->IsObject()) {
          const JSONObject &mo = root[L"auxMute"]->AsObject();
          auto itAux = mo.find(L"aux");
          auto itMut = mo.find(L"muted");
          if (itAux != mo.end() && itAux->second->IsNumber() && itMut != mo.end()) {
            int aux = (int)itAux->second->AsNumber();
            bool m = itMut->second->IsBool() ? itMut->second->AsBool()
                                             : (itMut->second->AsNumber() > 0.5);
            if (aux >= 0 && aux < kNumAuxChannels)
              gAuxMute[aux].store(m, std::memory_order_relaxed);
          }
        }

        // Channel Solo: { auxSolo: { aux: 0..3, solo: bool } }
        if (root.find(L"auxSolo") != root.end() && root[L"auxSolo"]->IsObject()) {
          const JSONObject &so = root[L"auxSolo"]->AsObject();
          auto itAux = so.find(L"aux");
          auto itSol = so.find(L"solo");
          if (itAux != so.end() && itAux->second->IsNumber() && itSol != so.end()) {
            int aux = (int)itAux->second->AsNumber();
            bool s = itSol->second->IsBool() ? itSol->second->AsBool()
                                             : (itSol->second->AsNumber() > 0.5);
            if (aux >= 0 && aux < kNumAuxChannels)
              gAuxSolo[aux].store(s, std::memory_order_relaxed);
          }
        }

        // GUI Kill switches latch mask (bits 0..3 = SUB, KICK, MID, TOP)
        if (root.find(L"guiKillsMask") != root.end() && root[L"guiKillsMask"]->IsNumber()) {
          uint8_t m = (uint8_t)((int)root[L"guiKillsMask"]->AsNumber() & 0x0F);
          gGuiKillsMask.store(m, std::memory_order_relaxed);
        }

        // GUI Dub Siren momentary/latch gate (works in both HW and Virtual mode)
        if (root.find(L"sirenGate") != root.end()) {
          bool g = root[L"sirenGate"]->IsBool() ? root[L"sirenGate"]->AsBool()
                                                : (root[L"sirenGate"]->AsNumber() > 0.5);
          gGuiSirenGate.store(g, std::memory_order_relaxed);
        }

        // Master Bus DSP: { masterBus: { warmth, bassMono, bassMonoFreq, stereoWidth, punch } }
        if (root.find(L"masterBus") != root.end() && root[L"masterBus"]->IsObject()) {
          const JSONObject &mb = root[L"masterBus"]->AsObject();
          auto itW = mb.find(L"warmth");
          if (itW != mb.end() && itW->second->IsNumber())
            gMasterWarmth.store(clamp((float)itW->second->AsNumber(), 0.f, 1.f),
                                std::memory_order_relaxed);
          auto itBm = mb.find(L"bassMono");
          if (itBm != mb.end()) {
            bool bm = itBm->second->IsBool() ? itBm->second->AsBool()
                                             : (itBm->second->AsNumber() > 0.5);
            gBassMonoEnabled.store(bm, std::memory_order_relaxed);
          }
          auto itBmf = mb.find(L"bassMonoFreq");
          if (itBmf != mb.end() && itBmf->second->IsNumber())
            gBassMonoFreqHz.store(clamp((float)itBmf->second->AsNumber(),
                                        kBassMonoFreqMinHz, kBassMonoFreqMaxHz),
                                  std::memory_order_relaxed);
          auto itSw = mb.find(L"stereoWidth");
          if (itSw != mb.end() && itSw->second->IsNumber())
            gStereoWidth.store(clamp((float)itSw->second->AsNumber(), 0.f, kStereoWidthMax),
                               std::memory_order_relaxed);
          auto itP = mb.find(L"punch");
          if (itP != mb.end() && itP->second->IsNumber())
            gMasterDynamics.store(clamp((float)itP->second->AsNumber(), 0.f, 1.f),
                                  std::memory_order_relaxed);
        }

        // Series FX chaining: { fxChain: { echoToSpring, tapeToEcho } }
        if (root.find(L"fxChain") != root.end() && root[L"fxChain"]->IsObject()) {
          const JSONObject &fc = root[L"fxChain"]->AsObject();
          auto itEs = fc.find(L"echoToSpring");
          if (itEs != fc.end() && itEs->second->IsNumber())
            gDigitalFxManager.setEchoToSpring((float)itEs->second->AsNumber());
          auto itTe = fc.find(L"tapeToEcho");
          if (itTe != fc.end() && itTe->second->IsNumber())
            gDigitalFxManager.setTapeToEcho((float)itTe->second->AsNumber());
        }

        // Live UI Control (Dev) mode toggle
        if (root.find(L"uiDevMode") != root.end()) {
          bool dev = false;
          if (root[L"uiDevMode"]->IsBool())
            dev = root[L"uiDevMode"]->AsBool();
          else if (root[L"uiDevMode"]->IsNumber())
            dev = root[L"uiDevMode"]->AsNumber() > 0.5;
          bool wasDev = gHardwareManager.isUiControlMode();
          gHardwareManager.setUiControlMode(dev);
          if (dev && !wasDev) {
            gHardwareManager.resetVirtualControlsToDefaults();
          }
          refreshUiDevModeMetaSlot();
          gForceStaticMetaSend.store(true, std::memory_order_relaxed);
          rt_printf("[GUI] UI Control (Dev) mode → %s\n",
                    dev ? "ACTIVE (Virtual Controls)" : "OFF (Hardware Controls)");
        }

        // Virtual pot update from UI
        if (root.find(L"uiPot") != root.end() && root[L"uiPot"]->IsNumber() &&
            root.find(L"val") != root.end() && root[L"val"]->IsNumber()) {
          int potIdx = (int)root[L"uiPot"]->AsNumber();
          float val = (float)root[L"val"]->AsNumber();
          gHardwareManager.setVirtualNamedPot(potIdx, val);
        }

        // Virtual switch update from UI
        if (root.find(L"uiSwitch") != root.end() && root[L"uiSwitch"]->IsNumber() &&
            root.find(L"val") != root.end()) {
          int swIdx = (int)root[L"uiSwitch"]->AsNumber();
          bool active = false;
          if (root[L"val"]->IsBool())
            active = root[L"val"]->AsBool();
          else if (root[L"val"]->IsNumber())
            active = root[L"val"]->AsNumber() > 0.5;
          if (swIdx >= 0 && swIdx < 9) {
            gHardwareManager.setVirtualSwitchByRef(*kGuiSwitchRefs[swIdx], active);
          }
        }

        // Reset virtual controls to clean musical defaults
        if (root.find(L"uiReset") != root.end()) {
          gHardwareManager.resetVirtualControlsToDefaults();
          rt_printf("[GUI] Virtual controls reset to defaults\n");
        }

        // Dynamic Digital FX send routing: { fxRoute: { aux: 0..3, send: 0..1, dest: 0..3 } }
        if (root.find(L"fxRoute") != root.end() && root[L"fxRoute"]->IsObject()) {
          const JSONObject &ro = root[L"fxRoute"]->AsObject();
          auto itAux = ro.find(L"aux");
          auto itSend = ro.find(L"send");
          auto itDest = ro.find(L"dest");
          if (itAux != ro.end() && itAux->second->IsNumber() &&
              itSend != ro.end() && itSend->second->IsNumber() &&
              itDest != ro.end() && itDest->second->IsNumber()) {
            int aux = (int)itAux->second->AsNumber();
            int send = (int)itSend->second->AsNumber();
            int dest = (int)itDest->second->AsNumber();
            gDigitalFxManager.setAuxRouting(aux, send, static_cast<FxSendDest>(dest));
            if (aux == 4) {
              rt_printf("[GUI] FX Routing: SIREN Send%d -> %d\n", send + 1, dest);
            } else {
              rt_printf("[GUI] FX Routing: AUX%d Send%d -> %d\n", aux + 1, send + 1, dest);
            }
          }
        }

        // Direct FX Send Trigger from GUI FX tab:
        //   { fxTrigger: { aux: 0..4, send: 0..1, active: bool, testTone?: bool } }
        if (root.find(L"fxTrigger") != root.end() && root[L"fxTrigger"]->IsObject()) {
          const JSONObject &ft = root[L"fxTrigger"]->AsObject();
          auto itAux = ft.find(L"aux");
          auto itSend = ft.find(L"send");
          auto itAct = ft.find(L"active");
          auto itTone = ft.find(L"testTone");
          if (itTone != ft.end()) {
            bool tt = itTone->second->IsBool()
                          ? itTone->second->AsBool()
                          : (itTone->second->AsNumber() > 0.5);
            gFxTestToneEnabled.store(tt, std::memory_order_relaxed);
          }
          if (itAux != ft.end() && itAux->second->IsNumber() &&
              itSend != ft.end() && itSend->second->IsNumber() &&
              itAct != ft.end()) {
            int aux = (int)itAux->second->AsNumber();
            int send = (int)itSend->second->AsNumber();
            bool active = itAct->second->IsBool()
                              ? itAct->second->AsBool()
                              : (itAct->second->AsNumber() > 0.5);
            if (aux >= 0 && aux < DigitalFxManager::kNumSendSources &&
                (send == 0 || send == 1)) {
              gFxSendTrigger[aux][send].store(active, std::memory_order_relaxed);
              if (aux == 4) {
                bool anySiren =
                    gFxSendTrigger[4][0].load(std::memory_order_relaxed) ||
                    gFxSendTrigger[4][1].load(std::memory_order_relaxed);
                gSirenFxTrigger.store(anySiren, std::memory_order_relaxed);
              }
            }
          }
        }

        if (root.find(L"fxTestTone") != root.end()) {
          bool tt = root[L"fxTestTone"]->IsBool()
                        ? root[L"fxTestTone"]->AsBool()
                        : (root[L"fxTestTone"]->AsNumber() > 0.5);
          gFxTestToneEnabled.store(tt, std::memory_order_relaxed);
        }

        if (root.find(L"fxTriggerClearAll") != root.end()) {
          for (int s = 0; s < DigitalFxManager::kNumSendSources; ++s) {
            gFxSendTrigger[s][0].store(false, std::memory_order_relaxed);
            gFxSendTrigger[s][1].store(false, std::memory_order_relaxed);
          }
          gSirenFxTrigger.store(false, std::memory_order_relaxed);
        }

        // SUB ROAR parameters: { subRoar: { tune, drive, decay, cutoff, level, enabled } }
        if (root.find(L"subRoar") != root.end() && root[L"subRoar"]->IsObject()) {
          const JSONObject &so = root[L"subRoar"]->AsObject();
          auto itTune = so.find(L"tune");
          if (itTune != so.end() && itTune->second->IsNumber())
            gDigitalFxManager.subRoar().setTune((float)itTune->second->AsNumber());
          auto itDrive = so.find(L"drive");
          if (itDrive != so.end() && itDrive->second->IsNumber())
            gDigitalFxManager.subRoar().setDrive((float)itDrive->second->AsNumber());
          auto itDecay = so.find(L"decay");
          if (itDecay != so.end() && itDecay->second->IsNumber())
            gDigitalFxManager.subRoar().setDecay((float)itDecay->second->AsNumber());
          auto itCutoff = so.find(L"cutoff");
          if (itCutoff != so.end() && itCutoff->second->IsNumber())
            gDigitalFxManager.subRoar().setCutoff((float)itCutoff->second->AsNumber());
          auto itLevel = so.find(L"level");
          if (itLevel != so.end() && itLevel->second->IsNumber())
            gDigitalFxManager.subRoar().setReturnGain((float)itLevel->second->AsNumber());
          auto itEn = so.find(L"enabled");
          if (itEn != so.end()) {
            bool en = itEn->second->IsBool() ? itEn->second->AsBool() : (itEn->second->AsNumber() > 0.5);
            gDigitalFxManager.subRoar().setEnabled(en);
          }
        }

        // ECHO DUB parameters: { echoDub: { time, feedback, tone, flutter, level, kill, enabled } }
        const wchar_t* dubKey = (root.find(L"echoDub") != root.end()) ? L"echoDub"
                              : (root.find(L"echuDub") != root.end()) ? L"echuDub" : nullptr;
        if (dubKey && root[dubKey]->IsObject()) {
          const JSONObject &eo = root[dubKey]->AsObject();
          auto itTime = eo.find(L"time");
          if (itTime != eo.end() && itTime->second->IsNumber())
            gDigitalFxManager.echoDub().setTime((float)itTime->second->AsNumber());
          auto itFb = eo.find(L"feedback");
          if (itFb != eo.end() && itFb->second->IsNumber())
            gDigitalFxManager.echoDub().setFeedback((float)itFb->second->AsNumber());
          auto itTone = eo.find(L"tone");
          if (itTone != eo.end() && itTone->second->IsNumber())
            gDigitalFxManager.echoDub().setTone((float)itTone->second->AsNumber());
          auto itFl = eo.find(L"flutter");
          if (itFl != eo.end() && itFl->second->IsNumber())
            gDigitalFxManager.echoDub().setFlutter((float)itFl->second->AsNumber());
          auto itLevel = eo.find(L"level");
          if (itLevel != eo.end() && itLevel->second->IsNumber())
            gDigitalFxManager.echoDub().setReturnGain((float)itLevel->second->AsNumber());
          auto itKill = eo.find(L"kill");
          if (itKill != eo.end()) {
            bool kill = itKill->second->IsBool() ? itKill->second->AsBool() : (itKill->second->AsNumber() > 0.5);
            gDigitalFxManager.echoDub().setKillSend(kill);
          }
          auto itEn = eo.find(L"enabled");
          if (itEn != eo.end()) {
            bool en = itEn->second->IsBool() ? itEn->second->AsBool() : (itEn->second->AsNumber() > 0.5);
            gDigitalFxManager.echoDub().setEnabled(en);
          }
          auto itPp = eo.find(L"pingPong");
          if (itPp != eo.end()) {
            bool pp = itPp->second->IsBool() ? itPp->second->AsBool() : (itPp->second->AsNumber() > 0.5);
            gDigitalFxManager.echoDub().setPingPong(pp);
          }
        }

        // ECHO DUB buffer clear: { echoDubClear: true } or { echuDubClear: true }
        if (root.find(L"echoDubClear") != root.end() || root.find(L"echuDubClear") != root.end()) {
          gDigitalFxManager.echoDub().clear();
          rt_printf("[GUI] ECHO DUB delay buffer cleared\n");
        }

        // TUBBY SPRING parameters: { tubbySpring: { dwell, decay, tone, level, enabled } }
        if (root.find(L"tubbySpring") != root.end() && root[L"tubbySpring"]->IsObject()) {
          const JSONObject &tso = root[L"tubbySpring"]->AsObject();
          auto itDwell = tso.find(L"dwell");
          if (itDwell != tso.end() && itDwell->second->IsNumber())
            gDigitalFxManager.tubbySpring().setDwell((float)itDwell->second->AsNumber());
          auto itDecay = tso.find(L"decay");
          if (itDecay != tso.end() && itDecay->second->IsNumber())
            gDigitalFxManager.tubbySpring().setDecay((float)itDecay->second->AsNumber());
          auto itTone = tso.find(L"tone");
          if (itTone != tso.end() && itTone->second->IsNumber())
            gDigitalFxManager.tubbySpring().setTone((float)itTone->second->AsNumber());
          auto itLevel = tso.find(L"level");
          if (itLevel != tso.end() && itLevel->second->IsNumber())
            gDigitalFxManager.tubbySpring().setReturnGain((float)itLevel->second->AsNumber());
          auto itEn = tso.find(L"enabled");
          if (itEn != tso.end()) {
            bool en = itEn->second->IsBool() ? itEn->second->AsBool() : (itEn->second->AsNumber() > 0.5);
            gDigitalFxManager.tubbySpring().setEnabled(en);
          }
        }

        // TUBBY SPRING virtual splash impact: { tubbySpringSplash: true }
        if (root.find(L"tubbySpringSplash") != root.end()) {
          gDigitalFxManager.tubbySpring().triggerSplash();
          rt_printf("[GUI] TUBBY SPRING splash triggered\n");
        }

        // BLACK ARK PHASER parameters: { blackArk: { rate, depth, feedback, stages, level, enabled } }
        if (root.find(L"blackArk") != root.end() && root[L"blackArk"]->IsObject()) {
          const JSONObject &bao = root[L"blackArk"]->AsObject();
          auto itRate = bao.find(L"rate");
          if (itRate != bao.end() && itRate->second->IsNumber())
            gDigitalFxManager.blackArk().setRate((float)itRate->second->AsNumber());
          auto itDepth = bao.find(L"depth");
          if (itDepth != bao.end() && itDepth->second->IsNumber())
            gDigitalFxManager.blackArk().setDepth((float)itDepth->second->AsNumber());
          auto itFb = bao.find(L"feedback");
          if (itFb != bao.end() && itFb->second->IsNumber())
            gDigitalFxManager.blackArk().setFeedback((float)itFb->second->AsNumber());
          auto itSt = bao.find(L"stages");
          if (itSt != bao.end() && itSt->second->IsNumber())
            gDigitalFxManager.blackArk().setStages((int)itSt->second->AsNumber());
          auto itLevel = bao.find(L"level");
          if (itLevel != bao.end() && itLevel->second->IsNumber())
            gDigitalFxManager.blackArk().setReturnGain((float)itLevel->second->AsNumber());
          auto itEn = bao.find(L"enabled");
          if (itEn != bao.end()) {
            bool en = itEn->second->IsBool() ? itEn->second->AsBool() : (itEn->second->AsNumber() > 0.5);
            gDigitalFxManager.blackArk().setEnabled(en);
          }
        }

        // TAPE DRIVE parameters: { tapeDrive: { drive, warmth, asymmetry, level, sirenInsert, enabled } }
        if (root.find(L"tapeDrive") != root.end() && root[L"tapeDrive"]->IsObject()) {
          const JSONObject &tdo = root[L"tapeDrive"]->AsObject();
          auto itDrv = tdo.find(L"drive");
          if (itDrv != tdo.end() && itDrv->second->IsNumber())
            gDigitalFxManager.tapeDrive().setDrive((float)itDrv->second->AsNumber());
          auto itWarm = tdo.find(L"warmth");
          if (itWarm != tdo.end() && itWarm->second->IsNumber())
            gDigitalFxManager.tapeDrive().setWarmth((float)itWarm->second->AsNumber());
          auto itAsym = tdo.find(L"asymmetry");
          if (itAsym != tdo.end() && itAsym->second->IsNumber())
            gDigitalFxManager.tapeDrive().setAsymmetry((float)itAsym->second->AsNumber());
          auto itLevel = tdo.find(L"level");
          if (itLevel != tdo.end() && itLevel->second->IsNumber())
            gDigitalFxManager.tapeDrive().setReturnGain((float)itLevel->second->AsNumber());
          auto itEn = tdo.find(L"enabled");
          if (itEn != tdo.end()) {
            bool en = itEn->second->IsBool() ? itEn->second->AsBool() : (itEn->second->AsNumber() > 0.5);
            gDigitalFxManager.tapeDrive().setEnabled(en);
          }
        }


        // SHIMMER DELAY parameters: { shimmerDelay: { semitones, delayTime, feedback, grainSize, level, enabled } }
        if (root.find(L"shimmerDelay") != root.end() && root[L"shimmerDelay"]->IsObject()) {
          const JSONObject &sdo = root[L"shimmerDelay"]->AsObject();
          auto itSemi = sdo.find(L"semitones");
          if (itSemi != sdo.end() && itSemi->second->IsNumber())
            gDigitalFxManager.shimmerDelay().setSemitones((int)itSemi->second->AsNumber());
          auto itTime = sdo.find(L"delayTime");
          if (itTime != sdo.end() && itTime->second->IsNumber())
            gDigitalFxManager.shimmerDelay().setDelayTime((float)itTime->second->AsNumber());
          auto itFb = sdo.find(L"feedback");
          if (itFb != sdo.end() && itFb->second->IsNumber())
            gDigitalFxManager.shimmerDelay().setFeedback((float)itFb->second->AsNumber());
          auto itGrain = sdo.find(L"grainSize");
          if (itGrain != sdo.end() && itGrain->second->IsNumber())
            gDigitalFxManager.shimmerDelay().setGrainSize((float)itGrain->second->AsNumber());
          auto itLevel = sdo.find(L"level");
          if (itLevel != sdo.end() && itLevel->second->IsNumber())
            gDigitalFxManager.shimmerDelay().setReturnGain((float)itLevel->second->AsNumber());
          auto itEn = sdo.find(L"enabled");
          if (itEn != sdo.end()) {
            bool en = itEn->second->IsBool() ? itEn->second->AsBool() : (itEn->second->AsNumber() > 0.5);
            gDigitalFxManager.shimmerDelay().setEnabled(en);
          }
        }
        if (root.find(L"shimmerClear") != root.end()) {
          gDigitalFxManager.shimmerDelay().clear();
          rt_printf("[GUI] SHIMMER DELAY memory cleared\n");
        }

        // DUB DUCKER parameters: { dubDucker: { threshold, releaseMs, duckAmount, source, enabled } }
        if (root.find(L"dubDucker") != root.end() && root[L"dubDucker"]->IsObject()) {
          const JSONObject &ddo = root[L"dubDucker"]->AsObject();
          auto itTh = ddo.find(L"threshold");
          if (itTh != ddo.end() && itTh->second->IsNumber())
            gDigitalFxManager.ducker().setThreshold((float)itTh->second->AsNumber());
          auto itRel = ddo.find(L"releaseMs");
          if (itRel != ddo.end() && itRel->second->IsNumber())
            gDigitalFxManager.ducker().setReleaseMs((float)itRel->second->AsNumber());
          auto itAmt = ddo.find(L"duckAmount");
          if (itAmt != ddo.end() && itAmt->second->IsNumber())
            gDigitalFxManager.ducker().setDuckAmount((float)itAmt->second->AsNumber());
          auto itSrc = ddo.find(L"source");
          if (itSrc != ddo.end() && itSrc->second->IsNumber())
            gDigitalFxManager.ducker().setSource((int)itSrc->second->AsNumber());
          auto itEn = ddo.find(L"enabled");
          if (itEn != ddo.end()) {
            bool en = itEn->second->IsBool() ? itEn->second->AsBool() : (itEn->second->AsNumber() > 0.5);
            gDigitalFxManager.ducker().setEnabled(en);
          }
        }



        // Save config.json directly on Bela: { saveConfigText: "...", reqId?: "..." }
        if (root.find(L"saveConfigText") != root.end() &&
            root[L"saveConfigText"]->IsString()) {
          std::string reqId;
          if (root.find(L"reqId") != root.end() && root[L"reqId"]->IsString())
            reqId = JSON::ws2s(root[L"reqId"]->AsString());
          std::string jsonText = JSON::ws2s(root[L"saveConfigText"]->AsString());
          std::string err;
          bool ok = ConfigLoader::saveRawJson(kGuiConfigPath, jsonText, err);
          if (ok)
            rt_printf("[GUI] Saved config.json (%zu bytes)\n", jsonText.size());
          else
            rt_printf("[GUI] Save config.json failed: %s\n", err.c_str());
          sendConfigActionAck("save", ok, reqId, err);
        }

        // Read raw config.json (WebSocket fallback for Export): { readConfig: true, reqId?: "..." }
        if (root.find(L"readConfig") != root.end()) {
          std::string reqId;
          if (root.find(L"reqId") != root.end() && root[L"reqId"]->IsString())
            reqId = JSON::ws2s(root[L"reqId"]->AsString());
          std::string content;
          std::string err;
          bool ok = ConfigLoader::readRawJson(kGuiConfigPath, content, err);
          sendConfigActionAck("read", ok, reqId, err, ok ? content : "");
        }

        // Restart Bela audio program only (~2-3s, keeps Wi-Fi/hotspot intact)
        if (root.find(L"restartAudio") != root.end()) {
          std::string reqId;
          if (root.find(L"reqId") != root.end() && root[L"reqId"]->IsString())
            reqId = JSON::ws2s(root[L"reqId"]->AsString());
          if (!isValidProjectName(kGuiProjectName)) {
            sendConfigActionAck("restartAudio", false, reqId,
                                "Invalid project name");
          } else if (gRestartOrRebootPending.exchange(true,
                                                      std::memory_order_relaxed)) {
            sendConfigActionAck("restartAudio", false, reqId,
                                "Restart already in progress");
          } else {
            char pidStr[32];
            snprintf(pidStr, sizeof(pidStr), "%ld", (long)::getpid());
            char scriptBuf[1024];
            int sn = snprintf(
                scriptBuf, sizeof(scriptBuf),
                "PID=\"$1\"; PROJ=\"$2\"; W=0; "
                "/usr/bin/systemctl is-active --quiet bela_startup && W=1; "
                "i=0; while kill -0 \"$PID\" 2>/dev/null && [ \"$i\" -lt %d ]; do "
                "sleep 0.05; i=$((i+1)); done; "
                "if [ \"$W\" -eq 1 ]; then "
                "S=$(/usr/bin/systemctl show -p ActiveState --value bela_startup 2>/dev/null); "
                "[ \"$S\" = active ] || [ \"$S\" = activating ] || /usr/bin/systemctl start bela_startup; "
                "else "
                "/usr/bin/make -C /root/Bela PROJECT=\"$PROJ\" stoprunning >/dev/null 2>&1 || true; "
                "if /usr/bin/grep -q '^ACTIVE=1' /opt/Bela/startup_env 2>/dev/null && "
                "/usr/bin/grep -q \"^PROJECT=$PROJ$\" /opt/Bela/startup_env 2>/dev/null; then "
                "/usr/bin/systemctl start bela_startup; "
                "else "
                "/usr/bin/make -C /root/Bela PROJECT=\"$PROJ\" CL=\"-Jsettings.json\" runscreen; "
                "fi; fi",
                kRestartWaitPollIterations);
            bool spawned = (sn > 0 && (size_t)sn < sizeof(scriptBuf)) &&
                           spawnTransientSystemdUnit(scriptBuf, pidStr, kGuiProjectName);
            if (spawned) {
              rt_printf("[GUI] Audio restart scheduled — fading out...\n");
              sendConfigActionAck("restartAudio", true, reqId);
              gShutdownSignalReceived.store(true, std::memory_order_relaxed);
            } else {
              gRestartOrRebootPending.store(false, std::memory_order_relaxed);
              sendConfigActionAck("restartAudio", false, reqId,
                                  "Failed to spawn systemd restart unit");
            }
          }
        }

        // Full Linux OS reboot (~25-30s, triggered from Mapping -> Advanced)
        if (root.find(L"rebootBoard") != root.end()) {
          std::string reqId;
          if (root.find(L"reqId") != root.end() && root[L"reqId"]->IsString())
            reqId = JSON::ws2s(root[L"reqId"]->AsString());
          if (gRestartOrRebootPending.exchange(true,
                                               std::memory_order_relaxed)) {
            sendConfigActionAck("rebootBoard", false, reqId,
                                "Reboot already in progress");
          } else {
            char pidStr[32];
            snprintf(pidStr, sizeof(pidStr), "%ld", (long)::getpid());
            char scriptBuf[512];
            int sn = snprintf(
                scriptBuf, sizeof(scriptBuf),
                "PID=\"$1\"; i=0; "
                "while kill -0 \"$PID\" 2>/dev/null && [ \"$i\" -lt %d ]; do "
                "sleep 0.05; i=$((i+1)); done; "
                "/usr/bin/sync; /usr/bin/systemctl reboot",
                kRestartWaitPollIterations);
            bool spawned = (sn > 0 && (size_t)sn < sizeof(scriptBuf)) &&
                           spawnTransientSystemdUnit(scriptBuf, pidStr, nullptr);
            if (spawned) {
              rt_printf("[GUI] Board reboot scheduled — fading out...\n");
              sendConfigActionAck("rebootBoard", true, reqId);
              gShutdownSignalReceived.store(true, std::memory_order_relaxed);
            } else {
              gRestartOrRebootPending.store(false, std::memory_order_relaxed);
              sendConfigActionAck("rebootBoard", false, reqId,
                                  "Failed to spawn systemd reboot unit");
            }
          }
        }

        return true; // let the default handler process connection-reply etc.
      },
      nullptr);
  // -----------------------------------------------------------------------

  return true;
}

void render(BelaContext *context, void *userData) {
  // Install shutdown signal handlers on first audio block so they run AFTER
  // Bela's default_main.cpp has set up its own handlers, ensuring our fade-out
  // handler takes precedence upon clicking "Stop" in the IDE or pressing
  // Ctrl+C.
  static bool gSignalsInstalled = false;
  if (!gSignalsInstalled) {
    signal(SIGINT, shutdownSignalHandler);
    signal(SIGTERM, shutdownSignalHandler);
    gSignalsInstalled = true;
    rt_printf("[Audio] Graceful shutdown handler installed successfully\n");
  }

  // Check if a shutdown signal was received and initiate the fade-out
  if (gShutdownSignalReceived.load(std::memory_order_relaxed) &&
      !gShutdownInProgress) {
    gShutdownInProgress = true;
    gShutdownRampTotal =
        (int)msToSamples(kShutdownRampMs, context->audioSampleRate);
    gShutdownRampRemaining = gShutdownRampTotal;
  }

  // Check if sample bank reload completed and push updated names to GUI
  if (gSamplePlayer.consumeBankReloaded()) {
    fillSamplerNamesBuf();
    gForceStaticMetaSend.store(true, std::memory_order_relaxed);
  }

  // Apply live mic/HPF changes queued by the gui_control callback (non-RT).
  {
    uint8_t pending = gMicHpfPendingMask.exchange(0);
    if (pending) {
      const float sr = context->audioSampleRate;
      for (int i = 0; i < kNumAuxChannels; ++i) {
        if (pending & (uint8_t)(1u << i)) {
          ChannelConfig *cfg = auxConfigByIndex(i);
          if (cfg)
            setupMicHpf(i, *cfg, sr);
        }
      }
    }
  }

  gHardwareManager.scanStep(context);

  // Shared controls between L and R strips (same gain/EQ/FX send on both sides)
  bool anyAuxSolo = false;
  for (int ch = 0; ch < kNumAuxChannels; ++ch) {
    if (gAuxSolo[ch].load(std::memory_order_relaxed)) {
      anyAuxSolo = true;
      break;
    }
  }

  bool auxTrig1[kNumAuxChannels] = {};
  bool auxTrig2[kNumAuxChannels] = {};
  for (int ch = 0; ch < kNumAuxChannels; ++ch) {
    const auto &pots = kAuxPotBindings[ch];
    auxTrig1[ch] = gFxSendTrigger[ch][0].load(std::memory_order_relaxed);
    auxTrig2[ch] = gFxSendTrigger[ch][1].load(std::memory_order_relaxed);
    const bool muted = anyAuxSolo
                           ? !gAuxSolo[ch].load(std::memory_order_relaxed)
                           : gAuxMute[ch].load(std::memory_order_relaxed);
    const float gain =
        scaleInputGainPot(gHardwareManager.getPotValue(pots.gain));
    const float eqL = potToGainDb(gHardwareManager.getPotValue(pots.eqLow));
    const float eqM = potToGainDb(gHardwareManager.getPotValue(pots.eqMid));
    const float eqH = potToGainDb(gHardwareManager.getPotValue(pots.eqHigh));
    const float fx1 = auxTrig1[ch]
                          ? 1.f
                          : scaleFxSendPot(gHardwareManager.getPotValue(pots.fx1));
    const float fx2 = auxTrig2[ch]
                          ? 1.f
                          : scaleFxSendPot(gHardwareManager.getPotValue(pots.fx2));

    for (int side = 0; side < 2; ++side) {
      gChannelStrips[ch][side].setInputGain(gain);
      gChannelStrips[ch][side].setEqGains(eqL, eqM, eqH);
      gChannelStrips[ch][side].setFxSend1Level(fx1);
      gChannelStrips[ch][side].setFxSend2Level(fx2);
      gChannelStrips[ch][side].setMuted(muted);
    }
  }

  // --- Master parametric EQ — mirrored on both L and R buses ---
  {
    const float subFreq = gHardwareManager.getPotValue(MASTER_EQ_SUB_FREQ);
    const float subGain = potToGainDb(
        gHardwareManager.getPotValue(MASTER_EQ_SUB_GAIN), kMasterEqGainRangeDb);
    const float kickFreq = gHardwareManager.getPotValue(MASTER_EQ_KICK_FREQ);
    const float kickGain =
        potToGainDb(gHardwareManager.getPotValue(MASTER_EQ_KICK_GAIN),
                    kMasterEqGainRangeDb);
    const float midFreq = gHardwareManager.getPotValue(MASTER_EQ_MID_FREQ);
    const float midGain = potToGainDb(
        gHardwareManager.getPotValue(MASTER_EQ_MID_GAIN), kMasterEqGainRangeDb);
    const float topFreq = gHardwareManager.getPotValue(MASTER_EQ_TOP_FREQ);
    const float topGain = potToGainDb(
        gHardwareManager.getPotValue(MASTER_EQ_TOP_GAIN), kMasterEqGainRangeDb);
    for (MasterFx *bus : gMasterBuses) {
      bus->setParamEqBand(ParametricEq::SUB, subFreq, subGain);
      bus->setParamEqBand(ParametricEq::KICK, kickFreq, kickGain);
      bus->setParamEqBand(ParametricEq::MID, midFreq, midGain);
      bus->setParamEqBand(ParametricEq::TOP, topFreq, topGain);
    }
  }

  // --- Master graphic EQ — 12 bands, mirrored on both buses ---
  for (int i = 0; i < GraphicEq::kNumBands; ++i) {
    float gdb =
        potToGainDb(gHardwareManager.getPotValue(gGeqPots[i]), kGEqGainRangeDb);
    for (MasterFx *bus : gMasterBuses) {
      bus->setGraphicEqBand(i, gdb);
    }
  }

  // --- Master filter section (HPF + LPF) — mirrored on both buses ---
  {
    const float hpfFreq = gHardwareManager.getPotValue(MASTER_HPF_FREQ);
    const float hpfRes = gHardwareManager.getPotValue(MASTER_HPF_RES);
    const float lpfFreq = gHardwareManager.getPotValue(MASTER_LPF_FREQ);
    const float lpfRes = gHardwareManager.getPotValue(MASTER_LPF_RES);
    for (MasterFx *bus : gMasterBuses) {
      bus->setHpf(hpfFreq, hpfRes);
      bus->setLpf(lpfFreq, lpfRes);
    }
  }

  // --- Master kill switches — mirrored on both buses (HW OR GUI latch) ---
  const uint8_t guiKillMask = gGuiKillsMask.load(std::memory_order_relaxed);
  const bool killSub  = gHardwareManager.getSwitchState(KILL_SUB)  || ((guiKillMask & 0x01) != 0);
  const bool killKick = gHardwareManager.getSwitchState(KILL_KICK) || ((guiKillMask & 0x02) != 0);
  const bool killMid  = gHardwareManager.getSwitchState(KILL_MID)  || ((guiKillMask & 0x04) != 0);
  const bool killTop  = gHardwareManager.getSwitchState(KILL_TOP)  || ((guiKillMask & 0x08) != 0);
  for (MasterFx *bus : gMasterBuses) {
    bus->setKills(killSub, killKick, killMid, killTop);
  }

  // --- Band Trim — mirrored on both buses ---
  {
    const float trimSub =
        potToGainDb(gHardwareManager.getPotValue(BTRIM_SUB), kBandTrimGainDb);
    const float trimKick =
        potToGainDb(gHardwareManager.getPotValue(BTRIM_KICK), kBandTrimGainDb);
    const float trimMid =
        potToGainDb(gHardwareManager.getPotValue(BTRIM_MID), kBandTrimGainDb);
    const float trimTop =
        potToGainDb(gHardwareManager.getPotValue(BTRIM_TOP), kBandTrimGainDb);
    for (MasterFx *bus : gMasterBuses) {
      bus->setBandTrim(BandTrim::SUB, trimSub);
      bus->setBandTrim(BandTrim::KICK, trimKick);
      bus->setBandTrim(BandTrim::MID, trimMid);
      bus->setBandTrim(BandTrim::TOP, trimTop);
    }
  }

  // --- Master output gain, dynamics & warmth — mirrored on both buses ---
  const float warmthTarget   = gMasterWarmth.load(std::memory_order_relaxed);
  const float dynamicsTarget = gMasterDynamics.load(std::memory_order_relaxed);
  const bool  bassMonoOn     = gBassMonoEnabled.load(std::memory_order_relaxed);
  const float bassMonoFreq   = gBassMonoFreqHz.load(std::memory_order_relaxed);
  const float stereoWidthTgt = gStereoWidth.load(std::memory_order_relaxed);
  if (fabsf(bassMonoFreq - gLastBassMonoFreqHz) > 0.5f) {
    gBassMonoHpf.setHighPass(bassMonoFreq, kButterworthQ, context->audioSampleRate);
    gLastBassMonoFreqHz = bassMonoFreq;
  }
  {
    const float mg =
        scaleMasterGainPot(gHardwareManager.getPotValue(MASTER_GAIN));
    for (MasterFx *bus : gMasterBuses) {
      bus->setMasterGain(mg);
      bus->setDynamics(dynamicsTarget);
      bus->setWarmth(warmthTarget);
    }
  }

  // --- FX send 1 filter mode (PA5 = MIDS, PA6 = TOPS) ---
  const bool fxModeMids = gHardwareManager.getSwitchState(FX_FILTER_MIDS);
  const bool fxModeTops = gHardwareManager.getSwitchState(FX_FILTER_TOPS);

  static bool prevFxMids = false;
  static bool prevFxTops = false;
  if (fxModeMids != prevFxMids || fxModeTops != prevFxTops) {
    gFxHpf4k.reset();
    gFxMidHpf.reset();
    gFxMidLpf.reset();
    prevFxMids = fxModeMids;
    prevFxTops = fxModeTops;
    const char *mode = fxModeTops   ? "TOPS (>4kHz)"
                       : fxModeMids ? "MIDS (250Hz-4kHz)"
                                    : "MID+TOP (>250Hz)";
    rt_printf("[FX1] Send mode  →  %s\n", mode);
  }

  // --- FX send 2 filter mode (PA4 = MIDS, PA7 = TOPS) ---
  const bool fx2ModeMids = gHardwareManager.getSwitchState(FX2_FILTER_MIDS);
  const bool fx2ModeTops = gHardwareManager.getSwitchState(FX2_FILTER_TOPS);

  static bool prevFx2Mids = false;
  static bool prevFx2Tops = false;
  if (fx2ModeMids != prevFx2Mids || fx2ModeTops != prevFx2Tops) {
    gFx2Hpf4k.reset();
    gFx2MidHpf.reset();
    gFx2MidLpf.reset();
    prevFx2Mids = fx2ModeMids;
    prevFx2Tops = fx2ModeTops;
    const char *mode = fx2ModeTops   ? "TOPS (>4kHz)"
                       : fx2ModeMids ? "MIDS (250Hz-4kHz)"
                                     : "MID+TOP (>250Hz)";
    rt_printf("[FX2] Send mode  →  %s\n", mode);
  }

  // --- Dub siren controls ---
  const float rawSirenGain = gHardwareManager.getPotValue(SIREN_GAIN);
  const float rawSirenFxSend =
      scaleFxSendPot(gHardwareManager.getPotValue(SIREN_FX_SEND));
  const float rawSirenFxSend2 =
      scaleFxSendPot(gHardwareManager.getPotValue(SIREN_FX2_SEND));
  const bool sirenTrig1 = gFxSendTrigger[4][0].load(std::memory_order_relaxed);
  const bool sirenTrig2 = gFxSendTrigger[4][1].load(std::memory_order_relaxed);
  const bool sirenFxTrig =
      gSirenFxTrigger.load(std::memory_order_relaxed) || sirenTrig1 || sirenTrig2;
  const float sirenGain =
      (sirenFxTrig && rawSirenGain < kDevModeSirenGain) ? kDevModeSirenGain
                                                        : rawSirenGain;
  const float sirenFxSend = sirenTrig1 ? 1.f : rawSirenFxSend;
  const float sirenFxSend2 = sirenTrig2 ? 1.f : rawSirenFxSend2;
  const bool sirenGate =
      gHardwareManager.getSwitchState(SIREN_TRIGGER) || sirenFxTrig ||
      gGuiSirenGate.load(std::memory_order_relaxed);

  gDubSiren.setControls(gHardwareManager.getPotValue(SIREN_TYPE),
                        gHardwareManager.getPotValue(SIREN_MOD), sirenGain,
                        sirenFxSend, sirenFxSend2, sirenGate);
  // Sampler shares siren gain / FX sends; trigger comes from the GUI only.
  gSamplePlayer.setControls(rawSirenGain, rawSirenFxSend, rawSirenFxSend2);

  // --- FX return input gains ---
  const float fx1ReturnGain =
      scaleFxReturnGainPot(gHardwareManager.getPotValue(FX1_RETURN_GAIN));
  const float fx2ReturnGain =
      scaleFxReturnGainPot(gHardwareManager.getPotValue(FX2_RETURN_GAIN));

  // Mic-mode flags and stereo detection — compute once per block.
  bool anyMic = false;
  bool anyAuxStereo = false;
  for (int ch = 0; ch < kNumAuxChannels; ++ch) {
    if (kAuxConfigs[ch]->micMode)
      anyMic = true;
    if (kAuxConfigs[ch]->isStereo())
      anyAuxStereo = true;
  }

  const bool masterStereo = gMasterStereo.load(std::memory_order_relaxed);
  // Stereo output requires both physical channels configured AND masterStereo
  // enabled
  const bool stereoOut = (MASTER_OUTS_COUNT >= 2) && masterStereo;
  // Right bus processing is required if output is stereo OR if master is mono
  // and needs to fold down stereo AUX inputs
  const bool needRightBus = (MASTER_OUTS_COUNT >= 2) || anyAuxStereo;

  // --- Sample loop ---
  bool clipAux[kNumAuxChannels] = {};
  bool sigAux[kNumAuxChannels] = {};
  bool clipMaster = false;
  const bool testToneOn = gFxTestToneEnabled.load(std::memory_order_relaxed);
  bool anyTestToneActive = false;
  for (int ch = 0; ch < kNumAuxChannels; ++ch) {
    if ((testToneOn && (auxTrig1[ch] || auxTrig2[ch])) ||
        gFxTestToneEnv[ch][0] > 1e-6f || gFxTestToneEnv[ch][1] > 1e-6f) {
      anyTestToneActive = true;
      break;
    }
  }
  const float testTonePhaseInc =
      kTwoPi * kFxTestToneFreqHz / context->audioSampleRate;

  for (unsigned int n = 0; n < context->audioFrames; n++) {
    float inL[kNumAuxChannels];
    float inR[kNumAuxChannels];
    float dryL[kNumAuxChannels];
    float dryR[kNumAuxChannels];
    float fx1AuxSum = 0.f;
    float fx2AuxSum = 0.f;
    float testToneSample = 0.f;
    if (anyTestToneActive) {
      gFxTestTonePhase += testTonePhaseInc;
      if (gFxTestTonePhase >= kTwoPi)
        gFxTestTonePhase -= kTwoPi;
      const float s1Osc = sinf(gFxTestTonePhase);
      const float c1Osc = cosf(gFxTestTonePhase);
      testToneSample =
          (0.65f * s1Osc + 0.35f * (2.f * s1Osc * c1Osc)) * kFxTestToneGain;
    }

    for (int ch = 0; ch < kNumAuxChannels; ++ch) {
      const ChannelConfig &cfg = *kAuxConfigs[ch];
      inL[ch] = readChannelInputL(context, n, cfg);
      inR[ch] = readChannelInputR(context, n, cfg);

      dryL[ch] = applyMicHpf(ch, gChannelStrips[ch][0].process(inL[ch]));
      dryR[ch] = applyMicHpfR(ch, gChannelStrips[ch][1].process(inR[ch]));

        float inLMag = fabsf(inL[ch]);
      float dryLMag = fabsf(dryL[ch]);
      if (inLMag >= kClipThreshold || dryLMag >= kClipThreshold)
        clipAux[ch] = true;
      else if (inLMag >= kSignalPresentThreshold ||
               dryLMag >= kSignalPresentThreshold)
        sigAux[ch] = true;

      if (cfg.isStereo()) {
        float inRMag = fabsf(inR[ch]);
        float dryRMag = fabsf(dryR[ch]);
        if (inRMag >= kClipThreshold || dryRMag >= kClipThreshold)
          clipAux[ch] = true;
        else if (inRMag >= kSignalPresentThreshold ||
                 dryRMag >= kSignalPresentThreshold)
          sigAux[ch] = true;
      }

      float s1 = cfg.isStereo() ? 0.5f * (gChannelStrips[ch][0].fxOut() +
                                          gChannelStrips[ch][1].fxOut())
                                : gChannelStrips[ch][0].fxOut();
      float s2 = cfg.isStereo() ? 0.5f * (gChannelStrips[ch][0].fxOut2() +
                                          gChannelStrips[ch][1].fxOut2())
                                : gChannelStrips[ch][0].fxOut2();
      if (anyTestToneActive) {
        const float target1 = (testToneOn && auxTrig1[ch]) ? 1.f : 0.f;
        const float coeff1 =
            (target1 > gFxTestToneEnv[ch][0]) ? gFxTestAttackCoeff
                                              : gFxTestReleaseCoeff;
        gFxTestToneEnv[ch][0] += coeff1 * (target1 - gFxTestToneEnv[ch][0]);
        gFxTestToneEnv[ch][0] = flushDenormal(gFxTestToneEnv[ch][0]);
        s1 += testToneSample * gFxTestToneEnv[ch][0];

        const float target2 = (testToneOn && auxTrig2[ch]) ? 1.f : 0.f;
        const float coeff2 =
            (target2 > gFxTestToneEnv[ch][1]) ? gFxTestAttackCoeff
                                              : gFxTestReleaseCoeff;
        gFxTestToneEnv[ch][1] += coeff2 * (target2 - gFxTestToneEnv[ch][1]);
        gFxTestToneEnv[ch][1] = flushDenormal(gFxTestToneEnv[ch][1]);
        s2 += testToneSample * gFxTestToneEnv[ch][1];
      }
      gDigitalFxManager.routeAux1Send(ch, s1, fx1AuxSum);
      gDigitalFxManager.routeAux2Send(ch, s2, fx2AuxSum);
    }

    // Siren + sampler: mono sources, present equally on L and R
    float sirenOut = gDubSiren.process();
    float samplerOut = gSamplePlayer.process();

    // Route Dub Siren FX sends dynamically (Source 4 = SIREN)
    gDigitalFxManager.routeAux1Send(4, gDubSiren.fxOut(), fx1AuxSum);
    gDigitalFxManager.routeAux2Send(4, gDubSiren.fxOut2(), fx2AuxSum);

    // FX send 1: sum AUX channels + Siren + Sampler (if routed to Hardware, Siren is in fx1AuxSum)
    float fxSend = fx1AuxSum + gSamplePlayer.fxOut();
    if (fxModeTops)
      fxSend = gFxHpf4k.process(fxSend); // > 4 kHz only
    else if (fxModeMids)
      fxSend = gFxMidLpf.process(gFxMidHpf.process(fxSend)); // 250 Hz – 4 kHz
    else
      fxSend = gFxMidHpf.process(fxSend); // > 250 Hz (MID+TOP)

    // FX send 2: mono FX bus → OUT1 (if routed to Hardware, Siren is in fx2AuxSum)
    float fxSend2 = fx2AuxSum + gSamplePlayer.fxOut2();
    if (fx2ModeTops)
      fxSend2 = gFx2Hpf4k.process(fxSend2); // > 4 kHz only
    else if (fx2ModeMids)
      fxSend2 =
          gFx2MidLpf.process(gFx2MidHpf.process(fxSend2)); // 250 Hz – 4 kHz
    else
      fxSend2 = gFx2MidHpf.process(fxSend2); // > 250 Hz (MID+TOP)

    // Dry sums before master bus
    float dryNormalL = 0.f, dryMicL = 0.f;
    for (int ch = 0; ch < kNumAuxChannels; ++ch) {
      if (kAuxConfigs[ch]->micMode)
        dryMicL += dryL[ch];
      else
        dryNormalL += dryL[ch];
    }

    // Sidechain key detection: Siren/Sampler, Mic inputs, or Master bus
    gDigitalFxManager.ducker().updateKey(sirenOut + samplerOut, dryMicL, dryNormalL + sirenOut + samplerOut);

    // FX returns: mono, added equally to both buses
    float fxReturn = gMasterFx.processFxReturn(
        audioRead(context, n, FX1_RETURN_IN) * fx1ReturnGain);
    float fxReturn2 = gMasterFx.processFxReturn2(
        audioRead(context, n, FX2_RETURN_IN) * fx2ReturnGain);
    float digitalFxL = 0.f, digitalFxR = 0.f;
    gDigitalFxManager.processStereo(digitalFxL, digitalFxR);
    const float monoExtrasL = sirenOut + samplerOut + digitalFxL;
    const float monoExtrasR = sirenOut + samplerOut + digitalFxR;

    // ---- Left master bus (unlimited raw linear output) ----
    // Routing controlled by kFxReturnPostMaster (SoftwareConfig.h).
    // Mic-mode AUX dry: bypasses ParamEq / HPF-LPF / kills; still gets GEQ +
    // BandTrim + gain.
    dryNormalL += monoExtrasL;

    float rawOutL;
    if (kFxReturnPostMaster) {
      rawOutL = gMasterFx.process(dryNormalL);
      if (anyMic)
        rawOutL += gMasterFx.processMicPath(dryMicL);
      rawOutL += (fxReturn + fxReturn2) * gMasterFx.getMasterGain();
    } else {
      rawOutL = gMasterFx.process(dryNormalL + fxReturn + fxReturn2);
      if (anyMic)
        rawOutL += gMasterFx.processMicPath(dryMicL);
    }

    // ---- Right master bus (unlimited raw linear output) ----
    float rawOutR;
    if (needRightBus) {
      float dryNormalR = 0.f, dryMicR = 0.f;
      for (int ch = 0; ch < kNumAuxChannels; ++ch) {
        if (kAuxConfigs[ch]->micMode)
          dryMicR += dryR[ch];
        else
          dryNormalR += dryR[ch];
      }
      dryNormalR += monoExtrasR;

      if (kFxReturnPostMaster) {
        rawOutR = gMasterFxR.process(dryNormalR);
        if (anyMic)
          rawOutR += gMasterFxR.processMicPath(dryMicR);
        rawOutR += (fxReturn + fxReturn2) * gMasterFxR.getMasterGain();
      } else {
        rawOutR = gMasterFxR.process(dryNormalR + fxReturn + fxReturn2);
        if (anyMic)
          rawOutR += gMasterFxR.processMicPath(dryMicR);
      }
    } else {
      rawOutR = rawOutL;
    }

    // Mid-Side Bass Mono (< bassMonoFreq) & Stereo Width shaping
    gSmoothStereoWidth += gMasterBusSlewCoeff * (stereoWidthTgt - gSmoothStereoWidth);
    gSmoothBassMonoMix += gMasterBusSlewCoeff * ((bassMonoOn ? 1.f : 0.f) - gSmoothBassMonoMix);
    float shapedL = rawOutL;
    float shapedR = rawOutR;
    if (stereoOut && (gSmoothBassMonoMix > 0.001f || fabsf(gSmoothStereoWidth - 1.f) > 0.001f)) {
      const float mid      = 0.5f * (rawOutL + rawOutR);
      const float side     = 0.5f * (rawOutL - rawOutR);
      const float sideHpf  = gBassMonoHpf.process(side);
      const float sideMono = side + gSmoothBassMonoMix * (sideHpf - side);
      const float sideOut  = sideMono * gSmoothStereoWidth;
      shapedL = mid + sideOut;
      shapedR = mid - sideOut;
    } else {
      // Keep HPF delay line warm
      gBassMonoHpf.process(0.5f * (rawOutL - rawOutR));
    }

    // Advance smooth crossfade between Stereo (1.f) and Mono (0.f)
    const float targetStereoMix = stereoOut ? 1.f : 0.f;
    gStereoMonoMix += gStereoMonoSlewCoeff * (targetStereoMix - gStereoMonoMix);

    // Final Master outputs (Analog Warmth -> Brickwall Limiter)
    float finalL, finalR;
    if (gStereoMonoMix >= 1.f - kCrossfadeEpsilon) {
      // Pure Stereo mode: warmth + independent L & R limiters
      const float warmL = gMasterFx.applyWarmth(shapedL);
      const float warmR = gMasterFxR.applyWarmth(shapedR);
      finalL = gMasterFx.limitOutput(warmL);
      finalR = gMasterFxR.limitOutput(warmR);
      if (fabsf(rawOutL) >= kClipThreshold ||
          fabsf(rawOutR) >= kClipThreshold || fabsf(finalL) >= kClipThreshold ||
          fabsf(finalR) >= kClipThreshold)
        clipMaster = true;
    } else if (gStereoMonoMix <= kCrossfadeEpsilon) {
      // Pure Mono mode: sum raw outputs with constant power law, apply Air
      // compensation, analog warmth, limit once
      float monoSum = kMonoFoldDownGain * (rawOutL + rawOutR);
      if (kMonoAirCompEnabled)
        monoSum = gMonoAirFilter.process(monoSum);
      gMonoWarmthSmooth += gMonoWarmthCoeff * (warmthTarget - gMonoWarmthSmooth);
      if (gMonoWarmthSmooth >= 0.001f) {
        float preG = 1.f + gMonoWarmthSmooth * (kMasterWarmthMaxGain - 1.f);
        float norm = fastTanh(preG);
        if (norm > 1e-4f) monoSum = fastTanh(monoSum * preG) / norm;
      }
      float outMono = gMonoLimiter.process(monoSum);
      finalL = outMono;
      finalR = outMono;
      if (fabsf(rawOutL) >= kClipThreshold ||
          fabsf(rawOutR) >= kClipThreshold || fabsf(outMono) >= kClipThreshold)
        clipMaster = true;
    } else {
      // Crossfade transition: smooth anti-click interpolation between stereo
      // and mono
      float stereoL = gMasterFx.limitOutput(gMasterFx.applyWarmth(shapedL));
      float stereoR = gMasterFxR.limitOutput(gMasterFxR.applyWarmth(shapedR));

      float monoSum = kMonoFoldDownGain * (rawOutL + rawOutR);
      if (kMonoAirCompEnabled)
        monoSum = gMonoAirFilter.process(monoSum);
      gMonoWarmthSmooth += gMonoWarmthCoeff * (warmthTarget - gMonoWarmthSmooth);
      if (gMonoWarmthSmooth >= 0.001f) {
        float preG = 1.f + gMonoWarmthSmooth * (kMasterWarmthMaxGain - 1.f);
        float norm = fastTanh(preG);
        if (norm > 1e-4f) monoSum = fastTanh(monoSum * preG) / norm;
      }
      float outMono = gMonoLimiter.process(monoSum);

      finalL = gStereoMonoMix * stereoL + (1.f - gStereoMonoMix) * outMono;
      finalR = gStereoMonoMix * stereoR + (1.f - gStereoMonoMix) * outMono;
      if (fabsf(rawOutL) >= kClipThreshold ||
          fabsf(rawOutR) >= kClipThreshold || fabsf(finalL) >= kClipThreshold ||
          fabsf(finalR) >= kClipThreshold)
        clipMaster = true;
    }

    // Startup mute delay & S-curve ramp: suppress DAC initialisation transient
    // and pop while the startup LED animation runs.
    float startupGain = 0.f;
    if (gStartupDelayRemaining > 0 ||
        !gHardwareManager.isStartupAnimationDone()) {
      if (gStartupDelayRemaining > 0)
        --gStartupDelayRemaining;
      startupGain = 0.f;
    } else if (gStartupRampRemaining > 0) {
      float progress =
          1.f - (float)gStartupRampRemaining / (float)gStartupRampTotal;
      // Smooth half-cosine S-curve: 0.5 * (1 - cos(pi * progress))
      startupGain = 0.5f * (1.f - cosf(progress * kPi));
      --gStartupRampRemaining;
    } else {
      startupGain = 1.f;
    }

    // Shutdown fade-out: smooth S-curve ramp 1.0 -> 0.0 to suppress stop pop
    float shutdownGain = 1.f;
    if (gShutdownInProgress) {
      if (gShutdownRampRemaining > 0) {
        float progress =
            (float)gShutdownRampRemaining / (float)gShutdownRampTotal;
        // Smooth half-cosine S-curve: 0.5 * (1 - cos(pi * progress))
        shutdownGain = 0.5f * (1.f - cosf(progress * kPi));
        --gShutdownRampRemaining;
      } else {
        shutdownGain = 0.f;
      }
    }

    const float outputGain = startupGain * shutdownGain;

    scope.log(dryNormalL + dryMicL + fxReturn + fxReturn2, finalL);
    audioWrite(context, n, FX1_SEND_OUT, fxSend * outputGain);
    audioWrite(context, n, FX2_SEND_OUT, fxSend2 * outputGain);

    // Master outputs: in stereo, OUT0 = L, OUT1 = R. In mono, both OUT0 and
    // OUT1 = outMono (L+R).
    if (MASTER_OUTS_COUNT >= 2) {
      audioWrite(context, n, MASTER_OUTS[0], finalL * outputGain);
      audioWrite(context, n, MASTER_OUTS[1], finalR * outputGain);
      for (int i = 2; i < MASTER_OUTS_COUNT; ++i)
        audioWrite(context, n, MASTER_OUTS[i], finalL * outputGain);
    } else {
      for (int i = 0; i < MASTER_OUTS_COUNT; ++i)
        audioWrite(context, n, MASTER_OUTS[i], finalL * outputGain);
    }

    // VU meters — band-split reference signal (finalL: outL in stereo, outMono
    // in mono)
    float vuSub = gVuSubLpf.process(finalL);
    float vuKick = gVuKickLpf.process(gVuKickHpf.process(finalL));
    float vuMid = gVuMidLpf.process(gVuMidHpf.process(finalL));
    float vuTop = gVuTopHpf.process(finalL);
    audioWrite(context, n, VU_SUB_OUT, vuSub * outputGain);
    audioWrite(context, n, VU_KICK_OUT, vuKick * outputGain);
    audioWrite(context, n, VU_MID_OUT, vuMid * outputGain);
    audioWrite(context, n, VU_TOP_OUT, vuTop * outputGain);

// GUI peak tracking — one max(|x|) per channel per update interval.
#define GUI_PEAK(i, x)                                                         \
  {                                                                            \
    float _a = fabsf(x);                                                       \
    if (_a > gAudioPeaks[i])                                                   \
      gAudioPeaks[i] = _a;                                                     \
  }
    for (int ch = 0; ch < kNumAuxChannels; ++ch) {
      GUI_PEAK(ch, inL[ch])
    }
    GUI_PEAK(4, fxReturn)
    GUI_PEAK(5, fxReturn2)
    GUI_PEAK(6, finalL)
    GUI_PEAK(7, fxSend)
    GUI_PEAK(8, fxSend2)
    GUI_PEAK(9, vuSub)
    GUI_PEAK(10, vuKick)
    GUI_PEAK(11, vuMid)
    GUI_PEAK(12, vuTop)
#undef GUI_PEAK
  }

  // --- Trigger hardware clip & signal LEDs on MCP23017 (RT-safe atomic
  // signals) ---
  if (gHardwareManager.isStartupAnimationDone() && !gShutdownInProgress) {
    if (clipMaster)
      gHardwareManager.triggerClip(HardwareManager::CLIP_MASTER);
    for (int ch = 0; ch < kNumAuxChannels; ++ch) {
      HardwareManager::ClipChannel clipCh =
          static_cast<HardwareManager::ClipChannel>(HardwareManager::CLIP_AUX1 +
                                                    ch);
      if (clipAux[ch])
      gHardwareManager.triggerClip(clipCh);
      else if (sigAux[ch]) gHardwareManager.triggerSignal(clipCh);
    }
  }

  // --- Clip warnings (rate-limited) ---
  ++gClipWarnCounter;
  bool anyAuxClip = false;
  for (int ch = 0; ch < kNumAuxChannels; ++ch) {
    if (clipAux[ch])
      anyAuxClip = true;
  }
  if ((anyAuxClip || clipMaster) &&
      gClipWarnCounter >= kClipWarnIntervalBlocks) {
    for (int ch = 0; ch < kNumAuxChannels; ++ch) {
      if (clipAux[ch])
        rt_printf("WARNING Aux %d clipping\n", ch + 1);
    }
    if (clipMaster)
      rt_printf("WARNING Master clipping\n");
    gClipWarnCounter = 0;
  }

  // --- GUI update (~20 fps) — count samples, not render blocks ---
  gGuiUpdateSampleCount += (int)context->audioFrames;
  if (gGuiUpdateSampleCount >= kGuiUpdateIntervalSamples) {
    gGuiUpdateSampleCount -= kGuiUpdateIntervalSamples;

    // Buffer 0: all pot values in kAllNamedPots order
    for (int i = 0; i < kAllNamedPotsCount; ++i)
      gPotValuesBuf[i] = gHardwareManager.getPotValue(kAllNamedPots[i]);
    gGui.sendBuffer(0, gPotValuesBuf);

    // Buffer 1: switch states (effective HW OR GUI overrides)
    gSwitchBuf[0] = killSub ? 1.f : 0.f;
    gSwitchBuf[1] = killKick ? 1.f : 0.f;
    gSwitchBuf[2] = killMid ? 1.f : 0.f;
    gSwitchBuf[3] = killTop ? 1.f : 0.f;
    gSwitchBuf[4] = gHardwareManager.getSwitchState(FX_FILTER_MIDS) ? 1.f : 0.f;
    gSwitchBuf[5] = gHardwareManager.getSwitchState(FX_FILTER_TOPS) ? 1.f : 0.f;
    gSwitchBuf[6] =
        gHardwareManager.getSwitchState(FX2_FILTER_TOPS) ? 1.f : 0.f;
    gSwitchBuf[7] =
        gHardwareManager.getSwitchState(FX2_FILTER_MIDS) ? 1.f : 0.f;
    gSwitchBuf[8] = sirenGate ? 1.f : 0.f;
    gGui.sendBuffer(1, gSwitchBuf);

    // Buffer 2: siren state [presetIdx, gate, mod]
    float sirenTypePot = gHardwareManager.getPotValue(SIREN_TYPE);
    gSirenBuf[0] = floorf(sirenTypePot * (float)DubSiren::kNumPresets);
    if (gSirenBuf[0] >= (float)DubSiren::kNumPresets)
      gSirenBuf[0] = (float)(DubSiren::kNumPresets - 1);
    gSirenBuf[1] = sirenGate ? 1.f : 0.f;
    gSirenBuf[2] = gHardwareManager.getPotValue(SIREN_MOD);
    gGui.sendBuffer(2, gSirenBuf);

    // Buffer 10: sampler state [folderOk, count, playingSlot, isPlaying,
    // playhead]
    gSamplerStateBuf[0] = gSamplePlayer.folderOk() ? 1.f : 0.f;
    gSamplerStateBuf[1] = (float)gSamplePlayer.sampleCount();
    gSamplerStateBuf[2] = (float)gSamplePlayer.playingSlot();
    gSamplerStateBuf[3] = gSamplePlayer.isPlaying() ? 1.f : 0.f;
    gSamplerStateBuf[4] = gSamplePlayer.playhead();
    gGui.sendBuffer(10, gSamplerStateBuf);

    // Buffer 3: audio peak levels — copy accumulators, then reset
    for (int i = 0; i < 13; ++i) {
      gAudioLevelsBuf[i] = gAudioPeaks[i];
      gAudioPeaks[i] = 0.f;
    }
    gGui.sendBuffer(3, gAudioLevelsBuf);

    // Buffer 7: raw MUX grid (unmapped pot discovery in GUI)
    for (int m = 0; m < kActiveMux; ++m)
      for (int p = 0; p < kPotsPerMux; ++p)
        gMuxRawBuf[m * kPotsPerMux + p] = gHardwareManager.getPotValue(m, p);
    gGui.sendBuffer(7, gMuxRawBuf);

    // Buffer 8: codec gain state — synchronises all connected GUI clients.
    // Layout: [0..9] ADC input gain by physical ch, [10..19] DAC output gain by
    // physical ch.
    for (int i = 0; i < 20; ++i)
      gCodecGainsBuf[i] = gCodecGains[i];
    gGui.sendBuffer(8, gCodecGainsBuf);

    // Buffer 9: CPU temperature °C (updated ~every 2 s by AuxTask; one float).
    gCpuTempBuf[0] = gCpuTempC.load(std::memory_order_relaxed);
    gGui.sendBuffer(9, gCpuTempBuf);

    // Buffer 12: Digital FX & Master Bus state (34 floats)
    gFxStateBuf[0] = gDigitalFxManager.subRoar().getAndResetPeak();
    gFxStateBuf[1] = gDigitalFxManager.echoDub().getAndResetPeak();
    gFxStateBuf[2] = gDigitalFxManager.tubbySpring().getAndResetPeak();
    gFxStateBuf[3] = gDigitalFxManager.blackArk().getAndResetPeak();
    gFxStateBuf[4] = gDigitalFxManager.tapeDrive().getAndResetPeak();
    gFxStateBuf[5] = gDigitalFxManager.shimmerDelay().getAndResetPeak();
    gFxStateBuf[6] = gDigitalFxManager.ducker().getGainReductionForMeter();
    for (int c = 0; c < DigitalFxManager::kNumSendSources; ++c) {
      gFxStateBuf[7 + c * 2]     = (float)static_cast<int>(gDigitalFxManager.getAuxRouting(c, 0));
      gFxStateBuf[7 + c * 2 + 1] = (float)static_cast<int>(gDigitalFxManager.getAuxRouting(c, 1));
    }
    for (int ch = 0; ch < kNumAuxChannels; ++ch) {
      gFxStateBuf[17 + ch] = gAuxMute[ch].load(std::memory_order_relaxed) ? 1.f : 0.f;
      gFxStateBuf[21 + ch] = gAuxSolo[ch].load(std::memory_order_relaxed) ? 1.f : 0.f;
    }
    gFxStateBuf[25] = (float)guiKillMask;
    gFxStateBuf[26] = warmthTarget;
    gFxStateBuf[27] = bassMonoOn ? 1.f : 0.f;
    gFxStateBuf[28] = bassMonoFreq;
    gFxStateBuf[29] = stereoWidthTgt;
    gFxStateBuf[30] = dynamicsTarget;
    gFxStateBuf[31] = gDigitalFxManager.echoDub().isPingPong() ? 1.f : 0.f;
    gFxStateBuf[32] = gDigitalFxManager.getEchoToSpring();
    gFxStateBuf[33] = gDigitalFxManager.getTapeToEcho();
    gGui.sendBuffer(12, gFxStateBuf);

    // Buffers 4+5+6+11: mapping + config + sample names — resend for
    // (re)connects or when metadata changes. First tick is forced (gGuiStaticSendCount starts at the
    // divisor).
    if (gForceStaticMetaSend.exchange(false, std::memory_order_relaxed) ||
        ++gGuiStaticSendCount >= kGuiStaticBufSendDivisor) {
      gGuiStaticSendCount = 0;
      gGui.sendBuffer(4, gPotMappingBuf);
      gGui.sendBuffer(5, gSwitchMappingBuf);
      gGui.sendBuffer(6, gConfigMetaBuf);
      gGui.sendBuffer(11, gSamplerNamesBuf);
    }
  }

  // --- Debug logging ---
  if (kDebug) {
    printChangedPots();
    printChangedSwitches();

    // Siren trigger: log gate state with the active preset name
    if (gHardwareManager.isMcpConnected()) {
      static bool prevSirenTrigger = false;
      bool sirenTrigger = gHardwareManager.getSwitchState(SIREN_TRIGGER);
      if (sirenTrigger != prevSirenTrigger) {
        if (sirenTrigger)
          rt_printf("[SW]  SIREN_TRIGGER      →  ON  [%s]\n",
                    gDubSiren.getPresetName());
        else
          rt_printf("[SW]  SIREN_TRIGGER      →  off\n");
        prevSirenTrigger = sirenTrigger;
      }
    }
  }

  // Trigger clean shutdown once fade-out completes
  if (gShutdownInProgress && gShutdownRampRemaining <= 0) {
    rt_printf("[Audio] Fade-out complete. Requesting Bela stop.\n");
    Bela_requestStop();
  }
}

void cleanup(BelaContext *context, void *userData) {
  gHardwareManager.closeMcp23017();
  gGui.cleanup();
}
