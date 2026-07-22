import type { TimelineResponse } from "@/lib/api/types";

export interface TimelineTreeNode {
  timeline: TimelineResponse;
  children: TimelineTreeNode[];
  depth: number;
}

/** Groups a flat timeline list (as returned by GET /sim/timelines) into a
 * parent/child tree by parent_timeline_id, for the Future Lab branch list's
 * lineage view -- a branch of a branch previously rendered identically to a
 * top-level branch, with nothing showing which parent it forked from.
 *
 * A timeline whose parent_timeline_id doesn't resolve to another timeline in
 * the list (the live timeline itself, or a branch whose parent was since
 * deleted) is treated as a root. Cycle-guarded the same way
 * db/timeline_resolver.py's get_timeline_chain is (a corrupt/manually-edited
 * parent_timeline_id forming a loop must not hang rendering) -- a timeline
 * is only ever placed once, at the first root it's reachable from in input
 * order.
 */
export function buildTimelineTree(timelines: TimelineResponse[]): TimelineTreeNode[] {
  const byParent = new Map<number, TimelineResponse[]>();
  const byId = new Map<number, TimelineResponse>();
  for (const t of timelines) byId.set(t.id, t);
  for (const t of timelines) {
    const parentId = t.parent_timeline_id;
    if (parentId !== null && byId.has(parentId)) {
      const siblings = byParent.get(parentId) ?? [];
      siblings.push(t);
      byParent.set(parentId, siblings);
    }
  }

  const placed = new Set<number>();

  // Iterative (not recursive) so an unusually deep branch-of-branch chain
  // can't stack-overflow the JS engine -- each node's `children` array is
  // built bottom-up via an explicit work stack instead of native recursion.
  function buildNode(root: TimelineResponse, rootDepth: number): TimelineTreeNode {
    const node: TimelineTreeNode = { timeline: root, children: [], depth: rootDepth };
    placed.add(root.id);
    const stack: TimelineTreeNode[] = [node];
    while (stack.length > 0) {
      const current = stack.pop()!;
      const childTimelines = (byParent.get(current.timeline.id) ?? []).filter((child) => !placed.has(child.id));
      for (const childTimeline of childTimelines) {
        placed.add(childTimeline.id);
        const childNode: TimelineTreeNode = { timeline: childTimeline, children: [], depth: current.depth + 1 };
        current.children.push(childNode);
        stack.push(childNode);
      }
    }
    return node;
  }

  const result: TimelineTreeNode[] = [];
  const initialRoots = timelines.filter((t) => t.parent_timeline_id === null || !byId.has(t.parent_timeline_id));
  for (const t of initialRoots) {
    if (!placed.has(t.id)) result.push(buildNode(t, 0));
  }
  // Anything still unplaced only has parents that are themselves part of a
  // cycle (no entry point reachable from a genuine root) -- surface each as
  // its own root rather than silently dropping it from the list.
  for (const t of timelines) {
    if (!placed.has(t.id)) result.push(buildNode(t, 0));
  }
  return result;
}

/** Flattens a tree back into depth-ordered rows (parent immediately followed
 * by its own subtree, depth-first) -- what the list actually renders, since
 * CSS indentation needs a flat array with a depth per row, not nested JSX. */
export function flattenTimelineTree(nodes: TimelineTreeNode[]): TimelineTreeNode[] {
  const out: TimelineTreeNode[] = [];
  // Iterative depth-first walk (see buildTimelineTree's buildNode) so a very
  // deep chain can't stack-overflow the JS engine.
  const stack = [...nodes].reverse();
  while (stack.length > 0) {
    const node = stack.pop()!;
    out.push(node);
    for (let i = node.children.length - 1; i >= 0; i--) stack.push(node.children[i]);
  }
  return out;
}
