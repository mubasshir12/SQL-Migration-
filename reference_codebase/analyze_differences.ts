import * as fs from 'fs';

const extractDDL = (sql: string) => {
  const cleanSql = sql.replace(/--.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
  
  const tables = [...cleanSql.matchAll(/CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+([a-zA-Z0-9_\.]+)/gi)].map(m => m[1]);
  const functions = [...cleanSql.matchAll(/CREATE\s+OR\s+REPLACE\s+FUNCTION\s+([a-zA-Z0-9_\.]+)/gi)].map(m => m[1]);
  const policies = [...cleanSql.matchAll(/CREATE\s+POLICY\s+"([^"]+)"\s+ON\s+([a-zA-Z0-9_\.]+)/gi)].map(m => ({policy: m[1], table: m[2]}));
  const triggers = [...cleanSql.matchAll(/CREATE\s+TRIGGER\s+([a-zA-Z0-9_]+)\s+(BEFORE|AFTER)\s+(INSERT|UPDATE|DELETE)\s+ON\s+([a-zA-Z0-9_\.]+)/gi)].map(m => m[1]);
  const extensions = [...cleanSql.matchAll(/CREATE\s+EXTENSION\s+IF\s+NOT\s+EXISTS\s+"?([a-zA-Z0-9_-]+)"?/gi)].map(m => m[1]);
  const events = [...cleanSql.matchAll(/CREATE\s+EVENT\s+TRIGGER\s+([a-zA-Z0-9_]+)/gi)].map(m => m[1]);

  return { tables: [...new Set(tables)], functions: [...new Set(functions)], policies, triggers: [...new Set(triggers)], extensions: [...new Set(extensions)], events: [...new Set(events)] };
};

const top9 = fs.readFileSync('top9.sql', 'utf8');
const rest = fs.readFileSync('rest.sql', 'utf8');

const t9 = extractDDL(top9);
const r = extractDDL(rest);

console.log('--- top9 vs rest ---');
console.log('Top9 tables:', t9.tables.length, t9.tables.join(', '));
console.log('Rest tables:', r.tables.length, r.tables.join(', '));
const missingTables = r.tables.filter(table => !t9.tables.includes(table));
console.log('Missing tables in Top9:', missingTables.join(', '));

console.log('\nTop9 functions:', t9.functions.length, t9.functions.join(', '));
console.log('Rest functions:', r.functions.length, r.functions.join(', '));
const missingFunctions = r.functions.filter(f => !t9.functions.includes(f));
console.log('Missing functions in Top9:', missingFunctions.join(', '));

console.log('\nTop9 extensions:', t9.extensions.join(', '));
console.log('Rest extensions:', r.extensions.join(', '));
const missingExtensions = r.extensions.filter(e => !t9.extensions.includes(e));
console.log('Missing extensions in Top9:', missingExtensions.join(', '));

console.log('\nTop9 triggers:', t9.triggers.join(', '));
console.log('Rest triggers:', r.triggers.join(', '));

console.log('\nTop9 events:', t9.events.join(', '));
console.log('Rest events:', r.events.join(', '));

// Output detailed diff
fs.writeFileSync('diff_report.json', JSON.stringify({t9, r, missingTables, missingFunctions, missingExtensions}, null, 2));
