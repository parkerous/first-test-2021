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
        "<button class='card menu-card' data-act='career'><div class='menu-icon'>🏟️</div><div class='pname'>CLUB CAREER</div>" +
          "<div class='muted'>Create a player and live a career in SuperLega and SV.League: coaches, transfers, budgets, fresh faces.</div></button>" +
      "</div>" +
      "<div class='hub-actions'><button class='link-btn' data-act='resetVnl'>RESET VNL RECORD &amp; TOURNAMENT</button></div>";
  }

  async function onClick(e) {
    var b = e.target.closest("[data-act]");
    if (!b) return;
    var act = b.getAttribute("data-act");
    if (act === "vnl") { $("hub").onclick = null; await VB.VNL.start(); return menu(); }
    if (act === "career") { $("hub").onclick = null; await VB.Career.start(); return menu(); }
    if (act === "resetVnl") {
      var ok = await U.modal("RESET VNL?", "<p>This clears your VNL win-loss record, trophies and any tournament in progress.</p>",
                             [{ label: "RESET", value: true, cls: "pink" }, { label: "CANCEL", value: false }]);
      if (ok) VB.VNL.reset();
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
