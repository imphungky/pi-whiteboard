import { memo, useCallback, useSyncExternalStore } from "react";
import { Excalidraw } from "@excalidraw/excalidraw";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import type { BoardSession } from "./BoardSession";
import type { BoardState } from "./BoardState";

export type ExcalidrawBoardProps = {
  session: BoardSession;
  onApiReady?: (api: ExcalidrawImperativeAPI) => void;
};

export const ExcalidrawBoard = memo(function ExcalidrawBoard({
  session,
  onApiReady,
}: ExcalidrawBoardProps) {
  const subscribe = useCallback(
    (listener: () => void) => session.subscribeState(listener),
    [session],
  );
  const state = useSyncExternalStore(
    subscribe,
    () => session.state,
    () => null,
  );

  const handleApiReady = useCallback(
    (api: ExcalidrawImperativeAPI) => {
      onApiReady?.(api);
    },
    [onApiReady],
  );

  const handleChange = useCallback(
    (
      elements: BoardState["elements"],
      appState: BoardState["appState"],
      files: BoardState["files"],
    ) => {
      void session.handleLocalSceneChange({ elements, appState, files });
    },
    [session],
  );

  if (!state) {
    return <main className="loading">Loading board…</main>;
  }

  return (
    <Excalidraw
      initialData={state}
      viewModeEnabled={false}
      excalidrawAPI={handleApiReady}
      onChange={handleChange}
    />
  );
});
