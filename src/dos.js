/** A small, stateful DOS machine for the 1994 desktop. No browser DOM required. */
import { assetUrl } from './assets.js';

const VOLUME_KEY = 'i486.volumes.v1';
const RECORD_KEY = 'i486.star.record.v1';
const TEXT_COLOR = '#c4d1c8';
const FILE = (content, kind = 'text') => ({ type: 'file', kind, content });
const DIR = (entries = {}) => ({ type: 'dir', entries });
const BONUS_IMAGES = Object.freeze({
  MOON: assetUrl('easter/moon.png'),
  GARAGE: assetUrl('easter/garage.png')
});

function bonusFiles() {
  return {
    'MOON.GIF': FILE('MOON', 'image'),
    'GARAGE.GIF': FILE('GARAGE', 'image'),
    'VIEW.EXE': FILE('VGA_VIEWER_1994', 'program'),
    'PHOTOS.TXT': FILE('hey bro, check these out:\n\nVIEW MOON.GIF\nVIEW GARAGE.GIF\n\nESC gets you back here.\nkeep these off the school printer, ok?\n\n- j')
  };
}

// Upgrade existing disks additively. User-created files and directory conflicts win.
function installBonus(hardDisk) {
  let changed = false;
  for (const [name, value] of Object.entries(bonusFiles())) {
    if (!Object.hasOwn(hardDisk.entries, name)) {
      hardDisk.entries[name] = value;
      changed = true;
    }
  }
  return changed;
}

function browserLoadImage(url) {
  return new Promise((resolve, reject) => {
    if (typeof globalThis.Image !== 'function') { reject(new Error('Image display unavailable')); return; }
    const image = new globalThis.Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Image could not be loaded'));
    image.src = url;
  });
}

function defaultVolumes() {
  return {
    C: DIR({
      DOS: DIR({ 'HELP.TXT': FILE('DOS QUICK REFERENCE\n\nDIR        List files\nTYPE name  Read a text file\nCD folder  Change directory\nCOPY a b   Copy a file\nA: or C:   Change drive\nCLS        Clear the screen') }),
      GAMES: DIR(),
      'AUTOEXEC.BAT': FILE('@ECHO OFF\nPROMPT $P$G\nPATH C:\\DOS'),
      'CONFIG.SYS': FILE('FILES=30\nBUFFERS=20'),
      'README.TXT': FILE('WELCOME HOME.\n\nYour computer starts from its hard disk, drive C:.\nThe 3.5-inch floppy drive is A:.\n\nInsert the disk marked STAR COURIER.\nType A: and press ENTER.\nType DIR to see what is on the disk.\nType STAR to run the game.\n\nTip: commands work in upper or lower case.'),
      ...bonusFiles()
    }),
    A: DIR({
      'STAR.EXE': FILE('STAR_COURIER_1994', 'program'),
      'README.TXT': FILE('STAR COURIER / VERSION 1.0\nAn original little game for an ordinary afternoon.\n\nRUN: STAR\nMOVE: LEFT / RIGHT or A / D\nCOLLECT: gold parcels       AVOID: red debris\n\nA delivery shift lasts 30 seconds.\nEnter your initials to save a new record.\nKeep the disk in the drive while saving!\n\nCan you beat your last delivery?')
    })
  };
}

function getStorage() {
  try { return globalThis.localStorage; } catch { return null; }
}
function readStorage(storage, key, fallback) {
  try { const value = storage?.getItem(key); return value ? JSON.parse(value) : fallback; } catch { return fallback; }
}
function clone(value) { return JSON.parse(JSON.stringify(value)); }
function tokenize(text) { return (text.match(/"[^"]*"|\S+/g) || []).map(s => s.replace(/^"|"$/g, '')); }
function patternMatches(name, pattern) {
  if (pattern === '*.*' || pattern === '*') return true;
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.');
  return new RegExp(`^${escaped}$`, 'i').test(name);
}

export class DosMachine {
  constructor({ onChange = () => {}, onEvent = () => {}, storage = getStorage(), loadImage = browserLoadImage } = {}) {
    this.onChange = onChange;
    this.onEvent = onEvent;
    this.storage = storage;
    const saved = readStorage(storage, VOLUME_KEY, null);
    this.volumes = saved?.C?.type === 'dir' && saved?.A?.type === 'dir' ? saved : defaultVolumes();
    if (installBonus(this.volumes.C)) {
      // Migration must also work in memory when storage is unavailable.
      try { this.storage?.setItem(VOLUME_KEY, JSON.stringify(this.volumes)); } catch {}
    }
    this.loadImage = loadImage;
    this.viewer = null;
    const record = readStorage(storage, RECORD_KEY, null);
    this.highScore = record && Number.isFinite(record.score) && /^[A-Z0-9]{1,3}$/.test(record.initials)
      ? { initials: record.initials, score: Math.max(0, record.score) } : { initials: '---', score: 0 };
    this.powered = false;
    this.mode = 'off';
    this.diskInserted = false;
    this.drive = 'C';
    this.directories = { A: [], C: [] };
    this.lines = [];
    this.command = '';
    this.history = [];
    this.historyIndex = 0;
    this.game = null;
    this.keys = new Set();
    this._pendingIO = null;
    this._lastRender = null;
    this._elapsed = 0;
    this._bootElapsed = 0;
    this._bootBlocked = false;
    this._notifyAt = 0;
    this._lastCommand = '';
    this.lastSave = null;
    this._resumeCommand = 'A:\\STAR';
  }

  get state() {
    return {
      powered: this.powered,
      booting: this.mode === 'boot' && !this._bootBlocked,
      bootBlocked: this._bootBlocked,
      mode: this.mode,
      diskInserted: this.diskInserted,
      drive: this.drive,
      cwd: `${this.drive}:\\${this.directories[this.drive].join('\\')}`,
      command: this.command,
      awaitingDisk: !!this._pendingIO,
      highScore: { ...this.highScore },
      lastSave: this.lastSave ? { ...this.lastSave } : null,
      viewer: this.viewer ? {
        filename: this.viewer.filename, path: this.viewer.path,
        status: this.viewer.status, error: this.viewer.error
      } : null,
      game: this.game ? {
        phase: this.game.phase, score: this.game.score, lives: this.game.lives,
        timeRemaining: Math.max(0, Math.ceil(30 - this.game.elapsed)),
        initials: this.game.initials, saved: this.game.saved, error: this.game.error,
        sourceDrive: this.game.sourceDrive,
        sourcePath: `${this.game.sourceDrive}:\\${this.game.sourceDirectory.join('\\')}`
      } : null
    };
  }

  _change() { this.onChange(this.state); }
  _event(type, fields = {}) { this.onEvent({ type, ...fields }); }
  _sound(sound) { this._event('sound', { sound }); }
  _hint(text) { this._event('hint', { text }); }
  _milestone(id, fields = {}) { this._event('milestone', { id, ...fields }); }
  _line(text = '', color = TEXT_COLOR) {
    for (const line of String(text).split('\n')) {
      if (!line.length) this.lines.push({ text: '', color });
      else for (let i = 0; i < line.length; i += 79) this.lines.push({ text: line.slice(i, i + 79), color });
    }
    if (this.lines.length > 300) this.lines.splice(0, this.lines.length - 300);
  }
  _prompt() { return `${this.drive}:\\${this.directories[this.drive].join('\\')}>`; }

  powerOn() {
    if (this.powered) return;
    this.powered = true;
    this.mode = 'boot';
    this.drive = 'C';
    this.directories = { A: [], C: [] };
    this.command = '';
    this.lines = [];
    this.game = null;
    this.viewer = null;
    this.keys.clear();
    this._pendingIO = null;
    this._bootElapsed = 0;
    this._bootBlocked = false;
    this._lastRender = null;
    this._sound('power');
    this._milestone('power-on');
    this._hint('电脑正在自检。等待 C:\\> 出现后，它就准备好接受命令了。');
    this._change();
  }

  powerOff() {
    if (!this.powered) return;
    this.powered = false;
    this.mode = 'off';
    this.game = null;
    this.viewer = null;
    this.command = '';
    this.keys.clear();
    this._pendingIO = null;
    this._bootBlocked = false;
    this._sound('power');
    this._milestone('power-off');
    this._change();
  }

  setDisk(inserted) {
    if (this.diskInserted === !!inserted) return;
    this.diskInserted = !!inserted;
    this._sound('disk');
    this._event('disk', { inserted: this.diskInserted });
    if (this.diskInserted) {
      this._milestone('disk-inserted');
      this._hint('软盘已经插好。在 DOS 输入 A: 切换到软驱，再输入 DIR 查看文件。');
    } else if (this.game?.phase === 'name') {
      this._hint('游戏盘取出了。保存成绩前，需要把它重新插入。');
    } else if (this._bootBlocked) {
      this._hint('数据盘已经取出。点击屏幕，再按任意键继续启动。');
    }
    this._change();
  }
  setDiskInserted(inserted) { this.setDisk(inserted); }

  _finishBoot() {
    this.mode = 'dos';
    this._bootBlocked = false;
    this.lines = [];
    this._line('Starting MS-DOS...');
    this._line();
    this._line('MS-DOS Version 6.22');
    this._line('486 DX2 / 66 MHz                   8192 KB Memory');
    this._line();
    this._line('Ready. Insert the STAR COURIER disk in drive A:.');
    this._line('Type HELP for commands.');
    this._line();
    this._sound('boot');
    this._milestone('booted');
    this._hint('C: 是电脑里的硬盘。插入游戏软盘后，输入 A:，按回车切换到软驱。');
    this._change();
  }

  _path(input = '') {
    const normalized = input.replace(/\//g, '\\').toUpperCase();
    const match = normalized.match(/^([A-Z]):/);
    const drive = match ? match[1] : this.drive;
    const rest = match ? normalized.slice(2) : normalized;
    if (!this.volumes[drive]) return { error: 'Invalid drive specification' };
    const parts = rest.startsWith('\\') ? [] : [...this.directories[drive]];
    for (const part of rest.split('\\').filter(Boolean)) {
      if (part === '.') continue;
      if (part === '..') parts.pop();
      else parts.push(part);
    }
    return { drive, parts };
  }
  _node(path) {
    if (!path || path.error) return null;
    let node = this.volumes[path.drive];
    for (const part of path.parts) node = node?.type === 'dir' ? node.entries[part] : null;
    return node || null;
  }
  _accessible(path, retry) {
    if (path.error) { this._line(path.error); this._sound('error'); return false; }
    if (path.drive === 'A' && !this.diskInserted) {
      this._line('Not ready reading drive A');
      this._line('Abort, Retry, Fail?');
      this._pendingIO = retry;
      this._sound('error');
      this._hint('软驱里没有盘。插入游戏软盘后按 R 重试，或者按 A 取消。');
      return false;
    }
    if (path.drive === 'A') this._sound('disk');
    return true;
  }
  _persist() {
    try { this.storage?.setItem(VOLUME_KEY, JSON.stringify(this.volumes)); return !!this.storage; }
    catch { this._hint('浏览器没有允许本地存储，本次成绩仍可保留到关闭页面之前。'); return false; }
  }

  _recordAt(path) {
    const directory = this._node(path);
    const content = directory?.entries?.['SCORES.DAT']?.content;
    if (typeof content !== 'string') return { initials: '---', score: 0 };
    const score = content.match(/^HIGH SCORE: (\d+)$/m);
    const initials = content.match(/^COURIER: ([A-Z0-9]{1,3})$/m);
    return score && initials ? { initials: initials[1], score: Number(score[1]) } : { initials: '---', score: 0 };
  }

  /** Run a command as if it had been typed and followed by Enter. */
  execute(input) {
    if (!this.powered || this.mode !== 'dos') return false;
    const text = String(input).trim();
    if (this._pendingIO) {
      this._diskAnswer(text[0] || '');
      return true;
    }
    this._line(this._prompt() + text);
    this.command = '';
    if (text) {
      if (this.history[this.history.length - 1] !== text) this.history.push(text);
      this.historyIndex = this.history.length;
      this._lastCommand = text;
      this._run(text);
      this._event('command', { command: text });
    }
    this._change();
    return true;
  }

  _diskAnswer(key) {
    const choice = key.toUpperCase();
    if (!['A', 'R', 'F'].includes(choice)) return;
    const retry = this._pendingIO;
    this._pendingIO = null;
    this._line(choice);
    if (choice === 'R') retry?.();
    else if (choice === 'F') this._line('General failure reading drive A');
    this._change();
  }

  _run(input) {
    const args = tokenize(input);
    let command = (args.shift() || '').toUpperCase();
    if (/^CD[.\\]/.test(command)) { args.unshift(command.slice(2)); command = 'CD'; }
    if (/^[A-Z]:$/.test(command) && !args.length) {
      const target = command[0];
      if (!this.volumes[target]) this._line('Invalid drive specification');
      else { this.drive = target; if (target === 'A') this._hint('现在的位置是 A:。输入 DIR，查看这张软盘上的文件。'); }
      return;
    }
    switch (command) {
      case 'HELP':
      case '?':
        this._line('A: / C:       Change drive');
        this._line('DIR [path]    List files and directories');
        this._line('TYPE file     Display a text file');
        this._line('CD [path]     Change or display directory');
        this._line('MD folder     Make a directory');
        this._line('COPY src dst  Copy a file to another disk or directory');
        this._line('CLS           Clear the screen');
        this._line('VER           Display DOS version');
        this._line('STAR          Run STAR.EXE from its directory');
        this._line();
        this._line('Try: A:   then DIR   then STAR');
        break;
      case 'VER': this._line('MS-DOS Version 6.22'); break;
      case 'CLS': this.lines = []; break;
      case 'VOL': {
        const path = this._path(args[0] || '');
        if (this._accessible(path, () => this._run(input))) this._line(` Volume in drive ${path.drive} is ${path.drive === 'A' ? 'STAR_DISK' : 'HOME_486'}`);
        break;
      }
      case 'DIR': this._dir(args, input); break;
      case 'TYPE': this._type(args, input); break;
      case 'VIEW': this._view(args, input); break;
      case 'CD':
      case 'CHDIR': this._cd(args, input); break;
      case 'MD':
      case 'MKDIR': this._mkdir(args, input); break;
      case 'COPY': this._copy(args, input); break;
      case 'DATE': this._line('Current date is Sun 07-10-1994'); break;
      case 'TIME': this._line('Current time is 16:24:00.00'); break;
      case 'ECHO': this._line(args.join(' ')); break;
      case 'EXIT': this._line('You are already at the DOS prompt.'); this._hint('已经回到 DOS。等软驱停止读写，再取盘并按主机电源键关机。'); break;
      default: this._runProgram(command, input, args); break;
    }
  }

  _dir(args, input) {
    const wide = args.some(arg => arg.toUpperCase() === '/W');
    const names = args.filter(arg => !['/W', '/P'].includes(arg.toUpperCase()));
    if (names.length > 1) { this._line('Too many parameters'); return; }
    const path = this._path(names[0] || '');
    if (!this._accessible(path, () => this._run(input))) return;
    let node = this._node(path);
    let pattern = '*';
    if (!node || node.type !== 'dir') { pattern = path.parts.pop() || '*'; node = this._node(path); }
    if (!node || node.type !== 'dir') { this._line('File not found'); return; }
    const entries = Object.entries(node.entries).filter(([name]) => patternMatches(name, pattern));
    this._line(` Volume in drive ${path.drive} is ${path.drive === 'A' ? 'STAR_DISK' : 'HOME_486'}`);
    this._line(` Directory of ${path.drive}:\\${path.parts.join('\\')}`);
    this._line();
    if (!entries.length) this._line('File not found');
    else if (wide) {
      const formatted = entries.map(([name, value]) => (value.type === 'dir' ? `[${name}]` : name).padEnd(16));
      for (let i = 0; i < formatted.length; i += 4) this._line(formatted.slice(i, i + 4).join(''));
    } else {
      for (const [name, value] of entries) {
        const dot = name.lastIndexOf('.');
        const base = dot > 0 ? name.slice(0, dot) : name;
        const ext = dot > 0 ? name.slice(dot + 1) : '';
        const size = value.type === 'dir' ? '<DIR>' : String(value.kind === 'program' ? 48320 : value.content.length);
        this._line(`${base.padEnd(8)} ${ext.padEnd(3)} ${size.padStart(9)}  07-10-94  4:24p`);
      }
    }
    const files = entries.filter(([, value]) => value.type === 'file');
    this._line(`       ${files.length} file(s)      ${files.reduce((sum, [, f]) => sum + (f.kind === 'program' ? 48320 : f.content.length), 0)} bytes`);
    this._line(`                   ${path.drive === 'A' ? '1,408,000' : '207,618,048'} bytes free`);
    this._line();
    if (path.drive === 'A') {
      this._milestone('disk-listed');
      this._hint('STAR.EXE 是游戏程序。输入 STAR 并按回车；TYPE README.TXT 可以先读说明。');
    }
  }

  _type(args, input) {
    if (args.length !== 1) { this._line('Required parameter missing'); return; }
    const path = this._path(args[0]);
    if (!this._accessible(path, () => this._run(input))) return;
    const node = this._node(path);
    if (!node || node.type !== 'file') this._line('File not found');
    else if (node.kind === 'program') this._line('MZ... [binary executable - type its name to run]');
    else if (node.kind === 'image') this._line('GIF89a... [VGA image - use VIEW filename.GIF]');
    else this._line(node.content);
  }

  _view(args, input) {
    if (args.length !== 1) { this._line('Usage: VIEW filename.GIF'); return; }
    const path = this._path(args[0]);
    if (!this._accessible(path, () => this._run(input))) return;
    const node = this._node(path);
    if (node?.type !== 'file') { this._line('File not found'); return; }
    if (node.kind !== 'image' || !Object.hasOwn(BONUS_IMAGES, node.content)) {
      this._line('Unsupported image format'); return;
    }
    const viewer = {
      filename: path.parts[path.parts.length - 1],
      path: `${path.drive}:\\${path.parts.join('\\')}`,
      status: 'loading', error: '', image: null
    };
    this.viewer = viewer;
    this.mode = 'viewer';
    this.keys.clear();
    Promise.resolve().then(() => this.loadImage(BONUS_IMAGES[node.content])).then(image => {
      if (this.viewer !== viewer || this.mode !== 'viewer') return;
      if (!(image?.naturalWidth || image?.width) || !(image?.naturalHeight || image?.height)) throw new Error('Empty image');
      viewer.image = image;
      viewer.status = 'ready';
      this._change();
    }).catch(() => {
      if (this.viewer !== viewer || this.mode !== 'viewer') return;
      viewer.status = 'error';
      viewer.error = 'IMAGE COULD NOT BE LOADED';
      this._change();
    });
    this._change();
  }

  _closeViewer() {
    this.viewer = null;
    this.mode = 'dos';
    this.keys.clear();
    this._change();
  }

  _cd(args, input) {
    if (!args.length) { this._line(`${this.drive}:\\${this.directories[this.drive].join('\\')}`); return; }
    if (args.length > 1) { this._line('Too many parameters'); return; }
    const path = this._path(args[0]);
    if (!this._accessible(path, () => this._run(input))) return;
    const node = this._node(path);
    if (node?.type !== 'dir') this._line('Invalid directory');
    else this.directories[path.drive] = path.parts;
  }

  _mkdir(args, input) {
    if (args.length !== 1) { this._line('Required parameter missing'); return; }
    const path = this._path(args[0]);
    if (!this._accessible(path, () => this._run(input))) return;
    const name = path.parts.pop();
    const parent = this._node(path);
    if (!name || !/^[A-Z0-9_$~!#%&'()@^`{}-]{1,8}(\.[A-Z0-9_$~!#%&'()@^`{}-]{1,3})?$/.test(name) || parent?.type !== 'dir' || parent.entries[name]) {
      this._line('Unable to create directory'); return;
    }
    parent.entries[name] = DIR();
    this._persist();
  }

  _copy(args, input) {
    if (args.length < 1 || args.length > 2) { this._line('Invalid number of parameters'); return; }
    const source = this._path(args[0]);
    const target = this._path(args[1] || '');
    if (!this._accessible(source, () => this._run(input)) || !this._accessible(target, () => this._run(input))) return;
    const src = this._node(source);
    if (src?.type !== 'file') { this._line('File not found'); return; }
    const destination = this._node(target);
    if (destination?.type === 'dir') target.parts.push(source.parts[source.parts.length - 1]);
    if (source.drive === target.drive && source.parts.join('\\') === target.parts.join('\\')) { this._line('File cannot be copied onto itself'); return; }
    const name = target.parts.pop();
    const parent = this._node(target);
    if (!name || !/^[A-Z0-9_$~!#%&'()@^`{}-]{1,8}(\.[A-Z0-9_$~!#%&'()@^`{}-]{1,3})?$/.test(name) || parent?.type !== 'dir') { this._line('Invalid path or filename'); return; }
    if (parent.entries[name]?.type === 'dir') { this._line('Access denied'); return; }
    parent.entries[name] = clone(src);
    this._persist();
    this._line('        1 file(s) copied.');
    this._milestone('file-copied');
    this._hint('文件已经复制。即使取出软盘，硬盘上的副本也还在。');
  }

  _runProgram(command, input, args = []) {
    const path = this._path(command);
    if (!this._accessible(path, () => this._run(input))) return;
    let node = this._node(path);
    if (!node && !/\.[^\\]+$/.test(command)) {
      for (const ext of ['.COM', '.EXE', '.BAT']) {
        const candidate = this._path(command + ext);
        const found = this._node(candidate);
        if (found) { node = found; path.parts = candidate.parts; break; }
      }
    }
    if (node?.kind === 'program' && node.content === 'VGA_VIEWER_1994') {
      this._view(args, input);
    } else if (node?.kind === 'program' && node.content === 'STAR_COURIER_1994') {
      this.highScore = this._recordAt({ drive: path.drive, parts: path.parts.slice(0, -1) });
      this._resumeCommand = `${path.drive}:\\${path.parts.join('\\')}`;
      this.mode = 'game';
      this.game = {
        phase: 'title', score: 0, lives: 3, elapsed: 0, x: 400,
        entities: [], spawnTimer: 0, serial: 0, seed: 486,
        invulnerable: 0, initials: '', saved: false, error: '',
        sourceDrive: path.drive, sourceDirectory: path.parts.slice(0, -1)
      };
      this.keys.clear();
      this._milestone('game-started');
      this._hint('游戏运行了！按 Enter 出发，用左右方向键躲开红色碎片，接住金色包裹。');
      this._change();
    } else {
      this._line('Bad command or file name');
      this._sound('error');
      this._hint('检查拼写和当前位置。输入 DIR 看看这里有什么；游戏盘的位置是 A:。');
    }
  }

  _startGame() {
    const game = this.game;
    game.phase = 'playing';
    game.score = 0;
    game.lives = 3;
    game.elapsed = 0;
    game.x = 400;
    game.entities = [];
    game.spawnTimer = 0.45;
    game.serial = 0;
    game.seed = 486;
    game.invulnerable = 0;
    game.initials = '';
    game.saved = false;
    game.error = '';
    this._sound('boot');
    this._change();
  }

  _finishGame() {
    if (!this.game || this.game.phase !== 'playing') return;
    this.game.phase = 'name';
    this.keys.clear();
    this._sound('collect');
    this._hint('这一趟结束了。输入 1～3 个英文字母或数字作为名字，再按 Enter 保存成绩。');
    this._event('game-over', { score: this.game.score });
    this._change();
  }

  _saveScore() {
    const game = this.game;
    if (!game?.initials.length) { game.error = 'TYPE 1-3 LETTERS OR NUMBERS FIRST'; this._change(); return; }
    if (game.sourceDrive === 'A' && !this.diskInserted) {
      game.error = 'INSERT GAME DISK, THEN PRESS ENTER TO SAVE';
      this._sound('error');
      this._hint('成绩需要写回游戏盘。重新插入软盘，再按 Enter 保存。');
      this._change();
      return;
    }
    const record = { initials: game.initials, score: game.score };
    if (record.score >= this.highScore.score) this.highScore = record;
    const directory = this._node({ drive: game.sourceDrive, parts: game.sourceDirectory });
    if (directory?.type === 'dir') directory.entries['SCORES.DAT'] = FILE(`STAR COURIER - SAVED RECORD\n\nHIGH SCORE: ${this.highScore.score}\nCOURIER: ${this.highScore.initials}\n\nLAST DELIVERY: ${record.score}\nCOURIER: ${record.initials}\n`);
    let durable = this._persist();
    try { this.storage?.setItem(RECORD_KEY, JSON.stringify(this.highScore)); } catch { durable = false; }
    game.saved = true;
    game.phase = 'result';
    game.error = '';
    const scorePath = `${game.sourceDrive}:\\${[...game.sourceDirectory, 'SCORES.DAT'].join('\\')}`;
    this.lastSave = { drive: game.sourceDrive, path: scorePath, durable };
    this._sound(game.sourceDrive === 'A' ? 'disk' : 'save');
    this._milestone('score-saved', { ...this.lastSave });
    this._event('score-saved', { record, highScore: { ...this.highScore }, ...this.lastSave });
    this._hint(`成绩已经写入 ${scorePath}。按 Esc 回到 DOS；再输入 ${this._resumeCommand}，就能看到保存的最高分。${durable ? '' : '浏览器未允许持久存储，本次记录只保留到关闭页面之前。'}`);
    this._change();
  }

  _exitGame() {
    this.mode = 'dos';
    this.game = null;
    this.keys.clear();
    this._line();
    this._line('Thank you for playing STAR COURIER.');
    this._line();
    this._milestone('game-exited');
    this._hint(`已经回到 DOS。再次输入 ${this._resumeCommand} 可以查看保存的成绩；取盘前等软驱灯熄灭。`);
    this._change();
  }

  handleKey(event) {
    if (!this.powered) return false;
    const key = typeof event === 'string' ? event : event.key;
    const keyup = typeof event === 'object' && event.type === 'keyup';
    if (!key) return false;
    const lower = key.toLowerCase();
    if (keyup) { this.keys.delete(lower); return this.mode === 'game'; }
    if (typeof event === 'object' && (event.metaKey || event.altKey)) return false;
    if (this.mode === 'boot') {
      if (this._bootBlocked && !this.diskInserted) this._finishBoot();
      return true;
    }
    if (this.mode === 'viewer') {
      if (key === 'Escape') this._closeViewer();
      return true;
    }
    if (this.mode === 'game') {
      const game = this.game;
      if (game.phase === 'playing') {
        this.keys.add(lower);
        if (key === 'Escape') this._finishGame();
      } else if (game.phase === 'name') {
        if (key === 'Enter') this._saveScore();
        else if (key === 'Backspace') game.initials = game.initials.slice(0, -1);
        else if (/^[a-z0-9]$/i.test(key) && game.initials.length < 3) { game.initials += key.toUpperCase(); game.error = ''; this._sound('key'); }
        this._change();
      } else if (key === 'Enter' || key === ' ') this._startGame();
      else if (key === 'Escape') this._exitGame();
      return true;
    }
    if (this._pendingIO) { this._diskAnswer(key); return true; }
    if (typeof event === 'object' && event.ctrlKey) {
      if (lower === 'c') { this._line(this._prompt() + this.command + '^C'); this.command = ''; this._change(); return true; }
      return false;
    }
    if (key === 'Enter') { this._sound('key'); this.execute(this.command); return true; }
    if (key === 'Backspace') { this.command = this.command.slice(0, -1); this._sound('key'); }
    else if (key === 'Escape') this.command = '';
    else if (key === 'ArrowUp') { this.historyIndex = Math.max(0, this.historyIndex - 1); this.command = this.history[this.historyIndex] || ''; }
    else if (key === 'ArrowDown') { this.historyIndex = Math.min(this.history.length, this.historyIndex + 1); this.command = this.history[this.historyIndex] || ''; }
    else if (key.length === 1 && /^[\x20-\x7E]$/.test(key) && this.command.length < 120) { this.command += key; this._sound('key'); }
    else return ['Tab', 'ArrowLeft', 'ArrowRight'].includes(key);
    this._change();
    return true;
  }

  releaseKeys() { this.keys.clear(); }

  update(deltaSeconds) {
    if (!this.powered) return;
    const dt = Math.max(0, Number.isFinite(deltaSeconds) ? deltaSeconds : 0);
    this._elapsed += dt;
    if (this.mode === 'boot') {
      this._bootElapsed += dt;
      if (!this._bootBlocked && this._bootElapsed >= 2.65) {
        if (this.diskInserted) {
          this._bootBlocked = true;
          this._sound('error');
          this._hint('这张软盘是游戏数据盘，不能用来启动电脑。先取出软盘，再按任意键从硬盘继续启动。');
          this._change();
        } else this._finishBoot();
      }
      return;
    }
    if (this.mode !== 'game' || this.game.phase !== 'playing') return;
    // Cap time after an inactive browser tab so a player does not instantly lose.
    const step = Math.min(dt, 0.08);
    const game = this.game;
    game.elapsed += step;
    game.invulnerable = Math.max(0, game.invulnerable - step);
    const direction = (this.keys.has('arrowright') || this.keys.has('d') ? 1 : 0) - (this.keys.has('arrowleft') || this.keys.has('a') ? 1 : 0);
    game.x = Math.max(36, Math.min(764, game.x + direction * step * 440));
    game.spawnTimer -= step;
    if (game.spawnTimer <= 0) {
      game.seed = (game.seed * 1664525 + 1013904223) >>> 0;
      const x = 50 + (game.seed % 700);
      const isParcel = game.serial % 3 !== 2;
      game.entities.push({ x, y: 82, type: isParcel ? 'parcel' : 'debris', speed: 135 + game.elapsed * 3 + (game.serial % 4) * 13 });
      game.serial++;
      game.spawnTimer = Math.max(0.28, 0.65 - game.elapsed * 0.008);
    }
    for (const entity of game.entities) {
      entity.y += entity.speed * step;
      if (Math.abs(entity.x - game.x) < 29 && Math.abs(entity.y - 490) < 25) {
        if (entity.type === 'parcel') { entity.dead = true; game.score += 100; this._sound('collect'); }
        else if (!game.invulnerable) { entity.dead = true; game.lives--; game.invulnerable = 1.1; this._sound('error'); }
      }
    }
    game.entities = game.entities.filter(entity => !entity.dead && entity.y < 565);
    if (game.lives <= 0 || game.elapsed >= 30) this._finishGame();
    else if (this._elapsed >= this._notifyAt) { this._notifyAt = this._elapsed + 0.2; this._change(); }
  }

  render(ctx, width = ctx.canvas.width, height = ctx.canvas.height, timeMs = 0) {
    if (this._lastRender !== null) this.update(Math.max(0, (timeMs - this._lastRender) / 1000));
    this._lastRender = timeMs;
    ctx.save();
    ctx.setTransform(width / 800, 0, 0, height / 600, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#030807';
    ctx.fillRect(0, 0, 800, 600);
    if (this.powered) {
      if (this.mode === 'game') this._renderGame(ctx, timeMs / 1000);
      else if (this.mode === 'viewer') this._renderViewer(ctx);
      else this._renderDOS(ctx, timeMs);
    }
    ctx.restore();
  }

  _renderViewer(ctx) {
    const viewer = this.viewer;
    ctx.fillStyle = '#08080d';
    ctx.fillRect(0, 0, 800, 600);
    ctx.font = '24px "VT323", monospace';
    ctx.textBaseline = 'top';
    ctx.textAlign = 'center';
    if (viewer.status === 'ready') {
      const image = viewer.image;
      const width = image.naturalWidth || image.width;
      const height = image.naturalHeight || image.height;
      const scale = Math.min(800 / width, 568 / height);
      ctx.drawImage(image, (800 - width * scale) / 2, (568 - height * scale) / 2, width * scale, height * scale);
    } else {
      ctx.fillStyle = TEXT_COLOR;
      ctx.fillText(viewer.status === 'loading' ? 'READING IMAGE...' : viewer.error, 400, 274);
    }
    ctx.fillStyle = '#afb9b4';
    ctx.fillText(`${viewer.filename}                         ESC - DOS`, 400, 574);
    ctx.textAlign = 'left';
  }

  _renderDOS(ctx, timeMs) {
    ctx.font = '24px "VT323", monospace';
    ctx.textBaseline = 'top';
    ctx.fillStyle = TEXT_COLOR;
    let lines = this.lines;
    if (this.mode === 'boot') {
      const t = this._bootElapsed;
      const boot = [
        [0, '486 SYSTEM BIOS                         (C) 1994'],
        [0, 'ISA / VLB 486 Mainboard'],
        [0, ''],
        [0.2, 'CPU: 80486DX2 at 66MHz'],
        [0.35, `Memory Test: ${String(Math.min(8192, Math.floor(t * 6200 / 64) * 64)).padStart(5)}K OK`],
        [1.1, ''],
        [1.1, 'Detecting Primary Master ...  212 MB IDE'],
        [1.4, 'Floppy Drive A:  1.44M, 3.5 in.'],
        [1.9, 'Keyboard ...................  OK'],
        [2.15, ''],
        [2.15, 'Boot sequence: A:, C:']
      ];
      if (this._bootBlocked) boot.push([0, ''], [0, 'Non-System disk or disk error'], [0, 'Replace and press any key when ready']);
      lines = boot.filter(([at]) => t >= at).map(([, text]) => ({ text, color: TEXT_COLOR }));
    }
    const current = this.mode === 'dos' && !this._pendingIO ? this._prompt() + this.command : null;
    const visible = lines.slice(-(current === null ? 24 : 23));
    visible.forEach((line, row) => { ctx.fillStyle = line.color; ctx.fillText(line.text, 15, 14 + row * 23.5); });
    if (current !== null) {
      const clipped = current.length > 79 ? current.slice(-79) : current;
      const row = visible.length;
      ctx.fillStyle = TEXT_COLOR;
      ctx.fillText(clipped, 15, 14 + row * 23.5);
      if (Math.floor(timeMs / 480) % 2 === 0) ctx.fillRect(15 + ctx.measureText(clipped).width, 14 + row * 23.5 + 16, 9.5, 3);
    }
  }

  _text(ctx, text, x, y, size = 18, color = '#cdece5', align = 'left') {
    ctx.font = `${Math.round(size * 1.2)}px "VT323", monospace`;
    ctx.textAlign = align;
    ctx.textBaseline = 'top';
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
  }
  _ship(ctx, x, y, time, scale = 1) {
    ctx.save(); ctx.translate(Math.round(x), Math.round(y)); ctx.scale(scale, scale);
    ctx.fillStyle = '#ef9c4a'; ctx.fillRect(-5, 13, 10, Math.floor(time * 12) % 2 ? 16 : 10);
    ctx.fillStyle = '#7dd2cf'; ctx.fillRect(-6, -18, 12, 32); ctx.fillRect(-18, 0, 36, 14);
    ctx.fillStyle = '#daf5e8'; ctx.fillRect(-3, -15, 6, 21); ctx.fillRect(-15, 0, 6, 9); ctx.fillRect(9, 0, 6, 9);
    ctx.fillStyle = '#294d70'; ctx.fillRect(-3, -8, 6, 8); ctx.restore();
  }
  _renderGame(ctx, time) {
    const game = this.game;
    ctx.fillStyle = '#080f25'; ctx.fillRect(0, 0, 800, 600);
    for (let i = 0; i < 82; i++) {
      ctx.fillStyle = ['#2d466b', '#638797', '#b2ccc1'][i % 3];
      const speed = game.phase === 'playing' ? 16 : 3;
      ctx.fillRect((i * 137 + i * i * 11) % 790 + 5, ((i * 79) + time * speed * (i % 3 + 1)) % 600, i % 3 === 0 ? 2 : 1, 2);
    }
    ctx.strokeStyle = '#254a5b'; ctx.lineWidth = 2; ctx.strokeRect(15, 15, 770, 570);
    if (game.phase === 'title') {
      this._text(ctx, 'ORBITAL POST / 1994', 400, 65, 17, '#77a5a8', 'center');
      this._text(ctx, 'STAR', 400, 116, 76, '#c5e9dc', 'center');
      this._text(ctx, 'C O U R I E R', 400, 196, 37, '#ecbb60', 'center');
      this._ship(ctx, 400, 313, time, 2.5);
      this._text(ctx, 'EVERY PARCEL HAS SOMEWHERE TO GO.', 400, 385, 17, '#96babb', 'center');
      this._text(ctx, 'LEFT / RIGHT: MOVE   GOLD: +100   RED: AVOID', 400, 425, 16, '#c3d8d0', 'center');
      this._text(ctx, `RECORD  ${this.highScore.initials}  ${String(this.highScore.score).padStart(6, '0')}`, 400, 462, 20, '#ecbb60', 'center');
      if (Math.floor(time * 1.5) % 2 === 0) this._text(ctx, 'PRESS ENTER TO DEPART', 400, 505, 22, '#c5e9dc', 'center');
      this._text(ctx, 'ESC: RETURN TO DOS', 400, 550, 14, '#77a5a8', 'center');
      return;
    }
    ctx.fillStyle = '#0e2132'; ctx.fillRect(17, 17, 766, 53);
    this._text(ctx, 'STAR COURIER', 30, 32, 19, '#a4d3ce');
    this._text(ctx, `CARGO ${String(game.score).padStart(5, '0')}`, 272, 32, 19, '#ecbb60');
    this._text(ctx, `HULL ${game.lives}`, 482, 32, 19, '#a4d3ce');
    this._text(ctx, `${String(Math.max(0, Math.ceil(30 - game.elapsed))).padStart(2, '0')} SEC`, 673, 32, 19, '#a4d3ce');
    for (const entity of game.entities) {
      const x = Math.round(entity.x), y = Math.round(entity.y);
      if (entity.type === 'parcel') {
        ctx.fillStyle = '#e8b85c'; ctx.fillRect(x - 10, y - 9, 20, 18);
        ctx.fillStyle = '#ffe6a5'; ctx.fillRect(x - 10, y - 9, 20, 3); ctx.fillRect(x - 2, y - 9, 4, 18);
        ctx.fillStyle = '#987442'; ctx.fillRect(x - 10, y + 7, 20, 3);
      } else {
        ctx.fillStyle = '#aa5360'; ctx.fillRect(x - 15, y - 8, 30, 18); ctx.fillRect(x - 9, y - 14, 19, 29);
        ctx.fillStyle = '#da847f'; ctx.fillRect(x - 10, y - 10, 13, 5);
        ctx.fillStyle = '#713c51'; ctx.fillRect(x + 1, y, 10, 8);
      }
    }
    if (!game.invulnerable || Math.floor(time * 12) % 2 === 0) this._ship(ctx, game.x, 490, time);
    ctx.fillStyle = '#0e2132'; ctx.fillRect(17, 548, 766, 35);
    this._text(ctx, 'LEFT / RIGHT  MOVE                 ESC  END DELIVERY', 400, 557, 15, '#80a7ae', 'center');
    if (game.phase === 'playing') return;
    ctx.fillStyle = 'rgba(3,9,19,0.92)'; ctx.fillRect(86, 134, 628, 355);
    ctx.strokeStyle = '#527b83'; ctx.strokeRect(86, 134, 628, 355);
    this._text(ctx, game.phase === 'result' ? 'DELIVERY LOG SAVED' : 'DELIVERY COMPLETE', 400, 171, 31, '#c5e9dc', 'center');
    this._text(ctx, `${String(game.score).padStart(5, '0')} POINTS`, 400, 224, 40, '#ecbb60', 'center');
    if (game.phase === 'name') {
      this._text(ctx, 'YOUR INITIALS', 400, 290, 18, '#96babb', 'center');
      this._text(ctx, game.initials.padEnd(3, '_').split('').join(' '), 400, 328, 37, '#d7eee1', 'center');
      this._text(ctx, 'ENTER: WRITE SCORE TO DISK', 400, 402, 18, '#96babb', 'center');
      if (game.error) this._text(ctx, game.error, 400, 453, 14, '#f3a185', 'center');
    } else {
      this._text(ctx, `RECORD  ${this.highScore.initials}  ${String(this.highScore.score).padStart(5, '0')}`, 400, 300, 22, '#ecbb60', 'center');
      this._text(ctx, 'SCORES.DAT has been written.', 400, 344, 17, '#96babb', 'center');
      this._text(ctx, 'ENTER: ANOTHER DELIVERY', 400, 399, 18, '#c5e9dc', 'center');
      this._text(ctx, 'ESC: RETURN TO DOS', 400, 437, 18, '#c5e9dc', 'center');
    }
  }
}

export function createDOS({ canvas, onStateChange, onSound, ...options } = {}) {
  const existingEvent = options.onEvent;
  const machine = new DosMachine({
    ...options,
    onChange: onStateChange || options.onChange,
    onEvent: event => { existingEvent?.(event); if (event.type === 'sound') onSound?.(event.sound); }
  });
  if (canvas) machine.draw = timeMs => machine.render(canvas.getContext('2d'), canvas.width, canvas.height, timeMs);
  return machine;
}
