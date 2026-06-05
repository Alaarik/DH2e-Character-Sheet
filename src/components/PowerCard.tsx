import { Power, CharacterFull } from '../hooks/useCharacter';
import { PowerTemplate } from './PowersTab';

interface Props {
  power: Power;
  template?: PowerTemplate;
  effectivePR: number;
  character: CharacterFull;
  onDelete?: () => void;
}

function resolvePR(formula: string, pr: number): string {
  if (!formula || formula === '-' || formula.trim() === '') return '';
  let str = formula.replace(/(\d+)\s*\*\s*PR/gi, (_, n) => String(parseInt(n) * pr));
  str = str.replace(/PR\s*\*\s*(\d+)/gi, (_, n) => String(pr * parseInt(n)));
  str = str.replace(/PR\s*\/\s*(\d+)/gi, (_, n) => String(Math.ceil(pr / parseInt(n))));
  str = str.replace(/\bPR\b/gi, String(pr));
  return str;
}

export default function PowerCard({ power, template, effectivePR, character, onDelete }: Props) {
  if (!template) {
    return (
      <div className="glass-card power-card" style={{ position: 'relative' }}>
        <div className="power-card__name" style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>{power.name}</div>
        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Details not found in ruleset spreadsheet.</div>
        {onDelete && (
          <button style={{ position: 'absolute', top: '8px', right: '8px', background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '1.2rem' }} onClick={onDelete}>🗑️</button>
        )}
      </div>
    );
  }

  // Calculate Focus Test TN
  // "Test" column e.g. "Willpower" or "Perception"
  const testCharName = template.test ? template.test.replace(/Opposed /i, '').replace(/ Test/i, '').trim() : 'Willpower';
  const charStat = character.characteristics.find(c => {
    const abbrevNames: Record<string, string> = { WS: 'Weapon Skill', BS: 'Ballistic Skill', S: 'Strength', T: 'Toughness', AG: 'Agility', INT: 'Intelligence', PER: 'Perception', WP: 'Willpower', FEL: 'Fellowship' };
    return abbrevNames[c.abbrev]?.toLowerCase() === testCharName.toLowerCase() || c.abbrev.toLowerCase() === testCharName.toLowerCase();
  });
  
  const baseVal = charStat?.total || 0;
  // Mod string e.g. "(+30)" or "(-10)"
  const modMatch = template.mod ? template.mod.match(/([+-]?\d+)/) : null;
  const modNum = modMatch ? parseInt(modMatch[0]) : 0;
  
  const tn = baseVal + modNum + (character.psy_focus || 0) + (effectivePR * 5);

  const range = resolvePR(template.range, effectivePR);
  const radius = resolvePR(template.radius, effectivePR);
  const damage = resolvePR(template.damage, effectivePR);

  return (
    <div className="glass-card power-card" style={{ display: 'flex', flexDirection: 'column', gap: '8px', position: 'relative' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', paddingRight: '30px' }}>
        <div>
          <div className="power-card__name" style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>{template.name}</div>
          <div className="power-card__meta" style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            {template.discipline} {template.technique && template.technique !== '-' ? `· ${template.technique}` : ''}
          </div>
        </div>
        <div style={{ textAlign: 'right', background: 'rgba(255,255,255,0.05)', padding: '4px 8px', borderRadius: '4px' }}>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Focus Test ({testCharName})</div>
          <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--color-primary)' }}>{tn}</div>
        </div>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', fontSize: '0.85rem', background: 'rgba(0,0,0,0.2)', padding: '8px', borderRadius: '4px' }}>
        {template.action && <div><strong>Action:</strong> {template.action}</div>}
        {range && <div><strong>Range:</strong> {range}m</div>}
        {radius && <div><strong>Radius:</strong> {radius}m</div>}
        {damage && <div><strong>Damage:</strong> {damage} {template.damage_type && template.damage_type !== '-' ? template.damage_type : ''} {template.pen && template.pen !== '-' ? `(Pen ${resolvePR(template.pen, effectivePR)})` : ''}</div>}
        {template.sustain && template.sustain !== '-' && <div><strong>Sustain:</strong> {template.sustain}</div>}
      </div>

      {template.effect && (
        <div style={{ fontSize: '0.85rem', lineHeight: '1.4', color: 'rgba(255,255,255,0.9)' }}>
          {template.effect}
        </div>
      )}

      {template.opposed && template.opposed !== '-' && template.opposed.toLowerCase() !== 'no' && (
        <div style={{ fontSize: '0.8rem', color: '#ff6b6b', marginTop: '4px' }}>
          <strong>Opposed:</strong> Yes
        </div>
      )}
      {template.special && template.special !== '-' && (
        <div style={{ fontSize: '0.8rem', color: 'var(--color-purple)' }}>
          <strong>Special:</strong> {template.special}
        </div>
      )}

      {onDelete && (
        <button 
          style={{ position: 'absolute', top: '12px', right: '12px', background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '1.2rem', opacity: 0.7 }} 
          onClick={onDelete}
          title="Forget Power"
        >
          🗑️
        </button>
      )}
    </div>
  );
}
