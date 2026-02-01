<script>
  const animatedElements = document.querySelectorAll('.animate');
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        animateCounters();
      }
    });
  }, { threshold: 0.2 });

  animatedElements.forEach(el => observer.observe(el));

  function animateCounters() {
    const counters = document.querySelectorAll('.stat-value');
    counters.forEach(counter => {
      const target = +counter.getAttribute('data-target');
      let count = 0;
      const increment = target / 100;
      counter.innerHTML = "0 / " + target;
      const update = () => {
        count += increment;
        if (count < target) {
          counter.textContent = Math.floor(count) + " / " + target;
          requestAnimationFrame(update);
        } else {
          counter.textContent = target + " / " + target;
          // ✅ Add glow if value > 0
          if (target > 0) {
            counter.classList.add("active");
          }
        }
      };
      update();
    });
  }
</script>
