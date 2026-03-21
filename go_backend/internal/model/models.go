package model

import "time"

type User struct {
	ID              int64      `json:"id"`
	AuthProvider    string     `json:"authProvider"`
	AuthSubject     string     `json:"-"`
	Email           *string    `json:"email"`
	Phone           *string    `json:"phone"`
	DisplayName     *string    `json:"displayName"`
	ProviderLabel   *string    `json:"providerLabel"`
	IsEmailVerified bool       `json:"isEmailVerified"`
	IsPhoneVerified bool       `json:"isPhoneVerified"`
	WalletBalance   float64    `json:"walletBalance"`
	LastLoginAt     *time.Time `json:"lastLoginAt"`
	CreatedAt       time.Time  `json:"createdAt"`
	UpdatedAt       time.Time  `json:"updatedAt"`
}

type SystemConfig struct {
	Key         string `json:"key"`
	Value       string `json:"value"`
	Description string `json:"description"`
}

type Category struct {
	ID          int64   `json:"id"`
	CompanyID   int64   `json:"companyId"`
	Slug        string  `json:"slug"`
	Name        string  `json:"name"`
	Description *string `json:"description"`
	SortOrder   int     `json:"sortOrder"`
	IsActive    bool    `json:"isActive"`
}

type OperatingWindow struct {
	DayOfWeek int    `json:"dayOfWeek"`
	OpenTime  string `json:"openTime"`
	CloseTime string `json:"closeTime"`
}

type BranchSummary struct {
	ID            int64             `json:"id"`
	CompanyID     int64             `json:"companyId"`
	Name          string            `json:"name"`
	Slug          string            `json:"slug"`
	Description   *string           `json:"description"`
	ImageURL      *string           `json:"imageUrl"`
	AddressLine   *string           `json:"addressLine"`
	Lat           *float64          `json:"lat"`
	Lng           *float64          `json:"lng"`
	IsForceClosed bool              `json:"isForceClosed"`
	AcceptingOrders bool            `json:"acceptingOrders"`
	SupportsPickup bool             `json:"supportsPickup"`
	SupportsRiderDelivery bool      `json:"supportsRiderDelivery"`
	RiderDeliveryFee float64        `json:"riderDeliveryFee"`
	OperationalNote *string         `json:"operationalNote"`
	OpenHours     []OperatingWindow `json:"openHours,omitempty"`
	IsOpen        bool              `json:"isOpen"`
}

type BranchSearchSample struct {
	ProductID int64   `json:"productId"`
	Name      string  `json:"name"`
	ImageURL  *string `json:"imageUrl"`
	Price     float64 `json:"price"`
}

type BranchSearchResult struct {
	BranchSummary
	DistanceKM    *float64             `json:"distanceKm"`
	MatchCount    int                  `json:"matchCount"`
	ProductSample []BranchSearchSample `json:"productSample"`
}

type ProductAddOn struct {
	ID         int64   `json:"id"`
	GroupName  string  `json:"groupName"`
	Name       string  `json:"name"`
	Price      float64 `json:"price"`
	IsRequired bool    `json:"isRequired"`
	SortOrder  int     `json:"sortOrder"`
}

type MenuItem struct {
	ProductID     int64          `json:"productId"`
	Name          string         `json:"name"`
	Description   *string        `json:"description"`
	ImageURL      *string        `json:"imageUrl"`
	Price         float64        `json:"price"`
	BasePrice     float64        `json:"basePrice"`
	InStock       bool           `json:"inStock"`
	StockQty      *int           `json:"stockQty"`
	IsRecommended bool           `json:"isRecommended"`
	IsTemporarilyClosed bool      `json:"isTemporarilyClosed"`
	AvailabilityNote *string      `json:"availabilityNote"`
	ReorderLevel *int             `json:"reorderLevel"`
	AddOns        []ProductAddOn `json:"addOns"`
}

type CartAddOn struct {
	ID    *int64  `json:"id,omitempty"`
	Name  string  `json:"name"`
	Price float64 `json:"price"`
}

type CartItem struct {
	ID          int64       `json:"id"`
	BranchID    int64       `json:"branchId"`
	ProductID   int64       `json:"productId"`
	ProductName string      `json:"productName"`
	ImageURL    *string     `json:"imageUrl"`
	Quantity    int         `json:"quantity"`
	UnitPrice   float64     `json:"unitPrice"`
	StockQty    *int        `json:"stockQty"`
	AddOns      []CartAddOn `json:"addOns"`
	LineTotal   float64     `json:"lineTotal"`
	VariantKey  string      `json:"variantKey"`
	CreatedAt   time.Time   `json:"createdAt"`
	UpdatedAt   time.Time   `json:"updatedAt"`
}

type CartBranchGroup struct {
	BranchID    int64      `json:"branchId"`
	CompanyID   int64      `json:"companyId"`
	BranchName  string     `json:"branchName"`
	BranchImage *string    `json:"branchImage"`
	Items       []CartItem `json:"items"`
	SubTotal    float64    `json:"subTotal"`
}

type Cart struct {
	Groups        []CartBranchGroup `json:"groups"`
	TotalAmount   float64           `json:"totalAmount"`
	TotalItems    int               `json:"totalItems"`
	TotalQuantity int               `json:"totalQuantity"`
	LastSyncedAt  time.Time         `json:"lastSyncedAt"`
}

type PaymentMethod struct {
	ID          int64   `json:"id"`
	Code        string  `json:"code"`
	Name        string  `json:"name"`
	MethodType  string  `json:"methodType"`
	SortOrder   int     `json:"sortOrder"`
	PromptPayID *string `json:"promptPayId,omitempty"`
	ProviderCode *string `json:"providerCode,omitempty"`
	ProviderMethodCode *string `json:"providerMethodCode,omitempty"`
	CheckoutFlow string `json:"checkoutFlow"`
	Metadata map[string]any `json:"metadata,omitempty"`
}

type Transaction struct {
	ID              int64      `json:"id"`
	UserID          int64      `json:"userId"`
	CompanyID       int64      `json:"companyId"`
	PaymentMethodID int64      `json:"paymentMethodId"`
	TxnType         string     `json:"txnType"`
	Amount          float64    `json:"amount"`
	Status          string     `json:"status"`
	ExpiresAt       *time.Time `json:"expiresAt"`
	SlipReference   *string    `json:"slipReference"`
	SlipDate        *time.Time `json:"slipDate"`
	SlipTimestamp   *time.Time `json:"slipTimestamp"`
	ProviderID      *int64     `json:"providerId,omitempty"`
	ProviderReference *string  `json:"providerReference,omitempty"`
	ProviderStatus  *string    `json:"providerStatus,omitempty"`
	PaymentAction   map[string]any `json:"paymentAction,omitempty"`
	PaidAt          *time.Time `json:"paidAt,omitempty"`
	FailedReason    *string    `json:"failedReason,omitempty"`
	CreatedAt       time.Time  `json:"createdAt"`
	UpdatedAt       time.Time  `json:"updatedAt"`
}

type TransactionSummary struct {
	Transaction
	Method    *PaymentMethod `json:"method,omitempty"`
	OrderID   *int64         `json:"orderId,omitempty"`
	IsExpired bool           `json:"isExpired"`
}

type OrderItem struct {
	ID          int64       `json:"id"`
	ProductID   *int64      `json:"productId,omitempty"`
	ProductName string      `json:"productName"`
	Quantity    int         `json:"quantity"`
	UnitPrice   float64     `json:"unitPrice"`
	AddOns      []CartAddOn `json:"addOns"`
	LineTotal   float64     `json:"lineTotal"`
}

type Order struct {
	ID                 int64               `json:"id"`
	UserID             int64               `json:"userId"`
	BranchID           int64               `json:"branchId"`
	TransactionID      int64               `json:"transactionId"`
	Status             string              `json:"status"`
	FulfillmentMode    string              `json:"fulfillmentMode"`
	DeliveryFee        float64             `json:"deliveryFee"`
	CustomerNote       *string             `json:"customerNote,omitempty"`
	DeliveryLat        *float64            `json:"deliveryLat"`
	DeliveryLng        *float64            `json:"deliveryLng"`
	DeliveryDistanceKM *float64            `json:"deliveryDistanceKm"`
	CreatedAt          time.Time           `json:"createdAt"`
	UpdatedAt          time.Time           `json:"updatedAt"`
	Items              []OrderItem         `json:"items"`
	Branch             *BranchSummary      `json:"branch,omitempty"`
	Transaction        *TransactionSummary `json:"transaction,omitempty"`
	DeliveryJob        *DeliveryJob        `json:"deliveryJob,omitempty"`
	TotalAmount        float64             `json:"totalAmount"`
}

type Bootstrap struct {
	User   User              `json:"user"`
	Config map[string]string `json:"config"`
	Cart   Cart              `json:"cart"`
}

type IdentityClaims struct {
	ProviderLabel   string
	AuthSubject     string
	Email           *string
	Phone           *string
	DisplayName     *string
	IsEmailVerified bool
	IsPhoneVerified bool
}
