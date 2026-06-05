import express from 'express';

const router = express.Router();

const TOOLS_CSV_URL = 'https://docs.google.com/spreadsheets/d/1lyE5dr0l18JeUxGj_jrkZ0P4bhj2VgYJbB3Oy5-0CrA/export?format=csv&gid=1234474182';
const CONSUMABLES_CSV_URL = 'https://docs.google.com/spreadsheets/d/1lyE5dr0l18JeUxGj_jrkZ0P4bhj2VgYJbB3Oy5-0CrA/export?format=csv&gid=2021707157';
const AMMO_CSV_URL = 'https://docs.google.com/spreadsheets/d/1lyE5dr0l18JeUxGj_jrkZ0P4bhj2VgYJbB3Oy5-0CrA/export?format=csv&gid=483500596';
const ARMOR_MODS_CSV_URL = 'https://docs.google.com/spreadsheets/d/1lyE5dr0l18JeUxGj_jrkZ0P4bhj2VgYJbB3Oy5-0CrA/export?format=csv&gid=1953481748';

export interface GearTemplate {
  name: string;
  category: string;
  weight: string | null;
  cost: string | null;
  availability: string | null;
  description?: string;
  // Quality-specific effects (for Armor Mods)
  effects?: {
    poor: string | null;
    common: string | null;
    good: string | null;
    best: string | null;
  };
  usedWith?: string | null;
  amended?: boolean;
}

let cachedTemplates: GearTemplate[] | null = null;
let lastFetchTime = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Proper CSV parser that handles quoted fields with commas and newlines.
 */
function parseCsvRows(csvText: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = '';
  let inQuotes = false;

  for (let i = 0; i < csvText.length; i++) {
    const char = csvText[i];
    if (char === '"') {
      if (inQuotes && csvText[i + 1] === '"') {
        currentCell += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      currentRow.push(currentCell.trim());
      currentCell = '';
    } else if (char === '\n' && !inQuotes) {
      currentRow.push(currentCell.trim());
      if (currentRow.some(c => c.length > 0)) {
        rows.push(currentRow);
      }
      currentRow = [];
      currentCell = '';
    } else if (char !== '\r') {
      currentCell += char;
    }
  }
  // Push the last row
  currentRow.push(currentCell.trim());
  if (currentRow.some(c => c.length > 0)) {
    rows.push(currentRow);
  }
  return rows;
}

async function fetchAndParseGear(): Promise<GearTemplate[]> {
  const templates: GearTemplate[] = [];

  const fetchCategory = async (url: string, categoryName: string) => {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      const lines = text.split('\n').map((l: string) => l.split(',').map((c: string) => c.trim().replace(/^"|"$/g, '')));
      
      // Typical format: Name, Cost, Weight, Availability, Craftsmanship, Notes/Description
      for (let i = 1; i < lines.length; i++) {
        const row = lines[i];
        if (!row || row.length < 1 || !row[0]) continue;
        
        templates.push({
          name: row[0],
          category: categoryName,
          cost: row[1] || null,
          weight: row[2] || null,
          availability: row[3] || null,
          // Column 4 is craftsmanship, skip. Col 5 is Notes/Description
          description: row[5] || undefined
        });
      }
    } catch (err) {
      console.error(`[Gear] Error fetching ${categoryName}:`, err);
    }
  };

  // Fetch Armor Mods with the new quality-per-column layout
  const fetchArmorMods = async () => {
    try {
      const res = await fetch(ARMOR_MODS_CSV_URL);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      const rows = parseCsvRows(text);

      // Header row (index 0): Name, Weight, Availability, Used With, Poor Craftsmanship, Common Craftsmanship, Good Craftsmanship, Best Craftsmanship, Amended, Reference
      for (let i = 1; i < rows.length; i++) {
        const r = rows[i];
        if (!r[0] || !r[0].trim()) continue;

        templates.push({
          name: r[0].trim(),
          category: 'Armor Mod',
          weight: r[1] || null,
          cost: null,
          availability: r[2] || null,
          usedWith: r[3] || null,
          description: r[5] || undefined, // Common Craftsmanship as default description
          effects: {
            poor: r[4] || null,
            common: r[5] || null,
            good: r[6] || null,
            best: r[7] || null,
          },
          amended: (r[8] || '').toLowerCase() === 'yes',
        });
      }
      console.log(`[Gear] Fetched ${rows.length - 1} Armor Mod templates`);
    } catch (err) {
      console.error('[Gear] Error fetching Armor Mods:', err);
    }
  };

  await Promise.all([
    fetchCategory(TOOLS_CSV_URL, 'Tool'),
    fetchCategory(CONSUMABLES_CSV_URL, 'Consumable'),
    fetchCategory(AMMO_CSV_URL, 'Ammo'),
    fetchArmorMods()
  ]);

  return templates;
}

// GET /api/gear/templates
router.get('/templates', async (req, res) => {
  try {
    const now = Date.now();
    if (!cachedTemplates || now - lastFetchTime > CACHE_TTL) {
      cachedTemplates = await fetchAndParseGear();
      lastFetchTime = now;
      console.log(`[Gear] Fetched ${cachedTemplates.length} templates from Google Sheets`);
    }
    
    res.json(cachedTemplates);
  } catch (error) {
    console.error('[Gear] Template error:', error);
    res.status(500).json({ error: 'Failed to fetch gear templates' });
  }
});

export default router;
