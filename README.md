# is-a.net

**is-a.net** は、開発者が無料で `*.is-a.net` サブドメインを取得できるサービスです。(is-a.devのパクリ)

## 使い方

### 1. このリポジトリをフォーク

### 2. ドメイン定義ファイルを作成

`domains/` ディレクトリに `<your-subdomain>.json` を作成してください。

```json
{
  "owner": {
    "username": "<GitHub ユーザー名>",
    "email": "<メールアドレス>"
  },
  "records": {
    "CNAME": "your-site.github.io"
  }
}
```

### 3. Pull Request を送信

PR を作成すると、自動バリデーションが実行されます。問題がなければマージされ、DNS レコードが自動的に反映されます。

## 対応レコードタイプ

| タイプ | 値の形式 | 用途 |
|--------|----------|------|
| `A` | IPv4 アドレスの配列 | Web サーバーへの直接指定 |
| `AAAA` | IPv6 アドレスの配列 | IPv6 対応サーバーへの指定 |
| `CNAME` | ホスト名（文字列） | 別ドメインへのエイリアス |

## ドメイン定義ファイルの例

### GitHub Pages

```json
{
  "owner": {
    "username": "example-user",
    "email": "user@example.com"
  },
  "records": {
    "CNAME": "example-user.github.io"
  }
}
```

### カスタムサーバー (A レコード)

```json
{
  "owner": {
    "username": "example-user",
    "email": "user@example.com"
  },
  "records": {
    "A": ["1.2.3.4"]
  }
}
```

### IPv6 対応

```json
{
  "owner": {
    "username": "example-user",
    "email": "user@example.com"
  },
  "records": {
    "AAAA": ["2001:db8::1"]
  }
}
```

## ファイル名のルール

ファイル名 = サブドメイン名です。`domains/<subdomain>.json` の形式で作成してください。

### 有効なファイル名の例

| ファイル名 | サブドメイン |
|-----------|-------------|
| `my-site.json` | `my-site.is-a.net` |
| `project123.json` | `project123.is-a.net` |
| `cool-app.json` | `cool-app.is-a.net` |

### 無効なファイル名の例

| ファイル名 | 理由 |
|-----------|------|
| `My-Site.json` | 大文字を含んでいる → `my-site.json` に変更 |
| `my_site.json` | アンダースコアは使用不可 → `my-site.json` に変更 |
| `-mysite.json` | 先頭がハイフン |
| `mysite-.json` | 末尾がハイフン |
| `my--site.json` | 連続ハイフンは使用不可 |
| `my site.json` | スペースは使用不可 |
| `my.site.json` | サブサブドメインは未対応 |
| `12345.json` | 数字のみは不可 |
| `a.json` | 短すぎる（2文字以上必要） |
| `www.json` | システム予約済み |

## ルール

- **1ユーザー1サブドメイン** — GitHub アカウントにつき1つまで登録できます
- サブドメイン名は英小文字、数字、ハイフンのみ使用可能です（2〜63文字）
- 先頭・末尾のハイフン、連続ハイフンは使用できません
- 数字のみのサブドメイン名は使用できません
- `www`, `api`, `mail`, `admin` などシステム予約済みの名前は使用できません（[一覧](scripts/validate.js)）
- 1つの JSON ファイルにつき、レコードタイプは1種類のみ指定できます
- A/AAAA レコードは最大4つまで指定できます
- プライベート IP アドレス（`192.168.*`, `10.*` など）は指定できません
- `*.is-a.net` への CNAME（自己参照）は禁止です
- PR の送信者と `owner.username` は一致する必要があります
- 不適切な利用が確認された場合、サブドメインは削除されます

## ライセンス

MIT License
