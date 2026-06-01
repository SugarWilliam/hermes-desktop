export default {
  title: "Gateway",
  messagingGateway: "Messaging Gateway",
  platforms: "Platforms",
  status: "Status",
  running: "Running",
  stopped: "Stopped",
  gatewayHint:
    "Connects Hermes to Telegram, Discord, Slack, and other platforms",
  metricsTitle: "Gateway Metrics",
  metricsUnavailable: "Metrics endpoint not available. Gateway may not expose /api/stats.",
  totalRequests: "Total Requests",
  totalErrors: "Total Errors",
  errorRate: "Error Rate",
  avgLatency: "Avg Latency",
  uptime: "Uptime",
  platformStats: "Platform Stats",
  recentRequests: "Recent Requests",
} as const;
