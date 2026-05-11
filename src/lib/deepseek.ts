const BASE_URL = 'https://api.deepseek.com/v1';

export function getApiKey(): string {
  return (import.meta.env.VITE_DEEPSEEK_API_KEY as string | undefined) ?? '';
}

export function hasApiKey(): boolean {
  const k = getApiKey();
  return !!k && k !== 'your_api_key_here';
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatOptions {
  temperature?: number;
  maxTokens?: number;
  /** 要求模型返回 JSON 对象 */
  json?: boolean;
  /** 流式传输时每次收到新 content token 的回调 */
  onChunk?: (delta: string, accumulated: string) => void;
}

/**
 * 统一使用流式传输，避免推理模型长时间等待导致超时。
 * 自动跳过 reasoning_content，只累积最终 content。
 */
export async function chat(
  messages: ChatMessage[],
  opts: ChatOptions = {},
): Promise<string> {
  const key = getApiKey();
  if (!key || key === 'your_api_key_here') {
    throw new Error('NO_API_KEY');
  }

  const res = await fetch(`${BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: 'deepseek-v4-pro',
      messages,
      temperature: opts.temperature ?? 0.7,
      max_tokens: opts.maxTokens ?? 4000,
      stream: true,
      ...(opts.json ? { response_format: { type: 'json_object' } } : {}),
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`DeepSeek API ${res.status}: ${text}`);
  }

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let content = '';
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // SSE 按换行分割处理
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? ''; // 保留末尾不完整的行

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data: ')) continue;
        const data = trimmed.slice(6);
        if (data === '[DONE]') continue;

        try {
          const parsed = JSON.parse(data) as {
            choices: Array<{
              delta: { content?: string; reasoning_content?: string };
              finish_reason: string | null;
            }>;
          };
          const delta = parsed.choices[0]?.delta?.content ?? '';
          if (delta) {
            content += delta;
            opts.onChunk?.(delta, content);
          }
        } catch {
          // 跳过解析失败的行
        }
      }
    }
  } finally {
    reader.cancel().catch(() => {});
  }

  return content;
}
