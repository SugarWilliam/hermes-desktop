/**
 * Platform configuration field schemas.
 * Defines what fields each platform supports in config.yaml.
 */

export interface PlatformField {
  key: string;
  label: string;
  type: "text" | "password" | "number" | "url";
  placeholder?: string;
  hint?: string;
  required?: boolean;
}

export interface PlatformSchema {
  name: string;
  configKey: string;
  fields: PlatformField[];
  envVarHints: string[];
}

export const PLATFORM_SCHEMAS: Record<string, PlatformSchema> = {
  telegram: {
    name: "Telegram",
    configKey: "telegram",
    envVarHints: ["TELEGRAM_BOT_TOKEN"],
    fields: [
      { key: "allowed_chats", label: "Allowed Chats", type: "text", placeholder: "-1001234567890, @mygroup", hint: "Comma-separated chat IDs or usernames" },
      { key: "reactions", label: "Reactions", type: "text", placeholder: "true", hint: "Enable/disable emoji reactions" },
    ],
  },
  discord: {
    name: "Discord",
    configKey: "discord",
    envVarHints: ["DISCORD_BOT_TOKEN"],
    fields: [
      { key: "allowed_channels", label: "Allowed Channels", type: "text", placeholder: "general, bot-commands", hint: "Comma-separated channel names" },
      { key: "allowed_guilds", label: "Allowed Guilds", type: "text", placeholder: "123456789", hint: "Comma-separated guild IDs" },
    ],
  },
  slack: {
    name: "Slack",
    configKey: "slack",
    envVarHints: ["SLACK_BOT_TOKEN", "SLACK_APP_TOKEN"],
    fields: [
      { key: "allowed_channels", label: "Allowed Channels", type: "text", placeholder: "#general, #bot", hint: "Comma-separated channel names" },
    ],
  },
  whatsapp: {
    name: "WhatsApp",
    configKey: "whatsapp",
    envVarHints: ["WHATSAPP_ENABLED"],
    fields: [
      { key: "allowed_numbers", label: "Allowed Numbers", type: "text", placeholder: "+1234567890", hint: "Comma-separated phone numbers" },
    ],
  },
  signal: {
    name: "Signal",
    configKey: "signal",
    envVarHints: ["SIGNAL_HTTP_URL", "SIGNAL_ACCOUNT"],
    fields: [
      { key: "allowed_numbers", label: "Allowed Numbers", type: "text", placeholder: "+1234567890", hint: "Comma-separated phone numbers" },
    ],
  },
  matrix: {
    name: "Matrix",
    configKey: "matrix",
    envVarHints: ["MATRIX_HOMESERVER", "MATRIX_ACCESS_TOKEN"],
    fields: [
      { key: "allowed_rooms", label: "Allowed Rooms", type: "text", placeholder: "!abc123:matrix.org", hint: "Comma-separated room IDs" },
    ],
  },
  mattermost: {
    name: "Mattermost",
    configKey: "mattermost",
    envVarHints: ["MATTERMOST_TOKEN", "MATTERMOST_URL"],
    fields: [
      { key: "allowed_channels", label: "Allowed Channels", type: "text", placeholder: "town-square", hint: "Comma-separated channel names" },
    ],
  },
  home_assistant: {
    name: "Home Assistant",
    configKey: "homeassistant",
    envVarHints: ["HASS_TOKEN", "HASS_URL"],
    fields: [
      { key: "allowed_entities", label: "Allowed Entities", type: "text", placeholder: "light.living_room", hint: "Comma-separated entity IDs" },
    ],
  },
};

export const PLATFORM_LIST = Object.keys(PLATFORM_SCHEMAS);
