import { useState, useRef, useEffect } from 'react';
import { CharacterFull, Cybernetic, AppliedBonuses } from '../hooks/useCharacter';
import EditModal from './EditModal';
import { CYBERNETICS_DATA, CYBERNETICS_BY_NAME, IMPL_LOC } from '../data/cybernetics';

interface Props {
  character: CharacterFull;
  update: (updates: Record<string, unknown>) => Promise<void>;
}

export default function FeaturesTab({ character, update }: Props) {
  const [talentTemplates, setTalentTemplates] = useState<any[]>([]);

  useEffect(() => {
    fetch('/api/talents/templates', { credentials: 'include' })
      .then(r => r.ok ? r.json() : [])
      .then(setTalentTemplates)
      .catch(() => {});
  }, []);

  const [expandedTraits, setExpandedTraits] = useState<Set<number>>(new Set());
  const [expandedDivinations, setExpandedDivinations] = useState<Set<number>>(new Set());
  const [expandedTalents, setExpandedTalents] = useState<Set<number>>(new Set());
  const [expandedAbilities, setExpandedAbilities] = useState<Set<number>>(new Set());
  const [expandedCyberIds, setExpandedCyberIds] = useState<Set<number>>(new Set());
  const [editingCyber, setEditingCyber] = useState<Partial<Cybernetic> | null>(null);
  const [savingCyber, setSavingCyber] = useState(false);
  const [cyberSearch, setCyberSearch] = useState('');
  const [cyberDropdownOpen, setCyberDropdownOpen] = useState(false);
  const cyberSearchRef = useRef<HTMLInputElement>(null);

  const CYBER_LOCATIONS = ['Head', 'Torso', 'Left Arm', 'Right Arm', 'Left Leg', 'Right Leg', 'Neural', 'Other'];
  const CYBER_CRAFTSMANSHIP: Cybernetic['craftsmanship'][] = ['Poor', 'Common', 'Good', 'Best'];
  const CYBER_CRAFT_COLOR: Record<string, string> = {
    Poor: 'rgba(239,68,68,0.18)', Common: 'rgba(255,255,255,0.08)',
    Good: 'rgba(34,197,94,0.15)', Best: 'rgba(168,85,247,0.2)',
  };
  const CYBER_CRAFT_TEXT: Record<string, string> = {
    Poor: '#ef4444', Common: 'var(--text-secondary)', Good: '#22c55e', Best: '#a855f7',
  };
  const CYBER_LOC_ICON: Record<string, string> = {
    Head: '◉', Torso: '▣', 'Left Arm': '◁', 'Right Arm': '▷',
    'Left Leg': '◿', 'Right Leg': '◺', Neural: '⌬', Other: '◈',
  };

  // Filtered autocomplete list
  const cyberMatches = CYBERNETICS_DATA.filter(t =>
    t.name.toLowerCase().includes(cyberSearch.toLowerCase())
  ).slice(0, 10);

  const selectCyberTemplate = (name: string) => {
    const tmpl = CYBERNETICS_BY_NAME.get(name);
    const craft = (editingCyber?.craftsmanship || 'Common') as Cybernetic['craftsmanship'];
    const bonusEffect = tmpl?.craftsmanship[craft!];
    setEditingCyber(prev => ({
      ...prev,
      name,
      location: prev?.location || tmpl?.defaultLocation || null,
      description: prev?.description || bonusEffect?.description || null,
    }));
    setCyberSearch(name);
    setCyberDropdownOpen(false);
  };

  /** Compute what bonuses the currently selected template+craftsmanship would apply */
  const getPreviewBonuses = () => {
    if (!editingCyber?.name) return null;
    const tmpl = CYBERNETICS_BY_NAME.get(editingCyber.name);
    if (!tmpl) return null;
    const craft = editingCyber.craftsmanship || 'Common';
    return tmpl.craftsmanship[craft] ?? null;
  };

  const applyAndSaveCyber = async () => {
    if (!editingCyber || !editingCyber.name?.trim()) return;
    setSavingCyber(true);

    const cyberneticId = editingCyber.id ?? Date.now();
    const source = `cyber:${cyberneticId}`;
    const template = CYBERNETICS_BY_NAME.get(editingCyber.name.trim());
    const craft = (editingCyber.craftsmanship || 'Common') as Cybernetic['craftsmanship'];
    const bonusEffect = template?.craftsmanship[craft!] ?? null;

    // --- Start from current character state ---
    let newChars = character.characteristics.map(c => ({ ...c }));
    let newTalents = character.talents.map(t => ({ ...t }));
    let newArmor = character.armor.map(a => ({ ...a }));

    // --- Reverse old bonuses if editing an existing cybernetic ---
    const oldCyber = editingCyber.id != null
      ? (character.cybernetics || []).find(c => c.id === editingCyber.id)
      : null;

    if (oldCyber?.appliedBonuses) {
      const ob = oldCyber.appliedBonuses;
      if (ob.unnatural) {
        for (const [abbrev, delta] of Object.entries(ob.unnatural)) {
          newChars = newChars.map(c =>
            c.abbrev === abbrev ? { ...c, unnatural: Math.max(0, (c.unnatural || 0) - delta) } : c
          );
        }
      }
      if (ob.talentSource) {
        newTalents = newTalents.filter(t => t.source !== ob.talentSource);
      }
      if (ob.armorIds) {
        newArmor = newArmor.filter(a => !ob.armorIds!.includes(a.id));
      }
    }

    // --- Apply new bonuses ---
    const appliedBonuses: AppliedBonuses = {};

    if (bonusEffect) {
      if (bonusEffect.unnatural) {
        appliedBonuses.unnatural = {};
        for (const [abbrev, delta] of Object.entries(bonusEffect.unnatural)) {
          newChars = newChars.map(c =>
            c.abbrev === abbrev ? { ...c, unnatural: (c.unnatural || 0) + (delta || 0) } : c
          );
          appliedBonuses.unnatural[abbrev] = delta || 0;
        }
      }

      if (bonusEffect.talents?.length) {
        appliedBonuses.talentSource = source;
        const newTalentEntries = bonusEffect.talents.map((name, i) => ({
          id: cyberneticId * 100 + i + 1,
          name,
          specialisation: null as null,
          tier: 1 as const,
          description: null as null,
          prerequisites: null as null,
          source,
        }));
        newTalents = [...newTalents, ...newTalentEntries];
      }

      if (bonusEffect.armor?.length) {
        const armorIds: number[] = [];
        bonusEffect.armor.forEach((entry, i) => {
          let loc = entry.location === IMPL_LOC ? (editingCyber.location || '') : entry.location;
          if (!loc || loc === IMPL_LOC) return;
          const id = cyberneticId * 100 + 50 + i;
          armorIds.push(id);
          newArmor.push({ id, name: `⌬ ${editingCyber.name!.trim()}`, location: loc, ap: entry.ap, mods: [] });
        });
        if (armorIds.length) appliedBonuses.armorIds = armorIds;
      }
    }

    // --- Build new cybernetics list ---
    const existingCyber = character.cybernetics || [];
    const newCybernetic: Cybernetic = {
      ...(editingCyber as Cybernetic),
      id: cyberneticId,
      name: editingCyber.name!.trim(),
      appliedBonuses,
    };
    
    // Check for custom armor fields added on the fly
    if ((editingCyber as any).armorName && (editingCyber as any).armorLocation && (editingCyber as any).armorAp) {
        const newArmorItem = { id: Date.now(), name: (editingCyber as any).armorName, location: (editingCyber as any).armorLocation, ap: (editingCyber as any).armorAp, mods: [] };
        newArmor = [...newArmor, newArmorItem as any];
    }

    const newCyber = editingCyber.id != null
      ? existingCyber.map(c => c.id === editingCyber.id ? newCybernetic : c)
      : [...existingCyber, newCybernetic];

    await update({
      characteristics: newChars,
      talents: newTalents,
      armor: newArmor,
      cybernetics: newCyber,
    });

    setSavingCyber(false);
    setEditingCyber(null);
    setCyberSearch('');
  };

  const handleCyberDelete = async () => {
    if (editingCyber?.id == null) return;
    setSavingCyber(true);

    const oldCyber = (character.cybernetics || []).find(c => c.id === editingCyber.id);
    let newChars = character.characteristics.map(c => ({ ...c }));
    let newTalents = character.talents.map(t => ({ ...t }));
    let newArmor = character.armor.map(a => ({ ...a }));

    if (oldCyber?.appliedBonuses) {
      const ob = oldCyber.appliedBonuses;
      if (ob.unnatural) {
        for (const [abbrev, delta] of Object.entries(ob.unnatural)) {
          newChars = newChars.map(c =>
            c.abbrev === abbrev ? { ...c, unnatural: Math.max(0, (c.unnatural || 0) - delta) } : c
          );
        }
      }
      if (ob.talentSource) newTalents = newTalents.filter(t => t.source !== ob.talentSource);
      if (ob.armorIds) newArmor = newArmor.filter(a => !ob.armorIds!.includes(a.id));
    }

    const newCyber = (character.cybernetics || []).filter(c => c.id !== editingCyber.id);
    await update({ characteristics: newChars, talents: newTalents, armor: newArmor, cybernetics: newCyber });
    setSavingCyber(false);
    setEditingCyber(null);
    setCyberSearch('');
  };

  // Separate traits into actual traits, abilities, and divinations
  const traits = (character.traits || []).filter((t: any) => t.type !== 'ability' && t.type !== 'divination');
  const abilities = (character.traits || []).filter((t: any) => t.type === 'ability');
  const divinations = (character.traits || []).filter((t: any) => t.type === 'divination');
  const talents = (character.talents || []).filter(t => !t.source?.startsWith('cyber:'));

  const toggleTrait = (idx: number) => { setExpandedTraits(prev => { const next = new Set(prev); next.has(idx) ? next.delete(idx) : next.add(idx); return next; }); };
  const toggleDivination = (idx: number) => { setExpandedDivinations(prev => { const next = new Set(prev); next.has(idx) ? next.delete(idx) : next.add(idx); return next; }); };
  const toggleTalent = (idx: number) => { setExpandedTalents(prev => { const next = new Set(prev); next.has(idx) ? next.delete(idx) : next.add(idx); return next; }); };
  const toggleAbility = (idx: number) => { setExpandedAbilities(prev => { const next = new Set(prev); next.has(idx) ? next.delete(idx) : next.add(idx); return next; }); };
  const toggleCyber = (id: number) => { setExpandedCyberIds(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; }); };


  // Group talents by tier
  const talentsByTier: Record<number, typeof talents> = { 1: [], 2: [], 3: [] };
  for (const t of talents) {
    const tier = t.tier || 1;
    if (!talentsByTier[tier]) talentsByTier[tier] = [];
    talentsByTier[tier].push(t);
  }
  for (const tier of Object.keys(talentsByTier)) {
    talentsByTier[Number(tier)].sort((a, b) => a.name.localeCompare(b.name));
  }

  const tierLabels: Record<number, string> = { 1: 'Tier 1', 2: 'Tier 2', 3: 'Tier 3' };
  const tierColors: Record<number, string> = {
    1: 'rgba(34, 197, 94, 0.15)',
    2: 'rgba(59, 130, 246, 0.15)',
    3: 'rgba(168, 85, 247, 0.15)'
  };

  const sectionStyle = {
    marginBottom: 'var(--space-lg)',
  };

  const headerStyle = {
    display: 'flex' as const,
    alignItems: 'center' as const,
    gap: 8,
    marginBottom: 'var(--space-sm)',
    fontSize: '0.9rem',
    fontWeight: 700 as const,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.04em',
    color: 'var(--text-primary)',
  };

  const cardStyle = (expanded: boolean) => ({
    padding: '8px 12px',
    borderRadius: 'var(--radius-md, 8px)',
    border: '1px solid var(--border-color)',
    background: expanded ? 'var(--bg-tertiary, rgba(255,255,255,0.04))' : 'var(--bg-card, rgba(255,255,255,0.02))',
    cursor: 'pointer',
    transition: 'background 0.15s, border-color 0.15s',
    marginBottom: 4,
  });

  const countBadge = (count: number) => (
    <span style={{
      fontSize: '0.7rem', padding: '1px 6px', borderRadius: 10,
      background: 'var(--bg-tertiary, rgba(255,255,255,0.08))',
      color: 'var(--text-secondary)',
    }}>{count}</span>
  );

  return (
    <div style={{ paddingBottom: 32 }}>

      {/* Abilities Section */}
      {abilities.length > 0 && (
        <div style={sectionStyle}>
          <div style={headerStyle}>
            <span style={{ opacity: 0.6, fontWeight: 400 }}>++++</span> Abilities {countBadge(abilities.length)}
          </div>
          {abilities.map((ability: any, idx: number) => {
            const isOpen = expandedAbilities.has(idx);
            return (
              <div key={idx} style={cardStyle(isOpen)} onClick={() => toggleAbility(idx)}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{ability.name}</div>
                  <span style={{ fontSize: '0.7rem', opacity: 0.5, transition: 'transform 0.2s', transform: isOpen ? 'rotate(180deg)' : 'none' }}>▼</span>
                </div>
                {ability.source && (
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: 2 }}>
                    {ability.source}
                  </div>
                )}
                {isOpen && ability.description && (
                  <div style={{
                    marginTop: 8, paddingTop: 8,
                    borderTop: '1px solid var(--border-color)',
                    fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.5
                  }}>
                    {ability.description}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Divinations Section */}
      {divinations.length > 0 && (
        <div style={sectionStyle}>
          <div style={headerStyle}>
            <span style={{ opacity: 0.6, fontWeight: 400 }}>++++</span> Divination <span style={{ opacity: 0.6, fontWeight: 400 }}>++++</span>
          </div>
          {divinations.map((div: any, idx: number) => {
            const isOpen = expandedDivinations.has(idx);
            return (
              <div key={idx} style={cardStyle(isOpen)} onClick={() => toggleDivination(idx)}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{div.name}</div>
                  <span style={{ fontSize: '0.7rem', opacity: 0.5, transition: 'transform 0.2s', transform: isOpen ? 'rotate(180deg)' : 'none' }}>▼</span>
                </div>
                {isOpen && div.description && (
                  <div style={{
                    marginTop: 8, paddingTop: 8,
                    borderTop: '1px solid var(--border-color)',
                    fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.5
                  }}>
                    {div.description}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Traits Section */}
      <div style={sectionStyle}>
        <div style={headerStyle}>
          <span style={{ opacity: 0.6, fontWeight: 400 }}>++++</span> Traits {countBadge(traits.length)} <span style={{ opacity: 0.6, fontWeight: 400 }}>++++</span>
        </div>
        {traits.length === 0 ? (
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', padding: '8px 0' }}>
            No traits.
          </div>
        ) : (
          traits.map((trait: any, idx: number) => {
            const isOpen = expandedTraits.has(idx);
            return (
              <div key={idx} style={cardStyle(isOpen)} onClick={() => toggleTrait(idx)}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{trait.name}</div>
                  <span style={{ fontSize: '0.7rem', opacity: 0.5, transition: 'transform 0.2s', transform: isOpen ? 'rotate(180deg)' : 'none' }}>▼</span>
                </div>
                {isOpen && trait.description && (
                  <div style={{
                    marginTop: 8, paddingTop: 8,
                    borderTop: '1px solid var(--border-color)',
                    fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.5
                  }}>
                    {trait.description}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Cybernetics Section */}
      {(() => {
        const cybernetics: Cybernetic[] = character.cybernetics || [];
        return (
          <div style={sectionStyle}>
            <div style={{ ...headerStyle, justifyContent: 'space-between' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ opacity: 0.6, fontWeight: 400 }}>++++</span>
                Cybernetics {countBadge(cybernetics.length)}
                <span style={{ opacity: 0.6, fontWeight: 400 }}>++++</span>
              </span>
              <button
                className="btn btn--primary"
                onClick={() => { setEditingCyber({ name: '', description: null, location: null, craftsmanship: 'Common' }); setCyberSearch(''); }}
                id="add-cybernetic-btn"
                style={{ fontSize: '0.75rem', padding: '3px 10px', textTransform: 'none', letterSpacing: 0 }}
              >
                + Add
              </button>
            </div>
            {cybernetics.length === 0 ? (
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', padding: '8px 0' }}>
                No cybernetic implants.
              </div>
            ) : (
              cybernetics.map(c => {
                const isOpen = expandedCyberIds.has(c.id);
                const craft = c.craftsmanship || 'Common';
                return (
                  <div key={c.id} style={cardStyle(isOpen)}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }} onClick={() => toggleCyber(c.id)}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
                        {c.location && (
                          <span style={{ opacity: 0.65, flexShrink: 0 }}>{CYBER_LOC_ICON[c.location] || '◈'}</span>
                        )}
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 600, fontSize: '0.85rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.name}</div>
                          {c.location && <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: 1 }}>{c.location}</div>}
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                        <span style={{
                          fontSize: '0.62rem', padding: '1px 6px', borderRadius: 6, fontWeight: 700,
                          background: CYBER_CRAFT_COLOR[craft], color: CYBER_CRAFT_TEXT[craft],
                        }}>{craft}</span>
                        <button
                          className="btn"
                          onClick={e => { e.stopPropagation(); setEditingCyber({ ...c }); setCyberSearch(c.name); }}
                          style={{ fontSize: '0.68rem', padding: '2px 7px' }}
                          id={`edit-cybernetic-${c.id}`}
                        >Edit</button>
                        <span style={{ fontSize: '0.7rem', opacity: 0.5, transition: 'transform 0.2s', transform: isOpen ? 'rotate(180deg)' : 'none' }}>▼</span>
                      </div>
                    </div>
                    {isOpen && (
                      <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--border-color)', fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.5, fontStyle: c.description ? 'normal' : 'italic' }}>
                        {c.description || 'No description.'}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        );
      })()}

      {/* Cybernetics Modal */}
      {editingCyber && (() => {
        const preview = getPreviewBonuses();
        const CHAR_NAMES: Record<string, string> = { WS: 'Weapon Skill', BS: 'Ballistic Skill', S: 'Strength', T: 'Toughness', AG: 'Agility', INT: 'Intelligence', PER: 'Perception', WP: 'Willpower', FEL: 'Fellowship' };
        const hasPreview = preview && (preview.unnatural || preview.talents?.length || preview.armor?.length);
        return (
          <EditModal
            title={editingCyber.id != null ? 'Edit Cybernetic' : 'Add Cybernetic'}
            onClose={() => { setEditingCyber(null); setCyberSearch(''); }}
          >
            <div className="stat-edit-form" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>

              {/* Autocomplete Name */}
              <label className="stat-edit-form__label">
                Name
                <div style={{ position: 'relative' }}>
                  <input
                    ref={cyberSearchRef}
                    className="input"
                    value={cyberSearch}
                    onChange={e => {
                      setCyberSearch(e.target.value);
                      setEditingCyber(prev => ({ ...prev, name: e.target.value }));
                      setCyberDropdownOpen(true);
                    }}
                    onFocus={() => setCyberDropdownOpen(true)}
                    onBlur={() => setTimeout(() => setCyberDropdownOpen(false), 150)}
                    placeholder="Search cybernetics…"
                    autoFocus
                    id="cybernetic-name-input"
                  />
                  {cyberDropdownOpen && cyberMatches.length > 0 && (
                    <div style={{
                      position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100,
                      background: 'var(--bg-secondary, #1a1a2e)', border: '1px solid var(--border-color)',
                      borderRadius: 'var(--radius-md, 8px)', maxHeight: 220, overflowY: 'auto',
                      boxShadow: '0 8px 24px rgba(0,0,0,0.4)', marginTop: 2,
                    }}>
                      {cyberMatches.map(tmpl => (
                        <div
                          key={tmpl.name}
                          onMouseDown={() => selectCyberTemplate(tmpl.name)}
                          style={{
                            padding: '8px 12px', cursor: 'pointer', fontSize: '0.85rem',
                            borderBottom: '1px solid var(--border-color)',
                            transition: 'background 0.1s',
                          }}
                          onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-tertiary, rgba(255,255,255,0.06))')}
                          onMouseLeave={e => (e.currentTarget.style.background = '')}
                        >
                          <div style={{ fontWeight: 600 }}>{tmpl.name}</div>
                          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: 1 }}>
                            {tmpl.availability} · {tmpl.reference}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </label>

              {/* Location */}
              <label className="stat-edit-form__label">
                Location
                <select className="input" value={editingCyber.location || ''} onChange={e => setEditingCyber({ ...editingCyber, location: e.target.value || null })} id="cybernetic-location-select">
                  <option value="">— None —</option>
                  {CYBER_LOCATIONS.map(loc => <option key={loc} value={loc}>{loc}</option>)}
                </select>
              </label>

              {/* Craftsmanship */}
              <label className="stat-edit-form__label">
                Craftsmanship
                <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                  {CYBER_CRAFTSMANSHIP.map(q => (
                    <button key={q} type="button"
                      onClick={() => {
                        const tmpl = CYBERNETICS_BY_NAME.get(editingCyber.name || '');
                        const effect = tmpl?.craftsmanship[q!];
                        setEditingCyber(prev => ({
                          ...prev,
                          craftsmanship: q,
                          description: effect?.description || prev?.description || null,
                        }));
                      }}
                      style={{
                        flex: 1, padding: '5px 0', borderRadius: 6, cursor: 'pointer', transition: 'all 0.15s', fontSize: '0.7rem', fontWeight: 700,
                        border: editingCyber.craftsmanship === q ? `2px solid ${CYBER_CRAFT_TEXT[q!]}` : '1px solid var(--border-color)',
                        background: editingCyber.craftsmanship === q ? CYBER_CRAFT_COLOR[q!] : 'var(--bg-card)',
                        color: editingCyber.craftsmanship === q ? CYBER_CRAFT_TEXT[q!] : 'var(--text-secondary)',
                      }}
                    >{q}</button>
                  ))}
                </div>
              </label>

              {/* Bonus Preview */}
              <div style={{
                padding: '8px 12px', borderRadius: 6,
                background: hasPreview ? 'rgba(139,92,246,0.1)' : 'var(--bg-card)',
                border: `1px solid ${hasPreview ? 'rgba(139,92,246,0.3)' : 'var(--border-color)'}`,
                fontSize: '0.78rem',
              }}>
                <div style={{ fontWeight: 700, marginBottom: hasPreview ? 6 : 0, color: hasPreview ? '#a78bfa' : 'var(--text-muted)', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  {hasPreview ? '⚡ Bonuses Applied on Save' : 'ℹ No auto-apply bonuses for this selection'}
                </div>
                {hasPreview && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    {preview!.unnatural && Object.entries(preview!.unnatural).map(([abbrev, val]) => (
                      <div key={abbrev} style={{ color: 'var(--text-secondary)' }}>
                        • Unnatural {CHAR_NAMES[abbrev] || abbrev} +{val}
                      </div>
                    ))}
                    {preview!.talents?.map(t => (
                      <div key={t} style={{ color: 'var(--text-secondary)' }}>• Talent: {t}</div>
                    ))}
                    {preview!.armor?.map((a, i) => {
                      const loc = a.location === IMPL_LOC ? (editingCyber.location || '[set location]') : a.location;
                      return <div key={i} style={{ color: 'var(--text-secondary)' }}>• +{a.ap} AP → {loc}</div>;
                    })}
                    {editingCyber.id != null && (
                      <div style={{ marginTop: 4, fontSize: '0.68rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                        Old bonuses will be reversed before applying new ones.
                      </div>
                    )}
                  </div>
                )}
                {preview?.description && (
                  <div style={{ marginTop: 6, color: 'var(--text-muted)', fontSize: '0.72rem', lineHeight: 1.5, borderTop: hasPreview ? '1px solid rgba(255,255,255,0.06)' : 'none', paddingTop: hasPreview ? 6 : 0 }}>
                    {preview.description}
                  </div>
                )}
              </div>

              {/* Notes */}
              <label className="stat-edit-form__label">
                Notes (optional)
                <textarea className="input" value={editingCyber.description || ''} onChange={e => setEditingCyber({ ...editingCyber, description: e.target.value || null })} placeholder="Custom notes or additional rules…" rows={3} style={{ resize: 'vertical', fontFamily: 'inherit', fontSize: '0.85rem' }} id="cybernetic-description-input" />
              </label>
            </div>

            <div className="modal-sheet__actions" style={{ marginTop: 'var(--space-md)' }}>
              {editingCyber.id != null && (
                <button className="btn btn--danger" onClick={handleCyberDelete} disabled={savingCyber} style={{ fontSize: '0.8rem', padding: '6px 10px' }} id="cybernetic-delete-btn">Delete</button>
              )}
              <div style={{ flex: 1 }} />
              <button className="btn" onClick={() => { setEditingCyber(null); setCyberSearch(''); }} disabled={savingCyber}>Cancel</button>
              <button className="btn btn--primary" onClick={applyAndSaveCyber} disabled={savingCyber || !editingCyber.name?.trim()} id="cybernetic-save-btn">
                {savingCyber ? 'Saving…' : 'Save'}
              </button>
            </div>
          </EditModal>
        );
      })()}

      {/* Talents Section */}
      <div style={sectionStyle}>
        <div style={headerStyle}>
          <span style={{ opacity: 0.6, fontWeight: 400 }}>++++</span> Talents {countBadge(talents.length)} <span style={{ opacity: 0.6, fontWeight: 400 }}>++++</span>
        </div>
        {talents.length === 0 ? (
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', padding: '8px 0' }}>
            No talents.
          </div>
        ) : (
          Object.entries(talentsByTier).map(([tier, tierTalents]) => {
            if (tierTalents.length === 0) return null;
            const tierNum = Number(tier);
            return (
              <div key={tier} style={{ marginBottom: 'var(--space-md)' }}>
                <div style={{
                  fontSize: '0.72rem', fontWeight: 600,
                  color: 'var(--text-secondary)', marginBottom: 4,
                  textTransform: 'uppercase', letterSpacing: '0.03em'
                }}>
                  {tierLabels[tierNum] || `Tier ${tier}`}
                </div>
                {tierTalents.map((talent, idx) => {
                  const globalIdx = talents.indexOf(talent);
                  const isOpen = expandedTalents.has(globalIdx);
                  return (
                    <div key={globalIdx} style={cardStyle(isOpen)} onClick={() => toggleTalent(globalIdx)}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>
                            {talent.name}
                            {talent.specialisation && ` (${talent.specialisation})`}
                          </span>
                          <span style={{
                            fontSize: '0.62rem', padding: '1px 5px', borderRadius: 6,
                            background: tierColors[tierNum] || 'rgba(255,255,255,0.08)',
                            fontWeight: 600
                          }}>T{tier}</span>
                        </div>
                        <span style={{ fontSize: '0.7rem', opacity: 0.5, transition: 'transform 0.2s', transform: isOpen ? 'rotate(180deg)' : 'none' }}>▼</span>
                      </div>
                      {isOpen && (
                        <div style={{
                          marginTop: 8, paddingTop: 8,
                          borderTop: '1px solid var(--border-color)',
                          fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.5
                        }}>
                          {talent.description || talentTemplates.find(t => t.name === talent.name)?.description || <span style={{ fontStyle: 'italic', opacity: 0.6 }}>No description available.</span>}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
