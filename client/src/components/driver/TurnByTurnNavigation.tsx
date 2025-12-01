import { useState, useEffect, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Navigation,
  ChevronUp,
  ChevronDown,
  CornerUpLeft,
  CornerUpRight,
  ArrowUp,
  RotateCcw,
  MapPin,
  Clock,
  AlertTriangle,
  Volume2,
  VolumeX,
  Maximize2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

export interface NavigationInstruction {
  id: string;
  stepNumber: number;
  instruction: string;
  distance: string;
  distanceMeters: number;
  maneuverType: "turn-left" | "turn-right" | "straight" | "slight-left" | "slight-right" | "u-turn" | "arrive" | "depart";
  streetName?: string;
  isActive: boolean;
  isCompleted: boolean;
}

export interface TurnByTurnNavigationProps {
  instructions: NavigationInstruction[];
  currentStepIndex: number;
  totalDistanceRemaining: string;
  etaMinutes: number;
  isRerouting?: boolean;
  isOffRoute?: boolean;
  onRecalculate?: () => void;
  onClose?: () => void;
  onExpandToggle?: (expanded: boolean) => void;
  className?: string;
}

function getManeuverIcon(type: NavigationInstruction["maneuverType"]) {
  switch (type) {
    case "turn-left":
    case "slight-left":
      return CornerUpLeft;
    case "turn-right":
    case "slight-right":
      return CornerUpRight;
    case "u-turn":
      return RotateCcw;
    case "arrive":
      return MapPin;
    case "depart":
    case "straight":
    default:
      return ArrowUp;
  }
}

function getManeuverColor(type: NavigationInstruction["maneuverType"]) {
  switch (type) {
    case "arrive":
      return "text-green-500";
    case "u-turn":
      return "text-yellow-500";
    default:
      return "text-primary";
  }
}

export function TurnByTurnNavigation({
  instructions,
  currentStepIndex,
  totalDistanceRemaining,
  etaMinutes,
  isRerouting = false,
  isOffRoute = false,
  onRecalculate,
  onClose,
  onExpandToggle,
  className,
}: TurnByTurnNavigationProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [lastSpokenStep, setLastSpokenStep] = useState(-1);

  const currentInstruction = useMemo(() => {
    return instructions[currentStepIndex] || null;
  }, [instructions, currentStepIndex]);

  const nextInstruction = useMemo(() => {
    return instructions[currentStepIndex + 1] || null;
  }, [instructions, currentStepIndex]);

  const progressPercent = useMemo(() => {
    if (instructions.length === 0) return 0;
    return ((currentStepIndex + 1) / instructions.length) * 100;
  }, [currentStepIndex, instructions.length]);

  const speakInstruction = useCallback((text: string) => {
    if (!voiceEnabled || typeof window === "undefined") return;
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      window.speechSynthesis.speak(utterance);
    }
  }, [voiceEnabled]);

  useEffect(() => {
    if (currentInstruction && currentStepIndex !== lastSpokenStep && voiceEnabled) {
      speakInstruction(currentInstruction.instruction);
      setLastSpokenStep(currentStepIndex);
    }
  }, [currentInstruction, currentStepIndex, lastSpokenStep, voiceEnabled, speakInstruction]);

  const handleExpandToggle = useCallback(() => {
    const newExpanded = !isExpanded;
    setIsExpanded(newExpanded);
    onExpandToggle?.(newExpanded);
  }, [isExpanded, onExpandToggle]);

  const handleVoiceToggle = useCallback(() => {
    setVoiceEnabled(!voiceEnabled);
    if (voiceEnabled && typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
  }, [voiceEnabled]);

  if (!currentInstruction) {
    return null;
  }

  const CurrentIcon = getManeuverIcon(currentInstruction.maneuverType);
  const NextIcon = nextInstruction ? getManeuverIcon(nextInstruction.maneuverType) : null;

  return (
    <motion.div
      initial={{ y: -100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: -100, opacity: 0 }}
      className={cn(
        "fixed top-0 left-0 right-0 z-[1001] bg-background/95 backdrop-blur-md border-b shadow-lg",
        className
      )}
      data-testid="turn-by-turn-navigation"
    >
      {isOffRoute && (
        <div className="bg-yellow-500 text-yellow-950 px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            <span className="text-sm font-medium">You are off route</span>
          </div>
          <Button
            size="sm"
            variant="secondary"
            onClick={onRecalculate}
            disabled={isRerouting}
            className="h-7"
            data-testid="button-recalculate"
          >
            {isRerouting ? "Recalculating..." : "Recalculate"}
          </Button>
        </div>
      )}

      <div className="p-4">
        <div className="flex items-start gap-4">
          <div className={cn(
            "p-3 rounded-xl bg-primary/10 shrink-0",
            getManeuverColor(currentInstruction.maneuverType)
          )}>
            <CurrentIcon className="h-8 w-8" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-2xl font-bold" data-testid="text-distance">
                {currentInstruction.distance}
              </span>
              {currentInstruction.maneuverType === "arrive" && (
                <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                  Destination
                </Badge>
              )}
            </div>
            <p className="text-lg font-medium truncate" data-testid="text-instruction">
              {currentInstruction.instruction}
            </p>
            {currentInstruction.streetName && (
              <p className="text-sm text-muted-foreground truncate">
                {currentInstruction.streetName}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-1 shrink-0">
            <Button
              size="icon"
              variant="ghost"
              onClick={handleVoiceToggle}
              className="h-8 w-8"
              data-testid="button-voice-toggle"
            >
              {voiceEnabled ? (
                <Volume2 className="h-4 w-4" />
              ) : (
                <VolumeX className="h-4 w-4 text-muted-foreground" />
              )}
            </Button>
            {onClose && (
              <Button
                size="icon"
                variant="ghost"
                onClick={onClose}
                className="h-8 w-8"
                data-testid="button-close-nav"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        {nextInstruction && (
          <div className="mt-3 flex items-center gap-3 p-2 rounded-lg bg-muted/50">
            <span className="text-xs text-muted-foreground uppercase font-medium">Then</span>
            {NextIcon && <NextIcon className="h-4 w-4 text-muted-foreground" />}
            <span className="text-sm text-muted-foreground truncate flex-1">
              {nextInstruction.instruction}
            </span>
            <span className="text-sm font-medium">{nextInstruction.distance}</span>
          </div>
        )}

        <div className="mt-4 flex items-center justify-between text-sm">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <Navigation className="h-4 w-4 text-muted-foreground" />
              <span data-testid="text-total-distance">{totalDistanceRemaining}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span data-testid="text-eta">{etaMinutes} min</span>
            </div>
          </div>

          <Button
            size="sm"
            variant="ghost"
            onClick={handleExpandToggle}
            className="gap-1"
            data-testid="button-expand-steps"
          >
            {isExpanded ? (
              <>
                <ChevronUp className="h-4 w-4" />
                Hide steps
              </>
            ) : (
              <>
                <ChevronDown className="h-4 w-4" />
                All steps
              </>
            )}
          </Button>
        </div>

        <Progress value={progressPercent} className="mt-3 h-1" />
      </div>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-t"
          >
            <div className="max-h-64 overflow-y-auto">
              {instructions.map((step, index) => {
                const StepIcon = getManeuverIcon(step.maneuverType);
                const isActive = index === currentStepIndex;
                const isCompleted = index < currentStepIndex;

                return (
                  <div
                    key={step.id}
                    className={cn(
                      "flex items-center gap-3 px-4 py-3 border-b last:border-b-0",
                      isActive && "bg-primary/5",
                      isCompleted && "opacity-50"
                    )}
                    data-testid={`nav-step-${index}`}
                  >
                    <div className={cn(
                      "p-2 rounded-lg shrink-0",
                      isActive ? "bg-primary/10" : "bg-muted",
                      isCompleted && "bg-green-100 dark:bg-green-900/20"
                    )}>
                      <StepIcon className={cn(
                        "h-4 w-4",
                        isActive && getManeuverColor(step.maneuverType),
                        isCompleted && "text-green-600 dark:text-green-400"
                      )} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={cn(
                        "text-sm truncate",
                        isActive && "font-medium"
                      )}>
                        {step.instruction}
                      </p>
                      {step.streetName && (
                        <p className="text-xs text-muted-foreground truncate">
                          {step.streetName}
                        </p>
                      )}
                    </div>
                    <span className={cn(
                      "text-sm shrink-0",
                      isActive && "font-medium"
                    )}>
                      {step.distance}
                    </span>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export function TurnByTurnMiniCard({
  instruction,
  distance,
  eta,
  onClick,
}: {
  instruction: string;
  distance: string;
  eta: number;
  onClick?: () => void;
}) {
  return (
    <motion.div
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className="bg-background/95 backdrop-blur-md rounded-xl border shadow-lg p-3 cursor-pointer hover-elevate"
      onClick={onClick}
      data-testid="turn-by-turn-mini"
    >
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-primary/10">
          <Navigation className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{instruction}</p>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>{distance}</span>
            <span>•</span>
            <span>{eta} min</span>
          </div>
        </div>
        <Maximize2 className="h-4 w-4 text-muted-foreground" />
      </div>
    </motion.div>
  );
}

export default TurnByTurnNavigation;
