import type { Contributor } from "./types";

export function parseContributors(source: string): Contributor[] {
  return source
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"))
    .map((line) =>
      line
        .replace(/^[*-]\s*/, "")
        .replace(/[()]/g, " ")
        .trim(),
    )
    .map((line) => {
      const tokens = line.split(/\s+/).filter(Boolean);
      const firstToken = tokens[0]?.toLowerCase() ?? "";
      const main = firstToken === "master" || firstToken === "main";
      const github = main ? (tokens[1] ?? "") : (tokens[0] ?? "");
      return { github, main };
    })
    .filter((contributor) => contributor.github.length > 0);
}
