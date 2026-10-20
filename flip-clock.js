export function formatClockParts(value) {
  return ['days', 'hours', 'minutes', 'seconds'].map(key => typeof value[key] === 'number' ? String(value[key]).padStart(2, '0') : '—');
}

export function mountFlipClock(container) {
  const doc = container.ownerDocument;
  const parts = ['days', 'hours', 'minutes', 'seconds'];
  const cells = new Map();
  function makeCell(character) {
    const element = doc.createElement('span'); element.className = 'flip-character';
    const faces = ['flip-top', 'flip-bottom', 'flip-out', 'flip-in'].map(name => {
      const face = doc.createElement('span'); face.className = `flip-face ${name}`; face.textContent = character; element.append(face); return face;
    });
    return { element, faces, value: character, timeout: null };
  }
  return {
    update(value, animate = true) {
      const formatted = formatClockParts(value);
      parts.forEach((key, partIndex) => {
        const root = container.querySelector(`#${key}`);
        root.setAttribute('aria-hidden', 'true');
        let row = cells.get(key);
        const characters = [...formatted[partIndex]];
        if (!row || row.length !== characters.length) {
          row?.forEach(cell => clearTimeout(cell.timeout));
          row = characters.map(makeCell); cells.set(key, row); root.replaceChildren(...row.map(cell => cell.element));
          return;
        }
        row.forEach((cell, index) => {
          const next = characters[index];
          if (next === cell.value) return;
          clearTimeout(cell.timeout); cell.element.classList.remove('is-flipping');
          const previous = cell.value; cell.value = next;
          if (!animate || doc.hidden || doc.defaultView.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            cell.faces.forEach(face => { face.textContent = next; }); return;
          }
          cell.faces[0].textContent = next; cell.faces[1].textContent = previous;
          cell.faces[2].textContent = previous; cell.faces[3].textContent = next;
          void cell.element.offsetWidth;
          cell.element.classList.add('is-flipping');
          cell.timeout = setTimeout(() => {
            cell.element.classList.remove('is-flipping'); cell.faces.forEach(face => { face.textContent = next; });
          }, 480);
        });
      });
      container.dataset.dayWidth = formatted[0].length;
      container.setAttribute('aria-label', formatted[0] === '—' ? '正在读取倒计时' : `剩余 ${formatted[0]} 天 ${formatted[1]} 小时 ${formatted[2]} 分 ${formatted[3]} 秒`);
    }
  };
}
