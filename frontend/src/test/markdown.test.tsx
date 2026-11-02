import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { remarkLineBreaks } from "@/lib/remark-line-breaks";
import { remarkCitations } from "@/lib/remark-citations";

it("links numbered citations without modifying code examples", () => {
  const { container } = render(<ReactMarkdown remarkPlugins={[remarkCitations]}>{'Evidence [Source 2]. `<br> [Source 1]`'}</ReactMarkdown>);
  expect(screen.getByRole("link", { name: "[Source 2]" })).toHaveAttribute("href", "#source-2");
  expect(container.querySelector("code")).toHaveTextContent("[Source 1]");
  expect(container.querySelectorAll("a")).toHaveLength(1);
});

it("renders HTML line breaks in tables while preserving code and escaping other HTML", () => {
  const { container } = render(<ReactMarkdown remarkPlugins={[remarkGfm, remarkLineBreaks]}>{
    '| Skills |\n| --- |\n| First<br>Second<BR/>Third<br />Fourth |\n\n`<br>`\n\n<img src="x" onerror="alert(1)">'
  }</ReactMarkdown>);
  expect(screen.getByRole("cell").querySelectorAll("br")).toHaveLength(3);
  expect(container.querySelector("code")).toHaveTextContent("<br>");
  expect(container.querySelector("img")).toBeNull();
});
