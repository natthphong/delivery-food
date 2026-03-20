package repository

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"gitlab.com/home-server7795544/home-server/iam/iam-backend/internal/domain"
)

type PanelRepository struct {
	db *pgxpool.Pool
}

func NewPanelRepository(db *pgxpool.Pool) *PanelRepository {
	return &PanelRepository{db: db}
}

func (r *PanelRepository) UpsertUserByEmail(ctx context.Context, email, fullName, provider string) (domain.User, error) {
	q := `
	INSERT INTO users (email, full_name, auth_provider, status)
	VALUES ($1, $2, $3, 'active')
	ON CONFLICT (email)
	DO UPDATE SET full_name = EXCLUDED.full_name, auth_provider = EXCLUDED.auth_provider, updated_at = now()
	RETURNING id, email, full_name, auth_provider, status, created_at, updated_at`
	var out domain.User
	err := r.db.QueryRow(ctx, q, email, fullName, provider).Scan(
		&out.ID, &out.Email, &out.FullName, &out.AuthProvider, &out.Status, &out.CreatedAt, &out.UpdatedAt,
	)
	return out, err
}

func (r *PanelRepository) GetUserByID(ctx context.Context, userID string) (domain.User, error) {
	q := `SELECT id, email, full_name, auth_provider, status, created_at, updated_at FROM users WHERE id = $1`
	var out domain.User
	err := r.db.QueryRow(ctx, q, userID).Scan(&out.ID, &out.Email, &out.FullName, &out.AuthProvider, &out.Status, &out.CreatedAt, &out.UpdatedAt)
	return out, err
}

func (r *PanelRepository) ListProjects(ctx context.Context, userID string) ([]domain.Project, error) {
	q := `
	SELECT p.id, p.key, p.name, p.description, p.owner_user_id, p.status, p.created_at, p.updated_at
	FROM projects p
	JOIN project_members pm ON pm.project_id = p.id
	WHERE pm.user_id = $1
	ORDER BY p.created_at DESC`
	rows, err := r.db.Query(ctx, q, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := make([]domain.Project, 0)
	for rows.Next() {
		var item domain.Project
		if err := rows.Scan(&item.ID, &item.Key, &item.Name, &item.Description, &item.OwnerUserID, &item.Status, &item.CreatedAt, &item.UpdatedAt); err != nil {
			return nil, err
		}
		out = append(out, item)
	}
	return out, rows.Err()
}

func (r *PanelRepository) CreateProject(ctx context.Context, p domain.Project, ownerRole string) (domain.Project, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return domain.Project{}, err
	}
	defer tx.Rollback(ctx)

	query := `
	INSERT INTO projects (key, name, description, owner_user_id, status)
	VALUES ($1, $2, $3, $4, $5)
	RETURNING id, key, name, description, owner_user_id, status, created_at, updated_at`
	var out domain.Project
	err = tx.QueryRow(ctx, query, p.Key, p.Name, p.Description, p.OwnerUserID, p.Status).Scan(
		&out.ID, &out.Key, &out.Name, &out.Description, &out.OwnerUserID, &out.Status, &out.CreatedAt, &out.UpdatedAt,
	)
	if err != nil {
		return domain.Project{}, err
	}
	_, err = tx.Exec(ctx, `INSERT INTO project_members (project_id, user_id, role) VALUES ($1, $2, $3)`, out.ID, out.OwnerUserID, ownerRole)
	if err != nil {
		return domain.Project{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return domain.Project{}, err
	}
	return out, nil
}

func (r *PanelRepository) GetProjectByID(ctx context.Context, projectID string) (domain.Project, error) {
	q := `SELECT id, key, name, description, owner_user_id, status, created_at, updated_at FROM projects WHERE id = $1`
	var out domain.Project
	err := r.db.QueryRow(ctx, q, projectID).Scan(&out.ID, &out.Key, &out.Name, &out.Description, &out.OwnerUserID, &out.Status, &out.CreatedAt, &out.UpdatedAt)
	return out, err
}

func (r *PanelRepository) UpdateProject(ctx context.Context, p domain.Project) (domain.Project, error) {
	q := `
	UPDATE projects
	SET name = COALESCE(NULLIF($2, ''), name),
	    description = COALESCE($3, description),
	    status = COALESCE(NULLIF($4, ''), status),
	    updated_at = now()
	WHERE id = $1
	RETURNING id, key, name, description, owner_user_id, status, created_at, updated_at`
	var out domain.Project
	err := r.db.QueryRow(ctx, q, p.ID, p.Name, p.Description, p.Status).Scan(
		&out.ID, &out.Key, &out.Name, &out.Description, &out.OwnerUserID, &out.Status, &out.CreatedAt, &out.UpdatedAt,
	)
	return out, err
}

func (r *PanelRepository) ListProjectMembers(ctx context.Context, projectID string) ([]domain.ProjectMember, error) {
	rows, err := r.db.Query(ctx, `SELECT id, project_id, user_id, role, created_at FROM project_members WHERE project_id = $1 ORDER BY created_at`, projectID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := make([]domain.ProjectMember, 0)
	for rows.Next() {
		var m domain.ProjectMember
		if err := rows.Scan(&m.ID, &m.ProjectID, &m.UserID, &m.Role, &m.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, m)
	}
	return out, rows.Err()
}

func (r *PanelRepository) ListFlows(ctx context.Context, projectID string) ([]domain.Flow, error) {
	rows, err := r.db.Query(ctx, `SELECT id, project_id, code, name, description, business_domain, entry_node_id, status, version_no, created_by, updated_by, created_at, updated_at FROM flows WHERE project_id = $1 ORDER BY created_at DESC`, projectID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := make([]domain.Flow, 0)
	for rows.Next() {
		var f domain.Flow
		if err := rows.Scan(&f.ID, &f.ProjectID, &f.Code, &f.Name, &f.Description, &f.BusinessDomain, &f.EntryNodeID, &f.Status, &f.VersionNo, &f.CreatedBy, &f.UpdatedBy, &f.CreatedAt, &f.UpdatedAt); err != nil {
			return nil, err
		}
		out = append(out, f)
	}
	return out, rows.Err()
}

func (r *PanelRepository) CreateFlow(ctx context.Context, f domain.Flow) (domain.Flow, error) {
	q := `
	INSERT INTO flows (project_id, code, name, description, business_domain, entry_node_id, status, version_no, created_by, updated_by)
	VALUES ($1,$2,$3,$4,$5,$6,$7,1,$8,$8)
	RETURNING id, project_id, code, name, description, business_domain, entry_node_id, status, version_no, created_by, updated_by, created_at, updated_at`
	var out domain.Flow
	err := r.db.QueryRow(ctx, q, f.ProjectID, f.Code, f.Name, f.Description, f.BusinessDomain, f.EntryNodeID, f.Status, f.CreatedBy).Scan(
		&out.ID, &out.ProjectID, &out.Code, &out.Name, &out.Description, &out.BusinessDomain, &out.EntryNodeID, &out.Status, &out.VersionNo, &out.CreatedBy, &out.UpdatedBy, &out.CreatedAt, &out.UpdatedAt,
	)
	return out, err
}

func (r *PanelRepository) GetFlowByID(ctx context.Context, flowID string) (domain.Flow, error) {
	q := `SELECT id, project_id, code, name, description, business_domain, entry_node_id, status, version_no, created_by, updated_by, created_at, updated_at FROM flows WHERE id = $1`
	var out domain.Flow
	err := r.db.QueryRow(ctx, q, flowID).Scan(&out.ID, &out.ProjectID, &out.Code, &out.Name, &out.Description, &out.BusinessDomain, &out.EntryNodeID, &out.Status, &out.VersionNo, &out.CreatedBy, &out.UpdatedBy, &out.CreatedAt, &out.UpdatedAt)
	return out, err
}

func (r *PanelRepository) UpdateFlow(ctx context.Context, f domain.Flow) (domain.Flow, error) {
	q := `
	UPDATE flows
	SET name = COALESCE(NULLIF($2, ''), name),
	    description = COALESCE($3, description),
	    business_domain = COALESCE($4, business_domain),
	    entry_node_id = COALESCE($5, entry_node_id),
	    status = COALESCE(NULLIF($6, ''), status),
	    version_no = version_no + 1,
	    updated_by = $7,
	    updated_at = now()
	WHERE id = $1
	RETURNING id, project_id, code, name, description, business_domain, entry_node_id, status, version_no, created_by, updated_by, created_at, updated_at`
	var out domain.Flow
	err := r.db.QueryRow(ctx, q, f.ID, f.Name, f.Description, f.BusinessDomain, f.EntryNodeID, f.Status, f.UpdatedBy).Scan(
		&out.ID, &out.ProjectID, &out.Code, &out.Name, &out.Description, &out.BusinessDomain, &out.EntryNodeID, &out.Status, &out.VersionNo, &out.CreatedBy, &out.UpdatedBy, &out.CreatedAt, &out.UpdatedAt,
	)
	return out, err
}

func (r *PanelRepository) CreateNode(ctx context.Context, n domain.Node) (domain.Node, error) {
	q := `
	INSERT INTO nodes (flow_id, node_key, name, node_type, service_name, title, description, owner_team, source_ref, pos_x, pos_y, metadata)
	VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
	RETURNING id, flow_id, node_key, name, node_type, service_name, title, description, owner_team, source_ref, pos_x, pos_y, metadata, created_at, updated_at`
	var out domain.Node
	err := r.db.QueryRow(ctx, q, n.FlowID, n.NodeKey, n.Name, n.NodeType, n.ServiceName, n.Title, n.Description, n.OwnerTeam, n.SourceRef, n.PosX, n.PosY, n.Metadata).Scan(
		&out.ID, &out.FlowID, &out.NodeKey, &out.Name, &out.NodeType, &out.ServiceName, &out.Title, &out.Description, &out.OwnerTeam, &out.SourceRef, &out.PosX, &out.PosY, &out.Metadata, &out.CreatedAt, &out.UpdatedAt,
	)
	return out, err
}

func (r *PanelRepository) UpdateNode(ctx context.Context, n domain.Node) (domain.Node, error) {
	q := `
	UPDATE nodes
	SET name = COALESCE(NULLIF($2, ''), name),
	    node_type = COALESCE(NULLIF($3, ''), node_type),
	    service_name = COALESCE($4, service_name),
	    title = COALESCE($5, title),
	    description = COALESCE($6, description),
	    owner_team = COALESCE($7, owner_team),
	    source_ref = COALESCE($8, source_ref),
	    pos_x = COALESCE($9, pos_x),
	    pos_y = COALESCE($10, pos_y),
	    metadata = COALESCE($11, metadata),
	    updated_at = now()
	WHERE id = $1
	RETURNING id, flow_id, node_key, name, node_type, service_name, title, description, owner_team, source_ref, pos_x, pos_y, metadata, created_at, updated_at`
	var out domain.Node
	err := r.db.QueryRow(ctx, q, n.ID, n.Name, n.NodeType, nullable(n.ServiceName), nullable(n.Title), nullable(n.Description), nullable(n.OwnerTeam), nullable(n.SourceRef), nullFloat(n.PosX), nullFloat(n.PosY), nullable(n.Metadata)).Scan(
		&out.ID, &out.FlowID, &out.NodeKey, &out.Name, &out.NodeType, &out.ServiceName, &out.Title, &out.Description, &out.OwnerTeam, &out.SourceRef, &out.PosX, &out.PosY, &out.Metadata, &out.CreatedAt, &out.UpdatedAt,
	)
	return out, err
}

func (r *PanelRepository) DeleteNode(ctx context.Context, nodeID string) error {
	_, err := r.db.Exec(ctx, `DELETE FROM nodes WHERE id = $1`, nodeID)
	return err
}

func (r *PanelRepository) CreateEdge(ctx context.Context, e domain.Edge) (domain.Edge, error) {
	q := `
	INSERT INTO edges (flow_id, from_node_id, to_node_id, edge_type, name, protocol, method, endpoint, topic_name, conditions, description, metadata)
	VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
	RETURNING id, flow_id, from_node_id, to_node_id, edge_type, name, protocol, method, endpoint, topic_name, conditions, description, metadata, created_at, updated_at`
	var out domain.Edge
	err := r.db.QueryRow(ctx, q, e.FlowID, e.FromNodeID, e.ToNodeID, e.EdgeType, e.Name, e.Protocol, e.Method, e.Endpoint, e.TopicName, e.Conditions, e.Description, e.Metadata).Scan(
		&out.ID, &out.FlowID, &out.FromNodeID, &out.ToNodeID, &out.EdgeType, &out.Name, &out.Protocol, &out.Method, &out.Endpoint, &out.TopicName, &out.Conditions, &out.Description, &out.Metadata, &out.CreatedAt, &out.UpdatedAt,
	)
	return out, err
}

func (r *PanelRepository) UpdateEdge(ctx context.Context, e domain.Edge) (domain.Edge, error) {
	q := `
	UPDATE edges
	SET edge_type = COALESCE(NULLIF($2, ''), edge_type),
	    name = COALESCE($3, name),
	    protocol = COALESCE($4, protocol),
	    method = COALESCE($5, method),
	    endpoint = COALESCE($6, endpoint),
	    topic_name = COALESCE($7, topic_name),
	    conditions = COALESCE($8, conditions),
	    description = COALESCE($9, description),
	    metadata = COALESCE($10, metadata),
	    updated_at = now()
	WHERE id = $1
	RETURNING id, flow_id, from_node_id, to_node_id, edge_type, name, protocol, method, endpoint, topic_name, conditions, description, metadata, created_at, updated_at`
	var out domain.Edge
	err := r.db.QueryRow(ctx, q, e.ID, e.EdgeType, nullable(e.Name), nullable(e.Protocol), nullable(e.Method), nullable(e.Endpoint), nullable(e.TopicName), nullable(e.Conditions), nullable(e.Description), nullable(e.Metadata)).Scan(
		&out.ID, &out.FlowID, &out.FromNodeID, &out.ToNodeID, &out.EdgeType, &out.Name, &out.Protocol, &out.Method, &out.Endpoint, &out.TopicName, &out.Conditions, &out.Description, &out.Metadata, &out.CreatedAt, &out.UpdatedAt,
	)
	return out, err
}

func (r *PanelRepository) DeleteEdge(ctx context.Context, edgeID string) error {
	_, err := r.db.Exec(ctx, `DELETE FROM edges WHERE id = $1`, edgeID)
	return err
}

func (r *PanelRepository) CreateNodeField(ctx context.Context, f domain.NodeField) (domain.NodeField, error) {
	q := `
	INSERT INTO node_fields (node_id, field_path, field_name, direction, source_type, data_type, is_required, description, example_value, metadata)
	VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
	RETURNING id, node_id, field_path, field_name, direction, source_type, data_type, is_required, description, example_value, metadata, created_at, updated_at`
	var out domain.NodeField
	err := r.db.QueryRow(ctx, q, f.NodeID, f.FieldPath, f.FieldName, f.Direction, f.SourceType, f.DataType, f.IsRequired, f.Description, f.ExampleValue, f.Metadata).Scan(
		&out.ID, &out.NodeID, &out.FieldPath, &out.FieldName, &out.Direction, &out.SourceType, &out.DataType, &out.IsRequired, &out.Description, &out.ExampleValue, &out.Metadata, &out.CreatedAt, &out.UpdatedAt,
	)
	return out, err
}

func (r *PanelRepository) UpdateNodeField(ctx context.Context, f domain.NodeField) (domain.NodeField, error) {
	q := `
	UPDATE node_fields
	SET field_path = COALESCE(NULLIF($2, ''), field_path),
	    field_name = COALESCE(NULLIF($3, ''), field_name),
	    direction = COALESCE(NULLIF($4, ''), direction),
	    source_type = COALESCE($5, source_type),
	    data_type = COALESCE($6, data_type),
	    is_required = COALESCE($7, is_required),
	    description = COALESCE($8, description),
	    example_value = COALESCE($9, example_value),
	    metadata = COALESCE($10, metadata),
	    updated_at = now()
	WHERE id = $1
	RETURNING id, node_id, field_path, field_name, direction, source_type, data_type, is_required, description, example_value, metadata, created_at, updated_at`
	var out domain.NodeField
	err := r.db.QueryRow(ctx, q, f.ID, f.FieldPath, f.FieldName, f.Direction, nullable(f.SourceType), nullable(f.DataType), f.IsRequired, nullable(f.Description), nullable(f.ExampleValue), nullable(f.Metadata)).Scan(
		&out.ID, &out.NodeID, &out.FieldPath, &out.FieldName, &out.Direction, &out.SourceType, &out.DataType, &out.IsRequired, &out.Description, &out.ExampleValue, &out.Metadata, &out.CreatedAt, &out.UpdatedAt,
	)
	return out, err
}

func (r *PanelRepository) DeleteNodeField(ctx context.Context, fieldID string) error {
	_, err := r.db.Exec(ctx, `DELETE FROM node_fields WHERE id = $1`, fieldID)
	return err
}

func (r *PanelRepository) CreateMapping(ctx context.Context, m domain.EdgeFieldMapping) (domain.EdgeFieldMapping, error) {
	q := `
	INSERT INTO edge_field_mappings (edge_id, from_field_id, to_field_id, map_type, transform_rule, condition_rule, notes, sort_order)
	VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
	RETURNING id, edge_id, from_field_id, to_field_id, map_type, transform_rule, condition_rule, notes, sort_order, created_at, updated_at`
	var out domain.EdgeFieldMapping
	err := r.db.QueryRow(ctx, q, m.EdgeID, m.FromFieldID, m.ToFieldID, m.MapType, m.TransformRule, m.ConditionRule, m.Notes, m.SortOrder).Scan(
		&out.ID, &out.EdgeID, &out.FromFieldID, &out.ToFieldID, &out.MapType, &out.TransformRule, &out.ConditionRule, &out.Notes, &out.SortOrder, &out.CreatedAt, &out.UpdatedAt,
	)
	return out, err
}

func (r *PanelRepository) UpdateMapping(ctx context.Context, m domain.EdgeFieldMapping) (domain.EdgeFieldMapping, error) {
	q := `
	UPDATE edge_field_mappings
	SET from_field_id = COALESCE($2, from_field_id),
	    to_field_id = COALESCE($3, to_field_id),
	    map_type = COALESCE(NULLIF($4, ''), map_type),
	    transform_rule = COALESCE($5, transform_rule),
	    condition_rule = COALESCE($6, condition_rule),
	    notes = COALESCE($7, notes),
	    sort_order = COALESCE($8, sort_order),
	    updated_at = now()
	WHERE id = $1
	RETURNING id, edge_id, from_field_id, to_field_id, map_type, transform_rule, condition_rule, notes, sort_order, created_at, updated_at`
	var out domain.EdgeFieldMapping
	err := r.db.QueryRow(ctx, q, m.ID, m.FromFieldID, m.ToFieldID, m.MapType, nullable(m.TransformRule), nullable(m.ConditionRule), nullable(m.Notes), m.SortOrder).Scan(
		&out.ID, &out.EdgeID, &out.FromFieldID, &out.ToFieldID, &out.MapType, &out.TransformRule, &out.ConditionRule, &out.Notes, &out.SortOrder, &out.CreatedAt, &out.UpdatedAt,
	)
	return out, err
}

func (r *PanelRepository) DeleteMapping(ctx context.Context, mappingID string) error {
	_, err := r.db.Exec(ctx, `DELETE FROM edge_field_mappings WHERE id = $1`, mappingID)
	return err
}

func (r *PanelRepository) GetGraphSnapshot(ctx context.Context, flowID string) (domain.GraphSnapshot, error) {
	flow, err := r.GetFlowByID(ctx, flowID)
	if err != nil {
		return domain.GraphSnapshot{}, err
	}
	nodes, err := r.listNodesByFlow(ctx, flowID)
	if err != nil {
		return domain.GraphSnapshot{}, err
	}
	edges, err := r.listEdgesByFlow(ctx, flowID)
	if err != nil {
		return domain.GraphSnapshot{}, err
	}
	fields, err := r.listNodeFieldsByFlow(ctx, flowID)
	if err != nil {
		return domain.GraphSnapshot{}, err
	}
	mappings, err := r.listMappingsByFlow(ctx, flowID)
	if err != nil {
		return domain.GraphSnapshot{}, err
	}
	return domain.GraphSnapshot{Flow: flow, Nodes: nodes, Edges: edges, Fields: fields, Mappings: mappings}, nil
}

func (r *PanelRepository) listNodesByFlow(ctx context.Context, flowID string) ([]domain.Node, error) {
	rows, err := r.db.Query(ctx, `SELECT id, flow_id, node_key, name, node_type, service_name, title, description, owner_team, source_ref, pos_x, pos_y, metadata, created_at, updated_at FROM nodes WHERE flow_id = $1 ORDER BY created_at`, flowID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := make([]domain.Node, 0)
	for rows.Next() {
		var n domain.Node
		if err := rows.Scan(&n.ID, &n.FlowID, &n.NodeKey, &n.Name, &n.NodeType, &n.ServiceName, &n.Title, &n.Description, &n.OwnerTeam, &n.SourceRef, &n.PosX, &n.PosY, &n.Metadata, &n.CreatedAt, &n.UpdatedAt); err != nil {
			return nil, err
		}
		out = append(out, n)
	}
	return out, rows.Err()
}

func (r *PanelRepository) listEdgesByFlow(ctx context.Context, flowID string) ([]domain.Edge, error) {
	rows, err := r.db.Query(ctx, `SELECT id, flow_id, from_node_id, to_node_id, edge_type, name, protocol, method, endpoint, topic_name, conditions, description, metadata, created_at, updated_at FROM edges WHERE flow_id = $1 ORDER BY created_at`, flowID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := make([]domain.Edge, 0)
	for rows.Next() {
		var e domain.Edge
		if err := rows.Scan(&e.ID, &e.FlowID, &e.FromNodeID, &e.ToNodeID, &e.EdgeType, &e.Name, &e.Protocol, &e.Method, &e.Endpoint, &e.TopicName, &e.Conditions, &e.Description, &e.Metadata, &e.CreatedAt, &e.UpdatedAt); err != nil {
			return nil, err
		}
		out = append(out, e)
	}
	return out, rows.Err()
}

func (r *PanelRepository) listNodeFieldsByFlow(ctx context.Context, flowID string) ([]domain.NodeField, error) {
	rows, err := r.db.Query(ctx, `
	SELECT nf.id, nf.node_id, nf.field_path, nf.field_name, nf.direction, nf.source_type, nf.data_type, nf.is_required, nf.description, nf.example_value, nf.metadata, nf.created_at, nf.updated_at
	FROM node_fields nf
	JOIN nodes n ON n.id = nf.node_id
	WHERE n.flow_id = $1
	ORDER BY nf.created_at`, flowID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := make([]domain.NodeField, 0)
	for rows.Next() {
		var f domain.NodeField
		if err := rows.Scan(&f.ID, &f.NodeID, &f.FieldPath, &f.FieldName, &f.Direction, &f.SourceType, &f.DataType, &f.IsRequired, &f.Description, &f.ExampleValue, &f.Metadata, &f.CreatedAt, &f.UpdatedAt); err != nil {
			return nil, err
		}
		out = append(out, f)
	}
	return out, rows.Err()
}

func (r *PanelRepository) listMappingsByFlow(ctx context.Context, flowID string) ([]domain.EdgeFieldMapping, error) {
	rows, err := r.db.Query(ctx, `
	SELECT m.id, m.edge_id, m.from_field_id, m.to_field_id, m.map_type, m.transform_rule, m.condition_rule, m.notes, m.sort_order, m.created_at, m.updated_at
	FROM edge_field_mappings m
	JOIN edges e ON e.id = m.edge_id
	WHERE e.flow_id = $1
	ORDER BY m.sort_order, m.created_at`, flowID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := make([]domain.EdgeFieldMapping, 0)
	for rows.Next() {
		var m domain.EdgeFieldMapping
		if err := rows.Scan(&m.ID, &m.EdgeID, &m.FromFieldID, &m.ToFieldID, &m.MapType, &m.TransformRule, &m.ConditionRule, &m.Notes, &m.SortOrder, &m.CreatedAt, &m.UpdatedAt); err != nil {
			return nil, err
		}
		out = append(out, m)
	}
	return out, rows.Err()
}

func (r *PanelRepository) ReplaceFlowGraph(ctx context.Context, flowID string, nodes []domain.Node, edges []domain.Edge) error {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	if _, err := tx.Exec(ctx, `DELETE FROM edge_field_mappings WHERE edge_id IN (SELECT id FROM edges WHERE flow_id = $1)`, flowID); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, `DELETE FROM node_fields WHERE node_id IN (SELECT id FROM nodes WHERE flow_id = $1)`, flowID); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, `DELETE FROM edges WHERE flow_id = $1`, flowID); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, `DELETE FROM nodes WHERE flow_id = $1`, flowID); err != nil {
		return err
	}

	nodeIDByKey := map[string]string{}
	for _, n := range nodes {
		var newID string
		err := tx.QueryRow(ctx, `
		INSERT INTO nodes (flow_id, node_key, name, node_type, service_name, title, description, owner_team, source_ref, pos_x, pos_y, metadata)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
		RETURNING id`, flowID, n.NodeKey, n.Name, n.NodeType, n.ServiceName, n.Title, n.Description, n.OwnerTeam, n.SourceRef, n.PosX, n.PosY, n.Metadata).Scan(&newID)
		if err != nil {
			return err
		}
		nodeIDByKey[n.NodeKey] = newID
	}

	for _, e := range edges {
		fromID, ok := nodeIDByKey[e.FromNodeID]
		if !ok {
			return fmt.Errorf("from node key not found: %s", e.FromNodeID)
		}
		toID, ok := nodeIDByKey[e.ToNodeID]
		if !ok {
			return fmt.Errorf("to node key not found: %s", e.ToNodeID)
		}
		if _, err := tx.Exec(ctx, `
		INSERT INTO edges (flow_id, from_node_id, to_node_id, edge_type, name, protocol, method, endpoint, topic_name, conditions, description, metadata)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`, flowID, fromID, toID, e.EdgeType, e.Name, e.Protocol, e.Method, e.Endpoint, e.TopicName, e.Conditions, e.Description, e.Metadata); err != nil {
			return err
		}
	}

	return tx.Commit(ctx)
}

func (r *PanelRepository) Search(ctx context.Context, q string) (map[string]interface{}, error) {
	result := map[string]interface{}{}

	projectsRows, err := r.db.Query(ctx, `SELECT id, key, name FROM projects WHERE name ILIKE '%' || $1 || '%' OR key ILIKE '%' || $1 || '%' LIMIT 20`, q)
	if err != nil {
		return nil, err
	}
	defer projectsRows.Close()
	projects := make([]map[string]string, 0)
	for projectsRows.Next() {
		var id, key, name string
		if err := projectsRows.Scan(&id, &key, &name); err != nil {
			return nil, err
		}
		projects = append(projects, map[string]string{"id": id, "key": key, "name": name})
	}
	result["projects"] = projects

	fieldRows, err := r.db.Query(ctx, `SELECT id, field_path, direction FROM node_fields WHERE field_path ILIKE '%' || $1 || '%' LIMIT 50`, q)
	if err != nil {
		return nil, err
	}
	defer fieldRows.Close()
	fields := make([]map[string]string, 0)
	for fieldRows.Next() {
		var id, path, direction string
		if err := fieldRows.Scan(&id, &path, &direction); err != nil {
			return nil, err
		}
		fields = append(fields, map[string]string{"id": id, "fieldPath": path, "direction": direction})
	}
	result["fields"] = fields

	return result, nil
}

func (r *PanelRepository) FieldLineage(ctx context.Context, field string) ([]map[string]interface{}, error) {
	rows, err := r.db.Query(ctx, `
	SELECT
	  e.id,
	  e.name,
	  src.field_path as from_path,
	  dst.field_path as to_path,
	  m.map_type,
	  m.transform_rule,
	  m.condition_rule
	FROM edge_field_mappings m
	JOIN edges e ON e.id = m.edge_id
	LEFT JOIN node_fields src ON src.id = m.from_field_id
	LEFT JOIN node_fields dst ON dst.id = m.to_field_id
	WHERE COALESCE(src.field_path,'') ILIKE '%' || $1 || '%' OR COALESCE(dst.field_path,'') ILIKE '%' || $1 || '%'
	ORDER BY e.created_at DESC
	LIMIT 100`, field)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := make([]map[string]interface{}, 0)
	for rows.Next() {
		var edgeID, edgeName, fromPath, toPath, mapType, transformRule, conditionRule *string
		if err := rows.Scan(&edgeID, &edgeName, &fromPath, &toPath, &mapType, &transformRule, &conditionRule); err != nil {
			return nil, err
		}
		out = append(out, map[string]interface{}{
			"edgeId":        ptrString(edgeID),
			"edgeName":      ptrString(edgeName),
			"fromFieldPath": ptrString(fromPath),
			"toFieldPath":   ptrString(toPath),
			"mapType":       ptrString(mapType),
			"transformRule": ptrString(transformRule),
			"conditionRule": ptrString(conditionRule),
		})
	}
	return out, rows.Err()
}

func (r *PanelRepository) CreateRevision(ctx context.Context, flowID, createdBy, changeSummary string) (domain.FlowRevision, error) {
	snapshot, err := r.GetGraphSnapshot(ctx, flowID)
	if err != nil {
		return domain.FlowRevision{}, err
	}
	snapshotJSON, err := json.Marshal(snapshot)
	if err != nil {
		return domain.FlowRevision{}, err
	}

	q := `
	INSERT INTO flow_revisions (flow_id, revision_no, snapshot_json, change_summary, created_by)
	VALUES (
		$1,
		COALESCE((SELECT MAX(revision_no) + 1 FROM flow_revisions WHERE flow_id = $1), 1),
		$2,
		$3,
		$4
	)
	RETURNING id, flow_id, revision_no, snapshot_json, change_summary, created_by, created_at`
	var out domain.FlowRevision
	err = r.db.QueryRow(ctx, q, flowID, string(snapshotJSON), changeSummary, createdBy).Scan(
		&out.ID, &out.FlowID, &out.RevisionNo, &out.SnapshotJSON, &out.ChangeSummary, &out.CreatedBy, &out.CreatedAt,
	)
	return out, err
}

func (r *PanelRepository) ListRevisions(ctx context.Context, flowID string) ([]domain.FlowRevision, error) {
	rows, err := r.db.Query(ctx, `SELECT id, flow_id, revision_no, snapshot_json, change_summary, created_by, created_at FROM flow_revisions WHERE flow_id = $1 ORDER BY revision_no DESC`, flowID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := make([]domain.FlowRevision, 0)
	for rows.Next() {
		var rev domain.FlowRevision
		if err := rows.Scan(&rev.ID, &rev.FlowID, &rev.RevisionNo, &rev.SnapshotJSON, &rev.ChangeSummary, &rev.CreatedBy, &rev.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, rev)
	}
	return out, rows.Err()
}

func (r *PanelRepository) RestoreRevision(ctx context.Context, flowID, revisionID string) error {
	var snapshotJSON string
	err := r.db.QueryRow(ctx, `SELECT snapshot_json FROM flow_revisions WHERE id = $1 AND flow_id = $2`, revisionID, flowID).Scan(&snapshotJSON)
	if err != nil {
		return err
	}

	var snapshot domain.GraphSnapshot
	if err := json.Unmarshal([]byte(snapshotJSON), &snapshot); err != nil {
		return err
	}

	nodes := make([]domain.Node, 0, len(snapshot.Nodes))
	for _, n := range snapshot.Nodes {
		nodes = append(nodes, domain.Node{
			NodeKey: n.NodeKey, Name: n.Name, NodeType: n.NodeType, ServiceName: n.ServiceName, Title: n.Title,
			Description: n.Description, OwnerTeam: n.OwnerTeam, SourceRef: n.SourceRef, PosX: n.PosX, PosY: n.PosY, Metadata: n.Metadata,
		})
	}
	return r.restoreWithNodesAndEdges(ctx, flowID, snapshot, nodes)
}

func (r *PanelRepository) restoreWithNodesAndEdges(ctx context.Context, flowID string, snapshot domain.GraphSnapshot, nodes []domain.Node) error {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	if _, err := tx.Exec(ctx, `DELETE FROM edge_field_mappings WHERE edge_id IN (SELECT id FROM edges WHERE flow_id = $1)`, flowID); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, `DELETE FROM node_fields WHERE node_id IN (SELECT id FROM nodes WHERE flow_id = $1)`, flowID); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, `DELETE FROM edges WHERE flow_id = $1`, flowID); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, `DELETE FROM nodes WHERE flow_id = $1`, flowID); err != nil {
		return err
	}

	newNodeID := map[string]string{}
	for _, n := range nodes {
		var id string
		if err := tx.QueryRow(ctx, `
		INSERT INTO nodes (flow_id, node_key, name, node_type, service_name, title, description, owner_team, source_ref, pos_x, pos_y, metadata)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
		RETURNING id`, flowID, n.NodeKey, n.Name, n.NodeType, n.ServiceName, n.Title, n.Description, n.OwnerTeam, n.SourceRef, n.PosX, n.PosY, n.Metadata).Scan(&id); err != nil {
			return err
		}
		newNodeID[n.NodeKey] = id
	}

	for _, e := range snapshot.Edges {
		fromNodeKey := ""
		toNodeKey := ""
		for _, n := range snapshot.Nodes {
			if n.ID == e.FromNodeID {
				fromNodeKey = n.NodeKey
			}
			if n.ID == e.ToNodeID {
				toNodeKey = n.NodeKey
			}
		}
		fromID := newNodeID[fromNodeKey]
		toID := newNodeID[toNodeKey]
		if _, err := tx.Exec(ctx, `
		INSERT INTO edges (flow_id, from_node_id, to_node_id, edge_type, name, protocol, method, endpoint, topic_name, conditions, description, metadata)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
			flowID, fromID, toID, e.EdgeType, e.Name, e.Protocol, e.Method, e.Endpoint, e.TopicName, e.Conditions, e.Description, e.Metadata); err != nil {
			return err
		}
	}

	if _, err := tx.Exec(ctx, `UPDATE flows SET entry_node_id = NULL WHERE id = $1`, flowID); err != nil {
		return err
	}
	if snapshot.Flow.EntryNodeID != nil {
		entryKey := ""
		for _, n := range snapshot.Nodes {
			if n.ID == *snapshot.Flow.EntryNodeID {
				entryKey = n.NodeKey
				break
			}
		}
		if entryKey != "" {
			if _, err := tx.Exec(ctx, `UPDATE flows SET entry_node_id = $2 WHERE id = $1`, flowID, newNodeID[entryKey]); err != nil {
				return err
			}
		}
	}

	return tx.Commit(ctx)
}

func (r *PanelRepository) GetNodeByID(ctx context.Context, nodeID string) (domain.Node, error) {
	q := `SELECT id, flow_id, node_key, name, node_type, service_name, title, description, owner_team, source_ref, pos_x, pos_y, metadata, created_at, updated_at FROM nodes WHERE id = $1`
	var n domain.Node
	err := r.db.QueryRow(ctx, q, nodeID).Scan(&n.ID, &n.FlowID, &n.NodeKey, &n.Name, &n.NodeType, &n.ServiceName, &n.Title, &n.Description, &n.OwnerTeam, &n.SourceRef, &n.PosX, &n.PosY, &n.Metadata, &n.CreatedAt, &n.UpdatedAt)
	return n, err
}

func (r *PanelRepository) SaveDetectedFields(ctx context.Context, nodeID string, fields []domain.NodeField) ([]domain.NodeField, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	created := make([]domain.NodeField, 0, len(fields))
	for _, f := range fields {
		q := `
		INSERT INTO node_fields (node_id, field_path, field_name, direction, source_type, data_type, is_required, description, example_value, metadata)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
		ON CONFLICT (node_id, field_path, direction) DO UPDATE
		SET field_name = EXCLUDED.field_name,
		    source_type = EXCLUDED.source_type,
		    data_type = EXCLUDED.data_type,
		    updated_at = now()
		RETURNING id, node_id, field_path, field_name, direction, source_type, data_type, is_required, description, example_value, metadata, created_at, updated_at`
		var out domain.NodeField
		if err := tx.QueryRow(ctx, q, nodeID, f.FieldPath, f.FieldName, f.Direction, f.SourceType, f.DataType, f.IsRequired, f.Description, f.ExampleValue, f.Metadata).Scan(
			&out.ID, &out.NodeID, &out.FieldPath, &out.FieldName, &out.Direction, &out.SourceType, &out.DataType, &out.IsRequired, &out.Description, &out.ExampleValue, &out.Metadata, &out.CreatedAt, &out.UpdatedAt,
		); err != nil {
			return nil, err
		}
		created = append(created, out)
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return created, nil
}

func nullable(v string) interface{} {
	if v == "" {
		return nil
	}
	return v
}

func nullFloat(v float64) interface{} {
	if v == 0 {
		return nil
	}
	return v
}

func ptrString(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}

func IsNotFound(err error) bool {
	return err == pgx.ErrNoRows
}
