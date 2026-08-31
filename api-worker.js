/* ============================================================
   Soai — combined Worker: serves the static site AND the backend API.
   Static files are served automatically by Cloudflare Assets; this
   script only handles the API routes below.

   Bindings (see wrangler.toml): KV namespace SOAI.
   Admin password: ADMIN_KEY secret if set, else the default below.
   ============================================================ */

const DEFAULT_ADMIN_KEY = "64928";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Admin-Key",
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}
async function sha256(s) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(String(s)));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
}
function isAdmin(req, env) {
  const k = req.headers.get("X-Admin-Key");
  const expected = (env && env.ADMIN_KEY) || DEFAULT_ADMIN_KEY;
  return !!(k && k === expected);
}
const ROLES = ["Setter", "Outside Hitter", "Middle Blocker", "Opposite", "Libero", "All Rounder", "Sub"];
function cleanPlayers(arr) {
  if (!Array.isArray(arr)) return [];
  return arr.map(p => {
    if (typeof p === "string") return { name: p.trim().slice(0, 40), photo: "", role: "" };
    if (p && typeof p === "object") {
      return {
        name: String(p.name == null ? "" : p.name).trim().slice(0, 40),
        photo: typeof p.photo === "string" ? p.photo : "",
        role: ROLES.includes(p.role) ? p.role : "",
      };
    }
    return null;
  }).filter(p => p && p.name).slice(0, 30);
}
function cleanStr(s, n) { return String(s == null ? "" : s).trim().slice(0, n); }
/* preseason scrims: seed data + set-score sanitiser */
/* Season 2 registered players (from the team-registration forum) — the
   seed roster for the admin-managed player stats. */
const DEFAULT_PLAYERS = [
  { id: "p_001", name: "NewAccountZX194", team: "Miku", pos: "Libero" },
  { id: "p_002", name: "PowerHext", team: "Miku", pos: "Middle" },
  { id: "p_003", name: "4Quantum_Mechanic", team: "Miku", pos: "Outside/Setter" },
  { id: "p_004", name: "adeeblox", team: "Miku", pos: "Opposite" },
  { id: "p_005", name: "kiwiikaleb", team: "Miku", pos: "Middle/Setter" },
  { id: "p_006", name: "gileshong1", team: "Miku", pos: "Outside/Opposite" },
  { id: "p_007", name: "Minir2k", team: "Miku", pos: "All-Rounder", cap: true },
  { id: "p_008", name: "TeemoABC", team: "Miku", pos: "All-Rounder" },
  { id: "p_009", name: "EVOSgar150848", team: "Miku", pos: "Outside" },
  { id: "p_010", name: "YoshiroKoiske", team: "Miku", pos: "Opposite/Middle" },
  { id: "p_011", name: "Bloop906", team: "Miku", pos: "Opposite/Middle" },
  { id: "p_012", name: "BlockBusta5", team: "Miku", pos: "Libero" },
  { id: "p_013", name: "Trixiine_glitcher", team: "Miku", pos: "Setter" },
  { id: "p_014", name: "codyjay_5", team: "Miku", pos: "Outside/Opposite" },
  { id: "p_015", name: "seanbahopo", team: "Miku", pos: "Outside" },
  { id: "p_016", name: "Razu", team: "Miku", pos: "Middle" },
  { id: "p_017", name: "Darkenesuo", team: "Yakamoz", pos: "Middle", cap: true },
  { id: "p_018", name: "lodsan1122", team: "Yakamoz", pos: "Outside" },
  { id: "p_019", name: "wojnwfjn", team: "Yakamoz", pos: "Setter" },
  { id: "p_020", name: "pawpaWAOS", team: "Yakamoz", pos: "Outside" },
  { id: "p_021", name: "DeadPhysic", team: "Yakamoz", pos: "Opposite" },
  { id: "p_022", name: "ItsGrof", team: "Yakamoz", pos: "Middle" },
  { id: "p_023", name: "TheDOtheSO", team: "Yakamoz", pos: "All-Rounder" },
  { id: "p_024", name: "Dee7055", team: "Yakamoz", pos: "All-Rounder" },
  { id: "p_025", name: "Mirto", team: "Stinger", pos: "All-Rounder", cap: true },
  { id: "p_026", name: "Vazelin", team: "Stinger", pos: "Outside" },
  { id: "p_027", name: "Sloth", team: "Stinger", pos: "All-Rounder" },
  { id: "p_028", name: "Kukuruzni", team: "Stinger", pos: "Middle" },
  { id: "p_029", name: "Forget", team: "Stinger", pos: "Outside" },
  { id: "p_030", name: "AMX", team: "Stinger", pos: "Opposite" },
  { id: "p_031", name: "Nomo", team: "Stinger", pos: "All-Rounder" },
  { id: "p_032", name: "Special", team: "Stinger", pos: "Opposite" },
  { id: "p_033", name: "Oblachko", team: "Stinger", pos: "Opposite" },
  { id: "p_034", name: "hiori", team: "Stinger", pos: "Setter" },
  { id: "p_035", name: "s0nr4ku", team: "Sendai Crows", pos: "Outside", cap: true },
  { id: "p_036", name: "delta_kendo", team: "Sendai Crows", pos: "Middle" },
  { id: "p_037", name: "TFX310", team: "Sendai Crows", pos: "Opposite" },
  { id: "p_038", name: "kyle292800", team: "Sendai Crows", pos: "All-Rounder" },
  { id: "p_039", name: "WanderWithAmi", team: "Sendai Crows", pos: "Setter" },
  { id: "p_040", name: "mec5md", team: "Sendai Crows", pos: "Outside/Middle" },
  { id: "p_041", name: "danielpogiramos", team: "Sendai Crows", pos: "All-Rounder" },
  { id: "p_042", name: "loudaFAEKGAMER", team: "Sendai Crows", pos: "Middle" },
  { id: "p_043", name: "KrunchyA", team: "Sendai Crows", pos: "Outside" },
  { id: "p_044", name: "Quadriono", team: "Sendai Crows", pos: "Middle" },
  { id: "p_045", name: "LJAL1414", team: "Sendai Crows", pos: "Middle" },
  { id: "p_046", name: "buddysing466", team: "Sendai Crows", pos: "Outside/Opposite" },
  { id: "p_047", name: "iAspxctt", team: "Sendai Crows", pos: "Outside/Opposite" },
  { id: "p_048", name: "Takigawa24", team: "Umino", pos: "All-Rounder" },
  { id: "p_049", name: "ImYourBackpack", team: "Umino", pos: "Opposite/Outside", cap: true },
  { id: "p_050", name: "edanacain3", team: "Umino", pos: "Middle" },
  { id: "p_051", name: "UchihaJpmark", team: "Umino", pos: "Setter" },
  { id: "p_052", name: "memenoob345", team: "Umino", pos: "Outside" },
  { id: "p_053", name: "Beta_XY", team: "Umino", pos: "Middle/Outside" },
  { id: "p_054", name: "choi_miri0", team: "Umino", pos: "Libero" },
  { id: "p_055", name: "zxnqt6", team: "Umino", pos: "Outside" },
  { id: "p_056", name: "memaybe_hungry", team: "Umino", pos: "Outside" },
  { id: "p_057", name: "haaeung", team: "Umino", pos: "Opposite" },
  { id: "p_058", name: "ygolpogi", team: "Umino", pos: "Middle/Outside" },
  { id: "p_059", name: "Dazza6111", team: "Vanguard", pos: "Setter" },
  { id: "p_060", name: "xpr_orxprap", team: "Vanguard", pos: "Opposite" },
  { id: "p_061", name: "it0ylilk1ds", team: "Vanguard", pos: "Libero" },
  { id: "p_062", name: "Monkeybsj", team: "Vanguard", pos: "All-Rounder" },
  { id: "p_063", name: "Aryentei", team: "Vanguard", pos: "Outside" },
  { id: "p_064", name: "Vanity_io", team: "Vanguard", pos: "Outside", cap: true },
  { id: "p_065", name: "neonoppaein", team: "Vanguard", pos: "Opposite" },
  { id: "p_066", name: "Action_penguin20", team: "Vanguard", pos: "Libero" },
  { id: "p_067", name: "vexvex_skittles", team: "Vanguard", pos: "Outside" },
  { id: "p_068", name: "daremardulce", team: "Vanguard", pos: "Setter" },
  { id: "p_069", name: "CoasMeyd", team: "Vanguard", pos: "All-Rounder" },
  { id: "p_070", name: "GodEdgeLordz", team: "Vanguard", pos: "All-Rounder" },
  { id: "p_071", name: "Grahlx", team: "Vanguard", pos: "Middle" },
  { id: "p_072", name: "apoleonicAvy", team: "Vanguard", pos: "Outside" },
  { id: "p_073", name: "tarutane", team: "Vanguard", pos: "Middle" },
  { id: "p_074", name: "The_ToxicCreeper", team: "Vanguard", pos: "Middle" },
  { id: "p_075", name: "TTBPCCCA65437", team: "Seishin Skyblade", pos: "All-Rounder", cap: true },
  { id: "p_076", name: "thekillerreyven", team: "Seishin Skyblade", pos: "Setter" },
  { id: "p_077", name: "Green_Power0928", team: "Seishin Skyblade", pos: "Outside" },
  { id: "p_078", name: "hjfdfhudfvgfhj", team: "Seishin Skyblade", pos: "Outside" },
  { id: "p_079", name: "ybanez", team: "Seishin Skyblade", pos: "Libero" },
  { id: "p_080", name: "AvengersWanda", team: "Seishin Skyblade", pos: "Opposite/Setter" },
  { id: "p_081", name: "prestomentom", team: "Seishin Skyblade", pos: "Opposite/Setter" },
  { id: "p_082", name: "Phantom_Spark214", team: "Seishin Skyblade", pos: "Middle/Libero" },
  { id: "p_083", name: "fddhvffg", team: "Seishin Skyblade", pos: "Opposite" },
  { id: "p_084", name: "coolfire32134", team: "Seishin Skyblade", pos: "Setter/Opposite" },
  { id: "p_085", name: "Arsenalimuchgood", team: "Seishin Skyblade", pos: "Opposite" },
  { id: "p_086", name: "Yuuko_yuuji", team: "Seishin Skyblade", pos: "Middle/Libero" },
  { id: "p_087", name: "iker123tr", team: "Seishin Skyblade", pos: "Outside" },
  { id: "p_088", name: "fljjn1920", team: "Seishin Skyblade", pos: "Outside" },
  { id: "p_089", name: "periodoftimeandspace", team: "Seishin Skyblade", pos: "Libero" },
  { id: "p_090", name: "5h4r1ngan", team: "Orchid", pos: "Setter" },
  { id: "p_091", name: "Creeperbean10", team: "Orchid", pos: "Opposite" },
  { id: "p_092", name: "Yaretzi_2976", team: "Orchid", pos: "Middle" },
  { id: "p_093", name: "UOUUZ2", team: "Orchid", pos: "Outside/Middle" },
  { id: "p_094", name: "cvrmichxl", team: "Orchid", pos: "All-Rounder", cap: true },
  { id: "p_095", name: "bad_gorl532", team: "Orchid", pos: "Libero" },
  { id: "p_096", name: "71K14", team: "Orchid", pos: "Setter" },
  { id: "p_097", name: "Asunaa247", team: "Orchid", pos: "Setter/Outside" },
  { id: "p_098", name: "qwertfddddddd", team: "Orchid", pos: "Outside/Opposite" },
  { id: "p_099", name: "syntheno", team: "Orchid", pos: "Middle" },
  { id: "p_100", name: "justinbeab", team: "Orchid", pos: "Outside" },
  { id: "p_101", name: "6PotatoStash9", team: "Orchid", pos: "Outside" },
  { id: "p_102", name: "AkoLangToh08912", team: "Orchid", pos: "Outside/Opposite" },
  { id: "p_103", name: "Lazybirdzz", team: "Orchid", pos: "Outside/Middle" },
  { id: "p_104", name: "SirCoolGuy1015", team: "Orchid", pos: "All-Rounder" },
  { id: "p_105", name: "XxkenkanekixX123765", team: "Orchid", pos: "All-Rounder" },
  { id: "p_106", name: "Ke7Lz", team: "The Order", pos: "All-Rounder", cap: true },
  { id: "p_107", name: "Elemenstreem", team: "The Order", pos: "Outside" },
  { id: "p_108", name: "xxHaPpYxx40", team: "The Order", pos: "Outside" },
  { id: "p_109", name: "oneonlyy", team: "The Order", pos: "Middle" },
  { id: "p_110", name: "Zanogrid", team: "The Order", pos: "Libero/Setter" },
  { id: "p_111", name: "Notinnapropieta", team: "The Order", pos: "Opposite" },
  { id: "p_112", name: "rgnaltaccount", team: "The Order", pos: "Setter/Libero" },
  { id: "p_113", name: "Crzycyko", team: "The Order", pos: "Outside" },
  { id: "p_114", name: "wawxenbow", team: "The Order", pos: "Libero" },
  { id: "p_115", name: "jzxicy", team: "The Order", pos: "Opposite" },
  { id: "p_116", name: "Elite_Ranks", team: "The Order", pos: "Middle" },
  { id: "p_117", name: "reneealexander", team: "The Order", pos: "All-Rounder" },
  { id: "p_118", name: "Eggyheadnooby", team: "The Order", pos: "All-Rounder" },
  { id: "p_119", name: "howdits", team: "The Order", pos: "Libero" },
  { id: "p_120", name: "D4C_KQ", team: "Kittyoo", pos: "All-Rounder", cap: true },
  { id: "p_121", name: "SOUL_NIGHT10", team: "Kittyoo", pos: "Outside/Middle" },
  { id: "p_122", name: "GONGKAK", team: "Kittyoo", pos: "Opposite" },
  { id: "p_123", name: "marvellling", team: "Kittyoo", pos: "Outside" },
  { id: "p_124", name: "Ivanlooi25", team: "Kittyoo", pos: "Outside/Libero" },
  { id: "p_125", name: "Lilithxia2712", team: "Kittyoo", pos: "Outside" },
  { id: "p_126", name: "noob_oguriSucks", team: "Kittyoo", pos: "Opposite/Outside" },
  { id: "p_127", name: "ofjezjezs", team: "Kittyoo", pos: "Middle/Libero" },
  { id: "p_128", name: "Lordcalypso", team: "Kittyoo", pos: "Libero" },
  { id: "p_129", name: "despavitar", team: "Kittyoo", pos: "Setter" },
  { id: "p_130", name: "TheLejendsQueen", team: "Kittyoo", pos: "Outside" },
  { id: "p_131", name: "N4_47", team: "Kittyoo", pos: "Middle" },
  { id: "p_132", name: "jorace20", team: "Kittyoo", pos: "Outside/Setter" },
  { id: "p_133", name: "chaous1000", team: "Kittyoo", pos: "Opposite/Middle" },
  { id: "p_134", name: "iam_north69699", team: "Kittyoo", pos: "Middle" },
  { id: "p_135", name: "jo_odmardeni", team: "Kittyoo", pos: "Middle" },
  { id: "p_136", name: "LB_Tempted", team: "Teiko", pos: "Setter" },
  { id: "p_137", name: "zimon25", team: "Teiko", pos: "Middle" },
  { id: "p_138", name: "Choiixzn", team: "Teiko", pos: "Middle" },
  { id: "p_139", name: "RisingBlades", team: "Teiko", pos: "All-Rounder", cap: true },
  { id: "p_140", name: "rehaniv12", team: "Teiko", pos: "Outside" },
  { id: "p_141", name: "Ace_Ish1kawa", team: "Teiko", pos: "Opposite" },
  { id: "p_142", name: "DarkEclips_e", team: "Teiko", pos: "All-Rounder" },
  { id: "p_143", name: "AnkaaMGL0804", team: "Teiko", pos: "Outside" },
  { id: "p_144", name: "gwagwacattroll", team: "Teiko", pos: "Libero" },
  { id: "p_145", name: "TW_Jupiter", team: "Teiko", pos: "Outside" },
  { id: "p_146", name: "DominuzGrey", team: "Teiko", pos: "Setter" },
  { id: "p_147", name: "RoyaleMice6", team: "Equinox", pos: "Setter/All-Rounder", cap: true },
  { id: "p_148", name: "memenoob345", team: "Equinox", pos: "Outside/All-Rounder" },
  { id: "p_149", name: "sulhipip", team: "Equinox", pos: "Outside/Opposite" },
  { id: "p_150", name: "kouuuuuuw", team: "Equinox", pos: "Middle" },
  { id: "p_151", name: "KungKangg", team: "Equinox", pos: "Middle/Libero" },
  { id: "p_152", name: "Gelatinousious", team: "Equinox", pos: "Opposite/All-Rounder" },
  { id: "p_153", name: "GGgrazyGG", team: "Equinox", pos: "Libero/Middle" },
  { id: "p_154", name: "NABILGOTMELIKE", team: "Equinox", pos: "Setter/Libero" },
  { id: "p_155", name: "Pazzel", team: "Equinox", pos: "Outside/Setter" },
  { id: "p_156", name: "vex", team: "Equinox", pos: "Opposite/Middle" },
  { id: "p_157", name: "lwkeyfinn", team: "Equinox", pos: "Middle/Outside" },
  { id: "p_158", name: "DarkJackxx12", team: "Equinox", pos: "Opposite/Outside" },
  { id: "p_159", name: "tadatsuneshinkai", team: "Equinox", pos: "Opposite/Middle" },
  { id: "p_160", name: "kenderdragoonca74", team: "Equinox", pos: "Outside" },
  { id: "p_161", name: "llewor1234", team: "Equinox", pos: "Opposite/Middle" },
];
const BLANK_STATS = { games: 0, kills: 0, aces: 0, blocks: 0, digs: 0, assists: 0 };
function cleanPStats(s) {
  const out = {};
  for (const k in BLANK_STATS) { const v = +((s || {})[k]); out[k] = isFinite(v) && v >= 0 ? Math.round(v * 10) / 10 : 0; }
  return out;
}
function seedPlayers() { return DEFAULT_PLAYERS.map(p => ({ id: p.id, name: p.name, team: p.team, pos: p.pos, cap: !!p.cap, stats: { ...BLANK_STATS } })); }
/* Season 2 team list — the 13 teams in the official group-stage draw */
/* Official Season 2 group-stage plan: 13 teams, Group A of 7 / Group B of 6,
   single round robin, every match BO3, nights at 7pm/8pm GMT+8. `when` is an
   absolute epoch so every visitor sees their own local time. */
const S2_GROUP_DRAW = { A: ["Equinox", "The Order", "Miku", "Seishin Skyblade", "Kittyoo", "Yakamoz"], B: ["Invictus", "Vanguard", "Sendai Crows", "Umino", "Teiko", "Orchid"] };
const DEFAULT_S2_FIXTURES = [
  { id: "s2n01_19", teamA: "Equinox", teamB: "Kittyoo", stage: "regular", when: 1788001200000, sets: null, createdAt: 1 },
  { id: "s2n01_20", teamA: "Invictus", teamB: "Orchid", stage: "regular", when: 1788004800000, sets: null, createdAt: 2 },
  { id: "s2n02_19", teamA: "The Order", teamB: "Seishin Skyblade", stage: "regular", when: 1788087600000, sets: null, createdAt: 3 },
  { id: "s2n02_20", teamA: "Vanguard", teamB: "Teiko", stage: "regular", when: 1788091200000, sets: null, createdAt: 4 },
  { id: "s2n03_20", teamA: "Sendai Crows", teamB: "Umino", stage: "regular", when: 1788177600000, sets: null, createdAt: 6 },
  { id: "s2n04_19", teamA: "Equinox", teamB: "Seishin Skyblade", stage: "regular", when: 1788260400000, sets: null, createdAt: 7 },
  { id: "s2n04_20", teamA: "Invictus", teamB: "Teiko", stage: "regular", when: 1788264000000, sets: null, createdAt: 8 },
  { id: "s2n05_20", teamA: "Orchid", teamB: "Umino", stage: "regular", when: 1788350400000, sets: null, createdAt: 10 },
  { id: "s2n06_19", teamA: "The Order", teamB: "Miku", stage: "regular", when: 1788433200000, sets: null, createdAt: 11 },
  { id: "s2n06_20", teamA: "Vanguard", teamB: "Sendai Crows", stage: "regular", when: 1788436800000, sets: null, createdAt: 12 },
  { id: "s2n07_20", teamA: "Invictus", teamB: "Umino", stage: "regular", when: 1788523200000, sets: null, createdAt: 14 },
  { id: "s2n08_19", teamA: "Yakamoz", teamB: "The Order", stage: "regular", when: 1788606000000, sets: null, createdAt: 15 },
  { id: "s2n08_20", teamA: "Teiko", teamB: "Sendai Crows", stage: "regular", when: 1788609600000, sets: null, createdAt: 16 },
  { id: "s2n09_19", teamA: "Seishin Skyblade", teamB: "Miku", stage: "regular", when: 1788692400000, sets: null, createdAt: 17 },
  { id: "s2n09_20", teamA: "Orchid", teamB: "Vanguard", stage: "regular", when: 1788696000000, sets: null, createdAt: 18 },
  { id: "s2n10_19", teamA: "Kittyoo", teamB: "The Order", stage: "regular", when: 1788778800000, sets: null, createdAt: 19 },
  { id: "s2n11_19", teamA: "Equinox", teamB: "Miku", stage: "regular", when: 1788865200000, sets: null, createdAt: 21 },
  { id: "s2n11_20", teamA: "Invictus", teamB: "Sendai Crows", stage: "regular", when: 1788868800000, sets: null, createdAt: 22 },
  { id: "s2n12_19", teamA: "Yakamoz", teamB: "Kittyoo", stage: "regular", when: 1788951600000, sets: null, createdAt: 23 },
  { id: "s2n12_20", teamA: "Umino", teamB: "Vanguard", stage: "regular", when: 1788955200000, sets: null, createdAt: 24 },
  { id: "s2n13_20", teamA: "Teiko", teamB: "Orchid", stage: "regular", when: 1789041600000, sets: null, createdAt: 26 },
  { id: "s2n14_19", teamA: "Yakamoz", teamB: "Miku", stage: "regular", when: 1789124400000, sets: null, createdAt: 27 },
  { id: "s2n14_20", teamA: "Seishin Skyblade", teamB: "Kittyoo", stage: "regular", when: 1789128000000, sets: null, createdAt: 28 },
  { id: "s2n15_19", teamA: "Equinox", teamB: "The Order", stage: "regular", when: 1789210800000, sets: null, createdAt: 29 },
  { id: "s2n15_20", teamA: "Invictus", teamB: "Vanguard", stage: "regular", when: 1789214400000, sets: null, createdAt: 30 },
  { id: "s2n16_19", teamA: "Yakamoz", teamB: "Seishin Skyblade", stage: "regular", when: 1789297200000, sets: null, createdAt: 31 },
  { id: "s2n16_20", teamA: "Sendai Crows", teamB: "Orchid", stage: "regular", when: 1789300800000, sets: null, createdAt: 32 },
  { id: "s2n17_19", teamA: "Miku", teamB: "Kittyoo", stage: "regular", when: 1789383600000, sets: null, createdAt: 33 },
  { id: "s2n17_20", teamA: "Umino", teamB: "Teiko", stage: "regular", when: 1789387200000, sets: null, createdAt: 34 },
  { id: "s2n18_20", teamA: "Yakamoz", teamB: "Equinox", stage: "regular", when: 1789473600000, sets: null, createdAt: 36 },
];
const DEFAULT_S2_TEAMS = ["Vanguard", "The Order", "Equinox", "Miku", "Umino", "Teiko", "Orchid", "Kittyoo", "Seishin Skyblade", "Sendai Crows", "Yakamoz", "Invictus"];
const DEFAULT_SCRIM_TEAMS = ["Green Giants", "Equinox", "Senzai", "Seishin Skyblade", "The Order", "Canopus", "Miku", "Vanguard", "Volare", "Teiko", "Zenith", "Nekopara", "Ground Zero", "Invictus", "Stinger", "Ho-Kago Kawaii Larps", "Yakamoz", "Kittyoo"];
const DEFAULT_SCRIMS = [
  { id: "seed_gg_neko", teamA: "Green Giants", teamB: "Nekopara", sets: [{ a: 25, b: 23 }, { a: 25, b: 15 }], createdAt: 1 },
  { id: "seed_van_gg", teamA: "Vanguard", teamB: "Green Giants", sets: [{ a: 25, b: 21 }, { a: 25, b: 15 }], createdAt: 2 },
  { id: "seed_sen_gz", teamA: "Senzai", teamB: "Ground Zero", sets: [{ w: "A" }, { w: "A" }], createdAt: 3 },
  { id: "seed_van_hkk", teamA: "Vanguard", teamB: "Ho-Kago Kawaii Larps", sets: [{ a: 25, b: 19 }, { a: 25, b: 18 }], createdAt: 4 },
  { id: "seed_sen_sei", teamA: "Senzai", teamB: "Seishin Skyblade", sets: [{ a: 25, b: 16 }, { a: 25, b: 19 }], createdAt: 5 },
  { id: "seed_miku_neko", teamA: "Miku", teamB: "Nekopara", sets: [{ a: 14, b: 25 }, { a: 22, b: 25 }], createdAt: 6 },
  { id: "seed_inv_can", teamA: "Invictus", teamB: "Canopus", sets: [{ a: 25, b: 19 }, { a: 25, b: 20 }], createdAt: 7 },
  { id: "seed_sei_inv", teamA: "Seishin Skyblade", teamB: "Invictus", sets: [{ a: 12, b: 25 }, { a: 19, b: 25 }], createdAt: 8 },
  { id: "seed_inv_gz", teamA: "Invictus", teamB: "Ground Zero", sets: [{ w: "A" }, { w: "A" }], createdAt: 9 },
  { id: "seed_miku_eq", teamA: "Miku", teamB: "Equinox", sets: [{ a: 25, b: 23 }, { a: 16, b: 25 }, { a: 25, b: 23 }], createdAt: 10 },
  { id: "seed_kit_van", teamA: "Kittyoo", teamB: "Vanguard", sets: [{ w: "B" }, { w: "B" }], createdAt: 11 },
  { id: "seed_neko_van", teamA: "Nekopara", teamB: "Vanguard", sets: [{ a: 20, b: 25 }, { a: 11, b: 25 }], createdAt: 12 },
  { id: "seed_zen_van", teamA: "Zenith", teamB: "Vanguard", sets: [{ a: 13, b: 25 }, { a: 25, b: 23 }, { a: 19, b: 25 }], createdAt: 13 },
  { id: "seed_order_can", teamA: "The Order", teamB: "Canopus", sets: [{ w: "A" }, { w: "A" }], createdAt: 14 },
  { id: "seed_inv_van", teamA: "Invictus", teamB: "Vanguard", sets: [{ a: 25, b: 21 }, { a: 18, b: 25 }, { a: 18, b: 25 }], createdAt: 15 },
  { id: "seed_gg_can", teamA: "Green Giants", teamB: "Canopus", sets: [{ a: 25, b: 19 }, { a: 25, b: 17 }], createdAt: 16 },
  { id: "seed_inv_zen", teamA: "Invictus", teamB: "Zenith", sets: [{ a: 25, b: 17 }, { a: 25, b: 17 }], createdAt: 17 },
  { id: "seed_sen_kit", teamA: "Senzai", teamB: "Kittyoo", sets: [{ w: "A" }, { w: "A" }], createdAt: 18 },
  { id: "seed_order_eq", teamA: "The Order", teamB: "Equinox", sets: [{ a: 25, b: 15 }, { a: 26, b: 24 }], createdAt: 19 },
  { id: "seed_eq_sen", teamA: "Equinox", teamB: "Senzai", sets: [{ a: 25, b: 19 }, { a: 25, b: 23 }], createdAt: 20 },
  { id: "seed_order_van", teamA: "The Order", teamB: "Vanguard", sets: [{ a: 18, b: 25 }, { a: 25, b: 21 }, { a: 25, b: 22 }], createdAt: 21 },
  { id: "seed_gg_van_ff", teamA: "Green Giants", teamB: "Vanguard", sets: [{ w: "B" }, { w: "B" }], createdAt: 22 },
  { id: "seed_miku_inv", teamA: "Miku", teamB: "Invictus", sets: [{ a: 24, b: 26 }, { a: 13, b: 25 }], createdAt: 23 },
  { id: "seed_sti_gz", teamA: "Stinger", teamB: "Ground Zero", sets: [{ a: 25, b: 15 }, { a: 25, b: 19 }], createdAt: 24 },
  { id: "seed_gg_order_ff", teamA: "Green Giants", teamB: "The Order", sets: [{ w: "B" }, { w: "B" }], createdAt: 25 },
  { id: "seed_gg_kit_ff", teamA: "Green Giants", teamB: "Kittyoo", sets: [{ w: "B" }, { w: "B" }], createdAt: 26 },
  { id: "seed_sen_van", teamA: "Senzai", teamB: "Vanguard", sets: [{ a: 18, b: 25 }, { a: 27, b: 25 }, { a: 15, b: 25 }], createdAt: 27 },
  { id: "seed_gg_sti_ff", teamA: "Green Giants", teamB: "Stinger", sets: [{ w: "B" }, { w: "B" }], createdAt: 28 },
  { id: "seed_miku_eq2", teamA: "Miku", teamB: "Equinox", sets: [{ a: 18, b: 25 }, { a: 25, b: 20 }, { a: 21, b: 25 }], createdAt: 29 },
  { id: "seed_miku_sti", teamA: "Miku", teamB: "Stinger", sets: [{ a: 25, b: 18 }, { a: 25, b: 13 }], createdAt: 30 },
  { id: "seed_eq_inv", teamA: "Equinox", teamB: "Invictus", sets: [{ a: 25, b: 23 }, { a: 24, b: 26 }, { a: 25, b: 23 }], createdAt: 31, day: 3 },
  { id: "seed_zen_inv", teamA: "Zenith", teamB: "Invictus", sets: [{ a: 25, b: 19 }, { a: 21, b: 25 }, { a: 25, b: 21 }], createdAt: 32, day: 3 },
  { id: "seed_van_zen", teamA: "Vanguard", teamB: "Zenith", sets: [{ a: 25, b: 11 }, { a: 25, b: 4 }, { a: 25, b: 9 }], createdAt: 33, day: 3 },
  { id: "seed_inv_sen", teamA: "Invictus", teamB: "Senzai", sets: [{ a: 19, b: 25 }, { a: 25, b: 23 }, { a: 25, b: 22 }], createdAt: 34, day: 3 },
  { id: "seed_order_sen", teamA: "The Order", teamB: "Senzai", sets: [{ a: 25, b: 11 }, { a: 25, b: 19 }], createdAt: 35, day: 3 },
  { id: "seed_eq_sti", teamA: "Equinox", teamB: "Stinger", sets: [{ a: 25, b: 18 }, { a: 25, b: 8 }], createdAt: 36, day: 3 },
  { id: "seed_order_sti", teamA: "The Order", teamB: "Stinger", sets: [{ a: 25, b: 22 }, { a: 25, b: 11 }], createdAt: 37, day: 4 },
  { id: "seed_vol_gz_ff", teamA: "Volare", teamB: "Ground Zero", sets: [{ w: "A" }, { w: "A" }], createdAt: 38, day: 5 },
  { id: "seed_van_inv", teamA: "Vanguard", teamB: "Invictus", sets: [{ a: 25, b: 22 }, { a: 25, b: 22 }], createdAt: 39, day: 5 },
  { id: "seed_eq_inv2", teamA: "Equinox", teamB: "Invictus", sets: [{ a: 25, b: 7 }, { a: 32, b: 30 }], createdAt: 40, day: 5 },
  { id: "seed_inv_vol_ff", teamA: "Invictus", teamB: "Volare", sets: [{ w: "A" }, { w: "A" }], createdAt: 41, day: 6 },
  { id: "seed_sen_vol", teamA: "Senzai", teamB: "Volare", sets: [{ a: 25, b: 18 }, { a: 25, b: 17 }], createdAt: 42, day: 6 },
  { id: "seed_order_inv", teamA: "The Order", teamB: "Invictus", sets: [{ a: 25, b: 17 }, { a: 22, b: 25 }, { a: 25, b: 22 }], createdAt: 43, day: 6 },
  { id: "seed_van_eq", teamA: "Vanguard", teamB: "Equinox", sets: [{ a: 25, b: 21 }, { a: 25, b: 19 }], createdAt: 44, day: 6 },
  { id: "seed_van_zen_ff", teamA: "Vanguard", teamB: "Zenith", sets: [{ w: "A" }, { w: "A" }], createdAt: 45, day: 7 },
  { id: "seed_miku_inv2", teamA: "Miku", teamB: "Invictus", sets: [{ a: 23, b: 25 }, { a: 25, b: 21 }, { a: 25, b: 19 }], createdAt: 46, day: 7 },
  { id: "seed_miku_zen", teamA: "Miku", teamB: "Zenith", sets: [{ a: 27, b: 29 }, { a: 25, b: 12 }, { a: 25, b: 13 }], createdAt: 47, day: 7 },
  { id: "seed_miku_sen", teamA: "Miku", teamB: "Senzai", sets: [{ a: 25, b: 21 }, { a: 19, b: 25 }, { a: 25, b: 22 }], createdAt: 48, day: 7 },
];
function cleanSets(arr) {
  if (!Array.isArray(arr)) return [];
  return arr.map(s => {
    if (s && typeof s.a === "number" && typeof s.b === "number" && isFinite(s.a) && isFinite(s.b)) {
      const a = Math.max(0, Math.round(s.a)), b = Math.max(0, Math.round(s.b));
      return a === b ? null : { a, b };   // a volleyball set can't tie
    }
    if (s && (s.w === "A" || s.w === "B")) return { w: s.w };
    return null;
  }).filter(Boolean).slice(0, 5);
}
/* which side won a decided fixture — "A", "B", or "" (unplayed / malformed) */
function fxWinnerSide(f) {
  if (!f || !Array.isArray(f.sets) || !f.sets.length) return "";
  let a = 0, b = 0;
  f.sets.forEach(st => {
    const hp = typeof st.a === "number" && typeof st.b === "number";
    if (hp) { st.a >= st.b ? a++ : b++; }
    else if (st.w === "A" || st.w === "B") { st.w === "A" ? a++ : b++; }
  });
  return a > b ? "A" : b > a ? "B" : "";
}
/* ---- official league record patch (applies once to stored data) ----
   Stinger withdrew after the draw: the team and its unplayed fixtures are
   removed wherever they still exist. Results below were announced in the
   league Discord and backfill any stored fixture that has no result yet
   (admin-entered results always win — the patch never overwrites). */
const S2_WITHDRAWN = ["Stinger"];
const S2_RESULTS_BACKFILL = {
  s2n01_19: [{ a: 25, b: 14 }, { a: 18, b: 25 }, { a: 17, b: 25 }],   // Equinox 1–2 Kittyoo (29/8)
  s2n01_20: [{ a: 25, b: 13 }, { a: 23, b: 25 }, { a: 25, b: 15 }],   // Invictus 2–1 Orchid (29/8)
  s2n02_19: [{ a: 25, b: 14 }, { a: 25, b: 17 }],                     // The Order 2–0 Seishin Skyblade (30/8)
  s2n02_20: [{ a: 22, b: 25 }, { a: 20, b: 25 }],                     // Vanguard 0–2 Teiko (30/8)
};
function healS2(d) {
  let changed = false;
  if (Array.isArray(d.teams)) {
    const t = d.teams.filter(n => S2_WITHDRAWN.indexOf(n) === -1);
    if (t.length !== d.teams.length) { d.teams = t; changed = true; }
  }
  if (Array.isArray(d.fixtures)) {
    const fx = d.fixtures.filter(f => S2_WITHDRAWN.indexOf(f.teamA) === -1 && S2_WITHDRAWN.indexOf(f.teamB) === -1);
    if (fx.length !== d.fixtures.length) { d.fixtures = fx; changed = true; }
    fx.forEach(f => {
      const patch = S2_RESULTS_BACKFILL[f.id];
      if (patch && !(f.sets && f.sets.length)) { f.sets = patch.map(s => ({ ...s })); changed = true; }
    });
  }
  return changed;
}
/* team pool: accept plain names (legacy) or {name, logo} → [{name, logo}] */
function normScrimTeams(arr) {
  return (Array.isArray(arr) ? arr : []).map(t => typeof t === "string"
    ? { name: cleanStr(t, 40), logo: "" }
    : { name: cleanStr(t && t.name, 40), logo: (t && typeof t.logo === "string") ? t.logo : "" }
  ).filter(t => t.name).slice(0, 100);
}
/* build a roster-change log from the old vs new player lists */
function diffPlayers(oldArr, newArr) {
  const norm = a => (Array.isArray(a) ? a : []).map(p => typeof p === "string" ? { name: p, role: "" } : { name: (p && p.name) || "", role: (p && p.role) || "" }).filter(p => p.name);
  const o = norm(oldArr), n = norm(newArr);
  const oNames = new Set(o.map(p => p.name)), nNames = new Set(n.map(p => p.name));
  const oRole = Object.fromEntries(o.map(p => [p.name, p.role]));
  const out = [];
  for (const p of n) if (!oNames.has(p.name)) out.push(`＋ ${p.name} joined${p.role ? ` (${p.role})` : ""}`);
  for (const p of o) if (!nNames.has(p.name)) out.push(`－ ${p.name} left`);
  for (const p of n) if (oNames.has(p.name) && (oRole[p.name] || "") !== (p.role || "")) out.push(`↺ ${p.name}: ${oRole[p.name] || "—"} → ${p.role || "—"}`);
  return out;
}
function appendLog(t, texts) {
  if (!Array.isArray(t.log)) t.log = [];
  const now = Date.now();
  for (const text of texts) t.log.push({ t: now, text });
  if (t.log.length > 100) t.log = t.log.slice(-100);
}
function cleanTitles(arr) { if (!Array.isArray(arr)) return []; return arr.map(s => cleanStr(s, 30)).filter(Boolean).slice(0, 6); }
function publicCoach(c) {
  return { id: c.id, name: c.name, pos: c.pos || "", discord: c.discord || "", blurb: c.blurb || "", photo: c.photo || "", banner: c.banner || "", createdAt: c.createdAt };
}
function publicProfile(pr) {
  return {
    id: pr.id, name: pr.name, roblox: pr.roblox || "", pos: pr.pos || "", bio: pr.bio || "",
    photo: pr.photo || "", titles: Array.isArray(pr.titles) ? pr.titles : [], verified: !!pr.verified,
    tagline: pr.tagline || "", createdAt: pr.createdAt,
  };
}
function publicTeam(t) {
  return {
    id: t.id, name: t.name, status: t.status, category: t.category || "League",
    logo: t.logo, banner: t.banner || "", captain: t.captain || "", discord: t.discord || "",
    jerseyFront: t.jerseyFront, jerseyBack: t.jerseyBack,
    players: Array.isArray(t.players) ? t.players : [],
    log: Array.isArray(t.log) ? t.log.slice(-30).reverse() : [],
    createdAt: t.createdAt,
  };
}

/* API routes — return a Response, or null to let a static asset serve it */
async function handleApi(req, env, url) {
  const p = url.pathname.replace(/\/+$/, "") || "/";
  const KV = env.SOAI;

  if (p === "/announcements" && req.method === "GET") {
    const a = await KV.get("announcements");
    return json(a ? JSON.parse(a) : []);
  }
  if (p === "/admin/announcements" && req.method === "POST") {
    if (!isAdmin(req, env)) return json({ error: "unauthorized" }, 401);
    const body = await req.json();
    await KV.put("announcements", JSON.stringify(Array.isArray(body.announcements) ? body.announcements : []));
    return json({ ok: true });
  }
  if (p === "/teams/register" && req.method === "POST") {
    const b = await req.json();
    if (!b.name || !b.password) return json({ error: "name and password are required" }, 400);
    const id = "t_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    const team = {
      id, name: String(b.name).slice(0, 60), status: "pending",
      category: b.category === "Binsu" ? "Binsu" : "League",
      logo: b.logo || "", banner: b.banner || "",
      captain: cleanStr(b.captain, 40), discord: cleanStr(b.discord, 40),
      jerseyFront: b.jerseyFront || "", jerseyBack: b.jerseyBack || "",
      players: cleanPlayers(b.players), log: [],
      passHash: await sha256(b.password), createdAt: Date.now(),
    };
    await KV.put("team:" + id, JSON.stringify(team));
    return json({ ok: true, id });
  }
  if (p === "/teams" && req.method === "GET") {
    const cat = url.searchParams.get("category");
    const list = await KV.list({ prefix: "team:" });
    const out = [];
    for (const k of list.keys) {
      const t = JSON.parse(await KV.get(k.name));
      if (t.status !== "approved") continue;
      if (cat && (t.category || "League") !== cat) continue;
      out.push(publicTeam(t));
    }
    out.sort((a, b) => a.createdAt - b.createdAt);   // match the client shim's ordering
    return json(out);
  }
  if (p === "/team" && req.method === "GET") {
    const raw = await KV.get("team:" + url.searchParams.get("id"));
    if (!raw) return json({ error: "not found" }, 404);
    const t = JSON.parse(raw);
    if (t.status !== "approved") return json({ error: "not found" }, 404);
    return json(publicTeam(t));
  }
  if (p === "/admin/teams" && req.method === "GET") {
    if (!isAdmin(req, env)) return json({ error: "unauthorized" }, 401);
    const list = await KV.list({ prefix: "team:" });
    const out = [];
    for (const k of list.keys) out.push(publicTeam(JSON.parse(await KV.get(k.name))));
    out.sort((a, b) => a.createdAt - b.createdAt);
    return json(out);
  }
  if (p === "/admin/teams/approve" && req.method === "POST") {
    if (!isAdmin(req, env)) return json({ error: "unauthorized" }, 401);
    const { id } = await req.json();
    const raw = await KV.get("team:" + id);
    if (!raw) return json({ error: "not found" }, 404);
    const t = JSON.parse(raw); t.status = "approved";
    await KV.put("team:" + id, JSON.stringify(t));
    return json({ ok: true });
  }
  if (p === "/admin/teams/reject" && req.method === "POST") {
    if (!isAdmin(req, env)) return json({ error: "unauthorized" }, 401);
    const { id } = await req.json();
    await KV.delete("team:" + id);
    return json({ ok: true });
  }
  if (p === "/admin/teams/category" && req.method === "POST") {
    if (!isAdmin(req, env)) return json({ error: "unauthorized" }, 401);
    const { id, category } = await req.json();
    const raw = await KV.get("team:" + id);
    if (!raw) return json({ error: "not found" }, 404);
    const t = JSON.parse(raw); t.category = category === "Binsu" ? "Binsu" : "League";
    await KV.put("team:" + id, JSON.stringify(t));
    return json({ ok: true });
  }
  /* a team edits its own roster using its team password */
  if (p === "/team/roster" && req.method === "POST") {
    const { id, password, players } = await req.json();
    const raw = await KV.get("team:" + id);
    if (!raw) return json({ error: "not found" }, 404);
    const t = JSON.parse(raw);
    if (t.passHash !== await sha256(password || "")) return json({ error: "wrong team password" }, 403);
    const changes = diffPlayers(t.players, players);
    t.players = cleanPlayers(players);
    appendLog(t, changes);
    await KV.put("team:" + id, JSON.stringify(t));
    return json({ ok: true, players: t.players });
  }
  /* a team edits its own info (captain, discord, banner) with its password */
  if (p === "/team/info" && req.method === "POST") {
    const { id, password, captain, discord, banner } = await req.json();
    const raw = await KV.get("team:" + id);
    if (!raw) return json({ error: "not found" }, 404);
    const t = JSON.parse(raw);
    if (t.passHash !== await sha256(password || "")) return json({ error: "wrong team password" }, 403);
    if (typeof captain === "string") { const v = cleanStr(captain, 40); if (v !== (t.captain || "")) appendLog(t, [`👑 Captain set to ${v || "—"}`]); t.captain = v; }
    if (typeof discord === "string") t.discord = cleanStr(discord, 40);
    if (typeof banner === "string" && banner) t.banner = banner;
    await KV.put("team:" + id, JSON.stringify(t));
    return json({ ok: true, team: publicTeam(t) });
  }
  /* the admin can edit any team's roster */
  if (p === "/admin/teams/roster" && req.method === "POST") {
    if (!isAdmin(req, env)) return json({ error: "unauthorized" }, 401);
    const { id, players } = await req.json();
    const raw = await KV.get("team:" + id);
    if (!raw) return json({ error: "not found" }, 404);
    const t = JSON.parse(raw);
    const changes = diffPlayers(t.players, players);
    t.players = cleanPlayers(players);
    appendLog(t, changes);
    await KV.put("team:" + id, JSON.stringify(t));
    return json({ ok: true });
  }
  /* the admin can edit a team's name, category, logo, banner, captain, discord, jerseys */
  if (p === "/admin/teams/update" && req.method === "POST") {
    if (!isAdmin(req, env)) return json({ error: "unauthorized" }, 401);
    const b = await req.json();
    const raw = await KV.get("team:" + b.id);
    if (!raw) return json({ error: "not found" }, 404);
    const t = JSON.parse(raw);
    if (typeof b.name === "string" && b.name.trim()) t.name = b.name.trim().slice(0, 60);
    if (b.category) t.category = b.category === "Binsu" ? "Binsu" : "League";
    if (typeof b.logo === "string" && b.logo) t.logo = b.logo;
    if (typeof b.banner === "string" && b.banner) t.banner = b.banner;
    if (typeof b.captain === "string") { const v = cleanStr(b.captain, 40); if (v !== (t.captain || "")) appendLog(t, [`👑 Captain set to ${v || "—"}`]); t.captain = v; }
    if (typeof b.discord === "string") t.discord = cleanStr(b.discord, 40);
    if (typeof b.jerseyFront === "string" && b.jerseyFront) t.jerseyFront = b.jerseyFront;
    if (typeof b.jerseyBack === "string" && b.jerseyBack) t.jerseyBack = b.jerseyBack;
    await KV.put("team:" + b.id, JSON.stringify(t));
    return json({ ok: true });
  }
  /* ---- Player profiles ---- */
  if (p === "/profiles" && req.method === "GET") {
    const list = await KV.list({ prefix: "profile:" });
    const out = [];
    for (const k of list.keys) out.push(publicProfile(JSON.parse(await KV.get(k.name))));
    out.sort((a, b) => (b.verified - a.verified) || (a.createdAt - b.createdAt));
    return json(out);
  }
  if (p === "/profile" && req.method === "GET") {
    const raw = await KV.get("profile:" + url.searchParams.get("id"));
    if (!raw) return json({ error: "not found" }, 404);
    return json(publicProfile(JSON.parse(raw)));
  }
  if (p === "/profiles/create" && req.method === "POST") {
    const b = await req.json();
    const name = cleanStr(b.name, 40);
    if (!name || !b.password) return json({ error: "name and password are required" }, 400);
    const id = "u_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    const pr = {
      id, name, roblox: cleanStr(b.roblox, 40), pos: ROLES.includes(b.pos) ? b.pos : "",
      bio: cleanStr(b.bio, 200), photo: b.photo || "", titles: [], verified: false, tagline: "",
      passHash: await sha256(b.password), createdAt: Date.now(),
    };
    await KV.put("profile:" + id, JSON.stringify(pr));
    return json({ ok: true, id });
  }
  if (p === "/profile/update" && req.method === "POST") {
    const b = await req.json();
    const raw = await KV.get("profile:" + b.id);
    if (!raw) return json({ error: "not found" }, 404);
    const pr = JSON.parse(raw);
    if (pr.passHash !== await sha256(b.password || "")) return json({ error: "wrong password" }, 403);
    if (typeof b.name === "string" && b.name.trim()) pr.name = cleanStr(b.name, 40);
    if (typeof b.roblox === "string") pr.roblox = cleanStr(b.roblox, 40);
    if (b.pos !== undefined) pr.pos = ROLES.includes(b.pos) ? b.pos : "";
    if (typeof b.bio === "string") pr.bio = cleanStr(b.bio, 200);
    if (typeof b.photo === "string" && b.photo) pr.photo = b.photo;
    await KV.put("profile:" + b.id, JSON.stringify(pr));
    return json({ ok: true, profile: publicProfile(pr) });
  }
  if (p === "/admin/profiles/titles" && req.method === "POST") {
    if (!isAdmin(req, env)) return json({ error: "unauthorized" }, 401);
    const b = await req.json();
    const raw = await KV.get("profile:" + b.id);
    if (!raw) return json({ error: "not found" }, 404);
    const pr = JSON.parse(raw);
    pr.titles = cleanTitles(b.titles);
    if (typeof b.verified === "boolean") pr.verified = b.verified;
    if (typeof b.tagline === "string") pr.tagline = cleanStr(b.tagline, 60);
    await KV.put("profile:" + b.id, JSON.stringify(pr));
    return json({ ok: true });
  }
  if (p === "/admin/profiles/delete" && req.method === "POST") {
    if (!isAdmin(req, env)) return json({ error: "unauthorized" }, 401);
    const { id } = await req.json();
    await KV.delete("profile:" + id);
    return json({ ok: true });
  }

  /* ---- Coaching: admin-managed coaches + coaching requests ---- */
  if (p === "/coaches" && req.method === "GET") {
    const list = await KV.list({ prefix: "coach:" });
    const out = [];
    for (const k of list.keys) out.push(publicCoach(JSON.parse(await KV.get(k.name))));
    out.sort((a, b) => a.createdAt - b.createdAt);
    return json(out);
  }
  if (p === "/admin/coaches/add" && req.method === "POST") {
    if (!isAdmin(req, env)) return json({ error: "unauthorized" }, 401);
    const b = await req.json();
    const name = cleanStr(b.name, 40);
    if (!name) return json({ error: "name is required" }, 400);
    const id = "c_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const c = { id, name, pos: ROLES.includes(b.pos) ? b.pos : "", discord: cleanStr(b.discord, 60), blurb: cleanStr(b.blurb, 200), photo: b.photo || "", banner: b.banner || "", createdAt: Date.now() };
    await KV.put("coach:" + id, JSON.stringify(c));
    return json({ ok: true, id });
  }
  if (p === "/admin/coaches/delete" && req.method === "POST") {
    if (!isAdmin(req, env)) return json({ error: "unauthorized" }, 401);
    const { id } = await req.json();
    await KV.delete("coach:" + id);
    return json({ ok: true });
  }
  if (p === "/coaching/request" && req.method === "POST") {
    const b = await req.json();
    const name = cleanStr(b.name, 40), msg = cleanStr(b.msg, 280);
    if (!name || !msg) return json({ error: "name and message are required" }, 400);
    const raw = await KV.get("coachreqs");
    const list = raw ? JSON.parse(raw) : [];
    list.unshift({ id: "r_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), name, roblox: cleanStr(b.roblox, 40), pos: ROLES.includes(b.pos) ? b.pos : "", coach: cleanStr(b.coach, 40), msg, createdAt: Date.now() });
    if (list.length > 200) list.length = 200;
    await KV.put("coachreqs", JSON.stringify(list));
    return json({ ok: true });
  }
  if (p === "/admin/coaching/requests" && req.method === "GET") {
    if (!isAdmin(req, env)) return json({ error: "unauthorized" }, 401);
    const raw = await KV.get("coachreqs");
    return json(raw ? JSON.parse(raw) : []);
  }
  if (p === "/admin/coaching/requests/delete" && req.method === "POST") {
    if (!isAdmin(req, env)) return json({ error: "unauthorized" }, 401);
    const { id } = await req.json();
    const raw = await KV.get("coachreqs");
    const list = (raw ? JSON.parse(raw) : []).filter(x => x.id !== id);
    await KV.put("coachreqs", JSON.stringify(list));
    return json({ ok: true });
  }
  /* ---- League rules: official text (admin) + community suggestions ---- */
  if (p === "/rules" && req.method === "GET") {
    const t = await KV.get("rules");
    return json({ text: t || "" });
  }
  if (p === "/admin/rules" && req.method === "POST") {
    if (!isAdmin(req, env)) return json({ error: "unauthorized" }, 401);
    const b = await req.json();
    await KV.put("rules", String(b.text == null ? "" : b.text).slice(0, 20000));
    return json({ ok: true });
  }
  if (p === "/rules/suggest" && req.method === "POST") {
    const b = await req.json();
    const text = cleanStr(b.text, 500);
    if (!text) return json({ error: "a rule suggestion is required" }, 400);
    const raw = await KV.get("rulesuggest");
    const list = raw ? JSON.parse(raw) : [];
    list.unshift({ id: "rs_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), name: cleanStr(b.name, 40), text, createdAt: Date.now() });
    if (list.length > 200) list.length = 200;
    await KV.put("rulesuggest", JSON.stringify(list));
    return json({ ok: true });
  }
  if (p === "/admin/rules/suggestions" && req.method === "GET") {
    if (!isAdmin(req, env)) return json({ error: "unauthorized" }, 401);
    const raw = await KV.get("rulesuggest");
    return json(raw ? JSON.parse(raw) : []);
  }
  if (p === "/admin/rules/suggestions/delete" && req.method === "POST") {
    if (!isAdmin(req, env)) return json({ error: "unauthorized" }, 401);
    const { id } = await req.json();
    const raw = await KV.get("rulesuggest");
    const list = (raw ? JSON.parse(raw) : []).filter(x => x.id !== id);
    await KV.put("rulesuggest", JSON.stringify(list));
    return json({ ok: true });
  }

  /* ---- Match analysis ingest (from the Colab notebook) + read ---- */
  if (p === "/analyses" && req.method === "GET") {
    const list = await KV.list({ prefix: "analysis:" });
    const out = [];
    for (const k of list.keys) { const a = JSON.parse(await KV.get(k.name)); out.push({ id: a.id, label: a.label, createdAt: a.createdAt }); }
    out.sort((a, b) => b.createdAt - a.createdAt);
    return json(out);
  }
  if (p === "/analysis" && req.method === "GET") {
    const raw = await KV.get("analysis:" + url.searchParams.get("id"));
    if (!raw) return json({ error: "not found" }, 404);
    return json(JSON.parse(raw));
  }
  if (p === "/admin/analysis" && req.method === "POST") {
    if (!isAdmin(req, env)) return json({ error: "unauthorized" }, 401);
    const b = await req.json();
    const id = "a_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const a = { id, label: cleanStr(b.label, 80) || "Match analysis", report: b.report || {}, createdAt: Date.now() };
    await KV.put("analysis:" + id, JSON.stringify(a));
    return json({ ok: true, id });
  }
  /* ---- Preseason scrims: standings source (public read, admin write) ---- */
  if (p === "/scrims" && req.method === "GET") {
    let teams;
    const tRaw = await KV.get("scrimteams");
    if (tRaw == null) { teams = DEFAULT_SCRIM_TEAMS.map(n => ({ name: n, logo: "" })); await KV.put("scrimteams", JSON.stringify(teams)); }
    else teams = normScrimTeams(JSON.parse(tRaw));
    let mRaw = await KV.get("scrims");
    if (mRaw == null) { mRaw = JSON.stringify(DEFAULT_SCRIMS); await KV.put("scrims", mRaw); }
    return json({ teams, matches: JSON.parse(mRaw) });
  }
  if (p === "/admin/scrims/teams" && req.method === "POST") {
    if (!isAdmin(req, env)) return json({ error: "unauthorized" }, 401);
    const b = await req.json();
    await KV.put("scrimteams", JSON.stringify(normScrimTeams(b.teams)));
    return json({ ok: true });
  }
  if (p === "/admin/scrims/add" && req.method === "POST") {
    if (!isAdmin(req, env)) return json({ error: "unauthorized" }, 401);
    const b = await req.json();
    const teamA = cleanStr(b.teamA, 40), teamB = cleanStr(b.teamB, 40);
    const sets = cleanSets(b.sets);
    if (!teamA || !teamB) return json({ error: "both teams are required" }, 400);
    if (teamA === teamB) return json({ error: "a team can't scrim itself" }, 400);
    if (!sets.length) return json({ error: "at least one set score is required" }, 400);
    const raw = await KV.get("scrims");
    const list = raw ? JSON.parse(raw) : DEFAULT_SCRIMS.slice();
    list.push({ id: "s_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), teamA, teamB, sets, createdAt: Date.now() });
    await KV.put("scrims", JSON.stringify(list));
    return json({ ok: true });
  }
  if (p === "/admin/scrims/delete" && req.method === "POST") {
    if (!isAdmin(req, env)) return json({ error: "unauthorized" }, 401);
    const { id } = await req.json();
    const raw = await KV.get("scrims");
    const list = (raw ? JSON.parse(raw) : DEFAULT_SCRIMS.slice()).filter(x => x.id !== id);
    await KV.put("scrims", JSON.stringify(list));
    return json({ ok: true });
  }
  if (p === "/admin/scrims/reset" && req.method === "POST") {
    if (!isAdmin(req, env)) return json({ error: "unauthorized" }, 401);
    // reset the games, but KEEP any team logos already uploaded
    const existing = normScrimTeams(JSON.parse((await KV.get("scrimteams")) || "[]"));
    const logoByName = {}; existing.forEach(t => { if (t.logo) logoByName[t.name] = t.logo; });
    const teams = DEFAULT_SCRIM_TEAMS.map(n => ({ name: n, logo: logoByName[n] || "" }));
    existing.forEach(t => { if (!DEFAULT_SCRIM_TEAMS.includes(t.name)) teams.push(t); });
    await KV.put("scrimteams", JSON.stringify(teams));
    await KV.put("scrims", JSON.stringify(DEFAULT_SCRIMS));
    return json({ ok: true });
  }

  /* ---- Season 2: fixtures, results, playoff bracket ---- */
  if (p === "/s2" && req.method === "GET") {
    const raw = await KV.get("s2");
    let d, changed = false;
    if (raw == null) {
      d = { teams: DEFAULT_S2_TEAMS.slice(), fixtures: DEFAULT_S2_FIXTURES.map(x => ({ ...x })) };
      healS2(d);
      await KV.put("s2", JSON.stringify(d)); return json({ ...d, groups: S2_GROUP_DRAW });
    }
    d = JSON.parse(raw);
    // data stored before the official 13-team draw, with no fixtures built on it → adopt the draw
    if ((!d.fixtures || !d.fixtures.length) && Array.isArray(d.teams) && d.teams.indexOf("Invictus") === -1) {
      d.teams = DEFAULT_S2_TEAMS.slice();
      d.fixtures = DEFAULT_S2_FIXTURES.map(x => ({ ...x }));
      changed = true;
    }
    if (healS2(d)) changed = true;
    if (changed) await KV.put("s2", JSON.stringify(d));
    return json({ ...d, groups: S2_GROUP_DRAW });
  }
  if (p === "/admin/s2/teams" && req.method === "POST") {
    if (!isAdmin(req, env)) return json({ error: "unauthorized" }, 401);
    const b = await req.json();
    const cur = JSON.parse((await KV.get("s2")) || `{"teams":[],"fixtures":[]}`);
    cur.teams = (Array.isArray(b.teams) ? b.teams : []).map(n => cleanStr(n, 40)).filter(Boolean).slice(0, 40);
    await KV.put("s2", JSON.stringify(cur)); return json({ ok: true });
  }
  if (p === "/admin/s2/fixture/add" && req.method === "POST") {
    if (!isAdmin(req, env)) return json({ error: "unauthorized" }, 401);
    const b = await req.json();
    const teamA = cleanStr(b.teamA, 40), teamB = cleanStr(b.teamB, 40);
    if (!teamA || !teamB) return json({ error: "both teams are required" }, 400);
    if (teamA === teamB) return json({ error: "a team can't play itself" }, 400);
    const stage = ["regular", "qf", "sf", "3rd", "f"].includes(b.stage) ? b.stage : "regular";
    const cur = JSON.parse((await KV.get("s2")) || `{"teams":[],"fixtures":[]}`);
    const id = "f_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    cur.fixtures.push({ id, teamA, teamB, stage, when: typeof b.when === "number" ? b.when : 0, sets: null, createdAt: Date.now() });
    await KV.put("s2", JSON.stringify(cur)); return json({ ok: true });
  }
  if (p === "/admin/s2/fixture/delete" && req.method === "POST") {
    if (!isAdmin(req, env)) return json({ error: "unauthorized" }, 401);
    const b = await req.json();
    const cur = JSON.parse((await KV.get("s2")) || `{"teams":[],"fixtures":[]}`);
    cur.fixtures = cur.fixtures.filter(f => f.id !== b.id);
    await KV.put("s2", JSON.stringify(cur)); return json({ ok: true });
  }
  if (p === "/admin/s2/result" && req.method === "POST") {
    if (!isAdmin(req, env)) return json({ error: "unauthorized" }, 401);
    const b = await req.json();
    const cur = JSON.parse((await KV.get("s2")) || `{"teams":[],"fixtures":[]}`);
    const fx = cur.fixtures.find(f => f.id === b.id);
    if (!fx) return json({ error: "fixture not found" }, 404);
    const sets = cleanSets(b.sets);
    fx.sets = sets.length ? sets : null;   // empty → clear the result
    await KV.put("s2", JSON.stringify(cur));
    // auto-announce the final on Discord when a hook is configured for it
    if (fx.sets && fx.sets.length) {
      const hook = await getHook(KV);
      if (hook && hook.auto && hook.auto.finals) {
        try { await postHook(hook, { embeds: [hookResultEmbed(fx)] }, false); } catch (e) { /* result is saved either way */ }
      }
    }
    return json({ ok: true });
  }

  /* ---- player roster + stats (admin-managed) ---- */
  if (p === "/players" && req.method === "GET") {
    const raw = await KV.get("players");
    if (raw == null) { const d = seedPlayers(); await KV.put("players", JSON.stringify(d)); return json(d); }
    const d = JSON.parse(raw);
    // lists stored before the captain flag existed: merge it in once
    if (Array.isArray(d) && !d.some(x => x && x.cap)) {
      const capBy = {}; DEFAULT_PLAYERS.forEach(x => { if (x.cap) capBy[x.team + "|" + x.name] = true; });
      d.forEach(x => { if (capBy[x.team + "|" + x.name]) x.cap = true; });
      await KV.put("players", JSON.stringify(d));
    }
    return json(d);
  }
  if (p === "/admin/players/add" && req.method === "POST") {
    if (!isAdmin(req, env)) return json({ error: "unauthorized" }, 401);
    const b = await req.json();
    const name = cleanStr(b.name, 40), team = cleanStr(b.team, 40), pos2 = cleanStr(b.pos, 40);
    if (!name || !team) return json({ error: "name and team are required" }, 400);
    const raw = await KV.get("players"); const list = raw ? JSON.parse(raw) : seedPlayers();
    const id = "p_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    list.push({ id, name, team, pos: pos2, stats: cleanPStats(b.stats) });
    await KV.put("players", JSON.stringify(list)); return json({ ok: true });
  }
  if (p === "/admin/players/update" && req.method === "POST") {
    if (!isAdmin(req, env)) return json({ error: "unauthorized" }, 401);
    const b = await req.json();
    const raw = await KV.get("players"); const list = raw ? JSON.parse(raw) : seedPlayers();
    const pl = list.find(x => x.id === b.id);
    if (!pl) return json({ error: "player not found" }, 404);
    if (typeof b.name === "string" && b.name.trim()) pl.name = cleanStr(b.name, 40);
    if (typeof b.team === "string" && b.team.trim()) pl.team = cleanStr(b.team, 40);
    if (typeof b.pos === "string") pl.pos = cleanStr(b.pos, 40);
    if (b.stats) pl.stats = cleanPStats({ ...pl.stats, ...b.stats });
    await KV.put("players", JSON.stringify(list)); return json({ ok: true });
  }
  if (p === "/admin/players/delete" && req.method === "POST") {
    if (!isAdmin(req, env)) return json({ error: "unauthorized" }, 401);
    const b = await req.json();
    const raw = await KV.get("players"); const list = (raw ? JSON.parse(raw) : seedPlayers()).filter(x => x.id !== b.id);
    await KV.put("players", JSON.stringify(list)); return json({ ok: true });
  }
  if (p === "/admin/players/reset" && req.method === "POST") {
    if (!isAdmin(req, env)) return json({ error: "unauthorized" }, 401);
    await KV.put("players", JSON.stringify(seedPlayers())); return json({ ok: true });
  }

  if (p === "/admin/discord/register" && req.method === "POST") {
    if (!isAdmin(req, env)) return json({ error: "unauthorized" }, 401);
    const b = await req.json();
    const appId = cleanStr(b.appId, 30), publicKey = cleanStr(b.publicKey, 80), botToken = String(b.botToken || "").trim();
    if (!/^\d{15,25}$/.test(appId) || !/^[0-9a-f]{64}$/i.test(publicKey) || !botToken) {
      return json({ error: "appId (numbers), publicKey (64 hex chars) and botToken are required" }, 400);
    }
    const cmd = [{
      name: "binsustar",
      description: "Binsu Star league — standings, schedule, pick'em",
      options: [{
        type: 3, name: "topic", description: "What to show", required: false,
        choices: [
          { name: "overview", value: "overview" },
          { name: "standings", value: "standings" },
          { name: "schedule", value: "schedule" },
          { name: "pickem", value: "pickem" },
          { name: "leaders", value: "leaders" },
        ],
      }],
    }];
    const r = await fetch(`https://discord.com/api/v10/applications/${appId}/commands`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bot ${botToken}` },
      body: JSON.stringify(cmd),
    });
    if (!r.ok) return json({ error: "Discord rejected the registration (HTTP " + r.status + ") — check the app id and bot token" }, 400);
    await KV.put("discord", JSON.stringify({ appId, publicKey }));   // token is NOT stored
    return json({ ok: true, endpoint: url.origin + "/interactions" });
  }

  /* ---- automatic webhook posts: config lives ONLY in this Worker's KV ---- */
  if (p === "/admin/discord/hook" && req.method === "POST") {
    if (!isAdmin(req, env)) return json({ error: "unauthorized" }, 401);
    const b = await req.json();
    const hookUrl = String(b.url || "").trim();
    if (!hookUrl) { await KV.put("dchook", ""); return json({ ok: true, cleared: true }); }
    if (!/^https:\/\/(discord\.com|discordapp\.com)\/api\/webhooks\/\d+\/[\w-]+$/.test(hookUrl)) {
      return json({ error: "that doesn't look like a Discord webhook URL" }, 400);
    }
    const roleId = /^\d{5,25}$/.test(String(b.roleId || "").trim()) ? String(b.roleId).trim() : "";
    const auto = { night: !!b.night, pickem: !!b.pickem, finals: !!b.finals };
    await KV.put("dchook", JSON.stringify({ url: hookUrl, roleId, auto }));
    return json({ ok: true });
  }
  if (p === "/admin/discord/hook" && req.method === "GET") {
    if (!isAdmin(req, env)) return json({ error: "unauthorized" }, 401);
    const h = await getHook(KV);
    return json(h ? { configured: true, tail: "…" + h.url.slice(-4), roleId: h.roleId || "", auto: h.auto || {} } : { configured: false });
  }

  /* ---- honors: tournament placements driving the all-time rankings ---- */
  if (p === "/honors" && req.method === "GET") {
    const raw = await KV.get("honors"); return json(raw ? JSON.parse(raw) : []);
  }
  if (p === "/admin/honors/add" && req.method === "POST") {
    if (!isAdmin(req, env)) return json({ error: "unauthorized" }, 401);
    const b = await req.json();
    const team = cleanStr(b.team, 40), event = cleanStr(b.event, 80), season = cleanStr(b.season, 30);
    const place = [1, 2, 3].includes(+b.place) ? +b.place : 0;
    if (!team || !event || !place) return json({ error: "team, event and placement (1-3) are required" }, 400);
    const raw = await KV.get("honors"); const list = raw ? JSON.parse(raw) : [];
    const id = "h_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    list.unshift({ id, team, event, place, season, createdAt: Date.now() });
    await KV.put("honors", JSON.stringify(list)); return json({ ok: true });
  }
  if (p === "/admin/honors/delete" && req.method === "POST") {
    if (!isAdmin(req, env)) return json({ error: "unauthorized" }, 401);
    const b = await req.json();
    const raw = await KV.get("honors"); const list = (raw ? JSON.parse(raw) : []).filter(x => x.id !== b.id);
    await KV.put("honors", JSON.stringify(list)); return json({ ok: true });
  }

  /* ---- pick'em: fan predictions per fixture ---- */
  if (p === "/pickem" && req.method === "GET") {
    const raw = await KV.get("pickem"); const map = raw ? JSON.parse(raw) : {};
    const out = {};
    Object.keys(map).forEach(fid => { out[fid] = { A: map[fid].A || 0, B: map[fid].B || 0 }; });
    return json(out);
  }
  if (p === "/pickem/vote" && req.method === "POST") {
    const b = await req.json();
    const fid = cleanStr(b.fixtureId, 40), pick = b.pick === "A" ? "A" : b.pick === "B" ? "B" : "";
    const voter = cleanStr(b.voter, 60);
    if (!fid || !pick || !voter) return json({ error: "fixtureId, pick and voter are required" }, 400);
    // only real, still-open fixtures accept votes — the UI lock alone isn't enough
    const s2d = await getS2Data(KV);
    const fx = (s2d.fixtures || []).find(f => f.id === fid);
    if (!fx) return json({ error: "unknown fixture" }, 404);
    if ((fx.sets && fx.sets.length) || (fx.when && fx.when <= Date.now())) return json({ error: "match locked" }, 409);
    const raw = await KV.get("pickem"); const map = raw ? JSON.parse(raw) : {};
    const e = map[fid] || (map[fid] = { A: 0, B: 0, voters: {} });
    const prev = e.voters[voter];
    if (prev !== pick) {
      if (prev) e[prev] = Math.max(0, (e[prev] || 0) - 1);
      e[pick] = (e[pick] || 0) + 1;
      e.voters[voter] = pick;
      await KV.put("pickem", JSON.stringify(map));
    }
    return json({ ok: true });
  }
  if (p === "/pickem/name" && req.method === "POST") {
    const b = await req.json();
    const voter = cleanStr(b.voter, 60), name = cleanStr(b.name, 24);
    if (!voter) return json({ error: "voter is required" }, 400);
    const names = JSON.parse((await KV.get("picknames")) || "{}");
    if (name) names[voter] = name; else delete names[voter];
    await KV.put("picknames", JSON.stringify(names)); return json({ ok: true });
  }
  if (p === "/pickem/leaderboard" && req.method === "GET") {
    const me = cleanStr(url.searchParams.get("voter"), 60);
    const d = await getS2Data(KV);
    const winners = {};   // fixture id → "A" / "B" (decided matches only)
    const knownFx = {};   // votes only count on fixtures that still exist
    (d.fixtures || []).forEach(f => { knownFx[f.id] = true; const w = fxWinnerSide(f); if (w) winners[f.id] = w; });
    const map = JSON.parse((await KV.get("pickem")) || "{}");
    const names = JSON.parse((await KV.get("picknames")) || "{}");
    const tally = {};   // voter → { picks, correct }
    Object.keys(map).forEach(fid => {
      if (!knownFx[fid]) return;
      const voters = map[fid].voters || {};
      Object.keys(voters).forEach(v => {
        const t = tally[v] || (tally[v] = { picks: 0, correct: 0 });
        t.picks++;
        if (winners[fid] && voters[v] === winners[fid]) t.correct++;
      });
    });
    const rows = Object.keys(tally).map(v => ({
      name: names[v] || "Fan " + v.slice(-4),
      pts: tally[v].correct * 10, correct: tally[v].correct, picks: tally[v].picks,
      you: !!me && v === me,
    })).sort((a, b) => b.pts - a.pts || b.correct - a.correct || a.picks - b.picks || a.name.localeCompare(b.name));
    return json({ rows: rows.slice(0, 20), total: rows.length, you: rows.find(r => r.you) || null });
  }

  if (p === "/site" && req.method === "GET") {
    const s = await KV.get("site");
    return json(s ? JSON.parse(s) : {});
  }
  if (p === "/admin/site" && req.method === "POST") {
    if (!isAdmin(req, env)) return json({ error: "unauthorized" }, 401);
    const b = await req.json();
    const cur = JSON.parse((await KV.get("site")) || "{}");
    if (typeof b.logo === "string") cur.logo = b.logo;
    if (typeof b.statSheet === "string") cur.statSheet = b.statSheet.trim().slice(0, 500);
    await KV.put("site", JSON.stringify(cur));
    return json({ ok: true });
  }
  if (p === "/admin/login" && req.method === "POST") {
    return json({ ok: isAdmin(req, env) });
  }
  return null;   // not an API route → let a static asset handle it
}

/* ============ Discord slash command (/binsustar) ============
   The Worker doubles as the app's Interactions Endpoint:
   1. Admin registers the command once (POST /admin/discord/register
      with the app id, public key and bot token - the token is used
      for the one registration call and never stored).
   2. In the Discord developer portal, set the app's
      "Interactions Endpoint URL" to  https://<worker>/interactions
   3. Members type /binsustar [topic] anywhere in the server. */

function hexToBytes(hex) {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.substr(i * 2, 2), 16);
  return out;
}
async function verifyDiscord(req, body, publicKey) {
  try {
    const sig = req.headers.get("x-signature-ed25519");
    const ts = req.headers.get("x-signature-timestamp");
    if (!sig || !ts) return false;
    const key = await crypto.subtle.importKey("raw", hexToBytes(publicKey), { name: "Ed25519" }, false, ["verify"]);
    return await crypto.subtle.verify("Ed25519", key, hexToBytes(sig), new TextEncoder().encode(ts + body));
  } catch (e) { return false; }
}
async function getS2Data(KV) {
  const raw = await KV.get("s2");
  if (raw == null) {
    const d = { teams: DEFAULT_S2_TEAMS.slice(), fixtures: DEFAULT_S2_FIXTURES.map(x => ({ ...x })) };
    healS2(d);
    return d;
  }
  const d = JSON.parse(raw);
  // same guarded heal as GET /s2: only pre-draw data adopts the default schedule
  if ((!d.fixtures || !d.fixtures.length) && Array.isArray(d.teams) && d.teams.indexOf("Invictus") === -1) {
    d.fixtures = DEFAULT_S2_FIXTURES.map(x => ({ ...x }));
  }
  if (healS2(d)) await KV.put("s2", JSON.stringify(d));
  return d;
}
function slashPlayed(f) { return !!(f.sets && f.sets.length); }
function slashSets(f) {
  let a = 0, b = 0;
  (f.sets || []).forEach(st => {
    // mirror js/scrims.js: a set counts only with numeric points or an explicit winner
    const hp = typeof st.a === "number" && typeof st.b === "number";
    if (hp) { st.a >= st.b ? a++ : b++; }
    else if (st.w === "A" || st.w === "B") { st.w === "A" ? a++ : b++; }
  });
  return [a, b];
}
function slashStandingsLines(gTeams, played) {
  // mirrors computeScrimStandings (js/scrims.js) so Discord ranks tied
  // teams exactly like the standings page the embed links to
  const t = {};
  gTeams.forEach(n => { t[n] = { n, w: 0, l: 0, sw: 0, sl: 0, pf: 0, pa: 0, pointed: false }; });
  played.forEach(f => {
    const A = t[f.teamA], B = t[f.teamB];
    if (!A || !B) return;
    let a = 0, b = 0;
    (f.sets || []).forEach(st => {
      const hp = typeof st.a === "number" && typeof st.b === "number";
      let aWon;
      if (hp) { aWon = st.a >= st.b; A.pf += st.a; A.pa += st.b; B.pf += st.b; B.pa += st.a; A.pointed = B.pointed = true; }
      else if (st.w === "A" || st.w === "B") { aWon = st.w === "A"; }
      else return;   // mirror js/scrims.js: skip malformed set entries
      if (aWon) { a++; A.sw++; B.sl++; } else { b++; B.sw++; A.sl++; }
    });
    if (a === b) return;
    if (a > b) { A.w++; B.l++; } else { B.w++; A.l++; }
  });
  const rows = Object.values(t).map(r => ({
    ...r,
    record: r.w - r.l,
    played: r.w + r.l,
    diff: r.pointed ? r.pf - r.pa : null,
    setWinrate: (r.sw + r.sl) ? r.sw / (r.sw + r.sl) : null,
  })).sort((x, y) =>
    y.record - x.record ||
    ((y.played > 0 ? 1 : 0) - (x.played > 0 ? 1 : 0)) ||
    ((y.diff || 0) - (x.diff || 0)) ||
    ((y.setWinrate || 0) - (x.setWinrate || 0)) ||
    x.n.localeCompare(y.n));
  return rows.map((r, i) => `\`${String(i + 1).padStart(2)}\` **${r.n}** — ${r.w}–${r.l}`).join("\n") || "—";
}
const SLASH_SITE = "https://binsuasia.netlify.app";   // keep in sync with SITE_URL in js/admin.js
/* topic:leaders — top 5 by league points (mirrors dcPostLeaders in js/admin.js
   and PSTAT_WEIGHTS in js/pstats.js) */
/* /binsustar replies are a little in-Discord dashboard: the button row
   switches topics by UPDATING the same message (interaction type 3 →
   response type 7) — nobody leaves Discord. The active topic's button is
   highlighted and disabled. Only "Make your picks" links out, because
   picks themselves live on the site. */
const SLASH_TOPICS = [
  ["overview", "🏐", "Overview"],
  ["standings", "📊", "Standings"],
  ["schedule", "📅", "Schedule"],
  ["pickem", "🔮", "Pick'em"],
  ["leaders", "🏅", "Leaders"],
];
function slashButtons(topic) {
  const nav = SLASH_TOPICS.map(([t, emoji, label]) => ({
    type: 2, style: t === topic ? 1 : 2, custom_id: "bs:" + t,
    label, emoji: { name: emoji }, disabled: t === topic,
  }));
  const rows = [{ type: 1, components: nav }];
  if (topic === "pickem") {
    rows.push({ type: 1, components: [{ type: 2, style: 5, label: "Make your picks", emoji: { name: "🔮" }, url: SLASH_SITE + "/pickem.html" }] });
  }
  return rows;
}
/* build the embed for any topic (shared by the slash command and its buttons) */
async function slashTopicPayload(KV, topic) {
  let embed;
  if (topic === "leaders") {
    const raw = await KV.get("players");
    embed = slashLeadersEmbed(raw ? JSON.parse(raw) : seedPlayers());
  } else {
    embed = slashEmbed(topic, await getS2Data(KV));
  }
  return { embeds: [embed], components: slashButtons(topic) };
}
function slashLeadersEmbed(players) {
  const W = { kills: 2, aces: 2, blocks: 2, digs: 1, assists: 1 };
  const pts = p => { const st = p.stats || {}; let x = 0; for (const k in W) x += W[k] * (+st[k] || 0); return Math.round(x * 10) / 10; };
  const top = (players || []).map(p => ({ ...p, pts: pts(p) })).filter(p => p.pts > 0)
    .sort((a, b) => b.pts - a.pts).slice(0, 5);
  const medal = ["🥇", "🥈", "🥉", "4.", "5."];
  const lines = top.map((p, i) => {
    const st = p.stats || {};
    return `${medal[i]} **${p.name}** (${p.team}) — **${p.pts} pts** · ${st.kills || 0}K ${st.aces || 0}A ${st.blocks || 0}B ${st.digs || 0}D`;
  });
  return {
    title: "🏅 Player Leaderboard — Top 5",
    description: lines.join("\n") || "No player stats logged yet — check back after the first match night!",
    color: 0xC6971F,
    footer: { text: "Kills ×2 · Aces ×2 · Blocks ×2 · Digs ×1 · Assists ×1" },
  };
}
function slashEmbed(topic, d) {
  const ts = (when, style) => `<t:${Math.floor(when / 1000)}:${style}>`;
  const reg = (d.fixtures || []).filter(f => f.stage === "regular");
  // same "still relevant" window the admin webhook posts use
  const upcoming = reg.filter(f => !slashPlayed(f) && f.when && f.when > Date.now() - 3 * 3600e3)
    .sort((a, b) => a.when - b.when);
  const played = reg.filter(slashPlayed);
  const g = S2_GROUP_DRAW;
  const gTag = f => (g.A.indexOf(f.teamA) !== -1 || g.A.indexOf(f.teamB) !== -1) ? "🟢 A" : "🔴 B";
  if (topic === "standings") {
    return {
      title: "📊 Group Stage Standings",
      description: "Single round robin · every match BO3 · win **+1**, loss **−1**",
      fields: [
        { name: "🟢 Group A", value: slashStandingsLines(g.A, played), inline: true },
        { name: "🔴 Group B", value: slashStandingsLines(g.B, played), inline: true },
      ],
      color: 0xC6971F,
      footer: { text: "Binsu Star · Season 2" },
    };
  }
  if (topic === "schedule") {
    const next = upcoming.slice(0, 6).map(f => `${gTag(f)} **${f.teamA}** vs **${f.teamB}** — ${ts(f.when, "f")} (${ts(f.when, "R")})`);
    return {
      title: "📅 Upcoming Matches",
      description: next.join("\n") || "No upcoming fixtures — the schedule is all played out!",
      color: 0xC6971F,
      footer: { text: "Binsu Star · times shown in your timezone" },
    };
  }
  if (topic === "pickem") {
    const next = upcoming.slice(0, 2).map(f => `${gTag(f)} **${f.teamA}** vs **${f.teamB}** — locks ${ts(f.when, "R")}`);
    return {
      title: "🔮 Pick'em",
      description: (next.length ? `**Next up**\n${next.join("\n")}\n\n` : "") + "Call the winners before each match locks — every correct pick is **10 pts** on the fan leaderboard.",
      color: 0xC6971F,
      footer: { text: "Binsu Star Pick'em · lock times shown in your timezone" },
    };
  }
  // overview
  const recent = played.slice(-2).map(f => { const [a, b] = slashSets(f); return `🏁 **${f.teamA}** ${a}–${b} **${f.teamB}**`; });
  const next = upcoming.slice(0, 2).map(f => `${gTag(f)} **${f.teamA}** vs **${f.teamB}** — ${ts(f.when, "R")}`);
  return {
    title: "🏐 Binsu Star — Season 2",
    description: [
      next.length ? `**Next matches**\n${next.join("\n")}` : "",
      recent.length ? `**Latest results**\n${recent.join("\n")}` : "",
    ].filter(Boolean).join("\n\n") || "Season 2 is live — 13 teams, two groups, every match BO3.",
    color: 0xC6971F,
    footer: { text: "Binsu Star · Season 2" },
  };
}

/* ============ automatic Discord webhook posts (cron-driven) ============
   The webhook URL + role live ONLY in this Worker's KV ("dchook"), saved
   from the admin panel — never in the repo or the public site. With a cron
   trigger (see DEPLOY.md) the Worker posts on its own:
   - match-night hype   ~1 hour before the night's first serve
   - pick'em reminder   from 12:00 GMT+8 on match days
   - final scores       the moment a result is saved (no cron needed)
   Embeds mirror the one-tap posts in js/admin.js so both paths look alike. */
async function getHook(KV) {
  try { const raw = await KV.get("dchook"); const h = raw ? JSON.parse(raw) : null; return h && h.url ? h : null; }
  catch (e) { return null; }
}
async function postHook(hook, payload, ping) {
  const mention = (ping && hook.roleId) ? { content: `<@&${hook.roleId}>`, allowed_mentions: { roles: [hook.roleId] } } : {};
  const r = await fetch(hook.url, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "Binsu Star", avatar_url: SLASH_SITE + "/img/icon-192.png", ...mention, ...payload }),
  });
  if (!r.ok && r.status !== 204) throw new Error("Discord returned HTTP " + r.status);
}
const hookTs = (when, style) => `<t:${Math.floor(when / 1000)}:${style}>`;
function hookGroupTag(f) {
  const inA = S2_GROUP_DRAW.A.indexOf(f.teamA) !== -1 || S2_GROUP_DRAW.A.indexOf(f.teamB) !== -1;
  const inB = S2_GROUP_DRAW.B.indexOf(f.teamA) !== -1 || S2_GROUP_DRAW.B.indexOf(f.teamB) !== -1;
  return inA ? "Group A · " : inB ? "Group B · " : "";
}
const gmt8Day = ms => Math.floor((ms + 8 * 3600e3) / 86400e3);
/* the next match night = all upcoming fixtures sharing the earliest GMT+8 date
   (same rule as dcNextNight in js/admin.js) */
function hookNextNight(fixtures, now) {
  const up = (fixtures || []).filter(f => f.stage === "regular" && !(f.sets && f.sets.length) && f.when && f.when > now - 3 * 3600e3)
    .sort((a, b) => a.when - b.when);
  if (!up.length) return [];
  const d0 = gmt8Day(up[0].when);
  return up.filter(f => gmt8Day(f.when) === d0);
}
function hookNightEmbed(night) {
  const lines = night.map(f => `🏐 ${hookGroupTag(f)}**${f.teamA}** vs **${f.teamB}** — ${hookTs(f.when, "t")} (${hookTs(f.when, "R")}) · BO3`);
  return {
    title: "📅 Tonight on Binsu Star",
    description: lines.join("\n") + `\n\n${hookTs(night[0].when, "F")}\n\n🔮 [Make your Pick'em picks](${SLASH_SITE}/pickem.html) before the first serve!\n📊 [Full schedule & standings](${SLASH_SITE}/schedule.html)`,
    color: 0xC6971F,
    footer: { text: "Binsu Star · times shown in your timezone" },
  };
}
function hookPickemEmbed(night) {
  const lines = night.map(f => `• ${hookGroupTag(f)}**${f.teamA}** vs **${f.teamB}** — locks ${hookTs(f.when, "R")}`);
  return {
    title: "🔮 Pick'em is open!",
    description: `Call the winners before the matches lock:\n\n${lines.join("\n")}\n\n➡️ **[Make your picks](${SLASH_SITE}/pickem.html)** — every correct call is 10 pts.`,
    color: 0xC6971F,
    footer: { text: "Binsu Star Pick'em · lock times shown in your timezone" },
  };
}
function hookResultEmbed(f) {
  let a = 0, b = 0; const scores = [];
  (f.sets || []).forEach(st => {
    const hp = typeof st.a === "number" && typeof st.b === "number";
    if (hp) { st.a >= st.b ? a++ : b++; scores.push(`${st.a}–${st.b}`); }
    else if (st.w === "A" || st.w === "B") { st.w === "A" ? a++ : b++; }
  });
  const winner = a > b ? f.teamA : f.teamB;
  return {
    title: `🏁 FINAL — ${f.teamA} ${a}–${b} ${f.teamB}`,
    description: `${hookGroupTag(f)}**${winner}** take it${scores.length ? ` (${scores.join(", ")})` : ""}.\n\n📊 [Standings](${SLASH_SITE}/standings.html) · 🔮 [Pick'em](${SLASH_SITE}/pickem.html)`,
    color: 0x22B866,
    footer: { text: "Binsu Star · Season 2" },
  };
}
/* one cron tick: KV markers make posts once-per-night no matter how often it runs */
async function runAutoPosts(KV, now) {
  const hook = await getHook(KV);
  if (!hook) return;
  const auto = hook.auto || {};
  const d = await getS2Data(KV);
  const night = hookNextNight(d.fixtures, now);
  if (!night.length) return;
  const day = gmt8Day(night[0].when);
  if (auto.pickem && gmt8Day(now) === day) {
    const h8 = Math.floor(((now + 8 * 3600e3) % 86400e3) / 3600e3);   // hour of day, GMT+8
    if (h8 >= 12 && !(await KV.get("dcposted:pk:" + day))) {
      await KV.put("dcposted:pk:" + day, "1", { expirationTtl: 604800 });   // marker first — no dupes even if the post retries
      try { await postHook(hook, { embeds: [hookPickemEmbed(night)] }, true); } catch (e) {}
    }
  }
  if (auto.night && night[0].when - now <= 66 * 60e3 && !(await KV.get("dcposted:mn:" + day))) {
    await KV.put("dcposted:mn:" + day, "1", { expirationTtl: 604800 });
    try { await postHook(hook, { embeds: [hookNightEmbed(night)] }, true); } catch (e) {}
  }
}

export default {
  async scheduled(event, env, ctx) {
    try { await runAutoPosts(env.SOAI, Date.now()); } catch (e) { /* next tick retries */ }
  },
  async fetch(req, env) {
    if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
    const url = new URL(req.url);
    // Discord interactions need the raw body for signature verification
    if (url.pathname === "/interactions" && req.method === "POST") {
      try {
        const KV = env.SOAI;
        const cfg = JSON.parse((await KV.get("discord")) || "{}");
        if (!cfg.publicKey) return json({ error: "slash command not registered" }, 501);
        const body = await req.text();
        if (!(await verifyDiscord(req, body, cfg.publicKey))) return new Response("invalid request signature", { status: 401 });
        const it = JSON.parse(body);
        if (it.type === 1) return json({ type: 1 });                     // PING -> PONG
        if (it.type === 2 && it.data && it.data.name === "binsustar") {  // slash command
          const opt = (it.data.options || []).find(o => o.name === "topic");
          const topic = opt ? opt.value : "overview";
          return json({ type: 4, data: await slashTopicPayload(KV, topic) });
        }
        if (it.type === 3 && it.data && String(it.data.custom_id || "").indexOf("bs:") === 0) {
          // dashboard button click → swap the topic in the SAME message
          const topic = it.data.custom_id.slice(3);
          if (!SLASH_TOPICS.some(([t]) => t === topic)) return json({ type: 6 });   // stale/unknown button: ack quietly
          return json({ type: 7, data: await slashTopicPayload(KV, topic) });
        }
        return json({ type: 4, data: { content: "Unknown command." } });
      } catch (e) {
        return json({ error: String(e && e.message || e) }, 500);
      }
    }
    try {
      const res = await handleApi(req, env, url);
      if (res) return res;
    } catch (e) {
      return json({ error: String(e && e.message || e) }, 500);
    }
    // fall through to static assets (index.html, css, js, images, …)
    if (env.ASSETS) return env.ASSETS.fetch(req);
    return json({ error: "not found" }, 404);
  },
};
