/* ============================================================
   Soai — Pick'em: fans predict Season 2 match winners.
   - Your picks live in this browser (localStorage) and are also sent
     to the backend so community totals can be shown. With the shared
     Worker deployed the totals cover every visitor; on the in-browser
     backend they only cover this browser.
   - A pick locks when the match starts (its scheduled time passes)
     or a result is posted. Each correct pick = 10 points.
   ============================================================ */

const PICK_POINTS = 10;

function pickVoterId() {
  try {
    let v = localStorage.getItem("soai_voter");
    if (!v) { v = "v_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 10); localStorage.setItem("soai_voter", v); }
    return v;
  } catch (e) { return "v_anon"; }
}
function loadPicks() { try { return JSON.parse(localStorage.getItem("soai_picks") || "{}"); } catch (e) { return {}; } }
function savePicks(p) { try { localStorage.setItem("soai_picks", JSON.stringify(p)); } catch (e) { /* ignore */ } }

function pickLocked(f) {
  if (s2Played(f)) return true;
  return !!(f.when && f.when <= Date.now());
}

async function renderPickem() {
  const host = document.getElementById("pickList");
  if (!host) return;
  let data = { teams: [], fixtures: [] };
  try { data = await apiGet("/s2"); } catch (e) { /* leave empty */ }
  if (typeof S2_GROUPS_CACHE !== "undefined") S2_GROUPS_CACHE = data.groups || S2_GROUPS_CACHE;
  const fx = (data.fixtures || []).slice()
    .sort((a, b) => (a.when || Infinity) - (b.when || Infinity) || (a.createdAt || 0) - (b.createdAt || 0));
  if (!fx.length) {
    host.innerHTML = `
      <div class="card" style="text-align:center;padding:26px">
        <div style="font-size:30px">🔮</div>
        <b>No Season 2 fixtures to predict yet</b>
        <p class="mini-note" style="margin:6px auto 0;max-width:520px">When the S2 schedule drops, every match shows up here — pick your winners before each game locks and climb the fan leaderboard.</p>
      </div>`;
    return;
  }
  let agg = {};
  try { agg = await apiGet("/pickem"); } catch (e) { /* totals optional */ }
  const picks = loadPicks();

  // your score across decided fixtures
  let scored = 0, correct = 0;
  fx.forEach(f => {
    const w = s2Winner(f);
    const my = picks[f.id];
    if (w && my) { scored++; if ((my === "A" ? f.teamA : f.teamB) === w) correct++; }
  });
  const scoreEl = document.getElementById("pickScore");
  if (scoreEl) {
    scoreEl.innerHTML = (scored
      ? `Your record: <b>${correct}/${scored}</b> correct · <b>${correct * PICK_POINTS} pts</b>`
      : `Make your picks — each correct call is worth <b>${PICK_POINTS} pts</b>. Picks lock at each match's start time (shown in your timezone).`)
      + ` <button class="btn ghost" id="pkShare" style="margin-left:10px;font-size:12px;padding:5px 10px">📤 Share my score</button>`;
  }

  const bar = f => {
    const t = agg[f.id]; const a = (t && t.A) || 0, b = (t && t.B) || 0, n = a + b;
    if (!n) return "";
    const pa = Math.round(a / n * 100);
    return `<div class="pk-agg"><span style="width:${pa}%"></span></div>
      <div class="pk-aggtxt">${pa}% ${scrimEsc(f.teamA)} · ${100 - pa}% ${scrimEsc(f.teamB)} · ${n} pick${n === 1 ? "" : "s"}</div>`;
  };

  const card = f => {
    const my = picks[f.id];
    const locked = pickLocked(f);
    const w = s2Winner(f);
    const btn = (side, name) => {
      const on = my === side;
      if (locked) {
        const won = w && name === w;
        return `<span class="pk-team${on ? " picked" : ""}${won ? " won" : ""}">${won ? "🏆 " : ""}${scrimEsc(name)}${on ? " · your pick" : ""}</span>`;
      }
      return `<button class="pk-team pk-btn${on ? " picked" : ""}" data-fid="${scrimEsc(f.id)}" data-pick="${side}">${scrimEsc(name)}</button>`;
    };
    const status = w
      ? (my ? ((my === "A" ? f.teamA : f.teamB) === w ? `<span class="pk-res good">✅ +${PICK_POINTS} pts</span>` : `<span class="pk-res bad">❌ Missed</span>`) : `<span class="pk-res">Final</span>`)
      : locked ? `<span class="pk-res">🔒 Locked — awaiting result</span>`
      : my ? `<span class="pk-res good">Pick saved — you can change it until the match starts</span>` : `<span class="pk-res">Pick a winner</span>`;
    const chip = (typeof groupChip === "function") ? groupChip(f) : "";
    return `
      <div class="card pk-card">
        <div class="pk-head"><span class="pk-stage">${chip}${S2_STAGES[f.stage] || "Match"} · BO3</span><span class="pk-when">${scrimEsc(s2When(f))}</span></div>
        <div class="pk-row">${btn("A", f.teamA)}<span class="pk-vs">vs</span>${btn("B", f.teamB)}</div>
        ${bar(f)}
        <div class="pk-status">${status}</div>
      </div>`;
  };

  // upcoming picks grouped by the visitor's local match night; finished tucked away
  const open = fx.filter(f => !s2Played(f));
  const done = fx.filter(s2Played).sort((a, b) => (b.when || b.createdAt || 0) - (a.when || a.createdAt || 0));
  const byDay = [];
  open.forEach(f => {
    const key = f.when ? new Date(f.when).toDateString() : "TBA";
    const last = byDay[byDay.length - 1];
    if (last && last.key === key) last.items.push(f);
    else byDay.push({ key, when: f.when, items: [f] });
  });
  const dayHead = d => d.when
    ? new Date(d.when).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })
    : "Date TBA";
  host.innerHTML =
    byDay.map(d => `<h3 class="grp" style="margin:20px 0 10px">${dayHead(d)}</h3>` + d.items.map(card).join("")).join("") +
    (done.length ? `
      <details class="pk-fin" style="margin-top:22px">
        <summary class="grp" style="cursor:pointer">🏁 Finished matches (${done.length}) — tap to review</summary>
        <div style="margin-top:10px">${done.map(card).join("")}</div>
      </details>` : "");

  const share = document.getElementById("pkShare");
  if (share) share.addEventListener("click", async () => {
    const txt = `🔮 Binsu Star Pick'em — I'm ${correct}/${scored} (${correct * PICK_POINTS} pts)! Make your picks: ${location.origin + location.pathname}`;
    try { await navigator.clipboard.writeText(txt); share.textContent = "✅ Copied!"; }
    catch (e) { share.textContent = txt; }
    setTimeout(() => { share.textContent = "📤 Share my score"; }, 1600);
  });

  host.querySelectorAll("button.pk-team").forEach(b => b.addEventListener("click", async () => {
    const fid = b.dataset.fid, pick = b.dataset.pick;
    const p = loadPicks(); p[fid] = pick; savePicks(p);
    try { await apiPost("/pickem/vote", { fixtureId: fid, pick, voter: pickVoterId() }); } catch (e) { /* local pick still saved */ }
    renderPickem();
  }));

  renderPickBoard();
}

/* ---------- fan leaderboard: every voter ranked by pick'em points ---------- */
function pickName() { try { return localStorage.getItem("soai_pick_name") || ""; } catch (e) { return ""; } }
async function renderPickBoard() {
  const host = document.getElementById("pickBoard");
  if (!host) return;
  let lb = { rows: [], total: 0 };
  try { lb = await apiGet("/pickem/leaderboard?voter=" + encodeURIComponent(pickVoterId())); } catch (e) { /* board optional */ }
  if (!lb.rows || !lb.rows.length) {
    host.innerHTML = `<div class="card" style="text-align:center;padding:22px">
      <div style="font-size:26px">🏆</div><b>No fans on the board yet</b>
      <p class="mini-note" style="margin:6px auto 0;max-width:480px">Make a pick above and you're in — points land as soon as your matches finish.</p></div>`;
    return;
  }
  const medal = i => i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : String(i + 1);
  host.innerHTML = `<div class="table-scroll"><table class="standings">
    <thead><tr><th>Rank</th><th>Fan</th><th class="num">Correct</th><th class="num">Picks</th><th class="num">Pts</th></tr></thead>
    <tbody>` + lb.rows.map((r, i) => `
      <tr${r.you ? ' style="background:color-mix(in srgb, var(--yellow) 14%, transparent);font-weight:800"' : ""}>
        <td class="rk">${medal(i)}</td>
        <td>${scrimEsc(r.name)}${r.you ? ' <span class="pending-pill">you</span>' : ""}</td>
        <td class="num">${r.correct}</td><td class="num">${r.picks}</td>
        <td class="num"><b>${r.pts}</b></td>
      </tr>`).join("") + `
    </tbody></table></div>
    <p class="mini-note" style="margin-top:8px">${lb.total} fan${lb.total === 1 ? "" : "s"} on the board · top 20 shown${lb.you && !lb.rows.some(r => r.you) ? ` · you: ${lb.you.pts} pts (outside the top 20 — keep picking!)` : ""}</p>`;
}
function initPickName() {
  const inp = document.getElementById("pkName"), btn = document.getElementById("pkNameSave");
  if (!inp || !btn) return;
  inp.value = pickName();
  btn.addEventListener("click", async () => {
    const m = document.getElementById("pkNameMsg");
    const name = inp.value.trim().slice(0, 24);
    try { name ? localStorage.setItem("soai_pick_name", name) : localStorage.removeItem("soai_pick_name"); } catch (e) {}
    m.textContent = "Saving…";
    try {
      const r = await apiPost("/pickem/name", { voter: pickVoterId(), name });
      m.textContent = (r && r.ok) ? (name ? "✅ You're on the board as “" + name + "”." : "Name cleared — you'll show as “Fan ####”.") : "⚠️ " + ((r && r.error) || "failed");
    } catch (e) { m.textContent = "⚠️ " + e.message; }
    renderPickBoard();
  });
}

document.addEventListener("DOMContentLoaded", () => { renderPickem(); initPickName(); });
