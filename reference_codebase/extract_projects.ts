import fs from 'fs';
const data = JSON.parse(fs.readFileSync('sql_export_latest.json', 'utf8'));
console.log('Keys of data:', Object.keys(data));
// Is there a projects array?
console.log('projects field:', typeof data.projects, data.projects?.length);
// print first few sql queries
console.log('Queries project IDs', data.sql_queries.map(q => q.projectId));


