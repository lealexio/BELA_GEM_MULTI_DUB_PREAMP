#pragma once

/**
 * DSP and software behaviour constants.
 *
 * All timing values are in milliseconds unless noted otherwise.
 * Frequencies are in Hz. Gains/thresholds are in linear scale unless dB is
 * noted.
 *
 * Split with HardwareConfig.h:
 *   HardwareConfig  → physical wiring, calibration, I/O indices
 *   SoftwareConfig  → DSP parameters, processing behaviour, debug settings
 */

// ---------------------------------------------------------------------------
// Audio Engine & Platform Defaults
// ---------------------------------------------------------------------------

/// Default audio sample rate of the Bela platform (Hz).
constexpr float kDefaultSampleRate = 44100.f;

/// Standard Butterworth filter Q (1 / sqrt(2) ≈ 0.70710678) — maximally flat
/// passband.
constexpr float kButterworthQ = 0.70710678f;

// ---------------------------------------------------------------------------
// Debug
// ---------------------------------------------------------------------------

/// Set to true to enable real-time pot/switch logging in render().
constexpr bool kDebug = false;

/// Minimum absolute pot movement required to emit a debug log line.
/// Prevents log spam from ADC jitter on pots that are not touched.
constexpr float kDebugPotMinMove = 0.01f;

// ---------------------------------------------------------------------------
// Input clip & signal detection (Hardware LEDs via MCP23017)
// ---------------------------------------------------------------------------

/// Amplitude at or above which an audio frame is considered clipped.
/// 0.9441f ≈ -0.5 dBFS (10^(-0.5/20)) — pro-audio headroom indicator.
constexpr float kClipThreshold = 0.9441f;

/// Minimum duration to keep a clip LED lit continuously after a clip event
/// (ms). Solid, steady red illumination with a peak hold of 1.2 s
/// (range: 1.0–1.5 s).
constexpr float kClipLedHoldMs = 1200.f;

/// Low threshold to detect presence of signal entering the preamp.
/// 0.01585f ≈ -36 dBFS (10^(-36/20)) — confirms channel is live.
constexpr float kSignalPresentThreshold = 0.01585f;

/// Duration of the brief light impulse for signal presence (ms).
/// 35 ms gives a subtle, visible heartbeat flash without blinding the user.
constexpr float kSignalFlashDurationMs = 35.f;

/// Repetition period of the signal presence flash under continuous audio (ms).
/// 1000 ms = 1 Hz slow blink rhythm, keeping I2C bus traffic near zero.
constexpr float kSignalFlashPeriodMs = 1000.f;

/// Maximum silence window at the end of a 1 Hz cycle before returning to idle
/// (ms). If no signal was detected in the last 150 ms, prevents ghost flashes
/// when audio stops.
constexpr float kSignalSilenceWindowMs = 150.f;

/// Minimum render-block gap between two clip warning prints per channel.
/// Prevents log spam when a signal is continuously clipping.
/// Default: ~0.5 s at 44.1 kHz / 16 frames per block.
constexpr unsigned int kClipWarnIntervalBlocks = 4410;

/// Duration of each step of the startup LED animation (ms).
/// Fast ping-pong scan: MASTER -> AUX1..4 -> AUX3..1 -> MASTER (2 round-trips =
/// 17 steps).
constexpr float kStartupLedStepMs = 70.f;

/// Total number of steps in the startup LED animation.
constexpr int kStartupLedAnimSteps = 17;

/// Duration of the initial silent mute period at startup (ms).
/// Holds all audio outputs strictly at 0.0 to let DAC power rails, DC blocking
/// capacitors, multiplexers, and I2C communication fully stabilize without any
/// pop. Calibrated to match the full startup LED animation duration (17 steps *
/// 70 ms = 1190 ms).
constexpr float kStartupMuteDelayMs =
    kStartupLedStepMs * static_cast<float>(kStartupLedAnimSteps);

/// Duration of the smooth S-curve fade-in ramp applied to audio outputs (ms).
/// Gradually brings audio to full level after the startup mute delay without
/// clicking.
constexpr float kStartupRampMs = 300.f;

/// Duration of the ultra-fast S-curve fade-out ramp applied to audio outputs
/// when stopping the project via Bela IDE Stop button or SIGINT/SIGTERM (ms).
/// 30 ms (1323 samples @ 44.1 kHz) is completely click-free and inaudible,
/// while completing well before the Bela IDE 200 ms kill -9 timeout.
constexpr float kShutdownRampMs = 30.f;

// ---------------------------------------------------------------------------
// Potentiometer processing
// ---------------------------------------------------------------------------

/// One-pole low-pass (EMA) smoothing coefficient applied to raw pot ADC
/// readings in scanStep(). Formule: potValues_[idx] += kPotSmoothingCoeff *
/// (raw - potValues_[idx]) Higher = faster response; lower = stronger
/// noise/jitter suppression. At ~275 Hz pot sampling rate (16 audio frames * 10
/// channels), 0.15 provides ~24 ms time constant, eliminating ADC jitter (~22
/// dB noise rejection) with zero perceptible lag.
constexpr float kPotSmoothingCoeff = 0.15f;

/// Minimum change on an ADC reading to update the stored pot value.
/// Suppresses quantisation / jitter noise without degrading responsiveness.
constexpr float kJitterThreshold = 0.002f;

/// Dead-zone at each end of the pot travel: values ≤ kSnapRadiusEdge snap to
/// 0.0, values ≥ (1 - kSnapRadiusEdge) snap to 1.0. Applied in scanStep() so
/// all accessors benefit automatically.
constexpr float kSnapRadiusEdge = 0.04f;

/// Center position of normalised pot travel [0.0–1.0].
constexpr float kPotCenter = 0.5f;

/// Dead-zone half-width around 0.5 for getCenteredPotValue().
/// Any raw value within [kPotCenter - kSnapRadiusCenter, kPotCenter +
/// kSnapRadiusCenter] returns exactly kPotCenter (neutral / 0 dB). Outside this
/// dead-zone, the response scales continuously and linearly to 0.0 and 1.0.
constexpr float kSnapRadiusCenter = 0.03f;

// ---------------------------------------------------------------------------
// Linear gain ranges (channels, master, FX returns)
// ---------------------------------------------------------------------------

/// Maximum linear gain for AUX input channels (AUX 1-4) when the pot is at
/// maximum (1.0). 1.0 = unity gain (0 dB), 2.0 = +6 dB.
constexpr float kInputMaxGain = 2.0f;

/// Maximum linear gain for the master output when the pot is at maximum (1.0).
/// 1.0 = unity gain (0 dB), 2.0 = +6 dB.
constexpr float kMasterMaxGain = 2.0f;

/// Maximum linear gain for FX return inputs (FX1, FX2) when the pot is at
/// maximum (1.0). 1.0 = unity gain (0 dB), 2.0 = +6 dB.
constexpr float kFxReturnMaxGain = 2.0f;

// ---------------------------------------------------------------------------
// Channel EQ (ChannelStrip — 3-band parametric)
// ---------------------------------------------------------------------------

constexpr float kEqLowFreq = 250.f;   // Low shelf centre frequency (Hz)
constexpr float kEqMidFreq = 1000.f;  // Mid peaking centre frequency (Hz)
constexpr float kEqHighFreq = 4000.f; // High shelf centre frequency (Hz)
constexpr float kEqMidQ = 1.4f;       // Mid band Q factor
constexpr float kEqGainRangeDb = 6.f; // Pot 0.0 → -kEqGainRangeDb dB
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

/// Gate open speed: how fast the gate ramps to 1.0 once signal is detected
/// (ms).
constexpr float kGateAttackMs = 2.0f;

/// Gate close speed: how fast the gate ramps to 0.0 after the hold expires
/// (ms).
constexpr float kGateReleaseMs = 150.0f;

/// How long the gate stays open after signal drops below threshold (ms).
/// Prevents chatter on melodic content with brief inter-note silence.
constexpr float kGateHoldMs = 100.0f;

/// Envelope-follower attack time (ms). This is the speed at which the
/// peak follower reacts to rising signal — distinct from kGateAttackMs
/// (the gain-ramp attack). Both happen to be 2 ms by design.
constexpr float kGateEnvAttackMs = 2.0f;

/// Gate-gain thresholds used by the state machine to detect "fully open"
/// and "fully closed" states. Below these the gate transitions between
/// ATTACK↔HOLD and RELEASE↔CLOSED respectively.
constexpr float kGateFullyOpenThresh = 0.999f;
constexpr float kGateFullyClosedThresh = 0.001f;

/// Threshold above which isOpen() reports the gate as audibly open.
constexpr float kGateOpenThresh = 0.5f;

// ---------------------------------------------------------------------------
// Master parametric EQ (ParametricEq — 4 bands, inserted before kills)
// ---------------------------------------------------------------------------

/// Frequency ranges for each band's logarithmic pot sweep.
/// The pot [0.0–1.0] sweeps from FMin to FMax on a log scale.
constexpr float kMasterEqSubFMin = 20.f;   // SUB  band min (Hz)
constexpr float kMasterEqSubFMax = 80.f;   // SUB  band max (Hz)
constexpr float kMasterEqKickFMin = 80.f;  // KICK band min (Hz)
constexpr float kMasterEqKickFMax = 200.f; // KICK band max (Hz)
constexpr float kMasterEqMidFMin = 200.f;  // MID  band min (Hz)
constexpr float kMasterEqMidFMax = 1200.f; // MID  band max (Hz)
constexpr float kMasterEqTopFMin = 1200.f; // TOP  band min (Hz)
constexpr float kMasterEqTopFMax =
    16000.f; // TOP  band max (Hz) — capped for filter stability

/// Q factor of each peaking filter.
/// Higher Q = narrower bell; lower Q = broad, musical shaping.
constexpr float kMasterEqQ = 0.8f;

/// Gain range for master EQ bands: pot 0.5 → 0 dB, pot 1.0 → +range, pot 0.0 →
/// -range.
constexpr float kMasterEqGainRangeDb = 6.f;

// ---------------------------------------------------------------------------
// FilterSection (HPF + LPF) — inserted in master bus before kills
// ---------------------------------------------------------------------------

/// HPF frequency sweep range. When freqPot < kFilterOffThreshold the HPF is
/// bypassed.
constexpr float kHpfFMin = 20.f;   // HPF minimum cutoff frequency (Hz)
constexpr float kHpfFMax = 2000.f; // HPF maximum cutoff frequency (Hz)

/// LPF frequency sweep range. When freqPot < kFilterOffThreshold the LPF is
/// bypassed.
constexpr float kLpfFMin = 200.f;   // LPF minimum cutoff frequency (Hz)
constexpr float kLpfFMax = 20000.f; // LPF maximum cutoff frequency (Hz)

/// Resonance (Q) sweep range applied to both HPF and LPF.
/// kFilterQMin = Butterworth (flat), kFilterQMax = CDJ-style resonance peak.
constexpr float kFilterQMin = 0.7f; // minimum Q — flat, no resonance
constexpr float kFilterQMax = 4.5f; // maximum Q — pronounced resonance peak

/// Pot value below which a filter is considered OFF and removed from the signal
/// path.
constexpr float kFilterOffThreshold = 0.01f;

/// Crossfade time when toggling HPF or LPF on/off (ms).
/// A one-pole ramp blends dry↔wet over this window, eliminating activation
/// clicks.
constexpr float kFilterBypassRampMs = 5.f;

// ---------------------------------------------------------------------------
// Mic-mode input HPF (config.json routing.in.*.hpf, Hz)
// ---------------------------------------------------------------------------

/// Cascaded 2nd-order stages → 24 dB/oct Butterworth slope.
constexpr int kMicHpfStages = 2;
constexpr float kMicHpfQ =
    kButterworthQ;                   ///< Butterworth pole Q (maximally flat)
constexpr float kMicHpfFMin = 20.f;  ///< Minimum cutoff when hpf > 0 (Hz)
constexpr float kMicHpfFMax = 300.f; ///< Maximum cutoff (Hz); 0 in config = off

// ---------------------------------------------------------------------------
// Kill switches — crossover frequencies (KillSwitch)
// ---------------------------------------------------------------------------

constexpr float kKillFc0 = 80.f;   // SUB  / KICK band boundary (Hz)
constexpr float kKillFc1 = 200.f;  // KICK / MID  band boundary (Hz)
constexpr float kKillFc2 = 1200.f; // MID  / TOP  band boundary (Hz)
constexpr float kKillCrossoverQ = kButterworthQ; // Butterworth 2nd-order pole Q

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
// Band Trim (BandTrim — 4-band ±3 dB trim, after FilterSection, before
// KillSwitch)
// ---------------------------------------------------------------------------

/// Gain range per band: pot 0.5 → 0 dB, pot 0.0 → -kBandTrimGainDb, pot 1.0 →
/// +kBandTrimGainDb.
constexpr float kBandTrimGainDb = 6.f;

/// Centre frequency for the KICK peaking filter: geometric mean of SUB/KICK
/// boundary (80 Hz) and KICK/MID boundary (200 Hz).
constexpr float kBandTrimKickFreq = 126.f; // sqrt(80 * 200)

/// Centre frequency for the MID peaking filter: geometric mean of KICK/MID (200
/// Hz) and MID/TOP boundary (1200 Hz).
constexpr float kBandTrimMidFreq = 490.f; // sqrt(200 * 1200)

/// Q factor for the KICK peaking band — moderately wide bell.
constexpr float kBandTrimKickQ = 1.0f;

/// Q factor for the MID peaking band — slightly broader bell for a smoother
/// transition.
constexpr float kBandTrimMidQ = 0.7f;

/// Minimum gain change (dB) that triggers a biquad coefficient recompute.
/// Used by BandTrim, GraphicEq, ParametricEq and ChannelStrip — single
/// source of truth so all EQ classes respond consistently to jitter.
constexpr float kEqGainEpsilonDb = 0.05f;

/// Keep the old names as aliases so existing code compiles unchanged until
/// each class is updated to use kEqGainEpsilonDb directly.
/// @deprecated  Use kEqGainEpsilonDb instead.
constexpr float kBandTrimEpsilonDb = kEqGainEpsilonDb;
constexpr float kGEqUpdateEpsilonDb = kEqGainEpsilonDb;

/// Minimum pot-travel change (0–1) that triggers a filter frequency recompute.
/// Used by ParametricEq and FilterSection — prevents unnecessary trig work
/// from ADC jitter on frequency/resonance pots.
constexpr float kPotEpsilon = 0.005f;

// ---------------------------------------------------------------------------
// Graphic EQ (GraphicEq — 12 fixed bands in master bus, after ParametricEq)
// ---------------------------------------------------------------------------

/// Gain range per band: pot 0.5 → 0 dB, pot 1.0 → +range, pot 0.0 → -range.
constexpr float kGEqGainRangeDb = 12.f;

/// Q factor for all 12 peaking bands.
/// √2 ≈ 1.41 is the standard octave-band graphic EQ value (flat summing).
constexpr float kGEqQ = 1.41f;

// ---------------------------------------------------------------------------
// Dub Siren (DubSiren)
// ---------------------------------------------------------------------------

/// Crossfade duration when switching siren presets (ms).
/// Both oscillators run simultaneously; the old one fades out while the new
/// one fades in over this window — eliminates the abrupt timbre/pitch jump.
constexpr float kSirenPresetCrossfadeMs = 200.f;

/// Time for the siren gate amplitude to ramp from 0 to 1 (trigger pressed).
/// Hysteresis band applied to the siren preset selector.
/// A preset change is only accepted when the pot has moved this far past the
/// zone boundary into the new preset — prevents ADC jitter at boundaries from
/// rapidly toggling between two presets and producing a double-siren effect.
/// Each preset zone spans (1.0 / kNumPresets) ≈ 0.125 of pot travel.
/// 0.03 ≈ 24 % of one zone — wide enough to absorb typical jitter.
constexpr float kSirenPresetHysteresis = 0.03f;

constexpr float kSirenGateAttackMs = 5.f;

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

/// Low boundary of the mid band: frequencies below this are excluded in MIDS
/// mode.
constexpr float kFxMidLowFreq = 250.f; // Hz

/// High boundary of the mid band / tops crossover.
constexpr float kFxMidHighFreq = 4000.f; // Hz

/// Butterworth Q for FX send filter transitions (maximally flat, no resonance).
constexpr float kFxFilterQ = kButterworthQ;

/// Master gain scale applied to both the dry output and FX send of the siren.
/// Reduce if the siren is too loud relative to the channel strips.
constexpr float kSirenGainScale = 0.1f;

// ---------------------------------------------------------------------------
// Sample player (UI-triggered one-shots, mixed at the Dub Siren bus point)
// ---------------------------------------------------------------------------

/// Master gain scale for loaded WAV playback (full-scale files sit hotter than
/// the synthesised siren — keep below kSirenGainScale's relative loudness).
constexpr float kSamplerGainScale = 0.35f;

/// Maximum number of audio files (WAV/MP3) loaded from samples/ at boot.
constexpr int kMaxSamples = 32;

/// Fixed name width (including NUL) packed into GUI buffer 11 as ASCII floats.
constexpr int kMaxSampleNameLen = 64;

/// Fade-in / fade-out duration to avoid clicks on trigger and end-of-file.
constexpr float kSamplerFadeMs = 5.f;

/// GUI buffer 10: [folderOk, count, playingSlot, isPlaying, playhead].
constexpr int kGuiSamplerStateSize = 5;

/// GUI buffer 11: kMaxSamples × kMaxSampleNameLen packed ASCII code points.
constexpr int kGuiSamplerNamesSize = kMaxSamples * kMaxSampleNameLen;

// ---------------------------------------------------------------------------
// Master output limiter
// ---------------------------------------------------------------------------

/// Peak ceiling in linear full scale. 0.99 ≈ -0.1 dBFS — matches kClipThreshold
/// headroom so the DAC never receives a hard-clipped sample.
constexpr float kLimiterCeiling = 0.99f;

/// Gain release time (ms) when the signal drops back below the ceiling.
/// Slower release avoids audible pumping on sustained limiting.
constexpr float kLimiterReleaseMs = 100.f;

/// Set to false to bypass the master output limiter (debug only).
constexpr bool kLimiterEnabled = true;

// ---------------------------------------------------------------------------
// Mono fold-down & Air compensation (Master output)
// ---------------------------------------------------------------------------

/// Fold-down gain coefficient when summing L + R into mono.
/// - 0.7071f (~ -3 dB) : Constant power law (AES/EBU pro standard). Preserves
///   perceived acoustic loudness of stereo/side elements (reverbs, delays,
///   panned hats).
/// - 0.5000f (-6 dB)   : Linear voltage average.
constexpr float kMonoFoldDownGain = 0.7071f;

/// When true, enables a subtle high-shelf filter on the mono master output
/// to compensate for comb-filtering phase cancellation in the highs (5k-16kHz).
constexpr bool kMonoAirCompEnabled = true;

/// Frequency of the high-shelf mono air compensation filter (Hz).
constexpr float kMonoAirCompFreqHz = 8000.f;

/// Boost gain (dB) of the high-shelf mono air compensation filter.
/// 1.5 dB gently restores presence without sounding harsh.
constexpr float kMonoAirCompGainDb = 1.5f;

/// Crossfade duration (ms) when switching live between Stereo and Mono.
constexpr float kMonoCrossfadeMs = 20.f;

/// Threshold epsilon for mono/stereo crossfade completion.
constexpr float kCrossfadeEpsilon = 0.001f;

// ---------------------------------------------------------------------------
// FX return routing
// ---------------------------------------------------------------------------

/// When true  : FX returns are injected POST-master (after EQ, filters, kills).
///              The wet signal bypasses all master processing — only masterGain
///              applies. Use this when the effect unit has its own character
///              that should not be coloured by the master chain (HPF, EQ,
///              kills…).
///
/// When false : FX returns are summed PRE-master, entering the full processing
/// chain.
///              Use this when you want kills and EQ to shape the wet return as
///              well.
constexpr bool kFxReturnPostMaster = true;

// ---------------------------------------------------------------------------
// Codec ADC / DAC gains (Bela_setAudioInputGain / Bela_setHpLevel)
// ---------------------------------------------------------------------------

/// ADC input PGA range supported by the codec (dB).
constexpr float kCodecInputGainMinDb = -12.f;
constexpr float kCodecInputGainMaxDb = 10.f;

/// DAC output level range supported by the codec (dB).
constexpr float kCodecOutputGainMinDb = -63.f;
constexpr float kCodecOutputGainMaxDb = 0.f;

// ---------------------------------------------------------------------------
// Bela GUI web interface (sketch.js)
// ---------------------------------------------------------------------------

/// GUI send interval in audio samples (~50 ms @ 44.1 kHz → ~20 fps).
/// Lower rate keeps multi-client WiFi sessions stable on the embedded web
/// server.
constexpr int kGuiUpdateIntervalSamples = 2205;

/// Resend static mapping/config-meta buffers every N GUI ticks (~2 s @ 20 fps).
constexpr int kGuiStaticBufSendDivisor = 40;

/// Float count for GUI buffer 6 (mux, routing, ignoredPots). Must match
/// sketch.js. Layout: [0-4] mux/cal/i2c | [5-7] master outs | [8-9] fx sends |
/// [10-13] vu outs
///         [14-15] fx returns | [16-19] AUX channelL | [20-23] AUX micMode
///         [24-27] AUX hpfHz | [28-31] AUX channelR | [32] masterStereo | [33]
///         ignoredPotsCount | [34+] ignored pairs
constexpr int kGuiConfigMetaHeaderFloats = 34;
constexpr int kGuiConfigMetaSize =
    kGuiConfigMetaHeaderFloats + 64; // 32 ignored pairs max

/// Raw MUX grid for GUI buffer 7: kNumMux × kPotsPerMux (must match
/// HardwareConfig.h).
constexpr int kGuiMuxRawBufSize = 80;

/// CPU die temperature poll interval for the non-RT AuxTask (sysfs read).
/// Keep slow — file I/O must never run in render().
constexpr int kCpuTempPollUs = 2000000; // 2 s

/// Sysfs path for the first thermal zone (millidegrees C). Matches
/// `cat /sys/class/thermal/thermal_zone*/temp` first glob hit on Bela.
constexpr const char *kCpuTempSysfsPath =
    "/sys/class/thermal/thermal_zone0/temp";

// ---------------------------------------------------------------------------
// MCP23017 / I2C fault tolerance
// ---------------------------------------------------------------------------

/// Normal polling interval for the I2C auxiliary task (us).
constexpr unsigned int kMcpPollIntervalUs = 5000;

/// Normal polling interval for the I2C auxiliary task (ms).
constexpr float kMcpPollIntervalMs = 5.0f;

/// Reconnection retry interval in milliseconds when MCP23017 is disconnected.
constexpr unsigned int kMcpReconnectIntervalMs = 1000;

/// Number of consecutive I2C read errors before declaring MCP23017
/// disconnected.
constexpr int kMcpMaxConsecutiveErrors = 5;
