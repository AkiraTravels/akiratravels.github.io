import { db, auth, CLOUDINARY_CONFIG } from '../js/firebase-config.js';
import {
  collection, getDocs, getDoc, addDoc, updateDoc, deleteDoc,
  doc, query, orderBy, serverTimestamp, where
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import {
  onAuthStateChanged, signInWithEmailAndPassword, signOut
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

// ─── 状態変数 ────────────────────────────────────────────────
let countries = [];
let posts = [];
let mediaRows = [];
let editPostId = null;
let deletedMediaUrls = [];

// ─── 認証 ────────────────────────────────────────────────────
onAuthStateChanged(auth, user => {
  if (user) {
    document.getElementById('admin-main').style.display = '';
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('header-user').style.display = 'flex';
    document.getElementById('header-email').textContent = user.email;
    loadAll();
  } else {
    document.getElementById('admin-main').style.display = 'none';
    document.getElementById('login-screen').style.display = '';
    document.getElementById('header-user').style.display = 'none';
  }
});

async function loginHandler() {
  const email    = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  document.getElementById('login-error').textContent = '';
  try {
    await signInWithEmailAndPassword(auth, email, password);
  } catch (err) {
    document.getElementById('login-error').textContent =
      'ログインに失敗しました。メールアドレスとパスワードを確認してください。';
  }
}

document.getElementById('btn-login').addEventListener('click', loginHandler);
document.getElementById('login-password').addEventListener('keydown', e => {
  if (e.key === 'Enter') loginHandler();
});
document.getElementById('btn-logout').addEventListener('click', async () => {
  await signOut(auth);
});

// ─── データロード ─────────────────────────────────────────────
async function loadAll() {
  await Promise.all([loadCountries(), loadPosts()]);
}

async function loadCountries() {
  const q = query(collection(db, 'countries'), orderBy('order', 'asc'));
  const snap = await getDocs(q);
  countries = [];
  snap.forEach(d => countries.push({ id: d.id, ...d.data() }));
  populateCountrySelects();
  renderCountryList();
}

async function loadPosts() {
  const q = query(collection(db, 'posts'), orderBy('date', 'desc'));
  const snap = await getDocs(q);
  posts = [];
  snap.forEach(d => posts.push({ id: d.id, ...d.data() }));
}

function populateCountrySelects() {
  const selPost   = document.getElementById('f-country');
  const selFilter = document.getElementById('list-country-filter');
  const prevPost   = selPost.value;
  const prevFilter = selFilter.value;

  selPost.innerHTML   = '<option value="">— 選択してください —</option>';
  selFilter.innerHTML = '<option value="">すべての国</option>';

  countries.forEach(c => {
    const label = c.flag ? `${c.flag} ${c.name}` : c.name;
    const opt1 = new Option(label, c.id);
    const opt2 = new Option(label, c.id);
    selPost.appendChild(opt1);
    selFilter.appendChild(opt2);
  });

  selPost.value   = prevPost;
  selFilter.value = prevFilter;
}

// ─── タブ切り替え ─────────────────────────────────────────────
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    switchTab(btn.dataset.tab);
  });
});

function switchTab(name) {
  document.querySelectorAll('.tab-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.tab === name);
  });
  document.querySelectorAll('.tab-panel').forEach(p => {
    p.classList.toggle('active', p.id === `tab-${name}`);
  });
  if (name === 'post-list')    renderPostList();
  if (name === 'country-mgmt') renderCountryList();
}

// ─── メディアリスト描画 ───────────────────────────────────────
function renderMediaList() {
  const container = document.getElementById('media-list');
  container.innerHTML = '';

  mediaRows.forEach((m, idx) => {
    // 行本体
    const row = document.createElement('div');
    row.className = 'media-row';

    // × 削除ボタン
    const removeBtn = document.createElement('button');
    removeBtn.className = 'btn-remove-media';
    removeBtn.textContent = '×';
    removeBtn.addEventListener('click', () => {
      if (m.url) deletedMediaUrls.push(m.url);
      mediaRows.splice(idx, 1);
      renderMediaList();
    });
    row.appendChild(removeBtn);

    // ヘッダー行（プレビュー + フィールド）
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

    // フィールド群
    const fields = document.createElement('div');
    fields.className = 'media-row-fields';

    // URL入力
    const urlInput = document.createElement('input');
    urlInput.type = 'url';
    urlInput.className = 'm-url';
    urlInput.placeholder = 'https://res.cloudinary.com/…';
    urlInput.value = m.url || '';
    urlInput.addEventListener('change', () => {
      mediaRows[idx].url = urlInput.value;
      renderMediaList();
    });
    fields.appendChild(urlInput);

    // タイプ選択
    const typeSelect = document.createElement('select');
    typeSelect.className = 'm-type';
    typeSelect.innerHTML = '<option value="image">📷 写真</option><option value="video">🎬 動画</option>';
    typeSelect.value = m.type || 'image';
    typeSelect.addEventListener('change', () => { mediaRows[idx].type = typeSelect.value; });
    fields.appendChild(typeSelect);

    // キャプション
    const capTa = document.createElement('textarea');
    capTa.className = 'm-caption';
    capTa.rows = 9;
    capTa.placeholder = 'このメディアのキャプション（任意）';
    capTa.value = m.caption || '';
    capTa.addEventListener('input', () => { mediaRows[idx].caption = capTa.value; });
    fields.appendChild(capTa);

    header.appendChild(fields);
    row.appendChild(header);

    // コントロール行
    const controls = document.createElement('div');
    controls.className = 'media-row-controls';

    // 代表写真チェック
    const coverLabel = document.createElement('label');
    coverLabel.className = 'cover-checkbox-label';
    const coverCb = document.createElement('input');
    coverCb.type = 'checkbox';
    coverCb.className = 'm-cover';
    coverCb.addEventListener('change', async () => {
      if (!coverCb.checked || !m.url) return;
      const countryId = document.getElementById('f-country').value;
      if (!countryId) { showToast('先に国を選択してください', true); return; }
      try {
        await updateDoc(doc(db, 'countries', countryId), { imgUrl: m.url });
        showToast('代表写真を設定しました');
      } catch (err) {
        showToast('代表写真の設定に失敗しました', true);
      }
    });
    coverLabel.appendChild(coverCb);
    coverLabel.appendChild(document.createTextNode(' ★ 代表写真'));
    controls.appendChild(coverLabel);

    // アップロードボタン
    const uploadBtn = document.createElement('button');
    uploadBtn.className = 'btn-upload';
    uploadBtn.textContent = '☁️ Cloudinaryにアップロード';
    uploadBtn.addEventListener('click', () => uploadMedia(idx));
    controls.appendChild(uploadBtn);

    // ↑ ボタン
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

    // ↓ ボタン
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

    // ＋ここに挿入ボタン
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

// ─── Cloudinary アップロード ──────────────────────────────────
function uploadMedia(idx) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*,video/*';
  input.addEventListener('change', async () => {
    const file = input.files[0];
    if (!file) return;

    const progressEl = document.getElementById(`upload-progress-${idx}`);
    progressEl.textContent = 'アップロード中…';
    progressEl.className = 'upload-progress';

    if (mediaRows[idx].url) deletedMediaUrls.push(mediaRows[idx].url);

    const resourceType = file.type.startsWith('video/') ? 'video' : 'image';
    const fd = new FormData();
    fd.append('file', file);
    fd.append('upload_preset', CLOUDINARY_CONFIG.uploadPreset);

    try {
      const res = await fetch(
        `https://api.cloudinary.com/v1_1/${CLOUDINARY_CONFIG.cloudName}/${resourceType}/upload`,
        { method: 'POST', body: fd }
      );
      const data = await res.json();
      mediaRows[idx].url  = data.secure_url;
      mediaRows[idx].type = resourceType;
      renderMediaList();
      const el = document.getElementById(`upload-progress-${idx}`);
      el.textContent = '✓ アップロード完了';
      el.className = 'upload-progress success';
      setTimeout(() => { if (el) el.textContent = ''; }, 2000);
    } catch (err) {
      progressEl.textContent = `エラー: ${err.message}`;
      progressEl.className = 'upload-progress error';
    }
  });
  input.click();
}

// ─── 投稿保存 ─────────────────────────────────────────────────
document.getElementById('btn-add-media').addEventListener('click', () => {
  mediaRows.push({ url: '', type: 'image', caption: '' });
  renderMediaList();
});

document.getElementById('btn-submit').addEventListener('click', submitPost);
document.getElementById('btn-cancel-edit').addEventListener('click', resetPostForm);

async function submitPost() {
  const countryId = document.getElementById('f-country').value;
  const date      = document.getElementById('f-date').value;
  const title     = document.getElementById('f-title').value.trim();
  const location  = document.getElementById('f-location').value.trim();
  const caption   = document.getElementById('f-caption').value.trim();

  if (!countryId) { showToast('国を選択してください', true); return; }
  if (!date)      { showToast('日付を入力してください', true); return; }
  if (!title)     { showToast('タイトルを入力してください', true); return; }

  const postData = {
    countryId, date, title, location, caption,
    media: mediaRows.map(m => ({
      url:     m.url     || '',
      type:    m.type    || 'image',
      caption: m.caption || ''
    })),
    updatedAt: serverTimestamp()
  };

  // location が URL の場合、国の docUrl を更新
  if (location.startsWith('https')) {
    try {
      await updateDoc(doc(db, 'countries', countryId), { docUrl: location });
    } catch (e) { console.warn('docUrl更新エラー:', e); }
  }

  try {
    if (editPostId === null) {
      postData.createdAt = serverTimestamp();
      await addDoc(collection(db, 'posts'), postData);
      showToast('投稿を保存しました');
    } else {
      await updateDoc(doc(db, 'posts', editPostId), postData);
      showToast('投稿を更新しました');
    }
    await deleteFromCloudinary(deletedMediaUrls);
    resetPostForm();
    await loadPosts();
  } catch (err) {
    showToast('保存に失敗しました', true);
    console.error(err);
  }
}

function resetPostForm() {
  editPostId = null;
  deletedMediaUrls = [];
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

// ─── 投稿編集 ─────────────────────────────────────────────────
function editPost(post) {
  switchTab('new-post');
  editPostId = post.id;
  deletedMediaUrls = [];
  document.getElementById('f-country').value  = post.countryId || '';
  document.getElementById('f-date').value      = post.date     || '';
  document.getElementById('f-title').value     = post.title    || '';
  document.getElementById('f-location').value  = post.location || '';
  document.getElementById('f-caption').value   = post.caption  || '';
  mediaRows = (post.media || []).map(m => ({ ...m }));
  renderMediaList();
  document.getElementById('form-title').textContent  = '投稿を編集';
  document.getElementById('btn-submit').textContent  = '更新する';
  document.getElementById('btn-cancel-edit').style.display = '';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ─── Cloudinary 削除 ──────────────────────────────────────────
async function deleteFromCloudinary(urls) {
  for (const url of urls) {
    const match = url.match(/\/upload\/(?:v\d+\/)?(.+)\.[^.]+$/);
    if (!match) continue;
    const publicId    = match[1];
    const resourceType = url.includes('/video/') ? 'video' : 'image';
    try {
      await fetch(
        `https://api.cloudinary.com/v1_1/${CLOUDINARY_CONFIG.cloudName}/${resourceType}/destroy`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ public_id: publicId })
        }
      );
    } catch (err) {
      console.warn('Cloudinary削除エラー（無視）:', err);
    }
  }
}

// ─── 投稿一覧 ─────────────────────────────────────────────────
function renderPostList() {
  const container   = document.getElementById('post-list-container');
  const filterVal   = document.getElementById('list-country-filter').value;
  container.innerHTML = '';

  let filtered = filterVal
    ? posts.filter(p => p.countryId === filterVal)
    : [...posts];

  filtered.sort((a, b) => b.date.localeCompare(a.date));

  if (filtered.length === 0) {
    container.innerHTML = '<p style="color:#8a7e74;text-align:center;padding:24px 0;">投稿がありません</p>';
    return;
  }

  filtered.forEach(post => {
    const country = countries.find(c => c.id === post.countryId);
    const countryName = country ? country.name : '不明';

    const thumbMedia = (post.media || []).find(m => m.type === 'image');
    const mediaCount = (post.media || []).length;
    const hasCover   = !!(post.media || []).length; // 代表写真チェックは省略（DBに持たないため）

    const item = document.createElement('div');
    item.className = 'post-list-item';

    // サムネイル
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
    item.appendChild(thumb);

    // 情報
    const info = document.createElement('div');
    info.className = 'post-info';
    const titleEl = document.createElement('div');
    titleEl.className = 'post-title-text';
    titleEl.textContent = post.title;
    info.appendChild(titleEl);
    const metaEl = document.createElement('div');
    metaEl.className = 'post-meta-text';
    metaEl.textContent = `${countryName} ／ ${post.date} ／ 📎 ${mediaCount}件`;
    info.appendChild(metaEl);
    item.appendChild(info);

    // アクション
    const actions = document.createElement('div');
    actions.className = 'post-actions';

    const editBtn = document.createElement('button');
    editBtn.className = 'btn-edit';
    editBtn.textContent = '編集';
    editBtn.addEventListener('click', () => editPost(post));
    actions.appendChild(editBtn);

    const delBtn = document.createElement('button');
    delBtn.className = 'btn-danger';
    delBtn.textContent = '削除';
    delBtn.addEventListener('click', async () => {
      if (!confirm(`「${post.title}」を削除しますか？`)) return;
      try {
        await deleteDoc(doc(db, 'posts', post.id));
        showToast('投稿を削除しました');
        await loadPosts();
        renderPostList();
      } catch (err) {
        showToast('削除に失敗しました', true);
      }
    });
    actions.appendChild(delBtn);

    item.appendChild(actions);
    container.appendChild(item);
  });
}

document.getElementById('list-country-filter').addEventListener('change', renderPostList);

// ─── 国管理 ───────────────────────────────────────────────────
function renderCountryList() {
  const container = document.getElementById('country-list-container');
  container.innerHTML = '';

  if (countries.length === 0) {
    container.innerHTML = '<p style="color:#8a7e74;text-align:center;padding:24px 0;">国データがありません</p>';
    return;
  }

  // 投稿数集計
  const postCount = {};
  posts.forEach(p => {
    postCount[p.countryId] = (postCount[p.countryId] || 0) + 1;
  });

  countries.forEach(c => {
    const count = postCount[c.id] || 0;
    const item = document.createElement('div');
    item.className = 'country-list-item';

    const flagCell = document.createElement('div');
    flagCell.className = 'country-flag-cell';
    flagCell.textContent = c.flag || '🌐';
    item.appendChild(flagCell);

    const infoEl = document.createElement('div');
    infoEl.className = 'country-item-info';
    const nameEl = document.createElement('div');
    nameEl.className = 'country-item-name';
    nameEl.textContent = c.name;
    infoEl.appendChild(nameEl);
    const metaEl = document.createElement('div');
    metaEl.className = 'country-item-meta';
    metaEl.textContent = `表示順: ${c.order} ／ 投稿: ${count}件`;
    infoEl.appendChild(metaEl);
    item.appendChild(infoEl);

    const actionsEl = document.createElement('div');
    actionsEl.className = 'country-item-actions';

    const editBtn = document.createElement('button');
    editBtn.className = 'btn-edit';
    editBtn.textContent = '編集';
    editBtn.addEventListener('click', () => editCountry(c));
    actionsEl.appendChild(editBtn);

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
        await deleteDoc(doc(db, 'countries', c.id));
        showToast('国を削除しました');
        await loadAll();
        renderCountryList();
      } catch (err) {
        showToast('削除に失敗しました', true);
      }
    });
    actionsEl.appendChild(delBtn);

    item.appendChild(actionsEl);
    container.appendChild(item);
  });
}

// 国保存
document.getElementById('btn-save-country').addEventListener('click', async () => {
  const name  = document.getElementById('c-name').value.trim();
  const flag  = document.getElementById('c-flag').value.trim();
  const order = parseInt(document.getElementById('c-order').value, 10) || 100;
  const sub   = document.getElementById('c-subtitle').value.trim();
  const desc  = document.getElementById('c-description').value.trim();
  const editId = document.getElementById('edit-country-id').value;

  if (!name) { showToast('国名を入力してください', true); return; }

  const data = { name, flag, order, subtitle: sub, description: desc };

  try {
    if (editId) {
      await updateDoc(doc(db, 'countries', editId), data);
      showToast('国を更新しました');
    } else {
      await addDoc(collection(db, 'countries'), data);
      showToast('国を追加しました');
    }
    resetCountryForm();
    await loadAll();
    renderCountryList();
  } catch (err) {
    showToast('保存に失敗しました', true);
    console.error(err);
  }
});

document.getElementById('btn-cancel-country').addEventListener('click', resetCountryForm);

function editCountry(c) {
  document.getElementById('edit-country-id').value  = c.id;
  document.getElementById('c-name').value           = c.name       || '';
  document.getElementById('c-flag').value           = c.flag       || '';
  document.getElementById('c-order').value          = c.order      ?? 100;
  document.getElementById('c-subtitle').value       = c.subtitle   || '';
  document.getElementById('c-description').value    = c.description|| '';
  document.getElementById('country-form-title').textContent = '国を編集';
  document.getElementById('btn-save-country').textContent   = '更新';
  document.getElementById('btn-cancel-country').style.display = '';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function resetCountryForm() {
  document.getElementById('edit-country-id').value       = '';
  document.getElementById('c-name').value                = '';
  document.getElementById('c-flag').value                = '';
  document.getElementById('c-order').value               = '100';
  document.getElementById('c-subtitle').value            = '';
  document.getElementById('c-description').value         = '';
  document.getElementById('country-form-title').textContent = '国を追加';
  document.getElementById('btn-save-country').textContent   = '保存';
  document.getElementById('btn-cancel-country').style.display = 'none';
}

// ─── トースト通知 ─────────────────────────────────────────────
function showToast(msg, isError = false) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.className = 'toast' + (isError ? ' error' : '');
  void toast.offsetWidth;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3000);
}

// 初期化
renderMediaList();
