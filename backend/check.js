const { Client } = require('pg');
const bcrypt = require('bcrypt');
const client = new Client({ connectionString: 'postgresql://postgres:Luis12hadoop_@db.roagcobxobamewlcvnee.supabase.co:5432/postgres' });
client.connect().then(async () => {
  const res = await client.query("SELECT password_hash FROM usuarios WHERE email = 'admin@tupos.com'");
  const hash = res.rows[0].password_hash;
  
  const passwords = ['admin123', 'Admin123', '123456', 'password', 'super123', 'admin', 'tupos123', 'saas123', 'Admin@123', 'luis123'];
  for (const p of passwords) {
    const match = await bcrypt.compare(p, hash);
    if (match) console.log('✅ PASSWORD FOUND:', p);
  }
  console.log('Done checking');
  client.end();
});
