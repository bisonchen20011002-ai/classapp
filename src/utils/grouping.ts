import { RemainderMode, Student, StudentGroup } from '../types/classroom';

function secureRandomInt(maxExclusive: number): number {
  if (maxExclusive <= 1) return 0;
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const arr = new Uint32Array(1);
    crypto.getRandomValues(arr);
    return arr[0] % maxExclusive;
  }
  return Math.floor(Math.random() * maxExclusive);
}

/**
 * Unbiased Fisher-Yates shuffle.
 */
export function shuffleStudents(students: Student[]): Student[] {
  const copy = [...students];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = secureRandomInt(i + 1);
    const temp = copy[i];
    copy[i] = copy[j];
    copy[j] = temp;
  }
  return copy;
}

/**
 * Generates balanced randomized student groups based on target group size and remainder strategy.
 */
export function buildStudentGroups(
  students: Student[],
  groupSize: number,
  remainderMode: RemainderMode
): StudentGroup[] {
  if (students.length === 0) return [];

  const safeSize = Math.max(2, groupSize);
  const shuffled = shuffleStudents(students);

  if (shuffled.length <= safeSize) {
    return [
      {
        id: `grp_1_${Date.now().toString(36)}`,
        name: '第 1 組',
        colorIndex: 0,
        leaderId: shuffled[0]?.id ?? null,
        members: shuffled,
      },
    ];
  }

  const buckets: Student[][] = [];

  if (remainderMode === 'distribute') {
    const groupCount = Math.max(1, Math.floor(shuffled.length / safeSize));
    for (let i = 0; i < groupCount; i++) {
      buckets.push([]);
    }
    shuffled.forEach((student, idx) => {
      buckets[idx % groupCount].push(student);
    });
  } else {
    for (let i = 0; i < shuffled.length; i += safeSize) {
      buckets.push(shuffled.slice(i, i + safeSize));
    }
  }

  const stamp = Date.now().toString(36);
  return buckets.map((members, idx) => ({
    id: `grp_${idx + 1}_${stamp}`,
    name: `第 ${idx + 1} 組`,
    colorIndex: idx,
    leaderId: members[0]?.id ?? null,
    members,
  }));
}
