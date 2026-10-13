import { emptyBoardState, type BoardState } from "../board/BoardState";
import type { BoardSession } from "../board/BoardSession";
import type {
  BoardMessage,
  GetStateMessage,
  StateAckMessage,
  StateMessage,
} from "../protocol";
import type {
  BoardTransport,
  TransportStatus,
} from "./BoardTransport";

export type CommunicationStatus =
  | "disconnected"
  | "connecting"
  | "ready"
  | "reconnecting"
  | "error";

export type BoardCommunicationDependencies = {
  connection: BoardTransport;
  boardSession: BoardSession;
  sessionId: string;
};

type StatusListener = (status: CommunicationStatus) => void;

export class BoardCommunication {
  private currentStatus: CommunicationStatus = "disconnected";
  private running = false;
  private transportConnected = false;
  private latestSnapshotId: string | null = null;
  private pendingState: BoardState | null = null;
  private readonly statusListeners = new Set<StatusListener>();
  private unsubscribeMessages: (() => void) | null = null;
  private unsubscribeTransport: (() => void) | null = null;
  private unsubscribeBoard: (() => void) | null = null;

  constructor(private readonly dependencies: BoardCommunicationDependencies) {}

  get status(): CommunicationStatus {
    return this.currentStatus;
  }

  start(): void {
    if (this.running) {
      return;
    }

    this.running = true;
    this.unsubscribeMessages = this.dependencies.connection.onMessage((message) =>
      this.handleMessage(message),
    );
    this.unsubscribeTransport = this.dependencies.connection.onStatusChange(
      (status) => this.handleTransportStatus(status),
    );
    this.unsubscribeBoard = this.dependencies.boardSession.subscribeState(
      (state) => this.handleLocalStateChange(state),
    );
    this.setStatus("connecting");
    this.dependencies.connection.connect();
  }

  stop(): void {
    if (!this.running) {
      return;
    }

    this.running = false;
    this.unsubscribeMessages?.();
    this.unsubscribeTransport?.();
    this.unsubscribeBoard?.();
    this.unsubscribeMessages = null;
    this.unsubscribeTransport = null;
    this.unsubscribeBoard = null;
    this.dependencies.connection.disconnect();
    this.transportConnected = false;
    this.setStatus("disconnected");
  }

  subscribeStatus(listener: StatusListener): () => void {
    this.statusListeners.add(listener);
    return () => this.statusListeners.delete(listener);
  }

  handleMessage(message: BoardMessage): void {
    switch (message.type) {
      case "welcome":
        this.handleWelcome(message.sessionId);
        return;
      case "get-state":
        this.handleGetState(message);
        return;
      case "state-ack":
        this.handleStateAck(message);
        return;
      case "error":
        this.setStatus("error");
        return;
      case "hello":
      case "state":
        return;
    }
  }

  handleTransportStatus(status: TransportStatus): void {
    switch (status) {
      case "connected":
        this.transportConnected = true;
        this.setStatus("connecting");
        this.sendHello();
        return;
      case "connecting":
        this.transportConnected = false;
        this.setStatus("connecting");
        return;
      case "reconnecting":
        this.transportConnected = false;
        this.setStatus("reconnecting");
        return;
      case "error":
        this.transportConnected = false;
        this.setStatus("error");
        return;
      case "disconnected":
        this.transportConnected = false;
        this.setStatus(this.running ? "reconnecting" : "disconnected");
        return;
    }
  }

  handleLocalStateChange(state: BoardState): void {
    this.pendingState = state;
    if (this.transportConnected && this.currentStatus === "ready") {
      this.sendState(state);
    }
  }

  private handleWelcome(sessionId: string): void {
    const expectedSessionId = this.dependencies.sessionId;
    if (expectedSessionId && sessionId !== expectedSessionId) {
      this.setStatus("error");
      return;
    }
    this.setStatus("connecting");
  }

  private handleGetState(message: GetStateMessage): void {
    const state = this.pendingState ?? this.dependencies.boardSession.state ?? emptyBoardState();
    this.sendState(state, message.requestId);
  }

  private handleStateAck(message: StateAckMessage): void {
    if (this.latestSnapshotId !== message.snapshotId) {
      return;
    }
    this.pendingState = null;
    this.setStatus("ready");
  }

  private sendHello(): void {
    this.dependencies.connection.send({
      type: "hello",
      protocolVersion: 1,
      client: "whiteboard",
      sessionId: this.dependencies.sessionId,
    });
  }

  private sendState(state: BoardState, requestId = createId()): void {
    if (!this.transportConnected) {
      return;
    }

    const snapshotId = createId();
    this.latestSnapshotId = snapshotId;
    this.dependencies.connection.send({
      type: "state",
      requestId,
      snapshotId,
      state,
    });
  }

  private setStatus(status: CommunicationStatus): void {
    if (this.currentStatus === status) {
      return;
    }
    this.currentStatus = status;
    for (const listener of this.statusListeners) {
      listener(status);
    }
  }
}

function createId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
