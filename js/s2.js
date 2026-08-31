/* ============================================================
   Soai — Season 2: fixtures, results, live standings and the
   playoff bracket. Data comes from the backend (/s2); admins manage
   fixtures in the admin panel (Season 2 tab). Fixture model:
   { id, teamA, teamB, stage: "regular"|"qf"|"sf"|"3rd"|"f",
     when: ms epoch (0 = TBA), sets: [{a,b}|{w}] | null }
   A fixture with sets is a played match — the same match model the
   scrim standings use, so standings reuse computeScrimStandings.
   ============================================================ */

const S2_STAGES = { regular: "Regular season", qf: "Quarterfinals", sf: "Semifinals", "3rd": "3rd place match", f: "Grand Final" };

function s2Played(f) { return !!(f && Array.isArray(f.sets) && f.sets.length); }
function s2Winner(f) {
  if (!s2Played(f)) return null;
  let a = 0, b = 0;
  f.sets.forEach(s => {
    const hasPts = typeof s.a === "number" && typeof s.b === "number";
    const aWon = hasPts ? s.a >= s.b : s.w === "A";
    if (aWon) a++; else b++;
  });
  return a > b ? f.teamA : b > a ? f.teamB : null;
}
/* Times render in the VISITOR'S timezone — `when` is an absolute epoch,
   so 7pm GMT+8 automatically shows as e.g. 12pm in London. */
function s2When(f) {
  if (!f.when) return "Date TBA";
  const d = new Date(f.when);
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })
    + " · " + d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}
function s2TimeOnly(f) {
  return f.when ? new Date(f.when).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }) : "TBA";
}
/* Which draw group a team is in ("A" / "B" / ""). */
let S2_GROUPS_CACHE = null;
function teamGroup(name) {
  const g = S2_GROUPS_CACHE || {};
  if ((g.A || []).indexOf(name) !== -1) return "A";
  if ((g.B || []).indexOf(name) !== -1) return "B";
  return "";
}
function groupChip(f) {
  const g = teamGroup(f.teamA) || teamGroup(f.teamB);
  return g ? `<span class="grp-chip g${g}">Group ${g}</span>` : "";
}

/* One schedule row: names, time, result (or VS). */
function s2RowHtml(f) {
  if (s2Played(f)) {
    return `<div class="ps-result">🏐 ${scrimMatchLine(f).text} <span class="ps-sets">· ${scrimEsc(s2When(f))}</span></div>`;
  }
  return `<div class="ps-result">📅 <b>${scrimEsc(f.teamA)}</b> <span class="ps-sets">vs</span> <b>${scrimEsc(f.teamB)}</b> <span class="ps-sets">· ${scrimEsc(s2When(f))}</span></div>`;
}


/* ---- homepage score strip (#scoreStrip) ----
   ESPN-style ribbon: recent finals + upcoming fixtures in one
   horizontal scroll. Falls back to the latest scrim results while the
   S2 schedule is empty. */
async function renderScoreStrip() {
  const host = document.getElementById("scoreStrip");
  if (!host) return;
  let data = { fixtures: [] };
  try { data = await apiGet("/s2"); } catch (e) { /* leave empty */ }
  const fx = data.fixtures || [];
  const played = fx.filter(s2Played).sort((a, b) => (b.when || b.createdAt || 0) - (a.when || a.createdAt || 0)).slice(0, 4).reverse();
  const upcoming = fx.filter(f => !s2Played(f)).sort((a, b) => (a.when || Infinity) - (b.when || Infinity)).slice(0, 4);

  const resCard = (m, tag) => {
    let a = 0, b = 0;
    (m.sets || []).forEach(st => {
      const hp = typeof st.a === "number" && typeof st.b === "number";
      (hp ? st.a >= st.b : st.w === "A") ? a++ : b++;
    });
    return `<div class="sc-card">
      <span class="sc-tag">${tag}</span>
      <span class="sc-line${a > b ? " win" : ""}"><span>${scrimEsc(m.teamA)}</span><b>${a}</b></span>
      <span class="sc-line${b > a ? " win" : ""}"><span>${scrimEsc(m.teamB)}</span><b>${b}</b></span>
    </div>`;
  };
  const upCard = f => `<div class="sc-card up">
      <span class="sc-tag">${scrimEsc(s2When(f))}</span>
      <span class="sc-line"><span>${scrimEsc(f.teamA)}</span></span>
      <span class="sc-line"><span>${scrimEsc(f.teamB)}</span></span>
    </div>`;

  let cards = played.map(m => resCard(m, "FINAL")).concat(upcoming.map(upCard));
  if (!cards.length) {
    let scr = { matches: [] };
    try { scr = await apiGet("/scrims"); } catch (e) { /* leave empty */ }
    cards = (scr.matches || []).slice().sort((x, y) => (y.createdAt || 0) - (x.createdAt || 0)).slice(0, 5).reverse()
      .map(m => resCard(m, "PRESEASON"))
      .concat(`<div class="sc-card up"><span class="sc-tag">SEASON 2</span><span class="sc-line"><span>Schedule</span></span><span class="sc-line"><span>coming soon</span></span></div>`);
  }
  if (!cards.length) { host.style.display = "none"; return; }
  host.innerHTML = `<div class="sc-rail">${cards.join("")}<a class="sc-more" href="schedule.html">All fixtures →</a></div>`;
}

/* ---- schedule page (#schedComing / #schedReal / #schedList / #bracketWrap) ----
   Big paginated match-night cards: 5 nights per page, played matches shown
   in place with their scores. Opens on the page with the next match night. */
const SCHED_PER_PAGE = 5;
let SCHED_DAYS = [];      // [{ key, when, items }]
let SCHED_PAGE = -1;      // -1 → auto-pick the page with the next unplayed night
async function renderS2Schedule() {
  const list = document.getElementById("schedList");
  if (!list) return;
  let data = { teams: [], fixtures: [] };
  try { data = await apiGet("/s2"); } catch (e) { /* leave empty */ }
  const fx = data.fixtures || [];
  if (!fx.length) return;                          // keep the "coming soon" card
  const coming = document.getElementById("schedComing");
  if (coming) coming.style.display = "none";
  const real = document.getElementById("schedReal");
  if (real) real.style.display = "";

  S2_GROUPS_CACHE = data.groups || S2_GROUPS_CACHE;
  const reg = fx.filter(f => f.stage === "regular").slice()
    .sort((a, b) => (a.when || Infinity) - (b.when || Infinity) || (a.createdAt || 0) - (b.createdAt || 0));
  // group ALL fixtures chronologically by the visitor's local calendar day
  SCHED_DAYS = [];
  reg.forEach(f => {
    const key = f.when ? new Date(f.when).toDateString() : "TBA";
    const last = SCHED_DAYS[SCHED_DAYS.length - 1];
    if (last && last.key === key) last.items.push(f);
    else SCHED_DAYS.push({ key, when: f.when, items: [f] });
  });
  if (!SCHED_DAYS.length) {
    list.innerHTML = `<p class="empty">No regular-season fixtures yet — playoff bracket below.</p>`;
    renderS2Bracket(fx); return;
  }
  drawSchedPage();
  renderS2Bracket(fx);
}
function drawSchedPage() {
  const list = document.getElementById("schedList");
  const pages = Math.max(1, Math.ceil(SCHED_DAYS.length / SCHED_PER_PAGE));
  if (SCHED_PAGE < 0) {
    // auto: the page holding the first night that still has an unplayed match
    const idx = SCHED_DAYS.findIndex(d => d.items.some(f => !s2Played(f)));
    SCHED_PAGE = Math.floor((idx === -1 ? SCHED_DAYS.length - 1 : idx) / SCHED_PER_PAGE);
  }
  SCHED_PAGE = Math.min(Math.max(SCHED_PAGE, 0), pages - 1);

  const dayHead = d => d.when
    ? new Date(d.when).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })
    : "Date TBA";
  const setScores = f => (f.sets || []).filter(s => typeof s.a === "number" && typeof s.b === "number").map(s => `${s.a}–${s.b}`).join(", ");
  const row = f => {
    if (!s2Played(f)) {
      return `<div class="sch-row">${groupChip(f)}<span class="sch-teams"><b>${scrimEsc(f.teamA)}</b> <i>vs</i> <b>${scrimEsc(f.teamB)}</b></span><span class="sch-time">🕐 ${scrimEsc(s2TimeOnly(f))} · BO3</span></div>`;
    }
    let a = 0, b = 0;
    f.sets.forEach(s => {
      const hp = typeof s.a === "number" && typeof s.b === "number";
      if (hp) { s.a >= s.b ? a++ : b++; }
      else if (s.w === "A" || s.w === "B") { s.w === "A" ? a++ : b++; }
    });
    const w = s2Winner(f), pts = setScores(f);
    return `<div class="sch-row done">${groupChip(f)}<span class="sch-teams"><b class="${w === f.teamA ? "sch-win" : ""}">${w === f.teamA ? "🏆 " : ""}${scrimEsc(f.teamA)}</b><span class="sch-score">${a}–${b}</span><b class="${w === f.teamB ? "sch-win" : ""}">${scrimEsc(f.teamB)}${w === f.teamB ? " 🏆" : ""}</b></span><span class="sch-time">${pts ? scrimEsc(pts) : "final"}</span></div>`;
  };
  const start = SCHED_PAGE * SCHED_PER_PAGE;
  const slice = SCHED_DAYS.slice(start, start + SCHED_PER_PAGE);
  const dayCard = (d, i) => `
    <div class="sch-day">
      <div class="sch-dayhead"><span class="sch-night">Night ${start + i + 1}</span>${dayHead(d)}${d.items.every(s2Played) ? '<span class="sch-doneflag">🏁 played</span>' : ""}</div>
      ${d.items.map(row).join("")}
    </div>`;
  const pager = pages > 1 ? `
    <div class="sch-pager">
      <button id="schPrev" ${SCHED_PAGE === 0 ? "disabled" : ""}>‹ Earlier</button>
      ${Array.from({ length: pages }, (_, p) => `<button class="sch-pg${p === SCHED_PAGE ? " on" : ""}" data-pg="${p}">${p + 1}</button>`).join("")}
      <button id="schNext" ${SCHED_PAGE === pages - 1 ? "disabled" : ""}>Later ›</button>
    </div>
    <p class="mini-note" style="text-align:center;margin:4px 0 0">Nights ${start + 1}–${start + slice.length} of ${SCHED_DAYS.length} · 5 match nights per page</p>` : "";
  list.innerHTML = slice.map(dayCard).join("") + pager;

  const go = p => { SCHED_PAGE = p; drawSchedPage(); document.getElementById("schedList").scrollIntoView({ behavior: "smooth", block: "start" }); };
  const prev = document.getElementById("schPrev"), next = document.getElementById("schNext");
  if (prev) prev.addEventListener("click", () => go(SCHED_PAGE - 1));
  if (next) next.addEventListener("click", () => go(SCHED_PAGE + 1));
  list.querySelectorAll(".sch-pg").forEach(b => b.addEventListener("click", () => go(+b.dataset.pg)));
}

/* ---- playoff bracket (#bracketWrap / #bracketHost) ---- */
function renderS2Bracket(fixtures) {
  const host = document.getElementById("bracketHost");
  if (!host) return;
  const stages = ["qf", "sf", "f", "3rd"];
  const by = {}; stages.forEach(st => { by[st] = (fixtures || []).filter(f => f.stage === st); });
  if (!stages.some(st => by[st].length)) return;   // no playoff fixtures yet
  const wrap = document.getElementById("bracketWrap");
  if (wrap) wrap.style.display = "";

  const matchCard = f => {
    const w = s2Winner(f);
    let a = 0, b = 0;
    if (s2Played(f)) f.sets.forEach(s => {
      const hasPts = typeof s.a === "number" && typeof s.b === "number";
      (hasPts ? s.a >= s.b : s.w === "A") ? a++ : b++;
    });
    const side = (name, sets, isWinner) =>
      `<div class="bk-side${isWinner ? " win" : ""}"><span>${scrimEsc(name)}</span><b>${s2Played(f) ? sets : ""}</b></div>`;
    return `<div class="bk-match">${side(f.teamA, a, w === f.teamA)}${side(f.teamB, b, w === f.teamB)}${s2Played(f) ? "" : `<div class="bk-when">${scrimEsc(s2When(f))}</div>`}</div>`;
  };
  const col = (st, label) => by[st].length
    ? `<div class="bk-col"><div class="bk-stage">${label}</div>${by[st].map(matchCard).join("")}</div>`
    : "";
  const champion = (() => {
    const f = by.f[0];
    const w = f && s2Winner(f);
    return w ? `<div class="bk-col"><div class="bk-stage">Champion</div><div class="bk-match bk-champ">👑 <b>${scrimEsc(w)}</b></div></div>` : "";
  })();
  host.innerHTML = col("qf", "Quarterfinals") + col("sf", "Semifinals") + col("f", "Grand Final") + champion +
    (by["3rd"].length ? `<div class="bk-col"><div class="bk-stage">3rd place</div>${by["3rd"].map(matchCard).join("")}</div>` : "");
}

/* ---- standings page (#s2Coming / #s2Section / #s2Tables) ----
   One table per draw group, Premier-League style, with a form column.
   Shown as soon as the schedule exists (zeros before results post). */
async function renderS2Standings() {
  const host = document.getElementById("s2Tables");
  if (!host) return;
  let data = { teams: [], fixtures: [], groups: null };
  try { data = await apiGet("/s2"); } catch (e) { /* leave empty */ }
  S2_GROUPS_CACHE = data.groups || S2_GROUPS_CACHE;
  const reg = (data.fixtures || []).filter(f => f.stage === "regular");
  if (!reg.length) return;                         // keep the "coming soon" card
  const coming = document.getElementById("s2Coming");
  if (coming) coming.style.display = "none";
  const sec = document.getElementById("s2Section");
  if (sec) sec.style.display = "";

  const played = reg.filter(s2Played);
  const chrono = played.slice().sort((a, b) => (a.when || a.createdAt || 0) - (b.when || b.createdAt || 0));
  const formBy = {};
  chrono.forEach(m => {
    const w = s2Winner(m);
    [[m.teamA, w === m.teamA], [m.teamB, w === m.teamB]].forEach(([t, won]) => {
      (formBy[t] = formBy[t] || []).push(won);
    });
  });
  const formHtml = t => (formBy[t] || []).slice(-5).map(w => `<span class="fm ${w ? "w" : "l"}">${w ? "W" : "L"}</span>`).join("") || "—";
  const pct = v => v == null ? "—" : Math.round(v * 100) + "%";
  const diff = v => v == null ? "—" : (v > 0 ? "+" + v : "" + v);
  const rec = v => (v > 0 ? "+" + v : "" + v);
  const recCls = v => v > 0 ? "ps-pos" : v < 0 ? "ps-neg" : "ps-zero";

  const groups = S2_GROUPS_CACHE || { A: [], B: [] };
  const tableFor = (gName, gTeams) => {
    const gPlayed = played.filter(f => teamGroup(f.teamA) === gName);
    const rows = computeScrimStandings(gTeams, gPlayed);
    return `
      <h3 class="grp" style="margin:22px 0 10px">Group ${gName} <span style="color:var(--muted);font-weight:600;font-size:13px">· ${gTeams.length} teams · single round robin</span></h3>
      <div class="table-scroll">
        <table class="standings">
          <thead><tr>
            <th>Rank</th><th>Team</th>
            <th class="num" title="Played">P</th>
            <th class="num" title="Wins">W</th>
            <th class="num" title="Losses">L</th>
            <th class="num" title="Points: win +1 / loss −1">Pts</th>
            <th class="num" title="Sets won–lost">Sets</th>
            <th class="num" title="Set win-rate">Set %</th>
            <th class="num" title="Point differential">Diff</th>
            <th title="Last 5 results">Form</th>
          </tr></thead>
          <tbody>${rows.map((t, i) => `
            <tr>
              <td class="rk">${i + 1}</td>
              <td><span class="team"><span class="dot"></span>${scrimEsc(t.name)}</span></td>
              <td class="num">${t.played}</td>
              <td class="num">${t.mw}</td>
              <td class="num">${t.ml}</td>
              <td class="num"><span class="ps-rec ${recCls(t.record)}">${rec(t.record)}</span></td>
              <td class="num">${t.setsPlayed ? `${t.sw}–${t.sl}` : "—"}</td>
              <td class="num">${pct(t.setWinrate)}</td>
              <td class="num">${diff(t.diff)}</td>
              <td class="fm-cell">${formHtml(t.name)}</td>
            </tr>`).join("")}</tbody>
        </table>
      </div>`;
  };
  host.innerHTML = tableFor("A", groups.A || []) + tableFor("B", groups.B || []);
}

/* ---- shareable standings graphic (1200×675 PNG, drawn from live data) ---- */
async function buildStandingsCanvas() {
  const data = await apiGet("/s2");
  const groups = data.groups || S2_GROUPS_CACHE || { A: [], B: [] };
  S2_GROUPS_CACHE = groups;
  const played = (data.fixtures || []).filter(f => f.stage === "regular" && s2Played(f));
  const chrono = played.slice().sort((a, b) => (a.when || a.createdAt || 0) - (b.when || b.createdAt || 0));
  const formBy = {};
  chrono.forEach(m => {
    const w = s2Winner(m);
    [[m.teamA, w === m.teamA], [m.teamB, w === m.teamB]].forEach(([t, won]) => { (formBy[t] = formBy[t] || []).push(won); });
  });
  const rowsFor = g => computeScrimStandings(groups[g] || [], played.filter(f => teamGroup(f.teamA) === g));
  const A = rowsFor("A"), B = rowsFor("B");

  // site logo (admin-uploaded if set, else the bundled crest)
  let logoSrc = "img/binsu-pfp.jpg";
  try { const site = await apiGet("/site"); if (site && site.logo) logoSrc = site.logo; } catch (e) {}
  const logo = await new Promise(res => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = logoSrc; });

  const W = 1320, rowH = 56, headTop = 176, tableTop = headTop + 66;
  const H = Math.max(675, tableTop + Math.max(A.length, B.length) * rowH + 84);
  const cv = document.createElement("canvas"); cv.width = W; cv.height = H;
  const c = cv.getContext("2d");
  const F = '-apple-system, "Segoe UI", Roboto, Arial, sans-serif';

  // backdrop: dark court with a gold glow
  const bg = c.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, "#241b0e"); bg.addColorStop(.5, "#15110b"); bg.addColorStop(1, "#0d0d10");
  c.fillStyle = bg; c.fillRect(0, 0, W, H);
  const glow = c.createRadialGradient(170, 90, 20, 170, 90, 620);
  glow.addColorStop(0, "rgba(255,205,60,.20)"); glow.addColorStop(1, "rgba(255,205,60,0)");
  c.fillStyle = glow; c.fillRect(0, 0, W, H);

  // header: logo + wordmark + subtitle + date
  if (logo) {
    c.save(); c.beginPath(); c.arc(112, 88, 56, 0, Math.PI * 2); c.closePath();
    c.fillStyle = "#0d0d10"; c.fill(); c.clip();
    c.drawImage(logo, 56, 32, 112, 112); c.restore();
    c.beginPath(); c.arc(112, 88, 56, 0, Math.PI * 2); c.lineWidth = 4; c.strokeStyle = "#c6971f"; c.stroke();
  }
  c.textBaseline = "alphabetic";
  c.fillStyle = "#f5d97b"; c.font = `900 52px ${F}`; c.fillText("BINSU STAR", 196, 84);
  c.fillStyle = "#cbb98a"; c.font = `800 22px ${F}`; c.fillText("SEASON 2 · GROUP STAGE STANDINGS", 196, 122);
  const dateTxt = new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  c.fillStyle = "#8f867a"; c.font = `600 19px ${F}`; c.textAlign = "right"; c.fillText("🏐 " + dateTxt, W - 60, 122); c.textAlign = "left";
  c.strokeStyle = "rgba(198,151,31,.5)"; c.lineWidth = 2;
  c.beginPath(); c.moveTo(56, headTop - 22); c.lineTo(W - 56, headTop - 22); c.stroke();

  // two group tables side by side
  const drawGroup = (x, name, dotColor, rows) => {
    const colW = 580;
    c.fillStyle = dotColor; c.beginPath(); c.arc(x + 12, headTop + 8, 9, 0, Math.PI * 2); c.fill();
    c.fillStyle = "#f2ecdd"; c.font = `900 27px ${F}`; c.fillText("GROUP " + name, x + 34, headTop + 17);
    c.fillStyle = "#8f867a"; c.font = `800 15px ${F}`;
    c.fillText("TEAM", x + 58, tableTop - 14);
    c.textAlign = "right";
    c.fillText("W–L", x + colW - 300, tableTop - 14);
    c.fillText("PTS", x + colW - 234, tableTop - 14);
    c.fillText("SETS", x + colW - 166, tableTop - 14);
    c.fillText("DIFF", x + colW - 100, tableTop - 14);
    c.textAlign = "left";
    c.fillText("FORM", x + colW - 84, tableTop - 14);
    rows.forEach((t, i) => {
      const y = tableTop + i * rowH;
      if (i % 2 === 0) { c.fillStyle = "rgba(255,255,255,.035)"; c.fillRect(x - 8, y - 4, colW + 16, rowH - 4); }
      if (i === 0) { c.fillStyle = "rgba(198,151,31,.16)"; c.fillRect(x - 8, y - 4, colW + 16, rowH - 4); }
      c.textBaseline = "middle";
      const midY = y + (rowH - 4) / 2 - 4;
      c.fillStyle = i === 0 ? "#f5d97b" : "#8f867a"; c.font = `900 22px ${F}`; c.fillText(String(i + 1), x + 4, midY);
      let nm = t.name; if (nm.length > 16) nm = nm.slice(0, 15) + "…";
      c.fillStyle = "#f2ecdd"; c.font = `800 24px ${F}`; c.fillText((i === 0 ? "👑 " : "") + nm, x + 42, midY);
      c.textAlign = "right"; c.font = `700 22px ${F}`; c.fillStyle = "#cbb98a";
      c.fillText(`${t.mw}–${t.ml}`, x + colW - 300, midY);
      const r = t.record;
      c.fillStyle = r > 0 ? "#57d98a" : r < 0 ? "#ff8080" : "#8f867a"; c.font = `900 24px ${F}`;
      c.fillText(r > 0 ? "+" + r : String(r), x + colW - 234, midY);
      const sd = (t.sw + t.sl) ? t.sw - t.sl : null;
      c.fillStyle = sd > 0 ? "#57d98a" : sd < 0 ? "#ff8080" : "#8f867a"; c.font = `700 20px ${F}`;
      c.fillText(sd == null ? "—" : (sd > 0 ? "+" + sd : String(sd)), x + colW - 166, midY);
      const dv = t.diff;
      c.fillStyle = dv > 0 ? "#57d98a" : dv < 0 ? "#ff8080" : "#8f867a"; c.font = `700 20px ${F}`;
      c.fillText(dv == null ? "—" : (dv > 0 ? "+" + dv : String(dv)), x + colW - 100, midY);
      c.textAlign = "left";
      const fm = (formBy[t.name] || []).slice(-5);
      fm.forEach((w, k) => {
        c.fillStyle = w ? "#2f9e5f" : "#b34a4a";
        c.beginPath(); c.roundRect(x + colW - 84 + k * 17, midY - 7, 13, 13, 4); c.fill();
      });
      if (!fm.length) { c.fillStyle = "#57503f"; c.font = `700 18px ${F}`; c.fillText("—", x + colW - 84, midY); }
      c.textBaseline = "alphabetic";
    });
  };
  drawGroup(60, "A", "#57d98a", A);
  drawGroup(680, "B", "#ff8080", B);

  // footer
  c.fillStyle = "#8f867a"; c.font = `700 18px ${F}`; c.textAlign = "center";
  c.fillText("binsuasia.netlify.app  ·  every match BO3  ·  win +1 / loss −1  ·  SETS = set diff · DIFF = point diff", W / 2, H - 34);
  c.textAlign = "left";
  return cv;
}
async function downloadStandingsGraphic() {
  const btn = document.getElementById("stGraphicBtn");
  if (btn) btn.textContent = "🎨 Drawing…";
  try {
    const cv = await buildStandingsCanvas();
    const a = document.createElement("a");
    a.download = "binsu-standings.png";
    a.href = cv.toDataURL("image/png");
    a.click();
    if (btn) btn.textContent = "✅ Saved!";
  } catch (e) { if (btn) btn.textContent = "⚠️ " + e.message; }
  setTimeout(() => { if (btn) btn.textContent = "📸 Download graphic"; }, 1800);
}

document.addEventListener("DOMContentLoaded", function () {
  renderS2Schedule(); renderS2Standings(); renderScoreStrip();
  const gBtn = document.getElementById("stGraphicBtn");
  if (gBtn) gBtn.addEventListener("click", downloadStandingsGraphic);
});
