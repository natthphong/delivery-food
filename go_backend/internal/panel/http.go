package panel

import (
	"context"
	"errors"
	"fmt"
	"regexp"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/jackc/pgx/v5"
)

const systemUserID = "10000000-0000-0000-0000-000000000001"

var nonSlug = regexp.MustCompile(`[^a-z0-9]+`)

func RegisterRoutes(app fiber.Router, engines *Engines) {
	app.Post("/local/test/login", func(c *fiber.Ctx) error {
		var req struct {
			Email    string `json:"email"`
			FullName string `json:"full_name"`
		}
		_ = c.BodyParser(&req)
		if strings.TrimSpace(req.Email) == "" {
			req.Email = "local@example.com"
		}
		if strings.TrimSpace(req.FullName) == "" {
			req.FullName = "Local Engineer"
		}
		return ok(c, fiber.Map{
			"access_token": "local-mock-token",
			"accessToken":  "local-mock-token",
			"user": fiber.Map{
				"id":            "10000000-0000-0000-0000-000000000001",
				"email":         req.Email,
				"full_name":     req.FullName,
				"fullName":      req.FullName,
				"auth_provider": "local_mock",
				"authProvider":  "local_mock",
				"status":        "active",
			},
		})
	})

	v1 := app.Group("/api/v1")

	v1.Post("/auth/login", func(c *fiber.Ctx) error {
		var req struct {
			Email    string `json:"email"`
			FullName string `json:"fullName"`
		}
		_ = c.BodyParser(&req)
		if strings.TrimSpace(req.Email) == "" {
			req.Email = "demo@panel.local"
		}
		if strings.TrimSpace(req.FullName) == "" {
			req.FullName = "Demo Engineer"
		}
		return ok(c, fiber.Map{
			"accessToken": "local-mock-token",
			"user": fiber.Map{
				"id":           "10000000-0000-0000-0000-000000000001",
				"email":        req.Email,
				"fullName":     req.FullName,
				"authProvider": "oauth",
				"status":       "active",
			},
			"mockAuth": true,
		})
	})

	v1.Get("/auth/me", func(c *fiber.Ctx) error {
		return ok(c, fiber.Map{
			"id":           "10000000-0000-0000-0000-000000000001",
			"email":        "demo@panel.local",
			"fullName":     "Demo Engineer",
			"authProvider": "oauth",
			"status":       "active",
		})
	})

	v1.Get("/health", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{"code": "SUCCESS", "message": "ok", "body": fiber.Map{"service": "MicroserviceDataPanel", "status": "ok"}})
	})

	v1.Get("/projects", func(c *fiber.Ctx) error {
		rows, err := engines.Workspace.db.Query(c.Context(), `
		SELECT p.id, p.name, p.description, p.created_at, p.updated_at, COUNT(f.id) AS flow_count
		FROM projects p
		LEFT JOIN flows f ON f.project_id = p.id
		GROUP BY p.id, p.name, p.description, p.created_at, p.updated_at
		ORDER BY p.updated_at DESC`)
		if err != nil {
			return fail(c, fiber.StatusInternalServerError, err)
		}
		defer rows.Close()
		projects := make([]fiber.Map, 0)
		for rows.Next() {
			var p Project
			var flowCount int
			if err := rows.Scan(&p.ID, &p.Name, &p.Description, &p.CreatedAt, &p.UpdatedAt, &flowCount); err != nil {
				return fail(c, fiber.StatusInternalServerError, err)
			}
			projects = append(projects, fiber.Map{
				"id":          p.ID,
				"name":        p.Name,
				"description": p.Description,
				"createdAt":   p.CreatedAt,
				"updatedAt":   p.UpdatedAt,
				"flowCount":   flowCount,
			})
		}
		return ok(c, projects)
	})

	v1.Post("/projects", func(c *fiber.Ctx) error {
		var req struct {
			Name        string `json:"name"`
			Description string `json:"description"`
		}
		if err := c.BodyParser(&req); err != nil {
			return failCode(c, fiber.StatusBadRequest, "BAD_REQUEST", "invalid payload")
		}
		req.Name = strings.TrimSpace(req.Name)
		if req.Name == "" {
			return failCode(c, fiber.StatusBadRequest, "BAD_REQUEST", "name is required")
		}
		if err := ensureSystemUser(c.Context(), engines); err != nil {
			return fail(c, fiber.StatusInternalServerError, err)
		}
		nowKey := fmt.Sprintf("%s-%d", toSlug(req.Name), time.Now().UnixMilli())
		var id, name, description string
		var createdAt, updatedAt time.Time
		err := engines.Workspace.db.QueryRow(c.Context(), `
		INSERT INTO projects (key, name, description, owner_user_id, status)
		VALUES ($1, $2, $3, $4, 'active')
		RETURNING id, name, description, created_at, updated_at`, nowKey, req.Name, req.Description, systemUserID).
			Scan(&id, &name, &description, &createdAt, &updatedAt)
		if err != nil {
			return fail(c, fiber.StatusInternalServerError, err)
		}
		return ok(c, fiber.Map{
			"id":          id,
			"name":        name,
			"description": description,
			"createdAt":   createdAt,
			"updatedAt":   updatedAt,
			"flowCount":   0,
		})
	})

	v1.Get("/projects/:projectId", func(c *fiber.Ctx) error {
		var id, name, description string
		var createdAt, updatedAt time.Time
		err := engines.Workspace.db.QueryRow(c.Context(), `
		SELECT id, name, description, created_at, updated_at
		FROM projects
		WHERE id = $1`, c.Params("projectId")).Scan(&id, &name, &description, &createdAt, &updatedAt)
		if err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				return failCode(c, fiber.StatusNotFound, "NOT_FOUND", "project not found")
			}
			return fail(c, fiber.StatusInternalServerError, err)
		}
		return ok(c, fiber.Map{
			"id":          id,
			"name":        name,
			"description": description,
			"createdAt":   createdAt,
			"updatedAt":   updatedAt,
		})
	})

	v1.Get("/projects/:projectId/flows", func(c *fiber.Ctx) error {
		rows, err := engines.Workspace.db.Query(c.Context(), `SELECT id, project_id, code, name, description, created_at, updated_at FROM flows WHERE project_id=$1 ORDER BY created_at`, c.Params("projectId"))
		if err != nil {
			return fail(c, fiber.StatusInternalServerError, err)
		}
		defer rows.Close()
		flows := make([]Flow, 0)
		for rows.Next() {
			var f Flow
			if err := rows.Scan(&f.ID, &f.ProjectID, &f.Code, &f.Name, &f.Description, &f.CreatedAt, &f.UpdatedAt); err != nil {
				return fail(c, fiber.StatusInternalServerError, err)
			}
			flows = append(flows, f)
		}
		return ok(c, flows)
	})

	v1.Post("/projects/:projectId/flows", func(c *fiber.Ctx) error {
		var req struct {
			Name        string `json:"name"`
			Description string `json:"description"`
		}
		if err := c.BodyParser(&req); err != nil {
			return failCode(c, fiber.StatusBadRequest, "BAD_REQUEST", "invalid payload")
		}
		req.Name = strings.TrimSpace(req.Name)
		if req.Name == "" {
			return failCode(c, fiber.StatusBadRequest, "BAD_REQUEST", "name is required")
		}
		if err := ensureSystemUser(c.Context(), engines); err != nil {
			return fail(c, fiber.StatusInternalServerError, err)
		}
		code := fmt.Sprintf("%s-%d", toSlug(req.Name), time.Now().UnixMilli())
		var f Flow
		err := engines.Workspace.db.QueryRow(c.Context(), `
		INSERT INTO flows (project_id, code, name, description, business_domain, status, created_by, updated_by)
		VALUES ($1, $2, $3, $4, '', 'draft', $5, $5)
		RETURNING id, project_id, code, name, description, created_at, updated_at`,
			c.Params("projectId"), code, req.Name, req.Description, systemUserID).
			Scan(&f.ID, &f.ProjectID, &f.Code, &f.Name, &f.Description, &f.CreatedAt, &f.UpdatedAt)
		if err != nil {
			return fail(c, fiber.StatusInternalServerError, err)
		}
		return ok(c, f)
	})

	v1.Get("/flows/:flowId", func(c *fiber.Ctx) error {
		var f Flow
		err := engines.Workspace.db.QueryRow(c.Context(), `
		SELECT id, project_id, code, name, description, created_at, updated_at
		FROM flows
		WHERE id = $1`, c.Params("flowId")).
			Scan(&f.ID, &f.ProjectID, &f.Code, &f.Name, &f.Description, &f.CreatedAt, &f.UpdatedAt)
		if err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				return failCode(c, fiber.StatusNotFound, "NOT_FOUND", "flow not found")
			}
			return fail(c, fiber.StatusInternalServerError, err)
		}
		return ok(c, f)
	})

	v1.Get("/workspace/flows/:flowId", func(c *fiber.Ctx) error {
		ws, err := engines.Workspace.GetWorkspace(c.Context(), c.Params("flowId"))
		if err != nil {
			if IsNotFound(err) {
				return failCode(c, fiber.StatusNotFound, "NOT_FOUND", "flow not found")
			}
			return fail(c, fiber.StatusInternalServerError, err)
		}
		return ok(c, ws)
	})

	v1.Post("/workspace/flows/:flowId/notes", func(c *fiber.Ctx) error {
		var in Note
		if err := c.BodyParser(&in); err != nil {
			return failCode(c, fiber.StatusBadRequest, "BAD_REQUEST", "invalid payload")
		}
		created, err := engines.Workspace.CreateNote(c.Context(), c.Params("flowId"), in)
		if err != nil {
			return fail(c, fiber.StatusInternalServerError, err)
		}
		return ok(c, created)
	})

	v1.Patch("/workspace/notes/:id", func(c *fiber.Ctx) error {
		var in NotePatch
		if err := c.BodyParser(&in); err != nil {
			return failCode(c, fiber.StatusBadRequest, "BAD_REQUEST", "invalid payload")
		}
		updated, err := engines.Workspace.UpdateNote(c.Context(), c.Params("id"), in)
		if err != nil {
			if IsNotFound(err) {
				return failCode(c, fiber.StatusNotFound, "NOT_FOUND", "note not found")
			}
			return fail(c, fiber.StatusInternalServerError, err)
		}
		return ok(c, updated)
	})

	v1.Delete("/workspace/notes/:id", func(c *fiber.Ctx) error {
		if err := engines.Workspace.DeleteNote(c.Context(), c.Params("id")); err != nil {
			return fail(c, fiber.StatusInternalServerError, err)
		}
		return ok(c, fiber.Map{"deleted": true})
	})

	v1.Post("/graph/nodes", func(c *fiber.Ctx) error {
		var in Node
		if err := c.BodyParser(&in); err != nil {
			return failCode(c, fiber.StatusBadRequest, "BAD_REQUEST", "invalid payload")
		}
		if err := ValidateNodeInput(in); err != nil {
			return failCode(c, fiber.StatusBadRequest, "BAD_REQUEST", err.Error())
		}
		created, err := engines.Graph.CreateNode(c.Context(), in)
		if err != nil {
			return fail(c, fiber.StatusInternalServerError, err)
		}
		return ok(c, created)
	})

	v1.Patch("/graph/nodes/:id", func(c *fiber.Ctx) error {
		var in Node
		if err := c.BodyParser(&in); err != nil {
			return failCode(c, fiber.StatusBadRequest, "BAD_REQUEST", "invalid payload")
		}
		updated, err := engines.Graph.UpdateNode(c.Context(), c.Params("id"), in)
		if err != nil {
			if IsNotFound(err) {
				return failCode(c, fiber.StatusNotFound, "NOT_FOUND", "node not found")
			}
			return fail(c, fiber.StatusInternalServerError, err)
		}
		return ok(c, updated)
	})

	v1.Delete("/graph/nodes/:id", func(c *fiber.Ctx) error {
		if err := engines.Graph.DeleteNode(c.Context(), c.Params("id")); err != nil {
			return fail(c, fiber.StatusInternalServerError, err)
		}
		return ok(c, fiber.Map{"deleted": true})
	})

	v1.Patch("/graph/nodes/:id/move", func(c *fiber.Ctx) error {
		var payload struct {
			X float64 `json:"position_x"`
			Y float64 `json:"position_y"`
		}
		if err := c.BodyParser(&payload); err != nil {
			return failCode(c, fiber.StatusBadRequest, "BAD_REQUEST", "invalid payload")
		}
		moved, err := engines.Graph.MoveNode(c.Context(), c.Params("id"), payload.X, payload.Y)
		if err != nil {
			if IsNotFound(err) {
				return failCode(c, fiber.StatusNotFound, "NOT_FOUND", "node not found")
			}
			return fail(c, fiber.StatusInternalServerError, err)
		}
		return ok(c, moved)
	})

	v1.Post("/graph/flows/:flowId/auto-layout", func(c *fiber.Ctx) error {
		nodes, err := engines.Graph.AutoLayout(c.Context(), c.Params("flowId"))
		if err != nil {
			return fail(c, fiber.StatusInternalServerError, err)
		}
		return ok(c, nodes)
	})

	v1.Get("/graph/flows/:flowId/nodes", func(c *fiber.Ctx) error {
		nodes, err := engines.Graph.ListGraphNodes(c.Context(), c.Params("flowId"))
		if err != nil {
			return fail(c, fiber.StatusInternalServerError, err)
		}
		return ok(c, nodes)
	})

	v1.Get("/flows/:flowId/nodes", func(c *fiber.Ctx) error {
		nodes, err := engines.Graph.ListGraphNodes(c.Context(), c.Params("flowId"))
		if err != nil {
			return fail(c, fiber.StatusInternalServerError, err)
		}
		return ok(c, nodes)
	})

	v1.Post("/flows/:flowId/nodes", func(c *fiber.Ctx) error {
		var in Node
		if err := c.BodyParser(&in); err != nil {
			return failCode(c, fiber.StatusBadRequest, "BAD_REQUEST", "invalid payload")
		}
		in.FlowID = c.Params("flowId")
		if err := ValidateNodeInput(in); err != nil {
			return failCode(c, fiber.StatusBadRequest, "BAD_REQUEST", err.Error())
		}
		created, err := engines.Graph.CreateNode(c.Context(), in)
		if err != nil {
			return fail(c, fiber.StatusInternalServerError, err)
		}
		return ok(c, created)
	})

	v1.Post("/graph/edges", func(c *fiber.Ctx) error {
		var in Edge
		if err := c.BodyParser(&in); err != nil {
			return failCode(c, fiber.StatusBadRequest, "BAD_REQUEST", "invalid payload")
		}
		if in.FlowID == "" || in.SourceNodeID == "" || in.TargetNodeID == "" {
			return failCode(c, fiber.StatusBadRequest, "BAD_REQUEST", "flow_id, source_node_id and target_node_id are required")
		}
		created, err := engines.Graph.CreateEdge(c.Context(), in)
		if err != nil {
			return fail(c, fiber.StatusInternalServerError, err)
		}
		return ok(c, created)
	})

	v1.Patch("/graph/edges/:id", func(c *fiber.Ctx) error {
		var in Edge
		if err := c.BodyParser(&in); err != nil {
			return failCode(c, fiber.StatusBadRequest, "BAD_REQUEST", "invalid payload")
		}
		updated, err := engines.Graph.UpdateEdge(c.Context(), c.Params("id"), in)
		if err != nil {
			if IsNotFound(err) {
				return failCode(c, fiber.StatusNotFound, "NOT_FOUND", "edge not found")
			}
			return fail(c, fiber.StatusInternalServerError, err)
		}
		return ok(c, updated)
	})

	v1.Delete("/graph/edges/:id", func(c *fiber.Ctx) error {
		if err := engines.Graph.DeleteEdge(c.Context(), c.Params("id")); err != nil {
			return fail(c, fiber.StatusInternalServerError, err)
		}
		return ok(c, fiber.Map{"deleted": true})
	})

	v1.Get("/graph/flows/:flowId/edges", func(c *fiber.Ctx) error {
		edges, err := engines.Graph.ListGraphEdges(c.Context(), c.Params("flowId"))
		if err != nil {
			return fail(c, fiber.StatusInternalServerError, err)
		}
		return ok(c, edges)
	})

	v1.Get("/flows/:flowId/edges", func(c *fiber.Ctx) error {
		edges, err := engines.Graph.ListGraphEdges(c.Context(), c.Params("flowId"))
		if err != nil {
			return fail(c, fiber.StatusInternalServerError, err)
		}
		return ok(c, edges)
	})

	v1.Post("/flows/:flowId/edges", func(c *fiber.Ctx) error {
		var in Edge
		if err := c.BodyParser(&in); err != nil {
			return failCode(c, fiber.StatusBadRequest, "BAD_REQUEST", "invalid payload")
		}
		in.FlowID = c.Params("flowId")
		if in.SourceNodeID == "" || in.TargetNodeID == "" {
			return failCode(c, fiber.StatusBadRequest, "BAD_REQUEST", "source_node_id and target_node_id are required")
		}
		created, err := engines.Graph.CreateEdge(c.Context(), in)
		if err != nil {
			return fail(c, fiber.StatusInternalServerError, err)
		}
		return ok(c, created)
	})

	v1.Post("/schema/nodes/:nodeId/import-json", func(c *fiber.Ctx) error {
		var payload struct {
			Payload string `json:"payload"`
			Role    string `json:"role"`
		}
		if err := c.BodyParser(&payload); err != nil {
			return failCode(c, fiber.StatusBadRequest, "BAD_REQUEST", "invalid payload")
		}
		fields, err := engines.Schema.ImportSchemaFromJSON(c.Context(), c.Params("nodeId"), payload.Payload)
		if err != nil {
			return failCode(c, fiber.StatusBadRequest, "BAD_REQUEST", err.Error())
		}
		if strings.TrimSpace(payload.Role) != "" && len(fields) > 0 {
			_, _ = engines.Workspace.db.Exec(c.Context(), `
			UPDATE fields
			SET field_role = $2, updated_at = now()
			WHERE id = ANY($1::uuid[])`, fieldIDs(fields), strings.TrimSpace(payload.Role))
			for i := range fields {
				fields[i].FieldRole = strings.TrimSpace(payload.Role)
			}
		}
		return ok(c, fields)
	})

	v1.Post("/nodes/:nodeId/import-schema", func(c *fiber.Ctx) error {
		var payload struct {
			Payload string `json:"payload"`
			Role    string `json:"role"`
		}
		if err := c.BodyParser(&payload); err != nil {
			return failCode(c, fiber.StatusBadRequest, "BAD_REQUEST", "invalid payload")
		}
		fields, err := engines.Schema.ImportSchemaFromJSON(c.Context(), c.Params("nodeId"), payload.Payload)
		if err != nil {
			return failCode(c, fiber.StatusBadRequest, "BAD_REQUEST", err.Error())
		}
		if strings.TrimSpace(payload.Role) != "" && len(fields) > 0 {
			_, _ = engines.Workspace.db.Exec(c.Context(), `
			UPDATE fields
			SET field_role = $2, updated_at = now()
			WHERE id = ANY($1::uuid[])`, fieldIDs(fields), strings.TrimSpace(payload.Role))
			for i := range fields {
				fields[i].FieldRole = strings.TrimSpace(payload.Role)
			}
		}
		return ok(c, fields)
	})

	v1.Post("/schema/fields", func(c *fiber.Ctx) error {
		var in Field
		if err := c.BodyParser(&in); err != nil {
			return failCode(c, fiber.StatusBadRequest, "BAD_REQUEST", "invalid payload")
		}
		if strings.TrimSpace(in.NodeID) == "" || strings.TrimSpace(in.Path) == "" {
			return failCode(c, fiber.StatusBadRequest, "BAD_REQUEST", "node_id and path are required")
		}
		created, err := engines.Schema.AddField(c.Context(), in)
		if err != nil {
			return fail(c, fiber.StatusInternalServerError, err)
		}
		return ok(c, created)
	})

	v1.Post("/nodes/:nodeId/fields", func(c *fiber.Ctx) error {
		var in Field
		if err := c.BodyParser(&in); err != nil {
			return failCode(c, fiber.StatusBadRequest, "BAD_REQUEST", "invalid payload")
		}
		in.NodeID = c.Params("nodeId")
		if strings.TrimSpace(in.Path) == "" {
			return failCode(c, fiber.StatusBadRequest, "BAD_REQUEST", "path is required")
		}
		created, err := engines.Schema.AddField(c.Context(), in)
		if err != nil {
			return fail(c, fiber.StatusInternalServerError, err)
		}
		return ok(c, created)
	})

	v1.Patch("/schema/fields/:id", func(c *fiber.Ctx) error {
		var in Field
		if err := c.BodyParser(&in); err != nil {
			return failCode(c, fiber.StatusBadRequest, "BAD_REQUEST", "invalid payload")
		}
		updated, err := engines.Schema.UpdateField(c.Context(), c.Params("id"), in)
		if err != nil {
			if IsNotFound(err) {
				return failCode(c, fiber.StatusNotFound, "NOT_FOUND", "field not found")
			}
			return fail(c, fiber.StatusInternalServerError, err)
		}
		return ok(c, updated)
	})

	v1.Patch("/node-fields/:id", func(c *fiber.Ctx) error {
		var in Field
		if err := c.BodyParser(&in); err != nil {
			return failCode(c, fiber.StatusBadRequest, "BAD_REQUEST", "invalid payload")
		}
		updated, err := engines.Schema.UpdateField(c.Context(), c.Params("id"), in)
		if err != nil {
			if IsNotFound(err) {
				return failCode(c, fiber.StatusNotFound, "NOT_FOUND", "field not found")
			}
			return fail(c, fiber.StatusInternalServerError, err)
		}
		return ok(c, updated)
	})

	v1.Delete("/schema/fields/:id", func(c *fiber.Ctx) error {
		if err := engines.Schema.DeleteField(c.Context(), c.Params("id")); err != nil {
			return fail(c, fiber.StatusInternalServerError, err)
		}
		return ok(c, fiber.Map{"deleted": true})
	})

	v1.Delete("/node-fields/:id", func(c *fiber.Ctx) error {
		if err := engines.Schema.DeleteField(c.Context(), c.Params("id")); err != nil {
			return fail(c, fiber.StatusInternalServerError, err)
		}
		return ok(c, fiber.Map{"deleted": true})
	})

	v1.Get("/schema/nodes/:nodeId/fields", func(c *fiber.Ctx) error {
		fields, err := engines.Schema.ListFields(c.Context(), c.Params("nodeId"))
		if err != nil {
			return fail(c, fiber.StatusInternalServerError, err)
		}
		role := strings.TrimSpace(c.Query("role"))
		if role != "" {
			filtered := make([]Field, 0)
			for _, f := range fields {
				if f.FieldRole == role {
					filtered = append(filtered, f)
				}
			}
			return ok(c, filtered)
		}
		return ok(c, fields)
	})

	v1.Get("/nodes/:nodeId/fields", func(c *fiber.Ctx) error {
		fields, err := engines.Schema.ListFields(c.Context(), c.Params("nodeId"))
		if err != nil {
			return fail(c, fiber.StatusInternalServerError, err)
		}
		role := strings.TrimSpace(c.Query("role"))
		if role != "" {
			filtered := make([]Field, 0)
			for _, f := range fields {
				if f.FieldRole == role {
					filtered = append(filtered, f)
				}
			}
			return ok(c, filtered)
		}
		return ok(c, fields)
	})

	v1.Post("/mappings", func(c *fiber.Ctx) error {
		var in Mapping
		if err := c.BodyParser(&in); err != nil {
			return failCode(c, fiber.StatusBadRequest, "BAD_REQUEST", "invalid payload")
		}
		if in.EdgeID == "" || in.MappingType == "" {
			return failCode(c, fiber.StatusBadRequest, "BAD_REQUEST", "edge_id and mapping_type are required")
		}
		if err := ValidateMappingInput(in); err != nil {
			return failCode(c, fiber.StatusBadRequest, "BAD_REQUEST", err.Error())
		}
		created, err := engines.Mapping.CreateMapping(c.Context(), in)
		if err != nil {
			return fail(c, fiber.StatusInternalServerError, err)
		}
		return ok(c, created)
	})

	v1.Patch("/mappings/:id", func(c *fiber.Ctx) error {
		var in Mapping
		if err := c.BodyParser(&in); err != nil {
			return failCode(c, fiber.StatusBadRequest, "BAD_REQUEST", "invalid payload")
		}
		updated, err := engines.Mapping.UpdateMapping(c.Context(), c.Params("id"), in)
		if err != nil {
			if IsNotFound(err) {
				return failCode(c, fiber.StatusNotFound, "NOT_FOUND", "mapping not found")
			}
			return fail(c, fiber.StatusInternalServerError, err)
		}
		return ok(c, updated)
	})

	v1.Delete("/mappings/:id", func(c *fiber.Ctx) error {
		if err := engines.Mapping.DeleteMapping(c.Context(), c.Params("id")); err != nil {
			return fail(c, fiber.StatusInternalServerError, err)
		}
		return ok(c, fiber.Map{"deleted": true})
	})

	v1.Get("/mappings/edges/:edgeId", func(c *fiber.Ctx) error {
		mappings, err := engines.Mapping.ListMappingsForEdge(c.Context(), c.Params("edgeId"))
		if err != nil {
			return fail(c, fiber.StatusInternalServerError, err)
		}
		return ok(c, mappings)
	})

	v1.Get("/flows/:flowId/mappings", func(c *fiber.Ctx) error {
		rows, err := engines.Workspace.db.Query(c.Context(), `
		SELECT id, edge_id, source_field_id, target_field_id, mapping_type, transform_rule, condition, notes, created_at, updated_at
		FROM field_mappings
		WHERE edge_id IN (SELECT id FROM edges WHERE flow_id = $1)
		ORDER BY created_at`, c.Params("flowId"))
		if err != nil {
			return fail(c, fiber.StatusInternalServerError, err)
		}
		defer rows.Close()
		mappings := make([]Mapping, 0)
		for rows.Next() {
			var m Mapping
			if err := rows.Scan(&m.ID, &m.EdgeID, &m.SourceField, &m.TargetField, &m.MappingType, &m.Transform, &m.Condition, &m.Notes, &m.CreatedAt, &m.UpdatedAt); err != nil {
				return fail(c, fiber.StatusInternalServerError, err)
			}
			mappings = append(mappings, m)
		}
		return ok(c, mappings)
	})

	v1.Post("/flows/:flowId/mappings", func(c *fiber.Ctx) error {
		var in Mapping
		if err := c.BodyParser(&in); err != nil {
			return failCode(c, fiber.StatusBadRequest, "BAD_REQUEST", "invalid payload")
		}
		if in.EdgeID == "" {
			return failCode(c, fiber.StatusBadRequest, "BAD_REQUEST", "edge_id is required")
		}
		created, err := engines.Mapping.CreateMapping(c.Context(), in)
		if err != nil {
			return fail(c, fiber.StatusInternalServerError, err)
		}
		return ok(c, created)
	})

	v1.Get("/lineage/search", func(c *fiber.Ctx) error {
		flowID := c.Query("flowId")
		field := c.Query("field")
		if flowID == "" || field == "" {
			return failCode(c, fiber.StatusBadRequest, "BAD_REQUEST", "flowId and field are required")
		}
		result, err := engines.Lineage.SearchField(c.Context(), flowID, field)
		if err != nil {
			return fail(c, fiber.StatusInternalServerError, err)
		}
		return ok(c, result)
	})

	v1.Get("/lineage/compute", func(c *fiber.Ctx) error {
		flowID := c.Query("flowId")
		field := c.Query("field")
		if flowID == "" || field == "" {
			return failCode(c, fiber.StatusBadRequest, "BAD_REQUEST", "flowId and field are required")
		}
		result, err := engines.Lineage.ComputeLineage(c.Context(), flowID, field)
		if err != nil {
			return fail(c, fiber.StatusInternalServerError, err)
		}
		return ok(c, result)
	})

	v1.Get("/lineage/highlight", func(c *fiber.Ctx) error {
		flowID := c.Query("flowId")
		field := c.Query("field")
		if flowID == "" || field == "" {
			return failCode(c, fiber.StatusBadRequest, "BAD_REQUEST", "flowId and field are required")
		}
		result, err := engines.Lineage.HighlightLineage(c.Context(), flowID, field)
		if err != nil {
			return fail(c, fiber.StatusInternalServerError, err)
		}
		return ok(c, result)
	})

	v1.Get("/flows/:flowId/lineage", func(c *fiber.Ctx) error {
		field := c.Query("fieldName")
		if strings.TrimSpace(field) == "" {
			return failCode(c, fiber.StatusBadRequest, "BAD_REQUEST", "fieldName is required")
		}
		result, err := engines.Lineage.HighlightLineage(c.Context(), c.Params("flowId"), field)
		if err != nil {
			return fail(c, fiber.StatusInternalServerError, err)
		}
		return ok(c, result)
	})

	v1.Get("/flows/:flowId/lineage/search", func(c *fiber.Ctx) error {
		q := strings.TrimSpace(c.Query("q"))
		if q == "" {
			return failCode(c, fiber.StatusBadRequest, "BAD_REQUEST", "q is required")
		}
		result, err := engines.Lineage.SearchField(c.Context(), c.Params("flowId"), q)
		if err != nil {
			return fail(c, fiber.StatusInternalServerError, err)
		}
		return ok(c, result)
	})

	v1.Get("/flows/:flowId/search", func(c *fiber.Ctx) error {
		q := strings.TrimSpace(c.Query("q"))
		if q == "" {
			return failCode(c, fiber.StatusBadRequest, "BAD_REQUEST", "q is required")
		}
		rows, err := engines.Workspace.db.Query(c.Context(), `
		SELECT id, title, node_type
		FROM nodes
		WHERE flow_id = $1
		  AND (title ILIKE '%' || $2 || '%' OR notes ILIKE '%' || $2 || '%')
		ORDER BY updated_at DESC
		LIMIT 30`, c.Params("flowId"), q)
		if err != nil {
			return fail(c, fiber.StatusInternalServerError, err)
		}
		defer rows.Close()
		items := make([]fiber.Map, 0)
		for rows.Next() {
			var id, title, nodeType string
			if err := rows.Scan(&id, &title, &nodeType); err != nil {
				return fail(c, fiber.StatusInternalServerError, err)
			}
			items = append(items, fiber.Map{"id": id, "title": title, "type": nodeType})
		}
		fieldRows, err := engines.Workspace.db.Query(c.Context(), `
		SELECT f.id, f.path, f.field_name, f.field_role, n.id, n.title
		FROM fields f
		JOIN nodes n ON n.id = f.node_id
		WHERE n.flow_id = $1
		  AND (
		    f.path ILIKE '%' || $2 || '%'
		    OR f.field_name ILIKE '%' || $2 || '%'
		    OR f.display_name ILIKE '%' || $2 || '%'
		    OR f.normalized_name = lower(regexp_replace($2, '[^a-zA-Z0-9]+', '', 'g'))
		  )
		ORDER BY n.updated_at DESC
		LIMIT 40`, c.Params("flowId"), q)
		if err != nil {
			return fail(c, fiber.StatusInternalServerError, err)
		}
		defer fieldRows.Close()
		fields := make([]fiber.Map, 0)
		for fieldRows.Next() {
			var fieldID, path, fieldName, fieldRole, nodeID, nodeTitle string
			if err := fieldRows.Scan(&fieldID, &path, &fieldName, &fieldRole, &nodeID, &nodeTitle); err != nil {
				return fail(c, fiber.StatusInternalServerError, err)
			}
			fields = append(fields, fiber.Map{
				"id":        fieldID,
				"path":      path,
				"fieldName": fieldName,
				"fieldRole": fieldRole,
				"nodeId":    nodeID,
				"nodeTitle": nodeTitle,
			})
		}
		return ok(c, fiber.Map{"nodes": items, "fields": fields})
	})

	v1.Get("/flows/:flowId/field-concepts/search", func(c *fiber.Ctx) error {
		q := strings.TrimSpace(c.Query("q"))
		if q == "" {
			return failCode(c, fiber.StatusBadRequest, "BAD_REQUEST", "q is required")
		}
		rows, err := engines.Workspace.db.Query(c.Context(), `
		SELECT id, flow_id, concept_key, display_name, description, created_at, updated_at
		FROM field_concepts
		WHERE flow_id = $1
		  AND (concept_key ILIKE '%' || $2 || '%' OR display_name ILIKE '%' || $2 || '%')
		ORDER BY updated_at DESC
		LIMIT 40`, c.Params("flowId"), q)
		if err != nil {
			return fail(c, fiber.StatusInternalServerError, err)
		}
		defer rows.Close()
		out := make([]FieldConcept, 0)
		for rows.Next() {
			var fc FieldConcept
			if err := rows.Scan(&fc.ID, &fc.FlowID, &fc.ConceptKey, &fc.DisplayName, &fc.Description, &fc.CreatedAt, &fc.UpdatedAt); err != nil {
				return fail(c, fiber.StatusInternalServerError, err)
			}
			out = append(out, fc)
		}
		return ok(c, out)
	})

	v1.Post("/field-concepts", func(c *fiber.Ctx) error {
		var in struct {
			FlowID      string `json:"flow_id"`
			ConceptKey  string `json:"concept_key"`
			DisplayName string `json:"display_name"`
			Description string `json:"description"`
		}
		if err := c.BodyParser(&in); err != nil {
			return failCode(c, fiber.StatusBadRequest, "BAD_REQUEST", "invalid payload")
		}
		if strings.TrimSpace(in.FlowID) == "" || strings.TrimSpace(in.ConceptKey) == "" {
			return failCode(c, fiber.StatusBadRequest, "BAD_REQUEST", "flow_id and concept_key are required")
		}
		var fc FieldConcept
		err := engines.Workspace.db.QueryRow(c.Context(), `
		INSERT INTO field_concepts (flow_id, concept_key, display_name, description)
		VALUES ($1, $2, $3, $4)
		ON CONFLICT (flow_id, concept_key) DO UPDATE
		SET display_name = EXCLUDED.display_name,
		    description = EXCLUDED.description,
		    updated_at = now()
		RETURNING id, flow_id, concept_key, display_name, description, created_at, updated_at`,
			in.FlowID, strings.TrimSpace(in.ConceptKey), in.DisplayName, in.Description).
			Scan(&fc.ID, &fc.FlowID, &fc.ConceptKey, &fc.DisplayName, &fc.Description, &fc.CreatedAt, &fc.UpdatedAt)
		if err != nil {
			return fail(c, fiber.StatusInternalServerError, err)
		}
		return ok(c, fc)
	})

	v1.Post("/field-concepts/:conceptId/link-field", func(c *fiber.Ctx) error {
		var in struct {
			FieldID    string   `json:"field_id"`
			Confidence *float64 `json:"confidence"`
			LinkType   string   `json:"link_type"`
		}
		if err := c.BodyParser(&in); err != nil {
			return failCode(c, fiber.StatusBadRequest, "BAD_REQUEST", "invalid payload")
		}
		if strings.TrimSpace(in.FieldID) == "" {
			return failCode(c, fiber.StatusBadRequest, "BAD_REQUEST", "field_id is required")
		}
		if strings.TrimSpace(in.LinkType) == "" {
			in.LinkType = "manual"
		}
		_, err := engines.Workspace.db.Exec(c.Context(), `
		INSERT INTO field_concept_links (concept_id, field_id, confidence, link_type)
		VALUES ($1, $2, $3, $4)
		ON CONFLICT (concept_id, field_id) DO UPDATE
		SET confidence = EXCLUDED.confidence,
		    link_type = EXCLUDED.link_type`,
			c.Params("conceptId"), in.FieldID, in.Confidence, in.LinkType)
		if err != nil {
			return fail(c, fiber.StatusInternalServerError, err)
		}
		return ok(c, fiber.Map{"linked": true})
	})
}

func fieldIDs(fields []Field) []string {
	out := make([]string, 0, len(fields))
	for _, f := range fields {
		out = append(out, f.ID)
	}
	return out
}

func ensureSystemUser(ctx context.Context, engines *Engines) error {
	_, err := engines.Workspace.db.Exec(ctx, `
	INSERT INTO users (id, email, full_name, auth_provider, status)
	VALUES ($1, 'demo@panel.local', 'Demo Engineer', 'seed', 'active')
	ON CONFLICT (id) DO NOTHING`, systemUserID)
	return err
}

func toSlug(s string) string {
	s = strings.ToLower(strings.TrimSpace(s))
	s = nonSlug.ReplaceAllString(s, "-")
	s = strings.Trim(s, "-")
	if s == "" {
		return "item"
	}
	return s
}

func ok(c *fiber.Ctx, body any) error {
	return c.Status(fiber.StatusOK).JSON(fiber.Map{"code": "SUCCESS", "message": "ok", "body": body})
}

func fail(c *fiber.Ctx, status int, err error) error {
	if errors.Is(err, pgx.ErrNoRows) {
		return failCode(c, fiber.StatusNotFound, "NOT_FOUND", "resource not found")
	}
	return failCode(c, status, "INTERNAL_ERROR", err.Error())
}

func failCode(c *fiber.Ctx, status int, code, message string) error {
	return c.Status(status).JSON(fiber.Map{"code": code, "message": message})
}
