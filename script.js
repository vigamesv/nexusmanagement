// Scroll reveal animations
const reveals = document.querySelectorAll(".reveal");

function revealOnScroll() {
  for (let i = 0; i < reveals.length; i++) {
    const windowHeight = window.innerHeight;
    const elementTop = reveals[i].getBoundingClientRect().top;
    const elementVisible = 150;

    if (elementTop < windowHeight - elementVisible) {
      reveals[i].classList.add("active");
    } else {
      reveals[i].classList.remove("active");
    }
  }
}
window.addEventListener("scroll", revealOnScroll);

// Fade-in hero text
document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll(".fade-in").forEach((el, i) => {
    setTimeout(() => el.classList.add("active"), i * 500);
  });
});

// Hero button scrolls to plans
const exploreBtn = document.querySelector(".explore-btn");
if (exploreBtn) {
  exploreBtn.addEventListener("click", () => {
    document.querySelector("#plans").scrollIntoView({ behavior: "smooth" });
  });
}

// Select Plan button actions → redirect to login.html
document.querySelectorAll(".select-btn").forEach(button => {
  button.addEventListener("click", () => {
    if (button.textContent.includes("Free")) {
      window.location.href = "/plans/free/login.html";
    } else if (button.textContent.includes("Premium")) {
      window.location.href = "/plans/premium_plan/login.html";
    }
  });
});
// Show Dashboard button if token exists in URL or localStorage
document.addEventListener("DOMContentLoaded", () => {
  const token = localStorage.getItem("sessionToken");
  if (token) {
    document.getElementById("dashboardBtn").style.display = "inline-block";
    document.getElementById("dashboardBtn").onclick = () => {
      window.location.href = "/dashboard/user.html?token=" + token;
    };
  }
});

