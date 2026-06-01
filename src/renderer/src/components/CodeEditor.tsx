import { useCallback, useEffect, useRef, useState } from "react";
import Editor, { type OnMount, loader } from "@monaco-editor/react";
import type { editor } from "monaco-editor";

/** Map file extensions to Monaco language identifiers. */
function languageFromPath(filePath: string): string {
  const ext = filePath.split(".").pop()?.toLowerCase() ?? "";

  const map: Record<string, string> = {
    ts: "typescript",
    tsx: "typescript",
    js: "javascript",
    jsx: "javascript",
    json: "json",
    md: "markdown",
    markdown: "markdown",
    html: "html",
    css: "css",
    scss: "scss",
    less: "less",
    py: "python",
    rs: "rust",
    go: "go",
    java: "java",
    c: "c",
    cpp: "cpp",
    h: "c",
    hpp: "cpp",
    sh: "shell",
    bash: "shell",
    zsh: "shell",
    yaml: "yaml",
    yml: "yaml",
    toml: "ini",
    ini: "ini",
    env: "ini",
    xml: "xml",
    sql: "sql",
    dockerfile: "dockerfile",
    cmake: "cmake",
    gradle: "groovy",
    kt: "kotlin",
    swift: "swift",
    php: "php",
    rb: "ruby",
    lua: "lua",
  };

  // Special case: Dockerfile (no extension)
  const basename = filePath.split(/[\\/]/).pop()?.toLowerCase() ?? "";
  if (basename === "dockerfile" || basename === "docker-compose.yml") {
    return "dockerfile";
  }

  return map[ext] ?? "plaintext";
}

interface CodeEditorProps {
  filePath: string;
  value: string;
  onChange: (value: string) => void;
  onSave?: () => void;
}

export function CodeEditor({
  filePath,
  value,
  onChange,
  onSave,
}: CodeEditorProps): React.JSX.Element {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const language = languageFromPath(filePath);

  useEffect(() => {
    let cancelled = false;
    setLoadError(null);
    void loader.init().catch((err: unknown) => {
      if (cancelled) return;
      const message =
        err instanceof Error ? err.message : "Monaco editor failed to load";
      setLoadError(message);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleMount: OnMount = useCallback((editor, monaco) => {
    editorRef.current = editor;

    // Ctrl/Cmd+S triggers the save callback
    editor.addAction({
      id: "save-file",
      label: "Save File",
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS],
      run: () => onSave?.(),
    });

    // Focus the editor on mount
    editor.focus();
  }, [onSave]);

  const handleChange = useCallback(
    (val: string | undefined) => {
      onChange(val ?? "");
    },
    [onChange],
  );

  if (loadError) {
    return (
      <div className="chat-workspace-error" role="alert">
        {loadError}
      </div>
    );
  }

  return (
    <Editor
      height="100%"
      language={language}
      value={value}
      onChange={handleChange}
      onMount={handleMount}
      loading={<div className="chat-workspace-loading">Loading editor…</div>}
      options={{
        fontSize: 13,
        fontFamily:
          "'JetBrains Mono', 'Fira Code', 'Cascadia Code', Consolas, monospace",
        lineNumbers: "on",
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        wordWrap: "on",
        tabSize: 2,
        insertSpaces: true,
        automaticLayout: true,
        readOnly: false,
        padding: { top: 8 },
        renderLineHighlight: "line",
        cursorBlinking: "smooth",
        bracketPairColorization: { enabled: true },
        guides: { indentation: true, bracketPairs: true },
      }}
      theme="vs-dark"
    />
  );
}
