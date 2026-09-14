import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE_PATH ?? 'playwright');
const output = resolve('docs/scenery-verification');
mkdirSync(output, { recursive: true });
const browser = await chromium.launch({ headless: true,
  executablePath: process.env.CHROME_EXECUTABLE ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
async function inspect(page) {
  return page.evaluate(async () => {
    const url = performance.getEntriesByType('resource').map(r => r.name).find(x => x.includes('/@react-three_fiber.js'));
    const { _roots } = await import(url);
    const state = _roots.get(document.querySelector('canvas')).store.getState();
    const group = state.scene.getObjectByName('OptionalWinterScenery');
    const { isGameFocused } = await import('/src/player/gameFocus.ts');
    return { id: group?.uuid, focused: isGameFocused(),
      meshes: group?.children.map(mesh => ({id: mesh.uuid, count: mesh.count, visible: mesh.visible})),
      playOverlay: !!document.querySelector('.game-pause-overlay'), loading: !!document.querySelector('.loading-screen') };
  });
}
try {
  for (const mobile of [false, true]) {
    const page = await browser.newPage({ viewport: mobile ? {width:390,height:844} : {width:1440,height:900}, isMobile:mobile, hasTouch:mobile });
    const profile = mobile ? 'mobile' : 'desktop', errors = [], requests = [];
    page.on('console', m => { if(m.type()==='error') errors.push(m.text()); });
    page.on('pageerror', e => errors.push(String(e)));
    page.on('request', r => { if(r.url().includes('/images/scenery/')) requests.push(r.url()); });
    let releaseTexture, textureRequested;
    const hold = new Promise(resolve => { releaseTexture = resolve; });
    const received = new Promise(resolve => { textureRequested = resolve; });
    await page.route('**/images/scenery/rock-normal.webp', async route => { textureRequested(); await hold; await route.continue(); });
    await page.goto(process.env.GAME_TEST_URL ?? 'http://127.0.0.1:5173/');
    await page.getByRole('button',{name:'StudioCLTD',exact:true}).click();
    await Promise.race([received, new Promise((_, reject)=>setTimeout(()=>reject(Error('Scenery never requested during startup')),45000))]);
    await page.waitForTimeout(1500);
    assert(await page.locator('.loading-screen').isVisible(),'loading remains visible while scenery is pending');
    releaseTexture();
    await page.waitForFunction(()=>!document.querySelector('.loading-screen'),{}, {timeout:90000});
    const before = await inspect(page);
    assert(before.id && before.playOverlay && !before.focused,'scenery mounted before first Play');
    assert(before.meshes.some(mesh=>mesh.visible&&mesh.count>0),'paused first render has visible instances');
    assert.equal(requests.length,5,'all scenery textures loaded before Play');
    await page.screenshot({path:`${output}/${profile}-before-play.png`});
    if(mobile){ await page.setViewportSize({width:844,height:390}); await page.waitForTimeout(500); await page.screenshot({path:`${output}/mobile-landscape-before-play.png`}); }
    const snapshots = {before};
    for(const event of ['escape','pointerlock','blur']) {
      await page.getByRole('button',{name:'Click to Play',exact:true}).click();
      await page.waitForTimeout(300);
      assert.equal((await inspect(page)).focused,true);
      if(event==='escape')await page.keyboard.press('Escape');
      else if(event==='blur')await page.evaluate(()=>window.dispatchEvent(new Event('blur')));
      else await page.evaluate(()=>{ document.exitPointerLock?.(); document.dispatchEvent(new Event('pointerlockchange')); });
      await page.waitForTimeout(300);
      snapshots[event]=await inspect(page);
      assert.equal(snapshots[event].id,before.id,'same scenery group survives pause');
      assert.deepEqual(snapshots[event].meshes.map(mesh=>mesh.id),before.meshes.map(mesh=>mesh.id),'no remounted batches');
      assert.equal(snapshots[event].focused,false);
      assert(snapshots[event].meshes.some(mesh=>mesh.visible&&mesh.count>0));
    }
    assert.equal(requests.length,5,'Play/pause never reloads scenery textures');
    assert.deepEqual(errors,[],'no browser/shader errors');
    writeFileSync(`${output}/${profile}-startup.json`,JSON.stringify({snapshots,requests,errors},null,2));
    console.log(`${profile}: delayed texture held loading screen; scenery visible before Play; same instance batches survived Escape, pointer-lock loss and blur; no reloads or shader errors.`);
    await page.close();
  }
} finally { await browser.close(); }
