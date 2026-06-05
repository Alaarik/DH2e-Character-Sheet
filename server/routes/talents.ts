import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();
router.use(authMiddleware);

// Cache configurations
let cachedTemplates: any[] | null = null;
let lastFetchTime = 0;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

const TALENTS_CSV_URL = 'https://docs.google.com/spreadsheets/d/1lyE5dr0l18JeUxGj_jrkZ0P4bhj2VgYJbB3Oy5-0CrA/export?format=csv&gid=1177149274';

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
  const res = await fetch(TALENTS_CSV_URL);

  if (!res.ok) {
    throw new Error('Failed to fetch from Google Sheets');
  }

  const text = await res.text();
  const rows = parseCsvRows(text);
  const templates: any[] = [];

  // Headers: Tier(0), Aptitude 1(1), Aptitude 2(2), Prerequisite(3), Name(4), Description(5), Specialisations(6), Amended(7), Limited(8)
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (r.length < 5 || !r[4]) continue; // Need at least a name (column 4)
    
    const tier = parseInt(r[0]);
    if (isNaN(tier) || tier < 1 || tier > 3) continue;

    templates.push({
      name: r[4],
      tier,
      aptitude1: r[1] || null,
      aptitude2: r[2] || null,
      prerequisites: r[3] || null,
      description: r[5] || null,
      specialisations: r[6] ? r[6].split(',').map(s => s.trim()).filter(Boolean) : [],
      amended: r[7] === 'Yes',
      limited: r[8] || null,
    });
  }

  return templates;
}

// GET /api/talents/templates
router.get('/templates', async (req: Request, res: Response) => {
  const forceRefresh = req.query.refresh === 'true';
  const now = Date.now();

  if (forceRefresh || !cachedTemplates || (now - lastFetchTime) > CACHE_TTL_MS) {
    try {
      cachedTemplates = await fetchTemplates();
      lastFetchTime = now;
      console.log(`[Talents] Fetched ${cachedTemplates.length} templates from Google Sheets`);
    } catch (err) {
      console.error('[Talents] Failed to fetch templates:', err);
      if (!cachedTemplates) {
        return res.status(502).json({ error: 'Failed to fetch templates from upstream' });
      }
    }
  }

  res.json(cachedTemplates);
});

export default router;
