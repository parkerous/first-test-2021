// Player sprites, take two: 24×32 chibi pixel art. Silhouette first (big head, signature hair), a small
// palette with light from the top-left, anime eyes with a catch-light, kit details (collar, number, knee
// pads, shoes) and a 1-px outline so every player reads on a busy court.
(function (VB) {
  "use strict";
  var W = 24, H = 32;
  function hexRGB(h) { h = String(h || "#888888").replace("#", ""); if (h.length === 3) h = h.split("").map(function (c) { return c + c; }).join(""); return [0, 2, 4].map(function (i) { return parseInt(h.substr(i, 2), 16) || 0; }); }
  function rgbHex(a) { return "#" + a.map(function (v) { v = Math.max(0, Math.min(255, Math.round(v))); return (v < 16 ? "0" : "") + v.toString(16); }).join(""); }
  function mix(a, b, t) { var x = hexRGB(a), y = hexRGB(b); return rgbHex([0, 1, 2].map(function (i) { return x[i] + (y[i] - x[i]) * t; })); }
  function lum(c) { var a = hexRGB(c); return (a[0] * 0.299 + a[1] * 0.587 + a[2] * 0.114) / 255; }
  var DIGITS = { 0: ["111", "101", "101", "101", "111"], 1: ["010", "110", "010", "010", "111"], 2: ["111", "001", "111", "100", "111"], 3: ["111", "001", "011", "001", "111"],
                 4: ["101", "101", "111", "001", "001"], 5: ["111", "100", "111", "001", "111"], 6: ["111", "100", "111", "101", "111"], 7: ["111", "001", "010", "010", "010"],
                 8: ["111", "101", "111", "101", "111"], 9: ["111", "101", "111", "001", "111"] };

  function make(kit, face, kit2, pat, num) {
    var c = document.createElement("canvas"); c.width = W; c.height = H;
    var q = c.getContext("2d");
    function p(x, y, col) { q.fillStyle = col; q.fillRect(x, y, 1, 1); }
    function row(x1, x2, y, col) { q.fillStyle = col; q.fillRect(x1, y, x2 - x1 + 1, 1); }
    function rect(x, y, w, h, col) { q.fillStyle = col; q.fillRect(x, y, w, h); }
    face = face || {};
    kit = kit || "#888888";
    var skin = face.skin || "#ffdcc2", SKD = mix(skin, "#5a2a1a", 0.22), SKL = mix(skin, "#ffffff", 0.18);
    var Hc = face.hair || "#17120d", HD = mix(Hc, "#000000", 0.38), HL = mix(Hc, "#ffffff", 0.28), H2 = face.hair2 || mix(Hc, "#000000", 0.5);
    var ex = face.ex || [], hs = typeof face.style === "string" ? face.style : ["buzz", "flat", "spiky", "bald"][face.style || 0] || "buzz";
    var trim = kit2 && String(kit2).toLowerCase() !== String(kit).toLowerCase() ? kit2 : mix(kit, "#ffffff", 0.6);
    var KD = mix(kit, "#000000", 0.22), KL = mix(kit, "#ffffff", 0.14), SH = mix(kit, "#000000", 0.6);
    pat = pat || "trim";

    // ---------- legs, shoes ----------
    rect(8, 27, 3, 2, skin); rect(13, 27, 3, 2, skin);
    rect(8, 27, 3, 1, "#2b2b30"); rect(13, 27, 3, 1, "#2b2b30");                 // knee pads
    rect(8, 29, 3, 1, "#f2f2f2"); rect(13, 29, 3, 1, "#f2f2f2");                 // socks
    var shoe = lum(kit) > 0.75 ? "#1e63ff" : trim;
    rect(7, 30, 4, 1, shoe); rect(13, 30, 4, 1, shoe); rect(7, 31, 4, 1, "#3a3a44"); rect(13, 31, 4, 1, "#3a3a44");
    // ---------- shorts ----------
    rect(7, 24, 10, 3, SH); p(7, 24, trim); p(7, 25, trim); p(16, 24, trim); p(16, 25, trim); rect(11, 26, 2, 1, "rgba(0,0,0,0)");
    q.clearRect(11, 26, 2, 1);
    // ---------- arms ----------
    rect(4, 19, 2, 3, skin); rect(18, 19, 2, 3, skin); p(5, 21, SKD); p(18, 21, SKD);
    rect(4, 22, 2, 1, SKL); rect(18, 22, 2, 1, SKL);                               // hands
    var bare = ex.indexOf("tank") >= 0;
    // ---------- jersey ----------
    rect(6, 15, 12, 9, kit);
    rect(4, 15, 2, 4, bare ? skin : kit); rect(18, 15, 2, 4, bare ? skin : kit);   // sleeves
    rect(15, 16, 3, 8, KD); rect(6, 16, 1, 7, KL);                                 // shading
    if (!bare) { rect(4, 18, 2, 1, trim); rect(18, 18, 2, 1, trim); }              // cuffs
    if (pat === "stripe") rect(6, 19, 12, 1, trim);
    if (pat === "sash") for (var sy = 0; sy < 9; sy++) { p(16 - sy, 15 + sy, trim); p(17 - sy, 15 + sy, trim); }
    if (pat === "shoulder") { rect(6, 15, 12, 2, trim); rect(4, 15, 2, 2, trim); rect(18, 15, 2, 2, trim); }
    if (pat === "panel") { rect(6, 16, 1, 8, trim); rect(17, 16, 1, 8, trim); }
    rect(10, 15, 4, 1, pat === "shoulder" ? kit : trim); p(11, 16, pat === "shoulder" ? kit : trim); p(12, 16, pat === "shoulder" ? kit : trim);   // V collar
    if (num != null && pat !== "sash") {
      var s = String(num).slice(-2), ncol = lum(kit) > 0.6 ? "#13293f" : "#ffffff", x0 = s.length > 1 ? 9 : 11;
      s.split("").forEach(function (d, i) { (DIGITS[d] || []).forEach(function (r, ry) { r.split("").forEach(function (b, rx) { if (b === "1") p(x0 + i * 4 + rx, 18 + ry, ncol); }); }); });
    }
    rect(6, 23, 12, 1, KD);
    // ---------- neck & head ----------
    rect(10, 14, 4, 1, SKD);
    row(8, 15, 4, skin); row(7, 16, 5, skin); for (var hy = 6; hy <= 12; hy++) row(6, 17, hy, skin); row(7, 16, 13, skin);
    p(5, 9, skin); p(5, 10, SKD); p(18, 9, skin); p(18, 10, SKD);                  // ears
    rect(16, 6, 1, 7, SKD); p(17, 12, SKD);                                        // cheek shade
    // eyes: big anime eyes with a catch-light
    var EYE = face.eye || "#22263d";
    rect(8, 9, 2, 2, EYE); rect(14, 9, 2, 2, EYE); p(8, 9, "#ffffff"); p(14, 9, "#ffffff");
    p(9, 10, mix(EYE, "#6a7cff", 0.35)); p(15, 10, mix(EYE, "#6a7cff", 0.35));
    if (lum(skin) > 0.55) { p(7, 11, mix(skin, "#ff6f7a", 0.3)); p(16, 11, mix(skin, "#ff6f7a", 0.3)); }   // blush
    row(8, 9, 7, HD); row(14, 15, 7, HD);                                          // brows (hair may cover)
    if (face.mouth !== false) { p(11, 12, "#a33d4d"); p(12, 12, "#c25a6a"); } else p(11, 12, SKD);
    if (ex.indexOf("beard") >= 0) { row(7, 16, 13, Hc); row(8, 15, 12, Hc); p(11, 12, "#a33d4d"); p(12, 12, "#c25a6a"); p(6, 11, Hc); p(17, 11, Hc); }
    if (ex.indexOf("stubble") >= 0) { var SB = mix(skin, Hc, 0.35); row(8, 15, 13, SB); p(7, 12, SB); p(16, 12, SB); }

    // ---------- hair ----------
    function top(y0) { row(9, 14, y0, Hc); row(7, 16, y0 + 1, Hc); for (var y = y0 + 2; y <= 6; y++) row(6, 17, y, Hc); row(8, 12, y0 + 1, HL); }
    function sides(y1) { for (var y = 7; y <= y1; y++) { p(6, y, Hc); p(17, y, Hc); } }
    function fringe(cols, y) { cols.forEach(function (x) { p(x, y, Hc); }); }
    var S = {
      bald: function () { p(9, 5, SKL); p(10, 5, SKL); },
      buzz: function () { var B = mix(Hc, skin, 0.35); row(8, 15, 3, B); row(7, 16, 4, B); row(6, 17, 5, B); p(6, 6, B); p(17, 6, B); },
      crew: function () { top(2); p(6, 7, Hc); p(17, 7, Hc); },
      flat: function () { top(2); fringe([7, 8, 9, 10, 13, 14, 15, 16], 7); sides(10); },
      classic: function () { S.flat(); },
      sidepart: function () { top(2); row(6, 13, 7, Hc); row(6, 9, 8, Hc); p(14, 3, HD); sides(10); },
      fringe: function () { top(2); row(6, 17, 7, Hc); row(7, 12, 8, Hc); sides(10); },
      middle: function () { top(2); p(11, 2, HD); p(12, 2, HD); p(11, 3, HD); fringe([6, 7, 8, 9, 14, 15, 16, 17], 7); fringe([6, 7, 16, 17], 8); sides(11); },
      undercut: function () { top(1); row(7, 16, 2, HL); p(6, 6, mix(Hc, skin, 0.5)); p(17, 6, mix(Hc, skin, 0.5)); },
      crop: function () { top(2); for (var x = 7; x <= 16; x += 2) p(x, 7, Hc); p(9, 3, HL); p(13, 3, HL); },
      slick: function () { top(2); row(7, 16, 3, HL); p(6, 7, Hc); p(17, 7, Hc); },
      bun: function () { top(3); rect(10, 0, 4, 3, Hc); p(11, 0, HL); },
      wavy: function () { top(2); for (var x = 6; x <= 17; x++) if (x % 3) p(x, 7, Hc); sides(11); p(5, 10, Hc); p(18, 10, Hc); },
      braids: function () { top(2); for (var x = 7; x <= 16; x += 2) { p(x, 2, HD); p(x, 4, HD); p(x + 1, 3, HD); } sides(12); p(5, 12, Hc); p(18, 12, Hc); },
      curly: function () { top(1); for (var x = 6; x <= 17; x += 2) { p(x, 1, Hc); p(x + 1, 7, Hc); } for (var y = 2; y <= 6; y += 2) for (var x2 = 7 + (y % 4 ? 1 : 0); x2 <= 16; x2 += 3) p(x2, y, HL); sides(9); p(5, 7, Hc); p(18, 7, Hc); },
      afro: function () { for (var y = 0; y <= 7; y++) { var w = y < 2 ? 5 + y * 2 : 8; row(12 - w, 11 + w, y, Hc); } p(8, 1, HL); p(10, 2, HL); p(14, 1, HL); rect(4, 8, 2, 3, Hc); rect(18, 8, 2, 3, Hc); },
      long: function () { top(2); fringe([7, 8, 9, 14, 15, 16], 7); for (var y = 7; y <= 16; y++) { rect(5, y, 2, 1, Hc); rect(17, y, 2, 1, Hc); } p(5, 16, HD); p(18, 16, HD); },
      bowl: function () {   // straight bangs with pointed tips (Kageyama)
        top(2); row(6, 17, 7, Hc); for (var x = 6; x <= 17; x += 2) p(x, 8, Hc); p(5, 7, Hc); p(18, 7, Hc); sides(11); p(5, 10, Hc); p(18, 10, Hc);
        row(8, 15, 3, HL);
      },
      fluffy: function () { top(1); p(7, 0, Hc); p(10, 0, Hc); p(14, 0, Hc); p(16, 1, Hc); fringe([6, 7, 8, 10, 11, 13, 15, 16, 17], 7); fringe([7, 10, 15], 8); sides(10); p(5, 8, Hc); p(18, 8, Hc); row(9, 13, 2, HL); },
      spiky: function () { top(3); [[6, 2], [7, 1], [9, 0], [10, 1], [13, 0], [14, 1], [16, 1], [17, 2], [5, 4], [18, 4]].forEach(function (a) { p(a[0], a[1], Hc); }); p(9, 1, HL); p(13, 1, HL); fringe([7, 9, 12, 14, 16], 7); sides(9); },
      mohawk: function () { rect(10, 0, 4, 6, Hc); row(10, 13, 0, HL); var B = mix(Hc, skin, 0.5); row(7, 9, 4, B); row(14, 16, 4, B); },
      // ---- the signature cuts ----
      hinata: function () {   // a wild, sunny mop that spikes out everywhere
        top(1); [[5, 1], [7, 0], [9, 0], [12, 0], [14, 0], [16, 0], [18, 1], [4, 3], [19, 3], [3, 5], [20, 5], [4, 6], [19, 6], [5, 2], [17, 1]].forEach(function (a) { p(a[0], a[1], Hc); });
        row(4, 19, 4, Hc); row(4, 19, 5, Hc); row(5, 18, 6, Hc); fringe([6, 7, 9, 10, 12, 15, 16, 17], 7); fringe([7, 10, 16], 8); sides(9); p(5, 8, Hc); p(18, 8, Hc);
        row(8, 14, 2, HL); p(6, 3, HL); p(17, 3, HL);
      },
      noya: function () {   // tall upward spike with a blond fringe streak (Nishinoya)
        top(2); rect(9, 0, 6, 2, Hc); p(8, 1, Hc); p(15, 1, Hc); p(11, 0, HL); p(12, 0, HL);
        fringe([6, 7, 8, 15, 16, 17], 7); rect(10, 6, 4, 3, face.hair2 || "#e8d27a"); p(11, 9, face.hair2 || "#e8d27a"); sides(9);
      },
      bedhead: function () {  // the owl: two horns (Bokuto / Kuroo-ish when no streak)
        top(3); rect(5, 1, 3, 3, Hc); p(4, 0, Hc); p(5, 0, Hc); rect(16, 1, 3, 3, Hc); p(18, 0, Hc); p(19, 0, Hc);
        p(6, 1, H2); p(7, 2, H2); p(17, 1, H2); p(16, 2, H2); row(9, 14, 3, HL); fringe([7, 9, 11, 13, 15, 16], 7); sides(9);
      },
      kuroo: function () {    // swooping bedhead that hides one eye
        top(1); p(4, 2, Hc); p(5, 1, Hc); p(18, 1, Hc); p(19, 2, Hc); row(5, 18, 3, Hc);
        rect(13, 7, 5, 3, Hc); p(16, 10, Hc); p(15, 10, Hc); fringe([6, 7, 8], 7); sides(9); row(8, 12, 2, HL); p(14, 9, "#ffffff");
      },
      tsukki: function () { top(2); for (var x = 7; x <= 16; x += 2) { p(x, 1, Hc); p(x + 1, 2, HL); } fringe([6, 7, 9, 10, 14, 16, 17], 7); sides(9); }
    };
    (S[hs] || S.flat)();
    // ---------- extras ----------
    if (ex.indexOf("roots") >= 0) { row(8, 15, 2, H2); row(7, 16, 3, H2); }
    if (ex.indexOf("streak") >= 0 && hs !== "noya" && hs !== "bedhead") { p(11, 2, H2); p(12, 3, H2); p(12, 7, H2); p(11, 6, H2); }
    if (ex.indexOf("moles") >= 0) { p(15, 6, "#3a2416"); p(16, 7, "#3a2416"); }
    if (ex.indexOf("glasses") >= 0) { var GL = "#2b2b38"; rect(7, 8, 4, 1, GL); rect(13, 8, 4, 1, GL); p(7, 9, GL); p(10, 9, GL); p(13, 9, GL); p(16, 9, GL); row(7, 10, 11, GL); row(13, 16, 11, GL); row(11, 12, 9, GL); }
    if (ex.indexOf("sunglasses") >= 0) { rect(7, 8, 4, 3, "#111118"); rect(13, 8, 4, 3, "#111118"); row(11, 12, 9, "#111118"); p(8, 9, "#4a6a9a"); p(14, 9, "#4a6a9a"); }
    if (ex.indexOf("headband") >= 0) row(6, 17, 5, face.band || "#ffffff");
    if (ex.indexOf("santa") >= 0) { rect(7, 0, 10, 4, "#d62828"); row(6, 17, 4, "#ffffff"); row(6, 17, 5, "#ffffff"); p(17, 1, "#d62828"); p(18, 2, "#ffffff"); p(19, 2, "#ffffff"); }
    if (ex.indexOf("witch") >= 0) { var WC = "#2b1b3d"; rect(10, 0, 3, 2, WC); rect(9, 2, 6, 2, WC); row(4, 19, 4, WC); row(5, 18, 5, WC); row(9, 14, 3, "#ff8a1e"); }
    if (ex.indexOf("pumpkin") >= 0) { rect(7, 1, 10, 5, "#ff8a1e"); rect(11, 0, 2, 1, "#2f8a4a"); p(9, 2, "#c25a00"); p(14, 2, "#c25a00"); row(6, 17, 5, "#c25a00"); }
    if (ex.indexOf("catears") >= 0) { var CE = face.ears || "#2b2b2b"; rect(6, 0, 3, 3, CE); rect(15, 0, 3, 3, CE); p(7, 1, "#ff9ac0"); p(16, 1, "#ff9ac0"); }
    if (ex.indexOf("strawhat") >= 0) { rect(7, 1, 10, 3, "#e8c66a"); row(7, 16, 3, "#d62828"); row(3, 20, 4, "#e8c66a"); row(4, 19, 5, "#c9a64a"); }
    if (ex.indexOf("flower") >= 0) { p(17, 3, "#ff5fa2"); p(18, 2, "#ff5fa2"); p(18, 4, "#ff5fa2"); p(19, 3, "#ff5fa2"); p(18, 3, "#ffd21e"); }
    if (ex.indexOf("vampire") >= 0) { p(11, 13, "#ffffff"); p(13, 13, "#ffffff"); for (var vy = 13; vy <= 22; vy++) { p(3, vy, "#b0102a"); p(20, vy, "#b0102a"); } row(4, 19, 14, "#2b0b14"); }
    if (ex.indexOf("crown") >= 0) { var GD = "#ffd21e", GDD = "#d8a400"; row(7, 16, 3, GD); row(7, 16, 4, GDD); [7, 10, 13, 16].forEach(function (x) { p(x, 2, GD); p(x, 1, GD); }); p(11, 1, "#e0348a"); p(12, 1, "#e0348a"); p(11, 3, "#3d8bff"); }
    if (ex.indexOf("headphones") >= 0) { row(7, 16, 1, "#2b2b2b"); p(6, 2, "#2b2b2b"); p(17, 2, "#2b2b2b"); rect(4, 8, 2, 4, "#e0348a"); rect(18, 8, 2, 4, "#e0348a"); p(5, 3, "#2b2b2b"); p(18, 3, "#2b2b2b"); for (var hy2 = 4; hy2 < 8; hy2++) { p(5, hy2, "#2b2b2b"); p(18, hy2, "#2b2b2b"); } }
    if (ex.indexOf("cap") >= 0) { var CC = face.capc || "#1e4fd8"; rect(7, 1, 10, 4, CC); row(6, 17, 5, CC); row(2, 9, 6, mix(CC, "#000000", 0.25)); p(11, 2, "#ffffff"); }
    if (ex.indexOf("scarf") >= 0) { row(7, 16, 14, "#d22630"); row(6, 17, 15, "#d22630"); rect(14, 16, 2, 4, "#d22630"); p(14, 19, "#ffffff"); p(15, 19, "#ffffff"); }

    // ---------- outline: a dark 1-px rim around the silhouette ----------
    var img = q.getImageData(0, 0, W, H), d = img.data, out = q.createImageData(W, H), o = out.data;
    for (var i = 0; i < d.length; i++) o[i] = d[i];
    for (var y = 0; y < H; y++) for (var x = 0; x < W; x++) {
      var k = (y * W + x) * 4;
      if (d[k + 3] > 0) continue;
      var nb = (x > 0 && d[k - 1] > 0) || (x < W - 1 && d[k + 7] > 0) || (y > 0 && d[k - W * 4 + 3] > 0) || (y < H - 1 && d[k + W * 4 + 3] > 0);
      if (nb) { o[k] = 22; o[k + 1] = 20; o[k + 2] = 34; o[k + 3] = 235; }
    }
    q.putImageData(out, 0, 0);
    return c;
  }
  VB.Sprite = { make: make, W: W, H: H };
})(window.VB);
