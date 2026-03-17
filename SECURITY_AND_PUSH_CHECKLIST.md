# Security & push checklist (GitHub distro)

Use this before pushing **lazerclaw-github** to a public GitHub repo.

## ✅ Secrets & env

- **No real secrets in repo:** All API keys and secrets are read from environment variables (`JWT_SECRET`, `ANTHROPIC_API_KEY`, `NANO_BANANA_API_KEY`, `ADMIN_*`, etc.). None are hardcoded.
- **`.env` is gitignored** (and `.env.local`, `.env.production`). Do not commit any `.env` file.
- **`.env.example`** contains only placeholders (`change-me`, empty values). Safe to commit.
- **Vercel:** `.vercelignore` excludes `.env`, `.env.local`, `.env.production`, `secrets.md`, `*.secret` from deploy.

## ⚠️ Before deploying to production

1. **Set `JWT_SECRET`** in Vercel (or your host). The code has a dev fallback (`dtool-dev-secret-change-me`) so the app runs locally without env; **never rely on that in production** or auth will be weak.
2. Set `ANTHROPIC_API_KEY` and `NANO_BANANA_API_KEY` if you use AI features.
3. Set admin env vars (`ADMIN_EMAIL`, `ADMIN_PASSWORD_HASH`, `VITE_ADMIN_EMAIL`, `VITE_ADMIN_PASSWORD`) per `.env.example`.

## 🔗 Identifiers in the repo (optional to change)

- **README** clone URL: update `git clone https://github.com/YOUR_USERNAME/lazerclaw.git` to your actual repo after you push.
- **lazerclaw.com** appears in `index.html` (canonical, og:url, og:image) and in `AuthGate.jsx` (`guest@lazerclaw.com`). If you want a generic “template” repo, you can replace these with placeholders (e.g. `https://your-app.vercel.app`, `guest@example.com`). If this is your live app’s repo, leaving lazerclaw.com is fine.

## Summary

- **Safe to push:** No API keys, no real passwords, no `.env` in the tree.
- **Production:** Always set `JWT_SECRET` (and other env) on the host; do not rely on the in-code dev fallback.
