# Board — proje kuralları

## Stack
- Bun + `bun:sqlite`; Node/npm kullanma.
- Markdown: `marked` + `marked-highlight` + `highlight.js`.
- Grafik: yerel `chart.umd.js`; dış CDN yok.
- Üretim: `systemd` servisi `board`, Caddy reverse proxy.

## Komutlar
```bash
bun run build.ts
bun run server.ts
board new <slug> --title "..."
board publish <slug>
board list
board delete <slug> --yes
```

## Kurallar
- `data/` ve `.env` Git'e girmez; sır commit etme.
- Rapor kaynakları `reports/<slug>/report.md`; üretilen HTML `public/` (git dışı).
- Tasarım sistemi: `templates/layout.html` + `public/assets/board.css`.
  Yeni rapor için yeni CSS/JS sistemi kurma; mevcut sınıfları kullan.
- `server.ts` değişince `sudo systemctl restart board`.
- Caddy config'i bu repoda değil; `/etc/caddy/conf.d/`.
- Yeni sayfa yayınladıktan sonra `https://board.zeda.dev/<slug>` linkini ver.
- Sayfalar yarı-özel; sır, token, müşteri verisi koyma.
