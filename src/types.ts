export type ToolId = 'home' | 'hot' | 'virality' | 'comment' | 'radar';

export interface HotTopic {
  rank: number;
  title: string;
  heat: string;
  answers: string;
  tag: string;
  score: number;
  window: string;
  // 来自知乎 API 的原始字段（可选，静态初始数据无此字段）
  url?: string;
  thumbnailUrl?: string;
  summary?: string;
}

export interface RadarItem {
  status: string;
  score: number;
  title: string;
  stat: string;
  answers: string;
  praise: string;
  color: string;
}

export interface CommentItem {
  id: number;
  avatar: string;
  name: string;
  likes: number;
  body: string;
  valueScore: number;
  valueLabel: string;
  badgeText: string;
  badgeClass: string;
  hasExistingQuestion?: boolean;
  existingUrl?: string;
  /** 原始评论 ID，用于「直接回答」时在该评论下回复（圈子评论 = comment_id；普通评论 = comment token） */
  commentId?: string;
}

export interface ToastItem {
  id: number;
  message: string;
}

export type ViralityMode = 'answer' | 'dual';
