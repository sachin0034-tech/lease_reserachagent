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
   - **Name**: `CORS_ALLOW_ORIGINS` – **Value**: comma-separated origins (no trailing slashes). Include your deployed frontend and, if you run the frontend locally, add `http://localhost:3000`. Example: `https://your-app.netlify.app,http://localhost:3000`.
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

### 9. Summary checklist (App Service)

- [ ] Azure account + GitHub repo ready.
- [ ] `gunicorn` added to `backend/requirements.txt` and pushed.
- [ ] Web App (Linux, Python) created with a unique name.
- [ ] GitHub repo connected via **Deployment Center**.
- [ ] App settings set: `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `TAVILY_API_KEY`, `CORS_ALLOW_ORIGINS` (e.g. `https://your-app.netlify.app,http://localhost:3000`).
- [ ] Startup Command: `gunicorn -w 4 -k uvicorn.workers.UvicornWorker app.main:app`.
- [ ] `/health` and `/docs` load from `https://<your-name>.azurewebsites.net`.
- [ ] Frontend `REACT_APP_API_BASE` points to that URL.

---

### 10. (Optional) Create a new Azure VM (step‑by‑step)

If you prefer to run everything on your **own virtual machine** instead of App Service, follow these steps to create a VM. (This just creates the VM; you can then SSH in and set up Python, clone the repo, etc.)

#### 10.1 Create the VM in Azure Portal

1. Go to `https://portal.azure.com` and sign in.
2. In the left sidebar (or top search bar), click **Create a resource**.
3. In the search box, type **Virtual machine** and press Enter.
4. Click **Create** under *Virtual machine*.
5. On the **Basics** tab:
   - **Subscription**: choose your subscription.
   - **Resource group**: select an existing one or click **Create new** (e.g. `leaseagent-vm-rg`).
   - **Virtual machine name**: e.g. `leaseagent-vm`.
   - **Region**: pick the closest region.
   - **Image**: choose **Ubuntu Server 22.04 LTS** (recommended).
   - **Size**: pick a small size (e.g. `B1s` or similar) for dev/testing.
6. **Administrator account**:
   - **Authentication type**: choose **SSH public key** (more secure) or **Password**.
   - If **SSH public key**:
     - **Username**: e.g. `azureuser`.
     - **SSH public key source**: *Use existing public key* or *Generate new key pair*.
   - If **Password**:
     - Set a strong password and remember it.
7. **Inbound port rules**:
   - For now, check **SSH (22)** so you can connect.
   - You can add HTTP/HTTPS later in **Networking**.
8. Click **Review + create**, then **Create**.
9. Wait for deployment to finish, then click **Go to resource**.

#### 10.2 Open HTTP (port 80) on the VM

1. On the VM’s page, in the left menu, click **Networking**.
2. Under **Inbound port rules**, click **Add inbound port rule**.
3. Set:
   - **Destination port ranges**: `80`.
   - **Protocol**: `TCP`.
   - **Priority**: leave default or lower number if needed.
   - **Name**: e.g. `allow-http`.
4. Click **Add**.

Later, if you run your app on another port (e.g. 8000), repeat the same steps with **Destination port ranges** = `8000`.

#### 10.3 Connect to the VM (SSH)

1. On the VM’s **Overview** page, note the **Public IP address**.
2. Click **Connect** at the top, then choose **SSH**.
3. Azure shows you an example SSH command, like:

   `ssh azureuser@<PUBLIC_IP>`

4. In your local terminal, run that command (use your actual username and IP).
5. Accept the prompt (`yes`) the first time you connect.

Now you are inside the VM’s Linux shell and can:
- Install system packages (`sudo apt update`, `sudo apt install python3-pip git`).
- Clone your repo.
- Create a virtualenv and run your FastAPI app (e.g. with `uvicorn` or `gunicorn` + `nginx`).

> This doc focuses on **creating the VM itself**. When you’re ready, I can also add a section that shows exactly how to install Python, clone this project, and run the backend on the VM behind Nginx.

---

### 11. Deploy backend to your VM (step‑by‑step)

Once you're SSH'd into your VM, follow these commands **in order**:

#### 11.1 Update system and install dependencies

```bash
# Update package list
sudo apt update

# Install Python 3, pip, git, and other tools
sudo apt install -y python3 python3-pip python3-venv git

# Verify installations
python3 --version
git --version
```

#### 11.2 Clone your repository

```bash
# Navigate to home directory
cd ~

# Clone your repo (replace with your actual GitHub repo URL)
git clone https://github.com/YOUR_USERNAME/lease_reserachagent.git

# Or if using SSH:
# git clone git@github.com:YOUR_USERNAME/lease_reserachagent.git

# Enter the project directory
cd lease_reserachagent
```

**Replace `YOUR_USERNAME`** with your actual GitHub username.

#### 11.3 Create virtual environment and install Python packages

```bash
# Go to backend directory
cd backend

# Create virtual environment
python3 -m venv venv

# Activate virtual environment
source venv/bin/activate

# Upgrade pip
pip install --upgrade pip

# Install all requirements
pip install -r requirements.txt
```

#### 11.4 Set environment variables

Create a `.env` file in the `backend` directory:

```bash
# Still in backend/ directory with venv activated
nano .env
```

Add these lines (replace with your actual API keys):

```bash
OPENAI_API_KEY=your-openai-key-here
ANTHROPIC_API_KEY=your-anthropic-key-here
TAVILY_API_KEY=your-tavily-key-here
CORS_ALLOW_ORIGINS=https://your-frontend-url.netlify.app,http://localhost:3000
```

- Press `Ctrl+X`, then `Y`, then `Enter` to save and exit nano.

#### 11.5 Test the backend locally (optional)

```bash
# Still in backend/ directory with venv activated
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

- Press `Ctrl+C` to stop it after testing.
- If it works, you'll see FastAPI startup messages.

#### 11.6 Run backend with Gunicorn (production)

```bash
# Still in backend/ directory with venv activated
gunicorn -w 4 -k uvicorn.workers.UvicornWorker app.main:app --bind 0.0.0.0:8000
   gunicorn -w 4 -k uvicorn.workers.UvicornWorker --chdir backend app.main:app
```

This runs your backend on **port 8000**. Keep this terminal open, or use the next step to run it as a service.

#### 11.7 (Optional) Run as a systemd service (keeps it running after logout)

Create a systemd service file:

```bash
# Exit virtual environment first
deactivate

# Create service file
sudo nano /etc/systemd/system/leaseagent-backend.service
```

Paste this content (adjust paths if needed):

```ini
[Unit]
Description=Lease Agent Backend API
After=network.target

[Service]
User=leaseagent-vm
WorkingDirectory=/home/azureuser/lease_reserachagent/backend
Environment="PATH=/home/azureuser/lease_reserachagent/backend/venv/bin"
ExecStart=/home/azureuser/lease_reserachagent/backend/venv/bin/gunicorn -w 4 -k uvicorn.workers.UvicornWorker app.main:app --bind 0.0.0.0:8000
Restart=always

[Install]
WantedBy=multi-user.target
```

- Press `Ctrl+X`, then `Y`, then `Enter` to save.

**Replace `azureuser`** with your actual VM username if different.

Enable and start the service:

```bash
# Reload systemd
sudo systemctl daemon-reload

# Enable service (starts on boot)
sudo systemctl enable leaseagent-backend

# Start the service
sudo systemctl start leaseagent-backend

# Check status
sudo systemctl status leaseagent-backend
```

If you see "active (running)", your backend is running as a service.

#### 11.8 Open port 8000 in Azure (if not already open)

1. In Azure Portal → your VM → **Networking**.
2. Click **Add inbound port rule**.
3. Set:
   - **Destination port ranges**: `8000`
   - **Protocol**: `TCP`
   - **Name**: `allow-backend`
4. Click **Add**.

#### 11.9 Test your backend

From your local browser or terminal:

```bash
# Health check
curl http://<VM_PUBLIC_IP>:8000/health

# API docs
# Open in browser: http://<VM_PUBLIC_IP>:8000/docs
```

Replace `<VM_PUBLIC_IP>` with your VM's public IP (e.g. `4.229.225.12`).

#### 11.10 (Optional) Set up Nginx reverse proxy (for port 80/HTTPS)

If you want to serve on port 80 (HTTP) or set up HTTPS later:

```bash
# Install Nginx
sudo apt install -y nginx

# Create Nginx config
sudo nano /etc/nginx/sites-available/leaseagent-backend
```

Paste:

```nginx
server {
    listen 80;
    server_name <VM_PUBLIC_IP>;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

- Replace `<VM_PUBLIC_IP>` with your VM's IP.
- Save (`Ctrl+X`, `Y`, `Enter`).

Enable and restart Nginx:

```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/leaseagent-backend /etc/nginx/sites-enabled/

# Test config
sudo nginx -t

# Restart Nginx
sudo systemctl restart nginx
```

Now your backend is accessible at `http://<VM_PUBLIC_IP>/health` (port 80).

---

### 12. Summary checklist (VM deployment)

- [ ] VM created and SSH access working.
- [ ] Port 8000 (and/or 80) opened in Azure Networking.
- [ ] System updated, Python 3, pip, git installed.
- [ ] Repository cloned to VM.
- [ ] Virtual environment created and activated.
- [ ] `requirements.txt` installed successfully.
- [ ] `.env` file created with API keys.
- [ ] Backend tested with `uvicorn` or `gunicorn`.
- [ ] Backend running (either manually or as systemd service).
- [ ] `/health` endpoint accessible from browser at `http://<VM_IP>:8000/health`.
- [ ] Frontend `REACT_APP_API_BASE` updated to `http://<VM_IP>:8000` (or `http://<VM_IP>` if using Nginx).
