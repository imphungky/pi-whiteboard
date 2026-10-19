import { randomUUID } from "node:crypto";
import type { WebSocket } from "ws";
import type { SerializedBoardState } from "../../shared/board-protocol/src/index.js";
import {
  JsonProjectSessionStore,
  projectKey,
  type ProjectSessionStore,
  type WhiteboardSessionMetadata,
} from "./ProjectSessionStore.js";

export type PiBoardSessionStatus = "created" | "connected" | "disconnected";

export class PiBoardSession {
  readonly sessionId: string;
  readonly projectRoot: string;
  readonly projectKey: string;
  readonly metadata: WhiteboardSessionMetadata;
  boardState: SerializedBoardState | null = null;
  boardAvailability: "available" | "missing" | "unavailable" | null = null;
  status: PiBoardSessionStatus = "created";
  connection: WebSocket | null = null;

  constructor(projectRoot: string, metadata: WhiteboardSessionMetadata) {
    this.sessionId = metadata.id;
    this.projectRoot = projectRoot;
    this.projectKey = projectKey(projectRoot);
    this.metadata = metadata;
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
  sessionStore?: ProjectSessionStore;
};

export class BoardSessionRegistry {
  private readonly sessions = new Map<string, PiBoardSession>();
  private readonly createSessionId: () => string;
  private readonly sessionStore: ProjectSessionStore;

  constructor(dependencies: BoardSessionRegistryDependencies = {}) {
    this.createSessionId = dependencies.createSessionId ?? randomUUID;
    this.sessionStore = dependencies.sessionStore ?? new JsonProjectSessionStore();
  }

  async getOrCreateDefault(projectRoot: string): Promise<PiBoardSession> {
    const metadata = await this.sessionStore.getOrCreateDefault(projectRoot);
    const key = this.sessionKey(projectRoot, metadata.id);
    const existing = this.sessions.get(key);
    if (existing) {
      return existing;
    }

    const session = new PiBoardSession(projectRoot, metadata);
    this.sessions.set(key, session);
    return session;
  }

  async open(projectRoot: string, sessionId: string): Promise<PiBoardSession | null> {
    const metadata = await this.sessionStore.get(projectRoot, sessionId);
    if (!metadata) {
      return null;
    }

    const key = this.sessionKey(projectRoot, sessionId);
    const existing = this.sessions.get(key);
    if (existing) {
      return existing;
    }

    const session = new PiBoardSession(projectRoot, metadata);
    this.sessions.set(key, session);
    return session;
  }

  async list(projectRoot: string): Promise<WhiteboardSessionMetadata[]> {
    return this.sessionStore.list(projectRoot);
  }

  async updateLastOpened(session: PiBoardSession): Promise<void> {
    await this.sessionStore.update(session.projectRoot, {
      ...session.metadata,
      lastOpenedAt: new Date().toISOString(),
    });
  }

  async create(projectRoot: string, sessionId = this.createSessionId()): Promise<PiBoardSession> {
    const existingMetadata = await this.sessionStore.list(projectRoot);
    let id = sessionId;
    while (
      existingMetadata.some((session) => session.id === id) ||
      this.sessions.has(this.sessionKey(projectRoot, id))
    ) {
      id = this.createSessionId();
    }

    const now = new Date().toISOString();
    const metadata: WhiteboardSessionMetadata = {
      id,
      title: id === "default" ? "Project board" : id,
      createdAt: now,
      lastOpenedAt: now,
    };
    await this.sessionStore.create(projectRoot, metadata);
    const session = new PiBoardSession(projectRoot, metadata);
    this.sessions.set(this.sessionKey(projectRoot, id), session);
    return session;
  }

  get(projectRoot: string, sessionId: string): PiBoardSession | undefined {
    return this.sessions.get(this.sessionKey(projectRoot, sessionId));
  }

  getByProjectKey(projectKeyValue: string, sessionId: string): PiBoardSession | undefined {
    return this.sessions.get(`${projectKeyValue}:${sessionId}`);
  }

  remove(projectRoot: string, sessionId: string): boolean {
    return this.sessions.delete(this.sessionKey(projectRoot, sessionId));
  }

  values(): IterableIterator<PiBoardSession> {
    return this.sessions.values();
  }

  private sessionKey(projectRoot: string, sessionId: string): string {
    return `${projectKey(projectRoot)}:${sessionId}`;
  }
}
