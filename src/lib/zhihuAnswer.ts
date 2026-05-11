/**
 * 知乎回答与评论发布 API
 * 适用于：热榜蹭词器、评论区截流器
 *
 * 接口预留：待接入知乎回答 Open API 后填充实现。
 * 当前实现仅模拟成功响应，不实际调用网络接口。
 */

/**
 * 创建知乎新问题（双预测模式「创建新问题并回答」第一步）
 *
 * @param title   问题标题
 * @param detail  问题描述（可选）
 * @returns       问题 ID（预留，当前返回空字符串）
 *
 * TODO: 接入知乎 Open API
 * POST /openapi/question/create  { title, detail }
 * Headers: X-App-Key / X-Sign / X-Timestamp / X-Log-Id
 */
export async function publishQuestion(title: string, detail?: string): Promise<string> {
  // eslint-disable-next-line no-console
  console.info('[zhihuAnswer] publishQuestion (stub)', { title, detailLen: detail?.length ?? 0 });

  // TODO: 替换为真实 API 调用
  // const res = await fetch('/zhihu-api/openapi/question/create', {
  //   method: 'POST',
  //   headers: { ...buildAuthHeaders(), 'Content-Type': 'application/json' },
  //   body: JSON.stringify({ title, detail }),
  // });
  // if (!res.ok) throw new Error(`Question API HTTP ${res.status}`);
  // const json = await res.json();
  // if (json.status !== 0) throw new Error(`Question API: ${json.msg}`);
  // return json.data?.question_id ?? '';

  await new Promise(resolve => setTimeout(resolve, 300));
  return '';
}

/**
 * 发布知乎回答（热榜蹭词器 / 评论区截流器「直接回答」，或双预测第二步）
 *
 * @param questionTitle 问题标题或 questionId（有 ID 时优先用 ID 定位）
 * @param content       回答正文
 * @returns             发布后的回答 ID（预留，当前返回空字符串）
 *
 * TODO: 接入知乎 Open API
 * POST /openapi/answer/publish  { question_id, content }
 * Headers: X-App-Key / X-Sign / X-Timestamp / X-Log-Id
 */
export async function publishAnswer(questionTitle: string, content: string): Promise<string> {
  // eslint-disable-next-line no-console
  console.info('[zhihuAnswer] publishAnswer (stub)', { questionTitle, contentLen: content.length });

  // TODO: 替换为真实 API 调用
  // const res = await fetch('/zhihu-api/openapi/answer/publish', {
  //   method: 'POST',
  //   headers: { ...buildAuthHeaders(), 'Content-Type': 'application/json' },
  //   body: JSON.stringify({ question_title: questionTitle, content }),
  // });
  // if (!res.ok) throw new Error(`Answer API HTTP ${res.status}`);
  // const json = await res.json();
  // if (json.status !== 0) throw new Error(`Answer API: ${json.msg}`);
  // return json.data?.answer_id ?? '';

  await new Promise(resolve => setTimeout(resolve, 300)); // 模拟网络延迟
  return '';
}

/**
 * 在知乎回答下发布评论（热榜 / 截流器跳转后的二次互动）
 *
 * @param answerId  回答 ID（预留，暂时可传 null）
 * @param content   评论内容
 * @returns         评论 ID（预留，当前返回 0）
 *
 * TODO: 接入知乎 Open API
 * POST /openapi/comment/create  { content_token, content_type: 'answer', content }
 */
export async function publishAnswerComment(answerId: string | null, content: string): Promise<number> {
  // eslint-disable-next-line no-console
  console.info('[zhihuAnswer] publishAnswerComment (stub)', { answerId, contentLen: content.length });

  // TODO: 替换为真实 API 调用
  // const res = await fetch('/zhihu-api/openapi/comment/create', {
  //   method: 'POST',
  //   headers: { ...buildAuthHeaders(), 'Content-Type': 'application/json' },
  //   body: JSON.stringify({ content_token: answerId, content_type: 'answer', content }),
  // });
  // if (!res.ok) throw new Error(`Answer Comment API HTTP ${res.status}`);
  // const json = await res.json();
  // const flag = json.status ?? json.code;
  // if (flag !== 0) throw new Error(`Answer Comment API: ${json.msg}`);
  // return json.data?.comment_id ?? 0;

  await new Promise(resolve => setTimeout(resolve, 300));
  return 0;
}
