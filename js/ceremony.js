// Award ceremonies: a podium with confetti and a trophy, then each award presented in a spotlight.
// VB.Ceremony.play({ title, sub, podium: [{ name, kit, kit2, id, faces: [face] }], awards: [{ title, name, team, kit, kit2, teamId, face, line, you }] })
(function (VB) {
  "use strict";
  var esc = VB.ui.esc, rnd = VB.rnd;

  function sprite(face, kit, kit2, teamId) { return VB.Engine.makeSprite(kit || "#888888", face, kit2, VB.Engine.kitPattern(teamId)); }
  function kit2Of(id) {
    var t = (VB.NATIONAL || []).concat(VB.HQ_TEAMS || [], VB.CLUBS || []).find(function (x) { return x.id === id; });
    return t ? t.kit2 : null;
  }

  function play(o) {
    return new Promise(function (resolve) {
      var podium = (o.podium || []).slice(0, 3), awards = o.awards || [];
      var scenes = (podium.length ? ["podium"] : []).concat(awards.map(function (a, i) { return i; }));
      if (!scenes.length) return resolve();
      var fx = document.createElement("div");
      fx.id = "ceremonyFx";
      fx.innerHTML = "<canvas width='640' height='520'></canvas>" +
        "<div class='cer-btns'><button class='btn' data-c='next'>NEXT ▸</button><button class='btn pink' data-c='skip'>SKIP ▸▸</button></div>";
      document.body.appendChild(fx);
      var cv = fx.querySelector("canvas"), c = cv.getContext("2d"), idx = 0, t0 = performance.now(), raf = 0, done = false;
      c.imageSmoothingEnabled = false;
      var sprites = podium.map(function (tm) {
        return (tm.faces || []).slice(0, 7).map(function (f) { return sprite(f, tm.kit, tm.kit2 || kit2Of(tm.id), tm.id); });
      });
      var aSprites = awards.map(function (a) { return sprite(a.face, a.kit, a.kit2 || kit2Of(a.teamId), a.teamId); });
      var confetti = [];
      function burst(cols, n) {
        for (var i = 0; i < n; i++) confetti.push({ x: rnd(0, 640), y: rnd(-200, -10), vx: rnd(-0.6, 0.6), vy: rnd(1.2, 2.6), r: rnd(0, 6.28), col: cols[i % cols.length] });
      }
      function startScene() {
        t0 = performance.now(); confetti = [];
        var s = scenes[idx];
        if (s === "podium") burst([podium[0].kit, podium[0].kit2 || kit2Of(podium[0].id) || "#ffffff", "#ffd21e", "#ffffff"], 160);
        else burst(["#ffd21e", "#ffffff", awards[s].kit], 60);
      }
      function backdrop(t) {
        var gr = c.createLinearGradient(0, 0, 0, 520); gr.addColorStop(0, "#0b1430"); gr.addColorStop(1, "#05070b");
        c.fillStyle = gr; c.fillRect(0, 0, 640, 520);
        // crowd + sweeping spotlights
        for (var y = 400; y < 520; y += 8) for (var x = (y / 8) % 2 * 4; x < 640; x += 9) { c.fillStyle = ["#24324f", "#2d3d5e", "#1c2740"][(x + y) % 3]; c.fillRect(x, y + Math.sin(t / 200 + x) * 1.5, 5, 6); }
        for (var k = 0; k < 3; k++) {
          var a = Math.sin(t / 900 + k * 2) * 0.5;
          c.save(); c.translate(120 + k * 200, -20); c.rotate(a);
          var lg = c.createLinearGradient(0, 0, 0, 520); lg.addColorStop(0, "rgba(255,240,180,0.22)"); lg.addColorStop(1, "rgba(255,240,180,0)");
          c.fillStyle = lg; c.beginPath(); c.moveTo(-10, 0); c.lineTo(10, 0); c.lineTo(110, 540); c.lineTo(-110, 540); c.fill(); c.restore();
        }
      }
      function drawConfetti() {
        confetti.forEach(function (p) {
          p.x += p.vx + Math.sin(p.y / 30) * 0.4; p.y += p.vy; p.r += 0.1;
          if (p.y > 530) { p.y = rnd(-40, -5); p.x = rnd(0, 640); }
          c.fillStyle = p.col; c.fillRect(p.x, p.y, 4, Math.abs(Math.cos(p.r)) * 5 + 1);
        });
      }
      function text(s, x, y, size, col, font) {
        c.font = size + "px " + (font || '"Press Start 2P", monospace'); c.textAlign = "center"; c.textBaseline = "middle";
        c.lineWidth = Math.max(3, size / 3); c.strokeStyle = "#05070b"; c.strokeText(s, x, y);
        c.fillStyle = col; c.fillText(s, x, y);
      }
      function trophy(x, y) {
        c.fillStyle = "#ffd21e"; c.fillRect(x - 14, y, 28, 20); c.fillRect(x - 20, y + 2, 6, 10); c.fillRect(x + 14, y + 2, 6, 10);
        c.fillStyle = "#e0a800"; c.fillRect(x - 4, y + 20, 8, 10); c.fillRect(x - 12, y + 30, 24, 6);
        c.fillStyle = "#fff6b0"; c.fillRect(x - 10, y + 3, 4, 12);
      }
      function frame(now) {
        if (done) return;
        var t = now - t0, s = scenes[idx];
        backdrop(now);
        if (s === "podium") {
          var steps = [{ x: 320, w: 170, h: 120, n: "1" }, { x: 150, w: 150, h: 80, n: "2" }, { x: 490, w: 150, h: 56, n: "3" }];
          text(o.title || "AWARDS", 320, 36, 16, "#ffd21e");
          if (o.sub) text(o.sub, 320, 64, 18, "#cfe6fb", '"VT323", monospace');
          podium.forEach(function (tm, i) {
            var st = steps[i], top = 400 - st.h, rise = Math.min(1, Math.max(0, (t - i * 250) / 600));
            c.fillStyle = i === 0 ? "#e8c33a" : i === 1 ? "#c9d1db" : "#c98a5a"; c.fillRect(st.x - st.w / 2, top, st.w, st.h);
            c.fillStyle = "rgba(0,0,0,0.2)"; c.fillRect(st.x - st.w / 2, top + st.h - 8, st.w, 8);
            text(st.n, st.x, top + st.h / 2, 22, "#ffffff");
            var sp = sprites[i], gap = Math.min(22, (st.w - 20) / Math.max(1, sp.length));
            sp.forEach(function (im, k) {
              var x = st.x - (sp.length - 1) * gap / 2 + k * gap, hop = i === 0 && t > 900 ? Math.abs(Math.sin(now / 160 + k)) * 8 : 0;
              c.drawImage(im, x - 12, top - 32 - hop - (1 - rise) * 40, 24, 32);
            });
            text(tm.name, st.x, top - 46 - (i === 0 ? 30 : 0), i === 0 ? 11 : 8, i === 0 ? "#ffffff" : "#cfe6fb");
          });
          if (podium[0] && t > 700) trophy(320, 112 + Math.sin(now / 250) * 4);
          if (t > 600) text(podium[0].name + " ARE CHAMPIONS!", 320, 470, 12, "#ffd21e");
        } else {
          var a = awards[s], im = aSprites[s], up = Math.min(1, t / 500);
          c.fillStyle = "rgba(255,240,180,0.18)"; c.beginPath(); c.ellipse(320, 380, 120, 26, 0, 0, 6.28); c.fill();
          text(a.title, 320, 50, a.title.length > 18 ? 13 : 16, "#ffd21e");
          c.drawImage(im, 320 - 60, 380 - 160 + (1 - up) * 200, 120, 160);
          if (t > 700) {                                                    // the medal drops on
            var my = Math.min(318, 120 + (t - 700) / 2);
            c.fillStyle = "#1e63ff"; c.fillRect(312, my - 40, 4, 34); c.fillRect(324, my - 40, 4, 34);
            c.fillStyle = "#ffd21e"; c.beginPath(); c.arc(320, my, 13, 0, 6.28); c.fill();
            c.fillStyle = "#e0a800"; c.beginPath(); c.arc(320, my, 7, 0, 6.28); c.fill();
          }
          if (t > 400) {
            text(a.name + (a.you ? " (YOU)" : ""), 320, 420, 14, a.you ? "#3ddc7a" : "#ffffff");
            text(a.team || "", 320, 446, 20, "#9cc4ea", '"VT323", monospace');
            text(a.line || "", 320, 472, 20, "#cfe6fb", '"VT323", monospace');
          }
          text((s + 1) + " / " + awards.length, 600, 20, 8, "#7f8fa6");
        }
        drawConfetti();
        if (o.auto && t > (s === "podium" ? 4200 : 2600)) return next();
        raf = requestAnimationFrame(frame);
      }
      function finish() { done = true; cancelAnimationFrame(raf); fx.remove(); resolve(); }
      function next() { cancelAnimationFrame(raf); idx++; if (idx >= scenes.length) return finish(); startScene(); raf = requestAnimationFrame(frame); }
      fx.querySelector(".cer-btns").onclick = function (e) {
        var b = e.target.closest("[data-c]"); if (!b) return;
        if (b.getAttribute("data-c") === "skip") finish(); else next();
      };
      cv.onclick = next;
      startScene(); raf = requestAnimationFrame(frame);
    });
  }

  // award list entries from VB.Stats.awards → ceremony format
  function fromAwards(list, kit2Lookup) {
    return list.map(function (a) {
      var i = a.info;
      return { title: a.title, name: i.name, team: (i.flag ? i.flag + " " : "") + (i.team || ""), kit: i.kit, kit2: kit2Lookup ? kit2Lookup(i.teamId) : null, teamId: i.teamId, face: i.face, line: a.line, you: i.you };
    });
  }

  VB.Ceremony = { play: play, fromAwards: fromAwards };
})(window.VB);
