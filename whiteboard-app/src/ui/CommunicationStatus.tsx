import { useCallback, useSyncExternalStore } from "react";
import type {
  BoardCommunication,
  CommunicationStatus as CommunicationStatusValue,
} from "../transport";

export type CommunicationStatusProps = {
  communication: BoardCommunication | null;
};

export function CommunicationStatus({
  communication,
}: CommunicationStatusProps) {
  const subscribe = useCallback(
    (listener: () => void) =>
      communication?.subscribeStatus(() => listener()) ?? (() => undefined),
    [communication],
  );
  const status: CommunicationStatusValue = useSyncExternalStore(
    subscribe,
    () => communication?.status ?? "disconnected",
    () => "disconnected",
  );

  if (!communication) {
    return null;
  }

  const labels: Record<CommunicationStatusValue, string> = {
    disconnected: "Pi disconnected",
    connecting: "Connecting to Pi…",
    ready: "Pi connected",
    reconnecting: "Reconnecting to Pi…",
    error: "Pi connection error",
  };

  return <span aria-label="Pi connection status">{labels[status]}</span>;
}
