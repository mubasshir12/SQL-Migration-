async function run() {
  const data = await fetch('https://sql-migration.vercel.app/export.json', { headers: { 'x-api-key': 'sk_sync_b4k92jdm10' } }).then(res=>res.json());
  const t = data.sql_queries || [];
  t.forEach((x, i) => {
    console.log(`Task ${t.length - i} [${new Date(x.createdAt).toISOString()}]: ${x.title}`);
  });
}
run();
