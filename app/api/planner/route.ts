import { NextResponse } from "next/server";

const SILICONFLOW_API_URL = "https://api.siliconflow.cn/v1/chat/completions";
const MODEL = "deepseek-ai/DeepSeek-V3";

const SYSTEM_PROMPT = `你是一个"项目规划与时间预测专家"。

你的任务是：
将用户的目标拆解为可执行任务，并预测完成时间。

你必须只输出 JSON（禁止 Markdown / 解释 / 多余文本）。

---

### 输入：
用户目标（如：毕业设计 / 产品开发 / 答辩准备）

---

### 输出 JSON 格式：

{
  "tasks": [
    {
      "name": "任务名称",
      "estimatedHoursMin": number,
      "estimatedHoursMax": number,
      "order": number,
      "rationale": "简短解释（30字以内）"
    }
  ],
  "totalEstimatedHoursMin": number,
  "totalEstimatedHoursMax": number,
  "aiSuggestion": "根据任务总耗时，给用户的每日执行建议（50字以内）"
}

---

### 规则：
- tasks 必须按执行顺序排序（order 从 1 开始）
- 时间必须是整数小时
- order 依据：任务依赖 + 优先级 + 时间成本
- 必须合理拆解真实可执行步骤
- aiSuggestion 需结合总耗时给出可执行的每日节奏建议，例如：「建议每天投入 2 小时，保持心流状态，优先在上午完成高难度的建模任务。」
- 禁止输出任何非 JSON 内容
- 不确定时要做合理保守估计（不要过于乐观）`;

type PlannerTask = {
  name: string;
  estimatedHoursMin: number;
  estimatedHoursMax: number;
  order: number;
  rationale: string;
};

type PlannerPayload = {
  tasks: PlannerTask[];
  totalEstimatedHoursMin: number;
  totalEstimatedHoursMax: number;
  aiSuggestion: string;
};

function extractJson(raw: string): unknown {
  const trimmed = raw.trim();

  try {
    return JSON.parse(trimmed);
  } catch {
    // fall through
  }

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) {
    return JSON.parse(fenced[1].trim());
  }

  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start !== -1 && end > start) {
    return JSON.parse(trimmed.slice(start, end + 1));
  }

  throw new Error("无法从 AI 返回内容中定位 JSON 对象");
}

function isIntegerHours(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function validatePayload(data: unknown): PlannerPayload {
  if (!data || typeof data !== "object") {
    throw new Error("AI 返回格式无效");
  }

  const obj = data as Record<string, unknown>;

  if (!Array.isArray(obj.tasks) || obj.tasks.length === 0) {
    throw new Error("tasks 必须为非空数组");
  }

  if (
    !isIntegerHours(obj.totalEstimatedHoursMin) ||
    !isIntegerHours(obj.totalEstimatedHoursMax)
  ) {
    throw new Error("totalEstimatedHoursMin/Max 必须为非负整数");
  }

  if (obj.totalEstimatedHoursMin > obj.totalEstimatedHoursMax) {
    throw new Error("totalEstimatedHoursMin 不能大于 totalEstimatedHoursMax");
  }

  if (typeof obj.aiSuggestion !== "string" || !obj.aiSuggestion.trim()) {
    throw new Error("aiSuggestion 无效");
  }

  const tasks: PlannerTask[] = obj.tasks.map((item, index) => {
    if (!item || typeof item !== "object") {
      throw new Error(`tasks[${index}] 格式无效`);
    }

    const task = item as Record<string, unknown>;

    if (typeof task.name !== "string" || !task.name.trim()) {
      throw new Error(`tasks[${index}].name 无效`);
    }
    if (
      !isIntegerHours(task.estimatedHoursMin) ||
      !isIntegerHours(task.estimatedHoursMax)
    ) {
      throw new Error(`tasks[${index}] 时间估算必须为非负整数小时`);
    }
    if (task.estimatedHoursMin > task.estimatedHoursMax) {
      throw new Error(`tasks[${index}] estimatedHoursMin 不能大于 estimatedHoursMax`);
    }
    if (typeof task.order !== "number" || !Number.isInteger(task.order) || task.order < 1) {
      throw new Error(`tasks[${index}].order 必须为正整数`);
    }
    if (typeof task.rationale !== "string" || !task.rationale.trim()) {
      throw new Error(`tasks[${index}].rationale 无效`);
    }

    return {
      name: task.name.trim(),
      estimatedHoursMin: task.estimatedHoursMin,
      estimatedHoursMax: task.estimatedHoursMax,
      order: task.order,
      rationale: task.rationale.trim(),
    };
  });

  const sorted = [...tasks].sort((a, b) => a.order - b.order);
  for (let i = 0; i < sorted.length; i++) {
    if (sorted[i].order !== i + 1) {
      throw new Error("tasks 的 order 必须从 1 开始连续递增");
    }
  }

  return {
    tasks: sorted,
    totalEstimatedHoursMin: obj.totalEstimatedHoursMin,
    totalEstimatedHoursMax: obj.totalEstimatedHoursMax,
    aiSuggestion: obj.aiSuggestion.trim(),
  };
}

export async function POST(request: Request) {
  const apiKey = process.env.SILICONFLOW_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "未配置 SILICONFLOW_API_KEY" },
      { status: 500 },
    );
  }

  let goal: string;
  try {
    const body = await request.json();
    goal = typeof body.goal === "string" ? body.goal.trim() : "";
  } catch {
    return NextResponse.json({ error: "请求体格式错误" }, { status: 400 });
  }

  if (!goal) {
    return NextResponse.json({ error: "goal 不能为空" }, { status: 400 });
  }

  try {
    const response = await fetch(SILICONFLOW_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: goal },
        ],
        temperature: 0.3,
        max_tokens: 2048,
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `SiliconFlow API 请求失败: ${response.status} ${errorText}`,
      );
    }

    let result: unknown;
    try {
      result = JSON.parse(await response.text());
    } catch {
      throw new Error("SiliconFlow 响应 JSON 解析失败");
    }

    const content = (result as { choices?: { message?: { content?: unknown } }[] })
      ?.choices?.[0]?.message?.content;

    if (typeof content !== "string" || !content.trim()) {
      throw new Error("AI 返回内容为空");
    }

    let parsed: PlannerPayload;
    try {
      parsed = validatePayload(extractJson(content));
    } catch (parseError) {
      throw parseError;
    }

    return NextResponse.json(parsed);
  } catch (error) {
    return NextResponse.json(
      {
        error: "AI 响应解析失败",
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
