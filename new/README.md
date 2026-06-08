# 旅の記録 — セットアップガイド

## 構成

```
Firebase Firestore  ← 国・投稿データの管理
Cloudinary          ← 写真・動画のストレージ・配信
GitHub Pages        ← Webサイトのホスティング（無料）
```

---

## 1. Firebase セットアップ

### 1-1. プロジェクト作成
1. https://console.firebase.google.com を開く
2. 「プロジェクトを追加」→ 任意の名前（例: `my-travel-blog`）
3. Google アナリティクスは任意

### 1-2. Firestore データベース作成
1. 左メニュー「Firestore Database」→「データベースの作成」
2. **本番環境モード**を選択（後でルールを設定する）
3. ロケーション: `asia-northeast1`（東京）推奨

### 1-3. セキュリティルールの設定
Firestore の「ルール」タブに以下を貼り付けて公開:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // 一般閲覧者: 読み取りのみ
    match /countries/{doc} {
      allow read: if true;
      allow write: if request.auth != null;
    }
    match /posts/{doc} {
      allow read: if true;
      allow write: if request.auth != null;
    }
  }
}
```

### 1-4. Authentication 設定
1. 左メニュー「Authentication」→「始める」
2. 「メール/パスワード」を有効化
3. 「ユーザー」タブ→「ユーザーを追加」で管理者アカウントを作成

### 1-5. アプリ登録・設定値取得
1. プロジェクト設定（歯車アイコン）→「マイアプリ」→「ウェブ」アイコン
2. アプリのニックネームを入力して登録
3. 表示された `firebaseConfig` の値をコピー

---

## 2. Cloudinary セットアップ

### 2-1. アカウント作成
https://cloudinary.com で無料アカウント作成

### 2-2. Upload Preset 作成（重要）
1. Settings → Upload → Upload presets → 「Add upload preset」
2. **Signing Mode: Unsigned** を選択
3. Folder: `travel` など任意のフォルダ名を設定（オプション）
4. 保存してプリセット名をメモ

### 2-3. Cloud Name の確認
Dashboard 画面上部に表示される `Cloud Name` をメモ

---

## 3. js/firebase-config.js の編集

```javascript
const firebaseConfig = {
  apiKey:            "ここにFirebaseのapiKey",
  authDomain:        "your-project.firebaseapp.com",
  projectId:         "your-project-id",
  storageBucket:     "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId:             "1:123456789:web:abcdef"
};

export const CLOUDINARY_CONFIG = {
  cloudName:    "your-cloud-name",    // Cloudinaryのクラウド名
  uploadPreset: "your-preset-name"    // 作成したUnsignedプリセット名
};
```

---

## 4. GitHub Pages 公開

### 4-1. リポジトリ作成
```bash
# GitHubで新しいリポジトリを作成（Public）
# 例: username/travel-blog

git init
git add .
git commit -m "初回コミット"
git branch -M main
git remote add origin https://github.com/USERNAME/REPO.git
git push -u origin main
```

### 4-2. GitHub Pages 有効化
1. リポジトリ → Settings → Pages
2. Source: `Deploy from a branch`
3. Branch: `main` / `/ (root)` → Save

### 4-3. 公開URL確認
数分後に `https://USERNAME.github.io/REPO/` でアクセス可能

---

## 5. 管理画面の使い方

`https://USERNAME.github.io/REPO/admin/` にアクセス

1. **国の追加**: 「国管理」タブ → 国名・国旗絵文字を入力して保存
2. **投稿作成**: 「新規投稿」タブ
   - 国・タイトル・日付を入力
   - 「☁️ Cloudinaryにアップロード」ボタンで写真・動画を直接アップロード
   - またはCloudinaryで取得したURLを貼り付け
   - 各メディアにキャプションを入力
3. **投稿管理**: 「投稿一覧」タブで編集・削除

---

## Cloudinary 無料枠

| 項目 | 無料枠 |
|------|--------|
| ストレージ | 25 GB |
| 月間転送量 | 25 GB |
| 動画 1ファイル | 最大 100 MB |
| 画像 | 無制限（容量内） |

---

## ファイル構成

```
travel-blog/
├── index.html          # メインページ（閲覧）
├── 404.html            # GitHub Pages用リダイレクト
├── admin/
│   └── index.html      # 管理画面
├── css/
│   ├── style.css       # 共通スタイル
│   └── admin.css       # 管理画面スタイル
└── js/
    ├── firebase-config.js  # ★ 設定ファイル（要編集）
    ├── app.js              # 閲覧側ロジック
    └── admin.js            # 管理画面ロジック
```
