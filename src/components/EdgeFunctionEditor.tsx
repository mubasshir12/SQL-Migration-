import React, { useState, useEffect } from "react";
import {
  Plus,
  Trash2,
  Key,
  FileCode,
  Check,
  Copy,
  Pencil,
  X,
  MoreVertical,
} from "lucide-react";
import Editor from "react-simple-code-editor";
import Prism from "prismjs";
import { SqlTask, EdgeFile, EdgeSecret } from "../types";
import { cn } from "../lib/utils";
import { useLocalStorage } from "../hooks/useLocalStorage";
import { DebouncedCodeEditor, DebouncedTitleInput } from "../App";
import "prismjs/components/prism-javascript";
import "prismjs/components/prism-typescript";

interface EdgeFunctionEditorProps {
  task: SqlTask;
  onUpdate: (updates: Partial<SqlTask>) => void;
}

export default function EdgeFunctionEditor({
  task,
  onUpdate,
}: EdgeFunctionEditorProps) {
  const edgeFiles = task.edgeFiles || [];
  const edgeSecrets = task.edgeSecrets || [];

  const [activeFileId, setActiveFileId] = useState<string | null>(
    edgeFiles[0]?.id || null,
  );
  const [activeTab, setActiveTab] = useState<"files" | "secrets">("files");
  const [copied, setCopied] = useState(false);

  const [editingFileId, setEditingFileId] = useState<string | null>(null);
  const [editingFileName, setEditingFileName] = useState("");

  const [sidebarWidth, setSidebarWidth] = useLocalStorage("edgeSidebarWidth", 0);
  const [isResizing, setIsResizing] = useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    // If not set yet, set to 40% on initial mount or when layout is ready
    const handleInitialLayout = () => {
      if (sidebarWidth === 0 && containerRef.current && containerRef.current.clientWidth > 0) {
        setSidebarWidth(containerRef.current.clientWidth * 0.4);
      }
    };
    
    // Check immediately
    handleInitialLayout();
    
    // Check after a brief delay for any layout shifts
    const timer = setTimeout(handleInitialLayout, 100);
    return () => clearTimeout(timer);
  }, [sidebarWidth, setSidebarWidth]);

  // Drag to resize sidebar
  React.useEffect(() => {
    const handleMouseMove = (e: MouseEvent | TouchEvent) => {
      if (!isResizing || !containerRef.current) return;
      
      let clientX = 0;
      if ('touches' in e) {
        clientX = e.touches[0].clientX;
      } else {
        clientX = e.clientX;
      }

      const rect = containerRef.current.getBoundingClientRect();
      const newWidth = clientX - rect.left;
      setSidebarWidth(Math.min(Math.max(newWidth, 100), typeof window !== 'undefined' ? window.innerWidth - 50 : 600));
    };
    const handleMouseUp = () => setIsResizing(false);

    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove as EventListener);
      document.addEventListener("mouseup", handleMouseUp);
      document.addEventListener("touchmove", handleMouseMove as EventListener);
      document.addEventListener("touchend", handleMouseUp);
    }
    return () => {
      document.removeEventListener("mousemove", handleMouseMove as EventListener);
      document.removeEventListener("mouseup", handleMouseUp);
      document.removeEventListener("touchmove", handleMouseMove as EventListener);
      document.removeEventListener("touchend", handleMouseUp);
    };
  }, [isResizing]);

  // Context menu handling
  const [menuFileId, setMenuFileId] = useState<string | null>(null);
  const [longPressTimer, setLongPressTimer] = useState<NodeJS.Timeout | null>(
    null,
  );

  const startLongPress = (id: string) => {
    const timer = setTimeout(() => {
      setMenuFileId(id);
    }, 500);
    setLongPressTimer(timer);
  };

  const cancelLongPress = () => {
    if (longPressTimer) clearTimeout(longPressTimer);
  };

  const activeFile = edgeFiles.find((f) => f.id === activeFileId);

  const handleAddFile = () => {
    const newFile: EdgeFile = {
      id: crypto.randomUUID(),
      name: `file_${edgeFiles.length + 1}.ts`,
      code: "",
    };
    onUpdate({ edgeFiles: [...edgeFiles, newFile] });
    setActiveFileId(newFile.id);
  };

  const handleUpdateFileCode = (code: string) => {
    if (!activeFileId) return;
    const newFiles = edgeFiles.map((f) =>
      f.id === activeFileId ? { ...f, code } : f,
    );
    onUpdate({ edgeFiles: newFiles });
  };

  const handleDeleteFile = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newFiles = edgeFiles.filter((f) => f.id !== id);
    onUpdate({ edgeFiles: newFiles });
    if (activeFileId === id) {
      setActiveFileId(newFiles[0]?.id || null);
    }
  };

  const handleStartRenameFile = (file: EdgeFile, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingFileId(file.id);
    setEditingFileName(file.name);
  };

  const handleSaveRenameFile = () => {
    if (editingFileId && editingFileName.trim()) {
      const newFiles = edgeFiles.map((f) =>
        f.id === editingFileId ? { ...f, name: editingFileName.trim() } : f,
      );
      onUpdate({ edgeFiles: newFiles });
    }
    setEditingFileId(null);
  };

  const handleAddSecret = () => {
    const newSecret: EdgeSecret = {
      id: crypto.randomUUID(),
      key: "",
      value: "",
    };
    onUpdate({ edgeSecrets: [...edgeSecrets, newSecret] });
  };

  const handleUpdateSecret = (id: string, updates: Partial<EdgeSecret>) => {
    const newSecrets = edgeSecrets.map((s) =>
      s.id === id ? { ...s, ...updates } : s,
    );
    onUpdate({ edgeSecrets: newSecrets });
  };

  const handleDeleteSecret = (id: string) => {
    onUpdate({ edgeSecrets: edgeSecrets.filter((s) => s.id !== id) });
  };

  const handleCopyCode = async () => {
    if (activeFile) {
      try {
        await navigator.clipboard.writeText(activeFile.code);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (err) {
        console.error("Failed to copy", err);
      }
    }
  };

  return (
    <div
      className="flex h-full w-full bg-white dark:bg-black relative flex-row transition-colors"
      ref={containerRef}
    >
      {/* Sidebar for Files and Secrets */}
      <div
        className="border-r border-slate-200 dark:border-[#2a2a2a] flex flex-col bg-slate-50 dark:bg-[#0a0a0a] relative shrink-0 z-10 transition-colors"
        style={{ width: sidebarWidth ? `${sidebarWidth}px` : "40%" }}
      >
        <div className="flex border-b border-slate-200 dark:border-[#2a2a2a] transition-colors">
          <button
            onClick={() => setActiveTab("files")}
            className={cn(
              "flex-1 py-2 text-xs font-medium text-center border-b-2 transition-colors",
              activeTab === "files"
                ? "border-blue-500 text-blue-600 dark:text-blue-400"
                : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300",
            )}
          >
            Files
          </button>
          <button
            onClick={() => setActiveTab("secrets")}
            className={cn(
              "flex-1 py-2 text-xs font-medium text-center border-b-2 transition-colors",
              activeTab === "secrets"
                ? "border-blue-500 text-blue-600 dark:text-blue-400"
                : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300",
            )}
          >
            Secrets
          </button>
        </div>

        {activeTab === "files" && (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="flex items-center justify-between p-3 border-b border-slate-200 dark:border-[#2a2a2a]/50 transition-colors">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Explorer
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={handleAddFile}
                  className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 ml-1 transition-colors"
                  title="New File"
                >
                  <Plus size={14} />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto py-1 relative">
              {menuFileId && (
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setMenuFileId(null)}
                />
              )}
              {edgeFiles.map((file) => (
                <div
                  key={file.id}
                  onClick={() => {
                    setActiveFileId(file.id);
                    setMenuFileId(null);
                  }}
                  onPointerDown={() => startLongPress(file.id)}
                  onPointerUp={cancelLongPress}
                  onPointerLeave={cancelLongPress}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    setMenuFileId(file.id);
                  }}
                  className={cn(
                    "flex items-center gap-2 py-1.5 px-3 text-sm cursor-pointer group relative transition-colors",
                    activeFileId === file.id
                      ? "bg-blue-100 dark:bg-blue-600/20 text-blue-700 dark:text-blue-400"
                      : "text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-300",
                  )}
                >
                  <FileCode size={14} className="shrink-0" />

                  {editingFileId === file.id ? (
                    <input
                      type="text"
                      className="flex-1 min-w-0 bg-white dark:bg-[#0a0a0a] border border-blue-400 dark:border-slate-600 rounded px-1 text-xs text-slate-900 dark:text-white outline-none focus:border-blue-500 transition-colors"
                      value={editingFileName}
                      onChange={(e) => setEditingFileName(e.target.value)}
                      onBlur={() => {
                        handleSaveRenameFile();
                        setMenuFileId(null);
                      }}
                      onKeyDown={(e) =>
                        e.key === "Enter" && handleSaveRenameFile()
                      }
                      onClick={(e) => e.stopPropagation()}
                      autoFocus
                    />
                  ) : (
                    <span className="flex-1 truncate select-none">
                      {file.name}
                    </span>
                  )}

                  {!editingFileId && (
                    <div className="items-center gap-1 shrink-0 flex opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                      <button
                        className="p-1 text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-white rounded hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors"
                        onClick={(e) => {
                          e.stopPropagation();
                          setMenuFileId(
                            menuFileId === file.id ? null : file.id,
                          );
                        }}
                      >
                        <MoreVertical size={14} />
                      </button>
                    </div>
                  )}

                  {menuFileId === file.id && (
                    <div className="absolute top-8 right-2 w-32 bg-white dark:bg-[#121212] border border-slate-200 dark:border-slate-600 rounded-md shadow-xl py-1 z-50 text-slate-700 dark:text-slate-200 transition-colors">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleStartRenameFile(file, e);
                          setMenuFileId(null);
                        }}
                        className="w-full text-left px-3 py-1.5 text-xs hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2 transition-colors"
                      >
                        <Pencil size={12} /> Rename
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteFile(file.id, e);
                          setMenuFileId(null);
                        }}
                        className="w-full text-left px-3 py-1.5 text-xs hover:bg-red-50 dark:hover:bg-slate-700 text-red-600 dark:text-red-400 flex items-center gap-2 transition-colors"
                      >
                        <Trash2 size={12} /> Delete
                      </button>
                    </div>
                  )}
                </div>
              ))}
              {edgeFiles.length === 0 && (
                <div className="text-xs text-slate-500 text-center py-4">
                  No files
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === "secrets" && (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="flex items-center justify-between p-3 border-b border-slate-200 dark:border-[#2a2a2a]/50 transition-colors">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Environment Vars
              </span>
              <button
                onClick={handleAddSecret}
                className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 transition-colors"
                title="Add Secret"
              >
                <Plus size={14} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-3">
              {edgeSecrets.map((secret) => (
                <div
                  key={secret.id}
                  className="bg-white dark:bg-[#121212] rounded p-2 border border-slate-200 dark:border-[#2a2a2a] relative group transition-colors shadow-sm dark:shadow-none"
                >
                  <div className="flex items-center justify-between mb-2">
                    <Key size={12} className="text-emerald-500 dark:text-amber-400" />
                    <button
                      onClick={() => handleDeleteSecret(secret.id)}
                      className="text-slate-400 dark:text-slate-500 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                    >
                      <X size={14} />
                    </button>
                  </div>
                  <DebouncedTitleInput
                    placeholder="KEY_NAME"
                    value={secret.key}
                    onChange={(newVal) =>
                      handleUpdateSecret(secret.id, { key: newVal })
                    }
                    className="w-full bg-slate-50 dark:bg-[#0a0a0a] border border-slate-200 dark:border-[#2a2a2a] rounded px-2 py-1 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-600 outline-none focus:border-blue-500 mb-2 font-mono uppercase transition-colors"
                  />
                  <DebouncedTitleInput
                    placeholder="Value (e.g. sk_live_...)"
                    value={secret.value}
                    onChange={(newVal) =>
                      handleUpdateSecret(secret.id, { value: newVal })
                    }
                    className="w-full bg-slate-50 dark:bg-[#0a0a0a] border border-slate-200 dark:border-[#2a2a2a] rounded px-2 py-1 text-xs text-slate-900 dark:text-slate-300 placeholder:text-slate-400 dark:placeholder:text-slate-600 outline-none focus:border-blue-500 font-mono transition-colors"
                  />
                </div>
              ))}
              {edgeSecrets.length === 0 && (
                <div className="text-xs text-slate-500 text-center py-4">
                  No secrets defined
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Resize Handle */}
      <div
        className="group w-4 cursor-col-resize absolute top-0 bottom-0 z-20 transition-colors hover:bg-blue-500/10 active:bg-blue-500/10 flex justify-center -ml-2"
        style={{ left: sidebarWidth }}
        onMouseDown={(e) => {
          e.preventDefault();
          setIsResizing(true);
        }}
        onTouchStart={(e) => {
          setIsResizing(true);
        }}
      >
        <div className="absolute inset-y-0 w-[2px] bg-slate-300 dark:bg-slate-600 group-hover:bg-blue-500 transition-colors" />
      </div>

      {/* Main Editor Area */}
      <div className="flex-1 flex flex-col min-w-0 bg-white dark:bg-black transition-colors">
        {activeFile ? (
          <>
            <div className="flex items-center justify-between px-4 py-2 bg-slate-50 dark:bg-black border-b border-slate-200 dark:border-slate-700/50 transition-colors">
              <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300 text-sm font-mono leading-none">
                <FileCode size={14} className="text-blue-500 dark:text-blue-400" />
                {activeFile.name}
              </div>
              <button
                onClick={handleCopyCode}
                className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors px-2 py-1 text-xs rounded bg-slate-200 dark:bg-slate-800 border border-transparent hover:bg-slate-300 dark:hover:bg-slate-700 shadow-none"
              >
                {copied ? (
                  <Check size={14} className="text-emerald-500 dark:text-emerald-400" />
                ) : (
                  <Copy size={14} />
                )}
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
            <div className="flex-1 overflow-auto relative min-w-0 bg-white dark:bg-black text-slate-800 dark:text-slate-300">
              <DebouncedCodeEditor
                value={activeFile.code}
                onChange={handleUpdateFileCode}
                taskType="edge_function"
              />
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-500 dark:text-slate-500">
            <FileCode size={48} className="opacity-20 mb-4" />
            <p className="text-sm">No file selected.</p>
            <button
              onClick={handleAddFile}
              className="mt-4 text-xs font-medium text-blue-500 dark:text-blue-400 hover:text-blue-600 dark:hover:text-blue-300 underline"
            >
              Create one
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
