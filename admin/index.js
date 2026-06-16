import { db, auth, CLOUDINARY_CONFIG } from '../js/firebase-config.js';
import {
  collection, getDocs, getDoc, addDoc, updateDoc, deleteDoc,
  doc, query, orderBy, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import {
  onAuthStateChanged, signInWithEmailAndPassword, signOut
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

// ─── 状態変数 ────────────────────────────────────────────
let countries       = [];
let posts           = [];
let mediaRows       = [];
let editPostId      = null;
let deletedMediaUrls = [];

// ─── 認証 ────────────────────────────────────────────────
onAuthStateChanged(auth, user => {
  if (user) {
    document.getElementById('admin-main').style.display    = '';
    document.getElementById('login-screen').style.display  = 'none';
    document.getElementById('header-user').style.display   = '';
    document.getElementById('header-email').textContent    = user.email;
    loadAll();
  } else {
    document.getElementById('admin-main').style.display    = 'none';
    document.getElementById('login-screen').style.display  = '';
    document.getElementById('header-user').style.display   = 'none';
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

// ─── データロード ─────────────────────────────────────────
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
  const selForm   = document.getElementById('f-country');
  const selFilter = document.getElementById('list-country-filter');
  const prevForm   = selForm.value;
  const prevFilter = selFilter.value;

  selForm.innerHTML   = '<option value="">— 選択してください —</option>';
  selFilter.innerHTML = '<option value="">すべての国</option>';

  countries.forEach(c => {
    const label = c.flag ? `${c.flag} ${c.name}` : c.name;
    const o1 = document.createElement('option');
    o1.value = c.id; o1.textContent = label;
    selForm.appendChild(o1);

    const o2 = document.createElement('option');
    o2.value = c.id; o2.textContent = label;
    selFilter.appendChild(o2);
  });

  if (prevForm)   selForm.value   = prevForm;
  if (prevFilter) selFilter.value = prevFilter;
}

// ─── タブ切り替え ─────────────────────────────────────────
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const tab = btn.dataset.tab;
    switchTab(tab);
    if (tab === 'post-list')    renderPostList();
    if (tab === 'country-mgmt') renderCountryList();
  });
});

function switchTab(name) {
  document.querySelectorAll('.tab-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.tab === name);
  });
  document.querySelectorAll('.tab-panel').forEach(p => {
    p.classList.toggle('active', p.id === `tab-${name}`);
  });
}

// ─── メディアリスト描画 ───────────────────────────────────
function renderMediaList() {
  const list = document.getElementById('media-list');
  list.innerHTML = '';

  mediaRows.forEach((m, idx) => {
    // 挿入ボタン（先頭の前）
    if (idx === 0) {
      list.appendChild(makeInsertBtn(0));
    }

    const row = document.createElement('div');
    row.className = 'media-row';

    // × ボタン
    const rmBtn = document.createElement('button');
    rmBtn.className = 'btn-remove-media';
    rmBtn.textContent = '×';
    rmBtn.addEventListener('click', () => {
      if (m.url) deletedMediaUrls.push(m.url);
      mediaRows.splice(idx, 1);
      renderMediaList();
    });
    row.appendChild(rmBtn);

    // ヘッダー行
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
    } else if (m.url) {
      const img = document.createElement('img');
      img.src = m.url;
      img.alt = '';
      preview.appendChild(img);
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
    urlInput.value = m.url || '';
    urlInput.placeholder = 'https://res.cloudinary.com/…';
    urlInput.addEventListener('change', () => {
      mediaRows[idx].url = urlInput.value;
      renderMediaList();
    });
    fields.appendChild(urlInput);

    const typeSelect = document.createElement('select');
    typeSelect.className = 'm-type';
    [['image','📷 写真'],['video','🎬 動画']].forEach(([v, t]) => {
      const o = document.createElement('option');
      o.value = v; o.textContent = t;
      if (m.type === v) o.selected = true;
      typeSelect.appendChild(o);
    });
    typeSelect.addEventListener('change', () => { mediaRows[idx].type = typeSelect.value; });
    fields.appendChild(typeSelect);

    const capTA = document.createElement('textarea');
    capTA.className = 'm-caption';
    capTA.rows = 9;
    capTA.placeholder = 'このメディアのキャプション（任意）';
    capTA.value = m.caption || '';
    capTA.addEventListener('input', () => { mediaRows[idx].caption = capTA.value; });
    fields.appendChild(capTA);

    header.appendChild(fields);
    row.appendChild(header);

    // コントロール行
    const controls = document.createElement('div');
    controls.className = 'media-row-controls';

    const coverLabel = document.createElement('label');
    coverLabel.className = 'cover-checkbox-label';
    const coverCb = document.createElement('input');
    coverCb.type = 'checkbox';
    coverCb.className = 'm-cover';
    coverCb.checked = !!m.isCover;
    coverCb.addEventListener('change', () => {
      mediaRows.forEach((r, i) => { r.isCover = (i === idx && coverCb.checked); });
      renderMediaList();
    });
    coverLabel.appendChild(coverCb);
    coverLabel.appendChild(document.createTextNode(' ★ 代表写真'));
    controls.appendChild(coverLabel);

    const uploadBtn = document.createElement('button');
    uploadBtn.className = 'btn-upload';
    uploadBtn.textContent = '☁️ Cloudinaryにアップロード';
    uploadBtn.addEventListener('click', () => uploadMedia(idx));
    controls.appendChild(uploadBtn);

    if (idx > 0) {
      const upBtn = document.createElement('button');
      upBtn.className = 'btn-move';
      upBtn.dataset.dir = 'up';
      upBtn.textContent = '↑';
      upBtn.addEventListener('click', () => {
        [mediaRows[idx-1], mediaRows[idx]] = [mediaRows[idx], mediaRows[idx-1]];
        renderMediaList();
      });
      controls.appendChild(upBtn);
    }
    if (idx < mediaRows.length - 1) {
      const downBtn = document.createElement('button');
      downBtn.className = 'btn-move';
      downBtn.dataset.dir = 'down';
      downBtn.textContent = '↓';
      downBtn.addEventListener('click', () => {
        [mediaRows[idx], mediaRows[idx+1]] = [mediaRows[idx+1], mediaRows[idx]];
        renderMediaList();
      });
      controls.appendChild(downBtn);
    }

    const progress = document.createElement('span');
    progress.className = 'upload-progress';
    progress.id = `upload-progress-${idx}`;
    controls.appendChild(progress);

    row.appendChild(controls);
    list.appendChild(row);

    // 挿入ボタン
    list.appendChild(makeInsertBtn(idx + 1));
  });
}

function makeInsertBtn(insertIdx) {
  const wrap = document.createElement('div');
  wrap.className = 'insert-btn-wrap';
  const btn = document.createElement('button');
  btn.className = 'btn-insert';
  btn.textContent = '＋ ここに挿入';
  btn.addEventListener('click', () => {
    mediaRows.splice(insertIdx, 0, { url: '', type: 'image', caption: '', isCover: false });
    renderMediaList();
  });
  wrap.appendChild(btn);
  return wrap;
}

document.getElementById('btn-add-media').addEventListener('click', () => {
  mediaRows.push({ url: '', type: 'image', caption: '', isCover: false });
  renderMediaList();
});

// ─── Cloudinary アップロード ─────────────────────────────
async function uploadMedia(idx) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*,video/*';
  input.click();

  input.addEventListener('change', async () => {
    const file = input.files[0];
    if (!file) return;

    const progressEl = document.getElementById(`upload-progress-${idx}`);
    if (progressEl) progressEl.textContent = 'アップロード中…';

    if (mediaRows[idx].url) deletedMediaUrls.push(mediaRows[idx].url);

    const resourceType = file.type.startsWith('video/') ? 'video' : 'image';
    const fd = new FormData();
    fd.append('file', file);
    fd.append('upload_preset', CLOUDINARY_CONFIG.uploadPreset);

    try {
      const res  = await fetch(
        `https://api.cloudinary.com/v1_1/${CLOUDINARY_CONFIG.cloudName}/${resourceType}/upload`,
        { method: 'POST', body: fd }
      );
      const data = await res.json();
      mediaRows[idx].url  = data.secure_url;
      mediaRows[idx].type = resourceType;
      renderMediaList();
      const el = document.getElementById(`upload-progress-${idx}`);
      if (el) { el.textContent = '✓ アップロード完了'; el.className = 'upload-progress success'; }
      setTimeout(() => {
        const e2 = document.getElementById(`upload-progress-${idx}`);
        if (e2) { e2.textContent = ''; e2.className = 'upload-progress'; }
      }, 2000);
    } catch (err) {
      const el = document.getElementById(`upload-progress-${idx}`);
      if (el) { el.textContent = `エラー: ${err.message}`; el.className = 'upload-progress error'; }
    }
  });
}

// ─── 投稿保存 ────────────────────────────────────────────
document.getElementById('btn-submit').addEventListener('click', submitPost);

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

  try {
    if (editPostId === null) {
      postData.createdAt = serverTimestamp();
      await addDoc(collection(db, 'posts'), postData);
      showToast('投稿を保存しました');
    } else {
      await updateDoc(doc(db, 'posts', editPostId), postData);
      showToast('投稿を更新しました');
    }

    // 代表写真 imgUrl の更新
    const coverRow = mediaRows.find(m => m.isCover && m.url);
    if (coverRow) {
      await updateDoc(doc(db, 'countries', countryId), { imgUrl: coverRow.url });
    }

    // docUrl の更新
    if (location.startsWith('https://')) {
      await updateDoc(doc(db, 'countries', countryId), { docUrl: location });
    }

    await deleteFromCloudinary(deletedMediaUrls);
    resetPostForm();
    await loadPosts();
  } catch (err) {
    showToast(`保存エラー: ${err.message}`, true);
    console.error(err);
  }
}

function resetPostForm() {
  editPostId        = null;
  deletedMediaUrls  = [];
  mediaRows         = [];
  document.getElementById('f-country').value  = '';
  document.getElementById('f-date').value     = '';
  document.getElementById('f-title').value    = '';
  document.getElementById('f-location').value = '';
  document.getElementById('f-caption').value  = '';
  document.getElementById('form-title').textContent        = '新規投稿';
  document.getElementById('btn-submit').textContent        = '投稿する';
  document.getElementById('btn-cancel-edit').style.display = 'none';
  renderMediaList();
}

document.getElementById('btn-cancel-edit').addEventListener('click', resetPostForm);

// ─── 投稿編集 ────────────────────────────────────────────
function editPost(post) {
  switchTab('new-post');
  editPostId        = post.id;
  deletedMediaUrls  = [];
  document.getElementById('f-country').value  = post.countryId || '';
  document.getElementById('f-date').value     = post.date      || '';
  document.getElementById('f-title').value    = post.title     || '';
  document.getElementById('f-location').value = post.location  || '';
  document.getElementById('f-caption').value  = post.caption   || '';
  mediaRows = (post.media || []).map(m => ({ ...m }));
  renderMediaList();
  document.getElementById('form-title').textContent        = '投稿を編集';
  document.getElementById('btn-submit').textContent        = '更新する';
  document.getElementById('btn-cancel-edit').style.display = '';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ─── Cloudinary 削除 ─────────────────────────────────────
async function deleteFromCloudinary(urls) {
  for (const url of urls) {
    const match = url.match(/\/upload\/(?:v\d+\/)?(.+)\.[^.]+$/);
    if (!match) continue;
    const publicId     = match[1];
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

// ─── 投稿一覧 ────────────────────────────────────────────
async function renderPostList() {
  const container = document.getElementById('post-list-container');
  container.innerHTML = '';

  const filterVal = document.getElementById('list-country-filter').value;
  let filtered = filterVal ? posts.filter(p => p.countryId === filterVal) : [...posts];
  filtered.sort((a, b) => b.date.localeCompare(a.date));

  if (filtered.length === 0) {
    container.innerHTML = '<p style="color:#aaa;text-align:center;">投稿がありません</p>';
    return;
  }

  filtered.forEach(post => {
    const c = countries.find(x => x.id === post.countryId);
    const countryName = c ? c.name : '不明';

    // サムネイル
    const mediaArr = post.media || [];
    const firstImg = mediaArr.find(m => m.type === 'image');
    const thumbUrl = firstImg ? firstImg.url : null;

    // 代表写真フラグ
    const isCoverPost = c && c.imgUrl && mediaArr.some(m => m.url === c.imgUrl);

    const item = document.createElement('div');
    item.className = 'post-list-item';

    const thumb = document.createElement('div');
    thumb.className = 'post-thumbnail';
    if (thumbUrl) {
      const img = document.createElement('img');
      img.src = thumbUrl;
      img.alt = post.title;
      thumb.appendChild(img);
    } else {
      thumb.textContent = '📷';
    }
    item.appendChild(thumb);

    const info = document.createElement('div');
    info.className = 'post-info';
    const titleDiv = document.createElement('div');
    titleDiv.className = 'post-title-text';
    titleDiv.textContent = post.title;
    info.appendChild(titleDiv);
    const metaDiv = document.createElement('div');
    metaDiv.className = 'post-meta-text';
    metaDiv.textContent = `${countryName} ／ ${post.date} ／ 📎 ${mediaArr.length}件${isCoverPost ? ' ／ ★代表写真あり' : ''}`;
    info.appendChild(metaDiv);
    item.appendChild(info);

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
        showToast('削除しました');
        await loadPosts();
        renderPostList();
      } catch (err) {
        showToast(`削除エラー: ${err.message}`, true);
      }
    });
    actions.appendChild(delBtn);
    item.appendChild(actions);

    container.appendChild(item);
  });
}

document.getElementById('list-country-filter').addEventListener('change', renderPostList);

// ─── 国管理 ──────────────────────────────────────────────
function renderCountryList() {
  const container = document.getElementById('country-list-container');
  container.innerHTML = '';

  if (countries.length === 0) {
    container.innerHTML = '<p style="color:#aaa;text-align:center;">国データがありません</p>';
    return;
  }

  const postCount = {};
  posts.forEach(p => { postCount[p.countryId] = (postCount[p.countryId] || 0) + 1; });

  countries.forEach(c => {
    const count = postCount[c.id] || 0;
    const item = document.createElement('div');
    item.className = 'country-list-item';

    const flagCell = document.createElement('div');
    flagCell.className = 'country-flag-cell';
    flagCell.textContent = c.flag || '🌐';
    item.appendChild(flagCell);

    const info = document.createElement('div');
    info.className = 'country-item-info';
    const nameDiv = document.createElement('div');
    nameDiv.className = 'country-item-name';
    nameDiv.textContent = c.name;
    info.appendChild(nameDiv);
    const metaDiv = document.createElement('div');
    metaDiv.className = 'country-item-meta';
    metaDiv.textContent = `表示順: ${c.order} ／ 投稿: ${count}件`;
    info.appendChild(metaDiv);
    item.appendChild(info);

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
    if (count > 0) {
      delBtn.disabled = true;
      delBtn.title = '投稿がある国は削除できません';
    } else {
      delBtn.addEventListener('click', async () => {
        if (!confirm(`「${c.name}」を削除しますか？`)) return;
        try {
          await deleteDoc(doc(db, 'countries', c.id));
          showToast('削除しました');
          await loadAll();
          renderCountryList();
        } catch (err) {
          showToast(`削除エラー: ${err.message}`, true);
        }
      });
    }
    actions.appendChild(delBtn);
    item.appendChild(actions);
    container.appendChild(item);
  });
}

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
    showToast(`保存エラー: ${err.message}`, true);
  }
});

function editCountry(c) {
  document.getElementById('edit-country-id').value  = c.id;
  document.getElementById('c-name').value           = c.name        || '';
  document.getElementById('c-flag').value           = c.flag        || '';
  document.getElementById('c-order').value          = c.order       ?? 100;
  document.getElementById('c-subtitle').value       = c.subtitle    || '';
  document.getElementById('c-description').value    = c.description || '';
  document.getElementById('country-form-title').textContent     = '国を編集';
  document.getElementById('btn-save-country').textContent       = '更新';
  document.getElementById('btn-cancel-country').style.display   = '';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function resetCountryForm() {
  document.getElementById('edit-country-id').value             = '';
  document.getElementById('c-name').value                      = '';
  document.getElementById('c-flag').value                      = '';
  document.getElementById('c-order').value                     = '100';
  document.getElementById('c-subtitle').value                  = '';
  document.getElementById('c-description').value               = '';
  document.getElementById('country-form-title').textContent    = '国を追加';
  document.getElementById('btn-save-country').textContent      = '保存';
  document.getElementById('btn-cancel-country').style.display  = 'none';
}

document.getElementById('btn-cancel-country').addEventListener('click', resetCountryForm);

// ─── トースト ─────────────────────────────────────────────
function showToast(msg, isError = false) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.className   = 'toast' + (isError ? ' error' : '');
  void toast.offsetWidth;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3000);
}

// 初期メディアリスト描画
renderMediaList();
