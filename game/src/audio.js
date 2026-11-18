// Tiny WebAudio sound effects, synthesised in code — no audio assets.
// Every effect is a short oscillator blip or noise burst. The context is
// created lazily on the first user gesture, as browsers require.

export function createAudio() {
  let context = null;
  let sirenTimer = 0;

  function ensure() {
    if (!context) {
      try {
        context = new (window.AudioContext || window.webkitAudioContext)();
      } catch {
        context = null;
      }
    }
    if (context && context.state === 'suspended') context.resume();
    return context;
  }

  function tone(freq, seconds, type, volume, slideTo) {
    const ctx = ensure();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type || 'square';
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, ctx.currentTime + seconds);
    gain.gain.setValueAtTime(volume || 0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + seconds);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + seconds);
  }

  function noise(seconds, volume) {
    const ctx = ensure();
    if (!ctx) return;
    const size = Math.floor(ctx.sampleRate * seconds);
    const buffer = ctx.createBuffer(1, size, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < size; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / size);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const gain = ctx.createGain();
    gain.gain.value = volume || 0.12;
    source.connect(gain).connect(ctx.destination);
    source.start();
  }

  return {
    unlock() {
      ensure();
    },
    click() {
      tone(660, 0.07, 'square', 0.05);
    },
    pickup() {
      tone(520, 0.09, 'sine', 0.09);
      setTimeout(() => tone(780, 0.12, 'sine', 0.09), 70);
    },
    cash() {
      tone(880, 0.08, 'triangle', 0.1);
      setTimeout(() => tone(1320, 0.14, 'triangle', 0.1), 80);
    },
    door() {
      tone(180, 0.12, 'triangle', 0.08, 90);
    },
    shot() {
      noise(0.12, 0.16);
      tone(140, 0.1, 'sawtooth', 0.07, 60);
    },
    punch() {
      noise(0.07, 0.12);
    },
    hurt() {
      tone(220, 0.16, 'sawtooth', 0.09, 110);
    },
    crash() {
      noise(0.22, 0.18);
      tone(90, 0.2, 'triangle', 0.1, 45);
    },
    missionDone() {
      tone(523, 0.12, 'triangle', 0.1);
      setTimeout(() => tone(659, 0.12, 'triangle', 0.1), 110);
      setTimeout(() => tone(784, 0.22, 'triangle', 0.1), 220);
    },
    /** A soft two-tone siren blip, throttled by the caller. */
    siren(dt) {
      sirenTimer -= dt;
      if (sirenTimer <= 0) {
        sirenTimer = 0.9;
        tone(740, 0.3, 'sine', 0.03);
        setTimeout(() => tone(988, 0.3, 'sine', 0.03), 300);
      }
    },
  };
}
