import { describe, expect, it } from "vitest";
import { pickWhiteboardAction } from "../src/WhiteboardSessionPicker.js";
import type { WhiteboardSessionMetadata } from "../src/ProjectSessionStore.js";

const sessions: WhiteboardSessionMetadata[] = [
  {
    id: "default",
    title: "Project board",
    createdAt: "2025-01-01T00:00:00.000Z",
    lastOpenedAt: "2025-01-01T00:00:00.000Z",
  },
  {
    id: "architecture",
    title: "Architecture",
    createdAt: "2025-01-01T00:00:00.000Z",
    lastOpenedAt: "2025-01-01T00:00:00.000Z",
  },
];

describe("whiteboard session picker", () => {
  it("opens the selected existing session", async () => {
    const action = await pickWhiteboardAction(
      { select: async (_title, options) => options[1] },
      sessions,
      (sessionId) => (sessionId === "default" ? "active" : "inactive"),
    );

    expect(action).toEqual({ type: "open", sessionId: "architecture" });
  });

  it("creates a new session when selected", async () => {
    const action = await pickWhiteboardAction(
      { select: async (_title, options) => options[options.length - 1] },
      sessions,
      () => "inactive",
    );

    expect(action).toEqual({ type: "create" });
  });

  it("returns null when the picker is cancelled", async () => {
    const action = await pickWhiteboardAction(
      { select: async () => undefined },
      sessions,
      () => "inactive",
    );

    expect(action).toBeNull();
  });
});
