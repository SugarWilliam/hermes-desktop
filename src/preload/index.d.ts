import type { AppLocale } from "../shared/i18n/types";
import type { Attachment } from "../shared/attachments";

interface ElectronAPI {
  process: {
    platform: NodeJS.Platform;
    versions: {
      chrome: string;
      electron: string;
      node: string;
    };
  };
}

interface InstallStatus {
  installed: boolean;
  configured: boolean;
  hasApiKey: boolean;
  verified: boolean;
  activeProfile?: string;
}

interface InstallProgress {
  step: number;
  totalSteps: number;
  title: string;
  detail: string;
  log: string;
}

/**
 * Shape of a credential-pool entry as the upstream engine expects
 * (issue #367). Old entries written by the renderer with just
 * `{key, label}` are still readable via the optional `key` field.
 * New entries written from the UI use the canonical shape.
 */
interface CredentialPoolEntry {
  id?: string;
  label?: string;
  auth_type?: "api_key" | "oauth_device_code" | string;
  priority?: number;
  source?: string;
  access_token?: string;
  refresh_token?: string;
  api_key?: string;
  base_url?: string;
  request_count?: number;
  /** Legacy field for backward compat with old auth.json shapes. */
  key?: string;
}

interface KanbanTask {
  id: string;
  title: string;
  body: string | null;
  assignee: string | null;
  status: string;
  priority: number;
  tenant: string | null;
  workspace_kind: string;
  workspace_path: string | null;
  created_by: string | null;
  created_at: number | null;
  started_at: number | null;
  completed_at: number | null;
  result: string | null;
  skills: string[];
  max_retries: number | null;
}

interface KanbanBoard {
  slug: string;
  name: string;
  description?: string | null;
  icon?: string | null;
  color?: string | null;
  is_current: boolean;
  archived?: boolean;
  total: number;
  counts: Record<string, number>;
  db_path?: string;
}

interface KanbanComment {
  id: number;
  task_id: string;
  author: string | null;
  body: string;
  created_at: number;
}

interface KanbanEvent {
  id: number;
  task_id: string;
  kind: string;
  payload: Record<string, unknown> | null;
  created_at: number;
  run_id: number | null;
}

interface KanbanRun {
  id: number;
  task_id: string;
  profile: string | null;
  status: string | null;
  outcome: string | null;
  summary: string | null;
  error: string | null;
  started_at: number | null;
  ended_at: number | null;
  last_heartbeat_at: number | null;
}

interface KanbanTaskDetail {
  task: KanbanTask;
  comments: KanbanComment[];
  events: KanbanEvent[];
  parents: string[];
  children: string[];
  runs: KanbanRun[];
  latest_summary: string | null;
}

interface KanbanCreateTaskInput {
  title: string;
  body?: string;
  assignee?: string;
  priority?: number;
  tenant?: string;
  workspace?: string;
  triage?: boolean;
  skills?: string[];
  maxRetries?: number;
}

interface HermesAPI {
  // Installation
  checkInstall: () => Promise<InstallStatus>;
  verifyInstall: () => Promise<boolean>;
  startInstall: () => Promise<{ success: boolean; error?: string }>;
  inspectInstallTarget: () => Promise<{
    hermesHome: string;
    repoPath: string;
    state: "fresh" | "update" | "replace";
  }>;
  validateHermesHome: (dir: string) => Promise<boolean>;
  adoptHermesHome: (dir: string) => Promise<boolean>;
  quitApp: () => Promise<void>;
  onInstallProgress: (
    callback: (progress: InstallProgress) => void,
  ) => () => void;

  // Hermes engine info
  getHermesVersion: () => Promise<string | null>;
  refreshHermesVersion: () => Promise<string | null>;
  runHermesDoctor: () => Promise<string>;
  runHermesUpdate: () => Promise<{ success: boolean; error?: string }>;

  // OpenClaw migration
  checkOpenClaw: () => Promise<{ found: boolean; path: string | null }>;
  runClawMigrate: () => Promise<{ success: boolean; error?: string }>;

  // OAuth provider sign-in
  oauthLogin: (
    provider: string,
    profile?: string,
  ) => Promise<{ success: boolean; error?: string }>;
  cancelOAuthLogin: () => Promise<boolean>;
  onOAuthLoginProgress: (callback: (chunk: string) => void) => () => void;

  getLocale: () => Promise<AppLocale>;
  setLocale: (locale: AppLocale) => Promise<AppLocale>;

  // Configuration (profile-aware)
  getEnv: (profile?: string) => Promise<Record<string, string>>;
  setEnv: (key: string, value: string, profile?: string) => Promise<boolean>;
  getConfig: (key: string, profile?: string) => Promise<string | null>;
  setConfig: (key: string, value: string, profile?: string) => Promise<boolean>;
  getHermesHome: (profile?: string) => Promise<string>;
  getModelConfig: (
    profile?: string,
  ) => Promise<{ provider: string; model: string; baseUrl: string }>;
  setModelConfig: (
    provider: string,
    model: string,
    baseUrl: string,
    profile?: string,
  ) => Promise<boolean>;

  // Connection mode (local / remote / ssh)
  isRemoteMode: () => Promise<boolean>;
  isRemoteOnlyMode: () => Promise<boolean>;
  getConnectionConfig: () => Promise<{
    mode: "local" | "remote" | "ssh";
    remoteUrl: string;
    hasApiKey: boolean;
    apiKeyLength: number;
    ssh: {
      host: string;
      port: number;
      username: string;
      keyPath: string;
      remotePort: number;
      localPort: number;
    };
  }>;
  setConnectionConfig: (
    mode: "local" | "remote" | "ssh",
    remoteUrl: string,
    apiKey?: string,
  ) => Promise<boolean>;
  setSshConfig: (
    host: string,
    port: number,
    username: string,
    keyPath: string,
    remotePort: number,
    localPort: number,
  ) => Promise<boolean>;
  testRemoteConnection: (url: string, apiKey?: string) => Promise<boolean>;
  testSshConnection: (
    host: string,
    port: number,
    username: string,
    keyPath: string,
    remotePort: number,
  ) => Promise<boolean>;
  isSshTunnelActive: () => Promise<boolean>;
  startSshTunnel: () => Promise<boolean>;
  stopSshTunnel: () => Promise<boolean>;

  // Chat
  sendMessage: (
    message: string,
    profile?: string,
    resumeSessionId?: string,
    history?: Array<{ role: string; content: string }>,
    attachments?: Attachment[],
    contextFolder?: string,
    chatMode?: import("../shared/chatMode").ChatMode,
  ) => Promise<{ response: string; sessionId?: string }>;
  abortChat: () => Promise<void>;
  getApiServerKeyStatus: (profile?: string) => Promise<{ hasKey: boolean }>;
  generateApiServerKey: (profile?: string) => Promise<{ key: string }>;
  copyToClipboard: (text: string) => Promise<void>;
  onContextMenuCopyChat: (
    callback: (format: "text" | "markdown") => void,
  ) => () => void;
  onContextMenuSelectBubble: (
    callback: (point: { x: number; y: number }) => void,
  ) => () => void;
  onContextMenuAddToChat: (callback: (text: string) => void) => () => void;
  workspaceListDir: (
    root: string,
    relativePath?: string,
  ) => Promise<Array<{ name: string; path: string; isDirectory: boolean }>>;
  workspaceGitStatus: (
    root: string,
  ) => Promise<Record<string, "modified" | "added" | "deleted" | "untracked">>;
  gitCommit: (
    root: string,
    message: string,
    files?: string[],
  ) => Promise<{ success: boolean; error?: string }>;
  gitPush: (root: string) => Promise<{ success: boolean; error?: string }>;
  gitPull: (
    root: string,
  ) => Promise<{ success: boolean; error?: string; output?: string }>;
  gitBranches: (
    root: string,
  ) => Promise<{ current: string; branches: string[] }>;
  gitSwitchBranch: (
    root: string,
    branch: string,
  ) => Promise<{ success: boolean; error?: string }>;
  gitDiff: (root: string, file?: string) => Promise<string>;
  workspaceReadFile: (
    root: string,
    filePath: string,
  ) => Promise<{ content: string; truncated: boolean }>;
  readAttachmentFile: (
    absPath: string,
  ) => Promise<{ content: string; truncated: boolean; name: string }>;
  workspaceWriteFile: (
    root: string,
    filePath: string,
    content: string,
  ) => Promise<boolean>;
  workspacePickFiles: () => Promise<string[]>;
  applyDiff: (
    root: string,
    diff: string,
  ) => Promise<{
    files: string[];
    backupDir: string | null;
    errors: string[];
  }>;
  showPopupMenu: (
    items: Array<{
      id: string;
      label: string;
      enabled?: boolean;
      type?: "separator";
    }>,
  ) => Promise<string | null>;
  readMediaFile: (filePath: string) => Promise<string | null>;
  saveMediaFile: (src: string, name: string) => Promise<boolean>;
  mediaFileExists: (filePath: string) => Promise<boolean>;
  showMediaMenu: (
    src: string,
    name: string,
    labels: { open: string; saveAs: string },
  ) => void;
  getPathForFile: (file: File) => string;
  stageAttachment: (
    sessionId: string,
    filename: string,
    base64Bytes: string,
  ) => Promise<string>;
  clearStagedAttachments: (sessionId: string) => Promise<void>;
  discoverProviderModels: (
    provider: string,
    baseUrl?: string,
    apiKey?: string,
    profile?: string,
  ) => Promise<{
    models: string[];
    status: "ok" | "no-key" | "unsupported" | "unknown-host";
    cached: boolean;
    /** Subset of `models` flagged as free (Nous Portal today). #367. */
    freeModels?: string[];
  }>;
  onChatChunk: (callback: (chunk: string) => void) => () => void;
  onChatReasoningChunk: (callback: (chunk: string) => void) => () => void;
  onChatSessionId: (callback: (sessionId: string) => void) => () => void;
  onChatDone: (callback: (sessionId?: string) => void) => () => void;
  onChatToolProgress: (callback: (tool: string) => void) => () => void;
  onChatUsage: (
    callback: (usage: {
      promptTokens: number;
      completionTokens: number;
      totalTokens: number;
      cost?: number;
      rateLimitRemaining?: number;
      rateLimitReset?: number;
    }) => void,
  ) => () => void;
  onChatError: (
    callback: (payload: string | { error: string; sessionId?: string }) => void,
  ) => () => void;

  // Gateway
  startGateway: () => Promise<boolean>;
  stopGateway: () => Promise<boolean>;
  gatewayStatus: () => Promise<boolean>;
  getGatewayMetrics: (profile?: string) => Promise<{
    totalRequests: number;
    totalErrors: number;
    avgLatencyMs: number;
    uptime: number;
    platformStats: Record<string, { requests: number; errors: number }>;
    recentRequests: Array<{ timestamp: number; path: string; status: number; latencyMs: number }>;
  } | null>;

  // Platform toggles
  getPlatformEnabled: (profile?: string) => Promise<Record<string, boolean>>;
  setPlatformEnabled: (
    platform: string,
    enabled: boolean,
    profile?: string,
  ) => Promise<boolean>;
  getPlatformConfig: (
    platform: string,
    profile?: string,
  ) => Promise<Record<string, string>>;
  setPlatformConfigValue: (
    platform: string,
    key: string,
    value: string,
    profile?: string,
  ) => Promise<boolean>;

  // Sessions
  listSessions: (
    limit?: number,
    offset?: number,
  ) => Promise<
    Array<{
      id: string;
      source: string;
      startedAt: number;
      endedAt: number | null;
      messageCount: number;
      model: string;
      title: string | null;
      preview: string;
    }>
  >;
  getSessionMessages: (sessionId: string) => Promise<
    Array<
      | {
          kind: "user";
          id: number;
          content: string;
          timestamp: number;
          attachments?: Attachment[];
        }
      | {
          kind: "assistant";
          id: number;
          content: string;
          timestamp: number;
          attachments?: Attachment[];
        }
      | {
          kind: "reasoning";
          id: number;
          assistantId: number;
          text: string;
          timestamp: number;
        }
      | {
          kind: "tool_call";
          id: number;
          assistantId: number;
          callId: string;
          name: string;
          args: string;
          timestamp: number;
        }
      | {
          kind: "tool_result";
          id: number;
          callId: string;
          name: string;
          content: string;
          timestamp: number;
          attachments?: Attachment[];
        }
    >
  >;
  generateLlmSummary: (
    messages: Array<{ role: string; content: string }>,
    profile?: string,
  ) => Promise<{ success: boolean; summary?: string; error?: string }>;

  // Bookmarks
  addBookmark: (
    sessionId: string, messageId: number, note?: string,
  ) => Promise<{ id: number; sessionId: string; messageId: number; note: string; createdAt: number } | null>;
  removeBookmark: (id: number) => Promise<boolean>;
  listBookmarks: () => Promise<Array<{
    id: number; sessionId: string; messageId: number; note: string; createdAt: number; sessionTitle?: string | null;
  }>>;
  updateBookmarkNote: (id: number, note: string) => Promise<boolean>;

  // Profiles
  listProfiles: () => Promise<
    Array<{
      name: string;
      path: string;
      isDefault: boolean;
      isActive: boolean;
      model: string;
      provider: string;
      hasEnv: boolean;
      hasSoul: boolean;
      skillCount: number;
      gatewayRunning: boolean;
    }>
  >;
  createProfile: (
    name: string,
    clone: boolean,
  ) => Promise<{ success: boolean; error?: string }>;
  deleteProfile: (
    name: string,
  ) => Promise<{ success: boolean; error?: string }>;
  setActiveProfile: (name: string) => Promise<boolean>;

  // Memory
  readMemory: (profile?: string) => Promise<{
    memory: { content: string; exists: boolean; lastModified: number | null };
    user: { content: string; exists: boolean; lastModified: number | null };
    stats: { totalSessions: number; totalMessages: number };
  }>;

  addMemoryEntry: (
    content: string,
    profile?: string,
  ) => Promise<{ success: boolean; error?: string }>;
  updateMemoryEntry: (
    index: number,
    content: string,
    profile?: string,
  ) => Promise<{ success: boolean; error?: string }>;
  removeMemoryEntry: (index: number, profile?: string) => Promise<boolean>;
  writeUserProfile: (
    content: string,
    profile?: string,
  ) => Promise<{ success: boolean; error?: string }>;

  // Memory search (FTS)
  searchMemory: (
    query: string,
    profile?: string,
  ) => Promise<Array<{ index: number; content: string; snippet: string }>>;

  // Rules
  searchWorkspaceFiles: (root: string, query: string) => Promise<string[]>;

  listRules: (profile?: string) => Promise<
    Array<{
      name: string;
      type: "always_on" | "model_decision" | "glob";
      glob: string;
      description: string;
      priority: number;
      path: string;
    }>
  >;
  readRuleContent: (rulePath: string) => Promise<{
    meta: {
      name: string;
      type: "always_on" | "model_decision" | "glob";
      glob: string;
      description: string;
      priority: number;
      path: string;
    };
    body: string;
  } | null>;
  createRule: (
    name: string,
    type: "always_on" | "model_decision" | "glob",
    glob: string,
    description: string,
    body: string,
    priority?: number,
    profile?: string,
  ) => Promise<{ success: boolean; error?: string; path?: string }>;
  updateRule: (
    name: string,
    updates: {
      type?: "always_on" | "model_decision" | "glob";
      glob?: string;
      description?: string;
      body?: string;
      priority?: number;
    },
    profile?: string,
  ) => Promise<{ success: boolean; error?: string }>;
  deleteRule: (
    name: string,
    profile?: string,
  ) => Promise<{ success: boolean; error?: string }>;
  matchGlobRules: (
    filePath: string,
    profile?: string,
  ) => Promise<
    Array<{
      name: string;
      type: "always_on" | "model_decision" | "glob";
      glob: string;
      description: string;
      priority: number;
      path: string;
    }>
  >;

  // MRAG (Multi-modal RAG)
  mragCreateKB: (
    name: string,
    profile?: string,
  ) => Promise<{ success: boolean; error?: string; key?: string }>;
  mragListKBs: (profile?: string) => Promise<
    Array<{
      key: string;
      name: string;
      path: string;
      docCount: number;
      chunkCount: number;
      createdAt: number;
      updatedAt: number;
    }>
  >;
  mragGetKBInfo: (key: string, profile?: string) => Promise<{
    key: string;
    name: string;
    path: string;
    docCount: number;
    chunkCount: number;
    createdAt: number;
    updatedAt: number;
  } | null>;
  mragRenameKB: (
    key: string,
    newName: string,
    profile?: string,
  ) => Promise<{ success: boolean; error?: string }>;
  mragDeleteKB: (
    key: string,
    profile?: string,
  ) => Promise<{ success: boolean; error?: string }>;
  mragIndexKB: (
    key: string,
    docDir: string,
    profile?: string,
  ) => Promise<{
    success: boolean;
    parentCount: number;
    subCount: number;
    skipped: number;
    errors: string[];
  }>;
  mragIncrementalIndexKB: (
    key: string,
    docDir: string,
    profile?: string,
  ) => Promise<{
    success: boolean;
    added: number;
    removed: number;
    skipped: number;
    errors: string[];
  }>;
  mragAddDoc: (
    key: string,
    filePath: string,
    profile?: string,
  ) => Promise<{ success: boolean; parentCount: number; error?: string }>;
  mragRemoveDoc: (
    key: string,
    docPath: string,
    profile?: string,
  ) => Promise<void>;
  mragSearchKB: (
    key: string,
    query: string,
    topK?: number,
    profile?: string,
  ) => Promise<
    Array<{
      score: number;
      parentContent: string;
      subSnippet: string;
      docPath: string;
      sectionTitle: string;
      parentId: number;
    }>
  >;
  mragSearchAllKBs: (
    query: string,
    topK?: number,
    profile?: string,
  ) => Promise<
    Record<
      string,
      Array<{
        score: number;
        parentContent: string;
        subSnippet: string;
        docPath: string;
        sectionTitle: string;
        parentId: number;
      }>
    >
  >;
  mragGetChunkCount: (key: string, profile?: string) => Promise<number>;

  // Soul
  readSoul: (profile?: string) => Promise<string>;
  writeSoul: (content: string, profile?: string) => Promise<boolean>;
  resetSoul: (profile?: string) => Promise<string>;

  // Tools
  getToolsets: (
    profile?: string,
  ) => Promise<
    Array<{ key: string; label: string; description: string; enabled: boolean }>
  >;
  setToolsetEnabled: (
    key: string,
    enabled: boolean,
    profile?: string,
  ) => Promise<boolean>;

  // Skills
  listInstalledSkills: (
    profile?: string,
  ) => Promise<
    Array<{ name: string; category: string; description: string; path: string }>
  >;
  listBundledSkills: () => Promise<
    Array<{
      name: string;
      description: string;
      category: string;
      source: string;
      installed: boolean;
    }>
  >;
  searchSkills: (
    query: string,
  ) => Promise<
    Array<{
      name: string;
      description: string;
      category: string;
      source: string;
      installed: boolean;
    }>
  >;
  getSkillContent: (skillPath: string) => Promise<string>;
  installSkill: (
    identifier: string,
    profile?: string,
  ) => Promise<{ success: boolean; error?: string }>;
  uninstallSkill: (
    name: string,
    profile?: string,
  ) => Promise<{ success: boolean; error?: string }>;
  getDisabledSkills(profile?: string): Promise<string[]>;
  setSkillEnabled(name: string, enabled: boolean, profile?: string): Promise<{success: boolean; error?: string}>;

  // Session cache
  listCachedSessions: (
    limit?: number,
    offset?: number,
  ) => Promise<
    Array<{
      id: string;
      title: string;
      startedAt: number;
      source: string;
      messageCount: number;
      model: string;
    }>
  >;
  syncSessionCache: () => Promise<
    Array<{
      id: string;
      title: string;
      startedAt: number;
      source: string;
      messageCount: number;
      model: string;
    }>
  >;
  updateSessionTitle: (sessionId: string, title: string) => Promise<void>;
  deleteSession: (sessionId: string) => Promise<void>;
  forkSession: (
    sessionId: string,
    fromMessageId: number,
  ) => Promise<{ success: boolean; newSessionId?: string; error?: string }>;
  exportSession: (
    sessionId: string,
    format: "markdown" | "json",
  ) => Promise<{
    success: boolean;
    path?: string;
    canceled?: boolean;
    error?: string;
  }>;

  // Session search
  searchSessions: (
    query: string,
    limit?: number,
  ) => Promise<
    Array<{
      sessionId: string;
      title: string | null;
      startedAt: number;
      source: string;
      messageCount: number;
      model: string;
      snippet: string;
    }>
  >;

  // Usage tracking
  getUsageStats: (
    fromTs?: number,
    toTs?: number,
    profile?: string,
  ) => Promise<{
    totalPromptTokens: number;
    totalCompletionTokens: number;
    totalTokens: number;
    totalCost: number;
    totalTurns: number;
    byModel: Record<string, { tokens: number; cost: number; turns: number }>;
    byProvider: Record<string, { tokens: number; cost: number; turns: number }>;
  }>;
  getUsageTrend: (
    days?: number,
    profile?: string,
  ) => Promise<
    Array<{ date: string; tokens: number; cost: number; turns: number }>
  >;

  // Credential Pool (profile-aware) — entries follow the upstream
  // engine schema (issue #367). See `CredentialPoolEntry` below.
  getCredentialPool: (
    profile?: string,
  ) => Promise<Record<string, Array<CredentialPoolEntry>>>;
  setCredentialPool: (
    provider: string,
    entries: Array<CredentialPoolEntry>,
    profile?: string,
  ) => Promise<boolean>;
  addCredentialPoolEntry: (
    provider: string,
    apiKey: string,
    label: string,
    profile?: string,
  ) => Promise<Array<CredentialPoolEntry>>;

  // Models
  listModels: () => Promise<
    Array<{
      id: string;
      name: string;
      provider: string;
      model: string;
      baseUrl: string;
      createdAt: number;
    }>
  >;
  addModel: (
    name: string,
    provider: string,
    model: string,
    baseUrl: string,
  ) => Promise<{
    id: string;
    name: string;
    provider: string;
    model: string;
    baseUrl: string;
    createdAt: number;
  }>;
  removeModel: (id: string) => Promise<boolean>;
  updateModel: (id: string, fields: Record<string, string>) => Promise<boolean>;

  // Claw3D
  claw3dStatus: () => Promise<{
    cloned: boolean;
    installed: boolean;
    devServerRunning: boolean;
    adapterRunning: boolean;
    port: number;
    portInUse: boolean;
    wsUrl: string;
    running: boolean;
    error: string;
    remoteUrl?: string | null;
    remoteSource?: "ssh" | null;
  }>;
  claw3dSetup: () => Promise<{ success: boolean; error?: string }>;
  onClaw3dSetupProgress: (
    callback: (progress: {
      step: number;
      totalSteps: number;
      title: string;
      detail: string;
      log: string;
    }) => void,
  ) => () => void;
  claw3dGetPort: () => Promise<number>;
  claw3dSetPort: (port: number) => Promise<boolean>;
  claw3dGetWsUrl: () => Promise<string>;
  claw3dSetWsUrl: (url: string) => Promise<boolean>;
  claw3dStartAll: (
    profile?: string,
  ) => Promise<{ success: boolean; error?: string }>;
  claw3dStopAll: () => Promise<boolean>;
  claw3dGetLogs: () => Promise<string>;
  claw3dStartDev: () => Promise<boolean>;
  claw3dStopDev: () => Promise<boolean>;
  claw3dStartAdapter: () => Promise<boolean>;
  claw3dStopAdapter: () => Promise<boolean>;

  // Updates
  checkForUpdates: () => Promise<string | null>;
  downloadUpdate: () => Promise<boolean>;
  installUpdate: () => Promise<void>;
  getAppVersion: () => Promise<string>;
  onUpdateAvailable: (
    callback: (info: { version: string; releaseNotes: string }) => void,
  ) => () => void;
  onUpdateDownloadProgress: (
    callback: (info: { percent: number }) => void,
  ) => () => void;
  onUpdateDownloaded: (callback: () => void) => () => void;
  onUpdateError: (callback: (message: string) => void) => () => void;

  // Menu events
  onMenuNewChat: (callback: () => void) => () => void;
  onMenuSearchSessions: (callback: () => void) => () => void;

  // Cron Jobs
  listCronJobs: (
    includeDisabled?: boolean,
    profile?: string,
  ) => Promise<
    Array<{
      id: string;
      name: string;
      schedule: string;
      prompt: string;
      state: "active" | "paused" | "completed";
      enabled: boolean;
      next_run_at: string | null;
      last_run_at: string | null;
      last_status: string | null;
      last_error: string | null;
      repeat: { times: number | null; completed: number } | null;
      deliver: string[];
      skills: string[];
      script: string | null;
    }>
  >;
  createCronJob: (
    schedule: string,
    prompt?: string,
    name?: string,
    deliver?: string,
    profile?: string,
  ) => Promise<{ success: boolean; error?: string }>;
  removeCronJob: (
    jobId: string,
    profile?: string,
  ) => Promise<{ success: boolean; error?: string }>;
  pauseCronJob: (
    jobId: string,
    profile?: string,
  ) => Promise<{ success: boolean; error?: string }>;
  resumeCronJob: (
    jobId: string,
    profile?: string,
  ) => Promise<{ success: boolean; error?: string }>;
  triggerCronJob: (
    jobId: string,
    profile?: string,
  ) => Promise<{ success: boolean; error?: string }>;

  // Kanban
  kanbanListBoards: (
    includeArchived?: boolean,
    profile?: string,
  ) => Promise<{
    success: boolean;
    data?: KanbanBoard[];
    error?: string;
    unsupportedMode?: boolean;
  }>;
  kanbanCurrentBoard: (
    profile?: string,
  ) => Promise<{ success: boolean; data?: string; error?: string }>;
  kanbanSwitchBoard: (
    slug: string,
    profile?: string,
  ) => Promise<{ success: boolean; error?: string }>;
  kanbanCreateBoard: (
    slug: string,
    name?: string,
    switchAfter?: boolean,
    profile?: string,
  ) => Promise<{ success: boolean; error?: string }>;
  kanbanRemoveBoard: (
    slug: string,
    hardDelete?: boolean,
    profile?: string,
  ) => Promise<{ success: boolean; error?: string }>;
  kanbanListTasks: (filters?: {
    status?: string;
    assignee?: string;
    tenant?: string;
    includeArchived?: boolean;
    profile?: string;
  }) => Promise<{ success: boolean; data?: KanbanTask[]; error?: string }>;
  kanbanGetTask: (
    taskId: string,
    profile?: string,
  ) => Promise<{ success: boolean; data?: KanbanTaskDetail; error?: string }>;
  kanbanCreateTask: (
    input: KanbanCreateTaskInput,
    profile?: string,
  ) => Promise<{ success: boolean; data?: { id: string }; error?: string }>;
  selectFolder: () => Promise<string | null>;
  selectFile: () => Promise<string | null>;
  kanbanAssignTask: (
    taskId: string,
    assignee: string | null,
    profile?: string,
  ) => Promise<{ success: boolean; error?: string }>;
  kanbanCompleteTask: (
    taskId: string,
    result?: string,
    profile?: string,
  ) => Promise<{ success: boolean; error?: string }>;
  kanbanBlockTask: (
    taskId: string,
    reason?: string,
    profile?: string,
  ) => Promise<{ success: boolean; error?: string }>;
  kanbanUnblockTask: (
    taskId: string,
    profile?: string,
  ) => Promise<{ success: boolean; error?: string }>;
  kanbanArchiveTask: (
    taskId: string,
    profile?: string,
  ) => Promise<{ success: boolean; error?: string }>;
  kanbanSpecifyTask: (
    taskId: string,
    profile?: string,
  ) => Promise<{ success: boolean; error?: string }>;
  kanbanReclaimTask: (
    taskId: string,
    reason?: string,
    profile?: string,
  ) => Promise<{ success: boolean; error?: string }>;
  kanbanCommentTask: (
    taskId: string,
    body: string,
    profile?: string,
  ) => Promise<{ success: boolean; error?: string }>;
  kanbanDispatchOnce: (
    dryRun?: boolean,
    profile?: string,
  ) => Promise<{ success: boolean; data?: unknown; error?: string }>;
  kanbanListClaw3dHqTasks: () => Promise<{
    success: boolean;
    data?: KanbanTask[];
    error?: string;
  }>;

  // Shell
  openExternal: (url: string) => Promise<void>;

  // Backup / Import
  runHermesBackup: (
    profile?: string,
  ) => Promise<{ success: boolean; path?: string; error?: string }>;
  runHermesImport: (
    archivePath: string,
    profile?: string,
  ) => Promise<{ success: boolean; error?: string }>;

  // Debug dump
  runHermesDump: () => Promise<string>;

  // Memory providers
  discoverMemoryProviders: (profile?: string) => Promise<
    Array<{
      name: string;
      description: string;
      installed: boolean;
      active: boolean;
      envVars: string[];
    }>
  >;

  // MCP servers
  listMcpServers: (
    profile?: string,
  ) => Promise<
    Array<{ name: string; type: string; enabled: boolean; detail: string }>
  >;
  addMcpServer: (
    input: {
      name: string;
      type: "stdio" | "http";
      command?: string;
      args?: string[];
      url?: string;
      env?: Record<string, string>;
      enabled?: boolean;
    },
    profile?: string,
  ) => Promise<{ success: boolean; error?: string }>;
  removeMcpServer: (
    name: string,
    profile?: string,
  ) => Promise<{ success: boolean; error?: string }>;
  updateMcpServer: (
    name: string,
    input: {
      name: string;
      type: "stdio" | "http";
      command?: string;
      args?: string[];
      url?: string;
      env?: Record<string, string>;
      enabled?: boolean;
    },
    profile?: string,
  ) => Promise<{ success: boolean; error?: string }>;

  // Log viewer
  readLogs: (
    logFile?: string,
    lines?: number,
  ) => Promise<{ content: string; path: string }>;
  watchLogs: (logFile?: string) => Promise<boolean>;
  stopWatchLogs: () => Promise<boolean>;
  onLogChunk: (callback: (chunk: string) => void) => () => void;

  // Specs management
  listSpecs(profile?: string): Promise<Array<{title: string; status: string; created: string; sessionId: string; body: string}>>;
  readSpec(name: string, profile?: string): Promise<{title: string; status: string; created: string; sessionId: string; body: string} | null>;
  createSpec(meta: {title: string; status: string; created: string; session_id?: string}, body: string, profile?: string): Promise<{success: boolean; error?: string}>;
  updateSpec(name: string, updates: {body?: string; status?: string; title?: string}, profile?: string): Promise<{success: boolean; error?: string}>;
  deleteSpec(name: string, profile?: string): Promise<{success: boolean; error?: string}>;
  parsePlan(text: string): any;

  // Prompt templates
  listPromptTemplates(profile?: string): Promise<
    Array<{ id: string; name: string; category: string; content: string; createdAt: number; updatedAt: number }>
  >;
  createPromptTemplate(
    input: { name: string; category: string; content: string },
    profile?: string,
  ): Promise<{ id: string; name: string; category: string; content: string; createdAt: number; updatedAt: number }>;
  updatePromptTemplate(
    id: string,
    updates: { name?: string; category?: string; content?: string },
    profile?: string,
  ): Promise<{ success: boolean; error?: string }>;
  deletePromptTemplate(
    id: string,
    profile?: string,
  ): Promise<{ success: boolean; error?: string }>;

  // Keybindings
  getKeybindings(profile?: string): Promise<Array<{ id: string; label: string; defaultKey: string; key: string }>>;
  setKeybinding(
    id: string,
    key: string,
    profile?: string,
  ): Promise<Array<{ id: string; label: string; defaultKey: string; key: string }>>;
  resetKeybinding(
    id: string,
    profile?: string,
  ): Promise<Array<{ id: string; label: string; defaultKey: string; key: string }>>;
}

declare global {
  interface Window {
    electron: ElectronAPI;
    hermesAPI: HermesAPI;
  }
}
