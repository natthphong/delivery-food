package service

import (
	"reflect"
	"testing"

	backendauth "github.com/natthaohong/delivery-food/go_backend/internal/auth"
	"github.com/natthaohong/delivery-food/go_backend/internal/model"
)

func TestEnrichAdminOrderSetsEmptyItemsAndTransitions(t *testing.T) {
	item := enrichAdminOrder(model.AdminOrder{
		Order: model.Order{
			Status:          "PENDING",
			FulfillmentMode: "pickup",
		},
	})

	if item.Items == nil {
		t.Fatal("enrichAdminOrder() left items nil")
	}
	if len(item.Items) != 0 {
		t.Fatalf("enrichAdminOrder() items length = %d, want 0", len(item.Items))
	}

	want := []string{"PREPARE", "READY", "REJECTED"}
	if !reflect.DeepEqual(item.AllowedStatuses, want) {
		t.Fatalf("enrichAdminOrder() allowed statuses = %v, want %v", item.AllowedStatuses, want)
	}
}

func TestAllowedOrderStatusTransitionsReadyUsesFulfillmentMode(t *testing.T) {
	pickup := allowedOrderStatusTransitions(model.AdminOrder{
		Order: model.Order{Status: "READY", FulfillmentMode: "pickup"},
	})
	if !reflect.DeepEqual(pickup, []string{"COMPLETED", "REJECTED"}) {
		t.Fatalf("pickup READY transitions = %v", pickup)
	}

	delivery := allowedOrderStatusTransitions(model.AdminOrder{
		Order: model.Order{Status: "READY", FulfillmentMode: "rider_delivery"},
	})
	if !reflect.DeepEqual(delivery, []string{"DELIVERY", "REJECTED"}) {
		t.Fatalf("rider READY transitions = %v", delivery)
	}
}

func TestSelectBranchCopyProductIDsSupportsCategoriesAndExplicitProducts(t *testing.T) {
	products := []model.AdminBranchProduct{
		{
			ProductID: 1,
			Categories: []model.AdminBranchProductCategory{
				{ID: 10, Name: "Kaprao"},
			},
		},
		{
			ProductID: 2,
			Categories: []model.AdminBranchProductCategory{
				{ID: 20, Name: "Fried rice"},
			},
		},
		{
			ProductID: 3,
			Categories: []model.AdminBranchProductCategory{
				{ID: 10, Name: "Kaprao"},
				{ID: 30, Name: "Vegetable"},
			},
		},
	}

	got := selectBranchCopyProductIDs(products, "selected", []int64{10}, []int64{2})
	want := []int64{1, 2, 3}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("selectBranchCopyProductIDs() = %v, want %v", got, want)
	}
}

func TestCanCreateBranchRequiresOwnerManagerOrBootstrap(t *testing.T) {
	tests := []struct {
		name   string
		claims *backendauth.AccessClaims
		want   bool
	}{
		{
			name: "manager branch cannot create branches",
			claims: &backendauth.AccessClaims{
				Roles: []string{"manager_branch"},
			},
			want: false,
		},
		{
			name: "manager can create branches",
			claims: &backendauth.AccessClaims{
				Roles: []string{"manager"},
			},
			want: true,
		},
		{
			name: "owner can create branches",
			claims: &backendauth.AccessClaims{
				Roles: []string{"owner"},
			},
			want: true,
		},
		{
			name: "bootstrap admin can create branches",
			claims: &backendauth.AccessClaims{
				ActorType: "bootstrap_admin",
			},
			want: true,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			if got := canCreateBranch(tc.claims); got != tc.want {
				t.Fatalf("canCreateBranch() = %v, want %v", got, tc.want)
			}
		})
	}
}
