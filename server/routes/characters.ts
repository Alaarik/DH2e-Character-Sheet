import { Router, Request, Response } from 'express';
import db from '../db.js';
import { authMiddleware } from '../middleware/auth.js';
import { importFromGoogleSheet } from '../import.js';

const router = Router();

// All routes require auth
router.use(authMiddleware);

// GET /api/characters — List all characters for current user
router.get('/', (req: Request, res: Response) => {
  const userId = req.user!.discord_id;
  const characters = db.prepare(`
    SELECT id, name, portrait_url, theme_color, psy_rating, wounds, fate_points_current, fate_points_max, influence
    FROM characters WHERE discord_user_id = ? ORDER BY name
  `).all(userId);
  res.json(characters);
});

// GET /api/characters/:id — Full character data
router.get('/:id', (req: Request, res: Response) => {
  const userId = req.user!.discord_id;
  const charId = parseInt(req.params.id as string);

  const character = db.prepare(`
    SELECT * FROM characters WHERE id = ? AND discord_user_id = ?
  `).get(charId, userId) as Record<string, unknown> | undefined;

  if (!character) {
    res.status(404).json({ error: 'Character not found' });
    return;
  }

  if (typeof character.insanity_tests === 'string') {
    try {
      character.insanity_tests = JSON.parse(character.insanity_tests);
    } catch {
      character.insanity_tests = [];
    }
  } else {
    character.insanity_tests = Array.isArray(character.insanity_tests) ? character.insanity_tests : [];
  }

  if (typeof character.aptitudes === 'string') {
    try {
      character.aptitudes = JSON.parse(character.aptitudes);
    } catch {
      character.aptitudes = [];
    }
  } else {
    character.aptitudes = Array.isArray(character.aptitudes) ? character.aptitudes : [];
  }

  if (typeof character.traits === 'string') {
    try {
      character.traits = JSON.parse(character.traits);
    } catch {
      character.traits = [];
    }
  } else {
    character.traits = Array.isArray(character.traits) ? character.traits : [];
  }

  if (typeof character.elite_advances === 'string') {
    try {
      character.elite_advances = JSON.parse(character.elite_advances);
    } catch {
      character.elite_advances = [];
    }
  } else {
    character.elite_advances = Array.isArray(character.elite_advances) ? character.elite_advances : [];
  }

  if (typeof character.cybernetics === 'string') {
    try {
      character.cybernetics = JSON.parse(character.cybernetics);
    } catch {
      character.cybernetics = [];
    }
  } else {
    character.cybernetics = Array.isArray(character.cybernetics) ? character.cybernetics : [];
  }

  const characteristics = db.prepare(`
    SELECT * FROM characteristics WHERE character_id = ? ORDER BY
      CASE abbrev
        WHEN 'WS' THEN 1 WHEN 'BS' THEN 2 WHEN 'S' THEN 3
        WHEN 'T' THEN 4 WHEN 'AG' THEN 5 WHEN 'INT' THEN 6
        WHEN 'PER' THEN 7 WHEN 'WP' THEN 8 WHEN 'FEL' THEN 9
      END
  `).all(charId);

  const skills = db.prepare(`
    SELECT * FROM skills WHERE character_id = ? ORDER BY category, name
  `).all(charId);

  const weapons = db.prepare(`
    SELECT * FROM weapons WHERE character_id = ? ORDER BY category, name
  `).all(charId) as any[];
  weapons.forEach(w => {
    w.mods = w.mods ? (() => { try { return JSON.parse(w.mods); } catch { return []; } })() : [];
    w.ammo = w.ammo ? (() => { try { return JSON.parse(w.ammo); } catch { return []; } })() : [];
  });

  const powers = db.prepare(`
    SELECT * FROM powers WHERE character_id = ? ORDER BY discipline, name
  `).all(charId);

  const armor = db.prepare(`
    SELECT * FROM character_armor WHERE character_id = ? ORDER BY location
  `).all(charId) as any[];
  armor.forEach(a => {
    a.mods = a.mods ? (() => { try { return JSON.parse(a.mods); } catch { return []; } })() : [];
  });

  const inventoryRaw = db.prepare(`
    SELECT * FROM inventory_items WHERE character_id = ? ORDER BY category, name
  `).all(charId) as any[];

  const inventory = inventoryRaw.map((item: any) => ({
    ...item,
    effects: item.effects ? JSON.parse(item.effects) : undefined,
    usedWith: item.used_with || undefined,
  }));

  const talents = db.prepare(`
    SELECT * FROM talents WHERE character_id = ? ORDER BY tier, name
  `).all(charId);

  const xp_purchases = db.prepare(`
    SELECT * FROM xp_purchases WHERE character_id = ? ORDER BY created_at DESC
  `).all(charId);

  res.json({
    ...character,
    characteristics,
    skills,
    weapons,
    powers,
    armor,
    inventory,
    talents,
    xp_purchases,
  });
});

// POST /api/characters — Create new character
router.post('/', (req: Request, res: Response) => {
  const userId = req.user!.discord_id;
  const { name, portrait_url, theme_color, characteristics, aptitudes, skills, talents, weapons, armor, inventory, total_xp, homeworld, background, role, fate_points_max, wounds, psy_rating, traits, elite_advances, influence } = req.body;

  if (!name) {
    res.status(400).json({ error: 'Character name is required' });
    return;
  }

  try {
    const result = db.prepare(`
      INSERT INTO characters (discord_user_id, name, portrait_url, theme_color, total_xp, aptitudes, fate_points_current, fate_points_max, wounds, psy_rating, traits, elite_advances, influence, insanity_points, corruption)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      userId, name, portrait_url || null, theme_color || '#8b5cf6',
      total_xp || 0,
      JSON.stringify(aptitudes || []),
      fate_points_max || 0,
      fate_points_max || 0,
      wounds || null,
      psy_rating || null,
      JSON.stringify(traits || []),
      JSON.stringify(elite_advances || []),
      influence || 0,
      req.body.insanity_points || 0,
      req.body.corruption || 0
    );

    const charId = result.lastInsertRowid;

    // Initialize 9 characteristics
    const insertChar = db.prepare(`
      INSERT INTO characteristics (character_id, abbrev, base, total, bonus) VALUES (?, ?, ?, ?, ?)
    `);
    const charValues = characteristics || {};
    for (const abbrev of ['WS', 'BS', 'S', 'T', 'AG', 'INT', 'PER', 'WP', 'FEL']) {
      const val = parseInt(charValues[abbrev]) || 0;
      insertChar.run(charId, abbrev, val, val, Math.floor(val / 10));
    }

    // Insert skills if provided
    if (skills && Array.isArray(skills)) {
      const insertSkill = db.prepare(`
        INSERT INTO skills (character_id, name, characteristic, category, trained, plus_10, plus_20, plus_30, total) VALUES (?, ?, ?, ?, 1, ?, 0, 0, ?)
      `);
      for (const s of skills) {
        const charStat = parseInt(charValues[s.characteristic]) || 0;
        const isPlus10 = s.plus_10 ? 1 : 0;
        const total = charStat + (isPlus10 ? 10 : 0);
        insertSkill.run(charId, s.name, s.characteristic, s.category || 'General', isPlus10, total);
      }
    }

    // Insert talents if provided
    if (talents && Array.isArray(talents)) {
      const insertTalent = db.prepare(`
        INSERT INTO talents (character_id, name, specialisation, tier, description, prerequisites, source)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      for (const t of talents) {
        insertTalent.run(charId, t.name, t.specialisation || null, t.tier || 1, t.description || null, t.prerequisites || null, null);
      }
    }

    // Insert weapons if provided
    if (weapons && Array.isArray(weapons)) {
      const insertWeapon = db.prepare(`
        INSERT INTO weapons (character_id, name, alias, display_name, category, family, weapon_class, range, rof, damage, type, pen, magazine, qualities, weight, mods, ammo, image_url, is_equipped, quality)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const w of weapons) {
        insertWeapon.run(charId, w.name, w.alias || null, w.display_name || w.name,
          w.category, w.family || null, w.weapon_class || null, w.range || null,
          w.rof || null, w.damage || null, w.type || null, w.pen || null,
          w.magazine || null, w.qualities ? JSON.stringify(w.qualities) : null,
          w.weight || null,
          Array.isArray(w.mods) ? JSON.stringify(w.mods) : '[]',
          Array.isArray(w.ammo) ? JSON.stringify(w.ammo) : '[]',
          w.image_url || null, w.is_equipped ? 1 : 0, w.quality || 'Common');
      }
    }

    // Insert armor if provided
    if (armor && Array.isArray(armor)) {
      const insertArmor = db.prepare(`
        INSERT INTO character_armor (character_id, location, name, ap, mods, quality)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      for (const a of armor) {
        insertArmor.run(charId, a.location, a.name, a.ap || 0,
          Array.isArray(a.mods) ? JSON.stringify(a.mods) : '[]',
          a.quality || 'Common');
      }
    }

    // Insert inventory if provided
    if (inventory && Array.isArray(inventory)) {
      const insertItem = db.prepare(`
        INSERT INTO inventory_items (character_id, name, description, quantity, weight, category, quality, effects, used_with)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const item of inventory) {
        insertItem.run(charId, item.name, item.description || null, item.quantity || 1,
          item.weight || null, item.category || 'Gear', item.quality || 'Common',
          item.effects ? JSON.stringify(item.effects) : null,
          item.usedWith || item.used_with || null);
      }
    }

    res.status(201).json({ id: charId, name });
  } catch (err: any) {
    if (err.message?.includes('UNIQUE constraint')) {
      res.status(409).json({ error: 'Character with this name already exists' });
    } else {
      throw err;
    }
  }
});

// PUT /api/characters/:id — Update character (partial)
router.put('/:id', (req: Request, res: Response) => {
  const userId = req.user!.discord_id;
  const charId = parseInt(req.params.id as string);

  // Verify ownership
  const existing = db.prepare(`SELECT id FROM characters WHERE id = ? AND discord_user_id = ?`).get(charId, userId);
  if (!existing) {
    res.status(404).json({ error: 'Character not found' });
    return;
  }

  const {
    name, portrait_url, theme_color, psy_rating, psyker_type, psy_focus, main_discipline,
    wounds, fate_points_current, fate_points_max, fatigue, corruption, insanity_points, influence,
    current_focus, current_push_amount,
    heretic_pips, corr_khorne, corr_nurgle, corr_slaanesh, corr_tzeentch, corr_scorn,
    corr_test_30, corr_test_60, corr_test_90, insanity_tests,
    total_xp, aptitudes,
    characteristics, skills, weapons, powers, armor,
    inventory, talents, xp_purchases, traits, elite_advances, cybernetics
  } = req.body;

  // Update character base fields
  const updates: string[] = [];
  const values: any[] = [];

  const fields: Record<string, any> = {
    name, portrait_url, theme_color, psy_rating, psyker_type, psy_focus, main_discipline,
    wounds, fate_points_current, fate_points_max, fatigue, corruption, insanity_points, influence,
    current_focus, current_push_amount,
    heretic_pips, corr_khorne, corr_nurgle, corr_slaanesh, corr_tzeentch, corr_scorn,
    corr_test_30: corr_test_30 === true || corr_test_30 === 1 ? 1 : (corr_test_30 === false || corr_test_30 === 0 ? 0 : undefined),
    corr_test_60: corr_test_60 === true || corr_test_60 === 1 ? 1 : (corr_test_60 === false || corr_test_60 === 0 ? 0 : undefined),
    corr_test_90: corr_test_90 === true || corr_test_90 === 1 ? 1 : (corr_test_90 === false || corr_test_90 === 0 ? 0 : undefined),
    insanity_tests: Array.isArray(insanity_tests) ? JSON.stringify(insanity_tests) : undefined,
    total_xp,
    aptitudes: Array.isArray(aptitudes) ? JSON.stringify(aptitudes) : undefined,
    traits: Array.isArray(traits) ? JSON.stringify(traits) : undefined,
    elite_advances: Array.isArray(elite_advances) ? JSON.stringify(elite_advances) : undefined,
    cybernetics: Array.isArray(cybernetics) ? JSON.stringify(cybernetics) : undefined
  };

  for (const [field, value] of Object.entries(fields)) {
    if (value !== undefined) {
      updates.push(`${field} = ?`);
      values.push(value);
    }
  }

  if (updates.length > 0) {
    updates.push(`updated_at = datetime('now')`);
    values.push(charId);
    db.prepare(`UPDATE characters SET ${updates.join(', ')} WHERE id = ?`).run(...values);
  }

  // Update characteristics if provided
  if (characteristics && Array.isArray(characteristics)) {
    const upsertChar = db.prepare(`
      INSERT INTO characteristics (character_id, abbrev, base, modifier, talent, advances, total, unnatural, bonus, temp_damage, perm_damage)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(character_id, abbrev) DO UPDATE SET
        base=excluded.base, modifier=excluded.modifier, talent=excluded.talent, advances=excluded.advances,
        total=excluded.total, unnatural=excluded.unnatural, bonus=excluded.bonus,
        temp_damage=excluded.temp_damage, perm_damage=excluded.perm_damage
    `);
    for (const c of characteristics) {
      upsertChar.run(charId, c.abbrev, c.base || 0, c.modifier || 0, c.talent || 0, c.advances || 0, c.total || 0, c.unnatural || 0, c.bonus || 0, c.temp_damage || 0, c.perm_damage || 0);
    }
  }

  // Update skills if provided (replace all)
  if (skills && Array.isArray(skills)) {
    db.prepare(`DELETE FROM skills WHERE character_id = ?`).run(charId);
    const insertSkill = db.prepare(`
      INSERT INTO skills (character_id, name, characteristic, category, talent, trained, plus_10, plus_20, plus_30, total)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const s of skills) {
      insertSkill.run(charId, s.name, s.characteristic, s.category || 'General', s.talent || 0,
        s.trained ? 1 : 0, s.plus_10 ? 1 : 0, s.plus_20 ? 1 : 0, s.plus_30 ? 1 : 0, s.total || 0);
    }
  }

  // Update weapons if provided (replace all)
  if (weapons && Array.isArray(weapons)) {
    db.prepare(`DELETE FROM weapons WHERE character_id = ?`).run(charId);
    const insertWeapon = db.prepare(`
      INSERT INTO weapons (character_id, name, alias, display_name, category, family, weapon_class, range, rof, damage, type, pen, magazine, qualities, weight, mods, ammo, image_url, is_equipped, quality)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const w of weapons) {
      insertWeapon.run(charId, w.name, w.alias || null, w.display_name || w.name,
        w.category, w.family || null, w.weapon_class || null, w.range || null,
        w.rof || null, w.damage || null, w.type || null, w.pen || null,
        w.magazine || null, w.qualities ? JSON.stringify(w.qualities) : null,
        w.weight || null,
        Array.isArray(w.mods) ? JSON.stringify(w.mods) : (w.mods ? JSON.stringify(w.mods) : '[]'),
        Array.isArray(w.ammo) ? JSON.stringify(w.ammo) : '[]',
        w.image_url || null, w.is_equipped ? 1 : 0, w.quality || 'Common');
    }
  }

  // Update powers if provided (replace all)
  if (powers && Array.isArray(powers)) {
    db.prepare(`DELETE FROM powers WHERE character_id = ?`).run(charId);
    const insertPower = db.prepare(`
      INSERT INTO powers (character_id, name, discipline, technique)
      VALUES (?, ?, ?, ?)
    `);
    for (const p of powers) {
      insertPower.run(charId, p.name, p.discipline || null, p.technique || null);
    }
  }

  // Update armor if provided
  if (armor && Array.isArray(armor)) {
    db.prepare(`DELETE FROM character_armor WHERE character_id = ?`).run(charId);
    const insertArmor = db.prepare(`
      INSERT INTO character_armor (character_id, location, name, ap, mods, quality)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    for (const a of armor) {
      insertArmor.run(charId, a.location, a.name, a.ap || 0, Array.isArray(a.mods) ? JSON.stringify(a.mods) : (typeof a.mods === 'string' ? a.mods : '[]'), a.quality || 'Common');
    }
  }

  // Update inventory if provided (replace all)
  if (inventory && Array.isArray(inventory)) {
    db.prepare(`DELETE FROM inventory_items WHERE character_id = ?`).run(charId);
    const insertItem = db.prepare(`
      INSERT INTO inventory_items (character_id, name, description, quantity, weight, category, quality, effects, used_with)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const item of inventory) {
      insertItem.run(
        charId, item.name, item.description || null, item.quantity || 1,
        item.weight || null, item.category || 'Gear', item.quality || 'Common',
        item.effects ? JSON.stringify(item.effects) : null,
        item.usedWith || item.used_with || null
      );
    }
  }

  // Update talents if provided (replace all)
  if (talents && Array.isArray(talents)) {
    db.prepare(`DELETE FROM talents WHERE character_id = ?`).run(charId);
    const insertTalent = db.prepare(`
      INSERT INTO talents (character_id, name, specialisation, tier, description, prerequisites, source)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    for (const t of talents) {
      insertTalent.run(charId, t.name, t.specialisation || null, t.tier || 1, t.description || null, t.prerequisites || null, t.source || null);
    }
  }

  // Update xp_purchases if provided (replace all)
  if (xp_purchases && Array.isArray(xp_purchases)) {
    db.prepare(`DELETE FROM xp_purchases WHERE character_id = ?`).run(charId);
    const insertXp = db.prepare(`
      INSERT INTO xp_purchases (character_id, category, name, advance_level, xp_cost)
      VALUES (?, ?, ?, ?, ?)
    `);
    for (const xp of xp_purchases) {
      insertXp.run(charId, xp.category, xp.name, xp.advance_level, xp.xp_cost || 0);
    }
  }

  res.json({ ok: true });
});

// DELETE /api/characters/:id
router.delete('/:id', (req: Request, res: Response) => {
  const userId = req.user!.discord_id;
  const charId = req.params.id as string; // Cast req.params.id to string

  const result = db.prepare(`DELETE FROM characters WHERE id = ? AND discord_user_id = ?`).run(charId, userId);
  if (result.changes === 0) {
    res.status(404).json({ error: 'Character not found' });
    return;
  }
  res.json({ ok: true });
});

// POST /api/characters/import — Import from Google Sheet
router.post('/import', async (req: Request, res: Response) => {
  const userId = req.user!.discord_id;
  const { sheetUrl } = req.body;

  if (!sheetUrl) {
    res.status(400).json({ error: 'Google Sheet URL is required' });
    return;
  }

  try {
    const character = await importFromGoogleSheet(sheetUrl, userId);
    res.status(201).json(character);
  } catch (error: any) {
    console.error('Import error:', error);
    res.status(400).json({ error: error.message || 'Failed to import character' });
  }
});

export default router;
