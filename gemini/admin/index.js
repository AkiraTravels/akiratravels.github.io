import { collection, addDoc, getDocs, orderBy, query, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { db, auth, CLOUDINARY_CONFIG } from "../js/firebase-config.js";

// 定数定義：動画の代わりに登録するブランクのダミー画像URL
const DUMMY_IMAGE_URL = "https://placehold.co/600x400?text=Video+Post";

// グローバル状態管理
const localMediaMap = new Map();
let countriesCache = []; 
let parsedPosts = [];    

// 1. 認証チェック & 初期化
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "./login.html";
    return;
  }
  await loadCountriesMaster();
  initTabSystem();
});

// ログアウト
document.getElementById('btn-logout').addEventListener('click', () => {
  signOut(auth).then(() => window.location.href = "./login.html");
});

// タブ制御
function initTabSystem() {
  const tabs = document.querySelectorAll('.tab-btn');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      
      tab.classList.add('active');
      document.getElementById(tab.dataset.tab).classList.add('active');
    });
  });
}

// 国一覧の読み込み
async function loadCountriesMaster() {
  countriesCache = [];
  const snap = await getDocs(query(collection(db, 'countries'), orderBy('order', 'asc')));
  snap.forEach(doc => {
    countriesCache.push({ id: doc.id, ...doc.data() });
  });
}

// ==========================================
// Facebook インポート処理ロジック
// ==========================================

// STEP 1: メディアフォルダのインデックス化
document.getElementById('import-media-dir').addEventListener('change', (e) => {
  localMediaMap.clear();
  for (const file of e.target.files) {
    localMediaMap.set(file.name, file);
  }
  document.getElementById('media-count-status').textContent = `（画像ファイル ${localMediaMap.size} 件を認識）`;
  pushLog(`画像ファイルを ${localMediaMap.size} 件ロードしました。`);
});

// STEP 2: JSON読み込みおよび解析
document.getElementById('import-json-file').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(event) {
    try {
      const rawData = JSON.parse(event.target.result);
      if (!Array.isArray(rawData)) {
        alert("タイムライン投稿のJSON（配列形式）を選択してください。アルバムのJSONはスキップ対象です。");
        return;
      }
      parseAndRenderPreview(rawData);
    } catch (err) {
      alert("JSONのパースに失敗しました: " + err.message);
    }
  };
  reader.readAsText(file);
});

// プレビュー表示データの生成
function parseAndRenderPreview(items) {
  const container = document.getElementById('import-preview-area');
  container.innerHTML = "";
  parsedPosts = [];

  pushLog(`JSONからデータの抽出を開始...`);

  items.forEach((item, index) => {
    if (!item.attachments && !item.data) return;

    // 投稿日付（timestamp）の採用
    const dateStr = new Date(item.timestamp * 1000).toISOString().split('T')[0];
    
    let caption = "";
    const extractedMedia = [];

    if (item.attachments) {
      item.attachments.forEach(attach => {
        if (!attach.data) continue;
        attach.data.forEach(node => {
          if (node.media) {
            // 本文テキスト（caption）をdescriptionから抽出
            if (node.media.description && !caption) {
              caption = node.media.description; 
            }
            const fileName = node.media.uri.split('/').pop();
            // パスまたは拡張子から画像か動画かを判定
            const isVideo = node.media.uri.includes('videos/') || fileName.toLowerCase().endsWith('.mp4');

            extractedMedia.push({
              fileName: fileName,
              caption: node.media.description || "",
              type: isVideo ? 'video' : 'image'
            });
          }
        });
      });
    }

    const postObj = {
      id: `fb-${index}-${item.timestamp}`,
      date: dateStr,
      title: item.title || `${dateStr} の投稿`,
      caption: caption,
      rawMedia: extractedMedia
    };

    parsedPosts.push(postObj);

    // プレビューカード生成
    const card = document.createElement('div');
    card.className = 'preview-card';
    card.id = `card-${postObj.id}`;

    let countryOptions = `<option value="">-- 国を選択 --</option>`;
    countriesCache.forEach(c => {
      countryOptions += `<option value="${c.id}">${c.flag || ''} ${c.name}</option>`;
    });

    card.innerHTML = `
      <div class="preview-header">
        <strong>${postObj.date} - ${postObj.title}</strong>
        <div>
          <select id="select-country-${postObj.id}" style="padding:5px;">${countryOptions}</select>
          <button class="btn-single-import" data-id="${postObj.id}" style="padding:5px 10px; background:#c4873a; color:#fff; border:none; cursor:pointer; margin-left:5px;">登録</button>
        </div>
      </div>
      <p style="font-size:13px; margin:5px 0; color:#333;">${postObj.caption || '<span style="color:#999;">(本文なし)</span>'}</p>
      <div class="preview-media-list" id="media-list-${postObj.id}"></div>
    `;

    container.appendChild(card);

    // 各メディアのステータス表示
    const mediaListDiv = document.getElementById(`media-list-${postObj.id}`);
    postObj.rawMedia.forEach(m => {
      const span = document.createElement('span');
      span.style.fontSize = '11px';
      span.style.padding = '2px 6px';
      span.style.borderRadius = '3px';
      
      if (m.type === 'video') {
        span.style.background = '#fff2cc';
        span.style.color = '#d66011';
        span.textContent = `📹 動画: ${m.fileName} (インポート時にダミー画像に置換されます)`;
      } else {
        const hasFile = localMediaMap.has(m.fileName);
        span.style.background = hasFile ? '#e2f0d9' : '#fce4d6';
        span.style.color = hasFile ? '#385723' : '#c65911';
        span.textContent = `📷 画像: ${m.fileName} (${hasFile ? 'ローカル有' : 'ファイルが見つかりません'})`;
      }
      mediaListDiv.appendChild(span);
    });
  });

  pushLog(`プレビューに ${parsedPosts.length} 件の投稿を展開しました。国を選択して登録を行ってください。`);

  // インポートボタンのイベントハンドラ登録
  document.querySelectorAll('.btn-single-import').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      await executeSingleImport(e.target.dataset.id);
    });
  });
}

// 1件のインポート処理を実行
async function executeSingleImport(id) {
  const targetPost = parsedPosts.find(p => p.id === id);
  if (!targetPost) return;

  const countrySelect = document.getElementById(`select-country-${id}`);
  const countryId = countrySelect.value;

  if (!countryId) {
    alert("この投稿を紐付ける国を選択してください。");
    return;
  }

  const card = document.getElementById(`card-${id}`);
  const btn = card.querySelector('.btn-single-import');
  
  // UIの無効化
  btn.disabled = true;
  btn.textContent = "処理中...";
  countrySelect.disabled = true;

  pushLog(`[処理開始] ${targetPost.date} の投稿を処理中...`);

  try {
    const finalMediaArray = [];

    for (const m of targetPost.rawMedia) {
      if (m.type === 'video') {
        // 動画の場合はアップロードせずダミー画像を割り当て、キャプションを保持
        pushLog(`  -> 動画要素をダミー画像に置換中: ${m.fileName}`);
        finalMediaArray.push({
          url: DUMMY_IMAGE_URL,
          type: "image", // システム仕様上画像として扱う
          caption: m.caption,
          isCover: finalMediaArray.length === 0
        });
      } else {
        // 画像の場合はローカルファイルを照合してCloudinaryへ
        const fileObj = localMediaMap.get(m.fileName);
        if (fileObj) {
          pushLog(`  -> 画像をCloudinaryへアップロード中: ${m.fileName}`);
          const uploadedUrl = await uploadToCloudinary(fileObj);
          
          finalMediaArray.push({
            url: uploadedUrl,
            type: "image",
            caption: m.caption,
            isCover: finalMediaArray.length === 0
          });
        } else {
          pushLog(`  -> [警告] 物理画像ファイルが見つからないためスキップ: ${m.fileName}`, true);
        }
      }
    }

    // Firestoreへのドキュメント作成
    const newFirestorePost = {
      countryId: countryId,
      title: targetPost.title,
      date: targetPost.date, 
      location: "", 
      caption: targetPost.caption,
      media: finalMediaArray,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    await addDoc(collection(db, 'posts'), newFirestorePost);
    
    // 登録成功時のUI表示変更
    pushLog(`[完了] Firestoreへ登録しました: ${targetPost.date}`);
    card.style.background = "#f0f7f0";
    card.style.opacity = "0.7";
    btn.textContent = "登録済み";
    btn.style.background = "#7f7f7f";

  } catch (err) {
    pushLog(`[エラー] インポート失敗: ${err.message}`, true);
    btn.disabled = false;
    btn.textContent = "再試行";
    countrySelect.disabled = false;
  }
}

// Cloudinary 署名なしアップロード
async function uploadToCloudinary(file) {
  const url = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CONFIG.cloudName}/image/upload`;
  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', CLOUDINARY_CONFIG.uploadPreset);

  const res = await fetch(url, { method: 'POST', body: formData });
  if (!res.ok) throw new Error(`Cloudinary API エラー: ${res.statusText}`);
  const data = await res.json();
  return data.secure_url;
}

// ログ出力用ユーティリティ
function pushLog(msg, isError = false) {
  const logDiv = document.getElementById('import-log');
  const line = document.createElement('div');
  line.style.color = isError ? '#ff4d4d' : '#00ff00';
  line.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
  logDiv.appendChild(line);
  logDiv.scrollTop = logDiv.scrollHeight;
}
