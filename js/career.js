// Club career: one player, SuperLega + SV.League, transfer windows, coaches, budgets and stories.
(function (VB) {
  "use strict";
  var U = VB.ui, $ = U.$, esc = U.esc;
  var rnd = VB.rnd, irnd = VB.irnd, clamp = VB.clamp, pick = VB.pick, shuffle = VB.shuffle;

  var SLOT_KEY = "vnlCareer.slot", SLOTS = 3;
  var COMP = { S: 2, OH: 4, MB: 3, OP: 2, L: 1 };                       // a 12-player squad
  var CAL = ["window-pre", "R1", "R2", "R3", "window-mid", "R4", "R5", "R6", "R7", "R8", "R9", "SF", "F", "CWC", "VNL", "end"];
  var CAL_TXT = { "window-pre": "PRE-SEASON TRANSFER WINDOW", "window-mid": "MID-SEASON TRANSFER WINDOW", SF: "PLAYOFF SEMIFINALS", F: "PLAYOFF FINAL", CWC: "CLUB WORLD CUP", VNL: "SUMMER: VOLLEYBALL NATIONS LEAGUE", end: "SEASON REVIEW" };
  var FOCUS = { S: ["set", "def", "srv", "blk", "tec", "men", "spd", "vert"], OH: ["att", "rec", "def", "srv", "blk", "tec", "men", "spd", "vert"], MB: ["blk", "att", "srv", "tec", "men", "spd", "vert"],
                OP: ["att", "srv", "blk", "def", "tec", "men", "spd", "vert"], L: ["rec", "def", "set", "tec", "men", "spd"] };
  var ATTR_TXT = { srv: "SERVE", rec: "RECEIVE", set: "SET", att: "ATTACK", blk: "BLOCK", def: "DEFENCE", vert: "VERTICAL", men: "MENTAL", tec: "TECHNIQUE", spd: "SPEED" };

  var C = null, exitCareer = null, busy = false, tab = "news";
  // season storylines fit the club's stature
  function arcFor(prestige) {
    return prestige >= 82 ? pick(["TITLE FAVOURITES", "TITLE FAVOURITES", "UNDER PRESSURE", "NEW COACH, NEW IDEAS"])
         : prestige >= 78 ? pick(["DARK HORSES", "UNDER PRESSURE", "NEW COACH, NEW IDEAS", "REBUILDING WITH YOUTH"])
         : pick(["REBUILDING WITH YOUTH", "DARK HORSES", "FINANCIAL TROUBLE", "NEW COACH, NEW IDEAS"]);
  }

  // ================== PERSISTENCE ==================
  function save() { try { C.saved = Date.now(); localStorage.setItem(SLOT_KEY + C.slot, JSON.stringify(C)); U.setLast("career", C.slot); } catch (e) { console.warn(e); } }
  function load(slot) { try { return JSON.parse(localStorage.getItem(SLOT_KEY + slot) || "null"); } catch (e) { return null; } }

  // ================== WORLD HELPERS ==================
  function you() { return C.players.you; }
  function club(id) { return C.clubs[id || C.club]; }
  function P(id) { return C.players[id]; }
  function ovr(p) { return VB.ovr(p); }
  function lg(id) { return C.leagues[id]; }
  function salaryFor(p) { return Math.round(Math.pow(Math.max(8, ovr(p) - 49), 1.7)); }
  function payroll(cl) { return cl.roster.reduce(function (a, id) { return a + (P(id).salary || 0); }, 0); }
  function famCount(cl, fam) { return cl.roster.filter(function (id) { return P(id).role === fam; }).length; }
  function news(text, tag) {
    C.news.unshift({ s: C.season, st: CAL[C.stage], t: text, tag: tag || "" });
    if (C.news.length > 80) C.news.length = 80;
  }
  function mean(a) { return a.length ? a.reduce(function (x, y) { return x + y; }, 0) / a.length : 0; }
  function flagOf(nat) { return VB.FLAGS[nat] || "🏳️"; }

  function addPlayer(p, clubId) {
    C.players[p.id] = p;
    p.club = clubId || null;
    p.salary = p.salary || salaryFor(p);
    p.years = p.years || irnd(1, 3);
    if (clubId) club(clubId).roster.push(p.id); else C.free.push(p.id);
  }
  function removeFromClub(pid) {
    var p = P(pid);
    if (p.club) { var cl = club(p.club); cl.roster = cl.roster.filter(function (x) { return x !== pid; }); }
    p.club = null;
  }
  function moveTo(pid, clubId) {
    removeFromClub(pid);
    C.free = C.free.filter(function (x) { return x !== pid; });
    var p = P(pid);
    p.club = clubId;
    club(clubId).roster.push(pid);
  }
  function release(pid) {
    removeFromClub(pid);
    if (pid !== "you" && C.free.indexOf(pid) < 0) C.free.push(pid);
  }
  function genPlayer(nat, fam, base, age) {
    return VB.makePlayer({ name: VB.genName(nat, C.taken), nat: nat, role: fam, base: base, age: age });
  }

  // ================== ACADEMY YEARS (choices only, ages 14-18) ==================
  var COUNTRY = { SL: ["ITALY", "🇮🇹", { tec: 2, set: 1 }], SV: ["JAPAN", "🇯🇵", { rec: 2, def: 2 }], PL: ["POLAND", "🇵🇱", { att: 2, srv: 1 }], SB: ["BRAZIL", "🇧🇷", { spd: 2, att: 1 }],
                  EF: ["TÜRKIYE", "🇹🇷", { srv: 2, men: 1 }], LA: ["FRANCE", "🇫🇷", { tec: 1, spd: 1, set: 1 }], BL: ["GERMANY", "🇩🇪", { blk: 2, men: 1 }], VL: ["KOREA", "🇰🇷", { def: 2, spd: 1 }] };
  async function academy(st) {
    st.mods = {}; st.potAdj = 0; st.story = []; st.baseAdj = 0; st.spdAdj = 0;
    function add(o) { Object.keys(o).forEach(function (a) { st.mods[a] = (st.mods[a] || 0) + o[a]; }); }
    function txt(o) { return Object.keys(o).map(function (a) { return (o[a] > 0 ? "+" : "") + o[a] + " " + ATTR_TXT[a]; }).join(" • "); }
    async function year(age, title, body, opts) {
      var k = await U.modal("🎓 AGE " + age + " — " + title, "<p>" + body + "</p>", opts.map(function (o, i) { return { label: o[0], value: i }; }));
      var o = opts[k], res = o[1]();
      st.story.push("Age " + age + ": " + o[0] + " — " + res);
      await U.modal("🎓 AGE " + age, "<p class='center'>" + esc(res) + "</p>", [{ label: "CONTINUE", value: 1 }]);
    }
    await U.modal("🎓 THE ACADEMY YEARS", "<p>Before you ever sign a pro contract there are five years of choices. No matches here — just the decisions that make you.</p>", [{ label: "BEGIN AT AGE 14", value: 1 }]);
    await year(14, "WHERE DO YOU START?", "You've fallen in love with volleyball. Where do you play?", [
      ["SCHOOL CLUB", function () { var o = { rec: 2, def: 2 }; add(o); return "Lots of games, lots of passing. " + txt(o); }],
      ["CITY ACADEMY", function () { var o = { tec: 3, set: 1 }; add(o); st.potAdj += 1; return "Proper coaching from day one. " + txt(o) + " • +1 POTENTIAL"; }],
      ["BEACH VOLLEYBALL", function () { var o = { spd: 3, def: 1, men: 1 }; add(o); return "Sand, wind and two-player grit. " + txt(o); }]]);
    var spurt = irnd(-2, 6);
    await year(15, "GROWTH SPURT SUMMER", "You grew " + (spurt > 0 ? spurt + "cm" : "barely at all") + " this year. What's your focus?", [
      ["STRENGTH & JUMP TRAINING", function () { var o = { att: 2, blk: 1, vert: 3 }; add(o); st.height += spurt; return "Heavier legs, higher jump. " + txt(o); }],
      ["TECHNIQUE CAMP", function () { var o = { tec: 3, set: 1, rec: 1 }; add(o); st.height += spurt; return "Clean contacts all summer. " + txt(o); }],
      ["REST AND GROW", function () { st.height += spurt + irnd(1, 3); st.potAdj += 2; return "You let your body catch up — and grow a little more. +2 POTENTIAL"; }]]);
    await year(16, "NATIONAL YOUTH TRIALS", "The youth national team is holding trials.", [
      ["TRY OUT", function () {
        if (Math.random() < 0.55) { var o = { men: 2, att: 1, srv: 1 }; add(o); st.potAdj += 2; st.story.push("Youth national team call-up"); return "You make the squad! Youth national team. " + txt(o) + " • +2 POTENTIAL"; }
        var o2 = { men: 1 }; add(o2); return "Cut on the final day. It stings — and it drives you. " + txt(o2); }],
      ["FOCUS ON SCHOOL & CLUB", function () { var o = { men: 1, tec: 1, rec: 1 }; add(o); return "Steady progress, fewer nerves. " + txt(o); }]]);
    var leagues = shuffle(Object.keys(COUNTRY)).slice(0, 3);
    await year(17, "ACADEMY OFFERS", "Three pro academies want you. Where do you move?", leagues.map(function (id) {
      var c = COUNTRY[id];
      return [c[1] + " " + c[0], function () { add(c[2]); st.prefLeague = id; return "You move to " + c[0] + ". " + txt(c[2]) + " • First pro offers will come from the " + VB.LEAGUES[id].name + "."; }];
    }));
    await year(18, "YOUR PATHWAY", "The academy wants an answer.", [
      ["SIGN PRO NOW (age 18)", function () { st.age = 18; st.baseAdj = -2; st.potAdj += 3; return "Youngest in the dressing room. Lower OVR, higher ceiling."; }],
      ["UNIVERSITY FIRST (turn pro at 21)", function () { st.age = 21; st.baseAdj = 4; st.potAdj -= 2; st.offerTier = "high"; return "A degree and three seasons of college volleyball. Ready now — better clubs call."; }],
      ["PRO ACADEMY CONTRACT (age 19)", function () { st.age = 19; st.potAdj += 1; return "The balanced route: one more year of academy, then a pro contract."; }]]);
  }

  // ================== WORLD CREATION ==================
  function roundRobin(ids) {
    var a = ids.slice(), n = a.length, rounds = [];
    for (var r = 0; r < n - 1; r++) {
      var m = [];
      for (var i = 0; i < n / 2; i++) { var h = a[i], w = a[n - 1 - i]; m.push(r % 2 ? [w, h] : [h, w]); }
      rounds.push(m);
      a.splice(1, 0, a.pop());
    }
    return rounds;
  }
  function leagueIds() { return Object.keys(VB.LEAGUES); }
  function myLeague() { return C.club ? club().league : "SL"; }
  function leagueOrder() { return [myLeague()].concat(leagueIds().filter(function (id) { return id !== myLeague(); })); }
  function newSeasonLeagues() {
    leagueIds().forEach(function (id) {
      var ids = Object.keys(C.clubs).filter(function (c) { return C.clubs[c].league === id; });
      var table = {};
      ids.forEach(function (c) { table[c] = { w: 0, l: 0, pf: 0, pa: 0 }; });
      C.leagues[id] = { id: id, name: VB.LEAGUES[id].name, flag: VB.LEAGUES[id].flag, clubs: ids, rounds: roundRobin(shuffle(ids.slice())),
                        table: table, semis: null, final: null, champion: null };
    });
  }

  function createWorld(slot, setup) {
    C = { slot: slot, v: 1, season: 1, stage: 0, players: {}, clubs: {}, leagues: {}, free: [], news: [], taken: {},
          club: null, form: 0, recent: [], history: [], trophies: [], awardsWon: [], focus: FOCUS[setup.role][0], prog: {},
          sstats: {}, interest: 0, injured: 0, vertGain: 0, skillUnlocked: false, season0: true, name: setup.name };
    VB.CLUBS.forEach(buildClub);
    for (var f = 0; f < 8; f++) addPlayer(genPlayer(pick(VB.IMPORT_NATS), pick(Object.keys(COMP)), irnd(63, 72), irnd(20, 30)), null);
    newSeasonLeagues();
    setupCareer(setup);
  }
  // clubs from their seeds (also used to add new leagues to older saves)
  function buildClub(seed) {
      var cl = { id: seed.id, name: seed.name, short: seed.short, league: seed.league, kit: seed.kit, kit2: seed.kit2,
                 prestige: seed.prestige, coach: seed.coach, story: seed.story, strict: rnd(0.3, 0.8), arc: arcFor(seed.prestige), roster: [], budget: 0 };
      C.clubs[cl.id] = cl;
      seed.seeds.forEach(function (s) {
        C.taken[s[0]] = 1;
        addPlayer(VB.makePlayer({ name: s[0], nat: s[1], role: s[2], skill: s[3] || null, base: seed.prestige + irnd(-1, 3) + (s[3] ? VB.STAR_PRO : 0) }), cl.id);
      });
      var home = VB.LEAGUES[seed.league].nat;
      Object.keys(COMP).forEach(function (fam) {
        var have = famCount(cl, fam), starters = (fam === "OH" || fam === "MB") ? 2 : 1;
        for (var i = have; i < COMP[fam]; i++) {
          var nat = Math.random() < 0.72 ? home : pick(VB.IMPORT_NATS);
          var base = seed.prestige - (i < starters ? irnd(1, 5) : irnd(6, 12));
          addPlayer(genPlayer(nat, fam, base, irnd(19, 33)), cl.id);
        }
      });
      cl.budget = Math.round(payroll(cl) * rnd(1.04, 1.16));
  }
  function ensureLeagues() {
    var added = [];
    VB.CLUBS.forEach(function (seed) {
      if (C.clubs[seed.id]) return;
      buildClub(seed);
      if (C.leagues[seed.league]) news("🆕 " + seed.name + " join the " + VB.LEAGUES[seed.league].name + " next season.", "story");   // they enter at the next fixture list
      else if (added.indexOf(seed.league) < 0) added.push(seed.league);
    });
    added.forEach(function (id) {
      var ids = Object.keys(C.clubs).filter(function (c) { return C.clubs[c].league === id; }), table = {};
      ids.forEach(function (c) { table[c] = { w: 0, l: 0, pf: 0, pa: 0 }; });
      C.leagues[id] = { id: id, name: VB.LEAGUES[id].name, flag: VB.LEAGUES[id].flag, clubs: ids, rounds: roundRobin(shuffle(ids.slice())), table: table, semis: null, final: null, champion: null };
      news("🌍 New league on the radar: " + VB.LEAGUES[id].flag + " " + VB.LEAGUES[id].name + ".", "story");
    });
    if (C.mgr == null) C.mgr = 50;
    if (C.lvl == null) { C.lvl = 1; C.xp = 0; C.sp = 0; }
    if (!C.obj) newObjectives();
  }

  // ================== PLAYER CAREER (archetypes, XP & skill points, objectives) ==================
  // archetypes: position-specific, each with strengths, growth bias and a real weakness
  var ARCH = {
    allround:  { fam: ["OH"], name: "SIX-ROTATION ALL-ROUNDER", desc: "Passes, defends and attacks in every rotation.", boost: { rec: 3, def: 3, att: 2, spd: 2 }, minus: { srv: -2 }, grow: ["rec", "def", "att"] },
    scorer:    { fam: ["OH"], name: "POINT SCORER", desc: "The go-to swing when the set is ugly.", boost: { att: 6, srv: 2, men: 2 }, minus: { rec: -4, def: -2 }, grow: ["att", "srv"] },
    pipe:      { fam: ["OH"], name: "BACK-ROW WEAPON", desc: "Explosive jumper who kills the pipe.", boost: { att: 3, spd: 4 }, vert: 6, minus: { blk: -3 }, grow: ["att", "spd"] },
    anchor:    { fam: ["OH"], name: "RECEPTION ANCHOR", desc: "Takes the hardest serves so others can swing.", boost: { rec: 6, def: 3, tec: 2 }, minus: { att: -3 }, grow: ["rec", "tec"] },
    quick:     { fam: ["MB"], name: "QUICK ATTACKER", desc: "First-tempo specialist, gone before the block arrives.", boost: { att: 5, spd: 4 }, minus: { blk: -2 }, grow: ["att", "spd"] },
    readblk:   { fam: ["MB"], name: "READ BLOCKER", desc: "Reads the setter, closes every seam.", boost: { blk: 6, men: 3, tec: 1 }, height: 2, minus: { att: -3, spd: -2 }, grow: ["blk", "men"] },
    srvmb:     { fam: ["MB"], name: "SERVING MIDDLE", desc: "A middle with a jump serve that wins runs.", boost: { srv: 6, blk: 2 }, minus: { att: -2 }, grow: ["srv", "blk"] },
    tempo:     { fam: ["S"], name: "TEMPO SETTER", desc: "Fast, flat sets that leave blockers behind.", boost: { set: 5, spd: 3, tec: 2 }, minus: { blk: -3 }, grow: ["set", "spd"] },
    dumper:    { fam: ["S"], name: "JUMP SETTER & DUMPER", desc: "A setter who scores too. Unlocks the dump sooner.", boost: { set: 3, att: 6 }, vert: 4, minus: { def: -3 }, grow: ["set", "att"] },
    defset:    { fam: ["S"], name: "DEFENSIVE SETTER", desc: "Digs like a libero, sets like a setter.", boost: { def: 5, set: 2, spd: 2 }, minus: { srv: -2 }, grow: ["def", "set"] },
    general:   { fam: ["S", "OH", "OP", "MB", "L"], name: "FLOOR GENERAL", desc: "Composed, vocal, the captain everyone listens to.", boost: { men: 7, tec: 2, set: 1 }, minus: { att: -2 }, grow: ["men", "tec"] },
    power:     { fam: ["OP"], name: "POWER OPPOSITE", desc: "Big swings, big blocks.", boost: { att: 6, blk: 2 }, height: 2, minus: { spd: -3, def: -2 }, grow: ["att", "blk"] },
    bomber:    { fam: ["OP", "OH"], name: "SERVE BOMBER", desc: "Every serve is a weapon.", boost: { srv: 7, men: 1 }, minus: { rec: -2 }, grow: ["srv"] },
    backrow:   { fam: ["OP"], name: "BACK-ROW CANNON", desc: "Just as dangerous from behind the 3m line.", boost: { att: 3, def: 2, spd: 2 }, vert: 4, minus: { blk: -2 }, grow: ["att", "def"] },
    passer:    { fam: ["L"], name: "RECEPTION SPECIALIST", desc: "Perfect passes, every serve.", boost: { rec: 7, tec: 2 }, minus: { def: -2 }, grow: ["rec", "tec"] },
    digger:    { fam: ["L"], name: "DEFENSIVE WALL", desc: "Flies for everything.", boost: { def: 7, spd: 3 }, minus: { rec: -2 }, grow: ["def", "spd"] },
    libset:    { fam: ["L"], name: "LIBERO PLAYMAKER", desc: "Sets the second ball like a setter.", boost: { set: 6, rec: 2 }, minus: { def: -1 }, grow: ["set", "rec"] },
    athlete:   { fam: ["S", "OH", "OP", "MB", "L"], name: "PURE ATHLETE", desc: "Fast and bouncy — the technique will come.", boost: { spd: 6 }, vert: 6, minus: { tec: -3 }, grow: ["spd", "tec"] },
    // older careers
    wall:      { fam: [], name: "THE WALL", desc: "Owns the net.", boost: { blk: 5, att: 1 }, grow: ["blk"] },
    maestro:   { fam: [], name: "MAESTRO", desc: "Hands like silk.", boost: { set: 4, def: 2 }, grow: ["set", "def"] },
    guardian:  { fam: [], name: "GUARDIAN", desc: "Nothing hits the floor.", boost: { rec: 4, def: 3 }, grow: ["rec", "def"] }
  };
  function archsFor(fam) { return Object.keys(ARCH).filter(function (k) { return ARCH[k].fam.indexOf(fam) >= 0; }); }
  function xpNeed() { return 120 + (C.lvl - 1) * 20; }
  function gainXP(n) {
    C.xp += Math.round(n);
    var ups = 0;
    while (C.xp >= xpNeed()) { C.xp -= xpNeed(); C.lvl++; C.sp++; ups++; }
    if (ups) news("⬆ LEVEL " + C.lvl + "! +" + ups + " SKILL POINT" + (ups > 1 ? "S" : "") + " to spend in DEVELOP.", "you");
    return ups;
  }
  function spCost(a) { var v = a === "vert" ? 90 : you()[a]; return v < 74 ? 1 : v < 82 ? 2 : 3; }
  var OBJ_STAT = { OH: ["pts", 45, "SCORE 45 POINTS"], OP: ["pts", 55, "SCORE 55 POINTS"], MB: ["blk", 10, "MAKE 10 BLOCKS"], S: ["ast", 70, "70 ASSISTS"], L: ["dig", 30, "30 DIGS"] };
  function newObjectives() {
    var st = OBJ_STAT[you().role];
    C.obj = [{ k: "mp", target: 5, text: "PLAY 5 MATCHES" }, { k: "avg", target: 7.0, text: "AVERAGE RATING 7.0+" }, { k: st[0], target: st[1], text: st[2] }];
    C.srat = [];
  }
  function objProgress(o) {
    var my = C.sstats.you || VB.Stats.newLine();
    if (o.k === "avg") return C.srat && C.srat.length ? Math.round(mean(C.srat) * 10) / 10 : 0;
    if (o.k === "pts") return VB.Stats.pts(my);
    return my[o.k] || 0;
  }
  function objDone(o) { return objProgress(o) >= o.target && (o.k !== "avg" || (C.srat || []).length >= 3); }
  function setupCareer(setup) {
    var fam = setup.role, h = VB.HEIGHT[fam], v = VB.VERT[fam], b = setup.build;
    // your chosen height; every cm above the middle costs a little jump and speed
    var height = setup.height || Math.round((h[0] + h[1]) / 2), hd = height - (h[0] + h[1]) / 2;
    var vert = Math.round((v[0] + v[1]) / 2 - hd * 0.5 + (b === "jumper" ? 6 : b === "tower" ? -4 : 0));
    var me = VB.makePlayer({ id: "you", name: setup.name, nat: setup.nat, role: fam, base: 64 + (setup.baseAdj || 0), age: setup.age || 19, height: height, vert: vert });
    me.spd = clamp(me.spd + (setup.spdAdj || 0), 25, 99);
    if (b === "jumper") me.def = clamp(me.def + 3, 25, 99);
    if (b === "tower") me.blk = clamp(me.blk + 3, 25, 99);
    me.pot = clamp(irnd(84, 93) + (setup.potAdj || 0), 70, 97);
    Object.keys(setup.mods || {}).forEach(function (a) { if (a === "vert") me.vert += setup.mods[a]; else me[a] = clamp(me[a] + setup.mods[a], 25, 99); });
    me.build = b;
    var ar = ARCH[setup.arch] || ARCH.allround;
    Object.keys(ar.boost).forEach(function (a) { me[a] = clamp(me[a] + ar.boost[a], 25, 99); });
    Object.keys(ar.minus || {}).forEach(function (a) { me[a] = clamp(me[a] + ar.minus[a], 25, 99); });
    if (setup.arch === "dumper") me.skill = "dump";
    if (ar.vert) me.vert += ar.vert;
    if (ar.height) me.height += ar.height;
    C.arch = setup.arch || "power"; C.mgr = 50; C.lvl = 1; C.xp = 0; C.sp = 0;
    C.players.you = me;
    newObjectives();
    C.startVert = vert;
    (setup.story || []).forEach(function (t) { news("🎓 " + t, "you"); });
    news("A new career begins: " + setup.name + ", a " + me.age + "-year-old " + VB.FAMILY_NAMES[fam].toLowerCase() + " from " + flagOf(setup.nat) + ".", "you");
  }

  // ================== LINEUPS ==================
  function selectionScore(p, noise) {
    var s = ovr(p);
    if (p.id === "you") {
      s += C.form * 2.2 + (C.promise === "STARTER" ? 6 : 1.5) + ((C.mgr || 50) - 50) * 0.08;
      if (noise && C.promise !== "STARTER" && Math.random() < 0.35) s += 5;   // the coach gives the kid a run
    }
    if (noise) s += rnd(-1.2, 1.2);
    return s;
  }
  function lineupFor(cl, noise) {
    var ps = cl.roster.map(P).filter(function (p) { return !(p.injured > 0) && !(p.id === "you" && C.injured > 0); });
    var used = {};
    function best(fam, n) {
      var list = ps.filter(function (p) { return p.role === fam && !used[p.id]; })
                   .sort(function (a, b) { return selectionScore(b, noise) - selectionScore(a, noise); }).slice(0, n);
      list.forEach(function (p) { used[p.id] = 1; });
      return list;
    }
    var S = best("S", 1), OH = best("OH", 2), MB = best("MB", 2), OP = best("OP", 1), L = best("L", 1);
    function fill(list, n) {                                       // injuries/shortages: borrow the best spare
      while (list.length < n) {
        var spare = ps.filter(function (p) { return !used[p.id]; }).sort(function (a, b) { return ovr(b) - ovr(a); })[0];
        if (!spare) break;
        used[spare.id] = 1; list.push(spare);
      }
      return list;
    }
    S = fill(S, 1); OH = fill(OH, 2); MB = fill(MB, 2); OP = fill(OP, 1); L = fill(L, 1);
    return { S: S[0], OH1: OH[0], OH2: OH[1], MB1: MB[0], MB2: MB[1], OP: OP[0], L: L[0] };
  }
  function keyOf(lineup, pid) { return VB.ROLES.find(function (r) { return lineup[r] && lineup[r].id === pid; }) || null; }
  function teamDef(clubId, lineup) {
    var cl = club(clubId);
    return { id: cl.id, name: cl.short, short: cl.short, flag: lg(cl.league).flag, kit: cl.kit, kit2: cl.kit2, play: VB.PLAY_OF[cl.id], lineup: lineup };
  }
  function isLikelyStarter() {
    if (!C.club || C.mode === "coach") return false;
    return !!keyOf(lineupFor(club(), false), "you");
  }

  // ================== MATCHES ==================
  function addSeason(stats) {
    Object.keys(stats).forEach(function (pid) {
      if (!C.players[pid]) return;
      C.sstats[pid] = VB.Stats.addInto(C.sstats[pid] || VB.Stats.newLine(), stats[pid]);
    });
  }
  function applyTable(L, h, a, sh, sa) {
    var th = L.table[h], ta = L.table[a];
    if (sh > sa) { th.w++; ta.l++; } else { ta.w++; th.l++; }
    th.pf += sh; th.pa += sa; ta.pf += sa; ta.pa += sh;
  }
  function simFixture(h, a) {
    var s = VB.Stats.sim(teamDef(h, lineupFor(club(h), true)), teamDef(a, lineupFor(club(a), true)));
    addSeason(s.stats);
    return [s.a, s.b];
  }

  function grow(p, rating) {
    var age = p.age, ageF = age < 23 ? 1.4 : age < 27 ? 1 : age < 31 ? 0.5 : 0.15;
    var room = clamp((p.pot - ovr(p)) / 10, 0, 1.2);
    // only good performances grow you, and gains shrink as you near your potential
    var amt = Math.max(0, rating - 6) * 0.11 * ageF * (0.2 + room * 0.8);
    var gains = {};
    FOCUS[p.role].forEach(function (a) {
      var w = (a === C.focus ? 1.8 : 1) * (a === "vert" ? 1 : clamp((99 - p[a]) / 40, 0.15, 1));   // high attributes are harder to raise
      if (ARCH[C.arch] && ARCH[C.arch].grow.indexOf(a) >= 0) w *= 1.35;                              // your archetype grows faster
      if (a === "vert") { if (C.focus !== "vert" || C.vertGain >= 12) return; w = 0.6; }
      C.prog[a] = (C.prog[a] || 0) + amt * w * rnd(0.5, 1.2);
      while (C.prog[a] >= 1) {
        C.prog[a] -= 1;
        if (a === "vert") { if (C.vertGain >= 12) break; p.vert++; C.vertGain++; }
        else p[a] = Math.min(99, p[a] + 1);
        gains[a] = (gains[a] || 0) + 1;
      }
    });
    if (!C.skillUnlocked && ovr(p) >= 76) {
      C.skillUnlocked = true;
      p.skill = VB.ROLE_SKILL[p.role]; C.pickSkill = true;                  // a default until you choose your own
      news("★ SIGNATURE MOVE UNLOCKED: " + p.name + " is ready to make a move their own!", "you");
      gains.skill = 1;
    }
    return gains;
  }

  // ---------- choosing your signature move and PlayStyles ----------
  async function chooseSkill(change) {
    var p = you(), opts = VB.SKILL_CHOICES[p.role] || [[VB.ROLE_SKILL[p.role], VB.SKILL_TXT[VB.ROLE_SKILL[p.role]]]];
    var k = await U.modal(change ? "★ CHANGE YOUR SIGNATURE MOVE" : "★ CHOOSE YOUR SIGNATURE MOVE",
      "<p>Your coach: \"You've earned a weapon. What do you want them to fear?\"</p><ul>" + opts.map(function (o) { return "<li><b>" + esc(o[1]) + "</b> — " + esc(VB.SKILL_TXT[o[0]]) + "</li>"; }).join("") + "</ul>" +
      "<p class='muted'>Signature moves recharge after a few points and swing a rally your way.</p>",
      opts.map(function (o, i) { return { label: "★ " + o[1], value: i }; }));
    p.skill = opts[k][0]; p.skillName = opts[k][1]; C.pickSkill = false;
    news("★ " + p.name + "'s signature move: " + p.skillName + "!", "you"); save();
  }
  function psSlots() { return C.lvl >= 10 ? 4 : 3; }
  function psHTML() {
    var p = you(), own = p.ps || {}, ids = VB.psFor(p.role), n = Object.keys(own).length;
    return "<h3 class='mini'>PLAYSTYLES (" + n + "/" + psSlots() + ")</h3><p class='muted small'>Passive abilities for specific moments. Unlock for 2 SP, upgrade to + for 3 SP. A 4th slot opens at level 10.</p>" +
      "<div class='ps-grid'>" + ids.map(function (id) {
        var d = VB.PS[id], lv = own[id] || 0;
        var btn = lv === 0 ? "<button class='btn tiny' data-act='psUnlock' data-arg='" + id + "'" + (C.sp < 2 || n >= psSlots() ? " disabled" : "") + ">UNLOCK • 2 SP</button>"
                : lv === 1 ? "<button class='btn tiny' data-act='psUp' data-arg='" + id + "'" + (C.sp < 3 ? " disabled" : "") + ">UPGRADE TO + • 3 SP</button>" : "<b class='gain'>MAXED</b>";
        return "<div class='ps-card" + (lv ? " on" : "") + "'><div class='pname'>" + d.icon + " " + d.name + (lv === 2 ? "+" : "") + "</div><div class='muted small'>" + esc(d.txt) + "</div>" + btn + "</div>";
      }).join("") + "</div>" +
      "<h3 class='mini'>SIGNATURE MOVE</h3>" + (p.skill ? "<p>★ <b>" + esc(p.skillName || VB.SKILL_TXT[p.skill]) + "</b> (" + esc(VB.SKILL_TXT[p.skill]) + ") <button class='btn tiny' data-act='skillChange'" + (C.sp < 4 || C.pickSkill ? " disabled" : "") + ">CHANGE • 4 SP</button>" +
        (C.pickSkill ? " <button class='btn tiny' data-act='skillPick'>CHOOSE NOW</button>" : "") + "</p>" : "<p class='muted'>Unlocks at OVR 76 — then you choose it.</p>");
  }

  async function userMatch(L, h, a, label) {
    if (C.mode === "coach") return await coachMatch(L, h, a, label);
    var mineId = C.club, foeId = h === mineId ? a : h, homeSide = h === mineId ? 0 : 1;
    var myLine = lineupFor(club(mineId), true), foeLine = lineupFor(club(foeId), true);
    var coop = VB.Coop && VB.Coop.live() && mate() && !(C.players.mate.injured > 0);
    if (coop) { if (!(C.injured > 0)) forceIn(myLine, you()); forceIn(myLine, C.players.mate); }
    var myKey = keyOf(myLine, "you"), mateKey = coop ? keyOf(myLine, "mate") : null;
    var mine = teamDef(mineId, myLine), foe = teamDef(foeId, foeLine);
    if (!myKey) {
      var s = VB.Stats.sim(mine, foe);
      addSeason(s.stats);
      C.recent.push(null);
      C.form = clamp(C.form * 0.85 - 0.15, -3, 3);
      var tg = C.injured > 0 ? {} : grow(you(), 6.5);
      gainXP(20);
      var tgt = Object.keys(tg).filter(function (k) { return k !== "skill"; }).map(function (k) { return "+" + tg[k] + " " + ATTR_TXT[k]; }).join(", ");
      var rival = myLine[VB.ROLES.find(function (r) { return VB.FAMILY[r] === you().role; })];
      var why = C.injured > 0 ? "You're injured and watch from the stands." :
        "Coach " + club().coach + " starts " + (rival ? rival.name : "someone else") + " ahead of you. \"" +
        pick(["Earn it in training.", "Your form isn't there yet.", "Be ready when I call you.", "It's a squad game, kid."]) + "\"";
      if (sideBySide()) VB.Coop.sbNews(you().name + " watched from the bench as " + mine.name + " " + (s.a > s.b ? "beat " : "lost to ") + foe.name + " " + s.a + "-" + s.b + ".");
      await U.modal("BENCHED", "<p>" + esc(why) + "</p><p class='center big'>" + esc(mine.name + " " + s.a + " : " + s.b + " " + foe.name) + "</p>" +
                    (tgt ? "<p class='center gain'>EXTRA TRAINING: " + esc(tgt) + "</p>" : ""),
                    [{ label: "CONTINUE", value: 1 }]);
      return homeSide === 0 ? [s.a, s.b] : [s.b, s.a];
    }
    var pre = null;
    if (VB.Media && /PLAYOFF/.test(label)) {
      pre = await VB.Media.pre({ who: you().name, team: club(mineId).short, foe: foe.name, label: label, final: /FINAL/.test(label) && !/SEMI/.test(label) });
      await VB.Media.reaction(pre, null, careerTone(pre.tone, true));
    }
    U.showView("match");
    $("recordLine").textContent = "SEASON " + C.season + " • " + club().short + " " + C.leagues[club().league].table[mineId].w + "W-" + C.leagues[club().league].table[mineId].l + "L";
    var res = await VB.Engine.playMatch({ mine: mine, foe: foe, homeSide: homeSide, mode: "role", myRole: myKey, mateRole: mateKey,
                                          label: L.name + " • " + label + (mateKey ? " • 🤝 CO-OP" : ""), league: L.name });
    U.showView("hub");
    addSeason(res.stats);
    var line = res.stats.you, rating = VB.Stats.rating(line, you().role, res.won);
    C.recent.push(rating); (C.srat = C.srat || []).push(rating);
    C.form = clamp(C.form * 0.6 + (rating - 6.2) * 0.55, -3, 3);
    var xpGot = Math.round(rating * 9 + (res.won ? 12 : 0)), lvUp = gainXP(xpGot);
    C.mgr = clamp((C.mgr || 50) + (rating - 6.5) * 1.5, 0, 100);
    var before = ovr(you()), gains = grow(you(), rating), after = ovr(you());
    var flowed = res.flows.some(function (f) { return f.id === "you"; });
    if (flowed) { news("🔵🔥 Fans chant " + you().name + "'s name after a FLOW STATE run.", "you"); C.interest += 0.05; }
    if (rating >= 8) news(you().name + " stars with " + VB.Stats.pts(line) + " points — " + rating + "/10.", "you");
    var gtxt = Object.keys(gains).filter(function (k) { return k !== "skill"; }).map(function (k) { return "+" + gains[k] + " " + ATTR_TXT[k]; }).join(", ");
    var mateHTML = "";
    if (mateKey && res.stats.mate) {
      var mp = C.players.mate, mr = VB.Stats.rating(res.stats.mate, mp.role, res.won), mg = mateGrow(mp, mr);
      C.mst = C.mst || { sp: 0 }; C.mst.sp++;                          // P2 earns a skill point per co-op match
      var mgt = Object.keys(mg).map(function (k) { return "+" + mg[k] + " " + ATTR_TXT[k]; }).join(", ");
      mateHTML = "<p class='center'>🤝 P2 " + esc(mp.name) + ": <b class='rating'>" + mr + "</b> / 10 • " + esc(VB.Stats.lineText(res.stats.mate)) + (mgt ? " • <span class='gain'>" + esc(mgt) + "</span>" : "") + "</p>";
      if (mr >= 8) news("🤝 " + mp.name + " (P2) stars with " + VB.Stats.pts(res.stats.mate) + " points — " + mr + "/10.", "you");
    }
    await U.modal(res.won ? "WIN" : "LOSS",
      "<p class='center big'>" + esc(mine.name + " " + res.score[0] + " : " + res.score[1] + " " + foe.name) + "</p>" +
      "<p class='center'>YOUR RATING: <b class='rating'>" + rating + "</b> / 10</p>" +
      "<p class='center'>" + esc(VB.Stats.lineText(line)) + "</p>" + mateHTML +
      (gtxt ? "<p class='center gain'>TRAINING GAINS: " + esc(gtxt) + "</p>" : "") +
      (after > before ? "<p class='center gain'>OVR " + before + " → " + after + "</p>" : "") +
      (gains.skill ? "<p class='center gain'>★ SIGNATURE MOVE UNLOCKED — choose it next!</p>" : "") +
      (flowed ? "<p class='center'>🔵🔥 You hit the FLOW STATE this match.</p>" : "") +
      "<p class='center'>+" + xpGot + " XP" + (lvUp ? " • <b class='gain'>LEVEL UP! +" + lvUp + " SKILL POINT</b>" : "") + " • MANAGER RATING " + Math.round(C.mgr) + "</p>",
      [{ label: "CONTINUE", value: 1 }]);
    if (C.pickSkill) await chooseSkill();
    if (sideBySide()) VB.Coop.sbNews(you().name + " (" + club(mineId).short + ") " + (res.won ? "beat " : "lost to ") + foe.name + " " + res.score[0] + "-" + res.score[1] + " — rating " + rating + "/10.");
    if (pre && pre.tone === "fiery") { C.interest += res.won ? 0.04 : -0.02; C.mgr = clamp(C.mgr + (res.won ? 2 : -4), 0, 100); }
    var champ = /PLAYOFF FINAL/.test(label) && res.won;
    if (VB.Media && (champ || /PLAYOFF/.test(label) || rating >= 8 || rating <= 5 || Math.random() < 0.35)) {
      var post = await VB.Media.post({ who: you().name, team: club(mineId).short, foe: foe.name, won: res.won, score: res.score, rating: rating, champion: champ });
      news("📰 " + post.outlet + " — " + you().name + ": \"" + post.quote + "\"", "you");
      await VB.Media.reaction(post, null, careerTone(post.tone, res.won));
    }
    return homeSide === 0 ? [res.score[0], res.score[1]] : [res.score[1], res.score[0]];
  }
  // interview answers → manager rating, fame and dressing-room mood
  function careerTone(tone, won) {
    if (tone === "humble") { C.mgr = clamp(C.mgr + 2, 0, 100); return "+2 MANAGER RATING"; }
    if (tone === "confident") { C.interest += 0.03; if (won) C.form = clamp(C.form + 0.2, -3, 3); return "+FAME" + (won ? " • +FORM" : ""); }
    if (tone === "fiery") { C.interest += 0.06; C.mgr = clamp(C.mgr - (won ? 3 : 6), 0, 100); return "++FAME • -" + (won ? 3 : 6) + " MANAGER RATING"; }
    C.mgr = clamp(C.mgr + 2, 0, 100); C.form = clamp(C.form + 0.1, -3, 3); return "+2 MANAGER RATING • THE DRESSING ROOM APPRECIATES IT";
  }

  async function playFixture(L, h, a, label) {
    if (C.club && (h === C.club || a === C.club)) return await userMatch(L, h, a, label);
    return simFixture(h, a);
  }

  function headline(L, h, a, sh, sa) {
    var win = sh > sa ? h : a, lose = sh > sa ? a : h, ws = Math.max(sh, sa), ls = Math.min(sh, sa);
    var upset = club(win).prestige + 4 < club(lose).prestige;
    var derby = (h === "OSB" && a === "SUN") || (h === "SUN" && a === "OSB") || (h === "PER" && a === "TRE") || (h === "TRE" && a === "PER");
    if (derby) return (L.id === "SV" ? "OSAKA DERBY: " : "CLASSIC: ") + club(win).short + " beat " + club(lose).short + " " + ws + "-" + ls + ".";
    if (upset) return "UPSET! " + club(win).short + " stun " + club(lose).short + " " + ws + "-" + ls + ".";
    if (ws - ls >= 7) return club(win).short + " crush " + club(lose).short + " " + ws + "-" + ls + ".";
    return null;
  }

  async function playRound(r) {
    var label = "ROUND " + (r + 1) + "/" + lg(myLeague()).rounds.length;
    var ord = leagueOrder();
    for (var k = 0; k < ord.length; k++) {
      var L = lg(ord[k]);
      if (!L.rounds[r]) continue;                                      // a league with fewer clubs (older save) is already done
      for (var i = 0; i < L.rounds[r].length; i++) {
        var m = L.rounds[r][i];
        var sc = await playFixture(L, m[0], m[1], label);
        applyTable(L, m[0], m[1], sc[0], sc[1]);
        var hl = headline(L, m[0], m[1], sc[0], sc[1]);
        if (hl && Math.random() < 0.6) news(L.flag + " " + hl, "result");
      }
    }
    if (!C.club) C.recent.push(null);
    await afterRound();
  }

  // ================== STORY EVENTS ==================
  async function afterRound() {
    Object.keys(C.players).forEach(function (id) { var p = P(id); if (p.injured > 0) p.injured--; });
    if (C.injured > 0) C.injured--;
    var cl = C.club ? club() : null, r = Math.random();
    if (!cl || C.mode === "coach") return;
    if (r < 0.12) {
      var mates = cl.roster.filter(function (id) { return id !== "you"; }), victim = P(pick(mates));
      victim.injured = irnd(1, 2);
      var sameRole = victim.role === you().role;
      news("🚑 " + cl.short + ": " + victim.name + " is injured for " + victim.injured + " round(s)." + (sameRole ? " A spot opens up for " + you().name + "." : ""), "story");
    } else if (r < 0.17) {
      C.injured = 1;
      news("🚑 " + you().name + " tweaks an ankle in training and will miss the next round.", "you");
      await U.modal("INJURY", "<p>You tweaked an ankle in training. You'll miss the next round.</p>");
    } else if (r < 0.27 && C.form > 0.8) {
      news("🗞️ Coach " + cl.coach + ": \"" + you().name + " is playing with real confidence. Exciting.\"", "you");
    } else if (r < 0.34 && mean(C.recent.filter(function (x) { return x !== null; }).slice(-3)) >= 7) {
      var suitor = pick(Object.keys(C.clubs).filter(function (id) { return id !== C.club; }));
      C.interest += 0.12;
      news("👀 RUMOUR: " + club(suitor).short + " are monitoring " + you().name + ".", "you");
    } else if (r < 0.4) {
      var delta = Math.round(cl.budget * rnd(-0.12, 0.08));
      cl.budget += delta;
      news("💶 " + cl.short + (delta < 0 ? " announce budget cuts after a sponsor pulls out." : " land a new sponsor."), "story");
      if (delta < 0) cl.arc = "FINANCIAL TROUBLE";
    } else if (r < 0.46 && cl.arc === "UNDER PRESSURE" && cl.strict < 0.9) {
      cl.strict = clamp(cl.strict + 0.1, 0, 1);
      news("🔥 The " + cl.short + " board demands results. Coach " + cl.coach + " is on thin ice.", "story");
    }
  }

  // ================== TRANSFERS ==================
  function aiTransfers(n) {
    var lines = [], ids = Object.keys(C.clubs);
    for (var k = 0; k < n; k++) {
      var from = club(pick(ids)), fam = pick(Object.keys(COMP));
      var pool = from.roster.filter(function (id) { return id !== "you" && P(id).role === fam; });
      if (famCount(from, fam) <= ((fam === "OH" || fam === "MB") ? 2 : 1) || !pool.length) continue;
      var pid = pick(pool), p = P(pid);
      var dests = ids.filter(function (id) { return id !== from.id && famCount(club(id), fam) < COMP[fam] + 1 && club(id).budget - payroll(club(id)) > p.salary * 0.5; });
      if (!dests.length) continue;
      var to = club(pick(dests));
      moveTo(pid, to.id);
      var big = ovr(p) >= 84;
      var line = (big ? "💥 BLOCKBUSTER: " : "🔁 TRANSFER: ") + p.name + " (" + flagOf(p.nat) + " " + p.role + ", " + ovr(p) + ") moves from " + from.short + " to " + to.short + ".";
      news(line, "transfer"); lines.push(line);
    }
    // free agents get picked up where squads are thin
    shuffle(C.free.slice()).forEach(function (pid) {
      var p = P(pid);
      var need = Object.keys(C.clubs).find(function (id) { return famCount(club(id), p.role) < COMP[p.role]; });
      if (need) { moveTo(pid, need); var l2 = "✍️ " + club(need).short + " sign free agent " + p.name + "."; news(l2, "transfer"); lines.push(l2); }
    });
    return lines;
  }
  // rarely a fresh face from outside both leagues arrives
  function freshFaces(n) {
    var lines = [];
    for (var k = 0; k < n; k++) {
      var fam = pick(Object.keys(COMP)), phenom = Math.random() < 0.08, young = !phenom && Math.random() < 0.55;
      var nat = pick(VB.IMPORT_NATS.concat(["ITA", "JPN"]));
      var p = genPlayer(nat, fam, phenom ? irnd(84, 88) : young ? irnd(64, 70) : irnd(72, 80), phenom ? irnd(20, 24) : young ? irnd(18, 20) : irnd(23, 28));
      if (young) p.pot = clamp(ovr(p) + irnd(10, 20), 0, 96);
      var dests = Object.keys(C.clubs).sort(function (a, b) { return famCount(club(a), fam) - famCount(club(b), fam); });
      var to = phenom ? Object.keys(C.clubs).sort(function (a, b) { return club(b).budget - club(a).budget; })[0] : dests[0];
      addPlayer(p, to);
      var line = (phenom ? "🌟 FRESH FACE PHENOM: " : "🆕 FRESH FACE: ") + (young ? p.age + "-year-old " : "") + flagOf(nat) + " " +
                 VB.FAMILY_NAMES[fam].toLowerCase() + " " + p.name + " (" + ovr(p) + ") joins " + club(to).short + ".";
      news(line, "transfer"); lines.push(line);
    }
    return lines;
  }
  function trimRosters() {
    Object.keys(C.clubs).forEach(function (id) {
      var cl = club(id);
      Object.keys(COMP).forEach(function (fam) {
        while (famCount(cl, fam) > COMP[fam] + 1) {
          var worst = cl.roster.filter(function (x) { return x !== "you" && P(x).role === fam; }).sort(function (a, b) { return ovr(P(a)) - ovr(P(b)); })[0];
          if (!worst) break;
          release(worst);
          news("📤 " + cl.short + " release " + P(worst).name + ".", "transfer");
        }
      });
    });
  }

  function needLevel(cl, fam) {
    var n = (fam === "OH" || fam === "MB") ? 2 : 1;
    var ovs = cl.roster.filter(function (id) { return id !== "you" && P(id).role === fam; }).map(function (id) { return ovr(P(id)); }).sort(function (a, b) { return b - a; });
    return ovs.length >= n ? ovs[n - 1] : 0;
  }
  function makeOffers(forced) {
    var me = you(), o = ovr(me), fam = me.role;
    var played = C.recent.filter(function (x) { return x !== null; }).slice(-6), avg = played.length ? mean(played) : 6;
    var fame = C.awardsWon.length * 0.15 + C.interest, list = [];
    Object.keys(C.clubs).forEach(function (id) {
      if (id === C.club) return;
      var cl = club(id), need = needLevel(cl, fam);
      var p = clamp((o - need + 5) / 10 * 0.5 + (avg - 6) * 0.25 + fame + rnd(-0.25, 0.25), 0, 0.95);
      if (cl.prestige - o > 18) p *= 0.2;
      if (Math.random() < p * 0.55) list.push(offerFrom(cl, o >= need - 2 ? "STARTER" : "ROTATION"));
    });
    list.sort(function (a, b) { return club(b.club).prestige - club(a.club).prestige; });
    list = list.slice(0, 3);
    if (forced && !list.length) {
      list = Object.keys(C.clubs).sort(function (a, b) { return club(a).prestige - club(b).prestige; }).slice(0, 2)
        .map(function (id) { return offerFrom(club(id), "ROTATION"); });
    }
    C.interest = Math.max(0, C.interest - 0.1);
    return list;
  }
  function offerFrom(cl, status) {
    return { club: cl.id, salary: Math.round(salaryFor(you()) * rnd(0.9, 1.25) * (cl.prestige / 82)), years: irnd(1, 3), status: status };
  }
  function join(offer) {
    var prev = C.club;
    removeFromClub("you");
    var cl = club(offer.club);
    cl.roster.push("you");
    you().club = cl.id; you().salary = offer.salary; you().years = offer.years;
    C.club = cl.id;
    C.promise = offer.status;
    C.contract = { salary: offer.salary, years: offer.years };
    news("✍️ " + you().name + " signs with " + cl.name + " (" + offer.years + " yr, " + offer.salary + "k)" + (prev ? ", leaving " + club(prev).short : "") + ".", "you");
    trimRosters();
  }
  function offersHTML(list) {
    return "<div class='offers'>" + list.map(function (o) {
      var cl = club(o.club);
      return "<div class='offer' style='border-color:" + cl.kit + "'><b>" + esc(cl.name) + "</b> <span class='muted'>" + esc(lg(cl.league).flag + " " + lg(cl.league).name) +
        "</span><br/>" + o.status + " • " + o.salary + "k / yr • " + o.years + " YR" + (o.years > 1 ? "S" : "") +
        "<br/><span class='muted'>PRESTIGE " + cl.prestige + " • " + esc(cl.arc) + "</span><br/><i>" + esc(cl.story) + "</i></div>";
    }).join("") + "</div>";
  }

  // what the club decides about you this window
  function clubDecision(pre) {
    var cl = club(), recent = C.recent.slice(-5);
    var played = recent.filter(function (x) { return x !== null; }), benched = recent.length - played.length;
    var avg = played.length ? mean(played) : 5.5;
    if (pre && you().years <= 0) return (avg >= 6.1 || isLikelyStarter()) ? { kind: "renew" } : { kind: "nonrenew" };
    if (C.recent.length < 3) return null;
    if (benched >= 3 && avg < 6 && Math.random() < 0.35 + cl.strict * 0.4) return { kind: "release", why: "performance" };
    var avgSal = payroll(cl) / cl.roster.length;
    if (payroll(cl) > cl.budget && you().salary > avgSal * 0.6 && Math.random() < 0.3) return { kind: "release", why: "budget" };
    if (Math.random() < 0.07 + (benched >= 2 ? 0.08 : 0)) return { kind: "trade" };
    return null;
  }

  async function transferWindow(pre) {
    if (C.mode === "coach") return await coachWindow(pre);
    var lines = [];
    if (C.club && !C.season0) {
      var d = clubDecision(pre), cl = club();
      if (d && d.kind === "release") {
        release("you"); C.club = null; C.contract = null;
        var why = d.why === "performance" ? "\"We need more from that position. We're letting you go.\"" : "\"The budget doesn't work anymore. It's nothing personal.\"";
        news("📤 " + cl.short + " release " + you().name + " (" + (d.why === "performance" ? "performance" : "budget cuts") + ").", "you");
        await U.modal("RELEASED", "<p>Coach " + esc(cl.coach) + ": " + esc(why) + "</p><p>You're a free agent. Clubs can sign you this window.</p>");
      } else if (d && d.kind === "trade") {
        var fam = you().role;
        var dest = Object.keys(C.clubs).filter(function (id) { return id !== cl.id && club(id).roster.some(function (x) { return P(x).role === fam; }); });
        if (dest.length) {
          var to = club(pick(dest));
          var swap = pick(to.roster.filter(function (x) { return P(x).role === fam; }));
          moveTo(swap, cl.id);
          join({ club: to.id, salary: you().salary, years: Math.max(1, you().years) });
          news("🔁 TRADE: " + cl.short + " send " + you().name + " to " + to.short + " for " + P(swap).name + ".", "you");
          await U.modal("TRADED!", "<p>" + esc(cl.short) + " traded you to <b>" + esc(to.name) + "</b> in exchange for " + esc(P(swap).name) + ".</p><p><i>" + esc(to.story) + "</i></p>");
        }
      } else if (d && d.kind === "nonrenew") {
        release("you"); C.club = null; C.contract = null;
        news("📤 " + cl.short + " decline to renew " + you().name + "'s contract.", "you");
        await U.modal("CONTRACT NOT RENEWED", "<p>" + esc(cl.short) + " won't renew your contract. You're a free agent.</p>");
      } else if (d && d.kind === "renew") {
        C.renewal = offerFrom(cl, isLikelyStarter() ? "STARTER" : "ROTATION");
      }
    }
    lines = lines.concat(aiTransfers(C.season0 ? 2 : irnd(3, 6)));
    if (Math.random() < 0.7) lines = lines.concat(freshFaces(irnd(1, 2)));
    trimRosters();

    var offers = C.season0 ? [] : makeOffers(!C.club);
    if (C.renewal) { offers.unshift(C.renewal); C.renewal = null; }
    if (offers.length) {
      var btns = offers.map(function (o, i) { return { label: (o.club === C.club ? "RE-SIGN WITH " : "SIGN WITH ") + club(o.club).short, value: i }; });
      if (C.club && you().years > 0) btns.push({ label: "STAY AT " + club().short, value: -1, cls: "pink" });
      else if (C.club) btns.push({ label: "TEST FREE AGENCY", value: -2, cls: "pink" });
      else btns.push({ label: "WAIT AS FREE AGENT", value: -1, cls: "pink" });
      var pickI = await U.modal("TRANSFER WINDOW — OFFERS", "<p>Clubs want you. Your performances decide who calls.</p>" + offersHTML(offers), btns);
      if (pickI >= 0) join(offers[pickI]);
      else if (pickI === -2) { release("you"); C.club = null; C.contract = null; news(you().name + " tests free agency.", "you"); }
    } else if (!C.season0) {
      await U.modal(CAL_TXT[CAL[C.stage]], "<p>" + (C.club ? "No offers for you this window — focus on performing." : "No clubs called. Keep training as a free agent.") + "</p>" +
        (lines.length ? "<h3 class='mini'>AROUND THE LEAGUES</h3><ul class='newslist'>" + lines.slice(0, 8).map(function (l) { return "<li>" + esc(l) + "</li>"; }).join("") + "</ul>" : ""));
      return;
    }
    if (lines.length) {
      await U.modal("AROUND THE LEAGUES", "<ul class='newslist'>" + lines.slice(0, 10).map(function (l) { return "<li>" + esc(l) + "</li>"; }).join("") + "</ul>");
    }
  }

  // ================== PLAYOFFS & SEASON END ==================
  function rank(L) {
    return L.clubs.slice().sort(function (a, b) {
      var A = L.table[a], B = L.table[b];
      return (B.w - A.w) || ((B.pf - B.pa) - (A.pf - A.pa));
    });
  }
  async function playoffs(stage) {
    var order = leagueOrder();
    for (var k = 0; k < order.length; k++) {
      var L = lg(order[k]);
      if (stage === "SF") {
        var rk = rank(L);
        L.semis = [[rk[0], rk[3], null, null], [rk[1], rk[2], null, null]];
        for (var i = 0; i < 2; i++) {
          var m = L.semis[i], sc = await playFixture(L, m[0], m[1], "PLAYOFF SEMIFINAL");
          m[2] = sc[0]; m[3] = sc[1];
        }
        news(L.flag + " " + L.name + " FINAL SET: " + club(winner(L.semis[0])).short + " vs " + club(winner(L.semis[1])).short + ".", "result");
      } else {
        var f = [winner(L.semis[0]), winner(L.semis[1]), null, null];
        var sc2 = await playFixture(L, f[0], f[1], "PLAYOFF FINAL");
        f[2] = sc2[0]; f[3] = sc2[1];
        L.final = f; L.champion = winner(f);
        news("🏆 " + club(L.champion).name + " are " + L.name + " CHAMPIONS (season " + C.season + ")!", "result");
        if (L.champion === C.club) { C.trophies.push(C.season + " " + L.name + " CHAMPION (" + club().short + ")"); }
      }
    }
  }
  function winner(m) { return m[2] > m[3] ? m[0] : m[1]; }

  // ================== CLUB WORLD CUP: the champions of all eight leagues ==================
  async function clubWorldCup() {
    var field = leagueIds().map(function (id) { var L = lg(id); return L.champion || rank(L)[0]; });
    field = shuffle(field);
    var CW = { name: "CLUB WORLD CUP", flag: "🌍" }, lines = [], rounds = ["QUARTERFINAL", "SEMIFINAL", "FINAL"], cur = field;
    var inIt = C.club && field.indexOf(C.club) >= 0;
    await U.modal("🌍 CLUB WORLD CUP", "<p>The champions of all eight leagues meet in one knockout tournament.</p><p>" +
      field.map(function (id) { return esc(lg(club(id).league).flag + " " + club(id).short); }).join(" • ") + "</p>" +
      (inIt ? "<p class='gain'>" + esc(club().short) + " are in!</p>" : "<p class='muted'>" + (C.club ? esc(club().short) + " didn't win their league — you watch from home." : "") + "</p>"));
    for (var r = 0; r < 3; r++) {
      var next = [];
      for (var i = 0; i < cur.length; i += 2) {
        var h = cur[i], a = cur[i + 1], sc;
        if (C.club && (h === C.club || a === C.club)) sc = await userMatch(CW, h, a, rounds[r]);
        else sc = simFixture(h, a);
        var w = sc[0] > sc[1] ? h : a;
        lines.push(rounds[r] + ": " + club(h).short + " " + sc[0] + "-" + sc[1] + " " + club(a).short);
        next.push(w);
      }
      cur = next;
    }
    var champ = cur[0];
    news("🌍 " + club(champ).name + " win the CLUB WORLD CUP!", "result");
    if (champ === C.club) (C.mode === "coach" ? (C.coachTrophies = C.coachTrophies || []) : C.trophies).push(C.season + " CLUB WORLD CUP (" + club().short + ")");
    await U.modal("🌍 CLUB WORLD CUP — " + club(champ).short, "<ul class='newslist'>" + lines.map(function (l) { return "<li>" + esc(l) + "</li>"; }).join("") + "</ul>" +
      (champ === C.club ? "<p class='center big'>🏆 WORLD CHAMPIONS!</p>" : ""));
  }

  // ================== SUMMER: VNL WITH YOUR NATIONAL TEAM ==================
  async function nationsLeague() {
    if (C.mode === "coach") { news("☀️ Summer break. Time to plan next season.", "story"); return; }
    var me = you(), nt = VB.NATIONAL.find(function (t) { return t.id === me.nat; });
    if (!nt) { news("☀️ " + flagOf(me.nat) + " isn't in the VNL this year — a summer of training instead.", "story"); grow(me, 7); return; }
    var line = VB.teamLineup(nt), slots = VB.ROLES.filter(function (r) { return VB.FAMILY[r] === me.role; });
    var weakest = slots.sort(function (a, b) { return ovr(line[a]) - ovr(line[b]); })[0], bar = ovr(line[weakest]);
    if (ovr(me) < bar - 6 || C.injured > 0) {
      news("📋 Not selected for " + nt.name + "'s VNL squad (their " + VB.FAMILY_NAMES[me.role].toLowerCase() + "s are around OVR " + bar + ").", "story");
      await U.modal("VNL SQUAD ANNOUNCED", "<p>" + esc(nt.flag + " " + nt.name) + " name their squad — and you're not in it. Their " + VB.FAMILY_NAMES[me.role].toLowerCase() + "s are around OVR " + bar + ".</p><p class='muted'>A summer of extra training instead.</p>");
      grow(me, 7); return;
    }
    var starter = ovr(me) >= bar - 1;
    line[weakest] = me;
    var mine = { id: nt.id, name: nt.name, short: nt.name, flag: nt.flag, kit: nt.kit, kit2: nt.kit2, ovr: nt.ovr, play: VB.PLAY_OF[nt.id], lineup: line };
    await U.modal("📞 NATIONAL TEAM CALL-UP!", "<p>" + esc(nt.flag + " " + nt.name) + " call you up for the VNL" + (starter ? " — as a STARTER." : " as a squad player.") + "</p>");
    news("📞 Called up by " + nt.name + " for the VNL" + (starter ? " — starting!" : "."), "you");
    var foes = shuffle(VB.NATIONAL.filter(function (t) { return t.id !== nt.id; })), wins = 0, log = [];
    async function game(foeT, label, bo) {
      var foe = { id: foeT.id, name: foeT.name, short: foeT.name, flag: foeT.flag, kit: foeT.kit, kit2: foeT.kit2, ovr: foeT.ovr, play: VB.PLAY_OF[foeT.id], lineup: VB.teamLineup(foeT) };
      var won, sc;
      if (starter) {
        U.showView("match");
        $("recordLine").textContent = "VNL • " + nt.name;
        var res = await VB.Engine.playMatch({ mine: mine, foe: foe, homeSide: Math.random() < 0.5 ? 0 : 1, mode: "role", myRole: weakest, label: "VNL • " + label, league: "VNL", floor: "vnl", bestOf: bo || 1 });
        U.showView("hub");
        won = res.won; sc = res.score;
        var rating = VB.Stats.rating(res.stats.you || VB.Stats.newLine(), me.role, won);
        grow(me, rating); gainXP(rating * 9);
      } else {
        var s = VB.Stats.simSets(mine, foe, bo || 1); won = s.a > s.b; sc = [s.a, s.b]; grow(me, 6.6);
      }
      log.push(label + ": " + nt.name + " " + sc[0] + "-" + sc[1] + " " + foeT.name);
      return won;
    }
    for (var g = 0; g < 3; g++) if (await game(foes[g], "POOL " + (g + 1) + "/3")) wins++;
    var title = false;
    if (wins >= 2) {
      var top = VB.NATIONAL.filter(function (t) { return t.id !== nt.id; }).sort(function (a, b) { return b.ovr - a.ovr; }).slice(0, 4);
      if (await game(pick(top.slice(2)), "SEMIFINAL", 3)) title = await game(pick(top.slice(0, 2)), "FINAL", 3);
      else log.push("Out in the semifinal.");
    } else log.push("Out in the pool stage.");
    if (title) { C.trophies.push(C.season + " VNL CHAMPION (" + nt.name + ")"); news("🏆🌍 VNL CHAMPIONS with " + nt.name + "!", "you"); C.interest += 0.15; }
    C.caps = (C.caps || 0) + (starter ? 5 : 3);
    await U.modal(title ? "🏆 VNL CHAMPIONS!" : "VNL — " + nt.name, "<ul class='newslist'>" + log.map(function (l) { return "<li>" + esc(l) + "</li>"; }).join("") + "</ul><p class='center'>NATIONAL TEAM CAPS: " + C.caps + "</p>");
  }

  function infoFor(pid) {
    var p = P(pid), cl = p.club ? club(p.club) : null;
    return { name: p.name, fam: p.role, team: cl ? cl.short : "FREE AGENT", teamId: p.club, flag: flagOf(p.nat), kit: cl ? cl.kit : "#888888", face: p.face, you: pid === "you" };
  }

  async function seasonEnd() {
    var html = "", show = null;
    // manager objectives: the boss's verdict
    var objHtml = "";
    if (C.mode === "coach") html += await boardReview();
    if (C.obj && C.mode !== "coach") {
      var nd = 0;
      objHtml = "<h3 class='mini'>MANAGER OBJECTIVES</h3><ul class='newslist'>" + C.obj.map(function (o) {
        var ok = objDone(o); if (ok) nd++;
        return "<li class='" + (ok ? "you" : "") + "'>" + (ok ? "✅ " : "❌ ") + esc(o.text) + " — " + objProgress(o) + "/" + o.target + "</li>";
      }).join("") + "</ul>";
      C.mgr = clamp(C.mgr + nd * 12 - (3 - nd) * 8, 0, 100);
      if (nd && C.club) { var raise = Math.round(you().salary * 0.05 * nd); you().salary += raise; objHtml += "<p class='gain'>Bonus: +" + raise + "k salary" + (VB.Gacha ? " • +" + VB.Gacha.earn(500 * nd) + " 🏐 coins" : "") + "</p>"; }
      objHtml += "<p>MANAGER RATING: <b>" + Math.round(C.mgr) + "</b> " + (C.mgr >= 70 ? "— the coach trusts you completely." : C.mgr >= 45 ? "— solid, keep going." : "— the coach is losing patience.") + "</p>";
      news("📋 Objectives: " + nd + "/3 completed. Manager rating " + Math.round(C.mgr) + ".", "you");
    }
    html += objHtml;
    leagueIds().forEach(function (id) {
      var L = lg(id), agg = {}, info = {};
      Object.keys(C.sstats).forEach(function (pid) { var p = P(pid); if (p && p.club && club(p.club).league === id) { agg[pid] = C.sstats[pid]; info[pid] = infoFor(pid); } });
      var bonus = {}; if (L.champion) bonus[L.champion] = 12;
      var list = VB.Stats.awards(agg, info, bonus);
      list.forEach(function (a) { if (a.id === "you") { C.awardsWon.push(C.season + " " + L.name + " " + a.title); news("🏅 " + you().name + " wins " + a.title + " (" + L.name + ")!", "you"); } });
      if (id === myLeague()) show = { L: L, list: list };
      if (id !== myLeague()) { html += "<h3 class='mini'>" + L.flag + " " + L.name + " — CHAMPION: " + esc(L.champion ? club(L.champion).name : "—") + "</h3>"; return; }
      html += "<h3 class='mini'>" + L.flag + " " + L.name + " — CHAMPION: " + esc(L.champion ? club(L.champion).name : "—") + "</h3>" + VB.Stats.awardsHTML(list);
    });
    if (show && show.L.champion) {
      var L0 = show.L, f = L0.final, runner = f ? (f[0] === L0.champion ? f[1] : f[0]) : null, third = null;
      (L0.semis || []).forEach(function (m) { if (m[2] == null) return; var l = winner(m) === m[0] ? m[1] : m[0]; if (!third) third = l; });
      var pod = function (cid) {
        var cl = club(cid), line = lineupFor(cl, true);
        return { id: cid, name: cl.short, kit: cl.kit, kit2: cl.kit2, faces: VB.ROLES.map(function (r) { return line[r] ? line[r].face : VB.makeFace("ITA"); }) };
      };
      await VB.Ceremony.play({ title: L0.name + " AWARDS", sub: "SEASON " + C.season, podium: [L0.champion, runner, third].filter(Boolean).map(pod),
                               awards: VB.Ceremony.fromAwards(show.list, function (cid) { return cid && C.clubs[cid] ? C.clubs[cid].kit2 : null; }) });
    }
    var my = C.sstats.you || VB.Stats.newLine(), played = C.recent.filter(function (x) { return x !== null; });
    C.history.push({ season: C.season, club: C.club ? club().short : "FREE AGENT", league: C.club ? lg(club().league).name : "—",
                     mp: my.mp, pts: VB.Stats.pts(my), eff: VB.Stats.effTxt(my), dig: my.dig, blk: my.blk, ace: my.ace,
                     avg: played.length ? (Math.round(mean(played) * 10) / 10) : "—", ovr: ovr(you()) });
    await U.modal("SEASON " + C.season + " REVIEW",
      "<p class='center'>YOUR SEASON: " + esc(VB.Stats.lineText(my)) + " • AVG RATING " + (played.length ? (Math.round(mean(played) * 10) / 10) : "—") + "</p>" + html,
      [{ label: "START SEASON " + (C.season + 1), value: 1 }]);

    // ageing, development, retirements, contracts
    Object.keys(C.players).forEach(function (pid) {
      if (pid === "you") return;
      var p = P(pid);
      p.age++;
      var d = p.age < 24 ? irnd(0, 4) : p.age < 29 ? irnd(-1, 2) : p.age < 32 ? irnd(-2, 1) : irnd(-4, 0);
      if (ovr(p) + d > p.pot) d = Math.min(d, 0);
      VB.ATTRS.forEach(function (a) { p[a] = clamp(p[a] + d + irnd(-1, 1), 25, 99); });
      p.years = (p.years || 1) - 1;
      if (p.age >= 34 && Math.random() < (p.age - 33) * 0.3) {
        news("👋 " + p.name + " (" + (p.club ? club(p.club).short : "free agent") + ") retires at " + p.age + ".", "story");
        removeFromClub(pid); C.free = C.free.filter(function (x) { return x !== pid; });
        delete C.players[pid];
        return;
      }
      if (p.years <= 0 && p.club && Math.random() < 0.35) { news("📤 " + p.name + " leaves " + club(p.club).short + " as a free agent.", "transfer"); release(pid); }
      else if (p.years <= 0) p.years = irnd(1, 3);
      p.salary = salaryFor(p);
    });
    // unsigned free agents drift out of the game; keep the 30 best
    C.free = C.free.filter(function (pid) { return C.players[pid]; }).sort(function (x, y) { return ovr(P(y)) - ovr(P(x)); });
    C.free.splice(30).forEach(function (pid) { delete C.players[pid]; });
    var me = you();
    me.age++; me.years = (me.years || 1) - 1;
    // keep every squad playable after retirements
    Object.keys(C.clubs).forEach(function (id) {
      var cl = club(id), home = VB.LEAGUES[cl.league].nat;
      Object.keys(COMP).forEach(function (fam) {
        while (famCount(cl, fam) < ((fam === "OH" || fam === "MB") ? 3 : fam === "L" ? 1 : 2)) {
          var yp = genPlayer(Math.random() < 0.75 ? home : pick(VB.IMPORT_NATS), fam, cl.prestige - irnd(8, 14), irnd(18, 21));
          yp.pot = clamp(ovr(yp) + irnd(8, 18), 0, 95);
          addPlayer(yp, id);
          news("🆕 " + cl.short + " promote academy " + VB.FAMILY_NAMES[fam].toLowerCase() + " " + yp.name + " (" + yp.age + ").", "transfer");
        }
      });
      cl.arc = arcFor(cl.prestige);
      if (cl.arc === "NEW COACH, NEW IDEAS") { cl.coach = VB.genName(VB.LEAGUES[cl.league].nat, C.taken); cl.strict = rnd(0.3, 0.8); news("🧢 " + cl.short + " appoint new coach " + cl.coach + ".", "story"); }
      cl.budget = Math.round(cl.budget * rnd(0.95, 1.1) + (lg(cl.league).champion === id ? cl.budget * 0.1 : 0));
    });
    C.season++; C.season0 = false;
    C.sstats = {};
    C.recent = C.recent.slice(-2);
    newSeasonLeagues();
    if (C.mode === "coach") { C.tb += Math.round(club().budget * 0.2); news("— SEASON " + C.season + " BEGINS — transfer budget " + C.tb + "k.", "story"); return; }
    newObjectives();
    news("— SEASON " + C.season + " BEGINS — Objectives: " + C.obj.map(function (o) { return o.text; }).join(", ") + ".", "story");
    // the body has limits: a choice from 33, the end at 35
    var me = you();
    if (me.age >= 35) {
      await U.modal("THE LAST WHISTLE", "<p>At " + me.age + " your body has made the decision for you. It's time to retire.</p>", [{ label: "RETIRE", value: 1 }]);
      await retireToCoach();
    } else if (me.age >= 33) {
      var k = await U.modal("ONE MORE SEASON?", "<p>You're " + me.age + ". Your knees ache in the mornings, but the gym still feels like home.</p>",
        [{ label: "PLAY ON", value: 0 }, { label: "RETIRE & BECOME A COACH", value: 1, cls: "pink" }]);
      if (k === 1) await retireToCoach();
    }
  }

  // ================== RETIREMENT → COACH CAREER ==================
  function playerValue(p) {
    var a = p.age < 24 ? 1.3 : p.age < 29 ? 1 : p.age < 32 ? 0.7 : 0.4;
    return Math.round(Math.pow(Math.max(1, ovr(p) - 58), 2) * 3 * a);
  }
  function boardTarget(cl) { return cl.prestige >= 82 ? 1 : cl.prestige >= 78 ? 2 : cl.prestige >= 76 ? 4 : 6; }
  async function retireToCoach() {
    var me = you(), fame = C.trophies.length * 2 + C.awardsWon.length + (C.caps || 0) / 5 + C.history.length * 0.3;
    news("👋 " + me.name + " retires at " + me.age + " after " + C.history.length + " seasons.", "you");
    await U.modal("👋 RETIREMENT", "<p class='center big'>THANK YOU, " + esc(me.name) + "</p><p class='center'>" + C.history.length + " seasons • " + C.trophies.length + " trophies • " +
      C.awardsWon.length + " individual awards • " + (C.caps || 0) + " national caps</p>" + U.cabinet(C.trophies, "🏆"));
    release("you"); C.free = C.free.filter(function (x) { return x !== "you"; }); me.retired = true;
    C.mode = "coach"; C.club = null; C.board = 55; C.coachRec = { w: 0, l: 0 };
    var ids = Object.keys(C.clubs).sort(function (a, b) { return club(a).prestige - club(b).prestige; });
    var tier = fame >= 12 ? ids.slice(-12, -2) : fame >= 5 ? ids.slice(20, 44) : ids.slice(0, 20);
    var offers = shuffle(tier).slice(0, 3);
    var k = await U.modal("📋 COACHING OFFERS", "<p>Your playing days are over — but the phone keeps ringing. Three clubs want you as HEAD COACH.</p>" +
      offers.map(function (id) { var c = club(id); return "<div class='offer' style='border-color:" + c.kit + "'><b>" + esc(c.name) + "</b> " + esc(lg(c.league).flag + " " + lg(c.league).name) +
        "<br/>Prestige " + c.prestige + " • Budget " + c.budget + "k • Board target: top " + boardTarget(c) + "<br/><i>" + esc(c.story) + "</i></div>"; }).join(""),
      offers.map(function (id, i) { return { label: "COACH " + club(id).short, value: i }; }));
    takeJob(offers[k]);
  }
  function takeJob(id) {
    var cl = club(id);
    C.club = id; cl.coach = you().name; C.tb = Math.round(cl.budget * 0.3);
    C.target = boardTarget(cl);
    news("📋 " + you().name + " is the new head coach of " + cl.name + "! Board target: top " + C.target + ".", "you");
  }
  async function coachMatch(L, h, a, label) {
    var mineId = C.club, foeId = h === mineId ? a : h, homeSide = h === mineId ? 0 : 1;
    var mine = teamDef(mineId, lineupFor(club(mineId), true)), foe = teamDef(foeId, lineupFor(club(foeId), true));
    U.showView("match");
    $("recordLine").textContent = "COACH " + you().name + " • SEASON " + C.season;
    var res = await VB.Engine.playMatch({ mine: mine, foe: foe, homeSide: homeSide, mode: "full", label: L.name + " • " + label + " • YOU COACH", league: L.name });
    U.showView("hub");
    addSeason(res.stats);
    if (res.won) C.coachRec.w++; else C.coachRec.l++;
    C.board = clamp(C.board + (res.won ? 2 : -2.5), 0, 100);
    if (VB.Media && (/PLAYOFF|FINAL/.test(label) || Math.random() < 0.25)) {
      var post = await VB.Media.post({ who: you().name, team: club(mineId).short, foe: foe.name, won: res.won, score: res.score, rating: res.won ? 7.5 : 6, champion: /FINAL/.test(label) && !/SEMI/.test(label) && res.won });
      var fx = post.tone === "fiery" ? (C.board -= 3, "-3 BOARD") : post.tone === "humble" || post.tone === "team" ? (C.board += 1, "+1 BOARD") : "";
      news("📰 Coach " + you().name + ": \"" + post.quote + "\"", "you");
      await VB.Media.reaction(post, null, fx);
    }
    return homeSide === 0 ? [res.score[0], res.score[1]] : [res.score[1], res.score[0]];
  }
  async function coachWindow(pre) {
    var lines = aiTransfers(irnd(3, 6)).concat(Math.random() < 0.7 ? freshFaces(irnd(1, 2)) : []);
    trimRosters();
    await U.modal(CAL_TXT[CAL[C.stage]], "<p>The market is open — sign and sell in the <b>MARKET</b> and <b>SQUAD</b> tabs any time. Transfer budget: <b>" + C.tb + "k</b>.</p>" +
      (lines.length ? "<h3 class='mini'>AROUND THE LEAGUES</h3><ul class='newslist'>" + lines.slice(0, 8).map(function (l) { return "<li>" + esc(l) + "</li>"; }).join("") + "</ul>" : ""));
  }
  async function boardReview() {
    var L = lg(club().league), pos = rank(L).indexOf(C.club) + 1, champ = L.champion === C.club, prize = 0;
    if (champ) { (C.coachTrophies = C.coachTrophies || []).push(C.season + " " + L.name + " CHAMPION (" + club().short + ")"); prize += 600; }
    var met = pos <= C.target || champ;
    C.board = clamp(C.board + (met ? 15 : -18) + (champ ? 10 : 0), 0, 100);
    C.tb += prize;
    var html = "<h3 class='mini'>📋 BOARD REVIEW</h3><p>Finished " + pos + " (target: top " + C.target + ")" + (champ ? " — CHAMPIONS!" : "") + ". Board confidence: <b>" + Math.round(C.board) + "</b>." +
      (prize ? " Prize money +" + prize + "k." : "") + "</p>";
    if (C.board < 20) {
      html += "<p class='bad'>The board has seen enough. You're sacked.</p>";
      news("🪓 " + you().name + " is sacked by " + club().short + ".", "you");
      var old = C.club; club(old).coach = VB.genName(VB.LEAGUES[club(old).league].nat, C.taken);
      var ids = Object.keys(C.clubs).filter(function (id) { return id !== old && club(id).prestige <= club(old).prestige; });
      takeJob(pick(ids.length ? ids : Object.keys(C.clubs)));
      C.board = 50;
      html += "<p>A smaller club gives you a fresh start: <b>" + esc(club().name) + "</b>.</p>";
    } else C.target = boardTarget(club());
    return html;
  }
  function marketHTML() {
    var cl = club(), mine = {}; cl.roster.forEach(function (id) { mine[id] = 1; });
    var pool = Object.keys(C.players).filter(function (id) { var q = P(id); return id !== "you" && !mine[id] && !q.retired; })
      .sort(function (a, b) { return ovr(P(b)) - ovr(P(a)); });
    var filt = C.mfilter || "ALL";
    if (filt !== "ALL") pool = pool.filter(function (id) { return P(id).role === filt; });
    pool = pool.slice(0, 40);
    return "<p>TRANSFER BUDGET <b>" + C.tb + "k</b> • PAYROLL " + payroll(cl) + "k / " + cl.budget + "k • SQUAD " + cl.roster.length + "/15</p>" +
      "<div class='focus'>" + ["ALL", "S", "OH", "MB", "OP", "L"].map(function (f) { return "<button class='btn" + (filt === f ? " on" : "") + "' data-act='mfilter' data-arg='" + f + "'>" + f + "</button>"; }).join("") + "</div>" +
      "<table class='standings'><tr><th>PLAYER</th><th>POS</th><th>OVR</th><th>AGE</th><th>CLUB</th><th>FEE</th><th>WAGE</th><th></th></tr>" + pool.map(function (id) {
        var q = P(id), fee = q.club ? playerValue(q) : 0, ok = fee <= C.tb && payroll(cl) + salaryFor(q) <= cl.budget * 1.15 && cl.roster.length < 15;
        return "<tr><td>" + flagOf(q.nat) + " " + esc(q.name) + (q.skill ? " ★" : "") + "</td><td>" + q.role + "</td><td>" + ovr(q) + "</td><td>" + q.age + "</td><td>" + esc(q.club ? club(q.club).short : "FREE") +
          "</td><td>" + fee + "k</td><td>" + salaryFor(q) + "k</td><td><button class='btn tiny' data-act='buy' data-arg='" + id + "'" + (ok ? "" : " disabled") + ">SIGN</button></td></tr>";
      }).join("") + "</table><p class='muted small'>Fees follow OVR and age (young stars cost most). Wages must fit your budget.</p>";
  }

  // ================== ADVANCE ==================
  var sbGo = false;
  async function advance() {
    if (busy) return;
    // side by side: a new day only when you're both ready
    if (sideBySide() && VB.Coop.partner() && !sbGo) {
      VB.Coop.sbReady();
      if (VB.Coop.sbWaiting() && VB.Coop.partnerLive()) { VB.Coop.sbWatch(true); return; }   // they're mid-match: watch it while you wait
      render(); return;
    }
    sbGo = false;
    busy = true;
    try {
      if (VB.Coop && VB.Coop.live() && !(await VB.Coop.agree(actionLabel()))) return;      // together: P2 has to agree too
      var st = CAL[C.stage];
      if (st.indexOf("window") === 0) await transferWindow(st === "window-pre");
      else if (st[0] === "R") await playRound(+st.slice(1) - 1);
      else if (st === "SF" || st === "F") await playoffs(st);
      else if (st === "CWC") await clubWorldCup();
      else if (st === "VNL") await nationsLeague();
      if (st === "end") { await seasonEnd(); C.stage = 0; }
      else { C.stage++; if (CAL[C.stage] === "R1") C.season0 = false; }
      save();
    } finally {
      busy = false;
      U.showView("hub");
      render();
    }
  }

  // ================== CO-OP (a friend's player on your club) ==================
  var SINGLE = ["S", "OP", "L"];
  function mate() { return C && C.players.mate && C.club && club().roster.indexOf("mate") >= 0 ? C.players.mate : null; }
  // ---------- side by side: your friend has their own career; you share days, results and a world ----------
  function sideBySide() { return !!(VB.Coop && VB.Coop.sideBySide()); }
  function sbState() {
    var me = you(), cl = C.club ? club() : null, last = (C.srat || []).slice(-1)[0];
    var pl = { name: me.name, role: me.role, nat: me.nat, age: me.age, height: me.height, vert: me.vert, face: me.face, pot: me.pot, skill: me.skill || null, ps: me.ps || null };
    VB.ATTRS.forEach(function (a) { pl[a] = me[a]; });
    return { name: me.name, role: me.role, ovr: ovr(me), clubId: cl ? cl.id : null, club: cl ? cl.short : "FREE AGENT", kit: cl ? cl.kit : "#888888",
             league: cl ? lg(cl.league).name : "", season: C.season, day: C.season * 100 + C.stage, stage: CAL_TXT[CAL[C.stage]] || "ROUND " + CAL[C.stage].slice(1), last: last != null ? last : null, mode: C.mode || "player", player: pl };
  }
  function syncFriend(st, first) {
    if (!st || !st.player || C.mode === "coach") return;
    var f = C.players.friend, was = f ? f.club : undefined;
    if (!f) { f = C.players.friend = { id: "friend" }; }
    Object.keys(st.player).forEach(function (k) { f[k] = st.player[k]; });
    f.id = "friend"; f.friend = true; f.salary = f.salary || salaryFor(f); f.years = 2;
    Object.keys(C.clubs).forEach(function (id) { var r = C.clubs[id].roster, i = r.indexOf("friend"); if (i >= 0 && id !== st.clubId) r.splice(i, 1); });
    var fi = C.free.indexOf("friend"); if (fi >= 0) C.free.splice(fi, 1);
    if (st.clubId && C.clubs[st.clubId]) { if (C.clubs[st.clubId].roster.indexOf("friend") < 0) C.clubs[st.clubId].roster.push("friend"); f.club = st.clubId; }
    else { f.club = null; C.free.push("friend"); }
    if (first || was !== f.club) news("🤝 Your friend " + f.name + (f.club ? " plays for " + C.clubs[f.club].short + (f.club === C.club ? " — your teammate in this world!" : " in your world.") : " is a free agent in your world."), "you");
    save();
  }
  function sbHook() {
    if (!sideBySide()) return;
    VB.Coop.sbHook({
      onGo: function () { if (C) { sbGo = true; advance(); } },
      onPartner: function () { if (C && !busy && !$("hub").classList.contains("hidden")) render(); },
      onFriend: function (st, first) { if (C) syncFriend(st, first); },
      onNews: function (txt) { if (C) { news("🤝 " + txt, "you"); if (!busy) render(); } }
    });
  }
  // the duo panel: you and your friend side by side — who's ready, who's playing (watch it live), what's new, chat
  function sbCard() {
    var p = VB.Coop.partner(), waiting = VB.Coop.sbWaiting(), me = you(), cl = C.club ? club() : null, live = VB.Coop.partnerLive();
    function face(f, kit) { try { return "<img class='duo-face' src='" + VB.Engine.spriteURL(f, kit || "#888888") + "' alt=''/>"; } catch (e) { return ""; } }
    var mine = "<div class='duo-p me'>" + face(me.face, cl ? cl.kit : null) + "<div><div class='duo-k'>YOU</div><div class='pname'>" + esc(me.name) + "</div>" +
      "<div class='muted'>" + VB.FAMILY_NAMES[me.role] + " • OVR " + ovr(me) + "</div><div class='muted'>" + esc(cl ? cl.short : "FREE AGENT") + " • S" + C.season + "</div>" +
      "<span class='duo-chip " + (waiting ? "ok" : "") + "'>" + (waiting ? "✅ READY" : "📋 PLANNING THE DAY") + "</span></div></div>";
    var theirs = p ? "<div class='duo-p them'>" + face(p.player && p.player.face, p.kit) + "<div><div class='duo-k'>FRIEND</div><div class='pname'>" + esc(p.name) + "</div>" +
      "<div class='muted'>" + VB.FAMILY_NAMES[p.role] + " • OVR " + p.ovr + (p.last != null ? " • LAST " + p.last : "") + "</div><div class='muted'>" + esc(p.club) + " • S" + p.season + " • " + esc(p.stage) + "</div>" +
      "<span class='duo-chip " + (VB.Coop.partnerReady() ? "ok" : live ? "live" : "") + "'>" + (VB.Coop.partnerReady() ? "✅ READY" : live ? "🔴 PLAYING" : "📋 IN THE HUB") + "</span>" +
      "<div class='duo-live' id='duoLive'>" + (live ? "🔴 LIVE — " + esc(live.replace(/^.*? — /, "")) : "") + "</div></div></div>"
      : "<div class='duo-p them off'><div class='duo-face empty'>?</div><div><div class='duo-k'>FRIEND</div><div>" + esc(VB.Coop.status()) + "</div><div class='muted'>Playing solo until they're back — days advance freely.</div></div></div>";
    var both = waiting && p && VB.Coop.partnerReady(), gap = VB.Coop.sbGap();
    var gapTxt = !p || !gap ? "" : gap > 0 ? "⏸ You're " + (gap < 100 ? gap + " day" + (gap > 1 ? "s" : "") : "a season") + " ahead — you'll wait for " + esc(p.name) + " to catch up."
                                           : "⏩ You're " + (-gap < 100 ? -gap + " day" + (gap < -1 ? "s" : "") : "a season") + " behind — play on, no waiting until you catch up.";
    var log = VB.Coop.sbLog();
    return "<div class='card coop-card duo'><div class='duo-row'>" + mine +
      "<div class='duo-mid'><div class='duo-ic'>🤝</div><div class='duo-lights'><i class='" + (waiting ? "on" : "") + "'></i><i class='" + (p && VB.Coop.partnerReady() ? "on" : "") + "'></i></div><div class='duo-k'>" + (both ? "GO!" : "NEXT DAY") + "</div></div>" +
      theirs + "</div>" + (gapTxt ? "<div class='duo-gap'>" + gapTxt + "</div>" : "") +
      (log.length ? "<div class='duo-log'>" + log.map(function (t) { return "<div>🤝 " + esc(t) + "</div>"; }).join("") + "</div>" : "") +
      "<div class='hub-actions'>" + (p && live ? "<button class='btn' data-act='sbWatch'>📺 WATCH " + esc(p.name) + " LIVE</button>" : "") +
      (p ? "<button class='btn' data-act='sbChat'>💬 CHAT</button>" : "") +
      "<button class='btn tiny' data-act='coopInvite'>🔗 LINK</button><button class='btn tiny pink' data-act='coopLeave'>LEAVE CO-OP</button></div></div>";
  }
  function coopCard() {
    if (sideBySide()) return sbCard();
    var m = C.players.mate, hosting = VB.Coop && VB.Coop.hosting();
    if (!m && !hosting) return "";
    return "<div class='card coop-card'>" + (m ? "<img class='pix' src='" + VB.Engine.spriteURL(m.face, club() ? club().kit : "#888888") + "' alt=''/>" : "") +
      "<div><div class='pname'>🤝 CO-OP" + (m ? " — P2 " + esc(m.name) : "") + "</div>" +
      (m ? "<div class='muted'>" + VB.FAMILY_NAMES[m.role] + " • OVR " + ovr(m) + " • FOCUS " + esc((C.mateFocus || FOCUS[m.role][0]).toUpperCase()) + "</div>" : "") +
      "<div>" + esc(hosting ? VB.Coop.status() : "Not hosting — press 🤝 CO-OP to invite your friend again.") + "</div>" +
      (m && !(VB.Coop && VB.Coop.live()) ? "<div class='muted'>While P2 is offline, " + esc(m.name) + " plays as an AI teammate.</div>" : "") + "</div></div>";
  }
  async function startCoop() {
    if (!C.club) { await U.modal("CO-OP", "<p>Sign for a club first — your friend's player joins your club.</p>"); return; }
    VB.Coop.startHost({
      hostName: function () { return C ? you().name : "HOST"; },
      info: function () {
        return C && C.club ? { club: club().short, kit: club().kit, single: SINGLE.indexOf(you().role) >= 0 ? [you().role] : [], mate: C.players.mate ? C.players.mate.name : null } : {};
      },
      onJoin: coopJoin,
      onFocus: function (a) { if (C && C.players.mate && FOCUS[C.players.mate.role].indexOf(a) >= 0) { C.mateFocus = a; save(); render(); } },
      onConnect: function () { if (C) render(); }, onLost: function () { if (C && busyHub()) render(); },
      mate: function () { return C && C.players.mate; }, mst: function () { return (C.mst = C.mst || { sp: 0 }); },
      day: function () { return C.season + "-" + C.stage; }, news: function (t) { news(t, "you"); },
      save: function () { save(); }, render: function () { if (C && !busy) render(); }
    });
    await VB.Coop.invite();
  }
  function busyHub() { return !$("hub").classList.contains("hidden") && !busy; }
  function coopJoin(m) {
    if (!C || !C.club || C.mode === "coach") return { ok: false, msg: "The host isn't in a player career with a club right now." };
    if (C.players.mate) {                                             // the same friend coming back (or a new name for the same slot)
      var old = C.players.mate;
      if (!m.rejoin && m.name) { old.name = m.name.toUpperCase().slice(0, 12); if (m.face) old.face = m.face; }
      Object.keys(C.clubs).forEach(function (id) { var r = C.clubs[id].roster, i = r.indexOf("mate"); if (i >= 0 && id !== C.club) r.splice(i, 1); });
      var fi = C.free.indexOf("mate"); if (fi >= 0) C.free.splice(fi, 1);
      if (club().roster.indexOf("mate") < 0) { old.club = C.club; club().roster.push("mate"); }
      news("🤝 " + old.name + " is back online — co-op on!", "you"); save(); render();
      return { ok: true, msg: "Welcome back" };
    }
    if (!m.fam || !FOCUS[m.fam]) return { ok: false, msg: "Pick a position." };
    if (m.fam === you().role && SINGLE.indexOf(m.fam) >= 0) return { ok: false, msg: "The host already plays " + VB.FAMILY_NAMES[m.fam] + " — pick another position." };
    var p = VB.makePlayer({ id: "mate", name: (m.name || "P2").toUpperCase().slice(0, 12), nat: you().nat, role: m.fam, base: ovr(you()), age: you().age, face: m.face });
    p.pot = Math.max(p.pot, you().pot);
    C.taken[p.name] = 1; C.mateFocus = FOCUS[m.fam][0];
    addPlayer(p, C.club);
    news("🤝 " + p.name + " joins " + club().short + " as your co-op partner (" + VB.FAMILY_NAMES[m.fam] + ").", "you");
    save(); render();
    return { ok: true, msg: "Joined" };
  }
  // in co-op both of you always start: slot the humans into their positions
  var FAM_SLOTS = { S: ["S"], OH: ["OH1", "OH2"], MB: ["MB1", "MB2"], OP: ["OP"], L: ["L"] };
  function forceIn(line, p) {
    if (!p || keyOf(line, p.id)) return;
    var slot = FAM_SLOTS[p.role].find(function (r) { return !line[r] || (line[r].id !== "you" && line[r].id !== "mate"); });
    if (slot) line[slot] = p;
  }
  function mateGrow(p, rating) {
    var ageF = p.age < 23 ? 1.4 : p.age < 27 ? 1 : p.age < 31 ? 0.5 : 0.15, room = clamp((p.pot - ovr(p)) / 10, 0, 1.2);
    var amt = Math.max(0, rating - 6) * 0.11 * ageF * (0.2 + room * 0.8), gains = {};
    C.mprog = C.mprog || {};
    FOCUS[p.role].forEach(function (a) {
      if (a === "vert") return;
      var w = (a === C.mateFocus ? 1.8 : 1) * clamp((99 - p[a]) / 40, 0.15, 1);
      C.mprog[a] = (C.mprog[a] || 0) + amt * w * rnd(0.5, 1.2);
      while (C.mprog[a] >= 1) { C.mprog[a] -= 1; if (p[a] < 99) { p[a]++; gains[a] = (gains[a] || 0) + 1; } }
    });
    return gains;
  }

  // ================== HUB UI ==================
  function formBar(f) {
    var n = Math.round((f + 3) / 6 * 6);
    return "<span class='form " + (f > 0.5 ? "good" : f < -0.5 ? "bad" : "") + "'>" + "▰▰▰▰▰▰".slice(0, n) + "▱▱▱▱▱▱".slice(0, 6 - n) + "</span>";
  }
  function nextFixture() {
    var st = CAL[C.stage];
    if (!C.club || st[0] !== "R") return null;
    var L = lg(club().league), m = (L.rounds[+st.slice(1) - 1] || []).find(function (x) { return x[0] === C.club || x[1] === C.club; });
    return m ? { home: m[0] === C.club, foe: club(m[0] === C.club ? m[1] : m[0]) } : null;
  }
  function actionLabel() {
    var st = CAL[C.stage];
    if (st.indexOf("window") === 0) return "OPEN " + CAL_TXT[st];
    if (st[0] === "R") {
      var nf = nextFixture();
      if (!nf) return "SIM ROUND " + st.slice(1) + " (FREE AGENT)";
      return "PLAY ROUND " + st.slice(1) + " vs " + nf.foe.short + (nf.home ? " (HOME)" : " (AWAY)");
    }
    if (st === "SF") return "PLAYOFF SEMIFINALS";
    if (st === "F") return "PLAYOFF FINAL";
    if (st === "CWC") return "CLUB WORLD CUP";
    if (st === "VNL") return C.mode === "coach" ? "SUMMER BREAK" : "SUMMER: NATIONAL TEAM (VNL)";
    return "SEASON REVIEW & AWARDS";
  }
  function tableHTML(L) {
    return "<table class='standings'><tr><th>" + L.flag + " " + esc(L.name) + "</th><th>W</th><th>L</th><th>+/-</th></tr>" + rank(L).map(function (id, i) {
      var t = L.table[id];
      return "<tr class='" + (id === C.club ? "you " : "") + (i < 4 ? "q" : "") + "'><td>" + VB.crestImg(club(id), 18, "tiny") + " " + esc(club(id).short) + "</td><td>" + t.w + "</td><td>" + t.l + "</td><td>" + (t.pf - t.pa) + "</td></tr>";
    }).join("") + "</table>";
  }
  function squadHTML() {
    if (!C.club) return "<p>You're a free agent.</p>";
    var cl = club(), line = lineupFor(cl, false), starters = {};
    VB.ROLES.forEach(function (r) { if (line[r]) starters[line[r].id] = r; });
    var rows = cl.roster.map(P).sort(function (a, b) { return a.role.localeCompare(b.role) || ovr(b) - ovr(a); }).map(function (p) {
      var rch = VB.reach(p);
      return "<tr class='" + (p.id === "you" ? "you" : "") + "'><td>" + flagOf(p.nat) + " " + esc(p.name) + (p.skill ? " <span class='star'>★</span>" : "") + (p.injured > 0 ? " 🚑" : "") + "</td><td>" + p.role +
        "</td><td>" + ovr(p) + "</td><td>" + p.age + "</td><td>" + p.height + "</td><td>" + rch.spike + "</td><td>" + (starters[p.id] ? "START" : "") + "</td>" +
        (C.mode === "coach" ? "<td>" + playerValue(p) + "k <button class='btn tiny' data-act='sell' data-arg='" + p.id + "'>SELL</button></td>" : "") + "</tr>";
    }).join("");
    return "<p class='muted'>" + esc(cl.story) + " <b>" + esc(cl.arc) + ".</b> Coach " + esc(cl.coach) + " • Budget " + cl.budget + "k • Payroll " + payroll(cl) + "k</p>" +
      "<table class='standings'><tr><th>PLAYER</th><th>POS</th><th>OVR</th><th>AGE</th><th>HT</th><th>REACH</th><th></th></tr>" + rows + "</table>";
  }
  function statsHTML() {
    var my = C.sstats.you || VB.Stats.newLine(), Lid = C.club ? club().league : "SL", agg = {}, info = {};
    Object.keys(C.sstats).forEach(function (pid) { var p = P(pid); if (p && p.club && club(p.club).league === Lid) { agg[pid] = C.sstats[pid]; info[pid] = infoFor(pid); } });
    var played = C.recent.filter(function (x) { return x !== null; });
    return "<p><b>YOUR SEASON:</b> " + esc(VB.Stats.lineText(my)) + " • MATCHES " + my.mp + " • AVG RATING " + (played.length ? (Math.round(mean(played) * 10) / 10) : "—") + "</p>" +
      "<p class='muted'>RECENT: " + (C.recent.slice(-6).map(function (x) { return x === null ? "BENCH" : x; }).join(" • ") || "—") + "</p>" +
      "<h3 class='mini'>" + esc(lg(Lid).name) + " LEADERS</h3>" + VB.Stats.leadersHTML(agg, info, 5, "you");
  }
  function trainingHTML() {
    return "<p>Pick a training focus. It grows twice as fast; your match rating decides how much you grow.</p><div class='focus'>" +
      FOCUS[you().role].map(function (a) {
        return "<button class='btn" + (C.focus === a ? " on" : "") + "' data-act='focus' data-arg='" + a + "'>" + ATTR_TXT[a] + (a === "vert" ? " (" + C.vertGain + "/12)" : "") + "</button>";
      }).join("") + "</div>";
  }
  function developHTML() {
    var ar = ARCH[C.arch];
    var attrs = VB.ATTRS.concat(you().role === "L" ? [] : ["vert"]);
    var drillOk = C.drillAt !== C.season + "-" + C.stage && !(C.injured > 0);
    return "<div class='dev-top'><div><b>LEVEL " + C.lvl + "</b> • XP " + C.xp + "/" + xpNeed() + "<div class='xpbar'><i style='width:" + Math.round(C.xp / xpNeed() * 100) + "%'></i></div></div>" +
        "<div><b>" + C.sp + "</b> SKILL POINTS</div><div>ARCHETYPE: <b>" + (ar ? ar.name : "—") + "</b></div><div>MANAGER RATING: <b>" + Math.round(C.mgr) + "</b></div></div>" + psHTML() +
      "<h3 class='mini'>SPEND SKILL POINTS</h3><div class='focus'>" + attrs.map(function (a) {
        var v = a === "vert" ? you().vert + "cm" : you()[a], c2 = spCost(a), off = C.sp < c2 || (a === "vert" && C.vertGain >= 12) || (a !== "vert" && you()[a] >= 99);
        return "<button class='btn' data-act='spend' data-arg='" + a + "'" + (off ? " disabled" : "") + ">" + ATTR_TXT[a] + " " + v + " +1 (" + c2 + " SP)</button>";
      }).join("") + "</div><p class='muted small'>XP comes from every match (rating × 9, +12 for a win) and training drills. Higher attributes cost more.</p>" +
      "<h3 class='mini'>TRAINING SESSION</h3><p>One drill per week: stop the marker in the zone to train your focus (" + ATTR_TXT[C.focus] + ").</p>" +
      "<div class='hub-actions'><button class='btn big' data-act='drill'" + (drillOk ? "" : " disabled") + ">" + (drillOk ? "START DRILL" : "DONE THIS WEEK") + "</button></div>" +
      "<h3 class='mini'>MANAGER OBJECTIVES — SEASON " + C.season + "</h3><ul class='newslist'>" + (C.obj || []).map(function (o) {
        var ok = objDone(o);
        return "<li class='" + (ok ? "you" : "") + "'>" + (ok ? "✅ " : "⬜ ") + esc(o.text) + " — " + objProgress(o) + " / " + o.target + "</li>";
      }).join("") + "</ul><p class='muted small'>Hit objectives to raise your manager rating (more starts), salary and coins.</p>";
  }
  function careerHTML() {
    var rows = C.history.map(function (h) {
      return "<tr><td>S" + h.season + "</td><td>" + esc(h.club) + "</td><td>" + h.mp + "</td><td>" + h.pts + "</td><td>" + h.eff + "</td><td>" + h.blk + "</td><td>" + h.dig + "</td><td>" + h.avg + "</td><td>" + h.ovr + "</td></tr>";
    }).join("") || "<tr><td colspan='9'>Your first season is underway.</td></tr>";
    return "<table class='standings'><tr><th>SEASON</th><th>CLUB</th><th>MP</th><th>PTS</th><th>EFF</th><th>BLK</th><th>DIG</th><th>AVG</th><th>OVR</th></tr>" + rows + "</table>" +
      "<h3 class='mini'>TROPHY CABINET</h3>" + U.cabinet(C.trophies, "🏆") +
      "<h3 class='mini'>INDIVIDUAL AWARDS</h3>" + U.cabinet(C.awardsWon, "🏅") +
      (C.coachTrophies && C.coachTrophies.length ? "<h3 class='mini'>AS A COACH</h3>" + U.cabinet(C.coachTrophies, "📋") : "");
  }

  function render() {
    var me = you(), cl = C.club ? club() : null, rch = VB.reach(me), st = CAL[C.stage];
    if (sideBySide() && C.mode !== "coach") VB.Coop.sbSet(sbState());
    var stageTxt = CAL_TXT[st] || ("ROUND " + st.slice(1) + " / " + (C.club ? lg(club().league).rounds.length : 9));
    var nf = nextFixture(), starter = cl && st[0] === "R" ? isLikelyStarter() : null;
    var tabs = C.mode === "coach" ? ["news", "table", "squad", "market", "stats", "career"] : ["news", "table", "squad", "stats", "develop", "training", "career"];
    var body = tab === "news" ? "<ul class='newslist'>" + C.news.slice(0, 30).map(function (n) {
                 return "<li class='" + n.tag + "'><span class='muted'>S" + n.s + "</span> " + esc(n.t) + "</li>"; }).join("") + "</ul>"
             : tab === "table" ? "<div class='leaders'>" + leagueOrder().map(function (id) { return tableHTML(lg(id)); }).join("") + "</div>"
             : tab === "squad" ? squadHTML() : tab === "market" && C.mode === "coach" ? marketHTML() : tab === "stats" ? statsHTML() : tab === "develop" ? developHTML() : tab === "training" ? trainingHTML() : careerHTML();
    $("hub").innerHTML =
      "<div class='hub-top'>" +
        "<div class='card me-card'><img class='pix big' src='" + VB.Engine.spriteURL(me.face, cl ? cl.kit : "#888888") + "' alt=''/>" +
          (C.mode === "coach" ? "<div><div class='pname'>📋 COACH " + esc(me.name) + "</div><div class='muted'>AGE " + me.age + " • " + flagOf(me.nat) + " • former " + VB.FAMILY_NAMES[me.role].toLowerCase() + "</div>" +
            "<div class='ovr'>RECORD " + C.coachRec.w + "W-" + C.coachRec.l + "L</div><div>BOARD CONFIDENCE " + Math.round(C.board) + " • TARGET: TOP " + C.target + "</div>" +
            "<div class='muted'>TRANSFER BUDGET " + C.tb + "k" + (cl ? " • PAYROLL " + payroll(cl) + "k / " + cl.budget + "k" : "") + "</div></div></div>" +
            "<div class='card club-card' style='border-color:" + (cl ? cl.kit : "#9cc4ea") + "'>" + (cl ? "<div class='pname'>" + esc(cl.name) + "</div><div class='muted'>" + esc(lg(cl.league).flag + " " + lg(cl.league).name) + " • PRESTIGE " + cl.prestige + "</div><div><i>" + esc(cl.story) + "</i></div>" : "") + "<!--" : "") +
          "<div><div class='pname'>" + esc(me.name) + "</div>" +
          "<div class='muted'>" + VB.FAMILY_NAMES[me.role] + " • AGE " + me.age + " • " + flagOf(me.nat) + "</div>" +
          "<div class='ovr'>OVR " + ovr(me) + " <span class='muted'>POT ~" + Math.round(me.pot / 5) * 5 + "</span></div>" +
          "<div class='muted'>LV " + C.lvl + " • " + C.sp + " SP • " + (ARCH[C.arch] ? ARCH[C.arch].name : "") + " • MANAGER " + Math.round(C.mgr) + "</div>" +
          "<div class='muted'>HT " + me.height + "cm • VERT " + me.vert + "cm • REACH " + rch.spike + "/" + rch.block + "</div>" +
          "<div>FORM " + formBar(C.form) + (C.injured > 0 ? " 🚑 INJURED" : "") + (me.skill ? " <span class='star'>★ " + VB.SKILL_TXT[me.skill] + "</span>" : "") + "</div>" +
          "<div class='muted'>" + VB.ATTRS.map(function (a) { return a.toUpperCase() + " " + me[a]; }).join(" • ") + "</div>" +
          (VB.psText(me) ? "<div class='ps-line'>" + esc(VB.psText(me)) + "</div>" : "") + "</div></div>" +
        "<div class='card club-card' style='border-color:" + (cl ? cl.kit : "#9cc4ea") + "'>" +
          (cl ? VB.crestImg(cl, 56, "club") + "<div class='pname'>" + esc(cl.name) + "</div><div class='muted'>" + esc(lg(cl.league).flag + " " + lg(cl.league).name) + " • COACH " + esc(cl.coach) + "</div>" +
                "<div><b>" + esc(cl.arc) + "</b></div><div class='muted'><i>" + esc(cl.story) + "</i></div>" +
                "<div class='muted'>CONTRACT " + me.salary + "k • " + Math.max(0, me.years) + " YR LEFT</div>"
              : "<div class='pname'>FREE AGENT</div><div class='muted'>No club. Offers come in the transfer windows.</div>") +
        (C.mode === "coach" ? "-->" : "") + "</div>" +
      "</div>" +
      coopCard() +
      "<div class='hub-status'>CAREER SLOT " + C.slot + " • SEASON " + C.season + " • " + stageTxt +
        (nf ? " • NEXT: " + esc(nf.foe.short) + (nf.home ? " (H)" : " (A)") + " • " + (starter ? "LIKELY STARTER" : "FIGHTING FOR A SPOT") : "") + "</div>" +
      "<div class='hub-actions'><button class='btn big' data-act='advance'>" + esc(sideBySide() && VB.Coop.sbWaiting() ? (VB.Coop.sbGap() > 0 ? "⏸ WAITING — " + ((VB.Coop.partner() || {}).name || "YOUR FRIEND") + " IS CATCHING UP…" : "⏳ WAITING FOR " + ((VB.Coop.partner() || {}).name || "YOUR FRIEND") + "…") : actionLabel()) + "</button>" +
        "<button class='btn' data-act='look'>CHANGE LOOK</button><button class='btn' data-act='cam'>🎥 CAMERA: " + esc(VB.CAMS[localStorage.getItem("retroVB.cam") || "classic"] || "CLASSIC") + "</button>" +
        (C.mode === "coach" || sideBySide() ? "" : "<button class='btn' data-act='coop'>🤝 CO-OP</button>") +
        "<button class='btn pink' data-act='menu'>SAVE &amp; MENU</button></div>" +
      "<div class='tabs'>" + tabs.map(function (t) { return "<button class='tab-btn" + (t === tab ? " on" : "") + "' data-act='tab' data-arg='" + t + "'>" + t.toUpperCase() + "</button>"; }).join("") + "</div>" +
      "<div class='tab-body'>" + body + "</div>";
  }

  // ================== SLOTS & NEW CAREER ==================
  function openSlot(n) { C = load(n); Object.keys(C.players).forEach(function (id) { VB.fillAttrs(C.players[id]); }); ensureLeagues(); save(); tab = "news"; sbHook(); return render(); }
  function renderSlots() {
    var html = "<h2 class='hub-h'>PLAYER CAREER</h2><p class='center muted'>🇮🇹 🇯🇵 🇵🇱 🇹🇷 🇧🇷 🇫🇷 🇩🇪 🇰🇷 — 8 leagues • one player • archetypes, skill points, manager objectives</p><div class='slots'>";
    for (var s = 1; s <= SLOTS; s++) {
      var c = load(s);
      if (c) {
        var p = c.players.you, cl = c.club ? c.clubs[c.club] : null, img = "";
        try { img = VB.Engine.spriteURL(p.face, cl ? cl.kit : "#888888", cl ? cl.kit2 : null, cl ? VB.Engine.kitPattern(cl.id) : null); } catch (e) {}
        html += U.slotCard({ img: img, title: "SLOT " + s + ": " + esc(p.name),
          sub: (c.mode === "coach" ? "HEAD COACH" : VB.FAMILY_NAMES[p.role] + " • OVR " + VB.ovr(p) + " • AGE " + (p.age || "—")) + " • SEASON " + c.season + " • " + esc(cl ? cl.name : "FREE AGENT"),
          chips: ["🏆 " + ((c.trophies || []).length + (c.coachTrophies || []).length) + " TITLES", "🏅 " + (c.awardsWon || []).length + " AWARDS", "🌍 " + (c.caps || 0) + " CAPS",
                  "📅 " + (c.history || []).length + " SEASONS DONE", "🕒 " + U.ago(c.saved)],
          btns: "<button class='btn' data-act='load' data-arg='" + s + "'>CONTINUE</button> <button class='btn pink' data-act='del' data-arg='" + s + "'>DELETE</button>" });
      } else {
        html += U.slotCard({ title: "SLOT " + s, sub: "Empty — start a new pro career", btns: "<button class='btn' data-act='new' data-arg='" + s + "'>NEW CAREER</button>" });
      }
    }
    html += "</div><div class='hub-actions'><button class='btn pink' data-act='exit'>BACK TO MENU</button></div>";
    $("hub").innerHTML = html;
  }
  var setup = null;
  function renderNew() {
    var nats = Object.keys(VB.FLAGS);
    $("hub").innerHTML = "<h2 class='hub-h'>NEW CAREER — SLOT " + setup.slot + "</h2>" +
      "<div class='newcareer'>" +
        "<label>NAME <input id='cName' class='text-in' maxlength='12' value='" + esc(setup.name) + "'/></label>" +
        "<label>NATIONALITY <select id='cNat' class='text-in'>" + nats.map(function (n) { return "<option value='" + n + "'" + (n === setup.nat ? " selected" : "") + ">" + VB.FLAGS[n] + " " + n + "</option>"; }).join("") + "</select></label>" +
        "<div>POSITION</div><div class='focus'>" + ["S", "OH", "MB", "OP", "L"].map(function (f) {
          return "<button class='btn" + (setup.role === f ? " on" : "") + "' data-act='setRole' data-arg='" + f + "'>" + VB.FAMILY_NAMES[f] + "</button>"; }).join("") + "</div>" +
        "<div>HEIGHT</div><div class='focus'><button class='btn' data-act='hgt' data-arg='-2'>− 2cm</button><b class='hgt-val'>" + setup.height + " cm</b>" +
          "<button class='btn' data-act='hgt' data-arg='2'>+ 2cm</button><span class='muted'> " + VB.HEIGHT[setup.role][0] + "-" + VB.HEIGHT[setup.role][1] + " typical • taller: more reach & block, less jump & speed</span></div>" +
        "<div>BODY</div><div class='focus'>" + [["tower", "POWER FRAME — less jump"], ["balanced", "BALANCED"], ["jumper", "SPRING LEGS — more jump"]].map(function (b) {
          return "<button class='btn" + (setup.build === b[0] ? " on" : "") + "' data-act='setBuild' data-arg='" + b[0] + "'>" + b[1] + "</button>"; }).join("") + "</div>" +
        "<div>ARCHETYPE</div><div class='focus'>" + archsFor(setup.role).map(function (k) {
          return "<button class='btn" + (setup.arch === k ? " on" : "") + "' data-act='setArch' data-arg='" + k + "'>" + ARCH[k].name + "</button>"; }).join("") + "</div>" +
        (function (A) {
          var plus = Object.keys(A.boost).map(function (a) { return "+" + A.boost[a] + " " + ATTR_TXT[a]; }).concat(A.vert ? ["+" + A.vert + "cm JUMP"] : [], A.height ? ["+" + A.height + "cm HEIGHT"] : []);
          var minus = Object.keys(A.minus || {}).map(function (a) { return A.minus[a] + " " + ATTR_TXT[a]; });
          return "<div class='arch-card'><b>" + esc(A.name) + "</b> — " + esc(A.desc) + "<br/><span class='gain'>" + esc(plus.join(" • ")) + "</span>" +
            (minus.length ? " <span class='bad'>" + esc(minus.join(" • ")) + "</span>" : "") + "<br/><span class='muted'>Grows faster: " + A.grow.map(function (a) { return ATTR_TXT[a]; }).join(", ") + "</span></div>";
        })(ARCH[setup.arch]) +
        "<p class='muted'>Next: your ACADEMY YEARS (ages 14-18) — five choices that shape your pathway before you turn pro.</p>" +
      "</div><div class='hub-actions'><button class='btn big' data-act='create'>START CAREER</button><button class='btn pink' data-act='slots'>BACK</button></div>";
  }

  async function onHubClick(e) {
    var b = e.target.closest("[data-act]");
    if (!b || busy) return;
    var act = b.getAttribute("data-act"), arg = b.getAttribute("data-arg");
    if (act === "advance") return advance();
    if (act === "mfilter") { C.mfilter = arg; return render(); }
    if (act === "buy" && C.mode === "coach") {
      var q = P(arg), cl0 = club(), fee = q.club ? playerValue(q) : 0;
      if (fee > C.tb || cl0.roster.length >= 15) return;
      var ok = await U.modal("SIGN " + q.name + "?", "<p>" + esc(q.name) + " (" + q.role + ", OVR " + ovr(q) + ", age " + q.age + ") from " + esc(q.club ? club(q.club).short : "free agency") + ".</p><p>Fee " + fee + "k • wage " + salaryFor(q) + "k</p>",
        [{ label: "SIGN", value: true }, { label: "CANCEL", value: false, cls: "pink" }]);
      if (!ok) return;
      C.tb -= fee; q.salary = salaryFor(q); q.years = irnd(2, 3);
      if (q.club) moveTo(arg, cl0.id); else { C.free = C.free.filter(function (x) { return x !== arg; }); q.club = cl0.id; cl0.roster.push(arg); }
      news("✍️ " + cl0.short + " sign " + q.name + " (OVR " + ovr(q) + ") for " + fee + "k.", "transfer");
      save(); return render();
    }
    if (act === "sell" && C.mode === "coach") {
      var sp = P(arg), cl1 = club(), fam = sp.role, need = { S: 1, OH: 2, MB: 2, OP: 1, L: 1 }[fam];
      if (famCount(cl1, fam) <= need) { await U.modal("CAN'T SELL", "<p>You need at least " + need + " " + VB.FAMILY_NAMES[fam].toLowerCase() + (need > 1 ? "s" : "") + " in the squad.</p>"); return; }
      var price = Math.round(playerValue(sp) * 0.85);
      var ok2 = await U.modal("SELL " + sp.name + "?", "<p>Sell for " + price + "k?</p>", [{ label: "SELL", value: true }, { label: "KEEP", value: false, cls: "pink" }]);
      if (!ok2) return;
      var buyers = Object.keys(C.clubs).filter(function (id) { return id !== cl1.id && club(id).roster.length < 14; });
      if (buyers.length) moveTo(arg, pick(buyers)); else release(arg);
      C.tb += price;
      news("💰 " + cl1.short + " sell " + sp.name + " to " + (sp.club ? club(sp.club).short : "free agency") + " for " + price + "k.", "transfer");
      save(); return render();
    }
    if (act === "tab") { tab = arg; return render(); }
    if (act === "focus") { C.focus = arg; save(); return render(); }
    if (act === "look") {
      var kc = C.club ? club() : null;
      busy = true; await VB.editLook(you().face, kc ? kc.kit : "#888888", kc ? kc.kit2 : null, kc ? VB.Engine.kitPattern(kc.id) : null); busy = false;
      save(); return render();
    }
    if (act === "coop") { busy = true; try { await startCoop(); } finally { busy = false; } return render(); }
    if (act === "coopInvite") { await VB.Coop.invite(); return render(); }
    if (act === "sbWatch") { VB.Coop.sbWatch(true); return; }
    if (act === "sbChat") { VB.Coop.openChat(); return; }
    if (act === "coopLeave") { VB.Coop.leave(); return render(); }
    if (act === "cam") { var ck = Object.keys(VB.CAMS), cur = localStorage.getItem("retroVB.cam") || "classic"; VB.Engine.setCam(ck[(ck.indexOf(cur) + 1) % ck.length]); return render(); }
    if (act === "menu" || act === "exit") { if (C) save(); C = null; $("hub").onclick = null; var r = exitCareer; exitCareer = null; return r && r(); }
    if (act === "load") return openSlot(+arg);
    if (act === "del") {
      var ok = await U.modal("DELETE CAREER?", "<p>Slot " + arg + " will be erased for good.</p>", [{ label: "DELETE", value: true, cls: "pink" }, { label: "KEEP IT", value: false }]);
      if (ok) localStorage.removeItem(SLOT_KEY + arg);
      return renderSlots();
    }
    if (act === "slots") return renderSlots();
    if (act === "new") { setup = { slot: +arg, name: "NEW KID", nat: "ITA", role: "OH", build: "balanced", arch: "allround", height: 196 }; return renderNew(); }
    if (act === "hgt") {
      setup.name = ($("cName").value || "NEW KID").toUpperCase().slice(0, 12); setup.nat = $("cNat").value;
      var hr = VB.HEIGHT[setup.role]; setup.height = clamp(setup.height + (+arg), hr[0] - 10, hr[1] + 8); return renderNew();
    }
    if (act === "setArch") { setup.name = ($("cName").value || "NEW KID").toUpperCase().slice(0, 12); setup.nat = $("cNat").value; setup.arch = arg; return renderNew(); }
    if (act === "spend") {
      var cost = spCost(arg);
      if (C.sp < cost) return;
      C.sp -= cost;
      if (arg === "vert") { you().vert++; C.vertGain++; } else you()[arg] = Math.min(99, you()[arg] + 1);
      save(); return render();
    }
    if (act === "psUnlock" || act === "psUp") {
      var pp = you(), cost2 = act === "psUnlock" ? 2 : 3; pp.ps = pp.ps || {};
      if (C.sp < cost2 || (act === "psUnlock" && Object.keys(pp.ps).length >= psSlots()) || !VB.PS[arg]) return;
      C.sp -= cost2; pp.ps[arg] = act === "psUnlock" ? 1 : 2;
      news("🎓 New PlayStyle: " + VB.PS[arg].icon + " " + VB.PS[arg].name + (pp.ps[arg] > 1 ? "+" : "") + ".", "you");
      save(); return render();
    }
    if (act === "skillChange") { if (C.sp < 4) return; C.sp -= 4; busy = true; try { await chooseSkill(true); } finally { busy = false; } return render(); }
    if (act === "skillPick") { busy = true; try { await chooseSkill(); } finally { busy = false; } return render(); }
    if (act === "drill") {
      busy = true;
      var lvl = C.focus === "vert" ? 75 : you()[C.focus];
      var q = await VB.drillBar("TRAINING — " + ATTR_TXT[C.focus], "The coaches are watching. Hit the zone!", { goodW: clamp(0.2 + (lvl - 65) / 300, 0.16, 0.32), speed: 1400 - (lvl - 65) * 4 });
      C.drillAt = C.season + "-" + C.stage;
      C.prog[C.focus] = (C.prog[C.focus] || 0) + q * 1.4;
      var gained = 0;
      while (C.prog[C.focus] >= 1) { C.prog[C.focus] -= 1; if (C.focus === "vert") { if (C.vertGain >= 12) break; you().vert++; C.vertGain++; } else you()[C.focus] = Math.min(99, you()[C.focus] + 1); gained++; }
      var lv = gainXP(10 + q * 30);
      C.mgr = clamp(C.mgr + q * 2 - (q < 0.25 ? 1 : 0), 0, 100);
      busy = false; save(); render();
      await U.modal("TRAINING SESSION", "<p class='center big'>" + (q >= 1 ? "PERFECT!" : q >= 0.5 ? "GOOD" : q > 0 ? "OFF" : "MISSED") + "</p><p class='center'>+" + Math.round(10 + q * 30) + " XP" +
        (gained ? " • <span class='gain'>+" + gained + " " + ATTR_TXT[C.focus] + "</span>" : "") + (lv ? " • LEVEL UP!" : "") + "</p>");
      return render();
    }
    if (act === "setRole" || act === "setBuild") {
      setup.name = ($("cName").value || "NEW KID").toUpperCase().slice(0, 12); setup.nat = $("cNat").value;
      if (act === "setRole") {
        setup.role = arg; setup.arch = archsFor(arg)[0];
        var hr2 = VB.HEIGHT[arg]; setup.height = Math.round((hr2[0] + hr2[1]) / 2);
      } else setup.build = arg;
      return renderNew();
    }
    if (act === "create") {
      setup.name = ($("cName").value || "NEW KID").toUpperCase().slice(0, 12); setup.nat = $("cNat").value;
      busy = true;
      await academy(setup);
      createWorld(setup.slot, setup);
      var pool = Object.keys(C.clubs).sort(function (a, b) { return club(a).prestige - club(b).prestige; });
      var pref = setup.prefLeague ? pool.filter(function (id) { return club(id).league === setup.prefLeague; }) : [];
      var first = pref.length ? pref.slice(0, setup.offerTier === "high" ? 6 : 4).slice(setup.offerTier === "high" ? 2 : 0).concat(pool.slice(0, 3)) : pool.slice(0, 5);
      var offers = [offerFrom(club(first[0]), "STARTER")].concat(shuffle(first.slice(1)).slice(0, 2).map(function (id) { return offerFrom(club(id), "ROTATION"); }));
      var i = await U.modal("YOUR FIRST CONTRACT", "<p>Three clubs are ready to give you a chance. Choose where your career begins.</p>" + offersHTML(offers),
        offers.map(function (o, k) { return { label: "SIGN WITH " + club(o.club).short, value: k }; }));
      join(offers[i]);
      busy = false;
      save(); tab = "news"; render();
    }
  }

  VB.Career = {
    start: function (slot) {
      return new Promise(function (res) {
        exitCareer = res; sbHook();
        U.showView("hub");
        $("hub").onclick = onHubClick;
        if (slot && load(slot)) openSlot(slot); else renderSlots();
      });
    }
  };
})(window.VB);
