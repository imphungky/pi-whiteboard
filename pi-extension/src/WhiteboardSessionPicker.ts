import type { WhiteboardSessionMetadata } from "./ProjectSessionStore.js";

export type WhiteboardSessionPickerStatus = "active" | "inactive";

export type WhiteboardPickerAction =
  | { type: "open"; sessionId: string }
  | { type: "create" };

export interface WhiteboardPickerUI {
  select(title: string, options: string[]): Promise<string | undefined>;
}

const NEW_WHITEBOARD_OPTION = "New whiteboard";

export async function pickWhiteboardAction(
  ui: WhiteboardPickerUI,
  sessions: readonly WhiteboardSessionMetadata[],
  getStatus: (sessionId: string) => WhiteboardSessionPickerStatus,
): Promise<WhiteboardPickerAction | null> {
  const options = sessions.map((session) => formatSessionOption(session, getStatus(session.id)));
  options.push(NEW_WHITEBOARD_OPTION);

  const selected = await ui.select("Open whiteboard", options);
  if (selected === undefined) {
    return null;
  }
  if (selected === NEW_WHITEBOARD_OPTION) {
    return { type: "create" };
  }

  const session = sessions.find(
    (candidate) => formatSessionOption(candidate, getStatus(candidate.id)) === selected,
  );
  return session ? { type: "open", sessionId: session.id } : null;
}

function formatSessionOption(
  session: WhiteboardSessionMetadata,
  status: WhiteboardSessionPickerStatus,
): string {
  const defaultMarker = session.id === "default" ? " (default)" : "";
  return `${session.title} — ${session.id}${defaultMarker} [${status}]`;
}
