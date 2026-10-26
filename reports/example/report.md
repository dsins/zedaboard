---
title: "Board Tasarım Sistemi"
summary: "Board raporlarının ortak bileşenleri, chart kullanımı ve yayın akışı için canlı referans."
date: "2026-10-26"
tags: ["board", "tasarım", "referans"]
draft: false
---

## Özet

Bu sayfa Board'un ortak tasarım sistemini gösterir. Yeni raporlar bu bileşenleri
kullanır; her rapor için ayrı bir görsel dil kurulmaz.

<div class="kpi-row">
  <div class="kpi kpi-accent">
    <span class="kpi-value">1</span>
    <span class="kpi-label">Tasarım sistemi</span>
  </div>
  <div class="kpi kpi-green">
    <span class="kpi-value">30 gün</span>
    <span class="kpi-label">Oturum</span>
  </div>
  <div class="kpi kpi-blue">
    <span class="kpi-value">3 / 5s</span>
    <span class="kpi-label">Hatalı giriş / ban</span>
  </div>
  <div class="kpi">
    <span class="kpi-value">noindex</span>
    <span class="kpi-label">Arama motoru</span>
  </div>
</div>

## Bileşenler

<div class="grid grid-3">
  <div class="card">
    <h3 class="card-title">Kart</h3>
    <p>Kısa bilgi kutuları. Grid ile 2, 3 veya 4 kolon.</p>
  </div>
  <div class="card">
    <h3 class="card-title">Callout</h3>
    <p>Uyarı, risk ve sonuç blokları için renkli varyantlar.</p>
  </div>
  <div class="card">
    <h3 class="card-title">Chart</h3>
    <p>Chart.js yerel yüklenir; dış CDN yok.</p>
  </div>
</div>

<div class="callout callout-success">
  <span class="callout-title">Sonuç</span>
  <p>Board, tek bir layout ve tek bir CSS dosyası üzerinden tutarlı sayfalar üretir.</p>
</div>

## Tablo

<div class="table-wrap">

| Bileşen | Sınıf | Kullanım |
| --- | --- | --- |
| KPI | `.kpi-row` / `.kpi` | Sayısal özet |
| Kart | `.card` | Bağımsız bilgi |
| Callout | `.callout-*` | Uyarı / sonuç |
| Tablo | `.table-wrap` | Geniş veri |
| Chart | `.chart-box` | Grafik |

</div>

## Grafik

<div class="chart-box">
  <canvas id="chart-ornek"></canvas>
</div>
<p class="chart-caption">Örnek veri — Chart.js karanlık tema varsayılanları.</p>

<script>
document.addEventListener("DOMContentLoaded", function () {
  Board.chart("chart-ornek", {
    type: "bar",
    data: {
      labels: ["Kurulum", "Güvenlik", "UI", "Board", "Rapor"],
      datasets: [{
        label: "Tamamlanan",
        data: [100, 80, 70, 95, 60],
        backgroundColor: "#ff7a45",
        borderRadius: 6,
        maxBarThickness: 38
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

## Sekmeler

<div class="tabs" data-tabs>
  <div class="tab-buttons">
    <button class="tab-btn" data-tab="a" type="button">Yaz</button>
    <button class="tab-btn" data-tab="b" type="button">Yayınla</button>
    <button class="tab-btn" data-tab="c" type="button">Sil</button>
  </div>
  <div class="tab-panel" data-panel="a">
    <p><code>board new &lt;slug&gt; --title "Başlık"</code> ile iskeleti oluştur, Markdown'ı düzenle.</p>
  </div>
  <div class="tab-panel" data-panel="b">
    <p><code>board publish &lt;slug&gt;</code> ile HTML üret ve linki paylaş.</p>
  </div>
  <div class="tab-panel" data-panel="c">
    <p><code>board delete &lt;slug&gt; --yes</code> ile kaynağı ve yayınlanmış sayfayı kaldır.</p>
  </div>
</div>

## Filtre

<div class="filter-bar">
  <input class="filter-input" data-filter="liste" placeholder="Bileşen filtrele...">
</div>

<ul>
  <li data-filter-item="liste">KPI ve kartlar</li>
  <li data-filter-item="liste">Callout ve uyarılar</li>
  <li data-filter-item="liste">Tablolar ve chartlar</li>
  <li data-filter-item="liste">Sekmeler ve filtre</li>
</ul>

## Zaman çizelgesi

<div class="timeline">
  <div class="timeline-item">
    <span class="timeline-date">2026-10-26</span>
    <h4>Board yayında</h4>
    <p>Wildcard TLS, şifre koruması ve ban mekanizması aktif.</p>
  </div>
  <div class="timeline-item">
    <span class="timeline-date">Sonraki</span>
    <h4>Raporlar</h4>
    <p>Her rapor aynı tasarım sistemiyle yayınlanır.</p>
  </div>
</div>

## Kod

```bash
board new opencode-kurulum-2jk43k --title "OpenCode Kurulum" --tags "opencode,setup"
board publish opencode-kurulum-2jk43k
```

> Board sayfaları yarı-özel kabul edilir. Sır, token ve kişisel veri koymayın.
