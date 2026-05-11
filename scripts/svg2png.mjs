import { Resvg } from '@resvg/resvg-js';
import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

const input  = resolve(root, 'public/logo-315x175.svg');
const output = resolve(root, 'public/logo-315x175.png');

const svg = readFileSync(input, 'utf-8');

const resvg = new Resvg(svg, {
  fitTo: { mode: 'original' },        // 按 SVG 原始尺寸导出（315×175）
  font: { loadSystemFonts: false },
});

const pngData = resvg.render();
const pngBuffer = pngData.asPng();

writeFileSync(output, pngBuffer);
console.log(`✅ 已生成 PNG：${output}`);
console.log(`   尺寸：${pngData.width} × ${pngData.height} px`);
