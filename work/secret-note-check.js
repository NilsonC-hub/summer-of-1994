async (page) => {
  page.setDefaultTimeout(15000);
  await page.goto('http://127.0.0.1:1994/');
  await page.waitForFunction(() => window.__DESK__?.state.loaded);
  await page.waitForFunction(() => getComputedStyle(document.querySelector('#loading')).visibility === 'hidden');
  await page.getByRole('button',{name:'Enter room',exact:true}).click();
  await page.waitForFunction(() => window.__DESK__.controls.enabled);
  const pickNote = async () => {
    const point = await page.evaluate(() => {
      const a=window.__DESK__,o=a.model.getObjectByName('Secret_Note'),v=a.camera.position.clone();
      o.geometry.computeBoundingBox();o.geometry.boundingBox.getCenter(v).applyMatrix4(o.matrixWorld).project(a.camera);
      return {x:(v.x+1)*innerWidth/2,y:(1-v.y)*innerHeight/2};
    });
    await page.locator('#scene').click({position:point});
    await page.waitForFunction(() => !document.querySelector('#secret-note').hidden && +getComputedStyle(document.querySelector('#secret-note')).opacity === 1);
  };
  await page.mouse.move(1550,500);
  await page.screenshot({path:'output/playwright/secret-note-desk.png'});
  await pickNote();
  await page.mouse.move(800,700);
  await page.screenshot({path:'output/playwright/secret-note-open.png'});
  await page.keyboard.press('Escape');
  if (!await page.locator('#secret-note').isHidden()) throw Error('Esc did not close note');
  await page.setViewportSize({width:1280,height:720});
  await pickNote();
  const bounds=await page.locator('#secret-note').boundingBox();
  if (bounds.y<0 || bounds.y+bounds.height>720) throw Error('Desktop note exceeds viewport');
  await page.screenshot({path:'output/playwright/secret-note-1280.png'});
  await page.getByRole('button',{name:'Put secret note down',exact:true}).click();
  await page.setViewportSize({width:1600,height:1000});
  return {physicalPick:true,escapeClose:true,buttonClose:await page.locator('#secret-note').isHidden(),desktop1280Fits:true};
}
