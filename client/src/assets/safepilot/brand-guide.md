# SafePilot Brand Identity Guide

## Logo Concept
SafePilot represents **"AI Guardian + Intelligence Core"** — a secure, intelligent, futuristic enterprise-grade AI assistant that is part of the SafeGo ecosystem.

## Visual Identity

### Primary Colors
| Name | Hex | HSL | Usage |
|------|-----|-----|-------|
| SafeGo Blue Start | `#2F80ED` | `217° 83% 56%` | Gradient start, primary accent |
| SafeGo Blue End | `#56CCF2` | `194° 85% 64%` | Gradient end, secondary accent |
| Pure White | `#FFFFFF` | `0° 0% 100%` | AI pulse wave, text on dark |
| Dark Background | `#0A0A0A` | `0° 0% 4%` | Dark mode background |

### Gradient Definition
```css
/* Primary SafePilot Gradient */
background: linear-gradient(135deg, #2F80ED 0%, #56CCF2 100%);

/* CSS Custom Property */
--safepilot-gradient: linear-gradient(135deg, #2F80ED 0%, #56CCF2 100%);
```

### Typography
- **Logo Text**: Inter, 600 weight (Semi-Bold)
- **"Safe"**: Uses gradient fill
- **"Pilot"**: Uses foreground color (adapts to light/dark mode)

## Logo Variants

### 1. Icon Only (`safepilot-icon.svg`)
- Minimal shield with AI pulse wave
- Use for: Sidebar icons, floating buttons, favicons
- Sizes: 16px, 24px, 32px, 48px, 64px

### 2. Full Logo (`safepilot-logo-full.svg`)
- Shield icon + "SafePilot" text
- Use for: Headers, splash screens, marketing
- Sizes: 120px, 160px, 200px, 256px width

### 3. App Icon (`safepilot-app-icon`)
- Rounded square container with shield
- Use for: iOS/Android app icons, PWA icons
- Sizes: 48px, 64px, 128px, 256px, 512px, 1024px

## Spacing Rules

### Icon Clear Space
Minimum clear space around icon = 25% of icon size

```
┌─────────────────────┐
│                     │
│   ┌─────────────┐   │
│   │   SHIELD    │   │
│   │   + PULSE   │   │
│   └─────────────┘   │
│                     │
└─────────────────────┘
    ↔ 25% padding ↔
```

### Sidebar Placement
- Icon size: 24px
- Horizontal padding: 8px
- Vertical alignment: center

### Floating Button Placement
- Icon size: 24px inside 48px button
- Button padding: 12px
- Shadow: `0 4px 12px rgba(47, 128, 237, 0.3)`

## Usage Examples

### React/Next.js Import
```tsx
import { SafePilotIcon, SafePilotLogoFull, SafePilotAppIcon } from '@/components/safepilot/SafePilotLogo';

// Icon in sidebar (24px)
<SafePilotIcon size="sm" />

// Full logo in header
<SafePilotLogoFull size="md" />

// Floating button with animation
<SafePilotIcon size="md" animated />

// App icon for mobile
<SafePilotAppIcon size="xl" />
```

### CSS Classes
```css
/* Floating button container */
.safepilot-button {
  @apply fixed bottom-6 right-6 z-50;
  @apply w-14 h-14 rounded-full;
  @apply bg-gradient-to-br from-[#2F80ED] to-[#56CCF2];
  @apply shadow-lg shadow-[#2F80ED]/30;
  @apply flex items-center justify-center;
  @apply transition-transform hover:scale-105;
}

/* Sidebar icon container */
.safepilot-sidebar-icon {
  @apply w-6 h-6 flex-shrink-0;
}

/* Header logo container */
.safepilot-header-logo {
  @apply h-8 w-auto;
}
```

## Do's and Don'ts

### ✅ Do
- Use the official gradient colors
- Maintain aspect ratio when scaling
- Use appropriate size for context
- Ensure adequate contrast on backgrounds
- Use white pulse wave on colored backgrounds

### ❌ Don't
- Add cartoon faces or eyes
- Use unprofessional symbols
- Stretch or distort the logo
- Use low contrast color combinations
- Add unnecessary decorative elements
- Use complex backgrounds behind logo

## File Exports

| File | Format | Usage |
|------|--------|-------|
| `safepilot-icon.svg` | SVG | Web, scalable icon |
| `safepilot-icon-dark.svg` | SVG | Dark mode web icon |
| `safepilot-logo-full.svg` | SVG | Web, full logo |
| `safepilot-logo-full-dark.svg` | SVG | Dark mode full logo |
| `safepilot_shield_icon_blue_gradient.png` | PNG | Raster icon |
| `safepilot_mobile_app_icon.png` | PNG | Mobile app icon |
| `safepilot_full_logo_light_mode.png` | PNG | Light mode full |
| `safepilot_full_logo_dark_mode.png` | PNG | Dark mode full |

## Color Palette CSS Variables

```css
:root {
  /* SafePilot Brand Colors */
  --safepilot-blue-start: 217 83% 56%;
  --safepilot-blue-end: 194 85% 64%;
  --safepilot-gradient: linear-gradient(135deg, hsl(217, 83%, 56%), hsl(194, 85%, 64%));
  
  /* Semantic Colors */
  --safepilot-primary: var(--safepilot-blue-start);
  --safepilot-accent: var(--safepilot-blue-end);
  --safepilot-pulse: 0 0% 100%;
  --safepilot-glow: 194 85% 64% / 0.3;
}

.dark {
  --safepilot-pulse: 0 0% 100%;
  --safepilot-glow: 194 85% 64% / 0.4;
}
```
