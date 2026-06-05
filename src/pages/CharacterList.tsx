import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { CharacterSummary, useCharacterList } from '../hooks/useCharacter';
import EditModal from '../components/EditModal';
import ChargenWizard from '../components/ChargenWizard';
import TabBar from '../components/TabBar';

interface ToastAPI {
  success: (msg: string) => void;
  error: (msg: string) => void;
  info: (msg: string) => void;
}

interface Props {
  onSelectCharacter: (id: number, name: string) => void;
  toast: ToastAPI;
  onAddCharacter?: (trigger: () => void) => void;
  onCreatingChange?: (creating: boolean) => void;
}

export default function CharacterList({ onSelectCharacter, toast, onAddCharacter, onCreatingChange }: Props) {
  const { characters, loading, refresh } = useCharacterList();
  const [showChargen, setShowChargen] = useState(false);

  const setChargen = (val: boolean) => {
    setShowChargen(val);
    onCreatingChange?.(val);
  };

  // Register trigger with parent so bezel button can fire it
  useState(() => { onAddCharacter?.(() => setChargen(true)); });

  const handleChargenComplete = async (charData: any) => {
    try {
      const res = await fetch('/api/characters', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(charData),
      });
      if (res.ok) {
        const data = await res.json();
        setChargen(false);
        refresh();
        toast.success(`Created "${charData.name}"!`);
        onSelectCharacter(data.id, charData.name);
      } else {
        const data = await res.json();
        toast.error(data.error || 'Failed to create character');
      }
    } catch {
      toast.error('Network error — check your connection.');
    }
  };

  if (showChargen) {
    return <ChargenWizard onComplete={handleChargenComplete} onCancel={() => setChargen(false)} />;
  }

  if (loading) {
    return (
      <div className="page">
        <div className="page-header">
          <div className="skeleton skeleton--title" style={{ margin: '0 auto' }} />
          <div className="skeleton skeleton--text" style={{ margin: '8px auto 0', width: '50%' }} />
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-sm)', marginBottom: 'var(--space-lg)' }}>
          <div className="skeleton" style={{ height: 40, flex: 1, borderRadius: 'var(--radius-md)' }} />
          <div className="skeleton" style={{ height: 40, flex: 1, borderRadius: 'var(--radius-md)' }} />
        </div>
        <div className="skeleton skeleton--card" />
        <div className="skeleton skeleton--card" />
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">G-1289 Primer</h1>
        <p className="page-subtitle">Select a character to view or edit</p>
      </div>


      {/* Character Grid */}
      {characters.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state__icon">📋</div>
          <p className="empty-state__text">No characters yet. Import from Google Sheets or create a new one!</p>
        </div>
      ) : (
        <div className="char-card-grid">
          {characters.map((char: CharacterSummary) => (
            <div
              key={char.id}
              className="glass-card char-card"
              onClick={() => onSelectCharacter(char.id, char.name)}
              id={`char-card-${char.id}`}
            >
              <div className="char-card__glow" />
              {char.portrait_url && (
                <img src={char.portrait_url} alt={char.name} className="char-card__portrait" />
              )}
              <div className="char-card__name">{char.name}</div>
              <div className="char-card__meta">
                {char.wounds && `♱ ${char.wounds}`}
                {char.psy_rating && ` · ☸ PR ${char.psy_rating}`}
              </div>
            </div>
          ))}
        </div>
      )}



      {/* Render the static bottom bezel tabs */}
      <TabBar activeTab={'' as any} onTabChange={() => {}} hasPowers={false} />
    </div>
  );
}
