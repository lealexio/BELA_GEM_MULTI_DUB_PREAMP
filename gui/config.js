/**
 * GUI constants — must match render.cpp / HardwareConfig.h / SoftwareConfig.h.
 */
/** Minimum pot travel (0–1) required to accept a detect hit. */
export const DETECT_POT_MIN_DELTA = 0.25;

/** MUX grid layout — must match kNumMux × kPotsPerMux in HardwareConfig.h. */
export const MUX_POTS_PER_MUX = 16;
export const MUX_RAW_SIZE     = 64;

/** Console pot change thresholds — detailed catches ADC jitter, normal filters it. */
export const CONSOLE_POT_MIN_DELTA_DETAILED = 0.003;
export const CONSOLE_POT_MIN_DELTA_NORMAL   = 0.02;

/** No fresh Bela data for this long → badge OFFLINE. */
export const BELA_OFFLINE_TIMEOUT_MS = 1000;
/** Nominal GUI tick ~50 ms @ 20 fps; gap above this → badge LAG (orange). */
export const BELA_LAG_THRESHOLD_MS = 180;

export const SIREN_PRESETS = ['Wail', 'Whoop', 'Police', 'Scanner', 'Riotgun', 'Laser'];

/** Pot names in kAllNamedPots order (58 entries). */
export const POT_NAMES = [
    // AUX1 — idx 0-5
    'AUX1_INPUT_GAIN','AUX1_EQ_MID','AUX1_EQ_LOW','AUX1_EQ_HIGH','AUX1_FX_SEND','AUX1_FX2_SEND',
    // AUX2 — idx 6-11
    'AUX2_INPUT_GAIN','AUX2_EQ_MID','AUX2_EQ_HIGH','AUX2_EQ_LOW','AUX2_FX_SEND','AUX2_FX2_SEND',
    // AUX3 — idx 12-17
    'AUX3_INPUT_GAIN','AUX3_EQ_LOW','AUX3_EQ_MID','AUX3_EQ_HIGH','AUX3_FX_SEND','AUX3_FX2_SEND',
    // AUX4 — idx 18-23
    'AUX4_INPUT_GAIN','AUX4_EQ_LOW','AUX4_EQ_MID','AUX4_EQ_HIGH','AUX4_FX_SEND','AUX4_FX2_SEND',
    // Master — idx 24
    'MASTER_GAIN',
    // Parametric EQ — idx 25-32
    'MASTER_EQ_SUB_FREQ','MASTER_EQ_SUB_GAIN',
    'MASTER_EQ_KICK_FREQ','MASTER_EQ_KICK_GAIN',
    'MASTER_EQ_MID_FREQ','MASTER_EQ_MID_GAIN',
    'MASTER_EQ_TOP_FREQ','MASTER_EQ_TOP_GAIN',
    // Filters — idx 33-36
    'MASTER_HPF_FREQ','MASTER_HPF_RES','MASTER_LPF_FREQ','MASTER_LPF_RES',
    // Band Trim — idx 37-40
    'BTRIM_SUB','BTRIM_KICK','BTRIM_MID','BTRIM_TOP',
    // Siren — idx 41-45
    'SIREN_TYPE','SIREN_MOD','SIREN_GAIN','SIREN_FX_SEND','SIREN_FX2_SEND',
    // Graphic EQ 12 bands — idx 46-57
    'GEQ_40HZ','GEQ_60HZ','GEQ_80HZ','GEQ_100HZ','GEQ_125HZ','GEQ_250HZ',
    'GEQ_500HZ','GEQ_1KHZ','GEQ_2KHZ','GEQ_4KHZ','GEQ_8KHZ','GEQ_16KHZ'
]; // 58 entries

/** Switch names matching kGuiSwitchRefs[] order in render.cpp. */
export const SWITCH_NAMES = [
    'KILL_SUB','KILL_KICK','KILL_MID','KILL_TOP',
    'FX_FILTER_MIDS','FX_FILTER_TOPS','FX2_FILTER_TOPS','FX2_FILTER_MIDS',
    'SIREN_TRIGGER'
]; // 9 entries

/** Switch groups for the Live tab UI (indices match SWITCH_NAMES). */
export const SWITCH_GROUPS = [
    { label: 'Band kill',      type: 'kill',  indices: [0, 1, 2, 3] },
    { label: 'FX send filter', type: 'fx',    indices: [4, 5, 6, 7] },
    { label: 'Siren',          type: 'siren', indices: [8]          }
];

/** Human-readable labels for the 13 audio peak channels. */
export const LEVEL_LABELS = [
    'IN 1','IN 2','IN 3','IN 4',
    'FX Ret 1','FX Ret 2',
    'Master','FX Snd 1','FX Snd 2',
    'VU SUB','VU KICK','VU MID','VU TOP'
];

export const LEVEL_GROUPS = [
    { label: 'INPUTS',  indices: [0,1,2,3,4,5]        },
    { label: 'OUTPUTS', indices: [6,7,8,9,10,11,12]   }
];

/** I2C bus string — must match kI2cBus in HardwareConfig.h. */
export const I2C_BUS = '/dev/i2c-1';

/** Layout of Bela → JS buffer [6] (config metadata for JSON download). */
export const CONFIG_META = {
    ACTIVE_MUX: 0, SCALE: 1, POT_MAX: 2, POT_MIN: 3, MCP_ADDR: 4,
    MASTER_COUNT: 5, MASTER_0: 6, MASTER_1: 7,
    FX1_SEND: 8, FX2_SEND: 9,
    VU_SUB: 10, VU_KICK: 11, VU_MID: 12, VU_TOP: 13,
    FX1_RET: 14, FX2_RET: 15,
    AUX1: 16, AUX2: 17, AUX3: 18, AUX4: 19,
    IGNORED_COUNT: 20, IGNORED_BASE: 21
};

/**
 * Master EQ curve constants — must match SoftwareConfig.h / render.cpp mapping.
 * Pot indices refer to kAllNamedPots order (POT_NAMES above).
 */
export const MASTER_EQ_CONFIG = {
    SAMPLE_RATE: 44100,
    FREQ_MIN: 20,
    FREQ_MAX: 20000,
    CURVE_POINTS: 200,
    Y_MIN_DB: -18,
    Y_MAX_DB: 18,
    GAIN_EPSILON_DB: 0.05,
    FILTER_OFF_THRESHOLD: 0.01,
    POT: {
        PE_SUB_FREQ: 25, PE_SUB_GAIN: 26,
        PE_KICK_FREQ: 27, PE_KICK_GAIN: 28,
        PE_MID_FREQ: 29, PE_MID_GAIN: 30,
        PE_TOP_FREQ: 31, PE_TOP_GAIN: 32,
        HPF_FREQ: 33, HPF_RES: 34,
        LPF_FREQ: 35, LPF_RES: 36,
        BTRIM_SUB: 37, BTRIM_KICK: 38, BTRIM_MID: 39, BTRIM_TOP: 40,
        GEQ_BASE: 46
    },
    KILL_SWITCH: { SUB: 0, KICK: 1, MID: 2, TOP: 3 },
    MASTER_EQ_GAIN_RANGE_DB: 6,
    MASTER_EQ_Q: 0.8,
    MASTER_EQ_FMIN: [20, 80, 200, 1200],
    MASTER_EQ_FMAX: [80, 200, 1200, 16000],
    GEQ_FREQS: [40, 60, 80, 100, 125, 250, 500, 1000, 2000, 4000, 8000, 16000],
    GEQ_GAIN_RANGE_DB: 12,
    GEQ_Q: 1.41,
    HPF_FMIN: 20, HPF_FMAX: 2000,
    LPF_FMIN: 200, LPF_FMAX: 20000,
    FILTER_QMIN: 0.7, FILTER_QMAX: 4.5,
    BAND_TRIM_GAIN_DB: 6,
    BAND_TRIM_KICK_FREQ: 126,
    BAND_TRIM_MID_FREQ: 490,
    BAND_TRIM_KICK_Q: 1.0,
    BAND_TRIM_MID_Q: 0.7,
    KILL_FC: [80, 200, 1200],
    KILL_CROSSOVER_Q: 0.707,
    KILL_FILTER_STAGES: 2
};

/** Log-spaced frequency (Hz) for one curve sample index. */
export const masterEqFreqs = (function() {
    const n = MASTER_EQ_CONFIG.CURVE_POINTS;
    const fMin = MASTER_EQ_CONFIG.FREQ_MIN;
    const fMax = MASTER_EQ_CONFIG.FREQ_MAX;
    const logMin = Math.log10(fMin);
    const logMax = Math.log10(fMax);
    const out = new Float32Array(n);
    for(let i = 0; i < n; i++)
        out[i] = Math.pow(10, logMin + (logMax - logMin) * i / (n - 1));
    return out;
})();

/** X-axis tick labels for the master EQ plot (Hz). */
export const MASTER_EQ_FREQ_TICKS = [20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000];
export const METER_ATTACK     = 0.42;  // fast rise (~60 fps ballistic)
export const METER_RELEASE    = 0.14;  // slow fall
export const PEAK_HOLD_MS     = 750;
export const PEAK_DECAY       = 0.94;
/** Clip detection — must match kClipThreshold in SoftwareConfig.h. */
export const CLIP_THRESHOLD   = 0.99;
export const CLIP_HOLD_MS     = 1500;
/** Canvas VU meter layout — matches vumeter.js style. */
export const VU_BOX_COUNT        = 30;
export const VU_BOX_COUNT_RED    = 4;
export const VU_BOX_COUNT_YELLOW = 6;
export const VU_BOX_GAP_FRACTION = 0.25;
export const VU_MAX              = 100;
export const VU_CANVAS_W         = 300;
export const VU_CANVAS_H         = 44;
export const MAX_CONSOLE         = 10;

/**
 * Maps routing key names (from config.json) to their fixed index in gAudioPeaks (C++).
 * This table is the JS source of truth — must stay in sync with the index layout in render.cpp.
 */
export const ROUTING_KEY_TO_BUFFER3 = {
    aux1:      0,
    aux2:      1,
    aux3:      2,
    aux4:      3,
    fx1Return: 4,
    fx2Return: 5,
    master:    6,
    fx1Send:   7,
    fx2Send:   8,
    vuSub:     9,
    vuKick:    10,
    vuMid:     11,
    vuTop:     12,
};

/**
 * Builds the full dynamic routing descriptor from a ROUTING_CONFIG object
 * (auto-generated from src/config.json by build-gui.mjs).
 *
 * Channel numbers come directly from the routing values (e.g. routing.in.aux1 = 0),
 * so no configMeta / buffer 6 is needed at runtime.
 *
 * @param {object} routing - ROUTING_CONFIG.in / ROUTING_CONFIG.out structure
 * @returns {{
 *   levelGroups:    Array<{label:string, indices:number[]}>,
 *   levelLabels:    Object<number, string>,
 *   inputChannels:  Array<{key:string, ch:number, label:string, buf3:number}>,
 *   outputChannels: Array<{key:string, ch:number, label:string, buf3:number}>,
 * }}
 */
export function buildFullRouting(routing) {
    const toLabel    = key => key.toUpperCase();
    const toPhysical = val => Array.isArray(val) ? val[0] : val;

    const inEntries  = Object.entries(routing.in  || {});
    const outEntries = Object.entries(routing.out || {});

    const levelGroups = [
        {
            label:   'INPUTS',
            indices: inEntries
                .map(([k]) => ROUTING_KEY_TO_BUFFER3[k])
                .filter(i => i !== undefined),
        },
        {
            label:   'OUTPUTS',
            indices: outEntries
                .map(([k]) => ROUTING_KEY_TO_BUFFER3[k])
                .filter(i => i !== undefined),
        },
    ];

    const levelLabels = {};
    [...inEntries, ...outEntries].forEach(([key]) => {
        const idx = ROUTING_KEY_TO_BUFFER3[key];
        if (idx !== undefined) levelLabels[idx] = toLabel(key);
    });

    const inputChannels = inEntries.map(([key, val]) => ({
        key,
        ch:    toPhysical(val),
        label: toLabel(key),
        buf3:  ROUTING_KEY_TO_BUFFER3[key],
    }));

    const outputChannels = outEntries.map(([key, val]) => ({
        key,
        ch:    toPhysical(val),
        label: toLabel(key),
        buf3:  ROUTING_KEY_TO_BUFFER3[key],
    }));

    return { levelGroups, levelLabels, inputChannels, outputChannels };
}
