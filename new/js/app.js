// app.js — 閲覧側メインロジック

import { db, auth } from "./firebase-config.js";
import {
  collection, getDocs, getDoc, doc, query, where, orderBy
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

// ===== AUTH: ナビゲーションに管理画面リンクを表示 =====
onAuthStateChanged(auth, user => {
  const area = document.getElementById('auth-area');
  if (user) {
    area.innerHTML = `<a href="admin/" class="nav-btn">管理画面</a>`;
  } else {
    area.innerHTML = `<a href="admin/" class="nav-btn secondary">管理者ログイン</a>`;
  }
});

// ===== ROUTING =====
let currentCountryId = null;

window.goHome = function() {
  showPage('home');
  loadCountries();
};

window.goCountry = function(countryId) {
  currentCountryId = countryId;
  showPage('country');
  loadCountryPage(countryId);
};

window.goPost = function(postId) {
  showPage('post');
  loadPostPage(postId);
};

function showPage(name) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById('page-' + name).classList.add('active');
  window.scrollTo(0, 0);
}

// ===== HOME: 国一覧を読み込む =====
async function loadCountries() {
  const grid = document.getElementById('country-grid');
  grid.innerHTML = '<div class="loading-state">読み込み中...</div>';

  try {
    const countriesSnap = await getDocs(
      query(collection(db, 'countries'), orderBy('order', 'asc'))
    );
    const postsSnap = await getDocs(collection(db, 'posts'));

    // 国ごとの投稿数を集計
    const postCount = {};
    postsSnap.forEach(d => {
      const cid = d.data().countryId;
      postCount[cid] = (postCount[cid] || 0) + 1;
    });

    grid.innerHTML = '';
    if (countriesSnap.empty) {
      grid.innerHTML = '<div class="loading-state">まだ国が登録されていません</div>';
      return;
    }

    countriesSnap.forEach(docSnap => {
      const c = { id: docSnap.id, ...docSnap.data() };
      const count = postCount[c.id] || 0;
      const card = document.createElement('div');
      card.className = 'country-card';
      card.innerHTML = `
        <div class="country-flag">${c.flag}</div>
        <div class="country-name">${c.name}</div>
        <div class="country-count">${count} 投稿</div>
      `;
      card.onclick = () => goCountry(c.id);
      grid.appendChild(card);
    });
  } catch (e) {
    grid.innerHTML = '<div class="loading-state">読み込みに失敗しました</div>';
    console.error(e);
  }
}

// ===== COUNTRY PAGE: 投稿一覧 =====
async function loadCountryPage(countryId) {
  const container = document.getElementById('posts-list');
  container.innerHTML = '<div class="loading-state">読み込み中...</div>';

  try {
    // 国情報
    const countryDoc = await getDoc(doc(db, 'countries', countryId));
    const country = { id: countryId, ...countryDoc.data() };
    document.getElementById('country-page-title').textContent = `${country.flag} ${country.name}`;

    // 投稿一覧
    const postsSnap = await getDocs(
      query(
        collection(db, 'posts'),
        where('countryId', '==', countryId),
        orderBy('date', 'asc')
      )
    );

    container.innerHTML = '';
    if (postsSnap.empty) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">✈️</div>
          <div class="empty-state-text">まだ投稿がありません</div>
        </div>`;
      return;
    }

    // 日付でグループ化
    const groups = {};
    postsSnap.forEach(d => {
      const post = { id: d.id, ...d.data() };
      if (!groups[post.date]) groups[post.date] = [];
      groups[post.date].push(post);
    });

    Object.keys(groups).sort().forEach(date => {
      const dateGroup = document.createElement('div');
      dateGroup.className = 'date-group';

      const label = document.createElement('div');
      label.className = 'date-label';
      label.textContent = formatDate(date);
      dateGroup.appendChild(label);

      groups[date].forEach(post => {
        const firstMedia = post.media?.[0];
        let thumbHtml = '';
        if (firstMedia?.type === 'image') {
          thumbHtml = `<div class="post-thumb"><img src="${firstMedia.url}" alt="" onerror="this.parentElement.textContent='📷'"></div>`;
        } else if (firstMedia?.type === 'video') {
          thumbHtml = `<div class="post-thumb">🎬</div>`;
        } else {
          thumbHtml = `<div class="post-thumb">📝</div>`;
        }

        const item = document.createElement('div');
        item.className = 'post-item';
        item.innerHTML = `
          ${thumbHtml}
          <div class="post-info">
            <div class="post-title">${post.title}</div>
            <div class="post-meta">${(post.media || []).length} メディア${post.location ? ' · ' + post.location : ''}</div>
          </div>
          <div class="post-arrow">›</div>
        `;
        item.onclick = () => goPost(post.id);
        dateGroup.appendChild(item);
      });

      container.appendChild(dateGroup);
    });
  } catch (e) {
    container.innerHTML = '<div class="loading-state">読み込みに失敗しました</div>';
    console.error(e);
  }
}

// ===== POST DETAIL PAGE =====
async function loadPostPage(postId) {
  const feed = document.getElementById('media-feed');
  feed.innerHTML = '<div class="loading-state" style="padding:40px 20px;text-align:center">読み込み中...</div>';

  try {
    const postDoc = await getDoc(doc(db, 'posts', postId));
    const post = { id: postId, ...postDoc.data() };

    document.getElementById('post-page-title').textContent = post.title;
    document.getElementById('post-page-date').textContent =
      formatDate(post.date) + (post.location ? ' · ' + post.location : '');
    document.getElementById('back-to-country').onclick = () => goCountry(post.countryId);

    feed.innerHTML = '';

    if (!post.media || post.media.length === 0) {
      feed.innerHTML = `<div class="empty-state"><div class="empty-state-icon">📷</div><div class="empty-state-text">メディアがありません</div></div>`;
      return;
    }

    post.media.forEach((m, idx) => {
      const item = document.createElement('div');
      item.className = 'media-item';

      let mediaHtml = '';
      if (m.type === 'image') {
        mediaHtml = `<div class="media-wrapper"><img src="${m.url}" alt="${m.caption || ''}" loading="lazy"></div>`;
      } else {
        const vid = `vid-${postId}-${idx}`;
        mediaHtml = `
          <div class="media-wrapper">
            <video id="${vid}" src="${m.url}" playsinline webkit-playsinline muted preload="metadata"></video>
            <div class="video-overlay" id="ov-${vid}" onclick="toggleVideo('${vid}')">
              <div class="play-btn">
                <svg viewBox="0 0 24 24"><polygon points="5,3 19,12 5,21"/></svg>
              </div>
            </div>
          </div>`;
      }

      item.innerHTML = `
        ${mediaHtml}
        <div class="media-caption">
          <div class="caption-text">${m.caption || ''}</div>
          ${post.location ? `<div class="caption-location">📍 ${post.location}</div>` : ''}
        </div>
        <div class="media-actions">
          <button class="action-btn" onclick="toggleLike(this)"><span>♡</span> いいね</button>
          <button class="action-btn" onclick="copyLink()"><span>↗</span> シェア</button>
        </div>
      `;
      feed.appendChild(item);
    });

    setupVideoObserver();
  } catch (e) {
    feed.innerHTML = '<div class="loading-state">読み込みに失敗しました</div>';
    console.error(e);
  }
}

// ===== VIDEO =====
window.toggleVideo = function(vid) {
  const video = document.getElementById(vid);
  const overlay = document.getElementById('ov-' + vid);
  if (video.paused) {
    video.play();
    overlay.classList.add('hidden');
    video.onended = () => overlay.classList.remove('hidden');
  } else {
    video.pause();
    overlay.classList.remove('hidden');
  }
};

function setupVideoObserver() {
  if (!('IntersectionObserver' in window)) return;
  const obs = new IntersectionObserver(entries => {
    entries.forEach(e => {
      const v = e.target;
      if (e.isIntersecting && e.intersectionRatio >= 0.6) {
        v.play().then(() => {
          const ov = document.getElementById('ov-' + v.id);
          if (ov) ov.classList.add('hidden');
        }).catch(() => {});
      } else {
        v.pause();
      }
    });
  }, { threshold: 0.6 });

  document.querySelectorAll('#media-feed video').forEach(v => obs.observe(v));
}

// ===== UTILS =====
window.toggleLike = function(btn) {
  btn.classList.toggle('liked');
  btn.querySelector('span').textContent = btn.classList.contains('liked') ? '♥' : '♡';
};

window.copyLink = function() {
  navigator.clipboard.writeText(location.href).catch(() => {});
  showToast('リンクをコピーしました');
};

function formatDate(d) {
  const dt = new Date(d + 'T00:00:00');
  return `${dt.getFullYear()}年${dt.getMonth()+1}月${dt.getDate()}日`;
}

function showToast(msg, isError = false) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast' + (isError ? ' error' : '');
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2500);
}

// ===== INIT =====
loadCountries();
