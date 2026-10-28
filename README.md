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
- Bright VNL-style pixel volleyball: blue court, Mikasa-style ball, pixel
  crowd, net with antennas and a referee on the stand.
- **Tournament mode**: 8 teams, two pools of round robin, then semifinals
  and a final. Other matches are simulated from real-world strength;
  your tournament resumes after a page reload. Trophies are counted.
- Rosters homage each nation's stars; every team has **2 star players**
  with specials (SUPER SPIKE / SUPER BLOCK / SUPER RECEIVE / SETTER DUMP).
- Two ways to play: **FULL TEAM** (you make every call) or **ONE ROLE**
  (you're locked to one player for the whole tournament; AI teammates do
  the rest). As a setter you call sets; as a hitter you call for the ball
  and aim your own spikes; as a front-row blocker you choose the lean on
  slow sets; you serve, pass and dig whenever the ball comes to you.
- Block reads: blockers commit cross or line; slow sets are readable.
- Proper 5-1 rotations; call the set by hitter AND ball type; the ball
  slows down while you decide; live play-by-play commentary feed.
- ~5-10% flat shank chance on receives and digs (halved for SUPER RECEIVE).
- W-L record + trophies persist locally (`retroVNL.record`, `retroVNL.cups`).

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
