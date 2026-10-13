import type { BoardMessage } from "../protocol";

export type TransportStatus =
  | "disconnected"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "error";

export interface BoardTransport {
  connect(): void;
  disconnect(): void;
  send(message: BoardMessage): void;
  onMessage(listener: (message: BoardMessage) => void): () => void;
  onStatusChange(listener: (status: TransportStatus) => void): () => void;
}
