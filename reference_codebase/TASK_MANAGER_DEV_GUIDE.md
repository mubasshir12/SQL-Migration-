# Guidelines for API / Task Manager Developer

This guide provides instructions to the developer maintaining the SQL Migration Task Manager backend (e.g. `sql-migration.vercel.app`) on how to handle Staging-to-Production merges properly.

## 1. Automatic Cleanup of Staging Projects on Merge
**Problem:** When a user merges their `[STAGING]` project into the main `Production` project, the staging project is left behind. This causes clutter, state drift, and confusion on subsequent edits.
**Requirement:** 
When the backend processes a "Merge staging to production" request, it must execute a cleanup routine.
- Once all tasks are successfully merged to the production project, **automatically delete the `[STAGING]` project** and its associated tasks.
- If deleting the project is too destructive, at the very least **clear all task records** within the `[STAGING]` project so it is a blank slate for the next iteration.

## 2. Merge as Modifications (Update) Rather Than New Creations
**Problem:** Currently, when an AI agent or a user modifies a task in staging and it gets merged, the backend creates a *new* separate task in the production project. It should just append or update the existing one.
**Requirement:**
- Introduce a mechanism to link staging tasks to production tasks (e.g. add a `parentTaskId` or `productionTaskId` column to the `tasks` schema).
- When a staging replica is created, clone the tasks and set their `productionTaskId` to point to the original.
- **Merge Logic Override:** During the merge, the backend should iterate over the staging tasks:
  * If `productionTaskId` exists: Execute an `UPDATE` on the original production task with the latest SQL/modifications.
  * If `productionTaskId` is null (the task was created freshly in staging): Execute an `INSERT` to create a new task in production.

## Pseudo-code Overview
```javascript
async function mergeStagingToProduction(stagingProjectId, prodProjectId) {
  const stagingTasks = await db.getTasksByProjectId(stagingProjectId);
  
  for (const task of stagingTasks) {
    if (task.productionTaskId) {
      // It's a modification of an existing task -> UDPATE
      await db.updateTask(task.productionTaskId, { content: task.content });
    } else {
      // It's a brand new task added during staging -> INSERT
      await db.createTask({ ...task, projectId: prodProjectId });
    }
  }

  // Final Step: Auto-delete the staging project to clean up
  await db.deleteProjectAndTasks(stagingProjectId);
}
```

Implement this at the API level so the AI Agent and Frontend consume it seamlessly.
