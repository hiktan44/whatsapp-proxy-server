import pg from 'pg';
const { Client } = pg;

const ports = [5432, 54321, 6543, 5433];
const users = ['supabase_admin', 'postgres', 'coolify'];
const password = 'b9P15yK8JKXgAeXdGpPU93SKgsXFJjQn';

console.log('🔍 PostgreSQL bağlantı testi başlıyor...\n');

for (const port of ports) {
  for (const user of users) {
    console.log(`Testing ${user}@65.108.77.26:${port}`);
    const client = new Client({
      host: '65.108.77.26',
      port: port,
      database: 'postgres',
      user: user,
      password: password,
      connectionTimeoutMillis: 3000,
    });

    try {
      await client.connect();
      console.log(`✅ BAŞARILI! ${user}@65.108.77.26:${port}\n`);
      const result = await client.query('SELECT current_user, current_database()');
      console.log('   Kullanıcı:', result.rows[0].current_user);
      console.log('   Database:', result.rows[0].current_database);
      await client.end();
      process.exit(0);
    } catch (error) {
      console.log(`   ❌ ${error.message}`);
    }
  }
}

console.log('\n❌ Hiçbir kombinasyon çalışmadı.');
console.log('\n📋 Coolify\'da kontrol edin:');
console.log('   1. Database > Configuration > Ports');
console.log('   2. PostgreSQL portu public mu?');
console.log('   3. Firewall kuralları doğru mu?');
process.exit(1);
