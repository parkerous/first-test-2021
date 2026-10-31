// Shared UI helpers: messages, commentary feed, button prompts, pickers, modal dialogs.
(function (VB) {
  "use strict";
  var $ = function (id) { return document.getElementById(id); };

  // turn a plain button label into a call card: icon + title + sub line
  var ICONS = [[/^★/, "✨"], [/FLOAT/, "🪶"], [/TOPSPIN|JUMP/, "🌀"], [/^SPIKE$/, "💥"], [/^TIP$/, "🤏"], [/WIPE/, "🧹"], [/LEAN CROSS/, "↗️"], [/LEAN LINE/, "⬆️"],
               [/NORMAL BLOCK/, "🧱"], [/MORE CALLS/, "📋"], [/DECIDE/, "🤝"], [/^CALL /, "📣"], [/BACK ROW/, "🔙"], [/MIDDLE|QUICK|31|SLIDE/, "⚡"], [/OUTSIDE|4 HIGH|GO/, "🔥"],
               [/OPPOSITE|RIGHT|5 BACK|RED/, "🎯"], [/PLAY|CONTINUE|YES/, "▶️"]];
  function card(o) {
    var L = String(o.label), pick = /^👍/.test(L); L = L.replace(/^👍\s*/, "");
    var title = o.title || L.replace(/^★\s*/, ""), sub = o.sub || "", m = L.match(/^(.*?)\s*(?:→|·)\s*(.*)$/);
    if (!o.title && m) { title = m[1]; sub = sub || m[2]; }
    var icon = o.icon; if (!icon) { var f = ICONS.find(function (x) { return x[0].test(L); }); icon = f ? f[1] : "🏐"; }
    return { title: title, sub: sub, icon: icon, star: /^★/.test(L), pick: pick || !!o.pick };
  }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  VB.ui = {
    $: $,
    esc: esc,

    msg: function (t) {
      var m = $("msg"); m.textContent = t; m.classList.remove("flash"); void m.offsetWidth; m.classList.add("flash");
      var d = $("dockMsg"); if (d) d.textContent = t;
    },
    feed: function (side, text, hot) {
      var box = $("feed"), div = document.createElement("div");
      div.className = "line " + (side === 0 ? "me" : side === 1 ? "op" : "") + (hot ? " hot" : "");
      div.textContent = text;
      box.appendChild(div);
      while (box.children.length > 60) box.removeChild(box.firstChild);
      box.scrollTop = box.scrollHeight;
    },
    clearFeed: function () { $("feed").innerHTML = ""; },

    // the "call" cards: icon, title, a short line, optional hitter face / tempo / set spot; keys 1-9 pick
    buttons: function (list) {
      return new Promise(function (res) {
        var bar = $("actions"); bar.innerHTML = "";
        bar.classList.toggle("many", list.length > 4);
        var btns = [];
        function done(v) { document.removeEventListener("keydown", key); bar.innerHTML = ""; res(v); }
        list.forEach(function (o, i) {
          var c = card(o), b = document.createElement("button");
          b.className = "btn callcard" + (c.star ? " star" : "") + (c.pick ? " pick" : "") + (o.cls ? " " + o.cls : "");
          b.disabled = !!o.disabled; b.title = o.label;
          b.innerHTML = (i < 9 ? "<kbd>" + (i + 1) + "</kbd>" : "") +
            (o.face ? "<img class='cc-face' src='" + o.face + "' alt=''/>" : "<span class='cc-ic'>" + c.icon + "</span>") +
            "<span class='cc-txt'><span class='cc-t'>" + esc(c.title) + "</span>" + (c.sub ? "<span class='cc-s'>" + esc(c.sub) + "</span>" : "") +
            (o.tempo != null ? "<span class='cc-tempo'><i style='width:" + Math.round(Math.max(0.12, 1 - Math.min(1, o.tempo)) * 100) + "%'></i><em>" + (o.tempo < 0.5 ? "QUICK" : o.tempo < 0.8 ? "FAST" : "HIGH") + "</em></span>" : "") + "</span>" +
            (o.spot != null ? "<span class='cc-net'><i style='left:" + Math.round(o.spot * 100) + "%'" + (o.back ? " class='back'" : "") + "></i></span>" : "") +
            (o.mark ? "<span class='cc-tag mk" + (/DECOY/.test(o.mark) ? " decoy" : "") + "'>" + esc(o.mark) + "</span>" : c.pick ? "<span class='cc-tag'>SETTER'S PICK</span>" : "");
          b.addEventListener("click", function () { done(o.value); });
          bar.appendChild(b); btns.push({ b: b, o: o });
        });
        function key(e) {
          if (/INPUT|TEXTAREA/.test((e.target || {}).tagName || "")) return;
          var n = parseInt(e.key, 10); if (!(n >= 1 && n <= btns.length)) return;
          var it = btns[n - 1]; if (it.b.disabled || !it.b.isConnected) return;
          e.preventDefault(); done(it.o.value);
        }
        document.addEventListener("keydown", key);
      });
    },

    // full-court picker overlay; items: [{ html, value }]
    pickFrom: function (prompt, items, title) {
      return new Promise(function (res) {
        $("pickTitle").textContent = title || "VNL VOLLEY";
        $("pickPrompt").textContent = prompt;
        var grid = $("teamGrid"); grid.innerHTML = "";
        items.forEach(function (it) {
          var b = document.createElement("button");
          b.className = "btn";
          b.innerHTML = it.html;
          b.addEventListener("click", function () { $("pickScreen").classList.add("hidden"); res(it.value); });
          grid.appendChild(b);
        });
        $("pickScreen").classList.remove("hidden");
      });
    },

    // "hub" (menus, career) or "match" (the court)
    showView: function (v) {
      $("hub").classList.toggle("hidden", v !== "hub");
      $("matchView").classList.toggle("hidden", v !== "match");
      // in a match, scroll the big title away so the whole court fits on screen
      window.scrollTo(0, v === "match" ? Math.max(0, $("matchView").getBoundingClientRect().top + window.scrollY - 8) : 0);
    },

    // trophy cabinet with counters; items like "3 SV.LEAGUE CHAMPION (BLUETEON)" or "Y2 INTERHIGH CHAMPIONS"
    cabinet: function (list, icon) {
      var groups = {}, order = [];
      (list || []).forEach(function (t) {
        var m = String(t).match(/^(?:S|Y)?(\d+)\s+(.*?)(?:\s+\(([^)]*)\))?$/), key = m ? m[2] : t, when = m ? m[1] : "";
        if (!groups[key]) { groups[key] = { n: 0, when: [], extra: {} }; order.push(key); }
        groups[key].n++; if (when) groups[key].when.push(when); if (m && m[3]) groups[key].extra[m[3]] = 1;
      });
      if (!order.length) return "<p class='muted'>None yet.</p>";
      return "<div class='trophy-case'>" + order.sort(function (a, b) { return groups[b].n - groups[a].n; }).map(function (k) {
        var g = groups[k];
        return "<div class='cab-item'><span class='cab-icon'>" + (icon || "🏆") + "</span><b>" + esc(k) + "</b> <span class='cab-n'>×" + g.n + "</span>" +
          "<div class='muted'>" + (g.when.length ? "seasons " + g.when.join(", ") : "") + (Object.keys(g.extra).length ? " • " + esc(Object.keys(g.extra).join(", ")) : "") + "</div></div>";
      }).join("") + "</div>";
    },

    // "today" / "yesterday" / "3 days ago" for save slots
    ago: function (ts) {
      if (!ts) return "—";
      var d = Math.floor((Date.now() - ts) / 86400000);
      return d <= 0 ? "TODAY" : d === 1 ? "YESTERDAY" : d < 30 ? d + " DAYS AGO" : new Date(ts).toLocaleDateString();
    },
    // a save slot with a portrait, a headline, key progress chips and buttons
    slotCard: function (o) {
      return "<div class='card slot slot-rich'>" + (o.img ? "<img class='slot-face' src='" + o.img + "' alt=''/>" : "<div class='slot-face empty'>?</div>") +
        "<div class='slot-body'><div class='pname'>" + o.title + "</div><div class='muted'>" + o.sub + "</div>" +
        (o.chips && o.chips.length ? "<div class='slot-chips'>" + o.chips.map(function (c) { return "<span class='chip'>" + c + "</span>"; }).join("") + "</div>" : "") +
        "<div class='slot-btns'>" + o.btns + "</div></div></div>";
    },
    // the last mode played, for CONTINUE on the main menu
    setLast: function (mode, slot) { try { localStorage.setItem("retroVB.last", JSON.stringify({ mode: mode, slot: slot || 0, at: Date.now() })); } catch (e) {} },

    // page-level dialog; btns: [{ label, value, cls }] → resolves with the chosen value
    modal: function (title, html, btns) {
      return new Promise(function (res) {
        $("modalTitle").textContent = title;
        $("modalBody").innerHTML = html;
        var bar = $("modalBtns"); bar.innerHTML = "";
        (btns || [{ label: "CONTINUE", value: true }]).forEach(function (o) {
          var b = document.createElement("button");
          b.className = "btn" + (o.cls ? " " + o.cls : "");
          b.textContent = o.label;
          b.disabled = !!o.disabled;
          b.addEventListener("click", function () { $("modal").classList.add("hidden"); res(o.value); });
          bar.appendChild(b);
        });
        $("modal").classList.remove("hidden");
        $("modalBody").scrollTop = 0;
      });
    }
  };
})(window.VB);
