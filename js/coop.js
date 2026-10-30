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
  function attach(l, how) {
    if (link) return false;                                       // already paired on the other transport
    link = l; connected = true;
    setStatus("🟢 CONNECTED (" + how + ")");
    if (role === "host") { startMirror(); if (opts.onConnect) opts.onConnect(); }
    else send({ t: "hi" });
    return true;
  }
  function lost() {
    if (!connected) return;
    connected = false; link = null;
    Object.keys(pend).forEach(function (id) { var p = pend[id]; clearTimeout(p.to); delete pend[id]; p.res(p.def); });
    stopMirror();
    setStatus(role === "host" ? "🔴 P2 DISCONNECTED — their player plays as AI until they're back (the link still works)" : "🔴 DISCONNECTED FROM THE HOST");
    if (role === "guest") guestLost();
    if (role === "host" && opts.onLost) opts.onLost();
  }
  function send(m) { if (!link) return; try { link.send(m); } catch (e) { console.warn("coop send", e); } }

  function listenLocal() {
    try { bc = new BroadcastChannel(PREFIX + code); } catch (e) { bc = null; return; }
    bc.onmessage = function (ev) {
      var m = ev.data || {};
      if (m.to && m.to !== role) return;
      if (m.t === "__hello" && role === "host" && !link) { bc.postMessage({ t: "__ack", to: "guest" }); attach(localLink(), "same computer"); return; }
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
      peer.on("error", function (e) { console.warn("peer", e); if (!connected) setStatus("⚠️ ONLINE LINK ERROR: " + (e.type || e.message || e) + (role === "guest" ? " — is the host online?" : "")); });
      if (role === "host") {
        peer.on("connection", function (conn) {
          conn.on("open", function () { if (!attach(peerLink(conn), "online")) { conn.close(); return; } });
          conn.on("data", function (m) { if (link && !link.local) onMsg(m); });
          conn.on("close", function () { if (link && !link.local) lost(); });
        });
      } else {
        peer.on("open", function () {
          var conn = peer.connect(PREFIX + code, { reliable: true });
          conn.on("open", function () { attach(peerLink(conn), "online"); });
          conn.on("data", function (m) { if (link && !link.local) onMsg(m); });
          conn.on("close", function () { if (link && !link.local) lost(); });
        });
      }
    } catch (e) { console.warn(e); }
  }

  // ---------- messages ----------
  function onMsg(m) {
    if (!m || !m.t) return;
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
    role = "host"; code = newCode();
    setStatus("🟡 WAITING FOR YOUR FRIEND…");
    listenLocal(); listenPeer();
  }
  function hostMsg(m) {
    if (m.t === "hi") { send({ t: "welcome", host: opts.hostName ? opts.hostName() : "HOST", info: opts.info ? opts.info() : {} }); pushHub(true); pushModal(); return; }
    if (m.t === "join") { var r = opts.onJoin ? opts.onJoin(m) : { ok: false, msg: "The host isn't in a career." }; send({ t: "joined", ok: r.ok, msg: r.msg }); pushHub(true); return; }
    if (m.t === "ans") { var p = pend[m.id]; if (p) { clearTimeout(p.to); delete pend[m.id]; p.res(m.v); } return; }
    if (m.t === "focus" && opts.onFocus) { opts.onFocus(m.a); return; }
    if (m.t === "bye") { lost(); }
  }
  // mirror the hub and the host's dialogs, and stream the court while a match runs
  var hubT = 0, lastHub = "";
  function pushHub(force) {
    clearTimeout(hubT);
    hubT = setTimeout(function () {
      var h = $("hub").innerHTML;
      if (!force && h === lastHub) return;
      lastHub = h; send({ t: "hub", html: h });
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
    var small = document.createElement("canvas"); small.width = 400; small.height = 563;
    var sg = small.getContext("2d");
    streamT = setInterval(function () {
      var inMatch = !$("matchView").classList.contains("hidden"), v = inMatch ? "match" : "hub";
      if (v !== lastView) { lastView = v; send({ t: "view", v: v, stage: $("stageLine").textContent }); if (v === "hub") pushHub(true); }
      if (!inMatch) return;
      sg.drawImage($("court"), 0, 0, 400, 563);
      send({ t: "frame", d: small.toDataURL("image/jpeg", 0.6),
             hud: { sMe: $("sMe").textContent, sOpp: $("sOpp").textContent, hudMe: $("hudMe").textContent, hudOpp: $("hudOpp").textContent,
                    msg: $("msg").textContent, rec: $("recordLine").textContent, serveMe: $("serveMe").textContent, serveOpp: $("serveOpp").textContent } });
    }, 110);
  }
  function stopMirror() { obs.forEach(function (o) { o.disconnect(); }); obs = []; clearInterval(streamT); lastView = ""; }

  // the invite dialog (host)
  async function invite() {
    var url = inviteURL();
    var html = "<p>Send this link to your friend. When you're both online at the same time, they join <b>your " + esc(opts.what || "career") + "</b> as a second player on your team and control their own player in every match.</p>" +
      "<p><input id='coopLink' class='text-in coop-link' readonly value='" + esc(url) + "'/></p>" +
      "<p class='center'><button class='btn' id='coopCopy'>📋 COPY LINK</button></p>" +
      "<p class='center big' id='coopStatus'>" + esc(statusTxt) + "</p>" +
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
    guestShell("<div class='coop-p2'><span>P2 TRAINING FOCUS:</span> " + ["srv", "rec", "set", "att", "blk", "def", "spd"].map(function (a) {
        return "<button class='btn tiny' data-coop='focus' data-v='" + a + "'>" + a.toUpperCase() + "</button>"; }).join("") + "</div>" +
      "<p class='center muted'>You see everything the host sees. They advance the calendar; in matches you control your own player (P2).</p>" +
      "<div id='coopMirror' class='coop-mirror'></div><div id='coopModal' class='coop-modal hidden'></div>");
  }
  function guestClick(e) {
    var b = e.target.closest("[data-coop]"); if (!b) return;
    var k = b.getAttribute("data-coop"), v = b.getAttribute("data-v");
    if (k === "leave") { leave(); return; }
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
    if (k === "focus") { send({ t: "focus", a: v }); document.querySelectorAll("[data-coop=focus]").forEach(function (x) { x.classList.toggle("on", x === b); }); }
  }
  var court = null, cg = null, img = new Image();
  img.onload = function () { if (cg) cg.drawImage(img, 0, 0, 640, 900); };
  function guestMsg(m) {
    if (m.t === "welcome") { if (m.re) gState.joined = false; if (!gState.joined) joinForm(m); return; }
    if (m.t === "joined") {
      if (!m.ok) { U.modal("CAN'T JOIN", "<p>" + esc(m.msg || "") + "</p>"); return; }
      gState.joined = true; mirrorShell(); return;
    }
    if (!gState.joined) return;
    if (m.t === "hub") { mirrorShell(); var mir = $("coopMirror"); if (mir) mir.innerHTML = m.html; return; }
    if (m.t === "modal") {
      var cm = $("coopModal"); if (!cm) return;
      cm.classList.toggle("hidden", !m.open);
      cm.innerHTML = m.open ? "<div class='coop-modal-t'>HOST: " + esc(m.title) + "</div><div class='coop-modal-b'>" + m.body + "</div><p class='center muted'>⏳ waiting for the host…</p>" : "";
      return;
    }
    if (m.t === "view") {
      if (m.v === "match") {
        U.showView("match"); court = $("court"); cg = court.getContext("2d"); $("feed").innerHTML = "";
        $("stageLine").textContent = m.stage || "CO-OP MATCH";
      } else { clearAsk(); U.showView("hub"); }
      return;
    }
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
      v = await new Promise(function (res) {
        var cv = $("court"); cv.classList.add("aiming");
        $("msg").textContent = "🎯 YOUR AIM — click the court" + (m.p.msg ? " (" + m.p.msg + ")" : "");
        gState.aimHandler = function (e) {
          var r = cv.getBoundingClientRect();
          cv.removeEventListener("click", gState.aimHandler); gState.aimHandler = null; cv.classList.remove("aiming");
          res({ px: (e.clientX - r.left) / r.width * 640, py: (e.clientY - r.top) / r.height * 900 });
        };
        cv.addEventListener("click", gState.aimHandler);
      });
    }
    if (gState.pendingAsk !== m.id) return;                         // the host gave up waiting
    gState.pendingAsk = null;
    send({ t: "ans", id: m.id, v: v });
  }
  function guestLost() {
    clearAsk(); U.showView("hub");
    $("hub").innerHTML = "<h2 class='hub-h'>CO-OP</h2><p class='center big'>🔴 Disconnected from the host.</p><p class='center'>Their career is saved on their device — open the link again when you're both online.</p>" +
      "<div class='hub-actions'><button class='btn' onclick='location.reload()'>RECONNECT</button><button class='btn pink' onclick='location.href=location.pathname'>MAIN MENU</button></div>";
  }
  function leave() {
    send({ t: "bye" }); if (link) link.close();
    location.href = location.pathname;
  }

  window.addEventListener("beforeunload", function () { try { if (link) { send({ t: "bye" }); link.close(); } } catch (e) {} });

  VB.Coop = {
    startHost: startHost, invite: invite, startGuest: startGuest, ask: ask,
    live: function () { return role === "host" && connected; },
    hosting: function () { return role === "host"; },
    status: function () { return statusTxt; },
    code: function () { return code; },
    pushHub: function () { if (role === "host" && connected) pushHub(true); }
  };
})(window.VB);
