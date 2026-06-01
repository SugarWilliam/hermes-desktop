import {
  cloneElement,
  isValidElement,
  type ReactElement,
  type ReactNode,
} from "react";
import {
  parseCallout,
  stripCalloutPrefix,
  type ParsedCallout,
} from "../../../shared/markdownCallout";

function textFromNode(node: ReactNode): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textFromNode).join("");
  if (isValidElement(node)) {
    return textFromNode((node as ReactElement<{ children?: ReactNode }>).props
      .children);
  }
  return "";
}

function stripPrefixInNode(node: ReactNode, callout: ParsedCallout): ReactNode {
  if (node == null || typeof node === "boolean") return node;
  if (typeof node === "string") {
    return stripCalloutPrefix(node, callout.prefixPattern);
  }
  if (typeof node === "number") return node;
  if (Array.isArray(node)) {
    return node.map((child, i) =>
      i === 0 ? stripPrefixInNode(child, callout) : child,
    );
  }
  if (isValidElement(node)) {
    const kids = (node as ReactElement<{ children?: ReactNode }>).props.children;
    if (kids == null) return node;
    const stripped = stripPrefixInNode(kids, callout);
    if (stripped === kids) return node;
    return cloneElement(node, undefined, stripped);
  }
  return node;
}

/** Remove alert prefix from the first block inside a blockquote. */
export function calloutBodyChildren(
  children: ReactNode,
  callout: ParsedCallout,
): ReactNode {
  if (!children) return children;
  const list = Array.isArray(children) ? children : [children];
  if (list.length === 0) return children;
  const first = list[0];
  const firstText = textFromNode(first).trimStart();
  if (!callout.prefixPattern.test(firstText)) return children;
  const rest = list.slice(1);
  const strippedFirst = stripPrefixInNode(first, callout);
  if (rest.length === 0) return strippedFirst;
  return [strippedFirst, ...rest];
}

export function detectCallout(children: ReactNode): ParsedCallout | null {
  return parseCallout(textFromNode(children));
}
