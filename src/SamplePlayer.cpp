#include "SamplePlayer.h"

#include <Bela.h>
#include <libraries/AudioFile/AudioFile.h>
#include <dirent.h>
#include <sys/stat.h>
#include <algorithm>
#include <cctype>
#include <cmath>
#include <cstdio>
#include <cstring>
#include <string>
#include <vector>

namespace {

/** Case-insensitive suffix check (ext includes the leading dot). */
bool endsWithIgnoreCase(const char* name, const char* ext) {
    if(!name || !ext) return false;
    size_t n = strlen(name);
    size_t e = strlen(ext);
    if(n < e) return false;
    for(size_t i = 0; i < e; ++i) {
        char a = name[n - e + i];
        char b = ext[i];
        if(a >= 'A' && a <= 'Z') a = (char)(a - 'A' + 'a');
        if(b >= 'A' && b <= 'Z') b = (char)(b - 'A' + 'a');
        if(a != b) return false;
    }
    return true;
}

/** Returns true for supported one-shot audio files (.wav / .mp3). */
bool isAudioFilename(const char* name) {
    return endsWithIgnoreCase(name, ".wav") || endsWithIgnoreCase(name, ".mp3");
}

/** Copies basename into dest (NUL-terminated, max kMaxSampleNameLen). */
void copySampleName(char* dest, const char* src) {
    if(!dest) return;
    if(!src) {
        dest[0] = '\0';
        return;
    }
    size_t i = 0;
    for(; i + 1 < (size_t)kMaxSampleNameLen && src[i] != '\0'; ++i)
        dest[i] = src[i];
    dest[i] = '\0';
}

/**
 * Natural compare so "FX2" sorts before "FX10".
 * Digits are compared as integers; other chars case-insensitively.
 */
int naturalCompare(const std::string& a, const std::string& b) {
    size_t i = 0, j = 0;
    while(i < a.size() && j < b.size()) {
        if(std::isdigit((unsigned char)a[i]) && std::isdigit((unsigned char)b[j])) {
            // Skip leading zeros, then compare numeric values / lengths.
            size_t i0 = i, j0 = j;
            while(i < a.size() && a[i] == '0') ++i;
            while(j < b.size() && b[j] == '0') ++j;
            size_t i1 = i, j1 = j;
            while(i1 < a.size() && std::isdigit((unsigned char)a[i1])) ++i1;
            while(j1 < b.size() && std::isdigit((unsigned char)b[j1])) ++j1;
            const size_t lenA = i1 - i;
            const size_t lenB = j1 - j;
            if(lenA != lenB)
                return (lenA < lenB) ? -1 : 1;
            for(size_t k = 0; k < lenA; ++k) {
                if(a[i + k] != b[j + k])
                    return (a[i + k] < b[j + k]) ? -1 : 1;
            }
            // Equal numbers: fewer leading zeros first.
            const size_t zerosA = i - i0;
            const size_t zerosB = j - j0;
            if(zerosA != zerosB)
                return (zerosA < zerosB) ? -1 : 1;
            i = i1;
            j = j1;
            continue;
        }
        char ca = a[i];
        char cb = b[j];
        if(ca >= 'A' && ca <= 'Z') ca = (char)(ca - 'A' + 'a');
        if(cb >= 'A' && cb <= 'Z') cb = (char)(cb - 'A' + 'a');
        if(ca != cb)
            return (ca < cb) ? -1 : 1;
        ++i;
        ++j;
    }
    if(i == a.size() && j == b.size()) return 0;
    return (i == a.size()) ? -1 : 1;
}

/** Mixes multi-channel AudioFile data down to a mono vector. */
std::vector<float> mixToMono(const std::vector<std::vector<float>>& multi) {
    std::vector<float> mono;
    if(multi.empty() || multi[0].empty())
        return mono;
    const size_t frames = multi[0].size();
    const size_t chans  = multi.size();
    if(chans == 1)
        return multi[0];
    mono.resize(frames);
    const float inv = 1.f / (float)chans;
    for(size_t n = 0; n < frames; ++n) {
        float sum = 0.f;
        for(size_t c = 0; c < chans; ++c)
            sum += multi[c][n];
        mono[n] = sum * inv;
    }
    return mono;
}

/**
 * Loads one sample via Bela AudioFileUtilities (libsndfile) into mono float.
 * Done only in setup() — never from the RT thread.
 */
std::vector<float> loadSampleMono(const char* path) {
    std::vector<std::vector<float>> multi = AudioFileUtilities::load(path);
    std::vector<float> mono = mixToMono(multi);
    if(!mono.empty())
        return mono;
    return AudioFileUtilities::loadMono(path);
}

/** True when path exists and is a directory. */
bool isDirectory(const char* path) {
    if(!path || path[0] == '\0') return false;
    struct stat st;
    return stat(path, &st) == 0 && S_ISDIR(st.st_mode);
}

/**
 * Resolves the project samples/ folder.
 * On Bela the working directory is the project root, so "samples" is preferred;
 * falls back to /root/Bela/projects/<projectName>/samples.
 */
bool resolveSamplesDir(const char* projectName, char* out, size_t outSize) {
    if(isDirectory("samples")) {
        snprintf(out, outSize, "samples");
        return true;
    }
    if(projectName && projectName[0]) {
        snprintf(out, outSize, "/root/Bela/projects/%s/samples", projectName);
        if(isDirectory(out))
            return true;
    }
    out[0] = '\0';
    return false;
}

} // namespace

void SamplePlayer::setup(float sampleRate, const char* projectName) {
    sampleRate_  = sampleRate > 0.f ? sampleRate : 44100.f;
    fadeSamples_ = (int)std::max(1.f, sampleRate_ * kSamplerFadeMs / 1000.f);
    fadeStep_    = 1.f / (float)fadeSamples_;
    folderOk_    = false;
    sampleCount_ = 0;
    playing_     = false;
    activeSlot_  = -1;
    readPtr_     = 0;
    fade_        = 0.f;
    fadingOut_   = false;
    pendingTrigger_.store(-1, std::memory_order_relaxed);

    for(int i = 0; i < kMaxSamples; ++i) {
        buffers_[i].clear();
        names_[i][0] = '\0';
    }

    char dirPath[512];
    if(!resolveSamplesDir(projectName, dirPath, sizeof(dirPath))) {
        folderOk_ = false;
        return;
    }
    folderOk_ = true;

    DIR* dir = opendir(dirPath);
    if(!dir) {
        folderOk_ = false;
        return;
    }

    std::vector<std::string> files;
    while(dirent* ent = readdir(dir)) {
        if(ent->d_name[0] == '.') continue;
        if(!isAudioFilename(ent->d_name)) continue;
        files.push_back(ent->d_name);
    }
    closedir(dir);
    std::sort(files.begin(), files.end(),
              [](const std::string& a, const std::string& b) {
                  return naturalCompare(a, b) < 0;
              });

    int loaded = 0;
    for(size_t i = 0; i < files.size() && loaded < kMaxSamples; ++i) {
        char loadPath[768];
        snprintf(loadPath, sizeof(loadPath), "%s/%s", dirPath, files[i].c_str());

        std::vector<float> mono = loadSampleMono(loadPath);
        if(mono.empty())
            continue;

        buffers_[loaded] = std::move(mono);
        copySampleName(names_[loaded], files[i].c_str());
        ++loaded;
    }
    sampleCount_ = loaded;
}

void SamplePlayer::setControls(float gainPot, float fxSendPot, float fxSend2Pot) {
    gain_     = gainPot;
    fxSend_   = fxSendPot;
    fxSend2_  = fxSend2Pot;
}

void SamplePlayer::trigger(int slot) {
    if(slot < 0 || slot >= sampleCount_) return;
    pendingTrigger_.store(slot, std::memory_order_release);
}

const char* SamplePlayer::sampleName(int slot) const {
    if(slot < 0 || slot >= sampleCount_) return "";
    return names_[slot];
}

float SamplePlayer::playhead() const {
    if(!playing_ || activeSlot_ < 0 || activeSlot_ >= sampleCount_)
        return 0.f;
    const size_t len = buffers_[activeSlot_].size();
    if(len == 0) return 0.f;
    float p = (float)readPtr_ / (float)len;
    if(p < 0.f) p = 0.f;
    if(p > 1.f) p = 1.f;
    return p;
}

float SamplePlayer::process() {
    // Fast path when idle and no pending trigger — avoid atomic RMW every sample.
    if(!playing_) {
        const int peek = pendingTrigger_.load(std::memory_order_relaxed);
        if(peek < 0) {
            lastFxOut_  = 0.f;
            lastFxOut2_ = 0.f;
            return 0.f;
        }
    }

    // Consume pending GUI trigger (may retrigger mid-playback).
    const int trig = pendingTrigger_.exchange(-1, std::memory_order_acq_rel);
    if(trig >= 0 && trig < sampleCount_ && !buffers_[trig].empty()) {
        activeSlot_ = trig;
        readPtr_    = 0;
        playing_    = true;
        fadingOut_  = false;
        fade_       = 0.f; // fade in from silence
    }

    if(!playing_ || activeSlot_ < 0 || activeSlot_ >= sampleCount_) {
        lastFxOut_  = 0.f;
        lastFxOut2_ = 0.f;
        return 0.f;
    }

    const std::vector<float>& buf = buffers_[activeSlot_];
    const int len = (int)buf.size();
    if(len <= 0 || readPtr_ >= len) {
        playing_    = false;
        activeSlot_ = -1;
        fade_       = 0.f;
        lastFxOut_  = 0.f;
        lastFxOut2_ = 0.f;
        return 0.f;
    }

    // Fade-out window: clamp start so short files still get a full fade-in first.
    const int fadeStart = (len > fadeSamples_) ? (len - fadeSamples_) : 0;
    if(!fadingOut_ && readPtr_ >= fadeStart && fade_ >= 1.f)
        fadingOut_ = true;

    if(fadingOut_) {
        fade_ -= fadeStep_;
        if(fade_ < 0.f) fade_ = 0.f;
    } else {
        fade_ += fadeStep_;
        if(fade_ > 1.f) fade_ = 1.f;
    }

    const float sample = buf[(size_t)readPtr_] * fade_;
    ++readPtr_;

    if(fadingOut_ && fade_ <= 0.f) {
        playing_    = false;
        activeSlot_ = -1;
        readPtr_    = 0;
    }

    const float dry = sample * gain_ * kSamplerGainScale;
    lastFxOut_  = dry * fxSend_;
    lastFxOut2_ = dry * fxSend2_;
    return dry;
}
