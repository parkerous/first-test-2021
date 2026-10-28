// Shared UI helpers: messages, commentary feed, button prompts, pickers, modal dialogs.
(function (VB) {
  "use strict";
  var $ = function (id) { return document.getElementById(id); };

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  VB.ui = {
    $: $,
    esc: esc,

    msg: function (t) { $("msg").textContent = t; },

    // side: 0 = your team, 1 = opponent, -1 = neutral
    feed: function (side, text, hot) {
      var box = $("feed"), div = document.createElement("div");
      div.className = "line " + (side === 0 ? "me" : side === 1 ? "op" : "") + (hot ? " hot" : "");
      div.textContent = text;
      box.appendChild(div);
      while (box.children.length > 60) box.removeChild(box.firstChild);
      box.scrollTop = box.scrollHeight;
    },
    clearFeed: function () { $("feed").innerHTML = ""; },

    buttons: function (list) {
      return new Promise(function (res) {
        var bar = $("actions"); bar.innerHTML = "";
        list.forEach(function (o) {
          var b = document.createElement("button");
          b.className = "btn"; b.textContent = o.label; b.disabled = !!o.disabled;
          b.addEventListener("click", function () { bar.innerHTML = ""; res(o.value); });
          bar.appendChild(b);
        });
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
      window.scrollTo(0, 0);
    },

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
