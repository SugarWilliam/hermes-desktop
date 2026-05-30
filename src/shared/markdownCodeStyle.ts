/** Prism / react-syntax-highlighter language aliases by file extension or fence tag */
export const HIGHLIGHT_ALIASES: Record<string, string> = {
  "c++": "cpp",
  cc: "cpp",
  cxx: "cpp",
  h: "c",
  hpp: "cpp",
  hh: "cpp",
  hxx: "cpp",
  py: "python",
  pyw: "python",
  python3: "python",
  js: "javascript",
  jsx: "jsx",
  mjs: "javascript",
  cjs: "javascript",
  ts: "typescript",
  tsx: "tsx",
  mts: "typescript",
  cts: "typescript",
  sh: "bash",
  shell: "bash",
  zsh: "bash",
  fish: "bash",
  ps1: "powershell",
  pwsh: "powershell",
  yml: "yaml",
  md: "markdown",
  mdx: "markdown",
  json: "json",
  jsonc: "json",
  json5: "json",
  toml: "toml",
  ini: "ini",
  conf: "ini",
  cfg: "ini",
  dockerfile: "docker",
  makefile: "makefile",
  mk: "makefile",
  cmake: "cmake",
  rs: "rust",
  go: "go",
  golang: "go",
  kt: "kotlin",
  kts: "kotlin",
  java: "java",
  cs: "csharp",
  fs: "fsharp",
  rb: "ruby",
  php: "php",
  swift: "swift",
  scala: "scala",
  r: "r",
  lua: "lua",
  perl: "perl",
  pl: "perl",
  sql: "sql",
  graphql: "graphql",
  gql: "graphql",
  html: "markup",
  htm: "markup",
  xml: "markup",
  svg: "markup",
  css: "css",
  scss: "scss",
  sass: "sass",
  less: "less",
  styl: "stylus",
  vue: "markup",
  svelte: "markup",
  tex: "latex",
  latex: "latex",
  proto: "protobuf",
  protobuf: "protobuf",
  asm: "asm",
  s: "asm",
  arm: "armasm",
  verilog: "verilog",
  vhdl: "vhdl",
  matlab: "matlab",
  objc: "objectivec",
  objcpp: "objectivec",
  ml: "ocaml",
  ocaml: "ocaml",
  hs: "haskell",
  haskell: "haskell",
  clj: "clojure",
  cljs: "clojure",
  dart: "dart",
  zig: "zig",
  nim: "nim",
  ex: "elixir",
  exs: "elixir",
  erl: "erlang",
  groovy: "groovy",
  gradle: "groovy",
  tf: "hcl",
  hcl: "hcl",
  nginx: "nginx",
  apache: "apacheconf",
  bat: "batch",
  cmd: "batch",
  log: "log",
  txt: "text",
  text: "text",
  plaintext: "text",
};

const SOURCE_FILE_RE =
  /^(?<file>.+\.[a-z0-9+#]+)(?:[:#](?<lines>\d+(?:-\d+)?))?$/i;

const MACRO_RE = /^[A-Z][A-Z0-9_]*$/;
const NUMBER_RE = /^(?:0x[0-9a-fA-F]+|\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)$/;
const STRING_RE = /^(['"`])(?:\\.|(?!\1).)*\1$/s;
const KEYWORD_RE =
  /^(?:true|false|nullptr|null|undefined|void|int|char|bool|size_t|uint\d+_t|static|const|volatile|inline|extern|register|signed|unsigned|long|short|float|double)$/i;

export function normalizeHighlightLanguage(lang: string): string {
  const key = lang.toLowerCase().replace(/^c\+\+$/i, "cpp").trim();
  return HIGHLIGHT_ALIASES[key] || key;
}

export function extensionFromFilename(name: string): string | null {
  const m = name.match(/\.([a-z0-9+#]+)$/i);
  return m ? m[1].toLowerCase() : null;
}

export function langCssClass(language: string): string {
  const norm = normalizeHighlightLanguage(language);
  const safe = norm.replace(/[^a-z0-9-]/gi, "-") || "text";
  return `md-code-lang--${safe}`;
}

/** Guess Prism language when the fence has no ```lang tag. */
export function inferFenceLanguage(code: string, rawLang?: string): string {
  const hint = rawLang?.trim();
  if (hint) return normalizeHighlightLanguage(hint);

  const trimmed = code.trim();
  const head = trimmed.slice(0, 800);
  const firstLine = head.split(/\r?\n/, 1)[0] ?? "";

  if (/^#!\/bin\/(ba)?sh\b/m.test(head) || /^#!\/usr\/bin\/env\s+(ba)?sh\b/m.test(head)) {
    return "bash";
  }
  if (
    /^#!\/usr\/bin\/env\s+python/m.test(head) ||
    /^#!\/.*python/i.test(firstLine) ||
    /^(from __future__|import |def |class )/m.test(head)
  ) {
    return "python";
  }
  if (
    /^#include\s+[<"]/m.test(head) ||
    /\bnamespace\s+[\w:]+\b/.test(head) ||
    /\bstd::\w+/.test(head) ||
    /\b(uint\d+_t|size_t|nullptr)\b/.test(head)
  ) {
    return "cpp";
  }
  if (
    /^(function |const |let |var |export |import .+ from )/m.test(head) ||
    /=>\s*\{/.test(head)
  ) {
    return "javascript";
  }
  if (/^(interface |type |enum )/m.test(head)) {
    return "typescript";
  }
  try {
    JSON.parse(trimmed);
    return "json";
  } catch {
    /* not json */
  }
  if (/^\s*#!/.test(firstLine) && /perl/.test(firstLine)) {
    return "perl";
  }
  if (/^\s*(SELECT|INSERT|UPDATE|DELETE|CREATE)\s+/im.test(head)) {
    return "sql";
  }

  const iniLike = trimmed.split(/\r?\n/).some((line) => {
    const t = line.trim();
    return t.length > 0 && !t.startsWith("#") && /^[\w.-]+\s*=\s*\S+/.test(t);
  });
  if (iniLike) return "ini";

  if (/^(#!\/bin\/)/.test(firstLine)) return "bash";

  return "text";
}

export type InlineCodeSegment = { text: string; className: string };

export type InlineCodeStyle = {
  classNames: string[];
  segments: InlineCodeSegment[];
};

function baseSegments(text: string, className: string): InlineCodeStyle {
  return {
    classNames: ["md-inline-code", className],
    segments: [{ text, className }],
  };
}

function isLikelySourceExtension(ext: string): boolean {
  return /^[a-z0-9+#]{1,12}$/i.test(ext);
}

function parseFileReference(text: string): InlineCodeStyle | null {
  const m = text.match(SOURCE_FILE_RE);
  if (!m?.groups?.file) return null;
  const ext = extensionFromFilename(m.groups.file);
  if (!ext || !isLikelySourceExtension(ext)) return null;
  const lang = normalizeHighlightLanguage(ext);
  const classNames = [
    "md-inline-code",
    "md-code-path",
    langCssClass(lang),
  ];
  const segments: InlineCodeSegment[] = [
    { text: m.groups.file, className: "md-code-file" },
  ];
  if (m.groups.lines) {
    segments.push({ text: ":", className: "md-code-sep" });
    segments.push({ text: m.groups.lines, className: "md-code-lines" });
  }
  return { classNames, segments };
}

function parseQualifiedCall(text: string): InlineCodeStyle | null {
  const fnMatch = /^([\w:]+(?:::[\w]+)*)\s*(\([^)]*\))$/.exec(text);
  if (!fnMatch) return null;
  const qual = fnMatch[1];
  const parens = fnMatch[2];
  const parts = qual.split("::");
  const segments: InlineCodeSegment[] = [];
  parts.forEach((part, i) => {
    if (i > 0) segments.push({ text: "::", className: "md-code-sep" });
    segments.push({
      text: part,
      className: i < parts.length - 1 ? "md-code-ns" : "md-code-fn",
    });
  });
  segments.push({ text: parens, className: "md-code-punct" });
  return {
    classNames: ["md-inline-code", "md-code-call"],
    segments,
  };
}

function parseQualifiedName(text: string): InlineCodeStyle | null {
  if (!text.includes("::")) return null;
  const parts = text.split("::");
  const segments: InlineCodeSegment[] = [];
  parts.forEach((part, i) => {
    if (i > 0) segments.push({ text: "::", className: "md-code-sep" });
    segments.push({
      text: part,
      className: i < parts.length - 1 ? "md-code-ns" : "md-code-fn",
    });
  });
  return {
    classNames: ["md-inline-code", "md-code-qualified"],
    segments,
  };
}

function parseMemberAccess(text: string): InlineCodeStyle | null {
  const m = /^([\w-]+)(->|\.)([\w]+)(\(\))?$/.exec(text);
  if (!m) return null;
  const segments: InlineCodeSegment[] = [
    { text: m[1], className: "md-code-object" },
    { text: m[2], className: "md-code-sep" },
    { text: m[3], className: "md-code-field" },
  ];
  if (m[4]) segments.push({ text: m[4], className: "md-code-punct" });
  return {
    classNames: ["md-inline-code", "md-code-member-expr"],
    segments,
  };
}

/** Classify a single backtick span for themed inline styling */
export function classifyInlineCode(raw: string): InlineCodeStyle {
  const text = raw.trim();
  if (!text) {
    return {
      classNames: ["md-inline-code"],
      segments: [{ text: raw, className: "md-code-default" }],
    };
  }

  const fileRef = parseFileReference(text);
  if (fileRef) return fileRef;

  if (MACRO_RE.test(text)) return baseSegments(text, "md-code-macro");

  const call = parseQualifiedCall(text);
  if (call) return call;

  const member = parseMemberAccess(text);
  if (member) return member;

  const qualified = parseQualifiedName(text);
  if (qualified) return qualified;

  if (NUMBER_RE.test(text)) return baseSegments(text, "md-code-number");
  if (STRING_RE.test(text)) return baseSegments(text, "md-code-string");
  if (KEYWORD_RE.test(text)) return baseSegments(text, "md-code-keyword");

  if (/^[a-z][a-z0-9_]*$/.test(text) && text.includes("_")) {
    return baseSegments(text, "md-code-field");
  }

  if (/^\w+\(\)$/.test(text)) {
    const name = text.slice(0, -2);
    return {
      classNames: ["md-inline-code", "md-code-call"],
      segments: [
        { text: name, className: "md-code-fn" },
        { text: "()", className: "md-code-punct" },
      ],
    };
  }

  if (/^[a-zA-Z_]\w*$/.test(text)) {
    return baseSegments(text, "md-code-identifier");
  }

  return baseSegments(text, "md-code-default");
}
