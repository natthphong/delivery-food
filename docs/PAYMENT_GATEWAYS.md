# Payment Gateways

## Current Design

Payment integration is backend-owned and provider-driven.

Core pieces:

- `payment_methods`
- `payment_providers`
- `payment_webhook_events`
- `PaymentGateway` interface
- `OmiseGateway`

## Current Providers

- wallet balance
- manual QR/slip
- Omise PromptPay gateway checkout

## Omise

Environment:

- `OMISE_SECRET_KEY`
- `OMISE_PUBLIC_KEY`

Backend responsibilities:

- create source/charge
- normalize provider status
- persist provider reference
- persist expiry / paid / failure details through normalized transaction fields and `payment_action`
- store safe frontend payment action payload
- process webhooks
- persist webhook events

Normalized Omise fields surfaced to the frontend:

- charge id
- source id
- provider status
- paid / authorized flags
- paid at
- expires at
- failure code / failure message
- scannable QR image URL
- authorize URL when present

Status rules:

- paid or successful -> `accepted`
- pending and not yet expired -> `pending`
- pending and `expires_at` in the past without payment -> `expired`
- failed / cancelled -> `rejected`

Retry rules:

- expired or rejected payment transactions can create a new payment attempt through `POST /v1/transactions/{id}/retry`
- the old transaction remains historical and is not re-used
- the linked order is re-pointed to the new transaction

## Frontend Contract

Frontend should consume:

- normalized payment methods
- transaction status
- provider status
- `paymentAction`

Active customer flow notes:

- Omise PromptPay is the primary QR path
- legacy manual-slip methods are filtered out from checkout through `scope=checkout`
- frontend renders the provider QR URL directly from backend data and does not generate PromptPay payloads client-side

Frontend should not:

- hold provider secrets
- compute authoritative payment state
- infer status transitions client-side

## Extending To Another Provider

1. add provider row/preset data
2. implement `PaymentGateway`
3. register it in `PaymentService`
4. document any new checkout flow in API docs and frontend services
