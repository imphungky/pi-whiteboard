import { describe, expect, it, vi } from "vitest";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { BoardSessionRegistry } from "../src/BoardSessionRegistry.js";
import { WhiteboardLauncher } from "../src/WhiteboardLauncher.js";
import type {
  ProjectSessionStore,
  WhiteboardSessionMetadata,
} from "../src/ProjectSessionStore.js";
import { projectKey } from "../src/ProjectSessionStore.js";
import piWhiteboardExtension, {
  parseWhiteboardCommand,
} from "../src/index.js";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";

class FakeProjectSessionStore implements ProjectSessionStore {
  private readonly sessions = new Map<string, WhiteboardSessionMetadata[]>();

  async getOrCreateDefault(projectRoot: string): Promise<WhiteboardSessionMetadata> {
    const sessions = this.sessions.get(projectRoot) ?? [];
    let session = sessions.find((candidate) => candidate.id === "default");
    if (!session) {
      const now = new Date().toISOString();
      session = {
        id: "default",
        title: "Project board",
        createdAt: now,
        lastOpenedAt: now,
      };
      sessions.push(session);
      this.sessions.set(projectRoot, sessions);
    }
    return session;
  }

  async list(projectRoot: string) {
    return [...(this.sessions.get(projectRoot) ?? [])];
  }

  async get(projectRoot: string, sessionId: string) {
    return (this.sessions.get(projectRoot) ?? []).find((session) => session.id === sessionId) ?? null;
  }

  async create(projectRoot: string, metadata: WhiteboardSessionMetadata) {
    const sessions = this.sessions.get(projectRoot) ?? [];
    sessions.push(metadata);
    this.sessions.set(projectRoot, sessions);
    return metadata;
  }

  async update(projectRoot: string, metadata: WhiteboardSessionMetadata) {
    const sessions = this.sessions.get(projectRoot) ?? [];
    const index = sessions.findIndex((session) => session.id === metadata.id);
    if (index === -1) sessions.push(metadata);
    else sessions[index] = metadata;
    this.sessions.set(projectRoot, sessions);
  }
}

describe("BoardSessionRegistry", () => {
  it("creates and retrieves the stable project default session", async () => {
    const registry = new BoardSessionRegistry({ sessionStore: new FakeProjectSessionStore() });

    const session = await registry.getOrCreateDefault("project-a");

    expect(session.sessionId).toBe("default");
    expect(registry.get("project-a", "default")).toBe(session);
    expect((await registry.getOrCreateDefault("project-a"))).toBe(session);
  });

  it("isolates default sessions by project", async () => {
    const registry = new BoardSessionRegistry({ sessionStore: new FakeProjectSessionStore() });

    const first = await registry.getOrCreateDefault("project-a");
    const second = await registry.getOrCreateDefault("project-b");

    expect(first.sessionId).toBe("default");
    expect(second.sessionId).toBe("default");
    expect(first).not.toBe(second);
  });
});

describe("whiteboard_inspect tool", () => {
  it("registers with Pi and returns a placeholder result when executed", async () => {
    let registeredTool:
      | {
          name: string;
          execute: (...args: any[]) => Promise<any>;
        }
      | undefined;
    const pi = {
      registerTool(tool: typeof registeredTool) {
        registeredTool = tool ?? undefined;
      },
      registerCommand() {
        // The command is not under test here.
      },
      on() {
        return () => undefined;
      },
    } as unknown as ExtensionAPI;
    const log = vi.spyOn(console, "info").mockImplementation(() => undefined);

    try {
      piWhiteboardExtension(pi);

      expect(registeredTool?.name).toBe("whiteboard_inspect");
      const result = await registeredTool?.execute("call-1", {});

      expect(result).toEqual({
        content: [
          {
            type: "text",
            text: "Whiteboard inspection was called. Snapshot capture is not implemented yet.",
          },
        ],
        details: { status: "not_implemented" },
      });
      expect(log).toHaveBeenCalledWith(
        "[pi-whiteboard] whiteboard_inspect called",
        { toolCallId: "call-1" },
      );
    } finally {
      log.mockRestore();
    }
  });
});

describe("whiteboard command parsing", () => {
  it("supports the default, list, new, and session commands", () => {
    expect(parseWhiteboardCommand("")).toEqual({ type: "default" });
    expect(parseWhiteboardCommand("list")).toEqual({ type: "list" });
    expect(parseWhiteboardCommand("new")).toEqual({ type: "create" });
    expect(parseWhiteboardCommand("architecture")).toEqual({
      type: "open",
      sessionId: "architecture",
    });
  });

  it("rejects multiple command arguments", () => {
    expect(() => parseWhiteboardCommand("new extra")).toThrow(
      "Usage: whiteboard [list|new|session-id]",
    );
  });
});

describe("whiteboard command picker", () => {
  it("shows the newly created default session before launching", async () => {
    const cwd = await mkdtemp(`${tmpdir()}\\pi-whiteboard-picker-`);
    let handler: Parameters<ExtensionAPI["registerCommand"]>[1]["handler"] | undefined;
    let options: string[] | undefined;

    const pi = {
      registerTool() {
        // The inspection tool is not under test here.
      },
      registerCommand(_name: string, command: { handler: typeof handler }) {
        handler = command.handler;
      },
      on() {
        // The server is not started when the picker is cancelled.
        return () => undefined;
      },
    } as unknown as ExtensionAPI;

    try {
      piWhiteboardExtension(pi);
      if (!handler) throw new Error("whiteboard command was not registered");

      await handler("", {
        cwd,
        hasUI: true,
        ui: {
          notify: () => undefined,
          select: async (_title, pickerOptions) => {
            options = pickerOptions;
            return undefined;
          },
        },
      });

      expect(options).toEqual([
        "Project board — default (default) [inactive]",
        "New whiteboard",
      ]);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

describe("WhiteboardLauncher", () => {
  it("opens an existing session and creates a new session", async () => {
    const store = new FakeProjectSessionStore();
    const registry = new BoardSessionRegistry({ sessionStore: store });
    await registry.getOrCreateDefault("project-a");
    const launcher = new WhiteboardLauncher(
      registry,
      { start: async () => "ws://127.0.0.1:4317" },
      { whiteboardUrl: "http://localhost:5173/", openBrowser: () => undefined },
    );

    const opened = await launcher.launchSession("project-a", "default");
    const created = await launcher.createSession("project-a");

    expect(opened.session.sessionId).toBe("default");
    expect(created.session.sessionId).not.toBe("default");
    await expect(launcher.launchSession("project-a", "missing")).rejects.toThrow(
      "Unknown whiteboard session: missing",
    );
  });

  it("launches the project default URL with server and session parameters", async () => {
    const registry = new BoardSessionRegistry({ sessionStore: new FakeProjectSessionStore() });
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

    const result = await launcher.launch("project-a");

    expect(result.session.sessionId).toBe("default");
    expect(opened).toEqual([
      `http://localhost:5173/?ws=ws%3A%2F%2F127.0.0.1%3A4317&project=${projectKey("project-a")}&session=default`,
    ]);
  });
});
