(() => {
  'use strict';

  const LIST_PATHNAME = '/';
  const LIST_API_PATH = '/api/public/affidavit';
  const LINKABLE_STATUSES = new Set(['pending', 'returned']);
  let lastSearchRows = [];
  let patchScheduled = false;

  const isListPage = () => window.location.pathname === LIST_PATHNAME;

  const getDetailHref = (row) => `/affidavit/${row.id}/affidavit-document`;

  const isSearchListResponse = (url, payload) => {
    if (!payload || !Array.isArray(payload.data)) return false;

    const parsedUrl = new URL(url, window.location.origin);
    return parsedUrl.pathname === LIST_API_PATH && parsedUrl.searchParams.has('page');
  };

  const captureRows = (url, payload) => {
    if (!isSearchListResponse(url, payload)) return;

    lastSearchRows = payload.data;
    schedulePatch();
  };

  const interceptFetch = () => {
    const originalFetch = window.fetch.bind(window);
    window.fetch = async (...args) => {
      const response = await originalFetch(...args);

      try {
        const requestUrl = typeof args[0] === 'string' ? args[0] : args[0]?.url;
        const cloned = response.clone();
        const contentType = cloned.headers.get('content-type') || '';

        if (contentType.includes('application/json')) {
          captureRows(requestUrl, await cloned.json());
        }
      } catch (error) {
        console.debug('Failed to inspect fetch response', error);
      }

      return response;
    };
  };

  const interceptXhr = () => {
    const originalOpen = XMLHttpRequest.prototype.open;
    const originalSend = XMLHttpRequest.prototype.send;

    XMLHttpRequest.prototype.open = function open(method, url, ...rest) {
      this.__browserMirrorUrl = url;
      return originalOpen.call(this, method, url, ...rest);
    };

    XMLHttpRequest.prototype.send = function send(body) {
      this.addEventListener('load', function onLoad() {
        try {
          const contentType = this.getResponseHeader('content-type') || '';
          if (!contentType.includes('application/json') || typeof this.responseText !== 'string') return;

          captureRows(this.__browserMirrorUrl, JSON.parse(this.responseText));
        } catch (error) {
          console.debug('Failed to inspect XHR response', error);
        }
      });

      return originalSend.call(this, body);
    };
  };

  const linkCell = (cell, href) => {
    const label = cell?.querySelector('.datatable-body-cell-label');
    if (!label || label.querySelector('.browser-result-link')) return;

    const anchor = document.createElement('a');
    anchor.className = 'browser-result-link';
    anchor.href = href;
    anchor.style.display = 'flex';
    anchor.style.alignItems = 'center';
    anchor.style.width = '100%';
    anchor.style.minHeight = '100%';
    anchor.style.color = 'inherit';
    anchor.style.textDecoration = 'underline';
    anchor.style.textUnderlineOffset = '2px';

    while (label.firstChild) {
      anchor.appendChild(label.firstChild);
    }

    label.appendChild(anchor);
  };

  const patchRowLinks = () => {
    patchScheduled = false;

    if (!isListPage() || !lastSearchRows.length) return;

    const rows = document.querySelectorAll('.datatable-body-row');
    if (!rows.length) return;

    rows.forEach((rowElement, index) => {
      const row = lastSearchRows[index];
      if (!row || !row.id || LINKABLE_STATUSES.has(row.status)) return;

      const cells = rowElement.querySelectorAll('.datatable-row-center datatable-body-cell');
      const href = getDetailHref(row);

      linkCell(cells[1], href);
      linkCell(cells[2], href);
    });
  };

  const schedulePatch = () => {
    if (patchScheduled) return;
    patchScheduled = true;
    window.requestAnimationFrame(patchRowLinks);
  };

  const installStyles = () => {
    const style = document.createElement('style');
    style.textContent = `
      .browser-result-link:hover {
        text-decoration-thickness: 2px;
      }
    `;
    document.head.appendChild(style);
  };

  interceptFetch();
  interceptXhr();
  installStyles();

  const observer = new MutationObserver(() => {
    if (isListPage() && lastSearchRows.length) schedulePatch();
  });

  observer.observe(document.documentElement, { childList: true, subtree: true });
})();
