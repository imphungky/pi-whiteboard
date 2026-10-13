import { describe, expect, it } from "vitest";
import { WebSocket } from "ws";
import {
  BOARD_PROTOCOL_VERSION,
  decodeMessage,
  encodeMessage,
} from "../../shared/board-protocol/src/index.js";
import { BoardSessionRegistry } from "../src/BoardSessionRegistry.js";
import { PiWebSocketServer } from "../src/PiWebSocketServer.js";

describe("Pi WebSocket server", () => {
  it("handshakes and mirrors a whiteboard state", async () => {
    const registry = new BoardSessionRegistry({
      createSessionId: () => "session-1",
    });
    const session = registry.create();
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
      });

      expect(messages).toEqual(["welcome", "get-state", "state-ack"]);
      expect(session.boardState).toEqual(state);
    } finally {
      client.close();
      await server.stop();
    }
  });
});
