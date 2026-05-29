/** GitHub-style heading slug for TOC / anchor links. */
export function slugifyHeading(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(
      /[.．、,，;；:：!?！？'"''""()[\]（）【】「」]/g,
      "",
    )
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function createUniqueSlugger(): (text: string) => string {
  const seen = new Map<string, number>();
  return (text: string): string => {
    const base = slugifyHeading(text);
    const key = base || "section";
    const count = seen.get(key) ?? 0;
    seen.set(key, count + 1);
    return count === 0 ? key : `${key}-${count}`;
  };
}

export function resolveAnchorTarget(
  root: ParentNode,
  hash: string,
): HTMLElement | null {
  const raw = decodeURIComponent(hash.replace(/^#/, "").trim());
  if (!raw) return null;

  const byId = (id: string): HTMLElement | null => {
    try {
      return root.querySelector(`#${CSS.escape(id)}`) as HTMLElement | null;
    } catch {
      return root.querySelector(`[id="${id}"]`) as HTMLElement | null;
    }
  };

  let el = byId(raw);
  if (el) return el;

  const slug = slugifyHeading(raw);
  el = byId(slug);
  if (el) return el;

  const headings = root.querySelectorAll("h1,h2,h3,h4,h5,h6");
  for (const heading of headings) {
    const h = heading as HTMLElement;
    const id = h.getAttribute("id");
    if (id === raw || id === slug) return h;
    const hSlug = slugifyHeading(h.textContent || "");
    if (hSlug === raw || hSlug === slug) return h;
  }

  return null;
}

export function scrollToMarkdownAnchor(
  root: ParentNode,
  hash: string,
): boolean {
  const target = resolveAnchorTarget(root, hash);
  if (!target) return false;
  target.scrollIntoView({ behavior: "smooth", block: "start" });
  return true;
}

export function isExternalHref(href: string): boolean {
  if (!href) return false;
  if (href.startsWith("#")) return false;
  try {
    const url = new URL(href, "https://placeholder.invalid");
    return ["http:", "https:", "mailto:"].includes(url.protocol);
  } catch {
    return false;
  }
}
