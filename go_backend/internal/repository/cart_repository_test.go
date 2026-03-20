package repository

import (
	"testing"

	"github.com/natthaohong/delivery-food/go_backend/internal/model"
)

func TestBuildAddOnSignature(t *testing.T) {
	addOns := []model.ProductAddOn{
		{ID: 9, Name: "Egg", Price: 12},
		{ID: 3, Name: "Chicken", Price: 0},
		{ID: 9, Name: "Egg", Price: 12},
	}

	signature := BuildAddOnSignature(addOns)
	want := "[{3 Chicken 0} {9 Egg 12} {9 Egg 12}]"
	if signature != want {
		t.Fatalf("BuildAddOnSignature() = %q, want %q", signature, want)
	}
}
