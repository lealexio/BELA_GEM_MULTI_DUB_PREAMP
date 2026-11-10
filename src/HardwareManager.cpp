#include "HardwareManager.h"
#include "SoftwareConfig.h"
#include <algorithm>
#include <cmath>
#include <fcntl.h>
#include <linux/i2c-dev.h>
#include <sys/ioctl.h>
#include <unistd.h>

// MCP23017 register addresses (BANK=0, default)
static constexpr uint8_t MCP_IODIRA = 0x00; // I/O direction port A (1=input)
static constexpr uint8_t MCP_IODIRB = 0x01; // I/O direction port B (1=input)
static constexpr uint8_t MCP_GPPUA = 0x0C;  // Pull-up resistors port A
static constexpr uint8_t MCP_GPPUB = 0x0D;  // Pull-up resistors port B
static constexpr uint8_t MCP_GPIOA = 0x12;  // GPIO read port A
static constexpr uint8_t MCP_GPIOB = 0x13;  // GPIO read port B
static constexpr uint8_t MCP_OLATA = 0x14;  // Output Latch port A
static constexpr uint8_t MCP_OLATB = 0x15;  // Output Latch port B

// Required for constexpr static array members (ODR-used)
constexpr int HardwareManager::addressPins_[4];

HardwareManager::HardwareManager() {
  for (int i = 0; i < kNumMux * kPotsPerMux; i++)
    potValues_[i] = 0.f;
  for (int i = 0; i < kNumClipChannels; i++) {
    clipPending_[i].store(false);
    clipHoldTicks_[i] = 0;
  }
  startupAnimationDone_.store(false);
  startupAnimationTick_ = 0;
  startupAnimationStep_ = 0;
  currentChannel_ = 0;
  sampleCount_ = 0;
}

HardwareManager::~HardwareManager() { closeMcp23017(); }

bool HardwareManager::setup(BelaContext *context) {
  if (context->analogInChannels < (unsigned int)kActiveMux) {
    rt_printf("HardwareManager: WARNING: only %u analog input channels active, "
              "but kActiveMux is %d!\n",
              context->analogInChannels, kActiveMux);
    rt_printf("                          Enable at least %d analog inputs in "
              "Bela IDE Project Settings (or pass -C 8).\n",
              kActiveMux);
  }

  for (int i = 0; i < 4; i++) {
    pinMode(context, 0, addressPins_[i], OUTPUT);
  }
  currentChannel_ = 0;
  sampleCount_ = 0;

  rt_printf("HardwareManager: %d multiplexers configured (%d channels each, "
            "S0..S3 on D0..D3)\n",
            kActiveMux, kPotsPerMux);
  return true;
}

void HardwareManager::scanStep(BelaContext *context) {
  if (context->analogFrames == 0 || context->analogInChannels < 1)
    return;
  int analogFrameRatio = context->audioFrames / context->analogFrames;
  if (analogFrameRatio <= 0)
    analogFrameRatio = 1;

  unsigned int numFrames = context->audioFrames;
  if (context->digitalFrames > 0 && context->digitalFrames < numFrames)
    numFrames = context->digitalFrames;

  for (unsigned int n = 0; n < numFrames; n++) {
    // Continuous driving of address lines S0..S3 with the current channel
    // (0..9)
    digitalWriteOnce(context, n, addressPins_[0], (currentChannel_ >> 0) & 1);
    digitalWriteOnce(context, n, addressPins_[1], (currentChannel_ >> 1) & 1);
    digitalWriteOnce(context, n, addressPins_[2], (currentChannel_ >> 2) & 1);
    digitalWriteOnce(context, n, addressPins_[3], (currentChannel_ >> 3) & 1);

    sampleCount_++;

    // Leave 16 audio frames (~0.36 ms) for the multiplexers to settle voltage
    if (sampleCount_ >= 16 && (n % analogFrameRatio == 0)) {
      unsigned int analogFrame = n / analogFrameRatio;
      if (analogFrame >= context->analogFrames)
        analogFrame = context->analogFrames - 1;

      for (int m = 0; m < kActiveMux && m < (int)context->analogInChannels;
           m++) {
        float raw = analogRead(context, analogFrame, m) * kPotScaleRecovery;

        // Clamp with calibrated min/max
        if (raw <= kPotMin)
          raw = 0.f;
        raw = raw / kPotMax;
        if (raw > 1.f)
          raw = 1.f;

        // Snap to hard 0 / 1 at the ends of travel
        if (raw <= kSnapRadiusEdge)
          raw = 0.f;
        else if (raw >= 1.f - kSnapRadiusEdge)
          raw = 1.f;

        int idx = m * kPotsPerMux + currentChannel_;
        if (fabsf(raw - potValues_[idx]) >= kJitterThreshold)
          potValues_[idx] = raw;
      }

      // Advance to next channel (0 to kPotsPerMux - 1)
      currentChannel_ = (currentChannel_ + 1) % kPotsPerMux;
      sampleCount_ = 0;
    }
  }
}

float HardwareManager::getPotValue(int muxId, int potId) const {
  if (muxId < 0 || muxId >= kNumMux || potId < 0 || potId >= kPotsPerMux)
    return 0.f;
  return potValues_[muxId * kPotsPerMux + potId];
}

float HardwareManager::getCenteredPotValue(int muxId, int potId) const {
  float v = getPotValue(muxId, potId);
  float delta = v - 0.5f;
  if (fabsf(delta) <= kSnapRadiusCenter) {
    return 0.5f;
  }
  float sign = (delta > 0.f) ? 1.f : -1.f;
  float scale = 0.5f / (0.5f - kSnapRadiusCenter);
  return 0.5f + sign * (fabsf(delta) - kSnapRadiusCenter) * scale;
}

// ---------------------------------------------------------------------------
// MCP23017
// ---------------------------------------------------------------------------

bool HardwareManager::probeAndInitMcp(uint8_t addr) {
  if (i2cFd_ < 0)
    return false;
  if (ioctl(i2cFd_, I2C_SLAVE, addr) < 0)
    return false;

  // By default, ALL 16 pins are inputs (1 = input) with pull-up enabled (1 =
  // pull-up). Pins are ONLY configured as outputs (0 = output) if explicitly
  // defined in config.json.
  uint8_t iodirA = 0xFF;
  uint8_t iodirB = 0xFF;
  uint8_t initOlatA = 0x00;
  uint8_t initOlatB = 0x00;

  const ClipLedRef *refs[kNumClipChannels] = {&CLIP_LED_MASTER, &CLIP_LED_AUX1,
                                              &CLIP_LED_AUX2, &CLIP_LED_AUX3,
                                              &CLIP_LED_AUX4};

  hasClipOutputs_ = false;
  for (int i = 0; i < kNumClipChannels; ++i) {
    const ClipLedRef *r = refs[i];
    if (r && r->enabled && r->pin >= 0 && r->pin <= 7) {
      hasClipOutputs_ = true;
      uint8_t bit = (1 << r->pin);
      if (!r->portB) {
        iodirA &= ~bit; // 0 = output
        if (r->activeLow)
          initOlatA |= bit; // inactive = HIGH
      } else {
        iodirB &= ~bit; // 0 = output
        if (r->activeLow)
          initOlatB |= bit; // inactive = HIGH
      }
    }
  }

  uint8_t gppuA = iodirA; // Only enable pull-up on inputs
  uint8_t gppuB = iodirB;

  // Set IODIRA & IODIRB
  uint8_t buf[2];
  buf[0] = MCP_IODIRA;
  buf[1] = iodirA;
  if (write(i2cFd_, buf, 2) != 2)
    return false;

  buf[0] = MCP_IODIRB;
  buf[1] = iodirB;
  if (write(i2cFd_, buf, 2) != 2)
    return false;

  // Set GPPUA & GPPUB
  buf[0] = MCP_GPPUA;
  buf[1] = gppuA;
  if (write(i2cFd_, buf, 2) != 2)
    return false;

  buf[0] = MCP_GPPUB;
  buf[1] = gppuB;
  if (write(i2cFd_, buf, 2) != 2)
    return false;

  // If any output is active, initialise OLATA and OLATB to inactive (LEDs off)
  if (hasClipOutputs_) {
    buf[0] = MCP_OLATA;
    buf[1] = initOlatA;
    if (write(i2cFd_, buf, 2) != 2)
      return false;
    currentOlatA_ = initOlatA;

    buf[0] = MCP_OLATB;
    buf[1] = initOlatB;
    if (write(i2cFd_, buf, 2) != 2)
      return false;
    currentOlatB_ = initOlatB;

    startupAnimationDone_.store(false);
    startupAnimationTick_ = 0;
    startupAnimationStep_ = 0;
  } else {
    startupAnimationDone_.store(true);
  }

  return true;
}

bool HardwareManager::initMcp23017(bool verbose) {
  if (i2cFd_ < 0) {
    i2cFd_ = open(kI2cBus, O_RDWR);
    if (i2cFd_ < 0) {
      if (verbose)
        rt_fprintf(stderr, "HardwareManager: cannot open I2C bus %s\n",
                   kI2cBus);
      startupAnimationDone_.store(true);
      return false;
    }
  }

  mcpConnected_.store(false);
  mcpConsecutiveErrors_ = 0;

  // First try the configured or previously active address
  uint8_t target = activeAddress_ ? activeAddress_ : kMcpAddress;
  bool found = false;
  if (probeAndInitMcp(target)) {
    activeAddress_ = target;
    kMcpAddress = target;
    found = true;
  } else {
    if (verbose) {
      rt_printf("HardwareManager: MCP23017 not detected at 0x%02X, scanning "
                "0x20..0x27...\n",
                target);
    }
    for (uint8_t a = 0x20; a <= 0x27; ++a) {
      if (a == target)
        continue;
      if (probeAndInitMcp(a)) {
        activeAddress_ = a;
        kMcpAddress = a;
        found = true;
        break;
      }
    }
  }

  if (!found) {
    if (verbose) {
      rt_fprintf(
          stderr,
          "HardwareManager: MCP23017 not detected on %s (tested 0x20..0x27)\n",
          kI2cBus);
    }
    close(i2cFd_);
    i2cFd_ = -1;
    startupAnimationDone_.store(true);
    return false;
  }

  mcpConnected_.store(true);
  mcpConsecutiveErrors_ = 0;
  rt_printf("HardwareManager: MCP23017 initialised at 0x%02X on %s (pull-ups "
            "enabled on ports A & B)\n",
            activeAddress_, kI2cBus);
  return true;
}

void HardwareManager::readMcp23017() {
  if (!mcpConnected_.load() || i2cFd_ < 0)
    return;
  uint8_t regA = MCP_GPIOA;
  uint8_t valA = 0xFF;
  uint8_t regB = MCP_GPIOB;
  uint8_t valB = 0xFF;

  bool ok = true;
  if (write(i2cFd_, &regA, 1) != 1 || read(i2cFd_, &valA, 1) != 1) {
    ok = false;
  }
  if (ok && (write(i2cFd_, &regB, 1) != 1 || read(i2cFd_, &valB, 1) != 1)) {
    ok = false;
  }

  if (ok) {
    mcpPortA_.store(valA);
    mcpPortB_.store(valB);
    mcpConsecutiveErrors_ = 0;

    // Process clip LED outputs if any are configured
    if (hasClipOutputs_) {
      const ClipLedRef *refs[kNumClipChannels] = {
          &CLIP_LED_MASTER, &CLIP_LED_AUX1, &CLIP_LED_AUX2, &CLIP_LED_AUX3,
          &CLIP_LED_AUX4};

      uint8_t newOlatA = currentOlatA_;
      uint8_t newOlatB = currentOlatB_;

      if (!startupAnimationDone_.load(std::memory_order_relaxed)) {
        // --- Startup LED animation: ping-pong scan sequence (2 round-trips)
        // --- Sequence: MASTER -> AUX1 -> AUX2 -> AUX3 -> AUX4 -> AUX3 -> AUX2
        // -> AUX1 (x2) -> MASTER
        static const ClipChannel kAnimationSeq[17] = {
            // 1er aller-retour
            CLIP_MASTER, CLIP_AUX1, CLIP_AUX2, CLIP_AUX3, CLIP_AUX4, CLIP_AUX3,
            CLIP_AUX2, CLIP_AUX1,
            // 2eme aller-retour
            CLIP_MASTER, CLIP_AUX1, CLIP_AUX2, CLIP_AUX3, CLIP_AUX4, CLIP_AUX3,
            CLIP_AUX2, CLIP_AUX1,
            // Verrouillage final sur Master
            CLIP_MASTER};
        constexpr int kTotalAnimSteps = 17;
        const int ticksPerStep =
            (int)(kStartupLedStepMs / 5.0f > 1.0f ? kStartupLedStepMs / 5.0f
                                                  : 1.0f);

        ClipChannel activeCh = kAnimationSeq[startupAnimationStep_];

        for (int i = 0; i < kNumClipChannels; ++i) {
          const ClipLedRef *r = refs[i];
          if (!r || !r->enabled || r->pin < 0 || r->pin > 7)
            continue;

          bool active = (i == (int)activeCh);
          bool pinHigh = r->activeLow ? !active : active;
          uint8_t bit = (1 << r->pin);

          if (!r->portB) {
            if (pinHigh)
              newOlatA |= bit;
            else
              newOlatA &= ~bit;
          } else {
            if (pinHigh)
              newOlatB |= bit;
            else
              newOlatB &= ~bit;
          }
        }

        if (++startupAnimationTick_ >= ticksPerStep) {
          startupAnimationTick_ = 0;
          if (++startupAnimationStep_ >= kTotalAnimSteps) {
            // Animation complete: turn off all LEDs and mark done
            for (int i = 0; i < kNumClipChannels; ++i) {
              const ClipLedRef *r = refs[i];
              if (!r || !r->enabled || r->pin < 0 || r->pin > 7)
                continue;
              bool pinHigh = r->activeLow ? true : false;
              uint8_t bit = (1 << r->pin);
              if (!r->portB) {
                if (pinHigh)
                  newOlatA |= bit;
                else
                  newOlatA &= ~bit;
              } else {
                if (pinHigh)
                  newOlatB |= bit;
                else
                  newOlatB &= ~bit;
              }
            }
            startupAnimationDone_.store(true, std::memory_order_release);
          }
        }
      } else {
        // --- Normal clip LED monitoring ---
        const int holdTicks =
            (int)(kClipLedHoldMs / 5.0f > 1.0f ? kClipLedHoldMs / 5.0f : 1.0f);

        for (int i = 0; i < kNumClipChannels; ++i) {
          const ClipLedRef *r = refs[i];
          if (!r || !r->enabled || r->pin < 0 || r->pin > 7)
            continue;

          if (clipPending_[i].exchange(false, std::memory_order_relaxed)) {
            clipHoldTicks_[i] = holdTicks;
          } else if (clipHoldTicks_[i] > 0) {
            clipHoldTicks_[i]--;
          }

          bool active = (clipHoldTicks_[i] > 0);
          bool pinHigh = r->activeLow ? !active : active;
          uint8_t bit = (1 << r->pin);

          if (!r->portB) {
            if (pinHigh)
              newOlatA |= bit;
            else
              newOlatA &= ~bit;
          } else {
            if (pinHigh)
              newOlatB |= bit;
            else
              newOlatB &= ~bit;
          }
        }
      }

      // Only write to I2C if the output latch state has changed
      if (newOlatA != currentOlatA_) {
        uint8_t wBuf[2] = {MCP_OLATA, newOlatA};
        if (write(i2cFd_, wBuf, 2) == 2) {
          currentOlatA_ = newOlatA;
        }
      }
      if (newOlatB != currentOlatB_) {
        uint8_t wBuf[2] = {MCP_OLATB, newOlatB};
        if (write(i2cFd_, wBuf, 2) == 2) {
          currentOlatB_ = newOlatB;
        }
      }
    }
  } else {
    mcpConsecutiveErrors_++;
    if (mcpConsecutiveErrors_ >= kMcpMaxConsecutiveErrors) {
      rt_fprintf(stderr, "HardwareManager: MCP23017 connection lost\n");
      closeMcp23017();
    }
  }
}

bool HardwareManager::getSwitchState(int pin) const {
  if (!mcpConnected_.load() || pin < 0 || pin > 7)
    return false;
  return (mcpPortA_.load() >> pin) & 1;
}

bool HardwareManager::getSwitchStateB(int pin) const {
  if (!mcpConnected_.load() || pin < 0 || pin > 7)
    return false;
  return (mcpPortB_.load() >> pin) & 1;
}

void HardwareManager::closeMcp23017() {
  startupAnimationDone_.store(true);
  if (i2cFd_ >= 0) {
    if (hasClipOutputs_) {
      uint8_t buf[2];
      buf[0] = MCP_OLATA;
      buf[1] = 0x00;
      write(i2cFd_, buf, 2);
      buf[0] = MCP_OLATB;
      buf[1] = 0x00;
      write(i2cFd_, buf, 2);
    }
    close(i2cFd_);
    i2cFd_ = -1;
  }
  mcpConnected_.store(false);
  mcpConsecutiveErrors_ = 0;
  mcpPortA_.store(0xFF);
  mcpPortB_.store(0xFF);
}
