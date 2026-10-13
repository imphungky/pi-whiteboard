# Pi Whiteboard

Pi Whiteboard is a local visual whiteboard built to launch from Pi. It uses [Excalidraw](https://excalidraw.com/) for the canvas and React/Vite for the application shell.

The project gives Pi and an LLM a visual workspace for exploring ideas, designing systems, annotating decisions, and reviewing changes. The installable extension includes the compiled browser app and starts a local HTTP/WebSocket server when a board is launched.

## Run locally

For browser development:

```bash
npm install
npm run --prefix whiteboard-app dev
```

To build the extension package and bundled web app:

```bash
npm run build
```

The extension can be loaded into Pi from the project directory. Its `whiteboard` command serves the bundled app and opens it in a browser.

## Verify

```bash
npm test
npm run build
```

See [HANDOFF.md](./docs/agents/HANDOFF.md) for the architecture, development plan, and future Pi integration work. The first-slice implementation notes are in [VERTICAL_SLICE.md](./docs/agents/VERTICAL_SLICE.md).
