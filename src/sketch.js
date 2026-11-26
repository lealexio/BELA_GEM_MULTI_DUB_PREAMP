/* AUTO-GENERATED — edit gui/, run: npm run build:gui */
/**
 * Dub Preamp — Bela GUI (sketch.js)
 *
 * Runs at http://bela.local/gui/  (Bela GUI library, p5.js instance mode).
 *
 * Buffer index convention (Bela → JS, via gGui.sendBuffer):
 *   [0] Float32[60]      — pot values, kAllNamedPots order
 *   [1] Float32[9]       — switch states (0/1)
 *   [2] Float32[3]       — siren: [presetIdx, gate, mod]
 *   [3] Float32[13]      — audio peak levels
 *   [4] Float32[60×4]    — pot mapping [mux,pot,rev,cen]×60
 *   [5] Float32[9×3]     — switch mapping [pin,portB,rev]×9
 *   [6] Float32[N]       — config metadata (mux, routing, ignoredPots)
 *   [7] Float32[80]      — raw MUX grid [mux×10+pot], normalised 0–1 (unmapped discovery)
 *   [8] Float32[20]      — codec gains: [0..9]=ADC input by physical ch, [10..19]=DAC out by physical ch
 *   [9] Float32[1]       — CPU temperature °C (sysfs thermal_zone0, ~2 s poll)
 *   [10] Float32[5]      — sampler: [folderOk, count, playingSlot, isPlaying, playhead]
 *   [11] Float32[32×64]  — sampler filenames packed as ASCII floats (fixed width)
 *   [12] Float32[10]     — digital FX state: [subPeak, echuPeak, aux1-4 sends 1-2 routing]
 */

var __belaPreampSketch = (() => {
  var __defProp = Object.defineProperty;
  var __defProps = Object.defineProperties;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropDescs = Object.getOwnPropertyDescriptors;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __getOwnPropSymbols = Object.getOwnPropertySymbols;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __propIsEnum = Object.prototype.propertyIsEnumerable;
  var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
  var __spreadValues = (a, b) => {
    for (var prop in b || (b = {}))
      if (__hasOwnProp.call(b, prop))
        __defNormalProp(a, prop, b[prop]);
    if (__getOwnPropSymbols)
      for (var prop of __getOwnPropSymbols(b)) {
        if (__propIsEnum.call(b, prop))
          __defNormalProp(a, prop, b[prop]);
      }
    return a;
  };
  var __spreadProps = (a, b) => __defProps(a, __getOwnPropDescs(b));
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // gui/main.js
  var main_exports = {};
  __export(main_exports, {
    default: () => sketch
  });

  // gui/config.js
  var TAB_LIVE = 0;
  var TAB_FX = 1;
  var TAB_MAPPING = 3;
  var FX_DEST_HARDWARE = 0;
  var FX_DEST_SUB_ROAR = 1;
  var FX_DEST_ECHO_DUB = 2;
  var FX_DEST_TUBBY_SPRING = 3;
  var FX_DEST_BLACK_ARK = 4;
  var FX_DEST_TAPE_DRIVE = 5;
  var FX_DEST_SHIMMER_DELAY = 6;
  var FX_DEST_MUTE = 7;
  var SUB_ROAR_DEFAULTS = {
    tune: 45,
    drive: 0.45,
    decay: 850,
    cutoff: 80,
    level: 1,
    enabled: true
  };
  var ECHO_DUB_DEFAULTS = {
    time: 375,
    feedback: 0.65,
    tone: 2800,
    flutter: 0.2,
    level: 0.75,
    kill: false,
    enabled: true
  };
  var TUBBY_SPRING_DEFAULTS = {
    dwell: 0.65,
    decay: 0.7,
    tone: 3200,
    level: 0.85,
    enabled: true
  };
  var BLACK_ARK_DEFAULTS = {
    rate: 0.25,
    depth: 0.75,
    feedback: 0.6,
    stages: 6,
    level: 0.8,
    enabled: true
  };
  var TAPE_DRIVE_DEFAULTS = {
    drive: 0.35,
    warmth: 11e3,
    asymmetry: 0.3,
    level: 1,
    enabled: true
  };
  var SHIMMER_DELAY_DEFAULTS = {
    semitones: 12,
    delayTime: 375,
    feedback: 0.55,
    grainSize: 50,
    level: 0.75,
    enabled: true
  };
  var DUB_DUCKER_DEFAULTS = {
    threshold: 0.08,
    releaseMs: 350,
    duckAmount: 0.75,
    source: 0,
    // 0: Siren, 1: Mic, 2: Master, 3: All
    enabled: true
  };
  var LIVE_TILES = [
    { id: "siren", label: "Siren", pair: true, defaultOn: true },
    { id: "mic", label: "Mic inputs", pair: true, defaultOn: true },
    { id: "sampler", label: "Sampler", pair: false, defaultOn: true },
    { id: "meters", label: "VU meters", pair: false, defaultOn: true },
    { id: "switches", label: "Switches", pair: false, defaultOn: false },
    { id: "console", label: "Console", pair: false, defaultOn: false },
    { id: "masterEq", label: "Master EQ", pair: false, defaultOn: false }
  ];
  var MAX_SAMPLES = 32;
  var MAX_SAMPLE_NAME_LEN = 64;
  var SAMPLER_PAD_LABEL_LEN = 20;
  var LIVE_LAYOUT_STORAGE_KEY_V1 = "belaDubPreamp.liveLayout.v1";
  var LIVE_LAYOUT_STORAGE_KEY = "belaDubPreamp.liveLayout.v2";
  var THEME_STORAGE_KEY = "belaDubPreamp.theme";
  var DETECT_POT_MIN_DELTA = 0.25;
  var MUX_POTS_PER_MUX = 10;
  var MUX_RAW_SIZE = 80;
  var CONSOLE_POT_MIN_DELTA_DETAILED = 3e-3;
  var CONSOLE_POT_MIN_DELTA_NORMAL = 0.025;
  var BELA_OFFLINE_TIMEOUT_MS = 2e3;
  var BELA_LAG_THRESHOLD_MS = 500;
  var BELA_LAG_HOLD_MS = 500;
  var CPU_TEMP_WARM_C = 65;
  var CPU_TEMP_HOT_C = 75;
  var SIREN_PRESETS = ["Wail", "Whoop", "Police", "Scanner", "Riotgun", "Laser"];
  var POT_NAMES = [
    // AUX1 — idx 0-5
    "AUX1_INPUT_GAIN",
    "AUX1_EQ_MID",
    "AUX1_EQ_LOW",
    "AUX1_EQ_HIGH",
    "AUX1_FX_SEND",
    "AUX1_FX2_SEND",
    // AUX2 — idx 6-11
    "AUX2_INPUT_GAIN",
    "AUX2_EQ_MID",
    "AUX2_EQ_HIGH",
    "AUX2_EQ_LOW",
    "AUX2_FX_SEND",
    "AUX2_FX2_SEND",
    // AUX3 — idx 12-17
    "AUX3_INPUT_GAIN",
    "AUX3_EQ_LOW",
    "AUX3_EQ_MID",
    "AUX3_EQ_HIGH",
    "AUX3_FX_SEND",
    "AUX3_FX2_SEND",
    // AUX4 — idx 18-23
    "AUX4_INPUT_GAIN",
    "AUX4_EQ_LOW",
    "AUX4_EQ_MID",
    "AUX4_EQ_HIGH",
    "AUX4_FX_SEND",
    "AUX4_FX2_SEND",
    // Master — idx 24
    "MASTER_GAIN",
    // Parametric EQ — idx 25-32
    "MASTER_EQ_SUB_FREQ",
    "MASTER_EQ_SUB_GAIN",
    "MASTER_EQ_KICK_FREQ",
    "MASTER_EQ_KICK_GAIN",
    "MASTER_EQ_MID_FREQ",
    "MASTER_EQ_MID_GAIN",
    "MASTER_EQ_TOP_FREQ",
    "MASTER_EQ_TOP_GAIN",
    // Filters — idx 33-36
    "MASTER_HPF_FREQ",
    "MASTER_HPF_RES",
    "MASTER_LPF_FREQ",
    "MASTER_LPF_RES",
    // Band Trim — idx 37-40
    "BTRIM_SUB",
    "BTRIM_KICK",
    "BTRIM_MID",
    "BTRIM_TOP",
    // Siren — idx 41-45
    "SIREN_TYPE",
    "SIREN_MOD",
    "SIREN_GAIN",
    "SIREN_FX_SEND",
    "SIREN_FX2_SEND",
    // Graphic EQ 12 bands — idx 46-57
    "GEQ_40HZ",
    "GEQ_60HZ",
    "GEQ_80HZ",
    "GEQ_100HZ",
    "GEQ_125HZ",
    "GEQ_250HZ",
    "GEQ_500HZ",
    "GEQ_1KHZ",
    "GEQ_2KHZ",
    "GEQ_4KHZ",
    "GEQ_8KHZ",
    "GEQ_16KHZ",
    // FX return gains — idx 58-59
    "FX1_RETURN_GAIN",
    "FX2_RETURN_GAIN"
  ];
  function isPotCentered(name) {
    if (!name) return false;
    if (/^AUX\d_EQ_(LOW|MID|HIGH)$/.test(name)) return true;
    if (name.startsWith("GEQ_")) return true;
    if (name.startsWith("BTRIM_")) return true;
    if (/^MASTER_EQ_.*_GAIN$/.test(name)) return true;
    return false;
  }
  function getPotDevDefault(name) {
    if (!name) return 0;
    if (/^AUX\d_INPUT_GAIN$/.test(name)) return 0.5;
    if (name === "SIREN_GAIN") return 0.5;
    if (name === "MASTER_GAIN") return 0.05;
    if (isPotCentered(name)) return 0.5;
    return 0;
  }
  var SWITCH_NAMES = [
    "KILL_SUB",
    "KILL_KICK",
    "KILL_MID",
    "KILL_TOP",
    "FX_FILTER_MIDS",
    "FX_FILTER_TOPS",
    "FX2_FILTER_TOPS",
    "FX2_FILTER_MIDS",
    "SIREN_TRIGGER"
  ];
  var SWITCH_GROUPS = [
    { label: "Band kill", type: "kill", indices: [0, 1, 2, 3] },
    { label: "FX send filter", type: "fx", indices: [4, 5, 6, 7] },
    { label: "Siren", type: "siren", indices: [8] }
  ];
  var I2C_BUS = "/dev/i2c-1";
  var CONFIG_META = {
    ACTIVE_MUX: 0,
    SCALE: 1,
    POT_MAX: 2,
    POT_MIN: 3,
    MCP_ADDR: 4,
    MASTER_COUNT: 5,
    MASTER_0: 6,
    MASTER_1: 7,
    FX1_SEND: 8,
    FX2_SEND: 9,
    VU_SUB: 10,
    VU_KICK: 11,
    VU_MID: 12,
    VU_TOP: 13,
    FX1_RET: 14,
    FX2_RET: 15,
    AUX1: 16,
    AUX2: 17,
    AUX3: 18,
    AUX4: 19,
    MIC_AUX1: 20,
    MIC_AUX2: 21,
    MIC_AUX3: 22,
    MIC_AUX4: 23,
    HPF_AUX1: 24,
    HPF_AUX2: 25,
    HPF_AUX3: 26,
    HPF_AUX4: 27,
    AUX1_R: 28,
    AUX2_R: 29,
    AUX3_R: 30,
    AUX4_R: 31,
    MASTER_STEREO: 32,
    UI_DEV_MODE: 33,
    IGNORED_COUNT: 34,
    IGNORED_BASE: 35,
    DEV_MODE_BOOT: 99,
    CLIP_LED_BASE: 100
  };
  var CLIP_LED_KEYS = ["master", "aux1", "aux2", "aux3", "aux4"];
  var CLIP_LED_LABELS = {
    master: "Master",
    aux1: "AUX 1",
    aux2: "AUX 2",
    aux3: "AUX 3",
    aux4: "AUX 4"
  };
  function decodeClipLedMeta(val) {
    const v = Math.round(val);
    if (isNaN(v) || v < 0) {
      return { enabled: false, port: "A", pin: 0, activeLow: false };
    }
    return {
      enabled: true,
      port: v & 8 ? "B" : "A",
      pin: v & 7,
      activeLow: !!(v & 16)
    };
  }
  function parseClipLedConfigEntry(val) {
    if (typeof val === "string" && val.length >= 2) {
      const port = val[0].toUpperCase();
      const pin = parseInt(val.slice(1), 10);
      if ((port === "A" || port === "B") && !isNaN(pin) && pin >= 0 && pin <= 7) {
        return { enabled: true, port, pin, activeLow: false };
      }
    } else if (val && typeof val === "object") {
      const pin = parseInt(val.pin, 10);
      const port = String(val.port || (val.portB ? "B" : "A")).toUpperCase().startsWith("B") ? "B" : "A";
      if (!isNaN(pin) && pin >= 0 && pin <= 7) {
        return { enabled: true, port, pin, activeLow: !!val.activeLow };
      }
    }
    return { enabled: false, port: "A", pin: 0, activeLow: false };
  }
  function serializeClipLedEntry(entry) {
    if (!entry || !entry.enabled) return null;
    const port = entry.port === "B" ? "B" : "A";
    const pin = Math.max(0, Math.min(7, Math.round(Number(entry.pin) || 0)));
    if (entry.activeLow) {
      return { port, pin, activeLow: true };
    }
    return `${port}${pin}`;
  }
  var MIC_HPF_HZ_MIN = 0;
  var MIC_HPF_HZ_MAX = 300;
  var MASTER_EQ_CONFIG = {
    SAMPLE_RATE: 44100,
    FREQ_MIN: 20,
    FREQ_MAX: 2e4,
    CURVE_POINTS: 200,
    Y_MIN_DB: -18,
    Y_MAX_DB: 18,
    GAIN_EPSILON_DB: 0.05,
    FILTER_ON_THRESHOLD: 0.012,
    FILTER_OFF_THRESHOLD: 8e-3,
    POT_EPSILON: 4e-3,
    POT: {
      PE_SUB_FREQ: 25,
      PE_SUB_GAIN: 26,
      PE_KICK_FREQ: 27,
      PE_KICK_GAIN: 28,
      PE_MID_FREQ: 29,
      PE_MID_GAIN: 30,
      PE_TOP_FREQ: 31,
      PE_TOP_GAIN: 32,
      HPF_FREQ: 33,
      HPF_RES: 34,
      LPF_FREQ: 35,
      LPF_RES: 36,
      BTRIM_SUB: 37,
      BTRIM_KICK: 38,
      BTRIM_MID: 39,
      BTRIM_TOP: 40,
      GEQ_BASE: 46
    },
    KILL_SWITCH: { SUB: 0, KICK: 1, MID: 2, TOP: 3 },
    MASTER_EQ_GAIN_RANGE_DB: 6,
    MASTER_EQ_Q: 0.8,
    MASTER_EQ_FMIN: [20, 80, 200, 1200],
    MASTER_EQ_FMAX: [80, 200, 1200, 16e3],
    GEQ_FREQS: [40, 60, 80, 100, 125, 250, 500, 1e3, 2e3, 4e3, 8e3, 16e3],
    GEQ_GAIN_RANGE_DB: 12,
    GEQ_Q: 1.41,
    HPF_FMIN: 20,
    HPF_FMAX: 2e3,
    LPF_FMIN: 200,
    LPF_FMAX: 2e4,
    FILTER_QMIN: 0.7,
    FILTER_QMAX: 4.5,
    BAND_TRIM_GAIN_DB: 6,
    BAND_TRIM_KICK_FREQ: 126,
    BAND_TRIM_MID_FREQ: 490,
    BAND_TRIM_KICK_Q: 1,
    BAND_TRIM_MID_Q: 0.7,
    KILL_FC: [80, 200, 1200],
    KILL_CROSSOVER_Q: 0.707,
    KILL_FILTER_STAGES: 2
  };
  var masterEqFreqs = (function() {
    const n = MASTER_EQ_CONFIG.CURVE_POINTS;
    const fMin = MASTER_EQ_CONFIG.FREQ_MIN;
    const fMax = MASTER_EQ_CONFIG.FREQ_MAX;
    const logMin = Math.log10(fMin);
    const logMax = Math.log10(fMax);
    const out = new Float32Array(n);
    for (let i = 0; i < n; i++)
      out[i] = Math.pow(10, logMin + (logMax - logMin) * i / (n - 1));
    return out;
  })();
  var MASTER_EQ_FREQ_TICKS = [20, 50, 100, 200, 500, 1e3, 2e3, 5e3, 1e4, 2e4];
  var METER_ATTACK = 0.55;
  var METER_RELEASE = 0.12;
  var PEAK_HOLD_MS = 750;
  var PEAK_DECAY = 0.94;
  var CLIP_THRESHOLD = 0.9441;
  var CLIP_HOLD_MS = 1500;
  var VU_BOX_COUNT = 30;
  var VU_BOX_COUNT_RED = 4;
  var VU_BOX_COUNT_YELLOW = 6;
  var VU_BOX_GAP_FRACTION = 0.25;
  var VU_MAX = 100;
  var VU_CANVAS_W = 300;
  var VU_CANVAS_H = 26;
  var VU_SCALE_TICKS = [-60, -40, -20, -6, 0];
  var MAX_CONSOLE = 10;
  var ROUTING_KEY_TO_BUFFER3 = {
    aux1: 0,
    aux2: 1,
    aux3: 2,
    aux4: 3,
    fx1Return: 4,
    fx2Return: 5,
    master: 6,
    fx1Send: 7,
    fx2Send: 8,
    vuSub: 9,
    vuKick: 10,
    vuMid: 11,
    vuTop: 12
  };
  function buildFullRouting(routing) {
    const toLabel = (key) => key.toUpperCase();
    const toPhysical = (val) => {
      if (val != null && typeof val === "object" && !Array.isArray(val)) {
        if (Array.isArray(val.channels) && val.channels.length)
          return val.channels[0];
        return val.channel;
      }
      return Array.isArray(val) ? val[0] : val;
    };
    const toGain = (val) => {
      if (val != null && typeof val === "object" && !Array.isArray(val)) {
        const g = Number(val.gain);
        return isNaN(g) ? 0 : g;
      }
      return 0;
    };
    const inEntries = Object.entries(routing.in || {});
    const outEntries = Object.entries(routing.out || {});
    const levelGroups = [
      {
        label: "INPUTS",
        indices: inEntries.map(([k]) => ROUTING_KEY_TO_BUFFER3[k]).filter((i) => i !== void 0)
      },
      {
        label: "OUTPUTS",
        indices: outEntries.map(([k]) => ROUTING_KEY_TO_BUFFER3[k]).filter((i) => i !== void 0)
      }
    ];
    const levelLabels = {};
    [...inEntries, ...outEntries].forEach(([key]) => {
      const idx = ROUTING_KEY_TO_BUFFER3[key];
      if (idx !== void 0) levelLabels[idx] = toLabel(key);
    });
    const inputChannels = inEntries.map(([key, val]) => ({
      key,
      ch: toPhysical(val),
      label: toLabel(key),
      buf3: ROUTING_KEY_TO_BUFFER3[key],
      gain: toGain(val)
    }));
    const outputChannels = outEntries.map(([key, val]) => ({
      key,
      ch: toPhysical(val),
      label: toLabel(key),
      buf3: ROUTING_KEY_TO_BUFFER3[key],
      gain: toGain(val)
    }));
    return { levelGroups, levelLabels, inputChannels, outputChannels };
  }

  // gui/state.js
  function createState() {
    const echoDubState = __spreadValues({}, ECHO_DUB_DEFAULTS);
    return {
      potValues: new Float32Array(60),
      switchStates: new Float32Array(9),
      sirenState: new Float32Array(3),
      samplerState: new Float32Array(5),
      samplerStateLive: false,
      samplerNamesBuf: null,
      samplerNames: [],
      samplerNamesBuilt: false,
      samplerButtons: [],
      samplerHighlight: -1,
      samplerListEl: null,
      samplerEmptyEl: null,
      audioLevels: new Float32Array(13),
      fxState: new Float32Array(17),
      fxRouting: [
        [0, 0],
        // AUX 1 [Send 1, Send 2]
        [0, 0],
        // AUX 2 [Send 1, Send 2]
        [0, 0],
        // AUX 3 [Send 1, Send 2]
        [0, 0],
        // AUX 4 [Send 1, Send 2]
        [0, 0]
        // SIREN [Send 1, Send 2]
      ],
      subRoar: __spreadValues({}, SUB_ROAR_DEFAULTS),
      echoDub: echoDubState,
      echuDub: echoDubState,
      // backward-compat alias
      tubbySpring: __spreadValues({}, TUBBY_SPRING_DEFAULTS),
      blackArk: __spreadValues({}, BLACK_ARK_DEFAULTS),
      tapeDrive: __spreadValues({}, TAPE_DRIVE_DEFAULTS),
      shimmerDelay: __spreadValues({}, SHIMMER_DELAY_DEFAULTS),
      dubDucker: __spreadValues({}, DUB_DUCKER_DEFAULTS),
      fxSubMeterEl: null,
      fxDubMeterEl: null,
      fxSpringMeterEl: null,
      fxPhaserMeterEl: null,
      fxTapeMeterEl: null,
      fxShimmerMeterEl: null,
      fxDuckerMeterEl: null,
      fxRouteSelects: [],
      fxTriggers: [
        [false, false],
        [false, false],
        [false, false],
        [false, false],
        [false, false]
      ],
      fxMomentaryTriggers: [
        [false, false],
        [false, false],
        [false, false],
        [false, false],
        [false, false]
      ],
      fxLatchedTriggers: [
        [false, false],
        [false, false],
        [false, false],
        [false, false],
        [false, false]
      ],
      fxTestTone: false,
      fxTriggerButtons: [],
      fxLatchButtons: [],
      potMapping: null,
      switchMapping: null,
      configMeta: null,
      muxRawValues: null,
      meterSmooth: new Float32Array(13).fill(0),
      peakHoldLevel: new Float32Array(13).fill(0),
      peakHoldExpire: new Float64Array(13).fill(0),
      clipHoldUntil: new Float64Array(13).fill(0),
      meterAnimId: null,
      meterVu: [],
      meterPeakDbs: [],
      meterClipLeds: [],
      recentChanges: [],
      prevPotValues: new Float32Array(60).fill(-1),
      prevPotValuesNormal: new Float32Array(60).fill(-1),
      prevSwitchStates: new Float32Array(9).fill(-1),
      prevMuxRawValues: null,
      prevMuxRawValuesNormal: null,
      consoleReady: false,
      consoleFilterMode: "normal",
      currentTab: 0,
      mappingBuilt: false,
      mappingSubTab: "controls",
      mappingFilter: "all",
      mappingSearch: "",
      mappingGuided: null,
      routingFilledFromMeta: false,
      detectMode: null,
      masterEqCurveDb: new Float32Array(MASTER_EQ_CONFIG.CURVE_POINTS),
      sirenPresetPills: [],
      sirenNameEl: null,
      sirenGateEl: null,
      sirenModFill: null,
      sirenModLbl: null,
      downloadStatusEl: null,
      detectStatusEl: null,
      liveLayoutPrefs: null,
      masterEqTargets: [],
      consoleLists: [],
      lastBelaRxMs: 0,
      belaRxFingerprint: "",
      belaConnState: "offline",
      belaLastLagMs: 0,
      belaRxPackets: 0,
      uiDevMode: false,
      devInteractingPot: -1,
      devControlInitialized: false,
      boardConfigJson: null,
      boardConfigRawText: null,
      loadedConfigBase: null,
      mappingDirty: false,
      mappingActionBusy: false,
      awaitingRestartReconnect: false,
      devModeBoot: false,
      clipLedsConfig: {
        master: { enabled: false, port: "A", pin: 0, activeLow: false },
        aux1: { enabled: false, port: "A", pin: 0, activeLow: false },
        aux2: { enabled: false, port: "A", pin: 0, activeLow: false },
        aux3: { enabled: false, port: "A", pin: 0, activeLow: false },
        aux4: { enabled: false, port: "A", pin: 0, activeLow: false }
      }
    };
  }

  // gui/context.js
  var _ctx = null;
  function initContext(state) {
    _ctx = state;
  }
  function getContext() {
    if (!_ctx) throw new Error("GUI context not initialised");
    return _ctx;
  }

  // gui/css.js
  function injectCSS() {
    const s = document.createElement("style");
    s.textContent = `
:root{
--bg:#eef0f3;
--bg-elev:#ffffff;
--surface:#f5f6f8;
--ink:#151922;
--ink-soft:#3d4452;
--muted:#646c7a;
--line:#dce0e6;
--line-soft:#eaedf1;
--accent:#d94336;
--ok:#1f9d55;
--warn:#d97706;
--danger:#dc2626;
--info:#2563eb;
--focus-ring:#2563eb;
--header-bg:#141821;
--btn-active-bg:#151922;
--btn-active-text:#ffffff;
--bar-fill:#2563eb;
--input-bg:#ffffff;
--input-border:#cfd5de;
--radius:10px;
--radius-sm:6px;
--shadow:0 1px 2px rgba(15,23,42,.04),0 2px 8px rgba(15,23,42,.04);
--z-chrome:100;
--z-popup:200;
--font:ui-sans-serif,system-ui,-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;
--mono:ui-monospace,'Cascadia Mono','SF Mono',Menlo,Consolas,monospace;
}

[data-theme="dark"]{
--bg:#0d1016;
--bg-elev:#141922;
--surface:#1b222d;
--ink:#edf1f7;
--ink-soft:#b9c2d0;
--muted:#848e9d;
--line:#283140;
--line-soft:#1e2531;
--accent:#ef5347;
--ok:#22c55e;
--warn:#f59e0b;
--danger:#ef4444;
--info:#3b82f6;
--focus-ring:#60a5fa;
--header-bg:#090c11;
--btn-active-bg:#3b82f6;
--btn-active-text:#ffffff;
--bar-fill:#3b82f6;
--input-bg:#11161f;
--input-border:#2d3748;
--shadow:0 1px 3px rgba(0,0,0,.35),0 4px 12px rgba(0,0,0,.25);
}

*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html,body{
width:100%;height:100%;
margin:0;padding:0;
overflow:hidden;
}
body{
font-family:var(--font);
background:var(--bg);color:var(--ink);font-size:14px;
line-height:1.4;
-webkit-font-smoothing:antialiased;
text-rendering:optimizeLegibility;
}
/* p5.js injects <main> + canvas \u2014 hidden */
body > main{
display:none!important;visibility:hidden!important;
width:0!important;height:0!important;overflow:hidden!important;
position:absolute!important;pointer-events:none!important;
}

button,input,select{font-family:inherit}
button:focus-visible,input:focus-visible,select:focus-visible,[tabindex]:focus-visible{
outline:2px solid var(--focus-ring);outline-offset:2px;
}

#bela-gui{
display:flex;flex-direction:column;
width:100%;max-width:100%;
height:100dvh;overflow:hidden;
}

/* --- Top chrome --- */
#top-chrome{
flex-shrink:0;position:relative;z-index:var(--z-chrome);
padding-top:env(safe-area-inset-top);
background:var(--header-bg);
}
#gui-header{
background:var(--header-bg);color:#fff;
padding:8px 16px;
padding-left:max(16px,env(safe-area-inset-left));
padding-right:max(16px,env(safe-area-inset-right));
display:flex;align-items:center;gap:8px;flex-wrap:wrap;
width:100%;min-height:46px;
}
#gui-header .spacer{flex:1;min-width:8px}
#gui-logo{
height:34px;width:auto;
mix-blend-mode:screen;opacity:.92;flex-shrink:0;
}
.badge{
background:#4b5563;color:#fff;font-size:10px;font-weight:700;
padding:3px 8px;border-radius:999px;letter-spacing:.05em;
line-height:1.2;white-space:nowrap;
}
.badge.live{background:var(--ok)}
.badge.lag{background:var(--warn);color:#111}
.badge.temp{
background:#1d4ed8;font-variant-numeric:tabular-nums;
letter-spacing:.02em;min-width:3.6em;text-align:center;
}
.badge.temp.warm{background:var(--warn);color:#111}
.badge.temp.hot{background:var(--danger)}
.badge.temp.unknown{background:#4b5563}
.badge.dev-badge{
display:none;background:#0369a1;color:#fff;letter-spacing:.05em;
}
.badge.dev-badge.visible{display:inline-block}
.clip-badges{
display:flex;align-items:center;gap:5px;flex-wrap:wrap;min-width:0;
}
.badge.clip{
display:none;background:var(--danger);letter-spacing:.04em;
}
.badge.clip.on{display:inline-block}

/* --- Tab bar --- */
#tab-bar{
display:flex;align-items:center;
background:var(--bg-elev);
border-bottom:1px solid var(--line);
width:100%;
padding:0 8px;
padding-left:max(8px,env(safe-area-inset-left));
padding-right:max(8px,env(safe-area-inset-right));
overflow-x:auto;scrollbar-width:none;
}
#tab-bar::-webkit-scrollbar{display:none}
.tab-btn{
flex-shrink:0;
padding:11px 16px;min-height:42px;
font-size:13px;font-weight:600;color:var(--muted);
cursor:pointer;border:none;background:none;
border-bottom:2px solid transparent;
white-space:nowrap;letter-spacing:.01em;
transition:color .12s ease,border-color .12s ease;
}
.tab-btn:hover{color:var(--ink)}
.tab-btn.active{color:var(--ink);border-bottom-color:var(--accent)}
.tab-bar-spacer{flex:1;min-width:8px}

.theme-toggle-btn,.live-layout-gear{
flex-shrink:0;height:32px;padding:0 10px;margin-left:4px;
font-size:12px;font-weight:600;color:var(--muted);
cursor:pointer;border:1px solid transparent;border-radius:var(--radius-sm);
background:transparent;display:inline-flex;align-items:center;gap:6px;
user-select:none;white-space:nowrap;
transition:color .12s ease,background .12s ease,border-color .12s ease;
}
.theme-toggle-btn:hover,.live-layout-gear:hover{
color:var(--ink);background:var(--surface);border-color:var(--line);
}
.live-layout-gear.active{
color:var(--btn-active-text);background:var(--btn-active-bg);border-color:var(--btn-active-bg);
}

/* --- Main scroll container --- */
#tab-content{
flex:1;min-height:0;overflow-y:auto;overflow-x:hidden;
padding:16px;
padding-left:max(16px,env(safe-area-inset-left));
padding-right:max(16px,env(safe-area-inset-right));
padding-bottom:calc(20px + env(safe-area-inset-bottom));
}
.tab-pane{display:none;max-width:1180px;margin:0 auto}
.tab-pane.active{display:block}

/* --- Shared Cards --- */
.card{
background:var(--bg-elev);border-radius:var(--radius);
border:1px solid var(--line);box-shadow:var(--shadow);
padding:14px 16px;margin-bottom:12px;
}
.card-header-row{
display:flex;align-items:center;justify-content:space-between;
gap:10px;margin-bottom:12px;flex-wrap:wrap;
}
.card-header-row .card-title{margin-bottom:0}
.card-title{
font-size:11px;font-weight:700;letter-spacing:.08em;
text-transform:uppercase;color:var(--ink-soft);margin-bottom:12px;
text-wrap:balance;
}
.card-meta{
font-size:11px;font-weight:600;color:var(--muted);
}

/* --- Live Board & Grid --- */
#live-board{display:flex;flex-direction:column;gap:12px}
#live-board > .card,
#live-board > #meters-wrap,
#live-board > #live-grid{margin-bottom:0}
#live-grid{display:grid;grid-template-columns:1fr;gap:12px}
#live-grid > .card{margin-bottom:0;display:flex;flex-direction:column}
@media(min-width:640px){
#live-grid{grid-template-columns:1fr 1fr;align-items:stretch}
#live-grid.live-grid-single{grid-template-columns:1fr}
#live-grid > .card{height:100%}
#live-grid #siren-body,
#live-grid #mic-inputs-card .mic-live-list{flex:1}
}

/* --- Siren --- */
#siren-body{display:flex;flex-direction:column;gap:12px}
#siren-hero{
background:var(--surface);border-radius:8px;padding:12px 14px;
border:1px solid var(--line-soft);border-left:3px solid var(--accent);
}
#siren-hero-top{display:flex;align-items:center;justify-content:space-between;gap:10px}
#siren-name{font-size:17px;font-weight:700;color:var(--ink);line-height:1.2}
#siren-gate{display:flex;align-items:center;gap:6px;flex-shrink:0}
#siren-gate-dot{
display:inline-block;width:9px;height:9px;border-radius:50%;
background:var(--muted);transition:background .1s ease;
}
#siren-gate-dot.on{background:var(--accent)}
.gate-lbl{font-size:11px;font-weight:700;color:var(--muted);letter-spacing:.04em;text-transform:uppercase}
#siren-mod-row{display:flex;align-items:center;gap:10px;margin-top:10px}
.siren-mod-label{
flex:0 0 auto;font-size:10px;font-weight:700;color:var(--muted);
letter-spacing:.05em;text-transform:uppercase;
}
#siren-mod-track{
flex:1;height:6px;background:var(--line);border-radius:3px;overflow:hidden;min-width:0;
}
#siren-mod-fill{
display:block;height:100%;width:0%;background:var(--bar-fill);
border-radius:3px;transition:width .05s linear;
}
#siren-mod-lbl{
flex:0 0 38px;font-size:11px;font-weight:700;color:var(--muted);
font-family:var(--mono);font-variant-numeric:tabular-nums;text-align:right;
}
#siren-presets{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:5px;width:100%}
.spreset{
padding:8px 4px;border-radius:var(--radius-sm);
background:var(--surface);border:1px solid var(--line);
font-size:10px;font-weight:700;color:var(--muted);
text-align:center;line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
transition:background .12s ease,color .12s ease,border-color .12s ease;
}
.spreset.active{
background:var(--btn-active-bg);border-color:var(--btn-active-bg);color:var(--btn-active-text);
}
.spreset.active.gate{background:var(--accent);border-color:var(--accent);color:#fff}

/* --- Mic inputs --- */
#mic-inputs-card{margin:0;max-width:100%;display:flex;flex-direction:column}
.mic-live-list{display:flex;flex-direction:column;gap:6px}
.mic-live-row{
display:flex;align-items:center;gap:10px;flex-wrap:wrap;
padding:8px 10px;background:var(--surface);border:1px solid var(--line);border-radius:8px;
}
.mic-live-label{
font-weight:700;font-size:12px;min-width:42px;letter-spacing:.04em;color:var(--ink);
}
.mic-toggle{
display:inline-flex;align-items:center;gap:8px;cursor:pointer;user-select:none;min-height:28px;
}
.mic-toggle-input{position:absolute;opacity:0;width:0;height:0;pointer-events:none}
.mic-toggle-track{
position:relative;display:inline-block;width:36px;height:20px;
background:var(--muted);border-radius:999px;transition:background .15s ease;flex-shrink:0;
}
.mic-toggle-thumb{
position:absolute;top:2px;left:2px;width:16px;height:16px;
background:#fff;border-radius:50%;transition:transform .15s ease;
}
.mic-toggle-input:checked + .mic-toggle-track{background:var(--ok)}
.mic-toggle-input:checked + .mic-toggle-track .mic-toggle-thumb{transform:translateX(16px)}
.mic-toggle-input:focus-visible + .mic-toggle-track{outline:2px solid var(--focus-ring);outline-offset:2px}
.mic-toggle-text{font-size:12px;font-weight:600;color:var(--ink-soft);min-width:2em}
.mic-toggle-input:checked ~ .mic-toggle-text{color:var(--ok)}
.mic-live-hpf{
display:flex;align-items:center;gap:5px;font-size:12px;margin-left:auto;
color:var(--ink-soft);font-weight:600;
}
.mic-live-hpf input[type=number]{
width:60px;padding:4px 6px;border:1px solid var(--input-border);border-radius:5px;
font-size:12px;font-variant-numeric:tabular-nums;background:var(--input-bg);color:var(--ink);
}
.mic-live-hpf-unit{color:var(--muted);font-size:11px;font-weight:500}

/* --- Sampler --- */
#sampler-body{display:flex;flex-direction:column;gap:8px}
.sampler-empty{
padding:12px;border:1px dashed var(--line);border-radius:8px;
font-size:12px;line-height:1.45;color:var(--muted);background:var(--surface);
text-wrap:pretty;
}
.sampler-grid{
display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,142px),1fr));gap:8px;
}
.sampler-pad{
display:flex;align-items:center;justify-content:flex-start;
min-height:38px;padding:0 12px;border-radius:8px;cursor:pointer;
background:var(--surface);border:1px solid var(--line);
font-family:var(--mono);font-size:11px;font-weight:700;color:var(--ink);
text-align:left;line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
transition:background .12s ease,border-color .12s ease,transform .08s ease;
}
.sampler-pad:hover{border-color:var(--muted);background:var(--bg-elev)}
.sampler-pad:active{transform:scale(.98)}
.sampler-pad.playing{
border-color:var(--accent);background:rgba(217,67,54,.14);color:var(--accent);
}

/* --- Console --- */
.console-header{
display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:10px;
}
.console-header .card-title{margin-bottom:0}
.console-filter{display:flex;gap:4px}
.console-filter-btn{
padding:4px 10px;font-size:11px;font-weight:600;color:var(--muted);
cursor:pointer;border:1px solid var(--line);border-radius:999px;
background:var(--surface);transition:background .12s ease,color .12s ease,border-color .12s ease;
}
.console-filter-btn:hover{color:var(--ink);border-color:var(--muted)}
.console-filter-btn.active{
background:var(--btn-active-bg);color:var(--btn-active-text);border-color:var(--btn-active-bg);
}
.console-list{list-style:none;margin:0;padding:0;position:relative;overflow:hidden}
.crow{
display:flex;align-items:center;gap:8px;
padding:5px 6px;border-bottom:1px solid var(--line-soft);
border-left:3px solid transparent;border-radius:4px;
background:transparent;transition:background .4s ease,border-left-color .4s ease;
}
.crow:last-child{border-bottom:none}
.crow.empty .cname{color:transparent}
.crow.empty .cval-group{visibility:hidden}
.cname{
flex:0 1 clamp(92px,30vw,160px);min-width:0;
font-family:var(--mono);font-size:11px;font-weight:600;color:var(--ink);
white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
}
.ctrack{flex:1;min-width:36px;height:5px;background:var(--line-soft);border-radius:3px;overflow:hidden;position:relative}
.cfill{
display:block;height:100%;min-width:0;background:var(--bar-fill);border-radius:3px;
transition:width .08s ease-out;
}
.crow.sw .cfill{background:var(--accent)}
.crow.empty .cfill-loading{width:18%;background:var(--line);transition:none}
.cval-group{
display:flex;align-items:center;gap:4px;flex:0 0 auto;
font-family:var(--mono);font-size:11px;font-variant-numeric:tabular-nums;
}
.coldval{color:var(--muted);opacity:.65;min-width:38px;text-align:right}
.cdir{width:12px;text-align:center;font-size:10px;line-height:1;font-weight:700;user-select:none}
.cdir.up{color:var(--ok)}
.cdir.down{color:var(--warn)}
.cdir.sw{color:var(--accent)}
.cval{min-width:38px;text-align:right;color:var(--muted)}
.crow.active{background:rgba(37,99,235,.09);border-left-color:var(--info)}
.crow.active .cname,.crow.active .cval{color:var(--ink);font-weight:700}
.crow.active .coldval{opacity:1;color:var(--ink-soft)}
.crow.sw.active{background:rgba(217,67,54,.09);border-left-color:var(--accent)}

/* --- Switches --- */
.sw-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-top:4px}
@media(max-width:720px){.sw-grid{grid-template-columns:1fr}}
.sw-group{
background:var(--surface);border:1px solid var(--line);
border-radius:8px;padding:10px 12px;
}
.sw-group-kill{border-top:2px solid var(--danger)}
.sw-group-fx{border-top:2px solid var(--warn)}
.sw-group-siren{border-top:2px solid var(--info)}
.sw-group-title{
font-size:11px;font-weight:700;text-transform:uppercase;
letter-spacing:.06em;color:var(--ink-soft);margin-bottom:8px;
}
.sw-group-items{display:grid;grid-template-columns:1fr 1fr;gap:6px}
.sw-group-siren .sw-group-items{grid-template-columns:1fr}
.sw-tile{
display:flex;align-items:center;gap:8px;padding:8px 10px;
background:var(--bg-elev);border:1px solid var(--line);border-radius:var(--radius-sm);
}
.sw-tile-kill.on{border-color:var(--danger);background:rgba(220,38,38,.1)}
.sw-tile-fx.on{border-color:var(--warn);background:rgba(217,119,6,.1)}
.sw-tile-siren.on{border-color:var(--info);background:rgba(37,99,235,.1)}
.sw-led{flex-shrink:0;width:8px;height:8px;border-radius:50%;background:var(--muted)}
.sw-tile-kill.on .sw-led{background:var(--danger)}
.sw-tile-fx.on .sw-led{background:var(--warn)}
.sw-tile-siren.on .sw-led{background:var(--info)}
.sw-tile-name{font-size:10px;font-weight:700;color:var(--ink);letter-spacing:.04em}

/* --- VU Meters --- */
#meters-wrap{display:flex;flex-direction:column;gap:10px;margin:0}
.meters-columns{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;align-items:stretch}
@media(max-width:760px){.meters-columns{grid-template-columns:1fr}}
.meters-card{min-width:0;height:100%;margin-bottom:0;display:flex;flex-direction:column}
.meter-group{display:flex;flex-direction:column;gap:6px;align-items:stretch;padding:2px 0;flex:1}
.meter-ch{
display:flex;flex-direction:row;align-items:center;gap:8px;
width:100%;min-width:0;padding-top:11px;
}
.meter-id{
display:flex;flex-direction:column;gap:2px;
min-width:64px;width:64px;flex-shrink:0;align-items:flex-start;text-align:left;
}
.meter-strip{display:flex;flex-direction:row;align-items:stretch;flex:1 1 0;min-width:0}
.meter-body{display:flex;flex-direction:column;gap:2px;flex:1 1 0;min-width:0}
.meter-wrap{position:relative;flex:1 1 0;min-width:0;width:100%;height:26px;cursor:pointer}
.meter-canvas{display:block;width:100%;height:26px}
.meter-scale{
display:flex;justify-content:space-between;width:100%;padding:0 1px;
font-size:8px;font-family:var(--mono);font-variant-numeric:tabular-nums;color:var(--muted);
line-height:1;user-select:none;pointer-events:none;
}
.meter-peak-db{
position:absolute;top:-12px;left:0;font-size:9px;font-family:var(--mono);
font-variant-numeric:tabular-nums;color:var(--muted);
transform:translateX(-50%);white-space:nowrap;pointer-events:none;opacity:0;
transition:left 60ms linear,opacity 120ms ease;
}
.meter-peak-db.clip{color:var(--danger);font-weight:700}
.meter-lbl{font-size:10px;font-weight:700;color:var(--ink-soft);letter-spacing:.03em}
.meter-gain-val{
font-size:11px;font-family:var(--mono);font-variant-numeric:tabular-nums;
font-weight:700;color:var(--ink);line-height:1.2;
}
.meter-clip-led{position:relative;flex:0 0 auto;width:10px;height:10px;align-self:center}
.meter-clip-led__bezel{
position:absolute;inset:0;border-radius:50%;
background:#262b35;border:1px solid #3c4352;
}
.meter-clip-led__core{
position:absolute;inset:2px;border-radius:50%;
background:#471a16;transition:background 100ms ease;
}
.meter-clip-led.on .meter-clip-led__core{background:#ef4444}
.meter-gain-btn{
flex:0 0 auto;align-self:flex-start;width:24px;height:26px;padding:0;margin:0;
border:1px solid var(--line);background:var(--surface);color:var(--ink-soft);
font-size:13px;font-weight:700;line-height:1;cursor:pointer;
transition:background .1s ease,color .1s ease;
}
.meter-gain-btn--dec{border-radius:4px 0 0 4px;border-right:none}
.meter-gain-btn--inc{border-radius:0 4px 4px 0;border-left:none}
.meter-gain-btn:hover:not(:disabled){background:var(--bg-elev);color:var(--ink)}
.meter-gain-btn:disabled{opacity:.35;cursor:default}
.meter-mode-btn{
align-self:flex-start;padding:2px 6px;font-size:9px;font-family:var(--mono);
font-weight:700;line-height:1.2;border-radius:4px;border:1px solid transparent;
cursor:pointer;letter-spacing:.04em;user-select:none;
}
.meter-mode-btn.stereo{background:var(--ok);color:#fff}
.meter-mode-btn.mono{background:var(--warn);color:#111}

@media(max-width:480px){
.meter-ch{
display:grid;grid-template-columns:1fr auto;grid-template-rows:auto auto;
gap:4px 8px;padding-top:12px;
}
.meter-id{
grid-column:1;grid-row:1;width:auto;min-width:0;
flex-direction:row;align-items:center;gap:8px;
}
.meter-clip-led{grid-column:2;grid-row:1}
.meter-strip{grid-column:1 / -1;grid-row:2}
.meter-gain-btn{width:28px}
}

/* --- Master EQ --- */
.master-eq-wrap{width:100%;max-width:920px;margin:0 auto}
.master-eq-canvas{display:block;width:100%;height:220px;min-height:220px;border-radius:6px}
@media(min-width:720px){.master-eq-canvas{height:300px;min-height:300px}}

/* --- Live layout popup --- */
#live-layout-popup{position:fixed;inset:0;z-index:var(--z-popup)}
#live-layout-popup[hidden]{display:none!important}
.live-layout-backdrop{position:absolute;inset:0;background:rgba(0,0,0,.48)}
.live-layout-panel{
position:absolute;z-index:1;max-height:min(72dvh,520px);overflow-y:auto;
background:var(--bg-elev);border:1px solid var(--line);border-radius:var(--radius);
box-shadow:var(--shadow);padding:14px;
}
.live-layout-title{
font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;
color:var(--ink-soft);margin-bottom:4px;
}
.live-layout-hint{font-size:11px;color:var(--muted);margin-bottom:10px}
.live-layout-list{display:flex;flex-direction:column;gap:6px}
.live-layout-row{
display:flex;align-items:center;justify-content:space-between;gap:10px;
font-size:13px;font-weight:600;color:var(--ink);user-select:none;
padding:6px 8px;border-radius:6px;background:var(--surface);border:1px solid var(--line-soft);
}
.live-layout-check{display:flex;align-items:center;gap:8px;cursor:pointer;flex:1;min-width:0}
.live-layout-check input{width:16px;height:16px;accent-color:var(--accent);cursor:pointer}
.live-layout-moves{display:flex;gap:4px;flex-shrink:0}
.live-layout-move{
width:30px;height:30px;padding:0;font-size:11px;line-height:1;
color:var(--muted);cursor:pointer;border:1px solid var(--line);
border-radius:6px;background:var(--bg-elev);
}
.live-layout-move:hover:not(:disabled){color:var(--ink);border-color:var(--muted)}
.live-layout-move:disabled{opacity:.35;cursor:default}

/* --- Controls Tab (Virtual / Dev) --- */
.dev-banner{
margin-bottom:12px;padding:12px 16px;border-left:3px solid var(--muted);
}
.dev-banner.dev-active{border-left-color:var(--ok)}
.dev-banner-top{
display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;
margin-bottom:10px;
}
.dev-banner-title-box{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.dev-banner-title{font-size:15px;font-weight:700;color:var(--ink)}
.dev-mode-pill{
font-size:11px;font-weight:600;padding:2px 8px;border-radius:999px;
background:var(--surface);border:1px solid var(--line);color:var(--muted);
}
.dev-banner.dev-active .dev-mode-pill{
border-color:var(--ok);color:var(--ok);background:rgba(31,157,85,.1);
}
.dev-toggle-btn{
padding:8px 14px;font-size:12px;font-weight:700;
border-radius:var(--radius-sm);border:1px solid var(--line);
background:var(--surface);color:var(--ink-soft);cursor:pointer;
transition:background .12s ease,color .12s ease,border-color .12s ease;
}
.dev-toggle-btn:hover{border-color:var(--muted);color:var(--ink)}
.dev-toggle-btn.active{background:var(--ok);color:#fff;border-color:var(--ok)}
.dev-actions-row{
display:flex;gap:8px;flex-wrap:wrap;padding-top:10px;border-top:1px solid var(--line-soft);
}
.dev-action-btn,.dev-small-btn{
padding:6px 12px;font-size:12px;font-weight:600;
border-radius:var(--radius-sm);border:1px solid var(--line);
background:var(--surface);color:var(--ink-soft);cursor:pointer;
transition:background .12s ease,color .12s ease,border-color .12s ease;
}
.dev-action-btn:hover,.dev-small-btn:hover{background:var(--bg-elev);color:var(--ink);border-color:var(--muted)}
.dev-controls-container{display:flex;flex-direction:column;gap:12px;transition:opacity .15s ease}
.dev-controls-container.disabled-controls{opacity:.48;pointer-events:none;user-select:none}
.dev-section{padding:14px 16px;margin-bottom:0}
.dev-sub-panel{
background:var(--surface);border:1px solid var(--line);
border-radius:8px;padding:12px;display:flex;flex-direction:column;gap:10px;
}
.dev-sub-heading{
font-size:11px;font-weight:700;color:var(--ink-soft);
text-transform:uppercase;letter-spacing:.06em;
}
.dev-row-between{display:flex;justify-content:space-between;align-items:center;gap:8px}
.dev-grid-2col{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,280px),1fr));gap:12px;margin-top:10px}
.dev-channels-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,210px),1fr));gap:12px;margin-top:4px}
.dev-channel-col{
background:var(--surface);border:1px solid var(--line);border-radius:8px;
padding:12px;display:flex;flex-direction:column;gap:10px;
}
.dev-channel-hdr{
font-size:12px;font-weight:700;color:var(--ink);letter-spacing:.04em;
text-align:center;padding-bottom:6px;border-bottom:1px solid var(--line);
}
.dev-eq-box{
background:var(--bg-elev);border:1px solid var(--line-soft);
border-radius:6px;padding:8px;display:flex;flex-direction:column;gap:8px;
}
.dev-pot-grid-2{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,170px),1fr));gap:10px}
.dev-geq-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,132px),1fr));gap:10px;margin-top:4px}
.dev-pot-item{display:flex;flex-direction:column;gap:4px}
.dev-pot-top{display:flex;justify-content:space-between;align-items:baseline;gap:6px;font-size:12px}
.dev-pot-label{font-weight:600;color:var(--ink-soft);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dev-pot-val{
font-family:var(--mono);font-size:11px;font-variant-numeric:tabular-nums;
color:var(--ink);font-weight:700;flex-shrink:0;
}
.dev-pot-slider,.fx-range-slider{
width:100%;height:6px;border-radius:3px;background:var(--line);
outline:none;-webkit-appearance:none;appearance:none;cursor:pointer;
}
.dev-pot-slider::-webkit-slider-thumb,.fx-range-slider::-webkit-slider-thumb{
-webkit-appearance:none;appearance:none;width:16px;height:16px;border-radius:50%;
background:var(--ink);border:2px solid var(--bg-elev);cursor:pointer;
}
.dev-pot-slider.centered::-webkit-slider-thumb{background:var(--info)}
.dev-kill-section{margin-bottom:10px}
.dev-kill-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin-top:8px}
@media(max-width:560px){.dev-kill-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
.dev-kill-btn{
padding:10px 8px;border-radius:var(--radius-sm);border:1px solid var(--line);
background:var(--surface);color:var(--ink-soft);cursor:pointer;
display:flex;flex-direction:column;align-items:center;gap:2px;
font-size:13px;font-weight:800;letter-spacing:.04em;
transition:background .12s ease,color .12s ease,border-color .12s ease;
}
.dev-kill-btn:hover{border-color:var(--muted);color:var(--ink)}
.dev-kill-btn.active{background:var(--danger);color:#fff;border-color:var(--danger)}
.dev-kill-sub{font-size:10px;font-weight:600;opacity:.75;font-variant-numeric:tabular-nums}
.dev-fx-mode-row{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.dev-fx-mode-row .dev-pot-label{min-width:72px;font-size:12px}
.dev-mode-btn{
flex:1;min-width:76px;padding:6px 10px;font-size:11px;font-weight:700;
border-radius:var(--radius-sm);border:1px solid var(--line);
background:var(--bg-elev);color:var(--ink-soft);cursor:pointer;
}
.dev-mode-btn.active{background:var(--btn-active-bg);color:var(--btn-active-text);border-color:var(--btn-active-bg)}
.dev-siren-trigger-box{display:flex;gap:8px;margin-top:4px;flex-wrap:wrap}
.dev-siren-trig-btn{
flex:2;min-width:140px;padding:12px;font-size:13px;font-weight:700;
border-radius:var(--radius-sm);border:1px solid var(--warn);
background:rgba(217,119,6,.1);color:var(--warn);cursor:pointer;
user-select:none;touch-action:none;text-align:center;
}
.dev-siren-trig-btn.firing{background:var(--warn);color:#111}
.dev-siren-latch-btn{
flex:1;min-width:96px;padding:10px 12px;font-size:12px;font-weight:700;
border-radius:var(--radius-sm);border:1px solid var(--line);
background:var(--bg-elev);color:var(--ink-soft);cursor:pointer;
}
.dev-siren-latch-btn.active{background:var(--warn);color:#111;border-color:var(--warn)}

/* --- FX Tab --- */
.fx-pane-container{display:flex;flex-direction:column;gap:12px}
.fx-card{
background:var(--bg-elev);border:1px solid var(--line);
border-radius:var(--radius);padding:14px 16px;box-shadow:var(--shadow);
display:flex;flex-direction:column;
}
.fx-card-header{
display:flex;justify-content:space-between;align-items:center;
gap:10px;margin-bottom:10px;flex-wrap:wrap;
}
.fx-card-title{
font-size:12px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:var(--ink);
}
.fx-routing-tools{display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.fx-tool-btn{
display:inline-flex;align-items:center;gap:5px;
padding:5px 10px;font-size:11px;font-weight:600;border-radius:999px;
border:1px solid var(--line);background:var(--surface);color:var(--ink-soft);cursor:pointer;
transition:background .12s ease,color .12s ease,border-color .12s ease;
}
.fx-tool-btn:hover{border-color:var(--muted);color:var(--ink)}
.fx-tool-btn.active{background:var(--btn-active-bg);color:var(--btn-active-text);border-color:var(--btn-active-bg)}
.fx-matrix-table{display:flex;flex-direction:column;gap:8px}
.fx-matrix-row{
display:flex;align-items:center;gap:10px;padding:8px 12px;
background:var(--surface);border:1px solid var(--line-soft);border-radius:8px;
}
.fx-matrix-ch-label{min-width:58px;flex-shrink:0}
.fx-ch-badge{
display:inline-block;font-size:11px;font-weight:700;letter-spacing:.04em;
padding:4px 8px;background:var(--bg-elev);border:1px solid var(--line);
border-radius:var(--radius-sm);color:var(--ink);
}
.fx-matrix-sends{
flex:1;min-width:0;display:grid;
grid-template-columns:repeat(auto-fit,minmax(min(100%,340px),1fr));gap:8px 12px;
}
.fx-matrix-send-col{display:flex;flex-direction:row;align-items:center;gap:6px;min-width:0}
.fx-send-tag{
font-size:10px;font-weight:700;color:var(--muted);letter-spacing:.05em;
text-transform:uppercase;flex-shrink:0;min-width:16px;
}
.fx-send-triggers{display:inline-flex;align-items:center;gap:4px;flex-shrink:0}
.fx-trig-btn{
display:inline-flex;align-items:center;gap:4px;
padding:4px 9px;font-size:11px;font-weight:700;border-radius:var(--radius-sm);
border:1px solid var(--line);background:var(--bg-elev);color:var(--ink-soft);
cursor:pointer;user-select:none;touch-action:none;white-space:nowrap;
transition:background .1s ease,color .1s ease,border-color .1s ease;
}
.fx-trig-btn:hover{border-color:var(--muted);color:var(--ink)}
.fx-trig-btn.active{background:var(--accent);color:#fff;border-color:var(--accent)}
.fx-trig-btn.fx-trig-latch.active{background:var(--info);color:#fff;border-color:var(--info)}
.fx-route-select{
flex:1;min-width:96px;padding:5px 8px;font-size:12px;font-weight:600;
border-radius:var(--radius-sm);border:1px solid var(--line);
background:var(--bg-elev);color:var(--ink);cursor:pointer;
transition:border-color .12s ease,background .12s ease;
}
.fx-route-select:hover{border-color:var(--muted)}
.fx-route-select:focus-visible{outline:2px solid var(--focus-ring);outline-offset:1px}
.fx-route-select[data-dest="7"]{color:var(--muted)}

.fx-modules-grid{
display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,300px),1fr));gap:12px;
}
.fx-toggle-wrap{
display:inline-flex;align-items:center;gap:6px;cursor:pointer;user-select:none;
}
.fx-toggle-wrap input{position:absolute;opacity:0;width:0;height:0;pointer-events:none}
.fx-toggle-track{
position:relative;display:inline-block;width:34px;height:19px;
background:var(--muted);border-radius:999px;transition:background .15s ease;
}
.fx-toggle-thumb{
position:absolute;top:2px;left:2px;width:15px;height:15px;
background:#fff;border-radius:50%;transition:transform .15s ease;
}
.fx-toggle-wrap input:checked + .fx-toggle-track{background:var(--ok)}
.fx-toggle-wrap input:checked + .fx-toggle-track .fx-toggle-thumb{transform:translateX(15px)}
.fx-toggle-wrap input:focus-visible + .fx-toggle-track{outline:2px solid var(--focus-ring);outline-offset:2px}
.fx-meter-track{
height:4px;background:var(--surface);border-radius:2px;overflow:hidden;margin-bottom:12px;
border:1px solid var(--line-soft);
}
.fx-meter-fill{height:100%;width:0%;background:var(--bar-fill);transition:width 60ms linear}
.fx-meter-fill.ducker-fill{background:var(--danger)}
.fx-meter-fill.sub-fill,.fx-meter-fill.spring-fill,.fx-meter-fill.shimmer-fill{background:var(--warn)}
.fx-meter-fill.tape-fill,.fx-meter-fill.phase-fill{background:var(--accent)}
.fx-controls-list{display:flex;flex-direction:column;gap:11px;flex:1}
.fx-slider-item{display:flex;flex-direction:column;gap:4px}
.fx-slider-top{display:flex;justify-content:space-between;align-items:baseline;gap:8px}
.fx-slider-lbl{font-size:12px;font-weight:600;color:var(--ink-soft)}
.fx-slider-val{
font-family:var(--mono);font-size:11px;font-weight:700;font-variant-numeric:tabular-nums;
color:var(--ink);background:var(--surface);padding:2px 6px;border-radius:4px;
border:1px solid var(--line-soft);
}
.fx-slider-val.warn{color:var(--danger);border-color:var(--danger);background:rgba(220,38,38,.1)}
.fx-preset-row{display:flex;gap:5px;flex-wrap:wrap}
.fx-mini-btn{
padding:4px 8px;font-size:11px;font-weight:600;border-radius:5px;
border:1px solid var(--line);background:var(--surface);color:var(--ink-soft);cursor:pointer;
transition:background .1s ease,color .1s ease,border-color .1s ease;
}
.fx-mini-btn:hover{color:var(--ink);border-color:var(--muted)}
.fx-mini-btn.active{background:var(--btn-active-bg);color:var(--btn-active-text);border-color:var(--btn-active-bg)}
.fx-action-box{display:flex;gap:8px;margin-top:12px;flex-wrap:wrap}
.fx-big-btn{
flex:1;min-width:100px;padding:9px 12px;font-size:12px;font-weight:700;
border-radius:var(--radius-sm);cursor:pointer;text-align:center;
border:1px solid var(--line);background:var(--surface);color:var(--ink-soft);
transition:background .12s ease,color .12s ease,border-color .12s ease;
}
.fx-big-btn:hover{border-color:var(--muted);color:var(--ink)}
.btn-kill-send.active{background:var(--danger);color:#fff;border-color:var(--danger)}
.btn-stages.active{background:var(--btn-active-bg);color:var(--btn-active-text);border-color:var(--btn-active-bg)}
.btn-clear-delay.flash,.btn-splash.flash{background:var(--info);color:#fff;border-color:var(--info)}

/* --- Mapping Tab (3-view guided redesign) --- */
.map-topbar{
display:flex;align-items:center;justify-content:space-between;
gap:10px;flex-wrap:wrap;margin-bottom:12px;
}
.map-subtabs{
display:inline-flex;background:var(--surface);border:1px solid var(--line);
border-radius:8px;padding:3px;gap:2px;flex-wrap:wrap;
}
.map-subtab{
padding:6px 12px;font-size:12px;font-weight:600;color:var(--muted);
border:none;background:transparent;border-radius:6px;cursor:pointer;
transition:background .12s ease,color .12s ease;
}
.map-subtab:hover{color:var(--ink)}
.map-subtab.active{background:var(--bg-elev);color:var(--ink);box-shadow:0 1px 2px rgba(0,0,0,.08)}
.map-topbar-actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.map-conflict-pill{
display:none;padding:6px 10px;font-size:11px;font-weight:700;border-radius:999px;
border:1px solid var(--danger);background:rgba(220,38,38,.1);color:var(--danger);cursor:pointer;
}
.map-conflict-pill.show{display:inline-flex;align-items:center;gap:5px}
.btn-export,.btn-map-secondary,.btn-save,.btn-restart,.btn-danger-outline,.btn-danger-solid{
display:inline-flex;align-items:center;gap:6px;
padding:8px 13px;border-radius:var(--radius-sm);font-size:12px;font-weight:600;cursor:pointer;
border:1px solid transparent;transition:opacity .12s ease,background .12s ease,border-color .12s ease,color .12s ease;
}
.btn-export,.btn-save{background:var(--btn-active-bg);color:var(--btn-active-text)}
.btn-map-secondary{background:var(--surface);color:var(--ink-soft);border-color:var(--line)}
.btn-map-secondary:hover:not(:disabled){color:var(--ink);border-color:var(--muted);background:var(--bg-elev)}
.btn-restart{background:rgba(217,119,6,.14);color:var(--warn);border-color:rgba(217,119,6,.45)}
.btn-restart:hover:not(:disabled){background:var(--warn);color:#111;border-color:var(--warn)}
.btn-danger-outline{background:rgba(220,38,38,.1);color:var(--danger);border-color:rgba(220,38,38,.35)}
.btn-danger-outline:hover:not(:disabled){background:var(--danger);color:#fff;border-color:var(--danger)}
.btn-danger-solid{background:var(--danger);color:#fff}
.btn-export:hover:not(:disabled),.btn-save:hover:not(:disabled),.btn-danger-solid:hover:not(:disabled){opacity:.9}
.btn-export:disabled,.btn-map-secondary:disabled,.btn-save:disabled,.btn-restart:disabled,.btn-danger-outline:disabled,.btn-danger-solid:disabled{
opacity:.45;cursor:default;
}
.map-dirty-pill{
display:none;padding:4px 9px;font-size:11px;font-weight:700;border-radius:999px;
border:1px solid rgba(217,119,6,.45);background:rgba(217,119,6,.12);color:var(--warn);
}
.map-dirty-pill.show{display:inline-flex;align-items:center}
.map-toast{
position:fixed;right:max(18px,env(safe-area-inset-right));bottom:max(18px,env(safe-area-inset-bottom));
z-index:calc(var(--z-popup) + 10);max-width:min(420px,calc(100vw - 36px));
padding:10px 14px;border-radius:var(--radius-sm);
background:var(--bg-elev);border:1px solid var(--ok);border-left:4px solid var(--ok);
box-shadow:var(--shadow);font-size:12px;font-weight:600;color:var(--ink);
opacity:0;transform:translateY(8px);pointer-events:none;
transition:opacity .15s ease,transform .15s ease;
}
.map-toast.show{opacity:1;transform:translateY(0)}
.map-toast.err{border-color:var(--danger);border-left-color:var(--danger);color:var(--danger)}
.map-conflicts-box{
display:none;font-size:12px;color:var(--danger);
background:rgba(220,38,38,.08);border:1px solid rgba(220,38,38,.35);
border-left:3px solid var(--danger);padding:10px 12px;border-radius:var(--radius-sm);margin-bottom:12px;
}
.map-conflicts-box.show{display:block}
.map-conflicts-box ul{margin:6px 0 0 16px}
.map-conflicts-box li{margin:2px 0;font-family:var(--mono);font-size:11px}

.map-guided-bar{
display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;
padding:10px 14px;margin-bottom:12px;border-radius:var(--radius);
background:var(--bg-elev);border:1px solid var(--line);
}
.map-guided-bar.listening{
border-color:var(--info);background:rgba(37,99,235,.08);
}
.map-guided-info{display:flex;flex-direction:column;gap:2px;min-width:0;flex:1}
.map-guided-step{
font-size:11px;font-weight:700;color:var(--info);text-transform:uppercase;
letter-spacing:.05em;font-variant-numeric:tabular-nums;
}
.map-guided-prompt{font-size:13px;font-weight:600;color:var(--ink)}
.map-guided-actions{display:flex;gap:6px;flex-shrink:0}
.map-filter-bar{
display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;margin-bottom:10px;
}
.map-filter-pills{display:flex;gap:4px;flex-wrap:wrap}
.map-filter-pill{
padding:5px 10px;font-size:11px;font-weight:600;border-radius:999px;
border:1px solid var(--line);background:var(--bg-elev);color:var(--muted);cursor:pointer;
}
.map-filter-pill:hover{color:var(--ink);border-color:var(--muted)}
.map-filter-pill.active{background:var(--btn-active-bg);color:var(--btn-active-text);border-color:var(--btn-active-bg)}
.map-search{
padding:6px 10px;border:1px solid var(--input-border);border-radius:var(--radius-sm);
background:var(--input-bg);color:var(--ink);font-size:12px;min-width:170px;
}
.map-groups{display:flex;flex-direction:column;gap:10px}
.map-group{
background:var(--bg-elev);border:1px solid var(--line);border-radius:var(--radius);overflow:hidden;
}
.map-group-hdr{
display:flex;align-items:center;justify-content:space-between;gap:8px;
width:100%;padding:10px 14px;border:none;background:var(--surface);
color:var(--ink);cursor:pointer;text-align:left;border-bottom:1px solid var(--line-soft);
}
.map-group[data-collapsed="true"] .map-group-hdr{border-bottom-color:transparent}
.map-group[data-collapsed="true"] .map-group-body{display:none}
.map-group-title{font-size:12px;font-weight:700;letter-spacing:.05em;text-transform:uppercase}
.map-group-count{font-size:11px;font-family:var(--mono);font-variant-numeric:tabular-nums;color:var(--muted)}
.map-group-body{display:flex;flex-direction:column}
.map-row{
display:grid;grid-template-columns:minmax(140px,1.3fr) minmax(70px,.7fr) auto auto auto;
align-items:center;gap:10px;padding:8px 14px;
border-bottom:1px solid var(--line-soft);
}
.map-row:last-child{border-bottom:none}
.map-row.row-detecting{background:rgba(37,99,235,.1)}
.map-row.dup-conflict{background:rgba(220,38,38,.08)}
.map-row-main{min-width:0}
.map-row-name{font-size:13px;font-weight:600;color:var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.map-row-sub{font-size:10px;font-family:var(--mono);color:var(--muted)}
.map-live-meter{
height:5px;background:var(--surface);border-radius:3px;overflow:hidden;
border:1px solid var(--line-soft);min-width:54px;
}
.map-live-fill{height:100%;width:0%;background:var(--bar-fill)}
.map-live-fill.sw{background:var(--accent)}
.map-row-fields{display:flex;align-items:center;gap:6px}
.map-field{display:inline-flex;align-items:center;gap:4px}
.map-field-lbl{font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase}
.map-num,.map-select{
width:54px;padding:4px 5px;border:1px solid var(--input-border);border-radius:5px;
background:var(--input-bg);color:var(--ink);font-size:12px;
font-family:var(--mono);font-variant-numeric:tabular-nums;
}
.map-row.dup-conflict .map-num,.map-row.dup-conflict .map-select{border-color:var(--danger)}
.btn-rev-toggle{
padding:5px 8px;font-size:11px;font-weight:700;border-radius:5px;
border:1px solid var(--line);background:var(--surface);color:var(--muted);cursor:pointer;
}
.btn-rev-toggle.active{background:var(--warn);color:#111;border-color:var(--warn)}
.btn-detect-row{
min-width:74px;padding:6px 10px;font-size:11px;font-weight:700;
border-radius:5px;border:1px solid var(--info);
background:rgba(37,99,235,.1);color:var(--info);cursor:pointer;
}
.btn-detect-row:hover:not(:disabled){background:var(--info);color:#fff}
.btn-detect-row:disabled{opacity:.35;cursor:default}
.btn-detect-row.detect-active{background:var(--danger);color:#fff;border-color:var(--danger)}

@media(max-width:720px){
.map-row{
grid-template-columns:1fr auto;grid-template-rows:auto auto;gap:6px 8px;padding:10px 12px;
}
.map-row-main{grid-column:1;grid-row:1}
.map-live-meter{grid-column:2;grid-row:1;width:72px;justify-self:end}
.map-row-fields{grid-column:1;grid-row:2;flex-wrap:wrap}
.map-row-actions{grid-column:2;grid-row:2;display:flex;gap:6px;justify-self:end}
}
@media(min-width:721px){
.map-row-actions{display:contents}
}

.map-io-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,320px),1fr));gap:12px}
.map-io-card{margin-bottom:0}
.map-io-list{display:flex;flex-direction:column;gap:8px}
.map-io-row{
display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;
padding:8px 10px;background:var(--surface);border:1px solid var(--line-soft);border-radius:8px;
}
.map-io-row.dup-conflict{border-color:var(--danger);background:rgba(220,38,38,.08)}
.map-io-label{font-size:12px;font-weight:700;color:var(--ink);min-width:86px}
.map-io-fields{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-left:auto}
.map-io-fields input[type=text]{
width:64px;padding:4px 6px;border:1px solid var(--input-border);border-radius:5px;
background:var(--input-bg);color:var(--ink);font-size:12px;font-family:var(--mono);
}
.map-io-check{display:inline-flex;align-items:center;gap:4px;font-size:11px;font-weight:600;color:var(--ink-soft);cursor:pointer}
.map-io-check input{width:15px;height:15px;accent-color:var(--accent);cursor:pointer}

.map-ign-toolbar{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:10px}
.map-ign-list{display:flex;flex-direction:column;gap:6px}
.map-ign-row{
display:flex;align-items:center;gap:8px;flex-wrap:wrap;
padding:7px 10px;background:var(--surface);border:1px solid var(--line-soft);border-radius:6px;
}
.map-ign-row.dup-conflict{border-color:var(--danger);background:rgba(220,38,38,.08)}
.map-ign-status{font-size:12px;color:var(--muted);flex:1;min-width:120px}
.map-ign-status.mapped{color:var(--warn);font-weight:600;font-family:var(--mono);font-size:11px}
.btn-del-ign{
padding:4px 8px;background:rgba(220,38,38,.12);color:var(--danger);
border:1px solid rgba(220,38,38,.3);border-radius:5px;font-size:11px;font-weight:700;cursor:pointer;
}
.map-hw-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,150px),1fr));gap:8px}
.map-hw-item{
padding:8px 10px;background:var(--surface);border:1px solid var(--line-soft);border-radius:6px;
}
.map-hw-k{font-size:10px;font-weight:700;text-transform:uppercase;color:var(--muted)}
.map-hw-v{font-size:13px;font-weight:700;font-family:var(--mono);font-variant-numeric:tabular-nums;color:var(--ink);margin-top:2px}
.map-empty{padding:16px;text-align:center;font-size:12px;color:var(--muted)}

.map-clip-list{display:flex;flex-direction:column;gap:8px}
.map-clip-row{
display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;
padding:8px 10px;background:var(--surface);border:1px solid var(--line-soft);border-radius:8px;
}
.map-clip-row.is-disabled .map-io-fields{opacity:.5}
.map-clip-row.dup-conflict{border-color:var(--danger);background:rgba(220,38,38,.08)}
.map-clip-name{min-width:90px;font-size:12px;font-weight:700;color:var(--ink)}
.map-boot-row{padding:4px 0 10px;border-bottom:1px solid var(--line-soft)}
.map-boot-check{font-size:13px;font-weight:600;color:var(--ink)}
.map-system-row{
display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;
padding-top:12px;
}
.map-system-hint{font-size:12px;color:var(--muted);flex:1;min-width:200px}

.map-modal-backdrop{
position:fixed;inset:0;z-index:calc(var(--z-popup) + 20);
background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;padding:16px;
}
.map-modal-panel{
width:min(440px,100%);background:var(--bg-elev);border:1px solid var(--line);
border-radius:var(--radius);box-shadow:var(--shadow);padding:18px;
}
.map-modal-title{font-size:15px;font-weight:700;color:var(--ink);margin-bottom:8px}
.map-modal-body{font-size:13px;line-height:1.5;color:var(--ink-soft);margin-bottom:16px}
.map-modal-actions{display:flex;justify-content:flex-end;gap:8px;flex-wrap:wrap}

@media(max-width:580px){
#tab-content{padding:10px;padding-bottom:calc(14px + env(safe-area-inset-bottom))}
#gui-header{padding:6px 12px}
#gui-logo{height:28px}
.tab-btn{padding:10px 12px;font-size:12px}
.theme-btn-lbl,.gear-btn-lbl{display:none}
.map-search{width:100%}
.fx-matrix-row{flex-direction:column;align-items:stretch;gap:6px;padding:8px 10px}
.fx-matrix-ch-label{min-width:0;padding-top:0}
.fx-trig-btn{padding:4px 7px}
}

@media(pointer:coarse){
.dev-pot-slider::-webkit-slider-thumb,.fx-range-slider::-webkit-slider-thumb{width:20px;height:20px}
.fx-route-select,.fx-trig-btn,.btn-detect-row,.btn-rev-toggle{min-height:32px}
}

@media(prefers-reduced-motion:reduce){
*,*::before,*::after{
transition-duration:.01ms!important;
animation-duration:.01ms!important;
}
}
    `;
    document.head.appendChild(s);
  }

  // gui/dom/utils.js
  function projectFileUrl(filename) {
    const scripts = document.querySelectorAll('script[src*="/api/read/file/"]');
    for (const s of scripts) {
      const m = s.src.match(/\/api\/read\/file\/([^?]+)/);
      if (m) {
        const projectPath = decodeURIComponent(m[1]);
        const base = projectPath.replace(/\/[^/]+$/, "");
        return "/api/read/file/" + encodeURIComponent(base + "/" + filename);
      }
    }
    const project = (window.location.hash || "").slice(1);
    if (project)
      return "/api/read/file/" + encodeURIComponent(project + "/" + filename);
    return filename;
  }
  function el(tag, props) {
    const e = document.createElement(tag);
    if (!props) return e;
    for (const key of Object.keys(props)) {
      const val = props[key];
      if (key === "style" && typeof val === "string")
        e.style.cssText = val;
      else if (key.indexOf("-") >= 0)
        e.setAttribute(key, val);
      else
        e[key] = val;
    }
    return e;
  }
  function svgIcon(paths, viewBox = "0 0 24 24", size = 15) {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("width", String(size));
    svg.setAttribute("height", String(size));
    svg.setAttribute("viewBox", viewBox);
    svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", "currentColor");
    svg.setAttribute("stroke-width", "2");
    svg.setAttribute("stroke-linecap", "round");
    svg.setAttribute("stroke-linejoin", "round");
    svg.setAttribute("aria-hidden", "true");
    const list = Array.isArray(paths) ? paths : [paths];
    list.forEach((d) => {
      const p = document.createElementNS("http://www.w3.org/2000/svg", "path");
      p.setAttribute("d", d);
      svg.appendChild(p);
    });
    return svg;
  }
  function cardTitle(text) {
    const d = el("div", { className: "card-title" });
    d.textContent = text;
    return d;
  }
  function layoutTopChrome() {
    const content = document.getElementById("tab-content");
    if (content && content.style.paddingTop)
      content.style.paddingTop = "";
  }
  function hideP5Dom() {
    document.querySelectorAll("body > main").forEach((node) => node.remove());
  }

  // gui/live-layout.js
  function defaultLiveLayout() {
    const enabled = {};
    const order = [];
    LIVE_TILES.forEach((t) => {
      enabled[t.id] = !!t.defaultOn;
      order.push(t.id);
    });
    return { enabled, order };
  }
  function _normalize(prefs) {
    const def = defaultLiveLayout();
    const enabled = __spreadValues({}, def.enabled);
    const known = new Set(LIVE_TILES.map((t) => t.id));
    if (prefs && prefs.enabled && typeof prefs.enabled === "object") {
      LIVE_TILES.forEach((t) => {
        if (typeof prefs.enabled[t.id] === "boolean")
          enabled[t.id] = prefs.enabled[t.id];
      });
    }
    let order = Array.isArray(prefs && prefs.order) ? prefs.order.slice() : [];
    order = order.filter((id) => known.has(id));
    LIVE_TILES.forEach((t) => {
      if (!order.includes(t.id)) order.push(t.id);
    });
    return { enabled, order };
  }
  function _migrateV1(parsed) {
    const prefs = defaultLiveLayout();
    if (!parsed || typeof parsed !== "object") return prefs;
    LIVE_TILES.forEach((t) => {
      if (typeof parsed[t.id] === "boolean")
        prefs.enabled[t.id] = parsed[t.id];
    });
    return prefs;
  }
  function loadLiveLayout() {
    try {
      const rawV2 = localStorage.getItem(LIVE_LAYOUT_STORAGE_KEY);
      if (rawV2) {
        const parsed = JSON.parse(rawV2);
        if (parsed && typeof parsed === "object" && parsed.enabled)
          return _normalize(parsed);
      }
      const rawV1 = localStorage.getItem(LIVE_LAYOUT_STORAGE_KEY_V1);
      if (rawV1) {
        const migrated = _migrateV1(JSON.parse(rawV1));
        saveLiveLayout(migrated);
        return migrated;
      }
    } catch (_) {
    }
    return defaultLiveLayout();
  }
  function saveLiveLayout(prefs) {
    try {
      localStorage.setItem(LIVE_LAYOUT_STORAGE_KEY, JSON.stringify(prefs));
    } catch (_) {
    }
  }
  function isLiveTileOn(prefs, id) {
    return !!(prefs && prefs.enabled && prefs.enabled[id]);
  }
  function moveLiveTile(prefs, id, dir) {
    if (!prefs || !Array.isArray(prefs.order)) return false;
    const i = prefs.order.indexOf(id);
    if (i < 0) return false;
    const j = i + dir;
    if (j < 0 || j >= prefs.order.length) return false;
    const tmp = prefs.order[i];
    prefs.order[i] = prefs.order[j];
    prefs.order[j] = tmp;
    return true;
  }
  function orderedLiveTiles(prefs) {
    if (!prefs || !Array.isArray(prefs.order)) return [];
    return prefs.order.filter((id) => isLiveTileOn(prefs, id));
  }

  // gui/bela/connection.js
  function belaSocketOpen() {
    if (typeof Bela === "undefined") return false;
    const ws = Bela.socket || Bela.ws || Bela.data && Bela.data.socket;
    if (ws && typeof ws.readyState === "number")
      return ws.readyState === WebSocket.OPEN;
    return true;
  }
  function belaControlReady() {
    return typeof Bela !== "undefined" && Bela.control && Bela.control.ws && Bela.control.ws.readyState === 1;
  }
  var _belaListenersAttached = false;
  function ensureBelaWatchdogListeners() {
    if (_belaListenersAttached) return true;
    if (typeof Bela === "undefined") return false;
    const onDataReceived = () => {
      try {
        const ctx = getContext();
        ctx.lastBelaRxMs = Date.now();
        ctx.belaRxPackets = (ctx.belaRxPackets || 0) + 1;
      } catch (_) {
      }
    };
    if (Bela.data && Bela.data.target && typeof Bela.data.target.addEventListener === "function") {
      Bela.data.target.addEventListener("buffer-ready", onDataReceived);
      _belaListenersAttached = true;
    }
    const ws = Bela.socket || Bela.ws || Bela.data && Bela.data.socket;
    if (ws && typeof ws.addEventListener === "function") {
      ws.addEventListener("message", onDataReceived);
      ws.addEventListener("close", () => {
        try {
          const ctx = getContext();
          ctx.lastBelaRxMs = 0;
          ctx.belaConnState = "offline";
          updateBadge();
        } catch (_) {
        }
      });
      _belaListenersAttached = true;
    }
    return _belaListenersAttached;
  }
  function sampleBelaFingerprint(b) {
    if (!b) return "";
    const parts = [];
    if (b[0] && b[0].length) {
      parts.push("p:" + b[0][0].toFixed(3) + ":" + b[0][b[0].length - 1].toFixed(3) + ":" + b[0].length);
    }
    if (b[3] && b[3].length) {
      parts.push("a:" + b[3][0].toFixed(4));
    }
    return parts.join(",");
  }
  function updateBelaRxWatchdog(b) {
    if (!b) return;
    ensureBelaWatchdogListeners();
    const now = Date.now();
    const ctx = getContext();
    if (ctx.lastBelaRxMs === 0 && (b[0] || b[1] || b[3])) {
      ctx.lastBelaRxMs = now;
    }
    if (!_belaListenersAttached && b[0]) {
      const fp = sampleBelaFingerprint(b);
      if (fp !== ctx.belaRxFingerprint) {
        ctx.belaRxFingerprint = fp;
        ctx.lastBelaRxMs = now;
      }
    }
  }
  function getBelaConnState() {
    if (typeof Bela === "undefined") return "offline";
    if (!belaSocketOpen()) return "offline";
    const ctx = getContext();
    if (ctx.lastBelaRxMs === 0) return "offline";
    const now = Date.now();
    const staleMs = now - ctx.lastBelaRxMs;
    if (staleMs >= BELA_OFFLINE_TIMEOUT_MS) {
      ctx.belaConnState = "offline";
      return "offline";
    }
    if (staleMs >= BELA_LAG_THRESHOLD_MS) {
      ctx.belaConnState = "lag";
      ctx.belaLastLagMs = now;
      return "lag";
    }
    if (ctx.belaConnState === "lag" && now - (ctx.belaLastLagMs || 0) < BELA_LAG_HOLD_MS) {
      return "lag";
    }
    ctx.belaConnState = "live";
    return "live";
  }
  function isBelaConnected() {
    return getBelaConnState() !== "offline";
  }
  var _connBadgeEl = null;
  var _connBadgeLastState = "";
  function updateBadge() {
    if (!_connBadgeEl || !_connBadgeEl.isConnected)
      _connBadgeEl = document.getElementById("conn-badge");
    if (!_connBadgeEl) return;
    const state = getBelaConnState();
    if (state === _connBadgeLastState) return;
    _connBadgeLastState = state;
    if (state === "live") {
      _connBadgeEl.textContent = "LIVE";
      _connBadgeEl.className = "badge live";
    } else if (state === "lag") {
      _connBadgeEl.textContent = "LAG";
      _connBadgeEl.className = "badge lag";
    } else {
      _connBadgeEl.textContent = "OFFLINE";
      _connBadgeEl.className = "badge";
    }
  }
  var _tempBadgeEl = null;
  var _tempBadgeLastText = "";
  var _tempBadgeLastCls = "";
  function updateTempBadge(tempC) {
    if (!_tempBadgeEl || !_tempBadgeEl.isConnected)
      _tempBadgeEl = document.getElementById("temp-badge");
    if (!_tempBadgeEl) return;
    let text, cls;
    if (typeof tempC !== "number" || !isFinite(tempC) || tempC < 0) {
      text = "--\xB0C";
      cls = "badge temp unknown";
    } else {
      text = `${Math.round(tempC)}\xB0C`;
      cls = "badge temp";
      if (tempC >= CPU_TEMP_HOT_C) cls += " hot";
      else if (tempC >= CPU_TEMP_WARM_C) cls += " warm";
    }
    if (text !== _tempBadgeLastText) {
      _tempBadgeLastText = text;
      _tempBadgeEl.textContent = text;
    }
    if (cls !== _tempBadgeLastCls) {
      _tempBadgeLastCls = cls;
      _tempBadgeEl.className = cls;
    }
  }

  // gui/routing-config.js
  var ROUTING_CONFIG = {
    "out": {
      "master": {
        "channels": [
          6,
          7
        ],
        "stereo": true,
        "gain": 0
      },
      "fx1Send": {
        "channels": [
          8
        ],
        "gain": 0
      },
      "fx2Send": {
        "channels": [
          9
        ],
        "gain": 0
      },
      "vuSub": {
        "channel": 4,
        "gain": -6
      },
      "vuKick": {
        "channel": 5,
        "gain": -6
      },
      "vuMid": {
        "channel": 2,
        "gain": -2
      },
      "vuTop": {
        "channel": 3,
        "gain": 0
      }
    },
    "in": {
      "fx1Return": {
        "channels": [
          1
        ],
        "mic": false,
        "hpf": 0,
        "gain": 0
      },
      "fx2Return": {
        "channels": [
          0
        ],
        "mic": false,
        "hpf": 0,
        "gain": 0
      },
      "aux1": {
        "channels": [
          9,
          8
        ],
        "mic": false,
        "hpf": 0,
        "gain": 0
      },
      "aux2": {
        "channels": [
          7,
          6
        ],
        "mic": false,
        "hpf": 0,
        "gain": 0
      },
      "aux3": {
        "channels": [
          5,
          4
        ],
        "mic": false,
        "hpf": 0,
        "gain": 0
      },
      "aux4": {
        "channels": [
          3,
          2
        ],
        "mic": false,
        "hpf": 0,
        "gain": 0
      }
    }
  };
  var IGNORED_POTS_DEFAULT = [
    {
      "mux": 0,
      "pot": 3
    },
    {
      "mux": 0,
      "pot": 4
    },
    {
      "mux": 1,
      "pot": 2
    },
    {
      "mux": 1,
      "pot": 5
    },
    {
      "mux": 2,
      "pot": 2
    },
    {
      "mux": 2,
      "pot": 3
    },
    {
      "mux": 3,
      "pot": 2
    },
    {
      "mux": 3,
      "pot": 3
    },
    {
      "mux": 4,
      "pot": 2
    },
    {
      "mux": 4,
      "pot": 3
    },
    {
      "mux": 5,
      "pot": 2
    },
    {
      "mux": 5,
      "pot": 3
    },
    {
      "mux": 6,
      "pot": 2
    },
    {
      "mux": 6,
      "pot": 3
    },
    {
      "mux": 7,
      "pot": 0
    },
    {
      "mux": 7,
      "pot": 1
    },
    {
      "mux": 7,
      "pot": 2
    },
    {
      "mux": 7,
      "pot": 3
    },
    {
      "mux": 7,
      "pot": 8
    },
    {
      "mux": 7,
      "pot": 9
    }
  ];

  // gui/board-config.js
  var _reqSeq = 0;
  var _listenerRegistered = false;
  var _pendingRequests = /* @__PURE__ */ new Map();
  function escapeAsciiJson(text) {
    return String(text).replace(
      /[\u007f-\uffff]/g,
      (c) => "\\u" + ("0000" + c.charCodeAt(0).toString(16)).slice(-4)
    );
  }
  function ensureConfigControlListener() {
    if (_listenerRegistered) return true;
    if (typeof Bela === "undefined" || !Bela.control || typeof Bela.control.registerCallback !== "function") {
      return false;
    }
    _listenerRegistered = true;
    Bela.control.registerCallback("preampConfig", (data) => {
      if (!data || data.event !== "custom" || !data.configAction) return;
      const reqId = data.reqId || "";
      const pending = reqId && _pendingRequests.get(reqId);
      if (pending) {
        clearTimeout(pending.timer);
        _pendingRequests.delete(reqId);
        pending.resolve({
          ok: !!data.ok,
          error: data.error || "",
          content: data.content || ""
        });
        return;
      }
      for (const [id, entry] of _pendingRequests.entries()) {
        if (entry.action === data.configAction) {
          clearTimeout(entry.timer);
          _pendingRequests.delete(id);
          entry.resolve({
            ok: !!data.ok,
            error: data.error || "",
            content: data.content || ""
          });
          break;
        }
      }
    });
    return true;
  }
  function sendConfigRequest(payload, expectedAction, timeoutMs = 6e3) {
    ensureConfigControlListener();
    if (!belaControlReady()) {
      return Promise.resolve({
        ok: false,
        error: "Bela control WebSocket not connected"
      });
    }
    const reqId = `${expectedAction}_${Date.now()}_${++_reqSeq}`;
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        _pendingRequests.delete(reqId);
        resolve({
          ok: false,
          error: `Timeout waiting for Bela (${expectedAction})`
        });
      }, timeoutMs);
      _pendingRequests.set(reqId, { action: expectedAction, resolve, timer });
      Bela.control.send(__spreadProps(__spreadValues({ event: "custom" }, payload), { reqId }));
    });
  }
  async function fetchBoardConfigJson() {
    const baseUrl = projectFileUrl("config.json");
    const sep = baseUrl.indexOf("?") >= 0 ? "&" : "?";
    const url = `${baseUrl}${sep}t=${Date.now()}`;
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) {
        return {
          ok: false,
          status: res.status,
          error: res.status === 404 ? "config.json not found on Bela" : `HTTP ${res.status}`
        };
      }
      const text = await res.text();
      const parsed = JSON.parse(text);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        return { ok: false, error: "Invalid config.json object on Bela" };
      }
      return { ok: true, text, parsed };
    } catch (err) {
      return { ok: false, error: err && err.message ? err.message : "Fetch failed" };
    }
  }
  function getEffectiveRouting() {
    const ctx = getContext();
    if (ctx && ctx.boardConfigJson && ctx.boardConfigJson.routing && typeof ctx.boardConfigJson.routing === "object") {
      return ctx.boardConfigJson.routing;
    }
    return ROUTING_CONFIG;
  }
  function saveConfigToBela(jsonText) {
    return sendConfigRequest(
      { saveConfigText: escapeAsciiJson(jsonText) },
      "save",
      8e3
    );
  }
  function readConfigViaControl() {
    return sendConfigRequest({ readConfig: true }, "read", 5e3);
  }
  function restartBelaAudio() {
    return sendConfigRequest({ restartAudio: true }, "restartAudio", 5e3);
  }
  function rebootBelaBoard() {
    return sendConfigRequest({ rebootBoard: true }, "rebootBoard", 5e3);
  }

  // gui/dom/meters.js
  var INPUT_GAIN_MIN = -12;
  var INPUT_GAIN_MAX = 10;
  var INPUT_GAIN_STEP = 1;
  var OUTPUT_GAIN_MIN = -63;
  var OUTPUT_GAIN_MAX = 0;
  var OUTPUT_GAIN_STEP = 1;
  var METER_COUNT = 13;
  var CLIP_BADGE_LABELS = {
    aux1: "AUX1",
    aux2: "AUX2",
    aux3: "AUX3",
    aux4: "AUX4",
    fx1Return: "FX1R",
    fx2Return: "FX2R",
    master: "MASTER",
    fx1Send: "FX1S",
    fx2Send: "FX2S",
    vuSub: "SUB",
    vuKick: "KICK",
    vuMid: "MID",
    vuTop: "TOP"
  };
  var _clipBadgesByIdx = null;
  var _inputPickers = new Array(10).fill(null);
  var _outputPickers = new Array(10).fill(null);
  var _inputGainSyncHoldUntil = new Array(10).fill(0);
  var _outputGainSyncHoldUntil = new Array(10).fill(0);
  var GAIN_SYNC_HOLD_MS = 2500;
  function _holdCodecGainSync(ch, isInput) {
    const until = Date.now() + GAIN_SYNC_HOLD_MS;
    if (isInput) _inputGainSyncHoldUntil[ch] = until;
    else _outputGainSyncHoldUntil[ch] = until;
  }
  function _sendGain(payload) {
    if (!belaControlReady()) return;
    Bela.control.send(payload);
  }
  var _masterStereoBtn = null;
  var _masterStereoSyncHoldUntil = 0;
  var MASTER_STEREO_SYNC_HOLD_MS = 2500;
  function _sendMasterStereo(payload) {
    if (!belaControlReady()) return;
    Bela.control.send(payload);
  }
  function _setMasterStereoBtnState(btn, isStereo) {
    if (!btn) return;
    if (isStereo) {
      btn.classList.remove("mono");
      btn.classList.add("stereo");
      btn.textContent = "STEREO";
      btn.title = "Master mode: Stereo (click for Mono L+R)";
    } else {
      btn.classList.remove("stereo");
      btn.classList.add("mono");
      btn.textContent = "MONO";
      btn.title = "Master mode: Mono L+R (click for Stereo)";
    }
  }
  function _buildMeterGainControls(initVal, min, max, step, onSend) {
    const btnDec = el("button", {
      className: "meter-gain-btn meter-gain-btn--dec",
      title: `-${step} dB`,
      type: "button"
    });
    const btnInc = el("button", {
      className: "meter-gain-btn meter-gain-btn--inc",
      title: `+${step} dB`,
      type: "button"
    });
    const valEl = el("div", { className: "meter-gain-val" });
    btnDec.textContent = "\u2212";
    btnInc.textContent = "+";
    let current = initVal;
    function refresh() {
      valEl.textContent = String(current) + "\u202FdB";
      btnDec.disabled = current <= min;
      btnInc.disabled = current >= max;
    }
    function tryChange(delta) {
      const next = current + delta;
      if (next < min || next > max) return;
      current = next;
      refresh();
      onSend(current);
    }
    function setValue(v) {
      const clamped = Math.round(Math.max(min, Math.min(max, v)));
      if (clamped === current) return;
      current = clamped;
      refresh();
    }
    function getValue() {
      return current;
    }
    btnDec.addEventListener("click", (e) => {
      e.stopPropagation();
      tryChange(-step);
    });
    btnInc.addEventListener("click", (e) => {
      e.stopPropagation();
      tryChange(+step);
    });
    refresh();
    return { btnDec, btnInc, valEl, setValue, getValue };
  }
  function _buildGainByBuf3(inputChannels, outputChannels) {
    const map = {};
    inputChannels.forEach(({ ch, label, buf3, gain }) => {
      if (buf3 !== void 0)
        map[buf3] = { kind: "input", ch, label, gain: gain != null ? gain : 0 };
    });
    outputChannels.forEach(({ ch, label, buf3, gain }) => {
      if (buf3 !== void 0)
        map[buf3] = { kind: "output", ch, label, gain: gain != null ? gain : 0 };
    });
    return map;
  }
  function _createInlineGain(desc) {
    const { kind, ch, label } = desc;
    const isInput = kind === "input";
    const min = isInput ? INPUT_GAIN_MIN : OUTPUT_GAIN_MIN;
    const max = isInput ? INPUT_GAIN_MAX : OUTPUT_GAIN_MAX;
    const step = isInput ? INPUT_GAIN_STEP : OUTPUT_GAIN_STEP;
    const init = desc.gain != null ? desc.gain : 0;
    const controls = _buildMeterGainControls(init, min, max, step, (val) => {
      _holdCodecGainSync(ch, isInput);
      if (isInput) {
        _sendGain({ event: "custom", inputGain: val, channel: ch });
      } else {
        _sendGain({ event: "custom", hpGain: val, channel: ch });
      }
    });
    controls.btnDec.title = `${label}: -${step} dB`;
    controls.btnInc.title = `${label}: +${step} dB`;
    controls.valEl.title = isInput ? `${label} ADC gain (\u221212\u202610 dB)` : `${label} DAC gain (\u221263\u20260 dB)`;
    if (isInput)
      _inputPickers[ch] = controls;
    else
      _outputPickers[ch] = controls;
    return controls;
  }
  function syncCodecGains(buf) {
    if (!buf || buf.length < 20) return;
    getContext().lastCodecGainsBuf = buf;
    const now = Date.now();
    for (let ch = 0; ch < 10; ch++) {
      const inPicker = _inputPickers[ch];
      if (inPicker) {
        const remote = Math.round(buf[ch]);
        if (now < _inputGainSyncHoldUntil[ch]) {
          if (inPicker.getValue() === remote)
            _inputGainSyncHoldUntil[ch] = 0;
        } else {
          inPicker.setValue(remote);
        }
      }
      const outPicker = _outputPickers[ch];
      if (outPicker) {
        const remote = Math.round(buf[10 + ch]);
        if (now < _outputGainSyncHoldUntil[ch]) {
          if (outPicker.getValue() === remote)
            _outputGainSyncHoldUntil[ch] = 0;
        } else {
          outPicker.setValue(remote);
        }
      }
    }
  }
  function createVuMeter(canvas, config) {
    const max = config.max || 100;
    const boxCount = config.boxCount || 15;
    const boxCountRed = config.boxCountRed || 2;
    const boxCountYellow = config.boxCountYellow || 3;
    const boxGapFraction = config.boxGapFraction || 0.25;
    const redStart = boxCount - boxCountRed + 1;
    const yellowStart = boxCount - boxCountRed - boxCountYellow + 1;
    const redOn = "rgba(255,47,30,0.9)";
    const redOff = "rgba(64,12,8,0.9)";
    const yellowOn = "rgba(255,215,5,0.9)";
    const yellowOff = "rgba(64,53,0,0.9)";
    const greenOn = "rgba(53,255,30,0.9)";
    const greenOff = "rgba(13,64,8,0.9)";
    const ctx2d = canvas.getContext("2d");
    let width = 0;
    let height = 0;
    let boxHeight = 0;
    let boxGapY = 0;
    let boxWidth = 0;
    let boxGapX = 0;
    let curVal = 0;
    let curPeakVal = 0;
    let lastLitBoxes = -1;
    let lastPeakPx = -1;
    let needsRedraw = true;
    function resize() {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      const style = window.getComputedStyle(canvas);
      let cssW = rect.width;
      let cssH = rect.height;
      if (cssW < 2) cssW = parseFloat(style.width) || VU_CANVAS_W;
      if (cssH < 2) cssH = parseFloat(style.height) || VU_CANVAS_H;
      const newW = Math.max(1, Math.round(cssW));
      const newH = Math.max(1, Math.round(cssH));
      const pxW = Math.round(newW * dpr);
      const pxH = Math.round(newH * dpr);
      if (newW === width && newH === height && canvas.width === pxW && canvas.height === pxH)
        return;
      width = newW;
      height = newH;
      canvas.width = pxW;
      canvas.height = pxH;
      ctx2d.setTransform(dpr, 0, 0, dpr, 0, 0);
      boxWidth = width / (boxCount + (boxCount + 1) * boxGapFraction);
      boxGapX = boxWidth * boxGapFraction;
      boxHeight = Math.max(8, height - boxGapX * 2);
      boxGapY = boxGapX;
      needsRedraw = true;
    }
    function litBoxCount(val) {
      return Math.ceil(val / max * boxCount);
    }
    function boxColor(id, lit) {
      const on = id <= lit;
      if (id >= redStart) return on ? redOn : redOff;
      if (id >= yellowStart) return on ? yellowOn : yellowOff;
      return on ? greenOn : greenOff;
    }
    function drawBoxes(lit) {
      ctx2d.save();
      ctx2d.translate(boxGapX, boxGapY);
      for (let i = 0; i < boxCount; i++) {
        const id = i + 1;
        ctx2d.fillStyle = boxColor(id, lit);
        ctx2d.fillRect(0, 0, boxWidth, boxHeight);
        ctx2d.translate(boxWidth + boxGapX, 0);
      }
      ctx2d.restore();
    }
    function drawPeakIndicator(peakVal) {
      if (peakVal < 1.5) return;
      const innerLeft = boxGapX;
      const innerRight = width - boxGapX;
      const x = innerLeft + peakVal / max * (innerRight - innerLeft);
      ctx2d.strokeStyle = "#fff";
      ctx2d.lineWidth = 2;
      ctx2d.beginPath();
      ctx2d.moveTo(x, boxGapY);
      ctx2d.lineTo(x, height - boxGapY);
      ctx2d.stroke();
    }
    if (typeof ResizeObserver !== "undefined") {
      new ResizeObserver(() => {
        resize();
      }).observe(canvas);
    }
    resize();
    return {
      /** Sets current level and peak-hold percentages (0–max). */
      setTargets(level, peak) {
        curVal = Math.max(0, Math.min(max, level));
        curPeakVal = Math.max(0, Math.min(max, peak));
      },
      /** Returns peak position as 0–100 (for peak label placement). */
      getPeakPct() {
        return curPeakVal;
      },
      /** Redraws only when lit boxes or peak pixel position changed. */
      draw() {
        const lit = litBoxCount(curVal);
        const peakPx = curPeakVal < 1.5 ? -1 : Math.round(curPeakVal / max * width);
        if (!needsRedraw && lit === lastLitBoxes && peakPx === lastPeakPx)
          return;
        lastLitBoxes = lit;
        lastPeakPx = peakPx;
        needsRedraw = false;
        ctx2d.fillStyle = "rgb(32,32,32)";
        ctx2d.fillRect(0, 0, width, height);
        drawBoxes(lit);
        drawPeakIndicator(curPeakVal);
      },
      resize
    };
  }
  function levelToBarPct(raw) {
    const dB = raw > 32e-6 ? 20 * Math.log10(raw) : -90;
    return (Math.max(dB, -60) + 60) / 60 * 100;
  }
  function levelToDbLabel(raw) {
    const dB = raw > 32e-6 ? 20 * Math.log10(raw) : -90;
    return dB < -80 ? "-\u221E" : dB.toFixed(1) + "\u202FdB";
  }
  function ensureClipBadges(forceRebuild = false) {
    const host = document.getElementById("clip-badges");
    if (!host) return null;
    if (!forceRebuild && _clipBadgesByIdx) {
      const sample = Object.values(_clipBadgesByIdx)[0];
      if (sample && sample.isConnected) return _clipBadgesByIdx;
    }
    _clipBadgesByIdx = null;
    host.innerHTML = "";
    const { inputChannels, outputChannels } = buildFullRouting(getEffectiveRouting());
    const byIdx = {};
    [...inputChannels, ...outputChannels].forEach((ch) => {
      if (ch.buf3 == null || byIdx[ch.buf3]) return;
      const label = CLIP_BADGE_LABELS[ch.key] || ch.label;
      const badge = el("span", {
        className: "badge clip",
        id: "clip-badge-" + ch.buf3,
        title: label + " clipping",
        "aria-hidden": "true"
      });
      badge.textContent = label;
      badge.dataset.buf3 = String(ch.buf3);
      host.appendChild(badge);
      byIdx[ch.buf3] = badge;
    });
    _clipBadgesByIdx = byIdx;
    return byIdx;
  }
  function updateClipIndicators() {
    const ctx = getContext();
    const now = performance.now();
    const badges = ensureClipBadges();
    for (let i = 0; i < METER_COUNT; i++) {
      const raw = ctx.audioLevels[i] || 0;
      if (raw >= CLIP_THRESHOLD || ctx.peakHoldLevel[i] >= CLIP_THRESHOLD)
        ctx.clipHoldUntil[i] = now + CLIP_HOLD_MS;
      const clipping = now < ctx.clipHoldUntil[i];
      if (badges && badges[i]) {
        const on = clipping;
        if (badges[i].classList.contains("on") !== on) {
          badges[i].classList.toggle("on", on);
          badges[i].setAttribute("aria-hidden", on ? "false" : "true");
        }
      }
      const clipLed = ctx.meterClipLeds[i];
      if (clipLed) {
        const on = clipping;
        if (clipLed.classList.contains("on") !== on) {
          clipLed.classList.toggle("on", on);
          clipLed.setAttribute(
            "aria-label",
            on ? "Clip indicator on" : "Clip indicator off"
          );
        }
      }
      const peakDb = ctx.meterPeakDbs[i];
      if (peakDb)
        peakDb.classList.toggle("clip", clipping);
    }
  }
  function clearClipBadges() {
    const badges = _clipBadgesByIdx || ensureClipBadges();
    if (!badges) return;
    Object.keys(badges).forEach((k) => {
      const b = badges[k];
      if (!b.classList.contains("on")) return;
      b.classList.remove("on");
      b.setAttribute("aria-hidden", "true");
    });
    const ctx = getContext();
    if (ctx && ctx.clipHoldUntil)
      ctx.clipHoldUntil.fill(0);
  }
  function _populateMetersColumns(columns) {
    const routing = getEffectiveRouting();
    const { levelGroups, levelLabels, inputChannels, outputChannels } = buildFullRouting(routing);
    const gainByBuf3 = _buildGainByBuf3(inputChannels, outputChannels);
    for (let ch = 0; ch < 10; ch++) {
      _inputPickers[ch] = null;
      _outputPickers[ch] = null;
    }
    _masterStereoBtn = null;
    const ctx = getContext();
    ctx.meterVu = [];
    ctx.meterPeakDbs = [];
    ctx.meterClipLeds = [];
    levelGroups.forEach((group) => {
      const card = el("div", { className: "card meters-card" });
      card.appendChild(cardTitle(group.label));
      const row = el("div", { className: "meter-group" });
      group.indices.forEach((idx) => {
        const chRow = el("div", { className: "meter-ch" });
        const mid = el("div", { className: "meter-id" });
        const lbl = el("div", { className: "meter-lbl" });
        lbl.textContent = levelLabels[idx] || String(idx);
        mid.appendChild(lbl);
        if (idx === ROUTING_KEY_TO_BUFFER3.master) {
          const initIsStereo = routing.out && routing.out.master && routing.out.master.stereo !== void 0 ? !!routing.out.master.stereo : true;
          const modeBtn = el("button", {
            className: "meter-mode-btn " + (initIsStereo ? "stereo" : "mono"),
            type: "button"
          });
          _setMasterStereoBtnState(modeBtn, initIsStereo);
          modeBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            const currentIsStereo = modeBtn.classList.contains("stereo");
            const nextIsStereo = !currentIsStereo;
            _setMasterStereoBtnState(modeBtn, nextIsStereo);
            _masterStereoSyncHoldUntil = Date.now() + MASTER_STEREO_SYNC_HOLD_MS;
            _sendMasterStereo({ event: "custom", masterStereo: nextIsStereo });
          });
          _masterStereoBtn = modeBtn;
          mid.appendChild(modeBtn);
        }
        const gainDesc = gainByBuf3[idx];
        const gainCtrl = gainDesc ? _createInlineGain(gainDesc) : null;
        if (gainCtrl)
          mid.appendChild(gainCtrl.valEl);
        const strip = el("div", { className: "meter-strip" });
        const body = el("div", { className: "meter-body" });
        const mwrap = el("div", { className: "meter-wrap" });
        mwrap.title = "Click to reset peak hold";
        const cnv = el("canvas", { className: "meter-canvas", id: "mc-" + idx });
        ctx.meterVu[idx] = createVuMeter(cnv, {
          boxCount: VU_BOX_COUNT,
          boxCountRed: VU_BOX_COUNT_RED,
          boxCountYellow: VU_BOX_COUNT_YELLOW,
          boxGapFraction: VU_BOX_GAP_FRACTION,
          max: VU_MAX
        });
        const peakDb = el("div", { className: "meter-peak-db", id: "mpd-" + idx });
        peakDb.style.left = "0%";
        peakDb.textContent = "-\u221E";
        ctx.meterPeakDbs[idx] = peakDb;
        const clipLed = el("div", {
          className: "meter-clip-led",
          id: "mclip-" + idx,
          title: "Clip (\u2265 " + (CLIP_THRESHOLD * 100).toFixed(0) + "% full scale)",
          role: "img",
          "aria-label": "Clip indicator off"
        });
        clipLed.innerHTML = '<span class="meter-clip-led__bezel"></span><span class="meter-clip-led__core"></span>';
        ctx.meterClipLeds[idx] = clipLed;
        mwrap.addEventListener("click", () => {
          ctx.peakHoldLevel[idx] = 0;
          ctx.peakHoldExpire[idx] = 0;
        });
        const scale = el("div", { className: "meter-scale" });
        for (let t = 0; t < VU_SCALE_TICKS.length; t++) {
          const tick = el("span");
          tick.textContent = String(VU_SCALE_TICKS[t]);
          scale.appendChild(tick);
        }
        mwrap.appendChild(cnv);
        mwrap.appendChild(peakDb);
        body.appendChild(mwrap);
        body.appendChild(scale);
        if (gainCtrl) {
          strip.appendChild(gainCtrl.btnDec);
          strip.appendChild(body);
          strip.appendChild(gainCtrl.btnInc);
        } else {
          strip.appendChild(body);
        }
        chRow.appendChild(strip);
        chRow.appendChild(clipLed);
        chRow.appendChild(mid);
        row.appendChild(chRow);
      });
      card.appendChild(row);
      columns.appendChild(card);
    });
  }
  function buildMetersSection() {
    const wrap = el("div", { id: "meters-wrap" });
    const columns = el("div", { className: "meters-columns" });
    _populateMetersColumns(columns);
    wrap.appendChild(columns);
    return wrap;
  }
  function rebuildMetersSection() {
    ensureClipBadges(true);
    const wrap = document.getElementById("meters-wrap");
    if (!wrap) return;
    const columns = el("div", { className: "meters-columns" });
    _populateMetersColumns(columns);
    wrap.innerHTML = "";
    wrap.appendChild(columns);
    _inputGainSyncHoldUntil.fill(0);
    _outputGainSyncHoldUntil.fill(0);
    _masterStereoSyncHoldUntil = 0;
    const ctx = getContext();
    if (ctx.configMeta) syncMasterStereo(ctx.configMeta);
    if (ctx.lastCodecGainsBuf) syncCodecGains(ctx.lastCodecGainsBuf);
    if (ctx.currentTab === TAB_LIVE) {
      ctx.meterVu.forEach((vu) => {
        if (vu) vu.resize();
      });
    }
  }
  function startMeterAnim() {
    if (getContext().meterAnimId != null) return;
    function tick() {
      const ctx = getContext();
      if (ctx.currentTab !== TAB_LIVE) {
        ctx.meterAnimId = null;
        return;
      }
      updateMetersFrame();
      ctx.meterAnimId = requestAnimationFrame(tick);
    }
    getContext().meterAnimId = requestAnimationFrame(tick);
  }
  function stopMeterAnim() {
    const ctx = getContext();
    if (ctx.meterAnimId == null) return;
    cancelAnimationFrame(ctx.meterAnimId);
    ctx.meterAnimId = null;
  }
  function updateMetersFrame() {
    const ctx = getContext();
    const now = performance.now();
    for (let i = 0; i < METER_COUNT; i++) {
      if (!ctx.meterVu[i]) continue;
      const raw = ctx.audioLevels[i];
      const smooth = ctx.meterSmooth[i];
      const coeff = raw > smooth ? METER_ATTACK : METER_RELEASE;
      ctx.meterSmooth[i] = smooth + (raw - smooth) * coeff;
      if (raw > ctx.peakHoldLevel[i]) {
        ctx.peakHoldLevel[i] = raw;
        ctx.peakHoldExpire[i] = now + PEAK_HOLD_MS;
      } else if (now >= ctx.peakHoldExpire[i]) {
        ctx.peakHoldLevel[i] *= PEAK_DECAY;
      }
    }
    updateClipIndicators();
    for (let i = 0; i < METER_COUNT; i++) {
      const vu = ctx.meterVu[i];
      if (!vu) continue;
      const peakDb = ctx.meterPeakDbs[i];
      vu.setTargets(
        levelToBarPct(ctx.meterSmooth[i]),
        levelToBarPct(ctx.peakHoldLevel[i])
      );
      vu.draw();
      if (peakDb) {
        const pkPct = vu.getPeakPct();
        const peakLbl = levelToDbLabel(ctx.peakHoldLevel[i]);
        if (peakDb.textContent !== peakLbl)
          peakDb.textContent = peakLbl;
        const left = pkPct.toFixed(2) + "%";
        if (peakDb.style.left !== left)
          peakDb.style.left = left;
        const op = pkPct > 1.5 ? "1" : "0";
        if (peakDb.style.opacity !== op)
          peakDb.style.opacity = op;
      }
    }
  }
  function syncMasterStereo(meta) {
    if (!meta || meta.length <= CONFIG_META.MASTER_STEREO) return;
    const remoteIsStereo = meta[CONFIG_META.MASTER_STEREO] > 0.5;
    const now = Date.now();
    if (_masterStereoBtn) {
      if (now < _masterStereoSyncHoldUntil) {
        const currentIsStereo = _masterStereoBtn.classList.contains("stereo");
        if (currentIsStereo === remoteIsStereo) {
          _masterStereoSyncHoldUntil = 0;
        }
      } else {
        _setMasterStereoBtnState(_masterStereoBtn, remoteIsStereo);
      }
    }
  }

  // gui/dom/mapping.js
  var ROUTING_CH_MIN = 0;
  var ROUTING_CH_MAX = 9;
  var INPUT_GAIN_MIN2 = -12;
  var INPUT_GAIN_MAX2 = 10;
  var OUTPUT_GAIN_MIN2 = -63;
  var OUTPUT_GAIN_MAX2 = 0;
  var GUIDED_SETTLE_MS = 450;
  var DEFAULT_CONFIG_COMMENT = "Dub Preamp BELA GEM MULTI -- hardware mapping config. Edit this file to remap pots/switches without recompiling. Restart the Bela project to apply changes.";
  var ICON_DOWNLOAD = ["M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4", "M7 10l5 5 5-5", "M12 15V3"];
  var ICON_UPLOAD = ["M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4", "M17 8l-5-5-5 5", "M12 3v12"];
  var ICON_SAVE = ["M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z", "M17 21v-8H7v8", "M7 3v5h8"];
  var ICON_RESTART = ["M23 4v6h-6", "M1 20v-6h6", "M3.51 9a9 9 0 0 1 14.85-3.36L23 10", "M1 14l4.64 4.36A9 9 0 0 0 20.49 15"];
  var ROUTING_IN_KEYS = ["aux1", "aux2", "aux3", "aux4", "fx1Return", "fx2Return"];
  var ROUTING_OUT_KEYS = ["master", "fx1Send", "fx2Send", "vuSub", "vuKick", "vuMid", "vuTop"];
  var ROUTING_LABELS = {
    aux1: "AUX 1",
    aux2: "AUX 2",
    aux3: "AUX 3",
    aux4: "AUX 4",
    fx1Return: "FX1 Return",
    fx2Return: "FX2 Return",
    master: "Master Out",
    fx1Send: "FX1 Send",
    fx2Send: "FX2 Send",
    vuSub: "VU Sub",
    vuKick: "VU Kick",
    vuMid: "VU Mid",
    vuTop: "VU Top"
  };
  var POT_INDEX = Object.fromEntries(POT_NAMES.map((n, i) => [n, i]));
  var SW_INDEX = Object.fromEntries(SWITCH_NAMES.map((n, i) => [n, i]));
  var CONTROL_GROUPS = [
    {
      id: "master",
      title: "Master & Filters",
      defaultOpen: true,
      items: [
        { table: "pot", name: "MASTER_GAIN", label: "Master Gain" },
        { table: "pot", name: "MASTER_HPF_FREQ", label: "HPF Freq" },
        { table: "pot", name: "MASTER_HPF_RES", label: "HPF Resonance" },
        { table: "pot", name: "MASTER_LPF_FREQ", label: "LPF Freq" },
        { table: "pot", name: "MASTER_LPF_RES", label: "LPF Resonance" },
        { table: "pot", name: "BTRIM_SUB", label: "Band Trim Sub" },
        { table: "pot", name: "BTRIM_KICK", label: "Band Trim Kick" },
        { table: "pot", name: "BTRIM_MID", label: "Band Trim Mid" },
        { table: "pot", name: "BTRIM_TOP", label: "Band Trim Top" },
        { table: "sw", name: "KILL_SUB", label: "Kill Sub" },
        { table: "sw", name: "KILL_KICK", label: "Kill Kick" },
        { table: "sw", name: "KILL_MID", label: "Kill Mid" },
        { table: "sw", name: "KILL_TOP", label: "Kill Top" }
      ]
    },
    ...[1, 2, 3, 4].map((n) => ({
      id: "aux" + n,
      title: "AUX " + n,
      defaultOpen: n === 1,
      items: [
        { table: "pot", name: `AUX${n}_INPUT_GAIN`, label: "Input Gain" },
        { table: "pot", name: `AUX${n}_EQ_HIGH`, label: "EQ High" },
        { table: "pot", name: `AUX${n}_EQ_MID`, label: "EQ Mid" },
        { table: "pot", name: `AUX${n}_EQ_LOW`, label: "EQ Low" },
        { table: "pot", name: `AUX${n}_FX_SEND`, label: "FX1 Send" },
        { table: "pot", name: `AUX${n}_FX2_SEND`, label: "FX2 Send" }
      ]
    })),
    {
      id: "peq",
      title: "Parametric EQ",
      defaultOpen: false,
      items: [
        { table: "pot", name: "MASTER_EQ_SUB_FREQ", label: "Sub Freq" },
        { table: "pot", name: "MASTER_EQ_SUB_GAIN", label: "Sub Gain" },
        { table: "pot", name: "MASTER_EQ_KICK_FREQ", label: "Kick Freq" },
        { table: "pot", name: "MASTER_EQ_KICK_GAIN", label: "Kick Gain" },
        { table: "pot", name: "MASTER_EQ_MID_FREQ", label: "Mid Freq" },
        { table: "pot", name: "MASTER_EQ_MID_GAIN", label: "Mid Gain" },
        { table: "pot", name: "MASTER_EQ_TOP_FREQ", label: "Top Freq" },
        { table: "pot", name: "MASTER_EQ_TOP_GAIN", label: "Top Gain" }
      ]
    },
    {
      id: "geq",
      title: "Graphic EQ (12-Band)",
      defaultOpen: false,
      items: [
        "40HZ",
        "60HZ",
        "80HZ",
        "100HZ",
        "125HZ",
        "250HZ",
        "500HZ",
        "1KHZ",
        "2KHZ",
        "4KHZ",
        "8KHZ",
        "16KHZ"
      ].map((f) => ({
        table: "pot",
        name: "GEQ_" + f,
        label: f.replace("HZ", " Hz").replace("KHZ", " kHz")
      }))
    },
    {
      id: "fx_siren",
      title: "Siren & FX",
      defaultOpen: false,
      items: [
        { table: "pot", name: "SIREN_TYPE", label: "Siren Preset" },
        { table: "pot", name: "SIREN_MOD", label: "Siren Mod" },
        { table: "pot", name: "SIREN_GAIN", label: "Siren Gain" },
        { table: "pot", name: "SIREN_FX_SEND", label: "Siren FX1 Send" },
        { table: "pot", name: "SIREN_FX2_SEND", label: "Siren FX2 Send" },
        { table: "sw", name: "SIREN_TRIGGER", label: "Siren Gate" },
        { table: "pot", name: "FX1_RETURN_GAIN", label: "FX1 Return Gain" },
        { table: "pot", name: "FX2_RETURN_GAIN", label: "FX2 Return Gain" },
        { table: "sw", name: "FX_FILTER_MIDS", label: "FX1 Filter Mids" },
        { table: "sw", name: "FX_FILTER_TOPS", label: "FX1 Filter Tops" },
        { table: "sw", name: "FX2_FILTER_MIDS", label: "FX2 Filter Mids" },
        { table: "sw", name: "FX2_FILTER_TOPS", label: "FX2 Filter Tops" }
      ]
    }
  ];
  var _guidedTimer = null;
  var _potLiveFills = new Array(POT_NAMES.length);
  var _swLiveFills = new Array(SWITCH_NAMES.length);
  var _potRevButtons = new Array(POT_NAMES.length);
  var _swRevButtons = new Array(SWITCH_NAMES.length);
  var _hwValues = {};
  var _clipLedInputs = {};
  var _devModeBootCb = null;
  var _modalOverlay = null;
  var _modalEscBound = null;
  var _statusClearTimer = null;
  function setMappingDirty(dirty) {
    const ctx = getContext();
    ctx.mappingDirty = !!dirty;
    const pill = document.getElementById("map-dirty-pill");
    if (pill) {
      pill.classList.toggle("show", ctx.mappingDirty);
    }
  }
  function markMappingDirty() {
    setMappingDirty(true);
  }
  function setActionButtonsDisabled(disabled) {
    getContext().mappingActionBusy = !!disabled;
    ["btn-load-config", "btn-save-config", "btn-restart-audio", "btn-download", "btn-reboot-bela"].forEach((id) => {
      const b = document.getElementById(id);
      if (b) b.disabled = !!disabled;
    });
  }
  function routingInChannel(val) {
    if (val != null && typeof val === "object" && !Array.isArray(val)) {
      if (Array.isArray(val.channels)) return val.channels;
      if (val.channel != null) {
        if (val.channelR != null && val.channelR >= 0) return [val.channel, val.channelR];
        return val.channel;
      }
      return 0;
    }
    if (Array.isArray(val)) return val;
    return val != null ? val : 0;
  }
  function routingOutChannel(val) {
    if (val != null && typeof val === "object" && !Array.isArray(val)) {
      if (Array.isArray(val.channels)) return val.channels;
      return val.channel != null ? val.channel : 0;
    }
    if (Array.isArray(val)) return val;
    return val;
  }
  function routingOutStereo(val) {
    if (val != null && typeof val === "object" && !Array.isArray(val)) {
      if (val.stereo !== void 0) return !!val.stereo;
      if (val.mono !== void 0) return !val.mono;
    }
    return true;
  }
  function routingInMic(val) {
    return val != null && typeof val === "object" && !Array.isArray(val) ? !!val.mic : false;
  }
  function routingInHpf(val) {
    if (val != null && typeof val === "object" && !Array.isArray(val)) {
      const h = Number(val.hpf);
      return isNaN(h) ? 0 : h;
    }
    return 0;
  }
  function routingGain(val) {
    if (val != null && typeof val === "object" && !Array.isArray(val)) {
      const g = Number(val.gain);
      return isNaN(g) ? 0 : g;
    }
    return 0;
  }
  function buildMappingPane() {
    const ctx = getContext();
    const pane = el("div", { id: "pane-mapping", className: "tab-pane" });
    const topbar = el("div", { className: "map-topbar" });
    const subtabs = el("div", { className: "map-subtabs", role: "tablist", "aria-label": "Mapping sections" });
    [
      { id: "controls", label: "Controls" },
      { id: "io", label: "Audio I/O" },
      { id: "advanced", label: "Advanced" }
    ].forEach((t) => {
      const active = ctx.mappingSubTab === t.id;
      const btn = el("button", {
        type: "button",
        className: "map-subtab" + (active ? " active" : ""),
        role: "tab",
        "aria-selected": active ? "true" : "false",
        textContent: t.label
      });
      btn.dataset.subtab = t.id;
      btn.addEventListener("click", () => setMappingSubTab(t.id));
      subtabs.appendChild(btn);
    });
    topbar.appendChild(subtabs);
    const dirtyPill = el("span", {
      id: "map-dirty-pill",
      className: "map-dirty-pill" + (ctx.mappingDirty ? " show" : ""),
      textContent: "Unsaved",
      title: "Local changes not yet saved to Bela"
    });
    topbar.appendChild(dirtyPill);
    const actions = el("div", { className: "map-topbar-actions" });
    const conflictPill = el("button", {
      type: "button",
      id: "map-conflict-pill",
      className: "map-conflict-pill",
      textContent: "0 Conflicts"
    });
    conflictPill.addEventListener("click", () => {
      const box = document.getElementById("mapping-conflicts");
      if (box) box.scrollIntoView({ behavior: "smooth", block: "nearest" });
      if (ctx.mappingSubTab === "controls") {
        setMappingFilter("conflicts");
      }
    });
    actions.appendChild(conflictPill);
    ctx.downloadStatusEl = el("div", {
      id: "download-status",
      className: "map-toast",
      role: "status",
      "aria-live": "polite"
    });
    pane.appendChild(ctx.downloadStatusEl);
    const fileInput = el("input", {
      type: "file",
      id: "map-load-file",
      accept: ".json,application/json",
      style: "display:none",
      "aria-label": "Load config.json file"
    });
    fileInput.addEventListener("change", handleLoadFileChange);
    actions.appendChild(fileInput);
    const loadBtn = el("button", {
      type: "button",
      id: "btn-load-config",
      className: "btn-map-secondary",
      title: "Load a local config.json file into the Mapping form"
    });
    loadBtn.appendChild(svgIcon(ICON_UPLOAD, "0 0 24 24", 14));
    loadBtn.appendChild(el("span", { textContent: "Load" }));
    loadBtn.addEventListener("click", () => fileInput.click());
    actions.appendChild(loadBtn);
    const exportBtn = el("button", {
      type: "button",
      id: "btn-download",
      className: "btn-map-secondary",
      title: "Download the exact config.json currently saved on Bela"
    });
    exportBtn.appendChild(svgIcon(ICON_DOWNLOAD, "0 0 24 24", 14));
    exportBtn.appendChild(el("span", { textContent: "Export config.json" }));
    exportBtn.addEventListener("click", exportBoardConfigJson);
    actions.appendChild(exportBtn);
    const saveBtn = el("button", {
      type: "button",
      id: "btn-save-config",
      className: "btn-save",
      title: "Save current Mapping form directly to config.json on Bela"
    });
    saveBtn.appendChild(svgIcon(ICON_SAVE, "0 0 24 24", 14));
    saveBtn.appendChild(el("span", { textContent: "Save" }));
    saveBtn.addEventListener("click", saveConfigAction);
    actions.appendChild(saveBtn);
    const restartBtn = el("button", {
      type: "button",
      id: "btn-restart-audio",
      className: "btn-restart",
      title: "Restart Bela audio program (~2\u20133 s, keeps Wi-Fi/hotspot connected)"
    });
    restartBtn.appendChild(svgIcon(ICON_RESTART, "0 0 24 24", 14));
    restartBtn.appendChild(el("span", { textContent: "Restart" }));
    restartBtn.addEventListener("click", confirmAndRestartAudio);
    actions.appendChild(restartBtn);
    topbar.appendChild(actions);
    pane.appendChild(topbar);
    const conflicts = el("div", { id: "mapping-conflicts", className: "map-conflicts-box" });
    conflicts.innerHTML = '<strong>Conflicts</strong><ul id="mapping-conflicts-list"></ul>';
    pane.appendChild(conflicts);
    const detectBanner = el("div", { id: "detect-status" });
    ctx.detectStatusEl = detectBanner;
    pane.appendChild(detectBanner);
    pane.appendChild(buildControlsView());
    pane.appendChild(buildRoutingView());
    pane.appendChild(buildAdvancedView());
    setMappingSubTab(ctx.mappingSubTab || "controls");
    return pane;
  }
  function setMappingSubTab(subId) {
    const ctx = getContext();
    if (subId !== "controls") cancelDetect();
    ctx.mappingSubTab = subId;
    document.querySelectorAll(".map-subtab").forEach((btn) => {
      const active = btn.dataset.subtab === subId;
      btn.classList.toggle("active", active);
      btn.setAttribute("aria-selected", active ? "true" : "false");
    });
    document.querySelectorAll(".map-subview").forEach((view) => {
      view.style.display = view.dataset.subview === subId ? "" : "none";
    });
  }
  function buildControlsView() {
    const view = el("div", { className: "map-subview" });
    view.dataset.subview = "controls";
    const guidedBar = el("div", { id: "map-guided-bar", className: "map-guided-bar" });
    const guidedInfo = el("div", { className: "map-guided-info" });
    guidedInfo.appendChild(el("div", { id: "map-guided-step", className: "map-guided-step", textContent: "Setup Assistant" }));
    guidedInfo.appendChild(el("div", { id: "map-guided-prompt", className: "map-guided-prompt", textContent: "Map pots and switches step by step" }));
    guidedBar.appendChild(guidedInfo);
    const guidedActions = el("div", { id: "map-guided-actions", className: "map-guided-actions" });
    const startBtn = el("button", {
      type: "button",
      id: "btn-guided-start",
      className: "btn-detect-row",
      textContent: "Guided Setup"
    });
    startBtn.addEventListener("click", startGuidedSetup);
    const skipBtn = el("button", {
      type: "button",
      id: "btn-guided-skip",
      className: "dev-small-btn",
      textContent: "Skip"
    });
    skipBtn.style.display = "none";
    skipBtn.addEventListener("click", skipGuidedStep);
    const stopBtn = el("button", {
      type: "button",
      id: "btn-guided-stop",
      className: "btn-del-ign",
      textContent: "Stop"
    });
    stopBtn.style.display = "none";
    stopBtn.addEventListener("click", cancelDetect);
    guidedActions.appendChild(startBtn);
    guidedActions.appendChild(skipBtn);
    guidedActions.appendChild(stopBtn);
    guidedBar.appendChild(guidedActions);
    view.appendChild(guidedBar);
    const filterBar = el("div", { className: "map-filter-bar" });
    const pills = el("div", { className: "map-filter-pills" });
    [
      { id: "all", label: "All" },
      { id: "pots", label: "Pots" },
      { id: "switches", label: "Switches" },
      { id: "conflicts", label: "Conflicts" }
    ].forEach((f) => {
      const b = el("button", {
        type: "button",
        className: "map-filter-pill" + (getContext().mappingFilter === f.id ? " active" : ""),
        textContent: f.label,
        "aria-pressed": getContext().mappingFilter === f.id ? "true" : "false"
      });
      b.dataset.filter = f.id;
      b.addEventListener("click", () => setMappingFilter(f.id));
      pills.appendChild(b);
    });
    filterBar.appendChild(pills);
    const searchInp = el("input", {
      type: "search",
      id: "map-search-input",
      className: "map-search",
      placeholder: "Filter controls\u2026",
      "aria-label": "Filter controls"
    });
    searchInp.addEventListener("input", () => {
      getContext().mappingSearch = searchInp.value.trim().toLowerCase();
      applyControlFilters();
    });
    filterBar.appendChild(searchInp);
    view.appendChild(filterBar);
    const groupsHost = el("div", { id: "map-groups-host", className: "map-groups" });
    groupsHost.appendChild(el("div", { className: "map-empty", textContent: "Waiting for Bela connection\u2026" }));
    view.appendChild(groupsHost);
    return view;
  }
  function setMappingFilter(filterId) {
    const ctx = getContext();
    ctx.mappingFilter = filterId;
    document.querySelectorAll(".map-filter-pill").forEach((b) => {
      const active = b.dataset.filter === filterId;
      b.classList.toggle("active", active);
      b.setAttribute("aria-pressed", active ? "true" : "false");
    });
    applyControlFilters();
  }
  function applyControlFilters() {
    const ctx = getContext();
    const filter = ctx.mappingFilter || "all";
    const q = ctx.mappingSearch || "";
    document.querySelectorAll("#map-groups-host .map-group").forEach((grp) => {
      let visibleCount = 0;
      grp.querySelectorAll(".map-row").forEach((row) => {
        const table = row.dataset.mapTable;
        const searchHay = (row.dataset.search || "").toLowerCase();
        const hasConflict = row.classList.contains("dup-conflict");
        let matchFilter = true;
        if (filter === "pots") matchFilter = table === "pot";
        else if (filter === "switches") matchFilter = table === "sw";
        else if (filter === "conflicts") matchFilter = hasConflict;
        const matchSearch = !q || searchHay.includes(q);
        const show = matchFilter && matchSearch;
        row.style.display = show ? "" : "none";
        if (show) visibleCount++;
      });
      grp.style.display = visibleCount > 0 ? "" : "none";
      if ((q || filter === "conflicts") && visibleCount > 0) {
        grp.dataset.collapsed = "false";
      }
    });
  }
  function buildRoutingView() {
    const view = el("div", { className: "map-subview", id: "routing-section" });
    view.dataset.subview = "io";
    const routing = getEffectiveRouting();
    const grid = el("div", { className: "map-io-grid" });
    grid.appendChild(buildRoutingCard("Inputs", "in", ROUTING_IN_KEYS, routing.in || {}, true));
    grid.appendChild(buildRoutingCard("Outputs", "out", ROUTING_OUT_KEYS, routing.out || {}, false));
    view.appendChild(grid);
    const onRoutingChange = () => {
      getContext().mappingUserEdited = true;
      markMappingDirty();
      updateMappingConflicts();
    };
    view.querySelectorAll(".ri, .ri-gain, .ri-mic, .ri-hpf, .ri-stereo").forEach((inp) => {
      inp.addEventListener("input", onRoutingChange);
      inp.addEventListener("change", onRoutingChange);
    });
    updateMappingConflicts();
    return view;
  }
  function buildRoutingCard(heading, dir, keys, values, isIn) {
    const card = el("div", { className: "card map-io-card" });
    card.appendChild(el("div", { className: "card-title", textContent: heading }));
    const list = el("div", { className: "map-io-list", id: `routing-${dir}-tbody` });
    const gainMin = isIn ? INPUT_GAIN_MIN2 : OUTPUT_GAIN_MIN2;
    const gainMax = isIn ? INPUT_GAIN_MAX2 : OUTPUT_GAIN_MAX2;
    keys.forEach((key) => {
      const raw = values[key];
      const isMaster = key === "master";
      const isAux = key.startsWith("aux");
      const isStereoCapable = isMaster || isAux;
      const channelVal = isIn ? routingInChannel(raw) : routingOutChannel(raw);
      const display = formatRoutingValue(channelVal, isStereoCapable);
      const gainVal = routingGain(raw);
      const row = el("div", { className: "map-io-row" });
      row.dataset.routingDir = dir;
      row.dataset.routingKey = key;
      row.appendChild(el("span", {
        className: "map-io-label",
        textContent: ROUTING_LABELS[key] || key,
        title: key
      }));
      const fields = el("div", { className: "map-io-fields" });
      const chField = el("label", { className: "map-field" });
      chField.appendChild(el("span", { className: "map-field-lbl", textContent: "Ch" }));
      const chInp = el("input", {
        type: isStereoCapable ? "text" : "number",
        value: display,
        className: isStereoCapable ? "ri" : "ri map-num",
        "aria-label": `${ROUTING_LABELS[key] || key} channel`
      });
      chInp.dataset.dir = dir;
      chInp.dataset.key = key;
      if (isStereoCapable) {
        chInp.placeholder = "0 or 0,1";
        chInp.spellcheck = false;
      } else {
        chInp.min = String(ROUTING_CH_MIN);
        chInp.max = String(ROUTING_CH_MAX);
        chInp.step = "1";
      }
      chField.appendChild(chInp);
      fields.appendChild(chField);
      const gField = el("label", { className: "map-field" });
      gField.appendChild(el("span", { className: "map-field-lbl", textContent: "dB" }));
      const gInp = el("input", {
        type: "number",
        className: "ri-gain map-num",
        value: String(gainVal),
        min: String(gainMin),
        max: String(gainMax),
        step: "1",
        title: isIn ? `Boot ADC gain (${gainMin}..${gainMax} dB)` : `Boot DAC gain (${gainMin}..${gainMax} dB)`,
        "aria-label": `${ROUTING_LABELS[key] || key} gain dB`
      });
      gInp.dataset.dir = dir;
      gInp.dataset.key = key;
      gField.appendChild(gInp);
      fields.appendChild(gField);
      if (isIn && isAux) {
        const micLbl = el("label", { className: "map-io-check", title: "Bypass master ParamEQ / filters / kills" });
        const micCb = el("input", {
          type: "checkbox",
          className: "ri-mic",
          checked: routingInMic(raw)
        });
        micCb.dataset.dir = dir;
        micCb.dataset.key = key;
        micLbl.appendChild(micCb);
        micLbl.appendChild(el("span", { textContent: "Mic" }));
        fields.appendChild(micLbl);
        const hpfField = el("label", { className: "map-field", title: "Mic dry HPF Hz (0 = off)" });
        hpfField.appendChild(el("span", { className: "map-field-lbl", textContent: "HPF" }));
        const hpfInp = el("input", {
          type: "number",
          className: "ri-hpf map-num",
          value: String(routingInHpf(raw)),
          min: String(MIC_HPF_HZ_MIN),
          max: String(MIC_HPF_HZ_MAX),
          step: "1",
          "aria-label": `${ROUTING_LABELS[key] || key} HPF Hz`
        });
        hpfInp.dataset.dir = dir;
        hpfInp.dataset.key = key;
        hpfField.appendChild(hpfInp);
        fields.appendChild(hpfField);
      } else if (!isIn && isMaster) {
        const stLbl = el("label", { className: "map-io-check", title: "Stereo (checked) or Mono L+R" });
        const stCb = el("input", {
          type: "checkbox",
          className: "ri-stereo",
          checked: routingOutStereo(raw)
        });
        stCb.dataset.dir = dir;
        stCb.dataset.key = key;
        stLbl.appendChild(stCb);
        stLbl.appendChild(el("span", { textContent: "Stereo" }));
        fields.appendChild(stLbl);
      }
      row.appendChild(fields);
      list.appendChild(row);
    });
    card.appendChild(list);
    return card;
  }
  function syncClipLedRowDisabled(key) {
    const refs = _clipLedInputs[key];
    if (!refs) return;
    const on = !!refs.enCb.checked;
    refs.portSel.disabled = !on;
    refs.pinInp.disabled = !on;
    refs.activeLowCb.disabled = !on;
    if (refs.row) refs.row.classList.toggle("is-disabled", !on);
  }
  function renderClipLedsFromContext() {
    const ctx = getContext();
    const map = ctx.clipLedsConfig || {};
    CLIP_LED_KEYS.forEach((key) => {
      const refs = _clipLedInputs[key];
      const cfg = map[key] || { enabled: false, port: "A", pin: 0, activeLow: false };
      if (!refs) return;
      refs.enCb.checked = !!cfg.enabled;
      refs.portSel.value = cfg.port === "B" ? "B" : "A";
      refs.pinInp.value = String(Math.max(0, Math.min(7, Math.round(cfg.pin || 0))));
      refs.activeLowCb.checked = !!cfg.activeLow;
      syncClipLedRowDisabled(key);
    });
  }
  function buildAdvancedView() {
    const view = el("div", { className: "map-subview", id: "ignored-pots-section" });
    view.dataset.subview = "advanced";
    const ignCard = el("div", { className: "card" });
    const hdr = el("div", { className: "card-header-row" });
    hdr.appendChild(el("div", { className: "card-title", textContent: "Excluded MUX Pins" }));
    hdr.appendChild(el("span", { id: "ign-count-label", className: "card-meta", textContent: "0 / 32" }));
    ignCard.appendChild(hdr);
    const tb = el("div", { className: "map-ign-toolbar" });
    const btnAdd = el("button", { id: "btn-add-ignored", className: "dev-small-btn", type: "button", textContent: "+ Add Pin" });
    btnAdd.addEventListener("click", () => addIgnoredPotRow());
    const btnAuto = el("button", {
      id: "btn-auto-ignored",
      className: "dev-small-btn",
      type: "button",
      textContent: "Auto-ignore unmapped",
      title: "Detect all MUX channels not assigned to any pot"
    });
    btnAuto.addEventListener("click", autoIgnoreUnmappedPins);
    tb.appendChild(btnAdd);
    tb.appendChild(btnAuto);
    ignCard.appendChild(tb);
    const list = el("div", { id: "ign-tbody", className: "map-ign-list" });
    ignCard.appendChild(list);
    view.appendChild(ignCard);
    const clipCard = el("div", { className: "card" });
    const clipHdr = el("div", { className: "card-header-row" });
    clipHdr.appendChild(el("div", { className: "card-title", textContent: "Clip LEDs (MCP23017)" }));
    clipHdr.appendChild(el("span", { className: "card-meta", textContent: "Output GPIO pins" }));
    clipCard.appendChild(clipHdr);
    const clipList = el("div", { id: "map-clip-leds-list", className: "map-clip-list" });
    CLIP_LED_KEYS.forEach((key) => {
      const row = el("div", { className: "map-clip-row" });
      row.dataset.clipKey = key;
      const enLbl = el("label", { className: "map-io-check map-clip-name" });
      const enCb = el("input", { type: "checkbox", className: "clip-en" });
      enLbl.appendChild(enCb);
      enLbl.appendChild(el("span", { textContent: CLIP_LED_LABELS[key] || key }));
      row.appendChild(enLbl);
      const fields = el("div", { className: "map-io-fields" });
      const portF = el("label", { className: "map-field" });
      portF.appendChild(el("span", { className: "map-field-lbl", textContent: "Port" }));
      const portSel = el("select", { className: "clip-port map-select", "aria-label": `${CLIP_LED_LABELS[key]} LED port` });
      portSel.innerHTML = '<option value="A">A</option><option value="B">B</option>';
      portF.appendChild(portSel);
      fields.appendChild(portF);
      const pinF = el("label", { className: "map-field" });
      pinF.appendChild(el("span", { className: "map-field-lbl", textContent: "Pin" }));
      const pinInp = el("input", {
        type: "number",
        min: "0",
        max: "7",
        value: "0",
        className: "clip-pin map-num",
        "aria-label": `${CLIP_LED_LABELS[key]} LED pin`
      });
      pinF.appendChild(pinInp);
      fields.appendChild(pinF);
      const alLbl = el("label", { className: "map-io-check", title: "LOW turns LED on instead of HIGH" });
      const alCb = el("input", { type: "checkbox", className: "clip-activelow" });
      alLbl.appendChild(alCb);
      alLbl.appendChild(el("span", { textContent: "Active Low" }));
      fields.appendChild(alLbl);
      row.appendChild(fields);
      clipList.appendChild(row);
      _clipLedInputs[key] = { row, enCb, portSel, pinInp, activeLowCb: alCb };
      const onClipEdit = () => {
        const ctx = getContext();
        if (!ctx.clipLedsConfig) ctx.clipLedsConfig = {};
        let pin = parseInt(pinInp.value, 10);
        if (isNaN(pin)) pin = 0;
        pin = Math.max(0, Math.min(7, pin));
        pinInp.value = String(pin);
        ctx.clipLedsConfig[key] = {
          enabled: !!enCb.checked,
          port: portSel.value === "B" ? "B" : "A",
          pin,
          activeLow: !!alCb.checked
        };
        syncClipLedRowDisabled(key);
        ctx.mappingUserEdited = true;
        markMappingDirty();
        updateMappingConflicts();
      };
      enCb.addEventListener("change", onClipEdit);
      portSel.addEventListener("change", onClipEdit);
      pinInp.addEventListener("input", onClipEdit);
      pinInp.addEventListener("change", onClipEdit);
      alCb.addEventListener("change", onClipEdit);
    });
    clipCard.appendChild(clipList);
    renderClipLedsFromContext();
    view.appendChild(clipCard);
    const bootCard = el("div", { className: "card" });
    bootCard.appendChild(el("div", { className: "card-title", textContent: "Boot & System" }));
    const bootRow = el("div", { className: "map-boot-row" });
    const devLbl = el("label", { className: "map-io-check map-boot-check" });
    const devCb = el("input", {
      type: "checkbox",
      id: "map-dev-mode-boot",
      checked: !!getContext().devModeBoot
    });
    devCb.addEventListener("change", () => {
      getContext().devModeBoot = !!devCb.checked;
      getContext().mappingUserEdited = true;
      markMappingDirty();
    });
    _devModeBootCb = devCb;
    devLbl.appendChild(devCb);
    devLbl.appendChild(el("span", { textContent: "Boot in Virtual Controls mode (developerMode)" }));
    bootRow.appendChild(devLbl);
    bootCard.appendChild(bootRow);
    const sysRow = el("div", { className: "map-system-row" });
    const sysHint = el("span", {
      className: "map-system-hint",
      textContent: "Full Linux OS reboot (~25\u201330 s). Temporarily disconnects Wi-Fi / hotspot."
    });
    const rebootBtn = el("button", {
      type: "button",
      id: "btn-reboot-bela",
      className: "btn-danger-outline",
      textContent: "Reboot Bela"
    });
    rebootBtn.addEventListener("click", confirmAndRebootBoard);
    sysRow.appendChild(sysHint);
    sysRow.appendChild(rebootBtn);
    bootCard.appendChild(sysRow);
    view.appendChild(bootCard);
    const hwCard = el("div", { className: "card" });
    hwCard.appendChild(el("div", { className: "card-title", textContent: "Hardware Info" }));
    const hwGrid = el("div", { className: "map-hw-grid" });
    [
      { id: "hw-mux", label: "Active MUX", def: "\u2014" },
      { id: "hw-mcp", label: "MCP23017", def: "\u2014" },
      { id: "hw-i2c", label: "I2C Bus", def: I2C_BUS },
      { id: "hw-min", label: "Pot Min", def: "\u2014" },
      { id: "hw-max", label: "Pot Max", def: "\u2014" },
      { id: "hw-scale", label: "Scale", def: "\u2014" }
    ].forEach((item) => {
      const box = el("div", { className: "map-hw-item" });
      box.appendChild(el("div", { className: "map-hw-k", textContent: item.label }));
      const valEl = el("div", { className: "map-hw-v", textContent: item.def });
      _hwValues[item.id] = valEl;
      box.appendChild(valEl);
      hwGrid.appendChild(box);
    });
    hwCard.appendChild(hwGrid);
    view.appendChild(hwCard);
    return view;
  }
  function getEffectiveHwInfo() {
    const ctx = getContext();
    const base = ctx.loadedConfigBase || ctx.boardConfigJson || {};
    const meta = ctx.configMeta;
    const M = CONFIG_META;
    const activeMux = base.mux && typeof base.mux.activeMux === "number" ? Math.round(base.mux.activeMux) : meta ? Math.round(meta[M.ACTIVE_MUX]) : 8;
    const mcpAddr = base.i2c && typeof base.i2c.mcpAddress === "number" ? Math.round(base.i2c.mcpAddress) : meta ? Math.round(meta[M.MCP_ADDR]) : 32;
    const i2cBus = base.i2c && typeof base.i2c.bus === "string" && base.i2c.bus ? base.i2c.bus : I2C_BUS;
    const potMin = base.calibration && typeof base.calibration.potMin === "number" ? base.calibration.potMin : meta ? +meta[M.POT_MIN].toFixed(3) : 5e-3;
    const potMax = base.calibration && typeof base.calibration.potMax === "number" ? base.calibration.potMax : meta ? +meta[M.POT_MAX].toFixed(3) : 0.997;
    const potScaleRecovery = base.calibration && typeof base.calibration.potScaleRecovery === "number" ? base.calibration.potScaleRecovery : meta ? +meta[M.SCALE].toFixed(4) : 1.2412;
    return { activeMux, mcpAddress: mcpAddr, bus: i2cBus, potMin, potMax, potScaleRecovery };
  }
  function updateHardwareSummaryFromMeta() {
    const ctx = getContext();
    if (!ctx.configMeta && !ctx.loadedConfigBase && !ctx.boardConfigJson) return;
    const hw = getEffectiveHwInfo();
    if (_hwValues["hw-mux"]) _hwValues["hw-mux"].textContent = String(hw.activeMux);
    if (_hwValues["hw-mcp"]) _hwValues["hw-mcp"].textContent = "0x" + hw.mcpAddress.toString(16).toUpperCase();
    if (_hwValues["hw-i2c"]) _hwValues["hw-i2c"].textContent = hw.bus;
    if (_hwValues["hw-min"]) _hwValues["hw-min"].textContent = Number(hw.potMin).toFixed(3);
    if (_hwValues["hw-max"]) _hwValues["hw-max"].textContent = Number(hw.potMax).toFixed(3);
    if (_hwValues["hw-scale"]) _hwValues["hw-scale"].textContent = Number(hw.potScaleRecovery).toFixed(4);
  }
  function autoIgnoreUnmappedPins() {
    const activeMux = getActiveMuxCount();
    const next = [];
    for (let m = 0; m < activeMux; m++) {
      for (let p = 0; p < MUX_POTS_PER_MUX; p++) {
        if (!isPotMapped(m, p) && next.length < 32) {
          next.push({ mux: m, pot: p });
        }
      }
    }
    getContext().ignoredPotsList = next;
    getContext().ignoredPotsUserEdited = true;
    markMappingDirty();
    cleanConsoleOfIgnored();
    renderIgnoredPotsTable();
    updateMappingConflicts();
  }
  function formatRoutingValue(raw, asArray) {
    if (asArray || Array.isArray(raw)) {
      const arr = Array.isArray(raw) ? raw : raw != null ? [raw] : [];
      return arr.join(",");
    }
    return String(raw != null ? raw : 0);
  }
  function parseRoutingInput(inp) {
    if (!inp) return null;
    const key = inp.dataset.key;
    const text = String(inp.value).trim();
    if (key === "master" || key.startsWith("aux")) {
      if (!text) return [];
      const parts = text.split(/[,\s]+/).filter(Boolean);
      const nums = parts.map((p) => parseInt(p, 10));
      if (nums.some((n2) => isNaN(n2))) return null;
      return nums;
    }
    const n = parseInt(text, 10);
    return isNaN(n) ? null : n;
  }
  function applyRoutingObjectToForm(routing) {
    if (!routing || typeof routing !== "object") return;
    const inObj = routing.in || {};
    const outObj = routing.out || {};
    document.querySelectorAll(".ri").forEach((inp) => {
      const dir = inp.dataset.dir;
      const key = inp.dataset.key;
      const src = dir === "in" ? inObj[key] : outObj[key];
      if (src === void 0) return;
      const ch = dir === "in" ? routingInChannel(src) : routingOutChannel(src);
      inp.value = formatRoutingValue(ch, key === "master" || key.startsWith("aux"));
    });
    document.querySelectorAll(".ri-gain").forEach((inp) => {
      const dir = inp.dataset.dir;
      const key = inp.dataset.key;
      const src = dir === "in" ? inObj[key] : outObj[key];
      if (src === void 0) return;
      inp.value = String(routingGain(src));
    });
    document.querySelectorAll(".ri-mic").forEach((cb) => {
      const src = inObj[cb.dataset.key];
      if (src !== void 0) cb.checked = routingInMic(src);
    });
    document.querySelectorAll(".ri-hpf").forEach((inp) => {
      const src = inObj[inp.dataset.key];
      if (src !== void 0) inp.value = String(Math.round(routingInHpf(src)));
    });
    document.querySelectorAll(".ri-stereo").forEach((cb) => {
      const src = outObj[cb.dataset.key];
      if (src !== void 0) cb.checked = routingOutStereo(src);
    });
    updateMappingConflicts();
  }
  function fillRoutingFromConfigMeta() {
    const ctx = getContext();
    if (!ctx.configMeta) return;
    updateHardwareSummaryFromMeta();
    const M = CONFIG_META;
    const meta = ctx.configMeta;
    if (!ctx.mappingUserEdited && !ctx.boardConfigJson) {
      if (meta.length > M.DEV_MODE_BOOT) {
        ctx.devModeBoot = meta[M.DEV_MODE_BOOT] > 0.5;
        if (_devModeBootCb) _devModeBootCb.checked = ctx.devModeBoot;
      }
      if (meta.length >= M.CLIP_LED_BASE + CLIP_LED_KEYS.length) {
        if (!ctx.clipLedsConfig) ctx.clipLedsConfig = {};
        CLIP_LED_KEYS.forEach((key, idx) => {
          ctx.clipLedsConfig[key] = decodeClipLedMeta(meta[M.CLIP_LED_BASE + idx]);
        });
        renderClipLedsFromContext();
      }
    }
    if (ctx.routingFilledFromConfigJson || ctx.routingFilledFromMeta) return;
    ctx.routingFilledFromMeta = true;
    const masterCount = Math.round(meta[M.MASTER_COUNT]);
    const masterOuts = [];
    if (masterCount > 0) masterOuts.push(Math.round(meta[M.MASTER_0]));
    if (masterCount > 1) masterOuts.push(Math.round(meta[M.MASTER_1]));
    const getAuxIns = (leftIdx, rightIdx) => {
      const l = Math.round(meta[leftIdx]);
      const r = meta.length > rightIdx ? Math.round(meta[rightIdx]) : -1;
      return r >= 0 ? [l, r] : [l];
    };
    const values = {
      in: {
        fx1Return: [Math.round(meta[M.FX1_RET])],
        fx2Return: [Math.round(meta[M.FX2_RET])],
        aux1: getAuxIns(M.AUX1, M.AUX1_R),
        aux2: getAuxIns(M.AUX2, M.AUX2_R),
        aux3: getAuxIns(M.AUX3, M.AUX3_R),
        aux4: getAuxIns(M.AUX4, M.AUX4_R)
      },
      out: {
        master: masterOuts,
        fx1Send: [Math.round(meta[M.FX1_SEND])],
        fx2Send: [Math.round(meta[M.FX2_SEND])],
        vuSub: Math.round(meta[M.VU_SUB]),
        vuKick: Math.round(meta[M.VU_KICK]),
        vuMid: Math.round(meta[M.VU_MID]),
        vuTop: Math.round(meta[M.VU_TOP])
      }
    };
    const micFlags = {
      aux1: meta[M.MIC_AUX1] > 0.5,
      aux2: meta[M.MIC_AUX2] > 0.5,
      aux3: meta[M.MIC_AUX3] > 0.5,
      aux4: meta[M.MIC_AUX4] > 0.5
    };
    const hpfHz = {
      aux1: meta[M.HPF_AUX1] != null ? meta[M.HPF_AUX1] : 0,
      aux2: meta[M.HPF_AUX2] != null ? meta[M.HPF_AUX2] : 0,
      aux3: meta[M.HPF_AUX3] != null ? meta[M.HPF_AUX3] : 0,
      aux4: meta[M.HPF_AUX4] != null ? meta[M.HPF_AUX4] : 0
    };
    document.querySelectorAll(".ri").forEach((inp) => {
      const dir = inp.dataset.dir;
      const key = inp.dataset.key;
      const raw = values[dir] && values[dir][key];
      if (raw === void 0) return;
      inp.value = formatRoutingValue(raw, key === "master" || key.startsWith("aux"));
    });
    document.querySelectorAll(".ri-mic").forEach((cb) => {
      cb.checked = !!micFlags[cb.dataset.key];
    });
    const isMasterStereo = meta.length > M.MASTER_STEREO ? meta[M.MASTER_STEREO] > 0.5 : true;
    document.querySelectorAll(".ri-stereo").forEach((cb) => {
      cb.checked = isMasterStereo;
    });
    document.querySelectorAll(".ri-hpf").forEach((inp) => {
      const hz = hpfHz[inp.dataset.key];
      inp.value = hz != null ? String(Math.round(hz)) : "0";
    });
    updateMappingConflicts();
  }
  function collectRoutingFromForm() {
    const readChannel = (dir, key) => {
      const inp = document.querySelector(`.ri[data-dir="${dir}"][data-key="${key}"]`);
      const parsed = parseRoutingInput(inp);
      if (parsed === null) return void 0;
      if (key === "master" || key.startsWith("aux"))
        return Array.isArray(parsed) ? parsed : [parsed];
      return parsed;
    };
    const readMic = (key) => {
      const cb = document.querySelector(`.ri-mic[data-key="${key}"]`);
      return cb ? !!cb.checked : false;
    };
    const readMasterStereo = () => {
      const cb = document.querySelector('.ri-stereo[data-key="master"]');
      return cb ? !!cb.checked : true;
    };
    const readHpf = (key) => {
      const inp = document.querySelector(`.ri-hpf[data-key="${key}"]`);
      if (!inp) return 0;
      const n = parseFloat(inp.value);
      if (isNaN(n) || n < 0) return 0;
      return Math.min(MIC_HPF_HZ_MAX, Math.max(MIC_HPF_HZ_MIN, Math.round(n)));
    };
    const readGain = (dir, key) => {
      const inp = document.querySelector(`.ri-gain[data-dir="${dir}"][data-key="${key}"]`);
      if (!inp) return 0;
      const n = parseFloat(inp.value);
      if (isNaN(n)) return 0;
      if (dir === "in") return Math.min(INPUT_GAIN_MAX2, Math.max(INPUT_GAIN_MIN2, Math.round(n)));
      return Math.min(OUTPUT_GAIN_MAX2, Math.max(OUTPUT_GAIN_MIN2, Math.round(n)));
    };
    const out = {};
    ROUTING_OUT_KEYS.forEach((key) => {
      const val = readChannel("out", key);
      if (val === void 0) return;
      const gain = readGain("out", key);
      if (key === "master")
        out[key] = { channels: Array.isArray(val) ? val : [val], stereo: readMasterStereo(), gain };
      else if (key.startsWith("fx"))
        out[key] = { channels: Array.isArray(val) ? val : [val], gain };
      else
        out[key] = { channel: val, gain };
    });
    const inn = {};
    ROUTING_IN_KEYS.forEach((key) => {
      const ch = readChannel("in", key);
      if (ch === void 0) return;
      const isAux = key.startsWith("aux");
      inn[key] = {
        channels: Array.isArray(ch) ? ch : [ch],
        mic: isAux ? readMic(key) : false,
        hpf: isAux ? readHpf(key) : 0,
        gain: readGain("in", key)
      };
    });
    return { out, in: inn };
  }
  function tryBuildMappingTable() {
    const ctx = getContext();
    if (ctx.mappingBuilt || !ctx.potMapping || !ctx.switchMapping) return;
    ctx.mappingBuilt = true;
    const host = document.getElementById("map-groups-host");
    if (host) {
      host.innerHTML = "";
      CONTROL_GROUPS.forEach((grpDef) => {
        const grp = el("div", { className: "map-group" });
        grp.dataset.groupId = grpDef.id;
        grp.dataset.collapsed = grpDef.defaultOpen ? "false" : "true";
        const hdr = el("button", {
          type: "button",
          className: "map-group-hdr",
          "aria-expanded": grpDef.defaultOpen ? "true" : "false"
        });
        hdr.appendChild(el("span", { className: "map-group-title", textContent: grpDef.title }));
        hdr.appendChild(el("span", { className: "map-group-count", textContent: String(grpDef.items.length) }));
        hdr.addEventListener("click", () => {
          const nextClosed = grp.dataset.collapsed !== "true";
          grp.dataset.collapsed = nextClosed ? "true" : "false";
          hdr.setAttribute("aria-expanded", nextClosed ? "false" : "true");
        });
        grp.appendChild(hdr);
        const body = el("div", { className: "map-group-body" });
        grpDef.items.forEach((item) => {
          if (item.table === "pot") {
            const i = POT_INDEX[item.name];
            if (i === void 0) return;
            const mux = Math.round(ctx.potMapping[i * 4 + 0]);
            const pot = Math.round(ctx.potMapping[i * 4 + 1]);
            const rev = ctx.potMapping[i * 4 + 2] > 0.5;
            ctx.potMapping[i * 4 + 3] = isPotCentered(item.name) ? 1 : 0;
            const row = el("div", { className: "map-row" });
            row.dataset.mapTable = "pot";
            row.dataset.mapIndex = String(i);
            row.dataset.search = `${grpDef.title} ${item.label} ${item.name}`;
            const main = el("div", { className: "map-row-main" });
            main.appendChild(el("div", { className: "map-row-name", textContent: item.label, title: item.name }));
            row.appendChild(main);
            const meter = el("div", { className: "map-live-meter", title: "Live pot position" });
            const fill = el("div", { className: "map-live-fill" });
            meter.appendChild(fill);
            _potLiveFills[i] = fill;
            row.appendChild(meter);
            const fields = el("div", { className: "map-row-fields" });
            const muxF = el("label", { className: "map-field" });
            muxF.appendChild(el("span", { className: "map-field-lbl", textContent: "MUX" }));
            const muxInp = el("input", {
              type: "number",
              min: "0",
              max: "7",
              value: String(mux),
              className: "pi map-num",
              "aria-label": `${item.label} MUX`
            });
            muxInp.dataset.i = String(i);
            muxInp.dataset.f = "mux";
            muxF.appendChild(muxInp);
            const chF = el("label", { className: "map-field" });
            chF.appendChild(el("span", { className: "map-field-lbl", textContent: "Ch" }));
            const potInp = el("input", {
              type: "number",
              min: "0",
              max: "9",
              value: String(pot),
              className: "pi map-num",
              "aria-label": `${item.label} channel`
            });
            potInp.dataset.i = String(i);
            potInp.dataset.f = "pot";
            chF.appendChild(potInp);
            fields.appendChild(muxF);
            fields.appendChild(chF);
            row.appendChild(fields);
            const actions = el("div", { className: "map-row-actions" });
            const revBtn = el("button", {
              type: "button",
              className: "btn-rev-toggle" + (rev ? " active" : ""),
              textContent: "Rev",
              title: "Reverse rotation direction",
              "aria-label": `Reverse ${item.label}`,
              "aria-pressed": rev ? "true" : "false"
            });
            revBtn.dataset.i = String(i);
            revBtn.dataset.f = "rev";
            revBtn.addEventListener("click", () => {
              const nextRev = !revBtn.classList.contains("active");
              setPotRevState(i, nextRev);
              ctx.mappingUserEdited = true;
              markMappingDirty();
              updateMappingConflicts();
            });
            _potRevButtons[i] = revBtn;
            actions.appendChild(revBtn);
            actions.appendChild(createDetectButton("pot", i));
            row.appendChild(actions);
            const handlePotField = () => {
              ctx.mappingUserEdited = true;
              markMappingDirty();
              ctx.potMapping[i * 4 + 0] = parseFloat(muxInp.value) || 0;
              ctx.potMapping[i * 4 + 1] = parseFloat(potInp.value) || 0;
              cleanConsoleOfIgnored();
              updateMappingConflicts();
            };
            muxInp.addEventListener("input", handlePotField);
            muxInp.addEventListener("change", handlePotField);
            potInp.addEventListener("input", handlePotField);
            potInp.addEventListener("change", handlePotField);
            body.appendChild(row);
          } else {
            const i = SW_INDEX[item.name];
            if (i === void 0) return;
            const pin = Math.round(ctx.switchMapping[i * 3 + 0]);
            const portB = ctx.switchMapping[i * 3 + 1] > 0.5;
            const rev = ctx.switchMapping[i * 3 + 2] > 0.5;
            const row = el("div", { className: "map-row" });
            row.dataset.mapTable = "sw";
            row.dataset.mapIndex = String(i);
            row.dataset.search = `${grpDef.title} ${item.label} ${item.name} switch`;
            const main = el("div", { className: "map-row-main" });
            main.appendChild(el("div", { className: "map-row-name", textContent: item.label, title: item.name }));
            row.appendChild(main);
            const meter = el("div", { className: "map-live-meter", title: "Live switch state" });
            const fill = el("div", { className: "map-live-fill sw" });
            meter.appendChild(fill);
            _swLiveFills[i] = fill;
            row.appendChild(meter);
            const fields = el("div", { className: "map-row-fields" });
            const portF = el("label", { className: "map-field" });
            portF.appendChild(el("span", { className: "map-field-lbl", textContent: "Port" }));
            const portSel = el("select", { className: "si map-select", "aria-label": `${item.label} port` });
            portSel.dataset.i = String(i);
            portSel.dataset.f = "port";
            portSel.innerHTML = `<option value="0"${!portB ? " selected" : ""}>A</option><option value="1"${portB ? " selected" : ""}>B</option>`;
            portF.appendChild(portSel);
            const pinF = el("label", { className: "map-field" });
            pinF.appendChild(el("span", { className: "map-field-lbl", textContent: "Pin" }));
            const pinInp = el("input", {
              type: "number",
              min: "0",
              max: "7",
              value: String(pin),
              className: "si map-num",
              "aria-label": `${item.label} pin`
            });
            pinInp.dataset.i = String(i);
            pinInp.dataset.f = "pin";
            pinF.appendChild(pinInp);
            fields.appendChild(portF);
            fields.appendChild(pinF);
            row.appendChild(fields);
            const actions = el("div", { className: "map-row-actions" });
            const revBtn = el("button", {
              type: "button",
              className: "btn-rev-toggle" + (rev ? " active" : ""),
              textContent: "Rev",
              title: "Invert active polarity",
              "aria-label": `Invert ${item.label}`,
              "aria-pressed": rev ? "true" : "false"
            });
            revBtn.dataset.i = String(i);
            revBtn.dataset.f = "rev";
            revBtn.addEventListener("click", () => {
              const nextRev = !revBtn.classList.contains("active");
              setSwitchRevState(i, nextRev);
              ctx.mappingUserEdited = true;
              markMappingDirty();
              updateMappingConflicts();
            });
            _swRevButtons[i] = revBtn;
            actions.appendChild(revBtn);
            actions.appendChild(createDetectButton("sw", i));
            row.appendChild(actions);
            const handleSwField = () => {
              ctx.mappingUserEdited = true;
              markMappingDirty();
              ctx.switchMapping[i * 3 + 0] = parseFloat(pinInp.value) || 0;
              ctx.switchMapping[i * 3 + 1] = parseFloat(portSel.value) || 0;
              updateMappingConflicts();
            };
            pinInp.addEventListener("input", handleSwField);
            pinInp.addEventListener("change", handleSwField);
            portSel.addEventListener("input", handleSwField);
            portSel.addEventListener("change", handleSwField);
            body.appendChild(row);
          }
        });
        grp.appendChild(body);
        host.appendChild(grp);
      });
    }
    renderIgnoredPotsTable();
    updateMappingConflicts();
    applyControlFilters();
  }
  function setPotRevState(i, rev) {
    const btn = _potRevButtons[i];
    if (btn) {
      btn.classList.toggle("active", !!rev);
      btn.setAttribute("aria-pressed", rev ? "true" : "false");
    }
    if (getContext().potMapping) {
      getContext().potMapping[i * 4 + 2] = rev ? 1 : 0;
    }
  }
  function setSwitchRevState(i, rev) {
    const btn = _swRevButtons[i];
    if (btn) {
      btn.classList.toggle("active", !!rev);
      btn.setAttribute("aria-pressed", rev ? "true" : "false");
    }
    if (getContext().switchMapping) {
      getContext().switchMapping[i * 3 + 2] = rev ? 1 : 0;
    }
  }
  function updateMappingLive() {
    const ctx = getContext();
    if (!ctx.mappingBuilt || ctx.mappingSubTab !== "controls") return;
    if (ctx.potValues) {
      for (let i = 0; i < POT_NAMES.length; i++) {
        const fill = _potLiveFills[i];
        if (!fill) continue;
        const pct = Math.max(0, Math.min(100, (ctx.potValues[i] || 0) * 100)).toFixed(0) + "%";
        if (fill.style.width !== pct) fill.style.width = pct;
      }
    }
    if (ctx.switchStates) {
      for (let i = 0; i < SWITCH_NAMES.length; i++) {
        const fill = _swLiveFills[i];
        if (!fill) continue;
        const on = (ctx.switchStates[i] || 0) > 0.5;
        const pct = on ? "100%" : "0%";
        if (fill.style.width !== pct) fill.style.width = pct;
      }
    }
  }
  function updateMappingConflicts() {
    const messages = [];
    document.querySelectorAll(".map-row, .map-ign-row, .map-io-row, .map-clip-row").forEach((row) => row.classList.remove("dup-conflict"));
    if (getContext().mappingBuilt) {
      const potGroups = /* @__PURE__ */ new Map();
      for (let i = 0; i < POT_NAMES.length; i++) {
        const muxInp = document.querySelector(`.pi[data-i="${i}"][data-f="mux"]`);
        const potInp = document.querySelector(`.pi[data-i="${i}"][data-f="pot"]`);
        if (!muxInp || !potInp) continue;
        const mux = parseInt(muxInp.value, 10);
        const pot = parseInt(potInp.value, 10);
        if (isNaN(mux) || isNaN(pot)) continue;
        const key = mux + ":" + pot;
        if (!potGroups.has(key)) potGroups.set(key, []);
        potGroups.get(key).push(i);
      }
      potGroups.forEach((indices, key) => {
        if (indices.length < 2) return;
        const parts = key.split(":");
        const names = indices.map((i) => POT_NAMES[i]).join(", ");
        messages.push(`Pot MUX ${parts[0]} / Ch ${parts[1]}: ${names}`);
        indices.forEach((i) => {
          const row = document.querySelector(`.map-row[data-map-table="pot"][data-map-index="${i}"]`);
          if (row) row.classList.add("dup-conflict");
        });
      });
      const mcpGroups = /* @__PURE__ */ new Map();
      for (let i = 0; i < SWITCH_NAMES.length; i++) {
        const pinInp = document.querySelector(`.si[data-i="${i}"][data-f="pin"]`);
        const portInp = document.querySelector(`.si[data-i="${i}"][data-f="port"]`);
        if (!pinInp || !portInp) continue;
        const pin = parseInt(pinInp.value, 10);
        const port = parseInt(portInp.value, 10);
        if (isNaN(pin) || isNaN(port)) continue;
        const key = port + ":" + pin;
        if (!mcpGroups.has(key)) mcpGroups.set(key, []);
        mcpGroups.get(key).push({ kind: "sw", idx: i, label: SWITCH_NAMES[i] });
      }
      const clipCfg = getContext().clipLedsConfig || {};
      CLIP_LED_KEYS.forEach((clipKey) => {
        const c = clipCfg[clipKey];
        if (!c || !c.enabled) return;
        const portNum = c.port === "B" ? 1 : 0;
        const pin = Math.round(Number(c.pin));
        if (isNaN(pin)) return;
        const key = portNum + ":" + pin;
        if (!mcpGroups.has(key)) mcpGroups.set(key, []);
        mcpGroups.get(key).push({ kind: "clip", key: clipKey, label: `Clip ${CLIP_LED_LABELS[clipKey] || clipKey}` });
      });
      mcpGroups.forEach((entries, key) => {
        if (entries.length < 2) return;
        const parts = key.split(":");
        const portLabel = parts[0] === "1" ? "B" : "A";
        const names = entries.map((e) => e.label).join(", ");
        messages.push(`MCP23017 Port ${portLabel} / Pin ${parts[1]}: ${names}`);
        entries.forEach((e) => {
          if (e.kind === "sw") {
            const row = document.querySelector(`.map-row[data-map-table="sw"][data-map-index="${e.idx}"]`);
            if (row) row.classList.add("dup-conflict");
          } else {
            const row = document.querySelector(`.map-clip-row[data-clip-key="${e.key}"]`);
            if (row) row.classList.add("dup-conflict");
          }
        });
      });
    }
    ["in", "out"].forEach((dir) => {
      const groups = /* @__PURE__ */ new Map();
      document.querySelectorAll(`.ri[data-dir="${dir}"]`).forEach((inp) => {
        const parsed = parseRoutingInput(inp);
        if (parsed === null) return;
        const chans = Array.isArray(parsed) ? parsed : [parsed];
        const seenInField = /* @__PURE__ */ new Set();
        chans.forEach((ch) => {
          if (typeof ch !== "number" || isNaN(ch) || ch < 0) return;
          if (seenInField.has(ch)) {
            messages.push(`Audio ${dir} Ch ${ch}: ${ROUTING_LABELS[inp.dataset.key] || inp.dataset.key} duplicate`);
            const row = inp.closest(".map-io-row");
            if (row) row.classList.add("dup-conflict");
            return;
          }
          seenInField.add(ch);
          if (!groups.has(ch)) groups.set(ch, []);
          groups.get(ch).push({ key: inp.dataset.key, inp });
        });
      });
      groups.forEach((entries, ch) => {
        const keys = [...new Set(entries.map((e) => e.key))];
        if (keys.length < 2) return;
        messages.push(`Audio ${dir} Ch ${ch}: ${keys.map((k) => ROUTING_LABELS[k] || k).join(", ")}`);
        entries.forEach((e) => {
          const row = e.inp.closest(".map-io-row");
          if (row) row.classList.add("dup-conflict");
        });
      });
    });
    if (Array.isArray(getContext().ignoredPotsList)) {
      const ignGroups = /* @__PURE__ */ new Map();
      getContext().ignoredPotsList.forEach((item, idx) => {
        const key = item.mux + ":" + item.pot;
        if (!ignGroups.has(key)) ignGroups.set(key, []);
        ignGroups.get(key).push(idx);
      });
      ignGroups.forEach((indices, key) => {
        if (indices.length < 2) return;
        const parts = key.split(":");
        messages.push(`Excluded MUX ${parts[0]} / Ch ${parts[1]} duplicated`);
        indices.forEach((idx) => {
          const row = document.querySelector(`.map-ign-row[data-ign-index="${idx}"]`);
          if (row) row.classList.add("dup-conflict");
        });
      });
    }
    document.querySelectorAll(".map-ign-row[data-ign-index]").forEach((row) => {
      const idx = parseInt(row.dataset.ignIndex, 10);
      const list2 = getContext().ignoredPotsList;
      if (list2 && list2[idx]) {
        const name = getMappedPotName(list2[idx].mux, list2[idx].pot);
        const statusEl = row.querySelector(".map-ign-status");
        if (statusEl) {
          statusEl.className = "map-ign-status" + (name ? " mapped" : "");
          statusEl.textContent = name ? `Mapped: ${name}` : "Floating / Unassigned";
        }
      }
    });
    const pill = document.getElementById("map-conflict-pill");
    if (pill) {
      pill.classList.toggle("show", messages.length > 0);
      pill.textContent = messages.length === 1 ? "1 Conflict" : `${messages.length} Conflicts`;
    }
    const banner = document.getElementById("mapping-conflicts");
    const list = document.getElementById("mapping-conflicts-list");
    if (!banner || !list) return;
    if (messages.length === 0) {
      banner.classList.remove("show");
      list.innerHTML = "";
      if (getContext().mappingFilter === "conflicts") applyControlFilters();
      return;
    }
    banner.classList.add("show");
    list.innerHTML = messages.map((m) => "<li>" + m + "</li>").join("");
    if (getContext().mappingFilter === "conflicts") applyControlFilters();
  }
  function createDetectButton(table, index) {
    const btn = el("button", { className: "btn-detect-row", type: "button", textContent: "Learn" });
    btn.title = "Auto-detect physical control";
    btn.dataset.table = table;
    btn.dataset.index = String(index);
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (getContext().detectMode && getContext().detectMode.table === table && getContext().detectMode.targetIndex === index) {
        cancelDetect();
      } else {
        getContext().mappingGuided = null;
        updateGuidedBar();
        startDetect(table, index);
      }
    });
    return btn;
  }
  function showDetectStatus(msg, isError) {
    if (!getContext().detectStatusEl) return;
    getContext().detectStatusEl.textContent = msg;
    getContext().detectStatusEl.className = isError ? "map-conflicts-box show" : "map-guided-bar listening";
  }
  function hideDetectStatus() {
    if (!getContext().detectStatusEl) return;
    getContext().detectStatusEl.textContent = "";
    getContext().detectStatusEl.className = "";
  }
  function setDetectUiActive(active) {
    document.querySelectorAll(".btn-detect-row[data-table]").forEach((btn) => {
      const t = btn.dataset.table;
      const i = parseInt(btn.dataset.index, 10);
      const isTarget = active && getContext().detectMode && getContext().detectMode.table === t && getContext().detectMode.targetIndex === i;
      btn.textContent = isTarget ? "Cancel" : "Learn";
      btn.classList.toggle("detect-active", isTarget);
      btn.disabled = active && !isTarget;
    });
    document.querySelectorAll(".map-row").forEach((row) => row.classList.remove("row-detecting"));
    if (active && getContext().detectMode) {
      const row = document.querySelector(
        `.map-row[data-map-table="${getContext().detectMode.table}"][data-map-index="${getContext().detectMode.targetIndex}"]`
      );
      if (row) {
        row.classList.add("row-detecting");
        const grp = row.closest(".map-group");
        if (grp && grp.dataset.collapsed === "true") {
          grp.dataset.collapsed = "false";
          const hdr = grp.querySelector(".map-group-hdr");
          if (hdr) hdr.setAttribute("aria-expanded", "true");
        }
        if (getContext().mappingGuided) {
          row.scrollIntoView({ behavior: "smooth", block: "nearest" });
        }
      }
    }
  }
  function buildGuidedQueue() {
    const queue = [];
    CONTROL_GROUPS.forEach((grp) => {
      grp.items.forEach((item) => {
        const index = item.table === "pot" ? POT_INDEX[item.name] : SW_INDEX[item.name];
        if (index !== void 0) {
          queue.push({
            table: item.table,
            index,
            group: grp.title,
            label: item.label
          });
        }
      });
    });
    return queue;
  }
  function updateGuidedBar() {
    const bar = document.getElementById("map-guided-bar");
    const stepEl = document.getElementById("map-guided-step");
    const promptEl = document.getElementById("map-guided-prompt");
    const startBtn = document.getElementById("btn-guided-start");
    const skipBtn = document.getElementById("btn-guided-skip");
    const stopBtn = document.getElementById("btn-guided-stop");
    if (!bar || !stepEl || !promptEl) return;
    const guided = getContext().mappingGuided;
    if (!guided) {
      bar.classList.remove("listening");
      stepEl.textContent = "Setup Assistant";
      promptEl.textContent = "Map pots and switches step by step";
      if (startBtn) startBtn.style.display = "";
      if (skipBtn) skipBtn.style.display = "none";
      if (stopBtn) stopBtn.style.display = "none";
      return;
    }
    const cur = guided.queue[guided.cursor];
    bar.classList.add("listening");
    stepEl.textContent = `Step ${guided.cursor + 1} / ${guided.queue.length} \xB7 ${cur.group}`;
    promptEl.textContent = cur.table === "pot" ? `${cur.label}: move physical pot (\u226525%)` : `${cur.label}: toggle physical switch`;
    if (startBtn) startBtn.style.display = "none";
    if (skipBtn) skipBtn.style.display = "";
    if (stopBtn) stopBtn.style.display = "";
  }
  function startGuidedSetup() {
    if (!getContext().mappingBuilt) {
      showDetectStatus("Waiting for Bela mapping\u2026", true);
      return;
    }
    if (typeof Bela === "undefined") {
      showDetectStatus("Bela not connected", true);
      return;
    }
    const queue = buildGuidedQueue();
    if (!queue.length) return;
    getContext().mappingGuided = { queue, cursor: 0 };
    updateGuidedBar();
    const cur = queue[0];
    startDetect(cur.table, cur.index);
  }
  function skipGuidedStep() {
    const guided = getContext().mappingGuided;
    if (!guided) return;
    if (_guidedTimer) {
      clearTimeout(_guidedTimer);
      _guidedTimer = null;
    }
    guided.cursor++;
    if (guided.cursor >= guided.queue.length) {
      showDownloadStatus("Guided setup complete \u2713", false);
      cancelDetect();
      return;
    }
    updateGuidedBar();
    const next = guided.queue[guided.cursor];
    startDetect(next.table, next.index);
  }
  function advanceGuidedAfterHit() {
    const guided = getContext().mappingGuided;
    if (!guided) {
      cancelDetect();
      return;
    }
    getContext().detectMode = null;
    setDetectUiActive(false);
    guided.cursor++;
    if (guided.cursor >= guided.queue.length) {
      showDownloadStatus("Guided setup complete \u2713", false);
      getContext().mappingGuided = null;
      updateGuidedBar();
      hideDetectStatus();
      return;
    }
    const promptEl = document.getElementById("map-guided-prompt");
    if (promptEl) promptEl.textContent = "Detected \u2014 preparing next control\u2026";
    if (_guidedTimer) clearTimeout(_guidedTimer);
    _guidedTimer = setTimeout(() => {
      _guidedTimer = null;
      if (!getContext().mappingGuided) return;
      updateGuidedBar();
      const next = getContext().mappingGuided.queue[getContext().mappingGuided.cursor];
      startDetect(next.table, next.index);
    }, GUIDED_SETTLE_MS);
  }
  function muxRawIndex(mux, pot) {
    return mux * MUX_POTS_PER_MUX + pot;
  }
  function getActiveMuxCount() {
    if (getContext().configMeta && getContext().configMeta.length > CONFIG_META.ACTIVE_MUX)
      return Math.max(1, Math.round(getContext().configMeta[CONFIG_META.ACTIVE_MUX]));
    return 8;
  }
  function isPotIgnored(mux, pot) {
    if (Array.isArray(getContext().ignoredPotsList)) {
      return getContext().ignoredPotsList.some(
        (p) => Math.round(p.mux) === mux && Math.round(p.pot) === pot
      );
    }
    if (getContext().configMeta) {
      const count = Math.round(getContext().configMeta[CONFIG_META.IGNORED_COUNT]);
      for (let i = 0; i < count; i++) {
        const base = CONFIG_META.IGNORED_BASE + i * 2;
        if (Math.round(getContext().configMeta[base]) === mux && Math.round(getContext().configMeta[base + 1]) === pot)
          return true;
      }
    }
    if (Array.isArray(IGNORED_POTS_DEFAULT)) {
      return IGNORED_POTS_DEFAULT.some(
        (p) => Math.round(p.mux) === mux && Math.round(p.pot) === pot
      );
    }
    return false;
  }
  function getPotMuxChannel(potIndex) {
    const muxInp = document.querySelector(`.pi[data-i="${potIndex}"][data-f="mux"]`);
    const potInp = document.querySelector(`.pi[data-i="${potIndex}"][data-f="pot"]`);
    if (muxInp && potInp) {
      const m = parseInt(muxInp.value, 10);
      const p = parseInt(potInp.value, 10);
      if (!isNaN(m) && !isNaN(p)) return { mux: m, pot: p };
    }
    if (getContext().potMapping && getContext().potMapping.length > potIndex * 4 + 1) {
      return {
        mux: Math.round(getContext().potMapping[potIndex * 4 + 0]),
        pot: Math.round(getContext().potMapping[potIndex * 4 + 1])
      };
    }
    return null;
  }
  function getMappedPotName(mux, pot) {
    for (let i = 0; i < POT_NAMES.length; i++) {
      const coords = getPotMuxChannel(i);
      if (coords && coords.mux === mux && coords.pot === pot)
        return POT_NAMES[i];
    }
    return null;
  }
  function ensureIgnoredPotsList() {
    if (!Array.isArray(getContext().ignoredPotsList)) {
      if (Array.isArray(IGNORED_POTS_DEFAULT) && IGNORED_POTS_DEFAULT.length > 0) {
        getContext().ignoredPotsList = IGNORED_POTS_DEFAULT.map((p) => ({
          mux: Math.max(0, Math.min(7, Math.round(p.mux))),
          pot: Math.max(0, Math.min(9, Math.round(p.pot)))
        }));
      } else {
        getContext().ignoredPotsList = [];
      }
    }
    return getContext().ignoredPotsList;
  }
  function renderIgnoredPotsTable() {
    const tbody = document.getElementById("ign-tbody");
    if (!tbody) return;
    const list = ensureIgnoredPotsList();
    const countLabel = document.getElementById("ign-count-label");
    if (countLabel) countLabel.textContent = `${list.length} / 32`;
    const btnAdd = document.getElementById("btn-add-ignored");
    if (btnAdd) btnAdd.disabled = list.length >= 32;
    if (list.length === 0) {
      tbody.innerHTML = '<div class="map-empty">No excluded MUX pins.</div>';
      return;
    }
    tbody.innerHTML = "";
    list.forEach((item, idx) => {
      const row = el("div", { className: "map-ign-row" });
      row.dataset.ignIndex = String(idx);
      const muxF = el("label", { className: "map-field" });
      muxF.appendChild(el("span", { className: "map-field-lbl", textContent: "MUX" }));
      const muxInp = el("input", {
        type: "number",
        min: "0",
        max: "7",
        value: String(item.mux),
        className: "ii map-num",
        "aria-label": `Ignored pin ${idx + 1} MUX`
      });
      muxInp.dataset.idx = String(idx);
      muxInp.dataset.f = "mux";
      muxF.appendChild(muxInp);
      const chF = el("label", { className: "map-field" });
      chF.appendChild(el("span", { className: "map-field-lbl", textContent: "Ch" }));
      const chInp = el("input", {
        type: "number",
        min: "0",
        max: "9",
        value: String(item.pot),
        className: "ii map-num",
        "aria-label": `Ignored pin ${idx + 1} channel`
      });
      chInp.dataset.idx = String(idx);
      chInp.dataset.f = "pot";
      chF.appendChild(chInp);
      const mappedName = getMappedPotName(item.mux, item.pot);
      const statusEl = el("span", {
        className: "map-ign-status" + (mappedName ? " mapped" : ""),
        textContent: mappedName ? `Mapped: ${mappedName}` : "Floating / Unassigned"
      });
      const delBtn = el("button", {
        type: "button",
        className: "btn-del-ign",
        textContent: "\xD7",
        title: "Remove excluded pin",
        "aria-label": `Remove excluded MUX ${item.mux} Ch ${item.pot}`
      });
      delBtn.addEventListener("click", () => removeIgnoredPotRow(idx));
      [muxInp, chInp].forEach((input) => {
        input.addEventListener("change", (e) => {
          const field = e.target.dataset.f;
          let val = parseInt(e.target.value, 10);
          if (isNaN(val)) val = 0;
          val = field === "mux" ? Math.max(0, Math.min(7, val)) : Math.max(0, Math.min(9, val));
          e.target.value = String(val);
          list[idx][field] = val;
          getContext().ignoredPotsUserEdited = true;
          markMappingDirty();
          cleanConsoleOfIgnored();
          renderIgnoredPotsTable();
          updateMappingConflicts();
        });
      });
      row.appendChild(muxF);
      row.appendChild(chF);
      row.appendChild(statusEl);
      row.appendChild(delBtn);
      tbody.appendChild(row);
    });
  }
  function addIgnoredPotRow(mux, pot) {
    const list = ensureIgnoredPotsList();
    if (list.length >= 32) return;
    const m = mux !== void 0 ? mux : 7;
    let p = pot !== void 0 ? pot : 0;
    if (mux === void 0 && pot === void 0) {
      for (let tryP = 0; tryP < 10; tryP++) {
        if (!list.some((item) => item.mux === m && item.pot === tryP)) {
          p = tryP;
          break;
        }
      }
    }
    list.push({ mux: m, pot: p });
    getContext().ignoredPotsUserEdited = true;
    markMappingDirty();
    cleanConsoleOfIgnored();
    renderIgnoredPotsTable();
    updateMappingConflicts();
  }
  function removeIgnoredPotRow(idx) {
    const list = ensureIgnoredPotsList();
    if (idx >= 0 && idx < list.length) {
      list.splice(idx, 1);
      getContext().ignoredPotsUserEdited = true;
      markMappingDirty();
      cleanConsoleOfIgnored();
      renderIgnoredPotsTable();
      updateMappingConflicts();
    }
  }
  function cleanConsoleOfIgnored() {
    if (!Array.isArray(getContext().recentChanges)) return;
    getContext().recentChanges = getContext().recentChanges.filter((entry) => {
      if (entry.type !== "pot") return true;
      const potIdx = POT_NAMES.indexOf(entry.name);
      if (potIdx >= 0) {
        const coords = getPotMuxChannel(potIdx);
        if (coords && isPotIgnored(coords.mux, coords.pot)) return false;
      }
      const match = entry.name.match(/MUX(\d+)\s+CH(\d+)/i);
      if (match) {
        const m = parseInt(match[1], 10);
        const p = parseInt(match[2], 10);
        if (isPotIgnored(m, p) || isPotMapped(m, p)) return false;
      }
      return true;
    });
  }
  function fillIgnoredPotsFromConfigMeta() {
    if (getContext().ignoredPotsFilledFromMeta || !getContext().configMeta) return;
    getContext().ignoredPotsFilledFromMeta = true;
    updateHardwareSummaryFromMeta();
    if (getContext().ignoredPotsUserEdited) return;
    const M = CONFIG_META;
    const meta = getContext().configMeta;
    const count = Math.round(meta[M.IGNORED_COUNT]);
    const list = [];
    for (let i = 0; i < count; i++) {
      list.push({
        mux: Math.round(meta[M.IGNORED_BASE + i * 2 + 0]),
        pot: Math.round(meta[M.IGNORED_BASE + i * 2 + 1])
      });
    }
    getContext().ignoredPotsList = list;
    renderIgnoredPotsTable();
  }
  function isPotMapped(mux, pot) {
    for (let i = 0; i < POT_NAMES.length; i++) {
      const coords = getPotMuxChannel(i);
      if (coords && coords.mux === mux && coords.pot === pot)
        return true;
    }
    return false;
  }
  function formatUnmappedPotLabel(mux, pot) {
    return "N/A MUX" + mux + " CH" + String(pot).padStart(2, "0");
  }
  function snapshotControlValues() {
    const snapPot = new Float32Array(POT_NAMES.length);
    const snapSw = new Float32Array(SWITCH_NAMES.length);
    const snapMuxRaw = new Float32Array(MUX_RAW_SIZE);
    for (let i = 0; i < POT_NAMES.length; i++)
      snapPot[i] = getContext().potValues[i] != null ? getContext().potValues[i] : 0;
    for (let i = 0; i < SWITCH_NAMES.length; i++)
      snapSw[i] = getContext().switchStates[i] != null ? getContext().switchStates[i] : 0;
    for (let i = 0; i < MUX_RAW_SIZE; i++)
      snapMuxRaw[i] = getContext().muxRawValues ? getContext().muxRawValues[i] : 0;
    return { snapPot, snapSw, snapMuxRaw };
  }
  function startDetect(table, index) {
    if (getContext().detectMode) {
      getContext().detectMode = null;
      setDetectUiActive(false);
    }
    if (!getContext().mappingBuilt) {
      showDetectStatus("Waiting for Bela mapping\u2026", true);
      return;
    }
    if (typeof Bela === "undefined") {
      showDetectStatus("Bela not connected", true);
      return;
    }
    const { snapPot, snapSw, snapMuxRaw } = snapshotControlValues();
    getContext().detectMode = { table, targetIndex: index, snapPot, snapSw, snapMuxRaw };
    setDetectUiActive(true);
    if (!getContext().mappingGuided) {
      const targetName = table === "pot" ? POT_NAMES[index] : SWITCH_NAMES[index];
      showDetectStatus(table === "pot" ? `Move pot \u226525% for ${targetName}` : `Toggle switch for ${targetName}`, false);
    } else {
      hideDetectStatus();
    }
  }
  function cancelDetect() {
    if (_guidedTimer) {
      clearTimeout(_guidedTimer);
      _guidedTimer = null;
    }
    const hadGuided = !!getContext().mappingGuided;
    getContext().mappingGuided = null;
    if (hadGuided) updateGuidedBar();
    if (!getContext().detectMode) return;
    getContext().detectMode = null;
    setDetectUiActive(false);
    hideDetectStatus();
  }
  function setMappingField(table, rowIndex, field, value) {
    const cls = table === "pot" ? "pi" : "si";
    const inp = document.querySelector(`.${cls}[data-i="${rowIndex}"][data-f="${field}"]`);
    if (!inp) return;
    inp.value = value;
    inp.dispatchEvent(new Event("input", { bubbles: true }));
  }
  function findMovedMuxPot(snapMuxRaw) {
    if (!getContext().muxRawValues) return null;
    const activeMux = getActiveMuxCount();
    let bestMux = -1;
    let bestPot = -1;
    let bestDelta = 0;
    for (let m = 0; m < activeMux; m++) {
      for (let p = 0; p < MUX_POTS_PER_MUX; p++) {
        if (isPotIgnored(m, p)) continue;
        const idx = muxRawIndex(m, p);
        const cur = getContext().muxRawValues[idx] != null ? getContext().muxRawValues[idx] : 0;
        const delta = Math.abs(cur - snapMuxRaw[idx]);
        if (delta > bestDelta) {
          bestDelta = delta;
          bestMux = m;
          bestPot = p;
        }
      }
    }
    if (bestMux < 0 || bestDelta < DETECT_POT_MIN_DELTA) return null;
    return { mux: bestMux, pot: bestPot, label: formatUnmappedPotLabel(bestMux, bestPot) };
  }
  function findToggledSwitchIndex(snapSw) {
    for (let i = 0; i < SWITCH_NAMES.length; i++) {
      const cur = getContext().switchStates[i] != null ? getContext().switchStates[i] : 0;
      if (cur > 0.5 !== snapSw[i] > 0.5) return i;
    }
    return -1;
  }
  function readPotMappingRow(i) {
    const muxInp = document.querySelector(`.pi[data-i="${i}"][data-f="mux"]`);
    const potInp = document.querySelector(`.pi[data-i="${i}"][data-f="pot"]`);
    if (!muxInp || !potInp) return null;
    const rev = getContext().potMapping ? getContext().potMapping[i * 4 + 2] > 0.5 : false;
    return {
      mux: parseInt(muxInp.value, 10) || 0,
      pot: parseInt(potInp.value, 10) || 0,
      rev,
      cen: isPotCentered(POT_NAMES[i])
    };
  }
  function readSwitchMappingRow(i) {
    const pinInp = document.querySelector(`.si[data-i="${i}"][data-f="pin"]`);
    const portInp = document.querySelector(`.si[data-i="${i}"][data-f="port"]`);
    if (!pinInp || !portInp) return null;
    const rev = getContext().switchMapping ? getContext().switchMapping[i * 3 + 2] > 0.5 : false;
    return {
      pin: parseInt(pinInp.value, 10) || 0,
      port: parseInt(portInp.value, 10) || 0,
      rev
    };
  }
  function finishDetectPotFromPhysical(mux, pot, label) {
    const dst = getContext().detectMode.targetIndex;
    setMappingField("pot", dst, "mux", mux);
    setMappingField("pot", dst, "pot", pot);
    if (getContext().potMapping) {
      for (let i = 0; i < POT_NAMES.length; i++) {
        if (Math.round(getContext().potMapping[i * 4]) === mux && Math.round(getContext().potMapping[i * 4 + 1]) === pot) {
          const src = readPotMappingRow(i);
          if (src) setPotRevState(dst, src.rev);
          break;
        }
      }
    }
    getContext().mappingUserEdited = true;
    markMappingDirty();
    showDownloadStatus(`${POT_NAMES[dst]} \u2192 MUX ${mux} / Ch ${pot}`, false);
    advanceGuidedAfterHit();
  }
  function finishDetect(sourceIndex) {
    const dst = getContext().detectMode.targetIndex;
    const table = getContext().detectMode.table;
    if (table === "pot") {
      const src = readPotMappingRow(sourceIndex);
      if (!src) {
        cancelDetect();
        return;
      }
      setMappingField("pot", dst, "mux", src.mux);
      setMappingField("pot", dst, "pot", src.pot);
      setPotRevState(dst, src.rev);
      showDownloadStatus(`${POT_NAMES[dst]} \u2192 MUX ${src.mux} / Ch ${src.pot}`, false);
    } else {
      const src = readSwitchMappingRow(sourceIndex);
      if (!src) {
        cancelDetect();
        return;
      }
      setMappingField("sw", dst, "pin", src.pin);
      setMappingField("sw", dst, "port", src.port);
      setSwitchRevState(dst, src.rev);
      const portLabel = src.port > 0.5 ? "B" : "A";
      showDownloadStatus(`${SWITCH_NAMES[dst]} \u2192 Port ${portLabel} / Pin ${src.pin}`, false);
    }
    getContext().mappingUserEdited = true;
    markMappingDirty();
    updateMappingConflicts();
    advanceGuidedAfterHit();
  }
  function updateDetectMode() {
    if (!getContext().detectMode) return;
    if (getContext().detectMode.table === "pot") {
      const hit = findMovedMuxPot(getContext().detectMode.snapMuxRaw);
      if (hit) finishDetectPotFromPhysical(hit.mux, hit.pot, hit.label);
    } else {
      const srcIdx = findToggledSwitchIndex(getContext().detectMode.snapSw);
      if (srcIdx >= 0) finishDetect(srcIdx);
    }
  }
  function collectMappingFromForm() {
    const ctx = getContext();
    const pm = new Float32Array(POT_NAMES.length * 4);
    for (let i = 0; i < POT_NAMES.length; i++) {
      pm[i * 4 + 2] = ctx.potMapping && ctx.potMapping[i * 4 + 2] > 0.5 ? 1 : 0;
      pm[i * 4 + 3] = isPotCentered(POT_NAMES[i]) ? 1 : 0;
    }
    document.querySelectorAll(".pi").forEach((inp) => {
      const i = parseInt(inp.dataset.i, 10);
      const f = inp.dataset.f;
      if (f === "mux") pm[i * 4 + 0] = parseFloat(inp.value) || 0;
      if (f === "pot") pm[i * 4 + 1] = parseFloat(inp.value) || 0;
    });
    const sm = new Float32Array(SWITCH_NAMES.length * 3);
    for (let i = 0; i < SWITCH_NAMES.length; i++) {
      sm[i * 3 + 2] = ctx.switchMapping && ctx.switchMapping[i * 3 + 2] > 0.5 ? 1 : 0;
    }
    document.querySelectorAll(".si").forEach((inp) => {
      const i = parseInt(inp.dataset.i, 10);
      const f = inp.dataset.f;
      if (f === "pin") sm[i * 3 + 0] = parseFloat(inp.value) || 0;
      if (f === "port") sm[i * 3 + 1] = parseFloat(inp.value) || 0;
    });
    return { pm, sm };
  }
  function buildConfigJsonText(pm, sm) {
    const ctx = getContext();
    if (!ctx.configMeta && !ctx.loadedConfigBase && !ctx.boardConfigJson) return null;
    const M = CONFIG_META;
    let ignoredPots = [];
    if (Array.isArray(ctx.ignoredPotsList)) {
      ignoredPots = ctx.ignoredPotsList.map((item) => ({
        mux: Math.max(0, Math.min(7, Math.round(item.mux))),
        pot: Math.max(0, Math.min(9, Math.round(item.pot)))
      }));
    } else if (ctx.configMeta) {
      const ignoredCount = Math.round(ctx.configMeta[M.IGNORED_COUNT]);
      for (let i = 0; i < ignoredCount; i++) {
        ignoredPots.push({
          mux: Math.round(ctx.configMeta[M.IGNORED_BASE + i * 2 + 0]),
          pot: Math.round(ctx.configMeta[M.IGNORED_BASE + i * 2 + 1])
        });
      }
    }
    const pots = POT_NAMES.map((name, i) => ({
      name,
      mux: Math.max(0, Math.min(7, Math.round(pm[i * 4 + 0]))),
      pot: Math.max(0, Math.min(9, Math.round(pm[i * 4 + 1]))),
      reversed: pm[i * 4 + 2] > 0.5,
      centered: isPotCentered(name)
    }));
    const switches = SWITCH_NAMES.map((name, i) => ({
      name,
      pin: Math.max(0, Math.min(7, Math.round(sm[i * 3 + 0]))),
      reversed: sm[i * 3 + 2] > 0.5,
      port: sm[i * 3 + 1] > 0.5 ? "B" : "A"
    }));
    const routing = collectRoutingFromForm();
    const hw = getEffectiveHwInfo();
    const base = ctx.loadedConfigBase || ctx.boardConfigJson || {};
    const clipLeds = {};
    CLIP_LED_KEYS.forEach((key) => {
      const serialized = serializeClipLedEntry(ctx.clipLedsConfig && ctx.clipLedsConfig[key]);
      if (serialized !== null) clipLeds[key] = serialized;
    });
    const config = {
      _comment: typeof base._comment === "string" && base._comment ? base._comment : DEFAULT_CONFIG_COMMENT,
      developerMode: !!ctx.devModeBoot,
      mux: { activeMux: hw.activeMux },
      calibration: {
        potScaleRecovery: +Number(hw.potScaleRecovery).toFixed(4),
        potMax: +Number(hw.potMax).toFixed(3),
        potMin: +Number(hw.potMin).toFixed(3)
      },
      i2c: {
        bus: hw.bus,
        mcpAddress: hw.mcpAddress
      },
      routing,
      pots,
      switches,
      clipLeds,
      ignoredPots
    };
    Object.keys(base).forEach((k) => {
      if (!(k in config) && k !== "devMode" && k !== "uiDevMode") {
        config[k] = base[k];
      }
    });
    return JSON.stringify(config, null, 2);
  }
  function syncControlsDomFromState() {
    const ctx = getContext();
    if (!ctx.mappingBuilt) return;
    if (ctx.potMapping) {
      for (let i = 0; i < POT_NAMES.length; i++) {
        const muxInp = document.querySelector(`.pi[data-i="${i}"][data-f="mux"]`);
        const potInp = document.querySelector(`.pi[data-i="${i}"][data-f="pot"]`);
        if (muxInp) muxInp.value = String(Math.round(ctx.potMapping[i * 4 + 0]));
        if (potInp) potInp.value = String(Math.round(ctx.potMapping[i * 4 + 1]));
        setPotRevState(i, ctx.potMapping[i * 4 + 2] > 0.5);
      }
    }
    if (ctx.switchMapping) {
      for (let i = 0; i < SWITCH_NAMES.length; i++) {
        const pinInp = document.querySelector(`.si[data-i="${i}"][data-f="pin"]`);
        const portSel = document.querySelector(`.si[data-i="${i}"][data-f="port"]`);
        if (pinInp) pinInp.value = String(Math.round(ctx.switchMapping[i * 3 + 0]));
        if (portSel) portSel.value = ctx.switchMapping[i * 3 + 1] > 0.5 ? "1" : "0";
        setSwitchRevState(i, ctx.switchMapping[i * 3 + 2] > 0.5);
      }
    }
  }
  function applyBoardConfigToMapping(cfg, opts = {}) {
    if (!cfg || typeof cfg !== "object" || Array.isArray(cfg)) return false;
    const markDirty = !!opts.markDirty;
    const applyControls = opts.applyControls !== void 0 ? !!opts.applyControls : true;
    const ctx = getContext();
    try {
      ctx.loadedConfigBase = JSON.parse(JSON.stringify(cfg));
    } catch (_) {
      ctx.loadedConfigBase = cfg;
    }
    if (cfg.developerMode !== void 0) ctx.devModeBoot = !!cfg.developerMode;
    else if (cfg.devMode !== void 0) ctx.devModeBoot = !!cfg.devMode;
    else if (cfg.uiDevMode !== void 0) ctx.devModeBoot = !!cfg.uiDevMode;
    if (_devModeBootCb) _devModeBootCb.checked = !!ctx.devModeBoot;
    if (cfg.routing && typeof cfg.routing === "object") {
      applyRoutingObjectToForm(cfg.routing);
      ctx.routingFilledFromConfigJson = true;
    }
    if (cfg.clipLeds !== void 0) {
      const nextClips = {};
      CLIP_LED_KEYS.forEach((k) => {
        nextClips[k] = { enabled: false, port: "A", pin: 0, activeLow: false };
      });
      if (cfg.clipLeds && typeof cfg.clipLeds === "object" && !Array.isArray(cfg.clipLeds)) {
        CLIP_LED_KEYS.forEach((k) => {
          if (cfg.clipLeds[k] !== void 0) {
            nextClips[k] = parseClipLedConfigEntry(cfg.clipLeds[k]);
          }
        });
      } else if (Array.isArray(cfg.clipLeds)) {
        cfg.clipLeds.forEach((entry) => {
          if (!entry || typeof entry !== "object" || !entry.name) return;
          const lower = String(entry.name).toLowerCase().replace(/^clip_/, "");
          if (CLIP_LED_KEYS.includes(lower)) {
            nextClips[lower] = parseClipLedConfigEntry(entry);
          }
        });
      }
      ctx.clipLedsConfig = nextClips;
      renderClipLedsFromContext();
    }
    if (applyControls && Array.isArray(cfg.pots)) {
      if (!ctx.potMapping) ctx.potMapping = new Float32Array(POT_NAMES.length * 4);
      cfg.pots.forEach((p) => {
        if (!p || typeof p !== "object" || !p.name) return;
        const idx = POT_INDEX[p.name];
        if (idx === void 0) return;
        const mux = parseInt(p.mux, 10);
        const pot = parseInt(p.pot, 10);
        if (!isNaN(mux) && mux >= 0 && mux <= 7) ctx.potMapping[idx * 4 + 0] = mux;
        if (!isNaN(pot) && pot >= 0 && pot <= 9) ctx.potMapping[idx * 4 + 1] = pot;
        if (p.reversed !== void 0) ctx.potMapping[idx * 4 + 2] = p.reversed ? 1 : 0;
        ctx.potMapping[idx * 4 + 3] = isPotCentered(p.name) ? 1 : 0;
      });
    }
    if (applyControls && Array.isArray(cfg.switches)) {
      if (!ctx.switchMapping) ctx.switchMapping = new Float32Array(SWITCH_NAMES.length * 3);
      cfg.switches.forEach((sw) => {
        if (!sw || typeof sw !== "object" || !sw.name) return;
        const idx = SW_INDEX[sw.name];
        if (idx === void 0) return;
        const pin = parseInt(sw.pin, 10);
        if (!isNaN(pin) && pin >= 0 && pin <= 7) ctx.switchMapping[idx * 3 + 0] = pin;
        if (sw.port !== void 0) ctx.switchMapping[idx * 3 + 1] = String(sw.port).toUpperCase() === "B" ? 1 : 0;
        else if (sw.portB !== void 0) ctx.switchMapping[idx * 3 + 1] = sw.portB ? 1 : 0;
        if (sw.reversed !== void 0) ctx.switchMapping[idx * 3 + 2] = sw.reversed ? 1 : 0;
      });
    }
    if (applyControls && !ctx.mappingBuilt && ctx.potMapping && ctx.switchMapping) {
      tryBuildMappingTable();
    } else if (applyControls) {
      syncControlsDomFromState();
    }
    if (Array.isArray(cfg.ignoredPots)) {
      const list = [];
      cfg.ignoredPots.forEach((item) => {
        if (list.length >= 32) return;
        if (typeof item === "string") {
          const idx = POT_INDEX[item];
          if (idx !== void 0) {
            const coords = getPotMuxChannel(idx);
            if (coords) list.push({ mux: coords.mux, pot: coords.pot });
          }
        } else if (item && typeof item === "object") {
          if (item.mux !== void 0 && item.pot !== void 0) {
            const m = Math.max(0, Math.min(7, Math.round(Number(item.mux) || 0)));
            const p = Math.max(0, Math.min(9, Math.round(Number(item.pot) || 0)));
            list.push({ mux: m, pot: p });
          } else if (item.name) {
            const idx = POT_INDEX[item.name];
            if (idx !== void 0) {
              const coords = getPotMuxChannel(idx);
              if (coords) list.push({ mux: coords.mux, pot: coords.pot });
            }
          }
        }
      });
      ctx.ignoredPotsList = list;
      ctx.ignoredPotsFilledFromMeta = true;
      renderIgnoredPotsTable();
    }
    updateHardwareSummaryFromMeta();
    cleanConsoleOfIgnored();
    updateMappingConflicts();
    if (markDirty) {
      ctx.mappingUserEdited = true;
      ctx.ignoredPotsUserEdited = true;
      setMappingDirty(true);
    }
    return true;
  }
  function resetMappingStateForRestart() {
    const ctx = getContext();
    cancelDetect();
    ctx.mappingBuilt = false;
    ctx.potMapping = null;
    ctx.switchMapping = null;
    ctx.configMeta = null;
    ctx.routingFilledFromMeta = false;
    ctx.routingFilledFromConfigJson = false;
    ctx.ignoredPotsFilledFromMeta = false;
    ctx.mappingUserEdited = false;
    ctx.ignoredPotsUserEdited = false;
    setMappingDirty(false);
    const host = document.getElementById("map-groups-host");
    if (host) {
      host.innerHTML = '<div class="map-empty">Reloading mapping from Bela\u2026</div>';
    }
  }
  function buildValidatedConfigText() {
    const ctx = getContext();
    if (!ctx.mappingBuilt) {
      showDownloadStatus("Waiting for Bela mapping\u2026", true);
      return null;
    }
    if (!ctx.configMeta && !ctx.loadedConfigBase && !ctx.boardConfigJson) {
      showDownloadStatus("Config metadata not received", true);
      return null;
    }
    const routing = collectRoutingFromForm();
    if (Object.keys(routing.in).length !== ROUTING_IN_KEYS.length || Object.keys(routing.out).length !== ROUTING_OUT_KEYS.length) {
      showDownloadStatus("Invalid routing channels", true);
      return null;
    }
    for (const key of ROUTING_IN_KEYS) {
      const chs = routing.in[key].channels;
      if (!chs || !chs.length || chs.some((c) => c < ROUTING_CH_MIN || c > ROUTING_CH_MAX)) {
        showDownloadStatus(`Invalid input channel for ${ROUTING_LABELS[key] || key}`, true);
        return null;
      }
    }
    for (const key of ROUTING_OUT_KEYS) {
      const entry = routing.out[key];
      const chs = entry.channels ? entry.channels : [entry.channel];
      if (!chs.length || chs.some((c) => c < ROUTING_CH_MIN || c > ROUTING_CH_MAX)) {
        showDownloadStatus(`Invalid output channel for ${ROUTING_LABELS[key] || key}`, true);
        return null;
      }
    }
    const masterChans = routing.out.master && routing.out.master.channels;
    if (!Array.isArray(masterChans) || masterChans.length < 1) {
      showDownloadStatus("Master needs \u22651 output channel", true);
      return null;
    }
    const { pm, sm } = collectMappingFromForm();
    for (let i = 0; i < POT_NAMES.length; i++) {
      const mux = Math.round(pm[i * 4 + 0]);
      const pot = Math.round(pm[i * 4 + 1]);
      if (mux < 0 || mux > 7 || pot < 0 || pot > 9) {
        showDownloadStatus(`Invalid MUX/Ch on ${POT_NAMES[i]}`, true);
        return null;
      }
    }
    for (let i = 0; i < SWITCH_NAMES.length; i++) {
      const pin = Math.round(sm[i * 3 + 0]);
      if (pin < 0 || pin > 7) {
        showDownloadStatus(`Invalid pin on ${SWITCH_NAMES[i]}`, true);
        return null;
      }
    }
    const text = buildConfigJsonText(pm, sm);
    if (!text) {
      showDownloadStatus("JSON generation error", true);
      return null;
    }
    return text;
  }
  function triggerJsonDownload(text, filename = "config.json") {
    const blob = new Blob([text], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
  function handleLoadFileChange(e) {
    const file = e.target && e.target.files && e.target.files[0];
    if (e.target) e.target.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result || ""));
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
          showDownloadStatus("Invalid config.json file (root must be an object)", true);
          return;
        }
        applyBoardConfigToMapping(parsed, { markDirty: true, applyControls: true });
        showDownloadStatus(`Loaded ${file.name} \u2014 click Save to write to Bela`, false);
      } catch (err) {
        showDownloadStatus("Failed to parse JSON: " + (err && err.message ? err.message : "invalid syntax"), true);
      }
    };
    reader.onerror = () => showDownloadStatus("Failed to read selected file", true);
    reader.readAsText(file);
  }
  async function exportBoardConfigJson() {
    if (getContext().mappingActionBusy) return;
    setActionButtonsDisabled(true);
    try {
      let res = await fetchBoardConfigJson();
      if (!res.ok && res.status !== 404 && belaControlReady()) {
        const wsRes = await readConfigViaControl();
        if (wsRes.ok && wsRes.content) {
          res = { ok: true, text: wsRes.content };
        }
      }
      if (!res.ok || !res.text) {
        showDownloadStatus(res.error || "No config.json on Bela yet \u2014 click Save first", true);
        return;
      }
      triggerJsonDownload(res.text, "config.json");
      showDownloadStatus(
        getContext().mappingDirty ? "Exported Bela saved config.json (unsaved form edits not included)" : "Exported config.json from Bela",
        false
      );
    } finally {
      setActionButtonsDisabled(false);
    }
  }
  async function saveConfigAction() {
    if (getContext().mappingActionBusy) return false;
    if (!belaControlReady()) {
      showDownloadStatus("Bela not connected \u2014 cannot save", true);
      return false;
    }
    const text = buildValidatedConfigText();
    if (!text) return false;
    setActionButtonsDisabled(true);
    let savingNoticeShown = false;
    const savingTimer = setTimeout(() => {
      savingNoticeShown = true;
      showDownloadStatus("Saving config.json to Bela\u2026", false, 0);
    }, 150);
    try {
      const res = await saveConfigToBela(text);
      clearTimeout(savingTimer);
      if (!res.ok) {
        showDownloadStatus(res.error || "Failed to save config.json on Bela", true);
        return false;
      }
      const parsed = JSON.parse(text);
      const ctx = getContext();
      ctx.boardConfigRawText = text;
      ctx.boardConfigJson = parsed;
      ctx.loadedConfigBase = JSON.parse(text);
      setMappingDirty(false);
      showDownloadStatus("Saved config.json to Bela \u2014 click Restart to apply", false);
      return true;
    } finally {
      clearTimeout(savingTimer);
      if (savingNoticeShown && getContext().downloadStatusEl && getContext().downloadStatusEl.textContent === "Saving config.json to Bela\u2026") {
        showDownloadStatus("", false, 0);
      }
      setActionButtonsDisabled(false);
    }
  }
  function closeConfirmModal() {
    if (_modalEscBound) {
      document.removeEventListener("keydown", _modalEscBound);
      _modalEscBound = null;
    }
    if (_modalOverlay && _modalOverlay.parentNode) {
      _modalOverlay.parentNode.removeChild(_modalOverlay);
    }
    _modalOverlay = null;
  }
  function openConfirmModal({ title, body, actions }) {
    closeConfirmModal();
    const overlay = el("div", { className: "map-modal-backdrop" });
    const panel = el("div", {
      className: "map-modal-panel",
      role: "dialog",
      "aria-modal": "true",
      "aria-label": title
    });
    panel.appendChild(el("div", { className: "map-modal-title", textContent: title }));
    panel.appendChild(el("p", { className: "map-modal-body", textContent: body }));
    const row = el("div", { className: "map-modal-actions" });
    let focusBtn = null;
    actions.forEach((act) => {
      const btn = el("button", {
        type: "button",
        className: act.className || "btn-map-secondary",
        textContent: act.label
      });
      btn.addEventListener("click", async () => {
        closeConfirmModal();
        if (typeof act.onClick === "function") await act.onClick();
      });
      if (act.autoFocus) focusBtn = btn;
      row.appendChild(btn);
    });
    panel.appendChild(row);
    overlay.appendChild(panel);
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) closeConfirmModal();
    });
    _modalEscBound = (e) => {
      if (e.key === "Escape") closeConfirmModal();
    };
    document.addEventListener("keydown", _modalEscBound);
    document.body.appendChild(overlay);
    _modalOverlay = overlay;
    if (focusBtn) focusBtn.focus();
  }
  async function executeAudioRestart() {
    if (!belaControlReady()) {
      showDownloadStatus("Bela not connected \u2014 cannot restart", true);
      return;
    }
    const ctx = getContext();
    setActionButtonsDisabled(true);
    ctx.awaitingRestartReconnect = true;
    ctx.sawOfflineDuringRestart = false;
    showDownloadStatus("Restarting Bela audio engine\u2026", false, 0);
    const res = await restartBelaAudio();
    setActionButtonsDisabled(false);
    if (!res.ok) {
      ctx.awaitingRestartReconnect = false;
      ctx.sawOfflineDuringRestart = false;
      showDownloadStatus(res.error || "Failed to restart Bela audio", true);
    }
  }
  function confirmAndRestartAudio() {
    if (getContext().mappingActionBusy) return;
    if (!belaControlReady()) {
      showDownloadStatus("Bela not connected \u2014 cannot restart", true);
      return;
    }
    if (getContext().mappingDirty) {
      openConfirmModal({
        title: "Unsaved Configuration Changes",
        body: "You have unsaved Mapping changes. Save them to Bela before restarting the audio engine (~2\u20133 s, Wi-Fi preserved)?",
        actions: [
          { label: "Cancel", className: "btn-map-secondary", autoFocus: true },
          {
            label: "Restart Without Saving",
            className: "btn-restart",
            onClick: () => executeAudioRestart()
          },
          {
            label: "Save & Restart",
            className: "btn-save",
            onClick: async () => {
              const saved = await saveConfigAction();
              if (saved) await executeAudioRestart();
            }
          }
        ]
      });
    } else {
      openConfirmModal({
        title: "Restart Bela Audio Engine?",
        body: "Cleanly fades out audio and restarts the Bela preamp program (~2\u20133 s) to reload config.json. Wi-Fi and hotspot remain connected.",
        actions: [
          { label: "Cancel", className: "btn-map-secondary", autoFocus: true },
          {
            label: "Restart Audio",
            className: "btn-restart",
            onClick: () => executeAudioRestart()
          }
        ]
      });
    }
  }
  function confirmAndRebootBoard() {
    if (getContext().mappingActionBusy) return;
    if (!belaControlReady()) {
      showDownloadStatus("Bela not connected \u2014 cannot reboot", true);
      return;
    }
    openConfirmModal({
      title: "Reboot Entire Bela Board?",
      body: "Performs a full Linux OS reboot (~25\u201330 s). Audio stops and Wi-Fi / hotspot will temporarily disconnect until boot finishes.",
      actions: [
        { label: "Cancel", className: "btn-map-secondary", autoFocus: true },
        {
          label: "Reboot Bela",
          className: "btn-danger-solid",
          onClick: async () => {
            const ctx = getContext();
            setActionButtonsDisabled(true);
            ctx.awaitingRestartReconnect = true;
            ctx.sawOfflineDuringRestart = false;
            showDownloadStatus("Rebooting Bela board (~30 s)\u2026", false, 0);
            const res = await rebootBelaBoard();
            setActionButtonsDisabled(false);
            if (!res.ok) {
              ctx.awaitingRestartReconnect = false;
              ctx.sawOfflineDuringRestart = false;
              showDownloadStatus(res.error || "Failed to reboot Bela", true);
            }
          }
        }
      ]
    });
  }
  function setMappingStatus(msg, isError = false) {
    showDownloadStatus(msg, isError);
  }
  function showDownloadStatus(msg, isError, durationMs = 5e3) {
    const elNode = getContext().downloadStatusEl;
    if (!elNode) return;
    if (_statusClearTimer) {
      clearTimeout(_statusClearTimer);
      _statusClearTimer = null;
    }
    if (!msg) {
      elNode.classList.remove("show", "err");
      elNode.textContent = "";
      return;
    }
    elNode.textContent = msg;
    elNode.classList.toggle("err", !!isError);
    elNode.classList.add("show");
    if (durationMs > 0) {
      _statusClearTimer = setTimeout(() => {
        _statusClearTimer = null;
        if (getContext().downloadStatusEl === elNode && elNode.textContent === msg) {
          elNode.classList.remove("show", "err");
        }
      }, durationMs);
    }
  }

  // gui/dom/console.js
  var _switchTiles = [];
  var _potMuxChannelCache = null;
  var _potMuxChannelCacheVersion = -1;
  function getPotMuxChannelCache() {
    const v = getContext().potMappingVersion || 0;
    if (_potMuxChannelCache && _potMuxChannelCacheVersion === v)
      return _potMuxChannelCache;
    const n = POT_NAMES.length;
    _potMuxChannelCache = new Array(n);
    for (let i = 0; i < n; i++)
      _potMuxChannelCache[i] = getPotMuxChannel(i);
    _potMuxChannelCacheVersion = v;
    return _potMuxChannelCache;
  }
  function buildConsoleCard(listId) {
    const card = el("div", { className: "card live-tile" });
    card.dataset.tile = "console";
    const consoleHdr = el("div", { className: "console-header" });
    consoleHdr.appendChild(cardTitle("Activity"));
    const filterBar = el("div", { className: "console-filter" });
    [
      { mode: "normal", label: "Normal" },
      { mode: "detailed", label: "Detailed" }
    ].forEach(({ mode, label }) => {
      const btn = el("button", {
        type: "button",
        className: "console-filter-btn" + (mode === getContext().consoleFilterMode ? " active" : "")
      });
      btn.textContent = label;
      btn.dataset.mode = mode;
      btn.addEventListener("click", () => setConsoleFilterMode(mode));
      filterBar.appendChild(btn);
    });
    consoleHdr.appendChild(filterBar);
    card.appendChild(consoleHdr);
    const list = el("ul", { id: listId || "console-list", className: "console-list" });
    card.appendChild(list);
    if (!getContext().consoleLists)
      getContext().consoleLists = [];
    getContext().consoleLists.push(list);
    renderConsole();
    return card;
  }
  function buildSwitchesCard() {
    _switchTiles.length = 0;
    const swCard = el("div", { className: "card live-tile" });
    swCard.dataset.tile = "switches";
    swCard.appendChild(cardTitle("Switches"));
    const swGrid = el("div", { className: "sw-grid" });
    SWITCH_GROUPS.forEach((group) => {
      const grp = el("div", { className: "sw-group sw-group-" + group.type });
      const gtitle = el("div", { className: "sw-group-title" });
      gtitle.textContent = group.label;
      grp.appendChild(gtitle);
      const items = el("div", { className: "sw-group-items" });
      group.indices.forEach((i) => {
        items.appendChild(buildSwitchTile(i, SWITCH_NAMES[i], group.type));
      });
      grp.appendChild(items);
      swGrid.appendChild(grp);
    });
    swCard.appendChild(swGrid);
    return swCard;
  }
  function switchDisplayName(name) {
    if (name.indexOf("KILL_") === 0) return name.slice(5);
    if (name === "FX_FILTER_MIDS") return "FX1 MIDS";
    if (name === "FX_FILTER_TOPS") return "FX1 TOPS";
    if (name === "FX2_FILTER_TOPS") return "FX2 TOPS";
    if (name === "FX2_FILTER_MIDS") return "FX2 MIDS";
    if (name === "SIREN_TRIGGER") return "GATE";
    return name.replace(/_/g, " ");
  }
  function buildSwitchTile(index, name, type) {
    const tile = el("div", { className: "sw-tile sw-tile-" + type });
    tile.dataset.swIndex = String(index);
    const led = el("div", { className: "sw-led" });
    const lbl = el("span", { className: "sw-tile-name" });
    lbl.textContent = switchDisplayName(name);
    tile.appendChild(led);
    tile.appendChild(lbl);
    _switchTiles[index] = { tile, lastOn: null };
    return tile;
  }
  function syncConsolePotBaselines() {
    getContext().prevPotValues.set(getContext().potValues);
    getContext().prevPotValuesNormal.set(getContext().potValues);
    if (getContext().muxRawValues && getContext().prevMuxRawValues) {
      getContext().prevMuxRawValues.set(getContext().muxRawValues);
      getContext().prevMuxRawValuesNormal.set(getContext().muxRawValues);
    }
  }
  function setConsoleFilterMode(mode) {
    if (mode !== "normal" && mode !== "detailed") return;
    if (mode === getContext().consoleFilterMode) return;
    getContext().consoleFilterMode = mode;
    document.querySelectorAll(".console-filter-btn").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.mode === mode);
    });
    getContext().recentChanges = [];
    syncConsolePotBaselines();
    renderConsole();
  }
  var CONSOLE_ACTIVE_HOLD_MS = 1400;
  var CONSOLE_GLITCH_REBOUND_MAX_MS = 600;
  function formatVal(v, type) {
    if (v === void 0 || v === null) return "\xA0";
    if (type === "sw") {
      return v > 0.5 ? "ON" : "OFF";
    }
    return Number(v).toFixed(3);
  }
  function findRecentChange(name) {
    const list = getContext().recentChanges;
    if (!list) return null;
    return list.find((e) => e.name === name) || null;
  }
  function purgeGlitchEntry(name) {
    if (!getContext().recentChanges) return;
    const idx = getContext().recentChanges.findIndex((e) => e.name === name);
    if (idx === -1) return;
    getContext().recentChanges.splice(idx, 1);
    const lists = (getContext().consoleLists || []).filter((l) => l && l.isConnected);
    lists.forEach((list) => {
      for (const child of list.children) {
        if (child.dataset.key === name) {
          list.removeChild(child);
          break;
        }
      }
      if (list.children.length < MAX_CONSOLE) {
        const slot = list.children.length;
        list.appendChild(buildConsoleRow(null, slot));
      }
    });
  }
  function buildConsoleRow(entry, slot) {
    const isSw = entry && entry.type === "sw";
    const isEmpty = !entry;
    const key = entry ? entry.name : "__empty_" + slot;
    const li = el("li", { className: "crow" + (isEmpty ? " empty" : isSw ? " sw" : "") });
    li.dataset.key = key;
    if (isEmpty) li.style.setProperty("--slot", String(slot));
    const pct = entry ? Math.min(100, Math.max(0, entry.value * 100)).toFixed(1) : "0";
    const cname = entry ? entry.name : "\xA0";
    const fillCls = isEmpty ? "cfill cfill-loading" : "cfill";
    const fillStyle = isEmpty ? "" : ` style="width:${pct}%"`;
    const coldval = !isEmpty && entry.initialValue !== void 0 ? formatVal(entry.initialValue, entry.type) : "\xA0";
    const cval = !isEmpty ? formatVal(entry.value, entry.type) : "\xA0";
    let dirHtml = "&nbsp;";
    let dirCls = "cdir";
    if (!isEmpty) {
      if (isSw) {
        dirHtml = "\u25CF";
        dirCls = "cdir sw";
      } else if (entry.direction === "up") {
        dirHtml = "\u25B2";
        dirCls = "cdir up";
      } else if (entry.direction === "down") {
        dirHtml = "\u25BC";
        dirCls = "cdir down";
      }
    }
    li.innerHTML = `<span class="cname" title="${cname}">${cname}</span><span class="ctrack"><span class="${fillCls}"${fillStyle}></span></span><span class="cval-group"><span class="coldval">${coldval}</span><span class="${dirCls}">${dirHtml}</span><span class="cval">${cval}</span></span>`;
    if (entry && entry.ts && Date.now() - entry.ts < CONSOLE_ACTIVE_HOLD_MS) {
      li.classList.add("active");
      const remaining = Math.max(100, CONSOLE_ACTIVE_HOLD_MS - (Date.now() - entry.ts));
      li._activeTimer = setTimeout(() => {
        li.classList.remove("active");
        li._activeTimer = null;
      }, remaining);
    }
    return li;
  }
  function updateRowContent(row, entry, isNew, direction) {
    if (!row || !entry) return;
    const isSw = entry.type === "sw";
    row.dataset.key = entry.name;
    row.classList.remove("empty");
    row.classList.toggle("sw", isSw);
    const nameEl = row.querySelector(".cname");
    if (nameEl && nameEl.textContent !== entry.name) {
      nameEl.textContent = entry.name;
      nameEl.title = entry.name;
    }
    const fillEl = row.querySelector(".cfill");
    if (fillEl) {
      fillEl.className = "cfill";
      const pct = Math.min(100, Math.max(0, entry.value * 100)).toFixed(1);
      fillEl.style.width = pct + "%";
    }
    const oldValEl = row.querySelector(".coldval");
    if (oldValEl && entry.initialValue !== void 0) {
      oldValEl.textContent = formatVal(entry.initialValue, entry.type);
    }
    const dirEl = row.querySelector(".cdir");
    if (dirEl) {
      if (isSw) {
        dirEl.textContent = "\u25CF";
        dirEl.className = "cdir sw";
      } else if (direction === "up") {
        dirEl.textContent = "\u25B2";
        dirEl.className = "cdir up";
      } else if (direction === "down") {
        dirEl.textContent = "\u25BC";
        dirEl.className = "cdir down";
      }
    }
    const valEl = row.querySelector(".cval");
    if (valEl) {
      valEl.textContent = formatVal(entry.value, entry.type);
    }
    row.classList.add("active");
    if (row._activeTimer) clearTimeout(row._activeTimer);
    row._activeTimer = setTimeout(() => {
      row.classList.remove("active");
      row._activeTimer = null;
    }, CONSOLE_ACTIVE_HOLD_MS);
  }
  function removeExcessBottomSlot(list) {
    if (list.children.length <= MAX_CONSOLE) return;
    for (let i = list.children.length - 1; i >= 0; i--) {
      const child = list.children[i];
      if (child.classList.contains("empty")) {
        list.removeChild(child);
        return;
      }
    }
    if (list.lastElementChild) {
      list.removeChild(list.lastElementChild);
    }
  }
  function applyConsoleChangeToList(entry, list, direction) {
    const firstChild = list.firstElementChild;
    if (firstChild && firstChild.dataset.key === entry.name) {
      updateRowContent(firstChild, entry, false, direction);
      return;
    }
    const firstTops = /* @__PURE__ */ new Map();
    for (const child of list.children) {
      firstTops.set(child, child.getBoundingClientRect().top);
    }
    let targetRow = null;
    for (const child of list.children) {
      if (child.dataset.key === entry.name) {
        targetRow = child;
        break;
      }
    }
    if (targetRow) {
      list.insertBefore(targetRow, list.firstElementChild);
    } else {
      targetRow = buildConsoleRow(entry, 0);
      list.insertBefore(targetRow, list.firstElementChild);
      removeExcessBottomSlot(list);
    }
    updateRowContent(targetRow, entry, true, direction);
    const reduceMotion = typeof window !== "undefined" && window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) {
      for (const child of list.children) {
        child.style.transform = "";
        child.style.transition = "";
        child.style.opacity = "";
      }
      return;
    }
    for (const child of list.children) {
      const first = firstTops.get(child);
      const last = child.getBoundingClientRect().top;
      if (first !== void 0) {
        const dy = first - last;
        if (Math.abs(dy) > 0.5) {
          child.style.transform = `translateY(${dy}px)`;
          child.style.transition = "none";
        } else {
          child.style.transform = "";
          child.style.transition = "none";
        }
      } else {
        child.style.transform = "translateY(-18px) scale(0.98)";
        child.style.opacity = "0";
        child.style.transition = "none";
      }
    }
    void list.offsetHeight;
    for (const child of list.children) {
      child.style.transition = "transform 320ms cubic-bezier(0.16, 1, 0.3, 1), opacity 320ms ease";
      child.style.transform = "";
      child.style.opacity = "";
    }
    clearTimeout(list._animTimer);
    list._animTimer = setTimeout(() => {
      for (const child of list.children) {
        child.style.transition = "";
      }
      list._animTimer = null;
    }, 340);
  }
  function pushRecentChangeData(entry) {
    if (!getContext().recentChanges) getContext().recentChanges = [];
    getContext().recentChanges = getContext().recentChanges.filter((e) => e.name !== entry.name);
    getContext().recentChanges.unshift(entry);
    if (getContext().recentChanges.length > MAX_CONSOLE) {
      getContext().recentChanges.length = MAX_CONSOLE;
    }
  }
  function applyConsoleChange(entry) {
    const lists = (getContext().consoleLists || []).filter((l) => l && l.isConnected);
    if (!lists.length) {
      pushRecentChangeData(entry);
      return;
    }
    lists.forEach((list) => {
      applyConsoleChangeToList(entry, list, entry.direction);
    });
    pushRecentChangeData(entry);
  }
  function updateConsole() {
    const now = Date.now();
    const isNormal = getContext().consoleFilterMode === "normal";
    const potDelta = isNormal ? CONSOLE_POT_MIN_DELTA_NORMAL : CONSOLE_POT_MIN_DELTA_DETAILED;
    const unmappedPotDelta = isNormal ? 0.035 : CONSOLE_POT_MIN_DELTA_DETAILED;
    const potPrev = isNormal ? getContext().prevPotValuesNormal : getContext().prevPotValues;
    const changes = [];
    const muxCache = getPotMuxChannelCache();
    const mappedChannels = /* @__PURE__ */ new Set();
    for (let i = 0; i < POT_NAMES.length; i++) {
      const coords = muxCache[i];
      if (coords) {
        mappedChannels.add(`${coords.mux}:${coords.pot}`);
      }
      if (coords && isPotIgnored(coords.mux, coords.pot)) continue;
      const v = getContext().potValues[i];
      const prevV = potPrev[i];
      if (Math.abs(v - prevV) >= potDelta) {
        potPrev[i] = v;
        if (coords) {
          const unmappedName = formatUnmappedPotLabel(coords.mux, coords.pot);
          getContext().recentChanges = (getContext().recentChanges || []).filter((e) => e.name !== unmappedName);
        }
        const name = POT_NAMES[i];
        const existing = findRecentChange(name);
        const inActiveSession = existing && existing.ts && now - existing.ts < CONSOLE_ACTIVE_HOLD_MS;
        let dir = v > prevV + 5e-4 ? "up" : v < prevV - 5e-4 ? "down" : "same";
        let initialValue;
        if (inActiveSession && existing.initialValue !== void 0) {
          if (existing.direction && dir !== "same" && dir !== existing.direction) {
            initialValue = existing.value;
          } else {
            initialValue = existing.initialValue;
          }
        } else {
          initialValue = prevV;
        }
        if (Math.abs(v - initialValue) <= 1e-3 || formatVal(v, "pot") === formatVal(initialValue, "pot")) {
          if (existing && existing.ts && now - existing.ts < CONSOLE_GLITCH_REBOUND_MAX_MS) {
            purgeGlitchEntry(name);
          }
          continue;
        }
        if (dir === "same" && existing && existing.direction) {
          dir = existing.direction;
        }
        changes.push({
          name,
          value: v,
          initialValue,
          type: "pot",
          ts: now,
          direction: dir
        });
      }
    }
    for (let i = 0; i < SWITCH_NAMES.length; i++) {
      const v = getContext().switchStates[i];
      if (v !== getContext().prevSwitchStates[i]) {
        getContext().prevSwitchStates[i] = v;
        const name = SWITCH_NAMES[i];
        const existing = findRecentChange(name);
        const inActiveSession = existing && existing.ts && now - existing.ts < CONSOLE_ACTIVE_HOLD_MS;
        const initialValue = inActiveSession && existing.initialValue !== void 0 ? existing.initialValue : existing ? existing.value : v > 0.5 ? 0 : 1;
        changes.push({
          name,
          value: v,
          initialValue,
          type: "sw",
          ts: now,
          direction: v > 0.5 ? "on" : "off"
        });
      }
    }
    if (getContext().muxRawValues && getContext().prevMuxRawValues && getContext().prevMuxRawValuesNormal) {
      const muxPrev = isNormal ? getContext().prevMuxRawValuesNormal : getContext().prevMuxRawValues;
      const activeMux = getActiveMuxCount();
      for (let m = 0; m < activeMux; m++) {
        for (let p = 0; p < MUX_POTS_PER_MUX; p++) {
          if (isPotIgnored(m, p) || mappedChannels.has(`${m}:${p}`) || isPotMapped(m, p)) continue;
          const idx = muxRawIndex(m, p);
          const v = getContext().muxRawValues[idx];
          const prevV = muxPrev[idx];
          if (Math.abs(v - prevV) >= unmappedPotDelta) {
            muxPrev[idx] = v;
            const name = formatUnmappedPotLabel(m, p);
            const existing = findRecentChange(name);
            const inActiveSession = existing && existing.ts && now - existing.ts < CONSOLE_ACTIVE_HOLD_MS;
            let dir = v > prevV + 5e-4 ? "up" : v < prevV - 5e-4 ? "down" : "same";
            let initialValue;
            if (inActiveSession && existing.initialValue !== void 0) {
              if (existing.direction && dir !== "same" && dir !== existing.direction) {
                initialValue = existing.value;
              } else {
                initialValue = existing.initialValue;
              }
            } else {
              initialValue = prevV;
            }
            if (Math.abs(v - initialValue) <= 1e-3 || formatVal(v, "pot") === formatVal(initialValue, "pot")) {
              if (existing && existing.ts && now - existing.ts < CONSOLE_GLITCH_REBOUND_MAX_MS) {
                purgeGlitchEntry(name);
              }
              continue;
            }
            if (dir === "same" && existing && existing.direction) {
              dir = existing.direction;
            }
            changes.push({
              name,
              value: v,
              initialValue,
              type: "pot",
              ts: now,
              direction: dir
            });
          }
        }
      }
    }
    if (changes.length > 0) {
      if (changes.length > 2) {
        for (const c of changes) pushRecentChangeData(c);
        renderConsole();
      } else {
        for (let i = changes.length - 1; i >= 0; i--) {
          applyConsoleChange(changes[i]);
        }
      }
    }
  }
  function renderConsole() {
    const lists = getContext().consoleLists || [];
    if (!lists.length) return;
    lists.forEach((list) => {
      if (!list) return;
      list.innerHTML = "";
      const recent = getContext().recentChanges || [];
      for (let i = 0; i < MAX_CONSOLE; i++) {
        list.appendChild(
          buildConsoleRow(recent[i] || null, i)
        );
      }
    });
  }
  function updateSwitches() {
    const sw = getContext().switchStates;
    for (let i = 0; i < _switchTiles.length; i++) {
      const entry = _switchTiles[i];
      if (!entry || !entry.tile.isConnected) continue;
      const on = sw[i] > 0.5;
      if (entry.lastOn !== on) {
        entry.lastOn = on;
        entry.tile.classList.toggle("on", on);
      }
    }
  }

  // gui/dom/masterEq.js
  function masterEqPotToGainDb(pot, rangeDb) {
    return (pot - 0.5) * 2 * rangeDb;
  }
  function masterEqLogInterp(fMin, fMax, t) {
    return fMin * Math.pow(fMax / fMin, t);
  }
  function masterEqLinInterp(vMin, vMax, t) {
    return vMin + t * (vMax - vMin);
  }
  function biquadMagLinear(c, f, fs) {
    const w = 2 * Math.PI * f / fs;
    const cw = Math.cos(w);
    const sw = Math.sin(w);
    const c2w = Math.cos(2 * w);
    const s2w = Math.sin(2 * w);
    const numRe = c.b0 + c.b1 * cw + c.b2 * c2w;
    const numIm = -c.b1 * sw - c.b2 * s2w;
    const denRe = 1 + c.a1 * cw + c.a2 * c2w;
    const denIm = -c.a1 * sw - c.a2 * s2w;
    const num = Math.hypot(numRe, numIm);
    const den = Math.hypot(denRe, denIm);
    return den > 1e-15 ? num / den : 0;
  }
  function biquadPeaking(freq, gainDb, q, fs) {
    const A = Math.pow(10, gainDb / 40);
    const w0 = 2 * Math.PI * freq / fs;
    const alpha = Math.sin(w0) / (2 * q);
    const cw = Math.cos(w0);
    const a0 = 1 + alpha / A;
    return {
      b0: (1 + alpha * A) / a0,
      b1: -2 * cw / a0,
      b2: (1 - alpha * A) / a0,
      a1: -2 * cw / a0,
      a2: (1 - alpha / A) / a0
    };
  }
  function biquadLowShelf(freq, gainDb, fs) {
    const A = Math.pow(10, gainDb / 40);
    const w0 = 2 * Math.PI * freq / fs;
    const cw = Math.cos(w0);
    const sw = Math.sin(w0);
    const alpha = sw / 2 * Math.SQRT2;
    const sqA = Math.sqrt(A);
    const a0 = A + 1 + (A - 1) * cw + 2 * sqA * alpha;
    return {
      b0: A * (A + 1 - (A - 1) * cw + 2 * sqA * alpha) / a0,
      b1: 2 * A * (A - 1 - (A + 1) * cw) / a0,
      b2: A * (A + 1 - (A - 1) * cw - 2 * sqA * alpha) / a0,
      a1: -2 * (A - 1 + (A + 1) * cw) / a0,
      a2: (A + 1 + (A - 1) * cw - 2 * sqA * alpha) / a0
    };
  }
  function biquadHighShelf(freq, gainDb, fs) {
    const A = Math.pow(10, gainDb / 40);
    const w0 = 2 * Math.PI * freq / fs;
    const cw = Math.cos(w0);
    const sw = Math.sin(w0);
    const alpha = sw / 2 * Math.SQRT2;
    const sqA = Math.sqrt(A);
    const a0 = A + 1 - (A - 1) * cw + 2 * sqA * alpha;
    return {
      b0: A * (A + 1 + (A - 1) * cw + 2 * sqA * alpha) / a0,
      b1: -2 * A * (A - 1 + (A + 1) * cw) / a0,
      b2: A * (A + 1 + (A - 1) * cw - 2 * sqA * alpha) / a0,
      a1: 2 * (A - 1 - (A + 1) * cw) / a0,
      a2: (A + 1 - (A - 1) * cw - 2 * sqA * alpha) / a0
    };
  }
  function biquadLowPass(freq, q, fs) {
    const w0 = 2 * Math.PI * freq / fs;
    const cw = Math.cos(w0);
    const alpha = Math.sin(w0) / (2 * q);
    const a0 = 1 + alpha;
    return {
      b0: (1 - cw) * 0.5 / a0,
      b1: (1 - cw) / a0,
      b2: (1 - cw) * 0.5 / a0,
      a1: -2 * cw / a0,
      a2: (1 - alpha) / a0
    };
  }
  function biquadHighPass(freq, q, fs) {
    const w0 = 2 * Math.PI * freq / fs;
    const cw = Math.cos(w0);
    const alpha = Math.sin(w0) / (2 * q);
    const a0 = 1 + alpha;
    return {
      b0: (1 + cw) * 0.5 / a0,
      b1: -(1 + cw) / a0,
      b2: (1 + cw) * 0.5 / a0,
      a1: -2 * cw / a0,
      a2: (1 - alpha) / a0
    };
  }
  function killBandMagLinear(band, f, fs, cfg) {
    const q = cfg.KILL_CROSSOVER_Q;
    const st = cfg.KILL_FILTER_STAGES;
    const fc = cfg.KILL_FC;
    let h = 1;
    if (band === "sub") {
      const c = biquadLowPass(fc[0], q, fs);
      h = Math.pow(biquadMagLinear(c, f, fs), st);
    } else if (band === "kick") {
      const hp = biquadHighPass(fc[0], q, fs);
      const lp = biquadLowPass(fc[1], q, fs);
      h = Math.pow(biquadMagLinear(hp, f, fs), st) * Math.pow(biquadMagLinear(lp, f, fs), st);
    } else if (band === "mid") {
      const hp = biquadHighPass(fc[1], q, fs);
      const lp = biquadLowPass(fc[2], q, fs);
      h = Math.pow(biquadMagLinear(hp, f, fs), st) * Math.pow(biquadMagLinear(lp, f, fs), st);
    } else {
      const hp = biquadHighPass(fc[2], q, fs);
      h = Math.pow(biquadMagLinear(hp, f, fs), st);
    }
    return h;
  }
  var _hpfActive = false;
  var _lpfActive = false;
  var _prevHpfActive = false;
  var _prevLpfActive = false;
  var _stableEqPots = null;
  var _stableSwitches = new Uint8Array(4);
  function computeMasterCurve(pots, switches) {
    const cfg = MASTER_EQ_CONFIG;
    const fs = cfg.SAMPLE_RATE;
    const eps = cfg.GAIN_EPSILON_DB;
    const p = cfg.POT;
    const out = getContext().masterEqCurveDb;
    const n = cfg.CURVE_POINTS;
    const peGainDb = [
      masterEqPotToGainDb(pots[p.PE_SUB_GAIN], cfg.MASTER_EQ_GAIN_RANGE_DB),
      masterEqPotToGainDb(pots[p.PE_KICK_GAIN], cfg.MASTER_EQ_GAIN_RANGE_DB),
      masterEqPotToGainDb(pots[p.PE_MID_GAIN], cfg.MASTER_EQ_GAIN_RANGE_DB),
      masterEqPotToGainDb(pots[p.PE_TOP_GAIN], cfg.MASTER_EQ_GAIN_RANGE_DB)
    ];
    const peFreqPot = [
      pots[p.PE_SUB_FREQ],
      pots[p.PE_KICK_FREQ],
      pots[p.PE_MID_FREQ],
      pots[p.PE_TOP_FREQ]
    ];
    const geqGainDb = [];
    for (let i = 0; i < cfg.GEQ_FREQS.length; i++)
      geqGainDb[i] = masterEqPotToGainDb(
        pots[p.GEQ_BASE + i],
        cfg.GEQ_GAIN_RANGE_DB
      );
    const btrimGainDb = [
      masterEqPotToGainDb(pots[p.BTRIM_SUB], cfg.BAND_TRIM_GAIN_DB),
      masterEqPotToGainDb(pots[p.BTRIM_KICK], cfg.BAND_TRIM_GAIN_DB),
      masterEqPotToGainDb(pots[p.BTRIM_MID], cfg.BAND_TRIM_GAIN_DB),
      masterEqPotToGainDb(pots[p.BTRIM_TOP], cfg.BAND_TRIM_GAIN_DB)
    ];
    let hpfCoeffs = null;
    let lpfCoeffs = null;
    if (_hpfActive) {
      const fc = masterEqLogInterp(cfg.HPF_FMIN, cfg.HPF_FMAX, pots[p.HPF_FREQ]);
      const q = masterEqLinInterp(cfg.FILTER_QMIN, cfg.FILTER_QMAX, pots[p.HPF_RES]);
      hpfCoeffs = biquadHighPass(fc, q, fs);
    }
    if (_lpfActive) {
      const fc = masterEqLogInterp(cfg.LPF_FMAX, cfg.LPF_FMIN, pots[p.LPF_FREQ]);
      const q = masterEqLinInterp(cfg.FILTER_QMIN, cfg.FILTER_QMAX, pots[p.LPF_RES]);
      lpfCoeffs = biquadLowPass(fc, q, fs);
    }
    const kill = cfg.KILL_SWITCH;
    const anyKill = switches[kill.SUB] > 0.5 || switches[kill.KICK] > 0.5 || switches[kill.MID] > 0.5 || switches[kill.TOP] > 0.5;
    const bandGain = [
      switches[kill.SUB] > 0.5 ? 0 : 1,
      switches[kill.KICK] > 0.5 ? 0 : 1,
      switches[kill.MID] > 0.5 ? 0 : 1,
      switches[kill.TOP] > 0.5 ? 0 : 1
    ];
    for (let i = 0; i < n; i++) {
      const f = masterEqFreqs[i];
      let h = 1;
      for (let b = 0; b < 4; b++) {
        if (Math.abs(peGainDb[b]) > eps) {
          const fc = masterEqLogInterp(
            cfg.MASTER_EQ_FMIN[b],
            cfg.MASTER_EQ_FMAX[b],
            peFreqPot[b]
          );
          const c = biquadPeaking(fc, peGainDb[b], cfg.MASTER_EQ_Q, fs);
          h *= biquadMagLinear(c, f, fs);
        }
      }
      for (let b = 0; b < cfg.GEQ_FREQS.length; b++) {
        if (Math.abs(geqGainDb[b]) > eps) {
          const c = biquadPeaking(cfg.GEQ_FREQS[b], geqGainDb[b], cfg.GEQ_Q, fs);
          h *= biquadMagLinear(c, f, fs);
        }
      }
      if (hpfCoeffs) h *= biquadMagLinear(hpfCoeffs, f, fs);
      if (lpfCoeffs) h *= biquadMagLinear(lpfCoeffs, f, fs);
      if (Math.abs(btrimGainDb[0]) > eps)
        h *= biquadMagLinear(biquadLowShelf(cfg.KILL_FC[0], btrimGainDb[0], fs), f, fs);
      if (Math.abs(btrimGainDb[1]) > eps)
        h *= biquadMagLinear(
          biquadPeaking(
            cfg.BAND_TRIM_KICK_FREQ,
            btrimGainDb[1],
            cfg.BAND_TRIM_KICK_Q,
            fs
          ),
          f,
          fs
        );
      if (Math.abs(btrimGainDb[2]) > eps)
        h *= biquadMagLinear(
          biquadPeaking(
            cfg.BAND_TRIM_MID_FREQ,
            btrimGainDb[2],
            cfg.BAND_TRIM_MID_Q,
            fs
          ),
          f,
          fs
        );
      if (Math.abs(btrimGainDb[3]) > eps)
        h *= biquadMagLinear(biquadHighShelf(cfg.KILL_FC[2], btrimGainDb[3], fs), f, fs);
      if (anyKill) {
        const hSub = killBandMagLinear("sub", f, fs, cfg);
        const hKick = killBandMagLinear("kick", f, fs, cfg);
        const hMid = killBandMagLinear("mid", f, fs, cfg);
        const hTop = killBandMagLinear("top", f, fs, cfg);
        h *= bandGain[0] * hSub + bandGain[1] * hKick + bandGain[2] * hMid + bandGain[3] * hTop;
      }
      out[i] = 20 * Math.log10(Math.max(h, 1e-12));
    }
    return out;
  }
  function formatMasterEqFreqLabel(hz) {
    if (hz >= 1e3) {
      const k = hz / 1e3;
      const n = k % 1 === 0 ? k.toFixed(0) : k.toFixed(1);
      return n + "kHz";
    }
    return hz + "Hz";
  }
  function masterEqFreqToX(f, plotX, plotW) {
    const cfg = MASTER_EQ_CONFIG;
    const t = (Math.log10(f) - Math.log10(cfg.FREQ_MIN)) / (Math.log10(cfg.FREQ_MAX) - Math.log10(cfg.FREQ_MIN));
    return plotX + t * plotW;
  }
  function masterEqDbToY(db, plotY, plotH) {
    const cfg = MASTER_EQ_CONFIG;
    const t = (cfg.Y_MAX_DB - db) / (cfg.Y_MAX_DB - cfg.Y_MIN_DB);
    return plotY + t * plotH;
  }
  function drawMasterEqOnCanvas(canvas, ctx2d) {
    if (!canvas || !ctx2d) return;
    const cfg = MASTER_EQ_CONFIG;
    const dpr = window.devicePixelRatio || 1;
    const cssW = canvas.clientWidth || 800;
    const cssH = canvas.clientHeight || 240;
    const pixW = Math.round(cssW * dpr);
    const pixH = Math.round(cssH * dpr);
    if (canvas.width !== pixW || canvas.height !== pixH) {
      canvas.width = pixW;
      canvas.height = pixH;
    }
    canvas._eqDrawn = true;
    ctx2d.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx2d.clearRect(0, 0, cssW, cssH);
    const padL = 44;
    const padR = 14;
    const padT = 14;
    const padB = 40;
    const plotX = padL;
    const plotY = padT;
    const plotW = cssW - padL - padR;
    const plotH = cssH - padT - padB;
    const isDark = document.documentElement.dataset.theme === "dark";
    const gridColor = isDark ? "#242c3b" : "#e8e8ec";
    const zeroLineColor = isDark ? "#475569" : "#bbb";
    const frameColor = isDark ? "#334155" : "#ccc";
    const textColor = isDark ? "#8b949e" : "#888";
    const curveColor = isDark ? "#ff5447" : "#e74c3c";
    ctx2d.strokeStyle = gridColor;
    ctx2d.lineWidth = 1;
    for (let db = cfg.Y_MIN_DB; db <= cfg.Y_MAX_DB; db += 6) {
      const y = masterEqDbToY(db, plotY, plotH);
      ctx2d.beginPath();
      ctx2d.moveTo(plotX, y);
      ctx2d.lineTo(plotX + plotW, y);
      ctx2d.stroke();
    }
    MASTER_EQ_FREQ_TICKS.forEach((hz) => {
      const x = masterEqFreqToX(hz, plotX, plotW);
      ctx2d.beginPath();
      ctx2d.moveTo(x, plotY);
      ctx2d.lineTo(x, plotY + plotH);
      ctx2d.stroke();
    });
    ctx2d.strokeStyle = zeroLineColor;
    ctx2d.setLineDash([4, 4]);
    const y0 = masterEqDbToY(0, plotY, plotH);
    ctx2d.beginPath();
    ctx2d.moveTo(plotX, y0);
    ctx2d.lineTo(plotX + plotW, y0);
    ctx2d.stroke();
    ctx2d.setLineDash([]);
    ctx2d.strokeStyle = frameColor;
    ctx2d.strokeRect(plotX, plotY, plotW, plotH);
    ctx2d.fillStyle = textColor;
    ctx2d.font = "10px monospace";
    ctx2d.textAlign = "right";
    ctx2d.textBaseline = "middle";
    for (let db = cfg.Y_MIN_DB; db <= cfg.Y_MAX_DB; db += 6) {
      const y = masterEqDbToY(db, plotY, plotH);
      ctx2d.fillText((db > 0 ? "+" : "") + db + " dB", padL - 6, y);
    }
    ctx2d.textAlign = "center";
    ctx2d.textBaseline = "top";
    MASTER_EQ_FREQ_TICKS.forEach((hz, i) => {
      const x = masterEqFreqToX(hz, plotX, plotW);
      const labelY = plotY + plotH + 6 + i % 2 * 12;
      ctx2d.fillText(formatMasterEqFreqLabel(hz), x, labelY);
    });
    const curve = getContext().masterEqCurveDb;
    ctx2d.strokeStyle = curveColor;
    ctx2d.lineWidth = 2;
    ctx2d.beginPath();
    for (let i = 0; i < cfg.CURVE_POINTS; i++) {
      const x = masterEqFreqToX(masterEqFreqs[i], plotX, plotW);
      const y = masterEqDbToY(curve[i], plotY, plotH);
      if (i === 0) ctx2d.moveTo(x, y);
      else ctx2d.lineTo(x, y);
    }
    ctx2d.stroke();
    ctx2d.fillStyle = curveColor;
    ctx2d.beginPath();
    for (let i = 0; i < cfg.CURVE_POINTS; i++) {
      const x = masterEqFreqToX(masterEqFreqs[i], plotX, plotW);
      const y = masterEqDbToY(curve[i], plotY, plotH);
      if (i === 0) ctx2d.moveTo(x, y);
      else ctx2d.lineTo(x, y);
    }
    ctx2d.lineTo(
      masterEqFreqToX(masterEqFreqs[cfg.CURVE_POINTS - 1], plotX, plotW),
      masterEqDbToY(cfg.Y_MIN_DB, plotY, plotH)
    );
    ctx2d.lineTo(
      masterEqFreqToX(masterEqFreqs[0], plotX, plotW),
      masterEqDbToY(cfg.Y_MIN_DB, plotY, plotH)
    );
    ctx2d.closePath();
    ctx2d.globalAlpha = isDark ? 0.14 : 0.08;
    ctx2d.fill();
    ctx2d.globalAlpha = 1;
  }
  function drawMasterEqCurve() {
    const targets = getContext().masterEqTargets || [];
    targets.forEach((t) => {
      if (t.canvas && t.ctx) drawMasterEqOnCanvas(t.canvas, t.ctx);
    });
  }
  var _EQ_POT_INDICES = (function() {
    const p = MASTER_EQ_CONFIG.POT;
    return [
      p.PE_SUB_FREQ,
      p.PE_SUB_GAIN,
      p.PE_KICK_FREQ,
      p.PE_KICK_GAIN,
      p.PE_MID_FREQ,
      p.PE_MID_GAIN,
      p.PE_TOP_FREQ,
      p.PE_TOP_GAIN,
      p.HPF_FREQ,
      p.HPF_RES,
      p.LPF_FREQ,
      p.LPF_RES,
      p.BTRIM_SUB,
      p.BTRIM_KICK,
      p.BTRIM_MID,
      p.BTRIM_TOP,
      p.GEQ_BASE,
      p.GEQ_BASE + 1,
      p.GEQ_BASE + 2,
      p.GEQ_BASE + 3,
      p.GEQ_BASE + 4,
      p.GEQ_BASE + 5,
      p.GEQ_BASE + 6,
      p.GEQ_BASE + 7,
      p.GEQ_BASE + 8,
      p.GEQ_BASE + 9,
      p.GEQ_BASE + 10,
      p.GEQ_BASE + 11
    ];
  })();
  function _syncStableInputs(pots, switches) {
    const cfg = MASTER_EQ_CONFIG;
    const eps = cfg.POT_EPSILON;
    const p = cfg.POT;
    let dirty = false;
    if (!pots || !pots.length) return false;
    if (!_stableEqPots || _stableEqPots.length < pots.length) {
      _stableEqPots = new Float32Array(pots.length);
      for (let i = 0; i < pots.length; i++) _stableEqPots[i] = pots[i];
      if (switches) {
        for (let s = 0; s < 4; s++) _stableSwitches[s] = switches[s] > 0.5 ? 1 : 0;
      }
      _hpfActive = _stableEqPots[p.HPF_FREQ] >= cfg.FILTER_ON_THRESHOLD;
      _lpfActive = _stableEqPots[p.LPF_FREQ] >= cfg.FILTER_ON_THRESHOLD;
      _prevHpfActive = _hpfActive;
      _prevLpfActive = _lpfActive;
      return true;
    }
    for (let i = 0; i < _EQ_POT_INDICES.length; i++) {
      const idx = _EQ_POT_INDICES[i];
      const v = pots[idx];
      const prev = _stableEqPots[idx];
      if (Math.abs(v - prev) >= eps) {
        _stableEqPots[idx] = v;
        dirty = true;
      }
    }
    const hpfVal = _stableEqPots[p.HPF_FREQ];
    if (!_hpfActive && hpfVal >= cfg.FILTER_ON_THRESHOLD) {
      _hpfActive = true;
    } else if (_hpfActive && hpfVal < cfg.FILTER_OFF_THRESHOLD) {
      _hpfActive = false;
    }
    if (_hpfActive !== _prevHpfActive) {
      _prevHpfActive = _hpfActive;
      dirty = true;
    }
    const lpfVal = _stableEqPots[p.LPF_FREQ];
    if (!_lpfActive && lpfVal >= cfg.FILTER_ON_THRESHOLD) {
      _lpfActive = true;
    } else if (_lpfActive && lpfVal < cfg.FILTER_OFF_THRESHOLD) {
      _lpfActive = false;
    }
    if (_lpfActive !== _prevLpfActive) {
      _prevLpfActive = _lpfActive;
      dirty = true;
    }
    if (switches) {
      for (let s = 0; s < 4; s++) {
        const st = switches[s] > 0.5 ? 1 : 0;
        if (st !== _stableSwitches[s]) {
          _stableSwitches[s] = st;
          dirty = true;
        }
      }
    }
    return dirty;
  }
  function updateMasterEq() {
    const ctx = getContext();
    const liveHasEq = isLiveTileOn(ctx.liveLayoutPrefs, "masterEq");
    const visible = liveHasEq && ctx.currentTab === TAB_LIVE;
    const dirty = _syncStableInputs(ctx.potValues, ctx.switchStates);
    if (dirty) {
      computeMasterCurve(_stableEqPots, _stableSwitches);
      if (visible) drawMasterEqCurve();
    } else if (visible) {
      const targets = ctx.masterEqTargets || [];
      const dpr = window.devicePixelRatio || 1;
      let needsRedraw = false;
      for (let i = 0; i < targets.length; i++) {
        const c = targets[i].canvas;
        if (c && c.isConnected) {
          const pixW = Math.round((c.clientWidth || 800) * dpr);
          const pixH = Math.round((c.clientHeight || 240) * dpr);
          if (c.width !== pixW || c.height !== pixH || !c._eqDrawn) {
            needsRedraw = true;
            break;
          }
        }
      }
      if (needsRedraw) {
        drawMasterEqCurve();
      }
    }
  }
  function resizeMasterEqCanvas() {
    drawMasterEqCurve();
  }
  function buildMasterEqCard(opts) {
    const canvasId = opts && opts.canvasId || "live-master-eq-canvas";
    const card = el("div", {
      id: "live-master-eq-card",
      className: "card live-tile"
    });
    card.dataset.tile = "masterEq";
    const hdr = el("div", { className: "card-header-row" });
    hdr.appendChild(cardTitle("Master EQ"));
    hdr.appendChild(el("span", { className: "card-meta", textContent: "Theoretical dry curve" }));
    card.appendChild(hdr);
    const wrap = el("div", { className: "master-eq-wrap" });
    const canvas = el("canvas", { id: canvasId, className: "master-eq-canvas" });
    canvas.width = 800;
    canvas.height = 320;
    const ctx2d = canvas.getContext("2d");
    wrap.appendChild(canvas);
    card.appendChild(wrap);
    if (!getContext().masterEqTargets)
      getContext().masterEqTargets = [];
    getContext().masterEqTargets.push({ canvas, ctx: ctx2d });
    return card;
  }

  // gui/dom/sampler.js
  var EMPTY_MSG = "No samples folder found (src/samples/).";
  var WAIT_MSG = "Waiting for Bela\u2026";
  var NONE_MSG = "No WAV/MP3 files in src/samples/.";
  function decodeSampleNames(namesBuf, count) {
    const names = [];
    if (!namesBuf || count <= 0) return names;
    const n = Math.min(count, MAX_SAMPLES);
    for (let i = 0; i < n; ++i) {
      const base = i * MAX_SAMPLE_NAME_LEN;
      let s = "";
      for (let c = 0; c < MAX_SAMPLE_NAME_LEN; ++c) {
        const code = Math.round(namesBuf[base + c] || 0);
        if (code <= 0) break;
        s += String.fromCharCode(code);
      }
      names.push(s || `Sample ${i + 1}`);
    }
    return names;
  }
  function _sendPlay(slot) {
    if (!belaControlReady()) return;
    Bela.control.send({ event: "custom", samplerPlay: slot });
  }
  function _padLabel(filename) {
    const base = String(filename || "").replace(/\.(wav|mp3)$/i, "").trim();
    if (!base) return "?";
    return base.length > SAMPLER_PAD_LABEL_LEN ? base.slice(0, SAMPLER_PAD_LABEL_LEN) : base;
  }
  function _rebuildList(names) {
    const ctx = getContext();
    const list = ctx.samplerListEl;
    const empty = ctx.samplerEmptyEl;
    if (!list || !empty) return;
    list.innerHTML = "";
    ctx.samplerButtons = [];
    ctx.samplerHighlight = -1;
    if (!names.length) {
      empty.style.display = "";
      list.style.display = "none";
      return;
    }
    empty.style.display = "none";
    list.style.display = "";
    names.forEach((name, i) => {
      const btn = el("button", { className: "sampler-pad", type: "button" });
      btn.title = name;
      btn.textContent = _padLabel(name);
      btn.addEventListener("click", () => _sendPlay(i));
      list.appendChild(btn);
      ctx.samplerButtons.push(btn);
    });
  }
  function buildSamplerCard() {
    const card = el("div", { className: "card live-tile" });
    card.dataset.tile = "sampler";
    const hdr = el("div", { className: "card-header-row" });
    hdr.appendChild(cardTitle("Sampler"));
    hdr.appendChild(el("span", { className: "card-meta", textContent: "Siren bus" }));
    card.appendChild(hdr);
    const body = el("div", { id: "sampler-body" });
    const empty = el("div", { id: "sampler-empty", className: "sampler-empty" });
    empty.textContent = EMPTY_MSG;
    body.appendChild(empty);
    const list = el("div", { id: "sampler-grid", className: "sampler-grid" });
    list.style.display = "none";
    body.appendChild(list);
    card.appendChild(body);
    const ctx = getContext();
    ctx.samplerEmptyEl = empty;
    ctx.samplerListEl = list;
    ctx.samplerButtons = [];
    ctx.samplerHighlight = -1;
    ctx.samplerNamesBuilt = false;
    if (ctx.samplerNames && ctx.samplerNames.length) {
      _rebuildList(ctx.samplerNames);
      ctx.samplerNamesBuilt = true;
    } else if (ctx.samplerState && (ctx.samplerState[0] < 0.5 || Math.round(ctx.samplerState[1] || 0) === 0)) {
      empty.style.display = "";
    }
    return card;
  }
  function updateSampler() {
    const ctx = getContext();
    if (!ctx.samplerListEl) return;
    if (!ctx.samplerStateLive) {
      if (ctx.samplerEmptyEl) {
        ctx.samplerEmptyEl.textContent = WAIT_MSG;
        ctx.samplerEmptyEl.style.display = "";
      }
      if (ctx.samplerListEl) ctx.samplerListEl.style.display = "none";
      return;
    }
    const st = ctx.samplerState;
    const folderOk = st[0] > 0.5;
    const count = Math.max(0, Math.round(st[1] || 0));
    if (!folderOk) {
      if (ctx.samplerEmptyEl) {
        ctx.samplerEmptyEl.textContent = EMPTY_MSG;
        ctx.samplerEmptyEl.style.display = "";
      }
      if (ctx.samplerListEl) ctx.samplerListEl.style.display = "none";
      ctx.samplerButtons = [];
      return;
    }
    if (count === 0) {
      if (ctx.samplerEmptyEl) {
        ctx.samplerEmptyEl.textContent = NONE_MSG;
        ctx.samplerEmptyEl.style.display = "";
      }
      if (ctx.samplerListEl) ctx.samplerListEl.style.display = "none";
      ctx.samplerButtons = [];
      return;
    }
    if (!ctx.samplerNamesBuilt && ctx.samplerNamesBuf) {
      ctx.samplerNames = decodeSampleNames(ctx.samplerNamesBuf, count);
      _rebuildList(ctx.samplerNames);
      ctx.samplerNamesBuilt = true;
    } else if (!ctx.samplerNamesBuilt) {
      if (!ctx.samplerButtons || ctx.samplerButtons.length !== count) {
        const placeholders = [];
        for (let i = 0; i < count; ++i) placeholders.push(`Sample ${i + 1}`);
        _rebuildList(placeholders);
      }
    }
    const playingSlot = Math.round(st[2]);
    const isPlaying = st[3] > 0.5;
    const highlight = isPlaying ? playingSlot : -1;
    if (ctx.samplerHighlight === highlight) return;
    ctx.samplerHighlight = highlight;
    (ctx.samplerButtons || []).forEach((btn, i) => {
      btn.classList.toggle("playing", i === highlight);
    });
  }

  // gui/dom/live.js
  var _micRows = [null, null, null, null];
  var _hpfDebounceTimers = [null, null, null, null];
  var _micSyncHoldUntil = [0, 0, 0, 0];
  var _hpfSyncHoldUntil = [0, 0, 0, 0];
  var HPF_DEBOUNCE_MS = 150;
  var MIC_SYNC_HOLD_MS = 2500;
  var _liveBoard = null;
  var _layoutPopup = null;
  var _layoutPanel = null;
  var _layoutList = null;
  var _layoutGearBtn = null;
  var _layoutEscBound = null;
  function _holdMicSync(idx, kind) {
    const until = Date.now() + MIC_SYNC_HOLD_MS;
    if (kind === "mic" || kind === "both") _micSyncHoldUntil[idx] = until;
    if (kind === "hpf" || kind === "both") _hpfSyncHoldUntil[idx] = until;
  }
  function _sendMicControl(payload) {
    if (!belaControlReady()) return;
    Bela.control.send(payload);
  }
  function buildSirenCard() {
    const sirenCard = el("div", { className: "card live-tile" });
    sirenCard.dataset.tile = "siren";
    sirenCard.appendChild(cardTitle("Siren"));
    const sirenBody = el("div", { id: "siren-body" });
    const hero = el("div", { id: "siren-hero" });
    hero.innerHTML = `
        <div id="siren-hero-top">
            <div id="siren-name">\u2014</div>
            <div id="siren-gate">
                <span id="siren-gate-dot"></span>
                <span class="gate-lbl">Gate</span>
            </div>
        </div>
        <div id="siren-mod-row">
            <span class="siren-mod-label">Mod</span>
            <div id="siren-mod-track"><div id="siren-mod-fill"></div></div>
            <span id="siren-mod-lbl">0%</span>
        </div>
    `;
    sirenBody.appendChild(hero);
    const presetsDiv = el("div", { id: "siren-presets" });
    getContext().sirenPresetPills = [];
    SIREN_PRESETS.forEach((name) => {
      const pill = el("div", { className: "spreset" });
      pill.textContent = name;
      pill.title = name;
      presetsDiv.appendChild(pill);
      getContext().sirenPresetPills.push(pill);
    });
    sirenBody.appendChild(presetsDiv);
    sirenCard.appendChild(sirenBody);
    getContext().sirenNameEl = hero.querySelector("#siren-name");
    getContext().sirenGateEl = hero.querySelector("#siren-gate-dot");
    getContext().sirenModFill = hero.querySelector("#siren-mod-fill");
    getContext().sirenModLbl = hero.querySelector("#siren-mod-lbl");
    return sirenCard;
  }
  function buildMicInputsCard() {
    const card = el("div", {
      className: "card live-tile",
      id: "mic-inputs-card"
    });
    card.dataset.tile = "mic";
    card.appendChild(cardTitle("Mic inputs"));
    const list = el("div", { className: "mic-live-list" });
    for (let i = 0; i < 4; ++i) {
      const auxN = i + 1;
      const row = el("div", { className: "mic-live-row" });
      const label = el("span", { className: "mic-live-label" });
      label.textContent = "AUX" + auxN;
      const micWrap = el("label", { className: "mic-toggle" });
      const micCb = el("input", { type: "checkbox", className: "mic-toggle-input" });
      micCb.title = "Bypass ParamEQ / filters / kills";
      const track = el("span", { className: "mic-toggle-track", "aria-hidden": "true" });
      track.appendChild(el("span", { className: "mic-toggle-thumb" }));
      const micLbl = el("span", { className: "mic-toggle-text" });
      micLbl.textContent = "Mic";
      micWrap.appendChild(micCb);
      micWrap.appendChild(track);
      micWrap.appendChild(micLbl);
      const hpfWrap = el("label", { className: "mic-live-hpf" });
      const hpfLbl = el("span");
      hpfLbl.textContent = "HPF";
      const hpfInp = el("input", {
        type: "number",
        min: String(MIC_HPF_HZ_MIN),
        max: String(MIC_HPF_HZ_MAX),
        step: "1",
        value: "0",
        "aria-label": `AUX${auxN} Mic HPF Hz`
      });
      hpfInp.title = "Mic dry HPF Hz (0 = off)";
      const hpfUnit = el("span", { className: "mic-live-hpf-unit" });
      hpfUnit.textContent = "Hz";
      hpfWrap.appendChild(hpfLbl);
      hpfWrap.appendChild(hpfInp);
      hpfWrap.appendChild(hpfUnit);
      micCb.addEventListener("change", () => {
        _holdMicSync(i, "mic");
        _sendMicControl({ event: "custom", auxMic: auxN, mic: !!micCb.checked });
      });
      const sendHpf = () => {
        let hz = parseFloat(hpfInp.value);
        if (isNaN(hz) || hz < 0) hz = 0;
        hz = Math.min(MIC_HPF_HZ_MAX, Math.max(MIC_HPF_HZ_MIN, Math.round(hz)));
        hpfInp.value = String(hz);
        _holdMicSync(i, "hpf");
        _sendMicControl({ event: "custom", auxHpf: auxN, hpf: hz });
      };
      hpfInp.addEventListener("change", sendHpf);
      hpfInp.addEventListener("input", () => {
        if (_hpfDebounceTimers[i]) clearTimeout(_hpfDebounceTimers[i]);
        _hpfDebounceTimers[i] = setTimeout(sendHpf, HPF_DEBOUNCE_MS);
      });
      row.appendChild(label);
      row.appendChild(micWrap);
      row.appendChild(hpfWrap);
      list.appendChild(row);
      _micRows[i] = {
        micCb,
        hpfInp,
        setMic(on) {
          if (micCb.checked === !!on) return;
          micCb.checked = !!on;
        },
        setHpf(hz) {
          const n = Math.round(hz);
          if (String(hpfInp.value) === String(n)) return;
          if (document.activeElement === hpfInp) return;
          hpfInp.value = String(n);
        }
      };
    }
    card.appendChild(list);
    return card;
  }
  function buildMetersTile() {
    const wrap = buildMetersSection();
    wrap.classList.add("live-tile");
    wrap.dataset.tile = "meters";
    return wrap;
  }
  function _buildLayoutRow(prefs, tileId, index) {
    const tile = LIVE_TILES.find((t) => t.id === tileId);
    if (!tile) return null;
    const row = el("div", { className: "live-layout-row" });
    const left = el("label", { className: "live-layout-check" });
    const cb = el("input", { type: "checkbox" });
    cb.checked = isLiveTileOn(prefs, tile.id);
    cb.addEventListener("change", () => {
      const p = getContext().liveLayoutPrefs;
      p.enabled[tile.id] = cb.checked;
      saveLiveLayout(p);
      renderLiveBoard();
    });
    const lbl = el("span");
    lbl.textContent = tile.label;
    left.appendChild(cb);
    left.appendChild(lbl);
    const moves = el("div", { className: "live-layout-moves" });
    const up = el("button", {
      type: "button",
      className: "live-layout-move",
      title: "Move up",
      "aria-label": "Move up"
    });
    up.textContent = "\u25B2";
    up.disabled = index === 0;
    up.addEventListener("click", () => {
      const p = getContext().liveLayoutPrefs;
      if (!moveLiveTile(p, tile.id, -1)) return;
      saveLiveLayout(p);
      rebuildLayoutPanelRows();
      renderLiveBoard();
    });
    const down = el("button", {
      type: "button",
      className: "live-layout-move",
      title: "Move down",
      "aria-label": "Move down"
    });
    down.textContent = "\u25BC";
    down.disabled = index >= prefs.order.length - 1;
    down.addEventListener("click", () => {
      const p = getContext().liveLayoutPrefs;
      if (!moveLiveTile(p, tile.id, 1)) return;
      saveLiveLayout(p);
      rebuildLayoutPanelRows();
      renderLiveBoard();
    });
    moves.appendChild(up);
    moves.appendChild(down);
    row.appendChild(left);
    row.appendChild(moves);
    return row;
  }
  function rebuildLayoutPanelRows() {
    if (!_layoutList) return;
    const prefs = getContext().liveLayoutPrefs;
    _layoutList.innerHTML = "";
    prefs.order.forEach((id, i) => {
      const row = _buildLayoutRow(prefs, id, i);
      if (row) _layoutList.appendChild(row);
    });
  }
  function _positionLayoutPopup() {
    if (!_layoutPanel || !_layoutGearBtn) return;
    const r = _layoutGearBtn.getBoundingClientRect();
    const gap = 8;
    const width = Math.min(300, window.innerWidth - 16);
    let left = r.right - width;
    left = Math.max(8, Math.min(left, window.innerWidth - width - 8));
    _layoutPanel.style.top = Math.round(r.bottom + gap) + "px";
    _layoutPanel.style.left = Math.round(left) + "px";
    _layoutPanel.style.width = width + "px";
  }
  function buildLayoutPopup() {
    const popup = el("div", {
      id: "live-layout-popup",
      hidden: true
    });
    const backdrop = el("div", { className: "live-layout-backdrop" });
    backdrop.addEventListener("click", () => setLiveLayoutPanelOpen(false));
    const panel = el("div", {
      className: "live-layout-panel",
      role: "dialog",
      "aria-modal": "true",
      "aria-label": "Live layout",
      tabIndex: -1
    });
    const title = el("div", { className: "live-layout-title" });
    title.textContent = "Live layout";
    panel.appendChild(title);
    const hint = el("p", { className: "live-layout-hint" });
    hint.textContent = "Visible tiles";
    panel.appendChild(hint);
    _layoutList = el("div", { className: "live-layout-list" });
    panel.appendChild(_layoutList);
    rebuildLayoutPanelRows();
    popup.appendChild(backdrop);
    popup.appendChild(panel);
    _layoutPanel = panel;
    return popup;
  }
  function setLiveLayoutPanelOpen(open) {
    if (!_layoutPopup) return;
    const wasOpen = !_layoutPopup.hasAttribute("hidden");
    if (open) {
      rebuildLayoutPanelRows();
      _layoutPopup.removeAttribute("hidden");
      _positionLayoutPopup();
      if (!_layoutEscBound) {
        _layoutEscBound = (e) => {
          if (e.key === "Escape") {
            setLiveLayoutPanelOpen(false);
          } else if (e.key === "Tab" && _layoutPanel) {
            const focusables = _layoutPanel.querySelectorAll(
              "input:not(:disabled), button:not(:disabled)"
            );
            if (!focusables.length) return;
            const first = focusables[0];
            const last = focusables[focusables.length - 1];
            if (e.shiftKey && document.activeElement === first) {
              e.preventDefault();
              last.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
              e.preventDefault();
              first.focus();
            }
          }
        };
        document.addEventListener("keydown", _layoutEscBound);
      }
      window.addEventListener("resize", _positionLayoutPopup);
      const firstFocus = _layoutPanel && _layoutPanel.querySelector("input, button");
      if (firstFocus) firstFocus.focus();
    } else {
      _layoutPopup.setAttribute("hidden", "");
      if (_layoutEscBound) {
        document.removeEventListener("keydown", _layoutEscBound);
        _layoutEscBound = null;
      }
      window.removeEventListener("resize", _positionLayoutPopup);
      if (wasOpen && _layoutGearBtn) _layoutGearBtn.focus();
    }
    if (_layoutGearBtn) {
      _layoutGearBtn.classList.toggle("active", open);
      _layoutGearBtn.setAttribute("aria-expanded", open ? "true" : "false");
    }
  }
  function toggleLiveLayoutPanel() {
    if (!_layoutPopup) return false;
    const open = _layoutPopup.hasAttribute("hidden");
    setLiveLayoutPanelOpen(open);
    return open;
  }
  function setLiveLayoutGearButton(btn) {
    _layoutGearBtn = btn;
  }
  function _appendTile(board, id, prefs, pairedDone) {
    if (id === "siren" || id === "mic") {
      if (pairedDone.done) return;
      const showSiren = isLiveTileOn(prefs, "siren");
      const showMic = isLiveTileOn(prefs, "mic");
      if (!showSiren && !showMic) return;
      if (showSiren && showMic) {
        pairedDone.done = true;
        const grid2 = el("div", { id: "live-grid" });
        const firstPair = prefs.order.indexOf("siren") <= prefs.order.indexOf("mic") ? "siren" : "mic";
        if (firstPair === "siren") {
          grid2.appendChild(buildSirenCard());
          grid2.appendChild(buildMicInputsCard());
        } else {
          grid2.appendChild(buildMicInputsCard());
          grid2.appendChild(buildSirenCard());
        }
        board.appendChild(grid2);
        return;
      }
      pairedDone.done = true;
      const grid = el("div", { id: "live-grid", className: "live-grid-single" });
      if (showSiren) grid.appendChild(buildSirenCard());
      if (showMic) grid.appendChild(buildMicInputsCard());
      board.appendChild(grid);
      return;
    }
    if (id === "sampler") {
      board.appendChild(buildSamplerCard());
      return;
    }
    if (id === "meters") {
      board.appendChild(buildMetersTile());
      return;
    }
    if (id === "switches") {
      board.appendChild(buildSwitchesCard());
      return;
    }
    if (id === "console") {
      board.appendChild(buildConsoleCard("live-console-list"));
      return;
    }
    if (id === "masterEq") {
      board.appendChild(buildMasterEqCard({
        canvasId: "live-master-eq-canvas"
      }));
    }
  }
  function _scheduleMasterEqDraw() {
    if (!isLiveTileOn(getContext().liveLayoutPrefs, "masterEq")) return;
    requestAnimationFrame(() => {
      if (!isLiveTileOn(getContext().liveLayoutPrefs, "masterEq")) return;
      drawMasterEqCurve();
    });
  }
  function renderLiveBoard() {
    if (!_liveBoard) return;
    const prefs = getContext().liveLayoutPrefs;
    const hadMeters = (getContext().meterVu || []).some(Boolean);
    _liveBoard.innerHTML = "";
    if (getContext().masterEqTargets) {
      getContext().masterEqTargets = getContext().masterEqTargets.filter(
        (t) => t.canvas && t.canvas.isConnected
      );
    }
    getContext().consoleLists = (getContext().consoleLists || []).filter((l) => l.isConnected);
    const pairedDone = { done: false };
    orderedLiveTiles(prefs).forEach((id) => {
      _appendTile(_liveBoard, id, prefs, pairedDone);
    });
    const hasMeters = isLiveTileOn(prefs, "meters");
    if (getContext().currentTab === TAB_LIVE) {
      if (hasMeters) {
        getContext().meterVu.forEach((vu) => {
          if (vu) vu.resize();
        });
        startMeterAnim();
      } else if (hadMeters) {
        stopMeterAnim();
        getContext().meterVu = [];
      }
    }
    _scheduleMasterEqDraw();
  }
  function buildLivePane() {
    const pane = el("div", { id: "pane-live", className: "tab-pane active" });
    const prefs = loadLiveLayout();
    getContext().liveLayoutPrefs = prefs;
    if (_layoutPopup && _layoutPopup.parentNode)
      _layoutPopup.parentNode.removeChild(_layoutPopup);
    _layoutPopup = buildLayoutPopup();
    document.body.appendChild(_layoutPopup);
    _liveBoard = el("div", { id: "live-board" });
    pane.appendChild(_liveBoard);
    renderLiveBoard();
    return pane;
  }
  function syncMicInputs(meta) {
    if (!meta || meta.length <= CONFIG_META.HPF_AUX4) return;
    const M = CONFIG_META;
    const now = Date.now();
    const micKeys = [M.MIC_AUX1, M.MIC_AUX2, M.MIC_AUX3, M.MIC_AUX4];
    const hpfKeys = [M.HPF_AUX1, M.HPF_AUX2, M.HPF_AUX3, M.HPF_AUX4];
    for (let i = 0; i < 4; ++i) {
      const row = _micRows[i];
      if (!row) continue;
      const remoteMic = meta[micKeys[i]] > 0.5;
      const remoteHpf = meta[hpfKeys[i]] != null ? meta[hpfKeys[i]] : 0;
      if (now < _micSyncHoldUntil[i]) {
        if (row.micCb.checked === remoteMic)
          _micSyncHoldUntil[i] = 0;
      } else {
        row.setMic(remoteMic);
      }
      if (now < _hpfSyncHoldUntil[i]) {
        if (Math.round(Number(row.hpfInp.value)) === Math.round(remoteHpf))
          _hpfSyncHoldUntil[i] = 0;
      } else {
        row.setHpf(remoteHpf);
      }
    }
  }
  function updateSiren() {
    const ctx = getContext();
    if (!ctx.sirenPresetPills || !ctx.sirenPresetPills.length)
      return;
    const idx = Math.max(0, Math.min(Math.round(ctx.sirenState[0]), SIREN_PRESETS.length - 1));
    const gate = ctx.sirenState[1] > 0.5;
    const mod = ctx.sirenState[2];
    if (idx !== ctx._sirenLastIdx || gate !== ctx._sirenLastGate) {
      ctx._sirenLastIdx = idx;
      ctx._sirenLastGate = gate;
      ctx.sirenPresetPills.forEach((pill, i) => {
        const isActive = i === idx;
        pill.classList.toggle("active", isActive);
        pill.classList.toggle("gate", isActive && gate);
      });
      if (ctx.sirenNameEl) ctx.sirenNameEl.textContent = SIREN_PRESETS[idx];
    }
    if (gate !== ctx._sirenLastGateDot) {
      ctx._sirenLastGateDot = gate;
      if (ctx.sirenGateEl) ctx.sirenGateEl.className = gate ? "on" : "";
    }
    const modPct = (mod * 100).toFixed(1) + "%";
    if (modPct !== ctx._sirenLastModPct) {
      ctx._sirenLastModPct = modPct;
      if (ctx.sirenModFill) ctx.sirenModFill.style.width = modPct;
      if (ctx.sirenModLbl) ctx.sirenModLbl.textContent = Math.round(mod * 100) + "%";
    }
  }

  // gui/dom/devControl.js
  var _lastSendTs = new Float64Array(POT_NAMES.length);
  var _pendingRaf = new Int32Array(POT_NAMES.length).fill(-1);
  var _pendingVals = new Float32Array(POT_NAMES.length).fill(-1);
  var MIN_SEND_INTERVAL_MS = 30;
  var _devModeHoldUntil = 0;
  var DEV_MODE_HOLD_MS = 2500;
  var _activeInteractingPot = -1;
  var _potSliders = new Array(POT_NAMES.length);
  var _potValueLabels = new Array(POT_NAMES.length);
  var _switchButtons = new Array(SWITCH_NAMES.length);
  var _devModeToggleBtn = null;
  var _devModePillEl = null;
  var _devModeBannerEl = null;
  var _devControlsContainerEl = null;
  function sendCustomControl(payload) {
    if (!belaControlReady()) return;
    Bela.control.send(payload);
  }
  function sendVirtualPot(potIdx, val, forceImmediate = false) {
    if (potIdx < 0 || potIdx >= POT_NAMES.length) return;
    const now = performance.now();
    _pendingVals[potIdx] = val;
    if (forceImmediate || now - _lastSendTs[potIdx] >= MIN_SEND_INTERVAL_MS) {
      _lastSendTs[potIdx] = now;
      if (_pendingRaf[potIdx] !== -1) {
        cancelAnimationFrame(_pendingRaf[potIdx]);
        _pendingRaf[potIdx] = -1;
      }
      sendCustomControl({
        event: "custom",
        uiPot: potIdx,
        val: Number(val.toFixed(4))
      });
      return;
    }
    if (_pendingRaf[potIdx] === -1) {
      _pendingRaf[potIdx] = requestAnimationFrame(() => {
        _pendingRaf[potIdx] = -1;
        _lastSendTs[potIdx] = performance.now();
        sendCustomControl({
          event: "custom",
          uiPot: potIdx,
          val: Number(_pendingVals[potIdx].toFixed(4))
        });
      });
    }
  }
  function sendVirtualSwitch(swIdx, active) {
    if (swIdx < 0 || swIdx >= SWITCH_NAMES.length) return;
    sendCustomControl({
      event: "custom",
      uiSwitch: swIdx,
      val: Boolean(active)
    });
  }
  function sendUiDevMode(enabled) {
    const ctx = getContext();
    ctx.uiDevMode = Boolean(enabled);
    _devModeHoldUntil = Date.now() + DEV_MODE_HOLD_MS;
    updateDevModeVisuals(ctx.uiDevMode);
    if (ctx.uiDevMode) {
      for (let i = 0; i < POT_NAMES.length; i++) {
        const defVal = getPotDevDefault(POT_NAMES[i]);
        if (_potSliders[i]) _potSliders[i].value = defVal.toString();
        if (_potValueLabels[i]) _potValueLabels[i].textContent = formatPotValue(POT_NAMES[i], defVal);
      }
      for (let i = 0; i < SWITCH_NAMES.length; i++) {
        if (_switchButtons[i]) {
          _switchButtons[i].classList.remove("active", "firing");
          _switchButtons[i].setAttribute("aria-pressed", "false");
        }
      }
    }
    sendCustomControl({
      event: "custom",
      uiDevMode: ctx.uiDevMode
    });
  }
  function sendVirtualReset() {
    sendCustomControl({
      event: "custom",
      uiReset: true
    });
  }
  function updateDevModeVisuals(active) {
    const ctx = getContext();
    ctx.uiDevMode = active;
    if (_devModeToggleBtn) {
      _devModeToggleBtn.classList.toggle("active", active);
      _devModeToggleBtn.textContent = active ? "Virtual Active" : "Enable Virtual";
      _devModeToggleBtn.setAttribute("aria-pressed", active ? "true" : "false");
    }
    if (_devModePillEl) {
      _devModePillEl.textContent = active ? "Virtual \xB7 ADC paused" : "Hardware";
    }
    if (_devModeBannerEl) {
      _devModeBannerEl.classList.toggle("dev-active", active);
    }
    if (_devControlsContainerEl) {
      _devControlsContainerEl.classList.toggle("disabled-controls", !active);
    }
    const headerDevBadge = document.getElementById("dev-badge");
    if (headerDevBadge) {
      headerDevBadge.classList.toggle("visible", active);
    }
  }
  function syncUiDevMode(metaBuf) {
    if (!metaBuf || metaBuf.length <= CONFIG_META.UI_DEV_MODE) return;
    const isDev = metaBuf[CONFIG_META.UI_DEV_MODE] > 0.5;
    const ctx = getContext();
    if (Date.now() < _devModeHoldUntil) {
      if (ctx.uiDevMode === isDev) _devModeHoldUntil = 0;
      return;
    }
    if (ctx.uiDevMode !== isDev) {
      ctx.uiDevMode = isDev;
      updateDevModeVisuals(isDev);
    }
  }
  function formatPotValue(name, val) {
    if (/^AUX\d_EQ_(LOW|MID|HIGH)$/.test(name) || /^MASTER_EQ_.*_GAIN$/.test(name) || /^BTRIM_/.test(name)) {
      const db = (val - 0.5) * 12;
      return (db >= 0 ? "+" : "") + db.toFixed(1) + " dB";
    }
    if (name.startsWith("GEQ_")) {
      const db = (val - 0.5) * 24;
      return (db >= 0 ? "+" : "") + db.toFixed(1) + " dB";
    }
    if (name === "MASTER_HPF_FREQ") {
      const hz = 20 + val * 1980;
      return val < 0.015 ? "Off" : Math.round(hz) + " Hz";
    }
    if (name === "MASTER_LPF_FREQ") {
      const hz = 200 + val * 19800;
      return val > 0.985 ? "Off" : hz >= 1e3 ? (hz / 1e3).toFixed(1) + " kHz" : Math.round(hz) + " Hz";
    }
    if (name === "MASTER_HPF_RES" || name === "MASTER_LPF_RES") {
      const q = 0.7 + val * (4.5 - 0.7);
      return "Q " + q.toFixed(2);
    }
    if (name === "MASTER_EQ_SUB_FREQ") return Math.round(20 + val * 60) + " Hz";
    if (name === "MASTER_EQ_KICK_FREQ") return Math.round(80 + val * 120) + " Hz";
    if (name === "MASTER_EQ_MID_FREQ") return Math.round(200 + val * 1e3) + " Hz";
    if (name === "MASTER_EQ_TOP_FREQ") {
      const hz = 1200 + val * 14800;
      return hz >= 1e3 ? (hz / 1e3).toFixed(1) + " kHz" : Math.round(hz) + " Hz";
    }
    if (name === "SIREN_TYPE") {
      const idx = Math.min(5, Math.floor(val * 6));
      return SIREN_PRESETS[idx] || "Preset " + idx;
    }
    return Math.round(val * 100) + "%";
  }
  function createPotControl(potIdx, label, ariaPrefix) {
    const name = POT_NAMES[potIdx];
    const isCentered = isPotCentered(name);
    const defVal = getPotDevDefault(name);
    const item = el("div", { className: "dev-pot-item" });
    const topRow = el("div", { className: "dev-pot-top" });
    const lbl = el("span", { className: "dev-pot-label" });
    lbl.textContent = label || name;
    const valLbl = el("span", { className: "dev-pot-val" });
    valLbl.textContent = formatPotValue(name, defVal);
    topRow.appendChild(lbl);
    topRow.appendChild(valLbl);
    item.appendChild(topRow);
    const slider = el("input", {
      type: "range",
      min: "0",
      max: "1",
      step: "0.005",
      value: defVal.toString(),
      className: "dev-pot-slider" + (isCentered ? " centered" : ""),
      "aria-label": ariaPrefix ? `${ariaPrefix} ${label}` : label || name
    });
    slider.addEventListener("pointerdown", () => {
      _activeInteractingPot = potIdx;
    });
    const endDrag = () => {
      if (_activeInteractingPot === potIdx) {
        _activeInteractingPot = -1;
        sendVirtualPot(potIdx, parseFloat(slider.value), true);
      }
    };
    slider.addEventListener("pointerup", endDrag);
    slider.addEventListener("pointercancel", endDrag);
    slider.addEventListener("input", () => {
      const v = parseFloat(slider.value);
      valLbl.textContent = formatPotValue(name, v);
      sendVirtualPot(potIdx, v, false);
    });
    slider.addEventListener("dblclick", () => {
      const dVal = getPotDevDefault(name);
      slider.value = dVal.toString();
      valLbl.textContent = formatPotValue(name, dVal);
      sendVirtualPot(potIdx, dVal, true);
    });
    item.appendChild(slider);
    _potSliders[potIdx] = slider;
    _potValueLabels[potIdx] = valLbl;
    return item;
  }
  function buildMasterSection() {
    const card = el("div", { className: "card dev-section" });
    card.appendChild(cardTitle("Master"));
    const killSection = el("div", { className: "dev-kill-section" });
    killSection.appendChild(el("div", { className: "dev-sub-heading", textContent: "Kills" }));
    const killGrid = el("div", { className: "dev-kill-grid" });
    const killDef = [
      { idx: 0, label: "SUB", sub: "<80Hz", color: "sub" },
      { idx: 1, label: "KICK", sub: "80\u2013200", color: "kick" },
      { idx: 2, label: "MID", sub: "200\u20131.2k", color: "mid" },
      { idx: 3, label: "TOP", sub: ">1.2k", color: "top" }
    ];
    killDef.forEach(({ idx, label, sub, color }) => {
      const btn = el("button", {
        type: "button",
        className: "dev-kill-btn " + color,
        "aria-pressed": "false"
      });
      btn.appendChild(el("span", { textContent: label }));
      btn.appendChild(el("span", { className: "dev-kill-sub", textContent: sub }));
      btn.addEventListener("click", () => {
        const ctx = getContext();
        const curState = ctx.switchStates && ctx.switchStates[idx] > 0.5;
        const newState = !curState;
        btn.classList.toggle("active", newState);
        btn.setAttribute("aria-pressed", newState ? "true" : "false");
        sendVirtualSwitch(idx, newState);
      });
      _switchButtons[idx] = btn;
      killGrid.appendChild(btn);
    });
    killSection.appendChild(killGrid);
    card.appendChild(killSection);
    const masterGrid = el("div", { className: "dev-grid-2col" });
    const masterCol = el("div", { className: "dev-sub-panel" });
    masterCol.appendChild(el("div", { className: "dev-sub-heading", textContent: "Output" }));
    masterCol.appendChild(createPotControl(24, "Master Gain", "Master"));
    masterGrid.appendChild(masterCol);
    const trimCol = el("div", { className: "dev-sub-panel" });
    trimCol.appendChild(el("div", { className: "dev-sub-heading", textContent: "Band Trim" }));
    const trimPots = el("div", { className: "dev-pot-grid-2" });
    trimPots.appendChild(createPotControl(37, "Sub", "Band Trim"));
    trimPots.appendChild(createPotControl(38, "Kick", "Band Trim"));
    trimPots.appendChild(createPotControl(39, "Mid", "Band Trim"));
    trimPots.appendChild(createPotControl(40, "Top", "Band Trim"));
    trimCol.appendChild(trimPots);
    masterGrid.appendChild(trimCol);
    card.appendChild(masterGrid);
    const filterSection = el("div", { className: "dev-sub-panel" });
    filterSection.style.marginTop = "12px";
    filterSection.appendChild(el("div", { className: "dev-sub-heading", textContent: "Filters" }));
    const filterGrid = el("div", { className: "dev-pot-grid-2" });
    filterGrid.appendChild(createPotControl(33, "HPF Freq", "Master"));
    filterGrid.appendChild(createPotControl(34, "HPF Res", "Master"));
    filterGrid.appendChild(createPotControl(35, "LPF Freq", "Master"));
    filterGrid.appendChild(createPotControl(36, "LPF Res", "Master"));
    filterSection.appendChild(filterGrid);
    card.appendChild(filterSection);
    return card;
  }
  function buildChannelStripsSection() {
    const card = el("div", { className: "card dev-section" });
    card.appendChild(cardTitle("Channels"));
    const grid = el("div", { className: "dev-channels-grid" });
    const auxConfigs = [
      { ch: 1, base: 0 },
      { ch: 2, base: 6 },
      { ch: 3, base: 12 },
      { ch: 4, base: 18 }
    ];
    auxConfigs.forEach(({ ch, base }) => {
      const col = el("div", { className: "dev-channel-col" });
      const hdr = el("div", { className: "dev-channel-hdr", textContent: "AUX " + ch });
      col.appendChild(hdr);
      const prefix = "AUX " + ch;
      col.appendChild(createPotControl(base + 0, "Gain", prefix));
      const eqBox = el("div", { className: "dev-eq-box" });
      if (ch === 1) {
        eqBox.appendChild(createPotControl(base + 3, "High", prefix));
        eqBox.appendChild(createPotControl(base + 1, "Mid", prefix));
        eqBox.appendChild(createPotControl(base + 2, "Low", prefix));
      } else if (ch === 2) {
        eqBox.appendChild(createPotControl(base + 2, "High", prefix));
        eqBox.appendChild(createPotControl(base + 1, "Mid", prefix));
        eqBox.appendChild(createPotControl(base + 3, "Low", prefix));
      } else {
        eqBox.appendChild(createPotControl(base + 3, "High", prefix));
        eqBox.appendChild(createPotControl(base + 2, "Mid", prefix));
        eqBox.appendChild(createPotControl(base + 1, "Low", prefix));
      }
      col.appendChild(eqBox);
      col.appendChild(createPotControl(base + 4, "FX1", prefix));
      col.appendChild(createPotControl(base + 5, "FX2", prefix));
      grid.appendChild(col);
    });
    card.appendChild(grid);
    return card;
  }
  function buildMasterEqSection() {
    const card = el("div", { className: "card dev-section" });
    card.appendChild(cardTitle("Master EQ"));
    const peqBox = el("div", { className: "dev-sub-panel" });
    peqBox.appendChild(el("div", { className: "dev-sub-heading", textContent: "Parametric" }));
    const peqGrid = el("div", { className: "dev-channels-grid" });
    const peqBands = [
      { label: "SUB", fIdx: 25, gIdx: 26 },
      { label: "KICK", fIdx: 27, gIdx: 28 },
      { label: "MID", fIdx: 29, gIdx: 30 },
      { label: "TOP", fIdx: 31, gIdx: 32 }
    ];
    peqBands.forEach(({ label, fIdx, gIdx }) => {
      const bCol = el("div", { className: "dev-channel-col" });
      bCol.appendChild(el("div", { className: "dev-channel-hdr", textContent: label }));
      bCol.appendChild(createPotControl(fIdx, "Freq", label));
      bCol.appendChild(createPotControl(gIdx, "Gain", label));
      peqGrid.appendChild(bCol);
    });
    peqBox.appendChild(peqGrid);
    card.appendChild(peqBox);
    const geqBox = el("div", { className: "dev-sub-panel" });
    geqBox.style.marginTop = "12px";
    const geqHdrRow = el("div", { className: "dev-row-between" });
    geqHdrRow.appendChild(el("div", { className: "dev-sub-heading", textContent: "Graphic EQ" }));
    const flatBtn = el("button", {
      type: "button",
      className: "dev-small-btn",
      textContent: "Flat"
    });
    flatBtn.addEventListener("click", () => {
      for (let i = 46; i <= 57; i++) {
        if (_potSliders[i]) _potSliders[i].value = "0.5";
        if (_potValueLabels[i]) _potValueLabels[i].textContent = "0.0 dB";
        sendVirtualPot(i, 0.5, true);
      }
    });
    geqHdrRow.appendChild(flatBtn);
    geqBox.appendChild(geqHdrRow);
    const geqGrid = el("div", { className: "dev-geq-grid" });
    const geqLabels = ["40Hz", "60Hz", "80Hz", "100Hz", "125Hz", "250Hz", "500Hz", "1kHz", "2kHz", "4kHz", "8kHz", "16kHz"];
    for (let i = 0; i < 12; i++) {
      geqGrid.appendChild(createPotControl(46 + i, geqLabels[i], "GEQ"));
    }
    geqBox.appendChild(geqGrid);
    card.appendChild(geqBox);
    return card;
  }
  function buildFxAndSirenSection() {
    const card = el("div", { className: "card dev-section" });
    card.appendChild(cardTitle("FX & Siren"));
    const grid = el("div", { className: "dev-grid-2col" });
    const fxCol = el("div", { className: "dev-sub-panel" });
    fxCol.appendChild(el("div", { className: "dev-sub-heading", textContent: "FX Bus" }));
    const fx1Row = el("div", { className: "dev-fx-mode-row" });
    fx1Row.appendChild(el("span", { className: "dev-pot-label", textContent: "FX1 Filter" }));
    const fx1Mids = el("button", { type: "button", className: "dev-mode-btn", textContent: "Mids", "aria-pressed": "false" });
    const fx1Tops = el("button", { type: "button", className: "dev-mode-btn", textContent: "Tops", "aria-pressed": "false" });
    fx1Mids.addEventListener("click", () => {
      const next = fx1Mids.classList.toggle("active");
      fx1Mids.setAttribute("aria-pressed", next ? "true" : "false");
      sendVirtualSwitch(4, next);
    });
    fx1Tops.addEventListener("click", () => {
      const next = fx1Tops.classList.toggle("active");
      fx1Tops.setAttribute("aria-pressed", next ? "true" : "false");
      sendVirtualSwitch(5, next);
    });
    _switchButtons[4] = fx1Mids;
    _switchButtons[5] = fx1Tops;
    fx1Row.appendChild(fx1Mids);
    fx1Row.appendChild(fx1Tops);
    fxCol.appendChild(fx1Row);
    const fx2Row = el("div", { className: "dev-fx-mode-row" });
    fx2Row.appendChild(el("span", { className: "dev-pot-label", textContent: "FX2 Filter" }));
    const fx2Mids = el("button", { type: "button", className: "dev-mode-btn", textContent: "Mids", "aria-pressed": "false" });
    const fx2Tops = el("button", { type: "button", className: "dev-mode-btn", textContent: "Tops", "aria-pressed": "false" });
    fx2Mids.addEventListener("click", () => {
      const next = fx2Mids.classList.toggle("active");
      fx2Mids.setAttribute("aria-pressed", next ? "true" : "false");
      sendVirtualSwitch(7, next);
    });
    fx2Tops.addEventListener("click", () => {
      const next = fx2Tops.classList.toggle("active");
      fx2Tops.setAttribute("aria-pressed", next ? "true" : "false");
      sendVirtualSwitch(6, next);
    });
    _switchButtons[7] = fx2Mids;
    _switchButtons[6] = fx2Tops;
    fx2Row.appendChild(fx2Mids);
    fx2Row.appendChild(fx2Tops);
    fxCol.appendChild(fx2Row);
    fxCol.appendChild(createPotControl(58, "FX1 Return", "FX"));
    fxCol.appendChild(createPotControl(59, "FX2 Return", "FX"));
    grid.appendChild(fxCol);
    const sirenCol = el("div", { className: "dev-sub-panel" });
    sirenCol.appendChild(el("div", { className: "dev-sub-heading", textContent: "Dub Siren" }));
    sirenCol.appendChild(createPotControl(41, "Preset", "Siren"));
    sirenCol.appendChild(createPotControl(42, "Mod", "Siren"));
    sirenCol.appendChild(createPotControl(43, "Gain", "Siren"));
    sirenCol.appendChild(createPotControl(44, "FX1", "Siren"));
    sirenCol.appendChild(createPotControl(45, "FX2", "Siren"));
    const triggerBox = el("div", { className: "dev-siren-trigger-box" });
    const trigBtn = el("button", {
      type: "button",
      className: "dev-siren-trig-btn",
      textContent: "Trigger"
    });
    let trigActive = false;
    const setTrigger = (on) => {
      if (trigActive === on) return;
      trigActive = on;
      trigBtn.classList.toggle("firing", on);
      sendVirtualSwitch(8, on);
    };
    trigBtn.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      if (typeof trigBtn.setPointerCapture === "function") {
        try {
          trigBtn.setPointerCapture(e.pointerId);
        } catch (_) {
        }
      }
      setTrigger(true);
    });
    const endTrigger = () => setTrigger(false);
    trigBtn.addEventListener("pointerup", endTrigger);
    trigBtn.addEventListener("pointercancel", endTrigger);
    trigBtn.addEventListener("lostpointercapture", endTrigger);
    trigBtn.addEventListener("keydown", (e) => {
      if ((e.key === " " || e.key === "Enter") && !e.repeat) {
        e.preventDefault();
        setTrigger(true);
      }
    });
    trigBtn.addEventListener("keyup", (e) => {
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        setTrigger(false);
      }
    });
    trigBtn.addEventListener("blur", endTrigger);
    const latchBtn = el("button", {
      type: "button",
      className: "dev-siren-latch-btn",
      textContent: "Latch",
      "aria-pressed": "false"
    });
    latchBtn.addEventListener("click", () => {
      const isFiring = latchBtn.classList.toggle("active");
      latchBtn.setAttribute("aria-pressed", isFiring ? "true" : "false");
      trigBtn.classList.toggle("firing", isFiring);
      sendVirtualSwitch(8, isFiring);
    });
    _switchButtons[8] = latchBtn;
    triggerBox.appendChild(trigBtn);
    triggerBox.appendChild(latchBtn);
    sirenCol.appendChild(triggerBox);
    grid.appendChild(sirenCol);
    card.appendChild(grid);
    return card;
  }
  function buildDevControlPane() {
    const pane = el("div", {
      id: "pane-dev",
      className: "tab-pane"
    });
    const banner = el("div", { className: "card dev-banner", id: "dev-mode-banner" });
    _devModeBannerEl = banner;
    const bannerTop = el("div", { className: "dev-banner-top" });
    const titleDiv = el("div", { className: "dev-banner-title-box" });
    titleDiv.appendChild(el("h2", { className: "dev-banner-title", textContent: "Virtual Controls" }));
    _devModePillEl = el("span", { className: "dev-mode-pill", textContent: "Hardware" });
    titleDiv.appendChild(_devModePillEl);
    bannerTop.appendChild(titleDiv);
    const toggleBtn = el("button", {
      type: "button",
      id: "dev-mode-toggle-btn",
      className: "dev-toggle-btn",
      "aria-pressed": "false"
    });
    toggleBtn.addEventListener("click", () => {
      const ctx = getContext();
      sendUiDevMode(!ctx.uiDevMode);
    });
    _devModeToggleBtn = toggleBtn;
    bannerTop.appendChild(toggleBtn);
    banner.appendChild(bannerTop);
    const actionsRow = el("div", { className: "dev-actions-row" });
    const resetBtn = el("button", {
      type: "button",
      className: "dev-action-btn",
      textContent: "Reset"
    });
    resetBtn.addEventListener("click", () => {
      sendVirtualReset();
      for (let i = 0; i < POT_NAMES.length; i++) {
        const name = POT_NAMES[i];
        const defVal = getPotDevDefault(name);
        if (_potSliders[i]) _potSliders[i].value = defVal.toString();
        if (_potValueLabels[i]) _potValueLabels[i].textContent = formatPotValue(name, defVal);
      }
      for (let i = 0; i < SWITCH_NAMES.length; i++) {
        if (_switchButtons[i]) {
          _switchButtons[i].classList.remove("active", "firing");
          _switchButtons[i].setAttribute("aria-pressed", "false");
        }
      }
    });
    actionsRow.appendChild(resetBtn);
    const muteBtn = el("button", {
      type: "button",
      className: "dev-action-btn",
      textContent: "Mute Master"
    });
    muteBtn.addEventListener("click", () => {
      if (_potSliders[24]) _potSliders[24].value = "0";
      if (_potValueLabels[24]) _potValueLabels[24].textContent = "0%";
      sendVirtualPot(24, 0, true);
    });
    actionsRow.appendChild(muteBtn);
    const unkillBtn = el("button", {
      type: "button",
      className: "dev-action-btn",
      textContent: "Unkill All"
    });
    unkillBtn.addEventListener("click", () => {
      for (let i = 0; i < 4; i++) {
        if (_switchButtons[i]) {
          _switchButtons[i].classList.remove("active");
          _switchButtons[i].setAttribute("aria-pressed", "false");
        }
        sendVirtualSwitch(i, false);
      }
    });
    actionsRow.appendChild(unkillBtn);
    banner.appendChild(actionsRow);
    pane.appendChild(banner);
    const controlsContainer = el("div", { id: "dev-controls-container", className: "dev-controls-container" });
    _devControlsContainerEl = controlsContainer;
    controlsContainer.appendChild(buildMasterSection());
    controlsContainer.appendChild(buildChannelStripsSection());
    controlsContainer.appendChild(buildMasterEqSection());
    controlsContainer.appendChild(buildFxAndSirenSection());
    pane.appendChild(controlsContainer);
    updateDevModeVisuals(false);
    return pane;
  }
  function updateDevControlsLive() {
    const ctx = getContext();
    if (!ctx || !ctx.uiDevMode) return;
    if (ctx.potValues && ctx.potValues.length >= POT_NAMES.length) {
      for (let i = 0; i < POT_NAMES.length; i++) {
        if (i === _activeInteractingPot) continue;
        const val = ctx.potValues[i];
        const slider = _potSliders[i];
        const valLbl = _potValueLabels[i];
        if (slider && Math.abs(parseFloat(slider.value) - val) > 5e-3) {
          slider.value = val.toString();
          if (valLbl) valLbl.textContent = formatPotValue(POT_NAMES[i], val);
        }
      }
    }
    if (ctx.switchStates && ctx.switchStates.length >= SWITCH_NAMES.length) {
      for (let i = 0; i < SWITCH_NAMES.length; i++) {
        const btn = _switchButtons[i];
        if (!btn) continue;
        const isOn = ctx.switchStates[i] > 0.5;
        btn.classList.toggle("active", isOn);
        btn.setAttribute("aria-pressed", isOn ? "true" : "false");
      }
    }
  }

  // gui/dom/fx.js
  var ICON_SEND = ["M22 2L11 13", "M22 2l-7 20-4-9-9-4 20-7Z"];
  function sendBelaControl(payload) {
    if (typeof Bela !== "undefined" && Bela.control && typeof Bela.control.send === "function") {
      Bela.control.send(payload);
    }
  }
  function syncFxTriggerOutput(aux, send) {
    const ctx = getContext();
    if (!ctx.fxTriggers || !ctx.fxMomentaryTriggers || !ctx.fxLatchedTriggers) return;
    const mom = !!ctx.fxMomentaryTriggers[aux][send];
    const lat = !!ctx.fxLatchedTriggers[aux][send];
    const effective = mom || lat;
    (ctx.fxTriggerButtons || []).forEach((btn) => {
      if (parseInt(btn.dataset.aux, 10) === aux && parseInt(btn.dataset.send, 10) === send) {
        btn.classList.toggle("active", mom);
        btn.setAttribute("aria-pressed", mom ? "true" : "false");
      }
    });
    (ctx.fxLatchButtons || []).forEach((btn) => {
      if (parseInt(btn.dataset.aux, 10) === aux && parseInt(btn.dataset.send, 10) === send) {
        btn.classList.toggle("active", lat);
        btn.setAttribute("aria-pressed", lat ? "true" : "false");
      }
    });
    if (ctx.fxTriggers[aux][send] === effective) return;
    ctx.fxTriggers[aux][send] = effective;
    sendBelaControl({
      event: "custom",
      fxTrigger: { aux, send, active: effective, testTone: !!ctx.fxTestTone }
    });
  }
  function setMomentaryFxTrigger(aux, send, active) {
    const ctx = getContext();
    if (!ctx.fxMomentaryTriggers || ctx.fxMomentaryTriggers[aux][send] === active) return;
    ctx.fxMomentaryTriggers[aux][send] = active;
    syncFxTriggerOutput(aux, send);
  }
  function toggleLatchedFxTrigger(aux, send) {
    const ctx = getContext();
    if (!ctx.fxLatchedTriggers) return;
    ctx.fxLatchedTriggers[aux][send] = !ctx.fxLatchedTriggers[aux][send];
    syncFxTriggerOutput(aux, send);
  }
  function clearMomentaryFxTriggers() {
    const ctx = getContext();
    if (!ctx || !ctx.fxMomentaryTriggers) return;
    for (let a = 0; a < ctx.fxMomentaryTriggers.length; a++) {
      for (let s = 0; s < 2; s++) {
        if (ctx.fxMomentaryTriggers[a][s]) {
          ctx.fxMomentaryTriggers[a][s] = false;
          syncFxTriggerOutput(a, s);
        }
      }
    }
  }
  function clearAllFxTriggers() {
    const ctx = getContext();
    if (ctx) {
      [ctx.fxTriggers, ctx.fxMomentaryTriggers, ctx.fxLatchedTriggers].forEach((arr) => {
        if (!arr) return;
        for (let a = 0; a < arr.length; a++) {
          arr[a][0] = false;
          arr[a][1] = false;
        }
      });
      (ctx.fxTriggerButtons || []).forEach((btn) => {
        btn.classList.remove("active");
        btn.setAttribute("aria-pressed", "false");
      });
      (ctx.fxLatchButtons || []).forEach((btn) => {
        btn.classList.remove("active");
        btn.setAttribute("aria-pressed", "false");
      });
    }
    sendBelaControl({ event: "custom", fxTriggerClearAll: true });
  }
  var _windowBlurBound = false;
  function buildFxPane() {
    const pane = el("div", { className: "tab-pane", id: "tab-fx" });
    const container = el("div", { className: "fx-pane-container" });
    if (!_windowBlurBound && typeof window !== "undefined") {
      _windowBlurBound = true;
      window.addEventListener("blur", clearMomentaryFxTriggers);
    }
    container.appendChild(buildRoutingMatrixCard());
    const fxGrid = el("div", { className: "fx-modules-grid" });
    fxGrid.appendChild(buildTapeDriveCard());
    fxGrid.appendChild(buildDubDuckerCard());
    fxGrid.appendChild(buildSubRoarCard());
    fxGrid.appendChild(buildEchoDubCard());
    fxGrid.appendChild(buildTubbySpringCard());
    fxGrid.appendChild(buildShimmerDelayCard());
    fxGrid.appendChild(buildBlackArkPhaserCard());
    container.appendChild(fxGrid);
    pane.appendChild(container);
    return pane;
  }
  function buildRoutingMatrixCard() {
    const ctx = getContext();
    const card = el("div", { className: "fx-card fx-card-routing" });
    const cardHdr = el("div", { className: "fx-card-header" });
    cardHdr.appendChild(el("div", { className: "fx-card-title", textContent: "Send Routing" }));
    const tools = el("div", { className: "fx-routing-tools" });
    const testToneBtn = el("button", {
      type: "button",
      className: "fx-tool-btn" + (ctx.fxTestTone ? " active" : ""),
      textContent: "Test Tone",
      title: "Inject 220/440 Hz test signal when triggering AUX sends",
      "aria-pressed": ctx.fxTestTone ? "true" : "false"
    });
    testToneBtn.addEventListener("click", () => {
      ctx.fxTestTone = !ctx.fxTestTone;
      testToneBtn.classList.toggle("active", ctx.fxTestTone);
      testToneBtn.setAttribute("aria-pressed", ctx.fxTestTone ? "true" : "false");
      sendBelaControl({ event: "custom", fxTestTone: ctx.fxTestTone });
    });
    const allOffBtn = el("button", {
      type: "button",
      className: "fx-tool-btn",
      textContent: "All Off",
      title: "Turn off all active Send triggers"
    });
    allOffBtn.addEventListener("click", () => clearAllFxTriggers());
    tools.appendChild(testToneBtn);
    tools.appendChild(allOffBtn);
    cardHdr.appendChild(tools);
    card.appendChild(cardHdr);
    const table = el("div", { className: "fx-matrix-table" });
    ctx.fxRouteSelects = [];
    ctx.fxTriggerButtons = [];
    ctx.fxLatchButtons = [];
    const auxNames = ["AUX 1", "AUX 2", "AUX 3", "AUX 4", "SIREN"];
    const destinations = [
      { id: FX_DEST_HARDWARE, label: "HW \u2014 Physical" },
      { id: FX_DEST_SUB_ROAR, label: "SUB \u2014 Sub Roar" },
      { id: FX_DEST_ECHO_DUB, label: "ECHO \u2014 Echo Dub" },
      { id: FX_DEST_TUBBY_SPRING, label: "SPRING \u2014 Tubby" },
      { id: FX_DEST_BLACK_ARK, label: "PHASER \u2014 Black Ark" },
      { id: FX_DEST_TAPE_DRIVE, label: "TAPE \u2014 Drive" },
      { id: FX_DEST_SHIMMER_DELAY, label: "SHIM \u2014 Shimmer" },
      { id: FX_DEST_MUTE, label: "OFF \u2014 Mute" }
    ];
    auxNames.forEach((name, auxIdx) => {
      const row = el("div", { className: "fx-matrix-row" });
      const chLabel = el("div", { className: "fx-matrix-ch-label" });
      chLabel.appendChild(el("span", { className: "fx-ch-badge", textContent: name }));
      row.appendChild(chLabel);
      const sendsWrap = el("div", { className: "fx-matrix-sends" });
      [0, 1].forEach((sendIdx) => {
        const sendCol = el("div", { className: "fx-matrix-send-col" });
        sendCol.appendChild(el("span", {
          className: "fx-send-tag",
          textContent: "S" + (sendIdx + 1),
          title: "Send " + (sendIdx + 1)
        }));
        const currentDest = ctx.fxRouting[auxIdx][sendIdx];
        const select = el("select", {
          className: "fx-route-select",
          "aria-label": `${name} Send ${sendIdx + 1} destination`
        });
        select.dataset.aux = String(auxIdx);
        select.dataset.send = String(sendIdx);
        select.dataset.dest = String(currentDest);
        destinations.forEach((dest) => {
          const opt = el("option", {
            value: String(dest.id),
            textContent: dest.label
          });
          select.appendChild(opt);
        });
        select.value = String(currentDest);
        select.addEventListener("change", () => {
          const destId = parseInt(select.value, 10);
          ctx.fxRouting[auxIdx][sendIdx] = destId;
          select.dataset.dest = String(destId);
          sendBelaControl({
            event: "custom",
            fxRoute: { aux: auxIdx, send: sendIdx, dest: destId }
          });
        });
        ctx.fxRouteSelects.push(select);
        sendCol.appendChild(select);
        const trigWrap = el("div", { className: "fx-send-triggers" });
        const trigBtn = el("button", {
          type: "button",
          className: "fx-trig-btn" + (ctx.fxMomentaryTriggers[auxIdx][sendIdx] ? " active" : ""),
          title: auxIdx === 4 ? `Hold to trigger Siren on Send ${sendIdx + 1}` : `Hold to trigger ${name} Send ${sendIdx + 1}`,
          "aria-label": `Momentary ${name} Send ${sendIdx + 1}`,
          "aria-pressed": ctx.fxMomentaryTriggers[auxIdx][sendIdx] ? "true" : "false"
        });
        trigBtn.dataset.aux = String(auxIdx);
        trigBtn.dataset.send = String(sendIdx);
        trigBtn.appendChild(svgIcon(ICON_SEND, "0 0 24 24", 12));
        trigBtn.appendChild(el("span", { textContent: "Send" }));
        trigBtn.addEventListener("pointerdown", (e) => {
          e.preventDefault();
          if (typeof trigBtn.setPointerCapture === "function") {
            try {
              trigBtn.setPointerCapture(e.pointerId);
            } catch (_) {
            }
          }
          setMomentaryFxTrigger(auxIdx, sendIdx, true);
        });
        const releaseMomentary = () => setMomentaryFxTrigger(auxIdx, sendIdx, false);
        trigBtn.addEventListener("pointerup", releaseMomentary);
        trigBtn.addEventListener("pointercancel", releaseMomentary);
        trigBtn.addEventListener("lostpointercapture", releaseMomentary);
        trigBtn.addEventListener("blur", releaseMomentary);
        trigBtn.addEventListener("keydown", (e) => {
          if ((e.key === " " || e.key === "Enter") && !e.repeat) {
            e.preventDefault();
            setMomentaryFxTrigger(auxIdx, sendIdx, true);
          }
        });
        trigBtn.addEventListener("keyup", (e) => {
          if (e.key === " " || e.key === "Enter") {
            e.preventDefault();
            setMomentaryFxTrigger(auxIdx, sendIdx, false);
          }
        });
        const latchBtn = el("button", {
          type: "button",
          className: "fx-trig-btn fx-trig-latch" + (ctx.fxLatchedTriggers[auxIdx][sendIdx] ? " active" : ""),
          textContent: "On/Off",
          title: auxIdx === 4 ? `Toggle Siren on Send ${sendIdx + 1} (On/Off)` : `Toggle ${name} Send ${sendIdx + 1} (On/Off)`,
          "aria-label": `Toggle ${name} Send ${sendIdx + 1}`,
          "aria-pressed": ctx.fxLatchedTriggers[auxIdx][sendIdx] ? "true" : "false"
        });
        latchBtn.dataset.aux = String(auxIdx);
        latchBtn.dataset.send = String(sendIdx);
        latchBtn.addEventListener("click", () => toggleLatchedFxTrigger(auxIdx, sendIdx));
        ctx.fxTriggerButtons.push(trigBtn);
        ctx.fxLatchButtons.push(latchBtn);
        trigWrap.appendChild(trigBtn);
        trigWrap.appendChild(latchBtn);
        sendCol.appendChild(trigWrap);
        sendsWrap.appendChild(sendCol);
      });
      row.appendChild(sendsWrap);
      table.appendChild(row);
    });
    card.appendChild(table);
    return card;
  }
  function buildFxCardHeader(title, enabled, onToggle) {
    const cardHdr = el("div", { className: "fx-card-header" });
    cardHdr.appendChild(el("div", { className: "fx-card-title", textContent: title }));
    const pwrWrap = el("label", { className: "fx-toggle-wrap", title: `Enable ${title}` });
    const pwrCheck = el("input", {
      type: "checkbox",
      checked: enabled,
      "aria-label": `Enable ${title}`
    });
    pwrCheck.addEventListener("change", () => onToggle(pwrCheck.checked));
    const track = el("span", { className: "fx-toggle-track", "aria-hidden": "true" });
    track.appendChild(el("span", { className: "fx-toggle-thumb" }));
    pwrWrap.appendChild(pwrCheck);
    pwrWrap.appendChild(track);
    cardHdr.appendChild(pwrWrap);
    return cardHdr;
  }
  function buildFxMeter(fillCls) {
    const track = el("div", { className: "fx-meter-track" });
    const fill = el("div", { className: "fx-meter-fill " + fillCls });
    track.appendChild(fill);
    return { track, fill };
  }
  function buildTapeDriveCard() {
    const ctx = getContext();
    const card = el("div", { className: "fx-card" });
    card.appendChild(buildFxCardHeader("Tape Drive", ctx.tapeDrive.enabled, (en) => {
      ctx.tapeDrive.enabled = en;
      sendBelaControl({ event: "custom", tapeDrive: { enabled: en } });
    }));
    const meter = buildFxMeter("tape-fill");
    card.appendChild(meter.track);
    ctx.fxTapeMeterEl = meter.fill;
    const controls = el("div", { className: "fx-controls-list" });
    controls.appendChild(createFxSlider({
      label: "Drive",
      unit: "%",
      min: 0,
      max: 100,
      step: 1,
      value: Math.round(ctx.tapeDrive.drive * 100),
      onChange: (val) => {
        const d = val / 100;
        ctx.tapeDrive.drive = d;
        sendBelaControl({ event: "custom", tapeDrive: { drive: d } });
      }
    }));
    controls.appendChild(createFxSlider({
      label: "Warmth",
      unit: " Hz",
      min: 6e3,
      max: 16e3,
      step: 100,
      value: ctx.tapeDrive.warmth,
      onChange: (val) => {
        ctx.tapeDrive.warmth = val;
        sendBelaControl({ event: "custom", tapeDrive: { warmth: val } });
      }
    }));
    controls.appendChild(createFxSlider({
      label: "Asymmetry",
      unit: "%",
      min: 0,
      max: 100,
      step: 1,
      value: Math.round(ctx.tapeDrive.asymmetry * 100),
      onChange: (val) => {
        const a = val / 100;
        ctx.tapeDrive.asymmetry = a;
        sendBelaControl({ event: "custom", tapeDrive: { asymmetry: a } });
      }
    }));
    controls.appendChild(createFxSlider({
      label: "Return",
      unit: "%",
      min: 0,
      max: 150,
      step: 1,
      value: Math.round(ctx.tapeDrive.level * 100),
      onChange: (val) => {
        const l = val / 100;
        ctx.tapeDrive.level = l;
        sendBelaControl({ event: "custom", tapeDrive: { level: l } });
      }
    }));
    card.appendChild(controls);
    return card;
  }
  function buildDubDuckerCard() {
    const ctx = getContext();
    const card = el("div", { className: "fx-card" });
    card.appendChild(buildFxCardHeader("Ducker", ctx.dubDucker.enabled, (en) => {
      ctx.dubDucker.enabled = en;
      sendBelaControl({ event: "custom", dubDucker: { enabled: en } });
    }));
    const meter = buildFxMeter("ducker-fill");
    card.appendChild(meter.track);
    ctx.fxDuckerMeterEl = meter.fill;
    const controls = el("div", { className: "fx-controls-list" });
    const srcRow = el("div", { className: "fx-preset-row" });
    const sources = [
      { id: 0, label: "Siren" },
      { id: 1, label: "Mic" },
      { id: 2, label: "Master" },
      { id: 3, label: "All" }
    ];
    sources.forEach((s) => {
      const isAct = ctx.dubDucker.source === s.id;
      const btn = el("button", {
        type: "button",
        className: "fx-mini-btn" + (isAct ? " active" : ""),
        textContent: s.label,
        "aria-pressed": isAct ? "true" : "false"
      });
      btn.addEventListener("click", () => {
        ctx.dubDucker.source = s.id;
        srcRow.querySelectorAll(".fx-mini-btn").forEach((b) => {
          b.classList.remove("active");
          b.setAttribute("aria-pressed", "false");
        });
        btn.classList.add("active");
        btn.setAttribute("aria-pressed", "true");
        sendBelaControl({ event: "custom", dubDucker: { source: s.id } });
      });
      srcRow.appendChild(btn);
    });
    controls.appendChild(srcRow);
    controls.appendChild(createFxSlider({
      label: "Threshold",
      unit: "%",
      min: 1,
      max: 50,
      step: 1,
      value: Math.round(ctx.dubDucker.threshold * 100),
      onChange: (val) => {
        const th = val / 100;
        ctx.dubDucker.threshold = th;
        sendBelaControl({ event: "custom", dubDucker: { threshold: th } });
      }
    }));
    controls.appendChild(createFxSlider({
      label: "Release",
      unit: " ms",
      min: 50,
      max: 1500,
      step: 25,
      value: ctx.dubDucker.releaseMs,
      onChange: (val) => {
        ctx.dubDucker.releaseMs = val;
        sendBelaControl({ event: "custom", dubDucker: { releaseMs: val } });
      }
    }));
    controls.appendChild(createFxSlider({
      label: "Duck",
      unit: "%",
      min: 0,
      max: 100,
      step: 1,
      value: Math.round(ctx.dubDucker.duckAmount * 100),
      onChange: (val) => {
        const d = val / 100;
        ctx.dubDucker.duckAmount = d;
        sendBelaControl({ event: "custom", dubDucker: { duckAmount: d } });
      }
    }));
    card.appendChild(controls);
    return card;
  }
  function buildSubRoarCard() {
    const ctx = getContext();
    const card = el("div", { className: "fx-card" });
    card.appendChild(buildFxCardHeader("Sub Roar", ctx.subRoar.enabled, (en) => {
      ctx.subRoar.enabled = en;
      sendBelaControl({ event: "custom", subRoar: { enabled: en } });
    }));
    const meter = buildFxMeter("sub-fill");
    card.appendChild(meter.track);
    ctx.fxSubMeterEl = meter.fill;
    const controls = el("div", { className: "fx-controls-list" });
    controls.appendChild(createFxSlider({
      label: "Tune",
      unit: " Hz",
      min: 30,
      max: 90,
      step: 1,
      value: ctx.subRoar.tune,
      onChange: (val) => {
        ctx.subRoar.tune = val;
        sendBelaControl({ event: "custom", subRoar: { tune: val } });
      }
    }));
    controls.appendChild(createFxSlider({
      label: "Drive",
      unit: "%",
      min: 0,
      max: 100,
      step: 1,
      value: Math.round(ctx.subRoar.drive * 100),
      onChange: (val) => {
        const d = val / 100;
        ctx.subRoar.drive = d;
        sendBelaControl({ event: "custom", subRoar: { drive: d } });
      }
    }));
    controls.appendChild(createFxSlider({
      label: "Decay",
      unit: " ms",
      min: 100,
      max: 3e3,
      step: 50,
      value: ctx.subRoar.decay,
      onChange: (val) => {
        ctx.subRoar.decay = val;
        sendBelaControl({ event: "custom", subRoar: { decay: val } });
      }
    }));
    controls.appendChild(createFxSlider({
      label: "Cutoff",
      unit: " Hz",
      min: 40,
      max: 120,
      step: 1,
      value: ctx.subRoar.cutoff,
      onChange: (val) => {
        ctx.subRoar.cutoff = val;
        sendBelaControl({ event: "custom", subRoar: { cutoff: val } });
      }
    }));
    controls.appendChild(createFxSlider({
      label: "Return",
      unit: "%",
      min: 0,
      max: 150,
      step: 1,
      value: Math.round(ctx.subRoar.level * 100),
      onChange: (val) => {
        const l = val / 100;
        ctx.subRoar.level = l;
        sendBelaControl({ event: "custom", subRoar: { level: l } });
      }
    }));
    card.appendChild(controls);
    return card;
  }
  function buildEchoDubCard() {
    const ctx = getContext();
    const dub = ctx.echoDub || ctx.echuDub;
    const card = el("div", { className: "fx-card" });
    card.appendChild(buildFxCardHeader("Echo Dub", dub.enabled, (en) => {
      dub.enabled = en;
      sendBelaControl({ event: "custom", echoDub: { enabled: en }, echuDub: { enabled: en } });
    }));
    const meter = buildFxMeter("dub-fill");
    card.appendChild(meter.track);
    ctx.fxDubMeterEl = meter.fill;
    const controls = el("div", { className: "fx-controls-list" });
    const timeCtrl = createFxSlider({
      label: "Time",
      unit: " ms",
      min: 40,
      max: 1500,
      step: 5,
      value: dub.time,
      onChange: (val) => {
        dub.time = val;
        sendBelaControl({ event: "custom", echoDub: { time: val }, echuDub: { time: val } });
      }
    });
    const timeSliderRef = timeCtrl.querySelector("input[type=range]");
    const timeBadgeRef = timeCtrl.querySelector(".fx-slider-val");
    controls.appendChild(timeCtrl);
    const syncRow = el("div", { className: "fx-preset-row" });
    [
      { label: "1/16", ms: 125 },
      { label: "1/8", ms: 250 },
      { label: "1/8d", ms: 375 },
      { label: "1/4", ms: 500 },
      { label: "Dub", ms: 750 }
    ].forEach((preset) => {
      const pBtn = el("button", {
        type: "button",
        className: "fx-mini-btn",
        textContent: preset.label,
        title: `${preset.ms} ms`
      });
      pBtn.addEventListener("click", () => {
        dub.time = preset.ms;
        if (timeSliderRef) timeSliderRef.value = preset.ms;
        if (timeBadgeRef) timeBadgeRef.textContent = preset.ms + " ms";
        sendBelaControl({ event: "custom", echoDub: { time: preset.ms }, echuDub: { time: preset.ms } });
      });
      syncRow.appendChild(pBtn);
    });
    controls.appendChild(syncRow);
    controls.appendChild(createFxSlider({
      label: "Feedback",
      unit: "%",
      min: 0,
      max: 115,
      step: 1,
      value: Math.round(dub.feedback * 100),
      warnOver: 85,
      onChange: (val) => {
        const fb = val / 100;
        dub.feedback = fb;
        sendBelaControl({ event: "custom", echoDub: { feedback: fb }, echuDub: { feedback: fb } });
      }
    }));
    controls.appendChild(createFxSlider({
      label: "Tone",
      unit: " Hz",
      min: 1e3,
      max: 5e3,
      step: 50,
      value: dub.tone,
      onChange: (val) => {
        dub.tone = val;
        sendBelaControl({ event: "custom", echoDub: { tone: val }, echuDub: { tone: val } });
      }
    }));
    controls.appendChild(createFxSlider({
      label: "Flutter",
      unit: "%",
      min: 0,
      max: 100,
      step: 1,
      value: Math.round(dub.flutter * 100),
      onChange: (val) => {
        const fl = val / 100;
        dub.flutter = fl;
        sendBelaControl({ event: "custom", echoDub: { flutter: fl }, echuDub: { flutter: fl } });
      }
    }));
    controls.appendChild(createFxSlider({
      label: "Return",
      unit: "%",
      min: 0,
      max: 100,
      step: 1,
      value: Math.round(dub.level * 100),
      onChange: (val) => {
        const l = val / 100;
        dub.level = l;
        sendBelaControl({ event: "custom", echoDub: { level: l }, echuDub: { level: l } });
      }
    }));
    card.appendChild(controls);
    const actionBox = el("div", { className: "fx-action-box dual-action" });
    const killBtn = el("button", {
      type: "button",
      className: "fx-big-btn btn-kill-send" + (dub.kill ? " active" : ""),
      textContent: dub.kill ? "Send Killed" : "Kill Send",
      "aria-pressed": dub.kill ? "true" : "false"
    });
    killBtn.addEventListener("click", () => {
      dub.kill = !dub.kill;
      killBtn.classList.toggle("active", dub.kill);
      killBtn.setAttribute("aria-pressed", dub.kill ? "true" : "false");
      killBtn.textContent = dub.kill ? "Send Killed" : "Kill Send";
      sendBelaControl({ event: "custom", echoDub: { kill: dub.kill }, echuDub: { kill: dub.kill } });
    });
    const clearBtn = el("button", {
      type: "button",
      className: "fx-big-btn btn-clear-delay",
      textContent: "Clear"
    });
    clearBtn.addEventListener("click", () => {
      sendBelaControl({ event: "custom", echoDubClear: true, echuDubClear: true });
      clearBtn.classList.add("flash");
      setTimeout(() => clearBtn.classList.remove("flash"), 240);
    });
    actionBox.appendChild(killBtn);
    actionBox.appendChild(clearBtn);
    card.appendChild(actionBox);
    return card;
  }
  function buildTubbySpringCard() {
    const ctx = getContext();
    const card = el("div", { className: "fx-card" });
    card.appendChild(buildFxCardHeader("Tubby Spring", ctx.tubbySpring.enabled, (en) => {
      ctx.tubbySpring.enabled = en;
      sendBelaControl({ event: "custom", tubbySpring: { enabled: en } });
    }));
    const meter = buildFxMeter("spring-fill");
    card.appendChild(meter.track);
    ctx.fxSpringMeterEl = meter.fill;
    const controls = el("div", { className: "fx-controls-list" });
    controls.appendChild(createFxSlider({
      label: "Dwell",
      unit: "%",
      min: 0,
      max: 150,
      step: 1,
      value: Math.round(ctx.tubbySpring.dwell * 100),
      onChange: (val) => {
        const d = val / 100;
        ctx.tubbySpring.dwell = d;
        sendBelaControl({ event: "custom", tubbySpring: { dwell: d } });
      }
    }));
    controls.appendChild(createFxSlider({
      label: "Decay",
      unit: "%",
      min: 20,
      max: 95,
      step: 1,
      value: Math.round(ctx.tubbySpring.decay * 100),
      onChange: (val) => {
        const d = val / 100;
        ctx.tubbySpring.decay = d;
        sendBelaControl({ event: "custom", tubbySpring: { decay: d } });
      }
    }));
    controls.appendChild(createFxSlider({
      label: "Tone",
      unit: " Hz",
      min: 1e3,
      max: 5e3,
      step: 50,
      value: ctx.tubbySpring.tone,
      onChange: (val) => {
        ctx.tubbySpring.tone = val;
        sendBelaControl({ event: "custom", tubbySpring: { tone: val } });
      }
    }));
    controls.appendChild(createFxSlider({
      label: "Return",
      unit: "%",
      min: 0,
      max: 100,
      step: 1,
      value: Math.round(ctx.tubbySpring.level * 100),
      onChange: (val) => {
        const l = val / 100;
        ctx.tubbySpring.level = l;
        sendBelaControl({ event: "custom", tubbySpring: { level: l } });
      }
    }));
    card.appendChild(controls);
    const actionBox = el("div", { className: "fx-action-box" });
    const splashBtn = el("button", {
      type: "button",
      className: "fx-big-btn btn-splash",
      textContent: "Splash",
      title: "Trigger mechanical spring impact"
    });
    splashBtn.addEventListener("click", () => {
      sendBelaControl({ event: "custom", tubbySpringSplash: true });
      splashBtn.classList.add("flash");
      setTimeout(() => splashBtn.classList.remove("flash"), 240);
    });
    actionBox.appendChild(splashBtn);
    card.appendChild(actionBox);
    return card;
  }
  function buildShimmerDelayCard() {
    const ctx = getContext();
    const card = el("div", { className: "fx-card" });
    card.appendChild(buildFxCardHeader("Shimmer Delay", ctx.shimmerDelay.enabled, (en) => {
      ctx.shimmerDelay.enabled = en;
      sendBelaControl({ event: "custom", shimmerDelay: { enabled: en } });
    }));
    const meter = buildFxMeter("shimmer-fill");
    card.appendChild(meter.track);
    ctx.fxShimmerMeterEl = meter.fill;
    const controls = el("div", { className: "fx-controls-list" });
    const semiCtrl = createFxSlider({
      label: "Pitch",
      unit: " st",
      min: -12,
      max: 12,
      step: 1,
      value: ctx.shimmerDelay.semitones,
      onChange: (val) => {
        ctx.shimmerDelay.semitones = val;
        sendBelaControl({ event: "custom", shimmerDelay: { semitones: val } });
      }
    });
    const semiSliderRef = semiCtrl.querySelector("input[type=range]");
    const semiBadgeRef = semiCtrl.querySelector(".fx-slider-val");
    controls.appendChild(semiCtrl);
    const semiRow = el("div", { className: "fx-preset-row" });
    [
      { label: "-12", st: -12 },
      { label: "-7", st: -7 },
      { label: "0", st: 0 },
      { label: "+7", st: 7 },
      { label: "+12", st: 12 }
    ].forEach((preset) => {
      const pBtn = el("button", {
        type: "button",
        className: "fx-mini-btn",
        textContent: preset.label
      });
      pBtn.addEventListener("click", () => {
        ctx.shimmerDelay.semitones = preset.st;
        if (semiSliderRef) semiSliderRef.value = preset.st;
        if (semiBadgeRef) semiBadgeRef.textContent = (preset.st > 0 ? "+" : "") + preset.st + " st";
        sendBelaControl({ event: "custom", shimmerDelay: { semitones: preset.st } });
      });
      semiRow.appendChild(pBtn);
    });
    controls.appendChild(semiRow);
    controls.appendChild(createFxSlider({
      label: "Time",
      unit: " ms",
      min: 40,
      max: 1500,
      step: 5,
      value: ctx.shimmerDelay.delayTime,
      onChange: (val) => {
        ctx.shimmerDelay.delayTime = val;
        sendBelaControl({ event: "custom", shimmerDelay: { delayTime: val } });
      }
    }));
    controls.appendChild(createFxSlider({
      label: "Feedback",
      unit: "%",
      min: 0,
      max: 95,
      step: 1,
      value: Math.round(ctx.shimmerDelay.feedback * 100),
      onChange: (val) => {
        const fb = val / 100;
        ctx.shimmerDelay.feedback = fb;
        sendBelaControl({ event: "custom", shimmerDelay: { feedback: fb } });
      }
    }));
    controls.appendChild(createFxSlider({
      label: "Grain",
      unit: " ms",
      min: 20,
      max: 100,
      step: 5,
      value: ctx.shimmerDelay.grainSize,
      onChange: (val) => {
        ctx.shimmerDelay.grainSize = val;
        sendBelaControl({ event: "custom", shimmerDelay: { grainSize: val } });
      }
    }));
    controls.appendChild(createFxSlider({
      label: "Return",
      unit: "%",
      min: 0,
      max: 150,
      step: 1,
      value: Math.round(ctx.shimmerDelay.level * 100),
      onChange: (val) => {
        const l = val / 100;
        ctx.shimmerDelay.level = l;
        sendBelaControl({ event: "custom", shimmerDelay: { level: l } });
      }
    }));
    card.appendChild(controls);
    const actionBox = el("div", { className: "fx-action-box" });
    const clearBtn = el("button", {
      type: "button",
      className: "fx-big-btn btn-clear-delay",
      textContent: "Clear"
    });
    clearBtn.addEventListener("click", () => {
      sendBelaControl({ event: "custom", shimmerClear: true });
      clearBtn.classList.add("flash");
      setTimeout(() => clearBtn.classList.remove("flash"), 240);
    });
    actionBox.appendChild(clearBtn);
    card.appendChild(actionBox);
    return card;
  }
  function buildBlackArkPhaserCard() {
    const ctx = getContext();
    const card = el("div", { className: "fx-card" });
    card.appendChild(buildFxCardHeader("Black Ark Phaser", ctx.blackArk.enabled, (en) => {
      ctx.blackArk.enabled = en;
      sendBelaControl({ event: "custom", blackArk: { enabled: en } });
    }));
    const meter = buildFxMeter("phase-fill");
    card.appendChild(meter.track);
    ctx.fxPhaserMeterEl = meter.fill;
    const controls = el("div", { className: "fx-controls-list" });
    const rateCtrl = createFxSlider({
      label: "Rate",
      unit: " Hz",
      min: 0.05,
      max: 5,
      step: 0.05,
      value: ctx.blackArk.rate,
      onChange: (val) => {
        ctx.blackArk.rate = val;
        sendBelaControl({ event: "custom", blackArk: { rate: val } });
      }
    });
    const rateSliderRef = rateCtrl.querySelector("input[type=range]");
    const rateBadgeRef = rateCtrl.querySelector(".fx-slider-val");
    controls.appendChild(rateCtrl);
    const ratePresetRow = el("div", { className: "fx-preset-row" });
    [
      { label: "0.1 Hz", hz: 0.1 },
      { label: "0.25 Hz", hz: 0.25 },
      { label: "0.8 Hz", hz: 0.8 },
      { label: "2.5 Hz", hz: 2.5 }
    ].forEach((preset) => {
      const pBtn = el("button", {
        type: "button",
        className: "fx-mini-btn",
        textContent: preset.label
      });
      pBtn.addEventListener("click", () => {
        ctx.blackArk.rate = preset.hz;
        if (rateSliderRef) rateSliderRef.value = preset.hz;
        if (rateBadgeRef) rateBadgeRef.textContent = preset.hz + " Hz";
        sendBelaControl({ event: "custom", blackArk: { rate: preset.hz } });
      });
      ratePresetRow.appendChild(pBtn);
    });
    controls.appendChild(ratePresetRow);
    controls.appendChild(createFxSlider({
      label: "Depth",
      unit: "%",
      min: 0,
      max: 100,
      step: 1,
      value: Math.round(ctx.blackArk.depth * 100),
      onChange: (val) => {
        const d = val / 100;
        ctx.blackArk.depth = d;
        sendBelaControl({ event: "custom", blackArk: { depth: d } });
      }
    }));
    controls.appendChild(createFxSlider({
      label: "Feedback",
      unit: "%",
      min: -90,
      max: 90,
      step: 1,
      value: Math.round(ctx.blackArk.feedback * 100),
      onChange: (val) => {
        const fb = val / 100;
        ctx.blackArk.feedback = fb;
        sendBelaControl({ event: "custom", blackArk: { feedback: fb } });
      }
    }));
    controls.appendChild(createFxSlider({
      label: "Return",
      unit: "%",
      min: 0,
      max: 100,
      step: 1,
      value: Math.round(ctx.blackArk.level * 100),
      onChange: (val) => {
        const l = val / 100;
        ctx.blackArk.level = l;
        sendBelaControl({ event: "custom", blackArk: { level: l } });
      }
    }));
    card.appendChild(controls);
    const actionBox = el("div", { className: "fx-action-box" });
    const is12 = ctx.blackArk.stages === 12;
    const stagesBtn = el("button", {
      type: "button",
      className: "fx-big-btn btn-stages" + (is12 ? " active" : ""),
      textContent: is12 ? "12 Stages" : "6 Stages",
      "aria-pressed": is12 ? "true" : "false"
    });
    stagesBtn.addEventListener("click", () => {
      ctx.blackArk.stages = ctx.blackArk.stages === 12 ? 6 : 12;
      const active12 = ctx.blackArk.stages === 12;
      stagesBtn.classList.toggle("active", active12);
      stagesBtn.setAttribute("aria-pressed", active12 ? "true" : "false");
      stagesBtn.textContent = active12 ? "12 Stages" : "6 Stages";
      sendBelaControl({ event: "custom", blackArk: { stages: ctx.blackArk.stages } });
    });
    actionBox.appendChild(stagesBtn);
    card.appendChild(actionBox);
    return card;
  }
  function createFxSlider({ label, unit, min, max, step, value, warnOver, onChange }) {
    const wrap = el("div", { className: "fx-slider-item" });
    const topRow = el("div", { className: "fx-slider-top" });
    topRow.appendChild(el("span", { className: "fx-slider-lbl", textContent: label }));
    const badge = el("span", { className: "fx-slider-val", textContent: value + unit });
    if (warnOver != null && value >= warnOver) {
      badge.classList.add("warn");
    }
    topRow.appendChild(badge);
    wrap.appendChild(topRow);
    const slider = el("input", {
      type: "range",
      className: "fx-range-slider",
      min,
      max,
      step: step || 1,
      value,
      "aria-label": label
    });
    slider.addEventListener("input", () => {
      const v = parseFloat(slider.value);
      badge.textContent = v + unit;
      if (warnOver != null) badge.classList.toggle("warn", v >= warnOver);
      onChange(v);
    });
    wrap.appendChild(slider);
    return wrap;
  }
  function updateFxLive() {
    const ctx = getContext();
    if (!ctx.fxState || ctx.fxState.length < 17) return;
    autoMeter(ctx.fxSubMeterEl, ctx.fxState[0]);
    autoMeter(ctx.fxDubMeterEl, ctx.fxState[1]);
    autoMeter(ctx.fxSpringMeterEl, ctx.fxState[2]);
    autoMeter(ctx.fxPhaserMeterEl, ctx.fxState[3]);
    autoMeter(ctx.fxTapeMeterEl, ctx.fxState[4]);
    autoMeter(ctx.fxShimmerMeterEl, ctx.fxState[5]);
    if (ctx.fxDuckerMeterEl) {
      const pct = Math.min(100, Math.round((ctx.fxState[6] || 0) * 100));
      ctx.fxDuckerMeterEl.style.width = pct + "%";
    }
    if (ctx.fxRouteSelects && ctx.fxRouteSelects.length) {
      for (let aux = 0; aux < 5; ++aux) {
        for (let send = 0; send < 2; ++send) {
          ctx.fxRouting[aux][send] = Math.round(ctx.fxState[7 + aux * 2 + send]);
        }
      }
      ctx.fxRouteSelects.forEach((sel) => {
        const aux = parseInt(sel.dataset.aux, 10);
        const send = parseInt(sel.dataset.send, 10);
        const destStr = String(ctx.fxRouting[aux][send]);
        if (sel.value !== destStr && document.activeElement !== sel) {
          sel.value = destStr;
          sel.dataset.dest = destStr;
        }
      });
    }
  }
  function autoMeter(elNode, peakVal) {
    if (!elNode) return;
    const pct = Math.min(100, Math.round((peakVal || 0) * 110));
    elNode.style.width = pct + "%";
  }

  // gui/dom/shell.js
  var _currentTheme = "dark";
  var _themeToggleBtn = null;
  var ICON_MOON = "M21 12.79A9 9 0 1 1 11.21 3a7 7 0 0 0 9.79 9.79Z";
  var ICON_SUN = [
    "M12 3v2",
    "M12 19v2",
    "M4.93 4.93l1.41 1.41",
    "M17.66 17.66l1.41 1.41",
    "M3 12h2",
    "M19 12h2",
    "M4.93 19.07l1.41-1.41",
    "M17.66 6.34l1.41-1.41",
    "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z"
  ];
  var ICON_SLIDERS = [
    "M4 21v-7",
    "M4 10V3",
    "M12 21v-9",
    "M12 8V3",
    "M20 21v-5",
    "M20 12V3",
    "M2 14h4",
    "M10 10h4",
    "M18 16h4"
  ];
  function getInitialTheme() {
    try {
      const stored = localStorage.getItem(THEME_STORAGE_KEY);
      if (stored === "dark" || stored === "light") return stored;
    } catch (_) {
    }
    if (typeof window !== "undefined" && window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches) {
      return "light";
    }
    return "dark";
  }
  function updateThemeButton() {
    if (!_themeToggleBtn) return;
    const isDark = _currentTheme === "dark";
    _themeToggleBtn.innerHTML = "";
    _themeToggleBtn.appendChild(svgIcon(isDark ? ICON_MOON : ICON_SUN, "0 0 24 24", 14));
    const lbl = el("span", { className: "theme-btn-lbl" });
    lbl.textContent = isDark ? "Dark" : "Light";
    _themeToggleBtn.appendChild(lbl);
    _themeToggleBtn.title = isDark ? "Switch to light theme" : "Switch to dark theme";
    _themeToggleBtn.setAttribute("aria-label", isDark ? "Switch to light theme" : "Switch to dark theme");
  }
  function setTheme(theme) {
    _currentTheme = theme === "light" ? "light" : "dark";
    document.documentElement.dataset.theme = _currentTheme;
    try {
      localStorage.setItem(THEME_STORAGE_KEY, _currentTheme);
    } catch (_) {
    }
    updateThemeButton();
    try {
      const ctx = getContext();
      if (ctx && ctx.currentTab === TAB_LIVE && isLiveTileOn(ctx.liveLayoutPrefs, "masterEq")) {
        drawMasterEqCurve();
      }
    } catch (_) {
    }
  }
  function toggleTheme() {
    setTheme(_currentTheme === "dark" ? "light" : "dark");
  }
  function buildUI() {
    setTheme(getInitialTheme());
    document.body.innerHTML = "";
    const root = el("div", { id: "bela-gui" });
    const topChrome = el("header", { id: "top-chrome" });
    const hdr = el("div", { id: "gui-header" });
    const connBadge = el("span", { className: "badge", id: "conn-badge" });
    connBadge.textContent = "OFFLINE";
    hdr.appendChild(connBadge);
    const tempBadge = el("span", {
      className: "badge temp unknown",
      id: "temp-badge",
      title: "CPU temperature"
    });
    tempBadge.textContent = "--\xB0C";
    hdr.appendChild(tempBadge);
    const devBadge = el("span", {
      className: "badge dev-badge",
      id: "dev-badge",
      title: "Virtual control mode active"
    });
    devBadge.textContent = "VIRTUAL";
    hdr.appendChild(devBadge);
    const clipBadges = el("div", {
      id: "clip-badges",
      className: "clip-badges",
      "aria-live": "polite"
    });
    hdr.appendChild(clipBadges);
    hdr.appendChild(el("span", { className: "spacer" }));
    const logo = el("img", { id: "gui-logo", alt: "Fulla Vibes" });
    logo.src = projectFileUrl("LOGO.png");
    hdr.appendChild(logo);
    topChrome.appendChild(hdr);
    const tabBar = el("nav", { id: "tab-bar", role: "tablist", "aria-label": "Main navigation" });
    const tabPaneIds = ["pane-live", "tab-fx", "pane-dev", "pane-mapping"];
    ["Live", "FX", "Controls", "Mapping"].forEach((lbl, i) => {
      const btn = el("button", {
        type: "button",
        className: "tab-btn" + (i === TAB_LIVE ? " active" : ""),
        role: "tab",
        "aria-selected": i === TAB_LIVE ? "true" : "false",
        "aria-controls": tabPaneIds[i]
      });
      btn.textContent = lbl;
      btn.dataset.tab = i;
      btn.addEventListener("click", () => switchTab(i));
      tabBar.appendChild(btn);
    });
    tabBar.appendChild(el("span", { className: "tab-bar-spacer" }));
    const themeBtn = el("button", {
      type: "button",
      id: "theme-toggle-btn",
      className: "theme-toggle-btn"
    });
    themeBtn.addEventListener("click", () => toggleTheme());
    _themeToggleBtn = themeBtn;
    updateThemeButton();
    tabBar.appendChild(themeBtn);
    const gear = el("button", {
      type: "button",
      id: "live-layout-gear",
      className: "live-layout-gear",
      title: "Live layout",
      "aria-label": "Live layout",
      "aria-expanded": "false",
      "aria-haspopup": "dialog"
    });
    gear.appendChild(svgIcon(ICON_SLIDERS, "0 0 24 24", 14));
    const gearLbl = el("span", { className: "gear-btn-lbl" });
    gearLbl.textContent = "Layout";
    gear.appendChild(gearLbl);
    gear.addEventListener("click", () => {
      const ctx = getContext();
      if (ctx.currentTab !== TAB_LIVE) {
        switchTab(TAB_LIVE);
        setLiveLayoutPanelOpen(true);
        return;
      }
      toggleLiveLayoutPanel();
    });
    tabBar.appendChild(gear);
    setLiveLayoutGearButton(gear);
    topChrome.appendChild(tabBar);
    root.appendChild(topChrome);
    const content = el("main", { id: "tab-content" });
    content.appendChild(buildLivePane());
    content.appendChild(buildFxPane());
    content.appendChild(buildDevControlPane());
    content.appendChild(buildMappingPane());
    root.appendChild(content);
    document.body.appendChild(root);
  }
  function switchTab(idx) {
    const ctx = getContext();
    if (idx !== TAB_MAPPING) cancelDetect();
    if (idx !== TAB_FX) clearMomentaryFxTriggers();
    ctx.currentTab = idx;
    document.querySelectorAll(".tab-btn").forEach((b, i) => {
      const active = i === idx;
      b.classList.toggle("active", active);
      b.setAttribute("aria-selected", active ? "true" : "false");
    });
    document.querySelectorAll(".tab-pane").forEach((p, i) => p.classList.toggle("active", i === idx));
    if (idx === TAB_LIVE) {
      ctx.meterVu.forEach((vu) => {
        if (vu) vu.resize();
      });
      if (isLiveTileOn(ctx.liveLayoutPrefs, "meters"))
        startMeterAnim();
      if (isLiveTileOn(ctx.liveLayoutPrefs, "masterEq"))
        drawMasterEqCurve();
    } else {
      stopMeterAnim();
      setLiveLayoutPanelOpen(false);
    }
  }

  // gui/main.js
  function syncBoardConfigFromBela(isAfterRestart = false) {
    fetchBoardConfigJson().then((res) => {
      if (!res.ok || !res.parsed) return;
      const ctx = getContext();
      ctx.boardConfigJson = res.parsed;
      ctx.boardConfigRawText = res.text;
      if (!ctx.mappingUserEdited) {
        applyBoardConfigToMapping(res.parsed, {
          markDirty: false,
          applyControls: !!isAfterRestart
        });
      }
      rebuildMetersSection();
    });
  }
  function sketch(p) {
    initContext(createState());
    p.setup = function() {
      injectCSS();
      buildUI();
      layoutTopChrome();
      ensureConfigControlListener();
      syncBoardConfigFromBela(false);
      if (typeof p.noCanvas === "function")
        p.noCanvas();
      else {
        const cnv = p.createCanvas(1, 1);
        cnv.elt.style.display = "none";
      }
      hideP5Dom();
      window.addEventListener("resize", () => {
        layoutTopChrome();
        getContext().meterVu.forEach((vu) => {
          if (vu) vu.resize();
        });
        resizeMasterEqCanvas();
      });
      p.frameRate(20);
    };
    p.draw = function() {
      const ctx = getContext();
      if (typeof Bela === "undefined") {
        updateBadge();
        updateTempBadge(void 0);
        clearClipBadges();
        return;
      }
      ensureConfigControlListener();
      const b = Bela.data.buffers;
      updateBelaRxWatchdog(b);
      if (!isBelaConnected()) {
        if (ctx.awaitingRestartReconnect) {
          if (!ctx.sawOfflineDuringRestart) {
            ctx.sawOfflineDuringRestart = true;
            ctx.restartOfflinePerfMs = performance.now();
          }
          ctx.potMapping = null;
          ctx.switchMapping = null;
          ctx.configMeta = null;
        }
        updateBadge();
        updateTempBadge(void 0);
        clearClipBadges();
        return;
      }
      if (ctx.awaitingRestartReconnect && ctx.sawOfflineDuringRestart && b[4] && b[4].ts > (ctx.restartOfflinePerfMs || 0) && b[5] && b[5].ts > (ctx.restartOfflinePerfMs || 0) && b[6] && b[6].ts > (ctx.restartOfflinePerfMs || 0)) {
        ctx.awaitingRestartReconnect = false;
        ctx.sawOfflineDuringRestart = false;
        resetMappingStateForRestart();
        syncBoardConfigFromBela(true);
        setMappingStatus("Bela restarted & config reloaded \u2713", false);
      }
      if (b[0]) {
        if (!ctx.consoleReady) {
          ctx.prevPotValues = new Float32Array(b[0]);
          ctx.prevPotValuesNormal = new Float32Array(b[0]);
          ctx.prevSwitchStates = new Float32Array(b[1] || ctx.switchStates);
          if (b[7]) {
            ctx.prevMuxRawValues = new Float32Array(b[7]);
            ctx.prevMuxRawValuesNormal = new Float32Array(b[7]);
          }
          ctx.consoleReady = true;
        }
        ctx.potValues = b[0];
      }
      if (b[1]) ctx.switchStates = b[1];
      if (b[2]) ctx.sirenState = b[2];
      if (b[3]) ctx.audioLevels = b[3];
      if (b[10] && b[10].length >= 5) {
        ctx.samplerState = b[10];
        ctx.samplerStateLive = true;
      }
      if (b[11] && b[11].length && !ctx.samplerNamesBuilt) {
        ctx.samplerNamesBuf = Float32Array.from(b[11]);
      }
      if (b[7]) {
        if (!ctx.prevMuxRawValues) {
          ctx.prevMuxRawValues = new Float32Array(b[7]);
          ctx.prevMuxRawValuesNormal = new Float32Array(b[7]);
        }
        ctx.muxRawValues = b[7];
      }
      if (b[4]) {
        if (!ctx.potMapping) {
          ctx.potMapping = Float32Array.from(b[4]);
          ctx.potMappingVersion = (ctx.potMappingVersion || 0) + 1;
          tryBuildMappingTable();
        } else if (!ctx.mappingUserEdited) {
          for (let i = 0; i < Math.min(b[4].length, ctx.potMapping.length); ++i) {
            ctx.potMapping[i] = b[4][i];
          }
        }
      }
      if (b[5]) {
        if (!ctx.switchMapping) {
          ctx.switchMapping = Float32Array.from(b[5]);
          ctx.potMappingVersion = (ctx.potMappingVersion || 0) + 1;
          tryBuildMappingTable();
        } else if (!ctx.mappingUserEdited) {
          for (let i = 0; i < Math.min(b[5].length, ctx.switchMapping.length); ++i) {
            ctx.switchMapping[i] = b[5][i];
          }
        }
      }
      if (b[6] && !ctx.configMeta) {
        ctx.configMeta = Float32Array.from(b[6]);
        fillRoutingFromConfigMeta();
        fillIgnoredPotsFromConfigMeta();
      }
      if (b[6]) {
        ctx.configMeta = b[6];
        syncMicInputs(b[6]);
        syncMasterStereo(b[6]);
        syncUiDevMode(b[6]);
      }
      if (b[8]) syncCodecGains(b[8]);
      if (b[9] && b[9].length) updateTempBadge(b[9][0]);
      else updateTempBadge(void 0);
      if (b[12]) {
        ctx.fxState = b[12];
        updateFxLive();
      }
      if (ctx.consoleReady) updateConsole();
      updateSiren();
      updateSampler();
      updateSwitches();
      updateMasterEq();
      updateDevControlsLive();
      updateMappingLive();
      if (ctx.meterAnimId == null) updateClipIndicators();
      updateBadge();
      if (ctx.currentTab === TAB_LIVE && isLiveTileOn(ctx.liveLayoutPrefs, "meters") && ctx.meterAnimId == null)
        startMeterAnim();
      if (ctx.detectMode) updateDetectMode();
    };
  }
  return __toCommonJS(main_exports);
})();

var sketch = __belaPreampSketch.default || __belaPreampSketch;
new p5(sketch);

