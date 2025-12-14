# SafeGo Responsive UI QA Checklist

## Overview
This document provides a comprehensive QA checklist for verifying responsive behavior across the SafeGo customer ride flow and landing pages.

## Test Viewports

| Device | Width | Description |
|--------|-------|-------------|
| Mobile S | 320px | Small phones |
| Mobile M | 375px | iPhone SE, standard phones |
| Mobile L | 425px | Large phones |
| Tablet | 768px | iPad, tablets |
| Laptop | 1024px | Small laptops |
| Desktop | 1440px | Standard desktop |

## Customer Unified Booking Flow (`/customer`)

### Main Layout
- [ ] Mobile: Full-width single column layout
- [ ] Tablet: Sidebar + map side-by-side starts appearing
- [ ] Desktop: 400px sidebar with remaining space for map

### Address Input Panel
- [ ] Mobile: Full-width inputs with 16px padding
- [ ] Desktop: Compact inputs within sidebar
- [ ] Touch targets: Minimum 44px height on mobile

### Route Selection Pills
- [ ] Mobile: Horizontal scroll with snap points (`snap-x snap-mandatory`)
- [ ] Touch targets: Minimum 44px height
- [ ] Desktop: Horizontal scroll or wrap as space allows

### Car Category Selection
- [ ] Mobile: 2-column grid (`grid-cols-2`)
- [ ] Desktop: 4-column grid (`md:grid-cols-4`)
- [ ] No horizontal overflow on any viewport

### Map Panel
- [ ] Mobile: "View Map" button opens full-screen modal
- [ ] Desktop: Map visible alongside sidebar
- [ ] Map resize: Properly invalidates on container resize

### Fare Details
- [ ] Collapsible accordion works on all viewports
- [ ] Text remains readable (no overflow)

### Driver Tracking
- [ ] Mobile: Uses `MobileLiveTracking` component
- [ ] Desktop: Inline tracking in map panel
- [ ] ETA and driver info always visible

## Landing Pages

### `/ride`, `/food`, `/parcel`
- [ ] Hero section: Full-width gradient backgrounds
- [ ] Heading: `text-4xl` mobile, `sm:text-5xl` desktop
- [ ] CTA buttons: Stack vertically mobile (`flex-col`), horizontal desktop (`sm:flex-row`)
- [ ] Feature grid: Single column mobile, 4-column desktop (`md:grid-cols-4`)
- [ ] Padding: `px-4 sm:px-6 lg:px-8`
- [ ] Max-width containers: `max-w-7xl mx-auto`

### Navigation Header
- [ ] Mobile: Hamburger menu
- [ ] Desktop: Full navigation links visible

### Footer
- [ ] Mobile: Stacked sections
- [ ] Desktop: Multi-column layout

## Accessibility

### Touch Targets
- [ ] All buttons: Minimum 44px x 44px
- [ ] All interactive elements: Adequate spacing

### Contrast
- [ ] Dark mode: Light text on dark backgrounds
- [ ] Light mode: Dark text on light backgrounds
- [ ] All text passes WCAG 2.1 AA contrast ratios

### Scrolling
- [ ] Horizontal scroll sections: Use `snap-x snap-mandatory`
- [ ] Overflow hidden where appropriate to prevent layout issues

## Common Issues to Watch

1. **Horizontal overflow**: Check for elements causing horizontal scroll on mobile
2. **Text truncation**: Verify long text doesn't break layout
3. **Image sizing**: Responsive images don't overflow containers
4. **Button stacking**: CTAs stack properly on narrow viewports
5. **Map tile loading**: Map properly sizes on all viewports

## Testing Process

1. Open Chrome DevTools (F12)
2. Toggle device toolbar (Ctrl+Shift+M)
3. Test each viewport in the table above
4. Verify all checkboxes pass
5. Test actual mobile devices if available
