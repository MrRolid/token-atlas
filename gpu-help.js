// Collapse the fallback explanation once, without overriding a user's choice.
export function installGPUHelp(panel, details, summary) {
  let timer = null, automaticDone = false, userChose = false;
  const cancel = () => { if (timer !== null) clearTimeout(timer); timer = null; };
  const sync = () => {
    cancel();
    if (!panel.hidden && !automaticDone && !userChose && details.open) {
      timer = setTimeout(() => {
        timer = null;
        if (!panel.hidden && !userChose) details.open = false;
        automaticDone = true;
      }, 10000);
    }
  };
  // Native summary supports mouse, touch, Enter and Space.
  summary.addEventListener('click', () => { userChose = true; cancel(); });
  const observer = new MutationObserver(sync);
  observer.observe(panel, {attributes: true, attributeFilter: ['hidden']});
  sync();
  return () => { cancel(); observer.disconnect(); };
}
