import React, { useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Download,
  ListChecks,
  Plus,
  Search,
  Trash2,
  Upload,
  Users,
  X,
} from 'lucide-react';
import { ActiveTab, Student } from '../types/classroom';
import {
  downloadCsvTemplate,
  getDuplicateNameStats,
  parseStudentText,
  readRosterFile,
} from '../utils/parser';

interface RosterManagerProps {
  students: Student[];
  onReplaceStudents: (students: Student[], feedbackMsg?: string) => void;
  onAppendStudents: (students: Student[], feedbackMsg?: string) => void;
  onRemoveStudent: (id: string) => void;
  onRemoveDuplicates: () => void;
  onLoadSimulatedRoster: () => void;
  onClearStudents: () => void;
  onNavigateTab: (tab: ActiveTab) => void;
  importNotice: string | null;
}

type InputMode = 'paste' | 'csv';

export function RosterManager({
  students,
  onReplaceStudents,
  onAppendStudents,
  onRemoveStudent,
  onRemoveDuplicates,
  onLoadSimulatedRoster,
  onClearStudents,
  onNavigateTab,
  importNotice,
}: RosterManagerProps) {
  const [inputMode, setInputMode] = useState<InputMode>('paste');
  const [pasteText, setPasteText] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [quickSeatNo, setQuickSeatNo] = useState('');
  const [quickName, setQuickName] = useState('');
  const [confirmClear, setConfirmClear] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const duplicateStats = useMemo(() => getDuplicateNameStats(students), [students]);

  const filteredStudents = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return students;
    return students.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.seatNo && s.seatNo.toLowerCase().includes(q))
    );
  }, [students, searchQuery]);

  const handleApplyPaste = (mode: 'replace' | 'append') => {
    setLocalError(null);
    // Keep duplicates during import so teachers can inspect flagged items in preview and remove them with one click
    const result = parseStudentText(pasteText, false);
    if (result.students.length === 0) {
      setLocalError('找不到有效的學生姓名，請確認輸入內容是否為空白。');
      return;
    }

    const nextList =
      mode === 'replace' ? result.students : [...students, ...result.students];
    const nextDupStats = getDuplicateNameStats(nextList);
    const dupHint =
      nextDupStats.extraCount > 0
        ? `（偵測到 ${nextDupStats.extraCount} 筆重複姓名，已於右側名單標記）`
        : '';

    if (mode === 'replace') {
      onReplaceStudents(
        result.students,
        `已匯入 ${result.students.length} 筆學生資料${dupHint}`
      );
    } else {
      onAppendStudents(
        result.students,
        `已追加 ${result.students.length} 筆學生資料至現有名單${dupHint}`
      );
    }
    setPasteText('');
  };

  const handleProcessFile = async (file: File) => {
    setLocalError(null);
    const lowerName = file.name.toLowerCase();
    if (!lowerName.endsWith('.csv') && !lowerName.endsWith('.txt')) {
      setLocalError('請上傳 .csv 或 .txt 格式的名單檔案。');
      return;
    }

    try {
      const content = await readRosterFile(file);
      // Keep duplicates so they are clearly marked in the preview list
      const result = parseStudentText(content, false);
      if (result.students.length === 0) {
        setLocalError('檔案中未解析到任何學生姓名，請檢查檔案格式。');
        return;
      }

      const dupStats = getDuplicateNameStats(result.students);
      const dupHint =
        dupStats.extraCount > 0
          ? `（偵測到 ${dupStats.extraCount} 筆重複姓名，已於右側預覽標記）`
          : '';

      onReplaceStudents(
        result.students,
        `已從「${file.name}」匯入 ${result.students.length} 筆學生資料${dupHint}`
      );
    } catch {
      setLocalError('讀取檔案時發生錯誤，請重新選擇 CSV 檔案。');
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      void handleProcessFile(file);
    }
  };

  const handleQuickAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = quickName.trim();
    if (!trimmedName) return;

    const newStudent: Student = {
      id: `manual_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
      name: trimmedName,
      seatNo: quickSeatNo.trim() || undefined,
    };

    onAppendStudents([newStudent], `已加入學生「${trimmedName}」`);
    setQuickName('');
    setQuickSeatNo('');
  };

  return (
    <div className="space-y-6">
      {/* Page Title & Quick Actions */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
            班級學生名單來源
          </h1>
          <p className="mt-1.5 text-sm sm:text-base text-slate-600">
            上傳 CSV 檔案、直接貼上學生姓名，或使用模擬名單快速體驗抽籤與分組流程。
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => {
              setLocalError(null);
              onLoadSimulatedRoster();
            }}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-slate-800 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
          >
            <ListChecks className="w-4 h-4 text-sky-600" aria-hidden="true" />
            載入模擬名單
          </button>

          {students.length > 0 && (
            <>
              <button
                type="button"
                onClick={() => onNavigateTab('picker')}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-sky-700 bg-sky-50 border border-sky-200 rounded-lg hover:bg-sky-100 transition-colors whitespace-nowrap shrink-0"
              >
                前往隨機抽籤
                <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => onNavigateTab('groups')}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-sky-600 rounded-lg hover:bg-sky-700 transition-colors whitespace-nowrap shrink-0"
              >
                前往自動分組
                <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Feedback Notification Banner */}
      {(importNotice || localError) && (
        <div
          role="status"
          className={`flex items-center gap-2.5 px-4 py-3 rounded-lg border text-sm font-medium ${
            localError
              ? 'bg-rose-50 border-rose-200 text-rose-800'
              : 'bg-emerald-50 border-emerald-200 text-emerald-800'
          }`}
        >
          <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span>{localError || importNotice}</span>
        </div>
      )}

      {/* Two-Column Main Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Left Zone: Import Panel */}
        <section className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6 flex flex-col justify-between gap-6">
          <div className="space-y-5">
            {/* Segmented Mode Selector */}
            <div
              role="tablist"
              aria-label="名單匯入方式"
              className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-lg"
            >
              <button
                type="button"
                role="tab"
                aria-selected={inputMode === 'paste'}
                onClick={() => {
                  setInputMode('paste');
                  setLocalError(null);
                }}
                className={`py-2 px-3 text-sm font-semibold rounded-md transition-all whitespace-nowrap ${
                  inputMode === 'paste'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                直接貼上名單
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={inputMode === 'csv'}
                onClick={() => {
                  setInputMode('csv');
                  setLocalError(null);
                }}
                className={`py-2 px-3 text-sm font-semibold rounded-md transition-all whitespace-nowrap ${
                  inputMode === 'csv'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                上傳 CSV 檔案
              </button>
            </div>

            {inputMode === 'paste' ? (
              <div className="space-y-3">
                <label
                  htmlFor="paste-roster-textarea"
                  className="block text-sm font-semibold text-slate-800"
                >
                  貼上學生姓名（支援 Excel 複製貼上、換行或逗號分隔）
                </label>
                <textarea
                  id="paste-roster-textarea"
                  rows={10}
                  value={pasteText}
                  onChange={(e) => setPasteText(e.target.value)}
                  placeholder={`範例格式一（每行一位）：\n林宥辰\n陳品妍\n張宇軒\n\n範例格式二（座號與姓名）：\n01, 林宥辰\n02, 陳品妍`}
                  className="w-full rounded-lg border border-slate-300 bg-slate-50/50 px-3.5 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-sky-600 focus:outline-none focus:ring-2 focus:ring-sky-600/20 resize-y leading-relaxed"
                />

                <div className="flex flex-wrap items-center gap-2.5 pt-1">
                  <button
                    type="button"
                    onClick={() => handleApplyPaste('replace')}
                    disabled={!pasteText.trim()}
                    className="flex-1 py-2.5 px-4 text-sm font-semibold text-white bg-sky-600 rounded-lg hover:bg-sky-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
                  >
                    套用為新名單
                  </button>
                  {students.length > 0 && (
                    <button
                      type="button"
                      onClick={() => handleApplyPaste('append')}
                      disabled={!pasteText.trim()}
                      className="py-2.5 px-4 text-sm font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
                    >
                      追加至現有名單
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragging(true);
                  }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      fileInputRef.current?.click();
                    }
                  }}
                  className={`flex flex-col items-center justify-center text-center px-6 py-12 rounded-xl border-2 border-dashed cursor-pointer transition-colors ${
                    isDragging
                      ? 'border-sky-600 bg-sky-50'
                      : 'border-slate-300 bg-slate-50/70 hover:border-sky-500 hover:bg-sky-50/40'
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,.txt,text/csv,text/plain"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) void handleProcessFile(file);
                      e.target.value = '';
                    }}
                  />
                  <div className="w-12 h-12 rounded-full bg-white border border-slate-200 flex items-center justify-center mb-3 text-sky-600">
                    <Upload className="w-5 h-5" aria-hidden="true" />
                  </div>
                  <p className="text-sm font-semibold text-slate-900">
                    點擊選擇檔案，或將 CSV 拖曳至此處
                  </p>
                  <p className="mt-1.5 text-xs text-slate-500">
                    自動辨識 UTF-8 與 Big5 編碼 · 支援「座號, 姓名」或單欄姓名
                  </p>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <button
                    type="button"
                    onClick={downloadCsvTemplate}
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-sky-700 hover:text-sky-800 hover:underline underline-offset-4 whitespace-nowrap"
                  >
                    <Download className="w-4 h-4" aria-hidden="true" />
                    下載 CSV 範本檔案
                  </button>
                  <span className="text-xs text-slate-500">適用 Excel 另存 CSV</span>
                </div>
              </div>
            )}
          </div>

          {/* Bottom Quick-Start Simulated Roster Guide */}
          <div className="pt-4 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-slate-500">
              第一次使用？可載入 28 位模擬學生名單立即體驗全部功能。
            </p>
            <button
              type="button"
              onClick={() => {
                setLocalError(null);
                onLoadSimulatedRoster();
              }}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-sky-700 hover:text-sky-800 hover:underline underline-offset-4 transition-colors whitespace-nowrap"
            >
              <ListChecks className="w-4 h-4" aria-hidden="true" />
              一鍵套用模擬名單
            </button>
          </div>
        </section>

        {/* Right Zone: Active Roster Preview & Duplicate Detection */}
        <section className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6 flex flex-col">
          {/* Header & Clean Metadata */}
          <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-200">
            <div>
              <h2 className="text-lg font-bold text-slate-900">名單預覽與管理</h2>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500 tabular-nums">
                <span>共 {students.length} 筆資料</span>
                {duplicateStats.extraCount > 0 && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="font-semibold text-amber-700">
                      含 {duplicateStats.extraCount} 筆重複姓名
                    </span>
                  </>
                )}
                <span aria-hidden="true">·</span>
                <span>自動儲存於此裝置</span>
              </div>
            </div>

            {students.length > 0 && (
              <div className="flex items-center gap-2">
                {confirmClear ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-rose-700">確定清空全部名單？</span>
                    <button
                      type="button"
                      onClick={() => {
                        onClearStudents();
                        setConfirmClear(false);
                      }}
                      className="px-2.5 py-1.5 text-xs font-semibold text-white bg-rose-600 rounded-md hover:bg-rose-700 whitespace-nowrap"
                    >
                      確認清空
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmClear(false)}
                      className="px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 whitespace-nowrap"
                    >
                      取消
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmClear(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-rose-700 hover:bg-rose-50 rounded-md transition-colors whitespace-nowrap"
                  >
                    <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                    清空名單
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Duplicate Alert Bar with One-Click Removal Button */}
          {duplicateStats.extraCount > 0 && (
            <div
              role="alert"
              className="mt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3 rounded-lg bg-amber-50 border border-amber-200"
            >
              <div className="flex items-start sm:items-center gap-2.5 text-sm text-amber-900">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5 sm:mt-0" aria-hidden="true" />
                <span>
                  偵測到 <strong className="font-semibold tabular-nums">{duplicateStats.duplicateNames.size}</strong> 個重複的學生姓名（共多出 <strong className="font-semibold tabular-nums">{duplicateStats.extraCount}</strong> 筆），已在下方名單標記。
                </span>
              </div>
              <button
                type="button"
                onClick={onRemoveDuplicates}
                className="px-3.5 py-1.5 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-md transition-colors whitespace-nowrap shrink-0 self-start sm:self-auto"
              >
                一次性移除重複姓名
              </button>
            </div>
          )}

          {/* Quick Add & Search Bar */}
          <div className="py-4 flex flex-col sm:flex-row gap-2.5 border-b border-slate-100">
            <form onSubmit={handleQuickAdd} className="flex-1 flex items-center gap-2">
              <input
                type="text"
                value={quickSeatNo}
                onChange={(e) => setQuickSeatNo(e.target.value)}
                placeholder="座號（選填）"
                aria-label="座號（選填）"
                className="w-24 sm:w-28 rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono tabular-nums text-slate-900 placeholder:text-slate-400 focus:border-sky-600 focus:outline-none focus:ring-2 focus:ring-sky-600/20"
              />
              <input
                type="text"
                value={quickName}
                onChange={(e) => setQuickName(e.target.value)}
                placeholder="手動新增學生姓名..."
                aria-label="手動新增學生姓名"
                className="flex-1 min-w-0 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-sky-600 focus:outline-none focus:ring-2 focus:ring-sky-600/20"
              />
              <button
                type="submit"
                disabled={!quickName.trim()}
                className="inline-flex items-center gap-1 px-3.5 py-2 text-sm font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                <Plus className="w-4 h-4" aria-hidden="true" />
                新增
              </button>
            </form>

            {students.length > 6 && (
              <div className="relative sm:w-44 shrink-0">
                <Search
                  className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                  aria-hidden="true"
                />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="搜尋姓名"
                  aria-label="搜尋學生姓名"
                  className="w-full rounded-lg border border-slate-300 pl-9 pr-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-sky-600 focus:outline-none focus:ring-2 focus:ring-sky-600/20"
                />
              </div>
            )}
          </div>

          {/* Roster Table Body */}
          {students.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center py-14 px-4">
              <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-3">
                <Users className="w-6 h-6" aria-hidden="true" />
              </div>
              <p className="text-base font-semibold text-slate-800">尚未匯入學生名單</p>
              <p className="mt-1 text-sm text-slate-500 max-w-sm">
                請於左側貼上姓名或上傳 CSV 檔案，也可以直接載入模擬名單，快速了解隨機抽籤與自動分組的操作方式。
              </p>
              <button
                type="button"
                onClick={() => {
                  setLocalError(null);
                  onLoadSimulatedRoster();
                }}
                className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-sky-600 rounded-lg hover:bg-sky-700 transition-colors"
              >
                <ListChecks className="w-4 h-4" aria-hidden="true" />
                載入模擬名單（28 人）
              </button>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto max-h-[420px] -mx-2 px-2 mt-2">
              {filteredStudents.length === 0 ? (
                <p className="py-10 text-center text-sm text-slate-500">
                  找不到符合「{searchQuery}」的學生。
                </p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1">
                  {filteredStudents.map((student, idx) => {
                    const normalizedKey = student.name.trim().toLowerCase();
                    const isDuplicate = duplicateStats.duplicateNames.has(normalizedKey);
                    const occurrenceCount = duplicateStats.nameCounts.get(normalizedKey) ?? 1;

                    return (
                      <div
                        key={student.id}
                        className={`group flex items-center justify-between gap-2 py-2.5 px-3 rounded-md border-b transition-colors ${
                          isDuplicate
                            ? 'bg-amber-50/80 border-amber-200/80'
                            : 'border-slate-100 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="w-8 text-xs font-mono tabular-nums text-slate-400 shrink-0">
                            {student.seatNo || String(idx + 1).padStart(2, '0')}
                          </span>
                          <span className="text-sm font-medium text-slate-900 truncate">
                            {student.name}
                          </span>
                          {isDuplicate && (
                            <span
                              className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 whitespace-nowrap shrink-0"
                              title={`此姓名共出現 ${occurrenceCount} 次`}
                            >
                              <AlertTriangle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                              重複 ({occurrenceCount})
                            </span>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => onRemoveStudent(student.id)}
                          aria-label={`移除 ${student.name}`}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md opacity-70 sm:opacity-0 group-hover:opacity-100 focus:opacity-100 transition-all shrink-0"
                        >
                          <X className="w-3.5 h-3.5" aria-hidden="true" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
