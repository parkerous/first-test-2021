# Deploy the shared backend (Cloudflare Worker)

The site works with **no server** out of the box — data is stored in each
visitor's browser. Deploy this **one Cloudflare Worker** when you want every
visitor to share the same teams, coaches, announcements, rules, and preseason
scrim standings.

The Worker serves **both** the website and the API from one place
(`api-worker.js` + `wrangler.toml`). Once it's live, the site it serves
automatically uses the shared storage — no code edits needed.

You only do this once. You need a free Cloudflare account.

---

## Option A — Deploy from the CLI (fastest)

1. **Install Wrangler and log in** (opens your browser to authorize):
   ```
   npm install -g wrangler
   wrangler login
   ```

2. **Create the shared storage (KV namespace):**
   ```
   wrangler kv namespace create SOAI
   ```
   It prints an `id`. Open **`wrangler.toml`** and replace the `id` under
   `[[kv_namespaces]]` with the one it printed:
   ```toml
   [[kv_namespaces]]
   binding = "SOAI"
   id = "PASTE_THE_ID_HERE"
   ```
   *(If the id already in the file still exists in your account, you can skip
   this — but if the old backend was deleted, create a fresh one as above.)*

3. **Set your admin password** (stored as a private Cloudflare secret, never in
   the code). This is what you type to log into the Admin panel:
   ```
   wrangler secret put ADMIN_KEY
   ```
   Type your password when prompted. If you skip this, the default is `64928`.

4. **Deploy:**
   ```
   npx wrangler deploy
   ```
   It prints a URL like `https://first-test-2021.YOURNAME.workers.dev`.

5. **Open that URL.** The site is served by the Worker, so it uses the shared
   storage automatically. Log into `/admin.html` and add teams/coaches/scrims —
   every visitor now sees the same data.

---

## Option B — Deploy from the Cloudflare dashboard (no terminal)

1. Go to **Cloudflare dashboard → Workers & Pages → Create → Workers → Connect
   to Git**, and pick this repository.
2. Set the **Deploy command** to:
   ```
   npx wrangler deploy
   ```
3. In **Settings → Variables and Secrets**, add a secret **`ADMIN_KEY`** with
   your admin password (optional; default is `64928`).
4. Make sure a **KV namespace** named/bound as **`SOAI`** exists and its `id` is
   in `wrangler.toml` (create one under **Workers & Pages → KV** if needed).
5. Deploy. Cloudflare gives you the `*.workers.dev` URL — open it and use the
   site as above.

---

## Using the shared backend from another host (e.g. Netlify)

If you also serve the site somewhere static (like Netlify) and want that copy
to use the shared data too:

1. Open **`/admin.html`** on that site.
2. Expand **"Advanced: connect a shared backend"**.
3. Paste your Worker URL (`https://first-test-2021.YOURNAME.workers.dev`) and log
   in. That copy now reads/writes the shared storage.

---

## Notes
- The admin password is stored as a Cloudflare **secret**, never in the code.
- Team and profile passwords are stored **hashed** (SHA-256).
- Images are stored as small auto-resized base64 in KV. For a very large league
  you'd move images to Cloudflare R2.
- Nothing to change in the site code after deploy — the site auto-detects that
  it's being served by the Worker and uses the shared storage.

## Discord slash command (/binsustar)

After the Worker is deployed:

1. Create an app at https://discord.com/developers/applications → copy the
   **Application ID** and **Public Key** (General Information) and the bot
   **Token** (Bot tab).
2. Site admin panel → Season 2 → Discord webhook → "Slash command" →
   paste all three → **Register /binsustar** (the token is used for that
   one call and never stored).
3. In the developer portal, set **Interactions Endpoint URL** to
   `https://<your-worker>/interactions` — Discord sends a test ping the
   Worker answers automatically.
4. Invite the app to the server (Installation → Guild Install link).

Members can then use `/binsustar`, `/binsustar topic:standings`,
`topic:schedule`, `topic:pickem` or `topic:leaders` anywhere in the server.

## Automatic Discord posts (no buttons needed)

With the Worker deployed, it can post to your webhook **by itself**:

- 📅 **Match-night hype** — ~1 hour before the night's first serve
- 🔮 **Pick'em reminder** — from 12:00 GMT+8 on match days
- 🏁 **Final scores** — the moment a result is saved in the admin panel

Setup:

1. Site admin panel → Season 2 → Discord webhook → **"Automatic posts"** →
   paste your webhook URL (+ optional role ID), tick what you want →
   **Save to Worker**. The webhook is stored only in the Worker's private
   KV — never in the repo or anyone's browser.
2. Cloudflare dashboard → your Worker → **Settings → Triggers →
   Add Cron Trigger** → schedule `0 * * * *` (hourly). Final-score posts
   don't need the cron; match-night and Pick'em posts do.
3. Done. KV markers guarantee each night is announced only once, even if
   the cron runs more often.

Saving an **empty** URL clears the config and stops all automatic posts.
If you also had "auto-post finals" enabled in the browser, the admin panel
turns it off for you when you enable Worker finals (no double posts).
