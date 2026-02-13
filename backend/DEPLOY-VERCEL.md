# Deploy Backend to Vercel (Step-by-Step)

This guide walks you through deploying the **LegalGraph AI Research Agent** FastAPI backend on **Vercel** as a serverless function. Follow the steps in order.

---

## Prerequisites

- **Vercel account** – [Sign up free](https://vercel.com/signup).
- **Git** – Your backend code in a Git repository (GitHub, GitLab, or Bitbucket).
- **OpenAI API key** – From [OpenAI API keys](https://platform.openai.com/api-keys).

---

## Step 1: Push your code to GitHub

Ensure your backend code is in a Git repo and pushed to GitHub (or GitLab/Bitbucket). The backend should be in a folder named **`backend`** at the repo root, with:

- `backend/app/` – your FastAPI app (`app/main.py`)
- `backend/requirements.txt`
- `backend/index.py` – Vercel entry point (imports `app` from `app.main`)

If your repo has both **client** and **backend**, we will deploy only the backend by setting the **Root Directory** in Step 4.

---

## Step 2: Install Vercel CLI (optional)

You can deploy from the Vercel website (recommended) or from the CLI.

**To install the CLI (optional):**

```bash
npm i -g vercel
```

Then log in:

```bash
vercel login
```

---

## Step 3: Import the project on Vercel

1. Go to [vercel.com/new](https://vercel.com/new).
2. Click **Import Git Repository**.
3. Select your repository (e.g. `sachin0034-tech/lease_reserachagent`).
4. Click **Import**.

Do **not** click **Deploy** yet. Configure the project first (next step).

---

## Step 4: Set the Root Directory to `backend`

Vercel must build and run only the backend folder.

1. On the import screen, find **Root Directory**.
2. Click **Edit** next to it.
3. Enter: **`backend`**
4. Confirm so that the project root for this deployment is the `backend` folder.

This makes Vercel use:

- `backend/requirements.txt` for dependencies
- `backend/index.py` as the FastAPI entry point (Vercel detects `app` from here)

---

## Step 5: Set environment variables

1. On the same import/settings page, open **Environment Variables**.
2. Add:

   | Name             | Value                    | Environment  |
   |------------------|--------------------------|-------------|
   | `OPENAI_API_KEY` | Your OpenAI API key      | Production (and Preview if you want) |
   | `CORS_ALLOW_ORIGINS` | Your frontend URL(s) | Production (and Preview if needed)  |

3. **OPENAI_API_KEY**  
   - Value: your key (e.g. `sk-proj-...`).  
   - Do not commit this in code or in Git.

4. **CORS_ALLOW_ORIGINS** (optional)  
   - If you have a frontend (e.g. also on Vercel or another domain), set this to its URL so the browser can call the API.  
   - Examples:  
     - `https://your-frontend.vercel.app`  
     - `https://your-frontend.vercel.app,https://www.yourdomain.com`  
   - No spaces; separate multiple origins with a comma.

5. Save the variables.

---

## Step 6: Deploy

1. Click **Deploy**.
2. Wait for the build to finish (usually 1–2 minutes).
3. When it’s done, Vercel shows a URL like:  
   **`https://your-project-name-xxx.vercel.app`**

Your API is live at that URL.

---

## Step 7: Verify the deployment

1. **Health check**  
   Open in a browser or with `curl`:

   ```
   https://your-project-name-xxx.vercel.app/health
   ```

   You should see: `{"status":"ok"}`.

2. **API docs**  
   Open:

   ```
   https://your-project-name-xxx.vercel.app/docs
   ```

   You should see the Swagger UI for your FastAPI app.

3. **API base URL**  
   Use this base URL in your frontend or API client, e.g.:

   - `POST https://your-project-name-xxx.vercel.app/api/analyze`
   - `GET https://your-project-name-xxx.vercel.app/api/analyze/latest`

---

## Deploying with Vercel CLI (alternative)

If you prefer the CLI and your current directory is the **repo root** (not inside `backend`):

1. Link the project (first time only):

   ```bash
   cd /path/to/lease_reserachagent
   vercel link
   ```

   Choose your Vercel account and project (or create a new one).

2. Set Root Directory and deploy:

   ```bash
   vercel --prod
   ```

   When prompted for **Set up and deploy?**, choose **Y** and set **Root Directory** to **`backend`** when asked (or set it in the Vercel dashboard under Project Settings → General → Root Directory).

3. Add env vars via CLI (if not set in the dashboard):

   ```bash
   vercel env add OPENAI_API_KEY
   vercel env add CORS_ALLOW_ORIGINS
   ```

   Then redeploy:

   ```bash
   vercel --prod
   ```

---

## Summary checklist

- [ ] Code pushed to GitHub (or other Git provider).
- [ ] Project imported on Vercel with **Root Directory** = **`backend`**.
- [ ] **OPENAI_API_KEY** set in Environment Variables.
- [ ] **CORS_ALLOW_ORIGINS** set if you have a frontend.
- [ ] Deploy finished successfully.
- [ ] `/health` returns `{"status":"ok"}`.
- [ ] `/docs` loads Swagger UI.

---

## Troubleshooting

| Issue | What to do |
|-------|------------|
| Build fails | Check the build log. Ensure **Root Directory** is `backend` and `backend/requirements.txt` and `backend/index.py` exist. |
| **250 MB serverless size exceeded** | 1) Set **Root Directory** to `backend`. 2) Use `backend/.vercelignore` (excludes venv, data/, .env). 3) **Settings → General → Build Cache → Clear**, then redeploy. 4) Add env **VERCEL_BUILDER_DEBUG=1** and redeploy to see size in logs. |
| 404 on routes | Confirm you’re using the full path (e.g. `/api/analyze`, `/health`). Vercel serves the FastAPI app at the project root. |
| CORS errors from frontend | Set **CORS_ALLOW_ORIGINS** to the frontend URL (no trailing slash). Add multiple origins separated by commas. |
| OpenAI errors | Verify **OPENAI_API_KEY** in Project Settings → Environment Variables (and that the key is valid). |
| Function timeout | Vercel has execution time limits (e.g. 10s on Hobby). Long-running analysis may hit this; consider splitting work or using a different backend for very long jobs. |

---

## Limits to be aware of

- **Execution time** – Serverless functions have a max duration (e.g. 10 seconds on Hobby, higher on Pro). If analysis takes longer, the request may time out.
- **Bundle size** – Python deployment bundle must stay under Vercel’s limit (e.g. 250 MB). Your current dependencies are small; if you add large packages, watch the size.
- **No persistent disk** – Each request can use only temporary storage; do not rely on local files across requests.

---

## Updating the deployment (clean build)

To remove the previous build and deploy a fresh one:

1. **Clear Vercel build cache**  
   Vercel Dashboard → your project → **Settings** → **General** → **Build Cache** → **Clear**.

2. **Redeploy**  
   - **Git:** Push to the connected branch (e.g. `main`); Vercel will redeploy.  
   - **CLI:** From repo root run `vercel --prod` (with Root Directory set to `backend` in project settings).

Your backend URL stays the same unless you change the project name or domain.
