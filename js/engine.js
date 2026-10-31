// Match engine: rally simulation, decisions, animation, arena rendering and box scores.
(function (VB) {
  "use strict";
  var U = VB.ui, $ = U.$;
  var rnd = VB.rnd, irnd = VB.irnd, clamp = VB.clamp, clamp01 = VB.clamp01, pick = VB.pick;

  // ================== GEOMETRY ==================
  // Court space is 480×700 written from YOUR side (bottom); P() mirrors it for the top team.
  // The canvas is bigger so the arena (boards, stands, crowd) can surround the court.
  var CW = 640, CH = 900, OX = 80, OY = 100;
  var W = 480, H = 700, NET = 360;
  var CL = 70, CR = 410, CT = 90, CB = 630, ATK = 90;
  var XL = 140, XM = 240, XR = 340;
  var SLOT_X = { 1: XR, 2: XR, 3: XM, 4: XL, 5: XL, 6: XM };
  function P(side, x, y) { return side === 0 ? { x: x, y: y } : { x: W - x, y: 2 * NET - y }; }
  function isFrontSlot(k) { return k >= 2 && k <= 4; }
  function slotPoint(side, k) { return P(side, SLOT_X[k], isFrontSlot(k) ? NET + 50 : NET + 212); }
  function setterSpot(side) { return P(side, 292, NET + 40); }      // the setter's home: between P2 and P3
  function serveFrom(side) { return P(side, XR - 10, CB + 34); }
  function clampHalf(s, pt) {
    return {
      x: clamp(pt.x, CL + 12, CR - 12),
      y: s.side === 0 ? clamp(pt.y, NET + 18, CB - 8) : clamp(pt.y, CT + 8, NET - 18)
    };
  }

  var ROLES = VB.ROLES;
  var ROT_ORDER = ["S", "OH1", "MB1", "OP", "OH2", "MB2"];          // P1..P6 at rotation 1
  var SKILL_CD = { spike: 4, block: 4, rec: 3, dump: 5, dig: 3, serve: 3 };
  var LIBERO_KITS = ["#ffd21e", "#111111", "#ffffff", "#00b3a4", "#ff7a00", "#7b4bd0"];
  var SHANK_P = 0.07;
  var FLOW_BOOST = 8, FLOW_ATTRS = ["srv", "rec", "set", "att", "blk", "def"];
  var GRADE_TXT = ["POOR PASS", "GOOD PASS", "PERFECT PASS"];
  var BLOCK_TXT = ["NO BLOCK", "SINGLE BLOCK", "DOUBLE BLOCK", "TRIPLE BLOCK"];

  // ================== STATE ==================
  var cv, g;
  var me = null, opp = null, cfg = null;
  // your team's tactics (kept between matches)
  var TAC_OPTS = {
    block: [["default", "BALANCED"], ["read", "READ BLOCK"], ["guess", "GUESS BLOCK"]],
    lean: [["auto", "AUTO"], ["line", "TAKE LINE"], ["cross", "TAKE CROSS (LINE OPEN)"]],
    call: [["ask", "ASK ME EVERY TIME"], ["feed", "SET ME (NO ASKING)"], ["never", "SETTER DECIDES"]],
    rot: [["51", "5-1"], ["42", "4-2"]]
  };
  var TAC = { block: "default", lean: "auto", call: "ask", rot: "51" };
  try { Object.assign(TAC, JSON.parse(localStorage.getItem("retroVB.tactics") || "{}")); } catch (e) {}
  function saveTac() { try { localStorage.setItem("retroVB.tactics", JSON.stringify(TAC)); } catch (e) {} }
  function tacName(k) { return (TAC_OPTS[k].find(function (o) { return o[0] === TAC[k]; }) || TAC_OPTS[k][0])[1]; }
  // 4-2: when the setter is in the back row, the front-row opposite sets instead
  function frontSetter(s) { return s === me && TAC.rot === "42" && !isFront(s, "S") && isFront(s, "OP") && s.onCourt.indexOf("OP") >= 0; }
  function isSetter(s, role) { return role === "S" || (role === "OP" && frontSetter(s)); }
  var setsWon = [0, 0], setNeed = 1, setLog = [];
  var score = [0, 0], serving = 0;
  var ball = { x: W / 2, y: H - 80, h: 0, visible: false, spin: 0, rot: 0 };
  var aimPreview = null, aimCtx = null, timeScale = 1, gt = 0;
  var popups = [], puffs = [];
  var cheerAt = -9999, refFlagSide = 0, refFlagAt = -9999, netShakeAt = -99;
  var flames = [], lastScorer = null, flowLog = [];
  var mode = "full", myRole = null, mateRole = null;
  // co-op streaming: the host records what happens (ball flights, jumps, effects) for the guest's engine to replay
  var evq = null, mute = 0, spectating = false, curFloor = "arena", flySeq = 0;
  function emit(e) { if (evq && !mute) evq.push(e); }
  function xy(p) { return { x: Math.round(p.x * 10) / 10, y: Math.round(p.y * 10) / 10 }; }
  function netShake() { netShakeAt = gt; emit({ k: "net" }); }           // mateRole: the co-op partner's player (P2), controlled remotely
  var bg = null, crowdFrames = [], fans = [], arenaTheme = null;
  var lastFrame = 0;

  function iControl(role) { return mode === "full" || role === myRole || (!!mateRole && role === mateRole && VB.Coop && VB.Coop.live()); }   // P2 left? their player plays on as AI
  function isMate(role) { return !!mateRole && role === mateRole && VB.Coop && VB.Coop.live(); }
  function humans() { return [myRole, mateRole].filter(Boolean); }
  // every decision goes to whoever controls that player: you, here — or P2, over the co-op link
  function askB(role, list) {
    if (!isMate(role)) return U.buttons(list);
    var def = (list.find(function (o) { return !o.disabled; }) || list[0]).value;
    $("actions").innerHTML = "<div class='coop-wait'>⏳ P2 IS DECIDING…</div>";
    return VB.Coop.ask("buttons", { list: list, msg: $("msg").textContent }, def).then(function (v) { $("actions").innerHTML = ""; return v; });
  }
  // pausing (stats panel open) freezes the ball, players, timers and the timing bar
  var paused = false, pausedTotal = 0, pauseStart = 0;
  function setPaused(on) {
    if (on === paused) return;
    if (on) pauseStart = performance.now(); else pausedTotal += performance.now() - pauseStart;
    paused = on;
  }
  function gclock() { return performance.now() - pausedTotal - (paused ? performance.now() - pauseStart : 0); }
  function sleep(ms) {
    return new Promise(function (res) {
      var end = gclock() + ms;
      (function tick() { var left = end - gclock(); if (left <= 0) res(); else setTimeout(tick, Math.min(50, left)); })();
    });
  }
  // dead time between points / sets / timeouts follows the PACE setting (timing bars and ball flights never change)
  var PACES = { fast: 0.45, normal: 1, tv: 1.35 };
  function rest(ms) { var k = 1; try { k = PACES[localStorage.getItem("retroVB.pace") || "normal"] || 1; } catch (e) {} return sleep(ms * k); }
  function slow() { timeScale = 0.2; }
  function fast() { timeScale = 1; }
  function other(s) { return s === me ? opp : me; }
  function pointTo(s) { return s === me ? 0 : 1; }
  // ---- drama: class gaps, momentum runs, timeouts, set/match point, comebacks, epic rallies, challenges ----
  var pow = [80, 80], mom = [0, 0], run = { side: -1, n: 0 }, tos = [2, 2], trail = [0, 0], comeback = [false, false], rallyDigs = 0, drama = null;
  function edge(s) { return (pow[s.side] - pow[1 - s.side]) / 100; }        // the better team simply wins more of the duels
  function resetDrama() { mom = [0, 0]; run = { side: -1, n: 0 }; tos = [2, 2]; trail = [0, 0]; comeback = [false, false]; rallyDigs = 0; }
  function banner(text, sub, col, secs) { emit({ k: "ban", a: [text, sub, col, secs] }); drama = { text: text, sub: sub || "", col: col || "#ffd21e", at: performance.now(), dur: (secs || 1.6) * 1000 }; }
  function drawDrama(now) {
    if (!drama) return;
    var t = (now - drama.at) / drama.dur;
    if (t > 1) { drama = null; return; }
    var a = Math.min(1, t * 6, (1 - t) * 5), sc = t < 0.12 ? 0.6 + t / 0.12 * 0.45 : 1.05 - Math.min(0.05, (t - 0.12) * 0.2);
    g.save(); g.globalAlpha = a;
    g.fillStyle = "rgba(5,10,30,0.72)"; g.fillRect(0, 392, CW, drama.sub ? 96 : 70);
    g.fillStyle = drama.col; g.fillRect(0, 392, CW, 4); g.fillRect(0, (drama.sub ? 484 : 458), CW, 4);
    g.translate(CW / 2, 428); g.scale(sc, sc);
    g.font = '26px "Press Start 2P", monospace'; g.textAlign = "center"; g.textBaseline = "middle";
    g.lineWidth = 7; g.strokeStyle = "#05070b"; g.strokeText(drama.text, 0, 0, CW - 30);
    g.fillStyle = drama.col; g.fillText(drama.text, 0, 0, CW - 30);
    if (drama.sub) { g.font = '22px "VT323", monospace'; g.fillStyle = "#ffffff"; g.fillText(drama.sub, 0, 36, CW - 40); }
    g.restore();
  }
  var TIMEOUT_TALK = ["Breathe. One point at a time.", "Serve tough and trust the block!", "They're reading our sets — mix it up!",
                      "Talk to each other out there!", "Forget the score. Win the next rally.", "Their hitter loves the line — take it away!"];
  function teamOf(i) { return i === 0 ? me : opp; }
  function preRally() {
    rallyDigs = 0;
    var to = (cfg && cfg.setsTo) || 15, hi = Math.max(score[0], score[1]), lead = score[0] > score[1] ? 0 : score[1] > score[0] ? 1 : -1;
    if (lead >= 0 && score[lead] >= to - 1) {
      var mp = setsWon[lead] + 1 >= setNeed, side = teamOf(lead);
      banner(mp ? "MATCH POINT" : "SET POINT", side.team.name + " " + score[lead] + "-" + score[1 - lead], mp ? "#ff4d6d" : "#ffd21e", 1.3);
      if (mp) feed(lead, "🔥 MATCH POINT " + side.team.name + "!", true);
      cheer();
    } else if (lead < 0 && hi >= to - 1) { banner("DEUCE!", score[0] + "-" + score[1] + " — win by two", "#7fd8ff", 1.2); }
  }
  async function postRally(winner) {
    var loser = 1 - winner, W0 = teamOf(winner), L0 = teamOf(loser);
    if (run.side === winner) run.n++; else run = { side: winner, n: 1 };
    mom[winner] = Math.min(0.05, (run.n - 1) * 0.015); mom[loser] = 0;
    trail[loser] = Math.max(trail[loser], score[winner] - score[loser]);
    if (rallyDigs >= 3) { banner("WHAT A RALLY!", rallyDigs + " digs — the crowd is on its feet", "#3dff7a", 1.8); feed(-1, "👏 Standing ovation after a " + rallyDigs + "-dig rally!", true); cheer(); await rest(500); }
    else if (score[winner] > score[loser] && trail[winner] >= 4 && !comeback[winner]) {
      comeback[winner] = true; banner("COMEBACK!", W0.team.name + " were down " + trail[winner] + " — now they lead", "#3dff7a", 1.8);
      feed(winner, "🔄 COMEBACK! " + W0.team.name + " take the lead after trailing by " + trail[winner] + "!", true); cheer();
    } else if (run.n === 3 || run.n === 5 || run.n === 7) {
      banner(run.n >= 5 ? "ON FIRE!" : run.n + "-0 RUN!", W0.team.name + (run.n >= 5 ? " — " + run.n + " straight points" : " have the momentum"), "#ff9a3a", 1.2);
    }
    var to = (cfg && cfg.setsTo) || 15;
    if (run.n >= 4 && tos[loser] > 0 && Math.max(score[0], score[1]) < to) {
      tos[loser]--;
      await rest(400);
      banner("TIMEOUT", L0.team.name + " — " + tos[loser] + " left", "#ffffff", 1.6);
      feed(loser, "⏸ TIMEOUT " + L0.team.name + ". Coach: \"" + pick(TIMEOUT_TALK) + "\"", true);
      await rest(1700);
      mom = [0, 0]; run = { side: -1, n: 0 };
    }
  }
  function nearLine(pt) { return Math.min(Math.abs(pt.x - CL), Math.abs(pt.x - CR), Math.abs(pt.y - CB), Math.abs(pt.y - CT)) < 24; }
  function cheer() { cheerAt = performance.now(); emit({ k: "cheer" }); sfx("cheer"); }
  function sfx(n, o) { if (VB.Sfx) VB.Sfx.play(n, o); }
  // home-crowd chants when the home team serves
  var chant = null, homeIdx = 0;
  function startChant(srv) {
    var t = srv.team, sh = (t.short || t.name).split(" ")[0], Sv = srv.roster[srv.lineup[1]];
    var jp = t.nat === "JPN" || t.id === "JPN" || VB.HQ_ALL.some(function (x) { return x.id === t.id; });
    var to = (cfg && cfg.setsTo) || 15, big = score[srv.side] >= to - 1;
    var list = [sh + "! " + sh + "! CLAP CLAP CLAP!", (jp ? "NAISSA! NAISSA!" : "NICE SERVE! NICE SERVE!"), Sv.name + "! " + Sv.name + "! " + Sv.name + "!",
                "ACE! ACE! ACE!", "LET'S GO " + sh + "! LET'S GO!"];
    if (BANNER_TXT[t.id]) list.push(BANNER_TXT[t.id][0] + "! " + BANNER_TXT[t.id][0] + "!");
    if (big) list = ["ONE MORE POINT! ONE MORE!", "FINISH IT! FINISH IT!"];
    chant = { text: pick(list), at: performance.now(), col: t.kit };
    emit({ k: "chant", c: { text: chant.text, col: chant.col } });
    feed(srv.side, "🎵 The home crowd: \"" + chant.text + "\"");
  }
  function drawChant(now) {
    if (!chant) return;
    var t = (now - chant.at) / 1000;
    if (t > 2.6) { chant = null; return; }
    var a = Math.min(1, t * 4, (2.6 - t) * 3), pulse = 1 + Math.max(0, Math.sin(t * Math.PI * 3.3)) * 0.08;
    g.save(); g.globalAlpha = a;
    g.font = '13px "Press Start 2P", monospace'; g.textAlign = "center"; g.textBaseline = "middle";
    [[320, 62], [320, 858]].forEach(function (pt) {
      var w = Math.min(624, g.measureText(chant.text).width + 24);
      g.save(); g.translate(pt[0], pt[1]); g.scale(pulse, pulse);
      g.fillStyle = "rgba(5,7,11,0.78)"; g.fillRect(-w / 2, -13, w, 26);
      g.fillStyle = mix(chant.col, "#ffffff", 0.25); g.fillRect(-w / 2, 10, w, 3);
      g.fillStyle = "#ffd21e"; g.fillText(chant.text, 0, 1, w - 16);
      g.restore();
    });
    g.restore();
  }
  function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
  function msg(t) { U.msg(t); }
  function feed(side, t, hot) { U.feed(side, t, hot); }

  // ================== COLOURS ==================
  function hexRGB(h) { return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]; }
  function rgbHex(c) { return "#" + c.map(function (v) { return ("0" + clamp(Math.round(v), 0, 255).toString(16)).slice(-2); }).join(""); }
  function mix(a, b, t) { var x = hexRGB(a), y = hexRGB(b); return rgbHex([0, 1, 2].map(function (i) { return x[i] + (y[i] - x[i]) * t; })); }
  function kitClash(a, b) { var x = hexRGB(a), y = hexRGB(b); return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]) < 95; }
  function pickLiberoKit(teamKit, avoid) {
    return LIBERO_KITS.find(function (col) {
      return !kitClash(col, teamKit) && avoid.every(function (a) { return !kitClash(col, a); });
    }) || "#ffd21e";
  }

  // ================== SPRITES ==================
  var STYLE_IDX = ["buzz", "flat", "spiky", "bald"];
  // face: { skin, hair, style (index or name), hair2?, ex?: ["glasses","beard","streak","roots"], mouth }
  var KIT_PATS = ["trim", "stripe", "sash", "shoulder", "panel"];
  function kitPattern(id) { var h = 0; String(id || "").split("").forEach(function (ch) { h = (h * 31 + ch.charCodeAt(0)) >>> 0; }); return KIT_PATS[h % KIT_PATS.length]; }
  function makeSprite(kit, face, kit2, pat, num) {
    if (VB.Sprite) return VB.Sprite.make(kit, face, kit2, pat, num);                 // the 24×32 chibi sprites (js/sprites.js)
    var c = document.createElement("canvas");
    c.width = 12; c.height = 16;
    var q = c.getContext("2d");
    function p(x, y, col) { q.fillStyle = col; q.fillRect(x, y, 1, 1); }
    function row(x1, x2, y, col) { q.fillStyle = col; q.fillRect(x1, y, x2 - x1 + 1, 1); }
    var hs = typeof face.style === "string" ? face.style : STYLE_IDX[face.style || 0] || "buzz";
    var H = face.hair, H2 = face.hair2 || mix(H, "#000000", 0.45), ex = face.ex || [];
    var topFace = { flat: 3, long: 3, bowl: 3, bedhead: 3, fluffy: 3, crew: 3, fringe: 3, middle: 3, crop: 3, afro: 3, wavy: 3, braids: 3 }[hs] || 2;
    var HL = mix(H, "#ffffff", 0.22), HD = mix(H, "#000000", 0.35);
    // realistic cuts
    if (hs === "crew") { row(3, 8, 1, H); row(3, 8, 2, H); p(2, 2, HD); p(9, 2, HD); }
    if (hs === "sidepart") { row(3, 8, 0, H); p(4, 0, HL); row(2, 9, 1, H); p(2, 2, H); p(9, 2, H); row(5, 8, 2, H); }
    if (hs === "fringe") { row(3, 8, 0, H); row(2, 9, 1, H); row(2, 9, 2, H); }
    if (hs === "middle") { row(3, 8, 0, H); p(5, 0, HD); p(6, 0, HD); row(2, 9, 1, H); row(2, 4, 2, H); row(7, 9, 2, H); }
    if (hs === "undercut") { row(3, 8, 0, H); row(3, 8, 1, H); p(4, 0, HL); p(2, 2, HD); p(9, 2, HD); }
    if (hs === "crop") { row(3, 8, 0, H); p(4, 0, HL); p(7, 0, HL); row(2, 9, 1, H); row(3, 8, 2, H); }
    if (hs === "afro") { row(2, 9, 0, H); row(1, 10, 1, H); row(1, 10, 2, H); p(3, 0, HL); p(7, 1, HL); }
    if (hs === "slick") { row(3, 8, 0, H); p(5, 0, HL); p(6, 0, HL); row(2, 9, 1, H); }
    if (hs === "bun") { p(5, 0, HD); p(6, 0, HD); row(3, 8, 1, H); }
    if (hs === "wavy") { row(3, 8, 0, H); row(2, 9, 1, H); row(2, 9, 2, H); p(4, 1, HL); p(7, 1, HL); }
    if (hs === "braids") { for (var bx = 3; bx <= 8; bx++) { p(bx, 0, bx % 2 ? H : HD); p(bx, 1, bx % 2 ? HD : H); } row(2, 9, 2, H); }
    if (hs === "long") { for (var yy = 2; yy <= 7; yy++) { p(2, yy, H); p(9, yy, H); } }
    if (hs === "buzz") row(3, 8, 1, H);
    if (hs === "flat" || hs === "long") { row(2, 9, 1, H); row(2, 9, 2, H); }
    if (hs === "spiky") { for (var x = 2; x <= 9; x += 2) p(x, 0, H); row(2, 9, 1, H); }
    if (hs === "bowl" || hs === "fluffy") { row(3, 8, 0, H); row(2, 9, 1, H); row(2, 9, 2, H); }
    if (hs === "mohawk") { row(5, 6, 0, H); row(4, 7, 1, H); p(3, 1, mix(H, "#000000", 0.5)); p(8, 1, mix(H, "#000000", 0.5)); }
    if (hs === "bedhead") { p(1, 0, H); p(4, 0, H); p(7, 0, H); p(10, 0, H); row(1, 10, 1, H); row(2, 9, 2, H); }
    if (hs === "curly") { p(3, 0, H); p(5, 0, H); p(7, 0, H); row(2, 9, 1, H); }
    for (var y = topFace; y <= 5; y++) row(3, 8, y, face.skin);
    if (hs !== "bald" && hs !== "mohawk") { p(3, topFace, H); p(8, topFace, H); }
    if (hs === "bowl") row(3, 8, 3, H);                                   // heavy fringe
    if (hs === "fluffy" || hs === "long" || hs === "curly" || hs === "middle" || hs === "wavy") { p(2, 3, H); p(9, 3, H); }
    if (hs === "afro") { p(2, 3, H); p(9, 3, H); p(1, 3, H); p(10, 3, H); }
    if (hs === "braids") { p(2, 3, HD); p(9, 3, HD); p(2, 4, H); p(9, 4, H); }
    if (hs === "wavy") { p(2, 4, H); p(9, 4, H); }
    if (hs === "fringe") row(3, 5, 3, H);                                 // bangs
    if (hs === "curly") { p(2, 2, H); p(9, 2, H); }
    if (ex.indexOf("roots") >= 0) row(3, 8, 1, H2);                       // two-tone, dark roots
    if (ex.indexOf("streak") >= 0) { p(5, 1, H2); p(6, 1, H2); p(6, 0, H2); }   // coloured fringe streak
    p(4, 4, "#17120d"); p(7, 4, "#17120d");
    if (ex.indexOf("glasses") >= 0) { p(3, 4, "#2b2b2b"); p(5, 4, "#2b2b2b"); p(6, 4, "#2b2b2b"); p(8, 4, "#2b2b2b"); }
    if (ex.indexOf("sunglasses") >= 0) { row(3, 8, 4, "#111111"); p(4, 4, "#3a5a8a"); p(7, 4, "#3a5a8a"); }
    row(5, 6, 5, face.mouth ? "#a33d4d" : face.skin);
    if (ex.indexOf("beard") >= 0) { p(3, 5, H); p(4, 5, H); p(7, 5, H); p(8, 5, H); }
    if (ex.indexOf("stubble") >= 0) { var SB = mix(face.skin, H, 0.4); p(3, 5, SB); p(4, 5, SB); p(7, 5, SB); p(8, 5, SB); }
    if (ex.indexOf("vampire") >= 0) { p(5, 5, "#ffffff"); p(6, 5, "#ffffff"); }
    if (ex.indexOf("santa") >= 0) { row(3, 8, 0, "#d62828"); row(2, 9, 1, "#d62828"); row(2, 9, 2, "#ffffff"); p(9, 0, "#d62828"); p(10, 0, "#ffffff"); }
    if (ex.indexOf("headband") >= 0) row(2, 9, 2, face.band || "#ffffff");
    // seasonal outfits
    if (ex.indexOf("witch") >= 0) { var WC = "#2b1b3d"; row(5, 6, 0, WC); row(4, 7, 1, WC); p(5, 1, "#ff8a1e"); p(6, 1, "#ff8a1e"); row(1, 10, 2, WC); }
    if (ex.indexOf("pumpkin") >= 0) { row(3, 8, 0, "#ff8a1e"); p(6, 0, "#2f8a4a"); row(2, 9, 1, "#ff8a1e"); p(4, 1, "#c25a00"); p(7, 1, "#c25a00"); }
    if (ex.indexOf("catears") >= 0) { var CE = face.ears || "#2b2b2b"; p(2, 0, CE); p(3, 0, CE); p(8, 0, CE); p(9, 0, CE); p(3, 1, "#ff9ac0"); p(8, 1, "#ff9ac0"); }
    if (ex.indexOf("strawhat") >= 0) { row(3, 8, 0, "#e8c66a"); row(3, 8, 1, "#d62828"); row(0, 11, 2, "#e8c66a"); }
    if (ex.indexOf("flower") >= 0) { p(9, 1, "#ff5fa2"); p(10, 1, "#ffd21e"); }
    if (ex.indexOf("crown") >= 0) { var GD = "#ffd21e"; p(3, 0, GD); p(5, 0, GD); p(6, 0, "#e0348a"); p(8, 0, GD); row(3, 8, 1, GD); }
    if (ex.indexOf("headphones") >= 0) { row(3, 8, 0, "#2b2b2b"); p(2, 1, "#2b2b2b"); p(9, 1, "#2b2b2b"); p(2, 3, "#e0348a"); p(9, 3, "#e0348a"); p(2, 4, "#e0348a"); p(9, 4, "#e0348a"); }
    if (ex.indexOf("cap") >= 0) { row(3, 8, 0, face.capc || "#1e4fd8"); row(2, 9, 1, face.capc || "#1e4fd8"); row(1, 5, 2, face.capc || "#1e4fd8"); }
    for (var y2 = 6; y2 <= 11; y2++) row(2, 9, y2, kit);
    var trim = kit2 && kit2.toLowerCase() !== String(kit).toLowerCase() ? kit2 : mix(kit, "#ffffff", 0.6);
    pat = pat || "trim";
    if (pat === "stripe") row(2, 9, 8, trim);
    if (pat === "sash") for (var sy = 0; sy < 6; sy++) p(8 - sy, 6 + sy, trim);
    if (pat === "shoulder") { row(2, 9, 6, trim); p(2, 7, trim); p(9, 7, trim); }
    if (pat === "panel") for (var py2 = 7; py2 <= 11; py2++) { p(2, py2, trim); p(9, py2, trim); }
    p(5, 6, pat === "shoulder" ? kit : trim); p(6, 6, pat === "shoulder" ? kit : trim);            // collar
    row(2, 9, 11, mix(kit, "#000000", 0.22));
    if (ex.indexOf("scarf") >= 0) { row(2, 9, 6, "#d22630"); row(3, 8, 7, "#d22630"); p(7, 8, "#d22630"); p(7, 9, "#ffffff"); }
    if (ex.indexOf("tank") >= 0) { p(2, 6, face.skin); p(9, 6, face.skin); p(2, 7, face.skin); p(9, 7, face.skin); }
    if (ex.indexOf("vampire") >= 0) { for (var vy = 4; vy <= 7; vy++) { p(1, vy, "#b0102a"); p(10, vy, "#b0102a"); } }
    p(1, 7, face.skin); p(10, 7, face.skin);
    p(1, 8, face.skin); p(10, 8, face.skin);
    var shorts = mix(kit, "#000000", 0.62);
    row(3, 8, 12, shorts); row(3, 8, 13, shorts); p(8, 12, trim);
    p(4, 14, face.skin); p(7, 14, face.skin);
    p(4, 15, "#eee"); p(7, 15, "#eee");
    return c;
  }
  function spriteURL(face, kit, kit2, pat) { return makeSprite(kit || "#888888", face, kit2, pat).toDataURL(); }

  var refSprite = null;
  function makeRefSprite(blazer) {
    var c = document.createElement("canvas"); c.width = 10; c.height = 14;
    var q = c.getContext("2d");
    function p(x, y, col) { q.fillStyle = col; q.fillRect(x, y, 1, 1); }
    function row(x1, x2, y, col) { q.fillStyle = col; q.fillRect(x1, y, x2 - x1 + 1, 1); }
    row(3, 6, 0, "#17120d");
    row(3, 6, 1, "#f0b990"); row(3, 6, 2, "#f0b990");
    p(4, 1, "#17120d"); p(6, 1, "#17120d");
    for (var y = 3; y <= 8; y++) row(2, 7, y, blazer);
    row(4, 5, 3, "#fff");
    row(2, 7, 9, "#222"); row(2, 7, 10, "#222");
    p(3, 11, "#f0b990"); p(6, 11, "#f0b990");
    p(3, 12, "#222"); p(6, 12, "#222");
    return c;
  }

  // ================== SIDES ==================
  function newStat() { var l = VB.Stats.newLine(); delete l.mp; return l; }
  function makeSide(team, side, kit, libKit, nums) {
    var roster = {}, taken = {}, hq = VB.HQ_ALL && VB.HQ_ALL.some(function (t) { return t.id === team.id; });
    ROLES.forEach(function (role) {
      var rec = team.lineup[role], num;
      var face = (hq && rec.id !== "you" && VB.skinFace && VB.skinFace(rec.name)) || rec.face;   // gacha skins dress the canon players
      if (nums && nums[role]) num = nums[role]; else { do { num = irnd(1, 24); } while (taken[num]); }
      taken[num] = 1;
      var reach = VB.reach(rec);
      roster[role] = {
        ref: rec, name: rec.name, num: num, face: face, skill: rec.skill || null, skillName: rec.skillName || null,
        cd: 0, ph: rnd(0, Math.PI * 2), streak: 0, flow: false, flowLeft: 0,
        ps: rec.ps || null,
        srv: rec.srv, rec: rec.rec, set: rec.set, att: rec.att, blk: rec.blk, def: rec.def, men: rec.men || 70, tec: rec.tec || 70, spd: rec.spd || 70,
        height: rec.height, vert: rec.vert, spikeReach: reach.spike, blockReach: reach.block,
        sprite: makeSprite(role === "L" ? libKit : kit, face, role === "L" ? kit : (kit === team.kit ? team.kit2 : team.kit), kitPattern(team.id), num),
        st: newStat()
      };
    });
    return { team: team, roster: roster, side: side, rot: 0, pos: {}, tgt: {}, anim: {}, rush: {},
             lineup: {}, onCourt: [], blockers: [], superBlocker: null };
  }

  // ================== SKILLS / FLOW ==================
  function sty(s) { return VB.STYLES[(s && s.team && s.team.play) || "balanced"] || VB.STYLES.balanced; }
  function skillLabel(Pl) { return Pl.skillName || VB.SKILL_TXT[Pl.skill]; }
  function roleOf(s, Pl) { return ROLES.find(function (r) { return s.roster[r] === Pl; }); }
  function ready(Pl, kind) { return Pl.skill === kind && Pl.cd === 0; }
  // a signature move is a real weapon: big banner, flash, and a much bigger effect than before
  function useSkill(s, Pl) {
    Pl.cd = SKILL_CD[Pl.skill];
    var at = s.pos[roleOf(s, Pl)] || { x: W / 2, y: NET };
    feed(s.side, "★ " + Pl.name + " — " + skillLabel(Pl) + "!", true);
    banner("★ " + skillLabel(Pl), Pl.name + " unleashes a signature move", s.side === 0 ? "#7fd8ff" : "#ff9ad5", 1.1);
    ring(at, "#7fd8ff", 46, 0.5); puff(at, 12, "#bff0ff");
    popup(skillLabel(Pl) + "!", at, "#7fd8ff");
  }
  function tickCooldowns() {
    [me, opp].forEach(function (s) {
      Object.keys(s.roster).forEach(function (r) { if (s.roster[r].cd > 0) s.roster[r].cd--; });
    });
  }
  function credit(s, role) {
    lastScorer = role ? { s: s, role: role } : null;            // errors give the point with no scorer
    return pointTo(s);
  }
  function setFlow(s, role, on) {
    var Pl = s.roster[role];
    if (Pl.flow === on) return;
    Pl.flow = on;
    FLOW_ATTRS.forEach(function (a) { Pl[a] += on ? FLOW_BOOST : -FLOW_BOOST; });
    if (on) {
      Pl.cd = 0; Pl.flowLeft = 2;
      flowLog.push({ side: s.side, id: Pl.ref.id, name: Pl.name });
      msg(Pl.name + " ENTERS THE FLOW STATE!");
      feed(s.side, "🔵🔥 " + Pl.name + " is in the FLOW STATE — three straight points! Skills recharged.", true);
      cheer();
    } else {
      feed(s.side, Pl.name + "'s flow fades...");
    }
  }
  function updateStreaks(winner) {
    var win = winner === 0 ? me : opp, lose = other(win);
    Object.keys(lose.roster).forEach(function (r) {
      var Pl = lose.roster[r];
      Pl.streak = 0;
      if (Pl.flow && --Pl.flowLeft <= 0) setFlow(lose, r, false);
    });
    if (lastScorer && lastScorer.s === win) {
      var Pl = win.roster[lastScorer.role];
      Pl.streak++;
      if (Pl.flow) Pl.flowLeft = 2;
      else if (Pl.streak >= 3) setFlow(win, lastScorer.role, true);
    }
    lastScorer = null;
  }
  function assist(atk, setterRole, hitter) { if (setterRole && setterRole !== hitter) atk.roster[setterRole].st.ast++; }

  // ================== ROTATION & LINEUP ==================
  function roleAt(s, k) { return ROT_ORDER[(k - 1 + s.rot) % 6]; }
  function frontRoles(s) { return [roleAt(s, 2), roleAt(s, 3), roleAt(s, 4)]; }
  function buildLineup(s, servingSide) {
    var lu = {};
    for (var k = 1; k <= 6; k++) {
      var r = roleAt(s, k);
      if (!isFrontSlot(k) && r.indexOf("MB") === 0 && !(k === 1 && servingSide === s.side)) r = "L";
      lu[k] = r;
    }
    s.lineup = lu;
    s.onCourt = [1, 2, 3, 4, 5, 6].map(function (k) { return lu[k]; });
  }
  function slotOfRole(s, role) { for (var k = 1; k <= 6; k++) if (s.lineup[k] === role) return k; return 0; }
  function isFront(s, role) { return frontRoles(s).indexOf(role) >= 0; }
  function passersOf(s) { return s.onCourt.filter(function (r) { return r === "L" || r.indexOf("OH") === 0; }); }
  function altSetter(s, exclude) {
    var back = s.onCourt.filter(function (r) { return r !== "S" && r !== exclude && !isFront(s, r); });
    return back.indexOf("L") >= 0 ? "L" : back[0];
  }

  // ================== FORMATIONS ==================
  function setTargets(s, map) {
    var snap = Object.keys(s.pos).length === 0;
    s.blockers = [];
    Object.keys(s.pos).forEach(function (r) { if (s.onCourt.indexOf(r) < 0) { delete s.pos[r]; delete s.tgt[r]; } });
    s.onCourt.forEach(function (r) {
      var t = map[r];
      if (!s.pos[r]) s.pos[r] = snap ? { x: t.x, y: t.y } : P(s.side, CL - 10, NET + ATK);
      s.tgt[r] = { x: t.x, y: t.y };
    });
  }
  function moveTo(s, role, pt) { if (role && s.tgt[role]) s.tgt[role] = { x: pt.x, y: pt.y }; }

  function serveFormation(s) {
    var m = {};
    s.onCourt.forEach(function (r) { m[r] = slotPoint(s.side, slotOfRole(s, r)); });
    m[s.lineup[1]] = serveFrom(s.side);
    return m;
  }
  function receiveFormation(s) {
    var m = {};
    var ps = passersOf(s).sort(function (a, b) { return SLOT_X[slotOfRole(s, a)] - SLOT_X[slotOfRole(s, b)]; });
    var lineX = ps.length === 3 ? [125, 240, 355] : [170, 310, 240];
    s.onCourt.forEach(function (r) {
      var k = slotOfRole(s, r), pi = ps.indexOf(r);
      if (pi >= 0) m[r] = P(s.side, lineX[pi], NET + 190);
      else if (isFrontSlot(k)) m[r] = P(s.side, SLOT_X[k], NET + 42);
      else m[r] = P(s.side, SLOT_X[k], NET + 125);
    });
    return m;
  }
  function baseX(s, r) {
    if (isFront(s, r)) return r.indexOf("OH") === 0 ? XL : r.indexOf("MB") === 0 ? XM : XR;
    return (r === "S" || r === "OP") ? XR : r.indexOf("OH") === 0 ? XM : XL;
  }
  function baseFormation(s) {
    var m = {};
    s.onCourt.forEach(function (r) { m[r] = P(s.side, baseX(s, r), isFront(s, r) ? NET + 45 : NET + 205); });
    return m;
  }
  function attackFormation(s, setterRole) {
    var m = baseFormation(s);
    s.onCourt.forEach(function (r) {
      if (r === setterRole) m[r] = setterSpot(s.side);
      else if (isFront(s, r)) m[r] = P(s.side, r.indexOf("OH") === 0 ? 112 : r.indexOf("MB") === 0 ? 250 : 368, NET + 112);
      else if (r === "OP") m[r] = P(s.side, 268, NET + 165);
    });
    return m;
  }
  function defenseFormation(s, ax, blockers) {
    var m = baseFormation(s);
    var tx = s.side === 0 ? ax : W - ax, lineRight = tx > W / 2;
    var lineX = lineRight ? CR - 34 : CL + 34, crossX = lineRight ? CL + 64 : CR - 64, dirIn = lineRight ? -1 : 1;
    s.onCourt.forEach(function (r) {
      if (blockers.indexOf(r) >= 0) return;
      var bx = baseX(s, r);
      if (isFront(s, r)) {
        // a front-rower not blocking: on the hitter's side they cover the short line/tip, otherwise the sharp cross
        var onLineSide = lineRight ? bx === XR : bx === XL;
        m[r] = onLineSide ? P(s.side, lineX + dirIn * 30, NET + 78) : P(s.side, bx === XM ? XM + dirIn * 30 : crossX + dirIn * 20, NET + ATK + 6);
        return;
      }
      var lineSide = lineRight ? bx === XR : bx === XL;
      if (lineSide) m[r] = P(s.side, lineX, NET + 188);                       // line, deep-ish
      else if (bx === XM) m[r] = P(s.side, XM - dirIn * 10, NET + 242);       // middle back, deep and central
      else m[r] = P(s.side, crossX, NET + 172);                                // cross
    });
    return m;
  }
  function chooseBlockers(s, ax, n) {
    if (n <= 0) return [];
    var front = frontRoles(s);
    var mb = front.find(function (r) { return r.indexOf("MB") === 0; });
    var rest = front.filter(function (r) { return r !== mb; }).sort(function (a, b) {
      return Math.abs(P(s.side, baseX(s, a), 0).x - ax) - Math.abs(P(s.side, baseX(s, b), 0).x - ax);
    });
    return [mb].concat(rest).slice(0, n);
  }
  function handW(s, r) { var B = s.roster[r]; return 10 + B.blk / 30 + (B.height - 190) / 9; }
  // the block forms a wall: blockers keep their left-to-right order (nobody walks through anybody),
  // stand hand-to-hand (seams only open on fast sets), and slide together as one unit
  function placeDefense(s, ax, blockers, lean, gap) {
    var m = defenseFormation(s, ax, blockers), n = blockers.length;
    var y = NET + (s.side === 0 ? 34 : -34);
    if (n) {
      var ord = blockers.slice().sort(function (a, b) { return (s.pos[a] ? s.pos[a].x : W / 2) - (s.pos[b] ? s.pos[b].x : W / 2); });
      var hws = ord.map(function (r) { return handW(s, r); }), xs = [0];
      for (var i = 1; i < n; i++) xs[i] = xs[i - 1] + hws[i - 1] + hws[i] - 3 + Math.max(0, gap || 0);
      var span = xs[n - 1], lineDir = ax < W / 2 ? -1 : 1, left;
      if (Math.min(Math.abs(ax - CL), Math.abs(CR - ax)) < 90) {
        // pin attack: the outside blocker sets the edge — on the line (take line) or just inside the hitter (line open)
        var outer = lineDir < 0 ? 0 : n - 1, outerHand = lean === "line" ? ax + lineDir * 12 : ax - lineDir * 16;   // line: seal it • cross: give the line away
        var outerC = outerHand - lineDir * hws[outer];
        left = lineDir < 0 ? outerC : outerC - span;
      } else left = ax - span / 2 + (lean === "line" ? 6 : -6) * lineDir;
      left = clamp(left, CL + 8, CR - 8 - span);
      ord.forEach(function (r, i) { m[r] = { x: left + xs[i], y: y }; s.rush[r] = true; });
    }
    setTargets(s, m);
    s.blockers = blockers.slice();
  }
  function coverHitter(s, hitter, setterRole, contact) {
    var dir = s.side === 0 ? 1 : -1, spots = [[-55, 85], [55, 85], [-25, 160], [45, 160]], i = 0;
    s.onCourt.forEach(function (r) {
      if (r === hitter || r === setterRole) return;
      var sp = spots[i++ % spots.length];
      moveTo(s, r, clampHalf(s, { x: contact.x + sp[0], y: contact.y + dir * sp[1] }));
    });
  }
  function transition(atk, setterRole) {
    setTargets(atk, attackFormation(atk, setterRole || "S"));
    setTargets(other(atk), baseFormation(other(atk)));
  }
  function onServeContact(srvSide, rcvSide, target) {
    setTargets(srvSide, baseFormation(srvSide));
    moveTo(rcvSide, frontSetter(rcvSide) ? "OP" : "S", setterSpot(rcvSide.side));
    var ps = passersOf(rcvSide);
    var near = nearest(rcvSide, target, ps.length ? ps : null), who = near.pos;
    if (rcvSide.pos.L && dist(rcvSide.pos.L, target) < near.d + 45) who = "L";
    moveTo(rcvSide, who, target);
    return who;
  }

  // good/perfect passes reach the setter; a poor one can land anywhere on the court
  function passPoint(s, grade) {
    var base = setterSpot(s.side), dir = s.side === 0 ? 1 : -1;
    if (grade >= 2) return clampHalf(s, { x: base.x + rnd(-8, 8), y: base.y + dir * rnd(0, 8) });
    if (grade === 1) return clampHalf(s, { x: base.x + rnd(-38, 38), y: base.y + dir * rnd(15, 45) });
    return clampHalf(s, P(s.side, rnd(CL + 30, CR - 30), NET + rnd(60, 230)));
  }
  // returns who takes the second ball: the setter, or the libero/back-row player when it's far away
  async function toSetter(s, from, grade, passerRole) {
    var pt = passPoint(s, grade), far = dist(pt, setterSpot(s.side)), setterRole = frontSetter(s) && passerRole !== "OP" ? "OP" : "S";
    if (passerRole === setterRole || (grade === 0 && far > 140)) setterRole = altSetter(s, passerRole) || "S";
    transition(s, setterRole);
    moveTo(s, setterRole, pt);
    if (!isSetter(s, setterRole) || far > 80) s.rush[setterRole] = true;
    await flyBall(from, pt, 650, { h0: 0, h1: 1.1, peak: 1.3, skew: 0.6 });
    return setterRole;
  }

  // ================== ANIMATION ==================
  function jump(s, role, ms, h, kind, dir) {
    if (!s.pos[role]) return;
    emit({ k: "jump", a: [s.side, role, ms, h, kind, dir || 1] }); mute++;
    try { jump0(s, role, ms, h, kind, dir); } finally { mute--; }
  }
  function jump0(s, role, ms, h, kind, dir) {
    s.anim[role] = { t0: gt, dur: ms / 1000, h: h, kind: kind, dir: dir || 1 };
    if (h >= 10 && (kind === "spike" || kind === "block" || kind === "press" || kind === "wipe")) {
      // BOOM JUMP: a take-off ring and a dust kick, then a landing puff
      var Pl = s.roster[role], feet = { x: s.pos[role].x, y: s.pos[role].y + 14 }, hot = Pl.flow || (Pl.skill && Pl.cd > 0 && kind === "spike");
      ring(feet, hot ? "#ff7a2a" : "#ffffff", hot ? 34 : 22, 0.32); puff(feet, hot ? 10 : 5, hot ? "#ffb070" : "#d8c8a8");
      setTimeout(function () { mute++; try { if (s.pos[role]) puff({ x: s.pos[role].x, y: s.pos[role].y + 14 }, 4, "#d8c8a8"); } finally { mute--; } }, ms * 0.95);
    }
  }
  var shakeAt = -9999, shakeAmt = 0, hitStopUntil = 0;
  VB.CAMS = { classic: "CLASSIC (TOP-DOWN)", broadcast: "BROADCAST CAM (EXPERIMENTAL)", high: "HIGH CAM (EXPERIMENTAL)" };
  var CAM = "classic";
  try { CAM = localStorage.getItem("retroVB.cam") || "classic"; } catch (e) {}
  if (!VB.CAMS[CAM]) CAM = "classic";
  function camP() { return CAM === "high" ? { camY: H + 250, camH: 620, f: 520, hor: -237 } : { camY: H + 830, camH: 930, f: 1440, hor: -690 }; }
  // world (court x, y, height above the floor in px) → screen
  // the TV camera pans gently with the ball (an elevated end-line view keeps serve, set and attack in one frame)
  var camPan = 0, punchAt = -9999, waveAt = -9999;
  function proj(x, y, h) { var c = camP(), z = Math.max(80, c.camY - y), s = c.f / z; return { x: CW / 2 + (x - W / 2 - camPan) * s, y: c.hor + c.camH * s - (h || 0) * s, s: s }; }
  function unproj(sx, sy) { var c = camP(), z = c.camH * c.f / Math.max(1, sy - c.hor); return { x: W / 2 + camPan + (sx - CW / 2) * z / c.f, y: c.camY - z }; }
  function punchZoom(now) { var k = clamp01(1 - (now - punchAt) / 420); return 1 + 0.045 * Math.sin(k * Math.PI / 2) * k; }
  function startWave() { waveAt = performance.now(); emit({ k: "wave" }); }
  var BH = 62, LIFT = 2.6, SPR_H = 74, NET_H = 84, trail3 = [];
  function shake(a) { try { if (localStorage.getItem("retroVB.shake") === "off") a = Math.min(a, 1.5); } catch (e) {}
    shakeAt = performance.now(); shakeAmt = a; if (a >= 7) punchAt = shakeAt; emit({ k: "shake", a: a }); }
  function hitStop(ms) { hitStopUntil = performance.now() + ms; emit({ k: "stop", a: ms }); }
  function jumpLater(s, role, delay, ms, h, kind) { setTimeout(function () { jump(s, role, ms, h, kind); }, delay); }
  function flyBall(from, to, ms, o) {
    o = o || {};
    var peak = o.peak || 0, h0 = o.h0 || 0, h1 = o.h1 || 0, skew = o.skew || 0.5, wob = o.wobble || 0, my = ++flySeq;
    emit({ k: "fly", a: [xy(from), xy(to), ms, o] });
    ball.visible = true;
    ball.spin = o.spin || 0;
    ball.squashAt = performance.now(); ball.squashAng = Math.atan2(to.y - from.y, to.x - from.x);
    if ((o.spin || 0) >= 20 || o.trail === "hot") flashes.push({ x: from.x, y: from.y, h: h0, t0: performance.now() });
    ball.trail = o.trail || null; trailPts = [];
    if (!o.quiet) sfx(o.trail === "hot" || (o.spin || 0) >= 20 ? "spike" : "touch");
    return new Promise(function (res) {
      var t = 0, last = performance.now();
      (function step(now) {
        if (!paused && now >= hitStopUntil) t += (now - last) / ms * timeScale;
        last = now;
        var tt = clamp01(t);
        if (my !== flySeq) { if (tt < 1) requestAnimationFrame(step); else res(); return; }   // a newer flight owns the ball
        var arc = tt < skew ? Math.sin(tt / skew * Math.PI / 2) : Math.cos((tt - skew) / (1 - skew) * Math.PI / 2);
        ball.x = from.x + (to.x - from.x) * tt + Math.sin(tt * Math.PI * 6) * wob * (1 - tt * 0.4);
        ball.y = from.y + (to.y - from.y) * tt;
        ball.h = h0 + (h1 - h0) * tt + arc * peak;
        if (tt < 1) requestAnimationFrame(step);
        else {
          if (h1 === 0 && my === flySeq) {                                   // it hit the floor: a mark and a puff of dust
            sfx("bounce");
            marks.push({ x: to.x, y: to.y, t0: performance.now() });
            rings.push({ x: to.x, y: to.y + 2, t0: gt, col: "rgba(255,255,255,0.8)", r: 16, dur: 0.35 });
          }
          res();
        }
      })(last);
    });
  }
  function ballPos() { return { x: ball.x, y: ball.y }; }
  var flashes = [], marks = [];
  function drawBallAt(x, y, r, rot) {
    var k = clamp01(1 - (performance.now() - (ball.squashAt || 0)) / 140), ang = ball.squashAng || 0;
    g.save(); g.translate(x, y); g.rotate(ang); g.scale(1 + 0.32 * k, 1 - 0.26 * k); g.rotate(-ang);
    g.fillStyle = "#ffd21e"; g.beginPath(); g.arc(0, 0, r, 0, 6.283); g.fill();
    g.save(); g.beginPath(); g.arc(0, 0, r, 0, 6.283); g.clip();
    g.strokeStyle = "#1e4fd8"; g.lineWidth = Math.max(1.6, r * 0.42);
    for (var i = 0; i < 3; i++) { var a = rot + i * 2.094; g.beginPath(); g.arc(Math.cos(a) * r * 1.15, Math.sin(a) * r * 1.15, r * 0.95, a + 2.35, a + 3.95); g.stroke(); }
    var sh = g.createRadialGradient(-r * 0.4, -r * 0.45, r * 0.05, 0, 0, r * 1.05);
    sh.addColorStop(0, "rgba(255,255,255,0.65)"); sh.addColorStop(0.35, "rgba(255,255,255,0)"); sh.addColorStop(1, "rgba(0,20,80,0.4)");
    g.fillStyle = sh; g.fillRect(-r, -r, r * 2, r * 2);
    g.restore();
    g.strokeStyle = "#13306f"; g.lineWidth = 1.2; g.beginPath(); g.arc(0, 0, r, 0, 6.283); g.stroke();
    g.restore();
  }
  function drawSpeedLines(x, y, r) {
    var dx = x - (ball.lx == null ? x : ball.lx), dy = y - (ball.ly == null ? y : ball.ly), d = Math.hypot(dx, dy);
    ball.lx = x; ball.ly = y;
    if (d < 3 || !(ball.trail === "hot" || ball.spin >= 20)) return;
    var ux = dx / d, uy = dy / d, nx = -uy, ny = ux;
    g.strokeStyle = ball.trail === "hot" ? "rgba(255,170,60,0.75)" : "rgba(255,255,255,0.7)"; g.lineWidth = 1.5;
    [-1, 0, 1].forEach(function (o) {
      var sx = x + nx * o * r * 0.6 - ux * r * 1.2, sy = y + ny * o * r * 0.6 - uy * r * 1.2, L = r * (2.6 + (o === 0 ? 1.4 : 0));
      g.beginPath(); g.moveTo(sx, sy); g.lineTo(sx - ux * L, sy - uy * L); g.stroke();
    });
  }
  function drawFlashes(toScreen) {
    var now = performance.now();
    flashes = flashes.filter(function (f) { return now - f.t0 < 180; });
    flashes.forEach(function (f) {
      var k = 1 - (now - f.t0) / 180, p = toScreen(f), r = (10 + 22 * (1 - k)) * (p.s || 1);
      g.save(); g.globalAlpha = k; g.strokeStyle = "#ffffff"; g.lineWidth = 2.5; g.translate(p.x, p.y);
      for (var i = 0; i < 8; i++) { var a = i * 0.785 + 0.2; g.beginPath(); g.moveTo(Math.cos(a) * r * 0.35, Math.sin(a) * r * 0.35); g.lineTo(Math.cos(a) * r, Math.sin(a) * r); g.stroke(); }
      g.restore();
    });
  }
  function drawMarks(toScreen) {
    var now = performance.now();
    marks = marks.filter(function (m) { return now - m.t0 < 1600; });
    marks.forEach(function (m) {
      var k = 1 - (now - m.t0) / 1600, p = toScreen(m), s = p.s || 1;
      g.fillStyle = "rgba(10,20,40," + (0.28 * k) + ")"; g.beginPath(); g.ellipse(p.x, p.y, 7 * s, 3 * s, 0, 0, 6.283); g.fill();
    });
  }
  // after a kill the ball keeps travelling and bounces away
  function bounce(from, to) {
    var dx = to.x - from.x, dy = to.y - from.y, d = Math.hypot(dx, dy) || 1;
    return flyBall(to, { x: to.x + dx / d * 70, y: to.y + dy / d * 70 }, 330, { peak: 0.7, spin: 10 });
  }

  // ================== ARENA ==================
  // floor: a player setting (menu) or the competition's own floor
  VB.FLOORS = { auto: "AUTO", arena: "ARENA (TEAM COLOURS)", vnl: "VNL YELLOW & BLUE", rubber: "ORANGE TARAFLEX", wood: "WOODEN GYM" };
  function pickFloor(c) {
    var pref = "auto";
    try { pref = localStorage.getItem("retroVB.floor") || "auto"; } catch (e) {}
    if (pref !== "auto" && VB.FLOORS[pref]) return pref;
    return c.floor || (c.league === "VNL" ? "vnl" : "arena");
  }
  var BANNER_TXT = { KAR: ["FLY", "KARASUNO"], NEK: ["CONNECT", "NEKOMA"], INA: ["NO MEMORIES NEEDED", "INARIZAKI"], FUK: ["HEY HEY HEY", "FUKURODANI"],
                     AOB: ["SEIJOH", "AOBA JOHSAI"], SHI: ["SHIRATORIZAWA", "WE ARE KINGS"], DAT: ["IRON WALL", "DATE TECH"], KAM: ["KAMOMEDAI", "HIGH POINT"] };
  function buildArena(home, away, league, floor) {
    floor = floor || "arena";
    var hk = home.kit, ak = away.kit;
    var hk2 = home.kit2 || "#ffffff";
    arenaTheme = { home: home, away: away, league: league, free: mix(hk, "#2b3a4f", 0.66), seat: mix(hk, "#1b2230", 0.72) };
    refSprite = makeRefSprite("#13407a");
    bg = document.createElement("canvas"); bg.width = CW; bg.height = CH;
    var b = bg.getContext("2d");
    b.imageSmoothingEnabled = false;
    // concourse + tiered stands
    b.fillStyle = "#0e141f"; b.fillRect(0, 0, CW, CH);
    function stand(x, y, w, h, vertical) {
      b.fillStyle = arenaTheme.seat; b.fillRect(x, y, w, h);
      b.fillStyle = "rgba(0,0,0,0.22)";
      if (vertical) { for (var xx = x; xx < x + w; xx += 10) b.fillRect(xx, y, 2, h); }
      else { for (var yy = y; yy < y + h; yy += 10) b.fillRect(x, yy, w, 2); }
    }
    stand(0, 0, CW, 84, false); stand(0, 816, CW, 84, false);
    stand(0, 84, 74, 732, true); stand(566, 84, 74, 732, true);
    // aisle between stands and boards
    b.fillStyle = "#0b0f16";
    b.fillRect(74, 84, 492, 8); b.fillRect(74, 808, 492, 8); b.fillRect(74, 84, 14, 732); b.fillRect(552, 84, 14, 732);
    // advertising boards
    var boardCols = [hk, "#ffffff", hk2, "#13293f"];
    function boards(x, y, w, h, horizontal) {
      var seg = horizontal ? 58 : 58, n = Math.ceil((horizontal ? w : h) / seg);
      for (var i = 0; i < n; i++) {
        var col = boardCols[i % boardCols.length];
        b.fillStyle = col;
        if (horizontal) b.fillRect(x + i * seg, y, seg, h); else b.fillRect(x, y + i * seg, w, seg);
        b.fillStyle = mix(col, "#ffffff", 0.5) === "#ffffff" ? "#13293f" : (col === "#ffffff" ? "#13293f" : "#ffffff");
        b.font = '11px "VT323", monospace'; b.textAlign = "center"; b.textBaseline = "middle";
        var label = i % 2 ? (league || "VNL") : (home.short || home.name);
        if (horizontal) b.fillText(label, x + i * seg + seg / 2, y + h / 2 + 1);
        else { b.save(); b.translate(x + w / 2, y + i * seg + seg / 2); b.rotate(-Math.PI / 2); b.fillText(label, 0, 1); b.restore(); }
      }
    }
    boards(88, 92, 464, 12, true); boards(88, 796, 464, 12, true);
    boards(88, 104, 12, 692, false); boards(540, 104, 12, 692, false);
    // floor: free zone in the home colours, standard court
    var FL = { arena: [arenaTheme.free, "#1668d8", "#1e7ef0", "#ffffff"], vnl: ["#1a4fc0", "#f2b21c", "#f8c63e", "#ffffff"],
               rubber: ["#2b8f7e", "#e8702a", "#f0873c", "#ffffff"], wood: ["#d6a263", null, null, "#ffffff"] }[floor] || [arenaTheme.free, "#1668d8", "#1e7ef0", "#ffffff"];
    b.fillStyle = FL[0]; b.fillRect(100, 104, 440, 692);
    if (floor === "wood") {
      // planks, with a basketball court painted underneath like a real school gym
      for (var py = 104; py < 796; py += 7) {
        b.fillStyle = (py / 7) % 2 ? "rgba(120,70,20,0.09)" : "rgba(255,240,200,0.07)"; b.fillRect(100, py, 440, 7);
        b.fillStyle = "rgba(90,50,10,0.22)"; b.fillRect(100, py, 440, 1);
        for (var px = 100 + (py * 37) % 110; px < 540; px += 110) b.fillRect(px, py, 1, 7);
      }
      b.strokeStyle = "rgba(200,50,50,0.5)"; b.lineWidth = 2;
      b.strokeRect(126, 128, 388, 644); b.beginPath(); b.arc(320, 450, 46, 0, 6.283); b.stroke();
      b.beginPath(); b.arc(320, 150, 90, 0, Math.PI); b.stroke(); b.beginPath(); b.arc(320, 750, 90, Math.PI, 6.283); b.stroke();
      b.strokeStyle = "rgba(40,110,200,0.45)"; b.strokeRect(160, 170, 320, 560);
    }
    b.globalAlpha = 0.18; b.fillStyle = "#ffffff";
    b.font = '34px "Press Start 2P", monospace'; b.textAlign = "center"; b.textBaseline = "middle";
    var floorTxt = floor === "vnl" ? "VNL" : floor === "wood" ? "" : (home.short || home.name).slice(0, 10);
    b.save(); b.translate(118, 450); b.rotate(-Math.PI / 2); b.fillText(floorTxt, 0, 0); b.restore();
    b.save(); b.translate(522, 450); b.rotate(Math.PI / 2); b.fillText(floorTxt, 0, 0); b.restore();
    b.globalAlpha = 1;
    b.save(); b.translate(OX, OY);
    if (FL[1]) { b.fillStyle = FL[1]; b.fillRect(CL, CT, CR - CL, CB - CT); b.fillStyle = FL[2]; b.fillRect(CL, NET - ATK, CR - CL, ATK * 2); }
    else { b.fillStyle = "rgba(150,80,20,0.16)"; b.fillRect(CL, CT, CR - CL, CB - CT); }
    b.strokeStyle = FL[3]; b.lineWidth = 2.5;
    b.strokeRect(CL, CT, CR - CL, CB - CT);
    b.beginPath(); b.moveTo(CL, NET - ATK); b.lineTo(CR, NET - ATK); b.stroke();
    b.beginPath(); b.moveTo(CL, NET + ATK); b.lineTo(CR, NET + ATK); b.stroke();
    b.beginPath(); b.moveTo(CL, NET); b.lineTo(CR, NET); b.stroke();
    // benches with the substitutes and the coach, the scorer's table with its officials
    b.fillStyle = "#3a3f4a"; b.fillRect(CL - 60, NET + 120, 10, 70); b.fillRect(CL - 60, NET - 190, 10, 70);
    var mineT = homeIdx === 0 ? home : away, foeT = homeIdx === 0 ? away : home;
    [[mineT, NET + 120], [foeT, NET - 190]].forEach(function (bt) {
      var tk = bt[0].kit, tk2 = bt[0].kit2 || "#ffffff";
      for (var bi = 0; bi < 4; bi++) {
        var sp = makeSprite(tk, VB.makeFace(bt[0].nat || bt[0].id || "ITA"), tk2, kitPattern(bt[0].id), irnd(10, 24));
        b.drawImage(sp, 0, 0, sp.width, sp.height * 0.8, CL - 66, bt[1] + bi * 17 - 4, 16, 17);
      }
      var coachS = makeSprite("#2b2f3a", VB.makeFace(bt[0].nat || "ITA"), "#ffffff", "trim");
      b.drawImage(coachS, CL - 44, bt[1] + 22, 18, 24);
    });
    b.fillStyle = "#13293f"; b.fillRect(CR + 46, NET - 34, 14, 68); b.fillStyle = "#e8eef7"; b.fillRect(CR + 47, NET - 32, 12, 64);
    b.fillStyle = "#1e63ff"; b.fillRect(CR + 47, NET - 6, 12, 12);
    [NET - 26, NET + 14].forEach(function (yy) { b.fillStyle = "#2b2f3a"; b.fillRect(CR + 62, yy, 8, 8); b.fillStyle = "#ffdcc2"; b.fillRect(CR + 63, yy - 6, 6, 6); b.fillStyle = "#17120d"; b.fillRect(CR + 63, yy - 6, 6, 2); });
    // gloss on the playing surface, and a sponsor print in the free zone
    var gl = b.createLinearGradient(CL, CT, CR, CB); gl.addColorStop(0, "rgba(255,255,255,0.07)"); gl.addColorStop(0.5, "rgba(255,255,255,0)"); gl.addColorStop(1, "rgba(255,255,255,0.05)");
    b.fillStyle = gl; b.fillRect(CL, CT, CR - CL, CB - CT);
    b.globalAlpha = 0.22; b.fillStyle = "#ffffff"; b.font = '12px "Press Start 2P", monospace'; b.textAlign = "center"; b.textBaseline = "middle";
    b.fillText("MIKASA", (CL + CR) / 2, CT - 9); b.fillText("MIKASA", (CL + CR) / 2, CB + 10); b.globalAlpha = 1;
    b.restore();

    // crowd: home fans everywhere, an away section in one corner
    fans = [];
    function seats(x0, y0, w, h, sx, sy) {
      for (var y = y0 + 3; y < y0 + h - 8; y += sy) {
        for (var x = x0 + 2; x < x0 + w - 6; x += sx) {
          if (y < 46 && x > 236 && x < 404) continue;                // jumbotron
          var awaySec = (y < 84 && x > 470) || (x > 566 && y < 300);
          var roll = Math.random();
          var shirt = roll < 0.22 ? pick(["#ffffff", "#2b2b2b", "#d0d0d0", "#3b5b8c", "#6b6b6b"]) : (awaySec ? (roll < 0.75 ? ak : away.kit2 || "#ffffff") : (roll < 0.8 ? hk : hk2));
          var face = VB.makeFace(pick(["ITA", "JPN", "BRA", "USA", "FRA"]));
          var flag = Math.random() < 0.06;
          fans.push({ x: x, y: y, shirt: shirt, skin: face.skin, hair: face.hair, ph: Math.random() * 6.28, empty: Math.random() < 0.06,
                      flag: flag, stick: !flag && Math.random() < 0.12, flagCol: awaySec ? ak : hk });
        }
      }
    }
    seats(0, 0, CW, 78, 11, 12); seats(0, 822, CW, 78, 11, 12);
    seats(0, 84, 66, 732, 11, 12); seats(574, 84, 66, 732, 11, 12);
    // banners held up in the stands
    var stars = home.lineup ? VB.ROLES.map(function (r) { return home.lineup[r]; }).filter(function (p) { return p && p.skill; }) : [];
    var hTxt = (BANNER_TXT[home.id] || []).concat(["GO " + (home.short || home.name) + "!", (home.short || home.name)]);
    if (stars.length) hTxt.push(pick(stars).name + " #1");
    var aTxt = (BANNER_TXT[away.id] || []).concat(["GO " + (away.short || away.name) + "!"]);
    var banners = [];
    [[30, 58], [150, 58], [430, 58], [40, 836], [190, 868], [330, 836], [470, 868], [6, 250], [6, 560], [572, 420], [572, 640]].forEach(function (pt, i) {
      var awaySec = (pt[1] < 84 && pt[0] > 400) || (pt[0] > 566 && pt[1] < 300);
      var t = awaySec ? pick(aTxt) : hTxt[i % hTxt.length];
      var col = awaySec ? ak : (i % 2 ? hk : hk2), rgb = parseInt(String(col).slice(1), 16);
      var tc = ((rgb >> 16) * 0.3 + ((rgb >> 8) & 255) * 0.59 + (rgb & 255) * 0.11) > 150 ? "#13293f" : "#ffffff";
      banners.push({ x: pt[0], y: pt[1], w: Math.min(pt[0] > 560 || pt[0] < 10 ? 62 : 120, t.length * 7 + 12), t: t, col: col, tc: tc });
    });
    crowdFrames = [0, 1, 2, 3].map(function (pose) {
      var c = document.createElement("canvas"); c.width = CW; c.height = CH;
      var q = c.getContext("2d");
      fans.forEach(function (f) { drawFan(q, f, pose); });
      // a thick barrier rail in the home colours
      [[0, 78, CW, 7, true], [0, 815, CW, 7, true], [66, 84, 8, 732, false], [566, 84, 8, 732, false]].forEach(function (r) {
        q.fillStyle = "#0b0f16"; q.fillRect(r[0], r[1], r[2], r[3]);
        q.fillStyle = hk; if (r[4]) q.fillRect(r[0], r[1] + 2, r[2], 3); else q.fillRect(r[0] + 2, r[1], 3, r[3]);
        q.fillStyle = "rgba(255,255,255,0.35)"; if (r[4]) q.fillRect(r[0], r[1] + 2, r[2], 1); else q.fillRect(r[0] + 2, r[1], 1, r[3]);
      });
      banners.forEach(function (bn, i) {
        var lift = pose >= 2 && i % 2 === pose % 2 ? 2 : 0, y = bn.y - lift;
        q.fillStyle = "#dddddd"; q.fillRect(bn.x - 1, y - 2, 1, 16); q.fillRect(bn.x + bn.w, y - 2, 1, 16);
        q.fillStyle = bn.col; q.fillRect(bn.x, y, bn.w, 12);
        q.fillStyle = "rgba(0,0,0,0.25)"; q.fillRect(bn.x, y + 11, bn.w, 1);
        q.fillStyle = bn.tc; q.font = '11px "VT323", monospace'; q.textAlign = "center"; q.textBaseline = "middle";
        q.fillText(bn.t, bn.x + bn.w / 2, y + 6.5, bn.w - 4);
      });
      return c;
    });
  }
  // the wave rolls around the stands: fans stand up as it passes their column
  function drawWave(now, blit) {
    var t = (now - waveAt) / 2600;
    if (t < 0 || t > 1) return;
    var wx = -80 + t * (CW + 160);
    for (var sx = Math.max(0, Math.floor((wx - 60) / 20) * 20); sx < Math.min(CW, wx + 60); sx += 20) blit(sx, 20);
  }
  function phoneFlashes(k) {
    var n = Math.round(14 * k);
    for (var i = 0; i < n; i++) {
      var side = Math.random(), x, y;
      if (side < 0.35) { x = rnd(4, CW - 4); y = rnd(4, 74); } else if (side < 0.7) { x = rnd(4, CW - 4); y = rnd(826, 896); }
      else if (side < 0.85) { x = rnd(4, 62); y = rnd(90, 810); } else { x = rnd(578, 636); y = rnd(90, 810); }
      g.fillStyle = "rgba(255,255,255," + rnd(0.6, 1) + ")"; g.fillRect(x, y, 2, 2);
    }
  }
  function drawFan(c, f, pose) {
    if (f.empty) { c.fillStyle = "rgba(0,0,0,0.25)"; c.fillRect(f.x, f.y + 2, 5, 5); return; }
    var lift = (pose === 1 && f.ph > 3) ? 1 : (pose === 2 && f.ph <= 3) ? 2 : (pose === 3 && f.ph > 3) ? 2 : 0;
    var x = f.x, y = f.y - lift;
    c.fillStyle = f.shirt; c.fillRect(x, y + 3, 5, 4);
    c.fillStyle = f.skin; c.fillRect(x + 1, y, 3, 3);
    c.fillStyle = f.hair; c.fillRect(x + 1, y, 3, 1);
    if (pose >= 2) {
      c.fillStyle = f.skin; c.fillRect(x - 1, y - 1, 1, 3); c.fillRect(x + 5, y - 1, 1, 3);
      if (f.flag) { c.fillStyle = "#dddddd"; c.fillRect(x + 6, y - 6, 1, 7); c.fillStyle = f.flagCol; c.fillRect(x + 7, y - 6 + (pose === 3 ? 1 : 0), 5, 3); }
      else if (f.stick) { c.fillStyle = f.flagCol; c.fillRect(x - 2, y - 5 + (pose === 3 ? 1 : 0), 2, 5); c.fillRect(x + 5, y - 5 + (pose === 2 ? 1 : 0), 2, 5); }
    }
  }

  // ================== RENDER ==================
  var LABEL_FONT = '19px "VT323", monospace';
  var ROLE_FONT = '16px "VT323", monospace';

  function stepPlayers(dt) {
    var k = 1 - Math.exp(-dt * 5.5 * timeScale), kr = 1 - Math.exp(-dt * 13 * timeScale);
    [me, opp].forEach(function (s) {
      if (!s) return;
      Object.keys(s.pos).forEach(function (r) {
        var p = s.pos[r], t = s.tgt[r];
        if (!t) return;
        var sp = clamp(0.8 + ((s.roster[r] && s.roster[r].spd || 70) - 70) / 80, 0.6, 1.3);      // faster players get there sooner
        var kk = 1 - Math.pow(1 - (s.rush[r] ? kr : k), sp);
        p.x += (t.x - p.x) * kk; p.y += (t.y - p.y) * kk;
        if (s.rush[r] && dist(p, t) < 3) delete s.rush[r];
      });
    });
  }

  function drawArms(kind, pr, x, y, skin, dir) {
    var Ls = { x: x - 9, y: y - 8 }, Rs = { x: x + 9, y: y - 8 }, Lh, Rh;
    if (kind === "block") { Lh = { x: x - 11, y: y - 40 }; Rh = { x: x + 11, y: y - 40 }; }
    else if (kind === "spike") {
      if (pr < 0.45)      { Lh = { x: x - 5,  y: y - 40 }; Rh = { x: x + 17, y: y - 30 }; }
      else if (pr < 0.65) { Lh = { x: x - 12, y: y - 22 }; Rh = { x: x + 5,  y: y - 46 }; }
      else                { Lh = { x: x - 13, y: y - 2 };  Rh = { x: x - 7,  y: y + 4 }; }
    } else if (kind === "serve") {
      if (pr < 0.5) { Lh = { x: x - 4, y: y - 34 }; Rh = { x: x + 14, y: y - 28 }; }
      else          { Lh = { x: x - 12, y: y - 6 }; Rh = { x: x + 6, y: y - 42 }; }
    } else if (kind === "set") { Lh = { x: x - 5, y: y - 35 }; Rh = { x: x + 5, y: y - 35 }; }
    else if (kind === "pass" || kind === "dig") {
      var hy = kind === "dig" ? y + 6 : y + 2;
      Lh = { x: x - 2, y: hy }; Rh = { x: x + 2, y: hy };
    } else if (kind === "shank") { Lh = { x: x - 15, y: y - 2 }; Rh = { x: x + 6, y: y - 18 }; }
    else if (kind === "ready") { Lh = { x: x - 7, y: y + 4 }; Rh = { x: x + 7, y: y + 4 }; }              // low, braced, platform out
    else if (kind === "press") { Lh = { x: x - 14, y: y - 46 }; Rh = { x: x + 14, y: y - 46 }; }         // hands pressed over the net
    else if (kind === "cheer") { Lh = { x: x - 15, y: y - 36 + Math.sin(pr * 20) * 3 }; Rh = { x: x + 15, y: y - 36 - Math.sin(pr * 20) * 3 }; }
    else if (kind === "approach") { Lh = { x: x - 13, y: y + 6 }; Rh = { x: x + 9, y: y + 8 }; }        // arms swung back on the run-up
    else if (kind === "wipe") {                                                                          // swing turns out toward the antenna
      var d0 = dir || 1;
      if (pr < 0.45) { Lh = { x: x - 5, y: y - 40 }; Rh = { x: x + 17, y: y - 30 }; }
      else { Lh = { x: x - 8, y: y - 24 }; Rh = { x: x + 22 * d0, y: y - 36 + (pr - 0.45) * 30 }; }
    }
    else return;
    g.lineCap = "round";
    [["rgba(10,20,40,0.45)", 6.5], [skin, 4]].forEach(function (st) {
      g.strokeStyle = st[0]; g.lineWidth = st[1];
      g.beginPath(); g.moveTo(Ls.x, Ls.y); g.lineTo(Lh.x, Lh.y); g.moveTo(Rs.x, Rs.y); g.lineTo(Rh.x, Rh.y); g.stroke();
    });
    g.lineCap = "butt";
    g.fillStyle = skin;
    if (kind === "pass" || kind === "dig") g.fillRect(Lh.x - 4, Lh.y - 1, 12, 4);
    if (kind === "block" || kind === "press" || kind === "cheer") { g.fillRect(Lh.x - 3, Lh.y - 4, 6, 5); g.fillRect(Rh.x - 3, Rh.y - 4, 6, 5); }
    if (kind === "ready") g.fillRect(Lh.x - 2, Lh.y - 1, 18, 4);
    if (kind === "set") { g.fillRect(Lh.x - 3, Lh.y - 3, 5, 4); g.fillRect(Rh.x - 2, Rh.y - 3, 5, 4); }
  }

  function drawFlameBody(x, yFeet, yTop) {
    var layers = [["#1e6bff", 1.0, 0], ["#3cc8ff", 0.72, 0.25], ["#e3faff", 0.42, 0.55]];
    for (var cx = -20; cx <= 20; cx += 4) {
      var edge = 1 - Math.abs(cx) / 22;
      var flick = 0.72 + 0.22 * Math.sin(gt * 13 + cx * 1.9) + 0.14 * Math.sin(gt * 27 + cx * 0.7);
      var full = (yFeet - yTop + 30) * edge * flick;
      layers.forEach(function (ly) {
        if (edge < ly[2]) return;
        var hh = Math.round(full * ly[1]);
        g.fillStyle = ly[0]; g.globalAlpha = 0.85;
        g.fillRect(Math.round(x + cx - 2), Math.round(yFeet + 16 - hh), 4, hh);
      });
    }
    g.globalAlpha = 1;
  }
  function spawnFlames(x, yFeet, yTop, dt) {
    var n = Math.max(1, Math.round(dt * 140));
    for (var i = 0; i < n; i++) {
      flames.push({ x: x + rnd(-16, 16), y: rnd(yTop, yFeet + 12), vx: rnd(-10, 10), vy: rnd(-95, -45), life: 0, max: rnd(0.35, 0.75), sz: irnd(4, 7) });
    }
  }
  function drawFlames(dt) {
    var cols = ["#ffffff", "#9ff0ff", "#3cc8ff", "#1e6bff"];
    flames = flames.filter(function (f) { return (f.life += dt) < f.max; });
    flames.forEach(function (f) {
      f.x += f.vx * dt; f.y += f.vy * dt;
      var k = f.life / f.max, sz = Math.max(1, Math.round(f.sz * (1 - k * 0.6)));
      g.globalAlpha = 1 - k; g.fillStyle = cols[Math.min(3, Math.floor(k * 4))];
      g.fillRect(Math.round(f.x), Math.round(f.y), sz, sz);
    });
    g.globalAlpha = 1;
  }

  // ---- popups & dust ----
  function popup(text, at, col) { emit({ k: "pop", a: [text, xy(at), col] }); popups.push({ text: text, x: at.x, y: at.y, t0: gt, col: col || "#ffd21e" }); }
  var rings = [], trailPts = [];
  function ring(at, col, maxR, dur) { emit({ k: "ring", a: [xy(at), col, maxR, dur] }); rings.push({ x: at.x, y: at.y, t0: gt, col: col || "#ffffff", r: maxR || 30, dur: dur || 0.4 }); }
  function drawRings() {
    rings = rings.filter(function (q) { return gt - q.t0 < q.dur; });
    rings.forEach(function (q) {
      var k = (gt - q.t0) / q.dur;
      g.globalAlpha = 1 - k; g.strokeStyle = q.col; g.lineWidth = 4 * (1 - k) + 1;
      g.beginPath(); g.ellipse(q.x, q.y, q.r * (0.25 + k), q.r * (0.25 + k) * 0.6, 0, 0, Math.PI * 2); g.stroke();
    });
    g.globalAlpha = 1;
  }
  function puff(at, n, col) {
    emit({ k: "puff", a: [xy(at), n, col] });
    for (var i = 0; i < n; i++) {
      puffs.push({ x: at.x + rnd(-5, 5), y: at.y + rnd(-5, 5), vx: rnd(-70, 70), vy: rnd(-80, -15), life: 0, max: rnd(0.4, 0.8),
                   col: col || pick(["#ffffff", "#dfe7ef", "#c8d3df"]) });
    }
  }
  function drawPuffs(dt) {
    puffs = puffs.filter(function (f) { return (f.life += dt) < f.max; });
    puffs.forEach(function (f) {
      f.x += f.vx * dt; f.y += f.vy * dt; f.vy += 140 * dt;
      g.globalAlpha = 1 - f.life / f.max; g.fillStyle = f.col;
      g.fillRect(Math.round(f.x), Math.round(f.y), 3, 3);
    });
    g.globalAlpha = 1;
  }
  function drawPopups() {
    popups = popups.filter(function (q) { return gt - q.t0 < 1.3; });
    popups.forEach(function (q) {
      var k = (gt - q.t0) / 1.3, sc = k < 0.12 ? 0.6 + k / 0.12 * 0.55 : 1.15 - Math.min(0.15, k - 0.12);
      g.save(); g.translate(q.x, q.y - 26 - k * 32); g.scale(sc, sc);
      g.font = '13px "Press Start 2P", monospace'; g.textAlign = "center"; g.textBaseline = "middle";
      g.globalAlpha = k > 0.75 ? (1 - k) / 0.25 : 1;
      g.lineWidth = 5; g.strokeStyle = "#13293f"; g.strokeText(q.text, 0, 0);
      g.fillStyle = q.col; g.fillText(q.text, 0, 0);
      g.restore();
    });
    g.globalAlpha = 1;
  }

  function pill(text, x, y, font, fg, bg2) {
    g.font = font;
    var w = g.measureText(text).width + 8;
    g.fillStyle = bg2;
    g.fillRect(Math.round(x - w / 2), Math.round(y - 9), Math.round(w), 17);
    g.fillStyle = fg; g.textAlign = "center"; g.textBaseline = "middle";
    g.fillText(text, x, y + 0.5);
  }

  function drawJumbotron() {
    g.fillStyle = "#05070b"; g.fillRect(236, 4, 168, 40);
    g.strokeStyle = "#3a4558"; g.lineWidth = 2; g.strokeRect(236, 4, 168, 40);
    if (!me) return;
    g.font = '10px "Press Start 2P", monospace'; g.textBaseline = "middle"; g.textAlign = "center";
    g.fillStyle = me.team.kit === "#ffffff" ? "#cfe6fb" : mix(me.team.kit, "#ffffff", 0.35);
    g.fillText((me.team.short || me.team.name).slice(0, 7), 280, 17);
    g.fillStyle = mix(opp.team.kit, "#ffffff", 0.35);
    g.fillText((opp.team.short || opp.team.name).slice(0, 7), 360, 17);
    g.fillStyle = "#ffd21e"; g.font = '14px "Press Start 2P", monospace';
    g.fillText(score[0] + "-" + score[1], 320, setNeed > 1 ? 30 : 33);
    if (setNeed > 1) { g.fillStyle = "#9cc4ea"; g.font = '7px "Press Start 2P", monospace'; g.fillText("SETS " + setsWon[0] + "-" + setsWon[1], 320, 41); }
  }

  function draw(now) {
    var dt = Math.min(0.05, (now - lastFrame) / 1000);
    lastFrame = now;
    var sdt = paused ? 0 : dt * timeScale;
    gt += sdt;
    if (!paused) stepPlayers(dt);
    if (!bg) { requestAnimationFrame(draw); return; }
    var sk = shakeAmt * Math.max(0, 1 - (now - shakeAt) / 320), zm = punchZoom(now);
    g.setTransform(zm, 0, 0, zm, (1 - zm) * CW / 2 + (sk ? rnd(-sk, sk) : 0), (1 - zm) * CH / 2 + (sk ? rnd(-sk, sk) : 0));
    if (sk) { g.fillStyle = "#05070b"; g.fillRect(-20, -20, CW + 40, CH + 40); }
    if (ball.visible && ball.trail === "hot" && sdt > 0 && Math.random() < 0.7) puffs.push({ x: ball.x + rnd(-3, 3), y: ball.y - ball.h * 30, vx: rnd(-20, 20), vy: rnd(-30, 10), life: 0, max: rnd(0.25, 0.5), col: pick(["#ff7a2a", "#ffb000", "#ffd21e"]) });
    if (CAM !== "classic") { drawBroadcast(now, sdt); g.setTransform(1, 0, 0, 1, 0, 0); requestAnimationFrame(draw); return; }

    g.drawImage(bg, 0, 0);
    var cheerAmt = clamp01(1 - (now - cheerAt) / 1100);
    var frame = cheerAmt > 0 ? (Math.floor(now / 120) % 2 ? 3 : 2) : chant ? (Math.floor((now - chant.at) / 300) % 2 ? 2 : 0) : (Math.floor(now / 650) % 2);
    g.drawImage(crowdFrames[frame], 0, 0);
    drawWave(now, function (sx, w) { g.drawImage(crowdFrames[3], sx, 0, w, CH, sx, 0, w, CH); });
    if (cheerAmt > 0.25) phoneFlashes(cheerAmt);
    drawJumbotron();
    drawChant(now);
    drawDrama(now);

    g.save(); g.translate(OX, OY);
    drawMarks(function (m) { return { x: m.x, y: m.y, s: 1 }; });
    // net, posts, antennas, officials
    var ns = gt - netShakeAt, shake = ns < 0.45 ? Math.sin(ns * 60) * 2.2 * (1 - ns / 0.45) : 0, NY = NET + shake;
    g.fillStyle = "#1a1a1a";
    g.fillRect(CL - 16, NET - 5, 6, 10); g.fillRect(CR + 10, NET - 5, 6, 10);
    g.fillStyle = "#f5f5f5"; g.fillRect(CL - 10, NY - 4, CR - CL + 20, 8);
    g.strokeStyle = "#9aa7b5"; g.lineWidth = 1;
    for (var nx = CL - 8; nx <= CR + 8; nx += 7) { g.beginPath(); g.moveTo(nx, NY - 3); g.lineTo(nx, NY + 3); g.stroke(); }
    g.strokeStyle = "#5f6b78"; g.beginPath(); g.moveTo(CL - 10, NY); g.lineTo(CR + 10, NY); g.stroke();
    [CL, CR].forEach(function (ax) {
      for (var seg = 0; seg < 5; seg++) { g.fillStyle = seg % 2 ? "#ffffff" : "#e8352e"; g.fillRect(ax - 1.5, NY - 6 - (seg + 1) * 5, 3, 5); }
    });
    g.fillStyle = "#8a5a2b"; g.fillRect(CR + 20, NET - 12, 22, 24);
    g.fillStyle = "#6e4420"; g.fillRect(CR + 20, NET + 8, 22, 4);
    if (refSprite) {
      g.drawImage(refSprite, CR + 26, NET - 26 + Math.sin(gt * 3) * 0.8, 15, 21);
      g.drawImage(refSprite, CL - 34, NET - 8 + Math.sin(gt * 2.4) * 0.8, 15, 21);           // second referee
      [[CL - 16, CT - 22], [CR + 4, CB + 6]].forEach(function (lj) { g.drawImage(refSprite, lj[0], lj[1], 12, 17); });  // line judges
    }
    var flag = clamp01(1 - (now - refFlagAt) / 1200);
    if (flag > 0) {
      g.strokeStyle = "#ffd21e"; g.lineWidth = 2.5;
      g.beginPath(); g.moveTo(CR + 33, NET - 18); g.lineTo(CR + 41, NET - 18 + (refFlagSide === 0 ? 10 : -10)); g.stroke();
    }
    if (aimPreview && aimCtx) {
      // show where the swing crosses the net and whether that's into the hands, the edge, a seam or clear
      var spans = handSpans(aimCtx.def, aimCtx.blockers), cxp = crossX(aimCtx.from, aimPreview), bz = blockZone(spans, cxp);
      var hy = NET + (aimCtx.def.side === 0 ? 3 : -9);
      g.fillStyle = "rgba(224,52,138,0.5)";
      spans.forEach(function (sp2) { g.fillRect(sp2.lo, hy, sp2.hi - sp2.lo, 6); });
      var zc = bz.zone === "in" ? "#ff3b3b" : bz.zone === "edge" ? "#ffb000" : "#3dff7a";
      g.setLineDash([7, 5]); g.strokeStyle = zc; g.lineWidth = 2.5;
      g.beginPath(); g.moveTo(aimCtx.from.x, aimCtx.from.y); g.lineTo(aimPreview.x, aimPreview.y); g.stroke(); g.setLineDash([]);
      g.fillStyle = zc; g.beginPath(); g.arc(cxp, NET, 5, 0, Math.PI * 2); g.fill();
      pill(bz.zone === "in" ? "INTO THE BLOCK" : bz.zone === "edge" ? (bz.outside ? "TOOL ZONE" : "BLOCK EDGE") : bz.zone === "seam" ? "SEAM" : "CLEAR",
           aimPreview.x, aimPreview.y - 24, ROLE_FONT, "#13293f", zc);
    }
    if (aimPreview) {
      g.strokeStyle = "rgba(255,221,0,0.95)"; g.lineWidth = 2;
      g.beginPath(); g.arc(aimPreview.x, aimPreview.y, 12, 0, Math.PI * 2); g.stroke();
      g.beginPath(); g.moveTo(aimPreview.x - 16, aimPreview.y); g.lineTo(aimPreview.x + 16, aimPreview.y); g.stroke();
      g.beginPath(); g.moveTo(aimPreview.x, aimPreview.y - 16); g.lineTo(aimPreview.x, aimPreview.y + 16); g.stroke();
    }

    // players
    var list = [];
    [opp, me].forEach(function (s) { if (s) Object.keys(s.pos).forEach(function (r) { list.push({ s: s, r: r, p: s.pos[r] }); }); });
    list.sort(function (a, b) { return a.p.y - b.p.y; });
    list.forEach(function (it) {
      var s = it.s, p = it.p, Pl = s.roster[it.r], a = s.anim[it.r];
      var lift = 0, kind = null, pr = 0;
      if (a) {
        pr = (gt - a.t0) / a.dur;
        if (pr >= 0 && pr <= 1) { lift = Math.sin(pr * Math.PI) * a.h; kind = a.kind; }
        else if (pr > 1) delete s.anim[it.r];
      }
      var t = s.tgt[it.r], moving = t && dist(p, t) > 4;
      var bob = moving ? Math.abs(Math.sin(gt * 14 + Pl.ph)) * 2.5 : Math.sin(gt * 4 + Pl.ph) * 1.1;
      var sway = moving ? 0 : Math.sin(gt * 1.6 + Pl.ph * 2) * 1.6;
      var x = p.x + sway, y = p.y - bob - lift;
      it.dx = x; it.dy = y; it.fx = p.x + sway;
      var mine = s.side === 0, isYou = mine && mode === "role" && (it.r === myRole || it.r === mateRole);
      if (lift > 0) { g.fillStyle = "rgba(0,20,60,0.3)"; g.beginPath(); g.ellipse(x, p.y + 17, 10, 4, 0, 0, Math.PI * 2); g.fill(); }
      g.strokeStyle = isYou ? "#ffd21e" : mine ? "#0e9e45" : "#e0348a";
      g.lineWidth = isYou ? 3.5 : 2;
      g.beginPath(); g.ellipse(x, p.y + 17, isYou ? 16 : 13, isYou ? 6 : 5, 0, 0, Math.PI * 2); g.stroke();
      if (Pl.flow) {
        g.fillStyle = "rgba(60,200,255," + (0.3 + Math.sin(gt * 8) * 0.12) + ")";
        g.beginPath(); g.ellipse(x, p.y + 17, 19, 7, 0, 0, Math.PI * 2); g.fill();
        drawFlameBody(x, p.y, y - 24);
        if (sdt > 0) spawnFlames(x, p.y, y - 24, sdt);
      }
      var hsc = clamp((Pl.height || 195) / 195, 0.8, 1.12);              // taller players are drawn taller
      if (kind === "dive" || kind === "fall") {                    // dive: laid out toward the ball; fall: knocked over by a shank
        var fall = kind === "fall";
        var tilt = a.dir * (fall ? 1.55 : 1.3) * Math.sin(Math.min(1, pr * (fall ? 3 : 1.8)) * Math.PI / 2);
        g.save(); g.translate(x, p.y + 8); g.rotate(tilt);
        g.drawImage(Pl.sprite, -15 * hsc, -32 * hsc, 30 * hsc, 40 * hsc);
        g.restore();
        g.strokeStyle = Pl.face.skin; g.lineWidth = 4; g.lineCap = "round";
        g.beginPath(); g.moveTo(x + a.dir * 8, p.y); g.lineTo(x + a.dir * 26, p.y + 6); g.stroke(); g.lineCap = "butt";
        it.dy = p.y - 6;
        if (fall && pr > 0.3) {
          for (var k2 = 0; k2 < 3; k2++) {
            var an = gt * 7 + k2 * 2.1;
            g.fillStyle = "#ffd21e"; g.fillRect(Math.round(x + Math.cos(an) * 11), Math.round(p.y - 16 + Math.sin(an) * 3), 3, 3);
          }
        }
      } else {
        g.drawImage(Pl.sprite, Math.round(x - 15 * hsc), Math.round(y + 16 - 40 * hsc), Math.round(30 * hsc), Math.round(40 * hsc));
        if (kind) { g.save(); g.translate(x, y + 16); g.scale(hsc, hsc); drawArms(kind, pr, 0, -16, Pl.face.skin, a && a.dir); g.restore(); }
        it.dy = y + 40 * (1 - hsc);
      }
    });
    drawFlames(sdt);
    drawPuffs(sdt);
    drawRings();

    var placed = [];
    function freeY(text, x, y, font, dir) {
      g.font = font;
      var w = g.measureText(text).width + 8;
      for (var tries = 0; tries < 2 && placed.some(function (b2) { return Math.abs(b2.x - x) < (b2.w + w) / 2 && Math.abs(b2.y - y) < 17; }); tries++) y += dir * 17;
      placed.push({ x: x, y: y, w: w });
      return y;
    }
    list.slice().reverse().forEach(function (it) {
      var Pl = it.s.roster[it.r], mine = it.s.side === 0, isYou = mine && mode === "role" && (it.r === myRole || it.r === mateRole);
      var nm = Pl.name.length > 11 ? Pl.name.slice(0, 10) + "." : Pl.name;
      var star = Pl.skill ? (Pl.cd ? " ★" + Pl.cd : " ★") : "";
      var label = (isYou ? (mateRole ? (it.r === mateRole ? "P2 " : "P1 ") : "YOU ") : "") + (Pl.flow ? "FLOW " : "") + nm + star;
      pill(label, it.dx, freeY(label, it.dx, it.dy - 34, LABEL_FONT, -1), LABEL_FONT,
           isYou ? "#13293f" : Pl.flow ? "#d8f7ff" : (Pl.skill && !Pl.cd) ? "#ffd21e" : "#ffffff",
           isYou ? "#ffd21e" : Pl.flow ? "#0b49d6" : "rgba(10,30,60,0.85)");
    });
    list.forEach(function (it) {
      var Pl = it.s.roster[it.r], tag = it.r + " #" + Pl.num;
      pill(tag, it.fx, freeY(tag, it.fx, it.p.y + 33, ROLE_FONT, 1), ROLE_FONT, "#ffffff", it.s.side === 0 ? "#0e9e45" : "#e0348a");
    });

    if (ball.visible) {
      ball.rot += sdt * ball.spin;
      var shR = Math.max(2.2, 8 - ball.h * 3.4);
      g.fillStyle = "rgba(0,20,60," + clamp(0.45 - ball.h * 0.11, 0.08, 0.45) + ")";
      g.beginPath(); g.ellipse(ball.x, ball.y, shR, shR * 0.55, 0, 0, Math.PI * 2); g.fill();
      var r = 6 + ball.h * 5, by = ball.y - ball.h * 30;
      if (ball.trail) {                                            // speed streak (jump serves, kills) or float flutter dots
        trailPts.push({ x: ball.x, y: by, r: r }); if (trailPts.length > 9) trailPts.shift();
        trailPts.forEach(function (tp, i) {
          var k = i / trailPts.length;
          if (ball.trail === "float") { if (i % 2) return; g.fillStyle = "rgba(255,255,255," + (k * 0.6) + ")"; g.fillRect(tp.x - 1.5, tp.y - 1.5, 3, 3); return; }
          g.fillStyle = ball.trail === "hot" ? "rgba(255,120,40," + (k * 0.45) + ")" : "rgba(255,230,120," + (k * 0.4) + ")";
          g.beginPath(); g.arc(tp.x, tp.y, tp.r * (0.4 + k * 0.6), 0, Math.PI * 2); g.fill();
        });
      } else trailPts = [];
      drawSpeedLines(ball.x, by, r);
      drawBallAt(ball.x, by, r, ball.rot);
    }
    drawFlashes(function (f) { return { x: f.x, y: f.y - (f.h || 0) * 30, s: 1 }; });
    drawPopups();
    g.restore();
    g.setTransform(1, 0, 0, 1, 0, 0);
    requestAnimationFrame(draw);
  }

  function drawBroadcast(now, sdt) {
    var panT = ball.visible ? clamp((ball.x - W / 2) * 0.3, -50, 50) : 0;
    camPan += (panT - camPan) * Math.min(1, sdt * 3 + 0.01);
    var c = camP();
    // arena backdrop: the far stands and the roof lights
    var farY = proj(0, -100, 0).y;
    var gr = g.createLinearGradient(0, 0, 0, farY); gr.addColorStop(0, "#05070b"); gr.addColorStop(1, arenaTheme ? arenaTheme.seat : "#1b2230");
    g.fillStyle = gr; g.fillRect(0, 0, CW, farY + 2);
    var cheerAmt = clamp01(1 - (now - cheerAt) / 1100);
    var frame = cheerAmt > 0 ? (Math.floor(now / 120) % 2 ? 3 : 2) : (Math.floor(now / 650) % 2);
    g.drawImage(crowdFrames[frame], 0, 0, CW, 84, 0, Math.max(0, farY - 150), CW, 150);
    drawWave(now, function (sx, w) { g.drawImage(crowdFrames[3], sx, 0, w, 84, sx, Math.max(0, farY - 150), w, 150); });
    if (cheerAmt > 0.25) for (var pf = 0; pf < 10 * cheerAmt; pf++) { g.fillStyle = "rgba(255,255,255," + rnd(0.6, 1) + ")"; g.fillRect(rnd(0, CW), rnd(Math.max(0, farY - 150), farY - 10), 2, 2); }
    for (var li = 0; li < 6; li++) { g.fillStyle = "rgba(255,240,200," + (0.25 + 0.1 * Math.sin(now / 400 + li)) + ")"; g.fillRect(60 + li * 100, 8, 28, 5); }
    // the floor, scanline by scanline (Mode-7)
    for (var sy = Math.floor(farY); sy < CH; sy += 2) {
      var z = c.camH * c.f / Math.max(1, sy - c.hor), wy = c.camY - z, srcY = wy + OY;
      if (srcY < 0 || srcY >= CH) continue;
      var k = z / c.f, sx0 = W / 2 - (CW / 2) * k + OX, sw = CW * k, dx = 0;
      if (sx0 < 0) { dx = -sx0 / k; sw += sx0; sx0 = 0; }
      if (sx0 + sw > CW) sw = CW - sx0;
      if (sw <= 1) continue;
      g.drawImage(bg, sx0, srcY, sw, Math.max(1, 2 * z * z / (c.camH * c.f)), dx, sy, sw / k, 2);
    }
    drawMarks(function (m) { return proj(m.x, m.y, 0); });
    // everything with depth: players, net, ball — far to near
    var items = [{ y: NET, net: true }];
    [opp, me].forEach(function (sd) { if (sd) Object.keys(sd.pos).forEach(function (r) { items.push({ y: sd.pos[r].y, s: sd, r: r }); }); });
    if (ball.visible) items.push({ y: ball.y + 0.5, ball: true });
    items.sort(function (a, b) { return a.y - b.y; });
    var labels = [];
    items.forEach(function (it) {
      if (it.net) return drawNet3();
      if (it.ball) return drawBall3(sdt);
      var sd = it.s, p = sd.pos[it.r], Pl = sd.roster[it.r], a = sd.anim[it.r], lift = 0, kind = null, pr = 0;
      if (a) { pr = (gt - a.t0) / a.dur; if (pr >= 0 && pr <= 1) { lift = Math.sin(pr * Math.PI) * a.h; kind = a.kind; } else if (pr > 1) delete sd.anim[it.r]; }
      var t = sd.tgt[it.r], moving = t && dist(p, t) > 4, bob = moving ? Math.abs(Math.sin(gt * 14 + Pl.ph)) * 2 : 0;
      var hsc = clamp((Pl.height || 195) / 195, 0.8, 1.12), f0 = proj(p.x, p.y, 0), hh = SPR_H * hsc * f0.s, ww = hh * 0.75;
      var up = Math.max(0, lift) * LIFT * f0.s + bob * f0.s;
      var isYou = sd.side === 0 && mode === "role" && (it.r === myRole || it.r === mateRole);
      // the "model": soft contact shadow, team-coloured rim light, slightly larger sprite
      g.fillStyle = "rgba(0,10,30," + (0.35 - Math.min(0.2, up / 300)) + ")";
      g.beginPath(); g.ellipse(f0.x, f0.y, ww * 0.42, ww * 0.14, 0, 0, Math.PI * 2); g.fill();
      g.strokeStyle = isYou ? "#ffd21e" : sd.side === 0 ? "#0e9e45" : "#e0348a"; g.lineWidth = Math.max(1.5, 3 * f0.s);
      g.beginPath(); g.ellipse(f0.x, f0.y, ww * 0.5, ww * 0.17, 0, 0, Math.PI * 2); g.stroke();
      if (Pl.flow) { g.fillStyle = "rgba(60,200,255," + (0.25 + Math.sin(gt * 8) * 0.1) + ")"; g.beginPath(); g.ellipse(f0.x, f0.y - hh * 0.5 - up, ww * 0.7, hh * 0.65, 0, 0, Math.PI * 2); g.fill(); }
      var top = f0.y - hh - up;
      if (kind === "dive" || kind === "fall") {
        g.save(); g.translate(f0.x, f0.y - hh * 0.2); g.rotate(a.dir * 1.3 * Math.min(1, pr * 2)); g.drawImage(Pl.sprite, -ww / 2, -hh * 0.8, ww, hh); g.restore();
      } else {
        g.globalAlpha = 0.35; g.drawImage(Pl.sprite, f0.x - ww / 2 - 1.5, top + 1.5, ww, hh); g.globalAlpha = 1;
        g.drawImage(Pl.sprite, f0.x - ww / 2, top, ww, hh);
        if (kind) { var kk = hh / 40; g.save(); g.translate(f0.x, f0.y - up); g.scale(kk, kk); drawArms(kind, pr, 0, -16, Pl.face.skin, a && a.dir); g.restore(); }
      }
      if (sd.side === 0 || f0.s > 0.75) labels.push({ x: f0.x, y: top - 8, t: (isYou ? "YOU " : "") + Pl.name.slice(0, 10), you: isYou, mine: sd.side === 0 });
    });
    drawFlashes(function (f) { return proj(f.x, f.y, (f.h || 0) * BH); });
    labels.forEach(function (l) { pill(l.t, l.x, l.y, '15px "VT323", monospace', l.you ? "#13293f" : "#ffffff", l.you ? "#ffd21e" : l.mine ? "rgba(14,100,50,0.85)" : "rgba(120,20,60,0.85)"); });
    // effects in world space
    rings = rings.filter(function (q) { return gt - q.t0 < q.dur; });
    rings.forEach(function (q) {
      var kq = (gt - q.t0) / q.dur, pp = proj(q.x, q.y, 0);
      g.globalAlpha = 1 - kq; g.strokeStyle = q.col; g.lineWidth = (4 * (1 - kq) + 1) * pp.s;
      g.beginPath(); g.ellipse(pp.x, pp.y, q.r * (0.25 + kq) * pp.s * 1.4, q.r * (0.25 + kq) * pp.s * 0.45, 0, 0, Math.PI * 2); g.stroke();
    });
    g.globalAlpha = 1;
    puffs = puffs.filter(function (f) { return (f.life += sdt) < f.max; });
    puffs.forEach(function (f) {
      f.x += f.vx * sdt; f.y += f.vy * sdt * 0.4; f.vy += 140 * sdt;
      var pp = proj(f.x, f.y, Math.max(0, (f.max - f.life) * 30)); g.globalAlpha = 1 - f.life / f.max; g.fillStyle = f.col;
      g.fillRect(pp.x, pp.y, Math.max(2, 3 * pp.s), Math.max(2, 3 * pp.s));
    });
    g.globalAlpha = 1;
    popups = popups.filter(function (q) { return gt - q.t0 < 1.3; });
    popups.forEach(function (q) {
      var kq = (gt - q.t0) / 1.3, pp = proj(q.x, q.y, 90 + kq * 50);
      g.save(); g.translate(pp.x, pp.y); g.scale(Math.max(0.8, pp.s), Math.max(0.8, pp.s));
      g.font = '13px "Press Start 2P", monospace'; g.textAlign = "center"; g.textBaseline = "middle"; g.globalAlpha = kq > 0.75 ? (1 - kq) / 0.25 : 1;
      g.lineWidth = 5; g.strokeStyle = "#13293f"; g.strokeText(q.text, 0, 0); g.fillStyle = q.col; g.fillText(q.text, 0, 0); g.restore();
    });
    g.globalAlpha = 1;
    if (aimPreview) {
      var ap = proj(aimPreview.x, aimPreview.y, 0);
      if (aimCtx) {
        var spans = handSpans(aimCtx.def, aimCtx.blockers), bz = blockZone(spans, crossX(aimCtx.from, aimPreview)), fr = proj(aimCtx.from.x, aimCtx.from.y, 1.4 * BH);
        var zc = bz.zone === "in" ? "#ff3b3b" : bz.zone === "edge" ? "#ffb000" : "#3dff7a";
        g.setLineDash([7, 5]); g.strokeStyle = zc; g.lineWidth = 2.5; g.beginPath(); g.moveTo(fr.x, fr.y); g.lineTo(ap.x, ap.y); g.stroke(); g.setLineDash([]);
        pill(bz.zone === "in" ? "INTO THE BLOCK" : bz.zone === "edge" ? (bz.outside ? "TOOL ZONE" : "BLOCK EDGE") : bz.zone === "seam" ? "SEAM" : "CLEAR", ap.x, ap.y - 24, ROLE_FONT, "#13293f", zc);
      }
      g.strokeStyle = "rgba(255,221,0,0.95)"; g.lineWidth = 2;
      g.beginPath(); g.ellipse(ap.x, ap.y, 16 * ap.s, 6 * ap.s, 0, 0, Math.PI * 2); g.stroke();
    }
    drawJumbotron(); drawChant(now); drawDrama(now);
    g.fillStyle = "rgba(0,0,0,0.55)"; g.fillRect(CW - 150, CH - 22, 150, 22);
    g.fillStyle = "#ffd21e"; g.font = '9px "Press Start 2P", monospace'; g.textAlign = "right"; g.textBaseline = "middle";
    g.fillText(CAM === "high" ? "HIGH CAM β" : "BROADCAST β", CW - 8, CH - 11);
  }
  function drawNet3() {
    var a = proj(CL - 12, NET, NET_H), b = proj(CR + 12, NET, NET_H), a2 = proj(CL - 12, NET, NET_H - 26), b2 = proj(CR + 12, NET, NET_H - 26);
    var fa = proj(CL - 16, NET, 0), fb = proj(CR + 16, NET, 0);
    g.fillStyle = "#2a2f38"; g.fillRect(fa.x - 3, a.y, 6, fa.y - a.y); g.fillRect(fb.x - 3, b.y, 6, fb.y - b.y);   // posts
    var ns = gt - netShakeAt, wob = ns < 0.45 ? Math.sin(ns * 60) * 2 * (1 - ns / 0.45) : 0;
    g.fillStyle = "rgba(20,20,20,0.35)"; g.fillRect(a.x, a.y + wob, b.x - a.x, a2.y - a.y);
    g.strokeStyle = "rgba(230,235,240,0.55)"; g.lineWidth = 1;
    for (var i = 0; i <= 40; i++) { var xx = a.x + (b.x - a.x) * i / 40; g.beginPath(); g.moveTo(xx, a.y + wob); g.lineTo(xx, a2.y + wob); g.stroke(); }
    for (var j = 1; j < 4; j++) { var yy = a.y + (a2.y - a.y) * j / 4 + wob; g.beginPath(); g.moveTo(a.x, yy); g.lineTo(b.x, yy); g.stroke(); }
    g.fillStyle = "#f5f5f5"; g.fillRect(a.x, a.y - 3 + wob, b.x - a.x, 4);
    [proj(CL, NET, NET_H), proj(CR, NET, NET_H)].forEach(function (an) {
      for (var sgm = 0; sgm < 5; sgm++) { g.fillStyle = sgm % 2 ? "#ffffff" : "#e8352e"; g.fillRect(an.x - 1.5, an.y - (sgm + 1) * 6, 3, 6); }
    });
    if (refSprite) { var rp = proj(CR + 34, NET, 70); g.drawImage(refSprite, rp.x - 9, rp.y - 26, 18, 26); }
  }
  function drawBall3(sdt) {
    var gp = proj(ball.x, ball.y, 0), bp = proj(ball.x, ball.y, ball.h * BH), r = Math.max(3, 7.5 * bp.s);
    ball.rot += sdt * ball.spin;
    g.fillStyle = "rgba(0,20,60," + clamp(0.45 - ball.h * 0.11, 0.08, 0.45) + ")";
    g.beginPath(); g.ellipse(gp.x, gp.y, r * 1.1, r * 0.4, 0, 0, Math.PI * 2); g.fill();
    if (ball.trail) {
      trail3.push({ x: bp.x, y: bp.y, r: r }); if (trail3.length > 9) trail3.shift();
      trail3.forEach(function (tp, i) {
        var kq = i / trail3.length;
        g.fillStyle = ball.trail === "float" ? "rgba(255,255,255," + (kq * 0.5) + ")" : ball.trail === "hot" ? "rgba(255,120,40," + (kq * 0.5) + ")" : "rgba(255,230,120," + (kq * 0.4) + ")";
        g.beginPath(); g.arc(tp.x, tp.y, tp.r * (0.4 + kq * 0.6), 0, Math.PI * 2); g.fill();
      });
    } else trail3 = [];
    drawSpeedLines(bp.x, bp.y, r);
    drawBallAt(bp.x, bp.y, r, ball.rot);
  }
  function setCam(k) { CAM = VB.CAMS[k] ? k : "classic"; try { localStorage.setItem("retroVB.cam", CAM); } catch (e) {} camUI(); }
  var CAM_SHORT = { classic: "CLASSIC", broadcast: "BROADCAST", high: "HIGH CAM" };
  function camUI() { ["camTop", "camBtn"].forEach(function (id) { var b = $(id); if (b) b.textContent = "🎥 " + (CAM_SHORT[CAM] || CAM); }); }
  function cycleCam() { var ks = Object.keys(VB.CAMS); setCam(ks[(ks.indexOf(CAM) + 1) % ks.length]); feed(-1, "🎥 Camera: " + VB.CAMS[CAM]); }

  // ================== INPUT ==================
  function courtAt(px, py, half) {
    var w0 = CAM === "classic" ? { x: px - OX, y: py - OY } : unproj(px, py);
    var x = clamp(w0.x, CL + 10, CR - 10), y = w0.y;
    y = half === "top" ? clamp(y, CT + 10, NET - 16) : clamp(y, NET + 16, CB - 10);
    return { x: x, y: y };
  }
  function aimClick(half, role) {
    if (isMate(role)) {
      var fb = { x: rnd(CL + 40, CR - 40), y: half === "top" ? rnd(CT + 40, NET - 60) : rnd(NET + 60, CB - 40) };
      $("actions").innerHTML = "<div class='coop-wait'>🎯 P2 IS AIMING…</div>";
      return VB.Coop.ask("aim", { half: half, msg: $("msg").textContent }, null).then(function (a) {
        $("actions").innerHTML = "";
        if (!a) return fb;
        if (a.x == null) return courtAt(a.px, a.py, half);
        return { x: clamp(a.x, CL + 10, CR - 10), y: half === "top" ? clamp(a.y, CT + 10, NET - 16) : clamp(a.y, NET + 16, CB - 10) };   // P2 aimed in their own view
      });
    }
    return new Promise(function (res) {
      cv.classList.add("aiming");
      function toCourt(e) {
        var r = cv.getBoundingClientRect();
        return courtAt((e.clientX - r.left) / r.width * CW, (e.clientY - r.top) / r.height * CH, half);
      }
      function onMove(e) { aimPreview = toCourt(e); }
      function onClick(e) {
        cv.removeEventListener("mousemove", onMove);
        cv.removeEventListener("click", onClick);
        cv.classList.remove("aiming");
        var pt = toCourt(e); aimPreview = null; res(pt);
      }
      cv.addEventListener("mousemove", onMove);
      cv.addEventListener("click", onClick);
    });
  }
  function timingPop(q) {
    var el = $("timingPop");
    el.textContent = q >= 1 ? "PERFECT!" : q >= 0.5 ? "GOOD" : q > 0 ? "OFF!" : "MISSED!";
    el.style.color = q >= 1 ? "#3dff7a" : q >= 0.5 ? "#ffd21e" : "#ff4d4d";
    el.classList.remove("hidden");
    clearTimeout(timingPop.t);
    timingPop.t = setTimeout(function () { el.classList.add("hidden"); }, 750);
  }
  // goodW: width of the green zone (0..1 of the bar) — shrinks against fast balls and better opponents
  function timingBar(label, speedMs, goodW, role) {
    goodW = clamp(goodW || 0.28, 0.12, 0.42);
    var pace = speedMs < 850 ? "  ⚡⚡ VERY FAST" : speedMs < 1100 ? "  ⚡ FAST" : speedMs > 1500 ? "  🐢 SLOW" : "";
    var spec = { label: label + "  [" + (goodW >= 0.32 ? "EASY" : goodW >= 0.24 ? "NORMAL" : goodW >= 0.17 ? "HARD" : "BRUTAL") + "]" + pace,
                 speedMs: speedMs * 1.8, goodW: goodW, perfW: goodW * 0.26, center: rnd(0.15 + goodW / 2, 0.85 - goodW / 2) };   // a calm, readable marker; GOOD is easy, PERFECT is not
    if (isMate(role)) {
      $("actions").innerHTML = "<div class='coop-wait'>⏱️ P2: " + U.esc(label) + "</div>";
      return VB.Coop.ask("timing", spec, 0.4).then(function (q) { $("actions").innerHTML = ""; timingPop(q); return q; });
    }
    return runTiming(spec);
  }
  function runTiming(spec) {
    var goodW = spec.goodW, perfW = spec.perfW, speedMs = spec.speedMs, center = spec.center;
    return new Promise(function (res) {
      var wrap = $("timing"), mk = $("marker");
      $("timingLabel").textContent = spec.label;
      $("zoneG").style.left = (center - goodW / 2) * 100 + "%"; $("zoneG").style.width = goodW * 100 + "%";
      $("zoneP").style.left = (center - perfW / 2) * 100 + "%"; $("zoneP").style.width = perfW * 100 + "%";
      function quality(p) {
        var d = Math.abs(p - center);
        if (d <= perfW / 2) return 1;
        if (d <= goodW / 2) return 0.85 - 0.3 * (d - perfW / 2) / (goodW / 2 - perfW / 2);
        return Math.max(0, 0.45 - (d - goodW / 2) * 2.5);           // near misses still count for something
      }
      wrap.classList.remove("hidden");
      var t0 = gclock(), done = false, raf;
      // constant-speed back-and-forth, so the marker is equally readable everywhere on the bar
      function pos(now) { var u = ((now - t0) / speedMs) % 1; return u < 0.5 ? u * 2 : 2 - u * 2; }
      var shown = 0;
      (function step() {
        if (done) return;
        if (gclock() - t0 > speedMs * 3) { done = true; finish(0); return; }        // too late
        shown = pos(gclock()); mk.style.left = shown * 100 + "%"; raf = requestAnimationFrame(step);
      })();
      function finish(q) {
        document.removeEventListener("pointerdown", stop, true);
        document.removeEventListener("keydown", key, true);
        wrap.classList.add("hidden"); timingPop(q); res(q);
      }
      function stop(e) {
        if (done || paused || (e.target && e.target.closest && e.target.closest("#statsPanel, #rosterBtn, #tacPanel, #tacBtn, #backBtn, #camBtn, #camTop, #sndTop"))) return;
        done = true;
        e.preventDefault(); cancelAnimationFrame(raf);
        document.removeEventListener("pointerdown", stop, true);
        document.removeEventListener("keydown", key, true);
        // judge what the player saw: the drawn marker, or where it was ~60ms ago (screen + input lag)
        var now = gclock();
        finish(Math.max(quality(shown), quality(pos(now - 60)), quality(pos(now - 30)), quality(pos(now))));
      }
      function key(e) { if (e.key === " ") stop(e); }
      setTimeout(function () { document.addEventListener("pointerdown", stop, true); document.addEventListener("keydown", key, true); }, 120);
    });
  }

  // ================== GAME MATH ==================
  function passGrade(q) { return q >= 0.72 ? 2 : q >= 0.42 ? 1 : q >= 0.2 ? 0 : -1; }
  function nearest(sideObj, pt, roles) {
    var best = null, bd = 1e9;
    (roles || Object.keys(sideObj.pos)).forEach(function (p) {
      if (!sideObj.pos[p]) return;
      var d = dist(sideObj.pos[p], pt);
      if (d < bd) { bd = d; best = p; }
    });
    return { pos: best, d: bd };
  }
  function gapScore(defSide, pt) { return clamp01(nearest(defSide, pt).d / 120); }
  function serveParams(kind, srvAttr, quality) {
    var power = (kind === "spin" ? 0.75 : 0.5) * (0.6 + srvAttr / 250) * (0.7 + quality * 0.5);
    var wobble = kind === "float" ? 0.25 : 0.1;
    var errP = kind === "spin" ? 0.1 - quality * 0.06 : 0.05 - quality * 0.03;
    return { power: clamp01(power), wobble: wobble, errP: Math.max(0.02, errP) };
  }
  // mental: composure in tight moments (and the confidence a story/career brings in) widens your green zone a little
  function ps(Pl, id) { return (Pl && Pl.ps && Pl.ps[id]) || 0; }      // PlayStyle level: 0, 1 or 2 (+)
  function clutchAdj(Pl) {
    var to = (cfg && cfg.setsTo) || 15, tight = Math.max(score[0], score[1]) >= to - 3 && Math.abs(score[0] - score[1]) <= 2;
    return (tight ? ((Pl.men || 70) - 70) / 300 + ps(Pl, "clutch") * 0.03 : 0) + ((cfg && cfg.confAdj) || 0);
  }
  // technique: clean contacts mean fewer shanks
  function techShank(Pl) { return clamp(1.7 - (Pl.tec || 70) / 100, 0.6, 1.4); }
  // the OVR duel: a better hitter/server than your passer means a faster marker (ms per sweep, before the calm-down factor)
  function duelSpeed(atkVal, defVal, hot) {
    var ms = 1350 - (atkVal - defVal) * 14 - (atkVal - 70) * 7;
    if (hot) ms *= 0.85;                                           // star skills and flow state hit harder
    return Math.round(clamp(ms, 650, 1900));
  }
  function zoneName(side, x) {
    var left = x < 180, right = x > 300;
    if (side === 1) { var t = left; left = right; right = t; }
    return left ? "the outside" : right ? "the right side" : "the middle";
  }
  function shotDir(originX, target) { var dx = Math.abs(target.x - originX); return dx > 95 ? "cross" : dx < 40 ? "line" : "angle"; }
  function shotName(originX, target) {
    var d = shotDir(originX, target);
    return d === "cross" ? "the cross" : d === "line" ? "straight down the line" : "the angle";
  }
  // NCAA-style set calls. x is written from the bottom team's view (left pin ≈ 105, right pin ≈ 375,
  // setter's spot 292); back-row sets (back:true) are hit from behind the 3m line.
  var CALLS = [
    { id: "one",   fam: "MB", label: "1 QUICK",  say: "a 1 (quick in front)",      tempo: 0.4,  needPass: 1, x: 262, peak: 0.25 },
    { id: "31",    fam: "MB", label: "31",       say: "a 31 (inside quick)",       tempo: 0.5,  needPass: 1, x: 190, peak: 0.35 },
    { id: "slide", fam: "MB", label: "SLIDE",    say: "a slide behind the setter", tempo: 0.55, needPass: 2, x: 345, peak: 0.45 },
    { id: "high",  fam: "OH", label: "4 HIGH",   say: "a 4 (high outside)",        tempo: 1.0,  needPass: 0, x: 105, peak: 1.7 },
    { id: "go",    fam: "OH", label: "GO",       say: "a Go (fast outside)",       tempo: 0.7,  needPass: 1, x: 112, peak: 0.75 },
    { id: "five",  fam: "OP", label: "5 BACK",   say: "a 5 (high back set)",       tempo: 0.95, needPass: 0, x: 375, peak: 1.5 },
    { id: "red",   fam: "OP", label: "RED",      say: "a Red (fast back set)",     tempo: 0.65, needPass: 1, x: 370, peak: 0.6 },
    { id: "d",     fam: "OP", label: "D BALL",   say: "a D (back-row right side)", tempo: 0.85, needPass: 1, x: 360, peak: 1.0, back: true },
    { id: "pipe",  fam: "OH", label: "PIPE",     say: "a pipe",                    tempo: 0.85, needPass: 1, x: 240, peak: 1.0, back: true },
    { id: "bic",   fam: "OH", label: "BIC",      say: "a bic (quick pipe)",        tempo: 0.6,  needPass: 2, x: 255, peak: 0.55, back: true }
  ];
  function setOptions(s, grade) {
    var front = frontRoles(s);
    var opts = [];
    CALLS.forEach(function (c) {
      // front-row calls need that hitter in the front row; back-row calls need them in the back row
      var hitter = s.onCourt.find(function (r) { return VB.FAMILY[r] === c.fam && (front.indexOf(r) >= 0) !== !!c.back; });
      if (!hitter) return;
      opts.push({ id: c.id, label: c.label, say: c.say, hitter: hitter, tempo: c.tempo, needPass: c.needPass,
                  x: s.side === 0 ? c.x : W - c.x, pipe: !!c.back, peak: c.peak });
    });
    var cb = s.team.combo;
    if (cb && front.indexOf(cb.hitter) >= 0 && s.onCourt.indexOf(cb.hitter) >= 0) {
      opts.unshift({ id: "combo", label: cb.label, say: cb.say, hitter: cb.hitter, tempo: cb.tempo, needPass: cb.needPass,
                     x: s.side === 0 ? cb.x : W - cb.x, pipe: false, peak: cb.peak || 0.15, combo: true });
    }
    if (s.roster.S.skill === "dump") {
      opts.push({ id: "dump", label: "DUMP", say: "a dump", hitter: "S", tempo: 0.3, needPass: 1, x: setterSpot(s.side).x, pipe: false, dump: true, notReady: s.roster.S.cd > 0 });
    }
    return opts.map(function (o) { o.disabled = grade < o.needPass || !!o.notReady; return o; });
  }
  // ---- block geometry: where the attack crosses the net vs. where the blockers' hands are ----
  function handSpans(def, blockers) {
    return blockers.map(function (r) {
      var B = def.roster[r], x = def.tgt[r].x;
      var hw = 10 + B.blk / 30 + (B.height - 190) / 9 + (def.superBlocker === r ? 4 : 0) + ps(B, "read_block") * 2.5;
      if (def.jumpQ && def.jumpQ[r] != null) hw *= 0.7 + 0.5 * def.jumpQ[r];   // your (and P2's) block jump timing
      return { lo: x - hw, hi: x + hw, r: r };
    }).sort(function (a, b) { return a.lo - b.lo; });
  }
  function crossX(from, to) {
    var t = Math.abs(NET - from.y) / Math.max(1, Math.abs(to.y - from.y));
    return from.x + (to.x - from.x) * clamp(t, 0, 1);
  }
  function blockZone(spans, cx) {
    if (!spans.length) return { zone: "clear" };
    var lo = spans[0].lo, hi = spans.reduce(function (m, sp) { return Math.max(m, sp.hi); }, -1e9);
    var hit = spans.find(function (sp) { return cx >= sp.lo && cx <= sp.hi; });
    if (hit) return { zone: "in", r: hit.r };
    if (cx > lo && cx < hi) return { zone: "seam" };
    if (cx >= lo - 12 && cx <= hi + 12) {
      var outside = Math.abs(cx - CL) < Math.abs(CR - cx) ? cx < lo : cx > hi;   // the hand nearest the sideline
      return { zone: "edge", outside: outside, r: cx < lo ? spans[0].r : spans[spans.length - 1].r };
    }
    return { zone: "clear" };
  }
  // on slower sets the blockers still have time to slide toward where the ball is going
  function reactBlock(def, blockers, cx, tempo) {
    if (!blockers.length) return;
    // the whole wall slides together toward the swing (better blockers react further)
    var xs = blockers.map(function (r) { return def.tgt[r].x; }), lo = Math.min.apply(null, xs), hi = Math.max.apply(null, xs);
    var avgBlk = blockers.reduce(function (a, r) { return a + def.roster[r].blk; }, 0) / blockers.length;
    var amt = clamp((avgBlk - 50) / 45, 0, 1) * tempo * 14, d = cx < lo ? cx - lo : cx > hi ? cx - hi : 0;
    var shift = Math.sign(d) * Math.min(Math.abs(d), amt);
    blockers.forEach(function (r) { def.tgt[r] = { x: def.tgt[r].x + shift, y: def.tgt[r].y }; });
  }
  // attacking near a sideline: pin hitters, who tool the block off the outside hand
  function isPin(st) { return !st.dump && Math.min(Math.abs(st.x - CL), Math.abs(CR - st.x)) < 90; }
  function autoTiming(attr) { return clamp01(rnd(0.25, 1) * (0.75 + attr / 400)); }
  function aiTarget(defSide, ovr) {
    var best = null, bestScore = -1;
    for (var i = 0; i < 6; i++) {
      var cand = P(defSide.side, rnd(CL + 25, CR - 25), NET + rnd(40, 250));
      var sc = gapScore(defSide, cand) + rnd(0, (100 - ovr) / 60);
      if (sc > bestScore) { bestScore = sc; best = cand; }
    }
    return best;
  }
  function serveTarget(rcv, ovr) {
    var best = null, bs = -1;
    for (var i = 0; i < 5; i++) {
      var c = P(rcv.side, rnd(CL + 25, CR - 25), NET + rnd(110, 255));
      var sc = gapScore(rcv, c) + rnd(0, (100 - ovr) / 50);
      if (sc > bs) { bs = sc; best = c; }
    }
    return best;
  }
  function tipTarget(def) {
    var best = null, bs = -1;
    for (var i = 0; i < 6; i++) {
      var c = P(def.side, rnd(CL + 25, CR - 25), NET + rnd(18, ATK + 25));
      var sc = gapScore(def, c) + rnd(0, 0.3);
      if (sc > bs) { bs = sc; best = c; }
    }
    return best;
  }
  function tipClamp(t) { var d = t.y - NET; return Math.abs(d) > ATK + 35 ? { x: t.x, y: NET + Math.sign(d) * (ATK + 35) } : t; }
  // weighted pick: better teams run more tempo, everyone feeds their stars, nobody repeats the same call forever
  function aiPickSet(s, opts) {
    var ok = opts.filter(function (o) { return !o.disabled; });
    var d = ok.find(function (o) { return o.dump; });
    if (d && Math.random() < 0.1) return d;
    var nonDump = ok.filter(function (o) { return !o.dump; });
    if (!nonDump.length) return ok[0] || opts[opts.length - 1];
    var fastLove = Math.pow(s.team.ovr / 88, 3);
    var bestAtt = nonDump.map(function (o) { return o.hitter; }).sort(function (a, b) { return s.roster[b].att - s.roster[a].att; })[0];
    var w = nonDump.map(function (o) {
      var P0 = s.roster[o.hitter];
      var x = o.tempo < 0.7 ? fastLove : 1;
      var ys = sty(s);
      if (o.pipe) x *= 0.6 * ys.pipe;
      if (o.tempo < 0.7) x *= ys.tempo;
      if (VB.FAMILY[o.hitter] === "MB") x *= ys.middle;
      if (o.hitter === bestAtt) x *= ys.ace;
      if (P0.skill === "spike" || P0.flow) x *= 1.6;
      x *= 0.6 + P0.att / 160;
      if (o.id === s.lastCall) x *= 0.5;
      if (o.combo) x *= 1.8;
      if (mode === "role" && s === me && (o.hitter === myRole || o.hitter === mateRole)) x *= 1.6;   // your setter looks for you more
      return x;
    });
    var sum = w.reduce(function (a, b) { return a + b; }, 0), r = Math.random() * sum;
    for (var i = 0; i < nonDump.length; i++) { r -= w[i]; if (r <= 0) { s.lastCall = nonDump[i].id; return nonDump[i]; } }
    return nonDump[0];
  }
  function aiSpikeTarget(atk, def, from, blockers) {
    var spans = blockers.length ? handSpans(def, blockers) : [], best = null, bs = -1e9;
    for (var i = 0; i < 8; i++) {
      var c = P(def.side, rnd(CL + 25, CR - 25), NET + rnd(40, 250));
      var z = blockZone(spans, crossX(from, c));
      var sharp = Math.abs(c.x - from.x) > 150 && Math.abs(c.y - NET) < 110;   // a short, sharp angle is a low-percentage shot
      var sc = gapScore(def, c) + (z.zone === "clear" ? 0.45 : z.zone === "seam" ? 0.35 : z.zone === "edge" ? (z.outside ? 0.4 : 0.1) : -0.3) -
               (sharp ? 0.25 : 0) + rnd(0, (100 - atk.team.ovr) / 35 + 0.25);
      if (sc > bs) { bs = sc; best = c; }
    }
    return best;
  }
  function aiAttackPlan(atk, def, A, n, st, setQ, contact, blockers) {
    var r = Math.random(), type = "spike", pin = isPin(st);
    // pin hitters facing a block on an imperfect set look to wipe it off the hands
    var wipeP = pin && n >= 1 ? 0.06 + (setQ < 1 ? 0.07 : 0) + (n >= 2 ? 0.04 : 0) : 0;
    var ys = sty(atk);
    if (r < ys.tip) type = "tip";
    else if (r < ys.tip + wipeP * ys.wipe) type = "wipe";
    if (type === "spike" && ready(A, "spike") && Math.random() < 0.7) type = "super";
    var target = type === "tip" ? tipTarget(def) : type === "wipe" ? null : aiSpikeTarget(atk, def, contact, blockers);
    return { type: type, target: target };
  }
  function blockCount(st, def) {
    var n = blockCount0(st);
    if (n >= 1 && n < 3 && Math.random() < sty(def).block) n++;        // wall teams get an extra blocker up
    return n;
  }
  function blockCount0(st) {
    var r = Math.random();
    if (st.tempo < 0.3) return r < 0.7 ? 0 : 1;
    if (st.tempo < 0.5) return r < 0.25 ? 0 : r < 0.85 ? 1 : 2;
    if (st.tempo < 0.7) return r < 0.15 ? 0 : r < 0.7 ? 1 : 2;
    if (st.tempo < 0.9) return r < 0.25 ? 1 : r < 0.8 ? 2 : 3;
    return r < 0.15 ? 1 : r < 0.7 ? 2 : 3;
  }

  // ================== RALLY FLOW ==================
  async function rally() {
    if (Math.random() < 0.05) startWave();                              // now and then the stands start a wave
    buildLineup(me, serving); buildLineup(opp, serving);
    var srvSide = serving === 0 ? me : opp, rcvSide = other(srvSide);
    setTargets(srvSide, serveFormation(srvSide));
    setTargets(rcvSide, receiveFormation(rcvSide));
    updateHud();
    if (mode === "role" && me.onCourt.indexOf(myRole) < 0) {
      feed(0, me.roster[myRole].name + " (YOU) sits this rotation out — " + (myRole === "L" ? "your middle is serving." : "the libero is in for you."));
    }
    if (serving === homeIdx && Math.random() < 0.8) startChant(srvSide);
    preRally();
    await rest(700);
    var winner = await serve(srvSide);
    if (winner !== serving) (winner === 0 ? me : opp).rot = ((winner === 0 ? me : opp).rot + 1) % 6;
    score[winner]++; serving = winner;
    cheer(); sfx("whistle"); refFlagSide = winner; refFlagAt = performance.now(); emit({ k: "ref", s: refFlagSide });
    tickCooldowns();
    updateStreaks(winner);
    updateHud();
    await postRally(winner);
    await rest(800);
  }

  async function serveMotion(s, role, kind, jumpFloat, power) {
    var spot = serveFrom(s.side), dir = s.side === 0 ? 1 : -1;
    var contact = { x: spot.x, y: spot.y - 6 * dir };
    if (kind === "spin") {
      // walk back, big toss, three-step run-up, leap, WHAM — then land inside the court
      var back = { x: spot.x, y: spot.y + 40 * dir };
      moveTo(s, role, back);
      await sleep(380);
      var toss = flyBall(back, { x: contact.x, y: contact.y + 6 * dir }, 820, { h0: 0.5, h1: 1.6, peak: 1.6, skew: 0.55, spin: 4, quiet: 1 });
      await sleep(200);
      jump(s, role, 420, 2, "approach");
      s.rush[role] = true; moveTo(s, role, spot);
      await sleep(330);
      jump(s, role, 480, 16, "spike");
      await toss;
      ring(contact, power > 0.7 ? "#ff7a2a" : "#ffd21e", power > 0.7 ? 40 : 30, 0.35);
      puff(contact, power > 0.7 ? 8 : 4, "#fff3b0");
      if (power > 0.7) popup("BOOM!", contact, "#ff7a2a");
      setTimeout(function () { if (s.pos[role]) moveTo(s, role, { x: spot.x, y: spot.y - 26 * dir }); }, 260);
    } else if (jumpFloat) {
      var back2 = { x: spot.x, y: spot.y + 18 * dir };
      moveTo(s, role, back2);
      await sleep(300);
      var toss2 = flyBall(back2, contact, 600, { h0: 0.5, h1: 1.1, peak: 0.7, skew: 0.55, quiet: 1 });
      await sleep(220);
      moveTo(s, role, spot);
      await sleep(180);
      jump(s, role, 360, 7, "serve");
      await toss2;
      ring(contact, "#ffffff", 20, 0.3);
    } else {
      jump(s, role, 300, 0, "set");                                   // tosses it from both hands
      await flyBall(spot, contact, 520, { h0: 0.5, h1: 0.9, peak: 0.6, skew: 0.6, quiet: 1 });
      jump(s, role, 240, 3, "serve");
      ring(contact, "#ffffff", 16, 0.25);
    }
    return contact;
  }

  async function serve(srv) {
    var rcv = other(srv), sr = srv.lineup[1], Sv = srv.roster[sr], kind, target, tossMod = null;
    if (srv === me && iControl(sr)) {
      msg(Sv.name + " TO SERVE — PICK THE SERVE");
      var o = [{ label: "FLOAT SERVE", value: "float" }, { label: "TOPSPIN SERVE", value: "spin" }];
      if (Sv.skill === "serve") o.push({ label: "★ " + skillLabel(Sv) + (Sv.cd ? " (" + Sv.cd + ")" : ""), value: "super", disabled: !ready(Sv, "serve") });
      kind = await askB(sr, o);
      msg("CLICK WHERE TO SERVE");
      target = await aimClick("top", sr);
      if (mode === "role") {
        var tossQ = await timingBar("TOSS & SERVE — " + Sv.name + "!", 1000, 0.24 + (Sv.srv - 70) / 300, sr);
        tossMod = tossQ;
      }
    } else {
      kind = ready(Sv, "serve") && Math.random() < 0.7 ? "super" : Math.random() < sty(srv).spin ? "spin" : "float";
      target = serveTarget(rcv, srv.team.ovr);
      msg(Sv.name + " — " + (kind === "float" ? "FLOAT" : kind === "super" ? "SUPER" : "TOPSPIN") + " SERVE!");
    }
    var superServe = kind === "super";
    if (superServe) { kind = "spin"; useSkill(srv, Sv); }
    var sp = serveParams(kind, Sv.srv, srv === me ? 0.5 + Sv.srv / 250 : 0.4 + srv.team.ovr / 300);
    if (superServe) { sp.power = clamp01(sp.power + 0.4); sp.errP += 0.02; }
    if (kind === "spin") sp.power = clamp01(sp.power + ps(Sv, "power_serve") * 0.06);
    sp.errP = Math.max(0.012, sp.errP - ps(Sv, "safe_serve") * 0.022);
    var floatM = kind === "float" ? ps(Sv, "float_master") : 0;
    if (tossMod != null) {                                       // a clean toss hits harder; a bad one risks an error
      sp.power = clamp01(sp.power * (0.85 + 0.3 * tossMod));
      sp.errP = Math.max(0.02, sp.errP + (tossMod < 0.35 ? 0.1 : tossMod >= 1 ? -0.02 : 0));
    }
    if (!(srv === me && iControl(sr))) { sp.power = clamp01(sp.power + sty(srv).serveRisk); sp.errP = Math.max(0.02, sp.errP + sty(srv).serveRisk * 0.6); }
    sp.errP += Math.max(0, -edge(srv)) * 0.12;                      // weaker sides miss more serves under pressure
    target = clampHalf(rcv, { x: target.x + rnd(-1, 1) * sp.wobble * 90, y: target.y + rnd(-1, 1) * sp.wobble * 60 });
    var jumpFloat = kind === "float" && Math.random() < 0.4 + (Sv.srv - 70) / 100;
    if (!superServe) feed(srv.side, Sv.name + (kind === "spin" ? " rips a jump topspin!" : jumpFloat ? " jump-floats one — it's dancing..." : " floats one over..."));

    var contact = await serveMotion(srv, sr, kind, jumpFloat, sp.power);
    var errKind = Math.random() < sp.errP ? (Math.random() < 0.5 ? "net" : "long") : null;
    var dirR = rcv.side === 0 ? 1 : -1;
    if (errKind === "net") {
      var netPt = { x: target.x, y: NET - dirR * 6 };
      await flyBall(contact, netPt, 600, { h0: 1.2, h1: 0.6, peak: 0.3 });
      netShake();
      await flyBall(netPt, { x: netPt.x, y: NET - dirR * 30 }, 260, { h0: 0.6, h1: 0 });
      msg("SERVE INTO THE NET!"); feed(srv.side, "...but it catches the net. Service error.");
      Sv.st.se++;
      return credit(rcv);
    }
    if (!errKind && Math.random() < 0.04) return await netCordServe(srv, rcv, Sv, sr, contact, target);
    if (errKind === "long") target = { x: target.x, y: dirR > 0 ? CB + 24 : CT - 24 };

    var flightMs = kind === "spin" ? (superServe ? 680 : 780) : 1150;
    var fo = kind === "spin" ? { h0: 1.5, h1: 0, peak: 0.5, skew: 0.3, spin: 22, trail: superServe || sp.power > 0.7 ? "hot" : "fast" }
                             : { h0: 0.9, h1: 0, peak: 0.6, skew: 0.5, wobble: jumpFloat ? 13 : 9, trail: "float" };
    var flight = flyBall(contact, target, flightMs, fo);
    var rcvRole = onServeContact(srv, rcv, target);
    var RP = rcv.roster[rcvRole], timing = null;
    // the receiving line braces; the passer calls it; on a float they keep adjusting to the movement
    rcv.onCourt.forEach(function (r) { if (r !== "S" && !isFront(rcv, r) || r === rcvRole) jump(rcv, r, flightMs, 0, "ready"); });
    setTimeout(function () { if (rcv.pos[rcvRole]) popup(rcvRole === "L" ? "MINE!" : pick(["MINE!", "GOT IT!", "ME!"]), rcv.pos[rcvRole], "#ffffff"); }, flightMs * 0.35);
    if (kind === "float") [0.3, 0.55].forEach(function (f) {
      setTimeout(function () { if (rcv.pos[rcvRole]) moveTo(rcv, rcvRole, { x: target.x + rnd(-16, 16), y: target.y + rnd(-6, 6) }); }, flightMs * f);
      setTimeout(function () { if (rcv.pos[rcvRole]) moveTo(rcv, rcvRole, target); }, flightMs * 0.8);
    });
    if (!errKind && rcv === me && iControl(rcvRole)) {
      await sleep(150); slow();
      timing = await timingBar("RECEIVE — " + RP.name + " vs " + Sv.name + " (SRV " + Sv.srv + ")!",
        duelSpeed(Sv.srv + (kind === "spin" ? sp.power * 12 : 0), RP.rec, superServe || Sv.flow),
        0.28 + (RP.rec - Sv.srv) / 250 - sp.power * 0.08 - (superServe ? 0.07 : 0) - (kind === "float" ? 0.02 + floatM * 0.03 : 0) + ps(RP, "platform") * 0.035 + clutchAdj(RP), rcvRole);
      fast();
    } else if (rcv === me) timing = autoTiming(RP.rec + ps(RP, "platform") * 6 - floatM * 6);
    await flight;
    if (errKind === "long") { msg("LONG — OUT!"); feed(srv.side, "...long! Service error."); Sv.st.se++; return credit(rcv); }

    var useRec = ready(RP, "rec") && (rcv !== me || iControl(rcvRole) || Math.random() < 0.7);
    if (useRec) useSkill(rcv, RP);
    var rq = rcv === me ? clamp01(timing * 0.72 + RP.rec / 320 - sp.power * 0.28 + rnd(-0.04, 0.06) + edge(rcv) * 0.4 + mom[rcv.side])
                        : clamp01(RP.rec / 110 - sp.power * 0.45 + rnd(-0.12, 0.18) + edge(rcv) * 0.8 + mom[rcv.side]);
    if (useRec) rq = clamp01(rq + 0.35);
    rq = clamp01(rq + ((RP.spd || 70) - 70) / 500);                  // quick feet get behind the ball
    if (superServe && rcv !== me) rq = clamp01(rq - 0.12);
    var shank = !useRec && Math.random() < SHANK_P * techShank(RP) * (superServe ? 2 : 1);
    var grade = shank ? -1 : passGrade(rq);
    RP.st.rc++;
    if (grade < 0) {
      if (shank) { var how0 = await shankFx(rcv, rcvRole, target); feed(rcv.side, RP.name + " shanks the serve " + how0); }
      else {
        jump(rcv, rcvRole, 520, -3, "shank");
        var away = { x: target.x + (target.x < W / 2 ? -1 : 1) * rnd(90, 160), y: target.y + dirR * rnd(60, 120) };
        await flyBall(target, away, 520, { peak: 1.2, spin: 30 });
        popup("ACE!", target, "#ffd21e");
      }
      Sv.st.ace++; RP.st.re++; shake(5);
      msg(shank ? "SHANKED INTO THE STANDS!" : "ACE!!"); cheer();
      feed(srv.side, shank ? RP.name + " SHANKS the serve into the crowd!" : "ACE! " + Sv.name + " is on fire.", true);
      return credit(srv, sr);
    }
    var overhead = kind === "float" && rcvRole !== "L" && RP.tec >= 72 && Math.random() < 0.22;
    jump(rcv, rcvRole, 500, overhead ? 2 : -3, overhead ? "set" : "pass");
    if (kind === "spin" && sp.power > 0.62) {                      // a heavy serve knocks the passer back a step
      ring(target, "#ffffff", 22, 0.3); puff(target, 6);
      moveTo(rcv, rcvRole, { x: target.x, y: target.y + dirR * 14 });
    }
    if (grade === 2) { RP.st.rp++; ring(target, "#3dff7a", 26, 0.45); if (Math.random() < 0.5) popup("PERFECT!", target, "#3dff7a"); }
    if (grade === 0) popup(pick(["OFF!", "SCRAMBLE!", "UH-OH"]), target, "#ffb000");
    feed(rcv.side, RP.name + (overhead ? " takes it with the hands — " : " passes — ") + GRADE_TXT[grade].toLowerCase() + ".");
    if (grade === 0 && Math.random() < 0.12) return await overpass(rcv, target);
    var setter = await toSetter(rcv, target, grade, rcvRole);
    return await offense(rcv, grade, setter);
  }

  // a shank: the ball cannons off the arms into the stands and the passer goes down
  // shanks come in flavours — returns how it went, for the commentary
  async function shankFx(s, role, at) {
    var dir = at.x < W / 2 ? -1 : 1, back = s.side === 0 ? 1 : -1, v = (function (r) { return r < 0.38 ? "stands" : r < 0.74 ? "chase" : r < 0.86 ? "face" : r < 0.96 ? "collide" : "roof"; })(Math.random());   // realistic mix
    puff(at, 10);
    if (v === "face") {
      jump(s, role, 1100, -2, "fall", -dir);
      popup("OFF THE FACE!", at, "#ff4d4d");
      var hd = { x: at.x, y: at.y - 18 * back };
      setTimeout(function () { popup("✶ ✶ ✶", hd, "#ffd21e"); }, 250);
      var l1 = { x: clamp(at.x + rnd(-40, 40), CL - 40, CR + 40), y: clamp(at.y + back * rnd(170, 230), 20, H - 20) };
      await flyBall(at, l1, 950, { peak: 2.0, spin: 25, skew: 0.35 });
      puff(l1, 12, "#ffd21e"); popup("BONK!", l1, "#ffffff");
      return "right off the face!";
    }
    if (v === "roof") {
      jump(s, role, 900, -3, "shank");
      popup("SHANK!", at, "#ff4d4d");
      var l2 = { x: clamp(at.x + dir * rnd(60, 140), -50, W + 50), y: clamp(at.y + back * rnd(120, 200), 20, H - 20) };
      await flyBall(at, l2, 1500, { peak: 6.5, spin: 20, skew: 0.5 });
      puff(l2, 18, "#ffd21e"); popup("OFF THE ROOF!", l2, "#ffffff");
      cheer(); return "straight up into the roof!";
    }
    if (v === "ref") {
      jump(s, role, 800, -2, "fall", 1);
      popup("SHANK!", at, "#ff4d4d");
      var refAt = { x: CR + 34, y: NET - 14 };
      await flyBall(at, refAt, 800, { peak: 1.8, spin: 40, skew: 0.5 });
      refFlagSide = 1 - s.side; refFlagAt = performance.now(); emit({ k: "ref", s: refFlagSide });
      puff(refAt, 14, "#ffffff"); popup("SORRY REF!", refAt, "#ffd21e");
      cheer(); return "into the referee's stand!";
    }
    if (v === "chase") {
      jump(s, role, 700, -3, "shank");
      popup("SHANK!", at, "#ff4d4d");
      var l3 = { x: dir < 0 ? CL - rnd(40, 70) : CR + rnd(40, 70), y: clamp(at.y + back * rnd(80, 170), 30, H - 30) };
      var mates = s.onCourt.filter(function (r) { return r !== role; });
      var ch = nearest(s, l3, mates).pos;
      if (ch) { s.rush[ch] = true; moveTo(s, ch, { x: clamp(l3.x, CL - 30, CR + 30), y: l3.y }); }
      await flyBall(at, l3, 950, { peak: 1.6, spin: 30, skew: 0.45 });
      if (ch) { jump(s, ch, 650, -2, "dive", dir); popup("SO CLOSE!", l3, "#ffffff"); }
      puff(l3, 14, "#ffd21e");
      return "off the shoulder — " + (ch ? s.roster[ch].name + " sprints and dives, just too late!" : "nobody can chase it down!");
    }
    if (v === "collide") {
      var mate = nearest(s, at, s.onCourt.filter(function (r) { return r !== role; })).pos;
      if (mate) { s.rush[mate] = true; moveTo(s, mate, { x: at.x + dir * 10, y: at.y }); }
      await sleep(160);
      jump(s, role, 1100, -2, "fall", -dir);
      if (mate) jump(s, mate, 1100, -2, "fall", dir);
      popup("COLLISION!", at, "#ff4d4d");
      var l4 = { x: clamp(at.x + rnd(-60, 60), CL, CR), y: clamp(at.y + back * rnd(30, 80), 20, H - 20) };
      await flyBall(at, l4, 600, { peak: 0.9, spin: 18 });
      puff(l4, 10);
      return mate ? "— they collide with " + s.roster[mate].name + " and both go down!" : "and stumbles over!";
    }
    jump(s, role, 1000, -2, "fall", -dir);
    popup("SHANK!", at, "#ff4d4d");
    var land = { x: dir < 0 ? rnd(-62, -32) : W + rnd(32, 62), y: clamp(at.y + rnd(-90, 120), 30, H - 30) };
    await flyBall(at, land, 900, { peak: 2.4, spin: 45, skew: 0.45 });
    puff(land, 16, "#ffd21e");
    popup(pick(["INTO THE STANDS!", "OOF!", "WHOOPS!"]), land, "#ffffff");
    cheer(); return "into the stands!";
  }

  // the serve clips the tape and trickles over — a "waterfall"
  async function netCordServe(srv, rcv, Sv, sr, contact, target) {
    var dirR = rcv.side === 0 ? 1 : -1, tape = { x: target.x, y: NET };
    feed(srv.side, Sv.name + "'s serve clips the tape...");
    await flyBall(contact, tape, 700, { h0: 1.2, h1: 0.9, peak: 0.4 });
    netShake();
    var drop = clampHalf(rcv, { x: tape.x + rnd(-25, 25), y: NET + dirR * rnd(14, 34) });
    var who = nearest(rcv, drop, null).pos, dir = Math.sign(drop.x - rcv.pos[who].x) || 1;
    rcv.rush[who] = true; moveTo(rcv, who, drop);
    await flyBall(tape, drop, 520, { h0: 0.9, h1: 0, peak: 0.25 });
    if (Math.random() < 0.55) {
      msg("WATERFALL ACE!"); cheer();
      feed(srv.side, "...and it trickles down over the net — WATERFALL ACE!", true);
      Sv.st.ace++;
      return credit(srv, sr);
    }
    jump(rcv, who, 600, -2, "dive", dir);
    feed(rcv.side, rcv.roster[who].name + " dives and scrapes it up!");
    rcv.roster[who].st.rc++;
    var setter = await toSetter(rcv, drop, 0, who);
    return await offense(rcv, 0, setter);
  }

  // a bad pass drifts over the net: the other side's front row pounces, or it becomes a joust
  async function overpass(ps, from) {
    var att = other(ps), dir = ps.side === 0 ? -1 : 1;
    var over = { x: clamp(from.x + rnd(-40, 40), CL + 20, CR - 20), y: NET + dir * rnd(26, 44) };
    feed(ps.side, "...it's an OVERPASS!", true); msg("OVERPASS!");
    var hitter = nearest(att, over, frontRoles(att)).pos, A = att.roster[hitter];
    var blocker = nearest(ps, { x: over.x, y: NET - dir * 30 }, frontRoles(ps)).pos, B = ps.roster[blocker];
    moveTo(att, hitter, { x: over.x, y: over.y + dir * 12 });
    moveTo(ps, blocker, { x: over.x, y: NET - dir * 32 });
    await flyBall(from, over, 650, { h0: 0, h1: 1.3, peak: 0.6 });
    jump(att, hitter, 420, 14, "spike"); jump(ps, blocker, 460, 12, "block");
    A.st.att++;
    await sleep(180);
    if (Math.random() < 0.3) return await joust(att, hitter, ps, blocker, over);
    var down = clampHalf(ps, { x: over.x + rnd(-60, 60), y: NET - dir * rnd(40, 160) });
    await flyBall(over, down, 260, { h0: 1.3, h1: 0 });
    await bounce(over, down);
    msg("OVERPASS KILL!"); cheer();
    A.st.k++;
    feed(att.side, A.name + " punishes the overpass!", true);
    return credit(att, hitter);
  }

  // both players get hands on the ball above the net — strength and reach decide it
  async function joust(atk, hitter, def, blocker, at) {
    var A = atk.roster[hitter], B = def.roster[blocker], dirA = atk.side === 0 ? 1 : -1;
    msg("JOUST AT THE NET!");
    feed(-1, "JOUST! " + A.name + " and " + B.name + " fight over the net...", true);
    jump(atk, hitter, 600, 14, "block"); jump(def, blocker, 600, 13, "block");
    await flyBall(at, { x: at.x, y: NET }, 200, { h0: 1.3, h1: 1.2 });
    netShake();
    await sleep(320);
    var aWins = Math.random() < clamp01(0.5 + (A.att + A.spikeReach / 5 - B.blk - B.blockReach / 5) / 60);
    var land = aWins ? clampHalf(def, { x: at.x + rnd(-30, 30), y: NET - dirA * rnd(20, 60) })
                     : clampHalf(atk, { x: at.x + rnd(-30, 30), y: NET + dirA * rnd(20, 60) });
    await flyBall({ x: at.x, y: NET }, land, 300, { h0: 1.2, h1: 0 });
    cheer();
    if (aWins) { A.st.k++; feed(atk.side, A.name + " wins the joust!", true); return credit(atk, hitter); }
    B.st.blk++; A.st.bk++;
    feed(def.side, B.name + " wins the joust!", true);
    return credit(def, blocker);
  }

  // up to four plain-English options (one per hitter), the setter's suggestion first, and the full playbook behind MORE
  var FRIENDLY = { MB: "QUICK", OH: "OUTSIDE", OP: "RIGHT SIDE" };
  var SIMPLE_PREF = ["combo", "one", "high", "five", "pipe", "go", "red", "31", "slide", "d", "bic"];
  function simpleSetMenu(opts, atk, role) {
    var avail = opts.filter(function (o) { return !o.disabled && !o.dump; });
    var rec = aiPickSet(atk, opts);
    if (!rec || rec.dump || rec.disabled) rec = null;
    function simpleFor(h) {
      return avail.filter(function (o) { return o.hitter === h; }).sort(function (a, b) { return SIMPLE_PREF.indexOf(a.id) - SIMPLE_PREF.indexOf(b.id); })[0];
    }
    function nice(o) {
      var HP = atk.roster[o.hitter];
      return (o.combo ? o.label : o.pipe ? "BACK ROW" : FRIENDLY[VB.FAMILY[o.hitter]] || o.label) + " → " + HP.name + (HP.skill === "spike" ? " ★" : "");
    }
    var picks = [], seen = {};
    (rec ? [rec] : []).concat(avail).forEach(function (o) {
      if (seen[o.hitter] || picks.length >= 4) return;
      seen[o.hitter] = 1; picks.push(o === rec ? rec : simpleFor(o.hitter));
    });
    var btns = picks.map(function (o) { return { label: (o === rec ? "👍 " : "") + nice(o), value: o.id }; });
    var d = opts.find(function (o) { return o.dump; });
    if (d) btns.push({ label: "★ " + skillLabel(atk.roster.S) + (atk.roster.S.cd ? " (" + atk.roster.S.cd + ")" : ""), value: d.id, disabled: d.disabled });
    btns.push({ label: "MORE CALLS ▸", value: "__more" });
    return askB(role || "S", btns);
  }

  async function offense(atk, grade, setterRole) {
    setterRole = setterRole || "S";
    var def = other(atk), SN = atk.roster[setterRole].name, emergency = !isSetter(atk, setterRole);
    var opts = setOptions(atk, grade);
    if (setterRole !== "S") opts = opts.filter(function (o) { return o.hitter !== setterRole && !o.dump; });   // the setter can't set themself
    if (emergency) opts = opts.filter(function (o) { return o.id === "high" || o.id === "five"; });
    var st = null;
    if (atk === me && !emergency && iControl(setterRole) && !mateRole) {       // co-op matches: the setter runs the offence automatically
      msg(SN + " TO SET (" + GRADE_TXT[grade] + ") — 👍 = SETTER'S PICK");
      var choice = await simpleSetMenu(opts, atk, setterRole);
      if (choice === "__more") {
        msg(SN + " — FULL PLAYBOOK (" + GRADE_TXT[grade] + ")");
        choice = await askB(setterRole, opts.map(function (o) {
          if (o.dump) return { label: "★ " + skillLabel(me.roster.S) + (me.roster.S.cd ? " (" + me.roster.S.cd + ")" : ""), value: o.id, disabled: o.disabled };
          var HP = me.roster[o.hitter];
          return { label: o.label + " · " + HP.name + (HP.skill === "spike" ? " ★" : ""), value: o.id, disabled: o.disabled };
        }));
      }
      st = opts.find(function (o) { return o.id === choice; });
      if (mode === "role" && !st.dump) {
        var setTq = await timingBar("SET — SOFT HANDS, " + SN + "!", 1000, 0.24 + (me.roster[setterRole].set - 70) / 300, setterRole);
        st = Object.assign({}, st, { setAdj: setTq >= 1 ? 0.12 : setTq >= 0.5 ? 0 : -0.18 });
        if (setTq < 0.5) feed(0, SN + "'s set is a little off...");
      }
    } else if (atk === me && mode === "role" && !emergency && !mateRole) {
      var callers = humans().filter(function (h) { return opts.some(function (o) { return !o.disabled && !o.dump && o.hitter === h; }); });
      var caller = callers.length ? pick(callers) : myRole;           // co-op: either of you can call for it
      var mine = opts.filter(function (o) { return !o.disabled && !o.dump && o.hitter === caller; });
      if (mine.length && TAC.call === "feed") {
        var auto = mine.slice().sort(function (a, b) { return SIMPLE_PREF.indexOf(a.id) - SIMPLE_PREF.indexOf(b.id); })[0];
        if (Math.random() < [0.70, 0.85, 0.97][grade]) { st = auto; feed(0, SN + " looks for " + me.roster[caller].name + (caller === mateRole ? " (P2)" : " (YOU)") + " — " + auto.say + "!"); }
        else feed(0, SN + " goes elsewhere...");
      } else if (mine.length && TAC.call === "ask") {
        msg("CALL FOR THE BALL? (" + GRADE_TXT[grade] + ")");
        var call = await askB(caller, mine.map(function (o) { return { label: "CALL " + o.label, value: o.id }; })
          .concat([{ label: "LET " + SN + " DECIDE", value: "auto" }]));
        if (call !== "auto") {
          var want = mine.find(function (o) { return o.id === call; });
          feed(0, me.roster[caller].name + (caller === mateRole ? " (P2)" : " (YOU)") + " calls for " + want.say + "!");
          if (Math.random() < [0.70, 0.85, 0.97][grade]) st = want; else feed(0, SN + " goes elsewhere...");   // perfect / good / poor pass
        }
      }
    }
    if (!st) st = aiPickSet(atk, opts);
    if (emergency) feed(atk.side, SN + (setterRole === "L" ? " (libero)" : "") + " has to take the second ball — a high ball from deep!");
    if (st.dump) return await dumpAttack(atk, def, grade);
    return await spikeAttack(atk, def, grade, st, setterRole);
  }

  async function dumpAttack(atk, def, grade) {
    var S = atk.roster.S, iAttack = atk === me, target;
    useSkill(atk, S);
    if (iAttack && iControl("S")) { slow(); msg("DUMP — CLICK WHERE TO DROP IT!"); target = await aimClick("top", "S"); fast(); }
    else target = tipTarget(def);
    target = tipClamp(target);
    feed(atk.side, S.name + " shows set... and DUMPS it on two!", true);
    jump(atk, "S", 380, 9, "spike");
    S.st.att++;
    var mb = frontRoles(def).find(function (r) { return r.indexOf("MB") === 0; });
    var read = Math.random() < 0.1;                                   // a signature dump is hard to read
    if (read) jump(def, mb, 420, 10, "block");
    await sleep(170);
    var from = ballPos();
    if (read && Math.random() < 0.5) {
      var bp = { x: from.x, y: NET + (def.side === 0 ? 8 : -8) };
      await flyBall(from, bp, 150, { h0: 1.1, h1: 0.8 });
      netShake();
      await flyBall(bp, { x: bp.x + rnd(-20, 20), y: NET + (atk.side === 0 ? 1 : -1) * 40 }, 260, { h0: 0.8, h1: 0 });
      msg("READ THE DUMP — STUFFED!"); cheer();
      S.st.bk++; def.roster[mb].st.blk++;
      feed(def.side, def.roster[mb].name + " reads the dump and stuffs it!", true);
      return credit(def, mb);
    }
    return await defensePlay(def, atk, from, target, { type: "tip", dump: true, A: S, hitterRole: "S", setterRole: null, setQ: 1, st: { x: from.x, tempo: 0.3 } });
  }

  async function spikeAttack(atk, def, grade, st, setterRole) {
    var iAttack = atk === me, dirA = atk.side === 0 ? 1 : -1;
    var hitter = st.hitter, A = atk.roster[hitter], SN = atk.roster[setterRole].name;
    var contact = { x: st.x, y: NET + dirA * (st.pipe ? ATK + 18 : 34) };
    var setFrom = ballPos();
    def.superBlocker = null;

    moveTo(atk, hitter, { x: contact.x, y: contact.y + dirA * 16 });
    coverHitter(atk, hitter, setterRole, contact);
    var n = blockCount(st, def), late = 1, tight = 0, guessed = null;
    if (def === me && TAC.block === "read") {                         // react to the set: late on quicks, a full wall on high balls
      if (st.tempo < 0.6 && n > 0 && Math.random() < 0.4) n--;
      if (st.tempo >= 0.8 && n < 3 && Math.random() < 0.45) n++;
      late = st.tempo >= 0.8 ? 0.4 : 1.2; tight = st.tempo >= 0.8 ? 5 : 0;
    } else if (def === me && TAC.block === "guess") {                 // commit early: huge if right, beaten if wrong
      guessed = Math.random() < 0.38 + (A.skill ? 0.1 : 0);
      n = guessed ? Math.min(3, Math.max(n, 2) + (Math.random() < 0.4 ? 1 : 0)) : Math.max(0, n - 1);
      late = guessed ? 0 : 2; tight = guessed ? 8 : -4;
    }
    var blockers = chooseBlockers(def, st.x, n);
    def.jumpQ = null;
    var lean = def === me && TAC.lean !== "auto" ? TAC.lean : Math.random() < 0.5 ? "cross" : "line";
    var spacing = Math.max(0, 0.75 - st.tempo) * 24 + rnd(-2, 3) - tight;   // extra gap between hands: fast sets open seams
    var bAx = st.x + (1 - st.tempo) * rnd(-22, 22) * late;          // ...and the block a step late
    placeDefense(def, bAx, blockers, lean, spacing);
    var controlled = iAttack && iControl(hitter);
    var plan = controlled ? null : aiAttackPlan(atk, def, A, n, st, grade === 2 ? 1 : grade === 1 ? 0.75 : 0.5, contact, blockers);
    if (guessed !== null) feed(0, guessed ? "Your middle GUESSED RIGHT — the block was waiting for " + A.name + "!" : "Your block guessed wrong — " + A.name + " has a step on them!", guessed);
    if (!iAttack && n && plan.target && TAC.lean === "auto") {
      var actual = shotDir(st.x, plan.target);
      var myBlk = blockers.reduce(function (a, r) { return a + me.roster[r].blk; }, 0) / n;
      if (actual !== "angle" && Math.random() < clamp01((0.3 + myBlk / 300) * st.tempo)) { lean = actual; placeDefense(def, bAx, blockers, lean, spacing); }
    }
    feed(atk.side, SN + " sets " + st.say + " for " + A.name + (A.skill ? " ★" : "") + "...");
    if (n === 0 && st.tempo < 0.6) feed(def.side, "...the middle is late — nobody up to block!");
    jump(atk, setterRole, 420, 2, "set");
    var setFlight = flyBall(setFrom, contact, 380 + st.tempo * 420, { h0: 1.1, h1: 1.4, peak: st.peak });
    var blockInfo = BLOCK_TXT[n] + (n && st.tempo >= 0.7 ? ", LEANING " + lean.toUpperCase() : "");

    var superBlock = false;
    if (controlled) {
      slow();
      msg(st.label + " TO " + A.name + " — " + blockInfo + "!");
      var ch = [];
      if (A.skill === "spike") ch.push({ label: "★ " + skillLabel(A) + (A.cd ? " (" + A.cd + ")" : ""), value: "super", disabled: !ready(A, "spike") });
      ch.push({ label: "SPIKE", value: "spike" }, { label: "TIP", value: "tip" });
      if (n > 0) ch.push({ label: "WIPE OFF BLOCK", value: "wipe" });
      var type = await askB(hitter, ch), tgt = null, jumpQ = null;
      if (mode === "role") {
        fast();
        jumpQ = await timingBar("APPROACH — JUMP, " + A.name + "!", 900, 0.22 + (A.att - 70) / 300 + (A.vert - 85) / 400, hitter);
        slow();
      }
      if (type !== "wipe") {
        msg(type === "tip" ? "CLICK WHERE TO TIP IT" :
            "AIM: GREEN = CLEAR • YELLOW = TOOL/EDGE • RED = INTO THE BLOCK" + (st.tempo >= 0.8 && n ? " (SLOW SET — THE BLOCK CAN STILL ADJUST)" : ""));
        aimCtx = type === "tip" || !n ? null : { from: contact, def: def, blockers: blockers };
        tgt = await aimClick("top", hitter);
        aimCtx = null;
      }
      fast();
      plan = { type: type, target: tgt, jump: jumpQ };
    } else if (iAttack) msg(st.label + " TO " + A.name + " — " + blockInfo + "!");
    else msg(atk.team.name + ": " + st.label + " TO " + A.name + " — " + BLOCK_TXT[n] + "!");

    if (!iAttack && n > 0) {
      var hb = mode === "role" ? humans().filter(function (h) { return blockers.indexOf(h) >= 0; }) : [];
      if (hb.length && st.tempo >= 0.7 && TAC.lean === "auto") {
        slow();
        msg((hb[0] === mateRole ? "P2 IS" : "YOU'RE") + " IN THE " + BLOCK_TXT[n] + " ON " + A.name + " — LEAN WHICH WAY?");
        lean = await askB(hb[0], [{ label: "LEAN CROSS", value: "cross" }, { label: "LEAN LINE", value: "line" }]);
        fast();
        placeDefense(def, bAx, blockers, lean, spacing);
        feed(0, me.roster[hb[0]].name + (hb[0] === mateRole ? " (P2)" : " (YOU)") + " leans " + lean + "...");
      } else if (st.tempo >= 0.7) feed(0, "your " + BLOCK_TXT[n].toLowerCase() + " leans " + lean + "...");
      if (hb.length) {
        var bqs = await Promise.all(hb.map(function (h) {
          return timingBar("BLOCK — TIME YOUR JUMP, " + me.roster[h].name + "!", 900, 0.22 + (me.roster[h].blk - 70) / 300 - (1 - st.tempo) * 0.06, h);
        }));
        def.jumpQ = {}; hb.forEach(function (h, i) { def.jumpQ[h] = bqs[i]; });
      }
      var sb = blockers.find(function (r) { return ready(def.roster[r], "block"); });
      if (sb && iControl(sb)) {
        slow(); msg("★ " + skillLabel(def.roster[sb]) + " WITH " + def.roster[sb].name + "?");
        superBlock = await askB(sb, [{ label: "★ " + skillLabel(def.roster[sb]), value: true }, { label: "NORMAL BLOCK", value: false }]);
        fast();
      } else if (sb) superBlock = Math.random() < 0.6;
      if (superBlock) useSkill(def, def.roster[sb]);
      def.superBlocker = superBlock ? sb : null;
    } else if (iAttack && n > 0) {
      if (st.tempo >= 0.7) feed(1, "their " + BLOCK_TXT[n].toLowerCase() + " is leaning " + lean + "...");
      var sbo = blockers.find(function (r) { return ready(def.roster[r], "block"); });
      if (sbo && Math.random() < 0.6) { superBlock = true; useSkill(def, def.roster[sbo]); }
      def.superBlocker = superBlock ? sbo : null;
    }
    if (plan.type === "super") useSkill(atk, A);
    await setFlight;

    jump(atk, hitter, 450, 14, plan.type === "wipe" ? "wipe" : "spike", st.x < W / 2 ? -1 : 1);
    blockers.forEach(function (r, i) { jumpLater(def, r, 60 + i * 30, 500, 12, "block"); });
    await sleep(190);
    return await resolveHit(atk, def, hitter, st, plan, blockers, lean, superBlock, grade, contact, setterRole);
  }

  async function resolveHit(atk, def, hitter, st, plan, blockers, lean, superBlock, grade, contact, setterRole) {
    var A = atk.roster[hitter], dirA = atk.side === 0 ? 1 : -1, dirD = -dirA, n = blockers.length;
    var SP = atk.roster[setterRole] || atk.roster.S;
    var setQ = clamp((grade === 2 ? 1 : grade === 1 ? 0.75 : 0.5) + (st.setAdj || 0) + ((SP.tec || 70) - 72) / 300 + ps(SP, "soft_hands") * 0.05, 0.4, 1.15);   // the setter's technique
    var Bs = blockers.map(function (r) { return def.roster[r]; });
    var blkAvg = n ? Bs.reduce(function (a, b) { return a + b.blk; }, 0) / n : 0;
    var superSpike = plan.type === "super", type = superSpike ? "spike" : plan.type, target = plan.target;
    var bx = n ? blockers.reduce(function (a, r) { return a + def.tgt[r].x; }, 0) / n : st.x;
    if (type === "tip") target = tipClamp(target);
    if (type === "wipe") target = { x: st.x < W / 2 ? CL - 28 : CR + 28, y: NET + dirD * rnd(80, 220) };
    var dir = shotDir(st.x, target);
    var readRight = n && type === "spike" && dir !== "angle" && lean === dir;
    var readWrong = n && type === "spike" && dir !== "angle" && lean !== dir;
    var BtouchRole = n ? (def.superBlocker || blockers[irnd(0, n - 1)]) : null;
    var Btouch = n ? def.roster[BtouchRole] : null;
    var blockPt = { x: bx, y: n ? def.tgt[blockers[0]].y - 24 : NET };
    if (type === "spike") target = { x: target.x + rnd(-1, 1) * (1 - setQ) * 16, y: target.y + rnd(-1, 1) * (1 - setQ) * 16 };
    var shot = shotName(st.x, target);
    var pin = isPin(st), quickMB = VB.FAMILY[hitter] === "MB" && st.tempo < 0.6;
    A.st.att++;

    // a tight, poor set can turn into a joust over the net
    if (n && setQ <= 0.5 && type === "spike" && Math.random() < 0.08) return await joust(atk, hitter, def, BtouchRole, contact);

    // height & reach duel: spike reach vs the best block reach in front of the hitter
    var topBlock = n ? Bs.reduce(function (m, b) { return b.blockReach > m.blockReach ? b : m; }) : null;
    var reachDiff = n ? A.spikeReach - topBlock.blockReach + ps(A, "high_point") * 4 + (st.pipe ? ps(A, "pipe") * 5 : 0) : 0;
    if (plan.jump != null) reachDiff += (plan.jump - 0.6) * 25;           // a late or early jump costs reach
    if (n && Math.abs(reachDiff) >= 12 && Math.random() < 0.45) {
      feed(-1, reachDiff > 0 ? A.name + " (" + A.spikeReach + "cm reach) is hitting over the block!"
                             : topBlock.name + "'s " + topBlock.blockReach + "cm block towers over " + A.name + "...");
    }

    // 1) attack error
    var errP = (plan.jump != null ? (plan.jump < 0.35 ? 0.07 : plan.jump >= 1 ? -0.02 : 0) : 0) + 0.05 + (1 - setQ) * 0.08 + st.tempo * 0.02 - A.att / 1200 + (type === "wipe" ? 0.05 : 0) - (type === "tip" ? 0.03 : 0) +
               (type !== "tip" && target && Math.abs(target.x - st.x) > 150 && Math.abs(target.y - NET) < 110 ? 0.05 : 0);   // sharp angles miss more
    if (Math.random() < errP) {
      A.st.ae++;
      if (pin && dir === "line" && Math.random() < 0.35) {
        var ant = { x: st.x < W / 2 ? CL : CR, y: NET };
        await flyBall(contact, ant, 200, { h0: 1.4, h1: 1.2 });
        netShake();
        await flyBall(ant, { x: ant.x + (st.x < W / 2 ? -30 : 30), y: NET + dirA * 40 }, 300, { h0: 1.2, h1: 0 });
        msg("OFF THE ANTENNA!"); feed(atk.side, "and " + A.name + " clips the antenna — error!");
      } else if (Math.random() < 0.4) {
        var np = { x: contact.x, y: NET + dirA * 6 };
        await flyBall(contact, np, 200, { h0: 1.4, h1: 0.6 });
        netShake();
        await flyBall(np, { x: np.x, y: NET + dirA * 30 }, 250, { h0: 0.6, h1: 0 });
        msg("INTO THE NET!"); feed(atk.side, "and " + A.name + " hits it into the net!");
      } else {
        var outPt = { x: clamp(target.x + rnd(-40, 40), CL - 30, CR + 30), y: def.side === 0 ? CB + 26 : CT - 26 };
        await flyBall(contact, outPt, 380, { h0: 1.4, h1: 0 });
        msg("OUT!"); feed(atk.side, "and " + A.name + " sends " + shot + "... OUT!");
      }
      return credit(def);
    }

    // 2) where does the ball cross the net relative to the blockers' hands?
    var geo = { zone: "clear" }, cx = crossX(contact, target);
    if (n && type === "spike") {
      reactBlock(def, blockers, cx, st.tempo);
      geo = blockZone(handSpans(def, blockers), cx);
      if (geo.r) {
        BtouchRole = def.superBlocker && geo.zone === "in" ? def.superBlocker : geo.r;
        Btouch = def.roster[BtouchRole];
      }
      blockPt = { x: clamp(cx, CL - 10, CR + 10), y: blockPt.y };
    }
    var seam = geo.zone === "seam";

    // 3) does the block get a hand on it? Into the hands: likely. Edge: maybe. Seam/clear: rarely.
    var pTouch = 0, stuffAdj = 0;
    if (n && type === "spike") {
      var depth = clamp01(Math.abs(target.y - NET) / 270);
      var common = (0.62 + blkAvg / 280) * clamp(1 - reachDiff / 110, 0.5, 1.45) * (superSpike ? 0.6 : 1) *
                   (1 - 0.25 * depth * clamp01((reachDiff + 15) / 30));         // deep swings clear a short block
      pTouch = geo.zone === "in" ? 0.82 * common + (superBlock ? 0.3 : 0)
             : geo.zone === "edge" ? 0.5 * common + (superBlock ? 0.25 : 0)
             : geo.zone === "seam" ? 0.14 : 0.04;
      stuffAdj = clamp(-reachDiff / 250, -0.15, 0.15);
    }
    if (n && type === "spike") { if (st.tempo < 0.6) pTouch *= 1 - ps(A, "quick_strike") * 0.12; if (st.pipe) pTouch *= 1 - ps(A, "pipe") * 0.08; }
    if (n && type === "tip") pTouch = 0.1;
    if (n && type === "wipe") pTouch = 0.95;
    if (Math.random() < clamp(pTouch, 0, 0.92)) {
      await flyBall(contact, blockPt, 170, { h0: 1.4, h1: 0.6 });
      netShake();
      var r = Math.random(), outcome;
      if (type === "wipe") {
        var wipeP = clamp(0.3 + A.att / 400 - blkAvg / 700 + (pin ? 0.12 : -0.12) + reachDiff / 300, 0.12, 0.72);
        outcome = r < wipeP ? "tool" : r < wipeP + 0.3 ? "stuff" : "soft";
      } else if (type === "tip") outcome = "soft";
      else {
        var zone = geo.zone;
        var stuffP = zone === "in" ? clamp(0.19 + (blkAvg - A.att) / 250 + (n - 1) * 0.04 + (superBlock ? 0.3 : 0) - (superSpike ? 0.2 : 0) + stuffAdj + ps(Btouch, "stuff_block") * 0.06, 0.05, 0.75)
                   : zone === "edge" ? 0.07 : 0.03;
        var toolP = (quickMB ? 0.04 : pin ? 0.16 : 0.08) +
                    (A.att - blkAvg) / 400 +
                    clamp(reachDiff / 250, -0.06, 0.08) +           // hitting off high hands
                    (n === 1 ? 0.03 : 0) - (readRight ? 0.04 : 0);
        toolP = clamp(toolP, 0.03, 0.34);
        if (zone === "edge") toolP = (geo.outside ? clamp(toolP + 0.22, 0.25, 0.5) : toolP + 0.03) + ps(A, "tool_master") * 0.07;   // off the outside hand
        else if (zone !== "in") toolP = 0.12;
        var offP = zone === "in" ? 0.07 : 0.14, rebP = zone === "in" ? 0.08 : 0.03;
        outcome = r < stuffP ? "stuff" : r < stuffP + toolP ? "tool" : r < stuffP + toolP + offP ? "offblock" :
                  r < stuffP + toolP + offP + rebP ? "rebound" : "soft";
      }
      var who = Btouch.name + (superBlock ? " ★" : "");
      if (outcome !== "stuff" && outcome !== "tool") blockers.forEach(function (r) { jump(def, r, 260, 3, "block"); });   // hands flinch on the touch
      if (outcome === "stuff") {
        blockers.forEach(function (r) { jump(def, r, 300, 8, "press"); });
        ring(blockPt, "#ff6fb0", 40, 0.4); puff(blockPt, 10, "#ffd1e6");
        var land = { x: bx + rnd(-25, 25), y: NET + dirA * rnd(25, 70) };
        await flyBall(blockPt, land, 260, { h0: 0.6, h1: 0, trail: "hot" });
        puff(land, 12, "#ffd21e"); ring(land, "#ffd21e", 24, 0.35);
        if (Math.random() < 0.35) jump(atk, hitter, 900, -2, "fall", -1);           // the hitter lands on their seat
        setTimeout(function () { blockers.forEach(function (r) { jump(def, r, 700, 5, "cheer"); }); }, 320);
        if (Math.random() < 0.5) setTimeout(function () { popup(pick(["ROOF!", "GET THAT OUT!", "DENIED!"]), def.pos[BtouchRole] || blockPt, "#ff6fb0"); }, 400);
        A.st.bk++; Btouch.st.blk++;
        shake(7); hitStop(110);
        popup("STUFF BLOCK!", blockPt, "#ff6fb0");
        msg((n === 3 ? "TRIPLE " : n === 2 ? "DOUBLE " : "") + "BLOCK — STUFFED!!"); cheer();
        feed(def.side, who + " STUFFS " + A.name + "!" + (readRight ? " Read it all the way." : "") + (n > 1 ? " (" + BLOCK_TXT[n].toLowerCase() + ")" : ""), true);
        return credit(def, BtouchRole);
      }
      if (outcome === "tool") {
        var outside = type === "wipe" || Math.random() < (pin ? 0.7 : 0.3);
        var toolPt = outside ? { x: st.x < W / 2 ? CL - 28 : CR + 28, y: NET + dirD * rnd(70, 220) }
                             : { x: clamp(bx + rnd(-60, 60), CL - 20, CR + 20), y: def.side === 0 ? CB + 30 : CT - 30 };
        if (type === "wipe") puff(blockPt, 10, "#fff3b0");
        ring(blockPt, "#ffd21e", 30, 0.35);
        jump(def, BtouchRole, 500, 2, "shank");                                     // the blocker spins round to watch it go
        await flyBall(blockPt, toolPt, outside ? 420 : 520, { h0: 0.6, h1: 0, peak: outside ? 0.5 : 1.2, spin: 20, trail: "fast" });
        refFlagSide = atk.side; refFlagAt = performance.now(); emit({ k: "ref", s: refFlagSide });                      // the line judge signals the touch
        popup("TOUCH — OUT!", toolPt, "#ffffff");
        A.st.k++; assist(atk, setterRole, hitter);
        msg(type === "wipe" ? "WIPED OFF THE BLOCK!" : "TOOLED!"); cheer();
        popup(type === "wipe" ? "WIPED!" : "TOOLED!", blockPt, "#ffd21e");
        feed(atk.side, "and " + A.name + (type === "wipe" ? " WIPES it off " + Btouch.name + "'s hands — out!"
                       : outside ? " TOOLS it off " + Btouch.name + "'s outside hand — out!"
                       : " TOOLS it off " + Btouch.name + "'s fingertips into the stands!"), true);
        return credit(atk, hitter);
      }
      if (outcome === "offblock") {
        var deep = { x: clamp(target.x + rnd(-30, 30), CL + 10, CR - 10), y: NET + dirD * rnd(150, 250) };
        await flyBall(blockPt, deep, 300, { h0: 0.6, h1: 0 });
        A.st.k++; assist(atk, setterRole, hitter);
        msg("OFF THE BLOCK — KILL!"); cheer();
        feed(atk.side, "and " + A.name + " hits it off the block — nobody can reach it!", true);
        return credit(atk, hitter);
      }
      if (outcome === "rebound") {
        var coverPt = clampHalf(atk, { x: bx + rnd(-50, 50), y: NET + dirA * rnd(80, 140) });
        var coverer = nearest(atk, coverPt, atk.onCourt.filter(function (x) { return x !== hitter; })).pos;
        moveTo(atk, coverer, coverPt); atk.rush[coverer] = true;
        msg("BLOCKED BACK — COVER!");
        feed(def.side, who + " blocks it back...");
        await flyBall(blockPt, coverPt, 520, { h0: 0.6, h1: 0.1, peak: 0.9 });
        jump(atk, coverer, 500, -5, "dig");
        if (Math.random() < 0.25) {
          A.st.bk++; Btouch.st.blk++;
          feed(atk.side, "...nobody covers. Block point!", true); cheer();
          return credit(def, BtouchRole);
        }
        feed(atk.side, atk.roster[coverer].name + " covers the block! Play on.");
        var sr = await toSetter(atk, coverPt, 1, coverer);
        return await offense(atk, 1, sr);
      }
      var waterfall = Math.random() < 0.3;
      ring(blockPt, "#7fd8ff", 22, 0.3);
      var caller = def.pos.L ? "L" : def.onCourt.find(function (r) { return blockers.indexOf(r) < 0; });
      if (caller && def.pos[caller]) popup("TOUCH!", def.pos[caller], "#7fd8ff");
      var pop = waterfall ? clampHalf(def, { x: bx + rnd(-20, 20), y: NET + dirD * rnd(16, 34) })
                          : clampHalf(def, { x: bx + rnd(-70, 70), y: NET + dirD * rnd(100, 170) });
      msg(waterfall ? "WATERFALL OFF THE BLOCK!" : "ONE TOUCH!");
      popup(waterfall ? "WATERFALL!" : "ONE TOUCH!", blockPt, "#7fd8ff");
      feed(def.side, waterfall ? "It dribbles off " + who + "'s fingers and trickles down the net — WATERFALL!"
                               : "ONE TOUCH by " + who + " — " + (def === me ? "we" : "they") + " can play it!");
      return await defensePlay(def, atk, blockPt, pop, { soft: true, waterfall: waterfall, A: A, hitterRole: hitter, setterRole: setterRole, setQ: setQ, st: st, h0: 0.6 });
    }

    // 4) past the block
    if (seam) feed(-1, A.name + " goes right through the seam of the block!");
    else if (n && type === "spike" && geo.zone === "clear") feed(-1, A.name + " hits around the block.");
    return await defensePlay(def, atk, contact, target, {
      type: type, A: A, hitterRole: hitter, setterRole: setterRole, setQ: setQ, st: st, superSpike: superSpike, readWrong: readWrong, seam: seam, h0: 1.4
    });
  }

  async function defensePlay(def, atk, from, to, o) {
    var excl = def.blockers || [];
    var cand = def.onCourt.filter(function (r) { return excl.indexOf(r) < 0 || o.soft; });
    var gap = gapScore(def, to);
    var digRole = nearest(def, to, cand).pos, D = def.roster[digRole];
    var controlled = def === me && iControl(digRole);
    var startDist = dist(def.pos[digRole], to), diveDir = Math.sign(to.x - def.pos[digRole].x) || 1;
    var noTouch = !o.soft && o.type === "spike" && !controlled && gap > 0.5 && Math.random() < 0.4;
    var diving = !noTouch && !o.soft && startDist > 70 + ((D.spd || 70) - 70) * 1.2;          // quick defenders reach it on their feet
    if (!noTouch) { moveTo(def, digRole, to); if (diving) def.rush[digRole] = true; }
    var ms = o.soft ? (o.waterfall ? 600 : 700) : o.type === "tip" ? 650 : 380 - o.st.tempo * 40;
    var fo = o.soft ? (o.waterfall ? { h0: 0.6, h1: 0, peak: 0.2 } : { h0: o.h0, h1: 0, peak: 1.1 })
           : o.type === "tip" ? { h0: 1.2, h1: 0, peak: 0.6 } : { h0: o.h0, h1: 0, spin: o.superSpike ? 30 : 16 };
    var flight = flyBall(from, to, ms, fo);
    var timing;
    if (controlled) {
      await sleep(60); slow();
      timing = await timingBar((o.soft ? "PLAY THE TOUCH — " : o.type === "tip" ? "CHASE THE TIP — " : "DIG — ") + D.name + " vs " + o.A.name + " (ATT " + o.A.att + ")!",
                               duelSpeed(o.A.att, D.def, o.superSpike || o.A.flow) * (o.soft ? 1.25 : o.type === "tip" ? 1.1 : 0.9),
                               0.26 + (D.def - o.A.att) / 250 - (o.superSpike ? 0.07 : 0) - (o.type === "spike" ? (1 - o.st.tempo) * 0.05 : 0) +
                               (o.soft ? 0.08 : 0) + (o.type === "tip" ? 0.05 - ps(o.A, "feint") * 0.04 : 0) + ps(D, "acrobat") * 0.035 + clutchAdj(D), digRole);
      fast();
    } else timing = autoTiming(D.def + ps(D, "acrobat") * 6 - (o.type === "tip" ? ps(o.A, "feint") * 8 : 0));
    await flight;

    async function killed(text, txtMsg) {
      if (!o.soft && nearLine(to) && Math.random() < 0.4) {
        banner("VIDEO CHALLENGE", def.team.name + " say it was out...", "#7fd8ff", 1.5);
        feed(def.side, "📺 " + def.team.name + " challenge the call — it was right on the line...", true);
        await rest(1500);
        if (Math.random() < 0.35) {
          banner("OUT!", "Call overturned — point " + def.team.name, "#ff4d6d", 1.5);
          o.A.st.ae++; feed(def.side, "...OUT by a fingernail! The call is overturned!", true); cheer();
          return credit(def);
        }
        banner("IN!", "The call stands — point " + atk.team.name, "#3dff7a", 1.3);
        feed(atk.side, "...IN! The line was touched. Point stands.");
      }
      o.A.st.k++; assist(atk, o.setterRole, o.hitterRole);
      shake(o.superSpike ? 9 : o.soft || o.type === "tip" ? 2 : 4); ring(to, o.superSpike ? "#ff7a2a" : "#ffd21e", o.superSpike ? 46 : 30, 0.4);
      if (o.superSpike) hitStop(120);
      msg(txtMsg); cheer();
      popup(txtMsg.replace(/!+$/, "!"), to, "#ffd21e");
      feed(atk.side, text, true);
      return credit(atk, o.hitterRole);
    }
    if (noTouch) {
      await bounce(from, to);
      return killed("and " + o.A.name + (o.superSpike ? " ★ ROCKETS " : " rockets ") + shotName(o.st.x, to) + " — NO TOUCH!", "NO TOUCH!");
    }
    if (diving) jump(def, digRole, 620, -2, "dive", diveDir);
    else jump(def, digRole, 500, o.soft ? -3 : -5, o.soft ? "pass" : "dig");
    var superDig = ready(D, "dig") && (def !== me || controlled || Math.random() < 0.7);
    if (superDig) useSkill(def, D);

    var killP;
    if (o.soft) killP = o.waterfall ? 0.3 : 0.12;
    else if (o.type === "tip") killP = clamp01(0.12 + gap * 0.55 - D.def / 600 + (o.dump ? 0.15 : 0));
    else killP = clamp01(0.3 + o.A.att / 280 + o.setQ * 0.15 + gap * 0.3 - D.def / 380 + (o.superSpike ? 0.28 : 0) +
                         (o.readWrong ? 0.08 * o.st.tempo : 0) + (o.seam ? 0.08 : 0) + (diving ? 0.08 : 0));
    if (superDig) killP -= 0.35;
    killP -= sty(def).defense;
    killP += edge(atk) * 0.9 + mom[atk.side];                     // class and momentum
    killP -= ((D.spd || 70) - 70) / 400 * clamp01(startDist / 120); // speed covers ground
    if (controlled) killP *= (1.45 - timing * 0.9);
    if (Math.random() < clamp01(killP)) {
      if (!o.soft && o.type !== "tip") await bounce(from, to);
      return killed(
        o.soft ? "...and it drops between them!" :
        o.dump ? "and " + o.A.name + " drops it in the open court!! ★" :
        o.type === "tip" ? "and " + o.A.name + " TIPS it into the open court!" :
        "and " + o.A.name + (o.superSpike ? " ★ CRUSHES " : " scores ") + shotName(o.st.x, to) +
        (o.seam ? " — SPLITS THE SEAM!!" : o.readWrong ? " — the block bit on the wrong side!!" : "!!"),
        o.soft ? "IT DROPS!" : o.type === "tip" ? (o.dump ? "DUMP KILL!" : "TIP KILL!") : "KILL!!");
    }
    if (Math.random() < SHANK_P * techShank(D)) {
      var how = await shankFx(def, digRole, to);
      o.A.st.k++; assist(atk, o.setterRole, o.hitterRole);
      msg("SHANKED!"); feed(def.side, D.name + " shanks it " + how);
      return credit(atk, o.hitterRole);
    }
    var dq = clamp01(timing * 0.72 + D.def / 320 - 0.12 + edge(def) * 0.5 + mom[def.side] * 0.5 + sty(def).defense + (superDig ? 0.3 : 0) + (o.soft ? 0.2 : 0) + (o.type === "tip" ? 0.15 : 0) - (diving ? 0.1 : 0));
    var dg = passGrade(dq);
    if (dg < 0) {
      o.A.st.k++; assist(atk, o.setterRole, o.hitterRole);
      msg("NO CONTROL!"); feed(def.side, D.name + " gets a hand on it but can't control it.");
      return credit(atk, o.hitterRole);
    }
    D.st.dig++; rallyDigs++;
    var digTxt = diving ? pick(["DOLPHIN DIVE SAVE", "PANCAKE SAVE", "FULL-STRETCH DIVE"]) + " by " + D.name + "!" :
                 D.name + " digs " + (o.soft ? "the touch" : o.type === "tip" ? "the tip" : shotName(o.st.x, to)) + "!";
    if (diving) msg(digTxt.split(" by")[0] + "!");
    feed(def.side, digTxt + " Transition...", diving);
    var g2 = Math.min(dg, 1);
    if (g2 === 0 && Math.random() < 0.3) return await freeBall(def, to);
    var sr = await toSetter(def, to, g2, digRole);
    return await offense(def, g2, sr);
  }

  // no way to attack: send an easy ball over; the other side gets a perfect pass
  async function freeBall(s, from) {
    var o2 = other(s), dirO = o2.side === 0 ? 1 : -1;
    feed(s.side, "No attack possible — free ball over.");
    msg("FREE BALL!");
    var land = clampHalf(o2, { x: rnd(CL + 60, CR - 60), y: NET + dirO * rnd(150, 230) });
    var ps = passersOf(o2), who = nearest(o2, land, ps.length ? ps : null).pos;
    setTargets(s, baseFormation(s));
    moveTo(o2, who, land);
    await flyBall(from, land, 1000, { peak: 1.6 });
    jump(o2, who, 500, -3, "pass");
    o2.roster[who].st.rc++; o2.roster[who].st.rp++;
    feed(o2.side, o2.roster[who].name + " passes the free ball — perfect.");
    var sr = await toSetter(o2, land, 2, who);
    return await offense(o2, 2, sr);
  }

  // ================== MATCH SHELL ==================
  function updateHud() {
    $("sMe").textContent = score[0]; $("sOpp").textContent = score[1];
    var sets = setNeed > 1;
    $("serveMe").textContent = (serving === 0 ? "● SERVING — " : "") + (me ? "ROT " + (me.rot + 1) : "") + (sets ? " • SETS " + setsWon[0] : "");
    $("serveOpp").textContent = (sets ? "SETS " + setsWon[1] + " • " : "") + (opp ? "ROT " + (opp.rot + 1) : "") + (serving === 1 ? " — SERVING ●" : "");
  }

  function rosterTable(s) {
    var h = "<table class='roster'><tr><th>" + U.esc((s.team.flag || "") + " " + s.team.name) +
      "</th><th>HT</th><th>VERT</th><th>REACH</th><th>SRV</th><th>REC</th><th>SET</th><th>ATT</th><th>BLK</th><th>DEF</th><th>MEN</th><th>TEC</th><th>SPD</th></tr>";
    ROLES.forEach(function (role) {
      var r = s.roster[role];
      h += "<tr><td><img src='" + r.sprite.toDataURL() + "' alt=''/>" + role + " " + U.esc(r.name) +
        (r.skill ? " <span class='star'>★" + skillLabel(r) + "</span>" : "") +
        "</td><td>" + r.height + "</td><td>" + r.vert + "</td><td>" + r.spikeReach + "/" + r.blockReach + "</td><td>" + r.srv + "</td><td>" + r.rec + "</td><td>" + r.set +
        "</td><td>" + r.att + "</td><td>" + r.blk + "</td><td>" + r.def + "</td><td>" + r.men + "</td><td>" + r.tec + "</td><td>" + r.spd + "</td></tr>";
    });
    return h + "</table>";
  }

  // ---- live stats panel (pauses the match while open) ----
  var statsTab = "sheet";
  function renderStats() {
    var body = $("statsBody");
    document.querySelectorAll("#statsPanel [data-st]").forEach(function (b) { b.classList.toggle("on", b.getAttribute("data-st") === statsTab); });
    if (statsTab === "sheet") {
      body.innerHTML = "<p class='center'>" + U.esc((me.team.flag || "") + " " + me.team.name + "  " + score[0] + " : " + score[1] + "  " + opp.team.name + " " + (opp.team.flag || "")) + "</p>" +
        VB.Stats.sheetHTML((me.team.flag || "") + " " + me.team.name, ROLES.map(function (r) { return lineFor(me, r); })) +
        VB.Stats.sheetHTML((opp.team.flag || "") + " " + opp.team.name, ROLES.map(function (r) { return lineFor(opp, r); }));
    } else {
      body.innerHTML = rosterTable(me) + rosterTable(opp);
    }
  }
  function renderTac() {
    var h = "<p class='muted'>Your team's game plan. It's saved for every match.</p>";
    [["block", "BLOCK STYLE", "READ: react to the set (strong vs high balls, late on quicks). GUESS: commit early — a wall if right, beaten if wrong."],
     ["lean", "BLOCK STRATEGY", "Take line and let the defence cover cross, or take cross and leave the line open."],
     ["call", "ONE-PLAYER: SETTER & YOU", "Ask at every pass, have the setter feed you automatically, or never ask."],
     ["rot", "ROTATION SYSTEM", "5-1: one setter. 4-2: the front-row setter sets — when your setter is back row, the opposite sets."]].forEach(function (g2) {
      h += "<h3 class='mini'>" + g2[1] + "</h3><div class='focus'>" + TAC_OPTS[g2[0]].map(function (o) {
        return "<button class='btn" + (TAC[g2[0]] === o[0] ? " on" : "") + "' data-tac='" + g2[0] + "' data-v='" + o[0] + "'>" + o[1] + "</button>";
      }).join("") + "</div><p class='muted small'>" + g2[2] + "</p>";
    });
    $("tacBody").innerHTML = h;
  }
  function openTac() { setPaused(true); renderTac(); $("tacPanel").classList.remove("hidden"); }
  function closeTac() {
    $("tacPanel").classList.add("hidden");
    if ($("statsPanel").classList.contains("hidden")) setPaused(false);
    if (me) feed(0, "Tactics: " + tacName("block") + " • " + tacName("lean") + " • " + tacName("rot") + (mode === "role" ? " • " + tacName("call") : ""));
  }

  function openStats() {
    if (!me || !opp) return;
    setPaused(true);
    renderStats();
    $("statsPanel").classList.remove("hidden");
  }
  function closeStats() {
    $("statsPanel").classList.add("hidden");
    setPaused(false);
  }

  function lineFor(s, role) {
    var Pl = s.roster[role];
    return Object.assign({ name: Pl.name, role: role, you: s === me && mode === "role" && role === myRole, mate: s === me && role === mateRole }, Pl.st);
  }

  // cfg: { mine, foe, homeSide (0 = mine), mode, myRole, label, league, setsTo }
  // play it, or quick-sim it (a little worse without you calling the shots: ~5-10% lower win chance)
  async function quickSim(c) {
    var mine = Object.assign({}, c.mine), bo = c.bestOf || 1;
    mine.ovr = VB.Stats.teamOvr(c.mine) - (bo > 1 ? 0.8 : 1.2);
    var s = VB.Stats.simSets(mine, c.foe, bo), won = s.a > s.b;
    var coins = VB.Gacha ? VB.Gacha.earn(won ? 1000 : 500) : 0;
    var top = Object.keys(s.stats).filter(function (id) { return VB.ROLES.some(function (r) { return c.mine.lineup[r] && c.mine.lineup[r].id === id; }); })
      .sort(function (a, b) { return VB.Stats.pts(s.stats[b]) - VB.Stats.pts(s.stats[a]); }).slice(0, 3);
    await U.modal(won ? "QUICK SIM — WIN" : "QUICK SIM — LOSS",
      "<p class='center big'>" + U.esc(c.mine.name + " " + s.a + " : " + s.b + " " + c.foe.name) + "</p>" +
      (bo > 1 ? "<p class='center muted'>SETS " + s.sets.map(function (x) { return x[0] + "-" + x[1]; }).join(", ") + "</p>" : "") +
      "<p class='center'>TOP SCORERS: " + top.map(function (id) { return U.esc(s.stats[id].name) + " " + VB.Stats.pts(s.stats[id]); }).join(" • ") + "</p>" +
      (coins ? "<p class='center'>+" + coins + " 🏐 COINS</p>" : ""), [{ label: "CONTINUE", value: 1 }]);
    return { score: [s.a, s.b], sets: s.sets, won: won, stats: s.stats, flows: [], coins: coins, simmed: true };
  }

  async function playMatch(c) {
    try { var ck = localStorage.getItem("retroVB.cam"); if (ck && VB.CAMS[ck]) CAM = ck; } catch (e) {}
    camUI();
    try { Object.assign(TAC, JSON.parse(localStorage.getItem("retroVB.tactics") || "{}")); } catch (e) {}
    if (!c.noSimChoice) {
      for (;;) {
        var how = await U.modal("MATCH DAY", "<p class='center big'>" + U.esc(c.mine.name + " vs " + c.foe.name) + "</p><p class='center'>" + U.esc(c.label || "") + "</p>" +
          "<p class='center muted'>⏩ QUICK SIM plays it out instantly — but without you calling the shots your team is a little worse (about 5-10% lower win chance).</p>" +
          "<p class='center muted'>🎥 Camera: <b>" + U.esc(VB.CAMS[CAM]) + "</b> — switch it here, with the 🎥 button above the court, or the C key mid-match.</p>",
          [{ label: "▶ PLAY MATCH", value: "play" }, { label: "⏩ QUICK SIM", value: "sim", cls: "pink" }, { label: "🎥 " + CAM_SHORT[CAM] + " ▸", value: "cam" }]);
        if (how === "cam") { var ks = Object.keys(VB.CAMS); setCam(ks[(ks.indexOf(CAM) + 1) % ks.length]); continue; }
        if (how === "sim") return await quickSim(c);
        break;
      }
    }
    cfg = c;
    mode = c.mode || "full"; myRole = c.myRole || null; mateRole = c.mateRole || null;
    var mineKit = c.mine.kit, foeKit = kitClash(c.mine.kit, c.foe.kit) ? (c.foe.kit2 && !kitClash(c.mine.kit, c.foe.kit2) ? c.foe.kit2 : "#f5f5f5") : c.foe.kit;
    var myLib = pickLiberoKit(mineKit, [foeKit]), oppLib = pickLiberoKit(foeKit, [mineKit, myLib]);
    c.mine.ovr = VB.Stats.teamOvr(c.mine); c.foe.ovr = VB.Stats.teamOvr(c.foe);
    me = makeSide(c.mine, 0, mineKit, myLib);
    opp = makeSide(c.foe, 1, foeKit, oppLib);
    var home = c.homeSide === 1 ? c.foe : c.mine, away = c.homeSide === 1 ? c.mine : c.foe;
    homeIdx = c.homeSide === 1 ? 1 : 0; chant = null;
    curFloor = pickFloor(c);
    buildArena(home, away, c.league || "VNL", curFloor);
    spectating = false;
    if (VB.Engine.onStart) VB.Engine.onStart();                       // co-op: tell the guest a match is starting
    flowLog = []; flames = []; ball.visible = false;
    U.clearFeed();
    $("hudMe").textContent = (c.mine.flag || "") + " " + c.mine.name;
    $("hudOpp").textContent = c.foe.name + " " + (c.foe.flag || "");
    $("stageLine").textContent = c.label + (mode === "role" ? " • YOU ARE " + me.roster[myRole].name + " (" + VB.FAMILY_NAMES[VB.FAMILY[myRole]] + ")" : " • FULL TEAM") +
      " • " + (c.homeSide === 1 ? "AWAY AT " + (c.foe.short || c.foe.name) : "HOME");
    function starList(s) {
      return ROLES.filter(function (r) { return s.roster[r].skill; }).map(function (r) { return s.roster[r].name + " (" + skillLabel(s.roster[r]) + ")"; }).join(", ") || "none";
    }
    function tallest(s) { return ROLES.map(function (r) { return s.roster[r]; }).sort(function (a, b) { return b.height - a.height; })[0]; }
    feed(-1, "— " + c.mine.name + " vs " + c.foe.name + " —");
    feed(-1, "Styles: " + c.mine.name + " " + sty(me).name + " • " + c.foe.name + " " + sty(opp).name);
    feed(0, "Your tactics: " + tacName("block") + " • " + tacName("lean") + " • " + tacName("rot") + (mode === "role" ? " • " + tacName("call") : "") + " (🧠 TACTICS to change)");
    feed(0, "Stars: " + starList(me) + ". Libero: " + me.roster.L.name + ". Tallest: " + tallest(me).name + " " + tallest(me).height + "cm.");
    feed(1, "Stars: " + starList(opp) + ". Libero: " + opp.roster.L.name + ". Tallest: " + tallest(opp).name + " " + tallest(opp).height + "cm.");

    score = [0, 0]; serving = Math.random() < 0.5 ? 0 : 1;
    me.rot = 0; opp.rot = 0;
    updateHud();
    var to = c.setsTo || 15;
    setNeed = Math.ceil((c.bestOf || 1) / 2); setsWon = [0, 0]; setLog = [];
    pow = [c.mine.ovr, c.foe.ovr]; resetDrama(); drama = null;
    if (setNeed > 1) feed(-1, "BEST OF " + (setNeed * 2 - 1) + " SETS — first to " + setNeed + ".");
    while (setsWon[0] < setNeed && setsWon[1] < setNeed) {
      if (setLog.length) { score = [0, 0]; resetDrama(); updateHud(); feed(-1, "— SET " + (setLog.length + 1) + " —"); msg("SET " + (setLog.length + 1) + " — SWITCH ON!"); await rest(900); }
      while (!(Math.max(score[0], score[1]) >= to && Math.abs(score[0] - score[1]) >= 2)) await rally();
      var sw = score[0] > score[1] ? 0 : 1;
      setsWon[sw]++; setLog.push(score.slice());
      if (setsWon[0] < setNeed && setsWon[1] < setNeed) {
        feed(sw, (sw === 0 ? c.mine.name : c.foe.name) + " take set " + setLog.length + ", " + score[sw] + "-" + score[1 - sw] + "!", true);
        cheer(); startWave(); updateHud(); await rest(1500);
        serving = 1 - serving;
      }
    }
    var won = setsWon[0] > setsWon[1];
    var finalScore = setNeed > 1 ? setsWon.slice() : score.slice();
    var coins = VB.Gacha ? VB.Gacha.earn(won ? 1000 : 500) : 0;                 // a win = 10 pulls, a loss = 5
    ball.visible = false;

    var stats = {};
    [me, opp].forEach(function (s) {
      ROLES.forEach(function (r) { stats[s.roster[r].ref.id] = Object.assign({ name: s.roster[r].name, role: r }, s.roster[r].st); });
    });
    $("endTitle").textContent = won ? "MATCH WON!" : "MATCH LOST";
    $("endScore").textContent = finalScore[0] + " : " + finalScore[1];
    $("endNote").textContent = c.mine.name + " vs " + c.foe.name + " — " + c.label +
      (setNeed > 1 ? " • SETS " + setLog.map(function (x) { return x[0] + "-" + x[1]; }).join(", ") : "") + (coins ? " • +" + coins + " 🏐 COINS" : "");
    $("endSheet").innerHTML =
      VB.Stats.sheetHTML((c.mine.flag || "") + " " + c.mine.name, ROLES.map(function (r) { return lineFor(me, r); })) +
      VB.Stats.sheetHTML((c.foe.flag || "") + " " + c.foe.name, ROLES.map(function (r) { return lineFor(opp, r); }));
    await new Promise(function (res) {
      $("endScreen").classList.remove("hidden");
      $("contBtn").onclick = function () { $("endScreen").classList.add("hidden"); res(); };
    });
    return { score: finalScore, sets: setLog.slice(), won: won, stats: stats, flows: flowLog.slice(), coins: coins };
  }

  function init() {
    cv = $("court"); g = cv.getContext("2d");
    g.imageSmoothingEnabled = false;
    $("rosterBtn").addEventListener("click", openStats);
    $("tacBtn").addEventListener("click", openTac);
    $("camBtn").addEventListener("click", cycleCam);
    $("camTop").addEventListener("click", cycleCam);
    function sndUI() { var b = $("sndTop"); if (b && VB.Sfx) b.textContent = VB.Sfx.on() ? "🔊" : "🔇"; }
    if ($("sndTop")) { sndUI(); $("sndTop").addEventListener("click", function () { VB.Sfx && VB.Sfx.toggle(); sndUI(); }); }
    window.addEventListener("keydown", function (e) { if ((e.key === "m" || e.key === "M") && !/INPUT|TEXTAREA/.test((e.target || {}).tagName || "") && VB.Sfx) { VB.Sfx.toggle(); sndUI(); } });
    document.addEventListener("keydown", function (e) {             // C switches the camera any time during a match
      if (e.code !== "KeyC" || e.repeat || $("matchView").classList.contains("hidden") || !$("modal").classList.contains("hidden")) return;
      if (e.target && /INPUT|TEXTAREA/.test(e.target.tagName)) return;
      cycleCam();
    });
    camUI();
    $("tacClose").addEventListener("click", closeTac);
    $("tacPanel").addEventListener("click", function (e) {
      var b = e.target.closest("[data-tac]");
      if (b) { TAC[b.getAttribute("data-tac")] = b.getAttribute("data-v"); saveTac(); renderTac(); }
    });
    $("backBtn").addEventListener("click", async function () {
      var wasPaused = paused; setPaused(true);
      var ok = await U.modal("BACK TO MAIN MENU?", "<p>Leave this match and go back to the main menu?</p>" +
        "<p class='muted'>Tournaments, story mode and career are saved up to your last finished match — this match won't count.</p>",
        [{ label: "YES, MAIN MENU", value: true, cls: "pink" }, { label: "KEEP PLAYING", value: false }]);
      if (ok) { location.reload(); return; }
      if (!wasPaused) setPaused(false);
    });
    $("statsClose").addEventListener("click", closeStats);
    $("statsPanel").addEventListener("click", function (e) {
      var t = e.target.closest("[data-st]");
      if (t) { statsTab = t.getAttribute("data-st"); renderStats(); }
      else if (e.target.id === "statsPanel") closeStats();
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && !$("statsPanel").classList.contains("hidden")) closeStats();
    });
    lastFrame = performance.now();
    requestAnimationFrame(draw);
  }

  // ---------- co-op: host snapshots / guest spectator ----------
  function r1(v) { return Math.round(v * 10) / 10; }
  function matchInit() {
    var c = cfg;
    return { mine: c.mine, foe: c.foe, homeSide: c.homeSide, league: c.league, floor: curFloor, label: c.label, myRole: myRole, mateRole: mateRole,
             setsTo: c.setsTo, bestOf: c.bestOf, stage: $("stageLine").textContent,
             nums: [me, opp].map(function (sd) { var o = {}; ROLES.forEach(function (r) { o[r] = sd.roster[r].num; }); return o; }) };
  }
  function snapshot() {
    var q = evq || []; evq = [];
    function side(sd) {
      var o = {};
      Object.keys(sd.pos).forEach(function (r) { var p = sd.pos[r], t = sd.tgt[r] || p; o[r] = [r1(p.x), r1(p.y), r1(t.x), r1(t.y), sd.rush[r] ? 1 : 0, sd.roster[r].flow ? 1 : 0, sd.roster[r].cd || 0]; });
      return o;
    }
    return { s: [side(me), side(opp)], sc: score.slice(), sw: setsWon.slice(), sv: serving, ts: timeScale, bv: ball.visible ? 1 : 0, tr: ball.trail || 0, rot: [me.rot, opp.rot], ev: q };
  }
  function spectate(c) {
    try { var ck = localStorage.getItem("retroVB.cam"); if (ck && VB.CAMS[ck]) CAM = ck; } catch (e) {}
    camUI();
    cfg = c; mode = "role"; myRole = c.myRole; mateRole = c.mateRole; spectating = true;
    var mineKit = c.mine.kit, foeKit = kitClash(c.mine.kit, c.foe.kit) ? (c.foe.kit2 && !kitClash(c.mine.kit, c.foe.kit2) ? c.foe.kit2 : "#f5f5f5") : c.foe.kit;
    var myLib = pickLiberoKit(mineKit, [foeKit]), oppLib = pickLiberoKit(foeKit, [mineKit, myLib]);
    me = makeSide(c.mine, 0, mineKit, myLib, c.nums && c.nums[0]); opp = makeSide(c.foe, 1, foeKit, oppLib, c.nums && c.nums[1]);
    var home = c.homeSide === 1 ? c.foe : c.mine, away = c.homeSide === 1 ? c.mine : c.foe;
    homeIdx = c.homeSide === 1 ? 1 : 0; chant = null; drama = null;
    buildArena(home, away, c.league || "VNL", c.floor);
    flowLog = []; flames = []; rings = []; puffs = []; popups = []; ball.visible = false; aimPreview = null;
    score = [0, 0]; setsWon = [0, 0]; setNeed = Math.ceil((c.bestOf || 1) / 2); serving = 0; timeScale = 1;
    $("hudMe").textContent = (c.mine.flag || "") + " " + c.mine.name; $("hudOpp").textContent = c.foe.name + " " + (c.foe.flag || "");
    $("stageLine").textContent = c.stage || c.label || "CO-OP";
    updateHud();
  }
  function applySnap(sn) {
    if (!spectating || !me) return;
    [me, opp].forEach(function (sd, i) {
      var o = sn.s[i];
      Object.keys(sd.pos).forEach(function (r) { if (!o[r]) { delete sd.pos[r]; delete sd.tgt[r]; } });
      Object.keys(o).forEach(function (r) {
        var v = o[r], p = sd.pos[r];
        if (!p || Math.hypot(p.x - v[0], p.y - v[1]) > 60) sd.pos[r] = { x: v[0], y: v[1] };
        sd.tgt[r] = { x: v[2], y: v[3] };
        if (v[4]) sd.rush[r] = true; else delete sd.rush[r];
        sd.roster[r].flow = !!v[5]; sd.roster[r].cd = v[6];
      });
    });
    sn.ev.forEach(replay);
    me.rot = sn.rot[0]; opp.rot = sn.rot[1]; score = sn.sc; setsWon = sn.sw; serving = sn.sv; timeScale = sn.ts;
    ball.visible = !!sn.bv; ball.trail = sn.tr || null;
    updateHud();
  }
  function replay(e) {
    var a = e.a;
    if (e.k === "fly") flyBall(a[0], a[1], a[2], a[3]);
    else if (e.k === "jump") jump0(a[0] ? opp : me, a[1], a[2], a[3], a[4], a[5]);
    else if (e.k === "ring") ring(a[0], a[1], a[2], a[3]);
    else if (e.k === "puff") puff(a[0], a[1], a[2]);
    else if (e.k === "pop") popup(a[0], a[1], a[2]);
    else if (e.k === "ban") banner(a[0], a[1], a[2], a[3]);
    else if (e.k === "shake") shake(a);
    else if (e.k === "stop") hitStop(a);
    else if (e.k === "cheer") cheer();
    else if (e.k === "net") netShakeAt = gt;
    else if (e.k === "wave") waveAt = performance.now();
    else if (e.k === "ref") { refFlagSide = e.s; refFlagAt = performance.now(); sfx("whistle"); }
    else if (e.k === "chant") chant = { text: e.c.text, col: e.c.col, at: performance.now() };
  }
  function stopSpectate() { spectating = false; bg = null; ball.visible = false; aimPreview = null; }

  VB.Engine = { runTiming: runTiming, setCam: setCam,
    stream: function (on) { evq = on ? [] : null; }, snapshot: snapshot, matchInit: matchInit, spectate: spectate, applySnap: applySnap, stopSpectate: stopSpectate,
    aimLocal: function (half) { return aimClick(half); }, init: init, playMatch: playMatch, spriteURL: spriteURL, makeSprite: makeSprite, kitPattern: kitPattern };
})(window.VB);
