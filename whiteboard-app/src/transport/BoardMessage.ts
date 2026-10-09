import type { BoardState } from "../board/BoardState";

export type BoardMessage =
  | { type: "ping" }
  | { type: "pong" }
  | { type: "replace-scene"; state: BoardState };
