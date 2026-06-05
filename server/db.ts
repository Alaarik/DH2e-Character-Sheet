import Database, { type Database as DatabaseType } from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_PATH = path.join(DATA_DIR, 'charsheet.db');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const db: DatabaseType = new Database(DB_PATH);

// Enable WAL mode for better performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    discord_id TEXT PRIMARY KEY,
    username TEXT NOT NULL,
    avatar_url TEXT,
    last_login TEXT
  );

  CREATE TABLE IF NOT EXISTS characters (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    discord_user_id TEXT NOT NULL REFERENCES users(discord_id),
    name TEXT NOT NULL,
    portrait_url TEXT,
    psy_rating INTEGER,
    psyker_type TEXT CHECK(psyker_type IN ('Bound','Unbound','Daemonic')),
    psy_focus INTEGER DEFAULT 0,
    theme_color TEXT DEFAULT '#8b5cf6',
    wounds INTEGER,
    fate_points_current INTEGER,
    fate_points_max INTEGER,
    fatigue INTEGER DEFAULT 0,
    corruption INTEGER DEFAULT 0,
    insanity_points INTEGER DEFAULT 0,
    influence INTEGER DEFAULT 0,
    heretic_pips INTEGER DEFAULT 0,
    corr_khorne INTEGER DEFAULT 0,
    corr_nurgle INTEGER DEFAULT 0,
    corr_slaanesh INTEGER DEFAULT 0,
    corr_tzeentch INTEGER DEFAULT 0,
    corr_scorn INTEGER DEFAULT 0,
    corr_test_30 BOOLEAN DEFAULT 0,
    corr_test_60 BOOLEAN DEFAULT 0,
    corr_test_90 BOOLEAN DEFAULT 0,
    insanity_tests TEXT DEFAULT '[]',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    UNIQUE(discord_user_id, name)
  );

  CREATE TABLE IF NOT EXISTS characteristics (
    character_id INTEGER NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
    abbrev TEXT NOT NULL,
    base INTEGER DEFAULT 0,
    modifier INTEGER DEFAULT 0,
    talent INTEGER DEFAULT 0,
    advances INTEGER DEFAULT 0,
    total INTEGER DEFAULT 0,
    unnatural INTEGER DEFAULT 0,
    bonus INTEGER DEFAULT 0,
    temp_damage INTEGER DEFAULT 0,
    perm_damage INTEGER DEFAULT 0,
    PRIMARY KEY (character_id, abbrev)
  );

  CREATE TABLE IF NOT EXISTS skills (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    character_id INTEGER NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    characteristic TEXT NOT NULL,
    category TEXT DEFAULT 'General',
    talent INTEGER DEFAULT 0,
    trained BOOLEAN DEFAULT 0,
    plus_10 BOOLEAN DEFAULT 0,
    plus_20 BOOLEAN DEFAULT 0,
    plus_30 BOOLEAN DEFAULT 0,
    total INTEGER DEFAULT 0,
    UNIQUE(character_id, name)
  );

  CREATE TABLE IF NOT EXISTS weapons (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    character_id INTEGER NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    alias TEXT,
    display_name TEXT NOT NULL,
    category TEXT NOT NULL CHECK(category IN ('Melee','Ranged')),
    family TEXT,
    weapon_class TEXT,
    range TEXT,
    rof TEXT,
    damage TEXT,
    type TEXT,
    pen INTEGER,
    magazine INTEGER,
    qualities TEXT,
    weight TEXT,
    mods TEXT,
    image_url TEXT,
    is_equipped BOOLEAN DEFAULT 0,
    quality TEXT DEFAULT 'Common'
  );

  CREATE TABLE IF NOT EXISTS powers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    character_id INTEGER NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    discipline TEXT,
    technique TEXT,
    UNIQUE(character_id, name)
  );

  CREATE TABLE IF NOT EXISTS character_armor (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    character_id INTEGER NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
    location TEXT,
    name TEXT NOT NULL,
    ap INTEGER NOT NULL DEFAULT 0,
    quality TEXT DEFAULT 'Common'
  );

  CREATE TABLE IF NOT EXISTS inventory_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    character_id INTEGER NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    quantity INTEGER DEFAULT 1,
    weight TEXT,
    category TEXT DEFAULT 'Gear',
    quality TEXT DEFAULT 'Common',
    effects TEXT,
    used_with TEXT
  );

  CREATE TABLE IF NOT EXISTS talents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    character_id INTEGER NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    specialisation TEXT,
    tier INTEGER DEFAULT 1,
    description TEXT,
    prerequisites TEXT
  );

  CREATE TABLE IF NOT EXISTS xp_purchases (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    character_id INTEGER NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
    category TEXT NOT NULL,
    name TEXT NOT NULL,
    advance_level TEXT NOT NULL,
    xp_cost INTEGER NOT NULL DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  );
`);

export default db;

// Migrations — add columns that may not exist in older databases
try {
  db.exec(`ALTER TABLE characteristics ADD COLUMN modifier INTEGER DEFAULT 0`);
} catch {
  // Column already exists — safe to ignore
}
try {
  db.exec(`ALTER TABLE characters ADD COLUMN influence INTEGER DEFAULT 0`);
} catch {
  // Column already exists
}
try {
  db.exec(`ALTER TABLE weapons ADD COLUMN image_url TEXT`);
} catch {
  // Column already exists
}
try {
  db.exec(`ALTER TABLE characters ADD COLUMN current_focus TEXT DEFAULT 'Unfettered'`);
} catch {}
try {
  db.exec(`ALTER TABLE characters ADD COLUMN current_push_amount INTEGER DEFAULT 0`);
} catch {}
try {
  db.exec(`ALTER TABLE characters ADD COLUMN main_discipline TEXT`);
} catch {}
try {
  db.exec(`ALTER TABLE characteristics ADD COLUMN temp_damage INTEGER DEFAULT 0`);
} catch {}
try {
  db.exec(`ALTER TABLE characteristics ADD COLUMN perm_damage INTEGER DEFAULT 0`);
} catch {}
try {
  db.exec(`ALTER TABLE characters ADD COLUMN heretic_pips INTEGER DEFAULT 0`);
} catch {}
try {
  db.exec(`ALTER TABLE characters ADD COLUMN corr_khorne INTEGER DEFAULT 0`);
  db.exec(`ALTER TABLE characters ADD COLUMN corr_nurgle INTEGER DEFAULT 0`);
  db.exec(`ALTER TABLE characters ADD COLUMN corr_slaanesh INTEGER DEFAULT 0`);
  db.exec(`ALTER TABLE characters ADD COLUMN corr_tzeentch INTEGER DEFAULT 0`);
  db.exec(`ALTER TABLE characters ADD COLUMN corr_scorn INTEGER DEFAULT 0`);
} catch {}
try {
  db.exec(`ALTER TABLE characters ADD COLUMN corr_test_30 BOOLEAN DEFAULT 0`);
  db.exec(`ALTER TABLE characters ADD COLUMN corr_test_60 BOOLEAN DEFAULT 0`);
  db.exec(`ALTER TABLE characters ADD COLUMN corr_test_90 BOOLEAN DEFAULT 0`);
} catch {}
try {
  db.exec(`ALTER TABLE characters ADD COLUMN insanity_tests TEXT DEFAULT '[]'`);
} catch {}
try {
  db.exec(`ALTER TABLE characters ADD COLUMN total_xp INTEGER DEFAULT 0`);
} catch {}
try {
  db.exec(`ALTER TABLE characters ADD COLUMN aptitudes TEXT DEFAULT '[]'`);
} catch {}
try {
  db.exec(`ALTER TABLE characters ADD COLUMN traits TEXT DEFAULT '[]'`);
} catch {}
try {
  db.exec(`ALTER TABLE characters ADD COLUMN elite_advances TEXT DEFAULT '[]'`);
} catch {}
try {
  db.exec(`ALTER TABLE characters ADD COLUMN cybernetics TEXT DEFAULT '[]'`);
} catch {}
try {
  db.exec(`ALTER TABLE talents ADD COLUMN source TEXT`);
} catch {}
try {
  db.exec(`ALTER TABLE weapons ADD COLUMN ammo TEXT DEFAULT '[]'`);
} catch {}
try {
  db.exec(`ALTER TABLE character_armor ADD COLUMN mods TEXT DEFAULT '[]'`);
} catch {}
try {
  db.exec(`ALTER TABLE weapons ADD COLUMN is_equipped BOOLEAN DEFAULT 0`);
} catch {}
try {
  db.exec(`ALTER TABLE inventory_items ADD COLUMN quality TEXT DEFAULT 'Common'`);
} catch {}
try {
  db.exec(`ALTER TABLE inventory_items ADD COLUMN effects TEXT`);
} catch {}
try {
  db.exec(`ALTER TABLE inventory_items ADD COLUMN used_with TEXT`);
} catch {}
try {
  db.exec(`ALTER TABLE weapons ADD COLUMN quality TEXT DEFAULT 'Common'`);
} catch {}
try {
  db.exec(`ALTER TABLE character_armor ADD COLUMN quality TEXT DEFAULT 'Common'`);
} catch {}
try {
  // Migrate character_armor to remove UNIQUE constraint and location CHECK
  // SQLite doesn't support DROP CONSTRAINT, so we must recreate the table
  // We check if it still has the UNIQUE index. If so, we migrate.
  const pragma = db.prepare(`PRAGMA index_list('character_armor')`).all() as any[];
  const hasUnique = pragma.some(p => p.unique === 1);
  
  if (hasUnique) {
    db.exec(`
      CREATE TABLE character_armor_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        character_id INTEGER NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
        location TEXT,
        name TEXT NOT NULL,
        ap INTEGER NOT NULL DEFAULT 0,
        quality TEXT DEFAULT 'Common',
        mods TEXT DEFAULT '[]'
      );
      INSERT INTO character_armor_new SELECT id, character_id, location, name, ap, quality, mods FROM character_armor;
      DROP TABLE character_armor;
      ALTER TABLE character_armor_new RENAME TO character_armor;
    `);
  }
} catch (e) {
  console.error("Failed to migrate armor table", e);
}
