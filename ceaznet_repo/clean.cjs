const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabaseUrl = 'https://acnqtfkysglxoodkarpz.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFjbnF0Zmt5c2dseG9vZGthcnB6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgzMzU3NDYsImV4cCI6MjA5MzkxMTc0Nn0.GobYK6QLLCYOoyMimcQpBXIcxQGEmeDr-4DZGyigtKE';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const data = JSON.parse(fs.readFileSync('staging_tasks.json', 'utf8'));

  for (const task of data) {
    if (!task.sql) continue;
    
    // Remove lines that consists only of -- ===...===
    let newSql = task.sql.replace(/^--\s*=+[\r\n]?/gm, '');
    
    // Sometimes there's another format like `-- =======...`
    
    // Also remove empty comment lines that are just `-- ` 
    newSql = newSql.replace(/^--\s*$/gm, '');
    
    // Remove extra newlines created by deleting the separator lines
    newSql = newSql.replace(/\n{3,}/g, '\n\n');
    
    // Further trim to make sure
    newSql = newSql.trim();

    // If any changes made, update it
    if (newSql !== task.sql) {
      console.log('Updating task:', task.title);
      const { error } = await supabase
        .from('tasks')
        .update({ sql: newSql })
        .eq('id', task.id);
        
      if (error) {
        console.error('Error updating task', task.id, error);
      } else {
        console.log('✅ Updated', task.id);
      }
    }
  }
}

run();
