const TASK_ID_PATTERNS = [
  /\[Asana:(\d{6,})\]/gi,
  /\bAsana:(\d{6,})\b/gi,
  /\basana[-/](\d{6,})\b/gi
];

export interface ParsedAsanaReference {
  taskGids: string[];
  source: string;
}

export function extractAsanaTaskIds(source: string): ParsedAsanaReference {
  const matches = new Set<string>();

  for (const pattern of TASK_ID_PATTERNS) {
    for (const match of source.matchAll(pattern)) {
      if (match[1]) {
        matches.add(match[1]);
      }
    }
  }

  return {
    taskGids: [...matches],
    source
  };
}

export function primaryAsanaTaskId(source: string): string | null {
  return extractAsanaTaskIds(source).taskGids[0] ?? null;
}

