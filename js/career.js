// Club career: one player, SuperLega + SV.League, transfer windows, coaches, budgets and stories.
(function (VB) {
  "use strict";
  var U = VB.ui, $ = U.$, esc = U.esc;
  var rnd = VB.rnd, irnd = VB.irnd, clamp = VB.clamp, pick = VB.pick, shuffle = VB.shuffle;

  var SLOT_KEY = "vnlCareer.slot", SLOTS = 3;
  var COMP = { S: 2, OH: 4, MB: 3, OP: 2, L: 1 };                       // a 12-player squad
  var CAL = ["window-pre", "R1", "R2", "R3", "window-mid", "R4", "R5", "R6", "R7", "SF", "F", "end"];
  var CAL_TXT = { "window-pre": "PRE-SEASON TRANSFER WINDOW", "window-mid": "MID-SEASON TRANSFER WINDOW", SF: "PLAYOFF SEMIFINALS", F: "PLAYOFF FINAL", end: "SEASON REVIEW" };
  var FOCUS = { S: ["set", "def", "srv", "blk", "tec", "men", "vert"], OH: ["att", "rec", "def", "srv", "blk", "tec", "men", "vert"], MB: ["blk", "att", "srv", "tec", "men", "vert"],
                OP: ["att", "srv", "blk", "def", "tec", "men", "vert"], L: ["rec", "def", "set", "tec", "men"] };
  var ATTR_TXT = { srv: "SERVE", rec: "RECEIVE", set: "SET", att: "ATTACK", blk: "BLOCK", def: "DEFENCE", vert: "VERTICAL", men: "MENTAL", tec: "TECHNIQUE" };

  var C = null, exitCareer = null, busy = false, tab = "news";
  // season storylines fit the club's stature
  function arcFor(prestige) {
    return prestige >= 82 ? pick(["TITLE FAVOURITES", "TITLE FAVOURITES", "UNDER PRESSURE", "NEW COACH, NEW IDEAS"])
         : prestige >= 78 ? pick(["DARK HORSES", "UNDER PRESSURE", "NEW COACH, NEW IDEAS", "REBUILDING WITH YOUTH"])
         : pick(["REBUILDING WITH YOUTH", "DARK HORSES", "FINANCIAL TROUBLE", "NEW COACH, NEW IDEAS"]);
  }

  // ================== PERSISTENCE ==================
  function save() { try { localStorage.setItem(SLOT_KEY + C.slot, JSON.stringify(C)); } catch (e) { console.warn(e); } }
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
    VB.CLUBS.forEach(function (seed) { if (!C.clubs[seed.id]) { buildClub(seed); if (added.indexOf(seed.league) < 0) added.push(seed.league); } });
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
  var ARCH = {
    power:    { name: "POWERHOUSE", desc: "Big swings and big serves.", boost: { att: 4, srv: 2 }, vert: 3, grow: ["att", "srv"] },
    wall:     { name: "THE WALL", desc: "Owns the net.", boost: { blk: 5, att: 1 }, height: 2, grow: ["blk"] },
    maestro:  { name: "MAESTRO", desc: "Hands like silk, sees everything.", boost: { set: 4, def: 2 }, grow: ["set", "def"] },
    guardian: { name: "GUARDIAN", desc: "Nothing hits the floor.", boost: { rec: 4, def: 3 }, grow: ["rec", "def"] },
    bomber:   { name: "SERVE BOMBER", desc: "Every serve is a weapon.", boost: { srv: 6 }, grow: ["srv"] }
  };
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
    var height = b === "tower" ? h[1] + irnd(0, 4) : b === "jumper" ? h[0] + irnd(0, 3) : Math.round((h[0] + h[1]) / 2) + irnd(-2, 2);
    var vert = b === "tower" ? v[0] + irnd(0, 4) : b === "jumper" ? v[1] + irnd(2, 8) : Math.round((v[0] + v[1]) / 2) + irnd(-2, 2);
    var me = VB.makePlayer({ id: "you", name: setup.name, nat: setup.nat, role: fam, base: 64, age: 19, height: height, vert: vert });
    if (b === "jumper") me.def = clamp(me.def + 3, 25, 99);
    if (b === "tower") me.blk = clamp(me.blk + 3, 25, 99);
    me.pot = irnd(84, 93);
    me.build = b;
    var ar = ARCH[setup.arch] || ARCH.power;
    Object.keys(ar.boost).forEach(function (a) { me[a] = clamp(me[a] + ar.boost[a], 25, 99); });
    if (ar.vert) me.vert += ar.vert;
    if (ar.height) me.height += ar.height;
    C.arch = setup.arch || "power"; C.mgr = 50; C.lvl = 1; C.xp = 0; C.sp = 0;
    C.players.you = me;
    newObjectives();
    C.startVert = vert;
    news("A new career begins: " + setup.name + ", a 19-year-old " + VB.FAMILY_NAMES[fam].toLowerCase() + " from " + flagOf(setup.nat) + ".", "you");
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
    if (!C.club) return false;
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
      p.skill = VB.ROLE_SKILL[p.role];
      news("★ SIGNATURE MOVE UNLOCKED: " + p.name + " learns " + VB.SKILL_TXT[p.skill] + "!", "you");
      gains.skill = 1;
    }
    return gains;
  }

  async function userMatch(L, h, a, label) {
    var mineId = C.club, foeId = h === mineId ? a : h, homeSide = h === mineId ? 0 : 1;
    var myLine = lineupFor(club(mineId), true), foeLine = lineupFor(club(foeId), true);
    var myKey = keyOf(myLine, "you");
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
    var res = await VB.Engine.playMatch({ mine: mine, foe: foe, homeSide: homeSide, mode: "role", myRole: myKey,
                                          label: L.name + " • " + label, league: L.name });
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
    await U.modal(res.won ? "WIN" : "LOSS",
      "<p class='center big'>" + esc(mine.name + " " + res.score[0] + " : " + res.score[1] + " " + foe.name) + "</p>" +
      "<p class='center'>YOUR RATING: <b class='rating'>" + rating + "</b> / 10</p>" +
      "<p class='center'>" + esc(VB.Stats.lineText(line)) + "</p>" +
      (gtxt ? "<p class='center gain'>TRAINING GAINS: " + esc(gtxt) + "</p>" : "") +
      (after > before ? "<p class='center gain'>OVR " + before + " → " + after + "</p>" : "") +
      (gains.skill ? "<p class='center gain'>★ SIGNATURE MOVE UNLOCKED: " + esc(VB.SKILL_TXT[you().skill]) + "</p>" : "") +
      (flowed ? "<p class='center'>🔵🔥 You hit the FLOW STATE this match.</p>" : "") +
      "<p class='center'>+" + xpGot + " XP" + (lvUp ? " • <b class='gain'>LEVEL UP! +" + lvUp + " SKILL POINT</b>" : "") + " • MANAGER RATING " + Math.round(C.mgr) + "</p>",
      [{ label: "CONTINUE", value: 1 }]);
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
    var label = "ROUND " + (r + 1) + "/7";
    var ord = leagueOrder();
    for (var k = 0; k < ord.length; k++) {
      var L = lg(ord[k]);
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
    if (!cl) return;
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

  function infoFor(pid) {
    var p = P(pid), cl = p.club ? club(p.club) : null;
    return { name: p.name, fam: p.role, team: cl ? cl.short : "FREE AGENT", teamId: p.club, flag: flagOf(p.nat), kit: cl ? cl.kit : "#888888", face: p.face, you: pid === "you" };
  }

  async function seasonEnd() {
    var html = "", show = null;
    // manager objectives: the boss's verdict
    var objHtml = "";
    if (C.obj) {
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
    newObjectives();
    news("— SEASON " + C.season + " BEGINS — Objectives: " + C.obj.map(function (o) { return o.text; }).join(", ") + ".", "story");
  }

  // ================== ADVANCE ==================
  async function advance() {
    if (busy) return;
    busy = true;
    try {
      var st = CAL[C.stage];
      if (st.indexOf("window") === 0) await transferWindow(st === "window-pre");
      else if (st[0] === "R") await playRound(+st.slice(1) - 1);
      else if (st === "SF" || st === "F") await playoffs(st);
      if (st === "end") { await seasonEnd(); C.stage = 0; }
      else { C.stage++; if (CAL[C.stage] === "R1") C.season0 = false; }
      save();
    } finally {
      busy = false;
      U.showView("hub");
      render();
    }
  }

  // ================== HUB UI ==================
  function formBar(f) {
    var n = Math.round((f + 3) / 6 * 6);
    return "<span class='form " + (f > 0.5 ? "good" : f < -0.5 ? "bad" : "") + "'>" + "▰▰▰▰▰▰".slice(0, n) + "▱▱▱▱▱▱".slice(0, 6 - n) + "</span>";
  }
  function nextFixture() {
    var st = CAL[C.stage];
    if (!C.club || st[0] !== "R") return null;
    var L = lg(club().league), m = L.rounds[+st.slice(1) - 1].find(function (x) { return x[0] === C.club || x[1] === C.club; });
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
    return "SEASON REVIEW & AWARDS";
  }
  function tableHTML(L) {
    return "<table class='standings'><tr><th>" + L.flag + " " + esc(L.name) + "</th><th>W</th><th>L</th><th>+/-</th></tr>" + rank(L).map(function (id, i) {
      var t = L.table[id];
      return "<tr class='" + (id === C.club ? "you " : "") + (i < 4 ? "q" : "") + "'><td><span class='dot' style='background:" + club(id).kit + "'></span>" + esc(club(id).short) + "</td><td>" + t.w + "</td><td>" + t.l + "</td><td>" + (t.pf - t.pa) + "</td></tr>";
    }).join("") + "</table>";
  }
  function squadHTML() {
    if (!C.club) return "<p>You're a free agent.</p>";
    var cl = club(), line = lineupFor(cl, false), starters = {};
    VB.ROLES.forEach(function (r) { if (line[r]) starters[line[r].id] = r; });
    var rows = cl.roster.map(P).sort(function (a, b) { return a.role.localeCompare(b.role) || ovr(b) - ovr(a); }).map(function (p) {
      var rch = VB.reach(p);
      return "<tr class='" + (p.id === "you" ? "you" : "") + "'><td>" + flagOf(p.nat) + " " + esc(p.name) + (p.skill ? " <span class='star'>★</span>" : "") + (p.injured > 0 ? " 🚑" : "") + "</td><td>" + p.role +
        "</td><td>" + ovr(p) + "</td><td>" + p.age + "</td><td>" + p.height + "</td><td>" + rch.spike + "</td><td>" + (starters[p.id] ? "START" : "") + "</td></tr>";
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
        "<div><b>" + C.sp + "</b> SKILL POINTS</div><div>ARCHETYPE: <b>" + (ar ? ar.name : "—") + "</b></div><div>MANAGER RATING: <b>" + Math.round(C.mgr) + "</b></div></div>" +
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
      "<h3 class='mini'>TROPHIES</h3><p>" + (C.trophies.map(esc).join("<br/>") || "None yet.") + "</p>" +
      "<h3 class='mini'>INDIVIDUAL AWARDS</h3><p>" + (C.awardsWon.map(esc).join("<br/>") || "None yet.") + "</p>";
  }

  function render() {
    var me = you(), cl = C.club ? club() : null, rch = VB.reach(me), st = CAL[C.stage];
    var stageTxt = CAL_TXT[st] || ("ROUND " + st.slice(1) + " / 7");
    var nf = nextFixture(), starter = cl && st[0] === "R" ? isLikelyStarter() : null;
    var tabs = ["news", "table", "squad", "stats", "develop", "training", "career"];
    var body = tab === "news" ? "<ul class='newslist'>" + C.news.slice(0, 30).map(function (n) {
                 return "<li class='" + n.tag + "'><span class='muted'>S" + n.s + "</span> " + esc(n.t) + "</li>"; }).join("") + "</ul>"
             : tab === "table" ? "<div class='leaders'>" + leagueOrder().map(function (id) { return tableHTML(lg(id)); }).join("") + "</div>"
             : tab === "squad" ? squadHTML() : tab === "stats" ? statsHTML() : tab === "develop" ? developHTML() : tab === "training" ? trainingHTML() : careerHTML();
    $("hub").innerHTML =
      "<div class='hub-top'>" +
        "<div class='card me-card'><img class='pix big' src='" + VB.Engine.spriteURL(me.face, cl ? cl.kit : "#888888") + "' alt=''/>" +
          "<div><div class='pname'>" + esc(me.name) + "</div>" +
          "<div class='muted'>" + VB.FAMILY_NAMES[me.role] + " • AGE " + me.age + " • " + flagOf(me.nat) + "</div>" +
          "<div class='ovr'>OVR " + ovr(me) + " <span class='muted'>POT ~" + Math.round(me.pot / 5) * 5 + "</span></div>" +
          "<div class='muted'>LV " + C.lvl + " • " + C.sp + " SP • " + (ARCH[C.arch] ? ARCH[C.arch].name : "") + " • MANAGER " + Math.round(C.mgr) + "</div>" +
          "<div class='muted'>HT " + me.height + "cm • VERT " + me.vert + "cm • REACH " + rch.spike + "/" + rch.block + "</div>" +
          "<div>FORM " + formBar(C.form) + (C.injured > 0 ? " 🚑 INJURED" : "") + (me.skill ? " <span class='star'>★ " + VB.SKILL_TXT[me.skill] + "</span>" : "") + "</div>" +
          "<div class='muted'>" + VB.ATTRS.map(function (a) { return a.toUpperCase() + " " + me[a]; }).join(" • ") + "</div></div></div>" +
        "<div class='card club-card' style='border-color:" + (cl ? cl.kit : "#9cc4ea") + "'>" +
          (cl ? "<div class='pname'>" + esc(cl.name) + "</div><div class='muted'>" + esc(lg(cl.league).flag + " " + lg(cl.league).name) + " • COACH " + esc(cl.coach) + "</div>" +
                "<div><b>" + esc(cl.arc) + "</b></div><div class='muted'><i>" + esc(cl.story) + "</i></div>" +
                "<div class='muted'>CONTRACT " + me.salary + "k • " + Math.max(0, me.years) + " YR LEFT</div>"
              : "<div class='pname'>FREE AGENT</div><div class='muted'>No club. Offers come in the transfer windows.</div>") +
        "</div>" +
      "</div>" +
      "<div class='hub-status'>CAREER SLOT " + C.slot + " • SEASON " + C.season + " • " + stageTxt +
        (nf ? " • NEXT: " + esc(nf.foe.short) + (nf.home ? " (H)" : " (A)") + " • " + (starter ? "LIKELY STARTER" : "FIGHTING FOR A SPOT") : "") + "</div>" +
      "<div class='hub-actions'><button class='btn big' data-act='advance'>" + esc(actionLabel()) + "</button>" +
        "<button class='btn' data-act='look'>CHANGE LOOK</button><button class='btn pink' data-act='menu'>SAVE &amp; MENU</button></div>" +
      "<div class='tabs'>" + tabs.map(function (t) { return "<button class='tab-btn" + (t === tab ? " on" : "") + "' data-act='tab' data-arg='" + t + "'>" + t.toUpperCase() + "</button>"; }).join("") + "</div>" +
      "<div class='tab-body'>" + body + "</div>";
  }

  // ================== SLOTS & NEW CAREER ==================
  function renderSlots() {
    var html = "<h2 class='hub-h'>PLAYER CAREER</h2><p class='center muted'>🇮🇹 🇯🇵 🇵🇱 🇹🇷 🇧🇷 🇫🇷 🇩🇪 🇰🇷 — 8 leagues • one player • archetypes, skill points, manager objectives</p><div class='slots'>";
    for (var s = 1; s <= SLOTS; s++) {
      var c = load(s);
      if (c) {
        var p = c.players.you, cl = c.club ? c.clubs[c.club] : null;
        html += "<div class='card slot'><div class='pname'>SLOT " + s + ": " + esc(p.name) + "</div><div class='muted'>" + VB.FAMILY_NAMES[p.role] + " • OVR " + VB.ovr(p) +
          " • SEASON " + c.season + " • " + esc(cl ? cl.short : "FREE AGENT") + "</div>" +
          "<button class='btn' data-act='load' data-arg='" + s + "'>CONTINUE</button> <button class='btn pink' data-act='del' data-arg='" + s + "'>DELETE</button></div>";
      } else {
        html += "<div class='card slot'><div class='pname'>SLOT " + s + "</div><div class='muted'>Empty</div><button class='btn' data-act='new' data-arg='" + s + "'>NEW CAREER</button></div>";
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
        "<div>BUILD</div><div class='focus'>" + [["tower", "TOWER — tall, big block, lower jump"], ["balanced", "BALANCED"], ["jumper", "JUMPER — shorter, huge vertical"]].map(function (b) {
          return "<button class='btn" + (setup.build === b[0] ? " on" : "") + "' data-act='setBuild' data-arg='" + b[0] + "'>" + b[1] + "</button>"; }).join("") + "</div>" +
        "<div>ARCHETYPE</div><div class='focus'>" + Object.keys(ARCH).map(function (k) {
          return "<button class='btn" + (setup.arch === k ? " on" : "") + "' data-act='setArch' data-arg='" + k + "'>" + ARCH[k].name + "</button>"; }).join("") + "</div>" +
        "<p class='muted'>" + esc(ARCH[setup.arch].name + ": " + ARCH[setup.arch].desc) + " Boosts " + Object.keys(ARCH[setup.arch].boost).map(function (a) { return ATTR_TXT[a]; }).join(" & ") + " and grows them faster.</p>" +
        "<p class='muted'>You start at 19 with OVR ~66 and high potential. Clubs from the bottom of both leagues are willing to take a chance on you.</p>" +
      "</div><div class='hub-actions'><button class='btn big' data-act='create'>START CAREER</button><button class='btn pink' data-act='slots'>BACK</button></div>";
  }

  async function onHubClick(e) {
    var b = e.target.closest("[data-act]");
    if (!b || busy) return;
    var act = b.getAttribute("data-act"), arg = b.getAttribute("data-arg");
    if (act === "advance") return advance();
    if (act === "tab") { tab = arg; return render(); }
    if (act === "focus") { C.focus = arg; save(); return render(); }
    if (act === "look") {
      var kc = C.club ? club() : null;
      busy = true; await VB.editLook(you().face, kc ? kc.kit : "#888888", kc ? kc.kit2 : null, kc ? VB.Engine.kitPattern(kc.id) : null); busy = false;
      save(); return render();
    }
    if (act === "menu" || act === "exit") { if (C) save(); C = null; $("hub").onclick = null; var r = exitCareer; exitCareer = null; return r && r(); }
    if (act === "load") { C = load(+arg); Object.keys(C.players).forEach(function (id) { VB.fillAttrs(C.players[id]); }); ensureLeagues(); save(); tab = "news"; return render(); }
    if (act === "del") {
      var ok = await U.modal("DELETE CAREER?", "<p>Slot " + arg + " will be erased for good.</p>", [{ label: "DELETE", value: true, cls: "pink" }, { label: "KEEP IT", value: false }]);
      if (ok) localStorage.removeItem(SLOT_KEY + arg);
      return renderSlots();
    }
    if (act === "slots") return renderSlots();
    if (act === "new") { setup = { slot: +arg, name: "NEW KID", nat: "ITA", role: "OH", build: "balanced", arch: "power" }; return renderNew(); }
    if (act === "setArch") { setup.name = ($("cName").value || "NEW KID").toUpperCase().slice(0, 12); setup.nat = $("cNat").value; setup.arch = arg; return renderNew(); }
    if (act === "spend") {
      var cost = spCost(arg);
      if (C.sp < cost) return;
      C.sp -= cost;
      if (arg === "vert") { you().vert++; C.vertGain++; } else you()[arg] = Math.min(99, you()[arg] + 1);
      save(); return render();
    }
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
      if (act === "setRole") setup.role = arg; else setup.build = arg;
      return renderNew();
    }
    if (act === "create") {
      setup.name = ($("cName").value || "NEW KID").toUpperCase().slice(0, 12); setup.nat = $("cNat").value;
      busy = true;
      createWorld(setup.slot, setup);
      var first = Object.keys(C.clubs).sort(function (a, b) { return club(a).prestige - club(b).prestige; }).slice(0, 5);
      var offers = [offerFrom(club(first[0]), "STARTER")].concat(shuffle(first.slice(1)).slice(0, 2).map(function (id) { return offerFrom(club(id), "ROTATION"); }));
      var i = await U.modal("YOUR FIRST CONTRACT", "<p>Three clubs are ready to give you a chance. Choose where your career begins.</p>" + offersHTML(offers),
        offers.map(function (o, k) { return { label: "SIGN WITH " + club(o.club).short, value: k }; }));
      join(offers[i]);
      busy = false;
      save(); tab = "news"; render();
    }
  }

  VB.Career = {
    start: function () {
      return new Promise(function (res) {
        exitCareer = res;
        U.showView("hub");
        $("hub").onclick = onHubClick;
        renderSlots();
      });
    }
  };
})(window.VB);
