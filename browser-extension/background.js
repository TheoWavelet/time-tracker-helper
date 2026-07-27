const WS_URL = 'ws://127.0.0.1:51834';
const RECONNECT_DELAY_MS = 1500;
const RECONNECT_ALARM = 'reconnect';
// Chrome enforces ~1 minute as the practical floor for repeating alarms (it may silently coerce
// anything shorter), but even that is far better than nothing — see the alarm listener below for why.
const RECONNECT_ALARM_PERIOD_MINUTES = 1;
// Matches DEV_PAIRING_TOKEN in src/main/browserBridge.ts — the desktop app always accepts this
// constant (dev or packaged), so trying it here whenever no token is saved means zero pairing
// step at all, ever.
const DEV_PAIRING_TOKEN = 'dev-pairing-token-insecure-local-only';

let socket = null;

function isSocketOpen() {
  return Boolean(socket) && socket.readyState === WebSocket.OPEN;
}

// Chrome extensions can't accept inbound connections, so this side is always the client — the
// desktop app hosts the WebSocket server and waits for us to connect and authenticate.
function connect() {
  if (isSocketOpen() || (socket && socket.readyState === WebSocket.CONNECTING)) return;

  chrome.storage.local.get('pairingToken', ({ pairingToken }) => {
    const token = pairingToken || DEV_PAIRING_TOKEN;

    const ws = new WebSocket(WS_URL);
    socket = ws;

    ws.addEventListener('open', () => {
      ws.send(JSON.stringify({ type: 'auth', token }));
    });

    ws.addEventListener('message', (event) => {
      handleMessage(event.data);
    });

    ws.addEventListener('close', () => {
      if (socket === ws) socket = null;
      setTimeout(connect, RECONNECT_DELAY_MS);
    });

    ws.addEventListener('error', () => {
      ws.close();
    });
  });
}

async function handleMessage(raw) {
  let message;
  try {
    message = JSON.parse(raw);
  } catch {
    return;
  }

  const domain = (message.domain || '').trim().toLowerCase();

  if (message.type === 'listTabs') {
    const tabs = await chrome.tabs.query({});
    const matching = domain ? tabs.filter((tab) => tab.url && tab.url.toLowerCase().includes(domain)) : tabs;
    reply(message.requestId, 'listTabs:result', {
      tabs: matching.map((tab) => ({ title: tab.title || tab.url || 'Untitled', url: tab.url || '' })),
    });
    return;
  }

  if (message.type === 'searchHistoryByDomain') {
    // Letting Chrome's own text search do the domain matching searches the whole history, not
    // just the most recent N entries — the substring filter below is just a safety net on top.
    const results = await chrome.history.search({ text: domain, maxResults: 200, startTime: 0 });
    const items = results
      .filter((item) => !domain || (item.url && item.url.toLowerCase().includes(domain)))
      .map((item) => ({ title: item.title || item.url, url: item.url, lastVisitTime: item.lastVisitTime || 0 }));
    reply(message.requestId, 'searchHistoryByDomain:result', { items });
  }
}

function reply(requestId, type, payload) {
  if (!isSocketOpen()) return;
  socket.send(JSON.stringify({ type, requestId, ...payload }));
}

// Reconnect immediately when a fresh token is saved from the options page.
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local' || !changes.pairingToken) return;
  if (socket) {
    socket.close();
    socket = null;
  }
  connect();
});

chrome.runtime.onStartup.addListener(connect);
chrome.runtime.onInstalled.addListener(connect);

// Safety net for the setTimeout above: MV3 service workers get killed by Chrome after a short
// idle period, silently dropping any pending setTimeout along with them — a dropped WebSocket
// could then never retry again. An alarm specifically wakes the service worker back up to fire,
// even after Chrome has already terminated it, so this guarantees eventual reconnection.
chrome.alarms.create(RECONNECT_ALARM, { periodInMinutes: RECONNECT_ALARM_PERIOD_MINUTES });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === RECONNECT_ALARM) connect();
});

connect();
