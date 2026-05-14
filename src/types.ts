export type TaskStatus = 'pending' | 'ran' | 'error';

export interface EdgeFile {
  id: string;
  name: string;
  code: string;
}

export interface EdgeSecret {
  id: string;
  key: string;
  value: string;
}

export interface SqlTask {
  id: string;
  title: string;
  type?: 'sql' | 'edge_function';
  sql: string;
  functionCode?: string;
  description?: string;
  edgeFiles?: EdgeFile[];
  edgeSecrets?: EdgeSecret[];
  status: TaskStatus;
  folderId: string | null;
  projectId: string | null;
  createdAt: number;
  updatedAt: number;
  orderIndex?: number;
  productionTaskId?: string;
}

export interface Project {
  id: string;
  name: string;
  createdAt: number;
}

export interface Folder {
  id: string;
  name: string;
  createdAt: number;
}

export interface HistoryLog {
  id: string;
  taskId: string;
  title: string;
  sql: string;
  status: TaskStatus;
  timestamp: number;
}
