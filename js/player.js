/* ============================================================
   Voll-E Player Report — an individual uploads their own video,
   taps to log every serve / receive / set / hit, sees their stat
   line, and emails themselves a performance report.

   No server required: the report is delivered by opening the
   player's own email app pre-filled (mailto). Optional EmailJS
   auto-send can be switched on with a free account.
   ============================================================ */

const EVENTS_KEY = "volle_player_events_v1";
const PROFILE_KEY = "volle_player_profile_v1";
const EMAILJS_KEY = "volle_emailjs_v1";

let events = load(EVENTS_KEY, []);
let player = null;           // playback abstraction
let videoLabel = "";

/* action -> allowed results (with quality weight for receives) */
const SKILLS = {
  serve:   { label: "🎯 Serve",   results: [["ace", "good", "Ace"], ["in", "mid", "In"], ["error", "bad", "Error"]] },
  receive: { label: "🛡 Receive", results: [["perfect", "good", "Perfect"], ["ok", "mid", "OK"], ["poor", "mid", "Poor"], ["error", "bad", "Shank"]] },
  set:     { label: "🙌 Set",     results: [["assist", "good", "Assist"], ["in", "mid", "In"], ["error", "bad", "Error"]] },
  hit:     { label: "⚡ Hit",     results: [["kill", "good", "Kill"], ["in", "mid", "In play"], ["error", "bad", "Error"]] },
};

/* ============================================================
   Storage helpers
   ============================================================ */
function load(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) || fallback; } catch { return fallback; } }
function saveEvents() { localStorage.setItem(EVENTS_KEY, JSON.stringify(events)); }

function profile() {
  return {
    name: (document.getElementById("pName").value.trim()) || "Me",
    email: document.getElementById("pEmail").value.trim(),
  };
}
function saveProfile() { localStorage.setItem(PROFILE_KEY, JSON.stringify(profile())); }
function myEvents() { return events.filter(e => e.player === profile().name); }

/* ============================================================
   Video loading (local file main; YouTube supported too)
   ============================================================ */
function parseYouTubeId(url) {
  const m = String(url).match(/(?:youtu\.be\/|v=|embed\/|shorts\/)([\w-]{11})/);
  return m ? m[1] : (/^[\w-]{11}$/.test(url) ? url : null);
}
function loadLocalFile(file) {
  if (!file) return;
  videoLabel = "file:" + file.name;
  const stage = document.getElementById("stage");
  stage.innerHTML = `<video id="localvid" playsinline controls></video>`;
  const v = document.getElementById("localvid");
  v.src = URL.createObjectURL(file);
  v.addEventListener("loadedmetadata", () => {
    player = {
      play: () => v.play(), pause: () => v.pause(),
      seek: t => { v.currentTime = Math.max(0, t); }, time: () => v.currentTime || 0,
      rate: r => { v.playbackRate = r; },
    };
    setHint("Recording loaded. Play it and tap a button each time you serve, receive, set or hit.");
  });
}
function loadYouTube(url) {
  const id = parseYouTubeId(url);
  if (!id) { setHint("⚠️ That doesn't look like a YouTube link."); return; }
  videoLabel = "YouTube:" + id;
  document.getElementById("stage").innerHTML = `<div id="ytplayer"></div>`;
  const make = () => new YT.Player("ytplayer", {
    videoId: id, playerVars: { rel: 0, modestbranding: 1 },
    events: { onReady: e => { const yt = e.target; player = { play: () => yt.playVideo(), pause: () => yt.pauseVideo(), seek: t => yt.seekTo(Math.max(0, t), true), time: () => yt.getCurrentTime() || 0, rate: r => yt.setPlaybackRate(r) }; setHint("Video loaded. Tap a button each time you touch the ball."); } },
  });
  if (window.YT && window.YT.Player) make();
  else { window.onYouTubeIframeAPIReady = make; if (!document.getElementById("yt-api")) { const s = document.createElement("script"); s.id = "yt-api"; s.src = "https://www.youtube.com/iframe_api"; document.head.appendChild(s); } }
}

/* ============================================================
   Tagging
   ============================================================ */
function tag(action, result) {
  const p = profile();
  events.push({
    id: "ev-" + events.length + "-" + Math.round((player ? player.time() : 0) * 1000),
    player: p.name, action, result,
    t: +(player ? player.time() : 0).toFixed(2), video: videoLabel,
  });
  saveEvents();
  const r = SKILLS[action].results.find(x => x[0] === result);
  setHint(`Logged: ${SKILLS[action].label.slice(2)} — ${r ? r[2] : result} at ${fmtTime(player ? player.time() : 0)}.`);
  render();
}
function removeEvent(id) { events = events.filter(e => e.id !== id); saveEvents(); render(); }
function jumpTo(t) { if (player) { player.seek(t); setHint("Jumped to " + fmtTime(t)); } }

/* ============================================================
   Stats
   ============================================================ */
function computeStats() {
  const ev = myEvents();
  const by = a => ev.filter(e => e.action === a);
  const cnt = (a, r) => by(a).filter(e => e.result === r).length;

  // Serving
  const serves = by("serve").length, aces = cnt("serve", "ace"), sErr = cnt("serve", "error");

  // Receiving — quality weights (passing average out of 3)
  const recW = { perfect: 3, ok: 2, poor: 1, error: 0 };
  const recs = by("receive");
  const passAvg = recs.length ? recs.reduce((s, e) => s + (recW[e.result] ?? 0), 0) / recs.length : 0;
  const goodPass = recs.filter(e => e.result === "perfect" || e.result === "ok").length;

  // Setting
  const sets = by("set").length, assists = cnt("set", "assist");

  // Hitting
  const hits = by("hit").length, kills = cnt("hit", "kill"), hErr = cnt("hit", "error");
  const killPct = hits ? Math.round((kills / hits) * 100) : 0;
  const hitEff = hits ? ((kills - hErr) / hits) : 0;  // hitting efficiency (-1..1)

  // Points credited to the player = kills + aces
  const pts = kills + aces;

  return {
    pts,
    serve: { n: serves, aces, err: sErr, acePct: serves ? Math.round((aces / serves) * 100) : 0 },
    receive: { n: recs.length, avg: passAvg, goodPct: recs.length ? Math.round((goodPass / recs.length) * 100) : 0 },
    set: { n: sets, assists },
    hit: { n: hits, kills, err: hErr, killPct, eff: hitEff },
  };
}

/* ============================================================
   Render
   ============================================================ */
function render() { drawStats(); drawLog(); refreshPlayerList(); }

function drawStats() {
  const s = computeStats();
  document.getElementById("ptsHero").innerHTML = `<div class="n">${s.pts}</div><div class="l">POINTS SCORED (kills + aces)</div>`;
  document.getElementById("statline").innerHTML = `
    ${grp("⚡ Hitting (hit rate)", `${s.hit.killPct}%`, `${s.hit.kills} kills / ${s.hit.n} attempts · ${s.hit.err} errors · efficiency ${s.hit.eff.toFixed(2)}`)}
    ${grp("🎯 Serving", `${s.serve.aces} aces`, `${s.serve.n} serves · ${s.serve.err} errors · ace rate ${s.serve.acePct}%`)}
    ${grp("🛡 Receiving", `${s.receive.avg.toFixed(2)}/3`, `${s.receive.n} receptions · ${s.receive.goodPct}% good passes`)}
    ${grp("🙌 Setting", `${s.set.assists}`, `${s.set.assists} assists / ${s.set.n} sets`)}
  `;
}
function grp(name, head, detail) {
  return `<div class="statgrp"><div class="top"><span class="name">${name}</span><span class="head">${head}</span></div><div class="detail">${detail}</div></div>`;
}

function drawLog() {
  const ev = myEvents().slice().reverse();
  const body = document.getElementById("logBody");
  document.getElementById("logCount").textContent = ev.length;
  if (!ev.length) { body.innerHTML = `<tr><td colspan="4" class="empty">No touches logged yet. Play your video and tap a button.</td></tr>`; return; }
  body.innerHTML = ev.map(e => {
    const r = SKILLS[e.action].results.find(x => x[0] === e.result);
    return `<tr>
      <td>${fmtTime(e.t)}</td>
      <td>${SKILLS[e.action].label.slice(2)}</td>
      <td>${r ? r[2] : e.result}</td>
      <td><button class="del" style="color:var(--accent2)" onclick="jumpTo(${e.t})" title="Jump">⏱</button>
          <button class="del" onclick="removeEvent('${e.id}')" title="Delete">×</button></td>
    </tr>`;
  }).join("");
}

function refreshPlayerList() {
  const names = [...new Set(events.map(e => e.player))];
  const dl = document.getElementById("names");
  if (dl) dl.innerHTML = names.map(n => `<option value="${escapeHtml(n)}"></option>`).join("");
}

/* ============================================================
   Build + send the report
   ============================================================ */
function buildReport() {
  const p = profile();
  const s = computeStats();
  const L = [];
  L.push(`🏐 VOLL-E PERFORMANCE REPORT`);
  L.push(`Player: ${p.name}`);
  if (videoLabel) L.push(`Video: ${videoLabel}`);
  L.push(``);
  L.push(`★ POINTS SCORED: ${s.pts}   (kills + aces)`);
  L.push(``);
  L.push(`⚡ HITTING`);
  L.push(`   Attempts: ${s.hit.n}   Kills: ${s.hit.kills}   Errors: ${s.hit.err}`);
  L.push(`   Hit rate (kill %): ${s.hit.killPct}%   Efficiency: ${s.hit.eff.toFixed(2)}`);
  L.push(``);
  L.push(`🎯 SERVING`);
  L.push(`   Serves: ${s.serve.n}   Aces: ${s.serve.aces}   Errors: ${s.serve.err}   Ace rate: ${s.serve.acePct}%`);
  L.push(``);
  L.push(`🛡 RECEIVING`);
  L.push(`   Receptions: ${s.receive.n}   Passing avg: ${s.receive.avg.toFixed(2)}/3   Good passes: ${s.receive.goodPct}%`);
  L.push(``);
  L.push(`🙌 SETTING`);
  L.push(`   Sets: ${s.set.n}   Assists: ${s.set.assists}`);
  L.push(``);
  L.push(coach(s));
  L.push(``);
  L.push(`— Generated by Voll-E`);
  return L.join("\n");
}

/* a friendly one-line coaching note based on the numbers */
function coach(s) {
  const tips = [];
  if (s.hit.n >= 3) tips.push(s.hit.killPct >= 40 ? "Great finishing rate on your hits." : "Work on hitting placement to lift your kill rate.");
  if (s.serve.n >= 3) tips.push(s.serve.err > s.serve.aces ? "Tighten up serving — errors above aces." : "Serving is a weapon, keep it up.");
  if (s.receive.n >= 3) tips.push(s.receive.avg >= 2.2 ? "Solid passing, you give your setter good balls." : "Focus on platform angle to raise passing average.");
  return tips.length ? "Coach's note: " + tips.join(" ") : "Log a few more touches for a fuller report.";
}

function emailReport() {
  const p = profile();
  if (!p.email) { setHint("⚠️ Enter your email above so the report can be sent to you."); document.getElementById("pEmail").focus(); return; }
  saveProfile();
  const report = buildReport();
  const cfg = load(EMAILJS_KEY, {});

  // Optional: real auto-send via EmailJS if configured
  if (cfg.service && cfg.template && cfg.pubkey) {
    sendViaEmailJS(cfg, p, report);
    return;
  }
  // Default: open the player's email app pre-filled
  const subject = `My Voll-E volleyball report — ${p.name}`;
  const url = `mailto:${encodeURIComponent(p.email).replace(/%40/g, "@")}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(report)}`;
  window.location.href = url;
  setHint("📧 Opening your email app with the report pre-filled — press Send. (Turn on auto-send in Setup below to skip this.)");
}

function sendViaEmailJS(cfg, p, report) {
  const run = () => {
    setHint("Sending your report…");
    window.emailjs.send(cfg.service, cfg.template, { to_email: p.email, to_name: p.name, report }, cfg.pubkey)
      .then(() => setHint("✅ Report emailed to " + p.email))
      .catch(err => { setHint("⚠️ Auto-send failed (" + (err && err.text || "error") + ") — opening your email app instead."); const url = `mailto:${encodeURIComponent(p.email).replace(/%40/g, "@")}?subject=${encodeURIComponent("My Voll-E report")}&body=${encodeURIComponent(report)}`; window.location.href = url; });
  };
  if (window.emailjs) run();
  else { const s = document.createElement("script"); s.src = "https://cdn.jsdelivr.net/npm/@emailjs/browser@4/dist/email.min.js"; s.onload = run; s.onerror = () => setHint("⚠️ Couldn't load the email service. Use the pre-filled email instead."); document.head.appendChild(s); }
}

function saveEmailJS() {
  const cfg = {
    service: document.getElementById("ejService").value.trim(),
    template: document.getElementById("ejTemplate").value.trim(),
    pubkey: document.getElementById("ejKey").value.trim(),
  };
  localStorage.setItem(EMAILJS_KEY, JSON.stringify(cfg));
  setHint(cfg.service && cfg.template && cfg.pubkey ? "✅ Auto-send is ON." : "Auto-send off — using pre-filled email.");
}

/* ============================================================
   Helpers
   ============================================================ */
function setHint(t) { document.getElementById("hint").textContent = t; }
function fmtTime(s) { s = Math.max(0, Math.round(s || 0)); return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0"); }
function escapeHtml(s) { return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }

/* ============================================================
   Build the quick-tag buttons + wire everything up
   ============================================================ */
function buildSkillButtons() {
  const host = document.getElementById("skills");
  host.innerHTML = Object.entries(SKILLS).map(([action, def]) => `
    <div class="skill">
      <h3>${def.label}</h3>
      <div class="tags">
        ${def.results.map(([res, tone, label]) => `<button class="tagbtn ${tone}" data-a="${action}" data-r="${res}">${label}</button>`).join("")}
      </div>
    </div>`).join("");
  host.querySelectorAll(".tagbtn").forEach(b => b.addEventListener("click", () => tag(b.dataset.a, b.dataset.r)));
}

function init() {
  // restore profile
  const prof = load(PROFILE_KEY, {});
  if (prof.name) document.getElementById("pName").value = prof.name;
  if (prof.email) document.getElementById("pEmail").value = prof.email;
  const ej = load(EMAILJS_KEY, {});
  if (ej.service) document.getElementById("ejService").value = ej.service;
  if (ej.template) document.getElementById("ejTemplate").value = ej.template;
  if (ej.pubkey) document.getElementById("ejKey").value = ej.pubkey;

  buildSkillButtons();

  document.getElementById("loadYt").addEventListener("click", () => loadYouTube(document.getElementById("ytUrl").value));
  document.getElementById("localFile").addEventListener("change", e => loadLocalFile(e.target.files[0]));
  document.getElementById("pName").addEventListener("input", render);
  document.getElementById("pName").addEventListener("change", saveProfile);
  document.getElementById("pEmail").addEventListener("change", saveProfile);
  document.getElementById("emailBtn").addEventListener("click", emailReport);
  document.getElementById("saveEjBtn").addEventListener("click", saveEmailJS);
  document.getElementById("speed").addEventListener("change", e => { if (player) player.rate(parseFloat(e.target.value)); });
  document.getElementById("clearBtn").addEventListener("click", () => {
    if (confirm("Clear all touches for " + profile().name + "?")) { events = events.filter(e => e.player !== profile().name); saveEvents(); render(); }
  });

  render();
  setHint("Enter your name & email, upload your clip, then tap a button for each touch.");
}
document.addEventListener("DOMContentLoaded", init);
