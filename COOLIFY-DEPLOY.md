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
SUPABASE_URL=https://YOUR-SUPABASE-KONG-DOMAIN:8000
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY
CORS_ORIGINS=*
NODE_ENV=production
```

**ÖNEMLİ**:

- `SUPABASE_SERVICE_ROLE_KEY` **sadece proxy server’da** olmalı (frontend’e koymayın)
- `SUPABASE_URL` olarak **Kong URL**’inizi kullanın (genelde `https://...:8000`)

### 4. Supabase URL ve Service Role Key Nereden Alınır?

- **SUPABASE_URL**: Coolify’da Supabase Kong servisinin URL’i (genelde `https://...:8000`)
- **SUPABASE_SERVICE_ROLE_KEY**: Supabase stack environment variables içinde `SERVICE_ROLE_KEY` / `SUPABASE_SERVICE_ROLE_KEY`

### 5. Deploy Edin

Coolify otomatik olarak:

- Docker image build edecek
- Container başlatacak
- Health check yapacak

### 6. Public URL Alın

Deploy sonrası Coolify size bir public URL verecek:

```text
https://proxy-xxxxx.your-domain.com
```

Bu URL'i `web-app/supabase-config.js` dosyasında `proxyUrl` olarak kullanın.

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

- `SUPABASE_URL` doğru mu? (Kong URL + port `8000`)
- `SUPABASE_SERVICE_ROLE_KEY` doğru mu?
- Coolify’da env güncellemesinden sonra **Redeploy** yapıldı mı?

### CORS hatası

- `index.js` içinde CORS ayarları doğru mu?
- Frontend URL'i whitelist'te mi?

### Port hatası

- Coolify'da port 3001 expose edilmiş mi?
- Health check çalışıyor mu?
