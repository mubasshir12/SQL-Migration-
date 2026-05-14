const fs = require('fs');
const opt = require('./optimized.json');
const c = require('./ceaznet.json');

function analyze(queries) {
    const allSql = queries.map(q => q?.sql || '').join('\n');
    
    const tables = [...allSql.matchAll(/CREATE\s+(?:TABLE|TABLE\s+IF\s+NOT\s+EXISTS)\s+(?:public\.)?([a-zA-Z0-9_]+)/gi)].map(m => m[1]);
    const features = {
        tableCount: [...new Set(tables)].length,
        tables: [...new Set(tables)],
        policies: [...allSql.matchAll(/CREATE\s+POLICY\s+"([^"]+)"|CREATE\s+POLICY\s+([a-zA-Z0-9_]+)/gi)].map(m => m[1] || m[2]),
        functions: [...allSql.matchAll(/CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+(?:public\.)?([a-zA-Z0-9_]+)/gi)].map(m => m[1]),
        triggers: [...allSql.matchAll(/CREATE\s+(?:OR\s+REPLACE\s+)?TRIGGER\s+([a-zA-Z0-9_]+)/gi)].map(m => m[1]),
        events: [...allSql.matchAll(/select\s+cron\.schedule\('([^']+)'/gi)].map(m => m[1]),
        extensions: [...allSql.matchAll(/CREATE\s+EXTENSION\s+(?:IF\s+NOT\s+EXISTS\s+)?([a-zA-Z0-9_]+)/gi)].map(m => m[1])
    };
    return features;
}

const optAnalysis = analyze(opt);
const cAnalysis = analyze(c);

fs.writeFileSync('analysis.json', JSON.stringify({
    optimized: optAnalysis,
    ceaznet: cAnalysis
}, null, 2));

console.log("Analysis saved to analysis.json");
