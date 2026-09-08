/** Original, locally synthesised music for STAR COURIER. No audio downloads. */
const BPM = 140;
const BARS = 16;
const BEAT = 60 / BPM;
const DURATION = BARS * 4 * BEAT;

export const THEME = Object.freeze({
  title: 'Midnight Courier',
  bpm: BPM,
  bars: BARS,
  duration: DURATION,
});

const hz = note => 440 * 2 ** ((note - 69) / 12);

// A call-and-answer melody in E minor. Numbers are MIDI pitches; -1 is a rest.
// Each row is a bar of eighth notes. The second phrase gets a different ending.
const MELODY = [
  [76, -1, 79, 83, 81, 79, 76, 74],
  [76, 79, 84, -1, 83, 79, 76, -1],
  [79, -1, 83, 86, 83, 81, 79, 76],
  [78, 81, 86, 84, 83, -1, 81, 78],
  [76, -1, 79, 83, 88, -1, 86, 83],
  [84, 83, 79, 76, 79, -1, 76, 72],
  [74, 79, 83, -1, 81, 79, 76, 74],
  [78, -1, 81, 83, 81, 78, 74, -1],
];
const CHORDS = [
  [40, 52, 55, 59], // E minor
  [36, 48, 52, 55], // C
  [43, 55, 59, 62], // G
  [38, 50, 54, 57], // D
];

/** Render once, then loop the returned buffer with AudioBufferSourceNode.loop. */
export async function renderTheme(AudioContextClass = globalThis.OfflineAudioContext) {
  if (!AudioContextClass) throw new Error('Offline audio synthesis is unavailable.');
  const sampleRate = 32000;
  const ctx = new AudioContextClass(2, Math.round(DURATION * sampleRate), sampleRate);
  const mix = ctx.createBiquadFilter();
  mix.type = 'lowpass';
  mix.frequency.value = 6400;
  mix.Q.value = 0.45;
  mix.connect(ctx.destination);

  // A quarter-duty pulse gives the hook the hollow, bright sound of a game chip.
  const real = new Float32Array(33);
  const imaginary = new Float32Array(33);
  for (let n = 1; n < real.length; n++) {
    real[n] = 2 * Math.sin(Math.PI * n / 2) / (Math.PI * n);
    imaginary[n] = 2 * (1 - Math.cos(Math.PI * n / 2)) / (Math.PI * n);
  }
  const pulse = ctx.createPeriodicWave(real, imaginary);

  function envelope(start, duration, gain, pan = 0, attack = 0.003) {
    const end = Math.min(start + duration, DURATION - 0.002);
    const amp = ctx.createGain();
    amp.gain.setValueAtTime(0, start);
    amp.gain.linearRampToValueAtTime(gain, start + attack);
    amp.gain.setValueAtTime(gain * 0.7, start + Math.min(duration * 0.35, 0.045));
    amp.gain.linearRampToValueAtTime(0, end);
    const position = ctx.createStereoPanner();
    position.pan.value = pan;
    amp.connect(position);
    position.connect(mix);
    return { amp, end };
  }

  function tone(note, start, duration, gain, type = 'pulse', pan = 0) {
    const oscillator = ctx.createOscillator();
    if (type === 'pulse') oscillator.setPeriodicWave(pulse);
    else oscillator.type = type;
    oscillator.frequency.value = hz(note);
    const { amp, end } = envelope(start, duration, gain, pan);
    oscillator.connect(amp);
    oscillator.start(start);
    oscillator.stop(end);
  }

  // Reproducible noise, shared by all drum hits. Different offsets vary the hits.
  const noise = ctx.createBuffer(1, sampleRate, sampleRate);
  const noiseData = noise.getChannelData(0);
  let seed = 0x1994cafe;
  for (let i = 0; i < noiseData.length; i++) {
    seed ^= seed << 13;
    seed ^= seed >>> 17;
    seed ^= seed << 5;
    noiseData[i] = (seed >>> 0) / 0x80000000 - 1;
  }

  function percussion(start, duration, gain, frequency, type, pan = 0) {
    const source = ctx.createBufferSource();
    source.buffer = noise;
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = frequency;
    filter.Q.value = 0.65;
    const { amp, end } = envelope(start, duration, gain, pan, 0.001);
    source.connect(filter);
    filter.connect(amp);
    source.start(start, (start * 0.137) % 0.65);
    source.stop(end);
  }

  function kick(start, gain = 0.19) {
    const oscillator = ctx.createOscillator();
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(132, start);
    oscillator.frequency.exponentialRampToValueAtTime(46, start + 0.12);
    const { amp, end } = envelope(start, 0.16, gain);
    oscillator.connect(amp);
    oscillator.start(start);
    oscillator.stop(end);
  }

  for (let bar = 0; bar < BARS; bar++) {
    const beginning = bar * 4 * BEAT;
    const chord = CHORDS[bar % CHORDS.length];
    let melody = MELODY[bar % MELODY.length];
    if (bar === 14) melody = [79, 83, 86, 83, 81, 79, 78, 74];
    if (bar === 15) melody = [78, 81, 83, 81, 78, 74, 71, -1];

    for (let step = 0; step < 8; step++) {
      const time = beginning + step * BEAT / 2;
      const pitch = melody[step];
      if (pitch >= 0) tone(pitch, time, BEAT * (step === 0 ? 0.43 : 0.37), 0.075, 'pulse', -0.08);

      // Octave-jumping bass and quiet sixteenth-note arpeggios keep it moving.
      tone(chord[0] + (step % 4 === 3 ? 12 : 0), time, BEAT * 0.38, 0.15, 'triangle');
      percussion(time, step % 2 ? 0.042 : 0.027, step % 2 ? 0.034 : 0.022, 5800, 'highpass', 0.2);
      for (let half = 0; half < 2; half++) {
        const index = (step * 2 + half) % 3 + 1;
        tone(chord[index] + 12, time + half * BEAT / 4, BEAT * 0.18, 0.019, 'square', 0.22);
      }
    }

    kick(beginning);
    kick(beginning + BEAT * 2);
    if (bar % 2) kick(beginning + BEAT * 2.75, 0.12);
    for (const beat of [1, 3]) {
      const time = beginning + beat * BEAT;
      percussion(time, 0.105, 0.115, 1850, 'bandpass', -0.12);
      tone(50, time, 0.07, 0.045, 'triangle');
    }
    if (bar % 4 === 3) {
      // A short, quiet turnaround; the final silence lets the first kick breathe.
      percussion(beginning + BEAT * 3.5, 0.065, 0.055, 2200, 'bandpass', -0.12);
      percussion(beginning + BEAT * 3.75, 0.055, 0.07, 2400, 'bandpass', -0.12);
    }
  }

  const buffer = await ctx.startRendering();
  let peak = 0;
  for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
    for (const sample of buffer.getChannelData(channel)) peak = Math.max(peak, Math.abs(sample));
  }
  // Reserve headroom for collect/save effects. Both edges reach zero for looping.
  const level = peak > 0 ? 0.6 / peak : 1;
  const fadeFrames = Math.round(sampleRate * 0.004);
  for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
    const data = buffer.getChannelData(channel);
    for (let i = 0; i < data.length; i++) {
      const edge = Math.min(1, i / fadeFrames, (data.length - 1 - i) / fadeFrames);
      data[i] *= level * edge;
    }
  }
  return buffer;
}
