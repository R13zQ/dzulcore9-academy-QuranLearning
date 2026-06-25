// Audio Manager for QuranVerse: Odyssey 30
// Generates space ambient BGM pads and clean SFX in real-time using Web Audio API.

class AudioManager {
  constructor() {
    this.ctx = null;
    this.bgmInterval = null;
    this.currentOscillators = [];
    this.masterVolume = null;
    this.delayNode = null;
    this.filterNode = null;
    this.bgmActive = false;
    this.chordIndex = 0;
  }

  init() {
    if (this.ctx) return;
    
    // Create AudioContext with fallback support
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    
    this.ctx = new AudioContextClass();
    
    // Master Volume
    this.masterVolume = this.ctx.createGain();
    this.masterVolume.gain.setValueAtTime(0.5, this.ctx.currentTime);
    this.masterVolume.connect(this.ctx.destination);
    
    // Low pass filter to make synth sounds warm and soft
    this.filterNode = this.ctx.createBiquadFilter();
    this.filterNode.type = 'lowpass';
    this.filterNode.frequency.setValueAtTime(550, this.ctx.currentTime);
    this.filterNode.connect(this.masterVolume);
    
    // Delay/Reverb effect for space ambient feel
    this.delayNode = this.ctx.createDelay(1.0);
    this.delayNode.delayTime.setValueAtTime(0.45, this.ctx.currentTime);
    
    const delayFeedback = this.ctx.createGain();
    delayFeedback.gain.setValueAtTime(0.35, this.ctx.currentTime);
    
    this.delayNode.connect(delayFeedback);
    delayFeedback.connect(this.delayNode);
    
    // Connect filter to delay, and delay to master
    this.filterNode.connect(this.delayNode);
    this.delayNode.connect(this.masterVolume);
  }

  // Soft digital click sound
  playClick() {
    this.init();
    if (!this.ctx) return;
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1000, now);
    osc.frequency.exponentialRampToValueAtTime(150, now + 0.05);
    
    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
    
    osc.connect(gain);
    gain.connect(this.masterVolume);
    
    osc.start(now);
    osc.stop(now + 0.06);
  }

  // High-pitched crystal shard collection sound
  playShard() {
    this.init();
    if (!this.ctx) return;
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1200, now);
    osc.frequency.exponentialRampToValueAtTime(2400, now + 0.15);
    
    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
    
    osc.connect(gain);
    gain.connect(this.masterVolume);
    
    osc.start(now);
    osc.stop(now + 0.22);
  }

  // Beautiful ascending chime
  playCorrect() {
    this.init();
    if (!this.ctx) return;
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    
    const now = this.ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
    
    notes.forEach((freq, idx) => {
      const noteTime = now + (idx * 0.07);
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, noteTime);
      
      gain.gain.setValueAtTime(0.18, noteTime);
      gain.gain.exponentialRampToValueAtTime(0.001, noteTime + 0.35);
      
      osc.connect(gain);
      gain.connect(this.masterVolume);
      
      osc.start(noteTime);
      osc.stop(noteTime + 0.4);
    });
  }

  // Descending alert buzz
  playIncorrect() {
    this.init();
    if (!this.ctx) return;
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    
    const now = this.ctx.currentTime;
    const notes = [220.00, 164.81]; // A3, E3
    
    notes.forEach((freq, idx) => {
      const noteTime = now + (idx * 0.12);
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, noteTime);
      osc.frequency.linearRampToValueAtTime(freq - 30, noteTime + 0.25);
      
      gain.gain.setValueAtTime(0.22, noteTime);
      gain.gain.exponentialRampToValueAtTime(0.001, noteTime + 0.3);
      
      osc.connect(gain);
      gain.connect(this.masterVolume);
      
      osc.start(noteTime);
      osc.stop(noteTime + 0.35);
    });
  }

  // Generative acoustic guitar plucking loop BGM
  startBGM() {
    this.init();
    if (!this.ctx) return;
    
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    
    if (this.bgmActive) return;
    this.bgmActive = true;
    this.chordIndex = 0;
    
    // Smooth master volume setup
    this.masterVolume.gain.setValueAtTime(0.01, this.ctx.currentTime);
    this.masterVolume.gain.linearRampToValueAtTime(0.45, this.ctx.currentTime + 2.0);
    
    const playNextChord = () => {
      if (!this.bgmActive) return;
      this.playGenerativeChord();
      // Schedule next chord in 6 seconds
      this.bgmInterval = setTimeout(playNextChord, 6000);
    };
    
    playNextChord();
  }

  // Simulates a physical acoustic guitar string pluck
  pluckString(freq, time) {
    const now = time || this.ctx.currentTime;
    
    // Fundamental wood body resonance (Triangle wave)
    const osc1 = this.ctx.createOscillator();
    const gain1 = this.ctx.createGain();
    osc1.type = 'triangle';
    osc1.frequency.setValueAtTime(freq, now);
    
    // Darker filter for lower notes, brighter for higher notes
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    const filterFreq = Math.min(2200, freq * 3.5);
    filter.frequency.setValueAtTime(filterFreq, now);
    filter.Q.setValueAtTime(1.2, now);
    
    // Envelope: sharp pick attack, natural wood decay
    gain1.gain.setValueAtTime(0.0, now);
    gain1.gain.linearRampToValueAtTime(0.18, now + 0.008);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 2.2);
    
    // Harmonic metallic ring (Sine wave at 2nd harmonic)
    const osc2 = this.ctx.createOscillator();
    const gain2 = this.ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(freq * 2.0, now);
    
    gain2.gain.setValueAtTime(0.0, now);
    gain2.gain.linearRampToValueAtTime(0.08, now + 0.006);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 1.2);
    
    // Pluck transient (finger pick sound sweep)
    const oscTransient = this.ctx.createOscillator();
    const gainTransient = this.ctx.createGain();
    oscTransient.type = 'triangle';
    oscTransient.frequency.setValueAtTime(freq * 4.0, now);
    oscTransient.frequency.exponentialRampToValueAtTime(freq, now + 0.03);
    
    gainTransient.gain.setValueAtTime(0.0, now);
    gainTransient.gain.linearRampToValueAtTime(0.12, now + 0.002);
    gainTransient.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
    
    // Connect string parts
    osc1.connect(gain1);
    gain1.connect(filter);
    
    osc2.connect(gain2);
    gain2.connect(filter);
    
    oscTransient.connect(gainTransient);
    gainTransient.connect(filter);
    
    // Connect to spatial delay and master output
    filter.connect(this.delayNode);
    filter.connect(this.masterVolume);
    
    osc1.start(now);
    osc1.stop(now + 2.5);
    
    osc2.start(now);
    osc2.stop(now + 1.5);
    
    oscTransient.start(now);
    oscTransient.stop(now + 0.06);
    
    this.currentOscillators.push(osc1, osc2, oscTransient);
  }

  playGenerativeChord() {
    const now = this.ctx.currentTime;
    
    // Peaceful Acoustic Guitar Chord Progression (5-string fingerpicking)
    const progressions = [
      [130.81, 196.00, 261.63, 329.63, 493.88], // C3, G3, C4, E4, B4 (Cmaj7)
      [87.31,  130.81, 220.00, 261.63, 392.00], // F2, C3, A3, C4, G4 (Fmaj7)
      [110.00, 164.81, 220.00, 261.63, 493.88], // A2, E3, A3, C4, B4 (Am9)
      [98.00,  146.83, 196.00, 246.94, 329.63]  // G2, D3, G3, B3, E4 (G6)
    ];
    
    const chord = progressions[this.chordIndex];
    this.chordIndex = (this.chordIndex + 1) % progressions.length;
    
    // Clean old oscillators safely
    this.currentOscillators = this.currentOscillators.filter(osc => {
      try { osc.stop(); } catch(e) {}
      return false;
    });
    
    // Rolling fingerstyle guitar arpeggio pattern (8 beats):
    // Beat 0: Bass (chord[0])
    // Beat 1: Alto (chord[2])
    // Beat 2: Soprano 1 (chord[3])
    // Beat 3: Tenor (chord[1])
    // Beat 4: Soprano 2 (chord[4])
    // Beat 5: Alto (chord[2])
    // Beat 6: Soprano 1 (chord[3])
    // Beat 7: Tenor (chord[1])
    const pattern = [0, 2, 3, 1, 4, 2, 3, 1];
    const beatInterval = 0.55; // 550ms per pluck
    
    pattern.forEach((noteIdx, step) => {
      const freq = chord[noteIdx];
      const pluckTime = now + (step * beatInterval);
      this.pluckString(freq, pluckTime);
    });
  }

  stopBGM() {
    if (!this.bgmActive) return;
    this.bgmActive = false;
    
    if (this.bgmInterval) {
      clearTimeout(this.bgmInterval);
      this.bgmInterval = null;
    }
    
    // Smooth master fade out
    if (this.ctx && this.masterVolume) {
      const now = this.ctx.currentTime;
      this.masterVolume.gain.setValueAtTime(this.masterVolume.gain.value, now);
      this.masterVolume.gain.linearRampToValueAtTime(0.001, now + 1.5);
      
      setTimeout(() => {
        if (!this.bgmActive && this.ctx) {
          this.currentOscillators.forEach(osc => {
            try { osc.stop(); } catch(e) {}
          });
          this.currentOscillators = [];
        }
      }, 1600);
    }
  }
}

// Export AudioManager
if (typeof window !== 'undefined') {
  window.AudioManager = AudioManager;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AudioManager;
}
