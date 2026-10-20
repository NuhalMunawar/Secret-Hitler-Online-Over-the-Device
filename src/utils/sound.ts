// Multi-layered Procedural Web Audio Tabletop & Political Thriller Sound Engine

const AMBIENCE_AUDIO_URL =
  '/assets/aistudio/_Suspense_Music_No_Copyright_Suspense_Background_Music_No_Copyright_-_Royalty_Free_Suspense_Music_66da33e5.ogg';

class SoundEngine {
  private ctx: AudioContext | null = null;
  private sfxGain: GainNode | null = null;
  private sfxCompressor: DynamicsCompressorNode | null = null;
  public muted: boolean = false;
  public ambienceActive: boolean = true;
  public ambienceVolume: number = 0.28;
  public animationsEnabled: boolean = true;
  private ambienceAudio: HTMLAudioElement | null = null;
  private duckTimeout: ReturnType<typeof setTimeout> | null = null;
  private duckRestoreInterval: ReturnType<typeof setInterval> | null = null;
  private lastPlayedMap: Map<string, number> = new Map();
  private listeners: Set<() => void> = new Set();

  constructor() {
    if (typeof window !== 'undefined') {
      this.muted = localStorage.getItem('sh_sound_muted') === 'true';
      this.animationsEnabled = localStorage.getItem('sh_animations_enabled') !== 'false';
      this.ambienceActive = localStorage.getItem('sh_ambience_enabled') !== 'false';
      const savedAmbienceVol = localStorage.getItem('sh_ambience_volume');
      if (savedAmbienceVol !== null) {
        const parsed = parseFloat(savedAmbienceVol);
        if (!isNaN(parsed) && parsed >= 0 && parsed <= 1) {
          this.ambienceVolume = parsed;
        }
      }

      if (this.ambienceActive) {
        this.tryPlayAmbienceElement();
      }

      // Unlock and resume Web Audio context + default background music on any user interaction
      const unlockAudio = () => {
        this.ensureAudioContext();
        if (this.ambienceActive && (!this.ambienceAudio || this.ambienceAudio.paused)) {
          this.tryPlayAmbienceElement();
        }
      };
      window.addEventListener('pointerdown', unlockAudio, { passive: true });
      window.addEventListener('keydown', unlockAudio, { passive: true });
      window.addEventListener('touchstart', unlockAudio, { passive: true });
      window.addEventListener('click', unlockAudio, { passive: true });
    }
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.listeners.forEach((l) => l());
  }

  private ensureAudioContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && !this.sfxGain) {
      try {
        this.sfxCompressor = this.ctx.createDynamicsCompressor();
        this.sfxCompressor.threshold.setValueAtTime(-14, this.ctx.currentTime);
        this.sfxCompressor.knee.setValueAtTime(12, this.ctx.currentTime);
        this.sfxCompressor.ratio.setValueAtTime(4, this.ctx.currentTime);
        this.sfxCompressor.attack.setValueAtTime(0.002, this.ctx.currentTime);
        this.sfxCompressor.release.setValueAtTime(0.15, this.ctx.currentTime);

        this.sfxGain = this.ctx.createGain();
        // Boost procedural SFX so they cut clearly through background suspense music
        this.sfxGain.gain.setValueAtTime(2.4, this.ctx.currentTime);

        this.sfxGain.connect(this.sfxCompressor);
        this.sfxCompressor.connect(this.ctx.destination);
      } catch {
        this.sfxGain = null;
        this.sfxCompressor = null;
      }
    }
    if (this.ctx && (this.ctx.state === 'suspended' || (this.ctx.state as string) === 'interrupted')) {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  private getDestination(ctx: AudioContext): AudioNode {
    return this.sfxGain || ctx.destination;
  }

  // Temporarily ducks background suspense music volume when SFX plays so SFX is always clearly heard
  private duckAmbience(durationMs: number = 260, duckFactor: number = 0.28) {
    if (!this.ambienceActive || !this.ambienceAudio) return;
    try {
      if (this.duckTimeout) {
        clearTimeout(this.duckTimeout);
        this.duckTimeout = null;
      }
      if (this.duckRestoreInterval) {
        clearInterval(this.duckRestoreInterval);
        this.duckRestoreInterval = null;
      }

      const targetDuckedVol = Math.max(0, Math.min(1, this.ambienceVolume * duckFactor));
      if (this.ambienceAudio.volume > targetDuckedVol) {
        this.ambienceAudio.volume = targetDuckedVol;
      }

      this.duckTimeout = setTimeout(() => {
        if (!this.ambienceActive || !this.ambienceAudio) return;
        const steps = 6;
        let currentStep = 0;
        const startVol = this.ambienceAudio.volume;
        const endVol = this.ambienceVolume;
        this.duckRestoreInterval = setInterval(() => {
          currentStep++;
          if (!this.ambienceActive || !this.ambienceAudio || currentStep >= steps) {
            if (this.ambienceAudio && this.ambienceActive) {
              this.ambienceAudio.volume = this.ambienceVolume;
            }
            if (this.duckRestoreInterval) {
              clearInterval(this.duckRestoreInterval);
              this.duckRestoreInterval = null;
            }
            return;
          }
          const progress = currentStep / steps;
          this.ambienceAudio.volume = Math.max(
            0,
            Math.min(1, startVol + (endVol - startVol) * progress)
          );
        }, 35);
      }, durationMs);
    } catch {
      // Ignore volume duck errors
    }
  }

  // Deduplicates identical SFX calls within `cooldownMs` and guarantees execution even if AudioContext was suspended
  private playWithContext(
    key: string,
    cooldownMs: number,
    duckMs: number,
    duckFactor: number,
    synthFn: (ctx: AudioContext, dest: AudioNode) => void
  ) {
    if (this.muted || typeof window === 'undefined') return;

    const nowMs = Date.now();
    const lastMs = this.lastPlayedMap.get(key) || 0;
    if (cooldownMs > 0 && nowMs - lastMs < cooldownMs) return;
    this.lastPlayedMap.set(key, nowMs);

    const ctx = this.ensureAudioContext();
    if (!ctx) return;

    this.duckAmbience(duckMs, duckFactor);
    const dest = this.getDestination(ctx);

    if (ctx.state === 'running') {
      synthFn(ctx, dest);
    } else {
      ctx
        .resume()
        .then(() => {
          synthFn(ctx, this.getDestination(ctx));
        })
        .catch(() => {
          try {
            synthFn(ctx, dest);
          } catch {}
        });
    }
  }

  public toggleMute(): boolean {
    this.muted = !this.muted;
    if (typeof window !== 'undefined') {
      localStorage.setItem('sh_sound_muted', String(this.muted));
    }
    if (!this.muted) {
      this.playClick();
    }
    this.notify();
    return this.muted;
  }

  public toggleAnimations(): boolean {
    this.animationsEnabled = !this.animationsEnabled;
    if (typeof window !== 'undefined') {
      localStorage.setItem('sh_animations_enabled', String(this.animationsEnabled));
    }
    this.notify();
    return this.animationsEnabled;
  }

  public setAnimationsEnabled(enabled: boolean) {
    this.animationsEnabled = enabled;
    if (typeof window !== 'undefined') {
      localStorage.setItem('sh_animations_enabled', String(enabled));
    }
    this.notify();
  }

  public setAmbienceVolume(volume: number) {
    const clamped = Math.max(0, Math.min(1, volume));
    this.ambienceVolume = clamped;
    if (typeof window !== 'undefined') {
      localStorage.setItem('sh_ambience_volume', String(clamped));
    }
    if (this.ambienceAudio) {
      this.ambienceAudio.volume = clamped;
    }
    this.ensureAudioContext();
    this.notify();
  }

  public toggleAmbience(): boolean {
    this.ensureAudioContext();
    if (this.ambienceActive) {
      this.stopAmbience();
      return false;
    } else {
      this.startAmbience();
      return true;
    }
  }

  private tryPlayAmbienceElement() {
    if (typeof window === 'undefined' || !this.ambienceActive) return;
    try {
      if (!this.ambienceAudio) {
        this.ambienceAudio = new Audio(AMBIENCE_AUDIO_URL);
        this.ambienceAudio.loop = true;
      }
      this.ambienceAudio.volume = this.ambienceVolume;
      const playPromise = this.ambienceAudio.play();
      if (playPromise !== undefined) {
        playPromise.catch(() => {
          // If blocked by browser autoplay policy before first gesture,
          // keep ambienceActive = true so unlockAudio starts it on first interaction.
        });
      }
    } catch {
      // Ignore audio element init errors
    }
  }

  public startAmbience() {
    if (typeof window === 'undefined') return;
    this.ambienceActive = true;
    localStorage.setItem('sh_ambience_enabled', 'true');
    this.ensureAudioContext();
    this.tryPlayAmbienceElement();
    this.notify();
  }

  public stopAmbience() {
    if (this.duckTimeout) {
      clearTimeout(this.duckTimeout);
      this.duckTimeout = null;
    }
    if (this.duckRestoreInterval) {
      clearInterval(this.duckRestoreInterval);
      this.duckRestoreInterval = null;
    }
    if (this.ambienceAudio) {
      try {
        this.ambienceAudio.pause();
        this.ambienceAudio.currentTime = 0;
      } catch {}
    }
    this.ambienceActive = false;
    if (typeof window !== 'undefined') {
      localStorage.setItem('sh_ambience_enabled', 'false');
    }
    this.notify();
  }

  // Tactile wooden piece tap + subtle table resonance
  public playClick() {
    this.playWithContext('click', 25, 180, 0.35, (ctx, dest) => {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(640, now);
      osc.frequency.exponentialRampToValueAtTime(145, now + 0.055);

      gain.gain.setValueAtTime(0.32, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.055);

      osc.connect(gain);
      gain.connect(dest);
      osc.start(now);
      osc.stop(now + 0.06);
    });
  }

  // Realistic multi-card riffle shuffle + deck square tap
  public playCardShuffle() {
    this.playWithContext('shuffle', 80, 750, 0.22, (ctx, dest) => {
      const riffleCount = 10;
      for (let i = 0; i < riffleCount; i++) {
        const start = ctx.currentTime + i * 0.042 + (i > 4 ? 0.03 : 0);
        const duration = 0.035;
        const bufferSize = Math.floor(ctx.sampleRate * duration);
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let j = 0; j < bufferSize; j++) {
          data[j] = (Math.random() * 2 - 1) * Math.exp(-j / (bufferSize * 0.4));
        }

        const noise = ctx.createBufferSource();
        noise.buffer = buffer;

        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(1100 + i * 110, start);
        filter.Q.value = 1.8;

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.34, start);
        gain.gain.exponentialRampToValueAtTime(0.005, start + duration);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(dest);
        noise.start(start);
      }

      // Final wooden table tap to square the deck
      const tapTime = ctx.currentTime + riffleCount * 0.045 + 0.08;
      const osc = ctx.createOscillator();
      const tapGain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(240, tapTime);
      osc.frequency.exponentialRampToValueAtTime(75, tapTime + 0.085);
      tapGain.gain.setValueAtTime(0.38, tapTime);
      tapGain.gain.exponentialRampToValueAtTime(0.001, tapTime + 0.085);
      osc.connect(tapGain);
      tapGain.connect(dest);
      osc.start(tapTime);
      osc.stop(tapTime + 0.095);
    });
  }

  // Envelope / Policy card paper slide + wax seal crack
  public playPaperSlide() {
    this.playWithContext('paperSlide', 40, 280, 0.28, (ctx, dest) => {
      const now = ctx.currentTime;
      const duration = 0.17;
      const bufferSize = Math.floor(ctx.sampleRate * duration);
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.sin((i / bufferSize) * Math.PI);
      }

      const noise = ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(900, now);
      filter.frequency.exponentialRampToValueAtTime(2200, now + duration);
      filter.Q.value = 1.2;

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.38, now);
      gain.gain.exponentialRampToValueAtTime(0.008, now + duration);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(dest);
      noise.start(now);

      // Subtle cardstock edge flick
      const flickOsc = ctx.createOscillator();
      const flickGain = ctx.createGain();
      flickOsc.type = 'triangle';
      flickOsc.frequency.setValueAtTime(420, now + 0.02);
      flickOsc.frequency.exponentialRampToValueAtTime(160, now + 0.08);
      flickGain.gain.setValueAtTime(0.18, now + 0.02);
      flickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
      flickOsc.connect(flickGain);
      flickGain.connect(dest);
      flickOsc.start(now + 0.02);
      flickOsc.stop(now + 0.085);
    });
  }

  // Alias for card slide animation reveal in PolicyEnactmentModal
  public playCardSlide() {
    this.playPaperSlide();
  }

  // Heavy oak ballot box clack
  public playVoteCast() {
    this.playWithContext('voteCast', 40, 260, 0.25, (ctx, dest) => {
      const now = ctx.currentTime;
      // Wood transient
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'triangle';
      osc1.frequency.setValueAtTime(380, now);
      osc1.frequency.exponentialRampToValueAtTime(95, now + 0.09);
      gain1.gain.setValueAtTime(0.38, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

      // Secondary hollow box resonance
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(195, now + 0.025);
      osc2.frequency.exponentialRampToValueAtTime(115, now + 0.12);
      gain2.gain.setValueAtTime(0.24, now + 0.025);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

      osc1.connect(gain1);
      gain1.connect(dest);
      osc2.connect(gain2);
      gain2.connect(dest);

      osc1.start(now);
      osc1.stop(now + 0.095);
      osc2.start(now + 0.025);
      osc2.stop(now + 0.13);
    });
  }

  // Double wooden gavel strike
  public playGavel() {
    this.playWithContext('gavel', 60, 420, 0.2, (ctx, dest) => {
      [0, 0.15].forEach((offset, idx) => {
        const now = ctx.currentTime + offset;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(idx === 0 ? 260 : 290, now);
        osc.frequency.exponentialRampToValueAtTime(64, now + 0.13);

        gain.gain.setValueAtTime(0.42, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.13);

        osc.connect(gain);
        gain.connect(dest);
        osc.start(now);
        osc.stop(now + 0.14);
      });
    });
  }

  // Election result sound (Gavel + Passed Fanfare or Failed Low Brass)
  public playVoteResult(passed: boolean) {
    this.playGavel();
    this.playWithContext('voteResult', 80, 900, 0.18, (ctx, dest) => {
      if (passed) {
        const notes = [196.0, 261.63, 329.63, 392.0]; // G3, C4, E4, G4
        notes.forEach((freq, i) => {
          const start = ctx.currentTime + 0.28 + i * 0.06;
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq, start);
          gain.gain.setValueAtTime(0.24, start);
          gain.gain.exponentialRampToValueAtTime(0.001, start + 0.42);
          osc.connect(gain);
          gain.connect(dest);
          osc.start(start);
          osc.stop(start + 0.44);
        });
      } else {
        // Descending rejected cadence
        const notes = [164.81, 146.83, 110.0]; // E3, D3, A2
        notes.forEach((freq, i) => {
          const start = ctx.currentTime + 0.28 + i * 0.1;
          const osc = ctx.createOscillator();
          const filter = ctx.createBiquadFilter();
          const gain = ctx.createGain();
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(freq, start);
          filter.type = 'lowpass';
          filter.frequency.setValueAtTime(480, start);
          gain.gain.setValueAtTime(0.24, start);
          gain.gain.exponentialRampToValueAtTime(0.001, start + 0.38);
          osc.connect(filter);
          filter.connect(gain);
          gain.connect(dest);
          osc.start(start);
          osc.stop(start + 0.4);
        });
      }
    });
  }

  /**
   * 3.2-Second Intense Mysterious Suspense Cue
   * Played when a Chancellor is elected after 3+ Fascist policies are enacted,
   * before revealing whether that person is Fascist (Hitler) or Liberal!
   */
  public playChancellorSuspense() {
    this.playWithContext('chancellorSuspense', 150, 3250, 0.12, (ctx, dest) => {
      const now = ctx.currentTime;
      const totalDuration = 3.15;

      // 1. Eerie detuned dark minor-second / tritone mystery drone (A2, Bb2, D3, Eb3)
      const droneFreqs = [110.0, 116.54, 146.83, 155.56];
      droneFreqs.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const filter = ctx.createBiquadFilter();
        const gain = ctx.createGain();

        osc.type = idx % 2 === 0 ? 'sawtooth' : 'triangle';
        osc.frequency.setValueAtTime(freq, now);
        osc.frequency.linearRampToValueAtTime(freq * 1.03, now + totalDuration);

        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(220, now);
        filter.frequency.exponentialRampToValueAtTime(1450, now + totalDuration * 0.85);
        filter.frequency.exponentialRampToValueAtTime(520, now + totalDuration);
        filter.Q.value = 2.6;

        gain.gain.setValueAtTime(0.001, now);
        gain.gain.linearRampToValueAtTime(0.18, now + 0.6);
        gain.gain.linearRampToValueAtTime(0.24, now + totalDuration - 0.25);
        gain.gain.exponentialRampToValueAtTime(0.001, now + totalDuration);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(dest);

        osc.start(now);
        osc.stop(now + totalDuration + 0.05);
      });

      // 2. High mysterious glass tremolo shimmer (880Hz & 932.33Hz)
      [880.0, 932.33].forEach((freq) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const lfo = ctx.createOscillator();
        const lfoGain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now);

        lfo.type = 'sine';
        lfo.frequency.setValueAtTime(6.5, now);
        lfoGain.gain.setValueAtTime(0.03, now);

        gain.gain.setValueAtTime(0.001, now);
        gain.gain.linearRampToValueAtTime(0.05, now + 1.2);
        gain.gain.exponentialRampToValueAtTime(0.0005, now + totalDuration);

        lfo.connect(lfoGain);
        lfoGain.connect(gain.gain);
        osc.connect(gain);
        gain.connect(dest);

        osc.start(now);
        lfo.start(now);
        osc.stop(now + totalDuration);
        lfo.stop(now + totalDuration);
      });

      // 3. Accelerating deep heartbeat pulses (lub-dub)
      const heartbeats = [0.05, 0.78, 1.42, 1.96, 2.42, 2.8];
      heartbeats.forEach((beatOffset, i) => {
        [0, 0.14].forEach((subOffset, subIdx) => {
          const t = now + beatOffset + subOffset;
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          const startFreq = subIdx === 0 ? 72 + i * 3 : 58 + i * 3;
          osc.frequency.setValueAtTime(startFreq, t);
          osc.frequency.exponentialRampToValueAtTime(34, t + 0.13);

          gain.gain.setValueAtTime(subIdx === 0 ? 0.42 : 0.3, t);
          gain.gain.exponentialRampToValueAtTime(0.001, t + 0.14);

          osc.connect(gain);
          gain.connect(dest);
          osc.start(t);
          osc.stop(t + 0.15);
        });
      });
    });
  }

  // Climax reveal sound after the 3.15-second Hitler check (only depends on isHitler)
  public playSuspenseReveal(isHitler: boolean) {
    this.playWithContext('suspenseReveal', 80, 1100, 0.15, (ctx, dest) => {
      const now = ctx.currentTime;

      if (!isHitler) {
        // Relief / clearance chord (Not Hitler)
        const notes = [130.81, 196.0, 261.63, 329.63, 392.0, 523.25]; // C3, G3, C4, E4, G4, C5
        notes.forEach((freq, idx) => {
          const t = now + idx * 0.045;
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq, t);
          gain.gain.setValueAtTime(0.24, t);
          gain.gain.exponentialRampToValueAtTime(0.001, t + 0.9);
          osc.connect(gain);
          gain.connect(dest);
          osc.start(t);
          osc.stop(t + 0.92);
        });
      } else {
        // Dramatic Secret Hitler reveal sting
        const notes = [73.42, 110.0, 146.83, 155.56, 207.65, 293.66]; // D2, A2, D3, Eb3, Ab3, D4
        notes.forEach((freq, idx) => {
          const t = now + idx * 0.03;
          const osc = ctx.createOscillator();
          const filter = ctx.createBiquadFilter();
          const gain = ctx.createGain();
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(freq, t);

          filter.type = 'lowpass';
          filter.frequency.setValueAtTime(980, t);
          filter.frequency.exponentialRampToValueAtTime(240, t + 1.0);

          gain.gain.setValueAtTime(0.26, t);
          gain.gain.exponentialRampToValueAtTime(0.001, t + 1.05);

          osc.connect(filter);
          filter.connect(gain);
          gain.connect(dest);
          osc.start(t);
          osc.stop(t + 1.08);
        });
      }
    });
  }

  // Bright noble chord when a Liberal policy is enacted
  public playLiberalPolicy() {
    this.playClick();
    this.playWithContext('liberalPolicy', 80, 900, 0.18, (ctx, dest) => {
      const notes = [261.63, 329.63, 392.0, 493.88, 523.25]; // C4, E4, G4, B4, C5
      notes.forEach((freq, idx) => {
        const now = ctx.currentTime + idx * 0.065;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now);

        gain.gain.setValueAtTime(0.25, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.55);

        osc.connect(gain);
        gain.connect(dest);
        osc.start(now);
        osc.stop(now + 0.56);
      });
    });
  }

  // Ominous low brass chord + timpani thud when a Fascist policy is enacted
  public playFascistPolicy() {
    this.playClick();
    this.playWithContext('fascistPolicy', 80, 950, 0.18, (ctx, dest) => {
      const notes = [146.83, 138.59, 110.0, 73.42]; // D3, Db3, A2, D2
      notes.forEach((freq, idx) => {
        const now = ctx.currentTime + idx * 0.085;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, now);

        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(600, now);
        filter.frequency.exponentialRampToValueAtTime(190, now + 0.65);

        gain.gain.setValueAtTime(0.26, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.65);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(dest);
        osc.start(now);
        osc.stop(now + 0.66);
      });
    });
  }

  // Heavy wooden tabletop card slam impact (sharp card slap + deep oak table resonance)
  public playCardSlamOnTable() {
    this.playWithContext('cardSlam', 50, 500, 0.15, (ctx, dest) => {
      const now = ctx.currentTime;

      // 1. Sharp card slap transient burst (cardboard hitting table)
      const duration = 0.075;
      const bufferSize = Math.floor(ctx.sampleRate * duration);
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.015));
      }
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;

      const noiseFilter = ctx.createBiquadFilter();
      noiseFilter.type = 'bandpass';
      noiseFilter.frequency.setValueAtTime(1350, now);
      noiseFilter.Q.value = 1.4;

      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(0.55, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + duration);

      noise.connect(noiseFilter);
      noiseFilter.connect(noiseGain);
      noiseGain.connect(dest);
      noise.start(now);

      // 2. Heavy sub-bass table resonance thud (oak table vibrating)
      const thudOsc = ctx.createOscillator();
      const thudGain = ctx.createGain();
      thudOsc.type = 'triangle';
      thudOsc.frequency.setValueAtTime(175, now);
      thudOsc.frequency.exponentialRampToValueAtTime(46, now + 0.2);

      thudGain.gain.setValueAtTime(0.58, now);
      thudGain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);

      thudOsc.connect(thudGain);
      thudGain.connect(dest);
      thudOsc.start(now);
      thudOsc.stop(now + 0.25);
    });
  }

  // Dynamic policy enactment soundtrack + card slam
  public playPolicySlam(policy: 'LIBERAL' | 'FASCIST') {
    this.playCardSlamOnTable();
    this.playWithContext(`policySlam_${policy}`, 60, 1100, 0.14, (ctx, dest) => {
      const now = ctx.currentTime + 0.05;

      if (policy === 'LIBERAL') {
        // Noble, uplifting trumpet & strings herald (C4, E4, G4, C5, E5)
        const notes = [261.63, 329.63, 392.0, 523.25, 659.25];
        notes.forEach((freq, idx) => {
          const t = now + idx * 0.07;
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq, t);

          gain.gain.setValueAtTime(0.28, t);
          gain.gain.exponentialRampToValueAtTime(0.001, t + 0.72);

          osc.connect(gain);
          gain.connect(dest);
          osc.start(t);
          osc.stop(t + 0.75);
        });
      } else {
        // Dark, menacing, thunderous imperial brass chord (D2, A2, D3, F3, Ab3)
        const notes = [73.42, 110.0, 146.83, 174.61, 207.65];
        notes.forEach((freq, idx) => {
          const t = now + idx * 0.05;
          const osc = ctx.createOscillator();
          const filter = ctx.createBiquadFilter();
          const gain = ctx.createGain();

          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(freq, t);

          filter.type = 'lowpass';
          filter.frequency.setValueAtTime(750, t);
          filter.frequency.exponentialRampToValueAtTime(200, t + 0.85);

          gain.gain.setValueAtTime(0.3, t);
          gain.gain.exponentialRampToValueAtTime(0.001, t + 0.85);

          osc.connect(filter);
          filter.connect(gain);
          gain.connect(dest);
          osc.start(t);
          osc.stop(t + 0.88);
        });
      }
    });
  }

  // Chaos alarm gong + cascading timpani roll when 3 elections fail
  public playChaos() {
    this.playWithContext('chaos', 80, 950, 0.15, (ctx, dest) => {
      const now = ctx.currentTime;
      [220.0, 233.08, 311.13, 110.0].forEach((freq, idx) => {
        const t = now + idx * 0.07;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, t);
        osc.frequency.exponentialRampToValueAtTime(freq * 0.82, t + 0.7);

        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(800, t);

        gain.gain.setValueAtTime(0.28, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.72);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(dest);
        osc.start(t);
        osc.stop(t + 0.75);
      });
    });
  }

  // Mysterious noir chord for Loyalty Investigation & Policy Peek
  public playInvestigation() {
    this.playWithContext('investigation', 80, 900, 0.2, (ctx, dest) => {
      const notes = [220.0, 261.63, 329.63, 493.88]; // A3, C4, E4, B4 (A minor add9)
      notes.forEach((freq, idx) => {
        const t = ctx.currentTime + idx * 0.08;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, t);

        gain.gain.setValueAtTime(0.24, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.75);

        osc.connect(gain);
        gain.connect(dest);
        osc.start(t);
        osc.stop(t + 0.76);
      });
    });
  }

  // Sharp execution crack + low sub drop
  public playExecution() {
    this.playClick();
    this.playWithContext('execution', 80, 900, 0.15, (ctx, dest) => {
      const now = ctx.currentTime;

      // Sharp report burst
      const duration = 0.32;
      const bufferSize = Math.floor(ctx.sampleRate * duration);
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.055));
      }

      const noise = ctx.createBufferSource();
      noise.buffer = buffer;

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.48, now + 0.06);
      gain.gain.exponentialRampToValueAtTime(0.008, now + 0.06 + duration);

      noise.connect(gain);
      gain.connect(dest);
      noise.start(now + 0.06);

      // Low sub-bass drop
      const osc = ctx.createOscillator();
      const oscGain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(150, now + 0.06);
      osc.frequency.exponentialRampToValueAtTime(34, now + 0.55);

      oscGain.gain.setValueAtTime(0.45, now + 0.06);
      oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.55);

      osc.connect(oscGain);
      oscGain.connect(dest);
      osc.start(now + 0.06);
      osc.stop(now + 0.56);
    });
  }

  // Victory fanfare
  public playVictory(winner: 'LIBERAL' | 'FASCIST') {
    if (winner === 'LIBERAL') {
      this.playLiberalPolicy();
      setTimeout(() => this.playLiberalPolicy(), 280);
    } else {
      this.playFascistPolicy();
      setTimeout(() => this.playFascistPolicy(), 320);
    }
  }
}

export const sound = new SoundEngine();
