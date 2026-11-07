export function parseReleaseNotes(markdown, limit = 5) {
  const sections = markdown.split(/^## /m).slice(1, limit + 1);
  return sections.map(section => {
    const [heading, ...lines] = section.split(/\r?\n/);
    const version = /^(\d+\.\d+\.\d+)\b/.exec(heading)?.[1];
    if (!version) return null;
    return {
      version,
      changes: lines.filter(line => /^- /.test(line)).map(line => line.slice(2).trim())
    };
  }).filter(Boolean);
}
