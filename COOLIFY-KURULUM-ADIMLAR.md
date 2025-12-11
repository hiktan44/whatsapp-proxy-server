# 🚀 Coolify'a Proxy Server Deployment - Adım Adım

## 📦 Yöntem 1: GitHub ile Deployment (Önerilen)

### 1. GitHub Repository Oluşturun
1. https://github.com/new adresine gidin
2. Repository adı: `whatsapp-proxy-server`
3. Public veya Private seçin
4. **README, .gitignore eklemeyin** (zaten var)
5. "Create repository" tıklayın

### 2. Kodu GitHub'a Push Edin
Terminal'de (bu klasörde):
```bash
git remote add origin https://github.com/KULLANICI_ADINIZ/whatsapp-proxy-server.git
git branch -M main
git push -u origin main
```

### 3. Coolify'da Yeni Application Oluşturun

#### 3.1. New Resource
- Coolify Dashboard > **+ New Resource**
- **Application** seçin

#### 3.2. Source Seçimi
- **Public Repository** veya **Private Repository** (GitHub hesabınızı bağlayın)
- Repository URL'inizi girin: `https://github.com/KULLANICI_ADINIZ/whatsapp-proxy-server`
- Branch: `main`

#### 3.3. Build Pack
- **Dockerfile** seçin
- Dockerfile path: `Dockerfile` (default)

#### 3.4. General Settings
- **Name**: `whatsapp-proxy-server`
- **Port**: `3001`
- **Base Directory**: `/` (root)

### 4. Environment Variables Ekleyin

**Environment Variables** bölümünde şunları ekleyin:

```env
PORT=3001
POSTGRES_HOST=postgres
POSTGRES_PORT=5432
POSTGRES_DB=postgres
POSTGRES_USER=proxy_user
POSTGRES_PASSWORD=CHANGE_ME
NODE_ENV=production
```

**ÖNEMLİ**: `POSTGRES_HOST` için **container id/hostname** kullanmayın. Aynı docker network içindeki servis adı olmalı.
Genelde Supabase stack içinde Postgres servis adı **`postgres`** (bazı kurulumlarda `db`) olur.

#### Database Internal Hostname Bulma:
Proxy container'ında test:
```bash
getent hosts postgres
getent hosts db
```
Hangisi IP döndürürse, `POSTGRES_HOST` o olmalı.

---

## 🔐 DB'de proxy_user oluşturma (Çok önemli)

Supabase'in bazı rollerı (örn: `supabase_admin`) **reserved** olduğu için şifre/yetki yönetimi sınırlı olabilir.
Bu yüzden proxy için ayrı bir kullanıcı öneriyoruz.

Coolify > **Supabase Db (Postgres)** > **Terminal**:

```bash
psql -U postgres -d postgres <<'SQL'
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'proxy_user') THEN
    CREATE ROLE proxy_user WITH LOGIN PASSWORD 'CHANGE_ME';
  ELSE
    ALTER ROLE proxy_user WITH PASSWORD 'CHANGE_ME';
  END IF;
END$$;

GRANT USAGE ON SCHEMA public TO proxy_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO proxy_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO proxy_user;

GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO proxy_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
GRANT USAGE, SELECT ON SEQUENCES TO proxy_user;
SQL
```

Sonra proxy env'de:
```env
POSTGRES_USER=proxy_user
POSTGRES_PASSWORD=CHANGE_ME
```

### 5. Network Ayarları

#### 5.1. Aynı Network'e Bağlayın
- **Networks** bölümünde
- Database ile aynı network'ü seçin (genellikle `coolify` network'ü)

#### 5.2. Public URL
- **Domains** bölümünde
- Coolify otomatik bir domain verecek
- Veya kendi domain'inizi ekleyebilirsiniz

### 6. Deploy Edin

- **Deploy** butonuna tıklayın
- Coolify otomatik olarak:
  - Docker image build edecek
  - Container başlatacak
  - Health check yapacak
  - Public URL verecek

### 7. Deployment Loglarını İzleyin

Deploy sırasında:
- **Logs** sekmesinde build sürecini izleyin
- Hata varsa burada görünecek

Başarılı deployment sonrası göreceğiniz mesajlar:
```
🚀 WATI Proxy Server running on port 3001
📡 Health check: http://localhost:3001/health
🔗 PostgreSQL: tso4g4cwwwgwcs4kscs48s40:5432/postgres
✅ Database connected - X contacts
```

### 8. Public URL'i Alın

Deploy tamamlandıktan sonra:
- **Domains** bölümünde public URL'inizi göreceksiniz
- Örnek: `https://whatsapp-proxy-xxxxx.your-coolify-domain.com`

### 9. Frontend'i Güncelleyin

`web-app/supabase-config.js` dosyasını güncelleyin:

```javascript
const SUPABASE_CONFIG = {
  url: 'http://supabasekong-jkc8sgc8cgsw4wk8k4g0okcg.65.108.77.26.sslip.io:8000',
  anonKey: 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...',
  proxyUrl: 'https://whatsapp-proxy-xxxxx.your-coolify-domain.com' // Coolify'dan aldığınız URL
};
```

### 10. Test Edin

```bash
# Health check
curl https://whatsapp-proxy-xxxxx.your-coolify-domain.com/health

# Beklenen cevap:
{
  "status": "ok",
  "timestamp": "2024-12-11T12:00:00.000Z",
  "database": "connected",
  "contacts": 0
}
```

---

## 🔧 Yöntem 2: Docker Compose ile Deployment (Alternatif)

Eğer GitHub kullanmak istemiyorsanız:

### 1. Dosyaları Sunucuya Yükleyin

```bash
# Local makinenizde
cd "/Users/hikmettanriverdi/Downloads/whatsapp-extension-v1.0.2 10/proxy-server"
tar -czf proxy-server.tar.gz .
scp proxy-server.tar.gz root@65.108.77.26:/root/
```

### 2. Sunucuda Çalıştırın

```bash
# Sunucuda
ssh root@65.108.77.26
cd /root
tar -xzf proxy-server.tar.gz -C /root/proxy-server
cd /root/proxy-server

# Environment variables'ı ayarlayın
cat > .env << 'EOF'
PORT=3001
POSTGRES_HOST=postgres
POSTGRES_PORT=5432
POSTGRES_DB=postgres
POSTGRES_USER=proxy_user
POSTGRES_PASSWORD=CHANGE_ME
NODE_ENV=production
EOF

# Docker Compose ile başlatın
docker-compose up -d
```

### 3. Nginx Reverse Proxy Ekleyin (Opsiyonel)

Coolify'da **Proxy** bölümünden:
- Yeni bir proxy rule ekleyin
- Port: 3001
- Domain: istediğiniz subdomain

---

## 🐛 Troubleshooting

### Database bağlantı hatası
```
❌ Database connection failed: password authentication failed
```

**Çözüm:**
1. `POSTGRES_HOST` değerini kontrol edin (internal hostname olmalı)
2. Database ile aynı network'te olduğundan emin olun
3. Environment variables'ı tekrar kontrol edin

### Port hatası
```
Error: listen EADDRINUSE: address already in use :::3001
```

**Çözüm:**
- Başka bir port kullanın (örn: 3002)
- Veya çakışan container'ı durdurun

### Build hatası
```
ERROR: failed to solve: failed to compute cache key
```

**Çözüm:**
- Dockerfile'ı kontrol edin
- `.dockerignore` dosyasını kontrol edin
- Coolify'da "Clear Build Cache" yapın

### CORS hatası
```
Access to fetch at 'https://proxy-url.com' has been blocked by CORS
```

**Çözüm:**
- `index.js` içinde CORS ayarlarını kontrol edin
- Frontend URL'ini whitelist'e ekleyin

---

## ✅ Başarılı Deployment Kontrol Listesi

- [ ] GitHub repository oluşturuldu
- [ ] Kod GitHub'a push edildi
- [ ] Coolify'da application oluşturuldu
- [ ] Environment variables eklendi
- [ ] Database internal hostname doğru ayarlandı
- [ ] Aynı network'e bağlandı
- [ ] Deploy tamamlandı
- [ ] Health check başarılı
- [ ] Public URL alındı
- [ ] Frontend güncellendi
- [ ] Test edildi

---

## 📞 Yardım

Sorun yaşarsanız:
1. Coolify logs'ları kontrol edin
2. Database bağlantısını test edin
3. Environment variables'ı doğrulayın
4. Network ayarlarını kontrol edin

