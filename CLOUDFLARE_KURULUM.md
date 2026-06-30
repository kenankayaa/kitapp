# Cloudflare Pages Kurulum Rehberi

Bu paket Netlify yerine Cloudflare Pages için hazırlanmıştır. Site statik olarak Cloudflare'da yayınlanır; giriş, yorum, avatar ve admin içerikleri Firebase Authentication + Firestore ile çalışır. Firebase Storage kullanılmaz.

## 1) GitHub reposunu hazırla

1. Bu zip dosyasını aç.
2. Dosyaları GitHub'daki mevcut site reposuna yükle.
3. Eski Netlify ayarları artık gerekli değildir.
4. GitHub'a tek seferde gönder; her küçük değişikliği ayrı ayrı göndermek gereksiz deploy oluşturur.

## 2) Cloudflare Pages projesi oluştur

1. Cloudflare hesabına gir.
2. Sol menüden **Workers & Pages** bölümüne gir.
3. **Create application / Create project** seç.
4. **Pages** bölümünde **Connect to Git** seç.
5. GitHub hesabını bağla.
6. Site reposunu seç.
7. Proje adı olarak `kenankaya` dene. Uygunsa siten şu adrese çıkar:

```txt
https://kenankaya.pages.dev
```

Alınmışsa `kenankaya-yazar`, `kenankaya-kitaplar` gibi bir ad seçebilirsin.

## 3) Build ayarları

Cloudflare Pages ekranında şu ayarları gir:

```txt
Framework preset: None / Hiçbiri
Build command: npm run build
Build output directory: dist
Root directory: boş bırak
```

Sonra **Save and Deploy** de.

## 4) Firebase Authorized domains ayarı

Firebase Console → Authentication → Settings → Authorized domains bölümüne Cloudflare adresini ekle.

Siten şuysa:

```txt
https://kenankaya.pages.dev
```

Firebase'e sadece bunu ekle:

```txt
kenankaya.pages.dev
```

Başında `https://` olmayacak, sonunda `/` olmayacak.

## 5) Firestore kurallarını tekrar yayınla

Bu paketteki dosyayı aç:

```txt
firebase-firestore.rules
```

İçindeki tüm kodları kopyala ve Firebase Console'da şu yere yapıştır:

```txt
Firestore Database → Rules → Publish
```

## 6) Admin panel

Deploy tamamlanınca admin panel adresin şu olacak:

```txt
https://kenankaya.pages.dev/admin/
```

Sitede admin linki görünmez. Adresi elle yazacaksın.

## 7) Görsel ve müzik ekleme

Firebase Storage kullanılmadığı için görsel/müzik dosyalarını GitHub reposunda şu klasöre koy:

```txt
src/assets/uploads/
```

Örnek dosyalar:

```txt
src/assets/uploads/kapak.jpg
src/assets/uploads/fon_25mb.mp3
```

Admin panelde URL alanına böyle yaz:

```txt
/assets/uploads/kapak.jpg
/assets/uploads/fon_25mb.mp3
```

## 8) Netlify'den farkı

- Netlify Identity yok.
- Git Gateway yok.
- Netlify kredi sistemi yok.
- Firebase Storage yok.
- Sadece Cloudflare Pages + Firebase Auth + Firestore var.

## 9) Sık hata çözümleri

### Sayfa açılıyor ama giriş çalışmıyor
Firebase Authorized domains kısmına `kenankaya.pages.dev` eklenmemiş olabilir.

### Admin panel boş geliyor
Firebase config bilgilerini `content/site.json` içindeki `firebase` alanına doğru girdiğinden emin ol.

### Görsel/müzik görünmüyor
Dosyayı `src/assets/uploads/` içine koyup GitHub'a yüklediğinden emin ol. Admin panelde URL `/assets/uploads/dosya-adi.ext` şeklinde olmalı.

### Deploy başarısız oldu
Cloudflare build ayarlarını tekrar kontrol et:

```txt
Build command: npm run build
Build output directory: dist
```
