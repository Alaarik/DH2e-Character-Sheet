/**
 * Google Sheet Import Logic
 * Ports the CSV parsing approach from the bot's CharacterManager.parseCsv()
 * to work with the web app's SQLite database.
 */
import db from './db.js';

interface ImportedCharacter {
  id: number;
  name: string;
}

/**
 * Convert a Google Sheets URL to CSV format using gviz/tq endpoint
 */
function convertToCsvUrl(url: string): string {
  if (url.includes('gviz/tq') || url.includes('output=csv')) {
    return url;
  }

  const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (!match) return url;

  const spreadsheetId = match[1];
  const gidMatch = url.match(/[#&?]gid=(\d+)/);
  const gid = gidMatch ? gidMatch[1] : '0';

  return `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:csv&gid=${gid}`;
}

/**
 * Parse CSV text into rows of cells
 */
function parseCsvRows(csvText: string): string[][] {
  return csvText.split('\n').map(line =>
    line.split(',').map(cell => cell.trim().replace(/^"|"$/g, ''))
  );
}

/**
 * Import a character from a Google Sheet URL into the database
 */
export async function importFromGoogleSheet(sheetUrl: string, discordUserId: string): Promise<ImportedCharacter> {
  // Fetch main data
  const csvUrl = convertToCsvUrl(sheetUrl);
  const response = await fetch(csvUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch sheet: HTTP ${response.status}`);
  }
  const mainCsvText = await response.text();

  // Fetch weapon section (rows 60-90)
  let weaponCsvText = '';
  try {
    const weaponUrl = csvUrl + '&range=A60:Z90';
    const weaponResponse = await fetch(weaponUrl);
    if (weaponResponse.ok) {
      weaponCsvText = await weaponResponse.text();
    }
  } catch { /* weapon fetch is optional */ }

  const lines = parseCsvRows(mainCsvText);
  const weaponLines = weaponCsvText ? parseCsvRows(weaponCsvText) : [];

  // Known characteristics
  const CHARACTERISTICS = ['WS', 'BS', 'S', 'T', 'AG', 'INT', 'PER', 'WP', 'FEL'];
  const CHAR_FULL_NAMES: Record<string, string> = {
    'WEAPON SKILL': 'WS', 'BALLISTIC SKILL': 'BS', 'STRENGTH': 'S',
    'TOUGHNESS': 'T', 'AGILITY': 'AG', 'INTELLIGENCE': 'INT',
    'PERCEPTION': 'PER', 'WILLPOWER': 'WP', 'FELLOWSHIP': 'FEL'
  };
  const SECTION_MAP: Record<string, string> = {
    'SKILL': 'General', 'SKILLS': 'General',
    'LORE': 'Lore', 'LORES': 'Lore',
    'LANGUAGE': 'Language', 'LANGUAGES': 'Language',
    'TRADE': 'Trade', 'TRADES': 'Trade'
  };

  // Parsed data
  let charName = 'Unnamed';
  let portraitUrl: string | null = null;
  let psyRating: number | null = null;
  let psykerType: string | null = null;
  let psyFocus = 0;
  let wounds: number | null = null;
  let fatePointsCurrent: number | null = null;
  let fatePointsMax: number | null = null;
  let fatigue = 0;
  let corruption = 0;
  let insanityPoints = 0;

  const attrs: Record<string, { base: number; advances: number; total: number; unnatural: number; bonus: number }> = {};
  const skills: { name: string; characteristic: string; total: number; category: string }[] = [];
  let currentCategory = 'General';

  // Parse main CSV
  for (let i = 0; i < lines.length; i++) {
    const row = lines[i];
    if (row.length < 2) continue;

    const label = row[0]?.toUpperCase().trim() || '';

    // Section headers
    if (SECTION_MAP[label] || Object.keys(SECTION_MAP).some(k => label.startsWith(k + ' '))) {
      const key = Object.keys(SECTION_MAP).find(k => label.startsWith(k));
      if (key) { currentCategory = SECTION_MAP[key]; continue; }
    }

    // Psy Focus (flexible scan)
    const psyFocusIdx = row.findIndex(cell => cell.toUpperCase().replace(':', '').trim() === 'PSY FOCUS');
    if (psyFocusIdx !== -1 && psyFocusIdx + 1 < row.length) {
      const val = parseInt(row[psyFocusIdx + 1]);
      if (!isNaN(val)) { psyFocus = val; continue; }
    }

    // Skip headers
    const OTHER_HEADERS = ['CHARACTERISTIC', 'CHARACTERISTICS', 'DARK HERESY', 'POWER', 'MELEE', 'RANGED'];
    if (!label || OTHER_HEADERS.some(h => label.startsWith(h))) continue;

    const charAbbrev = CHARACTERISTICS.includes(label) ? label : CHAR_FULL_NAMES[label];

    if (charAbbrev) {
      let base = 0;
      // Search columns B through F for the first valid positive number to use as "base"
      for (let j = 1; j < Math.min(row.length, 6); j++) {
        const val = parseInt(row[j]);
        if (!isNaN(val) && val > 0) {
          base = val;
          break;
        }
      }
      const total = row.length > 7 ? parseInt(row[7]) || 0 : 0;
      if (base === 0) base = total;

      const unnatural = row.length > 9 ? parseInt(row[9]) || 0 : 0;
      const bonus = row.length > 10 ? parseInt(row[10]) || 0 : Math.floor(total / 10) + unnatural;
      
      let advances = total - base;
      if (advances < 0) advances = 0;

      attrs[charAbbrev] = { base, advances, total, unnatural, bonus };
    }
    else if (label === 'CHARACTER NAME') { charName = row[1] || 'Unnamed'; }
    else if (label === 'WOUNDS') { wounds = parseInt(row[1]) || null; }
    else if (label === 'FATE POINTS') {
      const raw = row[1] || '';
      if (raw.includes('/')) {
        const parts = raw.split('/');
        fatePointsCurrent = parseInt(parts[0].trim()) || null;
        fatePointsMax = parseInt(parts[1].trim()) || null;
      } else {
        const val = parseInt(raw);
        if (!isNaN(val)) { fatePointsCurrent = val; fatePointsMax = val; }
      }
    }
    else if (label === 'CORRUPTION' || label === 'CORRUPTION POINTS') { corruption = parseInt(row[1]) || 0; }
    else if (label === 'PSY RATING' || label === 'PSYRATING') { psyRating = parseInt(row[1]) || null; }
    else if (label === 'FATIGUE') { fatigue = parseInt(row[1]) || 0; }
    else if (label === 'INSANITY POINTS' || label === 'INSANITY') { insanityPoints = parseInt(row[1]) || 0; }
    else if (label.includes('PSYKER TYPE') || row[1]?.toUpperCase().includes('PSYKER TYPE')) {
      const typeVal = (label.includes('TYPE') ? row[1] : row[2])?.trim()?.toLowerCase();
      if (typeVal === 'bound' || typeVal === 'unbound' || typeVal === 'daemonic') {
        psykerType = typeVal.charAt(0).toUpperCase() + typeVal.slice(1);
      }
    }
    // Skills
    else if (row.length > 7) {
      let skillName = row[0].trim();
      const charRef = row[1]?.toUpperCase().trim();
      if (charRef === 'CHARACTERISTIC' || !charRef) continue;
      const hasValidChar = CHARACTERISTICS.some(c => charRef.includes(c)) || charRef.includes('/');
      if (hasValidChar && skillName) {
        let cat = currentCategory;
        
        // Handle Lore abbreviations and formatting: "FL (Psykers)" -> name "Psykers", category "Forbidden Lore"
        // Also explicitly exclude Sleight of Hand to prevent it from matching "SL"
        const isSleightOfHand = skillName.toUpperCase().startsWith('SLEIGHT OF HAND');
        const loreMatch = isSleightOfHand ? null : skillName.match(/^(CL|FL|SL|Common Lore|Forbidden Lore|Scholastic Lore)\b\s*[-:\(]?\s*([^\)]+)\)?$/i);
        
        if (loreMatch) {
          const prefix = loreMatch[1].toUpperCase();
          skillName = loreMatch[2].trim();
          if (prefix === 'CL' || prefix === 'COMMON LORE') cat = 'Common Lore';
          else if (prefix === 'FL' || prefix === 'FORBIDDEN LORE') cat = 'Forbidden Lore';
          else if (prefix === 'SL' || prefix === 'SCHOLASTIC LORE') cat = 'Scholastic Lore';
        }

        const total = parseInt(row[7]) || 0;
        skills.push({ name: skillName, characteristic: charRef, total, category: cat });
      }
    }
  }

  // Portrait URL scan
  for (let r = 0; r < lines.length && !portraitUrl; r++) {
    for (let c = 0; c < lines[r].length; c++) {
      const cell = lines[r][c].trim();
      if (cell && (cell.startsWith('http') || cell.startsWith('www'))) {
        if (cell.includes('imgur') || /\.(png|jpg|jpeg|gif|webp)/i.test(cell)) {
          portraitUrl = cell;
          break;
        }
      }
    }
  }

  // Insert into database (use a transaction)
  const insertCharacter = db.transaction(() => {
    // Upsert character
    const existing = db.prepare(`
      SELECT id FROM characters WHERE discord_user_id = ? AND name = ?
    `).get(discordUserId, charName) as { id: number } | undefined;

    let charId: number;

    if (existing) {
      // Update existing
      charId = existing.id;
      db.prepare(`
        UPDATE characters SET
          portrait_url = ?, psy_rating = ?, psyker_type = ?, psy_focus = ?,
          wounds = ?, fate_points_current = ?, fate_points_max = ?,
          fatigue = ?, corruption = ?, insanity_points = ?, updated_at = datetime('now')
        WHERE id = ?
      `).run(portraitUrl, psyRating, psykerType, psyFocus, wounds,
        fatePointsCurrent, fatePointsMax, fatigue, corruption, insanityPoints, charId);

      // Clear old sub-data
      db.prepare(`DELETE FROM characteristics WHERE character_id = ?`).run(charId);
      db.prepare(`DELETE FROM skills WHERE character_id = ?`).run(charId);
      db.prepare(`DELETE FROM weapons WHERE character_id = ?`).run(charId);
      db.prepare(`DELETE FROM powers WHERE character_id = ?`).run(charId);
    } else {
      // Insert new
      const result = db.prepare(`
        INSERT INTO characters (discord_user_id, name, portrait_url, psy_rating, psyker_type, psy_focus,
          wounds, fate_points_current, fate_points_max, fatigue, corruption, insanity_points)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(discordUserId, charName, portraitUrl, psyRating, psykerType, psyFocus,
        wounds, fatePointsCurrent, fatePointsMax, fatigue, corruption, insanityPoints);
      charId = result.lastInsertRowid as number;
    }

    // Insert characteristics
    const insertAttr = db.prepare(`
      INSERT INTO characteristics (character_id, abbrev, base, advances, total, unnatural, bonus)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    for (const [abbrev, data] of Object.entries(attrs)) {
      insertAttr.run(charId, abbrev, data.base, data.advances, data.total, data.unnatural, data.bonus);
    }

    // Insert skills
    const insertSkill = db.prepare(`
      INSERT INTO skills (character_id, name, characteristic, category, total, trained, plus_10, plus_20, plus_30)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const s of skills) {
      const statAbbrev = CHAR_FULL_NAMES[s.characteristic.toUpperCase()] || s.characteristic.toUpperCase();
      const baseStat = attrs[statAbbrev]?.total || 0;
      
      let trained = false, plus_10 = false, plus_20 = false, plus_30 = false;
      
      if (s.total >= baseStat + 30) {
        trained = true; plus_10 = true; plus_20 = true; plus_30 = true;
      } else if (s.total >= baseStat + 20) {
        trained = true; plus_10 = true; plus_20 = true;
      } else if (s.total >= baseStat + 10) {
        trained = true; plus_10 = true;
      } else if (s.total >= baseStat && s.total > 0) {
        trained = true;
      }

      insertSkill.run(charId, s.name, s.characteristic, s.category, s.total, 
        trained ? 1 : 0, plus_10 ? 1 : 0, plus_20 ? 1 : 0, plus_30 ? 1 : 0);
    }

    // Parse and insert weapons from weapon lines
    const weaponSourceLines = weaponLines.length > 0 ? weaponLines : lines;
    parseAndInsertWeapons(charId, weaponSourceLines);

    // Parse and insert powers
    parseAndInsertPowers(charId, lines);

    return { id: charId, name: charName };
  });

  return insertCharacter();
}

/**
 * Parse weapon sections from CSV rows and insert into DB
 * 
 * The sheet template has NO explicit "MELEE"/"RANGED" section labels.
 * Instead, weapon sections are identified by column HEADER rows where
 * Column E contains "Name". The category is determined by the column layout:
 *   - Melee:  E=Name, F=Alias, G=Family, H=Range, I=Damage, J=Type, K=Pen, L=Qualities, M=Weight, N=Mods
 *   - Ranged: E=Name, F=Alias, G=Family, H=Class, I=Range, J=RoF, K=Damage, L=Type, M=Pen, N=Magazine, O=Qualities, P=Weight, Q=Mods
 * 
 * Ranged headers have "Class" in column H; Melee headers have "Range" in column H.
 * If neither matches, we also check for explicit MELEE/RANGED keywords anywhere in the row.
 */
function parseAndInsertWeapons(charId: number, lines: string[][]): void {
  const COL_NAME = 4; // Column E
  const COL_ALIAS = 5;

  const insertWeapon = db.prepare(`
    INSERT INTO weapons (character_id, name, alias, display_name, category, family, weapon_class, range, rof, damage, type, pen, magazine, qualities, weight, mods)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  let currentCategory: 'Melee' | 'Ranged' | null = null;

  console.log(`[WeaponParsing] Scanning ${lines.length} rows for weapons...`);

  for (let i = 0; i < lines.length; i++) {
    const row = lines[i];
    if (!row || row.length < 2) continue;

    // Check if this is a weapon column header row (Column E = "Name")
    const colE = row[COL_NAME]?.toUpperCase().trim();
    if (colE === 'NAME') {
      // Determine category from column H (index 7):
      //   Melee layout:  H = "Range"
      //   Ranged layout: H = "Class"
      const colH = row[7]?.toUpperCase().trim();
      if (colH === 'CLASS') {
        currentCategory = 'Ranged';
        console.log(`[WeaponParsing] Row ${i}: Detected RANGED weapon header (col H = "Class")`);
      } else {
        // Default to Melee for any other weapon header (H = "Range" or similar)
        currentCategory = 'Melee';
        console.log(`[WeaponParsing] Row ${i}: Detected MELEE weapon header (col H = "${row[7]?.trim()}")`);
      }
      continue;
    }

    // Also accept explicit MELEE/RANGED keywords anywhere in the row (fallback)
    const fullRowUpper = row.map(c => c.toUpperCase().trim());
    const hasMelee = fullRowUpper.some(cell => cell === 'MELEE' || cell === 'MELEE WEAPONS');
    const hasRanged = fullRowUpper.some(cell => cell === 'RANGED' || cell === 'RANGED WEAPONS');
    if (hasMelee && !hasRanged) {
      console.log(`[WeaponParsing] Row ${i}: Detected MELEE keyword`);
      currentCategory = 'Melee';
      continue;
    }
    if (hasRanged) {
      console.log(`[WeaponParsing] Row ${i}: Detected RANGED keyword`);
      currentCategory = 'Ranged';
      continue;
    }

    if (!currentCategory) continue;

    // Need at least enough columns for weapon name
    if (row.length <= COL_NAME) continue;

    const weaponName = row[COL_NAME]?.trim();
    if (!weaponName) continue;

    // Skip overly long entries (notes/descriptions, not weapon names)
    if (weaponName.length > 50) continue;

    const alias = row[COL_ALIAS]?.trim() || null;
    const displayName = alias ? `${weaponName} (${alias})` : weaponName;

    console.log(`[WeaponParsing] Row ${i}: Found ${currentCategory} weapon "${weaponName}"`);

    if (currentCategory === 'Melee') {
      // Melee: E=Name, F=Alias, G=Family, H=Range, I=Damage, J=Type, K=Pen, L=Qualities, M=Weight, N=Mods
      insertWeapon.run(charId, weaponName, alias, displayName, 'Melee',
        row[6]?.trim() || null, null,
        row[7]?.trim() || null, null,
        row[8]?.trim() || null, row[9]?.trim() || null,
        parseInt(row[10]) || null, null,
        row[11]?.trim() ? JSON.stringify(row[11].split(/[,;]/).map((q: string) => q.trim()).filter(Boolean)) : null,
        row[12]?.trim() || null,
        row[13]?.trim() ? JSON.stringify(row[13].split(/[,;]/).map((m: string) => m.trim()).filter(Boolean)) : null
      );
    } else {
      // Ranged: E=Name, F=Alias, G=Family, H=Class, I=Range, J=RoF, K=Damage, L=Type, M=Pen, N=Magazine, O=Qualities, P=Weight, Q=Mods
      insertWeapon.run(charId, weaponName, alias, displayName, 'Ranged',
        row[6]?.trim() || null, row[7]?.trim() || null,
        row[8]?.trim() || null, row[9]?.trim() || null,
        row[10]?.trim() || null, row[11]?.trim() || null,
        parseInt(row[12]) || null, parseInt(row[13]) || null,
        row[14]?.trim() ? JSON.stringify(row[14].split(/[,;]/).map((q: string) => q.trim()).filter(Boolean)) : null,
        row[15]?.trim() || null,
        row[16]?.trim() ? JSON.stringify(row[16].split(/[,;]/).map((m: string) => m.trim()).filter(Boolean)) : null
      );
    }
  }

  console.log(`[WeaponParsing] Complete`);
}

/**
 * Parse power section from CSV rows and insert into DB
 * Matches bot's parsePowerSection logic: accepts POWER, POWERS, PSYCHIC POWERS, PSYKANA headers
 * Limits scan to 20 rows after header (same as bot)
 */
function parseAndInsertPowers(charId: number, lines: string[][]): void {
  const insertPower = db.prepare(`
    INSERT INTO powers (character_id, name, discipline, technique)
    VALUES (?, ?, ?, ?)
  `);

  let powerStartRow = -1;

  // Find section header (scan column A and B)
  for (let i = 0; i < lines.length; i++) {
    const row = lines[i];
    if (!row || row.length < 1) continue;

    const col0 = row[0]?.toUpperCase().trim();
    const col1 = row[1]?.toUpperCase().trim();

    // Accept: POWER, POWERS, PSYCHIC POWERS, PSYKANA (matching bot)
    if (col0 === 'POWER' || col0 === 'POWERS' || col0 === 'PSYCHIC POWERS' || col0 === 'PSYKANA') {
      powerStartRow = i + 1;
      console.log(`[PowerParsing] Found powers section header "${col0}" at row ${i}`);
      break;
    }
  }

  if (powerStartRow < 0) {
    console.log(`[PowerParsing] No powers section header found in ${lines.length} rows`);
    return;
  }

  // Parse up to 20 rows after header (matching bot's limit)
  let count = 0;
  for (let i = powerStartRow; i < lines.length && i < powerStartRow + 20; i++) {
    const row = lines[i];
    const name = row[0]?.trim();

    // Stop if we hit empty row or a new section header
    if (!name) break;
    const nameUpper = name.toUpperCase();
    if (nameUpper === 'POWER' || nameUpper === 'NAME' || nameUpper.startsWith('PSYCHIC') ||
        nameUpper === 'MELEE' || nameUpper === 'RANGED' || nameUpper === 'WEAPONS') break;

    const discipline = row[1]?.trim() || null;
    const technique = row[2]?.trim() || null;

    insertPower.run(charId, name, discipline, technique);
    count++;
  }

  console.log(`[PowerParsing] Parsed ${count} powers`);
}
