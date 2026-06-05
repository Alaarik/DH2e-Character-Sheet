import { Characteristic } from '../hooks/useCharacter';

const CHAR_LABELS: Record<string, string> = {
  WS: 'WS', BS: 'BS', S: 'Str', T: 'Tgh',
  AG: 'Agi', INT: 'Int', PER: 'Per', WP: 'WP', FEL: 'Fel'
};

interface Props {
  characteristics: Characteristic[];
  onEdit: (char: Characteristic) => void;
}

export default function StatGrid({ characteristics, onEdit }: Props) {
  return (
    <div className="stat-grid">
      {characteristics.map(c => (
        <div
          key={c.abbrev}
          className="stat-card"
          style={(c.temp_damage > 0 || c.perm_damage > 0) ? { borderColor: 'var(--color-danger, #ef4444)', boxShadow: '0 0 8px rgba(220, 38, 38, 0.4)' } : undefined}
          onClick={() => onEdit(c)}
          id={`stat-${c.abbrev}`}
        >
          <span className="stat-card__label">{CHAR_LABELS[c.abbrev] || c.abbrev}</span>
          <span className="stat-card__value" style={(c.temp_damage > 0 || c.perm_damage > 0) ? { color: 'var(--color-danger, #ef4444)' } : undefined}>{c.total}</span>
          <span className="stat-card__bonus">Bonus: {c.bonus}</span>
          {c.unnatural > 0 && (
            <span className="stat-card__unnatural">UN +{c.unnatural}</span>
          )}
        </div>
      ))}
    </div>
  );
}
