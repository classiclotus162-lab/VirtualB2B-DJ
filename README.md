# Virtual B2B DJ

Virtual B2B DJ is a Windows desktop client for synchronized remote DJ sessions.

## Public Internet architecture

The desktop application **does not run a relay server locally**. Every copy of the app connects to one centrally deployed Socket.IO relay server over HTTPS/WSS.

```text
DJ A ──┐
       ├── Internet ──> Virtual B2B DJ Relay ── Internet ──> DJ B
DJ C ──┘
```

The relay is the Node/Express/Socket.IO app in `server/server.js`.

## Before building the public EXE

Deploy `server/server.js` to a public Node.js host and make sure it is reachable over HTTPS. Then edit the single constant in `src/preload.js`:

```js
const DEFAULT_RELAY_SERVER = 'https://relay.yourdomain.com';
```

Use the HTTPS URL of your deployed relay. Socket.IO will negotiate the secure WebSocket connection automatically.

The relay exposes:

- `GET /` — basic status
- `GET /health` — health check
- Socket.IO — B2B session traffic

For production, put the relay behind HTTPS/WSS and keep CORS restricted to your actual app/web origins if you later add a browser client.

## Building the Windows public release

On a Windows PC with Node.js 20+:

```text
build-windows.bat
```

The `dist` directory will contain a Windows installer and portable EXE.

The desktop app no longer starts `server/server.js`, so end users do not need Node.js or a local relay.

## Important Electron fix

Electron 38 sandboxes preload scripts by default. The preload needs access to the packaged `socket.io-client` module, so `src/main.js` explicitly sets `sandbox: false`. The renderer still uses `contextIsolation: true` and `nodeIntegration: false`.

## Local development

You can still run the relay manually for development:

```text
npm install
npm run server
npm start
```

Then enter `http://localhost:3210` in the Relay Server field.

This local mode is for development/testing only; the distributed public build should use the deployed relay URL.

## Quick public relay deployment

The repository includes `render.yaml` as a starting point for deploying the relay as a Node web service. After deployment, use the HTTPS service URL as `DEFAULT_RELAY_SERVER` in `src/preload.js`, then rebuild the Windows client.

Example: if the host gives you `https://virtual-b2b-dj-relay.example-host.com`, set:

```js
const DEFAULT_RELAY_SERVER = 'https://virtual-b2b-dj-relay.example-host.com';
```

Do not put a private API key or other secret in the desktop application; anything shipped in the EXE can be extracted by users.
