# 🐍 Retro Snake

A retro arcade-style Snake game — neon phosphor-green graphics, CRT scanlines,
**WASD** (or arrow-key) controls, and a points system that's saved locally in
your browser so your high score survives between sessions.

## ▶️ Play it

Just open `index.html` in any modern browser — no server, no build step, no
install. Double-click the file, or drag it into a browser tab.

### Controls

| Key | Action |
| --- | --- |
| `W` `A` `S` `D` | Move up / left / down / right |
| Arrow keys | Also move (same as WASD) |
| `Space` | Start the game |
| `P` | Pause / resume |

On phones/tablets you get an on-screen D-pad, and you can also swipe on the
board to steer.

### Points system

- Each pellet eaten = **+10 points**.
- The snake speeds up a little every time it eats.
- Your **high score is stored locally** in the browser via `localStorage`
  (key: `retroSnake.highScore`) — it stays even after you close the tab.
- Use **RESET HI-SCORE** at the bottom to clear it.

## 🚀 Upload to Netlify

This folder is a complete, self-contained static site. Two easy ways to deploy:

### Option A — Drag & drop (fastest)
1. Go to <https://app.netlify.com/drop>.
2. Drag this whole `snake` folder onto the page.
3. Netlify gives you a live URL in seconds. Done.

### Option B — Connect the Git repo
1. In Netlify: **Add new site → Import an existing project** and pick this repo.
2. Set **Base directory** to `snake` (or **Publish directory** to `snake` if
   deploying from the repo root).
3. No build command is needed — it's plain HTML/CSS/JS.

The included `netlify.toml` already tells Netlify to publish the folder as-is
with no build step.

---

Everything lives in a single `index.html` (HTML + CSS + JavaScript inline), so
it's trivial to copy, host anywhere, or tweak.
