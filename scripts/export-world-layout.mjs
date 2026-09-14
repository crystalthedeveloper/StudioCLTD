import { readFileSync, writeFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
function load(path, deps = {}) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(readFileSync(path,'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,
    {exports, require:id=>deps[id]});
  return exports;
}
const sections=load('src/world/hubSections.ts');
const layout=load('src/world/worldLayout.ts',{'./hubSections':sections});
const sx=x=>440+x*4, sy=z=>520+z*4;
const svg=['<svg xmlns="http://www.w3.org/2000/svg" width="880" height="890" viewBox="0 0 880 890">',
'<rect width="880" height="890" fill="#101b28"/>',
'<g font-family="Arial,sans-serif" fill="#e7eef4"><text x="34" y="35" font-size="24">StudioCLTD · Phase one layout</text><text x="34" y="60" font-size="14">Actual section footprints and paths · north ↑ · no additional scenery</text></g>',
`<rect x="${sx(-86)}" y="${sy(-114)}" width="688" height="736" rx="8" fill="#283844"/>`,
`<circle cx="${sx(0)}" cy="${sy(0)}" r="72" fill="#8398a5"/>`];
for(const route of layout.walkingRoutes) svg.push(`<polyline points="${route.map(([x,z])=>`${sx(x)},${sy(z)}`).join(' ')}" fill="none" stroke="#8398a5" stroke-width="28" stroke-linecap="round" stroke-linejoin="round"/>`);
for(const s of sections.hubSections){
 const [x,h,z]=s.position,[dx,dz]=s.entrance;
 svg.push(`<line x1="${sx(x+dx*14)}" y1="${sy(z+dz*14)}" x2="${sx(x+dx*28)}" y2="${sy(z+dz*28)}" stroke="#d3dce2" stroke-width="16.8"/>`);
 svg.push(`<rect x="${sx(x-14)}" y="${sy(z-14)}" width="112" height="112" rx="5" fill="#384c5b" stroke="${s.color}" stroke-width="2"/>`);
 const words=s.name==='Site Improvement'?['Site','Improvement']:[s.name];
 words.forEach((word,i)=>svg.push(`<text x="${sx(x)}" y="${sy(z)-5+i*16}" text-anchor="middle" fill="#fff" font-family="Arial,sans-serif" font-size="13">${word}</text>`));
 svg.push(`<text x="${sx(x)}" y="${sy(z)+33}" text-anchor="middle" fill="#b9cbd6" font-family="Arial,sans-serif" font-size="11">Height ${h}</text>`);
}
for(const [x,,z] of layout.routePowerPositions) svg.push(`<circle cx="${sx(x)}" cy="${sy(z)}" r="3" fill="#55baff"/>`);
for(const [id,[x,z]] of Object.entries(layout.routePickupPositions)) if(id.startsWith('coin')||id.startsWith('dark')) svg.push(`<circle cx="${sx(x)}" cy="${sy(z)}" r="3" fill="${id.startsWith('dark')?'#fa6771':'#78c179'}"/>`);
svg.push(`<g font-family="Arial,sans-serif" text-anchor="middle" fill="#101b28"><text x="${sx(0)}" y="${sy(-4)}" font-size="13">Central plaza</text><text x="${sx(0)}" y="${sy(1)}" font-size="11">Transport hub</text><text x="${sx(0)}" y="${sy(10)}" font-size="11">Spawn</text></g>`);
svg.push(`<circle cx="${sx(12)}" cy="${sy(0)}" r="5" fill="#facc15"/><text x="${sx(16)}" y="${sy(-8)}" font-size="11" font-family="Arial,sans-serif" fill="#facc15">Home Base portal</text>`);
svg.push('<g font-family="Arial,sans-serif" font-size="13" fill="#d4e0e8"><text x="34" y="835">West: introductory district · East: challenge route · North: Value / Showcase overlook</text><text x="34" y="858">Blue: powers · Green: Cash · Red: health · Pickup markers show intended route positions.</text><text x="34" y="878">Pickup clearance resolution can shift markers slightly. Home Base remains a separate destination.</text></g></svg>');
writeFileSync('docs/phase-one-layout.svg',svg.join('\n'));
console.log('Wrote docs/phase-one-layout.svg');
