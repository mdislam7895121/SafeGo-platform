// SafePilot Logo & Icon Assets
// Part of SafeGo Brand Identity System

// SVG Imports
import safepilotIcon from './safepilot-icon.svg';
import safepilotIconDark from './safepilot-icon-dark.svg';
import safepilotLogoFull from './safepilot-logo-full.svg';
import safepilotLogoFullDark from './safepilot-logo-full-dark.svg';

// PNG Imports from generated assets
import safepilotShieldIcon from '@assets/generated_images/safepilot_shield_icon_blue_gradient.png';
import safepilotMobileAppIcon from '@assets/generated_images/safepilot_mobile_app_icon.png';
import safepilotFullLogoLight from '@assets/generated_images/safepilot_full_logo_light_mode.png';
import safepilotFullLogoDark from '@assets/generated_images/safepilot_full_logo_dark_mode.png';

// Export all assets
export {
  // SVG assets (vector, scalable)
  safepilotIcon,
  safepilotIconDark,
  safepilotLogoFull,
  safepilotLogoFullDark,
  
  // PNG assets (raster)
  safepilotShieldIcon,
  safepilotMobileAppIcon,
  safepilotFullLogoLight,
  safepilotFullLogoDark,
};

// Brand colors
export const SAFEPILOT_COLORS = {
  primary: '#2F80ED',
  secondary: '#56CCF2',
  gradient: 'linear-gradient(135deg, #2F80ED 0%, #56CCF2 100%)',
  pulse: '#FFFFFF',
  glow: 'rgba(86, 204, 242, 0.3)',
} as const;

// Size presets
export const SAFEPILOT_SIZES = {
  xs: 16,
  sm: 24,
  md: 32,
  lg: 48,
  xl: 64,
  '2xl': 128,
  '3xl': 256,
  '4xl': 512,
  '5xl': 1024,
} as const;

// Default export for convenience
export default {
  icon: safepilotIcon,
  iconDark: safepilotIconDark,
  logoFull: safepilotLogoFull,
  logoFullDark: safepilotLogoFullDark,
  colors: SAFEPILOT_COLORS,
  sizes: SAFEPILOT_SIZES,
};
