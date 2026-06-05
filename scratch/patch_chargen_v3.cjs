const fs = require('fs');
const path = require('path');

const filePath = path.join('C:', 'Users', 'kyleb', '.gemini', 'antigravity', 'scratch', 'char-sheet', 'src', 'components', 'ChargenWizard.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Imports
if (!content.includes('parseDivinationEffect')) {
  content = content.replace(
    "import { CHARACTERISTIC_APTITUDES } from '../data/advancementData';",
    "import { CHARACTERISTIC_APTITUDES } from '../data/advancementData';\nimport { parseDivinationEffect, ParsedDivination } from '../data/divinationParser';"
  );
}
if (!content.includes('useMemo')) {
  content = content.replace("import { useState, useEffect }", "import { useState, useEffect, useMemo }");
}

// 2. States
content = content.replace('const [divinationOverrideStats, setDivinationOverrideStats] = useState<Record<string, number>>({});', '');
content = content.replace('const [divinationOverrideWounds, setDivinationOverrideWounds] = useState<number>(0);', '');
content = content.replace('const [divinationOverrideFate, setDivinationOverrideFate] = useState<number>(0);', 'const [burnedFateForDivination, setBurnedFateForDivination] = useState<boolean>(false);\n  const [divinationChoicesState, setDivinationChoicesState] = useState<Record<string, number>>({});');
content = content.replace('const [divinationOverrideInsanity, setDivinationOverrideInsanity] = useState<number>(0);', '');
content = content.replace('const [divinationOverrideCorruption, setDivinationOverrideCorruption] = useState<number>(0);', '');
content = content.replace("const [divinationOverrideSkills, setDivinationOverrideSkills] = useState<string>('');", '');
content = content.replace("const [divinationOverrideTalents, setDivinationOverrideTalents] = useState<string>('');", '');

// 3. parsedDiv block (insert right before the divination UI block)
const parsedDivBlock = `
  const parsedDiv = useMemo(() => {
    if (!divinationRolled) return null;
    const base = parseDivinationEffect(divinationRolled.effect);
    
    // Quick recalculate of possessed skills for conditionals
    const possessedSkills = new Set<string>();
    const possessedTalents = new Set<string>();
    
    const addS = (str) => parseChoiceString(str).auto.forEach(x => possessedSkills.add(x.toLowerCase()));
    const addT = (str) => parseChoiceString(str).auto.forEach(x => possessedTalents.add(x.toLowerCase()));
    
    if (selHomeworld) { addS(selHomeworld.skills); addT(selHomeworld.talents); }
    if (selBackground) { addS(selBackground.skills); addT(selBackground.talents); }
    if (selRole) { addT(selRole.talent); }
    
    Object.values(geSkillChoices).forEach(s => possessedSkills.add(s.toLowerCase()));
    Object.values(hwSkillChoices).forEach(s => possessedSkills.add(s.toLowerCase()));
    Object.values(bgSkillChoices).forEach(s => possessedSkills.add(s.toLowerCase()));
    
    Object.values(geTalentChoices).forEach(t => possessedTalents.add(t.toLowerCase()));
    Object.values(hwTalentChoices).forEach(t => possessedTalents.add(t.toLowerCase()));
    Object.values(bgTalentChoices).forEach(t => possessedTalents.add(t.toLowerCase()));

    selectedEliteAdvances.forEach(eaName => {
      const ea = eliteAdvancesData.find((e: any) => e.name === eaName);
      if (ea && ea.skills) addS(ea.skills);
      if (ea && ea.talents) addT(ea.talents);
    });

    for (const cond of base.conditionalAdditions) {
       let matched = false;
       if (cond.requireSkill) matched = cond.requireSkill.some(s => possessedSkills.has(s.toLowerCase()));
       if (cond.requireTalent) matched = cond.requireTalent.some(t => possessedTalents.has(t.toLowerCase()));
       
       const branch = matched ? cond.yes : cond.no;
       if (branch.statMods) {
          for (const [k, v] of Object.entries(branch.statMods)) {
             base.statMods[k] = (base.statMods[k] || 0) + v;
          }
       }
       if (branch.skills) base.skills.push(...branch.skills);
       if (branch.talents) base.talents.push(...branch.talents);
       if (branch.choices) base.choices.push(...branch.choices);
    }
    return base;
  }, [divinationRolled, selHomeworld, selBackground, selRole, geSkillChoices, hwSkillChoices, bgSkillChoices, geTalentChoices, hwTalentChoices, bgTalentChoices, selectedEliteAdvances, eliteAdvancesData]);

  const handleFinish = () => {
`;
content = content.replace('const handleFinish = () => {', parsedDivBlock);

// 4. Update handleFinish
content = content.replace(
  'const finalFate = (fateManual ? parseInt(fateManual) : (rolledFate ?? (parseInt(selHomeworld?.fate) || 0))) + divinationOverrideFate;',
  'const finalFate = (fateManual ? parseInt(fateManual) : (rolledFate ?? (parseInt(selHomeworld?.fate) || 0))) + (burnedFateForDivination ? -1 : 0) + (parsedDiv?.fate || 0);'
);
content = content.replace(
  'const finalWounds = (woundsManual ? parseInt(woundsManual) : (rolledWounds ?? 10)) + divinationOverrideWounds;',
  'const finalWounds = (woundsManual ? parseInt(woundsManual) : (rolledWounds ?? 10)) + (parsedDiv?.wounds || 0);'
);
content = content.replace(
  'const finalInsanity = (insanityManual ? parseInt(insanityManual) : (rolledInsanity ?? 0)) + divinationOverrideInsanity;',
  'const finalInsanity = (insanityManual ? parseInt(insanityManual) : (rolledInsanity ?? 0)) + (parsedDiv?.insanity || 0);'
);
content = content.replace(
  'const finalCorruption = baseCorruption + divinationOverrideCorruption;',
  'const finalCorruption = baseCorruption + (parsedDiv?.corruption || 0);'
);

// Stat modifiers
const statInsertPoint = `    finalStats.FEL = (finalStats.FEL || 0) - 3;`;
const divStatsAndSkillsLogic = `    finalStats.FEL = (finalStats.FEL || 0) - 3;
    
    // Apply Divination Stats & Skills/Talents
    if (parsedDiv) {
      for (const [abbrev, mod] of Object.entries(parsedDiv.statMods)) {
        if (finalStats[abbrev] !== undefined) finalStats[abbrev] += mod;
      }
      for (const s of parsedDiv.skills) skillSet.set(s, resolveSkill(s));
      for (const t of parsedDiv.talents) {
        if (!talentList.find(x => x.name.toLowerCase() === t.toLowerCase())) {
          talentList.push({ name: t, specialisation: null, tier: 1 });
        }
      }
      for (const choice of parsedDiv.choices) {
        const selectedIdx = divinationChoicesState[choice.id] || 0;
        const opt = choice.options[selectedIdx];
        if (opt) {
          if (opt.statMods) {
            for (const [abbrev, mod] of Object.entries(opt.statMods)) {
              if (finalStats[abbrev] !== undefined) finalStats[abbrev] += mod;
            }
          }
          if (opt.skills) {
             for (const s of opt.skills) skillSet.set(s, resolveSkill(s));
          }
          if (opt.talents) {
             for (const t of opt.talents) {
               if (!talentList.find(x => x.name.toLowerCase() === t.toLowerCase())) {
                 talentList.push({ name: t, specialisation: null, tier: 1 });
               }
             }
          }
        }
      }
    }
`;
content = content.replace(statInsertPoint, divStatsAndSkillsLogic);

// Remove old talents block
const oldDivTalentLogic = `
    // Add Divination extra talents
    if (divinationOverrideTalents.trim()) {
      const parts = divinationOverrideTalents.split(',').map(s => s.trim()).filter(Boolean);
      for (const p of parts) {
        if (!talentList.find(t => t.name === p)) {
          talentList.push({ name: p, specialisation: null, tier: 1 });
        }
      }
    }
`;
content = content.replace(oldDivTalentLogic, '');

// 5. Update UI
content = content.replace('setDivinationOverrideFate(-1)', 'setBurnedFateForDivination(true)');
content = content.replace('setDivinationOverrideFate(0)', 'setBurnedFateForDivination(false)');
content = content.replace("{divinationOverrideFate === -1 && '⚠ You burned 1 Fate Point to choose this divination.'}", "{burnedFateForDivination && '⚠ You burned 1 Fate Point to choose this divination.'}");

// Clean UI overrides
content = content.replace('setDivinationOverrideStats({});', 'setDivinationChoicesState({});');
content = content.replace("setDivinationOverrideSkills('');", '');
content = content.replace("setDivinationOverrideTalents('');", '');
content = content.replace('setDivinationOverrideInsanity(0);', '');
content = content.replace('setDivinationOverrideCorruption(0);', '');
content = content.replace('setDivinationOverrideWounds(0);', '');

// Replace UI block carefully!
const oldUiBlock = `              <div style={{ marginTop: 'var(--space-md)', paddingTop: 'var(--space-md)', borderTop: '1px solid var(--border-color)' }}>
                <h4 style={{ marginBottom: 'var(--space-sm)' }}>Apply Mechanical Effects</h4>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: 'var(--space-sm)' }}>
                  Use the fields below to manually apply any stats, skills, talents, or points granted by this divination. 
                  (The prophecy itself will automatically be added as a Trait).
                </p>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-sm)', marginBottom: 'var(--space-sm)' }}>
                  <div>
                    <label className="stat-edit-form__label">Bonus Skills (comma-separated)</label>
                    <input className="input" type="text" value={divinationOverrideSkills} onChange={e => setDivinationOverrideSkills(e.target.value)} placeholder="e.g. Awareness, Scrutiny" />
                  </div>
                  <div>
                    <label className="stat-edit-form__label">Bonus Talents (comma-separated)</label>
                    <input className="input" type="text" value={divinationOverrideTalents} onChange={e => setDivinationOverrideTalents(e.target.value)} placeholder="e.g. Quick Draw" />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--space-sm)', marginBottom: 'var(--space-sm)' }}>
                  <div>
                    <label className="stat-edit-form__label">Wounds Mod</label>
                    <input className="input" type="number" value={divinationOverrideWounds || ''} onChange={e => setDivinationOverrideWounds(parseInt(e.target.value) || 0)} placeholder="0" />
                  </div>
                  <div>
                    <label className="stat-edit-form__label">Fate Mod</label>
                    <input className="input" type="number" value={divinationOverrideFate || ''} onChange={e => setDivinationOverrideFate(parseInt(e.target.value) || 0)} placeholder="0" />
                  </div>
                  <div>
                    <label className="stat-edit-form__label">Insanity Mod</label>
                    <input className="input" type="number" value={divinationOverrideInsanity || ''} onChange={e => setDivinationOverrideInsanity(parseInt(e.target.value) || 0)} placeholder="0" />
                  </div>
                  <div>
                    <label className="stat-edit-form__label">Corruption Mod</label>
                    <input className="input" type="number" value={divinationOverrideCorruption || ''} onChange={e => setDivinationOverrideCorruption(parseInt(e.target.value) || 0)} placeholder="0" />
                  </div>
                </div>

                <div>
                  <label className="stat-edit-form__label">Characteristic Modifiers (+/-)</label>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {CHAR_ABBREVS.map(a => (
                      <div key={a} style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-tertiary)', padding: '2px 6px', borderRadius: 4 }}>
                        <span style={{ fontSize: '0.75rem', width: 24, fontWeight: 600 }}>{a}</span>
                        <input className="input" type="number" style={{ width: 45, padding: '2px 4px', fontSize: '0.75rem', textAlign: 'center' }} 
                          value={divinationOverrideStats[a] || ''} 
                          onChange={e => setDivinationOverrideStats({ ...divinationOverrideStats, [a]: parseInt(e.target.value) || 0 })} 
                          placeholder="0" />
                      </div>
                    ))}
                  </div>
                </div>
              </div>`;

const newUiBlock = `              <div style={{ marginTop: 'var(--space-md)', paddingTop: 'var(--space-md)', borderTop: '1px solid var(--border-color)' }}>
                <h4 style={{ marginBottom: 'var(--space-sm)' }}>Automated Mechanical Effects</h4>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: 'var(--space-sm)' }}>
                  This divination's mechanics have been automatically applied to your character sheet.
                </p>
                {parsedDiv && parsedDiv.choices.length > 0 && (
                  <div style={{ marginTop: 'var(--space-md)' }}>
                    <h5 style={{ marginBottom: 'var(--space-xs)' }}>Make a Choice:</h5>
                    {parsedDiv.choices.map((choice: any) => (
                      <div key={choice.id} style={{ marginBottom: 'var(--space-sm)' }}>
                        <select 
                          className="input" 
                          value={divinationChoicesState[choice.id] || 0}
                          onChange={(e) => setDivinationChoicesState(prev => ({ ...prev, [choice.id]: parseInt(e.target.value) }))}
                        >
                          {choice.options.map((opt: any, idx: number) => (
                            <option key={idx} value={idx}>{opt.label}</option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                )}
              </div>`;

content = content.replace(oldUiBlock, newUiBlock);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Patch complete.');
