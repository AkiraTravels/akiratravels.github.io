// admin/index.js — 管理画面ロジック（ES Module）

import {
  collection, getDocs, getDoc, addDoc, updateDoc, deleteDoc,
  doc, query, orderBy, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import {
  onAuthStateChanged, signInWithEmailAndPassword, signOut
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { db, auth, CLOUDINARY_CONFIG } from "../js/firebase-config.js";

// ===== 状態 =====
let countries = [];
let posts = [];
let mediaRows = [];
let editPostId = null;
let deletedMediaUrls = [];

// ===== 認証 =====
onAuthStateChanged(auth, user => {
  if (user) {
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('admin-main').style.display = '';
    document.getElementById('header-user').style.display = 'flex';
    document.getElementById('header-user-email').textContent = user.email;
    loadAll();
  } else {
    document.getElementById('login-screen').style.display = '';
    document.getElementById('admin-main').style.display = 'none';
    document.getElementById('header-user').style.display = 'none';
  }
});

// ログイン
document.getElementById('btn-login').addEventListener('click', login);
document.getElementById('login-password').addEventListener('keydown', e => {
  if (e.key === 'Enter') login();
});
document.getElementById('login-email').addEventListener('keydown', e => {
  if (e.key === 'Enter') document.getElementById('login-password').focus();
});

async function login() {
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  const errEl = document.getElementById('login-error');
  errEl.textContent = '';
  try {
    await signInWithEmailAndPassword(auth, email, password);
  } catch (err) {
    errEl.textContent = 'ログインに失敗しました。メールアドレスまたはパスワードを確認してください。';
    console.error(err);
  }
}

document.getElementById('btn-logout').addEventListener('click', () => {
  signOut(auth);
});

// ===== データロード =====
async function loadAll() {
  await Promise.all([loadCountries(), loadPosts()]);
}

async function loadCountries() {
  const snap = await getDocs(query(collection(db, 'countries'), orderBy('order', 'asc')));
  countries = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  renderCountrySelects();
  renderCountryList();
}

async function loadPosts() {
  const snap = await getDocs(query(collection(db, 'posts'), orderBy('date', 'desc')));
  posts = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  renderPostList();
}

// ===== タブ =====
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

// ===== 新規投稿フォーム =====

// 国セレクト同期
function renderCountrySelects() {
  const sel = document.getElementById('f-country');
  const currentVal = sel.value;
  sel.innerHTML = '<option value="">— 国を選択 —</option>';
  countries.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.textContent = `${c.flag || ''} ${c.name}`.trim();
    sel.appendChild(opt);
  });
  if (currentVal) sel.value = currentVal;

  // 投稿一覧フィルター
  const filterSel = document.getElementById('list-country-filter');
  filterSel.innerHTML = '<option value="">すべての国</option>';
  countries.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.textContent = `${c.flag || ''} ${c.name}`.trim();
    filterSel.appendChild(opt);
  });
}

// メディアリスト描画
function renderMediaList() {
  const container = document.getElementById('media-list');
  container.innerHTML = '';

  mediaRows.forEach((row, i) => {
    const rowDiv = document.createElement('div');
    rowDiv.className = 'media-row';

    // 削除ボタン
    const removeBtn = document.createElement('button');
    removeBtn.className = 'btn-remove-media';
    removeBtn.textContent = '×';
    removeBtn.title = 'このメディアを削除';
    removeBtn.addEventListener('click', () => {
      if (editPostId && row.url) deletedMediaUrls.push(row.url);
      mediaRows.splice(i, 1);
      renderMediaList();
    });
    rowDiv.appendChild(removeBtn);

    // ヘッダー（プレビュー + フィールド）
    const header = document.createElement('div');
    header.className = 'media-row-header';

    // プレビュー
    const preview = document.createElement('div');
    preview.className = 'preview-wrap';
    if (row.url) {
      if (row.type === 'video') {
        const vid = document.createElement('video');
        vid.src = row.url;
        vid.muted = true;
        vid.preload = 'metadata';
        preview.appendChild(vid);
      } else {
        const img = document.createElement('img');
        img.src = row.url;
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

    const urlInput = document.createElement('input');
    urlInput.type = 'url';
    urlInput.className = 'form-input m-url';
    urlInput.placeholder = 'https://res.cloudinary.com/...';
    urlInput.value = row.url || '';
    urlInput.addEventListener('input', () => {
      mediaRows[i].url = urlInput.value;
      renderMediaList();
    });
    fields.appendChild(urlInput);

    const typeSelect = document.createElement('select');
    typeSelect.className = 'form-select m-type';
    [['image', '📷 写真'], ['video', '🎬 動画']].forEach(([val, label]) => {
      const opt = document.createElement('option');
      opt.value = val;
      opt.textContent = label;
      if (row.type === val) opt.selected = true;
      typeSelect.appendChild(opt);
    });
    typeSelect.addEventListener('change', () => {
      mediaRows[i].type = typeSelect.value;
    });
    fields.appendChild(typeSelect);

    const capTextarea = document.createElement('textarea');
    capTextarea.className = 'form-textarea m-caption';
    capTextarea.rows = 9;
    capTextarea.placeholder = 'このメディアのキャプション（任意）';
    capTextarea.value = row.caption || '';
    capTextarea.style.width = '100%';
    capTextarea.addEventListener('input', () => {
      mediaRows[i].caption = capTextarea.value;
    });
    fields.appendChild(capTextarea);

    header.appendChild(fields);
    rowDiv.appendChild(header);

    // コントロール行
    const controls = document.createElement('div');
    controls.className = 'media-row-controls';

    // 代表写真チェックボックス
    const coverLabel = document.createElement('label');
    coverLabel.className = 'cover-checkbox-label';
    const coverCheck = document.createElement('input');
    coverCheck.type = 'checkbox';
    coverCheck.className = 'm-cover';
    coverCheck.checked = !!row.isCover;
    coverCheck.addEventListener('change', () => {
      mediaRows.forEach((r, j) => { r.isCover = j === i && coverCheck.checked; });
      renderMediaList();
    });
    coverLabel.appendChild(coverCheck);
    coverLabel.appendChild(document.createTextNode(' ★ 代表写真'));
    controls.appendChild(coverLabel);

    // アップロードボタン
    const uploadBtn = document.createElement('button');
    uploadBtn.className = 'btn btn-secondary btn-small btn-upload';
    uploadBtn.textContent = '☁️ Cloudinaryにアップロード';
    const progressSpan = document.createElement('span');
    progressSpan.className = 'upload-progress';
    uploadBtn.addEventListener('click', () => uploadMedia(i, progressSpan));
    controls.appendChild(uploadBtn);

    // 上移動
    const upBtn = document.createElement('button');
    upBtn.className = 'btn btn-secondary btn-small btn-move';
    upBtn.dataset.dir = 'up';
    upBtn.textContent = '↑';
    upBtn.disabled = i === 0;
    upBtn.addEventListener('click', () => {
      if (i === 0) return;
      [mediaRows[i - 1], mediaRows[i]] = [mediaRows[i], mediaRows[i - 1]];
      renderMediaList();
    });
    controls.appendChild(upBtn);

    // 下移動
    const downBtn = document.createElement('button');
    downBtn.className = 'btn btn-secondary btn-small btn-move';
    downBtn.dataset.dir = 'down';
    downBtn.textContent = '↓';
    downBtn.disabled = i === mediaRows.length - 1;
    downBtn.addEventListener('click', () => {
      if (i === mediaRows.length - 1) return;
      [mediaRows[i + 1], mediaRows[i]] = [mediaRows[i], mediaRows[i + 1]];
      renderMediaList();
    });
    controls.appendChild(downBtn);

    controls.appendChild(progressSpan);
    rowDiv.appendChild(controls);
    container.appendChild(rowDiv);

    // 挿入ボタン（各行の下）
    const insertWrap = document.createElement('div');
    insertWrap.className = 'insert-btn-wrap';
    const insertBtn = document.createElement('button');
    insertBtn.className = 'btn-insert';
    insertBtn.dataset.pos = String(i + 1);
    insertBtn.textContent = '＋ ここに挿入';
    insertBtn.addEventListener('click', () => {
      mediaRows.splice(i + 1, 0, { url: '', type: 'image', caption: '', isCover: false });
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

// ===== Cloudinaryアップロード =====
async function uploadMedia(idx, progressEl) {
  const { cloudName, uploadPreset } = CLOUDINARY_CONFIG;
  if (!cloudName || cloudName === 'YOUR_CLOUD_NAME') {
    progressEl.textContent = '⚠ firebase-config.jsのCloudinary設定を入力してください';
    return;
  }

  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*,video/*';
  input.addEventListener('change', async () => {
    const file = input.files[0];
    if (!file) return;

    const isVideo = file.type.startsWith('video/');
    const resourceType = isVideo ? 'video' : 'image';

    // 既存URLがあれば削除対象に追記
    if (mediaRows[idx].url) deletedMediaUrls.push(mediaRows[idx].url);

    progressEl.textContent = 'アップロード中…';

    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', uploadPreset);

    try {
      const res = await fetch(
        `https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`,
        { method: 'POST', body: formData }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || 'Upload failed');

      mediaRows[idx].url = data.secure_url;
      mediaRows[idx].type = isVideo ? 'video' : 'image';
      progressEl.textContent = '✓ アップロード完了';
      setTimeout(() => { progressEl.textContent = ''; }, 2000);
      renderMediaList();
    } catch (err) {
      progressEl.textContent = `エラー: ${err.message}`;
      console.error(err);
    }
  });
  input.click();
}

// ===== Cloudinary削除（Signed Upload環境では別途実装が必要） =====
async function deleteFromCloudinary(urls) {
  const { cloudName } = CLOUDINARY_CONFIG;
  for (const url of urls) {
    const match = url.match(/\/upload\/(?:v\d+\/)?(.+)\.[^.]+$/);
    if (!match) continue;
    const publicId = match[1];
    // Unsigned Upload 環境ではフロントからの削除は原則不可。
    // Signed Upload に切り替えた場合はここで destroy API を呼ぶ。
    console.log('[Cloudinary] 削除対象 publicId:', publicId, '/ URL:', url);
  }
}

// ===== 投稿保存 =====
document.getElementById('btn-submit-post').addEventListener('click', submitPost);

async function submitPost() {
  const countryId = document.getElementById('f-country').value;
  const date = document.getElementById('f-date').value;
  const title = document.getElementById('f-title').value.trim();
  const location = document.getElementById('f-location').value.trim();
  const caption = document.getElementById('f-caption').value.trim();

  if (!countryId) { showToast('国を選択してください', true); return; }
  if (!date) { showToast('日付を入力してください', true); return; }
  if (!title) { showToast('タイトルを入力してください', true); return; }

  const mediaData = mediaRows.map(r => ({
    url: r.url || '',
    type: r.type || 'image',
    caption: r.caption || '',
    isCover: !!r.isCover
  }));

  const payload = {
    countryId, date, title, location, caption,
    media: mediaData,
    updatedAt: serverTimestamp()
  };

  try {
    if (editPostId) {
      await updateDoc(doc(db, 'posts', editPostId), payload);
      showToast('投稿を更新しました');
    } else {
      payload.createdAt = serverTimestamp();
      await addDoc(collection(db, 'posts'), payload);
      showToast('投稿しました');
    }
    await deleteFromCloudinary(deletedMediaUrls);
    resetPostForm();
    await loadPosts();
  } catch (err) {
    console.error(err);
    showToast('保存に失敗しました: ' + err.message, true);
  }
}

function resetPostForm() {
  document.getElementById('f-country').value = '';
  document.getElementById('f-date').value = '';
  document.getElementById('f-title').value = '';
  document.getElementById('f-location').value = '';
  document.getElementById('f-caption').value = '';
  editPostId = null;
  mediaRows = [];
  deletedMediaUrls = [];
  renderMediaList();
  document.getElementById('post-form-title').textContent = '新規投稿';
  document.getElementById('btn-submit-post').textContent = '投稿する';
  document.getElementById('btn-cancel-edit').style.display = 'none';
}

document.getElementById('btn-cancel-edit').addEventListener('click', () => {
  resetPostForm();
});

// ===== 投稿一覧 =====
document.getElementById('list-country-filter').addEventListener('change', renderPostList);

function renderPostList() {
  const container = document.getElementById('post-list-container');
  const filterVal = document.getElementById('list-country-filter').value;

  const filtered = filterVal
    ? posts.filter(p => p.countryId === filterVal)
    : posts;

  if (filtered.length === 0) {
    container.innerHTML = '<p style="color:#8a7e74; font-size:14px; text-align:center; padding:24px;">投稿がありません</p>';
    return;
  }

  container.innerHTML = '';
  filtered.forEach(post => {
    const country = countries.find(c => c.id === post.countryId);
    const countryName = country ? country.name : '不明';

    const mediaCount = (post.media || []).length;
    const hasCover = (post.media || []).some(m => m.isCover && m.type === 'image');

    // サムネイル取得
    const coverMedia = (post.media || []).find(m => m.isCover && m.type === 'image')
      || (post.media || []).find(m => m.type === 'image');

    const item = document.createElement('div');
    item.className = 'post-list-item';

    // サムネイル
    const thumb = document.createElement('div');
    thumb.className = 'post-thumb';
    if (coverMedia) {
      const img = document.createElement('img');
      img.src = coverMedia.url;
      img.alt = '';
      img.onerror = () => { thumb.textContent = '📷'; };
      thumb.appendChild(img);
    } else {
      thumb.textContent = '📷';
    }
    item.appendChild(thumb);

    // 投稿情報
    const info = document.createElement('div');
    info.className = 'post-info';

    const titleEl = document.createElement('div');
    titleEl.className = 'post-title-text';
    titleEl.textContent = post.title || '（タイトルなし）';
    info.appendChild(titleEl);

    const metaEl = document.createElement('div');
    metaEl.className = 'post-meta-text';
    let metaStr = `${countryName} ／ ${post.date} ／ 📎 ${mediaCount}件`;
    if (hasCover) metaStr += ' ／ ★代表写真あり';
    metaEl.textContent = metaStr;
    info.appendChild(metaEl);
    item.appendChild(info);

    // アクション
    const actions = document.createElement('div');
    actions.className = 'post-actions';

    const editBtn = document.createElement('button');
    editBtn.className = 'btn btn-secondary btn-small';
    editBtn.textContent = '編集';
    editBtn.addEventListener('click', () => {
      editPost(post);
      // 新規投稿タブへ切り替え
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
      document.querySelector('[data-tab="new-post"]').classList.add('active');
      document.getElementById('tab-new-post').classList.add('active');
    });
    actions.appendChild(editBtn);

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'btn btn-danger btn-small';
    deleteBtn.textContent = '削除';
    deleteBtn.addEventListener('click', async () => {
      if (!confirm(`「${post.title}」を削除しますか？`)) return;
      try {
        await deleteDoc(doc(db, 'posts', post.id));
        showToast('削除しました');
        await loadPosts();
      } catch (err) {
        console.error(err);
        showToast('削除に失敗しました', true);
      }
    });
    actions.appendChild(deleteBtn);

    item.appendChild(actions);
    container.appendChild(item);
  });
}

function editPost(post) {
  editPostId = post.id;
  deletedMediaUrls = [];

  document.getElementById('f-country').value = post.countryId || '';
  document.getElementById('f-date').value = post.date || '';
  document.getElementById('f-title').value = post.title || '';
  document.getElementById('f-location').value = post.location || '';
  document.getElementById('f-caption').value = post.caption || '';

  mediaRows = (post.media || []).map(m => ({ ...m }));
  renderMediaList();

  document.getElementById('post-form-title').textContent = '投稿を編集';
  document.getElementById('btn-submit-post').textContent = '更新する';
  document.getElementById('btn-cancel-edit').style.display = '';

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ===== 国管理 =====
document.getElementById('btn-save-country').addEventListener('click', saveCountry);
document.getElementById('btn-cancel-country').addEventListener('click', resetCountryForm);

async function saveCountry() {
  const editId = document.getElementById('edit-country-id').value;
  const name = document.getElementById('c-name').value.trim();
  const flag = document.getElementById('c-flag').value.trim();
  const order = parseInt(document.getElementById('c-order').value) || 100;
  const subtitle = document.getElementById('c-subtitle').value.trim();
  const description = document.getElementById('c-description').value.trim();

  if (!name) { showToast('国名を入力してください', true); return; }

  const payload = { name, flag, order, subtitle, description };

  try {
    if (editId) {
      await updateDoc(doc(db, 'countries', editId), payload);
      showToast('国情報を更新しました');
    } else {
      await addDoc(collection(db, 'countries'), payload);
      showToast('国を追加しました');
    }
    resetCountryForm();
    await loadCountries();
  } catch (err) {
    console.error(err);
    showToast('保存に失敗しました: ' + err.message, true);
  }
}

function resetCountryForm() {
  document.getElementById('edit-country-id').value = '';
  document.getElementById('c-name').value = '';
  document.getElementById('c-flag').value = '';
  document.getElementById('c-order').value = '100';
  document.getElementById('c-subtitle').value = '';
  document.getElementById('c-description').value = '';
  document.getElementById('country-form-title').textContent = '国を追加';
  document.getElementById('btn-cancel-country').style.display = 'none';
}

function renderCountryList() {
  const container = document.getElementById('country-list-container');
  if (countries.length === 0) {
    container.innerHTML = '<p style="color:#8a7e74; font-size:14px; text-align:center; padding:24px;">国が登録されていません</p>';
    return;
  }

  container.innerHTML = '';

  const postCountMap = {};
  posts.forEach(p => {
    postCountMap[p.countryId] = (postCountMap[p.countryId] || 0) + 1;
  });

  countries.forEach(c => {
    const count = postCountMap[c.id] || 0;

    const item = document.createElement('div');
    item.className = 'country-list-item';

    const flagEl = document.createElement('span');
    flagEl.className = 'country-flag-display';
    flagEl.textContent = c.flag || '🌍';
    item.appendChild(flagEl);

    const info = document.createElement('div');
    info.className = 'country-info';
    const nameEl = document.createElement('div');
    nameEl.className = 'country-name-admin';
    nameEl.textContent = c.name;
    info.appendChild(nameEl);
    const metaEl = document.createElement('div');
    metaEl.className = 'country-meta-admin';
    metaEl.textContent = `表示順: ${c.order} ／ 投稿: ${count}件`;
    info.appendChild(metaEl);
    item.appendChild(info);

    const actions = document.createElement('div');
    actions.className = 'country-actions';

    const editBtn = document.createElement('button');
    editBtn.className = 'btn btn-secondary btn-small';
    editBtn.textContent = '編集';
    editBtn.addEventListener('click', () => {
      document.getElementById('edit-country-id').value = c.id;
      document.getElementById('c-name').value = c.name || '';
      document.getElementById('c-flag').value = c.flag || '';
      document.getElementById('c-order').value = String(c.order ?? 100);
      document.getElementById('c-subtitle').value = c.subtitle || '';
      document.getElementById('c-description').value = c.description || '';
      document.getElementById('country-form-title').textContent = '国を編集';
      document.getElementById('btn-cancel-country').style.display = '';
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
    actions.appendChild(editBtn);

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'btn btn-danger btn-small';
    deleteBtn.textContent = '削除';
    deleteBtn.disabled = count > 0;
    deleteBtn.title = count > 0 ? '投稿がある国は削除できません' : '';
    deleteBtn.addEventListener('click', async () => {
      if (count > 0) return;
      if (!confirm(`「${c.name}」を削除しますか？`)) return;
      try {
        await deleteDoc(doc(db, 'countries', c.id));
        showToast('削除しました');
        await loadCountries();
      } catch (err) {
        console.error(err);
        showToast('削除に失敗しました', true);
      }
    });
    actions.appendChild(deleteBtn);

    item.appendChild(actions);
    container.appendChild(item);
  });
}

// ===== トースト =====
let toastTimer = null;
function showToast(msg, isError = false) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.toggle('error', isError);
  toast.classList.add('show');
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 3000);
}
