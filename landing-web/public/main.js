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

  // 앱 학습 달력 한 달. 10월 1일이 목요일이고, 오늘(18일)까지 23일 연속 중 9일은 프리즈로 이었다.
  const heat = document.querySelector('[data-heat]');
  if (heat) {
    const FIRST_WEEKDAY = 3;
    const TODAY = 18;
    const FREEZE = 9;
    const levels = '232134201243212343';
    for (let i = 0; i < FIRST_WEEKDAY; i++) heat.append(document.createElement('span'));
    for (let day = 1; day <= 31; day++) {
      const slot = document.createElement('span');
      const chip = document.createElement('i');
      chip.textContent = String(day);
      if (day > TODAY) {
        chip.className = 'is-future';
      } else {
        slot.className = day === TODAY ? 'in-run run-end' : 'in-run';
        if (day === FREEZE) chip.className = 'is-freeze';
        else chip.dataset.l = levels[day - 1] === '0' ? '1' : levels[day - 1];
        if (day === TODAY) chip.classList.add('is-today');
      }
      chip.style.transitionDelay = `${day * 22}ms`;
      slot.append(chip);
      heat.append(slot);
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
        pick: { at: 2, ko: '호시', pos: 'noun', jlpt: 'N5', mean: '별', rate: 'good' },
      },
      { ko: '시즈카나 요루노 카제', tr: '고요한 밤바람', seg: [['静かな', 'adj', 'しずかな', '고요한'], ['夜', 'noun', 'よる', '밤'], ['の'], ['風', 'noun', 'かぜ', '바람']] },
      {
        ko: '키미노 코에오 사가시테', tr: '너의 목소리를 찾아서', seg: [['君', 'noun', 'きみ', '너'], ['の'], ['声', 'noun', 'こえ', '목소리'], ['を'], ['探して', 'verb', 'さがして', '찾다']],
        pick: { at: 4, word: '探す', ko: '사가스', pos: 'verb', jlpt: 'N5', mean: '찾다', rate: 'easy' },
      },
      { ko: '아시타에 아루키다스', tr: '내일을 향해 걸어 나가', seg: [['明日', 'noun', 'あした', '내일'], ['へ'], ['歩き出す', 'verb', 'あるきだす', '걸어 나가다']] },
      {
        ko: '코토바와 하나니 나루', tr: '말은 꽃이 되어', seg: [['言葉', 'noun', 'ことば', '말'], ['は'], ['花', 'noun', 'はな', '꽃'], ['に'], ['なる', 'verb', null, '되다']],
        pick: { at: 0, ko: '코토바', pos: 'noun', jlpt: 'N4', mean: '말, 언어', rate: 'good' },
      },
    ];
    const POS = { noun: ['명사', '#368ee8'], verb: ['동사', '#299e67'] };
    const JLPT = { N5: '#5388f3', N4: '#2a9b8d' };
    const RATE = { good: ['#16b364', '10분 뒤에 다시 만나요'], easy: ['#3b82f6', '4일 뒤에 다시 만나요'] };
    // 앱 다이얼처럼 포커스에서 멀어질수록 흐려진다.
    const DISTANCE_OPACITY = [1, 0.44, 0.3, 0.23, 0.18, 0.15, 0.13];
    const FOCUS_CENTER_RATIO = 0.38;
    const N = LINES.length;
    const list = root.querySelector('[data-lyrics]');
    const dial = list.parentElement;
    const review = root.querySelector('[data-review]');
    const rates = root.querySelector('[data-rv-rates]');
    const time = root.querySelector('[data-time]');
    const rv = (k) => root.querySelectorAll(`[data-rv-${k}]`);

    const el = (tag, cls, text) => {
      const n = document.createElement(tag);
      if (cls) n.className = cls;
      if (text != null) n.textContent = text;
      return n;
    };
    // 끝에서 처음으로 이음매 없이 돌리려고 두 벌 그리고, 첫 줄 위에도 마지막 줄을 하나 둔다.
    [LINES[N - 1], ...LINES, ...LINES].forEach((line) => {
      const li = el('li', 'line');
      li.lang = 'ja';
      li.append(el('span', 'line__rest', line.seg.map(([text]) => text).join('')));
      const focus = el('div', 'line__focus');
      const ja = el('span', 'line__ja');
      line.seg.forEach(([text, pos, furi, mean]) => {
        const tok = el('span', pos ? `tok tok--${pos}` : 'tok tok--muted');
        const meaning = el('span', 'tok__mean', mean ?? ' ');
        meaning.lang = 'ko';
        tok.append(el('span', 'tok__furi', furi ?? ' '), el('span', 'tok__word', text), el('span', 'tok__bar'), meaning);
        ja.append(tok);
      });
      const ko = el('span', 'line__ko', line.ko);
      const tr = el('span', 'line__tr', line.tr);
      ko.lang = 'ko';
      tr.lang = 'ko';
      focus.append(ja, ko, tr);
      li.append(focus);
      list.append(li);
    });
    const items = [...list.children];

    let index = 0;
    let timer = 0;
    let running = false;

    const place = (i, instant) => {
      if (instant) list.classList.add('no-anim');
      items.forEach((li, k) => {
        li.classList.toggle('is-active', k === i + 1);
        li.style.opacity = DISTANCE_OPACITY[Math.min(Math.abs(k - i - 1), DISTANCE_OPACITY.length - 1)];
      });
      const active = items[i + 1];
      const y = dial.clientHeight * FOCUS_CENTER_RATIO - (active.offsetTop + active.offsetHeight / 2);
      list.style.transform = `translateY(${y}px)`;
      const sec = 12 + (i % N) * 14;
      time.textContent = `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
      if (instant) {
        void list.offsetHeight;
        list.classList.remove('no-anim');
      }
    };
    const later = (ms, fn) => {
      timer = window.setTimeout(() => running && fn(), ms);
    };
    const closeReview = () => {
      review.classList.remove('is-open', 'is-back');
      rates.classList.remove('is-done');
      list.querySelectorAll('.is-picked').forEach((t) => t.classList.remove('is-picked'));
    };

    const fillReview = (line, pick) => {
      const surface = line.seg[pick.at][0];
      const [posLabel, posColor] = POS[pick.pos];
      rv('word').forEach((n) => { n.textContent = pick.word ?? surface; });
      rv('ko')[0].textContent = pick.ko;
      Object.assign(rv('pos')[0], { textContent: posLabel, style: `color:${posColor}` });
      Object.assign(rv('jlpt')[0], { textContent: pick.jlpt, style: `color:${JLPT[pick.jlpt]}` });
      rv('mean')[0].textContent = pick.mean;
      rv('tr')[0].textContent = line.tr;
      const ex = rv('ex')[0];
      ex.textContent = '';
      line.seg.forEach(([text], k) => ex.append(k === pick.at ? el('b', null, text) : text));
      const [color, label] = RATE[pick.rate];
      const hold = rv('hold')[0];
      hold.textContent = label;
      hold.style.setProperty('--hold', color);
    };

    // 단어를 누르면 그 단어부터 복습하는 화면이 열리고, 평가하면 가사로 돌아온다.
    const tick = () => {
      const line = LINES[index % N];
      const pick = line.pick;
      if (!pick) {
        later(2600, advance);
        return;
      }
      const tok = items[index + 1].querySelectorAll('.tok')[pick.at];
      later(1100, () => {
        tok.classList.add('is-picked');
        fillReview(line, pick);
        later(250, () => {
          review.classList.add('is-open');
          later(1500, () => {
            review.classList.add('is-back');
            later(1700, () => {
              rates.classList.add('is-done');
              later(1300, () => {
                review.classList.remove('is-open');
                later(400, () => {
                  closeReview();
                  later(500, advance);
                });
              });
            });
          });
        });
      });
    };
    const advance = () => {
      index += 1;
      place(index);
      if (index === N) {
        // 두 번째 벌의 첫 줄과 첫 벌의 첫 줄은 똑같이 보인다. 전환이 끝나면 몰래 되감는다.
        later(400, () => {
          index = 0;
          place(0, true);
          tick();
        });
        return;
      }
      tick();
    };

    place(0, true);
    document.fonts?.ready.then(() => place(index, true));
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
      closeReview();
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
    window.addEventListener('resize', () => place(index, true));
  }
})();
