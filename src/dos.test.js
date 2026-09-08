import test from 'node:test';
import assert from 'node:assert/strict';
import { DosMachine } from './dos.js';

function makeStorage() {
  const values = new Map();
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
}
function start(options = {}) {
  const machine = new DosMachine({ storage: makeStorage(), ...options });
  machine.powerOn();
  machine.update(3);
  return machine;
}
function output(machine) { return machine.lines.map(line => line.text).join('\n'); }
function key(machine, key, type = 'keydown') { return machine.handleKey({ key, type }); }

test('power, boot and data-disk boot recovery have distinct states', () => {
  const events = [];
  const machine = new DosMachine({ onEvent: event => events.push(event), storage: makeStorage() });
  assert.equal(machine.execute('DIR'), false);
  machine.setDisk(true);
  machine.powerOn();
  machine.update(3);
  assert.equal(machine.state.bootBlocked, true);
  key(machine, 'Enter');
  assert.equal(machine.state.mode, 'boot');
  machine.setDisk(false);
  key(machine, 'Enter');
  assert.equal(machine.state.mode, 'dos');
  assert.equal(machine.state.cwd, 'C:\\');
  assert.ok(events.some(event => event.type === 'milestone' && event.id === 'booted'));
  machine.powerOff();
  assert.equal(machine.state.mode, 'off');
  assert.equal(key(machine, 'A'), false);
});

test('missing floppy reports a recoverable I/O prompt and retry resumes the command', () => {
  const machine = start();
  machine.execute('a:');
  machine.execute('dir');
  assert.equal(machine.state.awaitingDisk, true);
  assert.match(output(machine), /Not ready reading drive A/);
  machine.setDisk(true);
  key(machine, 'r');
  assert.equal(machine.state.awaitingDisk, false);
  assert.match(output(machine), /STAR\s+EXE/);
  machine.setDisk(false);
  machine.execute('type readme.txt');
  key(machine, 'a');
  assert.equal(machine.state.awaitingDisk, false);
  assert.equal(machine.state.mode, 'dos');
});

test('directory navigation, wildcards, drive-relative paths and file copying compose', () => {
  const machine = start();
  machine.setDisk(true);
  machine.execute('md c:\\games\\mail');
  machine.execute('cd c:\\games');
  assert.equal(machine.state.cwd, 'C:\\GAMES');
  machine.execute('copy a:\\star.exe mail\\courier.exe');
  machine.execute('dir mail\\*.exe');
  assert.match(output(machine), /COURIER\s+EXE/);
  machine.execute('cd mail');
  machine.execute('a:');
  machine.execute('cd c:\\');
  assert.equal(machine.state.drive, 'A', 'DOS CD of another drive must not change the active drive');
  machine.execute('c:');
  assert.equal(machine.state.cwd, 'C:\\');
  machine.setDisk(false);
  machine.execute('c:\\games\\mail\\courier');
  assert.equal(machine.state.mode, 'game', 'copied executable runs from the hard disk without a floppy');
  key(machine, 'Escape');
  machine.execute('cd games\\mail');
  machine.execute('cd..');
  assert.equal(machine.state.cwd, 'C:\\GAMES');
  machine.execute('cd ..\\..\\..');
  assert.equal(machine.state.cwd, 'C:\\', 'parent navigation stays inside the drive root');
});

test('a delivery accepts movement, writes its score, and survives reboot and a new machine', () => {
  const storage = makeStorage();
  const machine = start({ storage });
  machine.setDisk(true);
  machine.execute('a:\\star.exe');
  assert.equal(machine.state.game.phase, 'title');
  key(machine, 'Enter');
  key(machine, 'ArrowRight');
  machine.update(0.08);
  assert.ok(machine.game.x > 400);
  key(machine, 'ArrowRight', 'keyup');
  const stoppedAt = machine.game.x;
  machine.update(0.08);
  assert.equal(machine.game.x, stoppedAt);
  // Steer toward the first actual parcel rather than assigning a synthetic score.
  for (let frame = 0; frame < 300 && !machine.game.score; frame++) {
    const parcel = machine.game.entities.find(entity => entity.type === 'parcel');
    if (parcel) {
      const distance = parcel.x - machine.game.x;
      machine.releaseKeys();
      if (Math.abs(distance) > 8) key(machine, distance > 0 ? 'ArrowRight' : 'ArrowLeft');
    }
    machine.update(1 / 60);
  }
  assert.ok(machine.game.score > 0, 'a collected parcel earns points');
  key(machine, 'Escape');
  assert.equal(machine.state.game.phase, 'name');
  for (const letter of 'kid') key(machine, letter);
  machine.setDisk(false);
  key(machine, 'Enter');
  assert.equal(machine.state.game.saved, false);
  assert.match(machine.state.game.error, /INSERT GAME DISK/);
  machine.setDisk(true);
  key(machine, 'Enter');
  const score = machine.state.highScore.score;
  assert.equal(machine.state.game.saved, true);
  assert.equal(machine.state.highScore.initials, 'KID');
  key(machine, 'Escape');
  machine.execute('type a:\\scores.dat');
  assert.match(output(machine), /COURIER: KID/);
  machine.powerOff();
  machine.setDisk(false);
  machine.powerOn();
  machine.update(3);
  machine.setDisk(true);
  machine.execute('a:\\star');
  assert.equal(machine.state.highScore.score, score);
  const reopened = start({ storage });
  reopened.setDisk(true);
  reopened.execute('a:');
  reopened.execute('star');
  assert.deepEqual(reopened.state.highScore, { initials: 'KID', score });
});

test('typed lowercase commands, history, clear screen and unsupported paths recover cleanly', () => {
  const machine = start();
  for (const character of 'ver') key(machine, character);
  key(machine, 'Enter');
  assert.match(output(machine), /MS-DOS Version 6.22/);
  key(machine, 'ArrowUp');
  assert.equal(machine.state.command, 'ver');
  key(machine, 'Escape');
  assert.equal(machine.state.command, '');
  machine.execute('z:');
  assert.match(output(machine), /Invalid drive specification/);
  assert.equal(machine.state.drive, 'C');
  machine.execute('cd nonexistent');
  assert.equal(machine.state.cwd, 'C:\\');
  machine.execute('cls');
  assert.equal(machine.lines.length, 0);
});

test('unavailable storage does not interrupt the playable save flow', () => {
  const storage = { getItem() { throw new Error('disabled'); }, setItem() { throw new Error('quota'); } };
  const events = [];
  const machine = start({ storage, onEvent: event => events.push(event) });
  machine.setDisk(true);
  machine.execute('a:\\star');
  key(machine, 'Enter');
  key(machine, 'Escape');
  key(machine, 'x');
  key(machine, 'Enter');
  assert.equal(machine.state.game.saved, true);
  assert.equal(events.find(event => event.type === 'score-saved').durable, false);
});

test('hard disk copies save into their own directory and do not change the floppy record', () => {
  const events = [];
  const machine = start({ onEvent: event => events.push(event) });
  machine.setDisk(true);
  machine.execute('copy a:\\star.exe c:\\games\\mail.exe');
  machine.execute('c:\\games\\mail');
  key(machine, 'Enter');
  key(machine, 'Escape');
  key(machine, 'h');
  key(machine, 'd');
  key(machine, 'Enter');
  assert.deepEqual(machine.state.lastSave, { drive: 'C', path: 'C:\\GAMES\\SCORES.DAT', durable: true });
  assert.equal(machine.state.highScore.initials, 'HD');
  const saved = events.find(event => event.type === 'score-saved');
  assert.equal(saved.path, 'C:\\GAMES\\SCORES.DAT');
  key(machine, 'Escape');
  assert.ok(events.some(event => event.type === 'hint' && event.text.includes('C:\\GAMES\\MAIL.EXE')));
  machine.execute('a:\\star');
  assert.deepEqual(machine.state.highScore, { initials: '---', score: 0 });
  key(machine, 'Escape');
  machine.execute('c:\\games\\mail.exe');
  assert.equal(machine.state.highScore.initials, 'HD');
});

test('DIR at the C root lists both images and either opens with one VIEW command', async () => {
  const loaded = [];
  const machine = start({ loadImage: async url => { loaded.push(url); return { width: 640, height: 480 }; } });
  machine.execute('dir');
  assert.match(output(machine), /GAMES\s+<DIR>/);
  assert.match(output(machine), /MOON\s+GIF/);
  assert.match(output(machine), /GARAGE\s+GIF/);
  assert.match(output(machine), /VIEW\s+EXE/);
  assert.match(output(machine), /PHOTOS\s+TXT/);
  assert.equal(machine.volumes.C.entries.GAMES.entries.BONUS, undefined, 'new installs do not duplicate the images in a nested folder');
  for (const [command, name, url] of [
    ['view moon.gif', 'MOON.GIF', '/assets/easter/moon.png'],
    ['view garage.gif', 'GARAGE.GIF', '/assets/easter/garage.png']
  ]) {
    machine.execute(command);
    assert.equal(machine.state.mode, 'viewer');
    assert.equal(machine.state.viewer.status, 'loading');
    assert.equal(machine.state.viewer.filename, name);
    for (const input of ['a', 'ArrowLeft', 'Enter']) key(machine, input);
    key(machine, 'ArrowLeft', 'keyup');
    assert.equal(machine.state.mode, 'viewer', 'only Escape exits the viewer');
    assert.equal(machine.state.command, '', 'viewer keystrokes must not leak into the DOS prompt');
    assert.equal(machine.keys.size, 0, 'viewer navigation does not leave movement keys held');
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(machine.state.viewer.status, 'ready');
    assert.equal(loaded.at(-1), url);
    key(machine, 'Escape');
    assert.equal(machine.state.mode, 'dos');
    assert.equal(machine.state.viewer, null);
    assert.equal(machine.state.cwd, 'C:\\');
    assert.equal(machine.state.command, '');
    assert.match(output(machine), new RegExp(command.replace('.', '\\.')));
  }
  machine.execute('type photos.txt');
  assert.match(output(machine), /VIEW MOON\.GIF/);
  assert.match(output(machine), /VIEW GARAGE\.GIF/);
  machine.execute('view.exe moon.gif');
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(machine.state.viewer.status, 'ready', 'the listed VIEW.EXE also runs');
  key(machine, 'Escape');
});

test('viewer handles missing files, unsupported files and unavailable image loading without trapping DOS', async () => {
  const machine = start({ loadImage: async () => { throw new Error('network unavailable'); } });
  machine.execute('c:\\games\\view.exe c:\\moon.gif');
  assert.match(output(machine), /Bad command or file name/, 'VIEW.EXE must exist at the invoked path');
  machine.execute('view missing.gif');
  assert.match(output(machine), /File not found/);
  machine.execute('view readme.txt');
  assert.match(output(machine), /Unsupported image format/);
  assert.equal(machine.state.mode, 'dos');
  machine.execute('view c:\\moon.gif');
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(machine.state.viewer.status, 'error');
  key(machine, 'Escape');
  machine.execute('ver');
  assert.equal(machine.state.mode, 'dos');
  assert.equal(machine.state.cwd, 'C:\\');
  assert.match(output(machine), /MS-DOS Version 6\.22/);

  // Browser Image is optional: the normal constructor remains usable in Node.
  const headless = start();
  headless.execute('view c:\\garage.gif');
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(headless.state.viewer.status, 'error');
  key(headless, 'Escape');
  assert.equal(headless.state.mode, 'dos');
});

test('a late image load cannot reopen a viewer after Esc or a power cycle', async () => {
  const pending = [];
  const machine = start({ loadImage: () => new Promise(resolve => pending.push(resolve)) });
  machine.execute('view c:\\moon.gif');
  await new Promise(resolve => setImmediate(resolve));
  key(machine, 'Escape');
  machine.execute('view c:\\garage.gif');
  await new Promise(resolve => setImmediate(resolve));
  pending[0]({ width: 640, height: 480 });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(machine.state.viewer.filename, 'GARAGE.GIF');
  assert.equal(machine.state.viewer.status, 'loading');
  machine.powerOff();
  machine.powerOn();
  machine.update(3);
  pending[1]({ width: 640, height: 480 });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(machine.state.mode, 'dos');
  assert.equal(machine.state.viewer, null);
});

test('existing disk storage is upgraded additively and preserves personal files and scores', () => {
  const storage = makeStorage();
  const original = new DosMachine({ storage });
  const volumes = JSON.parse(JSON.stringify(original.volumes));
  const bonusNames = ['MOON.GIF', 'GARAGE.GIF', 'VIEW.EXE', 'PHOTOS.TXT'];
  for (const name of bonusNames) delete volumes.C.entries[name];
  volumes.C.entries.GAMES.entries['SCORES.DAT'] = { type: 'file', kind: 'text', content: 'HIGH SCORE: 900\nCOURIER: OLD' };
  volumes.C.entries['MYNOTE.TXT'] = { type: 'file', kind: 'text', content: 'do not erase this' };
  volumes.C.entries['README.TXT'].content = 'my personalized welcome';
  volumes.A.entries['SCORES.DAT'] = { type: 'file', kind: 'text', content: 'HIGH SCORE: 600\nCOURIER: BRO' };
  storage.setItem('i486.volumes.v1', JSON.stringify(volumes));
  storage.setItem('i486.star.record.v1', JSON.stringify({ initials: 'BRO', score: 600 }));
  const upgraded = new DosMachine({ storage });
  const expected = JSON.parse(JSON.stringify(volumes));
  for (const name of bonusNames) expected.C.entries[name] = original.volumes.C.entries[name];
  assert.deepEqual(upgraded.volumes, expected);
  assert.deepEqual(upgraded.state.highScore, { initials: 'BRO', score: 600 });
  assert.deepEqual(JSON.parse(storage.getItem('i486.volumes.v1')), expected, 'upgrade persists without a later game save');
  assert.deepEqual(new DosMachine({ storage }).volumes, expected, 'repeated startup makes no further changes');

  // The previous release's nested folder remains exactly as the user left it.
  const legacy = JSON.parse(JSON.stringify(volumes));
  legacy.C.entries.GAMES.entries.BONUS = { type: 'dir', entries: {
    'MOON.GIF': { type: 'file', kind: 'image', content: 'MOON' },
    'GARAGE.GIF': { type: 'file', kind: 'image', content: 'GARAGE' },
    'VIEW.EXE': { type: 'file', kind: 'program', content: 'VGA_VIEWER_1994' },
    'README.TXT': { type: 'file', kind: 'text', content: 'the old note, with my edits' }
  } };
  storage.setItem('i486.volumes.v1', JSON.stringify(legacy));
  const migratedLegacy = new DosMachine({ storage });
  const legacyExpected = JSON.parse(JSON.stringify(legacy));
  for (const name of bonusNames) legacyExpected.C.entries[name] = original.volumes.C.entries[name];
  assert.deepEqual(migratedLegacy.volumes, legacyExpected);

  // Partially populated root directories and name collisions keep exact user entries.
  const customMoon = { type: 'file', kind: 'text', content: 'my old moon file' };
  expected.C.entries['MOON.GIF'] = customMoon;
  expected.C.entries['PHOTOS.TXT'] = { type: 'dir', entries: {} };
  delete expected.C.entries['GARAGE.GIF'];
  storage.setItem('i486.volumes.v1', JSON.stringify(expected));
  const partial = new DosMachine({ storage });
  assert.deepEqual(partial.volumes.C.entries['MOON.GIF'], customMoon);
  assert.deepEqual(partial.volumes.C.entries['PHOTOS.TXT'], { type: 'dir', entries: {} });
  assert.equal(partial.volumes.C.entries['GARAGE.GIF'].kind, 'image');
  expected.C.entries['GARAGE.GIF'] = original.volumes.C.entries['GARAGE.GIF'];
  storage.setItem('i486.volumes.v1', JSON.stringify(expected));
  assert.deepEqual(new DosMachine({ storage }).volumes, expected);
});
