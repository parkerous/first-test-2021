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
  var score = [0, 0], serving = 0;
  var ball = { x: W / 2, y: H - 80, h: 0, visible: false, spin: 0, rot: 0 };
  var aimPreview = null, timeScale = 1, gt = 0;
  var cheerAt = -9999, refFlagSide = 0, refFlagAt = -9999, netShakeAt = -99;
  var flames = [], lastScorer = null, flowLog = [];
  var mode = "full", myRole = null;
  var bg = null, crowdFrames = [], fans = [], arenaTheme = null;
  var lastFrame = 0;

  function iControl(role) { return mode === "full" || role === myRole; }
  function sleep(ms) { return new Promise(function (res) { setTimeout(res, ms); }); }
  function slow() { timeScale = 0.2; }
  function fast() { timeScale = 1; }
  function other(s) { return s === me ? opp : me; }
  function pointTo(s) { return s === me ? 0 : 1; }
  function cheer() { cheerAt = performance.now(); }
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
  function makeSprite(kit, face) {
    var c = document.createElement("canvas");
    c.width = 12; c.height = 16;
    var q = c.getContext("2d");
    function p(x, y, col) { q.fillStyle = col; q.fillRect(x, y, 1, 1); }
    function row(x1, x2, y, col) { q.fillStyle = col; q.fillRect(x1, y, x2 - x1 + 1, 1); }
    if (face.style === 2) { for (var x = 2; x <= 9; x += 2) p(x, 0, face.hair); }
    if (face.style !== 3) {
      row(2, 9, 1, face.hair);
      if (face.style === 1) row(2, 9, 2, face.hair);
    }
    var topFace = face.style === 1 ? 3 : 2;
    for (var y = topFace; y <= 5; y++) row(3, 8, y, face.skin);
    if (face.style !== 3) { p(3, topFace, face.hair); p(8, topFace, face.hair); }
    p(4, 4, "#17120d"); p(7, 4, "#17120d");
    row(5, 6, 5, face.mouth ? "#a33d4d" : face.skin);
    for (var y2 = 6; y2 <= 11; y2++) row(2, 9, y2, kit);
    p(1, 7, face.skin); p(10, 7, face.skin);
    p(1, 8, face.skin); p(10, 8, face.skin);
    row(3, 8, 12, "#1b1b1b"); row(3, 8, 13, "#1b1b1b");
    p(4, 14, face.skin); p(7, 14, face.skin);
    p(4, 15, "#eee"); p(7, 15, "#eee");
    return c;
  }
  function spriteURL(face, kit) { return makeSprite(kit || "#888888", face).toDataURL(); }

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
  function makeSide(team, side, kit, libKit) {
    var roster = {}, taken = {};
    ROLES.forEach(function (role) {
      var rec = team.lineup[role], num;
      do { num = irnd(1, 24); } while (taken[num]); taken[num] = 1;
      var reach = VB.reach(rec);
      roster[role] = {
        ref: rec, name: rec.name, num: num, face: rec.face, skill: rec.skill || null,
        cd: 0, ph: rnd(0, Math.PI * 2), streak: 0, flow: false, flowLeft: 0,
        srv: rec.srv, rec: rec.rec, set: rec.set, att: rec.att, blk: rec.blk, def: rec.def,
        height: rec.height, vert: rec.vert, spikeReach: reach.spike, blockReach: reach.block,
        sprite: makeSprite(role === "L" ? libKit : kit, rec.face),
        st: newStat()
      };
    });
    return { team: team, roster: roster, side: side, rot: 0, pos: {}, tgt: {}, anim: {}, rush: {},
             lineup: {}, onCourt: [], blockers: [], superBlocker: null };
  }

  // ================== SKILLS / FLOW ==================
  function ready(Pl, kind) { return Pl.skill === kind && Pl.cd === 0; }
  function useSkill(s, Pl) {
    Pl.cd = SKILL_CD[Pl.skill];
    feed(s.side, "★ " + Pl.name + " — " + VB.SKILL_TXT[Pl.skill] + "!", true);
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
    s.onCourt.forEach(function (r) {
      if (blockers.indexOf(r) >= 0) return;
      var bx = baseX(s, r);
      if (isFront(s, r)) { m[r] = P(s.side, bx === XM ? XM : bx === XL ? CL + 50 : CR - 50, NET + ATK - 4); return; }
      var lineSide = lineRight ? bx === XR : bx === XL;
      if (lineSide) m[r] = P(s.side, lineRight ? CR - 30 : CL + 30, NET + 172);
      else if (bx === XM) m[r] = P(s.side, XM + (lineRight ? 22 : -22), NET + 235);
      else m[r] = P(s.side, lineRight ? CL + 48 : CR - 48, NET + 160);
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
  function placeDefense(s, ax, blockers, lean) {
    var m = defenseFormation(s, ax, blockers), n = blockers.length;
    var lineDir = ax < W / 2 ? -1 : 1;
    var shift = n ? (lean === "line" ? 11 : -11) * lineDir : 0;
    var y = NET + (s.side === 0 ? 34 : -34);
    blockers.forEach(function (r, i) {
      m[r] = { x: clamp(ax + shift + (i - (n - 1) / 2) * 26, CL + 12, CR - 12), y: y };
    });
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
    moveTo(rcvSide, "S", setterSpot(rcvSide.side));
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
    var pt = passPoint(s, grade), far = dist(pt, setterSpot(s.side)), setterRole = "S";
    if (passerRole === "S" || (grade === 0 && far > 140)) setterRole = altSetter(s, passerRole) || "S";
    transition(s, setterRole);
    moveTo(s, setterRole, pt);
    if (setterRole !== "S" || far > 80) s.rush[setterRole] = true;
    await flyBall(from, pt, 650, { h0: 0, h1: 1.1, peak: 1.3, skew: 0.6 });
    return setterRole;
  }

  // ================== ANIMATION ==================
  function jump(s, role, ms, h, kind, dir) { if (s.pos[role]) s.anim[role] = { t0: gt, dur: ms / 1000, h: h, kind: kind, dir: dir || 1 }; }
  function jumpLater(s, role, delay, ms, h, kind) { setTimeout(function () { jump(s, role, ms, h, kind); }, delay); }
  function flyBall(from, to, ms, o) {
    o = o || {};
    var peak = o.peak || 0, h0 = o.h0 || 0, h1 = o.h1 || 0, skew = o.skew || 0.5, wob = o.wobble || 0;
    ball.visible = true;
    ball.spin = o.spin || 0;
    return new Promise(function (res) {
      var t = 0, last = performance.now();
      (function step(now) {
        t += (now - last) / ms * timeScale; last = now;
        var tt = clamp01(t);
        var arc = tt < skew ? Math.sin(tt / skew * Math.PI / 2) : Math.cos((tt - skew) / (1 - skew) * Math.PI / 2);
        ball.x = from.x + (to.x - from.x) * tt + Math.sin(tt * Math.PI * 6) * wob * (1 - tt * 0.4);
        ball.y = from.y + (to.y - from.y) * tt;
        ball.h = h0 + (h1 - h0) * tt + arc * peak;
        if (tt < 1) requestAnimationFrame(step); else res();
      })(last);
    });
  }
  function ballPos() { return { x: ball.x, y: ball.y }; }
  // after a kill the ball keeps travelling and bounces away
  function bounce(from, to) {
    var dx = to.x - from.x, dy = to.y - from.y, d = Math.hypot(dx, dy) || 1;
    return flyBall(to, { x: to.x + dx / d * 70, y: to.y + dy / d * 70 }, 330, { peak: 0.7, spin: 10 });
  }

  // ================== ARENA ==================
  function buildArena(home, away, league) {
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
    b.fillStyle = arenaTheme.free; b.fillRect(100, 104, 440, 692);
    b.globalAlpha = 0.18; b.fillStyle = "#ffffff";
    b.font = '34px "Press Start 2P", monospace'; b.textAlign = "center"; b.textBaseline = "middle";
    b.save(); b.translate(118, 450); b.rotate(-Math.PI / 2); b.fillText((home.short || home.name).slice(0, 10), 0, 0); b.restore();
    b.save(); b.translate(522, 450); b.rotate(Math.PI / 2); b.fillText((home.short || home.name).slice(0, 10), 0, 0); b.restore();
    b.globalAlpha = 1;
    b.save(); b.translate(OX, OY);
    b.fillStyle = "#1668d8"; b.fillRect(CL, CT, CR - CL, CB - CT);
    b.fillStyle = "#1e7ef0"; b.fillRect(CL, NET - ATK, CR - CL, ATK * 2);
    b.strokeStyle = "#ffffff"; b.lineWidth = 2.5;
    b.strokeRect(CL, CT, CR - CL, CB - CT);
    b.beginPath(); b.moveTo(CL, NET - ATK); b.lineTo(CR, NET - ATK); b.stroke();
    b.beginPath(); b.moveTo(CL, NET + ATK); b.lineTo(CR, NET + ATK); b.stroke();
    b.beginPath(); b.moveTo(CL, NET); b.lineTo(CR, NET); b.stroke();
    // benches + scorer's table
    b.fillStyle = "#3a3f4a"; b.fillRect(CL - 60, NET + 120, 10, 70); b.fillRect(CL - 60, NET - 190, 10, 70);
    b.fillStyle = "#13293f"; b.fillRect(CR + 50, NET - 30, 8, 60);
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
          fans.push({ x: x, y: y, shirt: shirt, skin: face.skin, hair: face.hair, ph: Math.random() * 6.28,
                      flag: Math.random() < 0.06, flagCol: awaySec ? ak : hk });
        }
      }
    }
    seats(0, 0, CW, 84, 9, 10); seats(0, 816, CW, 84, 9, 10);
    seats(0, 84, 74, 732, 9, 10); seats(566, 84, 74, 732, 9, 10);
    crowdFrames = [0, 1, 2, 3].map(function (pose) {
      var c = document.createElement("canvas"); c.width = CW; c.height = CH;
      var q = c.getContext("2d");
      fans.forEach(function (f) { drawFan(q, f, pose); });
      return c;
    });
  }
  function drawFan(c, f, pose) {
    var lift = (pose === 1 && f.ph > 3) ? 1 : (pose === 2 && f.ph <= 3) ? 2 : (pose === 3 && f.ph > 3) ? 2 : 0;
    var x = f.x, y = f.y - lift;
    c.fillStyle = f.shirt; c.fillRect(x, y + 3, 5, 4);
    c.fillStyle = f.skin; c.fillRect(x + 1, y, 3, 3);
    c.fillStyle = f.hair; c.fillRect(x + 1, y, 3, 1);
    if (pose >= 2) {
      c.fillStyle = f.skin; c.fillRect(x - 1, y - 1, 1, 3); c.fillRect(x + 5, y - 1, 1, 3);
      if (f.flag) { c.fillStyle = "#dddddd"; c.fillRect(x + 6, y - 6, 1, 7); c.fillStyle = f.flagCol; c.fillRect(x + 7, y - 6 + (pose === 3 ? 1 : 0), 5, 3); }
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
        var kk = s.rush[r] ? kr : k;
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
    else return;
    g.lineCap = "round";
    [["rgba(10,20,40,0.45)", 6.5], [skin, 4]].forEach(function (st) {
      g.strokeStyle = st[0]; g.lineWidth = st[1];
      g.beginPath(); g.moveTo(Ls.x, Ls.y); g.lineTo(Lh.x, Lh.y); g.moveTo(Rs.x, Rs.y); g.lineTo(Rh.x, Rh.y); g.stroke();
    });
    g.lineCap = "butt";
    g.fillStyle = skin;
    if (kind === "pass" || kind === "dig") g.fillRect(Lh.x - 4, Lh.y - 1, 12, 4);
    if (kind === "block") { g.fillRect(Lh.x - 3, Lh.y - 4, 6, 5); g.fillRect(Rh.x - 3, Rh.y - 4, 6, 5); }
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
    g.fillText(score[0] + "-" + score[1], 320, 33);
  }

  function draw(now) {
    var dt = Math.min(0.05, (now - lastFrame) / 1000);
    lastFrame = now;
    gt += dt * timeScale;
    stepPlayers(dt);
    if (!bg) { requestAnimationFrame(draw); return; }

    g.drawImage(bg, 0, 0);
    var cheerAmt = clamp01(1 - (now - cheerAt) / 1100);
    var frame = cheerAmt > 0 ? (Math.floor(now / 120) % 2 ? 3 : 2) : (Math.floor(now / 650) % 2);
    g.drawImage(crowdFrames[frame], 0, 0);
    drawJumbotron();

    g.save(); g.translate(OX, OY);
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
      var mine = s.side === 0, isYou = mine && mode === "role" && it.r === myRole;
      if (lift > 0) { g.fillStyle = "rgba(0,20,60,0.3)"; g.beginPath(); g.ellipse(x, p.y + 17, 10, 4, 0, 0, Math.PI * 2); g.fill(); }
      g.strokeStyle = isYou ? "#ffd21e" : mine ? "#0e9e45" : "#e0348a";
      g.lineWidth = isYou ? 3.5 : 2;
      g.beginPath(); g.ellipse(x, p.y + 17, isYou ? 16 : 13, isYou ? 6 : 5, 0, 0, Math.PI * 2); g.stroke();
      if (Pl.flow) {
        g.fillStyle = "rgba(60,200,255," + (0.3 + Math.sin(gt * 8) * 0.12) + ")";
        g.beginPath(); g.ellipse(x, p.y + 17, 19, 7, 0, 0, Math.PI * 2); g.fill();
        drawFlameBody(x, p.y, y - 24);
        spawnFlames(x, p.y, y - 24, dt * timeScale);
      }
      if (kind === "dive") {                                       // dolphin dive: body laid out toward the ball
        var tilt = a.dir * 1.3 * Math.sin(Math.min(1, pr * 1.8) * Math.PI / 2);
        g.save(); g.translate(x, p.y + 8); g.rotate(tilt);
        g.drawImage(Pl.sprite, -15, -32, 30, 40);
        g.restore();
        g.strokeStyle = Pl.face.skin; g.lineWidth = 4; g.lineCap = "round";
        g.beginPath(); g.moveTo(x + a.dir * 8, p.y); g.lineTo(x + a.dir * 26, p.y + 6); g.stroke(); g.lineCap = "butt";
        it.dy = p.y - 6;
      } else {
        g.drawImage(Pl.sprite, Math.round(x - 15), Math.round(y - 24), 30, 40);
        if (kind) drawArms(kind, pr, x, y, Pl.face.skin, a && a.dir);
      }
    });
    drawFlames(dt * timeScale);

    var placed = [];
    function freeY(text, x, y, font, dir) {
      g.font = font;
      var w = g.measureText(text).width + 8;
      for (var tries = 0; tries < 2 && placed.some(function (b2) { return Math.abs(b2.x - x) < (b2.w + w) / 2 && Math.abs(b2.y - y) < 17; }); tries++) y += dir * 17;
      placed.push({ x: x, y: y, w: w });
      return y;
    }
    list.slice().reverse().forEach(function (it) {
      var Pl = it.s.roster[it.r], mine = it.s.side === 0, isYou = mine && mode === "role" && it.r === myRole;
      var nm = Pl.name.length > 11 ? Pl.name.slice(0, 10) + "." : Pl.name;
      var star = Pl.skill ? (Pl.cd ? " ★" + Pl.cd : " ★") : "";
      var label = (isYou ? "YOU " : "") + (Pl.flow ? "FLOW " : "") + nm + star;
      pill(label, it.dx, freeY(label, it.dx, it.dy - 34, LABEL_FONT, -1), LABEL_FONT,
           isYou ? "#13293f" : Pl.flow ? "#d8f7ff" : (Pl.skill && !Pl.cd) ? "#ffd21e" : "#ffffff",
           isYou ? "#ffd21e" : Pl.flow ? "#0b49d6" : "rgba(10,30,60,0.85)");
    });
    list.forEach(function (it) {
      var Pl = it.s.roster[it.r], tag = it.r + " #" + Pl.num;
      pill(tag, it.fx, freeY(tag, it.fx, it.p.y + 33, ROLE_FONT, 1), ROLE_FONT, "#ffffff", it.s.side === 0 ? "#0e9e45" : "#e0348a");
    });

    if (ball.visible) {
      ball.rot += dt * timeScale * ball.spin;
      var shR = Math.max(2.2, 8 - ball.h * 3.4);
      g.fillStyle = "rgba(0,20,60," + clamp(0.45 - ball.h * 0.11, 0.08, 0.45) + ")";
      g.beginPath(); g.ellipse(ball.x, ball.y, shR, shR * 0.55, 0, 0, Math.PI * 2); g.fill();
      var r = 6 + ball.h * 5, by = ball.y - ball.h * 30;
      g.fillStyle = "#ffd500"; g.beginPath(); g.arc(ball.x, by, r, 0, Math.PI * 2); g.fill();
      g.strokeStyle = "#1e4fd8"; g.lineWidth = Math.max(1.4, r * 0.3);
      g.beginPath(); g.arc(ball.x, by, r * 0.62, ball.rot + 0.3, ball.rot + 1.8); g.stroke();
      g.beginPath(); g.arc(ball.x, by, r * 0.62, ball.rot + Math.PI + 0.3, ball.rot + Math.PI + 1.8); g.stroke();
      g.strokeStyle = "#17408f"; g.lineWidth = 1; g.beginPath(); g.arc(ball.x, by, r, 0, Math.PI * 2); g.stroke();
    }
    g.restore();
    requestAnimationFrame(draw);
  }

  // ================== INPUT ==================
  function aimClick(half) {
    return new Promise(function (res) {
      cv.classList.add("aiming");
      function toCourt(e) {
        var r = cv.getBoundingClientRect();
        var x = clamp((e.clientX - r.left) / r.width * CW - OX, CL + 10, CR - 10);
        var y = (e.clientY - r.top) / r.height * CH - OY;
        y = half === "top" ? clamp(y, CT + 10, NET - 16) : clamp(y, NET + 16, CB - 10);
        return { x: x, y: y };
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
  function timingBar(label, speedMs) {
    return new Promise(function (res) {
      var wrap = $("timing"), mk = $("marker");
      $("timingLabel").textContent = label;
      var center = rnd(0.3, 0.7);
      $("zoneG").style.left = (center - 0.15) * 100 + "%"; $("zoneG").style.width = "30%";
      $("zoneP").style.left = (center - 0.05) * 100 + "%"; $("zoneP").style.width = "10%";
      wrap.classList.remove("hidden");
      var t0 = performance.now(), done = false, raf;
      function pos(now) { return (1 - Math.cos(((now - t0) / speedMs) * Math.PI * 2)) / 2; }
      (function step(now) { if (done) return; mk.style.left = pos(now) * 100 + "%"; raf = requestAnimationFrame(step); })(t0);
      function stop(e) {
        if (done) return; done = true;
        e.preventDefault(); cancelAnimationFrame(raf);
        document.removeEventListener("pointerdown", stop, true);
        document.removeEventListener("keydown", key, true);
        var q = clamp01(1 - Math.abs(pos(performance.now()) - center) / 0.5);
        wrap.classList.add("hidden"); res(q);
      }
      function key(e) { if (e.key === " ") stop(e); }
      setTimeout(function () { document.addEventListener("pointerdown", stop, true); document.addEventListener("keydown", key, true); }, 120);
      setTimeout(function () { if (!done) { done = true; cancelAnimationFrame(raf); wrap.classList.add("hidden"); res(0.15); } }, speedMs * 2.4);
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
  function barSpeed(attacker) { return Math.round(1500 - (attacker.team.ovr - 65) * 16); }
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
  function setOptions(s, grade) {
    var front = frontRoles(s);
    var mb = front.find(function (r) { return r.indexOf("MB") === 0; });
    var oh = front.find(function (r) { return r.indexOf("OH") === 0; });
    var opFront = front.indexOf("OP") >= 0;
    var xs = s.side === 0 ? { left: 120, mid: 240, right: 330, slideX: 300 } : { left: W - 120, mid: W - 240, right: W - 330, slideX: W - 300 };
    var opts = [
      { id: "quick", label: "QUICK", hitter: mb, tempo: 0.45, needPass: 2, x: xs.mid, pipe: false, peak: 0.3 },
      { id: "slide", label: "SLIDE", hitter: mb, tempo: 0.55, needPass: 2, x: xs.slideX, pipe: false, peak: 0.5 },
      opFront ? { id: "medium", label: "MEDIUM", hitter: "OP", tempo: 0.75, needPass: 1, x: xs.right, pipe: false, peak: 0.9 }
              : { id: "pipe", label: "PIPE", hitter: "OP", tempo: 0.8, needPass: 1, x: xs.mid, pipe: true, peak: 1.0 },
      { id: "high", label: "HIGH", hitter: oh, tempo: 1.0, needPass: 0, x: xs.left, pipe: false, peak: 1.7 }
    ];
    if (s.roster.S.skill === "dump") {
      opts.push({ id: "dump", label: "DUMP", hitter: "S", tempo: 0.3, needPass: 1, x: setterSpot(s.side).x, pipe: false, dump: true, notReady: s.roster.S.cd > 0 });
    }
    return opts.map(function (o) { o.disabled = grade < o.needPass || !!o.notReady; return o; });
  }
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
  function aiPickSet(s, opts) {
    var ok = opts.filter(function (o) { return !o.disabled; });
    var d = ok.find(function (o) { return o.dump; });
    if (d && Math.random() < 0.1) return d;
    var nonDump = ok.filter(function (o) { return !o.dump; });
    if (!nonDump.length) return ok[0] || opts[opts.length - 1];
    var st = nonDump[Math.random() < s.team.ovr / 140 ? 0 : nonDump.length - 1];
    if (Math.random() < 0.5) st = nonDump[irnd(0, nonDump.length - 1)];
    return st;
  }
  function aiAttackPlan(atk, def, A, n) {
    var r = Math.random(), type = "spike";
    if (r < 0.12) type = "tip";
    else if (n >= 2 && r < 0.24) type = "wipe";
    if (type === "spike" && ready(A, "spike") && Math.random() < 0.7) type = "super";
    return { type: type, target: type === "tip" ? tipTarget(def) : type === "wipe" ? null : aiTarget(def, atk.team.ovr) };
  }
  function blockCount(st) {
    var r = Math.random();
    if (st.tempo < 0.5) return r < 0.25 ? 0 : r < 0.85 ? 1 : 2;
    if (st.tempo < 0.7) return r < 0.15 ? 0 : r < 0.7 ? 1 : 2;
    if (st.tempo < 0.9) return r < 0.25 ? 1 : r < 0.8 ? 2 : 3;
    return r < 0.15 ? 1 : r < 0.7 ? 2 : 3;
  }

  // ================== RALLY FLOW ==================
  async function rally() {
    buildLineup(me, serving); buildLineup(opp, serving);
    var srvSide = serving === 0 ? me : opp, rcvSide = other(srvSide);
    setTargets(srvSide, serveFormation(srvSide));
    setTargets(rcvSide, receiveFormation(rcvSide));
    updateHud();
    if (mode === "role" && me.onCourt.indexOf(myRole) < 0) {
      feed(0, me.roster[myRole].name + " (YOU) sits this rotation out — " + (myRole === "L" ? "your middle is serving." : "the libero is in for you."));
    }
    await sleep(700);
    var winner = await serve(srvSide);
    if (winner !== serving) (winner === 0 ? me : opp).rot = ((winner === 0 ? me : opp).rot + 1) % 6;
    score[winner]++; serving = winner;
    cheer(); refFlagAt = performance.now(); refFlagSide = winner;
    tickCooldowns();
    updateStreaks(winner);
    updateHud();
    await sleep(800);
  }

  async function serveMotion(s, role, kind) {
    var spot = serveFrom(s.side), dir = s.side === 0 ? 1 : -1;
    var contact = { x: spot.x, y: spot.y - 6 * dir };
    if (kind === "spin") {
      var back = { x: spot.x, y: spot.y + 22 * dir };
      moveTo(s, role, back);
      await sleep(350);
      var toss = flyBall(back, contact, 700, { h0: 0.5, h1: 1.5, peak: 1.0, skew: 0.55, spin: 3 });
      await sleep(160);
      moveTo(s, role, spot);
      await sleep(300);
      jump(s, role, 420, 12, "spike");
      await toss;
    } else {
      await flyBall(spot, contact, 520, { h0: 0.5, h1: 0.9, peak: 0.6, skew: 0.6 });
      jump(s, role, 240, 3, "serve");
    }
    return contact;
  }

  async function serve(srv) {
    var rcv = other(srv), sr = srv.lineup[1], Sv = srv.roster[sr], kind, target;
    if (srv === me && iControl(sr)) {
      msg(Sv.name + " TO SERVE — PICK THE SERVE");
      var o = [{ label: "FLOAT SERVE", value: "float" }, { label: "TOPSPIN SERVE", value: "spin" }];
      if (Sv.skill === "serve") o.push({ label: "★ SUPER SERVE" + (Sv.cd ? " (" + Sv.cd + ")" : ""), value: "super", disabled: !ready(Sv, "serve") });
      kind = await U.buttons(o);
      msg("CLICK WHERE TO SERVE");
      target = await aimClick("top");
    } else {
      kind = ready(Sv, "serve") && Math.random() < 0.7 ? "super" : Math.random() < 0.45 ? "float" : "spin";
      target = serveTarget(rcv, srv.team.ovr);
      msg(Sv.name + " — " + (kind === "float" ? "FLOAT" : kind === "super" ? "SUPER" : "TOPSPIN") + " SERVE!");
    }
    var superServe = kind === "super";
    if (superServe) { kind = "spin"; useSkill(srv, Sv); }
    var sp = serveParams(kind, Sv.srv, srv === me ? 0.5 + Sv.srv / 250 : 0.4 + srv.team.ovr / 300);
    if (superServe) { sp.power = clamp01(sp.power + 0.25); sp.errP += 0.05; }
    target = clampHalf(rcv, { x: target.x + rnd(-1, 1) * sp.wobble * 90, y: target.y + rnd(-1, 1) * sp.wobble * 60 });
    if (!superServe) feed(srv.side, Sv.name + (kind === "spin" ? " rips a jump topspin!" : " floats one over..."));

    var contact = await serveMotion(srv, sr, kind);
    var errKind = Math.random() < sp.errP ? (Math.random() < 0.5 ? "net" : "long") : null;
    var dirR = rcv.side === 0 ? 1 : -1;
    if (errKind === "net") {
      var netPt = { x: target.x, y: NET - dirR * 6 };
      await flyBall(contact, netPt, 600, { h0: 1.2, h1: 0.6, peak: 0.3 });
      netShakeAt = gt;
      await flyBall(netPt, { x: netPt.x, y: NET - dirR * 30 }, 260, { h0: 0.6, h1: 0 });
      msg("SERVE INTO THE NET!"); feed(srv.side, "...but it catches the net. Service error.");
      Sv.st.se++;
      return credit(rcv);
    }
    if (!errKind && Math.random() < 0.04) return await netCordServe(srv, rcv, Sv, sr, contact, target);
    if (errKind === "long") target = { x: target.x, y: dirR > 0 ? CB + 24 : CT - 24 };

    var flightMs = kind === "spin" ? (superServe ? 680 : 780) : 1150;
    var fo = kind === "spin" ? { h0: 1.5, h1: 0, peak: 0.5, skew: 0.3, spin: 22 } : { h0: 0.9, h1: 0, peak: 0.6, skew: 0.5, wobble: 9 };
    var flight = flyBall(contact, target, flightMs, fo);
    var rcvRole = onServeContact(srv, rcv, target);
    var RP = rcv.roster[rcvRole], timing = null;
    if (!errKind && rcv === me && iControl(rcvRole)) {
      await sleep(150); slow();
      timing = await timingBar("RECEIVE — " + RP.name + "!", barSpeed(srv));
      fast();
    } else if (rcv === me) timing = autoTiming(RP.rec);
    await flight;
    if (errKind === "long") { msg("LONG — OUT!"); feed(srv.side, "...long! Service error."); Sv.st.se++; return credit(rcv); }

    var useRec = ready(RP, "rec") && (rcv !== me || iControl(rcvRole) || Math.random() < 0.7);
    if (useRec) useSkill(rcv, RP);
    var rq = rcv === me ? clamp01(timing * 0.55 + RP.rec / 220 - sp.power * 0.35 + rnd(-0.05, 0.1))
                        : clamp01(RP.rec / 110 - sp.power * 0.45 + rnd(-0.12, 0.18));
    if (useRec) rq = clamp01(rq + 0.15);
    var shank = Math.random() < (useRec ? SHANK_P / 2 : SHANK_P);
    var grade = shank ? -1 : passGrade(rq);
    RP.st.rc++;
    if (grade < 0) {
      jump(rcv, rcvRole, 520, -3, "shank");
      var away = { x: target.x + (target.x < W / 2 ? -1 : 1) * rnd(90, 160), y: target.y + dirR * rnd(60, 120) };
      await flyBall(target, away, 520, { peak: 1.2, spin: 30 });
      Sv.st.ace++; RP.st.re++;
      msg(shank ? "SHANKED INTO THE STANDS!" : "ACE!!"); cheer();
      feed(srv.side, shank ? RP.name + " SHANKS the serve into the crowd!" : "ACE! " + Sv.name + " is on fire.", true);
      return credit(srv, sr);
    }
    jump(rcv, rcvRole, 500, -3, "pass");
    if (grade === 2) RP.st.rp++;
    feed(rcv.side, RP.name + " passes — " + GRADE_TXT[grade].toLowerCase() + ".");
    if (grade === 0 && Math.random() < 0.12) return await overpass(rcv, target);
    var setter = await toSetter(rcv, target, grade, rcvRole);
    return await offense(rcv, grade, setter);
  }

  // the serve clips the tape and trickles over — a "waterfall"
  async function netCordServe(srv, rcv, Sv, sr, contact, target) {
    var dirR = rcv.side === 0 ? 1 : -1, tape = { x: target.x, y: NET };
    feed(srv.side, Sv.name + "'s serve clips the tape...");
    await flyBall(contact, tape, 700, { h0: 1.2, h1: 0.9, peak: 0.4 });
    netShakeAt = gt;
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
    netShakeAt = gt;
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

  async function offense(atk, grade, setterRole) {
    setterRole = setterRole || "S";
    var def = other(atk), SN = atk.roster[setterRole].name, emergency = setterRole !== "S";
    var opts = setOptions(atk, grade);
    if (emergency) opts = opts.filter(function (o) { return o.id === "high"; });
    var st = null;
    if (atk === me && !emergency && iControl("S")) {
      msg(SN + " TO SET — PICK HITTER & BALL (" + GRADE_TXT[grade] + ")");
      var choice = await U.buttons(opts.map(function (o) {
        if (o.dump) return { label: "★ DUMP" + (me.roster.S.cd ? " (" + me.roster.S.cd + ")" : ""), value: o.id, disabled: o.disabled };
        var HP = me.roster[o.hitter];
        return { label: o.label + " · " + HP.name + (HP.skill === "spike" ? " ★" : ""), value: o.id, disabled: o.disabled };
      }));
      st = opts.find(function (o) { return o.id === choice; });
    } else if (atk === me && mode === "role" && !emergency) {
      var mine = opts.filter(function (o) { return !o.disabled && !o.dump && o.hitter === myRole; });
      if (mine.length) {
        msg("CALL FOR THE BALL? (" + GRADE_TXT[grade] + ")");
        var call = await U.buttons(mine.map(function (o) { return { label: "CALL " + o.label, value: o.id }; })
          .concat([{ label: "LET " + SN + " DECIDE", value: "auto" }]));
        if (call !== "auto") {
          var want = mine.find(function (o) { return o.id === call; });
          feed(0, me.roster[myRole].name + " (YOU) calls for a " + want.label.toLowerCase() + " ball!");
          if (Math.random() < 0.6 + grade * 0.15) st = want; else feed(0, SN + " goes elsewhere...");
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
    if (iAttack && iControl("S")) { slow(); msg("DUMP — CLICK WHERE TO DROP IT!"); target = await aimClick("top"); fast(); }
    else target = tipTarget(def);
    target = tipClamp(target);
    feed(atk.side, S.name + " shows set... and DUMPS it on two!", true);
    jump(atk, "S", 380, 9, "spike");
    S.st.att++;
    var mb = frontRoles(def).find(function (r) { return r.indexOf("MB") === 0; });
    var read = Math.random() < 0.22;
    if (read) jump(def, mb, 420, 10, "block");
    await sleep(170);
    var from = ballPos();
    if (read && Math.random() < 0.5) {
      var bp = { x: from.x, y: NET + (def.side === 0 ? 8 : -8) };
      await flyBall(from, bp, 150, { h0: 1.1, h1: 0.8 });
      netShakeAt = gt;
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
    var n = blockCount(st), blockers = chooseBlockers(def, st.x, n);
    var lean = Math.random() < 0.5 ? "cross" : "line";
    var controlled = iAttack && iControl(hitter);
    var plan = controlled ? null : aiAttackPlan(atk, def, A, n);
    if (!iAttack && n && plan.target) {
      var actual = shotDir(st.x, plan.target);
      var myBlk = blockers.reduce(function (a, r) { return a + me.roster[r].blk; }, 0) / n;
      if (actual !== "angle" && Math.random() < clamp01((0.3 + myBlk / 300) * st.tempo)) lean = actual;
    }
    placeDefense(def, st.x, blockers, lean);
    feed(atk.side, SN + " gives a " + st.label.toLowerCase() + " ball to " + zoneName(atk.side, st.x) + " for " + A.name + (A.skill ? " ★" : "") + "...");
    jump(atk, setterRole, 420, 2, "set");
    var setFlight = flyBall(setFrom, contact, 380 + st.tempo * 420, { h0: 1.1, h1: 1.4, peak: st.peak });
    var blockInfo = BLOCK_TXT[n] + (n && st.tempo >= 0.7 ? ", LEANING " + lean.toUpperCase() : "");

    var superBlock = false;
    if (controlled) {
      slow();
      msg(st.label + " TO " + A.name + " — " + blockInfo + "!");
      var ch = [];
      if (A.skill === "spike") ch.push({ label: "★ SUPER SPIKE" + (A.cd ? " (" + A.cd + ")" : ""), value: "super", disabled: !ready(A, "spike") });
      ch.push({ label: "SPIKE", value: "spike" }, { label: "TIP", value: "tip" });
      if (n > 0) ch.push({ label: "WIPE OFF BLOCK", value: "wipe" });
      var type = await U.buttons(ch), tgt = null;
      if (type !== "wipe") { msg(type === "tip" ? "CLICK WHERE TO TIP IT" : "CLICK WHERE TO HIT IT"); tgt = await aimClick("top"); }
      fast();
      plan = { type: type, target: tgt };
    } else if (iAttack) msg(st.label + " TO " + A.name + " — " + blockInfo + "!");
    else msg(atk.team.name + ": " + st.label + " TO " + A.name + " — " + BLOCK_TXT[n] + "!");

    if (!iAttack && n > 0) {
      if (mode === "role" && blockers.indexOf(myRole) >= 0 && st.tempo >= 0.7) {
        slow();
        msg("YOU'RE IN THE " + BLOCK_TXT[n] + " ON " + A.name + " — LEAN WHICH WAY?");
        lean = await U.buttons([{ label: "LEAN CROSS", value: "cross" }, { label: "LEAN LINE", value: "line" }]);
        fast();
        placeDefense(def, st.x, blockers, lean);
        feed(0, me.roster[myRole].name + " (YOU) leans " + lean + "...");
      } else if (st.tempo >= 0.7) feed(0, "your " + BLOCK_TXT[n].toLowerCase() + " leans " + lean + "...");
      var sb = blockers.find(function (r) { return ready(def.roster[r], "block"); });
      if (sb && iControl(sb)) {
        slow(); msg("★ SUPER BLOCK WITH " + def.roster[sb].name + "?");
        superBlock = await U.buttons([{ label: "★ SUPER BLOCK", value: true }, { label: "NORMAL BLOCK", value: false }]);
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

    jump(atk, hitter, 450, 14, "spike");
    blockers.forEach(function (r, i) { jumpLater(def, r, 60 + i * 30, 500, 12, "block"); });
    await sleep(190);
    return await resolveHit(atk, def, hitter, st, plan, blockers, lean, superBlock, grade, contact, setterRole);
  }

  async function resolveHit(atk, def, hitter, st, plan, blockers, lean, superBlock, grade, contact, setterRole) {
    var A = atk.roster[hitter], dirA = atk.side === 0 ? 1 : -1, dirD = -dirA, n = blockers.length;
    var setQ = grade === 2 ? 1 : grade === 1 ? 0.75 : 0.5;
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
    var shot = shotName(st.x, target);
    A.st.att++;

    // a tight, poor set can turn into a joust over the net
    if (n && setQ <= 0.5 && type === "spike" && Math.random() < 0.08) return await joust(atk, hitter, def, BtouchRole, contact);

    // height & reach duel: spike reach vs the best block reach in front of the hitter
    var topBlock = n ? Bs.reduce(function (m, b) { return b.blockReach > m.blockReach ? b : m; }) : null;
    var reachDiff = n ? A.spikeReach - topBlock.blockReach : 0;
    if (n && Math.abs(reachDiff) >= 12 && Math.random() < 0.45) {
      feed(-1, reachDiff > 0 ? A.name + " (" + A.spikeReach + "cm reach) is hitting over the block!"
                             : topBlock.name + "'s " + topBlock.blockReach + "cm block towers over " + A.name + "...");
    }

    // 1) attack error
    var errP = 0.05 + (1 - setQ) * 0.08 + st.tempo * 0.02 - A.att / 1200 + (superSpike ? 0.03 : 0) + (type === "wipe" ? 0.05 : 0) - (type === "tip" ? 0.03 : 0);
    if (Math.random() < errP) {
      A.st.ae++;
      if (Math.random() < 0.4) {
        var np = { x: contact.x, y: NET + dirA * 6 };
        await flyBall(contact, np, 200, { h0: 1.4, h1: 0.6 });
        netShakeAt = gt;
        await flyBall(np, { x: np.x, y: NET + dirA * 30 }, 250, { h0: 0.6, h1: 0 });
        msg("INTO THE NET!"); feed(atk.side, "and " + A.name + " hits it into the net!");
      } else {
        var outPt = { x: clamp(target.x + rnd(-40, 40), CL - 30, CR + 30), y: def.side === 0 ? CB + 26 : CT - 26 };
        await flyBall(contact, outPt, 380, { h0: 1.4, h1: 0 });
        msg("OUT!"); feed(atk.side, "and " + A.name + " sends " + shot + "... OUT!");
      }
      return credit(def);
    }

    // 2) through the seam between two blockers?
    var seam = false;
    if (n >= 2 && type === "spike") {
      var xs = blockers.map(function (r) { return def.tgt[r].x; });
      var lo = Math.min.apply(null, xs), hi = Math.max.apply(null, xs);
      var cross = contact.x + (target.x - contact.x) * clamp(34 / Math.max(60, Math.abs(target.y - contact.y)), 0.1, 0.5);
      if (cross > lo - 4 && cross < hi + 4 && Math.random() < 0.3 + (st.tempo < 0.6 ? 0.25 : 0) + (readWrong ? 0.1 : 0)) seam = true;
    }

    // 3) does the block get a hand on it?
    var pTouch = 0, stuffAdj = 0;
    if (n && type === "spike") {
      pTouch = [0, 0.42, 0.58, 0.7][n] * (0.7 + blkAvg / 330) * (readRight ? 1.25 : readWrong ? 0.6 : 1) * (superSpike ? 0.85 : 1) + (superBlock ? 0.12 : 0);
      pTouch *= clamp(1 - reachDiff / 120, 0.55, 1.45);
      stuffAdj = clamp(-reachDiff / 250, -0.15, 0.15);
      if (seam) pTouch *= 0.25;
    }
    if (n && type === "tip") pTouch = 0.1;
    if (n && type === "wipe") pTouch = 0.95;
    if (Math.random() < clamp(pTouch, 0, 0.92)) {
      await flyBall(contact, blockPt, 170, { h0: 1.4, h1: 0.6 });
      netShakeAt = gt;
      var r = Math.random(), outcome;
      if (type === "wipe") {
        var wipeP = clamp(0.38 + A.att / 350 - blkAvg / 700, 0.2, 0.75);
        outcome = r < wipeP ? "tool" : r < wipeP + 0.3 ? "stuff" : "soft";
      } else if (type === "tip") outcome = "soft";
      else {
        var stuffP = clamp(0.3 + (blkAvg - A.att) / 250 + (n - 1) * 0.06 + (superBlock ? 0.15 : 0) - (superSpike ? 0.1 : 0) + stuffAdj, 0.12, 0.6);
        var toolP = clamp(0.15 + (A.att - blkAvg) / 400, 0.05, 0.3);
        outcome = r < stuffP ? "stuff" : r < stuffP + toolP ? "tool" : r < stuffP + toolP + 0.12 ? "offblock" : Math.random() < 0.25 ? "rebound" : "soft";
      }
      var who = Btouch.name + (superBlock ? " ★" : "");
      if (outcome === "stuff") {
        await flyBall(blockPt, { x: bx + rnd(-25, 25), y: NET + dirA * rnd(25, 70) }, 280, { h0: 0.6, h1: 0 });
        A.st.bk++; Btouch.st.blk++;
        msg((n === 3 ? "TRIPLE " : n === 2 ? "DOUBLE " : "") + "BLOCK — STUFFED!!"); cheer();
        feed(def.side, who + " STUFFS " + A.name + "!" + (readRight ? " Read it all the way." : "") + (n > 1 ? " (" + BLOCK_TXT[n].toLowerCase() + ")" : ""), true);
        return credit(def, BtouchRole);
      }
      if (outcome === "tool") {
        var sideOut = { x: bx < W / 2 ? CL - 28 : CR + 28, y: NET + dirD * rnd(70, 220) };
        await flyBall(blockPt, sideOut, 420, { h0: 0.6, h1: 0, peak: 0.5 });
        A.st.k++; assist(atk, setterRole, hitter);
        msg("OFF THE BLOCK — OUT!"); cheer();
        feed(atk.side, "and " + A.name + (type === "wipe" ? " WIPES it off " : " tools ") + Btouch.name + "'s hands — out!", true);
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
      var pop = waterfall ? clampHalf(def, { x: bx + rnd(-20, 20), y: NET + dirD * rnd(16, 34) })
                          : clampHalf(def, { x: bx + rnd(-70, 70), y: NET + dirD * rnd(100, 170) });
      msg(waterfall ? "WATERFALL OFF THE BLOCK!" : "ONE TOUCH!");
      feed(def.side, waterfall ? "It dribbles off " + who + "'s fingers and trickles down the net — WATERFALL!"
                               : "ONE TOUCH by " + who + " — " + (def === me ? "we" : "they") + " can play it!");
      return await defensePlay(def, atk, blockPt, pop, { soft: true, waterfall: waterfall, A: A, hitterRole: hitter, setterRole: setterRole, setQ: setQ, st: st, h0: 0.6 });
    }

    // 4) past the block
    if (seam) feed(-1, A.name + " goes right through the seam of the block!");
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
    var diving = !noTouch && !o.soft && startDist > 70;
    if (!noTouch) { moveTo(def, digRole, to); if (diving) def.rush[digRole] = true; }
    var ms = o.soft ? (o.waterfall ? 600 : 700) : o.type === "tip" ? 650 : 380 - o.st.tempo * 40;
    var fo = o.soft ? (o.waterfall ? { h0: 0.6, h1: 0, peak: 0.2 } : { h0: o.h0, h1: 0, peak: 1.1 })
           : o.type === "tip" ? { h0: 1.2, h1: 0, peak: 0.6 } : { h0: o.h0, h1: 0, spin: o.superSpike ? 30 : 16 };
    var flight = flyBall(from, to, ms, fo);
    var timing;
    if (controlled) {
      await sleep(60); slow();
      timing = await timingBar((o.soft ? "PLAY THE TOUCH — " : o.type === "tip" ? "CHASE THE TIP — " : "DIG — ") + D.name + "!",
                               barSpeed(atk) * (o.soft ? 1.25 : o.type === "tip" ? 1.1 : 0.9));
      fast();
    } else timing = autoTiming(D.def);
    await flight;

    function killed(text, txtMsg) {
      o.A.st.k++; assist(atk, o.setterRole, o.hitterRole);
      msg(txtMsg); cheer();
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
    else killP = clamp01(0.3 + o.A.att / 280 + o.setQ * 0.15 + gap * 0.3 - D.def / 380 + (o.superSpike ? 0.12 : 0) +
                         (o.readWrong ? 0.08 * o.st.tempo : 0) + (o.seam ? 0.08 : 0) + (diving ? 0.08 : 0));
    if (superDig) killP -= 0.12;
    if (controlled) killP *= (1.3 - timing * 0.7);
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
    if (Math.random() < SHANK_P) {
      jump(def, digRole, 500, -3, "shank");
      await flyBall(to, { x: to.x + (to.x < W / 2 ? -1 : 1) * rnd(80, 150), y: to.y + (def.side === 0 ? 1 : -1) * rnd(50, 110) }, 460, { peak: 1.0, spin: 30 });
      o.A.st.k++; assist(atk, o.setterRole, o.hitterRole);
      msg("SHANKED!"); feed(def.side, D.name + " shanks it into the stands!");
      return credit(atk, o.hitterRole);
    }
    var dq = clamp01(timing * 0.6 + D.def / 240 - 0.1 + (superDig ? 0.15 : 0) + (o.soft ? 0.2 : 0) + (o.type === "tip" ? 0.15 : 0) - (diving ? 0.1 : 0));
    var dg = passGrade(dq);
    if (dg < 0) {
      o.A.st.k++; assist(atk, o.setterRole, o.hitterRole);
      msg("NO CONTROL!"); feed(def.side, D.name + " gets a hand on it but can't control it.");
      return credit(atk, o.hitterRole);
    }
    D.st.dig++;
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
    $("serveMe").textContent = (serving === 0 ? "● SERVING — " : "") + (me ? "ROT " + (me.rot + 1) : "");
    $("serveOpp").textContent = (opp ? "ROT " + (opp.rot + 1) : "") + (serving === 1 ? " — SERVING ●" : "");
  }

  function rosterTable(s) {
    var h = "<table class='roster'><tr><th>" + U.esc((s.team.flag || "") + " " + s.team.name) +
      "</th><th>HT</th><th>VERT</th><th>REACH</th><th>SRV</th><th>REC</th><th>SET</th><th>ATT</th><th>BLK</th><th>DEF</th></tr>";
    ROLES.forEach(function (role) {
      var r = s.roster[role];
      h += "<tr><td><img src='" + r.sprite.toDataURL() + "' alt=''/>" + role + " " + U.esc(r.name) +
        (r.skill ? " <span class='star'>★" + VB.SKILL_TXT[r.skill] + "</span>" : "") +
        "</td><td>" + r.height + "</td><td>" + r.vert + "</td><td>" + r.spikeReach + "/" + r.blockReach + "</td><td>" + r.srv + "</td><td>" + r.rec + "</td><td>" + r.set +
        "</td><td>" + r.att + "</td><td>" + r.blk + "</td><td>" + r.def + "</td></tr>";
    });
    return h + "</table>";
  }

  function lineFor(s, role) {
    var Pl = s.roster[role];
    return Object.assign({ name: Pl.name, role: role, you: s === me && mode === "role" && role === myRole }, Pl.st);
  }

  // cfg: { mine, foe, homeSide (0 = mine), mode, myRole, label, league, setsTo }
  async function playMatch(c) {
    cfg = c;
    mode = c.mode || "full"; myRole = c.myRole || null;
    var mineKit = c.mine.kit, foeKit = kitClash(c.mine.kit, c.foe.kit) ? (c.foe.kit2 && !kitClash(c.mine.kit, c.foe.kit2) ? c.foe.kit2 : "#f5f5f5") : c.foe.kit;
    var myLib = pickLiberoKit(mineKit, [foeKit]), oppLib = pickLiberoKit(foeKit, [mineKit, myLib]);
    c.mine.ovr = VB.Stats.teamOvr(c.mine); c.foe.ovr = VB.Stats.teamOvr(c.foe);
    me = makeSide(c.mine, 0, mineKit, myLib);
    opp = makeSide(c.foe, 1, foeKit, oppLib);
    var home = c.homeSide === 1 ? c.foe : c.mine, away = c.homeSide === 1 ? c.mine : c.foe;
    buildArena(home, away, c.league || "VNL");
    flowLog = []; flames = []; ball.visible = false;
    U.clearFeed();
    $("hudMe").textContent = (c.mine.flag || "") + " " + c.mine.name;
    $("hudOpp").textContent = c.foe.name + " " + (c.foe.flag || "");
    $("stageLine").textContent = c.label + (mode === "role" ? " • YOU ARE " + me.roster[myRole].name + " (" + VB.FAMILY_NAMES[VB.FAMILY[myRole]] + ")" : " • FULL TEAM") +
      " • " + (c.homeSide === 1 ? "AWAY AT " + (c.foe.short || c.foe.name) : "HOME");
    function starList(s) {
      return ROLES.filter(function (r) { return s.roster[r].skill; }).map(function (r) { return s.roster[r].name + " (" + VB.SKILL_TXT[s.roster[r].skill] + ")"; }).join(", ") || "none";
    }
    function tallest(s) { return ROLES.map(function (r) { return s.roster[r]; }).sort(function (a, b) { return b.height - a.height; })[0]; }
    feed(-1, "— " + c.mine.name + " vs " + c.foe.name + " —");
    feed(0, "Stars: " + starList(me) + ". Libero: " + me.roster.L.name + ". Tallest: " + tallest(me).name + " " + tallest(me).height + "cm.");
    feed(1, "Stars: " + starList(opp) + ". Libero: " + opp.roster.L.name + ". Tallest: " + tallest(opp).name + " " + tallest(opp).height + "cm.");
    $("rosterBox").innerHTML = "<div>" + rosterTable(me) + "</div><div>" + rosterTable(opp) + "</div>";

    score = [0, 0]; serving = Math.random() < 0.5 ? 0 : 1;
    me.rot = 0; opp.rot = 0;
    updateHud();
    var to = c.setsTo || 15;
    while (!(Math.max(score[0], score[1]) >= to && Math.abs(score[0] - score[1]) >= 2)) await rally();
    var won = score[0] > score[1];
    ball.visible = false;

    var stats = {};
    [me, opp].forEach(function (s) {
      ROLES.forEach(function (r) { stats[s.roster[r].ref.id] = Object.assign({ name: s.roster[r].name, role: r }, s.roster[r].st); });
    });
    $("endTitle").textContent = won ? "MATCH WON!" : "MATCH LOST";
    $("endScore").textContent = score[0] + " : " + score[1];
    $("endNote").textContent = c.mine.name + " vs " + c.foe.name + " — " + c.label;
    $("endSheet").innerHTML =
      VB.Stats.sheetHTML((c.mine.flag || "") + " " + c.mine.name, ROLES.map(function (r) { return lineFor(me, r); })) +
      VB.Stats.sheetHTML((c.foe.flag || "") + " " + c.foe.name, ROLES.map(function (r) { return lineFor(opp, r); }));
    await new Promise(function (res) {
      $("endScreen").classList.remove("hidden");
      $("contBtn").onclick = function () { $("endScreen").classList.add("hidden"); res(); };
    });
    return { score: score.slice(), won: won, stats: stats, flows: flowLog.slice() };
  }

  function init() {
    cv = $("court"); g = cv.getContext("2d");
    g.imageSmoothingEnabled = false;
    $("rosterBtn").addEventListener("click", function () { $("rosterBox").classList.toggle("hidden"); });
    lastFrame = performance.now();
    requestAnimationFrame(draw);
  }

  VB.Engine = { init: init, playMatch: playMatch, spriteURL: spriteURL };
})(window.VB);
