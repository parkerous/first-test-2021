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
  VB.ATTRS = ["srv", "rec", "set", "att", "blk", "def"];
  VB.MODS = {
    S:  { srv: -2,  rec: -4,  set: 9,   att: -18, blk: -4,  def: 3 },
    OH: { srv: 1.5, rec: 6,   set: -9,  att: 3,   blk: 0,   def: 3.5 },
    MB: { srv: -4,  rec: -14, set: -14, att: 5.5, blk: 9.5, def: -7 },
    OP: { srv: 4,   rec: -9,  set: -11, att: 8,   blk: 3,   def: -2 },
    L:  { srv: -30, rec: 12,  set: -4,  att: -40, blk: -40, def: 12 }
  };
  var OVR_W = {
    S:  { set: .45, def: .15, srv: .1, blk: .1, rec: .1, att: .1 },
    OH: { att: .3, rec: .25, def: .15, srv: .15, blk: .15 },
    MB: { blk: .4, att: .35, srv: .15, def: .1 },
    OP: { att: .45, srv: .2, blk: .2, def: .15 },
    L:  { rec: .45, def: .45, set: .1 }
  };
  var OVR_OFF = { S: 1.7, OH: 3.15, MB: 4.4, OP: 4.7, L: 10.4 };     // keeps ovr ≈ the base it was built from
  VB.ovr = function (p) {
    var w = OVR_W[p.role], s = 0;
    Object.keys(w).forEach(function (a) { s += p[a] * w[a]; });
    return Math.round(s - OVR_OFF[p.role]);
  };
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
    JPN: ["SATO", "SUZUKI", "TANAKA", "WATANABE", "ITO", "NAKAMURA", "KOBAYASHI", "KATO", "YOSHIDA", "YAMADA", "SASAKI",
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
  VB.makeFace = function (nat) {
    var sk = SKIN_BY[nat] || [0, 0, 1];
    return {
      skin: VB.SKINS[pick(sk)],
      hair: DARK_HAIR[nat] ? pick(["#17120d", "#17120d", "#3a2416"]) : VB.HAIRC[irnd(0, 5)],
      style: irnd(0, 3), mouth: Math.random() < 0.4
    };
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
      height: o.height || (known ? known[0] : irnd(VB.HEIGHT[fam][0], VB.HEIGHT[fam][1])),
      vert: o.vert || (known ? known[1] : irnd(VB.VERT[fam][0], VB.VERT[fam][1])),
      skill: o.skill || null,
      face: o.face || VB.makeFace(o.nat)
    };
    VB.ATTRS.forEach(function (a) { p[a] = clamp(Math.round(o.base + m[a] + rnd(-5, 5)), 25, 99); });
    if (p.skill) p[VB.SKILL_ATTR[p.skill]] = clamp(p[VB.SKILL_ATTR[p.skill]] + 5, 25, 99);
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
  VB.NATIONAL.forEach(function (t) { t.flag = VB.FLAGS[t.id] || ""; });
  VB.nationalById = function (id) { return VB.NATIONAL.find(function (t) { return t.id === id; }); };

  // seven player records for a national team, rebuilt each tournament
  VB.nationalLineup = function (t) {
    var lineup = {};
    VB.ROLES.forEach(function (r) {
      var p = VB.makePlayer({ id: t.id + "-" + r, name: t.players[r], nat: t.id, role: VB.FAMILY[r],
                              base: t.ovr, skill: (t.stars || {})[r], age: irnd(23, 32) });
      lineup[r] = p;
    });
    return lineup;
  };

  // ---------- clubs (career mode) ----------
  VB.LEAGUES = {
    SL: { id: "SL", name: "SUPERLEGA", flag: "🇮🇹", nat: "ITA" },
    SV: { id: "SV", name: "SV.LEAGUE", flag: "🇯🇵", nat: "JPN" }
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
  VB.IMPORT_NATS = ["BRA", "POL", "FRA", "USA", "SRB", "ARG", "CUB", "IRI", "GER", "SLO", "NED", "CAN", "BUL", "TUR", "TUN", "MLI"];
})(window.VB);
