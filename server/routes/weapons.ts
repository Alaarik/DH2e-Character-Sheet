import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();
router.use(authMiddleware);

// Cache configurations
let cachedTemplates: any[] | null = null;
let lastFetchTime = 0;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

const MELEE_CSV_URL = 'https://docs.google.com/spreadsheets/d/1lyE5dr0l18JeUxGj_jrkZ0P4bhj2VgYJbB3Oy5-0CrA/export?format=csv&gid=1364200672';
const RANGED_CSV_URL = 'https://docs.google.com/spreadsheets/d/1lyE5dr0l18JeUxGj_jrkZ0P4bhj2VgYJbB3Oy5-0CrA/export?format=csv&gid=921969305';

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
    } else if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && csvText[i + 1] === '\n') {
        i++;
      }
      // Only push non-empty rows or if we already have cells
      currentRow.push(currentCell.trim());
      if (currentRow.length > 1 || currentRow[0] !== '') {
        rows.push(currentRow);
      }
      currentRow = [];
      currentCell = '';
    } else {
      currentCell += char;
    }
  }
  
  if (currentCell || currentRow.length > 0) {
    currentRow.push(currentCell.trim());
    if (currentRow.length > 1 || currentRow[0] !== '') {
      rows.push(currentRow);
    }
  }
  
  return rows;
}

async function fetchTemplates() {
  const [meleeRes, rangedRes] = await Promise.all([
    fetch(MELEE_CSV_URL),
    fetch(RANGED_CSV_URL)
  ]);

  if (!meleeRes.ok || !rangedRes.ok) {
    throw new Error('Failed to fetch from Google Sheets');
  }

  const meleeText = await meleeRes.text();
  const rangedText = await rangedRes.text();

  const meleeRows = parseCsvRows(meleeText);
  const rangedRows = parseCsvRows(rangedText);

  const templates: any[] = [];

  // Parse Melee: Name(0),Family(1),Range(2),Damage(3),Type(4),Pen(5),Special Qualities(6),Weight(7)
  for (let i = 1; i < meleeRows.length; i++) {
    const r = meleeRows[i];
    if (r.length < 5 || !r[0]) continue;
    templates.push({
      name: r[0],
      display_name: r[0],
      category: 'Melee',
      family: r[1] || null,
      range: r[2] === '-' ? null : r[2],
      damage: r[3] || null,
      type: r[4] || null,
      pen: parseInt(r[5]) || 0,
      qualities: r[6] ? r[6].split(/[,;]/).map(q => q.trim()).filter(Boolean) : [],
      weight: r[7] || null,
      weapon_class: null,
      rof: null,
      magazine: null
    });
  }

  // Parse Ranged: Name(0),Family(1),Class(2),Range(3),RoF(4),Damage(5),Type(6),Pen(7),Magazine(8),Reload(9),Special Qualities(10),Weight(11)
  for (let i = 1; i < rangedRows.length; i++) {
    const r = rangedRows[i];
    if (r.length < 5 || !r[0] || r[0] === 'Name') continue; // Account for chunks that might re-header
    
    // Ignore lines that just say RANGED or MELEE or POWER
    if (['RANGED', 'MELEE', 'POWER'].includes(r[0].toUpperCase())) continue;

    templates.push({
      name: r[0],
      display_name: r[0],
      category: 'Ranged',
      family: r[1] || null,
      weapon_class: r[2] || null,
      range: r[3] || null,
      rof: r[4] || null,
      damage: r[5] || null,
      type: r[6] || null,
      pen: parseInt(r[7]) || 0,
      magazine: parseInt(r[8]) || 0,
      qualities: r[10] ? r[10].split(/[,;]/).map(q => q.trim()).filter(Boolean) : [],
      weight: r[11] || null
    });
  }

  return templates;
}

// GET /api/weapons/templates
router.get('/templates', async (req: Request, res: Response) => {
  const forceRefresh = req.query.refresh === 'true';
  const now = Date.now();

  if (forceRefresh || !cachedTemplates || (now - lastFetchTime) > CACHE_TTL_MS) {
    try {
      cachedTemplates = await fetchTemplates();
      lastFetchTime = now;
      console.log(`[Weapons] Fetched ${cachedTemplates.length} templates from Google Sheets`);
    } catch (err) {
      console.error('[Weapons] Failed to fetch layout:', err);
      // Fallback to cache if available
      if (!cachedTemplates) {
        return res.status(502).json({ error: 'Failed to fetch templates from upstream' });
      }
    }
  }

  res.json(cachedTemplates);
});

export default router;
