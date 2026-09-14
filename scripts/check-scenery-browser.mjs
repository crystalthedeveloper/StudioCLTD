import assert from 'node:assert/strict';
import { resolve } from 'node:path';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE_PATH ?? 'playwright');
import { mkdirSync,writeFileSync } from 'node:fs';
const output=resolve('docs/scenery-verification');mkdirSync(output,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_EXECUTABLE ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
for(const mobile of [false,true]){
 const page=await browser.newPage({viewport:mobile?{width:390,height:844}:{width:1440,height:900},isMobile:mobile,hasTouch:mobile});
 const errors=[],assets=[];
 page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});page.on('pageerror',e=>errors.push(String(e)));
 page.on('response',r=>{if(r.url().includes('/images/scenery/'))assets.push({url:r.url(),status:r.status()});});
 await page.goto(process.env.GAME_TEST_URL ?? 'http://127.0.0.1:5173/');await page.getByRole('button',{name:'StudioCLTD',exact:true}).click();
 await page.waitForFunction(()=>!document.querySelector('.loading-screen'),{},{timeout:60000});
 await page.getByRole('button',{name:'Click to Play',exact:true}).click();
 await page.waitForTimeout(9000);
 const info=await page.evaluate(async()=>{
  const url=performance.getEntriesByType('resource').map(r=>r.name).find(x=>x.includes('/@react-three_fiber.js'));
  if(!url)return {error:'fiber resource missing'};
  const {_roots}=await import(url);const state=_roots.get(document.querySelector('canvas')).store.getState();
  const group=state.scene.getObjectByName('OptionalWinterScenery');const batches=[];
  group?.traverse(o=>{if(o.isInstancedMesh)batches.push({count:o.count,visible:o.visible,castShadow:o.castShadow,box:o.boundingSphere?.radius});});
  return {mounted:!!group,camera:state.camera.position.toArray(),mobile:matchMedia('(pointer: coarse), (max-width: 768px)').matches,batches};
 });
 await page.screenshot({path:`${output}/${mobile?'mobile':'desktop'}-plaza.png`});
 if(mobile){await page.setViewportSize({width:844,height:390});await page.waitForTimeout(2500);await page.screenshot({path:`${output}/mobile-landscape-plaza.png`});}
 const result={info,errors,assets};console.log(JSON.stringify({profile:mobile?'mobile':'desktop',...result}));
 writeFileSync(`${output}/${mobile?'mobile':'desktop'}-runtime.json`,JSON.stringify(result,null,2));
 assert.equal(info.mounted,true,'scenery is mounted in the live Three scene');
 assert.equal(info.mobile,mobile,'device budget matches the browser profile');
 assert(info.batches.filter(batch=>batch.visible&&batch.count>0).length>=3,'multiple batches render');
 assert.equal(assets.length,5);
 assert(assets.every(asset=>asset.status===200));
 assert.deepEqual(errors,[],'no browser or shader errors');
 await page.close();
}
await browser.close();
