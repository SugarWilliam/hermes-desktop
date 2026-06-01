import { useState, useEffect, useRef, useCallback } from "react";
import { useI18n } from "./useI18n";
import { Search, Pause, Play, RotateCcw } from "lucide-react";

const LOG_FILES = ["gateway.log", "agent.log", "errors.log"] as const;

function LogViewer({ profile: _profile }: { profile?: string }): React.JSX.Element {
  const { t } = useI18n();
  const [logFile, setLogFile] = useState<string>("gateway.log");
  const [logPath, setLogPath] = useState("");
  const [lines, setLines] = useState<string[]>([]);
  const [filter, setFilter] = useState("");
  const [paused, setPaused] = useState(false);
  const [watching, setWatching] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const containerRef = useRef<HTMLPreElement>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  const loadInitial = useCallback(async (): Promise<void> => {
    const result = await window.hermesAPI.readLogs(logFile, 500);
    setLogPath(result.path);
    setLines(result.content ? result.content.split("\n") : []);
  }, [logFile]);

  useEffect(() => {
    void loadInitial();
  }, [loadInitial]);

  // Start/stop real-time watching
  useEffect(() => {
    if (!watching) {
      // Stop watching if it was running
      if (cleanupRef.current) {
        cleanupRef.current();
        cleanupRef.current = null;
      }
      return;
    }

    let stopped = false;

    // Subscribe to log chunks
    const unsub = window.hermesAPI.onLogChunk((chunk: string) => {
      if (stopped || paused) return;
      const newLines = chunk.split("\n").filter((l) => l.length > 0);
      setLines((prev) => [...prev, ...newLines]);
    });

    // Start watching
    window.hermesAPI.watchLogs(logFile).then(() => {
      if (stopped) {
        window.hermesAPI.stopWatchLogs();
      }
    });

    cleanupRef.current = () => {
      stopped = true;
      unsub();
      window.hermesAPI.stopWatchLogs();
    };

    return () => {
      stopped = true;
      unsub();
      window.hermesAPI.stopWatchLogs();
    };
  }, [watching, logFile, paused]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (autoScroll && containerRef.current && !paused) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [lines, autoScroll, paused]);

  // Keep max 5000 lines
  useEffect(() => {
    if (lines.length > 5000) {
      setLines((prev) => prev.slice(-5000));
    }
  }, [lines]);

  const filteredLines = filter
    ? lines.filter((l) => l.toLowerCase().includes(filter.toLowerCase()))
    : lines;

  function handleFileSwitch(file: string): void {
    setLogFile(file);
    setLines([]);
    setWatching(false);
    setPaused(false);
  }

  function handleClear(): void {
    setLines([]);
  }

  function toggleWatch(): void {
    setWatching((w) => !w);
  }

  return (
    <div className="log-viewer">
      {/* Toolbar */}
      <div className="log-viewer-toolbar">
        <div className="log-viewer-files">
          {LOG_FILES.map((f) => (
            <button
              key={f}
              className={`log-file-btn ${logFile === f ? "active" : ""}`}
              onClick={() => handleFileSwitch(f)}
            >
              {f.replace(".log", "")}
            </button>
          ))}
        </div>
        <div className="log-viewer-controls">
          <button
            className={`log-ctrl-btn ${watching ? "active" : ""}`}
            onClick={toggleWatch}
            title={watching ? t("settings.logs.stopWatch") : t("settings.logs.startWatch")}
          >
            {watching ? <Pause size={12} /> : <Play size={12} />}
          </button>
          <button
            className={`log-ctrl-btn ${paused ? "active" : ""}`}
            onClick={() => setPaused((p) => !p)}
            disabled={!watching}
            title={paused ? t("settings.logs.resume") : t("settings.logs.pause")}
          >
            {paused ? <Play size={12} /> : <Pause size={12} />}
          </button>
          <button
            className="log-ctrl-btn"
            onClick={() => setAutoScroll((a) => !a)}
            title={t("settings.logs.autoScroll")}
          >
            <span style={{ fontSize: 10, fontWeight: 600 }}>{autoScroll ? "↓" : "↓"}</span>
          </button>
          <button
            className="log-ctrl-btn"
            onClick={handleClear}
            title={t("settings.logs.clear")}
          >
            <RotateCcw size={12} />
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="log-viewer-search">
        <Search size={12} style={{ opacity: 0.5, flexShrink: 0 }} />
        <input
          className="log-search-input"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder={t("settings.logs.searchPlaceholder")}
        />
        {filter && (
          <span className="log-search-count">
            {filteredLines.length}/{lines.length}
          </span>
        )}
      </div>

      {/* Path */}
      {logPath && (
        <div className="log-viewer-path">{logPath}</div>
      )}

      {/* Log content */}
      <pre className="log-viewer-content" ref={containerRef}>
        {filteredLines.length === 0 ? (
          <span className="log-empty">{t("settings.emptyLog")}</span>
        ) : (
          filteredLines.map((line, i) => (
            <div key={i} className="log-line">
              {line}
            </div>
          ))
        )}
      </pre>
    </div>
  );
}

export default LogViewer;
