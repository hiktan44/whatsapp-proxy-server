# 🔄 WATI API Proxy Server

CORS sorununu çözmek ve WATI API'yi güvenli şekilde kullanmak için Express.js proxy sunucusu.

## 🚀 Hızlı Başlangıç

### 1. Bağımlılıkları Yükleyin

```bash
cd proxy-server
npm install
```

### 2. Environment Variables

`env.example` dosyasını `.env` olarak kopyalayın ve düzenleyin:

```bash
cp env.example .env
```

```env
SUPABASE_URL=https://YOUR-SUPABASE-KONG-DOMAIN:8000
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY
PORT=3001
```

### 3. Sunucuyu Başlatın

**Development:**
```bash
npm run dev
```

**Production:**
```bash
npm start
```

## 📡 API Endpoints

### Health Check
```bash
GET /health
```

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T12:00:00.000Z",
  "uptime": 123.45,
  "database": "connected"
}
```

### WATI Proxy
```bash
POST /api/wati-proxy
Content-Type: application/json

{
  "action": "getContacts",
  "data": {}
}
```

**Desteklenen Actions:**
- `getContacts` - Kişileri getir
- `addContact` - Kişi ekle
- `sendTemplateMessage` - Şablon mesaj gönder
- `sendSessionMessage` - Session mesaj gönder
- `getMessageTemplates` - Şablonları getir
- `uploadMedia` - Medya yükle

## 🐳 Docker Deployment

### Dockerfile Oluşturun

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

EXPOSE 3000

CMD ["npm", "start"]
```

### Build & Run

```bash
docker build -t wati-proxy .
docker run -p 3000:3000 --env-file .env wati-proxy
```

## ☁️ Coolify Deployment

1. Coolify Dashboard → **"New Resource"** → **"Node.js"**
2. Repository: Bu klasörü içeren repo
3. **Base Directory**: `proxy-server`
4. **Build Command**: `npm install`
5. **Start Command**: `npm start`
6. **Environment Variables**:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `PORT=3001`
7. **"Deploy"**

## 🔧 Troubleshooting

### Port Already in Use

```bash
# Port'u kullanan process'i bul
lsof -i :3000

# Process'i kapat
kill -9 <PID>
```

### Supabase Connection Error

- Supabase URL doğru mu?
- Service Role Key doğru mu?
- Supabase çalışıyor mu?

### CORS Error

`index.js` dosyasında CORS ayarlarını kontrol edin:

```javascript
app.use(cors({
  origin: 'https://your-frontend-domain.com', // Spesifik domain
  credentials: true
}));
```

## 📊 Monitoring

### Logs

```bash
# Docker
docker logs -f wati-proxy

# PM2
pm2 logs wati-proxy

# Coolify
Coolify Dashboard → App → Logs
```

### Health Check

```bash
curl http://localhost:3000/health
```

## 🔒 Güvenlik

- ✅ Service Role Key kullanılıyor (Anon Key değil)
- ✅ CORS yapılandırması
- ✅ Request logging
- ✅ Error handling
- ⚠️ Production'da `origin: '*'` yerine spesifik domain kullanın

## 📝 License

MIT


