#include "ConfigLoader.h"
#include "HardwareConfig.h"
#include "SoftwareConfig.h"

#include <JSONValue.h> // Bela native SimpleJSON

#include <algorithm>
#include <cctype>
#include <cstdio>
#include <cstring>
#include <fstream>
#include <sstream>


// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Finds the named PotRef global in kAllNamedPots and returns a pointer, or
 *  nullptr when no entry with that name exists. */
static PotRef *findPotByName(const char *name) {
  for (int i = 0; i < kAllNamedPotsCount; ++i)
    if (kAllNamedPots[i].name && strcmp(kAllNamedPots[i].name, name) == 0)
      return &kAllNamedPots[i];
  return nullptr;
}

/** Finds the named global PotRef variable (the one directly used in render.cpp)
 *  that shares the same name string pointer as the kAllNamedPots entry. Since
 *  all PotRef globals are initialised with string literals whose addresses are
 *  the same across TUs, we can match on strcmp. Returns nullptr if not found.
 */
static PotRef *findPotGlobalByName(const char *name) {
  // List of every named PotRef global in the same order as HardwareConfig.h.
  // We must patch both the individual global AND the kAllNamedPots entry so
  // that getPotName() and render() stay in sync.
  static PotRef *const sAll[] = {
      &MASTER_GAIN,
      &SIREN_TYPE,
      &SIREN_MOD,
      &SIREN_GAIN,
      &SIREN_FX_SEND,
      &SIREN_FX2_SEND,
      &AUX1_INPUT_GAIN,
      &AUX1_EQ_MID,
      &AUX1_EQ_LOW,
      &AUX1_EQ_HIGH,
      &AUX1_FX_SEND,
      &AUX1_FX2_SEND,
      &AUX2_INPUT_GAIN,
      &AUX2_EQ_MID,
      &AUX2_EQ_HIGH,
      &AUX2_EQ_LOW,
      &AUX2_FX_SEND,
      &AUX2_FX2_SEND,
      &AUX3_INPUT_GAIN,
      &AUX3_EQ_LOW,
      &AUX3_EQ_MID,
      &AUX3_EQ_HIGH,
      &AUX3_FX_SEND,
      &AUX3_FX2_SEND,
      &AUX4_INPUT_GAIN,
      &AUX4_EQ_LOW,
      &AUX4_EQ_MID,
      &AUX4_EQ_HIGH,
      &AUX4_FX_SEND,
      &AUX4_FX2_SEND,
      &MASTER_EQ_SUB_FREQ,
      &MASTER_EQ_SUB_GAIN,
      &MASTER_EQ_KICK_FREQ,
      &MASTER_EQ_KICK_GAIN,
      &MASTER_EQ_MID_FREQ,
      &MASTER_EQ_MID_GAIN,
      &MASTER_EQ_TOP_FREQ,
      &MASTER_EQ_TOP_GAIN,
      &BTRIM_TOP,
      &BTRIM_MID,
      &BTRIM_KICK,
      &BTRIM_SUB,
      &GEQ_2KHZ,
      &GEQ_8KHZ,
      &GEQ_60HZ,
      &GEQ_40HZ,
      &GEQ_80HZ,
      &GEQ_100HZ,
      &GEQ_250HZ,
      &GEQ_125HZ,
      &GEQ_500HZ,
      &GEQ_4KHZ,
      &GEQ_1KHZ,
      &GEQ_16KHZ,
      &MASTER_HPF_FREQ,
      &MASTER_HPF_RES,
      &MASTER_LPF_RES,
      &MASTER_LPF_FREQ,
      &FX1_RETURN_GAIN,
      &FX2_RETURN_GAIN,
  };
  static constexpr int sCount = sizeof(sAll) / sizeof(sAll[0]);

  for (int i = 0; i < sCount; ++i)
    if (sAll[i]->name && strcmp(sAll[i]->name, name) == 0)
      return sAll[i];
  return nullptr;
}

/** Finds a named SwitchRef global and returns a pointer, or nullptr. */
static SwitchRef *findSwitchGlobalByName(const char *name) {
  // The SwitchRef struct has no name field; we match by the string we expect
  // in the JSON "name" key against fixed identifiers.
  struct Entry {
    const char *key;
    SwitchRef *ref;
  };
  static Entry sAll[] = {
      {"KILL_SUB", &KILL_SUB},
      {"KILL_KICK", &KILL_KICK},
      {"KILL_MID", &KILL_MID},
      {"KILL_TOP", &KILL_TOP},
      {"FX_FILTER_MIDS", &FX_FILTER_MIDS},
      {"FX_FILTER_TOPS", &FX_FILTER_TOPS},
      {"FX2_FILTER_TOPS", &FX2_FILTER_TOPS},
      {"FX2_FILTER_MIDS", &FX2_FILTER_MIDS},
      {"SIREN_TRIGGER", &SIREN_TRIGGER},
  };
  static constexpr int sCount = sizeof(sAll) / sizeof(sAll[0]);

  for (int i = 0; i < sCount; ++i)
    if (strcmp(sAll[i].key, name) == 0)
      return sAll[i].ref;
  return nullptr;
}

/** Safe child accessor: returns nullptr instead of crashing on missing key. */
static JSONValue *child(JSONValue *obj, const wchar_t *key) {
  if (!obj || !obj->IsObject())
    return nullptr;
  if (!obj->HasChild(key))
    return nullptr;
  return obj->Child(key);
}

/** Read a numeric child, returning defaultVal if absent or not a number. */
static double numOf(JSONValue *obj, const wchar_t *key, double defaultVal) {
  JSONValue *v = child(obj, key);
  return (v && v->IsNumber()) ? v->AsNumber() : defaultVal;
}

/** Read a bool child, returning defaultVal if absent or not a bool. */
static bool boolOf(JSONValue *obj, const wchar_t *key, bool defaultVal) {
  JSONValue *v = child(obj, key);
  return (v && v->IsBool()) ? v->AsBool() : defaultVal;
}

/**
 * Parses one clipLed entry: accepts "B5", "A6", etc., or {"port": "B", "pin":
 * 5, "activeLow": false}. Enables output mode on that pin ONLY if a valid pin
 * is defined.
 */
static void parseClipLedEntry(JSONValue *v, ClipLedRef *ref, const char *name) {
  if (!v || !ref)
    return;
  if (v->IsString()) {
    std::string s = JSON::ws2s(v->AsString());
    if (s.length() >= 2) {
      char p = (char)toupper((unsigned char)s[0]);
      int pin = s[1] - '0';
      if ((p == 'A' || p == 'B') && pin >= 0 && pin <= 7) {
        ref->pin = pin;
        ref->portB = (p == 'B');
        ref->activeLow = false;
        ref->enabled = true;
        fprintf(stderr,
                "[ConfigLoader] Clip LED %s -> Port %c, Pin %d (OUTPUT)\n",
                name, p, pin);
        return;
      }
    }
    fprintf(stderr,
            "[ConfigLoader] Clip LED %s: invalid format '%s' (expected e.g. "
            "'B5' or 'A6')\n",
            name, s.c_str());
  } else if (v->IsObject()) {
    int pin = (int)numOf(v, L"pin", -1);
    JSONValue *portVal = child(v, L"port");
    bool portB = false;
    if (portVal && portVal->IsString()) {
      std::string pStr = JSON::ws2s(portVal->AsString());
      portB = (!pStr.empty() && toupper((unsigned char)pStr[0]) == 'B');
    }
    bool activeLow = boolOf(v, L"activeLow", false);
    if (pin >= 0 && pin <= 7) {
      ref->pin = pin;
      ref->portB = portB;
      ref->activeLow = activeLow;
      ref->enabled = true;
      fprintf(stderr,
              "[ConfigLoader] Clip LED %s -> Port %c, Pin %d (OUTPUT, "
              "activeLow=%d)\n",
              name, portB ? 'B' : 'A', pin, activeLow ? 1 : 0);
      return;
    }
    fprintf(stderr, "[ConfigLoader] Clip LED %s: invalid pin %d\n", name, pin);
  }
}

/** Clamps ADC input PGA gain to the codec-supported range. */
static float clampInputGainDb(float g) {
  return std::max(kCodecInputGainMinDb, std::min(kCodecInputGainMaxDb, g));
}

/** Clamps DAC output level to the codec-supported range. */
static float clampOutputGainDb(float g) {
  return std::max(kCodecOutputGainMinDb, std::min(kCodecOutputGainMaxDb, g));
}

/** Stores a clamped ADC gain for one physical input channel. */
static void storeInputGain(int ch, float gainDb) {
  if (ch >= 0 && ch < kCodecChannels)
    CODEC_INPUT_GAIN_DB[ch] = clampInputGainDb(gainDb);
}

/** Stores a clamped DAC gain for one physical output channel. */
static void storeOutputGain(int ch, float gainDb) {
  if (ch >= 0 && ch < kCodecChannels)
    CODEC_OUTPUT_GAIN_DB[ch] = clampOutputGainDb(gainDb);
}

/**
 * Reads one routing.in entry as either a legacy number or {channel, channelR,
 * mic, hpf, gain}. Also writes CODEC_INPUT_GAIN_DB[channel] when a channel is
 * resolved.
 * @param inObj        Parent "in" object
 * @param key          Entry key (e.g. L"aux1")
 * @param channelOut   Receives the Bela left/mono channel index
 * @param channelROut  Receives the Bela right channel index (-1 = mono /
 * unused)
 * @param micOut       Receives mic flag (false when legacy number or absent)
 * @param hpfOut       Receives HPF cutoff Hz (0 when legacy / absent); may be
 * nullptr
 * @param channelDef   Default left channel if key is missing
 * @param channelRDef  Default right channel if key is missing
 * @param micDef       Default mic flag if key/field is missing
 * @param hpfDef       Default HPF Hz if key/field is missing
 * @param gainDef      Default codec gain dB if key/field is missing
 */
static void readInEntry(JSONValue *inObj, const wchar_t *key, int *channelOut,
                        int *channelROut, bool *micOut, float *hpfOut,
                        int channelDef, int channelRDef, bool micDef,
                        float hpfDef, float gainDef = 0.f) {
  *channelOut = channelDef;
  *channelROut = channelRDef;
  *micOut = micDef;
  if (hpfOut)
    *hpfOut = hpfDef;
  float gain = gainDef;

  JSONValue *v = child(inObj, key);
  if (!v) {
    if (*channelOut >= 0)
      storeInputGain(*channelOut, gain);
    if (*channelROut >= 0)
      storeInputGain(*channelROut, gain);
    return;
  }
  if (v->IsNumber()) {
    *channelOut = (int)v->AsNumber();
    *channelROut = -1;
    *micOut = false;
    if (hpfOut)
      *hpfOut = 0.f;
    storeInputGain(*channelOut, gainDef);
    return;
  }
  if (v->IsArray()) {
    const JSONArray &arr = v->AsArray();
    if (arr.size() > 0 && arr[0] && arr[0]->IsNumber())
      *channelOut = (int)arr[0]->AsNumber();
    if (arr.size() > 1 && arr[1] && arr[1]->IsNumber())
      *channelROut = (int)arr[1]->AsNumber();
    else
      *channelROut = -1;
    *micOut = false;
    if (hpfOut)
      *hpfOut = 0.f;
    if (*channelOut >= 0)
      storeInputGain(*channelOut, gainDef);
    if (*channelROut >= 0)
      storeInputGain(*channelROut, gainDef);
    return;
  }
  if (v->IsObject()) {
    JSONValue *chans = child(v, L"channels");
    if (chans) {
      if (chans->IsArray()) {
        const JSONArray &arr = chans->AsArray();
        if (arr.size() > 0 && arr[0] && arr[0]->IsNumber())
          *channelOut = (int)arr[0]->AsNumber();
        if (arr.size() > 1 && arr[1] && arr[1]->IsNumber())
          *channelROut = (int)arr[1]->AsNumber();
        else
          *channelROut = -1;
      } else if (chans->IsNumber()) {
        *channelOut = (int)chans->AsNumber();
        *channelROut = -1;
      }
    } else if (child(v, L"channel")) {
      *channelOut = (int)numOf(v, L"channel", channelDef);
      JSONValue *chR = child(v, L"channelR");
      *channelROut =
          (chR && chR->IsNumber()) ? (int)chR->AsNumber() : channelRDef;
    }
    *micOut = boolOf(v, L"mic", micDef);
    if (hpfOut)
      *hpfOut = (float)numOf(v, L"hpf", hpfDef);
    gain = (float)numOf(v, L"gain", gainDef);
  }
  if (*channelOut >= 0)
    storeInputGain(*channelOut, gain);
  if (*channelROut >= 0)
    storeInputGain(*channelROut, gain);
}

/**
 * Reads channel indices from a routing.out value.
 * Accepts: number, array of numbers, or object with "channel" / "channels".
 * @returns Number of channels written into channelsOut (0 if unusable).
 */
static int readOutChannelList(JSONValue *v, int *channelsOut, int maxCount,
                              int channelDef) {
  if (!v) {
    if (maxCount > 0) {
      channelsOut[0] = channelDef;
      return 1;
    }
    return 0;
  }
  if (v->IsNumber()) {
    if (maxCount > 0) {
      channelsOut[0] = (int)v->AsNumber();
      return 1;
    }
    return 0;
  }
  if (v->IsArray()) {
    const JSONArray &arr = v->AsArray();
    int count = 0;
    for (size_t j = 0; j < arr.size() && count < maxCount; ++j)
      if (arr[j] && arr[j]->IsNumber())
        channelsOut[count++] = (int)arr[j]->AsNumber();
    return count;
  }
  if (v->IsObject()) {
    JSONValue *chans = child(v, L"channels");
    if (chans && chans->IsArray())
      return readOutChannelList(chans, channelsOut, maxCount, channelDef);
    if (chans && chans->IsNumber()) {
      if (maxCount > 0) {
        channelsOut[0] = (int)chans->AsNumber();
        return 1;
      }
      return 0;
    }
    if (maxCount > 0) {
      channelsOut[0] = (int)numOf(v, L"channel", channelDef);
      return 1;
    }
  }
  return 0;
}

/** Reads gain dB from a routing.out value (object with "gain", else default).
 */
static float readOutGain(JSONValue *v, float gainDef) {
  if (v && v->IsObject())
    return (float)numOf(v, L"gain", gainDef);
  return gainDef;
}

/**
 * Reads one single-channel routing.out entry (legacy int or {channel|channels,
 * gain}). Updates *channelOut and CODEC_OUTPUT_GAIN_DB[*channelOut].
 */
static void readOutEntry(JSONValue *outObj, const wchar_t *key, int *channelOut,
                         int channelDef, float gainDef = 0.f) {
  JSONValue *v = child(outObj, key);
  int chans[1] = {channelDef};
  int n = readOutChannelList(v, chans, 1, channelDef);
  *channelOut = (n > 0) ? chans[0] : channelDef;
  storeOutputGain(*channelOut, readOutGain(v, gainDef));
}

/**
 * Reads routing.out.master (int, array, or {channels, gain}).
 * Updates MASTER_OUTS / MASTER_OUTS_COUNT and DAC gains for each channel.
 */
static void readMasterOutEntry(JSONValue *outObj, float gainDef = 0.f) {
  JSONValue *v = child(outObj, L"master");
  if (!v) {
    for (int i = 0; i < MASTER_OUTS_COUNT; ++i)
      storeOutputGain(MASTER_OUTS[i], gainDef);
    return;
  }
  int chans[kMasterOutsMax];
  int n = readOutChannelList(v, chans, kMasterOutsMax,
                             MASTER_OUTS_COUNT > 0 ? MASTER_OUTS[0] : 0);
  if (n > 0) {
    int validCount = 0;
    for (int i = 0; i < n; ++i) {
      if (chans[i] >= 0)
        MASTER_OUTS[validCount++] = chans[i];
    }
    if (validCount > 0)
      MASTER_OUTS_COUNT = validCount;
  }
  float gain = readOutGain(v, gainDef);
  for (int i = 0; i < MASTER_OUTS_COUNT; ++i) {
    if (MASTER_OUTS[i] >= 0)
      storeOutputGain(MASTER_OUTS[i], gain);
  }
  bool stereoDef = (MASTER_OUTS_COUNT >= 2);
  if (v->IsObject()) {
    if (child(v, L"stereo"))
      MASTER_STEREO = boolOf(v, L"stereo", stereoDef);
    else if (child(v, L"mono"))
      MASTER_STEREO = !boolOf(v, L"mono", !stereoDef);
    else
      MASTER_STEREO = stereoDef;
  } else {
    MASTER_STEREO = stereoDef;
  }
}

static bool isInherentlyCenteredPot(const std::string &name) {
  if (name.size() > 7 && name.compare(0, 3, "AUX") == 0 &&
      (name.compare(name.size() - 7, 7, "_EQ_LOW") == 0 ||
       name.compare(name.size() - 7, 7, "_EQ_MID") == 0 ||
       name.compare(name.size() - 8, 8, "_EQ_HIGH") == 0)) {
    return true;
  }
  if (name.compare(0, 4, "GEQ_") == 0) return true;
  if (name.compare(0, 6, "BTRIM_") == 0) return true;
  if (name.compare(0, 10, "MASTER_EQ_") == 0 && name.size() > 5 &&
      name.compare(name.size() - 5, 5, "_GAIN") == 0) {
    return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// ConfigLoader::load
// ---------------------------------------------------------------------------

bool ConfigLoader::load(const char *path) {
  // --- Read file ---
  std::ifstream f(path);
  if (!f.is_open()) {
    fprintf(stderr,
            "[ConfigLoader] config.json not found at %s — using hardcoded "
            "defaults\n",
            path);
    return false;
  }
  std::ostringstream ss;
  ss << f.rdbuf();
  std::string content = ss.str();

  // --- Parse ---
  JSONValue *root = JSON::Parse(content.c_str());
  if (!root || !root->IsObject()) {
    fprintf(stderr,
            "[ConfigLoader] Failed to parse %s — using hardcoded defaults\n",
            path);
    delete root;
    return false;
  }

  // --- mux ---
  JSONValue *muxObj = child(root, L"mux");
  if (muxObj) {
    int v = (int)numOf(muxObj, L"activeMux", kActiveMux);
    if (v > 0 && v <= kNumMux)
      kActiveMux = v;
  }

  // --- calibration ---
  JSONValue *calObj = child(root, L"calibration");
  if (calObj) {
    kPotScaleRecovery =
        (float)numOf(calObj, L"potScaleRecovery", kPotScaleRecovery);
    kPotMax = (float)numOf(calObj, L"potMax", kPotMax);
    kPotMin = (float)numOf(calObj, L"potMin", kPotMin);
  }

  // --- i2c ---
  JSONValue *i2cObj = child(root, L"i2c");
  if (i2cObj) {
    JSONValue *busVal = child(i2cObj, L"bus");
    if (busVal && busVal->IsString()) {
      static char sBusBuffer[64];
      std::string busStr = JSON::ws2s(busVal->AsString());
      strncpy(sBusBuffer, busStr.c_str(), sizeof(sBusBuffer) - 1);
      sBusBuffer[sizeof(sBusBuffer) - 1] = '\0';
      kI2cBus = sBusBuffer;
    }
    int addr = (int)numOf(i2cObj, L"mcpAddress", kMcpAddress);
    kMcpAddress = (uint8_t)addr;
  }

  // --- routing ---
  JSONValue *routObj = child(root, L"routing");
  if (routObj) {
    // outputs — int / array / {channel|channels, gain}; fills
    // CODEC_OUTPUT_GAIN_DB
    JSONValue *outObj = child(routObj, L"out");
    if (outObj) {
      readMasterOutEntry(outObj);
      readOutEntry(outObj, L"fx1Send", &FX1_SEND_OUT, FX1_SEND_OUT);
      readOutEntry(outObj, L"fx2Send", &FX2_SEND_OUT, FX2_SEND_OUT);
      readOutEntry(outObj, L"vuSub", &VU_SUB_OUT, VU_SUB_OUT);
      readOutEntry(outObj, L"vuKick", &VU_KICK_OUT, VU_KICK_OUT);
      readOutEntry(outObj, L"vuMid", &VU_MID_OUT, VU_MID_OUT);
      readOutEntry(outObj, L"vuTop", &VU_TOP_OUT, VU_TOP_OUT);
    }
    // inputs — {channel, channelR, mic, hpf, gain} or legacy int; fills
    // CODEC_INPUT_GAIN_DB
    JSONValue *inObj = child(routObj, L"in");
    if (inObj) {
      bool micIgnored = false;
      float hpfIgnored = 0.f;
      int chRIgnored = -1;
      readInEntry(inObj, L"fx1Return", &FX1_RETURN_IN, &chRIgnored, &micIgnored,
                  &hpfIgnored, FX1_RETURN_IN, -1, false, 0.f);
      readInEntry(inObj, L"fx2Return", &FX2_RETURN_IN, &chRIgnored, &micIgnored,
                  &hpfIgnored, FX2_RETURN_IN, -1, false, 0.f);
      readInEntry(
          inObj, L"aux1", &AUX1_CONFIG.audioIns[0], &AUX1_CONFIG.audioIns[1],
          &AUX1_CONFIG.micMode, &AUX1_CONFIG.hpfHz, AUX1_CONFIG.audioIns[0],
          AUX1_CONFIG.audioIns[1], AUX1_CONFIG.micMode, AUX1_CONFIG.hpfHz);
      readInEntry(
          inObj, L"aux2", &AUX2_CONFIG.audioIns[0], &AUX2_CONFIG.audioIns[1],
          &AUX2_CONFIG.micMode, &AUX2_CONFIG.hpfHz, AUX2_CONFIG.audioIns[0],
          AUX2_CONFIG.audioIns[1], AUX2_CONFIG.micMode, AUX2_CONFIG.hpfHz);
      readInEntry(
          inObj, L"aux3", &AUX3_CONFIG.audioIns[0], &AUX3_CONFIG.audioIns[1],
          &AUX3_CONFIG.micMode, &AUX3_CONFIG.hpfHz, AUX3_CONFIG.audioIns[0],
          AUX3_CONFIG.audioIns[1], AUX3_CONFIG.micMode, AUX3_CONFIG.hpfHz);
      readInEntry(
          inObj, L"aux4", &AUX4_CONFIG.audioIns[0], &AUX4_CONFIG.audioIns[1],
          &AUX4_CONFIG.micMode, &AUX4_CONFIG.hpfHz, AUX4_CONFIG.audioIns[0],
          AUX4_CONFIG.audioIns[1], AUX4_CONFIG.micMode, AUX4_CONFIG.hpfHz);
    }
  }

  // --- pots ---
  JSONValue *potsVal = child(root, L"pots");
  if (potsVal && potsVal->IsArray()) {
    const JSONArray &arr = potsVal->AsArray();
    for (size_t i = 0; i < arr.size(); ++i) {
      JSONValue *e = arr[i];
      if (!e || !e->IsObject())
        continue;
      JSONValue *nameVal = child(e, L"name");
      if (!nameVal || !nameVal->IsString())
        continue;

      std::string name = JSON::ws2s(nameVal->AsString());

      PotRef *g = findPotGlobalByName(name.c_str());
      if (!g)
        continue; // unknown name — skip silently

      int mux = (int)numOf(e, L"mux", g->mux);
      int pot = (int)numOf(e, L"pot", g->pot);
      if (mux < 0 || mux >= kNumMux || pot < 0 || pot >= kPotsPerMux) {
        fprintf(stderr,
                "[ConfigLoader] Pot '%s': invalid mux/pot (%d/%d) — skipped\n",
                name.c_str(), mux, pot);
        continue;
      }
      g->mux = mux;
      g->pot = pot;
      g->reversed = boolOf(e, L"reversed", g->reversed);
      bool dspCentered = isInherentlyCenteredPot(name);
      bool jsonCentered = boolOf(e, L"centered", dspCentered);
      if (jsonCentered != dspCentered) {
        fprintf(stderr,
                "[ConfigLoader] Pot '%s': overriding centered=%s -> %s (enforced by DSP semantics)\n",
                name.c_str(), jsonCentered ? "true" : "false", dspCentered ? "true" : "false");
      }
      g->centered = dspCentered;

      // Mirror the change into kAllNamedPots so getPotName() stays in sync
      PotRef *entry = findPotByName(name.c_str());
      if (entry) {
        entry->mux = g->mux;
        entry->pot = g->pot;
        entry->reversed = g->reversed;
        entry->centered = g->centered;
      }
    }
  }

  // --- switches ---
  JSONValue *swVal = child(root, L"switches");
  if (swVal && swVal->IsArray()) {
    const JSONArray &arr = swVal->AsArray();
    for (size_t i = 0; i < arr.size(); ++i) {
      JSONValue *e = arr[i];
      if (!e || !e->IsObject())
        continue;
      JSONValue *nameVal = child(e, L"name");
      if (!nameVal || !nameVal->IsString())
        continue;

      std::string name = JSON::ws2s(nameVal->AsString());

      SwitchRef *sw = findSwitchGlobalByName(name.c_str());
      if (!sw)
        continue;

      int pin = (int)numOf(e, L"pin", sw->pin);
      if (pin < 0 || pin > 7) {
        fprintf(stderr,
                "[ConfigLoader] Switch '%s': invalid pin (%d) — skipped\n",
                name.c_str(), pin);
        continue;
      }
      sw->pin = pin;
      sw->reversed = boolOf(e, L"reversed", sw->reversed);
      // "port": "A" or "B"  (falls back to current value if key absent)
      JSONValue *portVal = child(e, L"port");
      if (portVal && portVal->IsString())
        sw->portB = (JSON::ws2s(portVal->AsString()) == "B");
    }
  }

  // --- clipLeds (MCP23017 outputs) ---
  // All MCP23017 pins are inputs in read mode by default.
  // A pin is ONLY converted to output (write mode) if explicitly defined here.
  JSONValue *clipVal = child(root, L"clipLeds");
  if (clipVal && clipVal->IsObject()) {
    parseClipLedEntry(child(clipVal, L"master"), &CLIP_LED_MASTER, "MASTER");
    parseClipLedEntry(child(clipVal, L"aux1"), &CLIP_LED_AUX1, "AUX1");
    parseClipLedEntry(child(clipVal, L"aux2"), &CLIP_LED_AUX2, "AUX2");
    parseClipLedEntry(child(clipVal, L"aux3"), &CLIP_LED_AUX3, "AUX3");
    parseClipLedEntry(child(clipVal, L"aux4"), &CLIP_LED_AUX4, "AUX4");
  } else if (clipVal && clipVal->IsArray()) {
    const JSONArray &arr = clipVal->AsArray();
    for (size_t i = 0; i < arr.size(); ++i) {
      JSONValue *e = arr[i];
      if (!e || !e->IsObject())
        continue;
      JSONValue *nameVal = child(e, L"name");
      if (!nameVal || !nameVal->IsString())
        continue;
      std::string name = JSON::ws2s(nameVal->AsString());
      std::transform(name.begin(), name.end(), name.begin(),
                     [](unsigned char c) { return std::tolower(c); });
      if (name == "master" || name == "clip_master")
        parseClipLedEntry(e, &CLIP_LED_MASTER, "MASTER");
      else if (name == "aux1" || name == "clip_aux1")
        parseClipLedEntry(e, &CLIP_LED_AUX1, "AUX1");
      else if (name == "aux2" || name == "clip_aux2")
        parseClipLedEntry(e, &CLIP_LED_AUX2, "AUX2");
      else if (name == "aux3" || name == "clip_aux3")
        parseClipLedEntry(e, &CLIP_LED_AUX3, "AUX3");
      else if (name == "aux4" || name == "clip_aux4")
        parseClipLedEntry(e, &CLIP_LED_AUX4, "AUX4");
    }
  }

  // --- ignoredPots ---
  JSONValue *ignVal = child(root, L"ignoredPots");
  if (ignVal && ignVal->IsArray()) {
    const JSONArray &arr = ignVal->AsArray();
    int count = 0;
    for (size_t i = 0; i < arr.size() && count < kIgnoredPotsMax; ++i) {
      JSONValue *e = arr[i];
      if (!e)
        continue;
      if (e->IsString()) {
        std::string name = JSON::ws2s(e->AsString());
        PotRef *p = findPotByName(name.c_str());
        if (!p)
          p = findPotGlobalByName(name.c_str());
        if (p) {
          kIgnoredPots[count].mux = p->mux;
          kIgnoredPots[count].pot = p->pot;
          kIgnoredPots[count].name = p->name;
          ++count;
        }
        continue;
      }
      if (!e->IsObject())
        continue;
      if (e->HasChild(L"mux") && e->HasChild(L"pot")) {
        int mux = (int)numOf(e, L"mux", 0);
        int pot = (int)numOf(e, L"pot", 0);
        kIgnoredPots[count].mux = mux;
        kIgnoredPots[count].pot = pot;
        kIgnoredPots[count].name = getPotName(mux, pot);
        ++count;
      } else if (e->HasChild(L"name")) {
        JSONValue *nv = child(e, L"name");
        if (nv && nv->IsString()) {
          std::string name = JSON::ws2s(nv->AsString());
          PotRef *p = findPotByName(name.c_str());
          if (!p)
            p = findPotGlobalByName(name.c_str());
          if (p) {
            kIgnoredPots[count].mux = p->mux;
            kIgnoredPots[count].pot = p->pot;
            kIgnoredPots[count].name = p->name;
            ++count;
          }
        }
      }
    }
    kIgnoredPotsCount = count;
  }

  delete root;
  fprintf(stderr, "[ConfigLoader] Loaded %s\n", path);
  return true;
}
