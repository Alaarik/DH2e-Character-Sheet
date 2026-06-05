import { useState, useEffect, useMemo } from 'react';
import { CharacterFull, Armor } from '../hooks/useCharacter';

interface Props {
  character: CharacterFull;
  update: (updates: Record<string, unknown>) => Promise<void>;
}

interface ArmorTemplate {
  name: string;
  location: string;
  ap: number;
}

const LOCATIONS = ['Head', 'Left Arm', 'Body', 'Right Arm', 'Left Leg', 'Right Leg'] as const;
type Location = typeof LOCATIONS[number];

export default function ArmorTab({ character, update }: Props) {
  const [templates, setTemplates] = useState<ArmorTemplate[]>([]);

  useEffect(() => {
    fetch('/api/armor/templates', { credentials: 'include' })
      .then(res => res.json())
      .then(data => setTemplates(Array.isArray(data) ? data : []))
      .catch(err => console.error('Failed to load armor templates', err));
  }, []);

  // Calculate Toughness Bonus
  const tStat = character.characteristics.find(c => c.abbrev === 'T');
  const tb = tStat ? Math.floor(tStat.total / 10) + tStat.unnatural : 0;

  const equipped = useMemo(() => {
    const map = new Map<Location, Armor>();
    if (character.armor) {
      character.armor.forEach(a => {
        if (a.location && a.location !== 'Unequipped') {
          map.set(a.location as Location, a);
        }
      });
    }
    return map;
  }, [character.armor]);

  const handleSelectArmor = async (loc: Location, armorIdStr: string) => {
    let newArmorList = character.armor ? [...character.armor] : [];
    
    // First, unequip whatever is currently in this slot
    const existingIndex = newArmorList.findIndex(a => a.location === loc);
    if (existingIndex >= 0) {
      newArmorList[existingIndex] = { ...newArmorList[existingIndex], location: 'Unequipped' };
    }

    if (armorIdStr !== '') {
      const targetId = parseInt(armorIdStr);
      const targetIndex = newArmorList.findIndex(a => a.id === targetId);
      if (targetIndex >= 0) {
        const selectedArmor = newArmorList[targetIndex];
        const tmpl = templates.find(t => t.name === selectedArmor.name);

        let applyToAll = false;
        let coveredLocations: Location[] = [loc];

        if (tmpl) {
          const locString = (tmpl.location || '').toLowerCase();
          const isMultiple = locString.includes('all') || locString.includes(',') || locString.includes('arms') || locString.includes('legs');
          
          if (isMultiple) {
            applyToAll = window.confirm('Would you like to deploy this armor to all its possible locations?');
            if (applyToAll) {
              coveredLocations = LOCATIONS.filter(l => {
                if (locString === 'all') return true;
                if (l === 'Head' && locString.includes('head')) return true;
                if (l === 'Body' && locString.includes('body')) return true;
                if ((l === 'Left Arm' || l === 'Right Arm') && (locString.includes('arms') || locString.includes('arm'))) return true;
                if ((l === 'Left Leg' || l === 'Right Leg') && (locString.includes('legs') || locString.includes('leg'))) return true;
                return false;
              });
            }
          }
        }

        if (applyToAll) {
          // Unassign any existing armor in the covered locations
          newArmorList = newArmorList.map(a => 
            (a.location && coveredLocations.includes(a.location as Location) && a.id !== selectedArmor.id)
              ? { ...a, location: 'Unequipped' } 
              : a
          );
          
          // Assign the selected armor to the primary location
          newArmorList[targetIndex] = { ...selectedArmor, location: coveredLocations[0] };

          // Clone it for the remaining locations
          for (let i = 1; i < coveredLocations.length; i++) {
            newArmorList.push({
              id: Date.now() + i, // Temp ID
              name: selectedArmor.name,
              ap: selectedArmor.ap,
              location: coveredLocations[i],
              quality: selectedArmor.quality,
              mods: []
            });
          }
        } else {
          newArmorList[targetIndex] = { ...selectedArmor, location: loc };
        }
      }
    }

    try {
      await update({ armor: newArmorList });
    } catch (err) {
      console.error('Failed to save armor', err);
    }
  };

  const handleRemoveArmorMod = async (armorId: number, modIndex: number) => {
    let newArmorList = character.armor ? [...character.armor] : [];
    const idx = newArmorList.findIndex(a => a.id === armorId);
    if (idx >= 0) {
      newArmorList[idx].mods = newArmorList[idx].mods?.filter((_, i) => i !== modIndex) || [];
      await update({ armor: newArmorList });
    }
  };

  const handleAddArmorMod = async (armorId: number, itemId: number) => {
    const item = character.inventory?.find(i => i.id === itemId);
    if (!item) return;

    // Get quality-specific effect based on the armor's quality
    const armor = character.armor?.find(a => a.id === armorId);
    const armorQuality = (armor?.quality || 'Common').toLowerCase() as 'poor' | 'common' | 'good' | 'best';
    const effect = item.effects?.[armorQuality] || item.effects?.common || item.description || undefined;

    let newArmorList = character.armor ? [...character.armor] : [];
    
    // Remove from other armors
    newArmorList = newArmorList.map(a => {
      if (a.id === armorId) return a;
      return {
        ...a,
        mods: (a.mods || []).filter(m => m.inventoryItemId !== itemId)
      };
    });

    const idx = newArmorList.findIndex(a => a.id === armorId);
    if (idx >= 0) {
      newArmorList[idx].mods = [...(newArmorList[idx].mods || []), { inventoryItemId: item.id, name: item.name, effect }];
      await update({ armor: newArmorList });
    }
  };

  const renderSlot = (loc: Location, areaName: string) => {
    const eq = equipped.get(loc);
    const apValue = (eq?.ap || 0) + tb;
    
    // Available armors: either currently unequipped or equipped in THIS exact slot
    const available = character.armor ? character.armor.filter(a => a.location === 'Unequipped' || a.location === loc || !a.location) : [];

    return (
      <div className="armor-slot glass-card" style={{ gridArea: areaName, display: 'flex', flexDirection: 'column', gap: '8px', padding: '12px', textAlign: 'center' }}>
        <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', fontWeight: 600 }}>{loc}</div>
        <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--theme-color, var(--color-accent))' }}>{apValue} <span style={{fontSize: '0.8rem', fontWeight: 'normal', color: 'var(--text-secondary)'}}>AP</span></div>
        <select 
          className="input" 
          style={{ padding: '6px', fontSize: '0.8rem', width: '100%' }}
          value={eq?.id?.toString() || ''} 
          onChange={e => handleSelectArmor(loc, e.target.value)}
        >
          <option value="">None</option>
          {available.map(a => (
            <option key={a.id} value={a.id}>{a.quality && a.quality !== 'Common' ? `[${a.quality}] ` : ''}{a.name} (+{a.ap})</option>
          ))}
        </select>
        
        {eq && (
          <div style={{ marginTop: '2px', borderTop: '1px solid var(--border-color)', paddingTop: '4px' }}>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Armor Mods</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {eq.mods?.map((m, i) => (
                <div key={i} style={{ fontSize: '0.65rem', background: 'rgba(251,191,36,0.12)', color: '#fbbf24', padding: '4px 6px', borderRadius: 8, border: '1px solid rgba(251,191,36,0.25)', textAlign: 'left' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <strong>{m.name}</strong>
                    <button type="button" onClick={() => handleRemoveArmorMod(eq.id, i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: '0 2px', fontSize: '0.8rem', lineHeight: 1 }}>×</button>
                  </div>
                  {m.effect && (
                    <div style={{ marginTop: '2px', color: 'var(--text-secondary)', fontSize: '0.6rem', lineHeight: 1.3 }}>
                      {m.effect.length > 120 ? m.effect.slice(0, 120) + '…' : m.effect}
                    </div>
                  )}
                </div>
              ))}
            </div>
            <select className="input" style={{ fontSize: '0.7rem', padding: '4px 2px', marginTop: '4px', width: '100%' }} value="" onChange={e => handleAddArmorMod(eq.id, Number(e.target.value))}>
              <option value="">+ Add Mod...</option>
              {character.inventory?.filter(i => i.category === 'Armor Mod').map(i => {
                const attachedArmor = character.armor?.find(a => a.id !== eq.id && a.mods?.some(m => m.inventoryItemId === i.id));
                const attachedText = attachedArmor ? ` (${attachedArmor.name})` : '';
                return <option key={i.id} value={i.id}>{i.name}{i.quality && i.quality !== 'Common' ? ` [${i.quality}]` : ''}{attachedText}</option>;
              })}
            </select>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="armor-tab">
      <div style={{ marginBottom: 'var(--space-md)', textAlign: 'center', color: 'var(--text-secondary)', padding: 'var(--space-sm)', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)' }}>
        Toughness Bonus (TB): <strong style={{color: 'var(--text-primary)', fontSize: '1.2rem'}}>{tb}</strong>
      </div>
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr)', 
        gridTemplateRows: 'auto auto auto',
        gap: 'var(--space-sm)',
        gridTemplateAreas: `
          ". head ."
          "larm body rarm"
          "lleg . rleg"
        `
      }}>
        {renderSlot('Head', 'head')}
        {renderSlot('Left Arm', 'larm')}
        {renderSlot('Body', 'body')}
        {renderSlot('Right Arm', 'rarm')}
        {renderSlot('Left Leg', 'lleg')}
        {renderSlot('Right Leg', 'rleg')}
      </div>
    </div>
  );
}
