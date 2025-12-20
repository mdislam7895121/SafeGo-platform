import { useState, useEffect, useCallback, useRef } from 'react';
import { voiceNavigation, NavigationInstruction, VoiceNavigationConfig } from '@/lib/voiceNavigation';
import { useFeatureFlags } from './useFeatureFlags';

export interface VoiceNavigationState {
  isEnabled: boolean;
  isAvailable: boolean;
  isSpeaking: boolean;
  currentInstruction: string | null;
  config: VoiceNavigationConfig;
}

export function useVoiceNavigation() {
  const { isEnabled: checkFeatureEnabled } = useFeatureFlags();
  const featureEnabled = checkFeatureEnabled('voice_navigation_enabled');
  
  const [state, setState] = useState<VoiceNavigationState>({
    isEnabled: voiceNavigation.getConfig().enabled && featureEnabled,
    isAvailable: voiceNavigation.isAvailable(),
    isSpeaking: false,
    currentInstruction: null,
    config: voiceNavigation.getConfig(),
  });

  const lastAnnouncedRef = useRef<string>('');
  const distanceRef = useRef<number>(Infinity);

  useEffect(() => {
    if (!featureEnabled) {
      voiceNavigation.setConfig({ enabled: false });
      setState(prev => ({ ...prev, isEnabled: false }));
    }
  }, [featureEnabled]);

  const toggleEnabled = useCallback(() => {
    if (!featureEnabled) {
      return;
    }
    const newEnabled = !state.isEnabled;
    voiceNavigation.setConfig({ enabled: newEnabled });
    setState(prev => ({
      ...prev,
      isEnabled: newEnabled,
      config: voiceNavigation.getConfig(),
    }));
  }, [state.isEnabled, featureEnabled]);

  const setVolume = useCallback((volume: number) => {
    const clampedVolume = Math.max(0, Math.min(1, volume));
    voiceNavigation.setConfig({ volume: clampedVolume });
    setState(prev => ({
      ...prev,
      config: voiceNavigation.getConfig(),
    }));
  }, []);

  const setRate = useCallback((rate: number) => {
    const clampedRate = Math.max(0.5, Math.min(2, rate));
    voiceNavigation.setConfig({ rate: clampedRate });
    setState(prev => ({
      ...prev,
      config: voiceNavigation.getConfig(),
    }));
  }, []);

  const setLanguage = useCallback((language: string) => {
    voiceNavigation.setConfig({ language });
    setState(prev => ({
      ...prev,
      config: voiceNavigation.getConfig(),
    }));
  }, []);

  const announceInstruction = useCallback(async (
    instruction: NavigationInstruction,
    currentDistance: number
  ): Promise<boolean> => {
    if (!featureEnabled || !state.isEnabled || !state.isAvailable) return false;

    distanceRef.current = currentDistance;
    
    const instructionKey = `${instruction.maneuver}-${currentDistance}`;
    if (instructionKey === lastAnnouncedRef.current) return false;

    setState(prev => ({ ...prev, isSpeaking: true }));
    
    const spoken = await voiceNavigation.announceInstruction(instruction, currentDistance);
    
    if (spoken) {
      lastAnnouncedRef.current = instructionKey;
      const text = voiceNavigation.buildInstruction({ ...instruction, distance: currentDistance });
      setState(prev => ({ 
        ...prev, 
        isSpeaking: false, 
        currentInstruction: text 
      }));
    } else {
      setState(prev => ({ ...prev, isSpeaking: false }));
    }

    return spoken;
  }, [featureEnabled, state.isEnabled, state.isAvailable]);

  const announceReroute = useCallback(() => {
    if (featureEnabled && state.isEnabled && state.isAvailable) {
      voiceNavigation.announceReroute();
      lastAnnouncedRef.current = '';
    }
  }, [featureEnabled, state.isEnabled, state.isAvailable]);

  const announceArrival = useCallback(() => {
    if (featureEnabled && state.isEnabled && state.isAvailable) {
      voiceNavigation.announceArrival();
    }
  }, [featureEnabled, state.isEnabled, state.isAvailable]);

  const announcePickupArrival = useCallback(() => {
    if (featureEnabled && state.isEnabled && state.isAvailable) {
      voiceNavigation.announcePickupArrival();
    }
  }, [featureEnabled, state.isEnabled, state.isAvailable]);

  const speak = useCallback(async (text: string) => {
    if (!featureEnabled || !state.isEnabled || !state.isAvailable) return;
    
    setState(prev => ({ ...prev, isSpeaking: true, currentInstruction: text }));
    
    try {
      await voiceNavigation.speak(text);
    } finally {
      setState(prev => ({ ...prev, isSpeaking: false }));
    }
  }, [featureEnabled, state.isEnabled, state.isAvailable]);

  const stop = useCallback(() => {
    voiceNavigation.stop();
    setState(prev => ({ ...prev, isSpeaking: false }));
  }, []);

  const reset = useCallback(() => {
    voiceNavigation.reset();
    lastAnnouncedRef.current = '';
    distanceRef.current = Infinity;
    setState(prev => ({ 
      ...prev, 
      isSpeaking: false, 
      currentInstruction: null 
    }));
  }, []);

  return {
    ...state,
    toggleEnabled,
    setVolume,
    setRate,
    setLanguage,
    announceInstruction,
    announceReroute,
    announceArrival,
    announcePickupArrival,
    speak,
    stop,
    reset,
  };
}
