# Responsive UI Guide

## Visual Direction

- white surfaces
- soft green / emerald accents
- slate neutrals
- rounded app-like cards
- clear, high-contrast CTA hierarchy
- avoid dark marketing heroes on task screens
- keep customer, admin, and rider surfaces visually related

## Customer App Rules

Priority:

1. mobile
2. tablet
3. desktop

Guidelines:

- keep ordering actions reachable near the lower viewport
- keep prices visible at all times
- keep the cart obvious and accessible
- use sticky summaries/CTAs where they speed checkout
- show branch closed / ordering paused / item unavailable states clearly
- make quantity and payment interactions thumb-friendly

Key customer screens:

- home/branch discovery should feel like an ordering app, not a marketing page
- branch detail should surface fulfillment support and operational notes early
- checkout should keep fulfillment, payment, and final total tightly grouped
- payment detail should show QR, expiry, or retry action above the fold
- account navigation should keep admin access inside the account menu instead of customer tabs

## Admin App Rules

Priority:

1. web
2. tablet
3. mobile usable

Guidelines:

- favor split-pane layouts on tablet/desktop for list + detail workflows
- keep filters and forms readable without horizontal scroll
- preserve mobile access by stacking sections cleanly
- use status pills and compact summary cards for scanability
- keep admin chrome light, practical, and consistent with the customer palette

## Component Standards

- pages orchestrate
- components stay reusable
- services own endpoint interaction
- avoid giant all-in-one screens without reusable sections

## States To Always Design

- loading
- empty
- error
- disabled / unavailable
- permission-limited

These matter on both customer and admin surfaces.
