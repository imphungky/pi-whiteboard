# Pi Whiteboard

Pi Whiteboard is a local visual whiteboard built to launch from Pi. It uses [Excalidraw](https://excalidraw.com/) for the canvas and React/Vite for the application shell.

The project is intended to give Pi and an LLM a visual workspace for exploring ideas, designing systems, annotating decisions, and reviewing changes. The current app is the first board-only slice: it runs locally in a browser and persists the Excalidraw scene in browser storage. Pi launching, extension integration, and collaboration transport are planned next.

## Run locally

```bash
cd whiteboard-app
npm install
npm run dev
```

Open the local URL printed by Vite. Drawings are restored when the board reloads.

## Verify

```bash
cd whiteboard-app
npm test
npm run build
```

See [HANDOFF.md](./docs/agents/HANDOFF.md) for the architecture, development plan, and future Pi integration work. The first-slice implementation notes are in [whiteboard-app/VERTICAL_SLICE.md](./whiteboard-app/VERTICAL_SLICE.md).
