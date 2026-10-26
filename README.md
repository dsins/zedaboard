# Board

`board.zeda.dev` için kişisel, şifre korumalı rapor ve analiz yayın sunucusu.

## Stack

- **Bun** runtime
- **SQLite** (`bun:sqlite`) — oturumlar, giriş denemeleri, ayarlar
- **marked** + **highlight.js** — Markdown → HTML
- **Chart.js** — grafikler
- **Caddy** — TLS + reverse proxy
- **systemd** — servis yönetimi

## Yapı

```text
/srv/board
├── server.ts            # HTTP sunucusu, auth, ban, statik servis
├── build.ts             # Markdown -> HTML üretimi
├── cli.ts               # board new/build/publish/list/delete/passwd
├── lib/db.ts            # SQLite şeması ve ayarlar
├── templates/           # layout + rapor iskeleti
├── reports/<slug>/      # rapor kaynakları (Markdown)
├── public/assets/       # ortak CSS/JS/Chart.js
├── public/<slug>/       # üretilen HTML (git dışı)
└── data/                # SQLite + ilk şifre (git dışı)
```

## Kullanım

```bash
board new <slug> --title "Başlık" --summary "Özet" --tags "a,b"
# reports/<slug>/report.md dosyasını düzenle
board publish <slug>
# https://board.zeda.dev/<slug>
```

Diğer komutlar:

```bash
board list
board delete <slug> --yes
board passwd                 # yeni rastgele şifre üretir
board passwd --password "..." # açık şifre (dikkatli kullan)
```

## Güvenlik

- Tüm sayfalar `noindex, nofollow` ve şifre korumalı.
- 3 hatalı girişte IP 5 saat banlanır.
- Oturum cookie'si `HttpOnly`, `Secure`, `SameSite=Lax`, 30 gün.
- `data/` ve `.env` dosyaları Git'e girmez.
- Raporlara sır/API anahtarı koymayın; sayfalar yarı-özel kabul edilir.

## Geliştirme

```bash
bun install
bun run build.ts
bun run server.ts
```

Servis:

```bash
sudo systemctl status board
sudo journalctl -u board -f
```

## Tasarım

Tüm raporlar `templates/layout.html` ve `public/assets/board.css` ortak tasarım
sistemini kullanır. Yeni bir rapor oluştururken görsel sistemi sıfırdan kurmayın;
mevcut sınıfları kullanın:

- `.kpi-row`, `.kpi`, `.kpi-value`
- `.card`, `.grid grid-2|grid-3|grid-4`
- `.callout`, `.callout-warn`, `.callout-danger`, `.callout-success`
- `.timeline`, `.steps`
- `.tabs`, `.filter-bar`
- `.table-wrap`
- `.chart-box` + `Board.chart(id, config)`

Örnek rapor: `reports/example/report.md`.
