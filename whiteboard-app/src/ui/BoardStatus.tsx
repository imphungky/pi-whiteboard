import { useCallback, useSyncExternalStore } from "react";
import type { BoardSession } from "../board";

export type BoardStatusProps = {
  session: BoardSession;
  apiReady: boolean;
  loadError?: string | null;
};

export function BoardStatus({ session, apiReady, loadError }: BoardStatusProps) {
  const subscribe = useCallback(
    (listener: () => void) => session.subscribe(listener),
    [session],
  );
  const saveStatus = useSyncExternalStore(
    subscribe,
    () => session.status,
    () => "idle",
  );

  return (
    <header className="app-status" aria-label="Board status">
      <strong>Pi Whiteboard</strong>
      <span>{apiReady ? "Board ready" : "Starting board…"}</span>
      {loadError && <span role="alert">Loaded empty board: {loadError}</span>}
      {saveStatus === "saving" && <span>Saving…</span>}
      {saveStatus === "saved" && <span>Saved locally</span>}
      {saveStatus === "error" && <span role="alert">Could not save locally</span>}
    </header>
  );
}
