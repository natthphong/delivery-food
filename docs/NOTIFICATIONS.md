# Notifications

## Overview

Notification delivery is backend-owned.

The Go service sends:

- email verification emails
- provider-login notice emails
- customer/admin operational order emails where configured
- LINE push notifications for LINE-linked users on order events

Frontend notifications remain local UI notices only.

## Environment

- `RESEND_API_KEY`
- `EMAIL_FROM`
- `EMAIL_NOTIFY_TO`
- `LINE_CHANNEL_SECRET`
- `LINE_CHANNEL_TOKEN`

If these values are missing, the backend falls back to no-op delivery for the corresponding channel.

## Backend Design

`NotificationService` wraps two abstractions:

- `Mailer`
- `LineMessenger`

Current implementations:

- `ResendMailer`
- `LineBotClient`

This keeps service workflows testable and allows new channels/providers later without spreading delivery code across handlers.

## Current Events

Email:

- verification link request
- provider-based sign-in notice
- order placed
- order ready
- rider assigned
- rider on the way

LINE:

- order placed
- order ready
- rider assigned
- rider on the way

LINE delivery is skipped automatically when the user is not LINE-linked.

## Copy Rules

- keep messages short and operational
- no emoji
- backend owns channel-specific wording
- frontend should not duplicate provider notification logic
