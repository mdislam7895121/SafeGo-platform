# SafeGo Admin Navigation Inventory

Last Updated: 2024-12-06

## Overview
This document catalogs all admin pages, their routes, header styles, and back button configurations.

## Design Standard
All admin pages now use the shared `PageHeader` component (`client/src/components/admin/PageHeader.tsx`) with:
- Gradient background: `bg-gradient-to-r from-primary/5 via-primary/3 to-transparent`
- Dark mode support: `dark:from-primary/10 dark:via-primary/5 dark:to-transparent`
- Border: `border-b border-black/[0.06] dark:border-white/[0.06]`
- Back button: ghost variant, sm size, h-7 height, responsive text ("Back to X" on desktop, "Back" on mobile)
- Icon badge: `p-1.5 bg-primary/10 dark:bg-primary/20 rounded-md`
- Title: `text-base sm:text-lg font-semibold`
- Subtitle: `text-[11px] text-muted-foreground`
- Sticky positioning with `backdrop-blur-sm`

**Status:** All admin pages have been refactored to use the shared PageHeader component for centralized maintenance and consistent styling.

---

## Enterprise / Security Tools

| Page | Route | Component | Back Target | Status |
|------|-------|-----------|-------------|--------|
| Safety Center | /admin/safety-center | safety-center.tsx | /admin | Updated |
| Fraud Alerts | /admin/fraud-alerts | fraud-alerts.tsx | /admin | Updated |
| Trust & Safety | /admin/trust-safety | trust-safety.tsx | /admin | Updated |
| Security Center | /admin/security-center | security-center.tsx | /admin | Updated |
| Activity Monitor | /admin/activity-monitor | activity-monitor.tsx | /admin | Updated |
| Activity Log | /admin/activity-log | activity-log.tsx | /admin | Updated |

---

## Configuration Pages

| Page | Route | Component | Back Target | Status |
|------|-------|-----------|-------------|--------|
| Feature Flags | /admin/feature-flags | feature-flags.tsx | /admin/settings | Updated |
| Global Settings | /admin/global-settings | global-settings.tsx | /admin | Updated |
| Releases & Publish | /admin/releases-publish | releases-publish.tsx | /admin | Updated |
| Settings | /admin/settings | settings.tsx | /admin | Updated |

---

## Intelligence Layer / Analytics

| Page | Route | Component | Back Target | Status |
|------|-------|-----------|-------------|--------|
| Revenue Analytics | /admin/revenue-analytics | revenue-analytics.tsx | /admin | Updated |
| Payouts Reports | /admin/payouts-reports | payouts-reports.tsx | /admin/payouts | Updated |
| Intelligence Dashboard | /admin/intelligence-dashboard | intelligence-dashboard.tsx | /admin | Updated |
| Operations Center | /admin/operations-center | operations-center.tsx | /admin | Updated |
| SafePilot Intelligence | /admin/safepilot-intelligence | safepilot-intelligence.tsx | /admin | Updated |

---

## People & KYC

| Page | Route | Component | Back Target | Status |
|------|-------|-----------|-------------|--------|
| Drivers | /admin/drivers | drivers.tsx | /admin | Updated |
| Customers | /admin/customers | customers.tsx | /admin | Updated |
| KYC | /admin/kyc | kyc.tsx | /admin | Updated |
| Users | /admin/users | users.tsx | /admin | Updated |

---

## Finance & Payouts

| Page | Route | Component | Back Target | Status |
|------|-------|-----------|-------------|--------|
| Wallets | /admin/wallets | wallets.tsx | /admin | Updated |
| Payouts | /admin/payouts | payouts.tsx | /admin | Updated |
| Payouts Schedule | /admin/payouts-schedule | payouts-schedule.tsx | /admin/payouts | Updated |
| Payouts Manual | /admin/payouts-manual | payouts-manual.tsx | /admin/payouts | Updated |
| Payouts Requests | /admin/payouts-requests | payouts-requests.tsx | /admin/payouts | Updated |

---

## Operations & Monitoring

| Page | Route | Component | Back Target | Status |
|------|-------|-----------|-------------|--------|
| Monitoring | /admin/monitoring | monitoring.tsx | /admin | Updated |
| Operations Dashboard | /admin/operations-dashboard | operations-dashboard.tsx | /admin | Updated |
| Complaints | /admin/complaints | complaints.tsx | /admin | Updated |
| Parcels | /admin/parcels | parcels.tsx | /admin | Updated |
| Complaint Resolution | /admin/complaint-resolution | complaint-resolution.tsx | /admin | Updated |
| Driver Violations | /admin/driver-violations | driver-violations.tsx | /admin | Updated |
| Ratings Center | /admin/ratings-center | ratings-center.tsx | /admin | Updated |
| Ride Timeline | /admin/ride-timeline | ride-timeline.tsx | /admin | Updated |
| Earnings Disputes | /admin/earnings-disputes | earnings-disputes.tsx | /admin | Updated |

---

## Document Management

| Page | Route | Component | Back Target | Status |
|------|-------|-----------|-------------|--------|
| Documents | /admin/documents | documents.tsx | /admin | Updated |
| Document Manager | /admin/document-manager | document-manager.tsx | /admin | Updated |

---

## Communication

| Page | Route | Component | Back Target | Status |
|------|-------|-----------|-------------|--------|
| Notification Center | /admin/notifications | notifications.tsx | /admin | Updated |
| Notification Rules | /admin/notification-rules | notification-rules.tsx | /admin | Updated |
| Communication Hub | /admin/communication-hub | communication-hub.tsx | /admin | Updated |
| Admin Chat | /admin/admin-chat | admin-chat.tsx | /admin | Updated |
| Email Templates | /admin/email-templates | email-templates.tsx | /admin | Updated |
| SMS Templates | /admin/sms-templates | sms-templates.tsx | /admin | Updated |

---

## Legal & Policy

| Page | Route | Component | Back Target | Status |
|------|-------|-----------|-------------|--------|
| Legal Requests | /admin/legal-requests | legal-requests.tsx | /admin | Updated |
| Refund Center | /admin/refund-center | refund-center.tsx | /admin | Updated |
| Policy Engine | /admin/policy-engine | policy-engine.tsx | /admin | Updated |

---

## Safety & Security

| Page | Route | Component | Back Target | Status |
|------|-------|-----------|-------------|--------|
| Safety Replay | /admin/safety-replay | safety-replay.tsx | /admin | Updated |
| Map Control | /admin/map-control | map-control.tsx | /admin | Updated |

---

## Search & Payments

| Page | Route | Component | Back Target | Status |
|------|-------|-----------|-------------|--------|
| Global Search | /admin/global-search | global-search.tsx | /admin | Updated |
| Payment Integrity | /admin/payment-integrity | payment-integrity.tsx | /admin | Updated |

---

## Notes

1. All pages now implement consistent minimal header design with back buttons
2. Back buttons navigate to the most logical parent route
3. Mobile responsiveness: "Back to X" on desktop, "Back" on mobile
4. Sticky headers with `backdrop-blur-sm` for scroll behavior
5. **Architectural Recommendation:** Consider refactoring to use shared PageHeader component for centralized maintenance
