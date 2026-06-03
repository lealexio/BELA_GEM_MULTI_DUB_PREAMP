#pragma once

/**
 * DSP and software configuration constants.
 * Adjust these values to tune the behaviour of the signal processing chain.
 * All timing values are in milliseconds.
 */

// ---------------------------------------------------------------------------
// Noise Gate (per channel)
// ---------------------------------------------------------------------------

// Amplitude threshold below which the gate closes (linear, 0.0–1.0).
// 0.005 ≈ -46 dBFS — captures normal silence while passing any real signal.
// Increase if you still hear noise; decrease if quiet signals get cut.
constexpr float kGateThreshold   = 0.005f;

// How fast the gate opens when signal exceeds the threshold (ms).
// Short attack = gate opens snappily without cutting transients.
constexpr float kGateAttackMs    = 2.0f;

// How fast the gate closes after signal drops below the threshold (ms).
// Long release = gate closes smoothly, avoids chopping reverb tails.
constexpr float kGateReleaseMs   = 150.0f;

// How long the gate stays open after signal drops below threshold (ms).
// Prevents the gate from "chattering" on signals that fluctuate near threshold.
constexpr float kGateHoldMs      = 80.0f;
