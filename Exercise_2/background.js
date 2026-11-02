'use strict';

const UNSUPPORTED_URL = /^(chrome|edge|about|devtools|chrome-extension|chrome-untrusted):/i;

chrome.action.onClicked.addListener(async (tab) => {
  if (!tab || typeof tab.id !== 'number') {
    return;
  }

  if (typeof tab.url === 'string' && UNSUPPORTED_URL.test(tab.url)) {
    return;
  }

  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['content.js']
    });

    await chrome.tabs.sendMessage(tab.id, { type: 'RULER_TOGGLE' });
  } catch (error) {
    console.warn('PixelRuler is not available on this page.', error);
  }
});
