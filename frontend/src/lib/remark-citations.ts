interface Node {
  type: string;
  value?: string;
  url?: string;
  children?: Node[];
}

export function remarkCitations() {
  return function transform(node: Node) {
    if (!node.children || node.type === "link" || node.type === "code") return;
    node.children = node.children.flatMap((child): Node[] => {
      if (child.type !== "text") { transform(child); return [child]; }
      const text = child.value || "";
      const result: Node[] = [];
      let offset = 0;
      for (const match of text.matchAll(/\[Source\s+(\d+)\]/gi)) {
        if (match.index! > offset) result.push({ type: "text", value: text.slice(offset, match.index) });
        result.push({ type: "link", url: `#source-${match[1]}`, children: [{ type: "text", value: match[0] }] });
        offset = match.index! + match[0].length;
      }
      if (offset < text.length) result.push({ type: "text", value: text.slice(offset) });
      return result.length ? result : [child];
    });
  };
}
