/*************************************************
 * AUTH READY GATE (CRITICAL)
 *************************************************/
let authReadyResolve;
const authReady = new Promise(resolve => {
  authReadyResolve = resolve;
});

firebase.auth().onAuthStateChanged(user => {
  if (user) {
    console.log("✅ Auth ready");
    authReadyResolve();
  }
});



/*************************************************
 * FIRESTORE HELPERS
 *************************************************/
const SHIPMENTS_COLLECTION = "shipments";

async function saveShipmentToFirestore(entry) {
  await authReady;
  return db
    .collection(SHIPMENTS_COLLECTION)
    .doc(entry.id)
    .set(entry, { merge: true });
}

async function loadShipmentsFromFirestore() {
  await authReady;
  const snapshot = await db.collection(SHIPMENTS_COLLECTION).get();
  return snapshot.docs.map(d => d.data());
}

async function loadShipmentById(id) {
  await authReady;
  const doc = await db.collection(SHIPMENTS_COLLECTION).doc(id).get();
  return doc.exists ? doc.data() : null;
}

async function deleteShipmentFromFirestore(id) {
  await authReady;
  return db.collection("shipments").doc(id).delete();
}


/*************************************************
 * GLOBAL CONFIG
 *************************************************/
const STORAGE_KEY = "shipments";

/*************************************************
 * STORAGE HELPERS
 *************************************************/
function loadShipments() {
  return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
}

function saveShipments(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

/*************************************************
 * VALIDATION HELPERS
 *************************************************/
function validImage(url) {
  if (!url) return "No";
  return typeof url === "string" ? "Yes" : "Yes_invalid";
}

function validLocation(loc) {
  if (!loc) return "No";
  if (!Array.isArray(loc)) return "Yes_invalid";

  const [lat, lng] = loc;
  if (isNaN(lat) || isNaN(lng)) return "Yes_invalid";
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return "Yes_invalid";

  return "Yes";
}

function overallFlag(entry) {

  const pickupComplete =
    validImage(entry.pickup?.photo) === "Yes" &&
    validLocation(entry.pickup?.location) === "Yes" &&
    !!entry.pickup?.truckNo &&
    !!entry.pickup?.weight;

  const processingComplete =
    !!entry.processing?.processorName &&
    !!entry.processing?.finalPSD;

  const dropComplete =
    validImage(entry.drop?.photo) === "Yes" &&
    validLocation(entry.drop?.location) === "Yes";

  const anyInvalid =
    validImage(entry.pickup?.photo) === "Yes_invalid" ||
    validLocation(entry.pickup?.location) === "Yes_invalid" ||
    validImage(entry.drop?.photo) === "Yes_invalid" ||
    validLocation(entry.drop?.location) === "Yes_invalid";

  // 🔴 Hard invalid
  if (anyInvalid) return "red";

  // 🟢 Fully complete
  if (pickupComplete && processingComplete && dropComplete)
    return "green";

  // 🟡 Anything started but not finished
  if (pickupComplete || processingComplete || dropComplete)
    return "orange";

  // 🔴 Nothing started
  return "red";
}

function statusSpan(status) {
  if (status === "Yes") return `<span class="status-yes">Yes</span>`;
  if (status === "No") return `<span class="status-no">No</span>`;
  return `<span class="status-invalid">Yes_invalid</span>`;
}

/*************************************************
 * IMAGE COMPRESSION
 *************************************************/
async function compressImage(file, maxWidth = 1280, quality = 0.7) {
  return new Promise(resolve => {
    const img = new Image();
    const reader = new FileReader();

    reader.onload = e => (img.src = e.target.result);

    img.onload = () => {
      const scale = Math.min(maxWidth / img.width, 1);
      const canvas = document.createElement("canvas");

      canvas.width = img.width * scale;
      canvas.height = img.height * scale;

      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      canvas.toBlob(blob => resolve(blob), "image/jpeg", quality);
    };

    reader.readAsDataURL(file);
  });
}

/*************************************************
 * FIREBASE UPLOAD
 *************************************************/
async function uploadImageToFirebase(blob, path) {
  await authReady; // 🔥 REQUIRED
  const ref = storage.ref(path);
  await ref.put(blob);
  return await ref.getDownloadURL();
}

function uploadImageToFirebaseWithProgress(blob, path, progressBarId) {
  return new Promise(async (resolve, reject) => {
    await authReady;

    const ref = storage.ref(path);
    const task = ref.put(blob);
    const progressEl = document.getElementById(progressBarId);

    task.on(
      "state_changed",
      snapshot => {
        if (progressEl) {
          const percent =
            (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          progressEl.style.width = percent + "%";
        }
      },
      error => reject(error),
      async () => {
        const url = await task.snapshot.ref.getDownloadURL();
        resolve(url);
      }
    );
  });
}

/*************************************************
 * DASHBOARD (LSD.html)
 *************************************************/
window.initLSDDashboard = async function () {
  const table = document.getElementById("shipmentTable");
  if (!table) return;

    const shipments = await loadShipmentsFromFirestore();

  let totalWeight = 0;
  let totalDistance = 0;

  shipments.forEach(s => {
   const pickupPhotoStatus = validImage(s.pickup?.photo);
   const dropPhotoStatus = validImage(s.drop?.photo);
   const pickupLocStatus = validLocation(s.pickup?.location);
   const dropLocStatus = validLocation(s.drop?.location);


    const flag = overallFlag(s, [
      pickupPhotoStatus,
      pickupLocStatus,
      dropLocStatus,
      dropPhotoStatus
    ]);

   /* ===== STAGE COMPLETION CHECKS ===== */

/* ===== STAGE COMPLETION CHECKS ===== */

const sourcingComplete =
  !!s.sourcing?.supplier &&
  !!s.sourcing?.particleSize &&
  !!s.sourcing?.crushingTech &&
  !!s.sourcing?.miningTech &&
  !!s.sourcing?.stockPoint;

const processingComplete =
  !!s.processing?.processorName &&
  !!s.processing?.receivedSize &&
  !!s.processing?.finalPSD &&
  !!s.processing?.processingTech &&
  !!s.processing?.stockPoint;

const transportComplete =
  validImage(s.drop?.photo) === "Yes" &&
  validLocation(s.drop?.location) === "Yes";

/* ===== SOURCING COLUMN ===== */

const miningStatus = s.mining
  ? `<span class="badge bg-success">Completed</span>`
  : `<button class="btn btn-sm btn-outline-primary"
      onclick="loadPage('mining.html?id=${s.id}')">
      + Mining
    </button>`;

/* ===== PROCESSING COLUMN ===== */

const processingStatus = s.processing
  ? `<span class="badge bg-success">Completed</span>`
  : `<button class="btn btn-sm btn-outline-primary"
      onclick="loadPage('processing.html?id=${s.id}')">
      + Processing
    </button>`;

/* ===== TRANSPORT COLUMN ===== */

const transportStatus = transportComplete
  ? `<span class="badge bg-success">Completed</span>`
  : `<button class="btn btn-sm btn-outline-primary"
      onclick="loadPage('drop.html?id=${s.id}')">
      + Transport
    </button>`;


    const tr = document.createElement("tr");
    tr.innerHTML = `
 <td>
    <input type="checkbox" class="row-check" data-id="${s.id}">
  <td>
  <span class="badge rounded-pill ${
    flag === "green" ? "bg-success" :
    flag === "blue" ? "bg-primary" :
    flag === "orange" ? "bg-warning text-dark" :
    "bg-danger"
  } px-3">
  </span>
</td>
      <td>${s.id}</td>
      <td>${new Date(s.createdAt).toLocaleString()}</td>
      <td>${s.pickup?.weight || "—"}</td>
      <td>${s.pickup?.truckNo || "—"}</td>
 <td>
  ${s.drop?.distance !== undefined && s.drop?.distance !== null
    ? Number(s.drop.distance).toFixed(2)
    : "—"}
</td>
	<td>${miningStatus}</td>
	<td>${processingStatus}</td>
	<td>${transportStatus}</td>
    `;

tr.addEventListener("click", e => {
if (["INPUT", "A", "BUTTON", "LABEL"].includes(e.target.tagName)) {
  return;
}  
  loadPage(`view.html?id=${s.id}`);
});

    table.appendChild(tr);

    totalWeight += Number(s.pickup?.weight || 0);
    totalDistance += Number(s.drop?.distance || 0);
  });

  document.getElementById("totalTrips").innerText = shipments.length;
  document.getElementById("totalMineral").innerText = totalWeight.toFixed(0);
  document.getElementById("avgWeight").innerText =
    shipments.length ? (totalWeight / shipments.length).toFixed(0) : 0;
  document.getElementById("avgDistance").innerText =
    shipments.length ? (totalDistance / shipments.length).toFixed(1) : 0;

// Render Monthly Material Chart

renderMaterialChart(shipments);

function renderMaterialChart(shipments) {

  const ctx = document.getElementById("materialChart");
  if (!ctx) return;

  if (window.materialChartInstance) {
    window.materialChartInstance.destroy();
  }

  const monthly = new Array(12).fill(0);

  shipments.forEach(entry => {
    if (!entry.pickup?.weight || !entry.createdAt) return;
    const date = new Date(entry.createdAt);
    monthly[date.getMonth()] += Number(entry.pickup.weight);
  });

  const labels = [
    "Jan","Feb","Mar","Apr","May","Jun",
    "Jul","Aug","Sep","Oct","Nov","Dec"
  ];

  window.materialChartInstance = new Chart(ctx, {
    type: "bar",
    data: {
      labels: labels,
      datasets: [{
        data: monthly,
        backgroundColor: "#1e3a5f",
        borderRadius: 6,
        barThickness: 18
      }]
    },
 bar: {
    borderRadius: 6,     
    barHeight: "70%",
 borderRadiusApplication: 'end'
  },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: "#1e293b",
          titleColor: "#ffffff",
          bodyColor: "#ffffff"
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: {
            color: "#94a3b8",
            font: { size: 12 }
          }
        },
        y: {
          beginAtZero: true,
          ticks: {
            color: "#94a3b8",
            maxTicksLimit: 3,
            font: { size: 12 }
          },
          grid: {
            color: "#e2e8f0",
            drawBorder: false
          },
          title: {
            display: true,
            text: "Tons",
            color: "#94a3b8",
            font: { weight: 500 }
          }
        }
      }
    }
  });
}

renderStatusChart(shipments);

function renderStatusChart(shipments) {

  const ctx = document.getElementById("statusChart");
  if (!ctx) return;

  if (window.statusChartInstance) {
    window.statusChartInstance.destroy();
  }

  let completed = 0;
  let inProgress = 0;
  let flagged = 0;

  shipments.forEach(s => {
    const flag = overallFlag(s);
    if (flag === "green") completed++;
    else if (flag === "blue" || flag === "orange") inProgress++;
    else flagged++;
  });

  const total = shipments.length || 1;
  const pct = v => ((v / total) * 100).toFixed(1) + "%";

  document.getElementById("pctCompleted").innerText = pct(completed);
  document.getElementById("pctProgress").innerText = pct(inProgress);
  document.getElementById("pctFlagged").innerText = pct(flagged);

  window.statusChartInstance = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: ["Completed", "In Progress", "Flagged"],
      datasets: [{
        data: [completed, inProgress, flagged],
        backgroundColor: [
          "#22c55e",
          "#f59e0b",
          "#ef4444"
        ],
        borderWidth: 0
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      cutout: "78%",
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: "#1e293b",
          titleColor: "#ffffff",
          bodyColor: "#ffffff"
        }
      }
    }
  });
}
};

/*************************************************
 * DASHBOARD – DELETE SELECTION HANDLER
 *************************************************/
window.initLSDDeleteHandler = function () {

const deleteBtn = document.getElementById("deleteBtn");
const selectAll = document.getElementById("selectAll");

function updateDeleteUI() {
  const rows = document.querySelectorAll(".row-check");
  const checked = document.querySelectorAll(".row-check:checked");

  deleteBtn.classList.toggle("d-none", checked.length === 0);

  if (selectAll) {
    selectAll.checked =
      rows.length > 0 && checked.length === rows.length;
  }
}

document.addEventListener("change", e => {
  // Individual row checkbox
  if (e.target.classList.contains("row-check")) {
    updateDeleteUI();
  }

  // Select all checkbox
  if (e.target.id === "selectAll") {
    document
      .querySelectorAll(".row-check")
      .forEach(cb => (cb.checked = e.target.checked));
    updateDeleteUI();
  }
});

deleteBtn.onclick = async () => {
  const checked = document.querySelectorAll(".row-check:checked");
  if (!checked.length) return;

  const password = prompt(
    `Enter password to delete ${checked.length} shipment(s):`
  );
  if (password !== "alkamycdr") {
    alert("❌ Incorrect password");
    return;
  }

  if (!confirm("This will permanently delete selected shipments. Continue?"))
    return;

  try {
    for (const cb of checked) {
      const id = cb.dataset.id;
      await deleteShipmentFromFirestore(id);
      cb.closest("tr").remove();
    }
    updateDeleteUI();
  } catch (err) {
    console.error(err);
    alert("Delete failed");
  }
};



}

/*************************************************
 * PICKUP FORM (pickup.html)
 *************************************************/
let currentPickup = null;


window.getPickupLocation = function () {

  navigator.geolocation.getCurrentPosition(pos => {
    currentPickup = [pos.coords.latitude, pos.coords.longitude];
    document.getElementById("pickupLoc").innerText = currentPickup.join(", ");
pickupLoc.textContent = "Location captured successfully";
  });
};


window.initPickupPage = function () {
  if (!document.getElementById("pickupForm")) return;

  let isUploading = false;
  const progressBar = document.getElementById("pickupProgress");

  document.getElementById("pickupForm").onsubmit = async e => {
    e.preventDefault();

    if (isUploading) return;
    isUploading = true;

    const submitBtn = e.target.querySelector("button[type='submit']");
    submitBtn.disabled = true;
    submitBtn.innerText = "Uploading...";

    try {
      const shipments = loadShipments();
      const file = document.getElementById("pickupPhoto").files[0];
      let pickupPhotoUrl = null;

      if (file) {
        const compressed = await compressImage(file);
        pickupPhotoUrl = await uploadImageToFirebaseWithProgress(
          compressed,
          `pickups/${Date.now()}_${file.name}`,
          "pickupProgress"
        );
      }

      shipments.push({
  id: "TRK-" + Date.now(),
  createdAt: new Date().toISOString(),

  pickup: {
    truckNo: document.getElementById("truckNo").value,
    weight: document.getElementById("weight").value,
    location: currentPickup,
    photo: pickupPhotoUrl
  },

  sourcing: null,
  processing: null,
  drop: null
});


      await saveShipmentToFirestore(shipments[shipments.length - 1]);

      isUploading = false;
      loadPage("LSD.html");

    } catch (err) {
      console.error(err);
      alert("Upload failed. Try again.");
      isUploading = false;
      submitBtn.disabled = false;
      submitBtn.innerText = "Save Pickup";
    }
  };
};

/*************************************************
 * DROP FORM (drop.html)
 *************************************************/

let currentDrop = null;

window.getDropLocation = function () {
  navigator.geolocation.getCurrentPosition(pos => {
    currentDrop = [pos.coords.latitude, pos.coords.longitude];
    document.getElementById("dropLoc").innerText = currentDrop.join(", ");
  });
};


window.initDropPage = function () {
  if (!document.getElementById("dropForm")) return;

(async () => {
  const id = window.currentParams?.get("id");

if (!id) {
  alert("Missing Trip ID");
  loadPage("LSD.html");
  return;
}

  const entry = await loadShipmentById(id);


  if (!entry) {
    alert("Invalid Trip ID");
    loadPage("LSD.html");
  }

  let isUploading = false;
const submitBtn = document.querySelector("#dropForm button[type='submit']");
const progressBar = document.getElementById("dropProgress");
 

  document.getElementById("dropForm").onsubmit = async e => {
e.preventDefault();

const dropSite = document.getElementById("dropSite").value;

if (!dropSite) {
  alert("Please select drop location");
  throw new Error("Drop site missing");
}

if (isUploading) return;
isUploading = true;

    submitBtn.disabled = true;
    submitBtn.innerText = "Uploading...";

    try {

	await authReady;

      if (!currentDrop) {
        alert("Please capture drop location first");
        throw new Error("Drop location missing");
      }

      const file = document.getElementById("dropPhoto").files[0];
      let dropPhotoUrl = null;

      if (file) {

        const compressed = await compressImage(file);
        dropPhotoUrl = await uploadImageToFirebaseWithProgress(
          compressed,
          `drops/${Date.now()}_${file.name}`,
          "dropProgress"
        );
      }

      entry.drop = {
site: dropSite,
  location: currentDrop,
  photo: dropPhotoUrl
};

if (entry.pickup?.location && entry.drop?.location) {

  const p1 = L.latLng(entry.pickup.location);
  const p2 = L.latLng(entry.drop.location);
 entry.drop.distance = p1.distanceTo(p2) / 1000;
}

      await saveShipmentToFirestore(entry);

      isUploading = false;
      loadPage("LSD.html");
   
 } catch (err) {
      console.error(err);
      alert("Drop upload failed. Try again.");

	isUploading = false;
      submitBtn.disabled = false;
      submitBtn.innerText = "Save Drop";
    }
  };
})();

};

// Fix Leaflet default icon path
delete L.Icon.Default.prototype._getIconUrl;

L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png"
});

/*************************************************
 * TRIP DETAIL VIEW (view.html)
 *************************************************/
window.initViewPage = async function () {

  // Important: match NEW layout
  if (!document.getElementById("viewTripId")) return;

  const id = window.currentParams?.get("id");
  if (!id) {
    alert("Missing Trip ID");
    loadPage("LSD.html");
    return;
  }

  const entry = await loadShipmentById(id);
  if (!entry) {
    alert("Trip not found");
    loadPage("LSD.html");
    return;
  }

  /* ===============================
     POPULATE DATA
  =============================== */

  // Logistics
  document.getElementById("viewTripId").innerText =
    entry.id || "—";

  document.getElementById("viewCreatedAt").innerText =
    entry.createdAt
      ? new Date(entry.createdAt).toLocaleString()
      : "—";

  document.getElementById("viewTruck").innerText =
    entry.pickup?.truckNo || "—";

  document.getElementById("viewMaterial").innerText =
    entry.pickup?.weight || "—";

  document.getElementById("viewDistance").innerText =
    entry.drop?.distance !== null &&
    entry.drop?.distance !== undefined
      ? `${Number(entry.drop.distance).toFixed(2)} km`
      : "—";

  // Mining
  document.getElementById("viewCrusher").innerText =
    entry.mining?.crusherName || "—";

  // Processing
  document.getElementById("viewProcessor").innerText =
    entry.processing?.processorName || "—";

  document.getElementById("viewFinalPSD").innerText =
    entry.processing?.finalPSD || "—";

  document.getElementById("viewPurity").innerText =
    entry.processing?.purity ||
    entry.mining?.purity ||
    "—";

  // Transport
  document.getElementById("viewPickupLoc").innerText =
    entry.pickup?.location
      ? entry.pickup.location.join(", ")
      : "—";

  document.getElementById("viewDropLoc").innerText =
    entry.drop?.location
      ? entry.drop.location.join(", ")
      : "—";

  document.getElementById("viewDropSite").innerText =
    entry.drop?.site || "—";

  // Photos
  if (entry.pickup?.photo) {
    document.getElementById("viewPickupPhoto").innerHTML =
      `<a href="${entry.pickup.photo}" target="_blank">
         <img src="${entry.pickup.photo}"
              style="max-width:140px;border-radius:8px;margin-bottom:6px" />
       </a><br>
       <a href="${entry.pickup.photo}" download>⬇ Download</a>`;
  }

  if (entry.drop?.photo) {
    document.getElementById("viewDropPhoto").innerHTML =
      `<a href="${entry.drop.photo}" target="_blank">
         <img src="${entry.drop.photo}"
              style="max-width:140px;border-radius:8px;margin-bottom:6px" />
       </a><br>
       <a href="${entry.drop.photo}" download>⬇ Download</a>`;
  }

  /* ===============================
     MAP + ROUTE RENDER
  =============================== */

  if (entry.pickup?.location && entry.drop?.location) {

    const start = entry.pickup.location;
    const end = entry.drop.location;

    const mapContainer = document.getElementById("map");
    if (!mapContainer) return;

    // Prevent double initialization
    if (mapContainer._leaflet_id) {
      mapContainer._leaflet_id = null;
    }

    const map = L.map("map", {
      zoomControl: true
    }).setView(start, 10);

    L.tileLayer(
      "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
      { attribution: "© OpenStreetMap" }
    ).addTo(map);

    L.marker(start).addTo(map).bindPopup("Pickup");
    L.marker(end).addTo(map).bindPopup("Drop");

    const bounds = L.latLngBounds([start, end]);
    map.fitBounds(bounds, { padding: [40, 40] });

    // OSRM ROUTE POLYLINE
    fetch(
      `https://router.project-osrm.org/route/v1/driving/${start[1]},${start[0]};${end[1]},${end[0]}?overview=full&geometries=geojson`
    )
      .then(res => res.json())
      .then(data => {

        if (!data.routes || !data.routes.length) return;

        const route = data.routes[0];

        L.geoJSON(route.geometry, {
          style: {
            color: "#2563eb",
            weight: 5
          }
        }).addTo(map);

        const routeKm = (route.distance / 1000).toFixed(2);

        const el = document.getElementById("routeDistance");
        if (el) {
          el.innerText = `Route Distance: ${routeKm} km`;
        }

        // CRITICAL for proper render inside card layout
        setTimeout(() => {
          map.invalidateSize();
        }, 300);

      });
  }
};

/*************************************************
 * Processing form
 *************************************************/

let currentProcessing = null;

window.getProcessingLocation = function () {
  navigator.geolocation.getCurrentPosition(pos => {
    currentProcessing = [
      pos.coords.latitude,
      pos.coords.longitude
    ];

    document.getElementById("processingLoc").innerText =
      currentProcessing.join(", ");
  });
};

window.initProcessingPage = function () {

  setTimeout(() => {

    const form = document.getElementById("processingForm");
    if (!form) return;

    let isUploading = false;

    form.onsubmit = async e => {
      e.preventDefault();

      if (isUploading) return;
      isUploading = true;

      const submitBtn = form.querySelector("button[type='submit']");
      submitBtn.disabled = true;
      submitBtn.innerText = "Uploading...";

      try {

        const id = window.currentParams?.get("id");
        if (!id) {
          alert("Missing Trip ID");
          loadPage("LSD.html");
          return;
        }

        const entry = await loadShipmentById(id);
        if (!entry) {
          alert("Invalid Trip ID");
          loadPage("LSD.html");
          return;
        }

        const processorName = document.getElementById("processorName");
        const processingTech = document.getElementById("processingTech");
        const initialPSD = document.getElementById("initialPSD");
        const finalPSD = document.getElementById("finalPSD");
        const purity = document.getElementById("purity");
        const packaging = document.getElementById("packaging");
        const processingPhotoInput = document.getElementById("processingPhoto");

        if (!processorName || !processingTech) {
          alert("Form elements not found.");
          return;
        }

        let photoUrl = null;
        const file = processingPhotoInput?.files[0];

        if (file) {
          const compressed = await compressImage(file);
          photoUrl = await uploadImageToFirebaseWithProgress(
            compressed,
            `processing/${Date.now()}_${file.name}`,
            "processingProgress"
          );
        }

        entry.processing = {
          processorName: processorName.value,
          processingTech: processingTech.value,
          initialPSD: initialPSD.value,
          finalPSD: finalPSD.value,
          purity: purity.value,
          packaging: packaging.value,
          photo: photoUrl,
          location: window.currentProcessingLocation || null
        };

        await saveShipmentToFirestore(entry);

        loadPage("LSD.html");

      } catch (err) {
        console.error(err);
        alert("Processing upload failed.");
      }
    };

  }, 0); // ← critical
};

/*************************************************
 * Mining form
 *************************************************/


window.initMiningPage = function () {
  if (!document.getElementById("miningForm")) return;

  document.getElementById("miningForm").onsubmit = async e => {
    e.preventDefault();

    const id = window.currentParams?.get("id");
    if (!id) {
      alert("Missing Trip ID");
      loadPage("LSD.html");
      return;
    }

    const entry = await loadShipmentById(id);

    entry.mining = {
      crusherName: document.getElementById("crusherName").value,
      crushingTech: document.getElementById("crushingTech").value,
      initialSize: document.getElementById("initialSize").value,
      finalSize: document.getElementById("finalSize").value,
      purity: document.getElementById("miningPurity").value,
      stockPoint: document.getElementById("stockPoint").value
    };

    await saveShipmentToFirestore(entry);

    loadPage("LSD.html");
  };
};

