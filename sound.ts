/* Local judgment recordings. */
(function () {
  'use strict';
  let generation = 0;
  let pendingClose: (() => void) | undefined;
  const recordings = {
    correct: new Audio('assets/sounds/correct2.mp3'),
    cage: new Audio('assets/sounds/cage-close.wav'),
    incorrect: new Audio('assets/sounds/incorrect2.mp3'),
    stamp: new Audio('assets/sounds/stamp.wav'),
    applause: new Audio('assets/sounds/people-performance-cheer1.mp3'),
  };
  function stop() {
    generation++;
    const finishClose = pendingClose;
    pendingClose = undefined;
    for (const audio of Object.values(recordings)) {
      audio.onended = null;
      audio.onerror = null;
      audio.onplaying = null;
      audio.pause();
      audio.currentTime = 0;
    }
    // Muting or interrupting a chime must not leave a gate waiting forever.
    finishClose?.();
  }
  async function playRecording(
    correct: boolean,
    onCageStart?: () => void,
    withCageSound = true,
  ) {
    stop();
    if (correct) {
      const request = generation;
      await new Promise<void>((resolve) => {
        let finished = false;
        let closeTimer: ReturnType<typeof setTimeout> | undefined;
        const finish = (playCage: boolean) => {
          if (finished) return;
          finished = true;
          clearTimeout(closeTimer);
          recordings.correct.onended = null;
          recordings.correct.onerror = null;
          recordings.correct.onplaying = null;
          pendingClose = undefined;
          onCageStart?.();
          if (playCage && withCageSound && request === generation) {
            void recordings.cage.play().catch(() => {
              /* Audio must never interrupt the game. */
            });
          }
          resolve();
        };
        pendingClose = () => finish(false);
        recordings.correct.onplaying = () => {
          recordings.correct.onplaying = null;
          // Start from audible playback, not from a potentially delayed play request.
          closeTimer = setTimeout(() => finish(true), 600);
        };
        recordings.correct.onended = () => finish(true);
        recordings.correct.onerror = () => finish(true);
        void recordings.correct.play().catch(() => finish(true));
      });
      return;
    }
    try {
      await recordings.incorrect.play();
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
        void audio.play().catch(() => {
          /* Blocked audio must never interrupt the game. */
        });
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
  window.judgmentSound = {
    play: playRecording,
    stamp: playStamp,
    stop,
  };
})();
