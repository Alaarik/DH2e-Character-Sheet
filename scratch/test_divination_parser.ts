import fs from 'fs';
import { parseDivinationEffect } from '../src/data/divinationParser';

const csvText = fs.readFileSync('C:\\Users\\kyleb\\.gemini\\antigravity\\scratch\\char-sheet\\divinations.csv', 'utf8');
const lines = csvText.split('\n');
for (const line of lines) {
  if (!line || line.startsWith('D100')) continue;
  // Parse simple csv line
  const parts: string[] = [];
  let current = '', inQ = false;
  for (const c of line) {
    if (c === '"') inQ = !inQ;
    else if (c === ',' && !inQ) { parts.push(current); current = ''; }
    else current += c;
  }
  parts.push(current);
  const effect = parts[2] || '';
  if (!effect.trim()) continue;
  console.log(`\n--- ${parts[0]} ---`);
  console.log(effect);
  console.log(JSON.stringify(parseDivinationEffect(effect), null, 2));
}
