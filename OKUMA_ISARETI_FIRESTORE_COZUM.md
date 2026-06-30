# Okuma İşareti Firestore Çözümü

Bu sürümde okuma işaretleri top-level `readingProgress` koleksiyonundan çıkarıldı ve kullanıcı hesabının altına taşındı:

```txt
users/{uid}/readingProgress/{bookSlug}
```

Bu yapı Firestore Rules için daha güvenlidir.

## Yapman gereken

1. Firebase Console'a gir.
2. Firestore Database → Rules bölümünü aç.
3. Bu paketteki `firebase-firestore.rules` dosyasının tamamını yapıştır.
4. Publish / Yayınla butonuna bas.
5. Cloudflare Pages yeniden deploy olduktan sonra siteye kullanıcı hesabıyla giriş yap.
6. Kitapta bir bölümü aç ve “Kaldığım Yeri İşaretle” butonuna bas.

Hâlâ hata alırsan Firebase config bilgileri yanlış projeyi gösteriyor olabilir. Admin paneldeki Firebase bilgileriyle kuralları yayınladığın Firebase projesinin aynı olduğundan emin ol.
