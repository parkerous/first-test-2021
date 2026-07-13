/* ============================================================
   Soai — light / dark mode toggle.
   Applies the saved theme immediately (no flash), and injects a
   sun/moon button into the nav or header on every page.
   ============================================================ */
(function () {
  try {
    var t = localStorage.getItem("soai_theme");
    if (t === "dark" || t === "light") document.documentElement.setAttribute("data-theme", t);
  } catch (e) {}
})();

document.addEventListener("DOMContentLoaded", function () {
  var host = document.querySelector(".nav .links") || document.querySelector(".topbar .wrap");
  if (!host) return;

  var btn = document.createElement("button");
  btn.className = "theme-toggle";
  btn.type = "button";
  btn.title = "Light / dark mode";
  btn.setAttribute("aria-label", "Toggle light or dark mode");

  function current() {
    var d = document.documentElement.getAttribute("data-theme");
    if (d) return d;
    return (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) ? "dark" : "light";
  }
  function refresh() { btn.textContent = current() === "dark" ? "☀️" : "🌙"; }
  refresh();

  btn.addEventListener("click", function () {
    var next = current() === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    try { localStorage.setItem("soai_theme", next); } catch (e) {}
    refresh();
  });

  host.appendChild(btn);
});
