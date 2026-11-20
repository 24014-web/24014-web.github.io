(() => {
  const root = document.documentElement;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
  const canvas = document.getElementById("particleField");
  const context = canvas?.getContext("2d", { alpha: true });
  const pointerGlow = document.getElementById("pointerGlow");
  const orbitScene = document.getElementById("orbitScene");
  const motionToggle = document.getElementById("motionToggle");
  const motionLabel = motionToggle?.querySelector(".motion-label");
  const progress = document.getElementById("scrollProgress");
  const revealItems = document.querySelectorAll(".reveal");

  root.classList.add("js");

  let paused = reducedMotion.matches;
  let frame = 0;
  let width = 0;
  let height = 0;
  let pixelRatio = 1;
  let particles = [];
  let pointerX = window.innerWidth * 0.68;
  let pointerY = window.innerHeight * 0.4;
  let currentX = pointerX;
  let currentY = pointerY;
  let scrollFrame = 0;
  let lastParticleFrame = 0;

  const random = (min, max) => Math.random() * (max - min) + min;

  function setMotionState() {
    document.documentElement.classList.toggle("motion-paused", paused);
    window.dispatchEvent(new CustomEvent("motionstatechange", { detail: { paused } }));
    if (motionToggle) {
      motionToggle.setAttribute("aria-pressed", String(paused));
      motionToggle.setAttribute("aria-label", paused ? "Resume motion" : "Pause motion");
    }
    if (motionLabel) motionLabel.textContent = paused ? "MOTION OFF" : "MOTION ON";
    if (paused || document.hidden) {
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
      renderParticles(false);
    } else {
      startParticles();
    }
  }

  function resizeCanvas() {
    if (!canvas || !context) return;
    width = window.innerWidth;
    height = window.innerHeight;
    const lowPowerDevice = window.matchMedia("(max-width: 720px)").matches
      || (navigator.hardwareConcurrency || 8) <= 4
      || (navigator.deviceMemory && navigator.deviceMemory <= 4);
    pixelRatio = Math.min(window.devicePixelRatio || 1, lowPowerDevice ? 1 : 1.25);
    canvas.width = Math.round(width * pixelRatio);
    canvas.height = Math.round(height * pixelRatio);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

    const count = Math.min(52, Math.max(18, Math.round((width * height) / 39000)));
    particles = Array.from({ length: count }, () => ({
      x: random(0, width),
      y: random(0, height),
      vx: random(-0.1, 0.1),
      vy: random(-0.08, 0.08),
      radius: random(0.35, 1.25),
      alpha: random(0.13, 0.48),
      phase: random(0, Math.PI * 2),
      speed: random(0.00025, 0.00075),
    }));

    renderParticles(false);
  }

  function renderParticles(animate, time = 0, delta = 1) {
    if (!context) return;
    context.clearRect(0, 0, width, height);
    const pointerEase = 1 - Math.pow(0.975, delta);
    currentX += (pointerX - currentX) * pointerEase;
    currentY += (pointerY - currentY) * pointerEase;

    for (let i = 0; i < particles.length; i += 1) {
      const particle = particles[i];
      if (animate) {
        particle.x += particle.vx * delta;
        particle.y += particle.vy * delta;

        const dx = particle.x - currentX;
        const dy = particle.y - currentY;
        const distance = Math.hypot(dx, dy);
        if (distance < 115 && distance > 0) {
          const force = ((115 - distance) / 1150) * delta;
          particle.x += (dx / distance) * force;
          particle.y += (dy / distance) * force;
        }

        if (particle.x < -8) particle.x = width + 8;
        if (particle.x > width + 8) particle.x = -8;
        if (particle.y < -8) particle.y = height + 8;
        if (particle.y > height + 8) particle.y = -8;
      }

      const shimmer = animate ? 0.68 + Math.sin(time * particle.speed + particle.phase) * 0.32 : 0.76;
      context.beginPath();
      context.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
      context.fillStyle = `rgba(203, 225, 210, ${particle.alpha * shimmer})`;
      context.fill();

      for (let j = i + 1; j < particles.length; j += 1) {
        const other = particles[j];
        const dx = particle.x - other.x;
        const dy = particle.y - other.y;
        const distanceSquared = dx * dx + dy * dy;
        if (distanceSquared < 12544) {
          const lineDistance = Math.sqrt(distanceSquared);
          context.beginPath();
          context.moveTo(particle.x, particle.y);
          context.lineTo(other.x, other.y);
          context.strokeStyle = `rgba(167, 197, 177, ${(1 - lineDistance / 112) * 0.085})`;
          context.lineWidth = 0.55;
          context.stroke();
        }
      }
    }
  }

  function tick(time) {
    if (time - lastParticleFrame < 1000 / 36) {
      frame = requestAnimationFrame(tick);
      return;
    }
    const delta = lastParticleFrame ? Math.min((time - lastParticleFrame) / (1000 / 60), 2) : 1;
    lastParticleFrame = time;
    renderParticles(true, time, delta);
    frame = requestAnimationFrame(tick);
  }

  function startParticles() {
    if (!frame && !paused && !document.hidden && context) {
      lastParticleFrame = 0;
      frame = requestAnimationFrame(tick);
    }
  }

  function updateScrollProgress() {
    scrollFrame = 0;
    const maximum = document.documentElement.scrollHeight - window.innerHeight;
    const amount = maximum > 0 ? window.scrollY / maximum : 0;
    if (progress) progress.style.transform = `scaleX(${Math.min(1, Math.max(0, amount))})`;
  }

  resizeCanvas();
  setMotionState();
  updateScrollProgress();

  if (motionToggle) {
    motionToggle.addEventListener("click", () => {
      paused = !paused;
      setMotionState();
    });
  }

  if (finePointer.matches) {
    window.addEventListener("pointermove", (event) => {
      pointerX = event.clientX;
      pointerY = event.clientY;
      if (pointerGlow) {
        pointerGlow.style.transform = `translate3d(${pointerX - 340}px, ${pointerY - 340}px, 0)`;
      }
    }, { passive: true });

    window.addEventListener("pointerleave", () => {
      pointerX = width * 0.68;
      pointerY = height * 0.4;
    });

    if (orbitScene) {
      const hero = orbitScene.closest(".hero-art");
      hero?.addEventListener("pointermove", (event) => {
        if (paused) return;
        const bounds = hero.getBoundingClientRect();
        const x = (event.clientX - bounds.left) / bounds.width - 0.5;
        const y = (event.clientY - bounds.top) / bounds.height - 0.5;
        hero.style.setProperty("--specular-x", ((x + 0.5) * 100).toFixed(1) + "%");
        hero.style.setProperty("--specular-y", ((y + 0.5) * 100).toFixed(1) + "%");
        orbitScene.style.transform = `rotateX(${(-y * 9).toFixed(2)}deg) rotateY(${(x * 11).toFixed(2)}deg)`;
      }, { passive: true });
      hero?.addEventListener("pointerleave", () => {
        orbitScene.style.transform = "rotateX(0deg) rotateY(0deg)";
        hero.style.setProperty("--specular-x", "52%");
        hero.style.setProperty("--specular-y", "42%");
      });
    }

    document.querySelectorAll("[data-tilt]").forEach((card) => {
      card.addEventListener("pointermove", (event) => {
        if (paused) return;
        const bounds = card.getBoundingClientRect();
        const x = (event.clientX - bounds.left) / bounds.width;
        const y = (event.clientY - bounds.top) / bounds.height;
        card.style.setProperty("--rotate-y", `${((x - 0.5) * 5).toFixed(2)}deg`);
        card.style.setProperty("--rotate-x", `${((0.5 - y) * 5).toFixed(2)}deg`);
        card.style.setProperty("--shine-x", `${(x * 100).toFixed(1)}%`);
        card.style.setProperty("--shine-y", `${(y * 100).toFixed(1)}%`);
      }, { passive: true });
      card.addEventListener("pointerleave", () => {
        card.style.setProperty("--rotate-y", "0deg");
        card.style.setProperty("--rotate-x", "0deg");
        card.style.setProperty("--shine-x", "50%");
        card.style.setProperty("--shine-y", "0%");
      });
    });
  }

  if ("IntersectionObserver" in window && !reducedMotion.matches) {
    const observer = new IntersectionObserver((entries, activeObserver) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          activeObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -30px 0px" });
    revealItems.forEach((item) => observer.observe(item));
  } else {
    revealItems.forEach((item) => item.classList.add("is-visible"));
  }

  window.addEventListener("resize", () => {
    resizeCanvas();
    if (!paused) startParticles();
    updateScrollProgress();
  }, { passive: true });

  window.addEventListener("scroll", () => {
    if (!scrollFrame) scrollFrame = requestAnimationFrame(updateScrollProgress);
  }, { passive: true });

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
      lastParticleFrame = 0;
    } else if (!paused) {
      startParticles();
    }
  });

  const year = document.getElementById("year");
  if (year) year.textContent = String(new Date().getFullYear());
})();

