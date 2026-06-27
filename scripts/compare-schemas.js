const { Client } = require('pg');

const urlA = process.env.DATABASE_URL_A;
const urlB = process.env.DATABASE_URL_B;

if (!urlA || !urlB) {
  console.error('Error: Please provide DATABASE_URL_A and DATABASE_URL_B environment variables.');
  process.exit(1);
}

async function getSchema(connectionString) {
  const client = new Client({ connectionString });
  await client.connect();

  try {
    // 1. Fetch tables and columns
    const { rows: columns } = await client.query(`
      SELECT 
        table_schema, table_name, column_name, data_type, is_nullable, column_default
      FROM 
        information_schema.columns
      WHERE 
        table_schema IN ('public', 'auth') AND
        table_name NOT IN ('schema_migrations')
      ORDER BY 
        table_schema, table_name, column_name;
    `);

    // 2. Fetch RLS policies
    const { rows: policies } = await client.query(`
      SELECT 
        schemaname, tablename, policyname, roles, cmd, qual, with_check
      FROM 
        pg_policies
      WHERE 
        schemaname IN ('public', 'auth')
      ORDER BY 
        schemaname, tablename, policyname;
    `);

    // 3. Fetch constraints
    const { rows: constraints } = await client.query(`
      SELECT
        tc.table_schema, tc.table_name, kcu.column_name, tc.constraint_type
      FROM 
        information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name
      WHERE 
        tc.table_schema IN ('public', 'auth') AND
        tc.table_name NOT IN ('schema_migrations')
      ORDER BY 
        tc.table_schema, tc.table_name, kcu.column_name, tc.constraint_type;
    `);

    return { columns, policies, constraints };
  } finally {
    await client.end();
  }
}

function diffObjects(label, listA, listB, matchKeyFn) {
  const mapA = new Map(listA.map(item => [matchKeyFn(item), item]));
  const mapB = new Map(listB.map(item => [matchKeyFn(item), item]));

  const missingInB = [];
  const missingInA = [];
  const mismatched = [];

  // Check items in A
  for (const [key, itemA] of mapA) {
    if (!mapB.has(key)) {
      missingInB.push(itemA);
    } else {
      const itemB = mapB.get(key);
      const strA = JSON.stringify(itemA);
      const strB = JSON.stringify(itemB);
      if (strA !== strB) {
        mismatched.push({ key, itemA, itemB });
      }
    }
  }

  // Check items in B
  for (const [key, itemB] of mapB) {
    if (!mapA.has(key)) {
      missingInA.push(itemB);
    }
  }

  return { label, missingInA, missingInB, mismatched };
}

async function main() {
  try {
    console.log('Fetching schema from Database A (Fresh)...');
    const schemaA = await getSchema(urlA);

    console.log('Fetching schema from Database B (Migrated)...');
    const schemaB = await getSchema(urlB);

    console.log('Comparing database structures...');

    // Diff columns
    const columnsDiff = diffObjects(
      'Columns',
      schemaA.columns,
      schemaB.columns,
      c => `${c.table_schema}.${c.table_name}.${c.column_name}`
    );

    // Diff policies
    const policiesDiff = diffObjects(
      'RLS Policies',
      schemaA.policies,
      schemaB.policies,
      p => `${p.schemaname}.${p.tablename}.${p.policyname}`
    );

    // Diff constraints
    const constraintsDiff = diffObjects(
      'Constraints',
      schemaA.constraints,
      schemaB.constraints,
      c => `${c.table_schema}.${c.table_name}.${c.column_name}.${c.constraint_type}`
    );

    const allDiffs = [columnsDiff, policiesDiff, constraintsDiff];
    let hasDifference = false;

    for (const diff of allDiffs) {
      const totalChanges = diff.missingInA.length + diff.missingInB.length + diff.mismatched.length;
      if (totalChanges > 0) {
        hasDifference = true;
        console.error(`\n❌ Difference detected in ${diff.label}:`);
        
        if (diff.missingInB.length > 0) {
          console.error(`  Missing in Database B (Migrated):`);
          diff.missingInB.forEach(item => console.error(`    - ${JSON.stringify(item)}`));
        }

        if (diff.missingInA.length > 0) {
          console.error(`  Unexpected extra item in Database B (Migrated):`);
          diff.missingInA.forEach(item => console.error(`    + ${JSON.stringify(item)}`));
        }

        if (diff.mismatched.length > 0) {
          console.error(`  Mismatched attributes (A vs B):`);
          diff.mismatched.forEach(m => {
            console.error(`    * Key: ${m.key}`);
            console.error(`      Fresh (A):    ${JSON.stringify(m.itemA)}`);
            console.error(`      Migrated (B): ${JSON.stringify(m.itemB)}`);
          });
        }
      }
    }

    if (hasDifference) {
      console.error('\n❌ Schemas DO NOT match. Schema drift detected!');
      process.exit(1);
    } else {
      console.log('\n✅ Schemas match perfectly! Fresh and Migrated structures are identical.');
      process.exit(0);
    }
  } catch (err) {
    console.error('Comparison error:', err);
    process.exit(1);
  }
}

main();
