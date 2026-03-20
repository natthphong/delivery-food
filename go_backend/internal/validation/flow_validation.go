package validation

import "gitlab.com/home-server7795544/home-server/iam/iam-backend/internal/domain"

type ValidationIssue struct {
	Level   string `json:"level"`
	Code    string `json:"code"`
	Message string `json:"message"`
	RefType string `json:"refType,omitempty"`
	RefID   string `json:"refId,omitempty"`
}

func ValidateFlowGraph(snapshot domain.GraphSnapshot) []ValidationIssue {
	issues := make([]ValidationIssue, 0)
	if snapshot.Flow.EntryNodeID == nil || *snapshot.Flow.EntryNodeID == "" {
		issues = append(issues, ValidationIssue{Level: "error", Code: "MISSING_ENTRY_NODE", Message: "flow has no entry node"})
	}

	nodeSet := map[string]struct{}{}
	for _, n := range snapshot.Nodes {
		nodeSet[n.ID] = struct{}{}
	}

	incoming := map[string]int{}
	outgoing := map[string]int{}
	for _, e := range snapshot.Edges {
		if _, ok := nodeSet[e.FromNodeID]; !ok {
			issues = append(issues, ValidationIssue{Level: "error", Code: "EDGE_SOURCE_NOT_FOUND", Message: "edge source node not found", RefType: "edge", RefID: e.ID})
		}
		if _, ok := nodeSet[e.ToNodeID]; !ok {
			issues = append(issues, ValidationIssue{Level: "error", Code: "EDGE_TARGET_NOT_FOUND", Message: "edge target node not found", RefType: "edge", RefID: e.ID})
		}
		outgoing[e.FromNodeID]++
		incoming[e.ToNodeID]++
	}

	for _, n := range snapshot.Nodes {
		if incoming[n.ID] == 0 && outgoing[n.ID] == 0 {
			issues = append(issues, ValidationIssue{Level: "warning", Code: "ORPHAN_NODE", Message: "node has no connected edges", RefType: "node", RefID: n.ID})
		}
	}

	seenField := map[string]struct{}{}
	for _, f := range snapshot.Fields {
		key := f.NodeID + "|" + f.Direction + "|" + f.FieldPath
		if _, ok := seenField[key]; ok {
			issues = append(issues, ValidationIssue{Level: "error", Code: "DUPLICATE_FIELD_PATH", Message: "duplicate field path in same node and direction", RefType: "field", RefID: f.ID})
		}
		seenField[key] = struct{}{}
	}

	mapCountByTarget := map[string]int{}
	for _, m := range snapshot.Mappings {
		if m.ToFieldID != nil {
			mapCountByTarget[*m.ToFieldID]++
		}
	}
	for _, f := range snapshot.Fields {
		if f.IsRequired && f.Direction == "request" && mapCountByTarget[f.ID] == 0 {
			issues = append(issues, ValidationIssue{Level: "warning", Code: "REQUIRED_FIELD_UNMAPPED", Message: "required request field has no inbound mapping", RefType: "field", RefID: f.ID})
		}
	}
	return issues
}
