package domain

import "time"

type User struct {
	ID           string    `json:"id"`
	Email        string    `json:"email"`
	FullName     string    `json:"fullName"`
	AuthProvider string    `json:"authProvider"`
	Status       string    `json:"status"`
	CreatedAt    time.Time `json:"createdAt"`
	UpdatedAt    time.Time `json:"updatedAt"`
}

type Project struct {
	ID          string    `json:"id"`
	Key         string    `json:"key"`
	Name        string    `json:"name"`
	Description string    `json:"description"`
	OwnerUserID string    `json:"ownerUserId"`
	Status      string    `json:"status"`
	CreatedAt   time.Time `json:"createdAt"`
	UpdatedAt   time.Time `json:"updatedAt"`
}

type ProjectMember struct {
	ID        string    `json:"id"`
	ProjectID string    `json:"projectId"`
	UserID    string    `json:"userId"`
	Role      string    `json:"role"`
	CreatedAt time.Time `json:"createdAt"`
}

type Flow struct {
	ID             string    `json:"id"`
	ProjectID      string    `json:"projectId"`
	Code           string    `json:"code"`
	Name           string    `json:"name"`
	Description    string    `json:"description"`
	BusinessDomain string    `json:"businessDomain"`
	EntryNodeID    *string   `json:"entryNodeId"`
	Status         string    `json:"status"`
	VersionNo      int       `json:"versionNo"`
	CreatedBy      string    `json:"createdBy"`
	UpdatedBy      string    `json:"updatedBy"`
	CreatedAt      time.Time `json:"createdAt"`
	UpdatedAt      time.Time `json:"updatedAt"`
}

type Node struct {
	ID          string    `json:"id"`
	FlowID      string    `json:"flowId"`
	NodeKey     string    `json:"nodeKey"`
	Name        string    `json:"name"`
	NodeType    string    `json:"nodeType"`
	ServiceName string    `json:"serviceName"`
	Title       string    `json:"title"`
	Description string    `json:"description"`
	OwnerTeam   string    `json:"ownerTeam"`
	SourceRef   string    `json:"sourceRef"`
	PosX        float64   `json:"posX"`
	PosY        float64   `json:"posY"`
	Metadata    string    `json:"metadata"`
	CreatedAt   time.Time `json:"createdAt"`
	UpdatedAt   time.Time `json:"updatedAt"`
}

type Edge struct {
	ID          string    `json:"id"`
	FlowID      string    `json:"flowId"`
	FromNodeID  string    `json:"fromNodeId"`
	ToNodeID    string    `json:"toNodeId"`
	EdgeType    string    `json:"edgeType"`
	Name        string    `json:"name"`
	Protocol    string    `json:"protocol"`
	Method      string    `json:"method"`
	Endpoint    string    `json:"endpoint"`
	TopicName   string    `json:"topicName"`
	Conditions  string    `json:"conditions"`
	Description string    `json:"description"`
	Metadata    string    `json:"metadata"`
	CreatedAt   time.Time `json:"createdAt"`
	UpdatedAt   time.Time `json:"updatedAt"`
}

type NodeField struct {
	ID           string    `json:"id"`
	NodeID       string    `json:"nodeId"`
	FieldPath    string    `json:"fieldPath"`
	FieldName    string    `json:"fieldName"`
	Direction    string    `json:"direction"`
	SourceType   string    `json:"sourceType"`
	DataType     string    `json:"dataType"`
	IsRequired   bool      `json:"isRequired"`
	Description  string    `json:"description"`
	ExampleValue string    `json:"exampleValue"`
	Metadata     string    `json:"metadata"`
	CreatedAt    time.Time `json:"createdAt"`
	UpdatedAt    time.Time `json:"updatedAt"`
}

type EdgeFieldMapping struct {
	ID            string    `json:"id"`
	EdgeID        string    `json:"edgeId"`
	FromFieldID   *string   `json:"fromFieldId"`
	ToFieldID     *string   `json:"toFieldId"`
	MapType       string    `json:"mapType"`
	TransformRule string    `json:"transformRule"`
	ConditionRule string    `json:"conditionRule"`
	Notes         string    `json:"notes"`
	SortOrder     int       `json:"sortOrder"`
	CreatedAt     time.Time `json:"createdAt"`
	UpdatedAt     time.Time `json:"updatedAt"`
}

type FlowRevision struct {
	ID            string    `json:"id"`
	FlowID        string    `json:"flowId"`
	RevisionNo    int       `json:"revisionNo"`
	SnapshotJSON  string    `json:"snapshotJson"`
	ChangeSummary string    `json:"changeSummary"`
	CreatedBy     string    `json:"createdBy"`
	CreatedAt     time.Time `json:"createdAt"`
}

type GraphSnapshot struct {
	Flow     Flow               `json:"flow"`
	Nodes    []Node             `json:"nodes"`
	Edges    []Edge             `json:"edges"`
	Fields   []NodeField        `json:"fields"`
	Mappings []EdgeFieldMapping `json:"mappings"`
}
