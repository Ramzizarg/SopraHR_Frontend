import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class SoundService {
  private sounds: { [key: string]: HTMLAudioElement } = {};

  constructor() {
    // Preload sounds
    try {
      this.loadSound('success', 'assets/sounds/success.mp3');
      this.loadSound('warning', 'assets/sounds/warning.mp3');
    } catch (error) {
      console.error('Error loading sounds:', error);
    }
  }

  private loadSound(key: string, path: string): void {
    const audio = new Audio(path);
    audio.onerror = (error) => {
      console.error(`Error loading sound ${key}:`, error);
    };
    audio.onloadeddata = () => {
      console.log(`Sound ${key} loaded successfully`);
    };
    this.sounds[key] = audio;
  }

  playSuccess(): void {
    if (this.sounds['success']) {
      this.sounds['success'].currentTime = 0;
      this.sounds['success'].play().catch(error => {
        console.error('Error playing success sound:', error);
      });
    } else {
      console.error('Success sound not loaded');
    }
  }

  playWarning(): void {
    this.sounds['warning'].currentTime = 0;
    this.sounds['warning'].play().catch(error => {
      console.error('Error playing warning sound:', error);
    });
  }
}
