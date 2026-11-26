import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ListChecks,
  Maximize2,
  Minimize2,
  Play,
  RotateCcw,
  Trash2,
  Users,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { ActiveTab, DrawRecord, Student } from '../types/classroom';
import { soundEngine } from '../utils/sound';

interface RandomPickerProps {
  students: Student[];
  allowRepeat: boolean;
  onChangeAllowRepeat: (allow: boolean) => void;
  drawnIds: string[];
  history: DrawRecord[];
  onRecordDraw: (student: Student) => void;
  onResetPool: () => void;
  onClearHistory: () => void;
  onLoadSimulatedRoster: () => void;
  onNavigateTab: (tab: ActiveTab) => void;
}

interface ConfettiParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  rotation: number;
  rotationSpeed: number;
  alpha: number;
}

const CONFETTI_COLORS = ['#0284C7', '#0EA5E9', '#D97706', '#059669', '#4F46E5', '#F59E0B'];

export function RandomPicker({
  students,
  allowRepeat,
  onChangeAllowRepeat,
  drawnIds,
  history,
  onRecordDraw,
  onResetPool,
  onClearHistory,
  onLoadSimulatedRoster,
  onNavigateTab,
}: RandomPickerProps) {
  const [isRolling, setIsRolling] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [displayTriplet, setDisplayTriplet] = useState<[Student | null, Student | null, Student | null]>([
    null,
    null,
    null,
  ]);
  const [selectedWinner, setSelectedWinner] = useState<Student | null>(null);
  const [revealCounter, setRevealCounter] = useState(0);

  const timeoutRef = useRef<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameRef = useRef<number | null>(null);

  const drawnIdSet = useMemo(() => new Set(drawnIds), [drawnIds]);

  const availablePool = useMemo(() => {
    if (allowRepeat) return students;
    return students.filter((s) => !drawnIdSet.has(s.id));
  }, [students, allowRepeat, drawnIdSet]);

  const progressPercent = useMemo(() => {
    if (students.length === 0) return 0;
    const drawnCount = students.length - availablePool.length;
    return Math.round((drawnCount / students.length) * 100);
  }, [students.length, availablePool.length]);

  useEffect(() => {
    soundEngine.setEnabled(soundEnabled);
  }, [soundEnabled]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
      if (animFrameRef.current) window.cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  const launchConfetti = useCallback(() => {
    if (typeof window === 'undefined') return;
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const particles: ConfettiParticle[] = [];
    const total = 56;
    const cx = rect.width / 2;
    const cy = rect.height * 0.45;

    for (let i = 0; i < total; i++) {
      const angle = (Math.PI * 2 * i) / total + (Math.random() - 0.5) * 0.45;
      const speed = 3.2 + Math.random() * 6.5;
      particles.push({
        x: cx,
        y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 3.2,
        size: 5 + Math.random() * 5,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 0.25,
        alpha: 1,
      });
    }

    if (animFrameRef.current) window.cancelAnimationFrame(animFrameRef.current);

    const tick = () => {
      ctx.clearRect(0, 0, rect.width, rect.height);
      let alive = false;

      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.22; // gravity
        p.vx *= 0.985;
        p.rotation += p.rotationSpeed;
        p.alpha -= 0.015;

        if (p.alpha > 0.02) {
          alive = true;
          ctx.save();
          ctx.globalAlpha = Math.max(0, p.alpha);
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rotation);
          ctx.fillStyle = p.color;
          ctx.fillRect(-p.size / 2, -p.size * 0.35, p.size, p.size * 0.7);
          ctx.restore();
        }
      }

      if (alive) {
        animFrameRef.current = window.requestAnimationFrame(tick);
      } else {
        ctx.clearRect(0, 0, rect.width, rect.height);
      }
    };

    animFrameRef.current = window.requestAnimationFrame(tick);
  }, []);

  const startDraw = useCallback(() => {
    if (isRolling || availablePool.length === 0) return;

    // Pick true random winner upfront using crypto-grade randomness when available
    let winnerIndex = Math.floor(Math.random() * availablePool.length);
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      const arr = new Uint32Array(1);
      crypto.getRandomValues(arr);
      winnerIndex = arr[0] % availablePool.length;
    }
    const winner = availablePool[winnerIndex];

    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReduced || availablePool.length === 1) {
      setDisplayTriplet([null, winner, null]);
      setSelectedWinner(winner);
      setRevealCounter((c) => c + 1);
      soundEngine.playRevealFanfare();
      onRecordDraw(winner);
      return;
    }

    setIsRolling(true);
    setSelectedWinner(null);

    // Visual reel pool uses all students for richer drum visuals, ending strictly on winner
    const reelSource = availablePool.length >= 4 ? availablePool : students;
    const totalSteps = 26;
    let step = 0;

    const getRandomFromReel = (excludeId?: string): Student => {
      if (reelSource.length <= 1) return reelSource[0];
      let candidate = reelSource[Math.floor(Math.random() * reelSource.length)];
      let guard = 0;
      while (candidate.id === excludeId && guard < 8) {
        candidate = reelSource[Math.floor(Math.random() * reelSource.length)];
        guard++;
      }
      return candidate;
    };

    let currentCenter = getRandomFromReel();

    const runStep = () => {
      step++;
      const progress = step / totalSteps;

      if (step >= totalSteps) {
        const prev = getRandomFromReel(winner.id);
        const next = getRandomFromReel(winner.id);
        setDisplayTriplet([prev, winner, next]);
        setSelectedWinner(winner);
        setRevealCounter((c) => c + 1);
        setIsRolling(false);
        soundEngine.playRevealFanfare();
        launchConfetti();
        onRecordDraw(winner);
        return;
      }

      const prev = currentCenter;
      const nextCenter = getRandomFromReel(currentCenter.id);
      const upcoming = getRandomFromReel(nextCenter.id);
      currentCenter = nextCenter;

      setDisplayTriplet([prev, nextCenter, upcoming]);
      soundEngine.playTick(progress);

      // Smooth quartic deceleration: starts ~42ms, slows gracefully to ~250ms
      const delay = Math.round(42 + Math.pow(progress, 3.1) * 230);
      timeoutRef.current = window.setTimeout(runStep, delay);
    };

    runStep();
  }, [isRolling, availablePool, students, launchConfetti, onRecordDraw]);

  // Keyboard shortcut: Spacebar to draw (when not focused in an input/textarea)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code !== 'Space') return;
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'BUTTON' ||
          target.isContentEditable)
      ) {
        return;
      }
      e.preventDefault();
      startDraw();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [startDraw]);

  // Empty roster guard
  if (students.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-12 text-center max-w-2xl mx-auto mt-6">
        <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mx-auto mb-4">
          <Users className="w-7 h-7" aria-hidden="true" />
        </div>
        <h1 className="text-xl font-bold text-slate-900">請先建立學生名單</h1>
        <p className="mt-2 text-sm text-slate-600">
          目前尚未匯入任何學生姓名。您可以前往匯入真實班級名單，或直接載入模擬名單立即體驗抽籤效果。
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

  const centerStudent = displayTriplet[1] || selectedWinner;
  const isPoolExhausted = !allowRepeat && availablePool.length === 0;

  return (
    <div className="space-y-6">
      {/* Section Header */}
      {!isFullscreen && (
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
              課堂隨機抽籤點名
            </h1>
            <p className="mt-1.5 text-sm sm:text-base text-slate-600">
              搭配滾動動畫與音效公平抽出學生，適合投影於教室大螢幕進行互動問答。
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500 tabular-nums">
            <span>總人數 {students.length} 人</span>
            <span aria-hidden="true">·</span>
            <span>{allowRepeat ? '可重複抽取' : `本輪剩餘 ${availablePool.length} 人`}</span>
          </div>
        </div>
      )}

      {/* Two-Zone Sandbox Layout */}
      <div
        className={
          isFullscreen
            ? 'fixed inset-0 z-50 bg-[#F8FAFC] p-6 sm:p-10 flex flex-col'
            : 'grid grid-cols-1 lg:grid-cols-12 gap-6 items-start'
        }
      >
        {/* Left / Main Zone: Interactive Draw Stage */}
        <section
          className={`${
            isFullscreen
              ? 'flex-1 flex flex-col justify-between max-w-5xl w-full mx-auto'
              : 'lg:col-span-8'
          } relative bg-white border border-slate-200 rounded-xl p-6 sm:p-8 overflow-hidden flex flex-col justify-between min-h-[470px]`}
        >
          {/* Confetti Canvas Overlay */}
          <canvas
            ref={canvasRef}
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 w-full h-full z-20"
          />

          {/* Stage Top Toolbar */}
          <div className="relative z-10 flex items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div className="flex items-center gap-2 text-xs sm:text-sm text-slate-500 tabular-nums">
              <span className="font-semibold text-slate-800">
                {allowRepeat ? '可重複模式' : '不重複模式'}
              </span>
              <span aria-hidden="true">·</span>
              <span>
                {allowRepeat
                  ? `全班 ${students.length} 位參與`
                  : `剩餘 ${availablePool.length} / ${students.length} 位`}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setSoundEnabled((v) => !v)}
                aria-label={soundEnabled ? '關閉抽籤音效' : '開啟抽籤音效'}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                {soundEnabled ? (
                  <>
                    <Volume2 className="w-4 h-4 text-sky-600" aria-hidden="true" />
                    <span>音效開啟</span>
                  </>
                ) : (
                  <>
                    <VolumeX className="w-4 h-4 text-slate-400" aria-hidden="true" />
                    <span>已靜音</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => setIsFullscreen((v) => !v)}
                aria-label={isFullscreen ? '退出大字投影模式' : '切換大字投影模式'}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                {isFullscreen ? (
                  <>
                    <Minimize2 className="w-4 h-4" aria-hidden="true" />
                    <span>離開投影</span>
                  </>
                ) : (
                  <>
                    <Maximize2 className="w-4 h-4" aria-hidden="true" />
                    <span>大字投影</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Center Roulette Reel Display */}
          <div className="relative z-10 flex-1 flex flex-col items-center justify-center py-8 sm:py-10">
            {isPoolExhausted && !isRolling ? (
              <div className="text-center space-y-4">
                <p className="text-sm font-semibold text-amber-700">
                  本輪所有學生皆已抽出完畢
                </p>
                <p className="text-2xl sm:text-3xl font-bold text-slate-900">
                  全班 {students.length} 位同學已完成一輪點名
                </p>
                <button
                  type="button"
                  onClick={() => {
                    onResetPool();
                    setSelectedWinner(null);
                    setDisplayTriplet([null, null, null]);
                  }}
                  className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-sky-600 rounded-lg hover:bg-sky-700 transition-colors"
                >
                  <RotateCcw className="w-4 h-4" aria-hidden="true" />
                  重置名單，開始新一輪
                </button>
              </div>
            ) : (
              <div className="w-full max-w-xl mx-auto flex flex-col items-center">
                {/* Ghost Top Slot */}
                <div
                  aria-hidden="true"
                  className="h-9 flex items-center justify-center text-lg sm:text-xl font-medium text-slate-300 select-none overflow-hidden"
                >
                  {isRolling && displayTriplet[0] ? displayTriplet[0].name : ''}
                </div>

                {/* Primary Spotlight Frame */}
                <div
                  className={`w-full my-2 px-6 py-8 sm:py-10 rounded-2xl border text-center transition-colors ${
                    isRolling
                      ? 'bg-sky-50/70 border-sky-300'
                      : selectedWinner
                        ? 'bg-slate-50 border-sky-600 shadow-sm'
                        : 'bg-slate-50/70 border-slate-200'
                  }`}
                >
                  {centerStudent ? (
                    <div
                      key={isRolling ? 'rolling' : `winner-${revealCounter}`}
                      className={!isRolling && selectedWinner ? 'animate-winner-pop' : ''}
                    >
                      <p className="text-xs sm:text-sm font-mono tabular-nums text-slate-500 min-h-[1.25rem]">
                        {centerStudent.seatNo ? `座號 ${centerStudent.seatNo}` : '幸運抽中'}
                      </p>
                      <div
                        className={`mt-2 font-extrabold tracking-tight text-slate-900 leading-tight ${
                          isFullscreen
                            ? 'text-6xl sm:text-8xl'
                            : 'text-5xl sm:text-6xl'
                        }`}
                      >
                        {centerStudent.name}
                      </div>
                      <p className="mt-3 text-xs sm:text-sm font-medium min-h-[1.25rem] text-sky-700">
                        {isRolling
                          ? '正在隨機抽選中...'
                          : selectedWinner
                            ? `第 ${history.length} 位抽出`
                            : ''}
                      </p>
                    </div>
                  ) : (
                    <div className="py-4">
                      <p className="text-sm text-slate-400">準備就緒</p>
                      <div className="mt-2 text-3xl sm:text-4xl font-bold text-slate-300">
                        點擊下方按鈕開始抽籤
                      </div>
                      <p className="mt-3 text-xs text-slate-400">
                        可按下鍵盤空白鍵（Space）快速啟動
                      </p>
                    </div>
                  )}
                </div>

                {/* Ghost Bottom Slot */}
                <div
                  aria-hidden="true"
                  className="h-9 flex items-center justify-center text-lg sm:text-xl font-medium text-slate-300 select-none overflow-hidden"
                >
                  {isRolling && displayTriplet[2] ? displayTriplet[2].name : ''}
                </div>
              </div>
            )}
          </div>

          {/* Primary Stage Action Bar */}
          <div className="relative z-10 pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
            <span className="text-xs text-slate-500 hidden sm:inline">
              快捷鍵：按空白鍵（Space）抽下一位
            </span>

            <div className="flex items-center gap-3 w-full sm:w-auto justify-center sm:justify-end">
              {!allowRepeat && drawnIds.length > 0 && !isPoolExhausted && (
                <button
                  type="button"
                  disabled={isRolling}
                  onClick={() => {
                    onResetPool();
                    setSelectedWinner(null);
                    setDisplayTriplet([null, null, null]);
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-3 text-sm font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-40 transition-colors whitespace-nowrap"
                >
                  <RotateCcw className="w-4 h-4" aria-hidden="true" />
                  重置本輪
                </button>
              )}

              <button
                type="button"
                disabled={isRolling || isPoolExhausted}
                onClick={startDraw}
                className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-8 py-3 text-base font-bold text-white bg-sky-600 rounded-lg hover:bg-sky-700 active:scale-[0.98] disabled:opacity-45 disabled:cursor-not-allowed transition-all whitespace-nowrap min-w-[180px]"
              >
                <Play className="w-4 h-4 fill-current" aria-hidden="true" />
                {isRolling ? '抽選中...' : selectedWinner ? '再抽下一位' : '開始隨機抽籤'}
              </button>
            </div>
          </div>
        </section>

        {/* Right Zone: Control & History Deck (hidden in fullscreen projection) */}
        {!isFullscreen && (
          <aside className="lg:col-span-4 space-y-6">
            {/* Draw Mode Control Card */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
              <div>
                <h2 className="text-base font-bold text-slate-900">抽籤規則設定</h2>
                <p className="mt-1 text-xs text-slate-500">
                  決定同一位學生是否可於本輪重複被抽中。
                </p>
              </div>

              <div
                role="radiogroup"
                aria-label="是否允許重複抽取"
                className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-lg"
              >
                <button
                  type="button"
                  role="radio"
                  aria-checked={!allowRepeat}
                  disabled={isRolling}
                  onClick={() => onChangeAllowRepeat(false)}
                  className={`py-2 px-3 text-sm font-semibold rounded-md transition-all whitespace-nowrap ${
                    !allowRepeat
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  不重複抽取
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={allowRepeat}
                  disabled={isRolling}
                  onClick={() => onChangeAllowRepeat(true)}
                  className={`py-2 px-3 text-sm font-semibold rounded-md transition-all whitespace-nowrap ${
                    allowRepeat
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  可重複抽取
                </button>
              </div>

              {!allowRepeat && (
                <div className="space-y-2 pt-1">
                  <div className="flex items-center justify-between text-xs text-slate-600 tabular-nums">
                    <span>本輪點名進度</span>
                    <span className="font-mono font-semibold text-slate-900">
                      已抽 {students.length - availablePool.length} / {students.length} 人（{progressPercent}%）
                    </span>
                  </div>
                  <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-sky-600 transition-all duration-300"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Draw History Card */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col max-h-[360px]">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div>
                  <h2 className="text-base font-bold text-slate-900">抽籤紀錄</h2>
                  <p className="text-xs text-slate-500 tabular-nums">
                    累計已抽出 {history.length} 次
                  </p>
                </div>
                {history.length > 0 && (
                  <button
                    type="button"
                    onClick={onClearHistory}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-500 hover:text-rose-700 hover:bg-rose-50 rounded-md transition-colors whitespace-nowrap"
                  >
                    <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                    清除
                  </button>
                )}
              </div>

              {history.length === 0 ? (
                <div className="py-10 text-center text-sm text-slate-400">
                  尚未有抽籤紀錄
                </div>
              ) : (
                <ol className="flex-1 overflow-y-auto divide-y divide-slate-100 mt-1 pr-1">
                  {history.map((record) => (
                    <li
                      key={record.id}
                      className="flex items-center justify-between py-2.5 text-sm"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="w-8 font-mono text-xs tabular-nums text-slate-400 shrink-0">
                          #{String(record.order).padStart(2, '0')}
                        </span>
                        <span className="font-semibold text-slate-900 truncate">
                          {record.student.name}
                        </span>
                        {record.student.seatNo && (
                          <span className="font-mono text-xs tabular-nums text-slate-400 shrink-0">
                            {record.student.seatNo}
                          </span>
                        )}
                      </div>
                      <span className="font-mono text-xs tabular-nums text-slate-400 shrink-0">
                        {record.timestamp}
                      </span>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
