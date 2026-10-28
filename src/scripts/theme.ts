const KEY = 'sismos-theme';

const isDark = () => {
  const t = document.documentElement.dataset.theme;
  return t ? t === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
};

document.getElementById('themebtn')?.addEventListener('click', () => {
  const next = isDark() ? 'light' : 'dark';
  document.documentElement.dataset.theme = next;
  try {
    localStorage.setItem(KEY, next);
  } catch {
    /* private mode: theme just isn't remembered */
  }
  dispatchEvent(new Event('themechange'));
});
