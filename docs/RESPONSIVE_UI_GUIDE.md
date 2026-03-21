# Responsive UI Guide

## Design Direction

The application is optimized for food ordering on phones first, then tablets, then desktop.

## Current Interaction Patterns

- floating cart button for quick mobile access
- cart drawer as a mobile bottom sheet and desktop side panel
- strong price visibility on cards, cart lines, checkout, and payment detail
- checkout summary sticks on larger screens
- tap-sized controls for quantity changes, add-to-cart, and payment selection
- clear empty, loading, and error states in main ordering flows

## Mobile Rules

- prioritize one-handed actions near the lower viewport
- keep quantity controls large and direct
- avoid burying the main CTA below long content
- keep branch/menu cards readable without hover assumptions

## Tablet Rules

- do not simply stretch mobile layouts edge to edge
- use split layouts for content + summary where it improves scanability
- preserve clear hierarchy between branch content and checkout/payment summaries

## Component-Level Guidance

### Search and Branch Discovery

- branch cards should surface name, distance, and sample dishes quickly
- search controls must remain usable without precise cursor input

### Menu Browsing

- product cards should show image, title, stock state, and price immediately
- add-on selection should stay obvious and not hide cost changes

### Cart

- keep branch grouping visible
- make removal and quantity adjustment accessible without page navigation
- preserve a strong checkout CTA at the bottom of the drawer

### Checkout

- summarize selected items and subtotal clearly
- make payment method selection obvious and thumb-friendly
- keep map confirmation readable and not visually cramped on mobile

### Payment Detail

- transaction state, amount, and next action should be visible above the fold
- slip upload must remain easy on touch devices

## When Extending the UI

- prefer reusable UI components in `src/components`
- keep page files orchestration-focused
- add responsive behavior intentionally, not as a side effect of generic flexbox stretching
