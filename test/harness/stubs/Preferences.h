#pragma once
// Host stub of the Preferences (NVS) class. Backed by a tab-separated file
// at env ANTS_NVS_FILE (default "antsw_nvs.tsv") so tests can inspect and
// wipe persistence.

#include "Arduino.h"

class Preferences {
  std::string _ns;
  bool _open = false;

 public:
  bool begin(const char* name, bool readOnly);
  void end() { _open = false; }
  String getString(const char* key, const String& def);
  bool putString(const char* key, const String& value);
};
