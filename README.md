# 🏐 VNL Volley

A bird's-eye, pixel-art volleyball game in the style of the Volleyball
Nations League. Pure HTML/CSS/JS: no build step, no server.

## Play

Open `index.html` in a browser, or visit the Netlify site.

- **Tournament mode**: 8 teams, two round-robin pools, then semifinals and a
  final. Other matches are simulated from real-world team strength, and a
  page reload resumes your tournament.
- **Two ways to play**: FULL TEAM (you make every call) or ONE ROLE (you're
  locked to one player, including the libero, and AI teammates do the rest).
- **Real volleyball movement**: proper 5-1 rotations; on every serve the
  setter releases to the target between positions 2 and 3, the passer moves
  under the ball, hitters approach, and blockers slide to the attacker.
- **Libero** in a different-coloured shirt replaces the back-row middle and
  passes with both outside hitters.
- **Star players** with specials (super spike, super block, super receive,
  setter dump), block reads (cross vs line), ~7% shank chance on any
  receive or dig, and a live play-by-play commentary feed.
- Rosters are an arcade homage to real national teams.
- W-L record, trophies and the current tournament are saved in the browser
  (`retroVNL.record`, `retroVNL.cups`, `retroVNL.tour`).

## Deploy to Netlify

The repo root is the site. In Netlify, leave **Base directory** empty and
**Publish directory** as `.`; there is no build command. `netlify.toml`
also redirects the old arcade page URLs to the game.
