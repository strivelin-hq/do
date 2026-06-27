# Dockerized Next.js + Supabase/PostgreSql Goals App

Transition the local React goals app into a cloud-ready, multi-user SaaS product using Next.js (App Router, TypeScript, Vanilla CSS) and PostgreSQL/Supabase.

This plan is stored directly in your project path. It includes a fully dockerized local environment, database version tracking with auto-migrations, **dual staging environments** (fresh setup vs. migrated setup), and a **schema comparison tool** to ensure schema parity.

---

## Technical Documentation & Process Flow

For a block-by-block visual explanation of how the build, stage, run, stop, and comparison processes work under the hood, open the local documentation page:

👉 **[Development Process & Architecture Guide](file:///Users/lindogeorge/WS/Antigravity/Learn/docs/dev_process.html)**

---

## User Action Required

No external setup is required to run the app or run the schema comparison tests locally. All databases (including the dual staging environments) run inside your local Docker runtime.

---

## Architecture & Scripts

We are implementing a standardized control script system at the root of the project:

| Script | Purpose | Under the Hood |
| :--- | :--- | :--- |
| **`./build.sh`** | Compiles the Next.js application to verify typescript/code correctness. | Runs `npm run build`. |
| **`./stage.sh`** | Packages the app into a shippable Docker image. | Runs `docker compose build`. |
| **`./run.sh`** | Starts the local database and Next.js server, and auto-runs database migrations. | Runs `docker compose up -d` and executes migrations. |
| **`./stop.sh`** | Stops the local app and database containers. | Runs `docker compose down`. |
| **`./compare.sh`** | Spins up two separate staging databases (Fresh vs. Migrated), runs migrations, compares their schemas, and outputs the comparison report. | Runs `docker compose -f docker-compose.compare.yml up -d`, executes migration sequences, runs `scripts/compare-schemas.js`, and shuts down containers. |

---

## Dual Staging & Comparison System

To guarantee that updating an existing production database (migration) results in the exact same database structure as a clean install (fresh setup), we implement the following:

### 1. The Two Test Databases
Inside our comparison test configuration (`docker-compose.compare.yml`), we spin up:
* **`db_fresh`**: A database initialized from scratch by running the full migration sequence sequentially.
* **`db_migrated`**: A database simulating an upgrade (e.g. starting with older tables, running a legacy state, and then applying newer migrations).

### 2. Schema Comparison Engine (`scripts/compare-schemas.js`)
A Node script that connects to both databases using standard PostgreSQL queries and extracts a structural representation of:
* **Tables & Columns** (Name, data type, nullability, default values).
* **Constraints** (Primary keys, foreign keys, unique constraints).
* **Row Level Security (RLS) Policies** (Ensures user-data isolation rules match).

The script compares the two structures:
* If they match exactly: Prints a success message and exits with **`exit 0`**.
* If there is any discrepancy (drift): Prints a detailed diff listing the missing columns, mismatched types, or differing security policies, and exits with **`exit 1`** (which will fail a CI/CD build).

---

## Verification Plan

### Automated Verification
1. Run `./compare.sh` to verify that a fresh install matches a migrated install.
2. Verify that changing a column type or adding a table in one database and running the comparison script successfully flags the difference and exits with code `1`.

### Manual Verification
* Access `http://localhost:3000` to verify standard local operation.
