import { db, auth, CLOUDINARY_CONFIG } from '../js/firebase-config.js';
import {
  collection, getDocs, getDoc, addDoc, updateDoc, deleteDoc,
  doc, query, orderBy, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import {
  onAuthStateChanged, signInWithEmailAndPassword, signOut
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

// モジュールレベル状態管理
let countries = [];
let posts = [];
let mediaRows = [];
let editPostId = null;
let editCountryId = null;
let deletedMediaUrls = [];

// 認証フローの常時監視
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

// ログインハンドラ
async function loginHandler() {
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  const errorEl = document.getElementById('login-error');
  errorEl.textContent = '';
  
  try {
    await signInWithEmailAndPassword(auth, email, password);
  } catch (err) {
    errorEl.textContent = 'ログインに失敗しました。メールアドレスとパスワードを確認してください。';
  }
}

document.getElementById('btn-login').addEventListener('click', loginHandler);
document.getElementById('login-password').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') loginHandler();
});

// ログアウト
document.getElementById('btn-logout').addEventListener('click', async () => {
  await signOut(auth);
});

// データ一括ロード
async function loadAll() {
  await Promise.all([loadCountries(), loadPosts()]);
}

async function loadCountries() {
  countries = [];
  const q = query(collection(db, 'countries'), orderBy('order', 'asc'));
  const snap = await getDocs(q);
  snap.forEach(doc => countries.push({ id: doc.id, ...doc.data() }));
  populateCountrySelects();
}

async function loadPosts() {
  posts = [];
  const q = query(collection(db, 'posts'), orderBy('date', 'desc'));
  const snap = await getDocs(q);
  snap.forEach(doc => posts.push({ id: doc.id, ...doc.data() }));
}

// セレクトボックス同期
function populateCountrySelects() {
  const fCountry = document.getElementById('f-country');
  const listFilter = document.getElementById('list-country-filter');
  
  const currentFVal = fCountry.value;
  const currentLVal = listFilter.value;

  fCountry.innerHTML = '<option value="">— 選択してください —</option>';
  listFilter.innerHTML = '<option value="">すべての国</option>';

  countries.forEach(c => {
    const txt = c.flag ? `${c.flag} ${c.name}` : c.name;
    
    const opt1 = document.createElement('option');
    opt1.value = c.id;
    opt1.textContent = txt;
    fCountry.appendChild(opt1);

    const opt2 = document.createElement('option');
    opt2.value = c.id;
    opt2.textContent = txt;
    listFilter.appendChild(opt2);
  });

  fCountry.value = currentFVal;
  listFilter.value = currentLVal;
}

// タブ切り替え制御
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    switchTab(btn.dataset.tab);
  });
});

function switchTab(tabName) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  
  document.querySelector(`.tab-btn[data-tab="${tabName}"]`).classList.add('active');
  document.getElementById(`tab-${tabName}`).classList.add('active');

  if (tabName === 'post-list') renderPostList();
  if (tabName === 'country-mgmt') renderCountryList();
}

// メディアリストの描画
function renderMediaList() {
  const container = document.getElementById('media-list');
  container.innerHTML = '';

  mediaRows.forEach((m, idx) => {
    const row = document.createElement('div');
    row.className = 'media-row';

    // 削除 × ボタン
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

    // プレビュー表示
    const previewWrap = document.createElement('div');
    previewWrap.className = 'preview-wrap';
    if (m.url) {
      if (m.type === 'video') {
        const vid = document.createElement('video');
        vid.src = m.url;
        vid.preload = "metadata";
        previewWrap.appendChild(vid);
      } else {
        const img = document.createElement('img');
        img.src = m.url;
        previewWrap.appendChild(img);
      }
    } else {
      previewWrap.textContent = 'No media';
    }
    header.appendChild(previewWrap);

    // 各フィールド
    const fields = document.createElement('div');
    fields.className = 'media-row-fields';

    const inputUrl = document.createElement('input');
    inputUrl.className = 'm-url';
    inputUrl.type = 'url';
    inputUrl.value = m.url || '';
    inputUrl.placeholder = 'https://res.cloudinary.com/…';
    inputUrl.onchange = (e) => {
      mediaRows[idx].url = e.target.value;
      renderMediaList();
    };
    fields.appendChild(inputUrl);

    const selType = document.createElement('select');
    selType.className = 'm-type';
    selType.innerHTML = '<option value="image">📷 写真</option><option value="video">🎬 動画</option>';
    selType.value = m.type || 'image';
    selType.onchange = (e) => {
      mediaRows[idx].type = e.target.value;
    };
    fields.appendChild(selType);

    const txtCap = document.createElement('textarea');
    txtCap.className = 'm-caption';
    txtCap.rows = 3;
    txtCap.value = m.caption || '';
    txtCap.placeholder = 'このメディアのキャプション（任意）';
    txtCap.oninput = (e) => {
      mediaRows[idx].caption = e.target.value;
    };
    fields.appendChild(txtCap);
    header.appendChild(fields);
    row.appendChild(header);

    // コントロールパーツ
    const controls = document.createElement('div');
    controls.className = 'media-row-controls';

    const lblCover = document.createElement('label');
    lblCover.className = 'cover-checkbox-label';
    const chkCover = document.createElement('input');
    chkCover.type = 'checkbox';
    chkCover.className = 'm-cover';
    chkCover.onchange = async (e) => {
      if (e.target.checked && m.url) {
        const countryId = document.getElementById('f-country').value;
        if (!countryId) {
          showToast('先に国を選択してください', true);
          e.target.checked = false;
          return;
        }
        await updateDoc(doc(db, 'countries', countryId), { imgUrl: m.url });
        showToast('代表写真を設定しました');
      }
    };
    lblCover.appendChild(chkCover);
    lblCover.appendChild(document.createTextNode(' ★ 代表写真'));
    controls.appendChild(lblCover);

    const btnUpload = document.createElement('button');
    btnUpload.className = 'btn-upload';
    btnUpload.textContent = '☁️ Cloudinaryにアップロード';
    btnUpload.onclick = () => uploadMedia(idx);
    controls.appendChild(btnUpload);

    if (idx > 0) {
      const btnUp = document.createElement('button');
      btnUp.className = 'btn-move';
      btnUp.dataset.dir = 'up';
      btnUp.textContent = '↑';
      btnUp.onclick = () => {
        const temp = mediaRows[idx - 1];
        mediaRows[idx - 1] = mediaRows[idx];
        mediaRows[idx] = temp;
        renderMediaList();
      };
      controls.appendChild(btnUp);
    }

    if (idx < mediaRows.length - 1) {
      const btnDown = document.createElement('button');
      btnDown.className = 'btn-move';
      btnDown.dataset.dir = 'down';
      btnDown.textContent = '↓';
      btnDown.onclick = () => {
        const temp = mediaRows[idx + 1];
        mediaRows[idx + 1] = mediaRows[idx];
        mediaRows[idx] = temp;
        renderMediaList();
      };
      controls.appendChild(btnDown);
    }

    const progSpan = document.createElement('span');
    progSpan.className = 'upload-progress';
    progSpan.id = `upload-progress-${idx}`;
    controls.appendChild(progSpan);

    row.appendChild(controls);
    container.appendChild(row);

    // 行間挿入パーツ
    const insWrap = document.createElement('div');
    insWrap.className = 'insert-btn-wrap';
    const btnIns = document.createElement('button');
    btnIns.className = 'btn-insert';
    btnIns.textContent = '＋ ここに挿入';
    btnIns.onclick = () => {
      mediaRows.splice(idx + 1, 0, { url: '', type: 'image', caption: '' });
      renderMediaList();
    };
    insWrap.appendChild(btnIns);
    container.appendChild(insWrap);
  });
}

// 新規メディア追加
document.getElementById('btn-add-media').addEventListener('click', () => {
  mediaRows.push({ url: '', type: 'image', caption: '' });
  renderMediaList();
});

// Cloudinary アップロード処理
function uploadMedia(idx) {
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

    const resourceType = file.type.startsWith('video/') ? 'video' : 'image';
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', CLOUDINARY_CONFIG.uploadPreset);

    try {
      const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CONFIG.cloudName}/${resourceType}/upload`, {
        method: 'POST',
        body: formData
      });
      const data = await res.json();

      if (data.secure_url) {
        mediaRows[idx].url = data.secure_url;
        mediaRows[idx].type = resourceType;
        renderMediaList();
        
        const successProg = document.getElementById(`upload-progress-${idx}`);
        if (successProg) {
          successProg.textContent = '✓ アップロード完了';
          successProg.classList.add('success');
          setTimeout(() => { if (successProg) successProg.textContent = ''; }, 2000);
        }
      } else {
        prog.textContent = `エラー: ${data.error.message}`;
        prog.classList.add('error');
      }
    } catch (err) {
      prog.textContent = 'エラー: アップロードに失敗しました';
      prog.classList.add('error');
    }
  };
  input.click();
}

// 投稿保存
document.getElementById('btn-submit').addEventListener('click', async () => {
  const countryId = document.getElementById('f-country').value;
  const date = document.getElementById('f-date').value;
  const title = document.getElementById('f-title').value.trim();
  const location = document.getElementById('f-location').value.trim();
  const caption = document.getElementById('f-caption').value;

  if (!countryId) { showToast('国を選択してください', true); return; }
  if (!date) { showToast('日付を入力してください', true); return; }
  if (!title) { showToast('タイトルを入力してください', true); return; }

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
    if (location.startsWith('https://')) {
      await updateDoc(doc(db, 'countries', countryId), { docUrl: location });
    }

    if (editPostId === null) {
      postData.createdAt = serverTimestamp();
      await addDoc(collection(db, 'posts'), postData);
      showToast('投稿を保存しました');
    } else {
      await updateDoc(doc(db, 'posts', editPostId), postData);
      showToast('投稿を更新しました');
    }

    if (deletedMediaUrls.length > 0) {
      deleteFromCloudinary(deletedMediaUrls);
    }

    // キャッシュ更新要求のため、保存・更新が成功したらsessionStorageをクリアする
    sessionStorage.removeItem(`posts_${countryId}`);

    resetPostForm();
    await loadPosts();
  } catch (err) {
    showToast('データの保存に失敗しました', true);
  }
});

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

document.getElementById('btn-cancel-edit').addEventListener('click', resetPostForm);

// Cloudinary 物理削除（バックグラウンド実行）
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
      console.warn('Cloudinary削除エラー（無視）:', err);
    }
  }
}

// 投稿一覧表示
function renderPostList() {
  const filterVal = document.getElementById('list-country-filter').value;
  const container = document.getElementById('post-list-container');
  container.innerHTML = '';

  let filtered = filterVal ? posts.filter(p => p.countryId === filterVal) : [...posts];
  filtered.sort((a, b) => b.date.localeCompare(a.date));

  if (filtered.length === 0) {
    container.innerHTML = '<div class="loading">投稿がありません</div>';
    return;
  }

  filtered.forEach(post => {
    const item = document.createElement('div');
    item.className = 'post-list-item';

    const thumb = document.createElement('div');
    thumb.className = 'post-thumbnail';
    const firstImg = post.media?.find(m => m.type === 'image');
    if (firstImg) {
      const img = document.createElement('img');
      img.src = firstImg.url;
      thumb.appendChild(img);
    } else {
      thumb.textContent = '📷';
    }
    item.appendChild(thumb);

    const info = document.createElement('div');
    info.className = 'post-info';
    
    const tText = document.createElement('div');
    tText.className = 'post-title-text';
    tText.textContent = post.title;
    info.appendChild(tText);

    const cObj = countries.find(c => c.id === post.countryId);
    const cName = cObj ? cObj.name : '不明な国';
    const mCount = post.media ? post.media.length : 0;

    const mText = document.createElement('div');
    mText.className = 'post-meta-text';
    mText.textContent = `${cName} ／ ${post.date} ／ 📎 ${mCount}件`;
    info.appendChild(mText);
    item.appendChild(info);

    const actions = document.createElement('div');
    actions.className = 'post-actions';

    const btnEdit = document.createElement('button');
    btnEdit.className = 'btn-edit';
    btnEdit.textContent = '編集';
    btnEdit.onclick = () => {
      switchTab('new-post');
      editPostId = post.id;
      deletedMediaUrls = [];
      
      document.getElementById('f-country').value = post.countryId;
      document.getElementById('f-date').value = post.date;
      document.getElementById('f-title').value = post.title;
      document.getElementById('f-location').value = post.location || '';
      document.getElementById('f-caption').value = post.caption || '';

      mediaRows = post.media ? post.media.map(m => ({ ...m })) : [];
      renderMediaList();

      document.getElementById('form-title').textContent = '投稿を編集';
      document.getElementById('btn-submit').textContent = '更新する';
      document.getElementById('btn-cancel-edit').style.display = '';
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };
    actions.appendChild(btnEdit);

    const btnDel = document.createElement('button');
    btnDel.className = 'btn-danger';
    btnDel.textContent = '削除';
    btnDel.onclick = async () => {
      if (confirm('この投稿を削除しますか？')) {
        await deleteDoc(doc(db, 'posts', post.id));
        if (post.media && post.media.length > 0) {
          deleteFromCloudinary(post.media.map(m => m.url));
        }
        sessionStorage.removeItem(`posts_${post.countryId}`);
        showToast('投稿を削除しました');
        await loadPosts();
        renderPostList();
      }
    };
    actions.appendChild(btnDel);

    item.appendChild(actions);
    container.appendChild(item);
  });
}

document.getElementById('list-country-filter').addEventListener('change', renderPostList);

// 国管理リスト表示
function renderCountryList() {
  const container = document.getElementById('country-list-container');
  container.innerHTML = '';

  if (countries.length === 0) {
    container.innerHTML = '<div class="loading">国データがありません</div>';
    return;
  }

  // 投稿数カウント集計
  const postCounts = {};
  posts.forEach(p => {
    postCounts[p.countryId] = (postCounts[p.countryId] || 0) + 1;
  });

  countries.forEach(c => {
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

    const count = postCounts[c.id] || 0;
    const metaDiv = document.createElement('div');
    metaDiv.className = 'country-item-meta';
    metaDiv.textContent = `表示順: ${c.order} ／ 投稿: ${count}件`;
    info.appendChild(metaDiv);
    item.appendChild(info);

    const actions = document.createElement('div');
    actions.className = 'country-item-actions';

    const btnEdit = document.createElement('button');
    btnEdit.className = 'btn-edit';
    btnEdit.textContent = '編集';
    btnEdit.onclick = () => {
      editCountryId = c.id;
      document.getElementById('c-name').value = c.name;
      document.getElementById('c-flag').value = c.flag || '';
      document.getElementById('c-order').value = c.order ?? 100;
      document.getElementById('c-subtitle').value = c.subtitle || '';
      document.getElementById('c-description').value = c.description || '';

      document.getElementById('country-form-title').textContent = '国を編集';
      document.getElementById('btn-save-country').textContent = '更新';
      document.getElementById('btn-cancel-country').style.display = '';
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };
    actions.appendChild(btnEdit);

    const btnDel = document.createElement('button');
    btnDel.className = 'btn-danger';
    btnDel.textContent = '削除';
    if (count > 0) {
      btnDel.disabled = true;
      btnDel.title = '投稿がある国は削除できません';
    } else {
      btnDel.onclick = async () => {
        if (confirm(`「${c.name}」を削除しますか？`)) {
          await deleteDoc(doc(db, 'countries', c.id));
          sessionStorage.removeItem(`country_${c.id}`);
          showToast('国を削除しました');
          await loadCountries();
          renderCountryList();
        }
      };
    }
    actions.appendChild(btnDel);

    item.appendChild(actions);
    container.appendChild(item);
  });
}

// 国の追加・更新保存
document.getElementById('btn-save-country').addEventListener('click', async () => {
  const name = document.getElementById('c-name').value.trim();
  const flag = document.getElementById('c-flag').value.trim();
  const order = Number(document.getElementById('c-order').value) || 100;
  const subtitle = document.getElementById('c-subtitle').value.trim();
  const description = document.getElementById('c-description').value;

  if (!name) { showToast('国名を入力してください', true); return; }

  const data = { name, flag, order, subtitle, description };

  try {
    if (editCountryId === null) {
      await addDoc(collection(db, 'countries'), data);
      showToast('国を追加しました');
    } else {
      await updateDoc(doc(db, 'countries', editCountryId), data);
      sessionStorage.removeItem(`country_${editCountryId}`);
      showToast('国情報を更新しました');
    }
    resetCountryForm();
    await loadAll();
    renderCountryList();
  } catch (err) {
    showToast('国の保存に失敗しました', true);
  }
});

function resetCountryForm() {
  editCountryId = null;
  document.getElementById('c-name').value = '';
  document.getElementById('c-flag').value = '';
  document.getElementById('c-order').value = '100';
  document.getElementById('c-subtitle').value = '';
  document.getElementById('c-description').value = '';

  document.getElementById('country-form-title').textContent = '国を追加';
  document.getElementById('btn-save-country').textContent = '保存';
  document.getElementById('btn-cancel-country').style.display = 'none';
}

document.getElementById('btn-cancel-country').addEventListener('click', resetCountryForm);

// トースト通知実体
function showToast(msg, isError = false) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.className = 'toast' + (isError ? ' error' : '');
  void toast.offsetWidth; // 強制リフロー
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3000);
}