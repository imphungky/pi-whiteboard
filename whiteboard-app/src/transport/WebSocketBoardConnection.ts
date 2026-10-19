import {
  ExponentialBackoff,
  WebsocketBuilder,
  WebsocketEvent,
  type Websocket,
} from "websocket-ts";
import {
  decodeMessage,
  encodeMessage,
  type BoardMessage,
} from "../protocol";
import type { BoardTransport, TransportStatus } from "./BoardTransport";

export type WebSocketConnectionConfig = {
  websocketUrl: string;
  projectKey: string;
  sessionId: string;
};

type WebsocketFactory = (
  config: WebSocketConnectionConfig,
  handlers: WebsocketHandlers,
) => Websocket;

type WebsocketHandlers = {
  onOpen: () => void;
  onClose: () => void;
  onError: () => void;
  onRetry: () => void;
  onReconnect: () => void;
  onExhausted: () => void;
  onMessage: (data: unknown) => void;
};

export class WebSocketBoardConnection implements BoardTransport {
  private socket: Websocket | null = null;
  private intentionallyClosed = false;
  private currentStatus: TransportStatus = "disconnected";
  private readonly messageListeners = new Set<(message: BoardMessage) => void>();
  private readonly statusListeners = new Set<(status: TransportStatus) => void>();

  constructor(
    readonly config: WebSocketConnectionConfig,
    private readonly createSocket: WebsocketFactory = createWebsocket,
  ) {}

  static fromLocation(
    location: Pick<Location, "search">,
    createSocket?: WebsocketFactory,
  ): WebSocketBoardConnection | null {
    const config = readWebSocketConfig(location.search);
    return config
      ? new WebSocketBoardConnection(config, createSocket)
      : null;
  }

  connect(): void {
    if (this.socket !== null) {
      return;
    }

    this.intentionallyClosed = false;
    this.setStatus("connecting");
    this.socket = this.createSocket(this.config, {
      onOpen: () => this.setStatus("connected"),
      onClose: () => {
        if (!this.intentionallyClosed) {
          this.setStatus("reconnecting");
        }
      },
      onError: () => this.setStatus("error"),
      onRetry: () => this.setStatus("reconnecting"),
      onReconnect: () => this.setStatus("connected"),
      onExhausted: () => {
        this.socket = null;
        this.setStatus("error");
      },
      onMessage: (data) => this.handleMessage(data),
    });
  }

  disconnect(): void {
    this.intentionallyClosed = true;
    this.socket?.close();
    this.socket = null;
    this.setStatus("disconnected");
  }

  send(message: BoardMessage): void {
    if (this.socket === null) {
      throw new Error("Cannot send a board message while disconnected");
    }
    this.socket.send(encodeMessage(message));
  }

  onMessage(listener: (message: BoardMessage) => void): () => void {
    this.messageListeners.add(listener);
    return () => this.messageListeners.delete(listener);
  }

  onStatusChange(listener: (status: TransportStatus) => void): () => void {
    this.statusListeners.add(listener);
    return () => this.statusListeners.delete(listener);
  }

  private handleMessage(data: unknown): void {
    if (typeof data !== "string") {
      this.setStatus("error");
      return;
    }

    try {
      const message = decodeMessage(data);
      for (const listener of this.messageListeners) {
        listener(message);
      }
    } catch {
      this.setStatus("error");
    }
  }

  private setStatus(status: TransportStatus): void {
    if (this.currentStatus === status) {
      return;
    }
    this.currentStatus = status;
    for (const listener of this.statusListeners) {
      listener(status);
    }
  }
}

export function readWebSocketConfig(
  search: string,
): WebSocketConnectionConfig | null {
  const params = new URLSearchParams(search);
  const websocketUrl = params.get("ws");
  const projectKey = params.get("project");
  const sessionId = params.get("session");

  if (!websocketUrl || !projectKey || !sessionId) {
    return null;
  }

  try {
    const parsedUrl = new URL(websocketUrl);
    if (parsedUrl.protocol !== "ws:" && parsedUrl.protocol !== "wss:") {
      return null;
    }
  } catch {
    return null;
  }

  return { websocketUrl, projectKey, sessionId };
}

function createWebsocket(
  config: WebSocketConnectionConfig,
  handlers: WebsocketHandlers,
): Websocket {
  return new WebsocketBuilder(config.websocketUrl)
    .withBackoff(new ExponentialBackoff(500, 6))
    .withMaxRetries(Infinity)
    .onOpen(() => handlers.onOpen())
    .onClose(() => handlers.onClose())
    .onError(() => handlers.onError())
    .onRetry(() => handlers.onRetry())
    .onReconnect(() => handlers.onReconnect())
    .onExhausted(() => handlers.onExhausted())
    .onMessage((_, event) => handlers.onMessage(event.data))
    .build();
}
