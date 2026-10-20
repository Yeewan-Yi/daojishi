// A semicircle maps elapsed time directly to distance along the flight path.
export function flightPosition(progress) {
  const fraction = Math.max(0, Math.min(100, Number.isFinite(progress) ? progress : 0)) / 100;
  const angle = Math.PI * fraction;
  return { x: 400 - 285 * Math.cos(angle), y: 370 - 285 * Math.sin(angle), heading: fraction * 180 - 90, progress: fraction * 100 };
}

export function flightStage(phase, progress) {
  if (phase === 'upcoming') return { title: '等待启程', detail: '飞机停在起点，等待故事开始', status: '等待起飞' };
  if (phase === 'ended') return { title: '终于，抵达期待', detail: '这一段旅程，已经完整走过', status: '已抵达' };
  if (progress < 1) return { title: '旅程刚刚开始', detail: '从此刻起，每一秒都更近一点', status: '刚刚启程' };
  if (progress < 25) return { title: '已启程，向着期待', detail: '起点渐远，目的地渐近', status: '飞行中' };
  if (progress < 50) return { title: '飞向下一段期待', detail: '沿着时间的航线，慢慢靠近', status: '飞行中' };
  if (progress < 75) return { title: '已经飞过半程', detail: '走过的路，已经比剩下的更长', status: '飞行中' };
  if (progress < 95) return { title: '目的地越来越近', detail: '大部分等待，已在身后', status: '接近目的地' };
  return { title: '即将抵达', detail: '再等一小会儿，美好就要降落', status: '准备降落' };
}

export function flightMarkup(prefix = 'journey') {
  if (!/^[a-z0-9-]+$/.test(prefix)) throw new Error('Invalid flight namespace');
  return `<svg class="flight-svg" viewBox="0 0 800 448" role="img" aria-label="飞行进度，等待时间数据">
    <defs>
      <clipPath id="${prefix}-earth-clip"><path d="M170 370 A230 230 0 0 1 630 370 Z"/></clipPath>
      <radialGradient id="${prefix}-earth-shade" cx="40%" cy="15%" r="95%"><stop offset="0" stop-color="var(--earth-glow)"/><stop offset="1" stop-color="var(--earth-base)"/></radialGradient>
      <linearGradient id="${prefix}-earth-fade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--surface)" stop-opacity="0"/><stop offset=".68" stop-color="var(--surface)" stop-opacity="0"/><stop offset="1" stop-color="var(--surface)" stop-opacity=".93"/></linearGradient>
    </defs>
    <g class="sky-sparks" aria-hidden="true"><path d="M175 132v10m-5-5h10M632 134v7m-3.5-3.5h7"/><circle cx="274" cy="67" r="2"/><circle cx="555" cy="55" r="1.8"/><circle cx="98" cy="248" r="2"/><circle cx="704" cy="230" r="2"/></g>
    <path class="atmosphere" d="M157 370 A243 243 0 0 1 643 370"/>
    <path class="earth-body" fill="url(#${prefix}-earth-shade)" d="M170 370 A230 230 0 0 1 630 370 Z"/>
    <g clip-path="url(#${prefix}-earth-clip)">
      <g class="earth-land" aria-hidden="true">
        <path d="M185 217 208 196 222 199 238 181 256 179 268 165 293 163 306 175 303 190 321 193 333 207 326 223 309 226 301 241 286 241 277 252 263 249 254 265 239 265 236 246 215 244 207 232 187 233Z"/>
        <path d="M269 272 289 266 302 279 320 284 322 302 334 317 326 333 316 336 312 356 296 378 288 359 286 338 273 323 277 303 265 288Z"/>
        <path d="M354 160 375 150 390 155 398 170 387 182 370 180Z"/>
        <path d="M399 199 414 188 430 193 433 208 450 207 455 218 442 232 450 243 463 249 469 268 458 287 446 311 430 325 418 311 415 291 401 277 398 255 383 248 383 228 396 220Z"/>
        <path d="M441 180 463 164 483 170 501 161 523 174 540 172 552 187 570 193 576 209 594 217 608 236 593 248 573 244 565 254 549 248 540 265 524 263 518 247 507 245 499 229 480 235 469 220 451 215 451 200 438 192Z"/>
        <path d="M525 277 537 284 540 299 552 304 547 315 534 309 527 294Z M570 310 589 299 608 309 617 327 604 340 582 336 566 325Z"/>
      </g>
      <g class="earth-grid" aria-hidden="true"><ellipse cx="400" cy="370" rx="76" ry="230"/><ellipse cx="400" cy="370" rx="156" ry="230"/><path d="M400 140V370M182 298 Q400 258 618 298M205 247 Q400 190 595 247M252 195 Q400 148 548 195"/></g>
      <path fill="url(#${prefix}-earth-fade)" d="M170 140H630V371H170Z"/>
    </g>
    <path class="earth-edge" d="M170 370 A230 230 0 0 1 630 370"/>
    <path class="earth-horizon" d="M155 371H645"/>
    <path class="route-future" d="M115 370 A285 285 0 0 1 685 370" pathLength="100"/>
    <path class="route-past" data-flight="trail" d="M115 370 A285 285 0 0 1 685 370" pathLength="100" stroke-dasharray="0 100"/>
    <g class="route-milestones" aria-hidden="true"><circle data-milestone="25" cx="198.475" cy="168.475" r="4"/><circle data-milestone="50" cx="400" cy="85" r="4"/><circle data-milestone="75" cx="601.525" cy="168.475" r="4"/></g>
    <g class="route-airports" aria-hidden="true"><circle class="departure-ring" cx="115" cy="370" r="8"/><circle class="departure-dot" cx="115" cy="370" r="3"/><circle class="arrival-ring" data-flight="destination" cx="685" cy="370" r="8"/><circle class="arrival-dot" cx="685" cy="370" r="3"/></g>
    <g class="flight-plane" data-flight="plane" transform="translate(115 370) rotate(-90)" aria-hidden="true"><circle class="plane-halo" r="28"/><path class="plane-shape" d="M24 0 8-4-5-22-10-22-3-4-17-4-23-11-27-11-23 0-27 11-23 11-17 4-3 4-10 22-5 22 8 4Z"/></g>
    <g class="flight-position-label" data-flight="position-label" transform="translate(115 328)"><rect x="-46" y="-13" width="92" height="26" rx="13"/><text data-flight="position-text" text-anchor="middle" dominant-baseline="central">等待启程</text></g>
    <g class="flight-message"><text class="flight-message-eyebrow" x="400" y="286" text-anchor="middle">A LITTLE CLOSER</text><text class="flight-stage" data-flight="stage" x="400" y="321" text-anchor="middle">旅程刚刚开始</text><text class="flight-detail" data-flight="detail" x="400" y="347" text-anchor="middle">每一秒，都更近一点</text></g>
    <g class="airport-labels"><text x="115" y="409" text-anchor="middle">启程</text><text class="airport-date" data-flight="start-date" x="115" y="430" text-anchor="middle">START</text><text x="685" y="409" text-anchor="middle">抵达</text><text class="airport-date" data-flight="end-date" x="685" y="430" text-anchor="middle">DESTINATION</text></g>
  </svg>`;
}

export function mountFlight(container, prefix) {
  container.innerHTML = flightMarkup(prefix);
  const find = name => container.querySelector(`[data-flight="${name}"]`);
  const svg = container.querySelector('svg');
  const date = new Intl.DateTimeFormat('zh-CN', { month: '2-digit', day: '2-digit' });
  return {
    update(value, countdown) {
      const point = flightPosition(value.progress), stage = flightStage(value.phase, point.progress);
      const percent = point.progress.toFixed(1);
      container.dataset.phase = value.phase;
      svg.setAttribute('aria-label', `${stage.title}，航程已完成 ${percent}%，剩余 ${(100 - point.progress).toFixed(1)}%`);
      find('trail').setAttribute('stroke-dasharray', `${point.progress} 100`);
      find('plane').setAttribute('transform', `translate(${point.x.toFixed(3)} ${point.y.toFixed(3)}) rotate(${point.heading.toFixed(3)})`);
      find('position-label').setAttribute('transform', `translate(${point.x.toFixed(3)} ${(point.y - 42).toFixed(3)})`);
      find('position-text').textContent = value.phase === 'upcoming' ? '等待起飞' : value.phase === 'ended' ? '已抵达' : `已飞行 ${percent}%`;
      find('stage').textContent = stage.title;
      find('detail').textContent = stage.detail;
      find('start-date').textContent = date.format(new Date(countdown.start));
      find('end-date').textContent = date.format(new Date(countdown.end));
      find('destination').classList.toggle('has-arrived', value.phase === 'ended');
      container.querySelectorAll('[data-milestone]').forEach(node => node.classList.toggle('is-passed', point.progress >= Number(node.dataset.milestone)));
    },
    pending() {
      container.dataset.phase = 'pending';
      svg.setAttribute('aria-label', '尚未读取航程数据');
      find('stage').textContent = '等待航程数据';
      find('detail').textContent = '连接成功后，航线将显示真实进度';
      find('position-text').textContent = '等待连接';
    }
  };
}
