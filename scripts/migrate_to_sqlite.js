const sqlite3 = require('better-sqlite3');
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

// Configuration
const SQLITE_DB_PATH = path.join(__dirname, '../school.db');
const SCHEMA_PATH = path.join(__dirname, '../sqlite_schema.sql');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Error: Missing Supabase environment variables in .env.local');
  process.exit(1);
}

const db = new sqlite3(SQLITE_DB_PATH);
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function migrate() {
  console.log('🚀 Starting Supabase to SQLite migration...');

  // 1. Initialize Schema
  console.log('📄 Initializing SQLite schema...');
  const schema = fs.readFileSync(SCHEMA_PATH, 'utf8');
  db.exec(schema);

  const tables = [
    'profiles', 
    'classes', 
    'courses', 
    'students', 
    'teachers', 
    'exams', 
    'exam_results', 
    'attendance'
  ];

  // Optional: Migrate Auth Users (Requires SERVICE_ROLE_KEY)
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (serviceRoleKey) {
    console.log('🔐 Service Role Key found. Attempting to migrate Auth Users...');
    const adminSupabase = createClient(supabaseUrl, serviceRoleKey);
    const { data: authUsers, error: authError } = await adminSupabase.auth.admin.listUsers();
    
    if (authError) {
      console.error('❌ Error listing auth users:', authError.message);
    } else if (authUsers && authUsers.users) {
      const insertAuth = db.prepare(`INSERT OR REPLACE INTO auth_users (id, email, created_at) VALUES (?, ?, ?)`);
      const migrateAuth = db.transaction((users) => {
        for (const user of users) {
          insertAuth.run(user.id, user.email, user.created_at);
        }
      });
      migrateAuth(authUsers.users);
      console.log(`✅ Migrated ${authUsers.users.length} auth users.`);
    }
  } else {
    console.warn('⚠️ No SUPABASE_SERVICE_ROLE_KEY found. Skipping Auth User migration.');
    console.log('   (Profiles will still be migrated, but login will require password setup)');
  }

  for (const table of tables) {
    let allData = [];
    let from = 0;
    const step = 1000;
    let hasMore = true;

    process.stdout.write(`Fetching ${table}... `);

    while (hasMore) {
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .range(from, from + step - 1);
      
      if (error) {
          console.error(`\n❌ Error fetching ${table}:`, error.message);
          hasMore = false;
          continue;
      }

      if (data && data.length > 0) {
        allData = allData.concat(data);
        if (data.length < step) {
          hasMore = false;
        } else {
          from += step;
        }
      } else {
        hasMore = false;
      }
    }

    if (allData.length > 0) {
      process.stdout.write(`Importing ${allData.length} rows... `);
      
      const columns = Object.keys(allData[0]);
      const placeholders = columns.map(() => '?').join(',');
      const insertStmt = db.prepare(`INSERT OR REPLACE INTO ${table} (${columns.map(c => `"${c}"`).join(',')}) VALUES (${placeholders})`);
      
      const insertMany = db.transaction((items) => {
        for (const item of items) {
            const values = columns.map(col => item[col]);
            insertStmt.run(...values);
        }
      });

      insertMany(allData);
      console.log('✅ Done');
    } else {
      console.log('Empty (Skipped)');
    }
  }

  console.log('\n✨ Migration complete!');
  console.log(`📂 SQLite database saved to: ${SQLITE_DB_PATH}`);
  console.log('Next steps:');
  console.log('1. Install better-sqlite3 if not already present.');
  console.log('2. Update your API layer to use this local database.');
}

migrate().catch(err => {
  console.error('\n💥 Critical Error during migration:', err);
  process.exit(1);
});
