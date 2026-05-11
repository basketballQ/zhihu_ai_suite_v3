import type { CommentItem } from '../types';

export const initialComments: CommentItem[] = [
  {
    id: 1,
    avatar: 'L',
    name: 'LemonadeSky',
    likes: 943,          // 价值最高 但点赞第三
    body: '那针对已经工作了 5 年的传统行业从业者，想转型做 AI 产品，需要补哪些知识？有没有系统的学习路径？',
    valueScore: 92,
    valueLabel: '截流价值 92分',
    badgeText: '知乎无对应问题',
    badgeClass: 'badge-blue',
    hasExistingQuestion: false,
  },
  {
    id: 2,
    avatar: 'M',
    name: 'MiguelHernandez',
    likes: 3218,         // 价值居中 但点赞第一
    body: '楼主提到的「渐进式侵入」，能不能举几个具体的例子？最好是普通人能感受到的场景',
    valueScore: 85,
    valueLabel: '截流价值 85分',
    badgeText: '相关问题回答少',
    badgeClass: 'badge-up',
    hasExistingQuestion: false,
  },
  {
    id: 3,
    avatar: '橙',
    name: '橙子不甜',
    likes: 1876,         // 价值最低 但点赞第二
    body: '在医疗和教育领域，AI 现在进展到哪一步了？有没有数据支撑？',
    valueScore: 71,
    valueLabel: '截流价值 71分',
    badgeText: '已有相关问题',
    badgeClass: '',
    hasExistingQuestion: true,
    existingUrl: 'https://www.zhihu.com/question/641829834',
  },
];
