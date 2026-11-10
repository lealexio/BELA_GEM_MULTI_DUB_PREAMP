#pragma once
#include "HardwareConfig.h"
#include <Bela.h>
#include <atomic>
#include <stdint.h>

/**
 * Hardware abstraction layer for all physical input devices.
 *
 * Manages:
 *   - Up to kActiveMux multiplexers (7 MUXes, 10 channels each: 0..9).
 *   - One MCP23017 I2C GPIO expander (switches on ports A & B) with auto-scan
 * (0x20..0x27).
 *
 * Threading model (critical — Bela is real-time):
 *   RT thread  (render)       : scanStep(), getPotValue(), getSwitchState()
 *   Non-RT thread (AuxTask)   : readMcp23017()
 *   Never mix these — I2C reads from render() will cause audio dropouts.
 *
 * MUX scan strategy:
 *   Address lines D0..D3 (S0..S3) are driven continuously across audio frames.
 *   After a 16-frame voltage stabilization period (~0.36 ms), all active MUX
 *   analog inputs (A0..A6) are read, and the address advances to the next
 * channel.
 *
 * Pot processing pipeline (scanStep):
 *   raw ADC → × kPotScaleRecovery → clamp [kPotMin, kPotMax] → normalise [0, 1]
 *   → jitter filter (kJitterThreshold) → stored in potValues_[]
 *
 * Usage pattern:
 *   setup()         : call once in Bela setup()
 *   initMcp23017()  : call once in Bela setup() after setup()
 *   scanStep()      : call once per render() callback
 *   get*()          : call anytime from render() after at least one scanStep()
 *   readMcp23017()  : call from a non-RT AuxiliaryTask in a loop
 *   closeMcp23017() : call from Bela cleanup()
 */
class HardwareManager {
public:
  HardwareManager();
  ~HardwareManager();

  /** Configures D0–D3 as digital outputs and initializes MUX channel scanning.
   */
  bool setup(BelaContext *context);

  /**
   * Drives address lines D0..D3 and reads all active MUX inputs after
   * settling time, advancing through channels 0..kPotsPerMux-1.
   * Must be called exactly once at the top of every render() callback.
   */
  void scanStep(BelaContext *context);

  // -----------------------------------------------------------------------
  // Potentiometer accessors (RT-safe — read from potValues_[])
  // -----------------------------------------------------------------------

  /**
   * Returns the normalised pot value [0.0, 1.0].
   * @param muxId  MUX index  (0 … kActiveMux-1)
   * @param potId  Channel    (0 … kPotsPerMux-1)
   */
  float getPotValue(int muxId, int potId) const;

  /**
   * Overload accepting a PotRef from HardwareConfig.h.
   * Applies centered snap (getCenteredPotValue) when ref.centered is true,
   * then applies reversed rotation when ref.reversed is true.
   */
  float getPotValue(PotRef ref) const {
    float v = ref.centered ? getCenteredPotValue(ref.mux, ref.pot)
                           : getPotValue(ref.mux, ref.pot);
    return ref.reversed ? 1.f - v : v;
  }

  /**
   * Returns a linear-mapped pot value centred at 0.5 with a dead-zone.
   * Values within kSnapRadiusCenter of 0.5 return exactly 0.5.
   * Outside this range, the response is linear.
   */
  float getCenteredPotValue(int muxId, int potId) const;

  /** Overload accepting a PotRef (reversed flag applied after snap). */
  float getCenteredPotValue(PotRef ref) const {
    float v = getCenteredPotValue(ref.mux, ref.pot);
    return ref.reversed ? 1.f - v : v;
  }

  // -----------------------------------------------------------------------
  // Switch accessors (MCP23017 — RT-safe, reads from atomic registers)
  // -----------------------------------------------------------------------

  /** Opens I2C bus and probes/scans for MCP23017 across 0x20..0x27 with
   * pull-ups.
   *  @param verbose If true, errors and scan progress are logged.
   *  @return true on success, false if chip is not detected.
   */
  bool initMcp23017(bool verbose = true);

  /** Returns true if MCP23017 was detected and is currently operational. */
  bool isMcpConnected() const { return mcpConnected_.load(); }

  /**
   * Reads GPIOA & GPIOB from the MCP23017 and caches results atomically.
   * Non-RT safe — must be called from a non-RT AuxiliaryTask only.
   */
  void readMcp23017();

  /**
   * Returns the raw state of one pin (0–7) on port A.
   * true  = HIGH (pull-up, switch open)
   * false = LOW  (switch closed to GND)
   */
  bool getSwitchState(int pin) const;

  /**
   * Returns the raw state of one pin (0–7) on port B.
   * true  = HIGH (pull-up, switch open)
   * false = LOW  (switch closed to GND)
   */
  bool getSwitchStateB(int pin) const;

  /**
   * Convenience overload for a SwitchRef from HardwareConfig.h.
   * Dispatches to port A or B based on sw.portB, then applies the reversed
   * flag: reversed = false → active when pin is LOW  (button pressed to GND)
   *   reversed = true  → active when pin is HIGH (normally-open wiring)
   * Returns false if MCP23017 is disconnected (all switches inactive).
   */
  bool getSwitchState(const SwitchRef &sw) const {
    if (!mcpConnected_.load())
      return false;
    bool raw = sw.portB ? getSwitchStateB(sw.pin) : getSwitchState(sw.pin);
    return sw.reversed ? raw : !raw;
  }

  /** Closes the I2C file descriptor. Call from Bela cleanup(). */
  void closeMcp23017();

  // -----------------------------------------------------------------------
  // Clip LED control (MCP23017 outputs — RT-safe signal from render)
  // -----------------------------------------------------------------------

  enum ClipChannel {
    CLIP_MASTER = 0,
    CLIP_AUX1,
    CLIP_AUX2,
    CLIP_AUX3,
    CLIP_AUX4,
    kNumClipChannels
  };

  /**
   * RT-safe clip notification: sets an atomic flag consumed by the I2C
   * auxiliary task. Safe to call from render() at audio frame rate (zero
   * blocking, lock-free).
   */
  void triggerClip(ClipChannel ch) {
    if (ch >= 0 && ch < kNumClipChannels)
      clipPending_[ch].store(true, std::memory_order_relaxed);
  }

  /**
   * Returns true once the startup LED animation has completed (or if no LEDs /
   * no MCP). RT-safe: atomic relaxed load.
   */
  bool isStartupAnimationDone() const {
    return startupAnimationDone_.load(std::memory_order_relaxed);
  }

private:
  float potValues_[kNumMux * kPotsPerMux];
  int currentChannel_ = 0;
  int sampleCount_ = 0;

  static constexpr int addressPins_[4] = {0, 1, 2, 3}; // D0–D3 (S0..S3)

  bool probeAndInitMcp(uint8_t addr);

  int i2cFd_ = -1;
  std::atomic<bool> mcpConnected_{false};
  int mcpConsecutiveErrors_ = 0;
  uint8_t activeAddress_ = 0;
  std::atomic<uint8_t> mcpPortA_{
      0xFF}; // cached GPIOA register (0xFF = all HIGH = all open)
  std::atomic<uint8_t> mcpPortB_{0xFF}; // cached GPIOB register

  // Clip LED output state (managed by readMcp23017 in the non-RT AuxTask)
  std::atomic<bool> clipPending_[kNumClipChannels];
  int clipHoldTicks_[kNumClipChannels] = {};
  uint8_t currentOlatA_ = 0x00;
  uint8_t currentOlatB_ = 0x00;
  bool hasClipOutputs_ = false;

  // Startup LED animation state (managed by readMcp23017 in the non-RT AuxTask)
  std::atomic<bool> startupAnimationDone_{false};
  int startupAnimationTick_ = 0;
  int startupAnimationStep_ = 0;
};
