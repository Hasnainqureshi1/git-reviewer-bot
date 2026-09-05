const DEFAULT_CHUNK_SIZE = 15_000;
const DEFAULT_MAX_SIZE = 60_000;

export interface DiffChunks {
  chunks: string[];
  truncated: boolean;
  originalCharacters: number;
}

export function chunkDiff(
  diff: string,
  maxCharacters = DEFAULT_MAX_SIZE,
  chunkCharacters = DEFAULT_CHUNK_SIZE,
): DiffChunks {
  if (maxCharacters <= 0 || chunkCharacters <= 0) {
    throw new Error("Diff size limits must be positive numbers");
  }

  const normalized = diff.replaceAll("\u0000", "");
  const limited = normalized.slice(0, maxCharacters);

  if (limited.length === 0) {
    return { chunks: ["(empty diff)"], truncated: false, originalCharacters: 0 };
  }

  const chunks: string[] = [];
  let current = "";

  for (const line of limited.split("\n")) {
    const nextLine = `${line}\n`;
    if (current && current.length + nextLine.length > chunkCharacters) {
      chunks.push(current);
      current = "";
    }

    if (nextLine.length > chunkCharacters) {
      for (let offset = 0; offset < nextLine.length; offset += chunkCharacters) {
        const part = nextLine.slice(offset, offset + chunkCharacters);
        if (current) {
          chunks.push(current);
          current = "";
        }
        chunks.push(part);
      }
    } else {
      current += nextLine;
    }
  }

  if (current) chunks.push(current);

  return {
    chunks: chunks.length ? chunks : ["(empty diff)"],
    truncated: normalized.length > maxCharacters,
    originalCharacters: normalized.length,
  };
}
