export type {
  BoardMessage,
  ErrorMessage,
  GetStateMessage,
  HelloMessage,
  SerializedBoardState,
  StateAckMessage,
  StateMessage,
  WelcomeMessage,
} from "../protocol";
export {
  BOARD_PROTOCOL_VERSION,
  decodeMessage,
  encodeMessage,
  isBoardMessage,
} from "../protocol";
