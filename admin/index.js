import { API_BASE, CLOUDINARY_CONFIG } from '../js/config.js';

// ── 状態変数 ──
let countries  = [];
let posts      = [];
let mediaRows  = [];
let editPostId = null;
let authToken  = null;

// ============================================================
// 初期化
// ============================================================
(function init() {
  const token = sessionStorage.getItem('admin_token');
  if (token) {
    authToken = token;
    showAdminMain();
  } else {
    document.getElementById('login-screen').style.display = '';
  }

  // ── イベント登録 ──
  document.getElementById('btn-login').addEventListener('click', loginHandler);
  document.getElementById('login-password').addEventListener('keydown', e => {
    if (e.key === 'Enter') loginHandler();
  });
  document.getElementById('btn-logout').addEventListener('click', logout);

  // タブ切り替え
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      switchTab(btn.dataset.tab);
    });
  });

  // 新規投稿フォーム
  document.getElementById('btn-submit').addEventListener('click', submitPost);
  document.getElementById('btn-cancel-edit').addEventListener('click', resetPostForm);
  document.getElementById('btn-add-media').addEventListener('click', () => {
    mediaRows.push({ url: '', type: 'image', caption: '' });
    renderMediaList();
  });

  // 国管理フォーム
  document.getElementById('btn-save-country').addEventListener('click', saveCountry);
  document.getElementById('btn-cancel-country').addEventListener('click', resetCountryForm);

  // 投稿一覧フィルター
  document.getElementById('list-country-filter').addEventListener('change', renderPostList);
})();

// ============================================================
// 認証
// ============================================================
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
    document.getElementById('login-screen').style.display = 'none';
    showAdminMain();
  } catch {
    document.getElementById('login-error').textContent =
      'ログインに失敗しました。パスワードを確認してください。';
  }
}

function logout() {
  authToken = null;
  sessionStorage.removeItem('admin_token');
  document.getElementById('admin-main').style.display = 'none';
  document.getElementById('header-user').style.display = 'none';
  document.getElementById('login-screen').style.display = '';
  document.getElementById('login-password').value = '';
}

function showAdminMain() {
  document.getElementById('admin-main').style.display = '';
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('header-user').style.display = '';
  loadAll();
}

// ============================================================
// API ヘルパー
// ============================================================
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

// ============================================================
// データロード
// ============================================================
async function loadAll() {
  await Promise.all([loadCountries(), loadPosts()]);
}

async function loadCountries() {
  try {
    countries = await apiGet('/countries');
    populateCountrySelects();
  } catch (e) {
    showToast('国データの取得に失敗しました', true);
  }
}

async function loadPosts() {
  try {
    posts = await apiGet('/posts');
  } catch {
    // 認証なし GET /posts は失敗する場合があるため apiAuth で再取得
    try {
      const res = await fetch(`${API_BASE}/posts`, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      if (!res.ok) throw new Error();
      posts = await res.json();
    } catch {
      showToast('投稿データの取得に失敗しました', true);
    }
  }
}

function populateCountrySelects() {
  const fCountry = document.getElementById('f-country');
  const fFilter  = document.getElementById('list-country-filter');
  const prevF    = fCountry.value;
  const prevFilt = fFilter.value;

  fCountry.innerHTML = '<option value="">— 選択してください —</option>';
  fFilter.innerHTML  = '<option value="">すべての国</option>';

  countries.forEach(c => {
    const label = c.flag ? `${c.flag} ${c.name}` : c.name;
    const o1 = new Option(label, c.id);
    const o2 = new Option(label, c.id);
    fCountry.appendChild(o1);
    fFilter.appendChild(o2);
  });

  fCountry.value = prevF;
  fFilter.value  = prevFilt;
}

// ============================================================
// タブ切り替え
// ============================================================
function switchTab(name) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === name));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.toggle('active', p.id === `tab-${name}`));
  if (name === 'post-list')    renderPostList();
  if (name === 'country-mgmt') renderCountryList();
}

// ============================================================
// メディアリスト描画
// ============================================================
function renderMediaList() {
  const listEl = document.getElementById('media-list');
  listEl.innerHTML = '';

  mediaRows.forEach((m, idx) => {
    const row = document.createElement('div');
    row.className = 'media-row';

    // × ボタン
    const removeBtn = document.createElement('button');
    removeBtn.className = 'btn-remove-media';
    removeBtn.textContent = '×';
    removeBtn.onclick = () => { mediaRows.splice(idx, 1); renderMediaList(); };
    row.appendChild(removeBtn);

    // ヘッダー（プレビュー + フィールド）
    const header = document.createElement('div');
    header.className = 'media-row-header';

    // プレビュー
    const preview = document.createElement('div');
    preview.className = 'preview-wrap';
    if (m.url && m.type === 'video') {
      const vid = document.createElement('video');
      vid.src = m.url;
      vid.preload = 'metadata';
      preview.appendChild(vid);
    } else if (m.url && m.type === 'image') {
      const img = document.createElement('img');
      img.src = m.url;
      img.alt = '';
      preview.appendChild(img);
    } else {
      preview.textContent = 'No media';
    }

    // フィールド群
    const fields = document.createElement('div');
    fields.className = 'media-row-fields';

    const urlInput = document.createElement('input');
    urlInput.type = 'url';
    urlInput.className = 'm-url';
    urlInput.placeholder = 'https://pub-xxx.r2.dev/media/...';
    urlInput.value = m.url;
    urlInput.addEventListener('change', () => { mediaRows[idx].url = urlInput.value; renderMediaList(); });

    const typeSelect = document.createElement('select');
    typeSelect.className = 'm-type';
    ['image', 'video'].forEach(t => {
      const opt = new Option(t === 'image' ? '📷 写真' : '🎬 動画', t, t === m.type, t === m.type);
      typeSelect.appendChild(opt);
    });
    typeSelect.addEventListener('change', () => { mediaRows[idx].type = typeSelect.value; });

    const capTa = document.createElement('textarea');
    capTa.className = 'm-caption';
    capTa.rows = 9;
    capTa.placeholder = 'このメディアのキャプション（任意）';
    capTa.value = m.caption;
    capTa.addEventListener('input', () => { mediaRows[idx].caption = capTa.value; });

    fields.appendChild(urlInput);
    fields.appendChild(typeSelect);
    fields.appendChild(capTa);

    header.appendChild(preview);
    header.appendChild(fields);
    row.appendChild(header);

    // コントロール群
    const controls = document.createElement('div');
    controls.className = 'media-row-controls';

    // 代表写真チェック
    const coverLabel = document.createElement('label');
    coverLabel.className = 'cover-checkbox-label';
    const coverCb = document.createElement('input');
    coverCb.type = 'checkbox';
    coverCb.className = 'm-cover';
    coverCb.addEventListener('change', async () => {
      if (!coverCb.checked) return;
      const countryId = document.getElementById('f-country').value;
      if (!countryId) { showToast('国を先に選択してください', true); coverCb.checked = false; return; }
      try {
        await apiAuth('PUT', `/countries/${countryId}/cover`, { imgUrl: m.url });
        showToast('代表写真を更新しました');
      } catch {
        showToast('代表写真の更新に失敗しました', true);
        coverCb.checked = false;
      }
    });
    coverLabel.appendChild(coverCb);
    coverLabel.appendChild(document.createTextNode(' ★ 代表写真'));
    controls.appendChild(coverLabel);

    // アップロードボタン
    const uploadBtn = document.createElement('button');
    uploadBtn.className = 'btn-upload';
    uploadBtn.textContent = '☁️ R2にアップロード';
    uploadBtn.onclick = () => uploadMedia(idx);
    controls.appendChild(uploadBtn);

    // 上下ボタン
    if (idx > 0) {
      const upBtn = document.createElement('button');
      upBtn.className = 'btn-move';
      upBtn.dataset.dir = 'up';
      upBtn.textContent = '↑';
      upBtn.onclick = () => {
        [mediaRows[idx - 1], mediaRows[idx]] = [mediaRows[idx], mediaRows[idx - 1]];
        renderMediaList();
      };
      controls.appendChild(upBtn);
    }
    if (idx < mediaRows.length - 1) {
      const downBtn = document.createElement('button');
      downBtn.className = 'btn-move';
      downBtn.dataset.dir = 'down';
      downBtn.textContent = '↓';
      downBtn.onclick = () => {
        [mediaRows[idx], mediaRows[idx + 1]] = [mediaRows[idx + 1], mediaRows[idx]];
        renderMediaList();
      };
      controls.appendChild(downBtn);
    }

    // 進捗表示
    const progress = document.createElement('span');
    progress.className = 'upload-progress';
    progress.id = `upload-progress-${idx}`;
    controls.appendChild(progress);

    row.appendChild(controls);
    listEl.appendChild(row);

    // 挿入ボタン
    const insertWrap = document.createElement('div');
    insertWrap.className = 'insert-btn-wrap';
    const insertBtn = document.createElement('button');
    insertBtn.className = 'btn-insert';
    insertBtn.textContent = '＋ ここに挿入';
    insertBtn.onclick = () => {
      mediaRows.splice(idx + 1, 0, { url: '', type: 'image', caption: '' });
      renderMediaList();
    };
    insertWrap.appendChild(insertBtn);
    listEl.appendChild(insertWrap);
  });
}

// ============================================================
// R2 アップロード
// ============================================================
async function uploadMedia(idx) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*,video/*';
  input.click();

  input.onchange = async () => {
    const file = input.files[0];
    if (!file) return;

    const progressEl = document.getElementById(`upload-progress-${idx}`);
    progressEl.textContent = 'アップロード中…';
    progressEl.className = 'upload-progress';

    try {
      if (file.type.startsWith('video/')) {
        await uploadVideo(file, idx, progressEl);
      } else {
        await uploadImage(file, idx, progressEl);
      }
    } catch (e) {
      progressEl.textContent = `エラー: ${e.message}`;
      progressEl.className = 'upload-progress error';
    }
  };
}

async function uploadImage(file, idx, progressEl) {
  const form = new FormData();
  form.append('file', file, file.name);
  form.append('filename', file.name);
  form.append('contentType', file.type);
  const res = await fetch(`${API_BASE}/media/upload`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${authToken}` },
    body: form
  });
  if (!res.ok) throw new Error('アップロード失敗');
  const { publicUrl } = await res.json();

  mediaRows[idx].url  = publicUrl;
  mediaRows[idx].type = 'image';
  renderMediaList();

  progressEl.textContent = '✓ アップロード完了';
  progressEl.className = 'upload-progress success';
  setTimeout(() => { if (progressEl) progressEl.textContent = ''; }, 2000);
}

async function uploadVideo(file, idx, progressEl) {
  // 1. Cloudinary に一時アップロード（poster 取得用）
  const cloudForm = new FormData();
  cloudForm.append('file', file);
  cloudForm.append('upload_preset', CLOUDINARY_CONFIG.uploadPreset);
  const cloudRes = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUDINARY_CONFIG.cloudName}/video/upload`,
    { method: 'POST', body: cloudForm }
  );
  if (!cloudRes.ok) throw new Error('Cloudinaryアップロード失敗');
  const { secure_url: cloudinaryVideoUrl } = await cloudRes.json();

  // 2. Cloudinary 変換 URL で poster を取得
  const uploadIdx = cloudinaryVideoUrl.indexOf('upload/') + 'upload/'.length;
  const partA = cloudinaryVideoUrl.slice(0, uploadIdx);
  const partB = cloudinaryVideoUrl.slice(uploadIdx);
  const posterCloudinaryUrl = (partA + 'so_0/l_play_muwwou/' + partB).replace(/\.mp4$/i, '.webp');
  const posterBlob = await fetch(posterCloudinaryUrl).then(r => r.blob());

  // 3. R2 へ動画アップロード
  const videoForm = new FormData();
  videoForm.append('file', file, file.name);
  videoForm.append('filename', file.name);
  videoForm.append('contentType', file.type);
  const videoRes = await fetch(`${API_BASE}/media/upload`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${authToken}` },
    body: videoForm
  });
  if (!videoRes.ok) throw new Error('動画アップロード失敗');
  const { publicUrl: videoPublicUrl } = await videoRes.json();

  // 4. R2 へ poster アップロード
  const posterFilename = file.name.replace(/\.[^.]+$/, '.webp');
  const posterForm = new FormData();
  posterForm.append('file', posterBlob, posterFilename);
  posterForm.append('filename', posterFilename);
  posterForm.append('contentType', 'image/webp');
  await fetch(`${API_BASE}/media/upload`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${authToken}` },
    body: posterForm
  });

  mediaRows[idx].url  = videoPublicUrl;
  mediaRows[idx].type = 'video';
  renderMediaList();

  progressEl.textContent = '✓ アップロード完了';
  progressEl.className = 'upload-progress success';
  setTimeout(() => { if (progressEl) progressEl.textContent = ''; }, 2000);
}

// ============================================================
// 投稿保存
// ============================================================
async function submitPost() {
  const countryId = document.getElementById('f-country').value;
  const date      = document.getElementById('f-date').value;
  const title     = document.getElementById('f-title').value.trim();
  const location  = document.getElementById('f-location').value.trim();
  const caption   = document.getElementById('f-caption').value;

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
  } catch {
    showToast('保存に失敗しました', true);
  }
}

function resetPostForm() {
  editPostId = null;
  mediaRows  = [];
  document.getElementById('f-country').value = '';
  document.getElementById('f-date').value    = '';
  document.getElementById('f-title').value   = '';
  document.getElementById('f-location').value = '';
  document.getElementById('f-caption').value  = '';
  document.getElementById('form-title').textContent  = '新規投稿';
  document.getElementById('btn-submit').textContent  = '投稿する';
  document.getElementById('btn-cancel-edit').style.display = 'none';
  renderMediaList();
}

// ============================================================
// 投稿編集
// ============================================================
function editPost(post) {
  switchTab('new-post');
  editPostId = post.id;
  document.getElementById('f-country').value  = post.countryId;
  document.getElementById('f-date').value     = post.date;
  document.getElementById('f-title').value    = post.title;
  document.getElementById('f-location').value = post.location || '';
  document.getElementById('f-caption').value  = post.caption  || '';
  mediaRows = (post.media || []).map(m => ({ ...m }));
  renderMediaList();
  document.getElementById('form-title').textContent  = '投稿を編集';
  document.getElementById('btn-submit').textContent  = '更新する';
  document.getElementById('btn-cancel-edit').style.display = '';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ============================================================
// 投稿一覧
// ============================================================
function renderPostList() {
  const container = document.getElementById('post-list-container');
  const filterVal = document.getElementById('list-country-filter').value;

  let filtered = filterVal ? posts.filter(p => p.countryId === filterVal) : [...posts];
  filtered.sort((a, b) => b.date.localeCompare(a.date));

  container.innerHTML = '';
  if (filtered.length === 0) {
    container.textContent = '投稿がありません';
    return;
  }

  filtered.forEach(post => {
    const countryName = (countries.find(c => c.id === post.countryId) || {}).name || '';
    const thumbMedia  = (post.media || []).find(m => m.type === 'image');

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
    const metaEl = document.createElement('div');
    metaEl.className = 'post-meta-text';
    metaEl.textContent = `${countryName} ／ ${post.date} ／ 📎 ${(post.media || []).length}件`;
    info.appendChild(titleEl);
    info.appendChild(metaEl);

    const actions = document.createElement('div');
    actions.className = 'post-actions';
    const editBtn = document.createElement('button');
    editBtn.className = 'btn-edit';
    editBtn.textContent = '編集';
    editBtn.onclick = () => editPost(post);
    const delBtn = document.createElement('button');
    delBtn.className = 'btn-danger';
    delBtn.textContent = '削除';
    delBtn.onclick = async () => {
      if (!confirm(`「${post.title}」を削除しますか？`)) return;
      try {
        await apiAuth('DELETE', `/posts/${post.id}`);
        showToast('投稿を削除しました');
        await loadPosts();
        renderPostList();
      } catch {
        showToast('削除に失敗しました', true);
      }
    };
    actions.appendChild(editBtn);
    actions.appendChild(delBtn);

    item.appendChild(thumb);
    item.appendChild(info);
    item.appendChild(actions);
    container.appendChild(item);
  });
}

// ============================================================
// 国管理
// ============================================================
function renderCountryList() {
  const container = document.getElementById('country-list-container');
  container.innerHTML = '';

  if (countries.length === 0) {
    container.textContent = '国データがありません';
    return;
  }

  const postCount = {};
  posts.forEach(p => { postCount[p.countryId] = (postCount[p.countryId] || 0) + 1; });

  countries.forEach(c => {
    const count = postCount[c.id] || 0;
    const item  = document.createElement('div');
    item.className = 'country-list-item';

    const flagCell = document.createElement('div');
    flagCell.className = 'country-flag-cell';
    flagCell.textContent = c.flag || '🌐';

    const infoDiv = document.createElement('div');
    infoDiv.className = 'country-item-info';
    const nameEl = document.createElement('div');
    nameEl.className = 'country-item-name';
    nameEl.textContent = c.name;
    const metaEl = document.createElement('div');
    metaEl.className = 'country-item-meta';
    metaEl.textContent = `表示順: ${c.order} ／ 投稿: ${count}件`;
    infoDiv.appendChild(nameEl);
    infoDiv.appendChild(metaEl);

    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'country-item-actions';
    const editBtn = document.createElement('button');
    editBtn.className = 'btn-edit';
    editBtn.textContent = '編集';
    editBtn.onclick = () => editCountry(c);
    const delBtn = document.createElement('button');
    delBtn.className = 'btn-danger';
    delBtn.textContent = '削除';
    if (count > 0) {
      delBtn.disabled = true;
      delBtn.title = '投稿がある国は削除できません';
    }
    delBtn.onclick = async () => {
      if (!confirm(`「${c.name}」を削除しますか？`)) return;
      try {
        await apiAuth('DELETE', `/countries/${c.id}`);
        showToast('国を削除しました');
        await loadAll();
        renderCountryList();
      } catch (e) {
        showToast('削除に失敗しました', true);
      }
    };
    actionsDiv.appendChild(editBtn);
    actionsDiv.appendChild(delBtn);

    item.appendChild(flagCell);
    item.appendChild(infoDiv);
    item.appendChild(actionsDiv);
    container.appendChild(item);
  });
}

async function saveCountry() {
  const editId = document.getElementById('edit-country-id').value;
  const name   = document.getElementById('c-name').value.trim();
  const flag   = document.getElementById('c-flag').value.trim();
  const order  = parseInt(document.getElementById('c-order').value, 10) || 100;
  const sub    = document.getElementById('c-subtitle').value.trim();
  const desc   = document.getElementById('c-description').value;

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
  } catch {
    showToast('保存に失敗しました', true);
  }
}

function editCountry(c) {
  document.getElementById('edit-country-id').value = c.id;
  document.getElementById('c-name').value        = c.name;
  document.getElementById('c-flag').value        = c.flag || '';
  document.getElementById('c-order').value       = c.order;
  document.getElementById('c-subtitle').value    = c.subtitle || '';
  document.getElementById('c-description').value = c.description || '';
  document.getElementById('country-form-title').textContent = '国を編集';
  document.getElementById('btn-save-country').textContent   = '更新';
  document.getElementById('btn-cancel-country').style.display = '';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function resetCountryForm() {
  document.getElementById('edit-country-id').value = '';
  document.getElementById('c-name').value        = '';
  document.getElementById('c-flag').value        = '';
  document.getElementById('c-order').value       = '100';
  document.getElementById('c-subtitle').value    = '';
  document.getElementById('c-description').value = '';
  document.getElementById('country-form-title').textContent = '国を追加';
  document.getElementById('btn-save-country').textContent   = '保存';
  document.getElementById('btn-cancel-country').style.display = 'none';
}

// ============================================================
// トースト通知
// ============================================================
function showToast(msg, isError = false) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.className = 'toast' + (isError ? ' error' : '');
  void toast.offsetWidth;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3000);
}
