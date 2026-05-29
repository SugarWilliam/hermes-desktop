export default {
  title: "Providers",
  subtitle: "Configure LLM providers, API keys, and credential pools",
  oauth: {
    sectionTitle: "Subscription / OAuth Plans",
    sectionHint:
      "Each provider card supports an API key or Sign in for browser OAuth / device-code login — no separate Hermes CLI step.",
    signIn: "Sign in",
    runningHint: "Follow the steps below to finish signing in.",
    deviceHint: "Open this link in your browser and enter the device code:",
    deviceLink: "Link:",
    deviceCode: "Code:",
    deviceCopy: "Copy code",
    successHint: "Signed in successfully. You can now select this provider.",
    failed: "Sign-in failed.",
    codexDesc: "Use your ChatGPT Codex plan",
    copilotDesc:
      "Sign in with a GitHub device code (like OpenCode /connect) — visit github.com/login/device and paste the code",
    xaiDesc: "Use your xAI Grok subscription",
    qwenDesc: "Use your Qwen subscription",
    geminiDesc: "Use your Google AI Pro / Gemini plan",
    minimaxDesc: "Use your MiniMax subscription",
    nousDesc:
      "Sign in with your Nous Portal subscription (or use an API key in Providers)",
  },
} as const;
