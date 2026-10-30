// Main menu: pick VNL (national teams) or Club Career.
(function (VB) {
  "use strict";
  var U = VB.ui, $ = U.$;

  function renderMenu() {
    var resume = VB.VNL.hasSave();
    $("hub").innerHTML =
      "<h2 class='hub-h'>MAIN MENU</h2>" +
      "<div class='menu'>" +
        "<button class='card menu-card' data-act='vnl'><div class='menu-icon'>🌍</div><div class='pname'>VNL TOURNAMENT</div>" +
          "<div class='muted'>" + (resume ? "Resume your tournament. " : "") + "16 national teams. Pools, playoffs, awards. Control the whole team or one player.</div></button>" +
        "<button class='card menu-card' data-act='hq'><div class='menu-icon'>🏐🔥</div><div class='pname'>HAIKYUU!! SPRING NATIONALS</div>" +
          "<div class='muted'>" + (VB.HQ.hasSave() ? "Resume your tournament. " : "") + "16 high schools: Karasuno, Nekoma, Inarizaki, Itachiyama... Freak quick, Killer Serve, Lefty Cannon and more.</div></button>" +
        "<button class='card menu-card' data-act='story'><div class='menu-icon'>🏫</div><div class='pname'>HAIKYUU!! STORY MODE</div>" +
          "<div class='muted'>Join Karasuno, Nekoma, Inarizaki or any school as a first-year. Three years to earn your spot and reach the orange court.</div></button>" +
        "<button class='card menu-card' data-act='gacha'><div class='menu-icon'>🎴</div><div class='pname'>GACHA &amp; SHOWROOM</div>" +
          "<div class='muted'>🏐 " + VB.Gacha.coins() + " coins. Pull Haikyuu!! cards from Common to Mythic (Christmas Bokuto, Timeskip Hinata...) and show them off.</div></button>" +
        "<button class='card menu-card' data-act='career'><div class='menu-icon'>🏟️</div><div class='pname'>PLAYER CAREER</div>" +
          "<div class='muted'>FIFA-style: pick an archetype, earn XP and skill points, hit your manager's objectives and move between 8 leagues (Italy, Japan, Poland, Türkiye, Brazil, France, Germany, Korea).</div></button>" +
      "</div>" +
      "<div class='hub-actions'><button class='btn' data-act='floor'>COURT FLOOR: " + VB.FLOORS[localStorage.getItem("retroVB.floor") || "auto"] + "</button>" +
        "<button class='btn' data-act='cam'>CAMERA: " + VB.CAMS[localStorage.getItem("retroVB.cam") || "classic"] + "</button></div>" +
      "<div class='hub-actions'><button class='link-btn' data-act='resetVnl'>RESET TOURNAMENT RECORDS</button></div>";
  }

  async function onClick(e) {
    var b = e.target.closest("[data-act]");
    if (!b) return;
    var act = b.getAttribute("data-act");
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
    menu();
  });
})(window.VB);
