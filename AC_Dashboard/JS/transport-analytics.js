/*************************************************
 * TRANSPORT ANALYTICS ENGINE (SAFE VERSION)
 *************************************************/

(() => {

  const MINE_COORDS = {
    "Ambika Limestone": [24.518833, 73.797028],
    "Bhandari Marbles": [24.847556, 73.810333],
    "Bharat Minechem": [27.006083, 74.911222]
  };

  const PROCESSING_COORDS = {
    "Bharat Minerals": [19.281056, 73.047722],
    "RR Minerals": [24.524444, 73.678222],
    "Rishab Limestone": [24.537083, 73.71175]
  };

const STP_COORDS = {
  "Colaba STP": [18.907933, 72.817951],
  "Nerul STP": [19.009500, 73.017727],
  "Vashi STP": [19.073577, 73.004402]
};

  const EF_MINE_TO_PROC = 0.020183;
  const EF_PROC_TO_PLANT = 0.01753809523;
  const LOADING_PER_TON = 0.06296190476;
  const HANDLING_EVENTS = 4;
  const BAG_WEIGHT_KG = 1.1;
  const PLASTIC_EF = 2.56859;

  function haversine(coord1, coord2) {
    const toRad = d => d * Math.PI / 180;
    const R = 6371;

    const [lat1, lon1] = coord1;
    const [lat2, lon2] = coord2;

    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);

    const a =
      Math.sin(dLat/2) ** 2 +
      Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon/2) ** 2;

    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  function normalize(entry) {

    if (!entry?.mining || !entry?.processing || !entry?.drop || !entry?.pickup?.weight) {
      return null;
    }

    const tons = Number(entry.pickup.weight);
    if (!tons) return null;

    const mine = MINE_COORDS[entry.mining.crusherName];
    const proc = PROCESSING_COORDS[entry.processing.processorName];
 const stpName = entry.drop.site;
const drop = STP_COORDS[stpName];

    if (!mine || !proc || !drop) return null;

    const d1 = haversine(mine, proc);
    const d2 = haversine(proc, drop);

    const transportPerTon =
      d1 * EF_MINE_TO_PROC +
      d2 * EF_PROC_TO_PLANT;

    const handlingPerTon =
      LOADING_PER_TON * HANDLING_EVENTS;

    const packagingPerTon =
      entry.processing.packaging === "1 ton bags"
        ? BAG_WEIGHT_KG * PLASTIC_EF
        : 0;

    const totalPerTon =
      transportPerTon + handlingPerTon + packagingPerTon;

return {
  processor: entry.processing.processorName,
  processorName: entry.processing.processorName,
  packaging: entry.processing.packaging,
  tons,
  d1,
  d2,
  totalDistance: d1 + d2,
  mineToProc: d1 * EF_MINE_TO_PROC,
  procToPlant: d2 * EF_PROC_TO_PLANT,
  handling: handlingPerTon,
  packagingEm: packagingPerTon,
  totalPerTon,
  totalEmissions: totalPerTon * tons,

  mineCoords: mine,
  procCoords: proc,
  dropCoords: drop,
  mineName: entry.mining.crusherName
};
  }



// ----------------------------------------------------

  window.initTransportDashboard = async function () {

    await authReady;

    const shipments = await loadShipmentsFromFirestore();

    const data = shipments
      .map(normalize)
      .filter(Boolean);

    console.log("Transport data:", data);

    renderTransportKPIs(data);
    renderTransportBreakdown(data);
renderTransportMap(data);
    renderTransportPackaging(data);
  };

})();

// -----------------------------------------------------

  function renderTransportKPIs(data) {

    const totalTons = data.reduce((s,d)=>s+d.tons,0);
    const totalEmissions = data.reduce((s,d)=>s+d.totalEmissions,0);
    const avgDistance = data.length
      ? data.reduce((s,d)=>s+d.totalDistance,0)/data.length
      : 0;

    const intensity = totalTons
      ? totalEmissions / totalTons
      : 0;

    document.getElementById("totalDeliveredTons").innerText =
      totalTons.toFixed(0);

    document.getElementById("avgTransportDistance").innerText =
      avgDistance.toFixed(2);

    document.getElementById("avgTransportEmissionIntensity").innerText =
      intensity.toFixed(2);

    document.getElementById("totalTransportEmissions").innerText =
      (totalEmissions/1000).toFixed(2);
  }

  function renderTransportBreakdown(data) {

  const el = document.querySelector("#transportEmissionBreakdownChart");
  if (!el) return;

  if (!data.length) {
    el.innerHTML = "<p class='text-muted'>No data available</p>";
    return;
  }

  const grouped = {};

  data.forEach(d => {
    if (!grouped[d.processor]) {
      grouped[d.processor] = {
        mine: 0,
        plant: 0,
        handling: 0,
        packaging: 0,
        tons: 0
      };
    }

    grouped[d.processor].mine += d.mineToProc * d.tons;
    grouped[d.processor].plant += d.procToPlant * d.tons;
    grouped[d.processor].handling += d.handling * d.tons;
    grouped[d.processor].packaging += d.packagingEm * d.tons;
    grouped[d.processor].tons += d.tons;
  });

  const processors = Object.keys(grouped);

  const mine = processors.map(p => grouped[p].mine / grouped[p].tons);
  const plant = processors.map(p => grouped[p].plant / grouped[p].tons);
  const handling = processors.map(p => grouped[p].handling / grouped[p].tons);
  const packaging = processors.map(p => grouped[p].packaging / grouped[p].tons);

  new ApexCharts(el, {

    chart: {
      type: "bar",
      height: 340,
      stacked: true,
      toolbar: { show: false }
    },

    plotOptions: {
      bar: {
        horizontal: true,
        borderRadius: 8,
        barHeight: "60%"
      }
    },

    series: [
      { name: "Mine → Processing", data: mine },
      { name: "Processing → Plant", data: plant },
      { name: "Handling", data: handling },
      { name: "Packaging", data: packaging }
    ],

    colors: [
  "#FF2400", 
  "#FFAB05", 
  "#50C2E5",  
  "#056875"   
],

    xaxis: {
      categories: processors,
      title: {
        text: "Emission Intensity (kg CO₂ / ton)",
        style: {
          fontWeight: 500,
          color: "#36454F"
        }
      },
      labels: {
        formatter: val => Number(val).toFixed(1),
        style: {
          colors: "#64748b",
          fontSize: "12px"
        }
      }
    },

    yaxis: {
      labels: {
        style: {
          colors: "#475569",
          fontSize: "13px"
        }
      }
    },

    legend: {
      position: "bottom",
      fontSize: "12px",
      markers: {
        radius: 4
      }
    },

    tooltip: {
      y: {
        formatter: val => val.toFixed(1) + " kg CO₂ / ton"
      }
    },

    dataLabels: {
      enabled: false
    },

    grid: {
      borderColor: "#e2e8f0",
      strokeDashArray: 4
    }

  }).render();
}

//------------------------------------------------------

function renderTransportMap(data) {

  const el = document.getElementById("transportMap");
  if (!el || !window.L) return;

  if (el._leaflet_map_instance) {
    el._leaflet_map_instance.remove();
  }

  const map = L.map("transportMap", {
    zoomControl: true
  }).setView([22.5, 79], 5);

  el._leaflet_map_instance = map;

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "&copy; OpenStreetMap contributors"
  }).addTo(map);

  // 🔥 Layer groups
  const mineLayer = L.layerGroup().addTo(map);
  const processingLayer = L.layerGroup().addTo(map);
  const plantLayer = L.layerGroup().addTo(map);

  data.forEach(d => {

    // 🔴 Mines
    if (d.mineCoords) {
      L.circleMarker(d.mineCoords, {
        radius: 8,
        color: "#B91C1C",
        weight: 1.5,
        fillColor: "#EF4444",
        fillOpacity: 0.35
      })
      .bindTooltip(d.mineName)
      .addTo(mineLayer);
    }

    // 🟠 Processing
    if (d.procCoords) {
      L.circleMarker(d.procCoords, {
        radius: 8,
        color: "#B45309",
        weight: 1.5,
        fillColor: "#F59E0B",
        fillOpacity: 0.35
      })
      .bindTooltip(d.processorName || d.processor)
      .addTo(processingLayer);
    }

    // 🔵 Implementation
    if (d.dropCoords) {
      L.circleMarker(d.dropCoords, {
        radius: 8,
        color: "#1E40AF",
        weight: 1.5,
        fillColor: "#3B82F6",
        fillOpacity: 0.35
      })
      .bindTooltip("Implementation Site")
      .addTo(plantLayer);
    }

  });

  // -----------------------------
  // Custom Legend with Checkboxes
  // -----------------------------

  const legend = L.control({ position: "bottomright" });

  legend.onAdd = function () {

    const div = L.DomUtil.create("div", "transport-legend");

    div.innerHTML = `
      <div style="background:white;padding:12px 14px;border-radius:10px;box-shadow:0 4px 18px rgba(0,0,0,0.08);font-size:13px;min-width:170px;">
        <div style="font-weight:600;margin-bottom:8px;">Network Layers</div>

        <label style="display:flex;align-items:center;margin-bottom:6px;cursor:pointer;">
          <input type="checkbox" id="toggleMines" checked style="margin-right:8px;">
          <span style="width:12px;height:12px;background:#EF4444;border-radius:50%;display:inline-block;margin-right:8px;"></span>
          Mines
        </label>

        <label style="display:flex;align-items:center;margin-bottom:6px;cursor:pointer;">
          <input type="checkbox" id="toggleProcessing" checked style="margin-right:8px;">
          <span style="width:12px;height:12px;background:#F59E0B;border-radius:50%;display:inline-block;margin-right:8px;"></span>
          Processing
        </label>

        <label style="display:flex;align-items:center;cursor:pointer;">
          <input type="checkbox" id="togglePlant" checked style="margin-right:8px;">
          <span style="width:12px;height:12px;background:#3B82F6;border-radius:50%;display:inline-block;margin-right:8px;"></span>
          Implementation
        </label>
      </div>
    `;

    return div;
  };

  legend.addTo(map);

  // Prevent map dragging when clicking legend
  L.DomEvent.disableClickPropagation(document.querySelector(".transport-legend"));

  // -----------------------------
  // Toggle Logic
  // -----------------------------

  setTimeout(() => {

    document.getElementById("toggleMines").addEventListener("change", function () {
      this.checked ? map.addLayer(mineLayer) : map.removeLayer(mineLayer);
    });

    document.getElementById("toggleProcessing").addEventListener("change", function () {
      this.checked ? map.addLayer(processingLayer) : map.removeLayer(processingLayer);
    });

    document.getElementById("togglePlant").addEventListener("change", function () {
      this.checked ? map.addLayer(plantLayer) : map.removeLayer(plantLayer);
    });

  }, 0);

}

// -----------------------------------------------------

  function renderTransportPackaging(data) {

  const el = document.querySelector("#transportPackagingDonutChart");
  if (!el) return;

  if (!data.length) {
    el.innerHTML = "<p class='text-muted'>No data available</p>";
    return;
  }

  const bags = data.filter(d => d.packaging === "1 ton bags").length;
  const direct = data.length - bags;

  const bagsPct = data.length ? (bags / data.length) * 100 : 0;
  const directPct = 100 - bagsPct;

  document.getElementById("packagingBagsPct").innerText =
    bagsPct.toFixed(1) + "%";

  document.getElementById("packagingDirectPct").innerText =
    directPct.toFixed(1) + "%";

  new ApexCharts(el, {

    chart: {
      type: "donut",
      height: "80%",   // percentage height
      toolbar: { show: false }
    },

    series: [bags, direct],

    labels: ["1 ton bags", "Direct truck load"],

    legend: {
      show: false   // remove right-side legend
    },

    dataLabels: {
      enabled: false
    },

    plotOptions: {
      pie: {
        donut: {
          size: "72%"   // increase inner hole
        }
      }
    },

    colors: [
      "#6050DC",  
      "#FFAB05"    
    ],

    stroke: {
      width: 0
    },

    tooltip: {
      y: {
        formatter: val => val + " shipments"
      }
    }

  }).render();
}

