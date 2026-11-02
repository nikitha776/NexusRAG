import { cp, mkdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
const root = new URL("../node_modules/pdfjs-dist/", import.meta.url);
const { version } = JSON.parse(await readFile(new URL("package.json", root), "utf8"));
const target = new URL(`../public/pdfjs/${version}/`, import.meta.url);
await mkdir(target, { recursive: true });
for (const name of ["cmaps", "standard_fonts", "wasm", "build/pdf.worker.mjs"]) {
  const output = name.startsWith("build/") ? "pdf.worker.mjs" : name;
  await cp(fileURLToPath(new URL(name, root)), fileURLToPath(new URL(output, target)), { recursive: true });
}
