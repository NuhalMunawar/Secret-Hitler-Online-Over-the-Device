// Multi-layered Procedural Web Audio Tabletop & Political Thriller Sound Engine

class SoundEngine {
  private ctx: AudioContext | null = null;
  public muted: boolean = false;
  public ambienceActive: boolean = false;
  private ambienceNodes: { stop: () => void } | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      this.muted = localStorage.getItem('sh_sound_muted') === 'true';
    }
  }

  private getContext(): AudioContext | null {
    if (this.muted || typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public toggleMute(): boolean {
    this.muted = !this.muted;
    if (typeof window !== 'undefined') {
      localStorage.setItem('sh_sound_muted', String(this.muted));
    }
    if (this.muted && this.ambienceActive) {
      this.stopAmbience();
    } else if (!this.muted) {
      this.playClick();
    }
    return this.muted;
  }

  public toggleAmbience(): boolean {
    if (this.ambienceActive) {
      this.stopAmbience();
      return false;
    } else {
      if (this.muted) {
        this.muted = false;
        if (typeof window !== 'undefined') {
          localStorage.setItem('sh_sound_muted', 'false');
        }
      }
      this.startAmbience();
      return this.ambienceActive;
    }
  }

  private startAmbience() {
    const ctx = this.getContext();
    if (!ctx) return;
    this.stopAmbience();

    const now = ctx.currentTime;
    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0.01, now);
    masterGain.gain.linearRampToValueAtTime(0.055, now + 1.5);
    masterGain.connect(ctx.destination);

    // Subtle dark parlor drone (D2 + A2 detuned)
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(73.42, now); // D2
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(110.0, now); // A2

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(190, now);

    lfo.type = 'sine';
    lfo.frequency.setValueAtTime(0.18, now);
    lfoGain.gain.setValueAtTime(45, now);

    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(masterGain);

    osc1.start(now);
    osc2.start(now);
    lfo.start(now);

    this.ambienceActive = true;
    this.ambienceNodes = {
      stop: () => {
        try {
          masterGain.gain.setValueAtTime(masterGain.gain.value, ctx.currentTime);
          masterGain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.3);
          setTimeout(() => {
            try {
              osc1.stop();
              osc2.stop();
              lfo.stop();
              masterGain.disconnect();
            } catch {}
          }, 350);
        } catch {}
      },
    };
  }

  private stopAmbience() {
    if (this.ambienceNodes) {
      this.ambienceNodes.stop();
      this.ambienceNodes = null;
    }
    this.ambienceActive = false;
  }

  // Tactile wooden piece tap + subtle table resonance
  public playClick() {
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(580, now);
    osc.frequency.exponentialRampToValueAtTime(135, now + 0.048);

    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.048);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.052);
  }

  // Realistic multi-card riffle shuffle + deck square tap
  public playCardShuffle() {
    const ctx = this.getContext();
    if (!ctx) return;

    const riffleCount = 10;
    for (let i = 0; i < riffleCount; i++) {
      const start = ctx.currentTime + i * 0.042 + (i > 4 ? 0.03 : 0);
      const duration = 0.032;
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
      filter.Q.value = 2.4;

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.16, start);
      gain.gain.exponentialRampToValueAtTime(0.005, start + duration);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      noise.start(start);
    }

    // Final wooden table tap to square the deck
    const tapTime = ctx.currentTime + riffleCount * 0.045 + 0.08;
    const osc = ctx.createOscillator();
    const tapGain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(240, tapTime);
    osc.frequency.exponentialRampToValueAtTime(75, tapTime + 0.08);
    tapGain.gain.setValueAtTime(0.24, tapTime);
    tapGain.gain.exponentialRampToValueAtTime(0.001, tapTime + 0.08);
    osc.connect(tapGain);
    tapGain.connect(ctx.destination);
    osc.start(tapTime);
    osc.stop(tapTime + 0.09);
  }

  // Envelope / Policy card paper slide + wax seal crack
  public playPaperSlide() {
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const duration = 0.16;
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
    filter.frequency.setValueAtTime(850, now);
    filter.frequency.exponentialRampToValueAtTime(2100, now + duration);
    filter.Q.value = 1.6;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.008, now + duration);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    noise.start(now);
  }

  // Heavy oak ballot box clack
  public playVoteCast() {
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    // Wood transient
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'triangle';
    osc1.frequency.setValueAtTime(360, now);
    osc1.frequency.exponentialRampToValueAtTime(92, now + 0.085);
    gain1.gain.setValueAtTime(0.26, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.085);

    // Secondary hollow box resonance
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(185, now + 0.025);
    osc2.frequency.exponentialRampToValueAtTime(115, now + 0.11);
    gain2.gain.setValueAtTime(0.15, now + 0.025);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.11);

    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);

    osc1.start(now);
    osc1.stop(now + 0.09);
    osc2.start(now + 0.025);
    osc2.stop(now + 0.12);
  }

  // Double wooden gavel strike
  public playGavel() {
    const ctx = this.getContext();
    if (!ctx) return;

    [0, 0.15].forEach((offset, idx) => {
      const now = ctx.currentTime + offset;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(idx === 0 ? 250 : 280, now);
      osc.frequency.exponentialRampToValueAtTime(62, now + 0.12);

      gain.gain.setValueAtTime(0.34, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.13);
    });
  }

  // Election result sound (Gavel + Passed Fanfare or Failed Low Brass)
  public playVoteResult(passed: boolean) {
    this.playGavel();
    const ctx = this.getContext();
    if (!ctx) return;

    if (passed) {
      const notes = [196.0, 261.63, 329.63, 392.0]; // G3, C4, E4, G4
      notes.forEach((freq, i) => {
        const start = ctx.currentTime + 0.28 + i * 0.06;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, start);
        gain.gain.setValueAtTime(0.14, start);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.38);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(start);
        osc.stop(start + 0.4);
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
        filter.frequency.setValueAtTime(420, start);
        gain.gain.setValueAtTime(0.14, start);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.35);
        osc.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);
        osc.start(start);
        osc.stop(start + 0.36);
      });
    }
  }

  /**
   * 3.2-Second Intense Mysterious Suspense Cue
   * Played when a Chancellor is elected after 3+ Fascist policies are enacted,
   * before revealing whether that person is Fascist (Hitler) or Liberal!
   */
  public playChancellorSuspense() {
    const ctx = this.getContext();
    if (!ctx) return;

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
      // Slight pitch bend upward at the end for unbearable tension
      osc.frequency.linearRampToValueAtTime(freq * 1.03, now + totalDuration);

      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(220, now);
      filter.frequency.exponentialRampToValueAtTime(1450, now + totalDuration * 0.85);
      filter.frequency.exponentialRampToValueAtTime(520, now + totalDuration);
      filter.Q.value = 3.2;

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.11, now + 0.6);
      gain.gain.linearRampToValueAtTime(0.16, now + totalDuration - 0.25);
      gain.gain.exponentialRampToValueAtTime(0.001, now + totalDuration);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

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
      lfoGain.gain.setValueAtTime(0.025, now);

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.035, now + 1.2);
      gain.gain.exponentialRampToValueAtTime(0.0005, now + totalDuration);

      lfo.connect(lfoGain);
      lfoGain.connect(gain.gain);
      osc.connect(gain);
      gain.connect(ctx.destination);

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
        const startFreq = subIdx === 0 ? 68 + i * 3 : 56 + i * 3;
        osc.frequency.setValueAtTime(startFreq, t);
        osc.frequency.exponentialRampToValueAtTime(32, t + 0.13);

        gain.gain.setValueAtTime(subIdx === 0 ? 0.34 : 0.24, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.14);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t);
        osc.stop(t + 0.15);
      });
    });
  }

  // Climax reveal sound after the 3.15-second Hitler check (only depends on isHitler)
  public playSuspenseReveal(isHitler: boolean) {
    const ctx = this.getContext();
    if (!ctx) return;

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
        gain.gain.setValueAtTime(0.14, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.9);
        osc.connect(gain);
        gain.connect(ctx.destination);
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
        filter.frequency.setValueAtTime(950, t);
        filter.frequency.exponentialRampToValueAtTime(240, t + 1.0);

        gain.gain.setValueAtTime(0.18, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 1.05);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t);
        osc.stop(t + 1.08);
      });
    }
  }

  // Bright noble chord when a Liberal policy is enacted
  public playLiberalPolicy() {
    this.playClick();
    const ctx = this.getContext();
    if (!ctx) return;

    const notes = [261.63, 329.63, 392.0, 493.88, 523.25]; // C4, E4, G4, B4, C5
    notes.forEach((freq, idx) => {
      const now = ctx.currentTime + idx * 0.065;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now);

      gain.gain.setValueAtTime(0.16, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.55);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.56);
    });
  }

  // Ominous low brass chord + timpani thud when a Fascist policy is enacted
  public playFascistPolicy() {
    this.playClick();
    const ctx = this.getContext();
    if (!ctx) return;

    const notes = [146.83, 138.59, 110.0, 73.42]; // D3, Db3, A2, D2
    notes.forEach((freq, idx) => {
      const now = ctx.currentTime + idx * 0.085;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, now);

      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(540, now);
      filter.frequency.exponentialRampToValueAtTime(180, now + 0.65);

      gain.gain.setValueAtTime(0.17, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.65);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.66);
    });
  }

  // Chaos alarm gong + cascading timpani roll when 3 elections fail
  public playChaos() {
    const ctx = this.getContext();
    if (!ctx) return;

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
      filter.frequency.setValueAtTime(750, t);

      gain.gain.setValueAtTime(0.2, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.72);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.75);
    });
  }

  // Mysterious noir chord for Loyalty Investigation & Policy Peek
  public playInvestigation() {
    const ctx = this.getContext();
    if (!ctx) return;

    const notes = [220.0, 261.63, 329.63, 493.88]; // A3, C4, E4, B4 (A minor add9)
    notes.forEach((freq, idx) => {
      const t = ctx.currentTime + idx * 0.08;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t);

      gain.gain.setValueAtTime(0.14, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.75);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.76);
    });
  }

  // Sharp execution crack + low sub drop
  public playExecution() {
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    // Metallic click
    this.playClick();

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
    gain.gain.setValueAtTime(0.42, now + 0.06);
    gain.gain.exponentialRampToValueAtTime(0.008, now + 0.06 + duration);

    noise.connect(gain);
    gain.connect(ctx.destination);
    noise.start(now + 0.06);

    // Low sub-bass drop
    const osc = ctx.createOscillator();
    const oscGain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(145, now + 0.06);
    osc.frequency.exponentialRampToValueAtTime(34, now + 0.55);

    oscGain.gain.setValueAtTime(0.38, now + 0.06);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.55);

    osc.connect(oscGain);
    oscGain.connect(ctx.destination);
    osc.start(now + 0.06);
    osc.stop(now + 0.56);
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
