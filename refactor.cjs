const fs = require('fs');
let code = fs.readFileSync('src/components/AdvancementTab.tsx', 'utf-8');

// 1. Add CartItem interface
const interfaceInjection = `
interface CartItem {
  id: number;
  category: string;
  name: string;
  level: string;
  cost: number;
  isFree: boolean;
  freeReason: string;
  updates: Partial<CharacterFull>;
}
`;
code = code.replace(/export default function AdvancementTab[^\n]+{/, interfaceInjection + '\nexport default function AdvancementTab({ character, update }: Props) {\n  const [cart, setCart] = useState<CartItem[]>([]);\n');

code = code.replace(`import { useState, useEffect }`, `import React, { useState, useEffect, useMemo }`);
const previewInjection = `
  const previewCharacter = useMemo(() => {
    let char = { ...character };
    for (const item of cart) {
      char = { ...char, ...item.updates };
    }
    return char;
  }, [character, cart]);
`;
code = code.replace(/const aptitudes = character\.aptitudes \|\| \[\];/, previewInjection + '\n  const aptitudes = previewCharacter.aptitudes || [];');

const xpBlockOld = `  const xpPurchases = character.xp_purchases || [];
  const totalXp = character.total_xp || 0;
  const xpUsed = xpPurchases.reduce((s, p) => s + p.xp_cost, 0);
  const xpRemaining = totalXp - xpUsed;`;

const xpBlockNew = `  const savedPurchases = character.xp_purchases || [];
  const totalXp = previewCharacter.total_xp || 0;
  const savedXpUsed = savedPurchases.reduce((s, p) => s + p.xp_cost, 0);
  const cartXpUsed = cart.reduce((s, c) => s + c.cost, 0);
  const xpUsed = savedXpUsed + cartXpUsed;
  const xpRemaining = totalXp - xpUsed;`;
code = code.replace(xpBlockOld, xpBlockNew);

code = code.replace(
  /const \[confirmPurchase, setConfirmPurchase\] = useState<[^>]+>\| null>\(null\);/,
  `const [confirmPurchase, setConfirmPurchase] = useState<{ type: string; name: string; level: string; cost: number; updates: Partial<CharacterFull> } | null>(null);`
);

code = code.replace(/const char = character\.characteristics/g, 'const char = previewCharacter.characteristics');
code = code.replace(/const updatedChars = character\.characteristics/g, 'const updatedChars = previewCharacter.characteristics');
code = code.replace(/const currentPR = character\.psy_rating/g, 'const currentPR = previewCharacter.psy_rating');
code = code.replace(/let skill = character\.skills/g, 'let skill = previewCharacter.skills');
code = code.replace(/const baseStat = character\.characteristics/g, 'const baseStat = previewCharacter.characteristics');
code = code.replace(/let updatedSkills = isNew \? \[\.\.\.character\.skills/g, 'let updatedSkills = isNew ? [...previewCharacter.skills');
code = code.replace(/updatedSkills = \[\.\.\.character\.skills\]/g, 'updatedSkills = [...previewCharacter.skills]');
code = code.replace(/talents: \[\.\.\.\(character\.talents/g, 'talents: [...(previewCharacter.talents');
code = code.replace(/character\.psy_rating/g, 'previewCharacter.psy_rating');
code = code.replace(/const charStat = character\.characteristics/g, 'const charStat = previewCharacter.characteristics');
code = code.replace(/const basePR = character\.psy_rating/g, 'const basePR = previewCharacter.psy_rating');
code = code.replace(/\(character\.powers \|\| \[\]\)/g, '(previewCharacter.powers || [])');
code = code.replace(/character\.main_discipline/g, 'previewCharacter.main_discipline');
code = code.replace(/character\.characteristics\.map/g, 'previewCharacter.characteristics.map');

// In removeXpPurchase, it should still be character:
code = code.replace(/previewCharacter\.characteristics\.find\(c => \(CHAR_FULL_NAMES\[c\.abbrev\] \|\| c\.abbrev\) === purchase\.name\)/g, 'character.characteristics.find(c => (CHAR_FULL_NAMES[c.abbrev] || c.abbrev) === purchase.name)');
code = code.replace(/previewCharacter\.skills\.find\(s => s\.name === purchase\.name\)/g, 'character.skills.find(s => s.name === purchase.name)');
code = code.replace(/updates\.characteristics = previewCharacter\.characteristics\.map/g, 'updates.characteristics = character.characteristics.map');

const reCharPayload = /callback: \(free, reason\) => addXpPurchase\('Characteristic', abbrev, free \? \`\$\{tier\.label\} \(Free\$\{reason \? \`:\ \$\{reason\}\` : ''\}\)\` : tier\.label, free \? 0 : cost, \{ characteristics: updatedChars \}\)/g;
code = code.replace(reCharPayload, 'updates: { characteristics: updatedChars }');

const rePsyPayload = /callback: \(free, reason\) => addXpPurchase\('Psy Rating', 'Psy Rating', free \? \`PR \$\{nextPR\} \(Free\$\{reason \? \`:\ \$\{reason\}\` : ''\}\)\` : \`PR \$\{nextPR\}\`, free \? 0 : cost, \{ psy_rating: nextPR \}\)/g;
code = code.replace(rePsyPayload, 'updates: { psy_rating: nextPR }');

const reSkillPayload = /callback: \(free, reason\) => addXpPurchase\('Skill', skillName, free \? \`\$\{tier\.label\} \(Free\$\{reason \? \`:\ \$\{reason\}\` : ''\}\)\` : tier\.label, free \? 0 : cost, \{ skills: updatedSkills \}\)/g;
code = code.replace(reSkillPayload, 'updates: { skills: updatedSkills }');

const oldTalentCallback = `callback: async (free, reason) => {
        await addXpPurchase('Talent', displayName, free ? \`Tier \${template.tier} (Free\${reason ? \`: \${reason}\` : ''})\` : \`Tier \${template.tier}\`, free ? 0 : cost, {
          talents: [...(previewCharacter.talents || []), newTalent]
        });
        setAddingTalent(false);
        setSelectedTemplate(null);
        setTalentSearch('');
      }`;
code = code.replace(oldTalentCallback, `updates: { talents: [...(previewCharacter.talents || []), newTalent] }`);

const oldPowerCallback = `callback: (free, reason) => {
        const newPowers = [...(previewCharacter.powers || []), {
          id: Date.now(),
          name: tmpl.name,
          discipline: tmpl.discipline,
          technique: tmpl.technique
        }];
        addXpPurchase('Power', tmpl.name, free ? \`Learned (Free\${reason ? \`: \${reason}\` : ''})\` : 'Learned', free ? 0 : cost, { powers: newPowers });
      }`;
const newPowerCallback = `updates: { powers: [...(previewCharacter.powers || []), { id: Date.now() + Math.random(), name: tmpl.name, discipline: tmpl.discipline, technique: tmpl.technique }] }`;
code = code.replace(oldPowerCallback, newPowerCallback);

// Replace confirmPurchase button click
const confirmBtnOld = `<button className="btn btn--primary" onClick={async () => { await confirmPurchase.callback(isFree, freeReason); setConfirmPurchase(null); setIsFree(false); setFreeReason(''); }}>
              Confirm
            </button>`;
const confirmBtnNew = `<button className="btn btn--primary" onClick={() => { 
              setCart(prev => [...prev, {
                id: Date.now() + Math.random(),
                category: confirmPurchase.type,
                name: confirmPurchase.name,
                level: confirmPurchase.level,
                cost: confirmPurchase.cost,
                isFree,
                freeReason,
                updates: confirmPurchase.updates
              }]);
              setAddingTalent(false);
              setSelectedTemplate(null);
              setTalentSearch('');
              setConfirmPurchase(null); 
              setIsFree(false); 
              setFreeReason(''); 
            }}>
              Add to Cart
            </button>`;
code = code.replace(confirmBtnOld, confirmBtnNew);

// Add the Cart UI and Checkout function
const cartUI = `
      {/* Shopping Cart */}
      {cart.length > 0 && (
        <div style={{ marginBottom: 'var(--space-md)', padding: 'var(--space-sm)', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', border: '2px solid var(--theme-color, #8b5cf6)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-sm)' }}>
            <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--theme-color, #8b5cf6)' }}>Pending Advances</div>
            <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>Cart Total: {cartXpUsed} xp</div>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: 'var(--space-sm)' }}>
            {cart.map((item) => (
              <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', padding: '4px 8px', background: 'rgba(0,0,0,0.2)', borderRadius: '4px' }}>
                <span>
                  <span style={{ color: 'var(--text-muted)', marginRight: '6px' }}>[{item.category}]</span>
                  <strong>{item.name}</strong> <span style={{ color: 'var(--text-secondary)' }}>{item.level}</span>
                  {item.isFree && <span style={{ color: 'var(--color-success, #22c55e)', marginLeft: '6px' }}>(Free)</span>}
                </span>
                <span>{item.isFree ? 0 : item.cost} xp</span>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="btn btn--danger" style={{ padding: '4px 12px', fontSize: '0.8rem' }} onClick={() => setCart(cart.slice(0, -1))}>Undo Last</button>
              <button className="btn" style={{ padding: '4px 12px', fontSize: '0.8rem' }} onClick={() => setCart([])}>Clear Cart</button>
            </div>
            <button className="btn btn--primary" style={{ padding: '6px 16px', fontWeight: 600 }} onClick={async () => {
              if (cart.length === 0) return;
              const newPurchases = cart.map(item => ({
                id: item.id,
                category: item.category as any,
                name: item.name,
                advance_level: item.isFree ? \`\${item.level} (Free\${item.freeReason ? \`: \${item.freeReason}\` : ''})\` : item.level,
                xp_cost: item.isFree ? 0 : item.cost
              }));
              await update({
                ...previewCharacter,
                xp_purchases: [...(character.xp_purchases || []), ...newPurchases]
              });
              setCart([]);
            }} disabled={xpRemaining < 0}>
              Checkout
            </button>
          </div>
        </div>
      )}
`;

code = code.replace('{/* Aptitudes */}', cartUI + '\n      {/* Aptitudes */}');

// Adjust Talent list so that cart-pending talents don't have X buttons
code = code.replace(
  /<button className="btn btn--danger" style={{ padding: '2px 8px', fontSize: '0\.7rem' }}\s+onClick={\(\) => removeTalent\(talent\.id\)}>✕<\/button>/g,
  `{!(!(character.talents || []).some(t => t.id === talent.id)) ? (
                  <button className="btn btn--danger" style={{ padding: '2px 8px', fontSize: '0.7rem' }} onClick={() => removeTalent(talent.id)}>✕</button>
                ) : (
                  <span style={{ fontSize: '0.75rem', color: 'var(--theme-color)' }}>Pending</span>
                )}`
);

// Adjust Powers list so pending powers don't say 'No XP Entry' falsely if they're in the cart
code = code.replace(
  /const hasPurchase = xpPurchases\.some\(p => p\.category === 'Power' && p\.name === power\.name\);/g,
  `const isPending = !(character.powers || []).some(p => p.id === power.id);
              const hasPurchase = savedPurchases.some(p => p.category === 'Power' && p.name === power.name);`
);
code = code.replace(
  /<span style={{ fontSize: '0\.75rem', color: 'var\(--color-warning, #f59e0b\)' }}>No XP entry<\/span>/g,
  `isPending ? <span style={{ fontSize: '0.75rem', color: 'var(--theme-color)' }}>Pending</span> : <span style={{ fontSize: '0.75rem', color: 'var(--color-warning, #f59e0b)' }}>No XP entry</span>`
);

// Ledger should use savedPurchases instead of xpPurchases
code = code.replace(/xpPurchases\.length/g, 'savedPurchases.length');
code = code.replace(/xpPurchases\.map/g, 'savedPurchases.map');

fs.writeFileSync('src/components/AdvancementTab.tsx', code);
