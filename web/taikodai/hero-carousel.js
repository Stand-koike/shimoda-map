(function () {
  var FLOATS = [
    { src: '01_一番太鼓_中原町_鷹.jpg', alt: '一番太鼓 中原町 鷹', order: '一番', title: '中原町 — 鷹', accent: '#dfa6b5' },
    { src: '02_二番太鼓_原町_仁徳天皇.jpg', alt: '二番太鼓 原町 仁徳天皇', order: '二番', title: '原町 — 仁徳天皇', accent: '#d9d9d9' },
    { src: '03_三番太鼓_七軒町_神功皇后.jpg', alt: '三番太鼓 七軒町 神功皇后', order: '三番', title: '七軒町 — 神功皇后', accent: '#4f5fa8' },
    { src: '04_四番太鼓_彌治川町_小野道風.jpg', alt: '四番太鼓 彌治川町 小野道風', order: '四番', title: '彌治川町 — 小野道風', accent: '#d9e85b' },
    { src: '05A_五番太鼓_大坂区大工町_猿.jpg', alt: '五番太鼓 大坂区 大工町 猿', order: '五番 A', title: '大坂区 大工町 — 猿', accent: '#c9a66b' },
    { src: '05B_五番太鼓_坂下町_鷲.jpg', alt: '五番太鼓 坂下町 鷲', order: '五番 B', title: '坂下町 — 鷲', accent: '#8aa4c8' },
    { src: '06_六番太鼓_廣岡西_連獅子.jpg', alt: '六番太鼓 廣岡西 連獅子', order: '六番', title: '廣岡西 — 連獅子', accent: '#e07a5f' },
    { src: '07_七番太鼓_廣岡東_連獅子.jpg', alt: '七番太鼓 廣岡東 連獅子', order: '七番', title: '廣岡東 — 連獅子', accent: '#e07a5f' },
    { src: '08_八番太鼓_二町目_大国主命と協和.jpg', alt: '八番太鼓 二町目 大国主命と協和', order: '八番', title: '二町目 — 大国主命と協和', accent: '#dfa6b5' },
    { src: '09_九番太鼓_三丁目_天の羽衣.jpg', alt: '九番太鼓 三丁目 天の羽衣', order: '九番', title: '三丁目 — 天の羽衣', accent: '#9b8ec4' },
    { src: '10_十番太鼓_池之町_鶏.jpg', alt: '十番太鼓 池之町 鶏', order: '十番', title: '池之町 — 鶏', accent: '#d9e85b' },
    { src: '11_十一番太鼓_伊勢町_和唐藤内と虎.jpg', alt: '十一番太鼓 伊勢町 和唐（藤）内と虎', order: '十一番', title: '伊勢町 — 和唐（藤）内と虎', accent: '#f0a04b' },
    { src: '12_十二番太鼓_住吉区_龍.jpg', alt: '十二番太鼓 住吉区 龍', order: '十二番', title: '住吉区 — 龍', accent: '#4f5fa8' },
    { src: '13_十三番太鼓_新田町_猩々.jpg', alt: '十三番太鼓 新田町 猩々', order: '十三番', title: '新田町 — 猩々', accent: '#c96b8a' },
    { src: '14_十四番太鼓_大和区_素戔嗚尊.jpg', alt: '十四番太鼓 大和区 素戔嗚尊', order: '十四番', title: '大和区 — 素戔嗚尊', accent: '#d9d9d9' }
  ];

  var carousel = document.getElementById('hero-carousel');
  if (!carousel) return;

  var track = document.getElementById('hero-track');
  var dotsRoot = document.getElementById('hero-dots');
  var labelEl = document.getElementById('hero-float-label');
  var ambient = carousel.querySelector('.hero-carousel__ambient');
  var prevBtn = carousel.querySelector('.hero-carousel__btn--prev');
  var nextBtn = carousel.querySelector('.hero-carousel__btn--next');

  var activeIndex = 0;
  var slides = [];
  var autoTimer = null;
  var resumeTimer = null;
  var dragStartX = 0;
  var dragDeltaX = 0;
  var isDragging = false;
  var prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function wrapOffset(index, center) {
    var total = FLOATS.length;
    var offset = index - center;
    if (offset > total / 2) offset -= total;
    if (offset < -total / 2) offset += total;
    return offset;
  }

  function buildSlides() {
    FLOATS.forEach(function (item, index) {
      var slide = document.createElement('article');
      slide.className = 'hero-carousel__slide';
      slide.setAttribute('role', 'group');
      slide.setAttribute('aria-roledescription', 'slide');
      slide.setAttribute('aria-label', item.order + ' ' + item.title);
      slide.dataset.index = String(index);

      var frame = document.createElement('div');
      frame.className = 'hero-carousel__frame';
      frame.style.setProperty('--slide-accent', item.accent);

      var img = document.createElement('img');
      img.src = item.src;
      img.alt = item.alt;
      img.loading = index === 0 ? 'eager' : 'lazy';
      img.decoding = 'async';
      img.draggable = false;

      frame.appendChild(img);
      slide.appendChild(frame);
      track.appendChild(slide);
      slides.push(slide);

      var dot = document.createElement('button');
      dot.type = 'button';
      dot.className = 'hero-carousel__dot';
      dot.setAttribute('aria-label', item.order + ' ' + item.title + ' を表示');
      dot.addEventListener('click', function () {
        goTo(index);
        pauseAuto(false);
      });
      dotsRoot.appendChild(dot);
    });
  }

  function updateSlides() {
    slides.forEach(function (slide, index) {
      var offset = wrapOffset(index, activeIndex);
      var abs = Math.abs(offset);

      if (abs > 4) {
        slide.style.opacity = '0';
        slide.style.pointerEvents = 'none';
        slide.setAttribute('aria-hidden', 'true');
        return;
      }

      var rotateY = offset * -42;
      var translateX = offset * 22;
      var translateZ = abs === 0 ? 120 : 40 - abs * 110;
      var scale = abs === 0 ? 1 : Math.max(0.52, 1 - abs * 0.14);
      var opacity = abs === 0 ? 1 : Math.max(0.18, 1 - abs * 0.28);

      slide.style.transform =
        'translate(-50%, -50%) translateX(' + translateX + '%) translateZ(' + translateZ + 'px) rotateY(' + rotateY + 'deg) scale(' + scale + ')';
      slide.style.opacity = String(opacity);
      slide.style.zIndex = String(100 - abs);
      slide.style.pointerEvents = abs === 0 ? 'auto' : 'none';
      slide.setAttribute('aria-hidden', abs === 0 ? 'false' : 'true');
      slide.classList.toggle('is-active', abs === 0);
    });

    dotsRoot.querySelectorAll('.hero-carousel__dot').forEach(function (dot, index) {
      dot.classList.toggle('is-active', index === activeIndex);
      dot.setAttribute('aria-current', index === activeIndex ? 'true' : 'false');
    });

    var current = FLOATS[activeIndex];
    labelEl.textContent = current.order + ' — ' + current.title;
    ambient.style.setProperty('--ambient-color', current.accent);
    carousel.style.setProperty('--hero-accent', current.accent);
  }

  function goTo(index) {
    activeIndex = (index + FLOATS.length) % FLOATS.length;
    updateSlides();
  }

  function step(delta) {
    goTo(activeIndex + delta);
  }

  function startAuto() {
    if (prefersReducedMotion) return;
    stopAuto();
    autoTimer = window.setInterval(function () {
      step(1);
    }, 4200);
  }

  function stopAuto() {
    if (autoTimer) {
      window.clearInterval(autoTimer);
      autoTimer = null;
    }
  }

  function pauseAuto(restart) {
    stopAuto();
    if (resumeTimer) window.clearTimeout(resumeTimer);
    if (restart !== false) {
      resumeTimer = window.setTimeout(startAuto, 6000);
    }
  }

  function onPointerDown(event) {
    isDragging = true;
    dragStartX = event.clientX;
    dragDeltaX = 0;
    track.setPointerCapture(event.pointerId);
    track.classList.add('is-dragging');
    pauseAuto(false);
  }

  function onPointerMove(event) {
    if (!isDragging) return;
    dragDeltaX = event.clientX - dragStartX;
    slides.forEach(function (slide, index) {
      var baseOffset = wrapOffset(index, activeIndex);
      var dragShift = dragDeltaX / window.innerWidth * 2.2;
      var offset = baseOffset + dragShift;
      var abs = Math.abs(offset);
      if (abs > 4) return;
      var rotateY = offset * -42;
      var translateX = offset * 22;
      var translateZ = abs === 0 ? 120 : 40 - abs * 110;
      var scale = abs === 0 ? 1 : Math.max(0.52, 1 - abs * 0.14);
      slide.style.transform =
        'translate(-50%, -50%) translateX(' + translateX + '%) translateZ(' + translateZ + 'px) rotateY(' + rotateY + 'deg) scale(' + scale + ')';
    });
  }

  function onPointerUp(event) {
    if (!isDragging) return;
    isDragging = false;
    track.classList.remove('is-dragging');
    try {
      track.releasePointerCapture(event.pointerId);
    } catch (e) {}

    if (Math.abs(dragDeltaX) > 48) {
      step(dragDeltaX < 0 ? 1 : -1);
    } else {
      updateSlides();
    }
    pauseAuto(true);
  }

  prevBtn.addEventListener('click', function () {
    step(-1);
    pauseAuto(true);
  });

  nextBtn.addEventListener('click', function () {
    step(1);
    pauseAuto(true);
  });

  track.addEventListener('pointerdown', onPointerDown);
  track.addEventListener('pointermove', onPointerMove);
  track.addEventListener('pointerup', onPointerUp);
  track.addEventListener('pointercancel', onPointerUp);

  carousel.addEventListener('mouseenter', stopAuto);
  carousel.addEventListener('mouseleave', function () {
    if (!prefersReducedMotion) startAuto();
  });

  document.addEventListener('keydown', function (event) {
    if (!carousel.matches(':hover') && document.activeElement !== prevBtn && document.activeElement !== nextBtn) return;
    if (event.key === 'ArrowLeft') {
      step(-1);
      pauseAuto(true);
    }
    if (event.key === 'ArrowRight') {
      step(1);
      pauseAuto(true);
    }
  });

  buildSlides();
  updateSlides();
  startAuto();
})();
