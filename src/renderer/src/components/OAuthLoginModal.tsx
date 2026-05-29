import { useState, useEffect, useRef, useMemo } from "react";
import { detectDeviceCode } from "../../../shared/deviceCode";
import { X } from "../assets/icons";
import { useI18n } from "./useI18n";

interface OAuthLoginModalProps {
  provider: string;
  providerLabel: string;
  profile?: string;
  onClose: () => void;
  /** Called once when OAuth completes successfully (before the user closes). */
  onSuccess?: (providerId: string) => void | Promise<void>;
}

type Status = "running" | "success" | "error";

/**
 * Drives an interactive OAuth sign-in for a subscription provider.
 * Runs provider OAuth in the main process (browser or device-code flow).
 * Copilot uses a direct Python login; other providers use the bundled
 * Hermes CLI or credential pool — no allowlist in the desktop UI.
 */
function OAuthLoginModal({
  provider,
  providerLabel,
  profile,
  onClose,
  onSuccess,
}: OAuthLoginModalProps): React.JSX.Element {
  const { t } = useI18n();
  const [log, setLog] = useState("");
  const [status, setStatus] = useState<Status>("running");
  const [error, setError] = useState("");
  const logRef = useRef<HTMLPreElement>(null);
  // The login subprocess is single-flight in the main process. React
  // StrictMode (dev) double-invokes effects, so guard against firing a
  // second `oauthLogin` that would just bounce off that guard.
  const startedRef = useRef(false);
  const successHandledRef = useRef(false);
  const device = useMemo(() => detectDeviceCode(log), [log]);

  useEffect(() => {
    const cleanup = window.hermesAPI.onOAuthLoginProgress((chunk) => {
      setLog((prev) => prev + chunk);
    });
    if (!startedRef.current) {
      startedRef.current = true;
      window.hermesAPI
        .oauthLogin(provider, profile)
        .then((res) => {
          if (res.success) {
            setStatus("success");
          } else {
            setStatus("error");
            setError(res.error || t("providers.oauth.failed"));
          }
        })
        .catch((err: unknown) => {
          setStatus("error");
          setError((err as Error)?.message || t("providers.oauth.failed"));
        });
    }
    return cleanup;
  }, [provider, profile, t]);

  useEffect(() => {
    if (status !== "success" || !onSuccess || successHandledRef.current) return;
    successHandledRef.current = true;
    void Promise.resolve(onSuccess(provider));
  }, [status, onSuccess, provider]);

  // Keep the streamed log scrolled to the newest line.
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [log]);

  function handleClose(): void {
    // Abandoning a flow mid-OAuth: tell main to kill the CLI subprocess
    // so its loopback redirect server doesn't linger.
    if (status === "running") {
      void window.hermesAPI.cancelOAuthLogin();
    }
    onClose();
  }

  return (
    <div className="models-modal-overlay" onClick={handleClose}>
      <div className="models-modal" onClick={(e) => e.stopPropagation()}>
        <div className="models-modal-header">
          <h2 className="models-modal-title">
            {t("providers.oauth.signIn")} — {providerLabel}
          </h2>
          <button
            className="btn-ghost"
            onClick={handleClose}
            aria-label={t("common.close")}
          >
            <X size={18} />
          </button>
        </div>
        <div className="models-modal-body">
          {status === "running" && (
            <p className="oauth-login-status">
              {t("providers.oauth.runningHint")}
            </p>
          )}
          {status === "running" && device && (
            <div className="oauth-device-prompt">
              <p className="oauth-device-prompt-label">
                {t("providers.oauth.deviceHint")}
              </p>
              <p>
                <span className="oauth-device-prompt-key">
                  {t("providers.oauth.deviceLink")}
                </span>
                <button
                  type="button"
                  className="oauth-device-link btn-ghost"
                  onClick={() => void window.hermesAPI.openExternal(device.url)}
                >
                  {device.url}
                </button>
              </p>
              <p>
                <span className="oauth-device-prompt-key">
                  {t("providers.oauth.deviceCode")}
                </span>
                <code className="oauth-device-code">{device.code}</code>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm oauth-device-copy"
                  onClick={() =>
                    void window.hermesAPI.copyToClipboard(device.code)
                  }
                >
                  {t("providers.oauth.deviceCopy")}
                </button>
              </p>
            </div>
          )}
          {status === "success" && (
            <div className="oauth-login-result oauth-login-result-success">
              ✓&nbsp;{t("providers.oauth.successHint")}
            </div>
          )}
          {status === "error" && (
            <div className="oauth-login-result oauth-login-result-error">
              ✗&nbsp;{error}
            </div>
          )}
          {log && (
            <pre className="settings-hermes-doctor" ref={logRef}>
              {log}
            </pre>
          )}
        </div>
        <div className="models-modal-footer">
          <button className="btn btn-primary btn-sm" onClick={handleClose}>
            {status === "running" ? t("common.cancel") : t("common.close")}
          </button>
        </div>
      </div>
    </div>
  );
}

export default OAuthLoginModal;
