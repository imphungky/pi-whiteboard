import { describe, expect, it } from "vitest";
import { readWebSocketConfig } from "./WebSocketBoardConnection";

describe("WebSocket launch configuration", () => {
  it("reads a WebSocket URL, project key, and session ID", () => {
    expect(
      readWebSocketConfig(
        "?ws=ws%3A%2F%2F127.0.0.1%3A4317&project=project-key&session=session-1",
      ),
    ).toEqual({
      websocketUrl: "ws://127.0.0.1:4317",
      projectKey: "project-key",
      sessionId: "session-1",
    });
  });

  it("returns no configuration when launch parameters are missing", () => {
    expect(readWebSocketConfig("")).toBeNull();
    expect(readWebSocketConfig("?ws=ws%3A%2F%2F127.0.0.1%3A4317")).toBeNull();
  });

  it("rejects non-WebSocket URLs", () => {
    expect(
      readWebSocketConfig(
        "?ws=https%3A%2F%2Fexample.com&project=project-key&session=session-1",
      ),
    ).toBeNull();
  });
});
