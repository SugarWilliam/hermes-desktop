export default {
  title: "提供商",
  subtitle: "配置 LLM 提供商、API 密钥和凭据池",
  oauth: {
    sectionTitle: "订阅 / OAuth 套餐",
    sectionHint:
      "每个提供商卡片均可填写 API Key，或点击「登录」在浏览器中完成 OAuth / 设备码授权（无需单独 Hermes CLI 命令）。",
    signIn: "登录",
    runningHint: "请按照下方步骤完成登录。",
    deviceHint: "在浏览器中打开以下链接并输入设备验证码：",
    deviceLink: "链接：",
    deviceCode: "验证码：",
    deviceCopy: "复制验证码",
    successHint: "登录成功。现在可以选择此提供商。",
    failed: "登录失败。",
    codexDesc: "使用您的 ChatGPT Codex 套餐",
    copilotDesc:
      "通过 GitHub 设备码登录（类似 OpenCode /connect）— 打开 github.com/login/device 粘贴验证码",
    xaiDesc: "使用您的 xAI Grok 订阅",
    qwenDesc: "使用您的 Qwen 订阅",
    geminiDesc: "使用您的 Google AI Pro / Gemini 套餐",
    minimaxDesc: "使用您的 MiniMax 订阅",
    nousDesc: "使用 Nous Portal 订阅（也可在设置中填写 API Key）",
  },
} as const;
