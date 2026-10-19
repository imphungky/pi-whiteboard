import { describe, expect, it } from "vitest";
import { WebSocket } from "ws";
import {
  BOARD_PROTOCOL_VERSION,
  decodeMessage,
  encodeMessage,
} from "../../shared/board-protocol/src/index.js";
import { BoardSessionRegistry } from "../src/BoardSessionRegistry.js";
import { PiWebSocketServer } from "../src/PiWebSocketServer.js";
import { projectKey } from "../src/ProjectSessionStore.js";

class FakeProjectSessionStore {
  private readonly sessions = new Map<string, { id: string; title: string; createdAt: string; lastOpenedAt: string }[]>();

  async getOrCreateDefault(projectRoot: string) {
    const sessions = this.sessions.get(projectRoot) ?? [];
    let session = sessions[0];
    if (!session) {
      const now = new Date().toISOString();
      session = { id: "default", title: "Project board", createdAt: now, lastOpenedAt: now };
      sessions.push(session);
      this.sessions.set(projectRoot, sessions);
    }
    return session;
  }

  async list(projectRoot: string) {
    return [...(this.sessions.get(projectRoot) ?? [])];
  }

  async get(_projectRoot: string, _sessionId: string) {
    return null;
  }

  async create(projectRoot: string, metadata: { id: string; title: string; createdAt: string; lastOpenedAt: string }) {
    this.sessions.set(projectRoot, [...(this.sessions.get(projectRoot) ?? []), metadata]);
    return metadata;
  }

  async update(projectRoot: string, metadata: { id: string; title: string; createdAt: string; lastOpenedAt: string }) {
    this.sessions.set(projectRoot, [metadata]);
  }
}

describe("Pi WebSocket server", () => {
  it("handshakes and mirrors a whiteboard state", async () => {
    const projectRoot = "project-a";
    const registry = new BoardSessionRegistry({ sessionStore: new FakeProjectSessionStore() });
    const session = await registry.getOrCreateDefault(projectRoot);
    const server = new PiWebSocketServer(registry);
    const websocketUrl = await server.start();
    const client = new WebSocket(websocketUrl);
    const state = { elements: [] };
    const messages: string[] = [];

    try {
      await new Promise<void>((resolve, reject) => {
        client.on("open", () => {
          client.send(
            encodeMessage({
              type: "hello",
              protocolVersion: BOARD_PROTOCOL_VERSION,
              client: "whiteboard",
              projectKey: projectKey(projectRoot),
              sessionId: session.sessionId,
            }),
          );
        });
        client.on("message", (raw) => {
          const message = decodeMessage(raw.toString());
          messages.push(message.type);
          if (message.type === "get-state") {
            client.send(
              encodeMessage({
                type: "state",
                requestId: message.requestId,
                snapshotId: "snapshot-1",
                state,
              }),
            );
          }
          if (message.type === "state-ack") {
            resolve();
          }
        });
        client.on("error", reject);

        client.once("open", () => {
          client.send(
            encodeMessage({
              type: "board-status",
              sessionId: session.sessionId,
              status: "available",
            }),
          );
        });
      });

      expect(messages).toEqual(["welcome", "get-state", "state-ack"]);
      expect(session.boardAvailability).toBe("available");
      expect(session.boardState).toEqual(state);
    } finally {
      client.close();
      await server.stop();
    }
  });
});
