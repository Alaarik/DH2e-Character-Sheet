import React, { useState, useEffect, useMemo } from 'react';
import { CharacterFull, XpPurchase, Talent } from '../hooks/useCharacter';
import EditModal from './EditModal';
import { BASE_SKILLS } from './SkillList';
import {
  APTITUDE_LIST, CHARACTERISTIC_APTITUDES, CHAR_XP_COSTS, CHAR_ADVANCE_TIERS,
  SKILL_XP_COSTS, SKILL_ADVANCE_TIERS, TALENT_XP_COSTS,
  countMatchingAptitudes, getCharAdvanceTierIndex, getSkillAdvanceTierIndex,
  getSkillAptitudes, CHAR_FULL_NAMES
} from '../data/advancementData';

interface TalentTemplate {
  name: string;
  tier: number;
  aptitude1: string | null;
  aptitude2: string | null;
  prerequisites: string | null;
  description: string | null;
  specialisations: string[];
  limited: string | null;
}

export interface PowerTemplate {
  name: string;
  discipline: string;
  technique: string;
  xp_cost: number;
  prerequisite: string;
  test: string;
  mod: string;
  opposed: string;
  action: string;
  sustain: string;
  effect: string;
  range: string;
  radius: string;
  damage: string;
  damage_type: string;
  pen: string;
  special: string;
}

interface Props {
  character: CharacterFull;
  update: (updates: Record<string, unknown>) => Promise<void>;
}


interface CartItem {
  id: number;
  category: string;
  name: string;
  level: string;
  cost: number;
  isFree: boolean;
  freeReason: string;
  updates: Partial<CharacterFull>;
}

export default function AdvancementTab({ character, update }: Props) {
  const [cart, setCart] = useState<CartItem[]>([]);

  const [editingXp, setEditingXp] = useState(false);
  const [xpValue, setXpValue] = useState(0);
  const [addingAptitude, setAddingAptitude] = useState(false);
  const [talentTemplates, setTalentTemplates] = useState<TalentTemplate[]>([]);
  const [powerTemplates, setPowerTemplates] = useState<PowerTemplate[]>([]);
  const [addingTalent, setAddingTalent] = useState(false);
  const [talentSearch, setTalentSearch] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<TalentTemplate | null>(null);
  const [selectedSpec, setSelectedSpec] = useState('');
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    chars: true, skills: false, talents: false, powers: false, ledger: false
  });
  const [confirmPurchase, setConfirmPurchase] = useState<{ type: string; name: string; level: string; cost: number; updates: Partial<CharacterFull> } | null>(null);
  const [isFree, setIsFree] = useState(false);
  const [freeReason, setFreeReason] = useState('');

  
  const previewCharacter = useMemo(() => {
    let char = { ...character };
    for (const item of cart) {
      char = { ...char, ...item.updates };
    }
    return char;
  }, [character, cart]);

  const aptitudes = previewCharacter.aptitudes || [];
  const savedPurchases = character.xp_purchases || [];
  const totalXp = previewCharacter.total_xp || 0;
  const savedXpUsed = savedPurchases.reduce((s, p) => s + p.xp_cost, 0);
  const cartXpUsed = cart.reduce((s, c) => s + c.cost, 0);
  const xpUsed = savedXpUsed + cartXpUsed;
  const xpRemaining = totalXp - xpUsed;

  useEffect(() => {
    fetch('/api/talents/templates', { credentials: 'include' })
      .then(r => r.ok ? r.json() : [])
      .then(setTalentTemplates)
      .catch(() => {});

    fetch('/api/powers/templates', { credentials: 'include' })
      .then(r => r.ok ? r.json() : [])
      .then(data => setPowerTemplates(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  const toggle = (key: string) => setExpandedSections(s => ({ ...s, [key]: !s[key] }));



  const removeXpPurchase = async (purchaseId: number) => {
    const purchase = savedPurchases.find(p => p.id === purchaseId);
    if (!purchase) return;

    if (!window.confirm(`Are you sure you want to refund ${purchase.name}? This will remove the advance from your sheet.`)) return;

    const updates: Record<string, unknown> = {
      xp_purchases: savedPurchases.filter(p => p.id !== purchaseId)
    };

    if (purchase.category === 'Characteristic') {
      const char = character.characteristics.find(c => (CHAR_FULL_NAMES[c.abbrev] || c.abbrev) === purchase.name);
      if (char) {
        const newAdvances = Math.max(0, char.advances - 5);
        const newTotal = char.base + char.modifier + char.talent + newAdvances - char.temp_damage - char.perm_damage;
        updates.characteristics = character.characteristics.map(c => 
          c.abbrev === char.abbrev ? { ...c, advances: newAdvances, total: newTotal, bonus: Math.floor(newTotal / 10) + c.unnatural } : c
        );
      }
    } else if (purchase.category === 'Skill') {
      const skill = character.skills.find(s => s.name === purchase.name);
      if (skill) {
        const updated = { ...skill };
        if (purchase.advance_level.includes('+30')) updated.plus_30 = false;
        else if (purchase.advance_level.includes('+20')) updated.plus_20 = false;
        else if (purchase.advance_level.includes('+10')) updated.plus_10 = false;
        else if (purchase.advance_level.includes('+0')) updated.trained = false;
        
        const baseStat = previewCharacter.characteristics.find(c => c.abbrev === skill.characteristic)?.total || 0;
        let bonus = -20;
        if (updated.plus_30) bonus = 30;
        else if (updated.plus_20) bonus = 20;
        else if (updated.plus_10) bonus = 10;
        else if (updated.trained) bonus = 0;
        updated.total = Math.max(0, baseStat + updated.talent + bonus);

        updates.skills = character.skills.map(s => s.id === skill.id ? updated : s);
      }
    } else if (purchase.category === 'Talent') {
      let removed = false;
      updates.talents = (character.talents || []).filter(t => {
        if (removed) return true;
        const displayName = t.specialisation ? `${t.name} (${t.specialisation})` : t.name;
        if (displayName === purchase.name) {
          removed = true;
          return false;
        }
        return true;
      });
    } else if (purchase.category === 'Power') {
      updates.powers = (previewCharacter.powers || []).filter(p => p.name !== purchase.name);
    } else if (purchase.category === 'Psy Rating') {
      updates.psy_rating = Math.max(0, (previewCharacter.psy_rating || 0) - 1);
    }

    await update(updates);
  };

  // --- Characteristic purchase ---
  const buyCharAdvance = (abbrev: string) => {
    const char = previewCharacter.characteristics.find(c => c.abbrev === abbrev);
    if (!char) return;
    const tierIdx = getCharAdvanceTierIndex(char.advances);
    if (tierIdx >= 5) return;
    const tier = CHAR_ADVANCE_TIERS[tierIdx];
    const slots = CHARACTERISTIC_APTITUDES[abbrev];
    const matches = countMatchingAptitudes(aptitudes, slots);
    const cost = CHAR_XP_COSTS[matches][tier.index];

    const updatedChars = previewCharacter.characteristics.map(c => {
      if (c.abbrev !== abbrev) return c;
      const newAdvances = c.advances + 5;
      const newTotal = c.base + c.modifier + c.talent + newAdvances - c.temp_damage - c.perm_damage;
      return { ...c, advances: newAdvances, total: newTotal, bonus: Math.floor(newTotal / 10) + c.unnatural };
    });

    setConfirmPurchase({
      type: 'Characteristic', name: CHAR_FULL_NAMES[abbrev] || abbrev, level: tier.label, cost,
      updates: { characteristics: updatedChars }
    });
  };

  // --- Psy Rating purchase ---
  const buyPsyRating = () => {
    const currentPR = previewCharacter.psy_rating || 0;
    const nextPR = currentPR + 1;
    const cost = nextPR * 200;

    setConfirmPurchase({
      type: 'Psy Rating', name: 'Psy Rating', level: `PR ${nextPR}`, cost,
      updates: { psy_rating: nextPR }
    });
  };

  // --- Skill purchase ---
  const buySkillAdvance = (skillName: string) => {
    let skill = previewCharacter.skills.find(s => s.name === skillName);
    let isNew = false;
    if (!skill) {
      const base = BASE_SKILLS.find(b => b.name === skillName);
      if (!base) return;
      skill = { ...base, id: -Math.random(), trained: false, plus_10: false, plus_20: false, plus_30: false, talent: 0, total: 0, advances: 0, modifier: 0, is_custom: 0, aptitude_1: null, aptitude_2: null };
      isNew = true;
    }
    const tierIdx = getSkillAdvanceTierIndex(skill);
    if (tierIdx >= 4) return;
    const tier = SKILL_ADVANCE_TIERS[tierIdx];
    const slots = getSkillAptitudes(skillName);
    const matches = slots ? countMatchingAptitudes(aptitudes, slots) : 0;
    const cost = SKILL_XP_COSTS[matches][tier.index];

    let updatedSkills = isNew ? [...previewCharacter.skills, skill] : [...previewCharacter.skills];

    updatedSkills = updatedSkills.map(s => {
      if (s.name !== skillName) return s;
      const updated = { ...s };
      if (tier.key === 'trained') updated.trained = true;
      if (tier.key === 'plus_10') { updated.trained = true; updated.plus_10 = true; }
      if (tier.key === 'plus_20') { updated.trained = true; updated.plus_10 = true; updated.plus_20 = true; }
      if (tier.key === 'plus_30') { updated.trained = true; updated.plus_10 = true; updated.plus_20 = true; updated.plus_30 = true; }
      const baseStat = previewCharacter.characteristics.find(c => c.abbrev === s.characteristic)?.total || 0;
      let bonus = -20;
      if (updated.plus_30) bonus = 30;
      else if (updated.plus_20) bonus = 20;
      else if (updated.plus_10) bonus = 10;
      else if (updated.trained) bonus = 0;
      updated.total = Math.max(0, baseStat + updated.talent + bonus);
      return updated;
    });

    setConfirmPurchase({
      type: 'Skill', name: skillName, level: tier.label, cost,
      updates: { skills: updatedSkills }
    });
  };

  // --- Talent purchase ---
  const buyTalent = (template: TalentTemplate, spec: string) => {
    const slots = [template.aptitude1 ? template.aptitude1.split(' or ').map(s => s.trim()) : [], template.aptitude2 ? template.aptitude2.split(' or ').map(s => s.trim()) : []].filter(s => s.length > 0);
    const matches = countMatchingAptitudes(aptitudes, slots);
    const tierIdx = Math.max(0, Math.min(template.tier - 1, 2));
    const cost = TALENT_XP_COSTS[matches][tierIdx];
    const displayName = spec ? `${template.name} (${spec})` : template.name;

    const newTalent: Talent = {
      id: Date.now(), name: template.name, specialisation: spec || null,
      tier: template.tier as 1 | 2 | 3, description: template.description, prerequisites: template.prerequisites
    };

    setConfirmPurchase({
      type: 'Talent', name: displayName, level: `Tier ${template.tier}`, cost,
      updates: { talents: [...(previewCharacter.talents || []), newTalent] }
    });
  };

  const filteredTemplates = talentTemplates.filter(t =>
    t.name.toLowerCase().includes(talentSearch.toLowerCase()) ||
    (t.description || '').toLowerCase().includes(talentSearch.toLowerCase())
  );

  const removeTalent = async (talentId: number) => {
    const talent = (character.talents || []).find(t => t.id === talentId);
    if (!talent) return;
    const displayName = talent.specialisation ? `${talent.name} (${talent.specialisation})` : talent.name;
    // Remove talent and its XP purchase
    const updatedTalents = (character.talents || []).filter(t => t.id !== talentId);
    const updatedPurchases = savedPurchases.filter(p => !(p.category === 'Talent' && p.name === displayName));
    await update({ talents: updatedTalents, xp_purchases: updatedPurchases });
  };

  // --- Prerequisite checking (uses previewCharacter so cart items count) ---
  const charNames: Record<string, string> = {
    'weapon skill': 'WS', 'ballistic skill': 'BS', 'strength': 'S', 'toughness': 'T',
    'agility': 'AG', 'intelligence': 'INT', 'perception': 'PER', 'willpower': 'WP', 'fellowship': 'FEL'
  };
  const CHAR_NAME_PATTERN = /^(Weapon Skill|Ballistic Skill|Strength|Toughness|Agility|Intelligence|Perception|Willpower|Fellowship)$/i;
  const RANKED_SKILL_RE = /^(.+?)\s*\+(\d+)$/;

  const hasTalent = (name: string): boolean => {
    return (previewCharacter.talents || []).some(t => {
      const display = t.specialisation ? `${t.name} (${t.specialisation})` : t.name;
      return display.toLowerCase() === name.toLowerCase() || t.name.toLowerCase() === name.toLowerCase();
    });
  };

  const hasSkill = (name: string, rank?: number): boolean => {
    const skill = previewCharacter.skills.find(s => s.name.toLowerCase() === name.toLowerCase());
    if (!skill) return false;
    if (!rank || rank === 0) return skill.trained;
    if (rank === 10) return skill.plus_10;
    if (rank === 20) return skill.plus_20;
    if (rank === 30) return skill.plus_30;
    return skill.trained;
  };

  // Known talent/skill names that contain commas — must be protected before comma-splitting
  const COMMA_NAMES = ['Look Out, Sir!', 'Hip Shooting, Dual Shot'];

  const meetsPrerequisites = (prereqStr: string | undefined | null): { meets: boolean; reason?: string } => {
    if (!prereqStr || prereqStr === '-' || prereqStr.trim() === '') return { meets: true };

    // Protect known names that contain commas with placeholders
    let safeStr = prereqStr;
    const placeholders: Record<string, string> = {};
    COMMA_NAMES.forEach((name, idx) => {
      const ph = `__COMMA_NAME_${idx}__`;
      if (safeStr.includes(name)) {
        safeStr = safeStr.split(name).join(ph);
        placeholders[ph] = name;
      }
    });

    // Split on commas to get individual requirements, respecting parentheses
    const parts: string[] = [];
    let depth = 0, current = '';
    for (const ch of safeStr) {
      if (ch === '(') depth++;
      if (ch === ')') depth--;
      if (ch === ',' && depth === 0) { parts.push(current.trim()); current = ''; }
      else current += ch;
    }
    if (current.trim()) parts.push(current.trim());

    // Restore placeholders
    const restoreParts = parts.map(p => {
      let restored = p;
      for (const [ph, name] of Object.entries(placeholders)) {
        restored = restored.split(ph).join(name);
      }
      return restored;
    });

    for (const part of restoreParts) {
      if (!part || part.toLowerCase().includes('gm discretion') || part.toLowerCase().includes('elite advance')) continue;

      // "or" alternatives within a single requirement, but only split at top-level (not inside parens)
      const alternatives = splitOrRespectingParens(part);
      const anyMet = alternatives.some(alt => meetsOneRequirement(alt));
      if (!anyMet) {
        return { meets: false, reason: `Requires ${part}` };
      }
    }
    return { meets: true };
  };

  // Split on top-level " or " only (not inside parentheses)
  const splitOrRespectingParens = (str: string): string[] => {
    const results: string[] = [];
    let depth = 0, current = '';
    for (let i = 0; i < str.length; i++) {
      const ch = str[i];
      if (ch === '(') depth++;
      if (ch === ')') depth--;
      // Match " or " at depth 0 (case-insensitive)
      if (depth === 0 && i + 4 <= str.length) {
        const slice = str.substring(i, i + 4);
        if (slice.match(/^ or /i) || (i + 3 === str.length && str.substring(i, i + 3).match(/^ or$/i))) {
          if (slice.match(/^ or /i)) {
            results.push(current.trim());
            current = '';
            i += 3; // skip past " or "
            continue;
          }
        }
      }
      current += ch;
    }
    if (current.trim()) results.push(current.trim());
    return results.filter(Boolean);
  };

  const meetsOneRequirement = (req: string): boolean => {
    if (!req) return true;
    // Psy Rating N+
    const prMatch = req.match(/Psy Rating\s*(\d+)/i);
    if (prMatch) return (previewCharacter.psy_rating || 0) >= parseInt(prMatch[1]);
    // Psyker
    if (req.trim().toLowerCase() === 'psyker') return (previewCharacter.psy_rating || 0) > 0;
    // Insanity / Corruption points
    const ipMatch = req.match(/(\d+)\s*Insanity/i);
    if (ipMatch) return (previewCharacter.insanity_points || 0) >= parseInt(ipMatch[1]);
    const cpMatch = req.match(/(\d+)\s*Corruption/i);
    if (cpMatch) return (previewCharacter.corruption || 0) >= parseInt(cpMatch[1]);
    // Characteristic requirement: "Strength 40"
    const charMatch = req.match(/^(Weapon Skill|Ballistic Skill|Strength|Toughness|Agility|Intelligence|Perception|Willpower|Fellowship)\s+(\d+)$/i);
    if (charMatch) {
      const abbrev = charNames[charMatch[1].toLowerCase()];
      if (!abbrev) return true;
      const stat = previewCharacter.characteristics.find(c => c.abbrev === abbrev);
      return stat ? stat.total >= parseInt(charMatch[2]) : false;
    }
    // Ranked skill: "Trade (Armourer) +10"
    const rankedMatch = req.match(RANKED_SKILL_RE);
    if (rankedMatch) {
      const skillName = rankedMatch[1].trim();
      const rank = parseInt(rankedMatch[2]);
      // Check if this is a characteristic name (skip if so)
      if (!CHAR_NAME_PATTERN.test(skillName)) return hasSkill(skillName, rank);
    }
    // Skill with parenthetical like "Common Lore (any one)" or "Forbidden Lore (Daemonology)"
    if (req.match(/\(any/i)) return true; // "any one" is always fine
    // Check as a talent first (most prerequisite names are talents)
    if (hasTalent(req)) return true;
    // Check as a skill (unranked)
    if (hasSkill(req)) return true;
    // If it looks like a proper noun / unknown, treat as met (avoid false negatives for edge cases)
    return true;
  };

  const basePR = previewCharacter.psy_rating || 0;
  const knownTrees = new Set(
    (previewCharacter.powers || [])
      .map(p => powerTemplates.find(t => t.name.toLowerCase() === p.name.toLowerCase())?.technique)
      .filter(t => t && t !== '-')
  );
  const canLearnNewTree = knownTrees.size < basePR;

  const addablePowers = powerTemplates.filter(t => {
    if (previewCharacter.main_discipline && previewCharacter.main_discipline !== 'None' && t.discipline !== previewCharacter.main_discipline) return false;
    if ((previewCharacter.powers || []).some(p => p.name.toLowerCase() === t.name.toLowerCase())) return false;
    if (!canLearnNewTree && t.technique && t.technique !== '-' && !knownTrees.has(t.technique)) return false;
    return true;
  }).map(t => {
    const check = meetsPrerequisites(t.prerequisite);
    return { ...t, disabled: !check.meets, reason: check.reason };
  });

  const handleLearnPower = (templateName: string) => {
    if (!templateName) return;
    const tmpl = powerTemplates.find(t => t.name === templateName);
    if (!tmpl) return;

    const cost = tmpl.xp_cost || 0;

    setConfirmPurchase({
      type: 'Power', name: tmpl.name, level: 'Learned', cost,
      updates: { powers: [...(previewCharacter.powers || []), { id: Date.now() + Math.random(), name: tmpl.name, discipline: tmpl.discipline, technique: tmpl.technique }] }
    });
  };

  return (
    <div style={{ paddingBottom: '32px' }}>
      {/* XP Summary */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--space-sm)',
        marginBottom: 'var(--space-md)'
      }}>
        {[
          { label: 'Total XP', value: totalXp, editable: true },
          { label: 'XP Used', value: xpUsed, editable: false },
          { label: 'XP Remaining', value: xpRemaining, editable: false, warn: xpRemaining < 0 },
        ].map(item => (
          <div key={item.label}
            onClick={item.editable ? () => { setXpValue(totalXp); setEditingXp(true); } : undefined}
            style={{
              padding: 'var(--space-sm)', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-color)', textAlign: 'center',
              cursor: item.editable ? 'pointer' : 'default',
              ...(item.warn ? { borderColor: 'var(--color-danger, #ef4444)' } : {})
            }}>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{item.label}</div>
            <div style={{ fontSize: '1.3rem', fontWeight: 700, color: item.warn ? 'var(--color-danger, #ef4444)' : 'var(--text-primary)' }}>{item.value.toLocaleString()}</div>
          </div>
        ))}
      </div>

      
      {/* Shopping Cart */}
      {cart.length > 0 && (
        <div style={{ marginBottom: 'var(--space-md)', padding: 'var(--space-sm)', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', border: '2px solid var(--theme-color, #8b5cf6)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-sm)' }}>
            <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--theme-color, #8b5cf6)' }}>Pending Advances</div>
            <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>Cart Total: {cartXpUsed} xp</div>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: 'var(--space-sm)' }}>
            {cart.map((item) => (
              <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', padding: '4px 8px', background: 'rgba(0,0,0,0.2)', borderRadius: '4px', color: 'var(--text-primary)' }}>
                <span>
                  <span style={{ color: 'var(--text-muted)', marginRight: '6px' }}>[{item.category}]</span>
                  <strong>{item.name}</strong> <span style={{ color: 'var(--text-secondary)' }}>{item.level}</span>
                  {item.isFree && <span style={{ color: 'var(--color-success, #22c55e)', marginLeft: '6px' }}>(Free)</span>}
                </span>
                <span style={{ color: 'var(--text-primary)' }}>{item.isFree ? 0 : item.cost} xp</span>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="btn btn--danger" style={{ padding: '4px 12px', fontSize: '0.8rem' }} onClick={() => setCart(cart.slice(0, -1))}>Undo Last</button>
              <button className="btn" style={{ padding: '4px 12px', fontSize: '0.8rem' }} onClick={() => setCart([])}>Clear Cart</button>
            </div>
            <button className="btn btn--primary" style={{ padding: '6px 16px', fontWeight: 600 }} onClick={async () => {
              if (cart.length === 0) return;
              const newPurchases = cart.map(item => ({
                id: item.id,
                category: item.category as any,
                name: item.name,
                advance_level: item.isFree ? `${item.level} (Free${item.freeReason ? `: ${item.freeReason}` : ''})` : item.level,
                xp_cost: item.isFree ? 0 : item.cost
              }));
              await update({
                ...previewCharacter,
                xp_purchases: [...(character.xp_purchases || []), ...newPurchases]
              });
              setCart([]);
            }} disabled={xpRemaining < 0}>
              Checkout
            </button>
          </div>
        </div>
      )}

      {/* Aptitudes */}
      <div style={{ marginBottom: 'var(--space-md)', padding: 'var(--space-sm)', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 'var(--space-xs)' }}>Aptitudes</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          {aptitudes.map(apt => (
            <span key={apt} className="badge" style={{ cursor: 'pointer', fontSize: '0.8rem' }}
              onClick={() => update({ aptitudes: aptitudes.filter(a => a !== apt) })}
              title="Click to remove">
              {apt} ✕
            </span>
          ))}
          <button className="btn" style={{ padding: '2px 10px', fontSize: '0.8rem', borderStyle: 'dashed' }}
            onClick={() => setAddingAptitude(true)}>+</button>
        </div>
      </div>

      {/* Characteristic Advances */}
      <div style={{ marginBottom: 'var(--space-sm)' }}>
        <div className="skill-category" style={{ cursor: 'pointer' }} onClick={() => toggle('chars')}>
          {expandedSections.chars ? '▼' : '▶'} Characteristic Advances
        </div>
        {expandedSections.chars && previewCharacter.characteristics.map(char => {
          const tierIdx = getCharAdvanceTierIndex(char.advances);
          const maxed = tierIdx >= 5;
          const nextTier = maxed ? null : CHAR_ADVANCE_TIERS[tierIdx];
          const slots = CHARACTERISTIC_APTITUDES[char.abbrev];
          const matches = slots ? countMatchingAptitudes(aptitudes, slots) : 0;
          const cost = nextTier ? CHAR_XP_COSTS[matches][nextTier.index] : 0;
          return (
            <div key={char.abbrev} className="skill-row" style={{ justifyContent: 'space-between' }}>
              <span className="skill-row__name" style={{ minWidth: '100px' }}>
                {CHAR_FULL_NAMES[char.abbrev] || char.abbrev}
                <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginLeft: '6px' }}>+{char.advances}</span>
              </span>
              {maxed ? (
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Maxed</span>
              ) : (
                <button className="btn" style={{ padding: '2px 8px', fontSize: '0.75rem' }}
                  onClick={() => buyCharAdvance(char.abbrev)}
                  disabled={cost > xpRemaining}>
                  {nextTier!.label} — {cost} xp
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Psy Rating Advance */}
      {(previewCharacter.psy_rating || 0) > 0 && (
        <div style={{ marginBottom: 'var(--space-sm)' }}>
          <div className="skill-category">Psy Rating</div>
          <div className="skill-row" style={{ justifyContent: 'space-between' }}>
            <span className="skill-row__name">
              Psy Rating
              <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginLeft: '6px' }}>PR {previewCharacter.psy_rating}</span>
            </span>
            <button className="btn" style={{ padding: '2px 8px', fontSize: '0.75rem' }}
              onClick={buyPsyRating}
              disabled={((previewCharacter.psy_rating || 0) + 1) * 200 > xpRemaining}>
              PR {(previewCharacter.psy_rating || 0) + 1} — {((previewCharacter.psy_rating || 0) + 1) * 200} xp
            </button>
          </div>
        </div>
      )}

      {/* Skill Advances */}
      <div style={{ marginBottom: 'var(--space-sm)' }}>
        <div className="skill-category" style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between' }} onClick={() => toggle('skills')}>
          <span>{expandedSections.skills ? '▼' : '▶'} Skill Advances</span>
        </div>
        {expandedSections.skills && (() => {
          // Merge base skills with character's existing skills to show Untrained ones
          const mergedSkills = [...previewCharacter.skills];
          for (const base of BASE_SKILLS) {
            if (!mergedSkills.find(s => s.name === base.name)) {
              mergedSkills.push({
                id: -Math.random(),
                name: base.name,
                characteristic: base.characteristic,
                category: base.category,
                advances: 0,
                modifier: 0,
                is_custom: 0,
                aptitude_1: null,
                aptitude_2: null,
                talent: 0,
                trained: false,
                plus_10: false,
                plus_20: false,
                plus_30: false,
                total: 0
              });
            }
          }
          // Sort alphabetically
          mergedSkills.sort((a, b) => a.name.localeCompare(b.name));

          return (
            <>
              {mergedSkills.map(skill => {
                const tierIdx = getSkillAdvanceTierIndex(skill);
          const maxed = tierIdx >= 4;
          const nextTier = maxed ? null : SKILL_ADVANCE_TIERS[tierIdx];
          const slots = getSkillAptitudes(skill.name);
          const matches = slots ? countMatchingAptitudes(aptitudes, slots) : 0;
          const cost = nextTier ? SKILL_XP_COSTS[matches][nextTier.index] : 0;
          const currentLabel = tierIdx === 0 ? 'Untrained' : SKILL_ADVANCE_TIERS[tierIdx - 1]?.label || 'Known';
          return (
            <div key={skill.name} className="skill-row" style={{ justifyContent: 'space-between' }}>
              <span className="skill-row__name" style={{ minWidth: '100px' }}>
                {skill.name}
                <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginLeft: '6px' }}>{currentLabel}</span>
              </span>
              {maxed ? (
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Maxed</span>
              ) : (
                <button className="btn" style={{ padding: '2px 8px', fontSize: '0.75rem' }}
                  onClick={() => buySkillAdvance(skill.name)}
                  disabled={cost > xpRemaining}>
                  {nextTier!.label} — {cost} xp
                </button>
              )}
            </div>
          );
        })}
        <div style={{ marginTop: 'var(--space-md)', padding: 'var(--space-sm)', background: 'var(--bg-secondary)', borderRadius: '4px' }}>
          <div style={{ fontSize: '0.8rem', marginBottom: '8px' }}>Add Skill</div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <select id="custom-skill-select" className="input" style={{ width: '160px' }}>
              <option value="Common Lore">Common Lore ()</option>
              <option value="Scholastic Lore">Scholastic Lore ()</option>
              <option value="Forbidden Lore">Forbidden Lore ()</option>
              <option value="Linguistics">Linguistics ()</option>
              <option value="Trade">Trade ()</option>
            </select>
            <input id="custom-skill-spec" className="input" placeholder="e.g. War, Tech, Voidfarer..." style={{ flex: 1 }} />
            <button className="btn btn--primary" onClick={() => {
              const sel = document.getElementById('custom-skill-select') as HTMLSelectElement;
              const input = document.getElementById('custom-skill-spec') as HTMLInputElement;
              if (sel && input && input.value.trim()) {
                const newName = `${sel.value} (${input.value.trim()})`;
                if (!character.skills.find(s => s.name.toLowerCase() === newName.toLowerCase())) {
                  const newSkill = {
                    id: -Math.random(),
                    name: newName,
                    characteristic: 'INT', // These base skills default to INT
                    category: sel.value === 'Trade' ? 'General' : (sel.value === 'Linguistics' ? 'Language' : 'Investigation'),
                    advances: 0,
                    modifier: 0,
                    is_custom: 1,
                    aptitude_1: null,
                    aptitude_2: null,
                    talent: 0,
                    trained: false,
                    plus_10: false,
                    plus_20: false,
                    plus_30: false,
                    total: 0
                  };
                  update({ ...character, skills: [...character.skills, newSkill] });
                }
                input.value = '';
              }
            }}>Add</button>
          </div>
        </div>
        </>
        );
        })()}
      </div>

      {/* Talent Advances */}
      <div style={{ marginBottom: 'var(--space-sm)' }}>
        <div className="skill-category" style={{ cursor: 'pointer' }} onClick={() => toggle('talents')}>
          {expandedSections.talents ? '▼' : '▶'} Talents ({(previewCharacter.talents || []).length})
        </div>
        {expandedSections.talents && (
          <>
            {(previewCharacter.talents || []).map(talent => {
              const isPending = !(character.talents || []).some(t => t.id === talent.id);
              return (
              <div key={talent.id} className="skill-row" style={{ justifyContent: 'space-between' }}>
                <span className="skill-row__name" style={{ flex: 1 }}>
                  {talent.name}{talent.specialisation ? ` (${talent.specialisation})` : ''}
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginLeft: '6px' }}>T{talent.tier}</span>
                </span>
                {isPending ? (
                  <span style={{ fontSize: '0.75rem', color: 'var(--theme-color)' }}>Pending</span>
                ) : (
                  <button className="btn btn--danger" style={{ padding: '2px 8px', fontSize: '0.7rem' }} onClick={() => removeTalent(talent.id)}>✕</button>
                )}
              </div>
              );
            })}
            <button className="btn" style={{ width: '100%', marginTop: 'var(--space-xs)', borderStyle: 'dashed' }}
              onClick={() => { setAddingTalent(true); setTalentSearch(''); setSelectedTemplate(null); }}>
              + Add Talent
            </button>
          </>
        )}
      </div>

      {/* Powers */}
      <div style={{ marginBottom: 'var(--space-sm)' }}>
        <div className="skill-category" style={{ cursor: 'pointer' }} onClick={() => toggle('powers')}>
          {expandedSections.powers ? '▼' : '▶'} Powers ({(previewCharacter.powers || []).length})
        </div>
        {expandedSections.powers && (
          <>
            {(previewCharacter.powers || []).map(power => {
              const isPending = !(character.powers || []).some(p => p.id === power.id);
              const hasPurchase = savedPurchases.some(p => p.category === 'Power' && p.name === power.name);
              return (
                <div key={power.id} className="skill-row" style={{ justifyContent: 'space-between' }}>
                  <span className="skill-row__name">{power.name}</span>
                  {hasPurchase ? (
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>✓ Purchased</span>
                  ) : (
                    isPending ? <span style={{ fontSize: '0.75rem', color: 'var(--theme-color)' }}>Pending</span> : <span style={{ fontSize: '0.75rem', color: 'var(--color-warning, #f59e0b)' }}>No XP entry</span>
                  )}
                </div>
              );
            })}
            
            <div style={{ marginTop: 'var(--space-sm)' }}>
              <select className="input" defaultValue="" onChange={(e) => {
                handleLearnPower(e.target.value);
                e.target.value = '';
              }}>
                <option value="" disabled>+ Learn New Power...</option>
                {addablePowers.map(t => {
                  const cost = t.xp_cost || 0;
                  return (
                    <option key={t.name} value={t.name} disabled={t.disabled}>
                      {t.name} ({t.discipline}{t.technique && t.technique !== '-' ? ` - ${t.technique}` : ''}) {t.disabled ? `[${t.reason}]` : `- ${cost} xp`}
                    </option>
                  );
                })}
              </select>
            </div>
          </>
        )}
      </div>

      {/* XP Ledger */}
      <div>
        <div className="skill-category" style={{ cursor: 'pointer' }} onClick={() => toggle('ledger')}>
          {expandedSections.ledger ? '▼' : '▶'} XP Ledger ({savedPurchases.length})
        </div>
        {expandedSections.ledger && (
          <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
            {savedPurchases.length === 0 ? (
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', padding: 'var(--space-sm)' }}>No purchases yet.</p>
            ) : savedPurchases.map(p => (
              <div key={p.id} className="skill-row" style={{ justifyContent: 'space-between', fontSize: '0.85rem' }}>
                <span style={{ flex: 1 }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem', marginRight: '6px' }}>[{p.category}]</span>
                  {p.name}
                  <span style={{ color: 'var(--text-secondary)', marginLeft: '6px' }}>{p.advance_level}</span>
                </span>
                <span style={{ fontWeight: 600, marginRight: '8px' }}>{p.xp_cost} xp</span>
                <button className="btn btn--danger" style={{ padding: '1px 6px', fontSize: '0.65rem' }}
                  onClick={() => removeXpPurchase(p.id)} title="Refund">↩</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Edit Total XP Modal */}
      {editingXp && (
        <EditModal title="Edit Total XP" onClose={() => setEditingXp(false)}>
          <div className="stat-edit-form">
            <label className="stat-edit-form__label">
              Total Experience Points
              <input className="input" type="number" value={xpValue} onChange={e => setXpValue(parseInt(e.target.value) || 0)} autoFocus />
            </label>
          </div>
          <div className="modal-sheet__actions">
            <button className="btn" onClick={() => setEditingXp(false)}>Cancel</button>
            <button className="btn btn--primary" onClick={async () => { await update({ total_xp: xpValue }); setEditingXp(false); }}>Save</button>
          </div>
        </EditModal>
      )}

      {/* Add Aptitude Modal */}
      {addingAptitude && (
        <EditModal title="Add Aptitude" onClose={() => setAddingAptitude(false)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '50vh', overflowY: 'auto' }}>
            {APTITUDE_LIST.filter(a => !aptitudes.includes(a)).map(apt => (
              <button key={apt} className="btn" style={{ textAlign: 'left' }}
                onClick={async () => { await update({ aptitudes: [...aptitudes, apt] }); setAddingAptitude(false); }}>
                {apt}
              </button>
            ))}
          </div>
        </EditModal>
      )}

      {/* Add Talent Modal */}
      {addingTalent && !selectedTemplate && (
        <EditModal title="Add Talent" onClose={() => setAddingTalent(false)}>
          <input className="input" placeholder="Search talents..." value={talentSearch}
            onChange={e => setTalentSearch(e.target.value)} autoFocus style={{ marginBottom: 'var(--space-sm)' }} />
          <div style={{ maxHeight: '50vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '2px' }}>
            {filteredTemplates.slice(0, 50).map((t, i) => {
              const slots = [t.aptitude1 ? t.aptitude1.split(' or ').map(s => s.trim()) : [], t.aptitude2 ? t.aptitude2.split(' or ').map(s => s.trim()) : []].filter(s => s.length > 0);
              const matches = countMatchingAptitudes(aptitudes, slots);
              const cost = TALENT_XP_COSTS[matches][Math.max(0, Math.min(t.tier - 1, 2))];
              const prereqCheck = meetsPrerequisites(t.prerequisites);
              return (
                <button key={`${t.name}-${i}`} className="skill-row" style={{ cursor: 'pointer', textAlign: 'left', border: 'none', background: 'none', width: '100%', color: 'var(--text-primary)', opacity: prereqCheck.meets ? 1 : 0.5 }}
                  onClick={() => { setSelectedTemplate(t); setSelectedSpec(''); }}>
                  <span style={{ flex: 1 }}>
                    <strong>{t.name}</strong>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginLeft: '6px' }}>T{t.tier} — {cost} xp</span>
                    {!prereqCheck.meets && <span style={{ color: 'var(--color-danger, #ef4444)', fontSize: '0.7rem', marginLeft: '6px' }}>✖ {prereqCheck.reason}</span>}
                  </span>
                </button>
              );
            })}
          </div>
        </EditModal>
      )}

      {/* Talent Detail / Confirm Modal */}
      {addingTalent && selectedTemplate && (() => {
        const prereqCheck = meetsPrerequisites(selectedTemplate.prerequisites);
        return (
        <EditModal title={selectedTemplate.name} onClose={() => setSelectedTemplate(null)}>
          <div className="stat-edit-form">
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 'var(--space-sm)' }}>
              <strong>Tier {selectedTemplate.tier}</strong> · {selectedTemplate.aptitude1} / {selectedTemplate.aptitude2}
            </div>
            {selectedTemplate.prerequisites && (
              <div style={{ fontSize: '0.8rem', color: prereqCheck.meets ? 'var(--color-success, #22c55e)' : 'var(--color-danger, #ef4444)', marginBottom: 'var(--space-xs)' }}>
                <strong>Prerequisites:</strong> {selectedTemplate.prerequisites} {prereqCheck.meets ? '✔' : `✖ ${prereqCheck.reason || 'Not met'}`}
              </div>
            )}
            {selectedTemplate.description && (
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 'var(--space-sm)', maxHeight: '200px', overflowY: 'auto' }}>
                {selectedTemplate.description}
              </div>
            )}
            {selectedTemplate.specialisations.length > 0 && (
              <label className="stat-edit-form__label">
                Specialisation
                <select className="input" value={selectedSpec} onChange={e => setSelectedSpec(e.target.value)}>
                  <option value="">— Select —</option>
                  {selectedTemplate.specialisations.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </label>
            )}
          </div>
          <div className="modal-sheet__actions" style={{ marginTop: 'var(--space-md)' }}>
            <button className="btn" onClick={() => setSelectedTemplate(null)}>Back</button>
            <button className="btn btn--primary"
              disabled={(selectedTemplate.specialisations.length > 0 && !selectedSpec) || !prereqCheck.meets}
              onClick={() => buyTalent(selectedTemplate, selectedSpec)}>
              Purchase
            </button>
          </div>
        </EditModal>
        );
      })()}

      {/* Confirm Purchase Modal */}
      {confirmPurchase && (
        <EditModal title="Confirm Purchase" onClose={() => { setConfirmPurchase(null); setIsFree(false); setFreeReason(''); }}>
          <div style={{ textAlign: 'center', padding: 'var(--space-md) 0' }}>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{confirmPurchase.type}</div>
            <div style={{ fontSize: '1.2rem', fontWeight: 700, margin: 'var(--space-xs) 0' }}>{confirmPurchase.name}</div>
            <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>{confirmPurchase.level}</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--theme-color, #8b5cf6)', margin: 'var(--space-sm) 0' }}>
              {isFree ? '0 XP' : `${confirmPurchase.cost} XP`}
            </div>
            {!isFree && confirmPurchase.cost > xpRemaining && (
              <div style={{ fontSize: '0.8rem', color: 'var(--color-danger, #ef4444)' }}>⚠ Not enough XP remaining!</div>
            )}
            
            <div style={{ marginTop: 'var(--space-md)', textAlign: 'left', background: 'var(--bg-secondary)', padding: 'var(--space-sm)', borderRadius: 'var(--radius-md)' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', marginBottom: isFree ? '8px' : '0' }}>
                <input type="checkbox" checked={isFree} onChange={e => setIsFree(e.target.checked)} />
                <span style={{ fontSize: '0.85rem' }}>Mark as Free Advance / Grant</span>
              </label>
              {isFree && (
                <input className="input" placeholder="Reason (e.g. Starting Skill, Background)" value={freeReason} onChange={e => setFreeReason(e.target.value)} style={{ padding: '6px' }} />
              )}
            </div>
          </div>
          <div className="modal-sheet__actions">
            <button className="btn" onClick={() => { setConfirmPurchase(null); setIsFree(false); setFreeReason(''); }}>Cancel</button>
            <button className="btn btn--primary" onClick={() => { 
              setCart(prev => [...prev, {
                id: Date.now() + Math.random(),
                category: confirmPurchase.type,
                name: confirmPurchase.name,
                level: confirmPurchase.level,
                cost: confirmPurchase.cost,
                isFree,
                freeReason,
                updates: confirmPurchase.updates
              }]);
              setAddingTalent(false);
              setSelectedTemplate(null);
              setTalentSearch('');
              setConfirmPurchase(null); 
              setIsFree(false); 
              setFreeReason(''); 
            }}>
              Add to Cart
            </button>
          </div>
        </EditModal>
      )}
    </div>
  );
}
