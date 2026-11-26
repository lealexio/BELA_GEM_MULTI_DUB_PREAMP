#pragma once
#include <string>

/**
 * ConfigLoader — reads and persists config.json on non-RT threads.
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

    /**
     * Validates JSON syntax/structure and atomically writes config.json to the
     * given path (.tmp + fsync + rename). Non-RT only.
     * @param path      Target config.json file path
     * @param jsonText  JSON string to validate and write
     * @param errorOut  Receives a concise ASCII error description on failure
     * @returns true on success
     */
    static bool saveRawJson(const char* path, const std::string& jsonText,
                            std::string& errorOut);

    /**
     * Reads the raw config.json file from disk without mutating runtime state.
     * Non-RT only (used as WebSocket fallback for GUI export).
     * @param path        Source config.json file path
     * @param outContent  Receives raw file contents on success
     * @param errorOut    Receives a concise ASCII error description on failure
     * @returns true on success
     */
    static bool readRawJson(const char* path, std::string& outContent,
                            std::string& errorOut);
};
