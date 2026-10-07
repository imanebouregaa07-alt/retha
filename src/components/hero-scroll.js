import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

export class HeroScrollEngine {
  constructor(options = {}) {
    this.container = options.container || document.querySelector('#hero-scroll-section');
    this.canvas = options.canvas || document.querySelector('#hero-canvas');
    this.ctx = this.canvas ? this.canvas.getContext('2d') : null;
    this.progressBar = document.querySelector('#hero-preload-bar');
    this.progressText = document.querySelector('#hero-preload-text');
    this.loaderElement = document.querySelector('#hero-loader');

    this.totalFrames = 274;
    this.images = [];
    this.loadedCount = 0;
    this.currentFrame = 0;
    this.targetFrame = 0;
    this.isLoaded = false;
    this.renderAnimId = null;

    this.init();
  }

  async init() {
    if (!this.canvas || !this.ctx) return;

    this.setupCanvasSize();
    window.addEventListener('resize', () => this.setupCanvasSize());

    // Preload critical first frame and final frame immediately
    await this.preloadCriticalFrames();

    // Start rendering loop for smooth interpolation
    this.startRenderLoop();

    // Setup GSAP ScrollTrigger
    this.setupScrollTrigger();

    // Buffer remaining frames in background
    this.bufferRemainingFrames();

    // Setup milestone buttons
    this.setupMilestones();
  }

  setupCanvasSize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = window.innerWidth;
    const height = window.innerHeight;

    this.canvas.width = width * dpr;
    this.canvas.height = height * dpr;
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;

    this.ctx.scale(dpr, dpr);
    this.ctx.imageSmoothingEnabled = true;
    this.ctx.imageSmoothingQuality = 'high';

    this.drawCurrentFrame();
  }

  async preloadCriticalFrames() {
    return new Promise((resolve) => {
      let firstLoaded = false;
      const img0 = new Image();
      img0.src = `/frames/frame_000.webp`;
      img0.onload = () => {
        this.images[0] = img0;
        this.drawCurrentFrame();
        firstLoaded = true;
        resolve();
      };
      img0.onerror = () => {
        // Fallback placeholder if not ready
        resolve();
      };

      // Also prime the last frame
      const imgLast = new Image();
      imgLast.src = `/frames/frame_${String(this.totalFrames - 1).padStart(3, '0')}.webp`;
      imgLast.onload = () => {
        this.images[this.totalFrames - 1] = imgLast;
      };
    });
  }

  bufferRemainingFrames() {
    let loaded = 0;
    const totalToLoad = this.totalFrames;

    for (let i = 0; i < this.totalFrames; i++) {
      if (this.images[i]) {
        loaded++;
        continue;
      }
      const img = new Image();
      const frameNum = String(i).padStart(3, '0');
      img.src = `/frames/frame_${frameNum}.webp`;

      img.onload = () => {
        this.images[i] = img;
        loaded++;
        const pct = Math.round((loaded / totalToLoad) * 100);
        if (this.progressBar) this.progressBar.style.width = `${pct}%`;
        if (this.progressText) this.progressText.textContent = `${pct}%`;

        if (loaded >= totalToLoad * 0.4 && !this.isLoaded) {
          // Fade out loader once 40% is ready for ultra-smooth scrub
          this.isLoaded = true;
          if (this.loaderElement) {
            this.loaderElement.classList.add('fade-out');
            setTimeout(() => {
              if (this.loaderElement) this.loaderElement.style.display = 'none';
            }, 600);
          }
        }
      };

      img.onerror = () => {
        loaded++;
      };
    }
  }

  setupScrollTrigger() {
    ScrollTrigger.create({
      trigger: '#hero-scroll-section',
      start: 'top top',
      end: 'bottom bottom',
      scrub: 0.6,
      onUpdate: (self) => {
        const rawFrame = self.progress * (this.totalFrames - 1);
        this.targetFrame = Math.max(0, Math.min(this.totalFrames - 1, rawFrame));

        // Update active milestone indicators
        this.updateMilestoneUI(self.progress);

        // Minimal corner label: only visible at the initial standstill (0.0 to 0.08)
        const minimalCorner = document.querySelector('.chapter-minimal-corner');
        if (minimalCorner) {
          if (self.progress <= 0.08) {
            minimalCorner.classList.add('active');
          } else {
            minimalCorner.classList.remove('active');
          }
        }
      }
    });

    // Story chapters animations (for intermediate chapters if present)
    const chapters = document.querySelectorAll('.hero-story-chapter:not(.chapter-minimal-corner)');
    chapters.forEach((chapter) => {
      const startPct = parseFloat(chapter.dataset.start || 0);
      const endPct = parseFloat(chapter.dataset.end || 1);

      ScrollTrigger.create({
        trigger: '#hero-scroll-section',
        start: () => `top+=${startPct * (this.container.clientHeight - window.innerHeight)} top`,
        end: () => `top+=${endPct * (this.container.clientHeight - window.innerHeight)} top`,
        onEnter: () => chapter.classList.add('active'),
        onLeave: () => chapter.classList.remove('active'),
        onEnterBack: () => chapter.classList.add('active'),
        onLeaveBack: () => chapter.classList.remove('active')
      });
    });
  }

  setupMilestones() {
    const buttons = document.querySelectorAll('.milestone-btn');
    buttons.forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const progress = parseFloat(btn.dataset.progress || 0);
        const scrollDistance = (this.container.clientHeight - window.innerHeight) * progress;
        const targetScroll = this.container.offsetTop + scrollDistance;

        window.scrollTo({
          top: targetScroll,
          behavior: 'smooth'
        });
      });
    });
  }

  updateMilestoneUI(progress) {
    const buttons = document.querySelectorAll('.milestone-btn');
    buttons.forEach((btn) => {
      const btnProgress = parseFloat(btn.dataset.progress || 0);
      const nextProgress = parseFloat(btn.dataset.nextProgress || 1);
      if (progress >= btnProgress - 0.05 && progress < nextProgress) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    const progressFill = document.querySelector('.scrubber-track-fill');
    if (progressFill) {
      progressFill.style.height = `${progress * 100}%`;
    }
  }

  startRenderLoop() {
    const loop = () => {
      this.renderAnimId = requestAnimationFrame(loop);

      // Smooth lerp easing
      const diff = this.targetFrame - this.currentFrame;
      if (Math.abs(diff) > 0.01) {
        this.currentFrame += diff * 0.18;
        this.drawCurrentFrame();
      }
    };
    loop();
  }

  getBestFrame(index) {
    const rounded = Math.round(index);
    if (this.images[rounded]) return this.images[rounded];

    // Search closest loaded frame backward then forward
    for (let offset = 1; offset < 30; offset++) {
      if (rounded - offset >= 0 && this.images[rounded - offset]) {
        return this.images[rounded - offset];
      }
      if (rounded + offset < this.totalFrames && this.images[rounded + offset]) {
        return this.images[rounded + offset];
      }
    }
    return this.images[0] || null;
  }

  drawCurrentFrame() {
    if (!this.ctx || !this.canvas) return;

    const img = this.getBestFrame(this.currentFrame);
    if (!img) return;

    const width = window.innerWidth;
    const height = window.innerHeight;

    // Aspect ratio COVER calculation
    const imgRatio = 1280 / 720;
    const canvasRatio = width / height;

    let drawWidth, drawHeight, offsetX, offsetY;

    if (canvasRatio > imgRatio) {
      drawWidth = width;
      drawHeight = width / imgRatio;
      offsetX = 0;
      offsetY = (height - drawHeight) / 2;
    } else {
      drawHeight = height;
      drawWidth = height * imgRatio;
      offsetX = (width - drawWidth) / 2;
      offsetY = 0;
    }

    this.ctx.clearRect(0, 0, width, height);

    // Save and draw image
    this.ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);

    // Cinematic luxury vignette & warm golden grade
    const gradient = this.ctx.createRadialGradient(
      width / 2, height / 2, Math.min(width, height) * 0.25,
      width / 2, height / 2, Math.max(width, height) * 0.75
    );
    gradient.addColorStop(0, 'rgba(0, 0, 0, 0.08)');
    gradient.addColorStop(0.7, 'rgba(10, 11, 14, 0.45)');
    gradient.addColorStop(1, 'rgba(10, 11, 14, 0.88)');

    this.ctx.fillStyle = gradient;
    this.ctx.fillRect(0, 0, width, height);

    // Bottom subtle blend to seamless dark section
    const bottomGrad = this.ctx.createLinearGradient(0, height * 0.7, 0, height);
    bottomGrad.addColorStop(0, 'rgba(11, 12, 16, 0)');
    bottomGrad.addColorStop(1, 'rgba(11, 12, 16, 1)');
    this.ctx.fillStyle = bottomGrad;
    this.ctx.fillRect(0, height * 0.7, width, height * 0.3);
  }

  destroy() {
    if (this.renderAnimId) cancelAnimationFrame(this.renderAnimId);
    ScrollTrigger.getAll().forEach(t => t.kill());
  }
}
