import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();
router.use(authMiddleware);

// Cache configurations
let cachedPowers: any[] | null = null;
let lastFetchTime = 0;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

const POWERS_CSV_URL = 'https://docs.google.com/spreadsheets/d/1lyE5dr0l18JeUxGj_jrkZ0P4bhj2VgYJbB3Oy5-0CrA/export?format=csv&gid=1431635962';

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
  const res = await fetch(POWERS_CSV_URL);

  if (!res.ok) {
    throw new Error('Failed to fetch from Google Sheets');
  }

  const text = await res.text();
  const rows = parseCsvRows(text);
  const templates: any[] = [];

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (r.length < 10 || !r[0]) continue;
    templates.push({
      name: r[0],
      discipline: r[1] || null,
      technique: r[2] || null,
      xp_cost: parseInt(r[3], 10) || 0,
      prerequisite: r[4] || null,
      test: r[6] || null,
      mod: r[7] || null,
      opposed: r[8] || null,
      action: r[11] || null,
      sustain: r[12] || null,
      effect: r[13] || null,
      range: r[14] || null,
      radius: r[15] || null,
      damage: r[17] || null,
      damage_type: r[18] || null,
      pen: r[19] || null,
      special: r[20] || null
    });
  }

  return templates;
}

// GET /api/powers/templates
router.get('/templates', async (req: Request, res: Response) => {
  const forceRefresh = req.query.refresh === 'true';
  const now = Date.now();

  if (forceRefresh || !cachedPowers || (now - lastFetchTime) > CACHE_TTL_MS) {
    try {
      cachedPowers = await fetchTemplates();
      lastFetchTime = now;
      console.log(`[Powers] Fetched ${cachedPowers.length} templates from Google Sheets`);
    } catch (err) {
      console.error('[Powers] Failed to fetch layout:', err);
      if (!cachedPowers) {
        return res.status(502).json({ error: 'Failed to fetch templates from upstream' });
      }
    }
  }

  res.json(cachedPowers);
});

export default router;
