import { db, auth, CLOUDINARY_CONFIG } from '../js/firebase-config.js';
import {
  collection, getDocs, addDoc, updateDoc, deleteDoc,
  doc, query, orderBy, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import {
  signInWithEmailAndPassword, signOut, onAuthStateChanged
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';

// ─────────────────────────────────────────
// 状態
// ─────────────────────────────────────────
let countries = [];
let allPosts = [];
let mediaRows = [];          // 現在フォームに表示中のメディア行データ
let editPostId = null;
let deletedMediaUrls = [];   // 編集時に削除されたメディアURL（Cloudinary削除用）

// ─────────────────────────────────────────
// ユーティリティ
// ─────────────────────────────────────────
function $(id) { return document.getElementById(id); }

function showToast(msg, isError = false) {
  const t = $('toast');
  t.textContent = msg;
  t.className = 'toast' + (isError ? ' error' : '');
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3000);
}

function escHtml(s) {
  return String(s || '')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ─────────────────────────────────────────
// 認証
// ─────────────────────────────────────────
onAuthStateChanged(auth, user => {
  if (user) {
    $('login-screen').style.display = 'none';
    $('admin-main').style.display = '';
    $('header-user').style.display = '';
    $('user-email').textContent = user.email;
    loadAll();
  } else {
    $('login-screen').style.display = '';
    $('admin-main').style.display = 'none';
    $('header-user').style.display = 'none';
  }
});

$('btn-login').addEventListener('click', async () => {
  const email = $('login-email').value.trim();
  const pass = $('login-password').value;
  $('login-error').style.display = 'none';
  try {
    await signInWithEmailAndPassword(auth, email, pass);
  } catch (e) {
    const el = $('login-error');
    el.textContent = 'ログインに失敗しました。メールアドレスとパスワードを確認してください。';
    el.style.display = '';
  }
});

$('login-password').addEventListener('keydown', e => {
  if (e.key === 'Enter') $('btn-login').click();
});

$('btn-logout').addEventListener('click', () => signOut(auth));

// ─────────────────────────────────────────
// タブ切り替え
// ─────────────────────────────────────────
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    $('tab-' + btn.dataset.tab).classList.add('active');
    if (btn.dataset.tab === 'post-list') renderPostList();
    if (btn.dataset.tab === 'country-mgmt') renderCountryList();
  });
});

// ─────────────────────────────────────────
// データロード
// ─────────────────────────────────────────
async function loadAll() {
  await Promise.all([loadCountries(), loadPosts()]);
}

async function loadCountries() {
  const snap = await getDocs(query(collection(db, 'countries'), orderBy('order', 'asc')));
  countries = [];
  snap.forEach(d => countries.push({ id: d.id, ...d.data() }));
  renderCountrySelect();
  renderCountryList();
}

async function loadPosts() {
  const snap = await getDocs(query(collection(db, 'posts'), orderBy('date', 'desc')));
  allPosts = [];
  snap.forEach(d => allPosts.push({ id: d.id, ...d.data() }));
  renderPostList();
}

// ─────────────────────────────────────────
// 国セレクト
// ─────────────────────────────────────────
function renderCountrySelect() {
  const sel = $('f-country');
  sel.innerHTML = '<option value="">-- 選択してください --</option>';
  countries.forEach(c => {
    sel.innerHTML += `<option value="${c.id}">${escHtml(c.flag || '')} ${escHtml(c.name)}</option>`;
  });
}

// ─────────────────────────────────────────
// メディアフォーム
// ─────────────────────────────────────────
function renderMediaList() {
  const list = $('media-list');
  list.innerHTML = '';

  mediaRows.forEach((row, idx) => {
    // メディア行
    const rowEl = document.createElement('div');
    rowEl.className = 'media-row';
    rowEl.dataset.idx = idx;

    const previewHtml = row.url
      ? (row.type === 'video'
          ? `<video class="media-preview" src="${escHtml(row.url)}" muted playsinline></video>`
          : `<img class="media-preview" src="${escHtml(row.url)}" alt="">`)
      : `<div class="media-preview-placeholder">No media</div>`;

    rowEl.innerHTML = `
      <button class="btn-remove-media" data-idx="${idx}" title="削除">×</button>
      <div class="media-row-header">
        <div class="preview-wrap">${previewHtml}</div>
        <div class="media-row-fields">
          <input type="url" class="m-url" placeholder="Cloudinary URL" value="${escHtml(row.url || '')}">
          <select class="m-type">
            <option value="image" ${row.type !== 'video' ? 'selected' : ''}>📷 写真</option>
            <option value="video" ${row.type === 'video' ? 'selected' : ''}>🎬 動画</option>
          </select>
          <textarea class="m-caption" rows="2" placeholder="キャプション">${escHtml(row.caption || '')}</textarea>
        </div>
      </div>
      <div class="media-row-controls">
        <label class="cover-checkbox-label">
          <input type="checkbox" class="m-cover" ${row.isCover ? 'checked' : ''}>
          ★ 国別ページの代表写真に設定
        </label>
        <button class="btn-upload" data-idx="${idx}">☁️ Cloudinaryにアップロード</button>
        <button class="btn-move" data-dir="up" data-idx="${idx}">↑</button>
        <button class="btn-move" data-dir="down" data-idx="${idx}">↓</button>
        <span class="upload-progress" id="up-progress-${idx}" style="display:none;"></span>
      </div>`;

    list.appendChild(rowEl);

    // 行間挿入ボタン
    const insertWrap = document.createElement('div');
    insertWrap.className = 'insert-btn-wrap';
    insertWrap.innerHTML = `<button class="btn-insert" data-pos="${idx + 1}">＋ ここに追加</button>`;
    list.appendChild(insertWrap);

    // イベント
    rowEl.querySelector('.m-url').addEventListener('input', e => {
      mediaRows[idx].url = e.target.value;
      updatePreview(rowEl, mediaRows[idx]);
    });
    rowEl.querySelector('.m-type').addEventListener('change', e => {
      mediaRows[idx].type = e.target.value;
    });
    rowEl.querySelector('.m-caption').addEventListener('input', e => {
      mediaRows[idx].caption = e.target.value;
    });
    rowEl.querySelector('.m-cover').addEventListener('change', e => {
      if (e.target.checked) {
        mediaRows.forEach((r, i) => { r.isCover = (i === idx); });
        renderMediaList();
      } else {
        mediaRows[idx].isCover = false;
      }
    });
  });

  // 削除ボタン
  list.querySelectorAll('.btn-remove-media').forEach(btn => {
    btn.addEventListener('click', () => {
      const i = Number(btn.dataset.idx);
      const url = mediaRows[i].url;
      if (url && editPostId) deletedMediaUrls.push(url);
      mediaRows.splice(i, 1);
      renderMediaList();
    });
  });

  // アップロードボタン
  list.querySelectorAll('.btn-upload').forEach(btn => {
    btn.addEventListener('click', () => uploadMedia(Number(btn.dataset.idx)));
  });

  // 移動ボタン
  list.querySelectorAll('.btn-move').forEach(btn => {
    btn.addEventListener('click', () => {
      const i = Number(btn.dataset.idx);
      const dir = btn.dataset.dir;
      if (dir === 'up' && i > 0) {
        [mediaRows[i - 1], mediaRows[i]] = [mediaRows[i], mediaRows[i - 1]];
      } else if (dir === 'down' && i < mediaRows.length - 1) {
        [mediaRows[i], mediaRows[i + 1]] = [mediaRows[i + 1], mediaRows[i]];
      }
      renderMediaList();
    });
  });

  // 挿入ボタン
  list.querySelectorAll('.btn-insert').forEach(btn => {
    btn.addEventListener('click', () => {
      const pos = Number(btn.dataset.pos);
      mediaRows.splice(pos, 0, { url: '', type: 'image', caption: '', isCover: false });
      renderMediaList();
    });
  });
}

function updatePreview(rowEl, row) {
  const wrap = rowEl.querySelector('.preview-wrap');
  if (!row.url) {
    wrap.innerHTML = `<div class="media-preview-placeholder">No media</div>`;
    return;
  }
  if (row.type === 'video') {
    wrap.innerHTML = `<video class="media-preview" src="${escHtml(row.url)}" muted playsinline></video>`;
  } else {
    wrap.innerHTML = `<img class="media-preview" src="${escHtml(row.url)}" alt="">`;
  }
}

// Cloudinaryアップロード
async function uploadMedia(idx) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*,video/*';
  input.onchange = async () => {
    const file = input.files[0];
    if (!file) return;

    const isVideo = file.type.startsWith('video/');
    const resourceType = isVideo ? 'video' : 'image';
    mediaRows[idx].type = isVideo ? 'video' : 'image';

    const progressEl = $(`up-progress-${idx}`);
    progressEl.style.display = '';
    progressEl.textContent = 'アップロード中…';

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('upload_preset', CLOUDINARY_CONFIG.uploadPreset);

      const res = await fetch(
        `https://api.cloudinary.com/v1_1/${CLOUDINARY_CONFIG.cloudName}/${resourceType}/upload`,
        { method: 'POST', body: formData }
      );
      const data = await res.json();
      if (data.secure_url) {
        mediaRows[idx].url = data.secure_url;
        progressEl.textContent = '✓ アップロード完了';
        setTimeout(() => { progressEl.style.display = 'none'; }, 2000);
        renderMediaList();
      } else {
        progressEl.textContent = 'エラー: ' + (data.error?.message || '不明');
      }
    } catch (e) {
      progressEl.textContent = 'アップロード失敗';
      console.error(e);
    }
  };
  input.click();
}

// ─────────────────────────────────────────
// メディア追加ボタン（下段）
// ─────────────────────────────────────────
$('btn-add-media-bottom').addEventListener('click', () => {
  mediaRows.push({ url: '', type: 'image', caption: '', isCover: false });
  renderMediaList();
});

// ─────────────────────────────────────────
// 投稿フォーム送信
// ─────────────────────────────────────────
$('btn-submit-post').addEventListener('click', submitPost);
$('btn-cancel-edit').addEventListener('click', resetPostForm);

async function submitPost() {
  const countryId = $('f-country').value;
  const date = $('f-date').value;
  const title = $('f-title').value.trim();

  if (!countryId || !date || !title) {
    showToast('国・日付・タイトルは必須です', true);
    return;
  }

  const postData = {
    countryId,
    date,
    title,
    location: $('f-location').value.trim(),
    caption: $('f-caption').value.trim(),
    media: mediaRows.map(r => ({
      url:     r.url || '',
      type:    r.type || 'image',
      caption: r.caption || '',
      isCover: r.isCover || false
    })),
    updatedAt: serverTimestamp()
  };

  try {
    if (editPostId) {
      await updateDoc(doc(db, 'posts', editPostId), postData);
      // Cloudinaryから削除されたメディアを削除（delete_tokenがある場合のみ）
      // ※ Unsigned Upload では delete_token は返らないため、管理画面で別途対応が必要
      showToast('投稿を更新しました');
    } else {
      postData.createdAt = serverTimestamp();
      await addDoc(collection(db, 'posts'), postData);
      showToast('投稿しました');
    }
    resetPostForm();
    await loadPosts();
  } catch (e) {
    console.error(e);
    showToast('保存に失敗しました', true);
  }
}

function resetPostForm() {
  editPostId = null;
  deletedMediaUrls = [];
  mediaRows = [];
  $('edit-post-id').value = '';
  $('f-country').value = '';
  $('f-date').value = '';
  $('f-title').value = '';
  $('f-location').value = '';
  $('f-caption').value = '';
  $('post-form-title').textContent = '新規投稿';
  $('btn-submit-post').textContent = '投稿する';
  $('btn-cancel-edit').style.display = 'none';
  renderMediaList();
}

// ─────────────────────────────────────────
// 投稿一覧
// ─────────────────────────────────────────
function renderPostList() {
  const container = $('post-list-container');
  if (allPosts.length === 0) {
    container.innerHTML = '<p class="empty-msg">投稿はまだありません</p>';
    return;
  }

  const countryMap = {};
  countries.forEach(c => { countryMap[c.id] = c.name; });

  container.innerHTML = '';
  allPosts.forEach(post => {
    const thumb = getThumb(post);
    const countryName = countryMap[post.countryId] || post.countryId;
    const mediaCount = (post.media || []).length;
    const hasCover = (post.media || []).some(m => m.isCover);

    const item = document.createElement('div');
    item.className = 'post-list-item';
    item.innerHTML = `
      ${thumb
        ? `<img class="post-thumb" src="${escHtml(thumb)}" alt="">`
        : `<div class="post-thumb-placeholder">📷</div>`}
      <div class="post-info">
        <div class="post-title-text">${escHtml(post.title)}</div>
        <div class="post-meta-text">
          ${escHtml(countryName)} ／ ${escHtml(post.date)}
          ／ 📎 ${mediaCount}件
          ${hasCover ? '／ ★代表写真あり' : ''}
        </div>
      </div>
      <div class="post-actions">
        <button class="btn-edit" data-id="${post.id}">編集</button>
        <button class="btn-delete" data-id="${post.id}">削除</button>
      </div>`;

    item.querySelector('.btn-edit').addEventListener('click', () => editPost(post));
    item.querySelector('.btn-delete').addEventListener('click', () => deletePost(post.id));
    container.appendChild(item);
  });
}

function getThumb(post) {
  if (!post.media || post.media.length === 0) return null;
  const cover = post.media.find(m => m.isCover && m.type === 'image');
  if (cover) return cover.url;
  const first = post.media.find(m => m.type === 'image');
  return first ? first.url : null;
}

function editPost(post) {
  // タブを新規投稿に切り替え
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.querySelector('[data-tab="new-post"]').classList.add('active');
  $('tab-new-post').classList.add('active');

  editPostId = post.id;
  deletedMediaUrls = [];
  $('edit-post-id').value = post.id;
  $('f-country').value = post.countryId || '';
  $('f-date').value = post.date || '';
  $('f-title').value = post.title || '';
  $('f-location').value = post.location || '';
  $('f-caption').value = post.caption || '';
  mediaRows = (post.media || []).map(m => ({ ...m }));

  $('post-form-title').textContent = '投稿を編集';
  $('btn-submit-post').textContent = '更新する';
  $('btn-cancel-edit').style.display = '';
  renderMediaList();

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function deletePost(id) {
  if (!confirm('この投稿を削除しますか？')) return;
  try {
    await deleteDoc(doc(db, 'posts', id));
    showToast('投稿を削除しました');
    await loadPosts();
  } catch (e) {
    console.error(e);
    showToast('削除に失敗しました', true);
  }
}

// ─────────────────────────────────────────
// 国管理
// ─────────────────────────────────────────
$('btn-save-country').addEventListener('click', saveCountry);
$('btn-cancel-country').addEventListener('click', resetCountryForm);

async function saveCountry() {
  const name = $('c-name').value.trim();
  const flag = $('c-flag').value.trim();
  const order = Number($('c-order').value) || 100;
  const subtitle = $('c-subtitle').value.trim();
  const description = $('c-description').value.trim();
  const editId = $('edit-country-id').value;

  if (!name || !flag) {
    showToast('国名と国旗絵文字は必須です', true);
    return;
  }

  const data = { name, flag, order, subtitle, description };
  try {
    if (editId) {
      await updateDoc(doc(db, 'countries', editId), data);
      showToast('国情報を更新しました');
    } else {
      await addDoc(collection(db, 'countries'), data);
      showToast('国を追加しました');
    }
    resetCountryForm();
    await loadCountries();
  } catch (e) {
    console.error(e);
    showToast('保存に失敗しました', true);
  }
}

function resetCountryForm() {
  $('edit-country-id').value = '';
  $('c-name').value = '';
  $('c-flag').value = '';
  $('c-order').value = '100';
  $('c-subtitle').value = '';
  $('c-description').value = '';
  $('btn-save-country').textContent = '保存';
  $('btn-cancel-country').style.display = 'none';
}

function renderCountryList() {
  const container = $('country-list-mgmt');
  if (countries.length === 0) {
    container.innerHTML = '<p class="empty-msg">国データがありません</p>';
    return;
  }

  // 投稿数カウント
  const postCount = {};
  allPosts.forEach(p => {
    postCount[p.countryId] = (postCount[p.countryId] || 0) + 1;
  });

  container.innerHTML = '';
  countries.forEach(c => {
    const cnt = postCount[c.id] || 0;
    const item = document.createElement('div');
    item.className = 'country-list-item';
    item.innerHTML = `
      <span class="country-list-flag">${escHtml(c.flag || '')}</span>
      <div class="country-list-info">
        <div class="country-list-name">${escHtml(c.name)}</div>
        <div class="country-list-order">表示順: ${c.order || 0} ／ 投稿: ${cnt}件</div>
      </div>
      <div class="country-list-actions">
        <button class="btn-edit" data-id="${c.id}">編集</button>
        <button class="btn-delete" data-id="${c.id}" ${cnt > 0 ? 'disabled title="投稿がある国は削除できません"' : ''}>削除</button>
      </div>`;

    item.querySelector('.btn-edit').addEventListener('click', () => editCountry(c));
    const delBtn = item.querySelector('.btn-delete');
    if (cnt === 0) {
      delBtn.addEventListener('click', () => deleteCountry(c.id));
    }
    container.appendChild(item);
  });
}

function editCountry(c) {
  $('edit-country-id').value = c.id;
  $('c-name').value = c.name || '';
  $('c-flag').value = c.flag || '';
  $('c-order').value = c.order || 100;
  $('c-subtitle').value = c.subtitle || '';
  $('c-description').value = c.description || '';
  $('btn-save-country').textContent = '更新';
  $('btn-cancel-country').style.display = '';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function deleteCountry(id) {
  if (!confirm('この国を削除しますか？')) return;
  try {
    await deleteDoc(doc(db, 'countries', id));
    showToast('国を削除しました');
    await loadCountries();
  } catch (e) {
    console.error(e);
    showToast('削除に失敗しました', true);
  }
}

// 初期メディアリストをレンダリング（空）
renderMediaList();
