import express from 'express';
import cors from 'cors';
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// CORS - Tüm origin'lere izin ver (production'da spesifik domain kullanın)
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// PostgreSQL Pool
const pool = new pg.Pool({
  host: process.env.POSTGRES_HOST || 'localhost',
  port: parseInt(process.env.POSTGRES_PORT) || 5432,
  database: process.env.POSTGRES_DB || 'postgres',
  user: process.env.POSTGRES_USER || 'postgres',
  password: process.env.POSTGRES_PASSWORD || '',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Request logging middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// Health check
app.get('/health', async (req, res) => {
  try {
    // Test PostgreSQL connection
    const result = await pool.query('SELECT NOW()');
    res.json({ 
      status: 'ok', 
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      database: 'connected',
      db_time: result.rows[0].now
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      database: 'disconnected',
      error: error.message
    });
  }
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'WATI Proxy Server',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      watiProxy: '/api/wati-proxy (POST)'
    }
  });
});

// WATI API Proxy
app.post('/api/wati-proxy', async (req, res) => {
  try {
    const { action, data } = req.body;

    if (!action) {
      return res.status(400).json({ error: 'Action parametresi gerekli' });
    }

    console.log(`📡 WATI Proxy: ${action}`);

    // WATI API ayarlarını PostgreSQL'den al
    const settingsResult = await pool.query(
      `SELECT key, value FROM settings WHERE key IN ('wati_api_key', 'wati_api_url')`
    );

    const settings = {};
    settingsResult.rows.forEach(row => {
      settings[row.key] = row.value;
    });

    const apiKey = settings.wati_api_key || '';
    const apiUrl = settings.wati_api_url || '';

    if (!apiKey || !apiUrl) {
      return res.status(400).json({ 
        error: 'WATI API ayarları yapılandırılmamış',
        details: {
          hasApiKey: !!apiKey,
          hasApiUrl: !!apiUrl
        }
      });
    }

    // WATI API endpoint'ini belirle
    let endpoint = '';
    let method = 'GET';
    let body = null;

    switch (action) {
      case 'getContacts':
        endpoint = '/api/v1/getContacts';
        method = 'GET';
        break;
      
      case 'addContact':
        endpoint = '/api/v1/addContact';
        method = 'POST';
        body = data;
        break;
      
      case 'sendTemplateMessage':
        endpoint = '/api/v1/sendTemplateMessage';
        method = 'POST';
        body = data;
        break;
      
      case 'sendSessionMessage':
        endpoint = `/api/v1/sendSessionMessage/${data.phone}`;
        method = 'POST';
        body = { messageText: data.message };
        break;
      
      case 'getMessageTemplates':
        endpoint = '/api/v1/getMessageTemplates';
        method = 'GET';
        break;
      
      case 'uploadMedia':
        endpoint = '/api/v1/uploadMedia';
        method = 'POST';
        body = data;
        break;
      
      default:
        return res.status(400).json({ error: `Geçersiz action: ${action}` });
    }

    console.log(`🔄 WATI Request: ${method} ${apiUrl}${endpoint}`);

    // WATI API'ye istek yap
    const watiResponse = await fetch(`${apiUrl}${endpoint}`, {
      method,
      headers: {
        'Authorization': apiKey,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : null,
    });

    const responseData = await watiResponse.json();

    console.log(`${watiResponse.ok ? '✅' : '❌'} WATI Response: ${watiResponse.status}`);

    // Aktivite logla
    try {
      await pool.query(
        `INSERT INTO activity_logs (action, details) VALUES ($1, $2)`,
        [
          `wati_${action}`,
          JSON.stringify({
            endpoint,
            method,
            status: watiResponse.status,
            success: watiResponse.ok,
            timestamp: new Date().toISOString()
          })
        ]
      );
    } catch (logError) {
      console.error('⚠️ Aktivite loglama hatası:', logError);
      // Loglama hatası ana işlemi etkilemesin
    }

    res.status(watiResponse.status).json(responseData);

  } catch (error) {
    console.error('❌ WATI Proxy Error:', error);
    res.status(500).json({ 
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// ===== KİŞİLER API =====

// Kişileri listele
app.get('/api/contacts', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 1000;
    const offset = parseInt(req.query.offset) || 0;

    const result = await pool.query(
      'SELECT * FROM contacts ORDER BY created_at DESC LIMIT $1 OFFSET $2',
      [limit, offset]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('❌ Kişiler yüklenemedi:', error);
    res.status(500).json({ error: error.message });
  }
});

// Kişi ekle
app.post('/api/contacts', async (req, res) => {
  try {
    const { name, phone, email, company, tags } = req.body;

    const result = await pool.query(
      `INSERT INTO contacts (name, phone, email, company, tags) 
       VALUES ($1, $2, $3, $4, $5) 
       RETURNING *`,
      [name, phone, email || null, company || null, tags || []]
    );

    console.log('✅ Kişi eklendi:', phone);
    res.json(result.rows[0]);
  } catch (error) {
    console.error('❌ Kişi eklenemedi:', error);
    res.status(500).json({ error: error.message });
  }
});

// Toplu kişi ekle
app.post('/api/contacts/bulk', async (req, res) => {
  try {
    const { contacts } = req.body;
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      const insertedContacts = [];

      for (const contact of contacts) {
        const result = await client.query(
          `INSERT INTO contacts (name, phone, email, company, tags) 
           VALUES ($1, $2, $3, $4, $5) 
           ON CONFLICT (phone) DO UPDATE 
           SET name = EXCLUDED.name, 
               email = EXCLUDED.email, 
               company = EXCLUDED.company, 
               tags = EXCLUDED.tags,
               updated_at = NOW()
           RETURNING *`,
          [contact.name, contact.phone, contact.email || null, contact.company || null, contact.tags || []]
        );
        insertedContacts.push(result.rows[0]);
      }

      await client.query('COMMIT');
      console.log(`✅ ${insertedContacts.length} kişi eklendi`);
      res.json(insertedContacts);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('❌ Toplu kişi eklenemedi:', error);
    res.status(500).json({ error: error.message });
  }
});

// Kişi sil
app.delete('/api/contacts/:id', async (req, res) => {
  try {
    const { id } = req.params;

    await pool.query('DELETE FROM contacts WHERE id = $1', [id]);

    console.log('✅ Kişi silindi:', id);
    res.json({ success: true });
  } catch (error) {
    console.error('❌ Kişi silinemedi:', error);
    res.status(500).json({ error: error.message });
  }
});

// ===== MESAJLAR API =====

// Mesaj ekle
app.post('/api/messages', async (req, res) => {
  try {
    const { contact_id, phone, message_text, template_name, status } = req.body;

    const result = await pool.query(
      `INSERT INTO messages (contact_id, phone, message_text, template_name, status) 
       VALUES ($1, $2, $3, $4, $5) 
       RETURNING *`,
      [contact_id || null, phone, message_text, template_name || null, status || 'pending']
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error('❌ Mesaj eklenemedi:', error);
    res.status(500).json({ error: error.message });
  }
});

// Mesajları listele
app.get('/api/messages', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;

    const result = await pool.query(
      `SELECT m.*, c.name as contact_name, c.phone as contact_phone
       FROM messages m
       LEFT JOIN contacts c ON m.contact_id = c.id
       ORDER BY m.created_at DESC
       LIMIT $1`,
      [limit]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('❌ Mesajlar yüklenemedi:', error);
    res.status(500).json({ error: error.message });
  }
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint bulunamadı' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('❌ Server Error:', err);
  res.status(500).json({ 
    error: 'Sunucu hatası',
    message: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

// Start server
app.listen(PORT, async () => {
  console.log(`🚀 WATI Proxy Server running on port ${PORT}`);
  console.log(`📡 Health check: http://localhost:${PORT}/health`);
  console.log(`🔗 PostgreSQL: ${process.env.POSTGRES_HOST}:${process.env.POSTGRES_PORT}/${process.env.POSTGRES_DB}`);
  
  // Test database connection
  try {
    const result = await pool.query('SELECT COUNT(*) FROM contacts');
    console.log(`✅ Database connected - ${result.rows[0].count} contacts`);
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
  }
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('👋 SIGTERM received, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('👋 SIGINT received, shutting down gracefully...');
  process.exit(0);
});

