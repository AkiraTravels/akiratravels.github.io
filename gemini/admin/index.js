import { db, auth, CLOUDINARY_CONFIG } from '../js/firebase-config.js';
import {
  collection, getDocs, getDoc, addDoc, updateDoc, deleteDoc,
  doc, query, orderBy, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import {
  onAuthStateChanged, signInWithEmailAndPassword, signOut
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

let countries = [];
let posts = [];
let mediaRows = [];
let editPostId = null;
let deletedMediaUrls = [];

// ユーザー状態監視
onAuthStateChanged(auth, (user) => {
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

// ログイン・ログアウト
document.getElementById('btn-login').addEventListener('click', loginHandler);
document.getElementById('login-password').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') loginHandler();
});
document.getElementById('btn-logout').addEventListener('click', () => signOut(auth));

async function loginHandler() {
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  const errEl = document.getElementById('login-error');
  errEl.textContent = '';
  try {
    await signInWithEmailAndPassword(auth, email, password);
  } catch (err) {
    errEl.textContent = 'ログインに失敗しました。認証情報を確認してください。';
  }
}

// データ一括ロード
async function loadAll() {
  await Promise.all([loadCountries(), loadPosts()]);
}

async function loadCountries() {
  const q = query(collection(db, 'countries'), orderBy('order', 'asc'));
  const snap = await getDocs(q);
  countries = [];
  snap.forEach(d => countries.push({ id: d.id, ...d.data() }));
  populateCountrySelects();
}

async function loadPosts() {
  const q = query(collection(db, 'posts'), orderBy('date', 'desc'));
  const snap = await getDocs(q);
  posts = [];
  snap.forEach(d => posts.push({ id: d.id, ...d.data() }));
}

function populateCountrySelects() {
  const fSelect = document.getElementById('f-country');
  const filterSelect = document.getElementById('list-country-filter');
  const fVal = fSelect.value;
  const filterVal = filterSelect.value;

  fSelect.innerHTML = '<option value="">— 選択してください —</option>';
  filterSelect.innerHTML = '<option value="">すべての国</option>';

  countries.forEach(c => {
    const text = c.flag ? `${c.flag} ${c.name}` : c.name;
    fSelect.innerHTML += `<option value="${c.id}">${text}</option>`;
    filterSelect.innerHTML += `<option value="${c.id}">${text}</option>`;
  });

  fSelect.value = fVal;
  filterSelect.value = filterVal;
}

// タブ制御
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', (e) => {
    switchTab(e.target.dataset.tab);
  });
});

function switchTab(tabName) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  
  document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
  document.getElementById(`tab-${tabName}`).classList.add('active');

  if (tabName === 'post-list') renderPostList();
  if (tabName === 'country-mgmt') renderCountryList();
}

// メディア管理
document.getElementById('btn-add-media').addEventListener('click', () => {
  mediaRows.push({ url: '', type: 'image', caption: '', isCover: false });
  renderMediaList();
});

function renderMediaList() {
  const container = document.getElementById('media-list');
  container.innerHTML = '';

  mediaRows.forEach((m, idx) => {
    const row = document.createElement('div');
    row.className = 'media-row';

    // 削除ボタン
    const btnRemove = document.createElement('button');
    btnRemove.className = 'btn-remove-media';
    btnRemove.textContent = '×';
    btnRemove.onclick = () => {
      if (m.url) deletedMediaUrls.push(m.url);
      mediaRows.splice(idx, 1);
      renderMediaList();
    };
    row.appendChild(btnRemove);

    const header = document.createElement('div');
    header.className = 'media-row-header';

    // プレビュー
    const preview = document.createElement('div');
    preview.className = 'preview-wrap';
    if (m.url) {
      if (m.type === 'video') {
        preview.innerHTML = `<video src="${m.url}" preload="metadata"></video>`;
      } else {
        preview.innerHTML = `<img src="${m.url}">`;
      }
    } else {
      preview.textContent = 'No media';
    }
    header.appendChild(preview);

    // フィールド
    const fields = document.createElement('div');
    fields.className = 'media-row-fields';

    const inputUrl = document.createElement('input');
    inputUrl.type = 'url';
    inputUrl.className = 'm-url';
    inputUrl.value = m.url;
    inputUrl.placeholder = 'https://res.cloudinary.com/...';
    inputUrl.onchange = (e) => {
      mediaRows[idx].url = e.target.value;
      renderMediaList();
    };

    const selectType = document.createElement('select');
    selectType.className = 'm-type';
    selectType.innerHTML = '<option value="image">📷 写真</option><option value="video">🎬 動画</option>';
    selectType.value = m.type;
    selectType.onchange = (e) => {
      mediaRows[idx].type = e.target.value;
      renderMediaList();
    };

    const textareaCap = document.createElement('textarea');
    textareaCap.className = 'm-caption';
    textareaCap.rows = 2;
    textareaCap.value = m.caption;
    textareaCap.placeholder = 'このメディアのキャプション（任意）';
    textareaCap.oninput = (e) => { mediaRows[idx].caption = e.target.value; };

    fields.appendChild(inputUrl);
    fields.appendChild(selectType);
    fields.appendChild(textareaCap);
    header.appendChild(fields);
    row.appendChild(header);

    // コントロール
    const controls = document.createElement('div');
    controls.className = 'media-row-controls';

    const labelCover = document.createElement('label');
    labelCover.className = 'cover-checkbox-label';
    const chkCover = document.createElement('input');
    chkCover.type = 'checkbox';
    chkCover.className = 'm-cover';
    // 新処理：保存用にインメモリ上でのみ排他選択。isCover項目の初期設定用参照は行わない
    chkCover.checked = !!m.isCover;
    chkCover.onchange = (e) => {
      mediaRows.forEach((r, i) => r.isCover = (i === idx && e.target.checked));
      renderMediaList();
    };
    labelCover.appendChild(chkCover);
    labelCover.appendChild(document.createTextNode(' ★ 代表写真に指定'));
    controls.appendChild(labelCover);

    const btnUpload = document.createElement('button');
    btnUpload.className = 'btn-upload';
    btnUpload.textContent = '☁️ アップロード';
    btnUpload.onclick = () => uploadMedia(idx);
    controls.appendChild(btnUpload);

    if (idx > 0) {
      const btnUp = document.createElement('button');
      btnUp.className = 'btn-move';
      btnUp.textContent = '↑';
      btnUp.onclick = () => {
        [mediaRows[idx - 1], mediaRows[idx]] = [mediaRows[idx], mediaRows[idx - 1]];
        renderMediaList();
      };
      controls.appendChild(btnUp);
    }
    if (idx < mediaRows.length - 1) {
      const btnDown = document.createElement('button');
      btnDown.className = 'btn-move';
      btnDown.textContent = '↓';
      btnDown.onclick = () => {
        [mediaRows[idx], mediaRows[idx + 1]] = [mediaRows[idx + 1], mediaRows[idx]];
        renderMediaList();
      };
      controls.appendChild(btnDown);
    }

    const progressSpan = document.createElement('span');
    progressSpan.className = 'upload-progress';
    progressSpan.id = `upload-progress-${idx}`;
    controls.appendChild(progressSpan);

    row.appendChild(controls);
    container.appendChild(row);

    // 挿入ボタン
    const insWrap = document.createElement('div');
    insWrap.className = 'insert-btn-wrap';
    const btnIns = document.createElement('button');
    btnIns.className = 'btn-insert';
    btnIns.textContent = '＋ ここに挿入';
    btnIns.onclick = () => {
      mediaRows.splice(idx + 1, 0, { url: '', type: 'image', caption: '', isCover: false });
      renderMediaList();
    };
    insWrap.appendChild(btnIns);
    container.appendChild(insWrap);
  });
}

async function uploadMedia(idx) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*,video/*';
  input.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const prog = document.getElementById(`upload-progress-${idx}`);
    prog.textContent = 'アップロード中…';
    prog.className = 'upload-progress';

    if (mediaRows[idx].url) deletedMediaUrls.push(mediaRows[idx].url);

    const isVideo = file.type.startsWith('video/');
    const resType = isVideo ? 'video' : 'image';

    const fd = new FormData();
    fd.append('file', file);
    fd.append('upload_preset', CLOUDINARY_CONFIG.uploadPreset);

    try {
      const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CONFIG.cloudName}/${resType}/upload`, {
        method: 'POST',
        body: fd
      });
      const data = await res.json();
      if (data.secure_url) {
        mediaRows[idx].url = data.secure_url;
        mediaRows[idx].type = resType;
        renderMediaList();
        const p = document.getElementById(`upload-progress-${idx}`);
        if (p) {
          p.textContent = '✓ 完了';
          p.className = 'upload-progress success';
          setTimeout(() => { if (p) p.textContent = ''; }, 2000);
        }
      } else {
        prog.textContent = `エラー: ${data.error?.message || '失敗'}`;
        prog.className = 'upload-progress error';
      }
    } catch (err) {
      prog.textContent = '通信エラーが発生しました。';
      prog.className = 'upload-progress error';
    }
  };
  input.click();
}

// 投稿保存
document.getElementById('btn-submit').addEventListener('click', submitPost);
document.getElementById('btn-cancel-edit').addEventListener('click', resetPostForm);

async function submitPost() {
  const countryId = document.getElementById('f-country').value;
  const date = document.getElementById('f-date').value;
  const title = document.getElementById('f-title').value.trim();
  const location = document.getElementById('f-location').value.trim();
  const caption = document.getElementById('f-caption').value;

  if (!countryId) return showToast('国を選択してください', true);
  if (!date) return showToast('日付を入力してください', true);
  if (!title) return showToast('タイトルを入力してください', true);

  // 代表写真の決定ロジック
  let chosenImgUrl = '';
  const selectedCover = mediaRows.find(m => m.isCover && m.type === 'image');
  if (selectedCover) {
    chosenImgUrl = selectedCover.url;
  } else {
    const firstImg = mediaRows.find(m => m.type === 'image');
    if (firstImg) chosenImgUrl = firstImg.url;
  }

  // 場所情報URLの検証
  let chosenDocUrl = '';
  if (location.startsWith('https://')) {
    chosenDocUrl = location;
  }

  // データ構造変更：postsからisCoverを廃止
  const postData = {
    countryId, date, title, location, caption,
    media: mediaRows.map(m => ({
      url: m.url || '',
      type: m.type || 'image',
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

    // 代表写真（imgUrl）または外部リンク（docUrl）を国ドキュメントへ書き込み更新
    const countryRef = doc(db, 'countries', countryId);
    const countryUpdateData = {};
    if (chosenImgUrl) countryUpdateData.imgUrl = chosenImgUrl;
    if (chosenDocUrl) countryUpdateData.docUrl = chosenDocUrl;
    
    if (Object.keys(countryUpdateData).length > 0) {
      await updateDoc(countryRef, countryUpdateData);
    }

    if (deletedMediaUrls.length > 0) {
      deleteFromCloudinary(deletedMediaUrls);
    }

    resetPostForm();
    await loadAll();
  } catch (err) {
    console.error(err);
    showToast('データの保存に失敗しました', true);
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

// Cloudinary削除
async function deleteFromCloudinary(urls) {
  for (const url of urls) {
    const match = url.match(/\/upload\/(?:v\d+\/)?(.+)\.[^.]+$/);
    if (!match) continue;
    const publicId = match[1];
    const resourceType = url.includes('/video/') ? 'video' : 'image';
    try {
      await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CONFIG.cloudName}/${resourceType}/destroy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ public_id: publicId })
      });
    } catch (err) {
      console.warn('Cloudinary削除エラー（スキップ）:', err);
    }
  }
}

// 投稿一覧表示
document.getElementById('list-country-filter').addEventListener('change', renderPostList);

function renderPostList() {
  const filterId = document.getElementById('list-country-filter').value;
  const container = document.getElementById('post-list-container');
  container.innerHTML = '';

  let filtered = posts;
  if (filterId) {
    filtered = posts.filter(p => p.countryId === filterId);
  }

  if (filtered.length === 0) {
    container.innerHTML = '<div class="loading">投稿がありません。</div>';
    return;
  }

  filtered.forEach(post => {
    const countryObj = countries.find(c => c.id === post.countryId);
    const countryName = countryObj ? countryObj.name : '不明な国';

    const item = document.createElement('div');
    item.className = 'post-list-item';

    const thumb = document.createElement('div');
    thumb.className = 'post-thumbnail';
    const firstImg = post.media?.find(m => m.type === 'image');
    if (firstImg) {
      thumb.innerHTML = `<img src="${firstImg.url}">`;
    } else {
      thumb.textContent = '📷';
    }

    const info = document.createElement('div');
    info.className = 'post-info';
    info.innerHTML = `
      <div class="post-title-text">${post.title}</div>
      <div class="post-meta-text">${countryName} ／ ${post.date} ／ 📎 ${post.media?.length || 0}件</div>
    `;

    const actions = document.createElement('div');
    actions.className = 'post-actions';

    const btnEdit = document.createElement('button');
    btnEdit.className = 'btn-edit';
    btnEdit.textContent = '編集';
    btnEdit.onclick = () => {
      editPostId = post.id;
      document.getElementById('f-country').value = post.countryId;
      document.getElementById('f-date').value = post.date;
      document.getElementById('f-title').value = post.title;
      document.getElementById('f-location').value = post.location || '';
      document.getElementById('f-caption').value = post.caption || '';
      
      // コピー展開
      mediaRows = (post.media || []).map(m => ({ ...m, isCover: false }));
      renderMediaList();

      document.getElementById('form-title').textContent = '投稿を編集';
      document.getElementById('btn-submit').textContent = '更新する';
      document.getElementById('btn-cancel-edit').style.display = '';
      switchTab('new-post');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const btnDel = document.createElement('button');
    btnDel.className = 'btn-danger';
    btnDel.textContent = '削除';
    btnDel.onclick = async () => {
      if (!confirm('この投稿を削除しますか？')) return;
      try {
        await deleteDoc(doc(db, 'posts', post.id));
        showToast('投稿を削除しました');
        if (post.media) {
          deleteFromCloudinary(post.media.map(m => m.url));
        }
        await loadPosts();
        renderPostList();
      } catch (err) {
        showToast('削除に失敗しました', true);
      }
    };

    actions.appendChild(btnEdit);
    actions.appendChild(btnDel);
    item.appendChild(thumb);
    item.appendChild(info);
    item.appendChild(actions);
    container.appendChild(item);
  });
}

// 国管理画面
document.getElementById('btn-save-country').addEventListener('click', saveCountry);
document.getElementById('btn-cancel-country').addEventListener('click', resetCountryForm);

function renderCountryList() {
  const container = document.getElementById('country-list-container');
  container.innerHTML = '';

  if (countries.length === 0) {
    container.innerHTML = '<div class="loading">国データがありません。</div>';
    return;
  }

  countries.forEach(c => {
    const count = posts.filter(p => p.countryId === c.id).length;

    const item = document.createElement('div');
    item.className = 'country-list-item';

    const flagCell = document.createElement('div');
    flagCell.className = 'country-flag-cell';
    flagCell.textContent = c.flag || '🌐';

    const info = document.createElement('div');
    info.className = 'country-item-info';
    info.innerHTML = `
      <div class="country-item-name">${c.name}</div>
      <div class="country-item-meta">表示順: ${c.order} ／ 投稿: ${count}件</div>
    `;

    const actions = document.createElement('div');
    actions.className = 'country-item-actions';

    const btnEdit = document.createElement('button');
    btnEdit.className = 'btn-edit';
    btnEdit.textContent = '編集';
    btnEdit.onclick = () => {
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
    };

    const btnDel = document.createElement('button');
    btnDel.className = 'btn-danger';
    btnDel.textContent = '削除';
    if (count > 0) {
      btnDel.disabled = true;
      btnDel.title = '投稿がある国は削除できません';
    }
    btnDel.onclick = async () => {
      if (!confirm(`国「${c.name}」を削除しますか？`)) return;
      try {
        await deleteDoc(doc(db, 'countries', c.id));
        showToast('国を削除しました');
        await loadCountries();
        renderCountryList();
      } catch (err) {
        showToast('削除に失敗しました', true);
      }
    };

    actions.appendChild(btnEdit);
    actions.appendChild(btnDel);
    item.appendChild(flagCell);
    item.appendChild(info);
    item.appendChild(actions);
    container.appendChild(item);
  });
}

async function saveCountry() {
  const id = document.getElementById('edit-country-id').value;
  const name = document.getElementById('c-name').value.trim();
  const flag = document.getElementById('c-flag').value.trim();
  const order = parseInt(document.getElementById('c-order').value, 10) || 100;
  const subtitle = document.getElementById('c-subtitle').value.trim();
  const description = document.getElementById('c-description').value;

  if (!name) return showToast('国名を入力してください', true);

  const data = { name, flag, order, subtitle, description };

  try {
    if (!id) {
      await addDoc(collection(db, 'countries'), data);
      showToast('国を追加しました');
    } else {
      await updateDoc(doc(db, 'countries', id), data);
      showToast('国を更新しました');
    }
    resetCountryForm();
    await loadCountries();
    renderCountryList();
  } catch (err) {
    showToast('国の保存に失敗しました', true);
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
  document.getElementById('btn-save-country').textContent = '保存';
  document.getElementById('btn-cancel-country').style.display = 'none';
}

// トースト共通
function showToast(msg, isError = false) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.className = 'toast' + (isError ? ' error' : '');
  void toast.offsetWidth;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3000);
}