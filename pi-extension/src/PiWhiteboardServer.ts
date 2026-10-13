import { createReadStream, existsSync, readFileSync, statSync } from "node:fs";
import { createServer, type Server as HttpServer, type ServerResponse } from "node:http";
import { fileURLToPath } from "node:url";
import { dirname, extname, join, normalize, parse, relative, resolve } from "node:path";
import { WebSocketServer, type Server as WebSocketServerType } from "ws";
import type { AddressInfo } from "node:net";
import { BoardSessionRegistry } from "./BoardSessionRegistry.js";
import { PiConnectionHandler } from "./PiConnectionHandler.js";

export type PiWhiteboardServerOptions = {
  host?: string;
  port?: number;
  webRoot?: string;
};

type PiWhiteboardManifest = {
  piWhiteboard?: {
    webRoot?: string;
  };
};

export class PiWhiteboardServer {
  private httpServer: HttpServer | null = null;
  private websocketServer: WebSocketServerType | null = null;
  private readonly host: string;
  private readonly port: number;

  private readonly options: Required<Pick<PiWhiteboardServerOptions, "webRoot">> & PiWhiteboardServerOptions;

  constructor(
    private readonly registry: BoardSessionRegistry,
    options: PiWhiteboardServerOptions = {},
  ) {
    this.host = options.host ?? "127.0.0.1";
    this.port = options.port ?? 0;
    this.options = {
      ...options,
      webRoot:
        process.env.PI_WHITEBOARD_WEB_ROOT ??
        options.webRoot ??
        resolvePackageWebRoot(),
    };
  }

  get httpUrl(): string | null {
    const address = this.address;
    return address ? `http://${address.host}:${address.port}` : null;
  }

  get websocketUrl(): string | null {
    const address = this.address;
    return address ? `ws://${address.host}:${address.port}` : null;
  }

  async start(): Promise<string> {
    if (this.httpServer && this.websocketServer) {
      return this.websocketUrl!;
    }

    const httpServer = createServer((request, response) => {
      this.serveFile(request.url ?? "/", response);
    });
    const websocketServer = new WebSocketServer({ server: httpServer });
    websocketServer.on("connection", (connection) => {
      new PiConnectionHandler(connection, this.registry);
    });

    this.httpServer = httpServer;
    this.websocketServer = websocketServer;

    await new Promise<void>((resolveStart, reject) => {
      const onError = (error: Error) => {
        httpServer.off("listening", onListening);
        reject(error);
      };
      const onListening = () => {
        httpServer.off("error", onError);
        resolveStart();
      };
      httpServer.once("error", onError);
      httpServer.once("listening", onListening);
      httpServer.listen(this.port, this.host);
    });

    return this.websocketUrl!;
  }

  async stop(): Promise<void> {
    const httpServer = this.httpServer;
    const websocketServer = this.websocketServer;
    if (!httpServer || !websocketServer) {
      return;
    }

    this.httpServer = null;
    this.websocketServer = null;
    for (const connection of websocketServer.clients) {
      connection.close(1001, "Pi extension stopped");
    }
    websocketServer.close();
    await new Promise<void>((resolveStop) => httpServer.close(() => resolveStop()));
  }

  private get address(): { host: string; port: number } | null {
    const address = this.httpServer?.address();
    if (!address || typeof address === "string") {
      return null;
    }
    return { host: this.host, port: (address as AddressInfo).port };
  }

  private serveFile(requestUrl: string, response: ServerResponse): void {
    const requestedPath = decodeURIComponent(requestUrl.split("?", 1)[0] || "/");
    const candidate = requestedPath === "/" ? "/index.html" : requestedPath;
    const root = resolve(this.options.webRoot);
    const filePath = resolve(join(root, normalize(candidate)));
    const isWithinRoot = filePath === root || relative(root, filePath).split(/[\\/]/).every((part) => part !== "..");
    const target = isWithinRoot && existsSync(filePath) && statSync(filePath).isFile() ? filePath : join(root, "index.html");

    if (!isWithinRoot || !existsSync(target) || !statSync(target).isFile()) {
      response.statusCode = 404;
      response.end("Not found");
      return;
    }

    response.setHeader("Content-Type", contentType(extname(target)));
    createReadStream(target).pipe(response);
  }
}

function resolvePackageWebRoot(): string {
  const moduleDirectory = dirname(fileURLToPath(import.meta.url));
  let directory = moduleDirectory;
  const filesystemRoot = parse(directory).root;

  while (directory !== filesystemRoot) {
    const packageJsonPath = join(directory, "package.json");
    if (existsSync(packageJsonPath)) {
      const manifest = JSON.parse(
        readFileSync(packageJsonPath, "utf8"),
      ) as PiWhiteboardManifest;
      const webRoot = manifest.piWhiteboard?.webRoot;
      if (!webRoot) {
        throw new Error("piWhiteboard.webRoot is missing from package.json");
      }
      return resolve(directory, webRoot);
    }
    directory = resolve(directory, "..");
  }

  throw new Error("Unable to locate the Pi Whiteboard package.json");
}

function contentType(extension: string): string {
  switch (extension) {
    case ".html": return "text/html; charset=utf-8";
    case ".js": return "text/javascript; charset=utf-8";
    case ".css": return "text/css; charset=utf-8";
    case ".svg": return "image/svg+xml";
    case ".woff": return "font/woff";
    case ".woff2": return "font/woff2";
    default: return "application/octet-stream";
  }
}
