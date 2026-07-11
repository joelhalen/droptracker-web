/** Truncate markdown content to a maximum number of lines. */
export function truncateMarkdown(content: string, maxLines: number): string {
  const lines = content.split("\n");
  if (lines.length <= maxLines) {
    return content;
  }
  return lines.slice(0, maxLines).join("\n") + "\n\n...";
}
