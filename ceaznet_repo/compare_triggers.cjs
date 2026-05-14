const fs = require('fs');
function getTriggers(file) {
  const text = fs.readFileSync(file, 'utf8');
  const trigRegex = /CREATE\s+TRIGGER\s+([a-zA-Z0-9_\.]+)/gi;
  const trigs = [];
  let match;
  while ((match = trigRegex.exec(text)) !== null) {
      trigs.push(match[1]);
  }
  return trigs;
}
console.log("P1 Triggers:", getTriggers('p1.sql'));
console.log("P2 Triggers:", getTriggers('p2.sql'));
