// Ludo Web Audio API Sound Synthesizer
// c:\Users\user\Documents\Projects\Ludoking\public\js\sound.js

const LudoSound = {
  enabled: true,
  ctx: null,

  init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  },

  toggle() {
    this.enabled = !this.enabled;
    return this.enabled;
  },

  // Synthesize rolling dice tumbling sound
  playRoll() {
    if (!this.enabled) return;
    this.init();
    
    const duration = 0.5;
    const osc = this.ctx.createOscillator();
    const gainNode = this.ctx.createGain();
    
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(120, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(30, this.ctx.currentTime + duration);
    
    gainNode.gain.setValueAtTime(0.3, this.ctx.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.01, this.ctx.currentTime + duration);
    
    osc.connect(gainNode);
    gainNode.connect(this.ctx.destination);
    
    osc.start();
    osc.stop(this.ctx.currentTime + duration);

    // Add tiny extra clicks for tumble texture
    for (let i = 0; i < 4; i++) {
      const clickTime = this.ctx.currentTime + (i * 0.12);
      const clickOsc = this.ctx.createOscillator();
      const clickGain = this.ctx.createGain();
      clickOsc.type = 'sine';
      clickOsc.frequency.setValueAtTime(800 - (i * 100), clickTime);
      clickGain.gain.setValueAtTime(0.1, clickTime);
      clickGain.gain.linearRampToValueAtTime(0.01, clickTime + 0.05);
      clickOsc.connect(clickGain);
      clickGain.connect(this.ctx.destination);
      clickOsc.start(clickTime);
      clickOsc.stop(clickTime + 0.05);
    }
  },

  // Synthesize short rising frequencies for token move step
  playMove() {
    if (!this.enabled) return;
    this.init();

    const osc = this.ctx.createOscillator();
    const gainNode = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(330, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(660, this.ctx.currentTime + 0.15);

    gainNode.gain.setValueAtTime(0.2, this.ctx.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.01, this.ctx.currentTime + 0.15);

    osc.connect(gainNode);
    gainNode.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.15);
  },

  // Synthesize noise explosion for token capture
  playCapture() {
    if (!this.enabled) return;
    this.init();

    const duration = 0.4;
    const osc = this.ctx.createOscillator();
    const noiseOsc = this.ctx.createOscillator();
    const gainNode = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(180, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(50, this.ctx.currentTime + duration);

    noiseOsc.type = 'triangle';
    noiseOsc.frequency.setValueAtTime(90, this.ctx.currentTime);
    noiseOsc.frequency.linearRampToValueAtTime(10, this.ctx.currentTime + duration);

    gainNode.gain.setValueAtTime(0.4, this.ctx.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.01, this.ctx.currentTime + duration);

    osc.connect(gainNode);
    noiseOsc.connect(gainNode);
    gainNode.connect(this.ctx.destination);

    osc.start();
    noiseOsc.start();
    osc.stop(this.ctx.currentTime + duration);
    noiseOsc.stop(this.ctx.currentTime + duration);
  },

  // Synthesize uplifting chord for token home entrance
  playHomeEntry() {
    if (!this.enabled) return;
    this.init();

    const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6 arpeggio
    notes.forEach((freq, i) => {
      const time = this.ctx.currentTime + (i * 0.1);
      const osc = this.ctx.createOscillator();
      const gainNode = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, time);
      gainNode.gain.setValueAtTime(0.2, time);
      gainNode.gain.linearRampToValueAtTime(0.01, time + 0.3);

      osc.connect(gainNode);
      gainNode.connect(this.ctx.destination);

      osc.start(time);
      osc.stop(time + 0.3);
    });
  },

  // Synthesize victory fanfare arpeggio
  playWin() {
    if (!this.enabled) return;
    this.init();

    const melody = [
      { note: 261.63, duration: 0.15 }, // C4
      { note: 329.63, duration: 0.15 }, // E4
      { note: 392.00, duration: 0.15 }, // G4
      { note: 523.25, duration: 0.30 }, // C5
      { note: 392.00, duration: 0.15 }, // G4
      { note: 523.25, duration: 0.60 }  // C5
    ];

    let timeAccumulator = this.ctx.currentTime;
    melody.forEach((item) => {
      const osc = this.ctx.createOscillator();
      const gainNode = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(item.note, timeAccumulator);
      gainNode.gain.setValueAtTime(0.25, timeAccumulator);
      gainNode.gain.linearRampToValueAtTime(0.01, timeAccumulator + item.duration);

      osc.connect(gainNode);
      gainNode.connect(this.ctx.destination);

      osc.start(timeAccumulator);
      osc.stop(timeAccumulator + item.duration);

      timeAccumulator += item.duration;
    });
  }
};
