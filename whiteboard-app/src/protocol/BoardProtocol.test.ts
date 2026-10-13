import { describe, expect, it } from "vitest";
import {
  decodeMessage,
  encodeMessage,
  isBoardMessage,
} from "./BoardProtocol";

describe("board protocol", () => {
  it("round-trips a valid message", () => {
    const message = {
      type: "get-state" as const,
      requestId: "request-1",
    };

    expect(decodeMessage(encodeMessage(message))).toEqual(message);
  });

  it("rejects an unsupported message", () => {
    expect(() => decodeMessage('{"type":"unknown"}')).toThrow(
      "Invalid board protocol message",
    );
  });

  it("recognizes valid state messages", () => {
    expect(
      isBoardMessage({
        type: "state",
        requestId: "request-1",
        snapshotId: "snapshot-1",
        state: { elements: [] },
      }),
    ).toBe(true);
  });
});
