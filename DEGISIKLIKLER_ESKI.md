# v11 Değişiklikler

Bu sürümde okuma deneyimi ve okuma işareti sistemi yenilendi.

## Eklenenler

- Okuma işareti sırasında Firestore hata mesajları artık okura gösterilmez.
- Firebase yazamazsa okuma yeri sessizce cihazdaki yerel kayda alınır.
- Kitap okuma alanı sayfa sayfa görüntülenir.
- Önceki sayfa / sonraki sayfa butonları eklendi.
- Sayfa numarası yazıp doğrudan o sayfaya gitme eklendi.
- Sayfa çevirme animasyonu eklendi.
- Tam ekran okuma modu eklendi.
- Bölüm üzerine gelince bölümün kaç sayfa olduğu ve paragraf sayısı görünür.
- Dark tema eklendi.
- Ziyaretçinin açık/koyu tema seçimi tarayıcıda hatırlanır.
- Türkçe / İngilizce arayüz geçişi eklendi.
- Dark temada kitap okuma alanı koyu renk, yazılar beyaz olacak şekilde düzenlendi.

## Not

Okuma işareti artık önce cihazda kaydedilir. Firestore kuralları veya Firebase izinleri sorun çıkarsa bile okur ekranda hata görmez. Aynı cihazda kaldığı yerden devam eder. Firestore doğru çalışıyorsa kayıt hesabına da yazılır.


## v12

- Cloudflare/tarayıcı önbelleği yüzünden yeni özelliklerin görünmemesi için `app.js?v=12` ve `style.css?v=12` eklendi.
- Cloudflare Pages için `_headers` dosyası eklendi; JS, CSS, içerik ve admin dosyaları `no-cache` çalışır.
- Kitap okuma ekranına görünür “sayfa sayfa kitap modu açık” notu eklendi.
- Klavyede sağ/sol ok tuşlarıyla sayfa değiştirme eklendi.
- Tam ekranda `Esc` ile çıkış eklendi.
- Dark tema yazı kontrastı güçlendirildi.
