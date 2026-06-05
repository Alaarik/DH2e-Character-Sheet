import { CHAR_ABBREVS, parseChoiceString } from './chargenData';

export interface ParsedDivination {
  insanity: number;
  corruption: number;
  fate: number;
  wounds: number;
  statMods: Record<string, number>;
  skills: string[];
  talents: string[];
  traits: string[];
  choices: {
    id: string;
    options: {
      label: string;
      statMods?: Record<string, number>;
      skills?: string[];
      talents?: string[];
    }[];
  }[];
  conditionalAdditions: {
    requireSkill?: string[];
    requireTalent?: string[];
    yes: { statMods?: Record<string, number>; skills?: string[]; talents?: string[]; choices?: any[] };
    no: { statMods?: Record<string, number>; skills?: string[]; talents?: string[]; choices?: any[] };
  }[];
}

function resolveChar(name: string): string {
  let upper = name.trim().toUpperCase();
  upper = upper.replace(' CHARACTERISTIC', ''); // Strip just in case
  const CHAR_FULL: Record<string, string> = {
    'WS': 'WEAPON SKILL', 'BS': 'BALLISTIC SKILL', 'S': 'STRENGTH', 'T': 'TOUGHNESS',
    'AG': 'AGILITY', 'INT': 'INTELLIGENCE', 'PER': 'PERCEPTION', 'WP': 'WILLPOWER', 'FEL': 'FELLOWSHIP'
  };
  if (CHAR_FULL[upper]) return upper; // Already an abbrev
  for (const [abbrev, full] of Object.entries(CHAR_FULL)) {
    if (upper === full || upper.includes(full)) return abbrev;
  }
  return upper;
}

function parseStatAdditions(text: string): { statMods: Record<string, number>, choices: any[] } {
  const statMods: Record<string, number> = {};
  const choices: any[] = [];

  // Increase Char or Char by X
  const incOrRegex = /(?:Increase this character['’]s|increase his) ([\w\s]+) or ([\w\s]+) characteristic by (\d+)/ig;
  for (const match of [...text.matchAll(incOrRegex)]) {
    const c1 = resolveChar(match[1]);
    const c2 = resolveChar(match[2]);
    const val = parseInt(match[3]);
    choices.push({
      id: `choice_stat_inc_${c1}_${c2}`,
      options: [
        { label: `+${val} ${c1}`, statMods: { [c1]: val } },
        { label: `+${val} ${c2}`, statMods: { [c2]: val } }
      ]
    });
  }

  // Reduce Char or Char by X
  const decOrRegex = /reduce his ([\w\s]+) or ([\w\s]+) characteristic by (\d+)/ig;
  for (const match of [...text.matchAll(decOrRegex)]) {
    const c1 = resolveChar(match[1]);
    const c2 = resolveChar(match[2]);
    const val = -parseInt(match[3]);
    choices.push({
      id: `choice_stat_dec_${c1}_${c2}`,
      options: [
        { label: `${val} ${c1}`, statMods: { [c1]: val } },
        { label: `${val} ${c2}`, statMods: { [c2]: val } }
      ]
    });
  }

  // Increase Char by X (not "or")
  const incRegex = /(?:Increase this character['’]s|increase his) ([\w\s]+) (?:characteristic )?by (\d+)/ig;
  for (const match of [...text.matchAll(incRegex)]) {
    if (match[0].toLowerCase().includes(' or ')) continue;
    const c = resolveChar(match[1]);
    const val = parseInt(match[2]);
    statMods[c] = (statMods[c] || 0) + val;
  }

  // Reduce Char by X (not "or")
  const decRegex = /reduce (?:this character['’]s|his) ([\w\s]+) (?:characteristic )?by (\d+)/ig;
  for (const match of [...text.matchAll(decRegex)]) {
    if (match[0].toLowerCase().includes(' or ')) continue;
    const c = resolveChar(match[1]);
    const val = -parseInt(match[2]);
    statMods[c] = (statMods[c] || 0) + val;
  }

  return { statMods, choices };
}

function parseSkillsAndTalents(text: string): { skills: string[], talents: string[], choices: any[] } {
  const skills: string[] = [];
  const talents: string[] = [];
  const choices: any[] = [];

  const skillMatch = text.match(/gains the (.*?) skill/i);
  if (skillMatch) {
    const parsed = parseChoiceString(skillMatch[1]);
    skills.push(...parsed.auto);
    if (parsed.choices.length > 0) {
      parsed.choices.forEach((opt, idx) => {
        choices.push({
          id: `choice_skill_${idx}`,
          options: opt.map(s => ({ label: s, skills: [s] }))
        });
      });
    }
  }

  const talentMatch = text.match(/gains the (.*?) talent/i);
  if (talentMatch) {
    const parsed = parseChoiceString(talentMatch[1]);
    talents.push(...parsed.auto);
    if (parsed.choices.length > 0) {
      parsed.choices.forEach((opt, idx) => {
        choices.push({
          id: `choice_talent_${idx}`,
          options: opt.map(t => ({ label: t, talents: [t] }))
        });
      });
    }
  }

  return { skills, talents, choices };
}

export function parseDivinationEffect(effect: string): ParsedDivination {
  const result: ParsedDivination = {
    insanity: 0, corruption: 0, fate: 0, wounds: 0,
    statMods: {}, skills: [], talents: [], traits: [],
    choices: [], conditionalAdditions: []
  };

  if (!effect) return result;

  // 1. Points
  let m = effect.match(/(\d+)\s+Insanity/i);
  if (m) result.insanity = parseInt(m[1]);
  m = effect.match(/(\d+)\s+Corruption/i);
  if (m) result.corruption = parseInt(m[1]);
  m = effect.match(/Fate threshold by (\d+)/i);
  if (m) result.fate = parseInt(m[1]);

  // Strip conditionals to parse the "NO" branch as the main branch, and "YES" branch separately
  const condRegex = /If he already possesses (?:this|these) (skill|skills|talent|talents)(?:.*?),(.*?)(?:\.|$)/i;
  const condMatch = effect.match(condRegex);
  
  let mainEffect = effect;
  if (condMatch) {
    mainEffect = effect.replace(condMatch[0], ''); // Remove conditional from main parse
    
    const isTalent = condMatch[1].toLowerCase().includes('talent');
    const altEffect = condMatch[2]; // e.g. "he increases his Perception characteristic by 3 instead"
    
    // Determine what skill/talent is required by looking at the sentence before the conditional
    const sentenceBefore = mainEffect.match(/gains the (.*?) (skill|talent)/i);
    let reqItems: string[] = [];
    if (sentenceBefore) {
      const parsed = parseChoiceString(sentenceBefore[1]);
      reqItems = [...parsed.auto, ...parsed.choices.flat()];
    }

    const altStats = parseStatAdditions(altEffect);
    const altSt = parseSkillsAndTalents(altEffect);

    result.conditionalAdditions.push({
      requireSkill: isTalent ? undefined : reqItems,
      requireTalent: isTalent ? reqItems : undefined,
      yes: {
        statMods: altStats.statMods,
        skills: altSt.skills,
        talents: altSt.talents,
        choices: [...altStats.choices, ...altSt.choices]
      },
      no: {
        statMods: {}, // Will be populated by main parser if it's part of the same sentence? No, main parser does it globally.
        skills: [],
        talents: []
      }
    });

    // Wait, the main parser will pick up the "gains the X skill" from mainEffect!
    // But we only want them to gain it IF they don't have it.
    // So we should REMOVE that from the main parser and put it in the "no" branch.
    if (sentenceBefore) {
      mainEffect = mainEffect.replace(sentenceBefore[0], '');
      const noSt = parseSkillsAndTalents(sentenceBefore[0]);
      result.conditionalAdditions[0].no = {
        statMods: {},
        skills: noSt.skills,
        talents: noSt.talents,
        choices: noSt.choices
      };
    }
  }

  // Parse remaining main effect
  const mainStats = parseStatAdditions(mainEffect);
  Object.assign(result.statMods, mainStats.statMods);
  result.choices.push(...mainStats.choices);

  const mainSt = parseSkillsAndTalents(mainEffect);
  result.skills.push(...mainSt.skills);
  result.talents.push(...mainSt.talents);
  result.choices.push(...mainSt.choices);

  // Capture anything that is an ongoing effect or trait rule
  // We can just dump the whole text as a trait, which the wizard already does!
  // So we don't need to populate result.traits with pieces of sentences.
  // The wizard adds the whole `effect` as the trait description.
  
  return result;
}
