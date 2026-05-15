#include "DspEngine.h"

// ---------------------------------------------------------------------------
// BiquadFilter — Audio EQ Cookbook formulas (R. Bristow-Johnson)
// ---------------------------------------------------------------------------

float BiquadFilter::process(float x) {
    float y = b0*x + b1*x1 + b2*x2 - a1*y1 - a2*y2;
    x2 = x1; x1 = x;
    y2 = y1; y1 = y;
    return y;
}

void BiquadFilter::setLowShelf(float freq, float gainDb, float sampleRate) {
    float A  = powf(10.f, gainDb / 40.f);
    float w0 = 2.f * M_PI * freq / sampleRate;
    float cw = cosf(w0);
    float sw = sinf(w0);
    // shelf slope S = 1 → alpha = sin(w0)/2 * sqrt((A+1/A)*(1/S-1)+2)
    float alpha = sw / 2.f * sqrtf((A + 1.f/A) * (1.f/1.f - 1.f) + 2.f);
    // S=1 simplifies the sqrt term to sqrt(2), so:
    alpha = sw / 2.f * sqrtf(2.f);

    float sqA = sqrtf(A);
    float a0 =  (A+1) + (A-1)*cw + 2.f*sqA*alpha;
    b0 =  A * ((A+1) - (A-1)*cw + 2.f*sqA*alpha) / a0;
    b1 =  2.f*A * ((A-1) - (A+1)*cw)              / a0;
    b2 =  A * ((A+1) - (A-1)*cw - 2.f*sqA*alpha) / a0;
    a1 = -2.f * ((A-1) + (A+1)*cw)                / a0;
    a2 =       ((A+1) + (A-1)*cw - 2.f*sqA*alpha) / a0;
}

void BiquadFilter::setHighShelf(float freq, float gainDb, float sampleRate) {
    float A  = powf(10.f, gainDb / 40.f);
    float w0 = 2.f * M_PI * freq / sampleRate;
    float cw = cosf(w0);
    float sw = sinf(w0);
    float alpha = sw / 2.f * sqrtf(2.f); // shelf slope S=1

    float sqA = sqrtf(A);
    float a0 =  (A+1) - (A-1)*cw + 2.f*sqA*alpha;
    b0 =  A * ((A+1) + (A-1)*cw + 2.f*sqA*alpha) / a0;
    b1 = -2.f*A * ((A-1) + (A+1)*cw)              / a0;
    b2 =  A * ((A+1) + (A-1)*cw - 2.f*sqA*alpha) / a0;
    a1 =  2.f * ((A-1) - (A+1)*cw)                / a0;
    a2 =       ((A+1) - (A-1)*cw - 2.f*sqA*alpha) / a0;
}

void BiquadFilter::setPeaking(float freq, float gainDb, float q, float sampleRate) {
    float A  = powf(10.f, gainDb / 40.f);
    float w0 = 2.f * M_PI * freq / sampleRate;
    float alpha = sinf(w0) / (2.f * q);
    float cw = cosf(w0);

    float a0 = 1.f + alpha / A;
    b0 =  (1.f + alpha * A) / a0;
    b1 = (-2.f * cw)        / a0;
    b2 =  (1.f - alpha * A) / a0;
    a1 = (-2.f * cw)        / a0;
    a2 =  (1.f - alpha / A) / a0;
}

// ---------------------------------------------------------------------------
// DspEngine
// ---------------------------------------------------------------------------

void DspEngine::setup(float sampleRate) {
    sampleRate_ = sampleRate;
    // Initialise filters at 0 dB so they are transparent on startup
    low_.setLowShelf (250.f,  0.f, sampleRate_);
    mid_.setPeaking  (1000.f, 0.f, 1.4f, sampleRate_);
    high_.setHighShelf(4000.f, 0.f, sampleRate_);
}

void DspEngine::setGains(float gainLowDb, float gainMidDb, float gainHighDb) {
    // Recompute coefficients only when a value has actually changed
    if(gainLowDb != lastLow_) {
        low_.setLowShelf(250.f, gainLowDb, sampleRate_);
        lastLow_ = gainLowDb;
    }
    if(gainMidDb != lastMid_) {
        mid_.setPeaking(1000.f, gainMidDb, 1.4f, sampleRate_);
        lastMid_ = gainMidDb;
    }
    if(gainHighDb != lastHigh_) {
        high_.setHighShelf(4000.f, gainHighDb, sampleRate_);
        lastHigh_ = gainHighDb;
    }
}

float DspEngine::process(float input) {
    // Bypass the EQ chain entirely when all gains are at 0 dB
    if(lastLow_ == 0.f && lastMid_ == 0.f && lastHigh_ == 0.f)
        return input;
    return high_.process(mid_.process(low_.process(input)));
}
