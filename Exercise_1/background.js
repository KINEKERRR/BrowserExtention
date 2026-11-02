'use strict';

const MAX_SAVED_COLORS = 5;
const UNSUPPORTED_URL = /^(chrome|edge|about|devtools|chrome-extension|chrome-untrusted):/i;

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || typeof message.type !== 'string') {
    return false;
  }

  if (message.type === 'ACTIVATE_PICKER') {
    activatePicker().then(sendResponse, (error) => {
      sendResponse({ ok: false, error: error.message });
    });
    return true;
  }

  if (message.type === 'SAVE_COLOR') {
    saveColor(message.color).then(
      () => sendResponse({ ok: true }),
      (error) => sendResponse({ ok: false, error: error.message })
    );
    return true;
  }

  return false;
});

async function activatePicker() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab || typeof tab.id !== 'number') {
    return { ok: false, error: 'No active tab found.' };
  }

  if (typeof tab.url === 'string' && UNSUPPORTED_URL.test(tab.url)) {
    return { ok: false, error: 'Browser pages cannot be inspected. Open a regular web page and try again.' };
  }

  let dataUrl;

  try {
    dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png' });
  } catch (error) {
    return { ok: false, error: 'Unable to capture this page. Reload it and try again.' };
  }

  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['content.js']
    });

    await chrome.tabs.sendMessage(tab.id, { type: 'PICKER_START', dataUrl });
  } catch (error) {
    return { ok: false, error: 'Unable to start the picker on this page.' };
  }

  return { ok: true };
}

async function saveColor(color) {
  if (!color || typeof color.hex !== 'string') {
    return;
  }

  const hex = color.hex.toUpperCase();
  const rgb = typeof color.rgb === 'string' ? color.rgb : '';

  const stored = await chrome.storage.local.get({ colors: [] });
  const colors = Array.isArray(stored.colors) ? stored.colors : [];

  const next = [{ hex, rgb }]
    .concat(colors.filter((item) => item && String(item.hex).toUpperCase() !== hex))
    .slice(0, MAX_SAVED_COLORS);

  await chrome.storage.local.set({ colors: next });
}
