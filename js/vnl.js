// Tournaments: pools of four (round robin), then knockout rounds and an awards ceremony.
// Used for the VNL (8 national teams) and Haikyuu!! Spring Nationals (16 high schools).
(function (VB) {
  "use strict";
  var U = VB.ui, $ = U.$, clamp = VB.clamp;

  function stars(ovr) { var n = clamp(Math.round((ovr - 64) / 4.6), 1, 5); return "★★★★★".slice(0, n) + "☆☆☆☆☆".slice(0, 5 - n); }
  var KO_NAMES = { 4: "QUARTERFINAL", 2: "SEMIFINAL", 1: "FINAL" };

  // cfg: { key, recKey, cupKey, title, short, league, size, teams, pickTitle }
  function makeTournament(cfg) {
    var tour = null;
    function T(id) { return cfg.teams.find(function (t) { return t.id === id; }); }
    function record() { try { return JSON.parse(localStorage.getItem(cfg.recKey) || '{"w":0,"l":0}'); } catch (e) { return { w: 0, l: 0 }; } }
    function cups() { return Number(localStorage.getItem(cfg.cupKey)) || 0; }
    function showRecord() { var r = record(); $("recordLine").textContent = "🏆 ×" + cups() + "   RECORD " + r.w + "W-" + r.l + "L"; }
    function save() { try { localStorage.setItem(cfg.key, JSON.stringify(tour)); } catch (e) {} }
    function load() { try { var t = JSON.parse(localStorage.getItem(cfg.key) || "null"); return t && t.ko ? t : null; } catch (e) { return null; } }

    function teamDef(id) {
      var t = T(id);
      return { id: id, name: t.name, short: t.short || t.name, flag: t.flag, kit: t.kit, kit2: t.kit2, ovr: t.ovr, combo: t.combo, play: VB.PLAY_OF[id], lineup: tour.rosters[id] };
    }

    function newTour(myId, playMode, role) {
      var others = VB.shuffle(cfg.teams.filter(function (t) { return t.id !== myId; }));
      var ids = [myId].concat(others.slice(0, cfg.size - 1).map(function (t) { return t.id; }));
      ids = VB.shuffle(ids);                                    // a fresh, random draw every tournament
      var np = cfg.size / 4, pools = [];
      for (var k = 0; k < np; k++) pools.push(ids.slice(k * 4, k * 4 + 4));
      tour = { myId: myId, pools: pools, round: 0, stage: "pool", table: {}, ko: [], koRound: 0, champion: null,
               mode: playMode, myRole: role, rosters: {}, stats: {}, info: {} };
      var taken = {};
      ids.forEach(function (id) {
        var t = T(id);
        tour.table[id] = { w: 0, l: 0, pf: 0, pa: 0 };
        tour.rosters[id] = VB.teamLineup(t, taken);
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
    function simGame(a, b, bestOf) { var s = VB.Stats.simSets(teamDef(a), teamDef(b), bestOf || 1); addStats(s.stats); return [s.a, s.b]; }
    function poolPairs(pool, r) {
      return [[[pool[0], pool[3]], [pool[1], pool[2]]], [[pool[0], pool[2]], [pool[3], pool[1]]], [[pool[0], pool[1]], [pool[2], pool[3]]]][r];
    }
    function poolRank(pool) {
      return pool.slice().sort(function (a, b) {
        var A = tour.table[a], B = tour.table[b];
        return (B.w - A.w) || ((B.pf - B.pa) - (A.pf - A.pa));
      });
    }
    function winner(m) { return m[2] > m[3] ? m[0] : m[1]; }
    function letter(i) { return "ABCD"[i]; }

    function standingsHTML() {
      var h = "";
      tour.pools.forEach(function (pool, pi) {
        h += "<table class='standings'><tr><th>POOL " + letter(pi) + "</th><th>W</th><th>L</th><th>+/-</th></tr>";
        poolRank(pool).forEach(function (id, idx) {
          var s = tour.table[id], cls = (id === tour.myId ? "you " : "") + (tour.stage !== "pool" && idx < 2 ? "q" : "");
          h += "<tr class='" + cls + "'><td>" + T(id).flag + " " + T(id).name + "</td><td>" + s.w + "</td><td>" + s.l + "</td><td>" + (s.pf - s.pa) + "</td></tr>";
        });
        h += "</table>";
      });
      if (tour.ko.length) {
        h += "<table class='standings'><tr><th>KNOCKOUT</th><th></th></tr>";
        tour.ko.forEach(function (round) {
          round.forEach(function (m) {
            h += "<tr" + (m[0] === tour.myId || m[1] === tour.myId ? " class='you'" : "") + "><td>" + KO_NAMES[round.length].slice(0, 5) + ": " +
                 T(m[0]).name + " vs " + T(m[1]).name + "</td><td>" + (m[2] != null ? m[2] + ":" + m[3] : "") + "</td></tr>";
          });
        });
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

    async function playMine(foeId, label, bestOf) {
      var res = await VB.Engine.playMatch({
        mine: teamDef(tour.myId), foe: teamDef(foeId), homeSide: Math.random() < 0.5 ? 0 : 1,
        mode: tour.mode, myRole: tour.myRole, label: label + (bestOf > 1 ? " • BEST OF 3" : ""), league: cfg.league, floor: cfg.floor, bestOf: bestOf || 1
      });
      addStats(res.stats);
      var r = record(); if (res.won) r.w++; else r.l++;
      localStorage.setItem(cfg.recKey, JSON.stringify(r));
      showRecord();
      return res;
    }

    function firstKnockout() {
      var R = tour.pools.map(poolRank);
      tour.ko = [R.length === 2 ? [[R[0][0], R[1][1], null, null], [R[1][0], R[0][1], null, null]]
                                : [[R[0][0], R[1][1], null, null], [R[2][0], R[3][1], null, null],
                                   [R[1][0], R[0][1], null, null], [R[3][0], R[2][1], null, null]]];
      tour.koRound = 0;
      tour.stage = "ko";
    }

    async function ceremony() {
      var bonus = {}, last = tour.ko[tour.ko.length - 1][0];
      tour.ko.forEach(function (round) { round.forEach(function (m) { bonus[m[0]] = (bonus[m[0]] || 0) + 2; bonus[m[1]] = (bonus[m[1]] || 0) + 2; }); });
      bonus[tour.champion] = (bonus[tour.champion] || 0) + 10;
      var list = VB.Stats.awards(tour.stats, tour.info, bonus);
      var champ = T(tour.champion);
      var runner = last[0] === tour.champion ? last[1] : last[0], third = null;
      (tour.ko[tour.ko.length - 2] || []).forEach(function (m) { var l = winner(m) === m[0] ? m[1] : m[0]; if (!third || T(l).ovr > T(third).ovr) third = l; });
      function pod(id) { var t = T(id); return { id: id, name: t.name, kit: t.kit, kit2: t.kit2, faces: VB.ROLES.map(function (r) { return tour.rosters[id][r].face; }) }; }
      await VB.Ceremony.play({ title: cfg.title + " AWARDS", sub: "FINAL: " + T(last[0]).name + " " + last[2] + ":" + last[3] + " " + T(last[1]).name,
                               podium: [pod(tour.champion), pod(runner)].concat(third ? [pod(third)] : []), awards: VB.Ceremony.fromAwards(list) });
      await U.modal("🏆 " + cfg.title + " AWARDS",
        "<p class='center'>CHAMPIONS: <b>" + champ.flag + " " + champ.name + "</b> • FINAL " + T(last[0]).name + " " + last[2] + ":" + last[3] + " " + T(last[1]).name + "</p>" +
        VB.Stats.awardsHTML(list) + "<h3 class='mini'>TOURNAMENT LEADERS</h3>" + VB.Stats.leadersHTML(tour.stats, tour.info, 5),
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
        var res = await playMine(foeId, cfg.short + " POOL • ROUND " + (r + 1) + "/3");
        applyResult(tour.myId, foeId, res.score[0], res.score[1]);
        sims.forEach(function (pair) { var s = simGame(pair[0], pair[1]); applyResult(pair[0], pair[1], s[0], s[1]); });
        tour.round++;
        if (tour.round >= 3) firstKnockout();
        save();
        var inKo = tour.stage === "ko" && tour.ko[0].some(function (m) { return m[0] === tour.myId || m[1] === tour.myId; });
        await showTable("STANDINGS", tour.stage === "ko" ? (inKo ? "YOU'RE THROUGH! TOP 2 OF EACH POOL ADVANCE" : "ELIMINATED — THE KNOCKOUTS WILL BE SIMULATED") : "ROUND " + (tour.round + 1) + " OF 3 UP NEXT",
                        tour.stage === "ko" ? "TO THE KNOCKOUTS" : "NEXT MATCH");
      }
      while (tour.stage === "ko") {
        var round = tour.ko[tour.koRound], name = KO_NAMES[round.length], bo = round.length <= 2 ? 3 : 1;   // semis and final: best of 3
        for (var i = 0; i < round.length; i++) {
          var m = round[i];
          if (m[0] === tour.myId || m[1] === tour.myId) {
            var foe = m[0] === tour.myId ? m[1] : m[0];
            var rs = await playMine(foe, cfg.short + " " + name, bo);
            m[2] = m[0] === tour.myId ? rs.score[0] : rs.score[1];
            m[3] = m[0] === tour.myId ? rs.score[1] : rs.score[0];
            if (name === "FINAL" && rs.won) localStorage.setItem(cfg.cupKey, String(cups() + 1));
          } else {
            var s = simGame(m[0], m[1], bo); m[2] = s[0]; m[3] = s[1];
          }
        }
        if (round.length === 1) {
          tour.champion = winner(round[0]);
          tour.stage = "done"; save(); showRecord();
          var won = tour.champion === tour.myId;
          await showTable(won ? "🏆 CHAMPIONS!!" : T(tour.champion).name + " ARE CHAMPIONS", won ? T(tour.myId).name + " WIN THE " + cfg.title + "!" : "", "AWARDS CEREMONY");
          await ceremony();
          localStorage.removeItem(cfg.key);
          tour = null;
          return;
        }
        var next = [];
        for (var k = 0; k < round.length; k += 2) next.push([winner(round[k]), winner(round[k + 1]), null, null]);
        tour.ko.push(next); tour.koRound++;
        save();
        var alive = next.some(function (mm) { return mm[0] === tour.myId || mm[1] === tour.myId; });
        var nextName = KO_NAMES[next.length];
        await showTable(name + " RESULTS", alive ? "ON TO THE " + nextName + "!" : "YOU'RE OUT — THE REST WILL BE SIMULATED", alive ? "PLAY THE " + nextName : "CONTINUE");
      }
    }

    async function start() {
      U.showView("match");
      showRecord();
      $("stageLine").textContent = cfg.title;
      var saved = load();
      if (saved && saved.stage !== "done") {
        tour = saved;
        U.feed(-1, "— TOURNAMENT RESUMED —");
      } else {
        U.msg("PICK YOUR TEAM");
        var mine = await U.pickFrom("CHOOSE YOUR TEAM — " + cfg.size + "-TEAM TOURNAMENT", cfg.teams.map(function (t) {
          return { html: "<span>" + t.flag + " " + t.name + "</span><span class='stars'>" + stars(t.ovr) + "</span>", value: t };
        }), cfg.pickTitle);
        var playMode = await U.pickFrom("HOW DO YOU WANT TO PLAY?", [
          { html: "<span>🎮 FULL TEAM</span><span class='stars'>CALL IT ALL</span>", value: "full" },
          { html: "<span>🧍 ONE ROLE</span><span class='stars'>BE 1 PLAYER</span>", value: "role" }
        ], cfg.pickTitle);
        var role = null;
        if (playMode === "role") {
          role = await U.pickFrom("PICK YOUR PLAYER — LOCKED FOR THE WHOLE TOURNAMENT", VB.ROLES.map(function (r) {
            var nm = (mine.players || {})[r];
            return { html: "<span>" + VB.FAMILY_NAMES[VB.FAMILY[r]] + "</span><span class='stars'>" + (nm || "SQUAD PLAYER") + ((mine.stars || {})[r] ? " ★" : "") + "</span>", value: r };
          }), cfg.pickTitle);
        }
        newTour(mine.id, playMode, role);
        await showTable("TOURNAMENT DRAW", "RANDOM DRAW • POOL PLAY: 3 MATCHES, TOP 2 OF EACH POOL ADVANCE • SEMIS & FINAL ARE BEST OF 3", "START POOL PLAY");
      }
      await run();
    }

    return {
      start: start,
      hasSave: function () { var s = load(); return !!(s && s.stage !== "done"); },
      reset: function () { localStorage.removeItem(cfg.key); localStorage.removeItem(cfg.recKey); localStorage.removeItem(cfg.cupKey); }
    };
  }

  VB.VNL = makeTournament({ key: "retroVNL.tour3", recKey: "retroVNL.record", cupKey: "retroVNL.cups", title: "VNL", short: "VNL",
                            league: "VNL", floor: "vnl", size: 8, teams: VB.NATIONAL, pickTitle: "VNL VOLLEY" });
  VB.HQ = makeTournament({ key: "retroHQ.tour", recKey: "retroHQ.record", cupKey: "retroHQ.cups", title: "SPRING NATIONALS", short: "SPRING NATS",
                           league: "HARUKO", floor: "rubber", size: 16, teams: VB.HQ_TEAMS, pickTitle: "HAIKYUU!! SPRING NATIONALS" });
})(window.VB);
