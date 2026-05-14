const fs = require('fs');

try {
  const data = JSON.parse(fs.readFileSync('sql_export_latest.json', 'utf8'));
  const projects = {};
  
  if (Array.isArray(data)) {
    data.forEach(item => {
      const proj = item.project_name || 'unknown';
      if (!projects[proj]) projects[proj] = 0;
      projects[proj]++;
    });
  } else if (data.projects) {
    Object.keys(data.projects).forEach(proj => {
      projects[proj] = data.projects[proj].length;
    });
  }
  
  console.log(JSON.stringify(projects, null, 2));
} catch (e) {
  console.error(e);
}
