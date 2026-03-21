# Rider Delivery

## Fulfillment Modes

- `pickup`
- `rider_delivery`

## Customer Flow

1. customer selects fulfillment mode at checkout
2. if `rider_delivery` is selected, branch delivery fee is added
3. payment succeeds
4. backend creates a `delivery_jobs` row
5. customer can see rider status through order detail/history

## Rider / Operations Flow

1. branch rider sees jobs in their scoped queue
2. rider claims a waiting job
3. job status can move through:
   - `assigned_to_rider`
   - `picked_up`
   - `delivered`
   - `failed_delivery`
   - `cancelled`
4. backend syncs related order status where appropriate

## Branch Scope

Riders are branch-scoped employees. They should not see or claim work outside their assigned branch scope.

## What This Design Does Not Try To Solve

- live GPS
- complex dispatch optimization
- multi-hop routing

The goal is practical branch-local delivery operations.
