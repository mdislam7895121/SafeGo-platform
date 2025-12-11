# SafeGo Super-App Design Guidelines

## Design Approach

**Reference-Based Hybrid Approach** drawing from successful super-apps:
- **Consumer App**: Uber (ride-hailing), DoorDash (food delivery), Postmates (parcel delivery)
- **Driver/Restaurant Panels**: Uber Driver app, DoorDash Merchant
- **Admin Dashboard**: Material Design for data-heavy enterprise interfaces

**Core Principle**: Functional clarity with role-specific optimizations. Each user role experiences a distinct, purpose-built interface.

## Typography System

**Font Families**:
- Primary: Inter (Google Fonts) - UI, buttons, labels
- Secondary: Manrope (Google Fonts) - headings, emphasis

**Hierarchy**:
- H1: 2.5rem/3rem (40px/48px), font-bold
- H2: 2rem/2.5rem (32px/40px), font-semibold
- H3: 1.5rem/2rem (24px/32px), font-semibold
- Body: 1rem (16px), font-normal
- Small: 0.875rem (14px), font-normal
- Micro: 0.75rem (12px), font-medium

## Layout & Spacing System

**Spacing Scale**: Use Tailwind units of **2, 3, 4, 6, 8, 12, 16, 24**
- Tight spacing: p-2, gap-2 (component internals)
- Standard spacing: p-4, gap-4 (cards, sections)
- Generous spacing: p-8, py-12 (page sections, modals)

**Container Widths**:
- Mobile: Full width with px-4 padding
- Dashboard panels: max-w-7xl mx-auto
- Content cards: max-w-md to max-w-2xl
- Admin tables: w-full with horizontal scroll on mobile

## Component Library

### Navigation
**Customer App Bottom Nav** (fixed bottom):
- 4 tabs: Home, Services, Activity, Profile
- Icons from Heroicons (outline default, solid when active)
- h-16 with subtle top border
- Badge notifications on Activity tab

**Driver/Restaurant Top Bar**:
- Status toggle (Online/Offline) - prominent, left-aligned
- Earnings summary - right-aligned
- Notification bell icon

**Admin Sidebar** (desktop):
- w-64, fixed left
- Collapsible to icon-only on tablet
- Grouped menu items: Dashboard, Users, Services, Settings
- Active state: subtle background with left border accent

### Cards & Containers

**Service Cards** (Home screen):
- Grid layout: grid-cols-2 md:grid-cols-3 gap-4
- Each card: aspect-square, rounded-2xl
- Large icon (h-12 w-12) centered
- Service name below icon
- Subtle shadow on hover: hover:shadow-lg transition

**Ride/Order Status Cards**:
- Full-width cards with rounded-xl
- Driver photo/restaurant logo (h-16 w-16, rounded-full) - left aligned
- Status badge - top right (rounded-full, px-3 py-1, text-sm font-semibold)
- Multi-line layout: Title, address, time estimate
- Bottom action buttons: full-width or split depending on context

**Map Container**:
- Full viewport height minus nav (h-[calc(100vh-4rem)])
- Overlay cards: absolute positioning, bottom-0 or top-4
- Overlay cards: rounded-t-3xl (bottom) or rounded-2xl (top)
- Pickup/dropoff pins with pulsing animation

### Forms & Inputs

**Input Fields**:
- h-12 (standard height)
- rounded-lg borders
- px-4 padding
- Labels: text-sm font-medium, mb-2
- Error states: border-red-500 with text-sm error message below
- Focus: ring-2 offset treatment

**KYC Document Upload**:
- Dashed border container (border-dashed, border-2)
- min-h-40, rounded-lg
- Icon + "Tap to upload" centered
- Preview thumbnail after upload (h-32, rounded-lg)

**Buttons**:
- Primary: h-12, rounded-lg, font-semibold, w-full on mobile
- Secondary: same height, outlined variant
- Icon buttons: h-10 w-10, rounded-full
- Floating action button: h-14 w-14, rounded-full, fixed bottom-20 right-4

### Data Display

**Admin Tables**:
- Striped rows for readability
- Sticky header on scroll
- Avatar/thumbnail in first column (h-10 w-10, rounded-full)
- Status badges: rounded-full, px-2.5 py-0.5, text-xs font-medium
- Action buttons: icon-only, grouped in last column

**Driver Earnings Dashboard**:
- Stats cards in grid: grid-cols-2 lg:grid-cols-4, gap-4
- Each card: p-6, rounded-xl
- Large number display (text-3xl font-bold)
- Label below (text-sm)
- Icon top-right (h-8 w-8, opacity-50)

**Order History List**:
- Timeline layout with vertical line connector
- Each item: pb-8 relative with absolute dot on timeline
- Restaurant/pickup icon, address, timestamp, amount
- Expandable for details (chevron icon)

### Status Indicators

**Progress Stepper** (Order/Ride tracking):
- Horizontal on desktop, vertical on mobile
- Dots: h-3 w-3 (completed), h-4 w-4 (current), h-2 w-2 (pending)
- Connecting lines: h-0.5 between steps
- Labels: text-xs below each step

**Live Status Banner**:
- Fixed top position (z-50)
- h-12, full-width
- Pulsing dot icon + status text + time estimate
- Slide-down animation on status change

### Modals & Overlays

**Bottom Sheets** (Mobile):
- Slide up from bottom with backdrop
- Rounded-t-3xl
- Handle bar at top (w-12 h-1 rounded-full, mx-auto, mt-3)
- Max height: 90vh with scroll

**Confirmation Dialogs**:
- Centered, max-w-sm
- p-6, rounded-2xl
- Icon at top (h-12 w-12 in circle background)
- Title, description, action buttons (vertical stack on mobile)

**Rating Modal**:
- Star rating: 5 large tap targets (h-12 w-12 each)
- Optional text area: min-h-24
- Submit button at bottom

### Notifications

**Toast Notifications**:
- Fixed top-4 right-4 (desktop) or top-4 left-4 right-4 (mobile)
- p-4, rounded-xl
- Icon + message + close button
- Auto-dismiss after 5s with progress bar

**Badge Counts**:
- Absolute top-0 right-0 positioning
- h-5 min-w-5, rounded-full
- text-xs font-bold, centered

## Animations

**Minimal, Purposeful Only**:
- Page transitions: 200ms fade
- Status changes: Gentle slide + fade (300ms)
- Map pin drop: Bounce on placement
- Loading states: Subtle pulse on skeletons
- NO scroll-triggered animations
- NO hover animations on mobile

## Images

**Hero Image**: Not applicable - this is a functional app, not marketing site

**Avatar/Profile Images**:
- User avatars: rounded-full, various sizes (h-8, h-10, h-12, h-16)
- Restaurant logos: rounded-lg (not full circle)
- Vehicle photos: aspect-video, rounded-xl
- Document scans: aspect-[3/2], rounded-lg with border

**Map Integration**:
- Mapbox GL or Google Maps
- Custom pin markers for pickup/dropoff
- Route polyline visualization
- Driver location: animated vehicle icon

## Multi-Role Interface Strategy

**Customer**: Focus on speed and clarity - large tap targets, minimal steps, prominent CTAs
**Driver**: Earnings front and center, quick accept/decline, navigation integration
**Restaurant**: Order queue management, preparation time controls, batch actions
**Admin**: Dense data tables, bulk operations, comprehensive filters and search

Each role sees a completely different UI optimized for their workflow.