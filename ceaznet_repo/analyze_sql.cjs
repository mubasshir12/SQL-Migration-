const fs = require('fs');

function countOccurrences(text, regex) {
  let count = 0;
  let match;
  while ((match = regex.exec(text)) !== null) {
    count++;
  }
  return count;
}

function analyze(file, label) {
  const text = fs.readFileSync(file, 'utf8');
  console.log(`\n=== Analysis of ${label} (${file}) ===`);
  console.log('Total characters:', text.length);
  console.log('CREATE TABLE:', countOccurrences(text, /CREATE\s+TABLE/gi));
  console.log('ALTER TABLE:', countOccurrences(text, /ALTER\s+TABLE/gi));
  console.log('CREATE OR REPLACE FUNCTION:', countOccurrences(text, /CREATE\s+OR\s+REPLACE\s+FUNCTION|CREATE\s+FUNCTION/gi));
  console.log('CREATE TRIGGER:', countOccurrences(text, /CREATE\s+TRIGGER/gi));
  console.log('CREATE EVENT TRIGGER:', countOccurrences(text, /CREATE\s+EVENT\s+TRIGGER/gi));
  console.log('CREATE POLICY:', countOccurrences(text, /CREATE\s+POLICY/gi));
  console.log('ROW LEVEL SECURITY:', countOccurrences(text, /ROW\s+LEVEL\s+SECURITY/gi));
  console.log('CREATE EXTENSION:', countOccurrences(text, /CREATE\s+EXTENSION/gi));
  
  // extract table names
  const tableRegex = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([a-zA-Z0-9_\.]+)/gi;
  const tables = [];
  let tMatch;
  while ((tMatch = tableRegex.exec(text)) !== null) {
      if (!tables.includes(tMatch[1])) tables.push(tMatch[1]);
  }
  console.log('Tables created:', tables.length);
  // extract functions
  const funcRegex = /CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+([a-zA-Z0-9_\.]+)/gi;
  const funcs = [];
  let fMatch;
  while ((fMatch = funcRegex.exec(text)) !== null) {
      if (!funcs.includes(fMatch[1])) funcs.push(fMatch[1]);
  }
  console.log('Functions created/replaced:', funcs.length);
}

analyze('p1.sql', 'Old Ceaznet (61 queries)');
analyze('p2.sql', 'Ceaznet (9 queries)');
