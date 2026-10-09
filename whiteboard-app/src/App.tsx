import { useEffect, useRef, useState } from "react";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import { BoardSession, ExcalidrawBoard } from "./board";
import { LocalStorageBoardPersistence } from "./persistence";
import { BoardStatus } from "./ui";

export function App() {
  const [apiReady, setApiReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const sessionRef = useRef<BoardSession | null>(null);

  if (!sessionRef.current) {
    sessionRef.current = new BoardSession({
      persistence: new LocalStorageBoardPersistence(),
    });
  }

  useEffect(() => {
    void sessionRef.current!.start().catch((error: unknown) => {
      // BoardSession exposes the error status; this message is for the startup UI.
      setLoadError(
        error instanceof Error ? error.message : "Unable to load the board",
      );
    });
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
      <section className="board" aria-label="Whiteboard">
        <ExcalidrawBoard
          session={sessionRef.current}
          onApiReady={handleApiReady}
        />
      </section>
    </main>
  );
}
