// Haikyuu!! Story Mode: join a high-school team as a first-year and grow over three years —
// practice matches, Golden Week, Interhigh, the Tokyo summer camp, Spring qualifiers and Spring Nationals.
(function (VB) {
  "use strict";
  var U = VB.ui, $ = U.$, esc = U.esc;
  var rnd = VB.rnd, irnd = VB.irnd, clamp = VB.clamp, pick = VB.pick, shuffle = VB.shuffle;

  var SLOT_KEY = "hqStory.slot", SLOTS = 3;
  var PH = ["april", "practice", "gw", "ih", "camp", "spring", "nationals", "end"];
  var PH_TXT = { april: "APRIL — NEW SCHOOL YEAR", practice: "PRACTICE MATCH", gw: "GOLDEN WEEK CAMP", ih: "INTERHIGH QUALIFIERS",
                 camp: "TOKYO SUMMER CAMP", spring: "SPRING QUALIFIERS", nationals: "SPRING NATIONALS", end: "SEASON REVIEW" };
  var COMP = { S: 2, OH: 4, MB: 3, OP: 2, L: 2 };
  var FOCUS = { S: ["set", "def", "srv", "blk"], OH: ["att", "rec", "def", "srv", "blk"], MB: ["blk", "att", "srv"],
                OP: ["att", "srv", "blk", "def"], L: ["rec", "def", "set"] };
  var ATTR_TXT = { srv: "SERVE", rec: "RECEIVE", set: "SET", att: "ATTACK", blk: "BLOCK", def: "DEFENCE", vert: "VERTICAL" };

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
    KIRYU: 3, DAISHO: 3, NUMAI: 3, TERUSHIMA: 2, HYAKUZAWA: 1, NAKASHIMA: 3
  };
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

  var MIYAGI = ["KAR", "AOB", "SHI", "DAT", "JOH", "WAK", "KAK"], TOKYO = ["NEK", "FUK", "NOH", "ITC", "TSU", "UBU"];
  var RIVAL = { KAR: "AOB", AOB: "KAR", SHI: "AOB", DAT: "KAR", JOH: "AOB", WAK: "SHI", KAK: "DAT", NEK: "KAR", FUK: "NEK",
                NOH: "NEK", ITC: "INA", TSU: "NOH", UBU: "NEK", INA: "ITC", KAM: "KAR", MUJ: "FUK" };
  var COACH = { KAR: "UKAI", NEK: "NEKOMATA" };
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
    blk: "READ-AND-STEP BLOCKING", def: "FLYING-FALL DIGS", vert: "PLYOMETRIC JUMP CIRCUIT"
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
  function team(id) { return VB.HQ_TEAMS.find(function (t) { return t.id === id; }) || (S.locals || []).find(function (t) { return t.id === id; }); }
  function school() { return team(S.school); }
  function coach() { return COACH[S.school] ? "Coach " + COACH[S.school] : "Coach"; }
  function region(id) { return MIYAGI.indexOf(id) >= 0 ? "MIYAGI" : TOKYO.indexOf(id) >= 0 ? "TOKYO" : "LOCAL"; }
  function log(t, tag) { S.log.unshift({ y: S.year, t: t, tag: tag || "" }); if (S.log.length > 90) S.log.length = 90; }
  function yearTxt(y) { return ["", "1ST", "2ND", "3RD"][y] + " YEAR"; }

  // ================== CREATION ==================
  function newRec(name, fam, base, yr, nat) {
    var p = VB.makePlayer({ name: name, nat: nat || "JPN", role: fam, base: base, age: 14 + yr, heightAdj: -9 });
    return p;
  }
  function addMember(p, yr, slot) { S.players[p.id] = p; S.squad.push(p.id); S.years[p.id] = yr; if (slot) S.slotOf[p.id] = slot; }

  function createStory(slot, st) {
    var t = team(st.school) || VB.HQ_TEAMS.find(function (x) { return x.id === st.school; });
    S = { slot: slot, v: 1, school: t.id, year: 1, phase: 0, step: 0, players: {}, squad: [], years: {}, slotOf: {}, taken: {},
          trust: 10, focus: FOCUS[st.fam][0], prog: {}, log: [], trophies: [], history: [], stats: {}, bracket: null,
          springOut: false, captain: false, vertGain: 0, mentorDone: false, locals: [], done: false, startOvr: 0, name: st.name, fam: st.fam };
    if (region(t.id) === "LOCAL") {
      shuffle(LOCAL_NAMES.slice()).slice(0, 4).forEach(function (n, i) {
        var k = LOCAL_KITS[i % LOCAL_KITS.length];
        S.locals.push({ id: "LOC" + i, name: n, short: n, flag: "🏫", ovr: irnd(74, 82), kit: k[0], kit2: k[1], players: {}, stars: {},
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
    var height = Math.round((h[0] + h[1]) / 2) - 9 + (st.build === "tower" ? 7 : st.build === "jumper" ? -10 : 0);
    var vert = Math.round((v[0] + v[1]) / 2) - 4 + (st.build === "tower" ? -8 : st.build === "jumper" ? 11 : 0);
    var me = VB.makePlayer({ id: "you", name: st.name, nat: "JPN", role: fam, base: t.ovr - 11, age: 15, height: height, vert: vert,
                             face: { skin: VB.SKINS[st.skin], hair: st.hairC, style: st.hairS, mouth: true } });
    me.pot = clamp(t.ovr + irnd(9, 13), 60, 99);
    S.players.you = me; S.squad.push("you"); S.years.you = 1;
    S.startOvr = ovr(me);
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
    if (p.id === "you") s += S.trust * 0.09 + (S.captain ? 3 : 0);
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
    var q = await drillBar(label || DRILLS[a], "Drill: " + DRILLS[a] + ".", { goodW: clamp(0.18 + (lvl - 60) / 300, 0.16, 0.3), speed: 1500 - (lvl - 60) * 4 });
    var g = addPts(a, (0.6 + q * 2.4) * room() * rnd(0.85, 1.15));
    S.trust = clamp(S.trust + q * 3.5, 0, 100);
    return { q: q, g: g };
  }

  // ================== MATCHES ==================
  async function playStory(foeId, o) {
    var line = myLineup(o.practice), key = keyOf(line), mine = myDef(line), foe = oppDef(foeId);
    var st = S.stats[S.year] = S.stats[S.year] || VB.Stats.newLine();
    if (!key) {
      var q = await drillBar("PINCH SERVER", coach() + " calls your name late in the set: \"Go in and serve. One good one.\"", { goodW: 0.22, speed: 1250 });
      S.trust = clamp(S.trust + q * 4 - 0.5, 0, 100);
      var bonus = q >= 1 ? 3 : q >= 0.5 ? 1 : 0;
      mine.ovr = VB.Stats.teamOvr(mine) + bonus;
      var s = VB.Stats.simSets(mine, foe, o.bestOf || 1), won = s.a > s.b;
      if (won && VB.Gacha) VB.Gacha.earn(80);
      await U.modal(won ? "WIN (FROM THE BENCH)" : "LOSS (FROM THE BENCH)",
        "<p>" + esc(coach()) + " went with the starters. " + (q >= 1 ? "Your pinch serve was an ACE — the bench went wild." : q >= 0.5 ? "Your pinch serve forced a free ball." : "Your pinch serve didn't do much.") + "</p>" +
        "<p class='center big'>" + esc(mine.name + " " + s.a + " : " + s.b + " " + foe.name) + "</p><p class='center muted'>COACH TRUST " + Math.round(S.trust) + "</p>",
        [{ label: "CONTINUE", value: 1 }]);
      log((won ? "W " : "L ") + s.a + "-" + s.b + " vs " + foe.name + " (" + o.label + ") — bench.", "result");
      return won;
    }
    U.showView("match");
    $("recordLine").textContent = yearTxt(S.year) + " • " + school().name + " • " + o.label;
    var res = await VB.Engine.playMatch({ mine: mine, foe: foe, homeSide: o.away ? 1 : 0, mode: "role", myRole: key, label: o.label + (o.bestOf > 1 ? " • BEST OF 3" : ""), league: o.league || "HARUKO",
                                          bestOf: o.bestOf || 1, floor: o.floor || "wood" });
    U.showView("hub");
    var lineSt = res.stats.you, rating = VB.Stats.rating(lineSt, you().role, res.won);
    S.stats[S.year] = VB.Stats.addInto(st, lineSt);
    var before = ovr(you()), gains = grow(rating), after = ovr(you());
    S.trust = clamp(S.trust + (rating - 6) * 3 + (res.won ? 1 : 0), 0, 100);
    var flowed = res.flows.some(function (f) { return f.id === "you"; });
    var skillNew = checkSkill();
    log((res.won ? "W " : "L ") + res.score[0] + "-" + res.score[1] + " vs " + foe.name + " (" + o.label + ") — rating " + rating + ".", "result");
    if (flowed) log("🔵🔥 You hit the FLOW STATE against " + foe.name + ".", "you");
    await U.modal(res.won ? "WIN" : "LOSS",
      "<p class='center big'>" + esc(mine.name + " " + res.score[0] + " : " + res.score[1] + " " + foe.name) + "</p>" +
      (res.sets && res.sets.length > 1 ? "<p class='center muted'>SETS " + res.sets.map(function (x) { return x[0] + "-" + x[1]; }).join(", ") + "</p>" : "") +
      (res.coins ? "<p class='center'>+" + res.coins + " 🏐 COINS</p>" : "") +
      "<p class='center'>YOUR RATING: <b class='rating'>" + rating + "</b> / 10</p>" +
      "<p class='center'>" + esc(VB.Stats.lineText(lineSt)) + "</p>" +
      (gainTxt(gains) ? "<p class='center gain'>GROWTH: " + esc(gainTxt(gains)) + "</p>" : "") +
      (after > before ? "<p class='center gain'>OVR " + before + " → " + after + "</p>" : "") +
      (skillNew ? "<p class='center gain'>★ NEW MOVE: " + esc(you().skillName) + "</p>" : "") +
      "<p class='center muted'>COACH TRUST " + Math.round(S.trust) + "</p>",
      [{ label: "CONTINUE", value: 1 }]);
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
    var pool = VB.HQ_TEAMS.map(function (t) { return t.id; }).filter(function (id) { return reg.indexOf(id) < 0; });
    return shuffle(pool).slice(0, n).sort(function (a, b) { return oppDef(a).ovr - oppDef(b).ovr; });
  }
  var Q_NAMES = { 2: ["SEMIFINAL", "FINAL"], 3: ["QUARTERFINAL", "SEMIFINAL", "FINAL"] };
  var N_NAMES = ["ROUND 1", "ROUND 2", "QUARTERFINAL", "SEMIFINAL", "FINAL"];

  // ================== STORY BEATS ==================
  function introText() {
    var t = school(), y = S.year;
    if (y === 1) return "<p>The gym at <b>" + esc(t.name) + "</b> smells like floor wax and effort. Upperclassmen everywhere, and they all look huge.</p>" +
      "<p>" + esc(coach()) + ": \"First-years start at the bottom of the depth chart. Earn your spot — every practice, every match.\"</p>" +
      "<p class='muted'>Your position: " + VB.FAMILY_NAMES[you().role] + ". Starters right now: " + esc(starterTxt()) + ".</p>";
    if (y === 2) return "<p>Second year. The third-years who carried this team have graduated — " + esc(S.lastGrads || "the seniors") + ".</p>" +
      "<p>Now there are first-years watching how <b>you</b> warm up. Nobody calls you the new kid anymore.</p>";
    return "<p>Third year. " + (S.captain ? "The team voted, and the captain's number is yours. " : "Your last year in this jersey. ") +
      "There's no next spring after this one.</p><p>" + esc(coach()) + ": \"Leave everything on that court. Then leave a little more.\"</p>";
  }
  function starterTxt() {
    var l = myLineup(false);
    return VB.ROLES.map(function (r) { return r + " " + l[r].name; }).join(", ");
  }

  async function advance() {
    if (busy || S.done) return;
    busy = true;
    try {
      if (S.pendingEval) { await evaluation(S.pendingEval); S.pendingEval = null; save(); render(); return; }
      var evKey = S.year + "-" + S.phase;
      if (S.evAt !== evKey && PH[S.phase] !== "april" && PH[S.phase] !== "end") {
        S.evAt = evKey;
        if (Math.random() < 0.6) { await randomEvent(); save(); render(); return; }
      }
      var ph = PH[S.phase], t = school();
      if (ph === "april") {
        await U.modal(yearTxt(S.year) + " — APRIL", introText(), [{ label: "LET'S GO", value: 1 }]);
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
          var gwFoe = S.school === "KAR" ? "NEK" : S.school === "NEK" ? "KAR" : pick(VB.HQ_TEAMS.filter(function (x) { return x.id !== S.school; })).id;
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
          await U.modal(m.who, "<p>\"" + esc(m.line) + "\"</p>" +
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
      } else if (ph === "nationals") {
        if (S.springOut) { nextPhase(); }
        else {
          if (!S.bracket) { S.bracket = nationalsField(5); S.step = 0; }
          var nf = S.bracket[S.step], nn = N_NAMES[S.step];
          var nw = await playStory(nf, { label: "SPRING NATIONALS " + nn, league: "SPRING NATIONALS", bestOf: S.step >= 3 ? 3 : 1, floor: "rubber" });
          if (!nw) { S.spring = "Spring Nationals: out in the " + nn + " vs " + team(nf).name; log(S.spring + ".", "result"); S.bracket = null; nextPhase(); }
          else if (S.step === 4) {
            S.spring = "SPRING NATIONALS CHAMPIONS"; S.trophies.push("Y" + S.year + " SPRING NATIONALS CHAMPIONS");
            log("🏆🏆 NATIONAL CHAMPIONS! " + t.name + " stands on top of Japan.", "you");
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
    var note = dm >= 3 ? "\"You've grown more than anyone. Keep it up.\"" : dm >= 1 ? "\"Steady progress. Now show it in matches.\"" :
               "\"You've stalled. Work on your " + ATTR_TXT[S.focus].toLowerCase() + " — and your head.\"";
    snapEval();
    log(kind + " evaluation: OVR " + ovr(me) + " (" + (dm >= 0 ? "+" : "") + dm + "), grade " + grade(ovr(me)) + ".", "you");
    await U.modal(kind + " PLAYER EVALUATION", "<p>" + esc(coach()) + " posts the evaluation sheet on the club-room wall.</p>" +
      "<table class='standings'><tr><th>PLAYER</th><th>POS</th><th>YR</th><th>OVR</th><th>±</th><th>GRADE</th><th></th></tr>" + rows + "</table>" +
      "<p>" + esc(coach()) + " to you: " + esc(note) + "</p><p class='muted'>Grades compare each player to the team's level: S A B C D.</p>",
      [{ label: "CONTINUE", value: 1 }]);
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
    var list = [];
    VB.HQ_TEAMS.forEach(function (t) {
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
                  if (r.q >= 0.5) { S.trust += 2; return "You win the serve-off! " + rv.name + " buys the meat buns. +" + coins(200) + " 🏐 coins."; }
                  return rv.name + " laughs: \"Come back when you can hit the target.\""; } }] }; },
    function () { return { title: "MEAT BUNS", html: "<p>After a brutal practice, " + esc(senior()) + " treats the whole team to meat buns.</p>",
      choices: [{ label: "THANKS, SENPAI!", run: async function () { S.trust += 2; return "Team spirit is up. +" + coins(120) + " 🏐 coins."; } }] }; },
    function () { return { title: "FAN LETTER", html: "<p>There's a letter in your shoe locker: \"I saw your last match. Please keep playing!\"</p>",
      choices: [{ label: "SMILE", run: async function () { return "You read it three times on the way home. +" + coins(300) + " 🏐 coins."; } }] }; },
    function () { return { title: "ANKLE TWEAK", html: "<p>You land on someone's foot during a block drill. It hurts — but not that much?</p>",
      choices: [{ label: "REST IT", run: async function () { return "Two easy days with ice. Nothing lost."; } },
                { label: "TAPE IT & PLAY", run: async function () {
                  if (Math.random() < 0.35) { you().def = Math.max(30, you().def - 1); you().rec = Math.max(30, you().rec - 1); return "It swells up. You lose a little sharpness (-1 DEF, -1 REC)."; }
                  S.trust += 3; return "It holds. " + coach() + " respects the grit."; } }] }; },
    function () { return { title: "NEIGHBOURHOOD ASSOCIATION", html: "<p>The local adults' team needs one more player tonight. Their old setter still has magic hands.</p>",
      choices: [{ label: "PLAY WITH THEM", run: async function () { var r = await drill("rec", "PASSING vs THE ADULTS"); return r.g ? "Great reps. +" + r.g + " " + ATTR_TXT.rec + "." : "They run you ragged. Good lesson."; } },
                { label: "JUST WATCH", run: async function () { var g = addPts(you().role === "S" ? "set" : "att", 0.8); return "You pick up a couple of veteran tricks" + (g ? " (+" + g + ")" : "") + "."; } }] }; },
    function () { return { title: "SUMMER FESTIVAL", html: "<p>The whole team is going to the festival tonight. Fireworks, takoyaki, goldfish scooping.</p>",
      choices: [{ label: "GO WITH THE TEAM", run: async function () { S.trust += 1; return "A team photo you'll keep forever. +" + coins(200) + " 🏐 coins."; } },
                { label: "SHADOW PRACTICE", run: async function () { var g = addPts(S.focus, 1.2); return "You practise footwork alone by the river" + (g ? " (+" + g + " " + ATTR_TXT[S.focus] + ")" : "") + "."; } }] }; },
    function () { return { title: "SERVE CHALLENGE", html: "<p>" + esc(coach()) + " puts a towel on the floor in zone 1. \"Three serves. Hit it.\"</p>",
      choices: [{ label: "TAKE THE CHALLENGE", run: async function () {
        var hits = 0;
        for (var i = 0; i < 3; i++) { var r = await drill("srv", "TOWEL SERVE " + (i + 1) + "/3"); if (r.q >= 0.5) hits++; }
        S.trust += hits; return hits + "/3 on the towel. +" + coins(100 + 120 * hits) + " 🏐 coins."; } }] }; },
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
    var t = school(), line = S.stats[S.year] || VB.Stats.newLine(), me = you();
    var rec = { year: S.year, ovr: ovr(me), ih: S.ih || "—", spring: S.spring || "—", line: VB.Stats.lineText(line), mp: line.mp || 0 };
    S.history.push(rec);
    var grads = S.squad.filter(function (id) { return id !== "you" && S.years[id] >= 3; });
    var html = "<p><b>" + yearTxt(S.year) + " IN REVIEW</b></p><ul><li>INTERHIGH: " + esc(rec.ih) + "</li><li>SPRING: " + esc(rec.spring) + "</li>" +
      "<li>YOU: OVR " + rec.ovr + " • " + esc(rec.line) + " • " + rec.mp + " MATCHES PLAYED</li></ul>";
    if (S.year === 3) {
      html += endingHTML();
      S.done = true; save();
      await U.modal("GRADUATION", html, [{ label: "THE END", value: 1 }]);
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
    if (o >= 93 || S.trophies.some(function (x) { return /SPRING/.test(x); }) && o >= 88) {
      title = "STRAIGHT TO THE PROS"; txt = "SV.League scouts were in the stands all spring. You sign your first professional contract before graduation day.";
    } else if (o >= 88 || champs) {
      title = "UNIVERSITY ACE"; txt = "A top university offers you a place on their team. The national youth coach has your name on a list.";
    } else if (o >= 82) {
      title = "STILL CLIMBING"; txt = "You keep playing at university. You're not done — the small giant inside you is just getting started.";
    } else {
      title = "THE ONE WHO LOVED THE GAME"; txt = "You never became the star, but every weekend you're back in a gym somewhere, chasing the ball you could never quite let fall.";
    }
    return "<h3 class='center'>" + esc(title) + "</h3><p>" + esc(txt) + "</p><p class='center'>FINAL OVR " + o + " (started at " + S.startOvr + ")" +
      (tr ? "<br/>🏆 " + esc(tr) : "") + "</p>";
  }

  // ================== HUB ==================
  function trustBar() {
    var n = Math.round(S.trust / 10);
    return "<span class='form" + (S.trust >= 60 ? " good" : S.trust < 20 ? " bad" : "") + "'>" + "▰".repeat(n) + "▱".repeat(10 - n) + "</span>";
  }
  function nextTxt() {
    if (S.done) return "STORY COMPLETE";
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
        "</td><td>" + p.role + "</td><td>" + S.years[p.id] + "</td><td>" + ovr(p) + "</td><td>" + p.height + "</td><td>" + VB.reach(p).spike + "</td><td>" + (starters[p.id] ? "START" : "") + "</td></tr>";
    }).join("");
    return "<p class='muted'>Style: <b>" + esc((VB.STYLES[VB.PLAY_OF[S.school]] || VB.STYLES.balanced).name) + "</b>" + (school().combo ? " • Signature: " + esc(school().combo.label) : "") + "</p>" +
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
      "<p>🏆 " + esc(S.trophies.join(", ") || "No trophies yet") + "</p>" +
      (rows ? "<table class='standings'><tr><th>YEAR</th><th>OVR</th><th>INTERHIGH</th><th>SPRING</th><th>YOUR LINE</th></tr>" + rows + "</table>" : "");
  }
  function render() {
    var me = you(), t = school(), rch = VB.reach(me), tabs = ["team", "log", "training", "record"];
    var body = tab === "team" ? teamHTML() : tab === "log" ? logHTML() : tab === "training" ? trainingHTML() : recordHTML();
    $("hub").innerHTML =
      "<div class='hub-top'>" +
        "<div class='card me-card'><img class='pix big' src='" + VB.Engine.spriteURL(me.face, t.kit) + "' alt=''/>" +
          "<div><div class='pname'>" + esc(me.name) + (S.captain ? " (C)" : "") + "</div>" +
          "<div class='muted'>" + VB.FAMILY_NAMES[me.role] + " • " + yearTxt(S.year) + " • AGE " + me.age + "</div>" +
          "<div class='ovr'>OVR " + ovr(me) + " <span class='muted'>POT ~" + Math.round(me.pot / 5) * 5 + "</span></div>" +
          "<div class='muted'>HT " + me.height + "cm • VERT " + me.vert + "cm • REACH " + rch.spike + "/" + rch.block + "</div>" +
          "<div>COACH TRUST " + trustBar() + (me.skill ? " <span class='star'>★ " + esc(me.skillName || VB.SKILL_TXT[me.skill]) + "</span>" : S.pendingSkill ? " <span class='muted'>(learning " + esc(S.pendingSkill.name) + ")</span>" : "") + "</div>" +
          "<div class='muted'>" + VB.ATTRS.map(function (a) { return a.toUpperCase() + " " + me[a]; }).join(" • ") + "</div></div></div>" +
        "<div class='card club-card' style='border-color:" + t.kit + "'><div class='pname'>" + esc(t.flag + " " + t.name) + "</div>" +
          "<div class='muted'>" + esc(region(S.school) === "LOCAL" ? "PREFECTURE QUALIFIERS vs LOCAL SCHOOLS" : region(S.school) + " PREFECTURE") + " • " + esc(coach().toUpperCase()) + "</div>" +
          "<div>" + (keyOf(myLineup(false)) ? "<b class='gain'>IN THE STARTING SIX</b>" : "<b>FIGHTING FOR A SPOT</b>") + "</div>" +
          "<div class='muted'>🏆 " + S.trophies.length + " • INTERHIGH: " + esc(S.ih || "—") + " • SPRING: " + esc(S.spring || "—") + "</div></div>" +
      "</div>" +
      "<div class='hub-status'>STORY SLOT " + S.slot + " • " + yearTxt(S.year) + " • " + esc(PH_TXT[PH[S.phase]] || "") + " • " + esc(nextTxt()) + "</div>" +
      "<div class='hub-actions'>" + (S.done ? "" : "<button class='btn big' data-act='advance'>" + esc(PH[S.phase] === "end" ? "SEASON REVIEW" : "CONTINUE STORY") + "</button>") +
        "<button class='btn' data-act='look'>CHANGE LOOK</button><button class='btn pink' data-act='menu'>SAVE &amp; MENU</button></div>" +
      "<div class='tabs'>" + tabs.map(function (x) { return "<button class='tab-btn" + (x === tab ? " on" : "") + "' data-act='tab' data-arg='" + x + "'>" + x.toUpperCase() + "</button>"; }).join("") + "</div>" +
      "<div class='tab-body'>" + body + "</div>";
  }

  // ================== SLOTS & NEW STORY ==================
  function renderSlots() {
    var html = "<h2 class='hub-h'>HAIKYUU!! STORY MODE</h2><p class='center muted'>Join a high-school team as a first-year • three years • Interhigh and Spring Nationals</p><div class='slots'>";
    for (var s = 1; s <= SLOTS; s++) {
      var c = load(s);
      if (c) {
        var p = c.players.you, t = VB.HQ_TEAMS.find(function (x) { return x.id === c.school; }) || (c.locals || []).find(function (x) { return x.id === c.school; });
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
  var HAIR_S = ["spiky", "flat", "bowl", "fluffy", "bedhead", "buzz", "long", "mohawk", "curly"];
  var HAIR_C = [["BLACK", "#17120d"], ["BROWN", "#3a2416"], ["CHESTNUT", "#6b4423"], ["BLOND", "#e8d27a"], ["ORANGE", "#ff7a1a"], ["SILVER", "#d8d8d8"]];
  function renderNew() {
    var t = VB.HQ_TEAMS.find(function (x) { return x.id === setup.school; });
    var face = { skin: VB.SKINS[setup.skin], hair: setup.hairC, style: setup.hairS, mouth: true };
    $("hub").innerHTML = "<h2 class='hub-h'>NEW STORY — SLOT " + setup.slot + "</h2>" +
      "<div class='newcareer'>" +
        "<div class='center'><img class='pix big' src='" + VB.Engine.spriteURL(face, t.kit) + "' alt=''/></div>" +
        "<label>NAME <input id='sName' class='text-in' maxlength='12' value='" + esc(setup.name) + "'/></label>" +
        "<div>SCHOOL</div><div class='focus'>" + VB.HQ_TEAMS.map(function (x) {
          return "<button class='btn" + (setup.school === x.id ? " on" : "") + "' data-act='setSchool' data-arg='" + x.id + "'>" + x.flag + " " + x.name + "</button>"; }).join("") + "</div>" +
        "<div>POSITION</div><div class='focus'>" + ["S", "OH", "MB", "OP", "L"].map(function (f) {
          return "<button class='btn" + (setup.fam === f ? " on" : "") + "' data-act='setFam' data-arg='" + f + "'>" + VB.FAMILY_NAMES[f] + "</button>"; }).join("") + "</div>" +
        "<div>BUILD</div><div class='focus'>" + [["tower", "TOWER — tall, lower jump"], ["balanced", "BALANCED"], ["jumper", "JUMPER — short, huge vertical"]].map(function (b) {
          return "<button class='btn" + (setup.build === b[0] ? " on" : "") + "' data-act='setBuild' data-arg='" + b[0] + "'>" + b[1] + "</button>"; }).join("") + "</div>" +
        "<div>HAIR</div><div class='focus'>" + HAIR_S.map(function (h) {
          return "<button class='btn" + (setup.hairS === h ? " on" : "") + "' data-act='setHairS' data-arg='" + h + "'>" + h.toUpperCase() + "</button>"; }).join("") + "</div>" +
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
    if (act === "focus") { S.focus = arg; save(); return render(); }
    if (act === "look") { busy = true; await VB.editLook(you().face, school().kit, school().kit2, VB.Engine.kitPattern(S.school)); busy = false; save(); return render(); }
    if (act === "menu" || act === "exit") { if (S) save(); S = null; $("hub").onclick = null; var r = exitStory; exitStory = null; return r && r(); }
    if (act === "load") { S = load(+arg); tab = "team"; return render(); }
    if (act === "del") {
      var ok = await U.modal("DELETE STORY?", "<p>Slot " + arg + " will be erased for good.</p>", [{ label: "DELETE", value: true, cls: "pink" }, { label: "KEEP IT", value: false }]);
      if (ok) localStorage.removeItem(SLOT_KEY + arg);
      return renderSlots();
    }
    if (act === "slots") return renderSlots();
    if (act === "new") { setup = { slot: +arg, name: "NEW KID", school: "KAR", fam: "OH", build: "balanced", hairS: "spiky", hairC: "#17120d", skin: 0 }; return renderNew(); }
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
      var EXTRAS = [["glasses", "GLASSES"], ["headband", "HEADBAND"], ["beard", "BEARD"]];
      function draw() {
        var ex = face.ex || [];
        hub.innerHTML = "<h2 class='hub-h'>CHANGE YOUR LOOK</h2><div class='newcareer'>" +
          "<div class='center'><img class='pix big' src='" + VB.Engine.spriteURL(face, kit, kit2, pat) + "' alt=''/></div>" +
          "<div>HAIR</div><div class='focus'>" + HAIR_S.map(function (h) { return "<button class='btn" + (face.style === h ? " on" : "") + "' data-lk='s' data-v='" + h + "'>" + h.toUpperCase() + "</button>"; }).join("") + "</div>" +
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
