import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

export type WhiteboardSessionMetadata = {
  id: string;
  title: string;
  createdAt: string;
  lastOpenedAt: string;
};

export interface ProjectSessionStore {
  getOrCreateDefault(projectRoot: string): Promise<WhiteboardSessionMetadata>;
  get(projectRoot: string, sessionId: string): Promise<WhiteboardSessionMetadata | null>;
  update(projectRoot: string, metadata: WhiteboardSessionMetadata): Promise<void>;
}

export class JsonProjectSessionStore implements ProjectSessionStore {
  async getOrCreateDefault(projectRoot: string): Promise<WhiteboardSessionMetadata> {
    const catalog = await this.load(projectRoot);
    const existing = catalog.sessions.find((session) => session.id === "default");
    if (existing) {
      return existing;
    }

    const now = new Date().toISOString();
    const session: WhiteboardSessionMetadata = {
      id: "default",
      title: "Project board",
      createdAt: now,
      lastOpenedAt: now,
    };
    catalog.sessions.push(session);
    await this.save(projectRoot, catalog);
    return session;
  }

  async get(projectRoot: string, sessionId: string): Promise<WhiteboardSessionMetadata | null> {
    const catalog = await this.load(projectRoot);
    return catalog.sessions.find((session) => session.id === sessionId) ?? null;
  }

  async update(projectRoot: string, metadata: WhiteboardSessionMetadata): Promise<void> {
    const catalog = await this.load(projectRoot);
    const index = catalog.sessions.findIndex((session) => session.id === metadata.id);
    if (index === -1) {
      catalog.sessions.push(metadata);
    } else {
      catalog.sessions[index] = metadata;
    }
    await this.save(projectRoot, catalog);
  }

  private async load(projectRoot: string): Promise<SessionCatalog> {
    try {
      const raw = await readFile(catalogPath(projectRoot), "utf8");
      const parsed: unknown = JSON.parse(raw);
      if (!isSessionCatalog(parsed)) {
        throw new Error("Invalid whiteboard session catalog");
      }
      return parsed;
    } catch (error: unknown) {
      if (isFileNotFound(error)) {
        return { version: 1, sessions: [] };
      }
      throw error;
    }
  }

  private async save(projectRoot: string, catalog: SessionCatalog): Promise<void> {
    const path = catalogPath(projectRoot);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, `${JSON.stringify(catalog, null, 2)}\n`, "utf8");
  }
}

export function projectKey(projectRoot: string): string {
  return createHash("sha256").update(projectRoot).digest("hex").slice(0, 16);
}

export function catalogPath(projectRoot: string): string {
  return join(projectRoot, ".pi", "whiteboard", "sessions.json");
}

type SessionCatalog = {
  version: 1;
  sessions: WhiteboardSessionMetadata[];
};

function isSessionCatalog(value: unknown): value is SessionCatalog {
  if (!isRecord(value) || value.version !== 1 || !Array.isArray(value.sessions)) {
    return false;
  }
  return value.sessions.every(isSessionMetadata);
}

function isSessionMetadata(value: unknown): value is WhiteboardSessionMetadata {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    value.id.length > 0 &&
    typeof value.title === "string" &&
    typeof value.createdAt === "string" &&
    typeof value.lastOpenedAt === "string"
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isFileNotFound(error: unknown): boolean {
  return isRecord(error) && error.code === "ENOENT";
}
