import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();
router.use(authMiddleware);

// Cache
let cachedHomeworlds: any[] | null = null;
let cachedBackgrounds: any[] | null = null;
let cachedRoles: any[] | null = null;
let cachedEliteAdvances: any[] | null = null;
let cachedTraits: any[] | null = null;
let cachedDivinations: any[] | null = null;
let cachedKit: any[] | null = null;
let lastFetch = 0;
const TTL = 60 * 60 * 1000;

const SHEET_BASE = 'https://docs.google.com/spreadsheets/d/1lyE5dr0l18JeUxGj_jrkZ0P4bhj2VgYJbB3Oy5-0CrA/export?format=csv&gid=';
const GID_HOMEWORLDS = '521253617';
const GID_BACKGROUNDS = '2091379404';
const GID_ROLES = '592690970';
const GID_ELITE_ADVANCES = '1718556050';
const GID_TRAITS = '396014170';
const GID_DIVINATIONS = '1774827029';
const GID_KIT = '18295788';

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let cell = '';
  let inQ = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (inQ && text[i + 1] === '"') { cell += '"'; i++; }
      else inQ = !inQ;
    } else if (c === ',' && !inQ) {
      currentRow.push(cell.trim());
      cell = '';
    } else if ((c === '\n' || c === '\r') && !inQ) {
      if (c === '\r' && text[i + 1] === '\n') i++;
      currentRow.push(cell.trim());
      if (currentRow.length > 1 || currentRow[0] !== '') {
        rows.push(currentRow);
      }
      currentRow = [];
      cell = '';
    } else {
      cell += c;
    }
  }

  if (cell || currentRow.length > 0) {
    currentRow.push(cell.trim());
    if (currentRow.length > 1 || currentRow[0] !== '') {
      rows.push(currentRow);
    }
  }

  return rows;
}

function splitRespectingParens(str: string): string[] {
  const parts: string[] = [];
  let current = '';
  let depth = 0;
  for (let i = 0; i < str.length; i++) {
    const c = str[i];
    if (c === '(') depth++;
    else if (c === ')') depth--;
    else if (c === ',' && depth === 0) {
      parts.push(current.trim());
      current = '';
      continue;
    }
    current += c;
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

/**
 * Split a string on " and " only at depth 0 (not inside parentheses).
 * This preserves compound names like "Fear and Pinning" inside parens.
 */
function splitOnAndRespectingParens(str: string): string[] {
  const parts: string[] = [];
  let current = '';
  let depth = 0;
  for (let i = 0; i < str.length; i++) {
    const c = str[i];
    if (c === '(') depth++;
    else if (c === ')') depth--;
    // Match ", and " or " and " at depth 0
    if (depth === 0) {
      if (str.slice(i, i + 6).toLowerCase() === ', and ') {
        parts.push(current.trim());
        current = '';
        i += 5; // skip ", and "
        continue;
      }
      if (str.slice(i, i + 5).toLowerCase() === ' and ') {
        parts.push(current.trim());
        current = '';
        i += 4; // skip " and "
        continue;
      }
    }
    current += c;
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

function parseHomeworldSpecial(text: string): {
  skills: string, talents: string, mixedChoices: string,
  eliteAdvanceAlternative: { advanceName: string; skills: string; talents: string; psyRatingBonus: number } | null
} {
  const skillsList: string[] = [];
  const talentsList: string[] = [];
  const mixedList: string[] = [];
  let eliteAdvanceAlternative: { advanceName: string; skills: string; talents: string; psyRatingBonus: number } | null = null;

  if (!text) return { skills: '', talents: '', mixedChoices: '', eliteAdvanceAlternative: null };
  
  // Parse the "Alternatively" clause if present
  const altMatch = text.match(/Alternatively,?\s*if he takes the (\w+) elite advance[^,]*,\s*he starts with (.*?)(?:\s+instead)/i);
  if (altMatch) {
    const advanceName = altMatch[1].trim();
    const altGrants = altMatch[2];
    
    const altSkillsList: string[] = [];
    const altTalentsList: string[] = [];
    let psyRatingBonus = 0;

    // Check for psy rating bonus
    const prMatch = text.match(/increases his psy rating by (\d+)/i);
    if (prMatch) psyRatingBonus = parseInt(prMatch[1]) || 0;

    // Parse skills from the alternative clause: "the [X] skills"
    const altSkillsMatch = altGrants.match(/(?:the\s+)(.*?)\s+skills?(?:,|\s|$)/i);
    let altGrantsRemainder = altGrants;
    if (altSkillsMatch) {
      let sItems = splitOnAndRespectingParens(altSkillsMatch[1]);
      sItems = sItems.flatMap(s => splitRespectingParens(s))
        .map(s => s.trim().replace(/^the /i, '')).filter(Boolean);
      altSkillsList.push(...sItems);
      // Remove the matched skills portion so talents regex doesn't re-match it
      altGrantsRemainder = altGrants.substring(altGrants.indexOf(altSkillsMatch[0]) + altSkillsMatch[0].length);
    }

    // Parse talents from the remainder: "the [X] talent(s)"
    const altTalentsMatch = altGrantsRemainder.match(/the\s+(.*?)\s+talents?/i);
    if (altTalentsMatch) {
      let tItems = splitOnAndRespectingParens(altTalentsMatch[1]);
      tItems = tItems.flatMap(s => splitRespectingParens(s))
        .map(s => s.trim().replace(/^the /i, '')).filter(Boolean);
      altTalentsList.push(...tItems);
    }

    eliteAdvanceAlternative = {
      advanceName,
      skills: altSkillsList.join(', '),
      talents: altTalentsList.join(', '),
      psyRatingBonus
    };
  }
  
  const firstSentence = text.split('.')[0];
  const match = firstSentence.match(/starts with (.*)/i);
  if (!match) return { skills: '', talents: '', mixedChoices: '', eliteAdvanceAlternative };
  
  let grantsText = match[1];

  const mixedRegex = /one [R|r]ank in the ([^,]+) skill or the ([^,]+) [T|t]alents?/g;
  let mixedMatches = [...grantsText.matchAll(mixedRegex)];
  mixedMatches.forEach(m => {
    mixedList.push('Skill: ' + m[1].trim() + ' or Talent: ' + m[2].trim());
    grantsText = grantsText.replace(m[0], '');
  });

  const skillsRegex = /one [R|r]ank in the (.*?) skills?/i;
  let sMatch = grantsText.match(skillsRegex);
  if (sMatch) {
    // Split on top-level " and " / ", and " only (preserving parens content)
    let sItems = splitOnAndRespectingParens(sMatch[1]);
    sItems = sItems.flatMap(s => splitRespectingParens(s))
      .map(s => s.trim().replace(/^the /i, '')).filter(Boolean);
    skillsList.push(...sItems);
    grantsText = grantsText.replace(sMatch[0], '');
  }

  const talentsRegex = /the (.*?) talents?/i;
  let tMatch = grantsText.match(talentsRegex);
  if (tMatch) {
    // Split on top-level " and " / ", and " only (preserving parens content)
    let tItems = splitOnAndRespectingParens(tMatch[1]);
    tItems = tItems.flatMap(s => splitRespectingParens(s))
      .map(s => s.trim().replace(/^the /i, '')).filter(Boolean);
    talentsList.push(...tItems);
    grantsText = grantsText.replace(tMatch[0], '');
  }

  return { 
    skills: skillsList.join(', '), 
    talents: talentsList.join(', '), 
    mixedChoices: mixedList.join(', '),
    eliteAdvanceAlternative
  };
}


function parseStatMod(val: string | undefined): number {
  if (!val || val === '-' || val.trim() === '') return 0;
  return parseInt(val) || 0;
}

async function fetchAll() {
  const [hwRes, bgRes, rlRes, eaRes, trRes, divRes, kitRes] = await Promise.all([
    fetch(SHEET_BASE + GID_HOMEWORLDS),
    fetch(SHEET_BASE + GID_BACKGROUNDS),
    fetch(SHEET_BASE + GID_ROLES),
    fetch(SHEET_BASE + GID_ELITE_ADVANCES),
    fetch(SHEET_BASE + GID_TRAITS),
    fetch(SHEET_BASE + GID_DIVINATIONS),
    fetch(SHEET_BASE + GID_KIT),
  ]);
  if (!hwRes.ok || !bgRes.ok || !rlRes.ok) throw new Error('Sheet fetch failed');

  const hwRows = parseCsv(await hwRes.text());
  const bgRows = parseCsv(await bgRes.text());
  const rlRows = parseCsv(await rlRes.text());
  const eaRows = eaRes.ok ? parseCsv(await eaRes.text()) : [];
  const trRows = trRes.ok ? parseCsv(await trRes.text()) : [];
  const divRows = divRes.ok ? parseCsv(await divRes.text()) : [];
  const kitRows = kitRes.ok ? parseCsv(await kitRes.text()) : [];

  // Homeworlds: Col1(0), Variant(1), Char1+(2), Char2+(3), Char3-(4), Fate(5), Blessing(6), Apt1(7), Apt2(8), Wounds(9), Special(10), Special2(11), Notes(12)
  cachedHomeworlds = [];
  for (let i = 1; i < hwRows.length; i++) {
    const r = hwRows[i];
    if (!r[0] && !r[1]) continue;
    
    const specialText = r[10] || '';
    const parsed = parseHomeworldSpecial(specialText);

    cachedHomeworlds.push({
      name: r[0] || '', variant: r[1] || '-',
      charPlus1: r[2] || '', charPlus2: r[3] || '', charMinus: r[4] || '',
      fate: parseInt(r[5]) || 0, blessing: r[6] || '',
      aptitude1: r[7] || '', aptitude2: r[8] || '',
      wounds: r[9] || '', special: specialText, special2: r[11] || '', notes: r[12] || '',
      skills: parsed.skills, talents: parsed.talents, mixedChoices: parsed.mixedChoices,
      eliteAdvanceAlternative: parsed.eliteAdvanceAlternative
    });
  }

  // Backgrounds: Name(0), Skills(1), Talents(2), Traits(3), Apt1(4), Apt2(5), Special(6), LimitedOrigins(7), Equipment(8), Other(9)
  cachedBackgrounds = [];
  for (let i = 1; i < bgRows.length; i++) {
    const r = bgRows[i];
    if (!r[0]) continue;
    cachedBackgrounds.push({
      name: r[0], skills: r[1] || '', talents: r[2] || '', traits: r[3] || '',
      aptitude1: r[4] || '', aptitude2: r[5] || '',
      special: r[6] || '', limitedOrigins: r[7] || '', equipment: r[8] || '', other: r[9] || ''
    });
  }

  // Roles: Name(0), Type(1), Talent(2), Ability(3), Apt1-5(4-8)
  cachedRoles = [];
  for (let i = 1; i < rlRows.length; i++) {
    const r = rlRows[i];
    if (!r[0] || r[0].includes('WIP')) continue;
    cachedRoles.push({
      name: r[0].trim(), type: r[1] || '', talent: r[2] || '', ability: r[3] || '',
      aptitudes: [r[4] || '', r[5] || '', r[6] || '', r[7] || '', r[8] || ''].filter(Boolean)
    });
  }

  // Elite Advances: Name(0), Cost(1), CreationOnly(2), Requirements(3), LimitedOrigins(4),
  //   ArrestedDev(5), GMGuidance(6), Skills(7), Talents(8), Traits(9), OtherChanges(10),
  //   Wounds(11), WS(12), BS(13), STR(14), T(15), AG(16), INT(17), PER(18), WP(19), FEL(20), INFL(21),
  //   Aptitude1(22), Aptitude2(23)
  cachedEliteAdvances = [];
  for (let i = 1; i < eaRows.length; i++) {
    const r = eaRows[i];
    if (!r[0] || !r[0].trim()) continue;
    cachedEliteAdvances.push({
      name: r[0].trim(),
      cost: parseInt(r[1]) || 0,
      creationOnly: (r[2] || '').trim().toLowerCase() === 'yes',
      requirements: r[3] || '',
      limitedOrigins: r[4] || '',
      arrestedDevelopment: r[5] || '',
      gmGuidance: r[6] || '',
      skills: r[7] || '',
      talents: r[8] || '',
      traits: r[9] || '',
      otherChanges: r[10] || '',
      woundsMod: parseStatMod(r[11]),
      statMods: {
        WS: parseStatMod(r[12]), BS: parseStatMod(r[13]), S: parseStatMod(r[14]),
        T: parseStatMod(r[15]), AG: parseStatMod(r[16]), INT: parseStatMod(r[17]),
        PER: parseStatMod(r[18]), WP: parseStatMod(r[19]), FEL: parseStatMod(r[20])
      },
      inflMod: parseStatMod(r[21]),
      aptitude1: r[22] || '',
      aptitude2: r[23] || ''
    });
  }

  // Traits: Name(0), Description(1), Amended(2)
  cachedTraits = [];
  for (let i = 1; i < trRows.length; i++) {
    const r = trRows[i];
    if (!r[0] || !r[0].trim()) continue;
    cachedTraits.push({
      name: r[0].trim(),
      description: r[1] || '',
      amended: (r[2] || '').trim().toLowerCase() === 'yes'
    });
  }

  // Divinations: D100(0), Prophecy(1), Effect(2)
  cachedDivinations = [];
  for (let i = 1; i < divRows.length; i++) {
    const r = divRows[i];
    if (!r[0] || !r[0].trim()) continue;
    // Extract min-max from D100 range like "01-04" or "01—04"
    const match = r[0].match(/(\d+)\D+(\d+)/);
    let min = 0, max = 0;
    if (match) {
      min = parseInt(match[1]);
      max = parseInt(match[2]);
    } else {
      min = parseInt(r[0]) || 0;
      max = min;
    }
    cachedDivinations.push({
      rangeString: r[0],
      min,
      max,
      prophecy: r[1] || '',
      effect: r[2] || ''
    });
  }

  // Kit: Rank(0), Item(1), Type(2), Quantity(3), Craftsmanship(4), Temporary(5), Notes(6)
  cachedKit = [];
  for (let i = 1; i < kitRows.length; i++) {
    const r = kitRows[i];
    if (!r[0]) continue;
    cachedKit.push({
      rank: r[0],
      name: r[1] || '',
      type: r[2] || '',
      quantity: parseInt(r[3]) || 1,
      craftsmanship: r[4] || 'Common',
      temporary: (r[5] || '').toLowerCase() === 'yes',
      notes: r[6] || ''
    });
  }

  console.log(`[Chargen] Fetched ${cachedHomeworlds.length} homeworlds, ${cachedBackgrounds.length} backgrounds, ${cachedRoles.length} roles, ${cachedEliteAdvances.length} elite advances, ${cachedTraits.length} traits, ${cachedDivinations.length} divinations, ${cachedKit.length} kit items`);
}

router.get('/data', async (req: Request, res: Response) => {
  const force = req.query.refresh === 'true';
  const now = Date.now();
  if (force || !cachedHomeworlds || (now - lastFetch) > TTL) {
    try { await fetchAll(); lastFetch = now; }
    catch (err) {
      console.error('[Chargen] Fetch failed:', err);
      if (!cachedHomeworlds) return res.status(502).json({ error: 'Failed to fetch chargen data' });
    }
  }
  res.json({
    homeworlds: cachedHomeworlds, backgrounds: cachedBackgrounds, roles: cachedRoles,
    eliteAdvances: cachedEliteAdvances, traits: cachedTraits, divinations: cachedDivinations,
    kit: cachedKit
  });
});

export default router;
