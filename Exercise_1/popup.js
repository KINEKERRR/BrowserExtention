'use strict';

const MAX_COLORS = 5;
const HINT =
  'Move the cursor over the page to see HEX and RGB. Click to copy HEX. Press Esc to stop.';

const palette = document.getElementById('palette');
const emptyState = document.getElementById('empty');
const status = document.getElementById('status');

let colors = [];
let openedIndex = -1;

init();

function init() {
  palette.addEventListener('click', onPaletteClick);
  chrome.storage.onChanged.addListener(onStorageChanged);

  loadColors().then(render, () => {
    colors = [];
    render();
  });
  activatePicker();
}

async function activatePicker() {
  try {
    const response = await chrome.runtime.sendMessage({ type: 'ACTIVATE_PICKER' });

    if (response && response.ok) {
      showStatus(HINT, false);
    } else {
      showStatus((response && response.error) || 'Unable to start the picker on this page.', true);
    }
  } catch (error) {
    showStatus('Unable to start the picker on this page.', true);
  }
}

async function loadColors() {
  const stored = await chrome.storage.local.get({ colors: [] });
  colors = Array.isArray(stored.colors) ? stored.colors.slice(0, MAX_COLORS) : [];
}

function render() {
  openedIndex = -1;
  palette.replaceChildren();
  emptyState.hidden = colors.length > 0;

  colors.forEach((color, index) => {
    const item = document.createElement('div');
    item.className = 'color-item';
    item.dataset.index = String(index);

    const swatch = document.createElement('button');
    swatch.type = 'button';
    swatch.className = 'swatch';
    swatch.style.backgroundColor = color.hex;
    swatch.title = color.hex;
    swatch.setAttribute('aria-label', `Color ${color.hex}, ${color.rgb}`);
    swatch.setAttribute('aria-expanded', 'false');
    swatch.setAttribute('aria-controls', `details-${index}`);

    const details = document.createElement('div');
    details.className = 'details';
    details.id = `details-${index}`;

    const inner = document.createElement('div');
    inner.className = 'details-inner';

    const hex = document.createElement('span');
    hex.className = 'code';
    hex.textContent = `HEX: ${color.hex}`;

    const rgb = document.createElement('span');
    rgb.className = 'code';
    rgb.textContent = `RGB: ${color.rgb}`;

    inner.append(hex, rgb);
    details.append(inner);
    item.append(swatch, details);
    palette.append(item);
  });
}

function onPaletteClick(event) {
  const swatch = event.target.closest('.swatch');

  if (!swatch || !palette.contains(swatch)) {
    return;
  }

  const item = swatch.closest('.color-item');
  const index = Number(item.dataset.index);

  openedIndex = openedIndex === index ? -1 : index;
  applyOpenState();
}

function applyOpenState() {
  palette.querySelectorAll('.color-item').forEach((item) => {
    const isOpen = Number(item.dataset.index) === openedIndex;
    item.classList.toggle('open', isOpen);

    const swatch = item.querySelector('.swatch');

    if (swatch) {
      swatch.setAttribute('aria-expanded', String(isOpen));
    }
  });
}

function onStorageChanged(changes, areaName) {
  if (areaName !== 'local' || !changes.colors) {
    return;
  }

  loadColors().then(render, () => {
    colors = [];
    render();
  });
}

function showStatus(text, isError) {
  status.textContent = text;
  status.hidden = !text;
  status.classList.toggle('error', Boolean(isError));
}
