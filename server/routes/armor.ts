import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();
router.use(authMiddleware);

// Cache configurations
let cachedArmor: any[] | null = null;
let lastFetchTime = 0;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

const ARMOR_CSV_URL = 'https://docs.google.com/spreadsheets/d/1lyE5dr0l18JeUxGj_jrkZ0P4bhj2VgYJbB3Oy5-0CrA/export?format=csv&gid=791560670';

function parseCsvRows(csvText: string): string[][] {
  return csvText.split('\n').map(line => {
    const row: string[] = [];
    let currentCell = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          currentCell += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        row.push(currentCell.trim());
        currentCell = '';
      } else if (char !== '\r') {
        currentCell += char;
      }
    }
    row.push(currentCell.trim());
    return row;
  });
}

async function fetchTemplates() {
  const res = await fetch(ARMOR_CSV_URL);

  if (!res.ok) {
    throw new Error('Failed to fetch from Google Sheets');
  }

  const text = await res.text();
  const rows = parseCsvRows(text);
  const templates: any[] = [];

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (r.length < 4 || !r[0]) continue;
    templates.push({
      name: r[0],
      location: r[2] || 'All',
      ap: parseInt(r[3]) || 0,
      weight: r[5] || null,
      availability: r[6] || null
    });
  }

  return templates;
}

// GET /api/armor/templates
router.get('/templates', async (req: Request, res: Response) => {
  const forceRefresh = req.query.refresh === 'true';
  const now = Date.now();

  if (forceRefresh || !cachedArmor || (now - lastFetchTime) > CACHE_TTL_MS) {
    try {
      cachedArmor = await fetchTemplates();
      lastFetchTime = now;
      console.log(`[Armor] Fetched ${cachedArmor.length} templates from Google Sheets`);
    } catch (err) {
      console.error('[Armor] Failed to fetch layout:', err);
      if (!cachedArmor) {
        return res.status(502).json({ error: 'Failed to fetch templates from upstream' });
      }
    }
  }

  res.json(cachedArmor);
});

export default router;
