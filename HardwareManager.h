#pragma once
#include <Bela.h>
#include <stdint.h>
#include "HardwareConfig.h"

class HardwareManager {
public:
    HardwareManager();
    ~HardwareManager();

    /** Initialises digital address pins as OUTPUT. */
    bool setup(BelaContext *context);

    /**
     * Must be called once per render() callback.
     * Reads all active MUX analog inputs for the current channel,
     * then advances to the next channel and sets address pins in the last
     * digital frame so the MUX has a full buffer period to settle.
     */
    void scanStep(BelaContext *context);

    /**
     * Returns the normalised value (0.0–1.0) for a given MUX and pot.
     * @param muxId  MUX index  (0 to kActiveMux-1)
     * @param potId  Channel    (0 to kPotsPerMux-1)
     */
    float getPotValue(int muxId, int potId) const;

    /** Convenience overload using a PotRef constant from HardwareConfig.h. */
    float getPotValue(PotRef ref) const { return getPotValue(ref.mux, ref.pot); }

    /** Flat-index accessor kept for internal use: index = muxId * kPotsPerMux + potId. */
    float getPotValue(int index) const;

    /**
     * Returns the pot value snapped to 0.5 when within kSnapRadiusCenter.
     * Use this for EQ/bipolar controls where the centre position means "no effect".
     */
    float getCenteredPotValue(int muxId, int potId) const;
    float getCenteredPotValue(PotRef ref) const { return getCenteredPotValue(ref.mux, ref.pot); }

    // -----------------------------------------------------------------------
    // MCP23017 — I2C GPIO expander (switches)
    // -----------------------------------------------------------------------

    /** Opens the I2C bus and configures MCP23017 port A as inputs with pull-ups. */
    bool initMcp23017();

    /**
     * Reads GPIOA register from MCP23017 and caches the result.
     * Must be called from a non-RT thread (AuxiliaryTask), NOT from render().
     */
    void readMcp23017();

    /**
     * Returns the cached state of a PA pin (0–7).
     * true = switch open (pull-up HIGH), false = switch closed (GND = LOW).
     */
    bool getSwitchState(int pin) const;

    /** Closes the I2C file descriptor. Call from cleanup(). */
    void closeMcp23017();

private:
    static const int kNumMux     = 4;   // Maximum number of MUX supported
    static const int kActiveMux  = 1;   // How many are physically connected — increase as you add MUX
    static const int kPotsPerMux = 16;

    float potValues[kNumMux * kPotsPerMux];
    int   currentChannel;

    const int   addressPins[4]   = {0, 1, 2, 3};  // D0–D3
    const float kScaleRecovery   = 4.096f / 3.3f; // 4.096V ref / 3.3V supply
    // Practical maximum after scaling (pots rarely reach exact rail voltage).
    // Adjust if your hardware returns a different observed maximum.
    const float kPotMax          = 0.997f;
    // Values at or below this threshold are clamped to exactly 0.0.
    // Adjust if your pots rest above 0.0 when fully closed.
    const float kPotMin          = 0.005f;
    // Minimum change required to update a value (suppresses ADC jitter).
    const float kJitterThreshold  = 0.002f;
    // Half-width of the magnetic dead-zone around 0.5 for getCenteredPotValue.
    const float kSnapRadiusCenter = 0.10f;

    /** Writes the 4-bit MUX address to D0–D3 on the given digital frame. */
    void setMuxAddress(BelaContext *context, int frame, int channel);

    // MCP23017 I2C state
    // Change kI2cBus if your Bela routes I2C to a different bus (e.g. "/dev/i2c-2")
    static constexpr const char* kI2cBus      = "/dev/i2c-1";
    static constexpr uint8_t     kMcpAddress  = 0x20; // A0=A1=A2=GND
    int     i2cFd_       = -1;
    uint8_t mcpPortA_    = 0xFF; // cached GPIOA value (0xFF = all HIGH = all open)
};
