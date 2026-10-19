import { useEffect, useRef, useState } from "react";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import { BoardSession, ExcalidrawBoard } from "./board";
import { boardStorageKey, LocalStorageBoardPersistence } from "./persistence";
import {
  BoardCommunication,
  readWebSocketConfig,
  WebSocketBoardConnection,
} from "./transport";
import { BoardStatus, CommunicationStatus } from "./ui";

export function App() {
  const [apiReady, setApiReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [communication, setCommunication] =
    useState<BoardCommunication | null>(null);
  const sessionRef = useRef<BoardSession | null>(null);
  const launchConfig = readWebSocketConfig(window.location.search);

  if (!sessionRef.current) {
    const persistence = launchConfig
      ? new LocalStorageBoardPersistence(
          window.localStorage,
          boardStorageKey(launchConfig.projectKey, launchConfig.sessionId),
        )
      : new LocalStorageBoardPersistence();
    sessionRef.current = new BoardSession({ persistence });
  }

  useEffect(() => {
    let disposed = false;
    let activeCommunication: BoardCommunication | null = null;

    const start = async () => {
      try {
        await sessionRef.current!.start();

        if (disposed) {
          return;
        }

        const connection = WebSocketBoardConnection.fromLocation(window.location);
        if (!connection) {
          return;
        }

        activeCommunication = new BoardCommunication({
          connection,
          boardSession: sessionRef.current!,
          projectKey: connection.config.projectKey,
          sessionId: connection.config.sessionId,
        });
        setCommunication(activeCommunication);
        activeCommunication.start();
      } catch (error: unknown) {
        // BoardSession exposes the error status; this message is for the startup UI.
        setLoadError(
          error instanceof Error ? error.message : "Unable to load the board",
        );
      }
    };

    void start();
    return () => {
      disposed = true;
      activeCommunication?.stop();
    };
  }, []);

  const handleApiReady = (_api: ExcalidrawImperativeAPI) => {
    setApiReady(true);
  };

  return (
    <main className="app-shell">
      <BoardStatus
        session={sessionRef.current}
        apiReady={apiReady}
        loadError={loadError}
      />
      <CommunicationStatus communication={communication} />
      <section className="board" aria-label="Whiteboard">
        <ExcalidrawBoard
          session={sessionRef.current}
          onApiReady={handleApiReady}
        />
      </section>
    </main>
  );
}
