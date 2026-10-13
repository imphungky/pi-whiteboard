import { BoardSessionRegistry } from "./BoardSessionRegistry.js";
import { PiWhiteboardServer } from "./PiWhiteboardServer.js";
import { WhiteboardLauncher } from "./WhiteboardLauncher.js";

export type PiExtensionApi = {
  registerCommand(
    name: string,
    options: {
      description: string;
      handler: (args: string, context: { ui: { notify(message: string, level: "info" | "error"): void } }) => Promise<void>;
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
    handler: async (_args, context) => {
      try {
        const { session } = await launcher.launch();
        context.ui.notify(
          `Whiteboard session ${session.sessionId} launched`,
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
