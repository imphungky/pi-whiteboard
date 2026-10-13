import { describe, expect, it } from "vitest";
import { BoardSession } from "../board/BoardSession";
import type { BoardState } from "../board/BoardState";
import type { BoardPersistence } from "../persistence/BoardPersistence";
import type { BoardMessage } from "../protocol";
import { BoardCommunication } from "./BoardCommunication";
import type { BoardTransport, TransportStatus } from "./BoardTransport";

class FakePersistence implements BoardPersistence {
  constructor(private readonly initialState: BoardState | null = null) {}

  async load() {
    return this.initialState;
  }

  async save() {}
}

class FakeTransport implements BoardTransport {
  sent: BoardMessage[] = [];
  private readonly messageListeners = new Set<(message: BoardMessage) => void>();
  private readonly statusListeners = new Set<(status: TransportStatus) => void>();

  connect() {
    this.emitStatus("connected");
  }

  disconnect() {
    this.emitStatus("disconnected");
  }

  send(message: BoardMessage) {
    this.sent.push(message);
  }

  onMessage(listener: (message: BoardMessage) => void) {
    this.messageListeners.add(listener);
    return () => this.messageListeners.delete(listener);
  }

  onStatusChange(listener: (status: TransportStatus) => void) {
    this.statusListeners.add(listener);
    return () => this.statusListeners.delete(listener);
  }

  emitMessage(message: BoardMessage) {
    for (const listener of this.messageListeners) {
      listener(message);
    }
  }

  emitStatus(status: TransportStatus) {
    for (const listener of this.statusListeners) {
      listener(status);
    }
  }
}

describe("BoardCommunication", () => {
  it("handshakes and synchronizes the current board state", async () => {
    const state = { elements: [] } satisfies BoardState;
    const session = new BoardSession({
      persistence: new FakePersistence(state),
    });
    await session.start();
    const transport = new FakeTransport();
    const communication = new BoardCommunication({
      connection: transport,
      boardSession: session,
      sessionId: "session-1",
    });

    communication.start();

    expect(transport.sent).toEqual([
      {
        type: "hello",
        protocolVersion: 1,
        client: "whiteboard",
        sessionId: "session-1",
      },
    ]);

    transport.emitMessage({
      type: "welcome",
      protocolVersion: 1,
      sessionId: "session-1",
    });
    transport.emitMessage({ type: "get-state", requestId: "request-1" });

    const stateMessage = transport.sent[1];
    expect(stateMessage).toMatchObject({
      type: "state",
      requestId: "request-1",
      state,
    });

    if (stateMessage.type !== "state") {
      throw new Error("Expected a state message");
    }

    transport.emitMessage({
      type: "state-ack",
      requestId: "request-1",
      snapshotId: stateMessage.snapshotId,
    });

    expect(communication.status).toBe("ready");
  });

  it("sends an accepted local state change after synchronization", async () => {
    const session = new BoardSession({
      persistence: new FakePersistence({ elements: [] }),
    });
    await session.start();
    const transport = new FakeTransport();
    const communication = new BoardCommunication({
      connection: transport,
      boardSession: session,
      sessionId: "session-1",
    });

    communication.start();
    transport.emitMessage({
      type: "welcome",
      protocolVersion: 1,
      sessionId: "session-1",
    });
    transport.emitMessage({ type: "get-state", requestId: "request-1" });
    const initialState = transport.sent[1];
    if (initialState.type !== "state") {
      throw new Error("Expected an initial state message");
    }
    transport.emitMessage({
      type: "state-ack",
      requestId: "request-1",
      snapshotId: initialState.snapshotId,
    });

    const changedState = { elements: [] } satisfies BoardState;
    await session.handleLocalSceneChange(changedState);

    expect(transport.sent[transport.sent.length - 1]).toMatchObject({
      type: "state",
      state: changedState,
    });
  });

  it("does not become ready for a different session", async () => {
    const session = new BoardSession({ persistence: new FakePersistence() });
    await session.start();
    const transport = new FakeTransport();
    const communication = new BoardCommunication({
      connection: transport,
      boardSession: session,
      sessionId: "session-1",
    });

    communication.start();
    transport.emitMessage({
      type: "welcome",
      protocolVersion: 1,
      sessionId: "session-2",
    });

    expect(communication.status).toBe("error");
  });
});
