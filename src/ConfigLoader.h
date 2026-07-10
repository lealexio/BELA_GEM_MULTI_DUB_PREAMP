#pragma once

/**
 * ConfigLoader — reads config.json at startup and populates the runtime
 * hardware config globals declared in HardwareConfig.h.
 *
 * Call ConfigLoader::load() once at the very start of setup(), before any
 * other initialisation.  All JSON parsing and memory allocation happen here;
 * render() never touches this code.
 *
 * If the file is absent or malformed the globals keep their hardcoded defaults
 * from HardwareConfigData.cpp and load() returns false (non-fatal).
 */
class ConfigLoader {
public:
    /**
     * Loads config.json from the given path and overwrites the runtime hardware
     * config globals.  Returns true on success, false if the file cannot be
     * opened or the JSON is invalid (defaults remain in effect).
     */
    static bool load(const char* path);
};
