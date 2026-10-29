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

### 🏐🔥 Haikyuu!! Spring Nationals
- 16 high schools (Karasuno, Aoba Johsai, Shiratorizawa, Inarizaki, Nekoma,
  Fukurodani, Itachiyama, Kamomedai, Date Tech and more) in 4 pools, then
  quarterfinals, semifinals and a final, with awards.
- Famous players have named signature moves (KILLER SERVE, LEFTY CANNON,
  ROLLING THUNDER, IRON WALL, GUESS BLOCK, SMALL GIANT...), and Karasuno and
  Inarizaki have combo sets (FREAK QUICK, TWIN QUICK). A fan homage.

### 🏫 Haikyuu!! Story Mode
- 3 save slots. Pick any of the 16 schools, your position, build, hair and
  skin, then join as a first-year (OVR ~10 below the team).
- Each year: April intro → practice match → Golden Week drills → Interhigh
  qualifiers (+ simulated nationals) → Tokyo summer camp (extra practice with
  Bokuto, Kuroo, Akaashi, Kenma, Yaku or Komi, who can teach you a named move)
  → Spring qualifiers → Spring Nationals (5 knockout rounds).
- You play only yourself. The coach starts the best players, weighted by coach
  trust: good matches, drills and pinch serves raise it. Benched? You still
  get a pinch-serve moment.
- Third-years graduate (rivals too: Oikawa, Ushijima and Bokuto leave after
  year 1), first-years arrive and teammates improve. A captaincy is possible in
  year 3, and an ending depends on your final OVR and trophies.

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
- Training focus, match-rating-based growth (slow: only good matches grow you,
  and high attributes rise slowly) and a signature skill at OVR 78.

## Gameplay
- 5-1 rotations, libero swaps, home/base formations, perimeter defense.
- NCAA-style set calls: 1, 31 and slide for middles; 4 and Go for outsides;
  5 and Red for the opposite; pipe, bic and D from the back row.
- Height and vertical jump create spike reach vs block reach duels.
- Tools depend on the situation: pin hitters swinging line into the outside
  hand tool often, middle quicks rarely; pins can clip the antenna.
- Single/double/triple blocks, block reads, seams, tools, wipes, tips,
  one-touches, waterfalls, overpasses, joust battles, free balls, dolphin dives,
  no-touch kills, shanks; poor passes can land anywhere, and the libero sets
  when the setter can't get there.
- Every team has a playstyle (FAST TEMPO, POWER ATTACK, IRON WALL, ACE-CENTRIC,
  DEFENSIVE GRIND, SERVE & PRESSURE, CREATIVE, BALANCED) that shapes its set
  choices, tips, serves, blocking and defence.
- Famous players have recognisable pixel looks (hair style and colour, glasses,
  beards, streaks) and heights scale the sprites.
- Star skills with cooldowns, flow state (blue flames), float/topspin serves.
- Home arenas in the home team's colours with a crowd, boards and jumbotron.
- Rosters, heights and clubs are an arcade homage, not official data.

## Aiming, timing and the block
- While aiming a spike you see the path, the blockers' hands at the net and a
  label: CLEAR, SEAM, TOOL ZONE / BLOCK EDGE or INTO THE BLOCK. The ball goes
  where you click; only swings into the hands get blocked. On slow sets the
  block can still slide toward your shot; deep swings clear short blocks.
- One-player mode adds extra timing steps: serve toss, the setter's touch,
  the hitter's approach jump and the blocker's jump timing.
- Timing bar: a slow, steady marker. GOOD is fair; PERFECT is a narrow band. The green zone shrinks for
  harder serves and attacks and grows when your player out-rates the hitter.

## Files
`index.html` (layout) · `style.css` · `js/data.js` (teams, clubs, players) ·
`js/haikyuu.js` (Spring Nationals teams) · `js/ui.js` · `js/stats.js` (box scores, sims, awards) · `js/engine.js` (match
engine + arena) · `js/vnl.js` (tournaments) · `js/story.js` (Haikyuu story) · `js/career.js` · `js/main.js` (menu).

## Deploy to Netlify
The repo root is the site. Leave **Base directory** empty and **Publish
directory** as `.`; there is no build command.
