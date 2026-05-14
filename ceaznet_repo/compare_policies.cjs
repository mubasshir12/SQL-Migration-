const fs = require('fs');

function getPolicies(file) {
  const text = fs.readFileSync(file, 'utf8');
  const policyRegex = /CREATE\s+POLICY\s+(?:IF\s+NOT\s+EXISTS\s+)?["']?([^"']+)["']?\s+ON\s+([a-zA-Z0-9_\.]+)/gi;
  const policies = [];
  let tMatch;
  while ((tMatch = policyRegex.exec(text)) !== null) {
      policies.push(`${tMatch[2].toLowerCase()} -> ${tMatch[1]}`);
  }
  return policies;
}

const p1 = getPolicies('p1.sql');
const p2 = getPolicies('p2.sql');

// Count unique policies in p1
const uniqueP1 = Array.from(new Set(p1));
console.log("P1 Unique Policies:", uniqueP1.length);
console.log("P2 Unique Policies:", Array.from(new Set(p2)).length);

// Compare
const missing = uniqueP1.filter(p => !p2.includes(p));
console.log("\nUnique Policies in P1 but not in P2:");
console.log(missing.join('\n'));

