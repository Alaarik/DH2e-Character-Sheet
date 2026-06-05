// Advancement data constants for Dark Heresy 2e XP system

export const APTITUDE_LIST = [
  'General', 'Offence', 'Defence', 'Finesse', 'Knowledge',
  'Fieldcraft', 'Social', 'Leadership', 'Psyker', 'Tech',
  'Weapon Skill', 'Ballistic Skill', 'Strength', 'Toughness',
  'Agility', 'Intelligence', 'Perception', 'Willpower', 'Fellowship'
] as const;

export type Aptitude = typeof APTITUDE_LIST[number];

// Characteristic → paired aptitudes
// Some have "or" (Willpower: Psyker or Leadership)
export const CHARACTERISTIC_APTITUDES: Record<string, string[][]> = {
  WS:  [['Weapon Skill'], ['Offence']],
  BS:  [['Ballistic Skill'], ['Finesse']],
  S:   [['Strength'], ['Offence']],
  T:   [['Toughness'], ['Defence']],
  AG:  [['Agility'], ['Finesse']],
  INT: [['Intelligence'], ['Knowledge']],
  PER: [['Perception'], ['Fieldcraft']],
  WP:  [['Willpower'], ['Psyker', 'Leadership']],
  FEL: [['Fellowship'], ['Social']],
};

// Skill → paired aptitudes
// Each entry is [aptitude1Options[], aptitude2Options[]]
// "or" aptitudes are represented as arrays with multiple options
export const SKILL_APTITUDES: Record<string, string[][]> = {
  'Acrobatics':            [['Agility'], ['General']],
  'Athletics':             [['Strength'], ['General']],
  'Awareness':             [['Perception'], ['General']],
  'Charm':                 [['Fellowship'], ['Social']],
  'Command':               [['Fellowship'], ['Leadership']],
  'Commerce':              [['Intelligence'], ['General']],
  'Common Lore':           [['Intelligence'], ['General']],
  'Deceive':               [['Fellowship'], ['General']],
  'Dodge':                 [['Agility'], ['Defence']],
  'Forbidden Lore':        [['Intelligence'], ['Knowledge']],
  'Inquiry':               [['Fellowship'], ['Social']],
  'Interrogation':         [['Intelligence', 'Willpower'], ['Social']],
  'Intimidate':            [['Strength', 'Willpower'], ['Social']],
  'Linguistics':           [['Intelligence'], ['General']],
  'Logic':                 [['Intelligence'], ['Knowledge']],
  'Medicae':               [['Intelligence'], ['Fieldcraft']],
  'Navigate':              [['Intelligence'], ['Fieldcraft']],
  'Operate (Surface)':     [['Agility'], ['Fieldcraft', 'Tech']],
  'Operate (Aeronautica)': [['Agility'], ['Tech']],
  'Operate (Voidship)':    [['Intelligence'], ['Tech']],
  'Parry':                 [['Weapon Skill'], ['Defence']],
  'Psyniscience':          [['Perception'], ['Psyker']],
  'Scholastic Lore':       [['Intelligence'], ['Knowledge']],
  'Scrutiny':              [['Perception'], ['General']],
  'Security':              [['Intelligence'], ['Fieldcraft', 'Tech']],
  'Sleight of Hand':       [['Agility'], ['Knowledge']],
  'Stealth':               [['Agility'], ['Fieldcraft']],
  'Survival':              [['Perception'], ['Fieldcraft']],
  'Tech-Use':              [['Intelligence'], ['Tech']],
  'Trade':                 [['Intelligence'], ['General']],
};

// XP cost tables indexed by [matchingAptitudes][tierIndex]
// Characteristic advances: 5 tiers (+5, +10, +15, +20, +25)
export const CHAR_XP_COSTS: Record<number, number[]> = {
  2: [100, 250, 500, 750, 1250],
  1: [250, 500, 750, 1000, 1500],
  0: [500, 750, 1000, 1500, 2500],
};

export const CHAR_ADVANCE_TIERS = [
  { label: 'Simple (+5)', value: 5, index: 0 },
  { label: 'Intermediate (+10)', value: 10, index: 1 },
  { label: 'Trained (+15)', value: 15, index: 2 },
  { label: 'Expert (+20)', value: 20, index: 3 },
  { label: 'Master (+25)', value: 25, index: 4 },
];

// Skill advances: 4 tiers (Known, Trained +10, Experienced +20, Veteran +30)
export const SKILL_XP_COSTS: Record<number, number[]> = {
  2: [100, 200, 300, 400],
  1: [200, 400, 600, 800],
  0: [300, 600, 900, 1200],
};

export const SKILL_ADVANCE_TIERS = [
  { label: 'Known (+0)', key: 'trained', index: 0 },
  { label: 'Trained (+10)', key: 'plus_10', index: 1 },
  { label: 'Experienced (+20)', key: 'plus_20', index: 2 },
  { label: 'Veteran (+30)', key: 'plus_30', index: 3 },
];

// Talent advances: 3 tiers
export const TALENT_XP_COSTS: Record<number, number[]> = {
  2: [200, 300, 400],
  1: [300, 450, 600],
  0: [600, 900, 1200],
};

/**
 * Count how many aptitudes match between a character's aptitudes and required aptitude slots.
 * Each slot is an array of options (for "or" aptitudes); a match on any option in a slot counts.
 */
export function countMatchingAptitudes(
  characterAptitudes: string[],
  requiredSlots: string[][]
): number {
  let matches = 0;
  for (const slot of requiredSlots) {
    if (slot.some(apt => characterAptitudes.includes(apt))) {
      matches++;
    }
  }
  return Math.min(matches, 2); // Max 2 matching
}

/**
 * Get the current advance tier index for a characteristic based on its advances value.
 */
export function getCharAdvanceTierIndex(advances: number): number {
  if (advances >= 25) return 5; // Already maxed
  if (advances >= 20) return 4;
  if (advances >= 15) return 3;
  if (advances >= 10) return 2;
  if (advances >= 5) return 1;
  return 0;
}

/**
 * Get the current advance tier index for a skill based on its training flags.
 */
export function getSkillAdvanceTierIndex(skill: { trained: boolean; plus_10: boolean; plus_20: boolean; plus_30: boolean }): number {
  if (skill.plus_30) return 4; // Already maxed
  if (skill.plus_20) return 3;
  if (skill.plus_10) return 2;
  if (skill.trained) return 1;
  return 0;
}

/**
 * Look up a skill's aptitude slots. Handles specialist skills by normalizing the name.
 */
export function getSkillAptitudes(skillName: string): string[][] | null {
  // Direct match first
  if (SKILL_APTITUDES[skillName]) return SKILL_APTITUDES[skillName];
  
  // Try parent category (e.g., "Common Lore (Imperial Creed)" → "Common Lore")
  for (const key of Object.keys(SKILL_APTITUDES)) {
    if (skillName.startsWith(key)) return SKILL_APTITUDES[key];
  }
  
  return null;
}

/**
 * Full names for characteristic abbreviations
 */
export const CHAR_FULL_NAMES: Record<string, string> = {
  WS: 'Weapon Skill', BS: 'Ballistic Skill', S: 'Strength', T: 'Toughness',
  AG: 'Agility', INT: 'Intelligence', PER: 'Perception', WP: 'Willpower', FEL: 'Fellowship'
};
