# Deploy Frontend to Netlify (Step-by-Step)

This guide walks you through deploying the **LegalGraph Lease Forecaster** React frontend on **Netlify**. Follow the steps in order.

---

## Prerequisites

- **Netlify account** – [Sign up free](https://www.netlify.com/signup/)
- **Git** – Your code in a Git repository (GitHub, GitLab, or Bitbucket)
- **Backend already deployed** – Your API should be live (e.g. on Vercel or Azure). You will need its base URL.

---

## Step 1: Push your code to GitHub

Ensure your repo is pushed to GitHub (or GitLab/Bitbucket). The frontend should be in a folder named **`client`** at the repo root, with:

- `client/package.json`
- `client/src/` – React app
- `client/public/` – index.html, etc.
- `client/netlify.toml` – build command, publish folder, and SPA redirects

---

## Step 2: Add a new site on Netlify

1. Go to [app.netlify.com](https://app.netlify.com) and log in.
2. Click **Add new site** → **Import an existing project**.
3. Choose **GitHub** (or your Git provider) and authorize Netlify if asked.
4. Select your repository (e.g. `sachin0034-tech/lease_reserachagent`).

Do **not** click **Deploy** yet. Set the build settings next.

---

## Step 3: Set build settings and root directory

Netlify must build only the **client** folder.

1. In **Branch to deploy**, leave **main** (or your default branch).
2. In **Base directory**, click **Edit** and enter: **`client`**
3. **Build command** – Netlify will use the one from `client/netlify.toml`:
   - `npm run build`
4. **Publish directory** – Also from `netlify.toml`:
   - `build`

So you only need to set **Base directory** to **`client`**; the rest is in `netlify.toml`.

---

## Step 4: Set environment variable (backend URL)

Your frontend calls the backend API. Set its base URL so the app works in production.

1. Open **Environment variables** (or **Advanced build settings** → **Environment variables**).
2. Click **Add a variable** or **New variable**.
3. Add:

   | Key | Value | Scopes |
   |-----|--------|--------|
   | `REACT_APP_API_BASE` | Your backend URL | All (Production, Deploy previews, Branch deploys) |

4. **Value** = your backend base URL **with no trailing slash**, e.g.:
   - Vercel: `https://your-backend.vercel.app`
   - Azure: `https://your-app.azurewebsites.net`
   - Other: `https://api.yourdomain.com`

5. Save.

**Important:** The backend must allow your Netlify URL in CORS (e.g. set `CORS_ALLOW_ORIGINS` on the backend to your Netlify URL, e.g. `https://your-site.netlify.app`).

---

## Step 5: Deploy

1. Click **Deploy site** (or **Deploy [your-repo]**).
2. Wait for the build to finish (usually 1–2 minutes).
3. When it’s done, Netlify shows a URL like: **`https://random-name-123.netlify.app`**

Your frontend is live at that URL.

---

## Step 6: Verify the deployment

1. Open the site URL in a browser. You should see the Lease Forecaster form.
2. Use the app: submit a quick analysis (or open the dashboard) and confirm it talks to your backend (no “Failed to fetch” or CORS errors). If you see CORS errors, add your Netlify URL to the backend’s `CORS_ALLOW_ORIGINS`.

---

## Optional: Custom domain

1. In Netlify: **Site configuration** → **Domain management** → **Add custom domain**.
2. Follow the steps to add your domain and DNS (Netlify can provide DNS or you can use an external DNS with a CNAME to your Netlify URL).

---

## Summary checklist

- [ ] Repo pushed to GitHub (or other Git).
- [ ] New site imported on Netlify from the repo.
- [ ] **Base directory** set to **`client`**.
- [ ] **REACT_APP_API_BASE** set to your backend URL (no trailing slash).
- [ ] Backend has your Netlify URL in **CORS_ALLOW_ORIGINS**.
- [ ] Deploy finished; site loads and can call the API.

---

## Troubleshooting

| Issue | What to do |
|-------|------------|
| Build fails | Check the build log. Ensure **Base directory** is `client` and `client/package.json` and `client/netlify.toml` exist. Run `npm run build` inside `client` locally to reproduce. |
| Blank page or 404 on refresh | `netlify.toml` should have the SPA redirect (`/*` → `/index.html`). Redeploy after adding or fixing it. |
| “Failed to fetch” or network errors | Confirm **REACT_APP_API_BASE** is set and correct. Open DevTools → Network and check the request URL. |
| CORS errors | On the backend, add your Netlify URL to CORS (e.g. `https://your-site.netlify.app`). Redeploy the backend if needed. |
| Works locally but deployed shows “no data” / “Insufficient data” | See **Deployed vs local** below. |

---

## Deployed vs local: no data on deploy

If the dashboard works locally but on **leaseagent.netlify.app** (or your deployed URL) you see “no data”, “Insufficient data”, or empty cards:

1. **Frontend → backend URL**
   - In Netlify: **Site configuration** → **Environment variables**.
   - Ensure **REACT_APP_API_BASE** is set to your **deployed** backend URL (e.g. `https://your-backend.onrender.com` or your Azure/Railway URL), **no trailing slash**.
   - If it’s missing or still `http://localhost:8000`, the browser will call localhost from the user’s machine and fail. **Redeploy** after changing.

2. **Backend env vars**
   - Wherever the backend runs (Render, Azure, Railway, etc.), set **OPENAI_API_KEY**, **TAVILY_API_KEY**, and **CORS_ALLOW_ORIGINS** (include `https://leaseagent.netlify.app` or your Netlify URL). Without keys, the LLM and search return “no data”.

3. **CORS**
   - Backend **CORS_ALLOW_ORIGINS** must include your Netlify origin (e.g. `https://leaseagent.netlify.app`). Otherwise the browser may block responses and the UI will show empty/no data.

4. **Session persistence**
   - The backend saves sessions to `backend/data/sessions.json`. On **serverless** (e.g. Vercel) the filesystem is often read-only or ephemeral, so sessions don’t persist and the dashboard can’t load saved analysis. Use a **long‑running** backend (Render, Railway, Azure App Service or VM) so the file is writable and sessions survive.

5. **Redeploy and cache**
   - After fixing env vars, **trigger a new deploy** on Netlify (and on the backend if needed). If needed, use **Clear cache and deploy** so the build uses the latest **REACT_APP_API_BASE**.

**Quick check:** On the deployed site, open DevTools → **Network**. Run an analysis and open the dashboard. Confirm requests go to your **deployed backend URL** (not localhost) and that `/api/analyze/stream` and `/api/analyze/dashboard` return 200 with JSON (not 404 or CORS errors).

---

## Updating the site

- Push to the branch connected to Netlify (e.g. `main`). Netlify will automatically redeploy.
- To change the backend URL, update **REACT_APP_API_BASE** in **Site configuration** → **Environment variables** and trigger a new deploy.
