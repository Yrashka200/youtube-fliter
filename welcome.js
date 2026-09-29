document.getElementById("ver").textContent =
  chrome.runtime.getManifest().version;

const slides = Array.from(document.querySelectorAll(".slide"));
const dotsWrap = document.getElementById("dots");
const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");
const skipBtn = document.getElementById("skipBtn");

let current = 0;

slides.forEach((_, i) => {
  const d = document.createElement("div");
  d.className = "dot";
  d.addEventListener("click", () => goTo(i));
  dotsWrap.appendChild(d);
});

const dots = Array.from(dotsWrap.children);

function render() {
  slides.forEach((s, i) => {
    s.classList.remove("active", "exit-left");

    if (i === current) {
      s.classList.add("active");
    } else if (i < current) {
      s.classList.add("exit-left");
    }
  });

  dots.forEach((d, i) => {
    d.classList.toggle("active", i === current);
    d.classList.toggle("done", i < current);
  });

  prevBtn.disabled = current === 0;

  if (current === slides.length - 1) {
    nextBtn.textContent = "Get Started →";
  } else {
    nextBtn.textContent = "Next →";
  }
}

function goTo(index) {
  if (index < 0 || index >= slides.length) return;
  current = index;
  render();
}

function next() {
  if (current === slides.length - 1) {
    finish();
    return;
  }
  goTo(current + 1);
}

function prev() {
  goTo(current - 1);
}

function finish() {
  chrome.tabs.create({ url: "https://www.youtube.com/" });
  window.close();
}

nextBtn.addEventListener("click", next);
prevBtn.addEventListener("click", prev);
skipBtn.addEventListener("click", finish);

document.addEventListener("keydown", (e) => {
  if (e.key === "ArrowRight") next();
  else if (e.key === "ArrowLeft") prev();
  else if (e.key === "Escape") finish();
});

render();