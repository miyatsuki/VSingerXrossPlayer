/**
 * 再生数を K/M 形式にフォーマット
 */
export function formatViewCount(count?: number): string {
  if (!count) return "0";
  if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
  if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
  return count.toString();
}

/**
 * 登録者数を K/M 形式にフォーマット
 */
export function formatSubscriberCount(count?: number): string {
  return formatViewCount(count);
}

/**
 * 日付を「X日前」または「YYYY-MM-DD」形式にフォーマット
 */
export function formatPublishedDate(dateString?: string): string {
  if (!dateString) return "不明";

  const date = new Date(dateString);
  const now = new Date();
  const diffTime = Math.abs(now.getTime() - date.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "今日";
  if (diffDays === 1) return "昨日";
  if (diffDays < 7) return `${diffDays}日前`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}週間前`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)}ヶ月前`;

  return date.toLocaleDateString("ja-JP");
}
