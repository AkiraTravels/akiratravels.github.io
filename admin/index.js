import { db, auth, CLOUDINARY_CONFIG } from '../js/firebase-config.js';
import {
  collection, getDocs, getDoc, addDoc, updateDoc, deleteDoc,
  doc, query, orderBy, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import {
  onAuthStateChanged, signInWithEmailAndPassword, signOut
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

// =============================================
// 状態
// =============================================
let countries = [];
let posts = [];
let mediaRows = [];        // { url, type, caption, isCover }
let editPostId = null;
let deletedMediaUrls = [];

// =============================================
// 認証
// =============================================
onAuthStateChanged(auth, user => {
  if (user) {
    document.getElementById('admin-main').style.display = '';
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('header-user').style.display = '';
    document.getElementById('header-email').textContent = user.email;
    loadAll();
  } else {
    document.getElementById('admin-main').style.display = 'none';
    document.getElementById('login-screen').style.display = '';
    document.getElementById('header-user').style.display = 'none';
  }
});

// ログイン
document.getElementById('btn-login').addEventListener('click', loginHandler);
document.getElementById('login-password').addEventListener('keydown', e => {
  if (e.key === 'Enter') loginHandler();
});

async function loginHandler() {
  const email    = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  const errEl    = document.getElementById('login-error');
  errEl.textContent = '';
  try {
    await signInWithEmailAndPassword(auth, email, password);
  } catch (err) {
    errEl.textContent = 'ログインに失敗しました。メールアドレスとパスワードを確認してください。';
  }
}

// ログアウト
document.getElementById('btn-logout').addEventListener('click', async () => {
  await signOut(auth);
});

// =============================================
// データロード
// =============================================
async function loadAll() {
  await Promise.all([loadCountries(), loadPosts()]);
}

async function loadCountries() {
  const snap = await getDocs(query(collection(db, 'countries'), orderBy('order', 'asc')));
  countries = [];
  snap.forEach(d => countries.push({ id: d.id, ...d.data() }));
  populateCountrySelects();
}

async function loadPosts() {
  const snap = await getDocs(query(collection(db, 'posts'), orderBy('date', 'desc')));
  posts = [];
  snap.forEach(d => posts.push({ id: d.id, ...d.data() }));
}

function populateCountrySelects() {
  // 新規投稿フォーム
  const sel = document.getElementById('f-country');
  const cur = sel.value;
  sel.innerHTML = '<option value="">— 選択してください —</option>';
  countries.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.textContent = (c.flag ? c.flag + ' ' : '') + c.name;
    sel.appendChild(opt);
  });
  if (cur) sel.value = cur;

  // 一覧フィルター
  const filter = document.getElementById('list-country-filter');
  const curFilter = filter.value;
  filter.innerHTML = '<option value="">すべての国</option>';
  countries.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.textContent = (c.flag ? c.flag + ' ' : '') + c.name;
    filter.appendChild(opt);
  });
  if (curFilter) filter.value = curFilter;
}

// =============================================
// タブ切り替え
// =============================================
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    const tabId = 'tab-' + btn.dataset.tab;
    document.getElementById(tabId).classList.add('active');

    if (btn.dataset.tab === 'post-list') renderPostList();
    if (btn.dataset.tab === 'country-mgmt') renderCountryList();
  });
});

function switchTab(name) {
  document.querySelectorAll('.tab-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.tab === name);
  });
  document.querySelectorAll('.tab-panel').forEach(p => {
    p.classList.toggle('active', p.id === 'tab-' + name);
  });
}

// =============================================
// メディアリスト描画
// =============================================
function renderMediaList() {
  const container = document.getElementById('media-list');
  container.innerHTML = '';

  mediaRows.forEach((m, idx) => {
    const row = document.createElement('div');
    row.className = 'media-row';

    // ×ボタン
    const removeBtn = document.createElement('button');
    removeBtn.className = 'btn-remove-media';
    removeBtn.textContent = '×';
    removeBtn.title = 'このメディアを削除';
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
    const previewWrap = document.createElement('div');
    previewWrap.className = 'preview-wrap';
    if (m.url) {
      if (m.type === 'video') {
        const vid = document.createElement('video');
        vid.src = m.url;
        vid.preload = 'metadata';
        previewWrap.appendChild(vid);
      } else {
        const img = document.createElement('img');
        img.src = m.url;
        img.alt = '';
        previewWrap.appendChild(img);
      }
    } else {
      previewWrap.textContent = 'No media';
    }
    header.appendChild(previewWrap);

    // フィールド
    const fields = document.createElement('div');
    fields.className = 'media-row-fields';

    // URL入力
    const urlInput = document.createElement('input');
    urlInput.type = 'url';
    urlInput.className = 'm-url';
    urlInput.placeholder = 'https://res.cloudinary.com/…';
    urlInput.value = m.url || '';
    urlInput.addEventListener('change', e => {
      mediaRows[idx].url = e.target.value.trim();
      renderMediaList();
    });
    fields.appendChild(urlInput);

    // タイプ選択
    const typeSelect = document.createElement('select');
    typeSelect.className = 'm-type';
    [['image', '📷 写真'], ['video', '🎬 動画']].forEach(([val, label]) => {
      const opt = document.createElement('option');
      opt.value = val;
      opt.textContent = label;
      opt.selected = m.type === val;
      typeSelect.appendChild(opt);
    });
    typeSelect.addEventListener('change', e => {
      mediaRows[idx].type = e.target.value;
    });
    fields.appendChild(typeSelect);

    // キャプション
    const capTa = document.createElement('textarea');
    capTa.className = 'm-caption';
    capTa.rows = 9;
    capTa.placeholder = 'このメディアのキャプション（任意）';
    capTa.value = m.caption || '';
    capTa.addEventListener('input', e => {
      mediaRows[idx].caption = e.target.value;
    });
    fields.appendChild(capTa);

    header.appendChild(fields);
    row.appendChild(header);

    // コントロール行
    const controls = document.createElement('div');
    controls.className = 'media-row-controls';

    // 代表写真チェック
    const coverLabel = document.createElement('label');
    coverLabel.className = 'cover-checkbox-label';
    const coverChk = document.createElement('input');
    coverChk.type = 'checkbox';
    coverChk.className = 'm-cover';
    coverChk.checked = !!m.isCover;
    coverChk.addEventListener('change', () => {
      mediaRows.forEach((r, i) => { r.isCover = i === idx && coverChk.checked; });
      renderMediaList();
    });
    coverLabel.appendChild(coverChk);
    coverLabel.appendChild(document.createTextNode(' ★ 代表写真'));
    controls.appendChild(coverLabel);

    // アップロードボタン
    const uploadBtn = document.createElement('button');
    uploadBtn.className = 'btn-upload';
    uploadBtn.textContent = '☁️ Cloudinaryにアップロード';
    uploadBtn.addEventListener('click', () => uploadMedia(idx));
    controls.appendChild(uploadBtn);

    // 移動ボタン
    if (idx > 0) {
      const upBtn = document.createElement('button');
      upBtn.className = 'btn-move';
      upBtn.dataset.dir = 'up';
      upBtn.textContent = '↑';
      upBtn.title = '上へ移動';
      upBtn.addEventListener('click', () => {
        [mediaRows[idx - 1], mediaRows[idx]] = [mediaRows[idx], mediaRows[idx - 1]];
        renderMediaList();
      });
      controls.appendChild(upBtn);
    }
    if (idx < mediaRows.length - 1) {
      const downBtn = document.createElement('button');
      downBtn.className = 'btn-move';
      downBtn.dataset.dir = 'down';
      downBtn.textContent = '↓';
      downBtn.title = '下へ移動';
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
    insertBtn.dataset.pos = String(idx + 1);
    insertBtn.textContent = '＋ ここに挿入';
    insertBtn.addEventListener('click', () => {
      mediaRows.splice(idx + 1, 0, { url: '', type: 'image', caption: '', isCover: false });
      renderMediaList();
    });
    insertWrap.appendChild(insertBtn);
    container.appendChild(insertWrap);
  });
}

// メディア追加ボタン
document.getElementById('btn-add-media').addEventListener('click', () => {
  mediaRows.push({ url: '', type: 'image', caption: '', isCover: false });
  renderMediaList();
});

// =============================================
// Cloudinary アップロード
// =============================================
async function uploadMedia(idx) {
  return new Promise(resolve => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*,video/*';
    input.addEventListener('change', async () => {
      const file = input.files[0];
      if (!file) { resolve(); return; }

      const progressEl = document.querySelector(`#upload-progress-${idx}`);
      if (progressEl) { progressEl.textContent = 'アップロード中…'; progressEl.className = 'upload-progress'; }

      // 既存URLを削除リストへ
      if (mediaRows[idx].url) deletedMediaUrls.push(mediaRows[idx].url);

      const resourceType = file.type.startsWith('video/') ? 'video' : 'image';
      const formData = new FormData();
      formData.append('file', file);
      formData.append('upload_preset', CLOUDINARY_CONFIG.uploadPreset);

      try {
        const res = await fetch(
          `https://api.cloudinary.com/v1_1/${CLOUDINARY_CONFIG.cloudName}/${resourceType}/upload`,
          { method: 'POST', body: formData }
        );
        const data = await res.json();
        if (data.secure_url) {
          mediaRows[idx].url = data.secure_url;
          mediaRows[idx].type = resourceType === 'video' ? 'video' : 'image';
          renderMediaList();
          const el = document.querySelector(`#upload-progress-${idx}`);
          if (el) {
            el.textContent = '✓ アップロード完了';
            el.className = 'upload-progress success';
            setTimeout(() => { if (el) el.textContent = ''; }, 2000);
          }
        } else {
          throw new Error(data.error?.message || 'Upload failed');
        }
      } catch (err) {
        const el = document.querySelector(`#upload-progress-${idx}`);
        if (el) { el.textContent = 'エラー: ' + err.message; el.className = 'upload-progress error'; }
      }
      resolve();
    });
    input.click();
  });
}

// =============================================
// 投稿保存
// =============================================
document.getElementById('btn-submit').addEventListener('click', submitPost);

async function submitPost() {
  const countryId = document.getElementById('f-country').value;
  const date      = document.getElementById('f-date').value;
  const title     = document.getElementById('f-title').value.trim();
  const location  = document.getElementById('f-location').value.trim();
  const caption   = document.getElementById('f-caption').value.trim();

  if (!countryId) { showToast('国を選択してください', true); return; }
  if (!date)       { showToast('日付を入力してください', true); return; }
  if (!title)      { showToast('タイトルを入力してください', true); return; }

  const mediaData = mediaRows.map(m => ({
    url:     m.url     || '',
    type:    m.type    || 'image',
    caption: m.caption || '',
    isCover: !!m.isCover
  }));

  const postData = {
    countryId, date, title, location, caption,
    media: mediaData,
    updatedAt: serverTimestamp()
  };

  try {
    if (editPostId) {
      await updateDoc(doc(db, 'posts', editPostId), postData);
      showToast('投稿を更新しました');
    } else {
      postData.createdAt = serverTimestamp();
      await addDoc(collection(db, 'posts'), postData);
      showToast('投稿を保存しました');
    }
    await deleteFromCloudinary(deletedMediaUrls);
    resetPostForm();
    await loadPosts();
  } catch (err) {
    console.error(err);
    showToast('保存に失敗しました: ' + err.message, true);
  }
}

document.getElementById('btn-cancel-edit').addEventListener('click', resetPostForm);

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

// =============================================
// Cloudinary 削除
// =============================================
async function deleteFromCloudinary(urls) {
  for (const url of urls) {
    const match = url.match(/\/upload\/(?:v\d+\/)?(.+)\.[^.]+$/);
    if (!match) continue;
    const publicId = match[1];

    // resourceType をURLから推測
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

// =============================================
// 投稿一覧
// =============================================
function renderPostList() {
  const filterVal  = document.getElementById('list-country-filter').value;
  const container  = document.getElementById('post-list-container');

  const filtered = filterVal
    ? posts.filter(p => p.countryId === filterVal)
    : [...posts];

  // date降順
  filtered.sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  if (filtered.length === 0) {
    container.innerHTML = '<p style="color:#8a7e74;padding:16px;">投稿がありません</p>';
    return;
  }

  container.innerHTML = '';

  filtered.forEach(post => {
    const country = countries.find(c => c.id === post.countryId);
    const countryName = country ? country.name : '不明';

    // サムネイル決定
    let thumbUrl = null;
    const coverMedia = (post.media || []).find(m => m.isCover && m.type === 'image');
    if (coverMedia) {
      thumbUrl = coverMedia.url;
    } else {
      const firstImage = (post.media || []).find(m => m.type === 'image');
      if (firstImage) thumbUrl = firstImage.url;
    }

    const hasCover = !!(post.media || []).find(m => m.isCover);
    const mediaCount = (post.media || []).length;

    const item = document.createElement('div');
    item.className = 'post-list-item';

    // サムネイル
    const thumbDiv = document.createElement('div');
    thumbDiv.className = 'post-thumbnail';
    if (thumbUrl) {
      const img = document.createElement('img');
      img.src = thumbUrl;
      img.alt = post.title;
      thumbDiv.appendChild(img);
    } else {
      thumbDiv.textContent = '📷';
    }
    item.appendChild(thumbDiv);

    // 情報
    const info = document.createElement('div');
    info.className = 'post-info';
    const titleEl = document.createElement('div');
    titleEl.className = 'post-title-text';
    titleEl.textContent = post.title;
    info.appendChild(titleEl);
    const meta = document.createElement('div');
    meta.className = 'post-meta-text';
    meta.textContent = `${countryName} ／ ${post.date} ／ 📎 ${mediaCount}件` + (hasCover ? ' ／ ★代表写真あり' : '');
    info.appendChild(meta);
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

function editPost(post) {
  switchTab('new-post');
  editPostId = post.id;
  deletedMediaUrls = [];

  document.getElementById('f-country').value = post.countryId || '';
  document.getElementById('f-date').value    = post.date || '';
  document.getElementById('f-title').value   = post.title || '';
  document.getElementById('f-location').value = post.location || '';
  document.getElementById('f-caption').value  = post.caption || '';

  mediaRows = (post.media || []).map(m => ({ ...m }));
  renderMediaList();

  document.getElementById('form-title').textContent = '投稿を編集';
  document.getElementById('btn-submit').textContent = '更新する';
  document.getElementById('btn-cancel-edit').style.display = '';

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// =============================================
// 国管理
// =============================================
function renderCountryList() {
  const container = document.getElementById('country-list-container');
  if (countries.length === 0) {
    container.innerHTML = '<p style="color:#8a7e74;padding:16px;">国データがありません</p>';
    return;
  }

  // 各国の投稿数
  const postCount = {};
  posts.forEach(p => { postCount[p.countryId] = (postCount[p.countryId] || 0) + 1; });

  container.innerHTML = '';
  countries.forEach(c => {
    const count = postCount[c.id] || 0;
    const item = document.createElement('div');
    item.className = 'country-list-item';

    const flagCell = document.createElement('div');
    flagCell.className = 'country-flag-cell';
    flagCell.textContent = c.flag || '🌐';
    item.appendChild(flagCell);

    const infoDiv = document.createElement('div');
    infoDiv.className = 'country-item-info';
    const nameEl = document.createElement('div');
    nameEl.className = 'country-item-name';
    nameEl.textContent = c.name;
    infoDiv.appendChild(nameEl);
    const metaEl = document.createElement('div');
    metaEl.className = 'country-item-meta';
    metaEl.textContent = `表示順: ${c.order} ／ 投稿: ${count}件`;
    infoDiv.appendChild(metaEl);
    item.appendChild(infoDiv);

    const actions = document.createElement('div');
    actions.className = 'country-item-actions';

    const editBtn = document.createElement('button');
    editBtn.className = 'btn-edit';
    editBtn.textContent = '編集';
    editBtn.addEventListener('click', () => editCountry(c));
    actions.appendChild(editBtn);

    const delBtn = document.createElement('button');
    delBtn.className = 'btn-danger';
    delBtn.textContent = '削除';
    delBtn.disabled = count > 0;
    delBtn.title = count > 0 ? '投稿がある国は削除できません' : '';
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
    actions.appendChild(delBtn);

    item.appendChild(actions);
    container.appendChild(item);
  });
}

document.getElementById('btn-save-country').addEventListener('click', async () => {
  const editId = document.getElementById('edit-country-id').value;
  const name   = document.getElementById('c-name').value.trim();
  const flag   = document.getElementById('c-flag').value.trim();
  const order  = parseInt(document.getElementById('c-order').value) || 100;
  const sub    = document.getElementById('c-subtitle').value.trim();
  const desc   = document.getElementById('c-description').value.trim();

  if (!name) { showToast('国名を入力してください', true); return; }

  const data = { name, flag, order, subtitle: sub, description: desc };

  try {
    if (editId) {
      await updateDoc(doc(db, 'countries', editId), data);
      showToast('国情報を更新しました');
    } else {
      await addDoc(collection(db, 'countries'), data);
      showToast('国を追加しました');
    }
    resetCountryForm();
    await loadAll();
    renderCountryList();
  } catch (err) {
    showToast('保存に失敗しました: ' + err.message, true);
  }
});

document.getElementById('btn-cancel-country').addEventListener('click', resetCountryForm);

function editCountry(c) {
  document.getElementById('edit-country-id').value = c.id;
  document.getElementById('c-name').value        = c.name || '';
  document.getElementById('c-flag').value        = c.flag || '';
  document.getElementById('c-order').value       = c.order ?? 100;
  document.getElementById('c-subtitle').value    = c.subtitle || '';
  document.getElementById('c-description').value = c.description || '';
  document.getElementById('country-form-title').textContent = '国を編集';
  document.getElementById('btn-save-country').textContent = '更新';
  document.getElementById('btn-cancel-country').style.display = '';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function resetCountryForm() {
  document.getElementById('edit-country-id').value  = '';
  document.getElementById('c-name').value           = '';
  document.getElementById('c-flag').value           = '';
  document.getElementById('c-order').value          = '100';
  document.getElementById('c-subtitle').value       = '';
  document.getElementById('c-description').value    = '';
  document.getElementById('country-form-title').textContent = '国を追加';
  document.getElementById('btn-save-country').textContent   = '保存';
  document.getElementById('btn-cancel-country').style.display = 'none';
}

// =============================================
// トースト通知
// =============================================
function showToast(msg, isError = false) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.className = 'toast' + (isError ? ' error' : '');
  // force reflow
  void toast.offsetWidth;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3000);
}
