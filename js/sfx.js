// Tiny synthesized sound effects (WebAudio, no files): ball contact, floor bounce, whistle, crowd, UI and gacha.
// Off/on and volume live in localStorage ("retroVB.sound" = "on" | "off", "retroVB.vol" = 0..1).
(function (VB) {
  "use strict";
  var ac = null, master = null, noiseBuf = null, lastAt = {};
  function on() { try { return (localStorage.getItem("retroVB.sound") || "on") === "on"; } catch (e) { return false; } }
  function vol() { try { var v = parseFloat(localStorage.getItem("retroVB.vol")); return isNaN(v) ? 0.6 : v; } catch (e) { return 0.6; } }
  function ctx() {
    if (ac) return ac;
    var AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null;
    try { ac = new AC(); } catch (e) { return null; }
    master = ac.createGain(); master.gain.value = 0.35 * vol(); master.connect(ac.destination);
    noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
    var d = noiseBuf.getChannelData(0); for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return ac;
  }
  // browsers only allow audio after a tap: wake the context on the first one
  ["pointerdown", "keydown"].forEach(function (ev) { window.addEventListener(ev, function () { if (on() && ctx() && ac.state === "suspended") ac.resume(); }, { passive: true }); });

  function env(g, t, a, peak, d) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d); }
  function tone(type, f0, f1, t, dur, peak) {
    var o = ac.createOscillator(), g = ac.createGain(); o.type = type;
    o.frequency.setValueAtTime(f0, t); if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    env(g, t, 0.005, peak, dur); o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.05); return o;
  }
  function noise(t, dur, peak, type, freq, q) {
    var s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
    s.buffer = noiseBuf; f.type = type || "bandpass"; f.frequency.value = freq || 1200; f.Q.value = q || 1;
    env(g, t, 0.004, peak, dur); s.connect(f); f.connect(g); g.connect(master); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05); return f;
  }
  var SFX = {
    touch: function (t) { tone("sine", 180, 90, t, 0.09, 0.5); noise(t, 0.04, 0.25, "bandpass", 1800, 2); },           // pass / set: a soft "pok"
    spike: function (t) { tone("sine", 140, 50, t, 0.16, 0.9); noise(t, 0.09, 0.7, "highpass", 1500, 0.7); },             // a hard "THWACK"
    serve: function (t) { tone("sine", 160, 70, t, 0.12, 0.7); noise(t, 0.06, 0.45, "bandpass", 2200, 1.4); },
    block: function (t) { tone("square", 110, 60, t, 0.1, 0.35); noise(t, 0.08, 0.6, "lowpass", 900, 0.8); },
    bounce: function (t) { tone("sine", 95, 45, t, 0.18, 0.8); noise(t, 0.05, 0.35, "lowpass", 600, 0.7); },              // the floor
    whistle: function (t) {
      var o = tone("sine", 2750, 2750, t, 0.42, 0.22), lfo = ac.createOscillator(), lg = ac.createGain();
      lfo.frequency.value = 38; lg.gain.value = 70; lfo.connect(lg); lg.connect(o.frequency); lfo.start(t); lfo.stop(t + 0.5);
    },
    cheer: function (t, big) {                                                                                      // a crowd swell
      var d = big ? 2.2 : 1.1, s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
      s.buffer = noiseBuf; s.loop = true; f.type = "bandpass"; f.frequency.value = 900; f.Q.value = 0.6;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(big ? 0.32 : 0.16, t + 0.25); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      s.connect(f); f.connect(g); g.connect(master); s.start(t); s.stop(t + d + 0.1);
    },
    click: function (t) { tone("square", 880, 660, t, 0.04, 0.08); },
    flip: function (t) { noise(t, 0.05, 0.25, "highpass", 3000, 0.5); tone("triangle", 520, 780, t, 0.06, 0.12); },
    rise: function (t) { tone("sawtooth", 180, 900, t, 0.9, 0.08); },                                                   // the gacha build-up
    rare: function (t) { [660, 880, 1100].forEach(function (f, i) { tone("triangle", f, f, t + i * 0.08, 0.25, 0.2); }); },
    legend: function (t) { [523, 659, 784, 1047].forEach(function (f, i) { tone("triangle", f, f, t + i * 0.09, 0.4, 0.22); }); },
    mythic: function (t) {
      [523, 659, 784, 1047, 1319, 1568].forEach(function (f, i) { tone("triangle", f, f, t + i * 0.08, 0.6, 0.2); tone("sine", f * 2, f * 2, t + i * 0.08, 0.3, 0.05); });
      SFX.cheer(t + 0.3, true);
    }
  };
  VB.Sfx = {
    play: function (name, opt) {
      if (!on() || !SFX[name] || document.hidden) return;
      if (!ctx() || ac.state !== "running") return;
      var now = performance.now(); if (lastAt[name] && now - lastAt[name] < 45) return; lastAt[name] = now;   // no machine-gun stacking
      try { master.gain.value = 0.35 * vol(); SFX[name](ac.currentTime + 0.01, opt); } catch (e) {}
    },
    on: on,
    toggle: function () { try { localStorage.setItem("retroVB.sound", on() ? "off" : "on"); } catch (e) {} return on(); },
    setVol: function (v) { try { localStorage.setItem("retroVB.vol", String(v)); } catch (e) {} if (master) master.gain.value = 0.35 * v; },
    vol: vol
  };
  // every button gives a little click
  document.addEventListener("click", function (e) { if (e.target.closest && e.target.closest(".btn, .menu-card, .tab")) VB.Sfx.play("click"); }, true);
})(window.VB);
