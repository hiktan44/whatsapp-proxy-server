import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Supabase Config (server-side)
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_KEY || // backward-compat
  process.env.SUPABASE_SERVICE_KEY; // legacy name

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.warn(
    '⚠️ Supabase env eksik. Gerekli: SUPABASE_URL ve SUPABASE_SERVICE_ROLE_KEY (server-side).'
  );
}

const supabase = createClient(SUPABASE_URL || '', SUPABASE_SERVICE_ROLE_KEY || '', {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
});

// CORS - Tüm origin'lere izin ver (production'da spesifik domain kullanın)
const corsOrigins = (process.env.CORS_ORIGINS || '*')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: corsOrigins.length === 1 && corsOrigins[0] === '*' ? '*' : corsOrigins,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  })
);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// Health check
app.get('/health', async (req, res) => {
  try {
    // Test Supabase connection (head query)
    const { error, count } = await supabase
      .from('contacts')
      .select('id', { count: 'exact', head: true });

    if (error) throw error;

    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      database: 'connected',
      contacts_count: count ?? null,
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
      watiProxy: '/api/wati-proxy (POST)',
      contacts: '/api/contacts',
      messages: '/api/messages',
      campaigns: '/api/campaigns',
      templates: '/api/templates',
      settings: '/api/settings/:key',
      activities: '/api/activity-logs',
    }
  });
});

function toHttpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

function safeJson(value) {
  // Supabase jsonb alanları zaten JS objesi olabilir
  return value === undefined ? null : value;
}

// WATI API Proxy
app.post('/api/wati-proxy', async (req, res) => {
  try {
    const { action, data } = req.body;

    if (!action) {
      return res.status(400).json({ error: 'Action parametresi gerekli' });
    }

    console.log(`📡 WATI Proxy: ${action}`);

    // WATI API ayarlarını Supabase'den al
    const { data: rows, error: settingsError } = await supabase
      .from('settings')
      .select('key,value')
      .in('key', ['wati_api_key', 'wati_api_url']);

    if (settingsError) throw settingsError;

    const settings = {};
    (rows || []).forEach(row => {
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
      await supabase.from('activity_logs').insert({
        action: `wati_${action}`,
        details: safeJson({
          endpoint,
          method,
          status: watiResponse.status,
          success: watiResponse.ok,
          timestamp: new Date().toISOString(),
        }),
      });
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
    const from = offset;
    const to = Math.max(offset + limit - 1, offset);

    const { data, error } = await supabase
      .from('contacts')
      .select('*')
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) throw error;
    res.json(data || []);
  } catch (error) {
    console.error('❌ Kişiler yüklenemedi:', error);
    res.status(500).json({ error: error.message });
  }
});

// Kişi ekle
app.post('/api/contacts', async (req, res) => {
  try {
    const { name, phone, email, company, tags } = req.body;
    if (!name || !phone) throw toHttpError(400, 'name ve phone zorunludur');

    const { data, error } = await supabase
      .from('contacts')
      .insert({
        name,
        phone,
        email: email || null,
        company: company || null,
        tags: tags || [],
      })
      .select('*')
      .single();

    if (error) throw error;
    console.log('✅ Kişi eklendi:', phone);
    res.json(data);
  } catch (error) {
    console.error('❌ Kişi eklenemedi:', error);
    res.status(error.status || 500).json({ error: error.message });
  }
});

// Toplu kişi ekle
app.post('/api/contacts/bulk', async (req, res) => {
  try {
    const { contacts } = req.body;
    if (!Array.isArray(contacts)) throw toHttpError(400, 'contacts array olmalı');

    const payload = contacts.map(c => ({
      name: c.name,
      phone: c.phone,
      email: c.email || null,
      company: c.company || null,
      tags: c.tags || [],
    }));

    // phone unique => upsert
    const { data, error } = await supabase
      .from('contacts')
      .upsert(payload, { onConflict: 'phone' })
      .select('*');

    if (error) throw error;
    console.log(`✅ ${data?.length || 0} kişi eklendi`);
    res.json(data || []);
  } catch (error) {
    console.error('❌ Toplu kişi eklenemedi:', error);
    res.status(error.status || 500).json({ error: error.message });
  }
});

// Kişi güncelle
app.put('/api/contacts/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body || {};

    const { data, error } = await supabase
      .from('contacts')
      .update(updates)
      .eq('id', id)
      .select('*')
      .single();

    if (error) throw error;
    res.json(data);
  } catch (error) {
    console.error('❌ Kişi güncellenemedi:', error);
    res.status(error.status || 500).json({ error: error.message });
  }
});

// Kişi ara
app.get('/api/contacts/search', async (req, res) => {
  try {
    const q = String(req.query.q || '').trim();
    if (!q) return res.json([]);
    const like = `%${q}%`;

    const { data, error } = await supabase
      .from('contacts')
      .select('*')
      .or(`name.ilike.${like},phone.ilike.${like},email.ilike.${like},company.ilike.${like}`)
      .order('created_at', { ascending: false })
      .limit(200);

    if (error) throw error;
    res.json(data || []);
  } catch (error) {
    console.error('❌ Kişi arama hatası:', error);
    res.status(error.status || 500).json({ error: error.message });
  }
});

// Kişi sil
app.delete('/api/contacts/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { error } = await supabase.from('contacts').delete().eq('id', id);
    if (error) throw error;
    console.log('✅ Kişi silindi:', id);
    res.json({ success: true });
  } catch (error) {
    console.error('❌ Kişi silinemedi:', error);
    res.status(error.status || 500).json({ error: error.message });
  }
});

// ===== MESAJLAR API =====

// Mesaj ekle
app.post('/api/messages', async (req, res) => {
  try {
    const { contact_id, phone, message_text, template_name, status } = req.body;
    const { data, error } = await supabase
      .from('messages')
      .insert({
        contact_id: contact_id || null,
        phone,
        message_text,
        template_name: template_name || null,
        status: status || 'pending',
      })
      .select('*')
      .single();

    if (error) throw error;
    res.json(data);
  } catch (error) {
    console.error('❌ Mesaj eklenemedi:', error);
    res.status(error.status || 500).json({ error: error.message });
  }
});

// Mesaj durum güncelle
app.put('/api/messages/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, errorMessage } = req.body || {};

    const { data, error } = await supabase
      .from('messages')
      .update({ status, error_message: errorMessage || null })
      .eq('id', id)
      .select('*')
      .single();

    if (error) throw error;
    res.json(data);
  } catch (error) {
    console.error('❌ Mesaj durumu güncellenemedi:', error);
    res.status(error.status || 500).json({ error: error.message });
  }
});

// Mesajları listele
app.get('/api/messages', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const { data, error } = await supabase
      .from('messages')
      .select('*, contacts(name, phone)')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    res.json(data || []);
  } catch (error) {
    console.error('❌ Mesajlar yüklenemedi:', error);
    res.status(error.status || 500).json({ error: error.message });
  }
});

// ===== KAMPANYALAR API =====
app.get('/api/campaigns', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('campaigns')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    res.json(data || []);
  } catch (error) {
    console.error('❌ Kampanyalar yüklenemedi:', error);
    res.status(error.status || 500).json({ error: error.message });
  }
});

app.post('/api/campaigns', async (req, res) => {
  try {
    const payload = req.body || {};
    const { data, error } = await supabase.from('campaigns').insert(payload).select('*').single();
    if (error) throw error;
    res.json(data);
  } catch (error) {
    console.error('❌ Kampanya eklenemedi:', error);
    res.status(error.status || 500).json({ error: error.message });
  }
});

app.put('/api/campaigns/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body || {};
    const { data, error } = await supabase
      .from('campaigns')
      .update(updates)
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;
    res.json(data);
  } catch (error) {
    console.error('❌ Kampanya güncellenemedi:', error);
    res.status(error.status || 500).json({ error: error.message });
  }
});

// ===== ŞABLONLAR API =====
app.get('/api/templates', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('templates')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    res.json(data || []);
  } catch (error) {
    console.error('❌ Şablonlar yüklenemedi:', error);
    res.status(error.status || 500).json({ error: error.message });
  }
});

app.post('/api/templates', async (req, res) => {
  try {
    const payload = req.body || {};
    const { data, error } = await supabase.from('templates').insert(payload).select('*').single();
    if (error) throw error;
    res.json(data);
  } catch (error) {
    console.error('❌ Şablon eklenemedi:', error);
    res.status(error.status || 500).json({ error: error.message });
  }
});

app.put('/api/templates/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body || {};
    const { data, error } = await supabase
      .from('templates')
      .update(updates)
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;
    res.json(data);
  } catch (error) {
    console.error('❌ Şablon güncellenemedi:', error);
    res.status(error.status || 500).json({ error: error.message });
  }
});

app.delete('/api/templates/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { error } = await supabase.from('templates').delete().eq('id', id);
    if (error) throw error;
    res.json({ success: true });
  } catch (error) {
    console.error('❌ Şablon silinemedi:', error);
    res.status(error.status || 500).json({ error: error.message });
  }
});

// ===== AYARLAR API =====
app.get('/api/settings/:key', async (req, res) => {
  try {
    const { key } = req.params;
    const { data, error } = await supabase
      .from('settings')
      .select('key,value')
      .eq('key', key)
      .maybeSingle();
    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Ayar bulunamadı' });
    res.json(data);
  } catch (error) {
    console.error('❌ Ayar alınamadı:', error);
    res.status(error.status || 500).json({ error: error.message });
  }
});

app.put('/api/settings/:key', async (req, res) => {
  try {
    const { key } = req.params;
    const { value } = req.body || {};
    const { data, error } = await supabase
      .from('settings')
      .upsert({ key, value: safeJson(value) }, { onConflict: 'key' })
      .select('key,value')
      .single();
    if (error) throw error;
    res.json(data);
  } catch (error) {
    console.error('❌ Ayar kaydedilemedi:', error);
    res.status(error.status || 500).json({ error: error.message });
  }
});

// ===== AKTİVİTE LOG API =====
app.post('/api/activity-logs', async (req, res) => {
  try {
    const { action, details } = req.body || {};
    if (!action) throw toHttpError(400, 'action zorunludur');
    const { data, error } = await supabase
      .from('activity_logs')
      .insert({ action, details: safeJson(details || {}) })
      .select('*')
      .single();
    if (error) throw error;
    res.json(data);
  } catch (error) {
    console.error('❌ Aktivite eklenemedi:', error);
    res.status(error.status || 500).json({ error: error.message });
  }
});

app.get('/api/activity-logs', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const { data, error } = await supabase
      .from('activity_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    res.json(data || []);
  } catch (error) {
    console.error('❌ Aktiviteler yüklenemedi:', error);
    res.status(error.status || 500).json({ error: error.message });
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
  console.log(`🔗 Supabase URL: ${SUPABASE_URL || '(missing)'} (service role key: ${SUPABASE_SERVICE_ROLE_KEY ? 'set' : 'missing'})`);

  // Test database connection
  try {
    const { count, error } = await supabase
      .from('contacts')
      .select('id', { count: 'exact', head: true });
    if (error) throw error;
    console.log(`✅ Database connected - ${count ?? 0} contacts`);
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

