#include "../../modules/audio-playback/android/src/main/cpp/audio/MasterDsp.h"
#include <cassert>
#include <iostream>
#include <limits>
#include <vector>
using remixer::MasterDsp;
static std::vector<float> constant(MasterDsp& dsp, float l, float r, int rate=48000) {
  std::vector<float> samples(rate*2);
  for (int i=0;i<rate;++i) { samples[i*2]=l; samples[i*2+1]=r; }
  dsp.process(samples.data(), rate, 2, rate);
  return samples;
}
static double response(int band, int rate) {
  constexpr double frequencies[]{31,62,125,250,500,1000,2000,4000,8000,16000};
  remixer::GraphicEq eq;
  eq.setBand(band,.5f,false);
  std::vector<float> samples(rate*4);
  for(int i=0;i<rate*2;++i) samples[i*2]=samples[i*2+1]=.05f*std::sin(6.283185307179586*frequencies[band]*i/rate);
  eq.process(samples.data(),rate*2,2,rate);
  double power=0;
  for(int i=rate;i<rate*2;++i) power+=samples[i*2]*samples[i*2];
  return 20*std::log10(std::sqrt(power/rate)/(.05/std::sqrt(2.)));
}
int main() {
  for(int rate : {44100,48000,96000}) {
    for(int band=0;band<10;++band) assert(std::abs(response(band,rate)-6)<.12);
    MasterDsp bypass;
    auto out=constant(bypass,.2f,-.3f,rate);
    assert(std::abs(out.back()+.3f)<1e-6);
    MasterDsp boost; boost.set(16,1); boost.set(0,6);
    out=constant(boost,.1f,.1f,rate);
    assert(std::abs(out.back()-.199526f)<1e-4);
    MasterDsp headroom; headroom.set(16,1); headroom.set(0,-12);
    out=constant(headroom,2,2,rate); // summed decks must not clip before preamp
    assert(std::abs(out.back()-.502377f)<1e-4);
    MasterDsp mono; mono.set(16,1); mono.set(4,0);
    out=constant(mono,.2f,.4f,rate);
    assert(std::abs(out.back()-.3f)<1e-4);
    MasterDsp pan; pan.set(16,1); pan.set(3,1);
    out=constant(pan,.2f,.4f,rate);
    assert(std::abs(out[out.size()-2])<1e-4 && std::abs(out.back()-.4f)<1e-4);
    MasterDsp limiter; limiter.set(16,1); limiter.set(0,12);
    out=constant(limiter,.8f,.4f,rate);
    assert(out[out.size()-2]<=.981f && std::abs(out[out.size()-2]/out.back()-2)<.001);
    limiter.set(0,std::numeric_limits<float>::quiet_NaN());
    for(int k=0;k<200;++k) {
      limiter.set(6+k%10,(k%2 ? 12.f : -12.f));
      std::vector<float> burst(514,.3f);
      limiter.process(burst.data(),257,2,rate);
      for(float v:burst) assert(std::isfinite(v) && std::abs(v)<=1);
    }
  }
  std::cout << "PASS: master bypass, ten-band response at 3 sample rates, preamp headroom, mono, balance, linked limiter and rapid EQ changes\n";
}
