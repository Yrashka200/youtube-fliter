(function () {
  const PICKER_ID = 'yt-gif-picker-panel';
  const BTN_CLASS = 'yt-gif-picker-btn';
  const GIPHY_KEY = '9IfvGcUS3Yj01nE4Awiq27cOEVaioRnB';

  let selectedMedia = null;

  window.injectGifButton = function (commentBox) {
    if (commentBox.querySelector('.' + BTN_CLASS)) return;
    const btn = document.createElement('button');
    btn.className = BTN_CLASS;
    btn.textContent = 'GIF/🖼';
    btn.style.cssText = 'margin-left:6px;padding:4px 8px;background:#333;color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:12px;';
    btn.onclick = (e) => { e.stopPropagation(); openPicker(commentBox); };
    const toolbar = commentBox.querySelector('#toolbar, .toolbar, ytd-commentbox #buttons');
    if (toolbar) toolbar.appendChild(btn);
    else commentBox.appendChild(btn);
  };

  function openPicker(commentBox) {
    closePicker();
    const panel = document.createElement('div');
    panel.id = PICKER_ID;
    panel.style.cssText = 'position:absolute;z-index:9999;background:#212121;border:1px solid #444;border-radius:8px;padding:12px;width:360px;box-shadow:0 8px 24px rgba(0,0,0,.6);color:#eee;font-size:13px;';
    const rect = commentBox.getBoundingClientRect();
    panel.style.top = (rect.bottom + 8) + 'px';
    panel.style.left = rect.left + 'px';
    panel.innerHTML = `
      <div style="display:flex;gap:6px;margin-bottom:8px;">
        <input id="yt-gif-search-input" type="text" placeholder="Поиск GIF..." style="flex:1;padding:6px 8px;background:#333;border:1px solid #555;border-radius:4px;color:#fff;">
        <button id="yt-gif-search-btn" style="padding:6px 12px;background:#ff0000;border:none;border-radius:4px;color:#fff;cursor:pointer;">Поиск</button>
      </div>
      <div id="yt-gif-results" style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;max-height:240px;overflow-y:auto;"></div>
      <div style="margin-top:8px;padding-top:8px;border-top:1px solid #444;display:flex;justify-content:space-between;">
        <button id="yt-gif-close" style="padding:4px 10px;background:#333;border:none;border-radius:4px;color:#ccc;cursor:pointer;">Закрыть</button>
        <span id="yt-gif-selected-label" style="color:#888;font-size:11px;align-self:center;">Не выбрано</span>
      </div>`;
    document.body.appendChild(panel);
    panel.querySelector('#yt-gif-close').onclick = closePicker;
    panel.querySelector('#yt-gif-search-btn').onclick = doSearch;
    panel.querySelector('#yt-gif-search-input').onkeydown = (e) => { if (e.key === 'Enter') doSearch(); };
  }

  async function doSearch() {
    const input = document.getElementById('yt-gif-search-input');
    const q = input?.value.trim();
    if (!q) return;
    const results = document.getElementById('yt-gif-results');
    results.innerHTML = '<div style="grid-column:1/-1;color:#888;text-align:center;">Поиск...</div>';
    const gifs = await fetchGifs(q);
    if (!gifs.length) {
      results.innerHTML = '<div style="grid-column:1/-1;color:#888;text-align:center;">Ничего не найдено</div>';
      return;
    }
    results.innerHTML = '';
    gifs.forEach((g) => {
      const img = document.createElement('img');
      img.src = g.preview;
      img.style.cssText = 'width:100%;height:80px;object-fit:cover;border-radius:4px;cursor:pointer;';
      img.onclick = () => {
        selectedMedia = { url: g.url, type: 'gif' };
        document.getElementById('yt-gif-selected-label').textContent = '✔ Выбрано';
        img.style.outline = '2px solid #ff0000';
        window.postMessage({ type: 'YT_MEDIA_SELECTED', media: selectedMedia }, '*');
      };
      results.appendChild(img);
    });
  }

  async function fetchGifs(query) {
    if (GIPHY_KEY === 'YOUR_GIPHY_API_KEY') return [];
    try {
      const res = await fetch(`https://api.giphy.com/v1/gifs/search?api_key=${GIPHY_KEY}&q=${encodeURIComponent(query)}&limit=9&rating=g`);
      const data = await res.json();
      return (data.data || []).map((g) => ({
        url: g.images.original.url,
        preview: g.images.fixed_height_small.url
      }));
    } catch (e) {
      return [];
    }
  }

  function closePicker() {
    const p = document.getElementById(PICKER_ID);
    if (p) p.remove();
  }
})();