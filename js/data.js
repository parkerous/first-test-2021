// Shared data: national teams, clubs, name pools and player generation.
window.VB = window.VB || {};
(function (VB) {
  "use strict";

  // ---------- small helpers ----------
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function irnd(a, b) { return Math.floor(rnd(a, b + 1)); }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function clamp01(v) { return clamp(v, 0, 1); }
  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
  function shuffle(a) {
    for (var i = a.length - 1; i > 0; i--) { var j = irnd(0, i), t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }
  VB.rnd = rnd; VB.irnd = irnd; VB.clamp = clamp; VB.clamp01 = clamp01; VB.pick = pick; VB.shuffle = shuffle;

  // ---------- roles ----------
  VB.ROLES = ["S", "OH1", "OH2", "MB1", "MB2", "OP", "L"];             // the seven lineup slots
  VB.FAMILY = { S: "S", OH1: "OH", OH2: "OH", MB1: "MB", MB2: "MB", OP: "OP", L: "L" };
  VB.FAMILY_NAMES = { S: "SETTER", OH: "OUTSIDE HITTER", MB: "MIDDLE BLOCKER", OP: "OPPOSITE", L: "LIBERO" };
  // men = mental (composure in tight moments, confidence), tec = technique (clean contacts, fewer shanks, better sets)
  VB.ATTRS = ["srv", "rec", "set", "att", "blk", "def", "men", "tec"];
  VB.MODS = {
    S:  { srv: -2,  rec: -4,  set: 9,   att: -18, blk: -4,  def: 3,   men: 1, tec: 6 },
    OH: { srv: 1.5, rec: 6,   set: -9,  att: 3,   blk: 0,   def: 3.5, men: 0, tec: 1 },
    MB: { srv: -4,  rec: -14, set: -14, att: 5.5, blk: 9.5, def: -7,  men: 0, tec: -2 },
    OP: { srv: 4,   rec: -9,  set: -11, att: 8,   blk: 3,   def: -2,  men: 1, tec: 0 },
    L:  { srv: -30, rec: 12,  set: -4,  att: -40, blk: -40, def: 12,  men: 2, tec: 4 }
  };
  var OVR_W = {
    S:  { set: .4, def: .13, srv: .09, blk: .09, rec: .09, att: .08, men: .05, tec: .07 },
    OH: { att: .27, rec: .23, def: .13, srv: .13, blk: .13, men: .05, tec: .06 },
    MB: { blk: .37, att: .32, srv: .13, def: .08, men: .05, tec: .05 },
    OP: { att: .41, srv: .18, blk: .18, def: .13, men: .05, tec: .05 },
    L:  { rec: .4, def: .4, set: .08, men: .06, tec: .06 }
  };
  var OVR_OFF = {};                                                   // keeps ovr ≈ the base it was built from
  Object.keys(OVR_W).forEach(function (f) { var o = 0; Object.keys(OVR_W[f]).forEach(function (a) { o += OVR_W[f][a] * VB.MODS[f][a]; }); OVR_OFF[f] = o; });
  // older saves: players made before mental/technique existed get values from their skill level
  VB.fillAttrs = function (p) {
    if (p.men != null && p.tec != null) return p;
    var w = OVR_W[p.role], s = 0, n = 0;
    ["srv", "rec", "set", "att", "blk", "def"].forEach(function (a) { if (w[a]) { s += p[a] - VB.MODS[p.role][a]; n++; } });
    var base = n ? s / n : 70;
    if (p.men == null) p.men = clamp(Math.round(base + VB.MODS[p.role].men), 25, 99);
    if (p.tec == null) p.tec = clamp(Math.round(base + VB.MODS[p.role].tec), 25, 99);
    return p;
  };
  VB.ovr = function (p) {
    if (p.men == null || p.tec == null) VB.fillAttrs(p);
    var w = OVR_W[p.role], s = 0;
    Object.keys(w).forEach(function (a) { s += p[a] * w[a]; });
    return Math.round(s - OVR_OFF[p.role]);
  };
  // the ratings scale: elite pros sit around 80-85
  VB.scaleOvr = function (x) { return Math.round(40 + (x - 40) * 0.82); };
  // reach in cm: standing reach ≈ 1.335 × height; jumping adds the vertical
  VB.reach = function (p) {
    var stand = p.height * 1.335;
    return { stand: Math.round(stand), spike: Math.round(stand + p.vert), block: Math.round(stand + p.vert * 0.85) };
  };
  VB.HEIGHT = { S: [185, 198], OH: [190, 203], MB: [199, 212], OP: [195, 208], L: [172, 188] };
  VB.VERT   = { S: [70, 88],   OH: [80, 98],   MB: [76, 94],   OP: [80, 98],   L: [60, 78] };
  VB.SKILL_TXT  = { spike: "SUPER SPIKE", block: "SUPER BLOCK", rec: "SUPER RECEIVE", dump: "SETTER DUMP", dig: "SUPER DIG", serve: "SUPER SERVE" };
  VB.SKILL_ATTR = { spike: "att", block: "blk", rec: "rec", dump: "set", dig: "def", serve: "srv" };
  VB.ROLE_SKILL = { S: "dump", OH: "spike", MB: "block", OP: "serve", L: "dig" };   // signature move a career player unlocks

  // [height cm, vertical cm] for well-known names (an arcade homage, not official data)
  VB.KNOWN = {
    LEON: [201, 95], KUREK: [205, 90], KOCHANOWSKI: [211, 86], JANUSZ: [191, 82], SEMENIUK: [198, 90], HUBER: [207, 88], ZATORSKI: [184, 70],
    GIANNELLI: [200, 84], MICHIELETTO: [211, 92], LAVIA: [200, 90], GALASSI: [205, 86], RUSSO: [205, 86], ROMANO: [196, 92], BALASO: [183, 70],
    "N'GAPETH": [194, 96], CLEVENOT: [199, 88], BRIZARD: [196, 84], "LE GOFF": [206, 86], CHINENYEZE: [200, 92], PATRY: [207, 90], GREBENNIKOV: [188, 74],
    ISHIKAWA: [192, 96], TAKAHASHI: [188, 98], NISHIDA: [186, 104], SEKITA: [175, 80], ONODERA: [202, 86], YAMAUCHI: [204, 88], YAMAMOTO: [176, 72],
    BRUNINHO: [190, 78], LUCARELLI: [196, 96], LEAL: [202, 94], LUCAO: [209, 86], FLAVIO: [199, 94], DARLAN: [200, 96], THALES: [190, 70],
    CHRISTENSON: [198, 82], RUSSELL: [205, 92], DEFALCO: [196, 96], HOLT: [205, 88], ANDERSON: [204, 92], SHOJI: [184, 70],
    CONTE: [198, 90], "DE CECCO": [191, 78], GROZER: [201, 96], LISINAC: [205, 88], MAROUF: [189, 82], "ABDEL-AZIZ": [200, 96],
    NIKOLOV: [206, 92], KOZAMERNIK: [203, 86], URNAUT: [202, 90], SIMON: [206, 98], "BEN TARA": [204, 94], KEITA: [206, 100], MUSERSKIY: [218, 82],
    KAZIYSKI: [202, 92], SBERTOLI: [190, 80], PORRO: [194, 82], BRUNO: [190, 80], LAURENZANO: [180, 70], COLACI: [180, 70], OGAWA: [178, 72]
  };

  VB.FLAGS = {
    POL: "🇵🇱", ITA: "🇮🇹", FRA: "🇫🇷", JPN: "🇯🇵", BRA: "🇧🇷", SLO: "🇸🇮", USA: "🇺🇸", ARG: "🇦🇷", GER: "🇩🇪", SRB: "🇷🇸",
    IRI: "🇮🇷", NED: "🇳🇱", CAN: "🇨🇦", BUL: "🇧🇬", TUR: "🇹🇷", CHN: "🇨🇳", KOR: "🇰🇷", CUB: "🇨🇺", RUS: "🇷🇺", TUN: "🇹🇳", MLI: "🇲🇱"
  };

  VB.NAMES = {
    ITA: ["ROSSI", "BIANCHI", "RICCI", "MARINO", "GRECO", "GALLO", "CONTI", "DE LUCA", "COSTA", "FONTANA", "CARUSO", "MANCINI", "RIZZO",
          "LOMBARDI", "MORETTI", "BARBIERI", "FERRARA", "SANTORO", "MARINI", "LEONE", "LONGO", "GENTILE", "MARTINELLI", "VITALE",
          "SERRA", "COPPOLA", "DE ANGELIS", "FERRI", "PELLEGRINI", "BELLINI", "CATTANEO", "ORLANDO", "PAGANI", "VOLPE"],
    JPN: ["SATO", "SUZUKI", "WATANABE", "ITO", "NAKAMURA", "KOBAYASHI", "KATO", "YOSHIDA", "YAMADA", "SASAKI",
          "YAMAGUCHI", "MATSUMOTO", "INOUE", "KIMURA", "HAYASHI", "SHIMIZU", "YAMAZAKI", "MORI", "ABE", "IKEDA", "HASHIMOTO",
          "ISHII", "OKADA", "MAEDA", "FUJITA", "GOTO", "MIYAZAKI", "NOGUCHI", "KUBO", "SAKAMOTO", "ENDO", "AOKI", "MURATA"],
    POL: ["NOWAK", "KOWALSKI", "WISNIEWSKI", "WOJCIK", "KAMINSKI", "LEWANDOWSKI", "ZIELINSKI", "SZYMANSKI", "WOZNIAK", "DABROWSKI"],
    BRA: ["SILVA", "SANTOS", "OLIVEIRA", "SOUZA", "LIMA", "PEREIRA", "ALVES", "RIBEIRO", "CARVALHO", "ARAUJO", "BARBOSA"],
    FRA: ["MARTIN", "BERNARD", "DUBOIS", "THOMAS", "ROBERT", "PETIT", "DURAND", "LEROY", "MOREAU", "FAURE", "GIRARD"],
    USA: ["SMITH", "JOHNSON", "BROWN", "MILLER", "DAVIS", "WILSON", "MOORE", "TAYLOR", "JACKSON", "WHITE", "HARRIS"],
    SRB: ["JOVANOVIC", "PETROVIC", "NIKOLIC", "MARKOVIC", "DJORDJEVIC", "STOJANOVIC", "ILIC", "PAVLOVIC"],
    ARG: ["GONZALEZ", "RODRIGUEZ", "FERNANDEZ", "LOPEZ", "MARTINEZ", "GOMEZ", "DIAZ", "PEREZ"],
    CUB: ["HERRERA", "CASTRO", "MESA", "HIERREZUELO", "GUTIERREZ", "MARRERO", "DIAZ", "CEPEDA"],
    IRI: ["AHMADI", "HOSSEINI", "KARIMI", "MORADI", "REZAEI", "RAHIMI", "GHAFOUR"],
    GER: ["MULLER", "SCHMIDT", "SCHNEIDER", "FISCHER", "WEBER", "MEYER", "WAGNER"],
    SLO: ["NOVAK", "HORVAT", "KRAJNC", "ZUPANC", "POTOCNIK", "KOVAC"],
    NED: ["DE JONG", "JANSEN", "DE VRIES", "VAN DIJK", "BAKKER", "VISSER"],
    CAN: ["TREMBLAY", "GAGNON", "ROY", "CAMPBELL", "MACDONALD", "BOUCHARD"],
    BUL: ["IVANOV", "GEORGIEV", "DIMITROV", "PETROV", "STOYANOV"],
    TUR: ["YILMAZ", "KAYA", "DEMIR", "SAHIN", "CELIK", "OZTURK"],
    CHN: ["WANG", "LI", "ZHANG", "LIU", "CHEN", "YANG", "HUANG"],
    KOR: ["KIM", "LEE", "PARK", "CHOI", "JUNG", "KANG", "YOON"],
    RUS: ["IVANOV", "SMIRNOV", "VOLKOV", "SOKOLOV", "POPOV", "KUZNETSOV"],
    TUN: ["BEN ALI", "TRABELSI", "JEBALI", "HAMMAMI"],
    MLI: ["KEITA", "TRAORE", "COULIBALY", "DIARRA"]
  };

  // ---------- faces ----------
  VB.SKINS = ["#ffdcc2", "#f0b990", "#c98a5a", "#9c6238", "#6e4426"];
  VB.HAIRC = ["#17120d", "#3a2416", "#6b4423", "#b8863b", "#d8c06a", "#4a4a4a"];
  var SKIN_BY = { JPN: [0, 0, 1], CHN: [0, 0, 1], KOR: [0, 0, 1], BRA: [1, 2, 3, 4], CUB: [2, 3, 4], USA: [0, 1, 2, 3, 4],
                  FRA: [0, 1, 2, 3, 4], MLI: [3, 4], TUN: [1, 2], IRI: [1, 2], ARG: [0, 1, 2], ITA: [0, 0, 1, 2] };
  var DARK_HAIR = { JPN: 1, CHN: 1, KOR: 1, BRA: 1, CUB: 1, MLI: 1, TUN: 1, IRI: 1 };
  // 15 realistic haircuts for everyday players (anime styles stay with the famous faces)
  VB.HAIR_STYLES = ["buzz", "crew", "sidepart", "fringe", "middle", "undercut", "crop", "curly", "afro", "slick", "bun", "wavy", "braids", "flat", "bald"];
  VB.HAIR_TXT = { buzz: "BUZZ CUT", crew: "CREW CUT", sidepart: "SIDE PART", fringe: "FRINGE", middle: "MIDDLE PART", undercut: "UNDERCUT", crop: "TEXTURED CROP",
                  curly: "SHORT CURLS", afro: "AFRO", slick: "SLICKED BACK", bun: "MAN BUN", wavy: "WAVY", braids: "BRAIDS", flat: "CLASSIC", bald: "BALD", bedhead: "OWL (BOKUTO)" };
  var CURLY_OK = { BRA: 1, CUB: 1, MLI: 1, USA: 1, FRA: 1, TUN: 1, ARG: 1 };
  VB.makeFace = function (nat) {
    var sk = SKIN_BY[nat] || [0, 0, 1], skin = VB.SKINS[pick(sk)], dark = VB.SKINS.indexOf(skin) >= 3;
    var styles = ["buzz", "crew", "crew", "sidepart", "fringe", "middle", "undercut", "undercut", "crop", "crop", "slick", "bun", "wavy", "flat", "bald"];
    if (dark || CURLY_OK[nat]) styles = styles.concat(["curly", "afro", "braids", "buzz"]);
    var ex = [], r = Math.random();
    if (r < 0.1) ex.push("beard"); else if (r < 0.22) ex.push("stubble");
    if (Math.random() < 0.05) ex.push("glasses");
    return {
      skin: skin,
      hair: DARK_HAIR[nat] || dark ? pick(["#17120d", "#17120d", "#3a2416"]) : VB.HAIRC[irnd(0, 5)],
      style: pick(styles), ex: ex, mouth: Math.random() < 0.4
    };
  };

  // ---------- team playstyles: tendencies the AI leans on ----------
  // tempo/pipe/middle: set-choice weights • ace: how often the star gets the ball • tip: tip rate
  // wipe: block-use shots • spin: jump-serve share • serveRisk: extra serve errors (and pressure)
  // block: chance of an extra blocker closing • defense: dig/cover bonus
  VB.STYLES = {
    balanced: { name: "BALANCED", tempo: 1, pipe: 1, middle: 1, ace: 1, tip: 0.10, wipe: 1, spin: 0.55, serveRisk: 0, block: 0.05, defense: 0 },
    fast:     { name: "FAST TEMPO", tempo: 1.7, pipe: 1.3, middle: 1.4, ace: 0.9, tip: 0.09, wipe: 0.9, spin: 0.5, serveRisk: 0, block: 0.03, defense: 0 },
    power:    { name: "POWER ATTACK", tempo: 0.8, pipe: 1, middle: 0.9, ace: 1.4, tip: 0.05, wipe: 1.2, spin: 0.75, serveRisk: 0.05, block: 0.1, defense: -0.02 },
    wall:     { name: "IRON WALL", tempo: 0.9, pipe: 0.8, middle: 1.2, ace: 1, tip: 0.08, wipe: 0.8, spin: 0.45, serveRisk: -0.02, block: 0.3, defense: 0.02 },
    ace:      { name: "ACE-CENTRIC", tempo: 0.8, pipe: 0.9, middle: 0.7, ace: 2.2, tip: 0.07, wipe: 1.3, spin: 0.6, serveRisk: 0.02, block: 0.08, defense: 0 },
    defense:  { name: "DEFENSIVE GRIND", tempo: 1, pipe: 1, middle: 1, ace: 0.9, tip: 0.13, wipe: 1, spin: 0.35, serveRisk: -0.03, block: 0.04, defense: 0.07 },
    serve:    { name: "SERVE & PRESSURE", tempo: 1, pipe: 1, middle: 1, ace: 1.2, tip: 0.08, wipe: 1, spin: 0.85, serveRisk: 0.08, block: 0.06, defense: 0 },
    creative: { name: "CREATIVE", tempo: 1.3, pipe: 1.6, middle: 1.1, ace: 0.9, tip: 0.18, wipe: 1.4, spin: 0.5, serveRisk: 0.01, block: 0.04, defense: 0.02 }
  };
  VB.PLAY_OF = {
    POL: "power", ITA: "fast", FRA: "creative", JPN: "defense", BRA: "serve", SLO: "creative", USA: "serve", ARG: "fast", GER: "power",
    SRB: "power", IRI: "balanced", NED: "serve", CAN: "balanced", BUL: "power", TUR: "balanced", CHN: "wall", KOR: "defense",
    KAR: "fast", AOB: "serve", SHI: "ace", INA: "fast", NEK: "defense", FUK: "ace", ITC: "balanced", KAM: "wall", DAT: "wall", MUJ: "ace",
    NOH: "creative", JOH: "creative", KAK: "power", WAK: "defense", TSU: "balanced", UBU: "balanced",
    PER: "power", TRE: "fast", LUB: "balanced", PIA: "serve", MOD: "creative", MIL: "balanced", VER: "power", MON: "defense",
    OSB: "serve", SUN: "power", WOL: "ace", STI: "fast", TGB: "balanced", TOR: "defense", HIR: "creative", SAK: "defense"
  };

  // ---------- signature looks: skin index, hair colour, hair style, extras ----------
  var BLK = "#17120d", BRN = "#3a2416", LBR = "#6b4423", BLD = "#e8d27a", GRY = "#a0a0a0", WHT = "#ececec";
  VB.LOOKS = {
    // real players (pixel homages)
    LEON: { skin: 3, hair: BLK, style: "buzz" }, KUREK: { style: "bald" }, "N'GAPETH": { skin: 2, hair: BLK, style: "curly", ex: ["beard"] },
    CHINENYEZE: { skin: 4, hair: BLK, style: "buzz" }, LEAL: { skin: 4, hair: BLK, style: "buzz" }, DARLAN: { skin: 3, hair: BLK, style: "flat" },
    SIMON: { skin: 4, hair: BLK, style: "bald" }, KEITA: { skin: 4, hair: BLK, style: "buzz" }, "BEN TARA": { skin: 2, hair: BLK, style: "curly", ex: ["beard"] },
    LUCARELLI: { skin: 2, hair: BLK, style: "buzz" }, LUCAO: { skin: 2, hair: BLK, style: "buzz", ex: ["beard"] },
    TAKAHASHI: { hair: BRN, style: "fluffy" }, NISHIDA: { hair: BLK, style: "buzz" }, ISHIKAWA: { hair: BLK, style: "flat" },
    MICHIELETTO: { hair: BRN, style: "flat" }, GIANNELLI: { hair: LBR, style: "flat", ex: ["beard"] }, ROMANO: { hair: BLK, style: "buzz" },
    SEMENIUK: { hair: "#b8863b", style: "flat" }, JANUSZ: { hair: LBR, style: "buzz" }, ZATORSKI: { hair: BRN, style: "buzz" },
    BRUNINHO: { skin: 1, hair: BLK, style: "flat", ex: ["beard"] }, RUSSELL: { hair: "#b8863b", style: "flat" }, DEFALCO: { hair: BRN, style: "flat" },
    PATRY: { hair: BRN, style: "flat" }, BRIZARD: { hair: BRN, style: "flat", ex: ["beard"] }, GROZER: { style: "bald", ex: ["beard"] },
    SHOJI: { skin: 1, hair: BLK, style: "flat" }, MUSERSKIY: { hair: BRN, style: "buzz" }, KAZIYSKI: { hair: BRN, style: "buzz", ex: ["beard"] },
    // Haikyuu!!
    HINATA: { hair: "#ff7a1a", style: "spiky" }, KAGEYAMA: { hair: BLK, style: "bowl" }, TSUKISHIMA: { hair: BLD, style: "fluffy", ex: ["glasses"] },
    NISHINOYA: { hair: BLK, style: "spiky", hair2: BLD, ex: ["streak"] }, AZUMANE: { hair: BRN, style: "long", ex: ["beard"] },
    TANAKA: { hair: "#4a4a4a", style: "bald" }, SAWAMURA: { hair: BLK, style: "buzz" },
    OIKAWA: { hair: LBR, style: "fluffy" }, IWAIZUMI: { hair: BLK, style: "spiky" }, HANAMAKI: { hair: "#e39ac0", style: "flat" },
    MATSUKAWA: { hair: BLK, style: "curly" }, KINDAICHI: { hair: BLK, style: "mohawk" }, KYOTANI: { hair: BLD, style: "mohawk", hair2: BLK, ex: ["streak"] },
    WATARI: { hair: BLK, style: "buzz" },
    USHIJIMA: { hair: "#4a4a2a", style: "flat" }, TENDO: { hair: "#e83a2a", style: "spiky" }, SHIRABU: { hair: LBR, style: "bowl" },
    GOSHIKI: { hair: BLK, style: "bowl" }, KAWANISHI: { hair: LBR, style: "flat" },
    ATSUMU: { hair: BLD, style: "fluffy" }, OSAMU: { hair: GRY, style: "flat" }, OJIRO: { skin: 4, hair: BLK, style: "buzz" },
    SUNA: { hair: BRN, style: "flat" }, OMIMI: { hair: BLK, style: "buzz" },
    KENMA: { hair: BLD, style: "long", hair2: BLK, ex: ["roots"] }, TAKETORA: { hair: "#d8a03a", style: "mohawk" },
    KUROO: { hair: BLK, style: "bedhead" }, LEV: { hair: "#d8d8d8", style: "flat" }, YAKU: { hair: "#c8a070", style: "flat" }, KAI: { hair: BLK, style: "buzz" },
    BOKUTO: { hair: GRY, style: "bedhead", hair2: BLK, ex: ["streak"] }, AKAASHI: { hair: BLK, style: "curly" }, KONOHA: { hair: BLD, style: "flat" },
    SAKUSA: { hair: BLK, style: "curly" }, KOMORI: { hair: BRN, style: "flat" }, IIZUNA: { hair: BLK, style: "flat" },
    HOSHIUMI: { hair: WHT, style: "spiky" }, HIRUGAMI: { hair: LBR, style: "flat" }, HAKUBA: { hair: BLK, style: "buzz" },
    AONE: { hair: "#d8d8d8", style: "bald" }, KOGANEGAWA: { hair: BLD, style: "spiky" }, FUTAKUCHI: { hair: LBR, style: "flat" },
    TERUSHIMA: { hair: BLD, style: "spiky", hair2: BLK, ex: ["roots"] }, DAISHO: { hair: BLK, style: "long" }, KIRYU: { hair: BLK, style: "buzz" },
    HYAKUZAWA: { hair: BLK, style: "buzz" }, NAKASHIMA: { hair: BRN, style: "flat" }
  };
  VB.applyLook = function (p) {
    var L = VB.LOOKS[p.name];
    if (!L || !p.face) return p;
    if (L.skin != null) p.face.skin = VB.SKINS[L.skin];
    if (L.hair) p.face.hair = L.hair;
    if (L.style) p.face.style = L.style;
    if (L.hair2) p.face.hair2 = L.hair2;
    if (L.ex) p.face.ex = L.ex.slice();
    return p;
  };

  // ---------- player records ----------
  var uidN = 0;
  VB.uid = function () { return "p" + Date.now().toString(36) + (uidN++).toString(36) + irnd(0, 999); };

  // o: { name, nat, role (family), base (target ovr), age?, height?, vert?, skill?, id? }
  VB.makePlayer = function (o) {
    var fam = o.role, m = VB.MODS[fam], known = VB.KNOWN[o.name];
    var p = {
      id: o.id || VB.uid(), name: o.name, nat: o.nat, role: fam,
      age: o.age || irnd(21, 31),
      height: o.height || (known ? known[0] : irnd(VB.HEIGHT[fam][0], VB.HEIGHT[fam][1]) + (o.heightAdj || 0)),
      vert: o.vert || (known ? known[1] : irnd(VB.VERT[fam][0], VB.VERT[fam][1])),
      skill: o.skill || null, skillName: o.skillName || null,
      face: o.face || VB.makeFace(o.nat)
    };
    VB.ATTRS.forEach(function (a) { p[a] = clamp(Math.round(o.base + m[a] + rnd(-5, 5)), 25, 99); });
    if (p.skill) p[VB.SKILL_ATTR[p.skill]] = clamp(p[VB.SKILL_ATTR[p.skill]] + 5, 25, 99);
    VB.applyLook(p);
    var ov = VB.ovr(p);
    p.pot = clamp(ov + (p.age < 23 ? irnd(5, 14) : p.age < 27 ? irnd(0, 6) : 0), 40, 99);
    return p;
  };

  VB.genName = function (nat, taken) {
    var pool = VB.NAMES[nat] || VB.NAMES.ITA;
    for (var i = 0; i < 12; i++) {
      var n = pick(pool);
      if (!taken[n]) { taken[n] = 1; return n; }
    }
    var letters = "ABCDEFGHIJKLMNOPRSTUVZ", base = pick(pool), tries = 0, name;
    do { name = letters[irnd(0, letters.length - 1)] + ". " + base; tries++; } while (taken[name] && tries < 40);
    taken[name] = 1;
    return name;
  };

  // ---------- national teams (VNL mode) ----------
  VB.NATIONAL = [
    { id: "POL", name: "POLAND", ovr: 95, kit: "#d81e36", kit2: "#ffffff", players: { S: "JANUSZ", OH1: "LEON", OH2: "SEMENIUK", MB1: "KOCHANOWSKI", MB2: "HUBER", OP: "KUREK", L: "ZATORSKI" }, stars: { OH1: "serve", MB1: "block", OP: "spike", L: "dig" } },
    { id: "ITA", name: "ITALY", ovr: 93, kit: "#1e63ff", kit2: "#ffffff", players: { S: "GIANNELLI", OH1: "MICHIELETTO", OH2: "LAVIA", MB1: "GALASSI", MB2: "RUSSO", OP: "ROMANO", L: "BALASO" }, stars: { S: "dump", OH1: "spike", MB1: "block", L: "dig" } },
    { id: "FRA", name: "FRANCE", ovr: 92, kit: "#16308f", kit2: "#ffffff", players: { S: "BRIZARD", OH1: "N'GAPETH", OH2: "CLEVENOT", MB1: "LE GOFF", MB2: "CHINENYEZE", OP: "PATRY", L: "GREBENNIKOV" }, stars: { S: "dump", OH1: "spike", MB2: "block", L: "dig" } },
    { id: "JPN", name: "JAPAN", ovr: 90, kit: "#c81728", kit2: "#ffffff", players: { S: "SEKITA", OH1: "ISHIKAWA", OH2: "TAKAHASHI", MB1: "ONODERA", MB2: "YAMAUCHI", OP: "NISHIDA", L: "YAMAMOTO" }, stars: { OH1: "rec", OH2: "spike", OP: "serve", L: "dig" } },
    { id: "BRA", name: "BRAZIL", ovr: 89, kit: "#ffd21e", kit2: "#1e4fd8", players: { S: "BRUNINHO", OH1: "LUCARELLI", OH2: "LEAL", MB1: "LUCAO", MB2: "FLAVIO", OP: "DARLAN", L: "THALES" }, stars: { S: "dump", OH1: "spike", MB1: "block" } },
    { id: "SLO", name: "SLOVENIA", ovr: 87, kit: "#1aa7e8", kit2: "#ffffff", players: { S: "ROPRET", OH1: "CEBULJ", OH2: "URNAUT", MB1: "KOZAMERNIK", MB2: "PAJENK", OP: "STERN", L: "KOVACIC" }, stars: { S: "dump", OH2: "spike", MB1: "block" } },
    { id: "USA", name: "USA", ovr: 86, kit: "#1e4f9e", kit2: "#ffffff", players: { S: "CHRISTENSON", OH1: "RUSSELL", OH2: "DEFALCO", MB1: "HOLT", MB2: "SMITH", OP: "ANDERSON", L: "SHOJI" }, stars: { S: "dump", OP: "spike", MB1: "block", L: "dig" } },
    { id: "ARG", name: "ARGENTINA", ovr: 84, kit: "#74b7e8", kit2: "#ffffff", players: { S: "DE CECCO", OH1: "CONTE", OH2: "PALONSKY", MB1: "LOSER", MB2: "ZERBA", OP: "KUKARTSEV", L: "DANANI" }, stars: { S: "dump", OH1: "spike", L: "dig" } },
    { id: "GER", name: "GERMANY", ovr: 82, kit: "#2b2b2b", kit2: "#ffffff", players: { S: "KAMPA", OH1: "KARLITZEK", OH2: "FROMM", MB1: "KRICK", MB2: "BOHME", OP: "GROZER", L: "ZENGER" }, stars: { S: "dump", OP: "serve" } },
    { id: "SRB", name: "SERBIA", ovr: 80, kit: "#b31d2d", kit2: "#ffffff", players: { S: "JOVOVIC", OH1: "IVOVIC", OH2: "KOVACEVIC", MB1: "LISINAC", MB2: "PODRASCANIN", OP: "LUBURIC", L: "PERIC" }, stars: { MB1: "block", OP: "spike" } },
    { id: "IRI", name: "IRAN", ovr: 79, kit: "#e8e8e8", kit2: "#d81e36", players: { S: "MAROUF", OH1: "EBADIPOUR", OH2: "ESFANDIAR", MB1: "MOUSAVI", MB2: "MOJARAD", OP: "ESMAEILNEZHAD", L: "HAZRATPOUR" }, stars: { S: "dump", OH1: "spike" } },
    { id: "NED", name: "NETHERLANDS", ovr: 78, kit: "#ff7a00", kit2: "#ffffff", players: { S: "KEEMINK", OH1: "TER HORST", OH2: "TUINSTRA", MB1: "PLAK", MB2: "KLOK", OP: "ABDEL-AZIZ", L: "ANDRINGA" }, stars: { OP: "serve", MB1: "block" } },
    { id: "CAN", name: "CANADA", ovr: 77, kit: "#d22730", kit2: "#ffffff", players: { S: "SANDERS", OH1: "MAAR", OH2: "HOAG", MB1: "VAN BERKEL", MB2: "DEMYANENKO", OP: "VERNON-EVANS", L: "CURRIE" }, stars: { OP: "spike", OH1: "rec" } },
    { id: "BUL", name: "BULGARIA", ovr: 75, kit: "#1f8a3a", kit2: "#ffffff", players: { S: "BRATOEV", OH1: "NIKOLOV", OH2: "ATANASOV", MB1: "GROZDANOV", MB2: "YOSIFOV", OP: "SOKOLOV", L: "SALPAROV" }, stars: { OH1: "spike", L: "dig" } },
    { id: "TUR", name: "TÜRKIYE", ovr: 74, kit: "#a31227", kit2: "#ffffff", players: { S: "YENIPAZAR", OH1: "MANDIRACI", OH2: "BULBUL", MB1: "M.LAGUMDZIJA", MB2: "TUMER", OP: "A.LAGUMDZIJA", L: "KAPLAN" }, stars: { OP: "spike", MB1: "block" } },
    { id: "CHN", name: "CHINA", ovr: 72, kit: "#e3342f", kit2: "#ffd21e", players: { S: "YU", OH1: "ZHANG", OH2: "LIU", MB1: "PENG", MB2: "WANG", OP: "JIANG", L: "QU" }, stars: { OH1: "spike", MB1: "block" } },
    { id: "KOR", name: "KOREA", ovr: 68, kit: "#2f6fd6", kit2: "#ffffff", players: { S: "HAN", OH1: "JEONG", OH2: "HEO", MB1: "KIM", MB2: "SHIN", OP: "LIM", L: "PARK" }, stars: { OH1: "spike", OH2: "rec" } }
  ];
  VB.NATIONAL.forEach(function (t) { t.flag = VB.FLAGS[t.id] || ""; t.ovr = VB.scaleOvr(t.ovr); });
  VB.nationalById = function (id) { return VB.NATIONAL.find(function (t) { return t.id === id; }); };

  // seven player records for a team, rebuilt each tournament. Optional per-role overrides:
  // skillNames, hair colours, skin tone index, hair style, and generated names for unnamed slots.
  VB.teamLineup = function (t, taken) {
    var nat = t.nat || t.id, lineup = {};
    taken = taken || {};
    VB.ROLES.forEach(function (r) {
      var face = VB.makeFace(nat);
      if (t.hair && t.hair[r]) face.hair = t.hair[r];
      if (t.skin && t.skin[r] != null) face.skin = VB.SKINS[t.skin[r]];
      if (t.style && t.style[r] != null) face.style = t.style[r];
      lineup[r] = VB.makePlayer({ id: t.id + "-" + r, name: (t.players || {})[r] || VB.genName(nat, taken), nat: nat, role: VB.FAMILY[r],
                                  base: t.ovr, skill: (t.stars || {})[r], skillName: (t.skillNames || {})[r],
                                  age: t.ages ? irnd(t.ages[0], t.ages[1]) : irnd(23, 32), face: face, heightAdj: t.heightAdj || 0 });
    });
    return lineup;
  };
  VB.nationalLineup = function (t) { return VB.teamLineup(t); };

  // ---------- clubs (career mode) ----------
  VB.LEAGUES = {
    SL: { id: "SL", name: "SUPERLEGA", flag: "🇮🇹", nat: "ITA" },
    SV: { id: "SV", name: "SV.LEAGUE", flag: "🇯🇵", nat: "JPN" },
    PL: { id: "PL", name: "PLUSLIGA", flag: "🇵🇱", nat: "POL" },
    EF: { id: "EF", name: "EFELER LIGI", flag: "🇹🇷", nat: "TUR" },
    SB: { id: "SB", name: "SUPERLIGA", flag: "🇧🇷", nat: "BRA" },
    LA: { id: "LA", name: "LIGUE A", flag: "🇫🇷", nat: "FRA" },
    BL: { id: "BL", name: "BUNDESLIGA", flag: "🇩🇪", nat: "GER" },
    VL: { id: "VL", name: "V-LEAGUE", flag: "🇰🇷", nat: "KOR" }
  };
  // seeds: [name, nat, family, skill?] — an arcade homage, not real rosters
  VB.CLUBS = [
    { id: "PER", league: "SL", name: "SIR PERUGIA", short: "PERUGIA", kit: "#c8102e", kit2: "#ffffff", prestige: 92, coach: "LORENZETTI",
      story: "The giants of Umbria. Anything less than the Scudetto is a failure.",
      seeds: [["GIANNELLI", "ITA", "S", "dump"], ["SEMENIUK", "POL", "OH"], ["ISHIKAWA", "JPN", "OH", "rec"], ["BEN TARA", "TUN", "OP", "spike"], ["LOSER", "ARG", "MB"], ["RUSSO", "ITA", "MB", "block"], ["COLACI", "ITA", "L", "dig"]] },
    { id: "TRE", league: "SL", name: "ITAS TRENTINO", short: "TRENTINO", kit: "#f5c400", kit2: "#0b2a6f", prestige: 90, coach: "SOLI",
      story: "Built on young Italian talent and a ferocious home crowd.",
      seeds: [["MICHIELETTO", "ITA", "OH", "spike"], ["LAVIA", "ITA", "OH"], ["SBERTOLI", "ITA", "S"], ["KOZAMERNIK", "SLO", "MB", "block"], ["FLAVIO", "BRA", "MB"], ["LAURENZANO", "ITA", "L", "dig"]] },
    { id: "LUB", league: "SL", name: "LUBE CIVITANOVA", short: "LUBE", kit: "#9e0b24", kit2: "#ffcc00", prestige: 88, coach: "MEDEI",
      story: "Seven-time champions defending their fortress by the Adriatic.",
      seeds: [["NIKOLOV", "BUL", "OH", "spike"], ["CHINENYEZE", "FRA", "MB", "block"], ["DE CECCO", "ARG", "S", "dump"], ["BALASO", "ITA", "L", "dig"]] },
    { id: "PIA", league: "SL", name: "GAS SALES PIACENZA", short: "PIACENZA", kit: "#e2231a", kit2: "#0a3a7a", prestige: 86, coach: "ANASTASI",
      story: "Spent big this summer — the board expects silverware right now.",
      seeds: [["BRIZARD", "FRA", "S"], ["ROMANO", "ITA", "OP", "spike"], ["SIMON", "CUB", "MB", "block"], ["LEAL", "BRA", "OH"]] },
    { id: "MOD", league: "SL", name: "VALSA MODENA", short: "MODENA", kit: "#ffd200", kit2: "#00338d", prestige: 84, coach: "GIULIANI",
      story: "A historic club desperate to return to the top of Italian volleyball.",
      seeds: [["BRUNO", "ITA", "S", "dump"], ["RINALDI", "ITA", "OH"], ["SANGUINETTI", "ITA", "MB"]] },
    { id: "MIL", league: "SL", name: "ALLIANZ MILANO", short: "MILANO", kit: "#0b3a8a", kit2: "#e6e6e6", prestige: 83, coach: "PIAZZA",
      story: "Big-city ambitions. The coach demands a deep playoff run.",
      seeds: [["PORRO", "ITA", "S"], ["KAZIYSKI", "BUL", "OP", "serve"], ["CATANIA", "ITA", "L"]] },
    { id: "VER", league: "SL", name: "RANA VERONA", short: "VERONA", kit: "#003da5", kit2: "#ffd400", prestige: 81, coach: "STOYTCHEV",
      story: "Explosive hitters and a fearless young core.",
      seeds: [["KEITA", "MLI", "OH", "spike"]] },
    { id: "MON", league: "SL", name: "VERO VOLLEY MONZA", short: "MONZA", kit: "#1f2f6f", kit2: "#e2001a", prestige: 77, coach: "ECCHELI",
      story: "The underdogs who love to ruin the big clubs' nights.", seeds: [] },
    { id: "OSB", league: "SV", name: "OSAKA BLUTEON", short: "BLUTEON", kit: "#003e9c", kit2: "#ffffff", prestige: 88, coach: "KATO",
      story: "Defending champions, built around Japan's most dangerous server.",
      seeds: [["NISHIDA", "JPN", "OP", "serve"], ["YAMAUCHI", "JPN", "MB", "block"], ["OGAWA", "JPN", "L", "dig"]] },
    { id: "SUN", league: "SV", name: "SUNTORY SUNBIRDS", short: "SUNBIRDS", kit: "#ff8c00", kit2: "#1b1b1b", prestige: 87, coach: "OGIWARA",
      story: "Osaka's other giant. The derby against Bluteon is everything.",
      seeds: [["TAKAHASHI", "JPN", "OH", "spike"], ["MUSERSKIY", "RUS", "OP", "block"], ["SEKITA", "JPN", "S", "dump"]] },
    { id: "WOL", league: "SV", name: "WOLFDOGS NAGOYA", short: "WOLFDOGS", kit: "#b0001e", kit2: "#1b1b1b", prestige: 84, coach: "VALENTINI",
      story: "Hungry for a first title in years — the fans are getting restless.",
      seeds: [["KUREK", "POL", "OP", "spike"], ["YAMAMOTO", "JPN", "L", "dig"]] },
    { id: "STI", league: "SV", name: "JTEKT STINGS AICHI", short: "STINGS", kit: "#00a0e9", kit2: "#ffffff", prestige: 81, coach: "TAKAMATSU",
      story: "A fast offence that lives on tiny margins.", seeds: [["ONODERA", "JPN", "MB"]] },
    { id: "TGB", league: "SV", name: "TOKYO GREAT BEARS", short: "GREAT BEARS", kit: "#006837", kit2: "#ffffff", prestige: 79, coach: "MOMOTA",
      story: "The capital's project club, spending big to catch up.", seeds: [] },
    { id: "TOR", league: "SV", name: "TORAY ARROWS", short: "ARROWS", kit: "#0072bc", kit2: "#e60012", prestige: 78, coach: "SHINOHARA",
      story: "A proud old club in the middle of a rebuild.", seeds: [] },
    { id: "HIR", league: "SV", name: "HIROSHIMA THUNDERS", short: "THUNDERS", kit: "#6a1b9a", kit2: "#ffd200", prestige: 74, coach: "NAGANO",
      story: "Small budget, big heart, loud gym.", seeds: [] },
    { id: "SAK", league: "SV", name: "SAKAI BLAZERS", short: "BLAZERS", kit: "#f39800", kit2: "#003399", prestige: 72, coach: "OKUMURA",
      story: "Develops youngsters — the perfect place to earn minutes.", seeds: [] }
  ];
  // PlusLiga, Efeler Ligi and the Brazilian Superliga (8 clubs each, an arcade homage)
  [
    ["JAS", "PL", "JASTRZEBSKI WEGIEL", "JASTRZEBSKI", "#f39200", "#1b1b1b", 91, "MENDEZ", "Back-to-back champions with a roaring home gym.", [["FORNAL", "POL", "OH", "spike"]]],
    ["ZAK", "PL", "ZAKSA KEDZIERZYN", "ZAKSA", "#0060a8", "#ffffff", 89, "GRBIC", "European royalty that never stops reloading.", [["KACZMAREK", "POL", "OP", "spike"]]],
    ["ZAW", "PL", "ALURON ZAWIERCIE", "ZAWIERCIE", "#ffd200", "#1b1b1b", 87, "WINIARSKI", "The new money of Polish volleyball.", [["BIENIEK", "POL", "MB", "block"]]],
    ["RES", "PL", "ASSECO RESOVIA", "RESOVIA", "#d4001a", "#ffffff", 85, "KOWAL", "Rzeszow's pride, loud and demanding.", []],
    ["PRO", "PL", "PROJEKT WARSZAWA", "PROJEKT", "#e30613", "#1b1b1b", 83, "ANASTASI", "The capital club with big ambitions.", [["KWOLEK", "POL", "OH"]]],
    ["TRG", "PL", "TREFL GDANSK", "TREFL", "#ffd200", "#e30613", 79, "PLINSKI", "Coastal underdogs who love long rallies.", []],
    ["SKR", "PL", "PGE SKRA BELCHATOW", "SKRA", "#ffd200", "#0b3a8a", 77, "LEBEDEW", "A former giant rebuilding with youth.", []],
    ["SLE", "PL", "SLEPSK SUWALKI", "SUWALKI", "#009640", "#ffffff", 72, "KOWALSKI", "A tiny gym at the edge of the map — and they love it.", []],
    ["HAL", "EF", "HALKBANK ANKARA", "HALKBANK", "#00599c", "#ffffff", 89, "LEBEDEW", "Ankara's powerhouse, built on big serves.", [["ABDEL-AZIZ", "NED", "OP", "serve"]]],
    ["ZIR", "EF", "ZIRAATBANK ANKARA", "ZIRAAT", "#e30613", "#ffffff", 87, "CIFTCI", "Deep pockets and deeper benches.", [["A.LAGUMDZIJA", "TUR", "OP", "spike"]]],
    ["FEN", "EF", "FENERBAHCE ISTANBUL", "FENERBAHCE", "#ffd200", "#00205b", 86, "BAGRIACIK", "Every match is a derby in Istanbul.", []],
    ["GAL", "EF", "GALATASARAY", "GALATASARAY", "#a50021", "#fdb913", 84, "YILMAZ", "The red-and-yellow wall of noise.", []],
    ["ARK", "EF", "ARKAS SPOR IZMIR", "ARKAS", "#0068b3", "#ffffff", 82, "GLENN", "The academy factory of Turkish volleyball.", []],
    ["SPT", "EF", "SPOR TOTO", "SPOR TOTO", "#00843d", "#ffffff", 78, "KARACA", "A steady mid-table club that eats favourites.", []],
    ["ALA", "EF", "ALANYA BELEDIYE", "ALANYA", "#f39200", "#0b3a8a", 76, "DEMIR", "Sun, sea and surprise results.", []],
    ["IBB", "EF", "ISTANBUL BBSK", "ISTANBUL BB", "#2a62a8", "#ffffff", 73, "OZTURK", "The city club fighting for every point.", []],
    ["CRU", "SB", "SADA CRUZEIRO", "CRUZEIRO", "#003da5", "#ffffff", 90, "MARCELO", "Brazil's machine of champions.", [["CACHOPA", "BRA", "S", "dump"]]],
    ["SES", "SB", "SESI-SP", "SESI", "#e30613", "#ffffff", 86, "GIOVANE", "Sao Paulo's industrial-strength attack.", [["ALAN", "BRA", "OP", "spike"]]],
    ["MIN", "SB", "MINAS TENIS", "MINAS", "#0b3a8a", "#ffd200", 85, "NERY", "Belo Horizonte's oldest rivalry.", [["HONORATO", "BRA", "OH"]]],
    ["PRA", "SB", "PRAIA CLUBE", "PRAIA", "#009fe3", "#ffffff", 83, "PAULO", "Uberlandia's flashy, fast-tempo side.", []],
    ["REN", "SB", "VOLEI RENATA", "RENATA", "#7a1fa2", "#ffd200", 81, "HORACIO", "Campinas' pride and joy.", []],
    ["JOI", "SB", "JOINVILLE", "JOINVILLE", "#e30613", "#1b1b1b", 78, "CARLAO", "The southern underdogs.", []],
    ["SJO", "SB", "SAO JOSE", "SAO JOSE", "#1b1b1b", "#ffffff", 75, "SOARES", "Small budget, huge crowd.", []],
    ["MAR", "SB", "MARINGA", "MARINGA", "#009640", "#ffd200", 72, "LIMA", "A rising club with nothing to lose.", []]
  ].forEach(function (c) {
    VB.CLUBS.push({ id: c[0], league: c[1], name: c[2], short: c[3], kit: c[4], kit2: c[5], prestige: c[6], coach: c[7], story: c[8], seeds: c[9] });
  });
  ["JAS:power", "ZAK:fast", "ZAW:serve", "RES:power", "PRO:creative", "TRG:defense", "SKR:balanced", "SLE:defense",
   "HAL:serve", "ZIR:power", "FEN:balanced", "GAL:wall", "ARK:fast", "SPT:defense", "ALA:creative", "IBB:balanced",
   "CRU:fast", "SES:power", "MIN:creative", "PRA:fast", "REN:serve", "JOI:defense", "SJO:balanced", "MAR:ace"].forEach(function (k) {
    k = k.split(":"); VB.PLAY_OF[k[0]] = k[1];
  });
  // Ligue A, Bundesliga and the Korean V-League
  [
    ["TOU", "LA", "TOURS VB", "TOURS", "#e30613", "#ffffff", 87, "BOURDON", "France's most decorated club, always in the hunt.", [["TILLIE", "FRA", "OH", "spike"]]],
    ["MON2", "LA", "MONTPELLIER HSC", "MONTPELLIER", "#0b3a8a", "#f39200", 85, "TILLIE", "Sun, style and a fast offence.", []],
    ["CHA", "LA", "CHAUMONT 52", "CHAUMONT", "#009640", "#ffffff", 84, "PATRY", "A small town with a champion's habit.", []],
    ["PAR", "LA", "PARIS VOLLEY", "PARIS", "#0b2a6f", "#e30613", 82, "LEGRAND", "The capital's comeback project.", []],
    ["POI", "LA", "POITIERS", "POITIERS", "#ffd200", "#1b1b1b", 80, "MARTIN", "Gritty defence, loud fans.", []],
    ["SET", "LA", "SETE", "SETE", "#1e63ff", "#ffffff", 78, "ROUX", "The seaside spoilers.", []],
    ["NIC", "LA", "NICE VB", "NICE", "#d4001a", "#1b1b1b", 76, "BLANC", "Riviera underdogs with flair.", []],
    ["NAR", "LA", "NARBONNE", "NARBONNE", "#ff7a00", "#1b1b1b", 73, "FAURE", "Where young players get their first chance.", []],
    ["BRV", "BL", "BERLIN RECYCLING VOLLEYS", "BERLIN", "#e30613", "#1b1b1b", 88, "SERNIOTTI", "The German machine — titles every spring.", []],
    ["FRH", "BL", "VFB FRIEDRICHSHAFEN", "FRIEDRICHSHAFEN", "#0b3a8a", "#ffffff", 85, "HAUSER", "The lakeside giants, hungry again.", []],
    ["LUN", "BL", "SVG LUNEBURG", "LUNEBURG", "#009640", "#ffffff", 81, "HUBNER", "A loud little arena that scares favourites.", []],
    ["FRA2", "BL", "UNITED VOLLEYS FRANKFURT", "FRANKFURT", "#1b1b1b", "#ffd200", 79, "WAGNER", "Big city, bigger ambitions.", []],
    ["DUR", "BL", "POWERVOLLEYS DUREN", "DUREN", "#e30613", "#ffffff", 77, "SCHMIDT", "Hard serving and harder work.", []],
    ["GIE", "BL", "GRIZZLYS GIESEN", "GIESEN", "#7a4a1a", "#ffd200", 75, "KOCH", "The bears from the north.", []],
    ["HER", "BL", "VOLLEYS HERRSCHING", "HERRSCHING", "#00a0e9", "#ffffff", 74, "BECKER", "Party volleyball, serious points.", []],
    ["NET", "BL", "NETZHOPPERS", "NETZHOPPERS", "#ff7a00", "#0b3a8a", 71, "FISCHER", "A club that loves an upset.", []],
    ["JUM", "VL", "KOREAN AIR JUMBOS", "JUMBOS", "#0b3a8a", "#e8f1ff", 86, "TOMMI", "Incheon's dynasty, built on quick sets.", []],
    ["SKY", "VL", "HYUNDAI SKYWALKERS", "SKYWALKERS", "#0060a8", "#ffffff", 84, "BLANCO", "Cheonan's powerhouse, full of national players.", []],
    ["WIB", "VL", "WOORI CARD WIBEE", "WIBEE", "#00a0e9", "#ffffff", 80, "PARK", "A young, exciting team on the rise.", []],
    ["KBS", "VL", "KB STARS", "KB STARS", "#ffd200", "#3a2a1a", 79, "KIM", "Steady, tough and hard to beat at home.", []],
    ["OKS", "VL", "OK SAVINGS BANK", "OK MAN", "#ff7a00", "#1b1b1b", 78, "OH", "Busan's fighters.", []],
    ["BLU", "VL", "SAMSUNG BLUEFANGS", "BLUEFANGS", "#1e4fd8", "#ffffff", 77, "LEE", "A proud old club chasing past glory.", []],
    ["VIX", "VL", "KEPCO VIXTORM", "VIXTORM", "#e30613", "#ffffff", 75, "KWON", "Power-hitting underdogs.", []],
    ["SST", "VL", "SEOUL STARS", "SEOUL", "#7a1fa2", "#ffd200", 72, "CHOI", "The newest club in the league.", []]
  ].forEach(function (c) {
    VB.CLUBS.push({ id: c[0], league: c[1], name: c[2], short: c[3], kit: c[4], kit2: c[5], prestige: c[6], coach: c[7], story: c[8], seeds: c[9] });
  });
  ["TOU:creative", "MON2:fast", "CHA:defense", "PAR:balanced", "POI:defense", "SET:creative", "NIC:balanced", "NAR:fast",
   "BRV:power", "FRH:serve", "LUN:wall", "FRA2:balanced", "DUR:serve", "GIE:power", "HER:creative", "NET:balanced",
   "JUM:fast", "SKY:power", "WIB:fast", "KBS:defense", "OKS:serve", "BLU:balanced", "VIX:power", "SST:creative"].forEach(function (k) {
    k = k.split(":"); VB.PLAY_OF[k[0]] = k[1];
  });
  VB.CLUBS.forEach(function (c) { c.prestige = VB.scaleOvr(c.prestige); });
  VB.IMPORT_NATS = ["BRA", "POL", "FRA", "USA", "SRB", "ARG", "CUB", "IRI", "GER", "SLO", "NED", "CAN", "BUL", "TUR", "TUN", "MLI"];
})(window.VB);
