import { cn } from "@/lib/utils";
import { forwardRef } from "react";

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
  xs: { icon: 16, full: 80 },
  sm: { icon: 24, full: 120 },
  md: { icon: 32, full: 160 },
  lg: { icon: 48, full: 200 },
  xl: { icon: 64, full: 256 },
  '2xl': { icon: 128, full: 400 },
};

export function SafePilotIcon({ 
  size = 'md', 
  className,
  animated = false 
}: Omit<SafePilotLogoProps, 'variant'>) {
  const dimensions = sizeMap[size].icon;
  
  return (
    <svg 
      width={dimensions} 
      height={dimensions} 
      viewBox="0 0 48 48" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      className={cn(
        "flex-shrink-0",
        animated && "animate-pulse",
        className
      )}
    >
      <defs>
        <linearGradient id="safepilot-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#2F80ED"/>
          <stop offset="100%" stopColor="#56CCF2"/>
        </linearGradient>
      </defs>
      
      <path 
        d="M24 4L6 10V22C6 33.05 13.68 43.22 24 46C34.32 43.22 42 33.05 42 22V10L24 4Z" 
        fill="url(#safepilot-gradient)"
      />
      
      <path 
        d="M12 24H16L18 20L21 28L24 18L27 30L30 22L32 24H36" 
        fill="none" 
        stroke="#FFFFFF" 
        strokeWidth="2" 
        strokeLinecap="round" 
        strokeLinejoin="round"
        className={animated ? "animate-[pulse_2s_ease-in-out_infinite]" : ""}
      />
    </svg>
  );
}

export function SafePilotLogoFull({ 
  size = 'md', 
  className 
}: Omit<SafePilotLogoProps, 'variant'>) {
  const width = sizeMap[size].full;
  const height = width * 0.32;
  
  return (
    <svg 
      width={width} 
      height={height} 
      viewBox="0 0 200 64" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      className={cn("flex-shrink-0", className)}
    >
      <defs>
        <linearGradient id="safepilot-full-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#2F80ED"/>
          <stop offset="100%" stopColor="#56CCF2"/>
        </linearGradient>
      </defs>
      
      <g transform="translate(4, 8)">
        <path 
          d="M24 2L4 8V18C4 27.71 10.72 36.57 24 40C37.28 36.57 44 27.71 44 18V8L24 2Z" 
          fill="url(#safepilot-full-gradient)"
        />
        <path 
          d="M10 20H14L16 16L19 24L22 14L25 26L28 18L30 20H38" 
          fill="none" 
          stroke="#FFFFFF" 
          strokeWidth="1.5" 
          strokeLinecap="round" 
          strokeLinejoin="round"
        />
      </g>
      
      <text 
        x="56" 
        y="38" 
        fontFamily="Inter, system-ui, -apple-system, sans-serif" 
        fontSize="22" 
        fontWeight="600"
      >
        <tspan fill="url(#safepilot-full-gradient)">Safe</tspan>
        <tspan className="fill-foreground dark:fill-white">Pilot</tspan>
      </text>
    </svg>
  );
}

export function SafePilotAppIcon({ 
  size = 'lg', 
  className 
}: Omit<SafePilotLogoProps, 'variant'>) {
  const dimensions = sizeMap[size].icon;
  
  return (
    <div 
      className={cn(
        "rounded-2xl bg-gradient-to-br from-[#2F80ED] to-[#56CCF2] p-2 flex items-center justify-center shadow-lg",
        className
      )}
      style={{ width: dimensions, height: dimensions }}
    >
      <svg 
        width={dimensions * 0.7} 
        height={dimensions * 0.7} 
        viewBox="0 0 48 48" 
        fill="none" 
        xmlns="http://www.w3.org/2000/svg"
      >
        <path 
          d="M24 4L6 10V22C6 33.05 13.68 43.22 24 46C34.32 43.22 42 33.05 42 22V10L24 4Z" 
          fill="rgba(255,255,255,0.2)"
          stroke="rgba(255,255,255,0.5)"
          strokeWidth="1"
        />
        
        <path 
          d="M12 24H16L18 20L21 28L24 18L27 30L30 22L32 24H36" 
          fill="none" 
          stroke="#FFFFFF" 
          strokeWidth="2.5" 
          strokeLinecap="round" 
          strokeLinejoin="round"
        />
      </svg>
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

export const SafePilotSidebarIcon = forwardRef<SVGSVGElement, LucideCompatibleProps>(
  ({ className, size = 16, ...props }, ref) => (
    <svg 
      ref={ref}
      width={size} 
      height={size} 
      viewBox="0 0 48 48" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      className={cn("flex-shrink-0", className)}
      {...props}
    >
      <defs>
        <linearGradient id="safepilot-sidebar-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#2F80ED"/>
          <stop offset="100%" stopColor="#56CCF2"/>
        </linearGradient>
      </defs>
      
      <path 
        d="M24 4L6 10V22C6 33.05 13.68 43.22 24 46C34.32 43.22 42 33.05 42 22V10L24 4Z" 
        fill="url(#safepilot-sidebar-gradient)"
      />
      
      <path 
        d="M12 24H16L18 20L21 28L24 18L27 30L30 22L32 24H36" 
        fill="none" 
        stroke="#FFFFFF" 
        strokeWidth="2" 
        strokeLinecap="round" 
        strokeLinejoin="round"
      />
    </svg>
  )
);
SafePilotSidebarIcon.displayName = 'SafePilotSidebarIcon';

export default SafePilotLogo;
