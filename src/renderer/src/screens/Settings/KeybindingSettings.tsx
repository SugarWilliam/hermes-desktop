import { useState, useEffect, useCallback, useRef } from "react";
import { useI18n } from "../../components/useI18n";
import { Keyboard, RotateCcw, Check } from "lucide-react";

interface Keybinding {
  id: string;
  label: string;
  defaultKey: string;
  key: string;
}

function formatKeyCombo(key: string): string {
  return key
    .replace(/CmdOrCtrl/gi, navigator.platform.includes("Mac") ? "⌘" : "Ctrl")
    .replace(/\+/g, " + ")
    .replace(/Shift/gi, "⇧")
    .replace(/Alt/gi, "⌥");
}

function KeybindingSettings({ profile }: { profile?: string }): React.JSX.Element {
  const { t } = useI18n();
  const [keybindings, setKeybindings] = useState<Keybinding[]>([]);
  const [recordingId, setRecordingId] = useState<string | null>(null);
  const [recordedKeys, setRecordedKeys] = useState<string[]>([]);
  const [savedId, setSavedId] = useState<string | null>(null);
  const recordRef = useRef<HTMLDivElement>(null);

  const loadKeybindings = useCallback(async () => {
    const kbs = await window.hermesAPI.getKeybindings(profile);
    setKeybindings(kbs);
  }, [profile]);

  useEffect(() => {
    void loadKeybindings();
  }, [loadKeybindings]);

  // Listen for key presses while recording
  useEffect(() => {
    if (!recordingId) return;

    function handleKeyDown(e: KeyboardEvent): void {
      e.preventDefault();
      e.stopPropagation();

      const parts: string[] = [];
      if (e.ctrlKey || e.metaKey) parts.push("CmdOrCtrl");
      if (e.shiftKey) parts.push("Shift");
      if (e.altKey) parts.push("Alt");

      const key = e.key;
      if (!["Control", "Shift", "Alt", "Meta"].includes(key)) {
        // Normalize single-char keys to uppercase
        const normalized = key.length === 1 ? key.toUpperCase() : key;
        parts.push(normalized);
        setRecordedKeys(parts);
      } else {
        setRecordedKeys(parts);
      }
    }

    function handleClickOutside(e: MouseEvent): void {
      if (recordRef.current && !recordRef.current.contains(e.target as Node)) {
        setRecordingId(null);
        setRecordedKeys([]);
      }
    }

    document.addEventListener("keydown", handleKeyDown, true);
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("keydown", handleKeyDown, true);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [recordingId]);

  async function handleSave(id: string): Promise<void> {
    if (recordedKeys.length === 0) {
      setRecordingId(null);
      return;
    }
    const keyCombo = recordedKeys.join("+");
    const updated = await window.hermesAPI.setKeybinding(id, keyCombo, profile);
    setKeybindings(updated);
    setRecordingId(null);
    setRecordedKeys([]);
    setSavedId(id);
    setTimeout(() => setSavedId(null), 1500);
  }

  async function handleReset(id: string): Promise<void> {
    const updated = await window.hermesAPI.resetKeybinding(id, profile);
    setKeybindings(updated);
    setSavedId(id);
    setTimeout(() => setSavedId(null), 1500);
  }

  function startRecording(id: string): void {
    setRecordingId(id);
    setRecordedKeys([]);
  }

  return (
    <div className="keybinding-settings">
      <div className="keybinding-settings-desc">
        {t("settings.keybindings.desc")}
      </div>

      <div className="keybinding-list">
        {keybindings.map((kb) => {
          const isRecording = recordingId === kb.id;
          const isModified = kb.key !== kb.defaultKey;
          const justSaved = savedId === kb.id;

          return (
            <div key={kb.id} className="keybinding-row">
              <div className="keybinding-info">
                <span className="keybinding-label">
                  {t(`settings.keybindings.actions.${kb.id}`) || kb.label}
                </span>
              </div>
              <div className="keybinding-controls">
                {isRecording ? (
                  <div className="keybinding-recording" ref={recordRef}>
                    <span className="keybinding-record-display">
                      {recordedKeys.length > 0
                        ? formatKeyCombo(recordedKeys.join("+"))
                        : t("settings.keybindings.pressKeys")}
                    </span>
                    <button
                      className="btn btn-primary keybinding-save-btn"
                      onClick={() => handleSave(kb.id)}
                      disabled={recordedKeys.length === 0}
                    >
                      <Check size={12} />
                    </button>
                  </div>
                ) : (
                  <>
                    <button
                      className={`keybinding-key-btn ${isModified ? "modified" : ""} ${justSaved ? "saved" : ""}`}
                      onClick={() => startRecording(kb.id)}
                      title={t("settings.keybindings.clickToChange")}
                    >
                      <Keyboard size={12} style={{ marginRight: 4 }} />
                      {formatKeyCombo(kb.key)}
                    </button>
                    {isModified && (
                      <button
                        className="keybinding-reset-btn"
                        onClick={() => handleReset(kb.id)}
                        title={t("settings.keybindings.reset")}
                      >
                        <RotateCcw size={12} />
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default KeybindingSettings;
