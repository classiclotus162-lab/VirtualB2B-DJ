const { contextBridge } = require('electron');
const { io } = require('socket.io-client');

// The relay is hosted on the public Internet. Set this to your deployed
// Socket.IO relay URL before building the public release.
const DEFAULT_RELAY_SERVER = 'https://YOUR-RELAY-DOMAIN.example';

contextBridge.exposeInMainWorld('b2b', {
  defaultRelayServer: DEFAULT_RELAY_SERVER,
  createSocket: (url, options = {}) => io(url, {
    ...options,
    autoConnect: false,
    transports: ['websocket', 'polling']
  })
});
