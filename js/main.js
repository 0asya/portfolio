/**
 * PORTFOLIO MOTION & SHARED ELEMENT TRANSITION ENGINE
 * High-fidelity implementation of continuous single portrait card motion,
 * 3D Y-axis flip, Lenis smooth scrolling, text opacity scrub, and modals.
 */

document.addEventListener('DOMContentLoaded', () => {
  // 1. Initialize Lenis Smooth Scrolling
  let lenis;
  if (typeof Lenis !== 'undefined') {
    lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      orientation: 'vertical',
      gestureOrientation: 'vertical',
      smoothWheel: true,
      wheelMultiplier: 1,
      touchMultiplier: 2,
      infinite: false,
    });

    function raf(time) {
      lenis.raf(time);
      requestAnimationFrame(raf);
    }
    requestAnimationFrame(raf);

    if (typeof ScrollTrigger !== 'undefined') {
      lenis.on('scroll', ScrollTrigger.update);
      gsap.ticker.add((time) => {
        lenis.raf(time * 1000);
      });
      gsap.ticker.lagSmoothing(0);
    }
  }

  // 2. Navigation Modal Popup Toggle (Screenshot 5)
  const menuTrigger = document.getElementById('navMenuTrigger');
  const modalBackdrop = document.getElementById('navModalBackdrop');
  const modalClose = document.getElementById('navModalClose');
  const modalLinks = document.querySelectorAll('.nav-modal-item');

  function openNavModal() {
    if (modalBackdrop) {
      modalBackdrop.classList.add('is-open');
      document.body.style.overflow = 'hidden';
    }
  }

  function closeNavModal() {
    if (modalBackdrop) {
      modalBackdrop.classList.remove('is-open');
      document.body.style.overflow = '';
    }
  }

  if (menuTrigger) {
    menuTrigger.addEventListener('click', (e) => {
      e.stopPropagation();
      openNavModal();
    });
  }

  if (modalClose) {
    modalClose.addEventListener('click', closeNavModal);
  }

  if (modalBackdrop) {
    modalBackdrop.addEventListener('click', (e) => {
      if (e.target === modalBackdrop) {
        closeNavModal();
      }
    });
  }

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeNavModal();
  });

  modalLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      const targetId = link.getAttribute('href');
      if (targetId && targetId.startsWith('#')) {
        e.preventDefault();
        closeNavModal();
        const targetEl = document.querySelector(targetId);
        if (targetEl) {
          if (lenis) {
            lenis.scrollTo(targetEl, { offset: -40, duration: 1.2 });
          } else {
            targetEl.scrollIntoView({ behavior: 'smooth' });
          }
        }
      }
    });
  });

  // 3. CONTINUOUS SHARED PORTRAIT CARD & GSAP SCROLL ANIMATIONS
  if (typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined') {
    gsap.registerPlugin(ScrollTrigger);

    const sharedCard = document.getElementById('sharedContinuousCard');
    const flipperInner = document.getElementById('flipperInnerCard');
    const heroAnchor = document.getElementById('heroCardAnchor');
    const bioPlaceholder = document.getElementById('bioCardPlaceholder');
    const heroBioStage = document.getElementById('heroBioStage');

    // Function to position the single card precisely over heroCardAnchor initially
    function setupCardInitialPosition() {
      if (!sharedCard || !heroAnchor || !heroBioStage) return;
      
      const stageRect = heroBioStage.getBoundingClientRect();
      const anchorRect = heroAnchor.getBoundingClientRect();
      const initialTop = anchorRect.top - stageRect.top;
      const initialLeft = anchorRect.left - stageRect.left;

      gsap.set(sharedCard, {
        top: initialTop,
        left: initialLeft,
        width: anchorRect.width,
        height: anchorRect.height,
        x: 0,
        y: 0,
        scale: 1,
        opacity: 1,
        pointerEvents: 'auto',
      });
      if (flipperInner) {
        gsap.set(flipperInner, {
          rotateY: 0
        });
      }
    }

    setupCardInitialPosition();
    window.addEventListener('resize', () => {
      setupCardInitialPosition();
      ScrollTrigger.refresh();
    });

    // Master Scroll-Driven Shared Card Transition: Hero -> Bio Center with 3D Flip
    if (sharedCard && flipperInner && heroAnchor && bioPlaceholder) {
      const cardTimeline = gsap.timeline({
        scrollTrigger: {
          trigger: '#hero',
          start: 'top top',
          endTrigger: '#bio',
          end: 'center center',
          scrub: 1.1,
          invalidateOnRefresh: true,
        }
      });

      // 1. Continuous Glide from hero position down into Bio placeholder
      cardTimeline.to(sharedCard, {
        y: () => {
          const anchorR = heroAnchor.getBoundingClientRect();
          const targetR = bioPlaceholder.getBoundingClientRect();
          return targetR.top - anchorR.top + (targetR.height - anchorR.height) / 2;
        },
        x: () => {
          const anchorR = heroAnchor.getBoundingClientRect();
          const targetR = bioPlaceholder.getBoundingClientRect();
          return targetR.left - anchorR.left + (targetR.width - anchorR.width) / 2;
        },
        scale: () => {
          return bioPlaceholder.offsetWidth / heroAnchor.offsetWidth;
        },
        duration: 1,
        ease: 'power1.inOut',
      }, 0);

      // 2. Continuous 3D Flip: 0deg (Hero: silhouette front face) -> 180deg (Bio: real portrait photo back face)
      cardTimeline.to(flipperInner, {
        rotateY: 180,
        duration: 1,
        ease: 'power1.inOut',
      }, 0);
    }

    // 3.2 Philosophy Text Scrub Reveal (Screenshot 3)
    const scrubContainer = document.getElementById('philosophyScrubText');
    if (scrubContainer) {
      const words = scrubContainer.querySelectorAll('.scrub-word');
      
      gsap.fromTo(words, 
        { 
          opacity: 0.2, 
          color: 'rgba(216, 200, 255, 0.25)',
          textShadow: '0 0 0px rgba(216, 200, 255, 0)'
        },
        {
          opacity: 1,
          color: '#FFFFFF',
          textShadow: '0 0 22px rgba(216, 200, 255, 0.5)',
          stagger: 0.08,
          ease: 'power1.out',
          scrollTrigger: {
            trigger: '.philosophy-section',
            start: 'top 75%',
            end: 'bottom 45%',
            scrub: 0.8,
          }
        }
      );
    }

    // 3.3 Scroll Reveals for Sections and Cards
    const revealCards = gsap.utils.toArray('.project-card, .service-card, .experience-card');
    revealCards.forEach(card => {
      gsap.from(card, {
        opacity: 0,
        y: 40,
        duration: 0.8,
        ease: 'power3.out',
        scrollTrigger: {
          trigger: card,
          start: 'top 88%',
          toggleActions: 'play none none none'
        }
      });
    });

    // 3.4 Hero Entrance Animation on Page Load
    gsap.from('.hero-giant-typography .title-word', {
      opacity: 0,
      y: 50,
      duration: 1.1,
      stagger: 0.12,
      ease: 'power4.out',
      delay: 0.2
    });

    gsap.from('.chromatic-star', {
      scale: 0,
      opacity: 0,
      duration: 1,
      stagger: 0.2,
      ease: 'back.out(1.7)',
      delay: 0.5
    });
  }

  // 4. Project Detail Modal Interactivity
  const projectModalBackdrop = document.getElementById('projectModalBackdrop');
  const projectModalClose = document.getElementById('projectModalClose');
  const projectModalContent = document.getElementById('projectModalContent');
  const projectCards = document.querySelectorAll('.project-card[data-project-id]');

  function openProjectModal(projectId) {
    if (typeof PORTFOLIO_PROJECTS === 'undefined' || !projectModalBackdrop || !projectModalContent) return;
    const project = PORTFOLIO_PROJECTS.find(p => p.id === projectId);
    if (!project) return;

    projectModalContent.innerHTML = `
      <div class="modal-header-section">
        <span class="modal-badge">${project.categoryTag}</span>
        <h3 class="modal-title">${project.title}</h3>
      </div>
      
      <!-- Screenshot / Gallery Container -->
      <div class="modal-gallery-wrapper">
        <div class="modal-gallery-header">
          <span class="gallery-label">Project Screenshot / Interface Preview</span>
          <span class="gallery-hint">Preview</span>
        </div>
        <div class="modal-main-image-frame">
          <img src="${project.coverImage}" alt="${project.title} Screenshot" class="modal-project-img" onerror="this.style.display='none'">
        </div>
        ${project.images && project.images.length > 0 ? `
          <div class="modal-image-caption">${project.images[0].caption}</div>
        ` : ''}
      </div>

      <!-- Project Overview -->
      <div class="modal-section-block">
        <h4 class="modal-subheading">About the Project</h4>
        <p class="modal-desc">${project.description}</p>
      </div>

      <!-- Key Features / Tasks Completed -->
      ${project.features && project.features.length > 0 ? `
        <div class="modal-section-block">
          <h4 class="modal-subheading">Key Tasks &amp; Features</h4>
          <ul class="modal-features-list">
            ${project.features.map(f => `
              <li class="modal-feature-item">
                <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
                <span>${f}</span>
              </li>
            `).join('')}
          </ul>
        </div>
      ` : ''}

      <!-- Technologies Used -->
      <div class="modal-section-block">
        <h4 class="modal-subheading">Technologies Used</h4>
        <div class="modal-tech-pills">
          ${project.technologies.map(t => `<span class="tech-pill">${t}</span>`).join('')}
        </div>
      </div>

      <div class="modal-cta-row">
        ${project.github ? `<a href="${project.github}" target="_blank" rel="noopener" class="pill-action-btn">GitHub Source ↗</a>` : ''}
        <button type="button" class="pill-action-btn" id="modalCloseActionBtn">Close Window</button>
      </div>
    `;

    const modalCloseActionBtn = document.getElementById('modalCloseActionBtn');
    if (modalCloseActionBtn) {
      modalCloseActionBtn.addEventListener('click', closeProjectModal);
    }

    projectModalBackdrop.classList.add('is-open');
    document.body.style.overflow = 'hidden';
  }

  function closeProjectModal() {
    if (projectModalBackdrop) {
      projectModalBackdrop.classList.remove('is-open');
      document.body.style.overflow = '';
    }
  }

  // 4. GLASS FOLDER CARDS INTERACTION (MATCHING SCREENSHOTS 1 & 2)
  const glassFolders = document.querySelectorAll('.gf-root');

  glassFolders.forEach(folder => {
    let raf = 0;
    let px = 0;
    let py = 0;

    const write = () => {
      raf = 0;
      folder.style.setProperty('--gf-px', px.toFixed(3));
      folder.style.setProperty('--gf-py', py.toFixed(3));
    };

    folder.addEventListener('pointermove', (e) => {
      if (e.pointerType === 'touch') return;
      const r = folder.getBoundingClientRect();
      px = ((e.clientX - r.left) / r.width) * 2 - 1;
      py = ((e.clientY - r.top) / r.height) * 2 - 1;
      if (!raf) raf = requestAnimationFrame(write);
    });

    folder.addEventListener('pointerleave', () => {
      px = 0;
      py = 0;
      if (!raf) raf = requestAnimationFrame(write);
    });

    const hitBtn = folder.querySelector('.gf-hit');
    const keyBtn = folder.querySelector('.gf-key');
    const sheets = folder.querySelectorAll('.gf-sheet');
    const pid = folder.getAttribute('data-project-id');

    function toggleFolder(e) {
      if (e) e.stopPropagation();
      const isOpen = folder.getAttribute('data-open') === 'true';
      const nextState = !isOpen;
      folder.setAttribute('data-open', nextState.toString());
      folder.classList.toggle('is-open', nextState);
      if (hitBtn) hitBtn.setAttribute('aria-expanded', nextState.toString());
    }

    if (hitBtn) {
      hitBtn.addEventListener('click', toggleFolder);
    }
    if (keyBtn) {
      keyBtn.addEventListener('click', toggleFolder);
    }

    // Clicking any fanned file sheet opens the project modal
    sheets.forEach(sheet => {
      sheet.addEventListener('click', (e) => {
        e.stopPropagation();
        if (pid) openProjectModal(pid);
      });
    });
  });

  // Project Card Footer / View Case Study button triggers modal
  const viewCaseButtons = document.querySelectorAll('.project-view-case');
  viewCaseButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const card = btn.closest('.project-card');
      if (card) {
        const pid = card.getAttribute('data-project-id');
        if (pid) openProjectModal(pid);
      }
    });
  });

  if (projectModalClose) {
    projectModalClose.addEventListener('click', closeProjectModal);
  }

  if (projectModalBackdrop) {
    projectModalBackdrop.addEventListener('click', (e) => {
      if (e.target === projectModalBackdrop) {
        closeProjectModal();
      }
    });
  }

  // 5. Newsletter Toast Feedback
  const newsletterForm = document.getElementById('newsletterForm');
  if (newsletterForm) {
    newsletterForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const input = newsletterForm.querySelector('input[type="email"]');
      if (input && input.value) {
        const btn = newsletterForm.querySelector('button');
        const origText = btn.textContent;
        btn.textContent = 'Subscribed! ✓';
        btn.style.backgroundColor = '#27c93f';
        btn.style.color = '#fff';
        input.value = '';
        setTimeout(() => {
          btn.textContent = origText;
          btn.style.backgroundColor = '';
          btn.style.color = '';
        }, 3000);
      }
    });
  }
});
