# is-a.net

**is-a.net** は、開発者のための無料サブドメインサービスです。
GitHub に PR を送るだけで `*.is-a.net` のサブドメインを取得できます。

> このサービスは Cloudflare Free プランを使用しています。
> DNS レコードが 200 件に近づくとプランアップを検討します。

## 使い方

1. このリポジトリをフォーク
2. `domains/` に `<your-subdomain>.json` を作成
3. Pull Request を送信

PR を作成すると自動バリデーションが実行されます。
問題がなければマージされ、DNS レコードが自動的に反映されます。

## ドメイン定義ファイル

`domains/<subdomain>.json` として以下の形式で作成してください。

```json
{
  "owner": {
    "username": "<GitHub ユーザー名>",
    "email": "<メールアドレス>"
  },
  "records": {
    "<レコードタイプ>": "<値>"
  },
  "proxied": false
}
```

### proxied フラグ

`proxied` フィールドで Cloudflare プロキシの有効/無効を制御します。

| 値 | 動作 |
|---|---|
| `true` | Cloudflare CDN / DDoS 保護 / SSL を有効化 |
| `false` | DNS のみ（プロキシなし） |
| 省略 | `false` と同じ |

A, AAAA, CNAME レコードのみで使用可能です。それ以外のレコードタイプで指定するとエラーになります。

## 対応レコードタイプ

| タイプ | 値の形式 | 用途 |
|--------|----------|------|
| `A` | IPv4 アドレスの配列（最大 4 つ） | Web サーバーへの直接指定 |
| `AAAA` | IPv6 アドレスの配列（最大 4 つ） | IPv6 対応サーバーへの指定 |
| `CNAME` | ホスト名（文字列） | 別ドメインへのエイリアス |
| `MX` | 文字列配列またはオブジェクト配列 `{target, priority}` | メール配送先の指定 |
| `TXT` | 文字列または文字列配列 | テキストレコード（SPF, DKIM 等） |
| `NS` | ホスト名の配列 | ネームサーバーの委任 |
| `CAA` | オブジェクト配列 `{tag, value}` | 認証局の制限（tag: `issue`, `issuewild`, `iodef`） |
| `DS` | オブジェクト配列 `{key_tag, algorithm, digest_type, digest}` | DNSSEC 署名（NS と併用必須） |
| `SRV` | オブジェクト配列 `{priority, weight, port, target}` | サービスの場所指定 |
| `TLSA` | オブジェクト配列 `{usage, selector, matching_type, certificate}` | DANE/TLS 認証 |
| `URL` | URL 文字列 | HTTP/HTTPS リダイレクト |

## 定義ファイルの例

### GitHub Pages（プロキシあり）

```json
{
  "owner": {
    "username": "example-user",
    "email": "user@example.com"
  },
  "records": {
    "CNAME": "example-user.github.io"
  },
  "proxied": true
}
```

### カスタムサーバー（プロキシなし）

```json
{
  "owner": {
    "username": "example-user",
    "email": "user@example.com"
  },
  "records": {
    "A": ["1.2.3.4"]
  },
  "proxied": false
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

### メール設定

MX レコードは文字列配列またはオブジェクト配列で指定できます。

```json
{
  "owner": {
    "username": "example-user",
    "email": "user@example.com"
  },
  "records": {
    "MX": [
      { "target": "mail.example.com", "priority": 10 },
      { "target": "mail2.example.com", "priority": 20 }
    ]
  }
}
```

文字列配列の場合（priority は自動設定）:

```json
{
  "records": {
    "MX": ["mail.example.com", "mail2.example.com"]
  }
}
```

### テキストレコード

```json
{
  "owner": {
    "username": "example-user",
    "email": "user@example.com"
  },
  "records": {
    "TXT": ["v=spf1 include:_spf.google.com ~all"]
  }
}
```

### ネームサーバー委任（NS + DS）

```json
{
  "owner": {
    "username": "example-user",
    "email": "user@example.com"
  },
  "records": {
    "NS": ["ns1.example.com", "ns2.example.com"],
    "DS": [
      {
        "key_tag": 12345,
        "algorithm": 8,
        "digest_type": 2,
        "digest": "abcdef1234567890"
      }
    ]
  }
}
```

### URL リダイレクト

> URL リダイレクトは Cloudflare Page Rules の手動設定が別途必要です。
> DNS レコード（プロキシ付き A レコード）は自動作成されますが、
> 実際のリダイレクト動作は管理者による Page Rule 設定後に有効になります。

```json
{
  "owner": {
    "username": "example-user",
    "email": "user@example.com"
  },
  "records": {
    "URL": "https://my-website.example.com"
  }
}
```

## ファイル名のルール

ファイル名がそのままサブドメイン名になります。

- 使用可能: 英小文字、数字、ハイフン（2〜63 文字）
- 先頭・末尾のハイフン不可
- 連続ハイフン不可
- 数字のみ不可

| ファイル名 | サブドメイン |
|---|---|
| `my-site.json` | `my-site.is-a.net` |
| `project123.json` | `project123.is-a.net` |
| `cool-app.json` | `cool-app.is-a.net` |

## レコードの組み合わせルール

| ルール | 説明 |
|---|---|
| CNAME は単独 | 他のレコードタイプと併用不可（RFC 1034） |
| NS + DS のみ | NS は DS 以外と併用不可。DS は NS と併用必須 |
| URL は制限あり | A / AAAA / CNAME と併用不可 |

## ルール

- 1 ユーザー 1 サブドメイン（GitHub アカウントにつき 1 つ）
- PR の送信者と `owner.username` が一致する必要あり
- A / AAAA レコードは最大 4 つまで
- プライベート IP アドレス（`10.*`, `172.16-31.*`, `192.168.*` 等）は指定不可
- `*.is-a.net` への CNAME（自己参照）は不可
- `www`, `api`, `mail`, `admin` 等のシステム予約名は使用不可（[一覧](scripts/validate.js)）
- 不適切な利用が確認された場合、サブドメインは削除されます

## ライセンス

MIT License
