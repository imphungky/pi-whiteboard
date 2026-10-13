import { WebSocketServer, type Server } from "ws";
import type { AddressInfo } from "node:net";
import { BoardSessionRegistry } from "./BoardSessionRegistry.js";
import { PiConnectionHandler } from "./PiConnectionHandler.js";

export type PiWebSocketServerOptions = {
  host?: string;
  port?: number;
};

export class PiWebSocketServer {
  private server: Server | null = null;
  private readonly host: string;
  private readonly port: number;

  constructor(
    private readonly registry: BoardSessionRegistry,
    options: PiWebSocketServerOptions = {},
  ) {
    this.host = options.host ?? "127.0.0.1";
    this.port = options.port ?? 0;
  }

  get address(): string | null {
    if (!this.server) {
      return null;
    }
    const address = this.server.address();
    if (!address || typeof address === "string") {
      return null;
    }
    return `ws://${this.host}:${(address as AddressInfo).port}`;
  }

  async start(): Promise<string> {
    if (this.server) {
      return this.address!;
    }

    const server = new WebSocketServer({
      host: this.host,
      port: this.port,
    });
    this.server = server;
    server.on("connection", (connection) => {
      new PiConnectionHandler(connection, this.registry);
    });

    await new Promise<void>((resolve, reject) => {
      const onError = (error: Error) => {
        server.off("listening", onListening);
        reject(error);
      };
      const onListening = () => {
        server.off("error", onError);
        resolve();
      };
      server.once("error", onError);
      server.once("listening", onListening);
    });

    return this.address!;
  }

  async stop(): Promise<void> {
    const server = this.server;
    if (!server) {
      return;
    }

    this.server = null;
    for (const connection of server.clients) {
      connection.close(1001, "Pi extension stopped");
    }

    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  }
}
