import { describe, expect, it } from "vitest";
import { BoardSessionRegistry } from "../src/BoardSessionRegistry.js";
import { WhiteboardLauncher } from "../src/WhiteboardLauncher.js";

describe("BoardSessionRegistry", () => {
  it("creates and retrieves Pi-owned sessions", () => {
    const registry = new BoardSessionRegistry({
      createSessionId: () => "session-1",
    });

    const session = registry.create();

    expect(session.sessionId).toBe("session-1");
    expect(registry.get("session-1")).toBe(session);
  });

  it("keeps session IDs unique", () => {
    let calls = 0;
    const registry = new BoardSessionRegistry({
      createSessionId: () => `session-${calls++ === 0 ? "1" : "2"}`,
    });

    registry.create();
    const second = registry.create();

    expect(second.sessionId).toBe("session-2");
  });
});

describe("WhiteboardLauncher", () => {
  it("launches a URL containing the server URL and session ID", async () => {
    const registry = new BoardSessionRegistry({
      createSessionId: () => "session-1",
    });
    const opened: string[] = [];
    const launcher = new WhiteboardLauncher(
      registry,
      { start: async () => "ws://127.0.0.1:4317" },
      {
        whiteboardUrl: "http://localhost:5173/",
        openBrowser: (url) => {
          opened.push(url);
        },
      },
    );

    const result = await launcher.launch();

    expect(result.session.sessionId).toBe("session-1");
    expect(opened).toEqual([
      "http://localhost:5173/?ws=ws%3A%2F%2F127.0.0.1%3A4317&session=session-1",
    ]);
  });
});
