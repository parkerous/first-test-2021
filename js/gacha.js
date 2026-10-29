// Haikyuu!! gacha: earn coins from matches, pull character cards (Common → Mythic) with a spike
// reveal, and show off the collection in a showroom where your favourites roam the gym.
(function (VB) {
  "use strict";
  var U = VB.ui, $ = U.$, esc = U.esc, pick = VB.pick, rnd = VB.rnd;

  var KEY = "hqGacha", COST1 = 100, COST10 = 900, MAX_ROAM = 8, BASE_PULLS = 500;
  var RAR = {
    C: { name: "COMMON", col: "#9aa7b5", stars: 1 }, R: { name: "RARE", col: "#3d8bff", stars: 2 }, E: { name: "EPIC", col: "#a64dff", stars: 3 },
    L: { name: "LEGENDARY", col: "#ffc21e", stars: 4 }, M: { name: "MYTHIC", col: "#ff3d7f", stars: 5 }
  };
  var ORDER = ["M", "L", "E", "R", "C"];
  var RATES = { M: 0.0005, L: 0.04, E: 0.15, R: 0.3 };                 // the rest is Common

  var EPIC = ["HINATA", "KAGEYAMA", "NISHINOYA", "OIKAWA", "USHIJIMA", "ATSUMU", "KENMA", "KUROO", "BOKUTO", "SAKUSA", "HOSHIUMI"];
  var RARE = ["TANAKA", "SAWAMURA", "SUGAWARA", "AZUMANE", "TSUKISHIMA", "IWAIZUMI", "HANAMAKI", "MATSUKAWA", "KYOTANI", "SHIRABU", "GOSHIKI", "TENDO",
              "OSAMU", "SUNA", "OMIMI", "OJIRO", "TAKETORA", "YAKU", "LEV", "AKAASHI", "AONE", "FUTAKUCHI", "KOGANEGAWA", "TERUSHIMA", "DAISHO",
              "IIZUNA", "HIRUGAMI", "HAKUBA", "KIRYU", "HYAKUZAWA", "NAKASHIMA"];
  var EXTRA = { KAR: ["SUGAWARA", "YAMAGUCHI", "ENNOSHITA"], AOB: ["YAHABA", "KUNIMI"], SHI: ["SEMI"], NEK: ["SHIBAYAMA", "INUOKA"] };
  var MSBY = ["#1b1b1b", "#e8b923"], ADLERS = ["#203a6b", "#ffd21e"], XMAS = ["#c81e2a", "#ffffff"];
  // limited variants: christmas and festival (Legendary) and the whole timeskip cast (Legendary or Mythic)
  var VARIANTS = [
    { id: "XMAS-BOKUTO", base: "BOKUTO", team: "FUK", r: "L", title: "CHRISTMAS BOKUTO", kit: XMAS, ex: ["santa"] },
    { id: "XMAS-NISHINOYA", base: "NISHINOYA", team: "KAR", r: "L", title: "CHRISTMAS NISHINOYA", kit: XMAS, ex: ["santa", "streak"] },
    { id: "XMAS-HINATA", base: "HINATA", team: "KAR", r: "L", title: "CHRISTMAS HINATA", kit: ["#1f7a3a", "#ffffff"], ex: ["santa"] },
    { id: "XMAS-KENMA", base: "KENMA", team: "NEK", r: "L", title: "CHRISTMAS KENMA", kit: XMAS, ex: ["santa", "roots"] },
    { id: "FEST-OIKAWA", base: "OIKAWA", team: "AOB", r: "L", title: "FESTIVAL OIKAWA", kit: ["#3a5aa8", "#ffffff"] },
    // timeskip — Mythic
    { id: "TS-HINATA", base: "HINATA", team: "KAR", r: "M", title: "NINJA SHOYO", sub: "TIMESKIP • MSBY BLACK JACKALS", kit: MSBY, face: { style: "flat", skin: 2 } },
    { id: "TS-KAGEYAMA", base: "KAGEYAMA", team: "KAR", r: "M", title: "TIMESKIP KAGEYAMA", sub: "SCHWEIDEN ADLERS", kit: ADLERS, face: { style: "flat" } },
    { id: "TS-BOKUTO", base: "BOKUTO", team: "FUK", r: "M", title: "TIMESKIP BOKUTO", sub: "MSBY BLACK JACKALS", kit: MSBY },
    { id: "TS-OIKAWA", base: "OIKAWA", team: "AOB", r: "M", title: "TIMESKIP OIKAWA", sub: "CA SAN JUAN", kit: ["#74b7e8", "#ffffff"], face: { skin: 1 } },
    { id: "TS-USHIJIMA", base: "USHIJIMA", team: "SHI", r: "M", title: "TIMESKIP USHIJIMA", sub: "SCHWEIDEN ADLERS", kit: ADLERS },
    // timeskip — Legendary
    { id: "TS-ATSUMU", base: "ATSUMU", team: "INA", r: "L", title: "TIMESKIP ATSUMU", sub: "MSBY BLACK JACKALS", kit: MSBY },
    { id: "TS-SAKUSA", base: "SAKUSA", team: "ITC", r: "L", title: "TIMESKIP SAKUSA", sub: "MSBY BLACK JACKALS", kit: MSBY },
    { id: "TS-HOSHIUMI", base: "HOSHIUMI", team: "KAM", r: "L", title: "TIMESKIP HOSHIUMI", sub: "SCHWEIDEN ADLERS", kit: ADLERS },
    { id: "TS-KENMA", base: "KENMA", team: "NEK", r: "L", title: "TIMESKIP KENMA", sub: "CEO • BOUNCING BALL", kit: ["#d22630", "#1b1b1b"], face: { style: "long", hair: "#17120d" } },
    { id: "TS-KUROO", base: "KUROO", team: "NEK", r: "L", title: "TIMESKIP KUROO", sub: "VOLLEYBALL ASSOCIATION", kit: ["#2b2b2b", "#d22630"] },
    { id: "TS-TSUKISHIMA", base: "TSUKISHIMA", team: "KAR", r: "L", title: "TIMESKIP TSUKISHIMA", sub: "SENDAI FROGS", kit: ["#2f8f4f", "#ffffff"] },
    { id: "TS-NISHINOYA", base: "NISHINOYA", team: "KAR", r: "L", title: "TIMESKIP NISHINOYA", sub: "WORLD TRAVELLER", kit: ["#3a7ab8", "#e8d27a"], ex: ["streak", "beard"] },
    { id: "TS-AZUMANE", base: "AZUMANE", team: "KAR", r: "L", title: "TIMESKIP AZUMANE", sub: "FASHION DESIGNER", kit: ["#f0f0f0", "#2b2b2b"] },
    { id: "TS-TANAKA", base: "TANAKA", team: "KAR", r: "L", title: "TIMESKIP TANAKA", sub: "STILL FIRED UP", kit: ["#1b1b1b", "#ff7a1a"] },
    { id: "TS-SAWAMURA", base: "SAWAMURA", team: "KAR", r: "L", title: "TIMESKIP SAWAMURA", sub: "POLICE OFFICER", kit: ["#1d2b5a", "#ffd21e"] },
    { id: "TS-SUGAWARA", base: "SUGAWARA", team: "KAR", r: "L", title: "TIMESKIP SUGAWARA", sub: "SCHOOL TEACHER", kit: ["#e8e4d0", "#3a5aa8"] },
    { id: "TS-IWAIZUMI", base: "IWAIZUMI", team: "AOB", r: "L", title: "TIMESKIP IWAIZUMI", sub: "ATHLETIC TRAINER", kit: ["#1e4f9e", "#ffffff"] },
    { id: "TS-AKAASHI", base: "AKAASHI", team: "FUK", r: "L", title: "TIMESKIP AKAASHI", sub: "MANGA EDITOR", kit: ["#3a3a3a", "#ffffff"] },
    { id: "TS-OSAMU", base: "OSAMU", team: "INA", r: "L", title: "TIMESKIP OSAMU", sub: "ONIGIRI SHOP OWNER", kit: ["#f5f5f5", "#1b1b1b"], ex: ["headband"] },
    { id: "TS-YAKU", base: "YAKU", team: "NEK", r: "L", title: "TIMESKIP YAKU", sub: "PLAYING IN RUSSIA", kit: ["#d81e36", "#1e4fd8"] },
    { id: "TS-LEV", base: "LEV", team: "NEK", r: "L", title: "TIMESKIP LEV", sub: "FASHION MODEL", kit: ["#2b2b2b", "#d8d8d8"] }
  ];
  // featured pairs rotate every day (genshin-style banner with a 50/50 and a guarantee)
  var FEATURED = [["XMAS-BOKUTO", "TS-HINATA"], ["TS-SAKUSA", "TS-KAGEYAMA"], ["TS-ATSUMU", "TS-BOKUTO"], ["XMAS-KENMA", "TS-OIKAWA"],
                  ["TS-HOSHIUMI", "TS-USHIJIMA"], ["XMAS-NISHINOYA", "TS-HINATA"], ["TS-KUROO", "TS-BOKUTO"]];

  // ---------- card catalogue ----------
  var CARDS = [], BY = {};
  function teamOf(id) { return VB.HQ_TEAMS.find(function (t) { return t.id === id; }); }
  function baseFace(name, t, role) {
    var f = { skin: VB.SKINS[(t.skin && t.skin[role] != null) ? t.skin[role] : 0], hair: (t.hair && t.hair[role]) || "#17120d",
              style: (t.style && t.style[role] != null) ? t.style[role] : "flat", mouth: true };
    var L = VB.LOOKS[name];
    if (L) { if (L.skin != null) f.skin = VB.SKINS[L.skin]; if (L.hair) f.hair = L.hair; if (L.style) f.style = L.style; if (L.hair2) f.hair2 = L.hair2; if (L.ex) f.ex = L.ex.slice(); }
    return f;
  }
  function add(c) { CARDS.push(c); BY[c.id] = c; }
  function build() {
    VB.HQ_TEAMS.forEach(function (t) {
      VB.ROLES.forEach(function (r) {
        var n = (t.players || {})[r];
        if (!n) return;
        add({ id: n, name: n, team: t.id, r: EPIC.indexOf(n) >= 0 ? "E" : RARE.indexOf(n) >= 0 ? "R" : "C", face: baseFace(n, t, r), kit: [t.kit, t.kit2], pos: VB.FAMILY_NAMES[VB.FAMILY[r]] });
      });
      (EXTRA[t.id] || []).forEach(function (n) {
        add({ id: n, name: n, team: t.id, r: RARE.indexOf(n) >= 0 ? "R" : "C", face: baseFace(n, t, "OH2"), kit: [t.kit, t.kit2], pos: "RESERVE" });
      });
    });
    VARIANTS.forEach(function (v) {
      var b = BY[v.base], f = JSON.parse(JSON.stringify(b.face));
      if (v.face) { if (v.face.style) f.style = v.face.style; if (v.face.hair) { f.hair = v.face.hair; delete f.hair2; } if (v.face.skin != null) f.skin = VB.SKINS[v.face.skin]; }
      if (v.ex) f.ex = v.ex.slice();
      add({ id: v.id, name: v.title, base: v.base, team: v.team, r: v.r, face: f, kit: v.kit, pos: v.sub || "LIMITED", variant: true });
    });
  }
  function cardImg(c) { return VB.Engine.spriteURL(c.face, c.kit[0], c.kit[1], VB.Engine.kitPattern(c.team)); }

  // ---------- state ----------
  var G = null;
  function load() {
    if (G) return G;
    try { G = JSON.parse(localStorage.getItem(KEY) || "null"); } catch (e) { G = null; }
    if (!G) G = { coins: 0, owned: {}, roam: [], pity: { e: 0, l: 0, m: 0 }, guar: false, pulls: 0, gift: "" };
    if (!G.base) { G.base = 1; G.coins += BASE_PULLS * COST1; G.welcome = 1; save(); }      // 500 free pulls to start
    return G;
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(G)); } catch (e) {} }
  function today() { var d = new Date(); return d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate(); }
  function featured() { return FEATURED[Math.floor(Date.now() / 86400000) % FEATURED.length]; }

  // ---------- pulling ----------
  function rollRarity() {
    var p = G.pity;
    if (p.m >= 999) return "M";
    if (p.l >= 59) return Math.random() < 0.01 ? "M" : "L";
    var soft = p.l >= 40 ? (p.l - 39) * 0.05 : 0;                 // soft pity
    var x = Math.random();
    if (x < RATES.M) return "M";
    if (x < RATES.M + RATES.L + soft) return "L";
    if (p.e >= 9) return "E";                                      // every 10 pulls: Epic or better
    if (x < RATES.M + RATES.L + soft + RATES.E) return "E";
    if (x < RATES.M + RATES.L + soft + RATES.E + RATES.R) return "R";
    return "C";
  }
  function pullOne() {
    var r = rollRarity(), list = CARDS.filter(function (c) { return c.r === r; }), card;
    if (r === "L" || r === "M") {
      var f = featured(), feat = list.filter(function (c) { return f.indexOf(c.id) >= 0; });
      if (feat.length && (G.guar || Math.random() < 0.5)) { card = pick(feat); G.guar = false; }
      else { card = pick(list); if (feat.length && f.indexOf(card.id) < 0) G.guar = true; }
    } else card = pick(list);
    G.pity.e = "EML".indexOf(r) >= 0 ? 0 : G.pity.e + 1;
    G.pity.l = "LM".indexOf(r) >= 0 ? 0 : G.pity.l + 1;
    G.pity.m = r === "M" ? 0 : G.pity.m + 1;
    var dupe = G.owned[card.id] || 0, refund = 0;
    if (dupe >= 6) { refund = { C: 20, R: 40, E: 80, L: 200, M: 400 }[r]; G.coins += refund; }
    else G.owned[card.id] = dupe + 1;
    if (!dupe && G.roam.length < MAX_ROAM) G.roam.push(card.id);
    G.pulls++;
    return { card: card, isNew: !dupe, refund: refund };
  }
  async function doPull(n) {
    var cost = n === 10 ? COST10 : COST1 * n;
    if (G.coins < cost) { await U.modal("NOT ENOUGH COINS", "<p>You need " + cost + " 🏐 coins. Win matches in any mode to earn more!</p>"); return; }
    G.coins -= cost;
    var res = []; for (var i = 0; i < n; i++) res.push(pullOne());
    save();
    await spikeReveal(res);
    render();
  }

  // ---------- the spike reveal ----------
  function best(res) { return res.map(function (x) { return x.card.r; }).sort(function (a, b) { return ORDER.indexOf(a) - ORDER.indexOf(b); })[0]; }
  function fxColor(r, t) { return r === "M" ? "hsl(" + Math.floor(t / 4) % 360 + ",100%,60%)" : RAR[r].col; }
  function spikeReveal(res) {
    return new Promise(function (resolve) {
      var top = best(res), fx = document.createElement("div");
      fx.id = "gachaFx";
      fx.innerHTML = "<canvas width='480' height='640'></canvas><div class='gfx-cards hidden'></div>" +
        "<button class='btn gfx-skip'>SKIP ▸▸</button><button class='btn big gfx-done hidden'>CONTINUE</button>";
      document.body.appendChild(fx);
      var cv = fx.querySelector("canvas"), c = cv.getContext("2d"), t0 = performance.now(), raf = 0, shown = false;
      c.imageSmoothingEnabled = false;
      var setter = VB.Engine.makeSprite("#2b3445", { skin: "#2b3445", hair: "#2b3445", style: "flat" }, "#3a4558");
      var hitter = VB.Engine.makeSprite("#2b3445", { skin: "#2b3445", hair: "#2b3445", style: "spiky" }, "#3a4558");
      var parts = [];
      function ballAt(t) {
        if (t < 900) { var u = t / 900; return { x: 360 - u * 150, y: 380 - Math.sin(u * Math.PI) * 260 - u * 40 }; }   // the set
        if (t < 1150) return { x: 210, y: 340 - (t - 900) / 250 * 60 };
        var v = Math.min(1, (t - 1150) / 300);                                                        // the spike
        return { x: 210 - v * 110, y: 280 + v * 300 };
      }
      function frame(now) {
        var t = now - t0;
        var shake = t > 1150 && t < 1550 ? (Math.random() - 0.5) * 10 : 0;
        c.setTransform(1.15, 0, 0, 1.15, shake - 30, shake - 95);            // frame the action
        c.fillStyle = "#070a12"; c.fillRect(-10, -10, 500, 660);
        // floor + net
        c.fillStyle = "#1a2236"; c.fillRect(0, 560, 480, 80);
        c.fillStyle = "#cfd8e3"; c.fillRect(240, 330, 4, 230); c.fillRect(150, 330, 180, 6);
        for (var i = 0; i < 9; i++) { c.fillStyle = "rgba(207,216,227,0.4)"; c.fillRect(150 + i * 20, 336, 1, 40); }
        // setter tosses, hitter approaches and jumps
        c.drawImage(setter, 330, 470, 48, 64);
        var jy = t < 600 ? 0 : t < 1150 ? -Math.sin(Math.min(1, (t - 600) / 550) * Math.PI / 2) * 190 : -190 + Math.min(1, (t - 1150) / 500) * 190;
        var hx = t < 600 ? 60 + t / 600 * 110 : 170;
        if (t > 600) { c.globalAlpha = 0.35; c.fillStyle = fxColor(top, t); c.beginPath(); c.arc(hx + 24, 500 + jy + 32, 44, 0, 6.28); c.fill(); c.globalAlpha = 1; }
        c.drawImage(hitter, hx, 470 + jy, 48, 64);
        if (t > 1000 && t < 1250) { c.fillStyle = "#e9eef4"; c.fillRect(hx + 30, 450 + jy, 8, 24); }        // the swing
        // ball + rarity trail
        var bp = ballAt(Math.min(t, 1450));
        if (t > 1150 && t < 1450) {
          for (var k = 0; k < 10; k++) { var q = ballAt(t - k * 22); c.globalAlpha = 0.6 - k * 0.055; c.fillStyle = fxColor(top, t + k * 30); c.beginPath(); c.arc(q.x, q.y, 14 - k, 0, 6.28); c.fill(); }
          c.globalAlpha = 1;
        }
        if (t < 1450) {
          c.fillStyle = "#ffd21e"; c.beginPath(); c.arc(bp.x, bp.y, 10, 0, 6.28); c.fill();
          c.strokeStyle = "#1e4fd8"; c.lineWidth = 3; c.beginPath(); c.arc(bp.x, bp.y, 10, -0.6, 1.2); c.stroke();
        }
        // impact burst
        if (t > 1450 && !parts.length) for (var p = 0; p < 70; p++) parts.push({ x: 100, y: 580, vx: rnd(-7, 7), vy: rnd(-12, -2), life: rnd(0.6, 1.4) });
        if (t > 1450) {
          var a = Math.max(0, 1 - (t - 1450) / 450);
          c.globalAlpha = a; c.fillStyle = fxColor(top, t); c.fillRect(-10, -10, 500, 660); c.globalAlpha = 1;
          parts.forEach(function (pp) { pp.x += pp.vx; pp.y += pp.vy; pp.vy += 0.3; pp.life -= 0.016; if (pp.life > 0) { c.fillStyle = fxColor(top, t + pp.x * 3); c.fillRect(pp.x, pp.y, 5, 5); } });
          c.font = '20px "Press Start 2P", monospace'; c.textAlign = "center";
          c.lineWidth = 6; c.strokeStyle = "#070a12"; c.strokeText(RAR[top].name + "!", 240, 200);
          c.fillStyle = a > 0.3 ? "#ffffff" : fxColor(top, t); c.fillText(RAR[top].name + "!", 240, 200);
        }
        if (t > 2300) return showCards(true);
        raf = requestAnimationFrame(frame);
      }
      function showCards(animate) {
        if (shown) return; shown = true;
        cancelAnimationFrame(raf);
        cv.classList.add("hidden");
        var box = fx.querySelector(".gfx-cards");
        box.innerHTML = res.map(function (x, i) {
          var cd = x.card;
          return "<div class='gcard r" + cd.r + (animate ? " flip" : "") + "' style='animation-delay:" + (animate ? i * 140 : 0) + "ms'>" +
            (x.isNew ? "<span class='gnew'>NEW</span>" : "") + "<img src='" + cardImg(cd) + "' alt=''/>" +
            "<div class='gname'>" + esc(cd.name) + "</div><div class='gteam'>" + esc((teamOf(cd.team) || {}).name || "") + "</div>" +
            "<div class='grar'>" + "★".repeat(RAR[cd.r].stars) + " " + RAR[cd.r].name + "</div>" +
            (x.refund ? "<div class='gteam'>MAXED • +" + x.refund + " 🏐</div>" : "") + "</div>";
        }).join("");
        box.classList.remove("hidden");
        fx.querySelector(".gfx-skip").classList.add("hidden");
        fx.querySelector(".gfx-done").classList.remove("hidden");
      }
      fx.querySelector(".gfx-skip").onclick = function () { showCards(false); };
      fx.querySelector(".gfx-done").onclick = function () { fx.remove(); resolve(); };
      raf = requestAnimationFrame(frame);
    });
  }

  // ---------- showroom: favourites hang out in a classroom ----------
  var room = null;
  var DESK_X = [96, 226, 356, 486], DESK_Y = [200, 268, 336], DW = 58;
  function startRoom() {
    var cv = $("roomCv");
    if (!cv) return;
    var c = cv.getContext("2d"); c.imageSmoothingEnabled = false;
    var seats = [];
    DESK_Y.forEach(function (y) { DESK_X.forEach(function (x) { seats.push({ x: x + DW / 2, y: y - 4, taken: null }); }); });
    var bots = G.roam.filter(function (id) { return BY[id]; }).map(function (id, i) {
      return { id: id, card: BY[id], spr: VB.Engine.makeSprite(BY[id].kit[0], BY[id].face, BY[id].kit[1], VB.Engine.kitPattern(BY[id].team)),
               x: 70 + (i % 5) * 130, y: 165 + Math.floor(i / 5) * 200, tx: 0, ty: 0, wait: rnd(0, 2), jump: 0, face: 1, seat: null, sit: 0 };
    });
    bots.forEach(function (b) { b.tx = b.x; b.ty = b.y; });
    var last = performance.now();
    room = { cv: cv, bots: bots };
    function desk(x, y) {
      c.fillStyle = "#7a5230"; c.fillRect(x + 4, y + 14, 4, 16); c.fillRect(x + DW - 8, y + 14, 4, 16);     // legs
      c.fillStyle = "#c79a62"; c.fillRect(x, y, DW, 16); c.fillStyle = "#e0b57a"; c.fillRect(x, y, DW, 4);    // top
      c.fillStyle = "#6b6f78"; c.fillRect(x + 6, y + 16, DW - 12, 6);                                         // drawer
    }
    function room0(now) {
      // wall, chalkboard, clock, windows
      c.fillStyle = "#efe6cf"; c.fillRect(0, 0, 640, 140);
      c.fillStyle = "#c8b994"; c.fillRect(0, 132, 640, 8);
      c.fillStyle = "#6b4a2a"; c.fillRect(126, 14, 348, 98);
      c.fillStyle = "#2f5d46"; c.fillRect(132, 20, 336, 86);
      c.fillStyle = "rgba(255,255,255,0.88)"; c.textAlign = "center";
      c.font = '12px "Press Start 2P", monospace'; c.fillText("SHOWROOM", 300, 44);
      c.font = '18px "VT323", monospace';
      c.fillText("COLLECTION " + Object.keys(G.owned).length + "/" + CARDS.length + "  •  FLEX " + flex(), 300, 68);
      c.fillText("TODAY'S DUTY: " + (bots[0] ? bots[0].card.name : "nobody"), 300, 90);
      c.fillStyle = "#ffffff"; c.fillRect(150, 106, 30, 4); c.fillStyle = "#ffd21e"; c.fillRect(186, 106, 12, 4);   // chalk
      c.fillStyle = "#ffffff"; c.beginPath(); c.arc(70, 50, 22, 0, 6.28); c.fill(); c.strokeStyle = "#3a3a3a"; c.lineWidth = 3; c.stroke();
      var h = new Date(), ha = (h.getHours() % 12 + h.getMinutes() / 60) / 12 * 6.283, ma = h.getMinutes() / 60 * 6.283;
      c.lineWidth = 3; c.beginPath(); c.moveTo(70, 50); c.lineTo(70 + Math.sin(ha) * 11, 50 - Math.cos(ha) * 11); c.stroke();
      c.lineWidth = 2; c.beginPath(); c.moveTo(70, 50); c.lineTo(70 + Math.sin(ma) * 17, 50 - Math.cos(ma) * 17); c.stroke();
      for (var w = 0; w < 2; w++) {
        c.fillStyle = "#8a6a46"; c.fillRect(500 + w * 66, 16, 60, 100);
        c.fillStyle = "#bfe3ff"; c.fillRect(504 + w * 66, 20, 24, 44); c.fillRect(532 + w * 66, 20, 24, 44); c.fillRect(504 + w * 66, 68, 24, 44); c.fillRect(532 + w * 66, 68, 24, 44);
        c.fillStyle = "rgba(255,255,255,0.5)"; c.fillRect(506 + w * 66, 22, 6, 20);
      }
      // floor
      c.fillStyle = "#c9935a"; c.fillRect(0, 140, 640, 260);
      for (var y = 140; y < 400; y += 9) { c.fillStyle = "rgba(90,50,10,0.18)"; c.fillRect(0, y, 640, 1); for (var x = (y * 29) % 90; x < 640; x += 90) c.fillRect(x, y, 1, 9); }
      // teacher's desk
      c.fillStyle = "#8a5a32"; c.fillRect(262, 146, 76, 22); c.fillStyle = "#a8743f"; c.fillRect(262, 146, 76, 5);
    }
    function frame(now) {
      if (!document.body.contains(cv)) { room = null; return; }
      var dt = Math.min(0.05, (now - last) / 1000); last = now;
      room0(now);
      bots.forEach(function (b) {
        b.wait -= dt;
        var d0 = Math.hypot(b.tx - b.x, b.ty - b.y);
        if (b.sit > 0) { b.sit -= dt; if (b.sit <= 0) { b.seat.taken = null; b.seat = null; b.ty += 22; } return; }
        if (b.wait <= 0 && d0 < 2) {
          if (b.seat) { b.sit = rnd(3, 7); return; }
          var r = Math.random(), free = seats.filter(function (s) { return !s.taken; });
          if (r < 0.35 && free.length) { b.seat = pick(free); b.seat.taken = b; b.tx = b.seat.x; b.ty = b.seat.y; }
          else if (r < 0.5) { b.jump = 0.6; b.wait = rnd(0.8, 2); }
          else { b.tx = pick([60, 190, 320, 450, 580, 600]) + rnd(-8, 8); b.ty = rnd(176, 384); b.wait = rnd(0.4, 2); }
        }
        var dx = b.tx - b.x, dy = b.ty - b.y, d = Math.hypot(dx, dy);
        if (d > 1 && b.wait <= 0) { var sp = 55 * dt; b.x += dx / d * Math.min(sp, d); b.y += dy / d * Math.min(sp, d); b.face = dx < 0 ? -1 : 1; b.moving = true; }
        else b.moving = false;
      });
      // depth-sorted desks and students
      var items = [];
      DESK_Y.forEach(function (y) { DESK_X.forEach(function (x) { items.push({ y: y + 2, desk: [x, y] }); }); });
      bots.forEach(function (b) { items.push({ y: b.y, bot: b }); });
      items.sort(function (a, b) { return a.y - b.y; }).forEach(function (it) {
        if (it.desk) return desk(it.desk[0], it.desk[1]);
        var b = it.bot, hop = 0;
        if (b.jump > 0) { b.jump -= dt; hop = Math.sin((0.6 - b.jump) / 0.6 * Math.PI) * 26; }
        var walk = b.moving ? Math.abs(Math.sin(now / 90)) * 3 : 0, sitDrop = b.sit > 0 ? 10 : 0;
        var col = b.card.r === "M" ? "hsl(" + Math.floor(now / 8) % 360 + ",100%,60%)" : RAR[b.card.r].col;
        if (!b.sit) { c.globalAlpha = 0.4; c.fillStyle = col; c.beginPath(); c.ellipse(b.x, b.y + 2, 22, 7, 0, 0, 6.28); c.fill(); c.globalAlpha = 1; }
        c.save(); c.translate(b.x, b.y - hop - walk + sitDrop); c.scale(b.face, 1); c.drawImage(b.spr, -21, -56, 42, 56); c.restore();
        if (b.card.r === "M" || b.card.r === "L") {
          for (var k = 0; k < 3; k++) { var a = now / 300 + k * 2.1; c.fillStyle = col; c.fillRect(b.x + Math.cos(a) * 24, b.y - 30 - hop + Math.sin(a) * 26, 3, 3); }
        }
        if (!b.sit) {
          c.font = '14px "VT323", monospace'; c.textAlign = "center"; c.fillStyle = "rgba(10,14,22,0.7)";
          var w = c.measureText(b.card.name).width + 8; c.fillRect(b.x - w / 2, b.y + 6, w, 14);
          c.fillStyle = col; c.fillText(b.card.name, b.x, b.y + 17);
        }
      });
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
    cv.onclick = function (e) {
      var r = cv.getBoundingClientRect(), x = (e.clientX - r.left) * 640 / r.width, y = (e.clientY - r.top) * 400 / r.height;
      var hit = bots.find(function (b) { return Math.abs(b.x - x) < 24 && y > b.y - 60 && y < b.y + 18; });
      if (hit && !hit.sit) { hit.jump = 0.6; hit.wait = 1; }
    };
  }
  function flex() {
    var pts = { C: 1, R: 3, E: 10, L: 40, M: 120 };
    return Object.keys(G.owned).reduce(function (s, id) { return BY[id] ? s + pts[BY[id].r] * G.owned[id] : s; }, 0);
  }

  // ---------- screens ----------
  var tab = "pull", exitG = null, filter = "ALL";
  function render() {
    var f = featured().map(function (id) { return BY[id]; });
    var head = "<h2 class='hub-h'>HAIKYUU!! GACHA</h2>" +
      "<div class='hub-status'>🏐 " + G.coins + " COINS • " + G.pulls + " PULLS • LEGENDARY PITY " + G.pity.l + "/60 • MYTHIC PITY " + G.pity.m + "/1000</div>" +
      "<div class='tabs'>" + [["pull", "PULL"], ["room", "SHOWROOM"]].map(function (t) { return "<button class='tab-btn" + (tab === t[0] ? " on" : "") + "' data-g='tab' data-v='" + t[0] + "'>" + t[1] + "</button>"; }).join("") + "</div>";
    var body;
    if (tab === "pull") {
      body = "<div class='gbanner'><div class='gbanner-t'>LIMITED BANNER • TODAY'S FEATURED</div><div class='gfeat'>" + f.map(function (c) {
          return "<div class='gcard r" + c.r + "'><img src='" + cardImg(c) + "' alt=''/><div class='gname'>" + esc(c.name) + "</div><div class='grar'>" + "★".repeat(RAR[c.r].stars) + " " + RAR[c.r].name + "</div></div>";
        }).join("") + "</div>" +
        "<p class='muted'>Rates: Mythic 0.05% • Legendary 4% • Epic 15% • Rare 30% • Common ~51%. Every 10 pulls guarantees Epic+. Legendary guaranteed by pull 60, Mythic by pull 1000. " +
        "Won a Legendary/Mythic but not the featured one? Your next one IS featured. Featured cards change daily.</p>" +
        "<div class='hub-actions'><button class='btn big' data-g='pull' data-v='1'>PULL ×1 • " + COST1 + " 🏐</button><button class='btn big' data-g='pull' data-v='10'>PULL ×10 • " + COST10 + " 🏐</button></div>" +
        "<p class='center muted'>Every match pays: a WIN = 10 pulls (1000 🏐), a LOSS = 5 pulls (500 🏐). Story events pay too.</p></div>";
    } else {
      var owned = CARDS.filter(function (c) { return G.owned[c.id] && (filter === "ALL" || c.r === filter); })
        .sort(function (a, b) { return ORDER.indexOf(a.r) - ORDER.indexOf(b.r) || a.name.localeCompare(b.name); });
      body = "<canvas id='roomCv' class='room' width='640' height='400'></canvas>" +
        "<p class='center muted'>Up to " + MAX_ROAM + " cards hang out in the classroom (" + G.roam.length + "/" + MAX_ROAM + "). Tap a card below to send it out or back to storage.</p>" +
        "<div class='focus center-row'>" + ["ALL"].concat(ORDER).map(function (r) { return "<button class='btn" + (filter === r ? " on" : "") + "' data-g='filter' data-v='" + r + "'>" + (RAR[r] ? RAR[r].name : "ALL") + "</button>"; }).join("") + "</div>" +
        "<div class='gstore'>" + (owned.length ? owned.map(function (c) {
          var on = G.roam.indexOf(c.id) >= 0;
          return "<button class='gcard small r" + c.r + (on ? " roaming" : "") + "' data-g='roam' data-v='" + c.id + "'><img src='" + cardImg(c) + "' alt=''/>" +
            "<div class='gname'>" + esc(c.name) + "</div><div class='grar'>" + "★".repeat(RAR[c.r].stars) + (G.owned[c.id] > 1 ? " • C" + (G.owned[c.id] - 1) : "") + "</div>" +
            "<div class='gteam'>" + (on ? "ROAMING" : "IN STORAGE") + "</div></button>";
        }).join("") : "<p class='muted'>Nothing here yet — go pull!</p>") + "</div>";
    }
    $("hub").innerHTML = head + "<div class='tab-body'>" + body + "</div><div class='hub-actions'><button class='btn pink' data-g='exit'>BACK TO MENU</button></div>";
    if (tab === "room") startRoom();
  }
  async function onClick(e) {
    var b = e.target.closest("[data-g]");
    if (!b) return;
    var k = b.getAttribute("data-g"), v = b.getAttribute("data-v");
    if (k === "tab") { tab = v; return render(); }
    if (k === "filter") { filter = v; return render(); }
    if (k === "pull") return doPull(+v);
    if (k === "roam") {
      var i = G.roam.indexOf(v);
      if (i >= 0) G.roam.splice(i, 1);
      else if (G.roam.length < MAX_ROAM) G.roam.push(v);
      else { await U.modal("SHOWROOM FULL", "<p>Only " + MAX_ROAM + " cards can roam at once. Send one back to storage first.</p>"); return; }
      save(); return render();
    }
    if (k === "exit") { $("hub").onclick = null; var r = exitG; exitG = null; return r && r(); }
  }

  build();
  VB.Gacha = {
    cards: CARDS,
    coins: function () { return load().coins; },
    earn: function (n) { load(); n = Math.round(n || 0); G.coins += n; save(); return n; },
    start: function () {
      return new Promise(async function (res) {
        exitG = res; load();
        U.showView("hub");
        $("hub").onclick = onClick;
        tab = "pull"; render();
        if (G.welcome) {
          G.welcome = 0; save();
          await U.modal("WELCOME GIFT", "<p class='center big'>+" + BASE_PULLS + " PULLS</p><p class='center'>" + (BASE_PULLS * COST1) + " 🏐 coins to build your collection. Good luck!</p>");
        }
        if (G.gift !== today()) {
          G.gift = today(); G.coins += 1000; save(); render();
          await U.modal("DAILY GIFT", "<p class='center big'>+1000 🏐 (10 PULLS)</p><p class='center'>Come back tomorrow for more. Today's featured: " +
            esc(featured().map(function (id) { return BY[id].name; }).join(" & ")) + ".</p>");
        }
      });
    }
  };
})(window.VB);
