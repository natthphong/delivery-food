package panel

import (
	"fmt"
	"sort"
	"strings"
)

func ValidateNodeInput(in Node) error {
	if strings.TrimSpace(in.FlowID) == "" {
		return fmt.Errorf("flow_id is required")
	}
	if strings.TrimSpace(in.Type) == "" {
		return fmt.Errorf("type is required")
	}
	if strings.TrimSpace(in.Title) == "" {
		return fmt.Errorf("title is required")
	}
	return nil
}

func ValidateMappingInput(in Mapping) error {
	if strings.TrimSpace(in.EdgeID) == "" {
		return fmt.Errorf("edge_id is required")
	}
	switch strings.ToUpper(strings.TrimSpace(in.MappingType)) {
	case string(MappingTypeDirect),
		string(MappingTypeTransform),
		string(MappingTypeConstant),
		string(MappingTypeDerived),
		string(MappingTypeRename),
		string(MappingTypeCopy),
		string(MappingTypeMerge),
		string(MappingTypeSplit):
		return nil
	default:
		return fmt.Errorf("unsupported mapping_type")
	}
}

func BuildLineageResult(field string, steps []LineageStep) LineageResult {
	nodeSet := map[string]struct{}{}
	edgeSet := map[string]struct{}{}
	for _, step := range steps {
		nodeSet[step.SourceNodeID] = struct{}{}
		nodeSet[step.TargetNodeID] = struct{}{}
		edgeSet[step.EdgeID] = struct{}{}
	}
	nodes := make([]string, 0, len(nodeSet))
	edges := make([]string, 0, len(edgeSet))
	for n := range nodeSet {
		nodes = append(nodes, n)
	}
	for e := range edgeSet {
		edges = append(edges, e)
	}
	sort.Strings(nodes)
	sort.Strings(edges)
	return LineageResult{Field: field, NodeIDs: nodes, EdgeIDs: edges, MappingChain: steps}
}
