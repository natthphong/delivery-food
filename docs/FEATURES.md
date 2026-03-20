# Features

## Authentication

- Firebase login via frontend auth SDK and backend token exchange
- LINE LIFF login via frontend callback page and backend profile login
- access token + refresh token session model
- authenticated bootstrap endpoint for initial app hydration

## Branch Discovery

- keyword search across product name, description, and search terms
- optional category filtering
- optional distance-aware ordering when latitude/longitude is provided
- product sample preview on each branch card

## Menu Browsing

- branch detail page with featured and full menu modes
- branch-level pricing and stock awareness
- add-on selection per product
- recommended items surfaced at branch level

## Cart

- normalized cart grouped by branch
- quantity update and removal
- clear-by-branch action
- single-branch checkout draft persisted in local storage

## Checkout

- payment method selection from branch/company-enabled methods
- delivery location confirmation on map
- single-branch validation at checkout
- wallet payment and QR/slip payment support

## Payments

- payment transaction creation
- deposit/top-up transaction creation
- QR pending transaction with expiry
- local or remote slip verification path
- transaction detail view with status and order summary

## Account

- profile editing
- wallet balance display
- email verification refresh action
- transaction history
- order history

## Preset Demo Data

The seeded local dataset provides:

- 1 company
- 4 categories
- 8 products
- 7 add-ons
- 3 branches with hours and product availability
- wallet and QR payment methods
