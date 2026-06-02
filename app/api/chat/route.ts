import { NextResponse } from "next/server";

const SILICONFLOW_API_URL = "https://api.siliconflow.cn/v1/chat/completions";
const MODEL = "deepseek-ai/DeepSeek-V3";

const SYSTEM_PROMPT = `你是 Chrona 时间记录助手。用户会用自然语言描述刚完成的活动，你需要解析并输出 JSON。

【输出规则 — 必须严格遵守】
1. 只输出一个合法 JSON 对象，禁止 Markdown、代码块、解释文字或任何 JSON 以外的内容。
2. JSON 必须包含且仅包含以下 5 个字段：
   - needClarification (boolean): 信息不足以判断行为或时长时为 true
   - title (string): 对行为的简短概括，如"刷短视频"、"吃饭"；needClarification 为 true 时可留空字符串
   - category (string): 必须从 Deep_Work、Entertainment、Recovery、Routine 四选一；needClarification 为 true 时可留空字符串
   - duration (number): 整数分钟；未明确时长时按常理推测；needClarification 为 true 时为 0
   - feedback (string): 简短的机会成本点评，30字以内。注意：在折算机会成本时，请使用普适性的高价值行为（如：深度阅读、专注学习、锻炼身体等），或者顺应用户输入中的上下文。绝对不要假设用户在从事某种特定职业（如不要总是提"做作品集"、"写PPT"、"写代码"），除非用户自己提到了这些词。语气要理性且直击痛点。needClarification 为 true 时写追问话术

【category 定义】
- Deep_Work: 深度工作、学习、创作、编程等
- Entertainment: 娱乐、刷视频、游戏、社交浏览等
- Recovery: 休息、睡眠、运动恢复、冥想等
- Routine: 吃饭、通勤、洗漱、家务等日常事务

【示例 — 行为明确】
{"needClarification":false,"title":"刷短视频","category":"Entertainment","duration":120,"feedback":"这120分钟足够专注学习一章内容。"}

【示例 — 需要追问】
{"needClarification":true,"title":"","category":"","duration":0,"feedback":"你刚才具体做了什么？大概花了多长时间？"}`;

type AiPayload = {
  needClarification: boolean;
  title: string;
  category: string;
  duration: number;
  feedback: string;
};

type ChatResponse = AiPayload & { timestamp: string };

function extractJson(raw: string): unknown {
  const trimmed = raw.trim();
  console.log("[extractJson] 原始内容长度:", trimmed.length);
  console.log("[extractJson] 原始内容预览:", trimmed.slice(0, 500));

  try {
    const direct = JSON.parse(trimmed);
    console.log("[extractJson] 直接 JSON.parse 成功");
    return direct;
  } catch (directError) {
    console.warn(
      "[extractJson] 直接 JSON.parse 失败:",
      directError instanceof Error ? directError.message : directError,
    );
  }

  try {
    const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenced?.[1]) {
      const fencedContent = fenced[1].trim();
      console.log("[extractJson] 尝试从 Markdown 代码块提取 JSON");
      const parsed = JSON.parse(fencedContent);
      console.log("[extractJson] Markdown 代码块 JSON.parse 成功");
      return parsed;
    }

    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start !== -1 && end > start) {
      const sliced = trimmed.slice(start, end + 1);
      console.log("[extractJson] 尝试从大括号区间提取 JSON, start:", start, "end:", end);
      const parsed = JSON.parse(sliced);
      console.log("[extractJson] 大括号区间 JSON.parse 成功");
      return parsed;
    }

    throw new Error("无法从 AI 返回内容中定位 JSON 对象");
  } catch (extractError) {
    console.error("[extractJson] 所有解析策略均失败:", extractError);
    throw extractError;
  }
}

function validatePayload(data: unknown): AiPayload {
  console.log("[validatePayload] 开始校验, 数据类型:", typeof data);

  if (!data || typeof data !== "object") {
    console.error("[validatePayload] 数据不是有效对象:", data);
    throw new Error("AI 返回格式无效");
  }

  const obj = data as Record<string, unknown>;
  const categories = ["Deep_Work", "Entertainment", "Recovery", "Routine"];

  console.log("[validatePayload] 收到的字段:", Object.keys(obj));
  console.log("[validatePayload] 字段快照:", JSON.stringify(obj));

  if (typeof obj.needClarification !== "boolean") {
    console.error("[validatePayload] needClarification 无效:", obj.needClarification);
    throw new Error("缺少 needClarification 字段");
  }
  if (typeof obj.title !== "string") {
    console.error("[validatePayload] title 无效:", obj.title);
    throw new Error("缺少 title 字段");
  }
  if (typeof obj.category !== "string") {
    console.error("[validatePayload] category 无效:", obj.category);
    throw new Error("缺少 category 字段");
  }
  if (typeof obj.duration !== "number" || !Number.isInteger(obj.duration)) {
    console.error("[validatePayload] duration 无效:", obj.duration);
    throw new Error("duration 必须为整数");
  }
  if (typeof obj.feedback !== "string") {
    console.error("[validatePayload] feedback 无效:", obj.feedback);
    throw new Error("缺少 feedback 字段");
  }

  if (!obj.needClarification && !categories.includes(obj.category)) {
    console.error("[validatePayload] category 不在允许范围:", obj.category);
    throw new Error("category 不在允许范围内");
  }

  console.log("[validatePayload] 校验通过");
  return {
    needClarification: obj.needClarification,
    title: obj.title,
    category: obj.category,
    duration: obj.duration,
    feedback: obj.feedback,
  };
}

export async function POST(request: Request) {
  console.log("========== [POST /api/chat] 请求开始 ==========");

  console.log("API Key exists:", !!process.env.SILICONFLOW_API_KEY);

  const apiKey = process.env.SILICONFLOW_API_KEY;
  if (!apiKey) {
    console.error("[POST /api/chat] 环境变量 SILICONFLOW_API_KEY 未配置");
    return NextResponse.json(
      { error: "未配置 SILICONFLOW_API_KEY" },
      { status: 500 },
    );
  }

  let message: string;
  try {
    const body = await request.json();
    message = typeof body.message === "string" ? body.message.trim() : "";
    console.log("[POST /api/chat] 收到用户消息:", message);
  } catch (bodyError) {
    console.error("[POST /api/chat] 请求体解析失败:", bodyError);
    return NextResponse.json({ error: "请求体格式错误" }, { status: 400 });
  }

  if (!message) {
    console.error("[POST /api/chat] message 为空");
    return NextResponse.json({ error: "message 不能为空" }, { status: 400 });
  }

  try {
    const requestPayload = {
      model: MODEL,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: message },
      ],
      temperature: 0.3,
      max_tokens: 512,
      response_format: { type: "json_object" },
    };

    console.log("[POST /api/chat] 即将请求 SiliconFlow, model:", MODEL);
    console.log("[POST /api/chat] 请求 URL:", SILICONFLOW_API_URL);

    const response = await fetch(SILICONFLOW_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestPayload),
    });

    console.log("[POST /api/chat] SiliconFlow 响应状态:", response.status, response.statusText);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("SiliconFlow API Error:", response.status, errorText);
      throw new Error(
        `SiliconFlow API 请求失败: ${response.status} ${errorText}`,
      );
    }

    let result: unknown;
    try {
      const responseText = await response.text();
      console.log("[POST /api/chat] SiliconFlow 原始响应体长度:", responseText.length);
      console.log("[POST /api/chat] SiliconFlow 原始响应体预览:", responseText.slice(0, 1000));

      result = JSON.parse(responseText);
      console.log("[POST /api/chat] SiliconFlow 响应 JSON 解析成功");
    } catch (upstreamJsonError) {
      console.error("[POST /api/chat] SiliconFlow 响应 JSON 解析失败:", upstreamJsonError);
      throw upstreamJsonError;
    }

    const resultObj = result as {
      choices?: { message?: { content?: unknown } }[];
    };
    const content = resultObj?.choices?.[0]?.message?.content;

    console.log("[POST /api/chat] AI content 类型:", typeof content);

    if (typeof content !== "string" || !content.trim()) {
      console.error("[POST /api/chat] AI 返回 content 为空或类型错误:", content);
      console.error("[POST /api/chat] 完整 upstream result:", JSON.stringify(result));
      throw new Error("AI 返回内容为空");
    }

    console.log("[POST /api/chat] AI content 预览:", content.slice(0, 500));

    let parsed: AiPayload;
    try {
      const rawJson = extractJson(content);
      parsed = validatePayload(rawJson);
    } catch (aiParseError) {
      console.error("[POST /api/chat] AI 内容 JSON 解析/校验失败:", aiParseError);
      throw aiParseError;
    }

    const chatResponse: ChatResponse = {
      ...parsed,
      timestamp: new Date().toISOString(),
    };

    console.log("[POST /api/chat] 最终返回:", JSON.stringify(chatResponse));
    console.log("========== [POST /api/chat] 请求成功 ==========");

    return NextResponse.json(chatResponse);
  } catch (error) {
    console.error("========== [POST /api/chat] 请求失败 ==========");
    console.error("[POST /api/chat] 错误类型:", error instanceof Error ? error.constructor.name : typeof error);
    console.error("[POST /api/chat] 错误信息:", error instanceof Error ? error.message : error);
    if (error instanceof Error && error.stack) {
      console.error("[POST /api/chat] 错误堆栈:", error.stack);
    }

    return NextResponse.json(
      {
        error: "AI 响应解析失败",
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
