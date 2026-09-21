import assert from 'node:assert/strict';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE_PATH ?? 'playwright');
const manifest = JSON.parse(readFileSync('src/world/screen-assets.json', 'utf8'));
const output = process.env.SMOKE_QA_OUTPUT ?? '/private/tmp/studiocltd-smoke-qa';
mkdirSync(output, { recursive: true });
const browser = await chromium.launch({ headless: true,
  executablePath: process.env.CHROME_EXECUTABLE ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const reports = [];
try {
  for (const mobile of [true, false]) {
    const page = await browser.newPage({ viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 }, isMobile: mobile, hasTouch: mobile });
    const errors = [];
    page.on('pageerror', error => errors.push(String(error)));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    const start = async () => {
      await page.getByRole('button', { name: 'StudioCLTD', exact: true }).click();
      await page.waitForFunction(() => !document.querySelector('.loading-screen'), {}, { timeout: 90000 });
      await page.getByRole('button', { name: 'Click to Play', exact: true }).click();
      // Exercise all screen textures through the actual loader; mobile stays lazy in production.
      await page.evaluate(async () => (await import('/src/world/systems/HubSections.tsx')).preloadScreenTextures());
    };
    const inspect = () => page.evaluate(async () => {
      const fiber = performance.getEntriesByType('resource').map(r => r.name).find(url => url.includes('/@react-three_fiber.js'));
      const { _roots } = await import(fiber);
      const state = _roots.get(document.querySelector('canvas')).store.getState();
      const mesh = state.scene.getObjectByName('Player smoke orb').children[0];
      const removedPickups = [];
      state.scene.traverse(object => { if (/^(PlazaLogo:speed-|PowerSmoke:speed)/.test(object.name)) removedPickups.push(object.name); });
      return {
        images: performance.getEntriesByType('resource').filter(r => r.name.includes('/images/screens/')).map(r => new URL(r.name).pathname).sort(),
        legacyImages: performance.getEntriesByType('resource').filter(r => /\/images\/(mobile|optimized)\/(offers|quickFix|urgentFix|performance|siteImprovement|tips|values)\//.test(r.name)).map(r => r.name),
        removedPickups,
        groundParticles: state.scene.getObjectByName("Player ground puffs")?.count,
        count: mesh.geometry.instanceCount, textureSize: mesh.material.uniforms.uSmoke.value.image.width,
        serviceWorkers: (await navigator.serviceWorker.getRegistrations()).length,
      };
    });
    await page.goto(process.env.GAME_TEST_URL ?? 'http://127.0.0.1:5180/');
    await start();
    const first = await inspect();
    const expected = Object.values(manifest).map(image => image[mobile ? 'mobile' : 'desktop'].url).sort();
    assert.deepEqual(first.images, expected, 'all screens request current correctly-sized hashed images');
    assert.deepEqual(first.legacyImages, []);
    assert.deepEqual(first.removedPickups, []);
    assert.equal(await page.getByRole('progressbar', { name: 'Speed boost time remaining' }).count(), 0);
    assert.equal(first.count, mobile ? 12 : 24);
    assert.equal(first.groundParticles, mobile ? 12 : 24);
    assert.equal(first.textureSize, mobile ? 64 : 128);
    const hud = await page.evaluate(() => {
      const rows = [...document.querySelectorAll('.game-hud__effect-hub .game-hud__power-bar')];
      return { rows: rows.map(row => { const box = row.getBoundingClientRect(); return { text: row.textContent.trim(), x: box.x, y: box.y, width: box.width, height: box.height }; }),
        bottomPowers: document.querySelectorAll('.game-hud__bottom .game-hud__power-bar').length,
        arrows: document.querySelectorAll('.direction-controls__button').length,
        jump: document.querySelectorAll('.game-hud__bottom .game-hud__fix').length };
    });
    assert.equal(hud.rows.length, 3);
    ['Wind', 'Shock', 'Fire'].forEach((name, i) => {
      assert(hud.rows[i].text.includes(name));
      assert.equal(hud.rows[i].x, hud.rows[0].x, 'one vertical column');
      if (i) assert(hud.rows[i].y >= hud.rows[i - 1].y + hud.rows[i - 1].height, 'timers do not overlap');
    });
    assert.equal(hud.bottomPowers, 0); assert.equal(hud.arrows, 6); assert.equal(hud.jump, 1);
    await page.screenshot({ path: `${output}/${mobile ? 'mobile' : 'desktop'}-idle.png` });
    await page.getByRole('button', { name: 'Open game guide', exact: true }).click();
    const guide = page.getByRole('dialog');
    const guideText = await guide.textContent();
    assert(!/Speed|Yellow Logo/.test(guideText), 'guide has no separate boost system');
    for (const title of ['How to Play', 'Controls', 'Powers', 'World Pickups']) {
      const toggle = guide.getByRole('button', { name: title, exact: true });
      if (await toggle.getAttribute('aria-expanded') !== 'true') await toggle.click();
      assert(await guide.getByRole('region', { name: title, exact: true }).isVisible());
    }
    assert(guideText.includes('last active Power expires'));
    await guide.getByRole('button', { name: 'Close game guide', exact: true }).last().click();
    // A normal refresh, with browser caching still enabled (no request interception).
    await page.reload();
    await start();
    const refreshed = await inspect();
    assert.deepEqual(refreshed.images, expected, 'normal refresh retains newest images');
    const decoded = await page.evaluate(async urls => Promise.all(urls.map(async url => {
      const image = new Image(); image.src = url; await image.decode();
      return { url, width: image.naturalWidth, height: image.naturalHeight };
    })), expected);
    assert(decoded.every(image => Math.max(image.width, image.height) <= (mobile ? 768 : 1536)));
    const colours = await page.evaluate(async () => {
      const moduleUrl = path => performance.getEntriesByType('resource').map(r => r.name).find(url => url.includes(path)) ?? path;
      (await import(moduleUrl('/src/player/gameFocus.ts'))).setGameFocused(true);
      const powers = await import(moduleUrl('/src/player/temporaryPowers.ts'));
      powers.powerOrder.forEach(powers.collectFixPower);
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const fiber = performance.getEntriesByType('resource').map(r => r.name).find(url => url.includes('/@react-three_fiber.js'));
      const { _roots } = await import(fiber);
      const state = _roots.get(document.querySelector('canvas')).store.getState();
      const uniforms = state.scene.getObjectByName('Player smoke orb').children[0].material.uniforms;
      return { count: uniforms.uColorCount.value, palette: uniforms.uColors.value.map(color => color.getHexString()) };
    });
    assert.equal(colours.count, 3, JSON.stringify({colours, errors}));
    assert.deepEqual(colours.palette, ['009b3a', 'fed100', 'ce1126']);
    await page.screenshot({ path: `${output}/${mobile ? 'mobile' : 'desktop'}-all-colours.png` });
    // Use the existing transport callback to reach Offers without changing game code.
    await page.evaluate(async () => {
      const fiber = performance.getEntriesByType('resource').map(r => r.name).find(url => url.includes('/@react-three_fiber.js'));
      const { _roots } = await import(fiber);
      const state = _roots.get(document.querySelector('canvas')).store.getState();
      const findTransport = node => {
        if (!node) return null;
        if (node.memoizedProps?.label === 'Offers' && typeof node.memoizedProps?.onEnter === 'function') return node.memoizedProps.onEnter;
        return findTransport(node.child) ?? findTransport(node.sibling);
      };
      const transport = findTransport(_roots.get(document.querySelector('canvas')).fiber.current);
      if (!transport) throw new Error('Offers transport callback missing');
      transport({ other: { rigidBodyObject: state.scene.getObjectByName('StudioCLTDPlayer') } });
    });
    await page.waitForFunction(async () => {
      const fiber = performance.getEntriesByType('resource').map(r => r.name).find(url => url.includes('/@react-three_fiber.js'));
      const { _roots } = await import(fiber);
      return !!_roots.get(document.querySelector('canvas')).store.getState().scene.getObjectByName('OfferScreen:enterprise');
    });
    await page.waitForTimeout(1800);
    const offers = await page.evaluate(async () => {
      const fiber = performance.getEntriesByType('resource').map(r => r.name).find(url => url.includes('/@react-three_fiber.js'));
      const { _roots } = await import(fiber);
      const state = _roots.get(document.querySelector('canvas')).store.getState();
      const screens = [], pads = [];
      state.scene.traverse(object => {
        if (object.name.startsWith('OfferPortal:')) pads.push({ name: object.name, position: object.position.toArray() });
        if (object.name.startsWith('OfferScreen:')) {
          const image = object.children[1]; const texture = image.material.map;
          screens.push({ name: object.name, url: texture?.image.src, repeat: texture?.repeat.toArray(),
            imageAspect: texture?.image.width / texture?.image.height,
            meshAspect: image.geometry.parameters.width * image.scale.x / (image.geometry.parameters.height * image.scale.y) });
        }
      });
      return { pads, screens };
    });
    assert.equal(offers.pads.length, 8); assert.equal(offers.screens.length, 8);
    for (const screen of offers.screens) {
      assert(screen.url.includes(`/images/screens/offers-${screen.name.split(':')[1]}-`));
      assert.deepEqual(screen.repeat, [1, 1], 'offer artwork is not cropped');
      assert(Math.abs(screen.imageAspect - screen.meshAspect) < 0.00001, 'offer artwork is not stretched');
    }
    // Capture the actual offer material close up, then restore the gameplay camera.
    const offerImage = await page.evaluate(async () => {
      const fiber = performance.getEntriesByType('resource').map(r => r.name).find(url => url.includes('/@react-three_fiber.js'));
      const { _roots } = await import(fiber);
      const state = _roots.get(document.querySelector('canvas')).store.getState();
      const screen = state.scene.getObjectByName('OfferScreen:1hour');
      const cameraPosition = state.camera.position.clone(), cameraRotation = state.camera.quaternion.clone();
      const center = screen.getWorldPosition(cameraPosition.clone());
      const rotation = screen.getWorldQuaternion(cameraRotation.clone());
      const normal = cameraPosition.clone().set(0, 0, 1).applyQuaternion(rotation);
      state.camera.position.copy(center).addScaledVector(normal, 12);
      state.camera.lookAt(center); state.camera.updateMatrixWorld();
      state.gl.render(state.scene, state.camera);
      const png = state.gl.domElement.toDataURL('image/png');
      state.camera.position.copy(cameraPosition); state.camera.quaternion.copy(cameraRotation);
      state.camera.updateMatrixWorld();
      return png;
    });
    writeFileSync(`${output}/${mobile ? 'mobile' : 'desktop'}-offer-detail.png`, Buffer.from(offerImage.split(',')[1], 'base64'));
    await page.screenshot({ path: `${output}/${mobile ? 'mobile' : 'desktop'}-offers.png` });
    assert.deepEqual(errors, [], 'no runtime or shader errors');
    reports.push({ profile: mobile ? 'mobile' : 'desktop', first, refreshed, decoded, colours, hud, offers, errors });
    console.log(`${mobile ? 'Mobile' : 'Desktop'} passed: ${expected.length} current images before/after normal refresh, correct size, three smoke colours and no shader errors.`);
    await page.close();
  }
  writeFileSync(`${output}/report.json`, JSON.stringify(reports, null, 2));
} finally { await browser.close(); }
