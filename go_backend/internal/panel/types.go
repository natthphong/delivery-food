package panel

import "time"

type NodeType string

const (
	NodeTypeAPI         NodeType = "API"
	NodeTypeService     NodeType = "Microservice"
	NodeTypeDatabase    NodeType = "Database"
	NodeTypeCache       NodeType = "Cache"
	NodeTypeQueue       NodeType = "Queue"
	NodeTypeTransform   NodeType = "Transform"
	NodeTypeExternalAPI NodeType = "External API"
	NodeTypeNote        NodeType = "Note"
)

type MappingType string

const (
	MappingTypeDirect    MappingType = "DIRECT"
	MappingTypeTransform MappingType = "TRANSFORM"
	MappingTypeConstant  MappingType = "CONSTANT"
	MappingTypeDerived   MappingType = "DERIVED"
	MappingTypeRename    MappingType = "RENAME"
	MappingTypeCopy      MappingType = "COPY"
	MappingTypeMerge     MappingType = "MERGE"
	MappingTypeSplit     MappingType = "SPLIT"
)

type Project struct {
	ID          string    `json:"id"`
	Name        string    `json:"name"`
	Description string    `json:"description"`
	CreatedAt   time.Time `json:"createdAt"`
	UpdatedAt   time.Time `json:"updatedAt"`
}

type Flow struct {
	ID          string    `json:"id"`
	ProjectID   string    `json:"projectId"`
	Code        string    `json:"code"`
	Name        string    `json:"name"`
	Description string    `json:"description"`
	CreatedAt   time.Time `json:"createdAt"`
	UpdatedAt   time.Time `json:"updatedAt"`
}

type Node struct {
	ID          string    `json:"id"`
	FlowID      string    `json:"flowId"`
	Type        string    `json:"type"`
	Title       string    `json:"title"`
	Description string    `json:"description"`
	PositionX   float64   `json:"position_x"`
	PositionY   float64   `json:"position_y"`
	TeamOwner   string    `json:"team_owner"`
	Tags        []string  `json:"tags"`
	Notes       string    `json:"notes"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type Edge struct {
	ID           string    `json:"id"`
	FlowID       string    `json:"flow_id"`
	SourceNodeID string    `json:"source_node_id"`
	TargetNodeID string    `json:"target_node_id"`
	Protocol     string    `json:"protocol"`
	Endpoint     string    `json:"endpoint"`
	Description  string    `json:"description"`
	CreatedAt    time.Time `json:"created_at"`
}

type Field struct {
	ID           string    `json:"id"`
	NodeID       string    `json:"node_id"`
	Path         string    `json:"path"`
	FieldName    string    `json:"field_name"`
	DisplayName  string    `json:"display_name"`
	Normalized   string    `json:"normalized_name"`
	Canonical    string    `json:"canonical_name"`
	FieldRole    string    `json:"field_role"`
	ParentField  *string   `json:"parent_field_id"`
	SortOrder    int       `json:"sort_order"`
	Type         string    `json:"type"`
	Description  string    `json:"description"`
	SourceType   string    `json:"source_type"`
	ExampleValue string    `json:"example_value"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}

type Mapping struct {
	ID          string    `json:"id"`
	EdgeID      string    `json:"edge_id"`
	FlowID      *string   `json:"flow_id,omitempty"`
	SourceNode  *string   `json:"source_node_id,omitempty"`
	TargetNode  *string   `json:"target_node_id,omitempty"`
	SourceField *string   `json:"source_field_id"`
	TargetField *string   `json:"target_field_id"`
	MappingType string    `json:"mapping_type"`
	Transform   string    `json:"transform_rule"`
	Condition   string    `json:"condition"`
	Notes       string    `json:"notes"`
	Confidence  *float64  `json:"confidence,omitempty"`
	LinkType    string    `json:"link_type,omitempty"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type FieldConcept struct {
	ID          string    `json:"id"`
	FlowID      string    `json:"flow_id"`
	ConceptKey  string    `json:"concept_key"`
	DisplayName string    `json:"display_name"`
	Description string    `json:"description"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type Note struct {
	ID        string    `json:"id"`
	FlowID    string    `json:"flow_id"`
	NodeID    *string   `json:"node_id"`
	Content   string    `json:"content"`
	Width     float64   `json:"width"`
	Height    float64   `json:"height"`
	PositionX float64   `json:"position_x"`
	PositionY float64   `json:"position_y"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type NotePatch struct {
	Content   *string  `json:"content,omitempty"`
	Width     *float64 `json:"width,omitempty"`
	Height    *float64 `json:"height,omitempty"`
	PositionX *float64 `json:"position_x,omitempty"`
	PositionY *float64 `json:"position_y,omitempty"`
}

type Workspace struct {
	Flow     Flow      `json:"flow"`
	Nodes    []Node    `json:"nodes"`
	Edges    []Edge    `json:"edges"`
	Fields   []Field   `json:"fields"`
	Mappings []Mapping `json:"mappings"`
	Notes    []Note    `json:"notes"`
}

type LineageResult struct {
	Field          string         `json:"field"`
	MatchedFields  []Field        `json:"matched_fields,omitempty"`
	RelatedAliases []string       `json:"related_aliases,omitempty"`
	Concepts       []FieldConcept `json:"concepts,omitempty"`
	NodeIDs        []string       `json:"node_ids"`
	EdgeIDs        []string       `json:"edge_ids"`
	MappingChain   []LineageStep  `json:"mapping_chain"`
}

type LineageStep struct {
	MappingID    string `json:"mapping_id"`
	EdgeID       string `json:"edge_id"`
	SourcePath   string `json:"source_path"`
	TargetPath   string `json:"target_path"`
	SourceNodeID string `json:"source_node_id"`
	TargetNodeID string `json:"target_node_id"`
}
