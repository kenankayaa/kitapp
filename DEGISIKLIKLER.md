# v13 Değişiklikleri

- Cloudflare deploy hatasını azaltmak için npm/build sistemi kaldırıldı.
- Hazır statik site `public/` klasörüne alındı.
- Cloudflare ayarı `Build command: exit 0`, `Build output directory: public` oldu.
- `app.js` ve `style.css` v13 olarak sürümlendi.
- `404.html` eklendi; sayfa yenilemelerinde boş/404 riski azaltıldı.
- Cache başlıkları no-store/no-cache olarak yenilendi.
- v12'deki sayfa sayfa okuma, tam ekran, dark tema, dil ve sessiz okuma işareti özellikleri korunarak doğrudan yayına hazır hale getirildi.
