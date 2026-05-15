import React, { useState, useMemo, useEffect, useRef } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import {
  Plus,
  Database,
  CheckCircle2,
  Circle,
  Trash2,
  Copy,
  Check,
  ChevronLeft,
  Search,
  CheckSquare,
  X,
  ChevronDown,
  Undo2,
  Redo2,
  DownloadCloud,
  UploadCloud,
  FileCode,
  Moon,
  Sun,
  Pencil,
  PlusCircle,
  GripVertical,
  MoreHorizontal,
  RefreshCw
} from "lucide-react";
import { toast, Toaster } from 'sonner';
import Editor from "react-simple-code-editor";
import Prism from "prismjs";
import "prismjs/components/prism-sql";
import "prismjs/components/prism-javascript";
import "prismjs/themes/prism-tomorrow.css";
import JSZip from "jszip";
import { useLocalStorage } from "./hooks/useLocalStorage";
import EdgeFunctionEditor from "./components/EdgeFunctionEditor";
import DiffViewer from "./components/DiffViewer";
import { SqlTask } from "./types";
import { cn } from "./lib/utils";
import { supabase } from "./lib/supabase";

const devKeysModules = import.meta.glob('./lib/dev-keys.ts', { eager: true });
const devKeys: any = devKeysModules['./lib/dev-keys.ts'] || {};
export const API_KEY_FALLBACK = import.meta.env.VITE_API_KEY || devKeys.VITE_API_KEY || "sk_sync_b4k92jdm10";

interface TaskItemProps {
  task: SqlTask;
  index: number;
  totalTasks: number;
  isSelectionMode: boolean;
  selectedTaskId: string | null;
  lastVisitedTaskId: string | null;
  isSelectedForDeletion: boolean;
  onPointerDown: (e: React.PointerEvent, taskId: string) => void;
  cancelLongPress: () => void;
  onTaskClick: (taskId: string) => void;
  onStatusToggle: (taskId: string, currentStatus: string, e: React.MouseEvent) => void;
  provided: any;
  snapshot: any;
}

const TaskItem = React.memo(({
  task,
  index,
  totalTasks,
  isSelectionMode,
  selectedTaskId,
  lastVisitedTaskId,
  isSelectedForDeletion,
  onPointerDown,
  cancelLongPress,
  onTaskClick,
  onStatusToggle,
  provided,
  snapshot
}: TaskItemProps) => {
  return (
    <div
      ref={provided.innerRef}
      {...provided.draggableProps}
      style={{ ...provided.draggableProps.style, opacity: snapshot.isDragging ? 0.8 : 1 }}
      onPointerDown={(e) => onPointerDown(e, task.id)}
      onPointerUp={cancelLongPress}
      onPointerLeave={cancelLongPress}
      onClick={() => onTaskClick(task.id)}
      className={cn(
        "flex items-start gap-3 p-3 cursor-pointer transition-all border-y border-x-0 border-transparent select-none",
        selectedTaskId === task.id && !isSelectionMode
          ? "bg-blue-50 dark:bg-blue-600/10 border-blue-200 dark:border-blue-800/50"
          : lastVisitedTaskId === task.id && !selectedTaskId
          ? "border-blue-400/50 dark:border-blue-500/50 bg-blue-50/30 dark:bg-blue-900/5"
          : "bg-white dark:bg-[#0a0a0a] hover:bg-slate-50 dark:hover:bg-slate-800/50",
        isSelectionMode && isSelectedForDeletion && "border-blue-400 dark:border-blue-600 bg-blue-50 dark:bg-blue-900/30",
        snapshot.isDragging && "shadow-lg scale-[1.02] z-50 rounded-md border"
      )}
    >
      {isSelectionMode ? (
        <div className="mt-0.5 shrink-0 text-blue-600 dark:text-blue-400" onClick={(e) => { e.stopPropagation(); onTaskClick(task.id); }}>
          {isSelectedForDeletion ? (
            <CheckSquare size={18} />
          ) : (
            <div className="w-[18px] h-[18px] border-2 border-slate-300 dark:border-slate-600 rounded-sm" />
          )}
        </div>
      ) : (
        <button
          onClick={(e) => onStatusToggle(task.id, task.status, e)}
          className={cn(
            "mt-0.5 shrink-0 transition-colors",
            task.status === "ran"
              ? "text-emerald-500"
              : "text-slate-300 dark:text-slate-600 hover:text-blue-500 dark:hover:text-blue-400",
          )}
        >
          {task.status === "ran" ? (
            <CheckCircle2 size={18} />
          ) : (
            <Circle size={18} />
          )}
        </button>
      )}
      <span className="text-xs font-mono text-slate-400 dark:text-slate-500 mt-1 shrink-0 w-5 text-right">
        {index + 1}.
      </span>
      <div className="flex-1 min-w-0">
        <h3
          className={cn(
            "text-sm font-medium truncate",
            task.status === "ran" && !isSelectionMode && "text-slate-500 dark:text-slate-500 line-through",
            !task.title && "text-slate-400 dark:text-slate-500 italic",
          )}
        >
          {task.title || "Untitled"}
        </h3>
        <p className="text-xs text-slate-400 dark:text-slate-500 truncate mt-0.5">
          {task.description || (task.type === "edge_function" ? "Edge Function" : task.sql.trim() || "Empty query")}
        </p>
      </div>
      <div 
        {...provided.dragHandleProps}
        className="drag-handle text-slate-300 hover:text-slate-600 dark:text-slate-600 dark:hover:text-slate-400 mt-1 shrink-0 w-6 flex justify-center cursor-grab active:cursor-grabbing"
      >
        <GripVertical size={16} />
      </div>
    </div>
  );
});

export const DebouncedTitleInput = ({
  value,
  onChange,
  className,
  placeholder,
}: {
  value: string;
  onChange: (val: string) => void;
  className?: string;
  placeholder?: string;
}) => {
  const [localValue, setLocalValue] = useState(value);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVal = e.target.value;
    setLocalValue(newVal);

    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      onChange(newVal);
    }, 2000);
  };

  return (
    <input
      type="text"
      value={localValue}
      onChange={handleChange}
      className={className}
      placeholder={placeholder}
    />
  );
};

export const DebouncedCodeEditor = ({
  value,
  onChange,
  taskType
}: {
  value: string;
  onChange: (val: string) => void;
  taskType: "sql" | "edge_function";
}) => {
  const [localValue, setLocalValue] = useState(value);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const handleChange = (newVal: string) => {
    setLocalValue(newVal);

    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      onChange(newVal);
    }, 2000);
  };

  return (
    <Editor
      value={localValue}
      onValueChange={handleChange}
      highlight={(code) =>
        Prism.highlight(
          code,
          taskType === "edge_function" ? Prism.languages.javascript : Prism.languages.sql,
          taskType === "edge_function" ? "javascript" : "sql"
        )
      }
      padding={16}
      className="font-mono text-sm min-h-full"
      style={{
        fontFamily: '"JetBrains Mono", "Fira Code", monospace',
        minWidth: "100%",
        color: "inherit",
      }}
      textareaClassName="focus:outline-none text-slate-900 dark:text-slate-100"
    />
  );
};

const DebouncedDescriptionTextarea = ({
  value,
  onChange,
  className,
  placeholder,
}: {
  value: string;
  onChange: (val: string) => void;
  className?: string;
  placeholder?: string;
}) => {
  const [localValue, setLocalValue] = useState(value);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newVal = e.target.value;
    setLocalValue(newVal);

    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      onChange(newVal);
    }, 1000); // 1s debounce for UI responsiveness vs DB sync
  };

  return (
    <textarea
      autoFocus
      value={localValue}
      onChange={handleChange}
      onBlur={() => onChange(localValue)}
      placeholder={placeholder}
      className={className}
    />
  );
};

export default function App() {
  const navigate = useNavigate();
  const { projectId: urlProjectId, taskId: urlTaskId } = useParams();
  const location = useLocation();

  const [tasks, setTasks] = useState<SqlTask[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  
  // Use URL params as source of truth for selection
  const selectedProjectId = urlProjectId || null;
  const selectedTaskId = urlTaskId || null;

  const [theme, setTheme] = useLocalStorage<"light" | "dark">("app-theme", "light");
  const [isLoading, setIsLoading] = useState(true);
  const [lastVisitedTaskId, setLastVisitedTaskId] = useLocalStorage<string | null>("last-visited-task-id", null);
  const [searchQuery, setSearchQuery] = useLocalStorage("search-query", "");
  const [isSearchExpanded, setIsSearchExpanded] = useLocalStorage("search-expanded", false);
  const [filter, setFilter] = useLocalStorage<"all" | "pending" | "ran">("filter-status", "all");
  const [activeTab, setActiveTab] = useLocalStorage<"sql" | "edge_function">("active-tab", "sql");
  const [copied, setCopied] = useState(false);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedForDeletion, setSelectedForDeletion] = useState<Set<string>>(
    new Set(),
  );
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [longPressTimer, setLongPressTimer] = useState<NodeJS.Timeout | null>(
    null,
  );
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const [showTypeSelector, setShowTypeSelector] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isCloning, setIsCloning] = useState(false);
  const [pendingDragUpdate, setPendingDragUpdate] = useState<{ updatedTasks: SqlTask[], originalTasks: SqlTask[] } | null>(null);

  const handleCloneProject = async (project: {id: string, name: string}) => {
    setIsCloning(true);
    const toastId = "clone-project";
    toast.loading(`Creating Staging Replica of ${project.name}...`, { id: toastId });
    try {
      const newProjectId = crypto.randomUUID();
      const newProjectName = `${project.name} [STAGING]`;
      const newProject = { id: newProjectId, name: newProjectName, created_at: Date.now() };

      const { error: projectError } = await supabase.from('projects').insert(newProject);
      if (projectError) throw projectError;

      const { data: sourceTasks, error: tasksError } = await supabase.from('tasks').select('*').eq('project_id', project.id);
      if (tasksError) throw tasksError;

      if (sourceTasks && sourceTasks.length > 0) {
        const duplicatedTasksParams = sourceTasks.map(t => ({
          ...t,
          id: crypto.randomUUID(),
          project_id: newProjectId,
          production_task_id: t.id,
          created_at: Date.now(),
          updated_at: Date.now()
        }));

        const { error: insertTasksError } = await supabase.from('tasks').insert(duplicatedTasksParams);
        if (insertTasksError) throw insertTasksError;

        const mappedDuplicatedTasks: SqlTask[] = duplicatedTasksParams.map(t => ({
          id: t.id,
          title: t.title,
          type: t.type,
          sql: t.sql,
          functionCode: t.function_code,
          description: t.description,
          edgeFiles: t.edge_files,
          edgeSecrets: t.edge_secrets,
          status: t.status,
          folderId: t.folder_id,
          projectId: t.project_id,
          productionTaskId: t.production_task_id,
          createdAt: t.created_at,
          updatedAt: t.updated_at,
          orderIndex: t.order_index
        }));

        setTasks((prev) => [...mappedDuplicatedTasks, ...prev]);
      }

      setProjects(prev => [...prev, { id: newProject.id, name: newProject.name, createdAt: newProject.created_at }]);
      navigate(`/p/${newProjectId}`);
      toast.success("Replica created successfully!", { id: toastId });
    } catch (err) {
      console.error(err);
      toast.error("Failed to create replica", { id: toastId });
    } finally {
      setIsCloning(false);
    }
  };

  const [isMerging, setIsMerging] = useState(false);

  const handleMergeToProduction = async () => {
    const activeProjectObj = projects.find(p => p.id === selectedProjectId);
    if (!activeProjectObj) return;

    const isStaging = activeProjectObj.name.endsWith(' [STAGING]');
    if (!isStaging) {
      toast.error("You can only merge from a staging project.");
      return;
    }

    const originalName = activeProjectObj.name.replace(' [STAGING]', '');
    const productionProject = projects.find(p => p.name === originalName);

    if (!productionProject) {
      toast.error("Original production project not found (matching name).");
      return;
    }

    setIsMerging(true);
    const toastId = "merge-production";
    toast.loading(`Merging to ${productionProject.name}...`, { id: toastId });

    try {
      const response = await fetch(`/api/ai/merge-staging?api_key=${API_KEY_FALLBACK}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stagingProjectId: activeProjectObj.id,
          prodProjectId: productionProject.id
        })
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      // Cleanup local state
      setProjects(prev => prev.filter(p => p.id !== activeProjectObj.id));
      setTasks(prev => prev.filter(t => t.projectId !== activeProjectObj.id));
      navigate(`/p/${productionProject.id}`);

      toast.success("Successfully merged to production!", { id: toastId });
    } catch (err) {
      console.error(err);
      toast.error("Failed to merge to production", { id: toastId });
    } finally {
      setIsMerging(false);
    }
  };

  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
  
  const [isProjectDropdownOpen, setIsProjectDropdownOpen] = useState(false);
  const [showNewProjectModal, setShowNewProjectModal] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [projectToDelete, setProjectToDelete] = useState<{id: string, name: string} | null>(null);
  const [projectToRename, setProjectToRename] = useState<{id: string, name: string} | null>(null);
  const [renameProjectName, setRenameProjectName] = useState("");
  const [sidebarWidth, setSidebarWidth] = useLocalStorage("mainSidebarWidth", 384); // Default to 384px (lg:w-96)
  const [isResizing, setIsResizing] = useState(false);
  const [isDiffViewerOpen, setIsDiffViewerOpen] = useState(false);
  const mainContainerRef = useRef<HTMLDivElement>(null);

  // Drag to resize main sidebar
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent | TouchEvent) => {
      if (!isResizing || !mainContainerRef.current) return;
      
      let clientX = 0;
      if ('touches' in e) {
        clientX = e.touches[0].clientX;
      } else {
        clientX = e.clientX;
      }

      const rect = mainContainerRef.current.getBoundingClientRect();
      const newWidth = clientX - rect.left;
      // Constrain sidebar width between 240px and 60% of window
      const maxWidth = window.innerWidth * 0.6;
      setSidebarWidth(Math.min(Math.max(newWidth, 240), maxWidth));
    };
    const handleMouseUp = () => setIsResizing(false);

    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove as EventListener);
      document.addEventListener("mouseup", handleMouseUp);
      document.addEventListener("touchmove", handleMouseMove as EventListener);
      document.addEventListener("touchend", handleMouseUp);
      document.body.style.cursor = 'col-resize';
    } else {
      document.body.style.cursor = '';
    }
    return () => {
      document.removeEventListener("mousemove", handleMouseMove as EventListener);
      document.removeEventListener("mouseup", handleMouseUp);
      document.removeEventListener("touchmove", handleMouseMove as EventListener);
      document.removeEventListener("touchend", handleMouseUp);
      document.body.style.cursor = '';
    };
  }, [isResizing, setSidebarWidth]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingSavesRef = useRef(0);
  const pendingUpdateTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [toastPosition, setToastPosition] = useState<"top-right" | "bottom-right">(
    typeof window !== "undefined" && window.innerWidth >= 768 ? "top-right" : "bottom-right"
  );

  useEffect(() => {
    const updatePosition = () => {
      setToastPosition(window.innerWidth >= 768 ? "top-right" : "bottom-right");
    };
    window.addEventListener("resize", updatePosition);
    return () => window.removeEventListener("resize", updatePosition);
  }, []);

  const selectedTask = tasks.find((t) => t.id === selectedTaskId) || null;

  useEffect(() => {
    if (theme === "dark") {
      document.documentElement.classList.add("dark");
      document.documentElement.style.colorScheme = "dark";
    } else {
      document.documentElement.classList.remove("dark");
      document.documentElement.style.colorScheme = "light";
    }
  }, [theme]);

  useEffect(() => {
    if (!selectedProjectId && projects.length > 0) {
      navigate(`/p/${projects[0].id}`, { replace: true });
    }
  }, [selectedProjectId, projects, navigate]);

  // DB Sync helper
  const syncToDB = async (newTasks: SqlTask[], successMessage?: string, isManual = false) => {
    pendingSavesRef.current += 1;
    setIsSaving(true);
    const toastId = "db-sync";
    
    if (pendingSavesRef.current === 1 && isManual) {
      toast.loading("Saving to Supabase...", { id: toastId });
    }

    try {
      // Map tasks to Supabase snake_case format
      const tasksToUpsert = newTasks.map(t => ({
        id: t.id,
        title: t.title,
        type: t.type,
        sql: t.sql,
        function_code: t.functionCode,
        description: t.description,
        edge_files: t.edgeFiles,
        edge_secrets: t.edgeSecrets,
        status: t.status,
        folder_id: t.folderId,
        project_id: t.projectId,
        production_task_id: t.productionTaskId,
        created_at: t.createdAt,
        updated_at: t.updatedAt,
        order_index: t.orderIndex
      }));

      let { error } = await supabase
        .from('tasks')
        .upsert(tasksToUpsert, { onConflict: 'id' });

      if (error && (error.code === 'PGRST204' || JSON.stringify(error).includes('order_index'))) {
        const fallbackTasks = tasksToUpsert.map(t => {
          const { order_index, ...rest } = t;
          return rest;
        });
        const fallback = await supabase.from('tasks').upsert(fallbackTasks, { onConflict: 'id' });
        error = fallback.error;
        if (!error && pendingSavesRef.current === 1) {
            toast.warning("Reorder not permanently saved: 'order_index' column is missing in Supabase. Please update your schema.", { id: toastId + "-warn", duration: 5000 });
        }
      }

      if (error) throw error;
      
      // Also sync to Express backend for memTasks rapid update
      fetch(`/api/sync?api_key=${API_KEY_FALLBACK}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newTasks)
      }).catch(err => console.warn('Failed to ping /api/sync:', err));
      
      if (pendingSavesRef.current === 1 && isManual) {
        toast.success(successMessage || "Saved to Supabase!", { id: toastId, duration: 2000 });
      }
      return true;
    } catch (error) {
      console.error("Supabase sync error:", error);
      if (pendingSavesRef.current === 1 && isManual) {
        const errorMessage = error instanceof Error ? error.message : "Supabase error occurred";
        toast.error(`Sync failed: ${errorMessage}`, { 
          id: toastId, 
          duration: 6000
        });
      }
      return false;
    } finally {
      pendingSavesRef.current -= 1;
      if (pendingSavesRef.current <= 0) {
        pendingSavesRef.current = 0;
        setIsSaving(false);
      }
    }
  };

  useEffect(() => {
    let isMounted = true;
    
    // 1. Initial fetch from Supabase
    const fetchInitialData = async () => {
      try {
        const [tasksRes, projectsRes] = await Promise.all([
          supabase
            .from('tasks')
            .select('*')
            .order('created_at', { ascending: false }),
          supabase
            .from('projects')
            .select('*')
            .order('created_at', { ascending: false })
        ]);

        if (tasksRes.error) throw tasksRes.error;
        if (projectsRes.error && projectsRes.error.code !== '42P01') throw projectsRes.error; // 42P01 is table not found

        if (isMounted) {
          if (projectsRes.data) {
           setProjects(projectsRes.data.map(p => ({
              id: p.id,
              name: p.name,
              createdAt: p.created_at
            })));
          }

          // Map back to camelCase
          const mappedTasks: SqlTask[] = (tasksRes.data || []).map(t => ({
            id: t.id,
            title: t.title,
            type: t.type,
            sql: t.sql,
            functionCode: t.function_code,
            description: t.description,
            edgeFiles: t.edge_files,
            edgeSecrets: t.edge_secrets,
            status: t.status,
            folderId: t.folder_id,
            projectId: t.project_id,
            productionTaskId: t.production_task_id,
            createdAt: t.created_at,
            updatedAt: t.updated_at,
            orderIndex: t.order_index
          })).sort((a, b) => {
            if (a.orderIndex !== undefined && a.orderIndex !== null && b.orderIndex !== undefined && b.orderIndex !== null) {
              return a.orderIndex - b.orderIndex;
            }
            if (a.orderIndex !== undefined && a.orderIndex !== null) return -1;
            if (b.orderIndex !== undefined && b.orderIndex !== null) return 1;
            return b.createdAt - a.createdAt;
          });
          setTasks(mappedTasks);
          setIsLoading(false);
        }
      } catch (err) {
        console.error("Failed to load initial data from Supabase", err);
        if (isMounted) setIsLoading(false);
      }
    };

    const setupRealtime = () => {
      supabase.getChannels().forEach(c => {
         if (c.topic === 'realtime:schema-db-changes') {
            supabase.removeChannel(c);
         }
      });

      const channel = supabase
        .channel('schema-db-changes')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'tasks' },
          () => {
            if (isMounted) fetchInitialData();
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'projects' },
          () => {
            if (isMounted) fetchInitialData();
          }
        )
        .subscribe((status, err) => {
           if (status === 'SUBSCRIBED') {
             console.log('Realtime connected successfully.');
           } else if (status === 'CHANNEL_ERROR') {
             console.error('Realtime channel error', err);
           } else if (status === 'TIMED_OUT') {
             console.warn('Realtime channel timed out');
           } else if (status === 'CLOSED') {
             console.log('Realtime channel closed');
           }
        });

      return channel;
    };

    fetchInitialData();
    const currentChannel = setupRealtime();

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('Tab became visible, refetching data to ensure freshness...');
        if (isMounted) fetchInitialData();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      isMounted = false;
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (currentChannel) supabase.removeChannel(currentChannel);
    };
  }, []);

  // History state for Undo/Redo
  const [sqlHistory, setSqlHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [lastSavedTime, setLastSavedTime] = useState(0);

  useEffect(() => {
    if (selectedTaskId) {
      setIsEditingDescription(false);
      setIsDescriptionExpanded(false);
      const task = tasks.find((t) => t.id === selectedTaskId);
      if (task) {
        setSqlHistory([
          task.type === "edge_function" ? task.functionCode || "" : task.sql,
        ]);
        setHistoryIndex(0);
      }
    } else {
      setSqlHistory([]);
      setHistoryIndex(-1);
    }
  }, [selectedTaskId]); // Only run when selectedTaskId changes

  const handleSqlChange = (newSql: string) => {
    if (!selectedTaskId) return;

    // For type edge_function we update functionCode instead
    if (selectedTask?.type === "edge_function") {
      handleUpdateTask(selectedTaskId, { functionCode: newSql });
    } else {
      handleUpdateTask(selectedTaskId, { sql: newSql });
    }

    const now = Date.now();
    const newHistory = sqlHistory.slice(0, historyIndex + 1);

    // Group changes if they happen within 500ms of the last save
    if (now - lastSavedTime < 500 && newHistory.length > 1) {
      newHistory[newHistory.length - 1] = newSql;
    } else {
      newHistory.push(newSql);
      if (newHistory.length > 100) newHistory.shift();
    }

    setSqlHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
    setLastSavedTime(now);
  };

  const handleUndo = () => {
    if (historyIndex > 0 && selectedTaskId) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      if (selectedTask?.type === "edge_function") {
        handleUpdateTask(selectedTaskId, {
          functionCode: sqlHistory[newIndex],
        });
      } else {
        handleUpdateTask(selectedTaskId, { sql: sqlHistory[newIndex] });
      }
    }
  };

  const handleRedo = () => {
    if (historyIndex < sqlHistory.length - 1 && selectedTaskId) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      if (selectedTask?.type === "edge_function") {
        handleUpdateTask(selectedTaskId, {
          functionCode: sqlHistory[newIndex],
        });
      } else {
        handleUpdateTask(selectedTaskId, { sql: sqlHistory[newIndex] });
      }
    }
  };

  const filteredTasks = useMemo(() => {
    return tasks
      .filter((t) => {
        if (filter === "all") return true;
        return t.status === filter;
      })
      .filter((t) => (t.type === "edge_function" ? "edge_function" : "sql") === activeTab)
      .filter((t) => (t.title || "").toLowerCase().includes(searchQuery.toLowerCase()))
      .filter((t) => selectedProjectId ? t.projectId === selectedProjectId : false)
      .sort((a, b) => {
        if (a.orderIndex !== undefined && b.orderIndex !== undefined) {
          return a.orderIndex - b.orderIndex;
        }
        if (a.orderIndex !== undefined) return -1;
        if (b.orderIndex !== undefined) return 1;
        return b.createdAt - a.createdAt;
      });
  }, [tasks, filter, searchQuery, activeTab, selectedProjectId]);

  const handleCreateTask = async (type: "sql" | "edge_function") => {
    if (!selectedProjectId) {
      toast.error("Please create a project first");
      return;
    }
    setShowTypeSelector(false);
    
    // Calculate new bottom-most order index
    const currentMaxOrder = tasks.length > 0 
      ? Math.max(0, ...tasks.map(t => t.orderIndex ?? (tasks.indexOf(t) * 1000)))
      : 0;

    const newTask: SqlTask = {
      id: crypto.randomUUID(),
      title: "",
      type,
      sql: "",
      functionCode: "",
      description: "",
      edgeFiles:
        type === "edge_function"
          ? [{ id: crypto.randomUUID(), name: "index.ts", code: "" }]
          : [],
      edgeSecrets: [],
      status: "pending",
      folderId: null,
      projectId: selectedProjectId,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      orderIndex: currentMaxOrder + 1000,
    };
    
    // Back up tasks for rollback
    const originalTasks = [...tasks];
    
    // Optimistically select it and switch tab
    setTasks([...tasks, newTask]);
    setActiveTab(type);
    navigate(`/p/${selectedProjectId}/t/${newTask.id}`);
    setIsSelectionMode(false);
    
    const success = await syncToDB([...tasks, newTask], `New ${type === 'sql' ? 'SQL Query' : 'Edge Function'} created`);
    if (!success) {
      setTasks(originalTasks);
      navigate(`/p/${selectedProjectId}`);
    }
  };

  const handleUpdateTask = React.useCallback(async (id: string, updates: Partial<SqlTask>) => {
    let updatedTasksValue: SqlTask[] = [];
    
    setTasks(prevTasks => {
      updatedTasksValue = prevTasks.map((t) =>
        t.id === id ? { ...t, ...updates, updatedAt: Date.now() } : t,
      );
      return updatedTasksValue;
    });
    
    if (pendingUpdateTimeoutRef.current) {
      clearTimeout(pendingUpdateTimeoutRef.current);
    }
    
    pendingUpdateTimeoutRef.current = setTimeout(() => {
      syncToDB(updatedTasksValue);
    }, 2000);
  }, [setTasks]);

  const handleShowTypeSelector = () => {
    if (!selectedProjectId) {
      toast.error("Please create or select a project first");
      return;
    }
    setShowTypeSelector(true);
  };

  const toggleSelectionMode = () => {
    setIsSelectionMode(!isSelectionMode);
    setSelectedForDeletion(new Set());
  };

  const handleBulkDelete = () => {
    if (selectedForDeletion.size === 0) return;
    setShowDeleteConfirm(true);
  };

  const confirmBulkDelete = async () => {
    if (selectedForDeletion.size === 0) return;
    setIsDeleting(true);
    
    const deleteCount = selectedForDeletion.size;
    const deletedIds = Array.from(selectedForDeletion);
    const originalTasks = [...tasks];
    
    try {
      // First, attempt to delete from Supabase
      const { error } = await supabase.from('tasks').delete().in('id', deletedIds);
      if (error) throw error;

      // Update UI state
      const remainingTasks = tasks.filter((t) => !selectedForDeletion.has(t.id));
      setTasks(remainingTasks);
      
      if (selectedTaskId && selectedForDeletion.has(selectedTaskId)) {
        navigate(`/p/${selectedProjectId}`);
      }
      setSelectedForDeletion(new Set());
      setIsSelectionMode(false);
      setShowDeleteConfirm(false);
      toast.success(`${deleteCount} task${deleteCount > 1 ? 's' : ''} deleted`);
      
    } catch (err) {
      console.error("Delete failed:", err);
      toast.error("Failed to delete tasks. Please try again.");
    } finally {
      setIsDeleting(false);
    }
  };

  const cancelLongPress = React.useCallback(() => {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      setLongPressTimer(null);
    }
  }, [longPressTimer, setLongPressTimer]);

  const handlePointerDown = React.useCallback((e: React.PointerEvent, taskId: string) => {
    if (isSelectionMode) return;
    if ((e.target as Element).closest?.('.drag-handle')) return;

    const timer = setTimeout(() => {
      setIsSelectionMode(true);
      setSelectedForDeletion(new Set([taskId]));
    }, 500);
    setLongPressTimer(timer);
  }, [isSelectionMode, setLongPressTimer]);

  const handleTaskClick = React.useCallback((taskId: string) => {
    cancelLongPress();
    if (isSelectionMode) {
      setSelectedForDeletion((prev) => {
        const newSet = new Set(prev);
        if (newSet.has(taskId)) newSet.delete(taskId);
        else newSet.add(taskId);
        return newSet;
      });
    } else {
      setLastVisitedTaskId(taskId);
      navigate(`/p/${selectedProjectId}/t/${taskId}`);
    }
  }, [cancelLongPress, isSelectionMode, selectedProjectId, setLastVisitedTaskId, navigate]);

  const handleStatusToggle = React.useCallback((taskId: string, currentStatus: string, e: React.MouseEvent) => {
    e.stopPropagation();
    handleUpdateTask(taskId, {
      status: currentStatus === "pending" ? "ran" : "pending",
    });
  }, [handleUpdateTask]);

  const handleDragEnd = async (result: DropResult) => {
    if (!result.destination) return;

    if (result.source.index === result.destination.index) return;
    
    // We only reorder filteredTasks currently visible
    const items = [...filteredTasks];
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    const itemsMap = new Map<string, number>();
    items.forEach((item, index) => {
      itemsMap.set(item.id, index * 1000);
    });

    const updatedTasks = tasks.map((t) => {
      if (itemsMap.has(t.id)) {
        return { ...t, orderIndex: itemsMap.get(t.id), updatedAt: Date.now() };
      }
      return t;
    });

    const originalTasks = [...tasks];
    setTasks(updatedTasks);
    setPendingDragUpdate({ updatedTasks, originalTasks });
  };

  const handleCopySql = async (sql: string) => {
    try {
      await navigator.clipboard.writeText(sql);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy text: ", err);
    }
  };

  const handleExportEdgeZip = async (task: SqlTask) => {
    try {
       const zip = new JSZip();
       const edgeFiles = task.edgeFiles || [];
       const edgeSecrets = task.edgeSecrets || [];
       edgeFiles.forEach(f => {
          zip.file(f.name, f.code);
       });
       
       if (edgeSecrets.length > 0) {
          const secretsObj = Object.fromEntries(edgeSecrets.filter(s => s.key).map(s => [s.key, s.value]));
          zip.file("secrets.json", JSON.stringify(secretsObj, null, 2));
       }
       
       const blob = await zip.generateAsync({ type: "blob" });
       const url = URL.createObjectURL(blob);
       const a = document.createElement("a");
       a.href = url;
       a.download = `edge_function_${(task.title || 'export').replace(/[^a-z0-9]/gi, '_').toLowerCase()}.zip`;
       document.body.appendChild(a);
       a.click();
       document.body.removeChild(a);
       URL.revokeObjectURL(url);
    } catch (error) {
       console.error("Failed to export zip", error);
       alert("Failed to export zip file");
    }
  };

  const handleImportEdgeZip = async (taskId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const zip = new JSZip();
      const content = await zip.loadAsync(file);
      
      const newFiles = [];
      const newSecrets = [];
      
      for (const [path, zipEntry] of Object.entries(content.files)) {
        if (zipEntry.dir) continue;
        
        // Skip common hidden/system files
        if (path.includes('__MACOSX') || path.includes('.DS_Store')) continue;
        
        const fileContent = await zipEntry.async("string");
        
        if (path === 'secrets.json') {
           try {
              const secretsData = JSON.parse(fileContent);
              if (Array.isArray(secretsData)) {
                secretsData.forEach(s => {
                  if (s.key && typeof s.value === 'string') {
                    newSecrets.push({ id: crypto.randomUUID(), key: s.key, value: s.value });
                  }
                });
              } else if (typeof secretsData === 'object' && secretsData !== null) {
                 for (const [key, value] of Object.entries(secretsData)) {
                    if (typeof value === 'string') {
                      newSecrets.push({ id: crypto.randomUUID(), key, value });
                    }
                 }
              }
           } catch (e) { console.error("Failed to parse secrets.json", e); }
           continue;
        }

        newFiles.push({
          id: crypto.randomUUID(),
          name: path,
          code: fileContent
        });
      }
      
      // Auto-add default empty file if completely empty
      if (newFiles.length === 0) {
        newFiles.push({ id: crypto.randomUUID(), name: 'index.ts', code: '' });
      }

      handleUpdateTask(taskId, { edgeFiles: newFiles, edgeSecrets: newSecrets });
      
    } catch (error) {
      console.error("Failed to import zip", error);
      alert("Failed to import zip file");
    } finally {
      if (e.target) e.target.value = '';
    }
  };

  const handleExport = () => {
    // Sort visually top-to-bottom for correct sequence execution
    const sortedTasks = [...tasks].sort((a, b) => {
        if (a.orderIndex !== undefined && b.orderIndex !== undefined) {
          return a.orderIndex - b.orderIndex;
        }
        if (a.orderIndex !== undefined) return -1;
        if (b.orderIndex !== undefined) return 1;
        return b.createdAt - a.createdAt;
    });
    
    const structuredExport = {
      version: "1.0",
      exportDate: new Date().toISOString(),
      metadata: {
        totalTasks: sortedTasks.length,
        sqlTasksCount: sortedTasks.filter(t => t.type === 'sql' || !t.type).length,
        edgeFunctionsCount: sortedTasks.filter(t => t.type === 'edge_function').length,
      },
      sql_queries: sortedTasks
        .filter(t => t.type === 'sql' || !t.type)
        .map(t => ({
          id: t.id,
          title: t.title,
          status: t.status,
          sql: t.sql, // The actual SQL code
          description: t.description,
          createdAt: t.createdAt
        })),
      edge_functions: sortedTasks
        .filter(t => t.type === 'edge_function')
        .map(t => ({
          id: t.id,
          title: t.title,
          status: t.status,
          description: t.description,
          files: t.edgeFiles || [],    // Code inside 'code' property of each file
          secrets: t.edgeSecrets || [],
          createdAt: t.createdAt
        })),
      // Keep old raw structure as well for backward compatibility during import
      _raw_tasks: sortedTasks
    };

    const dataStr = JSON.stringify(structuredExport, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `migration-export-${new Date().toISOString().split("T")[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const importedData = JSON.parse(event.target?.result as string);
        let importedTasksRaw = [];
        
        // Handle several formats: array, structured with _raw_tasks, or structured with collections
        if (Array.isArray(importedData)) {
          importedTasksRaw = importedData;
        } else if (importedData && importedData._raw_tasks && Array.isArray(importedData._raw_tasks)) {
          importedTasksRaw = importedData._raw_tasks;
        } else if (importedData && (importedData.sql_queries || importedData.edge_functions)) {
          const sqlQueries = (importedData.sql_queries || []).map((t: any) => ({ ...t, type: 'sql' }));
          const edgeFunctions = (importedData.edge_functions || []).map((t: any) => ({ ...t, type: 'edge_function' }));
          importedTasksRaw = [...sqlQueries, ...edgeFunctions];
        }

        if (importedTasksRaw.length > 0) {
          const tasksMap = new Map(tasks.map((t) => [t.id, t]));

          let importedCount = 0;
          importedTasksRaw.forEach((t) => {
            // Robust mapping for both snake_case (Supabase direct export) and camelCase (App export)
            const id = t.id || crypto.randomUUID();
            const title = t.title || t.name || "";
            const taskType = t.type || 'sql';
            const sql = t.sql || t.query || "";
            const functionCode = t.functionCode || t.function_code || "";
            const description = t.description || "";
            const status = t.status || "pending";
            const createdAt = t.createdAt || t.created_at || Date.now();
            const updatedAt = t.updatedAt || t.updated_at || Date.now();
            const orderIndex = t.orderIndex !== undefined ? t.orderIndex : t.order_index;
            
            // If importing into a project, assign the selected project ID
            // unless the task already has a valid project ID that the user might want to keep?
            // Usually, users want it to go into the current project.
            const projectId = selectedProjectId;

            if (typeof sql === "string" || taskType === "edge_function") {
              const task: SqlTask = {
                id,
                title,
                type: taskType,
                sql,
                functionCode,
                description,
                status,
                projectId,
                folderId: t.folderId || t.folder_id || null,
                createdAt,
                updatedAt,
                orderIndex,
                edgeFiles: t.edgeFiles || t.edge_files || (taskType === 'edge_function' ? [{ id: crypto.randomUUID(), name: 'index.ts', code: '' }] : []),
                edgeSecrets: t.edgeSecrets || t.edge_secrets || []
              };
              tasksMap.set(id, task);
              importedCount++;
            }
          });

          if (importedCount > 0) {
            const newTasks = Array.from(tasksMap.values()).sort(
              (a: any, b: any) => {
                if (a.orderIndex !== undefined && b.orderIndex !== undefined) {
                  return a.orderIndex - b.orderIndex;
                }
                if (a.orderIndex !== undefined) return -1;
                if (b.orderIndex !== undefined) return 1;
                return b.createdAt - a.createdAt;
              }
            ) as SqlTask[];
            setTasks(newTasks);
            syncToDB(newTasks, `Successfully imported ${importedCount} tasks`);
          } else {
            toast.error("No valid tasks found in the file.");
          }
        } else {
          toast.error("Invalid format: Expected an array of tasks.");
        }
      } catch (err) {
        toast.error("Failed to parse the file. Please ensure it is a valid JSON file.");
      }

      if (fileInputRef.current) fileInputRef.current.value = "";
    };
    reader.readAsText(file);
  };

  const tasksInProject = useMemo(() => tasks.filter(t => selectedProjectId ? t.projectId === selectedProjectId : false), [tasks, selectedProjectId]);
  const pendingCount = tasksInProject.filter((t) => t.status === "pending").length;
  const ranCount = tasksInProject.filter((t) => t.status === "ran").length;
  const progress =
    tasksInProject.length === 0 ? 0 : Math.round((ranCount / tasksInProject.length) * 100);

  if (isLoading && tasks.length === 0 && projects.length === 0) {
    return (
      <div className="flex w-full h-dvh bg-slate-50 dark:bg-black text-slate-900 dark:text-slate-50 font-sans overflow-hidden">
         {/* Sidebar Skeleton */}
         <div className="flex flex-col w-full md:w-80 lg:w-96 border-r border-slate-200 dark:border-[#1a1a1a] bg-white dark:bg-[#0a0a0a] h-full shrink-0 relative">
             <div className="p-3 border-b border-slate-200 dark:border-[#1a1a1a] bg-white dark:bg-[#0a0a0a]">
                <div className="flex items-center justify-between mb-3">
                   <div className="flex items-center gap-2">
                       <div className="w-[30px] h-[30px] bg-slate-200 dark:bg-slate-700/50 rounded-lg animate-pulse" />
                       <div className="space-y-1.5 flex-1">
                          <div className="h-4 bg-slate-200 dark:bg-slate-700/50 rounded w-16 animate-pulse" />
                          <div className="h-2 bg-slate-200 dark:bg-slate-700/50 rounded w-20 animate-pulse" />
                       </div>
                   </div>
                   <div className="flex gap-1.5 items-center">
                       <div className="w-[28px] h-[28px] bg-slate-200 dark:bg-slate-700/50 rounded animate-pulse" />
                       <div className="w-[28px] h-[28px] bg-slate-200 dark:bg-slate-700/50 rounded animate-pulse" />
                       <div className="w-[45px] h-[26px] bg-slate-200 dark:bg-slate-700/50 rounded-md animate-pulse" />
                       <div className="w-[28px] h-[28px] bg-slate-200 dark:bg-slate-700/50 rounded animate-pulse" />
                       <div className="w-[28px] h-[28px] bg-slate-200 dark:bg-slate-700/50 rounded animate-pulse" />
                   </div>
                </div>
                <div className="w-full bg-slate-100 dark:bg-[#121212] rounded-full h-1.5 mb-2 overflow-hidden" />
             </div>
             
             <div className="flex-1 overflow-y-auto p-2 space-y-1 pb-20">
                 {Array.from({ length: 15 }).map((_, i) => (
                    <div key={i} className="flex gap-3 p-3 rounded-lg border border-transparent">
                        <div className="w-[18px] h-[18px] bg-slate-200 dark:bg-slate-700/50 rounded-full shrink-0 mt-0.5 animate-pulse" />
                        <div className="w-4 h-3 bg-slate-200 dark:bg-slate-700/50 rounded mt-1 shrink-0 animate-pulse" />
                        <div className="flex-1 space-y-2 mt-0.5">
                            <div className="h-3.5 bg-slate-200 dark:bg-slate-700/50 rounded w-3/4 animate-pulse" />
                            <div className="h-2.5 bg-slate-200 dark:bg-slate-700/50 rounded w-1/2 animate-pulse" />
                        </div>
                    </div>
                 ))}
             </div>
             
             {/* Bottom Tabs Skeleton */}
             <div className="absolute bottom-0 left-0 right-0 p-3 bg-white dark:bg-[#0a0a0a] border-t border-slate-200 dark:border-[#1a1a1a] z-20">
                <div className="flex items-center justify-between gap-2 sm:gap-3">
                  <div className="w-9 h-9 rounded-full bg-slate-200 dark:bg-slate-800 animate-pulse flex-shrink-0"></div>
                  
                  <div className="bg-slate-100 dark:bg-black p-1 rounded-full flex gap-1 items-center justify-between shadow-sm flex-1 max-w-[280px] mx-auto">
                      <div className="flex-1 py-1 h-7 sm:h-8 bg-white dark:bg-[#0a0a0a] rounded-full shadow animate-pulse"></div>
                      <div className="flex-1 py-1 h-7 sm:h-8 bg-transparent rounded-full animate-pulse"></div>
                  </div>
                  
                  <div className="w-9 h-9 rounded-full bg-slate-200 dark:bg-slate-800 animate-pulse flex-shrink-0"></div>
                </div>
             </div>
         </div>

         {/* Main Content Skeleton */}
         <div className="flex-1 hidden md:flex flex-col h-full bg-slate-50 dark:bg-black relative min-w-0 transition-colors">
             {/* Editor Header Skeleton */}
             <div className="flex flex-col border-b border-slate-200 dark:border-[#1a1a1a] bg-white dark:bg-[#0a0a0a]">
                 <div className="flex items-center justify-between px-3 py-2">
                     <div className="flex items-center gap-2 flex-1 min-w-0">
                         <div className="h-6 w-48 bg-slate-200 dark:bg-slate-700/50 rounded animate-pulse" />
                     </div>
                     <div className="flex items-center gap-2 ml-3 shrink-0">
                         <div className="w-[100px] h-7 bg-slate-200 dark:bg-slate-700/50 rounded-md animate-pulse" />
                     </div>
                 </div>
                 <div className="px-3 pb-3 mt-1">
                     <div className="h-3 w-2/3 bg-slate-200 dark:bg-slate-700/50 rounded animate-pulse my-1" />
                 </div>
             </div>

             {/* Editor Body Skeleton */}
             <div className="flex-1 overflow-hidden flex flex-col relative bg-white dark:bg-black min-w-0 border-t-0">
                 <div className="flex items-center justify-between px-4 py-2 bg-slate-50 dark:bg-[#0a0a0a] border-b border-slate-200 dark:border-[#1a1a1a]">
                     <div className="h-3 w-20 bg-slate-200 dark:bg-slate-700/50 rounded animate-pulse" />
                     <div className="flex items-center gap-2">
                         <div className="w-7 h-7 bg-slate-200 dark:bg-slate-700/50 rounded animate-pulse" />
                         <div className="w-7 h-7 bg-slate-200 dark:bg-slate-700/50 rounded animate-pulse" />
                         <div className="w-[88px] h-7 bg-slate-200 dark:bg-slate-700/50 rounded animate-pulse ml-2" />
                     </div>
                 </div>
                 <div className="flex-1 p-4 space-y-4 overflow-hidden">
                     {[
                         "33%", "50%", "40%", "75%", "66%", "50%", "60%", "25%", "80%", "50%", "33%", "66%", "50%", "25%", "75%",
                         "33%", "50%", "40%", "75%", "66%", "50%", "60%", "25%", "80%", "50%", "33%", "66%", "50%", "25%", "75%"
                     ].map((width, idx) => (
                        <div key={idx} className="h-4 bg-slate-100 dark:bg-slate-800/50 rounded animate-pulse" style={{ width }} />
                     ))}
                 </div>
             </div>
         </div>
      </div>
    );
  }

  return (
    <div className="flex w-full h-dvh bg-slate-50 dark:bg-black text-slate-900 dark:text-slate-50 font-sans overflow-hidden" ref={mainContainerRef}>
      <Toaster 
        position={toastPosition} 
        richColors 
        theme={theme}
        toastOptions={{
          className: '!w-auto !min-w-fit !max-w-max whitespace-nowrap'
        }}
      />
      {/* Sidebar / List View */}
      <div
        className={cn(
          "flex flex-col border-r border-slate-200 dark:border-[#1a1a1a] bg-white dark:bg-[#0a0a0a] h-full relative shrink-0",
          selectedTaskId ? "hidden md:flex" : "flex",
          !isResizing && "transition-[width]"
        )}
        style={{ width: window.innerWidth >= 768 ? `${sidebarWidth}px` : "100%" }}
      >
        <div className="p-3 border-b border-slate-200 dark:border-[#1a1a1a] bg-white dark:bg-[#0a0a0a] sticky top-0 z-10 transition-colors">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-3 gap-3 md:gap-2 w-full">
            {isSearchExpanded ? (
               <div className="flex w-full items-center gap-2">
                 <div className="relative flex-1">
                   <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                   <input
                     autoFocus
                     type="text"
                     placeholder="Search..."
                     value={searchQuery}
                     onChange={(e) => setSearchQuery(e.target.value)}
                     className="w-full pl-8 pr-3 py-1.5 bg-slate-100 dark:bg-[#121212] border-transparent focus:bg-white dark:focus:bg-slate-700/50 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded text-xs transition-all outline-none dark:text-white"
                   />
                 </div>
                 <button onClick={() => {setIsSearchExpanded(false); setSearchQuery("");}} className="p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors"><X size={16} /></button>
               </div>
            ) : (
                <>
                  <div className="flex items-center gap-2 w-full md:w-auto md:flex-1 min-w-0">
                    <div className="relative flex-1 min-w-0">
                      <div className="flex flex-col min-w-0">
                        <button
                          onClick={() => setIsProjectDropdownOpen(!isProjectDropdownOpen)}
                          className="flex items-center gap-1.5 font-bold text-sm md:text-base leading-tight hover:text-blue-600 transition-colors dark:text-white w-full bg-transparent border-none outline-none text-left p-0 min-w-0"
                        >
                          <span className="truncate block flex-1">
                            {selectedProjectId 
                              ? projects.find(p => p.id === selectedProjectId)?.name || "Unknown Project" 
                              : "No Project"}
                          </span>
                          <ChevronDown size={14} className={cn("text-slate-400 transition-transform shrink-0", isProjectDropdownOpen && "rotate-180")} />
                        </button>
                        
                        <div className="flex items-center gap-2 mt-0.5 truncate">
                          <p className="text-[10px] text-slate-500 uppercase tracking-wider font-medium shrink-0">{progress}% Complete</p>
                          {isSaving && <span className="text-[9px] text-blue-500 animate-pulse font-medium flex items-center gap-1 shrink-0">
                            <span className="w-1 h-1 bg-blue-500 rounded-full"></span>
                            Saving...
                          </span>}
                        </div>
                      </div>
                      
                      {isProjectDropdownOpen && (
                        <>
                          <div
                            className="fixed inset-0 z-40"
                            onClick={() => setIsProjectDropdownOpen(false)}
                          />
                          <div className="absolute left-0 mt-2 w-64 bg-white dark:bg-[#121212] border border-slate-200 dark:border-[#2a2a2a] rounded-lg shadow-xl z-50 py-1.5 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                              <div className="max-h-60 overflow-y-auto">
                                {projects.length === 0 && (
                                  <div className="px-3 py-2 text-xs text-slate-500 italic">No projects yet</div>
                                )}
                                {projects.map((p) => (
                                  <div key={p.id} className={cn(
                                    "flex items-center transition-colors px-1",
                                    selectedProjectId === p.id ? "bg-blue-50 dark:bg-blue-900/30" : "hover:bg-slate-50 dark:hover:bg-slate-800/50"
                                  )}>
                                    <button
                                      onClick={() => {
                                        navigate(`/p/${p.id}`);
                                        setIsProjectDropdownOpen(false);
                                      }}
                                      className={cn(
                                        "flex-1 text-left pl-2 py-1 text-[13px] transition-colors flex items-center gap-2 min-w-0",
                                        selectedProjectId === p.id
                                          ? "text-blue-700 dark:text-blue-400 font-medium" 
                                          : "text-slate-700 dark:text-slate-300"
                                      )}
                                    >
                                      <span className="truncate">{p.name}</span>
                                    </button>
                                    <div className="flex items-center gap-1 pr-2 shrink-0">
                                      <button 
                                        onClick={(e) => { e.stopPropagation(); setProjectToRename(p); setRenameProjectName(p.name); setIsProjectDropdownOpen(false); }} 
                                        className="p-1 text-slate-400 hover:text-blue-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors"
                                        title="Rename Project"
                                      >
                                        <Pencil size={12} />
                                      </button>
                                      <button 
                                        onClick={(e) => { e.stopPropagation(); handleCloneProject(p); setIsProjectDropdownOpen(false); }} 
                                        className="p-1 text-slate-400 hover:text-emerald-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors"
                                        title="Create Staging Replica"
                                        disabled={isCloning}
                                      >
                                        <Copy size={12} />
                                      </button>
                                      <button 
                                        onClick={(e) => { e.stopPropagation(); setProjectToDelete(p); setIsProjectDropdownOpen(false); }} 
                                        className="p-1 text-slate-400 hover:text-red-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors"
                                        title="Delete Project"
                                      >
                                        <Trash2 size={12} />
                                      </button>
                                      {selectedProjectId === p.id && <Check size={12} className="text-blue-700 dark:text-blue-400" />}
                                    </div>
                                  </div>
                                ))}
                              </div>
                              
                              <div className="h-px bg-slate-100 dark:bg-[#2a2a2a] my-1" />
                              
                              <button
                                onClick={() => {
                                  setIsProjectDropdownOpen(false);
                                  setShowNewProjectModal(true);
                                }}
                                className="w-full text-left px-3 py-1.5 text-[13px] text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors flex items-center gap-2 font-medium"
                              >
                                <Plus size={14} />
                                New Project...
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 w-full md:w-auto shrink-0 justify-between md:justify-end">
                    <div className="relative flex items-center">
                      <button
                        onClick={() => setIsFilterOpen(!isFilterOpen)}
                        className="flex items-center gap-1 text-xs py-1.5 px-2 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors focus:outline-none"
                        title="Filter Tasks"
                      >
                        <span className="capitalize">{filter}</span>
                        <ChevronDown size={12} className={cn("text-slate-400 transition-transform", isFilterOpen && "rotate-180")} />
                      </button>
                      {isFilterOpen && (
                        <>
                          <div
                            className="fixed inset-0 z-40"
                            onClick={() => setIsFilterOpen(false)}
                          />
                          <div className="absolute left-0 top-full mt-1 w-32 bg-white dark:bg-[#121212] border border-slate-200 dark:border-[#2a2a2a] rounded-md shadow-lg z-50 py-1 overflow-hidden">
                            {(["all", "pending", "ran"] as const).map((f) => (
                              <button
                                key={f}
                                onClick={() => {
                                  setFilter(f);
                                  setIsFilterOpen(false);
                                }}
                                className={cn(
                                  "w-full text-left px-3 py-1.5 text-xs capitalize transition-colors",
                                  filter === f
                                    ? "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 font-medium"
                                    : "text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50",
                                )}
                              >
                                {f}
                              </button>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                    <input type="file" accept=".json" className="hidden" ref={fileInputRef} onChange={handleImport} />
                    <button onClick={() => fileInputRef.current?.click()} className="p-1.5 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors" title="Import Tasks"><UploadCloud size={16} /></button>
                    <button onClick={handleExport} className="p-1.5 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors" title="Export Tasks"><DownloadCloud size={16} /></button>

                    <button onClick={() => setIsSearchExpanded(true)} className="p-1.5 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors ml-1" title="Search"><Search size={16} /></button>
                    <button onClick={handleShowTypeSelector} className="hidden md:flex p-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors ml-1" title="New Task"><Plus size={16} /></button>
                  </div>
               </>
            )}
          </div>

          <div className="w-full bg-slate-100 dark:bg-[#121212] rounded-full h-1.5 mb-2 overflow-hidden">
            <div
              className="bg-blue-600 h-1.5 rounded-full transition-all duration-500 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto py-2 pb-20">
          {filteredTasks.length === 0 ? (
            <div className="text-center p-8 text-slate-400 dark:text-slate-600">
              <Database size={32} className="mx-auto mb-3 opacity-20" />
              <p className="text-sm">No {activeTab === "sql" ? "queries" : "edge functions"} found.</p>
            </div>
          ) : (
            <DragDropContext onDragEnd={handleDragEnd} onDragStart={cancelLongPress}>
              <Droppable droppableId="tasks-list">
                {(provided) => (
                  <div {...provided.droppableProps} ref={provided.innerRef}>
                    {filteredTasks.map((task, index) => (
                      // @ts-ignore
                      <Draggable key={task.id} draggableId={task.id} index={index} isDragDisabled={isSelectionMode}>
                        {(provided, snapshot) => (
                          <TaskItem
                            task={task}
                            index={index}
                            totalTasks={filteredTasks.length}
                            isSelectionMode={isSelectionMode}
                            selectedTaskId={selectedTaskId}
                            lastVisitedTaskId={lastVisitedTaskId}
                            isSelectedForDeletion={selectedForDeletion.has(task.id)}
                            onPointerDown={handlePointerDown}
                            cancelLongPress={cancelLongPress}
                            onTaskClick={handleTaskClick}
                            onStatusToggle={handleStatusToggle}
                            provided={provided}
                            snapshot={snapshot}
                          />
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </DragDropContext>
          )}
        </div>

        {pendingDragUpdate && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/20 dark:bg-black/40 backdrop-blur-sm">
            <div className="bg-white dark:bg-[#1a1a1a] border border-slate-200 dark:border-[#2a2a2a] rounded-xl shadow-xl p-5 max-w-sm w-full animate-in fade-in zoom-in-95 duration-200">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">Save Reorder</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">Do you want to apply the new order to the database?</p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => {
                    setTasks(pendingDragUpdate.originalTasks);
                    setPendingDragUpdate(null);
                  }}
                  className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-colors"
                >
                  Revert
                </button>
                <button
                  onClick={async () => {
                    const { updatedTasks, originalTasks } = pendingDragUpdate;
                    setPendingDragUpdate(null);
                    
                    // Optimistic feedback
                    toast.success("Order saved", { id: "reorder-toast", duration: 2000 });
                    
                    // Also sync to Express backend for memTasks rapid update
                    fetch(`/api/sync?api_key=${API_KEY_FALLBACK}`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify(updatedTasks)
                    }).catch(err => console.warn('Failed to ping /api/sync:', err));
                    
                    const success = await syncToDB(updatedTasks);
                    if (!success) {
                      setTasks(originalTasks);
                    }
                  }}
                  className="px-4 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors shadow-sm"
                >
                  Keep Changes
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Tab Selection at the Bottom */}
        <div className="absolute bottom-0 left-0 right-0 p-3 bg-white/90 dark:bg-[#0a0a0a]/90 backdrop-blur-lg border-t border-slate-200 dark:border-[#1a1a1a] z-30 pb-[max(env(safe-area-inset-bottom),12px)]">
          {isSelectionMode ? (
            <div className="flex items-center justify-between mx-auto max-w-[340px] bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-full shadow-2xl p-1.5 px-3">
              <span className="text-xs font-semibold px-2">
                {selectedForDeletion.size} Selected
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => {
                    if (selectedForDeletion.size === filteredTasks.length && filteredTasks.length > 0) {
                      setSelectedForDeletion(new Set());
                    } else {
                      setSelectedForDeletion(new Set(filteredTasks.map(t => t.id)));
                    }
                  }}
                  className="flex items-center justify-center px-3 py-1.5 text-xs font-medium bg-white/10 dark:bg-black/5 hover:bg-white/20 dark:hover:bg-black/10 rounded-full transition-colors"
                >
                  {selectedForDeletion.size === filteredTasks.length && filteredTasks.length > 0 ? "None" : "All"}
                </button>
                <button
                  onClick={handleBulkDelete}
                  disabled={selectedForDeletion.size === 0}
                  className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white rounded-full font-medium transition-colors text-xs disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Trash2 size={14} />
                  Delete
                </button>
                <div className="w-px h-4 bg-white/20 dark:bg-black/10 mx-1" />
                <button
                  onClick={() => {
                    setIsSelectionMode(false);
                    setSelectedForDeletion(new Set());
                  }}
                  className="flex items-center justify-center p-1.5 bg-white/10 dark:bg-black/5 hover:bg-white/20 dark:hover:bg-black/10 rounded-full transition-colors"
                  title="Cancel"
                >
                  <X size={16} />
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-2 sm:gap-3">
              <button 
                onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')} 
                className="p-1.5 sm:p-2 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors flex-shrink-0" 
                title="Toggle Theme"
              >
                {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
              </button>

              <div className="bg-slate-100 dark:bg-black p-1 rounded-full flex items-center justify-between shadow-sm flex-1 max-w-[280px] mx-auto">
                 <button
                    onClick={() => setActiveTab("sql")}
                    className={cn(
                      "flex-1 text-center py-1.5 px-2 sm:px-4 rounded-full text-xs sm:text-sm font-medium transition-all duration-200 truncate w-1/2",
                      activeTab === "sql" ? "bg-white dark:bg-[#0a0a0a] text-slate-900 dark:text-white shadow" : "text-slate-500 dark:text-[#8E8E93] hover:text-slate-700 dark:hover:text-[#E5E5E5]"
                    )}
                 >
                   SQL
                 </button>
                 <button
                    onClick={() => setActiveTab("edge_function")}
                    className={cn(
                      "flex-1 text-center py-1.5 px-2 sm:px-4 rounded-full text-xs sm:text-sm font-medium transition-all duration-200 truncate w-1/2",
                      activeTab === "edge_function" ? "bg-white dark:bg-[#0a0a0a] text-slate-900 dark:text-white shadow" : "text-slate-500 dark:text-[#8E8E93] hover:text-slate-700 dark:hover:text-[#E5E5E5]"
                    )}
                 >
                   Functions
                 </button>
              </div>

              <div className="relative flex items-center shrink-0">
                <button 
                  onClick={() => setIsMoreMenuOpen(!isMoreMenuOpen)}
                  className="p-1.5 sm:p-2 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors flex-shrink-0"
                  title="More Options"
                >
                  <MoreHorizontal size={20} />
                </button>

                {isMoreMenuOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setIsMoreMenuOpen(false)}
                    />
                    <div className="absolute right-0 bottom-full mb-2 w-48 bg-white dark:bg-[#121212] border border-slate-200 dark:border-[#2a2a2a] rounded-lg shadow-xl z-50 py-1 overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-200">
                      {selectedProjectId && projects.find(p => p.id === selectedProjectId)?.name.endsWith(' [STAGING]') && (
                        <>
                          <button
                            onClick={() => {
                              setIsDiffViewerOpen(true);
                              setIsMoreMenuOpen(false);
                            }}
                            className="w-full text-left px-3 py-2 text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors flex items-center gap-2 font-medium"
                          >
                            <RefreshCw size={14} />
                            Review Changes
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
                      
                      <button
                        onClick={() => {
                          setIsSelectionMode(!isSelectionMode);
                          setIsMoreMenuOpen(false);
                        }}
                        className="w-full text-left px-3 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors flex items-center gap-2"
                      >
                        <CheckSquare size={14} />
                        Bulk Select / Delete
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        {/* FAB for New Query (Mobile Only) */}
        <button
          onClick={handleShowTypeSelector}
          className="md:hidden absolute bottom-20 right-6 w-14 h-14 bg-blue-600 hover:bg-blue-700 text-white rounded-full flex items-center justify-center shadow-lg hover:shadow-xl transition-all z-20"
          title="New Task"
        >
          <Plus size={24} />
        </button>
      </div>

      {/* Resize Handle */}
      <div
        className={cn(
          "hidden md:flex group w-4 cursor-col-resize absolute top-0 bottom-0 z-30 transition-colors hover:bg-blue-500/10 active:bg-blue-500/10 justify-center -ml-2",
          isResizing && "bg-blue-500/10"
        )}
        style={{ left: sidebarWidth }}
        onMouseDown={(e) => {
          e.preventDefault();
          setIsResizing(true);
        }}
        onTouchStart={() => {
          setIsResizing(true);
        }}
      >
        <div className={cn(
          "absolute inset-y-0 w-[1px] bg-slate-200 dark:bg-[#1a1a1a] group-hover:bg-blue-500 transition-colors",
          isResizing && "bg-blue-500 w-[2px]"
        )} />
      </div>

      {/* Main Content / Editor */}
      <div
        className={cn(
          "flex-1 flex flex-col h-full bg-slate-50 dark:bg-black relative min-w-0 transition-colors",
          !selectedTaskId ? "hidden md:flex" : "flex",
        )}
      >
        {selectedTask ? (
          <>
            {/* Editor Header */}
            <div className="flex flex-col border-b border-slate-200 dark:border-[#1a1a1a] bg-white dark:bg-[#0a0a0a] transition-colors">
              <div className="flex items-center justify-between px-3 py-2">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <button
                    onClick={() => navigate(`/p/${selectedProjectId}`)}
                    className="md:hidden p-1.5 -ml-1.5 text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 rounded-md shrink-0"
                  >
                    <ChevronLeft size={18} />
                  </button>
                  <DebouncedTitleInput
                    value={selectedTask.title || ""}
                    onChange={(newVal) =>
                      handleUpdateTask(selectedTask.id, {
                        title: newVal,
                      })
                    }
                    className="text-base font-semibold bg-transparent border-none focus:outline-none focus:ring-0 p-0 w-full truncate placeholder:text-slate-400 dark:placeholder:text-slate-500 placeholder:font-normal dark:text-white"
                    placeholder="Query Title"
                  />
                </div>
                <div className="flex items-center gap-2 ml-3 shrink-0">
                  {selectedTask.type === "edge_function" && (
                    <>
                      <button
                        onClick={() => document.getElementById(`import-zip-main-${selectedTask.id}`)?.click()}
                        className="p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors"
                        title="Import Zip"
                      >
                        <input 
                          type="file" 
                          id={`import-zip-main-${selectedTask.id}`} 
                          className="hidden" 
                          accept=".zip" 
                          onChange={(e) => handleImportEdgeZip(selectedTask.id, e)} 
                        />
                        <UploadCloud size={16} />
                      </button>
                      <button
                        onClick={() => handleExportEdgeZip(selectedTask)}
                        className="p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors"
                        title="Export Zip"
                      >
                        <DownloadCloud size={16} />
                      </button>
                    </>
                  )}
                  <button
                    onClick={() =>
                      handleUpdateTask(selectedTask.id, {
                        status:
                          selectedTask.status === "pending" ? "ran" : "pending",
                      })
                    }
                    className={cn(
                      "flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors",
                      selectedTask.status === "ran"
                        ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-200 dark:hover:bg-emerald-900/50"
                        : "bg-slate-100 dark:bg-[#121212] text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700",
                    )}
                  >
                    {selectedTask.status === "ran" ? (
                      <>
                        <CheckCircle2 size={14} />
                        <span>Ran</span>
                      </>
                    ) : (
                      <>
                        <Circle size={14} />
                        <span>Mark as Ran</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
              <div className="px-3 pb-2 mt-1">
                {isEditingDescription ? (
                  <DebouncedDescriptionTextarea
                    value={selectedTask.description || ""}
                    onChange={(newVal) =>
                      handleUpdateTask(selectedTask.id, {
                        description: newVal,
                      })
                    }
                    placeholder="Describe what this does..."
                    className="w-full text-sm bg-slate-50 dark:bg-[#0a0a0a]/50 border border-blue-500 dark:border-blue-500 rounded-md p-2 outline-none focus:ring-4 focus:ring-blue-500/10 transition-all resize-y min-h-[80px] dark:text-slate-200 dark:placeholder:text-slate-600"
                  />
                ) : selectedTask.description ? (
                  <div className="group relative flex items-start justify-between gap-2 py-1.5 transition-all">
                    <div 
                      className="flex-1 cursor-pointer"
                      onClick={() => setIsDescriptionExpanded(!isDescriptionExpanded)}
                    >
                      <p className={cn(
                        "text-xs text-slate-500 dark:text-slate-400 leading-relaxed transition-all",
                        !isDescriptionExpanded && "line-clamp-2"
                      )}>
                        {selectedTask.description}
                      </p>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsEditingDescription(true);
                      }}
                      className="p-1 text-slate-300 hover:text-blue-500 dark:text-slate-600 dark:hover:text-blue-400 transition-colors shrink-0"
                      title="Edit Description"
                    >
                      <Pencil size={13} strokeWidth={2} />
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-4 bg-slate-50/50 dark:bg-[#0a0a0a]/30 border border-dashed border-slate-200 dark:border-[#2a2a2a] rounded-lg">
                    <button
                      onClick={() => setIsEditingDescription(true)}
                      className="flex items-center gap-2 text-xs font-medium text-slate-400 hover:text-blue-500 dark:text-slate-500 dark:hover:text-blue-400 transition-all px-4 py-1"
                    >
                      <PlusCircle size={14} />
                      Add Description
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Editor Body */}
            {selectedTask.type === "edge_function" ? (
              <div className="flex-1 overflow-hidden min-w-0">
                <EdgeFunctionEditor
                  task={selectedTask}
                  onUpdate={(updates) =>
                    handleUpdateTask(selectedTask.id, updates)
                  }
                />
              </div>
            ) : (
              <div className="flex-1 overflow-hidden flex flex-col relative bg-white dark:bg-black min-w-0 transition-colors">
                <div className="flex items-center justify-between px-4 py-2 bg-slate-50 dark:bg-[#0a0a0a] border-b border-slate-200 dark:border-[#1a1a1a] text-slate-500 dark:text-slate-400 text-xs font-mono transition-colors">
                  <span>SQL Editor</span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleUndo}
                      disabled={historyIndex <= 0}
                      className="flex items-center justify-center w-7 h-7 hover:text-slate-900 dark:hover:text-white transition-colors rounded bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Undo"
                    >
                      <Undo2 size={14} />
                    </button>
                    <button
                      onClick={handleRedo}
                      disabled={historyIndex >= sqlHistory.length - 1}
                      className="flex items-center justify-center w-7 h-7 hover:text-slate-900 dark:hover:text-white transition-colors rounded bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Redo"
                    >
                      <Redo2 size={14} />
                    </button>
                    <button
                      onClick={() => handleCopySql(selectedTask.sql)}
                      className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors px-2 py-1 rounded bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 ml-2"
                    >
                      {copied ? (
                        <Check size={14} className="text-emerald-500 dark:text-emerald-400" />
                      ) : (
                        <Copy size={14} />
                      )}
                      {copied ? "Copied!" : "Copy Code"}
                    </button>
                  </div>
                </div>
                <div className="flex-1 overflow-auto relative min-w-0 bg-white dark:bg-black text-slate-800 dark:text-slate-300 transition-colors">
                  <DebouncedCodeEditor
                    value={selectedTask.type === "edge_function" ? selectedTask.functionCode || "" : selectedTask.sql || ""}
                    onChange={handleSqlChange}
                    taskType={selectedTask.type}
                  />
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-500 dark:text-slate-400 p-8 shadow-inner">
            <Database size={48} className="mb-4 opacity-20" />
            <h2 className="text-lg font-medium text-slate-600 dark:text-slate-300 mb-2">
              No Query Selected
            </h2>
            <p className="text-sm text-center max-w-sm">
              Select a {activeTab === "sql" ? "query" : "function"} from the sidebar or create a new one to start writing code.
            </p>
            <button
              onClick={handleShowTypeSelector}
              className="mt-6 flex items-center gap-2 bg-white dark:bg-[#0a0a0a] border border-slate-200 dark:border-[#2a2a2a] hover:border-blue-500 dark:hover:border-blue-500 hover:text-blue-600 dark:hover:text-blue-400 text-slate-700 dark:text-slate-300 px-4 py-2 rounded-md font-medium transition-colors text-sm shadow-sm"
            >
              <Plus size={16} />
              Create New
            </button>
          </div>
        )}
      </div>

      {/* Type Selector Modal */}
      {showTypeSelector && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={() => setShowTypeSelector(false)}
        >
          <div
            className="bg-white dark:bg-[#0a0a0a] rounded-lg shadow-xl max-w-md w-full p-6 border border-slate-200 dark:border-[#1a1a1a]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                Create New Task
              </h3>
              <button
                onClick={() => setShowTypeSelector(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
              >
                <X size={20} />
              </button>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">
              What type of task do you want to create?
            </p>
            <div className="flex gap-4">
              <button
                onClick={() => handleCreateTask("sql")}
                className="flex-1 border border-slate-200 dark:border-[#2a2a2a] rounded-lg p-4 hover:border-blue-500 dark:hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-500/10 transition-all flex flex-col items-center justify-center gap-3 group text-slate-700 dark:text-slate-300"
              >
                <div className="bg-slate-100 dark:bg-[#121212] p-3 rounded-full group-hover:bg-blue-100 dark:group-hover:bg-blue-900/30 text-slate-500 dark:text-slate-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                  <Database size={24} />
                </div>
                <div className="text-center">
                  <h4 className="font-medium mb-1 dark:text-slate-200">SQL Query</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-500">
                    Create or modify database tables
                  </p>
                </div>
              </button>
              <button
                onClick={() => handleCreateTask("edge_function")}
                className="flex-1 border border-slate-200 dark:border-[#2a2a2a] rounded-lg p-4 hover:border-blue-500 dark:hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-500/10 transition-all flex flex-col items-center justify-center gap-3 group text-slate-700 dark:text-slate-300"
              >
                <div className="bg-slate-100 dark:bg-[#121212] p-3 rounded-full group-hover:bg-blue-100 dark:group-hover:bg-blue-900/30 text-slate-500 dark:text-slate-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                  <FileCode size={24} />
                </div>
                <div className="text-center">
                  <h4 className="font-medium mb-1 dark:text-slate-200">Edge Function</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-500">
                    TypeScript endpoint & secrets
                  </p>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#0a0a0a] rounded-lg shadow-xl max-w-sm w-full p-6 border border-slate-200 dark:border-[#1a1a1a]">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
              Delete Tasks?
            </h3>
            <p className="text-slate-600 dark:text-slate-400 text-sm mb-6">
              Are you sure you want to delete {selectedForDeletion.size}{" "}
              selected {selectedForDeletion.size === 1 ? "task" : "tasks"}?
              This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={isDeleting}
                className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmBulkDelete}
                disabled={isDeleting}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 dark:hover:bg-red-600 rounded-md transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                {isDeleting ? (
                  <>
                    <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Deleting...
                  </>
                ) : (
                  "Delete"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Project Modal */}
      {showNewProjectModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#0a0a0a] rounded-lg shadow-xl max-w-sm w-full p-6 border border-slate-200 dark:border-[#1a1a1a]">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
              Create New Project
            </h3>
            <input
              type="text"
              className="w-full bg-slate-50 dark:bg-[#121212] border border-slate-200 dark:border-[#2a2a2a] rounded-md px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 mb-6"
              placeholder="Project Name"
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              autoFocus
              onKeyDown={async (e) => {
                if (e.key === "Enter" && newProjectName.trim()) {
                  const name = newProjectName.trim();
                  const newProject = { id: crypto.randomUUID(), name, created_at: Date.now() };
                  const { error } = await supabase.from('projects').upsert(newProject);
                  if (!error) {
                    setProjects([...projects, { id: newProject.id, name: newProject.name, createdAt: newProject.created_at }]);
                    navigate(`/p/${newProject.id}`);
                    setShowNewProjectModal(false);
                    setNewProjectName("");
                  } else {
                    toast.error("Failed to create project");
                  }
                } else if (e.key === "Escape") {
                  setShowNewProjectModal(false);
                  setNewProjectName("");
                }
              }}
            />
            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowNewProjectModal(false);
                  setNewProjectName("");
                }}
                className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-colors"
              >
                Cancel
              </button>
              <button
                disabled={!newProjectName.trim()}
                onClick={async () => {
                  if (newProjectName.trim()) {
                    const name = newProjectName.trim();
                    const newProject = { id: crypto.randomUUID(), name, created_at: Date.now() };
                    const { error } = await supabase.from('projects').upsert(newProject);
                    if (!error) {
                      setProjects([...projects, { id: newProject.id, name: newProject.name, createdAt: newProject.created_at }]);
                      navigate(`/p/${newProject.id}`);
                      setShowNewProjectModal(false);
                      setNewProjectName("");
                    } else {
                      toast.error("Failed to create project");
                    }
                  }
                }}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors disabled:opacity-50"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Project Confirm Modal */}
      {projectToDelete && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#0a0a0a] rounded-lg shadow-xl max-w-sm w-full p-6 border border-slate-200 dark:border-[#1a1a1a]">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
              Delete Project
            </h3>
            <p className="text-slate-600 dark:text-slate-400 text-sm mb-6">
              Are you sure you want to delete <span className="font-semibold">{projectToDelete.name}</span> and all of its tasks? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setProjectToDelete(null)}
                disabled={isDeleting}
                className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                disabled={isDeleting}
                onClick={async () => {
                  setIsDeleting(true);
                  try {
                    // Manual cascade: Delete tasks first (includes both sql and edge_function tasks)
                    await supabase.from('tasks').delete().eq('project_id', projectToDelete.id);
                    // Cascade delete for folders
                    await supabase.from('folders').delete().eq('project_id', projectToDelete.id);
                    // Then delete project
                    const { error } = await supabase.from('projects').delete().eq('id', projectToDelete.id);
                    if (error) throw error;
                    
                    const newProjects = projects.filter(p => p.id !== projectToDelete.id);
                    setProjects(newProjects);
                    if (selectedProjectId === projectToDelete.id) {
                      navigate(newProjects.length > 0 ? `/p/${newProjects[0].id}` : "/");
                    }
                    toast.success('Project deleted');
                  } catch (err) {
                    toast.error('Failed to delete project');
                  } finally {
                    setIsDeleting(false);
                    setProjectToDelete(null);
                  }
                }}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-md transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                {isDeleting ? "Deleting..." : "Delete Project"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rename Project Modal */}
      {projectToRename && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#0a0a0a] rounded-lg shadow-xl max-w-sm w-full p-6 border border-slate-200 dark:border-[#1a1a1a]">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
              Rename Project
            </h3>
            <input
              type="text"
              className="w-full bg-slate-50 dark:bg-[#121212] border border-slate-200 dark:border-[#2a2a2a] rounded-md px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 mb-6"
              placeholder="Project Name"
              value={renameProjectName}
              onChange={(e) => setRenameProjectName(e.target.value)}
              autoFocus
              onKeyDown={async (e) => {
                if (e.key === "Enter" && renameProjectName.trim()) {
                  const name = renameProjectName.trim();
                  const { error } = await supabase.from('projects').update({ name }).eq('id', projectToRename.id);
                  if (!error) {
                    setProjects(projects.map(p => p.id === projectToRename.id ? { ...p, name } : p));
                    toast.success("Project renamed");
                    setProjectToRename(null);
                  } else {
                    toast.error("Failed to rename project");
                  }
                } else if (e.key === "Escape") {
                  setProjectToRename(null);
                }
              }}
            />
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setProjectToRename(null)}
                className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-colors"
              >
                Cancel
              </button>
              <button
                disabled={!renameProjectName.trim()}
                onClick={async () => {
                  if (renameProjectName.trim()) {
                    const name = renameProjectName.trim();
                    const { error } = await supabase.from('projects').update({ name }).eq('id', projectToRename.id);
                    if (!error) {
                      setProjects(projects.map(p => p.id === projectToRename.id ? { ...p, name } : p));
                      toast.success("Project renamed");
                      setProjectToRename(null);
                    } else {
                      toast.error("Failed to rename project");
                    }
                  }
                }}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors disabled:opacity-50"
              >
                Rename
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Diff Viewer Modal */}
      {isDiffViewerOpen && selectedProjectId && projects.find(p => p.id === selectedProjectId)?.name.endsWith(' [STAGING]') && (
        <DiffViewer
          theme={theme}
          onClose={() => setIsDiffViewerOpen(false)}
          stagingProjectId={selectedProjectId}
          prodProjectId={projects.find(p => p.name === projects.find(pp => pp.id === selectedProjectId)!.name.replace(' [STAGING]', ''))?.id!}
          isMerging={isMerging}
          onMerge={() => {
            setIsDiffViewerOpen(false);
            handleMergeToProduction();
          }}
        />
      )}
    </div>
  );
}
