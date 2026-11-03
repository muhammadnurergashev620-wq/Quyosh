import type { PointerEvent as ReactPointerEvent } from 'react';

/** Kartochka sichqoncha tomon engashadi (3D tilt) va yorug‘lik dog‘i ergashadi. CSS o‘zgaruvchilari orqali. */
export const tiltHandlers = {
  onPointerMove(event: ReactPointerEvent<HTMLElement>) {
    if (event.pointerType !== 'mouse') return;
    const el = event.currentTarget;
    const rect = el.getBoundingClientRect();
    const px = (event.clientX - rect.left) / rect.width;
    const py = (event.clientY - rect.top) / rect.height;
    el.style.setProperty('--rx', `${((0.5 - py) * 9).toFixed(2)}deg`);
    el.style.setProperty('--ry', `${((px - 0.5) * 11).toFixed(2)}deg`);
    el.style.setProperty('--gx', `${(px * 100).toFixed(1)}%`);
    el.style.setProperty('--gy', `${(py * 100).toFixed(1)}%`);
  },
  onPointerLeave(event: ReactPointerEvent<HTMLElement>) {
    const el = event.currentTarget;
    el.style.setProperty('--rx', '0deg');
    el.style.setProperty('--ry', '0deg');
  },
};

/** Tugma sichqonchaga «magnit»dek tortiladi. */
export const magneticHandlers = {
  onPointerMove(event: ReactPointerEvent<HTMLElement>) {
    if (event.pointerType !== 'mouse') return;
    const el = event.currentTarget;
    const rect = el.getBoundingClientRect();
    const dx = event.clientX - (rect.left + rect.width / 2);
    const dy = event.clientY - (rect.top + rect.height / 2);
    el.style.transform = `translate(${(dx * 0.22).toFixed(1)}px, ${(dy * 0.3).toFixed(1)}px)`;
  },
  onPointerLeave(event: ReactPointerEvent<HTMLElement>) {
    event.currentTarget.style.transform = '';
  },
};
