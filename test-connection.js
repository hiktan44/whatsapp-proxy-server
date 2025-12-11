import pg from 'pg';
const { Client } = pg;

// Test 1: supabase_admin
console.log('\n🔍 Test 1: supabase_admin kullanıcısı');
const client1 = new Client({
  host: '65.108.77.26',
  port: 5432,
  database: 'postgres',
  user: 'supabase_admin',
  password: 'b9P15yK8JKXgAeXdGpPU93SKgsXFJjQn',
});

try {
  await client1.connect();
  console.log('✅ Bağlantı başarılı!');
  const result = await client1.query('SELECT current_user, version()');
  console.log('👤 Kullanıcı:', result.rows[0].current_user);
  await client1.end();
} catch (error) {
  console.error('❌ Hata:', error.message);
}

// Test 2: coolify kullanıcısı
console.log('\n🔍 Test 2: coolify kullanıcısı');
const client2 = new Client({
  host: '65.108.77.26',
  port: 5432,
  database: 'postgres',
  user: 'coolify',
  password: 'b9P15yK8JKXgAeXdGpPU93SKgsXFJjQn',
});

try {
  await client2.connect();
  console.log('✅ Bağlantı başarılı!');
  const result = await client2.query('SELECT current_user, version()');
  console.log('👤 Kullanıcı:', result.rows[0].current_user);
  await client2.end();
} catch (error) {
  console.error('❌ Hata:', error.message);
}

// Test 3: postgres kullanıcısı
console.log('\n🔍 Test 3: postgres kullanıcısı');
const client3 = new Client({
  host: '65.108.77.26',
  port: 5432,
  database: 'postgres',
  user: 'postgres',
  password: 'b9P15yK8JKXgAeXdGpPU93SKgsXFJjQn',
});

try {
  await client3.connect();
  console.log('✅ Bağlantı başarılı!');
  const result = await client3.query('SELECT current_user, version()');
  console.log('👤 Kullanıcı:', result.rows[0].current_user);
  await client3.end();
} catch (error) {
  console.error('❌ Hata:', error.message);
}

process.exit(0);
