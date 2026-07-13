# Soai backend — 5-step setup (Cloudflare Workers, free)

This powers the slideshow announcements, team registration + admin approval,
and shared learning. It runs on Cloudflare's free tier.

You only do this once. You need a (free) Cloudflare account.

## Steps

1. **Install Wrangler** (Cloudflare's CLI) and log in:
   ```
   npm install -g wrangler
   wrangler login
   ```

2. **Go into this folder:**
   ```
   cd api
   ```

3. **Create the storage (KV namespace)** and copy the id it prints into `wrangler.toml`
   (replace `REPLACE_WITH_YOUR_KV_ID`):
   ```
   wrangler kv namespace create SOAI
   ```

4. **Admin password** — the default is **64928** (already baked in), so you can
   skip this step. To use your own private password instead, run:
   ```
   wrangler secret put ADMIN_KEY
   ```
   and type a strong password when prompted (this overrides 64928).

5. **Deploy:**
   ```
   wrangler deploy
   ```
   It prints a URL like `https://soai-api.YOURNAME.workers.dev`.

## Final step — connect the site
Open **`js/api.js`** and paste that URL into `SOAI_API`:
```js
const SOAI_API = "https://soai-api.YOURNAME.workers.dev";
```
Commit & redeploy the site. Done — the Teams page, Admin panel, announcements
slideshow, and shared learning are now live.

## Notes
- The admin password is stored as a Cloudflare **secret** (never in the site code).
- Team passwords are stored **hashed** (SHA-256), never in plain text.
- Team logos/jerseys are stored as small base64 images (auto-resized by the site
  before upload). For very large leagues you'd move images to Cloudflare R2.
