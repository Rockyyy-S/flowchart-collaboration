export const OPEN_WORKSPACE_SEARCH_EVENT = 'flowkit:open-workspace-search';

export interface WorkspaceSearchDetail {
  query?: string;
  source?: 'header' | 'shortcut';
}

declare global {
  interface WindowEventMap {
    [OPEN_WORKSPACE_SEARCH_EVENT]: CustomEvent<WorkspaceSearchDetail>;
  }
}
