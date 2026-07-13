/* ============================================================
   Soai Player Report — an individual uploads their own video,
   picks their role, taps every touch (serve / receive / dig / set /
   setteable ball / hit / block), sees a role-aware stat line with
   timestamps, and emails themselves a report.

   Bonus: reads the game's "who hit" announcement banner off an
   uploaded clip using in-browser OCR (Tesseract.js) — assist only.

   No server: report is delivered by opening the player's own mail
   app pre-filled (mailto), or via optional EmailJS auto-send.
   ============================================================ */

const EVENTS_KEY = "volle_player_events_v1";
const PROFILE_KEY = "volle_player_profile_v1";
const EMAILJS_KEY = "volle_emailjs_v1";

let events = load(EVENTS_KEY, []);
let player = null;           // playback abstraction
let videoLabel = "";
let lastDetected = "";       // last hitter name read from the announcement

/* ---- every skill we can tag, with its result buttons ---- */
const SKILLS = {
  serve:     { label: "🎯 Serve",     results: [["ace", "good", "Ace"], ["in", "mid", "In"], ["error", "bad", "Error"]] },
  receive:   { label: "🛡 Receive",   results: [["perfect", "good", "Perfect"], ["ok", "mid", "OK"], ["poor", "mid", "Poor"], ["error", "bad", "Shank"]] },
  dig:       { label: "🤿 Dig",       results: [["dig", "good", "Dig up"], ["touch", "mid", "Touch"], ["missed", "bad", "Missed (in range)"]] },
  set:       { label: "🙌 Set",       results: [["assist", "good", "Assist"], ["in", "mid", "In"], ["error", "bad", "Error"]] },
  setteable: { label: "✋ Setteable",  results: [["set", "good", "Set it"], ["missed", "bad", "Couldn't set"]] },
  hit:       { label: "⚡ Hit",       results: [["kill", "good", "Kill"], ["in", "mid", "In play"], ["error", "bad", "Error"]] },
  block:     { label: "🧱 Block",     results: [["stuff", "good", "Stuff (point)"], ["touch", "mid", "Touch"], ["error", "bad", "Error"]] },
};

/* ---- roles: which skills matter, and which are the headline stats ---- */
const ROLES = {
  Setter:   { skills: ["set", "setteable", "serve", "dig", "hit", "block"], key: ["set", "setteable"] },
  Outside:  { skills: ["hit", "receive", "dig", "serve", "block", "set"],   key: ["hit", "receive"] },
  Opposite: { skills: ["hit", "block", "serve", "dig", "set"],              key: ["hit", "block"] },
  Middle:   { skills: ["hit", "block", "serve", "set"],                     key: ["block", "hit"] },
  Libero:   { skills: ["receive", "dig", "set", "serve"],                   key: ["receive", "dig"] },
  Any:      { skills: ["serve", "receive", "dig", "set", "setteable", "hit", "block"], key: ["hit", "receive"] },
};

/* ============================================================
   Storage
   ============================================================ */
function load(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) || fallback; } catch { return fallback; } }
function saveEvents() { localStorage.setItem(EVENTS_KEY, JSON.stringify(events)); }
function profile() {
  return {
    name: (document.getElementById("pName").value.trim()) || "Me",
    email: document.getElementById("pEmail").value.trim(),
    role: document.getElementById("pRole").value || "Any",
  };
}
function saveProfile() { localStorage.setItem(PROFILE_KEY, JSON.stringify(profile())); }
function myEvents() { return events.filter(e => e.player === profile().name); }
function roleDef() { return ROLES[profile().role] || ROLES.Any; }

/* ============================================================
   Video loading (uploaded file — main; YouTube supported for playback)
   ============================================================ */
function parseYouTubeId(url) {
  const m = String(url).match(/(?:youtu\.be\/|v=|embed\/|shorts\/)([\w-]{11})/);
  return m ? m[1] : (/^[\w-]{11}$/.test(url) ? url : null);
}
function loadLocalFile(file) {
  if (!file) return;
  videoLabel = "file:" + file.name;
  document.getElementById("stage").innerHTML = `<video id="localvid" playsinline controls crossorigin="anonymous"></video>`;
  const v = document.getElementById("localvid");
  v.src = URL.createObjectURL(file);
  v.addEventListener("loadedmetadata", () => {
    player = { play: () => v.play(), pause: () => v.pause(), seek: t => { v.currentTime = Math.max(0, t); }, time: () => v.currentTime || 0, rate: r => { v.playbackRate = r; } };
    setHint("Clip loaded. Play it and tap a button for each touch. Announcement reading is available below.");
  });
}
function loadYouTube(url) {
  const id = parseYouTubeId(url);
  if (!id) { setHint("⚠️ That doesn't look like a YouTube link."); return; }
  videoLabel = "YouTube:" + id;
  document.getElementById("stage").innerHTML = `<div id="ytplayer"></div>`;
  const make = () => new YT.Player("ytplayer", {
    videoId: id, playerVars: { rel: 0, modestbranding: 1 },
    events: { onReady: e => { const yt = e.target; player = { play: () => yt.playVideo(), pause: () => yt.pauseVideo(), seek: t => yt.seekTo(Math.max(0, t), true), time: () => yt.getCurrentTime() || 0, rate: r => yt.setPlaybackRate(r) }; setHint("Video loaded. Tap a button for each touch. (Announcement reading works on uploaded clips only.)"); } },
  });
  if (window.YT && window.YT.Player) make();
  else { window.onYouTubeIframeAPIReady = make; if (!document.getElementById("yt-api")) { const s = document.createElement("script"); s.id = "yt-api"; s.src = "https://www.youtube.com/iframe_api"; document.head.appendChild(s); } }
}

/* ============================================================
   Tagging — every play is timestamped with the video time
   ============================================================ */
function tag(action, result, whoOverride) {
  const p = profile();
  events.push({
    id: "ev-" + events.length + "-" + Math.round((player ? player.time() : 0) * 1000),
    player: whoOverride || p.name, action, result,
    t: +(player ? player.time() : 0).toFixed(2), video: videoLabel,
  });
  saveEvents();
  const r = SKILLS[action].results.find(x => x[0] === result);
  setHint(`[${fmtTime(player ? player.time() : 0)}] ${SKILLS[action].label.slice(2)} — ${r ? r[2] : result} logged.`);
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

  const serves = by("serve").length, aces = cnt("serve", "ace");
  const recW = { perfect: 3, ok: 2, poor: 1, error: 0 };
  const recs = by("receive");
  const passAvg = recs.length ? recs.reduce((s, e) => s + (recW[e.result] ?? 0), 0) / recs.length : 0;
  const goodPass = recs.filter(e => e.result === "perfect" || e.result === "ok").length;

  const digs = by("dig");                                   // every dig event = a ball in close proximity (a "potential dig")
  const digMade = cnt("dig", "dig") + cnt("dig", "touch");  // got a hand on it
  const digClean = cnt("dig", "dig");

  const sets = by("set").length, assists = cnt("set", "assist");
  const setteable = by("setteable");                        // balls that came close & were setteable
  const setteableConv = cnt("setteable", "set");

  const hits = by("hit").length, kills = cnt("hit", "kill"), hErr = cnt("hit", "error");
  const blocks = by("block").length, stuffs = cnt("block", "stuff");

  const pts = kills + aces + stuffs;                        // terminal points credited to the player

  return {
    pts,
    serve: { n: serves, aces, err: cnt("serve", "error"), acePct: serves ? Math.round(aces / serves * 100) : 0 },
    receive: { n: recs.length, avg: passAvg, goodPct: recs.length ? Math.round(goodPass / recs.length * 100) : 0 },
    dig: { n: digs.length, made: digMade, clean: digClean, missed: cnt("dig", "missed"), pct: digs.length ? Math.round(digMade / digs.length * 100) : 0 },
    set: { n: sets, assists },
    setteable: { n: setteable.length, conv: setteableConv, pct: setteable.length ? Math.round(setteableConv / setteable.length * 100) : 0 },
    hit: { n: hits, kills, err: hErr, killPct: hits ? Math.round(kills / hits * 100) : 0, eff: hits ? (kills - hErr) / hits : 0 },
    block: { n: blocks, stuffs, touch: cnt("block", "touch") },
  };
}

/* ============================================================
   Render
   ============================================================ */
function render() { drawStats(); drawLog(); refreshPlayerList(); }

/* map each skill to a stat-line group renderer */
function groupFor(skill, s) {
  switch (skill) {
    case "hit":       return grp("⚡ Hitting (hit rate)", `${s.hit.killPct}%`, `${s.hit.kills} kills / ${s.hit.n} attempts · ${s.hit.err} errors · eff ${s.hit.eff.toFixed(2)}`);
    case "serve":     return grp("🎯 Serving", `${s.serve.aces} aces`, `${s.serve.n} serves · ${s.serve.err} errors · ace rate ${s.serve.acePct}%`);
    case "receive":   return grp("🛡 Receiving", `${s.receive.avg.toFixed(2)}/3`, `${s.receive.n} receptions · ${s.receive.goodPct}% good`);
    case "dig":       return grp("🤿 Digging", `${s.dig.pct}%`, `${s.dig.made}/${s.dig.n} potential digs reached · ${s.dig.clean} clean · ${s.dig.missed} missed in range`);
    case "set":       return grp("🙌 Setting", `${s.set.assists}`, `${s.set.assists} assists / ${s.set.n} sets`);
    case "setteable": return grp("✋ Setteable balls", `${s.setteable.pct}%`, `${s.setteable.conv}/${s.setteable.n} setteable balls handled`);
    case "block":     return grp("🧱 Blocking", `${s.block.stuffs}`, `${s.block.stuffs} stuffs · ${s.block.touch} touches / ${s.block.n} blocks`);
    default: return "";
  }
}
function drawStats() {
  const s = computeStats();
  const role = profile().role;
  document.getElementById("ptsHero").innerHTML = `<div class="n">${s.pts}</div><div class="l">POINTS SCORED · role: ${role} (kills + aces + blocks)</div>`;
  document.getElementById("statline").innerHTML = roleDef().skills.map(sk => groupFor(sk, s)).join("");
}
function grp(name, head, detail) {
  return `<div class="statgrp"><div class="top"><span class="name">${name}</span><span class="head">${head}</span></div><div class="detail">${detail}</div></div>`;
}

function drawLog() {
  const ev = myEvents().slice().reverse();
  const body = document.getElementById("logBody");
  document.getElementById("logCount").textContent = ev.length;
  if (!ev.length) { body.innerHTML = `<tr><td colspan="4" class="empty">No touches logged yet.</td></tr>`; return; }
  body.innerHTML = ev.map(e => {
    const r = SKILLS[e.action].results.find(x => x[0] === e.result);
    return `<tr>
      <td><b>${fmtTime(e.t)}</b></td>
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
   Build skill buttons for the chosen role
   ============================================================ */
function buildSkillButtons() {
  const host = document.getElementById("skills");
  host.innerHTML = roleDef().skills.map(action => {
    const def = SKILLS[action];
    return `<div class="skill">
      <h3>${def.label}</h3>
      <div class="tags">${def.results.map(([res, tone, label]) => `<button class="tagbtn ${tone}" data-a="${action}" data-r="${res}">${label}</button>`).join("")}</div>
    </div>`;
  }).join("");
  host.querySelectorAll(".tagbtn").forEach(b => b.addEventListener("click", () => tag(b.dataset.a, b.dataset.r)));
}

/* ============================================================
   Announcement reader (OCR of the "who hit" banner)
   Works on uploaded clips only — browsers block reading YouTube pixels.
   ============================================================ */
function ensureTesseract() {
  return new Promise((res, rej) => {
    if (window.Tesseract) return res(window.Tesseract);
    const s = document.createElement("script");
    s.src = "https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js";
    s.onload = () => res(window.Tesseract);
    s.onerror = () => rej(new Error("could not load the OCR engine (needs internet)"));
    document.head.appendChild(s);
  });
}
function guessHitter(text) {
  const m = text.match(/([A-Za-z0-9_]{2,20})\s+(?:spiked|spikes|hit|hits|attacked|attacks|kills?|scored)/i);
  if (m) return m[1];
  const m2 = text.match(/[A-Za-z0-9_]{2,20}/);
  return m2 ? m2[0] : "";
}
async function readAnnouncement() {
  const v = document.getElementById("localvid");
  if (!v || !v.videoWidth) { setAnn("⚠️ Upload a video clip first — announcement reading needs an uploaded file, not YouTube."); return; }
  const pct = clamp(parseFloat(document.getElementById("annPct").value) || 15, 3, 60) / 100;
  const w = v.videoWidth, srcH = Math.round(v.videoHeight * pct);
  const scale = w < 900 ? 2 : 1;                 // upscale small frames to help OCR
  const c = document.getElementById("annCanvas");
  c.width = w * scale; c.height = srcH * scale;
  const ctx = c.getContext("2d");
  ctx.imageSmoothingEnabled = true;
  try { ctx.drawImage(v, 0, 0, w, srcH, 0, 0, c.width, c.height); }
  catch (e) { setAnn("⚠️ Couldn't read the frame (the browser blocked it). This works on uploaded clips."); return; }
  c.style.display = "block";
  setAnn("Reading… (first run downloads the OCR engine, a few seconds).");
  try {
    const T = await ensureTesseract();
    const { data: { text } } = await T.recognize(c, "eng");
    const clean = text.replace(/\s+/g, " ").trim();
    lastDetected = guessHitter(clean);
    document.getElementById("annName").value = lastDetected || "";
    setAnn(clean ? `Detected: “${clean}”${lastDetected ? `  →  hitter: ${lastDetected}` : ""}` : "No text found — try nudging the region % or pausing on a clear frame.");
  } catch (e) { setAnn("⚠️ " + e.message); }
}
function logAnnouncedHit(result) {
  const name = (document.getElementById("annName").value.trim()) || profile().name;
  tag("hit", result, name);
  setAnn(`Logged ${result} for “${name}” at ${fmtTime(player ? player.time() : 0)}.`);
}
function setAnn(t) { document.getElementById("annOut").textContent = t; }

/* ============================================================
   Report + email
   ============================================================ */
function buildReport() {
  const p = profile(), s = computeStats(), L = [];
  L.push(`🏐 SOAI PERFORMANCE REPORT`);
  L.push(`Player: ${p.name}   Role: ${p.role}`);
  if (videoLabel) L.push(`Video: ${videoLabel}`);
  L.push(``);
  L.push(`★ POINTS SCORED: ${s.pts}   (kills + aces + blocks)`);
  L.push(``);
  // headline stats for this role first, then the rest
  const order = [...roleDef().key, ...roleDef().skills.filter(k => !roleDef().key.includes(k))];
  for (const sk of order) L.push(reportLine(sk, s));
  L.push(``);
  L.push(`⏱ PLAY-BY-PLAY`);
  for (const e of myEvents()) {
    const r = SKILLS[e.action].results.find(x => x[0] === e.result);
    L.push(`   ${fmtTime(e.t)}  ${SKILLS[e.action].label.slice(2).trim()} — ${r ? r[2] : e.result}`);
  }
  L.push(``);
  L.push(coach(s, p.role));
  L.push(`— Generated by Soai`);
  return L.join("\n");
}
function reportLine(sk, s) {
  switch (sk) {
    case "hit":       return `⚡ Hitting — ${s.hit.n} attempts, ${s.hit.kills} kills, ${s.hit.err} errors, hit rate ${s.hit.killPct}% (eff ${s.hit.eff.toFixed(2)})`;
    case "serve":     return `🎯 Serving — ${s.serve.n} serves, ${s.serve.aces} aces, ${s.serve.err} errors, ace rate ${s.serve.acePct}%`;
    case "receive":   return `🛡 Receiving — ${s.receive.n} receptions, passing avg ${s.receive.avg.toFixed(2)}/3, ${s.receive.goodPct}% good`;
    case "dig":       return `🤿 Digging — ${s.dig.made}/${s.dig.n} potential digs reached (${s.dig.pct}%), ${s.dig.clean} clean, ${s.dig.missed} missed in range`;
    case "set":       return `🙌 Setting — ${s.set.n} sets, ${s.set.assists} assists`;
    case "setteable": return `✋ Setteable balls — ${s.setteable.conv}/${s.setteable.n} handled (${s.setteable.pct}%)`;
    case "block":     return `🧱 Blocking — ${s.block.n} blocks, ${s.block.stuffs} stuffs, ${s.block.touch} touches`;
    default: return "";
  }
}
function coach(s, role) {
  const tips = [];
  if (role === "Libero" || role === "Outside") { if (s.receive.n >= 3) tips.push(s.receive.avg >= 2.2 ? "Passing is on point." : "Raise your passing average with a steadier platform."); if (s.dig.n >= 3) tips.push(s.dig.pct >= 60 ? "Great defensive range." : "Get to more of those balls in range."); }
  if (role === "Setter") { if (s.setteable.n >= 3) tips.push(s.setteable.pct >= 80 ? "You convert almost every setteable ball." : "Chase down more setteable balls."); if (s.set.n >= 3) tips.push("Keep feeding your hitters."); }
  if (["Outside", "Opposite", "Middle"].includes(role) && s.hit.n >= 3) tips.push(s.hit.killPct >= 40 ? "Great finishing on your swings." : "Work on shot placement to lift your kill rate.");
  if (["Middle", "Opposite"].includes(role) && s.block.n >= 2) tips.push(s.block.stuffs ? "Blocks are turning into points." : "Time your blocks to turn touches into stuffs.");
  if (s.serve.n >= 3) tips.push(s.serve.err > s.serve.aces ? "Cut down serve errors." : "Serving is a weapon.");
  return "Coach's note: " + (tips.length ? tips.join(" ") : "Log a few more touches for a fuller report.");
}

function emailReport() {
  const p = profile();
  if (!p.email) { setHint("⚠️ Enter your email above so the report can be sent to you."); document.getElementById("pEmail").focus(); return; }
  saveProfile();
  const report = buildReport();
  const cfg = load(EMAILJS_KEY, {});
  if (cfg.service && cfg.template && cfg.pubkey) { sendViaEmailJS(cfg, p, report); return; }
  const subject = `My Soai volleyball report — ${p.name} (${p.role})`;
  const url = `mailto:${encodeURIComponent(p.email).replace(/%40/g, "@")}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(report)}`;
  window.location.href = url;
  setHint("📧 Opening your email app with the report pre-filled — press Send. (Turn on auto-send in Setup below to skip this.)");
}
function sendViaEmailJS(cfg, p, report) {
  const run = () => {
    setHint("Sending your report…");
    window.emailjs.send(cfg.service, cfg.template, { to_email: p.email, to_name: p.name, report }, cfg.pubkey)
      .then(() => setHint("✅ Report emailed to " + p.email))
      .catch(err => { setHint("⚠️ Auto-send failed — opening your email app instead."); const url = `mailto:${encodeURIComponent(p.email).replace(/%40/g, "@")}?subject=${encodeURIComponent("My Soai report")}&body=${encodeURIComponent(report)}`; window.location.href = url; });
  };
  if (window.emailjs) run();
  else { const s = document.createElement("script"); s.src = "https://cdn.jsdelivr.net/npm/@emailjs/browser@4/dist/email.min.js"; s.onload = run; s.onerror = () => setHint("⚠️ Couldn't load the email service. Use the pre-filled email instead."); document.head.appendChild(s); }
}
function saveEmailJS() {
  const cfg = { service: v("ejService"), template: v("ejTemplate"), pubkey: v("ejKey") };
  localStorage.setItem(EMAILJS_KEY, JSON.stringify(cfg));
  setHint(cfg.service && cfg.template && cfg.pubkey ? "✅ Auto-send is ON." : "Auto-send off — using pre-filled email.");
}

/* ============================================================
   Helpers
   ============================================================ */
function v(id) { return document.getElementById(id).value.trim(); }
function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }
function setHint(t) { document.getElementById("hint").textContent = t; }
function fmtTime(s) { s = Math.max(0, Math.round(s || 0)); return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0"); }
function escapeHtml(s) { return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }

/* ============================================================
   Init
   ============================================================ */
function init() {
  const prof = load(PROFILE_KEY, {});
  if (prof.name) document.getElementById("pName").value = prof.name;
  if (prof.email) document.getElementById("pEmail").value = prof.email;
  if (prof.role) document.getElementById("pRole").value = prof.role;
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
  document.getElementById("pRole").addEventListener("change", () => { saveProfile(); buildSkillButtons(); render(); });
  document.getElementById("emailBtn").addEventListener("click", emailReport);
  document.getElementById("saveEjBtn").addEventListener("click", saveEmailJS);
  document.getElementById("readAnnBtn").addEventListener("click", readAnnouncement);
  document.querySelectorAll("[data-annhit]").forEach(b => b.addEventListener("click", () => logAnnouncedHit(b.dataset.annhit)));
  document.getElementById("speed").addEventListener("change", e => { if (player) player.rate(parseFloat(e.target.value)); });
  document.getElementById("clearBtn").addEventListener("click", () => {
    if (confirm("Clear all touches for " + profile().name + "?")) { events = events.filter(e => e.player !== profile().name); saveEvents(); render(); }
  });

  render();
  setHint("Enter your name, email & role, upload your clip, then tap a button for each touch.");

  // auto-load a YouTube link handed over from the front-page search (?yt=...)
  const yt = new URLSearchParams(location.search).get("yt");
  if (yt) { document.getElementById("ytUrl").value = yt; loadYouTube(yt); }
}
document.addEventListener("DOMContentLoaded", init);
