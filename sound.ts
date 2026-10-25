/* Local effect recordings and synthesized testimony tones. */
(function () {
  'use strict';
  let context: AudioContext;
  let generation = 0;
  const recordings = {
    correct: new Audio('assets/sounds/correct2.mp3'),
    incorrect: new Audio('assets/sounds/incorrect2.mp3'),
    stamp: new Audio('assets/sounds/stamp.wav'),
    title: new Audio('assets/sounds/title1.mp3'),
    applause: new Audio('assets/sounds/people-performance-cheer1.mp3'),
  };
  const active = new Set<{ oscillator: OscillatorNode; gain: GainNode }>();
  function stop() {
    generation++;
    for (const audio of Object.values(recordings)) {
      audio.onended = null;
      audio.pause();
      audio.currentTime = 0;
    }
    for (const voice of active) {
      try { voice.oscillator.stop(); } catch { /* Already stopped. */ }
      voice.oscillator.disconnect();
      voice.gain.disconnect();
    }
    active.clear();
  }
  async function playRecording(correct: boolean) {
    stop();
    try {
      await recordings[correct ? 'correct' : 'incorrect'].play();
    } catch {
      // Missing or blocked audio must never interrupt the game.
    }
  }
  async function playStamp(celebrate = false) {
    const request = generation;
    if (celebrate) {
      const playNext = (audio: HTMLAudioElement) => {
        if (request !== generation) return;
        audio.currentTime = 0;
        void audio.play().catch(() => { /* Blocked audio must never interrupt the game. */ });
      };
      recordings.stamp.onended = () => {
        recordings.stamp.onended = null;
        playNext(recordings.applause);
      };
    }
    try {
      recordings.stamp.currentTime = 0;
      await recordings.stamp.play();
    } catch {
      // Missing or blocked audio must never interrupt the game.
    }
  }
  async function playTitle() {
    stop();
    try {
      await recordings.title.play();
    } catch {
      // Missing or blocked audio must never interrupt the game.
    }
  }
  async function playTone() {
    stop();
    const request = generation;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      if (!context || context.state === 'closed') context = new AudioContext();
      if (context.state !== 'running') await context.resume();
      if (request !== generation || context.state !== 'running') return;
      const notes = [440, 554.37];
      const duration = .09;
      const start = context.currentTime;
      notes.forEach((frequency, index) => {
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        const voice = { oscillator, gain };
        active.add(voice);
        oscillator.type = 'sine';
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
  window.judgmentSound = {
    play: playRecording,
    testimony: playTone,
    stamp: playStamp,
    title: playTitle,
    stop,
  };
})();
