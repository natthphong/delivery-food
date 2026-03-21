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
- store safe frontend payment action payload
- process webhooks
- persist webhook events

## Frontend Contract

Frontend should consume:

- normalized payment methods
- transaction status
- provider status
- `paymentAction`

Frontend should not:

- hold provider secrets
- compute authoritative payment state
- infer status transitions client-side

## Extending To Another Provider

1. add provider row/preset data
2. implement `PaymentGateway`
3. register it in `PaymentService`
4. document any new checkout flow in API docs and frontend services
