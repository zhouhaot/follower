import { recoverLegacy } from './collection-store-v2.mjs';

export function collectionFailureMessage(reason) {
  return ({
    conflict: '花册已在其他页面变化，请刷新后重试。',
    'recovery-required': '当前显示的是旧版历史，请先恢复后再修改收藏。',
    'recovery-backup-exists': '已有另一份恢复备份，为保护它，本次恢复未执行。请先联系维护人员导出检查。',
    'recovery-unavailable': '当前没有可恢复的旧版历史，请刷新检查。',
    'unsupported-version': '花册版本暂不支持，请使用匹配版本的应用。原数据已保留。',
    'catalogue-mismatch': '花册与当前花卡目录不匹配，原数据已保留。',
    'file-too-large': '花册内容超过当前容量限制，未保存本次修改。',
  })[reason] || '花册未能保存，请检查浏览器存储权限或可用空间后重试。';
}

export function renderCollectionNotice(root, state) {
  if (!root) return;
  root.replaceChildren();
  root.hidden = state.kind === 'ready';
  if (root.hidden) return;
  root.className = 'collection-notice';
  root.setAttribute('role', 'status');
  const title = document.createElement('strong');
  const message = document.createElement('p');
  title.textContent = state.kind === 'legacy-preview' ? '当前仅显示旧版历史' : '暂时无法读取花册';
  message.textContent = state.kind === 'legacy-preview'
    ? '当前花册无法读取或迁移未完成，收藏修改已暂停。恢复将先保留现有异常数据，再启用旧版历史；旧版不包含后来的收藏和浏览记录。'
    : ['unsupported-version', 'catalogue-mismatch'].includes(state.code)
      ? collectionFailureMessage(state.code)
      : '原始数据已保留。请检查浏览器存储权限，或联系维护人员导出检查；不要清除浏览器数据。';
  root.append(title, message);
  if (state.recoverable) {
    const recover = document.createElement('button');
    recover.type = 'button';
    recover.textContent = '恢复旧版历史';
    recover.addEventListener('click', () => {
      if (!confirm('将先备份现有异常数据，再使用旧版历史恢复花册。旧版不包含后来的收藏和浏览记录。继续恢复？')) return;
      const result = recoverLegacy();
      if (result.saved) location.reload();
      else message.textContent = collectionFailureMessage(result.reason);
    });
    root.append(recover);
  }
  const retry = document.createElement('button');
  retry.type = 'button';
  retry.textContent = '重新读取';
  retry.addEventListener('click', () => location.reload());
  root.append(retry);
}
