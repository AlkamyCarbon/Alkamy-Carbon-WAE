window.loadPage = async function (page) {
const [path, queryString] = page.split("?");
window.currentParams = new URLSearchParams(queryString || "");

  setActiveSidebar(path);

  const res = await fetch(page);
  const html = await res.text();

  const temp = document.createElement("div");
  temp.innerHTML = html;

  const bodyContent = temp.querySelector("body");

  document.getElementById("content").innerHTML =
    bodyContent ? bodyContent.innerHTML : html;

  // 🧹 Remove previously injected page scripts
  document.querySelectorAll("script[data-page-script]").forEach(s => s.remove());

  // 🔁 Re-run only page-level scripts
  temp.querySelectorAll("script").forEach(oldScript => {
    // 🚫 NEVER re-run firebase or core app scripts
    if (
      oldScript.src &&
      (
        oldScript.src.includes("firebase-config") ||
        oldScript.src.includes("firebase-app") ||
        oldScript.src.includes("firebase-auth") ||
        oldScript.src.includes("firebase-firestore") ||
        oldScript.src.includes("firebase-storage") ||
        oldScript.src.includes("app.js")
      )
    ) {
      return;
    }

    const script = document.createElement("script");
    script.dataset.pageScript = "true";

    if (oldScript.src) {
      script.src = oldScript.src;
    } else {
      script.textContent = oldScript.textContent;
    }

    document.body.appendChild(script);
  });

  window.scrollTo(0, 0);

  if (page.includes("LSD.html")) {
  if (window.initLSDDashboard) await window.initLSDDashboard();
  if (window.initLSDDeleteHandler) window.initLSDDeleteHandler();
}

if (page.includes("pickup.html") && window.initPickupPage) {
  window.initPickupPage();
}

if (page.includes("drop.html") && window.initDropPage) {
  window.initDropPage();
}

if (page.includes("view.html") && window.initViewPage) {
  await window.initViewPage();
}

if (page.includes("processing.html") && window.initProcessingPage) {
  window.initProcessingPage();
}

if (page.includes("mining.html") && window.initMiningPage) {
  window.initMiningPage();
}

if (page.includes("mining-dashboard.html") && window.initMiningDashboard) {
  await window.initMiningDashboard();
}

if (page.includes("processing-dashboard.html") && window.initProcessingDashboard) {
  await window.initProcessingDashboard();
}

if (page.includes("transport-dashboard.html") && window.initTransportDashboard) {
  await window.initTransportDashboard();
}

if (page.includes("projects.html") && window.initProjectsPage) {
  await window.initProjectsPage();
}

if (page.includes("plant.html") && window.initPlantPage) {
  window.initPlantPage();
}

if (window.feather) feather.replace();

};




/* Sidebar navigation */
document.querySelectorAll(".nav-item[data-page]").forEach(link => {
  link.addEventListener("click", () => {
    setActiveSidebar(link.dataset.page);
    loadPage(link.dataset.page);
  });
});


function setActiveSidebar(page) {
  document.querySelectorAll(".sidebar-item").forEach(item => {
    item.classList.remove("active");
  });

  const activeLink = document.querySelector(
    `.nav-item[data-page="${page}"]`
  );

  if (activeLink) {
    activeLink.closest(".sidebar-item").classList.add("active");
  }
}

/* Load default page */
setActiveSidebar("LSD.html");
loadPage("LSD.html");