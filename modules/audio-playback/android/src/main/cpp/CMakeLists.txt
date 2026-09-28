cmake_minimum_required(VERSION 3.22.1)
project(remixer_audio LANGUAGES CXX)
find_package(oboe REQUIRED CONFIG)
add_library(remixer_audio SHARED
  audio/RemixerAudioEngine.cpp
  audio/AudioDecoder.cpp
  jni/RemixerAudioJni.cpp
)
target_compile_features(remixer_audio PRIVATE cxx_std_17)
target_compile_options(remixer_audio PRIVATE -Wall -Wextra -Werror -O2)
target_link_libraries(remixer_audio PRIVATE oboe::oboe log mediandk)
