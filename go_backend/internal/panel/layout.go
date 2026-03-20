package panel

import "sort"

type LayoutPosition struct {
	X float64
	Y float64
}

func BuildAutoLayout(nodes []Node, edges []Edge) map[string]LayoutPosition {
	if len(nodes) == 0 {
		return map[string]LayoutPosition{}
	}

	layoutable := make([]Node, 0, len(nodes))
	existing := make(map[string]Node, len(nodes))
	for _, node := range nodes {
		existing[node.ID] = node
		if node.Type == string(NodeTypeNote) {
			continue
		}
		layoutable = append(layoutable, node)
	}
	if len(layoutable) == 0 {
		return map[string]LayoutPosition{}
	}

	children := map[string][]string{}
	indegree := map[string]int{}
	layer := map[string]int{}
	for _, node := range layoutable {
		indegree[node.ID] = 0
		layer[node.ID] = 0
	}
	for _, edge := range edges {
		if _, ok := indegree[edge.SourceNodeID]; !ok {
			continue
		}
		if _, ok := indegree[edge.TargetNodeID]; !ok {
			continue
		}
		children[edge.SourceNodeID] = append(children[edge.SourceNodeID], edge.TargetNodeID)
		indegree[edge.TargetNodeID]++
	}

	for id := range children {
		sort.Slice(children[id], func(i, j int) bool {
			left := existing[children[id][i]]
			right := existing[children[id][j]]
			if left.PositionY == right.PositionY {
				return left.Title < right.Title
			}
			return left.PositionY < right.PositionY
		})
	}

	queue := make([]string, 0, len(layoutable))
	for _, node := range layoutable {
		if indegree[node.ID] == 0 {
			queue = append(queue, node.ID)
		}
	}
	sort.Slice(queue, func(i, j int) bool {
		left := existing[queue[i]]
		right := existing[queue[j]]
		if left.PositionY == right.PositionY {
			return left.Title < right.Title
		}
		return left.PositionY < right.PositionY
	})

	visited := map[string]bool{}
	for len(queue) > 0 {
		id := queue[0]
		queue = queue[1:]
		visited[id] = true
		for _, childID := range children[id] {
			if layer[childID] < layer[id]+1 {
				layer[childID] = layer[id] + 1
			}
			indegree[childID]--
			if indegree[childID] == 0 {
				queue = append(queue, childID)
			}
		}
	}

	maxLayer := 0
	for _, v := range layer {
		if v > maxLayer {
			maxLayer = v
		}
	}
	for _, node := range layoutable {
		if visited[node.ID] {
			continue
		}
		maxLayer++
		layer[node.ID] = maxLayer
	}

	grouped := map[int][]Node{}
	layers := make([]int, 0)
	seenLayers := map[int]bool{}
	for _, node := range layoutable {
		l := layer[node.ID]
		grouped[l] = append(grouped[l], node)
		if !seenLayers[l] {
			layers = append(layers, l)
			seenLayers[l] = true
		}
	}
	sort.Ints(layers)

	positions := make(map[string]LayoutPosition, len(layoutable))
	const baseX = 120.0
	const baseY = 100.0
	const xGap = 310.0
	const yGap = 170.0

	for _, l := range layers {
		nodesAtLayer := grouped[l]
		sort.Slice(nodesAtLayer, func(i, j int) bool {
			if nodesAtLayer[i].PositionY == nodesAtLayer[j].PositionY {
				return nodesAtLayer[i].Title < nodesAtLayer[j].Title
			}
			return nodesAtLayer[i].PositionY < nodesAtLayer[j].PositionY
		})
		for idx, node := range nodesAtLayer {
			positions[node.ID] = LayoutPosition{
				X: baseX + float64(l)*xGap,
				Y: baseY + float64(idx)*yGap,
			}
		}
	}

	return positions
}
