#include <cassert>
#include <cmath>
#include <iostream>
#include <limits>
#include <vector>
#include "../../modules/audio-playback/android/src/main/cpp/audio/DeckEq.h"
#include "../../modules/audio-playback/android/src/main/cpp/audio/PcmRingBuffer.h"
using namespace remixer;
constexpr double tau = 6.283185307179586;

double response(int rate, int band, float value, bool kill, double hz) {
  DeckEq eq;
  if (band >= 0) eq.setBand(band,value,kill);
  std::vector<float> block(256*2);
  double energy=0; int samples=0;
  for(int base=0;base<rate*2;base+=256) {
    for(int i=0;i<256;++i) {
      block[2*i]=static_cast<float>(.01*std::sin(tau*hz*(base+i)/rate));
      block[2*i+1]=0;
    }
    eq.process(block.data(),256,2,rate);
    for(int i=0;i<256;++i) {
      assert(std::isfinite(block[2*i]));
      assert(block[2*i+1]==0); // no stereo crosstalk
      if(base>rate) {energy+=block[2*i]*block[2*i];samples++;}
    }
  }
  return 20*std::log10(std::sqrt(energy/samples)/(.01/std::sqrt(2.0)));
}
void eqTests() {
  for(int rate:{44100,48000,96000}) {
    for(double hz:{60.,1000.,12000.}) assert(std::abs(response(rate,-1,0,false,hz))<.05);
    for(int band=0;band<3;band++) {
      double hz=band==0?40.:band==1?1000.:16000.;
      const double boost=response(rate,band,1,false,hz), cut=response(rate,band,-1,false,hz);
      assert(boost>11 && boost<12.1); assert(cut < -11 && cut > -12.1);
      // Shelves transition gradually; kill is deepest away from their corner frequency.
      const double killed=response(rate,band,0,true,band==0?10.:band==1?1000.:rate*.48);
      assert(killed < -45);
    }
  }
  DeckEq a,b;
  a.setBand(0,1,false);
  assert(a.gainDb(0)==12 && b.gainDb(0)==0);
  a.setBand(1,std::numeric_limits<float>::quiet_NaN(),false);
  assert(a.gainDb(1)==0);
  a.setBand(2,100,false);assert(a.gainDb(2)==12);
  std::vector<float> data(128*2);
  for(int block=0;block<2000;block++) {
    for(int i=0;i<256;i++) data[i]=static_cast<float>(.05*std::sin(i*.17+block));
    if(block%7==0) for(int band=0;band<3;band++) a.setBand(band,block%2?1:-1,block%5==0);
    if(block%43==0) a.requestReset();
    a.process(data.data(),128,2,48000);
    for(float x:data) assert(std::isfinite(x) && std::abs(x)<10);
  }
}
void rateTests() {
  for(double speed:{.5,1.,1.5,2.}) {
    PcmRingBuffer ring(20000);
    std::vector<float> input(16000*2),output(4000*2);
    for(int i=0;i<16000;i++) input[2*i]=input[2*i+1]=static_cast<float>(std::sin(tau*1000*i/48000));
    ring.write(input.data(),16000);
    double current=speed;
    auto result=ring.readAtRate(output.data(),4000,static_cast<float>(speed),current,.001,false);
    assert(result.outputFrames==4000);
    assert(result.consumedFrames==static_cast<size_t>(4000*speed));
    int crossings=0;
    for(int i=1;i<4000;i++) {if(output[2*i-2]<=0 && output[2*i]>0)crossings++;assert(output[2*i]==output[2*i+1]);}
    assert(std::abs(crossings*48000./4000-1000*speed)<15);
  }
  // Small producer batches, wraparound, fractional phase and EOF draining.
  PcmRingBuffer ring(16);
  float input[16],out[32];double rate=.5;size_t consumed=0,rendered=0;
  for(int pass=0;pass<100;pass++) {
    for(int i=0;i<16;i++) input[i]=.25f;
    assert(ring.write(input,8)==8);
    auto r=ring.readAtRate(out,16,.5f,rate,.001,false);
    consumed+=r.consumedFrames;rendered+=r.outputFrames;
    for(size_t i=0;i<r.outputFrames*2;i++)assert(out[i]==.25f);
  }
  auto r=ring.readAtRate(out,16,.5f,rate,.001,true);
  consumed+=r.consumedFrames;rendered+=r.outputFrames;
  assert(consumed==800 && rendered==1600 && ring.availableRead()==0);
  ring.clear();ring.write(input,8);rate=1;
  r=ring.readAtRate(out,16,1,rate,.001,true);
  assert(r.outputFrames==8 && r.consumedFrames==8);
  for(int i=16;i<32;i++)assert(out[i]==0);
}
int main(){eqTests();rateTests();std::cout<<"PASS: EQ response, kill depth, stereo/deck isolation, rapid changes, varispeed pitch/position, wraparound and EOF\n";}
