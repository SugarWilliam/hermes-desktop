import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { join } from "path";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";

const TEST_DIR = join(tmpdir(), `hermes-default-setup-${Date.now()}`);

async function loadModules(): Promise<{
  ensureDefaultActiveModel: typeof import("../src/main/default-provider-setup").ensureDefaultActiveModel;
  getModelConfig: typeof import("../src/main/config").getModelConfig;
}> {
  vi.resetModules();
  process.env.HERMES_HOME = TEST_DIR;
  const setup = await import("../src/main/default-provider-setup");
  const config = await import("../src/main/config");
  return {
    ensureDefaultActiveModel: setup.ensureDefaultActiveModel,
    getModelConfig: config.getModelConfig,
  };
}

beforeEach(() => {
  mkdirSync(TEST_DIR, { recursive: true });
});

afterEach(() => {
  delete process.env.HERMES_HOME;
  vi.resetModules();
  rmSync(TEST_DIR, { recursive: true, force: true });
});

describe("ensureDefaultActiveModel", () => {
  it("writes OpenRouter free model when config is empty", async () => {
    writeFileSync(join(TEST_DIR, "config.yaml"), "");
    const { ensureDefaultActiveModel, getModelConfig } = await loadModules();
    expect(ensureDefaultActiveModel()).toBe(true);
    const mc = getModelConfig();
    expect(mc.provider).toBe("openrouter");
    expect(mc.model).toBe("deepseek/deepseek-r1:free");
    expect(readFileSync(join(TEST_DIR, "config.yaml"), "utf-8")).toContain(
      "deepseek/deepseek-r1:free",
    );
  });

  it("uses DeepSeek default for zh-CN locale", async () => {
    writeFileSync(join(TEST_DIR, "config.yaml"), "");
    const { ensureDefaultActiveModel, getModelConfig } = await loadModules();
    expect(ensureDefaultActiveModel(undefined, "zh-CN")).toBe(true);
    const mc = getModelConfig();
    expect(mc.provider).toBe("deepseek");
    expect(mc.model).toBe("deepseek-chat");
  });

  it("does not overwrite an existing model selection", async () => {
    writeFileSync(
      join(TEST_DIR, "config.yaml"),
      'model:\n  provider: "deepseek"\n  default: "deepseek-chat"\n',
    );
    const { ensureDefaultActiveModel, getModelConfig } = await loadModules();
    expect(ensureDefaultActiveModel()).toBe(false);
    expect(getModelConfig().provider).toBe("deepseek");
  });
});
