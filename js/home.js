/* ============================================================
   Soai front page — auto hero slideshow of volleyball news,
   editable news cards, and a YouTube "learn" search.

   News auto-fetching isn't reliable on a static site (news outlets
   block cross-site requests), so slides link to REAL, credible
   outlets. You can edit/add your own headlines, or try the optional
   experimental live RSS button.
   ============================================================ */

const NEWS_KEY = "soai_news_v1";

/* curated, real, credible sources (evergreen — not fabricated headlines) */
const DEFAULT_NEWS = [
  { lg: "Global", emoji: "🌍", title: "Volleyball World — global scores, news & highlights", desc: "The FIVB's official hub for international volleyball across every top competition.", src: "en.volleyballworld.com", url: "https://en.volleyballworld.com/volleyball/news" },
  { lg: "SuperLega", emoji: "🇮🇹", title: "Italy's SuperLega — the world's toughest men's league", desc: "Lega Pallavolo Serie A: fixtures, live results and standings from Italy.", src: "legavolley.it", url: "https://www.legavolley.it/" },
  { lg: "V-League", emoji: "🇰🇷", title: "Korea's V-League (KOVO) — men's & women's", desc: "Official Korean Volleyball Federation league news, schedules and stats.", src: "kovo.co.kr", url: "https://www.kovo.co.kr/" },
  { lg: "NCAA", emoji: "🏫", title: "NCAA college volleyball", desc: "US college volleyball — rankings, brackets and results from the NCAA.", src: "ncaa.com", url: "https://www.ncaa.com/sports/volleyball-women/d1" },
  { lg: "PlusLiga", emoji: "🇵🇱", title: "Poland's PlusLiga — a top-5 men's league", desc: "One of the strongest club leagues in the world — news and standings.", src: "plusliga.pl", url: "https://www.plusliga.pl/" },
  { lg: "SV.League", emoji: "🇯🇵", title: "Japan's SV.League", desc: "Japan's top men's & women's league (home of Osaka Bluteon).", src: "svleague.jp", url: "https://www.svleague.jp/" },
];

let news = load();
let slideIdx = 0;
let timer = null;

function load() { try { const s = JSON.parse(localStorage.getItem(NEWS_KEY)); return Array.isArray(s) && s.length ? s : DEFAULT_NEWS.slice(); } catch { return DEFAULT_NEWS.slice(); } }
function save() { localStorage.setItem(NEWS_KEY, JSON.stringify(news)); }
function esc(s) { return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
function safeUrl(u) { return /^https?:\/\//i.test(u) ? u : "https://" + u; }

/* ---------- auto cover art (so image-less cards aren't bland) ----------
   Deterministic volleyball-themed gradient graphic per item — no external
   images, so it always loads and each card looks distinct. */
const COVER_PALETTES = [
  ["#0d1b2a", "#2b5f8a"], ["#2a0d24", "#6b1b52"], ["#0d2a1b", "#1f7a4a"],
  ["#2a1b0d", "#a5701b"], ["#1a1030", "#4a1b8b"], ["#301010", "#8a1b1b"],
  ["#10222a", "#1b6a7a"], ["#22200d", "#8a7a1b"],
];
function hashStr(s) { let h = 0; s = String(s || ""); for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h; }
/* a nice varied gradient per item; the real 🏐 emoji is overlaid on top */
function autoGradient(item) {
  const p = COVER_PALETTES[hashStr((item.lg || "") + "|" + (item.title || "")) % COVER_PALETTES.length];
  return "linear-gradient(135deg, " + p[0] + ", " + p[1] + ")";
}

/* ---------- slideshow ---------- */
function renderSlides() {
  const host = document.getElementById("slides");
  const dots = document.getElementById("dots");
  const items = news.slice(0, 6);
  host.innerHTML = items.map((n, i) => `
    <div class="slide ${i === 0 ? "on" : ""}" data-i="${i}">
      <div class="bg" style="${n.img ? `background-image:linear-gradient(90deg,rgba(13,13,16,.92),rgba(13,13,16,.4)),url('${esc(n.img)}');background-size:cover;background-position:center` : `background-image:${autoGradient(n)}`}"></div>
      <div class="glow">🏐</div>
      <div class="inner">
        <span class="league">${i === 0 ? "⭐ Featured · " : ""}${esc(n.lg)}</span>
        <h2>${esc(n.title)}</h2>
        <p>${esc(n.desc || "")}</p>
        <a class="cta" href="${esc(safeUrl(n.url))}" target="_blank" rel="noopener">Read the latest →</a>
        <span class="src">Source: ${esc(n.src || "")}</span>
      </div>
    </div>`).join("");
  dots.innerHTML = items.map((_, i) => `<button data-i="${i}" class="${i === 0 ? "on" : ""}" aria-label="slide ${i + 1}"></button>`).join("");
  dots.querySelectorAll("button").forEach(b => b.addEventListener("click", () => goTo(+b.dataset.i)));
  slideIdx = 0;
  startAuto();
}
function showSlide(i) {
  const slides = document.querySelectorAll(".slide");
  const dots = document.querySelectorAll(".dots button");
  if (!slides.length) return;
  slideIdx = (i + slides.length) % slides.length;
  slides.forEach((s, k) => s.classList.toggle("on", k === slideIdx));
  dots.forEach((d, k) => d.classList.toggle("on", k === slideIdx));
}
function goTo(i) { showSlide(i); startAuto(); }
function next() { showSlide(slideIdx + 1); }
function prev() { showSlide(slideIdx - 1); }
/* auto-advance disabled for a calmer page — use the arrows/dots to browse */
function startAuto() { stopAuto(); }
function stopAuto() { if (timer) clearInterval(timer); timer = null; }

/* ---------- news grid ---------- */
function renderNews() {
  const grid = document.getElementById("newsGrid");
  grid.innerHTML = news.map((n, i) => `
    <div class="ncard">
      <div class="top" style="${n.img ? `background-image:url('${esc(n.img)}');background-size:cover;background-position:center` : `background-image:${autoGradient(n)}`}">
        <span class="lg">${esc(n.lg)}</span>
        ${i === 0 ? `<span class="feat-badge">⭐ Featured</span>` : ""}
        ${n.img ? "" : `<span class="emoji">🏐</span>`}
      </div>
      <div class="body">
        <h3>${esc(n.title)}</h3>
        <p>${esc(n.desc || "")}</p>
        <div class="row2">
          <span class="src">${esc(n.src || "")}</span>
          <a class="go" href="${esc(safeUrl(n.url))}" target="_blank" rel="noopener">Open →</a>
        </div>
      </div>
    </div>`).join("");
}
/* Announcements are admin-managed (see the admin panel) — the homepage is
   read-only, so there are no public add / edit / feature / delete helpers here. */

/* ---------- YouTube "learn" search ---------- */
function goLearn() {
  const url = val("ytUrl");
  if (!url) { msg2("Paste a YouTube or TikTok match link first."); return; }
  if (!/(youtu\.be\/|youtube\.com\/|tiktok\.com\/|[\w-]{11})/.test(url)) { msg2("That doesn't look like a YouTube or TikTok link."); return; }
  window.location.href = "player.html?v=" + encodeURIComponent(url);
}

/* ---------- helpers ---------- */
function val(id) { const el = document.getElementById(id); return el ? el.value.trim() : ""; }
function msg(t) { const el = document.getElementById("newsMsg"); if (el) el.textContent = t; }
function msg2(t) { const el = document.getElementById("analyzeMsg"); if (el) el.textContent = t; }

/* ---------- init ---------- */
function init() {
  renderSlides();
  renderNews();

  document.querySelector(".arrow.left").addEventListener("click", () => { prev(); startAuto(); });
  document.querySelector(".arrow.right").addEventListener("click", () => { next(); startAuto(); });
  const hero = document.querySelector(".hero");
  hero.addEventListener("mouseenter", stopAuto);
  hero.addEventListener("mouseleave", startAuto);

  document.getElementById("goBtn").addEventListener("click", goLearn);
  document.getElementById("ytUrl").addEventListener("keydown", e => { if (e.key === "Enter") goLearn(); });

  /* announcements are admin-managed (admin panel → Announcements); no public editing here */

  /* horizontal news rail arrows */
  const rail = document.getElementById("newsGrid");
  const rp = document.getElementById("newsPrev"), rn = document.getElementById("newsNext");
  if (rail && rp && rn) {
    rp.addEventListener("click", () => rail.scrollBy({ left: -332, behavior: "smooth" }));
    rn.addEventListener("click", () => rail.scrollBy({ left: 332, behavior: "smooth" }));
  }

  loadAnnouncements();
  initReveal();
}

/* fade sections in as they scroll into view */
function initReveal() {
  const els = document.querySelectorAll(".section, .analyze");
  els.forEach(el => el.classList.add("reveal"));
  if (!("IntersectionObserver" in window)) { els.forEach(el => el.classList.add("in")); return; }
  const io = new IntersectionObserver((entries) => {
    entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } });
  }, { threshold: 0.12, rootMargin: "0px 0px -8% 0px" });
  els.forEach(el => io.observe(el));
}

/* pull admin-posted announcements from the backend and feature them first */
async function loadAnnouncements() {
  if (typeof apiConfigured !== "function" || !apiConfigured()) return;
  try {
    const list = await apiGet("/announcements");
    if (Array.isArray(list) && list.length) {
      const featured = list.map(a => ({ lg: a.lg || "Announcement", emoji: "📢", title: a.title, desc: a.desc || "", url: a.url || "#", img: a.img || "", src: a.src || "Binsu Star" }));
      news = featured.concat(news);
      renderSlides(); renderNews();
    }
  } catch (e) { /* backend optional — ignore if unreachable */ }
}
document.addEventListener("DOMContentLoaded", init);
