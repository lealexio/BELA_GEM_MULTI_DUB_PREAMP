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
constexpr bool kDebug = true;

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

/// Half-width of the snap dead-zone around 0.5 for getCenteredPotValue().
/// A pot within this radius of centre is returned exactly as 0.5
/// ("no effect" for EQ / bipolar controls).
constexpr float kSnapRadiusCenter = 0.03f;

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

// ---------------------------------------------------------------------------
// Noise Gate (per channel and FX return)
// ---------------------------------------------------------------------------

/// Amplitude threshold below which the gate closes (linear 0.0–1.0).
/// 0.005 ≈ -46 dBFS — captures real silence while passing any musical signal.
constexpr float kGateThreshold = 0.005f;

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
constexpr float kSirenGateAttackMs  = 5.f;

/// Time for the siren gate amplitude to ramp from 1 to 0 (trigger released).
constexpr float kSirenGateReleaseMs = 80.f;
