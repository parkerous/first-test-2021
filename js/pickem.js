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
  if (scoreEl) scoreEl.innerHTML = scored
    ? `Your record: <b>${correct}/${scored}</b> correct · <b>${correct * PICK_POINTS} pts</b>`
    : `Make your picks — each correct call is worth <b>${PICK_POINTS} pts</b>.`;

  const bar = f => {
    const t = agg[f.id]; const a = (t && t.A) || 0, b = (t && t.B) || 0, n = a + b;
    if (!n) return "";
    const pa = Math.round(a / n * 100);
    return `<div class="pk-agg"><span style="width:${pa}%"></span></div>
      <div class="pk-aggtxt">${pa}% ${scrimEsc(f.teamA)} · ${100 - pa}% ${scrimEsc(f.teamB)} · ${n} pick${n === 1 ? "" : "s"}</div>`;
  };

  host.innerHTML = fx.map(f => {
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
    return `
      <div class="card pk-card">
        <div class="pk-head"><span class="pk-stage">${S2_STAGES[f.stage] || "Match"}</span><span class="pk-when">${scrimEsc(s2When(f))}</span></div>
        <div class="pk-row">${btn("A", f.teamA)}<span class="pk-vs">vs</span>${btn("B", f.teamB)}</div>
        ${bar(f)}
        <div class="pk-status">${status}</div>
      </div>`;
  }).join("");

  host.querySelectorAll("button.pk-team").forEach(b => b.addEventListener("click", async () => {
    const fid = b.dataset.fid, pick = b.dataset.pick;
    const p = loadPicks(); p[fid] = pick; savePicks(p);
    try { await apiPost("/pickem/vote", { fixtureId: fid, pick, voter: pickVoterId() }); } catch (e) { /* local pick still saved */ }
    renderPickem();
  }));
}

document.addEventListener("DOMContentLoaded", renderPickem);
