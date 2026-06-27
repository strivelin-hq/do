# Multi-Environment Setup & Hosting Guide

This guide provides step-by-step instructions for setting up, configuring, and hosting the **strivelpro** goals application across three environments, starting from your GitHub repository.

---

## Implementation & Hosting Checklist

Here is a breakdown of what has been implemented and committed to your repository vs. what needs to be configured on the hosting infrastructure.

### ✅ Done (Coded & In Repository)
* [x] **Git & GitHub Setup**: Local workspace initialized as a Git repository, origin linked to [strivelin-hq/do](https://github.com/strivelin-hq/do.git), and code pushed to `main`.
* [x] **Next.js Dynamic Base Path**: Updated `next.config.ts` to dynamically resolve `basePath` from `process.env.NEXT_PUBLIC_BASE_PATH`, allowing local dev on `/` and production on `/do`.
* [x] **Multi-Stage Dockerfile**: Configured `Dockerfile` builder stage to accept `NEXT_PUBLIC_BASE_PATH` as a build argument so it is baked into static assets compiled during build.
* [x] **Database Schema Drift Fixed**: Created `migrations/0002_add_target_date_recurrence.sql` to align the root migrations with local Supabase changes.
* [x] **Schema Parity Test Suite**: Configured `./scripts/compare.sh` to run sequential vs migrated tests in Docker, guaranteeing migration safety.
* [x] **Local Dev Script Fixes**: Corrected paths inside `./docs/dev_process.html` to `./scripts/xxx.sh` and linked it directly to this hosting guide.

### 📋 To Be Done (Infrastructure Configuration)
* [ ] **Supabase Cloud Projects**: Create two isolated projects (Staging & Production) on Supabase.
* [ ] **DNS Records**: Point `strivelin.com` and `www.strivelin.com` to your public hosting IP.
* [ ] **SSL Configuration**: Generate SSL certificates using Certbot (Let's Encrypt) or Cloudflare.
* [ ] **Nginx Reverse Proxy**: Place Nginx in front of your containers and route the `/do` path.
* [ ] **Supabase Auth Redirects**: Whitelist callback redirects (`https://www.strivelin.com/do/auth/callback`) in the production Supabase dashboard.

---

## 1. GitHub & CI/CD Pipeline Setup

To automate builds and ensure that no database schema drift reaches staging or production, use GitHub as your source of truth and configure CI/CD pipelines.

### Recommended Branching Strategy
* **`main`**: Production release branch (deploys to Production).
* **`staging`**: Pre-release verification branch (deploys to Production-like Staging).
* **`dev` / Feature Branches**: Active development (deploys/runs in Playground/Local).

### Setting Up GitHub Repository Secrets
Under your GitHub Repository Settings > **Secrets and variables** > **Actions**, define the following variables:

#### Production Secrets
* `PROD_DATABASE_URL`: Production PostgreSQL connection string (direct connection).
* `PROD_NEXT_PUBLIC_SUPABASE_URL`: Production Supabase API URL.
* `PROD_NEXT_PUBLIC_SUPABASE_ANON_KEY`: Production Supabase Anon Public Key.
* `PROD_SUPABASE_URL`: Production Supabase internal/server URL.

#### Staging Secrets
* `STAGING_DATABASE_URL`: Staging PostgreSQL connection string.
* `STAGING_NEXT_PUBLIC_SUPABASE_URL`: Staging Supabase API URL.
* `STAGING_NEXT_PUBLIC_SUPABASE_ANON_KEY`: Staging Supabase Anon Public Key.
* `STAGING_SUPABASE_URL`: Staging Supabase internal/server URL.

### Recommended CI/CD Workflow (`.github/workflows/deploy.yml`)
Create a workflow that executes compilation checks and database parity tests on every Pull Request to `staging` or `main`:

```yaml
name: CI/CD Pipeline

on:
  pull_request:
    branches: [ staging, main ]
  push:
    branches: [ staging, main ]

jobs:
  test_and_build:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout Code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'

      - name: Install Dependencies
        run: npm ci

      - name: Check Code Compilation
        run: ./scripts/build.sh

      - name: Install Docker & Docker Compose
        uses: docker/setup-buildx-action@v3

      - name: Run Schema Parity Check
        run: ./scripts/compare.sh
```

---

## 2. Environment 1: Playground (Sandbox)

**Purpose**: High-velocity testing, sandboxing, and manual feature verifications. It is acceptable if this environment is occasionally broken or has unstable data.

### Hosting Architecture Options
1. **Local Docker Stack**: Run the entire offline stack directly on your development machine using `./scripts/run.sh`.
2. **Lightweight VPS (Docker Compose)**: Host a shared playground instance on a cheap VM (e.g., DigitalOcean Droplet, AWS EC2 nano instance, Hetzner Cloud).

### VPS Setup Steps
1. SSH into your VPS:
   ```bash
   ssh user@your-playground-ip
   ```
2. Clone the repository and navigate to the project:
   ```bash
   git clone https://github.com/strivelin-hq/do.git
   cd do
   ```
3. Install Docker and Docker Compose on the VPS.
4. Copy the environment template:
   ```bash
   cp .env.local.example .env
   ```
5. Modify `.env` to point to a database. Since this is a playground, you can run PostgreSQL in a Docker container alongside the web app.
6. Build and launch:
   ```bash
   docker compose up -d --build
   ```
7. Apply migrations to the playground database:
   ```bash
   docker compose exec web node scripts/migrate.js
   ```

---

## 3. Environment 2: Production-Like Staging

**Purpose**: Exact mirror of production infrastructure. Used for final QA, schema migration validations, and performance checks. Staging must be completely isolated from Production.

### Hosting Architecture
* **Database**: Isolated Supabase Cloud Staging project (Free tier or Pro plan).
* **Web App Host**: Hosted on container services (e.g., Fly.io, Render, AWS ECS, or DigitalOcean App Platform).
* **Subpath**: Can either be hosted on a subdomain (e.g., `https://staging.strivelin.com`) or a subpath mirroring production (`https://staging.strivelin.com/do`).

### Setup Steps
1. **Provision Staging Database**: Create a new database project on Supabase Cloud.
2. **Configure Staging Environment Variables**:
   * `DATABASE_URL`: Set to the staging Supabase pooler connection string (use transaction pooler port `6543`).
   * `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Staging project API credentials.
   * `SUPABASE_URL`: Staging service role endpoint.
3. **Execute Migrations**: Run the database migration script before deployment:
   ```bash
   DATABASE_URL="postgres://postgres:password@db-host:6543/postgres" node scripts/migrate.js
   ```
4. **Deploy Web Container**: Deploy the Docker container built from your staging branch.

---

## 4. Environment 3: Production

**Purpose**: High availability, secure, performant system serving active customers.

### Hosting Architecture
* **Public URL**: `https://www.strivelin.com/do` (Served on the `/do` subpath).
* **Database**: Supabase Cloud Production project (Pro tier recommended for auto-backups and SSL verification).
* **Web Hosting**: Container cluster (AWS ECS, Fly.io, or Google Cloud Run) behind a reverse proxy (Nginx or Cloudflare).

### Step-by-Step Setup Steps

#### Step 4.1: Build Next.js with the `/do` basePath
Next.js compiles static asset paths and links at build time. Since production is hosted under `https://www.strivelin.com/do`, you **MUST** pass the `/do` subpath during the Docker build process:

```bash
docker build \
  --build-arg NEXT_PUBLIC_BASE_PATH="/do" \
  --build-arg NEXT_PUBLIC_SUPABASE_URL="https://your-prod-supabase.supabase.co" \
  --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY="your-prod-anon-key" \
  -t strivelin-do-prod .
```

#### Step 4.2: Provision and Secure the Production Database
1. Create your production database on Supabase Cloud.
2. Ensure SSL is enforced: In Supabase Dashboard > Settings > Database, toggle **Enforce SSL on incoming connections**.

#### Step 4.3: Securely Apply Production Database Migrations
> [!IMPORTANT]
> **Concurrent Migration Safety**: Do not run migrations inside the container startup command if you scale your web container to multiple instances (replicas). Running migrations concurrently can lead to database locks or transaction failures.
> Instead, execute the migration command (`node scripts/migrate.js`) as a **pre-deploy release phase task** (e.g., Fly.io `release_command`, AWS ECS one-off task, or Render pre-deploy command).

Run migrations from a secure, single-instance CD runner:
```bash
DATABASE_URL="your-production-pooled-database-url" node scripts/migrate.js
```

#### Step 4.4: Setup Reverse Proxy Routing (Nginx)
Configure your load balancer or Nginx reverse proxy on `www.strivelin.com` to forward traffic matching `/do` to the Next.js container (listening on port 3000).

> [!CAUTION]
> **Do NOT strip the `/do` prefix** in Nginx! Next.js is configured with a base path of `/do`, meaning it expects all request paths to begin with `/do`. Stripping the prefix will result in `404 Not Found` errors for all pages and static assets.

Use the following Nginx block on your host server:

```nginx
# Add to server block on www.strivelin.com
location /do {
    # Forward to the Next.js container IP or domain
    proxy_pass http://nextjs_web_container:3000;
    
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_cache_bypass $http_upgrade;
    
    # Forward client IP headers for correct logs and authentication
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    
    # Adjust proxy timeout parameters for stable web socket connections
    proxy_connect_timeout 60s;
    proxy_send_timeout 60s;
    proxy_read_timeout 60s;
}

#### Step 4.5: Custom Domain, DNS, and SSL Setup
To serve your application securely under your own domain (`https://www.strivelin.com/do`), follow these steps:

##### 1. DNS Configuration
Log into your domain registrar/DNS provider (e.g. Cloudflare, GoDaddy, Namecheap) and create:
* **A Record**: Point `@` (strivelin.com) to your server's public IPv4 address.
* **CNAME Record**: Point `www` (www.strivelin.com) to `@` or directly to your server domain.

##### 2. SSL/TLS Certificate Provisioning (Nginx & Let's Encrypt)
Secure all web traffic with HTTPS. On your Nginx hosting server, use **Certbot** to automatically retrieve and configure Let's Encrypt certificates:
1. Install Certbot and the Nginx plugin:
   ```bash
   sudo apt update
   sudo apt install certbot python3-certbot-nginx
   ```
2. Request your certificates:
   ```bash
   sudo certbot --nginx -d strivelin.com -d www.strivelin.com
   ```
3. Certbot will automatically read your Nginx server block, configure the SSL certificates, set up HTTP to HTTPS redirection, and establish a systemd timer for automatic renewals (every 90 days).

##### 3. Supabase Redirect URL Configuration
To prevent Supabase authentication flows (such as Google OAuth or email validation links) from redirecting users back to local dev instead of production, you must whitelist the production redirect URLs in the Supabase Dashboard:
1. Open your **Production Supabase Project** in the browser.
2. Go to **Authentication** > **URL Configuration** in the sidebar.
3. Under **Site URL**, enter: `https://www.strivelin.com/do`
4. Under **Redirect URLs**, click **Add URL** and whitelist:
   * `https://www.strivelin.com/do/**` (matches all sub-routes)
   * `https://www.strivelin.com/do/auth/callback` (specific callback endpoint)
5. Save changes.

##### 4. Supabase Custom Domains (Optional, Pro plan)
By default, your app connects to `<project-id>.supabase.co`. In production, this can result in browsers treating auth cookies as third-party, which might be blocked (especially in Safari). To resolve this, configure a custom domain for Supabase:
1. In Supabase Dashboard, go to **Settings** > **Custom Domains**.
2. Add a subdomain like `api.strivelin.com` or `supabase.strivelin.com`.
3. Add the suggested CNAME and TXT validation records in your DNS provider settings.
4. Once verified, update the `NEXT_PUBLIC_SUPABASE_URL` build variable of your Next.js app to point to your new custom domain (`https://api.strivelin.com`).
```

---

## 5. Summary Matrix of Environments

| Characteristic | Environment 1: Playground | Environment 2: Staging | Environment 3: Production |
| :--- | :--- | :--- | :--- |
| **URL** | `http://localhost:3000` or `play.strivelin.com` | `https://staging.strivelin.com` | `https://www.strivelin.com/do` |
| **Database** | Local Supabase/Docker PG | Cloud Supabase (Staging DB) | Cloud Supabase (Prod DB) |
| **Build Path (`basePath`)** | `""` (Root) | `""` (Root) or `/do` | `/do` |
| **Migration Method** | Run on local script/manual | Manual or CI/CD pre-deploy | CI/CD Pre-deploy task (Single replica) |
| **SSL Enforced** | Optional / Disabled | Enabled | Required |
| **Scaling** | Single Instance | Single Instance | Multiple Replicas |
