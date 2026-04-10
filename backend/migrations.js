const migrations = [
  {
    name: '001_add_updated_at',
    sql: `ALTER TABLE appointments ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`,
  },
  {
    name: '002_updated_at_trigger',
    sql: `
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = CURRENT_TIMESTAMP;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      DO $$ BEGIN
        CREATE TRIGGER update_appointments_updated_at
          BEFORE UPDATE ON appointments
          FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `,
  },
  {
    name: '003_fk_client_id',
    sql: `
      DELETE FROM appointments WHERE client_id NOT IN (SELECT id FROM clients);
      DO $$ BEGIN
        ALTER TABLE appointments ADD CONSTRAINT fk_appointments_client_id
          FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE RESTRICT;
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `,
  },
  {
    name: '004_check_status',
    sql: `
      UPDATE appointments SET status = 'confirmed'
        WHERE status NOT IN ('confirmed','confirmed_by_client','done','cancelled','cancelled_by_client');
      DO $$ BEGIN
        ALTER TABLE appointments ADD CONSTRAINT chk_appointments_status
          CHECK (status IN ('confirmed','confirmed_by_client','done','cancelled','cancelled_by_client'));
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `,
  },
  {
    name: '005_check_duration',
    sql: `
      DO $$ BEGIN
        ALTER TABLE appointments ADD CONSTRAINT chk_appointments_duration
          CHECK (duration_minutes > 0 AND duration_minutes <= 480);
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `,
  },
  {
    name: '006_performance_indexes',
    sql: `
      CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(date);
      CREATE INDEX IF NOT EXISTS idx_appointments_client_id ON appointments(client_id);
      CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments(status);
      CREATE INDEX IF NOT EXISTS idx_appointments_therapist_date
        ON appointments(therapist, date) WHERE therapist IS NOT NULL;
    `,
  },
  {
    name: '007_add_tentative_status',
    sql: `
      ALTER TABLE appointments DROP CONSTRAINT IF EXISTS chk_appointments_status;
      ALTER TABLE appointments ADD CONSTRAINT chk_appointments_status
        CHECK (status IN ('tentative','confirmed','confirmed_by_client','done','cancelled','cancelled_by_client'));
    `,
  },
  {
    name: '008_therapists_table',
    sql: `
      CREATE TABLE IF NOT EXISTS therapists (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `,
  },
  {
    name: '009_therapist_schedules_table',
    sql: `
      CREATE TABLE IF NOT EXISTS therapist_schedules (
        id SERIAL PRIMARY KEY,
        therapist_id INTEGER NOT NULL REFERENCES therapists(id) ON DELETE CASCADE,
        date TEXT NOT NULL,
        shift_type TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(therapist_id, date)
      )
    `,
  },
  {
    name: '010_therapist_schedules_updated_at_trigger',
    sql: `
      DO $$ BEGIN
        CREATE TRIGGER update_therapist_schedules_updated_at
          BEFORE UPDATE ON therapist_schedules
          FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `,
  },
];

async function runMigrations(pool) {
  // Create migrations tracking table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name TEXT PRIMARY KEY,
      applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  const { rows: applied } = await pool.query('SELECT name FROM schema_migrations');
  const appliedSet = new Set(applied.map(r => r.name));

  for (const migration of migrations) {
    if (appliedSet.has(migration.name)) continue;

    try {
      await pool.query(migration.sql);
      await pool.query('INSERT INTO schema_migrations (name) VALUES ($1)', [migration.name]);
      console.log(`[Migration] Applied: ${migration.name}`);
    } catch (err) {
      // If constraint/trigger already exists, mark as applied and continue
      if (err.code === '42710' || err.code === '42P07') {
        await pool.query('INSERT INTO schema_migrations (name) VALUES ($1) ON CONFLICT DO NOTHING', [migration.name]);
        console.log(`[Migration] Skipped (already exists): ${migration.name}`);
      } else {
        console.error(`[Migration] FAILED: ${migration.name}`, err.message);
        throw err;
      }
    }
  }

  console.log('[Migration] All migrations up to date');
}

module.exports = { runMigrations };
