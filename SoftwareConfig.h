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

/// Half-width of the snap dead-zone around 0.5 for getCenteredPotValue().
/// A pot within this radius of centre is returned exactly as 0.5
/// ("no effect" for EQ / bipolar controls).
constexpr float kSnapRadiusCenter = 0.10f;

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
