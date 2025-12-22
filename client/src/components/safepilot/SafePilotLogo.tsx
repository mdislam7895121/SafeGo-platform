import { cn } from "@/lib/utils";
import { forwardRef } from "react";
import safepilotIconSvg from "@/assets/safepilot/safepilot-icon.svg";

interface SafePilotLogoProps {
  variant?: 'icon' | 'full' | 'app-icon';
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  className?: string;
  animated?: boolean;
}

interface LucideCompatibleProps {
  className?: string;
  size?: number | string;
}

const sizeMap = {
  xs: 16,
  sm: 24,
  md: 32,
  lg: 48,
  xl: 64,
  '2xl': 128,
};

export function SafePilotIcon({ 
  size = 'md', 
  className,
  animated = false 
}: Omit<SafePilotLogoProps, 'variant'>) {
  const dimensions = sizeMap[size];
  
  return (
    <img 
      src={safepilotIconSvg}
      alt="SafePilot"
      width={dimensions}
      height={dimensions}
      className={cn(
        "flex-shrink-0 object-contain",
        animated && "animate-pulse",
        className
      )}
      style={{ 
        width: dimensions, 
        height: dimensions,
      }}
    />
  );
}

export function SafePilotLogoFull({ 
  size = 'md', 
  className 
}: Omit<SafePilotLogoProps, 'variant'>) {
  const iconSize = sizeMap[size];
  
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <img 
        src={safepilotIconSvg}
        alt="SafePilot"
        width={iconSize}
        height={iconSize}
        className="flex-shrink-0 object-contain"
        style={{ width: iconSize, height: iconSize }}
      />
      <span className="font-semibold text-lg">
        <span className="bg-gradient-to-r from-[#2F80ED] to-[#56CCF2] bg-clip-text text-transparent">Safe</span>
        <span className="text-foreground">Pilot</span>
      </span>
    </div>
  );
}

export function SafePilotAppIcon({ 
  size = 'lg', 
  className 
}: Omit<SafePilotLogoProps, 'variant'>) {
  const dimensions = sizeMap[size];
  
  return (
    <div 
      className={cn(
        "rounded-2xl bg-gradient-to-br from-[#0a1929] to-[#0d2137] p-2 flex items-center justify-center shadow-lg",
        className
      )}
      style={{ width: dimensions, height: dimensions }}
    >
      <img 
        src={safepilotIconSvg}
        alt="SafePilot"
        className="object-contain"
        style={{ width: dimensions * 0.8, height: dimensions * 0.8 }}
      />
    </div>
  );
}

export function SafePilotLogo({ 
  variant = 'icon', 
  size = 'md', 
  className,
  animated = false
}: SafePilotLogoProps) {
  switch (variant) {
    case 'full':
      return <SafePilotLogoFull size={size} className={className} />;
    case 'app-icon':
      return <SafePilotAppIcon size={size} className={className} />;
    default:
      return <SafePilotIcon size={size} className={className} animated={animated} />;
  }
}

export const SafePilotSidebarIcon = forwardRef<HTMLImageElement, LucideCompatibleProps>(
  ({ className, size = 20, ...props }, ref) => (
    <img 
      ref={ref}
      src={safepilotIconSvg}
      alt="SafePilot"
      className={cn("flex-shrink-0 object-contain", className)}
      style={{ 
        width: typeof size === 'number' ? size : parseInt(size), 
        height: typeof size === 'number' ? size : parseInt(size) 
      }}
      {...props}
    />
  )
);
SafePilotSidebarIcon.displayName = 'SafePilotSidebarIcon';

export default SafePilotLogo;
