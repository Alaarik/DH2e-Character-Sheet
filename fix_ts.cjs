const fs = require('fs');
let code = fs.readFileSync('src/components/AdvancementTab.tsx', 'utf-8');

code = code.replace(/const \[confirmPurchase, setConfirmPurchase\] = useState<\{ type: string; name: string; level: string; cost: number; callback: \(isFree\?: boolean, reason\?: string\) => void \} \| null>\(null\);/g, `const [confirmPurchase, setConfirmPurchase] = useState<{ type: string; name: string; level: string; cost: number; updates: Partial<CharacterFull> } | null>(null);`);

// Replace remaining xpPurchases
code = code.replace(/const updatedPurchases = xpPurchases\.filter/g, 'const updatedPurchases = savedPurchases.filter');
code = code.replace(/xp_purchases: xpPurchases\.filter/g, 'xp_purchases: savedPurchases.filter');
code = code.replace(/const purchase = xpPurchases\.find/g, 'const purchase = savedPurchases.find');

// Fix mergedSkills.push missing properties
code = code.replace(/advances: 0,\s*modifier: 0,\s*is_custom: 0,\s*aptitude_1: null,\s*aptitude_2: null\s*}\);/g, `advances: 0,
                modifier: 0,
                is_custom: 0,
                aptitude_1: null,
                aptitude_2: null,
                talent: 0,
                trained: false,
                plus_10: false,
                plus_20: false,
                plus_30: false,
                total: 0
              });`);

code = code.replace(/onUpdateCharacter\(/g, 'update(');

// In newSkill creation for adding custom skill
code = code.replace(/is_custom: 1,\s*aptitude_1: null,\s*aptitude_2: null\s*};/g, `is_custom: 1,
                    aptitude_1: null,
                    aptitude_2: null,
                    talent: 0,
                    trained: false,
                    plus_10: false,
                    plus_20: false,
                    plus_30: false,
                    total: 0
                  };`);

fs.writeFileSync('src/components/AdvancementTab.tsx', code);
