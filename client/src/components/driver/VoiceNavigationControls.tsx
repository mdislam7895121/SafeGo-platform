import { Volume2, VolumeX, Mic } from 'lucide-react';
import { useVoiceNavigation } from '@/hooks/useVoiceNavigation';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';

interface VoiceNavigationControlsProps {
  className?: string;
  compact?: boolean;
}

export function VoiceNavigationControls({ 
  className,
  compact = false 
}: VoiceNavigationControlsProps) {
  const {
    isEnabled,
    isAvailable,
    isSpeaking,
    config,
    toggleEnabled,
    setVolume,
    setRate,
  } = useVoiceNavigation();

  if (!isAvailable) {
    return null;
  }

  if (compact) {
    return (
      <Button
        variant={isEnabled ? 'default' : 'outline'}
        size="icon"
        onClick={toggleEnabled}
        className={cn(
          'relative',
          isSpeaking && 'ring-2 ring-blue-400 ring-offset-2',
          className
        )}
        title={isEnabled ? 'Voice navigation on' : 'Voice navigation off'}
      >
        {isEnabled ? (
          <Volume2 className="h-4 w-4" />
        ) : (
          <VolumeX className="h-4 w-4" />
        )}
        {isSpeaking && (
          <span className="absolute -top-1 -right-1 h-2 w-2 bg-green-500 rounded-full animate-pulse" />
        )}
      </Button>
    );
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant={isEnabled ? 'default' : 'outline'}
          size="sm"
          className={cn(
            'gap-2',
            isSpeaking && 'ring-2 ring-blue-400',
            className
          )}
        >
          {isEnabled ? (
            <Volume2 className="h-4 w-4" />
          ) : (
            <VolumeX className="h-4 w-4" />
          )}
          <span>Voice</span>
          {isSpeaking && (
            <Mic className="h-3 w-3 text-green-500 animate-pulse" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64" align="end">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Voice Navigation</span>
            <Button
              variant={isEnabled ? 'default' : 'outline'}
              size="sm"
              onClick={toggleEnabled}
            >
              {isEnabled ? 'On' : 'Off'}
            </Button>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span>Volume</span>
              <span className="text-muted-foreground">
                {Math.round(config.volume * 100)}%
              </span>
            </div>
            <Slider
              value={[config.volume]}
              min={0}
              max={1}
              step={0.1}
              onValueChange={([v]) => setVolume(v)}
              disabled={!isEnabled}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span>Speed</span>
              <span className="text-muted-foreground">
                {config.rate.toFixed(1)}x
              </span>
            </div>
            <Slider
              value={[config.rate]}
              min={0.5}
              max={1.5}
              step={0.1}
              onValueChange={([r]) => setRate(r)}
              disabled={!isEnabled}
            />
          </div>

          {isSpeaking && (
            <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 rounded-md p-2">
              <Mic className="h-4 w-4 animate-pulse" />
              <span>Speaking...</span>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function VoiceNavigationToggle({ className }: { className?: string }) {
  const { isEnabled, isAvailable, toggleEnabled } = useVoiceNavigation();

  if (!isAvailable) return null;

  return (
    <button
      onClick={toggleEnabled}
      className={cn(
        'p-2 rounded-full transition-colors',
        isEnabled 
          ? 'bg-blue-500 text-white hover:bg-blue-600' 
          : 'bg-gray-200 text-gray-600 hover:bg-gray-300',
        className
      )}
      title={isEnabled ? 'Turn off voice navigation' : 'Turn on voice navigation'}
    >
      {isEnabled ? (
        <Volume2 className="h-5 w-5" />
      ) : (
        <VolumeX className="h-5 w-5" />
      )}
    </button>
  );
}
