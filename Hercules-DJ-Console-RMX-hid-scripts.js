/****************************************************************/
/*      Hercules DJ Console RMX HID controller script           */
/*      For Mixxx version 1.11                                  */
/*      Author: RichterSkala                                    */
/*      Contributors: Markus Kohlhase,                          */
/*                    Sven Rahn (randombyte-developer)          */
/*      Based on zestoi's script                                */
/****************************************************************/

RMX = new Controller();

RMX.controls  = [];
RMX.cacheIn  = [];
RMX.callbacks = [];

//State variables:
RMX.scratchEnabled = false;

RMX.scratching = {
  "[Channel1]": false,
  "[Channel2]": false
};

RMX.jogSkip =  {
  "[Channel1]": true,
  "[Channel2]": true
};

RMX.shift = false; // controlled via source button
RMX.crossfaderEnabled = true;

// timers simulate the movement of a jogwheel, the right one is broken and disabled
RMX.jogTimers = {
  "[Channel1]": -1,
  "[Channel2]": -1
};

// the actual mapping is defined in this function
RMX.init = function() {

  // define the hid packet
  RMX.defineHidFormat();

  function continousControl(g, e, v) {
    engine.setParameter(g, e, v / 255);
  }

  function getChannelNumberFromGroup(groupString) {
    return parseInt(groupString.substring(8, 9));
  }

  function setControlFunction(overrideControl, overrideGroup) {
    return function(group, control, value) {
      if (overrideGroup !== undefined) group = overrideGroup;
      if (overrideControl !== undefined) control = overrideControl;
      engine.setValue(group, control, value);
    };
  }

  function toggleControlFunction(overrideControl, overrideGroup) {
    return function(group, control, value) {
      if (overrideGroup !== undefined) group = overrideGroup;
      if (overrideControl !== undefined) control = overrideControl;
      engine.setValue(group, control, !engine.getValue(group, control));
    };
  }

  function hotcueFunction(number) {
    return function(group, _control, value) {
      if (RMX.shift) {
        engine.setValue(group, "hotcue_" + number + "_clear", 1);
      } else {
        engine.setValue(group, "hotcue_" + number + "_activate", value);
      }
    };
  }

  function jogButtonFunction(direction) {
    return function (group, _control, value) {
      var timerId = RMX.jogTimers[group];
      if (timerId != -1) {
        engine.stopTimer(timerId);
      }
      if (value) {
        RMX.jogTimers[group] = engine.beginTimer(20, function () {
          if (RMX.shift) {
            var rate = engine.getValue(group, "rate");
            rate = rate + direction * 0.001;
            engine.setValue(group, "rate", rate);
          } else {
            engine.setValue(group, "jog", -1 * direction);
          }
        }, false);
      }
    };
  }

  function beatjumpButton(control, factor) {
    return function(group) {
      if (RMX.shift) {
        var size = engine.getValue(group, "beatjump_size") * factor;
        if (size < 0.125) size = 0.125;
        if (size > 128) size = 128;
        engine.setValue(group, "beatjump_size", size);
      } else {
        engine.setValue(group, control, 1);
      }
    };
  }

  function navigateLibrary(direction) {
    return function() {
      var distance = RMX.shift ? 10 : 1;
      engine.setValue("[Playlist]", "SelectTrackKnob", distance * direction);
    };
  }

  // buttons
  RMX.capture("play", "press", toggleControlFunction());
  RMX.capture("beatsync", "press", setControlFunction());
  RMX.capture("headphone_cue", "press", toggleControlFunction("pfl"));
  RMX.capture("cue_default", "all", hotcueFunction(1));
  RMX.capture("menu_up", "press", navigateLibrary(-1));
  RMX.capture("menu_down", "press", navigateLibrary(1));
  RMX.capture("menu_left", "press", setControlFunction("SelectPrevPlaylist", "[Playlist]"));
  RMX.capture("menu_right", "press", setControlFunction("SelectNextPlaylist", "[Playlist]"));
  RMX.capture("LoadSelectedTrack", "press", setControlFunction());
  RMX.capture("stop", "press", setControlFunction("eject"));

  RMX.capture("pitch_reset", "all", jogButtonFunction(-1));
  RMX.capture("beatlock", "all", jogButtonFunction(+1));

  RMX.capture("filterHighKill", "all", function(group, control, value) {
    engine.setValue(group, control, value);
    if (value && RMX.shift) {
      RMX.rightRateFaderEnabled = !RMX.rightRateFaderEnabled;
    }
  });
  RMX.capture("filterMidKill", "all", setControlFunction());
  RMX.capture("filterLowKill", "all", setControlFunction());

  RMX.capture("keypad1", "press", toggleControlFunction("quantize"));
  RMX.capture("keypad2", "press", function(group) {
    var beatloopSize = engine.getValue(group, "beatloop_size");
    engine.setValue(group, "beatloop_" + beatloopSize + "_toggle", 1);
  });
  RMX.capture("keypad3", "press", setControlFunction("loop_halve"));
  RMX.capture("keypad4", "press", function (group) {
    if (RMX.shift) {
      engine.setValue(group, "rate", 0); // reset rate
    }
  });
  RMX.capture("keypad5", "all", setControlFunction("beatlooproll_0.5_activate"));
  RMX.capture("keypad6", "press", setControlFunction("loop_double"));

  RMX.capture("previous", "press", beatjumpButton("beatjump_backward", 0.5));
  RMX.capture("next", "press", beatjumpButton("beatjump_forward", 2));
  
  RMX.capture("scratch", "press", function(g, e, v) {
    RMX.scratchEnabled = !RMX.scratchEnabled;
  });

  RMX.capture("source", "all", function(group, control, value) {
    if (RMX.shift && value) {
      // double shift, both buttons are being pressed
      RMX.crossfaderEnabled = !RMX.crossfaderEnabled;
      if (!RMX.crossfaderEnabled) {
        engine.setParameter("[Master]", "crossfader", 0.5); // center crossfader
      }
    }

    RMX.shift = value;
  });

  // faders / knobs
  RMX.capture("crossfader", "all", function(group, control, value) {
    if (RMX.crossfaderEnabled) {
      continousControl(group, control, value);
    }
  });

  RMX.capture("volume", "all", continousControl);
  RMX.capture("filterHigh", "all", continousControl);
  RMX.capture("filterMid",  "all", continousControl);
  RMX.capture("filterLow",  "all", continousControl);
  RMX.capture("headMix", "all", continousControl);

  RMX.capture("pregain", "all", function(group, control, value) {
    var enabled = value > 0;
    var channel = getChannelNumberFromGroup(group);
    var effectGroup = "[EffectRack1_EffectUnit" + channel + "_Effect1]";
    engine.setValue(effectGroup, "enabled", enabled);
    engine.setParameter(effectGroup, "meta", value / 255);
  });

  RMX.capture("jog", "all", RMX.jog);

  RMX.capture("rate", "all", function(group, control, value) {
    if (getChannelNumberFromGroup(group) == 2) { // ignore right tempo fader, it's broken
      return;
    }

    var rate = value / 255;
    // ensure half of the slider is 0.5
    if (127 == value) {
      rate = 0.5;
    }
    engine.setParameter(group, control, rate);
  });

  engine.softTakeover("[Channel1]", "rate", true);
  engine.softTakeover("[Channel2]", "rate", true);
};

RMX.jog = function(group, control, value, controlObject) {

  // skip initial jog values when mapping initializes
  if (RMX.jogSkip[group]) {
    RMX.jogSkip[group] = false;
    return;
  }

  var relativeValue = value - controlObject.lastValue;
  
  if (Math.abs(relativeValue) > 100) {
    // ignore values where it wraps around
    return;
  }

  if (!RMX.scratchEnabled) {
    // rate adjustment
    engine.setValue(group, "jog", relativeValue);
  } else {
    // scratching
    var deck = getChannelNumberFromGroup(group);

    if (!RMX.scratching[group]) {
      RMX.scratching[group] = true;
      var rpm = RMX.shift ? 5 : 40;
      engine.scratchEnable(deck, 128, rpm, 1.0/8, (1.0/8)/32);
    } else {
      engine.stopTimer(RMX.scratchTimer); // disable timer which would disable scratching
    }
    engine.scratchTick(deck, relativeValue);

    RMX.scratchTimer = engine.beginTimer(20, function() {
      var deck = getChannelNumberFromGroup(group);
      RMX.scratching[group] = false;
      engine.scratchDisable(deck);
    }, true);
  }
};

/**
 * define the hid packet to event mapping, could be defined via xml so can be
 * used in multiple mappings
 * naming the controls as much as possible inline with the mixxx engine names
 * makes most mappings trivial
 */

RMX.defineHidFormat = function() {

  var pid = 0x1;
  // Order as in manual
  // deck 1 - buttons
  RMX.addControl(pid, "keypad1",           "[Channel1]", "button", 1, 0x01);
  RMX.addControl(pid, "keypad2",           "[Channel1]", "button", 1, 0x02);
  RMX.addControl(pid, "keypad3",           "[Channel1]", "button", 1, 0x04);
  RMX.addControl(pid, "keypad4",           "[Channel1]", "button", 1, 0x08);
  RMX.addControl(pid, "keypad5",           "[Channel1]", "button", 1, 0x10);
  RMX.addControl(pid, "keypad6",           "[Channel1]", "button", 1, 0x20);
  RMX.addControl(pid, "beatsync",          "[Channel1]", "button", 1, 0x40);
  RMX.addControl(pid, "beatlock",          "[Channel1]", "button", 1, 0x80);
  RMX.addControl(pid, "previous",          "[Channel1]", "button", 2, 0x01);
  RMX.addControl(pid, "next",              "[Channel1]", "button", 2, 0x02);
  RMX.addControl(pid, "play",              "[Channel1]", "button", 2, 0x04);
  RMX.addControl(pid, "cue_default",       "[Channel1]", "button", 2, 0x08);
  RMX.addControl(pid, "stop",              "[Channel1]", "button", 2, 0x10);
  RMX.addControl(pid, "filterHighKill",    "[Channel1]", "button", 2, 0x20);
  RMX.addControl(pid, "filterMidKill",     "[Channel1]", "button", 2, 0x40);
  RMX.addControl(pid, "filterLowKill",     "[Channel1]", "button", 2, 0x80);
  RMX.addControl(pid, "pitch_reset",       "[Channel1]", "button", 3, 0x01);
  RMX.addControl(pid, "LoadSelectedTrack", "[Channel1]", "button", 3, 0x02);
  RMX.addControl(pid, "source",            "[Channel1]", "button", 3, 0x04);
  RMX.addControl(pid, "headphone_cue",     "[Channel1]", "button", 3, 0x08);

  // deck 2 - buttons
  RMX.addControl(pid, "beatlock",          "[Channel2]", "button", 3, 0x10);
  RMX.addControl(pid, "LoadSelectedTrack", "[Channel2]", "button", 3, 0x20);
  RMX.addControl(pid, "source",            "[Channel2]", "button", 3, 0x40);
  RMX.addControl(pid, "headphone_cue",     "[Channel2]", "button", 3, 0x80);
  RMX.addControl(pid, "keypad1",           "[Channel2]", "button", 4, 0x01);
  RMX.addControl(pid, "keypad2",           "[Channel2]", "button", 4, 0x02);
  RMX.addControl(pid, "keypad3",           "[Channel2]", "button", 4, 0x04);
  RMX.addControl(pid, "keypad4",           "[Channel2]", "button", 4, 0x08);
  RMX.addControl(pid, "keypad5",           "[Channel2]", "button", 4, 0x10);
  RMX.addControl(pid, "keypad6",           "[Channel2]", "button", 4, 0x20);
  RMX.addControl(pid, "beatsync",          "[Channel2]", "button", 4, 0x40);
  RMX.addControl(pid, "pitch_reset",       "[Channel2]", "button", 4, 0x80);
  RMX.addControl(pid, "previous",          "[Channel2]", "button", 5, 0x01);
  RMX.addControl(pid, "next",              "[Channel2]", "button", 5, 0x02);
  RMX.addControl(pid, "play",              "[Channel2]", "button", 5, 0x04);
  RMX.addControl(pid, "cue_default",       "[Channel2]", "button", 5, 0x08);
  RMX.addControl(pid, "stop",              "[Channel2]", "button", 5, 0x10);
  RMX.addControl(pid, "filterHighKill",    "[Channel2]", "button", 5, 0x20);
  RMX.addControl(pid, "filterMidKill",     "[Channel2]", "button", 5, 0x40);
  RMX.addControl(pid, "filterLowKill",     "[Channel2]", "button", 5, 0x80);

  // master buttons
  RMX.addControl(pid, "scratch",           "[Master]",   "button", 6, 0x01);
  RMX.addControl(pid, "menu_up",           "[Master]",   "button", 6, 0x02);
  RMX.addControl(pid, "menu_down",         "[Master]",   "button", 6, 0x04);
  RMX.addControl(pid, "menu_left",         "[Master]",   "button", 6, 0x08);
  RMX.addControl(pid, "menu_right",        "[Master]",   "button", 6, 0x10);
  RMX.addControl(pid, "mic_toggle",        "[Master]",   "button", 6, 0x20);

  // wheels
  RMX.addControl(pid, "jog",               "[Channel1]", "encoder", 7, 0xff);
  RMX.addControl(pid, "jog",               "[Channel2]", "encoder", 8, 0xff);

  // faders
  RMX.addControl(pid, "rate",              "[Channel1]", "fader", 9,  0xff);
  RMX.addControl(pid, "volume",            "[Channel1]", "fader", 10, 0xff);
  RMX.addControl(pid, "pregain",           "[Channel1]", "fader", 11, 0xff);
  RMX.addControl(pid, "filterHigh",        "[Channel1]", "fader", 12, 0xff);
  RMX.addControl(pid, "filterMid",         "[Channel1]", "fader", 13, 0xff);
  RMX.addControl(pid, "filterLow",         "[Channel1]", "fader", 14, 0xff);

  RMX.addControl(pid, "balance",           "[Master]",   "fader", 15, 0xff);
  RMX.addControl(pid, "volume",            "[Master]",   "fader", 16, 0xff);
  RMX.addControl(pid, "crossfader",        "[Master]",   "fader", 17, 0xff);
  RMX.addControl(pid, "headMix",           "[Master]",   "fader", 18, 0xff);

  RMX.addControl(pid, "rate",              "[Channel2]", "fader", 19, 0xff);
  RMX.addControl(pid, "volume",            "[Channel2]", "fader", 20, 0xff);
  RMX.addControl(pid, "pregain",           "[Channel2]", "fader", 21, 0xff);
  RMX.addControl(pid, "filterHigh",        "[Channel2]", "fader", 22, 0xff);
  RMX.addControl(pid, "filterMid",         "[Channel2]", "fader", 23, 0xff);
  RMX.addControl(pid, "filterLow",         "[Channel2]", "fader", 24, 0xff);
};

/**
 * non-specific controller framework to allow hid packets to be defined and
 * processed via callback functions - could/should be in a shared file
 */

RMX.addControl = function(packetId, name, group, type, offset, mask) {
  if (RMX.controls[offset] === undefined) {
    RMX.controls[offset] = [];
  }
  RMX.controls[offset].push(new RMX.Control(packetId, name, group, type, offset, mask)); 
};

// bind a function to a modified controller value

RMX.capture = function(name, values, func) {
  if (RMX.callbacks[name] === undefined) {
    RMX.callbacks[name] = [[values, func]];
  } else {
    RMX.callbacks[name].push([values, func]);
  }
};

// make connection and directly trigger connection to update state which helps during development with frequent reloads
RMX.makeConnectionAndTrigger = function(group, control, func) {
  engine.makeConnection(group, control, function(value, group, control) {
    func(group, control, value);
  }).trigger();
};

// a single hid control, store last known value and offset/mask to work out the
// new value from incoming data

RMX.Control = function(packetId, name, group, type, offset, mask) {
  this.packetId = packetId;
  this.name = name;
  this.group = group;
  this.type = type;
  this.lastValue = 0;
  this.offset = offset;
  this.mask = mask;
  this.maskinv = ~mask;
  this.bitshift = 0;
  this.maxval = 255; // needed for encoder, could guess from the mask
  
  while (mask !== 0 && (mask & 0x1) === 0) {
    mask = mask >> 1;
    this.bitshift++;
  }
};

// process incoming data and call any callbacks if their bound controls have
// changed

RMX.incomingData = function (data, length) {
  var packetId = data[0];
  var p = RMX.cacheIn[packetId];

  // iterate thru each byte and only check controls for that byte if the byte
  // has changed
  for (var i=1; i<length; i++) {

    if ((p === undefined || data[i] != p[i]) && RMX.controls[i] !== undefined) {

      // a byte has changed, check any controls defined in that byte, more
      // efficient than checking old+new values for all controls

      for (var key in RMX.controls[i]) {
        var control = RMX.controls[i][key];
        var value = (data[i] & control.mask) >> control.bitshift;
        if (typeof(control) == 'object' && control.packetId == data[0] && control.lastValue != value) {

          // we found a hid control that has changed value within that byte,
          // check for callbacks
          var callbacks = RMX.callbacks[control.name];

          if (callbacks !== undefined) {
            for (var j=0; j<callbacks.length; j++) {
              var cb = callbacks[j][1];

              if (typeof(cb) == 'function') {
                // check we need to call for this value change:
                // all, press, release
                var v       = callbacks[j][0];
                var all     = v == "all";
                var press   = v == "press"   && value  >  0;
                var release = v == "release" && value === 0;
                if ( all || press || release ) {
                  // call a callback function for this control
                  cb(control.group, control.name, value, control);
                }
              }
            }
          }

          control.lastValue = value;
        }
      }
    }
  }

  // store the new raw data
  RMX.cacheIn[data[0]] = data;
};
