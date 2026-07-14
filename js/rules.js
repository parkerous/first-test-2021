/* ============================================================
   Soai — League Rules. Editable, saved in your browser.
   Simple markdown-lite:  # Heading   ## Subheading   - bullet
   ============================================================ */

const RULES_KEY = "soai_rules_v2";

/* Binsu Volleyball League — official rule book. */
const DEFAULT_RULES = `# 📖 Article I — General Rules

## 1.1 League Authority
- The Binsu Volleyball League is an organized competitive mini-league within Roblox.
- All players must follow the official league rules during matches.

## 1.2 Sportsmanship
- Respect all players and officials.
- No toxic behavior or trash talk.
- No exploiting or cheating.
- Follow admin / referee decisions.
- Failure to comply may result in warnings, point penalties, or disqualification.

# 🏐 Article II — Match Format

## 2.1 Team Composition
- Standard format: 6 vs 6.
- Minimum players required to start: 5 per team.
- Substitutions are allowed between rallies.

## 2.2 Set Format
- Matches are best of 3 sets.
- Each set is played to 25 points (win by 2).
- The deciding set (Set 3) is played to 25 points (win by 2).
- Server advantage: the team with the most total points across the first two sets serves first in Set 3 (used for Asia vs Oce).
- Example: Set 1 (25–21 Asia), Set 2 (25–23 Oce) → Asia total 48, Oce 46, so Asia gets the serve.

# 🎯 Article III — Serve Rules

## 3.1 Legal Serve
- The server must stand behind the end line.
- The ball must cross the net legally.
- No glitch serves, exploit mechanics, or "bullet" serves.
- Line-fault rules apply.

## 3.2 First Rally Rule (Important)
- No first-ball attack: after the serve, the receiving team cannot attack (spike) the ball on the first contact.
- A violation awards the point to the serving team.

# 🔄 Article IV — Rally Rules

## 4.1 Three-Touch Rule
- Each team may use up to 3 contacts before sending the ball over the net.

## 4.2 Net Violations
- No touching the net during play.
- No crossing under the net to interfere.

## 4.3 Rotation
- Follow the pads.

# 🚨 Article V — Violations
- Double contact.
- Out-of-bounds hit.
- First-ball attack after the serve.
- Unsportsmanlike conduct.
- The referee's decision is final.

# 🏆 Article VI — Officials
- Match Host — the game controller.
- Referee — the rule enforcer.
- League Admin — the final authority.

# ⏱️ Article VII — Set Interval Rule

## 7.1 Grace Period Between Sets
- Teams must start the next set within a maximum of 2 minutes.
- Delay beyond this time may result in an automatic set forfeit (Set FF).

# 🧥 Article VIII — Avatar & Uniform Standards

## 8.1 Required Body Type
- Strictly R6 blocky: all players must use the standard R6 blocky rig.
- No packages: 3D body packages (Man, Woman, etc.) are strictly prohibited.

## 8.2 Uniform Color & Visibility
- No single-colored avatars: "void" or monochrome avatars (all-black, all-white, etc.) are forbidden.
- Contrast requirement: outfits must have a clear visual distinction between the shirt and pants.

# ✨ Article IX — Cosmetic & Animation Rules

## 9.1 Aerial Animations (League Only)
- Allowed: only Aerial Animation packs 1 through 4.
- Prohibited: Aerial Animation Pack 5 is strictly banned in official league matches.

## 9.2 Ball Skins
- Standard league-approved ball skins must be used.
- In league play, ball trails must be disabled.`;

function esc(s) { return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }

/* markdown-lite -> HTML */
function mdToHtml(text) {
  const lines = text.split("\n");
  let html = "", inList = false;
  const closeList = () => { if (inList) { html += "</ul>"; inList = false; } };
  for (const raw of lines) {
    const line = raw.trimEnd();
    if (/^#\s+/.test(line)) { closeList(); html += "<h2>" + esc(line.replace(/^#\s+/, "")) + "</h2>"; }
    else if (/^##\s+/.test(line)) { closeList(); html += "<h3>" + esc(line.replace(/^##\s+/, "")) + "</h3>"; }
    else if (/^[-*]\s+/.test(line)) { if (!inList) { html += "<ul>"; inList = true; } html += "<li>" + esc(line.replace(/^[-*]\s+/, "")) + "</li>"; }
    else if (line === "") { closeList(); }
    else { closeList(); html += "<p>" + esc(line) + "</p>"; }
  }
  closeList();
  return html;
}

/* Render the official rule book. Pull the admin-published text from the
   backend; fall back to the built-in default when the backend is empty
   or unreachable. */
async function renderRules() {
  const view = document.getElementById("view");
  if (!view) return;
  let text = DEFAULT_RULES;
  try {
    const r = await apiGet("/rules");
    if (r && typeof r.text === "string" && r.text.trim()) text = r.text;
  } catch (_) { /* offline / not configured — show the default book */ }
  view.innerHTML = mdToHtml(text);
}

/* Wire the "Suggest a rule" form -> POST /rules/suggest */
function initSuggest() {
  const btn = document.getElementById("sgBtn");
  const txtEl = document.getElementById("sgText");
  const nameEl = document.getElementById("sgName");
  const msg = document.getElementById("sgMsg");
  if (!btn) return;
  btn.addEventListener("click", async () => {
    const text = (txtEl.value || "").trim();
    if (!text) { msg.textContent = "Please write your rule idea first."; return; }
    btn.disabled = true; msg.textContent = "Sending…";
    try {
      const res = await apiPost("/rules/suggest", { name: (nameEl.value || "").trim(), text });
      if (res && res.ok) {
        txtEl.value = ""; nameEl.value = "";
        msg.textContent = "Thanks! Your suggestion was sent to the admins. ✅";
      } else {
        msg.textContent = (res && res.error) || "Couldn't send — please try again.";
      }
    } catch (_) {
      msg.textContent = "Couldn't reach the server — please try again later.";
    } finally { btn.disabled = false; }
  });
}

function init() {
  renderRules();
  initSuggest();
}
document.addEventListener("DOMContentLoaded", init);
