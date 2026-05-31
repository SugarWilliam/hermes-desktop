import { useEffect, useRef, useState, memo, useCallback } from "react";

let diagramSeq = 0;

interface MermaidDiagramProps {
  code: string;
}

const MermaidDiagram = memo(function MermaidDiagram({
  code,
}: MermaidDiagramProps): React.JSX.Element {
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const idRef = useRef(`mermaid-${++diagramSeq}`);

  const renderDiagram = useCallback(async () => {
    try {
      const mermaid = (await import("mermaid")).default;
      mermaid.initialize({
        startOnLoad: false,
        theme: "neutral",
        securityLevel: "strict",
        fontFamily: "var(--font-family, monospace)",
      });
      const { svg: renderedSvg } = await mermaid.render(idRef.current, code);
      setSvg(renderedSvg);
      setError(null);
    } catch (err) {
      setSvg(null);
      setError(
        err instanceof Error ? err.message : "Mermaid diagram render error",
      );
    }
  }, [code]);

  useEffect(() => {
    renderDiagram();
  }, [renderDiagram]);

  if (error) {
    return (
      <div className="mermaid-error">
        <span className="mermaid-error-icon">{"\u26A0"}</span>
        <div className="mermaid-error-body">
          <div className="mermaid-error-title">Mermaid Diagram Error</div>
          <pre className="mermaid-error-detail">{error}</pre>
        </div>
      </div>
    );
  }

  if (!svg) {
    return (
      <div className="mermaid-loading">
        <span className="mermaid-loading-spinner" />
        Rendering diagram...
      </div>
    );
  }

  return (
    <div
      className="mermaid-diagram"
      ref={containerRef}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
});

export { MermaidDiagram };
export default MermaidDiagram;
