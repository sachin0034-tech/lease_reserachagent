## Deploy backend to Azure (step‑by‑step)

This guide shows **exact clicks** to deploy the FastAPI backend in `backend/` to **Azure App Service (Linux, Python)**.

---

### 0. Prerequisites (do these once)

- **Have these ready**
  - **Azure account**: you can create one at `https://portal.azure.com`.
  - **GitHub repo**: your project (with the `backend` folder) is pushed to GitHub.
- **Make sure `gunicorn` is installed (recommended for Azure)**
  - Open `backend/requirements.txt`.
  - Add a new line at the end:  
    `gunicorn>=21.0.0`
  - Commit and push this change to GitHub.

---

### 1. Confirm your backend entrypoint

- In the `backend/app/main.py` file, your FastAPI application is exposed as `app` (the default in this project).
- Azure will run it using: `app.main:app`.

You don’t need to change code for this guide.

---

### 2. Push latest backend code to GitHub

1. In your local project, commit any recent changes.
2. Push to the branch you will deploy from (usually `main`).
3. Confirm on GitHub that the latest code is visible.

---

### 3. Create the Web App in Azure Portal

1. Go to `https://portal.azure.com` and **sign in**.
2. In the left sidebar (or top search bar), click **Create a resource**.
3. Search for **Web App** and click **Create** under *Web App*.
4. **Basics** tab:
   - **Subscription**: choose your subscription.
   - **Resource group**: either select an existing one or click **Create new** (e.g. `leaseagent-rg`).
   - **Name**: type a unique name, e.g. `leaseagent-backend`.  
     - This will become your URL: `https://leaseagent-backend.azurewebsites.net`.
   - **Publish**: select **Code**.
   - **Runtime stack**: select **Python 3.11** (or closest version).
   - **Operating System**: **Linux**.
   - **Region**: pick the closest region.
5. Click **Next** until you reach the **Monitoring** or **Review + create** tab.
6. Click **Review + create**, then click **Create**.
7. Wait for the deployment to complete, then click **Go to resource**.

---

### 4. Connect GitHub for automatic deployment

1. In the Web App’s page, in the left menu, click **Deployment Center**.
2. Under **Source**, choose **GitHub**.
3. If asked, **Authorize Azure** to access your GitHub account.
4. Select:
   - **Organization**: your GitHub org/user.
   - **Repository**: the repo containing this project.
   - **Branch**: e.g. `main`.
5. For **Build provider**, pick **GitHub Actions** (recommended).
6. Click **Save** or **Finish** (Azure will create a GitHub Actions workflow).
7. Azure will start a first deployment automatically. You can:
   - See progress in **Deployment Center → Logs**.
   - Or on GitHub under **Actions** for the repo.

---

### 5. Configure environment variables (Application settings)

1. In the Web App’s left menu, click **Configuration**.
2. Under the **Application settings** tab, click **New application setting** for each key:
   - **Name**: `OPENAI_API_KEY` – **Value**: your OpenAI key.
   - **Name**: `ANTHROPIC_API_KEY` – **Value**: your Anthropic key.
   - **Name**: `TAVILY_API_KEY` – **Value**: your Tavily key.
   - **Name**: `CORS_ALLOW_ORIGINS` – **Value**: your frontend URL, e.g. `https://your-app.netlify.app` (no trailing slash).
3. After adding them, click **Save** at the top.
4. Confirm when Azure asks to **Restart** the app.

---

### 6. Set the startup command

1. Still in **Configuration**, go to the **General settings** tab.
2. Find **Startup Command** (Linux only).
3. Set this value:

   `gunicorn -w 4 -k uvicorn.workers.UvicornWorker app.main:app`

4. Click **Save**. Azure will restart the app with this command.

This tells Azure to run your FastAPI app from `backend/app/main.py`.

---

### 7. Verify the backend is running

1. In the Web App’s left menu, click **Overview**.
2. At the top, copy the **URL**, e.g. `https://leaseagent-backend.azurewebsites.net`.
3. Open a browser and test:
   - Health: go to `https://leaseagent-backend.azurewebsites.net/health`.
   - API docs: go to `https://leaseagent-backend.azurewebsites.net/docs`.
4. If you see the JSON health response and FastAPI docs, the backend is live.

If there is an error:
- Check **Logs** → **Log stream** in the Web App menu.
- Check **Deployment Center → Logs** for build errors.

---

### 8. Point your frontend to Azure

Use the Azure URL as your API base:

- **If using Netlify environment variables**:
  - In Netlify dashboard, open your site.
  - Go to **Site settings → Environment variables**.
  - Set `REACT_APP_API_BASE` to  
    `https://leaseagent-backend.azurewebsites.net` (no trailing slash).
  - Redeploy your Netlify site.

- **If using a `.env` file locally**:
  - In the `client` folder, set in `.env`:  
    `REACT_APP_API_BASE=https://leaseagent-backend.azurewebsites.net`
  - Rebuild/restart the React app.

Now your frontend will call your backend running on Azure.

---

### 9. Summary checklist

- [ ] Azure account + GitHub repo ready.
- [ ] `gunicorn` added to `backend/requirements.txt` and pushed.
- [ ] Web App (Linux, Python) created with a unique name.
- [ ] GitHub repo connected via **Deployment Center**.
- [ ] App settings set: `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `TAVILY_API_KEY`, `CORS_ALLOW_ORIGINS`.
- [ ] Startup Command: `gunicorn -w 4 -k uvicorn.workers.UvicornWorker app.main:app`.
- [ ] `/health` and `/docs` load from `https://<your-name>.azurewebsites.net`.
- [ ] Frontend `REACT_APP_API_BASE` points to that URL.

