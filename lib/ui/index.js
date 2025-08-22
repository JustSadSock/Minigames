// UI utilities for DeepFly
// Includes simple toast/flash notifications.

// Shows a toast message for a short duration.
export function flash(message, duration = 2200) {
  const el = document.createElement('div');
  el.textContent = message;
  el.style.cssText = `position:fixed;left:50%;top:24px;transform:translateX(-50%);` +
    `background:#151938;border:1px solid #2b2f54;color:#e6ebff;` +
    `padding:8px 12px;border-radius:12px;z-index:9999;font-size:12px;opacity:0;` +
    `transition:opacity .15s ease, transform .2s ease;`;
  document.body.appendChild(el);
  requestAnimationFrame(() => {
    el.style.opacity = '1';
    el.style.transform = 'translateX(-50%) translateY(0)';
  });
  setTimeout(() => {
    el.style.opacity = '0';
    el.style.transform = 'translateX(-50%) translateY(-8px)';
  }, duration);
  setTimeout(() => {
    if (el.parentNode) el.parentNode.removeChild(el);
  }, duration + 600);
}