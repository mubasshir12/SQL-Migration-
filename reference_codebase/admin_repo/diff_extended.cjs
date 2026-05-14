const fs = require('fs');

const oldQ = JSON.parse(fs.readFileSync('old_queries.json', 'utf8'));
const newQ = JSON.parse(fs.readFileSync('new_queries.json', 'utf8'));

function ext(queries) {
  const triggers = new Set();
  const policies = new Set();
  const views = new Set();
  
  queries.forEach(q => {
    const sql = q.sql.toLowerCase();
    
    // Extract triggers
    const trigMatches = sql.matchAll(/create\s+trigger\s+([a-z0-9_.\"']+)/g);
    for (const match of trigMatches) {
      triggers.add(match[1].replace(/\"/g, ''));
    }
    
    // Extract policies
    const polMatches = sql.matchAll(/create\s+policy\s+([a-z0-9_.\"']+)\s+on\s+([a-z0-9_.\"']+)/g);
    for (const match of polMatches) {
      policies.add(match[1].replace(/\"/g, '') + ' ON ' + match[2].replace(/\"/g, '').replace('public.', ''));
    }
    
    // Extract views
    const viewMatches = sql.matchAll(/create\s+(?:or\s+replace\s+)?view\s+([a-z0-9_.\"']+)/g);
    for (const match of viewMatches) {
      views.add(match[1].replace(/\"/g, '').replace('public.', ''));
    }
  });
  
  return { 
    triggers: Array.from(triggers).sort(), 
    policies: Array.from(policies).sort(),
    views: Array.from(views).sort()
  };
}

const oldInfo = ext(oldQ);
const newInfo = ext(newQ);

console.log('--- DIFF ---');
console.log('Missing Triggers:\n', oldInfo.triggers.filter(t => !newInfo.triggers.includes(t)));
console.log('Missing Policies:\n', oldInfo.policies.filter(t => !newInfo.policies.includes(t)));
console.log('Missing Views:\n', oldInfo.views.filter(t => !newInfo.views.includes(t)));
console.log('Extra Triggers:\n', newInfo.triggers.filter(t => !oldInfo.triggers.includes(t)));
console.log('Extra Policies:\n', newInfo.policies.filter(t => !oldInfo.policies.includes(t)));
console.log('Extra Views:\n', newInfo.views.filter(t => !oldInfo.views.includes(t)));
