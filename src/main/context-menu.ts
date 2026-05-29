import type { MenuItemConstructorOptions } from "electron";
import { t } from "../shared/i18n";
import { getAppLocale } from "./locale";

export interface ContextMenuLabelSet {
  addSelection: string;
  selectAll: string;
  copyChatText: string;
  copyChatMarkdown: string;
}

export function getContextMenuLabels(): ContextMenuLabelSet {
  const loc = getAppLocale();
  return {
    addSelection: t("chat.contextMenu.addSelection", loc),
    selectAll: t("chat.contextMenu.selectAll", loc),
    copyChatText: t("chat.contextMenu.copyChatText", loc),
    copyChatMarkdown: t("chat.contextMenu.copyChatMarkdown", loc),
  };
}

export interface WebContextMenuParams {
  editFlags: {
    canCut: boolean;
    canCopy: boolean;
    canPaste: boolean;
  };
  isEditable: boolean;
  selectionText: string;
  x: number;
  y: number;
}

export function buildWebContentsContextMenu(
  params: WebContextMenuParams,
  labels: ContextMenuLabelSet,
  handlers: {
    onAddSelection: (text: string) => void;
    onSelectBubble: (point: { x: number; y: number }) => void;
    onCopyChat: (format: "text" | "markdown") => void;
  },
): MenuItemConstructorOptions[] {
  const { editFlags, isEditable } = params;
  const template: MenuItemConstructorOptions[] = [];
  const selection = params.selectionText?.trim();

  if (isEditable) {
    template.push(
      { role: "cut", enabled: editFlags.canCut },
      { role: "copy", enabled: editFlags.canCopy },
      { role: "paste", enabled: editFlags.canPaste },
      { type: "separator" },
      { role: "selectAll" },
    );
    if (selection) {
      template.push(
        { type: "separator" },
        {
          label: labels.addSelection,
          click: () => handlers.onAddSelection(selection),
        },
      );
    }
  } else {
    template.push(
      { role: "copy", enabled: editFlags.canCopy },
      { type: "separator" },
      {
        label: labels.selectAll,
        click: () => handlers.onSelectBubble({ x: params.x, y: params.y }),
      },
    );
    if (selection) {
      template.push(
        { type: "separator" },
        {
          label: labels.addSelection,
          click: () => handlers.onAddSelection(selection),
        },
      );
    }
  }

  template.push(
    { type: "separator" },
    {
      label: labels.copyChatText,
      click: () => handlers.onCopyChat("text"),
    },
    {
      label: labels.copyChatMarkdown,
      click: () => handlers.onCopyChat("markdown"),
    },
  );

  return template;
}
