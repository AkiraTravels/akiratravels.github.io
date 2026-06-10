import { db, auth, CLOUDINARY_CONFIG } from '../js/firebase-config.js';
import {
  collection, getDocs, getDoc, addDoc, updateDoc, deleteDoc,
  doc, query, orderBy, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import {
  onAuthStateChanged, signInWithEmailAndPassword, signOut
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

/* ─── 状態 ─── */
let countries = [];
let posts = [];
let editPostId = null;
let mediaRows = [];
let deletedMediaUrls = [];
let editCountryId = null;

/* ─── 認証 ─── */
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

document.getElementById('btn-login').addEventListener('click', doLogin);
document.getElementById('login-password').addEventListener('keydown', e => {
  if (e.key === 'Enter') doLogin();
});
document.getElementById('btn-logout').addEventListener('click', () => signOut(auth));

async function doLogin() {
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  document.getElementById('login-error').textContent = '';
  try {
    await signInWithEmailAndPassword(auth, email, password);
  } catch (e) {
    document.getElementById('login-error').textContent = 'ログインに失敗しました。メールアドレスとパスワードを確認してください。';
  }
}

/* ─── タブ切り替え ─── */
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    const tab = btn.dataset.tab;
    document.getElementById('tab-' + tab).classList.add('active');
    if (tab === 'post-list') renderPostList();
    if (tab === 'country-mgmt') renderCountryList();
  });
});

/* ─── データロード ─── */
async function loadAll() {
  await Promise.all([loadCountries(), loadPosts()]);
}

async function loadCountries() {
  const snap = await getDocs(query(collection(db, 'countries'), orderBy('order', 'asc')));
  countries = [];
  snap.forEach(d => countries.push({ id: d.id, ...d.data() }));
  renderCountrySelect();
  renderCountryFilter();
}

async function loadPosts() {
  const snap = await getDocs(query(collection(db, 'posts'), orderBy('date', 'desc')));
  posts = [];
  snap.forEach(d => posts.push({ id: d.id, ...d.data() }));
}

/* ─── 国セレクト（投稿フォーム） ─── */
function renderCountrySelect() {
  const sel = document.getElementById('f-country');
  const cur = sel.value;
  sel.innerHTML = '<option value="">国を選択…</option>';
  countries.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.textContent = `${c.flag || ''} ${c.name}`.trim();
    sel.appendChild(opt);
  });
  if (cur) sel.value = cur;
}

/* ─── 国フィルター（投稿一覧） ─── */
function renderCountryFilter() {
  const sel = document.getElementById('list-country-filter');
  const cur = sel.value;
  sel.innerHTML = '<option value="">すべての国</option>';
  countries.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.textContent = `${c.flag || ''} ${c.name}`.trim();
    sel.appendChild(opt);
  });
  if (cur) sel.value = cur;
}
document.getElementById('list-country-filter').addEventListener('change', renderPostList);

/* ─── 新規投稿フォーム ─── */
document.getElementById('btn-add-media').addEventListener('click', () => {
  mediaRows.push({ url: '', type: 'image', caption: '', isCover: false });
  renderMediaList();
});

document.getElementById('btn-submit-post').addEventListener('click', submitPost);
document.getElementById('btn-cancel-edit').addEventListener('click', resetPostForm);

function renderMediaList() {
  const list = document.getElementById('media-list');
  list.innerHTML = '';

  mediaRows.forEach((row, i) => {
    const div = document.createElement('div');
    div.className = 'media-row';

    // 削除ボタン
    const removeBtn = document.createElement('button');
    removeBtn.className = 'btn-remove-media';
    removeBtn.textContent = '✕';
    removeBtn.addEventListener('click', () => {
      if (editPostId && row.url) deletedMediaUrls.push(row.url);
      mediaRows.splice(i, 1);
      renderMediaList();
    });
    div.appendChild(removeBtn);

    // ヘッダー行
    const header = document.createElement('div');
    header.className = 'media-row-header';

    // プレビュー
    const preview = document.createElement('div');
    preview.className = 'preview-wrap';
    if (row.url) {
      if (row.type === 'video') {
        const vid = document.createElement('video');
        vid.src = row.url;
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
    urlInput.className = 'm-url';
    urlInput.placeholder = 'Cloudinary URL';
    urlInput.value = row.url || '';
    urlInput.addEventListener('change', () => {
      row.url = urlInput.value;
      renderMediaList();
    });
    fields.appendChild(urlInput);

    const typeSelect = document.createElement('select');
    typeSelect.className = 'm-type';
    [['image', '📷 写真'], ['video', '🎬 動画']].forEach(([val, label]) => {
      const opt = document.createElement('option');
      opt.value = val; opt.textContent = label;
      if (row.type === val) opt.selected = true;
      typeSelect.appendChild(opt);
    });
    typeSelect.addEventListener('change', () => {
      row.type = typeSelect.value;
    });
    fields.appendChild(typeSelect);

    const capTextarea = document.createElement('textarea');
    capTextarea.className = 'm-caption';
    capTextarea.rows = 9;
    capTextarea.style.width = '100%';
    capTextarea.placeholder = 'キャプション（任意）';
    capTextarea.value = row.caption || '';
    capTextarea.addEventListener('input', () => { row.caption = capTextarea.value; });
    fields.appendChild(capTextarea);

    header.appendChild(fields);
    div.appendChild(header);

    // コントロール行
    const controls = document.createElement('div');
    controls.className = 'media-row-controls';

    const coverLabel = document.createElement('label');
    coverLabel.className = 'cover-checkbox-label';
    const coverCheck = document.createElement('input');
    coverCheck.type = 'checkbox';
    coverCheck.className = 'm-cover';
    coverCheck.checked = !!row.isCover;
    coverCheck.addEventListener('change', () => {
      if (coverCheck.checked) {
        mediaRows.forEach(r => r.isCover = false);
        row.isCover = true;
      } else {
        row.isCover = false;
      }
      renderMediaList();
    });
    coverLabel.appendChild(coverCheck);
    coverLabel.appendChild(document.createTextNode(' ★ 代表写真'));
    controls.appendChild(coverLabel);

    const uploadBtn = document.createElement('button');
    uploadBtn.className = 'btn-upload';
    uploadBtn.textContent = '☁️ Cloudinaryにアップロード';
    const progressSpan = document.createElement('span');
    progressSpan.className = 'upload-progress';
    uploadBtn.addEventListener('click', () => uploadMedia(i, progressSpan));
    controls.appendChild(uploadBtn);
    controls.appendChild(progressSpan);

    if (i > 0) {
      const upBtn = document.createElement('button');
      upBtn.className = 'btn-move';
      upBtn.dataset.dir = 'up';
      upBtn.textContent = '▲';
      upBtn.addEventListener('click', () => {
        [mediaRows[i-1], mediaRows[i]] = [mediaRows[i], mediaRows[i-1]];
        renderMediaList();
      });
      controls.appendChild(upBtn);
    }
    if (i < mediaRows.length - 1) {
      const downBtn = document.createElement('button');
      downBtn.className = 'btn-move';
      downBtn.dataset.dir = 'down';
      downBtn.textContent = '▼';
      downBtn.addEventListener('click', () => {
        [mediaRows[i], mediaRows[i+1]] = [mediaRows[i+1], mediaRows[i]];
        renderMediaList();
      });
      controls.appendChild(downBtn);
    }

    div.appendChild(controls);
    list.appendChild(div);

    // 挿入ボタン
    const insertWrap = document.createElement('div');
    insertWrap.className = 'insert-btn-wrap';
    const insertBtn = document.createElement('button');
    insertBtn.className = 'btn-insert';
    insertBtn.dataset.pos = i + 1;
    insertBtn.textContent = '＋ ここに追加';
    insertBtn.addEventListener('click', () => {
      const pos = parseInt(insertBtn.dataset.pos);
      mediaRows.splice(pos, 0, { url: '', type: 'image', caption: '', isCover: false });
      renderMediaList();
    });
    insertWrap.appendChild(insertBtn);
    list.appendChild(insertWrap);
  });
}

async function uploadMedia(idx, progressSpan) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*,video/*';
  input.click();
  input.addEventListener('change', async () => {
    const file = input.files[0];
    if (!file) return;

    const isVideo = file.type.startsWith('video/');
    const resourceType = isVideo ? 'video' : 'image';

    // 既存URLがあれば削除対象に
    if (mediaRows[idx].url) deletedMediaUrls.push(mediaRows[idx].url);

    progressSpan.textContent = 'アップロード中…';
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('upload_preset', CLOUDINARY_CONFIG.uploadPreset);

      const res = await fetch(
        `https://api.cloudinary.com/v1_1/${CLOUDINARY_CONFIG.cloudName}/${resourceType}/upload`,
        { method: 'POST', body: formData }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || 'Upload failed');

      mediaRows[idx].url = data.secure_url;
      mediaRows[idx].type = isVideo ? 'video' : 'image';
      progressSpan.textContent = '✓ アップロード完了';
      setTimeout(() => { progressSpan.textContent = ''; }, 2000);
      renderMediaList();
    } catch (e) {
      progressSpan.textContent = 'エラー: ' + e.message;
    }
  });
}

async function submitPost() {
  const countryId = document.getElementById('f-country').value;
  const date = document.getElementById('f-date').value;
  const title = document.getElementById('f-title').value.trim();
  if (!countryId || !date || !title) {
    showToast('国・日付・タイトルは必須です。', true);
    return;
  }

  const data = {
    countryId,
    date,
    title,
    location: document.getElementById('f-location').value.trim(),
    caption: document.getElementById('f-caption').value.trim(),
    media: mediaRows.map(r => ({
      url: r.url,
      type: r.type,
      caption: r.caption,
      isCover: !!r.isCover
    })),
    updatedAt: serverTimestamp()
  };

  try {
    if (editPostId) {
      await updateDoc(doc(db, 'posts', editPostId), data);
    } else {
      data.createdAt = serverTimestamp();
      await addDoc(collection(db, 'posts'), data);
    }
    await deleteFromCloudinary(deletedMediaUrls);
    showToast(editPostId ? '更新しました。' : '投稿しました。');
    resetPostForm();
    await loadPosts();
  } catch (e) {
    showToast('保存に失敗しました: ' + e.message, true);
  }
}

async function deleteFromCloudinary(urls) {
  for (const url of urls) {
    const match = url.match(/\/upload\/(?:v\d+\/)?(.+)\.[^.]+$/);
    if (!match) continue;
    const publicId = match[1];
    const isVideo = url.includes('/video/upload/');
    const resourceType = isVideo ? 'video' : 'image';
    try {
      // Unsigned upload 環境では署名なし削除は使えないため、ベストエフォートで試みる
      await fetch(
        `https://api.cloudinary.com/v1_1/${CLOUDINARY_CONFIG.cloudName}/${resourceType}/destroy`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ public_id: publicId })
        }
      );
    } catch (_) {
      // 削除失敗は無視（Unsigned upload 制限のため）
    }
  }
}

function resetPostForm() {
  editPostId = null;
  mediaRows = [];
  deletedMediaUrls = [];
  document.getElementById('f-country').value = '';
  document.getElementById('f-date').value = '';
  document.getElementById('f-title').value = '';
  document.getElementById('f-location').value = '';
  document.getElementById('f-caption').value = '';
  document.getElementById('post-form-title').textContent = '新規投稿';
  document.getElementById('btn-submit-post').textContent = '投稿する';
  document.getElementById('btn-cancel-edit').style.display = 'none';
  renderMediaList();
}

/* ─── 投稿一覧 ─── */
function renderPostList() {
  const filterId = document.getElementById('list-country-filter').value;
  const filtered = posts.filter(p => !filterId || p.countryId === filterId);

  const container = document.getElementById('post-list-items');
  container.innerHTML = '';

  if (filtered.length === 0) {
    container.innerHTML = '<p style="color:#8a7e74;padding:16px;">投稿がありません。</p>';
    return;
  }

  filtered.forEach(post => {
    const item = document.createElement('div');
    item.className = 'post-list-item';

    // サムネイル
    const thumbWrap = document.createElement('div');
    thumbWrap.className = 'post-list-thumb';
    const coverMedia = (post.media || []).find(m => m.isCover && m.type === 'image')
      || (post.media || []).find(m => m.type === 'image');
    if (coverMedia) {
      const img = document.createElement('img');
      img.src = coverMedia.url;
      img.alt = '';
      thumbWrap.appendChild(img);
    } else {
      thumbWrap.textContent = '📷';
    }
    item.appendChild(thumbWrap);

    // 情報
    const info = document.createElement('div');
    info.className = 'post-info';
    const countryName = countries.find(c => c.id === post.countryId)?.name || post.countryId;
    const hasCover = (post.media || []).some(m => m.isCover);
    info.innerHTML = `
      <div class="post-title-text">${escHtml(post.title)}</div>
      <div class="post-meta-text">
        ${escHtml(countryName)} ／ ${escHtml(post.date)} ／ 📎 ${(post.media || []).length}件
        ${hasCover ? ' ／ ★代表写真あり' : ''}
      </div>
    `;
    item.appendChild(info);

    // 操作
    const actions = document.createElement('div');
    actions.className = 'post-actions';
    const editBtn = document.createElement('button');
    editBtn.textContent = '編集';
    editBtn.addEventListener('click', () => {
      editPost(post);
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
      document.querySelector('[data-tab="new-post"]').classList.add('active');
      document.getElementById('tab-new-post').classList.add('active');
    });
    const delBtn = document.createElement('button');
    delBtn.textContent = '削除';
    delBtn.addEventListener('click', async () => {
      if (!confirm(`「${post.title}」を削除しますか？`)) return;
      try {
        await deleteDoc(doc(db, 'posts', post.id));
        showToast('削除しました。');
        await loadPosts();
        renderPostList();
      } catch (e) {
        showToast('削除に失敗しました。', true);
      }
    });
    actions.appendChild(editBtn);
    actions.appendChild(delBtn);
    item.appendChild(actions);

    container.appendChild(item);
  });
}

function editPost(post) {
  editPostId = post.id;
  mediaRows = (post.media || []).map(m => ({ ...m }));
  deletedMediaUrls = [];

  document.getElementById('f-country').value = post.countryId || '';
  document.getElementById('f-date').value = post.date || '';
  document.getElementById('f-title').value = post.title || '';
  document.getElementById('f-location').value = post.location || '';
  document.getElementById('f-caption').value = post.caption || '';
  document.getElementById('post-form-title').textContent = '投稿を編集';
  document.getElementById('btn-submit-post').textContent = '更新する';
  document.getElementById('btn-cancel-edit').style.display = '';

  renderMediaList();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* ─── 国管理 ─── */
document.getElementById('btn-save-country').addEventListener('click', saveCountry);
document.getElementById('btn-cancel-country').addEventListener('click', resetCountryForm);

async function saveCountry() {
  const name = document.getElementById('c-name').value.trim();
  if (!name) { showToast('国名は必須です。', true); return; }

  const data = {
    name,
    flag: document.getElementById('c-flag').value.trim(),
    order: parseInt(document.getElementById('c-order').value) || 100,
    subtitle: document.getElementById('c-subtitle').value.trim(),
    description: document.getElementById('c-description').value.trim()
  };

  try {
    if (editCountryId) {
      await updateDoc(doc(db, 'countries', editCountryId), data);
      showToast('更新しました。');
    } else {
      await addDoc(collection(db, 'countries'), data);
      showToast('追加しました。');
    }
    resetCountryForm();
    await loadCountries();
    renderCountryList();
  } catch (e) {
    showToast('保存に失敗しました。', true);
  }
}

function resetCountryForm() {
  editCountryId = null;
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
  const container = document.getElementById('country-list-items');
  container.innerHTML = '';

  if (countries.length === 0) {
    container.innerHTML = '<p style="color:#8a7e74;padding:16px;">国がありません。</p>';
    return;
  }

  countries.forEach(c => {
    const postCount = posts.filter(p => p.countryId === c.id).length;
    const item = document.createElement('div');
    item.className = 'country-list-item';

    item.innerHTML = `
      <div class="country-flag-cell">${c.flag || '🌍'}</div>
      <div class="country-info">
        <strong>${escHtml(c.name)}</strong>
        <small>表示順: ${c.order} ／ 投稿: ${postCount}件</small>
      </div>
    `;

    const actions = document.createElement('div');
    actions.className = 'country-actions';

    const editBtn = document.createElement('button');
    editBtn.textContent = '編集';
    editBtn.addEventListener('click', () => {
      editCountryId = c.id;
      document.getElementById('edit-country-id').value = c.id;
      document.getElementById('c-name').value = c.name || '';
      document.getElementById('c-flag').value = c.flag || '';
      document.getElementById('c-order').value = c.order ?? 100;
      document.getElementById('c-subtitle').value = c.subtitle || '';
      document.getElementById('c-description').value = c.description || '';
      document.getElementById('country-form-title').textContent = '国を編集';
      document.getElementById('btn-cancel-country').style.display = '';
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    const delBtn = document.createElement('button');
    delBtn.textContent = '削除';
    delBtn.disabled = postCount > 0;
    delBtn.title = postCount > 0 ? '投稿がある国は削除できません' : '';
    delBtn.addEventListener('click', async () => {
      if (!confirm(`「${c.name}」を削除しますか？`)) return;
      try {
        await deleteDoc(doc(db, 'countries', c.id));
        showToast('削除しました。');
        await loadCountries();
        renderCountryList();
      } catch (e) {
        showToast('削除に失敗しました。', true);
      }
    });

    actions.appendChild(editBtn);
    actions.appendChild(delBtn);
    item.appendChild(actions);
    container.appendChild(item);
  });
}

/* ─── トースト ─── */
let toastTimer = null;
function showToast(msg, isError = false) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = 'toast' + (isError ? ' error' : '');
  el.classList.add('show');
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 3000);
}

/* ─── ユーティリティ ─── */
function escHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
