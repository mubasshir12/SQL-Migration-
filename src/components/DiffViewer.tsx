import React, { useEffect, useState } from 'react';
import ReactDiffViewer from 'react-diff-viewer-continued';
import { FileCode, Database, CheckSquare, Plus, Trash2, Pencil, ChevronLeft, Columns, AlignLeft, ArrowRight } from 'lucide-react';
import { cn } from '../lib/utils';
import { SqlTask } from '../types';
import { useLocalStorage } from '../hooks/useLocalStorage';

interface DiffViewerProps {
  stagingProjectId: string;
  prodProjectId: string;
  theme: "light" | "dark";
  onClose: () => void;
  onMerge: () => void;
  isMerging: boolean;
}

type DiffStatus = "added" | "deleted" | "modified";

interface DiffItem {
  id: string; // unique key for list
  title: string;
  type: "sql" | "edge_function";
  status: DiffStatus;
  prodTask: SqlTask | null;
  stagingTask: SqlTask | null;
}

export default function DiffViewer({ stagingProjectId, prodProjectId, theme, onClose, onMerge, isMerging }: DiffViewerProps) {
  const [loading, setLoading] = useState(true);
  const [diffItems, setDiffItems] = useState<DiffItem[]>([]);
  const [selectedItemId, setSelectedItemId] = useLocalStorage<string | null>('diffViewer_selectedId', null);
  const [showDetailMobile, setShowDetailMobile] = useLocalStorage<boolean>('diffViewer_showDetailMobile', false);
  const [selectedTab, setSelectedTab] = useState<string>('sql'); // For edge functions diff
  const [showFileExplorer, setShowFileExplorer] = useState(true);

  const selectedItem = diffItems.find(i => i.id === selectedItemId) || null;

  useEffect(() => {
    const fetchDiffs = async () => {
      try {
        setLoading(true);
        const devKeysModules = import.meta.glob('../lib/dev-keys.ts', { eager: true });
        const devKeys: any = devKeysModules['../lib/dev-keys.ts'] || {};
        const apiKey = import.meta.env.VITE_API_KEY || devKeys.VITE_API_KEY || "sk_sync_b4k92jdm10";
        
        const [prodRes, stagingRes] = await Promise.all([
          fetch(`/export.json?projectId=${prodProjectId}&api_key=${apiKey}`),
          fetch(`/export.json?projectId=${stagingProjectId}&api_key=${apiKey}`)
        ]);

        if (!prodRes.ok || !stagingRes.ok) throw new Error("Failed to fetch project exports");

        const prodExport = await prodRes.json();
        const stagingExport = await stagingRes.json();

        const prodTasks: SqlTask[] = prodExport._raw_tasks || [];
        const stagingTasks: SqlTask[] = stagingExport._raw_tasks || [];

        const prodTaskMap = new Map<string, SqlTask>(prodTasks.map(t => [t.id, t]));
        const stagingParentMap = new Map<string, SqlTask>(); // prodTask_id -> stagingTask
        
        stagingTasks.forEach(st => {
          if (st.productionTaskId) stagingParentMap.set(st.productionTaskId, st);
        });

        const items: DiffItem[] = [];

        // Find Added and Modified
        stagingTasks.forEach(st => {
          if (!st.productionTaskId || !prodTaskMap.has(st.productionTaskId)) {
            // Added
            items.push({
              id: st.id,
              title: st.title || "Untitled",
              type: st.type || 'sql',
              status: "added",
              prodTask: null,
              stagingTask: st
            });
          } else {
            // Check Modified
            const pt = prodTaskMap.get(st.productionTaskId)!;
            let isModified = false;

            if (st.type === 'edge_function') {
               const stFilesStr = JSON.stringify(st.edgeFiles?.map(f => ({ n: f.name, c: f.code })) || []);
               const ptFilesStr = JSON.stringify(pt.edgeFiles?.map(f => ({ n: f.name, c: f.code })) || []);
               if (stFilesStr !== ptFilesStr) isModified = true;
               
               const stSecretsStr = JSON.stringify(st.edgeSecrets?.map(s => ({ k: s.key, v: s.value })) || []);
               const ptSecretsStr = JSON.stringify(pt.edgeSecrets?.map(s => ({ k: s.key, v: s.value })) || []);
               if (stSecretsStr !== ptSecretsStr) isModified = true;
            } else {
               if (st.sql !== pt.sql) isModified = true;
            }

            if (isModified) {
              items.push({
                id: st.id,
                title: st.title || "Untitled",
                type: st.type || 'sql',
                status: "modified",
                prodTask: pt,
                stagingTask: st
              });
            }
          }
        });

        // Find Deleted
        prodTasks.forEach(pt => {
          if (!stagingParentMap.has(pt.id)) {
            items.push({
              id: pt.id,
              title: pt.title || "Untitled",
              type: pt.type || 'sql',
              status: "deleted",
              prodTask: pt,
              stagingTask: null
            });
          }
        });

        setDiffItems(items);
      } catch (err) {
        console.error("Diff fetching error:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchDiffs();
  }, [prodProjectId, stagingProjectId]);

  useEffect(() => {
    if (!loading && diffItems.length > 0 && window.innerWidth >= 768) {
      if (!selectedItemId || !diffItems.find(i => i.id === selectedItemId)) {
        setSelectedItemId(diffItems[0].id);
      }
    }
  }, [loading, diffItems, selectedItemId, setSelectedItemId]);

  // Derived state for the right panel
  const getOldValue = () => {
    if (!selectedItem || selectedItem.status === 'added') return '';
    const task = selectedItem.prodTask;
    if (!task) return '';
    if (selectedItem.type === 'edge_function') {
      if (selectedTab === 'secrets.json') {
         return JSON.stringify(task.edgeSecrets?.map(s => ({ key: s.key, value: s.value })) || [], null, 2);
      }
      const file = task.edgeFiles?.find(f => f.name === selectedTab);
      return file ? file.code : '';
    }
    return task.sql;
  };

  const getNewValue = () => {
    if (!selectedItem || selectedItem.status === 'deleted') return '';
    const task = selectedItem.stagingTask;
    if (!task) return '';
    if (selectedItem.type === 'edge_function') {
      if (selectedTab === 'secrets.json') {
         return JSON.stringify(task.edgeSecrets?.map(s => ({ key: s.key, value: s.value })) || [], null, 2);
      }
      const file = task.edgeFiles?.find(f => f.name === selectedTab);
      return file ? file.code : '';
    }
    return task.sql;
  };

  const getEdgeTabs = () => {
    if (!selectedItem || selectedItem.type !== 'edge_function') return [];
    const files = new Set<string>();
    selectedItem.prodTask?.edgeFiles?.forEach(f => files.add(f.name));
    selectedItem.stagingTask?.edgeFiles?.forEach(f => files.add(f.name));
    
    // Add secrets if they exist or changed
    files.add('secrets.json');
    return Array.from(files).sort();
  };

  useEffect(() => {
    if (selectedItem?.type === 'edge_function') {
      const tabs = getEdgeTabs();
      if (tabs.length > 0 && !tabs.includes(selectedTab)) {
         setSelectedTab(tabs.includes('index.ts') ? 'index.ts' : tabs[0]);
      }
    } else {
      setSelectedTab('sql');
    }
  }, [selectedItem]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-50 dark:bg-black font-sans overflow-hidden">
      {loading ? (
        <div className="flex-1 flex w-full h-full overflow-hidden min-h-0 pt-2">
          <div className="w-full md:w-72 lg:w-80 border-r border-slate-200 dark:border-[#1a1a1a] bg-white dark:bg-[#0a0a0a] flex-col shrink-0 flex">
             <div className="py-2.5 px-3 md:py-3 md:px-4 border-b border-slate-200 dark:border-[#1a1a1a] bg-slate-50/50 dark:bg-[#121212]/50 flex flex-row items-center justify-between gap-2">
                <div className="h-4 w-28 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" />
                <div className="flex gap-2">
                  <div className="h-3 w-12 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" />
                  <div className="h-3 w-12 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" />
                  <div className="h-3 w-12 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" />
                </div>
             </div>
             <div className="flex-1 overflow-y-auto p-1.5 md:p-2 space-y-0.5 w-full">
                {[...Array(8)].map((_, i) => (
                  <div key={i} className="w-full flex items-start gap-2.5 p-2.5 rounded-md border border-transparent">
                     <div className="w-4 h-4 bg-slate-200 dark:bg-slate-800 rounded animate-pulse mt-0.5" />
                     <div className="flex-1 space-y-1.5 min-w-0">
                        <div className="h-3.5 w-3/4 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" />
                        <div className="h-2.5 w-1/4 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" />
                     </div>
                  </div>
                ))}
             </div>
          </div>
          <div className="hidden md:flex flex-1 flex-col bg-slate-50 dark:bg-[#0a0a0a]">
            <div className="py-2 px-3 md:py-2.5 md:px-4 border-b border-slate-200 dark:border-[#1a1a1a] bg-slate-50/50 dark:bg-[#121212]/50 shrink-0">
               <div className="h-5 w-48 bg-slate-200 dark:bg-slate-800 rounded animate-pulse mb-3" />
            </div>
            <div className="flex-1 bg-slate-50 dark:bg-[#0a0a0a] md:p-4 min-h-0 text-[10px] sm:text-[11px] md:text-sm">
               <div className="w-full h-full bg-white dark:bg-black md:border md:border-slate-200 md:dark:border-[#2a2a2a] md:rounded-lg md:shadow-sm overflow-hidden flex flex-row">
                 <div className="flex-1 p-4 space-y-3 border-r border-slate-200 dark:border-[#2a2a2a]">
                    {[...Array(12)].map((_, i) => (
                      <div key={i} className="h-3 bg-slate-100 dark:bg-slate-900 rounded animate-pulse" style={{ width: `${Math.random() * 50 + 20}%` }} />
                    ))}
                 </div>
                 <div className="flex-1 p-4 space-y-3">
                    {[...Array(12)].map((_, i) => (
                      <div key={i} className="h-3 bg-slate-100 dark:bg-slate-900 rounded animate-pulse" style={{ width: `${Math.random() * 50 + 20}%` }} />
                    ))}
                 </div>
               </div>
            </div>
          </div>
        </div>
      ) : diffItems.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-slate-500 dark:text-slate-400 p-6">
           <CheckSquare size={40} className="mb-4 text-slate-300 dark:text-slate-700" />
           <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">No Changes Detected</h3>
           <p className="max-w-xs text-center text-sm">Your staging project is identical to the production version.</p>
        </div>
      ) : (
        <div className="flex-1 flex w-full h-full overflow-hidden min-h-0 pt-0.5 md:pt-0">
          {/* Sidebar */}
          <div className={cn(
            "w-full md:w-72 lg:w-80 border-r border-slate-200 dark:border-[#1a1a1a] bg-white dark:bg-[#0a0a0a] flex-col shrink-0",
            showDetailMobile ? "hidden md:flex" : "flex h-full"
          )}>
            <div className="py-2.5 px-3 md:py-3 md:px-4 border-b border-slate-200 dark:border-[#1a1a1a] bg-slate-50/50 dark:bg-[#121212]/50 sticky top-0 z-10 w-full flex flex-col 2xl:flex-row 2xl:items-center justify-between gap-2">
               <h3 className="text-xs md:text-sm font-semibold text-slate-800 dark:text-slate-200 shrink-0">Changed Tasks <span className="text-slate-500 font-normal">({diffItems.length})</span></h3>
               <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] sm:text-[11px] shrink-0">
                  <div className="flex items-center gap-1.5 whitespace-nowrap"><span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-emerald-500" /> <span className="text-slate-600 dark:text-slate-400 leading-none pb-px">Added</span></div>
                  <div className="flex items-center gap-1.5 whitespace-nowrap"><span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-blue-500" /> <span className="text-slate-600 dark:text-slate-400 leading-none pb-px">Modified</span></div>
                  <div className="flex items-center gap-1.5 whitespace-nowrap"><span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-red-500" /> <span className="text-slate-600 dark:text-slate-400 leading-none pb-px">Deleted</span></div>
               </div>
            </div>
            <div className="flex-1 overflow-y-auto w-full">
              {diffItems.map(item => (
                <button
                  key={item.id}
                  onClick={() => { setSelectedItemId(item.id); setShowDetailMobile(true); }}
                  className={cn(
                    "w-full flex items-start gap-3 px-4 py-3 text-left transition-all outline-none border-b",
                    selectedItemId === item.id 
                      ? (item.status === 'added' ? "bg-emerald-50/80 dark:bg-emerald-900/15 border-b-emerald-200 dark:border-emerald-800/50"
                        : item.status === 'deleted' ? "bg-red-50/80 dark:bg-red-900/15 border-b-red-200 dark:border-red-800/50"
                        : "bg-blue-50/80 dark:bg-blue-900/15 border-b-blue-200 dark:border-blue-800/50")
                      : "border-b-slate-100 dark:border-b-[#1a1a1a] hover:bg-slate-50 dark:hover:bg-[#161616]"
                  )}
                >
                  <div className="mt-0.5 shrink-0">
                    {item.type === 'edge_function' 
                      ? <FileCode size={14} className={cn(selectedItemId === item.id ? "text-slate-600 dark:text-slate-300" : "text-slate-400")} /> 
                      : <Database size={14} className={cn(selectedItemId === item.id ? "text-slate-600 dark:text-slate-300" : "text-slate-400")} />}
                  </div>
                  <div className="flex-1 min-w-0 pr-1">
                    <p className={cn(
                        "text-xs sm:text-sm font-medium truncate",
                        selectedItemId === item.id
                          ? (item.status === 'added' ? "text-emerald-900 dark:text-emerald-100"
                            : item.status === 'deleted' ? "text-red-900 dark:text-red-100"
                            : "text-blue-900 dark:text-blue-100")
                          : "text-slate-900 dark:text-slate-100"
                    )}>{item.title}</p>
                    <p className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-500 capitalize">{item.type.replace('_', ' ')}</p>
                  </div>
                  <div className="shrink-0 pt-0.5">
                    {item.status === 'added' ? <Plus size={14} className={cn(selectedItemId === item.id ? "text-emerald-600" : "text-emerald-500")} /> :
                     item.status === 'deleted' ? <Trash2 size={14} className={cn(selectedItemId === item.id ? "text-red-600" : "text-red-500")} /> :
                     <Pencil size={14} className={cn(selectedItemId === item.id ? "text-blue-600" : "text-blue-500")} />}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Main Area */}
          <div className={cn(
            "flex-1 flex-col bg-slate-50 dark:bg-[#0a0a0a] min-w-0 h-full w-full",
            !showDetailMobile ? "hidden md:flex" : "flex"
          )}>
            {selectedItem ? (
              <>
                <div className={cn(
                  "py-2 px-3 md:py-2.5 md:px-4 border-b shrink-0 sticky top-0 z-10 transition-colors duration-200 shadow-sm",
                  selectedItem.status === 'added' ? "border-emerald-300 bg-emerald-100 dark:bg-emerald-900/40 dark:border-emerald-700/50" :
                  selectedItem.status === 'deleted' ? "border-red-300 bg-red-100 dark:bg-red-900/40 dark:border-red-700/50" :
                  "border-blue-300 bg-blue-100 dark:bg-blue-900/40 dark:border-blue-700/50"
                )}>
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <button 
                        className="md:hidden p-1 -ml-1 text-slate-500 hover:text-slate-900 dark:hover:text-white shrink-0"
                        onClick={() => setShowDetailMobile(false)}
                      >
                        <ChevronLeft size={18} />
                      </button>
                      <h3 className={cn(
                        "text-sm md:text-base font-bold flex items-center gap-2 truncate",
                        selectedItem.status === 'added' ? "text-emerald-900 dark:text-emerald-100" :
                        selectedItem.status === 'deleted' ? "text-red-900 dark:text-red-100" :
                        "text-blue-900 dark:text-blue-100"
                      )}>
                        <span className="truncate">{selectedItem.title}</span>
                      </h3>
                    </div>
                  </div>
                  
                </div>
                <div className="flex-1 bg-slate-50 dark:bg-black md:bg-white md:dark:bg-black min-h-0 relative flex flex-row">
                  {selectedItem?.type === 'edge_function' && showFileExplorer && (
                     <div className="w-40 md:w-48 lg:w-56 border-r border-slate-200 dark:border-[#2a2a2a] bg-slate-50/50 dark:bg-[#121212]/50 flex flex-col shrink-0 overflow-y-auto shadow-[inset_-1px_0_10px_rgba(0,0,0,0.02)] dark:shadow-none">
                        <div className="px-3 py-2 border-b border-slate-200 dark:border-[#1a1a1a] text-xs font-semibold text-slate-800 dark:text-slate-200 sticky top-0 bg-slate-50/90 dark:bg-[#0a0a0a]/90 backdrop-blur-sm z-10 shadow-sm shadow-slate-200/20 dark:shadow-[#0a0a0a]/20">
                           Files Explorer
                        </div>
                        <div className="flex flex-col p-1.5 space-y-0.5">
                           {getEdgeTabs().map(tab => (
                              <button
                                 key={tab}
                                 onClick={() => setSelectedTab(tab)}
                                 className={cn(
                                    "px-2 py-1.5 text-left text-xs rounded-md transition-colors w-full break-all flex items-center shadow-sm",
                                    selectedTab === tab 
                                       ? "bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-white font-medium shadow-black/5 border border-slate-300 dark:border-slate-700"
                                       : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-[#1a1a1a] hover:text-slate-900 dark:hover:text-slate-200 border border-transparent"
                                 )}
                              >
                                 {tab === 'secrets.json' ? <FileCode size={12} className="shrink-0 mr-1.5 text-amber-500" /> : <FileCode size={12} className="shrink-0 mr-1.5 text-blue-500" />}
                                 <span className="truncate">{tab}</span>
                              </button>
                           ))}
                        </div>
                     </div>
                  )}
                  <div className="flex-1 relative overflow-hidden min-w-0">
                     <div className="absolute inset-0 overflow-auto text-[10px] sm:text-[11px]">
                        <div className="min-w-[500px] xl:min-w-[600px] w-full pb-8">
                           <ReactDiffViewer
                        oldValue={getOldValue()}
                        newValue={getNewValue()}
                        splitView={true}
                        useDarkTheme={theme === 'dark'}
                        leftTitle={selectedItem.status === 'added' ? undefined : (
                           <div className="font-bold text-slate-800 dark:text-slate-200 text-xs text-left w-full h-[24px] flex items-center">Production</div>
                        )}
                        rightTitle={selectedItem.status === 'deleted' ? undefined : (
                           <div className="font-bold text-slate-800 dark:text-slate-200 text-xs text-left w-full h-[24px] flex items-center">Staging</div>
                        )}
                        showDiffOnly={false}
                        styles={{
                          variables: {
                             light: {
                               diffViewerBackground: '#ffffff',
                               addedBackground: '#ecfdf5',
                               addedColor: '#065f46',
                               removedBackground: '#fef2f2',
                               removedColor: '#991b1b',
                               wordAddedBackground: '#a7f3d0',
                               wordRemovedBackground: '#fecaca',
                               addedGutterBackground: '#d1fae5',
                               removedGutterBackground: '#fee2e2',
                               emptyLineBackground: '#f8fafc',
                               gutterBackground: '#f1f5f9',
                               gutterBackgroundDark: '#e2e8f0',
                             },
                             dark: {
                               diffViewerBackground: '#000000',
                               addedBackground: '#042b10',
                               addedColor: '#34d399',
                               removedBackground: '#3b060b',
                               removedColor: '#f87171',
                               wordAddedBackground: '#054e1a',
                               wordRemovedBackground: '#6b0a13',
                               addedGutterBackground: '#031c0a',
                               removedGutterBackground: '#260407',
                               emptyLineBackground: '#0a0a0a',
                               gutterBackground: '#121212',
                               gutterBackgroundDark: '#1a1a1a',
                             }
                          },
                          line: {
                            wordBreak: 'break-word',
                            fontSize: '11px',
                          },
                          gutter: {
                            minWidth: '35px',
                            padding: '0 4px',
                          },
                          titleBlock: {
                            position: 'sticky',
                            top: 0,
                            zIndex: 10,
                            background: theme === 'dark' ? '#0a0a0a' : '#ffffff',
                            fontWeight: 600,
                            borderBottom: `1px solid ${theme === 'dark' ? '#1a1a1a' : '#e5e7eb'}`,
                            padding: '8px 12px',
                          },
                          content: {
                            width: '50%',
                          }
                        }}
                           />
                        </div>
                     </div>
                  </div>
                </div>
              </>
            ) : null}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="flex flex-row items-center justify-between px-2 sm:px-4 py-2 sm:py-3 bg-white dark:bg-[#0a0a0a] border-t border-slate-200 dark:border-[#1a1a1a] shadow-sm z-10 shrink-0 gap-2 mt-auto w-full pb-safe overflow-x-auto no-scrollbar">
        <div className="flex flex-row items-center gap-2 sm:gap-3 min-w-0">
          <h2 className="hidden lg:block text-xs sm:text-sm font-bold text-slate-900 dark:text-white leading-tight whitespace-nowrap">Review Changes</h2>
          {!loading && diffItems.length > 0 && (
            <div className="flex items-center space-x-2 sm:space-x-3 text-[10px] sm:text-xs font-medium whitespace-nowrap">
               <span className="text-slate-500 dark:text-slate-400 font-semibold border-r border-slate-200 dark:border-slate-800 pr-2 sm:pr-3">{diffItems.length} <span className="md:hidden">Total</span></span>
               {diffItems.some(i => i.status === 'added') && <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400"><span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-emerald-500" /> {diffItems.filter(i => i.status === 'added').length} <span className="md:hidden">Added</span></span>}
               {diffItems.some(i => i.status === 'modified') && <span className="flex items-center gap-1 text-blue-600 dark:text-blue-400"><span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-blue-500" /> {diffItems.filter(i => i.status === 'modified').length} <span className="md:hidden">Modified</span></span>}
               {diffItems.some(i => i.status === 'deleted') && <span className="flex items-center gap-1 text-red-600 dark:text-red-400"><span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-red-500" /> {diffItems.filter(i => i.status === 'deleted').length} <span className="md:hidden">Deleted</span></span>}
            </div>
          )}
        </div>
        
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 ml-auto">
           {selectedItem?.type === 'edge_function' && (
             <button 
               onClick={() => setShowFileExplorer(!showFileExplorer)}
               className={cn(
                 "flex items-center justify-center px-2.5 sm:px-3 py-1.5 border text-[11px] sm:text-xs rounded-md font-medium transition-colors whitespace-nowrap",
                 showFileExplorer 
                    ? "bg-slate-200 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200" 
                    : "bg-white dark:bg-[#1a1a1a] border-slate-200 dark:border-[#2a2a2a] text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-[#222]"
               )}
             >
               <Columns size={14} className="sm:mr-1.5" />
               <span className="hidden sm:inline">Explorer</span>
             </button>
           )}
           <button 
             onClick={onClose}
             className="flex items-center justify-center px-3 sm:px-4 py-1.5 border border-slate-200 dark:border-[#2a2a2a] text-[11px] sm:text-xs text-slate-700 dark:text-slate-300 rounded-md font-medium hover:bg-slate-50 dark:hover:bg-[#1a1a1a] transition-colors whitespace-nowrap"
           >
             Cancel
           </button>
           <button 
             onClick={onMerge}
             disabled={isMerging || loading || diffItems.length === 0}
             className="flex items-center justify-center px-4 sm:px-5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] sm:text-xs rounded-md font-medium transition-colors shadow gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
           >
             {isMerging ? (
               <>
                 <span className="w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin shrink-0" />
                 Merging...
               </>
             ) : (
               <>
                 <span className="font-semibold">Merge <span className="hidden md:inline">to Production</span></span>
                 <ArrowRight size={14} className="ml-0.5 shrink-0 hidden sm:block" />
               </>
             )}
           </button>
        </div>
      </div>
    </div>
  );
}
