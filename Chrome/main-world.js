(function () {
  const originalFetch = window.fetch;
  window.fetch = async function (...args) {
    const [url, options] = args;
    if (typeof url === 'string' && url.includes('/youtubei/v1/comment/create_comment') && options?.body) {
      try {
        const body = JSON.parse(options.body);
        const selected = window.__ytSelectedMediaForComment;
        if (selected) {
          body.imageAttachment = { imageUrl: selected.url };
          options.body = JSON.stringify(body);
          delete window.__ytSelectedMediaForComment;
        }
      } catch (e) {}
    }
    return originalFetch.apply(this, args);
  };
  window.addEventListener('message', (e) => {
    if (e.source !== window) return;
    if (e.data?.type === 'YT_MEDIA_SELECTED') {
      window.__ytSelectedMediaForComment = e.data.media;
    }
  });
})();