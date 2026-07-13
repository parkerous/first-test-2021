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

  /* ---- mobile hamburger for the main nav ---- */
  var nav = document.querySelector(".nav");
  var wrap = nav && nav.querySelector(".wrap");
  var links = wrap && wrap.querySelector(".links");
  if (nav && wrap && links) {
    var burger = document.createElement("button");
    burger.className = "nav-toggle";
    burger.type = "button";
    burger.setAttribute("aria-label", "Open menu");
    burger.setAttribute("aria-expanded", "false");
    burger.innerHTML = "<span></span><span></span><span></span>";
    wrap.insertBefore(burger, links);

    function setOpen(open) {
      nav.classList.toggle("open", open);
      burger.setAttribute("aria-expanded", open ? "true" : "false");
      burger.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    }
    burger.addEventListener("click", function () { setOpen(!nav.classList.contains("open")); });
    /* tapping a real link closes the menu */
    links.addEventListener("click", function (e) { if (e.target.closest("a")) setOpen(false); });
    /* back to desktop width → always reset to closed */
    window.addEventListener("resize", function () { if (window.innerWidth > 820) setOpen(false); });
  }
});
