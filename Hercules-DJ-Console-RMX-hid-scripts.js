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
RMX.leds      = [];
RMX.cacheIn  = [];
RMX.cacheOut = [];
RMX.callbacks = [];
RMX.feedbacks = [];

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

// the actual mapping is defined in this function
RMX.init = function() {

  // define the hid packet
  RMX.defineHidFormat();

  function continousControl(g, e, v) {
    engine.setParameter(g, e, v / 255);
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

  RMX.capture("crossfader", "all", continousControl);

  RMX.capture("balance", "all", function(g, e, v) {

  });

  RMX.capture("play", "press", toggleControlFunction());

  RMX.capture("cue_default", "all", function(g, e, v) {

  });

  RMX.capture("beatsync", "press", setControlFunction());

  RMX.capture("volume", "all", continousControl);
  RMX.capture("pregain", "all", continousControl);
  RMX.capture("filterHigh", "all", continousControl);
  RMX.capture("filterMid",  "all", continousControl);
  RMX.capture("filterLow",  "all", continousControl);

  RMX.capture("jog", "all", RMX.jog);

  RMX.capture("stop", "all", function(g,e,v) {

  });

  // led is controlled by hardware, use the button for global quantize though
  RMX.capture("mic_toggle", "all", function(g,e,v) {
    var quantize = v > 0 ? 1 : 0;
    engine.setValue("[Channel1]", "quantize", quantize);
    engine.setValue("[Channel2]", "quantize", quantize);
  });

  RMX.capture("source", "all", function(g, e, v) {
    RMX.shift = v > 0 ? 1 : 0;
    RMX.send("[Channel1]", "source", RMX.shift);
    RMX.send("[Channel2]", "source", RMX.shift);
  });

  RMX.capture("previous", "press", setControlFunction("beatjump_backward"));

  RMX.capture("next", "press", setControlFunction("beatjump_forward"));

  // library browsing

  RMX.capture("menu_up", "press", setControlFunction("SelectPrevTrack", "[Playlist]"));
  RMX.capture("menu_down", "press", setControlFunction("SelectNextTrack", "[Playlist]"));
  RMX.capture("menu_left", "press", setControlFunction("SelectPrevPlaylist", "[Playlist]"));
  RMX.capture("menu_right", "press", setControlFunction("SelectNextPlaylist", "[Playlist]"));
  RMX.capture("LoadSelectedTrack", "press", setControlFunction());

  // fader

  RMX.capture("rate", "all", function(g, e, v) {
    var rate = v / 255;
    // ensure half of the slider is 0.5
    if (127 == v) {
      rate = 0.5;
    }
    engine.setParameter(g, e, rate);
  });

  // enable/disable scratching
  RMX.capture("scratch", "press", function(g, e, v) {
    RMX.scratchEnabled = !RMX.scratchEnabled;
    RMX.send(g, e, RMX.scratchEnabled ? 1: 0);
  });

  RMX.capture("pitch_reset", "press", function(g, e, v) {

  });

  // headphone cue

  RMX.capture("headphone_cue", "press", toggleControlFunction("pfl"));

  RMX.capture("headMix", "all", continousControl);

  // "pads" todo
  RMX.capture("keypad1","all", function(g, e, v) {
    engine.setValue(g,"hotcue_1_activate",v)
  } );
  RMX.capture("keypad2","all", function(g, e, v) {
    engine.setValue(g,"hotcue_2_activate",v)
  } );
  RMX.capture("keypad3","all", function(g, e, v) {
    engine.setValue(g,"hotcue_3_activate",v)
  } );
  RMX.capture("keypad4","all", function(g, e, v) {
    engine.setValue(g,"hotcue_4_activate",v)
  } );
  
  RMX.capture("keypad5","all", function(g, e, v) {
    engine.setValue(g,"loop_in",v)
  } );
  RMX.capture("keypad6","all", function(g, e, v) {
    engine.setValue(g,"loop_out",v)
  } );

  var filterKill = function(g, e, v) {
    engine.setValue(g, e, !engine.getValue(g, e));
  };

  RMX.capture("filterHighKill", "all", setControlFunction());
  RMX.capture("filterMidKill", "all", setControlFunction());
  RMX.capture("filterLowKill", "all", setControlFunction());

  // led feedback
  function sendFeedbackFunction(overrideControl) {
    return function(group, control, value) {
      if (overrideControl !== undefined) control = overrideControl;
      RMX.send(group, control, value)
    };
  }

  RMX.feedback("[Channel1]", "play", sendFeedbackFunction());
  RMX.feedback("[Channel2]", "play", sendFeedbackFunction());

  RMX.feedback("[Channel1]", "pfl", sendFeedbackFunction("headphone_cue"));
  RMX.feedback("[Channel2]", "pfl", sendFeedbackFunction("headphone_cue"));
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
    var deck = parseInt(group.substring(8,9));

    if (!RMX.scratching[group]) {
      RMX.scratching[group] = true;
      var rpm = RMX.shift ? 5 : 40;
      engine.scratchEnable(deck, 128, rpm, 1.0/8, (1.0/8)/32);
    } else {
      engine.stopTimer(RMX.scratchTimer); // disable timer which would disable scratching
    }
    engine.scratchTick(deck, relativeValue);

    RMX.scratchTimer = engine.beginTimer(20, function() {
      var deck = parseInt(group.substring(8,9));
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


  // define led feedback

  pid = 0x00;
  RMX.cacheOut[pid] = [ pid, 0x0, 0x0, 0x0 ];

  RMX.addControl(pid, "scratch",       "[Master]",   "led", 1, 0x01); // blinking: 3, 0x2
  RMX.addControl(pid, "play",          "[Channel1]", "led", 1, 0x02); // blinking: 3, 0x2
  RMX.addControl(pid, "cue_default",   "[Channel1]", "led", 1, 0x04);
  RMX.addControl(pid, "headphone_cue", "[Channel1]", "led", 1, 0x08);
  RMX.addControl(pid, "source",        "[Channel1]", "led", 1, 0x10);
  RMX.addControl(pid, "beatsync",      "[Channel1]", "led", 1, 0x20);
  RMX.addControl(pid, "beatlock",      "[Channel1]", "led", 1, 0x40);
  RMX.addControl(pid, "pitch_reset",   "[Channel1]", "led", 1, 0x80);

  RMX.addControl(pid, "play",          "[Channel2]", "led", 2, 0x02); // blinking: 2, 0x02
  RMX.addControl(pid, "cue_default",   "[Channel2]", "led", 2, 0x04); // blinking: 2, 0x04
  RMX.addControl(pid, "headphone_cue", "[Channel2]", "led", 2, 0x08); // blinking: 2, 0x08
  RMX.addControl(pid, "source",        "[Channel2]", "led", 2, 0x10);
  RMX.addControl(pid, "beatsync",      "[Channel2]", "led", 2, 0x20); // blinking: 2, 0x20
  RMX.addControl(pid, "beatlock",      "[Channel2]", "led", 2, 0x80); // blinking: 2, 0x80
  RMX.addControl(pid, "pitch_reset",   "[Channel2]", "led", 2, 0x40); // blinking: 2, 0x40

};

/**
 * non-specific controller framework to allow hid packets to be defined and
 * processed via callback functions - could/should be in a shared file
 */

RMX.addControl = function(packetId, name, group, type, offset, mask) {
  if (type == "led") {
    RMX.leds[group + name] = new RMX.Control(packetId, name, group, type, offset, mask);
  } else {
    if (RMX.controls[offset] === undefined) {
      RMX.controls[offset] = [];
    }
    RMX.controls[offset].push(new RMX.Control(packetId, name, group, type, offset, mask));
  }
};

// bind a function to a modified controller value

RMX.capture = function(name, values, func) {
  if (RMX.callbacks[name] === undefined) {
    RMX.callbacks[name] = [[values, func]];
  } else {
    RMX.callbacks[name].push([values, func]);
  }
};

// bind a function to feedback from mixxx, callbacks accept args in same order
// as from capture()

RMX.feedback = function(group, control, func) {
  engine.connectControl(group, control, "RMX.feedbackData");
  if (RMX.feedbacks[group + control] === undefined) {
    RMX.feedbacks[group + control] = [];
  }
  RMX.feedbacks[group + control].push(func);
};

// controller feedback: send data to the controller by name and automatically
// send out the full hid packet needed

RMX.send = function(group, control, value) {
  if ((ctrl = this.leds[group + control]) !== undefined) {

    // for the byte in the hid packet that this led control affects, mask out
    // it's old value
    // and then add in it's new one

    var tmp = this.cacheOut[ctrl.packetId];

    tmp[ctrl.offset] = tmp[ctrl.offset] & ctrl.maskinv | (value << ctrl.bitshift);

    // send complete hid packet
    controller.send(tmp, tmp.length, 0);
  }
};

// process incoming data from mixxx and call any callbacks

RMX.feedbackData = function(value, group, control) {
  if (RMX.feedbacks[group + control] !== undefined) {
    for (var func in RMX.feedbacks[group + control]) {
      if (typeof(RMX.feedbacks[group + control][func]) == "function") {
        RMX.feedbacks[group + control][func](group, control, value);
      }
    }
  }
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
