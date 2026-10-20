#!/usr/bin/env node
/**
 * Render docs/CONTRACT_API.md from a NEAR ABI JSON file.
 *
 * Usage: node scripts/abi-to-markdown.mjs [abi.json] [out.md]
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const abiPath = resolve(root, process.argv[2] || "docs/contract-abi.json");
const outPath = resolve(root, process.argv[3] || "docs/CONTRACT_API.md");

const abi = JSON.parse(readFileSync(abiPath, "utf8"));
const body = abi.body || {};
const functions = [...(body.functions || [])].sort((a, b) =>
  a.name.localeCompare(b.name)
);
const definitions = body.root_schema?.definitions || {};
const meta = abi.metadata || {};

function refName(schema) {
  if (!schema || typeof schema !== "object") return null;
  if (schema.$ref) return schema.$ref.split("/").pop();
  return null;
}

function typeSummary(schema, depth = 0) {
  if (schema === true) return "`any` (JSON)";
  if (schema === false) return "`never`";
  if (schema == null) return "`—`";
  if (typeof schema !== "object") return `\`${String(schema)}\``;

  const ref = refName(schema);
  if (ref) return `[\`${ref}\`](#${ref.toLowerCase()})`;

  if (schema.anyOf) {
    return schema.anyOf.map((s) => typeSummary(s, depth + 1)).join(" | ");
  }
  if (schema.oneOf) {
    return schema.oneOf.map((s) => typeSummary(s, depth + 1)).join(" | ");
  }
  if (schema.type === "array") {
    return `${typeSummary(schema.items, depth + 1)}[]`;
  }
  if (Array.isArray(schema.type)) {
    return schema.type.map((t) => `\`${t}\``).join(" | ");
  }
  if (schema.type) return `\`${schema.type}\``;
  if (schema.enum) {
    return schema.enum.map((v) => `\`${JSON.stringify(v)}\``).join(" | ");
  }
  return "`object`";
}

function cleanDoc(doc) {
  if (!doc) return "";
  return doc
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .join(" ");
}

function formatArgs(fn) {
  const args = fn.params?.args;
  if (!args || args.length === 0) return "_None_";
  const rows = args.map((arg) => {
    const t = typeSummary(arg.type_schema);
    // Prefer short type; skip verbose AccountId crate docs in the table.
    return `| \`${arg.name}\` | ${t} |`;
  });
  return ["| Name | Type |", "| --- | --- |", ...rows].join("\n");
}

function formatResult(fn) {
  if (!fn.result) return "_void_";
  return typeSummary(fn.result.type_schema);
}

function formatModifiers(fn) {
  const mods = fn.modifiers || [];
  if (!mods.length) return "—";
  return mods.map((m) => `\`${m}\``).join(", ");
}

function renderFunction(fn) {
  const lines = [];
  lines.push(`### \`${fn.name}\``);
  lines.push("");
  lines.push(`- **Kind:** \`${fn.kind}\``);
  lines.push(`- **Modifiers:** ${formatModifiers(fn)}`);
  const doc = cleanDoc(fn.doc);
  if (doc) lines.push(`- **Doc:** ${doc}`);
  lines.push("");
  lines.push("**Arguments**");
  lines.push("");
  lines.push(formatArgs(fn));
  lines.push("");
  lines.push(`**Returns:** ${formatResult(fn)}`);
  lines.push("");
  return lines.join("\n");
}

function renderType(name, schema) {
  const lines = [];
  lines.push(`### ${name}`);
  lines.push("");
  if (schema.description) {
    lines.push(cleanDoc(schema.description));
    lines.push("");
  }
  if (schema.enum) {
    lines.push(`Enum: ${schema.enum.map((v) => `\`${v}\``).join(" | ")}`);
    lines.push("");
    return lines.join("\n");
  }
  if (schema.type === "object" && schema.properties) {
    const required = new Set(schema.required || []);
    const rows = Object.keys(schema.properties)
      .sort()
      .map((key) => {
        const prop = schema.properties[key];
        const req = required.has(key) ? "yes" : "no";
        return `| \`${key}\` | ${typeSummary(prop)} | ${req} |`;
      });
    lines.push("| Field | Type | Required |");
    lines.push("| --- | --- | --- |");
    lines.push(...rows);
    lines.push("");
    return lines.join("\n");
  }
  lines.push(`Schema type: ${typeSummary(schema)}`);
  lines.push("");
  return lines.join("\n");
}

const views = functions.filter((f) => f.kind === "view");
const calls = functions.filter((f) => f.kind === "call");
const pkg = meta.name || "contract";
const version = meta.version || "";

const out = [];
out.push(`# Contract API Reference`);
out.push("");
out.push(
  `> Generated from [\`contract-abi.json\`](./contract-abi.json) (NEAR ABI). Do not edit by hand — run \`scripts/generate-contract-api.sh\`.`
);
out.push("");
out.push(`- **Package:** \`${pkg}\`${version ? ` \`${version}\`` : ""}`);
out.push(`- **ABI schema version:** \`${abi.schema_version || "unknown"}\``);
out.push(`- **Methods:** ${functions.length} (${calls.length} call, ${views.length} view)`);
out.push("");
out.push("## Contents");
out.push("");
out.push("- [Call methods](#call-methods)");
out.push("- [View methods](#view-methods)");
out.push("- [Types](#types)");
out.push("");
out.push("## Call methods");
out.push("");
for (const fn of calls) out.push(renderFunction(fn));
out.push("## View methods");
out.push("");
for (const fn of views) out.push(renderFunction(fn));
out.push("## Types");
out.push("");
for (const name of Object.keys(definitions).sort()) {
  out.push(renderType(name, definitions[name]));
}

writeFileSync(outPath, out.join("\n") + "\n", "utf8");
console.log(`Wrote ${outPath} (${functions.length} methods, ${Object.keys(definitions).length} types)`);
