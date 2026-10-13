import {
  BOARD_PROTOCOL_VERSION,
  decodeMessage,
  encodeMessage,
  type BoardMessage,
  type HelloMessage,
  type StateMessage,
} from "../../shared/board-protocol/src/index.js";
import { randomUUID } from "node:crypto";
import { WebSocket } from "ws";
import type { BoardSessionRegistry, PiBoardSession } from "./BoardSessionRegistry.js";

export class PiConnectionHandler {
  private session: PiBoardSession | null = null;

  constructor(
    private readonly connection: WebSocket,
    private readonly registry: BoardSessionRegistry,
  ) {
    connection.on("message", (data) => this.handleRawMessage(data.toString()));
    connection.on("close", () => this.handleClose());
  }

  handleRawMessage(raw: string): void {
    let message: BoardMessage;
    try {
      message = decodeMessage(raw);
    } catch {
      this.sendError("invalid-message", "Invalid board protocol message");
      return;
    }

    this.handleMessage(message);
  }

  handleMessage(message: BoardMessage): void {
    switch (message.type) {
      case "hello":
        this.handleHello(message);
        return;
      case "state":
        this.handleState(message);
        return;
      default:
        this.sendError("unexpected-message", `Unexpected message: ${message.type}`);
    }
  }

  private handleHello(message: HelloMessage): void {
    const session = this.registry.get(message.sessionId);
    if (!session) {
      this.sendError("unknown-session", "Unknown whiteboard session");
      this.connection.close(1008, "Unknown session");
      return;
    }

    if (session.connection && session.connection !== this.connection) {
      session.connection.close(1000, "Replaced by reconnecting whiteboard");
    }

    this.session = session;
    session.attach(this.connection);
    this.send({
      type: "welcome",
      protocolVersion: BOARD_PROTOCOL_VERSION,
      sessionId: session.sessionId,
    });
    this.send({
      type: "get-state",
      requestId: randomUUID(),
    });
  }

  private handleState(message: StateMessage): void {
    if (!this.session) {
      this.sendError("handshake-required", "Complete the handshake first");
      return;
    }

    this.session.boardState = message.state;
    this.send({
      type: "state-ack",
      requestId: message.requestId,
      snapshotId: message.snapshotId,
    });
  }

  private handleClose(): void {
    if (this.session) {
      this.session.detach(this.connection);
      this.session = null;
    }
  }

  private send(message: BoardMessage): void {
    if (this.connection.readyState === WebSocket.OPEN) {
      this.connection.send(encodeMessage(message));
    }
  }

  private sendError(code: string, message: string): void {
    this.send({ type: "error", code, message });
  }
}
