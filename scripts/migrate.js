const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

// Read database configuration from connection string or defaults
const connectionString = process.env.DATABASE_URL || {
  host: process.env.PGHOST || 'localhost',
  port: parseInt(process.env.PGPORT || '5432', 10),
  user: process.env.PGUSER || 'postgres',
  password: process.env.PGPASSWORD || 'postgres',
  database: process.env.PGDATABASE || 'postgres',
};

async function run() {
  const client = new Client(
    typeof connectionString === 'string' 
      ? { connectionString } 
      : connectionString
  );

  try {
    console.log('Connecting to PostgreSQL database...');
    await client.connect();
    console.log('Connected successfully.');

    // 1. Create schema_migrations tracker table if it doesn't exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version VARCHAR(255) PRIMARY KEY,
        applied_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
      );
    `);

    // 2. Read all SQL migrations
    const migrationsDir = path.join(__dirname, '../migrations');
    if (!fs.existsSync(migrationsDir)) {
      console.log('No migrations directory found. Exiting.');
      return;
    }

    const files = fs.readdirSync(migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort(); // Sorts files alphabetically (e.g., 0001, 0002)

    if (files.length === 0) {
      console.log('No SQL migration files found.');
      return;
    }

    // 3. Get already applied migrations
    const { rows } = await client.query('SELECT version FROM schema_migrations');
    const appliedVersions = new Set(rows.map(row => row.version));

    // 4. Apply pending migrations sequentially
    for (const file of files) {
      const version = path.basename(file, '.sql');
      
      if (appliedVersions.has(version)) {
        console.log(`Migration ${version} is already applied.`);
        continue;
      }

      console.log(`Applying migration: ${version}...`);
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');

      // Execute SQL migration in a transaction
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query(
          'INSERT INTO schema_migrations (version) VALUES ($1)',
          [version]
        );
        await client.query('COMMIT');
        console.log(`Successfully applied migration ${version}.`);
      } catch (err) {
        await client.query('ROLLBACK');
        console.error(`Error applying migration ${version}. Rolling back transaction.`);
        throw err;
      }
    }

    console.log('All migrations checked and up-to-date.');
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();
