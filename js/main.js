// Main menu: pick VNL (national teams) or Club Career.
(function (VB) {
  "use strict";
  var U = VB.ui, $ = U.$;

  function readJSON(k) { try { return JSON.parse(localStorage.getItem(k) || "null"); } catch (e) { return null; } }
  // everything you've won, across every save: shown as a profile strip on the home screen
  function profile() {
    var P = { titles: 0, awards: 0, caps: 0, saves: 0, wins: 0, losses: 0 };
    for (var i = 1; i <= 3; i++) {
      var c = readJSON("vnlCareer.slot" + i), st = readJSON("hqStory.slot" + i);
      if (c) { P.saves++; P.titles += (c.trophies || []).length + (c.coachTrophies || []).length; P.awards += (c.awardsWon || []).length; P.caps += c.caps || 0; }
      if (st) { P.saves++; P.titles += (st.trophies || []).length; P.awards += (st.awards || []).length; }
    }
    ["retroVNL", "retroHQ"].forEach(function (k) { P.titles += Number(localStorage.getItem(k + ".cups")) || 0; var r = readJSON(k + ".record") || {}; P.wins += r.w || 0; P.losses += r.l || 0; });
    P.col = VB.Gacha.collection ? VB.Gacha.collection() : { own: 0, total: 0 };
    P.coins = VB.Gacha.coins();
    return P;
  }
  // CONTINUE: straight back into whatever you played last
  function lastInfo() {
    var L = readJSON("retroVB.last"); if (!L) return null;
    if (L.mode === "career") {
      var c = readJSON("vnlCareer.slot" + L.slot); if (!c) return null;
      var cl = c.club && c.clubs ? c.clubs[c.club] : null, p = c.players.you, img = "";
      try { img = VB.Engine.spriteURL(p.face, cl ? cl.kit : "#888", cl ? cl.kit2 : null, cl ? VB.Engine.kitPattern(cl.id) : null); } catch (e) {}
      return { L: L, icon: "🏟️", img: img, title: "PLAYER CAREER — " + p.name, sub: "SEASON " + c.season + " • " + (cl ? cl.name : "FREE AGENT") + " • 🏆 " + (c.trophies || []).length };
    }
    if (L.mode === "story") {
      var s = readJSON("hqStory.slot" + L.slot); if (!s) return null;
      var t = (VB.HQ_ALL || []).find(function (x) { return x.id === s.school; }) || (s.locals || []).find(function (x) { return x.id === s.school; }), q = s.players.you, im = "";
      try { im = VB.Engine.spriteURL(q.face, t ? t.kit : "#888", t ? t.kit2 : null, VB.Engine.kitPattern(s.school)); } catch (e) {}
      return { L: L, icon: "🏫", img: im, title: "HAIKYUU!! STORY — " + q.name, sub: (t ? t.name : s.school) + " • " + (s.ts ? "TIMESKIP" : "YEAR " + s.year + " • WEEK " + (s.week || 0)) + " • 🏆 " + (s.trophies || []).length };
    }
    if (L.mode === "vnl" || L.mode === "hq") {
      var T = L.mode === "vnl" ? VB.VNL : VB.HQ; if (!T.hasSave()) return null;
      return { L: L, icon: L.mode === "vnl" ? "🌍" : "🏐", title: L.mode === "vnl" ? "VNL — TOURNAMENT IN PROGRESS" : "SPRING NATIONALS — IN PROGRESS", sub: "Pick up where you left off" };
    }
    return null;
  }
  var TIPS = ["Tap the canvas during a pull to speed it up — SKIP or Space jumps to the cards.",
    "Press C in a match to switch camera, M to mute.", "Match pace FAST trims the dead time between points — timing bars stay the same.",
    "Mythic pity is guaranteed at 1000 pulls, Legendary at 60.", "In co-op SIDE BY SIDE, a new day starts only when you're both ready.",
    "PlayStyles upgrade to ★ PLUS at evaluations — check your player sheet.", "A perfect timing on a dig gives the setter a free choice of hitter.",
    "Equip gacha skins on the Skins tab — they show up in matches and on the practice court."];
  var showSet = false;
  function opt(k, def) { try { return localStorage.getItem(k) || def; } catch (e) { return def; } }
  function settingsHTML() {
    var pace = opt("retroVB.pace", "normal"), snd = VB.Sfx && VB.Sfx.on(), shk = opt("retroVB.shake", "on");
    function row(label, html) { return "<div class='set-row'><span>" + label + "</span><span class='set-ctl'>" + html + "</span></div>"; }
    function seg(key, cur, list) { return list.map(function (o) { return "<button class='btn tiny" + (cur === o[0] ? " on" : "") + "' data-act='set' data-k='" + key + "' data-v='" + o[0] + "'>" + o[1] + "</button>"; }).join(""); }
    return "<div class='card settings'><div class='pname'>⚙ SETTINGS</div>" +
      row("🎥 CAMERA", "<button class='btn tiny' data-act='cam'>" + VB.CAMS[opt("retroVB.cam", "classic")] + " ▸</button>") +
      row("🎬 MOVING CAMERA", seg("retroVB.camMove", opt("retroVB.camMove", "on"), [["on", "ON"], ["off", "FIXED"]])) +
      row("🟫 COURT FLOOR", "<button class='btn tiny' data-act='floor'>" + VB.FLOORS[opt("retroVB.floor", "auto")] + " ▸</button>") +
      row("🤖 BOT SKILL", seg("retroVB.bots", opt("retroVB.bots", "hard"), [["normal", "NORMAL"], ["hard", "HARD"], ["elite", "ELITE"]])) +
      row("⏱ MATCH PACE", seg("retroVB.pace", pace, [["fast", "FAST"], ["normal", "NORMAL"], ["tv", "TV"]])) +
      row("🔊 SOUND", seg("retroVB.sound", snd ? "on" : "off", [["on", "ON"], ["off", "OFF"]]) +
        " <input type='range' min='0' max='1' step='0.1' value='" + (VB.Sfx ? VB.Sfx.vol() : 0.6) + "' id='volIn' aria-label='Volume'/>") +
      row("📳 SCREEN SHAKE", seg("retroVB.shake", shk, [["on", "ON"], ["off", "LOW"]])) +
      "<div class='hub-actions'><button class='link-btn' data-act='resetVnl'>RESET TOURNAMENT RECORDS</button></div></div>";
  }
  function renderMenu() {
    var P = profile(), last = lastInfo();
    $("hub").innerHTML =
      "<div class='practice'><canvas id='practiceCv' width='640' height='340'></canvas>" +
        "<div class='practice-bar'><button class='btn tiny' data-act='pteam' data-arg='-1'>◀</button><span id='practiceLbl'></span><button class='btn tiny' data-act='pteam' data-arg='1'>▶</button></div></div>" +
      "<div class='profile'>" +
        "<div class='pstat'><b>" + P.titles + "</b><span>🏆 TITLES</span></div>" +
        "<div class='pstat'><b>" + P.awards + "</b><span>🏅 AWARDS</span></div>" +
        "<div class='pstat'><b>" + P.col.own + "/" + P.col.total + "</b><span>🎴 CARDS</span></div>" +
        "<div class='pstat'><b>" + P.coins.toLocaleString() + "</b><span>🏐 COINS</span></div>" +
        "<div class='pstat'><b>" + P.wins + "-" + P.losses + "</b><span>🌍 TOURNEY W-L</span></div>" +
        "<div class='pstat'><b>" + P.saves + "/6</b><span>💾 SAVES</span></div>" +
      "</div>" +
      (last ? "<button class='card continue' data-act='continue'>" + (last.img ? "<img src='" + last.img + "' alt=''/>" : "<div class='menu-icon'>" + last.icon + "</div>") +
        "<div><div class='cont-k'>▶ CONTINUE</div><div class='pname'>" + U.esc(last.title) + "</div><div class='muted'>" + U.esc(last.sub) + "</div></div></button>" : "") +
      "<h2 class='hub-h'>MAIN MENU</h2>" +
      "<div class='menu'>" +
        "<button class='card menu-card' data-act='tourney'><div class='menu-icon'>🏆</div><div class='pname'>TOURNAMENTS</div>" +
          "<div class='muted'>" + (VB.VNL.hasSave() || VB.HQ.hasSave() ? "Resume a tournament. " : "") + "🌍 VNL with 16 national teams, or 🏐🔥 Haikyuu!! Spring Nationals with 16 high schools. Pools, playoffs, awards — control the whole team or one player.</div></button>" +
        "<button class='card menu-card' data-act='story'><div class='menu-icon'>🏫</div><div class='pname'>HAIKYUU!! STORY MODE</div>" +
          "<div class='muted'>Join Karasuno, Nekoma, Inarizaki or any school as a first-year. Three years to earn your spot and reach the orange court.</div></button>" +
        "<button class='card menu-card' data-act='gacha'><div class='menu-icon'>🎴</div><div class='pname'>GACHA &amp; SHOWROOM</div>" +
          "<div class='muted'>🏐 " + P.coins.toLocaleString() + " coins • " + P.col.own + " of " + P.col.total + " cards. Pull Haikyuu!! cards from Common to Mythic and show them off in your showroom.</div></button>" +
        "<button class='card menu-card' data-act='coop'><div class='menu-icon'>🤝</div><div class='pname'>CO-OP (ONLINE)</div>" +
          "<div class='muted'>Play with a friend through a link while you're both online: TOGETHER on one team (career or Haikyuu!! story), or SIDE BY SIDE — each with your own career, new days only when you're both ready.</div></button>" +
        "<button class='card menu-card' data-act='career'><div class='menu-icon'>🏟️</div><div class='pname'>PLAYER CAREER</div>" +
          "<div class='muted'>FIFA-style: pick an archetype, earn XP and skill points, hit your manager's objectives and move between 8 leagues (Italy, Japan, Poland, Türkiye, Brazil, France, Germany, Korea).</div></button>" +
      "</div>" +
      "<div class='hub-actions'><button class='btn' data-act='settings'>⚙ SETTINGS " + (showSet ? "▲" : "▼") + "</button>" +
        "<button class='btn' data-act='cam'>🎥 " + VB.CAMS[opt("retroVB.cam", "classic")] + "</button>" +
        "<button class='btn' data-act='mute'>" + (VB.Sfx && VB.Sfx.on() ? "🔊 SOUND ON" : "🔇 SOUND OFF") + "</button></div>" +
      (showSet ? settingsHTML() : "") +
      "<p class='tip'>💡 " + TIPS[Math.floor(Math.random() * TIPS.length)] + "</p>";
    var vol = $("volIn"); if (vol) vol.oninput = function () { VB.Sfx.setVol(+vol.value); VB.Sfx.play("touch"); };
    mountPractice();
  }
  // the home screen is a practice court: your story school / career club / Karasuno, drilling
  function mountPractice() {
    var cv = $("practiceCv"); if (!cv || !VB.Practice) return;
    var idx = +(localStorage.getItem("retroVB.practice") || 0), info = VB.Practice.mount(cv, idx);
    $("practiceLbl").textContent = "PRACTICE COURT • " + info.label + " • tap a player";
  }

  async function onClick(e) {
    var b = e.target.closest("[data-act]");
    if (!b) return;
    var act = b.getAttribute("data-act");
    if (act === "tourney") {
      var k = await U.modal("🏆 TOURNAMENTS", "<p class='center'>Which tournament?</p>" +
        "<p><b>🌍 VNL</b> — 16 national teams" + (VB.VNL.hasSave() ? " <span class='gain'>(in progress)</span>" : "") + "</p>" +
        "<p><b>🏐🔥 HAIKYUU!! SPRING NATIONALS</b> — Karasuno, Nekoma, Inarizaki, Itachiyama..." + (VB.HQ.hasSave() ? " <span class='gain'>(in progress)</span>" : "") + "</p>",
        [{ label: "🌍 VNL", value: "vnl" }, { label: "🏐🔥 SPRING NATIONALS", value: "hq" }, { label: "BACK", value: null, cls: "pink" }]);
      if (!k) return;
      act = k;
    }
    if (act === "coop") {
      var how = await U.modal("🤝 CO-OP", "<p><b>🤝 TOGETHER — SAME TEAM.</b> Your friend joins YOUR Player Career or Haikyuu!! Story as a teammate and controls their own player in your matches (your device runs the game; they see it live).</p>" +
        "<p><b>🧑‍🤝‍🧑 SIDE BY SIDE — YOUR OWN CAREERS.</b> Each of you plays your own career on your own device. A new day starts only when you're both ready; you see each other's results live, and your friend's player appears in your world.</p>" +
        "<p><b>🔗 JOIN.</b> Got a link or a code from a friend? Paste it here.</p>",
        [{ label: "🤝 TOGETHER", value: "together" }, { label: "🧑‍🤝‍🧑 SIDE BY SIDE", value: "sbs" }, { label: "🔗 JOIN", value: "join" }, { label: "BACK", value: null, cls: "pink" }]);
      if (how === "together") {
        var where = await U.modal("🤝 TOGETHER", "<p>Open your save, then press <b>🤝 CO-OP</b> in its hub to get the invite link.</p>",
          [{ label: "🏟️ PLAYER CAREER", value: "career" }, { label: "🏫 HAIKYUU!! STORY", value: "story" }, { label: "BACK", value: null, cls: "pink" }]);
        if (!where) return;
        act = where;
      } else if (how === "sbs") {
        VB.Coop.startSB(); await VB.Coop.invite();
        $("hub").onclick = null; await VB.Career.start(); return menu();
      } else if (how === "join") {
        var go = await U.modal("🔗 JOIN A FRIEND", "<p>Paste the link (or just the 6-letter code) your friend sent you:</p><p><input id='joinCode' class='text-in coop-link' placeholder='e.g. 4UGY8W'/></p>", [{ label: "JOIN", value: 1 }, { label: "BACK", value: 0, cls: "pink" }]);
        var raw = (($("joinCode") || {}).value || "").trim(), m = raw.match(/coop=([A-Za-z0-9]+)/), code = (m ? m[1] : raw).toUpperCase().replace(/[^A-Z0-9]/g, "");
        if (go && code.length >= 4) location.href = location.pathname + "?coop=" + code;
        return;
      } else return;
    }
    if (act === "pteam") {
      var n = VB.Practice.teams().length, cur = +(localStorage.getItem("retroVB.practice") || 0);
      localStorage.setItem("retroVB.practice", String(((cur + (+b.getAttribute("data-arg"))) % n + n) % n));
      return mountPractice();
    }
    if (act === "continue") {
      var li = lastInfo(); if (!li) return renderMenu();
      $("hub").onclick = null;
      if (li.L.mode === "career") await VB.Career.start(li.L.slot);
      else if (li.L.mode === "story") await VB.Story.start(li.L.slot);
      else await (li.L.mode === "vnl" ? VB.VNL : VB.HQ).start();
      return menu();
    }
    if (act === "settings") { showSet = !showSet; return renderMenu(); }
    if (act === "mute") { VB.Sfx && VB.Sfx.toggle(); return renderMenu(); }
    if (act === "set") {
      try { localStorage.setItem(b.getAttribute("data-k"), b.getAttribute("data-v")); } catch (e) {}
      if (b.getAttribute("data-k") === "retroVB.sound" && VB.Sfx) VB.Sfx.play("click");
      if (b.getAttribute("data-k") === "retroVB.camMove") VB.Engine.setCamMove(b.getAttribute("data-v") === "on");
      return renderMenu();
    }
    if (act === "vnl") { U.setLast("vnl"); $("hub").onclick = null; await VB.VNL.start(); return menu(); }
    if (act === "hq") { U.setLast("hq"); $("hub").onclick = null; await VB.HQ.start(); return menu(); }
    if (act === "gacha") { $("hub").onclick = null; await VB.Gacha.start(); return menu(); }
    if (act === "floor") {
      var cur = localStorage.getItem("retroVB.floor") || "auto", keys = Object.keys(VB.FLOORS);
      localStorage.setItem("retroVB.floor", keys[(keys.indexOf(cur) + 1) % keys.length]);
      return renderMenu();
    }
    if (act === "cam") {
      var curC = localStorage.getItem("retroVB.cam") || "classic", ck = Object.keys(VB.CAMS);
      VB.Engine.setCam(ck[(ck.indexOf(curC) + 1) % ck.length]);
      return renderMenu();
    }
    if (act === "story") { $("hub").onclick = null; await VB.Story.start(); return menu(); }
    if (act === "career") { $("hub").onclick = null; await VB.Career.start(); return menu(); }
    if (act === "resetVnl") {
      var ok = await U.modal("RESET TOURNAMENTS?", "<p>This clears your VNL and Spring Nationals records, trophies and any tournament in progress.</p>",
                             [{ label: "RESET", value: true, cls: "pink" }, { label: "CANCEL", value: false }]);
      if (ok) { VB.VNL.reset(); VB.HQ.reset(); }
      renderMenu();
    }
  }

  function menu() {
    U.showView("hub");
    renderMenu();
    $("hub").onclick = onClick;
  }

  window.addEventListener("load", function () {
    VB.Engine.init();
    var coop = new URLSearchParams(location.search).get("coop");     // an invite link: join a friend's career
    if (coop && VB.Coop) return VB.Coop.startGuest(coop.toUpperCase().slice(0, 12));
    menu();
  });
})(window.VB);
