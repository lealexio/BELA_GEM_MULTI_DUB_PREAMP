#include "HardwareManager.h"
#include "SoftwareConfig.h"
#include <cmath>
#include <fcntl.h>
#include <unistd.h>
#include <sys/ioctl.h>
#include <linux/i2c-dev.h>

// MCP23017 register addresses (BANK=0, default)
static constexpr uint8_t MCP_IODIRA = 0x00; // I/O direction port A (1=input)
static constexpr uint8_t MCP_IODIRB = 0x01; // I/O direction port B (1=input)
static constexpr uint8_t MCP_GPPUA  = 0x0C; // Pull-up resistors port A
static constexpr uint8_t MCP_GPPUB  = 0x0D; // Pull-up resistors port B
static constexpr uint8_t MCP_GPIOA  = 0x12; // GPIO read port A
static constexpr uint8_t MCP_GPIOB  = 0x13; // GPIO read port B

// Required for constexpr static array members (ODR-used)
constexpr int HardwareManager::addressPins_[4];

HardwareManager::HardwareManager() {
    for(int i = 0; i < kNumMux * kPotsPerMux; i++) potValues_[i] = 0.f;
}

HardwareManager::~HardwareManager() {}

bool HardwareManager::setup(BelaContext* context) {
    for(int i = 0; i < 4; i++)
        pinMode(context, 0, addressPins_[i], OUTPUT);
    setMuxAddress(context, 0, currentChannel_);
    return true;
}

void HardwareManager::scanStep(BelaContext* context) {
    // Read all active MUX inputs for the channel address set in the previous render
    for(int m = 0; m < kActiveMux; m++) {
        float raw = analogRead(context, 0, m) * kPotScaleRecovery;

        // Clamp with calibrated min/max
        if(raw <= kPotMin) raw = 0.f;
        raw = raw / kPotMax;
        if(raw > 1.f) raw = 1.f;

        // Snap to hard 0 / 1 at the ends of travel
        if(raw <= kSnapRadiusEdge)        raw = 0.f;
        else if(raw >= 1.f - kSnapRadiusEdge) raw = 1.f;

        int idx = m * kPotsPerMux + currentChannel_;
        if(fabsf(raw - potValues_[idx]) >= kJitterThreshold)
            potValues_[idx] = raw;
    }

    // Advance channel and pre-load address for next render
    currentChannel_ = (currentChannel_ + 1) % kPotsPerMux;
    setMuxAddress(context, context->digitalFrames - 1, currentChannel_);
}

float HardwareManager::getPotValue(int muxId, int potId) const {
    if(muxId < 0 || muxId >= kNumMux || potId < 0 || potId >= kPotsPerMux)
        return 0.f;
    return potValues_[muxId * kPotsPerMux + potId];
}

float HardwareManager::getCenteredPotValue(int muxId, int potId) const {
    float v = getPotValue(muxId, potId);
    return (fabsf(v - 0.5f) <= kSnapRadiusCenter) ? 0.5f : v;
}

void HardwareManager::setMuxAddress(BelaContext* context, int frame, int channel) {
    for(int bit = 0; bit < 4; bit++)
        digitalWrite(context, frame, addressPins_[bit], (channel >> bit) & 1);
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

    uint8_t buf[2] = {MCP_IODIRA, 0xFF};
    if(write(i2cFd_, buf, 2) != 2) {
        rt_fprintf(stderr, "HardwareManager: IODIRA write failed\n");
        return false;
    }
    buf[0] = MCP_IODIRB; buf[1] = 0xFF;
    if(write(i2cFd_, buf, 2) != 2) {
        rt_fprintf(stderr, "HardwareManager: IODIRB write failed\n");
        return false;
    }
    buf[0] = MCP_GPPUA; buf[1] = 0xFF;
    if(write(i2cFd_, buf, 2) != 2) {
        rt_fprintf(stderr, "HardwareManager: GPPUA write failed\n");
        return false;
    }
    buf[0] = MCP_GPPUB; buf[1] = 0xFF;
    if(write(i2cFd_, buf, 2) != 2) {
        rt_fprintf(stderr, "HardwareManager: GPPUB write failed\n");
        return false;
    }

    rt_printf("HardwareManager: MCP23017 initialised at 0x%02X on %s\n",
              kMcpAddress, kI2cBus);
    return true;
}

void HardwareManager::readMcp23017() {
    if(i2cFd_ < 0) return;
    uint8_t reg = MCP_GPIOA;
    if(write(i2cFd_, &reg, 1) == 1)
        read(i2cFd_, &mcpPortA_, 1);
    reg = MCP_GPIOB;
    if(write(i2cFd_, &reg, 1) == 1)
        read(i2cFd_, &mcpPortB_, 1);
}

bool HardwareManager::getSwitchState(int pin) const {
    if(pin < 0 || pin > 7) return false;
    return (mcpPortA_ >> pin) & 1;
}

bool HardwareManager::getSwitchStateB(int pin) const {
    if(pin < 0 || pin > 7) return false;
    return (mcpPortB_ >> pin) & 1;
}

void HardwareManager::closeMcp23017() {
    if(i2cFd_ >= 0) {
        close(i2cFd_);
        i2cFd_ = -1;
    }
}
