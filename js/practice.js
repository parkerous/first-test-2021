// Home screen practice court: your team (story school, career club, or Karasuno) running drills —
// a spiking line off the setter, a pepper pair, a server, and a libero diving for balls.
(function (VB) {
  "use strict";
  var rnd = VB.rnd, pick = VB.pick;
  var CW = 640, CHH = 340, SC = 3, NETY = 112;
  var SHOUTS = ["NICE!", "ONE MORE!", "CHANCE BALL!", "MINE!", "COVER!", "GOOD PASS!", "HIGHER!", "LET'S GO!", "FAST ONE!", "AGAIN!"];
  var OWN = { BOKUTO: "HEY HEY HEY!", HINATA: "I'M HERE!", KAGEYAMA: "...Again.", NISHINOYA: "ROLLING THUNDER!", TANAKA: "OSSU!!", OIKAWA: "Nice serve~", KUROO: "Connect!",
              KENMA: "...can we stop?", USHIJIMA: "Hm.", ATSUMU: "Give me a better pass!", TSUKISHIMA: "It's just a club.", LEV: "I'm the ace!", SAWAMURA: "Focus!", HOSHIUMI: "Watch me fly!" };

  // ---------- which teams can practise here ----------
  function gachaFace(name) {
    if (VB.skinFace) { var sk = VB.skinFace(name); if (sk) return sk; }
    var c = VB.Gacha && VB.Gacha.cards.find(function (x) { return x.id === name; });
    return c ? JSON.parse(JSON.stringify(c.face)) : null;
  }
  function hqTeam(id) {
    var t = VB.HQ_ALL.find(function (x) { return x.id === id; });
    if (!t) return null;
    var players = VB.ROLES.map(function (r) {
      var n = (t.players || {})[r] || r, f = gachaFace(n) || { skin: VB.SKINS[0], hair: "#17120d", style: "flat", mouth: true };
      return { name: n, role: VB.FAMILY[r], face: f };
    });
    return { label: t.name, kit: t.kit, kit2: t.kit2, id: t.id, players: players };
  }
  function teams() {
    var out = [];
    for (var s = 1; s <= 3; s++) {
      var S = null; try { S = JSON.parse(localStorage.getItem("hqStory.slot" + s) || "null"); } catch (e) {}
      if (S && S.players && S.squad) {
        var t = VB.HQ_ALL.find(function (x) { return x.id === S.school; }) || (S.locals || []).find(function (x) { return x.id === S.school; });
        if (t) out.push({ label: t.name + " (STORY " + s + ")", kit: t.kit, kit2: t.kit2, id: t.id, players: S.squad.slice(0, 12).map(function (id) {
          var p = S.players[id]; return { name: id === "you" ? p.name + " (YOU)" : p.name, role: p.role, face: (id !== "you" && VB.skinFace && VB.skinFace(p.name)) || p.face, you: id === "you" };
        }) });
      }
    }
    for (var c = 1; c <= 3; c++) {
      var C = null; try { C = JSON.parse(localStorage.getItem("vnlCareer.slot" + c) || "null"); } catch (e) {}
      if (C && C.club && C.clubs && C.clubs[C.club]) {
        var cl = C.clubs[C.club];
        out.push({ label: cl.name + " (CAREER " + c + ")", kit: cl.kit, kit2: cl.kit2, id: cl.id, players: cl.roster.slice(0, 12).map(function (id) {
          var p = C.players[id]; return p ? { name: id === "you" ? p.name + " (YOU)" : p.name, role: p.role, face: p.face, you: id === "you" } : null;
        }).filter(Boolean) });
      }
    }
    ["KAR", "NEK", "FUK", "INA"].forEach(function (id) { var t = hqTeam(id); if (t) out.push(t); });
    return out;
  }

  // ---------- the scene ----------
  function mount(cv, teamIdx) {
    var g = cv.getContext("2d"); g.imageSmoothingEnabled = false;
    var list = teams(), T = list[((teamIdx || 0) % list.length + list.length) % list.length];
    var pat = VB.Engine.kitPattern(T.id);
    var ps = T.players.map(function (p, i) {
      var kit = p.role === "L" ? (T.kit2 || "#ffffff") : T.kit, kit2 = p.role === "L" ? T.kit : T.kit2;
      return { name: p.name, role: p.role, you: p.you, spr: VB.Engine.makeSprite(kit, p.face, kit2, pat), x: 60 + i * 40, y: 300, tx: 60 + i * 40, ty: 300, lift: 0, bubble: null, task: null };
    });
    // roles for the drills
    var setter = ps.find(function (p) { return p.role === "S"; }) || ps[0];
    var lib = ps.find(function (p) { return p.role === "L" && p !== setter; });
    var rest = ps.filter(function (p) { return p !== setter && p !== lib; });
    var hitters = rest.filter(function (p) { return p.role !== "L"; }).slice(0, 4);
    if (hitters.length < 2) hitters = rest.slice(0, 3);
    var others = rest.filter(function (p) { return hitters.indexOf(p) < 0; });
    var pepper = [lib || others.shift(), others.shift()].filter(Boolean);
    var server = others.shift() || null;
    var digger = others.shift() || null;
    var bench = others;
    setter.tx = setter.x = 380; setter.ty = setter.y = NETY + 40;
    hitters.forEach(function (h, i) { h.x = h.tx = 110 + i * 26; h.y = h.ty = 262 + (i % 2) * 6; });
    pepper.forEach(function (p, i) { p.x = p.tx = 500 + i * 80; p.y = p.ty = 250 - i * 40; });
    if (server) { server.x = server.tx = 590; server.y = server.ty = 272; }
    if (digger) { digger.x = digger.tx = 250; digger.y = digger.ty = 240; }
    bench.forEach(function (p, i) { p.x = p.tx = 24 + (i % 2) * 22; p.y = p.ty = 160 + i * 24; p.sitting = true; });

    var balls = [], fx = [], t0 = performance.now(), last = t0, clock = 0;
    var spike = { ph: "idle", t: 0, h: null }, pep = { t: 0, dir: 0 }, srv = { t: rnd(1, 3) }, dig = { t: rnd(2, 4) };
    function say(p, txt, sec) { p.bubble = { text: txt, until: clock + (sec || 1.6) }; }
    function ballArc(x0, y0, x1, y1, h, dur, onEnd, hot) { balls.push({ x0: x0, y0: y0, x1: x1, y1: y1, h: h, t: 0, dur: dur, end: onEnd, hot: hot }); }
    function shock(x, y, col) { fx.push({ k: "ring", x: x, y: y, t: 0, col: col || "rgba(255,210,30," }); }

    function update(dt) {
      clock += dt;
      ps.forEach(function (p) {
        var dx = p.tx - p.x, dy = p.ty - p.y, d = Math.hypot(dx, dy), sp = 130 * dt;
        if (d > 1) { p.x += dx / d * Math.min(sp, d); p.y += dy / d * Math.min(sp, d); p.walk = true; } else p.walk = false;
        if (p.lift > 0) p.lift = Math.max(0, p.lift - dt * 1);
      });
      // spiking line: setter sets the front hitter, who approaches, jumps and swings
      spike.t += dt;
      if (spike.ph === "idle" && spike.t > 0.8 && hitters.length) {
        spike.h = hitters[0]; spike.ph = "approach"; spike.t = 0;
        spike.h.tx = 300 + rnd(-30, 30); spike.h.ty = NETY + 42;
        ballArc(setter.x, setter.y - 40, spike.h.tx + 8, NETY + 30, 70, 1.0);
        setter.lift = 0.3;
      } else if (spike.ph === "approach" && spike.t > 0.95) {
        spike.ph = "hit"; spike.t = 0; spike.h.lift = 0.6;
        var good = Math.random() < 0.8;
        shock(spike.h.x, spike.h.y - 60);
        ballArc(spike.h.x + 6, spike.h.y - 70, rnd(120, 560), good ? rnd(20, 70) : NETY - 2, good ? 6 : 2, good ? 0.35 : 0.3, function (b) {
          fx.push({ k: "dust", x: b.x1, y: b.y1, t: 0 });
          if (!good) say(spike.h, "Argh, net!", 1.2); else if (Math.random() < 0.4) say(pick(ps), pick(["NICE KILL!", "WHAT A SPIKE!", "STRAIGHT!", "CROSS!"]), 1.2);
        }, good);
      } else if (spike.ph === "hit" && spike.t > 0.7) {
        var h = hitters.shift(); hitters.push(h);
        hitters.forEach(function (q, i) { q.tx = 110 + i * 26; q.ty = 262 + (i % 2) * 6; });
        spike.ph = "idle"; spike.t = 0;
      }
      // pepper: pass, set, hit back and forth
      if (pepper.length === 2) {
        pep.t += dt;
        if (pep.t > 0.9) {
          pep.t = 0; var a = pepper[pep.dir], b = pepper[1 - pep.dir];
          ballArc(a.x + 6, a.y - 30, b.x + 6, b.y - 30, pep.k % 3 === 2 ? 10 : 40, 0.8);
          pep.k = (pep.k || 0) + 1; pep.dir = 1 - pep.dir; a.lift = pep.k % 3 === 2 ? 0.25 : 0.08;
          if (Math.random() < 0.08) say(a, pick(["MINE!", "GOOD!", "HEY!"]), 1);
        }
      }
      // server: toss, jump serve over the net
      if (server) {
        srv.t -= dt;
        if (srv.t <= 0) {
          srv.t = rnd(2.4, 3.6); server.lift = 0.5;
          ballArc(server.x + 6, server.y - 70, rnd(140, 520), rnd(20, 70), 14, 0.6, function (b) { fx.push({ k: "dust", x: b.x1, y: b.y1, t: 0 }); }, true);
          if (Math.random() < 0.3) say(server, pick(["NICE SERVE!", "ACE!", "ONE MORE!"]), 1.2);
        }
      }
      // digger: the coach's ball, a flying dive
      if (digger) {
        dig.t -= dt;
        if (dig.t <= 0) {
          dig.t = rnd(2.2, 3.4); var side = Math.random() < 0.5 ? -1 : 1, home = { x: 250, y: 240 };
          digger.tx = home.x + side * 50; digger.ty = home.y; digger.dive = { t: 0, dir: side };
          ballArc(380, NETY + 20, home.x + side * 56, home.y - 8, 20, 0.55, function () {
            ballArc(home.x + side * 56, home.y - 20, home.x - side * 30, home.y - 90, 60, 0.9);
            fx.push({ k: "dust", x: digger.x, y: digger.y, t: 0 });
            if (Math.random() < 0.5) say(digger, pick(["UP!", "GOT IT!", "ONE MORE!"]), 1);
            setTimeout(function () { digger.tx = home.x; digger.ty = home.y; digger.dive = null; }, 700);
          });
        }
      }
      if (Math.random() < dt * 0.25 && bench.length) say(pick(bench), pick(SHOUTS), 1.4);
      balls = balls.filter(function (b) { b.t += dt / b.dur; if (b.t >= 1) { if (b.end) b.end(b); return false; } return true; });
    }

    // ---------- drawing ----------
    function gym() {
      // back wall with windows and the team banner
      var gr = g.createLinearGradient(0, 0, 0, 80); gr.addColorStop(0, "#c9b48a"); gr.addColorStop(1, "#a8915f");
      g.fillStyle = gr; g.fillRect(0, 0, CW, 80);
      for (var w = 0; w < 6; w++) { g.fillStyle = "#cfe8ff"; g.fillRect(30 + w * 104, 5, 60, 16); g.fillStyle = "#8aa8c8"; g.fillRect(59 + w * 104, 5, 2, 16); }
      g.fillStyle = T.kit; g.fillRect(170, 25, 300, 30);
      g.fillStyle = T.kit2 || "#ffffff"; g.fillRect(170, 25, 300, 4); g.fillRect(170, 51, 300, 4);
      g.font = '12px "Press Start 2P", monospace'; g.textAlign = "center"; g.textBaseline = "middle";
      g.fillStyle = T.kit2 && T.kit2.toLowerCase() !== T.kit.toLowerCase() ? T.kit2 : "#ffffff";
      g.fillText(T.label.replace(/ \((STORY|CAREER) \d\)/, "").slice(0, 24), 320, 40);
      // wooden floor, planks
      g.fillStyle = "#d9a35b"; g.fillRect(0, 80, CW, CHH - 80);
      for (var y = 84; y < CHH; y += 12) { g.fillStyle = y % 24 ? "rgba(120,70,20,0.10)" : "rgba(255,240,200,0.10)"; g.fillRect(0, y, CW, 6); }
      g.strokeStyle = "rgba(255,255,255,0.85)"; g.lineWidth = 3;
      g.strokeRect(60, 84, 520, CHH - 70);
      g.beginPath(); g.moveTo(60, NETY + 70); g.lineTo(580, NETY + 70); g.stroke();      // 3m line
      g.fillStyle = "rgba(230,120,30,0.35)"; g.fillRect(63, 87, 514, NETY - 87);         // far court
      // net
      g.fillStyle = "#2a2f38"; g.fillRect(56, NETY - 52, 5, 54); g.fillRect(579, NETY - 52, 5, 54);
      g.fillStyle = "rgba(20,20,20,0.3)"; g.fillRect(61, NETY - 50, 518, 26);
      g.strokeStyle = "rgba(240,240,240,0.5)"; g.lineWidth = 1;
      for (var x = 61; x < 579; x += 10) { g.beginPath(); g.moveTo(x, NETY - 50); g.lineTo(x, NETY - 24); g.stroke(); }
      g.fillStyle = "#f5f5f5"; g.fillRect(61, NETY - 52, 518, 4);
      // ball cart and a bench
      g.fillStyle = "#6b6b6b"; g.fillRect(420, 150, 34, 22); g.fillStyle = "#2b2b2b"; g.fillRect(422, 172, 4, 4); g.fillRect(448, 172, 4, 4);
      for (var k = 0; k < 6; k++) vball(426 + (k % 3) * 10, 148 + Math.floor(k / 3) * 7, 5);
      g.fillStyle = "#8a5a2a"; g.fillRect(8, 150, 54, 6 + bench.length * 24);
    }
    function vball(x, y, r) {
      g.fillStyle = "#ffd500"; g.beginPath(); g.arc(x, y, r, 0, 6.28); g.fill();
      g.strokeStyle = "#1e4fd8"; g.lineWidth = Math.max(1, r * 0.35); g.beginPath(); g.arc(x, y, r * 0.6, 0.3, 1.8); g.stroke();
    }
    function bubble(x, y, t) {
      g.font = '15px "VT323", monospace'; var w = g.measureText(t).width + 12;
      g.fillStyle = "#ffffff"; g.strokeStyle = "#13293f"; g.lineWidth = 2;
      g.fillRect(x - w / 2, y - 18, w, 18); g.strokeRect(x - w / 2, y - 18, w, 18);
      g.fillStyle = "#13293f"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(t, x, y - 9);
    }
    function drawP(p) {
      var jump = p.lift > 0 ? Math.sin(Math.min(1, p.lift / 0.6) * Math.PI) * 34 * Math.min(1, p.lift * 2.5) : 0;
      var bob = p.walk ? Math.abs(Math.sin(clock * 14 + p.x)) * 2 : 0;
      g.fillStyle = "rgba(60,30,0,0.28)"; g.beginPath(); g.ellipse(p.x + 18, p.y + 46, 14, 4, 0, 0, 6.28); g.fill();
      if (p.you) { g.strokeStyle = "#ffd21e"; g.lineWidth = 2; g.beginPath(); g.ellipse(p.x + 18, p.y + 46, 18, 6, 0, 0, 6.28); g.stroke(); }
      if (p.dive) { g.save(); g.translate(p.x + 18, p.y + 40); g.rotate(p.dive.dir * 1.2); g.drawImage(p.spr, -18, -48, 12 * SC, 16 * SC); g.restore(); }
      else if (p.sitting) g.drawImage(p.spr, 0, 0, 12, 13, p.x, p.y, 12 * SC, 13 * SC);
      else g.drawImage(p.spr, p.x, p.y - jump - bob, 12 * SC, 16 * SC);
      if (p.lift > 0.3 && jump > 10) { g.fillStyle = "rgba(255,255,255,0.5)"; g.fillRect(p.x + 2, p.y - jump - 10, 4, 12); g.fillRect(p.x + 30, p.y - jump - 10, 4, 12); }   // arms up
      g.font = '13px "VT323", monospace'; g.textAlign = "center"; g.textBaseline = "top";
      g.fillStyle = "rgba(19,41,63,0.75)"; var nm = p.name.slice(0, 12), w = g.measureText(nm).width + 6;
      g.fillRect(p.x + 18 - w / 2, p.y + 49, w, 13); g.fillStyle = p.you ? "#ffd21e" : "#ffffff"; g.fillText(nm, p.x + 18, p.y + 49);
    }
    function frame(now) {
      if (!cv.isConnected) return;
      var dt = Math.min(0.05, (now - last) / 1000); last = now;
      update(dt);
      gym();
      var items = ps.map(function (p) { return { y: p.y, p: p }; });
      balls.forEach(function (b) { var x = b.x0 + (b.x1 - b.x0) * b.t, y = b.y0 + (b.y1 - b.y0) * b.t - Math.sin(b.t * Math.PI) * b.h; items.push({ y: Math.max(b.y0, b.y1) - 30, b: { x: x, y: y, hot: b.hot } }); });
      items.sort(function (a, b) { return a.y - b.y; });
      items.forEach(function (it) {
        if (it.p) return drawP(it.p);
        if (it.b.hot) { g.fillStyle = "rgba(255,140,40,0.35)"; g.beginPath(); g.arc(it.b.x, it.b.y, 10, 0, 6.28); g.fill(); }
        vball(it.b.x, it.b.y, 7);
      });
      fx = fx.filter(function (e) {
        e.t += dt;
        if (e.k === "ring") { g.strokeStyle = e.col + (1 - e.t * 2.5) + ")"; g.lineWidth = 3; g.beginPath(); g.ellipse(e.x + 18, e.y + 30, 10 + e.t * 90, 4 + e.t * 30, 0, 0, 6.28); g.stroke(); return e.t < 0.4; }
        if (e.k === "dust") { g.fillStyle = "rgba(160,120,70," + (0.6 - e.t) + ")"; g.beginPath(); g.arc(e.x, e.y - e.t * 10, 3 + e.t * 12, 0, 6.28); g.fill(); return e.t < 0.6; }
        return false;
      });
      ps.forEach(function (p) { if (p.bubble && clock < p.bubble.until) bubble(p.x + 18, p.y - 8 - (p.lift > 0 ? 30 : 0), p.bubble.text); });
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
    cv.onclick = function (e) {
      var r = cv.getBoundingClientRect(), x = (e.clientX - r.left) * CW / r.width, y = (e.clientY - r.top) * CHH / r.height;
      var hit = ps.find(function (p) { return x > p.x - 4 && x < p.x + 40 && y > p.y - 10 && y < p.y + 60; });
      if (!hit) return;
      var base = hit.name.replace(" (YOU)", "");
      say(hit, hit.you ? "Let's work!" : OWN[base] || pick(SHOUTS), 1.8); hit.lift = 0.45;
    };
    return { label: T.label, count: list.length };
  }

  VB.Practice = { mount: mount, teams: teams };
})(window.VB);
