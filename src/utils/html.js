export function escapeHtml(value = '') {
  return String(value).replace(/[&<>'"]/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  })[char]);
}

export function initials(firstName = '', lastName = '') {
  return `${String(firstName).trim().charAt(0)}${String(lastName).trim().charAt(0)}`.toUpperCase() || 'AF';
}
