import React, { useMemo, useState } from 'react';
import {
  ArrowLeftRight,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  GripVertical,
  ListChecks,
  Minus,
  Plus,
  Shuffle,
  Star,
  Users,
} from 'lucide-react';
import { ActiveTab, RemainderMode, Student, StudentGroup } from '../types/classroom';
import { exportGroupsToCsv, exportGroupsToExcel } from '../utils/excelExport';
import { soundEngine } from '../utils/sound';

interface GroupGeneratorProps {
  students: Student[];
  groups: StudentGroup[];
  groupSize: number;
  remainderMode: RemainderMode;
  activityTitle: string;
  onChangeGroupSize: (size: number) => void;
  onChangeRemainderMode: (mode: RemainderMode) => void;
  onChangeActivityTitle: (title: string) => void;
  onRegenerateGroups: (size?: number, mode?: RemainderMode) => void;
  onUpdateGroups: (groups: StudentGroup[]) => void;
  onLoadSimulatedRoster: () => void;
  onNavigateTab: (tab: ActiveTab) => void;
}

const GROUP_TOP_ACCENTS = [
  'bg-sky-600',
  'bg-teal-600',
  'bg-indigo-600',
  'bg-amber-600',
  'bg-rose-600',
  'bg-emerald-600',
  'bg-violet-600',
  'bg-slate-600',
];

type ViewMode = 'cards' | 'table';

interface SwapSelection {
  groupId: string;
  studentId: string;
  studentName: string;
}

export function GroupGenerator({
  students,
  groups,
  groupSize,
  remainderMode,
  activityTitle,
  onChangeGroupSize,
  onChangeRemainderMode,
  onChangeActivityTitle,
  onRegenerateGroups,
  onUpdateGroups,
  onLoadSimulatedRoster,
  onNavigateTab,
}: GroupGeneratorProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('cards');
  const [swapSelected, setSwapSelected] = useState<SwapSelection | null>(null);
  const [dragInfo, setDragInfo] = useState<{ fromGroupId: string; studentId: string } | null>(null);
  const [dragOverGroupId, setDragOverGroupId] = useState<string | null>(null);
  const [exportMessage, setExportMessage] = useState<string | null>(null);

  const hasAnySeatNo = useMemo(
    () => students.some((s) => Boolean(s.seatNo && s.seatNo.trim())),
    [students]
  );

  const maxGroupSize = Math.max(2, Math.min(12, students.length));

  const previewGroupCount = useMemo(() => {
    if (students.length === 0) return 0;
    if (remainderMode === 'distribute') {
      return Math.max(1, Math.floor(students.length / groupSize));
    }
    return Math.max(1, Math.ceil(students.length / groupSize));
  }, [students.length, groupSize, remainderMode]);

  const handleShuffleClick = () => {
    setSwapSelected(null);
    onRegenerateGroups();
    soundEngine.playSoftConfirm();
  };

  const handleSizeChange = (nextSize: number) => {
    const clamped = Math.max(2, Math.min(maxGroupSize, nextSize));
    setSwapSelected(null);
    onChangeGroupSize(clamped);
    onRegenerateGroups(clamped, remainderMode);
  };

  const handleRemainderChange = (nextMode: RemainderMode) => {
    setSwapSelected(null);
    onChangeRemainderMode(nextMode);
    onRegenerateGroups(groupSize, nextMode);
  };

  const handleGroupNameChange = (groupId: string, newName: string) => {
    onUpdateGroups(
      groups.map((g) => (g.id === groupId ? { ...g, name: newName } : g))
    );
  };

  const handleToggleLeader = (groupId: string, studentId: string) => {
    onUpdateGroups(
      groups.map((g) => {
        if (g.id !== groupId) return g;
        return {
          ...g,
          leaderId: g.leaderId === studentId ? null : studentId,
        };
      })
    );
  };

  const handleStudentClickForSwap = (groupId: string, student: Student) => {
    if (!swapSelected) {
      setSwapSelected({
        groupId,
        studentId: student.id,
        studentName: student.name,
      });
      return;
    }

    if (swapSelected.studentId === student.id) {
      setSwapSelected(null);
      return;
    }

    // Swap two students across groups (or within same group)
    const sourceGroup = groups.find((g) => g.id === swapSelected.groupId);
    const targetGroup = groups.find((g) => g.id === groupId);
    if (!sourceGroup || !targetGroup) {
      setSwapSelected(null);
      return;
    }

    const sourceStudent = sourceGroup.members.find((m) => m.id === swapSelected.studentId);
    const targetStudent = targetGroup.members.find((m) => m.id === student.id);
    if (!sourceStudent || !targetStudent) {
      setSwapSelected(null);
      return;
    }

    const updated = groups.map((g) => {
      if (g.id === sourceGroup.id && g.id === targetGroup.id) {
        const members = g.members.map((m) => {
          if (m.id === sourceStudent.id) return targetStudent;
          if (m.id === targetStudent.id) return sourceStudent;
          return m;
        });
        return { ...g, members };
      }

      if (g.id === sourceGroup.id) {
        const members = g.members.map((m) =>
          m.id === sourceStudent.id ? targetStudent : m
        );
        const leaderId =
          g.leaderId === sourceStudent.id ? targetStudent.id : g.leaderId;
        return { ...g, members, leaderId };
      }

      if (g.id === targetGroup.id) {
        const members = g.members.map((m) =>
          m.id === targetStudent.id ? sourceStudent : m
        );
        const leaderId =
          g.leaderId === targetStudent.id ? sourceStudent.id : g.leaderId;
        return { ...g, members, leaderId };
      }

      return g;
    });

    onUpdateGroups(updated);
    setSwapSelected(null);
    soundEngine.playSoftConfirm();
  };

  const handleDragStart = (fromGroupId: string, studentId: string) => {
    setDragInfo({ fromGroupId, studentId });
    setSwapSelected(null);
  };

  const handleDropOnGroup = (e: React.DragEvent, toGroupId: string) => {
    e.preventDefault();
    setDragOverGroupId(null);
    if (!dragInfo || dragInfo.fromGroupId === toGroupId) {
      setDragInfo(null);
      return;
    }

    const fromGroup = groups.find((g) => g.id === dragInfo.fromGroupId);
    const movingStudent = fromGroup?.members.find((m) => m.id === dragInfo.studentId);
    if (!movingStudent) {
      setDragInfo(null);
      return;
    }

    const updated = groups.map((g) => {
      if (g.id === dragInfo.fromGroupId) {
        const remaining = g.members.filter((m) => m.id !== movingStudent.id);
        const leaderId =
          g.leaderId === movingStudent.id ? (remaining[0]?.id ?? null) : g.leaderId;
        return { ...g, members: remaining, leaderId };
      }
      if (g.id === toGroupId) {
        const nextMembers = [...g.members, movingStudent];
        const leaderId = g.leaderId ?? movingStudent.id;
        return { ...g, members: nextMembers, leaderId };
      }
      return g;
    });

    onUpdateGroups(updated);
    setDragInfo(null);
    soundEngine.playSoftConfirm();
  };

  const handleExportExcel = () => {
    if (groups.length === 0) return;
    exportGroupsToExcel(groups, {
      activityTitle: activityTitle || '課堂分組名單',
      includeSeatNo: hasAnySeatNo,
    });
    setExportMessage(
      `已匯出「${activityTitle.trim() || '課堂分組名單'}_${new Date().toISOString().slice(0, 10)}.xlsx」（包含「成績紀錄表」與「組別總覽」兩個工作表）`
    );
    window.setTimeout(() => setExportMessage(null), 5000);
  };

  const handleExportCsv = () => {
    if (groups.length === 0) return;
    exportGroupsToCsv(groups, {
      activityTitle: activityTitle || '課堂分組名單',
      includeSeatNo: hasAnySeatNo,
    });
    setExportMessage(
      `已下載「${activityTitle.trim() || '課堂分組名單'}_${new Date().toISOString().slice(0, 10)}.csv」（UTF-8 編碼，可直接以 Excel 或 Google 試算表開啟）`
    );
    window.setTimeout(() => setExportMessage(null), 5000);
  };

  if (students.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-12 text-center max-w-2xl mx-auto mt-6">
        <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mx-auto mb-4">
          <Users className="w-7 h-7" aria-hidden="true" />
        </div>
        <h1 className="text-xl font-bold text-slate-900">請先建立學生名單</h1>
        <p className="mt-2 text-sm text-slate-600">
          匯入班級名單後即可設定每組人數、視覺化調整分組，並匯出 Excel 或 CSV 成績紀錄表。
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={onLoadSimulatedRoster}
            className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-sky-600 rounded-lg hover:bg-sky-700 transition-colors whitespace-nowrap"
          >
            <ListChecks className="w-4 h-4" aria-hidden="true" />
            載入模擬名單快速體驗
          </button>
          <button
            type="button"
            onClick={() => onNavigateTab('roster')}
            className="px-5 py-2.5 text-sm font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap"
          >
            前往匯入名單
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Title & Summary */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
            自動分組與成績表匯出
          </h1>
          <p className="mt-1.5 text-sm sm:text-base text-slate-600">
            自由設定每組人數並即時視覺化呈現，支援拖曳微調組員，匯出含評分欄位的 Excel 檔案。
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs sm:text-sm text-slate-500 tabular-nums shrink-0">
          <span>總計 {students.length} 位學生</span>
          <span aria-hidden="true">·</span>
          <span>每組 {groupSize} 人</span>
          <span aria-hidden="true">·</span>
          <span className="font-semibold text-slate-800">共 {groups.length || previewGroupCount} 組</span>
        </div>
      </div>

      {/* Export Confirmation Banner */}
      {exportMessage && (
        <div
          role="status"
          className="flex items-center gap-2.5 px-4 py-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm font-medium"
        >
          <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span>{exportMessage}</span>
        </div>
      )}

      {/* Control Toolbar */}
      <section className="bg-white border border-slate-200 rounded-xl p-5 space-y-5">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-end">
          {/* Group Size Stepper & Slider */}
          <div className="lg:col-span-4 space-y-2">
            <div className="flex items-center justify-between">
              <label htmlFor="group-size-range" className="text-sm font-semibold text-slate-800">
                每組人數設定
              </label>
              <span className="text-sm font-mono font-semibold tabular-nums text-sky-700">
                {groupSize} 人 / 組
              </span>
            </div>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => handleSizeChange(groupSize - 1)}
                disabled={groupSize <= 2}
                aria-label="減少每組人數"
                className="p-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-40 transition-colors shrink-0"
              >
                <Minus className="w-4 h-4" aria-hidden="true" />
              </button>

              <input
                id="group-size-range"
                type="range"
                min={2}
                max={maxGroupSize}
                value={groupSize}
                onChange={(e) => handleSizeChange(Number(e.target.value))}
                className="flex-1 accent-sky-600 cursor-pointer"
              />

              <button
                type="button"
                onClick={() => handleSizeChange(groupSize + 1)}
                disabled={groupSize >= maxGroupSize}
                aria-label="增加每組人數"
                className="p-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-40 transition-colors shrink-0"
              >
                <Plus className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>
          </div>

          {/* Remainder Distribution Mode */}
          <div className="lg:col-span-3 space-y-2">
            <span className="block text-sm font-semibold text-slate-800">
              無法整除時處理方式
            </span>
            <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-lg">
              <button
                type="button"
                onClick={() => handleRemainderChange('distribute')}
                className={`py-1.5 px-2.5 text-xs font-semibold rounded-md transition-all whitespace-nowrap ${
                  remainderMode === 'distribute'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                平均分配至各組
              </button>
              <button
                type="button"
                onClick={() => handleRemainderChange('separate')}
                className={`py-1.5 px-2.5 text-xs font-semibold rounded-md transition-all whitespace-nowrap ${
                  remainderMode === 'separate'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                剩餘自成一組
              </button>
            </div>
          </div>

          {/* Activity Title Input + Actions */}
          <div className="lg:col-span-5 flex flex-col sm:flex-row items-stretch sm:items-end gap-2.5">
            <div className="flex-1 min-w-0 space-y-1.5">
              <label htmlFor="activity-title-input" className="block text-xs font-semibold text-slate-600">
                匯出檔案名稱 / 課程活動名稱
              </label>
              <input
                id="activity-title-input"
                type="text"
                value={activityTitle}
                onChange={(e) => onChangeActivityTitle(e.target.value)}
                placeholder="例如：自然課實驗分組"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-sky-600 focus:outline-none focus:ring-2 focus:ring-sky-600/20"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleShuffleClick}
                className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 text-sm font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap"
              >
                <Shuffle className="w-4 h-4" aria-hidden="true" />
                重新洗牌
              </button>

              <button
                type="button"
                onClick={handleExportCsv}
                disabled={groups.length === 0}
                className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 text-sm font-semibold text-slate-800 bg-white border border-slate-300 hover:bg-slate-50 disabled:opacity-40 rounded-lg transition-colors whitespace-nowrap"
              >
                <Download className="w-4 h-4 text-sky-600" aria-hidden="true" />
                下載 CSV
              </button>

              <button
                type="button"
                onClick={handleExportExcel}
                disabled={groups.length === 0}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 rounded-lg transition-colors whitespace-nowrap"
              >
                <FileSpreadsheet className="w-4 h-4" aria-hidden="true" />
                匯出 Excel
              </button>
            </div>
          </div>
        </div>

        {/* Sub-toolbar: View Toggle & Interaction Instructions */}
        <div className="pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
            <button
              type="button"
              onClick={() => setViewMode('cards')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all whitespace-nowrap ${
                viewMode === 'cards'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              分組卡片視圖
            </button>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all whitespace-nowrap ${
                viewMode === 'table'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Excel 成績表預覽
            </button>
          </div>

          {swapSelected ? (
            <div className="flex items-center gap-3 text-xs sm:text-sm font-medium text-sky-800 bg-sky-50 border border-sky-200 px-3.5 py-1.5 rounded-lg">
              <ArrowLeftRight className="w-4 h-4 text-sky-600 shrink-0" aria-hidden="true" />
              <span>已選取「{swapSelected.studentName}」，請點擊另一位學生交換組別</span>
              <button
                type="button"
                onClick={() => setSwapSelected(null)}
                className="text-xs font-semibold text-slate-600 hover:text-slate-900 underline underline-offset-2 whitespace-nowrap"
              >
                取消
              </button>
            </div>
          ) : (
            <p className="text-xs text-slate-500">
              小提示：可拖曳學生跨組移動，或依序點擊兩位學生快速互換；點擊星號可設定組長。
            </p>
          )}
        </div>
      </section>

      {/* Main Display Area */}
      {viewMode === 'cards' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {groups.map((group) => {
            const topBarColor = GROUP_TOP_ACCENTS[group.colorIndex % GROUP_TOP_ACCENTS.length];
            const isDropTarget = dragOverGroupId === group.id && dragInfo?.fromGroupId !== group.id;

            return (
              <article
                key={group.id}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOverGroupId(group.id);
                }}
                onDragLeave={() => {
                  if (dragOverGroupId === group.id) setDragOverGroupId(null);
                }}
                onDrop={(e) => handleDropOnGroup(e, group.id)}
                className={`bg-white border rounded-xl overflow-hidden flex flex-col transition-all ${
                  isDropTarget
                    ? 'border-sky-500 ring-2 ring-sky-500/25 bg-sky-50/20'
                    : 'border-slate-200'
                }`}
              >
                {/* Crisp 3px Top Accent Bar */}
                <div className={`h-1 w-full ${topBarColor}`} aria-hidden="true" />

                {/* Group Header */}
                <div className="px-4 pt-4 pb-3 border-b border-slate-100 flex items-center justify-between gap-2">
                  <input
                    type="text"
                    value={group.name}
                    onChange={(e) => handleGroupNameChange(group.id, e.target.value)}
                    aria-label={`${group.name} 名稱`}
                    className="font-bold text-base text-slate-900 bg-transparent border border-transparent hover:border-slate-200 focus:border-sky-600 focus:bg-white rounded px-1.5 py-0.5 -ml-1.5 w-full min-w-0 focus:outline-none"
                  />
                  <span className="text-xs font-mono tabular-nums text-slate-500 whitespace-nowrap shrink-0">
                    {group.members.length} 人
                  </span>
                </div>

                {/* Member Rows */}
                <ul className="p-2.5 space-y-1 flex-1">
                  {group.members.length === 0 ? (
                    <li className="py-6 text-center text-xs text-slate-400">
                      可將學生拖曳至此組
                    </li>
                  ) : (
                    group.members.map((member) => {
                      const isLeader = group.leaderId === member.id;
                      const isSelectedForSwap = swapSelected?.studentId === member.id;

                      return (
                        <li
                          key={member.id}
                          draggable
                          onDragStart={() => handleDragStart(group.id, member.id)}
                          onDragEnd={() => {
                            setDragInfo(null);
                            setDragOverGroupId(null);
                          }}
                          className={`group/row flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg transition-colors cursor-grab active:cursor-grabbing ${
                            isSelectedForSwap
                              ? 'bg-sky-50 ring-1 ring-sky-500 text-sky-950'
                              : 'hover:bg-slate-50'
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => handleStudentClickForSwap(group.id, member)}
                            className="flex items-center gap-2 min-w-0 flex-1 text-left focus-visible:outline-none"
                            title="點擊與其他學生交換組別"
                          >
                            <GripVertical
                              className="w-3.5 h-3.5 text-slate-300 group-hover/row:text-slate-400 shrink-0"
                              aria-hidden="true"
                            />
                            {member.seatNo && (
                              <span className="font-mono text-xs tabular-nums text-slate-400 w-6 shrink-0">
                                {member.seatNo}
                              </span>
                            )}
                            <span className="text-sm font-medium text-slate-900 truncate">
                              {member.name}
                            </span>
                            {isLeader && (
                              <span className="text-xs font-semibold text-amber-700 shrink-0">
                                · 組長
                              </span>
                            )}
                          </button>

                          <button
                            type="button"
                            onClick={() => handleToggleLeader(group.id, member.id)}
                            aria-label={isLeader ? `取消 ${member.name} 的組長身分` : `指定 ${member.name} 為組長`}
                            title={isLeader ? '取消組長' : '設為組長'}
                            className={`p-1 rounded transition-colors shrink-0 ${
                              isLeader
                                ? 'text-amber-500 hover:bg-amber-50'
                                : 'text-slate-300 opacity-60 sm:opacity-0 group-hover/row:opacity-100 focus:opacity-100 hover:text-amber-500 hover:bg-slate-100'
                            }`}
                          >
                            <Star
                              className={`w-3.5 h-3.5 ${isLeader ? 'fill-amber-400' : ''}`}
                              aria-hidden="true"
                            />
                          </button>
                        </li>
                      );
                    })
                  )}
                </ul>
              </article>
            );
          })}
        </div>
      ) : (
        /* Excel Grading Table Preview */
        <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                {activityTitle.trim() || '課堂分組名單'} — 成績紀錄表預覽
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                匯出後的 .xlsx 檔案將保留以下評分欄位與額外的「組別總覽」工作表，方便直接列印或於 Excel 登錄成績。
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleExportCsv}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-800 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap"
              >
                <Download className="w-3.5 h-3.5 text-sky-600" aria-hidden="true" />
                下載 CSV
              </button>
              <button
                type="button"
                onClick={handleExportExcel}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors whitespace-nowrap"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" aria-hidden="true" />
                下載 Excel
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
                  <th className="py-3 px-4 whitespace-nowrap">組別</th>
                  <th className="py-3 px-4 whitespace-nowrap">角色</th>
                  {hasAnySeatNo && <th className="py-3 px-4 whitespace-nowrap">座號 / 編號</th>}
                  <th className="py-3 px-4 whitespace-nowrap">學生姓名</th>
                  <th className="py-3 px-4 whitespace-nowrap text-slate-400">課堂參與</th>
                  <th className="py-3 px-4 whitespace-nowrap text-slate-400">小組討論</th>
                  <th className="py-3 px-4 whitespace-nowrap text-slate-400">成果報告</th>
                  <th className="py-3 px-4 whitespace-nowrap text-slate-400">加分 / 互評</th>
                  <th className="py-3 px-4 whitespace-nowrap text-slate-400">總分</th>
                  <th className="py-3 px-4 whitespace-nowrap text-slate-400">教師評語</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {groups.flatMap((group) =>
                  group.members.map((member) => {
                    const isLeader = group.leaderId === member.id;
                    return (
                      <tr key={`${group.id}-${member.id}`} className="hover:bg-slate-50/70">
                        <td className="py-2.5 px-4 font-semibold text-slate-800 whitespace-nowrap">
                          {group.name}
                        </td>
                        <td className="py-2.5 px-4 whitespace-nowrap">
                          <span className={isLeader ? 'font-semibold text-amber-700' : 'text-slate-500'}>
                            {isLeader ? '組長' : '組員'}
                          </span>
                        </td>
                        {hasAnySeatNo && (
                          <td className="py-2.5 px-4 font-mono tabular-nums text-slate-500 whitespace-nowrap">
                            {member.seatNo || '—'}
                          </td>
                        )}
                        <td className="py-2.5 px-4 font-medium text-slate-900 whitespace-nowrap">
                          {member.name}
                        </td>
                        <td className="py-2.5 px-4 text-slate-300 font-mono">—</td>
                        <td className="py-2.5 px-4 text-slate-300 font-mono">—</td>
                        <td className="py-2.5 px-4 text-slate-300 font-mono">—</td>
                        <td className="py-2.5 px-4 text-slate-300 font-mono">—</td>
                        <td className="py-2.5 px-4 text-slate-300 font-mono">—</td>
                        <td className="py-2.5 px-4 text-slate-300">—</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
