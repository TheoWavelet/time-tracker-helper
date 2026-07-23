const WS_URL = 'ws://127.0.0.1:51834';
const RECONNECT_ALARM = 'reconnect';
const RECONNECT_DELAY_MS = 3000;

let socket = null;

function isSocketOpen() {
  return Boolean(socket) && socket.readyState === WebSocket.OPEN;
}

// Chrome extensions can't accept inbound connections, so this side is always the client — the
// desktop app hosts the WebSocket server and waits for us to connect and authenticate.
function connect() {
  if (isSocketOpen() || (socket && socket.readyState === WebSocket.CONNECTING)) return;

  chrome.storage.local.get('pairingToken', ({ pairingToken }) => {
    if (!pairingToken) return;

    const ws = new WebSocket(WS_URL);
    socket = ws;

    ws.addEventListener('open', () => {
      ws.send(JSON.stringify({ type: 'auth', token: pairingToken }));
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

const LOGWORK_PARAM = 'tt_logwork';

function hasLogWorkTrigger(url) {
  try {
    return new URL(url).searchParams.get(LOGWORK_PARAM) === '1';
  } catch {
    return false;
  }
}

// Runs inside EVERY frame of the tab (the button lives inside an iframe, invisible to a
// top-frame-only query) — Jira is a heavy SPA, so it often isn't in the DOM yet even once the
// tab reports itself "complete"; retry a few times instead of assuming it's there. Returns
// whether this frame found and clicked it, so the caller knows whether to clean up the URL.
function clickLogWorkButtonInFrame() {
  const MAX_ATTEMPTS = 5;
  const RETRY_DELAY_MS = 2000;

  return new Promise((resolve) => {
    let attempt = 0;
    function tryClick() {
      attempt += 1;
      const button = document.querySelector('[data-test-id="LogWorkButton"]');
      if (button) {
        button.click();
        resolve(true);
        return;
      }
      if (attempt < MAX_ATTEMPTS) {
        setTimeout(tryClick, RETRY_DELAY_MS);
      } else {
        resolve(false);
      }
    }
    tryClick();
  });
}

// Run in the top frame only — the iframe's own location isn't the tab URL tabs.onUpdated reads.
function clearLogWorkTrigger() {
  const url = new URL(window.location.href);
  url.searchParams.delete('tt_logwork');
  window.history.replaceState({}, '', url.toString());
}

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status !== 'complete') return;
  if (!tab.url || !hasLogWorkTrigger(tab.url)) return;

  const results = await chrome.scripting.executeScript({
    target: { tabId, allFrames: true },
    func: clickLogWorkButtonInFrame,
  });

  const clicked = results.some((r) => r.result === true);
  if (clicked) {
    chrome.scripting.executeScript({ target: { tabId }, func: clearLogWorkTrigger });
  }
});

// Reconnect immediately when a fresh token is saved from the options page.
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local' || !changes.pairingToken) return;
  if (socket) {
    socket.close();
    socket = null;
  }
  connect();
});

// The service worker can be suspended and woken later — an alarm is a more reliable way to retry
// a dropped connection than trusting a long-lived setTimeout to survive that suspension.
chrome.alarms.create(RECONNECT_ALARM, { periodInMinutes: 1 });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === RECONNECT_ALARM) connect();
});

chrome.runtime.onStartup.addListener(connect);
chrome.runtime.onInstalled.addListener(connect);

connect();
