// Box scores, simulated matches, performance ratings and awards.
(function (VB) {
  "use strict";
  var rnd = VB.rnd, clamp = VB.clamp, esc = VB.ui.esc;
  var KEYS = ["k", "att", "ae", "bk", "ace", "se", "dig", "blk", "ast", "rc", "rp", "re"];

  function newLine() { var l = { mp: 0 }; KEYS.forEach(function (k) { l[k] = 0; }); return l; }
  function addInto(a, l) { KEYS.forEach(function (k) { a[k] += l[k] || 0; }); a.mp += 1; return a; }
  function pts(l) { return l.k + l.ace + l.blk; }
  // kill efficiency the way box scores do it: (kills − errors − blocked) / attempts
  function eff(l) { return l.att ? (l.k - l.ae - l.bk) / l.att : 0; }
  function effTxt(l) { return l.att ? Math.round(eff(l) * 100) + "%" : "—"; }

  function distribute(total, weights) {
    var sum = weights.reduce(function (a, b) { return a + b; }, 0) || 1, out = weights.map(function () { return 0; });
    for (var i = 0; i < total; i++) {
      var r = Math.random() * sum, acc = 0;
      for (var j = 0; j < weights.length; j++) { acc += weights[j]; if (r <= acc) { out[j]++; break; } }
    }
    return out;
  }

  // plausible box score for a team that scored P points and conceded Q
  function simTeam(team, P, Q) {
    var L = team.lineup, R = VB.ROLES, out = {};
    R.forEach(function (r) { out[L[r].id] = Object.assign(newLine(), { name: L[r].name, role: r }); });
    function w(fn) { return R.map(function (r) { return Math.max(0, fn(L[r], r)); }); }
    function put(key, counts) { R.forEach(function (r, i) { out[L[r].id][key] += counts[i]; }); }
    var kills = Math.round(P * rnd(0.6, 0.72)), blocks = Math.round(P * rnd(0.07, 0.15)), aces = Math.round(P * rnd(0.03, 0.1));
    var kw = { OP: 0.28, OH1: 0.22, OH2: 0.2, MB1: 0.11, MB2: 0.11, S: 0.03, L: 0 };
    var k = distribute(kills, w(function (p, r) { return kw[r] * Math.pow(p.att / 80, 2); }));
    put("k", k);
    R.forEach(function (r, i) {
      var l = out[L[r].id];
      if (!k[i] && r !== "OP" && r.indexOf("OH") !== 0) return;
      l.att = Math.round(k[i] / rnd(0.42, 0.58)) + (r === "OP" || r.indexOf("OH") === 0 ? VB.irnd(1, 4) : 0);
      l.ae = Math.round(l.att * rnd(0.04, 0.12));
      l.bk = Math.round(l.att * rnd(0.03, 0.1));
    });
    var bw = { MB1: 0.3, MB2: 0.3, OP: 0.15, OH1: 0.1, OH2: 0.1, S: 0.05, L: 0 };
    put("blk", distribute(blocks, w(function (p, r) { return bw[r] * p.blk / 80; })));
    put("ace", distribute(aces, w(function (p, r) { return r === "L" ? 0 : Math.pow(p.srv / 80, 3); })));
    put("se", distribute(VB.irnd(1, 4), w(function (p, r) { return r === "L" ? 0 : 1; })));
    var dw = { L: 0.3, OH1: 0.17, OH2: 0.17, S: 0.12, OP: 0.12, MB1: 0.06, MB2: 0.06 };
    put("dig", distribute(Math.round(Q * rnd(0.9, 1.4)), w(function (p, r) { return dw[r] * p.def / 80; })));
    var rw = { L: 0.45, OH1: 0.27, OH2: 0.28 };
    var recs = distribute(Math.round(Q * rnd(0.55, 0.75)), w(function (p, r) { return rw[r] || 0; }));
    R.forEach(function (r, i) {
      var l = out[L[r].id], p = L[r];
      l.rc = recs[i];
      l.rp = Math.round(recs[i] * clamp(rnd(0.25, 0.5) * p.rec / 80, 0, 0.7));
      l.re = Math.round(recs[i] * rnd(0.02, 0.1));
    });
    out[L.S.id].ast = Math.round(kills * rnd(0.78, 0.9));
    return out;
  }

  function teamOvr(team) {
    if (team.ovr) return team.ovr;
    var s = 0; VB.ROLES.forEach(function (r) { s += VB.ovr(team.lineup[r]); });
    return Math.round(s / 7);
  }

  // a whole simulated match (first to 15, win by 2)
  function sim(A, B) {
    var pA = clamp(0.5 + (teamOvr(A) - teamOvr(B)) * 0.014, 0.12, 0.88), a = 0, b = 0;
    while (!((a >= 15 || b >= 15) && Math.abs(a - b) >= 2) && a < 25 && b < 25) { if (Math.random() < pA) a++; else b++; }
    var stats = Object.assign(simTeam(A, a, b), simTeam(B, b, a));
    return { a: a, b: b, stats: stats };
  }

  // a best-of-N match, simulated set by set
  function simSets(A, B, bestOf) {
    var need = Math.ceil((bestOf || 1) / 2), wa = 0, wb = 0, stats = {}, sets = [];
    while (wa < need && wb < need) {
      var s = sim(A, B);
      if (s.a > s.b) wa++; else wb++;
      sets.push([s.a, s.b]);
      Object.keys(s.stats).forEach(function (k) { if (stats[k]) { addInto(stats[k], s.stats[k]); stats[k].mp--; } else stats[k] = s.stats[k]; });
    }
    return need > 1 ? { a: wa, b: wb, stats: stats, sets: sets } : { a: sets[0][0], b: sets[0][1], stats: stats, sets: sets };
  }

  // 3.0 .. 10.0 match rating for one player
  function rating(l, fam, won) {
    var r = 6 + pts(l) * 0.22 + (l.att >= 3 ? eff(l) * 3 : 0) + l.dig * 0.12 - (l.se + l.re) * 0.35 + (won ? 0.4 : -0.3);
    if (fam === "L") r += l.dig * 0.12 + l.rp * 0.15;
    if (fam === "S") r += l.ast * 0.08;
    if (fam === "MB") r += l.blk * 0.2;
    return Math.round(clamp(r, 3, 10) * 10) / 10;
  }

  function lineText(l) {
    var parts = ["PTS " + pts(l)];
    if (l.att) parts.push("K " + l.k + "/" + l.att + " (" + effTxt(l) + ")");
    if (l.ace) parts.push("ACE " + l.ace);
    if (l.blk) parts.push("BLK " + l.blk);
    if (l.dig) parts.push("DIG " + l.dig);
    if (l.ast) parts.push("AST " + l.ast);
    if (l.rc) parts.push("REC " + l.rp + "/" + l.rc);
    return parts.join(" • ");
  }

  // ---- awards: MVP + dream team + stat leaders ----
  function catScore(l, fam) {
    var e = l.att >= 8 ? eff(l) : 0, p = pts(l);
    switch (fam) {
      case "OH": return p + 0.5 * l.dig + 0.6 * l.rp - 1.5 * l.re + 30 * e;
      case "MB": return 2 * l.blk + l.k + 25 * e;
      case "OP": return p + 30 * e;
      case "S":  return 0.35 * l.ast + l.dig + 1.5 * l.blk + 2 * l.ace;
      case "L":  return l.dig + 1.2 * l.rp - 2 * l.re;
    }
    return p;
  }
  // agg: { pid: line }, info: { pid: { name, fam, team, flag, kit, face, teamId } }, bonus: { teamId: n }
  function awards(agg, info, bonus) {
    var ids = Object.keys(agg).filter(function (id) { return info[id] && agg[id].mp >= 1; });
    function best(fn, n, filter) {
      return ids.filter(filter || function () { return true; })
                .sort(function (a, b) { return fn(b) - fn(a); }).slice(0, n || 1);
    }
    function fam(f) { return function (id) { return info[id].fam === f; }; }
    function bon(id) { return (bonus || {})[info[id].teamId] || 0; }
    var out = [];
    function add(title, list) { list.forEach(function (id) { out.push({ title: title, id: id, info: info[id], line: lineText(agg[id]) }); }); }
    add("MOST VALUABLE PLAYER", best(function (id) {
      var l = agg[id]; return pts(l) + 0.4 * l.dig + 0.25 * l.ast + 0.5 * l.rp + (l.att >= 10 ? 25 * eff(l) : 0) + bon(id);
    }, 1));
    add("BEST SETTER", best(function (id) { return catScore(agg[id], "S") + bon(id) * 0.5; }, 1, fam("S")));
    add("BEST OUTSIDE HITTER", best(function (id) { return catScore(agg[id], "OH") + bon(id) * 0.3; }, 2, fam("OH")));
    add("BEST MIDDLE BLOCKER", best(function (id) { return catScore(agg[id], "MB") + bon(id) * 0.3; }, 2, fam("MB")));
    add("BEST OPPOSITE", best(function (id) { return catScore(agg[id], "OP") + bon(id) * 0.3; }, 1, fam("OP")));
    add("BEST LIBERO", best(function (id) { return catScore(agg[id], "L") + bon(id) * 0.3; }, 1, fam("L")));
    add("TOP SCORER", best(function (id) { return pts(agg[id]); }, 1));
    add("BEST SERVER", best(function (id) { return agg[id].ace + Math.random() * 0.1; }, 1));
    add("BEST BLOCKER", best(function (id) { return agg[id].blk + Math.random() * 0.1; }, 1));
    add("BEST DIGGER", best(function (id) { return agg[id].dig + Math.random() * 0.1; }, 1));
    return out;
  }

  function awardsHTML(list) {
    return "<div class='awards'>" + list.map(function (a) {
      var i = a.info;
      return "<div class='award" + (a.title === "MOST VALUABLE PLAYER" ? " mvp" : "") + (i.you ? " you" : "") + "'>" +
        "<img class='pix' src='" + VB.Engine.spriteURL(i.face, i.kit) + "' alt=''/>" +
        "<div><div class='award-title'>" + esc(a.title) + "</div>" +
        "<div class='award-name'>" + esc(i.name) + (i.you ? " (YOU)" : "") + " <span class='muted'>" + esc((i.flag || "") + " " + i.team) + "</span></div>" +
        "<div class='award-line'>" + esc(a.line) + "</div></div></div>";
    }).join("") + "</div>";
  }

  // scoresheet table; lines: [{ name, role, you?, ...stat }]
  function sheetHTML(title, lines) {
    var tot = newLine();
    var rows = lines.map(function (l) {
      KEYS.forEach(function (k) { tot[k] += l[k] || 0; });
      return "<tr" + (l.you ? " class='you'" : "") + "><td>" + esc(l.role) + " " + esc(l.name) + "</td><td>" + pts(l) + "</td><td>" +
        l.k + "</td><td>" + l.att + "</td><td>" + effTxt(l) + "</td><td>" + l.ace + "</td><td>" + l.blk + "</td><td>" +
        l.dig + "</td><td>" + l.ast + "</td><td>" + (l.rc ? l.rp + "/" + l.rc : "—") + "</td></tr>";
    }).join("");
    return "<table class='sheet'><tr><th>" + esc(title) + "</th><th>PTS</th><th>K</th><th>ATT</th><th>EFF</th><th>ACE</th><th>BLK</th><th>DIG</th><th>AST</th><th>REC</th></tr>" +
      rows + "<tr class='tot'><td>TOTAL</td><td>" + pts(tot) + "</td><td>" + tot.k + "</td><td>" + tot.att + "</td><td>" + effTxt(tot) +
      "</td><td>" + tot.ace + "</td><td>" + tot.blk + "</td><td>" + tot.dig + "</td><td>" + tot.ast + "</td><td>" +
      (tot.rc ? tot.rp + "/" + tot.rc : "—") + "</td></tr></table>";
  }

  // top-n tables for points, aces, blocks, digs
  function leadersHTML(agg, info, n, youId) {
    var ids = Object.keys(agg).filter(function (id) { return info[id]; });
    function col(title, fn) {
      var top = ids.slice().sort(function (a, b) { return fn(agg[b]) - fn(agg[a]); }).slice(0, n);
      return "<table class='standings'><tr><th>" + title + "</th><th></th></tr>" + top.map(function (id) {
        return "<tr" + (id === youId ? " class='you'" : "") + "><td>" + esc((info[id].flag || "") + " " + info[id].name) + "</td><td>" + fn(agg[id]) + "</td></tr>";
      }).join("") + "</table>";
    }
    return "<div class='leaders'>" + col("POINTS", pts) + col("ACES", function (l) { return l.ace; }) +
      col("BLOCKS", function (l) { return l.blk; }) + col("DIGS", function (l) { return l.dig; }) + "</div>";
  }

  VB.Stats = {
    KEYS: KEYS, newLine: newLine, addInto: addInto, pts: pts, eff: eff, effTxt: effTxt,
    sim: sim, simSets: simSets, simTeam: simTeam, teamOvr: teamOvr, rating: rating, lineText: lineText,
    awards: awards, awardsHTML: awardsHTML, sheetHTML: sheetHTML, leadersHTML: leadersHTML
  };
})(window.VB);
