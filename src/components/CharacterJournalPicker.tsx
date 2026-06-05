import { useCharacterList } from '../hooks/useCharacter';

interface Props {
  onSelect: (characterId: number, characterName: string) => void;
  onClose: () => void;
}

export default function CharacterJournalPicker({ onSelect, onClose }: Props) {
  const { characters, loading } = useCharacterList();

  return (
    <div
      className="journal-picker-overlay"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="journal-picker-panel">
        <div className="journal-picker__scanlines" />

        <div className="journal-picker__header">
          <span className="journal-picker__title">◈ SELECT OPERATIVE</span>
          <button className="journal-picker__close" onClick={onClose} title="Close">✕</button>
        </div>

        <p className="journal-picker__subtitle">Open field journal for:</p>

        {loading ? (
          <div className="journal-picker__state">ACCESSING COGITATOR…</div>
        ) : characters.length === 0 ? (
          <div className="journal-picker__state">NO OPERATIVES ON RECORD</div>
        ) : (
          <div className="journal-picker__list">
            {characters.map(char => (
              <button
                key={char.id}
                className="journal-picker__item"
                onClick={() => onSelect(char.id, char.name)}
              >
                {char.portrait_url && (
                  <img
                    src={char.portrait_url}
                    alt=""
                    className="journal-picker__item-portrait"
                  />
                )}
                <span className="journal-picker__item-name">{char.name}</span>
                <span className="journal-picker__item-arrow">→</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
