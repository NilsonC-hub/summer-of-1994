async (page) => {
  page.setDefaultTimeout(60000);
  const target = page.url();
  const errors = [], failedRequests = [], assets = [];
  const onError = error => errors.push(error.message);
  const onFailure = request => failedRequests.push({url:request.url(), error:request.failure()?.errorText});
  const onResponse = response => {
    if (response.url().includes('/assets/')) assets.push({url:response.url(), status:response.status()});
  };
  page.on('pageerror', onError);
  page.on('requestfailed', onFailure);
  page.on('response', onResponse);
  try {
    await page.setViewportSize({width:1600,height:1000});
    await page.goto(target, {waitUntil:'networkidle'});
    await page.waitForFunction(() => window.__DESK__?.state.loaded);
    await page.waitForFunction(() => getComputedStyle(document.querySelector('#loading')).visibility === 'hidden');
    await page.waitForFunction(() => document.fonts.check('16px VT323'));
    await page.screenshot({path:'output/playwright/pages-room.png'});
    await page.getByRole('button', {name:'Enter room',exact:true}).click();
    await page.getByRole('button', {name:'PC power',exact:true}).click();
    await page.getByRole('button', {name:'Monitor power',exact:true}).click();
    await page.waitForFunction(() => window.__DESK__.dos.state.mode === 'dos');
    await page.getByRole('button', {name:'Use computer',exact:true}).click();
    await page.waitForFunction(() => window.__DESK__.state.screenFocused && Math.abs(window.__DESK__.camera.position.x - window.__DESK__.screenCenter.x) < .0001);
    await page.locator('#scene').focus();
    const command = async text => {
      await page.keyboard.type(text);
      await page.keyboard.press('Enter');
    };
    await command('dir');
    const listing = await page.evaluate(() => window.__DESK__.dos.lines.map(line => line.text).join('\n'));
    if (!/MOON\s+GIF/.test(listing) || !/GARAGE\s+GIF/.test(listing)) throw Error('Root directory is missing images');
    const images = [];
    for (const file of ['MOON.GIF','GARAGE.GIF']) {
      await command('view ' + file);
      await page.waitForFunction(() => ['ready','error'].includes(window.__DESK__.dos.state.viewer?.status));
      const image = await page.evaluate(() => ({...window.__DESK__.dos.state.viewer, width:window.__DESK__.dos.viewer.image?.naturalWidth}));
      if (image.status !== 'ready' || !image.width) throw Error('Viewer failed: ' + JSON.stringify(image));
      images.push(image);
      await page.keyboard.press('Escape');
      await page.waitForFunction(() => window.__DESK__.dos.state.mode === 'dos');
    }
    await page.getByRole('button', {name:'Insert disk',exact:true}).click();
    await page.waitForFunction(() => window.__DESK__.state.diskInserted && !window.__DESK__.state.diskMoving);
    await page.locator('#scene').focus();
    await command('a:');
    await command('star');
    await page.waitForFunction(() => window.__DESK__.dos.state.game?.phase === 'title');
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => window.__DESK__.dos.state.game?.phase === 'playing');
    await page.screenshot({path:'output/playwright/pages-game.png'});
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => window.__DESK__.dos.state.game?.phase === 'name');
    await page.keyboard.type('WEB');
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => window.__DESK__.dos.state.game?.phase === 'result');
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => window.__DESK__.dos.state.mode === 'dos');
    await page.getByRole('button', {name:'Back to room',exact:true}).click();
    await page.waitForFunction(() => !window.__DESK__.state.screenFocused && window.__DESK__.controls.enabled);
    const prefix = target.endsWith('/') ? target : target + '/';
    const badAssets = assets.filter(asset => asset.status >= 400 || !asset.url.startsWith(prefix + 'assets/'));
    if (errors.length || failedRequests.length || badAssets.length) throw Error(JSON.stringify({errors,failedRequests,badAssets}));
    for (const expected of ['desk-scene.glb','VT323-Regular.ttf','dark_wood_diff_2k.jpg','dark_wood_nor_gl_2k.jpg','dark_wood_rough_2k.jpg','moon.png','garage.png']) {
      if (!assets.some(asset => asset.url.endsWith(expected))) throw Error('Missing asset request: ' + expected);
    }
    return {url:target, assets, images, game:true, returnToRoom:true, pageErrors:errors, failedRequests};
  } finally {
    page.off('pageerror', onError);
    page.off('requestfailed', onFailure);
    page.off('response', onResponse);
  }
}
