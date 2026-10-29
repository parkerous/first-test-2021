// Haikyuu!! Spring Nationals: 16 high-school teams with their famous players and signature moves.
// A fan homage — unnamed squad slots are filled with generated names.
(function (VB) {
  "use strict";

  // [height cm, vertical cm] — tuned so reach matches the show (Hinata out-jumps everyone)
  var HQ_KNOWN = {
    KAGEYAMA: [181, 86], HINATA: [164, 112], TSUKISHIMA: [190, 78], NISHINOYA: [160, 72], AZUMANE: [185, 90], TANAKA: [178, 88], SAWAMURA: [177, 82],
    OIKAWA: [184, 86], IWAIZUMI: [179, 94], HANAMAKI: [185, 84], MATSUKAWA: [188, 84], KINDAICHI: [190, 84], KYOTANI: [183, 96], WATARI: [173, 70],
    SHIRABU: [174, 78], USHIJIMA: [190, 98], GOSHIKI: [182, 92], TENDO: [188, 88], KAWANISHI: [189, 82], OHIRA: [185, 86], YAMAGATA: [171, 70],
    KOGANEGAWA: [192, 82], FUTAKUCHI: [184, 88], OBARA: [186, 84], AONE: [192, 86], KAMASAKI: [186, 84], SAKUNAMI: [166, 70],
    ATSUMU: [184, 88], OSAMU: [184, 88], GINJIMA: [177, 88], SUNA: [186, 86], OMIMI: [194, 84], OJIRO: [186, 90], AKAGI: [169, 72],
    KENMA: [169, 74], TAKETORA: [178, 92], KAI: [182, 82], KUROO: [188, 88], LEV: [194, 88], FUKUNAGA: [180, 86], YAKU: [165, 70],
    AKAASHI: [182, 84], BOKUTO: [185, 98], KONOHA: [178, 86], WASHIO: [185, 86], ONAGA: [190, 84], SARUKUI: [177, 86], KOMI: [168, 70],
    IIZUNA: [175, 82], SAKUSA: [189, 92], KOMORI: [172, 72],
    HOSHIUMI: [172, 110], HIRUGAMI: [192, 86], HAKUBA: [204, 80],
    KIRYU: [190, 92], HYAKUZAWA: [201, 78], TERUSHIMA: [181, 90], NAKASHIMA: [172, 100], DAISHO: [181, 86], NUMAI: [182, 88]
  };
  Object.keys(HQ_KNOWN).forEach(function (k) { VB.KNOWN[k] = HQ_KNOWN[k]; });

  var BLACK = "#17120d", BROWN = "#3a2416", BLOND = "#e8d27a";
  VB.HQ_TEAMS = [
    { id: "KAR", name: "KARASUNO", flag: "🐦", ovr: 88, kit: "#1b1b1b", kit2: "#ff7a1a",
      players: { S: "KAGEYAMA", OH1: "TANAKA", OH2: "SAWAMURA", MB1: "HINATA", MB2: "TSUKISHIMA", OP: "AZUMANE", L: "NISHINOYA" },
      stars: { S: "dump", MB1: "spike", MB2: "block", OP: "spike", L: "dig", OH2: "rec" },
      skillNames: { S: "KING'S DUMP", MB1: "MINUS TEMPO", MB2: "READ BLOCK", OP: "ACE SPIKE", L: "ROLLING THUNDER", OH2: "CAPTAIN'S RECEIVE" },
      hair: { S: BLACK, OH1: "#4a4a4a", OH2: BLACK, MB1: "#ff7a1a", MB2: BLOND, OP: BROWN, L: BLACK }, style: { OH1: 3, MB1: 2, L: 2 },
      combo: { hitter: "MB1", label: "FREAK QUICK", say: "the FREAK QUICK", tempo: 0.22, needPass: 1, x: 250, peak: 0.12 } },
    { id: "AOB", name: "AOBA JOHSAI", flag: "🌿", ovr: 87, kit: "#5ac8c8", kit2: "#ffffff",
      players: { S: "OIKAWA", OH1: "IWAIZUMI", OH2: "HANAMAKI", MB1: "MATSUKAWA", MB2: "KINDAICHI", OP: "KYOTANI", L: "WATARI" },
      stars: { S: "serve", OH1: "spike", OP: "spike", L: "rec" },
      skillNames: { S: "KILLER SERVE", OH1: "ACE OF SEIJOH", OP: "MAD DOG SPIKE", L: "STEADY RECEIVE" },
      hair: { S: "#6b4423", OH1: BLACK, OH2: "#e39ac0", MB1: BLACK, MB2: BLACK, OP: BLOND, L: BLACK }, style: { OH1: 2, MB2: 2, L: 3 } },
    { id: "SHI", name: "SHIRATORIZAWA", flag: "🦢", ovr: 90, kit: "#7a3fb0", kit2: "#ffffff",
      players: { S: "SHIRABU", OH1: "USHIJIMA", OH2: "GOSHIKI", MB1: "TENDO", MB2: "KAWANISHI", OP: "OHIRA", L: "YAMAGATA" },
      stars: { OH1: "spike", MB1: "block", OH2: "spike", L: "dig" },
      skillNames: { OH1: "LEFTY CANNON", MB1: "GUESS BLOCK", OH2: "LINE SHOT", L: "GUARDIAN DIG" },
      hair: { S: "#6b4423", OH1: "#3a3a2a", OH2: BLACK, MB1: "#e83a2a", MB2: "#6b4423", OP: BLACK, L: "#6b4423" }, style: { MB1: 2 } },
    { id: "INA", name: "INARIZAKI", flag: "🦊", ovr: 92, kit: "#7a1424", kit2: "#ffffff",
      players: { S: "ATSUMU", OH1: "OSAMU", OH2: "GINJIMA", MB1: "SUNA", MB2: "OMIMI", OP: "OJIRO", L: "AKAGI" },
      stars: { S: "serve", MB1: "spike", MB2: "block", OP: "spike" },
      skillNames: { S: "DUAL SERVE", MB1: "BODY-TILT SPIKE", MB2: "STONE WALL", OP: "ACE OJIRO" },
      hair: { S: BLOND, OH1: "#a0a0a0", OH2: BLACK, MB1: BROWN, MB2: BLACK, OP: BLACK, L: "#6b4423" }, skin: { OP: 4 }, style: { OP: 3 },
      combo: { hitter: "OH1", label: "TWIN QUICK", say: "the MIYA TWIN QUICK", tempo: 0.3, needPass: 2, x: 220, peak: 0.2 } },
    { id: "NEK", name: "NEKOMA", flag: "🐱", ovr: 86, kit: "#d22630", kit2: "#ffffff",
      players: { S: "KENMA", OH1: "TAKETORA", OH2: "KAI", MB1: "KUROO", MB2: "LEV", OP: "FUKUNAGA", L: "YAKU" },
      stars: { S: "dump", OH1: "spike", MB1: "block", L: "dig" },
      skillNames: { S: "KENMA'S GAMBIT", OH1: "CROSS SPIKE", MB1: "KILL BLOCK", L: "NEKOMA GUARDIAN" },
      hair: { S: "#e8c23a", OH1: "#d8a03a", OH2: BLACK, MB1: BLACK, MB2: "#d8d8d8", OP: BLACK, L: "#c8a070" }, style: { OH1: 2, MB1: 2 } },
    { id: "FUK", name: "FUKURODANI", flag: "🦉", ovr: 88, kit: "#3a3a3a", kit2: "#ffd21e",
      players: { S: "AKAASHI", OH1: "BOKUTO", OH2: "KONOHA", MB1: "WASHIO", MB2: "ONAGA", OP: "SARUKUI", L: "KOMI" },
      stars: { S: "dump", OH1: "spike" },
      skillNames: { S: "QUIET DUMP", OH1: "STRAIGHT KILL" },
      hair: { S: BLACK, OH1: "#d8d8d8", OH2: BLOND, MB1: BLACK, MB2: BLACK, OP: BLACK, L: "#6b4423" }, style: { OH1: 2 } },
    { id: "ITC", name: "ITACHIYAMA", flag: "🦦", ovr: 93, kit: "#2a8a4a", kit2: "#ffffff",
      players: { S: "IIZUNA", OH1: "SAKUSA", L: "KOMORI" },
      stars: { S: "dump", OH1: "spike", L: "rec" },
      skillNames: { S: "ACE SETTER DUMP", OH1: "WRIST SPIN", L: "PERFECT RECEIVE" },
      hair: { OH1: BLACK }, style: { OH1: 2 } },
    { id: "KAM", name: "KAMOMEDAI", flag: "🌊", ovr: 90, kit: "#3a7fd0", kit2: "#ffffff",
      players: { OH1: "HOSHIUMI", MB1: "HIRUGAMI", OP: "HAKUBA" },
      stars: { OH1: "spike", MB1: "block", OP: "spike" },
      skillNames: { OH1: "SMALL GIANT", MB1: "READ BLOCK", OP: "HIGH POINT" },
      hair: { OH1: "#f0f0f0", MB1: "#6b4423", OP: BLACK }, style: { OH1: 2 } },
    { id: "DAT", name: "DATE TECH", flag: "🛡️", ovr: 83, kit: "#2f9e5a", kit2: "#ffffff",
      players: { S: "KOGANEGAWA", OH1: "FUTAKUCHI", OH2: "OBARA", MB1: "AONE", MB2: "KAMASAKI", L: "SAKUNAMI" },
      stars: { MB1: "block", OH1: "spike" },
      skillNames: { MB1: "IRON WALL", OH1: "BLOCK-OUT SHOT" },
      hair: { S: BLOND, OH1: "#6b4423", MB1: "#d8d8d8" }, style: { MB1: 3, S: 2 } },
    { id: "MUJ", name: "MUJINAZAKA", flag: "⚡", ovr: 85, kit: "#2b4f9e", kit2: "#ffffff",
      players: { OP: "KIRYU" }, stars: { OP: "spike" }, skillNames: { OP: "BANZAI BANG" }, hair: { OP: BLACK } },
    { id: "NOH", name: "NOHEBI", flag: "🐍", ovr: 82, kit: "#3f6b2a", kit2: "#ffffff",
      players: { OH1: "DAISHO", OH2: "NUMAI" }, stars: { OH1: "block" }, skillNames: { OH1: "SNAKE BLOCK" }, hair: { OH1: BLACK } },
    { id: "JOH", name: "JOHZENJI", flag: "🎉", ovr: 80, kit: "#ff9a3a", kit2: "#1b1b1b",
      players: { OH1: "TERUSHIMA" }, stars: { OH1: "spike" }, skillNames: { OH1: "PARTY SPIKE" }, hair: { OH1: BLOND }, style: { OH1: 2 } },
    { id: "KAK", name: "KAKUGAWA", flag: "🗼", ovr: 79, kit: "#e0b800", kit2: "#1b1b1b",
      players: { OP: "HYAKUZAWA" }, stars: { OP: "spike" }, skillNames: { OP: "TOWER SPIKE" } },
    { id: "WAK", name: "WAKUTANI SOUTH", flag: "🌲", ovr: 78, kit: "#2aa6d6", kit2: "#ffffff",
      players: { OH1: "NAKASHIMA" }, stars: { OH1: "spike" }, skillNames: { OH1: "WIPE KING" } },
    { id: "TSU", name: "TSUBAKIHARA", flag: "🌺", ovr: 77, kit: "#c03a8a", kit2: "#ffffff", players: {}, stars: {} },
    { id: "UBU", name: "UBUGAWA", flag: "🏔️", ovr: 76, kit: "#3aa0a0", kit2: "#ffffff", players: {}, stars: {} }
  ];
  // high schoolers run shorter than pros
  VB.HQ_TEAMS.forEach(function (t) { t.nat = "JPN"; t.ages = [16, 18]; t.short = t.name; t.heightAdj = -9; t.ovr = VB.scaleHS(t.ovr); });
})(window.VB);
