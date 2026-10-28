# 🏐 VNL Volley

A bird's-eye, pixel-art volleyball game with two modes. Pure HTML/CSS/JS: no
build step, no server.

## Modes

### 🌍 VNL Tournament
- 16 national teams; 8 enter a tournament: two round-robin pools, semifinals,
  final. Other matches are simulated, with full box scores.
- Control the FULL TEAM or lock in as ONE player (any position, incl. libero).
- Scoresheet after every match: points, kills/attempts, kill efficiency, aces,
  blocks, digs, assists, reception.
- Awards at the end: MVP, best setter, 2 best outside hitters, 2 best middle
  blockers, best opposite, best libero, plus top scorer / server / blocker /
  digger.

### 🏟️ Club Career (SuperLega 🇮🇹 + SV.League 🇯🇵)
- 3 save slots. Create a player: name, nationality, position (setter, outside,
  middle, opposite, libero) and build (tower, balanced, jumper).
- You control only yourself; coaches pick lineups from form and ratings.
- Seasons: pre-season window → 3 rounds → mid-season window → 4 rounds →
  playoffs → awards → ageing, retirements, academy players.
- Clubs have stories, coaches, budgets and season storylines. Coaches can bench
  you, release you (performance or budget) or trade you; other clubs make
  offers based on your form. AI players transfer, and fresh faces arrive from
  outside both leagues.
- Training focus, match-rating-based growth and a signature skill at OVR 78.

## Gameplay
- 5-1 rotations, libero swaps, home/base formations, perimeter defense.
- Height and vertical jump create spike reach vs block reach duels.
- Single/double/triple blocks, block reads, seams, tools, wipes, tips,
  one-touches, waterfalls, overpasses, joust battles, free balls, dolphin dives,
  no-touch kills, shanks; poor passes can land anywhere, and the libero sets
  when the setter can't get there.
- Star skills with cooldowns, flow state (blue flames), float/topspin serves.
- Home arenas in the home team's colours with a crowd, boards and jumbotron.
- Rosters, heights and clubs are an arcade homage, not official data.

## Files
`index.html` (layout) · `style.css` · `js/data.js` (teams, clubs, players) ·
`js/ui.js` · `js/stats.js` (box scores, sims, awards) · `js/engine.js` (match
engine + arena) · `js/vnl.js` · `js/career.js` · `js/main.js` (menu).

## Deploy to Netlify
The repo root is the site. Leave **Base directory** empty and **Publish
directory** as `.`; there is no build command.
