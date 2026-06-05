import { useState } from 'react';
import { Skill, Characteristic } from '../hooks/useCharacter';
import EditModal from './EditModal';

interface Props {
  skills: Skill[];
  characteristics: Characteristic[];
  onUpdateSkills: (newSkills: Skill[]) => void;
}

export const BASE_SKILLS = [
  { name: 'Acrobatics', characteristic: 'AG', category: 'General' },
  { name: 'Athletics', characteristic: 'S', category: 'General' },
  { name: 'Awareness', characteristic: 'PER', category: 'General' },
  { name: 'Charm', characteristic: 'FEL', category: 'General' },
  { name: 'Command', characteristic: 'FEL', category: 'General' },
  { name: 'Commerce', characteristic: 'INT', category: 'General' },
  { name: 'Deceive', characteristic: 'FEL', category: 'General' },
  { name: 'Dodge', characteristic: 'AG', category: 'General' },
  { name: 'Inquiry', characteristic: 'FEL', category: 'General' },
  { name: 'Interrogation', characteristic: 'WP', category: 'General' },
  { name: 'Intimidate', characteristic: 'S', category: 'General' },
  { name: 'Logic', characteristic: 'INT', category: 'General' },
  { name: 'Medicae', characteristic: 'INT', category: 'General' },
  { name: 'Navigate', characteristic: 'INT', category: 'General' },
  { name: 'Operate', characteristic: 'AG', category: 'General' },
  { name: 'Parry', characteristic: 'WS', category: 'General' },
  { name: 'Psyniscience', characteristic: 'PER', category: 'General' },
  { name: 'Scrutiny', characteristic: 'PER', category: 'General' },
  { name: 'Security', characteristic: 'INT', category: 'General' },
  { name: 'Sleight of Hand', characteristic: 'AG', category: 'General' },
  { name: 'Stealth', characteristic: 'AG', category: 'General' },
  { name: 'Survival', characteristic: 'PER', category: 'General' },
  { name: 'Tech-Use', characteristic: 'INT', category: 'General' }
];

const ADVANCE_LEVELS = [
  { label: 'Untrained', type: 'none' },
  { label: 'Known (+0)', type: 'trained' },
  { label: 'Trained (+10)', type: 'plus_10' },
  { label: 'Experienced (+20)', type: 'plus_20' },
  { label: 'Veteran (+30)', type: 'plus_30' }
];

export default function SkillList({ skills, characteristics, onUpdateSkills }: Props) {
  const [editingSkill, setEditingSkill] = useState<Skill | null>(null);
  const [isNew, setIsNew] = useState(false);

  // Merge base skills with user skills
  const mergedSkills: Skill[] = [];
  
  // Add base skills, replacing with user's DB version if it exists
  for (const base of BASE_SKILLS) {
    const existing = skills.find(s => s.name === base.name);
    if (existing) {
      mergedSkills.push(existing);
    } else {
      const charStat = characteristics.find(c => c.abbrev === base.characteristic)?.total || 0;
      mergedSkills.push({
        id: -Math.random(), // temp id
        name: base.name,
        characteristic: base.characteristic,
        category: base.category,
        talent: 0,
        trained: false,
        plus_10: false,
        plus_20: false,
        plus_30: false,
        total: Math.max(0, charStat - 20) // DH2e untrained is generally -20
      });
    }
  }

  // Add any user skills not in BASE_SKILLS (like specific Trades, Lores)
  for (const skill of skills) {
    if (!BASE_SKILLS.find(b => b.name === skill.name)) {
      mergedSkills.push(skill);
    }
  }

  // Group by category
  const groups: Record<string, Skill[]> = {};
  for (const skill of mergedSkills) {
    let cat = skill.category || 'General';
    
    // Migrate generic 'Lore' to specific types
    if (cat === 'Lore') {
      const lowerName = skill.name.toLowerCase();
      if (lowerName.includes('scholastic')) cat = 'Scholastic Lore';
      else if (lowerName.includes('forbidden')) cat = 'Forbidden Lore';
      else cat = 'Common Lore';
    }
    
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(skill);
  }

  // Sort within groups
  for (const cat of Object.keys(groups)) {
    groups[cat].sort((a, b) => a.name.localeCompare(b.name));
  }

  const categoryOrder = ['General', 'Common Lore', 'Scholastic Lore', 'Forbidden Lore', 'Language', 'Trade'];
  
  // Ensure the specialist categories exist so they render the "+ Add" buttons
  if (!groups['Common Lore']) groups['Common Lore'] = [];
  if (!groups['Scholastic Lore']) groups['Scholastic Lore'] = [];
  if (!groups['Forbidden Lore']) groups['Forbidden Lore'] = [];
  if (!groups['Language']) groups['Language'] = [];
  if (!groups['Trade']) groups['Trade'] = [];

  const handleEdit = (skill: Skill) => {
    setIsNew(false);
    setEditingSkill({ ...skill }); // clone for editing
  };

  const handleAddNew = (category: string) => {
    setIsNew(true);
    setEditingSkill({
      id: -Math.random(),
      name: '',
      characteristic: 'INT', // default for most Lores/Trades
      category: category,
      talent: 0,
      trained: true, // newly added skills are usually known at least
      plus_10: false,
      plus_20: false,
      plus_30: false,
      total: characteristics.find(c => c.abbrev === 'INT')?.total || 0
    });
  };

  const handleDeleteNew = () => {
    if (!editingSkill || isNew) {
      setEditingSkill(null);
      return;
    }
    // Delete existing custom skill
    const newSkills = skills.filter(s => s.id !== editingSkill.id);
    onUpdateSkills(newSkills);
    setEditingSkill(null);
  };

  const handleSave = () => {
    if (!editingSkill || !editingSkill.name.trim()) return;

    // Filter out untrained base skills before saving so we don't save 20 empty rows
    const allKnownSkills = [...skills];
    
    const existingIndex = allKnownSkills.findIndex(s => s.name === editingSkill.name || s.id === editingSkill.id);
    
    // If it's a base skill that is now completely untrained, we can optionally remove it to save DB space
    // But for simplicity, we just save/update it.
    if (existingIndex >= 0) {
      allKnownSkills[existingIndex] = editingSkill;
    } else {
      allKnownSkills.push(editingSkill);
    }

    onUpdateSkills(allKnownSkills);
    setEditingSkill(null);
  };

  const handleAdvanceChange = (type: string) => {
    if (!editingSkill) return;
    
    const baseStat = characteristics.find(c => c.abbrev === editingSkill.characteristic)?.total || 0;
    
    let trained = false, plus_10 = false, plus_20 = false, plus_30 = false;
    let bonus = -20;
    
    if (type === 'trained') { trained = true; bonus = 0; }
    if (type === 'plus_10') { trained = true; plus_10 = true; bonus = 10; }
    if (type === 'plus_20') { trained = true; plus_10 = true; plus_20 = true; bonus = 20; }
    if (type === 'plus_30') { trained = true; plus_10 = true; plus_20 = true; plus_30 = true; bonus = 30; }
    
    setEditingSkill({
      ...editingSkill,
      trained, plus_10, plus_20, plus_30,
      total: Math.max(0, baseStat + editingSkill.talent + bonus)
    });
  };

  const getCurrentAdvanceType = () => {
    if (!editingSkill) return 'none';
    if (editingSkill.plus_30) return 'plus_30';
    if (editingSkill.plus_20) return 'plus_20';
    if (editingSkill.plus_10) return 'plus_10';
    if (editingSkill.trained) return 'trained';
    return 'none';
  };

  return (
    <div className="skill-list" style={{ paddingBottom: '32px' }}>
      {categoryOrder.map(category => (
        <div key={category} style={{ marginBottom: 'var(--space-md)' }}>
          <div className="skill-category">
            {category === 'Language' ? 'Languages' : category === 'Trade' ? 'Trades' : category === 'General' ? 'General Skills' : category}
          </div>
          
          {groups[category].map(skill => (
            <div 
              key={skill.id} 
              className={`skill-row ${!skill.trained ? 'skill-row--untrained' : ''}`} 
              onClick={() => handleEdit(skill)}
            >
              <span className="skill-row__name" style={{ opacity: skill.trained ? 1 : 0.5 }}>
                {skill.name}
                {!skill.trained && ' (Untrained)'}
              </span>
              <span className="skill-row__char">{skill.characteristic}</span>
              <span className="skill-row__value" style={{ opacity: skill.trained ? 1 : 0.5 }}>{skill.total}</span>
            </div>
          ))}

        </div>
      ))}

      {/* Edit Skill Modal */}
      {editingSkill && (
        <EditModal
          title={isNew ? `New ${editingSkill.category}` : editingSkill.name}
          onClose={() => setEditingSkill(null)}
        >
          <div className="stat-edit-form">
            {isNew && (
              <label className="stat-edit-form__label">
                Skill Name
                <input
                  className="input"
                  value={editingSkill.name}
                  onChange={e => setEditingSkill({ ...editingSkill, name: e.target.value })}
                  placeholder={`e.g. Imperial Creed`}
                  autoFocus
                />
              </label>
            )}

            <div className="stat-edit-form__label">
              Advance Level
              <div style={{
                padding: 'var(--space-xs) var(--space-sm)',
                background: 'var(--bg-tertiary, var(--bg-secondary))',
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.9rem',
                fontWeight: 600,
                color: 'var(--text-primary)',
                marginTop: '4px'
              }}>
                {getCurrentAdvanceType() === 'none' ? 'Untrained' :
                 getCurrentAdvanceType() === 'trained' ? 'Known (+0)' :
                 getCurrentAdvanceType() === 'plus_10' ? 'Trained (+10)' :
                 getCurrentAdvanceType() === 'plus_20' ? 'Experienced (+20)' :
                 'Veteran (+30)'}
              </div>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                Use the Advances tab to purchase skill upgrades with XP.
              </span>
            </div>

            <label className="stat-edit-form__label">
              Manual Total Override
              <input
                className="input"
                value={editingSkill.total}
                onChange={e => setEditingSkill({ ...editingSkill, total: parseInt(e.target.value) || 0 })}
                type="number"
              />
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                Only edit this if you have a special bonus or penalty not covered by advances.
              </span>
            </label>
          </div>

          <div className="modal-sheet__actions">
            {!isNew && !BASE_SKILLS.find(b => b.name === editingSkill.name) && (
              <button className="btn btn--danger" style={{ marginRight: 'auto' }} onClick={handleDeleteNew}>Remove</button>
            )}
            <button className="btn" onClick={() => setEditingSkill(null)}>Cancel</button>
            <button className="btn btn--primary" onClick={handleSave} disabled={isNew && !editingSkill.name.trim()}>Save</button>
          </div>
        </EditModal>
      )}
    </div>
  );
}
