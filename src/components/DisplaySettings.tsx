import { useState } from 'react';
import { createPortal } from 'react-dom';

const PHOSPHOR_PRESETS = [
  { id: 'green', label: 'Green',  color: '#33ff33' },
  { id: 'amber', label: 'Amber',  color: '#ffb000' },
  { id: 'cyan',  label: 'Cyan',   color: '#00ffee' },
  { id: 'white', label: 'White',  color: '#c8c8c0' },
];

export interface DisplayPrefs {
  phosphor:   string;
  brightness: number;   // 0.4 – 1.5
  scanlines:  boolean;
}

const DEFAULT_PREFS: DisplayPrefs = {
  phosphor:   '#33ff33',
  brightness: 1,
  scanlines:  true,
};

export function loadDisplayPrefs(): DisplayPrefs {
  try {
    return { ...DEFAULT_PREFS, ...JSON.parse(localStorage.getItem('ds-display-prefs') || '{}') };
  } catch {
    return DEFAULT_PREFS;
  }
}

export function applyDisplayPrefs(prefs: DisplayPrefs) {
  const r = document.documentElement;
  r.style.setProperty('--phosphor',          prefs.phosphor);
  r.style.setProperty('--screen-brightness', String(prefs.brightness));
  r.style.setProperty('--scanlines-opacity', prefs.scanlines ? '0.08' : '0');
}

interface Props { onClose: () => void; }

export default function DisplaySettings({ onClose }: Props) {
  const [prefs, setPrefs] = useState<DisplayPrefs>(loadDisplayPrefs);

  const update = (patch: Partial<DisplayPrefs>) => {
    const next = { ...prefs, ...patch };
    setPrefs(next);
    applyDisplayPrefs(next);
    localStorage.setItem('ds-display-prefs', JSON.stringify(next));
  };

  return createPortal(
    <div className="disp-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="disp-panel">
        <div className="disp-panel__scanlines" />

        <div className="disp-panel__header">
          <span className="disp-panel__title">⚙ DISPLAY SYSTEMS</span>
          <button className="disp-panel__close" onClick={onClose} title="Close">✕</button>
        </div>

        {/* Phosphor colour */}
        <div className="disp-section">
          <div className="disp-section__label">PHOSPHOR COLOUR</div>
          <div className="disp-phosphor-row">
            {PHOSPHOR_PRESETS.map(p => (
              <button
                key={p.id}
                className={`disp-phosphor-btn${prefs.phosphor === p.color ? ' disp-phosphor-btn--active' : ''}`}
                style={{ '--phcolor': p.color } as React.CSSProperties}
                onClick={() => update({ phosphor: p.color })}
                title={p.label}
              />
            ))}
          </div>
        </div>

        {/* Brightness */}
        <div className="disp-section">
          <div className="disp-section__label">
            SCREEN BRIGHTNESS — {Math.round(prefs.brightness * 100)}%
          </div>
          <input
            className="disp-slider"
            type="range"
            min="0.4"
            max="1.5"
            step="0.05"
            value={prefs.brightness}
            onChange={e => update({ brightness: parseFloat(e.target.value) })}
          />
        </div>

        {/* Scanlines */}
        <div className="disp-section" style={{ marginBottom: 0 }}>
          <div className="disp-section__label">CRT SCANLINES</div>
          <button
            className={`disp-toggle${prefs.scanlines ? ' disp-toggle--on' : ''}`}
            onClick={() => update({ scanlines: !prefs.scanlines })}
          >
            {prefs.scanlines ? '● ENABLED' : '○ DISABLED'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
