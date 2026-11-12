#include "Biquad.h"
#include <algorithm>

namespace {

inline float clampFreq(float freq, float sampleRate) {
    if (sampleRate <= 0.f) return 1000.f;
    const float minF = 1.0f;
    const float maxF = sampleRate * 0.495f;
    return (freq < minF) ? minF : ((freq > maxF) ? maxF : freq);
}

inline float clampQ(float q) {
    return (q < 0.01f) ? 0.01f : q;
}

} // namespace

void BiquadFilter::setLowShelf(float freq, float gainDb, float sampleRate) {
    freq = clampFreq(freq, sampleRate);
    float A  = powf(10.f, gainDb / 40.f);
    float w0 = kTwoPi * freq / sampleRate;
    float cw = cosf(w0);
    float sw = sinf(w0);
    float alpha = sw / 2.f * kShelfAlphaFactor;

    float sqA = sqrtf(A);
    float a0 =  (A+1) + (A-1)*cw + 2.f*sqA*alpha;
    b0 =  A * ((A+1) - (A-1)*cw + 2.f*sqA*alpha) / a0;
    b1 =  2.f*A * ((A-1) - (A+1)*cw)              / a0;
    b2 =  A * ((A+1) - (A-1)*cw - 2.f*sqA*alpha)  / a0;
    a1 = -2.f * ((A-1) + (A+1)*cw)                / a0;
    a2 =       ((A+1) + (A-1)*cw - 2.f*sqA*alpha) / a0;
}

void BiquadFilter::setHighShelf(float freq, float gainDb, float sampleRate) {
    freq = clampFreq(freq, sampleRate);
    float A  = powf(10.f, gainDb / 40.f);
    float w0 = kTwoPi * freq / sampleRate;
    float cw = cosf(w0);
    float sw = sinf(w0);
    float alpha = sw / 2.f * kShelfAlphaFactor;

    float sqA = sqrtf(A);
    float a0 =  (A+1) - (A-1)*cw + 2.f*sqA*alpha;
    b0 =  A * ((A+1) + (A-1)*cw + 2.f*sqA*alpha)  / a0;
    b1 = -2.f*A * ((A-1) + (A+1)*cw)               / a0;
    b2 =  A * ((A+1) + (A-1)*cw - 2.f*sqA*alpha)   / a0;
    a1 =  2.f * ((A-1) - (A+1)*cw)                 / a0;
    a2 =       ((A+1) - (A-1)*cw - 2.f*sqA*alpha)  / a0;
}

void BiquadFilter::setLowPass(float freq, float q, float sampleRate) {
    freq = clampFreq(freq, sampleRate);
    q = clampQ(q);
    float w0 = kTwoPi * freq / sampleRate;
    float cw = cosf(w0);
    float alpha = sinf(w0) / (2.f * q);

    float a0 = 1.f + alpha;
    b0 =  (1.f - cw) * 0.5f / a0;
    b1 =  (1.f - cw)        / a0;
    b2 =  (1.f - cw) * 0.5f / a0;
    a1 = -2.f * cw           / a0;
    a2 =  (1.f - alpha)      / a0;
}

void BiquadFilter::setHighPass(float freq, float q, float sampleRate) {
    freq = clampFreq(freq, sampleRate);
    q = clampQ(q);
    float w0 = kTwoPi * freq / sampleRate;
    float cw = cosf(w0);
    float alpha = sinf(w0) / (2.f * q);

    float a0 = 1.f + alpha;
    b0 =  (1.f + cw) * 0.5f / a0;
    b1 = -(1.f + cw)        / a0;
    b2 =  (1.f + cw) * 0.5f / a0;
    a1 = -2.f * cw           / a0;
    a2 =  (1.f - alpha)      / a0;
}

void BiquadFilter::setPeaking(float freq, float gainDb, float q, float sampleRate) {
    freq = clampFreq(freq, sampleRate);
    q = clampQ(q);
    float A  = powf(10.f, gainDb / 40.f);
    float w0 = kTwoPi * freq / sampleRate;
    float alpha = sinf(w0) / (2.f * q);
    float cw = cosf(w0);

    float a0 = 1.f + alpha / A;
    b0 =  (1.f + alpha * A) / a0;
    b1 = (-2.f * cw)        / a0;
    b2 =  (1.f - alpha * A) / a0;
    a1 = (-2.f * cw)        / a0;
    a2 =  (1.f - alpha / A) / a0;
}
