Chart.defaults.font.family = "Poppins, Inter, system-ui, sans-serif";
Chart.defaults.color = "#475569";
Chart.defaults.plugins.legend.labels.boxWidth = 12;
Chart.defaults.plugins.legend.labels.usePointStyle = true;
/*************************************************
 * MINING ANALYTICS ENGINE
 *************************************************/

const BASE_EMISSION_FACTORS = {
  "Vertical Roller Mill": 0.29,
  "Pendulum Roller Mill": 0.31,
  "Ball Mill": 0.36
};

const INTENSITY_COEFFICIENT = 0.12;


/* ===============================
   NORMALIZE
================================ */

function normalizeMiningEntry(entry) {
  if (!entry.mining) return null;

  const initial = Number(entry.mining.initialSize);
  const final = Number(entry.mining.finalSize);
  const purity = Number(entry.mining.purity);
  const tons = Number(entry.pickup?.weight || 0);

  if (!initial || !final || !tons) return null;

  const reductionRatio = initial / final;
  const logReduction = Math.log(reductionRatio);

  return {
    company: entry.pickup?.supplierName,
    crushingTech: entry.mining.crushingTech,
    tonsProcessed: tons,
    initialSize: initial,
    finalSize: final,
    purity: purity,
    reductionRatio,
    logReduction
  };
}

/* ===============================
   CALCULATIONS
================================ */

function computeIntensity(item) {
  return 1 + INTENSITY_COEFFICIENT * item.logReduction;
}

function computeEmissions(item) {
  const base = BASE_EMISSION_FACTORS[item.crushingTech] || 0.33;
  return base * computeIntensity(item) * item.tonsProcessed;
}


/* ===============================
   INIT DASHBOARD
================================ */

window.initMiningDashboard = async function () {

  await authReady;

  const shipments = await loadShipmentsFromFirestore();
  const miningData = shipments
    .map(normalizeMiningEntry)
    .filter(Boolean)
    .map(item => ({
      ...item,
      emissions: computeEmissions(item)
    }));

  renderMiningKPIs(miningData);
  renderTechChart(miningData);
renderInitialChart(miningData);
renderFinalChart(miningData);
updateParticleAverages(miningData);
renderEmissionIntensityChart(miningData);
renderPurityDistributionChart(miningData);
};


/* ===============================
   KPI
================================ */

function renderMiningKPIs(data) {

  const totalTons = data.reduce((s, d) => s + d.tonsProcessed, 0);
  const totalEmissions = data.reduce((s, d) => s + d.emissions, 0);
  const avgReduction =
    data.length ? data.reduce((s,d)=>s+d.reductionRatio,0)/data.length : 0;
  const avgEmissionPerTon =
    totalTons ? totalEmissions / totalTons : 0;

  document.getElementById("totalMiningTons").innerText =
    totalTons.toFixed(0);

  document.getElementById("totalMiningEmissions").innerText =
    totalEmissions.toFixed(1);

  document.getElementById("avgReductionRatio").innerText =
    avgReduction.toFixed(1);

  document.getElementById("avgEmissionPerTon").innerText =
    avgEmissionPerTon.toFixed(3);
}

function renderTechChart(data) {

  const counts = {};
  data.forEach(d => {
    counts[d.crushingTech] =
      (counts[d.crushingTech] || 0) + 1;
  });

const total = data.length;

document.getElementById("pctPendulum").innerText =
  ((counts["Pendulum Roller Mill"]||0)/total*100).toFixed(1)+"%";

document.getElementById("pctBall").innerText =
  ((counts["Ball Mill"]||0)/total*100).toFixed(1)+"%";

document.getElementById("pctVRM").innerText =
  ((counts["Vertical Roller Mill"]||0)/total*100).toFixed(1)+"%";

  const options = {
    chart: {
      type: "donut",
      height: "88%"
    },
    series: Object.values(counts),
    labels: Object.keys(counts),
    colors: ["#1e3a5f", "#639A8E", "#60a5fa"],
    legend: {
      show: false
    },
    dataLabels: {
      enabled: false
    }
  };

  const chart = new ApexCharts(
    document.querySelector("#techAdoptionChart"),
    options
  );

  chart.render();
}

// INitial Particle Size ------------------
function renderInitialChart(data) {

  const el = document.querySelector("#initialSizeChart");
  if (!el) return;

  const totalTons = data.reduce((s,d)=>s+d.tonsProcessed,0);

  // Define full particle size range (mm)
  const minSize = 1;
  const maxSize = 20;
  const step = 1;

  const bins = {};

  // Initialize ALL bins to zero
  for (let s = minSize; s <= maxSize; s += step) {
    bins[s] = 0;
  }

  // Fill bins (convert micron → mm)
  data.forEach(d => {
    const sizeMM = Math.round(d.initialSize / 1000);
    if (bins.hasOwnProperty(sizeMM)) {
      bins[sizeMM] += d.tonsProcessed;
    }
  });

  const sizes = Object.keys(bins).map(Number);

  const percentages = sizes.map(s =>
    totalTons ? (bins[s] / totalTons) * 100 : 0
  );

  const options = {
    chart: {
      type: "area",
      height: "100%",
      toolbar: { show:false }
    },
    series: [{
      name: "Mass %",
      data: sizes.map((s, i) => ({
        x: s,
        y: percentages[i]
      }))
    }],
    stroke: {
      curve: "smooth",
      width: 3
    },
    fill: {
      type: "gradient",
      gradient: {
        opacityFrom: 0.4,
        opacityTo: 0.05
      }
    },
    colors: ["#1e3a5f"],

    xaxis: {
      type: "numeric",
      min: 0,
      max: 20,
      tickAmount: 4,
      title: {
        text: "Particle Size (mm)",
        offsetY: 4,
        style: {
          color: "#36454F",
          fontWeight: 500
        }
      },
      labels: {
        style: {
          colors: "#94a3b8",
          fontSize: "12px"
        }
      }
    },

    yaxis: {
      min: 0,
      max: 80,
      tickAmount: 3,
      labels: {
        formatter: val => val.toFixed(0),
        style: {
          colors:"#94a3b8",
          fontSize:"12px"
        }
      },
      title: {
        text: "%",
        style: {
          color:"#36454F",
          fontWeight:500
        }
      }
    },

    dataLabels:{ enabled:false },
    grid:{ borderColor:"#f1f5f9" }
  };

  new ApexCharts(el, options).render();
}

// Final Particle size ----------------------------------

function renderFinalChart(data) {

  const el = document.querySelector("#finalSizeChart");
  if (!el) return;

  const totalTons = data.reduce((s,d)=>s+d.tonsProcessed,0);

  // Define full micron range
  const minSize = 0;
  const maxSize = 1000;
  const step = 50; // 50 µm resolution (clean visual)

  const bins = {};

  // Initialize ALL bins to zero
  for (let s = minSize; s <= maxSize; s += step) {
    bins[s] = 0;
  }

  // Fill bins (round to nearest 50 µm bucket)
  data.forEach(d => {
    const rounded =
      Math.round(Number(d.finalSize) / step) * step;

    if (bins.hasOwnProperty(rounded)) {
      bins[rounded] += d.tonsProcessed;
    }
  });

  const sizes = Object.keys(bins).map(Number);

  const percentages = sizes.map(s =>
    totalTons ? (bins[s] / totalTons) * 100 : 0
  );

  const options = {
    chart: {
      type: "area",
      height: "100%",
      toolbar: { show:false }
    },
    series: [{
      name: "Mass %",
      data: sizes.map((s, i) => ({
        x: s,
        y: percentages[i]
      }))
    }],
    stroke: {
      curve: "smooth",
      width: 3
    },
    fill: {
      type: "gradient",
      gradient: {
        opacityFrom: 0.4,
        opacityTo: 0.05
      }
    },
    colors: ["#60a5fa"],

    xaxis: {
      type: "numeric",
      min: minSize,
      max: maxSize,
      tickAmount: 4,
      title: {
        text: "Particle Size (µm)",
        offsetY: 4,
        style: {
          color: "#36454F",
          fontWeight: 500
        }
      },
      labels: {
        style: {
          colors: "#94a3b8",
          fontSize: "12px"
        }
      }
    },

    yaxis: {
      min: 0,
      max: 60,
      tickAmount: 2,
      labels: {
        formatter: val => val.toFixed(0),
        style: {
          colors: "#94a3b8",
          fontSize: "12px"
        }
      },
      title: {
        text: "%",
        style: {
          color: "#36454F",
          fontWeight: 500
        }
      }
    },

    dataLabels: { enabled:false },
    grid: { borderColor:"#f1f5f9" }
  };

  new ApexCharts(el, options).render();
}

// ---------------------------------------------------------


function updateParticleAverages(data) {

  const totalTons = data.reduce((s,d)=>s+d.tonsProcessed,0);

  const avgInitial =
    data.reduce((s,d)=>s + (d.initialSize * d.tonsProcessed),0)
    / totalTons;

  const avgFinal =
    data.reduce((s,d)=>s + (d.finalSize * d.tonsProcessed),0)
    / totalTons;

  document.getElementById("avgInitialSize").innerText =
    (avgInitial/1000).toFixed(2); // mm

  document.getElementById("avgFinalSize").innerText =
    avgFinal.toFixed(0); // µm
}

// Emission Intensity  Function -----------------------------

function renderEmissionIntensityChart(data) {

  const el = document.querySelector("#emissionIntensityChart");
  if (!el) return;

  const techTotals = {};
  const techTons = {};

  // Aggregate emissions & tons by technology
  data.forEach(d => {
    const tech = d.crushingTech;

    techTotals[tech] =
      (techTotals[tech] || 0) + d.emissions;

    techTons[tech] =
      (techTons[tech] || 0) + d.tonsProcessed;
  });

  const technologies = Object.keys(techTotals);

  const intensities = technologies.map(tech =>
    techTotals[tech] / techTons[tech]
  );

  // Update card average
  const overallAvg =
    data.reduce((s,d)=>s+(d.emissions/d.tonsProcessed),0)
      / data.length || 0;

  document.getElementById("avgEmissionIntensity").innerText =
    overallAvg.toFixed(3);

  // Tight axis scaling
  const minVal = Math.min(...intensities);
  const maxVal = Math.max(...intensities);
  const padding = (maxVal - minVal) * 0.15;

  const options = {
  chart: {
    type: "bar",
    height: "100%",
    toolbar: { show:false }
  },

  series: [{
    name: "kg CO₂ / ton",
    data: intensities.map(v => Number(v.toFixed(3)))
  }],

  plotOptions: {
    bar: {
      horizontal: true,
      borderRadius: 6,
      barHeight: "45%"
    }
  },

  colors: ["#f97316"],

  xaxis: {
    categories: technologies,   // ✅ categories go here
    min: 0.2,
    max: 0.6,
    tickAmount: 4,
    title: {
      text: "Emission Intensity (kg CO₂ / ton)",
  style: {
      color: "#36454F",
      fontWeight: 500
    }

    },
    labels: {
      formatter: val => val.toFixed(3),
      style: {
        colors: "#94a3b8",
        fontSize: "12px"
      }
    }
  },

  yaxis: {
    labels: {
      style: {
        colors: "#818589",
        fontSize: "13px"
      }
    }
  },

  tooltip: {
    y: {
      formatter: val => val.toFixed(3) + " kg CO₂ / ton"
    }
  },

  grid: {
  borderColor: "#f1f5f9",
  padding: {
    left: 40   // increase if needed (50–70 if longer names)
  }
},

  dataLabels: { enabled: false }
};

  new ApexCharts(el, options).render();
}

// Purity Function -------------------------------------

function renderPurityDistributionChart(data) {

  const el = document.querySelector("#purityDistributionChart");
  if (!el) return;

  const totalTons = data.reduce((s,d)=>s+d.tonsProcessed,0);

  // Define full purity range
  const minPurity = 90;
  const maxPurity = 100;
  const step = 1;

  const bins = {};

  // Initialize ALL bins to zero
  for (let p = minPurity; p <= maxPurity; p += step) {
    bins[p] = 0;
  }

  // Fill bins using tons weighting
  data.forEach(d => {
    const rounded = Math.round(d.purity);
    if (bins.hasOwnProperty(rounded)) {
      bins[rounded] += d.tonsProcessed;
    }
  });

  const purities = Object.keys(bins).map(Number);
  const percentages = purities.map(p =>
    totalTons ? (bins[p] / totalTons) * 100 : 0
  );

  // Average (card value)
  const avg =
    data.length
      ? data.reduce((s,d)=>s+d.purity,0) / data.length
      : 0;

  document.getElementById("avgPurityDist").innerText =
    avg.toFixed(1);

  const options = {
    chart: {
      type: "area",
      height: "100%",
      toolbar: { show:false }
    },
    series: [{
  name: "Mass %",
  data: purities.map((p, i) => ({
    x: p,
    y: percentages[i]
  }))
}],
    stroke: {
      curve: "smooth",
      width: 3
    },
    fill: {
      type: "gradient",
      gradient: {
        opacityFrom: 0.4,
        opacityTo: 0.05
      }
    },
    colors: ["#60a5fa"],
  xaxis: {
  type: "numeric",
  min: 90,
  max: 100,
  tickAmount: 4,
  title: {
    text: "Purity (%)",
    offsetY: 4,   // 🔥 pushes title further down
    style: {
      color: "#36454F",
      fontWeight: 500
    }

  },
  labels: {
    style: {
      colors: "#94a3b8",
      fontSize: "12px"
    }
  }
},
    yaxis: {
      min: 0,
      max: 80,
      tickAmount: 2,
      labels: {
        formatter: val => val.toFixed(0),
        style: {
          colors:"#94a3b8",
          fontSize:"12px"
        }
      },
      title: {
        text: "%",
        style: {
          color:"#36454F",
          fontWeight:500
        }
      }
    },
    dataLabels:{ enabled:false },
    grid:{ borderColor:"#f1f5f9" }
  };

  new ApexCharts(el, options).render();
}