/** 清理文件名中的非法字符（Windows 文件名不允许 \ / : * ? " < > |） */
export const sanitizeFileName = (str: string): string => {
  return str.replace(/[\\/:*?"<>|]/g, '').trim();
};

/** 触发浏览器下载 Blob */
export const downloadBlob = (blob: Blob, filename: string): void => {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = sanitizeFileName(filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
};
