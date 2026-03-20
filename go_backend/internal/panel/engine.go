package panel

import (
	"context"
	"encoding/json"
	"fmt"
	"regexp"
	"sort"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

var fieldNormalizePattern = regexp.MustCompile(`[^a-z0-9]+`)

type Engines struct {
	Graph      *GraphEngine
	Schema     *NodeSchemaEngine
	Mapping    *MappingEngine
	Lineage    *LineageEngine
	Workspace  *WorkspaceEngine
	Migrations *MigrationEngine
}

func NewEngines(db *pgxpool.Pool) *Engines {
	graph := &GraphEngine{db: db}
	schema := &NodeSchemaEngine{db: db}
	mapping := &MappingEngine{db: db}
	lineage := &LineageEngine{db: db}
	workspace := &WorkspaceEngine{db: db}
	migrations := &MigrationEngine{db: db}
	return &Engines{Graph: graph, Schema: schema, Mapping: mapping, Lineage: lineage, Workspace: workspace, Migrations: migrations}
}

type GraphEngine struct {
	db *pgxpool.Pool
}

func (e *GraphEngine) CreateNode(ctx context.Context, in Node) (Node, error) {
	q := `
	INSERT INTO nodes (flow_id, node_type, title, description, pos_x, pos_y, owner_team, tags, notes)
	VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
	RETURNING id, flow_id, node_type, title, description, pos_x, pos_y, owner_team, tags, notes, created_at, updated_at`
	var out Node
	err := e.db.QueryRow(ctx, q,
		in.FlowID, in.Type, in.Title, in.Description, in.PositionX, in.PositionY,
		in.TeamOwner, in.Tags, in.Notes,
	).Scan(
		&out.ID, &out.FlowID, &out.Type, &out.Title, &out.Description, &out.PositionX,
		&out.PositionY, &out.TeamOwner, &out.Tags, &out.Notes, &out.CreatedAt, &out.UpdatedAt,
	)
	return out, err
}

func (e *GraphEngine) UpdateNode(ctx context.Context, id string, in Node) (Node, error) {
	q := `
	UPDATE nodes
	SET node_type = COALESCE(NULLIF($2,''), node_type),
	    title = COALESCE(NULLIF($3,''), title),
	    description = COALESCE($4, description),
	    owner_team = COALESCE($5, owner_team),
	    tags = COALESCE($6, tags),
	    notes = COALESCE($7, notes),
	    updated_at = now()
	WHERE id = $1
	RETURNING id, flow_id, node_type, title, description, pos_x, pos_y, owner_team, tags, notes, created_at, updated_at`
	var out Node
	err := e.db.QueryRow(ctx, q, id, in.Type, in.Title, nullable(in.Description), nullable(in.TeamOwner), in.Tags, nullable(in.Notes)).Scan(
		&out.ID, &out.FlowID, &out.Type, &out.Title, &out.Description, &out.PositionX,
		&out.PositionY, &out.TeamOwner, &out.Tags, &out.Notes, &out.CreatedAt, &out.UpdatedAt,
	)
	return out, err
}

func (e *GraphEngine) DeleteNode(ctx context.Context, id string) error {
	_, err := e.db.Exec(ctx, `DELETE FROM nodes WHERE id = $1`, id)
	return err
}

func (e *GraphEngine) MoveNode(ctx context.Context, id string, x, y float64) (Node, error) {
	q := `
	UPDATE nodes
	SET pos_x = $2, pos_y = $3, updated_at = now()
	WHERE id = $1
	RETURNING id, flow_id, node_type, title, description, pos_x, pos_y, owner_team, tags, notes, created_at, updated_at`
	var out Node
	err := e.db.QueryRow(ctx, q, id, x, y).Scan(
		&out.ID, &out.FlowID, &out.Type, &out.Title, &out.Description, &out.PositionX,
		&out.PositionY, &out.TeamOwner, &out.Tags, &out.Notes, &out.CreatedAt, &out.UpdatedAt,
	)
	return out, err
}

func (e *GraphEngine) ListGraphNodes(ctx context.Context, flowID string) ([]Node, error) {
	rows, err := e.db.Query(ctx, `SELECT id, flow_id, node_type, title, description, pos_x, pos_y, owner_team, tags, notes, created_at, updated_at FROM nodes WHERE flow_id = $1 ORDER BY created_at`, flowID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := make([]Node, 0)
	for rows.Next() {
		var node Node
		if err := rows.Scan(&node.ID, &node.FlowID, &node.Type, &node.Title, &node.Description, &node.PositionX, &node.PositionY, &node.TeamOwner, &node.Tags, &node.Notes, &node.CreatedAt, &node.UpdatedAt); err != nil {
			return nil, err
		}
		out = append(out, node)
	}
	return out, rows.Err()
}

func (e *GraphEngine) CreateEdge(ctx context.Context, in Edge) (Edge, error) {
	q := `
	INSERT INTO edges (flow_id, from_node_id, to_node_id, protocol, endpoint, description)
	VALUES ($1,$2,$3,$4,$5,$6)
	RETURNING id, flow_id, from_node_id, to_node_id, protocol, endpoint, description, created_at`
	var out Edge
	err := e.db.QueryRow(ctx, q, in.FlowID, in.SourceNodeID, in.TargetNodeID, in.Protocol, in.Endpoint, in.Description).Scan(
		&out.ID, &out.FlowID, &out.SourceNodeID, &out.TargetNodeID, &out.Protocol, &out.Endpoint, &out.Description, &out.CreatedAt,
	)
	return out, err
}

func (e *GraphEngine) UpdateEdge(ctx context.Context, id string, in Edge) (Edge, error) {
	q := `
	UPDATE edges
	SET protocol = COALESCE(NULLIF($2,''), protocol),
	    endpoint = COALESCE($3, endpoint),
	    description = COALESCE($4, description),
	    updated_at = now()
	WHERE id = $1
	RETURNING id, flow_id, from_node_id, to_node_id, protocol, endpoint, description, created_at`
	var out Edge
	err := e.db.QueryRow(ctx, q, id, in.Protocol, nullable(in.Endpoint), nullable(in.Description)).Scan(
		&out.ID, &out.FlowID, &out.SourceNodeID, &out.TargetNodeID, &out.Protocol, &out.Endpoint, &out.Description, &out.CreatedAt,
	)
	return out, err
}

func (e *GraphEngine) DeleteEdge(ctx context.Context, id string) error {
	_, err := e.db.Exec(ctx, `DELETE FROM edges WHERE id = $1`, id)
	return err
}

func (e *GraphEngine) ListGraphEdges(ctx context.Context, flowID string) ([]Edge, error) {
	rows, err := e.db.Query(ctx, `SELECT id, flow_id, from_node_id, to_node_id, protocol, endpoint, description, created_at FROM edges WHERE flow_id = $1 ORDER BY created_at`, flowID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := make([]Edge, 0)
	for rows.Next() {
		var edge Edge
		if err := rows.Scan(&edge.ID, &edge.FlowID, &edge.SourceNodeID, &edge.TargetNodeID, &edge.Protocol, &edge.Endpoint, &edge.Description, &edge.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, edge)
	}
	return out, rows.Err()
}

func (e *GraphEngine) AutoLayout(ctx context.Context, flowID string) ([]Node, error) {
	nodes, err := e.ListGraphNodes(ctx, flowID)
	if err != nil {
		return nil, err
	}
	if len(nodes) == 0 {
		return nodes, nil
	}
	edges, err := e.ListGraphEdges(ctx, flowID)
	if err != nil {
		return nil, err
	}
	positions := BuildAutoLayout(nodes, edges)
	for nodeID, position := range positions {
		if _, err := e.db.Exec(ctx, `
		UPDATE nodes
		SET pos_x = $2, pos_y = $3, updated_at = now()
		WHERE id = $1`, nodeID, position.X, position.Y); err != nil {
			return nil, err
		}
	}
	return e.ListGraphNodes(ctx, flowID)
}

type NodeSchemaEngine struct {
	db *pgxpool.Pool
}

func (e *NodeSchemaEngine) ImportSchemaFromJSON(ctx context.Context, nodeID, payload string) ([]Field, error) {
	var parsed any
	if err := json.Unmarshal([]byte(payload), &parsed); err != nil {
		return nil, fmt.Errorf("invalid json payload: %w", err)
	}
	seen := map[string]string{}
	flattenFields(parsed, "", seen)
	paths := make([]string, 0, len(seen))
	for p := range seen {
		paths = append(paths, p)
	}
	sort.Strings(paths)

	fieldRole := "request"
	out := make([]Field, 0, len(paths))
	for _, path := range paths {
		created, err := e.AddField(ctx, Field{
			NodeID:       nodeID,
			Path:         path,
			FieldName:    fieldNameFromPath(path),
			DisplayName:  fieldNameFromPath(path),
			Normalized:   normalizeFieldToken(path),
			Canonical:    normalizeFieldToken(fieldNameFromPath(path)),
			FieldRole:    fieldRole,
			Type:         seen[path],
			SourceType:   "derived",
			Description:  "Imported from JSON payload",
			ExampleValue: "",
		})
		if err != nil {
			return nil, err
		}
		out = append(out, created)
	}
	return out, nil
}

func (e *NodeSchemaEngine) AddField(ctx context.Context, in Field) (Field, error) {
	if strings.TrimSpace(in.FieldName) == "" {
		in.FieldName = fieldNameFromPath(in.Path)
	}
	if strings.TrimSpace(in.DisplayName) == "" {
		in.DisplayName = in.FieldName
	}
	if strings.TrimSpace(in.Normalized) == "" {
		in.Normalized = normalizeFieldToken(in.Path)
	}
	if strings.TrimSpace(in.Canonical) == "" {
		in.Canonical = normalizeFieldToken(in.FieldName)
	}
	if strings.TrimSpace(in.FieldRole) == "" {
		in.FieldRole = "request"
	}

	q := `
	INSERT INTO fields (node_id, path, field_name, display_name, normalized_name, canonical_name, field_role, parent_field_id, sort_order, type, description, source_type, example_value)
	VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
	ON CONFLICT (node_id, path)
	DO UPDATE SET
	  field_name = excluded.field_name,
	  display_name = excluded.display_name,
	  normalized_name = excluded.normalized_name,
	  canonical_name = excluded.canonical_name,
	  field_role = excluded.field_role,
	  parent_field_id = excluded.parent_field_id,
	  sort_order = excluded.sort_order,
	  type = excluded.type,
	  description = excluded.description,
	  source_type = excluded.source_type,
	  example_value = excluded.example_value,
	  updated_at = now()
	RETURNING id, node_id, path, field_name, display_name, normalized_name, COALESCE(canonical_name,''), field_role, parent_field_id, sort_order, type, description, source_type, example_value, created_at, updated_at`
	var out Field
	err := e.db.QueryRow(ctx, q, in.NodeID, in.Path, in.FieldName, in.DisplayName, in.Normalized, nullable(in.Canonical), in.FieldRole, in.ParentField, in.SortOrder, in.Type, in.Description, in.SourceType, in.ExampleValue).Scan(
		&out.ID, &out.NodeID, &out.Path, &out.FieldName, &out.DisplayName, &out.Normalized, &out.Canonical, &out.FieldRole, &out.ParentField, &out.SortOrder, &out.Type, &out.Description, &out.SourceType, &out.ExampleValue, &out.CreatedAt, &out.UpdatedAt,
	)
	return out, err
}

func (e *NodeSchemaEngine) UpdateField(ctx context.Context, id string, in Field) (Field, error) {
	q := `
	UPDATE fields
	SET path = COALESCE(NULLIF($2,''), path),
	    field_name = COALESCE(NULLIF($3,''), field_name),
	    display_name = COALESCE(NULLIF($4,''), display_name),
	    normalized_name = COALESCE(NULLIF($5,''), normalized_name),
	    canonical_name = COALESCE($6, canonical_name),
	    field_role = COALESCE(NULLIF($7,''), field_role),
	    parent_field_id = COALESCE($8, parent_field_id),
	    sort_order = COALESCE($9, sort_order),
	    type = COALESCE(NULLIF($10,''), type),
	    description = COALESCE($11, description),
	    source_type = COALESCE($12, source_type),
	    example_value = COALESCE($13, example_value),
	    updated_at = now()
	WHERE id = $1
	RETURNING id, node_id, path, field_name, display_name, normalized_name, COALESCE(canonical_name,''), field_role, parent_field_id, sort_order, type, description, source_type, example_value, created_at, updated_at`
	var out Field
	err := e.db.QueryRow(ctx, q, id, in.Path, in.FieldName, in.DisplayName, in.Normalized, nullable(in.Canonical), in.FieldRole, in.ParentField, in.SortOrder, in.Type, nullable(in.Description), nullable(in.SourceType), nullable(in.ExampleValue)).Scan(
		&out.ID, &out.NodeID, &out.Path, &out.FieldName, &out.DisplayName, &out.Normalized, &out.Canonical, &out.FieldRole, &out.ParentField, &out.SortOrder, &out.Type, &out.Description, &out.SourceType, &out.ExampleValue, &out.CreatedAt, &out.UpdatedAt,
	)
	return out, err
}

func (e *NodeSchemaEngine) DeleteField(ctx context.Context, id string) error {
	_, err := e.db.Exec(ctx, `DELETE FROM fields WHERE id = $1`, id)
	return err
}

func (e *NodeSchemaEngine) ListFields(ctx context.Context, nodeID string) ([]Field, error) {
	rows, err := e.db.Query(ctx, `SELECT id, node_id, path, field_name, display_name, normalized_name, COALESCE(canonical_name,''), field_role, parent_field_id, sort_order, type, description, source_type, example_value, created_at, updated_at FROM fields WHERE node_id = $1 ORDER BY path`, nodeID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := make([]Field, 0)
	for rows.Next() {
		var f Field
		if err := rows.Scan(&f.ID, &f.NodeID, &f.Path, &f.FieldName, &f.DisplayName, &f.Normalized, &f.Canonical, &f.FieldRole, &f.ParentField, &f.SortOrder, &f.Type, &f.Description, &f.SourceType, &f.ExampleValue, &f.CreatedAt, &f.UpdatedAt); err != nil {
			return nil, err
		}
		out = append(out, f)
	}
	return out, rows.Err()
}

type MappingEngine struct {
	db *pgxpool.Pool
}

func (e *MappingEngine) CreateMapping(ctx context.Context, in Mapping) (Mapping, error) {
	if in.LinkType == "" {
		in.LinkType = "manual"
	}
	q := `
	INSERT INTO field_mappings (edge_id, flow_id, source_node_id, source_field_id, target_node_id, target_field_id, mapping_type, transform_rule, condition, notes, confidence, link_type)
	SELECT $1, e.flow_id, e.from_node_id, $2, e.to_node_id, $3, $4, $5, $6, $7, $8, $9
	FROM edges e
	WHERE e.id = $1
	RETURNING id, edge_id, flow_id, source_node_id, source_field_id, target_node_id, target_field_id, mapping_type, transform_rule, condition, notes, confidence, link_type, created_at, updated_at`
	var out Mapping
	err := e.db.QueryRow(ctx, q, in.EdgeID, in.SourceField, in.TargetField, strings.ToUpper(in.MappingType), in.Transform, in.Condition, in.Notes, in.Confidence, in.LinkType).Scan(
		&out.ID, &out.EdgeID, &out.FlowID, &out.SourceNode, &out.SourceField, &out.TargetNode, &out.TargetField, &out.MappingType, &out.Transform, &out.Condition, &out.Notes, &out.Confidence, &out.LinkType, &out.CreatedAt, &out.UpdatedAt,
	)
	return out, err
}

func (e *MappingEngine) UpdateMapping(ctx context.Context, id string, in Mapping) (Mapping, error) {
	q := `
	UPDATE field_mappings
	SET source_field_id = COALESCE($2, source_field_id),
	    target_field_id = COALESCE($3, target_field_id),
	    mapping_type = COALESCE(NULLIF($4,''), mapping_type),
	    transform_rule = COALESCE($5, transform_rule),
	    condition = COALESCE($6, condition),
	    notes = COALESCE($7, notes),
	    confidence = COALESCE($8, confidence),
	    link_type = COALESCE(NULLIF($9,''), link_type),
	    updated_at = now()
	WHERE id = $1
	RETURNING id, edge_id, flow_id, source_node_id, source_field_id, target_node_id, target_field_id, mapping_type, transform_rule, condition, notes, confidence, link_type, created_at, updated_at`
	var out Mapping
	err := e.db.QueryRow(ctx, q, id, in.SourceField, in.TargetField, strings.ToUpper(in.MappingType), nullable(in.Transform), nullable(in.Condition), nullable(in.Notes), in.Confidence, in.LinkType).Scan(
		&out.ID, &out.EdgeID, &out.FlowID, &out.SourceNode, &out.SourceField, &out.TargetNode, &out.TargetField, &out.MappingType, &out.Transform, &out.Condition, &out.Notes, &out.Confidence, &out.LinkType, &out.CreatedAt, &out.UpdatedAt,
	)
	return out, err
}

func (e *MappingEngine) DeleteMapping(ctx context.Context, id string) error {
	_, err := e.db.Exec(ctx, `DELETE FROM field_mappings WHERE id = $1`, id)
	return err
}

func (e *MappingEngine) ListMappingsForEdge(ctx context.Context, edgeID string) ([]Mapping, error) {
	rows, err := e.db.Query(ctx, `SELECT id, edge_id, flow_id, source_node_id, source_field_id, target_node_id, target_field_id, mapping_type, transform_rule, condition, notes, confidence, link_type, created_at, updated_at FROM field_mappings WHERE edge_id = $1 ORDER BY created_at`, edgeID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := make([]Mapping, 0)
	for rows.Next() {
		var m Mapping
		if err := rows.Scan(&m.ID, &m.EdgeID, &m.FlowID, &m.SourceNode, &m.SourceField, &m.TargetNode, &m.TargetField, &m.MappingType, &m.Transform, &m.Condition, &m.Notes, &m.Confidence, &m.LinkType, &m.CreatedAt, &m.UpdatedAt); err != nil {
			return nil, err
		}
		out = append(out, m)
	}
	return out, rows.Err()
}

type LineageEngine struct {
	db *pgxpool.Pool
}

func (e *LineageEngine) SearchField(ctx context.Context, flowID, field string) (LineageResult, error) {
	return e.compute(ctx, flowID, field)
}

func (e *LineageEngine) ComputeLineage(ctx context.Context, flowID, field string) (LineageResult, error) {
	return e.compute(ctx, flowID, field)
}

func (e *LineageEngine) HighlightLineage(ctx context.Context, flowID, field string) (LineageResult, error) {
	return e.compute(ctx, flowID, field)
}

func (e *LineageEngine) compute(ctx context.Context, flowID, field string) (LineageResult, error) {
	needle := strings.TrimSpace(field)
	if needle == "" {
		return LineageResult{Field: field}, nil
	}
	norm := normalizeFieldToken(needle)

	seedQ := `
	SELECT DISTINCT f.id, f.node_id, f.path, f.field_name, f.display_name, f.normalized_name, COALESCE(f.canonical_name,''), f.field_role, f.parent_field_id, f.sort_order, f.type, f.description, f.source_type, f.example_value, f.created_at, f.updated_at
	FROM fields f
	JOIN nodes n ON n.id = f.node_id
	LEFT JOIN field_concept_links fcl ON fcl.field_id = f.id
	LEFT JOIN field_concepts fc ON fc.id = fcl.concept_id
	WHERE n.flow_id = $1
	  AND (
	    f.path ILIKE '%' || $2 || '%'
	    OR f.field_name ILIKE '%' || $2 || '%'
	    OR f.display_name ILIKE '%' || $2 || '%'
	    OR f.normalized_name = $3
	    OR COALESCE(f.canonical_name,'') = $3
	    OR fc.concept_key = $3
	  )`
	seedRows, err := e.db.Query(ctx, seedQ, flowID, needle, norm)
	if err != nil {
		return LineageResult{}, err
	}
	defer seedRows.Close()
	fieldsByID := map[string]Field{}
	for seedRows.Next() {
		var f Field
		if err := seedRows.Scan(&f.ID, &f.NodeID, &f.Path, &f.FieldName, &f.DisplayName, &f.Normalized, &f.Canonical, &f.FieldRole, &f.ParentField, &f.SortOrder, &f.Type, &f.Description, &f.SourceType, &f.ExampleValue, &f.CreatedAt, &f.UpdatedAt); err != nil {
			return LineageResult{}, err
		}
		fieldsByID[f.ID] = f
	}

	type mapRow struct {
		MappingID    string
		EdgeID       string
		SourceNodeID string
		TargetNodeID string
		SourceField  *string
		TargetField  *string
		SourcePath   string
		TargetPath   string
	}
	rows, err := e.db.Query(ctx, `
	SELECT m.id, m.edge_id, e.from_node_id, e.to_node_id, m.source_field_id, m.target_field_id, COALESCE(sf.path, ''), COALESCE(tf.path, '')
	FROM field_mappings m
	JOIN edges e ON e.id = m.edge_id
	LEFT JOIN fields sf ON sf.id = m.source_field_id
	LEFT JOIN fields tf ON tf.id = m.target_field_id
	WHERE e.flow_id = $1
	ORDER BY m.created_at`, flowID)
	if err != nil {
		return LineageResult{}, err
	}
	defer rows.Close()
	allMappings := make([]mapRow, 0)
	fieldAdj := map[string][]string{}
	for rows.Next() {
		var r mapRow
		if err := rows.Scan(&r.MappingID, &r.EdgeID, &r.SourceNodeID, &r.TargetNodeID, &r.SourceField, &r.TargetField, &r.SourcePath, &r.TargetPath); err != nil {
			return LineageResult{}, err
		}
		allMappings = append(allMappings, r)
		if r.SourceField != nil && r.TargetField != nil {
			fieldAdj[*r.SourceField] = append(fieldAdj[*r.SourceField], *r.TargetField)
			fieldAdj[*r.TargetField] = append(fieldAdj[*r.TargetField], *r.SourceField)
		}
	}

	conceptRows, err := e.db.Query(ctx, `
	SELECT fc.id, fc.flow_id, fc.concept_key, fc.display_name, fc.description, fc.created_at, fc.updated_at
	FROM field_concepts fc
	WHERE fc.flow_id = $1 AND fc.concept_key = $2`, flowID, norm)
	if err != nil {
		return LineageResult{}, err
	}
	defer conceptRows.Close()
	concepts := make([]FieldConcept, 0)
	conceptIDs := make([]string, 0)
	for conceptRows.Next() {
		var c FieldConcept
		if err := conceptRows.Scan(&c.ID, &c.FlowID, &c.ConceptKey, &c.DisplayName, &c.Description, &c.CreatedAt, &c.UpdatedAt); err != nil {
			return LineageResult{}, err
		}
		concepts = append(concepts, c)
		conceptIDs = append(conceptIDs, c.ID)
	}
	if len(conceptIDs) > 0 {
		linkRows, err := e.db.Query(ctx, `
		SELECT f.id, f.node_id, f.path, f.field_name, f.display_name, f.normalized_name, COALESCE(f.canonical_name,''), f.field_role, f.parent_field_id, f.sort_order, f.type, f.description, f.source_type, f.example_value, f.created_at, f.updated_at
		FROM field_concept_links l
		JOIN fields f ON f.id = l.field_id
		WHERE l.concept_id = ANY($1::uuid[])`, conceptIDs)
		if err != nil {
			return LineageResult{}, err
		}
		defer linkRows.Close()
		for linkRows.Next() {
			var f Field
			if err := linkRows.Scan(&f.ID, &f.NodeID, &f.Path, &f.FieldName, &f.DisplayName, &f.Normalized, &f.Canonical, &f.FieldRole, &f.ParentField, &f.SortOrder, &f.Type, &f.Description, &f.SourceType, &f.ExampleValue, &f.CreatedAt, &f.UpdatedAt); err != nil {
				return LineageResult{}, err
			}
			fieldsByID[f.ID] = f
		}
	}

	seedIDs := make([]string, 0, len(fieldsByID))
	for id := range fieldsByID {
		seedIDs = append(seedIDs, id)
	}
	visited := map[string]struct{}{}
	queue := append([]string{}, seedIDs...)
	for len(queue) > 0 {
		current := queue[0]
		queue = queue[1:]
		if _, ok := visited[current]; ok {
			continue
		}
		visited[current] = struct{}{}
		for _, next := range fieldAdj[current] {
			if _, ok := visited[next]; !ok {
				queue = append(queue, next)
			}
		}
	}

	for id := range visited {
		if _, ok := fieldsByID[id]; ok {
			continue
		}
		var f Field
		err := e.db.QueryRow(ctx, `SELECT id, node_id, path, field_name, display_name, normalized_name, COALESCE(canonical_name,''), field_role, parent_field_id, sort_order, type, description, source_type, example_value, created_at, updated_at FROM fields WHERE id = $1`, id).
			Scan(&f.ID, &f.NodeID, &f.Path, &f.FieldName, &f.DisplayName, &f.Normalized, &f.Canonical, &f.FieldRole, &f.ParentField, &f.SortOrder, &f.Type, &f.Description, &f.SourceType, &f.ExampleValue, &f.CreatedAt, &f.UpdatedAt)
		if err == nil {
			fieldsByID[id] = f
		}
	}

	steps := make([]LineageStep, 0)
	for _, m := range allMappings {
		match := false
		if m.SourceField != nil {
			_, match = visited[*m.SourceField]
		}
		if !match && m.TargetField != nil {
			_, match = visited[*m.TargetField]
		}
		if match {
			steps = append(steps, LineageStep{
				MappingID:    m.MappingID,
				EdgeID:       m.EdgeID,
				SourceNodeID: m.SourceNodeID,
				TargetNodeID: m.TargetNodeID,
				SourcePath:   m.SourcePath,
				TargetPath:   m.TargetPath,
			})
		}
	}
	result := BuildLineageResult(field, steps)
	result.Concepts = concepts

	matched := make([]Field, 0, len(fieldsByID))
	aliases := map[string]struct{}{}
	for _, f := range fieldsByID {
		matched = append(matched, f)
		if strings.TrimSpace(f.FieldName) != "" {
			aliases[f.FieldName] = struct{}{}
		}
		if strings.TrimSpace(f.Path) != "" {
			aliases[f.Path] = struct{}{}
		}
	}
	sort.Slice(matched, func(i, j int) bool {
		if matched[i].NodeID == matched[j].NodeID {
			return matched[i].Path < matched[j].Path
		}
		return matched[i].NodeID < matched[j].NodeID
	})
	result.MatchedFields = matched
	result.RelatedAliases = make([]string, 0, len(aliases))
	for alias := range aliases {
		result.RelatedAliases = append(result.RelatedAliases, alias)
	}
	sort.Strings(result.RelatedAliases)
	return result, nil
}

type WorkspaceEngine struct {
	db *pgxpool.Pool
}

func (e *WorkspaceEngine) CreateNote(ctx context.Context, flowID string, in Note) (Note, error) {
	if in.Width <= 0 {
		in.Width = 260
	}
	if in.Height <= 0 {
		in.Height = 160
	}
	if strings.TrimSpace(in.Content) == "" {
		in.Content = "Add implementation notes, assumptions, or TODOs."
	}

	var out Note
	err := e.db.QueryRow(ctx, `
	INSERT INTO notes (flow_id, node_id, content, width, height, position_x, position_y)
	VALUES ($1, $2, $3, $4, $5, $6, $7)
	RETURNING id, flow_id, node_id, content, width, height, position_x, position_y, created_at, updated_at`,
		flowID, in.NodeID, in.Content, in.Width, in.Height, in.PositionX, in.PositionY).
		Scan(&out.ID, &out.FlowID, &out.NodeID, &out.Content, &out.Width, &out.Height, &out.PositionX, &out.PositionY, &out.CreatedAt, &out.UpdatedAt)
	return out, err
}

func (e *WorkspaceEngine) UpdateNote(ctx context.Context, id string, patch NotePatch) (Note, error) {
	var out Note
	err := e.db.QueryRow(ctx, `
	UPDATE notes
	SET content = COALESCE($2, content),
	    width = COALESCE($3, width),
	    height = COALESCE($4, height),
	    position_x = COALESCE($5, position_x),
	    position_y = COALESCE($6, position_y),
	    updated_at = now()
	WHERE id = $1
	RETURNING id, flow_id, node_id, content, width, height, position_x, position_y, created_at, updated_at`,
		id, patch.Content, patch.Width, patch.Height, patch.PositionX, patch.PositionY).
		Scan(&out.ID, &out.FlowID, &out.NodeID, &out.Content, &out.Width, &out.Height, &out.PositionX, &out.PositionY, &out.CreatedAt, &out.UpdatedAt)
	return out, err
}

func (e *WorkspaceEngine) DeleteNote(ctx context.Context, id string) error {
	_, err := e.db.Exec(ctx, `DELETE FROM notes WHERE id = $1`, id)
	return err
}

func (e *WorkspaceEngine) GetWorkspace(ctx context.Context, flowID string) (Workspace, error) {
	var ws Workspace
	flowQ := `SELECT id, project_id, code, name, description, created_at, updated_at FROM flows WHERE id = $1`
	if err := e.db.QueryRow(ctx, flowQ, flowID).Scan(&ws.Flow.ID, &ws.Flow.ProjectID, &ws.Flow.Code, &ws.Flow.Name, &ws.Flow.Description, &ws.Flow.CreatedAt, &ws.Flow.UpdatedAt); err != nil {
		return Workspace{}, err
	}

	graph := &GraphEngine{db: e.db}
	nodes, err := graph.ListGraphNodes(ctx, flowID)
	if err != nil {
		return Workspace{}, err
	}
	edges, err := graph.ListGraphEdges(ctx, flowID)
	if err != nil {
		return Workspace{}, err
	}

	fields := make([]Field, 0)
	for _, n := range nodes {
		nodeFields, err := (&NodeSchemaEngine{db: e.db}).ListFields(ctx, n.ID)
		if err != nil {
			return Workspace{}, err
		}
		fields = append(fields, nodeFields...)
	}

	rows, err := e.db.Query(ctx, `SELECT id, edge_id, flow_id, source_node_id, source_field_id, target_node_id, target_field_id, mapping_type, transform_rule, condition, notes, confidence, link_type, created_at, updated_at FROM field_mappings WHERE edge_id IN (SELECT id FROM edges WHERE flow_id = $1) ORDER BY created_at`, flowID)
	if err != nil {
		return Workspace{}, err
	}
	defer rows.Close()
	mappings := make([]Mapping, 0)
	for rows.Next() {
		var m Mapping
		if err := rows.Scan(&m.ID, &m.EdgeID, &m.FlowID, &m.SourceNode, &m.SourceField, &m.TargetNode, &m.TargetField, &m.MappingType, &m.Transform, &m.Condition, &m.Notes, &m.Confidence, &m.LinkType, &m.CreatedAt, &m.UpdatedAt); err != nil {
			return Workspace{}, err
		}
		mappings = append(mappings, m)
	}

	noteRows, err := e.db.Query(ctx, `SELECT id, flow_id, node_id, content, width, height, position_x, position_y, created_at, updated_at FROM notes WHERE flow_id = $1 ORDER BY created_at`, flowID)
	if err != nil {
		return Workspace{}, err
	}
	defer noteRows.Close()
	notes := make([]Note, 0)
	for noteRows.Next() {
		var n Note
		if err := noteRows.Scan(&n.ID, &n.FlowID, &n.NodeID, &n.Content, &n.Width, &n.Height, &n.PositionX, &n.PositionY, &n.CreatedAt, &n.UpdatedAt); err != nil {
			return Workspace{}, err
		}
		notes = append(notes, n)
	}

	ws.Nodes = nodes
	ws.Edges = edges
	ws.Fields = fields
	ws.Mappings = mappings
	ws.Notes = notes
	return ws, nil
}

func flattenFields(v any, prefix string, out map[string]string) {
	switch typed := v.(type) {
	case map[string]any:
		for key, child := range typed {
			next := key
			if prefix != "" {
				next = prefix + "." + key
			}
			flattenFields(child, next, out)
		}
	case []any:
		arrPath := prefix + "[]"
		if prefix == "" {
			arrPath = "[]"
		}
		if len(typed) == 0 {
			out[arrPath] = "array"
			return
		}
		for _, child := range typed {
			flattenFields(child, arrPath, out)
		}
	default:
		if strings.TrimSpace(prefix) == "" {
			return
		}
		out[prefix] = inferDataType(typed)
	}
}

func inferDataType(v any) string {
	switch n := v.(type) {
	case string:
		_ = n
		return "string"
	case bool:
		return "boolean"
	case float64:
		if float64(int64(n)) == n {
			return "integer"
		}
		return "number"
	case nil:
		return "null"
	default:
		return "unknown"
	}
}

func nullable(v string) any {
	if strings.TrimSpace(v) == "" {
		return nil
	}
	return v
}

func normalizeFieldToken(v string) string {
	token := strings.ToLower(strings.TrimSpace(v))
	return fieldNormalizePattern.ReplaceAllString(token, "")
}

func fieldNameFromPath(path string) string {
	chunks := strings.Split(path, ".")
	if len(chunks) == 0 {
		return path
	}
	last := chunks[len(chunks)-1]
	last = strings.TrimSuffix(last, "[]")
	if last == "" {
		return path
	}
	return last
}

func IsNotFound(err error) bool {
	return err == pgx.ErrNoRows
}
