package httpapi

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/natthaohong/delivery-food/go_backend/internal/apperror"
)

func TestWriteErrorIncludesStructuredValidationBody(t *testing.T) {
	recorder := httptest.NewRecorder()

	WriteError(recorder, apperror.Validation("Please review the form.", map[string]string{
		"name": "Name is required.",
	}))

	if recorder.Code != http.StatusUnprocessableEntity {
		t.Fatalf("WriteError() status = %d, want %d", recorder.Code, http.StatusUnprocessableEntity)
	}

	var envelope Envelope
	if err := json.Unmarshal(recorder.Body.Bytes(), &envelope); err != nil {
		t.Fatalf("json.Unmarshal() error = %v", err)
	}

	if envelope.Code != "VALIDATION_ERROR" {
		t.Fatalf("envelope.Code = %q, want VALIDATION_ERROR", envelope.Code)
	}

	body, ok := envelope.Body.(map[string]any)
	if !ok {
		t.Fatalf("envelope.Body type = %T, want map[string]any", envelope.Body)
	}

	fieldErrors, ok := body["fieldErrors"].(map[string]any)
	if !ok {
		t.Fatalf("fieldErrors type = %T, want map[string]any", body["fieldErrors"])
	}
	if fieldErrors["name"] != "Name is required." {
		t.Fatalf("fieldErrors[name] = %v, want Name is required.", fieldErrors["name"])
	}
}
