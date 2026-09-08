async (page) => {
  page.setDefaultTimeout(45000);
  await page.goto('http://127.0.0.1:1994/');
  await page.waitForFunction(() => window.__DESK__?.state.loaded);
  await page.waitForFunction(() => getComputedStyle(document.querySelector('#loading')).visibility === 'hidden');
  const originalDisks = await page.evaluate(() => JSON.stringify({volumes: window.__DESK__.dos.volumes, score: window.__DESK__.dos.state.highScore}));
  await page.getByRole('button', {name: 'Enter room', exact: true}).click();
  await page.getByRole('button', {name: 'PC power', exact: true}).click();
  await page.getByRole('button', {name: 'Monitor power', exact: true}).click();
  await page.waitForFunction(() => window.__DESK__.dos.state.mode === 'dos');
  await page.getByRole('button', {name: 'Use computer', exact: true}).click();
  await page.waitForFunction(() => window.__DESK__.state.screenFocused && Math.abs(window.__DESK__.camera.position.x - window.__DESK__.screenCenter.x) < 0.0001);
  await page.locator('#scene').focus();
  const command = async text => {
    await page.keyboard.type(text);
    await page.keyboard.press('Enter');
  };
  for (const text of ['c:', 'cd \\', 'dir', 'cd games', 'dir', 'cd bonus', 'dir', 'type readme.txt']) await command(text);
  const cwd = await page.evaluate(() => window.__DESK__.dos.state.cwd);
  if (cwd !== 'C:\\GAMES\\BONUS') throw new Error('Exploration did not reach C:\\GAMES\\BONUS');
  const results = [];
  for (const item of [{file:'MOON.GIF', command:'view moon.gif', screenshot:'output/playwright/easter-moon.png'}, {file:'GARAGE.GIF', command:'view.exe garage.gif', screenshot:'output/playwright/easter-garage.png'}]) {
    await command(item.command);
    await page.waitForFunction(() => ['ready', 'error'].includes(window.__DESK__.dos.state.viewer?.status));
    const image = await page.evaluate(() => {
      const machine = window.__DESK__.dos, viewer = machine.viewer;
      return {...machine.state.viewer, width: viewer.image?.naturalWidth || viewer.image?.width || 0, height: viewer.image?.naturalHeight || viewer.image?.height || 0};
    });
    if (image.status !== 'ready' || image.filename !== item.file || !image.width || !image.height) throw new Error('Image failed: ' + JSON.stringify(image));
    await page.evaluate(() => new Promise(resolve => {
      let frames = 0;
      const tick = () => { if (++frames >= 4) resolve(); else requestAnimationFrame(tick); };
      requestAnimationFrame(tick);
    }));
    await page.screenshot({path:item.screenshot});
    await page.keyboard.press('Escape');
    await page.waitForFunction(expected => window.__DESK__.dos.state.mode === 'dos' && window.__DESK__.dos.state.cwd === expected && window.__DESK__.dos.state.command === '', cwd);
    await command('ver');
    const output = await page.evaluate(() => window.__DESK__.dos.lines.at(-1)?.text);
    if (output !== 'MS-DOS Version 6.22') throw new Error('DOS keyboard input failed after closing ' + item.file);
    results.push({...image, returnedTo:cwd, keyboardRecovered:true, screenshot:item.screenshot});
  }
  const finalDisks = await page.evaluate(() => JSON.stringify({volumes: window.__DESK__.dos.volumes, score: window.__DESK__.dos.state.highScore}));
  if (originalDisks !== finalDisks) throw new Error('Image exploration unexpectedly changed disk files or score');
  return {images:results, disksAndScoresUnchanged:true, finalMode:await page.evaluate(() => window.__DESK__.dos.state.mode)};
}
