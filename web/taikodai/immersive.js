(function () {
  var prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* Navigation */
  var nav = document.getElementById('nav');
  var menuBtn = document.querySelector('.nav__menu-btn');
  var navLinks = document.getElementById('nav-links');

  if (menuBtn && navLinks) {
    menuBtn.addEventListener('click', function () {
      var expanded = menuBtn.getAttribute('aria-expanded') === 'true';
      menuBtn.setAttribute('aria-expanded', String(!expanded));
      navLinks.classList.toggle('is-open', !expanded);
      menuBtn.setAttribute('aria-label', expanded ? 'メニューを開く' : 'メニューを閉じる');
    });

    navLinks.querySelectorAll('a').forEach(function (link) {
      link.addEventListener('click', function () {
        menuBtn.setAttribute('aria-expanded', 'false');
        navLinks.classList.remove('is-open');
        menuBtn.setAttribute('aria-label', 'メニューを開く');
      });
    });
  }

  if (nav) {
    function updateNavScroll() {
      nav.classList.toggle('nav--scrolled', window.scrollY > 48);
    }
    window.addEventListener('scroll', updateNavScroll, { passive: true });
    updateNavScroll();
  }

  /* Scroll reveal */
  var revealEls = document.querySelectorAll('.reveal');
  if (revealEls.length && !prefersReducedMotion) {
    var revealObserver = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            revealObserver.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
    );
    revealEls.forEach(function (el) {
      revealObserver.observe(el);
    });
  } else {
    revealEls.forEach(function (el) {
      el.classList.add('is-visible');
    });
  }

  /* Parallax */
  var parallaxEls = document.querySelectorAll('[data-parallax]');

  function updateParallax() {
    if (prefersReducedMotion) return;
    parallaxEls.forEach(function (el) {
      var speed = parseFloat(el.dataset.parallax) || 0.1;
      var rect = el.getBoundingClientRect();
      var center = rect.top + rect.height / 2 - window.innerHeight / 2;
      var offset = center * speed * -1;
      el.style.transform = 'translate3d(0, ' + offset + 'px, 0)';
    });
  }

  if (parallaxEls.length && !prefersReducedMotion) {
    window.addEventListener('scroll', updateParallax, { passive: true });
    updateParallax();
  }

  /* Tilt on hover / pointer */
  var tiltEls = document.querySelectorAll('[data-tilt]');

  function bindTilt(el) {
    var maxTilt = 8;

    function onMove(event) {
      var rect = el.getBoundingClientRect();
      var x = (event.clientX - rect.left) / rect.width - 0.5;
      var y = (event.clientY - rect.top) / rect.height - 0.5;
      el.style.transform =
        'perspective(800px) rotateX(' + y * -maxTilt + 'deg) rotateY(' + x * maxTilt + 'deg) translateZ(12px)';
      el.classList.add('is-tilt-active');
    }

    function onLeave() {
      el.style.transform = '';
      el.classList.remove('is-tilt-active');
    }

    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerleave', onLeave);
  }

  if (!prefersReducedMotion) {
    tiltEls.forEach(bindTilt);
  }

  /* Gallery 3D depth on scroll */
  var galleryTrack = document.querySelector('.gallery__track--3d');
  var galleryCards = galleryTrack ? galleryTrack.querySelectorAll('.gallery-card') : [];

  function updateGalleryDepth() {
    if (!galleryTrack || prefersReducedMotion) return;
    var trackRect = galleryTrack.getBoundingClientRect();
    var trackCenter = trackRect.left + trackRect.width / 2;

    galleryCards.forEach(function (card) {
      var cardRect = card.getBoundingClientRect();
      var cardCenter = cardRect.left + cardRect.width / 2;
      var dist = (cardCenter - trackCenter) / (trackRect.width / 2);
      var abs = Math.min(Math.abs(dist), 1);
      var rotateY = dist * -12;
      var scale = 1 - abs * 0.08;
      var translateZ = (1 - abs) * 40;

      card.style.transform =
        'rotateY(' + rotateY + 'deg) scale(' + scale + ') translateZ(' + translateZ + 'px)';
      card.classList.toggle('is-near-center', abs < 0.35);
    });
  }

  if (galleryCards.length && !prefersReducedMotion) {
    galleryTrack.addEventListener('scroll', updateGalleryDepth, { passive: true });
    window.addEventListener('resize', updateGalleryDepth, { passive: true });
    updateGalleryDepth();
  }
})();
