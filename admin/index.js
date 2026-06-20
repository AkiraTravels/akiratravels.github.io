import { db, auth, CLOUDINARY_CONFIG } from '../js/firebase-config-admin.js';
import {
  collection, getDocs, getDoc, addDoc, updateDoc, deleteDoc,
  doc, query, orderBy, serverTimestamp, where
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import {
  onAuthStateChanged, signInWithEmailAndPassword, signOut
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

let countries = [];
let posts = [];
let mediaRows = [];
let editPostId = null;
let editCountryId = null;

// DOM Elements
const loginScreen = document.getElementById('login-screen');
const adminMain = document.getElementById('admin-main');
const headerUser = document.getElementById('header-user');
const headerEmail = document.getElementById('header-email');
const loginError = document.getElementById('login-error');

// Auth Monitoring
onAuthStateChanged(auth, async (user) => {
  if (user) {
    adminMain.style.display = 'block';
    loginScreen.style.display = 'none';
    headerUser.style.display = 'block';
    headerEmail.textContent = user.email;
    await loadAll();
  } else {
    adminMain.style.display = 'none';
    loginScreen.style.display = 'block';
    headerUser.style.display = 'none';
  }
});

// Login Handler
async function loginHandler() {
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  loginError.textContent = '';
  try {
    await signInWithEmailAndPassword(auth, email, password);
  } catch (err) {
    loginError.textContent = 'ログインに失敗しました。メールアドレスとパスワードを確認してください。';
  }
}
document.getElementById('btn-login').addEventListener('click', loginHandler);
document.getElementById('login-password').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') loginHandler();
});

// Logout Handler
document.getElementById('btn-logout').addEventListener('click', async () => {
  await signOut(auth);
  sessionStorage.clear();
});

// Load All Data
async function loadAll() {
  await Promise.all([loadCountries(), loadPosts()]);
}

async function loadCountries() {
  countries = [];
  const q = query(collection(db, 'countries'), orderBy('order', 'asc'));
  const snapshot = await getDocs(q);
  snapshot.forEach(d => {
    countries.push({ id: d.id, ...d.data() });
  });
  populateCountrySelects();
  renderCountryList();
}

async function loadPosts() {
  posts = [];
  const q = query(collection(db, 'posts'), orderBy('date', 'desc'));
  const snapshot = await getDocs(q);
  snapshot.forEach(d => {
    posts.push({ id: d.id, ...d.data() });
  });
  renderPostList();
}

function populateCountrySelects() {
  const fCountry = document.getElementById('f-country');
  const listFilter = document.getElementById('list-country-filter');
  
  const currentFVal = fCountry.value;
  const currentFilterVal = listFilter.value;

  fCountry.innerHTML = '<option value="">— 選択してください —</option>';
  listFilter.innerHTML = '<option value="">すべての国</option>';

  countries.forEach(c => {
    const text = c.flag ? `${c.flag} ${c.name}` : c.name;
    
    const opt1 = document.createElement('option');
    opt1.value = c.id;
    opt1.textContent = text;
    fCountry.appendChild(opt1);

    const opt2 = document.createElement('option');
    opt2.value = c.id;
    opt2.textContent = text;
    listFilter.appendChild(opt2);
  });

  fCountry.value = currentFVal;
  listFilter.value = currentFilterVal;
}

// Tab Switching
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const tab = btn.getAttribute('data-tab');
    switchTab(tab);
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

// Media Row Logic
document.getElementById('btn-add-media').addEventListener('click', () => {
  // Trigger file input or text inputs. For simplicity of unsigned upload, we can create a file input dynamically
  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = 'image/*,video/*';
  fileInput.onchange = async () => {
    if (fileInput.files.length === 0) return;
    showToast('メディアをアップロード中…');
    const url = await uploadToCloudinary(fileInput.files[0]);
    if (url) {
      const type = fileInput.files[0].type.startsWith('video') ? 'video' : 'image';
      mediaRows.push({ url, type, caption: '' });
      renderMediaList();
      showToast('アップロード完了');
    } else {
      showToast('アップロードに失敗しました');
    }
  };
  fileInput.click();
});

async function uploadToCloudinary(file) {
  const resourceType = file.type.startsWith('video') ? 'video' : 'image';
  const url = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CONFIG.cloudName}/${resourceType}/upload`;
  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', CLOUDINARY_CONFIG.uploadPreset);

  try {
    const res = await fetch(url, { method: 'POST', body: formData });
    const data = await res.json();
    return data.secure_url;
  } catch (err) {
    console.error(err);
    return null;
  }
}

function renderMediaList() {
  const container = document.getElementById('media-list');
  container.innerHTML = '';
  mediaRows.forEach((row, idx) => {
    const div = document.createElement('div');
    div.className = 'media-row';

    const btnRemove = document.createElement('button');
    btnRemove.className = 'btn-remove-media';
    btnRemove.textContent = '×';
    btnRemove.onclick = () => {
      mediaRows.splice(idx, 1);
      renderMediaList();
    };
    div.appendChild(btnRemove);

    const previewWrap = document.createElement('div');
    previewWrap.className = 'preview-wrap';
    if (row.type === 'video') {
      const vid = document.createElement('video');
      vid.src = row.url;
      vid.controls = true;
      previewWrap.appendChild(vid);
    } else {
      const img = document.createElement('img');
      img.src = row.url;
      previewWrap.appendChild(img);
    }
    div.appendChild(previewWrap);

    const capLabel = document.createElement('label');
    capLabel.textContent = '個別キャプション';
    div.appendChild(capLabel);

    const capInput = document.createElement('input');
    capInput.type = 'text';
    capInput.value = row.caption;
    capInput.onchange = (e) => { row.caption = e.target.value; };
    div.appendChild(capInput);

    container.appendChild(div);
  });
}

// Post Submission / Update
document.getElementById('btn-submit').addEventListener('click', async () => {
  const countryId = document.getElementById('f-country').value;
  const date = document.getElementById('f-date').value;
  const title = document.getElementById('f-title').value.trim();
  const locationStr = document.getElementById('f-location').value.trim();
  const caption = document.getElementById('f-caption').value;

  if (!countryId || !date || !title) {
    alert('国、日付、タイトルは必須です。');
    return;
  }

  const postData = {
    countryId,
    date,
    title,
    location: locationStr,
    caption,
    media: mediaRows,
    updatedAt: serverTimestamp()
  };

  try {
    if (editPostId) {
      await updateDoc(doc(db, 'posts', editPostId), postData);
      showToast('投稿を更新しました');
    } else {
      postData.createdAt = serverTimestamp();
      await addDoc(collection(db, 'posts'), postData);
      showToast('新規投稿を保存しました');
    }
    // Update cover photo if needed
    if (mediaRows.length > 0) {
      await updateDoc(doc(db, 'countries', countryId), { imgUrl: mediaRows[0].url });
    }
    clearPostForm();
    sessionStorage.clear();
    await loadAll();
    switchTab('post-list');
  } catch (err) {
    console.error(err);
    alert('保存に失敗しました。');
  }
});

function clearPostForm() {
  editPostId = null;
  document.getElementById('form-title').textContent = '新規投稿';
  document.getElementById('f-country').value = '';
  document.getElementById('f-date').value = '';
  document.getElementById('f-title').value = '';
  document.getElementById('f-location').value = '';
  document.getElementById('f-caption').value = '';
  mediaRows = [];
  renderMediaList();
  document.getElementById('btn-cancel-edit').style.display = 'none';
}

document.getElementById('btn-cancel-edit').addEventListener('click', clearPostForm);

// Post List Rendering & Filtering
document.getElementById('list-country-filter').addEventListener('change', renderPostList);

function renderPostList() {
  const container = document.getElementById('post-list-container');
  container.innerHTML = '';
  const filterId = document.getElementById('list-country-filter').value;

  const filteredPosts = filterId ? posts.filter(p => p.countryId === filterId) : posts;

  if (filteredPosts.length === 0) {
    container.textContent = '投稿がありません。';
    return;
  }

  filteredPosts.forEach(p => {
    const c = countries.find(item => item.id === p.countryId);
    const cName = c ? c.name : '不明な国';

    const div = document.createElement('div');
    div.className = 'post-list-item';

    const info = document.createElement('div');
    info.innerHTML = `<strong>[${cName}] ${p.title}</strong> <small>(${p.date})</small>`;
    div.appendChild(info);

    const actions = document.createElement('div');
    actions.className = 'item-actions';

    const btnEdit = document.createElement('button');
    btnEdit.textContent = '編集';
    btnEdit.onclick = () => {
      editPostId = p.id;
      document.getElementById('form-title').textContent = '投稿を編集';
      document.getElementById('f-country').value = p.countryId;
      document.getElementById('f-date').value = p.date;
      document.getElementById('f-title').value = p.title;
      document.getElementById('f-location').value = p.location || '';
      document.getElementById('f-caption').value = p.caption || '';
      mediaRows = JSON.parse(JSON.stringify(p.media || []));
      renderMediaList();
      document.getElementById('btn-cancel-edit').style.display = 'inline-block';
      switchTab('new-post');
    };
    actions.appendChild(btnEdit);

    const btnDel = document.createElement('button');
    btnDel.textContent = '削除';
    btnDel.style.background = '#ff4d4f';
    btnDel.style.color = 'white';
    btnDel.style.border = 'none';
    btnDel.onclick = async () => {
      if (confirm('この投稿を削除しますか？')) {
        await deleteDoc(doc(db, 'posts', p.id));
        showToast('投稿を削除しました');
        sessionStorage.clear();
        await loadAll();
      }
    };
    actions.appendChild(btnDel);

    div.appendChild(actions);
    container.appendChild(div);
  });
}

// Country Management Logic
document.getElementById('btn-save-country').addEventListener('click', async () => {
  const name = document.getElementById('c-name').value.trim();
  const flag = document.getElementById('c-flag').value.trim();
  const order = parseInt(document.getElementById('c-order').value) || 100;
  const subtitle = document.getElementById('c-subtitle').value.trim();
  const description = document.getElementById('c-description').value;

  if (!name) {
    alert('国名は必須です。');
    return;
  }

  const cData = { name, flag, order, subtitle, description };

  try {
    if (editCountryId) {
      await updateDoc(doc(db, 'countries', editCountryId), cData);
      showToast('国を更新しました');
    } else {
      await addDoc(collection(db, 'countries'), cData);
      showToast('国を追加しました');
    }
    clearCountryForm();
    sessionStorage.clear();
    await loadCountries();
  } catch (err) {
    console.error(err);
    alert('保存に失敗しました。');
  }
});

function clearCountryForm() {
  editCountryId = null;
  document.getElementById('country-form-title').textContent = '国を追加';
  document.getElementById('c-name').value = '';
  document.getElementById('c-flag').value = '';
  document.getElementById('c-order').value = '100';
  document.getElementById('c-subtitle').value = '';
  document.getElementById('c-description').value = '';
  document.getElementById('btn-cancel-country').style.display = 'none';
}

document.getElementById('btn-cancel-country').addEventListener('click', clearCountryForm);

function renderCountryList() {
  const container = document.getElementById('country-list-container');
  container.innerHTML = '';

  if (countries.length === 0) {
    container.textContent = '登録済みの国はありません。';
    return;
  }

  countries.forEach(c => {
    const div = document.createElement('div');
    div.className = 'country-list-item';

    const info = document.createElement('div');
    info.textContent = `${c.flag || ''} ${c.name} (表示順: ${c.order})`;
    div.appendChild(info);

    const actions = document.createElement('div');
    actions.className = 'item-actions';

    const btnEdit = document.createElement('button');
    btnEdit.textContent = '編集';
    btnEdit.onclick = () => {
      editCountryId = c.id;
      document.getElementById('country-form-title').textContent = '国を編集';
      document.getElementById('c-name').value = c.name;
      document.getElementById('c-flag').value = c.flag || '';
      document.getElementById('c-order').value = c.order;
      document.getElementById('c-subtitle').value = c.subtitle || '';
      document.getElementById('c-description').value = c.description || '';
      document.getElementById('btn-cancel-country').style.display = 'inline-block';
    };
    actions.appendChild(btnEdit);

    const btnDel = document.createElement('button');
    btnDel.textContent = '削除';
    btnDel.style.background = '#ff4d4f';
    btnDel.style.color = 'white';
    btnDel.style.border = 'none';
    btnDel.onclick = async () => {
      if (confirm('この国を削除しますか？紐づく投稿は自動削除されません。')) {
        await deleteDoc(doc(db, 'countries', c.id));
        showToast('国を削除しました');
        sessionStorage.clear();
        await loadCountries();
      }
    };
    actions.appendChild(btnDel);

    div.appendChild(actions);
    div.appendChild(actions);
    container.appendChild(div);
  });
}

function showToast(msg) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.style.display = 'block';
  setTimeout(() => { toast.style.display = 'none'; }, 3000);
}
