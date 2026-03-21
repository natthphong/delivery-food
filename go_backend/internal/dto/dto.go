package dto

type AuthLoginRequest struct {
	IDToken     string          `json:"idToken"`
	LineProfile *LineProfileDTO `json:"lineProfile"`
}

type LineProfileDTO struct {
	UserID      string  `json:"userId"`
	DisplayName *string `json:"displayName"`
	PictureURL  *string `json:"pictureUrl"`
	Email       *string `json:"email"`
}

type RefreshRequest struct {
	RefreshToken string `json:"refreshToken"`
}

type AuthTokensResponse struct {
	AccessToken  string      `json:"accessToken"`
	RefreshToken string      `json:"refreshToken"`
	User         interface{} `json:"user,omitempty"`
}

type ProfilePatchRequest struct {
	DisplayName     *string `json:"displayName"`
	Email           *string `json:"email"`
	Phone           *string `json:"phone"`
	IsEmailVerified *bool   `json:"isEmailVerified"`
	IsPhoneVerified *bool   `json:"isPhoneVerified"`
}

type AddCartItemRequest struct {
	BranchID  int64   `json:"branchId"`
	ProductID int64   `json:"productId"`
	Quantity  int     `json:"quantity"`
	AddOnIDs  []int64 `json:"addOnIds"`
}

type UpdateCartItemRequest struct {
	Quantity int `json:"quantity"`
}

type CheckoutRequest struct {
	BranchID         int64   `json:"branchId"`
	PaymentMethodID  int64   `json:"paymentMethodId"`
	SelectedItemIDs  []int64 `json:"selectedItemIds"`
	DeliveryLat      float64 `json:"deliveryLat"`
	DeliveryLng      float64 `json:"deliveryLng"`
	DeliveryDistance float64 `json:"deliveryDistanceKm"`
}

type DepositRequest struct {
	CompanyID       int64   `json:"companyId"`
	PaymentMethodID int64   `json:"paymentMethodId"`
	Amount          float64 `json:"amount"`
}
