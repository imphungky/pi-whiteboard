export const BOARD_PROTOCOL_VERSION = 1 as const;

export type SerializedBoardState = {
  elements: readonly unknown[];
  appState?: unknown;
  files?: unknown;
};

export type BoardAvailability = "available" | "missing" | "unavailable";

export type BoardMessage =
  | HelloMessage
  | WelcomeMessage
  | BoardStatusMessage
  | GetStateMessage
  | StateMessage
  | StateAckMessage
  | ErrorMessage;

export type HelloMessage = {
  type: "hello";
  protocolVersion: typeof BOARD_PROTOCOL_VERSION;
  client: "whiteboard";
  projectKey: string;
  sessionId: string;
};

export type WelcomeMessage = {
  type: "welcome";
  protocolVersion: typeof BOARD_PROTOCOL_VERSION;
  projectKey: string;
  sessionId: string;
};

export type BoardStatusMessage = {
  type: "board-status";
  sessionId: string;
  status: BoardAvailability;
};

export type GetStateMessage = {
  type: "get-state";
  requestId: string;
};

export type StateMessage = {
  type: "state";
  requestId: string;
  snapshotId: string;
  state: SerializedBoardState;
};

export type StateAckMessage = {
  type: "state-ack";
  requestId: string;
  snapshotId: string;
};

export type ErrorMessage = {
  type: "error";
  code: string;
  message: string;
};

export function encodeMessage(message: BoardMessage): string {
  return JSON.stringify(message);
}

export function decodeMessage(raw: string): BoardMessage {
  const value: unknown = JSON.parse(raw);
  if (!isBoardMessage(value)) {
    throw new Error("Invalid board protocol message");
  }
  return value;
}

export function isBoardMessage(value: unknown): value is BoardMessage {
  if (!isRecord(value) || typeof value.type !== "string") {
    return false;
  }

  switch (value.type) {
    case "hello":
      return (
        value.protocolVersion === BOARD_PROTOCOL_VERSION &&
        value.client === "whiteboard" &&
        isNonEmptyString(value.projectKey) &&
        isNonEmptyString(value.sessionId)
      );
    case "welcome":
      return (
        value.protocolVersion === BOARD_PROTOCOL_VERSION &&
        isNonEmptyString(value.projectKey) &&
        isNonEmptyString(value.sessionId)
      );
    case "board-status":
      return (
        isNonEmptyString(value.sessionId) &&
        (value.status === "available" ||
          value.status === "missing" ||
          value.status === "unavailable")
      );
    case "get-state":
      return isNonEmptyString(value.requestId);
    case "state":
      return (
        isNonEmptyString(value.requestId) &&
        isNonEmptyString(value.snapshotId) &&
        isRecord(value.state) &&
        Array.isArray(value.state.elements)
      );
    case "state-ack":
      return (
        isNonEmptyString(value.requestId) &&
        isNonEmptyString(value.snapshotId)
      );
    case "error":
      return isNonEmptyString(value.code) && isNonEmptyString(value.message);
    default:
      return false;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}
