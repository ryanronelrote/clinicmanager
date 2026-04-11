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
  {
    name: '011_invoices_table',
    sql: `
      CREATE TABLE IF NOT EXISTS invoices (
        id SERIAL PRIMARY KEY,
        appointment_id INTEGER REFERENCES appointments(id) ON DELETE SET NULL,
        patient_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
        total_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
        amount_paid NUMERIC(12,2) NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'unpaid',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      DO $$ BEGIN
        ALTER TABLE invoices ADD CONSTRAINT chk_invoices_status
          CHECK (status IN ('unpaid', 'partial', 'paid'));
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
      DO $$ BEGIN
        CREATE TRIGGER update_invoices_updated_at
          BEFORE UPDATE ON invoices
          FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `,
  },
  {
    name: '012_invoice_items_table',
    sql: `
      CREATE TABLE IF NOT EXISTS invoice_items (
        id SERIAL PRIMARY KEY,
        invoice_id INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        quantity NUMERIC(10,2) NOT NULL DEFAULT 1,
        unit_price NUMERIC(12,2) NOT NULL DEFAULT 0,
        total_price NUMERIC(12,2) NOT NULL DEFAULT 0
      );
      CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice_id ON invoice_items(invoice_id);
    `,
  },
  {
    name: '013_payments_table',
    sql: `
      CREATE TABLE IF NOT EXISTS payments (
        id SERIAL PRIMARY KEY,
        invoice_id INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
        amount NUMERIC(12,2) NOT NULL,
        payment_method TEXT NOT NULL DEFAULT 'cash',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      DO $$ BEGIN
        ALTER TABLE payments ADD CONSTRAINT chk_payments_method
          CHECK (payment_method IN ('cash', 'gcash', 'card'));
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
      CREATE INDEX IF NOT EXISTS idx_payments_invoice_id ON payments(invoice_id);
    `,
  },
  {
    name: '014_invoices_indexes',
    sql: `
      CREATE INDEX IF NOT EXISTS idx_invoices_patient_id ON invoices(patient_id);
      CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
      CREATE INDEX IF NOT EXISTS idx_invoices_appointment_id ON invoices(appointment_id);
      CREATE INDEX IF NOT EXISTS idx_invoices_created_at ON invoices(created_at);
    `,
  },
  {
    name: '015_invoices_created_by',
    sql: `ALTER TABLE invoices ADD COLUMN IF NOT EXISTS created_by TEXT NOT NULL DEFAULT '';`,
  },
  {
    name: '016_payments_received_by',
    sql: `ALTER TABLE payments ADD COLUMN IF NOT EXISTS received_by TEXT NOT NULL DEFAULT '';`,
  },
  {
    name: '017_staff_table',
    sql: `
      CREATE TABLE IF NOT EXISTS staff (
        id         SERIAL PRIMARY KEY,
        name       TEXT NOT NULL,
        role       TEXT NOT NULL DEFAULT '',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `,
  },
  {
    name: '018_invoice_and_payment_dates',
    sql: `
      ALTER TABLE invoices ADD COLUMN IF NOT EXISTS invoice_date DATE;
      UPDATE invoices SET invoice_date = (created_at AT TIME ZONE 'Asia/Manila')::date WHERE invoice_date IS NULL;
      ALTER TABLE invoices ALTER COLUMN invoice_date SET DEFAULT ((CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Manila')::date);
      ALTER TABLE invoices ALTER COLUMN invoice_date SET NOT NULL;

      ALTER TABLE payments ADD COLUMN IF NOT EXISTS payment_date DATE;
      UPDATE payments SET payment_date = (created_at AT TIME ZONE 'Asia/Manila')::date WHERE payment_date IS NULL;
      ALTER TABLE payments ALTER COLUMN payment_date SET DEFAULT ((CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Manila')::date);
      ALTER TABLE payments ALTER COLUMN payment_date SET NOT NULL;

      CREATE INDEX IF NOT EXISTS idx_invoices_invoice_date ON invoices(invoice_date);
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
