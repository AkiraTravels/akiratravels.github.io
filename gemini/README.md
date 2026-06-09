# AKIRA travels — ソースコードパッケージ

仕様書に準拠したフロントエンドおよび管理システムの完全版ソースコード一式です。

## ディレクトリ構成
```
travel-blog/
├── index.html              # トップページ（国一覧）
├── country.html            # 国別ページ（投稿チェーン＋詳細モーダル）
├── 404.html                # GitHub Pages用リダイレクト
├── README.md               # 本ドキュメント
├── js/
│   └── firebase-config.js  # Firebase / Cloudinary 接続設定
├── css/
│   └── style.css           # 共通・フロントエンド用スタイル
└── admin/
    ├── index.html          # 管理画面HTML
    ├── index.js            # 管理画面ロジック
    └── css/
        └── admin.css       # 管理画面用デザイン
```

## 初期セットアップ手順

1. **設定の書き換え**: `js/firebase-config.js` を開き、各自の Firebase プロジェクトの構成情報、およひ Cloudinary の `cloudName`, `uploadPreset` (Unsigned) を指定してください。
2. **データベースルールの適用**: Firebase Firestore 側で適切なセキュリティルールを定義してください。
3. **ホスティング**: リポジトリのルートを GitHub Pages 等に設定して公開します。
