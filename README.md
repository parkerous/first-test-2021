# 🕹️ Pixel Arcade

A retro arcade of mini-games with a shared top menu — neon phosphor-green
graphics, CRT scanlines, and scores saved locally in your browser via
`localStorage`. Pure HTML/CSS/JS, no build step, no server.

## Games

### 🐍 Snake (`snake.html`)
- Smooth, slithering snake with a tapered body, scales, eyes, and a flicking
  tongue — eats apples, not squares.
- **WASD** or arrow keys to move, `Space` to start, `P` to pause.
- +10 points per apple, speeds up as it grows.
- High score persists locally (`retroSnake.highScore`).
- Touch: on-screen D-pad + swipe.

### 🌍 Geo Guess (`geo.html`)
- GeoGuessr-style: read a clue, drop a pin on the neon world map.
- **2-player head-to-head on the same device** — pins stay secret until both
  have guessed, then the true location is revealed with distances.
- **60 locations** across every continent (yes, including Antarctica).
- 5 rounds, up to 1000 pts each (closer = more points, <50 km = perfect).
- Best run persists locally (`retroGeo.best`).

### 💘 Starlight Crush (`crush.html`)
- Rom-com otome-style visual novel set in the arcade, with two lead girls:
  Mika (hot-headed arcade champ) and Juno (deadpan synthwave DJ).
- Decision-based branching story — choices earn affection hearts and steer
  the plot across training, a blackout, and the big tournament.
- **4 endings** (two romance routes, a friendship ending, and a secret one);
  unlocked endings persist locally (`retroCrush.endings`).

### 🏐 VNL Volley (`volley.html`)
- Bird's-eye pixel-art volleyball vs real national teams — difficulty scales
  with their real-world VNL strength (Poland ★★★★★ ... Korea ★).
- Rosters are an arcade homage to each nation's stars (Leon, Kurek,
  Giannelli, Ishikawa, N'Gapeth...), each with a randomly generated pixel
  face/sprite in their kit colors — see them in the roster panel.
- Proper **5-1 rotations**: P1–P6 slots, side-out rotations, the server is
  whoever is in P1, and your set menu follows the front row (when your
  opposite is back-row, MEDIUM becomes the PIPE).
- The ball **slows down while you decide** (bullet-time sets, aims, digs),
  and its shadow shrinks as it rises so you can read the height.
- Choose float or topspin serves, call quick / slide / medium / high sets,
  click exactly where to send every ball — aim for the gaps. Timing-bar
  receives and digs sweep faster against better teams. A pixel crowd
  bounces when a point drops.
- First to 15, win by 2; win-loss record persists locally (`retroVNL.record`).

### Menu (`index.html`)
The arcade hub — a top menu bar on every page plus game cards showing your
saved scores. Add more games by dropping in a new page and a new card.

## ▶️ Play locally

Open `index.html` in any modern browser — double-click it, done.

## 🚀 Deploy to Netlify

### Option A — Drag & drop (fastest)
1. Go to <https://app.netlify.com/drop>.
2. Drag this whole folder onto the page.
3. Live URL in seconds.

### Option B — Connect the Git repo
Import the repo in Netlify and set the base/publish directory to `snake`.
No build command needed — `netlify.toml` is already configured.
