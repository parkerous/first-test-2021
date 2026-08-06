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
- **1–4 players pass-and-play on the same device** — pins stay secret until
  everyone has guessed, then the true location is revealed with distances.
- 5 rounds, up to 1000 pts each (closer = more points, <50 km = perfect).
- Best run persists locally (`retroGeo.best`).

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
