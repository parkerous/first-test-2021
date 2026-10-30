// Training minigames (modal): every drill picks one that fits the skill, so practice never feels the same.
// Each game resolves with a quality 0..1 and always ends on its own (timeouts), even if nobody touches it.
//   bar      – stop the marker in the zone (the classic)          target – click when the crosshair is on the spot
//   reaction – dive the right way when the ball appears           memory – repeat the setter's calls in order
//   read     – read which hitter the setter is going to           rhythm – hit the approach steps on the beat
//   catch    – slide your platform under the falling balls        power  – hold to charge, release in the sweet spot
//   tap      – sprint drill: tap as fast as you can
(function (VB) {
  "use strict";
  var U = VB.ui, $ = U.$, esc = U.esc, rnd = VB.rnd, pick = VB.pick, clamp = VB.clamp;

  var FOR = { srv: ["target", "power", "bar"], rec: ["catch", "reaction", "bar"], set: ["memory", "bar", "rhythm"], att: ["target", "rhythm", "power"],
              blk: ["read", "reaction"], def: ["reaction", "catch"], vert: ["power", "rhythm"], men: ["memory", "read"], tec: ["bar", "target", "rhythm"], spd: ["tap", "reaction"] };
  var NAME = { bar: "TIMING", target: "TARGET", reaction: "REACTION", memory: "MEMORY", read: "READ THE SETTER", rhythm: "APPROACH RHYTHM", catch: "PLATFORM", power: "POWER", tap: "SPRINT" };
  var HOWTO = {
    target: "Click (or press SPACE) when the crosshair is on the target.",
    reaction: "Wait for the ball... then dive LEFT or RIGHT (buttons or arrow keys). Too early is a miss!",
    memory: "Remember the setter's calls, then repeat them in order.",
    read: "Watch the three hitters' approaches — tap the one who's really getting the set (the fastest one).",
    rhythm: "Press STEP (or SPACE) on every beat: left – right – left – JUMP.",
    catch: "Move the mouse/finger (or ◀ ▶) to get your platform under each ball.",
    power: "HOLD the button (or SPACE) to charge — release in the gold zone. Overcharge and it resets!",
    tap: "Tap TAP! (or SPACE) as fast as you can for 3 seconds."
  };
  var last = null;

  function open(title, text, kind, inner) {
    $("modalTitle").textContent = title;
    $("modalBody").innerHTML = "<p>" + esc(text) + "</p><div class='mini-tag'>MINIGAME: " + NAME[kind] + "</div>" + inner +
      "<p class='center muted'>" + esc(HOWTO[kind] || "") + "</p><p class='center big' id='miniRes'></p>";
    $("modalBtns").innerHTML = "";
    $("modal").classList.remove("hidden");
  }
  function btn(label, cls) { var b = document.createElement("button"); b.className = "btn " + (cls || ""); b.textContent = label; $("modalBtns").appendChild(b); return b; }
  function grade(q) { return q >= 0.95 ? ["PERFECT!", "#1fa34a"] : q >= 0.6 ? ["GOOD", "#c99a00"] : q > 0.15 ? ["OFF", "#d97a00"] : ["MISSED", "#d33"]; }
  function done(res, q, extra) {
    var g = grade(q), r = $("miniRes");
    if (r) { r.textContent = g[0] + (extra ? " " + extra : ""); r.style.color = g[1]; }
    $("modalBtns").innerHTML = "";
    setTimeout(function () { $("modal").classList.add("hidden"); res(clamp(q, 0, 1)); }, 750);
  }
  function keys(fn) { function k(e) { fn(e); } document.addEventListener("keydown", k); document.addEventListener("keyup", k); return function () { document.removeEventListener("keydown", k); document.removeEventListener("keyup", k); }; }

  // ---------- target: a crosshair sweeps the court ----------
  function target(title, text, e) {
    return new Promise(function (res) {
      open(title, text, "target", "<canvas id='miniCv' class='mini-cv' width='320' height='200'></canvas>");
      var cv = $("miniCv"), g = cv.getContext("2d"), tx = rnd(60, 260), ty = rnd(50, 160), t0 = performance.now(), fin = false, cx = 0, cy = 0;
      var sp = 1.25 - e * 0.45, r = 13 + e * 6;
      function frame(now) {
        if (fin) return;
        var t = (now - t0) / 1000 / sp;
        cx = 160 + Math.sin(t * 2.1) * 140; cy = 100 + Math.sin(t * 3.3 + 1) * 85;
        g.fillStyle = "#e8a64a"; g.fillRect(0, 0, 320, 200); g.strokeStyle = "#fff"; g.lineWidth = 3; g.strokeRect(10, 10, 300, 180);
        g.beginPath(); g.moveTo(10, 70); g.lineTo(310, 70); g.stroke();
        g.fillStyle = "rgba(255,255,255,0.35)"; g.beginPath(); g.arc(tx, ty, r * 2.2, 0, 6.28); g.fill();
        g.fillStyle = "#e0348a"; g.beginPath(); g.arc(tx, ty, r, 0, 6.28); g.fill(); g.fillStyle = "#fff"; g.beginPath(); g.arc(tx, ty, r * 0.4, 0, 6.28); g.fill();
        g.strokeStyle = "#13293f"; g.lineWidth = 2; g.beginPath(); g.arc(cx, cy, 10, 0, 6.28); g.moveTo(cx - 16, cy); g.lineTo(cx + 16, cy); g.moveTo(cx, cy - 16); g.lineTo(cx, cy + 16); g.stroke();
        if (now - t0 > 9000) return shoot();
        requestAnimationFrame(frame);
      }
      function shoot() {
        if (fin) return; fin = true; off();
        var d = Math.hypot(cx - tx, cy - ty), q = d <= r * 0.5 ? 1 : d <= r ? 0.85 : d <= r * 2.2 ? 0.6 - 0.35 * (d - r) / (r * 1.2) : d <= r * 3.5 ? 0.15 : 0;
        g.fillStyle = "#ffd500"; g.beginPath(); g.arc(cx, cy, 7, 0, 6.28); g.fill();
        done(res, q);
      }
      var off = keys(function (ev) { if (ev.type === "keydown" && ev.code === "Space") { ev.preventDefault(); shoot(); } });
      cv.onclick = shoot; btn("HIT IT!", "big").onclick = shoot;
      requestAnimationFrame(frame);
    });
  }

  // ---------- reaction: dive the right way ----------
  function reaction(title, text, e) {
    return new Promise(function (res) {
      open(title, text, "reaction", "<div class='mini-react' id='miniReact'>READY...</div><p class='center' id='miniRep'>BALL 1 / 3</p>");
      var rep = 0, scores = [], side = null, shownAt = 0, timer = null, fin = false, box = $("miniReact");
      var L = btn("◀ DIVE LEFT"), R = btn("DIVE RIGHT ▶");
      function next() {
        if (rep >= 3) { fin = true; off(); return done(res, scores.reduce(function (a, b) { return a + b; }, 0) / 3); }
        side = null; box.className = "mini-react"; box.textContent = "READY..."; $("miniRep").textContent = "BALL " + (rep + 1) + " / 3";
        timer = setTimeout(function () {
          side = Math.random() < 0.5 ? "L" : "R"; shownAt = performance.now();
          box.className = "mini-react go " + side; box.textContent = side === "L" ? "🏐 ◀◀◀" : "▶▶▶ 🏐";
          timer = setTimeout(function () { score(null); }, 1300 - e * 250);
        }, rnd(700, 1700));
      }
      function score(dir) {
        if (fin) return;
        clearTimeout(timer);
        var q = 0;
        if (!side) { box.textContent = "TOO EARLY!"; }
        else if (dir === side) { var rt = performance.now() - shownAt; q = rt < 380 ? 1 : rt < 520 ? 0.8 : rt < 720 ? 0.55 : 0.3; box.textContent = "UP! " + Math.round(rt) + "ms"; }
        else box.textContent = dir ? "WRONG WAY!" : "TOO SLOW!";
        scores.push(q); rep++; side = "x";
        setTimeout(next, 550);
      }
      L.onclick = function () { if (side !== "x") score("L"); }; R.onclick = function () { if (side !== "x") score("R"); };
      var off = keys(function (ev) { if (ev.type !== "keydown" || side === "x") return; if (ev.code === "ArrowLeft") score("L"); if (ev.code === "ArrowRight") score("R"); });
      next();
    });
  }

  // ---------- memory: the setter's calls ----------
  var CALLS = ["A QUICK", "B QUICK", "C QUICK", "PIPE", "BACK SET", "SLIDE", "HIGH OUT", "SHOOT"];
  function memory(title, text, e) {
    return new Promise(function (res) {
      var n = 3 + Math.round(e * 2) + (Math.random() < 0.3 ? 1 : 0), seq = [];
      for (var i = 0; i < n; i++) seq.push(pick(CALLS));
      open(title, text, "memory", "<div class='mini-react' id='miniMem'>LISTEN...</div><p class='center' id='miniGot'></p>");
      var box = $("miniMem"), k = 0, got = 0, fin = false, guard;
      function show() {
        if (k >= seq.length) { box.textContent = "YOUR TURN!"; return ask(); }
        box.textContent = (k + 1) + ". " + seq[k]; k++;
        setTimeout(function () { box.textContent = ""; setTimeout(show, 160); }, 760 - e * 160);
      }
      function ask() {
        CALLS.forEach(function (c) { btn(c, "tiny").onclick = function () { answer(c); }; });
        guard = setTimeout(function () { end(); }, 12000);
      }
      function answer(c) {
        if (fin) return;
        if (c === seq[got]) { got++; $("miniGot").textContent = seq.slice(0, got).join(" → "); if (got === seq.length) end(); }
        else { box.textContent = "IT WAS " + seq[got] + "!"; end(); }
      }
      function end() { if (fin) return; fin = true; clearTimeout(guard); done(res, got / seq.length, "(" + got + "/" + seq.length + ")"); }
      setTimeout(show, 500);
    });
  }

  // ---------- read: which hitter is really coming? ----------
  function read(title, text, e) {
    return new Promise(function (res) {
      open(title, text, "read", "<div class='mini-read'><div><b>LEFT</b><div class='mini-trk'><i id='rd0'></i></div></div><div><b>MIDDLE</b><div class='mini-trk'><i id='rd1'></i></div></div>" +
        "<div><b>RIGHT</b><div class='mini-trk'><i id='rd2'></i></div></div></div><p class='center' id='miniRep'>SET 1 / 3</p>");
      var rep = 0, scores = [], real = 0, t0 = 0, raf = 0, sp = [], fin = false, guard;
      var B = ["◀ LEFT", "MIDDLE", "RIGHT ▶"].map(function (l, i) { var b = btn(l); b.onclick = function () { choose(i); }; return b; });
      function round() {
        if (rep >= 3) { fin = true; return done(res, scores.reduce(function (a, b) { return a + b; }, 0) / 3); }
        real = Math.floor(Math.random() * 3); sp = [0, 1, 2].map(function (i) { return i === real ? 1 : rnd(0.62, 0.86 + e * 0.04); });
        t0 = performance.now(); $("miniRep").textContent = "SET " + (rep + 1) + " / 3";
        cancelAnimationFrame(raf); raf = requestAnimationFrame(frame);
        guard = setTimeout(function () { choose(-1); }, 2600);
      }
      function frame(now) {
        var u = Math.min(1, (now - t0) / (1100 - e * 200));
        [0, 1, 2].forEach(function (i) { var el = $("rd" + i); if (el) el.style.width = Math.min(100, u * sp[i] * 100) + "%"; });
        if (u < 1 && !fin) raf = requestAnimationFrame(frame);
      }
      function choose(i) {
        if (fin || guard == null) return;
        clearTimeout(guard); guard = null;
        var t = performance.now() - t0;
        scores.push(i === real ? (t < 900 ? 1 : 0.7) : 0);
        $("miniRep").textContent = i === real ? "READ IT!" : "IT WAS " + ["LEFT", "MIDDLE", "RIGHT"][real] + "!";
        rep++; setTimeout(round, 600);
      }
      round();
    });
  }

  // ---------- rhythm: left – right – left – jump ----------
  function rhythm(title, text, e) {
    return new Promise(function (res) {
      var beats = [0.22, 0.46, 0.64, 0.8], dur = 2100 - e * 300;
      open(title, text, "rhythm", "<div class='drill' id='miniTrack'>" + beats.map(function (b, i) { return "<div class='mini-beat' style='left:" + b * 100 + "%'>" + ["L", "R", "L", "⤴"][i] + "</div>"; }).join("") +
        "<div class='drill-m' id='miniM'></div></div>");
      var t0 = performance.now() + 500, hits = [], fin = false;
      function pos(now) { return (now - t0) / dur; }
      function frame(now) { if (fin) return; var u = pos(now); var m = $("miniM"); if (m) m.style.left = clamp(u, 0, 1) * 100 + "%"; if (u > 1.05) return end(); requestAnimationFrame(frame); }
      function step() {
        if (fin) return;
        var u = pos(performance.now() - 40), i = hits.length;
        if (i >= beats.length) return;
        var d = Math.abs(u - beats[i]);
        hits.push(d < 0.035 ? 1 : d < 0.07 ? 0.6 : d < 0.12 ? 0.3 : 0);
        var bt = document.querySelectorAll(".mini-beat")[i]; if (bt) bt.classList.add(hits[i] >= 0.6 ? "ok" : "bad");
        if (hits.length === beats.length) end();
      }
      function end() { if (fin) return; fin = true; off(); while (hits.length < beats.length) hits.push(0); done(res, hits.reduce(function (a, b) { return a + b; }, 0) / beats.length); }
      var off = keys(function (ev) { if (ev.type === "keydown" && ev.code === "Space" && !ev.repeat) { ev.preventDefault(); step(); } });
      btn("STEP!", "big").onclick = step;
      requestAnimationFrame(frame);
    });
  }

  // ---------- catch: platform under the falling balls ----------
  function catchGame(title, text, e) {
    return new Promise(function (res) {
      open(title, text, "catch", "<canvas id='miniCv' class='mini-cv' width='320' height='220'></canvas><p class='center' id='miniRep'>0 / 4</p>");
      var cv = $("miniCv"), g = cv.getContext("2d"), px = 160, ball = null, n = 0, got = 0, fin = false, last = performance.now(), held = 0, pw = 58 - e * 10;
      function spawn() { ball = { x: rnd(30, 290), y: -10, vx: rnd(-50, 50), vy: 120 + (1 - e) * 10 + n * 18 }; }
      function frame(now) {
        if (fin) return;
        var dt = Math.min(0.05, (now - last) / 1000); last = now;
        px = clamp(px + held * 260 * dt, 20, 300);
        if (!ball) spawn();
        ball.x += ball.vx * dt; ball.y += ball.vy * dt; ball.vy += 120 * dt;
        if (ball.x < 10 || ball.x > 310) ball.vx *= -1;
        if (ball.y >= 196) {
          var off2 = Math.abs(ball.x - px); n++;
          if (off2 <= pw / 2) got += off2 < pw / 5 ? 1 : 0.75;
          $("miniRep").textContent = Math.round(got * 100) / 100 + " / 4"; ball = null;
          if (n >= 4) { fin = true; offK(); return done(res, got / 4); }
        }
        g.fillStyle = "#cfe3f7"; g.fillRect(0, 0, 320, 220); g.fillStyle = "#e8a64a"; g.fillRect(0, 205, 320, 15);
        g.fillStyle = "#1e63ff"; g.fillRect(px - pw / 2, 198, pw, 8); g.fillStyle = "#ffd21e"; g.fillRect(px - pw / 10, 198, pw / 5, 8);
        if (ball) { g.fillStyle = "#ffd500"; g.beginPath(); g.arc(ball.x, ball.y, 8, 0, 6.28); g.fill(); g.strokeStyle = "#1e4fd8"; g.lineWidth = 2; g.beginPath(); g.arc(ball.x, ball.y, 5, 0.3, 1.8); g.stroke(); }
        requestAnimationFrame(frame);
      }
      function move(ev) { var r = cv.getBoundingClientRect(), x = ((ev.touches ? ev.touches[0].clientX : ev.clientX) - r.left) * 320 / r.width; px = clamp(x, 20, 300); }
      cv.addEventListener("mousemove", move); cv.addEventListener("touchmove", function (ev) { ev.preventDefault(); move(ev); }, { passive: false });
      var Lb = btn("◀"), Rb = btn("▶");
      [[Lb, -1], [Rb, 1]].forEach(function (p) {
        p[0].onmousedown = p[0].ontouchstart = function () { held = p[1]; };
        p[0].onmouseup = p[0].onmouseleave = p[0].ontouchend = function () { held = 0; };
      });
      var offK = keys(function (ev) {
        if (ev.code === "ArrowLeft") held = ev.type === "keydown" ? -1 : 0;
        if (ev.code === "ArrowRight") held = ev.type === "keydown" ? 1 : 0;
      });
      requestAnimationFrame(frame);
    });
  }

  // ---------- power: hold to charge, release in the gold ----------
  function power(title, text, e) {
    return new Promise(function (res) {
      var lo = 0.78 - e * 0.04, hi = 0.94;
      open(title, text, "power", "<div class='drill'><div class='drill-g' style='left:" + lo * 100 + "%;width:" + (hi - lo) * 100 + "%'></div><div class='mini-fill' id='miniFill'></div></div>");
      var t0 = 0, holding = false, fin = false, start = performance.now(), dur = 1150 - e * 150;
      function level(now) { return ((now - t0) / dur) % 1.1; }
      function frame(now) {
        if (fin) return;
        var f = $("miniFill"); if (f) f.style.width = (holding ? Math.min(1, level(now)) * 100 : 0) + "%";
        if (!holding && now - start > 7000) return release();
        requestAnimationFrame(frame);
      }
      function press() { if (fin || holding) return; holding = true; t0 = performance.now(); }
      function release() {
        if (fin) return; fin = true; off();
        var v = holding ? level(performance.now()) : 0, mid = (lo + hi) / 2;
        var q = v >= lo && v <= hi ? 1 - Math.abs(v - mid) / ((hi - lo) / 2) * 0.15 : v > hi ? 0.1 : clamp(v / lo, 0, 1) * 0.6;
        done(res, q, Math.round(Math.min(1, v) * 100) + "%");
      }
      var b = btn("HOLD TO CHARGE", "big");
      b.onmousedown = b.ontouchstart = function (ev) { if (ev.type === "touchstart") ev.preventDefault(); press(); };
      b.onmouseup = b.ontouchend = function () { if (holding) release(); };
      var off = keys(function (ev) { if (ev.code !== "Space") return; ev.preventDefault(); if (ev.type === "keydown" && !ev.repeat) press(); if (ev.type === "keyup" && holding) release(); });
      requestAnimationFrame(frame);
    });
  }

  // ---------- tap: sprint drill ----------
  function tap(title, text, e) {
    return new Promise(function (res) {
      var goal = 16 + Math.round(e * 6);
      open(title, text, "tap", "<div class='mini-react' id='miniTap'>0 / " + goal + "</div><div class='drill'><div class='mini-fill' id='miniFill'></div></div>");
      var n = 0, t0 = 0, fin = false, idle = setTimeout(function () { if (!t0) { t0 = performance.now(); setTimeout(end, 3000); } }, 4000);
      function hit() {
        if (fin) return;
        if (!t0) { t0 = performance.now(); clearTimeout(idle); setTimeout(end, 3000); }
        n++; $("miniTap").textContent = n + " / " + goal; $("miniFill").style.width = Math.min(100, n / goal * 100) + "%";
      }
      function end() { if (fin) return; fin = true; off(); done(res, n / goal, "(" + n + " taps)"); }
      var off = keys(function (ev) { if (ev.type === "keydown" && ev.code === "Space" && !ev.repeat) { ev.preventDefault(); hit(); } });
      btn("TAP!", "big").onclick = hit;
    });
  }

  function bar(title, text, e) { return VB.drillBar(title, text, { goodW: clamp(0.18 + e * 0.12, 0.16, 0.3), speed: 1500 - e * 120 }); }

  var GAMES = { bar: bar, target: target, reaction: reaction, memory: memory, read: read, rhythm: rhythm, catch: catchGame, power: power, tap: tap };
  // play a specific game, or one that suits the attribute (never the same one twice in a row if it can help it)
  function play(kind, title, text, lvl) {
    var e = clamp(((lvl || 70) - 60) / 35, 0, 1);
    return GAMES[kind](title, text, e);
  }
  function forAttr(attr, title, text, lvl) {
    var opts = (FOR[attr] || ["bar"]).filter(function (k) { return k !== last; });
    var k = pick(opts.length ? opts : FOR[attr] || ["bar"]); last = k;
    return play(k, title, text, lvl);
  }
  VB.Mini = { play: play, forAttr: forAttr, KINDS: Object.keys(GAMES), NAME: NAME };
})(window.VB);
