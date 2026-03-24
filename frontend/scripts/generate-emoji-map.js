const fs = require('fs');
const path = require('path');
const root = path.join('chatx-frontend');
const componentsDir = path.join(root, 'node_modules', '@souhaildev', 'reactemojis', 'src', 'components');
const indexPath = path.join(componentsDir, 'index.tsx');
const indexContent = fs.readFileSync(indexPath, 'utf8');
const regex = /if \(emoji === '([^']+)'\) \{\s+const Emoji = lazy\(\(\) => import\('\.\/([^']+)'\)\)/g;
const emojiToComponent = {};
let match;
while ((match = regex.exec(indexContent)) !== null) {
  const emoji = match[1];
  const component = match[2];
  emojiToComponent[emoji] = component;
}
const componentToVariants = {};
const componentFiles = fs.readdirSync(componentsDir).filter((file) => file.endsWith('.tsx') && file !== 'index.tsx');
const importRegex = /import\s+emoji\d+\s+from\s+"\.\.\/animations\/([^\/]+)\/(\d+)\.json"/g;
for (const file of componentFiles) {
  const name = file.replace(/\.tsx$/, '');
  const content = fs.readFileSync(path.join(componentsDir, file), 'utf8');
  const variants = [];
  let importMatch;
  while ((importMatch = importRegex.exec(content)) !== null) {
    const animFolder = importMatch[1];
    const variant = importMatch[2];
    const importPath = `@souhaildev/reactemojis/src/animations/${animFolder}/${variant}.json`;
    variants.push(importPath);
  }
  if (variants.length === 0) {
    console.warn('No variants found for', name);
  }
  componentToVariants[name] = variants;
}
const entries = Object.entries(emojiToComponent);
entries.sort((a, b) => a[0].localeCompare(b[0]));
const lines = [];
lines.push('// Auto-generated from @souhaildev/reactemojis. Do not edit manually.');
lines.push('// Run scripts/generate-emoji-map.js to regenerate.');
lines.push('export const EMOJI_ANIMATION_MAP = {');
for (const [emoji, component] of entries) {
  const loaders = componentToVariants[component] || [];
  const emojiLiteral = JSON.stringify(emoji);
  lines.push(`  ${emojiLiteral}: {`);
  lines.push(`    component: ${JSON.stringify(component)},`);
  if (loaders.length) {
    lines.push('    loaders: [');
    loaders.forEach((importPath, idx) => {
      const suffix = idx === loaders.length - 1 ? '' : ',';
      lines.push(`      () => import(${JSON.stringify(importPath)})${suffix}`);
    });
    lines.push('    ],');
  } else {
    lines.push('    loaders: [],');
  }
  lines.push('  },');
}
lines.push('};');
lines.push('');
lines.push('export const SUPPORTED_ANIMATED_EMOJIS = Object.keys(EMOJI_ANIMATION_MAP);');
const outPath = path.join(root, 'src', 'components', 'conversation', 'emoji', 'animatedEmojiMap.generated.js');
fs.writeFileSync(outPath, lines.join('\n'), 'utf8');
console.log('Generated', outPath);
