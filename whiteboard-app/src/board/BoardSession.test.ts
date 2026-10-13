import { describe, expect, it } from "vitest";
import { BoardSession, type BoardCanvas } from "./BoardSession";
import { emptyBoardState, type BoardState } from "./BoardState";
import type { BoardPersistence } from "../persistence/BoardPersistence";

class FakePersistence implements BoardPersistence {
  saved: BoardState[] = [];

  constructor(private readonly existing: BoardState | null = null) {}

  async load() {
    return this.existing;
  }

  async save(state: BoardState) {
    this.saved.push(state);
  }
}

class FakeCanvas implements BoardCanvas {
  displayed: BoardState[] = [];

  display(state: BoardState) {
    this.displayed.push(state);
  }
}

describe("BoardSession", () => {
  it("starts with an empty board when nothing was saved", async () => {
    const persistence = new FakePersistence();
    const canvas = new FakeCanvas();
    const session = new BoardSession({ persistence, canvas });

    const state = await session.start();

    expect(state).toEqual(emptyBoardState());
    expect(canvas.displayed).toEqual([emptyBoardState()]);
  });

  it("restores a saved board when it starts", async () => {
    const savedState = { elements: [] };
    const persistence = new FakePersistence(savedState);
    const canvas = new FakeCanvas();
    const session = new BoardSession({ persistence, canvas });

    await session.start();

    expect(canvas.displayed).toEqual([savedState]);
    expect(session.state).toEqual(savedState);
  });

  it("saves a local scene change and notifies state listeners", async () => {
    const persistence = new FakePersistence();
    const canvas = new FakeCanvas();
    const session = new BoardSession({ persistence, canvas });
    const changedState = { elements: [] };
    const observed: BoardState[] = [];
    session.subscribeState((state) => observed.push(state));

    await session.handleLocalSceneChange(changedState);

    expect(session.state).toEqual(changedState);
    expect(persistence.saved).toEqual([changedState]);
    expect(observed).toEqual([changedState]);
  });

  it("displays and saves a remote scene change", async () => {
    const persistence = new FakePersistence();
    const canvas = new FakeCanvas();
    const session = new BoardSession({ persistence, canvas });
    const remoteState = { elements: [] };

    await session.handleRemoteScene(remoteState);

    expect(session.state).toEqual(remoteState);
    expect(canvas.displayed).toEqual([remoteState]);
    expect(persistence.saved).toEqual([remoteState]);
  });
});
