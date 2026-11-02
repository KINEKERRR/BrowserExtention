(() => {
  'use strict';

  if (window.__colorPickerContentLoaded) {
    return;
  }
  window.__colorPickerContentLoaded = true;

  const state = {
    active: false,
    host: null,
    shadow: null,
    label: null,
    hexRow: null,
    rgbRow: null,
    toast: null,
    toastTimer: 0,
    canvas: null,
    context: null,
    scaleX: 1,
    scaleY: 1,
    color: null
  };

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!message || message.type !== 'PICKER_START') {
      return false;
    }

    startPicking(message.dataUrl).then(
      () => sendResponse({ ok: true }),
      (error) => sendResponse({ ok: false, error: error.message })
    );

    return true;
  });

  async function startPicking(dataUrl) {
    if (!dataUrl) {
      throw new Error('No screenshot received.');
    }

    const image = await loadImage(dataUrl);

    buildOverlay();

    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;

    const context = canvas.getContext('2d', { willReadFrequently: true });
    context.drawImage(image, 0, 0);

    state.canvas = canvas;
    state.context = context;
    state.color = null;
    state.active = true;
    state.label.hidden = true;
    state.toast.classList.remove('visible');

    updateScale();
  }

  function loadImage(source) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('Unable to read the screenshot.'));
      image.src = source;
    });
  }

  function buildOverlay() {
    if (state.host && state.host.isConnected) {
      return;
    }

    const host = document.createElement('div');
    host.setAttribute('data-color-picker', 'overlay');
    host.style.cssText = [
      'position: fixed',
      'top: 0',
      'left: 0',
      'width: 100%',
      'height: 100%',
      'margin: 0',
      'padding: 0',
      'border: 0',
      'background: transparent',
      'z-index: 2147483647',
      'cursor: crosshair'
    ].join(';');

    const shadow = host.attachShadow({ mode: 'open' });
    shadow.innerHTML = `
      <style>
        .label {
          position: fixed;
          top: 0;
          left: 0;
          display: flex;
          flex-direction: column;
          gap: 4px;
          margin: 0;
          padding: 0;
          pointer-events: none;
          font-family: Arial, Helvetica, sans-serif;
          font-size: 14px;
          line-height: 1;
          color: #000000;
          filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.35));
          will-change: transform;
        }
        .label[hidden] {
          display: none;
        }
        .row {
          padding: 5px 8px;
          background: #ffffff;
          border: 1px solid #000000;
          white-space: nowrap;
        }
        .toast {
          position: fixed;
          top: 16px;
          left: 50%;
          transform: translateX(-50%);
          padding: 8px 12px;
          border-radius: 6px;
          background: #111827;
          color: #ffffff;
          font: 12px/1.4 Arial, Helvetica, sans-serif;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
          opacity: 0;
          transition: opacity 0.18s ease;
          pointer-events: none;
        }
        .toast.visible {
          opacity: 1;
        }
      </style>
      <div class="label" hidden>
        <div class="row" data-hex>HEX: #000000</div>
        <div class="row" data-rgb>RGB: rgb(0,0,0)</div>
      </div>
      <div class="toast" data-toast></div>
    `;

    document.documentElement.appendChild(host);

    state.host = host;
    state.shadow = shadow;
    state.label = shadow.querySelector('.label');
    state.hexRow = shadow.querySelector('[data-hex]');
    state.rgbRow = shadow.querySelector('[data-rgb]');
    state.toast = shadow.querySelector('[data-toast]');

    host.addEventListener('mousemove', onMouseMove, true);
    host.addEventListener('click', onClick, true);
    window.removeEventListener('keydown', onKeyDown, true);
    window.addEventListener('keydown', onKeyDown, true);
  }

  function updateScale() {
    state.scaleX = state.canvas.width / Math.max(1, window.innerWidth);
    state.scaleY = state.canvas.height / Math.max(1, window.innerHeight);
  }

  function colorAt(clientX, clientY) {
    const { canvas, context, scaleX, scaleY } = state;

    if (!canvas || !context) {
      return null;
    }

    const x = Math.min(canvas.width - 1, Math.max(0, Math.floor(clientX * scaleX)));
    const y = Math.min(canvas.height - 1, Math.max(0, Math.floor(clientY * scaleY)));
    const data = context.getImageData(x, y, 1, 1).data;

    const r = data[0];
    const g = data[1];
    const b = data[2];

    return {
      hex: '#' + [r, g, b].map((value) => value.toString(16).padStart(2, '0')).join('').toUpperCase(),
      rgb: `rgb(${r},${g},${b})`,
      r,
      g,
      b
    };
  }

  function onMouseMove(event) {
    if (!state.active) {
      return;
    }

    const color = colorAt(event.clientX, event.clientY);

    if (!color) {
      return;
    }

    state.color = color;
    state.hexRow.textContent = 'HEX: ' + color.hex;
    state.rgbRow.textContent = 'RGB: ' + color.rgb;
    state.label.hidden = false;
    positionLabel(event.clientX, event.clientY);
  }

  function positionLabel(cursorX, cursorY) {
    const offset = 18;
    const margin = 8;
    const rect = state.label.getBoundingClientRect();

    let left = cursorX + offset;
    let top = cursorY + offset;

    if (left + rect.width > window.innerWidth - margin) {
      left = cursorX - offset - rect.width;
    }

    if (top + rect.height > window.innerHeight - margin) {
      top = cursorY - offset - rect.height;
    }

    left = Math.max(margin, left);
    top = Math.max(margin, top);

    state.label.style.transform = `translate(${left}px, ${top}px)`;
  }

  async function onClick(event) {
    if (!state.active) {
      return;
    }

    event.preventDefault();
    event.stopImmediatePropagation();

    const color = colorAt(event.clientX, event.clientY);

    if (!color) {
      return;
    }

    state.color = color;

    const copied = await copyToClipboard(color.hex);

    showToast(copied ? `Copied ${color.hex}` : `Copy failed: ${color.hex}`);

    chrome.runtime
      .sendMessage({ type: 'SAVE_COLOR', color: { hex: color.hex, rgb: color.rgb } })
      .catch(() => {});
  }

  function onKeyDown(event) {
    if (!state.active || event.key !== 'Escape') {
      return;
    }

    event.preventDefault();
    event.stopImmediatePropagation();
    stopPicking();
  }

  function stopPicking() {
    state.active = false;
    state.color = null;

    if (state.host) {
      state.host.remove();
    }

    state.host = null;
    state.shadow = null;
    state.label = null;
    state.hexRow = null;
    state.rgbRow = null;
    state.toast = null;
    state.canvas = null;
    state.context = null;

    window.removeEventListener('keydown', onKeyDown, true);
  }

  async function copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (error) {
      return fallbackCopy(text);
    }
  }

  function fallbackCopy(text) {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.cssText = 'position:fixed;top:0;left:0;opacity:0;pointer-events:none;';

    document.documentElement.appendChild(textarea);
    textarea.select();

    let copied = false;

    try {
      copied = document.execCommand('copy');
    } catch (error) {
      copied = false;
    }

    textarea.remove();
    return copied;
  }

  function showToast(text) {
    if (!state.toast) {
      return;
    }

    state.toast.textContent = text;
    state.toast.classList.add('visible');

    clearTimeout(state.toastTimer);
    state.toastTimer = window.setTimeout(() => {
      if (state.toast) {
        state.toast.classList.remove('visible');
      }
    }, 1200);
  }
})();
