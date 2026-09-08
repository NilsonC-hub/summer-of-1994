async (page) => {
  page.setDefaultTimeout(20000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('http://127.0.0.1:1994/');
  await page.waitForFunction(() => window.__DESK__?.state.loaded);
  await page.waitForFunction(() => getComputedStyle(document.querySelector('#loading')).visibility === 'hidden');
  await page.getByRole('button', {name:'Enter room',exact:true}).click();
  await page.waitForFunction(() => window.__DESK__.controls.enabled);
  await page.getByRole('button', {name:'PC power',exact:true}).click();
  await page.getByRole('button', {name:'Monitor power',exact:true}).click();
  await page.waitForFunction(() => window.__DESK__.dos.state.mode === 'dos');
  await page.getByRole('button', {name:'Insert disk',exact:true}).click();
  await page.waitForFunction(() => window.__DESK__.state.diskInserted && !window.__DESK__.state.diskMoving);
  await page.getByRole('button', {name:'Use computer',exact:true}).click();
  await page.locator('#scene').focus();
  await page.keyboard.type('a:'); await page.keyboard.press('Enter');
  await page.keyboard.type('star'); await page.keyboard.press('Enter');
  const titleState = await page.evaluate(() => window.__DESK__.audio.musicState);
  if (titleState.playing || titleState.wanted) throw Error('Music started before gameplay');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.__DESK__.audio.musicState.playing);
  const render = await page.evaluate(() => {
    const a = window.__DESK__.audio, buffer = a._musicBuffer;
    let peak=0, sum=0, finite=true, edges=true;
    for (let c=0;c<buffer.numberOfChannels;c++) {
      const samples=buffer.getChannelData(c);
      edges &&= samples[0] === 0 && samples.at(-1) === 0;
      for (const sample of samples) { peak=Math.max(peak,Math.abs(sample)); sum+=sample*sample; finite &&= Number.isFinite(sample); }
    }
    window.musicCheckSource=a._musicSource;
    window.musicCheckAnalyser=a.context.createAnalyser();
    window.musicCheckAnalyser.fftSize=2048;
    a.master.connect(window.musicCheckAnalyser);
    return {duration:buffer.duration,channels:buffer.numberOfChannels,sampleRate:buffer.sampleRate,peak,rms:Math.sqrt(sum/(buffer.length*buffer.numberOfChannels)),finite,edges};
  });
  if (!render.finite || !render.edges || render.peak > .60001 || render.rms < .01) throw Error('Invalid audio render: '+JSON.stringify(render));
  await page.waitForFunction(() => {
    const data=new Float32Array(2048); window.musicCheckAnalyser.getFloatTimeDomainData(data);
    return data.some(sample => Math.abs(sample) > .001);
  });
  await page.getByRole('button', {name:'Mute sound',exact:true}).click();
  await page.waitForFunction(() => {
    const data=new Float32Array(2048); window.musicCheckAnalyser.getFloatTimeDomainData(data);
    return data.every(sample => Math.abs(sample) < .00002);
  });
  await page.getByRole('button', {name:'Unmute sound',exact:true}).click();
  await page.waitForFunction(() => {
    const data=new Float32Array(2048); window.musicCheckAnalyser.getFloatTimeDomainData(data);
    return data.some(sample => Math.abs(sample) > .001);
  });
  if (!(await page.evaluate(() => window.__DESK__.audio._musicSource === window.musicCheckSource))) throw Error('Mute created a second/restarted music source');
  await page.locator('#scene').focus(); await page.keyboard.press('Escape');
  await page.waitForFunction(() => window.__DESK__.dos.state.game.phase === 'name' && !window.__DESK__.audio.musicState.playing);
  await page.keyboard.type('MUS'); await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.__DESK__.dos.state.game.saved);
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => window.__DESK__.dos.state.mode === 'dos');
  await page.keyboard.type('star'); await page.keyboard.press('Enter'); await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.__DESK__.audio.musicState.playing);
  const newSource = await page.evaluate(() => window.__DESK__.audio._musicSource !== window.musicCheckSource);
  if (!newSource) throw Error('Replay did not create a fresh theme');
  await page.getByRole('button', {name:'PC power',exact:true}).click();
  await page.waitForFunction(() => !window.__DESK__.audio.musicState.playing && !window.__DESK__.audio.musicState.wanted);
  await page.evaluate(() => { window.__DESK__.audio.master.disconnect(window.musicCheckAnalyser); window.musicCheckAnalyser.disconnect(); delete window.musicCheckSource; delete window.musicCheckAnalyser; });
  const lifecycle = await page.evaluate(async () => {
    const probe = new window.__DESK__.audio.constructor();
    if (!await probe.unlock()) throw Error('Audio context did not unlock');
    probe.setGameMusic(true);
    probe.setGameMusic(false);
    await probe._musicLoading;
    if (probe.musicState.playing) throw Error('Late synthesis restarted stopped music');
    probe.setGameMusic(true);
    const source = probe._musicSource;
    probe.setGameMusic(true);
    if (!source || probe._musicSource !== source) throw Error('Repeated game state duplicated playback');
    await probe.dispose();
    if (probe.musicState.playing || probe.musicState.wanted) throw Error('Dispose left music active');
    return {lateRenderStopped:true,repeatedStartIsStable:true,disposed:true};
  });
  if (errors.length) throw Error(errors.join(' | '));
  return {render,lifecycle,audibleSignal:true,muteUnmute:true,noDuplicateSources:true,endStops:true,replay:true,powerOffStops:true,pageErrors:errors};
}
