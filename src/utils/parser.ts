import { Student } from '../types/classroom';

const HEADER_KEYWORDS = new Set([
  '姓名',
  '學生姓名',
  '名字',
  '同學',
  '學生',
  'name',
  'student',
  'student name',
  'fullname',
  'full name',
  '座號',
  '學號',
  '編號',
  '序號',
  'no',
  'no.',
  'id',
  'number',
  'seat',
  'seat no',
]);

const SEAT_HEADER_KEYWORDS = new Set([
  '座號',
  '學號',
  '編號',
  '序號',
  'no',
  'no.',
  'id',
  'number',
  'seat',
  'seat no',
]);

const NAME_HEADER_KEYWORDS = new Set([
  '姓名',
  '學生姓名',
  '名字',
  '同學',
  '學生',
  'name',
  'student',
  'student name',
  'fullname',
  'full name',
]);

function createId(prefix = 'stu'): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Parses a single CSV line handling quoted fields properly.
 */
function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if ((ch === ',' || ch === '\t' || ch === '，') && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

function looksLikeSeatNumber(value: string): boolean {
  const cleaned = value.trim();
  return /^[0-9A-Za-z-]{1,12}$/.test(cleaned) && /\d/.test(cleaned);
}

export interface ParseResult {
  students: Student[];
  duplicatesRemoved: number;
}

/**
 * Parses pasted text or CSV content into a clean list of Student objects.
 * Supports:
 * - Single-column names (newline, comma, Chinese comma, or semicolon separated)
 * - Two-column CSV/TSV with seat number and name (e.g. "01, 王小明" or "王小明, 01")
 * - Optional header row detection ("座號,姓名", "Name", etc.)
 */
export function parseStudentText(rawText: string, deduplicate = true): ParseResult {
  const cleanText = rawText.replace(/^\uFEFF/, '').trim();
  if (!cleanText) {
    return { students: [], duplicatesRemoved: 0 };
  }

  const rawLines = cleanText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (rawLines.length === 0) {
    return { students: [], duplicatesRemoved: 0 };
  }

  // Case 1: Single line with multiple names separated by commas, Chinese commas, Chinese ideographic commas, or semicolons
  if (rawLines.length === 1 && /[,，、;；]/.test(rawLines[0])) {
    const tokens = rawLines[0]
      .split(/[,，、;；]/)
      .map((t) => t.replace(/^["']|["']$/g, '').trim())
      .filter((t) => t.length > 0 && !HEADER_KEYWORDS.has(t.toLowerCase()));

    return finalizeStudents(
      tokens.map((name) => ({ id: createId(), name })),
      deduplicate
    );
  }

  // Parse each line into columns
  const rows = rawLines.map((line) => parseCsvLine(line));

  let startIndex = 0;
  let seatColIdx = -1;
  let nameColIdx = -1;

  // Detect header row if present
  const firstRow = rows[0];
  const normalizedFirst = firstRow.map((cell) => cell.toLowerCase().trim());
  const hasHeaderKeyword = normalizedFirst.some((cell) => HEADER_KEYWORDS.has(cell));

  if (hasHeaderKeyword) {
    startIndex = 1;
    normalizedFirst.forEach((cell, idx) => {
      if (NAME_HEADER_KEYWORDS.has(cell) && nameColIdx === -1) {
        nameColIdx = idx;
      } else if (SEAT_HEADER_KEYWORDS.has(cell) && seatColIdx === -1) {
        seatColIdx = idx;
      }
    });
  }

  const parsed: Student[] = [];

  for (let i = startIndex; i < rows.length; i++) {
    const cols = rows[i].filter((c) => c.length > 0);
    if (cols.length === 0) continue;

    // If header explicitly told us which columns to use
    if (nameColIdx !== -1 && rows[i][nameColIdx]) {
      const name = rows[i][nameColIdx].trim();
      const seatNo = seatColIdx !== -1 ? rows[i][seatColIdx]?.trim() : undefined;
      if (name) {
        parsed.push({ id: createId(), name, seatNo: seatNo || undefined });
      }
      continue;
    }

    if (cols.length === 1) {
      // Check patterns like "01 王小明" or "1. 王小明"
      const match = cols[0].match(/^(\d{1,4})[.\s、)-]+(.+)$/);
      if (match) {
        parsed.push({
          id: createId(),
          seatNo: match[1].trim(),
          name: match[2].trim(),
        });
      } else {
        parsed.push({ id: createId(), name: cols[0] });
      }
    } else {
      // Multi-column without explicit header: check if col 0 is seat/ID and col 1 is name
      if (looksLikeSeatNumber(cols[0]) && !looksLikeSeatNumber(cols[1])) {
        parsed.push({ id: createId(), seatNo: cols[0], name: cols[1] });
      } else if (looksLikeSeatNumber(cols[1]) && !looksLikeSeatNumber(cols[0])) {
        parsed.push({ id: createId(), seatNo: cols[1], name: cols[0] });
      } else {
        // Otherwise treat every non-empty cell on the line as a student name (e.g. comma-separated roster lines)
        cols.forEach((cell) => {
          if (cell && !HEADER_KEYWORDS.has(cell.toLowerCase())) {
            parsed.push({ id: createId(), name: cell });
          }
        });
      }
    }
  }

  return finalizeStudents(parsed, deduplicate);
}

function finalizeStudents(list: Student[], deduplicate: boolean): ParseResult {
  if (!deduplicate) {
    return { students: list, duplicatesRemoved: 0 };
  }

  const seen = new Set<string>();
  const unique: Student[] = [];
  let duplicatesRemoved = 0;

  for (const stu of list) {
    const key = `${stu.seatNo ?? ''}::${stu.name.trim()}`;
    if (seen.has(key)) {
      duplicatesRemoved++;
      continue;
    }
    seen.add(key);
    unique.push(stu);
  }

  return { students: unique, duplicatesRemoved };
}

/**
 * Reads an uploaded CSV/TXT file with automatic UTF-8 / Big5 encoding detection.
 */
export async function readRosterFile(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const utf8Text = new TextDecoder('utf-8').decode(buffer);

  // If UTF-8 decoding produces replacement chars (common for Big5 Excel CSVs in Taiwan), fallback to Big5
  if (utf8Text.includes('\uFFFD')) {
    try {
      return new TextDecoder('big5').decode(buffer);
    } catch {
      return utf8Text;
    }
  }

  return utf8Text;
}

export const SAMPLE_CLASS_ROSTER: Array<{ seatNo: string; name: string }> = [
  { seatNo: '01', name: '林宥辰' },
  { seatNo: '02', name: '陳品妍' },
  { seatNo: '03', name: '張宇軒' },
  { seatNo: '04', name: '李芷晴' },
  { seatNo: '05', name: '王柏翰' },
  { seatNo: '06', name: '吳語彤' },
  { seatNo: '07', name: '劉子豪' },
  { seatNo: '08', name: '蔡宜蓁' },
  { seatNo: '09', name: '楊承恩' },
  { seatNo: '10', name: '許心瑜' },
  { seatNo: '11', name: '鄭凱文' },
  { seatNo: '12', name: '謝欣妤' },
  { seatNo: '13', name: '郭冠宇' },
  { seatNo: '14', name: '洪苡安' },
  { seatNo: '15', name: '曾子睿' },
  { seatNo: '16', name: '邱詠晴' },
  { seatNo: '17', name: '廖彥廷' },
  { seatNo: '18', name: '徐若寧' },
  { seatNo: '19', name: '周柏宇' },
  { seatNo: '20', name: '黃婕希' },
  { seatNo: '21', name: '賴品睿' },
  { seatNo: '22', name: '蘇芸熙' },
  { seatNo: '23', name: '莊皓宇' },
  { seatNo: '24', name: '呂沛恩' },
  { seatNo: '25', name: '江承翰' },
  { seatNo: '26', name: '何羽彤' },
  { seatNo: '27', name: '羅奕辰' },
  { seatNo: '28', name: '高千涵' },
];

export function createSampleStudents(): Student[] {
  return SAMPLE_CLASS_ROSTER.map((item) => ({
    id: createId('sample'),
    seatNo: item.seatNo,
    name: item.name,
  }));
}

export interface DuplicateNameStats {
  duplicateNames: Set<string>;
  nameCounts: Map<string, number>;
  extraCount: number;
}

/**
 * Finds all student names that appear more than once (trimmed, case-insensitive).
 */
export function getDuplicateNameStats(students: Student[]): DuplicateNameStats {
  const nameCounts = new Map<string, number>();
  for (const s of students) {
    const key = s.name.trim().toLowerCase();
    if (!key) continue;
    nameCounts.set(key, (nameCounts.get(key) ?? 0) + 1);
  }

  const duplicateNames = new Set<string>();
  let extraCount = 0;

  nameCounts.forEach((count, key) => {
    if (count > 1) {
      duplicateNames.add(key);
      extraCount += count - 1;
    }
  });

  return { duplicateNames, nameCounts, extraCount };
}

/**
 * Removes duplicate student entries by name, keeping the first occurrence of each name.
 */
export function removeDuplicateStudentsByName(students: Student[]): {
  uniqueStudents: Student[];
  removedCount: number;
} {
  const seen = new Set<string>();
  const uniqueStudents: Student[] = [];
  let removedCount = 0;

  for (const student of students) {
    const key = student.name.trim().toLowerCase();
    if (seen.has(key)) {
      removedCount++;
      continue;
    }
    seen.add(key);
    uniqueStudents.push(student);
  }

  return { uniqueStudents, removedCount };
}

export function downloadCsvTemplate(): void {
  const header = '座號,姓名\n';
  const body = SAMPLE_CLASS_ROSTER.slice(0, 8)
    .map((s) => `${s.seatNo},${s.name}`)
    .join('\n');
  const bom = '\uFEFF';
  const blob = new Blob([bom + header + body], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = '班級名單範本.csv';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
