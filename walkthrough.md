# Next.js + PostgreSQL/Supabase Goals App Walkthrough

We have successfully migrated the application into a Docker-ready, multi-user Next.js application named **`strivelpro`**.

## Workspace Files Created

### 1. Developer Control Scripts (in `/scripts`)
All scripts are located in the [scripts/](file:///Users/lindogeorge/WS/Antigravity/Learn/scripts) directory:
* **`build.sh`**: Compiles the Next.js application to verify types.
* **`stage.sh`**: Bundles the application into a Docker image.
* **`run.sh`**: Starts the local containers (Next.js + Postgres) and auto-runs database migrations.
* **`stop.sh`**: Safely tears down the containers.
* **`compare.sh`**: Automatically compares a fresh install vs. a migrated database schema.
* **`migrate.js`**: The versioned migration engine.
* **`compare-schemas.js`**: Structural comparison database drift detector.
* **`update-env.js`**: Automatically syncs local Supabase credentials (URL, keys) with Next.js environment configurations.

### 2. Database Versioning & Configuration
* **[0001_create_goals_table.sql](file:///Users/lindogeorge/WS/Antigravity/Learn/migrations/0001_create_goals_table.sql)**: SQL file creating the initial tables and Row Level Security policies.
* **[supabase/migrations/](file:///Users/lindogeorge/WS/Antigravity/Learn/supabase/migrations/)**: Official Supabase migration directory containing the schema SQL file.
* **[supabase/config.toml](file:///Users/lindogeorge/WS/Antigravity/Learn/supabase/config.toml)**: Local Supabase CLI configuration defining ports and active services.
* **[docker-compose.yml](file:///Users/lindogeorge/WS/Antigravity/Learn/docker-compose.yml)** & **[docker-compose.compare.yml](file:///Users/lindogeorge/WS/Antigravity/Learn/docker-compose.compare.yml)**: Docker compose configurations for offline database staging.
* **[Dockerfile](file:///Users/lindogeorge/WS/Antigravity/Learn/Dockerfile)**: Multi-stage Next.js production runner.

### 3. Application Components & Page Layout
* **[src/app/page.tsx](file:///Users/lindogeorge/WS/Antigravity/Learn/src/app/page.tsx)**: Server Component that authenticates user, fetches database records, and renders the Dashboard.
* **[src/components/DashboardClient.tsx](file:///Users/lindogeorge/WS/Antigravity/Learn/src/components/DashboardClient.tsx)**: Interactive Client Component for targets management, keyboard shortcuts, tag autocomplete, and optimistic mutations.
* **[src/app/login/page.tsx](file:///Users/lindogeorge/WS/Antigravity/Learn/src/app/login/page.tsx)**: Glassmorphic email/password and Google login screen.
* **[src/app/globals.css](file:///Users/lindogeorge/WS/Antigravity/Learn/src/app/globals.css)**: New, dark theme and layout variables.

---

## How to Run & Verify

### Option A: Local Dev Server with Supabase Cloud
1. Create a free project on [Supabase](https://supabase.com).
2. Run the SQL schema script inside the Supabase SQL editor (the script content is available in [0001_create_goals_table.sql](file:///Users/lindogeorge/WS/Antigravity/Learn/migrations/0001_create_goals_table.sql)).
3. Copy [env.local.example](file:///Users/lindogeorge/WS/Antigravity/Learn/.env.local.example) to `.env.local` and paste your Supabase URL, Anon Key, and Database connection string.
4. Run the database migration to record version `0001` in the cloud tracking table:
   ```bash
   node scripts/migrate.js
   ```
5. Launch the local dev server:
   ```bash
   npm run dev
   ```

### Option B: Local Docker with Official Supabase (Verified and Running)
The local Docker stack runs offline in one step:
```bash
./scripts/run.sh
```
This starts the local Supabase stack (PostgreSQL, GoTrue Auth, Kong, Studio), extracts local credentials automatically, and spins up the Next.js standalone container at http://localhost:3000.

To shut down:
```bash
./scripts/stop.sh
```
