class AudioManager {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.musicGain = null;
    this.sfxGain = null;
    
    this.isMuted = false;
    this.bgmInterval = null;
    this.bgmStep = 0;
    this.bgmTempo = 110; // BPM
    this.bgmPlaying = false;

    // Config default volumes
    this.musicVolume = 0.4;
    this.sfxVolume = 0.6;
  }

  init() {
    if (this.ctx) return;
    
    // Create Audio Context
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    this.ctx = new AudioContextClass();
    
    // Create node graph:
    // Source -> Mute/Gain Nodes -> Destination
    this.masterGain = this.ctx.createGain();
    this.musicGain = this.ctx.createGain();
    this.sfxGain = this.ctx.createGain();

    this.musicGain.connect(this.masterGain);
    this.sfxGain.connect(this.masterGain);
    this.masterGain.connect(this.ctx.destination);

    // Apply initial volumes
    this.musicGain.gain.value = this.musicVolume;
    this.sfxGain.gain.value = this.sfxVolume;
    this.masterGain.gain.value = 1.0;
  }

  unlock() {
    this.init();
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  setMusicVolume(value) {
    this.musicVolume = Math.max(0, Math.min(1, value));
    if (this.musicGain) {
      this.musicGain.gain.value = this.musicVolume;
    }
  }

  setSfxVolume(value) {
    this.sfxVolume = Math.max(0, Math.min(1, value));
    if (this.sfxGain) {
      this.sfxGain.gain.value = this.sfxVolume;
    }
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    if (this.masterGain) {
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : 1, this.ctx.currentTime);
    }
    return this.isMuted;
  }

  // ================= SFX GENERATORS =================

  playHover() {
    this.unlock();
    if (!this.ctx || this.isMuted) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(600, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1000, this.ctx.currentTime + 0.05);

    gain.gain.setValueAtTime(0.08, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.05);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.05);
  }

  playClick() {
    this.unlock();
    if (!this.ctx || this.isMuted) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(800, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(200, this.ctx.currentTime + 0.08);

    gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.08);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.08);
  }

  playSlice() {
    this.unlock();
    if (!this.ctx || this.isMuted) return;

    const time = this.ctx.currentTime;
    
    // Synth swoosh
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(1200, time);
    osc.frequency.exponentialRampToValueAtTime(120, time + 0.12);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(2000, time);
    filter.frequency.exponentialRampToValueAtTime(300, time + 0.12);

    gain.gain.setValueAtTime(0.3, time);
    gain.gain.exponentialRampToValueAtTime(0.01, time + 0.12);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(time);
    osc.stop(time + 0.12);

    // Layer a bit of filtered white noise for wind/slash texture
    this.playNoiseSwoosh(0.12);
  }

  playNoiseSwoosh(duration) {
    const time = this.ctx.currentTime;
    const bufferSize = this.ctx.sampleRate * duration;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1500, time);
    filter.frequency.exponentialRampToValueAtTime(400, time + duration);
    filter.Q.value = 3.0;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.15, time);
    gain.gain.linearRampToValueAtTime(0.01, time + duration);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);

    noise.start(time);
    noise.stop(time + duration);
  }

  playExplosion() {
    this.unlock();
    if (!this.ctx || this.isMuted) return;

    const time = this.ctx.currentTime;
    const duration = 1.8;
    
    // Low rumble bass drop
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(150, time);
    osc.frequency.linearRampToValueAtTime(20, time + duration);

    gain.gain.setValueAtTime(0.5, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

    // Filter to muddy it up
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(400, time);
    lp.frequency.linearRampToValueAtTime(40, time + duration);

    // Distortion
    const shaper = this.ctx.createWaveShaper();
    shaper.curve = this.makeDistortionCurve(100);

    osc.connect(lp);
    lp.connect(shaper);
    shaper.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(time);
    osc.stop(time + duration);

    // White Noise explosion burst
    const noiseBufferSize = this.ctx.sampleRate * duration;
    const noiseBuffer = this.ctx.createBuffer(1, noiseBufferSize, this.ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < noiseBufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noiseSource = this.ctx.createBufferSource();
    noiseSource.buffer = noiseBuffer;

    const noiseFilter = this.ctx.createBiquadFilter();
    noiseFilter.type = 'lowpass';
    noiseFilter.frequency.setValueAtTime(600, time);
    noiseFilter.frequency.exponentialRampToValueAtTime(20, time + duration);

    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(0.4, time);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, time + duration);

    noiseSource.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(this.sfxGain);

    noiseSource.start(time);
    noiseSource.stop(time + duration);
  }

  makeDistortionCurve(amount) {
    const k = typeof amount === 'number' ? amount : 50;
    const n_samples = 44100;
    const curve = new Float32Array(n_samples);
    const deg = Math.PI / 180;
    for (let i = 0; i < n_samples; ++i) {
      const x = (i * 2) / n_samples - 1;
      curve[i] = ((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x));
    }
    return curve;
  }

  playCombo(count) {
    this.unlock();
    if (!this.ctx || this.isMuted) return;

    const time = this.ctx.currentTime;
    // Pentatonic scale starting at C5, ascending per combo hit
    const scale = [523.25, 587.33, 659.25, 783.99, 880.00, 1046.50, 1174.66, 1318.51, 1567.98, 1760.00];
    const index = Math.min(count - 2, scale.length - 1);
    const baseFreq = scale[index] || 523.25;

    // Synthesize a retro arpeggiated chime
    for (let i = 0; i < 3; i++) {
      const chimeTime = time + i * 0.06;
      const freq = baseFreq * (1 + i * 0.25); // Minor/Major-ish cascade

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const delay = this.ctx.createDelay();
      const delayGain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, chimeTime);

      gain.gain.setValueAtTime(0.12, chimeTime);
      gain.gain.exponentialRampToValueAtTime(0.001, chimeTime + 0.3);

      delay.delayTime.value = 0.08;
      delayGain.gain.value = 0.4;

      osc.connect(gain);
      gain.connect(this.sfxGain);

      // Simple feedback loop for spacey echo
      gain.connect(delay);
      delay.connect(delayGain);
      delayGain.connect(this.sfxGain);
      delayGain.connect(delay); // feedback

      osc.start(chimeTime);
      osc.stop(chimeTime + 0.4);
    }
  }

  playCountdown(isStart = false) {
    this.unlock();
    if (!this.ctx || this.isMuted) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = isStart ? 'sawtooth' : 'sine';
    const freq = isStart ? 880 : 440;
    osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
    
    const duration = isStart ? 0.3 : 0.12;
    gain.gain.setValueAtTime(isStart ? 0.25 : 0.15, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start();
    osc.stop(this.ctx.currentTime + duration);
  }

  playGameOver() {
    this.unlock();
    if (!this.ctx || this.isMuted) return;

    const time = this.ctx.currentTime;
    // Sad descending minor chord progression C -> Ab -> Fm
    const notes = [261.63, 207.65, 174.61, 130.81]; // C4, Ab3, F3, C3
    
    notes.forEach((freq, index) => {
      const noteTime = time + index * 0.18;
      
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const filter = this.ctx.createBiquadFilter();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, noteTime);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(800, noteTime);
      filter.frequency.exponentialRampToValueAtTime(100, noteTime + 0.8);

      gain.gain.setValueAtTime(0.18, noteTime);
      gain.gain.exponentialRampToValueAtTime(0.001, noteTime + 0.8);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.sfxGain);

      osc.start(noteTime);
      osc.stop(noteTime + 0.82);
    });
  }

  playVictory() {
    this.unlock();
    if (!this.ctx || this.isMuted) return;

    const time = this.ctx.currentTime;
    // Happy triumphant major arpeggio
    const notes = [261.63, 329.63, 392.00, 523.25, 659.25, 783.99, 1046.50]; // C4, E4, G4, C5, E5, G5, C6
    
    notes.forEach((freq, index) => {
      const noteTime = time + index * 0.08;
      
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, noteTime);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.02, noteTime + 0.4);

      gain.gain.setValueAtTime(0.12, noteTime);
      gain.gain.exponentialRampToValueAtTime(0.001, noteTime + 0.5);

      osc.connect(gain);
      gain.connect(this.sfxGain);

      osc.start(noteTime);
      osc.stop(noteTime + 0.5);
    });
  }

  // ================= MUSIC LOOP SYNTHESIZER =================

  startMusic() {
    this.unlock();
    if (this.bgmPlaying) return;
    this.bgmPlaying = true;
    this.bgmStep = 0;

    const stepDuration = 60 / this.bgmTempo / 2; // Eighth notes
    let nextStepTime = this.ctx.currentTime;

    const scheduleNextSteps = () => {
      while (nextStepTime < this.ctx.currentTime + 0.2) {
        this.playBgmStep(this.bgmStep, nextStepTime);
        this.bgmStep = (this.bgmStep + 1) % 32;
        nextStepTime += stepDuration;
      }
    };

    // Poll scheduler
    this.bgmInterval = setInterval(scheduleNextSteps, 50);
  }

  stopMusic() {
    if (this.bgmInterval) {
      clearInterval(this.bgmInterval);
      this.bgmInterval = null;
    }
    this.bgmPlaying = false;
  }

  playBgmStep(step, time) {
    if (!this.ctx || this.isMuted) return;

    // BGM Structure: 32 Steps Loop
    // Bass Progression (cyberpunk synth pluck)
    // C2 (step 0-7), Eb2 (step 8-15), G2 (step 16-23), F2 (step 24-31)
    const chordProgression = [
      65.41, 65.41, 65.41, 65.41, 65.41, 65.41, 65.41, 65.41, // C2
      77.78, 77.78, 77.78, 77.78, 77.78, 77.78, 77.78, 77.78, // Eb2
      98.00, 98.00, 98.00, 98.00, 98.00, 98.00, 98.00, 98.00, // G2
      87.31, 87.31, 87.31, 87.31, 87.31, 87.31, 87.31, 87.31  // F2
    ];

    const baseBass = chordProgression[step];
    
    // Play Bass Pluck on every step, accented on downbeats
    const bassOsc = this.ctx.createOscillator();
    const bassGain = this.ctx.createGain();
    const bassFilter = this.ctx.createBiquadFilter();

    bassOsc.type = 'sawtooth';
    // Add sub-oscillator for warmth
    bassOsc.frequency.setValueAtTime(baseBass, time);

    bassFilter.type = 'lowpass';
    const initialFreq = (step % 4 === 0) ? 700 : 400;
    bassFilter.frequency.setValueAtTime(initialFreq, time);
    bassFilter.frequency.exponentialRampToValueAtTime(100, time + 0.15);

    const bassVol = (step % 4 === 0) ? 0.25 : 0.15;
    bassGain.gain.setValueAtTime(bassVol, time);
    bassGain.gain.linearRampToValueAtTime(0.001, time + 0.18);

    bassOsc.connect(bassFilter);
    bassFilter.connect(bassGain);
    bassGain.connect(this.musicGain);

    bassOsc.start(time);
    bassOsc.stop(time + 0.2);

    // --- CYBER DRUM KICK ---
    // Kick on steps 0, 4, 8, 12, 16, 20, 24, 28
    if (step % 4 === 0) {
      const kickOsc = this.ctx.createOscillator();
      const kickGain = this.ctx.createGain();

      kickOsc.type = 'sine';
      kickOsc.frequency.setValueAtTime(150, time);
      kickOsc.frequency.exponentialRampToValueAtTime(0.01, time + 0.15);

      kickGain.gain.setValueAtTime(0.35, time);
      kickGain.gain.linearRampToValueAtTime(0.001, time + 0.16);

      kickOsc.connect(kickGain);
      kickGain.connect(this.musicGain);

      kickOsc.start(time);
      kickOsc.stop(time + 0.17);
    }

    // --- CYBER DRUM SNARE / CLAP ---
    // Snare on steps 8, 24
    if (step === 8 || step === 24) {
      const duration = 0.18;
      const bufferSize = this.ctx.sampleRate * duration;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }

      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;

      const bandpass = this.ctx.createBiquadFilter();
      bandpass.type = 'bandpass';
      bandpass.frequency.value = 1000;
      bandpass.Q.value = 2.0;

      const snareGain = this.ctx.createGain();
      snareGain.gain.setValueAtTime(0.16, time);
      snareGain.gain.exponentialRampToValueAtTime(0.001, time + duration);

      noise.connect(bandpass);
      bandpass.connect(snareGain);
      snareGain.connect(this.musicGain);

      noise.start(time);
      noise.stop(time + duration);
    }

    // --- HI-HAT ---
    // Closed hi-hat on offbeats (2, 6, 10, 14, 18, 22, 26, 30)
    if (step % 4 === 2) {
      const duration = 0.04;
      const bufferSize = this.ctx.sampleRate * duration;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }

      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;

      const hp = this.ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 7000;

      const hatGain = this.ctx.createGain();
      hatGain.gain.setValueAtTime(0.07, time);
      hatGain.gain.linearRampToValueAtTime(0.001, time + duration);

      noise.connect(hp);
      hp.connect(hatGain);
      hatGain.connect(this.musicGain);

      noise.start(time);
      noise.stop(time + duration);
    }

    // --- SYNTH WAVE ARPEGGIO MELODY ---
    // Schedule arpeggio note (e.g. C4 minor/pentatonic) on step divisions
    // Only play on steps that are odd: 1, 3, 5, 7, etc. or a structured pattern
    const arpPattern = [1, 3, 5, 7, 9, 11, 13, 15, 17, 19, 21, 23, 25, 27, 29, 31];
    if (arpPattern.includes(step)) {
      // Arpeggiate notes relative to chord
      // Notes: Root, Minor 3rd (or 4th), 5th, Minor 7th, Octave
      const notesOffset = [1, 1.2, 1.5, 1.8, 2.0];
      const noteMultiplier = notesOffset[(step % 5)];
      const arpFreq = baseBass * 4 * noteMultiplier; // 2 octaves up

      const arpOsc = this.ctx.createOscillator();
      const arpGain = this.ctx.createGain();
      
      arpOsc.type = 'triangle';
      arpOsc.frequency.setValueAtTime(arpFreq, time);

      arpGain.gain.setValueAtTime(0.08, time);
      arpGain.gain.linearRampToValueAtTime(0.001, time + 0.12);

      // Simple delay node for arpeggio width
      const arpDelay = this.ctx.createDelay();
      arpDelay.delayTime.value = 0.05;
      const arpDelayGain = this.ctx.createGain();
      arpDelayGain.gain.value = 0.3;

      arpOsc.connect(arpGain);
      arpGain.connect(this.musicGain);

      arpGain.connect(arpDelay);
      arpDelay.connect(arpDelayGain);
      arpDelayGain.connect(this.musicGain);

      arpOsc.start(time);
      arpOsc.stop(time + 0.13);
    }
  }
}

// Singleton audio instance
const audioManager = new AudioManager();
export default audioManager;
