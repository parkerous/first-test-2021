// Main menu: pick VNL (national teams) or Club Career.
(function (VB) {
  "use strict";
  var U = VB.ui, $ = U.$;

  function renderMenu() {
    $("hub").innerHTML =
      "<div class='practice'><canvas id='practiceCv' width='640' height='340'></canvas>" +
        "<div class='practice-bar'><button class='btn tiny' data-act='pteam' data-arg='-1'>◀</button><span id='practiceLbl'></span><button class='btn tiny' data-act='pteam' data-arg='1'>▶</button></div></div>" +
      "<h2 class='hub-h'>MAIN MENU</h2>" +
      "<div class='menu'>" +
        "<button class='card menu-card' data-act='tourney'><div class='menu-icon'>🏆</div><div class='pname'>TOURNAMENTS</div>" +
          "<div class='muted'>" + (VB.VNL.hasSave() || VB.HQ.hasSave() ? "Resume a tournament. " : "") + "🌍 VNL with 16 national teams, or 🏐🔥 Haikyuu!! Spring Nationals with 16 high schools. Pools, playoffs, awards — control the whole team or one player.</div></button>" +
        "<button class='card menu-card' data-act='story'><div class='menu-icon'>🏫</div><div class='pname'>HAIKYUU!! STORY MODE</div>" +
          "<div class='muted'>Join Karasuno, Nekoma, Inarizaki or any school as a first-year. Three years to earn your spot and reach the orange court.</div></button>" +
        "<button class='card menu-card' data-act='gacha'><div class='menu-icon'>🎴</div><div class='pname'>GACHA &amp; SHOWROOM</div>" +
          "<div class='muted'>🏐 " + VB.Gacha.coins() + " coins. Pull Haikyuu!! cards from Common to Mythic (Christmas Bokuto, Timeskip Hinata...) and show them off.</div></button>" +
        "<button class='card menu-card' data-act='coop'><div class='menu-icon'>🤝</div><div class='pname'>CO-OP (ONLINE)</div>" +
          "<div class='muted'>Play with a friend through a link while you're both online: TOGETHER on one team (career or Haikyuu!! story), or SIDE BY SIDE — each with your own career, new days only when you're both ready.</div></button>" +
        "<button class='card menu-card' data-act='career'><div class='menu-icon'>🏟️</div><div class='pname'>PLAYER CAREER</div>" +
          "<div class='muted'>FIFA-style: pick an archetype, earn XP and skill points, hit your manager's objectives and move between 8 leagues (Italy, Japan, Poland, Türkiye, Brazil, France, Germany, Korea).</div></button>" +
      "</div>" +
      "<div class='hub-actions'><button class='btn' data-act='floor'>COURT FLOOR: " + VB.FLOORS[localStorage.getItem("retroVB.floor") || "auto"] + "</button>" +
        "<button class='btn' data-act='cam'>CAMERA: " + VB.CAMS[localStorage.getItem("retroVB.cam") || "classic"] + "</button></div>" +
      "<div class='hub-actions'><button class='link-btn' data-act='resetVnl'>RESET TOURNAMENT RECORDS</button></div>";
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
    if (act === "vnl") { $("hub").onclick = null; await VB.VNL.start(); return menu(); }
    if (act === "hq") { $("hub").onclick = null; await VB.HQ.start(); return menu(); }
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
