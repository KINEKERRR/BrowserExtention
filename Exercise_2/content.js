(() => {
  'use strict';

  if (window.__pixelRulerContentLoaded) {
    return;
  }
  window.__pixelRulerContentLoaded = true;

  const CURSOR_HOTSPOT = 16;

  const state = {
    active: false,
    host: null,
    shadow: null,
    outline: null,
    line: null,
    label: null,
    startDot: null,
    endDot: null,
    start: null,
    end: null
  };

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!message || message.type !== 'RULER_TOGGLE') {
      return false;
    }

    if (state.active) {
      stopRuler();
    } else {
      startRuler();
    }

    sendResponse({ ok: true, active: state.active });
    return false;
  });

  function startRuler() {
    buildOverlay();
    state.start = null;
    state.end = null;
    state.active = true;
    render();
  }

  function stopRuler() {
    state.active = false;
    state.start = null;
    state.end = null;

    if (state.host) {
      state.host.remove();
    }

    state.host = null;
    state.shadow = null;
    state.outline = null;
    state.line = null;
    state.label = null;
    state.startDot = null;
    state.endDot = null;

    window.removeEventListener('keydown', onKeyDown, true);
    window.removeEventListener('scroll', onViewportChange, true);
    window.removeEventListener('resize', onViewportChange);
  }

  function buildOverlay() {
    if (state.host && state.host.isConnected) {
      return;
    }

    const cursorUrl = chrome.runtime.getURL('cursor.png');

    const host = document.createElement('div');
    host.setAttribute('data-pixel-ruler', 'overlay');
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
      `cursor: url("${cursorUrl}") ${CURSOR_HOTSPOT} ${CURSOR_HOTSPOT}, crosshair`
    ].join(';');

    const shadow = host.attachShadow({ mode: 'open' });
    shadow.innerHTML = `
      <style>
        .layer {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          overflow: visible;
          pointer-events: none;
        }
        .outline,
        .line {
          stroke-linecap: round;
        }
        .outline {
          stroke: rgba(255, 255, 255, 0.9);
          stroke-width: 6;
        }
        .line {
          stroke: #0284c7;
          stroke-width: 2;
        }
        .dot {
          fill: #0284c7;
          stroke: #ffffff;
          stroke-width: 2;
        }
        .label {
          position: absolute;
          top: 0;
          left: 0;
          transform: translate(-50%, -50%);
          padding: 4px 8px;
          border-radius: 4px;
          background: #111827;
          color: #ffffff;
          font: 12px/1.2 ui-monospace, SFMono-Regular, Consolas, "Liberation Mono", monospace;
          white-space: nowrap;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
          pointer-events: none;
        }
        .label[hidden] {
          display: none;
        }
        [hidden] {
          display: none;
        }
      </style>
      <svg class="layer" xmlns="http://www.w3.org/2000/svg">
        <line class="outline" data-outline hidden />
        <line class="line" data-line hidden />
        <circle class="dot" data-start-dot r="5" hidden />
        <circle class="dot" data-end-dot r="5" hidden />
      </svg>
      <div class="label" data-label hidden></div>
    `;

    document.documentElement.appendChild(host);

    state.host = host;
    state.shadow = shadow;
    state.outline = shadow.querySelector('[data-outline]');
    state.line = shadow.querySelector('[data-line]');
    state.startDot = shadow.querySelector('[data-start-dot]');
    state.endDot = shadow.querySelector('[data-end-dot]');
    state.label = shadow.querySelector('[data-label]');

    host.addEventListener('click', onClick, true);
    host.addEventListener('mousedown', swallow, true);
    host.addEventListener('contextmenu', swallow, true);

    window.removeEventListener('keydown', onKeyDown, true);
    window.removeEventListener('scroll', onViewportChange, true);
    window.removeEventListener('resize', onViewportChange);
    window.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('scroll', onViewportChange, true);
    window.addEventListener('resize', onViewportChange);
  }

  function swallow(event) {
    if (!state.active) {
      return;
    }

    event.preventDefault();
    event.stopImmediatePropagation();
  }

  function onClick(event) {
    if (!state.active) {
      return;
    }

    event.preventDefault();
    event.stopImmediatePropagation();

    const point = {
      x: event.clientX + window.scrollX,
      y: event.clientY + window.scrollY
    };

    if (!state.start || state.end) {
      state.start = point;
      state.end = null;
    } else {
      state.end = point;
    }

    render();
  }

  function onKeyDown(event) {
    if (!state.active || event.key !== 'Escape') {
      return;
    }

    event.preventDefault();
    event.stopImmediatePropagation();
    stopRuler();
  }

  function onViewportChange() {
    if (state.active) {
      render();
    }
  }

  function toClient(point) {
    return {
      x: point.x - window.scrollX,
      y: point.y - window.scrollY
    };
  }

  function render() {
    if (!state.active || !state.start) {
      hideDrawing();
      return;
    }

    const start = toClient(state.start);

    setCircle(state.startDot, start);
    setHidden(state.startDot, false);

    if (!state.end) {
      setHidden(state.outline, true);
      setHidden(state.line, true);
      setHidden(state.endDot, true);
      setHidden(state.label, true);
      return;
    }

    const end = toClient(state.end);

    setCircle(state.endDot, end);
    setHidden(state.endDot, false);

    setLine(state.outline, start, end);
    setHidden(state.outline, false);

    setLine(state.line, start, end);
    setHidden(state.line, false);

    const length = Math.hypot(state.end.x - state.start.x, state.end.y - state.start.y);

    state.label.textContent = `${Math.round(length)} px`;
    state.label.style.left = `${(start.x + end.x) / 2}px`;
    state.label.style.top = `${(start.y + end.y) / 2}px`;
    setHidden(state.label, false);
  }

  function hideDrawing() {
    if (!state.outline) {
      return;
    }

    setHidden(state.outline, true);
    setHidden(state.line, true);
    setHidden(state.startDot, true);
    setHidden(state.endDot, true);
    setHidden(state.label, true);
  }

  function setLine(line, start, end) {
    line.setAttribute('x1', start.x);
    line.setAttribute('y1', start.y);
    line.setAttribute('x2', end.x);
    line.setAttribute('y2', end.y);
  }

  function setCircle(circle, point) {
    circle.setAttribute('cx', point.x);
    circle.setAttribute('cy', point.y);
  }

  function setHidden(element, hidden) {
    if (hidden) {
      element.setAttribute('hidden', '');
    } else {
      element.removeAttribute('hidden');
    }
  }
})();
