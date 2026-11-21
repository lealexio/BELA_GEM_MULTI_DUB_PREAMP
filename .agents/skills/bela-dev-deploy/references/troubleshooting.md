# Troubleshooting Common Bela Compilation & Runtime Issues

This reference guide provides quick diagnostic patterns for common issues encountered when building and running C++ audio code on Bela Gem Multi (ARM Cortex-A53 / Debian Bookworm / EVL Xenomai).

---

## 1. C++ / Clang++ Compiler Diagnostics

### Undefined Symbol / Missing Mathematical Functions (`M_PI`, `sinf`, `fmaxf`)
- **Diagnostic:** `error: use of undeclared identifier 'M_PI'` or `'std::fmax' has not been declared`.
- **Cause:** C++11 standard math macros require `#define _USE_MATH_DEFINES` prior to `#include <cmath>`.
- **Fix:** Ensure `#include <cmath>` is present and `M_PI` / `fmaxf` / `fminf` are referenced cleanly or use explicit constants.

### Narrowing Conversion Warnings as Errors
- **Diagnostic:** `error: non-constant-expression cannot be narrowed from type 'double' to 'float'`.
- **Cause:** Bela uses strict compiler flags (`-Werror=return-type`, `-Wall`). Floating-point literals should be explicitly suffixed with `f` (e.g., `0.5f` instead of `0.5`).

### Missing Header or Forward Declaration
- **Diagnostic:** `error: unknown type name 'ChannelStrip'` or `incomplete type`.
- **Fix:** Check header inclusion order in `render.cpp` or add forward declarations.

---

## 2. Hard Real-Time Runtime Constraints

Any violation of hard real-time constraints in `render()` will lead to mode switches, audio dropouts (underruns), or kernel watchdog terminations:

1. **Memory Allocation:**
   - **Forbidden:** `malloc()`, `free()`, `new`, `delete`, `std::vector::push_back()`, `std::string` concatenation.
   - **Resolution:** All buffers, vectors, and state structures must be preallocated during `setup()`.

2. **Blocking System Calls & I2C:**
   - **Forbidden:** Direct I2C transactions (e.g., MCP23017 I2C read/write) or file I/O inside `render()`.
   - **Resolution:** Perform blocking I/O inside an `AuxiliaryTask` (priority 50), never in the audio Xenomai thread (priority 95).

3. **Standard Printing:**
   - **Forbidden:** Standard `printf()` or `std::cout` in audio callback.
   - **Resolution:** Use `rt_printf()` or accumulate debug state and print periodically from an auxiliary loop.

---

## 3. Bela Hardware & Peripheral Diagnostics

### MCP23017 Not Detected
- **Log:** `HardwareManager: MCP23017 not detected at 0x20, scanning 0x20..0x27...`
- **Cause:** The I2C GPIO expander chip is not wired, powered off, or configured on an alternate I2C address.
- **Behavior:** The software gracefully falls back to running without hardware switches (all switches remain OFF by default).

### Audio Dropouts / Underrun Warnings
- **Log:** `Underrun detected: 1 blocks dropped at ...`
- **Cause:** Audio block calculation exceeded block deadline (e.g., 16 samples = ~362 µs at 44.1 kHz).
- **Checklist:**
  - Verify that complex DSP calculation (such as biquad coefficient updates) runs at block-rate or only upon parameter change, not per-sample.
  - Ensure filters with near-zero gains use smooth bypass.
