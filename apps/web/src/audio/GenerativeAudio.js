// Generative Audio System
// Brian Eno meets hardware research

import * as Tone from 'tone';

export class GenerativeAudio {
  constructor() {
    this.initialized = false;
    
    // Layer 1: Hardware Drone (always present)
    this.droneOsc = new Tone.Oscillator(60, "sawtooth").toDestination();
    this.droneOsc.volume.value = -24;
    this.droneFilter = new Tone.Filter(100, "lowpass").connect(this.droneOsc);
    
    // Layer 2: Ambient Textures
    this.noise = new Tone.Noise('brown');
    this.noiseFilter = new Tone.Filter(2000, 'lowpass');
    this.noise.connect(this.noiseFilter).toDestination();
    this.noise.volume.value = -24;
    
    // Layer 3: Melodic Arpeggio
    this.synth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'fatsine' },
      envelope: {
        attack: 0.05,
        decay: 0.3,
        sustain: 0.3,
        release: 1
      }
    }).toDestination();
    this.synth.volume.value = -14;
    
    // Pentatonic scale (C major pentatonic)
    this.scale = ['C4', 'D4', 'E4', 'G4', 'A4', 'C5', 'D5'];
    
    // Layer 4: Architecture Chimes (section transitions)
    this.chimes = new Tone.PolySynth(Tone.MetalSynth, {
      frequency: 200,
      envelope: {
        attack: 0.001,
        decay: 2,
        release: 3
      },
      harmonicity: 5.1,
      modulationIndex: 32,
      resonance: 4000,
      quantization: 16
    }).toDestination();
    this.chimes.volume.value = -20;
    
    // Arpeggio loop
    this.arpeggioLoop = new Tone.Loop(time => {
      const note = this.scale[Math.floor(Math.random() * this.scale.length)];
      const velocity = 0.3 + Math.random() * 0.4;
      this.synth.triggerAttackRelease(note, '8n', time, velocity);
    }, '4n');
    
    // Interactive layer (mouse movement)
    this.interactiveSynth = new Tone.Synth({
      oscillator: { type: 'sine' },
      envelope: {
        attack: 0.01,
        decay: 0.2,
        sustain: 0.1,
        release: 2
      }
    }).toDestination();
    this.interactiveSynth.volume.value = -12;
    
    // Section chords
    this.sectionChords = {
      home: ['C3', 'E3', 'G3', 'C4'],
      essay: ['D3', 'F3', 'A3', 'D4'],
      ensemble: ['E3', 'G3', 'B3', 'E4'],
      demo: ['F3', 'A3', 'C4', 'F4']
    };
  }
  
  async init() {
    await Tone.start();
    
    this.droneOsc.start();
    this.droneFilter.start();
    this.noise.start();
    this.arpeggioLoop.start(0);
    
    this.initialized = true;
    
    console.log('Generative audio initialized');
  }
  
  // User interaction triggers
  onMouseMove(x, y) {
    if (!this.initialized) return;
    
    // Map mouse to frequency
    const freq = 200 + (x / window.innerWidth) * 600;
    const velocity = 0.2 + (y / window.innerHeight) * 0.6;
    
    this.interactiveSynth.triggerAttackRelease(freq + 'Hz', '16n', Tone.now(), velocity);
  }
  
  // Section transition
  onSectionChange(section) {
    if (!this.initialized) return;
    
    const chord = this.sectionChords[section] || this.sectionChords.home;
    this.chimes.triggerAttackRelease(chord, '2n');
  }
  
  // Audio-reactive data
  getFrequencyData() {
    if (!this.initialized) return null;
    
    const analyser = Tone.Destination.context.createAnalyser();
    analyser.fftSize = 256;
    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    
    Tone.Destination.connect(analyser);
    analyser.getByteFrequencyData(dataArray);
    
    return {
      bass: dataArray[0] / 255,
      mid: dataArray[64] / 255,
      high: dataArray[128] / 255
    };
  }
  
  // User controls
  setVolume(value) {
    Tone.Destination.volume.rampTo(value, 0.1);
  }
  
  toggleMute() {
    Tone.Destination.muted = !Tone.Destination.muted;
  }
  
  pause() {
    Tone.Transport.pause();
  }
  
  resume() {
    Tone.Transport.start();
  }
}

export default GenerativeAudio;
