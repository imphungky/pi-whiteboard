import type { BoardMessage } from "./BoardMessage";

export interface BoardTransport {
  connect(): void;
  disconnect(): void;
  send(message: BoardMessage): void;
  onMessage(listener: (message: BoardMessage) => void): () => void;
}
