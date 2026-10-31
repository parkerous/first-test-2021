// Haikyuu!! Story Mode: join a high-school team as a first-year and grow over three years —
// practice matches, Golden Week, Interhigh, the Tokyo summer camp, Spring qualifiers and Spring Nationals.
(function (VB) {
  "use strict";
  var U = VB.ui, $ = U.$, esc = U.esc;
  var rnd = VB.rnd, irnd = VB.irnd, clamp = VB.clamp, pick = VB.pick, shuffle = VB.shuffle;

  var SLOT_KEY = "hqStory.slot", SLOTS = 3;
  var PH = ["april", "practice", "gw", "ih", "camp", "spring", "youth", "nationals", "end"];
  var PH_TXT = { april: "APRIL — NEW SCHOOL YEAR", practice: "PRACTICE MATCH", gw: "GOLDEN WEEK CAMP", ih: "INTERHIGH QUALIFIERS",
                 camp: "TOKYO SUMMER CAMP", spring: "SPRING QUALIFIERS", youth: "ALL-JAPAN YOUTH CAMP", nationals: "SPRING NATIONALS", end: "SEASON REVIEW" };
  var COMP = { S: 2, OH: 4, MB: 3, OP: 2, L: 2 };
  var FOCUS = { S: ["set", "def", "srv", "blk", "tec", "men", "spd"], OH: ["att", "rec", "def", "srv", "blk", "tec", "men", "spd"], MB: ["blk", "att", "srv", "tec", "men", "spd"],
                OP: ["att", "srv", "blk", "def", "tec", "men", "spd"], L: ["rec", "def", "set", "tec", "men", "spd"] };
  var ATTR_TXT = { srv: "SERVE", rec: "RECEIVE", set: "SET", att: "ATTACK", blk: "BLOCK", def: "DEFENCE", vert: "VERTICAL", men: "MENTAL", tec: "TECHNIQUE", spd: "SPEED" };

  // canon school year (as of the story's first spring)
  var HQ_YEARS = {
    KAGEYAMA: 1, HINATA: 1, TSUKISHIMA: 1, YAMAGUCHI: 1, NISHINOYA: 2, TANAKA: 2, ENNOSHITA: 2, SAWAMURA: 3, AZUMANE: 3, SUGAWARA: 3,
    OIKAWA: 3, IWAIZUMI: 3, HANAMAKI: 3, MATSUKAWA: 3, KINDAICHI: 1, KUNIMI: 1, KYOTANI: 2, WATARI: 2, YAHABA: 2,
    USHIJIMA: 3, TENDO: 3, SEMI: 3, OHIRA: 3, YAMAGATA: 3, SHIRABU: 2, KAWANISHI: 2, GOSHIKI: 1,
    ATSUMU: 2, OSAMU: 2, SUNA: 2, GINJIMA: 2, OMIMI: 3, OJIRO: 3, AKAGI: 3,
    KUROO: 3, YAKU: 3, KAI: 3, KENMA: 2, TAKETORA: 2, FUKUNAGA: 2, LEV: 1, SHIBAYAMA: 1, INUOKA: 1,
    BOKUTO: 3, KONOHA: 3, WASHIO: 3, SARUKUI: 3, KOMI: 3, AKAASHI: 2, ONAGA: 1,
    IIZUNA: 3, SAKUSA: 2, KOMORI: 2, HOSHIUMI: 2, HIRUGAMI: 2, HAKUBA: 2,
    FUTAKUCHI: 2, AONE: 2, OBARA: 2, KAMASAKI: 3, KOGANEGAWA: 1, SAKUNAMI: 1,
    KIRYU: 3, DAISHO: 3, NUMAI: 3, TERUSHIMA: 2, HYAKUZAWA: 1, NAKASHIMA: 3, IKEJIRI: 3
  };
  // still in high school this story year? (unknown names are fine)
  VB.HQ_YEARS_OK = function (name, year) { return !HQ_YEARS[name] || HQ_YEARS[name] + year - 1 <= 3; };
  // canon reserves who round out a few squads
  var BENCH = {
    KAR: [["SUGAWARA", "S"], ["YAMAGUCHI", "MB"], ["ENNOSHITA", "OH"]],
    AOB: [["YAHABA", "S"], ["KUNIMI", "OH"]],
    SHI: [["SEMI", "S"]],
    NEK: [["SHIBAYAMA", "L"], ["INUOKA", "MB"]]
  };
  [["SUGAWARA", 174, 76, { hair: "#c8c8c8", style: "flat" }], ["YAMAGUCHI", 179, 74, { hair: "#3a2416", style: "flat" }],
   ["ENNOSHITA", 176, 78, { hair: "#17120d", style: "buzz" }], ["YAHABA", 178, 76, { hair: "#b8863b", style: "flat" }],
   ["KUNIMI", 182, 80, { hair: "#17120d", style: "flat" }], ["SEMI", 178, 80, { hair: "#c8c8c8", style: "flat", hair2: "#17120d", ex: ["roots"] }],
   ["SHIBAYAMA", 163, 70, { hair: "#17120d", style: "bowl" }], ["INUOKA", 186, 88, { hair: "#3a2416", style: "spiky" }]].forEach(function (k) {
    VB.KNOWN[k[0]] = [k[1], k[2]]; VB.LOOKS[k[0]] = k[3];
  });

  var MIYAGI = ["KAR", "AOB", "SHI", "DAT", "JOH", "WAK", "KAK", "OHG", "TKN"], TOKYO = ["NEK", "FUK", "NOH", "ITC", "TSU", "UBU"];
  var RIVAL = { KAR: "AOB", AOB: "KAR", SHI: "AOB", DAT: "KAR", JOH: "AOB", WAK: "SHI", KAK: "DAT", NEK: "KAR", FUK: "NEK",
                NOH: "NEK", ITC: "INA", TSU: "NOH", UBU: "NEK", INA: "ITC", KAM: "KAR", MUJ: "FUK",
                OHG: "KAR", TKN: "KAR", SHZ: "FUK", KOU: "INA", HKY: "SHI", SKI: "MUJ", TNR: "KAM", AKN: "ITC" };
  var COACH = { KAR: "UKAI", NEK: "NEKOMATA", AOB: "IRIHATA", SHI: "WASHIJO", DAT: "OIWAKE" };
  function voice() { return (VB.HQ_VOICE && VB.HQ_VOICE[S.school]) || (VB.HQ_VOICE && VB.HQ_VOICE.GENERIC) || { y1: [""], y2: [""], y3: [""], huddle: ["FIGHT!"] }; }
  var MENTORS = {
    OH: [{ who: "BOKUTO", sch: "FUKURODANI", attr: "att", skill: "spike", name: "STRAIGHT KILL", line: "Don't think! Jump higher, hit harder, and look at the line!" },
         { who: "KUROO", sch: "NEKOMA", attr: "rec", skill: "rec", name: "NEKO RECEIVE", line: "Receive is about the feet. Get there first, then relax your arms." }],
    MB: [{ who: "KUROO", sch: "NEKOMA", attr: "blk", skill: "block", name: "KILL BLOCK", line: "Read the setter, not the ball. Then press your hands over — don't just hold them up." },
         { who: "BOKUTO", sch: "FUKURODANI", attr: "att", skill: "spike", name: "MIDDLE BLAST", line: "A middle who can hit is scary! Approach like you mean it!" }],
    S: [{ who: "AKAASHI", sch: "FUKURODANI", attr: "set", skill: "dump", name: "QUIET DUMP", line: "Keep your face calm. The block watches your eyes more than your hands." },
        { who: "KENMA", sch: "NEKOMA", attr: "set", skill: "dump", name: "GAMBIT DUMP", line: "...Just make them guess wrong once. Then they'll guess wrong all game." }],
    OP: [{ who: "BOKUTO", sch: "FUKURODANI", attr: "att", skill: "spike", name: "OWL CROSS", line: "Cross shot! Sharp! Even sharper! HEY HEY HEY!" },
         { who: "KUROO", sch: "NEKOMA", attr: "srv", skill: "serve", name: "PRESSURE SERVE", line: "A serve that's annoying is worth more than a serve that's pretty." }],
    L: [{ who: "YAKU", sch: "NEKOMA", attr: "def", skill: "dig", name: "GUARDIAN DIG", line: "A libero's job is simple: the ball never touches our floor." },
        { who: "KOMI", sch: "FUKURODANI", attr: "rec", skill: "rec", name: "SILENT RECEIVE", line: "Nobody notices a perfect pass. That's how you know it was perfect." }]
  };
  var DRILLS = {
    srv: "JUMP-FLOAT TARGET SERVES", rec: "SERVE-RECEIVE GAUNTLET", set: "100 TOSSES TO THE ANTENNA", att: "LINE & CROSS SPIKING",
    blk: "READ-AND-STEP BLOCKING", def: "FLYING-FALL DIGS", vert: "PLYOMETRIC JUMP CIRCUIT",
    men: "PRESSURE POINTS GAME", tec: "BALL-CONTROL CIRCUIT", spd: "SHUTTLE-RUN FOOTWORK"
  };
  var LOCAL_NAMES = ["HIGASHI KITA", "MINAMI SAKURA", "NISHI CHUO", "KAWARA TECH", "MIDORIGAOKA", "TOKONATSU", "SHINRYO", "ASAHI DAI"];
  var LOCAL_KITS = [["#6a8f2a", "#ffffff"], ["#c0396b", "#ffffff"], ["#2a5fa8", "#ffd21e"], ["#7a4a1a", "#ffffff"], ["#3a3a8a", "#ffffff"], ["#d0592a", "#1b1b1b"]];

  var S = null, exitStory = null, busy = false, tab = "team", setup = null;

  // ================== PERSISTENCE / HELPERS ==================
  function save() { try { localStorage.setItem(SLOT_KEY + S.slot, JSON.stringify(S)); } catch (e) { console.warn(e); } }
  function load(slot) { try { return JSON.parse(localStorage.getItem(SLOT_KEY + slot) || "null"); } catch (e) { return null; } }
  function you() { return S.players.you; }
  function P(id) { return S.players[id]; }
  function ovr(p) { return VB.ovr(p); }
  function team(id) { return VB.HQ_ALL.find(function (t) { return t.id === id; }) || (S.locals || []).find(function (t) { return t.id === id; }); }
  function school() { return team(S.school); }
  function coach() { return COACH[S.school] ? "Coach " + COACH[S.school] : "Coach"; }
  function region(id) { return MIYAGI.indexOf(id) >= 0 ? "MIYAGI" : TOKYO.indexOf(id) >= 0 ? "TOKYO" : "LOCAL"; }
  function log(t, tag) { S.log.unshift({ y: S.year, t: t, tag: tag || "" }); if (S.log.length > 90) S.log.length = 90; }
  function yearTxt(y) { return y >= 4 ? "TIMESKIP" : ["", "1ST", "2ND", "3RD"][y] + " YEAR"; }

  // ================== CREATION ==================
  function newRec(name, fam, base, yr, nat) {
    var p = VB.makePlayer({ name: name, nat: nat || "JPN", role: fam, base: base, age: 14 + yr, heightAdj: -9 });
    return p;
  }
  function addMember(p, yr, slot) { S.players[p.id] = p; S.squad.push(p.id); S.years[p.id] = yr; if (slot) S.slotOf[p.id] = slot; }

  function createStory(slot, st) {
    var t = team(st.school) || VB.HQ_ALL.find(function (x) { return x.id === st.school; });
    S = { slot: slot, v: 1, school: t.id, year: 1, phase: 0, step: 0, players: {}, squad: [], years: {}, slotOf: {}, taken: {},
          trust: 10, focus: FOCUS[st.fam][0], prog: {}, log: [], trophies: [], history: [], stats: {}, bracket: null,
          springOut: false, captain: false, vertGain: 0, mentorDone: false, locals: [], done: false, startOvr: 0, name: st.name, fam: st.fam, ph2: 1, week: 0, papers: [] };
    if (region(t.id) === "LOCAL") {
      shuffle(LOCAL_NAMES.slice()).slice(0, 4).forEach(function (n, i) {
        var k = LOCAL_KITS[i % LOCAL_KITS.length];
        S.locals.push({ id: "LOC" + i, name: n, short: n, flag: "🏫", ovr: irnd(62, 68), kit: k[0], kit2: k[1], players: {}, stars: {},
                        nat: "JPN", ages: [16, 18], heightAdj: -9, play: pick(["balanced", "defense", "power", "fast"]) });
      });
    }
    // canon starters + a few canon reserves + generated bench
    var line = VB.teamLineup(t, S.taken);
    VB.ROLES.forEach(function (r) {
      var p = line[r], canon = (t.players || {})[r];
      p.id = "s-" + r;
      addMember(p, canon && HQ_YEARS[canon] ? HQ_YEARS[canon] : irnd(1, 3), canon ? r : null);
      S.taken[p.name] = 1;
    });
    (BENCH[t.id] || []).forEach(function (b, i) {
      var p = newRec(b[0], b[1], t.ovr - 4, HQ_YEARS[b[0]] || 2); p.id = "b-" + i; S.taken[b[0]] = 1;
      addMember(p, HQ_YEARS[b[0]] || 2);
    });
    fillSquad(t, 2);
    // you
    var fam = st.fam, h = VB.HEIGHT[fam], v = VB.VERT[fam];
    var height = Math.round((h[0] + h[1]) / 2) - 9 + (st.build === "tower" ? 7 : st.build === "jumper" ? -10 : 0) + (st.hAdj || 0);
    var vert = Math.round((v[0] + v[1]) / 2) - 4 + (st.build === "tower" ? -8 : st.build === "jumper" ? 11 : 0) - Math.round((st.hAdj || 0) * 0.4);
    var me = VB.makePlayer({ id: "you", name: st.name, nat: "JPN", role: fam, base: t.ovr - 11, age: 15, height: height, vert: vert,
                             face: { skin: VB.SKINS[st.skin], hair: st.hairC, style: st.hairS, mouth: true } });
    me.pot = clamp(t.ovr + irnd(8, 12), 55, 99);
    S.players.you = me; S.squad.push("you"); S.years.you = 1;
    S.startOvr = ovr(me);
    S.conf = 50; S.bond = {};
    pickRival();
    snapEval();
    log("You join " + t.name + " as a first-year " + VB.FAMILY_NAMES[fam] + ".", "you");
  }

  // keep every position covered: generated players (first-years when recruiting)
  function fillSquad(t, firstYears) {
    var count = {};
    S.squad.forEach(function (id) { var f = P(id).role; count[f] = (count[f] || 0) + 1; });
    var n = 0;
    Object.keys(COMP).forEach(function (f) {
      while ((count[f] || 0) < COMP[f]) {
        var yr = firstYears ? 1 : irnd(1, 3), p = newRec(VB.genName("JPN", S.taken), f, t.ovr - (yr === 1 ? irnd(7, 12) : irnd(3, 8)), yr);
        addMember(p, yr); count[f] = (count[f] || 0) + 1; n++;
      }
    });
    for (var i = n; i < (firstYears || 0); i++) {
      var f = pick(["OH", "MB", "OP", "S", "L"]);
      addMember(newRec(VB.genName("JPN", S.taken), f, t.ovr - irnd(6, 12), 1), 1);
    }
  }

  // ================== LINEUPS ==================
  function selScore(p) {
    var s = ovr(p) + (S.years[p.id] - 1) * 1.2;
    if (p.id === "you") s += S.trust * 0.09 + (S.captain ? 3 : 0) + ((S.conf || 50) - 50) * 0.04;   // confidence counts, a little
    else if (S.slotOf[p.id]) s += 2;      // canon starters get the benefit of the doubt
    return s;
  }
  // forceYou: practice matches — the coach wants a look at you
  function myLineup(forceYou) {
    var fams = { S: ["S"], OH: ["OH1", "OH2"], MB: ["MB1", "MB2"], OP: ["OP"], L: ["L"] }, line = {};
    Object.keys(fams).forEach(function (f) {
      var slots = fams[f];
      var c = S.squad.map(P).filter(function (p) { return p.role === f; }).sort(function (a, b) { return selScore(b) - selScore(a); });
      var chosen = c.slice(0, slots.length);
      if (forceYou && f === you().role && chosen.indexOf(you()) < 0) chosen[chosen.length - 1] = you();
      var free = slots.slice();
      chosen.forEach(function (p) { var k = S.slotOf[p.id]; if (k && free.indexOf(k) >= 0) { line[k] = p; free.splice(free.indexOf(k), 1); } });
      chosen.forEach(function (p) { if (VB.ROLES.some(function (r) { return line[r] === p; })) return; line[free.shift()] = p; });
    });
    return line;
  }
  function keyOf(line) { return VB.ROLES.find(function (r) { return line[r] && line[r].id === "you"; }) || null; }
  function comboFor(t, line) {
    var cb = t.combo;
    return cb && line[cb.hitter] && line[cb.hitter].name === (t.players || {})[cb.hitter] ? cb : null;
  }
  function myDef(line) {
    var t = school();
    return { id: t.id, name: t.name, short: t.short || t.name, flag: t.flag, kit: t.kit, kit2: t.kit2,
             combo: comboFor(t, line), play: VB.PLAY_OF[t.id], lineup: line };
  }
  // rivals age too: canon players past their third year have graduated
  function oppDef(id) {
    var t = team(id), c = { id: t.id, name: t.name, short: t.short, nat: "JPN", ages: [16, 18], heightAdj: -9, ovr: t.ovr, players: {}, stars: {}, skillNames: {},
                            hair: {}, style: {}, skin: {} }, gone = 0;
    VB.ROLES.forEach(function (r) {
      var n = (t.players || {})[r];
      if (n && HQ_YEARS[n] && HQ_YEARS[n] + S.year - 1 > 3) { gone++; return; }
      if (n) c.players[r] = n;
      ["stars", "skillNames", "hair", "style", "skin"].forEach(function (k) { if (t[k] && t[k][r] != null) c[k][r] = t[k][r]; });
    });
    c.ovr = t.ovr - gone;
    var line = VB.teamLineup(c, {});
    return { id: t.id, name: t.name, short: t.short || t.name, flag: t.flag, kit: t.kit, kit2: t.kit2, ovr: c.ovr,
             combo: comboFor(t, line), play: t.play || VB.PLAY_OF[t.id], lineup: line };
  }

  // ================== GROWTH ==================
  function addPts(a, pts) {
    var p = you(), gained = 0;
    S.prog[a] = (S.prog[a] || 0) + pts;
    while (S.prog[a] >= 1) {
      S.prog[a] -= 1;
      if (a === "vert") { if (S.vertGain >= 10) break; p.vert++; S.vertGain++; }
      else { if (p[a] >= 99) break; p[a]++; }
      gained++;
    }
    return gained;
  }
  function room() { return clamp((you().pot - ovr(you())) / 8, 0.12, 1.2); }

  // ================== CO-OP (a friend joins your school as P2) ==================
  var SINGLE = ["S", "OP", "L"], FAM_SLOTS = { S: ["S"], OH: ["OH1", "OH2"], MB: ["MB1", "MB2"], OP: ["OP"], L: ["L"] };
  function mateP() { return S && S.players.mate && S.squad.indexOf("mate") >= 0 ? S.players.mate : null; }
  function coopOn() { return VB.Coop && VB.Coop.live() && !!mateP() && !S.ts; }
  async function startCoop() {
    VB.Coop.startHost({
      what: "Haikyuu!! story — " + school().name,
      hostName: function () { return S ? you().name : "HOST"; },
      info: function () {
        return S ? { what: "story", club: school().name, kit: school().kit, single: SINGLE.indexOf(you().role) >= 0 ? [you().role] : [], mate: S.players.mate ? S.players.mate.name : null } : {};
      },
      onJoin: coopJoin,
      onFocus: function (a) { var m = S && S.players.mate; if (m && FOCUS[m.role].indexOf(a) >= 0) { S.mateFocus = a; save(); if (!busy) render(); } },
      onConnect: function () { if (S && !busy) render(); }, onLost: function () { if (S && !busy) render(); }
    });
    await VB.Coop.invite();
  }
  function coopJoin(m) {
    if (!S || S.done) return { ok: false, msg: "The host isn't in a Haikyuu!! story right now." };
    if (S.players.mate) {
      var old = S.players.mate;
      if (!m.rejoin && m.name) { old.name = m.name.toUpperCase().slice(0, 12); if (m.face) old.face = m.face; }
      if (S.squad.indexOf("mate") < 0) { S.squad.push("mate"); S.years.mate = S.years.you; }
      log("🤝 " + old.name + " is back in the gym — co-op on!", "you"); save(); render();
      return { ok: true, msg: "Welcome back" };
    }
    if (!m.fam || !FOCUS[m.fam]) return { ok: false, msg: "Pick a position." };
    if (m.fam === you().role && SINGLE.indexOf(m.fam) >= 0) return { ok: false, msg: "The host already plays " + VB.FAMILY_NAMES[m.fam] + " — pick another position." };
    var p = VB.makePlayer({ id: "mate", name: (m.name || "P2").toUpperCase().slice(0, 12), nat: "JPN", role: m.fam, base: ovr(you()), age: you().age, heightAdj: -9, face: m.face });
    p.pot = Math.max(p.pot, you().pot);
    S.players.mate = p; S.squad.push("mate"); S.years.mate = S.years.you; S.taken[p.name] = 1; S.mateFocus = FOCUS[m.fam][0];
    S.bond.mate = Math.max(S.bond.mate || 0, 2);
    log("🤝 " + p.name + " transfers in and joins " + school().name + " as your co-op partner (" + VB.FAMILY_NAMES[m.fam] + ").", "you");
    save(); render();
    return { ok: true, msg: "Joined" };
  }
  function forceIn(line, p) {
    if (!p || VB.ROLES.some(function (r) { return line[r] && line[r].id === p.id; })) return;
    var slot = FAM_SLOTS[p.role].find(function (r) { return !line[r] || (line[r].id !== "you" && line[r].id !== "mate"); });
    if (slot) line[slot] = p;
  }
  function mateGrow(rating) {
    var p = mateP(); if (!p) return {};
    var pts = Math.max(0, rating - 5) * 1.15 * clamp((p.pot - ovr(p)) / 8, 0.12, 1.2), fl = FOCUS[p.role], gains = {};
    S.mprog = S.mprog || {};
    fl.forEach(function (a) {
      if (a === "vert") return;
      S.mprog[a] = (S.mprog[a] || 0) + pts * (a === S.mateFocus ? 0.4 : 0.6 / (fl.length - 1)) * rnd(0.7, 1.3) * clamp((99 - p[a]) / 30, 0.2, 1);
      while (S.mprog[a] >= 1 && p[a] < 99) { S.mprog[a] -= 1; p[a]++; gains[a] = (gains[a] || 0) + 1; }
    });
    return gains;
  }
  function coopCard() {
    var m = S.players.mate, hosting = VB.Coop && VB.Coop.hosting();
    if (!m && !hosting) return "";
    return "<div class='card coop-card'>" + (m ? "<img class='pix' src='" + VB.Engine.spriteURL(m.face, school().kit) + "' alt=''/>" : "") +
      "<div><div class='pname'>🤝 CO-OP" + (m ? " — P2 " + esc(m.name) : "") + "</div>" +
      (m ? "<div class='muted'>" + VB.FAMILY_NAMES[m.role] + " • OVR " + ovr(m) + " • FOCUS " + esc((S.mateFocus || FOCUS[m.role][0]).toUpperCase()) + "</div>" : "") +
      "<div>" + esc(hosting ? VB.Coop.status() : "Not hosting — press 🤝 CO-OP to invite your friend again.") + "</div>" +
      (m && !(VB.Coop && VB.Coop.live()) ? "<div class='muted'>While P2 is offline, " + esc(m.name) + " is just another teammate fighting for a spot.</div>" : "") + "</div></div>";
  }
  function grow(rating) {
    var pts = Math.max(0, rating - 5) * 1.15 * room(), fl = FOCUS[you().role], gains = {};
    var rest = VB.ATTRS.filter(function (a) { return fl.indexOf(a) < 0; });
    fl.concat(rest).forEach(function (a) {
      var w = rest.indexOf(a) >= 0 ? 0.2 / rest.length : a === S.focus ? 0.4 : 0.4 / (fl.length - 1);
      var g = addPts(a, pts * w * rnd(0.7, 1.3) * clamp((99 - you()[a]) / 30, 0.2, 1));
      if (g) gains[a] = g;
    });
    return gains;
  }
  function gainTxt(g) { return Object.keys(g).map(function (k) { return "+" + g[k] + " " + ATTR_TXT[k]; }).join(", "); }

  // ================== DRILL BAR (modal minigame) ==================
  function drillBar(title, text, o) {
    o = o || {};
    var goodW = o.goodW || 0.24, perfW = goodW * 0.3, speed = o.speed || 1300;
    return new Promise(function (res) {
      var center = rnd(0.3, 0.7), t0 = performance.now(), raf = 0, done = false;
      $("modalTitle").textContent = title;
      $("modalBody").innerHTML = "<p>" + esc(text) + "</p><div class='drill'><div class='drill-g' style='left:" + (center - goodW / 2) * 100 + "%;width:" + goodW * 100 + "%'></div>" +
        "<div class='drill-p' style='left:" + (center - perfW / 2) * 100 + "%;width:" + perfW * 100 + "%'></div><div class='drill-m' id='drillM'></div></div>" +
        "<p class='center muted'>Click HIT! (or press SPACE) when the marker is in the zone.</p><p class='center big' id='drillRes'></p>";
      var bar = $("modalBtns"); bar.innerHTML = "";
      var b = document.createElement("button"); b.className = "btn big"; b.textContent = "HIT!"; bar.appendChild(b);
      $("modal").classList.remove("hidden");
      function pos(now) { var u = ((now - t0) / speed) % 2; return u < 1 ? u : 2 - u; }
      var shown = 0;
      function frame(now) { if (done) return; var m = $("drillM"); shown = pos(now); if (m) m.style.left = shown * 100 + "%"; raf = requestAnimationFrame(frame); }
      raf = requestAnimationFrame(frame);
      function hit() {
        if (done) return; done = true; cancelAnimationFrame(raf); document.removeEventListener("keydown", key);
        var now = performance.now(), d = Math.min(Math.abs(shown - center), Math.abs(pos(now - 60) - center), Math.abs(pos(now) - center));
        var q = d <= perfW / 2 ? 1 : d <= goodW / 2 ? 0.85 - 0.3 * (d / (goodW / 2)) : d <= goodW ? 0.25 : 0;
        $("drillRes").textContent = q >= 1 ? "PERFECT!" : q >= 0.5 ? "GOOD" : q > 0 ? "OFF" : "MISSED";
        $("drillRes").style.color = q >= 1 ? "#1fa34a" : q >= 0.5 ? "#c99a00" : "#d33";
        bar.innerHTML = "";
        setTimeout(function () { $("modal").classList.add("hidden"); res(q); }, 650);
      }
      function key(e) { if (e.code === "Space") { e.preventDefault(); hit(); } }
      document.addEventListener("keydown", key);
      b.addEventListener("click", hit);
    });
  }
  async function drill(a, label) {
    var p = you(), lvl = a === "vert" ? 70 : p[a];
    var q = VB.Mini ? await VB.Mini.forAttr(a, label || DRILLS[a], "Drill: " + DRILLS[a] + ".", lvl)          // a different minigame each time
                    : await drillBar(label || DRILLS[a], "Drill: " + DRILLS[a] + ".", { goodW: clamp(0.18 + (lvl - 60) / 300, 0.16, 0.3), speed: 1500 - (lvl - 60) * 4 });
    var g = addPts(a, (0.6 + q * 2.4) * room() * rnd(0.85, 1.15));
    S.trust = clamp(S.trust + q * 3.5, 0, 100);
    return { q: q, g: g };
  }

  // ================== MATCHES ==================
  async function playStory(foeId, o) {
    var bet = rivalHere(foeId) ? await rivalScene(o) : null;
    var line = myLineup(o.practice), coop = coopOn();
    if (coop) { forceIn(line, you()); forceIn(line, mateP()); }
    var key = keyOf(line), mateKey = coop ? VB.ROLES.find(function (r) { return line[r] && line[r].id === "mate"; }) || null : null;
    var mine = myDef(line), foe = oppDef(foeId);
    var st = S.stats[S.year] = S.stats[S.year] || VB.Stats.newLine();
    if (!key) {
      var q = await drillBar("PINCH SERVER", coach() + " calls your name late in the set: \"Go in and serve. One good one.\"", { goodW: 0.22, speed: 1250 });
      S.trust = clamp(S.trust + q * 4 - 0.5, 0, 100);
      var bonus = q >= 1 ? 3 : q >= 0.5 ? 1 : 0;
      mine.ovr = VB.Stats.teamOvr(mine) + bonus;
      var s = VB.Stats.simSets(mine, foe, o.bestOf || 1), won = s.a > s.b;
      var benchCoins = VB.Gacha ? VB.Gacha.earn(won ? 1000 : 500) : 0;
      await U.modal(won ? "WIN (FROM THE BENCH)" : "LOSS (FROM THE BENCH)",
        "<p>" + esc(coach()) + " went with the starters. " + (q >= 1 ? "Your pinch serve was an ACE — the bench went wild." : q >= 0.5 ? "Your pinch serve forced a free ball." : "Your pinch serve didn't do much.") + "</p>" +
        "<p class='center big'>" + esc(mine.name + " " + s.a + " : " + s.b + " " + foe.name) + "</p>" + (benchCoins ? "<p class='center'>+" + benchCoins + " 🏐 COINS</p>" : "") +
        "<p class='center muted'>COACH TRUST " + Math.round(S.trust) + "</p>",
        [{ label: "CONTINUE", value: 1 }]);
      log((won ? "W " : "L ") + s.a + "-" + s.b + " vs " + foe.name + " (" + o.label + ") — bench.", "result");
      addConf(won ? 0 : -1.5);
      if (bet) await rivalAfter(bet, won, false);
      return won;
    }
    // big matches: the huddle, in the school's own words
    if (o.bestOf > 1 || /NATIONALS/.test(o.label)) {
      var v = voice(), cap = S.captain ? "You" : (S.squad.map(P).filter(function (p) { return p.id !== "you" && S.years[p.id] === 3; }).sort(function (a, b) { return ovr(b) - ovr(a); })[0] || { name: "The captain" }).name;
      await U.modal("📣 THE HUDDLE", "<p class='muted'>" + esc(o.label) + " — " + esc(foe.name) + ". " + esc(cap) + (S.captain ? " pull" : " pulls") + " everyone into a circle.</p><p>" + esc(pick(v.huddle)) + "</p>",
        [{ label: "\"FIGHT!\"", value: 1 }]);
      addConf(1);
    }
    // big matches and rival matches come with a press conference
    var pre = null;
    if (VB.Media && (bet || o.bestOf > 1 || /NATIONALS/.test(o.label))) {
      pre = await VB.Media.pre({ who: you().name, team: school().name, foe: foe.name, label: o.label, final: o.bestOf > 1, rival: bet ? S.rival.name : null });
      var fx0 = storyTone(pre.tone);
      await VB.Media.reaction(pre, null, fx0);
    }
    U.showView("match");
    $("recordLine").textContent = yearTxt(S.year) + " • " + school().name + " • " + o.label;
    var res = await VB.Engine.playMatch({ mine: mine, foe: foe, homeSide: o.away ? 1 : 0, mode: "role", myRole: key, mateRole: mateKey,
                                          label: o.label + (o.bestOf > 1 ? " • BEST OF 3" : "") + (mateKey ? " • 🤝 CO-OP" : ""), league: o.league || "HARUKO",
                                          bestOf: o.bestOf || 1, floor: o.floor || "wood", confAdj: confAdj(line) + (bet && bet.focus || 0) });
    U.showView("hub");
    var lineSt = res.stats.you, rating = VB.Stats.rating(lineSt, you().role, res.won);
    S.stats[S.year] = VB.Stats.addInto(st, lineSt);
    S.rt = S.rt || {}; (S.rt[S.year] = S.rt[S.year] || []).push({ r: rating, nat: /NATIONALS/.test(o.label) });
    var before = ovr(you()), gains = grow(rating), after = ovr(you());
    S.trust = clamp(S.trust + (rating - 6) * 3 + (res.won ? 1 : 0), 0, 100);
    addConf((rating - 6.5) * 3 + (res.won ? 1.5 : -1.5));
    var flowed = res.flows.some(function (f) { return f.id === "you"; });
    var skillNew = checkSkill(), mateHTML = "";
    if (mateKey && res.stats.mate) {
      var mp = mateP(), mr = VB.Stats.rating(res.stats.mate, mp.role, res.won), mg = mateGrow(mr);
      mateHTML = "<p class='center'>🤝 P2 " + esc(mp.name) + ": <b class='rating'>" + mr + "</b> / 10 • " + esc(VB.Stats.lineText(res.stats.mate)) + (gainTxt(mg) ? " • <span class='gain'>" + esc(gainTxt(mg)) + "</span>" : "") + "</p>";
      if (mr >= 8) log("🤝 " + mp.name + " (P2) was unstoppable vs " + foe.name + " — " + mr + "/10.", "you");
    }
    log((res.won ? "W " : "L ") + res.score[0] + "-" + res.score[1] + " vs " + foe.name + " (" + o.label + ") — rating " + rating + ".", "result");
    if (flowed) log("🔵🔥 You hit the FLOW STATE against " + foe.name + ".", "you");
    await U.modal(res.won ? "WIN" : "LOSS",
      "<p class='center big'>" + esc(mine.name + " " + res.score[0] + " : " + res.score[1] + " " + foe.name) + "</p>" +
      (res.sets && res.sets.length > 1 ? "<p class='center muted'>SETS " + res.sets.map(function (x) { return x[0] + "-" + x[1]; }).join(", ") + "</p>" : "") +
      (res.coins ? "<p class='center'>+" + res.coins + " 🏐 COINS</p>" : "") +
      "<p class='center'>YOUR RATING: <b class='rating'>" + rating + "</b> / 10</p>" +
      "<p class='center'>" + esc(VB.Stats.lineText(lineSt)) + "</p>" + mateHTML +
      (gainTxt(gains) ? "<p class='center gain'>GROWTH: " + esc(gainTxt(gains)) + "</p>" : "") +
      (after > before ? "<p class='center gain'>OVR " + before + " → " + after + "</p>" : "") +
      (skillNew ? "<p class='center gain'>★ NEW MOVE: " + esc(you().skillName) + "</p>" : "") +
      "<p class='center muted'>COACH TRUST " + Math.round(S.trust) + " • CONFIDENCE " + Math.round(S.conf) + "</p>",
      [{ label: "CONTINUE", value: 1 }]);
    if (bet) await rivalAfter(bet, res.won, true, rating);
    if (pre && pre.tone === "fiery") { addConf(res.won ? 3 : -4); log(res.won ? "You backed up your big words." : "Your pre-match talk comes back to bite you.", "you"); }
    var champ = o.titleMatch && res.won;
    if (VB.Media && (champ || bet || o.bestOf > 1 || rating >= 7.8 || rating <= 5.2 || Math.random() < 0.3)) {
      var post = await VB.Media.post({ who: you().name, team: school().name, foe: foe.name, won: res.won, score: res.score, rating: rating, rival: bet ? S.rival.name : null, champion: champ });
      var fx1 = storyTone(post.tone, res.won);
      log("📰 " + post.outlet + ": \"" + post.quote + "\"", "story");
      await VB.Media.reaction(post, null, fx1);
    }
    return res.won;
  }
  function checkSkill() {
    var p = you();
    if (p.skill || !S.pendingSkill || ovr(p) < S.startOvr + 5) return false;
    p.skill = S.pendingSkill.skill; p.skillName = S.pendingSkill.name; S.pendingSkill = null;
    p[VB.SKILL_ATTR[p.skill]] = Math.min(99, p[VB.SKILL_ATTR[p.skill]] + 3);
    log("★ You finally pull off your own " + p.skillName + " in a real match!", "you");
    return true;
  }

  // ================== BRACKETS ==================
  function regionalOthers() {
    var r = region(S.school), ids = r === "MIYAGI" ? MIYAGI : r === "TOKYO" ? TOKYO : S.locals.map(function (t) { return t.id; });
    return ids.filter(function (id) { return id !== S.school; });
  }
  function bracket(n) {
    var o = regionalOthers().slice().sort(function (a, b) { return oppDef(a).ovr - oppDef(b).ovr; });
    var fin = o.pop();
    if (Math.random() < 0.3 && o.length) { var alt = o.pop(); o.push(fin); fin = alt; }
    var rest = shuffle(o).slice(0, n - 1).sort(function (a, b) { return team(a).ovr - team(b).ovr; });
    return rest.concat([fin]);
  }
  function nationalsField(n) {
    var reg = region(S.school) === "LOCAL" ? [S.school] : (region(S.school) === "MIYAGI" ? MIYAGI : TOKYO);
    var pool = VB.HQ_ALL.map(function (t) { return t.id; }).filter(function (id) { return reg.indexOf(id) < 0; });
    return shuffle(pool).slice(0, n).sort(function (a, b) { return oppDef(a).ovr - oppDef(b).ovr; });
  }
  var Q_NAMES = { 2: ["SEMIFINAL", "FINAL"], 3: ["QUARTERFINAL", "SEMIFINAL", "FINAL"] };
  var N_NAMES = ["ROUND 1", "ROUND 2", "QUARTERFINAL", "SEMIFINAL", "FINAL"];

  // ================== STORY BEATS ==================
  function introText() {
    var t = school(), y = S.year;
    var v = voice(), motto = v.motto ? "<p class='center big'>「 " + esc(v.motto) + " 」</p>" : "";
    if (y === 1) return motto + "<p>The gym at <b>" + esc(t.name) + "</b> smells like floor wax and effort. Upperclassmen everywhere, and they all look huge.</p>" +
      "<p>" + esc(pick(v.y1)) + "</p>" +
      "<p class='muted'>Your position: " + VB.FAMILY_NAMES[you().role] + ". Starters right now: " + esc(starterTxt()) + ".</p>";
    if (y === 2) return motto + "<p>Second year. The third-years who carried this team have graduated — " + esc(S.lastGrads || "the seniors") + ". Somebody kept their shoes in the clubroom, just in case.</p>" +
      "<p>" + esc(pick(v.y2)) + "</p><p>Now there are first-years watching how <b>you</b> warm up. Nobody calls you the new kid anymore.</p>";
    return motto + "<p>Third year. " + (S.captain ? "The team voted, and the captain's number is yours. " : "Your last year in this jersey. ") +
      "There's no next spring after this one.</p><p>" + esc(pick(v.y3)) + "</p>";
  }
  function starterTxt() {
    var l = myLineup(false);
    return VB.ROLES.map(function (r) { return r + " " + l[r].name; }).join(", ");
  }

  async function advance() {
    if (busy || S.done) return;
    busy = true;
    try {
      if (VB.Coop && VB.Coop.live() && !(await VB.Coop.agree(nextTxt()))) return;       // co-op: P2 has to agree to the next day
      if (S.ts) { await timeskip(); save(); render(); return; }
      if (S.pendingEval) { await evaluation(S.pendingEval); S.pendingEval = null; save(); render(); return; }
      if (PH[S.phase] !== "april") {                                     // each step is about a week: the paper comes out every other week
        S.week = (S.week || 0) + 1;
        if (S.week - (S.paperWk || 0) >= 2) { S.paperWk = S.week; await newspaper(); save(); }
      }
      var evKey = S.year + "-" + S.phase;
      if (S.evAt !== evKey && PH[S.phase] !== "april" && PH[S.phase] !== "end") {
        S.evAt = evKey;
        if (Math.random() < 0.6) { await randomEvent(); save(); render(); return; }
      }
      var ph = PH[S.phase], t = school();
      if (ph === "april") {
        await U.modal(yearTxt(S.year) + " — APRIL", introText(), [{ label: "LET'S GO", value: 1 }]);
        if (S.rival && !S.rival.met) await rivalIntro();
        S.yStart = {}; S.squad.forEach(function (id) { S.yStart[id] = ovr(P(id)); });
        nextPhase();
      } else if (ph === "practice") {
        var rv = RIVAL[S.school] === S.school ? "NEK" : RIVAL[S.school];
        await U.modal("PRACTICE MATCH", "<p>A practice match against <b>" + esc(team(rv).name) + "</b>. " + esc(coach()) + " wants to see the new combinations — you're starting.</p>", [{ label: "PLAY", value: 1 }]);
        await playStory(rv, { label: "PRACTICE vs " + team(rv).name, practice: true, league: "PRACTICE" });
        nextPhase();
      } else if (ph === "gw") {
        if (S.step === 0) {
          var fl = FOCUS[you().role].concat(you().role === "L" ? [] : ["vert"]);
          var picks = [S.focus].concat(shuffle(fl.filter(function (a) { return a !== S.focus; })).slice(0, 1));
          var out = [];
          for (var i = 0; i < picks.length; i++) { var r = await drill(picks[i], "GOLDEN WEEK — DRILL " + (i + 1)); out.push(DRILLS[picks[i]] + ": " + (r.g ? "+" + r.g + " " + ATTR_TXT[picks[i]] : "no gain")); }
          log("Golden Week drills — " + out.join(" • "), "story");
          await U.modal("GOLDEN WEEK", "<p>Four days of training camp, three meals a day, and a lot of floor burns.</p><ul>" + out.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ul>", [{ label: "CONTINUE", value: 1 }]);
          S.step = 1; save(); render();
        } else {
          var gwFoe = S.school === "KAR" ? "NEK" : S.school === "NEK" ? "KAR" : pick(VB.HQ_ALL.filter(function (x) { return x.id !== S.school; })).id;
          await playStory(gwFoe, { label: "GOLDEN WEEK vs " + team(gwFoe).name, practice: true, league: "PRACTICE" });
          nextPhase();
        }
      } else if (ph === "ih") {
        if (!S.bracket) { S.bracket = bracket(2); S.step = 0; }
        if (S.step < 2) {
          var foeId = S.bracket[S.step], nm = Q_NAMES[2][S.step];
          var won = await playStory(foeId, { label: "INTERHIGH " + region(S.school) + " " + nm, league: "INTERHIGH", bestOf: S.step === 1 ? 3 : 1 });
          if (!won) { S.ih = "Lost the " + nm + " to " + team(foeId).name; log("Interhigh: out in the " + nm + ".", "result"); S.bracket = null; nextPhase(); }
          else { S.step++; save(); render(); }
        } else {
          // regional champions: the national tournament is simulated
          var field = nationalsField(4), line = myLineup(false), mine = myDef(line), reached = "CHAMPIONS", res = [];
          for (var k = 0; k < field.length; k++) {
            var sm = VB.Stats.sim(mine, oppDef(field[k]));
            res.push((sm.a > sm.b ? "W " : "L ") + sm.a + "-" + sm.b + " " + team(field[k]).name);
            if (sm.a < sm.b) { reached = ["ROUND 1", "QUARTERFINAL", "SEMIFINAL", "FINAL"][k]; break; }
          }
          S.ih = reached === "CHAMPIONS" ? "INTERHIGH CHAMPIONS" : "Interhigh nationals: out in the " + reached;
          if (reached === "CHAMPIONS") S.trophies.push("Y" + S.year + " INTERHIGH CHAMPIONS");
          log("Interhigh nationals — " + res.join(" • "), "result");
          await U.modal("INTERHIGH NATIONALS", "<p>Prefecture champions! The national Interhigh runs in a blur:</p><ul>" + res.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ul><p class='center big'>" + esc(S.ih) + "</p>", [{ label: "CONTINUE", value: 1 }]);
          S.bracket = null; nextPhase();
        }
      } else if (ph === "camp") {
        if (S.step === 0) {
          var ms = MENTORS[you().role];
          var mi = await U.modal("TOKYO SUMMER CAMP", "<p>A week of practice matches with Tokyo's best — and penalty dives for every lost set. After hours, the gym stays open for extra practice.</p><p>Who do you ask to train with?</p>",
            ms.map(function (m, i) { return { label: m.who + " (" + m.sch + ")", value: i }; }));
          var m = ms[mi];
          var dr = await drill(m.attr, "EXTRA PRACTICE WITH " + m.who);
          var learn = !you().skill && dr.q >= 0.5;
          if (learn) S.pendingSkill = { skill: m.skill, name: m.name };
          log("Summer camp: extra practice with " + m.who + (dr.g ? " (+" + dr.g + " " + ATTR_TXT[m.attr] + ")" : "") + (learn ? " — learning the " + m.name + "." : "."), "story");
          await U.modal(m.who, "<p>" + esc((VB.HQ_MENTOR_LINES || {})[m.who] || "\"" + m.line + "\"") + "</p>" +
            (dr.g ? "<p class='center gain'>+" + dr.g + " " + ATTR_TXT[m.attr] + "</p>" : "") +
            (learn ? "<p class='center gain'>You start working on the <b>" + esc(m.name) + "</b>. Keep growing (OVR " + (S.startOvr + 5) + "+) to pull it off in a match.</p>" :
             you().skill ? "" : "<p class='muted'>You couldn't quite get it tonight. Maybe next summer.</p>"),
            [{ label: "CONTINUE", value: 1 }]);
          if (learn) checkSkill();
          S.step = 1; save(); render();
        } else {
          var campFoe = pick(["FUK", "NEK", "NOH", "UBU", "KAR"].filter(function (x) { return x !== S.school; }));
          await playStory(campFoe, { label: "SUMMER CAMP vs " + team(campFoe).name, practice: true, league: "PRACTICE" });
          nextPhase();
        }
      } else if (ph === "spring") {
        if (!S.bracket) { S.bracket = bracket(3); S.step = 0; S.springOut = false; }
        var sf = S.bracket[S.step], snm = Q_NAMES[3][S.step];
        var w = await playStory(sf, { label: "SPRING " + region(S.school) + " " + snm, league: "SPRING QUALIFIER", bestOf: S.step >= 1 ? 3 : 1 });
        if (!w) { S.springOut = true; S.spring = "Lost the prefecture " + snm + " to " + team(sf).name; log("Spring qualifiers: out in the " + snm + ".", "result"); S.bracket = null; nextPhase(); }
        else if (S.step === 2) {
          log("🏆 " + region(S.school) + " CHAMPIONS — off to Spring Nationals!", "you");
          await U.modal("TO TOKYO!", "<p>The prefecture is yours. Next stop: the <b>Spring Nationals</b> in Tokyo — the orange court.</p>", [{ label: "CONTINUE", value: 1 }]);
          S.bracket = null; nextPhase();
        } else { S.step++; save(); render(); }
      } else if (ph === "youth") {
        await youthCamp();
        nextPhase();
      } else if (ph === "nationals") {
        if (S.springOut) { nextPhase(); }
        else {
          if (!S.bracket) { S.bracket = nationalsField(5); S.step = 0; }
          var nf = S.bracket[S.step], nn = N_NAMES[S.step];
          var nw = await playStory(nf, { label: "SPRING NATIONALS " + nn, league: "SPRING NATIONALS", bestOf: S.step >= 3 ? 3 : 1, floor: "rubber", titleMatch: S.step === 4 });
          if (!nw) { S.spring = "Spring Nationals: out in the " + nn + " vs " + team(nf).name; log(S.spring + ".", "result"); S.bracket = null; nextPhase(); }
          else if (S.step === 4) {
            S.spring = "SPRING NATIONALS CHAMPIONS"; S.trophies.push("Y" + S.year + " SPRING NATIONALS CHAMPIONS");
            log("🏆🏆 NATIONAL CHAMPIONS! " + t.name + " stands on top of Japan.", "you");
            await nationalsCeremony(nf, S.bracket[3]);
            await U.modal("NATIONAL CHAMPIONS!", "<p class='center big'>🏆</p><p>The final whistle. Confetti. Somebody is crying — it might be you. <b>" + esc(t.name) + "</b> are the best high-school team in Japan.</p>", [{ label: "CONTINUE", value: 1 }]);
            S.bracket = null; nextPhase();
          } else { S.step++; save(); render(); }
        }
      } else if (ph === "end") {
        await seasonEnd();
      }
    } finally { busy = false; }
  }
  function nextPhase() {
    if (PH[S.phase] === "ih") S.pendingEval = "MID-YEAR";
    S.phase++; S.step = 0; save(); render();
  }

  // interview answers → consequences (returns the text shown under the quote)
  function storyTone(tone, won) {
    var mates = S.squad.filter(function (id) { return id !== "you"; });
    if (tone === "humble") { S.trust = clamp(S.trust + 2, 0, 100); return "+2 COACH TRUST"; }
    if (tone === "confident") { addConf(3); return "+3 CONFIDENCE"; }
    if (tone === "fiery") { addConf(4); S.trust = clamp(S.trust - 3, 0, 100); return "+4 CONFIDENCE • -3 COACH TRUST (" + coach() + " wants less talk)"; }
    var m = pick(mates); S.bond[m] = Math.min(5, (S.bond[m] || 0) + 1); S.trust = clamp(S.trust + 1, 0, 100); addConf(1);
    return P(m).name + " BOND +1 • +1 TRUST • +1 CONFIDENCE";
  }

  // ================== CONFIDENCE ==================
  function addConf(n) { S.conf = clamp((S.conf || 50) + n, 0, 100); }
  function confBar() {
    var n = Math.round((S.conf || 50) / 10);
    return "<span class='form" + (S.conf >= 65 ? " good" : S.conf < 35 ? " bad" : "") + "'>" + "▰".repeat(n) + "▱".repeat(10 - n) + "</span>";
  }
  // confidence and chemistry nudge your timing window a little (never a big swing)
  function confAdj(line) {
    var a = ((S.conf || 50) - 50) / 1250;
    var setter = line && line.S && line.S.id !== "you" ? line.S.id : null;
    if (setter && (S.bond[setter] || 0) >= 3) a += 0.01;
    return clamp(a, -0.04, 0.05);
  }

  // ================== RIVAL ==================
  function pickRival(exclude) {
    var me = you(), fam = me.role, home = RIVAL[S.school] || "AOB", pool = [];
    [home].concat(VB.HQ_ALL.map(function (t) { return t.id; }).filter(function (id) { return id !== home && id !== S.school; })).forEach(function (tid, k) {
      var t = team(tid); if (!t) return;
      var names = Object.keys(t.players || {}).map(function (r) { return [t.players[r], VB.FAMILY[r]]; }).concat((BENCH[tid] || []).map(function (b) { return [b[0], b[1]]; }));
      names.forEach(function (nf) {
        var yr = HQ_YEARS[nf[0]];
        if (!yr || nf[0] === exclude || yr + S.year - 1 > 3) return;
        var star = Object.keys(t.players || {}).some(function (r) { return t.players[r] === nf[0] && (t.stars || {})[r]; });
        var score = (tid === home ? 6 : 0) + (nf[1] === fam ? 5 : 0) + (yr + S.year - 1 <= 2 ? 3 : 0) + (star ? 2.5 : 0) + Math.random() * 2 - (k > 3 ? 2 : 0);
        pool.push({ name: nf[0], school: tid, fam: nf[1], yr: yr, score: score });
      });
    });
    pool.sort(function (a, b) { return b.score - a.score; });
    var r = pool[0];
    S.rival = r ? { name: r.name, school: r.school, fam: r.fam, yr: r.yr, w: 0, l: 0, heat: 0, met: false } : null;
  }
  function rivalHere(foeId) { return S.rival && S.rival.school === foeId && S.rival.yr + S.year - 1 <= 3; }
  async function rivalIntro() {
    var R0 = S.rival, t = team(R0.school);
    S.rival.met = true;
    var rv = rvVoice(R0.name);
    var k = await U.modal("⚡ YOUR RIVAL", "<p>On the first weekend you watch a practice match at " + esc(t.name) + ". One player — <b>" + esc(R0.name) + "</b>, a " +
      VB.FAMILY_NAMES[R0.fam].toLowerCase() + " — makes the whole gym go quiet.</p><p>On the way out you cross paths.</p><p><b>" + esc(R0.name) + ":</b> " + esc(rv.intro) + "</p>",
      [{ label: "\"I'LL BEAT YOU.\"", value: 0 }, { label: "\"...SEE YOU ON THE COURT.\"", value: 1 }]);
    if (k === 0) { addConf(5); S.rival.heat += 2; log("You told " + R0.name + " you'll beat them. Now you have to.", "you"); }
    else { addConf(1); S.rival.heat += 1; log("You and " + R0.name + " size each other up. This isn't over.", "you"); }
  }
  function rvVoice(name) {
    return (VB.HQ_RIVAL_VOICE || {})[name] || { intro: "They look you up and down. \"So you're the one.\"", pre: "\"Don't hold back. I won't.\"", win: "\"...Next time.\"", lose: "\"Not yet. Not even close.\"", bye: "\"Catch up to me someday.\"" };
  }
  // before a match against your rival's school: a moment, a choice, a different reward
  async function rivalScene(o) {
    var R0 = S.rival, t = team(R0.school), line = ["They're waiting at the entrance.", "They're warming up right by the net.", "They catch your eye during the anthem."][Math.min(2, R0.heat)];
    var k = await U.modal("⚡ RIVAL: " + R0.name, "<p>" + esc(o.label) + " — " + esc(t.name) + ". " + line + "</p><p><b>" + esc(R0.name) + ":</b> " + esc(rvVoice(R0.name).pre) + "</p>" +
      "<p class='muted'>Record vs " + esc(R0.name) + ": " + R0.w + "W-" + R0.l + "L. Confidence " + Math.round(S.conf) + ".</p>",
      [{ label: "CHALLENGE THEM", value: "bet" }, { label: "STAY FOCUSED", value: "focus" }, { label: "ASK FOR ADVICE", value: "ask" }]);
    if (k === "focus") { addConf(2); return { kind: "focus", focus: 0.015 }; }
    if (k === "ask") {
      var a = FOCUS[you().role][0], g = addPts(a, 1.2); addConf(-1);
      log(R0.name + " gives you a pointer before the match" + (g ? " (+" + g + " " + ATTR_TXT[a] + ")" : "") + ".", "story");
      await U.modal("⚡ " + R0.name, "<p>\"" + esc(pick(TIPS)) + "\"</p><p class='muted'>Humbling. Useful.</p>" + (g ? "<p class='center gain'>+" + g + " " + ATTR_TXT[a] + "</p>" : ""));
      return { kind: "ask", focus: 0 };
    }
    log("You challenge " + R0.name + " before the match.", "you");
    return { kind: "bet", focus: 0.01 };
  }
  async function rivalAfter(bet, won, played, rating) {
    var R0 = S.rival;
    if (won) R0.w++; else R0.l++;
    R0.heat = Math.min(2, R0.heat + 1);
    var txt;
    if (bet.kind === "bet") {
      if (won) { addConf(played ? 8 : 4); txt = "You won the bet. " + R0.name + " has to shake your hand in front of everyone. +" + (VB.Gacha ? VB.Gacha.earn(500) : 0) + " 🏐 coins."; }
      else { addConf(played ? -6 : -3); txt = "You lost the bet, and " + R0.name + " makes sure you know it. That one stings."; }
    } else if (bet.kind === "focus") {
      addConf(won ? 3 : -1); txt = won ? "Calm and steady — it paid off." : "You stayed composed even in defeat.";
    } else { addConf(won ? 2 : 0); txt = won ? "You used their advice against them. They grin." : "Still a step behind. For now."; }
    if (played && rating >= 8) txt += " Your " + rating + " rating didn't go unnoticed.";
    txt += " " + R0.name + ": " + (won ? rvVoice(R0.name).win : rvVoice(R0.name).lose);
    log("⚡ vs " + R0.name + ": " + txt, "you");
    await U.modal("⚡ RIVALRY", "<p>" + esc(txt) + "</p><p class='center muted'>RECORD vs " + esc(R0.name) + ": " + R0.w + "W-" + R0.l + "L • CONFIDENCE " + Math.round(S.conf) + "</p>");
  }
  async function rivalFarewell() {
    var R0 = S.rival, old = R0.name;
    addConf(3);
    await U.modal("⚡ " + old + " GRADUATES", "<p>" + esc(old) + " finds you after their last match, eyes still red.</p><p><b>" + esc(old) + ":</b> " + esc(rvVoice(old).bye) + "</p>" +
      "<p class='muted'>Final record: " + R0.w + "W-" + R0.l + "L.</p>");
    log(old + " graduates — the rivalry ends " + R0.w + "-" + R0.l + ".", "you");
    S.year++; pickRival(old); S.year--;                    // the next rival is someone still around next year
    if (S.rival) { S.rival.met = true; log("A new rival emerges: " + S.rival.name + " (" + team(S.rival.school).name + ").", "you"); }
  }

  // ================== TEAMMATES ==================
  var TALK = {
    HINATA: ["\"Did you see that jump?! Again, again!\"", "\"I want to beat everyone. Even you!\""], KAGEYAMA: ["\"Your approach was late. Fix it.\"", "\"...Want to toss a few after practice?\""],
    TSUKISHIMA: ["\"It's just a club. ...But don't get blocked, it's embarrassing.\""], NISHINOYA: ["\"Leave the back row to me! You just hit!\""], TANAKA: ["\"OSSU! Let's eat after this!\""],
    SAWAMURA: ["\"Good team, good food. That's all we need.\""], SUGAWARA: ["\"Don't mind! The next one's yours.\""], AZUMANE: ["\"I-I'll take the hard balls. Promise.\""],
    OIKAWA: ["\"Six strong players beat one genius. Remember that.\""], IWAIZUMI: ["\"Hit through the block. Don't think, swing.\""], KYOTANI: ["\"...Tch. Fine. You're not bad.\""],
    USHIJIMA: ["\"Strength is simple. Train.\""], TENDO: ["\"Guess right and the whole gym is yours~\""], GOSHIKI: ["\"I'll be the ace after Ushijima-san!\""], SHIRABU: ["\"Hit what I give you.\""],
    ATSUMU: ["\"Nice serve's a weapon. Make 'em fear yours.\""], OSAMU: ["\"Practice, then onigiri. That's the order.\""], SUNA: ["\"...Just tilt your body. Easy.\""],
    KENMA: ["\"...If we lose, we just try another strategy.\""], KUROO: ["\"Blocking's a game of patience. Annoy them.\""], LEV: ["\"I'm going to be the ace of Nekoma!\""], YAKU: ["\"Receive. Practice. Now.\""], TAKETORA: ["\"YEAAAH! Let's GO!\""],
    BOKUTO: ["\"HEY HEY HEY! Spike with me!\""], AKAASHI: ["\"Bokuto-san works best when he's having fun. So do you.\""], KONOHA: ["\"Being good at everything is underrated.\""],
    SAKUSA: ["\"Wash your hands. Then we'll talk receive.\""], KOMORI: ["\"Cousin's a clean freak, ignore him!\""], IIZUNA: ["\"A setter's job is to make hitters look great.\""],
    HOSHIUMI: ["\"Height isn't everything. I'll prove it.\""], HIRUGAMI: ["\"Play your game. Calmly.\""], FUTAKUCHI: ["\"Don't let Aone scare you. He's nice.\""], AONE: ["(...a silent, firm nod)"],
    TERUSHIMA: ["\"Volleyball's supposed to be FUN, right?\""], DAISHO: ["\"Don't be too honest on court. Feint.\""], KIRYU: ["\"Hit it with everything. Every time.\""]
  };
  var GENERIC = ["\"Ramen after practice?\"", "\"Your serve's getting scary.\"", "\"We'll get them next time.\"", "\"Can you help me with receive drills?\"", "\"I believe in this team. In you too.\""];
  var SPOTS = ["the convenience store", "the river bank", "a ramen shop", "the school roof", "the gym after hours", "the station on the way home"];
  function hangDone() { return S.hangAt === S.year + "-" + S.phase; }
  async function hangOut(id) {
    if (hangDone() || !P(id)) return;
    var p = P(id), b = (S.bond[id] || 0);
    S.hangAt = S.year + "-" + S.phase;
    S.bond[id] = Math.min(5, b + 1);
    addConf(2); S.trust = clamp(S.trust + 1, 0, 100);
    var line = pick((VB.HQ_TALK || {})[p.name] || TALK[p.name] || VB.HQ_GENERIC_TALK || GENERIC), bonus = "";
    if (S.bond[id] === 3) bonus = p.role === "S" ? "CHEMISTRY: when " + p.name + " sets, you get a little lift in matches." : "You and " + p.name + " are real friends now.";
    if (S.bond[id] === 5) { var g = addPts(FOCUS[you().role][0], 1.5); bonus = "Best friends. You push each other every day" + (g ? " (+" + g + " " + ATTR_TXT[FOCUS[you().role][0]] + ")" : "") + "."; }
    log("Hung out with " + p.name + " at " + pick(SPOTS) + ".", "story");
    await U.modal("🤝 " + p.name, "<p>You and " + esc(p.name) + " (" + yearTxt(S.years[id]) + ") hang out at " + esc(pick(SPOTS)) + ".</p><p>" + esc(line) + "</p>" +
      "<p class='center'><span class='bond'>" + "♥".repeat(S.bond[id]) + "</span> BOND " + S.bond[id] + "/5 • CONFIDENCE " + Math.round(S.conf) + "</p>" + (bonus ? "<p class='center gain'>" + esc(bonus) + "</p>" : ""));
  }

  // ================== CEREMONIES ==================
  function avgRating(natOnly) {
    var l = ((S.rt || {})[S.year] || []).filter(function (x) { return !natOnly || x.nat; });
    return l.length ? l.reduce(function (a, x) { return a + x.r; }, 0) / l.length : 0;
  }
  function award(p, title, line) {
    var t = school();
    if (p.id === "you") { (S.awards = S.awards || []).push("Y" + S.year + " " + title); log("🏅 You win " + title + "!", "you"); }
    return { title: title, name: p.name, team: t.flag + " " + t.name, kit: t.kit, kit2: t.kit2, teamId: t.id, face: p.face, line: line, you: p.id === "you" };
  }
  function podTeam(id, line) {
    var t = team(id);
    return { id: id, name: t.name, kit: t.kit, kit2: t.kit2, faces: VB.ROLES.map(function (r) { return line[r].face; }) };
  }
  async function nationalsCeremony(finalFoe, semiFoe) {
    var mine = myLineup(false), me = you(), list = [];
    var nr = avgRating(true), starters = VB.ROLES.map(function (r) { return mine[r]; });
    var mvp = keyOf(mine) && nr >= 7.6 ? me : starters.filter(function (p) { return p.id !== "you"; }).sort(function (a, b) { return ovr(b) - ovr(a); })[0];
    list.push(award(mvp, "SPRING NATIONALS MVP", mvp.id === "you" ? "AVG RATING " + nr.toFixed(1) + " AT NATIONALS" : "OVR " + ovr(mvp)));
    if (keyOf(mine) && mvp.id !== "you" && nr >= 6.8) list.push(award(me, "BEST " + VB.FAMILY_NAMES[me.role], "AVG RATING " + nr.toFixed(1) + " AT NATIONALS"));
    await VB.Ceremony.play({ title: "SPRING NATIONALS", sub: "YEAR " + S.year + " • TOKYO", awards: list,
                             podium: [podTeam(S.school, mine), podTeam(finalFoe, oppDef(finalFoe).lineup)].concat(semiFoe ? [podTeam(semiFoe, oppDef(semiFoe).lineup)] : []) });
  }
  async function awardsNight() {
    var ps = S.squad.map(P), line = myLineup(false), me = you(), list = [], ys = S.yStart || S.lastEval || {};
    var starters = VB.ROLES.map(function (r) { return line[r]; });
    var ar = avgRating(false), myGames = ((S.rt || {})[S.year] || []).length;
    var mvp = keyOf(line) && myGames >= 3 && ar >= 7.8 ? me : starters.filter(function (p) { return p.id !== "you"; }).sort(function (a, b) { return ovr(b) - ovr(a); })[0];
    list.push(award(mvp, "TEAM MVP", mvp.id === "you" ? "AVG RATING " + ar.toFixed(1) + " IN " + myGames + " MATCHES" : "OVR " + ovr(mvp) + " • " + yearTxt(S.years[mvp.id])));
    var imp = ps.filter(function (p) { return ys[p.id] != null; }).sort(function (a, b) { return (ovr(b) - ys[b.id]) - (ovr(a) - ys[a.id]); })[0];
    if (imp) list.push(award(imp, "MOST IMPROVED", "OVR " + ys[imp.id] + " → " + ovr(imp) + " THIS YEAR"));
    var rook = ps.filter(function (p) { return S.years[p.id] === 1; }).sort(function (a, b) { return ovr(b) - ovr(a); })[0];
    if (rook) list.push(award(rook, "ROOKIE OF THE YEAR", "OVR " + ovr(rook) + " AS A FIRST-YEAR"));
    var spirit = S.trust >= 60 ? me : pick(ps.filter(function (p) { return p.id !== "you"; }));
    list.push(award(spirit, "FIGHTING SPIRIT AWARD", spirit.id === "you" ? "COACH TRUST " + Math.round(S.trust) : "THE LOUDEST VOICE ON THE BENCH"));
    await VB.Ceremony.play({ title: school().name + " AWARDS NIGHT", awards: list });
  }

  // ================== EVALUATIONS (twice a year) ==================
  function grade(o) {
    var d = o - school().ovr;
    return d >= 3 ? "S" : d >= 0 ? "A" : d >= -3 ? "B" : d >= -7 ? "C" : "D";
  }
  function snapEval() { S.lastEval = {}; S.squad.forEach(function (id) { S.lastEval[id] = ovr(P(id)); }); }
  async function evaluation(kind) {
    // teammates develop over each half-year too
    S.squad.forEach(function (id) {
      if (id === "you") return;
      var p = P(id), yf = S.years[id] === 1 ? 2 : 1;
      VB.ATTRS.forEach(function (a) { p[a] = Math.min(99, p[a] + VB.irnd(0, yf)); });
    });
    var last = S.lastEval || {}, line = myLineup(false), starters = {};
    VB.ROLES.forEach(function (r) { starters[line[r].id] = 1; });
    var rows = S.squad.map(P).sort(function (a, b) { return ovr(b) - ovr(a); }).map(function (p) {
      var o = ovr(p), d = last[p.id] != null ? o - last[p.id] : null, g = grade(o);
      return "<tr class='" + (p.id === "you" ? "you" : "") + "'><td>" + esc(p.name) + "</td><td>" + p.role + "</td><td>" + S.years[p.id] + "</td><td>" + o + "</td><td>" +
        (d == null ? "NEW" : d > 0 ? "<span class='gain'>▲" + d + "</span>" : d < 0 ? "▼" + (-d) : "—") + "</td><td><b class='grade g" + g + "'>" + g + "</b></td><td>" + (starters[p.id] ? "START" : "") + "</td></tr>";
    }).join("");
    var me = you(), dm = last.you != null ? ovr(me) - last.you : 0;
    var note = dm >= 3 ? pick(["\"You've grown more than anyone on this team. ...Don't let it go to your head.\"", "\"I've been coaching a long time. Kids like you are why I keep doing it. Keep going.\""]) :
               dm >= 1 ? pick(["\"Steady. Good. Now show me in a match — practice heroes don't win sets.\"", "\"You're getting there. 'Getting there' doesn't win Nationals, though.\""]) :
               "\"You've stalled. A wall isn't a bad thing — it means you've climbed high enough to hit one. Work on your " + ATTR_TXT[S.focus].toLowerCase() + ".\"";
    snapEval();
    log(kind + " evaluation: OVR " + ovr(me) + " (" + (dm >= 0 ? "+" : "") + dm + "), grade " + grade(ovr(me)) + ".", "you");
    await U.modal(kind + " PLAYER EVALUATION", "<p>" + esc(coach()) + " posts the evaluation sheet on the club-room wall.</p>" +
      "<table class='standings'><tr><th>PLAYER</th><th>POS</th><th>YR</th><th>OVR</th><th>±</th><th>GRADE</th><th></th></tr>" + rows + "</table>" +
      "<p>" + esc(coach()) + " to you: " + esc(note) + "</p><p class='muted'>Grades compare each player to the team's level: S A B C D.</p>",
      [{ label: "CONTINUE", value: 1 }]);
    // every evaluation (year-end always, mid-year with an A or S): pick a PlayStyle to build your game around
    var gr = grade(ovr(me));
    if (kind === "YEAR-END" || gr === "S" || gr === "A") await storyPlayStyle();
  }

  async function storyPlayStyle() {
    var me = you(), own = me.ps = me.ps || {}, n = Object.keys(own).length;
    var fresh = n < 3 ? shuffle(VB.psFor(me.role).filter(function (id) { return !own[id]; })).slice(0, 3) : [];
    var ups = Object.keys(own).filter(function (id) { return own[id] < 2; });
    var opts = fresh.map(function (id) { return { id: id, up: false }; }).concat(ups.map(function (id) { return { id: id, up: true }; })).slice(0, 4);
    if (!opts.length) return;
    var k = await U.modal("🎓 PLAYSTYLE", "<p>" + esc(coach()) + ": \"Every player needs something that's theirs. Pick what you'll drill until it's second nature.\"</p><ul>" +
      opts.map(function (o) { var d = VB.PS[o.id]; return "<li><b>" + d.icon + " " + d.name + (o.up ? "+" : "") + "</b> — " + esc(d.txt) + (o.up ? " (upgrade)" : "") + "</li>"; }).join("") + "</ul>" +
      "<p class='muted'>You can hold 3 PlayStyles; later evaluations can upgrade them to +.</p>",
      opts.map(function (o, i) { var d = VB.PS[o.id]; return { label: d.icon + " " + d.name + (o.up ? "+" : ""), value: i }; }));
    var c = opts[k]; own[c.id] = c.up ? 2 : 1;
    log("🎓 New PlayStyle: " + VB.PS[c.id].icon + " " + VB.PS[c.id].name + (own[c.id] > 1 ? "+" : "") + ".", "you");
    save();
  }

  // ================== RANDOM EVENTS (keep the year from feeling the same) ==================
  function mate(fam) {
    var l = myLineup(false), r = VB.ROLES.find(function (k) { return VB.FAMILY[k] === fam && l[k].id !== "you"; });
    return r ? l[r].name : "your senpai";
  }
  function senior() {
    var c = S.squad.map(P).filter(function (p) { return p.id !== "you" && S.years[p.id] === 3; }).sort(function (a, b) { return ovr(b) - ovr(a); })[0];
    return c ? c.name : mate("OH");
  }
  function coins(n) { return VB.Gacha ? VB.Gacha.earn(n) : 0; }
  function rivalStar() {
    if (S.rival && S.rival.yr + S.year - 1 <= 3 && Math.random() < 0.6) return { name: S.rival.name, school: team(S.rival.school).name, fam: S.rival.fam };
    var list = [];
    VB.HQ_ALL.forEach(function (t) {
      if (t.id === S.school) return;
      Object.keys(t.players || {}).forEach(function (r) { var n = t.players[r]; if (HQ_YEARS[n] && HQ_YEARS[n] + S.year - 1 <= 3) list.push({ name: n, school: t.name, fam: VB.FAMILY[r] }); });
    });
    return list.length ? pick(list) : null;
  }
  var TIPS = ["Explode on your last two approach steps.", "Watch the hitter's shoulders, not the ball.", "Talk on the court. Quiet teams lose close sets.",
              "Hit the ball at the very top of your jump. Always.", "A good pass is boring. Be boring.", "Don't fear the block — use it."];
  var EVENTS = [
    function () { return { title: "NIGHT PRACTICE", html: "<p>Everyone has gone home, but " + esc(mate("S")) + " is still in the gym with a cart of balls. \"A few more?\"</p>",
      choices: [{ label: "STAY", run: async function () { var r = await drill(S.focus, "NIGHT PRACTICE"); return r.g ? "+" + r.g + " " + ATTR_TXT[S.focus] + ". Your arms are jelly, but it was worth it." : "Your arms are jelly. Tomorrow it'll click."; } },
                { label: "GO HOME & REST", run: async function () { S.trust += 1; return "You sleep nine hours. Coach notices how sharp you look the next morning."; } }] }; },
    function () { return { title: "EXAM WEEK", html: "<p>Fail a test and you'll miss the next trip. The vice-captain is handing out study notes.</p>",
      choices: [{ label: "STUDY HARD", run: async function () { S.trust += 2; return "You pass everything. Barely. Nobody has to sit remedial classes."; } },
                { label: "SNEAK INTO THE GYM", run: async function () {
                  if (Math.random() < 0.5) { var g = addPts(S.focus, 2); return "You sneak in reps AND scrape a pass." + (g ? " +" + g + " " + ATTR_TXT[S.focus] + "." : ""); }
                  S.trust -= 5; return "Red marks everywhere. Remedial classes — and a long lecture from " + coach() + "."; } }] }; },
    function () { var rv = rivalStar(); if (!rv) return null; return { title: "RIVAL SIGHTING", html: "<p>At the convenience store you bump into <b>" + esc(rv.name) + "</b> from " + esc(rv.school) + ".</p>",
      choices: [{ label: "ASK FOR ADVICE", run: async function () { var a = FOCUS[you().role][0], g = addPts(a, 1.4); return rv.name + ": \"" + pick(TIPS) + "\"" + (g ? " (+" + g + " " + ATTR_TXT[a] + ")" : ""); } },
                { label: "CHALLENGE THEM", run: async function () { var r = await drill("srv", "SERVE-OFF vs " + rv.name);
                  if (r.q >= 0.5) { S.trust += 2; return "You win the serve-off! " + rv.name + " buys the meat buns. +" + coins(500) + " 🏐 coins."; }
                  return rv.name + " laughs: \"Come back when you can hit the target.\""; } }] }; },
    function () { return { title: "MEAT BUNS", html: "<p>After a brutal practice the team stops at the little store by the gym. " + esc(senior()) + " slaps a bag of meat buns on the counter: \"My treat. Eat, first-years. You look like ghosts.\"</p>",
      choices: [{ label: "\"THANKS, SENPAI!\"", run: async function () { S.trust += 2; return "Steam, salt and laughter on the walk home. Team spirit is up. +" + coins(300) + " 🏐 coins."; } }] }; },
    function () { return { title: "PENALTY DIVES", html: "<p>Lost practice set. The rule at summer camp: everyone on the losing side does a flying-fall dive the length of the court. " + esc(mate("L")) + " is already grinning.</p>",
      choices: [{ label: "DIVE LIKE YOU MEAN IT", run: async function () { var r = await drill("def", "PENALTY DIVES"); return r.q >= 0.6 ? "Perfect rolls, chest to the floor. The libero gives you a thumbs-up. +" + (r.g || 0) + " DEFENCE." : "You land like a dropped futon. Everyone laughs — including you."; } },
                { label: "DIVE, THEN DO EXTRA", run: async function () { S.trust += 2; addConf(2); return "You do the dives, then ten more. Nobody says anything, but everyone saw."; } }] }; },
    function () { var m = S.squad.map(P).filter(function (p) { return p.id !== "you"; }); var q = m.length ? pick(m) : null; if (!q) return null;
      return { title: "\"IT'S JUST A CLUB\"", html: "<p>On the walk home, " + esc(q.name) + " goes quiet. \"...Why do we try this hard? It's just a club. We're not going pro.\"</p>",
      choices: [{ label: "\"BECAUSE OF THAT MOMENT.\"", run: async function () { S.bond[q.id] = Math.min(5, (S.bond[q.id] || 0) + 1); addConf(2); return "\"The moment the ball drops on their side and the whole gym explodes. ...That's why.\" " + q.name + " doesn't answer — but shows up early the next morning."; } },
                { label: "\"IT'S FINE TO WONDER.\"", run: async function () { S.bond[q.id] = Math.min(5, (S.bond[q.id] || 0) + 1); return "You walk the rest of the way without talking. Somehow that's enough."; } }] }; },
    function () { if (S.school !== "KAR" && S.school !== "NEK") return null; var other = S.school === "KAR" ? "NEKOMA" : "KARASUNO";
      return { title: "THE GARBAGE DUMP BATTLE", html: "<p>An old poster in the clubroom: crows versus cats. \"" + other + "\" — the rivalry the old coaches started decades ago. One day it'll be played on the national stage.</p>",
      choices: [{ label: "\"WE'LL MAKE IT HAPPEN.\"", run: async function () { addConf(4); return "You tape the poster back up. A promise is a promise."; } }] }; },
    function () { if (S.school !== "KAR") return null;
      return { title: "TANAKA'S SISTER", html: "<p>The bus to Tokyo leaves without the two players who had remedial exams. Tanaka's older sister pulls up in a van, sunglasses on: \"Get in. We're going to Tokyo.\"</p>",
      choices: [{ label: "GET IN THE VAN", run: async function () { addConf(3); return "The fastest, loudest, most terrifying drive of your life. You arrive in time for the second set. +" + coins(500) + " 🏐 coins."; } }] }; },
    function () { return { title: "THE BANNER", html: "<p>The managers unfold the team banner for the first time this season. Big characters: <b>「 " + esc(voice().motto || "FIGHT") + " 」</b>.</p>",
      choices: [{ label: "READ IT OUT LOUD", run: async function () { addConf(3); S.trust += 1; return "The whole team shouts it back. The old gym windows rattle."; } }] }; },
    function () { return { title: "FAN LETTER", html: "<p>There's a letter in your shoe locker: \"I saw your last match. Please keep playing!\"</p>",
      choices: [{ label: "SMILE", run: async function () { return "You read it three times on the way home. +" + coins(1000) + " 🏐 coins."; } }] }; },
    function () { return { title: "ANKLE TWEAK", html: "<p>You land on someone's foot during a block drill. It hurts — but not that much?</p>",
      choices: [{ label: "REST IT", run: async function () { return "Two easy days with ice. Nothing lost."; } },
                { label: "TAPE IT & PLAY", run: async function () {
                  if (Math.random() < 0.35) { you().def = Math.max(30, you().def - 1); you().rec = Math.max(30, you().rec - 1); return "It swells up. You lose a little sharpness (-1 DEF, -1 REC)."; }
                  S.trust += 3; return "It holds. " + coach() + " respects the grit."; } }] }; },
    function () { return { title: "NEIGHBOURHOOD ASSOCIATION", html: "<p>The local adults' team needs one more player tonight. Their old setter still has magic hands.</p>",
      choices: [{ label: "PLAY WITH THEM", run: async function () { var r = await drill("rec", "PASSING vs THE ADULTS"); return r.g ? "Great reps. +" + r.g + " " + ATTR_TXT.rec + "." : "They run you ragged. Good lesson."; } },
                { label: "JUST WATCH", run: async function () { var g = addPts(you().role === "S" ? "set" : "att", 0.8); return "You pick up a couple of veteran tricks" + (g ? " (+" + g + ")" : "") + "."; } }] }; },
    function () { return { title: "SUMMER FESTIVAL", html: "<p>The whole team is going to the festival tonight. Fireworks, takoyaki, goldfish scooping.</p>",
      choices: [{ label: "GO WITH THE TEAM", run: async function () { S.trust += 1; return "A team photo you'll keep forever. +" + coins(500) + " 🏐 coins."; } },
                { label: "SHADOW PRACTICE", run: async function () { var g = addPts(S.focus, 1.2); return "You practise footwork alone by the river" + (g ? " (+" + g + " " + ATTR_TXT[S.focus] + ")" : "") + "."; } }] }; },
    function () { return { title: "SERVE CHALLENGE", html: "<p>" + esc(coach()) + " puts a towel on the floor in zone 1. \"Three serves. Hit it.\"</p>",
      choices: [{ label: "TAKE THE CHALLENGE", run: async function () {
        var hits = 0;
        for (var i = 0; i < 3; i++) { var r = await drill("srv", "TOWEL SERVE " + (i + 1) + "/3"); if (r.q >= 0.5) hits++; }
        S.trust += hits; return hits + "/3 on the towel. +" + coins(200 + 300 * hits) + " 🏐 coins."; } }] }; },
    function () { return { title: "VIDEO NIGHT", html: "<p>" + esc(coach()) + " wheels in a TV with tapes of the next opponents.</p>",
      choices: [{ label: "TAKE NOTES", run: async function () { S.trust += 2; var g = addPts("def", 0.9); return "You spot their favourite shot" + (g ? " (+" + g + " DEF)" : "") + "."; } }] }; }
  ];
  async function randomEvent() {
    var ev = null;
    for (var i = 0; i < 6 && !ev; i++) ev = pick(EVENTS)();
    if (!ev) return;
    var k = await U.modal("✦ " + ev.title, ev.html, ev.choices.map(function (c, j) { return { label: c.label, value: j }; }));
    var out = await ev.choices[k].run();
    S.trust = clamp(S.trust, 0, 100);
    log(ev.title + ": " + out, "story");
    await U.modal("✦ " + ev.title, "<p>" + esc(out) + "</p>", [{ label: "CONTINUE", value: 1 }]);
  }

  async function seasonEnd() {
    await evaluation("YEAR-END");
    await awardsNight();
    var t = school(), line = S.stats[S.year] || VB.Stats.newLine(), me = you();
    var rec = { year: S.year, ovr: ovr(me), ih: S.ih || "—", spring: S.spring || "—", line: VB.Stats.lineText(line), mp: line.mp || 0 };
    S.history.push(rec);
    var grads = S.squad.filter(function (id) { return id !== "you" && S.years[id] >= 3; });
    var html = "<p><b>" + yearTxt(S.year) + " IN REVIEW</b></p><ul><li>INTERHIGH: " + esc(rec.ih) + "</li><li>SPRING: " + esc(rec.spring) + "</li>" +
      "<li>YOU: OVR " + rec.ovr + " • " + esc(rec.line) + " • " + rec.mp + " MATCHES PLAYED • CONFIDENCE " + Math.round(S.conf) + "</li>" +
      (S.rival ? "<li>RIVAL " + esc(S.rival.name) + " (" + esc(team(S.rival.school).name) + "): " + S.rival.w + "W-" + S.rival.l + "L vs you</li>" : "") + "</ul>";
    if (S.rival && S.year < 3 && S.rival.yr + S.year > 3) await rivalFarewell();
    if (S.year === 3) {
      html += endingHTML();
      S.ts = { stage: 0 }; S.year = 4; S.phase = 0; S.step = 0; save();
      await U.modal("GRADUATION", html + "<p class='center gain'>...but the story isn't over. ⏩ TIMESKIP unlocked.</p>", [{ label: "FIVE YEARS LATER ▸", value: 1 }]);
      return render();
    }
    // graduation, growth of the rest, recruits
    S.lastGrads = grads.map(function (id) { return P(id).name; }).join(", ");
    grads.forEach(function (id) { delete S.players[id]; delete S.years[id]; delete S.slotOf[id]; });
    S.squad = S.squad.filter(function (id) { return grads.indexOf(id) < 0; });
    S.squad.forEach(function (id) {
      S.years[id]++;
      var p = P(id); p.age++;
      if (id === "you") return;
    });
    var before = S.squad.length;
    fillSquad(t, 3);
    var recruits = S.squad.slice(before).map(function (id) { return P(id).name; });
    // off-season training: your focus
    var off = addPts(S.focus, 3 * room()) ;
    S.year++; S.phase = 0; S.step = 0; S.ih = null; S.spring = null; S.springOut = false; S.mentorDone = false;
    if (S.year === 3 && (S.trust >= 55 || ovr(me) >= t.ovr)) { S.captain = true; log("The team names you CAPTAIN for your final year.", "you"); }
    log("Graduated: " + (S.lastGrads || "nobody") + ". New first-years: " + recruits.join(", ") + ".", "story");
    html += "<p>The third-years graduate: <b>" + esc(S.lastGrads || "nobody") + "</b>. Somebody hands you a towel and says thanks for everything.</p>" +
      "<p>New first-years arrive: " + esc(recruits.join(", ") || "—") + ".</p>" +
      (off ? "<p class='center gain'>OFF-SEASON TRAINING: +" + off + " " + ATTR_TXT[S.focus] + "</p>" : "") +
      (S.captain && S.year === 3 ? "<p class='center gain'>★ YOU ARE THE NEW CAPTAIN</p>" : "");
    save();
    await U.modal("SEASON OVER", html, [{ label: "ON TO " + yearTxt(S.year), value: 1 }]);
    render();
  }
  function endingHTML() {
    var o = ovr(you()), champs = S.trophies.length, tr = S.trophies.join(", ");
    var title, txt;
    if (o >= 82 || S.trophies.some(function (x) { return /SPRING/.test(x); }) && o >= 78) {
      title = "STRAIGHT TO THE PROS"; txt = "SV.League scouts were in the stands all spring. You sign your first professional contract before graduation day.";
    } else if (o >= 77 || champs) {
      title = "UNIVERSITY ACE"; txt = "A top university offers you a place on their team. The national youth coach has your name on a list.";
    } else if (o >= 72) {
      title = "STILL CLIMBING"; txt = "You keep playing at university. You're not done — the small giant inside you is just getting started.";
    } else {
      title = "THE ONE WHO LOVED THE GAME"; txt = "You never became the star, but every weekend you're back in a gym somewhere, chasing the ball you could never quite let fall.";
    }
    S.endTitle = title;
    return "<h3 class='center'>" + esc(title) + "</h3><p>" + esc(txt) + "</p><p class='center'>FINAL OVR " + o + " (started at " + S.startOvr + ")" +
      (tr ? "<br/>🏆 " + esc(tr) : "") + "</p>";
  }

  // ================== THE NEWSPAPER (every other week) ==================
  var PAPERS = ["VOLLEYBALL MONTHLY", "HIGH-SCHOOL VOLLEY WEEKLY", "THE SPIKE TIMES"];
  function scoreTxt(g) { return g.bo > 1 ? g.sw + "-" + g.sl + " (" + g.sets.map(function (x) { return x[0] + "-" + x[1]; }).join(", ") + ")" : g.sets[0][0] + "-" + g.sets[0][1]; }
  function paperGames() {
    var ids = shuffle(VB.HQ_ALL.map(function (t) { return t.id; }).filter(function (id) { return id !== S.school; })), games = [];
    for (var i = 0; i + 1 < ids.length && games.length < 7; i += 2) {
      var A = oppDef(ids[i]), B = oppDef(ids[i + 1]), bo = Math.random() < 0.55 ? 3 : 1, r = VB.Stats.simSets(A, B, bo);
      var aw = r.a > r.b, W = aw ? A : B, L = aw ? B : A, sets = r.sets.map(function (x) { return aw ? x : [x[1], x[0]]; });
      var interest = 0, kind = "win", gap = L.ovr - W.ovr;
      if (gap >= 2) { interest += gap * 1.6; kind = "upset"; }
      if (bo === 3 && sets[0][0] < sets[0][1]) { interest += 4; kind = kind === "upset" ? "upcomeback" : "comeback"; }
      if (Math.max.apply(null, sets.map(function (x) { return Math.max(x[0], x[1]); })) >= 18) { interest += 2.5; if (kind === "win") kind = "thriller"; }
      if (kind === "win" && sets.every(function (x) { return x[0] - x[1] >= 6; })) { interest += 1; kind = "rout"; }
      if (S.rival && (A.id === S.rival.school || B.id === S.rival.school)) interest += 1.5;
      var star = null, best = -1;
      VB.ROLES.forEach(function (q) { var l = r.stats[W.lineup[q].id]; if (l) { var pt = l.k + l.ace + l.blk; if (pt > best) { best = pt; star = l; } } });
      games.push({ w: W.name, l: L.name, sets: sets, bo: bo, sw: aw ? r.a : r.b, sl: aw ? r.b : r.a, kind: kind, interest: interest + Math.random(),
                   star: star ? { name: star.name, k: star.k, blk: star.blk, ace: star.ace } : null });
    }
    return games.sort(function (a, b) { return b.interest - a.interest; });
  }
  function story(g) {
    var H = {
      upset: [g.w + " STUN " + g.l + "!", "GIANT-KILLERS: " + g.w + " TOPPLE " + g.l],
      upcomeback: ["FROM A SET DOWN, " + g.w + " SHOCK " + g.l + "!", "THE COMEBACK OF THE SEASON: " + g.w + " OVER " + g.l],
      comeback: [g.w + " RISE FROM A SET DOWN vs " + g.l, "NEVER SAY DIE: " + g.w + " TURN IT AROUND"],
      thriller: ["DEUCE! DEUCE! DEUCE! " + g.w + " EDGE " + g.l, g.w + " SURVIVE A MARATHON vs " + g.l],
      rout: [g.w + " FLATTEN " + g.l, "TOTAL CONTROL: " + g.w + " CRUISE"],
      win: [g.w + " TAKE CARE OF " + g.l, g.w + " BEAT " + g.l]
    }[g.kind];
    var B = {
      upset: "Nobody gave them a chance. " + g.w + " out-served and out-hustled the favourites " + scoreTxt(g) + ".",
      upcomeback: "Down a set to the favourites, " + g.w + " refused to fold and won " + scoreTxt(g) + ". The gym was shaking.",
      comeback: g.l + " took the first set, then " + g.w + " found another gear: " + scoreTxt(g) + ".",
      thriller: "Neither side would let the ball drop. " + g.w + " finally closed it out " + scoreTxt(g) + ".",
      rout: g.w + " were in a different league today: " + scoreTxt(g) + ".",
      win: g.w + " won " + scoreTxt(g) + "."
    }[g.kind];
    var st = g.star ? " " + g.star.name + " led the way with " + (g.star.k + g.star.ace + g.star.blk) + " points (" + g.star.k + " kills, " + g.star.blk + " blocks, " + g.star.ace + " aces)." : "";
    return { h: pick(H), b: B + st };
  }
  async function newspaper() {
    var gs = paperGames(), mine = S.log.find(function (n) { return n.tag === "result"; });
    var p = { no: (S.papers || []).length + 1, wk: S.week, y: S.year, title: pick(PAPERS), lead: story(gs[0]), side: gs.slice(1, 3).map(story),
              results: gs.slice(3).map(function (g) { return g.w + " def. " + g.l + " " + scoreTxt(g); }),
              you: mine && mine.t !== S.paperSeen ? mine.t : null };
    if (mine) S.paperSeen = mine.t;
    S.papers = [p].concat(S.papers || []).slice(0, 12);
    log("📰 " + p.title + " #" + p.no + ": " + p.lead.h, "story");
    await U.modal("📰 THE PAPER IS OUT", paperHTML(p), [{ label: "FOLD THE PAPER", value: 1 }]);
  }
  function paperHTML(p) {
    return "<div class='paper'><div class='paper-mast'>" + esc(p.title) + "</div><div class='paper-sub'>ISSUE #" + p.no + " • " + yearTxt(p.y) + " • WEEK " + p.wk + "</div>" +
      "<div class='paper-lead'><h3>" + esc(p.lead.h) + "</h3><p>" + esc(p.lead.b) + "</p></div>" +
      "<div class='paper-cols'>" + p.side.map(function (x) { return "<div><h4>" + esc(x.h) + "</h4><p>" + esc(x.b) + "</p></div>"; }).join("") + "</div>" +
      (p.you ? "<div class='paper-you'><b>AROUND " + esc(school().name) + ":</b> " + esc(p.you) + "</div>" : "") +
      (p.results.length ? "<div class='paper-res'><b>OTHER RESULTS:</b> " + p.results.map(esc).join(" • ") + "</div>" : "") + "</div>";
  }
  function newsHTML() {
    return (S.papers || []).length ? S.papers.map(paperHTML).join("") : "<p class='muted center'>The first issue comes out in a couple of weeks.</p>";
  }

  // ================== CAMEOS & CUSTOM TEAMS ==================
  function canonFace(name, ts) {
    var C = VB.Gacha ? VB.Gacha.cards : [], sk = VB.skinFace && VB.skinFace(name);
    var c = (ts && C.find(function (x) { return x.id === "TS-" + name; })) || C.find(function (x) { return x.id === name; });
    return sk || (c ? JSON.parse(JSON.stringify(c.face)) : null);
  }
  var MY_SLOT = { S: "S", OH: "OH1", MB: "MB1", OP: "OP", L: "L" };
  // o: { id, name, kit, kit2, ovr, players: { role: name }, stars, ts, pro }
  function customTeam(o, withYou) {
    var t = { id: o.id, name: o.name, nat: "JPN", ages: o.pro ? [22, 27] : [16, 18], heightAdj: o.pro ? 0 : -9, ovr: o.ovr, players: {}, stars: o.stars || {} };
    VB.ROLES.forEach(function (r) { if (o.players[r]) t.players[r] = o.players[r]; });
    var line = VB.teamLineup(t, {});
    VB.ROLES.forEach(function (r) { var f = o.players[r] && canonFace(o.players[r], o.ts); if (f) line[r].face = f; });
    if (withYou) line[MY_SLOT[you().role]] = you();
    return { id: o.id, name: o.name, short: o.name, flag: "🏐", kit: o.kit, kit2: o.kit2, ovr: o.ovr, play: o.play || "balanced", lineup: line };
  }
  async function customMatch(mine, foe, o) {
    U.showView("match");
    $("recordLine").textContent = o.record || o.label;
    var key = VB.ROLES.find(function (r) { return mine.lineup[r] && mine.lineup[r].id === "you"; });
    var res = await VB.Engine.playMatch({ mine: mine, foe: foe, homeSide: 0, mode: "role", myRole: key, label: o.label + (o.bestOf > 1 ? " • BEST OF 3" : ""), league: o.league || "EXHIBITION",
                                          bestOf: o.bestOf || 1, floor: o.floor || "wood", confAdj: ((S.conf || 50) - 50) / 400 });
    U.showView("hub");
    var lineSt = res.stats.you, rating = VB.Stats.rating(lineSt, you().role, res.won);
    var before = ovr(you()), gains = grow(rating), after = ovr(you());
    addConf((rating - 6.5) * 3 + (res.won ? 1.5 : -1.5));
    log((res.won ? "W " : "L ") + res.score[0] + "-" + res.score[1] + " vs " + foe.name + " (" + o.label + ") — rating " + rating + ".", "result");
    await U.modal(res.won ? "WIN" : "LOSS",
      "<p class='center big'>" + esc(mine.name + " " + res.score[0] + " : " + res.score[1] + " " + foe.name) + "</p>" +
      (res.sets && res.sets.length > 1 ? "<p class='center muted'>SETS " + res.sets.map(function (x) { return x[0] + "-" + x[1]; }).join(", ") + "</p>" : "") +
      "<p class='center'>YOUR RATING: <b class='rating'>" + rating + "</b> / 10</p><p class='center'>" + esc(VB.Stats.lineText(lineSt)) + "</p>" +
      (gainTxt(gains) ? "<p class='center gain'>GROWTH: " + esc(gainTxt(gains)) + "</p>" : "") + (after > before ? "<p class='center gain'>OVR " + before + " → " + after + "</p>" : ""),
      [{ label: "CONTINUE", value: 1 }]);
    return { won: res.won, rating: rating };
  }
  function gainLine(a, g) { return g ? "<p class='center gain'>+" + g + " " + ATTR_TXT[a] + "</p>" : ""; }

  // ================== ALL-JAPAN YOUTH CAMP (every December) ==================
  var CAMP_STARS = [
    { who: "SAKUSA", sch: "ITACHIYAMA", attr: "def", game: "reaction", line: "...Don't touch my water bottle. Watch my wrist — the spin comes late.", win: "Sakusa almost smiles. \"You read it. Annoying.\"", lose: "Sakusa's spikes curve away from your arms every time. \"Again. And wash your hands.\"" },
    { who: "ATSUMU", sch: "INARIZAKI", attr: "srv", game: "target", line: "Yer serve's alright. Wanna see a real one? Hit the towel, then we'll talk.", win: "\"Huh. Not bad, not bad at all.\" Atsumu looks genuinely annoyed.", lose: "\"Yer tossin' too far forward.\" Atsumu fixes it in one sentence." },
    { who: "HOSHIUMI", sch: "KAMOMEDAI", attr: "vert", game: "power", line: "Height isn't everything! Load the legs and EXPLODE!", win: "\"THAT'S what I'm talking about!\" Hoshiumi slaps your back.", lose: "\"You're holding back! Don't hold back!\"" },
    { who: "KAGEYAMA", sch: "KARASUNO", attr: "set", game: "memory", line: "Call your tempo. Loud. I'll put the ball exactly there.", win: "Kageyama nods once. From him, that's a standing ovation.", lose: "\"...You called B. You ran A.\" He's not wrong." },
    { who: "HYAKUZAWA", sch: "KAKUGAWA", attr: "blk", game: "read", line: "I used to hate being tall. Now I just read the setter and wait.", win: "\"You see it too, right? The setter's shoulders.\"", lose: "\"Don't jump with your eyes. Jump with your head.\"" },
    { who: "KOMORI", sch: "ITACHIYAMA", attr: "rec", game: "catch", line: "Platform still, feet fast. That's the whole secret, honestly.", win: "\"See? Easy!\" Komori beams like a proud older brother.", lose: "\"Your arms are swinging. Let the ball come to you.\"" },
    { who: "GOSHIKI", sch: "SHIRATORIZAWA", attr: "att", game: "rhythm", line: "I'm going to be the ACE of Japan! Race me on the approach!", win: "\"...Okay, you're good. But I'm still the ace!\"", lose: "\"HA! Too slow! Again, again!\"" },
    { who: "LEV", sch: "NEKOMA", attr: "blk", game: "reaction", line: "I'm going to be Nekoma's ace! ...Also, Yaku-san says I need to practise blocking.", win: "Lev tries to lift you in celebration. You both fall over.", lose: "Lev is somehow both terrible and terrifying." },
    { who: "HINATA", sch: "KARASUNO", attr: "spd", game: "tap", line: "Let's see who's faster! Ready? GO!", win: "\"BWAH! Again! One more!\" Hinata is already sprinting back.", lose: "Hinata is a blur. \"You'll get me next time!\"" }
  ];
  var CAMP_POOL = { S: ["KAGEYAMA", "ATSUMU", "KOGANEGAWA", "SHIRABU", "AKAASHI"], OH: ["HOSHIUMI", "SAKUSA", "GOSHIKI", "BOKUTO", "USHIJIMA", "HINATA", "KUNIMI"],
                    MB: ["HYAKUZAWA", "LEV", "HIRUGAMI", "SUNA", "AONE"], OP: ["OSAMU", "KYOTANI", "TERUSHIMA", "AZUMANE"], L: ["KOMORI", "YAKU", "NISHINOYA", "OHIRA"] };
  function inSchool(name) { return VB.HQ_YEARS_OK(name, S.year) && !S.squad.some(function (id) { return P(id).name === name; }); }
  function campStars() { return CAMP_STARS.filter(function (c) { return inSchool(c.who); }); }
  function campTeams() {
    var used = {}, red = {}, white = {};
    function take(fam) { var c = shuffle(CAMP_POOL[fam].filter(function (n) { return !used[n] && inSchool(n); }))[0]; if (c) used[c] = 1; return c || null; }
    VB.ROLES.forEach(function (r) { var f = VB.FAMILY[r]; red[r] = take(f); white[r] = take(f); });
    var top = Math.max.apply(null, VB.HQ_ALL.map(function (t) { return t.ovr; }));
    return [customTeam({ id: "AJR", name: "CAMP RED", kit: "#c81e2a", kit2: "#ffffff", ovr: top, players: red, play: "power" }, true),
            customTeam({ id: "AJW", name: "CAMP WHITE", kit: "#f2f2f2", kit2: "#1e4fd8", ovr: top, players: white, play: "fast" }, false)];
  }
  async function youthCamp() {
    var o = ovr(you()), need = S.year === 1 ? 71 : 69, awards = (S.awards || []).length;
    if (o < need && !(awards && o >= need - 3)) return ballBoyCamp(need);
    S.youth = (S.youth || 0) + 1;
    log("🇯🇵 Invited to the ALL-JAPAN YOUTH TRAINING CAMP.", "you");
    await U.modal("🇯🇵 ALL-JAPAN YOUTH CAMP", "<p>An envelope from the Japan Volleyball Association. <b>You've been invited</b> to the All-Japan Youth Training Camp — three days with the best high-schoolers in the country.</p>" +
      "<p>" + esc(coach()) + ": \"Go. Steal everything they know. Then bring it back here.\"</p>", [{ label: "DAY 1 ▸", value: 1 }]);
    // day 1: pair drills with a star of your choice
    var stars = shuffle(campStars()).slice(0, 3);
    if (stars.length) {
      var k = await U.modal("DAY 1 — PAIR DRILLS", "<p>Thirty of the best players in Japan, and the coaches want everyone in pairs. Who do you walk up to?</p>",
        stars.map(function (x, i) { return { label: x.who + " (" + x.sch + ")", value: i }; }));
      var st = stars[k], q = await VB.Mini.play(st.game, "PAIR DRILL WITH " + st.who, "\"" + st.line + "\"", you()[st.attr] || 70);
      var g = addPts(st.attr, (0.9 + q * 2.8) * room());
      S.campBond = S.campBond || {}; S.campBond[st.who] = (S.campBond[st.who] || 0) + 1;
      addConf(q >= 0.6 ? 3 : -1);
      log("Youth camp: paired with " + st.who + (g ? " (+" + g + " " + ATTR_TXT[st.attr] + ")" : "") + ".", "story");
      await U.modal(st.who, "<p>" + esc(q >= 0.6 ? st.win : st.lose) + "</p>" + gainLine(st.attr, g), [{ label: "CONTINUE", value: 1 }]);
    }
    // night: the dorm
    var night = await U.modal("DAY 1 — DORM NIGHT", "<p>Lights out at ten. Nobody is asleep. Someone has smuggled in snacks, someone else has a laptop full of match tapes.</p>",
      [{ label: "WATCH MATCH TAPES", value: "tape" }, { label: "PILLOW FIGHT", value: "pillow" }, { label: "SNEAK OUT TO PRACTISE", value: "night" }]);
    var nt;
    if (night === "tape") { var qm = await VB.Mini.play("read", "TAPE STUDY", "Pause. Rewind. Where is that setter going?", you().men); var gm = addPts("men", (0.6 + qm * 2) * room()); nt = "You fall asleep with notes on your face." + (gm ? " +" + gm + " MENTAL." : ""); }
    else if (night === "pillow") { addConf(5); nt = "It ends with Hoshiumi standing on a bunk declaring victory. Best night of the year. +" + coins(800) + " 🏐 coins."; }
    else { var qn = await VB.Mini.forAttr(S.focus, "MIDNIGHT REPS", "The gym door was unlocked. Of course it was.", you()[S.focus] || 70); var gn = addPts(S.focus, (0.6 + qn * 2.2) * room());
      if (Math.random() < 0.35) { addConf(-2); nt = "A coach catches you. Laps at 6am." + (gn ? " (Worth it: +" + gn + " " + ATTR_TXT[S.focus] + ")" : ""); } else nt = "Nobody catches you." + (gn ? " +" + gn + " " + ATTR_TXT[S.focus] + "." : ""); }
    log("Youth camp night: " + nt, "story");
    await U.modal("DAY 1 — DORM NIGHT", "<p>" + esc(nt) + "</p>", [{ label: "DAY 2 ▸", value: 1 }]);
    // day 2: the coaches' gauntlet
    var fl = FOCUS[you().role], out = [], used = [];
    for (var i = 0; i < 2; i++) {
      var a = i === 0 ? S.focus : pick(fl.filter(function (x) { return x !== S.focus; })), qq = await VB.Mini.forAttr(a, "COACHES' GAUNTLET " + (i + 1) + "/2", "Drill: " + DRILLS[a] + ". Every coach in the gym is writing notes.", you()[a] || 70);
      var gg = addPts(a, (0.7 + qq * 2.4) * room()); out.push(DRILLS[a] + ": " + (gg ? "+" + gg + " " + ATTR_TXT[a] : "no gain")); used.push(qq);
    }
    await U.modal("DAY 2 — THE GAUNTLET", "<ul>" + out.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ul>", [{ label: "DAY 3 ▸", value: 1 }]);
    // day 3: the scrimmage
    var tm = campTeams(), play = await U.modal("DAY 3 — SCRIMMAGE", "<p>The camp ends with a scrimmage: <b>CAMP RED</b> (you) vs <b>CAMP WHITE</b>. The national youth coaches are taking notes for the U-19 squad.</p>",
      [{ label: "PLAY", value: 1 }]);
    var r = await customMatch(tm[0], tm[1], { label: "YOUTH CAMP SCRIMMAGE", league: "ALL-JAPAN YOUTH", floor: "vnl" });
    if (r.rating >= 7.4 || (r.won && r.rating >= 6.8)) {
      var aw = "Y" + S.year + " U-19 JAPAN SELECTION"; S.awards = S.awards || []; S.awards.push(aw); addConf(6);
      log("🇯🇵 Named to the U-19 JAPAN squad after the youth camp!", "you");
      await U.modal("🇯🇵 U-19 JAPAN", "<p>The head coach reads out the names. Yours is one of them.</p><p class='center gain'>🏅 " + esc(aw) + " • +" + coins(2000) + " 🏐</p>", [{ label: "CONTINUE", value: 1 }]);
    } else await U.modal("CAMP OVER", "<p>No call-up this time — but every coach in Japan knows your name now.</p>", [{ label: "CONTINUE", value: 1 }]);
    void play;
  }
  async function ballBoyCamp(need) {
    var k = await U.modal("THE YOUTH CAMP LIST", "<p>The All-Japan Youth Camp list is out. Your name isn't on it (you'd need about OVR " + need + ").</p><p>Then you overhear it: the camp is short of <b>ball boys</b>...</p>",
      [{ label: "SNEAK IN AS A BALL BOY", value: "ball" }, { label: "PREFECTURE ROOKIE CAMP", value: "pref" }]);
    var txt;
    if (k === "ball") {
      var q1 = await VB.Mini.play("catch", "BALL BOY DUTY", "Every stray ball is yours. Don't let one touch the floor.", you().rec);
      var q2 = await VB.Mini.play("read", "WATCHING FROM THE WALL", "You study the best setters in Japan from behind the baseline.", you().men);
      var g1 = addPts("rec", (0.6 + q1 * 2) * room()), g2 = addPts("men", (0.6 + q2 * 2) * room());
      if (q1 + q2 >= 1.3) { S.trust = clamp(S.trust + 4, 0, 100); addConf(5); txt = "On the last day the head coach points at you: \"You. Ball boy. Join the last drill.\" You don't miss a single ball."; }
      else { addConf(2); txt = "Nobody notices you, but you noticed everything."; }
      txt += (g1 ? " +" + g1 + " RECEIVE." : "") + (g2 ? " +" + g2 + " MENTAL." : "");
    } else {
      var a = S.focus, qa = await VB.Mini.forAttr(a, "ROOKIE CAMP DRILL", "The prefecture's best first- and second-years.", you()[a] || 70);
      var qb = await VB.Mini.forAttr("spd", "ROOKIE CAMP FOOTWORK", "Shuttle runs until someone throws up.", you().spd || 70);
      var ga = addPts(a, (0.7 + qa * 2.2) * room()), gb = addPts("spd", (0.5 + qb * 1.6) * room());
      txt = "Three days of drills with the prefecture's best young players." + (ga ? " +" + ga + " " + ATTR_TXT[a] + "." : "") + (gb ? " +" + gb + " SPEED." : "");
    }
    log("December camp: " + txt, "story");
    await U.modal("DECEMBER CAMP", "<p>" + esc(txt) + "</p>", [{ label: "CONTINUE", value: 1 }]);
  }

  // ================== TIMESKIP ==================
  var TS_TXT = ["FIVE YEARS LATER", "REUNIONS", "PRE-SEASON CAMP", "V.LEAGUE: JACKALS vs ADLERS", "EPILOGUE"];
  var PRO_TEAMS = {
    MSBY: { id: "MSBY", name: "MSBY BLACK JACKALS", kit: "#1b1b1b", kit2: "#e8b923", ovr: 82, play: "power", ts: true, pro: true,
            players: { S: "ATSUMU", OH1: "HINATA", OH2: "SAKUSA", MB1: "MEIAN", OP: "BOKUTO", L: "INUNAKI" }, stars: { S: "serve", OH1: "spike", OP: "spike" } },
    ADL: { id: "ADL", name: "SCHWEIDEN ADLERS", kit: "#203a6b", kit2: "#ffd21e", ovr: 82, play: "serve", ts: true, pro: true,
           players: { S: "KAGEYAMA", OH1: "HOSHIUMI", OH2: "ROMERO", MB1: "HIRUGAMI", OP: "USHIJIMA" }, stars: { S: "dump", OH1: "spike", OP: "serve" } }
  };
  var REUNIONS = [
    { id: "rio", label: "🏖️ BEACH VOLLEY IN RIO", who: "HINATA", game: "catch", attr: "rec", txt: "Hinata is back from Brazil, tanned and grinning. \"Sand makes you honest! Your feet can't lie!\"",
      win: "You read the wind like a local. Hinata high-fives you so hard it stings.", lose: "The sand eats you alive. Hinata laughs: \"I was worse on day one!\"" },
    { id: "onigiri", label: "🍙 ONIGIRI MIYA", who: "OSAMU", game: "memory", attr: "men", txt: "Osamu's shop is packed. \"Ya wanna help? Remember the orders. All of 'em.\"",
      win: "Not one wrong order. Osamu pays you in onigiri and coins.", lose: "Someone gets salmon instead of tuna. Osamu just sighs." },
    { id: "kenma", label: "🎮 BOUNCING BALL CORP.", who: "KENMA", game: "tap", attr: "spd", txt: "Kenma, now a CEO, needs a sponsor video. \"Just do the sprint drill. The camera does the rest.\"",
      win: "The video goes viral. Kenma: \"...Nice. The numbers are good.\"", lose: "Kenma: \"We'll fix it in editing.\"" },
    { id: "school", label: "🏫 BACK TO YOUR OLD GYM", who: "", game: "power", attr: "vert", txt: "The smell of floor wax. A first-year shyly asks you to show them your jump.",
      win: "The whole team cheers. Somebody will remember that jump forever.", lose: "You land awkwardly, but the kids still cheer." },
    { id: "japan", label: "🇯🇵 NATIONAL TEAM TRYOUT", who: "USHIJIMA", game: "target", attr: "srv", txt: "The Japan coaches want to see your serve. Ushijima watches from the bench, arms folded.",
      win: "Ushijima: \"Good.\" The Japan coaches write your name down twice.", lose: "\"Again.\" You get one more chance next year." }
  ];
  async function reunion(rr) {
    var q = await VB.Mini.play(rr.game, rr.label, rr.txt, you()[rr.attr] || 75), g = addPts(rr.attr, (0.8 + q * 2.4) * Math.max(0.4, room())), extra = "";
    if (rr.id === "onigiri" || rr.id === "kenma") extra = " +" + coins(q >= 0.6 ? 3000 : 1000) + " 🏐 coins.";
    if (rr.id === "school") addConf(4);
    if (rr.id === "japan" && q >= 0.6) { S.awards = S.awards || []; S.awards.push("JAPAN NATIONAL TEAM CALL-UP"); extra = " 🇯🇵 You're called up to the national team!"; }
    S.ts.done = (S.ts.done || []).concat([rr.id]);
    log("Timeskip — " + rr.label + ": " + (q >= 0.6 ? rr.win : rr.lose) + extra, "story");
    await U.modal(rr.label, "<p>" + esc(q >= 0.6 ? rr.win : rr.lose) + esc(extra) + "</p>" + gainLine(rr.attr, g), [{ label: "CONTINUE", value: 1 }]);
  }
  async function timeskip() {
    var ts = S.ts, me = you();
    if (ts.stage === 0) {
      me.age += 5;
      var fl = FOCUS[me.role], target = Math.max(me.pot, ovr(me) + 8) + 2;
      for (var guard = 0; ovr(me) < target && guard < 400; guard++) { var a = pick(fl); if (me[a] < 99) me[a]++; }
      me.pot = Math.max(me.pot, ovr(me) + 2);
      var path = { "STRAIGHT TO THE PROS": "Five seasons as a pro have hardened you.", "UNIVERSITY ACE": "University volleyball made you a star; now the pros are calling.",
                   "STILL CLIMBING": "You kept climbing — university, a second-division club, and now the big stage." }[S.endTitle] || "You never stopped playing, and somehow that was enough.";
      var k = await U.modal("⏩ FIVE YEARS LATER", "<p>You're <b>" + me.age + "</b> now. " + esc(path) + "</p><p class='center gain'>OVR " + ovr(me) + "</p>" +
        "<p>Two V.League Division 1 clubs want you for the new season. Their season opener is against each other.</p>",
        [{ label: "🦊 MSBY BLACK JACKALS (Hinata, Bokuto, Atsumu, Sakusa)", value: "MSBY" }, { label: "🦅 SCHWEIDEN ADLERS (Kageyama, Ushijima, Hoshiumi)", value: "ADL" }]);
      ts.team = k; ts.stage = 1;
      log("⏩ Five years later: you sign with the " + PRO_TEAMS[k].name + ".", "you");
      return;
    }
    if (ts.stage === 1) {
      for (var n = 0; n < 2; n++) {
        var left = REUNIONS.filter(function (x) { return (ts.done || []).indexOf(x.id) < 0; });
        var pickR = await U.modal("REUNIONS (" + (n + 1) + "/2)", "<p>Old friends, new lives. The off-season has time for two visits.</p>",
          left.map(function (x, i) { return { label: x.label, value: i }; }));
        await reunion(left[pickR]);
      }
      ts.stage = 2; return;
    }
    if (ts.stage === 2) {
      var tm = PRO_TEAMS[ts.team], fl2 = FOCUS[me.role], res = [];
      await U.modal("PRE-SEASON — " + tm.name, "<p>First practice with " + esc(tm.name) + ". " + (ts.team === "MSBY" ? "Bokuto screams HEY HEY HEY at a volume that should be illegal." : "Ushijima nods at you. Kageyama is already asking what tempo you like.") + "</p>",
        [{ label: "TRAIN", value: 1 }]);
      for (var i = 0; i < 3; i++) {
        var at = i === 0 ? S.focus : pick(fl2), q = await VB.Mini.forAttr(at, "PRE-SEASON " + (i + 1) + "/3", "Drill: " + DRILLS[at] + ".", me[at] || 75), g = addPts(at, (0.7 + q * 2.2) * Math.max(0.4, room()));
        res.push(DRILLS[at] + ": " + (g ? "+" + g + " " + ATTR_TXT[at] : "no gain"));
      }
      var slot = MY_SLOT[me.role], benched = tm.players[slot];
      await U.modal("THE LINEUP", "<ul>" + res.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ul><p>The coach pins the lineup to the wall. <b>You're starting</b>" +
        (benched ? " — " + esc(benched) + " shakes your hand: \"Don't waste it.\"" : ".") + "</p>", [{ label: "TO THE OPENER ▸", value: 1 }]);
      ts.stage = 3; return;
    }
    if (ts.stage === 3) {
      var mineT = customTeam(PRO_TEAMS[ts.team], true), foeT = customTeam(PRO_TEAMS[ts.team === "MSBY" ? "ADL" : "MSBY"], false);
      await U.modal("V.LEAGUE DIVISION 1", "<p>Sendai City Gymnasium, sold out. <b>" + esc(mineT.name) + "</b> vs <b>" + esc(foeT.name) + "</b>. Somewhere in the crowd, your old high-school coach is crying already.</p>",
        [{ label: "PLAY", value: 1 }]);
      var r = await customMatch(mineT, foeT, { label: "V.LEAGUE OPENER", league: "V.LEAGUE", bestOf: 3, floor: "rubber" });
      ts.won = r.won; ts.rating = r.rating;
      if (r.won) S.trophies.push("V.LEAGUE OPENER — " + mineT.name + " BEAT " + foeT.name);
      if (r.rating >= 8) { S.awards = S.awards || []; S.awards.push("V.LEAGUE OPENER MVP"); }
      ts.stage = 4; return;
    }
    // epilogue
    var tr = S.trophies.length, aw = (S.awards || []).length, tmn = PRO_TEAMS[ts.team].name;
    var end = ts.won ? (ts.rating >= 8 ? "You were the best player on a court full of legends. Hinata calls it \"the most fun match ever\". He says that every week, but this time he means it."
                                       : "A win in the opener. The season is long, but tonight you're exactly where you dreamed you'd be when you were fifteen.")
                     : "A loss — but the gym chanted your name anyway. The season is long, and you're not done.";
    S.done = true; S.tsDone = true; S.ts = null;
    log("THE END — " + tmn + ".", "you");
    await U.modal("EPILOGUE", "<p>" + esc(end) + "</p><p class='center'>FINAL OVR " + ovr(me) + " • 🏆 " + tr + " • 🏅 " + aw + "</p>" +
      (S.rival ? "<p>Your old rival <b>" + esc(S.rival.name) + "</b> sends a message after the match: \"Rematch. Soon.\"</p>" : "") + "<h3 class='center'>THE END</h3>",
      [{ label: "THE END", value: 1 }]);
  }

  // ================== HUB ==================
  function trustBar() {
    var n = Math.round(S.trust / 10);
    return "<span class='form" + (S.trust >= 60 ? " good" : S.trust < 20 ? " bad" : "") + "'>" + "▰".repeat(n) + "▱".repeat(10 - n) + "</span>";
  }
  function nextTxt() {
    if (S.done) return "STORY COMPLETE";
    if (S.ts) return "NEXT: " + TS_TXT[S.ts.stage];
    if (S.pendingEval) return "NEXT: " + S.pendingEval + " PLAYER EVALUATION";
    var ph = PH[S.phase];
    if (ph === "ih" && S.bracket && S.step < 2) return "NEXT: " + Q_NAMES[2][S.step] + " vs " + team(S.bracket[S.step]).name;
    if (ph === "ih" && S.bracket) return "NEXT: INTERHIGH NATIONALS";
    if (ph === "spring" && S.bracket) return "NEXT: " + Q_NAMES[3][S.step] + " vs " + team(S.bracket[S.step]).name;
    if (ph === "nationals" && S.bracket) return "NEXT: " + N_NAMES[S.step] + " vs " + team(S.bracket[S.step]).name;
    return "NEXT: " + PH_TXT[ph];
  }
  function teamHTML() {
    var line = myLineup(false), starters = {};
    VB.ROLES.forEach(function (r) { if (line[r]) starters[line[r].id] = r; });
    var rows = S.squad.map(P).sort(function (a, b) { return a.role.localeCompare(b.role) || ovr(b) - ovr(a); }).map(function (p) {
      return "<tr class='" + (p.id === "you" ? "you" : "") + "'><td><img src='" + VB.Engine.spriteURL(p.face, school().kit) + "' alt=''/>" + esc(p.name) + (p.skill ? " <span class='star'>★</span>" : "") +
        "</td><td>" + p.role + "</td><td>" + S.years[p.id] + "</td><td>" + ovr(p) + "</td><td>" + p.height + "</td><td>" + VB.reach(p).spike + "</td><td>" + (starters[p.id] ? "START" : "") +
        "</td><td>" + (p.id === "you" ? "" : "<span class='bond'>" + "♥".repeat(S.bond[p.id] || 0) + "</span> <button class='btn tiny' data-act='hang' data-arg='" + p.id + "'" + (hangDone() ? " disabled" : "") + ">HANG OUT</button>") + "</td></tr>";
    }).join("");
    return "<p class='muted'>" + (hangDone() ? "You've already hung out with someone this stretch of the season." : "Hang out with a teammate once per stretch of the season: bonds build confidence and chemistry (a bonded setter or captain gives you a little lift in matches).") + "</p>" +
      "<p class='muted'>Style: <b>" + esc((VB.STYLES[VB.PLAY_OF[S.school]] || VB.STYLES.balanced).name) + "</b>" + (school().combo ? " • Signature: " + esc(school().combo.label) : "") + "</p>" +
      "<table class='roster'><tr><th>PLAYER</th><th>POS</th><th>YR</th><th>OVR</th><th>HT</th><th>REACH</th><th></th></tr>" + rows + "</table>";
  }
  function logHTML() {
    return "<ul class='newslist'>" + S.log.map(function (n) { return "<li class='" + n.tag + "'>Y" + n.y + " • " + esc(n.t) + "</li>"; }).join("") + "</ul>";
  }
  function trainingHTML() {
    return "<p>Pick a training focus. It gets the biggest share of your growth from matches and drills.</p><div class='focus'>" +
      FOCUS[you().role].map(function (a) {
        return "<button class='btn" + (S.focus === a ? " on" : "") + "' data-act='focus' data-arg='" + a + "'>" + ATTR_TXT[a] + " " + you()[a] + "</button>";
      }).join("") + "</div><p class='muted'>Coach trust decides who starts when OVRs are close. Good matches, good drills and pinch serves all raise it.</p>";
  }
  function recordHTML() {
    var rows = S.history.map(function (h) {
      return "<tr><td>" + yearTxt(h.year) + "</td><td>" + h.ovr + "</td><td>" + esc(h.ih) + "</td><td>" + esc(h.spring) + "</td><td>" + esc(h.line) + "</td></tr>";
    }).join("");
    var cur = S.stats[S.year];
    return "<p><b>THIS YEAR:</b> " + esc(cur ? VB.Stats.lineText(cur) + " • " + (cur.mp || 0) + " MATCHES" : "no matches yet") + "</p>" +
      "<h3 class='mini'>TROPHY CABINET</h3>" + U.cabinet(S.trophies, "🏆") +
      "<h3 class='mini'>INDIVIDUAL AWARDS</h3>" + U.cabinet(S.awards || [], "🏅") +
      (rows ? "<table class='standings'><tr><th>YEAR</th><th>OVR</th><th>INTERHIGH</th><th>SPRING</th><th>YOUR LINE</th></tr>" + rows + "</table>" : "");
  }
  function render() {
    var me = you(), t = school(), rch = VB.reach(me), tabs = ["team", "log", "news", "training", "record"];
    var body = tab === "team" ? teamHTML() : tab === "log" ? logHTML() : tab === "news" ? newsHTML() : tab === "training" ? trainingHTML() : recordHTML();
    $("hub").innerHTML =
      "<div class='hub-top'>" +
        "<div class='card me-card'><img class='pix big' src='" + VB.Engine.spriteURL(me.face, t.kit) + "' alt=''/>" +
          "<div><div class='pname'>" + esc(me.name) + (S.captain ? " (C)" : "") + "</div>" +
          "<div class='muted'>" + VB.FAMILY_NAMES[me.role] + " • " + yearTxt(S.year) + " • AGE " + me.age + "</div>" +
          "<div class='ovr'>OVR " + ovr(me) + " <span class='muted'>POT ~" + Math.round(me.pot / 5) * 5 + "</span></div>" +
          "<div class='muted'>HT " + me.height + "cm • VERT " + me.vert + "cm • REACH " + rch.spike + "/" + rch.block + "</div>" +
          "<div>CONFIDENCE " + confBar() + "</div>" +
          "<div>COACH TRUST " + trustBar() + (me.skill ? " <span class='star'>★ " + esc(me.skillName || VB.SKILL_TXT[me.skill]) + "</span>" : S.pendingSkill ? " <span class='muted'>(learning " + esc(S.pendingSkill.name) + ")</span>" : "") + "</div>" +
          "<div class='muted'>" + VB.ATTRS.map(function (a) { return a.toUpperCase() + " " + me[a]; }).join(" • ") + "</div>" +
          (VB.psText(me) ? "<div class='ps-line'>" + esc(VB.psText(me)) + "</div>" : "") + "</div></div>" +
        "<div class='card club-card' style='border-color:" + t.kit + "'><div class='pname'>" + esc(t.flag + " " + t.name) + "</div>" +
          "<div class='muted'>" + esc(region(S.school) === "LOCAL" ? "PREFECTURE QUALIFIERS vs LOCAL SCHOOLS" : region(S.school) + " PREFECTURE") + " • " + esc(coach().toUpperCase()) + "</div>" +
          "<div>" + (keyOf(myLineup(false)) ? "<b class='gain'>IN THE STARTING SIX</b>" : "<b>FIGHTING FOR A SPOT</b>") + "</div>" +
          (S.ts && S.ts.team ? "<div>🏐 PRO: <b>" + esc(PRO_TEAMS[S.ts.team].name) + "</b></div>" : "") +
          (S.youth ? "<div>🇯🇵 YOUTH CAMP INVITES: <b>" + S.youth + "</b></div>" : "") +
          (S.rival ? "<div>⚡ RIVAL: <b>" + esc(S.rival.name) + "</b> <span class='muted'>(" + esc(team(S.rival.school).name) + ") • " + S.rival.w + "-" + S.rival.l + "</span></div>" : "") +
          "<div class='muted'>🏆 " + S.trophies.length + " • INTERHIGH: " + esc(S.ih || "—") + " • SPRING: " + esc(S.spring || "—") + "</div></div>" +
      "</div>" +
      coopCard() +
      "<div class='hub-status'>STORY SLOT " + S.slot + " • " + yearTxt(S.year) + (S.ts ? "" : " • WEEK " + (S.week || 0) + " • " + esc(PH_TXT[PH[S.phase]] || "")) + " • " + esc(nextTxt()) + "</div>" +
      "<div class='hub-actions'>" + (S.done ? "" : "<button class='btn big' data-act='advance'>" + esc(PH[S.phase] === "end" ? "SEASON REVIEW" : "CONTINUE STORY") + "</button>") +
        "<button class='btn' data-act='look'>CHANGE LOOK</button><button class='btn' data-act='cam'>🎥 CAMERA: " + esc(VB.CAMS[localStorage.getItem("retroVB.cam") || "classic"] || "CLASSIC") + "</button>" +
        (S.done || S.ts ? "" : "<button class='btn' data-act='coop'>🤝 CO-OP</button>") +
        "<button class='btn pink' data-act='menu'>SAVE &amp; MENU</button></div>" +
      "<div class='tabs'>" + tabs.map(function (x) { return "<button class='tab-btn" + (x === tab ? " on" : "") + "' data-act='tab' data-arg='" + x + "'>" + x.toUpperCase() + "</button>"; }).join("") + "</div>" +
      "<div class='tab-body'>" + body + "</div>";
  }

  // ================== SLOTS & NEW STORY ==================
  function renderSlots() {
    var html = "<h2 class='hub-h'>HAIKYUU!! STORY MODE</h2><p class='center muted'>Join a high-school team as a first-year • three years • Interhigh and Spring Nationals</p><div class='slots'>";
    for (var s = 1; s <= SLOTS; s++) {
      var c = load(s);
      if (c) {
        var p = c.players.you, t = VB.HQ_ALL.find(function (x) { return x.id === c.school; }) || (c.locals || []).find(function (x) { return x.id === c.school; });
        html += "<div class='card slot'><div class='pname'>SLOT " + s + ": " + esc(p.name) + "</div><div class='muted'>" + esc(t ? t.name : c.school) + " • " + VB.FAMILY_NAMES[p.role] +
          " • OVR " + VB.ovr(p) + " • " + (c.done ? "GRADUATED" : yearTxt(c.year)) + "</div>" +
          "<button class='btn' data-act='load' data-arg='" + s + "'>CONTINUE</button> <button class='btn pink' data-act='del' data-arg='" + s + "'>DELETE</button></div>";
      } else {
        html += "<div class='card slot'><div class='pname'>SLOT " + s + "</div><div class='muted'>Empty</div><button class='btn' data-act='new' data-arg='" + s + "'>NEW STORY</button></div>";
      }
    }
    html += "</div><div class='hub-actions'><button class='btn pink' data-act='exit'>BACK TO MENU</button></div>";
    $("hub").innerHTML = html;
  }
  var HAIR_S = VB.HAIR_STYLES.concat(["bedhead"]);                 // realistic cuts + Bokuto's owl
  var HAIR_C = [["BLACK", "#17120d"], ["BROWN", "#3a2416"], ["CHESTNUT", "#6b4423"], ["BLOND", "#e8d27a"], ["ORANGE", "#ff7a1a"], ["SILVER", "#d8d8d8"]];
  function renderNew() {
    var t = VB.HQ_ALL.find(function (x) { return x.id === setup.school; });
    var face = { skin: VB.SKINS[setup.skin], hair: setup.hairC, style: setup.hairS, mouth: true };
    $("hub").innerHTML = "<h2 class='hub-h'>NEW STORY — SLOT " + setup.slot + "</h2>" +
      "<div class='newcareer'>" +
        "<div class='center'><img class='pix big' src='" + VB.Engine.spriteURL(face, t.kit) + "' alt=''/></div>" +
        "<label>NAME <input id='sName' class='text-in' maxlength='12' value='" + esc(setup.name) + "'/></label>" +
        "<div>SCHOOL</div><div class='focus'>" + VB.HQ_ALL.map(function (x) {
          return "<button class='btn" + (setup.school === x.id ? " on" : "") + "' data-act='setSchool' data-arg='" + x.id + "'>" + x.flag + " " + x.name + "</button>"; }).join("") + "</div>" +
        "<div>POSITION</div><div class='focus'>" + ["S", "OH", "MB", "OP", "L"].map(function (f) {
          return "<button class='btn" + (setup.fam === f ? " on" : "") + "' data-act='setFam' data-arg='" + f + "'>" + VB.FAMILY_NAMES[f] + "</button>"; }).join("") + "</div>" +
        "<div>BUILD</div><div class='focus'>" + [["tower", "TOWER — tall, lower jump"], ["balanced", "BALANCED"], ["jumper", "JUMPER — short, huge vertical"]].map(function (b) {
          return "<button class='btn" + (setup.build === b[0] ? " on" : "") + "' data-act='setBuild' data-arg='" + b[0] + "'>" + b[1] + "</button>"; }).join("") + "</div>" +
        "<div>HEIGHT ADJUST</div><div class='focus'><button class='btn' data-act='hgt' data-arg='-2'>− 2cm</button><b class='hgt-val'>" + ((setup.hAdj || 0) >= 0 ? "+" : "") + (setup.hAdj || 0) + " cm</b><button class='btn' data-act='hgt' data-arg='2'>+ 2cm</button>" +
          "<span class='muted'> taller = more reach, less jump & speed</span></div>" +
        "<div>HAIR</div><div class='focus'>" + HAIR_S.map(function (h) {
          return "<button class='btn" + (setup.hairS === h ? " on" : "") + "' data-act='setHairS' data-arg='" + h + "'>" + VB.HAIR_TXT[h] + "</button>"; }).join("") + "</div>" +
        "<div class='focus'>" + HAIR_C.map(function (h) {
          return "<button class='btn" + (setup.hairC === h[1] ? " on" : "") + "' data-act='setHairC' data-arg='" + h[1] + "'>" + h[0] + "</button>"; }).join("") +
          VB.SKINS.map(function (s, i) { return "<button class='btn" + (setup.skin === i ? " on" : "") + "' data-act='setSkin' data-arg='" + i + "' style='background:" + s + (setup.skin === i ? ";outline:3px solid #ff4fa0" : "") + "'>&nbsp;</button>"; }).join("") + "</div>" +
        "<p class='muted'>" + esc(t.name) + " • team OVR " + t.ovr + " • style " + esc(VB.STYLES[VB.PLAY_OF[t.id]].name) +
          ". You start around OVR " + (t.ovr - 9) + " as a first-year. Stronger schools mean tougher competition for a starting spot.</p>" +
      "</div><div class='hub-actions'><button class='btn big' data-act='create'>JOIN THE TEAM</button><button class='btn pink' data-act='slots'>BACK</button></div>";
  }

  async function onHubClick(e) {
    var b = e.target.closest("[data-act]");
    if (!b || busy) return;
    var act = b.getAttribute("data-act"), arg = b.getAttribute("data-arg");
    if (act === "advance") return advance();
    if (act === "tab") { tab = arg; return render(); }
    if (act === "cam") { var ck = Object.keys(VB.CAMS), cur = localStorage.getItem("retroVB.cam") || "classic"; VB.Engine.setCam(ck[(ck.indexOf(cur) + 1) % ck.length]); return render(); }
    if (act === "coop") { busy = true; try { await startCoop(); } finally { busy = false; } return render(); }
    if (act === "focus") { S.focus = arg; save(); return render(); }
    if (act === "hang") { busy = true; try { await hangOut(arg); } finally { busy = false; } save(); return render(); }
    if (act === "look") { busy = true; await VB.editLook(you().face, school().kit, school().kit2, VB.Engine.kitPattern(S.school)); busy = false; save(); return render(); }
    if (act === "menu" || act === "exit") { if (S) save(); S = null; $("hub").onclick = null; var r = exitStory; exitStory = null; return r && r(); }
    if (act === "load") {
      S = load(+arg); Object.keys(S.players).forEach(function (id) { VB.fillAttrs(S.players[id]); });
      if (S.conf == null) S.conf = 50; S.bond = S.bond || {}; if (!S.rival) pickRival();
      if (!S.ph2) { if (S.phase >= 6) S.phase++; S.ph2 = 1; }                  // the youth camp slotted in before nationals
      S.papers = S.papers || [];
      if (S.done && !S.ts && !S.tsDone && S.year === 3) { S.done = false; S.ts = { stage: 0 }; S.year = 4; S.phase = 0; save(); }   // finished stories get the timeskip
      tab = "team"; return render();
    }
    if (act === "del") {
      var ok = await U.modal("DELETE STORY?", "<p>Slot " + arg + " will be erased for good.</p>", [{ label: "DELETE", value: true, cls: "pink" }, { label: "KEEP IT", value: false }]);
      if (ok) localStorage.removeItem(SLOT_KEY + arg);
      return renderSlots();
    }
    if (act === "slots") return renderSlots();
    if (act === "new") { setup = { slot: +arg, name: "NEW KID", school: "KAR", fam: "OH", build: "balanced", hairS: "crop", hairC: "#17120d", skin: 0 }; return renderNew(); }
    if (act === "hgt") { setup.name = ($("sName").value || "NEW KID").toUpperCase().slice(0, 12); setup.hAdj = clamp((setup.hAdj || 0) + (+arg), -12, 12); return renderNew(); }
    var setters = { setSchool: "school", setFam: "fam", setBuild: "build", setHairS: "hairS", setHairC: "hairC", setSkin: "skin" };
    if (setters[act]) {
      setup.name = ($("sName").value || "NEW KID").toUpperCase().slice(0, 12);
      setup[setters[act]] = act === "setSkin" ? +arg : arg;
      return renderNew();
    }
    if (act === "create") {
      setup.name = ($("sName").value || "NEW KID").toUpperCase().slice(0, 12);
      createStory(setup.slot, setup);
      save(); tab = "team"; render();
    }
  }

  // shared appearance editor (story + career): edits face in place, resolves on DONE
  VB.editLook = function (face, kit, kit2, pat) {
    return new Promise(function (res) {
      var hub = $("hub"), prev = hub.onclick, saved = hub.innerHTML;
      var EXTRAS = [["glasses", "GLASSES"], ["headband", "HEADBAND"], ["beard", "BEARD"], ["stubble", "STUBBLE"]];
      function draw() {
        var ex = face.ex || [];
        hub.innerHTML = "<h2 class='hub-h'>CHANGE YOUR LOOK</h2><div class='newcareer'>" +
          "<div class='center'><img class='pix big' src='" + VB.Engine.spriteURL(face, kit, kit2, pat) + "' alt=''/></div>" +
          "<div>HAIR</div><div class='focus'>" + HAIR_S.map(function (h) { return "<button class='btn" + (face.style === h ? " on" : "") + "' data-lk='s' data-v='" + h + "'>" + VB.HAIR_TXT[h] + "</button>"; }).join("") + "</div>" +
          "<div class='focus'>" + HAIR_C.map(function (h) { return "<button class='btn" + (face.hair === h[1] ? " on" : "") + "' data-lk='c' data-v='" + h[1] + "'>" + h[0] + "</button>"; }).join("") + "</div>" +
          "<div>SKIN</div><div class='focus'>" + VB.SKINS.map(function (s, i) { return "<button class='btn' data-lk='k' data-v='" + i + "' style='background:" + s + (face.skin === s ? ";outline:3px solid #ff4fa0" : "") + "'>&nbsp;</button>"; }).join("") + "</div>" +
          "<div>EXTRAS</div><div class='focus'>" + EXTRAS.map(function (e) { return "<button class='btn" + (ex.indexOf(e[0]) >= 0 ? " on" : "") + "' data-lk='x' data-v='" + e[0] + "'>" + e[1] + "</button>"; }).join("") + "</div>" +
          "</div><div class='hub-actions'><button class='btn big' data-lk='done'>DONE</button></div>";
      }
      hub.onclick = function (e) {
        var b = e.target.closest("[data-lk]");
        if (!b) return;
        var k = b.getAttribute("data-lk"), v = b.getAttribute("data-v");
        if (k === "done") { hub.onclick = prev; hub.innerHTML = saved; return res(face); }
        if (k === "s") face.style = v;
        if (k === "c") { face.hair = v; delete face.hair2; }
        if (k === "k") face.skin = VB.SKINS[+v];
        if (k === "x") { face.ex = (face.ex || []).slice(); var i = face.ex.indexOf(v); if (i >= 0) face.ex.splice(i, 1); else face.ex.push(v); }
        draw();
      };
      draw();
    });
  };

  VB.drillBar = drillBar;
  VB.Story = {
    start: function () {
      return new Promise(function (res) {
        exitStory = res;
        U.showView("hub");
        $("hub").onclick = onHubClick;
        renderSlots();
      });
    }
  };
})(window.VB);
