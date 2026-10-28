// VNL mode: 8 national teams, two pools, semifinals, final, then individual awards.
(function (VB) {
  "use strict";
  var U = VB.ui, $ = U.$, irnd = VB.irnd, clamp = VB.clamp;
  var KEY = "retroVNL.tour2", REC_KEY = "retroVNL.record", CUP_KEY = "retroVNL.cups";
  var tour = null;

  function record() { try { return JSON.parse(localStorage.getItem(REC_KEY) || '{"w":0,"l":0}'); } catch (e) { return { w: 0, l: 0 }; } }
  function cups() { return Number(localStorage.getItem(CUP_KEY)) || 0; }
  function showRecord() { var r = record(); $("recordLine").textContent = "🏆 ×" + cups() + "   RECORD " + r.w + "W-" + r.l + "L"; }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(tour)); } catch (e) {} }
  function load() { try { return JSON.parse(localStorage.getItem(KEY) || "null"); } catch (e) { return null; } }
  function T(id) { return VB.nationalById(id); }
  function stars(ovr) { var n = clamp(Math.round((ovr - 60) / 8), 1, 5); return "★★★★★".slice(0, n) + "☆☆☆☆☆".slice(0, 5 - n); }

  function teamDef(id) {
    var t = T(id);
    return { id: id, name: t.name, short: t.name, flag: t.flag, kit: t.kit, kit2: t.kit2, ovr: t.ovr, lineup: tour.rosters[id] };
  }

  function newTour(myId, playMode, role) {
    var others = VB.shuffle(VB.NATIONAL.filter(function (t) { return t.id !== myId; }));
    var ids = [myId].concat(others.slice(0, 7).map(function (t) { return t.id; }));
    ids.sort(function (a, b) { return T(b).ovr - T(a).ovr; });
    tour = { myId: myId, pools: [[ids[0], ids[3], ids[4], ids[7]], [ids[1], ids[2], ids[5], ids[6]]], round: 0, stage: "pool",
             table: {}, semis: null, final: null, champion: null, mode: playMode, myRole: role,
             rosters: {}, stats: {}, info: {} };
    ids.forEach(function (id) {
      var t = T(id);
      tour.table[id] = { w: 0, l: 0, pf: 0, pa: 0 };
      tour.rosters[id] = VB.nationalLineup(t);
      VB.ROLES.forEach(function (r) {
        var p = tour.rosters[id][r];
        tour.info[p.id] = { name: p.name, fam: p.role, team: t.name, teamId: id, flag: t.flag, kit: r === "L" ? "#ffd21e" : t.kit, face: p.face,
                            you: id === myId && playMode === "role" && r === role };
      });
    });
    save();
  }

  function addStats(stats) {
    Object.keys(stats).forEach(function (pid) {
      if (!tour.info[pid]) return;
      tour.stats[pid] = VB.Stats.addInto(tour.stats[pid] || VB.Stats.newLine(), stats[pid]);
    });
  }
  function applyResult(a, b, sa, sb) {
    var ta = tour.table[a], tb = tour.table[b];
    if (sa > sb) { ta.w++; tb.l++; } else { tb.w++; ta.l++; }
    ta.pf += sa; ta.pa += sb; tb.pf += sb; tb.pa += sa;
  }
  function simGame(a, b) { var s = VB.Stats.sim(teamDef(a), teamDef(b)); addStats(s.stats); return [s.a, s.b]; }
  function poolPairs(pool, r) {
    return [[[pool[0], pool[3]], [pool[1], pool[2]]], [[pool[0], pool[2]], [pool[3], pool[1]]], [[pool[0], pool[1]], [pool[2], pool[3]]]][r];
  }
  function poolRank(pool) {
    return pool.slice().sort(function (a, b) {
      var A = tour.table[a], B = tour.table[b];
      return (B.w - A.w) || ((B.pf - B.pa) - (A.pf - A.pa));
    });
  }

  function standingsHTML() {
    var h = "";
    tour.pools.forEach(function (pool, pi) {
      h += "<table class='standings'><tr><th>POOL " + (pi ? "B" : "A") + "</th><th>W</th><th>L</th><th>+/-</th></tr>";
      poolRank(pool).forEach(function (id, idx) {
        var s = tour.table[id], cls = (id === tour.myId ? "you " : "") + (tour.stage !== "pool" && idx < 2 ? "q" : "");
        h += "<tr class='" + cls + "'><td>" + T(id).flag + " " + T(id).name + "</td><td>" + s.w + "</td><td>" + s.l + "</td><td>" + (s.pf - s.pa) + "</td></tr>";
      });
      h += "</table>";
    });
    if (tour.semis) {
      h += "<table class='standings'><tr><th>PLAYOFFS</th><th></th></tr>";
      tour.semis.forEach(function (m) { h += "<tr><td>SF: " + T(m[0]).name + " vs " + T(m[1]).name + "</td><td>" + (m[2] != null ? m[2] + ":" + m[3] : "") + "</td></tr>"; });
      if (tour.final) h += "<tr><td>FINAL: " + T(tour.final[0]).name + " vs " + T(tour.final[1]).name + "</td><td>" + (tour.final[2] != null ? tour.final[2] + ":" + tour.final[3] : "") + "</td></tr>";
      h += "</table>";
    }
    if (Object.keys(tour.stats).length) h += "<div style='width:100%'><h3 class='mini'>TOURNAMENT LEADERS</h3>" + VB.Stats.leadersHTML(tour.stats, tour.info, 3) + "</div>";
    return h;
  }
  function showTable(title, note, btnLabel) {
    return new Promise(function (res) {
      $("tableTitle").textContent = title;
      $("tableBody").innerHTML = standingsHTML();
      $("tableNote").textContent = note || "";
      var b = $("nextBtn");
      b.textContent = btnLabel || "NEXT MATCH";
      $("tableScreen").classList.remove("hidden");
      b.onclick = function () { $("tableScreen").classList.add("hidden"); res(); };
    });
  }

  async function playMine(foeId, label) {
    var myFirst = Math.random() < 0.5;
    var res = await VB.Engine.playMatch({
      mine: teamDef(tour.myId), foe: teamDef(foeId), homeSide: myFirst ? 0 : 1,
      mode: tour.mode, myRole: tour.myRole, label: label, league: "VNL"
    });
    addStats(res.stats);
    var r = record(); if (res.won) r.w++; else r.l++;
    localStorage.setItem(REC_KEY, JSON.stringify(r));
    showRecord();
    return res;
  }

  async function ceremony() {
    var bonus = {};
    (tour.semis || []).forEach(function (m) { bonus[m[0]] = 3; bonus[m[1]] = 3; });
    if (tour.final) { bonus[tour.final[0]] = 8; bonus[tour.final[1]] = 8; }
    if (tour.champion) bonus[tour.champion] = 15;
    var list = VB.Stats.awards(tour.stats, tour.info, bonus);
    var champ = T(tour.champion);
    await U.modal("🏆 VNL AWARDS",
      "<p class='center'>CHAMPIONS: <b>" + champ.flag + " " + champ.name + "</b></p>" + VB.Stats.awardsHTML(list) +
      "<h3 class='mini'>TOURNAMENT LEADERS</h3>" + VB.Stats.leadersHTML(tour.stats, tour.info, 5),
      [{ label: "BACK TO MENU", value: true }]);
  }

  async function run() {
    while (tour.stage === "pool") {
      var r = tour.round, myMatch = null, sims = [];
      tour.pools.forEach(function (pool) {
        poolPairs(pool, r).forEach(function (pair) {
          if (pair[0] === tour.myId || pair[1] === tour.myId) myMatch = pair; else sims.push(pair);
        });
      });
      var foeId = myMatch[0] === tour.myId ? myMatch[1] : myMatch[0];
      var res = await playMine(foeId, "VNL POOL • ROUND " + (r + 1) + "/3");
      applyResult(tour.myId, foeId, res.score[0], res.score[1]);
      sims.forEach(function (pair) { var s = simGame(pair[0], pair[1]); applyResult(pair[0], pair[1], s[0], s[1]); });
      tour.round++;
      if (tour.round >= 3) {
        tour.stage = "semi";
        var A = poolRank(tour.pools[0]), B = poolRank(tour.pools[1]);
        tour.semis = [[A[0], B[1], null, null], [B[0], A[1], null, null]];
      }
      save();
      await showTable("STANDINGS", tour.stage === "semi" ? "TOP 2 OF EACH POOL ADVANCE" : "ROUND " + (tour.round + 1) + " OF 3 UP NEXT",
                      tour.stage === "semi" ? "TO THE PLAYOFFS" : "NEXT MATCH");
    }
    if (tour.stage === "semi") {
      var mySemi = tour.semis.find(function (m) { return m[0] === tour.myId || m[1] === tour.myId; });
      tour.semis.forEach(function (m) {
        if (m === mySemi) return;
        var s = simGame(m[0], m[1]); m[2] = s[0]; m[3] = s[1];
      });
      if (mySemi) {
        var foe2 = mySemi[0] === tour.myId ? mySemi[1] : mySemi[0];
        var rs = await playMine(foe2, "VNL SEMIFINAL");
        mySemi[2] = mySemi[0] === tour.myId ? rs.score[0] : rs.score[1];
        mySemi[3] = mySemi[0] === tour.myId ? rs.score[1] : rs.score[0];
      }
      tour.final = tour.semis.map(function (m) { return m[2] > m[3] ? m[0] : m[1]; }).concat([null, null]);
      tour.stage = "final"; save();
      var inFinal = tour.final[0] === tour.myId || tour.final[1] === tour.myId;
      await showTable(inFinal ? "YOU'RE IN THE FINAL!" : (mySemi ? "OUT IN THE SEMIS" : "ELIMINATED IN POOLS"),
                      inFinal ? "ONE MATCH FOR THE TROPHY" : "THE FINAL WILL BE SIMULATED", inFinal ? "PLAY THE FINAL" : "SEE THE FINAL");
    }
    if (tour.stage === "final") {
      var f = tour.final;
      if (f[0] === tour.myId || f[1] === tour.myId) {
        var foeF = f[0] === tour.myId ? f[1] : f[0];
        var rf = await playMine(foeF, "VNL FINAL");
        f[2] = f[0] === tour.myId ? rf.score[0] : rf.score[1];
        f[3] = f[0] === tour.myId ? rf.score[1] : rf.score[0];
        if (rf.won) localStorage.setItem(CUP_KEY, String(cups() + 1));
      } else {
        var sf = simGame(f[0], f[1]); f[2] = sf[0]; f[3] = sf[1];
      }
      tour.champion = f[2] > f[3] ? f[0] : f[1];
      tour.stage = "done"; save(); showRecord();
      var won = tour.champion === tour.myId;
      await showTable(won ? "🏆 CHAMPIONS!!" : T(tour.champion).name + " WINS THE VNL", won ? T(tour.myId).name + " WINS THE VNL!" : "", "AWARDS CEREMONY");
      await ceremony();
      localStorage.removeItem(KEY);
      tour = null;
    }
  }

  async function start() {
    U.showView("match");
    showRecord();
    $("stageLine").textContent = "VOLLEYBALL NATIONS LEAGUE";
    var saved = load();
    if (saved && saved.stage !== "done" && saved.rosters) {
      tour = saved;
      U.feed(-1, "— TOURNAMENT RESUMED —");
    } else {
      U.msg("PICK YOUR NATION");
      var mine = await U.pickFrom("CHOOSE YOUR NATION — 8-TEAM TOURNAMENT", VB.NATIONAL.map(function (t) {
        return { html: "<span>" + t.flag + " " + t.name + "</span><span class='stars'>" + stars(t.ovr) + "</span>", value: t };
      }), "VNL VOLLEY");
      var playMode = await U.pickFrom("HOW DO YOU WANT TO PLAY?", [
        { html: "<span>🎮 FULL TEAM</span><span class='stars'>CALL IT ALL</span>", value: "full" },
        { html: "<span>🧍 ONE ROLE</span><span class='stars'>BE 1 PLAYER</span>", value: "role" }
      ], "VNL VOLLEY");
      var role = null;
      if (playMode === "role") {
        role = await U.pickFrom("PICK YOUR PLAYER — LOCKED FOR THE WHOLE TOURNAMENT", VB.ROLES.map(function (r) {
          return { html: "<span>" + VB.FAMILY_NAMES[VB.FAMILY[r]] + "</span><span class='stars'>" + mine.players[r] + (mine.stars[r] ? " ★" : "") + "</span>", value: r };
        }), "VNL VOLLEY");
      }
      newTour(mine.id, playMode, role);
      await showTable("TOURNAMENT DRAW", "POOL PLAY: 3 MATCHES, TOP 2 ADVANCE TO THE SEMIS", "START POOL PLAY");
    }
    await run();
  }

  VB.VNL = {
    start: start,
    hasSave: function () { var s = load(); return !!(s && s.stage !== "done" && s.rosters); },
    reset: function () { localStorage.removeItem(KEY); localStorage.removeItem(REC_KEY); localStorage.removeItem(CUP_KEY); }
  };
})(window.VB);
