import type { AgentTodoItem } from "../screens/Chat/agentTodos";

interface PlanSection {
  title: string;
  items: AgentTodoItem[];
}

/**
 * Parse agent plan text into structured todo items grouped by section.
 * Handles common plan formats:
 * - Numbered lists (1. Task)
 * - Dash lists (- Task)
 * - Checkbox lists (- [ ] Task)
 * - Sections delimited by ## / ### headers
 */
export function parsePlanToTodos(text: string): PlanSection[] {
  if (!text) return [];

  const sections: PlanSection[] = [];
  const lines = text.split("\n");

  let currentSection: string | null = null;
  let currentItems: AgentTodoItem[] = [];
  const globalItems: AgentTodoItem[] = [];
  let itemIdx = 0;

  const headerRe = /^#{2,3}\s+(.+?)\s*$/;
  const listItemRe = /^(?:\d+[).]\s+|[-*+]\s+(?:\[ \]\s+)?)(.+)$/;

  for (const line of lines) {
    const trimmed = line.trim();

    // Detect headers
    const headerMatch = headerRe.exec(trimmed);
    if (headerMatch) {
      // Save previous section if it has items
      if (currentItems.length > 0) {
        sections.push({
          title: currentSection || "Tasks",
          items: [...currentItems],
        });
        currentItems = [];
      }
      const title = headerMatch[1].trim();
      currentSection = title;
      continue;
    }

    // Detect list items
    const listMatch = listItemRe.exec(trimmed);
    if (listMatch) {
      const content = listMatch[1].trim();
      if (content.length > 1) {
        itemIdx++;
        const item: AgentTodoItem = {
          id: `plan-${itemIdx}`,
          content,
          status: "pending",
        };
        if (currentSection) {
          currentItems.push(item);
        } else {
          globalItems.push(item);
        }
      }
      continue;
    }
  }

  // Save trailing section
  if (currentItems.length > 0) {
    sections.push({
      title: currentSection || "Tasks",
      items: [...currentItems],
    });
  }

  // If no sections were found, put global items into a single section
  if (sections.length === 0 && globalItems.length > 0) {
    sections.push({ title: "Tasks", items: globalItems });
  }

  return sections;
}
