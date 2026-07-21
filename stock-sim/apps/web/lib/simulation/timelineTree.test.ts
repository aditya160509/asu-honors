import { describe, expect, it } from "vitest";
import { buildTimelineTree, flattenTimelineTree } from "./timelineTree";
import type { TimelineResponse } from "@/lib/api/types";

function makeTimeline(overrides: Partial<TimelineResponse> & { id: number }): TimelineResponse {
  return {
    name: `Timeline ${overrides.id}`,
    is_live: false,
    parent_timeline_id: null,
    branch_point_sim_date: null,
    primitive: null,
    status: "ready",
    pinned: false,
    timeline_group_id: null,
    created_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("buildTimelineTree", () => {
  it("places a timeline with no parent at the root", () => {
    const live = makeTimeline({ id: 1, is_live: true });
    const tree = buildTimelineTree([live]);
    expect(tree).toHaveLength(1);
    expect(tree[0].timeline.id).toBe(1);
    expect(tree[0].depth).toBe(0);
    expect(tree[0].children).toHaveLength(0);
  });

  it("nests a direct child under its parent", () => {
    const live = makeTimeline({ id: 1, is_live: true });
    const child = makeTimeline({ id: 2, parent_timeline_id: 1 });
    const tree = buildTimelineTree([live, child]);

    expect(tree).toHaveLength(1);
    expect(tree[0].children).toHaveLength(1);
    expect(tree[0].children[0].timeline.id).toBe(2);
    expect(tree[0].children[0].depth).toBe(1);
  });

  it("nests a branch-of-a-branch two levels deep", () => {
    const live = makeTimeline({ id: 1, is_live: true });
    const child = makeTimeline({ id: 2, parent_timeline_id: 1 });
    const grandchild = makeTimeline({ id: 3, parent_timeline_id: 2 });
    // Input order shuffled -- tree building must not depend on parents
    // appearing before children in the list.
    const tree = buildTimelineTree([grandchild, live, child]);

    expect(tree).toHaveLength(1);
    expect(tree[0].children[0].children).toHaveLength(1);
    expect(tree[0].children[0].children[0].timeline.id).toBe(3);
    expect(tree[0].children[0].children[0].depth).toBe(2);
  });

  it("treats a timeline whose parent isn't in the list as a root", () => {
    const orphan = makeTimeline({ id: 5, parent_timeline_id: 999 });
    const tree = buildTimelineTree([orphan]);
    expect(tree).toHaveLength(1);
    expect(tree[0].timeline.id).toBe(5);
  });

  it("supports multiple sibling branches off the same parent", () => {
    const live = makeTimeline({ id: 1, is_live: true });
    const a = makeTimeline({ id: 2, parent_timeline_id: 1 });
    const b = makeTimeline({ id: 3, parent_timeline_id: 1 });
    const tree = buildTimelineTree([live, a, b]);
    expect(tree[0].children).toHaveLength(2);
    expect(tree[0].children.map((c) => c.timeline.id).sort()).toEqual([2, 3]);
  });

  it("does not hang or duplicate a timeline on a cyclical parent chain", () => {
    // Corrupt/manually-edited data: 2 -> 1 -> 2 (a cycle). Every timeline
    // must still be placed exactly once, and building must terminate.
    const a = makeTimeline({ id: 1, parent_timeline_id: 2 });
    const b = makeTimeline({ id: 2, parent_timeline_id: 1 });
    const tree = buildTimelineTree([a, b]);

    const flat = flattenTimelineTree(tree);
    expect(flat).toHaveLength(2);
    expect(new Set(flat.map((n) => n.timeline.id))).toEqual(new Set([1, 2]));
  });
});

describe("flattenTimelineTree", () => {
  it("orders a subtree depth-first, parent immediately before its children", () => {
    const live = makeTimeline({ id: 1, is_live: true });
    const child = makeTimeline({ id: 2, parent_timeline_id: 1 });
    const grandchild = makeTimeline({ id: 3, parent_timeline_id: 2 });
    const sibling = makeTimeline({ id: 4, parent_timeline_id: 1 });

    const tree = buildTimelineTree([live, child, grandchild, sibling]);
    const flat = flattenTimelineTree(tree);

    expect(flat.map((n) => n.timeline.id)).toEqual([1, 2, 3, 4]);
    expect(flat.map((n) => n.depth)).toEqual([0, 1, 2, 1]);
  });
});
