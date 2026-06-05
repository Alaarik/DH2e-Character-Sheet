import { useState, useEffect } from 'react';
import { useCharacter, Characteristic, Weapon } from '../hooks/useCharacter';
import TabBar from '../components/TabBar';
import StatGrid from '../components/StatGrid';
import SkillList from '../components/SkillList';
import WeaponCard from '../components/WeaponCard';
import PowerCard from '../components/PowerCard';
import PowersTab from '../components/PowersTab';
import EditModal from '../components/EditModal';
import ArmorTab from '../components/ArmorTab';
import InventoryTab from '../components/InventoryTab';
import AdvancementTab from '../components/AdvancementTab';
import FeaturesTab from '../components/FeaturesTab';


type Tab = 'stats' | 'skills' | 'combat' | 'armor' | 'features' | 'powers' | 'inventory' | 'advancement';

const CHAR_FULL_NAMES: Record<string, string> = {
  WS: 'Weapon Skill', BS: 'Ballistic Skill', S: 'Strength', T: 'Toughness',
  AG: 'Agility', INT: 'Intelligence', PER: 'Perception', WP: 'Willpower', FEL: 'Fellowship'
};

const ADVANCE_OPTIONS = [
  { label: 'None', value: 0 },
  { label: 'Simple (+5)', value: 5 },
  { label: 'Intermediate (+10)', value: 10 },
  { label: 'Trained (+15)', value: 15 },
  { label: 'Expert (+20)', value: 20 },
];

function getGodRank(points: number): string {
  if (points >= 40) return 'Marked';
  if (points >= 20) return 'Devoted';
  if (points >= 10) return 'Aligned';
  return '';
}

interface ToastAPI {
  success: (msg: string) => void;
  error: (msg: string) => void;
  info: (msg: string) => void;
}

interface Props {
  characterId: number;
  onBack: () => void;
  toast: ToastAPI;
}

export default function CharacterSheet({ characterId, onBack, toast }: Props) {
  const { character, loading, update } = useCharacter(characterId);
  const [activeTab, setActiveTab] = useState<Tab>('stats');
  const [editField, setEditField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [editingStat, setEditingStat] = useState<{ abbrev: string; base: number; modifier: number; talent: number; advances: number; unnatural: number; temp_damage: number; perm_damage: number } | null>(null);
  const [showDelete, setShowDelete] = useState(false);
  const [editingWeapon, setEditingWeapon] = useState<Partial<Weapon> | null>(null);
  const [editingFate, setEditingFate] = useState<{ current: number; max: number } | null>(null);
  const [equippingWeaponCategory, setEquippingWeaponCategory] = useState<'Melee' | 'Ranged' | null>(null);
  const [editingCorruption, setEditingCorruption] = useState(false);
  const [corrState, setCorrState] = useState({
    base: 0, pips: 0, khorne: 0, nurgle: 0, slaanesh: 0, tzeentch: 0, scorn: 0, test30: false, test60: false, test90: false
  });
  const [editingInsanity, setEditingInsanity] = useState(false);
  const [insanityState, setInsanityState] = useState<{ base: number, tests: number[] }>({ base: 0, tests: [] });

  // Fetch weapon templates
  // Removed fetchWeaponTemplates because weapons are now added via Gear tab

  useEffect(() => {
  }, []);



  const handleSaveField = async () => {
    if (!editField) return;

    const numericFields = ['wounds', 'fate_points_current', 'fate_points_max', 'fatigue', 'corruption', 'insanity_points', 'psy_rating', 'psy_focus', 'influence'];
    let value = numericFields.includes(editField) ? parseInt(editValue) || 0 : editValue;

    if (editField === 'corruption' && character) {
      let currentVal = value as number;
      let pips = character.heretic_pips || 0;
      const oldVal = character.corruption || 0;
      
      if (Math.floor(currentVal / 30) > Math.floor(oldVal / 30) && currentVal < 100) {
        toast.info('Warning: Every 30 corruption requires a Toughness test or gain a mutation!');
      }

      if (currentVal >= 100) {
        pips += 1;
        currentVal = currentVal % 100;
        toast.error('HERETIC ASCENSION! The Ruinous Powers notice you.');
        
        try {
          await update({ corruption: currentVal, heretic_pips: pips });
          toast.success(`Updated corruption`);
        } catch {
          toast.error('Failed to save — try again.');
        }
        setEditField(null);
        setEditValue('');
        return;
      }
    }

    try {
      await update({ [editField]: value });
      toast.success(`Updated ${editField.replace(/_/g, ' ')}`);
    } catch {
      toast.error('Failed to save — try again.');
    }
    setEditField(null);
    setEditValue('');
  };

  const handleEditStat = (char: Characteristic) => {
    setEditingStat({
      abbrev: char.abbrev,
      base: char.base || char.total, // fallback for imported chars that only have total
      modifier: char.modifier || 0,
      talent: char.talent || 0,
      advances: char.advances || 0,
      unnatural: char.unnatural || 0,
      temp_damage: char.temp_damage || 0,
      perm_damage: char.perm_damage || 0,
    });
  };

  const handleSaveStat = async () => {
    if (!editingStat || !character) return;
    const { abbrev, base, modifier, talent, advances, unnatural, temp_damage, perm_damage } = editingStat;
    const total = base + modifier + talent + advances - temp_damage - perm_damage;
    const bonus = Math.floor(total / 10) + unnatural;

    const updatedChars = character.characteristics.map(c => {
      if (c.abbrev === abbrev) {
        return { ...c, base, modifier, talent, advances, total, unnatural, bonus, temp_damage, perm_damage };
      }
      return c;
    });

    try {
      await update({ characteristics: updatedChars });
      toast.success(`Updated ${CHAR_FULL_NAMES[abbrev] || abbrev}`);
    } catch {
      toast.error('Failed to save — try again.');
    }
    setEditingStat(null);
  };

  const handleSaveFate = async () => {
    if (!editingFate || !character) return;
    try {
      await update({ 
        fate_points_current: editingFate.current, 
        fate_points_max: editingFate.max 
      });
      toast.success('Updated Fate Points');
    } catch {
      toast.error('Failed to save — try again.');
    }
    setEditingFate(null);
  };

  const handleThemeChange = async (color: string) => {
    try {
      await update({ theme_color: color });
    } catch {
      toast.error('Failed to update theme.');
    }
  };

  const handleDelete = async () => {
    try {
      const res = await fetch(`/api/characters/${characterId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (res.ok) {
        toast.success(`Deleted "${character?.name}"`);
        onBack();
      } else {
        toast.error('Failed to delete character.');
      }
    } catch {
      toast.error('Network error — check your connection.');
    }
  };

  const handleSaveWeapon = async () => {
    if (!editingWeapon || !character) return;
    
    if (!editingWeapon.name || !editingWeapon.category) {
      toast.error('Name and Category are required');
      return;
    }

    const newWeapon = {
      ...editingWeapon,
      display_name: editingWeapon.display_name || editingWeapon.name
    } as Weapon;

    let updatedWeapons;
    if (editingWeapon.id) {
      updatedWeapons = character.weapons.map(w => w.id === editingWeapon.id ? newWeapon : w);
    } else {
      newWeapon.id = Date.now();
      updatedWeapons = [...character.weapons, newWeapon];
    }

    try {
      await update({ weapons: updatedWeapons });
      toast.success('Weapon saved');
      setEditingWeapon(null);
    } catch {
      toast.error('Failed to save weapon');
    }
  };

  const handleDeleteWeapon = async (weaponId: number) => {
    if (!character) return;
    const updatedWeapons = character.weapons.filter(w => w.id !== weaponId);
    try {
      await update({ weapons: updatedWeapons });
      toast.success('Weapon removed');
      setEditingWeapon(null);
    } catch {
      toast.error('Failed to remove weapon');
    }
  };

  if (loading || !character) {
    return (
      <div className="page">
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-md)' }}>
          <div className="skeleton" style={{ width: 80, height: 36, borderRadius: 'var(--radius-md)' }} />
          <div style={{ display: 'flex', gap: 'var(--space-xs)' }}>
            <div className="skeleton" style={{ width: 36, height: 36, borderRadius: 'var(--radius-md)' }} />
            <div className="skeleton" style={{ width: 36, height: 36, borderRadius: 'var(--radius-md)' }} />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-md)', marginBottom: 'var(--space-lg)', alignItems: 'center' }}>
          <div className="skeleton" style={{ width: 64, height: 64, borderRadius: '50%', flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div className="skeleton skeleton--title" />
            <div className="skeleton skeleton--text" style={{ width: '40%' }} />
          </div>
        </div>
        <div className="stat-grid">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="skeleton skeleton--stat" />
          ))}
        </div>
      </div>
    );
  }

  const hasPowers = (character.psy_rating && character.psy_rating > 0) || character.powers.length > 0;

  return (
    <>
      <div className="ambient-glow" />
      <div className="page" style={{ position: 'relative', zIndex: 1 }}>
        {/* Actions */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 'var(--space-md)' }}>
          <button className="btn btn--danger" onClick={() => setShowDelete(true)} id="delete-btn" title="Delete character" style={{ fontSize: '1.2rem', padding: '4px 12px' }}>✖</button>
        </div>

        {/* Character Header */}
        <div className="char-header">
          {character.portrait_url ? (
            <img src={character.portrait_url} alt={character.name} className="char-header__portrait" />
          ) : (
            <div className="char-header__portrait" style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'var(--bg-tertiary)', fontSize: '2rem'
            }}>
              ☩
            </div>
          )}
          <div>
            <h1 className="char-header__name">{character.name}</h1>
            <div className="char-header__badges">
              {character.psy_rating && character.psy_rating > 0 && (
                <span className="badge">☸ PR {character.psy_rating}</span>
              )}
              {character.psyker_type && (
                <span className="badge">{character.psyker_type}</span>
              )}
              {(character.heretic_pips || 0) > 0 && (
                <span className="badge badge--danger" style={{ background: 'var(--color-danger, #ef4444)', color: 'white' }}>
                  ✟ Heretic
                </span>
              )}
              {(character.insanity_points || 0) >= 80 ? (
                <span className="badge" style={{ background: '#7e22ce', color: 'white' }}>⛧ Deranged</span>
              ) : (character.insanity_points || 0) >= 60 ? (
                <span className="badge" style={{ background: '#9333ea', color: 'white' }}>⛧ Unhinged</span>
              ) : (character.insanity_points || 0) >= 40 ? (
                <span className="badge" style={{ background: '#a855f7', color: 'white' }}>⛧ Disturbed</span>
              ) : null}
            </div>
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === 'stats' && (
          <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <StatGrid characteristics={character.characteristics} onEdit={handleEditStat} />
            </div>
            <div className="resource-row resource-row--side">
              <div className="resource-item" onClick={() => { setEditField('wounds'); setEditValue(String(character.wounds || 0)); }}>
                <span className="resource-item__icon">♱</span>
                <div className="resource-item__info">
                  <div className="resource-item__label">Wounds</div>
                  <div className="resource-item__value">{character.wounds || 0}</div>
                </div>
              </div>

              <div className="resource-item" onClick={() => setEditingFate({ current: character.fate_points_current || 0, max: character.fate_points_max || 0 })}>
                <span className="resource-item__icon">⚜</span>
                <div className="resource-item__info">
                  <div className="resource-item__label">Fate Points</div>
                  <div className="resource-item__value">
                    {'● '.repeat(character.fate_points_current || 0)}
                    {'○ '.repeat(Math.max(0, (character.fate_points_max || 0) - (character.fate_points_current || 0)))}
                  </div>
                </div>
              </div>

              <div className="resource-item" onClick={() => { setEditField('fatigue'); setEditValue(String(character.fatigue || 0)); }}>
                <span className="resource-item__icon">▼</span>
                <div className="resource-item__info">
                  <div className="resource-item__label">Fatigue</div>
                  <div className="resource-item__value">{character.fatigue || 0}</div>
                </div>
              </div>

              <div className="resource-item" style={(character.heretic_pips || 0) > 0 ? { gridColumn: '1 / -1' } : {}} onClick={() => { 
                setCorrState({
                  base: character.corruption || 0,
                  pips: character.heretic_pips || 0,
                  khorne: character.corr_khorne || 0, 
                  nurgle: character.corr_nurgle || 0, 
                  slaanesh: character.corr_slaanesh || 0, 
                  tzeentch: character.corr_tzeentch || 0, 
                  scorn: character.corr_scorn || 0,
                  test30: !!character.corr_test_30,
                  test60: !!character.corr_test_60,
                  test90: !!character.corr_test_90
                });
                setEditingCorruption(true);
              }}>
                <span className="resource-item__icon">☠</span>
                <div className="resource-item__info" style={(character.heretic_pips || 0) > 0 ? { width: '100%' } : {}}>
                  <div className="resource-item__label">Corruption</div>
                  {(character.heretic_pips || 0) > 0 ? (
                    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: '6px', fontSize: '0.85rem', marginTop: '6px', textAlign: 'left' }}>
                      <div style={{ gridColumn: '1 / -1', color: 'var(--color-danger, #ef4444)', fontWeight: 700, borderBottom: '1px solid var(--border-color)', paddingBottom: '2px' }}>Offertory Tracks</div>
                      <div>Khorne: <strong style={{color: 'var(--text-primary)'}}>{character.corr_khorne || 0}</strong> <span style={{color: 'var(--color-danger, #ef4444)'}}>{getGodRank(character.corr_khorne || 0)}</span></div>
                      <div>Nurgle: <strong style={{color: 'var(--text-primary)'}}>{character.corr_nurgle || 0}</strong> <span style={{color: '#22c55e'}}>{getGodRank(character.corr_nurgle || 0)}</span></div>
                      <div>Slaanesh: <strong style={{color: 'var(--text-primary)'}}>{character.corr_slaanesh || 0}</strong> <span style={{color: '#d946ef'}}>{getGodRank(character.corr_slaanesh || 0)}</span></div>
                      <div>Tzeentch: <strong style={{color: 'var(--text-primary)'}}>{character.corr_tzeentch || 0}</strong> <span style={{color: '#3b82f6'}}>{getGodRank(character.corr_tzeentch || 0)}</span></div>
                      <div style={{ gridColumn: '1 / -1', color: 'var(--color-danger, #ef4444)', fontWeight: 700, borderBottom: '1px solid var(--border-color)', paddingBottom: '2px', marginTop: '4px' }}>Scorn</div>
                      <div style={{ gridColumn: '1 / -1' }}>Scorn: <strong style={{color: 'var(--text-primary)'}}>{character.corr_scorn || 0}</strong></div>
                    </div>
                  ) : (
                    <div className="resource-item__value">{character.corruption || 0}</div>
                  )}
                </div>
              </div>

              <div className="resource-item" onClick={() => { 
                setInsanityState({
                  base: character.insanity_points || 0,
                  tests: character.insanity_tests || []
                });
                setEditingInsanity(true); 
              }}>
                <span className="resource-item__icon">⛧</span>
                <div className="resource-item__info">
                  <div className="resource-item__label">Insanity</div>
                  <div className="resource-item__value">{character.insanity_points || 0}</div>
                </div>
              </div>

              <div className="resource-item" onClick={() => { setEditField('influence'); setEditValue(String(character.influence || 0)); }}>
                <span className="resource-item__icon">⚔</span>
                <div className="resource-item__info">
                  <div className="resource-item__label">Influence</div>
                  <div className="resource-item__value">{character.influence || 0}</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'skills' && (
          <SkillList 
            skills={character.skills} 
            characteristics={character.characteristics}
            onUpdateSkills={async (newSkills) => {
              try {
                await update({ skills: newSkills });
                toast.success('Skills saved');
              } catch {
                toast.error('Failed to save skills');
              }
            }}
          />
        )}

        {activeTab === 'armor' && (
          <ArmorTab character={character} update={update} />
        )}

        {activeTab === 'combat' && (
          <div className="combat-tab">
            <div style={{ display: 'flex', gap: 'var(--space-sm)', justifyContent: 'flex-end', marginBottom: 'var(--space-md)' }}>
              <button 
                className="btn btn--primary" 
                onClick={() => setEquippingWeaponCategory('Melee')}
                id="equip-melee-btn"
              >
                Equip Melee
              </button>
              <button 
                className="btn btn--primary" 
                onClick={() => setEquippingWeaponCategory('Ranged')}
                id="equip-ranged-btn"
              >
                Equip Ranged
              </button>
            </div>
            {character.weapons.filter(w => w.is_equipped).length === 0 ? (
              <div className="empty-state">
                <div className="empty-state__icon">†</div>
                <p className="empty-state__text">No weapons equipped.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
                {character.weapons.filter(w => w.is_equipped).map(w => (
                  <WeaponCard 
                    key={w.id} 
                    weapon={w} 
                    onClick={() => setEditingWeapon(w)} 
                    onToggleEquip={async () => {
                      const updatedWeapons = character.weapons.map(cw => 
                        cw.id === w.id ? { ...cw, is_equipped: !cw.is_equipped } : cw
                      );
                      await update({ weapons: updatedWeapons });
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'powers' && (
          <PowersTab character={character} update={update} />
        )}

        {activeTab === 'features' && (
          <FeaturesTab character={character} update={update} />
        )}

        {activeTab === 'inventory' && (
          <InventoryTab character={character} update={update} setEditingWeapon={setEditingWeapon} />
        )}

        {activeTab === 'advancement' && (
          <AdvancementTab character={character} update={update} />
        )}
      </div>

      <TabBar activeTab={activeTab} onTabChange={setActiveTab} hasPowers={hasPowers} />

      {/* Edit Field Modal */}
      {editField && !editField.startsWith('char_') && (
        <EditModal title={`Edit ${editField.replace(/_/g, ' ')}`} onClose={() => setEditField(null)}>
          <input
            className="input"
            value={editValue}
            onChange={e => setEditValue(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSaveField()}
            type="number"
            autoFocus
            id="edit-field-input"
          />
          <div className="modal-sheet__actions">
            <button className="btn" onClick={() => setEditField(null)}>Cancel</button>
            <button className="btn btn--primary" onClick={handleSaveField} id="edit-field-save">Save</button>
          </div>
        </EditModal>
      )}

      {/* Edit Stat Modal */}
      {editingStat && (() => {
        const statTotal = editingStat.base + editingStat.modifier + editingStat.talent + editingStat.advances - editingStat.temp_damage - editingStat.perm_damage;
        const statBonus = Math.floor(statTotal / 10) + editingStat.unnatural;
        return (
          <EditModal
            title={CHAR_FULL_NAMES[editingStat.abbrev] || editingStat.abbrev}
            onClose={() => setEditingStat(null)}
          >
            <div className="stat-edit-form">
              <label className="stat-edit-form__label">
                Base Characteristic
                <input
                  className="input"
                  value={editingStat.base}
                  onChange={e => setEditingStat({ ...editingStat, base: parseInt(e.target.value) || 0 })}
                  type="number"
                  autoFocus
                  id="edit-stat-base"
                />
              </label>

              <label className="stat-edit-form__label">
                Modifier
                <input
                  className="input"
                  value={editingStat.modifier}
                  onChange={e => setEditingStat({ ...editingStat, modifier: parseInt(e.target.value) || 0 })}
                  type="number"
                  id="edit-stat-modifier"
                  placeholder="0 (accepts ±)"
                />
              </label>

              <label className="stat-edit-form__label">
                Talent
                <input
                  className="input"
                  value={editingStat.talent}
                  onChange={e => setEditingStat({ ...editingStat, talent: parseInt(e.target.value) || 0 })}
                  type="number"
                  id="edit-stat-talent"
                />
              </label>

              <label className="stat-edit-form__label">
                Unnatural Characteristic
                <input
                  className="input"
                  value={editingStat.unnatural}
                  onChange={e => setEditingStat({ ...editingStat, unnatural: parseInt(e.target.value) || 0 })}
                  type="number"
                  id="edit-stat-unnatural"
                />
              </label>

              <label className="stat-edit-form__label">
                Temporary Damage
                <input
                  className="input"
                  value={editingStat.temp_damage}
                  onChange={e => setEditingStat({ ...editingStat, temp_damage: parseInt(e.target.value) || 0 })}
                  type="number"
                />
              </label>

              <label className="stat-edit-form__label">
                Permanent Damage
                <input
                  className="input"
                  value={editingStat.perm_damage}
                  onChange={e => setEditingStat({ ...editingStat, perm_damage: parseInt(e.target.value) || 0 })}
                  type="number"
                />
              </label>

              <div className="stat-edit-form__preview">
                <div className="stat-edit-form__preview-item">
                  <span>Total</span>
                  <strong>{statTotal}</strong>
                </div>
                <div className="stat-edit-form__preview-item">
                  <span>Bonus</span>
                  <strong>{statBonus}</strong>
                </div>
              </div>
            </div>

            <div className="modal-sheet__actions">
              <button className="btn" onClick={() => setEditingStat(null)}>Cancel</button>
              <button className="btn btn--primary" onClick={handleSaveStat} id="edit-stat-save">Save</button>
            </div>
          </EditModal>
        );
      })()}

      {/* Edit Fate Modal */}
      {editingFate && (
        <EditModal title="Edit Fate Points" onClose={() => setEditingFate(null)}>
          <div className="stat-edit-form">
            <label className="stat-edit-form__label">
              Current Fate Points
              <input
                className="input"
                value={editingFate.current}
                onChange={e => setEditingFate({ ...editingFate, current: parseInt(e.target.value) || 0 })}
                type="number"
                autoFocus
              />
            </label>
            <label className="stat-edit-form__label">
              Maximum Fate Points
              <input
                className="input"
                value={editingFate.max}
                onChange={e => setEditingFate({ ...editingFate, max: parseInt(e.target.value) || 0 })}
                type="number"
              />
            </label>
          </div>
          <div className="modal-sheet__actions">
            <button className="btn" onClick={() => setEditingFate(null)}>Cancel</button>
            <button className="btn btn--primary" onClick={handleSaveFate}>Save</button>
          </div>
        </EditModal>
      )}


      {/* Delete Confirmation */}
      {showDelete && (
        <EditModal title="Delete Character" onClose={() => setShowDelete(false)}>
          <p style={{ color: 'var(--text-secondary)' }}>
            Are you sure you want to delete <strong>{character.name}</strong>? This cannot be undone.
          </p>
          <div className="modal-sheet__actions">
            <button className="btn" onClick={() => setShowDelete(false)}>Cancel</button>
            <button className="btn btn--danger" onClick={handleDelete} id="delete-confirm">Delete Forever</button>
          </div>
        </EditModal>
      )}

      {/* Advanced Corruption Edit Modal */}
      {editingCorruption && (
        <EditModal title="Edit Corruption" onClose={() => setEditingCorruption(false)}>
          <div className="stat-edit-form">
            {corrState.pips === 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 'var(--space-sm)' }}>
                <label className="stat-edit-form__label">
                  Base Corruption
                  <input className="input" value={corrState.base} onChange={e => setCorrState({ ...corrState, base: parseInt(e.target.value) || 0 })} type="number" />
                </label>
                {corrState.base >= 30 && (
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem', cursor: 'pointer', marginTop: '4px' }}>
                    <input type="checkbox" checked={corrState.test30} onChange={e => setCorrState({...corrState, test30: e.target.checked})} style={{ width: '18px', height: '18px' }} />
                    30pt Toughness Test?
                  </label>
                )}
                {corrState.base >= 60 && (
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem', cursor: 'pointer' }}>
                    <input type="checkbox" checked={corrState.test60} onChange={e => setCorrState({...corrState, test60: e.target.checked})} style={{ width: '18px', height: '18px' }} />
                    60pt Toughness Test?
                  </label>
                )}
                {corrState.base >= 90 && (
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem', cursor: 'pointer' }}>
                    <input type="checkbox" checked={corrState.test90} onChange={e => setCorrState({...corrState, test90: e.target.checked})} style={{ width: '18px', height: '18px' }} />
                    90pt Toughness Test?
                  </label>
                )}
              </div>
            )}
            
            {corrState.pips > 0 && (
              <>
                <div style={{ marginTop: 'var(--space-sm)', marginBottom: 'var(--space-xs)', fontWeight: 600, color: 'var(--color-danger, #ef4444)' }}>Offertory Tracks</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-sm)' }}>
                  <label className="stat-edit-form__label">
                    Khorne
                    <input className="input" value={corrState.khorne} onChange={e => setCorrState({ ...corrState, khorne: parseInt(e.target.value) || 0 })} type="number" />
                  </label>
                  <label className="stat-edit-form__label">
                    Nurgle
                    <input className="input" value={corrState.nurgle} onChange={e => setCorrState({ ...corrState, nurgle: parseInt(e.target.value) || 0 })} type="number" />
                  </label>
                  <label className="stat-edit-form__label">
                    Slaanesh
                    <input className="input" value={corrState.slaanesh} onChange={e => setCorrState({ ...corrState, slaanesh: parseInt(e.target.value) || 0 })} type="number" />
                  </label>
                  <label className="stat-edit-form__label">
                    Tzeentch
                    <input className="input" value={corrState.tzeentch} onChange={e => setCorrState({ ...corrState, tzeentch: parseInt(e.target.value) || 0 })} type="number" />
                  </label>
                </div>
                
                <div style={{ marginTop: 'var(--space-md)', marginBottom: 'var(--space-xs)', fontWeight: 600, color: 'var(--color-danger, #ef4444)' }}>Scorn</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 'var(--space-sm)' }}>
                  <label className="stat-edit-form__label">
                    Scorn Track
                    <input className="input" value={corrState.scorn} onChange={e => setCorrState({ ...corrState, scorn: parseInt(e.target.value) || 0 })} type="number" />
                  </label>
                </div>
              </>
            )}
          </div>
          <div className="modal-sheet__actions" style={{ marginTop: 'var(--space-md)' }}>
            <button className="btn btn--danger" style={{ fontSize: '0.8rem', padding: '6px 10px' }} onClick={async () => {
              if (window.confirm('Are you sure you want to repent and reset all Corruption to Acolyte status?')) {
                try {
                  await update({ 
                    corruption: 0,
                    heretic_pips: 0,
                    corr_khorne: 0,
                    corr_nurgle: 0,
                    corr_slaanesh: 0,
                    corr_tzeentch: 0,
                    corr_scorn: 0
                  });
                  toast.success('Repentance accepted. The Emperor protects.');
                  setEditingCorruption(false);
                } catch (e) {
                  toast.error('The Ruinous Powers refuse to let you go.');
                }
              }
            }}>Reset to Acolyte</button>
            <div style={{ flex: 1 }}></div>
            <button className="btn" onClick={() => setEditingCorruption(false)}>Cancel</button>
            <button className="btn btn--primary" onClick={async () => {
              try {
                let newBase = corrState.base;
                let newPips = corrState.pips;
                if (newBase >= 100) {
                  newPips += 1;
                  newBase = newBase % 100;
                  toast.error('HERETIC ASCENSION!');
                } else if (Math.floor(newBase / 30) > Math.floor((character.corruption || 0) / 30)) {
                  toast.info('Warning: Every 30 corruption requires a Toughness test or gain a mutation!');
                }

                await update({ 
                  corruption: newBase,
                  heretic_pips: newPips,
                  corr_khorne: corrState.khorne,
                  corr_nurgle: corrState.nurgle,
                  corr_slaanesh: corrState.slaanesh,
                  corr_tzeentch: corrState.tzeentch,
                  corr_scorn: corrState.scorn,
                  corr_test_30: corrState.test30,
                  corr_test_60: corrState.test60,
                  corr_test_90: corrState.test90
                });
                toast.success('Corruption Tracks updated');
                setEditingCorruption(false);
              } catch (e) {
                toast.error('Failed to save Corruption Tracks');
              }
            }}>Save</button>
          </div>
        </EditModal>
      )}

      {/* Advanced Insanity Edit Modal */}
      {editingInsanity && (
        <EditModal title="Edit Insanity" onClose={() => setEditingInsanity(false)}>
          <div className="stat-edit-form">
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 'var(--space-sm)' }}>
              <label className="stat-edit-form__label">
                Insanity Points
                <input className="input" value={insanityState.base} onChange={e => setInsanityState({ ...insanityState, base: parseInt(e.target.value) || 0 })} type="number" />
              </label>

              {insanityState.base >= 10 && (
                <div style={{ marginTop: 'var(--space-sm)' }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: 'var(--space-xs)', color: 'var(--text-secondary)' }}>Willpower Tests Required</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '8px' }}>
                    {Array.from({ length: Math.floor(insanityState.base / 10) }, (_, i) => (i + 1) * 10).map(threshold => (
                      <label key={threshold} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem', cursor: 'pointer' }}>
                        <input 
                          type="checkbox" 
                          style={{ width: '18px', height: '18px' }}
                          checked={insanityState.tests.includes(threshold)} 
                          onChange={e => {
                            if (e.target.checked) setInsanityState(s => ({ ...s, tests: [...s.tests, threshold] }));
                            else setInsanityState(s => ({ ...s, tests: s.tests.filter(t => t !== threshold) }));
                          }} 
                        />
                        {threshold}pt Test?
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
          <div className="modal-sheet__actions" style={{ marginTop: 'var(--space-md)' }}>
            <button className="btn" onClick={() => setEditingInsanity(false)}>Cancel</button>
            <button className="btn btn--primary" onClick={async () => {
              try {
                if (Math.floor(insanityState.base / 10) > Math.floor((character.insanity_points || 0) / 10)) {
                  toast.info('Warning: Every 10 Insanity points requires a Willpower test!');
                }
                
                await update({ 
                  insanity_points: insanityState.base,
                  insanity_tests: insanityState.tests
                });
                toast.success('Insanity updated');
                setEditingInsanity(false);
              } catch (e) {
                toast.error('Failed to save Insanity');
              }
            }}>Save</button>
          </div>
        </EditModal>
      )}

      {/* Edit Weapon Modal */}
      {editingWeapon && (
        <EditModal 
          title={editingWeapon.id ? 'Edit Weapon' : 'Add Weapon'} 
          onClose={() => setEditingWeapon(null)}
        >
          <div className="stat-edit-form" style={{ maxHeight: '60vh', overflowY: 'auto', paddingRight: '8px' }}>
            {!editingWeapon.id && (
              <div style={{ padding: 'var(--space-md)', textAlign: 'center', color: 'var(--text-secondary)' }}>
                Please add new weapons via the Gear tab.
              </div>
            )}
            
            <label className="stat-edit-form__label">
              Name *
              <input className="input" value={editingWeapon.name || ''} onChange={e => setEditingWeapon({ ...editingWeapon, name: e.target.value })} />
            </label>
            <label className="stat-edit-form__label">
              Display Name
              <input className="input" value={editingWeapon.display_name || ''} onChange={e => setEditingWeapon({ ...editingWeapon, display_name: e.target.value })} placeholder={editingWeapon.name || ''} />
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-sm)' }}>
              <label className="stat-edit-form__label">
                Category *
                <select className="input" value={editingWeapon.category || 'Melee'} onChange={e => setEditingWeapon({ ...editingWeapon, category: e.target.value as 'Melee' | 'Ranged' })}>
                  <option value="Melee">Melee</option>
                  <option value="Ranged">Ranged</option>
                </select>
              </label>
              <label className="stat-edit-form__label">
                Quality
                <select className="input" value={editingWeapon.quality || 'Common'} onChange={e => setEditingWeapon({ ...editingWeapon, quality: e.target.value })}>
                  <option value="Poor">Poor</option>
                  <option value="Common">Common</option>
                  <option value="Good">Good</option>
                  <option value="Best">Best</option>
                </select>
              </label>
            </div>
            <label className="stat-edit-form__label">
              Image URL
              <input className="input" value={editingWeapon.image_url || ''} onChange={e => setEditingWeapon({ ...editingWeapon, image_url: e.target.value })} placeholder="https://..." />
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-sm)' }}>
              {editingWeapon.category === 'Ranged' && (
                <>
                  <label className="stat-edit-form__label">
                    Class
                    <input className="input" value={editingWeapon.weapon_class || ''} onChange={e => setEditingWeapon({ ...editingWeapon, weapon_class: e.target.value })} placeholder="Basic" />
                  </label>
                  <label className="stat-edit-form__label">
                    RoF
                    <input className="input" value={editingWeapon.rof || ''} onChange={e => setEditingWeapon({ ...editingWeapon, rof: e.target.value })} placeholder="S/3/-" />
                  </label>
                  <label className="stat-edit-form__label">
                    Magazine
                    <input className="input" type="number" value={editingWeapon.magazine ?? ''} onChange={e => setEditingWeapon({ ...editingWeapon, magazine: parseInt(e.target.value) || 0 })} placeholder="24" />
                  </label>
                </>
              )}
              
              <label className="stat-edit-form__label">
                Range
                <input className="input" value={editingWeapon.range || ''} onChange={e => setEditingWeapon({ ...editingWeapon, range: e.target.value })} placeholder={editingWeapon.category === 'Melee' ? '-' : '30m'} />
              </label>

              <label className="stat-edit-form__label">
                Damage
                <input className="input" value={editingWeapon.damage || ''} onChange={e => setEditingWeapon({ ...editingWeapon, damage: e.target.value })} placeholder="1d10+3" />
              </label>
              <label className="stat-edit-form__label">
                Type
                <input className="input" value={editingWeapon.type || ''} onChange={e => setEditingWeapon({ ...editingWeapon, type: e.target.value })} placeholder="Rending" />
              </label>
              <label className="stat-edit-form__label">
                Pen
                <input className="input" type="number" value={editingWeapon.pen ?? ''} onChange={e => setEditingWeapon({ ...editingWeapon, pen: parseInt(e.target.value) || 0 })} placeholder="0" />
              </label>
              <label className="stat-edit-form__label">
                Weight
                <input className="input" value={editingWeapon.weight || ''} onChange={e => setEditingWeapon({ ...editingWeapon, weight: e.target.value })} placeholder="3 kg" />
              </label>
            </div>
            
            <label className="stat-edit-form__label" style={{ marginTop: 'var(--space-sm)' }}>
              Special Qualities (comma-separated)
              <input 
                className="input" 
                value={(() => {
                  if (!editingWeapon.qualities) return '';
                  try {
                    let p = JSON.parse(editingWeapon.qualities);
                    while (typeof p === 'string') {
                      try { 
                        const next = JSON.parse(p); 
                        if (next === p) break;
                        p = next;
                      } catch { break; }
                    }
                    return Array.isArray(p) ? p.join(', ') : editingWeapon.qualities;
                  } catch {
                    return editingWeapon.qualities;
                  }
                })()}
                onChange={e => {
                  const val = e.target.value;
                  const arr = val.split(',').map(s => s.trim()).filter(Boolean);
                  setEditingWeapon({ ...editingWeapon, qualities: arr.length ? JSON.stringify(arr) : null });
                }} 
                placeholder="Balanced, Primitive" 
              />
            </label>

            {/* ── Weapon Mods ──────────────────────────── */}
            {editingWeapon.id && (() => {
              const weaponModItems = (character?.inventory || []).filter(i => i.category === 'Weapon Mod');
              const attachedMods: import('../hooks/useCharacter').AttachedMod[] = editingWeapon.mods || [];
              const attachedIds = new Set(attachedMods.map(m => m.inventoryItemId));
              return (
                <div style={{ marginTop: 'var(--space-md)', borderTop: '1px solid var(--border-color)', paddingTop: 'var(--space-sm)' }}>
                  <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#fbbf24', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
                    🔧 Weapon Mods
                  </div>
                  {attachedMods.length === 0 && (
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontStyle: 'italic', marginBottom: 8 }}>No mods attached.</div>
                  )}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                    {attachedMods.map((m, i) => {
                      const src = weaponModItems.find(it => it.id === m.inventoryItemId);
                      return (
                        <span key={i} style={{
                          display: 'inline-flex', alignItems: 'center', gap: 4,
                          fontSize: '0.75rem', padding: '3px 8px', borderRadius: 20,
                          background: 'rgba(251,191,36,0.12)', color: '#fbbf24',
                          border: '1px solid rgba(251,191,36,0.3)',
                        }}>
                          {m.name}
                          {src?.description && <span style={{ opacity: 0.7, fontSize: '0.65rem' }}>— {src.description}</span>}
                          <button type="button" onClick={() => {
                            const updated = attachedMods.filter((_, idx) => idx !== i);
                            setEditingWeapon({ ...editingWeapon, mods: updated });
                          }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: '0 2px', fontSize: '0.8rem', lineHeight: 1 }}>×</button>
                        </span>
                      );
                    })}
                  </div>
                  {weaponModItems.filter(i => !attachedIds.has(i.id)).length > 0 && (
                    <select className="input" style={{ fontSize: '0.8rem' }} value="" onChange={async e => {
                      const itemId = Number(e.target.value);
                      const item = weaponModItems.find(i => i.id === itemId);
                      if (!item) return;

                      let updatedWeapons = [...(character?.weapons || [])];
                      // Remove this mod from any other weapon it's attached to
                      updatedWeapons = updatedWeapons.map(w => {
                        if (w.id === editingWeapon.id) return w;
                        return {
                          ...w,
                          mods: (w.mods || []).filter(m => m.inventoryItemId !== item.id)
                        };
                      });
                      
                      // Also remove ammo if it's an ammo (wait, this is just for mods)
                      
                      // Wait, we need to update the character weapons!
                      // The current component saves `editingWeapon` locally until "Save Weapon" is clicked!
                      // If we modify other weapons, we should save immediately or defer to global save?
                      // We can just call `update({ weapons: updatedWeapons })` directly for the OTHER weapons,
                      // and update the local `editingWeapon` state for THIS weapon.
                      // Actually, if we update other weapons right now, it saves immediately.
                      // Let's do it safely: update the other weapons immediately.
                      await update({ weapons: updatedWeapons });

                      setEditingWeapon({ ...editingWeapon, mods: [...attachedMods, { inventoryItemId: item.id, name: item.name }] });
                    }}>
                      <option value="">+ Attach mod from inventory…</option>
                      {weaponModItems.filter(i => !attachedIds.has(i.id)).map(i => {
                        // Check if attached elsewhere
                        const attachedWeapon = character?.weapons?.find(w => w.id !== editingWeapon.id && w.mods?.some(m => m.inventoryItemId === i.id));
                        const attachedText = attachedWeapon ? ` (attached to ${attachedWeapon.display_name || attachedWeapon.name})` : '';
                        return (
                          <option key={i.id} value={i.id}>{i.name}{i.description ? ` — ${i.description}` : ''}{attachedText}</option>
                        );
                      })}
                    </select>
                  )}
                  {weaponModItems.length === 0 && (
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Add items with category <em>Weapon Mod</em> in the Gear tab first.</div>
                  )}
                </div>
              );
            })()}

            {/* ── Special Ammo (Ranged only) ──────────── */}
            {editingWeapon.id && editingWeapon.category === 'Ranged' && (() => {
              const ammoItems = (character?.inventory || []).filter(i => i.category === 'Ammo');
              const loadedAmmo: import('../hooks/useCharacter').LoadedAmmo[] = editingWeapon.ammo || [];
              const loadedIds = new Set(loadedAmmo.map(a => a.inventoryItemId));
              const multiLoaded = loadedAmmo.length > 1;
              const hasMultiMod = (editingWeapon.mods || []).some(m =>
                m.name.toLowerCase().includes('gyrator') || m.name.toLowerCase().includes('multi') || m.name.toLowerCase().includes('combi')
              );
              return (
                <div style={{ marginTop: 'var(--space-md)', borderTop: '1px solid var(--border-color)', paddingTop: 'var(--space-sm)' }}>
                  <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#10b981', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
                    ⚡ Special Ammo
                  </div>
                  {multiLoaded && !hasMultiMod && (
                    <div style={{ fontSize: '0.7rem', color: '#f59e0b', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 6, padding: '4px 8px', marginBottom: 8 }}>
                      ⚠ Multiple ammo types loaded — requires a multi-ammo weapon mod.
                    </div>
                  )}
                  {loadedAmmo.length === 0 && (
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontStyle: 'italic', marginBottom: 8 }}>Standard ammo (no special type loaded).</div>
                  )}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 8 }}>
                    {loadedAmmo.map((a, i) => {
                      const src = ammoItems.find(it => it.id === a.inventoryItemId);
                      return (
                        <div key={i} style={{
                          display: 'flex', alignItems: 'center', gap: 8,
                          padding: '6px 10px', borderRadius: 8,
                          background: a.active ? 'rgba(16,185,129,0.12)' : 'var(--bg-card)',
                          border: `1px solid ${a.active ? 'rgba(16,185,129,0.35)' : 'var(--border-color)'}`,
                        }}>
                          <button type="button" onClick={() => {
                            const updated = loadedAmmo.map((x, idx) => ({ ...x, active: idx === i }));
                            setEditingWeapon({ ...editingWeapon, ammo: updated });
                          }} style={{
                            width: 14, height: 14, borderRadius: '50%', border: `2px solid ${a.active ? '#10b981' : 'var(--border-color)'}`,
                            background: a.active ? '#10b981' : 'transparent', cursor: 'pointer', flexShrink: 0,
                          }} title="Set as active" />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: a.active ? '#10b981' : 'var(--text-primary)' }}>
                              {a.active && '⚡ '}{a.name}
                            </div>
                            {src?.description && <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: 1 }}>{src.description}</div>}
                          </div>
                          <button type="button" onClick={() => {
                            const updated = loadedAmmo.filter((_, idx) => idx !== i);
                            if (a.active && updated.length > 0) updated[0].active = true;
                            setEditingWeapon({ ...editingWeapon, ammo: updated });
                          }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: '0.9rem', padding: '0 2px' }}>×</button>
                        </div>
                      );
                    })}
                  </div>
                  {ammoItems.filter(i => !loadedIds.has(i.id)).length > 0 && (
                    <select className="input" style={{ fontSize: '0.8rem' }} value="" onChange={async e => {
                      const itemId = Number(e.target.value);
                      const item = ammoItems.find(i => i.id === itemId);
                      if (!item) return;

                      let updatedWeapons = [...(character?.weapons || [])];
                      // Remove this ammo from any other weapon it's loaded in
                      updatedWeapons = updatedWeapons.map(w => {
                        if (w.id === editingWeapon.id) return w;
                        return {
                          ...w,
                          ammo: (w.ammo || []).filter(a => a.inventoryItemId !== item.id)
                        };
                      });
                      await update({ weapons: updatedWeapons });

                      const isFirst = loadedAmmo.length === 0;
                      setEditingWeapon({ ...editingWeapon, ammo: [...loadedAmmo, { inventoryItemId: item.id, name: item.name, active: isFirst }] });
                    }}>
                      <option value="">+ Load ammo from inventory…</option>
                      {ammoItems.filter(i => !loadedIds.has(i.id)).map(i => {
                        const loadedWeapon = character?.weapons?.find(w => w.id !== editingWeapon.id && w.ammo?.some(a => a.inventoryItemId === i.id));
                        const loadedText = loadedWeapon ? ` (loaded in ${loadedWeapon.display_name || loadedWeapon.name})` : '';
                        return (
                          <option key={i.id} value={i.id}>{i.name}{i.description ? ` — ${i.description}` : ''}{loadedText}</option>
                        );
                      })}
                    </select>
                  )}
                  {ammoItems.length === 0 && (
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Add items with category <em>Ammo</em> in the Gear tab first.</div>
                  )}
                  {loadedAmmo.length > 0 && (
                    <button type="button" className="btn" onClick={() => setEditingWeapon({ ...editingWeapon, ammo: [] })} style={{ marginTop: 6, fontSize: '0.72rem', padding: '3px 10px' }}>
                      Unload all (standard)
                    </button>
                  )}
                </div>
              );
            })()}
          </div>
          <div className="modal-sheet__actions" style={{ marginTop: 'var(--space-md)' }}>
            {editingWeapon.id ? (
              <button className="btn btn--danger" onClick={() => handleDeleteWeapon(editingWeapon.id!)}>Delete</button>
            ) : (
              <button className="btn" onClick={() => setEditingWeapon(null)}>Cancel</button>
            )}
            <button className="btn btn--primary" style={{ flex: 1 }} onClick={handleSaveWeapon}>Save Weapon</button>
          </div>
        </EditModal>
      )}

      {/* Equip Weapon Modal */}
      {equippingWeaponCategory && (
        <EditModal 
          title={`Equip ${equippingWeaponCategory} Weapon`} 
          onClose={() => setEquippingWeaponCategory(null)}
        >
          <div style={{ maxHeight: '60vh', overflowY: 'auto', paddingRight: '8px' }}>
            {character.weapons.filter(w => w.category === equippingWeaponCategory && !w.is_equipped).length === 0 ? (
              <div className="empty-state">
                <p className="empty-state__text">No unequipped {equippingWeaponCategory} weapons in your Gear.</p>
                <p className="empty-state__text" style={{ fontSize: '0.8rem' }}>Go to the Gear tab to add one.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
                {character.weapons.filter(w => w.category === equippingWeaponCategory && !w.is_equipped).map(w => (
                  <WeaponCard 
                    key={w.id} 
                    weapon={w} 
                    onToggleEquip={async () => {
                      const updatedWeapons = character.weapons.map(cw => 
                        cw.id === w.id ? { ...cw, is_equipped: true } : cw
                      );
                      await update({ weapons: updatedWeapons });
                      setEquippingWeaponCategory(null);
                    }}
                  />
                ))}
              </div>
            )}
          </div>
          <div className="modal-sheet__actions" style={{ marginTop: 'var(--space-md)' }}>
            <button className="btn" style={{ width: '100%' }} onClick={() => setEquippingWeaponCategory(null)}>Close</button>
          </div>
        </EditModal>
      )}
    </>
  );
}
