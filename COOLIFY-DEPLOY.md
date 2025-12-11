# Proxy Server - Coolify Deployment

## 🚀 Coolify'a Deployment

### 1. GitHub Repository Oluşturun
```bash
cd proxy-server
git init
git add .
git commit -m "Initial commit"
git remote add origin YOUR_GITHUB_REPO_URL
git push -u origin main
```

### 2. Coolify'da Yeni Service Ekleyin

1. **Coolify Dashboard** > **+ New Resource**
2. **Application** seçin
3. **GitHub Repository** bağlayın
4. **Build Pack**: Dockerfile
5. **Port**: 3001

### 3. Environment Variables Ekleyin

Coolify'da **Environment Variables** bölümünde:

```env
PORT=3001
POSTGRES_HOST=<DATABASE_INTERNAL_HOSTNAME>
POSTGRES_PORT=5432
POSTGRES_DB=postgres
POSTGRES_USER=supabase_admin
POSTGRES_PASSWORD=<POSTGRES_PASSWORD>
NODE_ENV=production
```

**ÖNEMLİ**: `POSTGRES_HOST` için Coolify'daki database'in **internal hostname**'ini kullanın.
Örnek: `tso4g4cwwwgwcs4kscs48s40` (Database container ID)

### 4. Database Internal Hostname Bulma

Coolify terminalinde:
```bash
hostname
```

Veya Coolify arayüzünde **Database > Configuration > Network** bölümünden.

### 5. Deploy Edin

Coolify otomatik olarak:
- Docker image build edecek
- Container başlatacak
- Health check yapacak

### 6. Public URL Alın

Deploy sonrası Coolify size bir public URL verecek:
```
https://proxy-xxxxx.your-domain.com
```

Bu URL'i `web-app/supabase-config.js` dosyasında `proxyUrl` olarak kullanın.

## 🔧 Alternatif: Local Proxy + SSH Tunnel

Eğer Coolify'a deploy etmek istemiyorsanız, SSH tunnel kullanabilirsiniz:

```bash
# Local makinenizde
ssh -L 5432:localhost:5432 root@65.108.77.26

# Sonra .env'de
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
```

## ✅ Test

Deploy sonrası:
```bash
curl https://your-proxy-url.com/health
```

Cevap:
```json
{
  "status": "ok",
  "timestamp": "2024-12-11T12:00:00.000Z",
  "database": "connected"
}
```

## 🔗 Frontend Bağlantısı

`web-app/supabase-config.js`:
```javascript
const SUPABASE_CONFIG = {
  url: 'http://supabasekong-jkc8sgc8cgsw4wk8k4g0okcg.65.108.77.26.sslip.io:8000',
  anonKey: 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...',
  proxyUrl: 'https://your-proxy-url.com' // Coolify'dan aldığınız URL
};
```

## 🐛 Troubleshooting

### Database bağlantı hatası
- Internal hostname'i kontrol edin
- Database ve Proxy aynı network'te mi?
- Environment variables doğru mu?

### CORS hatası
- `index.js` içinde CORS ayarları doğru mu?
- Frontend URL'i whitelist'te mi?

### Port hatası
- Coolify'da port 3001 expose edilmiş mi?
- Health check çalışıyor mu?

