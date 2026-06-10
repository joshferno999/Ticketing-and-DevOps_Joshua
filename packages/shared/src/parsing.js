const TASK_ID_PATTERNS = [
    /\[Asana:(\d{6,})\]/gi,
    /\bAsana:(\d{6,})\b/gi,
    /\basana[-/](\d{6,})\b/gi
];
export function extractAsanaTaskIds(source) {
    const matches = new Set();
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
export function primaryAsanaTaskId(source) {
    return extractAsanaTaskIds(source).taskGids[0] ?? null;
}
