# Site Açılmıyor Hatası İçin Düzeltme

Bu sürümde site açılışına güvenli hata yakalama eklendi.

## Ne düzeltildi?

- `/content/index.json` yüklenemezse site tamamen beyaz kalmaz.
- Firebase veya Firestore tarafında bozuk/eksik içerik varsa site güvenli modda açılır.
- Kitap kayıtlarında `chapters` alanı bozuk gelirse site çökmez.
- Paylaşım/kitap verileri daha güvenli biçimde temizlenir.
- Ana sayfa açılmazsa ekranda teknik hata kutusu görünür.

## Cloudflare ayarları

Cloudflare Pages ayarlarında şunları kullan:

- Build command: `npm run build`
- Build output directory: `dist`
- Framework preset: `None`

## Hâlâ açılmazsa

Cloudflare Pages > Deployments > en son deploy > Build log bölümünde kırmızı hata varsa oradaki ilk hata satırı kontrol edilmeli.
