// Online co-op: two players share one career. The HOST's browser runs the career and the matches;
// the GUEST opens the invite link, sees a live mirror of the hub and the court, and controls their own
// player (P2) — every serve, set call, spike, block and dig of P2 is asked on the guest's screen.
// Transports: PeerJS (WebRTC, works across the internet while both are online) and BroadcastChannel
// (two tabs/windows on the same computer). The host listens on both; the first one to connect wins.
(function (VB) {
  "use strict";
  var U = VB.ui, $ = U.$, esc = U.esc;
  var PEER_SRC = ["https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js", "https://cdnjs.cloudflare.com/ajax/libs/peerjs/1.5.4/peerjs.min.js"];
  var PREFIX = "vnlvolley-coop-";

  var role = null, code = null, link = null, connected = false, opts = {}, peer = null, bc = null;
  var pend = {}, seq = 0, statusTxt = "", onStatus = null, streamT = 0, obs = [];
  var mode = "shared";                                            // "shared": one career, two players • "sb": side by side, each their own career
  var guestReady = false, waitBox = null;

  // ---------- transports ----------
  function loadPeer() {
    if (window.Peer) return Promise.resolve(true);
    return new Promise(function (res) {
      var i = 0;
      (function next() {
        if (i >= PEER_SRC.length) return res(false);
        var sc = document.createElement("script"); sc.src = PEER_SRC[i++]; sc.async = true;
        sc.onload = function () { res(!!window.Peer); }; sc.onerror = function () { sc.remove(); next(); };
        document.head.appendChild(sc);
      })();
    });
  }
  function setStatus(t) { statusTxt = t; if (onStatus) onStatus(t); var el = $("coopStatus"); if (el) el.textContent = t; }
  // heartbeat: a closed tab or a dropped network sends no goodbye, so silence for 12 s counts as a drop
  var lastRx = 0, hbT = 0;
  function heartbeat() {
    lastRx = Date.now(); clearInterval(hbT);
    hbT = setInterval(function () { if (!connected) return clearInterval(hbT); send({ t: "__hb" }); if (Date.now() - lastRx > 12000) lost(); }, 2000);
  }
  function attach(l, how) {
    if (link) return false;                                       // already paired on the other transport
    link = l; connected = true; heartbeat();
    setStatus("🟢 CONNECTED (" + how + ")");
    chatUI(); chat.el.classList.remove("hidden");
    if (mode === "sb") { if (role === "guest") send({ t: "hi" }); sbConnected(); return true; }
    if (role === "host") { startMirror(); if (opts.onConnect) opts.onConnect(); }
    else send({ t: "hi" });
    return true;
  }
  // dropped out? the guest keeps knocking until the host answers again (the host never stops listening)
  var dialFn = null, rejoinT = 0;
  function autoRejoin() {
    clearInterval(rejoinT);
    rejoinT = setInterval(function () {
      if (connected || !role) return clearInterval(rejoinT);
      if (role !== "guest") return;
      try { bc && bc.postMessage({ t: "__hello", to: "host" }); } catch (e) {}
      if (dialFn) dialFn();
    }, 3000);
  }
  function savedCode(kind) { try { var c = localStorage.getItem("retroVB.coopCode." + kind); if (c) return c; c = newCode(); localStorage.setItem("retroVB.coopCode." + kind, c); return c; } catch (e) { return newCode(); } }
  function lost() {
    if (!connected) return;
    connected = false; link = null; autoRejoin();
    Object.keys(pend).forEach(function (id) { var p = pend[id]; clearTimeout(p.to); delete pend[id]; p.res(p.def); });
    stopMirror(); guestReady = false; if (waitBox) waitBox.done(true);
    if (mode === "sb") { setStatus("🟠 YOUR FRIEND DROPPED OUT — reconnecting automatically; keep playing, they'll catch up"); sbLost(); return; }
    setStatus(role === "host" ? "🟠 P2 DISCONNECTED — their player plays as AI; they can rejoin with the same link any time" : "🟠 DISCONNECTED — reconnecting to the host…");
    if (role === "guest") guestLost();
    if (role === "host" && opts.onLost) opts.onLost();
  }
  function send(m) { if (!link) return; try { link.send(m); } catch (e) { console.warn("coop send", e); } }

  function listenLocal() {
    try { bc = new BroadcastChannel(PREFIX + code); } catch (e) { bc = null; return; }
    bc.onmessage = function (ev) {
      var m = ev.data || {};
      if (m.to && m.to !== role) return;
      if (m.t === "__hello" && role === "host") {
        if (link) { if (Date.now() - lastRx < 3000) return; lost(); }   // your friend is back in a fresh tab: drop the stale link
        bc.postMessage({ t: "__ack", to: "guest" }); attach(localLink(), "same computer"); return;
      }
      if (m.t === "__ack" && role === "guest" && !link) { attach(localLink(), "same computer"); return; }
      if (m.t === "__bye") { if (link && link.local) lost(); return; }
      if (link && link.local) onMsg(m.m);
    };
  }
  function localLink() { return { local: true, send: function (m) { bc.postMessage({ to: role === "host" ? "guest" : "host", m: m }); }, close: function () { try { bc.postMessage({ t: "__bye" }); } catch (e) {} } }; }
  function peerLink(conn) { return { send: function (m) { conn.send(m); }, close: function () { try { conn.close(); } catch (e) {} } }; }

  async function listenPeer() {
    if (!(await loadPeer())) { setStatus(statusTxt + " • online link unavailable (couldn't load PeerJS)"); return; }
    try {
      peer = role === "host" ? new window.Peer(PREFIX + code) : new window.Peer();
      peer.on("error", function (e) {
        console.warn("peer", e);
        if (e && e.type === "unavailable-id" && role === "host") { try { peer.destroy(); } catch (x) {} setTimeout(listenPeer, 4000); return; }   // our old session still holds the code: try again
        if (!connected) setStatus("⚠️ ONLINE LINK ERROR: " + (e.type || e.message || e) + (role === "guest" ? " — retrying…" : ""));
      });
      peer.on("disconnected", function () { try { if (!peer.destroyed) peer.reconnect(); } catch (x) {} });
      if (role === "host") {
        peer.on("connection", function (conn) {
          conn.on("open", function () { if (link) lost(); if (!attach(peerLink(conn), "online")) { conn.close(); return; } });   // a reconnect replaces the stale link
          conn.on("data", function (m) { if (link && !link.local) onMsg(m); });
          conn.on("close", function () { if (link && !link.local) lost(); });
        });
      } else {
        dialFn = function () {
          if (connected || !peer || peer.destroyed) return;
          try {
            var conn = peer.connect(PREFIX + code, { reliable: true });
            conn.on("open", function () { attach(peerLink(conn), "online"); });
            conn.on("data", function (m) { if (link && !link.local) onMsg(m); });
            conn.on("close", function () { if (link && !link.local) lost(); });
          } catch (x) {}
        };
        peer.on("open", dialFn);
      }
    } catch (e) { console.warn(e); }
  }

  // ---------- messages ----------
  function onMsg(m) {
    if (!m || !m.t) return;
    lastRx = Date.now(); if (m.t === "__hb") return;
    if (mode === "sb") {                                              // a linked friendly: either of you can be the one running the match
      if (m.t === "ask") { answer(m); return; }
      if (m.t === "ans") { var pa = pend[m.id]; if (pa) { clearTimeout(pa.to); delete pend[m.id]; pa.res(m.v); } return; }
      if (m.t === "cancel") { if (gState.pendingAsk === m.id) clearAsk(); return; }
    }
    if (m.t === "chat") { chatAdd(m.who || "FRIEND", String(m.txt || "").slice(0, 120)); return; }
    if (m.t.indexOf("sb-") === 0) return sbMsg(m);
    if (role === "host") return hostMsg(m);
    return guestMsg(m);
  }
  // ask P2 something; resolves with their answer, or a default if they don't answer in time / drop out
  function ask(kind, payload, def) {
    if (!connected) return Promise.resolve(def);
    var id = ++seq, ms = kind === "timing" ? payload.speedMs * 3 + 4000 : 30000;
    return new Promise(function (res) {
      pend[id] = { res: res, def: def, to: setTimeout(function () { delete pend[id]; send({ t: "cancel", id: id }); res(def); }, ms) };
      send({ t: "ask", id: id, k: kind, p: payload });
    });
  }

  // ================== HOST ==================
  function newCode() { var c = "", A = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; for (var i = 0; i < 6; i++) c += A[Math.floor(Math.random() * A.length)]; return c; }
  function inviteURL() { return location.origin + location.pathname + "?coop=" + code; }
  function startHost(o) {
    opts = o || {};                                               // the mode you're in now (career or story) takes over the link
    if (role === "host") { if (connected) send({ t: "welcome", re: true, host: opts.hostName ? opts.hostName() : "HOST", info: opts.info ? opts.info() : {} }); return; }
    role = "host"; code = savedCode("shared");
    setStatus("🟡 WAITING FOR YOUR FRIEND…");
    listenLocal(); listenPeer();
  }
  function hostMsg(m) {
    if (m.t === "hi" && mode === "sb") { send({ t: "welcome", mode: "sb", host: sb.me ? sb.me.name : "HOST" }); sbPush(true); return; }
    if (m.t === "agree") { guestReady = true; if (waitBox) waitBox.done(true); return; }
    if (m.t === "hi") { send({ t: "welcome", host: opts.hostName ? opts.hostName() : "HOST", info: opts.info ? opts.info() : {} }); pushHub(true); pushModal(); return; }
    if (m.t === "join") { var r = opts.onJoin ? opts.onJoin(m) : { ok: false, msg: "The host isn't in a career." }; send({ t: "joined", ok: r.ok, msg: r.msg }); pushHub(true); return; }
    if (m.t === "ans") { var p = pend[m.id]; if (p) { clearTimeout(p.to); delete pend[m.id]; p.res(m.v); } return; }
    if (m.t === "focus" && opts.onFocus) { opts.onFocus(m.a); return; }
    if (m.t === "p2act") { p2Act(m); return; }
    if (m.t === "bye") { lost(); }
  }
  // mirror the hub and the host's dialogs, and stream the court while a match runs
  var hubT = 0, lastHub = "";
  function pushHub(force) {
    clearTimeout(hubT);
    hubT = setTimeout(function () {
      var h = $("hub").innerHTML;
      if (!force && h === lastHub) return;
      lastHub = h; send({ t: "hub", html: h, p2: p2Sheet() });
    }, force ? 0 : 250);
  }
  function pushModal() {
    var open = !$("modal").classList.contains("hidden");
    send({ t: "modal", open: open, title: open ? $("modalTitle").textContent : "", body: open ? $("modalBody").innerHTML : "" });
  }
  var lastView = "";
  function startMirror() {
    var mo1 = new MutationObserver(function () { pushHub(false); });
    mo1.observe($("hub"), { childList: true, subtree: true, characterData: true, attributes: true });
    var mt = 0, mo2 = new MutationObserver(function () { clearTimeout(mt); mt = setTimeout(pushModal, 120); });
    mo2.observe($("modal"), { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ["class"] });
    var mo3 = new MutationObserver(function (ms) {
      ms.forEach(function (x) { x.addedNodes.forEach(function (n) { if (n.nodeType === 1) send({ t: "feed", html: n.outerHTML }); }); });
    });
    mo3.observe($("feed"), { childList: true });
    obs = [mo1, mo2, mo3];
    // matches: no video — the guest's own engine draws the match from the game state (~20 small updates a second)
    VB.Engine.onStart = function () {
      if (role !== "host" || !connected || mode !== "shared") return;
      VB.Engine.stream(true); streaming = true;
      send({ t: "mstart", init: VB.Engine.matchInit() });
    };
    streamT = setInterval(function () {
      var inMatch = !$("matchView").classList.contains("hidden");
      if (!inMatch && streaming) { streaming = false; VB.Engine.stream(false); send({ t: "view", v: "hub" }); pushHub(true); }
      if (!inMatch || !streaming) return;
      send({ t: "snap", s: VB.Engine.snapshot(), msg: $("msg").textContent, rec: $("recordLine").textContent });
    }, 50);
  }
  var streaming = false;
  function stopMirror() { obs.forEach(function (o) { o.disconnect(); }); obs = []; clearInterval(streamT); lastView = ""; if (streaming) { streaming = false; VB.Engine.stream(false); } }

  // ---------- P2's own progression (host side): skill points, PlayStyles, a daily training session ----------
  function p2Sheet() {
    var p = opts.mate && opts.mate(); if (!p) return null;
    var st = opts.mst();
    return { name: p.name, role: p.role, ovr: VB.ovr(p), attrs: VB.ATTRS.map(function (a) { return [a, p[a]]; }), ps: p.ps || {}, sp: st.sp || 0,
             trained: st.day === opts.day(), psList: VB.psFor(p.role), skill: p.skill ? (p.skillName || VB.SKILL_TXT[p.skill]) : null };
  }
  function spCost(v) { return v < 74 ? 1 : v < 82 ? 2 : 3; }
  function p2Act(m) {
    var p = opts.mate && opts.mate(); if (!p) return;
    var st = opts.mst(), txt = "";
    if (m.a === "train" && st.day !== opts.day() && VB.ATTRS.indexOf(m.attr) >= 0) {
      st.day = opts.day();
      var g = m.q >= 0.95 ? 2 : m.q >= 0.5 ? 1 : 0;
      if (g) p[m.attr] = Math.min(99, p[m.attr] + g);
      if (m.q >= 0.6) st.sp = (st.sp || 0) + 1;
      txt = p.name + " (P2) trains " + m.attr.toUpperCase() + (g ? " +" + g : "") + (m.q >= 0.6 ? " and earns a skill point" : "") + ".";
    } else if (m.a === "spend" && VB.ATTRS.indexOf(m.attr) >= 0) {
      var c = spCost(p[m.attr]);
      if ((st.sp || 0) >= c && p[m.attr] < 99) { st.sp -= c; p[m.attr]++; txt = p.name + " (P2) improves " + m.attr.toUpperCase() + " to " + p[m.attr] + "."; }
    } else if (m.a === "ps" && VB.PS[m.id] && VB.psFor(p.role).indexOf(m.id) >= 0) {
      var own = p.ps = p.ps || {}, lv = own[m.id] || 0, cost = lv ? 3 : 2;
      if (lv < 2 && (st.sp || 0) >= cost && (lv || Object.keys(own).length < 3)) { st.sp -= cost; own[m.id] = lv + 1; txt = p.name + " (P2) learns " + VB.PS[m.id].name + (own[m.id] > 1 ? "+" : "") + "."; }
    }
    if (txt && opts.news) opts.news("🤝 " + txt);
    if (opts.save) opts.save();
    if (opts.render) opts.render();
    send({ t: "p2", sheet: p2Sheet() }); pushHub(true);
  }

  // ---------- chat (both modes, both players) ----------
  var chat = { el: null, open: false, unread: 0, log: [] };
  var QUICK = ["NICE! 👍", "LET'S GO 🔥", "WAIT FOR ME ⏳", "READY ✅", "MY BAD 🙏", "GG 🤝"];
  function chatUI() {
    if (chat.el) return;
    var d = chat.el = document.createElement("div"); d.className = "coop-chat";
    d.innerHTML = "<button class='btn tiny coop-chat-btn' data-c='toggle'>💬 <span id='chatN'></span></button>" +
      "<div class='coop-chat-panel hidden'><div class='coop-chat-log' id='chatLog'></div>" +
      "<div class='coop-chat-quick'>" + QUICK.map(function (q) { return "<button class='btn tiny' data-c='q' data-v='" + esc(q) + "'>" + esc(q) + "</button>"; }).join("") + "</div>" +
      "<div class='coop-chat-in'><input id='chatIn' maxlength='120' placeholder='Say something…'/><button class='btn tiny' data-c='send'>SEND</button></div></div>";
    document.body.appendChild(d);
    d.onclick = function (e) {
      var b = e.target.closest("[data-c]"); if (!b) return;
      var k = b.getAttribute("data-c");
      if (k === "toggle") { chat.open = !chat.open; d.querySelector(".coop-chat-panel").classList.toggle("hidden", !chat.open); chat.unread = 0; chatBadge(); if (chat.open) $("chatIn").focus(); }
      if (k === "q") sayChat(b.getAttribute("data-v"));
      if (k === "send") { var i = $("chatIn"); if (i.value.trim()) sayChat(i.value.trim().slice(0, 120)); i.value = ""; }
    };
    d.addEventListener("keydown", function (e) { e.stopPropagation(); if (e.key === "Enter") { var i = $("chatIn"); if (i.value.trim()) sayChat(i.value.trim().slice(0, 120)); i.value = ""; } });
  }
  function chatBadge() { var n = $("chatN"); if (n) n.textContent = chat.unread ? chat.unread : ""; }
  function chatAdd(who, txt, mine) {
    chatUI(); chat.log.push({ who: who, txt: txt }); if (chat.log.length > 60) chat.log.shift();
    var l = $("chatLog"); if (l) { l.innerHTML = chat.log.map(function (m) { return "<div><b>" + esc(m.who) + ":</b> " + esc(m.txt) + "</div>"; }).join(""); l.scrollTop = l.scrollHeight; }
    if (!mine && !chat.open) { chat.unread++; chatBadge(); toast(who + ": " + txt); }
  }
  function sayChat(txt) { var me = myName(); send({ t: "chat", who: me, txt: txt }); chatAdd(me, txt, true); }
  function myName() { return role === "host" ? (mode === "sb" ? (sb.me ? sb.me.name : "HOST") : (opts.hostName ? opts.hostName() : "HOST")) : (mode === "sb" ? (sb.me ? sb.me.name : "FRIEND") : (gState.p2 ? gState.p2.name : jf.name)); }
  var toastT = 0;
  function toast(t) {
    var el = $("coopToast"); if (!el) { el = document.createElement("div"); el.id = "coopToast"; el.className = "coop-toast"; document.body.appendChild(el); }
    el.textContent = "💬 " + t; el.classList.add("show"); clearTimeout(toastT); toastT = setTimeout(function () { el.classList.remove("show"); }, 3500);
  }

  // the invite dialog (host)
  async function invite() {
    var url = inviteURL();
    var html = "<p>Send this link to your friend. When you're both online at the same time, they " + (mode === "sb" ? "link up with you while each of you plays <b>your own career</b>.</p>" : "join <b>your " + esc(opts.what || "career") + "</b> as a second player on your team and control their own player in every match.</p>") +
      "<p><input id='coopLink' class='text-in coop-link' readonly value='" + esc(url) + "'/></p>" +
      "<p class='center'><button class='btn' id='coopCopy'>📋 COPY LINK</button></p>" +
      "<p class='center big' id='coopStatus'>" + esc(statusTxt) + "</p>" +
      (mode === "sb" ? "<p class='center gain'>SIDE BY SIDE: each of you plays your own career; a new day starts when you're both ready.</p>" : "") +
      "<p class='muted'>Same computer? Open the link in a second tab or window. Online, it connects browser to browser (WebRTC through the free PeerJS service) — a few strict school/office networks block that. Your save stays on your device; your friend's player lives in it.</p>";
    var p = U.modal("🤝 CO-OP CAREER — INVITE A FRIEND", html, [{ label: "DONE", value: 1 }]);
    setTimeout(function () {
      var b = $("coopCopy"); if (!b) return;
      b.onclick = function () { var i = $("coopLink"); i.select(); try { navigator.clipboard.writeText(url); } catch (e) { document.execCommand("copy"); } b.textContent = "✔ COPIED"; };
    }, 50);
    return p;
  }

  // ================== GUEST ==================
  var gState = { joined: false, pendingAsk: null, aimHandler: null };
  function guestShell(inner) {
    $("hub").innerHTML = "<div class='coop-bar'><b>🤝 CO-OP</b> <span id='coopStatus'>" + esc(statusTxt) + "</span>" +
      (gState.joined ? "<button class='btn tiny' id='coopReady' data-coop='ready'>✅ READY FOR THE NEXT DAY</button>" : "") +
      "<button class='btn tiny pink' data-coop='leave'>LEAVE</button></div>" + inner;
  }
  function startGuest(c) {
    role = "guest"; code = c;
    U.showView("hub");
    $("hub").onclick = guestClick;
    setStatus("🟡 CONNECTING TO THE HOST…");
    guestShell("<h2 class='hub-h'>JOINING A CO-OP CAREER</h2><p class='center'>Code <b>" + esc(code) + "</b>. Your friend needs to be in their career with the invite open.</p>" +
      "<p class='center muted'>If nothing happens, ask them to check they're online — or open the link in the same browser as them.</p>");
    listenLocal();
    try { bc && bc.postMessage({ t: "__hello", to: "host" }); } catch (e) {}
    var helloT = setInterval(function () { if (link) return clearInterval(helloT); try { bc && bc.postMessage({ t: "__hello", to: "host" }); } catch (e) {} }, 1000);
    listenPeer();
    // the guest never runs a match itself: hide the host-only controls
    document.body.classList.add("coop-guest");
  }
  var FAM = [["S", "SETTER"], ["OH", "OUTSIDE"], ["MB", "MIDDLE"], ["OP", "OPPOSITE"], ["L", "LIBERO"]];
  var HAIRS = ["crop", "crew", "fringe", "spiky", "slick", "middle", "afro", "bun"], HC = ["#17120d", "#3a2416", "#6b4423", "#e8d27a", "#ff7a1a", "#d8d8d8"];
  var jf = { name: "P2", fam: "OH", hair: "crop", hc: "#17120d", skin: 0 };
  function joinForm(w) {
    var blocked = w.info && w.info.single ? w.info.single : [];
    var face = { skin: VB.SKINS[jf.skin], hair: jf.hc, style: jf.hair, mouth: true };
    guestShell("<h2 class='hub-h'>JOIN " + esc(w.host) + "'S " + esc((w.info && w.info.what || "career").toUpperCase()) + "</h2>" +
      "<p class='center'>" + esc(w.info && w.info.club ? "You'll play for " + w.info.club + " alongside " + w.host + "." : "") + "</p>" +
      (w.info && w.info.mate ? "<p class='center gain'>Your player is already on the team: " + esc(w.info.mate) + ". Rejoin to pick up where you left off.</p>" +
        "<div class='hub-actions'><button class='btn big' data-coop='rejoin'>REJOIN AS " + esc(w.info.mate) + "</button></div>" :
      "<div class='newcareer'><div class='center'><img class='pix big' src='" + VB.Engine.spriteURL(face, w.info && w.info.kit || "#1e63ff") + "' alt=''/></div>" +
        "<label>NAME <input id='coopName' class='text-in' maxlength='12' value='" + esc(jf.name) + "'/></label>" +
        "<div>POSITION</div><div class='focus'>" + FAM.map(function (f) {
          var no = blocked.indexOf(f[0]) >= 0;
          return "<button class='btn" + (jf.fam === f[0] ? " on" : "") + "' data-coop='fam' data-v='" + f[0] + "'" + (no ? " disabled title='Your friend already plays here'" : "") + ">" + f[1] + "</button>"; }).join("") + "</div>" +
        "<div>HAIR</div><div class='focus'>" + HAIRS.map(function (h) { return "<button class='btn" + (jf.hair === h ? " on" : "") + "' data-coop='hair' data-v='" + h + "'>" + (VB.HAIR_TXT[h] || h) + "</button>"; }).join("") + "</div>" +
        "<div class='focus'>" + HC.map(function (c) { return "<button class='btn" + (jf.hc === c ? " on" : "") + "' data-coop='hc' data-v='" + c + "' style='background:" + c + "'>&nbsp;</button>"; }).join("") +
          VB.SKINS.map(function (s, i) { return "<button class='btn" + (jf.skin === i ? " on" : "") + "' data-coop='skin' data-v='" + i + "' style='background:" + s + "'>&nbsp;</button>"; }).join("") + "</div>" +
      "</div><div class='hub-actions'><button class='btn big' data-coop='join'>JOIN THE TEAM</button></div>"));
    gState.welcome = w;
  }
  function mirrorShell() {
    if ($("coopMirror")) return;
    guestShell("<div class='coop-tools'><button class='btn' data-coop='panel'>👤 MY PLAYER (P2)</button><button class='btn' data-coop='train'>🏋️ TRAIN</button>" +
        "<button class='btn' data-coop='gacha'>🎴 MY GACHA</button><button class='btn' data-coop='chat'>💬 CHAT</button></div>" +
      "<div id='coopP2' class='coop-p2panel" + (gState.panel ? "" : " hidden") + "'></div>" +
      "<p class='center muted'>The host advances the calendar (you agree with ✅ READY). Meanwhile: train, spend your skill points, pull cards or chat. In matches you control your own player (P2).</p>" +
      "<div id='coopMirror' class='coop-mirror'></div><div id='coopModal' class='coop-modal hidden'></div>");
    drawP2();
  }
  var ATTR_N = { srv: "SERVE", rec: "RECEIVE", set: "SET", att: "ATTACK", blk: "BLOCK", def: "DEFENCE", men: "MENTAL", tec: "TECHNIQUE", spd: "SPEED" };
  function drawP2() {
    var el = $("coopP2"), p = gState.p2; if (!el) return;
    if (!p) { el.innerHTML = "<p class='muted'>Waiting for your player's sheet…</p>"; return; }
    el.innerHTML = "<div class='pname'>" + esc(p.name) + " • " + esc(VB.FAMILY_NAMES[p.role] || p.role) + " • OVR " + p.ovr + " • <span class='gain'>" + p.sp + " SKILL POINTS</span></div>" +
      (p.skill ? "<div class='muted'>★ " + esc(p.skill) + "</div>" : "") +
      "<div class='focus'>" + p.attrs.map(function (a) {
        var c = a[1] < 74 ? 1 : a[1] < 82 ? 2 : 3;
        return "<button class='btn tiny' data-coop='spend' data-v='" + a[0] + "'" + (p.sp < c || a[1] >= 99 ? " disabled" : "") + ">" + ATTR_N[a[0]] + " " + a[1] + " +1 (" + c + ")</button>"; }).join("") + "</div>" +
      "<div class='mini-tag'>PLAYSTYLES (" + Object.keys(p.ps).length + "/3) — unlock 2 SP • upgrade 3 SP</div><div class='focus'>" + p.psList.map(function (id) {
        var d = VB.PS[id], lv = p.ps[id] || 0, c = lv ? 3 : 2, off = lv >= 2 || p.sp < c || (!lv && Object.keys(p.ps).length >= 3);
        return "<button class='btn tiny" + (lv ? " on" : "") + "' data-coop='ps' data-v='" + id + "'" + (off ? " disabled" : "") + " title='" + esc(d.txt) + "'>" + d.icon + " " + d.name + (lv === 2 ? "+" : lv ? " → +" : "") + "</button>"; }).join("") + "</div>" +
      "<p class='muted small'>" + (p.trained ? "✅ Trained today." : "🏋️ One training session per day: a minigame that can raise an attribute and earn a skill point.") + " Every co-op match also earns 1 skill point.</p>";
  }
  async function guestTrain() {
    var p = gState.p2; if (!p) return;
    if (p.trained) { U.modal("TRAINING", "<p>You've already trained today — wait for the next day.</p>"); return; }
    var k = await U.modal("🏋️ TRAINING", "<p>What do you want to work on today?</p>", p.attrs.map(function (a) { return { label: ATTR_N[a[0]] + " " + a[1], value: a[0] }; }));
    var q = await VB.Mini.forAttr(k, "P2 TRAINING — " + ATTR_N[k], "Your own session while the host plays on.", (p.attrs.find(function (a) { return a[0] === k; }) || [0, 70])[1]);
    send({ t: "p2act", a: "train", attr: k, q: q });
  }
  async function guestGacha() {
    gState.away = true; $("hub").onclick = null;
    try { await VB.Gacha.start(); } finally {
      gState.away = false; $("hub").onclick = guestClick; $("hub").innerHTML = "";
      mirrorShell(); var mir = $("coopMirror"); if (mir && gState.lastHub) mir.innerHTML = gState.lastHub;
    }
  }
  function guestClick(e) {
    var b = e.target.closest("[data-coop]"); if (!b) return;
    var k = b.getAttribute("data-coop"), v = b.getAttribute("data-v");
    if (k === "leave") { leave(); return; }
    if (k === "ready") { send({ t: "agree" }); b.classList.add("on"); b.classList.remove("pulse"); b.textContent = "✔ READY — waiting for the host"; return; }
    if (k === "fam" || k === "hair" || k === "hc" || k === "skin") {
      var n = $("coopName"); if (n) jf.name = (n.value || "P2").toUpperCase().slice(0, 12);
      jf[k] = k === "skin" ? +v : v; return joinForm(gState.welcome);
    }
    if (k === "join") {
      var nm = $("coopName"); jf.name = ((nm && nm.value) || "P2").toUpperCase().slice(0, 12);
      send({ t: "join", name: jf.name, fam: jf.fam, face: { skin: VB.SKINS[jf.skin], hair: jf.hc, style: jf.hair, mouth: true } });
      return;
    }
    if (k === "rejoin") { send({ t: "join", rejoin: true }); return; }
    if (k === "panel") { gState.panel = !gState.panel; var pe = $("coopP2"); if (pe) pe.classList.toggle("hidden", !gState.panel); drawP2(); return; }
    if (k === "train") { guestTrain(); return; }
    if (k === "gacha") { guestGacha(); return; }
    if (k === "chat") { chatUI(); chat.el.querySelector("[data-c=toggle]").click(); return; }
    if (k === "spend") { send({ t: "p2act", a: "spend", attr: v }); return; }
    if (k === "ps") { send({ t: "p2act", a: "ps", id: v }); return; }
    if (k === "focus") { send({ t: "focus", a: v }); document.querySelectorAll("[data-coop=focus]").forEach(function (x) { x.classList.toggle("on", x === b); }); }
  }
  var court = null, cg = null, img = new Image();
  img.onload = function () { if (cg) cg.drawImage(img, 0, 0, 640, 900); };
  function guestMsg(m) {
    if (m.t === "welcome" && m.mode === "sb") { mode = "sb"; sbGuestStart(m); return; }
    if (m.t === "welcome") { if (m.re) gState.joined = false; if (!gState.joined) joinForm(m); return; }
    if (m.t === "agree?") { var rb = $("coopReady"); if (rb) { rb.classList.add("pulse"); rb.textContent = "✅ READY — " + (m.label || "NEXT DAY"); } return; }
    if (m.t === "agreed") { var rb2 = $("coopReady"); if (rb2) { rb2.classList.remove("pulse", "on"); rb2.textContent = "✅ READY FOR THE NEXT DAY"; } return; }
    if (m.t === "joined") {
      if (!m.ok) { U.modal("CAN'T JOIN", "<p>" + esc(m.msg || "") + "</p>"); return; }
      gState.joined = true; mirrorShell(); return;
    }
    if (!gState.joined) return;
    if (m.t === "p2") { gState.p2 = m.sheet; if (!gState.away) drawP2(); return; }
    if (m.t === "hub") {
      gState.lastHub = m.html; if (m.p2) gState.p2 = m.p2;
      if (gState.away) return;                                          // you're in your gacha: catch up when you're back
      mirrorShell(); var mir = $("coopMirror"); if (mir) mir.innerHTML = m.html; drawP2(); return;
    }
    if (m.t === "modal") {
      if (gState.away) return;
      var cm = $("coopModal"); if (!cm) return;
      cm.classList.toggle("hidden", !m.open);
      cm.innerHTML = m.open ? "<div class='coop-modal-t'>HOST: " + esc(m.title) + "</div><div class='coop-modal-b'>" + m.body + "</div><p class='center muted'>⏳ waiting for the host…</p>" : "";
      return;
    }
    if (m.t === "mstart") { U.showView("match"); $("feed").innerHTML = ""; VB.Engine.spectate(m.init); return; }
    if (m.t === "snap") {
      VB.Engine.applySnap(m.s);
      $("recordLine").textContent = m.rec || "";
      if (!gState.pendingAsk) $("msg").textContent = m.msg || "";
      return;
    }
    if (m.t === "view") { if (m.v === "hub") { VB.Engine.stopSpectate(); clearAsk(); U.showView("hub"); } return; }
    if (m.t === "frame") {
      img.src = m.d;
      var h = m.hud || {};
      ["sMe", "sOpp", "hudMe", "hudOpp", "serveMe", "serveOpp"].forEach(function (id) { if (h[id] != null) $(id).textContent = h[id]; });
      $("recordLine").textContent = h.rec || "";
      if (!gState.pendingAsk) $("msg").textContent = h.msg || "";
      return;
    }
    if (m.t === "feed") {
      var f = $("feed"), d = document.createElement("div"); d.innerHTML = m.html;
      if (d.firstChild) f.insertBefore(d.firstChild, f.firstChild);
      while (f.children.length > 40) f.removeChild(f.lastChild);
      return;
    }
    if (m.t === "ask") return answer(m);
    if (m.t === "cancel") { if (gState.pendingAsk === m.id) clearAsk(); return; }
  }
  function clearAsk() {
    gState.pendingAsk = null; $("actions").innerHTML = "";
    if (gState.aimHandler) { $("court").removeEventListener("click", gState.aimHandler); gState.aimHandler = null; $("court").classList.remove("aiming"); }
  }
  async function answer(m) {
    gState.pendingAsk = m.id;
    if (m.p && m.p.msg) $("msg").textContent = "🎮 YOUR CALL — " + m.p.msg;
    var v;
    if (m.k === "buttons") v = await U.buttons(m.p.list);
    else if (m.k === "timing") v = await VB.Engine.runTiming(m.p);
    else if (m.k === "aim") {
      $("msg").textContent = "🎯 YOUR AIM — click the court" + (m.p.msg ? " (" + m.p.msg + ")" : "");
      v = await VB.Engine.aimLocal(m.p.half);                        // aimed in YOUR camera, with the aim preview
    }
    if (gState.pendingAsk !== m.id) return;                         // the host gave up waiting
    gState.pendingAsk = null;
    send({ t: "ans", id: m.id, v: v });
  }
  function guestLost() {
    clearAsk(); U.showView("hub");
    $("hub").innerHTML = "<h2 class='hub-h'>CO-OP</h2><p class='center big'>🟠 Lost the host — reconnecting automatically…</p><p class='center'>Their career is saved on their device; you'll drop straight back in as soon as the link is back.</p>" +
      "<div class='hub-actions'><button class='btn' onclick='location.reload()'>RECONNECT</button><button class='btn pink' onclick='location.href=location.pathname'>MAIN MENU</button></div>";
  }
  function leave() {
    send({ t: "bye" }); if (link) link.close();
    if (mode === "sb") { lost(); return; }
    location.href = location.pathname;
  }

  // ================== "NEXT DAY?" — both players agree (shared mode) ==================
  // resolves true to go ahead (P2 is ready, P2 is gone, or you go on without them), false to wait
  function agree(label) {
    if (role !== "host" || !connected || mode !== "shared") return Promise.resolve(true);
    if (guestReady) { guestReady = false; send({ t: "agreed" }); return Promise.resolve(true); }
    send({ t: "agree?", label: label });
    return new Promise(function (res) {
      var d = document.createElement("div"); d.className = "coop-wait-box";
      d.innerHTML = "<div class='pname'>⏳ WAITING FOR P2</div><p>Both of you agree before the next day: <b>" + esc(label) + "</b>.<br/>Your friend needs to press ✅ READY.</p>" +
        "<div class='hub-actions'><button class='btn' data-w='go'>GO WITHOUT P2</button><button class='btn pink' data-w='no'>NOT YET</button></div>";
      document.body.appendChild(d);
      waitBox = { done: function (v) { if (!waitBox) return; waitBox = null; d.remove(); if (v) { guestReady = false; send({ t: "agreed" }); } res(v); } };
      d.onclick = function (e) { var b = e.target.closest("[data-w]"); if (b) waitBox.done(b.getAttribute("data-w") === "go"); };
    });
  }

  // ================== SIDE BY SIDE: each player has their own career ==================
  // Both play their own career save on their own device; the link keeps you in lockstep (a new day only when
  // you're BOTH ready), shows each other's progress and live scores, and your friend's player exists in your world.
  var sb = { me: null, partner: null, myReady: false, theirReady: false, hook: null, sent: "", tick: 0, score: "" };
  function startSB() {
    if (role) { if (mode === "sb") return; leaveQuiet(); }
    mode = "sb"; role = "host"; code = savedCode("sb");
    setStatus("🟡 WAITING FOR YOUR FRIEND…");
    listenLocal(); listenPeer();
  }
  function leaveQuiet() { try { send({ t: "bye" }); if (link) link.close(); } catch (e) {} connected = false; link = null; role = null; }
  function sbGuestStart(m) {
    document.body.classList.remove("coop-guest");
    if (sb.started) { setStatus("🟢 RECONNECTED — side by side with " + (m.host || "your friend")); sbConnected(); return; }
    sb.started = true;
    setStatus("🟢 CONNECTED — side by side with " + (m.host || "your friend"));
    sbConnected();                                                    // live score + match streaming work both ways
    U.modal("🧑‍🤝‍🧑 SIDE BY SIDE", "<p>You're linked with <b>" + esc(m.host || "your friend") + "</b>. Each of you plays <b>your own career</b> on your own device.</p>" +
      "<p>Pick (or create) your career. A new day starts when you're <b>both</b> ready; you'll see each other's results live, and your friend's player shows up in your world.</p>",
      [{ label: "TO MY CAREER ▸", value: 1 }]).then(function () { $("hub").onclick = null; VB.Career.start().then(function () { location.href = location.pathname; }); });
  }
  function sbConnected() {
    sb.theirReady = false; sbPush(true); if (sb.hook && sb.hook.onPartner) sb.hook.onPartner(); tickerOn();
    VB.Engine.onStart = function () { if (mode === "sb" && sbStream.want) { sbStreamStop(false); setTimeout(sbStreamStart, 60); } };   // my match starts: stream it if my friend is watching
  }
  function sbLost() { sb.partner = null; sb.theirReady = false; sb.score = ""; tickerShow(""); sbStreamStop(false); sbWatchClose(); if (sb.hook && sb.hook.onPartner) sb.hook.onPartner(); if (sb.myReady) sbCheck(); }
  function sbPush(force) {
    if (!sb.me || !connected) return;
    var j = JSON.stringify(sb.me);
    if (!force && j === sb.sent) return;
    sb.sent = j; send({ t: "sb-state", st: sb.me, ready: sb.myReady });
  }
  function sbMsg(m) {
    if (m.t === "sb-state") {
      var first = !sb.partner;
      sb.partner = m.st; sb.theirReady = !!m.ready;
      if (sb.hook && sb.hook.onFriend) sb.hook.onFriend(m.st, first);
      if (sb.hook && sb.hook.onPartner) sb.hook.onPartner();
      sbCheck(); return;
    }
    if (m.t === "sb-ready") { sb.theirReady = m.on; if (sb.hook && sb.hook.onPartner) sb.hook.onPartner(); sbCheck(); return; }
    if (m.t === "sb-news") { sbLog(m.txt); if (sb.hook && sb.hook.onNews) sb.hook.onNews(m.txt); return; }
    if (m.t === "sb-score") { var was = !!sb.score; sb.score = m.txt; tickerShow(m.txt); if (was !== !!m.txt && sb.hook && sb.hook.onPartner) sb.hook.onPartner(); return; }
    // watching each other's matches
    if (m.t === "sb-watch") { sbStream.want = !!m.on; if (m.on) sbStreamStart(); else sbStreamStop(false); return; }
    if (m.t === "sb-mstart") { if (sb.watchWant) sbWatchOpen(m.init, m.who); return; }
    if (m.t === "sb-snap") { if (sb.watching) { VB.Engine.applySnap(m.s); $("recordLine").textContent = m.rec || ""; if (!gState.pendingAsk) U.msg(m.msg || ""); } return; }
    // friendlies between the two of you: ⚔️ head-to-head, or 🤝 together on the same club
    if (m.t === "sb-fr") {
      var h = sb.hook && sb.hook.onInvite;
      if (!h || sb.watching || !$("matchView").classList.contains("hidden")) { send({ t: "sb-fr-ans", yes: false, why: "busy" }); return; }
      Promise.resolve(h(m.kind, m.from)).then(function (yes) {
        send({ t: "sb-fr-ans", yes: !!yes });
        if (yes) { sb.linked = true; document.body.classList.add("sb-linked"); sbWatch(true); }
      });
      return;
    }
    if (m.t === "sb-fr-ans") { if (sb.frWait) { var fw = sb.frWait; sb.frWait = null; fw(!!m.yes); } return; }
    if (m.t === "sb-fr-done") { sb.linked = false; document.body.classList.remove("sb-linked"); setTimeout(function () { sbWatch(false); }, 1900); if (sb.hook && sb.hook.onFriendlyDone) sb.hook.onFriendlyDone(m.res); return; }
    if (m.t === "sb-resync") { sb.sent = ""; sbPush(true); return; }
    if (m.t === "sb-feed") { if (sb.watching) { var f = $("feed"), d = document.createElement("div"); d.innerHTML = m.html; if (d.firstChild) f.appendChild(d.firstChild); while (f.children.length > 60) f.removeChild(f.firstChild); f.scrollTop = f.scrollHeight; } return; }
    if (m.t === "sb-mend") { if (sb.watching) { var bt = $("sbWatchT"); if (bt) bt.textContent = "🏁 " + (sb.partner ? sb.partner.name : "YOUR FRIEND") + "'S MATCH IS OVER"; setTimeout(sbWatchClose, 1800); } return; }
  }
  function sbGap() { return connected && sb.partner && sb.me && sb.me.day != null && sb.partner.day != null ? sb.me.day - sb.partner.day : 0; }
  function sbCheck() {
    if (!sb.myReady) return;
    var gap = sbGap();
    if (gap > 0) return;                                              // you're ahead: sit tight until they catch up
    if (gap === 0 && connected && sb.partner && !sb.theirReady) return;   // level: both have to be ready
    sb.myReady = false; sb.theirReady = false;
    if (sb.watchWant) sbWatch(false);                                 // both ready: back to your own day
    if (sb.hook && sb.hook.onGo) setTimeout(sb.hook.onGo, 30);
  }
  function sbReady() {
    sb.myReady = true; send({ t: "sb-ready", on: true });
    sbCheck();
  }
  // ---- streaming my match to my friend (only while they ask to watch) ----
  var sbStream = { want: false, on: false, t: 0, mo: null };
  function sbStreamStart() {
    if (sbStream.on || !connected || mode !== "sb" || sb.watching) return;
    if ($("matchView").classList.contains("hidden") || !VB.Engine.live()) return;      // not playing yet: onStart will kick it off
    sbStream.on = true; VB.Engine.stream(true);
    send({ t: "sb-mstart", init: VB.Engine.matchInit(), who: sb.me ? sb.me.name : "FRIEND" });
    sbStream.mo = new MutationObserver(function (ms) { ms.forEach(function (x) { x.addedNodes.forEach(function (n) { if (n.nodeType === 1) send({ t: "sb-feed", html: n.outerHTML }); }); }); });
    sbStream.mo.observe($("feed"), { childList: true });
    sbStream.t = setInterval(function () {
      if ($("matchView").classList.contains("hidden") || !connected || !VB.Engine.live()) return sbStreamStop(true);
      send({ t: "sb-snap", s: VB.Engine.snapshot(), msg: $("msg").textContent, rec: $("recordLine").textContent });
    }, 66);
  }
  function sbStreamStop(ended) {
    if (!sbStream.on) return;
    sbStream.on = false; clearInterval(sbStream.t); if (sbStream.mo) sbStream.mo.disconnect(); sbStream.mo = null;
    VB.Engine.stream(false); if (ended) send({ t: "sb-mend" });
  }
  // ---- watching my friend's match while I wait ----
  function sbWatch(on) {
    sb.watchWant = !!on; send({ t: "sb-watch", on: !!on });
    if (!on) sbWatchClose();
  }
  function sbWatchOpen(init, who) {
    if (!$("matchView").classList.contains("hidden") && !sb.watching) return;     // I'm in my own match
    sb.watching = true; document.body.classList.add("sb-watching");
    U.showView("match"); $("feed").innerHTML = "";
    VB.Engine.spectate(Object.assign({}, init, { tag: "🤝" }));
    var bar = $("sbWatchBar");
    if (!bar) { bar = document.createElement("div"); bar.id = "sbWatchBar"; bar.className = "sb-watch-bar"; document.body.appendChild(bar); }
    bar.innerHTML = "<span class='live-dot'></span><span id='sbWatchT'>" + (sb.linked ? (init.foeRole ? "⚔️ LIVE FRIENDLY vs " : "🤝 LIVE FRIENDLY with ") + esc(who || "YOUR FRIEND") + " — you play YOUR player" : "📺 WATCHING " + esc(who || "YOUR FRIEND") + " LIVE") + "</span>" +
      "<span class='muted' id='sbWatchR'>" + (sb.myReady ? "✅ you're ready — the next day starts when they finish" : "") + "</span><button class='btn tiny' id='sbWatchBack'>◀ BACK TO MY CAREER</button>";
    $("sbWatchBack").onclick = function () { sbWatch(false); };
  }
  // invite your friend to a friendly; resolves true if they accept
  function sbInvite(kind) {
    if (!connected) return Promise.resolve(false);
    return new Promise(function (res) {
      var to = setTimeout(function () { if (sb.frWait) { sb.frWait = null; res(false); } }, 30000);
      sb.frWait = function (yes) { clearTimeout(to); if (yes) { sb.linked = true; sbStream.want = true; } res(yes); };
      send({ t: "sb-fr", kind: kind, from: sb.me ? sb.me.name : "YOUR FRIEND" });
    });
  }
  function sbFriendlyDone(res) {
    sb.linked = false; sbStream.want = false; send({ t: "sb-fr-done", res: res });
  }
  function sbWatchClose() {
    if (!sb.watching) return;
    sb.watching = false; document.body.classList.remove("sb-watching", "sb-linked"); clearAsk();
    VB.Engine.stopSpectate();
    var bar = $("sbWatchBar"); if (bar) bar.remove();
    U.showView("hub");
    if (sb.hook && sb.hook.onPartner) sb.hook.onPartner();
  }
  // a short shared log of what's happening to both of you
  function sbLog(txt) { sb.log = (sb.log || []).concat([txt]).slice(-4); }
  // live score of your friend's match (and yours, sent to them)
  var tickEl = null, tickT = 0;
  function tickerShow(t) {
    if (!tickEl) { tickEl = document.createElement("div"); tickEl.className = "coop-ticker hidden"; document.body.appendChild(tickEl); }
    tickEl.textContent = t ? "🤝 " + t : ""; tickEl.classList.toggle("hidden", !t || !!sb.watching);
    var dl = $("duoLive"); if (dl) dl.textContent = t ? "🔴 LIVE — " + t.replace(/^.*? — /, "") : "";
  }
  function tickerOn() {
    clearInterval(tickT);
    tickT = setInterval(function () {
      if (!connected || mode !== "sb") return;
      var inMatch = !$("matchView").classList.contains("hidden") && !sb.watching, txt = "";
      if (inMatch) txt = (sb.me ? sb.me.name + " — " : "") + $("hudMe").textContent + " " + $("sMe").textContent + " : " + $("sOpp").textContent + " " + $("hudOpp").textContent;
      if (txt !== sb.lastTick) { sb.lastTick = txt; send({ t: "sb-score", txt: txt }); }
    }, 900);
  }

  window.addEventListener("beforeunload", function () { try { if (link) { send({ t: "bye" }); link.close(); } } catch (e) {} });

  VB.Coop = {
    startHost: startHost, invite: invite, startGuest: startGuest, ask: ask, agree: agree, leave: leave,
    startSB: startSB, sideBySide: function () { return mode === "sb" && !!role; },
    sbHook: function (h) { sb.hook = h; },
    sbSet: function (st) { sb.me = st; sbPush(false); },
    sbReady: sbReady, sbWaiting: function () { return sb.myReady; }, sbGap: sbGap,
    sbNews: function (txt) { sbLog(txt); send({ t: "sb-news", txt: txt }); },
    sbWatch: sbWatch, sbInvite: sbInvite, sbFriendlyDone: sbFriendlyDone, sbResync: function () { sb.sent = ""; sbPush(true); send({ t: "sb-resync" }); },
    matchLink: function () { return connected && (mode === "sb" ? !!sb.linked : role === "host"); }, sbWatching: function () { return !!sb.watching; }, partnerLive: function () { return connected ? sb.score : ""; },
    sbLog: function () { return sb.log || []; }, openChat: function () { chatUI(); if (!chat.open) chat.el.querySelector("[data-c=toggle]").click(); },
    partner: function () { return connected ? sb.partner : null; }, partnerReady: function () { return sb.theirReady; },
    connected: function () { return connected; },
    live: function () { return role === "host" && connected; },
    hosting: function () { return role === "host"; },
    status: function () { return statusTxt; },
    code: function () { return code; },
    pushHub: function () { if (role === "host" && connected) pushHub(true); }
  };
})(window.VB);
