import { useState, useEffect } from 'react';
import { CharacterFull, InventoryItem, Weapon, Armor } from '../hooks/useCharacter';
import EditModal from './EditModal';

interface Props {
  character: CharacterFull;
  update: (updates: Record<string, unknown>) => Promise<void>;
  setEditingWeapon: (w: Partial<Weapon> | null) => void;
}

const CATEGORIES = ['Gear', 'Tool', 'Consumable', 'Ammo', 'Weapon Mod', 'Armor Mod', 'Misc', 'Armor', 'Melee', 'Ranged'];

export default function InventoryTab({ character, update, setEditingWeapon }: Props) {
  const [editingItem, setEditingItem] = useState<Partial<InventoryItem> | null>(null);
  const [isNew, setIsNew] = useState(false);

  // Template fetching
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [gearTemplates, setGearTemplates] = useState<any[]>([]);
  const [weaponTemplates, setWeaponTemplates] = useState<any[]>([]);
  const [armorTemplates, setArmorTemplates] = useState<any[]>([]);
  const [selectedQuality, setSelectedQuality] = useState('Common');

  const fetchTemplates = async () => {
    setLoadingTemplates(true);
    try {
      const [gRes, wRes, aRes] = await Promise.all([
        fetch('/api/gear/templates', { credentials: 'include' }),
        fetch('/api/weapons/templates', { credentials: 'include' }),
        fetch('/api/armor/templates', { credentials: 'include' })
      ]);
      setGearTemplates(await gRes.json());
      setWeaponTemplates(await wRes.json());
      setArmorTemplates(await aRes.json());
    } catch (e) {
      console.error(e);
    }
    setLoadingTemplates(false);
  };

  useEffect(() => {
    if (showTemplateModal && gearTemplates.length === 0) {
      fetchTemplates();
    }
  }, [showTemplateModal]);

  const inventory = character.inventory || [];
  const weapons = character.weapons || [];
  const armor = character.armor || [];

  // Combine them all
  const items: any[] = [
    ...inventory.map(i => ({ ...i, _type: 'item' })),
    ...weapons.map(w => ({ ...w, _type: 'weapon' })),
    ...armor.map(a => ({ ...a, _type: 'armor' }))
  ];

  const groups: Record<string, any[]> = {};
  for (const item of items) {
    const cat = item._type === 'weapon' ? item.category : 
                item._type === 'armor' ? 'Armor' : 
                (item.category || 'Misc');
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(item);
  }

  // Calculate total weight (rough approximation for all)
  const totalWeight = items.reduce((sum, item) => {
    const w = parseFloat(item.weight || '0') || 0;
    const q = item.quantity || 1;
    return sum + w * q;
  }, 0);

  const handleAddCustom = () => {
    setIsNew(true);
    setEditingItem({ name: '', category: 'Gear', quantity: 1, weight: '', description: '', quality: 'Common' });
  };

  const handleEdit = (item: any) => {
    if (item._type === 'weapon') {
      setEditingWeapon(item);
    } else if (item._type === 'armor') {
      // For now, no edit armor modal exists, just allow delete
      if (window.confirm(`Delete ${item.name}?`)) {
        update({ armor: armor.filter(a => a.id !== item.id) });
      }
    } else {
      setIsNew(false);
      setEditingItem(item);
    }
  };

  const handleSaveItem = async () => {
    if (!editingItem || !editingItem.name?.trim()) return;

    let updated: InventoryItem[];
    if (isNew) {
      const newItem = { ...editingItem, id: Date.now() } as InventoryItem;
      updated = [...inventory, newItem];
    } else {
      updated = inventory.map(i => i.id === editingItem.id ? { ...i, ...editingItem } as InventoryItem : i);
    }

    await update({ inventory: updated });
    setEditingItem(null);
  };

  const handleDeleteItem = async () => {
    if (!editingItem?.id) return;
    const updated = inventory.filter(i => i.id !== editingItem.id);
    await update({ inventory: updated });
    setEditingItem(null);
  };

  const handleAddFromTemplate = async (template: any, type: 'gear' | 'weapon' | 'armor') => {
    if (type === 'gear') {
      // Determine the correct description based on selected quality (for Armor Mods with effects)
      let description = template.description || null;
      if (template.effects) {
        const qualityKey = selectedQuality.toLowerCase() as 'poor' | 'common' | 'good' | 'best';
        description = template.effects[qualityKey] || template.effects.common || description;
      }

      await update({
        inventory: [...inventory, {
          id: Date.now(),
          name: template.name,
          description,
          category: template.category || 'Gear',
          weight: template.weight || null,
          quantity: 1,
          quality: selectedQuality,
          effects: template.effects || undefined,
          usedWith: template.usedWith || undefined
        }]
      });
    } else if (type === 'weapon') {
      let modifiedWeapon = { ...template };
      
      const addQualityProp = (existing: any, newQ: string) => {
        let q: string[] = [];
        if (Array.isArray(existing)) q = [...existing];
        else if (typeof existing === 'string') {
          try { q = JSON.parse(existing); } catch { if (existing) q = [existing]; }
        }
        if (!q.includes(newQ)) q.push(newQ);
        return JSON.stringify(q);
      };

      if (selectedQuality === 'Poor') {
        if (modifiedWeapon.category === 'Melee') {
          modifiedWeapon.mods = [...(modifiedWeapon.mods || []), { name: 'Poor Quality: -10 to WS tests' }];
        } else {
          modifiedWeapon.qualities = addQualityProp(modifiedWeapon.qualities, 'Unreliable');
        }
      } else if (selectedQuality === 'Good') {
        if (modifiedWeapon.category === 'Melee') {
          modifiedWeapon.mods = [...(modifiedWeapon.mods || []), { name: 'Good Quality: +5 to WS tests' }];
        } else {
          modifiedWeapon.qualities = addQualityProp(modifiedWeapon.qualities, 'Reliable');
        }
      } else if (selectedQuality === 'Best') {
        if (modifiedWeapon.category === 'Melee') {
          modifiedWeapon.mods = [...(modifiedWeapon.mods || []), { name: 'Best Quality: +10 to WS tests' }];
          if (modifiedWeapon.damage) {
             modifiedWeapon.damage = `${modifiedWeapon.damage}+1`;
          }
        } else {
          modifiedWeapon.qualities = addQualityProp(modifiedWeapon.qualities, 'Never Jams');
        }
      }

      await update({
        weapons: [...weapons, {
          ...modifiedWeapon,
          id: Date.now(),
          is_equipped: false,
          quality: selectedQuality
        }]
      });
    } else if (type === 'armor') {
      let modifiedArmor = { ...template };
      let finalAp = modifiedArmor.ap || 0;
      let armorMods = modifiedArmor.mods || [];

      if (selectedQuality === 'Poor') {
        armorMods = [...armorMods, { name: 'Poor Quality: Max Agility reduced by 10' }];
      } else if (selectedQuality === 'Good') {
        armorMods = [...armorMods, { name: 'Good Quality: Weight reduced by half' }];
      } else if (selectedQuality === 'Best') {
        armorMods = [...armorMods, { name: 'Best Quality: Weight halved' }];
        finalAp += 1;
      }

      await update({
        armor: [...armor, {
          id: Date.now(),
          name: modifiedArmor.name,
          ap: finalAp,
          location: 'Unequipped',
          quality: selectedQuality,
          mods: armorMods
        }]
      });
    }
    setShowTemplateModal(false);
    setSelectedQuality('Common'); // Reset
  };

  const sortedCategories = CATEGORIES.filter(c => groups[c]);

  return (
    <div style={{ paddingBottom: '32px' }}>
      {/* Weight Summary */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: 'var(--space-sm) var(--space-md)',
        background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)',
        marginBottom: 'var(--space-md)', border: '1px solid var(--border-color)'
      }}>
        <div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Weight</div>
          <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }}>{totalWeight.toFixed(1)} kg</div>
        </div>
        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
          {items.length} item{items.length !== 1 ? 's' : ''}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 'var(--space-sm)', marginBottom: 'var(--space-md)' }}>
        <button className="btn btn--primary" style={{ flex: 1 }} onClick={() => setShowTemplateModal(true)}>
          + Add Gear
        </button>
        <button className="btn" onClick={handleAddCustom}>
          + Custom Item
        </button>
      </div>

      {/* Items by Category */}
      {sortedCategories.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state__icon">⬡</div>
          <p className="empty-state__text">No gear acquired yet.</p>
        </div>
      ) : (
        sortedCategories.map(category => (
          <div key={category} style={{ marginBottom: 'var(--space-md)' }}>
            <div className="skill-category">{category}</div>
            {groups[category].map(item => (
              <div
                key={item.id}
                className="skill-row"
                onClick={() => handleEdit(item)}
                style={{ cursor: 'pointer' }}
              >
                <span className="skill-row__name" style={{ flex: 1 }}>
                  {item.name || item.display_name}
                  {item.quality && item.quality !== 'Common' && (
                    <span style={{ marginLeft: '8px', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>[{item.quality}]</span>
                  )}
                  {item._type === 'weapon' && Boolean(item.is_equipped) && (
                    <span style={{ marginLeft: '8px', color: 'var(--theme-color)', fontSize: '0.8rem' }}>[Equipped]</span>
                  )}
                  {item._type === 'armor' && item.location !== 'Unequipped' && item.location && (
                    <span style={{ marginLeft: '8px', color: 'var(--theme-color)', fontSize: '0.8rem' }}>[{item.location}]</span>
                  )}
                  {item.description && (
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginLeft: '8px' }}>
                      — {item.description.length > 40 ? item.description.slice(0, 40) + '…' : item.description}
                    </span>
                  )}
                </span>
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginRight: '8px' }}>
                  ×{item.quantity || 1}
                </span>
                {item.weight && (
                  <span className="skill-row__value">{item.weight.toString().includes('kg') ? item.weight : `${item.weight} kg`}</span>
                )}
              </div>
            ))}
          </div>
        ))
      )}

      {/* Add from Template Modal */}
      {showTemplateModal && (
        <EditModal title="Add from Master Data Sheet" onClose={() => setShowTemplateModal(false)}>
          {loadingTemplates ? (
            <div style={{ padding: 'var(--space-lg)', textAlign: 'center' }}>Loading templates...</div>
          ) : (
            <div style={{ maxHeight: '60vh', overflowY: 'auto', paddingRight: '8px' }}>
              
              <div style={{ marginBottom: 'var(--space-md)' }}>
                <label className="stat-edit-form__label">
                  Select Quality (Applies to next added item)
                  <select
                    className="input"
                    value={selectedQuality}
                    onChange={e => setSelectedQuality(e.target.value)}
                  >
                    <option value="Poor">Poor</option>
                    <option value="Common">Common</option>
                    <option value="Good">Good</option>
                    <option value="Best">Best</option>
                  </select>
                </label>
              </div>

              <div className="skill-category" style={{ marginTop: 0 }}>Weapons</div>
              <select className="input" onChange={e => {
                const tmpl = weaponTemplates.find(t => t.name === e.target.value);
                if (tmpl) handleAddFromTemplate(tmpl, 'weapon');
              }} defaultValue="">
                <option value="" disabled>Select Weapon...</option>
                {weaponTemplates.map(t => <option key={t.name} value={t.name}>{t.name}</option>)}
              </select>

              <div className="skill-category">Armor</div>
              <select className="input" onChange={e => {
                const tmpl = armorTemplates.find(t => t.name === e.target.value);
                if (tmpl) handleAddFromTemplate(tmpl, 'armor');
              }} defaultValue="">
                <option value="" disabled>Select Armor...</option>
                {armorTemplates.map(t => <option key={t.name} value={t.name}>{t.name}</option>)}
              </select>

              <div className="skill-category">Gear (Tools, Consumables, Ammo)</div>
              <select className="input" onChange={e => {
                const tmpl = gearTemplates.find(t => t.name === e.target.value);
                if (tmpl) handleAddFromTemplate(tmpl, 'gear');
              }} defaultValue="">
                <option value="" disabled>Select Gear...</option>
                {gearTemplates.filter(t => t.category !== 'Armor Mod').map(t => <option key={t.name} value={t.name}>{t.name} ({t.category})</option>)}
              </select>

              <div className="skill-category">Armor Mods</div>
              {(() => {
                const armorModTemplates = gearTemplates.filter(t => t.category === 'Armor Mod');
                const qualityKey = selectedQuality.toLowerCase() as 'poor' | 'common' | 'good' | 'best';
                return (
                  <>
                    <select className="input" onChange={e => {
                      const tmpl = armorModTemplates.find(t => t.name === e.target.value);
                      if (tmpl) handleAddFromTemplate(tmpl, 'gear');
                      e.target.value = '';
                    }} defaultValue="">
                      <option value="" disabled>Select Armor Mod...</option>
                      {armorModTemplates.map(t => {
                        const hasEffect = t.effects?.[qualityKey];
                        return (
                          <option key={t.name} value={t.name} disabled={!hasEffect && qualityKey !== 'common'}>
                            {t.name}{t.usedWith ? ` — ${t.usedWith}` : ''}{!hasEffect && qualityKey !== 'common' ? ' (N/A at this quality)' : ''}
                          </option>
                        );
                      })}
                    </select>
                    {armorModTemplates.length > 0 && (
                      <div style={{ marginTop: '8px', fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                        Effect preview based on <strong>{selectedQuality}</strong> quality. Change quality above to see different effects.
                      </div>
                    )}
                  </>
                );
              })()}

            </div>
          )}
        </EditModal>
      )}

      {/* Edit Custom Item Modal */}
      {editingItem && (
        <EditModal title={isNew ? 'Add Custom Item' : 'Edit Item'} onClose={() => setEditingItem(null)}>
          <div className="stat-edit-form">
            <label className="stat-edit-form__label">
              Name *
              <input
                className="input"
                value={editingItem.name || ''}
                onChange={e => setEditingItem({ ...editingItem, name: e.target.value })}
                autoFocus
              />
            </label>
            <label className="stat-edit-form__label">
              Description
              <input
                className="input"
                value={editingItem.description || ''}
                onChange={e => setEditingItem({ ...editingItem, description: e.target.value })}
              />
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-sm)' }}>
              <label className="stat-edit-form__label">
                Quantity
                <input
                  className="input"
                  type="number"
                  value={editingItem.quantity || 1}
                  onChange={e => setEditingItem({ ...editingItem, quantity: parseInt(e.target.value) || 1 })}
                  min={1}
                />
              </label>
              <label className="stat-edit-form__label">
                Weight (kg)
                <input
                  className="input"
                  value={editingItem.weight || ''}
                  onChange={e => setEditingItem({ ...editingItem, weight: e.target.value })}
                />
              </label>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-sm)' }}>
              <label className="stat-edit-form__label">
                Category
                <select
                  className="input"
                  value={editingItem.category || 'Gear'}
                  onChange={e => setEditingItem({ ...editingItem, category: e.target.value })}
                >
                  {CATEGORIES.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </label>
              <label className="stat-edit-form__label">
                Quality
                <select
                  className="input"
                  value={editingItem.quality || 'Common'}
                  onChange={e => {
                    const newQuality = e.target.value;
                    const qualityKey = newQuality.toLowerCase() as 'poor' | 'common' | 'good' | 'best';
                    // Auto-update description if this is an Armor Mod with effects
                    const newDescription = editingItem.effects?.[qualityKey] || editingItem.description;
                    setEditingItem({ ...editingItem, quality: newQuality, description: newDescription || editingItem.description });
                  }}
                >
                  <option value="Poor">Poor</option>
                  <option value="Common">Common</option>
                  <option value="Good">Good</option>
                  <option value="Best">Best</option>
                </select>
              </label>
            </div>
            {/* Show quality-specific effects for Armor Mods */}
            {editingItem.effects && editingItem.category === 'Armor Mod' && (
              <div style={{ marginTop: 'var(--space-sm)', padding: 'var(--space-sm)', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: 600 }}>Effect at {editingItem.quality || 'Common'} quality:</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-primary)', lineHeight: 1.4 }}>
                  {editingItem.effects[(editingItem.quality || 'Common').toLowerCase() as 'poor' | 'common' | 'good' | 'best'] || 'No specific effect at this quality level.'}
                </div>
              </div>
            )}
          </div>
          <div className="modal-sheet__actions" style={{ marginTop: 'var(--space-md)' }}>
            {!isNew && (
              <button className="btn btn--danger" style={{ marginRight: 'auto' }} onClick={handleDeleteItem}>Delete</button>
            )}
            <button className="btn" onClick={() => setEditingItem(null)}>Cancel</button>
            <button className="btn btn--primary" onClick={handleSaveItem} disabled={!editingItem.name?.trim()}>Save</button>
          </div>
        </EditModal>
      )}
    </div>
  );
}
