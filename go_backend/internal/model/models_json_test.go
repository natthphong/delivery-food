package model

import (
	"encoding/json"
	"strings"
	"testing"
)

func TestCartMarshalsEmptyAddOnsAsArray(t *testing.T) {
	cart := Cart{
		Groups: []CartBranchGroup{
			{
				Items: []CartItem{
					{
						ID:     1,
						AddOns: []CartAddOn{},
					},
				},
			},
		},
	}

	raw, err := json.Marshal(cart)
	if err != nil {
		t.Fatalf("marshal cart: %v", err)
	}

	if !strings.Contains(string(raw), `"addOns":[]`) {
		t.Fatalf("expected empty addOns array, got %s", raw)
	}
}

func TestOrderMarshalsEmptyItemsAndAddOnsAsArrays(t *testing.T) {
	order := Order{
		Items: []OrderItem{
			{
				ID:     1,
				AddOns: []CartAddOn{},
			},
		},
	}

	raw, err := json.Marshal(order)
	if err != nil {
		t.Fatalf("marshal order: %v", err)
	}

	if !strings.Contains(string(raw), `"items":[`) {
		t.Fatalf("expected items array, got %s", raw)
	}
	if !strings.Contains(string(raw), `"addOns":[]`) {
		t.Fatalf("expected empty addOns array, got %s", raw)
	}
}
