"use client";

import { useEffect, useState, type ReactNode } from "react";

type PageId = "today" | "planning" | "insights" | "model" | "settings";
type PlannerTab = "tasks" | "schedule";

type PlannerTask = {
  name: string;
  estimatedHoursMin: number;
  estimatedHoursMax: number;
  order: number;
  rationale: string;
};

type PlanResult = {
  tasks: PlannerTask[];
  totalEstimatedHoursMin: number;
  totalEstimatedHoursMax: number;
  aiSuggestion: string;
};

const FOCUS_HOURS_PER_DAY = 5;

function hoursToDays(hours: number) {
  return Math.ceil(hours / FOCUS_HOURS_PER_DAY);
}

const SCHEDULE_MOCK = [
  {
    time: "07:00",
    endTime: "08:00",
    label: "晨跑 & 唤醒",
    sub: "Recovery · 户外有氧",
    color: "bg-emerald-500/20 border-emerald-500/40 text-emerald-300",
  },
  {
    time: "09:00",
    endTime: "11:00",
    label: "深度设计",
    sub: "Deep Work · 核心建模",
    color: "bg-blue-500/20 border-blue-500/40 text-blue-300",
  },
  {
    time: "11:30",
    endTime: "12:30",
    label: "午餐 & 休息",
    sub: "Routine · 能量补给",
    color: "bg-gray-500/20 border-gray-500/40 text-gray-300",
  },
  {
    time: "14:00",
    endTime: "16:30",
    label: "渲染与出图",
    sub: "Deep Work · 视觉产出",
    color: "bg-amber-500/20 border-amber-500/40 text-amber-300",
  },
  {
    time: "19:00",
    endTime: "21:00",
    label: "答辩排练",
    sub: "Deep Work · 模拟演练",
    color: "bg-purple-500/20 border-purple-500/40 text-purple-300",
  },
] as const;

type FeedItem = {
  id: string;
  userText: string;
  needClarification: boolean;
  title: string;
  category: string;
  duration: number;
  feedback: string;
  timestamp: string;
};

const TOTAL_MINUTES = 1440;

const STORAGE_KEYS = {
  timeCoin: "chrona:timeCoin",
  feedList: "chrona:feedList",
} as const;

function isFeedItem(value: unknown): value is FeedItem {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return (
    typeof item.id === "string" &&
    typeof item.userText === "string" &&
    typeof item.needClarification === "boolean" &&
    typeof item.title === "string" &&
    typeof item.category === "string" &&
    typeof item.duration === "number" &&
    typeof item.feedback === "string" &&
    typeof item.timestamp === "string"
  );
}

const CATEGORY_META: Record<
  string,
  { label: string; dot: string; badge: string }
> = {
  Deep_Work: {
    label: "深度工作",
    dot: "bg-blue-500",
    badge: "bg-blue-500/15 text-blue-400",
  },
  Entertainment: {
    label: "娱乐",
    dot: "bg-purple-500",
    badge: "bg-purple-500/15 text-purple-400",
  },
  Recovery: {
    label: "恢复",
    dot: "bg-emerald-500",
    badge: "bg-emerald-500/15 text-emerald-400",
  },
  Routine: {
    label: "日常",
    dot: "bg-gray-500",
    badge: "bg-gray-500/15 text-gray-400",
  },
};

function formatFeedTime(iso: string) {
  const date = new Date(iso);
  return date.toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

const glassCard =
  "rounded-[20px] border border-white/[0.08] bg-[#1a1f2e]/70 backdrop-blur-xl";

function Icon({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
    >
      {children}
    </svg>
  );
}

function ToggleSwitch({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      className={`relative h-5 w-10 rounded-full transition-colors ${
        checked ? "bg-indigo-600" : "bg-slate-700"
      }`}
    >
      <span
        className={`absolute top-1 h-3 w-3 rounded-full bg-white transition-transform ${
          checked ? "right-1" : "left-1"
        }`}
      />
    </button>
  );
}

function NavButton({
  label,
  active,
  onClick,
  icon,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  icon: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group flex flex-col items-center gap-1 ${active ? "active" : ""}`}
    >
      <div
        className={`flex h-10 w-10 items-center justify-center rounded-xl transition-all group-active:scale-95 ${
          active ? "text-indigo-500 drop-shadow-[0_0_8px_rgba(139,92,246,0.6)]" : "text-slate-500"
        }`}
      >
        {icon}
      </div>
      <span
        className={`text-[10px] font-medium ${
          active ? "text-indigo-400" : "text-slate-500"
        }`}
      >
        {label}
      </span>
    </button>
  );
}

function TrendChart() {
  const days = ["一", "二", "三", "四", "五", "六", "日"];
  const deepWork = [2.1, 2.8, 3.2, 2.5, 3.0, 1.8, 2.4];
  const entertainment = [3.5, 2.8, 2.2, 3.0, 2.5, 4.2, 3.8];
  const maxY = 5;
  const w = 280;
  const h = 160;
  const pad = { t: 10, r: 10, b: 24, l: 10 };
  const chartW = w - pad.l - pad.r;
  const chartH = h - pad.t - pad.b;

  const toPoints = (data: number[]) =>
    data
      .map((v, i) => {
        const x = pad.l + (i / (data.length - 1)) * chartW;
        const y = pad.t + chartH - (v / maxY) * chartH;
        return `${x},${y}`;
      })
      .join(" ");

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-48 w-full">
      {[0, 1, 2, 3, 4, 5].map((v) => {
        const y = pad.t + chartH - (v / maxY) * chartH;
        return (
          <line
            key={v}
            x1={pad.l}
            y1={y}
            x2={w - pad.r}
            y2={y}
            stroke="#374151"
            strokeWidth="0.5"
            strokeDasharray="2 2"
          />
        );
      })}
      <polyline
        fill="none"
        stroke="#6366f1"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={toPoints(deepWork)}
      />
      <polyline
        fill="none"
        stroke="#f59e0b"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={toPoints(entertainment)}
      />
      {days.map((day, i) => {
        const x = pad.l + (i / (days.length - 1)) * chartW;
        return (
          <text
            key={day}
            x={x}
            y={h - 4}
            textAnchor="middle"
            fill="#6b7280"
            fontSize="10"
          >
            {day}
          </text>
        );
      })}
    </svg>
  );
}

function DonutChart({
  segments,
}: {
  segments: { value: number; color: string }[];
}) {
  const total = segments.reduce((s, seg) => s + seg.value, 0);
  let offset = 0;

  return (
    <svg viewBox="0 0 36 36" className="h-full w-full -rotate-90">
      <circle cx="18" cy="18" r="16" fill="none" stroke="#374151" strokeWidth="4" />
      {segments.map((seg, i) => {
        const pct = (seg.value / total) * 100;
        const dash = `${pct} ${100 - pct}`;
        const el = (
          <circle
            key={i}
            cx="18"
            cy="18"
            r="16"
            fill="none"
            stroke={seg.color}
            strokeWidth="4"
            strokeDasharray={dash}
            strokeDashoffset={-offset}
          />
        );
        offset += pct;
        return el;
      })}
    </svg>
  );
}

export default function Home() {
  const [activePage, setActivePage] = useState<PageId>("today");
  const [plannerTab, setPlannerTab] = useState<PlannerTab>("tasks");
  const [goal, setGoal] = useState("");
  const [planResult, setPlanResult] = useState<PlanResult | null>(null);
  const [isLoadingPlanner, setIsLoadingPlanner] = useState(false);
  const [errorMessagePlanner, setErrorMessagePlanner] = useState<string | null>(
    null,
  );
  const [quickLog, setQuickLog] = useState("");
  const [timeCoin, setTimeCoin] = useState(TOTAL_MINUTES);
  const [feedList, setFeedList] = useState<FeedItem[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [toggles, setToggles] = useState({
    overtime: true,
    dailyReport: true,
    aiSuggestion: false,
    modelUpdate: true,
  });

  const usedMinutes = TOTAL_MINUTES - timeCoin;
  const remainingPct = ((timeCoin / TOTAL_MINUTES) * 100).toFixed(1);
  const usedPct = (usedMinutes / TOTAL_MINUTES) * 100;

  useEffect(() => {
    try {
      const storedCoin = localStorage.getItem(STORAGE_KEYS.timeCoin);
      if (storedCoin !== null) {
        const parsed = Number(storedCoin);
        if (Number.isFinite(parsed) && parsed >= 0 && parsed <= TOTAL_MINUTES) {
          setTimeCoin(parsed);
        }
      }

      const storedFeed = localStorage.getItem(STORAGE_KEYS.feedList);
      if (storedFeed !== null) {
        const parsed = JSON.parse(storedFeed);
        if (Array.isArray(parsed)) {
          setFeedList(parsed.filter(isFeedItem));
        }
      }
    } catch (error) {
      console.warn("[Chrona] localStorage 恢复失败，使用默认值:", error);
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(STORAGE_KEYS.timeCoin, String(timeCoin));
    localStorage.setItem(STORAGE_KEYS.feedList, JSON.stringify(feedList));
  }, [timeCoin, feedList, hydrated]);

  const handleGeneratePlan = async () => {
    const trimmed = goal.trim();
    if (!trimmed || isLoadingPlanner) return;

    setIsLoadingPlanner(true);
    setErrorMessagePlanner(null);

    try {
      const res = await fetch("/api/planner", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goal: trimmed }),
      });

      if (!res.ok) throw new Error("request failed");

      const data: PlanResult = await res.json();
      setPlanResult(data);
    } catch {
      setErrorMessagePlanner("AI 暂时开小差了，请稍后再试");
    } finally {
      setIsLoadingPlanner(false);
    }
  };

  const handleSendLog = async () => {
    const text = quickLog.trim();
    if (!text || isSubmitting) return;

    setQuickLog("");
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });

      if (!res.ok) throw new Error("request failed");

      const data = await res.json();

      const item: FeedItem = {
        id: crypto.randomUUID(),
        userText: text,
        needClarification: data.needClarification,
        title: data.title,
        category: data.category,
        duration: data.duration,
        feedback: data.feedback,
        timestamp: data.timestamp,
      };

      setFeedList((prev) => [item, ...prev]);

      if (!data.needClarification) {
        setTimeCoin((prev) => Math.max(0, prev - data.duration));
      }
    } catch {
      setErrorMessage("AI 暂时开小差了");
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggle = (key: keyof typeof toggles) =>
    setToggles((prev) => ({ ...prev, [key]: !prev[key] }));

  const pageClass = (id: PageId) =>
    `space-y-6 transition-opacity duration-300 ease-in-out ${
      activePage === id ? "block opacity-100" : "hidden opacity-0"
    }`;

  return (
    <div className="flex min-h-dvh items-center justify-center overflow-hidden bg-[#05070A] font-sans text-gray-200">
      <div className="relative mx-auto flex min-h-dvh w-full max-w-[393px] flex-col overflow-hidden bg-[#0A0E1A] md:my-5 md:h-[852px] md:min-h-0 md:rounded-[50px] md:border-8 md:border-gray-800 md:shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5)]">
        {/* Status bar */}
        <div className="flex h-11 shrink-0 items-center justify-between px-8 pt-4">
          <span className="text-sm font-semibold">9:41</span>
          <div className="flex items-center gap-1.5">
            <Icon className="h-3 w-3">
              <path d="M2 20h2V10H2v10zm6 0h2V6H8v14zm6 0h2V2h-2v18zm6 0h2v-8h-2v8z" />
            </Icon>
            <Icon className="h-3 w-3">
              <path d="M12 3C7.03 3 3 7.03 3 12h2a7 7 0 0114 0h2c0-4.97-4.03-9-9-9zm0 4a5 5 0 00-5 5h2a3 3 0 016 0h2a5 5 0 00-5-5zm0 4a1 1 0 00-1 1h2a1 1 0 00-1-1z" />
            </Icon>
            <Icon className="h-5 w-5">
              <path d="M16 4H8a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2V6a2 2 0 00-2-2zm0 14H8V6h8v12z" />
            </Icon>
          </div>
        </div>

        {/* Main content */}
        <div className="relative flex-1 overflow-y-auto px-5 pb-24 pt-4 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {/* Today */}
          <div className={pageClass("today")}>
            <div>
              <h1 className="text-3xl font-bold">Today</h1>
              <p className="text-sm text-gray-400">今日代谢台</p>
            </div>

            <div className={`${glassCard} space-y-4 p-5`}>
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-xs uppercase tracking-wider text-gray-400">
                    Time Coin Balance
                  </p>
                  <h2 className="mt-1 text-2xl font-bold">
                    {timeCoin}{" "}
                    <span className="text-sm font-normal text-gray-500">
                      / {TOTAL_MINUTES} min
                    </span>
                  </h2>
                </div>
                <span className="text-sm font-medium text-indigo-400">
                  剩余 {remainingPct}%
                </span>
              </div>
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-gray-800">
                <div
                  className="h-full rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 shadow-[0_0_10px_rgba(99,102,241,0.5)] transition-all duration-500"
                  style={{ width: `${usedPct}%` }}
                />
              </div>
            </div>

            <div className={`${glassCard} p-5`}>
              <h3 className="mb-4 text-sm font-semibold">Daily Distribution</h3>
              <div className="flex items-center justify-between">
                <div className="relative h-32 w-32 shrink-0">
                  <svg
                    viewBox="0 0 36 36"
                    className="h-full w-full -rotate-90"
                  >
                    <circle
                      cx="18"
                      cy="18"
                      r="16"
                      fill="none"
                      stroke="#374151"
                      strokeWidth="4"
                    />
                    <circle
                      cx="18"
                      cy="18"
                      r="16"
                      fill="none"
                      stroke="#3B82F6"
                      strokeWidth="4"
                      strokeDasharray="32 100"
                      strokeDashoffset="0"
                    />
                    <circle
                      cx="18"
                      cy="18"
                      r="16"
                      fill="none"
                      stroke="#8B5CF6"
                      strokeWidth="4"
                      strokeDasharray="38 100"
                      strokeDashoffset="-32"
                    />
                    <circle
                      cx="18"
                      cy="18"
                      r="16"
                      fill="none"
                      stroke="#10B981"
                      strokeWidth="4"
                      strokeDasharray="20 100"
                      strokeDashoffset="-70"
                    />
                    <circle
                      cx="18"
                      cy="18"
                      r="16"
                      fill="none"
                      stroke="#6B7280"
                      strokeWidth="4"
                      strokeDasharray="10 100"
                      strokeDashoffset="-90"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-xs text-gray-400">已用</span>
                    <span className="font-bold">{usedMinutes}m</span>
                  </div>
                </div>
                <div className="ml-4 flex-1 space-y-2">
                  {[
                    { label: "Deep Work", color: "bg-blue-500", pct: "32%" },
                    { label: "Entertainment", color: "bg-purple-500", pct: "38%" },
                    { label: "Recovery", color: "bg-emerald-500", pct: "20%" },
                    { label: "Routine", color: "bg-gray-500", pct: "10%" },
                  ].map((item) => (
                    <div
                      key={item.label}
                      className="flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <div className={`h-2 w-2 rounded-full ${item.color}`} />
                        <span className="text-gray-300">{item.label}</span>
                      </div>
                      <span className="font-medium">{item.pct}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="px-1 text-sm font-semibold">AI Quick Log</h3>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={quickLog}
                  onChange={(e) => setQuickLog(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSendLog();
                  }}
                  placeholder="你刚刚干了什么？比如做了40分钟数学题..."
                  disabled={isSubmitting}
                  className="min-w-0 flex-1 rounded-2xl border border-gray-800 bg-gray-900 py-4 px-5 text-sm transition-all focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50"
                />
                <button
                  type="button"
                  onClick={handleSendLog}
                  disabled={!quickLog.trim() || isSubmitting}
                  className="shrink-0 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-500 px-5 py-4 text-sm font-medium text-white transition-opacity disabled:opacity-40"
                >
                  {isSubmitting ? "处理中..." : "发送"}
                </button>
              </div>
              {errorMessage && (
                <p className="px-1 text-sm text-rose-400">{errorMessage}</p>
              )}
            </div>

            <div className="space-y-4">
              <h3 className="px-1 text-sm font-semibold">今日记录</h3>
              <div className="space-y-3">
                {feedList.length === 0 && (
                  <p className="px-1 text-sm leading-relaxed text-gray-500">
                    记录一段活动，AI 会帮你分析时间消耗。
                  </p>
                )}
                {feedList.map((item) => {
                  const meta = CATEGORY_META[item.category];
                  return (
                    <article
                      key={item.id}
                      className={`${glassCard} overflow-hidden p-5 transition-all ${
                        item.needClarification
                          ? "border border-amber-500/30"
                          : ""
                      }`}
                    >
                      <div className="mb-3 flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          {item.needClarification ? (
                            <span className="inline-block rounded-full bg-amber-500/15 px-2.5 py-0.5 text-[11px] font-medium text-amber-400">
                              待确认
                            </span>
                          ) : (
                            <div className="flex flex-wrap items-center gap-2">
                              <h4 className="text-base font-semibold text-white">
                                {item.title}
                              </h4>
                              {meta && (
                                <span
                                  className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${meta.badge}`}
                                >
                                  {meta.label}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                        <time className="shrink-0 text-[11px] text-gray-500">
                          {formatFeedTime(item.timestamp)}
                        </time>
                      </div>

                      {!item.needClarification && item.duration > 0 && (
                        <p className="mb-3 text-2xl font-bold tracking-tight text-indigo-300">
                          {item.duration}
                          <span className="ml-1 text-sm font-normal text-gray-500">
                            min
                          </span>
                        </p>
                      )}

                      <p className="text-sm leading-relaxed text-gray-300">
                        {item.feedback}
                      </p>

                      {item.userText && (
                        <p className="mt-3 border-t border-white/[0.06] pt-3 text-xs text-gray-500">
                          「{item.userText}」
                        </p>
                      )}
                    </article>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Planner */}
          <div className={pageClass("planning")}>
            <div>
              <h1 className="text-3xl font-bold">Planner</h1>
              <p className="text-sm text-gray-400">AI 任务预测</p>
            </div>

            <div className="relative flex rounded-2xl border border-white/[0.06] bg-[#121826]/80 p-1 backdrop-blur-xl">
              <div
                className={`absolute top-1 bottom-1 w-[calc(50%-4px)] rounded-xl bg-gradient-to-br from-indigo-500/90 to-violet-500/90 shadow-[0_4px_20px_rgba(99,102,241,0.35)] transition-transform duration-300 ease-out ${
                  plannerTab === "tasks" ? "translate-x-1" : "translate-x-[calc(100%+4px)]"
                }`}
              />
              <button
                type="button"
                onClick={() => setPlannerTab("tasks")}
                className={`relative z-10 flex-1 rounded-xl py-2.5 text-sm font-medium transition-colors ${
                  plannerTab === "tasks" ? "text-white" : "text-gray-400"
                }`}
              >
                任务规划
              </button>
              <button
                type="button"
                onClick={() => setPlannerTab("schedule")}
                className={`relative z-10 flex-1 rounded-xl py-2.5 text-sm font-medium transition-colors ${
                  plannerTab === "schedule" ? "text-white" : "text-gray-400"
                }`}
              >
                时间日程
              </button>
            </div>

            {plannerTab === "tasks" ? (
              <>
                <div className="space-y-3">
                  <textarea
                    value={goal}
                    onChange={(e) => setGoal(e.target.value)}
                    placeholder="输入你的宏大目标，比如：完成毕业设计答辩..."
                    disabled={isLoadingPlanner}
                    rows={4}
                    className="w-full resize-none rounded-2xl border border-gray-800 bg-gray-900/80 px-5 py-4 text-sm leading-relaxed transition-all focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50"
                  />
                  <button
                    type="button"
                    onClick={handleGeneratePlan}
                    disabled={!goal.trim() || isLoadingPlanner}
                    className="w-full rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-500 py-4 text-sm font-semibold text-white transition-opacity disabled:opacity-40"
                  >
                    {isLoadingPlanner ? "拆解中..." : "开始拆解"}
                  </button>
                  {errorMessagePlanner && (
                    <p className="px-1 text-center text-sm text-rose-400">
                      {errorMessagePlanner}
                    </p>
                  )}
                </div>

                {planResult && (
                  <div className="space-y-4">
                    <div
                      className={`${glassCard} border-t-2 border-t-indigo-500/40 p-5`}
                    >
                      <p className="mb-2 text-xs uppercase tracking-wider text-gray-400">
                        预计总耗时
                      </p>
                      <h2 className="text-2xl font-bold leading-snug text-white">
                        预计总耗时{" "}
                        <span className="text-indigo-300">
                          {planResult.totalEstimatedHoursMin}~
                          {planResult.totalEstimatedHoursMax}h
                        </span>{" "}
                        <span className="text-gray-400">≈</span>{" "}
                        <span className="text-violet-300">
                          {hoursToDays(planResult.totalEstimatedHoursMin)}~
                          {hoursToDays(planResult.totalEstimatedHoursMax)} 天
                        </span>
                      </h2>
                      <p className="mt-2 text-xs text-gray-500">
                        按你目前的节奏（每日专注 {FOCUS_HOURS_PER_DAY} 小时）
                      </p>
                    </div>

                    <div className="rounded-[20px] bg-gradient-to-br from-indigo-500 via-violet-500 to-fuchsia-500 p-[1px] shadow-[0_0_24px_rgba(139,92,246,0.25)]">
                      <div className="rounded-[19px] bg-[#141929]/95 p-5 backdrop-blur-xl">
                        <div className="mb-2 flex items-center gap-2">
                          <Icon className="h-4 w-4 text-violet-400">
                            <path d="M12 2l1.5 4.5L18 8l-4.5 1.5L12 14l-1.5-4.5L6 8l4.5-1.5L12 2zm7 7l1 3 3 1-3 1-1 3-1-3-3-1 3-1 1-3z" />
                          </Icon>
                          <span className="text-xs font-semibold uppercase tracking-wider text-violet-400">
                            AI 专属洞察
                          </span>
                        </div>
                        <p className="text-sm leading-relaxed text-gray-200">
                          {planResult.aiSuggestion}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-3">
                      {[...planResult.tasks]
                        .sort((a, b) => a.order - b.order)
                        .map((task) => (
                          <article
                            key={task.order}
                            className={`${glassCard} p-5`}
                          >
                            <div className="mb-2 flex items-start justify-between gap-3">
                              <div className="min-w-0 flex-1">
                                <span className="mb-1.5 inline-block rounded-md bg-indigo-500/15 px-2 py-0.5 text-[11px] font-semibold text-indigo-400">
                                  #{task.order}
                                </span>
                                <h3 className="text-base font-semibold text-white">
                                  {task.name}
                                </h3>
                              </div>
                              <span className="shrink-0 text-sm font-bold text-indigo-300">
                                {task.estimatedHoursMin}-{task.estimatedHoursMax}h
                              </span>
                            </div>
                            <p className="text-sm leading-relaxed text-gray-500">
                              {task.rationale}
                            </p>
                          </article>
                        ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className={`${glassCard} p-5`}>
                <div className="mb-5 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-white">理想一日节奏</h3>
                  <span className="text-xs text-indigo-400">UI 愿景预览</span>
                </div>
                <div className="relative space-y-0">
                  <div className="absolute bottom-2 left-[52px] top-2 w-px bg-gradient-to-b from-indigo-500/50 via-violet-500/30 to-transparent" />
                  {SCHEDULE_MOCK.map((item, index) => (
                    <div key={item.time} className="relative flex gap-4 pb-6 last:pb-0">
                      <div className="flex w-12 shrink-0 flex-col items-end pt-1">
                        <span className="text-xs font-medium tabular-nums text-gray-400">
                          {item.time}
                        </span>
                        {index < SCHEDULE_MOCK.length - 1 && (
                          <span className="mt-6 text-[10px] tabular-nums text-gray-600">
                            {SCHEDULE_MOCK[index + 1].time}
                          </span>
                        )}
                      </div>
                      <div className="relative flex flex-1 items-start pt-0.5">
                        <div className="absolute -left-[9px] top-2 h-2.5 w-2.5 rounded-full border-2 border-indigo-400 bg-[#0A0E1A]" />
                        <div
                          className={`flex-1 rounded-2xl border px-4 py-3 ${item.color}`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="text-sm font-semibold text-white">
                                {item.label}
                              </p>
                              <p className="mt-0.5 text-[11px] opacity-80">
                                {item.sub}
                              </p>
                            </div>
                            <span className="shrink-0 text-[10px] tabular-nums opacity-70">
                              {item.time}-{item.endTime}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Insights */}
          <div className={pageClass("insights")}>
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold">Insights</h1>
                <p className="text-sm text-gray-400">洞察</p>
              </div>
              <div className="flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1 text-xs text-slate-300">
                本周
                <Icon className="h-3 w-3">
                  <path d="M7 10l5 5 5-5H7z" />
                </Icon>
              </div>
            </div>

            <div className="mb-6 grid grid-cols-3 gap-3">
              {[
                { label: "深度工作", value: "18.2h", trend: "12%", up: true },
                { label: "娱乐消耗", value: "14.5h", trend: "8%", up: false },
                { label: "预测准确率", value: "87%", trend: "5%", up: true },
              ].map((metric) => (
                <div
                  key={metric.label}
                  className={`${glassCard} flex flex-col items-center rounded-2xl p-3 text-center`}
                >
                  <span className="mb-1 text-[10px] leading-tight text-slate-500">
                    {metric.label}
                  </span>
                  <span className="text-lg font-bold text-white">
                    {metric.value}
                  </span>
                  <span className="mt-1 flex items-center text-[10px] text-emerald-400">
                    <Icon className="mr-0.5 h-3 w-3">
                      {metric.up ? (
                        <path d="M3 17l6-6 4 4 8-8v4h2V3h-6v2h3.5L13 13l-4-4-6 6v4z" />
                      ) : (
                        <path d="M3 7l6 6 4-4 8 8v-4h2v10h-6v-2h3.5L13 11l-4 4-6-6V7z" />
                      )}
                    </Icon>
                    {metric.trend}
                  </span>
                </div>
              ))}
            </div>

            <div className={`${glassCard} mb-6 rounded-3xl p-5`}>
              <h3 className="mb-4 text-sm font-bold text-white">周趋势分析</h3>
              <TrendChart />
              <div className="mt-2 flex justify-center gap-4 text-xs">
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-indigo-500" />
                  深度工作
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-amber-500" />
                  娱乐消耗
                </span>
              </div>
            </div>

            <div
              className={`${glassCard} mb-6 rounded-3xl border-l-4 border-l-emerald-500 p-5`}
            >
              <div className="flex items-start gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-500/20">
                  <Icon className="h-4 w-4 text-emerald-400">
                    <path d="M9 21h6M12 3a6 6 0 00-3 11.3V17h6v-2.7A6 6 0 0012 3z" />
                  </Icon>
                </div>
                <p className="text-sm leading-relaxed text-slate-200">
                  相比于上周，你的深度工作时间增加了{" "}
                  <span className="font-bold text-emerald-400">12%</span>
                  ，娱乐时间下降了{" "}
                  <span className="font-bold text-emerald-400">8%</span>
                  。按此趋势，本周预计可多完成{" "}
                  <span className="font-bold text-white">3 个</span>{" "}
                  高价值任务。
                </p>
              </div>
            </div>

            <div className={`${glassCard} mb-6 rounded-3xl p-5`}>
              <h3 className="mb-4 text-sm font-bold text-white">
                计划 vs 实际对比
              </h3>
              <div className="flex items-center justify-around">
                <div className="relative h-24 w-24">
                  <DonutChart
                    segments={[
                      { value: 32, color: "#3B82F6" },
                      { value: 38, color: "#8B5CF6" },
                      { value: 20, color: "#10B981" },
                      { value: 10, color: "#6B7280" },
                    ]}
                  />
                  <div className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-slate-400">
                    计划
                  </div>
                </div>
                <div className="relative h-24 w-24">
                  <DonutChart
                    segments={[
                      { value: 28, color: "#3B82F6" },
                      { value: 42, color: "#8B5CF6" },
                      { value: 18, color: "#10B981" },
                      { value: 12, color: "#6B7280" },
                    ]}
                  />
                  <div className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-slate-400">
                    实际
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Profile / Model */}
          <div className={pageClass("model")}>
            <div>
              <h1 className="text-3xl font-bold">Profile</h1>
              <p className="text-sm text-gray-400">我的模型</p>
            </div>

            <div className={`${glassCard} p-5`}>
              <div className="mb-4 flex items-center gap-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 text-2xl font-bold">
                  C
                </div>
                <div>
                  <h2 className="text-lg font-semibold">Chrona 用户</h2>
                  <p className="text-sm text-gray-400">个人时间模型 v2.1</p>
                </div>
              </div>
              <div className="space-y-3">
                {[
                  { label: "模型准确度", value: "87%", width: "87%" },
                  { label: "数据完整度", value: "92%", width: "92%" },
                  { label: "预测置信度", value: "78%", width: "78%" },
                ].map((stat) => (
                  <div key={stat.label}>
                    <div className="mb-1 flex justify-between text-xs">
                      <span className="text-gray-400">{stat.label}</span>
                      <span className="font-medium text-indigo-400">
                        {stat.value}
                      </span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-800">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500"
                        style={{ width: stat.width }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className={`${glassCard} p-5`}>
              <h3 className="mb-3 text-sm font-semibold">行为特征</h3>
              <div className="space-y-3 text-sm text-gray-300">
                <p>
                  最佳专注时段：{" "}
                  <span className="font-medium text-indigo-400">
                    09:00 - 12:00
                  </span>
                </p>
                <p>
                  平均深度工作：{" "}
                  <span className="font-medium text-white">2.6h / 天</span>
                </p>
                <p>
                  娱乐耗散倾向：{" "}
                  <span className="font-medium text-yellow-400">中等</span>
                </p>
              </div>
            </div>
          </div>

          {/* Settings */}
          <div className={pageClass("settings")}>
            <div className="mb-8 flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold">Settings</h1>
                <p className="text-sm text-gray-400">设置</p>
              </div>
            </div>

            <div className="mb-8">
              <h3 className="mb-4 ml-2 text-xs font-bold uppercase tracking-widest text-slate-500">
                个人信息
              </h3>
              <div className={`${glassCard} overflow-hidden rounded-2xl`}>
                <div className="flex items-center justify-between border-b border-slate-700/50 p-4">
                  <span className="text-sm text-slate-200">用户名</span>
                  <span className="text-sm text-slate-500">Chrona 用户</span>
                </div>
                <div className="flex items-center justify-between p-4">
                  <span className="text-sm text-slate-200">时区</span>
                  <span className="text-sm text-slate-500">Asia/Shanghai</span>
                </div>
              </div>
            </div>

            <div className="mb-8">
              <h3 className="mb-4 ml-2 text-xs font-bold uppercase tracking-widest text-slate-500">
                通知设置
              </h3>
              <div className={`${glassCard} overflow-hidden rounded-2xl`}>
                {[
                  { key: "overtime" as const, label: "时间超额提醒" },
                  { key: "dailyReport" as const, label: "每日报告推送" },
                  { key: "aiSuggestion" as const, label: "AI 建议通知" },
                  { key: "modelUpdate" as const, label: "模型更新提醒" },
                ].map((item, i, arr) => (
                  <div
                    key={item.key}
                    className={`flex items-center justify-between p-4 ${
                      i < arr.length - 1 ? "border-b border-slate-700/50" : ""
                    }`}
                  >
                    <span className="text-sm text-slate-200">{item.label}</span>
                    <ToggleSwitch
                      checked={toggles[item.key]}
                      onChange={() => toggle(item.key)}
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="mb-8">
              <h3 className="mb-4 ml-2 text-xs font-bold uppercase tracking-widest text-slate-500">
                数据管理
              </h3>
              <div className={`${glassCard} overflow-hidden rounded-2xl`}>
                <button
                  type="button"
                  className="flex w-full items-center justify-between border-b border-slate-700/50 p-4 text-left transition-colors hover:bg-slate-700/30"
                >
                  <span className="text-sm text-slate-200">
                    导出我的时间数据
                  </span>
                  <Icon className="h-4 w-4 text-slate-500">
                    <path d="M9 5l7 7-7 7" stroke="currentColor" strokeWidth="2" fill="none" />
                  </Icon>
                </button>
                <button
                  type="button"
                  className="flex w-full items-center justify-between border-b border-slate-700/50 p-4 text-left transition-colors hover:bg-slate-700/30"
                >
                  <span className="text-sm text-rose-500">清除历史记录</span>
                </button>
                <button
                  type="button"
                  className="flex w-full items-center justify-between p-4 text-left transition-colors hover:bg-slate-700/30"
                >
                  <span className="text-sm font-bold text-rose-500">
                    重置模型
                  </span>
                </button>
              </div>
            </div>

            <div className="pb-8 text-center">
              <p className="mb-1 text-xs text-slate-600">版本号：v2.1.0</p>
              <p className="text-[10px] uppercase tracking-widest text-slate-700">
                © 2025 Chrona AI
              </p>
            </div>
          </div>
        </div>

        {/* Bottom nav */}
        <div className="absolute bottom-0 left-0 right-0 z-50 flex h-20 items-center justify-around border-t border-slate-800 bg-slate-900/90 px-4 pb-4 backdrop-blur-xl">
          <NavButton
            label="今日"
            active={activePage === "today"}
            onClick={() => setActivePage("today")}
            icon={
              <Icon className="h-6 w-6">
                <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8h5z" />
              </Icon>
            }
          />
          <NavButton
            label="规划"
            active={activePage === "planning"}
            onClick={() => setActivePage("planning")}
            icon={
              <Icon className="h-6 w-6">
                <path d="M19 4h-1V2h-2v2H8V2H6v2H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V6a2 2 0 00-2-2zm0 16H5V10h14v10zM7 12h5v5H7v-5z" />
              </Icon>
            }
          />
          <NavButton
            label="洞察"
            active={activePage === "insights"}
            onClick={() => setActivePage("insights")}
            icon={
              <Icon className="h-6 w-6">
                <path d="M5 9.2h3V19H5V9.2zM10.6 5h2.8v14h-2.8V5zm5.6 8H19v6h-2.8v-6z" />
              </Icon>
            }
          />
          <NavButton
            label="模型"
            active={activePage === "model"}
            onClick={() => setActivePage("model")}
            icon={
              <Icon className="h-6 w-6">
                <path d="M9 3H7a2 2 0 00-2 2v2h4V3zm8 0h-2v4h4V5a2 2 0 00-2-2zM9 11H7v4h2v-4zm8 0h-2v4h2v-4zM9 19H7v2a2 2 0 002 2h2v-4zm8 0h-2v4h2a2 2 0 002-2v-2h-2z" />
              </Icon>
            }
          />
          <NavButton
            label="设置"
            active={activePage === "settings"}
            onClick={() => setActivePage("settings")}
            icon={
              <Icon className="h-6 w-6">
                <path d="M12 8a4 4 0 100 8 4 4 0 000-8zm9.4 4a7.4 7.4 0 01-.1 1l2 1.5-2 3.5-2.3-1a7.6 7.6 0 01-2.6 1.5l-.3 2.5H9.8l-.3-2.5a7.6 7.6 0 01-2.6-1.5l-2.3 1-2-3.5 2-1.5a7.4 7.4 0 010-2l-2-1.5 2-3.5 2.3 1a7.6 7.6 0 012.6-1.5l.3-2.5h4.4l.3 2.5a7.6 7.6 0 012.6 1.5l2.3-1 2 3.5-2 1.5c.07.3.1.7.1 1z" />
              </Icon>
            }
          />
        </div>

        <div className="h-[34px] shrink-0" />
      </div>
    </div>
  );
}
