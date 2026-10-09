import type { GameEvent } from './engine';
export class Sound {
  context: AudioContext | null = null;
  last = 0;
  unlock() { try { this.context ??= new AudioContext(); void this.context.resume().catch(() => {}); } catch { /* Silent play if unavailable. */ } }
  play(event: GameEvent) {
    const c = this.context;
    if (!c || c.state !== 'running') return;
    if ((event === 'hit' || event === 'break') && c.currentTime - this.last < 0.04) return;
    this.last = c.currentTime;
    const frequencies = { hit: 180, break: 540, catch: 840, skill: 390, life: 130, win: 1040 };
    const oscillator = c.createOscillator(), volume = c.createGain();
    oscillator.type = event === 'hit' ? 'triangle' : 'sine';
    oscillator.frequency.setValueAtTime(frequencies[event], c.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(frequencies[event] * (event === 'life' ? 0.5 : 1.4), c.currentTime + 0.12);
    volume.gain.setValueAtTime(0.045, c.currentTime); volume.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.16);
    oscillator.connect(volume); volume.connect(c.destination); oscillator.start(); oscillator.stop(c.currentTime + 0.17);
  }
}
