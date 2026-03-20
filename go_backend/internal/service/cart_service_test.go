package service

import (
	"reflect"
	"testing"
)

func TestUniqueIDs(t *testing.T) {
	input := []int64{9, 5, 9, 3, 5, 1}
	want := []int64{1, 3, 5, 9}

	if got := uniqueIDs(input); !reflect.DeepEqual(got, want) {
		t.Fatalf("uniqueIDs() = %v, want %v", got, want)
	}
}
