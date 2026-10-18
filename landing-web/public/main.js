(() => {
  const STORE = {
    ios: 'https://apps.apple.com/app/id6806729387',
    android: 'https://play.google.com/store/apps/details?id=dev.eastshine.kotonoha',
  };
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const ua = navigator.userAgent;
  // iPadOS 13+ 는 데스크톱 Safari UA 를 쓰므로 터치 지점 수로 가른다.
  const platform = /android/i.test(ua)
    ? 'android'
    : /iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && navigator.maxTouchPoints > 1)
      ? 'ios'
      : null;

  if (platform) {
    document.querySelectorAll('[data-get]').forEach((a) => {
      a.href = STORE[platform];
      a.rel = 'noopener';
    });
    // 내 기기의 스토어 배지를 앞에 둔다.
    document.querySelectorAll(`.stores [data-store="${platform}"]`).forEach((a) => a.parentElement.prepend(a));
  }

  const nav = document.querySelector('[data-nav]');
  const hero = document.querySelector('.hero');
  const onScrollNav = () => {
    nav.classList.toggle('is-solid', window.scrollY > hero.offsetHeight - 72);
  };
  onScrollNav();
  window.addEventListener('scroll', onScrollNav, { passive: true });

  const once = (els, onIn, opts = { threshold: 0.2 }) => {
    if (!('IntersectionObserver' in window)) {
      els.forEach(onIn);
      return;
    }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        io.unobserve(e.target);
        onIn(e.target);
      });
    }, opts);
    els.forEach((el) => io.observe(el));
  };

  once(document.querySelectorAll('.reveal'), (el) => el.classList.add('is-in'), { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
  once(document.querySelectorAll('[data-curve]'), (el) => el.classList.add('is-in'), { threshold: 0.4 });

  // 4주 x 14칸 학습 달력. 최근으로 올수록 진해진다.
  const heat = document.querySelector('[data-heat]');
  if (heat) {
    const levels = '0102012301230123123412341234123413242334234434443444234423443444';
    for (let i = 0; i < 56; i++) {
      const cell = document.createElement('i');
      cell.dataset.l = levels[i] ?? '4';
      cell.style.transitionDelay = `${(i % 14) * 25 + Math.floor(i / 14) * 60}ms`;
      heat.append(cell);
    }
    once([heat], (el) => el.classList.add('is-in'), { threshold: 0.3 });
  }

  once(document.querySelectorAll('[data-count]'), (el) => {
    const target = Number(el.dataset.count);
    if (reduceMotion) return;
    const start = performance.now();
    const step = (t) => {
      const p = Math.min(1, (t - start) / 1200);
      el.textContent = String(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, { threshold: 0.6 });

  const flash = document.querySelector('[data-flash]');
  flash?.addEventListener('click', () => {
    flash.setAttribute('aria-pressed', String(flash.getAttribute('aria-pressed') !== 'true'));
  });

  const tilt = document.querySelector('[data-tilt]');
  if (tilt && !reduceMotion && window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
    const inner = tilt.querySelector('.reward__inner');
    const art = tilt.querySelector('.reward__art');
    tilt.addEventListener('pointermove', (e) => {
      const r = tilt.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5;
      const y = (e.clientY - r.top) / r.height - 0.5;
      inner.style.setProperty('--rx', `${(-y * 10).toFixed(2)}deg`);
      inner.style.setProperty('--ry', `${(x * 12).toFixed(2)}deg`);
      art.style.setProperty('--sx', `${(50 - x * 100).toFixed(1)}%`);
    });
    tilt.addEventListener('pointerleave', () => {
      inner.style.removeProperty('--rx');
      inner.style.removeProperty('--ry');
      art.style.removeProperty('--sx');
    });
  }

  // 스크롤에 맞춰 문장이 한 단어씩 밝아진다.
  const scrub = document.querySelector('[data-scrub]');
  if (scrub && !reduceMotion) {
    const words = scrub.textContent.trim().split(/\s+/);
    scrub.textContent = '';
    const spans = words.map((w, i) => {
      const s = document.createElement('span');
      s.className = /노래|문맥/.test(w) ? 'w is-key' : 'w';
      s.textContent = w;
      scrub.append(s, i < words.length - 1 ? ' ' : '');
      return s;
    });
    let ticking = false;
    const update = () => {
      ticking = false;
      const r = scrub.getBoundingClientRect();
      const vh = window.innerHeight;
      const p = Math.min(1, Math.max(0, (vh * 0.8 - r.top) / (r.height + vh * 0.3)));
      const lit = Math.round(p * spans.length);
      spans.forEach((s, i) => s.classList.toggle('is-on', i < lit));
    };
    const onScroll = () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(update);
      }
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
  }

  initPlayer();

  function initPlayer() {
    const root = document.querySelector('[data-player]');
    if (!root) return;
    // 화면용 창작 가사. 실제 곡이 아니다. [단어, 품사, 후리가나, 뜻]
    const LINES = [
      { ko: '토오이 마치노 아카리', tr: '먼 거리의 불빛', seg: [['遠い', 'adj', 'とおい', '먼'], ['街', 'noun', 'まち', '거리'], ['の'], ['灯り', 'noun', 'あかり', '불빛']] },
      {
        ko: '요조라니 호시가 히토츠', tr: '밤하늘에 별이 하나', seg: [['夜空', 'noun', 'よぞら', '밤하늘'], ['に'], ['星', 'noun', 'ほし', '별'], ['が'], ['ひとつ', 'noun', null, '하나']],
        pick: { at: 2, ko: '호시', tags: '명사 · N5', mean: '별, 별빛', rate: 2, done: '10분 뒤에 다시 만나요' },
      },
      { ko: '시즈카나 요루노 카제', tr: '고요한 밤바람', seg: [['静かな', 'adj', 'しずかな', '고요한'], ['夜', 'noun', 'よる', '밤'], ['の'], ['風', 'noun', 'かぜ', '바람']] },
      {
        ko: '키미노 코에오 사가시테', tr: '너의 목소리를 찾아서', seg: [['君', 'noun', 'きみ', '너'], ['の'], ['声', 'noun', 'こえ', '목소리'], ['を'], ['探して', 'verb', 'さがして', '찾다']],
        pick: { at: 4, word: '探す', ko: '사가스', tags: '동사 · N5', mean: '찾다', rate: 3, done: '4일 뒤에 다시 만나요' },
      },
      { ko: '아시타에 아루키다스', tr: '내일을 향해 걸어 나가', seg: [['明日', 'noun', 'あした', '내일'], ['へ'], ['歩き出す', 'verb', 'あるきだす', '걸어 나가다']] },
      {
        ko: '코토바와 하나니 나루', tr: '말은 꽃이 되어', seg: [['言葉', 'noun', 'ことば', '말'], ['は'], ['花', 'noun', 'はな', '꽃'], ['に'], ['なる', 'verb', null, '되다']],
        pick: { at: 0, ko: '코토바', tags: '명사 · N4', mean: '말, 언어', rate: 2, done: '10분 뒤에 다시 만나요' },
      },
    ];
    const N = LINES.length;
    const list = root.querySelector('[data-lyrics]');
    const sheet = root.querySelector('[data-sheet]');
    const rates = root.querySelector('[data-sheet-rates]');
    const progress = root.querySelector('[data-progress]');
    const sheetEl = (k) => root.querySelector(`[data-sheet-${k}]`);

    const el = (tag, cls, text) => {
      const n = document.createElement(tag);
      if (cls) n.className = cls;
      if (text != null) n.textContent = text;
      return n;
    };
    // 끝에서 처음으로 이음매 없이 돌리려고 두 벌 그리고, 첫 줄 위에도 마지막 줄을 하나 둔다.
    [LINES[N - 1], ...LINES, ...LINES].forEach((line) => {
      const li = el('li', 'lyric');
      const ja = el('span', 'lyric__ja');
      ja.lang = 'ja';
      line.seg.forEach(([text, pos, furi, mean]) => {
        const tok = el('span', pos ? `tok tok--${pos}` : 'tok tok--muted');
        tok.append(el('span', 'tok__furi', furi ?? '\u00a0'), el('span', 'tok__word', text), el('span', 'tok__mean', mean ?? '\u00a0'));
        tok.lastChild.lang = 'ko';
        ja.append(tok);
      });
      li.append(ja, el('span', 'lyric__ko', line.ko), el('span', 'lyric__tr', line.tr));
      list.append(li);
    });
    const items = [...list.children];

    let step = 0;
    const measure = () => {
      const a = items.find((li) => !li.classList.contains('is-active'));
      const b = a.nextElementSibling;
      step = b.offsetTop - a.offsetTop;
    };
    measure();

    let index = 0;
    let timer = 0;
    let running = false;

    const place = (i, instant) => {
      if (instant) list.classList.add('no-anim');
      items.forEach((li, k) => li.classList.toggle('is-active', k === i + 1));
      list.style.transform = `translateY(${-i * step}px)`;
      progress.style.width = `${((i % N) / N) * 100 + 8}%`;
      if (instant) {
        void list.offsetHeight;
        list.classList.remove('no-anim');
      }
    };
    const later = (ms, fn) => {
      timer = window.setTimeout(() => running && fn(), ms);
    };
    const closeSheet = () => {
      sheet.classList.remove('is-open');
      list.querySelectorAll('.is-picked').forEach((t) => t.classList.remove('is-picked'));
    };

    // 단어를 누르면 그 단어부터 복습이 열리고, 평가하는 순간 그 단어가 곡에 담긴다.
    const tick = () => {
      const line = LINES[index % N];
      const pick = line.pick;
      if (!pick) {
        later(2600, advance);
        return;
      }
      const tok = items[index + 1].querySelectorAll('.tok')[pick.at];
      later(1000, () => {
        tok.classList.add('is-picked');
        sheetEl('word').textContent = pick.word ?? line.seg[pick.at][0];
        sheetEl('ko').textContent = pick.ko;
        sheetEl('tags').textContent = pick.tags;
        sheetEl('meaning').textContent = pick.mean;
        sheetEl('done').textContent = pick.done;
        rates.dataset.picked = '';
        rates.classList.remove('is-done');
        sheet.classList.add('is-open');
        later(1600, () => {
          rates.dataset.picked = pick.rate;
          rates.classList.add('is-done');
          later(1400, () => {
            closeSheet();
            later(700, advance);
          });
        });
      });
    };
    const advance = () => {
      index += 1;
      place(index);
      if (index === N) {
        // 두 번째 벌의 첫 줄과 첫 벌의 첫 줄은 똑같이 보인다. 전환이 끝나면 몰래 되감는다.
        later(800, () => {
          index = 0;
          place(0, true);
          tick();
        });
        return;
      }
      tick();
    };

    place(0, true);
    document.fonts?.ready.then(() => {
      measure();
      place(index, true);
    });
    if (reduceMotion) return;

    const start = () => {
      if (running) return;
      running = true;
      if (index >= N) {
        index = 0;
        place(0, true);
      }
      tick();
    };
    const stop = () => {
      running = false;
      window.clearTimeout(timer);
      closeSheet();
    };
    let visible = true;
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(([e]) => {
        visible = e.isIntersecting;
        visible && !document.hidden ? start() : stop();
      }).observe(root);
    } else {
      start();
    }
    document.addEventListener('visibilitychange', () => (document.hidden || !visible ? stop() : start()));
    window.addEventListener('resize', () => {
      measure();
      place(index, true);
    });
  }
})();
