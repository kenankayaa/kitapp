# Storage Ücret İstiyorsa Ne Yapılacak?

Firebase Storage yeni projelerde Blaze/faturalandırma isteyebilir. Bu pakette Storage tamamen çıkarıldı.

Yapman gereken tek Firebase kuralı:

- `firebase-firestore.rules` dosyasını Firestore Rules alanına yapıştırmak.

Yapmana gerek olmayanlar:

- Firebase Storage açmak
- Storage bucket oluşturmak
- `firebase-storage.rules` yapıştırmak
- Blaze planına geçmek

Görsel ve müzik dosyalarını ücretsiz kullanmak için dosyaları GitHub reposunda `src/assets/uploads/` klasörüne koy. Netlify deploy sonrası URL şu formatta olur:

```txt
/assets/uploads/dosya-adi.jpg
```
