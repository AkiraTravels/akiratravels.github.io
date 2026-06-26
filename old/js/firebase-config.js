// ============================================================
// firebase-config.js
// FirebaseとCloudinaryの設定をここに入力してください
// ============================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// -------------------------------------------------------
// 1. Firebaseの設定
//    Firebase Console > プロジェクト設定 > マイアプリ
//    から取得した値を貼り付けてください
// -------------------------------------------------------
const firebaseConfig = {
  apiKey:            "AIzaSyCZpY0Wa99YfM1BZlZvlBa5FpQ2FuaRBp0",
  authDomain:        "akira-travels.firebaseapp.com",
  projectId:         "akira-travels",
  storageBucket:     "akira-travels.firebasestorage.app",
  messagingSenderId: "343465435050",
  appId:             "1:343465435050:web:b34150eded57a90a8a15d3"
};

// -------------------------------------------------------
// 2. Cloudinaryの設定
//    Cloudinary Console > Dashboard から取得
// -------------------------------------------------------
export const CLOUDINARY_CONFIG = {
  cloudName:    "dc1l1pjid",   // 例: "my-travel-blog"
  uploadPreset: "AKIRA travels" // Unsigned upload preset名
  // ※ Settings > Upload > Upload presets で
  //   "Unsigned" のプリセットを作成してください
};

// -------------------------------------------------------
// Firebase初期化（変更不要）
// -------------------------------------------------------
const app = initializeApp(firebaseConfig);
export const db  = getFirestore(app);
