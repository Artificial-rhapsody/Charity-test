/* ============================================================
   CyberShield — Interaction Script
   Features: Auth, Login/Register, Fireworks, Toast
   ============================================================ */

// ── Config ──
const API_BASE = 'http://localhost:8787'; // Change to your Workers URL in production

document.addEventListener('DOMContentLoaded', () => {

  // ── Elements ──
  const navbar = document.getElementById('navbar');
  const navToggle = document.getElementById('navToggle');
  const navLinks = document.getElementById('navLinks');
  const loginBtn = document.getElementById('loginBtn');
  const loginModal = document.getElementById('loginModal');
  const loginModalClose = document.getElementById('loginModalClose');
  const loginForm = document.getElementById('loginForm');
  const goToRegister = document.getElementById('goToRegister');
  const successModal = document.getElementById('successModal');
  const successModalClose = document.getElementById('successModalClose');
  const successModalOk = document.getElementById('successModalOk');
  const contactForm = document.getElementById('contactForm');
  const navJoinUs = document.getElementById('navJoinUs');
  const navLogin = document.getElementById('navLogin');
  const navUsername = document.getElementById('navUsername');
  const userDisplay = document.getElementById('userDisplay');

  // ── Navbar scroll shadow ──
  window.addEventListener('scroll', () => {
    navbar.classList.toggle('scrolled', window.scrollY > 50);
  });

  // Mobile menu toggle
  navToggle.addEventListener('click', () => {
    navLinks.classList.toggle('active');
    navToggle.classList.toggle('open');
  });

  // Close mobile menu on link click
  navLinks.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
      navLinks.classList.remove('active');
      navToggle.classList.remove('open');
    });
  });

  // ── Counter animation ──
  const counters = document.querySelectorAll('[data-count]');

  const counterObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const el = entry.target;
        const target = parseInt(el.dataset.count);
        const duration = 2000;
        const startTime = performance.now();

        function updateCounter(currentTime) {
          const elapsed = currentTime - startTime;
          const progress = Math.min(elapsed / duration, 1);
          const eased = 1 - Math.pow(1 - progress, 3);
          const current = Math.floor(eased * target);

          if (target >= 10000) {
            el.textContent = Math.floor(current / 1000) + 'K';
          } else {
            el.textContent = current.toLocaleString();
          }

          if (progress < 1) {
            requestAnimationFrame(updateCounter);
          } else {
            if (target >= 10000) {
              el.textContent = Math.floor(target / 1000) + 'K';
            } else {
              el.textContent = target.toLocaleString();
            }
          }
        }

        requestAnimationFrame(updateCounter);
        counterObserver.unobserve(el);
      }
    });
  }, { threshold: 0.5 });

  counters.forEach(el => counterObserver.observe(el));

  // ── Auth state management ──
  function getAuthToken() {
    return localStorage.getItem('cybershield_token');
  }

  function getAuthUser() {
    const raw = localStorage.getItem('cybershield_user');
    return raw ? JSON.parse(raw) : null;
  }

  function setAuth(token, user) {
    localStorage.setItem('cybershield_token', token);
    localStorage.setItem('cybershield_user', JSON.stringify(user));
    updateNavbar();
  }

  function clearAuth() {
    localStorage.removeItem('cybershield_token');
    localStorage.removeItem('cybershield_user');
    updateNavbar();
  }

  function updateNavbar() {
    const user = getAuthUser();
    if (user) {
      navJoinUs.style.display = 'none';
      navLogin.style.display = 'none';
      navUsername.style.display = '';
      userDisplay.textContent = user.name;
      userDisplay.title = 'Click to logout';
    } else {
      navJoinUs.style.display = '';
      navLogin.style.display = '';
      navUsername.style.display = 'none';
    }
  }

  // Init navbar state
  updateNavbar();

  // Logout on username click
  userDisplay.addEventListener('click', (e) => {
    e.preventDefault();
    if (confirm('Do you want to log out?')) {
      clearAuth();
      showToast('You have been logged out.', 'success');
    }
  });

  // ── Login Modal ──
  loginBtn.addEventListener('click', (e) => {
    e.preventDefault();
    loginModal.classList.add('active');
  });

  loginModalClose.addEventListener('click', () => {
    loginModal.classList.remove('active');
  });

  loginModal.addEventListener('click', (e) => {
    if (e.target === loginModal) {
      loginModal.classList.remove('active');
    }
  });

  goToRegister.addEventListener('click', (e) => {
    loginModal.classList.remove('active');
    // Smooth scroll to contact section is handled by the anchor link
  });

  // ── Login form submit ──
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;

    if (!email || !password) {
      showToast('Please fill in email and password.', 'error');
      return;
    }

    const btn = loginForm.querySelector('.modal-submit');
    btn.textContent = 'Logging in...';
    btn.disabled = true;

    try {
      const res = await fetch(`${API_BASE}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (data.ok) {
        setAuth(data.token, data.user);
        loginModal.classList.remove('active');
        loginForm.reset();
        showToast(`Welcome back, ${data.user.name}!`, 'success');
      } else {
        showToast(data.error || 'Login failed.', 'error');
      }
    } catch (err) {
      showToast('Network error. Please try again.', 'error');
    } finally {
      btn.textContent = 'Log In';
      btn.disabled = false;
    }
  });

  // ── Register form submit ──
  if (contactForm) {
    contactForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const formData = new FormData(contactForm);
      const data = Object.fromEntries(formData);

      if (!data.name || !data.email || !data.password) {
        showToast('Please fill in the required fields (Name, Email and Password).', 'error');
        return;
      }

      if (data.password.length < 6) {
        showToast('Password must be at least 6 characters.', 'error');
        return;
      }

      if (data.password !== data.passwordConfirm) {
        showToast('Passwords do not match.', 'error');
        return;
      }

      const btn = contactForm.querySelector('.form-submit');
      const originalText = btn.textContent;
      btn.textContent = 'Submitting...';
      btn.disabled = true;
      btn.style.opacity = '0.7';

      try {
        const res = await fetch(`${API_BASE}/api/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: data.name,
            email: data.email,
            password: data.password,
            phone: data.phone || '',
            age: data.age || null,
            role: data.role || '',
            message: data.message || '',
          }),
        });

        const result = await res.json();

        if (result.ok) {
          contactForm.reset();
          // Launch fireworks!
          launchFireworks();
          // Show success modal after a short delay
          setTimeout(() => {
            successModal.classList.add('active');
          }, 500);
        } else {
          showToast(result.error || 'Registration failed.', 'error');
        }
      } catch (err) {
        showToast('Network error. Please try again.', 'error');
      } finally {
        btn.textContent = originalText;
        btn.disabled = false;
        btn.style.opacity = '1';
      }
    });
  }

  // ── Success Modal ──
  function closeSuccessModal() {
    successModal.classList.remove('active');
  }
  successModalClose.addEventListener('click', closeSuccessModal);
  successModalOk.addEventListener('click', closeSuccessModal);
  successModal.addEventListener('click', (e) => {
    if (e.target === successModal) closeSuccessModal();
  });

  // ── Toast notification ──
  function showToast(message, type = 'success') {
    const existing = document.querySelector('.toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = 'toast toast-' + type;
    toast.textContent = message;
    toast.style.cssText =
      'position:fixed;bottom:30px;left:50%;transform:translateX(-50%) translateY(20px);' +
      'padding:16px 32px;border-radius:8px;font-size:15px;font-weight:500;color:white;' +
      'z-index:99999;opacity:0;transition:all 0.4s ease;' +
      'background:' + (type === 'success' ? '#22c55e' : '#ef4444') + ';' +
      'box-shadow:0 10px 30px rgba(0,0,0,0.2);';

    document.body.appendChild(toast);

    requestAnimationFrame(() => {
      toast.style.opacity = '1';
      toast.style.transform = 'translateX(-50%) translateY(0)';
    });

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(-50%) translateY(20px)';
      setTimeout(() => toast.remove(), 400);
    }, 3000);
  }

  // ── Video Modal — Bilibili iframe ──
  const videoModal = document.getElementById('videoModal');
  const videoModalIframe = document.getElementById('videoModalIframe');
  const videoModalClose = document.getElementById('videoModalClose');
  const videoModalBackdrop = document.getElementById('videoModalBackdrop');

  function openVideoModal(bvid) {
    const src = 'https://player.bilibili.com/player.html?bvid=' + bvid + '&p=1&high_quality=1&autoplay=true&danmaku=0';
    videoModalIframe.src = src;
    videoModal.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  function closeVideoModal() {
    videoModal.classList.remove('active');
    document.body.style.overflow = '';
    // Clear iframe src after transition to stop playback
    setTimeout(function () {
      videoModalIframe.src = 'about:blank';
    }, 300);
  }

  // Click on video cards to open modal
  document.querySelectorAll('.video-card').forEach(function (card) {
    card.addEventListener('click', function () {
      var bvid = card.getAttribute('data-bvid');
      if (bvid) openVideoModal(bvid);
    });
  });

  // Close modal: X button, backdrop click, Escape key
  videoModalClose.addEventListener('click', closeVideoModal);
  videoModalBackdrop.addEventListener('click', closeVideoModal);
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && videoModal.classList.contains('active')) {
      closeVideoModal();
    }
  });

  // ── Smooth scroll for anchor links ──
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
      const href = this.getAttribute('href');
      if (href === '#') return; // skip pure # links
      e.preventDefault();
      const target = document.querySelector(href);
      if (target) {
        target.scrollIntoView({ behavior: 'smooth' });
      }
    });
  });

  // ============================================================
  // Fireworks Effect (Canvas)
  // ============================================================
  const canvas = document.getElementById('fireworksCanvas');
  const ctx = canvas.getContext('2d');
  let fireworksRunning = false;

  function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }

  window.addEventListener('resize', resizeCanvas);
  resizeCanvas();

  class Particle {
    constructor(x, y, color) {
      this.x = x;
      this.y = y;
      this.color = color;
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 6 + 2;
      this.vx = Math.cos(angle) * speed;
      this.vy = Math.sin(angle) * speed;
      this.alpha = 1;
      this.decay = Math.random() * 0.02 + 0.015;
      this.size = Math.random() * 3 + 1;
    }

    update() {
      this.x += this.vx;
      this.y += this.vy;
      this.vy += 0.05; // gravity
      this.alpha -= this.decay;
      this.size *= 0.98;
    }

    draw(ctx) {
      ctx.save();
      ctx.globalAlpha = Math.max(this.alpha, 0);
      ctx.fillStyle = this.color;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  class Firework {
    constructor(x, targetY) {
      this.x = x;
      this.y = canvas.height;
      this.targetY = targetY;
      this.vy = -(Math.random() * 4 + 6);
      this.exploded = false;
      this.particles = [];
      this.color = `hsl(${Math.random() * 360}, 80%, 60%)`;
    }

    update() {
      if (!this.exploded) {
        this.y += this.vy;
        if (this.y <= this.targetY) {
          this.explode();
        }
      }

      this.particles.forEach(p => p.update());
      this.particles = this.particles.filter(p => p.alpha > 0);
    }

    explode() {
      this.exploded = true;
      const colors = [
        `hsl(${Math.random() * 60 + 0}, 90%, 60%)`,    // red-orange
        `hsl(${Math.random() * 60 + 40}, 90%, 65%)`,   // yellow-green
        `hsl(${Math.random() * 60 + 180}, 80%, 60%)`,  // blue-cyan
        `hsl(${Math.random() * 60 + 270}, 85%, 65%)`,  // purple-pink
        '#FFD700', '#FF69B4', '#00CED1', '#FF4500',
      ];
      for (let i = 0; i < 80; i++) {
        const color = colors[Math.floor(Math.random() * colors.length)];
        this.particles.push(new Particle(this.x, this.y, color));
      }
    }

    draw(ctx) {
      if (!this.exploded) {
        ctx.save();
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      this.particles.forEach(p => p.draw(ctx));
    }

    isDone() {
      return this.exploded && this.particles.length === 0;
    }
  }

  let fireworks = [];
  let fireworksTimer = null;

  function launchFireworks() {
    if (fireworksRunning) return;
    fireworksRunning = true;
    canvas.style.display = 'block';
    fireworks = [];

    // Launch multiple fireworks over time
    let launched = 0;
    const maxLaunches = 12;

    function spawnOne() {
      if (launched >= maxLaunches) return;
      const x = Math.random() * canvas.width * 0.8 + canvas.width * 0.1;
      const targetY = Math.random() * canvas.height * 0.4 + canvas.height * 0.1;
      fireworks.push(new Firework(x, targetY));
      launched++;
    }

    // Stagger launches
    spawnOne();
    fireworksTimer = setInterval(() => {
      spawnOne();
      spawnOne();
      if (launched >= maxLaunches) clearInterval(fireworksTimer);
    }, 400);

    requestAnimationFrame(animateFireworks);
  }

  function animateFireworks() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    fireworks.forEach(fw => {
      fw.update();
      fw.draw(ctx);
    });
    fireworks = fireworks.filter(fw => !fw.isDone());

    if (fireworks.length > 0 || fireworksRunning) {
      requestAnimationFrame(animateFireworks);
    }

    // Auto-stop after all fireworks are done
    if (fireworks.length === 0 && fireworksRunning) {
      setTimeout(() => {
        fireworksRunning = false;
        canvas.style.display = 'none';
      }, 500);
    }
  }

});
