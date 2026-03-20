package schema

import (
	"encoding/json"
	"fmt"
	"sort"
	"strings"
)

type DetectedField struct {
	FieldPath  string `json:"fieldPath"`
	FieldName  string `json:"fieldName"`
	Direction  string `json:"direction"`
	DataType   string `json:"dataType"`
	SourceType string `json:"sourceType"`
}

func DetectFieldsFromJSON(payload string, direction string) ([]DetectedField, error) {
	var parsed interface{}
	if err := json.Unmarshal([]byte(payload), &parsed); err != nil {
		return nil, fmt.Errorf("invalid json: %w", err)
	}
	if direction != "request" && direction != "response" && direction != "internal" {
		return nil, fmt.Errorf("unsupported direction: %s", direction)
	}

	fieldsMap := map[string]DetectedField{}
	flatten(parsed, "", direction, fieldsMap)

	fields := make([]DetectedField, 0, len(fieldsMap))
	for _, f := range fieldsMap {
		fields = append(fields, f)
	}
	sort.Slice(fields, func(i, j int) bool { return fields[i].FieldPath < fields[j].FieldPath })
	return fields, nil
}

func flatten(v interface{}, path string, direction string, out map[string]DetectedField) {
	switch typed := v.(type) {
	case map[string]interface{}:
		for k, child := range typed {
			next := k
			if path != "" {
				next = path + "." + k
			}
			flatten(child, next, direction, out)
		}
	case []interface{}:
		arrPath := path + "[]"
		if path == "" {
			arrPath = "[]"
		}
		for _, child := range typed {
			flatten(child, arrPath, direction, out)
		}
		if len(typed) == 0 {
			upsertField(arrPath, direction, "array", out)
		}
	default:
		upsertField(path, direction, inferType(typed), out)
	}
}

func upsertField(path, direction, dataType string, out map[string]DetectedField) {
	if path == "" {
		return
	}
	fieldName := path
	if idx := strings.LastIndex(path, "."); idx >= 0 {
		fieldName = path[idx+1:]
	}
	fieldName = strings.TrimSuffix(fieldName, "[]")
	out[path] = DetectedField{
		FieldPath:  path,
		FieldName:  fieldName,
		Direction:  direction,
		DataType:   dataType,
		SourceType: "request",
	}
}

func inferType(v interface{}) string {
	switch val := v.(type) {
	case string:
		_ = val
		return "string"
	case bool:
		return "boolean"
	case float64:
		if float64(int64(val)) == val {
			return "integer"
		}
		return "number"
	case nil:
		return "null"
	case map[string]interface{}:
		return "object"
	case []interface{}:
		return "array"
	default:
		return "unknown"
	}
}
