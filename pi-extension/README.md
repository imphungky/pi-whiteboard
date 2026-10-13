# Pi Whiteboard Extension

This directory contains the Pi extension runtime source. The root package builds and publishes it together with the bundled whiteboard web app.

The extension:

- creates Pi-owned whiteboard sessions;
- starts a local WebSocket server;
- launches the browser with `ws` and `session` parameters;
- mirrors the whiteboard's current state;
- exposes `/whiteboard` to launch a board;
- closes the server on Pi session shutdown.

## Development

```bash
npm install
npm test
npm run typecheck
```

Load the extension in Pi with:

```bash
pi --extension ./pi-extension
```

The packaged extension starts its own local HTTP/WebSocket server and serves the compiled web app. For development, override the browser URL with:

```bash
PI_WHITEBOARD_URL=http://localhost:5173/ pi --extension ./pi-extension
```

`PI_WHITEBOARD_WEB_ROOT` can be used to point the extension at a local Vite build.

The browser-side client and Pi extension use the shared protocol in:

```text
shared/board-protocol/src/index.ts
```
