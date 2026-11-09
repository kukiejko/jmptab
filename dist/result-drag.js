const movableSelector = '.analysis-figure, .metrics';

export function prepareMovableResults(container) {
  container.querySelectorAll(movableSelector).forEach(element => {
    if (element.querySelector(':scope > .result-move-handle')) return;
    const handle = document.createElement('button');
    handle.type = 'button';
    handle.className = 'result-move-handle';
    handle.dataset.moveResult = '';
    handle.setAttribute('aria-label', element.matches('.metrics') ? 'Move statistics' : 'Move graph');
    handle.title = 'Drag to move; double-click to reset position';
    handle.textContent = '✥';
    element.append(handle);
  });
}

export function setupResultDragging(container, onChange) {
  let drag = null;

  container.addEventListener('pointerdown', event => {
    if (event.button !== 0) return;
    const handle = event.target.closest('[data-move-result]');
    const element = handle?.parentElement || event.target.closest('.analysis-figure');
    if (!element || !container.contains(element)) return;
    if (!handle && event.target.closest('button, a, input, select')) return;
    const rect = element.getBoundingClientRect();
    if (!handle && rect.right - event.clientX < 18 && rect.bottom - event.clientY < 18) return;
    drag = {
      element, pointerId: event.pointerId, startX: event.clientX, startY: event.clientY,
      initialX: Number.parseFloat(element.style.getPropertyValue('--move-x')) || 0,
      initialY: Number.parseFloat(element.style.getPropertyValue('--move-y')) || 0,
      rect,
      moved: false
    };
  });

  document.addEventListener('pointermove', event => {
    if (!drag || event.pointerId !== drag.pointerId) return;
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    if (!drag.moved && Math.hypot(dx, dy) < 4) return;
    drag.moved = true;
    event.preventDefault();
    const bounds = container.getBoundingClientRect();
    const baseLeft = drag.rect.left - drag.initialX;
    const baseRight = drag.rect.right - drag.initialX;
    const baseTop = drag.rect.top - drag.initialY;
    const baseBottom = drag.rect.bottom - drag.initialY;
    const nextX = Math.max(bounds.left - baseLeft, Math.min(bounds.right - baseRight, drag.initialX + dx));
    const nextY = Math.max(bounds.top - baseTop, Math.min(bounds.bottom - baseBottom, drag.initialY + dy));
    drag.element.style.setProperty('--move-x', `${Math.round(nextX)}px`);
    drag.element.style.setProperty('--move-y', `${Math.round(nextY)}px`);
  });

  document.addEventListener('pointerup', event => {
    if (!drag || event.pointerId !== drag.pointerId) return;
    if (drag.moved) onChange();
    drag = null;
  });
  document.addEventListener('pointercancel', () => { drag = null; });

  container.addEventListener('dblclick', event => {
    const handle = event.target.closest('[data-move-result]');
    if (!handle || !container.contains(handle)) return;
    handle.parentElement.style.removeProperty('--move-x');
    handle.parentElement.style.removeProperty('--move-y');
    onChange();
  });
}
