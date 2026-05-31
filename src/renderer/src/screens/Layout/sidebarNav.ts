import type { LucideIcon } from "lucide-react";
import {
  ChatBubble,
  Clock,
  Users,
  Building,
  Kanban as KanbanIcon,
  Layers,
  KeyRound,
  Puzzle,
  Sparkles,
  Brain,
  Wrench,
  Timer,
  Signal,
  Settings as SettingsIcon,
  BookOpen,
  Database,
  FileText,
} from "../../assets/icons";

export type NavView =
  | "chat"
  | "sessions"
  | "agents"
  | "office"
  | "models"
  | "providers"
  | "skills"
  | "soul"
  | "memory"
  | "tools"
  | "schedules"
  | "kanban"
  | "gateway"
  | "settings"
  | "rules"
  | "mrag"
  | "specs";

export interface NavItem {
  view: NavView;
  icon: LucideIcon;
  labelKey: string;
}

export interface NavGroup {
  id: string;
  labelKey?: string;
  items: NavItem[];
}

/** Grouped app navigation — compact rail + optional expanded labels. */
export const NAV_GROUPS: NavGroup[] = [
  {
    id: "main",
    items: [
      { view: "chat", icon: ChatBubble, labelKey: "navigation.chat" },
      { view: "sessions", icon: Clock, labelKey: "navigation.sessions" },
    ],
  },
  {
    id: "workspace",
    labelKey: "navigation.groupWorkspace",
    items: [
      { view: "agents", icon: Users, labelKey: "navigation.agents" },
      { view: "office", icon: Building, labelKey: "navigation.office" },
      { view: "kanban", icon: KanbanIcon, labelKey: "navigation.kanban" },
    ],
  },
  {
    id: "ai",
    labelKey: "navigation.groupAi",
    items: [
      { view: "models", icon: Layers, labelKey: "navigation.models" },
      { view: "providers", icon: KeyRound, labelKey: "navigation.providers" },
      { view: "skills", icon: Puzzle, labelKey: "navigation.skills" },
      { view: "soul", icon: Sparkles, labelKey: "navigation.soul" },
      { view: "rules", icon: BookOpen, labelKey: "navigation.rules" },
      { view: "mrag", icon: Database, labelKey: "navigation.mrag" },
      { view: "specs", icon: FileText, labelKey: "navigation.specs" },
      { view: "memory", icon: Brain, labelKey: "navigation.memory" },
      { view: "tools", icon: Wrench, labelKey: "navigation.tools" },
    ],
  },
  {
    id: "system",
    labelKey: "navigation.groupSystem",
    items: [
      { view: "schedules", icon: Timer, labelKey: "navigation.schedules" },
      { view: "gateway", icon: Signal, labelKey: "navigation.gateway" },
      { view: "settings", icon: SettingsIcon, labelKey: "navigation.settings" },
    ],
  },
];

export const SIDEBAR_EXPANDED_KEY = "hermes.sidebarExpanded";

export function readSidebarExpanded(): boolean {
  try {
    return localStorage.getItem(SIDEBAR_EXPANDED_KEY) === "1";
  } catch {
    return false;
  }
}
