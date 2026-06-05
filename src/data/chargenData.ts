/**
 * Character generation data utilities for Dark Heresy 2e.
 * Parsers for skill/talent choice strings, and aptitude duplicate resolution.
 */

// Primary → Secondary aptitude mapping (from the Characteristic Advance table)
export const PRIMARY_TO_SECONDARY: Record<string, string> = {
  'Weapon Skill': 'Offence',
  'Ballistic Skill': 'Finesse',
  'Strength': 'Offence',
  'Toughness': 'Defence',
  'Agility': 'Finesse',
  'Intelligence': 'Knowledge',
  'Perception': 'Fieldcraft',
  'Willpower': 'Leadership',
  'Fellowship': 'Social',
};

// Reverse: Secondary → array of Primary aptitudes that map to it
export const SECONDARY_TO_PRIMARIES: Record<string, string[]> = {};
for (const [primary, secondary] of Object.entries(PRIMARY_TO_SECONDARY)) {
  if (!SECONDARY_TO_PRIMARIES[secondary]) SECONDARY_TO_PRIMARIES[secondary] = [];
  SECONDARY_TO_PRIMARIES[secondary].push(primary);
}

// All primary characteristic aptitudes
export const PRIMARY_CHARACTERISTICS = Object.keys(PRIMARY_TO_SECONDARY);
// All secondary aptitudes (non-characteristic)
export const SECONDARY_APTITUDES = [...new Set(Object.values(PRIMARY_TO_SECONDARY))];

export interface ParsedChoices {
  auto: string[];
  choices: string[][];  // each sub-array is a set of options for one "or" choice
}

/**
 * Parse a skill/talent string from the sheets into auto-assigned items and choice groups.
 * Handles patterns like:
 *   "Athletics, Charm or Intimidate, Common Lore (Imperial Creed), Dodge or Medicae"
 *   "Cold Hearted or Iron Faith, Hatred (Heretical Cults, Mutants, or Xenos)"
 * 
 * Rules:
 * - Split on ", " but respect parentheses (commas inside parens are part of the item name)
 * - After splitting, check each segment for " or " outside parentheses → choice group
 * - Trim ", and" / "and " separators at segment boundaries
 */
export function parseChoiceString(raw: string): ParsedChoices {
  if (!raw || !raw.trim()) return { auto: [], choices: [] };

  const auto: string[] = [];
  const choices: string[][] = [];

  const segments = splitRespectingParens(raw);

  for (let seg of segments) {
    seg = seg.trim();
    if (!seg) continue;
    if (seg.toLowerCase().startsWith('and ')) seg = seg.slice(4).trim();

    const orParts = splitOnOrRespectingParens(seg);

    if (orParts.length > 1) {
      const flatChoiceOptions: string[] = [];
      for (const p of orParts) {
        const expanded = expandParenthetical(p.trim());
        flatChoiceOptions.push(...expanded.auto);
        expanded.choices.forEach(cGroup => flatChoiceOptions.push(...cGroup));
      }
      choices.push(flatChoiceOptions.filter(Boolean));
    } else {
      // It's a single item, but might have internal parens like "Common Lore (Planetary Defence Forces, Tech or War)"
      const expanded = expandParenthetical(seg);
      auto.push(...expanded.auto);
      choices.push(...expanded.choices);
    }
  }

  return { auto, choices };
}

function expandParenthetical(item: string): ParsedChoices {
  const match = item.match(/^(.+?)\s*\((.+)\)\s*$/);
  if (!match) return { auto: [item], choices: [] };

  const baseName = match[1].trim();
  const inner = match[2].trim();

  const auto: string[] = [];
  const choices: string[][] = [];

  // Check if the entire inner string is just an "or" choice like "Chain or Low-Tech or Shock"
  const innerOrParts = splitOnOrRespectingParens(inner);
  if (innerOrParts.length > 1 && !inner.includes(',')) {
    // If it's pure "or" with no commas, it's a single choice group
    choices.push(innerOrParts.map(p => `${baseName} (${p.trim()})`));
    return { auto, choices };
  }

  // Otherwise, split by comma to handle mixed lists like "Planetary Defence Forces, Tech or War"
  const specs = splitRespectingParens(inner).map(s => s.trim()).filter(Boolean);
  
  for (let spec of specs) {
    if (spec.toLowerCase().startsWith('and ')) spec = spec.slice(4).trim();
    
    // Split on " or " for things like "Tech or War"
    const orParts = spec.split(/\s+or\s+/i).map(p => p.trim()).filter(Boolean);
    if (orParts.length > 1) {
      choices.push(orParts.map(p => `${baseName} (${p})`));
    } else {
      let cleanSpec = spec;
      if (cleanSpec.toLowerCase().startsWith('or ')) cleanSpec = cleanSpec.slice(3).trim();
      auto.push(`${baseName} (${cleanSpec})`);
    }
  }

  return { auto, choices };
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

function splitOnOrRespectingParens(str: string): string[] {
  const parts: string[] = [];
  let current = '';
  let depth = 0;
  let i = 0;

  while (i < str.length) {
    const c = str[i];
    if (c === '(') depth++;
    else if (c === ')') depth--;

    // Check for " or " at depth 0
    if (depth === 0 && str.slice(i, i + 4).toLowerCase() === ' or ') {
      parts.push(current.trim());
      current = '';
      i += 4;
      continue;
    }
    current += c;
    i++;
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

/**
 * Resolve duplicate aptitudes using the full DH2e rules:
 * 1. Duplicate Primary (characteristic) → gain the Secondary
 * 2. Duplicate Secondary → gain a Primary (from the reverse map)
 * 3. Already have BOTH Primary and Secondary → user picks any Primary Characteristic
 * Returns null if user must pick manually.
 */
export function resolveAptitudeDuplicate(newApt: string, existingApts: string[]): string | null {
  if (!existingApts.includes(newApt)) return newApt; // No conflict

  const isPrimary = PRIMARY_CHARACTERISTICS.includes(newApt);
  const isSecondary = SECONDARY_APTITUDES.includes(newApt);

  if (isPrimary) {
    // Duplicate Primary → gain Secondary
    const secondary = PRIMARY_TO_SECONDARY[newApt];
    if (secondary && !existingApts.includes(secondary)) return secondary;
    // Already have both → user picks any Primary Characteristic
    return null;
  }

  if (isSecondary) {
    // Duplicate Secondary → gain a Primary from the reverse map
    const primaries = SECONDARY_TO_PRIMARIES[newApt] || [];
    for (const p of primaries) {
      if (!existingApts.includes(p)) return p;
    }
    // All mapped primaries already owned → user picks any Primary Characteristic
    return null;
  }

  // Not a standard aptitude (e.g. General, Tech) → user picks
  return null;
}

/**
 * All possible aptitudes for manual selection when auto-resolution fails.
 * Note: Psyker is EXCLUDED — it can only be gained via the Psyker Elite Advance.
 */
export const ALL_APTITUDES = [
  'General', 'Offence', 'Defence', 'Finesse', 'Knowledge',
  'Fieldcraft', 'Social', 'Leadership', 'Tech',
  'Weapon Skill', 'Ballistic Skill', 'Strength', 'Toughness',
  'Agility', 'Intelligence', 'Perception', 'Willpower', 'Fellowship'
];

export const CHAR_ABBREVS = ['WS', 'BS', 'S', 'T', 'AG', 'INT', 'PER', 'WP', 'FEL'] as const;
export const CHAR_FULL: Record<string, string> = {
  WS: 'Weapon Skill', BS: 'Ballistic Skill', S: 'Strength', T: 'Toughness',
  AG: 'Agility', INT: 'Intelligence', PER: 'Perception', WP: 'Willpower', FEL: 'Fellowship'
};

/**
 * Expand a talent with multiple specialisations inside parentheses into individual entries.
 * E.g. "Weapon Training (Low-Tech, Solid Projectile, Pick One)"
 *    → ["Weapon Training (Low-Tech)", "Weapon Training (Solid Projectile)", "Weapon Training (Pick One)"]
 * 
 * Does NOT expand if the parenthetical contains " or " (that's a choice, not multiple talents).
 * Only expands if there are 2+ comma-separated specs inside the parens.
 */
export function expandSpecialisations(item: string): string[] {
  const match = item.match(/^(.+?)\s*\((.+)\)\s*$/);
  if (!match) return [item];

  const baseName = match[1].trim();
  const inner = match[2].trim();

  // If the inner contains " or " at the top level, it's a choice — don't expand
  // (choices like "Chain or Low-Tech or Shock" should stay as-is)
  let depth = 0;
  for (let i = 0; i < inner.length; i++) {
    if (inner[i] === '(') depth++;
    else if (inner[i] === ')') depth--;
    else if (depth === 0 && inner.slice(i, i + 4) === ' or ') return [item];
  }

  // Split specs on comma
  const specs = inner.split(',').map(s => s.trim()).filter(Boolean);
  if (specs.length <= 1) return [item];

  return specs.map(spec => `${baseName} (${spec})`);
}

/**
 * Check if a talent/skill string contains "Pick One" — needs user text input.
 */
export function hasPickOne(item: string): boolean {
  return /pick one/i.test(item);
}
