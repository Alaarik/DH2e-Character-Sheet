import { useState, useEffect, useRef } from 'react';

const DICE = [
  { label: 'D5',   sides: 5   },
  { label: 'D6',   sides: 6   },
  { label: 'D10',  sides: 10  },
  { label: 'D100', sides: 100 },
] as const;

interface RollRecord {
  id: number;
  notation: string;
  total: number;
  individual: number[];
}

interface Props {
  onClose: () => void;
}

export default function DiceRoller({ onClose }: Props) {
  const [count, setCount]         = useState(1);
  const [rolling, setRolling]     = useState(false);
  const [animValue, setAnimValue] = useState<number | null>(null);
  const [lastRoll, setLastRoll]   = useState<{ notation: string; total: number; individual: number[] } | null>(null);
  const [activeDie, setActiveDie] = useState<string | null>(null);
  const [history, setHistory]     = useState<RollRecord[]>([]);
  const intervalRef = useRef<number | null>(null);
  const idRef       = useRef(0);

  const rollDice = (sides: number, label: string) => {
    if (rolling) return;
    setRolling(true);
    setActiveDie(label);

    const individual = Array.from({ length: count }, () => Math.floor(Math.random() * sides) + 1);
    const total      = individual.reduce((a, b) => a + b, 0);
    const notation   = count > 1 ? `${count}×${label}` : label;

    let ticks = 0;
    intervalRef.current = window.setInterval(() => {
      ticks++;
      // Animate a plausible-looking running total
      setAnimValue(Math.floor(Math.random() * (sides * count - count + 1)) + count);
      if (ticks >= 22) {
        clearInterval(intervalRef.current!);
        setAnimValue(null);
        setLastRoll({ notation, total, individual });
        setRolling(false);
        setHistory(prev => [
          { id: idRef.current++, notation, total, individual },
          ...prev.slice(0, 7),
        ]);
      }
    }, 45);
  };

  useEffect(() => () => { if (intervalRef.current) clearInterval(intervalRef.current); }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const displayNum = rolling ? animValue : (lastRoll?.total ?? null);

  return (
    <div className="dice-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="dice-panel">
        <div className="dice-panel__scanlines" />

        <div className="dice-panel__header">
          <span className="dice-panel__title">⊕ COGITATOR ROLL</span>
          <button className="dice-panel__close" onClick={onClose} title="Close">✕</button>
        </div>

        {/* Result display */}
        <div className="dice-panel__result-area">
          {displayNum !== null ? (
            <>
              <div className={`dice-panel__result${rolling ? ' dice-panel__result--rolling' : ''}`}>
                {displayNum}
              </div>
              {lastRoll && !rolling && (
                <>
                  <div className="dice-panel__result-label">{lastRoll.notation} ▸ RESULT</div>
                  {count > 1 && (
                    <div className="dice-panel__individual">
                      [ {lastRoll.individual.join('  ')} ]
                    </div>
                  )}
                </>
              )}
            </>
          ) : (
            <div className="dice-panel__prompt">SELECT DIE TO ROLL</div>
          )}
        </div>

        {/* Count selector — vertical +/count/− widget */}
        <div className="dice-count-selector">
          <button
            className="dice-count-btn"
            onClick={() => setCount(c => Math.min(c + 1, 10))}
            disabled={rolling || count >= 10}
            title="Roll more dice"
          >+</button>
          <div className="dice-count-display">
            <span className="dice-count-number">{count}</span>
            <span className="dice-count-unit">×</span>
          </div>
          <button
            className="dice-count-btn"
            onClick={() => setCount(c => Math.max(c - 1, 1))}
            disabled={rolling || count <= 1}
            title="Roll fewer dice"
          >−</button>
        </div>

        {/* Die buttons */}
        <div className="dice-panel__buttons">
          {DICE.map(({ label, sides }) => (
            <button
              key={label}
              className={`dice-btn${activeDie === label ? ' dice-btn--active' : ''}`}
              onClick={() => rollDice(sides, label)}
              disabled={rolling}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Roll log */}
        {history.length > 0 && (
          <div className="dice-panel__log">
            <div className="dice-panel__log-title">▸ ROLL LOG</div>
            {history.map((rec, i) => (
              <div key={rec.id} className={`dice-log-entry${i === 0 ? ' dice-log-entry--latest' : ''}`}>
                <span className="dice-log-entry__die">{rec.notation}</span>
                <span className="dice-log-entry__dots" />
                <span className="dice-log-entry__result">{rec.total}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
