package service

import "testing"

func TestConfigInt(t *testing.T) {
	values := map[string]string{
		"MAX_QTY_PER_ITEM": "12",
		"INVALID":          "not-a-number",
	}

	if got := configInt(values, "MAX_QTY_PER_ITEM", 10); got != 12 {
		t.Fatalf("configInt(valid) = %d, want 12", got)
	}
	if got := configInt(values, "INVALID", 10); got != 10 {
		t.Fatalf("configInt(invalid) = %d, want fallback 10", got)
	}
	if got := configInt(values, "MISSING", 25); got != 25 {
		t.Fatalf("configInt(missing) = %d, want fallback 25", got)
	}
}

func TestNormalizeOptionalString(t *testing.T) {
	value := "  BaanFoodie  "
	normalized := normalizeOptionalString(&value)
	if normalized == nil || *normalized != "BaanFoodie" {
		t.Fatalf("normalizeOptionalString(trimmed) = %v, want BaanFoodie", normalized)
	}

	blank := "   "
	normalized = normalizeOptionalString(&blank)
	if normalized == nil || *normalized != "" {
		t.Fatalf("normalizeOptionalString(blank) = %v, want empty string pointer", normalized)
	}

	if got := normalizeOptionalString(nil); got != nil {
		t.Fatalf("normalizeOptionalString(nil) = %v, want nil", got)
	}
}
