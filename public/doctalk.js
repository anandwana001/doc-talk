/**
 * DocTalk SDK — drop-in voice assistant for any documentation site.
 *
 * Usage (add to any HTML page):
 *   <script src="https://your-doctalk.app/doctalk.js"></script>
 *   <script>DocTalk.init({ apiBase: 'https://your-doctalk.app' })</script>
 *
 * Options:
 *   apiBase   — URL of the running DocTalk server (required)
 *   label     — button label (default: "Talk to Docs")
 *   position  — "bottom-right" | "bottom-left" (default: "bottom-right")
 *   color     — button background color (default: "#2563eb")
 */
(function (global) {
  'use strict';

  if (global.DocTalk) return; // already loaded

  var DocTalk = {};

  DocTalk.init = function (opts) {
    var options = Object.assign(
      { apiBase: '', label: 'Talk to Docs', position: 'bottom-right', color: '#2563eb' },
      opts || {}
    );

    if (!options.apiBase) {
      console.error('[DocTalk] apiBase is required');
      return;
    }

    var isRight = options.position !== 'bottom-left';
    var open = false;

    // --- Container (fixed position wrapper) ---
    var container = document.createElement('div');
    container.style.cssText = [
      'position:fixed',
      'bottom:24px',
      (isRight ? 'right:24px' : 'left:24px'),
      'z-index:2147483647',
      'display:flex',
      'flex-direction:column',
      'align-items:' + (isRight ? 'flex-end' : 'flex-start'),
      'gap:12px',
      'font-family:system-ui,-apple-system,sans-serif',
    ].join(';');

    // --- Panel ---
    var panel = document.createElement('div');
    panel.style.cssText = [
      'display:none',
      'width:360px',
      'height:520px',
      'border-radius:16px',
      'overflow:hidden',
      'box-shadow:0 24px 64px rgba(0,0,0,0.18)',
      'border:1px solid rgba(0,0,0,0.08)',
      'background:#fff',
      'flex-direction:column',
    ].join(';');

    // Panel header
    var header = document.createElement('div');
    header.style.cssText = [
      'display:flex',
      'align-items:center',
      'justify-content:space-between',
      'padding:12px 16px',
      'border-bottom:1px solid rgba(0,0,0,0.07)',
      'background:#fafafa',
      'flex-shrink:0',
    ].join(';');

    var titleWrap = document.createElement('div');
    titleWrap.style.cssText = 'display:flex;align-items:center;gap:8px';
    var icon = document.createElement('span');
    icon.textContent = '🎙️';
    icon.style.fontSize = '16px';
    var title = document.createElement('span');
    title.textContent = options.label;
    title.style.cssText = 'font-size:14px;font-weight:600;color:#111';
    titleWrap.appendChild(icon);
    titleWrap.appendChild(title);

    var closeBtn = document.createElement('button');
    closeBtn.textContent = '×';
    closeBtn.setAttribute('aria-label', 'Close');
    closeBtn.style.cssText = [
      'background:none',
      'border:none',
      'cursor:pointer',
      'padding:2px 6px',
      'border-radius:4px',
      'color:#666',
      'font-size:20px',
      'line-height:1',
    ].join(';');
    closeBtn.addEventListener('click', function () { toggle(false); });

    header.appendChild(titleWrap);
    header.appendChild(closeBtn);

    // Iframe
    var iframe = document.createElement('iframe');
    iframe.setAttribute('allow', 'microphone');
    iframe.setAttribute('title', 'DocTalk Voice Assistant');
    iframe.style.cssText = 'flex:1;border:none;display:block;width:100%;height:100%';

    panel.appendChild(header);
    panel.appendChild(iframe);

    // --- Floating button ---
    var btn = document.createElement('button');
    btn.setAttribute('aria-label', options.label);
    btn.style.cssText = [
      'display:flex',
      'align-items:center',
      'gap:8px',
      'background:' + options.color,
      'color:#fff',
      'border:none',
      'border-radius:50px',
      'padding:12px 20px',
      'font-size:14px',
      'font-weight:600',
      'cursor:pointer',
      'box-shadow:0 4px 16px rgba(0,0,0,0.25)',
      'font-family:system-ui,-apple-system,sans-serif',
      'white-space:nowrap',
    ].join(';');

    var micSvg = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>';
    var closeSvg = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';

    function setButtonState(isOpen) {
      btn.innerHTML = (isOpen ? closeSvg : micSvg) + '<span>' + (isOpen ? 'Close' : options.label) + '</span>';
    }

    function toggle(forceOpen) {
      open = typeof forceOpen === 'boolean' ? forceOpen : !open;
      if (open) {
        // Lazy-load iframe only when panel opens for the first time.
        // Pass the host page title + path as context so MiniSearch can load
        // the most relevant doc chunks for what the user is reading.
        if (!iframe.src) {
          var ctx = encodeURIComponent((document.title || '') + ' ' + window.location.pathname);
          iframe.src = options.apiBase.replace(/\/$/, '') + '/embed?ctx=' + ctx;
        }
        panel.style.display = 'flex';
      } else {
        panel.style.display = 'none';
      }
      setButtonState(open);
    }

    btn.addEventListener('click', function () { toggle(); });
    setButtonState(false);

    container.appendChild(panel);
    container.appendChild(btn);
    document.body.appendChild(container);
  };

  global.DocTalk = DocTalk;
})(window);
