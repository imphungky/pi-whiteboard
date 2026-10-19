import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  catalogPath,
  JsonProjectSessionStore,
} from "../src/ProjectSessionStore.js";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

async function createProject(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "pi-whiteboard-project-"));
  temporaryDirectories.push(directory);
  return directory;
}

describe("JsonProjectSessionStore", () => {
  it("creates and persists the project default session", async () => {
    const projectRoot = await createProject();
    const store = new JsonProjectSessionStore();

    const session = await store.getOrCreateDefault(projectRoot);
    const restored = await store.getOrCreateDefault(projectRoot);

    expect(session.id).toBe("default");
    expect(restored).toEqual(session);
    expect(JSON.parse(await readFile(catalogPath(projectRoot), "utf8"))).toEqual({
      version: 1,
      sessions: [session],
    });
  });

  it("lists and creates additional project sessions", async () => {
    const projectRoot = await createProject();
    const store = new JsonProjectSessionStore();
    await store.getOrCreateDefault(projectRoot);

    await store.create(projectRoot, {
      id: "architecture",
      title: "Architecture",
      createdAt: "2025-01-01T00:00:00.000Z",
      lastOpenedAt: "2025-01-01T00:00:00.000Z",
    });

    expect((await store.list(projectRoot)).map((session) => session.id)).toEqual([
      "default",
      "architecture",
    ]);
  });

  it("updates existing metadata without duplicating the session", async () => {
    const projectRoot = await createProject();
    const store = new JsonProjectSessionStore();
    const session = await store.getOrCreateDefault(projectRoot);

    await store.update(projectRoot, { ...session, title: "Updated project board" });

    expect(await store.get(projectRoot, "default")).toMatchObject({
      id: "default",
      title: "Updated project board",
    });
  });

  it("keeps catalogs isolated by project root", async () => {
    const firstProject = await createProject();
    const secondProject = await createProject();
    const store = new JsonProjectSessionStore();

    await store.getOrCreateDefault(firstProject);

    expect(await store.get(secondProject, "default")).toBeNull();
  });
});
