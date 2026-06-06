#include "Biquad.h"

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
    float alpha = sw / 2.f * sqrtf(2.f);

    float sqA = sqrtf(A);
    float a0 =  (A+1) + (A-1)*cw + 2.f*sqA*alpha;
    b0 =  A * ((A+1) - (A-1)*cw + 2.f*sqA*alpha) / a0;
    b1 =  2.f*A * ((A-1) - (A+1)*cw)              / a0;
    b2 =  A * ((A+1) - (A-1)*cw - 2.f*sqA*alpha)  / a0;
    a1 = -2.f * ((A-1) + (A+1)*cw)                / a0;
    a2 =       ((A+1) + (A-1)*cw - 2.f*sqA*alpha) / a0;
}

void BiquadFilter::setHighShelf(float freq, float gainDb, float sampleRate) {
    float A  = powf(10.f, gainDb / 40.f);
    float w0 = 2.f * M_PI * freq / sampleRate;
    float cw = cosf(w0);
    float sw = sinf(w0);
    float alpha = sw / 2.f * sqrtf(2.f);

    float sqA = sqrtf(A);
    float a0 =  (A+1) - (A-1)*cw + 2.f*sqA*alpha;
    b0 =  A * ((A+1) + (A-1)*cw + 2.f*sqA*alpha)  / a0;
    b1 = -2.f*A * ((A-1) + (A+1)*cw)               / a0;
    b2 =  A * ((A+1) + (A-1)*cw - 2.f*sqA*alpha)   / a0;
    a1 =  2.f * ((A-1) - (A+1)*cw)                 / a0;
    a2 =       ((A+1) - (A-1)*cw - 2.f*sqA*alpha)  / a0;
}

void BiquadFilter::setLowPass(float freq, float q, float sampleRate) {
    float w0 = 2.f * M_PI * freq / sampleRate;
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
    float w0 = 2.f * M_PI * freq / sampleRate;
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
