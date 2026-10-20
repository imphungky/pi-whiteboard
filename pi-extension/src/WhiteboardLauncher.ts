import { spawn } from "node:child_process";
import { BoardSessionRegistry, type PiBoardSession } from "./BoardSessionRegistry.js";

export type BrowserLauncher = (url: string) => Promise<void> | void;

export interface PiServer {
  start(): Promise<string>;
  httpUrl?: string | null;
}

export type WhiteboardLauncherOptions = {
  whiteboardUrl?: string;
  openBrowser?: BrowserLauncher;
};

export class WhiteboardLauncher {
  private readonly openBrowser: BrowserLauncher;

  constructor(
    private readonly registry: BoardSessionRegistry,
    private readonly server: PiServer,
    private readonly options: WhiteboardLauncherOptions,
  ) {
    this.openBrowser = options.openBrowser ?? openBrowser;
  }

  async launch(projectRoot: string): Promise<{ session: PiBoardSession; url: string }> {
    const session = await this.registry.getOrCreateDefault(projectRoot);
    return this.openSession(session);
  }

  async launchSession(
    projectRoot: string,
    sessionId: string,
  ): Promise<{ session: PiBoardSession; url: string }> {
    const session = await this.registry.open(projectRoot, sessionId);
    if (!session) {
      throw new Error(`Unknown whiteboard session: ${sessionId}`);
    }
    return this.openSession(session);
  }

  async createSession(projectRoot: string): Promise<{ session: PiBoardSession; url: string }> {
    const session = await this.registry.create(projectRoot);
    return this.openSession(session);
  }

  private async openSession(
    session: PiBoardSession,
  ): Promise<{ session: PiBoardSession; url: string }> {
    await this.registry.updateLastOpened(session);
    const websocketUrl = await this.server.start();
    const url = this.buildLaunchUrl(websocketUrl, session.projectKey, session.sessionId);
    await this.openBrowser(url);
    return { session, url };
  }

  buildLaunchUrl(websocketUrl: string, projectId: string, sessionId: string): string {
    const whiteboardUrl = this.options.whiteboardUrl ?? this.server.httpUrl;
    if (!whiteboardUrl) {
      throw new Error("Whiteboard URL is not available");
    }
    const url = new URL(whiteboardUrl);
    url.searchParams.set("ws", websocketUrl);
    url.searchParams.set("project", projectId);
    url.searchParams.set("session", sessionId);
    return url.toString();
  }
}

export function openBrowser(url: string): Promise<void> {
  // Use the Windows URL handler directly. Routing the URL through `cmd /c
  // start` can interpret ampersands in query parameters as shell separators.
  const command = process.platform === "win32" ? "rundll32.exe" : process.platform === "darwin" ? "open" : "xdg-open";
  const args = process.platform === "win32" ? ["url.dll,FileProtocolHandler", url] : [url];

  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      detached: true,
      stdio: "ignore",
      windowsHide: true,
    });
    child.once("error", reject);
    child.once("spawn", () => {
      child.unref();
      resolve();
    });
  });
}
