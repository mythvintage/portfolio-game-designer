# Yağmur Baran · Game Designer Portfolio

Oynanabilir bir oyun tasarımcısı portfolyosu: XP, seviyeler, görevler ve başarımlar içeren, İngilizce/Türkçe iki dilli, açık/koyu tema destekli tek sayfalık bir site.

## Klasör yapısı

```
.
├── index.html                 # Sayfanın tüm içeriği (HTML)
└── assets/
    ├── css/styles.css         # Tüm stiller (renk token'ları, açık/koyu tema, bileşenler)
    ├── js/main.js             # XP/seviye sistemi, görevler, dil değiştirme, filtreler, diyaloglar
    ├── video/                 # Oynanış videoları (.mp4)
    │   ├── assembly-point.mp4
    │   └── foosball-run.mp4
    └── img/                   # Video kapak görselleri (.jpg)
        ├── assembly-point-poster.jpg
        └── foosball-run-poster.jpg
```

## Yerelde çalıştırma

Herhangi bir derleme adımı yok. `index.html` dosyasını tarayıcıda açmak yeterli.

İstersen basit bir yerel sunucuyla da açabilirsin:

```bash
python3 -m http.server 8000
# sonra tarayıcıda http://localhost:8000
```

## Notlar

- **Dil:** Metinler `<span class="en">…</span><span class="tr">…</span>` çiftleri olarak yazılı; görünür dil `<html data-lang="…">` ile seçiliyor. Yeni metin eklerken iki dili de ekle.
- **Tema:** Renkler `assets/css/styles.css` içindeki `:root` token'larında. Koyu tema hem `prefers-color-scheme: dark` hem de `data-theme="dark"` ile çalışıyor.
- **İlerleme:** XP ve ilerleme ziyaretçinin tarayıcısında `localStorage` içinde tutuluyor (`yb-quest-v1`, `yb-lang`).
- **Derin bağlantılar:** `#level-sosyal-lig`, `#level-beastrikers`, `#level-aetheria` ilgili vaka çalışmasını açar; `#tr` / `#en` dili değiştirir.
