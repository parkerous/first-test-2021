/* ============================================================
   Soai Film Room — tag spikes off a video (YouTube or your own
   recording) and map them onto the court, adjusting for the camera
   angle you recorded from (perspective calibration / homography).

   Tagged spikes are saved to the SAME store as the Soai dashboard
   (localStorage "volle_spikes_v1"), so all your stats & heat maps
   include them automatically.
   ============================================================ */

/* ---------- shared court geometry (matches voll-e.js) ---------- */
const CW = 300, CH = 600, NET = 300;
const STORE_KEY = "volle_spikes_v1";
const CALIB_KEY = "volle_calibrations_v1";

/* ---------- state ---------- */
let calibrations = loadCalibs();     // { name: {src:[4 pts normalized], H:[9]} }
let activeCalib = Object.keys(calibrations)[0] || null;
let calibrating = false;             // true while collecting the 4 corners
let calibPoints = [];                // corners clicked so far (normalized)
let pending = null;                  // spike origin waiting for a landing click
let currentResult = "kill";
let player = null;                   // playback abstraction (YouTube or <video>)
let videoLabel = "";

const CORNER_LABELS = ["Far side – LEFT corner", "Far side – RIGHT corner", "Near side – RIGHT corner", "Near side – LEFT corner"];
const CORNER_DST = [{ x: 0, y: 0 }, { x: CW, y: 0 }, { x: CW, y: CH }, { x: 0, y: CH }];

/* ============================================================
   Perspective math (validated separately)
   ============================================================ */
function solveLinear(A, b) {
  const n = b.length, M = A.map((r, i) => [...r, b[i]]);
  for (let c = 0; c < n; c++) {
    let piv = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[piv][c])) piv = r;
    [M[c], M[piv]] = [M[piv], M[c]];
    const d = M[c][c];
    if (Math.abs(d) < 1e-12) return null;
    for (let j = c; j <= n; j++) M[c][j] /= d;
    for (let r = 0; r < n; r++) if (r !== c) { const f = M[r][c]; for (let j = c; j <= n; j++) M[r][j] -= f * M[c][j]; }
  }
  return M.map(r => r[n]);
}
function computeHomography(src, dst) {
  const A = [], b = [];
  for (let i = 0; i < 4; i++) {
    const { x, y } = src[i], { x: u, y: v } = dst[i];
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]); b.push(u);
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y]); b.push(v);
  }
  const h = solveLinear(A, b);
  return h ? [h[0], h[1], h[2], h[3], h[4], h[5], h[6], h[7], 1] : null;
}
function applyH(H, x, y) {
  const w = H[6] * x + H[7] * y + H[8];
  return { x: (H[0] * x + H[1] * y + H[2]) / w, y: (H[3] * x + H[4] * y + H[5]) / w };
}

/* ---------- volleyball zone / direction (matches voll-e.js) ---------- */
function col(x) { return x < 100 ? "L" : x < 200 ? "C" : "R"; }
function yourZone(x, y) {
  const c = col(x), front = y < 400;
  return ({ L: front ? 4 : 5, C: front ? 3 : 6, R: front ? 2 : 1 })[c];
}
function direction(x, y, tx, ty) {
  if (ty > 250) return "tip";
  return col(x) === col(tx) ? "line" : "cross";
}

/* ============================================================
   Storage
   ============================================================ */
function loadCalibs() { try { return JSON.parse(localStorage.getItem(CALIB_KEY)) || {}; } catch { return {}; } }
function saveCalibs() { localStorage.setItem(CALIB_KEY, JSON.stringify(calibrations)); }
function loadSpikes() { try { return JSON.parse(localStorage.getItem(STORE_KEY)) || []; } catch { return []; } }
function saveSpikes(arr) { localStorage.setItem(STORE_KEY, JSON.stringify(arr)); }

function playerName() { return (document.getElementById("playerName").value.trim()) || "Me"; }

/* ============================================================
   Video loading — YouTube link OR local file, same interface:
     player.play() / pause() / seek(t) / time() / rate(r) / duration()
   ============================================================ */
function parseYouTubeId(url) {
  const m = String(url).match(/(?:youtu\.be\/|v=|embed\/|shorts\/)([\w-]{11})/);
  return m ? m[1] : (/^[\w-]{11}$/.test(url) ? url : null);
}

function loadYouTube(url) {
  const id = parseYouTubeId(url);
  if (!id) { setHint("⚠️ That doesn't look like a YouTube link."); return; }
  videoLabel = "YouTube:" + id;
  const stage = document.getElementById("stage");
  stage.innerHTML = `<div id="ytplayer"></div><div id="overlay"></div>`;
  const make = () => {
    const yt = new YT.Player("ytplayer", {
      videoId: id, playerVars: { controls: 0, modestbranding: 1, rel: 0 },
      events: { onReady: () => { player = ytApi(yt); wireOverlay(); setHint("Video loaded. Calibrate the court, then start tagging spikes."); } },
    });
  };
  if (window.YT && window.YT.Player) make();
  else { window.onYouTubeIframeAPIReady = make; loadYTScript(); }
}
function loadYTScript() {
  if (document.getElementById("yt-api")) return;
  const s = document.createElement("script");
  s.id = "yt-api"; s.src = "https://www.youtube.com/iframe_api";
  document.head.appendChild(s);
}
function ytApi(yt) {
  return {
    play: () => yt.playVideo(), pause: () => yt.pauseVideo(),
    seek: t => yt.seekTo(Math.max(0, t), true), time: () => yt.getCurrentTime() || 0,
    rate: r => yt.setPlaybackRate(r), duration: () => yt.getDuration() || 0,
  };
}

function loadLocalFile(file) {
  if (!file) return;
  videoLabel = "file:" + file.name;
  const stage = document.getElementById("stage");
  stage.innerHTML = `<video id="localvid" playsinline></video><div id="overlay"></div>`;
  const v = document.getElementById("localvid");
  v.src = URL.createObjectURL(file);
  v.addEventListener("loadedmetadata", () => {
    player = {
      play: () => v.play(), pause: () => v.pause(),
      seek: t => { v.currentTime = Math.max(0, t); }, time: () => v.currentTime || 0,
      rate: r => { v.playbackRate = r; }, duration: () => v.duration || 0,
    };
    wireOverlay();
    setHint("Recording loaded. Calibrate the court corners, then tag spikes.");
  });
}

/* ============================================================
   Overlay — captures clicks over the video (normalized 0..1)
   ============================================================ */
function wireOverlay() {
  const ov = document.getElementById("overlay");
  ov.addEventListener("click", onOverlayClick);
  drawOverlay();
}
function overlayNorm(evt) {
  const ov = document.getElementById("overlay");
  const r = ov.getBoundingClientRect();
  return { x: (evt.clientX - r.left) / r.width, y: (evt.clientY - r.top) / r.height };
}

function onOverlayClick(evt) {
  const p = overlayNorm(evt);
  if (calibrating) { addCalibPoint(p); return; }
  if (!activeCalib) { setHint("⚠️ Calibrate the court first (press “Set court corners”)."); return; }
  const H = calibrations[activeCalib].H;
  const court = applyH(H, p.x, p.y);

  if (!pending) {
    pending = { norm: p, court };
    setHint("Now click where the ball LANDED.");
  } else {
    saveTaggedSpike(pending.court, court, pending.norm, p);
    pending = null;
    setHint("✅ Spike tagged! It's now in your Soai stats. Seek to the next rally and tag again.");
  }
  drawOverlay();
  drawMiniCourt();
}

function saveTaggedSpike(origin, landing, oNorm, lNorm) {
  const ox = clamp(origin.x, 0, CW), oy = clamp(origin.y, 0, CH);
  const tx = clamp(landing.x, 0, CW), ty = clamp(landing.y, 0, CH);
  const spikes = loadSpikes();
  spikes.push({
    id: "film-" + videoLabel + "-" + Math.round(player.time() * 1000) + "-" + spikes.length,
    player: playerName(), x: ox, y: oy, tx, ty,
    zone: yourZone(ox, oy), dir: direction(ox, oy, tx, ty), result: currentResult,
    source: "film", video: videoLabel, t: +player.time().toFixed(2), calib: activeCalib,
  });
  saveSpikes(spikes);
  renderTagged();
}
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

/* ============================================================
   Calibration flow
   ============================================================ */
function startCalibration() {
  if (!player) { setHint("Load a video first."); return; }
  calibrating = true; calibPoints = []; pending = null;
  setHint(`Calibrating: click the ${CORNER_LABELS[0]}.`);
  drawOverlay();
}
function addCalibPoint(p) {
  calibPoints.push(p);
  if (calibPoints.length < 4) {
    setHint(`Calibrating: click the ${CORNER_LABELS[calibPoints.length]}.`);
    drawOverlay();
  } else {
    const H = computeHomography(calibPoints.slice(), CORNER_DST);
    if (!H) { setHint("⚠️ Those points are too close/straight. Try again."); calibPoints = []; drawOverlay(); return; }
    let name = (prompt("Name this camera angle (e.g. “My recording – side view”):", "Angle " + (Object.keys(calibrations).length + 1)) || "").trim();
    if (!name) name = "Angle " + (Object.keys(calibrations).length + 1);
    calibrations[name] = { src: calibPoints.slice(), H };
    activeCalib = name;
    saveCalibs();
    calibrating = false; calibPoints = [];
    setHint(`✅ Calibrated “${name}”. Now tag spikes — clicks map to the court for THIS camera angle.`);
    refreshCalibList();
    drawOverlay(); drawMiniCourt();
  }
}

function refreshCalibList() {
  const sel = document.getElementById("calibSelect");
  const names = Object.keys(calibrations);
  sel.innerHTML = names.length
    ? names.map(n => `<option value="${escapeHtml(n)}" ${n === activeCalib ? "selected" : ""}>${escapeHtml(n)}</option>`).join("")
    : `<option value="">— none yet —</option>`;
}

/* ============================================================
   Drawing: overlay markers + mini top-down court preview
   ============================================================ */
function drawOverlay() {
  const ov = document.getElementById("overlay");
  if (!ov) return;
  let svg = `<svg viewBox="0 0 100 100" preserveAspectRatio="none" style="position:absolute;inset:0;width:100%;height:100%;pointer-events:none">`;
  // calibration corners being placed
  calibPoints.forEach((p, i) => {
    svg += `<circle cx="${p.x * 100}" cy="${p.y * 100}" r="1.6" fill="#2563eb"/><text x="${p.x * 100 + 2}" y="${p.y * 100}" font-size="4" fill="#2563eb">${i + 1}</text>`;
  });
  if (calibPoints.length > 1) {
    svg += `<polyline points="${calibPoints.map(p => `${p.x * 100},${p.y * 100}`).join(" ")}" fill="none" stroke="#2563eb" stroke-width="0.5" stroke-dasharray="2 1"/>`;
  }
  // saved calibration outline (faint)
  if (!calibrating && activeCalib && calibrations[activeCalib]) {
    const s = calibrations[activeCalib].src;
    svg += `<polygon points="${s.map(p => `${p.x * 100},${p.y * 100}`).join(" ")}" fill="rgba(37,99,235,0.08)" stroke="#2563eb" stroke-width="0.4"/>`;
  }
  // pending spike origin
  if (pending) svg += `<circle cx="${pending.norm.x * 100}" cy="${pending.norm.y * 100}" r="1.8" fill="none" stroke="#16a34a" stroke-width="0.8"/>`;
  svg += `</svg>`;
  ov.innerHTML = svg;
}

function drawMiniCourt() {
  const el = document.getElementById("mini");
  if (!el) return;
  const spikes = loadSpikes().filter(s => s.source === "film" && s.video === videoLabel);
  const color = { kill: "#16a34a", error: "#dc2626", inplay: "#eab308" };
  let h = "";
  h += `<rect x="0" y="0" width="${CW}" height="${CH}" fill="#e9b872"/><rect x="0" y="0" width="${CW}" height="${NET}" fill="#d9a55f"/>`;
  h += `<line x1="0" y1="${NET}" x2="${CW}" y2="${NET}" stroke="#1f2a44" stroke-width="4"/>`;
  h += `<rect x="3" y="3" width="${CW - 6}" height="${CH - 6}" fill="none" stroke="#fff" stroke-width="2"/>`;
  h += `<text x="6" y="18" font-size="13" fill="#5a3d16">OPPONENT</text><text x="6" y="${CH - 8}" font-size="13" fill="#5a3d16">YOUR SIDE</text>`;
  for (const s of spikes) {
    h += `<line x1="${s.x}" y1="${s.y}" x2="${s.tx}" y2="${s.ty}" stroke="${color[s.result]}" stroke-width="1" opacity="0.35"/>`;
    h += `<circle cx="${s.x}" cy="${s.y}" r="4" fill="${color[s.result]}" stroke="#fff"/>`;
    h += `<circle cx="${s.tx}" cy="${s.ty}" r="4" fill="none" stroke="${color[s.result]}" stroke-width="2"/>`;
  }
  if (pending) h += `<circle cx="${pending.court.x}" cy="${pending.court.y}" r="6" fill="none" stroke="#2563eb" stroke-width="2"/>`;
  el.innerHTML = h;
}

function renderTagged() {
  const spikes = loadSpikes().filter(s => s.source === "film" && s.video === videoLabel);
  document.getElementById("tagCount").textContent = spikes.length;
  const tb = document.getElementById("tagBody");
  if (!spikes.length) { tb.innerHTML = `<tr><td colspan="5" class="empty">No spikes tagged from this video yet.</td></tr>`; return; }
  const zoneName = { 1: "1 back-R", 2: "2 front-R", 3: "3 front-M", 4: "4 front-L", 5: "5 back-L", 6: "6 back-M" };
  tb.innerHTML = spikes.slice().reverse().map(s => `
    <tr>
      <td>${fmtTime(s.t)}</td>
      <td>${escapeHtml(s.player)}</td>
      <td>${zoneName[s.zone]} · ${cap(s.dir)}</td>
      <td><span class="pill ${s.result}">${cap(s.result)}</span></td>
      <td><button class="del" style="color:var(--accent2)" onclick="jumpTo(${s.t})" title="Jump to this moment">⏱</button>
          <button class="del" onclick="removeSpike('${s.id}')" title="Delete">×</button></td>
    </tr>`).join("");
  drawMiniCourt();
}
function removeSpike(id) { saveSpikes(loadSpikes().filter(s => s.id !== id)); renderTagged(); drawMiniCourt(); }
function jumpTo(t) { if (player) { player.seek(t); setHint("Jumped to " + fmtTime(t)); } }

/* ---------- helpers ---------- */
function setHint(t) { document.getElementById("hint").textContent = t; }
function fmtTime(s) { s = Math.max(0, Math.round(s || 0)); return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0"); }
function cap(s) { return s ? s[0].toUpperCase() + s.slice(1) : s; }
function escapeHtml(s) { return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }

/* ============================================================
   Wire up controls
   ============================================================ */
function init() {
  refreshCalibList();
  document.getElementById("loadYt").addEventListener("click", () => loadYouTube(document.getElementById("ytUrl").value));
  document.getElementById("localFile").addEventListener("change", e => loadLocalFile(e.target.files[0]));

  document.querySelectorAll(".res-chip").forEach(chip => chip.addEventListener("click", () => {
    currentResult = chip.dataset.result;
    document.querySelectorAll(".res-chip").forEach(c => c.classList.toggle("on", c === chip));
  }));

  document.getElementById("calibBtn").addEventListener("click", startCalibration);
  document.getElementById("calibSelect").addEventListener("change", e => { activeCalib = e.target.value || null; setHint("Now tagging with calibration “" + activeCalib + "”."); drawOverlay(); });
  document.getElementById("delCalibBtn").addEventListener("click", () => {
    if (activeCalib && confirm("Delete calibration “" + activeCalib + "”?")) {
      delete calibrations[activeCalib]; saveCalibs();
      activeCalib = Object.keys(calibrations)[0] || null; refreshCalibList(); drawOverlay();
    }
  });

  // playback controls
  const ctl = (id, fn) => document.getElementById(id).addEventListener("click", () => { if (player) fn(); });
  ctl("playBtn", () => player.play());
  ctl("pauseBtn", () => player.pause());
  ctl("back5", () => player.seek(player.time() - 5));
  ctl("fwd5", () => player.seek(player.time() + 5));
  document.getElementById("speed").addEventListener("change", e => { if (player) player.rate(parseFloat(e.target.value)); });

  renderTagged();
  setHint("Load a YouTube link or your own recording to begin.");
}
document.addEventListener("DOMContentLoaded", init);
