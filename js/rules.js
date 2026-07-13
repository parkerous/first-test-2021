/* ============================================================
   Soai — League Rules. Editable, saved in your browser.
   Simple markdown-lite:  # Heading   ## Subheading   - bullet
   ============================================================ */

const RULES_KEY = "soai_rules_v1";

/* A generic starter template — REPLACE with your league's real rules. */
const DEFAULT_RULES = `# League Rules

## General
- Replace this text with your league's official rules.
- Click "Edit" to change it, then "Save".

## Match Format
- Sets are played to __ points (win by 2).
- A match is best of __ sets.

## Positions
- Setter, Outside, Opposite, Middle, Libero.
- Each team fields the standard 6 players.

## Conduct
- Be respectful to all players and staff.
- No cheating, exploiting, or smurfing.

## Ranking Criteria
- How players earn their tier (S/A/B/C/D) in the rankings.
- Who decides rankings and how often they update.`;

function load() { return localStorage.getItem(RULES_KEY) || DEFAULT_RULES; }
function saveText(t) { localStorage.setItem(RULES_KEY, t); }
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

let editing = false;
function render() {
  const view = document.getElementById("view");
  const edit = document.getElementById("edit");
  const btn = document.getElementById("editBtn");
  if (editing) {
    edit.value = load();
    edit.style.display = "block"; view.style.display = "none";
    btn.textContent = "💾 Save";
  } else {
    view.innerHTML = mdToHtml(load());
    edit.style.display = "none"; view.style.display = "block";
    btn.textContent = "✏️ Edit";
  }
}
function toggleEdit() {
  if (editing) { saveText(document.getElementById("edit").value); }
  editing = !editing;
  render();
}
function resetRules() { if (confirm("Reset the rules to the blank template?")) { saveText(DEFAULT_RULES); editing = false; render(); } }

function init() {
  document.getElementById("editBtn").addEventListener("click", toggleEdit);
  document.getElementById("resetBtn").addEventListener("click", resetRules);
  render();
}
document.addEventListener("DOMContentLoaded", init);
