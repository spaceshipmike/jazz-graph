// Weighted Louvain community detection.
//
// Finds modular communities ("scenes") in the collaboration graph by greedily
// maximizing modularity. Multi-level: local moving + aggregation until stable.
//
// Input:  nodeCount, links [{ source, target, weight }] with integer indices
// Output: Int array `community[i]` — contiguous community id per original node

export function louvain(nodeCount, links, { resolution = 1 } = {}) {
  // Build the initial weighted graph as symmetric adjacency maps.
  let n = nodeCount;
  let neighbors = Array.from({ length: n }, () => new Map());
  let self = new Array(n).fill(0);
  let m = 0; // total edge weight (each undirected edge once)

  for (const l of links) {
    const s = typeof l.source === "object" ? l.source.idx : l.source;
    const t = typeof l.target === "object" ? l.target.idx : l.target;
    const w = l.weight || 1;
    if (s === t) {
      self[s] += w;
      m += w;
      continue;
    }
    neighbors[s].set(t, (neighbors[s].get(t) || 0) + w);
    neighbors[t].set(s, (neighbors[t].get(s) || 0) + w);
    m += w;
  }

  if (m === 0) return new Array(nodeCount).fill(0);

  // Each level's nodes track which original nodes they contain.
  let node2orig = Array.from({ length: n }, (_, i) => [i]);
  const finalComm = new Array(nodeCount).fill(0);

  while (true) {
    const { comm, changed } = oneLevel(n, neighbors, self, m, resolution);

    // Relabel communities to contiguous 0..k-1
    const labelMap = new Map();
    let next = 0;
    const compact = comm.map((c) => {
      if (!labelMap.has(c)) labelMap.set(c, next++);
      return labelMap.get(c);
    });

    // Propagate this level's assignment down to original nodes.
    for (let i = 0; i < n; i++) {
      for (const orig of node2orig[i]) finalComm[orig] = compact[i];
    }

    if (!changed || next === n) break; // converged or nothing merged

    // Aggregate: build the next-level graph where each node is a community.
    const newN = next;
    const newNeighbors = Array.from({ length: newN }, () => new Map());
    const newSelf = new Array(newN).fill(0);
    const newNode2orig = Array.from({ length: newN }, () => []);

    for (let i = 0; i < n; i++) {
      newNode2orig[compact[i]].push(...node2orig[i]);
    }
    for (let i = 0; i < n; i++) {
      const ci = compact[i];
      newSelf[ci] += self[i];
      for (const [j, w] of neighbors[i]) {
        const cj = compact[j];
        if (ci === cj) {
          newSelf[ci] += w / 2; // internal edge counted from both endpoints
        } else {
          newNeighbors[ci].set(cj, (newNeighbors[ci].get(cj) || 0) + w);
        }
      }
    }

    n = newN;
    neighbors = newNeighbors;
    self = newSelf;
    node2orig = newNode2orig;
  }

  return finalComm;
}

// One Louvain level: move nodes between communities to improve modularity.
function oneLevel(n, neighbors, self, m, resolution) {
  const twoM = 2 * m;
  const k = new Array(n); // weighted degree (self loops count twice)
  for (let i = 0; i < n; i++) {
    let s = 0;
    for (const [, w] of neighbors[i]) s += w;
    k[i] = s + 2 * self[i];
  }

  const comm = Array.from({ length: n }, (_, i) => i);
  const sigmaTot = k.slice(); // total degree of nodes in each community

  let changed = false;
  let improved = true;
  let guard = 0;
  while (improved && guard++ < 50) {
    improved = false;
    for (let i = 0; i < n; i++) {
      const ci = comm[i];
      sigmaTot[ci] -= k[i];
      comm[i] = -1;

      // Sum edge weight from i into each neighboring community.
      const wToComm = new Map([[ci, 0]]);
      for (const [j, w] of neighbors[i]) {
        const cj = comm[j];
        if (cj === -1) continue;
        wToComm.set(cj, (wToComm.get(cj) || 0) + w);
      }

      let bestC = ci;
      let bestGain = (wToComm.get(ci) || 0) - (resolution * sigmaTot[ci] * k[i]) / twoM;
      for (const [c, wic] of wToComm) {
        const gain = wic - (resolution * sigmaTot[c] * k[i]) / twoM;
        if (gain > bestGain) {
          bestGain = gain;
          bestC = c;
        }
      }

      comm[i] = bestC;
      sigmaTot[bestC] += k[i];
      if (bestC !== ci) {
        improved = true;
        changed = true;
      }
    }
  }

  return { comm, changed };
}
