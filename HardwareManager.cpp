#include "HardwareManager.h"
#include <cmath>
#include <fcntl.h>
#include <unistd.h>
#include <sys/ioctl.h>
#include <linux/i2c-dev.h>

// MCP23017 register addresses (BANK=0, default)
static constexpr uint8_t MCP_IODIRA = 0x00; // I/O direction port A (1=input)
static constexpr uint8_t MCP_GPPUA  = 0x0C; // Pull-up resistors port A
static constexpr uint8_t MCP_GPIOA  = 0x12; // GPIO read port A

HardwareManager::HardwareManager()
    : currentChannel(0)
{
    for(int i = 0; i < kNumMux * kPotsPerMux; i++) potValues[i] = 0.0f;
}

HardwareManager::~HardwareManager() {}

bool HardwareManager::setup(BelaContext *context) {
    for(int i = 0; i < 4; i++)
        pinMode(context, 0, addressPins[i], OUTPUT);

    // Prime the MUX address for channel 0 before the first render
    setMuxAddress(context, 0, currentChannel);
    return true;
}

void HardwareManager::scanStep(BelaContext *context) {
    // Read all active MUX inputs for the channel set in the previous render
    for(int m = 0; m < kActiveMux; m++) {
        float rawValue = analogRead(context, 0, m) * kScaleRecovery;

        // Clamp to [0.0, 1.0] with min/max calibration
        if(rawValue <= kPotMin) rawValue = 0.0f;
        if(rawValue >  1.0f)   rawValue = 1.0f;
        rawValue = rawValue / kPotMax;
        if(rawValue > 1.0f)    rawValue = 1.0f;

        int index = m * kPotsPerMux + currentChannel;
        // Only update if the change exceeds the jitter threshold
        if(fabsf(rawValue - potValues[index]) >= kJitterThreshold)
            potValues[index] = rawValue;
    }

    // Advance to the next channel and set address pins on the last frame
    currentChannel = (currentChannel + 1) % kPotsPerMux;
    setMuxAddress(context, context->digitalFrames - 1, currentChannel);
}

float HardwareManager::getPotValue(int muxId, int potId) const {
    if(muxId < 0 || muxId >= kNumMux || potId < 0 || potId >= kPotsPerMux)
        return 0.0f;
    return potValues[muxId * kPotsPerMux + potId];
}

float HardwareManager::getPotValue(int index) const {
    return (index >= 0 && index < kNumMux * kPotsPerMux) ? potValues[index] : 0.0f;
}

float HardwareManager::getCenteredPotValue(int muxId, int potId) const {
    float v = getPotValue(muxId, potId);
    return (fabsf(v - 0.5f) <= kSnapRadiusCenter) ? 0.5f : v;
}

void HardwareManager::setMuxAddress(BelaContext *context, int frame, int channel) {
    for(int bit = 0; bit < 4; bit++)
        digitalWrite(context, frame, addressPins[bit], (channel >> bit) & 1);
}

// ---------------------------------------------------------------------------
// MCP23017
// ---------------------------------------------------------------------------

bool HardwareManager::initMcp23017() {
    i2cFd_ = open(kI2cBus, O_RDWR);
    if(i2cFd_ < 0) {
        rt_fprintf(stderr, "HardwareManager: cannot open I2C bus %s\n", kI2cBus);
        return false;
    }
    if(ioctl(i2cFd_, I2C_SLAVE, kMcpAddress) < 0) {
        rt_fprintf(stderr, "HardwareManager: cannot set MCP23017 address 0x%02X\n", kMcpAddress);
        return false;
    }

    // Set all PA pins as inputs
    uint8_t buf[2] = {MCP_IODIRA, 0xFF};
    if(write(i2cFd_, buf, 2) != 2) {
        rt_fprintf(stderr, "HardwareManager: IODIRA write failed\n");
        return false;
    }

    // Enable pull-ups on all PA pins
    buf[0] = MCP_GPPUA; buf[1] = 0xFF;
    if(write(i2cFd_, buf, 2) != 2) {
        rt_fprintf(stderr, "HardwareManager: GPPUA write failed\n");
        return false;
    }

    rt_printf("HardwareManager: MCP23017 initialised at 0x%02X on %s\n", kMcpAddress, kI2cBus);
    return true;
}

void HardwareManager::readMcp23017() {
    if(i2cFd_ < 0) return;

    // Select GPIOA register then read its value
    uint8_t reg = MCP_GPIOA;
    if(write(i2cFd_, &reg, 1) == 1)
        read(i2cFd_, &mcpPortA_, 1);
}

bool HardwareManager::getSwitchState(int pin) const {
    if(pin < 0 || pin > 7) return false;
    // Bit is HIGH (1) when switch is open (pull-up), LOW (0) when closed
    return (mcpPortA_ >> pin) & 1;
}

void HardwareManager::closeMcp23017() {
    if(i2cFd_ >= 0) {
        close(i2cFd_);
        i2cFd_ = -1;
    }
}
