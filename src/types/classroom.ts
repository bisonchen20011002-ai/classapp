export type ActiveTab = 'roster' | 'picker' | 'groups';

export interface Student {
  id: string;
  name: string;
  seatNo?: string;
}

export interface DrawRecord {
  id: string;
  student: Student;
  order: number;
  timestamp: string;
}

export type RemainderMode = 'distribute' | 'separate';

export interface StudentGroup {
  id: string;
  name: string;
  colorIndex: number;
  leaderId: string | null;
  members: Student[];
}
