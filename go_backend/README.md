# MicroserviceDataPanel Backend

Engine-oriented Go backend for microservice graph mapping and lineage.

## Engines
- `GraphEngine` (`internal/panel/engine.go`): node/edge CRUD, movement, auto-layout, graph lists
- `NodeSchemaEngine`: schema field CRUD and `ImportSchemaFromJSON`
- `MappingEngine`: mapping CRUD and list by edge
- `LineageEngine`: `SearchField`, `ComputeLineage`, `HighlightLineage`
- `WorkspaceEngine`: aggregated workspace payload plus sticky-note persistence
- `MigrationEngine`: startup migration + auto seed

## Run
```bash
cp .env.example .env
go run .
```

By default startup migration is enabled.
Set `MIGRATE_AUTO=false` only when you need to suppress automatic migration/seed behavior.

## Startup Migration + Seed
Startup will:
1. Applies all `backend/sql/*.sql` migration files except seed files
2. Checks `projects` count
3. Seeds `Core Banking Platform` demo data if empty

## Key Endpoints
- `GET /api/v1/workspace/flows/:flowId`
- `POST /api/v1/graph/flows/:flowId/auto-layout`
- `POST /api/v1/workspace/flows/:flowId/notes`
- `PATCH /api/v1/workspace/notes/:id`
- `POST /api/v1/graph/nodes`
- `PATCH /api/v1/graph/nodes/:id/move`
- `POST /api/v1/schema/nodes/:nodeId/import-json`
- `POST /api/v1/mappings`
- `GET /api/v1/lineage/highlight?flowId=...&field=accountId`

## Tests
```bash
GOCACHE=/tmp/go-build-cache GOTMPDIR=/tmp/go-tmp go test ./internal/panel
go test .
```
