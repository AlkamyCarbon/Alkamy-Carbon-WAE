window.initProjectsPage = async function () {

  const container = document.getElementById("projectsContainer")
  if (!container) return

  container.innerHTML = ""  

  const projects = [
    {
      id: "vashi",
      name: "Vashi STP",
      capacity: 100,
      flow: 40,
      credits: 0,
      status: "Monitoring",
  time: "2m"
    },
    {
      id: "nerul",
      name: "Nerul STP",
      capacity: 100,
      flow: 45,
      credits: 0,
      status: "Monitoring",
  time: "2m"
    },
    {
      id: "colaba",
      name: "Colaba STP",
      capacity: 37,
      flow: 21,
      credits: 0,
      status: "Monitoring",
  time: "2m"
    }
  ]

  projects.forEach(p => {

    const col = document.createElement("div")
col.className = "col-xl-6 col-md-6 mb-1"

   col.innerHTML = `
<div class="card project-card">

  <div class="project-header">

    <div class="project-title">
      ${p.name}
    </div>

    <div class="project-arrow">
      →
    </div>

  </div>

  <div class="card-body project-body">

    <div class="project-row">
      <span class="row-label">Capacity</span>
      <span class="row-value">${p.capacity} MLD</span>
    </div>

    <div class="project-row">
      <span class="row-label">Operational Flow</span>
      <span class="row-value">${p.flow} MLD</span>
    </div>

    <div class="project-row">
      <span class="row-label">Credits</span>
      <span class="row-value">${p.credits}</span>
    </div>

    <div class="project-footer mt-3">

<span class="project-chip chip-time">
  <i data-feather="clock" class="chip-icon"></i>
  ${p.time || "2m"}
</span>

      <span class="project-chip ${
        p.status === "Active"
          ? "chip-active"
          : "chip-monitoring"
      }">
        ${p.status}
      </span>

    </div>

  </div>

</div>
`

col.querySelector(".project-header").onclick = () => {

  sessionStorage.setItem("plantId", p.id)

  loadPage("plant.html")

}
    container.appendChild(col)

  })

}

window.toggleBaseline = function(){

  const form = document.getElementById("baselineForm")

 const header = form.closest(".card").querySelector(".panel-header")

if(form.style.display === "none"){

form.style.display = "block"
header.classList.add("open")

}else{

form.style.display = "none"
header.classList.remove("open")

}

}

function addTreatmentInputs(stage){

const container =
document.getElementById(stage.toLowerCase()+"Inputs")

const isFirst = container.children.length === 0

let options = []

if(stage === "Primary"){
options = [
"Screen",
"Grit Removal",
"Primary Settling Tank"
]
}

if(stage === "Secondary"){
options = [
"Sequencing Batch Reactor (SBR)",
"Activated Sludge Process (ASP)",
"Membrane Bioreactor (MBR)",
"Moving Bed Biofilm Reactor (MBBR)"
]
}

if(stage === "Tertiary"){
options = [
"Disk Filtration",
"Ultrafiltration",
"Ozonation",
"UV Disinfection"
]
}

const optionHTML = options.map(o =>
`<option value="${o}">${o}</option>`
).join("")

const row = document.createElement("div")
row.className = "row g-3 mt-2 treatment-row"

row.innerHTML = `

<div class="col-md-6">

<label class="form-label">${stage} Technology</label>

<div class="tech-input-group">

<select class="form-select">
<option value="">Select technology</option>
${optionHTML}
</select>

<button
type="button"
class="tech-action-btn"
onclick="${
isFirst
? `addTreatmentInputs('${stage}')`
: `removeTreatmentRow(this)`
}">
<i data-feather="${isFirst ? "plus" : "minus"}"></i>
</button>
</div>


</div>

<div class="col-md-3">

<label class="form-label">% Flow</label>

<input
type="number"
class="form-control"
value="100"
>

</div>

`

container.appendChild(row)

feather.replace()

}

window.initPlantPage = async function(){

const plantId = sessionStorage.getItem("plantId")

console.log("Loaded plant:", plantId)

feather.replace()

await loadBaseline()

await loadFeedstockData()

await loadCertificates()

}

//-------------------------------------------------------


//-------------------------------------------------------

async function loadBaseline(){

const plantId = sessionStorage.getItem("plantId")

if(!plantId) return

const doc =
await db.collection("plants")
.doc(plantId)
.get()

if(!doc.exists) return

const data = doc.data().baseline

if(!data) return

/* fill inputs */

document.querySelector("#governingBody").value =
data.governingBody || ""

document.querySelector("#operator").value =
data.operator || ""

document.querySelector("#maxCapacity").value =
data.maxCapacity || ""

document.querySelector("#operationalFlow").value =
data.operationalFlow || ""

document.querySelector("#dischargePath").value =
data.dischargePath || ""

document.querySelector("#historicalDosing").value =
data.historicalDosing || "false"

if(data.primary?.length){

document.querySelector("#primaryCheck").checked = true

data.primary.forEach((p,i)=>{

addTreatmentInputs("Primary")

const rows =
document.querySelectorAll("#primaryInputs .treatment-row")

const row = rows[i]

row.querySelector("select").value = p.tech
row.querySelector("input").value = p.flow

})

}

if(data.secondary?.length){

document.querySelector("#secondaryCheck").checked = true

data.secondary.forEach((s,i)=>{

addTreatmentInputs("Secondary")

const rows =
document.querySelectorAll("#secondaryInputs .treatment-row")

const row = rows[i]

row.querySelector("select").value = s.tech
row.querySelector("input").value = s.flow

})

}

if(data.tertiary?.length){

document.querySelector("#tertiaryCheck").checked = true

data.tertiary.forEach((t,i)=>{

addTreatmentInputs("Tertiary")

const rows =
document.querySelectorAll("#tertiaryInputs .treatment-row")

const row = rows[i]

row.querySelector("select").value = t.tech
row.querySelector("input").value = t.flow

})

}

}

document.addEventListener("change", e => {

  if(e.target.id === "primaryCheck"){

    const container =
    document.getElementById("primaryInputs")

    if(e.target.checked){
      addTreatmentInputs("Primary")
    }else{
      container.innerHTML = ""
    }

  }

  if(e.target.id === "secondaryCheck"){

    const container =
    document.getElementById("secondaryInputs")

    if(e.target.checked){
      addTreatmentInputs("Secondary")
    }else{
      container.innerHTML = ""
    }

  }

  if(e.target.id === "tertiaryCheck"){

    const container =
    document.getElementById("tertiaryInputs")

    if(e.target.checked){
      addTreatmentInputs("Tertiary")
    }else{
      container.innerHTML = ""
    }

  }

})


//-------------------------------------------------------

async function submitBaseline(){

const plantId = sessionStorage.getItem("plantId")

if(!plantId){
console.error("Plant ID missing")
return
}

const governingBody =
document.querySelector("#governingBody").value.trim()

const operator =
document.querySelector("#operator").value.trim()

const maxCapacity =
document.querySelector("#maxCapacity").value

const operationalFlow =
document.querySelector("#operationalFlow").value

const dischargePath =
document.querySelector("#dischargePath").value

const historicalDosing =
document.querySelector("#historicalDosing").value

/* validation */

if(
!governingBody ||
!operator ||
!maxCapacity ||
!operationalFlow ||
!dischargePath
){
alert("Please fill all required plant information fields")
return
}

const primary = collectTreatment("primaryInputs")
const secondary = collectTreatment("secondaryInputs")
const tertiary = collectTreatment("tertiaryInputs")

/* save */

await db.collection("plants")
.doc(plantId)
.set({

baseline:{
governingBody,
operator,
maxCapacity:Number(maxCapacity),
operationalFlow:Number(operationalFlow),
dischargePath,
historicalDosing,

primary,
secondary,
tertiary

}

},{merge:true})

}


//-------------------------------------------------------

function collectTreatment(containerId){

const rows =
document.querySelectorAll(`#${containerId} .treatment-row`)

const data = []

rows.forEach(r=>{

const tech =
r.querySelector("select").value

const flow =
r.querySelector("input").value

data.push({
tech,
flow:Number(flow)
})

})

return data

}


function lockBaseline(){

document
.querySelectorAll("#baselineForm input")
.forEach(el => el.disabled = true)

}

function removeTreatmentRow(btn){

const row = btn.closest(".treatment-row")

row.remove()

}


//------------Feedstock-------------------------------

window.toggleFeedstock = function(){

const form = document.getElementById("feedstockForm")
const header = form.closest(".card").querySelector(".panel-header")

if(form.style.display === "none"){

form.style.display = "block"
header.classList.add("open")

}else{

form.style.display = "none"
header.classList.remove("open")

}

}


//-------------------------------------------------

function addTraceMetal(){

const container = document.getElementById("traceMetalInputs")

if(!container) return   // prevents crash

const metals = [
"Fe","Cr","Co","Al","Cu","Zn","Mn",
"As","Hg","Pb","Cd","Ni"
]

const options = metals.map(m =>
`<option value="${m}">${m}</option>`
).join("")

const row = document.createElement("div")

row.className = "row g-3 mt-2 trace-row"

row.innerHTML = `

<div class="col-md-4">

<select class="form-select metal-select">
<option value="">Select Metal</option>
${options}
</select>

</div>

<div class="col-md-3">

<input
type="number"
class="form-control metal-value"
placeholder="Value">

</div>

<div class="col-md-3">

<select class="form-select metal-unit">
<option disabled selected>Unit</option>
<option>%</option>
<option>ppm</option>
<option>ppb</option>
<option>ppt</option>
</select>

</div>

<div class="col-md-2 d-flex align-items-center">

<button
type="button"
class="tech-action-btn"
onclick="this.closest('.trace-row').remove()">

<i data-feather="minus"></i>

</button>

</div>
`

container.appendChild(row)

feather.replace()

}

//-------------------------------------------------


function collectTraceMetals(){

const rows =
document.querySelectorAll(".trace-row")

const metals = []

rows.forEach(r=>{

const metal =
r.querySelector("select").value

const value =
r.querySelector("input").value

const unit =
r.querySelectorAll("select")[1].value

if(metal && value){

metals.push({
metal,
value:Number(value),
unit
})

}

})

return metals

}

//------------------------------------------------------

async function submitFeedstock(){

const plantId = sessionStorage.getItem("plantId")

const purity =
document.querySelector("#feedstockPurity").value

const psd =
document.querySelector("#feedstockPSD").value

const bet =
document.querySelector("#betSurface").value

const reportDate =
document.querySelector("#reportDate").value

const file =
document.querySelector("#labCertificate").files[0]

const traceMetals = collectTraceMetals()

let reportRecord = null

if(file){

const fileName = file.name

const storageRef =
firebase.storage()
.ref(`labCertificates/${plantId}/${fileName}`)

await storageRef.put(file)

const fileURL = await storageRef.getDownloadURL()

reportRecord = {
reportDate,
name:fileName,
url:fileURL
}

}

await db.collection("plants")
.doc(plantId)
.set({

feedstock:{
purity:Number(purity),
psd:Number(psd),
betSurface:Number(bet),
traceMetals
}

},{merge:true})

if(reportRecord){

await db.collection("plants")
.doc(plantId)
.update({
"feedstock.labReports":
firebase.firestore.FieldValue.arrayUnion(reportRecord)
})

}

alert("Feedstock data saved")

}
//----------------------------------------------------

async function loadFeedstockData(){

const plantId = sessionStorage.getItem("plantId")

const doc =
await db.collection("plants")
.doc(plantId)
.get()

if(!doc.exists) return

const data = doc.data().feedstock

if(!data) return

document.querySelector("#feedstockPurity").value =
data.purity || ""

document.querySelector("#feedstockPSD").value =
data.psd || ""

document.querySelector("#betSurface").value =
data.betSurface || ""

document.querySelector("#reportDate").value =
data.reportDate || ""

if(data.certificate){

document.querySelector("#labCertificate")
.insertAdjacentHTML(
"afterend",
`<small class="text-muted">Uploaded: ${data.certificate.name}</small>`
)

}

if(data.traceMetals){

data.traceMetals.forEach(m=>{

addTraceMetal()

const rows =
document.querySelectorAll(".trace-row")

const row = rows[rows.length-1]

row.querySelector(".metal-select").value = m.metal
row.querySelector(".metal-value").value = m.value
row.querySelector(".metal-unit").value = m.unit

})

}

}

//------------------------------------------------------

async function loadCertificates(){

const plantId = sessionStorage.getItem("plantId")

const doc =
await db.collection("plants")
.doc(plantId)
.get()

if(!doc.exists) return

const reports =
doc.data()?.feedstock?.labReports

if(!reports || reports.length === 0) return

const container =
document.getElementById("certificateHistory")

container.innerHTML = ""

reports
.sort((a,b)=> new Date(b.reportDate) - new Date(a.reportDate))
.forEach(r => {

container.innerHTML += `

<div class="certificate-row">

<span class="certificate-date">
${r.reportDate}
</span>

<a
href="${r.url}"
target="_blank"
class="certificate-link"
>
<i data-feather="file-text"></i> View Certificate
</a>

</div>
`

})

}


// Process =============================================

window.toggleProcess = function(type) {

  console.log("clicked:", type);

  // 🔴 remove active from all
  document.querySelectorAll(".process-flow img")
    .forEach(img => img.classList.remove("active"));

  // 🟢 add active to clicked one
  document.querySelector(`.${type}`)?.classList.add("active");

  // hide panels
  document.querySelectorAll(".process-panel")
    .forEach(el => el.style.display = "none");

  const panel = document.getElementById(`process-${type}`);
  if (!panel) return;

  panel.style.display = "block";

if (type === "inlet") {
  panel.innerHTML = buildInletForm();
  loadProcessHistory("inlet");
}

if (type === "outlet") {
  panel.innerHTML = buildOutletForm();
  loadProcessHistory("outlet");
}
};


window.buildInletForm = function() {
  return `
  <div class="baseline-section">

    <h6 class="section-header">Sensors Used</h6>

    <div class="treatment-checkboxes">
      ${["pH","EC","pCO2","DO","COD","TA"]
        .map(s => `
          <label class="form-check">
            <input type="checkbox" class="sensor-checkbox" value="${s}"> ${s}
          </label>
        `).join("")}
    </div>

    <h6 class="section-header mt-4">Grab Samples</h6>

    <div class="treatment-checkboxes">
      ${["TIC","Ca","Mg","COD","BOD","TA","pH","EC","TSS","TDS"]
        .map(s => `
          <label class="form-check">
            <input type="checkbox" class="grab-checkbox" value="${s}"> ${s}
          </label>
        `).join("")}
    </div>

    <h6 class="section-header mt-4">Monitoring Data</h6>

    <div class="row g-4">
      <div class="col-md-4">
        <label class="form-label">From Date</label>
        <input type="date" id="inletFromDate" class="form-control">
      </div>

      <div class="col-md-4">
        <label class="form-label">To Date</label>
        <input type="date" id="inletToDate" class="form-control">
      </div>

      <div class="col-md-4">
        <label class="form-label">Upload XLSX</label>
        <input type="file" id="inletFile" class="form-control" accept=".xlsx">
      </div>
    </div>

    <div class="baseline-actions mt-4">
      <button class="btn btn-primary" onclick="submitInletData()">
        Submit Monitoring Data
      </button>
    </div>

<div class="progress mt-3" style="height:6px;">
  <div id="inletProgress" class="progress-bar" style="width:0%;"></div>
</div>

<small id="inletStatus" class="text-success fw-semibold mt-2 d-block"></small>

    <div id="inletHistory" class="mt-3"></div>

  </div>
  `;
}

window.buildOutletForm = function() { 
  return buildInletForm().replaceAll("inlet", "outlet");


};

function formatDatePretty(dateStr){
  const d = new Date(dateStr)
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric"
  })
}

window.submitInletData = async function(){

  const plantId = sessionStorage.getItem("plantId")
  if(!plantId) return alert("Plant not selected")

const sensors = [
  ...document.querySelectorAll('#process-inlet .sensor-checkbox:checked')
].map(cb => cb.value)

const grabSamples = [
  ...document.querySelectorAll('#process-inlet .grab-checkbox:checked')
].map(cb => cb.value)

  const from = document.getElementById("inletFromDate").value
  const to = document.getElementById("inletToDate").value

  const file = document.getElementById("inletFile").files[0]

  if(!from || !to){
    alert("Please select date range")
    return
  }

  const fromPretty = formatDatePretty(from)
  const toPretty = formatDatePretty(to)

  const key = `${fromPretty}__${toPretty}`

  let fileURL = null

  if(file){
    const ref = firebase.storage()
      .ref(`process/${plantId}/inlet/${key}/${file.name}`)

    await ref.put(file)
    fileURL = await ref.getDownloadURL()
  }

  await db.collection("plants")
    .doc(plantId)
    .set({
      process:{
  inlet:{
    [key]:{
      from: fromPretty,
      to: toPretty,
      sensors,
      grabSamples, // ✅ NEW
      file: fileURL,
      createdAt: new Date().toISOString()
    }
  }
}
    },{merge:true})

  const progress = document.getElementById("inletProgress")
const status = document.getElementById("inletStatus")

progress.style.width = "30%"

// upload file
if(file){
  progress.style.width = "60%"
}

progress.style.width = "90%"

// after firestore write
progress.style.width = "100%"
status.textContent = "Saved successfully ✅"

const doc = await db.collection("plants").doc(plantId).get()

renderProcessHistory(
  doc.data()?.process?.inlet,
  "inletHistory"
)
}


window.submitOutletData = async function(){

  const plantId = sessionStorage.getItem("plantId")
  if(!plantId) return

  const sensors = [
    ...document.querySelectorAll('#process-outlet .sensor-checkbox:checked')
  ].map(cb => cb.value)

  const grabSamples = [
    ...document.querySelectorAll('#process-outlet .grab-checkbox:checked')
  ].map(cb => cb.value)

  const from = document.getElementById("outletFromDate").value
  const to = document.getElementById("outletToDate").value

  const file = document.getElementById("outletFile").files[0]

  // ✅ ADD THIS (missing)
  if(!from || !to){
    alert("Please select date range")
    return
  }

  const fromPretty = formatDatePretty(from)
  const toPretty = formatDatePretty(to)

  const key = `${fromPretty}__${toPretty}`

  let fileURL = null

  if(file){
    const ref = firebase.storage()
      .ref(`process/${plantId}/outlet/${key}/${file.name}`)

    await ref.put(file)
    fileURL = await ref.getDownloadURL()
  }

  await db.collection("plants")
    .doc(plantId)
    .set({
      process:{
        outlet:{
          [key]:{
            from: fromPretty,
            to: toPretty,
            sensors,
            grabSamples,
            file: fileURL,
            createdAt: new Date().toISOString()
          }
        }
      }
    },{merge:true})

  // progress UI
  const progress = document.getElementById("outletProgress")
  const status = document.getElementById("outletStatus")

  progress.style.width = "100%"
  status.textContent = "Saved successfully ✅"

  const doc = await db.collection("plants").doc(plantId).get()

  renderProcessHistory(
    doc.data()?.process?.outlet,
    "outletHistory"
  )
}
function renderProcessHistory(records, containerId){

  const container = document.getElementById(containerId)
  if(!container) return

  if(!records || Object.keys(records).length === 0){
    container.innerHTML = `
      <div class="text-muted" style="font-size:0.9rem;">
        No submissions yet
      </div>
    `
    return
  }

  container.innerHTML = ""

  Object.entries(records)
    .sort((a,b) => new Date(b[1].from) - new Date(a[1].from))
    .forEach(([key, r]) => {

      container.innerHTML += `
        <div class="certificate-row">

          <span class="certificate-date">
            ${r.from} → ${r.to}
          </span>

          ${
            r.file
            ? `<a href="${r.file}" target="_blank" class="certificate-link">
                 View XLSX
               </a>`
            : ""
          }

        </div>
      `
    })
}

window.toggleProcessPanel = function(){

  const section = document.getElementById("processSection")

  const header =
    section.closest(".card").querySelector(".panel-header")

  if(section.style.display === "none"){
    section.style.display = "block"
    header.classList.add("open")
  }else{
    section.style.display = "none"
    header.classList.remove("open")
  }

}

async function loadProcessHistory(stage){

  const plantId = sessionStorage.getItem("plantId")
  if(!plantId) return

  const doc = await db.collection("plants").doc(plantId).get()
  if(!doc.exists) return

  const records = doc.data()?.process?.[stage]

  renderProcessHistory(records, `${stage}History`)
}

window.buildInletForm = function(){
return `
<div class="baseline-section">

<h6 class="section-header">Sensors Used</h6>
<div class="treatment-checkboxes">
${["pH","EC","pCO2","DO","COD","TA"].map(s=>`
<label class="form-check">
<input type="checkbox" class="sensor-checkbox" value="${s}"> ${s}
</label>`).join("")}
</div>

<h6 class="section-header mt-4">Grab Samples</h6>
<div class="treatment-checkboxes">
${["TIC","Ca","Mg","COD","BOD","TA","pH","EC","TSS","TDS"].map(s=>`
<label class="form-check">
<input type="checkbox" class="grab-checkbox" value="${s}"> ${s}
</label>`).join("")}
</div>

<h6 class="section-header mt-4">Monitoring Data</h6>

<div class="row g-4">
<div class="col-md-4">
<label>From Date</label>
<input type="date" id="inletFromDate" class="form-control">
</div>

<div class="col-md-4">
<label>To Date</label>
<input type="date" id="inletToDate" class="form-control">
</div>

<div class="col-md-4">
<label>Upload XLSX</label>
<input type="file" id="inletFile" class="form-control">
</div>
</div>

<div class="mt-4">
<button class="btn btn-primary" onclick="submitInletData()">
Submit Monitoring Data
</button>
</div>

<div class="progress mt-3" style="height:6px;">
<div id="inletProgress" class="progress-bar" style="width:0%"></div>
</div>

<small id="inletStatus"></small>

<div id="inletHistory" class="mt-3"></div>

</div>
`
}

window.buildInletForm = function(){
return `
<div class="baseline-section">

<h6 class="section-header">Sensors Used</h6>
<div class="treatment-checkboxes">
${["pH","EC","pCO2","DO","COD","TA"].map(s=>`
<label class="form-check">
<input type="checkbox" class="sensor-checkbox" value="${s}"> ${s}
</label>`).join("")}
</div>

<h6 class="section-header mt-4">Grab Samples</h6>
<div class="treatment-checkboxes">
${["TIC","Ca","Mg","COD","BOD","TA","pH","EC","TSS","TDS"].map(s=>`
<label class="form-check">
<input type="checkbox" class="grab-checkbox" value="${s}"> ${s}
</label>`).join("")}
</div>

<h6 class="section-header mt-4">Monitoring Data</h6>

<div class="row g-4">
<div class="col-md-4">
<label>From Date</label>
<input type="date" id="inletFromDate" class="form-control">
</div>

<div class="col-md-4">
<label>To Date</label>
<input type="date" id="inletToDate" class="form-control">
</div>

<div class="col-md-4">
<label>Upload XLSX</label>
<input type="file" id="inletFile" class="form-control">
</div>
</div>

<div class="mt-4">
<button class="btn btn-primary" onclick="submitInletData()">
Submit Monitoring Data
</button>
</div>

<div class="progress mt-3" style="height:6px;">
<div id="inletProgress" class="progress-bar" style="width:0%"></div>
</div>

<small id="inletStatus"></small>

<div id="inletHistory" class="mt-3"></div>

</div>
`
}

window.buildOutletForm = function(){
return `
<div class="baseline-section">

<h6 class="section-header">Sensors Used</h6>
<div class="treatment-checkboxes">
${["pH","EC","pCO2","DO","COD","TA"].map(s=>`
<label class="form-check">
<input type="checkbox" class="sensor-checkbox" value="${s}"> ${s}
</label>`).join("")}
</div>

<h6 class="section-header mt-4">Grab Samples</h6>
<div class="treatment-checkboxes">
${["TIC","Ca","Mg","COD","BOD","TA","pH","EC","TSS","TDS"].map(s=>`
<label class="form-check">
<input type="checkbox" class="grab-checkbox" value="${s}"> ${s}
</label>`).join("")}
</div>

<h6 class="section-header mt-4">Monitoring Data</h6>

<div class="row g-4">
<div class="col-md-4">
<label>From Date</label>
<input type="date" id="outletFromDate" class="form-control">
</div>

<div class="col-md-4">
<label>To Date</label>
<input type="date" id="outletToDate" class="form-control">
</div>

<div class="col-md-4">
<label>Upload XLSX</label>
<input type="file" id="outletFile" class="form-control">
</div>
</div>

<div class="mt-4">
<button class="btn btn-primary" onclick="submitOutletData()">
Submit Monitoring Data
</button>
</div>

<div class="progress mt-3" style="height:6px;">
<div id="outletProgress" class="progress-bar" style="width:0%"></div>
</div>

<small id="outletStatus"></small>

<div id="outletHistory" class="mt-3"></div>

</div>
`
}

function formatDatePretty(dateStr){
  const d = new Date(dateStr)
  return d.toLocaleDateString("en-GB", {
    day:"numeric",
    month:"long",
    year:"numeric"
  })
}

window.submitOutletData = async function(){

const plantId = sessionStorage.getItem("plantId")

const sensors = [...document.querySelectorAll('#process-outlet .sensor-checkbox:checked')]
.map(cb=>cb.value)

const grabSamples = [...document.querySelectorAll('#process-outlet .grab-checkbox:checked')]
.map(cb=>cb.value)

const from = document.getElementById("outletFromDate").value
const to = document.getElementById("outletToDate").value

const fileInput = document.getElementById("outletFile")
const file = fileInput ? fileInput.files[0] : null

if(!from || !to){
alert("Please select date range")
return
}

const key = `${formatDatePretty(from)}__${formatDatePretty(to)}`

let fileURL = null

if(file){
const ref = firebase.storage().ref(`process/${plantId}/outlet/${key}/${file.name}`)
await ref.put(file)
fileURL = await ref.getDownloadURL()
}

await db.collection("plants").doc(plantId).set({
process:{
outlet:{
[key]:{
from, to, sensors, grabSamples, file:fileURL,
createdAt:new Date().toISOString()
}
}
}
},{merge:true})

document.getElementById("outletProgress").style.width="100%"
document.getElementById("outletStatus").textContent="Saved ✅"

loadProcessHistory("outlet")
}

function renderProcessHistory(records, containerId){

const container = document.getElementById(containerId)
if(!container) return

if(!records || Object.keys(records).length===0){
container.innerHTML="No submissions yet"
return
}

container.innerHTML=""

Object.values(records)
.sort((a,b)=> new Date(b.createdAt)-new Date(a.createdAt))
.forEach(r=>{
container.innerHTML+=`
<div class="certificate-row">
<span>${r.from} → ${r.to}</span>
${r.file ? `<a href="${r.file}" target="_blank">View</a>`:""}
</div>`
})
}


