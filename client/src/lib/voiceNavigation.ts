export interface NavigationInstruction {
  text: string;
  distance: number;
  maneuver: string;
  streetName?: string;
}

export interface VoiceNavigationConfig {
  enabled: boolean;
  language: string;
  volume: number;
  rate: number;
  pitch: number;
}

const DEFAULT_CONFIG: VoiceNavigationConfig = {
  enabled: true,
  language: 'en-US',
  volume: 1.0,
  rate: 0.9,
  pitch: 1.0,
};

const DISTANCE_THRESHOLDS = {
  FAR: 500,
  APPROACHING: 200,
  NEAR: 100,
  IMMINENT: 30,
};

class VoiceNavigationService {
  private config: VoiceNavigationConfig;
  private synth: SpeechSynthesis | null = null;
  private lastSpokenInstruction: string = '';
  private lastSpokenTime: number = 0;
  private isSpeaking: boolean = false;
  private voicesLoaded: boolean = false;

  constructor() {
    this.config = { ...DEFAULT_CONFIG };
    this.initSynth();
  }

  private initSynth(): void {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      this.synth = window.speechSynthesis;
      
      if (this.synth.getVoices().length > 0) {
        this.voicesLoaded = true;
      } else {
        this.synth.addEventListener('voiceschanged', () => {
          this.voicesLoaded = true;
        });
      }
    }
  }

  isAvailable(): boolean {
    return this.synth !== null;
  }

  setConfig(config: Partial<VoiceNavigationConfig>): void {
    this.config = { ...this.config, ...config };
  }

  getConfig(): VoiceNavigationConfig {
    return { ...this.config };
  }

  private getVoice(): SpeechSynthesisVoice | null {
    if (!this.synth || !this.voicesLoaded) return null;
    
    const voices = this.synth.getVoices();
    const langVoice = voices.find(v => v.lang.startsWith(this.config.language.split('-')[0]));
    return langVoice || voices[0] || null;
  }

  private formatDistance(meters: number): string {
    if (meters >= 1000) {
      const km = (meters / 1000).toFixed(1);
      return `${km} kilometers`;
    }
    if (meters >= 100) {
      const rounded = Math.round(meters / 50) * 50;
      return `${rounded} meters`;
    }
    return `${Math.round(meters)} meters`;
  }

  private getManeuverPhrase(maneuver: string): string {
    const phrases: Record<string, string> = {
      'turn-left': 'turn left',
      'turn-right': 'turn right',
      'turn-slight-left': 'bear left',
      'turn-slight-right': 'bear right',
      'turn-sharp-left': 'take a sharp left',
      'turn-sharp-right': 'take a sharp right',
      'uturn-left': 'make a U-turn on the left',
      'uturn-right': 'make a U-turn on the right',
      'merge': 'merge',
      'fork-left': 'keep left at the fork',
      'fork-right': 'keep right at the fork',
      'ramp-left': 'take the ramp on the left',
      'ramp-right': 'take the ramp on the right',
      'keep-left': 'keep left',
      'keep-right': 'keep right',
      'roundabout': 'enter the roundabout',
      'straight': 'continue straight',
      'depart': 'start your journey',
      'arrive': 'you have arrived at your destination',
      'arrive-left': 'your destination is on the left',
      'arrive-right': 'your destination is on the right',
    };
    return phrases[maneuver] || maneuver.replace(/-/g, ' ');
  }

  buildInstruction(instruction: NavigationInstruction): string {
    const { distance, maneuver, streetName } = instruction;
    const maneuverPhrase = this.getManeuverPhrase(maneuver);
    
    if (maneuver === 'arrive' || maneuver === 'arrive-left' || maneuver === 'arrive-right') {
      return maneuverPhrase;
    }

    if (distance <= DISTANCE_THRESHOLDS.IMMINENT) {
      if (streetName) {
        return `${maneuverPhrase} onto ${streetName}`;
      }
      return `${maneuverPhrase} now`;
    }

    if (distance <= DISTANCE_THRESHOLDS.NEAR) {
      if (streetName) {
        return `In ${this.formatDistance(distance)}, ${maneuverPhrase} onto ${streetName}`;
      }
      return `In ${this.formatDistance(distance)}, ${maneuverPhrase}`;
    }

    if (distance <= DISTANCE_THRESHOLDS.APPROACHING) {
      return `Prepare to ${maneuverPhrase}`;
    }

    if (streetName) {
      return `In ${this.formatDistance(distance)}, ${maneuverPhrase} onto ${streetName}`;
    }
    return `In ${this.formatDistance(distance)}, ${maneuverPhrase}`;
  }

  shouldSpeak(instruction: NavigationInstruction, currentDistance: number): boolean {
    if (!this.config.enabled || !this.synth) return false;
    if (this.isSpeaking) return false;

    const instructionKey = `${instruction.maneuver}-${instruction.streetName || 'unnamed'}`;
    const timeSinceLastSpeak = Date.now() - this.lastSpokenTime;

    if (instructionKey === this.lastSpokenInstruction && timeSinceLastSpeak < 10000) {
      return false;
    }

    if (currentDistance <= DISTANCE_THRESHOLDS.IMMINENT) return true;
    if (currentDistance <= DISTANCE_THRESHOLDS.NEAR && timeSinceLastSpeak > 5000) return true;
    if (currentDistance <= DISTANCE_THRESHOLDS.APPROACHING && timeSinceLastSpeak > 15000) return true;
    if (currentDistance <= DISTANCE_THRESHOLDS.FAR && timeSinceLastSpeak > 30000) return true;

    return false;
  }

  speak(text: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.synth || !this.config.enabled) {
        resolve();
        return;
      }

      this.synth.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.voice = this.getVoice();
      utterance.volume = this.config.volume;
      utterance.rate = this.config.rate;
      utterance.pitch = this.config.pitch;
      utterance.lang = this.config.language;

      this.isSpeaking = true;

      utterance.onend = () => {
        this.isSpeaking = false;
        this.lastSpokenTime = Date.now();
        resolve();
      };

      utterance.onerror = (event) => {
        this.isSpeaking = false;
        if (event.error !== 'canceled') {
          reject(new Error(event.error));
        } else {
          resolve();
        }
      };

      this.synth.speak(utterance);
    });
  }

  async announceInstruction(instruction: NavigationInstruction, currentDistance: number): Promise<boolean> {
    if (!this.shouldSpeak(instruction, currentDistance)) {
      return false;
    }

    const text = this.buildInstruction({ ...instruction, distance: currentDistance });
    this.lastSpokenInstruction = `${instruction.maneuver}-${instruction.streetName || 'unnamed'}`;

    try {
      await this.speak(text);
      return true;
    } catch (error) {
      console.error('[VoiceNav] Speech error:', error);
      return false;
    }
  }

  announceReroute(): void {
    if (this.config.enabled) {
      this.speak('Rerouting');
    }
  }

  announceArrival(): void {
    if (this.config.enabled) {
      this.speak('You have arrived at your destination');
    }
  }

  announcePickupArrival(): void {
    if (this.config.enabled) {
      this.speak('You have arrived at the pickup location');
    }
  }

  stop(): void {
    if (this.synth) {
      this.synth.cancel();
      this.isSpeaking = false;
    }
  }

  reset(): void {
    this.stop();
    this.lastSpokenInstruction = '';
    this.lastSpokenTime = 0;
  }
}

export const voiceNavigation = new VoiceNavigationService();
