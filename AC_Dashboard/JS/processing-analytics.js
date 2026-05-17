/*************************************************
 * PROCESSING ANALYTICS ENGINE
 *************************************************/

function normalizeProcessingEntry(entry) {

  if (!entry.processing) return null;

  const initial = Number(entry.processing.initialPSD);
  const final = Number(entry.processing.finalPSD);
  const purity = Number(entry.processing.purity);
  const tons = Number(entry.pickup?.weight || 0);

  if (!initial || !final || !tons) return null;

  const reductionRatio = initial / final;
  const logReduction = Math.log(reductionRatio);

  return {
    processingTech: entry.processing.processingTech,
    tonsProcessed: tons,
    initialSize: initial,     // µm
    finalSize: final,         // µm
    purity: purity,
    reductionRatio,
    logReduction
  };
}

/* ===============================
   EMISSION FACTOR MODEL
================================ */

function computeProcessingEmissionFactor(finalSize) {

  // Clamp between 10 and 100 micron
  const size = Math.max(10, Math.min(100, finalSize));

  // Linear interpolation
  return 2 + ((100 - size) / 90) * 0.6;
}

function computeProcessingEmissions(item) {

  const factor = computeProcessingEmissionFactor(item.finalSize);
  return factor * item.tonsProcessed;
}

/* ===============================
   INIT DASHBOARD
================================ */

window.initProcessingDashboard = async function () {

  await authReady;

  const shipments = await loadShipmentsFromFirestore();

  const processingData = shipments
    .map(normalizeProcessingEntry)
    .filter(Boolean)
    .map(item => ({
      ...item,
      emissionFactor: computeProcessingEmissionFactor(item.finalSize),
      emissions: computeProcessingEmissions(item)
    }));

  renderProcessingKPIs(processingData);
  renderProcessingTechChart(processingData);
renderProcessingParticleChart(processingData);
updateProcessingParticleAverages(processingData);
  renderProcessingEmissionIntensityChart(processingData);
  renderProcessingPurityDistributionChart(processingData);
};



/* ===============================
   KPI
================================ */

function renderProcessingKPIs(data) {

  const totalTons = data.reduce((s,d)=>s+d.tonsProcessed,0);
  const totalEmissions = data.reduce((s,d)=>s+d.emissions,0);

  const avgReduction =
    data.length ? data.reduce((s,d)=>s+d.reductionRatio,0)/data.length : 0;

  const avgEmissionPerTon =
    totalTons ? totalEmissions / totalTons : 0;

  document.getElementById("totalProcessingTons").innerText =
    totalTons.toFixed(0);

  document.getElementById("totalProcessingEmissions").innerText =
    totalEmissions.toFixed(1);

  document.getElementById("avgProcessingReductionRatio").innerText =
    avgReduction.toFixed(1);

  document.getElementById("avgProcessingEmissionPerTon").innerText =
    avgEmissionPerTon.toFixed(2);
}



/* ===============================
   Tech chart
================================ */

function renderProcessingTechChart(data) {

  const counts = {};
  data.forEach(d => {
    counts[d.processingTech] =
      (counts[d.processingTech] || 0) + 1;
  });

  const total = data.length || 1;

  // Update custom legend percentages
  document.getElementById("pctACM").innerText =
    ((counts["Air Classifying Mill"] || 0) / total * 100).toFixed(1) + "%";

  document.getElementById("pctJet").innerText =
    ((counts["Fluidised Bed Air Jet Mill"] || 0) / total * 100).toFixed(1) + "%";

  document.getElementById("pctSMM").innerText =
    ((counts["Stirred Media Mill"] || 0) / total * 100).toFixed(1) + "%";

  document.getElementById("pctBall").innerText =
    ((counts["Ball Mill"] || 0) / total * 100).toFixed(1) + "%";

  const options = {
    chart: {
      type: "donut",
      height: "60%"
    },
    series: Object.values(counts),
    labels: Object.keys(counts),
    colors: ["#1e3a5f", "#639A8E", "#60a5fa", "#f97316"],
    legend: { show:false },
    dataLabels: { enabled:false }
  };

  new ApexCharts(
    document.querySelector("#techAdoptionChartProcessing"),
    options
  ).render();
}

/* ===============================
   Paricle Size chart
================================ */
function renderProcessingParticleChart(data) {

  const el = document.querySelector("#processingParticleChart");
  if (!el) return;

  const totalTons = data.reduce((s,d)=>s+d.tonsProcessed,0);

  const minSize = 0;
  const maxSize = 250;
  const step = 5;

  const binsInitial = {};
  const binsFinal = {};

  for (let s = minSize; s <= maxSize; s += step) {
    binsInitial[s] = 0;
    binsFinal[s] = 0;
  }

  data.forEach(d => {

    const initRounded =
      Math.round(d.initialSize / step) * step;

    const finalRounded =
      Math.round(d.finalSize / step) * step;

    if (binsInitial.hasOwnProperty(initRounded)) {
      binsInitial[initRounded] += d.tonsProcessed;
    }

    if (binsFinal.hasOwnProperty(finalRounded)) {
      binsFinal[finalRounded] += d.tonsProcessed;
    }

  });

  const sizes = Object.keys(binsInitial).map(Number);

  const initialPercent = sizes.map(s =>
    totalTons ? (binsInitial[s] / totalTons) * 100 : 0
  );

  const finalPercent = sizes.map(s =>
    totalTons ? (binsFinal[s] / totalTons) * 100 : 0
  );

  const options = {

    chart: {
      type: "area",
      height: "110%",
      toolbar: { show:false }
    },

    series: [
      {
        name: "Final PSD",
        data: sizes.map((s,i)=>({ x:s, y:finalPercent[i] }))
      },
      {
        name: "Initial PSD",
        data: sizes.map((s,i)=>({ x:s, y:initialPercent[i] }))
      }
    ],

    stroke: {
  curve: "smooth",
  width: [3,3]
},

fill: {
  type: "solid",
  opacity: [0,0]
},

colors: ["#60a5fa", "#1e3a5f"],

    xaxis: {
      type: "numeric",
      min: minSize,
      max: maxSize,
      tickAmount: 5,
      title: {
        text: "Particle Size (µm)",
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
      title: {
        text: "%",
        style: {
          color: "#36454F",
          fontWeight: 500
        }
      },
      labels: {
        formatter: val => val.toFixed(0),
        style: {
          colors:"#94a3b8",
          fontSize:"12px"
        }
      }
    },

    dataLabels:{ enabled:false },
    grid:{ borderColor:"#f1f5f9" },
    legend:{ position:"top" }

  };

  new ApexCharts(el, options).render();
}

/* ===============================
   Emission intensity chart
================================ */

function renderProcessingEmissionIntensityChart(data) {

  const el = document.querySelector("#processingEmissionIntensityChart");
  if (!el) return;

  const techTotals = {};
  const techTons = {};

  data.forEach(d => {
    const tech = d.processingTech;

    techTotals[tech] =
      (techTotals[tech] || 0) + d.emissions;

    techTons[tech] =
      (techTons[tech] || 0) + d.tonsProcessed;
  });

  const technologies = Object.keys(techTotals);

  const intensities = technologies.map(tech =>
    techTotals[tech] / techTons[tech]
  );

  const overallAvg =
    data.reduce((s,d)=>s+d.emissionFactor,0) / data.length || 0;

  document.getElementById("avgProcessingEmissionIntensity").innerText =
    overallAvg.toFixed(3);

  const minVal = Math.min(...intensities);
  const maxVal = Math.max(...intensities);
  const padding = (maxVal - minVal) * 0.2;

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
    barHeight: "50%",
 borderRadiusApplication: 'end'
  }
},

colors: ["#743089"],   // clean teal

fill: {
  type: "solid"
},

  xaxis: {
    categories: technologies,
    min: minVal - padding,
    max: maxVal + padding,
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

  grid: {
    borderColor: "#e5e7eb",
    strokeDashArray: 4,
     padding: {
    left: 20,
    right: 20    }
  },

  dataLabels: { enabled: false }
};

  new ApexCharts(el, options).render();
}

/* ===============================
   Purity chart
================================ */

function renderProcessingPurityDistributionChart(data) {

  const el = document.querySelector("#processingPurityDistributionChart");
  if (!el) return;

  const totalTons = data.reduce((s,d)=>s+d.tonsProcessed,0);

  const minPurity = 90;
  const maxPurity = 100;
  const step = 1;

  const bins = {};

  for (let p = minPurity; p <= maxPurity; p += step) {
    bins[p] = 0;
  }

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

  const avg =
    data.length
      ? data.reduce((s,d)=>s+d.purity,0) / data.length
      : 0;

  document.getElementById("avgProcessingPurity").innerText =
    avg.toFixed(1);

  const options = {
    chart: {
      type: "area",
      height: "100%",
      toolbar: { show:false }
    },

    series: [{
      name: "Mass %",
      data: purities.map((p,i)=>({
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
      title: {
        text: "%",
        style: {
          color: "#36454F",
          fontWeight: 500
        }
      },
      labels: {
        formatter: val => val.toFixed(0),
        style: {
          colors:"#94a3b8",
          fontSize:"12px"
        }
      }
    },

    dataLabels:{ enabled:false },
    grid:{ borderColor:"#f1f5f9" }
  };

  new ApexCharts(el, options).render();
}

/* ===============================
   Average computation for particle size
================================ */


function updateProcessingParticleAverages(data) {

  const totalTons = data.reduce((s,d)=>s+d.tonsProcessed,0);
  if (!totalTons) return;

  const avgInitial =
    data.reduce((s,d)=>s + (d.initialSize * d.tonsProcessed),0)
    / totalTons;

  const avgFinal =
    data.reduce((s,d)=>s + (d.finalSize * d.tonsProcessed),0)
    / totalTons;

  document.getElementById("avgInitialPSD").innerText =
    avgInitial.toFixed(0);

  document.getElementById("avgFinalPSD").innerText =
    avgFinal.toFixed(0);
}