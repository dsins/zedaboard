---
title: "OpenCode v2 Ortam Kurulumu"
summary: "zeda.dev üzerinde OpenCode v2, SSH, Caddy wildcard, güvenlik ve Board rapor altyapısının kurulumu."
date: "2026-10-26"
tags: ["opencode", "zeda", "board", "caddy"]
draft: false
---

## Özet

Bu oturumda `zeda.dev` makinesi, OpenCode v2 merkezli bir geliştirme ve
operasyon ortamına dönüştürüldü. Amaç hız: rutin işlerde onay sormadan ilerlemek,
ama prod/şirket/sır işlerinde freni korumak.

<div class="kpi-row">
  <div class="kpi kpi-accent">
    <span class="kpi-value">v2.1.4</span>
    <span class="kpi-label">OpenCode</span>
  </div>
  <div class="kpi kpi-green">
    <span class="kpi-value">1</span>
    <span class="kpi-label">Wildcard sertifika</span>
  </div>
  <div class="kpi kpi-blue">
    <span class="kpi-value">Canlı</span>
    <span class="kpi-label">Board</span>
  </div>
  <div class="kpi">
    <span class="kpi-value">0</span>
    <span class="kpi-label">Açık UI</span>
  </div>
</div>

<div class="callout callout-success">
  <span class="callout-title">Sonuç</span>
  <p>OpenCode global kuralları, izin kara listesi, SSH/git düzeni, wildcard TLS ve
  şifre korumalı Board yayını hazır. Tek eksik: <code>code.zeda.dev</code> için
  Cloudflare Access uygulamasının panelden oluşturulması.</p>
</div>

## Ne değişti?

<div class="table-wrap">

| Alan | Durum | Not |
| --- | --- | --- |
| OpenCode global kuralları | ✅ | `~/.config/opencode/AGENTS.md` |
| İzin modeli | ✅ | Tam otomatik + kara liste |
| Secret koruması | ✅ | `.env`, SSH anahtarı, token, DB |
| SSH config | ✅ | Alias + keepalive + `config.d/` |
| Git ayarları | ✅ | `main`, prune, autostash, rerere |
| CLI araçları | ✅ | `gh`, `sqlite3`, `fzf` |
| Caddy wildcard | ✅ | `*.zeda.dev`, DNS challenge |
| Board | ✅ | `board.zeda.dev` yayında |
| OpenCode UI | ⏳ | `code.zeda.dev` Access bekliyor |
| Backup | ⏳ | Sırası gelince |

</div>

## OpenCode v2

OpenCode `v2.1.4` arka plan servisi olarak çalışıyor. Varsayılan model
`deepseek/deepseek-flash`; `deepseek-v4-pro`, `gemini-4-argon` ve antigravity
Claude modelleri kullanılabilir.

### Global kurallar

`~/.config/opencode/AGENTS.md` artık her oturumda yükleniyor. İçinde:

- zeda.dev sistem özeti ve dizin düzeni
- prod/test ayrımı ve yıkıcı işlem öncesi onay kuralı
- git/commit/deploy alışkanlıkları
- Board kullanımı ve rapor kuralları
- model gizliliği notu

### İzin modeli

`cli.json` içinde `session.permissions: autoaccept` korundu. Yani rutin işlerde
onay sorulmuyor. Güvenlik için `opencode.json` içine **deny** listesi eklendi:

- `.env`, `.ssh`, `id_*`, `*.pem`, `*.key`
- antigravity hesap dosyası, OpenCode servis şifresi, oturum DB'si
- `opencode auth export`
- kök dizini silme, `mkfs`, disk yazma, kapatma/reboot

<div class="callout callout-warn">
  <span class="callout-title">Önemli</span>
  <p><code>--auto</code> modunda <code>ask</code> kuralları da otomatik geçilir.
  Bu yüzden gerçek fren yalnızca <code>deny</code> kurallarıdır. Prod/şirket
  işlerinde normal oturum açmak veya kara listeyi genişletmek gerekir.</p>
</div>

### Hız için hazır olanlar

<div class="tabs" data-tabs>
  <div class="tab-buttons">
    <button class="tab-btn" data-tab="cli" type="button">CLI</button>
    <button class="tab-btn" data-tab="skills" type="button">Skill / komut</button>
    <button class="tab-btn" data-tab="gorsel" type="button">Görsel</button>
  </div>
  <div class="tab-panel" data-panel="cli">
    <p><code>opencode</code> TUI, <code>opencode run</code> tek seferlik iş,
    <code>ai</code> alias'ı tam otomatik mod.</p>
    <pre><code class="hljs language-bash">opencode
opencode run "bu projede testleri çalıştır"
ai</code></pre>
  </div>
  <div class="tab-panel" data-panel="skills">
    <p><code>/board &lt;konu&gt;</code> rapor üretir. <code>/handoff</code> oturum
    özetini <code>~/notes/handoffs/</code> altına yazar. <code>board</code> skill'i
    rapor tasarım sistemini ve yayın akışını bilir.</p>
  </div>
  <div class="tab-panel" data-panel="gorsel">
    <p>Terminalde görsel engel değil: dosyayı diske kaydedip
    <code>@ekran.png</code> ile ekle. <code>read</code> aracı PNG/JPEG/GIF/WebP
    ve PDF'i modele gönderir. Web UI'daki sürükle-bırak kolaylık; zorunluluk
    değil.</p>
  </div>
</div>

### Claude Code geçişi

- `CLAUDE.md` otomatik okunmuyor; `instructions` ile köprü kuruldu.
- `.claude/skills` ve `~/.claude/skills` otomatik okunuyor.
- `.claude/commands` otomatik taşınmıyor; OpenCode komutları ayrı.
- Hook'lar plugin'e karşılık gelir.
- `/undo` dosya geri yüklemesi için projenin git reposu olması gerekir.

## Board

`https://board.zeda.dev` yayında. Dark mode, şifre korumalı, `noindex` ve
tamamen kendi altyapında.

### Erişim

```bash
cat /srv/board/data/initial-password.txt
```

Şifreyi değiştirmek için:

```bash
board passwd
```

Bu komut yeni rastgele bir şifre üretir, tüm oturumları kapatır ve şifreyi bir
kez ekrana yazar.

### Özellikler

<div class="table-wrap">

| Özellik | Davranış |
| --- | --- |
| Giriş | Tek şifre, cookie 30 gün |
| Ban | 3 hatalı deneme → IP 5 saat |
| Arama motoru | `noindex`, `robots.txt` kapalı |
| Tasarım | Ortak layout + CSS + Chart.js |
| Sayfa oluşturma | `board new` → Markdown → `board publish` |
| Silme | `board delete <slug> --yes` |
| Yedek | `data/` git dışı, `reports/` git içi |

</div>

### Mimari

```text
/srv/board
├── server.ts          # auth + ban + statik servis
├── build.ts           # Markdown -> HTML
├── cli.ts             # board komutları
├── lib/db.ts          # SQLite
├── templates/         # layout + iskelet
├── reports/<slug>/    # kaynak Markdown
├── public/assets/     # ortak CSS/JS/Chart.js
└── data/              # DB + ilk şifre (git dışı)
```

### Komutlar

```bash
board new <slug> --title "Başlık" --summary "Özet" --tags "a,b"
board publish <slug>
board list
board delete <slug> --yes
board passwd
```

### Tasarım sistemi

Raporlar `.kpi-row`, `.card`, `.callout`, `.table-wrap`, `.timeline`, `.steps`,
`.tabs`, `.filter-bar` ve `Board.chart()` bileşenlerini kullanır. Her rapor için
yeni bir görsel dil kurulmaz. Canlı referans: `/example`.

<div class="chart-box">
  <canvas id="chart-kurulum"></canvas>
</div>
<p class="chart-caption">Kurulum kapsamı — 26 Ekim 2026.</p>

<script>
document.addEventListener("DOMContentLoaded", function () {
  Board.chart("chart-kurulum", {
    type: "bar",
    data: {
      labels: ["OpenCode", "Güvenlik", "Caddy", "Board", "Access UI", "Backup"],
      datasets: [{
        label: "Tamamlanma",
        data: [100, 90, 100, 100, 35, 0],
        backgroundColor: ["#3ddc97", "#3ddc97", "#3ddc97", "#ff7a45", "#f7c948", "#626d7e"],
        borderRadius: 6,
        maxBarThickness: 36
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: {
          beginAtZero: true,
          max: 100,
          ticks: { callback: function (v) { return v + "%"; } },
          grid: { color: "rgba(255,255,255,.06)" }
        },
        x: { grid: { display: false } }
      }
    }
  });
});
</script>

## Caddy ve DNS

<div class="timeline">
  <div class="timeline-item">
    <span class="timeline-date">Önce</span>
    <h4>Sadece apex</h4>
    <p><code>zeda.dev</code> ve <code>www</code> vardı; alt alan adları TLS
    hatası veriyordu.</p>
  </div>
  <div class="timeline-item">
    <span class="timeline-date">Sonra</span>
    <h4>Wildcard</h4>
    <p><code>*.zeda.dev</code> tek sertifikayla çalışıyor. <code>test.zeda.dev</code>
    doğrulama için açık.</p>
  </div>
  <div class="timeline-item">
    <span class="timeline-date">Şimdi</span>
    <h4>Board</h4>
    <p><code>board.zeda.dev</code> → <code>127.0.0.1:4173</code>.</p>
  </div>
</div>

### code.zeda.dev

DNS kaydı Cloudflare proxy'sinde; Caddy tarafı **kasıtlı olarak kapalı**.
Şu an `code.zeda.dev` 404 döner, OpenCode'a açılmaz. Access uygulaması
oluşturulduktan sonra:

```bash
~/ops/enable-code-ui.sh
```

Betik Caddy'yi açar; origin'e doğrudan erişim Cloudflare IP listesiyle 403'e
düşer. Adımlar: `~/notes/runbooks/code-ui.md`.

## Güvenlik

<div class="grid grid-2">
  <div class="card">
    <h3 class="card-title">Yapılanlar</h3>
    <ul>
      <li>Caddy <code>.env</code> → <code>640 root:caddy</code></li>
      <li>rpcbind / port 111 kapatıldı</li>
      <li>Secret read/edit deny kuralları</li>
      <li>Board: noindex + HSTS + CSP</li>
      <li>code.zeda.dev: Cloudflare IP allowlist</li>
    </ul>
  </div>
  <div class="card">
    <h3 class="card-title">Bilinçli olarak yapılmayanlar</h3>
    <ul>
      <li>UFW / ek firewall katmanı</li>
      <li>Swap açma</li>
      <li>Backup altyapısı</li>
      <li>Gereksiz araç kurulumu</li>
    </ul>
  </div>
</div>

<div class="callout callout-danger">
  <span class="callout-title">Veri gizliliği</span>
  <p>Varsayılan model DeepSeek. Şirket kodu veya hassas bağlamda model seçimini
  bilinçli yap; gerekirse proje bazında <code>provider.use</code> politikasıyla
  DeepSeek'i kapat.</p>
</div>

## Doğrulama

<div class="table-wrap">

| Kontrol | Sonuç |
| --- | --- |
| `test.zeda.dev` | 200 — wildcard OK |
| `board.zeda.dev/login` | 200 |
| `board.zeda.dev/` (oturumsuz) | 303 → login |
| Yanlış şifre ×3 | 429 — 5 saat ban |
| `.env` okuma | `permission.rejected` |
| `code.zeda.dev` | 404 — Access öncesi kapalı |
| GitHub push | `dsins/zedaboard` güncel |

</div>

## Açık işler

<ol class="steps">
  <li><strong>Cloudflare Access:</strong> Zero Trust → Access → Applications →
  Self-hosted → <code>code.zeda.dev</code> → e-posta izni. Sonra
  <code>~/ops/enable-code-ui.sh</code>.</li>
  <li><strong>GitHub CLI:</strong> <code>gh auth login</code> — PR/issue akışı
  için.</li>
  <li><strong>Şirket SSH host'ları:</strong> <code>~/.ssh/config.d/*.conf</code>
  içine alias, kullanıcı ve gerekirse bastion.</li>
  <li><strong>Backup:</strong> sırası gelince restic + hedef depolama + restore
  testi.</li>
  <li><strong>Board şifresi:</strong> <code>board passwd</code> ile kendi
  şifreni belirle.</li>
</ol>

## Linkler

- Board: <https://board.zeda.dev/opencode-v2-ortam-kurulumu-2jk43k>
- GitHub: <https://github.com/dsins/zedaboard>
- OpenCode UI runbook: `~/notes/runbooks/code-ui.md`
- Global kurallar: `~/.config/opencode/AGENTS.md`

<div class="callout">
  <span class="callout-title">Not</span>
  <p>Board sayfaları yarı-özel kabul edilir. Şifre korumalı olsa da buraya sır,
  token veya müşteri verisi koymayın.</p>
</div>
