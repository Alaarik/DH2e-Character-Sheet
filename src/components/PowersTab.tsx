import React, { useState, useEffect } from 'react';
import { CharacterFull } from '../hooks/useCharacter';
import PowerCard from './PowerCard';
import EditModal from './EditModal';

interface Props {
  character: CharacterFull;
  update: (updates: Record<string, unknown>) => Promise<void>;
}

export interface PowerTemplate {
  name: string;
  discipline: string;
  technique: string;
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

export default function PowersTab({ character, update }: Props) {
  const [templates, setTemplates] = useState<PowerTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  useEffect(() => {
    fetch('/api/powers/templates', { credentials: 'include' })
      .then(res => res.json())
      .then(data => {
        setTemplates(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to load power templates', err);
        setLoading(false);
      });
  }, []);



  const handleSaveField = async () => {
    if (!editingField) return;
    const isNum = ['psy_rating', 'psy_focus'].includes(editingField);
    const val = isNum ? parseInt(editValue) || 0 : editValue;
    try {
      await update({ [editingField]: val });
    } catch (e) {
      console.error(e);
    }
    setEditingField(null);
  };

  const handleFocusChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    await update({ current_focus: e.target.value as 'Fettered' | 'Unfettered' | 'Push' });
  };

  const handlePushChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    await update({ current_push_amount: parseInt(e.target.value) || 1 });
  };



  const handleDeletePower = async (id: number) => {
    if (!window.confirm('Are you sure you want to forget this power?')) return;
    const newPowers = character.powers.filter(p => p.id !== id);
    await update({ powers: newPowers });
  };

  const basePR = character.psy_rating || 0;
  let effectivePR = basePR;
  if (character.current_focus === 'Fettered') {
    effectivePR = Math.ceil(basePR / 2);
  } else if (character.current_focus === 'Push') {
    effectivePR = basePR + (character.current_push_amount || 0);
  }

  const psykerType = character.psyker_type || 'Bound';
  const maxPush = psykerType === 'Bound' ? 3 : (psykerType === 'Daemonic' ? 4 : 5);

  const mainDisc = character.main_discipline || 'None';
  

  
  return (
    <div className="powers-tab">
      <div className="glass-card" style={{ marginBottom: 'var(--space-md)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: 'var(--space-sm)', textAlign: 'center' }}>
          
          <div style={{ cursor: 'default' }}>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Psy Rating</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--color-purple)' }}>{basePR}</div>
          </div>

          <div onClick={() => { setEditingField('psyker_type'); setEditValue(psykerType); }} style={{ cursor: 'pointer' }}>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Type</div>
            <div style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>{psykerType}</div>
          </div>

          <div onClick={() => { setEditingField('main_discipline'); setEditValue(mainDisc); }} style={{ cursor: 'pointer' }}>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Discipline</div>
            <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--color-primary)' }}>{mainDisc}</div>
          </div>

          <div onClick={() => { setEditingField('psy_focus'); setEditValue(String(character.psy_focus || 0)); }} style={{ cursor: 'pointer' }}>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Psy Focus</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>+{character.psy_focus || 0}</div>
          </div>

        </div>

        <hr style={{ margin: 'var(--space-sm) 0', borderTop: '1px solid rgba(255,255,255,0.1)' }} />

        <div style={{ display: 'flex', gap: 'var(--space-md)', alignItems: 'center' }}>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Focus Level</label>
            <select className="input" value={character.current_focus || 'Unfettered'} onChange={handleFocusChange}>
              <option value="Fettered">Fettered (PR/2)</option>
              <option value="Unfettered">Unfettered (PR)</option>
              <option value="Push">Push (PR + Bonus)</option>
            </select>
          </div>
          
          {character.current_focus === 'Push' && (
            <div style={{ width: '100px' }}>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Push Amt</label>
              <select className="input" value={character.current_push_amount || 1} onChange={handlePushChange}>
                {Array.from({ length: maxPush }, (_, i) => i + 1).map(n => (
                  <option key={n} value={n}>+{n}</option>
                ))}
              </select>
            </div>
          )}

          <div style={{ textAlign: 'center', minWidth: '80px', background: 'rgba(0,0,0,0.2)', padding: 'var(--space-xs)', borderRadius: 'var(--radius-sm)' }}>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Effective PR</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 'bold', color: 'var(--color-primary)' }}>{effectivePR}</div>
          </div>
        </div>

      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 'var(--space-xl)' }}>Loading powers...</div>
      ) : character.powers.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state__icon">☸</div>
          <p className="empty-state__text">No powers known.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
          {character.powers.map(p => {
             const tmpl = templates.find(t => t.name.toLowerCase() === p.name.toLowerCase());
             return <PowerCard key={p.id} power={p} template={tmpl} effectivePR={effectivePR} character={character} onDelete={() => handleDeletePower(p.id)} />;
          })}
        </div>
      )}

      {editingField && (
        <EditModal title={`Edit ${editingField.replace(/_/g, ' ')}`} onClose={() => setEditingField(null)}>
          {editingField === 'psyker_type' ? (
            <select className="input" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus>
              <option value="Bound">Bound</option>
              <option value="Unbound">Unbound</option>
              <option value="Daemonic">Daemonic</option>
            </select>
          ) : editingField === 'main_discipline' ? (
            <select className="input" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus>
              <option value="None">None</option>
              <option value="Biomancy">Biomancy</option>
              <option value="Daemonology">Daemonology</option>
              <option value="Divination">Divination</option>
              <option value="Pyromancy">Pyromancy</option>
              <option value="Telekinesis">Telekinesis</option>
              <option value="Telepathy">Telepathy</option>
            </select>
          ) : (
            <input className="input" type="number" value={editValue} onChange={e => setEditValue(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSaveField()} autoFocus />
          )}
          <div className="modal-sheet__actions" style={{ marginTop: 'var(--space-md)' }}>
            <button className="btn" onClick={() => setEditingField(null)}>Cancel</button>
            <button className="btn btn--primary" onClick={handleSaveField}>Save</button>
          </div>
        </EditModal>
      )}
    </div>
  );
}
