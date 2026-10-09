# Whiteboard Vertical Slice

## Purpose

Implement the first thin vertical slice of the Pi whiteboard: a local React/Vite application that renders an Excalidraw board, preserves the board locally, and leaves a clean boundary for future WebSocket communication with a Pi extension.

The first goal is not to build collaboration, semantic diagram objects, or the extension. The first goal is to prove that the board can launch, accept drawing input, preserve its visual state, and later be controlled through a small application-owned boundary.

## Product behavior

The application should support these behaviors:

1. Given no previously saved board, when the application starts, it displays an empty canvas.
2. Given a saved board, when the application starts, it displays the saved scene.
3. Given an open board, when the user draws, moves, or deletes an element, the visible board changes and the latest state is saved locally.
4. Given an open board with no WebSocket connection, when the user edits the board, the board remains usable and saves locally.
5. Given an open board, when a connected client sends a valid scene update, the canvas displays the updated scene.
6. Given a remote scene update is applied, the application persists it if that is the chosen persistence policy.

The last remote-persistence behavior must be made explicit during implementation rather than assumed silently.

## Scope

### In scope

- TypeScript React/Vite application
- `@excalidraw/excalidraw` React component
- Full-window Excalidraw canvas
- Capturing the Excalidraw imperative API reference
- Capturing scene changes through `onChange`
- Local board persistence
- Board state restoration through `initialData`
- A small application boundary for future WebSocket messages
- Behavioral tests around board startup, editing, persistence, and remote updates

### Out of scope

- Electron or Tauri
- Pi extension implementation
- Process launching from the extension
- Real WebSocket server
- Multi-user collaboration
- CRDTs or conflict resolution
- Authentication
- Semantic entities such as decisions, questions, and constraints
- LLM-facing tools
- Complex application UI

## Architecture

```text
React/Vite Application
└── BoardSession
    ├── BoardState
    ├── Excalidraw canvas adapter
    ├── BoardPersistence
    └── optional/future BoardTransport

Future Pi Extension
└── launches/connects to the React application
```

The BoardSession coordinates the application behavior. It does not own or implement a canvas renderer. The Excalidraw adapter is a collaborator that translates between Excalidraw and the application’s BoardState.

The adapter may remain colocated with the board code. A separate `canvas/` module is not required for this slice. The conceptual boundary is still important even if it is represented by files within `board/`.

## Main concepts

### BoardState

The application’s representation of the current visual board. It should remain visual for this slice:

```ts
export type BoardState = {
  elements: readonly ExcalidrawElement[];
  appState?: Partial<AppState>;
  files?: BinaryFiles;
};
```

Do not add semantic domain objects yet. Excalidraw scene elements are the source of truth for this slice.

### BoardSession

The application behavior that coordinates the board state, visual canvas, persistence, and future transport.

Expected behavior:

```text
local scene change
  -> update current BoardState
  -> save BoardState

remote scene received
  -> update current BoardState
  -> display BoardState through Excalidraw
  -> apply the decided persistence policy
```

This is an application coordinator rather than a rich domain entity. Keep it independent of concrete `localStorage`, WebSocket, and Excalidraw implementations where practical.

### Excalidraw adapter

The adapter owns the Excalidraw-specific details:

- Render `<Excalidraw />`.
- Capture the imperative API using `onExcalidrawAPI`.
- Translate `onChange` into application-level scene changes.
- Apply an application state through `api.updateScene(...)`.

The React application, not the Pi extension, owns this API reference. A future WebSocket message is handled by the React app and translated into an Excalidraw operation.

### BoardPersistence

Use an application-facing interface:

```ts
export interface BoardPersistence {
  load(): Promise<BoardState | null>;
  save(state: BoardState): Promise<void>;
}
```

The first implementation may use browser local storage. Keep the storage implementation behind this interface so file or server persistence can be added later.

### BoardTransport

The WebSocket boundary is a future collaborator, not a requirement for the first board-only milestone. If introduced in this slice, begin with connection status and a minimal message boundary rather than a full protocol.

Possible future message shape:

```ts
type BoardMessage =
  | { type: "ping" }
  | { type: "pong" }
  | { type: "replace-scene"; state: BoardState };
```

The transport must not know how Excalidraw works.

## Proposed file structure

Start with one application; do not split into packages yet:

```text
whiteboard-app/
├── package.json
├── vite.config.ts
├── tsconfig.json
├── index.html
└── src/
    ├── main.tsx
    ├── App.tsx
    ├── styles.css
    │
    ├── board/
    │   ├── BoardState.ts
    │   ├── BoardSession.ts
    │   ├── ExcalidrawBoard.tsx
    │   ├── BoardSession.test.ts
    │   └── index.ts
    │
    ├── persistence/
    │   ├── BoardPersistence.ts
    │   ├── LocalStorageBoardPersistence.ts
    │   ├── LocalStorageBoardPersistence.test.ts
    │   └── index.ts
    │
    └── transport/
        ├── BoardMessage.ts
        ├── BoardTransport.ts
        └── index.ts
```

The `transport/` directory can be omitted until transport behavior is actually implemented. Do not create an empty abstraction merely for architectural appearance.

The Excalidraw adapter is intentionally named and grouped with the board rather than forced into a separate canvas module. If it grows substantially, it can later move without changing the BoardSession contract.

## Implementation sequence

1. Scaffold the React/Vite TypeScript app.
2. Install and render `@excalidraw/excalidraw` as a full-window canvas.
3. Confirm that manual drawing, selection, movement, and deletion work.
4. Define `BoardState`.
5. Add the Excalidraw adapter and retain the imperative API reference in a React ref.
6. Add `BoardPersistence` and a local-storage implementation.
7. Load saved state into Excalidraw through `initialData`.
8. Handle `onChange` and persist the latest BoardState.
9. Add behavioral tests for startup, editing, and restoration.
10. Add the transport interface only when the board behavior is stable.
11. Add the first remote scene behavior and test it with a fake canvas and fake transport.
12. Validate the complete browser flow manually or with a small end-to-end smoke test.

## Testing approach

Tests should be behavioral rather than primarily contract or implementation tests. Start from meaningful inputs and observable outcomes.

### Unit-level behavior

- No saved board -> session starts with an empty state.
- Saved board -> session restores the saved state.
- Scene changed -> current state updates and persistence saves it.
- Remote scene received -> canvas displays the updated state.
- Editing while disconnected -> canvas remains usable and state is still saved.

Use small fakes for persistence, transport, and the canvas boundary. Do not unit-test Excalidraw internals.

### Integration behavior

- Real local storage restores a board after reload.
- Real React/Excalidraw integration displays a restored scene.
- `onChange` from Excalidraw results in persisted state.

### End-to-end behavior

- Start the application.
- Draw an element.
- Reload the browser.
- Verify that the element remains.
- Later, connect a real extension and verify one remote scene update.

Malformed JSON, exhaustive schema validation, and mock-call assertions are supporting tests only. Add them when robustness is an explicit requirement, not as the initial definition of correctness.

## Important decisions to preserve

- The React application owns the Excalidraw API reference.
- The Pi extension never directly manipulates Excalidraw.
- Board behavior is separated conceptually from Excalidraw-specific rendering, but a separate Canvas module is not required.
- The first state model is visual only.
- WebSockets are a future boundary and must not be required for local drawing.
- Persistence behavior for remote updates must be decided explicitly.
- Do not introduce semantic board entities until the visual board slice is working.
