import { Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNotificationSound } from "@/contexts/NotificationSoundContext";

interface SoundToggleProps {
  className?: string;
  showLabel?: boolean;
}

export function SoundToggle({ className, showLabel = false }: SoundToggleProps) {
  const { soundEnabled, toggleSound } = useNotificationSound();

  const label = soundEnabled ? "Sound On" : "Sound Off";
  const ariaLabel = soundEnabled ? "Mute notification sounds" : "Enable notification sounds";

  return (
    <Button
      variant="ghost"
      size={showLabel ? "default" : "icon"}
      onClick={toggleSound}
      className={className}
      aria-label={ariaLabel}
      data-testid="button-sound-toggle"
    >
      {soundEnabled ? (
        <Volume2 className="h-5 w-5" />
      ) : (
        <VolumeX className="h-5 w-5" />
      )}
      {showLabel && <span className="ml-2">{label}</span>}
    </Button>
  );
}
