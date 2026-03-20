package panel

import "testing"

func TestSchemaDetectionFlatten(t *testing.T) {
	in := map[string]any{
		"customerId": "123",
		"profile": map[string]any{
			"email": "a@b.com",
		},
	}
	out := map[string]string{}
	flattenFields(in, "", out)
	if out["customerId"] != "string" {
		t.Fatalf("expected customerId string, got %q", out["customerId"])
	}
	if out["profile.email"] != "string" {
		t.Fatalf("expected profile.email string, got %q", out["profile.email"])
	}
}

func TestSchemaDetectionFlattenArrays(t *testing.T) {
	in := map[string]any{
		"items": []any{
			map[string]any{
				"id":   "1",
				"name": "primary",
			},
		},
	}
	out := map[string]string{}
	flattenFields(in, "", out)
	if out["items[].id"] != "string" {
		t.Fatalf("expected items[].id string, got %q", out["items[].id"])
	}
	if out["items[].name"] != "string" {
		t.Fatalf("expected items[].name string, got %q", out["items[].name"])
	}
}

func TestLineageSearchBuild(t *testing.T) {
	result := BuildLineageResult("accountId", []LineageStep{
		{MappingID: "m1", EdgeID: "e1", SourceNodeID: "n1", TargetNodeID: "n2"},
		{MappingID: "m2", EdgeID: "e2", SourceNodeID: "n2", TargetNodeID: "n3"},
	})
	if len(result.NodeIDs) != 3 {
		t.Fatalf("expected 3 nodes, got %d", len(result.NodeIDs))
	}
	if len(result.EdgeIDs) != 2 {
		t.Fatalf("expected 2 edges, got %d", len(result.EdgeIDs))
	}
}

func TestMappingCreationValidation(t *testing.T) {
	err := ValidateMappingInput(Mapping{EdgeID: "e1", MappingType: "DIRECT"})
	if err != nil {
		t.Fatalf("expected valid mapping, got %v", err)
	}
	if err := ValidateMappingInput(Mapping{EdgeID: "e1", MappingType: "INVALID"}); err == nil {
		t.Fatalf("expected invalid mapping type error")
	}
}

func TestNodeCreationValidation(t *testing.T) {
	err := ValidateNodeInput(Node{FlowID: "f1", Type: "API", Title: "API Gateway"})
	if err != nil {
		t.Fatalf("expected valid node, got %v", err)
	}
	if err := ValidateNodeInput(Node{FlowID: "", Type: "API", Title: "API Gateway"}); err == nil {
		t.Fatalf("expected flow_id validation error")
	}
}

func TestBuildAutoLayout(t *testing.T) {
	nodes := []Node{
		{ID: "n1", Type: string(NodeTypeAPI), Title: "API Gateway", PositionY: 20},
		{ID: "n2", Type: string(NodeTypeService), Title: "Orchestrator", PositionY: 30},
		{ID: "n3", Type: string(NodeTypeDatabase), Title: "Vault", PositionY: 40},
		{ID: "note1", Type: string(NodeTypeNote), Title: "Sticky", PositionY: 50},
	}
	edges := []Edge{
		{SourceNodeID: "n1", TargetNodeID: "n2"},
		{SourceNodeID: "n2", TargetNodeID: "n3"},
	}

	positions := BuildAutoLayout(nodes, edges)
	if len(positions) != 3 {
		t.Fatalf("expected only non-note nodes to be laid out, got %d", len(positions))
	}
	if positions["n2"].X <= positions["n1"].X {
		t.Fatalf("expected n2 to be placed after n1")
	}
	if positions["n3"].X <= positions["n2"].X {
		t.Fatalf("expected n3 to be placed after n2")
	}
	if _, ok := positions["note1"]; ok {
		t.Fatalf("expected sticky notes to be ignored by auto layout")
	}
}
