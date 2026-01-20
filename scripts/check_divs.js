import fs from 'fs';
import path from 'path';
const file = process.argv[2] || path.join(process.cwd(), 'client', 'src', 'pages', 'resident', 'Playground.tsx');
const src = fs.readFileSync(file, 'utf8');
let line = 1, col = 0;
let i = 0;
let state = { inSingle: false, inDouble: false, inBack: false, inLineComment: false, inBlockComment: false };
let stack = [];
const push = (tag) => stack.push({tag, line, col});
const pop = (tag) => {
  const top = stack.pop();
  if (!top) {
    console.log(`Extra closing </${tag}> at ${file}:${line}:${col}`);
    return false;
  }
  return true;
}

while (i < src.length) {
  const c = src[i];
  col++;
  if (c === '\n') { line++; col = 0; state.inLineComment = false; i++; continue; }
  if (state.inLineComment) { i++; continue; }
  if (state.inBlockComment) {
    if (c === '*' && src[i+1] === '/') { state.inBlockComment = false; i+=2; col+=1; continue; }
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

  // look for <div (start) or </div>
  if (c === '<') {
    if (src.substr(i,6) === '</div>') {
      // closing div
      pop('div');
      i += 6; col += 5; continue;
    } else if (/^<div[\s>]/.test(src.substr(i))) {
      push('div');
      // advance until end of tag
      const end = src.indexOf('>', i);
      if (end === -1) break;
      col += (end - i);
      i = end + 1;
      continue;
    }
  }
  i++;
}
if (stack.length > 0) {
  console.log('Unclosed <div> tags:');
  stack.forEach(s => console.log(`<${s.tag}> opened at ${file}:${s.line}:${s.col}`));
} else {
  console.log('All <div> tags balanced.');
}
