const fs = require('fs');
const path = require('path');

const filePath = path.join('C:', 'Users', 'kyleb', '.gemini', 'antigravity', 'scratch', 'char-sheet', 'src', 'components', 'ChargenWizard.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Add Import
if (!content.includes('parseDivinationEffect')) {
  content = content.replace(
    "import { CHARACTERISTIC_APTITUDES } from '../data/advancementData';",
    "import { CHARACTERISTIC_APTITUDES } from '../data/advancementData';\nimport { parseDivinationEffect, ParsedDivination } from '../data/divinationParser';"
  );
  // Also import useMemo if missing
  if (!content.includes('useMemo')) {
    content = content.replace("import { useState, useEffect }", "import { useState, useEffect, useMemo }");
  }
}

// 2. Replace State Variables
const stateRegex = /const \[divinationOverrideStats.*?useState<string>\(''\);/s;
content = content.replace(stateRegex, 
`const [burnedFateForDivination, setBurnedFateForDivination] = useState<boolean>(false);
  const [divinationChoicesState, setDivinationChoicesState] = useState<Record<string, number>>({});`);
  
// Fix divinationOverrideFate state which is slightly separate (it was line 109, others were 107-113)
// Wait, my regex above might not catch it perfectly. Let's do exact replacements.

content = content.replace('const [divinationOverrideStats, setDivinationOverrideStats] = useState<Record<string, number>>({});', '');
content = content.replace('const [divinationOverrideWounds, setDivinationOverrideWounds] = useState<number>(0);', '');
content = content.replace('const [divinationOverrideFate, setDivinationOverrideFate] = useState<number>(0);', 'const [burnedFateForDivination, setBurnedFateForDivination] = useState<boolean>(false);\n  const [divinationChoicesState, setDivinationChoicesState] = useState<Record<string, number>>({});');
content = content.replace('const [divinationOverrideInsanity, setDivinationOverrideInsanity] = useState<number>(0);', '');
content = content.replace('const [divinationOverrideCorruption, setDivinationOverrideCorruption] = useState<number>(0);', '');
content = content.replace("const [divinationOverrideSkills, setDivinationOverrideSkills] = useState<string>('');", '');
content = content.replace("const [divinationOverrideTalents, setDivinationOverrideTalents] = useState<string>('');", '');

// 3. Add useMemo parsedDiv block
// Let's inject it right after step validations, around line 668:
const insertPoint = `  // Allow generating character`;
const parsedDivLogic = `
  const currentSkills = useMemo(() => {
    const s = new Set<string>();
    [...parsedHwSkills.auto, ...parsedBgSkills.auto, ...parsedRoleSkills.auto].forEach(x => s.add(x.toLowerCase()));
    Object.values(geSkillChoices).forEach(x => s.add((x as string).toLowerCase()));
    // Also include EA skills
    selectedEliteAdvances.forEach(eaName => {
      const ea = eliteAdvancesData.find((e: any) => e.name === eaName);
      if (ea && ea.skills) {
        const parsedEa = parseChoiceString(ea.skills);
        parsedEa.auto.forEach(x => s.add(x.toLowerCase()));
      }
    });
    return s;
  }, [parsedHwSkills, parsedBgSkills, parsedRoleSkills, geSkillChoices, selectedEliteAdvances, eliteAdvancesData]);

  const currentTalents = useMemo(() => {
    const t = new Set<string>();
    [...parsedHwTalents.auto, ...parsedBgTalents.auto, ...parsedRoleTalents.auto].forEach(x => t.add(x.toLowerCase()));
    selectedEliteAdvances.forEach(eaName => {
      const ea = eliteAdvancesData.find((e: any) => e.name === eaName);
      if (ea && ea.talents) {
        const parsedEa = parseChoiceString(ea.talents);
        parsedEa.auto.forEach(x => t.add(x.toLowerCase()));
      }
    });
    return t;
  }, [parsedHwTalents, parsedBgTalents, parsedRoleTalents, selectedEliteAdvances, eliteAdvancesData]);

  const parsedDiv = useMemo(() => {
    if (!divinationRolled) return null;
    const base = parseDivinationEffect(divinationRolled.effect);
    
    // Resolve Conditionals
    for (const cond of base.conditionalAdditions) {
       let matched = false;
       if (cond.requireSkill) {
          matched = cond.requireSkill.some(s => currentSkills.has(s.toLowerCase()));
       }
       if (cond.requireTalent) {
          matched = cond.requireTalent.some(t => currentTalents.has(t.toLowerCase()));
       }
       
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
  }, [divinationRolled, currentSkills, currentTalents]);

  // Allow generating character`;
content = content.replace(insertPoint, parsedDivLogic);

// 4. Update handleFinish
// Line 306: finalFate
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

// Apply Divination stats & skills in handleFinish
// Let's inject after FEL logic:
const statInsertPoint = `    finalStats.FEL = (finalStats.FEL || 0) - 3;`;
const divStatsAndSkillsLogic = `    finalStats.FEL = (finalStats.FEL || 0) - 3;
    
    // Apply Divination Stats & Skills/Talents
    if (parsedDiv) {
      // Base stats
      for (const [abbrev, mod] of Object.entries(parsedDiv.statMods)) {
        if (finalStats[abbrev] !== undefined) finalStats[abbrev] += mod;
      }
      // Base skills
      for (const s of parsedDiv.skills) skillSet.set(s, resolveSkill(s));
      // Base talents
      for (const t of parsedDiv.talents) {
        if (!talentList.find(x => x.name.toLowerCase() === t.toLowerCase())) {
          talentList.push({ name: t, specialisation: null, tier: 1 });
        }
      }
      // Resolved Choices
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

// Remove the old divination override talent logic block
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

// 5. Update UI rendering
// Replace setDivinationOverrideFate(-1) with setBurnedFateForDivination(true)
content = content.replace('setDivinationOverrideFate(-1)', 'setBurnedFateForDivination(true)');
content = content.replace('setDivinationOverrideFate(0)', 'setBurnedFateForDivination(false)');
content = content.replace("{divinationOverrideFate === -1 && '⚠ You burned 1 Fate Point to choose this divination.'}", "{burnedFateForDivination && '⚠ You burned 1 Fate Point to choose this divination.'}");

// Remove the manual inputs block completely and replace with Choice Dropdowns
const oldUIBlockStart = `<div style={{ marginTop: 'var(--space-md)', paddingTop: 'var(--space-md)', borderTop: '1px solid var(--border-color)' }}>
                <h4 style={{ marginBottom: 'var(--space-sm)' }}>Apply Mechanical Effects</h4>`;
const newUIBlock = `<div style={{ marginTop: 'var(--space-md)', paddingTop: 'var(--space-md)', borderTop: '1px solid var(--border-color)' }}>
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
              </div>
            </div>`;

// Delete everything from oldUIBlockStart up to the final </div></div> of the Divination section
// We can just use a regex
const uiRegex = /<div style={{ marginTop: 'var\(--space-md\)', paddingTop: 'var\(--space-md\)', borderTop: '1px solid var\(--border-color\)' }}>.*?Apply Mechanical Effects.*?<\/div>\s*<\/div>\s*<\/div>/s;
content = content.replace(uiRegex, newUIBlock);

// Don't forget to delete the other setState clearings for overrides!
content = content.replace('setDivinationOverrideStats({});', 'setDivinationChoicesState({});');
content = content.replace("setDivinationOverrideSkills('');", '');
content = content.replace("setDivinationOverrideTalents('');", '');
content = content.replace('setDivinationOverrideInsanity(0);', '');
content = content.replace('setDivinationOverrideCorruption(0);', '');
content = content.replace('setDivinationOverrideWounds(0);', '');

fs.writeFileSync(filePath, content, 'utf8');
console.log('Patch complete.');
