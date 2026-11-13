# Uptime Monitor

Web sitelerini ve API'leri belirli aralıklarla kontrol eden, uptime yüzdesi ve yanıt süresi istatistiklerini dashboard'da gösteren bir izleme uygulaması.

Node.js ve TypeScript öğrenirken yaptığım ilk backend projesidir.

## Özellikler

- Kayıt ol / giriş yap (JWT ile kimlik doğrulama, şifreler bcrypt ile hashleniyor)
- İzlenecek site ekleme, listeleme, silme (her kullanıcı sadece kendi sitelerini görür)
- Zamanlanmış kontrol: her site için seçilen aralıkta (1-60 dk) istek atılır, durum kodu ve yanıt süresi kaydedilir
- İstatistikler: son 24 saat / 7 gün / 30 gün için uptime yüzdesi ve ortalama yanıt süresi
- Son kesintiler listesi
- Dashboard: durum kartları, yanıt süresi grafiği

## Kullanılan teknolojiler

**Backend:** Node.js, TypeScript, Express 5, Prisma, SQLite, Zod, JWT, bcryptjs, node-cron

**Frontend:** React, Vite, TypeScript, Recharts

## Kurulum

Gereksinim: Node.js 20 veya üzeri.

### Backend

```bash
npm install
```

Proje kökünde `.env.example` dosyasını `.env` olarak kopyalayıp `JWT_SECRET` değerini kendine göre değiştir:

```
DATABASE_URL="file:./dev.db"
JWT_SECRET="uzun-rastgele-bir-metin-yaz"
```

Veritabanını oluştur ve Prisma client'ı üret:

```bash
npx prisma migrate dev
npx prisma generate
```

Sunucuyu başlat:

```bash
npm run dev
```

API `http://localhost:3000` adresinde çalışır.

### Dashboard

Yeni bir terminalde:

```bash
cd dashboard
npm install
npm run dev
```

Dashboard `http://localhost:5173` adresinde açılır. Kayıt olup bir site ekledikten sonra ilk kontrol en geç 1 dakika içinde yapılır.

## API

| Metot | Adres | Açıklama | Giriş gerekli |
|---|---|---|---|
| POST | `/auth/register` | Kayıt ol, token döner | Hayır |
| POST | `/auth/login` | Giriş yap, token döner | Hayır |
| GET | `/monitors` | Monitor listesi | Evet |
| POST | `/monitors` | Yeni monitor ekle | Evet |
| GET | `/monitors/:id` | Tek monitor | Evet |
| PUT | `/monitors/:id` | Monitor güncelle | Evet |
| DELETE | `/monitors/:id` | Monitor sil | Evet |
| GET | `/monitors/:id/checks` | Son 50 kontrol sonucu | Evet |
| GET | `/monitors/:id/stats` | Uptime ve yanıt süresi istatistikleri | Evet |

Giriş gerektiren isteklerde `Authorization: Bearer <token>` başlığı gönderilmelidir.

## Proje yapısı

```
src/
  index.ts           Uygulama girişi, cron görevi
  checker.ts         Sitelere istek atan kontrol mantığı
  schemas.ts         Zod doğrulama şemaları
  lib/prisma.ts      Prisma client
  middleware/auth.ts JWT doğrulama
  routes/            auth ve monitors route'ları
prisma/
  schema.prisma      Veritabanı modelleri
dashboard/           React arayüzü
```

## Yapılacaklar

- [ ] Site düşünce Telegram/e-posta bildirimi
- [ ] Testler
- [ ] Canlıya alma (deploy)
- [ ] Gerçek zamanlı güncelleme (WebSocket)