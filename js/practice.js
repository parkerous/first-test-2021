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
  // Everything lives on the gym floor (gx, gy) with a height z above it: the ball is drawn at gy − z with a
  // shadow on the floor, so sets arc, spikes drive DOWN into the far court and bounce, and passes stay low.
  var NET = 178, NET_TOP = 62, FAR = [92, 168], SPR_H = 48;
  function mount(cv, teamIdx) {
    var g = cv.getContext("2d"); g.imageSmoothingEnabled = false;
    var list = teams(), T = list[((teamIdx || 0) % list.length + list.length) % list.length];
    var pat = VB.Engine.kitPattern(T.id);
    var ps = T.players.map(function (p) {
      var kit = p.role === "L" ? (T.kit2 || "#ffffff") : T.kit, kit2 = p.role === "L" ? T.kit : T.kit2;
      return { name: p.name, role: p.role, you: p.you, spr: VB.Engine.makeSprite(kit, p.face, kit2, pat), x: 320, y: 300, tx: 320, ty: 300, z: 0, vz: 0, bubble: null };
    });
    var setter = ps.find(function (p) { return p.role === "S"; }) || ps[0];
    var lib = ps.find(function (p) { return p.role === "L" && p !== setter; });
    var rest = ps.filter(function (p) { return p !== setter && p !== lib; });
    var hitters = rest.filter(function (p) { return p.role !== "L"; }).slice(0, 4);
    if (hitters.length < 2) hitters = rest.slice(0, 3);
    var others = rest.filter(function (p) { return hitters.indexOf(p) < 0; });
    var pepper = [lib || others.shift(), others.shift()].filter(Boolean);
    var server = others.shift() || null, digger = others.shift() || null, bench = others;
    function place(p, x, y) { p.x = p.tx = x; p.y = p.ty = y; }
    var SET_SPOT = { x: 392, y: NET + 22 }, LINE = function (i) { return { x: 112 + i * 30, y: 300 + (i % 2) * 10 }; };
    place(setter, SET_SPOT.x, SET_SPOT.y);
    hitters.forEach(function (h, i) { var l = LINE(i); place(h, l.x, l.y); });
    var PEP = [{ x: 470, y: 296 }, { x: 560, y: 250 }];
    pepper.forEach(function (p, i) { place(p, PEP[i].x, PEP[i].y); });
    if (server) place(server, 600, 330);
    var DIG_HOME = { x: 262, y: 262 };
    if (digger) place(digger, DIG_HOME.x, DIG_HOME.y);
    bench.forEach(function (p, i) { place(p, 26 + (i % 2) * 24, 206 + i * 22); p.sitting = true; });

    var balls = [], fx = [], last = performance.now(), clock = 0, tally = { k: 0, a: 0, d: 0 };
    var coach = { name: "COACH", spr: VB.Engine.makeSprite("#2b2f3a", { skin: "#e0b48a", hair: "#3a3a3a", style: "crew", mouth: true }, "#ffffff"), x: 331, y: NET + 12, tx: 331, ty: NET + 12, z: 0, vz: 0, coach: true };
    function say(p, txt, sec) { if (p) p.bubble = { text: txt, until: clock + (sec || 1.6) }; }
    // a ball flight: ground path a→b, height z0→z1 with an arc of height h; then optionally bounce and roll
    function fly(a, b, z0, z1, h, dur, o) {
      o = o || {};
      balls.push({ ax: a.x, ay: a.y, bx: b.x, by: b.y, z0: z0, z1: z1, h: h, t: 0, dur: dur, hot: o.hot, bounce: o.bounce, end: o.end, x: a.x, y: a.y, z: z0 });
    }
    function jump(p, h) { p.vz = Math.sqrt(2 * 900 * h); }
    function shock(x, y, z) { fx.push({ k: "ring", x: x, y: y, z: z, t: 0 }); }

    var spike = { ph: "idle", t: 0.5, h: null }, pep = { t: 0, dir: 0, k: 0 }, srv = { t: 1.5, ph: 0 }, dig = { t: 2.5 };
    function update(dt) {
      clock += dt;
      ps.forEach(function (p) {
        var dx = p.tx - p.x, dy = p.ty - p.y, d = Math.hypot(dx, dy), sp = (p.run ? 190 : 120) * dt;
        if (d > 1) { p.x += dx / d * Math.min(sp, d); p.y += dy / d * Math.min(sp, d); p.walk = true; } else { p.walk = false; p.run = false; }
        if (p.vz || p.z > 0) { p.z += p.vz * dt; p.vz -= 900 * dt; if (p.z <= 0) { if (p.vz < -200) fx.push({ k: "dust", x: p.x, y: p.y, t: 0 }); p.z = 0; p.vz = 0; } }
      });
      // spiking line: the setter sets the front hitter, who approaches, jumps and swings down into the far court
      spike.t -= dt;
      if (spike.ph === "idle" && spike.t <= 0 && hitters.length) {
        var h = spike.h = hitters[0]; spike.ph = "set"; spike.t = 1.05;
        h.tx = 300 + rnd(-40, 30); h.ty = NET + 30; h.run = true;
        fly({ x: setter.x, y: setter.y }, { x: h.tx + 4, y: h.ty }, SPR_H + 8, SPR_H + 46, 70, 1.05);
        jump(setter, 6);
      } else if (spike.ph === "set" && spike.t <= 0.32 && !spike.jumped) {
        spike.jumped = true; jump(spike.h, 40);
      } else if (spike.ph === "set" && spike.t <= 0) {
        var hh = spike.h, good = Math.random() < 0.82;
        spike.ph = "hit"; spike.t = 0.9; spike.jumped = false;
        shock(hh.x, hh.y, SPR_H + 46);
        if (good) fly({ x: hh.x + 4, y: hh.y }, { x: rnd(140, 520), y: rnd(FAR[0], FAR[1] - 18) }, SPR_H + 46, 0, -6, 0.3, { hot: true, bounce: true,
          end: function () { tally.k++; if (Math.random() < 0.4) say(pick(ps), pick(["NICE KILL!", "WHAT A SPIKE!", "STRAIGHT!", "CROSS!"]), 1.2); } });
        else fly({ x: hh.x + 4, y: hh.y }, { x: hh.x + rnd(-20, 20), y: NET + 2 }, SPR_H + 46, NET_TOP - 30, -4, 0.2, { bounce: true, end: function () { say(hh, "Argh — the net!", 1.2); } });
      } else if (spike.ph === "hit" && spike.t <= 0) {
        var q = hitters.shift(); hitters.push(q);
        hitters.forEach(function (p, i) { var l = LINE(i); p.tx = l.x; p.ty = l.y; });
        spike.ph = "idle"; spike.t = 0.45;
      }
      // pepper: pass – set – hit, low arcs between two players
      if (pepper.length === 2) {
        pep.t -= dt;
        if (pep.t <= 0) {
          var a = pepper[pep.dir], b = pepper[1 - pep.dir], k = pep.k % 3;
          if (k === 2) { jump(a, 14); fly(a, b, SPR_H + 18, 18, -2, 0.45); } else fly(a, b, k === 0 ? 18 : SPR_H + 6, k === 1 ? SPR_H + 18 : SPR_H + 6, k === 0 ? 46 : 56, 0.95);
          pep.t = k === 2 ? 0.45 : 0.95; pep.k++; pep.dir = 1 - pep.dir;
          if (Math.random() < 0.06) say(a, pick(["MINE!", "GOOD!", "UP!"]), 1);
        }
      }
      // server: toss, jump, drive it over the net into the far court
      if (server) {
        srv.t -= dt;
        if (srv.ph === 0 && srv.t <= 0) { srv.ph = 1; srv.t = 0.7; fly(server, server, SPR_H - 6, SPR_H + 70, 26, 0.7); }
        else if (srv.ph === 1 && srv.t <= 0.28 && !srv.j) { srv.j = true; jump(server, 34); }
        else if (srv.ph === 1 && srv.t <= 0) {
          srv.ph = 0; srv.j = false; srv.t = rnd(2.6, 3.8); shock(server.x, server.y, SPR_H + 70);
          fly(server, { x: rnd(150, 520), y: rnd(FAR[0], FAR[1] - 10) }, SPR_H + 70, 0, 34, 0.75, { hot: true, bounce: true, end: function () { tally.a++; } });
          if (Math.random() < 0.3) say(server, pick(["NICE SERVE!", "ACE!", "ONE MORE!"]), 1.2);
        }
      }
      // digger: the coach drives balls at them from a box by the net; they dig it up to the setter's spot
      if (digger) {
        dig.t -= dt;
        if (dig.t <= 0) {
          dig.t = rnd(2.4, 3.4); var side = Math.random() < 0.5 ? -1 : 1, spot = { x: DIG_HOME.x + side * 46, y: DIG_HOME.y + rnd(-6, 10) };
          digger.tx = spot.x - 4; digger.ty = spot.y; digger.run = true; coach.swing = clock;
          if (Math.random() < 0.2) say(coach, pick(["AGAIN!", "LOWER!", "MOVE YOUR FEET!", "GOOD!"]), 1.1);
          fly({ x: 330, y: NET + 12 }, spot, SPR_H + 40, 14, -4, 0.42, { end: function () {
            digger.dive = { t: 0, dir: side }; fx.push({ k: "dust", x: digger.x, y: digger.y, t: 0 }); tally.d++;
            fly(spot, { x: SET_SPOT.x - 20, y: SET_SPOT.y + 16 }, 14, 0, 90, 1.25, { bounce: true });
            if (Math.random() < 0.5) say(digger, pick(["UP!", "GOT IT!", "ONE MORE!"]), 1);
            setTimeout(function () { digger.dive = null; digger.tx = DIG_HOME.x; digger.ty = DIG_HOME.y; }, 650);
          } });
        }
      }
      if (Math.random() < dt * 0.25 && bench.length) say(pick(bench), pick(SHOUTS), 1.4);
      // balls in flight, then a bounce or two and a short roll
      balls = balls.filter(function (b) {
        if (b.rolling) {
          b.rt += dt; b.x += b.vx * dt; b.y += b.vy * dt; b.vx *= 0.97; b.vy *= 0.97;
          b.z = Math.max(0, b.bz * Math.abs(Math.sin(b.rt * Math.PI / 0.28)) * Math.pow(0.45, Math.floor(b.rt / 0.28)));
          return b.rt < 1.4;
        }
        b.t += dt / b.dur;
        var u = Math.min(1, b.t);
        b.x = b.ax + (b.bx - b.ax) * u; b.y = b.ay + (b.by - b.ay) * u;
        b.z = b.z0 + (b.z1 - b.z0) * u + Math.sin(u * Math.PI) * b.h;
        if (b.t < 1) return true;
        if (b.end) b.end(b);
        if (b.bounce) {
          fx.push({ k: "dust", x: b.x, y: b.y, t: 0 });
          var d = Math.hypot(b.bx - b.ax, b.by - b.ay) || 1;
          b.rolling = true; b.rt = 0; b.bz = 16; b.vx = (b.bx - b.ax) / d * 70; b.vy = (b.by - b.ay) / d * 70;
          return true;
        }
        return false;
      });
    }

    // ---------- drawing ----------
    function gym() {
      var gr = g.createLinearGradient(0, 0, 0, 72); gr.addColorStop(0, "#c9b48a"); gr.addColorStop(1, "#a8915f");
      g.fillStyle = gr; g.fillRect(0, 0, CW, 72);
      for (var w = 0; w < 6; w++) { g.fillStyle = "#cfe8ff"; g.fillRect(30 + w * 104, 6, 60, 16); g.fillStyle = "#8aa8c8"; g.fillRect(59 + w * 104, 6, 2, 16); }
      g.fillStyle = T.kit; g.fillRect(170, 28, 300, 28);
      g.fillStyle = T.kit2 || "#ffffff"; g.fillRect(170, 28, 300, 3); g.fillRect(170, 53, 300, 3);
      g.font = '12px "Press Start 2P", monospace'; g.textAlign = "center"; g.textBaseline = "middle";
      g.fillStyle = T.kit2 && T.kit2.toLowerCase() !== T.kit.toLowerCase() ? T.kit2 : "#ffffff";
      g.fillText(T.label.replace(/ \((STORY|CAREER) \d\)/, "").slice(0, 24), 320, 42);
      // the drill scoreboard (left) and the coach's whiteboard (right)
      g.fillStyle = "#11151c"; g.fillRect(14, 26, 146, 38); g.strokeStyle = "#5a6270"; g.lineWidth = 2; g.strokeRect(14, 26, 146, 38);
      g.font = '7px "Press Start 2P", monospace'; g.textAlign = "left"; g.textBaseline = "top";
      [["KILLS", tally.k, "#ff8a3a"], ["ACES", tally.a, "#7fd8ff"], ["DIGS", tally.d, "#3dff7a"]].forEach(function (c, i) {
        g.fillStyle = "#9aa3b2"; g.fillText(c[0], 20 + i * 48, 31); g.fillStyle = c[2]; g.font = '12px "Press Start 2P", monospace'; g.fillText(String(c[1] % 1000), 20 + i * 48, 44); g.font = '7px "Press Start 2P", monospace';
      });
      g.fillStyle = "#f4f6f8"; g.fillRect(482, 24, 144, 42); g.strokeStyle = "#8a96a6"; g.strokeRect(482, 24, 144, 42);
      g.fillStyle = "#1e4fd8"; g.font = '13px "VT323", monospace'; g.fillText("TODAY: SPIKE LINE", 488, 26); g.fillStyle = "#e0348a"; g.fillText("PEPPER • SERVE • DIG", 488, 38);
      g.fillStyle = "#13293f"; g.fillText("1-2-3 FIGHT!!", 488, 50);
      g.fillStyle = "#7a5a32"; g.fillRect(0, 70, CW, 4);                                  // skirting board
      g.fillStyle = "#d9a35b"; g.fillRect(0, 74, CW, CHH - 74);
      for (var y = 78; y < CHH; y += 12) { g.fillStyle = y % 24 ? "rgba(120,70,20,0.10)" : "rgba(255,240,200,0.10)"; g.fillRect(0, y, CW, 6); }
      g.fillStyle = "rgba(230,120,30,0.28)"; g.fillRect(72, 84, 496, NET - 84);              // the far court
      g.strokeStyle = "rgba(255,255,255,0.9)"; g.lineWidth = 3;
      g.strokeRect(70, 82, 500, CHH);
      g.beginPath(); g.moveTo(70, NET - 52); g.lineTo(570, NET - 52); g.moveTo(70, NET + 52); g.lineTo(570, NET + 52); g.stroke();   // attack lines
      g.fillStyle = "#6b6b6b"; g.fillRect(432, NET + 34, 30, 18); g.fillStyle = "#2b2b2b"; g.fillRect(434, NET + 52, 4, 4); g.fillRect(456, NET + 52, 4, 4);
      for (var k = 0; k < 6; k++) vball(437 + (k % 3) * 9, NET + 33 + Math.floor(k / 3) * 6, 4.5);
      g.fillStyle = "#4a4a4a"; g.fillRect(318, NET + 4, 26, 12);                             // the coach's box
      g.fillStyle = "#8a5a2a"; g.fillRect(14, 200, 52, 10 + bench.length * 22);              // bench
      for (var wb = 0; wb < Math.min(4, bench.length + 1); wb++) { g.fillStyle = wb % 2 ? "#3a8ad8" : "#e8e8e8"; g.fillRect(70, 206 + wb * 14, 5, 10); g.fillStyle = "#13293f"; g.fillRect(70, 204 + wb * 14, 5, 2); }   // water bottles
    }
    function netDraw() {
      g.fillStyle = "rgba(0,0,0,0.18)"; g.fillRect(64, NET, 512, 4);
      g.fillStyle = "#2a2f38"; g.fillRect(62, NET - NET_TOP - 4, 5, NET_TOP + 6); g.fillRect(573, NET - NET_TOP - 4, 5, NET_TOP + 6);
      g.fillStyle = "rgba(20,20,20,0.28)"; g.fillRect(67, NET - NET_TOP, 506, 26);
      g.strokeStyle = "rgba(240,240,240,0.5)"; g.lineWidth = 1;
      for (var x = 67; x < 573; x += 9) { g.beginPath(); g.moveTo(x, NET - NET_TOP); g.lineTo(x, NET - NET_TOP + 26); g.stroke(); }
      for (var yy = 1; yy < 3; yy++) { g.beginPath(); g.moveTo(67, NET - NET_TOP + yy * 9); g.lineTo(573, NET - NET_TOP + yy * 9); g.stroke(); }
      g.fillStyle = "#f5f5f5"; g.fillRect(67, NET - NET_TOP - 2, 506, 4);
      [70, 570].forEach(function (ax) { for (var s = 0; s < 4; s++) { g.fillStyle = s % 2 ? "#ffffff" : "#e8352e"; g.fillRect(ax - 1, NET - NET_TOP - 2 - (s + 1) * 6, 3, 6); } });
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
    function drawCoach() {
      var sw = coach.swing != null && clock - coach.swing < 0.25;
      g.fillStyle = "rgba(60,30,0,0.3)"; g.beginPath(); g.ellipse(coach.x, coach.y, 13, 4, 0, 0, 6.28); g.fill();
      g.drawImage(coach.spr, coach.x - 18, coach.y - SPR_H - 8, 12 * SC, 16 * SC);
      if (sw) { g.fillStyle = "rgba(255,230,200,0.95)"; g.fillRect(coach.x - 3, coach.y - SPR_H - 22, 5, 15); }      // the arm comes over
      g.font = '13px "VT323", monospace'; g.textAlign = "center"; g.textBaseline = "top"; var w = g.measureText("COACH").width + 6;
      g.fillStyle = "rgba(19,41,63,0.75)"; g.fillRect(coach.x - w / 2, coach.y + 3, w, 13); g.fillStyle = "#ffd21e"; g.fillText("COACH", coach.x, coach.y + 3);
    }
    function drawP(p) {
      var bob = p.walk ? Math.abs(Math.sin(clock * 14 + p.x)) * 2 : 0;
      g.fillStyle = "rgba(60,30,0," + (0.3 - Math.min(0.15, p.z / 300)) + ")"; g.beginPath(); g.ellipse(p.x, p.y, 13 - Math.min(4, p.z / 12), 4, 0, 0, 6.28); g.fill();
      if (p.you) { g.strokeStyle = "#ffd21e"; g.lineWidth = 2; g.beginPath(); g.ellipse(p.x, p.y, 17, 6, 0, 0, 6.28); g.stroke(); }
      if (p.dive) { g.save(); g.translate(p.x, p.y - 8); g.rotate(p.dive.dir * 1.25); g.drawImage(p.spr, -18, -SPR_H + 8, 12 * SC, 16 * SC); g.restore(); }
      else if (p.sitting) g.drawImage(p.spr, 0, 0, p.spr.width, p.spr.height * 13 / 16, p.x - 18, p.y - 39, 12 * SC, 13 * SC);
      else {
        g.drawImage(p.spr, p.x - 18, p.y - SPR_H - p.z - bob, 12 * SC, 16 * SC);
        if (p.z > 12) { g.fillStyle = "rgba(255,230,200,0.9)"; g.fillRect(p.x - 15, p.y - SPR_H - p.z - 12, 4, 13); g.fillRect(p.x + 11, p.y - SPR_H - p.z - 12, 4, 13); }   // arms up
      }
      g.font = '13px "VT323", monospace'; g.textAlign = "center"; g.textBaseline = "top";
      var nm = p.name.slice(0, 12), w = g.measureText(nm).width + 6;
      g.fillStyle = "rgba(19,41,63,0.75)"; g.fillRect(p.x - w / 2, p.y + 3, w, 13); g.fillStyle = p.you ? "#ffd21e" : "#ffffff"; g.fillText(nm, p.x, p.y + 3);
    }
    function frame(now) {
      if (!cv.isConnected) return;
      var dt = Math.min(0.05, (now - last) / 1000); last = now;
      update(dt);
      gym();
      // shadows of the balls on the floor first
      balls.forEach(function (b) { g.fillStyle = "rgba(60,30,0," + Math.max(0.08, 0.35 - b.z / 400) + ")"; g.beginPath(); g.ellipse(b.x, b.y, Math.max(3, 7 - b.z / 40), 2.5, 0, 0, 6.28); g.fill(); });
      var items = ps.map(function (p) { return { y: p.y, p: p }; }).concat([{ y: NET, net: true }]);
      items.push({ y: coach.y, coach: true });
      balls.forEach(function (b) { items.push({ y: b.y + 0.5, b: b }); });
      items.sort(function (a, b) { return a.y - b.y; });
      items.forEach(function (it) {
        if (it.net) return netDraw();
        if (it.coach) return drawCoach();
        if (it.p) return drawP(it.p);
        var b = it.b;
        if (b.hot && !b.rolling) { g.fillStyle = "rgba(255,140,40,0.35)"; g.beginPath(); g.arc(b.x, b.y - b.z, 10, 0, 6.28); g.fill(); }
        vball(b.x, b.y - b.z, 6.5);
      });
      fx = fx.filter(function (e) {
        e.t += dt;
        if (e.k === "ring") { g.strokeStyle = "rgba(255,210,30," + Math.max(0, 1 - e.t * 2.5) + ")"; g.lineWidth = 3; g.beginPath(); g.ellipse(e.x, e.y - e.z, 8 + e.t * 70, 4 + e.t * 26, 0, 0, 6.28); g.stroke(); return e.t < 0.4; }
        if (e.k === "dust") { g.fillStyle = "rgba(160,120,70," + Math.max(0, 0.55 - e.t) + ")"; g.beginPath(); g.ellipse(e.x, e.y, 4 + e.t * 18, 2 + e.t * 5, 0, 0, 6.28); g.fill(); return e.t < 0.55; }
        return false;
      });
      ps.concat([coach]).forEach(function (p) { if (p.bubble && clock < p.bubble.until) bubble(p.x, p.y - SPR_H - 6 - p.z - (p.coach ? 8 : 0), p.bubble.text); });
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
    cv.onclick = function (e) {
      var r = cv.getBoundingClientRect(), x = (e.clientX - r.left) * CW / r.width, y = (e.clientY - r.top) * CHH / r.height;
      var hit = ps.find(function (p) { return Math.abs(x - p.x) < 20 && y > p.y - SPR_H - 6 && y < p.y + 16; });
      if (!hit) return;
      var base = hit.name.replace(" (YOU)", "");
      say(hit, hit.you ? "Let's work!" : OWN[base] || pick(SHOUTS), 1.8); if (!hit.sitting && hit.z === 0) jump(hit, 22);
    };
    return { label: T.label, count: list.length };
  }

  VB.Practice = { mount: mount, teams: teams };
})(window.VB);
