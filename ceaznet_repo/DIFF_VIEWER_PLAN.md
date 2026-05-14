# Task Manager Diff Viewer Implementation Guide

This guide gives you the exact blueprint to build a side-by-side **Staging vs. Production Diff Viewer** in your existing React application (`src/App.tsx`).

## 1. Overview of the Flow

1. User is in a `[STAGING]` project.
2. User opens the "More Menu" (bottom-right) and clicks **"Review Changes"** (new button above "Merge to Prod").
3. We fetch all tasks from `[STAGING]` and the associated `Production` project.
4. We match tasks using `production_task_id` (which was linked during cloning).
5. A full-screen Modal opens showing a "File Explorer" style sidebar with modified/added/deleted tasks.
6. The main view uses `react-diff-viewer-continued` to show side-by-side (desktop) or unified (mobile) diffs of the SQL or Edge Function files.

## 2. Dependencies

First, install the differ library in your `Task Manager` repository:
```bash
npm install react-diff-viewer-continued
```
*(Optionally install `lucide-react` if you need icons like `Diff`, `GitCommit`, but you already have it).*

## 3. Data Matching Logic

When you clone a replica (in your `App.tsx`), you do this:
```ts
production_task_id: t.id // Original production ID saved in staging task
```
So comparing is simple:
- **Modified**: A staging task has `production_task_id = <id>` and its SQL/Code differs from the production task with that `<id>`.
- **Added**: A staging task has `production_task_id = null` (Brand new).
- **Deleted**: A production task's ID does not exist in any staging task's `production_task_id`.

## 4. UI Implementation Details

### Step A: The Diff Component (`src/components/DiffViewerModal.tsx`)

Create a new file for the modal. Here is the skeletal structure based on your existing styling conventions:

```tsx
import React, { useState, useEffect } from 'react';
import ReactDiffViewer, { DiffMethod } from 'react-diff-viewer-continued';
import { X, Plus, Trash, Edit3, Code } from 'lucide-react';

// Props needed: stagingTasks, productionTasks, onClose, isDarkTheme
export default function DiffViewerModal({ stagingTasks, prodTasks, onClose, isDarkTheme }) {
  const [selectedTaskDiff, setSelectedTaskDiff] = useState(null);
  const [selectedEdgeFile, setSelectedEdgeFile] = useState(0);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  // Resize listener for responsive splitting
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Compute Diffs
  const differences = React.useMemo(() => {
    const diffs = [];
    
    stagingTasks.forEach(st => {
      if (!st.production_task_id) {
         diffs.push({ type: 'added', staging: st, prod: null, title: st.title });
         return;
      }
      const prodTask = prodTasks.find(pt => pt.id === st.production_task_id);
      if (!prodTask) return; 
      
      let changed = false;
      if (st.type === 'sql' && st.sql !== prodTask.sql) changed = true;
      if (st.type === 'edge_function' && JSON.stringify(st.edgeFiles) !== JSON.stringify(prodTask.edgeFiles)) changed = true;
      
      if (changed) diffs.push({ type: 'modified', staging: st, prod: prodTask, title: st.title });
    });

    const stagingSourceIds = stagingTasks.map(st => st.production_task_id).filter(Boolean);
    prodTasks.forEach(pt => {
      if (!stagingSourceIds.includes(pt.id)) {
         diffs.push({ type: 'deleted', staging: null, prod: pt, title: pt.title });
      }
    });

    return diffs;
  }, [stagingTasks, prodTasks]);

  useEffect(() => {
     if (differences.length > 0 && !selectedTaskDiff) setSelectedTaskDiff(differences[0]);
  }, [differences]);

  if (differences.length === 0) {
    return (
       <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
         <div className="bg-white dark:bg-[#0f0f0f] p-8 rounded-xl text-center shadow-2xl">
            <h2 className="text-xl font-bold mb-4 text-slate-800 dark:text-slate-100">No Changes Detected</h2>
            <p className="text-slate-600 dark:text-slate-400 mb-6">Staging and Production are identical.</p>
            <button onClick={onClose} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors">Close</button>
         </div>
       </div>
    );
  }

  const renderDiffViewer = () => {
    if (!selectedTaskDiff) return null;
    const { type, staging, prod } = selectedTaskDiff;

    if (type === 'added') return <div className="p-4 text-green-600 dark:text-green-400 font-mono text-sm overflow-auto whitespace-pre-wrap">{staging.sql || JSON.stringify(staging.edgeFiles, null, 2)}</div>;
    if (type === 'deleted') return <div className="p-4 text-red-600 dark:text-red-400 font-mono text-sm overflow-auto whitespace-pre-wrap">{prod.sql || JSON.stringify(prod.edgeFiles, null, 2)}</div>;

    // SQL DIFFERENCE
    if (staging.type === 'sql') {
       return (
         <ReactDiffViewer
           oldValue={prod.sql || ''}
           newValue={staging.sql || ''}
           splitView={!isMobile} // Side-by-side on desktop, unified on mobile
           compareMethod={DiffMethod.WORDS}
           useDarkTheme={isDarkTheme}
         />
       );
    }

    // EDGE FUNCTION FILES
    if (staging.type === 'edge_function') {
      const pFiles = prod.edgeFiles || [];
      const sFiles = staging.edgeFiles || [];
      return (
        <div className="flex flex-col h-full">
           <div className="flex gap-2 p-2 border-b border-slate-200 dark:border-[#2a2a2a] overflow-x-auto bg-slate-50 dark:bg-[#121212]">
             {sFiles.map((file, i) => (
                <button
                  key={file.id}
                  onClick={() => setSelectedEdgeFile(i)}
                  className={\`px-3 py-1.5 text-sm font-medium rounded-md transition-colors \${selectedEdgeFile === i ? 'bg-blue-600 text-white shadow-sm' : 'bg-white dark:bg-[#1e1e1e] border border-slate-200 dark:border-[#333] hover:bg-slate-100 dark:hover:bg-[#2a2a2a]'}\`}
                >{file.name}</button>
             ))}
           </div>
           <div className="flex-1 overflow-auto">
             {sFiles[selectedEdgeFile] && (
               <ReactDiffViewer
                 oldValue={pFiles.find(f => f.name === sFiles[selectedEdgeFile].name)?.code || ''}
                 newValue={sFiles[selectedEdgeFile].code}
                 splitView={!isMobile}
                 compareMethod={DiffMethod.WORDS}
                 useDarkTheme={isDarkTheme}
               />
             )}
           </div>
        </div>
      );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex bg-white/50 dark:bg-black/80 backdrop-blur-sm p-0 md:p-8 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-[#0a0a0a] border border-slate-200 dark:border-[#1a1a1a] shadow-2xl rounded-none md:rounded-xl w-full h-full flex flex-col md:flex-row overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Sidebar */}
        <div className="w-full h-1/3 md:h-full md:w-72 border-b md:border-b-0 md:border-r border-slate-200 dark:border-[#2a2a2a] flex flex-col bg-slate-50/50 dark:bg-[#111]">
           <div className="p-4 font-bold border-b border-slate-200 dark:border-[#2a2a2a] flex justify-between items-center text-slate-900 dark:text-slate-100 bg-white dark:bg-[#151515]">
             Changes ({differences.length})
             <button onClick={onClose} className="md:hidden p-1.5 hover:bg-slate-100 dark:hover:bg-[#222] rounded-full transition-colors"><X size={18} /></button>
           </div>
           <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
             {differences.map((d, i) => (
               <button 
                 key={i}
                 onClick={() => { setSelectedTaskDiff(d); setSelectedEdgeFile(0); }}
                 className={\`w-full text-left px-3 py-2.5 text-sm rounded-lg flex items-center gap-2.5 font-medium transition-colors \${
                   selectedTaskDiff === d 
                     ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-900 dark:text-blue-100 shadow-sm' 
                     : 'text-slate-700 dark:text-slate-300 hover:bg-white dark:hover:bg-[#222] border border-transparent hover:border-slate-200 dark:hover:border-[#333]'
                 }\`}
               >
                 {d.type === 'added' && <Plus size={16} className="text-emerald-500 shrink-0"/>}
                 {d.type === 'deleted' && <Trash size={16} className="text-red-500 shrink-0"/>}
                 {d.type === 'modified' && <Edit3 size={16} className="text-blue-500 shrink-0"/>}
                 <span className="truncate">{d.title}</span>
               </button>
             ))}
           </div>
        </div>

        {/* Diff View Area */}
        <div className="flex-1 flex flex-col min-w-0 bg-[#fafafa] dark:bg-[#0a0a0a]">
           <div className="p-4 border-b border-slate-200 dark:border-[#2a2a2a] flex justify-between items-center bg-white dark:bg-[#0f0f0f] shadow-sm z-10">
             <div className="flex items-center gap-3 overflow-hidden pr-4">
                {selectedTaskDiff?.type === 'added' && <span className="px-2 py-0.5 text-xs font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 rounded">ADDED</span>}
                {selectedTaskDiff?.type === 'deleted' && <span className="px-2 py-0.5 text-xs font-semibold bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 rounded">DELETED</span>}
                {selectedTaskDiff?.type === 'modified' && <span className="px-2 py-0.5 text-xs font-semibold bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 rounded">MODIFIED</span>}
                <span className="font-semibold truncate text-slate-800 dark:text-slate-200">{selectedTaskDiff?.title}</span>
             </div>
             <button onClick={onClose} className="hidden md:flex p-2 items-center gap-2 text-sm font-medium hover:bg-slate-100 dark:hover:bg-[#222] rounded-lg text-slate-600 dark:text-slate-400 transition-colors">
                <X size={18}/> Close
             </button>
           </div>
           <div className="flex-1 overflow-auto">
             {renderDiffViewer()}
           </div>
        </div>
      </div>
    </div>
  );
}
```

### Step B: Integration in `src/App.tsx`

**1. Import and setup new state at the top of `App.tsx`**

```tsx
import DiffViewerModal from './components/DiffViewerModal';
import { Copy, Plus, Menu, X, Trash2, Pencil, LayoutGrid, List, CheckSquare, Search, Command, CheckCircle2, AlertCircle, Sparkles, FolderOpen, Code } from 'lucide-react'; // Remember to import Code

// Inside App component:
const [isDiffViewerOpen, setIsDiffViewerOpen] = useState(false);
const [prodTasksForDiff, setProdTasksForDiff] = useState<SqlTask[]>([]);
const [stagingTasksForDiff, setStagingTasksForDiff] = useState<SqlTask[]>([]);
const [isCheckingDiff, setIsCheckingDiff] = useState(false);
```

**2. Add the action function near your existing `handleMergeToProduction` function:**

```tsx
  const handleOpenDiffViewer = async () => {
    const activeProjectObj = projects.find(p => p.id === selectedProjectId);
    if (!activeProjectObj) return;

    setIsCheckingDiff(true);
    const toastId = toast.loading("Fetching projects to compare...");
    
    try {
      // Find the parent production project to compare against
      const originalName = activeProjectObj.name.replace(' [STAGING]', '');
      const productionProject = projects.find(p => p.name === originalName && !p.name.endsWith(' [STAGING]'));
      
      if (!productionProject) {
         toast.error("Could not find the original production project to compare with.", { id: toastId });
         return;
      }

      // Fetch the actual exported tasks for robust comparison
      const [prodRes, stgRes] = await Promise.all([
        fetch(\`/export.json?projectId=\${productionProject.id}&api_key=sk_sync_b4k92jdm10\`),
        fetch(\`/export.json?projectId=\${activeProjectObj.id}&api_key=sk_sync_b4k92jdm10\`)
      ]);

      const pData = await prodRes.json();
      const sData = await stgRes.json();

      setProdTasksForDiff([ ...(pData.sql_queries || []), ...(pData.edge_functions || []) ]);
      setStagingTasksForDiff([ ...(sData.sql_queries || []), ...(sData.edge_functions || []) ]);
      
      toast.dismiss(toastId);
      setIsDiffViewerOpen(true);
    } catch(err) {
       console.error("Diff fetch error:", err);
       toast.error("Failed to load changes", { id: toastId });
    } finally {
       setIsCheckingDiff(false);
    }
  };
```

**3. Inject the Button into the More Menu**
Find your existing `{isMoreMenuOpen && (...)}` block inside `App.tsx` and place this right above `<button onClick={handleMergeToProduction}...>`:

```tsx
{selectedProjectId && projects.find(p => p.id === selectedProjectId)?.name.endsWith(' [STAGING]') && (
  <>
    <button
      onClick={() => {
        handleOpenDiffViewer();
        setIsMoreMenuOpen(false);
      }}
      disabled={isCheckingDiff}
      className="w-full text-left px-3 py-2 text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors flex items-center gap-2 font-medium"
    >
      <Code size={14} />
      {isCheckingDiff ? 'Loading Diff...' : 'Review Changes'}
    </button>
    <button
      onClick={() => {
        handleMergeToProduction();
        setIsMoreMenuOpen(false);
      }}
      disabled={isMerging}
      className="w-full text-left px-3 py-2 text-sm text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 transition-colors flex items-center gap-2 font-medium"
    >
      <Copy size={14} />
      {isMerging ? 'Merging...' : 'Merge to Prod'}
    </button>
  </>
)}
```

**4. Drop the Modal into your Render cycle**
Place this near the very bottom of the `App.tsx` return statement, right before `<Toaster />`:

```tsx
{isDiffViewerOpen && (
   <DiffViewerModal 
      stagingTasks={stagingTasksForDiff}
      prodTasks={prodTasksForDiff}
      isDarkTheme={theme === 'dark'}
      onClose={() => setIsDiffViewerOpen(false)}
   />
)}
```

## Extra Notes
By relying on `production_task_id`, the differ works beautifully. If a user deletes a task, it spots the missing pointer. For Edge Functions, it intelligently builds tabs for each file and diffs them inside the modal. The modal automatically responds layout-wise: showing a split view on Desktop and unifying lines on Mobile.
