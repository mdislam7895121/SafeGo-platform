# SafeGo Responsive QA Checklist

## Viewport Testing Matrix

### Mobile (375px)
| Component | Pass | Notes |
|-----------|------|-------|
| Route selection pills snap on swipe | [ ] | Use `snap-x snap-mandatory` |
| Ride category cards in 2-column grid | [ ] | Uses `grid-cols-2` |
| Map panel is collapsible | [ ] | Hidden by default on mobile |
| Bottom sheet for booking details | [ ] | Slides up from bottom |
| Touch targets minimum 44px | [ ] | Buttons, inputs accessible |
| No horizontal overflow on main container | [ ] | `overflow-x-hidden` on body |

### Tablet (768px)
| Component | Pass | Notes |
|-----------|------|-------|
| Route selection maintains usability | [ ] | Horizontal scroll or wider pills |
| Ride category cards in 2-column grid | [ ] | Same as mobile at this size |
| Map panel visible alongside form | [ ] | Side-by-side layout begins |
| Comfortable spacing between elements | [ ] | No cramped layouts |

### Desktop (1280px+)
| Component | Pass | Notes |
|-----------|------|-------|
| Ride category cards in 4-column grid | [ ] | Uses `md:grid-cols-4` |
| Map panel fixed on right side | [ ] | 50% width or similar |
| Full navigation visible | [ ] | No hamburger menu needed |
| Professional enterprise look | [ ] | Uber-level polish |

## Key Pages to Test

### Customer Booking (`/customer`)
- [ ] Unified booking interface loads correctly
- [ ] Service type switcher (Ride/Eats/Parcel) works
- [ ] Route pills scroll/snap correctly
- [ ] Ride cards display in grid layout
- [ ] Map integrates properly with form

### Public Landing Pages
- [ ] `/ride` - Ride-hailing landing page responsive
- [ ] `/food` - Food delivery landing page responsive
- [ ] `/parcel` - Parcel delivery landing page responsive

## CSS Classes to Verify

### Snap Scrolling (Mobile)
```css
.snap-x { scroll-snap-type: x mandatory; }
.snap-mandatory { /* included above */ }
.snap-start { scroll-snap-align: start; } /* on children */
```

### Responsive Grid
```css
.grid { display: grid; }
.grid-cols-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.md:grid-cols-4 { /* at 768px+ */ grid-template-columns: repeat(4, minmax(0, 1fr)); }
```

## Testing Process

1. Open Chrome DevTools (F12)
2. Toggle device toolbar (Ctrl+Shift+M)
3. Select device or set custom dimensions
4. Test at: 375px, 768px, 1280px
5. Verify all checkboxes above
6. Take screenshots for documentation

## Screenshot Locations
- BEFORE screenshots: `docs/screenshots/before/`
- AFTER screenshots: `docs/screenshots/after/`
- Comparison doc: `docs/RESPONSIVE_COMPARISON.md`

## Sign-off

| Tester | Date | Viewport | Status |
|--------|------|----------|--------|
| | | Mobile (375px) | |
| | | Tablet (768px) | |
| | | Desktop (1280px) | |
