interface MarkdownNode {
  type: string;
  value?: string;
  children?: MarkdownNode[];
}

// Support model-generated table line breaks without enabling arbitrary HTML.
export function remarkLineBreaks() {
  return function transform(node: MarkdownNode) {
    if (node.type === "html" && /^<br\s*\/?\s*>$/i.test(node.value?.trim() || "")) {
      node.type = "break";
      delete node.value;
    }
    node.children?.forEach(transform);
  };
}
