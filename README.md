# Yağmur Baran · Game Designer Portfolio

Oynanabilir bir oyun tasarımcısı portfolyosu: XP, seviyeler, görevler ve başarımlar içeren, açık/koyu tema destekli tek sayfalık bir site.

## Klasör yapısı

```
.
├── index.html                 # Sayfanın tüm içeriği (HTML)
├── assets/
│   ├── css/styles.css         # Sitenin stilleri (renk token'ları, açık/koyu tema, bileşenler)
│   ├── css/editor.css         # Düzenleme modunun görünümü (yayında kullanılmaz)
│   ├── js/main.js             # XP/seviye sistemi, görevler, dil, filtreler, diyaloglar
│   ├── js/editor.js           # Sahibine özel düzenleme modu (yayından önce kapatılacak)
│   ├── video/                 # Oynanış videoları (.mp4)
│   └── img/                   # Video kapak görselleri (.jpg)
└── tools/artifact_sync.py     # index.html ↔ claude.ai artifact dönüşümü
```

## Yerelde çalıştırma

Derleme adımı yok. `index.html` dosyasını tarayıcıda açmak yeterli, ya da:

```bash
python3 -m http.server 8000   # sonra http://localhost:8000
```

## Düzenleme modu (şu an açık)

Sağ alttaki **✎ Edit page** düğmesi düzenleme modunu açar. Düğmeyi yalnızca sayfanın sahibi görür:

- **claude.ai artifact'ında:** sadece artifact'ın sahibi. **Save**, düzenlenmiş sayfayı artifact'ın yeni sürümü olarak kaydeder.
- **Bilgisayarda dosya olarak açınca** (`file://` ya da `localhost`): **Download index.html** güncel dosyayı indirir.
- **Başka bir adreste yayındayken** (ör. GitHub Pages) editör hiç çalışmaz.

Düzenleme modunda:

- **Metinler:** kesikli çerçeveli her metne tıklayıp yazabilirsin. Enter ya da Esc düzenlemeyi bitirir. Yapıştırılan metin düz yazı olarak girer. Satırlar metin uzadıkça uzar, sütun yerleşimi değişmez.
- **Düğme ve linkler:** üzerine tıklayınca küçük bir pencere açılır. Buradan yazıyı, dış linklerde adresi değiştirebilirsin. "Go there / Open link / Press button" düğmenin asıl işini yapar (ör. bir seviyeyi açar).
- **Oyunlar:** bir oyuna tıklayınca adını, açıklamasını, linkini ve hangi filtrelerde görüneceğini düzenleyebilir ya da oyunu çıkarabilirsin. Öne çıkan oyun kartlarında stüdyo etiketi, tür etiketi ve birden fazla link (App Store, Google Play…) var. **+ Add game**, **+ Add featured game** ve **+ Add studio** yeni kayıt ekler; **Remove studio** stüdyoyu oyunlarıyla birlikte çıkarır.
- **Preview** çerçeveleri gizleyip sayfayı normal haliyle gösterir; **Discard** kaydedilmemiş değişiklikleri atar.

Düzenlenemeyen yerler: oyun sistemi metinleri (görevler, başarımlar, seviye adları; `assets/js/main.js` içinde), veriden çizilen grafiklerin değerleri ve videolar. Bunlar için değişikliği Claude'a söylemek yeterli.

### Kaydedilen değişiklikler repoya nasıl gelir

Artifact'ta **Save** dedikten sonra Claude artifact'ın son sürümünü okur ve şu komutla `index.html`'e işler:

```bash
python3 tools/artifact_sync.py from-artifact KAYDEDILEN_SAYFA.html
python3 tools/artifact_sync.py to-artifact ARTIFACT_SAYFASI.html   # ters yön: repodan artifact'a
```

İki yön birbirinin tam tersi olduğu için git yalnızca gerçekten değişen satırları gösterir.

### Yayından önce düzenlemeyi kapatma

`index.html`'in sonundaki şu satırı silmek yeterli:

```html
<script src="assets/js/editor.js" defer=""></script>
```

## Dil

Türkçe şimdilik kapalı (metinler İngilizce düzenleniyor). Açmak için `index.html`'de `.lang` öğesindeki `hidden` özniteliğini kaldır. Türkçe metinler `<span class="tr">…</span>` olarak sayfada duruyor; İngilizce metin değiştiyse karşılığının yeniden çevrilmesi gerekir.

## Notlar

- **Tema:** Renkler `assets/css/styles.css` içindeki `:root` token'larında. Koyu tema hem `prefers-color-scheme: dark` hem de `data-theme="dark"` ile çalışıyor.
- **İlerleme:** XP ve ilerleme ziyaretçinin tarayıcısında `localStorage` içinde tutuluyor (`yb-quest-v1`, `yb-lang`).
- **Derin bağlantılar:** `#level-sosyal-lig`, `#level-beastrikers`, `#level-aetheria` ilgili vaka çalışmasını açar.
