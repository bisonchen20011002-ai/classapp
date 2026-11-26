import * as XLSX from 'xlsx';
import { StudentGroup } from '../types/classroom';

export interface ExportOptions {
  activityTitle: string;
  includeSeatNo: boolean;
}

/**
 * Exports grouping results to a real multi-sheet Excel (.xlsx) workbook
 * designed for teachers to immediately record discussion, presentation, and total grades.
 */
export function exportGroupsToExcel(groups: StudentGroup[], options: ExportOptions): void {
  const wb = XLSX.utils.book_new();
  const todayStr = new Date().toISOString().slice(0, 10);
  const safeTitle = options.activityTitle.trim() || '課堂分組名單';

  // Sheet 1: 成績紀錄表 (Row-per-student grading sheet)
  const gradingHeader = options.includeSeatNo
    ? ['組別', '角色', '座號 / 編號', '學生姓名', '課堂參與', '小組討論', '成果報告', '加分 / 互評', '總分', '教師評語']
    : ['組別', '角色', '學生姓名', '課堂參與', '小組討論', '成果報告', '加分 / 互評', '總分', '教師評語'];

  const gradingRows: (string | number)[][] = [
    [`${safeTitle} — 成績紀錄表`, '', `日期：${todayStr}`, '', `共 ${groups.length} 組`],
    [],
    gradingHeader,
  ];

  groups.forEach((group) => {
    group.members.forEach((member) => {
      const role = group.leaderId === member.id ? '組長' : '組員';
      if (options.includeSeatNo) {
        gradingRows.push([
          group.name,
          role,
          member.seatNo ?? '',
          member.name,
          '',
          '',
          '',
          '',
          '',
          '',
        ]);
      } else {
        gradingRows.push([
          group.name,
          role,
          member.name,
          '',
          '',
          '',
          '',
          '',
          '',
        ]);
      }
    });
  });

  const wsGrading = XLSX.utils.aoa_to_sheet(gradingRows);
  wsGrading['!cols'] = options.includeSeatNo
    ? [
        { wch: 14 },
        { wch: 8 },
        { wch: 12 },
        { wch: 14 },
        { wch: 11 },
        { wch: 11 },
        { wch: 11 },
        { wch: 12 },
        { wch: 10 },
        { wch: 24 },
      ]
    : [
        { wch: 14 },
        { wch: 8 },
        { wch: 14 },
        { wch: 11 },
        { wch: 11 },
        { wch: 11 },
        { wch: 12 },
        { wch: 10 },
        { wch: 24 },
      ];

  XLSX.utils.book_append_sheet(wb, wsGrading, '成績紀錄表');

  // Sheet 2: 組別座位總覽 (Column-per-group matrix for quick classroom printing)
  const maxMembers = Math.max(0, ...groups.map((g) => g.members.length));
  const matrixRows: string[][] = [
    [`${safeTitle} — 分組名單總覽 (${todayStr})`],
    [],
    groups.map((g) => `${g.name} (${g.members.length}人)`),
  ];

  for (let rowIdx = 0; rowIdx < maxMembers; rowIdx++) {
    const row = groups.map((g) => {
      const member = g.members[rowIdx];
      if (!member) return '';
      const leaderMark = g.leaderId === member.id ? '★ ' : '';
      const seatPrefix = options.includeSeatNo && member.seatNo ? `${member.seatNo} ` : '';
      return `${leaderMark}${seatPrefix}${member.name}`;
    });
    matrixRows.push(row);
  }

  // Add an extra blank score row at bottom of matrix for quick group-level score recording
  matrixRows.push([]);
  matrixRows.push(groups.map(() => '小組總分：'));

  const wsMatrix = XLSX.utils.aoa_to_sheet(matrixRows);
  wsMatrix['!cols'] = groups.map(() => ({ wch: 18 }));
  XLSX.utils.book_append_sheet(wb, wsMatrix, '組別總覽');

  const fileName = `${safeTitle}_${todayStr}.xlsx`;
  XLSX.writeFile(wb, fileName);
}

function escapeCsvCell(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Exports grouping results to a UTF-8 (with BOM) CSV file compatible with Excel and Google Sheets.
 */
export function exportGroupsToCsv(groups: StudentGroup[], options: ExportOptions): void {
  const todayStr = new Date().toISOString().slice(0, 10);
  const safeTitle = options.activityTitle.trim() || '課堂分組名單';

  const header = options.includeSeatNo
    ? ['組別', '角色', '座號/編號', '學生姓名', '課堂參與', '小組討論', '成果報告', '加分/互評', '總分', '教師評語']
    : ['組別', '角色', '學生姓名', '課堂參與', '小組討論', '成果報告', '加分/互評', '總分', '教師評語'];

  const lines: string[] = [header.map(escapeCsvCell).join(',')];

  groups.forEach((group) => {
    group.members.forEach((member) => {
      const role = group.leaderId === member.id ? '組長' : '組員';
      const row = options.includeSeatNo
        ? [group.name, role, member.seatNo ?? '', member.name, '', '', '', '', '', '']
        : [group.name, role, member.name, '', '', '', '', '', ''];
      lines.push(row.map(escapeCsvCell).join(','));
    });
  });

  const bom = '\uFEFF';
  const blob = new Blob([bom + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${safeTitle}_${todayStr}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
