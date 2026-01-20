import fs from 'fs';
import path from 'path';
const file = process.argv[2] || path.join(process.cwd(), 'client', 'src', 'pages', 'resident', 'Playground.tsx');
const src = fs.readFileSync(file, 'utf8');

let stack = [];
let line = 1, col = 0;
let i = 0;
let state = { inSingle: false, inDouble: false, inBack: false, inLineComment: false, inBlockComment: false };

const push = (ch) => stack.push({ch, line, col, idx: i});
const pop = (expected) => {
  const top = stack[stack.length-1];
  if (!top) return null;
  if ((expected === ')' && top.ch === '(') || (expected === '}' && top.ch === '{') || (expected === ']' && top.ch === '[')) {
    return stack.pop();
  }
  return null;
}

while (i < src.length) {
  const c = src[i];
  col++;
  // newlines
  if (c === '\n') { line++; col = 0; state.inLineComment = false; i++; continue; }

  if (state.inLineComment) { i++; continue; }
  if (state.inBlockComment) {
    if (c === '*' && src[i+1] === '/') { state.inBlockComment = false; i += 2; col += 1; continue; }
    i++; continue;
  }

  if (!state.inSingle && !state.inDouble && !state.inBack) {
    if (c === '/' && src[i+1] === '/') { state.inLineComment = true; i+=2; col+=1; continue; }
    if (c === '/' && src[i+1] === '*') { state.inBlockComment = true; i+=2; col+=1; continue; }
  }

  if (!state.inDouble && !state.inBack && c === "'") { state.inSingle = !state.inSingle; i++; continue; }
  if (!state.inSingle && !state.inBack && c === '"') { state.inDouble = !state.inDouble; i++; continue; }
  if (!state.inSingle && !state.inDouble && c === '`') { state.inBack = !state.inBack; i++; continue; }

  if (state.inSingle || state.inDouble || state.inBack) { i++; continue; }

  if (c === '(' || c === '{' || c === '[') push(c);
  else if (c === ')') {
    if (!pop(')')) { console.log(`Unmatched ')' at ${file}:${line}:${col}`); }
  }
  else if (c === '}') {
    if (!pop('}')) { console.log(`Unmatched '}' at ${file}:${line}:${col}`); }
  }
  else if (c === ']') {
    if (!pop(']')) { console.log(`Unmatched ']' at ${file}:${line}:${col}`); }
  }
  i++;
}

if (stack.length === 0) {
  console.log('No unmatched parentheses/braces/brackets found.');
} else {
  console.log('Unclosed openers:');
  stack.forEach(s => console.log(`${s.ch} opened at ${file}:${s.line}:${s.col}`));
}
