#pragma once
#include <Bela.h>

class HardwareManager {
public:
    HardwareManager();
    ~HardwareManager();

    /** Initialises digital address pins as OUTPUT. */
    bool setup(BelaContext *context);

    /**
     * Must be called once per render() callback.
     * Reads the analog value for the channel set in the previous render,
     * then advances to the next channel and sets address pins in the last
     * digital frame so the MUX has a full buffer period to settle.
     */
    void scanStep(BelaContext *context);

    /** Returns the latest raw value (0.0–1.0) for the given pot index. */
    float getPotValue(int index) const {
        return (index >= 0 && index < kNumMux * kPotsPerMux) ? potValues[index] : 0.0f;
    }

private:
    static const int kNumMux     = 4;
    static const int kPotsPerMux = 16;

    float potValues[kNumMux * kPotsPerMux];
    int   currentChannel;

    const int   addressPins[4]  = {0, 1, 2, 3};  // D0–D3
    const float kScaleRecovery  = 4.096f / 3.3f; // 4.096V ref / 3.3V supply

    /** Writes the 4-bit MUX address to D0–D3 on the given digital frame. */
    void setMuxAddress(BelaContext *context, int frame, int channel);
};
