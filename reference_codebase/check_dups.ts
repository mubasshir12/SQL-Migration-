import fs from 'fs';

async function processData() {
  const data = JSON.parse(fs.readFileSync('output.json', 'utf8'));
  const queries = data.sql_queries.sort((a,b) => a.createdAt - b.createdAt);
  
  const extractTables = (sql) => {
    const tables = new Set();
    const createMatches = sql.match(/CREATE TABLE\s+(?:IF NOT EXISTS\s+)?(?:public\.)?([a-zA-Z0-9_]+)/gi);
    if(createMatches) {
        createMatches.forEach(m => tables.add(m.split(' ').pop().replace('public.', '').toLowerCase()));
    }
    const alterMatches = sql.match(/ALTER TABLE\s+(?:IF NOT EXISTS\s+)?(?:public\.)?([a-zA-Z0-9_]+)/gi);
    if(alterMatches) {
        alterMatches.forEach(m => tables.add(m.split(' ').pop().replace('public.', '').toLowerCase()));
    }
    return Array.from(tables);
  };
  
  // Also collect all tasks for the user with title, id, and task number matching
  queries.forEach((q, idx) => {
    console.log(`Task ${idx + 1} | ID: ${q.id} | Title: ${q.title}`);
    console.log(`  Tables: ${extractTables(q.sql)}\n`);
  });
}

processData();
