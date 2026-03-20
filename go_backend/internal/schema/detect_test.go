package schema

import "testing"

func TestDetectFieldsFromJSON_NestedAndArray(t *testing.T) {
	payload := `{
	  "reqId": "abc",
	  "user": {"status": "ok", "age": 30},
	  "items": [{"id": 1, "name": "n1"}],
	  "flags": []
	}`
	fields, err := DetectFieldsFromJSON(payload, "request")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	expected := map[string]string{
		"reqId":        "string",
		"user.status":  "string",
		"user.age":     "integer",
		"items[].id":   "integer",
		"items[].name": "string",
		"flags[]":      "array",
	}

	if len(fields) != len(expected) {
		t.Fatalf("expected %d fields, got %d", len(expected), len(fields))
	}

	for _, f := range fields {
		typeExpected, ok := expected[f.FieldPath]
		if !ok {
			t.Fatalf("unexpected field path: %s", f.FieldPath)
		}
		if f.DataType != typeExpected {
			t.Fatalf("field %s expected type %s got %s", f.FieldPath, typeExpected, f.DataType)
		}
		if f.Direction != "request" {
			t.Fatalf("field %s expected request direction", f.FieldPath)
		}
	}
}

func TestDetectFieldsFromJSON_InvalidJSON(t *testing.T) {
	if _, err := DetectFieldsFromJSON("{", "request"); err == nil {
		t.Fatal("expected error for invalid json")
	}
}
