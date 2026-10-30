// Haikyuu!! gacha: earn coins from matches, pull character cards (Common → Mythic) with a spike
// reveal, and show off the collection in a showroom where your favourites roam the gym.
(function (VB) {
  "use strict";
  var U = VB.ui, $ = U.$, esc = U.esc, pick = VB.pick, rnd = VB.rnd;

  var KEY = "hqGacha", COST1 = 100, COST10 = 900, COST100 = 9000, MAX_ROAM = 8, BASE_PULLS = 500;
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
    // halloween
    { id: "HW-KENMA", base: "KENMA", team: "NEK", r: "L", title: "HALLOWEEN KENMA", sub: "LITTLE WITCH", kit: ["#5b2a86", "#ff8a1e"], ex: ["witch", "roots"] },
    { id: "HW-KUROO", base: "KUROO", team: "NEK", r: "L", title: "VAMPIRE KUROO", sub: "HALLOWEEN", kit: ["#1b1b1b", "#b0102a"], ex: ["vampire"] },
    { id: "HW-TENDO", base: "TENDO", team: "SHI", r: "L", title: "GUESS MONSTER TENDO", sub: "HALLOWEEN", kit: ["#ff8a1e", "#1b1b1b"], ex: ["pumpkin"] },
    { id: "HW-LEV", base: "LEV", team: "NEK", r: "E", title: "BLACK CAT LEV", sub: "HALLOWEEN", kit: ["#2b2b2b", "#ffd21e"], ex: ["catears"] },
    { id: "HW-TSUKISHIMA", base: "TSUKISHIMA", team: "KAR", r: "E", title: "VAMPIRE TSUKISHIMA", sub: "HALLOWEEN", kit: ["#2b1b3d", "#b0102a"], ex: ["glasses", "vampire"] },
    { id: "HW-HINATA", base: "HINATA", team: "KAR", r: "E", title: "PUMPKIN HINATA", sub: "HALLOWEEN", kit: ["#ff8a1e", "#1b1b1b"], ex: ["pumpkin"] },
    // summer
    { id: "SU-HINATA", base: "HINATA", team: "KAR", r: "L", title: "SUMMER HINATA", sub: "BEACH VOLLEY", kit: ["#2ec4d6", "#ffffff"], ex: ["strawhat", "tank"], face: { skin: 1 } },
    { id: "SU-NISHINOYA", base: "NISHINOYA", team: "KAR", r: "L", title: "SUMMER NISHINOYA", sub: "BEACH VOLLEY", kit: ["#ff6b6b", "#ffffff"], ex: ["streak", "sunglasses", "tank"] },
    { id: "SU-OIKAWA", base: "OIKAWA", team: "AOB", r: "L", title: "SUMMER OIKAWA", sub: "BEACH VOLLEY", kit: ["#7ad3ff", "#ffffff"], ex: ["sunglasses", "flower"] },
    { id: "SU-BOKUTO", base: "BOKUTO", team: "FUK", r: "E", title: "SUMMER BOKUTO", sub: "BEACH VOLLEY", kit: ["#ffd21e", "#1b1b1b"], ex: ["streak", "sunglasses", "tank"] },
    { id: "SU-TANAKA", base: "TANAKA", team: "KAR", r: "E", title: "SUMMER TANAKA", sub: "BEACH VOLLEY", kit: ["#3ac46a", "#ffffff"], ex: ["strawhat", "tank"] },
    { id: "SU-ATSUMU", base: "ATSUMU", team: "INA", r: "E", title: "SUMMER ATSUMU", sub: "BEACH VOLLEY", kit: ["#ff9ad5", "#ffffff"], ex: ["sunglasses", "tank"] },
    { id: "SU-OSAMU", base: "OSAMU", team: "INA", r: "E", title: "SUMMER OSAMU", sub: "BEACH VOLLEY", kit: ["#9ad5ff", "#ffffff"], ex: ["strawhat", "tank"] },
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
  // banners you pick yourself (genshin-style rate-up with a 50/50 and a guarantee — the guarantee carries between banners)
  var BANNERS = [
    { id: "jackals", name: "MSBY BLACK JACKALS", col: "#e8b923", bg: "#1b1b1b", feat: ["TS-HINATA", "TS-BOKUTO", "TS-ATSUMU", "TS-SAKUSA"], txt: "Timeskip: the Jackals' fearsome front row." },
    { id: "adlers", name: "SCHWEIDEN ADLERS", col: "#ffd21e", bg: "#203a6b", feat: ["TS-KAGEYAMA", "TS-USHIJIMA", "TS-HOSHIUMI"], txt: "Timeskip: the national team's core." },
    { id: "kings", name: "KING & GRAND KING", col: "#7ad3ff", bg: "#3a5aa8", feat: ["TS-OIKAWA", "TS-KAGEYAMA", "FEST-OIKAWA", "SU-OIKAWA"], txt: "Setters only. Oikawa vs Kageyama, forever." },
    { id: "nekoma", name: "NEKOMA CATS", col: "#ff4f4f", bg: "#2b1010", feat: ["TS-KENMA", "TS-KUROO", "TS-YAKU", "TS-LEV", "XMAS-KENMA", "HW-KENMA", "HW-KUROO", "HW-LEV"], txt: "Connect! The cats in every outfit." },
    { id: "xmas", name: "CHRISTMAS", col: "#ffffff", bg: "#c81e2a", feat: ["XMAS-BOKUTO", "XMAS-NISHINOYA", "XMAS-HINATA", "XMAS-KENMA"], txt: "Santa hats and snowball spikes." },
    { id: "halloween", name: "HALLOWEEN NIGHT", col: "#ff8a1e", bg: "#2b1b3d", feat: ["HW-KENMA", "HW-KUROO", "HW-TENDO", "HW-LEV", "HW-TSUKISHIMA", "HW-HINATA"], txt: "Witches, vampires and the Guess Monster." },
    { id: "summer", name: "SUMMER BEACH", col: "#ffffff", bg: "#2ec4d6", feat: ["SU-HINATA", "SU-NISHINOYA", "SU-OIKAWA", "SU-BOKUTO", "SU-TANAKA", "SU-ATSUMU", "SU-OSAMU"], txt: "Beach volley season. Sunglasses on." },
    { id: "karasuno", name: "KARASUNO FOREVER", col: "#ff7a1a", bg: "#1b1b1b", feat: ["TS-HINATA", "TS-KAGEYAMA", "TS-TSUKISHIMA", "TS-NISHINOYA", "TS-AZUMANE", "TS-TANAKA", "TS-SAWAMURA", "TS-SUGAWARA"], txt: "The crows, all grown up." },
    { id: "standard", name: "STANDARD", col: "#13293f", bg: "#e8eef7", feat: [], txt: "Every card at normal odds. No rate-up." }
  ];

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
  function banner() { return BANNERS.find(function (b) { return b.id === G.banner; }) || BANNERS[0]; }
  function featured() { return banner().feat; }
  // equipped skins: which owned version of a character shows up in matches, the practice court and the classroom
  function skinFace(name) {
    load(); var v = G.skin && G.skin[name];
    return v && BY[v] && G.owned[v] ? JSON.parse(JSON.stringify(BY[v].face)) : null;
  }
  VB.skinFace = skinFace;

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
    if (!dupe) { G.recent = [card.id].concat((G.recent || []).filter(function (x) { return x !== card.id; })).slice(0, 20); }
    G.pulls++;
    return { card: card, isNew: !dupe, refund: refund };
  }
  async function doPull(n) {
    var cost = n === 100 ? COST100 : n === 10 ? COST10 : COST1 * n;
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
        var big = res.length > 10, list = big ? res.slice().sort(function (a, b) { return ORDER.indexOf(a.card.r) - ORDER.indexOf(b.card.r) || (b.isNew - a.isNew); }) : res;
        var tally = {}; res.forEach(function (x) { tally[x.card.r] = (tally[x.card.r] || 0) + 1; });
        var head = big ? "<div class='gtally'>" + ORDER.map(function (r) { return "<span class='r" + r + "'>" + RAR[r].name + " ×" + (tally[r] || 0) + "</span>"; }).join("") +
          " <span>NEW ×" + res.filter(function (x) { return x.isNew; }).length + "</span></div>" : "";
        box.innerHTML = head + list.map(function (x, i) {
          var cd = x.card;
          if (big) return "<div class='gcard mini r" + cd.r + (animate && i < 12 ? " flip" : "") + "' style='animation-delay:" + (animate && i < 12 ? i * 90 : 0) + "ms'>" +
            (x.isNew ? "<span class='gnew'>NEW</span>" : "") + "<img src='" + cardImg(cd) + "' alt=''/><div class='gname'>" + esc(cd.name) + "</div></div>";
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
  var LINES = { BOKUTO: "HEY HEY HEY!", HINATA: "BWAH! I can jump!", KAGEYAMA: "Toss... I need to toss.", NISHINOYA: "ROLLING THUNDER!", TANAKA: "OSSU!!",
                OIKAWA: "Peace peace~", KENMA: "...one more level.", KUROO: "Let's get fired up.", ATSUMU: "Nice serve, me.", OSAMU: "I'm hungry.",
                USHIJIMA: "I'll hit it.", TSUKISHIMA: "It's just a club.", SAWAMURA: "Eat up, everyone.", SUGAWARA: "Don't mind!", AZUMANE: "Ah, sorry, sorry!",
                IWAIZUMI: "Oikawa, focus!", HOSHIUMI: "I can fly too!", SAKUSA: "Keep your distance.", AKAASHI: "Bokuto-san...", TENDO: "Guess block~",
                LEV: "I'm the ace!", YAKU: "LEV! Receive practice!", TAKETORA: "YEAAAH!", TERUSHIMA: "Party time!", AONE: "...", KOGANEGAWA: "Senpai!!" };
  var WORDS = ["FLY HIGH", "SPIKE!", "NO SLEEP", "VOLLEY ♥", "TEST TMRW", "PRACTICE 4PM", "RECEIVE!!", "1-2-3 GO", "NATIONALS", "MEAT BUNS"];
  var ACTIONS = [["cheer", "SAY HI"], ["pass", "PASS"], ["spike", "SPIKE"], ["sweep", "SWEEP"], ["write", "WHITEBOARD"], ["read", "READ"], ["nap", "NAP"], ["dance", "DANCE"], ["chat", "CHAT"], ["sit", "SIT"]];
  function startRoom() {
    var cv = $("roomCv");
    if (!cv) return;
    var c = cv.getContext("2d"); c.imageSmoothingEnabled = false;
    var clock = 0, seats = [], fx = [], flying = [];
    DESK_Y.forEach(function (y) { DESK_X.forEach(function (x) { seats.push({ x: x + DW / 2, y: y - 4, taken: null }); }); });
    var broom = { x: 480, y: 156, holder: null }, board = { lines: ["SHOWROOM"], user: null }, CART = { x: 44, y: 182 };
    var bots = G.roam.filter(function (id) { return BY[id]; }).map(function (id, i) {
      var cd = BY[id];
      return { id: id, card: cd, line: LINES[cd.base || cd.id] || null, spr: VB.Engine.makeSprite(cd.kit[0], (!cd.variant && skinFace(cd.id)) || cd.face, cd.kit[1], VB.Engine.kitPattern(cd.team)),
               x: 120 + (i % 4) * 130, y: 190 + Math.floor(i / 4) * 175, tx: 0, ty: 0, wait: rnd(0.5, 3), jump: 0, face: 1, act: null, bubble: null, hold: null, sit: 0, seat: null };
    });
    bots.forEach(function (b) { b.tx = b.x; b.ty = b.y; });
    var last = performance.now();
    function go(b, x, y) { b.tx = x; b.ty = y; }
    function at(b) { return Math.hypot(b.tx - b.x, b.ty - b.y) < 2; }
    function say(b, t, sec) { b.bubble = { text: t, until: clock + (sec || 2) }; }
    function idle(x) { return !x.act || x.act.type === "walk"; }
    function standUp(b) { if (b.seat) { b.seat.taken = null; b.seat = null; if (b.sit) { b.y += 20; b.ty = b.y; } } b.sit = 0; }
    function cancel(b) {
      var a = b.act; if (!a) return;
      if (broom.holder === b) { broom.holder = null; }
      if (board.user === b) board.user = null;
      if (a.mate && a.mate.act && a.mate.act.lead === b) a.mate.act = null;
      if (a.lead && a.lead.act && a.lead.act.mate === b) a.lead.act = null;
      b.hold = null; standUp(b); b.act = null;
    }
    function freeSeat() { var f = seats.filter(function (s) { return !s.taken; }); return f.length ? pick(f) : null; }
    function partnerFor(b) {
      var c2 = bots.filter(function (x) { return x !== b && idle(x) && !x.sit; });
      return c2.sort(function (p, q) { return Math.hypot(p.x - b.x, p.y - b.y) - Math.hypot(q.x - b.x, q.y - b.y); })[0] || null;
    }
    function start(b, type) {
      cancel(b);
      var a = { type: type, ph: 0, t: 0 };
      if (type === "sit" || type === "nap" || type === "read") { var s = freeSeat(); if (!s) return start(b, "cheer"); s.taken = b; b.seat = s; go(b, s.x, s.y); }
      else if (type === "sweep") { if (broom.holder) return start(b, "cheer"); broom.holder = b; go(b, broom.x - 10, 172); }
      else if (type === "write") { if (board.user) return start(b, "cheer"); board.user = b; go(b, 66, 168); a.word = pick(WORDS); a.n = 0; }
      else if (type === "spike") go(b, CART.x + 34, CART.y + 10);
      else if (type === "pass" || type === "chat") {
        var m = partnerFor(b); if (!m) return start(b, "cheer");
        cancel(m); a.mate = m; m.act = { type: type + "mate", lead: b };
        if (type === "pass") { var x0 = rnd(110, 400), y0 = pick([180, 236, 304, 372]); go(b, x0, y0); go(m, x0 + 140, y0); }
        else { go(b, m.x - 38, m.y); m.tx = m.x; m.ty = m.y; }
      }
      else if (type === "walk") go(b, pick([60, 190, 320, 450, 580]) + rnd(-8, 8), rnd(176, 384));
      else if (type === "cheer") { b.jump = 0.6; say(b, b.line || pick(["NICE!", "DON'T MIND!", "ONE MORE!", "LET'S GO!"]), 2.6); a.t = 2.6; a.ph = 1; }
      else if (type === "dance") { a.t = 4; a.ph = 1; say(b, "♪ ♫ ♪", 4); }
      b.act = a;
    }
    function update(b, dt) {
      var a = b.act;
      if (!a) {
        b.wait -= dt;
        if (b.wait <= 0) {
          var r = Math.random();
          start(b, r < 0.35 ? "walk" : r < 0.43 ? "sit" : r < 0.5 ? "nap" : r < 0.56 ? "read" : r < 0.63 ? "sweep" : r < 0.7 ? "write" :
                   r < 0.78 ? "pass" : r < 0.85 ? "spike" : r < 0.9 ? "dance" : r < 0.95 ? "cheer" : "chat");
          b.wait = rnd(0.5, 2.5);
        }
        return;
      }
      if (a.type === "passmate" || a.type === "chatmate") return;          // the lead runs the show
      var arrived = at(b);
      if (a.type === "walk") { if (arrived) b.act = null; return; }
      if (a.type === "sit" || a.type === "nap" || a.type === "read") {
        if (a.ph === 0 && arrived) { a.ph = 1; b.sit = 1; a.t = a.type === "sit" ? rnd(3, 6) : rnd(6, 10); if (a.type === "read") b.hold = "book"; }
        if (a.ph === 1) { a.t -= dt; if (a.type === "nap" && Math.random() < dt * 1.2) fx.push({ k: "z", x: b.x + 10, y: b.y - 50, t: 0 }); if (a.t <= 0) { cancel(b); b.wait = rnd(0.5, 2); } }
        return;
      }
      if (a.type === "sweep") {
        if (a.ph === 0 && arrived) { a.ph = 1; a.t = 7; b.hold = "broom"; a.nx = 0; }
        else if (a.ph === 1) {
          a.t -= dt; a.nx -= dt;
          if (a.nx <= 0) { a.nx = 1.3; go(b, rnd(40, 600), pick([180, 236, 304, 372]) + rnd(-6, 6)); }
          if (b.moving && Math.random() < dt * 9) fx.push({ k: "dust", x: b.x + 18 * b.face, y: b.y, t: 0 });
          if (a.t <= 0) { a.ph = 2; go(b, broom.x - 10, 172); }
        } else if (a.ph === 2 && arrived) { b.hold = null; broom.holder = null; b.act = null; say(b, "All clean!", 1.5); }
        return;
      }
      if (a.type === "write") {
        if (a.ph === 0 && arrived) { a.ph = 1; a.t = 0; board.lines.push(""); if (board.lines.length > 4) board.lines.shift(); }
        else if (a.ph === 1) {
          a.t += dt;
          if (a.t > 0.14 && a.n < a.word.length) { a.t = 0; a.n++; board.lines[board.lines.length - 1] = a.word.slice(0, a.n); }
          if (a.n >= a.word.length && a.t > 1) { board.user = null; b.act = null; say(b, "Done!", 1.2); }
        }
        return;
      }
      if (a.type === "spike") {
        if (a.ph === 0 && arrived) { a.ph = 1; a.t = 0.7; b.hold = "ball"; say(b, "TOSS!", 0.8); }
        else if (a.ph === 1) { a.t -= dt; if (a.t <= 0) { a.ph = 2; a.t = 1.2; b.jump = 0.6; } }
        else if (a.ph === 2) {
          a.t -= dt;
          if (b.hold && a.t < 0.95) {
            b.hold = null; say(b, "SPIKE!!", 1.2);
            flying.push({ x: b.x, y: b.y - 92, tx: rnd(200, 610), ty: rnd(180, 380), t: 0 });
          }
          if (a.t <= 0) b.act = null;
        }
        return;
      }
      if (a.type === "pass" || a.type === "chat") {
        var m = a.mate;
        if (!m || !m.act || m.act.lead !== b) { b.act = null; return; }
        if (a.ph === 0 && arrived && at(m)) { a.ph = 1; a.t = a.type === "pass" ? 7 : 4.5; b.face = m.x > b.x ? 1 : -1; m.face = -b.face; a.hop = -1; }
        if (a.ph === 1) {
          a.t -= dt;
          var hop = Math.floor(clock * 1.1);
          if (hop !== a.hop) {
            a.hop = hop;
            var who = hop % 2 ? m : b;
            if (a.type === "pass") say(who, pick(["BUMP!", "SET!", "NICE!", "MINE!"]), 0.8);
            else say(who, pick(["...", "Did you see that?", "Ramen later?", "Practice was rough.", "Nationals!", "Hahaha!"]), 1.1);
          }
          if (a.t <= 0) { m.act = null; b.act = null; m.wait = rnd(0.5, 2); }
        }
        return;
      }
      if (a.type === "cheer" || a.type === "dance") {
        a.t -= dt;
        if (a.type === "dance") { if (Math.floor(clock * 4) !== a.f) { a.f = Math.floor(clock * 4); b.face *= -1; if (a.f % 2) b.jump = Math.max(b.jump, 0.3); } if (Math.random() < dt * 3) fx.push({ k: "note", x: b.x + rnd(-16, 16), y: b.y - 60, t: 0 }); }
        if (a.t <= 0) b.act = null;
      }
    }
    var R0 = room = {
      cv: cv, bots: bots, sel: null,
      cmd: function (type) { if (R0.sel) { start(R0.sel, type); R0.sel.wait = 2; } }
    };

    function desk(x, y) {
      c.fillStyle = "#7a5230"; c.fillRect(x + 4, y + 14, 4, 16); c.fillRect(x + DW - 8, y + 14, 4, 16);
      c.fillStyle = "#c79a62"; c.fillRect(x, y, DW, 16); c.fillStyle = "#e0b57a"; c.fillRect(x, y, DW, 4);
      c.fillStyle = "#6b6f78"; c.fillRect(x + 6, y + 16, DW - 12, 6);
    }
    function vball(x, y, r) {
      c.fillStyle = "#ffd21e"; c.beginPath(); c.arc(x, y, r, 0, 6.28); c.fill();
      c.strokeStyle = "#1e4fd8"; c.lineWidth = Math.max(1, r / 3); c.beginPath(); c.arc(x, y, r * 0.75, -0.6, 1.2); c.stroke();
    }
    function bubble(x, y, t) {
      c.font = '15px "VT323", monospace'; c.textAlign = "center"; c.textBaseline = "middle";
      var w = c.measureText(t).width + 12;
      c.fillStyle = "#ffffff"; c.fillRect(x - w / 2, y - 10, w, 18); c.fillRect(x - 3, y + 8, 6, 4);
      c.strokeStyle = "#2b3445"; c.lineWidth = 1; c.strokeRect(x - w / 2 + 0.5, y - 9.5, w - 1, 17);
      c.fillStyle = "#13293f"; c.fillText(t, x, y);
    }
    function scene() {
      c.fillStyle = "#efe6cf"; c.fillRect(0, 0, 640, 140);
      c.fillStyle = "#c8b994"; c.fillRect(0, 132, 640, 8);
      // whiteboard with student scribbles
      c.fillStyle = "#9aa3ad"; c.fillRect(8, 22, 116, 92); c.fillStyle = "#ffffff"; c.fillRect(12, 26, 108, 80);
      c.fillStyle = "#9aa3ad"; c.fillRect(14, 106, 104, 5); c.fillStyle = "#e0348a"; c.fillRect(30, 103, 12, 3); c.fillStyle = "#1e63ff"; c.fillRect(48, 103, 12, 3);
      c.font = '15px "VT323", monospace'; c.textAlign = "left"; c.textBaseline = "middle";
      board.lines.forEach(function (l, i) { c.fillStyle = ["#1e63ff", "#e0348a", "#0e9e45", "#13293f"][i % 4]; c.fillText(l, 16, 36 + i * 18, 100); });
      // chalkboard
      c.fillStyle = "#6b4a2a"; c.fillRect(140, 14, 320, 98); c.fillStyle = "#2f5d46"; c.fillRect(146, 20, 308, 86);
      c.fillStyle = "rgba(255,255,255,0.88)"; c.textAlign = "center";
      c.font = '12px "Press Start 2P", monospace'; c.fillText("SHOWROOM", 300, 40);
      c.font = '18px "VT323", monospace';
      c.fillText("COLLECTION " + Object.keys(G.owned).length + "/" + CARDS.length + "  •  FLEX " + flex(), 300, 64);
      c.fillText("ON DUTY: " + (bots[0] ? bots[0].card.name : "nobody"), 300, 86);
      c.fillStyle = "#ffffff"; c.fillRect(160, 106, 30, 4); c.fillStyle = "#ffd21e"; c.fillRect(196, 106, 12, 4);
      // clock
      c.fillStyle = "#ffffff"; c.beginPath(); c.arc(494, 44, 20, 0, 6.28); c.fill(); c.strokeStyle = "#3a3a3a"; c.lineWidth = 3; c.stroke();
      var h = new Date(), ha = (h.getHours() % 12 + h.getMinutes() / 60) / 12 * 6.283, ma = h.getMinutes() / 60 * 6.283;
      c.beginPath(); c.moveTo(494, 44); c.lineTo(494 + Math.sin(ha) * 10, 44 - Math.cos(ha) * 10); c.stroke();
      c.lineWidth = 2; c.beginPath(); c.moveTo(494, 44); c.lineTo(494 + Math.sin(ma) * 15, 44 - Math.cos(ma) * 15); c.stroke();
      // window
      c.fillStyle = "#8a6a46"; c.fillRect(530, 16, 100, 100);
      c.fillStyle = "#bfe3ff"; c.fillRect(534, 20, 44, 44); c.fillRect(582, 20, 44, 44); c.fillRect(534, 68, 44, 44); c.fillRect(582, 68, 44, 44);
      c.fillStyle = "rgba(255,255,255,0.5)"; c.fillRect(538, 24, 8, 20);
      // floor
      c.fillStyle = "#c9935a"; c.fillRect(0, 140, 640, 260);
      for (var y = 140; y < 400; y += 9) { c.fillStyle = "rgba(90,50,10,0.18)"; c.fillRect(0, y, 640, 1); for (var x = (y * 29) % 90; x < 640; x += 90) c.fillRect(x, y, 1, 9); }
      // teacher's desk, plant, bin
      c.fillStyle = "#8a5a32"; c.fillRect(262, 146, 76, 22); c.fillStyle = "#a8743f"; c.fillRect(262, 146, 76, 5);
      c.fillStyle = "#b5562a"; c.fillRect(604, 150, 22, 18); c.fillStyle = "#2f8a4a"; c.beginPath(); c.arc(615, 140, 14, 0, 6.28); c.fill(); c.fillStyle = "#3fae5e"; c.beginPath(); c.arc(608, 134, 8, 0, 6.28); c.fill();
      c.fillStyle = "#6b7684"; c.fillRect(578, 152, 16, 18); c.fillStyle = "#56606d"; c.fillRect(576, 150, 20, 4);
      // ball cart
      c.fillStyle = "#8f9aa6"; c.fillRect(CART.x - 22, CART.y - 22, 44, 3); c.fillRect(CART.x - 22, CART.y - 22, 3, 26); c.fillRect(CART.x + 19, CART.y - 22, 3, 26); c.fillRect(CART.x - 22, CART.y + 2, 44, 3);
      vball(CART.x - 10, CART.y - 12, 8); vball(CART.x + 8, CART.y - 10, 8); vball(CART.x - 1, CART.y - 22, 8);
      c.fillStyle = "#3a3f4a"; c.fillRect(CART.x - 20, CART.y + 6, 4, 4); c.fillRect(CART.x + 16, CART.y + 6, 4, 4);
      // broom resting against the wall
      if (!broom.holder) {
        c.strokeStyle = "#8a5a32"; c.lineWidth = 3; c.beginPath(); c.moveTo(broom.x, 100); c.lineTo(broom.x + 6, broom.y - 10); c.stroke();
        c.fillStyle = "#d9b44a"; c.fillRect(broom.x - 2, broom.y - 12, 16, 12); c.fillStyle = "#b8922e"; for (var k = 0; k < 4; k++) c.fillRect(broom.x + k * 4, broom.y - 12, 1, 12);
      }
    }
    function drawBot(b, dt) {
      var hop = 0;
      if (b.jump > 0) { b.jump -= dt; hop = Math.sin((0.6 - Math.max(0, b.jump)) / 0.6 * Math.PI) * 26; }
      var walk = b.moving ? Math.abs(Math.sin(clock * 11)) * 3 : 0, sitDrop = b.sit ? 10 : 0;
      var col = b.card.r === "M" ? "hsl(" + Math.floor(clock * 120) % 360 + ",100%,60%)" : RAR[b.card.r].col;
      if (!b.sit) { c.globalAlpha = 0.4; c.fillStyle = col; c.beginPath(); c.ellipse(b.x, b.y + 2, 22, 7, 0, 0, 6.28); c.fill(); c.globalAlpha = 1; }
      if (R0.sel === b) { c.strokeStyle = "#ffffff"; c.lineWidth = 2; c.setLineDash([4, 3]); c.beginPath(); c.ellipse(b.x, b.y + 2, 27, 9, 0, 0, 6.28); c.stroke(); c.setLineDash([]); }
      var top = b.y - hop - walk + sitDrop;
      c.save(); c.translate(b.x, top); c.scale(b.face, 1); c.drawImage(b.spr, -21, -56, 42, 56); c.restore();
      if (b.hold === "broom") {
        var sw = Math.sin(clock * 9) * 7;
        c.strokeStyle = "#8a5a32"; c.lineWidth = 3; c.beginPath(); c.moveTo(b.x + 12 * b.face, top - 30); c.lineTo(b.x + (24 * b.face) + sw, top + 2); c.stroke();
        c.fillStyle = "#d9b44a"; c.fillRect(b.x + 24 * b.face + sw - 8, top - 2, 16, 8);
      }
      if (b.hold === "book") { c.fillStyle = "#e0348a"; c.fillRect(b.x - 10, top - 30, 20, 13); c.fillStyle = "#ffffff"; c.fillRect(b.x - 1, top - 30, 2, 13); }
      if (b.hold === "ball") vball(b.x, top - 66 - Math.sin(clock * 6) * 4, 7);
      if (b.card.r === "M" || b.card.r === "L") {
        for (var k = 0; k < 3; k++) { var an = clock * 3.3 + k * 2.1; c.fillStyle = col; c.fillRect(b.x + Math.cos(an) * 24, top - 30 + Math.sin(an) * 26, 3, 3); }
      }
      if (!b.sit) {
        c.font = '14px "VT323", monospace'; c.textAlign = "center"; c.textBaseline = "alphabetic"; c.fillStyle = "rgba(10,14,22,0.7)";
        var w = c.measureText(b.card.name).width + 8; c.fillRect(b.x - w / 2, b.y + 6, w, 14);
        c.fillStyle = col; c.fillText(b.card.name, b.x, b.y + 17);
      }
    }
    function frame(now) {
      if (!document.body.contains(cv)) { if (room === R0) room = null; return; }     // an old room stops; never clear the new one
      var dt = Math.min(0.05, (now - last) / 1000); last = now; clock += dt;
      bots.forEach(function (b) {
        update(b, dt);
        var dx = b.tx - b.x, dy = b.ty - b.y, d = Math.hypot(dx, dy);
        if (d > 1 && !b.sit) { var sp = (b.hold === "broom" ? 38 : 60) * dt; b.x += dx / d * Math.min(sp, d); b.y += dy / d * Math.min(sp, d); if (Math.abs(dx) > 1) b.face = dx < 0 ? -1 : 1; b.moving = true; }
        else b.moving = false;
      });
      scene();
      var items = [];
      DESK_Y.forEach(function (y) { DESK_X.forEach(function (x) { items.push({ y: y + 2, desk: [x, y] }); }); });
      bots.forEach(function (b) { items.push({ y: b.y, bot: b }); });
      items.sort(function (p, q) { return p.y - q.y; }).forEach(function (it) { if (it.desk) desk(it.desk[0], it.desk[1]); else drawBot(it.bot, dt); });
      // passing drills: the ball arcs between partners
      bots.forEach(function (b) {
        var a = b.act;
        if (a && a.type === "pass" && a.ph === 1 && a.mate) {
          var u = (clock * 1.1) % 1, fwd = Math.floor(clock * 1.1) % 2 === 0, p = fwd ? b : a.mate, q = fwd ? a.mate : b;
          vball(p.x + (q.x - p.x) * u, p.y - 40 + (q.y - p.y) * u - Math.sin(u * Math.PI) * 70, 6);
        }
      });
      // spiked balls fly, bounce and roll back to the cart
      flying = flying.filter(function (f) {
        f.t += dt;
        var x, y;
        if (f.t < 0.3) { var u = f.t / 0.3; x = f.x + (f.tx - f.x) * u; y = f.y + (f.ty - f.y) * u; }
        else if (f.t < 0.9) { var v = (f.t - 0.3) / 0.6; x = f.tx + v * 30; y = f.ty - Math.sin(v * Math.PI) * 40; if (f.t < 0.34) fx.push({ k: "pow", x: f.tx, y: f.ty, t: 0 }); }
        else { var w2 = Math.min(1, (f.t - 0.9) / 2.2); x = f.tx + 30 + (CART.x - f.tx - 30) * w2; y = f.ty + (CART.y - f.ty) * w2; }
        vball(x, y, 6);
        return f.t < 3.1;
      });
      // little effects: dust, zzz, notes, impact
      fx = fx.filter(function (e) {
        e.t += dt;
        c.textAlign = "center";
        if (e.k === "dust") { c.fillStyle = "rgba(160,140,110," + (0.6 - e.t) + ")"; c.beginPath(); c.arc(e.x, e.y - e.t * 10, 3 + e.t * 8, 0, 6.28); c.fill(); return e.t < 0.6; }
        if (e.k === "z") { c.fillStyle = "rgba(60,80,140," + (1 - e.t / 2) + ")"; c.font = '14px "Press Start 2P", monospace'; c.fillText("z", e.x + e.t * 8, e.y - e.t * 22); return e.t < 2; }
        if (e.k === "note") { c.fillStyle = "rgba(224,52,138," + (1 - e.t / 1.5) + ")"; c.font = '18px "VT323", monospace'; c.fillText("♪", e.x, e.y - e.t * 26); return e.t < 1.5; }
        if (e.k === "pow") { c.strokeStyle = "rgba(255,210,30," + (1 - e.t * 3) + ")"; c.lineWidth = 3; c.beginPath(); c.arc(e.x, e.y, 6 + e.t * 50, 0, 6.28); c.stroke(); return e.t < 0.33; }
        return false;
      });
      bots.forEach(function (b) {
        if (b.bubble && clock < b.bubble.until) bubble(b.x, b.y - (b.sit ? 56 : 74) - (b.jump > 0 ? 20 : 0), b.bubble.text);
        if (b.act && b.act.type === "nap" && b.act.ph === 1 && !b.bubble) { /* zzz handled by effects */ }
      });
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
    cv.onclick = function (e) {
      var r = cv.getBoundingClientRect(), x = (e.clientX - r.left) * 640 / r.width, y = (e.clientY - r.top) * 400 / r.height;
      var hit = bots.find(function (b) { return Math.abs(b.x - x) < 24 && y > b.y - 60 && y < b.y + 18; });
      R0.sel = hit || null;
      var lab = $("roomSel");
      if (lab) lab.textContent = hit ? "SELECTED: " + hit.card.name + " — pick an action" : "Tap a student in the classroom, then pick an action.";
      document.querySelectorAll("[data-g=act]").forEach(function (btn) { btn.disabled = !hit; });
      if (hit) { hit.jump = 0.5; say(hit, "Hm?", 0.8); }
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
      "<div class='tabs'>" + [["pull", "PULL"], ["room", "SHOWROOM"], ["skins", "SKINS"]].map(function (t) { return "<button class='tab-btn" + (tab === t[0] ? " on" : "") + "' data-g='tab' data-v='" + t[0] + "'>" + t[1] + "</button>"; }).join("") + "</div>";
    var body;
    if (tab === "pull") {
      var bn = banner();
      body = "<div class='bpick'>" + BANNERS.map(function (b) {
          return "<button class='bpick-b" + (b.id === bn.id ? " on" : "") + "' data-g='banner' data-v='" + b.id + "' style='background:" + b.bg + ";color:" + b.col + "'>" + esc(b.name) + "</button>"; }).join("") + "</div>" +
        "<div class='gbanner' style='border-color:" + bn.bg + "'><div class='gbanner-t' style='background:" + bn.bg + ";color:" + bn.col + "'>" + esc(bn.name) + " BANNER</div><p class='center'>" + esc(bn.txt) + "</p><div class='gfeat'>" + f.map(function (c) {
          return "<div class='gcard r" + c.r + "'><img src='" + cardImg(c) + "' alt=''/><div class='gname'>" + esc(c.name) + "</div><div class='grar'>" + "★".repeat(RAR[c.r].stars) + " " + RAR[c.r].name + "</div></div>";
        }).join("") + "</div>" +
        "<p class='muted'>Rates: Mythic 0.05% • Legendary 4% • Epic 15% • Rare 30% • Common ~51%. Every 10 pulls guarantees Epic+. Legendary guaranteed by pull 60, Mythic by pull 1000. " +
        (f.length ? "Won a Legendary/Mythic but not a featured one? Your next one IS featured. " : "") + "Pick any banner above — switch whenever you like; pity carries over.</p>" +
        "<div class='hub-actions'><button class='btn big' data-g='pull' data-v='1'>PULL ×1 • " + COST1 + " 🏐</button><button class='btn big' data-g='pull' data-v='10'>PULL ×10 • " + COST10 + " 🏐</button><button class='btn big' data-g='pull' data-v='100'>PULL ×100 • " + COST100 + " 🏐</button></div>" +
        "<p class='center muted'>Every match pays: a WIN = 10 pulls (1000 🏐), a LOSS = 5 pulls (500 🏐). Story events pay too.</p></div>";
    } else if (tab === "skins") {
      var bases = {};
      CARDS.forEach(function (c) { if (c.variant && G.owned[c.id]) (bases[c.base] = bases[c.base] || []).push(c); });
      var names = Object.keys(bases).sort();
      body = "<p class='center'>Own a special version of a character? Pick which one shows up in Haikyuu!! matches, story mode, the practice court and the classroom.</p>" +
        (names.length ? names.map(function (n) {
          var cur = (G.skin || {})[n], opts = [BY[n]].concat(bases[n]);
          return "<div class='skinrow'><div class='pname'>" + esc(n) + "</div><div class='gfeat'>" + opts.map(function (c) {
            var on = c.id === n ? !cur || !G.owned[cur] : cur === c.id;
            return "<button class='gcard small r" + c.r + (on ? " roaming" : "") + "' data-g='skin' data-v='" + n + "|" + c.id + "'><img src='" + cardImg(c) + "' alt=''/>" +
              "<div class='gname'>" + esc(c.id === n ? "DEFAULT" : c.name) + "</div><div class='gteam'>" + (on ? "✔ EQUIPPED" : "EQUIP") + "</div></button>";
          }).join("") + "</div></div>";
        }).join("") : "<p class='center muted'>No special versions yet — pull a Christmas, Halloween, Summer or Timeskip card to unlock skins.</p>");
    } else {
      var owned = CARDS.filter(function (c) { return G.owned[c.id] && (filter === "ALL" || c.r === filter); })
        .sort(function (a, b) { return ORDER.indexOf(a.r) - ORDER.indexOf(b.r) || a.name.localeCompare(b.name); });
      body = "<canvas id='roomCv' class='room' width='640' height='400'></canvas>" +
        "<p class='center' id='roomSel'>Tap a student in the classroom, then pick an action.</p>" +
        "<div class='focus center-row'>" + ACTIONS.map(function (a) { return "<button class='btn' data-g='act' data-v='" + a[0] + "' disabled>" + a[1] + "</button>"; }).join("") + "</div>" +
        "<p class='center muted'>Up to " + MAX_ROAM + " cards hang out in the classroom (" + G.roam.length + "/" + MAX_ROAM + "). Tap a card below to send it in or out — when the room is full it swaps with the student you selected (or the one who's been there longest).</p>" +
        "<div class='focus center-row'><button class='btn' data-g='quick' data-v='best'>BEST " + MAX_ROAM + "</button><button class='btn' data-g='quick' data-v='new'>NEWEST " + MAX_ROAM + "</button>" +
        "<button class='btn' data-g='quick' data-v='random'>RANDOM " + MAX_ROAM + "</button><button class='btn pink' data-g='quick' data-v='clear'>EMPTY ROOM</button></div>" +
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
    if (k === "banner") { G.banner = v; save(); return render(); }
    if (k === "skin") {
      var pr = v.split("|"); G.skin = G.skin || {};
      if (pr[1] === pr[0]) delete G.skin[pr[0]]; else G.skin[pr[0]] = pr[1];
      save(); return render();
    }
    if (k === "pull") return doPull(+v);
    if (k === "act") { if (room) room.cmd(v); return; }
    if (k === "roam") {
      var i = G.roam.indexOf(v);
      if (i >= 0) G.roam.splice(i, 1);
      else if (G.roam.length < MAX_ROAM) G.roam.push(v);
      else {                                                     // full: swap with the selected student, or the longest-staying one
        var out = room && room.sel ? room.sel.id : G.roam[0], j = G.roam.indexOf(out);
        G.roam.splice(j < 0 ? 0 : j, 1); G.roam.push(v);
      }
      save(); return render();
    }
    if (k === "quick") {
      var have = CARDS.filter(function (c) { return G.owned[c.id]; });
      if (v === "clear") G.roam = [];
      else if (v === "best") G.roam = have.slice().sort(function (a, b) { return ORDER.indexOf(a.r) - ORDER.indexOf(b.r) || G.owned[b.id] - G.owned[a.id]; }).slice(0, MAX_ROAM).map(function (c) { return c.id; });
      else if (v === "new") G.roam = (G.recent || []).filter(function (id) { return G.owned[id]; }).slice(0, MAX_ROAM);
      else G.roam = VB.shuffle(have.slice()).slice(0, MAX_ROAM).map(function (c) { return c.id; });
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
          await U.modal("DAILY GIFT", "<p class='center big'>+1000 🏐 (10 PULLS)</p><p class='center'>Come back tomorrow for more. Pick any banner you like on the PULL tab.</p>");
        }
      });
    }
  };
})(window.VB);
