import { BoardSessionRegistry } from "./BoardSessionRegistry.js";
import { PiWhiteboardServer } from "./PiWhiteboardServer.js";
import { WhiteboardLauncher } from "./WhiteboardLauncher.js";

export type PiExtensionApi = {
  registerCommand(
    name: string,
    options: {
      description: string;
      handler: (
        args: string,
        context: {
          cwd: string;
          ui: { notify(message: string, level: "info" | "error"): void };
        },
      ) => Promise<void>;
    },
  ): void;
  on(event: "session_shutdown", handler: () => Promise<void>): void;
};

export default function piWhiteboardExtension(pi: PiExtensionApi): void {
  const registry = new BoardSessionRegistry();
  const server = new PiWhiteboardServer(registry);
  const launcher = new WhiteboardLauncher(registry, server, {
    whiteboardUrl: process.env.PI_WHITEBOARD_URL,
  });

  pi.registerCommand("whiteboard", {
    description: "Launch a Pi-connected whiteboard",
    handler: async (args, context) => {
      try {
        const command = parseWhiteboardCommand(args);
        if (command.type === "list") {
          const sessions = await registry.list(context.cwd);
          context.ui.notify(
            formatSessionList(sessions, (sessionId) =>
              registry.get(context.cwd, sessionId)?.status === "connected"
                ? "active"
                : "inactive",
            ),
            "info",
          );
          return;
        }

        const result = command.type === "default"
          ? await launcher.launch(context.cwd)
          : command.type === "create"
            ? await launcher.createSession(context.cwd)
            : await launcher.launchSession(context.cwd, command.sessionId);

        context.ui.notify(
          `Whiteboard session ${result.session.sessionId} launched`,
          "info",
        );
      } catch (error) {
        context.ui.notify(
          error instanceof Error ? error.message : "Unable to launch whiteboard",
          "error",
        );
      }
    },
  });

  pi.on("session_shutdown", async () => {
    await server.stop();
  });
}

type WhiteboardCommand =
  | { type: "default" }
  | { type: "list" }
  | { type: "create" }
  | { type: "open"; sessionId: string };

export function parseWhiteboardCommand(args: string): WhiteboardCommand {
  const value = args.trim();
  if (!value) {
    return { type: "default" };
  }
  if (value === "list") {
    return { type: "list" };
  }
  if (value === "new") {
    return { type: "create" };
  }
  if (/^\S+$/.test(value)) {
    return { type: "open", sessionId: value };
  }
  throw new Error("Usage: whiteboard [list|new|session-id]");
}

function formatSessionList(
  sessions: readonly { id: string; title: string }[],
  getStatus: (sessionId: string) => "active" | "inactive",
): string {
  if (sessions.length === 0) {
    return "No whiteboard sessions found for this project";
  }

  return [
    "Whiteboards for this project:",
    ...sessions.map(
      (session) => `- ${session.id}: ${session.title} (${getStatus(session.id)})`,
    ),
    "Open one with: whiteboard <session-id>",
  ].join("\n");
}
