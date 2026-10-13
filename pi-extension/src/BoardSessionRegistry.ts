import { randomUUID } from "node:crypto";
import type { WebSocket } from "ws";
import type { SerializedBoardState } from "../../shared/board-protocol/src/index.js";

export type PiBoardSessionStatus = "created" | "connected" | "disconnected";

export class PiBoardSession {
  readonly sessionId: string;
  boardState: SerializedBoardState | null = null;
  status: PiBoardSessionStatus = "created";
  connection: WebSocket | null = null;

  constructor(sessionId: string) {
    this.sessionId = sessionId;
  }

  attach(connection: WebSocket): void {
    this.connection = connection;
    this.status = "connected";
  }

  detach(connection: WebSocket): void {
    if (this.connection !== connection) {
      return;
    }
    this.connection = null;
    this.status = "disconnected";
  }
}

export type BoardSessionRegistryDependencies = {
  createSessionId?: () => string;
};

export class BoardSessionRegistry {
  private readonly sessions = new Map<string, PiBoardSession>();
  private readonly createSessionId: () => string;

  constructor(dependencies: BoardSessionRegistryDependencies = {}) {
    this.createSessionId = dependencies.createSessionId ?? randomUUID;
  }

  create(): PiBoardSession {
    let sessionId = this.createSessionId();
    while (this.sessions.has(sessionId)) {
      sessionId = this.createSessionId();
    }

    const session = new PiBoardSession(sessionId);
    this.sessions.set(sessionId, session);
    return session;
  }

  get(sessionId: string): PiBoardSession | undefined {
    return this.sessions.get(sessionId);
  }

  remove(sessionId: string): boolean {
    return this.sessions.delete(sessionId);
  }

  values(): IterableIterator<PiBoardSession> {
    return this.sessions.values();
  }
}
