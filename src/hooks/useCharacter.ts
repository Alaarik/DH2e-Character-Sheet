import { useState, useEffect, useCallback } from 'react';

export interface CharacterSummary {
  id: number;
  name: string;
  portrait_url: string | null;
  theme_color: string;
  psy_rating: number | null;
  wounds: number | null;
  fate_points_current: number | null;
  fate_points_max: number | null;
  influence: number | null;
}

export interface Characteristic {
  abbrev: string;
  base: number;
  modifier: number;
  talent: number;
  advances: number;
  total: number;
  unnatural: number;
  bonus: number;
  temp_damage: number;
  perm_damage: number;
}

export interface Skill {
  id: number;
  name: string;
  characteristic: string;
  category: string;
  talent: number;
  trained: boolean;
  plus_10: boolean;
  plus_20: boolean;
  plus_30: boolean;
  total: number;
  advances?: number;
  modifier?: number;
  is_custom?: number;
  aptitude_1?: string | null;
  aptitude_2?: string | null;
}

export interface AttachedMod {
  inventoryItemId?: number;
  name: string;
  effect?: string;
}

export interface LoadedAmmo {
  inventoryItemId: number;
  name: string;
  active: boolean;
}

export interface Weapon {
  id: number;
  name: string;
  alias: string | null;
  display_name: string;
  category: 'Melee' | 'Ranged';
  quality?: string;
  family: string | null;
  weapon_class: string | null;
  range: string | null;
  rof: string | null;
  damage: string | null;
  type: string | null;
  pen: number | null;
  magazine: number | null;
  qualities: string | null; // JSON string
  weight: string | null;
  mods: AttachedMod[];
  ammo: LoadedAmmo[];
  image_url: string | null;
  is_equipped: boolean;
}

export interface Power {
  id: number;
  name: string;
  discipline: string | null;
  technique: string | null;
}

export interface Armor {
  id: number;
  location: 'Head' | 'Body' | 'Left Arm' | 'Right Arm' | 'Left Leg' | 'Right Leg' | 'Unequipped' | null | string;
  name: string;
  ap: number;
  quality?: string;
  mods: AttachedMod[];
}

export interface InventoryItem {
  id: number;
  name: string;
  description: string | null;
  quantity: number;
  weight: string | null;
  category: string;
  quality?: string;
  // Quality-specific effects (for Armor Mods)
  effects?: {
    poor: string | null;
    common: string | null;
    good: string | null;
    best: string | null;
  };
  usedWith?: string | null;
}

export interface Talent {
  id: number;
  name: string;
  specialisation: string | null;
  tier: 1 | 2 | 3;
  description: string | null;
  prerequisites: string | null;
  source?: string | null;
}

export interface XpPurchase {
  id: number;
  category: 'Characteristic' | 'Skill' | 'Talent' | 'Power' | 'Psy Rating';
  name: string;
  advance_level: string;
  xp_cost: number;
}

export interface AppliedBonuses {
  unnatural?: Record<string, number>;
  talentSource?: string;
  armorIds?: number[];
}

export interface Cybernetic {
  id: number;
  name: string;
  description: string | null;
  location: string | null;
  craftsmanship: 'Poor' | 'Common' | 'Good' | 'Best' | null;
  appliedBonuses?: AppliedBonuses;
}

export interface CharacterFull {
  id: number;
  discord_user_id: string;
  name: string;
  portrait_url: string | null;
  theme_color: string;
  psy_rating: number | null;
  psyker_type: string | null;
  main_discipline: string | null;
  psy_focus: number;
  wounds: number | null;
  fate_points_current: number | null;
  fate_points_max: number | null;
  fatigue: number;
  corruption: number;
  insanity_points: number;
  influence: number;
  current_focus: 'Fettered' | 'Unfettered' | 'Push';
  current_push_amount: number;
  heretic_pips: number;
  corr_khorne: number;
  corr_nurgle: number;
  corr_slaanesh: number;
  corr_tzeentch: number;
  corr_scorn: number;
  corr_test_30: boolean;
  corr_test_60: boolean;
  corr_test_90: boolean;
  insanity_tests: number[];
  characteristics: Characteristic[];
  skills: Skill[];
  weapons: Weapon[];
  powers: Power[];
  armor: Armor[];
  inventory: InventoryItem[];
  talents: Talent[];
  xp_purchases: XpPurchase[];
  total_xp: number;
  aptitudes: string[];
  traits: { name: string; description: string }[];
  cybernetics: Cybernetic[];
  elite_advances: string[];
}

export function useCharacterList() {
  const [characters, setCharacters] = useState<CharacterSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/characters', { credentials: 'include' });
      const data = await res.json();
      setCharacters(data);
    } catch (err) {
      console.error('Failed to load characters:', err);
    }
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  return { characters, loading, refresh };
}

export function useCharacter(id: number | null) {
  const [character, setCharacter] = useState<CharacterFull | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (charId: number) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/characters/${charId}`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setCharacter(data);
      }
    } catch (err) {
      console.error('Failed to load character:', err);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (id !== null) load(id);
  }, [id, load]);

  const update = useCallback(async (updates: Record<string, unknown>) => {
    if (!character) return;
    try {
      const res = await fetch(`/api/characters/${character.id}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (res.ok) {
        // Reload full data
        await load(character.id);
      }
    } catch (err) {
      console.error('Failed to update character:', err);
    }
  }, [character, load]);

  return { character, loading, update, reload: () => character && load(character.id) };
}
