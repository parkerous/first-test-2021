# 🏐 VNL Volley

A bird's-eye, pixel-art volleyball game with two modes. Pure HTML/CSS/JS: no
build step, no server.

## 🤝 Co-op (online, two players) — Player Career and Haikyuu!! Story
- In PLAYER CAREER or HAIKYUU!! STORY MODE press 🤝 CO-OP and send your friend
  the link. In story mode they transfer into your school as a first-year in
  your year (same position rules), both of you start every story match, and
  P2 grows from their own ratings; the youth camp and the timeskip stay solo. When you're
  both online at the same time, they join YOUR career as a second player on
  your club: they pick a name, position (not your setter/opposite/libero
  spot) and look, and both of you start every match.
- The host's browser runs the career and the matches; the guest sees a live
  mirror of the hub, the host's dialogs and the court, and controls their own
  player (P2): serve choice and aim, receive and dig timing, set calls, spikes,
  tips and wipes, block lean and block timing (you both time your block jumps
  at the same moment). P2 picks their own training focus and grows from their
  own match rating.
- If P2 doesn't answer in time or drops out, the match carries on with a
  default choice; offline, P2's player plays as an AI teammate. The save lives
  on the host's device; the same link works again next time.
- Online it connects browser-to-browser (WebRTC via the free public PeerJS
  service, loaded from unpkg/cdnjs). A few strict networks block that. Two
  tabs or windows on the same computer connect without the internet.

## Home screen
- The menu sits under a live PRACTICE COURT: your story school, your career
  club or a Haikyuu!! team running a spiking line off the setter, pepper,
  serves and dig drills, with shouts and catchphrases (tap a player). ◀ ▶ picks
  which team is practising.
- VNL and Haikyuu!! Spring Nationals share one 🏆 TOURNAMENTS card.

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
- 3 save slots. Pick any of 24 schools — the 16 tournament schools plus
  Ohgiminami, Tokonami and Shinzen and five original schools from around Japan
  (Kouzan Tech, Hokuyo, Saikai, Tenryu, Akane Academy) — your position, build,
  hair and skin, then join as a first-year (OVR ~10 below the team).
- Dialogue in the characters' own voices: each school has its motto and its
  coach's April speech (Ukai, Nekomata, Irihata, Washijo, Oiwake...), a team
  HUDDLE before big matches, rivals with their own taunts, reactions and
  goodbyes (Kageyama, Oikawa, Ushijima, Atsumu, Kuroo, Bokuto, Tendo, Aone...),
  and teammates who talk like themselves when you hang out. A fan homage:
  paraphrased lines and a few famous catchphrases.
- Each year: April intro → practice match → Golden Week drills → Interhigh
  qualifiers (+ simulated nationals) → Tokyo summer camp (extra practice with
  Bokuto, Kuroo, Akaashi, Kenma, Yaku or Komi, who can teach you a named move)
  → Spring qualifiers → Spring Nationals (5 knockout rounds).
- Mid-year and year-end player evaluations: every teammate's OVR, change and
  grade (S-D). Random events (night practice, exams, rival sightings, fan
  letters, festivals, serve challenges...) keep each year different.
- Change your look any time (also in Club Career).
- A personal RIVAL (a canon player from a rival school) with scenes before
  matches against them: challenge them, stay focused or ask for advice — each
  pays off differently. When they graduate, a new rival steps up.
- CONFIDENCE (0-100) rises and falls with ratings, wins, rival moments and
  friendships. It slightly widens or narrows your timing window and nudges the
  coach's selection — a small factor, never a big one.
- HANG OUT with any teammate at any school once per stretch of the season:
  canon characters have their own lines; bonds build confidence, and a bonded
  setter gives you a little lift in matches.
- You play only yourself. The coach starts the best players, weighted by coach
  trust: good matches, drills and pinch serves raise it. Benched? You still
  get a pinch-serve moment.
- Third-years graduate (rivals too: Oikawa, Ushijima and Bokuto leave after
  year 1), first-years arrive and teammates improve. A captaincy is possible in
  year 3, and an ending depends on your final OVR and trophies.
- 📰 A NEWSPAPER every other week (each story step is about a week): the
  hottest games around the country, not just yours — upsets, comebacks from a
  set down, deuce thrillers and routs, with the star of each match, other
  results and a box on your own school. Old issues live in the NEWS tab.
- 🇯🇵 ALL-JAPAN YOUTH CAMP every December (good enough? about OVR 70): pair
  drills with a star of your choice (Sakusa, Atsumu, Hoshiumi, Kageyama,
  Hyakuzawa, Komori, Goshiki, Lev, Hinata...), a dorm night, the coaches'
  gauntlet and a playable CAMP RED vs CAMP WHITE scrimmage that can earn a
  U-19 JAPAN selection. Not invited? Sneak in as a ball boy or go to the
  prefecture rookie camp.
- ⏩ TIMESKIP after graduation: five years later you sign for the MSBY BLACK
  JACKALS or the SCHWEIDEN ADLERS, pick two reunions (beach volley in Rio with
  Hinata, Onigiri Miya, Kenma's sponsor shoot, your old gym, a national team
  tryout), do pre-season training, then play the best-of-3 V.League opener,
  Jackals vs Adlers, with the timeskip cast. Finished stories get the
  timeskip too.
- Training MINIGAMES with variety — each drill picks one that fits the skill:
  timing bar, serve/spike TARGET, REACTION dives, MEMORY of setter calls,
  READ THE SETTER, approach RHYTHM, receive PLATFORM, hold-and-release POWER and
  a SPRINT tap drill.

### 🎴 Gacha & Showroom (Haikyuu!!)
- 500 free pulls to start. Every match pays: a win = 10 pulls, a loss = 5 pulls
  (any mode), plus story events and a daily gift. Pull ×1 (100) or ×10 (900).
- Pull ×1, ×10 or ×100 (a summary with a rarity tally, rarest first).
- Rarities: Common, Rare, Epic, Legendary, Mythic. Limited variants include
  Christmas Bokuto/Nishinoya/Hinata/Kenma and Festival Oikawa (Legendary),
  Halloween (Witch Kenma, Vampire Kuroo, Guess Monster Tendo, Black Cat Lev,
  Vampire Tsukishima, Pumpkin Hinata) and Summer (Hinata, Nishinoya, Oikawa,
  Bokuto, Tanaka, Atsumu, Osamu) outfits, and
  the whole timeskip cast: Mythic Ninja Shoyo, Kageyama, Bokuto, Oikawa and
  Ushijima; Legendary Atsumu, Sakusa, Hoshiumi, Kenma, Kuroo, Tsukishima,
  Nishinoya, Azumane, Tanaka, Sawamura, Sugawara, Iwaizumi, Akaashi, Osamu, Yaku
  and Lev. Mythic odds: 0.05%.
- Choose your BANNER (no daily rotation): MSBY Black Jackals, Schweiden Adlers,
  King & Grand King, Nekoma Cats, Christmas, Halloween Night, Summer Beach,
  Karasuno Forever or Standard. Rate-up 50/50 with a guarantee that carries over,
  Epic+ every 10 pulls, Legendary by 60, Mythic by 1000. Duplicates level a card
  (C1-C6).
- SKINS: own a special version of a character? Equip it in the SKINS tab and it
  shows up in Haikyuu!! matches, story mode, the practice court and the
  classroom (e.g. Witch Kenma playing for Nekoma).
- Spike reveal animation (the trail colour shows the rarity) — skippable.
- Showroom: a classroom (chalkboard, whiteboard, ball cart, broom, clock,
  plant) where up to 8 cards live; the rest wait in storage. They pick things
  to do on their own — pass a ball, spike from the cart, sweep, write on the
  whiteboard, read, nap, dance, chat, say their catchphrase — or tap one and
  choose an action. One-tap BEST 8 / NEWEST 8 / RANDOM 8 / EMPTY ROOM, and a
  full room swaps automatically with the selected student.

### 🏅 Award ceremonies
- Tournaments and club seasons end with a podium (gold, silver, bronze teams),
  confetti and a trophy, then each award presented in a spotlight with a medal.
- Story mode: a team awards night every year (Team MVP, Most Improved, Rookie of
  the Year, Fighting Spirit) and a podium when you win Spring Nationals.

### 🏟️ Player Career (8 leagues: 🇮🇹 SuperLega, 🇯🇵 SV.League, 🇵🇱 PlusLiga, 🇹🇷 Efeler Ligi, 🇧🇷 Superliga, 🇫🇷 Ligue A, 🇩🇪 Bundesliga, 🇰🇷 V-League)
- ACADEMY YEARS (ages 14-18): five choices, no matches — where you start,
  your growth-spurt summer, youth national trials, which country's academy you
  join (decides your first league) and your pathway: sign pro at 18, university
  first (pro at 21) or a pro academy contract.
- Choose your exact HEIGHT (taller = more reach and block, less jump and speed)
  and one of 18 position-specific ARCHETYPES (e.g. Six-Rotation All-Rounder,
  Reception Anchor, Quick Attacker, Read Blocker, Tempo Setter, Jump Setter &
  Dumper, Power Opposite, Back-Row Cannon, Defensive Wall, Floor General, Pure
  Athlete), each with strengths, a weakness and faster-growing attributes.
- FIFA-style: earn XP from matches and weekly training drills, level up and spend
  skill points, and chase three manager objectives each season (they raise your
  manager rating, which earns more starts, salary and coins).
- Eight leagues of 10 clubs, each with a big-money SUPERCLUB to measure yourself
  against (Cisterna, Voreas Hokkaido, Bogdanka Lublin, Borusan Istanbul,
  Taubate, Lyon, Hamburg, Hanwha Eagles); 9 league rounds a season. Older
  saves get the new clubs from the next season.
- Season calendar: league + playoffs → CLUB WORLD CUP (the eight league
  champions) → summer VNL with your national team if you're good enough (starter
  or squad player) → next season.
- Retire from 33 (forced at 35) and become a HEAD COACH: coaching offers based on
  your legacy, full-team matches, a transfer market where fees follow OVR and
  age, wages vs budget, selling players, and a board that sets targets and can
  sack you.
- Trophy cabinet with counters (e.g. SV.LEAGUE CHAMPION ×5) for trophies,
  individual awards and coaching titles.
- 3 save slots. Create a player: name, nationality, position (setter, outside,
  middle, opposite, libero) and build (tower, balanced, jumper).
- You control only yourself; coaches pick lineups from form and ratings.
- Seasons: pre-season window → 3 rounds → mid-season window → 6 rounds →
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
- Tournaments: a random pool draw every time; semifinals and finals are best of
  3 sets (story-mode semis and finals too).
- Floors: VNL yellow & blue, orange Taraflex, wooden school gym or team-colour
  arena (COURT FLOOR button on the menu; AUTO picks by competition). Fans hold
  banners behind a thick barrier rail, and jerseys have trims, sashes, stripes
  or panels.
- Home crowd chants when the home team serves (team name, NICE SERVE / NAISSA,
  the server's name, ACE ACE ACE, LET'S GO, team slogans like FLY, and ONE MORE
  POINT on set point).
- 🧠 TACTICS (pauses the match, saved between matches): READ or GUESS block,
  TAKE LINE or TAKE CROSS (leave the line open), 5-1 or 4-2 rotation (in a 4-2
  the front-row opposite sets when the setter is back row), and in one-player
  mode whether the setter asks you, feeds you automatically or decides alone.
- Shanks come in flavours: into the stands, off the face, off the roof, into the
  referee's stand, off the shoulder with a teammate chasing, or a collision.
- The court fits the screen and the timing bar sits with the decision buttons
  in a YOUR MOVE panel beside it (a bottom dock on phones).
- Setter menu: up to four plain options (QUICK / OUTSIDE / RIGHT SIDE / BACK
  ROW → hitter) with the setter's 👍 pick; MORE CALLS opens the full playbook.
- Ratings scale: elite pros sit around 80-85 OVR, high schoolers below that.
- Attributes include MENTAL (composure in tight moments), TECHNIQUE (cleaner
  contacts: fewer shanks, better sets) and SPEED (players reach balls sooner,
  better passes, fewer desperate dives; tall players are a step slower).
- Signature ★ moves are real weapons now (much bigger effects, a banner and a
  flash); the attribute bonus stars carry is their passive side power.
- Shanks are realistic: mostly into the stands or off the shoulder, rarely
  anything stranger.
- Every match starts with a choice: ▶ PLAY or ⏩ QUICK SIM (instant result, about
  5-10% lower win chance without you calling the shots).
- 15 realistic haircuts (buzz, crew, side part, fringe, middle part, undercut,
  textured crop, curls, afro, slicked back, bun, wavy, braids, classic, bald)
  plus stubble/beards for everyday players; anime hair stays with the famous
  faces (and Bokuto's OWL is in the look editor).
- No rubber-banding: team class matters (a strong team beats a weak one more
  often and more clearly) and scoring runs build MOMENTUM until a TIMEOUT.
- Drama banners: SET POINT / MATCH POINT / DEUCE, 3-0 RUNS and ON FIRE streaks,
  TIMEOUTS with coach talk, COMEBACKS, WHAT A RALLY! (3+ digs, standing ovation)
  and VIDEO CHALLENGES on balls near the line (sometimes overturned).
- 🎤 Press: big matches start with a press conference and good/bad/big games end
  with an interview (story mode and player career). Answer HUMBLE, CONFIDENT,
  FIERY or TEAM FIRST — each changes confidence, coach trust, manager rating,
  fame or friendships, and fiery talk raises the stakes of the next result.
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
- Timing bar speed is an OVR duel: the hitter's attack (or the server's serve)
  vs your player's dig (or receive). A star hitter vs a weak passer is ⚡ FAST,
  the reverse is 🐢 SLOW; star skills and flow state speed it up.
- Timing bar: a steady marker judged on what you see (screen/input lag is
  forgiven). GOOD is fair; PERFECT is a narrow band. The green zone shrinks for
  harder serves and attacks and grows when your player out-rates the hitter.
- The block is a wall: blockers line up in position order, hand to hand, at
  the same depth, and slide together (they never pass through each other).
  A block leaning LINE seals the line; leaning CROSS gives the line away, so
  pin hitters can punish it straight down the line. A triple block shuts most
  deep cross swings; only sharp, short angles get around it, and those miss
  more often.

## Camera & impact
- Switch the camera any time: the 🎥 button above the court (it shows the
  current view), the C key mid-match, the 🎥 button on the MATCH DAY screen,
  the story and career hubs, or CAMERA on the menu. It cycles CLASSIC (top-down),
  BROADCAST (experimental: a zoomed TV camera far behind your team, so both
  teams look about the same size) and HIGH
  (experimental: steep, close behind the baseline). The experimental views use
  a bigger player model with a contact shadow and team rim; aiming works by
  clicking the floor in any view.
- Boom jumps: big spikes, blocks and wipes kick up a shockwave and dust (orange
  when the player is in flow or firing a star skill). Kills, stuffs and aces
  shake the screen, with a short hit-stop freeze on the hardest hits, and hot
  spikes leave a trail of embers.

## Files
`index.html` (layout) · `style.css` · `js/data.js` (teams, clubs, players) ·
`js/haikyuu.js` (Spring Nationals teams) · `js/ui.js` · `js/stats.js` (box scores, sims, awards) · `js/engine.js` (match
engine + arena) · `js/vnl.js` (tournaments) · `js/story.js` (Haikyuu story) · `js/hqvoice.js` (story dialogue) · `js/gacha.js` (gacha + showroom) · `js/ceremony.js` (award ceremonies) · `js/career.js` · `js/coop.js` (online co-op) · `js/minigames.js` (training minigames) · `js/practice.js` (home practice court) · `js/main.js` (menu).

## Deploy to Netlify
The repo root is the site. Leave **Base directory** empty and **Publish
directory** as `.`; there is no build command.
