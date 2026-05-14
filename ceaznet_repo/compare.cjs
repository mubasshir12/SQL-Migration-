const fs = require('fs');

function getUniqueItems(file) {
  const text = fs.readFileSync(file, 'utf8');
  
  const tableRegex = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([a-zA-Z0-9_\.]+)/gi;
  const tables = new Set();
  let tMatch;
  while ((tMatch = tableRegex.exec(text)) !== null) {
      tables.add(tMatch[1].toLowerCase());
  }
  
  const funcRegex = /CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+([a-zA-Z0-9_\.]+)/gi;
  const funcs = new Set();
  let fMatch;
  while ((fMatch = funcRegex.exec(text)) !== null) {
      funcs.add(fMatch[1].toLowerCase());
  }

  return { tables: Array.from(tables).sort(), funcs: Array.from(funcs).sort() };
}

const p1 = getUniqueItems('p1.sql');
const p2 = getUniqueItems('p2.sql');

console.log("P1 Tables:", p1.tables.length);
console.log(p1.tables.join(', '));
console.log("\P2 Tables:", p2.tables.length);
console.log(p2.tables.join(', '));

const missingTables = p1.tables.filter(t => !p2.tables.includes(t));
const extraTables = p2.tables.filter(t => !p1.tables.includes(t));
console.log("\nTables in P1 but not in P2:", missingTables);
console.log("Tables in P2 but not in P1:", extraTables);

console.log("\nP1 Functions:", p1.funcs.length);
console.log(p1.funcs.join(', '));
console.log("\nP2 Functions:", p2.funcs.length);
console.log(p2.funcs.join(', '));

const missingFuncs = p1.funcs.filter(t => !p2.funcs.includes(t));
const extraFuncs = p2.funcs.filter(t => !p1.funcs.includes(t));
console.log("\nFunctions in P1 but not in P2:", missingFuncs);
console.log("Functions in P2 but not in P1:", extraFuncs);
