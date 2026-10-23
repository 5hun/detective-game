/* Short local tones. Audio is created only in response to a judgment. */
(function () {
  'use strict';
  let context: AudioContext;
  let generation = 0;
  const active = new Set<{ oscillator: OscillatorNode; gain: GainNode }>();
  function stop() {
    generation++;
    for (const voice of active) {
      try { voice.oscillator.stop(); } catch { /* Already stopped. */ }
      voice.oscillator.disconnect();
      voice.gain.disconnect();
    }
    active.clear();
  }
  async function play(correct: boolean) {
    stop();
    const request = generation;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      if (!context || context.state === 'closed') context = new AudioContext();
      if (context.state !== 'running') await context.resume();
      if (request !== generation || context.state !== 'running') return;
      const notes = correct ? [523.25, 659.25, 783.99] : [220, 164.81];
      const duration = correct ? .13 : .19;
      const start = context.currentTime;
      notes.forEach((frequency, index) => {
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        const voice = { oscillator, gain };
        active.add(voice);
        oscillator.type = correct ? 'sine' : 'triangle';
        oscillator.frequency.setValueAtTime(frequency, start + index * duration);
        gain.gain.setValueAtTime(0, start + index * duration);
        gain.gain.linearRampToValueAtTime(.06, start + index * duration + .015);
        gain.gain.linearRampToValueAtTime(0, start + (index + 1) * duration);
        oscillator.connect(gain);
        gain.connect(context.destination);
        oscillator.onended = () => {
          oscillator.disconnect();
          gain.disconnect();
          active.delete(voice);
        };
        oscillator.start(start + index * duration);
        oscillator.stop(start + (index + 1) * duration);
      });
    } catch {
      // Missing or blocked audio must never interrupt the game.
      stop();
    }
  }
  window.judgmentSound = { play, stop };
})();
