#pragma once
#include <Bela.h>
#include <stdint.h>
#include "HardwareConfig.h"

/**
 * Hardware abstraction layer for all physical input devices.
 *
 * Manages:
 *   - Up to kActiveMux CD74HC4067 multiplexers (potentiometers, 16 ch each).
 *   - One MCP23017 I2C GPIO expander (switches on port A).
 *
 * Threading model (critical — Bela is real-time):
 *   RT thread  (render)       : scanStep(), getPotValue(), getSwitchState()
 *   Non-RT thread (AuxTask)   : readMcp23017()
 *   Never mix these — I2C reads from render() will cause audio dropouts.
 *
 * MUX scan strategy:
 *   One MUX channel is read per render() callback (state machine in scanStep()).
 *   A full 16-channel scan therefore takes 16 render blocks (~5.8 ms at 44.1 kHz
 *   with 16-frame blocks). This is the standard Bela pattern for real-time ADC reads.
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

    /** Configures D0–D3 as digital outputs and primes the first MUX address. */
    bool setup(BelaContext* context);

    /**
     * Reads all active MUX inputs for the current channel, then advances
     * to the next channel and pre-loads its address on the last digital frame.
     * Must be called exactly once at the top of every render() callback.
     */
    void scanStep(BelaContext* context);

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
     * Applies reversed rotation automatically when ref.reversed is true.
     */
    float getPotValue(PotRef ref) const {
        float v = getPotValue(ref.mux, ref.pot);
        return ref.reversed ? 1.f - v : v;
    }

    /**
     * Returns the pot value snapped to exactly 0.5 when within kSnapRadiusCenter.
     * Use for EQ / bipolar controls where the centre position means "no effect".
     */
    float getCenteredPotValue(int muxId, int potId) const;

    /** Overload accepting a PotRef (reversed flag applied after snap). */
    float getCenteredPotValue(PotRef ref) const {
        float v = getCenteredPotValue(ref.mux, ref.pot);
        return ref.reversed ? 1.f - v : v;
    }

    // -----------------------------------------------------------------------
    // Switch accessors (MCP23017 — RT-safe, reads from cached mcpPortA_)
    // -----------------------------------------------------------------------

    /** Opens the I2C bus and configures MCP23017 port A as inputs with pull-ups. */
    bool initMcp23017();

    /**
     * Reads GPIOA from the MCP23017 and caches the result in mcpPortA_.
     * Non-RT safe — must be called from a non-RT AuxiliaryTask only.
     */
    void readMcp23017();

    /**
     * Returns the raw state of a PA pin (0–7).
     * true  = switch open  (pull-up HIGH)
     * false = switch closed (pulled to GND)
     */
    bool getSwitchState(int pin) const;

    /**
     * Convenience overload for a SwitchRef from HardwareConfig.h.
     * Returns true when the switch is "active", honouring the reversed flag:
     *   reversed = false → active when pin is LOW  (button pressed to GND)
     *   reversed = true  → active when pin is HIGH (normally-open wiring)
     */
    bool getSwitchState(const SwitchRef& sw) const {
        bool raw = getSwitchState(sw.pin);
        return sw.reversed ? raw : !raw;
    }

    /** Closes the I2C file descriptor. Call from Bela cleanup(). */
    void closeMcp23017();

private:
    float potValues_[kNumMux * kPotsPerMux];
    int   currentChannel_ = 0;

    static constexpr int addressPins_[4] = {0, 1, 2, 3}; // D0–D3

    void setMuxAddress(BelaContext* context, int frame, int channel);

    int     i2cFd_    = -1;
    uint8_t mcpPortA_ = 0xFF; // cached GPIOA register (0xFF = all HIGH = all open)
};
