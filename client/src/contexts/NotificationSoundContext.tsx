import { createContext, useContext, useCallback, useRef, useState, useEffect } from "react";

interface NotificationSoundContextType {
  soundEnabled: boolean;
  setSoundEnabled: (enabled: boolean) => void;
  toggleSound: () => void;
  playDriverAssigned: () => void;
  playTripStarted: () => void;
  playTripCompleted: () => void;
  playMessage: () => void;
  playAlert: () => void;
  resetToDefault: () => void;
}

const NotificationSoundContext = createContext<NotificationSoundContextType | undefined>(undefined);

const SOUND_STORAGE_KEY = "safego-sound-enabled";

function createOscillatorSound(
  audioContext: AudioContext,
  frequency: number,
  duration: number,
  type: OscillatorType = "sine"
): void {
  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();
  
  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);
  
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
  
  gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration);
  
  oscillator.start(audioContext.currentTime);
  oscillator.stop(audioContext.currentTime + duration);
}

function playDriverAssignedSound(audioContext: AudioContext): void {
  const now = audioContext.currentTime;
  
  [523.25, 659.25, 783.99].forEach((freq, i) => {
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(freq, now + i * 0.15);
    
    gainNode.gain.setValueAtTime(0, now + i * 0.15);
    gainNode.gain.linearRampToValueAtTime(0.25, now + i * 0.15 + 0.05);
    gainNode.gain.exponentialRampToValueAtTime(0.01, now + i * 0.15 + 0.3);
    
    oscillator.start(now + i * 0.15);
    oscillator.stop(now + i * 0.15 + 0.35);
  });
}

function playTripStartedSound(audioContext: AudioContext): void {
  const now = audioContext.currentTime;
  
  [392, 523.25].forEach((freq, i) => {
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.type = "triangle";
    oscillator.frequency.setValueAtTime(freq, now + i * 0.12);
    
    gainNode.gain.setValueAtTime(0, now + i * 0.12);
    gainNode.gain.linearRampToValueAtTime(0.2, now + i * 0.12 + 0.03);
    gainNode.gain.exponentialRampToValueAtTime(0.01, now + i * 0.12 + 0.25);
    
    oscillator.start(now + i * 0.12);
    oscillator.stop(now + i * 0.12 + 0.3);
  });
}

function playTripCompletedSound(audioContext: AudioContext): void {
  const now = audioContext.currentTime;
  
  [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(freq, now + i * 0.1);
    
    gainNode.gain.setValueAtTime(0, now + i * 0.1);
    gainNode.gain.linearRampToValueAtTime(0.2, now + i * 0.1 + 0.03);
    gainNode.gain.exponentialRampToValueAtTime(0.01, now + i * 0.1 + 0.4);
    
    oscillator.start(now + i * 0.1);
    oscillator.stop(now + i * 0.1 + 0.45);
  });
}

function playMessageSound(audioContext: AudioContext): void {
  createOscillatorSound(audioContext, 880, 0.15, "sine");
  setTimeout(() => {
    createOscillatorSound(audioContext, 1174.66, 0.12, "sine");
  }, 80);
}

function playAlertSound(audioContext: AudioContext): void {
  const now = audioContext.currentTime;
  
  for (let i = 0; i < 2; i++) {
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.type = "square";
    oscillator.frequency.setValueAtTime(440, now + i * 0.25);
    
    gainNode.gain.setValueAtTime(0.15, now + i * 0.25);
    gainNode.gain.exponentialRampToValueAtTime(0.01, now + i * 0.25 + 0.15);
    
    oscillator.start(now + i * 0.25);
    oscillator.stop(now + i * 0.25 + 0.2);
  }
}

export function NotificationSoundProvider({ children }: { children: React.ReactNode }) {
  const [soundEnabled, setSoundEnabledState] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(SOUND_STORAGE_KEY);
      return stored !== "false";
    }
    return true;
  });
  
  const audioContextRef = useRef<AudioContext | null>(null);
  
  const getAudioContext = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (audioContextRef.current.state === "suspended") {
      audioContextRef.current.resume();
    }
    return audioContextRef.current;
  }, []);
  
  const setSoundEnabled = useCallback((enabled: boolean) => {
    setSoundEnabledState(enabled);
    localStorage.setItem(SOUND_STORAGE_KEY, enabled.toString());
  }, []);
  
  const toggleSound = useCallback(() => {
    setSoundEnabled(!soundEnabled);
  }, [soundEnabled, setSoundEnabled]);
  
  const playDriverAssigned = useCallback(() => {
    if (!soundEnabled) return;
    try {
      playDriverAssignedSound(getAudioContext());
    } catch (e) {
      console.warn("Could not play driver assigned sound:", e);
    }
  }, [soundEnabled, getAudioContext]);
  
  const playTripStarted = useCallback(() => {
    if (!soundEnabled) return;
    try {
      playTripStartedSound(getAudioContext());
    } catch (e) {
      console.warn("Could not play trip started sound:", e);
    }
  }, [soundEnabled, getAudioContext]);
  
  const playTripCompleted = useCallback(() => {
    if (!soundEnabled) return;
    try {
      playTripCompletedSound(getAudioContext());
    } catch (e) {
      console.warn("Could not play trip completed sound:", e);
    }
  }, [soundEnabled, getAudioContext]);
  
  const playMessage = useCallback(() => {
    if (!soundEnabled) return;
    try {
      playMessageSound(getAudioContext());
    } catch (e) {
      console.warn("Could not play message sound:", e);
    }
  }, [soundEnabled, getAudioContext]);
  
  const playAlert = useCallback(() => {
    if (!soundEnabled) return;
    try {
      playAlertSound(getAudioContext());
    } catch (e) {
      console.warn("Could not play alert sound:", e);
    }
  }, [soundEnabled, getAudioContext]);

  const resetToDefault = useCallback(() => {
    setSoundEnabledState(true);
    localStorage.removeItem(SOUND_STORAGE_KEY);
  }, []);
  
  useEffect(() => {
    return () => {
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);
  
  return (
    <NotificationSoundContext.Provider
      value={{
        soundEnabled,
        setSoundEnabled,
        toggleSound,
        playDriverAssigned,
        playTripStarted,
        playTripCompleted,
        playMessage,
        playAlert,
        resetToDefault,
      }}
    >
      {children}
    </NotificationSoundContext.Provider>
  );
}

export function useNotificationSound() {
  const context = useContext(NotificationSoundContext);
  if (context === undefined) {
    throw new Error("useNotificationSound must be used within a NotificationSoundProvider");
  }
  return context;
}
