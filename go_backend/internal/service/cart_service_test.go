package service

import (
	"reflect"
	"testing"

	"github.com/natthaohong/delivery-food/go_backend/internal/model"
)

func TestUniqueIDs(t *testing.T) {
	input := []int64{9, 5, 9, 3, 5, 1}
	want := []int64{1, 3, 5, 9}

	if got := uniqueIDs(input); !reflect.DeepEqual(got, want) {
		t.Fatalf("uniqueIDs() = %v, want %v", got, want)
	}
}

func TestFilterConsumedCartItemsRemovesConsumedIDs(t *testing.T) {
	cart := model.Cart{
		Groups: []model.CartBranchGroup{
			{
				BranchID: 1,
				Items: []model.CartItem{
					{ID: 1, Quantity: 1, LineTotal: 50},
					{ID: 2, Quantity: 2, LineTotal: 140},
				},
			},
			{
				BranchID: 2,
				Items: []model.CartItem{
					{ID: 3, Quantity: 1, LineTotal: 90},
				},
			},
		},
		TotalAmount:   280,
		TotalItems:    3,
		TotalQuantity: 4,
	}

	got := filterConsumedCartItems(cart, []int64{1, 3})
	if len(got.Groups) != 1 {
		t.Fatalf("filterConsumedCartItems() groups = %d, want 1", len(got.Groups))
	}
	if len(got.Groups[0].Items) != 1 || got.Groups[0].Items[0].ID != 2 {
		t.Fatalf("filterConsumedCartItems() remaining items = %#v", got.Groups[0].Items)
	}
	if got.TotalAmount != 140 || got.TotalItems != 1 || got.TotalQuantity != 2 {
		t.Fatalf("filterConsumedCartItems() totals = amount %.2f items %d qty %d", got.TotalAmount, got.TotalItems, got.TotalQuantity)
	}
}
