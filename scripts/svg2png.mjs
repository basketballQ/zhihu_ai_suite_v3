import { Resvg } from '@resvg/resvg-js';
import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

const input  = resolve(root, 'public/logo-315x175.svg');
const output = resolve(root, 'public/logo.png');

const svg = readFileSync(input, 'utf-8');

const resvg = new Resvg(svg, {
  fitTo: { mode: 'width', value: 315 },
  font: { loadSystemFonts: false },   // 不加载系统字体，避免平台差异
});

const pngData = resvg.render();
const pngBuffer = pngData.asPng();

writeFileSync(output, pngBuffer);
console.log(`✅ 已生成 PNG：${output}`);
console.log(`   尺寸：${pngData.width} × ${pngData.height} px`);
