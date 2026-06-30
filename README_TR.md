# Kenan Kaya Yazar Sitesi — Cloudflare Pages v11

Bu paket Cloudflare Pages üzerinde yayınlanmak üzere hazırlanmıştır.

## Kurulum

1. Zip dosyasını aç.
2. İçindeki dosyaları GitHub reposundaki mevcut site dosyalarının üstüne yükle.
3. Cloudflare Pages yeniden deploy etsin.
4. Build ayarları aynı kalmalı:

```txt
Build command: npm run build
Build output directory: dist
Framework preset: None
```

## Bu sürümde gelen yeni özellikler

- Kitaplar artık uzun metin şeklinde değil, sayfa sayfa okunur.
- Okur önceki/sonraki sayfaya geçebilir.
- Okur sayfa numarası yazıp belirli sayfaya gidebilir.
- Sayfa çevirme animasyonu vardır.
- Tam ekran okuma modu vardır.
- Bölümlerin üzerine gelince kaç sayfa olduğu görünür.
- Okur giriş yaptıysa kaldığı bölümü ve sayfayı işaretleyebilir.
- Firebase hata verirse bu hata okura gösterilmez; kayıt aynı cihazda yerel olarak tutulur.
- Dark tema eklendi.
- Türkçe/İngilizce arayüz geçişi eklendi.

## Önemli not

Firestore kurallarında sorun olsa bile okuma işareti sistemi artık ekranda hata göstermez. Ancak işaretin farklı cihazlarda da görünmesini istiyorsan Firebase Firestore kurallarının doğru olması gerekir.

## Görsel ve müzik dosyaları

Dosyaları şu klasöre koy:

```txt
src/assets/uploads/
```

Admin panelindeki URL alanına örnek:

```txt
/assets/uploads/kapak.png
/assets/uploads/fon_25mb.mp3
```


## v12 Notu — Özellikler görünmüyorsa

Bu sürümde `/app.js` ve `/style.css` dosyalarına sürüm numarası eklendi: `?v=12`. Cloudflare ve tarayıcı eski dosyaları önbellekten gösterdiğinde yeni özellikler görünmeyebiliyordu. Ayrıca `src/_headers` dosyası eklendi ve aktif JS/CSS dosyaları için `no-cache` ayarı yapıldı.

Cloudflare deploy sonrası siteyi bir kez şu şekilde yenile:

- Windows: `Ctrl + F5`
- Chrome: adres çubuğunda site açıkken sağ tık Yenile → `Önbelleği boşalt ve sert yeniden yükle`

Yeni sürümde kitap sayfasında üst kısımda “Sayfa sayfa kitap modu açık” yazısı görünmelidir. Bu yazıyı görmüyorsan hâlâ eski dosya çalışıyor demektir.
