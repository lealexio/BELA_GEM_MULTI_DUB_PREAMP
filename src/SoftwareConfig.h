#pragma once

/**
 * DSP and software behaviour constants.
 *
 * All timing values are in milliseconds unless noted otherwise.
 * Frequencies are in Hz. Gains/thresholds are in linear scale unless dB is noted.
 *
 * Split with HardwareConfig.h:
 *   HardwareConfig  → physical wiring, calibration, I/O indices
 *   SoftwareConfig  → DSP parameters, processing behaviour, debug settings
 */

// ---------------------------------------------------------------------------
// Debug
// ---------------------------------------------------------------------------

/// Set to true to enable real-time pot/switch logging in render().
constexpr bool kDebug = false;

/// Minimum absolute pot movement required to emit a debug log line.
/// Prevents log spam from ADC jitter on pots that are not touched.
constexpr float kDebugPotMinMove = 0.01f;

// ---------------------------------------------------------------------------
// Input clip detection
// ---------------------------------------------------------------------------

/// Amplitude at or above which an input frame is considered clipped.
/// ADC hard-clips at 1.0; 0.99 gives an early-warning margin.
constexpr float kClipThreshold = 0.99f;

/// Minimum render-block gap between two clip warning prints per channel.
/// Prevents log spam when a signal is continuously clipping.
/// Default: ~0.5 s at 44.1 kHz / 16 frames per block.
constexpr unsigned int kClipWarnIntervalBlocks = 4410;

/// Duration of the linear mute ramp applied to all audio outputs at startup.
/// Suppresses the DAC initialisation transient (pop). 80 ms is imperceptible.
constexpr float kStartupRampMs = 80.f;

// ---------------------------------------------------------------------------
// Potentiometer processing
// ---------------------------------------------------------------------------

/// Minimum change on an ADC reading to update the stored pot value.
/// Suppresses quantisation / jitter noise without degrading responsiveness.
constexpr float kJitterThreshold = 0.002f;

/// Dead-zone at each end of the pot travel: values ≤ kSnapRadiusEdge snap to 0.0,
/// values ≥ (1 - kSnapRadiusEdge) snap to 1.0.
/// Applied in scanStep() so all accessors benefit automatically.
constexpr float kSnapRadiusEdge   = 0.04f;

/// Exponent for the power curve applied to centred pots in getCenteredPotValue().
/// The curve maps raw [0, 1] → output [0, 1] symmetrically around 0.5:
///   - Near 0.5 : low sensitivity (small pot movements → minimal DSP change).
///   - Near 0 or 1 : high sensitivity (same movement → larger DSP change).
/// The derivative at 0.5 is zero for any exponent > 1, so ADC jitter at
/// centre produces no audible effect — no hard snap required.
///   1.0 → linear (no curve)
///   2.0 → quadratic (recommended: gentle centre, fast extremes)
///   3.0 → cubic (more pronounced)
constexpr float kCenteredPotExponent = 2.0f;

// ---------------------------------------------------------------------------
// Channel EQ (ChannelStrip — 3-band parametric)
// ---------------------------------------------------------------------------

constexpr float kEqLowFreq    = 250.f;   // Low shelf centre frequency (Hz)
constexpr float kEqMidFreq    = 1000.f;  // Mid peaking centre frequency (Hz)
constexpr float kEqHighFreq   = 4000.f;  // High shelf centre frequency (Hz)
constexpr float kEqMidQ       = 1.4f;    // Mid band Q factor
constexpr float kEqGainRangeDb = 6.f;    // Pot 0.0 → -kEqGainRangeDb dB
                                          // Pot 0.5 →  0 dB
                                          // Pot 1.0 → +kEqGainRangeDb dB

/// Smoothing time for EQ gain changes (ms) — applied to all EQ classes.
/// A one-pole filter per sample prevents abrupt biquad coefficient jumps
/// from causing clicks when pot values change between render blocks.
constexpr float kEqGainSmoothMs = 5.f;

// ---------------------------------------------------------------------------
// Noise Gate (per channel and FX return)
// ---------------------------------------------------------------------------

/// Amplitude threshold below which the gate closes (linear 0.0–1.0).
/// 0.005 ≈ -46 dBFS — captures real silence while passing any musical signal.
constexpr float kGateThreshold = 0.001f;

/// Gate open speed: how fast the gate ramps to 1.0 once signal is detected (ms).
constexpr float kGateAttackMs  = 2.0f;

/// Gate close speed: how fast the gate ramps to 0.0 after the hold expires (ms).
constexpr float kGateReleaseMs = 150.0f;

/// How long the gate stays open after signal drops below threshold (ms).
/// Prevents chatter on melodic content with brief inter-note silence.
constexpr float kGateHoldMs    = 100.0f;

// ---------------------------------------------------------------------------
// Master parametric EQ (ParametricEq — 4 bands, inserted before kills)
// ---------------------------------------------------------------------------

/// Frequency ranges for each band's logarithmic pot sweep.
/// The pot [0.0–1.0] sweeps from FMin to FMax on a log scale.
constexpr float kMasterEqSubFMin  =   20.f;    // SUB  band min (Hz)
constexpr float kMasterEqSubFMax  =   80.f;    // SUB  band max (Hz)
constexpr float kMasterEqKickFMin =   80.f;    // KICK band min (Hz)
constexpr float kMasterEqKickFMax =  200.f;    // KICK band max (Hz)
constexpr float kMasterEqMidFMin  =  200.f;    // MID  band min (Hz)
constexpr float kMasterEqMidFMax  = 1200.f;    // MID  band max (Hz)
constexpr float kMasterEqTopFMin  = 1200.f;    // TOP  band min (Hz)
constexpr float kMasterEqTopFMax  = 16000.f;   // TOP  band max (Hz) — capped for filter stability

/// Q factor of each peaking filter.
/// Higher Q = narrower bell; lower Q = broad, musical shaping.
constexpr float kMasterEqQ = 0.8f;

/// Gain range for master EQ bands: pot 0.5 → 0 dB, pot 1.0 → +range, pot 0.0 → -range.
constexpr float kMasterEqGainRangeDb = 6.f;

// ---------------------------------------------------------------------------
// FilterSection (HPF + LPF) — inserted in master bus before kills
// ---------------------------------------------------------------------------

/// HPF frequency sweep range. When freqPot < kFilterOffThreshold the HPF is bypassed.
constexpr float kHpfFMin = 20.f;     // HPF minimum cutoff frequency (Hz)
constexpr float kHpfFMax = 2000.f;   // HPF maximum cutoff frequency (Hz)

/// LPF frequency sweep range. When freqPot < kFilterOffThreshold the LPF is bypassed.
constexpr float kLpfFMin = 200.f;    // LPF minimum cutoff frequency (Hz)
constexpr float kLpfFMax = 20000.f;  // LPF maximum cutoff frequency (Hz)

/// Resonance (Q) sweep range applied to both HPF and LPF.
/// kFilterQMin = Butterworth (flat), kFilterQMax = CDJ-style resonance peak.
constexpr float kFilterQMin = 0.7f;  // minimum Q — flat, no resonance
constexpr float kFilterQMax = 4.5f;  // maximum Q — pronounced resonance peak

/// Pot value below which a filter is considered OFF and removed from the signal path.
constexpr float kFilterOffThreshold = 0.01f;

/// Crossfade time when toggling HPF or LPF on/off (ms).
/// A one-pole ramp blends dry↔wet over this window, eliminating activation clicks.
constexpr float kFilterBypassRampMs = 5.f;

// ---------------------------------------------------------------------------
// Kill switches — crossover frequencies (KillSwitch)
// ---------------------------------------------------------------------------

constexpr float kKillFc0        =   80.f;   // SUB  / KICK band boundary (Hz)
constexpr float kKillFc1        =  200.f;   // KICK / MID  band boundary (Hz)
constexpr float kKillFc2        = 1200.f;   // MID  / TOP  band boundary (Hz)
constexpr float kKillCrossoverQ = 0.707f;   // Butterworth 2nd-order pole Q

/// Fade time when toggling a kill band (ms).
/// Higher = softer transition; lower = snappier but may pop at short values.
constexpr float kKillRampMs = 30.0f;

/// Number of cascaded biquad stages per kill-band edge.
/// Each stage adds 12 dB/oct slope.
///   1 → 12 dB/oct  (lightest CPU)
///   2 → 24 dB/oct  (recommended)
///   4 → 48 dB/oct  (very steep)
constexpr int kKillFilterStages = 2;

// ---------------------------------------------------------------------------
// Band Trim (BandTrim — 4-band ±3 dB trim, after FilterSection, before KillSwitch)
// ---------------------------------------------------------------------------

/// Gain range per band: pot 0.5 → 0 dB, pot 0.0 → -kBandTrimGainDb, pot 1.0 → +kBandTrimGainDb.
constexpr float kBandTrimGainDb = 6.f;

/// Centre frequency for the KICK peaking filter: geometric mean of SUB/KICK boundary (80 Hz)
/// and KICK/MID boundary (200 Hz).
constexpr float kBandTrimKickFreq = 126.f;  // sqrt(80 * 200)

/// Centre frequency for the MID peaking filter: geometric mean of KICK/MID (200 Hz)
/// and MID/TOP boundary (1200 Hz).
constexpr float kBandTrimMidFreq  = 490.f;  // sqrt(200 * 1200)

/// Q factor for the KICK peaking band — moderately wide bell.
constexpr float kBandTrimKickQ = 1.0f;

/// Q factor for the MID peaking band — slightly broader bell for a smoother transition.
constexpr float kBandTrimMidQ  = 0.7f;

/// Minimum gain change (dB) that triggers a biquad coefficient recompute.
constexpr float kBandTrimEpsilonDb = 0.05f;

// ---------------------------------------------------------------------------
// Graphic EQ (GraphicEq — 12 fixed bands in master bus, after ParametricEq)
// ---------------------------------------------------------------------------

/// Gain range per band: pot 0.5 → 0 dB, pot 1.0 → +range, pot 0.0 → -range.
constexpr float kGEqGainRangeDb = 12.f;

/// Q factor for all 12 peaking bands.
/// √2 ≈ 1.41 is the standard octave-band graphic EQ value (flat summing).
constexpr float kGEqQ = 1.41f;

/// Minimum gain change (dB) that triggers a biquad coefficient recompute.
/// Prevents unnecessary DSP work from ADC jitter.
constexpr float kGEqUpdateEpsilonDb = 0.05f;

// ---------------------------------------------------------------------------
// Dub Siren (DubSiren)
// ---------------------------------------------------------------------------

/// Time for the siren gate amplitude to ramp from 0 to 1 (trigger pressed).
/// Hysteresis band applied to the siren preset selector.
/// A preset change is only accepted when the pot has moved this far past the
/// zone boundary into the new preset — prevents ADC jitter at boundaries from
/// rapidly toggling between two presets and producing a double-siren effect.
/// Each preset zone spans (1.0 / kNumPresets) ≈ 0.125 of pot travel.
/// 0.03 ≈ 24 % of one zone — wide enough to absorb typical jitter.
constexpr float kSirenPresetHysteresis = 0.03f;

constexpr float kSirenGateAttackMs  = 5.f;

/// Time for the siren gate amplitude to ramp from 1 to 0 (trigger released).
constexpr float kSirenGateReleaseMs = 80.f;

// ---------------------------------------------------------------------------
// FX Send pot scaling
// ---------------------------------------------------------------------------

/// Pot position that is mapped to full send (1.0).
/// Values above this ceiling are clamped to 1.0, so physical pot travel
/// [0 → kFxSendPotCeiling] covers the full [0 → 1] send range.
/// Example: 0.7 → 70 % pot travel already gives 100 % send.
constexpr float kFxSendPotCeiling = 0.7f;

// ---------------------------------------------------------------------------
// FX Send filter modes (PA5 = mids only, PA6 = tops only)
// ---------------------------------------------------------------------------

/// Low boundary of the mid band: frequencies below this are excluded in MIDS mode.
constexpr float kFxMidLowFreq  = 250.f;   // Hz

/// High boundary of the mid band / tops crossover.
constexpr float kFxMidHighFreq = 4000.f;  // Hz

/// Butterworth Q for FX send filter transitions (0.707 = maximally flat, no resonance).
constexpr float kFxFilterQ = 0.707f;

/// Master gain scale applied to both the dry output and FX send of the siren.
/// Reduce if the siren is too loud relative to the channel strips.
constexpr float kSirenGainScale = 0.1f;

// ---------------------------------------------------------------------------
// FX return routing
// ---------------------------------------------------------------------------

/// When true  : FX returns are injected POST-master (after EQ, filters, kills).
///              The wet signal bypasses all master processing — only masterGain applies.
///              Use this when the effect unit has its own character that should not
///              be coloured by the master chain (HPF, EQ, kills…).
///
/// When false : FX returns are summed PRE-master, entering the full processing chain.
///              Use this when you want kills and EQ to shape the wet return as well.
constexpr bool kFxReturnPostMaster = true;

// ---------------------------------------------------------------------------
// Bela GUI web interface (sketch.js)
// ---------------------------------------------------------------------------

/// GUI send interval in audio samples (~16.7 ms @ 44.1 kHz → ~60 fps).
constexpr int kGuiUpdateIntervalSamples = 735;

/// Resend static mapping/config-meta buffers every N GUI ticks (~250 ms @ 60 fps).
constexpr int kGuiStaticBufSendDivisor = 15;

/// Float count for GUI buffer 6 (mux, routing, ignoredPots). Must match sketch.js.
constexpr int kGuiConfigMetaHeaderFloats = 21;
constexpr int kGuiConfigMetaSize         = kGuiConfigMetaHeaderFloats + 32; // 16 ignored pairs max
