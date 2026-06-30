# Cloudflare Pages v13 - Build Hatasız Kurulum

Bu paket **npm / node / build kullanmaz**. Cloudflare deploy hatası almamak için site dosyaları `public/` klasörünün içinde hazır gelir.

## GitHub ile kurulum

1. GitHub'da yeni boş repo oluştur.
2. Bu paketin içindeki dosyaları olduğu gibi yükle. Repo kökünde mutlaka `public/` klasörü görünmeli.
3. Cloudflare → Workers & Pages → Create → Pages → Connect to Git.
4. Repo'yu seç.
5. Ayarları şöyle yap:

```txt
Framework preset: None / Hiçbiri
Build command: exit 0
Build output directory: public
Root directory: boş bırak
Production branch: main
```

## Önemli

- `npm run build` yazma.
- Output directory olarak `dist` yazma.
- Bu sürümde doğru output `public`.
- Deploy sonrası sayfayı `Ctrl + F5` ile yenile.

## Firebase

Firebase Authentication kullanıyorsan Authorized domains kısmına Cloudflare adresini ekle:

```txt
site-adin.pages.dev
```

Firestore Rules için `firebase-firestore.rules` dosyasını Firestore Database → Rules alanına yapıştırıp Publish/Yayınla yap.

## Çalışma kontrolü

Site açıldığında kitap okuma ekranında şu yazıyı görmelisin:

```txt
Sayfa sayfa kitap modu açık. Ok tuşlarıyla da sayfa çevirebilirsin.
```

Bu yazı görünüyorsa v13 çalışıyor demektir.
