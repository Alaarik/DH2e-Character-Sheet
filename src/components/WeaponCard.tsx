import { Weapon, AttachedMod, LoadedAmmo } from '../hooks/useCharacter';

interface Props {
  weapon: Weapon;
  onClick?: () => void;
  onToggleEquip?: () => void;
}

export default function WeaponCard({ weapon, onClick, onToggleEquip }: Props) {
  let qualities: string[] = [];
  if (weapon.qualities) {
    try {
      let parsed = JSON.parse(weapon.qualities);
      while (typeof parsed === 'string') {
        try { 
          const next = JSON.parse(parsed); 
          if (next === parsed) break;
          parsed = next;
        } catch { break; }
      }
      if (Array.isArray(parsed)) {
        qualities = parsed;
      } else {
        qualities = [weapon.qualities];
      }
    } catch {
      qualities = [weapon.qualities];
    }
  }

  const isMelee = weapon.category === 'Melee';

  return (
    <div 
      className="glass-card weapon-card" 
      id={`weapon-${weapon.id}`}
      onClick={onClick}
      style={{ cursor: onClick ? 'pointer' : 'default', display: 'flex', flexDirection: 'column' }}
    >
      <div className="weapon-card__header">
        <span className="weapon-card__icon">{isMelee ? '🗡️' : '🔫'}</span>
        <span className="weapon-card__name" style={{ flex: 1 }}>
          {weapon.display_name}
          {weapon.quality && weapon.quality !== 'Common' && (
            <span style={{ marginLeft: '8px', color: 'var(--text-secondary)', fontSize: '0.8rem', fontWeight: 'normal' }}>[{weapon.quality}]</span>
          )}
        </span>
        {onToggleEquip && (
          <button 
            className="btn" 
            style={{ padding: '2px 8px', fontSize: '0.7rem', marginRight: '8px' }}
            onClick={(e) => { e.stopPropagation(); onToggleEquip(); }}
          >
            {weapon.is_equipped ? 'Unequip' : 'Equip'}
          </button>
        )}
        <span className="weapon-card__category">{weapon.category}</span>
      </div>

      {weapon.image_url && (
        <div style={{ margin: 'var(--space-sm) 0', borderRadius: 'var(--radius-sm)', overflow: 'hidden', background: 'rgba(0,0,0,0.2)' }}>
          <img 
            src={weapon.image_url} 
            alt={weapon.display_name} 
            style={{ width: '100%', height: 'auto', display: 'block', maxHeight: '150px', objectFit: 'contain' }}
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        </div>
      )}

      <div className="weapon-card__stats">
        {weapon.damage && (
          <div className="weapon-card__stat">
            <div className="weapon-card__stat-label">Damage</div>
            <div className="weapon-card__stat-value">{weapon.damage}</div>
          </div>
        )}
        {weapon.type && (
          <div className="weapon-card__stat">
            <div className="weapon-card__stat-label">Type</div>
            <div className="weapon-card__stat-value">{weapon.type}</div>
          </div>
        )}
        {weapon.pen !== null && weapon.pen !== undefined && (
          <div className="weapon-card__stat">
            <div className="weapon-card__stat-label">Pen</div>
            <div className="weapon-card__stat-value">{weapon.pen}</div>
          </div>
        )}
        {weapon.range && (
          <div className="weapon-card__stat">
            <div className="weapon-card__stat-label">Range</div>
            <div className="weapon-card__stat-value">{weapon.range}</div>
          </div>
        )}
        {weapon.rof && (
          <div className="weapon-card__stat">
            <div className="weapon-card__stat-label">RoF</div>
            <div className="weapon-card__stat-value">{weapon.rof}</div>
          </div>
        )}
        {weapon.weapon_class && (
          <div className="weapon-card__stat">
            <div className="weapon-card__stat-label">Class</div>
            <div className="weapon-card__stat-value">{weapon.weapon_class}</div>
          </div>
        )}
      </div>

      {qualities.length > 0 && (
        <div className="weapon-card__qualities">
          {qualities.join(', ')}
        </div>
      )}

      {/* Attached mods */}
      {weapon.mods && weapon.mods.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '6px', paddingTop: '6px', borderTop: '1px solid var(--border-color)' }}>
          {weapon.mods.map((m: AttachedMod, i: number) => (
            <span key={i} style={{
              fontSize: '0.65rem', padding: '2px 7px', borderRadius: 20,
              background: 'rgba(251,191,36,0.12)', color: '#fbbf24',
              border: '1px solid rgba(251,191,36,0.25)', fontWeight: 600,
            }}>🔧 {m.name}</span>
          ))}
        </div>
      )}

      {/* Loaded ammo (ranged only) */}
      {weapon.category === 'Ranged' && weapon.ammo && weapon.ammo.length > 0 && (() => {
        const active = weapon.ammo.find((a: LoadedAmmo) => a.active);
        const others = weapon.ammo.filter((a: LoadedAmmo) => !a.active);
        return (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '4px' }}>
            {active && (
              <span style={{
                fontSize: '0.65rem', padding: '2px 8px', borderRadius: 20,
                background: 'rgba(16,185,129,0.15)', color: '#10b981',
                border: '1px solid rgba(16,185,129,0.3)', fontWeight: 700,
              }}>⚡ {active.name}</span>
            )}
            {others.map((a: LoadedAmmo, i: number) => (
              <span key={i} style={{
                fontSize: '0.65rem', padding: '2px 7px', borderRadius: 20,
                background: 'rgba(255,255,255,0.05)', color: 'var(--text-muted)',
                border: '1px solid var(--border-color)',
              }}>{a.name}</span>
            ))}
          </div>
        );
      })()}
    </div>
  );
}
