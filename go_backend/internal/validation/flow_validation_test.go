package validation

import (
	"testing"

	"gitlab.com/home-server7795544/home-server/iam/iam-backend/internal/domain"
)

func TestValidateFlowGraph_FindsCoreIssues(t *testing.T) {
	nodeA := domain.Node{ID: "n1", NodeKey: "entry"}
	nodeB := domain.Node{ID: "n2", NodeKey: "svc"}
	reqField := domain.NodeField{ID: "f1", NodeID: "n2", FieldPath: "user.id", Direction: "request", IsRequired: true}
	dupField := domain.NodeField{ID: "f2", NodeID: "n2", FieldPath: "user.id", Direction: "request", IsRequired: false}

	snapshot := domain.GraphSnapshot{
		Flow:   domain.Flow{},
		Nodes:  []domain.Node{nodeA, nodeB},
		Edges:  []domain.Edge{{ID: "e1", FromNodeID: "n1", ToNodeID: "missing"}},
		Fields: []domain.NodeField{reqField, dupField},
	}

	issues := ValidateFlowGraph(snapshot)
	if len(issues) == 0 {
		t.Fatal("expected validation issues")
	}

	seen := map[string]bool{}
	for _, issue := range issues {
		seen[issue.Code] = true
	}

	for _, code := range []string{"MISSING_ENTRY_NODE", "EDGE_TARGET_NOT_FOUND", "DUPLICATE_FIELD_PATH", "REQUIRED_FIELD_UNMAPPED"} {
		if !seen[code] {
			t.Fatalf("expected issue code %s", code)
		}
	}
}
