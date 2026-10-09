import { describe, expect, it } from "vitest";
import { emptyBoardState } from "../board/BoardState";
import {
  BOARD_STORAGE_KEY,
  LocalStorageBoardPersistence,
} from "./LocalStorageBoardPersistence";

function createStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => values.delete(key),
    setItem: (key, value) => values.set(key, value),
  };
}

describe("LocalStorageBoardPersistence", () => {
  it("returns no board when nothing has been saved", async () => {
    const persistence = new LocalStorageBoardPersistence(createStorage());

    await expect(persistence.load()).resolves.toBeNull();
  });

  it("restores the board that was saved", async () => {
    const persistence = new LocalStorageBoardPersistence(createStorage());
    const state = emptyBoardState();

    await persistence.save(state);

    await expect(persistence.load()).resolves.toEqual(state);
  });

  it("uses the board storage key", async () => {
    const storage = createStorage();
    const persistence = new LocalStorageBoardPersistence(storage);

    await persistence.save(emptyBoardState());

    expect(storage.getItem(BOARD_STORAGE_KEY)).toBeTruthy();
  });

  it("starts clean when saved data is corrupt", async () => {
    const storage = createStorage();
    storage.setItem(BOARD_STORAGE_KEY, "not-json");

    const persistence = new LocalStorageBoardPersistence(storage);

    await expect(persistence.load()).resolves.toBeNull();
  });
});
