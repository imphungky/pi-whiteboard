import type { BoardPersistence } from "./BoardPersistence";
import type { BoardState } from "../board/BoardState";

export const BOARD_STORAGE_KEY = "pi-whiteboard:board";

export class LocalStorageBoardPersistence implements BoardPersistence {
  constructor(
    private readonly storage: Storage = window.localStorage,
    private readonly key = BOARD_STORAGE_KEY,
  ) {}

  async load(): Promise<BoardState | null> {
    const raw = this.storage.getItem(this.key);
    if (!raw) {
      return null;
    }

    try {
      return normalizeBoardState(JSON.parse(raw) as BoardState);
    } catch {
      return null;
    }
  }

  async save(state: BoardState): Promise<void> {
    this.storage.setItem(this.key, JSON.stringify(normalizeBoardState(state)));
  }
}

/**
 * Excalidraw's collaborators value is a Map at runtime. JSON turns it into
 * an object, which causes Excalidraw to crash while restoring the scene.
 * Leave it out and let Excalidraw supply its normal empty Map.
 */
function normalizeBoardState(state: BoardState): BoardState {
  if (!state.appState || state.appState.collaborators instanceof Map) {
    if (!state.appState) {
      return state;
    }

    const { collaborators: _collaborators, ...appState } = state.appState;
    return { ...state, appState };
  }

  const { collaborators: _collaborators, ...appState } = state.appState;
  return { ...state, appState };
}
