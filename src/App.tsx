import React, { useCallback, useEffect, useRef, useState } from 'react';
import { GroupGenerator } from './components/GroupGenerator';
import { RandomPicker } from './components/RandomPicker';
import { RosterManager } from './components/RosterManager';
import { TopBar } from './components/TopBar';
import { ActiveTab, DrawRecord, RemainderMode, Student, StudentGroup } from './types/classroom';
import { buildStudentGroups } from './utils/grouping';
import {
  createSampleStudents,
  getDuplicateNameStats,
  parseStudentText,
  readRosterFile,
  removeDuplicateStudentsByName,
} from './utils/parser';

const STORAGE_KEYS = {
  students: 'classroom_tool_students_v1',
  allowRepeat: 'classroom_tool_allow_repeat_v1',
  groupSize: 'classroom_tool_group_size_v1',
  remainderMode: 'classroom_tool_remainder_mode_v1',
  activityTitle: 'classroom_tool_activity_title_v1',
};

function loadInitialStudents(): Student[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.students);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
    return [];
  } catch {
    return [];
  }
}

function formatCurrentTime(): string {
  const now = new Date();
  return now.toLocaleTimeString('zh-TW', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('roster');
  const [students, setStudents] = useState<Student[]>(loadInitialStudents);
  const [importNotice, setImportNotice] = useState<string | null>(null);

  // Feature 1: Random Picker State
  const [allowRepeat, setAllowRepeat] = useState<boolean>(() => {
    try {
      return localStorage.getItem(STORAGE_KEYS.allowRepeat) === 'true';
    } catch {
      return false;
    }
  });
  const [drawnIds, setDrawnIds] = useState<string[]>([]);
  const [drawHistory, setDrawHistory] = useState<DrawRecord[]>([]);

  // Feature 2: Auto Grouping State
  const [groupSize, setGroupSize] = useState<number>(() => {
    try {
      const saved = Number(localStorage.getItem(STORAGE_KEYS.groupSize));
      return Number.isFinite(saved) && saved >= 2 && saved <= 12 ? saved : 4;
    } catch {
      return 4;
    }
  });
  const [remainderMode, setRemainderMode] = useState<RemainderMode>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.remainderMode);
      return saved === 'separate' ? 'separate' : 'distribute';
    } catch {
      return 'distribute';
    }
  });
  const [activityTitle, setActivityTitle] = useState<string>(() => {
    try {
      return localStorage.getItem(STORAGE_KEYS.activityTitle) || '課堂分組活動';
    } catch {
      return '課堂分組活動';
    }
  });
  const [groups, setGroups] = useState<StudentGroup[]>(() => {
    const initial = loadInitialStudents();
    return initial.length > 0 ? buildStudentGroups(initial, 4, 'distribute') : [];
  });

  const quickCsvInputRef = useRef<HTMLInputElement>(null);

  // Persist roster and preferences
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.students, JSON.stringify(students));
    } catch {
      // Ignore storage quota errors
    }
  }, [students]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.allowRepeat, String(allowRepeat));
    } catch {
      // Ignore
    }
  }, [allowRepeat]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.groupSize, String(groupSize));
    } catch {
      // Ignore
    }
  }, [groupSize]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.remainderMode, remainderMode);
    } catch {
      // Ignore
    }
  }, [remainderMode]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.activityTitle, activityTitle);
    } catch {
      // Ignore
    }
  }, [activityTitle]);

  const showNotice = useCallback((msg: string) => {
    setImportNotice(msg);
  }, []);

  const handleReplaceStudents = useCallback(
    (nextStudents: Student[], feedbackMsg?: string) => {
      setStudents(nextStudents);
      setDrawnIds([]);
      setDrawHistory([]);
      setGroups(buildStudentGroups(nextStudents, groupSize, remainderMode));
      if (feedbackMsg) showNotice(feedbackMsg);
    },
    [groupSize, remainderMode, showNotice]
  );

  const handleAppendStudents = useCallback(
    (incoming: Student[], feedbackMsg?: string) => {
      setStudents((prev) => {
        const merged = [...prev, ...incoming];
        setGroups(buildStudentGroups(merged, groupSize, remainderMode));
        return merged;
      });
      if (feedbackMsg) showNotice(feedbackMsg);
    },
    [groupSize, remainderMode, showNotice]
  );

  const handleRemoveStudent = useCallback(
    (id: string) => {
      setStudents((prev) => {
        const next = prev.filter((s) => s.id !== id);
        setGroups(buildStudentGroups(next, groupSize, remainderMode));
        return next;
      });
      setDrawnIds((prev) => prev.filter((drawnId) => drawnId !== id));
    },
    [groupSize, remainderMode]
  );

  const handleRemoveDuplicates = useCallback(() => {
    setStudents((prev) => {
      const { uniqueStudents, removedCount } = removeDuplicateStudentsByName(prev);
      if (removedCount === 0) return prev;
      const keepIds = new Set(uniqueStudents.map((s) => s.id));
      setDrawnIds((prevDrawn) => prevDrawn.filter((id) => keepIds.has(id)));
      setGroups(buildStudentGroups(uniqueStudents, groupSize, remainderMode));
      showNotice(`已一次性移除 ${removedCount} 筆重複姓名，目前保留 ${uniqueStudents.length} 位不重複學生。`);
      return uniqueStudents;
    });
  }, [groupSize, remainderMode, showNotice]);

  const handleLoadSimulatedRoster = useCallback(() => {
    const sample = createSampleStudents();
    setStudents(sample);
    setDrawnIds([]);
    setDrawHistory([]);
    setGroups(buildStudentGroups(sample, groupSize, remainderMode));
    showNotice(`已載入 ${sample.length} 位模擬學生名單！您現在可以直接切換至「隨機抽籤」或「自動分組」體驗所有功能。`);
  }, [groupSize, remainderMode, showNotice]);

  const handleClearStudents = useCallback(() => {
    setStudents([]);
    setDrawnIds([]);
    setDrawHistory([]);
    setGroups([]);
    setImportNotice(null);
  }, []);

  const handleRecordDraw = useCallback(
    (student: Student) => {
      if (!allowRepeat) {
        setDrawnIds((prev) => (prev.includes(student.id) ? prev : [...prev, student.id]));
      }
      setDrawHistory((prev) => [
        {
          id: `draw_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
          student,
          order: prev.length + 1,
          timestamp: formatCurrentTime(),
        },
        ...prev,
      ]);
    },
    [allowRepeat]
  );

  const handleResetPool = useCallback(() => {
    setDrawnIds([]);
  }, []);

  const handleClearHistory = useCallback(() => {
    setDrawHistory([]);
  }, []);

  const handleRegenerateGroups = useCallback(
    (nextSize?: number, nextMode?: RemainderMode) => {
      const targetSize = nextSize ?? groupSize;
      const targetMode = nextMode ?? remainderMode;
      setGroups(buildStudentGroups(students, targetSize, targetMode));
    },
    [students, groupSize, remainderMode]
  );

  const handleQuickCsvUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    try {
      const text = await readRosterFile(file);
      const parsed = parseStudentText(text, false);
      if (parsed.students.length > 0) {
        const dupStats = getDuplicateNameStats(parsed.students);
        const dupNote =
          dupStats.extraCount > 0
            ? `（偵測到 ${dupStats.extraCount} 筆重複姓名，已於預覽名單標記）`
            : '';
        handleReplaceStudents(
          parsed.students,
          `已從「${file.name}」匯入 ${parsed.students.length} 筆學生資料${dupNote}`
        );
        setActiveTab('roster');
      }
    } catch {
      setActiveTab('roster');
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F8FAFC] text-slate-900">
      {/* Hidden Quick CSV Input for TopBar CTA */}
      <input
        ref={quickCsvInputRef}
        type="file"
        accept=".csv,.txt,text/csv,text/plain"
        className="hidden"
        onChange={handleQuickCsvUpload}
      />

      <TopBar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        onQuickImportCsv={() => quickCsvInputRef.current?.click()}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'roster' && (
          <RosterManager
            students={students}
            onReplaceStudents={handleReplaceStudents}
            onAppendStudents={handleAppendStudents}
            onRemoveStudent={handleRemoveStudent}
            onRemoveDuplicates={handleRemoveDuplicates}
            onLoadSimulatedRoster={handleLoadSimulatedRoster}
            onClearStudents={handleClearStudents}
            onNavigateTab={setActiveTab}
            importNotice={importNotice}
          />
        )}

        {activeTab === 'picker' && (
          <RandomPicker
            students={students}
            allowRepeat={allowRepeat}
            onChangeAllowRepeat={setAllowRepeat}
            drawnIds={drawnIds}
            history={drawHistory}
            onRecordDraw={handleRecordDraw}
            onResetPool={handleResetPool}
            onClearHistory={handleClearHistory}
            onLoadSimulatedRoster={handleLoadSimulatedRoster}
            onNavigateTab={setActiveTab}
          />
        )}

        {activeTab === 'groups' && (
          <GroupGenerator
            students={students}
            groups={groups}
            groupSize={groupSize}
            remainderMode={remainderMode}
            activityTitle={activityTitle}
            onChangeGroupSize={setGroupSize}
            onChangeRemainderMode={setRemainderMode}
            onChangeActivityTitle={setActivityTitle}
            onRegenerateGroups={handleRegenerateGroups}
            onUpdateGroups={setGroups}
            onLoadSimulatedRoster={handleLoadSimulatedRoster}
            onNavigateTab={setActiveTab}
          />
        )}
      </main>

      <footer className="border-t border-slate-200 bg-white mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500">
          <span>點名分組室 · 所有學生名單僅儲存於您的瀏覽器本機，不會上傳至任何伺服器</span>
          <span className="tabular-nums">目前名單：{students.length} 位學生</span>
        </div>
      </footer>
    </div>
  );
}
