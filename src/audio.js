import { renderTheme, THEME } from './chiptune.js';

/** Synthesised hardware sounds and an original gameplay theme; no network audio. */
export class RetroAudio {
  constructor({ enabled = true, volume = 0.23 } = {}) {
    this.enabled = enabled;
    this.volume = volume;
    this.context = null;
    this.master = null;
    this._lastKey = -Infinity;
    this._lastDisk = -Infinity;
    this._musicWanted = false;
    this._musicBuffer = null;
    this._musicLoading = null;
    this._musicSource = null;
    this._musicGain = null;
    this._musicUnavailable = false;
    this._disposed = false;
  }

  async unlock() {
    if (this._disposed) return false;
    if (!this.context) {
      const AudioContextClass = globalThis.AudioContext || globalThis.webkitAudioContext;
      if (!AudioContextClass) return false;
      this.context = new AudioContextClass();
      this.master = this.context.createGain();
      this.master.gain.value = this.enabled ? this.volume : 0;
      this.master.connect(this.context.destination);
    }
    try {
      if (this.context.state === 'suspended') await this.context.resume();
      this._ensureMusic();
      return this.context.state === 'running';
    }
    catch { return false; }
  }

  setEnabled(enabled) {
    this.enabled = !!enabled;
    if (this.master) this.master.gain.setTargetAtTime(this.enabled ? this.volume : 0, this.context.currentTime, 0.03);
  }
  setVolume(volume) {
    this.volume = Math.max(0, Math.min(1, volume));
    this.setEnabled(this.enabled);
  }

  get musicState() {
    return {
      title: THEME.title, wanted: this._musicWanted,
      playing: !!this._musicSource, ready: !!this._musicBuffer,
      loading: !!this._musicLoading, unavailable: this._musicUnavailable,
      enabled: this.enabled, contextState: this.context?.state ?? 'locked',
    };
  }

  setGameMusic(active) {
    this._musicWanted = !!active && !this._disposed;
    if (this._musicWanted) this._ensureMusic();
    else this._stopMusic();
  }

  _ensureMusic() {
    if (!this._musicWanted || this._disposed || this._musicUnavailable || this._musicSource || this.context?.state !== 'running') return;
    if (!this._musicBuffer) {
      if (!this._musicLoading) {
        // Render once, then let the audio device loop it without JS timing jitter.
        this._musicLoading = renderTheme().then(buffer => {
          this._musicLoading = null;
          if (this._disposed) return;
          this._musicBuffer = buffer;
          this._ensureMusic(); // Recheck intent: the player may already have left.
        }).catch(() => {
          this._musicLoading = null;
          this._musicUnavailable = true; // Hardware effects and the game still work.
        });
      }
      return;
    }
    const ctx = this.context;
    const source = ctx.createBufferSource();
    const gain = ctx.createGain();
    source.buffer = this._musicBuffer;
    source.loop = true;
    source.loopStart = 0;
    source.loopEnd = this._musicBuffer.duration;
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(.42, ctx.currentTime + .035);
    source.connect(gain); gain.connect(this.master);
    source.onended = () => { source.disconnect(); gain.disconnect(); };
    source.start();
    this._musicSource = source;
    this._musicGain = gain;
  }

  _stopMusic() {
    if (!this._musicSource) return;
    const now = this.context.currentTime;
    this._musicGain.gain.cancelScheduledValues(now);
    this._musicGain.gain.setTargetAtTime(0, now, .015);
    this._musicSource.stop(now + .08);
    this._musicSource = null;
    this._musicGain = null;
  }

  _tone(frequency, duration, { delay = 0, type = 'square', gain = 0.15, endFrequency = frequency } = {}) {
    const ctx = this.context;
    const start = ctx.currentTime + delay;
    const oscillator = ctx.createOscillator();
    const envelope = ctx.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, start);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, endFrequency), start + duration);
    envelope.gain.setValueAtTime(0.0001, start);
    envelope.gain.exponentialRampToValueAtTime(gain, start + 0.004);
    envelope.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(envelope); envelope.connect(this.master);
    oscillator.start(start); oscillator.stop(start + duration + 0.02);
    oscillator.onended = () => { oscillator.disconnect(); envelope.disconnect(); };
  }

  _noise(duration, { delay = 0, frequency = 1700, gain = 0.35, q = 0.8 } = {}) {
    const ctx = this.context;
    const start = ctx.currentTime + delay;
    const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * duration), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const source = ctx.createBufferSource(); source.buffer = buffer;
    const filter = ctx.createBiquadFilter(); filter.type = 'bandpass'; filter.frequency.value = frequency; filter.Q.value = q;
    const envelope = ctx.createGain();
    envelope.gain.setValueAtTime(gain, start);
    envelope.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    source.connect(filter); filter.connect(envelope); envelope.connect(this.master);
    source.start(start);
    source.onended = () => { source.disconnect(); filter.disconnect(); envelope.disconnect(); };
  }

  play(sound) {
    if (!this.enabled || !this.context || this.context.state !== 'running') return;
    const now = this.context.currentTime;
    switch (sound) {
      case 'key':
        if (now - this._lastKey < 0.025) return;
        this._lastKey = now;
        this._noise(0.035, { frequency: 2300, gain: 0.25 });
        this._tone(170, 0.025, { type: 'triangle', gain: 0.09 });
        break;
      case 'power':
        this._noise(0.075, { frequency: 500, gain: 0.7 });
        this._noise(0.04, { frequency: 2100, gain: 0.25, delay: 0.05 });
        break;
      case 'boot':
        this._tone(980, 0.105, { gain: 0.13 });
        break;
      case 'disk':
        if (now - this._lastDisk < 0.22) return;
        this._lastDisk = now;
        for (let i = 0; i < 7; i++) {
          const delay = i * 0.045 + (i % 2) * 0.016;
          this._noise(0.04, { delay, frequency: 780 + (i % 3) * 240, gain: 0.17 });
          this._tone(110 + (i % 3) * 35, 0.032, { delay, type: 'sawtooth', gain: 0.035 });
        }
        break;
      case 'error':
        this._tone(135, 0.1, { gain: 0.12 });
        this._tone(100, 0.12, { delay: 0.1, gain: 0.1 });
        break;
      case 'collect':
        this._tone(780, 0.055, { gain: 0.075 });
        this._tone(1170, 0.09, { delay: 0.05, gain: 0.065 });
        break;
      case 'save':
        [523, 659, 784].forEach((frequency, i) => this._tone(frequency, 0.12, { delay: i * 0.085, gain: 0.07 }));
        break;
      case 'switch': this._noise(0.035, { frequency: 1200, gain: 0.35 }); break;
    }
  }

  async dispose() {
    this._disposed = true;
    this.setGameMusic(false);
    if (this.context) await this.context.close();
    this.context = null;
    this.master = null;
    this._musicBuffer = null;
  }
}
