import type { BoardState } from "../board/BoardState";

export interface BoardPersistence {
  load(): Promise<BoardState | null>;
  save(state: BoardState): Promise<void>;
}
