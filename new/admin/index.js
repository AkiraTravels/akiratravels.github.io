import { API_BASE, CLOUDINARY_CONFIG } from '../js/config.js';

// ---- 状態変数 ----
let countries = [];
let posts = [];
let mediaRows = [];
let editPostId = null;
let authToken = null;

// ---- 初期化 ----
(function init() {
  const token = sessionStorage.getItem('admin_token');
  if (token) {
    authToken = token;
    showAdminMain();
  } else {
    document.getElementById('login-screen').style.display = '';
  }

  // ログインボタン
  document.getElementById('btn-login').addEventListener('click', loginHandler);
  document.getElementById('login-password').addEventListener('keydown', e => {
    if (e.key === 'Enter') loginHandler();
  });

  // ログアウト
  document.getElementById('btn-logout').addEventListener('click', () => {
    authToken = null;
    sessionStorage.removeItem('admin_token');
    document.getElementById('admin-main').style.display = 'none';
    document.getElementById('header-user').style.display = 'none';
    document.getElementById('login-screen').style.display = '';
    document.getElementById('login-password').value = '';
  });

  // タブ切り替え
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      switchTab(tab);
      if (tab === 'post-list') renderPostList();
      if (tab === 'country-mgmt') renderCountryList();
    });
  });

  // メディア追加
  document.getElementById('btn-add-media').addEventListener('click', () => {
    mediaRows.push({ url: '', type: 'image', caption: '' });
    renderMediaList();
  });

  // 投稿保存
  document.getElementById('btn-submit').addEventListener('click', submitPost);

  // 編集キャンセル
  document.getElementById('btn-cancel-edit').addEventListener('click', resetPostForm);

  // 国フィルター変更
  document.getElementById('list-country-filter').addEventListener('change', renderPostList);

  // 国保存
  document.getElementById('btn-save-country').addEventListener('click', saveCountry);

  // 国キャンセル
  document.getElementById('btn-cancel-country').addEventListener('click', resetCountryForm);
})();

// ---- 認証 ----
async function loginHandler() {
  const password = document.getElementById('login-password').value;
  document.getElementById('login-error').textContent = '';
  try {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password })
    });
    if (!res.ok) throw new Error('Unauthorized');
    const { token } = await res.json();
    authToken = token;
    sessionStorage.setItem('admin_token', token);
    showAdminMain();
  } catch {
    document.getElementById('login-error').textContent =
      'ログインに失敗しました。パスワードを確認してください。';
  }
}

function showAdminMain() {
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('admin-main').style.display = '';
  document.getElementById('header-user').style.display = '';
  loadAll();
}

// ---- API ヘルパー ----
async function apiGet(path) {
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) throw new Error(`GET ${path} failed`);
  return res.json();
}

async function apiAuth(method, path, body) {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`
    },
    body: body ? JSON.stringify(body) : undefined
  });
  if (res.status === 401) {
    authToken = null;
    sessionStorage.removeItem('admin_token');
    location.reload();
    throw new Error('Unauthorized');
  }
  if (!res.ok) throw new Error(`${method} ${path} failed`);
  return res.json();
}

// ---- データロード ----
async function loadAll() {
  await Promise.all([loadCountries(), loadPosts()]);
}

async function loadCountries() {
  countries = await apiGet('/countries');
  populateCountrySelects();
}

async function loadPosts() {
  try {
    posts = await apiAuth('GET', '/posts');
  } catch {
    posts = [];
  }
}

function populateCountrySelects() {
  const prevF = document.getElementById('f-country').value;
  const prevL = document.getElementById('list-country-filter').value;

  ['f-country', 'list-country-filter'].forEach(id => {
    const sel = document.getElementById(id);
    const isFilter = id === 'list-country-filter';
    sel.innerHTML = isFilter
      ? '<option value="">すべての国</option>'
      : '<option value="">— 選択してください —</option>';
    countries.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.id;
      opt.textContent = c.flag ? `${c.flag} ${c.name}` : c.name;
      sel.appendChild(opt);
    });
  });

  document.getElementById('f-country').value = prevF;
  document.getElementById('list-country-filter').value = prevL;
}

// ---- タブ切り替え ----
function switchTab(name) {
  document.querySelectorAll('.tab-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.tab === name);
  });
  document.querySelectorAll('.tab-panel').forEach(p => {
    p.classList.toggle('active', p.id === `tab-${name}`);
  });
}

// ---- メディアリスト描画 ----
function renderMediaList() {
  const container = document.getElementById('media-list');
  container.innerHTML = '';

  mediaRows.forEach((m, idx) => {
    const row = document.createElement('div');
    row.className = 'media-row';

    // × ボタン
    const removeBtn = document.createElement('button');
    removeBtn.className = 'btn-remove-media';
    removeBtn.textContent = '×';
    removeBtn.addEventListener('click', () => {
      mediaRows.splice(idx, 1);
      renderMediaList();
    });
    row.appendChild(removeBtn);

    // ヘッダー行
    const header = document.createElement('div');
    header.className = 'media-row-header';

    // プレビュー
    const preview = document.createElement('div');
    preview.className = 'preview-wrap';
    if (m.url) {
      if (m.type === 'video') {
        const vid = document.createElement('video');
        vid.src = m.url;
        vid.preload = 'metadata';
        preview.appendChild(vid);
      } else {
        const img = document.createElement('img');
        img.src = m.url;
        img.alt = '';
        preview.appendChild(img);
      }
    } else {
      preview.textContent = 'No media';
    }
    header.appendChild(preview);

    // フィールド
    const fields = document.createElement('div');
    fields.className = 'media-row-fields';

    const urlInput = document.createElement('input');
    urlInput.type = 'url';
    urlInput.className = 'm-url';
    urlInput.placeholder = 'https://pub-xxx.r2.dev/media/...';
    urlInput.value = m.url;
    urlInput.addEventListener('change', () => {
      mediaRows[idx].url = urlInput.value;
      renderMediaList();
    });
    fields.appendChild(urlInput);

    const typeSelect = document.createElement('select');
    typeSelect.className = 'm-type';
    [['image', '📷 写真'], ['video', '🎬 動画']].forEach(([val, label]) => {
      const opt = document.createElement('option');
      opt.value = val;
      opt.textContent = label;
      if (m.type === val) opt.selected = true;
      typeSelect.appendChild(opt);
    });
    typeSelect.addEventListener('change', () => {
      mediaRows[idx].type = typeSelect.value;
    });
    fields.appendChild(typeSelect);

    const captionTA = document.createElement('textarea');
    captionTA.className = 'm-caption';
    captionTA.rows = 9;
    captionTA.placeholder = 'このメディアのキャプション（任意）';
    captionTA.value = m.caption || '';
    captionTA.addEventListener('input', () => {
      mediaRows[idx].caption = captionTA.value;
    });
    fields.appendChild(captionTA);

    header.appendChild(fields);
    row.appendChild(header);

    // コントロール行
    const controls = document.createElement('div');
    controls.className = 'media-row-controls';

    // 代表写真チェック
    const coverLabel = document.createElement('label');
    coverLabel.className = 'cover-checkbox-label';
    const coverCheck = document.createElement('input');
    coverCheck.type = 'checkbox';
    coverCheck.className = 'm-cover';
    coverCheck.addEventListener('change', async () => {
      if (!coverCheck.checked) return;
      const countryId = document.getElementById('f-country').value;
      if (!countryId || !m.url) return;
      try {
        await apiAuth('PUT', `/countries/${countryId}/cover`, { imgUrl: m.url });
        showToast('代表写真を更新しました');
      } catch {
        showToast('代表写真の更新に失敗しました', true);
      }
    });
    coverLabel.appendChild(coverCheck);
    coverLabel.appendChild(document.createTextNode(' ★ 代表写真'));
    controls.appendChild(coverLabel);

    // アップロードボタン
    const uploadBtn = document.createElement('button');
    uploadBtn.className = 'btn-upload';
    uploadBtn.textContent = '☁️ R2にアップロード';
    uploadBtn.addEventListener('click', () => uploadMedia(idx));
    controls.appendChild(uploadBtn);

    // ↑ボタン
    if (idx > 0) {
      const upBtn = document.createElement('button');
      upBtn.className = 'btn-move';
      upBtn.dataset.dir = 'up';
      upBtn.textContent = '↑';
      upBtn.addEventListener('click', () => {
        [mediaRows[idx - 1], mediaRows[idx]] = [mediaRows[idx], mediaRows[idx - 1]];
        renderMediaList();
      });
      controls.appendChild(upBtn);
    }

    // ↓ボタン
    if (idx < mediaRows.length - 1) {
      const downBtn = document.createElement('button');
      downBtn.className = 'btn-move';
      downBtn.dataset.dir = 'down';
      downBtn.textContent = '↓';
      downBtn.addEventListener('click', () => {
        [mediaRows[idx], mediaRows[idx + 1]] = [mediaRows[idx + 1], mediaRows[idx]];
        renderMediaList();
      });
      controls.appendChild(downBtn);
    }

    // 進捗表示
    const progress = document.createElement('span');
    progress.className = 'upload-progress';
    progress.id = `upload-progress-${idx}`;
    controls.appendChild(progress);

    row.appendChild(controls);
    container.appendChild(row);

    // 挿入ボタン
    const insertWrap = document.createElement('div');
    insertWrap.className = 'insert-btn-wrap';
    const insertBtn = document.createElement('button');
    insertBtn.className = 'btn-insert';
    insertBtn.textContent = '＋ ここに挿入';
    insertBtn.addEventListener('click', () => {
      mediaRows.splice(idx + 1, 0, { url: '', type: 'image', caption: '' });
      renderMediaList();
    });
    insertWrap.appendChild(insertBtn);
    container.appendChild(insertWrap);
  });
}

// ---- R2 アップロード ----
async function uploadMedia(idx) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*,video/*';

  input.addEventListener('change', async () => {
    const file = input.files[0];
    if (!file) return;
    const progressEl = document.getElementById(`upload-progress-${idx}`);
    if (progressEl) progressEl.textContent = 'アップロード中…';

    try {
      const isVideo = file.type.startsWith('video/');

      if (isVideo) {
        // 1. Cloudinary に一時アップロードして poster を取得
        const formData = new FormData();
        formData.append('file', file);
        formData.append('upload_preset', CLOUDINARY_CONFIG.uploadPreset);
        const cloudRes = await fetch(
          `https://api.cloudinary.com/v1_1/${CLOUDINARY_CONFIG.cloudName}/video/upload`,
          { method: 'POST', body: formData }
        );
        const { secure_url: cloudinaryVideoUrl } = await cloudRes.json();
        const posterCloudinaryUrl = cloudinaryVideoUrl.replace(/\.mp4$/i, '.webp');
        const posterBlob = await fetch(posterCloudinaryUrl).then(r => r.blob());

        // 2. R2 に動画アップロード
        const { uploadUrl: vidUploadUrl, publicUrl: vidPublicUrl } =
          await apiAuth('POST', '/media/upload-url', {
            filename: file.name,
            contentType: file.type
          });
        await fetch(vidUploadUrl, {
          method: 'PUT',
          body: file,
          headers: { 'Content-Type': file.type }
        });

        // 3. R2 に poster アップロード
        const posterFilename = file.name.replace(/\.mp4$/i, '.webp');
        const { uploadUrl: posterUploadUrl } =
          await apiAuth('POST', '/media/upload-url', {
            filename: posterFilename,
            contentType: 'image/webp'
          });
        await fetch(posterUploadUrl, {
          method: 'PUT',
          body: posterBlob,
          headers: { 'Content-Type': 'image/webp' }
        });

        mediaRows[idx].url = vidPublicUrl;
        mediaRows[idx].type = 'video';

      } else {
        // 画像アップロード
        const { uploadUrl, publicUrl } =
          await apiAuth('POST', '/media/upload-url', {
            filename: file.name,
            contentType: file.type
          });
        await fetch(uploadUrl, {
          method: 'PUT',
          body: file,
          headers: { 'Content-Type': file.type }
        });
        mediaRows[idx].url = publicUrl;
        mediaRows[idx].type = 'image';
      }

      renderMediaList();
      if (progressEl) {
        progressEl.textContent = '✓ アップロード完了';
        progressEl.className = 'upload-progress success';
        setTimeout(() => {
          progressEl.textContent = '';
          progressEl.className = 'upload-progress';
        }, 2000);
      }
    } catch (e) {
      if (progressEl) {
        progressEl.textContent = `エラー: ${e.message}`;
        progressEl.className = 'upload-progress error';
      }
    }
  });

  input.click();
}

// ---- 投稿保存 ----
async function submitPost() {
  const countryId = document.getElementById('f-country').value;
  const date = document.getElementById('f-date').value;
  const title = document.getElementById('f-title').value.trim();
  const location = document.getElementById('f-location').value.trim();
  const caption = document.getElementById('f-caption').value.trim();

  if (!countryId) { showToast('国を選択してください', true); return; }
  if (!date)      { showToast('日付を入力してください', true); return; }
  if (!title)     { showToast('タイトルを入力してください', true); return; }

  const postData = {
    countryId, date, title, location, caption,
    media: mediaRows.map(m => ({
      url:     m.url     || '',
      type:    m.type    || 'image',
      caption: m.caption || ''
    }))
  };

  try {
    if (editPostId === null) {
      await apiAuth('POST', '/posts', postData);
      showToast('投稿を保存しました');
    } else {
      await apiAuth('PUT', `/posts/${editPostId}`, postData);
      showToast('投稿を更新しました');
    }
    resetPostForm();
    await loadPosts();
  } catch (e) {
    showToast(`保存に失敗しました: ${e.message}`, true);
  }
}

function resetPostForm() {
  editPostId = null;
  mediaRows = [];
  document.getElementById('f-country').value = '';
  document.getElementById('f-date').value = '';
  document.getElementById('f-title').value = '';
  document.getElementById('f-location').value = '';
  document.getElementById('f-caption').value = '';
  document.getElementById('form-title').textContent = '新規投稿';
  document.getElementById('btn-submit').textContent = '投稿する';
  document.getElementById('btn-cancel-edit').style.display = 'none';
  renderMediaList();
}

// ---- 投稿編集 ----
function editPost(post) {
  switchTab('new-post');
  editPostId = post.id;
  document.getElementById('f-country').value = post.countryId;
  document.getElementById('f-date').value = post.date;
  document.getElementById('f-title').value = post.title;
  document.getElementById('f-location').value = post.location || '';
  document.getElementById('f-caption').value = post.caption || '';
  mediaRows = (post.media || []).map(m => ({ ...m }));
  renderMediaList();
  document.getElementById('form-title').textContent = '投稿を編集';
  document.getElementById('btn-submit').textContent = '更新する';
  document.getElementById('btn-cancel-edit').style.display = '';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ---- 投稿一覧 ----
function renderPostList() {
  const container = document.getElementById('post-list-container');
  const filterVal = document.getElementById('list-country-filter').value;

  let filtered = posts;
  if (filterVal) {
    filtered = posts.filter(p => p.countryId === filterVal);
  }
  // date 降順
  filtered = [...filtered].sort((a, b) => b.date.localeCompare(a.date));

  if (filtered.length === 0) {
    container.innerHTML = '<p style="color:var(--muted);text-align:center;padding:24px;">投稿がありません</p>';
    return;
  }

  container.innerHTML = '';
  filtered.forEach(post => {
    const country = countries.find(c => c.id === post.countryId);
    const countryName = country ? country.name : '不明';
    const thumbMedia = (post.media || []).find(m => m.type === 'image');
    const mediaCount = (post.media || []).length;

    const item = document.createElement('div');
    item.className = 'post-list-item';

    const thumb = document.createElement('div');
    thumb.className = 'post-thumbnail';
    if (thumbMedia) {
      const img = document.createElement('img');
      img.src = thumbMedia.url;
      img.alt = post.title;
      thumb.appendChild(img);
    } else {
      thumb.textContent = '📷';
    }

    const info = document.createElement('div');
    info.className = 'post-info';
    const titleEl = document.createElement('div');
    titleEl.className = 'post-title-text';
    titleEl.textContent = post.title;
    const meta = document.createElement('div');
    meta.className = 'post-meta-text';
    meta.textContent = `${countryName} ／ ${post.date} ／ 📎 ${mediaCount}件`;
    info.appendChild(titleEl);
    info.appendChild(meta);

    const actions = document.createElement('div');
    actions.className = 'post-actions';
    const editBtn = document.createElement('button');
    editBtn.className = 'btn-edit';
    editBtn.textContent = '編集';
    editBtn.addEventListener('click', () => editPost(post));
    const delBtn = document.createElement('button');
    delBtn.className = 'btn-danger';
    delBtn.textContent = '削除';
    delBtn.addEventListener('click', async () => {
      if (!confirm(`「${post.title}」を削除しますか？`)) return;
      try {
        await apiAuth('DELETE', `/posts/${post.id}`);
        showToast('投稿を削除しました');
        await loadPosts();
        renderPostList();
      } catch (e) {
        showToast(`削除に失敗しました: ${e.message}`, true);
      }
    });
    actions.appendChild(editBtn);
    actions.appendChild(delBtn);

    item.appendChild(thumb);
    item.appendChild(info);
    item.appendChild(actions);
    container.appendChild(item);
  });
}

// ---- 国管理 ----
function renderCountryList() {
  const container = document.getElementById('country-list-container');

  if (countries.length === 0) {
    container.innerHTML = '<p style="color:var(--muted);text-align:center;padding:24px;">国データがありません</p>';
    return;
  }

  // 投稿数集計
  const postCount = {};
  posts.forEach(p => {
    postCount[p.countryId] = (postCount[p.countryId] || 0) + 1;
  });

  container.innerHTML = '';
  countries.forEach(c => {
    const count = postCount[c.id] || 0;
    const item = document.createElement('div');
    item.className = 'country-list-item';

    const flagCell = document.createElement('div');
    flagCell.className = 'country-flag-cell';
    flagCell.textContent = c.flag || '🌐';

    const info = document.createElement('div');
    info.className = 'country-item-info';
    const name = document.createElement('div');
    name.className = 'country-item-name';
    name.textContent = c.name;
    const meta = document.createElement('div');
    meta.className = 'country-item-meta';
    meta.textContent = `表示順: ${c.order} ／ 投稿: ${count}件`;
    info.appendChild(name);
    info.appendChild(meta);

    const actions = document.createElement('div');
    actions.className = 'country-item-actions';
    const editBtn = document.createElement('button');
    editBtn.className = 'btn-edit';
    editBtn.textContent = '編集';
    editBtn.addEventListener('click', () => editCountry(c));
    const delBtn = document.createElement('button');
    delBtn.className = 'btn-danger';
    delBtn.textContent = '削除';
    if (count > 0) {
      delBtn.disabled = true;
      delBtn.title = '投稿がある国は削除できません';
    }
    delBtn.addEventListener('click', async () => {
      if (!confirm(`「${c.name}」を削除しますか？`)) return;
      try {
        await apiAuth('DELETE', `/countries/${c.id}`);
        showToast('国を削除しました');
        await loadAll();
        renderCountryList();
      } catch (e) {
        showToast(`削除に失敗しました: ${e.message}`, true);
      }
    });
    actions.appendChild(editBtn);
    actions.appendChild(delBtn);

    item.appendChild(flagCell);
    item.appendChild(info);
    item.appendChild(actions);
    container.appendChild(item);
  });
}

async function saveCountry() {
  const editId = document.getElementById('edit-country-id').value;
  const name = document.getElementById('c-name').value.trim();
  const flag = document.getElementById('c-flag').value.trim();
  const order = Number(document.getElementById('c-order').value);
  const sub = document.getElementById('c-subtitle').value.trim();
  const desc = document.getElementById('c-description').value.trim();

  if (!name) { showToast('国名を入力してください', true); return; }

  const data = { name, flag, order, subtitle: sub, description: desc };
  try {
    if (editId) {
      await apiAuth('PUT', `/countries/${editId}`, data);
      showToast('国を更新しました');
    } else {
      await apiAuth('POST', '/countries', data);
      showToast('国を追加しました');
    }
    resetCountryForm();
    await loadAll();
    renderCountryList();
  } catch (e) {
    showToast(`保存に失敗しました: ${e.message}`, true);
  }
}

function editCountry(c) {
  document.getElementById('edit-country-id').value = c.id;
  document.getElementById('c-name').value = c.name;
  document.getElementById('c-flag').value = c.flag || '';
  document.getElementById('c-order').value = c.order;
  document.getElementById('c-subtitle').value = c.subtitle || '';
  document.getElementById('c-description').value = c.description || '';
  document.getElementById('country-form-title').textContent = '国を編集';
  document.getElementById('btn-save-country').textContent = '更新';
  document.getElementById('btn-cancel-country').style.display = '';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function resetCountryForm() {
  document.getElementById('edit-country-id').value = '';
  document.getElementById('c-name').value = '';
  document.getElementById('c-flag').value = '';
  document.getElementById('c-order').value = '100';
  document.getElementById('c-subtitle').value = '';
  document.getElementById('c-description').value = '';
  document.getElementById('country-form-title').textContent = '国を追加';
  document.getElementById('btn-save-country').textContent = '保存';
  document.getElementById('btn-cancel-country').style.display = 'none';
}

// ---- トースト通知 ----
function showToast(msg, isError = false) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.className = 'toast' + (isError ? ' error' : '');
  void toast.offsetWidth;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3000);
}
