package httpapi

import (
	"encoding/json"
	"net/http"

	"github.com/natthaohong/delivery-food/go_backend/internal/apperror"
)

type Envelope struct {
	Code    string      `json:"code"`
	Message string      `json:"message"`
	Body    interface{} `json:"body,omitempty"`
}

func WriteJSON(w http.ResponseWriter, statusCode int, code, message string, body interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(statusCode)
	_ = json.NewEncoder(w).Encode(Envelope{
		Code:    code,
		Message: message,
		Body:    body,
	})
}

func WriteOK(w http.ResponseWriter, body interface{}) {
	WriteJSON(w, http.StatusOK, "OK", "success", body)
}

func WriteError(w http.ResponseWriter, err error) {
	if appErr, ok := apperror.As(err); ok {
		WriteJSON(w, appErr.StatusCode, appErr.Code, appErr.Message, appErr.Body)
		return
	}
	WriteJSON(w, http.StatusInternalServerError, "INTERNAL_ERROR", "internal server error", nil)
}

func DecodeJSON(r *http.Request, target interface{}) error {
	defer r.Body.Close()
	decoder := json.NewDecoder(r.Body)
	decoder.DisallowUnknownFields()
	return decoder.Decode(target)
}
