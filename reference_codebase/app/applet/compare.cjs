const fs = require('fs');

const extractInfo = (sqlString) => {
    // Basic regexes
    const tables = [...sqlString.matchAll(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:public\.)?\"?([a-zA-Z0-9_]+)\"?/gi)]
                    .map(m => m[1].toLowerCase())
                    .filter(t => t !== 'create' && t !== 'for'); // filter out false positives
    const alters = [...sqlString.matchAll(/ALTER\s+TABLE\s+(?:public\.)?\"?([a-zA-Z0-9_]+)\"?/gi)].map(m => m[1].toLowerCase());
    const policies = [...sqlString.matchAll(/CREATE\s+POLICY\s+\"?([a-zA-Z0-9_\s-]+)\"?/gi)].map(m => m[1]);
    const rlsEnables = [...sqlString.matchAll(/ALTER\s+TABLE\s+(?:public\.)?\"?([a-zA-Z0-9_]+)\"?\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY/gi)].map(m=>m[1]);
    const funcs = [...sqlString.matchAll(/CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+(?:public\.)?\"?([a-zA-Z0-9_]+)\"?/gi)].map(m => m[1]);
    const triggers = [...sqlString.matchAll(/CREATE\s+(?:OR\s+REPLACE\s+)?TRIGGER\s+\"?([a-zA-Z0-9_]+)\"?/gi)].map(m => m[1]);
    const cronEvents = [...sqlString.matchAll(/cron\.schedule\(/gi)].length;
    const exts = [...sqlString.matchAll(/CREATE\s+EXTENSION\s+(?:IF\s+NOT\s+EXISTS\s+)?\"?([a-zA-Z0-9_]+)\"?/gi)].map(m => m[1]);
    
    return {
        tableCount: [...new Set(tables)].length,
        tables: [...new Set(tables)].sort(),
        alterCount: alters.length,
        policyCount: policies.length,
        rlsCount: [...new Set(rlsEnables)].length,
        funcCount: [...new Set(funcs)].length,
        triggerCount: [...new Set(triggers)].length,
        cronEvents,
        extCount: [...new Set(exts)].length
    }
};

const opt = require('./optimized.json');
const ceaz = require('./ceaznet.json');

const optSql = opt.map(q => q.sql).join('\n\n');
const ceazSql = ceaz.map(q => q.sql).join('\n\n');

const optInfo = extractInfo(optSql);
const ceazInfo = extractInfo(ceazSql);

let out = '======= TABLES =======\n';
out += 'Optimized: ' + optInfo.tableCount + ' ' + optInfo.tables.join(', ') + '\n';
out += 'Ceaznet:   ' + ceazInfo.tableCount + ' ' + ceazInfo.tables.join(', ') + '\n';

out += '\n======= ALTER TABLES =======\n';
out += 'Optimized: ' + optInfo.alterCount + '\n';
out += 'Ceaznet:   ' + ceazInfo.alterCount + '\n';

out += '\n======= POLICIES =======\n';
out += 'Optimized: ' + optInfo.policyCount + '\n';
out += 'Ceaznet:   ' + ceazInfo.policyCount + '\n';

out += '\n======= RLS ENABLED TABLES =======\n';
out += 'Optimized: ' + optInfo.rlsCount + '\n';
out += 'Ceaznet:   ' + ceazInfo.rlsCount + '\n';

out += '\n======= FUNCTIONS =======\n';
out += 'Optimized: ' + optInfo.funcCount + '\n';
out += 'Ceaznet:   ' + ceazInfo.funcCount + '\n';

out += '\n======= TRIGGERS =======\n';
out += 'Optimized: ' + optInfo.triggerCount + '\n';
out += 'Ceaznet:   ' + ceazInfo.triggerCount + '\n';

out += '\n======= CRON EVENTS =======\n';
out += 'Optimized: ' + optInfo.cronEvents + '\n';
out += 'Ceaznet:   ' + ceazInfo.cronEvents + '\n';

out += '\n======= EXTENSIONS =======\n';
out += 'Optimized: ' + optInfo.extCount + '\n';
out += 'Ceaznet:   ' + ceazInfo.extCount + '\n';

fs.writeFileSync('compare_results.txt', out);
