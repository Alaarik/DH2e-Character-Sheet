const fs = require('fs');

const file = 'C:\\Users\\kyleb\\.gemini\\antigravity\\scratch\\char-sheet\\src\\components\\ChargenWizard.tsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Extract parsed skills block
const parsedSkillsMatch = content.match(/(\/\/ Compute parsed values.*?)(const step4Valid =.*?}\);\s+const step5Valid = divinationRolled !== null;)/s);
let parsedSkillsBlock = '';
if (parsedSkillsMatch) {
  parsedSkillsBlock = parsedSkillsMatch[1] + parsedSkillsMatch[2];
  content = content.replace(parsedSkillsBlock, '');
} else {
  // Let's try matching from `const hwAlt = selHomeworld?.eliteAdvanceAlternative;` to `const step5Valid`
  const altMatch = content.match(/(\s*const hwAlt = selHomeworld\?\.eliteAdvanceAlternative;.*?)(const step5Valid = divinationRolled !== null;)/s);
  if (altMatch) {
    parsedSkillsBlock = altMatch[1] + altMatch[2];
    content = content.replace(parsedSkillsBlock, '');
  }
}

// 2. Extract parsedDiv block
const parsedDivMatch = content.match(/(\s*const currentSkills = useMemo[\s\S]*?)(const handleFinish =)/);
let parsedDivBlock = '';
if (parsedDivMatch) {
  parsedDivBlock = parsedDivMatch[1];
  content = content.replace(parsedDivBlock, '');
} else {
  // Maybe it's further down where I injected it before
  const altDivMatch = content.match(/(\s*const currentSkills = useMemo[\s\S]*?)(const step1Valid =|const allHwSkillChoicesMade =|\/\/ Allow generating character)/);
  if (altDivMatch) {
    parsedDivBlock = altDivMatch[1];
    content = content.replace(parsedDivBlock, '');
  }
}

// 3. Inject them BOTH right before `const handleFinish`
if (parsedSkillsBlock && parsedDivBlock) {
  content = content.replace('const handleFinish =', parsedSkillsBlock + '\n\n' + parsedDivBlock + '\n\n  const handleFinish =');
  fs.writeFileSync(file, content, 'utf8');
  console.log('Fixed ordering!');
} else {
  console.log('Could not find blocks.', {
    foundSkills: !!parsedSkillsBlock,
    foundDiv: !!parsedDivBlock
  });
}
