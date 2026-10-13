let ambulancesList = [];
let editingAmbulance = false;
let editingAmbulanceId = null;

let driversList = [];
let editingDriver = false;
let editingDriverId = null;

let tableSchemas = {
    AMBULANCE: [],
    DRIVER: []
};

// Default schemas in case schema is still loading
const DEFAULT_AMBULANCE_COLUMNS = [
    { column_name: "ID", data_type: "NUMBER", nullable: "N", is_primary_key: true },
    { column_name: "VEHICLE_TYPE", data_type: "VARCHAR2(20)", nullable: "N", is_primary_key: false },
    { column_name: "MODEL", data_type: "VARCHAR2(50)", nullable: "N", is_primary_key: false },
    { column_name: "STATUS", data_type: "VARCHAR2(20)", nullable: "N", is_primary_key: false },
    { column_name: "REMARKS", data_type: "VARCHAR2(100)", nullable: "Y", is_primary_key: false }
];

const DEFAULT_DRIVER_COLUMNS = [
    { column_name: "DRIVER_ID", data_type: "NUMBER", nullable: "N", is_primary_key: true },
    { column_name: "DRIVER_NAME", data_type: "VARCHAR2(120)", nullable: "N", is_primary_key: false },
    { column_name: "DOB", data_type: "VARCHAR2(10)", nullable: "N", is_primary_key: false },
    { column_name: "AGE", data_type: "NUMBER(3)", nullable: "Y", is_primary_key: false },
    { column_name: "PHONE", data_type: "VARCHAR2(20)", nullable: "N", is_primary_key: false },
    { column_name: "LICENSE_NO", data_type: "VARCHAR2(50)", nullable: "N", is_primary_key: false },
    { column_name: "EXPERIENCE_YEARS", data_type: "NUMBER(2)", nullable: "Y", is_primary_key: false },
    { column_name: "STATUS", data_type: "VARCHAR2(20)", nullable: "N", is_primary_key: false },
    { column_name: "SALARY_MONTHLY", data_type: "NUMBER(10,2)", nullable: "N", is_primary_key: false }
];

// Base columns to distinguish originally existing columns from altered/added ones
const BASE_AMBULANCE_COLS = new Set(["ID", "VEHICLE_TYPE", "MODEL", "STATUS", "REMARKS"]);
const BASE_DRIVER_COLS = new Set(["DRIVER_ID", "DRIVER_NAME", "DOB", "AGE", "PHONE", "LICENSE_NO", "EXPERIENCE_YEARS", "STATUS", "SALARY_MONTHLY"]);


// Utility function to escape HTML special characters
function escapeHtml(str) {
    if (str === null || str === undefined) return "";
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


// Format column name into human-readable label
function formatColumnLabel(colName) {
    if (!colName) return "";
    const upper = colName.toUpperCase();
    const map = {
        "ID": "Ambulance ID",
        "VEHICLE_TYPE": "Vehicle Type",
        "MODEL": "Vehicle Model",
        "STATUS": "Status",
        "REMARKS": "Remarks",
        "DRIVER_ID": "Driver ID",
        "DRIVER_NAME": "Driver Name",
        "DOB": "Date of Birth (DOB)",
        "AGE": "Derived Age",
        "PHONE": "Phone Number",
        "LICENSE_NO": "License No.",
        "EXPERIENCE_YEARS": "Experience (Years)",
        "SALARY_MONTHLY": "Monthly Salary (₹)",
        "SALARY_ANNUAL": "Annual Salary (₹)"
    };
    if (map[upper]) return map[upper];

    const acronyms = new Set(["ID", "GPS", "ICU", "DL", "NO", "VIN", "IP", "URL"]);
    return colName.split("_").map(part => {
        const u = part.toUpperCase();
        if (acronyms.has(u)) return u;
        return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
    }).join(" ");
}


// Map Oracle data types to HTML input types
function getInputType(dataType) {
    if (!dataType) return "text";
    const dt = dataType.toUpperCase();
    if (dt.includes("NUMBER") || dt.includes("INT") || dt.includes("FLOAT")) return "number";
    if (dt.includes("DATE")) return "date";
    return "text";
}


// Format status badge pill
function getStatusPill(status) {
    const s = (status || "").toUpperCase();
    let cls = "status-pill";
    if (s === "AVAILABLE") cls += " available";
    else if (s === "ON DUTY") cls += " onduty";
    else if (s === "MAINTENANCE" || s === "OFF DUTY") cls += " maintenance";
    return `<span class="${cls}">${escapeHtml(s)}</span>`;
}


// Helper function to derive age from DD-MM-YYYY format
function calculateAgeFromDob(dobStr) {
    if (!dobStr || typeof dobStr !== "string") return null;
    const parts = dobStr.trim().split("-");
    if (parts.length !== 3) return null;
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10);
    const year = parseInt(parts[2], 10);
    if (isNaN(day) || isNaN(month) || isNaN(year)) return null;
    if (day < 1 || day > 31 || month < 1 || month > 12 || year < 1900) return null;

    const dob = new Date(year, month - 1, day);
    if (dob.getFullYear() !== year || dob.getMonth() !== month - 1 || dob.getDate() !== day) {
        return null;
    }

    const today = new Date();
    if (dob > today) return null;

    let age = today.getFullYear() - dob.getFullYear();
    const m = today.getMonth() - dob.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) {
        age--;
    }
    return (age >= 0 && age <= 120) ? age : null;
}


function onDobInputChange() {
    const dobInput = document.getElementById("driver_dob");
    const preview = document.getElementById("driver_age_preview");
    if (!dobInput || !preview) return;

    const val = dobInput.value.trim();
    if (!val) {
        preview.value = "Derived Age: —";
        return;
    }

    const age = calculateAgeFromDob(val);
    if (age !== null) {
        preview.value = `Derived Age: ${age} yrs`;
    } else {
        preview.value = val.length >= 10 ? "Invalid Date (DD-MM-YYYY)" : "Derived Age: —";
    }
}


// Update minimal summary counts
function updateSummary() {
    const totalAmbulances = ambulancesList.length;
    const availableAmbulances = ambulancesList.filter(
        a => (a.status || "").toUpperCase() === "AVAILABLE"
    ).length;

    const totalDrivers = driversList.length;
    const availableDrivers = driversList.filter(
        d => (d.status || "").toUpperCase() === "AVAILABLE"
    ).length;

    const elTotalAmb = document.getElementById("summaryTotalAmbulances");
    const elAvailAmb = document.getElementById("summaryAvailableAmbulances");
    const elTotalDrv = document.getElementById("summaryTotalDrivers");
    const elAvailDrv = document.getElementById("summaryAvailableDrivers");

    if (elTotalAmb) elTotalAmb.innerText = totalAmbulances;
    if (elAvailAmb) elAvailAmb.innerText = availableAmbulances;
    if (elTotalDrv) elTotalDrv.innerText = totalDrivers;
    if (elAvailDrv) elAvailDrv.innerText = availableDrivers;
}


// ============================================================
// AMBULANCES
// ============================================================

function getAmbulanceColumns() {
    return (tableSchemas.AMBULANCE && tableSchemas.AMBULANCE.length > 0)
        ? tableSchemas.AMBULANCE
        : DEFAULT_AMBULANCE_COLUMNS;
}


function renderAmbulanceTableHeaders() {
    const thead = document.getElementById("ambulanceTableHead");
    if (!thead) return;
    const cols = getAmbulanceColumns();

    let ths = cols.map(c => {
        const isNew = !BASE_AMBULANCE_COLS.has(c.column_name.toUpperCase());
        const badge = isNew ? ` <span class="new-col-badge">New</span>` : "";
        return `<th>${escapeHtml(formatColumnLabel(c.column_name))}${badge}</th>`;
    }).join("");

    ths += `<th>Actions</th>`;
    thead.innerHTML = `<tr>${ths}</tr>`;
}


function renderAmbulancesTable(list) {
    const table = document.getElementById("ambulanceTable");
    if (!table) return;
    table.innerHTML = "";

    const cols = getAmbulanceColumns();

    if (!list || list.length === 0) {
        table.innerHTML = `<tr><td colspan="${cols.length + 1}" style="text-align:center; color:#6b7280; padding: 20px;">No ambulance records found.</td></tr>`;
        return;
    }

    list.forEach(ambulance => {
        const row = document.createElement("tr");
        let tds = cols.map(c => {
            const colKey = c.column_name.toLowerCase();
            const val = ambulance[colKey];

            if (colKey === "id") {
                return `<td><strong>#${escapeHtml(val)}</strong></td>`;
            } else if (colKey === "status") {
                return `<td>${getStatusPill(val)}</td>`;
            } else if (colKey === "remarks") {
                return `<td class="remarks-cell">${escapeHtml(val || "—")}</td>`;
            } else {
                return `<td>${val !== null && val !== undefined && val !== "" ? escapeHtml(val) : '<span class="empty-dash">—</span>'}</td>`;
            }
        }).join("");

        tds += `
            <td class="actions-cell">
                <div class="actions-group">
                    <button class="edit" onclick="editAmbulance(${ambulance.id})">
                        Modify
                    </button>
                    <button class="delete" onclick="deleteAmbulance(${ambulance.id})">
                        Delete
                    </button>
                </div>
            </td>
        `;
        row.innerHTML = tds;
        table.appendChild(row);
    });
}


function buildAmbulanceFormBoxes() {
    const grid = document.getElementById("ambulanceFormGrid");
    if (!grid) return;

    const cols = getAmbulanceColumns();
    grid.innerHTML = "";

    cols.forEach(c => {
        const colKey = c.column_name.toLowerCase();
        const upper = c.column_name.toUpperCase();
        const label = formatColumnLabel(c.column_name);
        const isReq = c.nullable === "N";
        const isNew = !BASE_AMBULANCE_COLS.has(upper);
        const star = isReq ? `<span class="required-star">*</span>` : "";
        const newBadge = isNew ? `<span class="new-col-badge">New</span>` : "";

        const group = document.createElement("div");
        group.className = "form-field-group";
        group.setAttribute("data-col-group", colKey);

        if (colKey === "id") {
            group.innerHTML = `
                <label class="field-label" for="ambulance_id">${escapeHtml(label)} ${star}${newBadge}</label>
                <input type="number" id="ambulance_id" data-col="id" placeholder="Ambulance ID (e.g. 101)" min="1" ${isReq ? "required" : ""}>
            `;
        } else if (colKey === "vehicle_type") {
            group.innerHTML = `
                <label class="field-label" for="vehicle_type">${escapeHtml(label)} ${star}${newBadge}</label>
                <select id="vehicle_type" data-col="vehicle_type" ${isReq ? "required" : ""}>
                    <option value="">Select Vehicle Type</option>
                    <option value="BASIC">Basic</option>
                    <option value="ADVANCED">Advanced</option>
                    <option value="ICU">ICU</option>
                </select>
            `;
        } else if (colKey === "model") {
            group.innerHTML = `
                <label class="field-label" for="model">${escapeHtml(label)} ${star}${newBadge}</label>
                <input type="text" id="model" data-col="model" placeholder="Vehicle Model (e.g. Force Traveller)" maxlength="50" ${isReq ? "required" : ""}>
            `;
        } else if (colKey === "status") {
            group.innerHTML = `
                <label class="field-label" for="ambulance_status">${escapeHtml(label)} ${star}${newBadge}</label>
                <select id="ambulance_status" data-col="status" ${isReq ? "required" : ""}>
                    <option value="">Select Status</option>
                    <option value="AVAILABLE">Available</option>
                    <option value="ON DUTY">On Duty</option>
                    <option value="MAINTENANCE">Maintenance</option>
                </select>
            `;
        } else if (colKey === "remarks") {
            group.innerHTML = `
                <label class="field-label" for="remarks">${escapeHtml(label)} ${star}${newBadge}</label>
                <input type="text" id="remarks" data-col="remarks" placeholder="Remarks / Service Notes (Optional)" maxlength="100" ${isReq ? "required" : ""}>
            `;
        } else {
            // Dynamically added column! Box is added accordingly!
            const inputType = getInputType(c.data_type);
            group.innerHTML = `
                <label class="field-label" for="ambulance_col_${colKey}">${escapeHtml(label)} ${star}${newBadge}</label>
                <input type="${inputType}" id="ambulance_col_${colKey}" data-col="${colKey}" placeholder="Enter ${escapeHtml(label)}" ${isReq ? "required" : ""}>
            `;
        }
        grid.appendChild(group);
    });
}


async function loadAmbulances() {
    try {
        const response = await fetch("/api/ambulances");

        if (response.status === 401) {
            window.location.href = "/";
            return;
        }

        const data = await response.json();

        if (!response.ok || !Array.isArray(data)) {
            ambulancesList = [];
            renderAmbulancesTable([]);
            updateSummary();
            return;
        }

        ambulancesList = data;
        renderAmbulancesTable(ambulancesList);
        updateSummary();

    } catch (err) {
        console.error("Error loading ambulances:", err);
        ambulancesList = [];
        renderAmbulancesTable([]);
        updateSummary();
    }
}


function filterAmbulances() {
    const searchText = (document.getElementById("ambulanceSearch").value || "").toLowerCase().trim();
    const statusFilter = (document.getElementById("ambulanceFilter").value || "").toUpperCase().trim();

    const filtered = ambulancesList.filter(a => {
        const matchesStatus = !statusFilter || (a.status || "").toUpperCase() === statusFilter;
        const matchesSearch = !searchText || Object.values(a).some(val =>
            val !== null && val !== undefined && String(val).toLowerCase().includes(searchText)
        );
        return matchesStatus && matchesSearch;
    });

    renderAmbulancesTable(filtered);
}


function openAmbulanceForm() {
    editingAmbulance = false;
    editingAmbulanceId = null;

    document.getElementById("ambulanceFormTitle").innerText = "Add New Ambulance";
    document.getElementById("ambulanceForm").style.display = "block";

    clearAmbulanceForm();
}


function closeAmbulanceForm() {
    document.getElementById("ambulanceForm").style.display = "none";
    clearAmbulanceForm();
}


function clearAmbulanceForm() {
    const grid = document.getElementById("ambulanceFormGrid");
    if (!grid) return;
    const inputs = grid.querySelectorAll("input, select");
    inputs.forEach(input => {
        input.value = "";
        input.disabled = false;
    });
}


function editAmbulance(itemOrId) {
    let ambulance;
    if (typeof itemOrId === "object" && itemOrId !== null) {
        ambulance = itemOrId;
    } else {
        ambulance = ambulancesList.find(a => a.id === itemOrId);
    }

    if (!ambulance) return;

    editingAmbulance = true;
    editingAmbulanceId = ambulance.id;

    document.getElementById("ambulanceFormTitle").innerText = `Modify Ambulance #${ambulance.id}`;
    document.getElementById("ambulanceForm").style.display = "block";

    const grid = document.getElementById("ambulanceFormGrid");
    if (!grid) return;
    const inputs = grid.querySelectorAll("input, select");

    inputs.forEach(input => {
        const col = input.getAttribute("data-col");
        if (!col) return;

        if (col === "id") {
            input.value = ambulance.id;
            input.disabled = true;
        } else {
            input.value = ambulance[col] !== undefined && ambulance[col] !== null ? ambulance[col] : "";
            input.disabled = false;
        }
    });
}


async function saveAmbulance() {
    const grid = document.getElementById("ambulanceFormGrid");
    if (!grid) return;

    const inputs = grid.querySelectorAll("input, select");
    const payload = {};

    for (const input of inputs) {
        const col = input.getAttribute("data-col");
        if (!col) continue;

        const val = input.value.trim();

        if (input.required && !val && !editingAmbulance && col === "id") {
            alert("Please enter a valid Ambulance ID.");
            input.focus();
            return;
        }

        if (input.required && !val && col !== "id") {
            alert(`Please provide a value for ${formatColumnLabel(col)}.`);
            input.focus();
            return;
        }

        if (col === "id") {
            const idNum = Number(val);
            if (!editingAmbulance && (isNaN(idNum) || idNum <= 0 || !Number.isInteger(idNum))) {
                alert("Please enter a valid positive integer for Ambulance ID.");
                input.focus();
                return;
            }
            payload[col] = idNum;
        } else if (input.type === "number" && val !== "") {
            payload[col] = Number(val);
        } else {
            payload[col] = val;
        }
    }

    try {
        let response;
        if (editingAmbulance) {
            response = await fetch(`/api/ambulances/${editingAmbulanceId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });
        } else {
            response = await fetch("/api/ambulances", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });
        }

        if (response.status === 401) {
            alert("Session expired. Please log in again.");
            window.location.href = "/";
            return;
        }

        const result = await response.json();
        alert(result.message || (response.ok ? "Operation successful." : "An error occurred."));

        if (response.ok) {
            closeAmbulanceForm();
            loadAmbulances();
        }
    } catch (err) {
        console.error("Network error:", err);
        alert("Could not communicate with the server. Please check connection.");
    }
}


async function deleteAmbulance(id) {
    if (!confirm(`Are you sure you want to delete ambulance #${id}?`)) {
        return;
    }

    try {
        const response = await fetch(`/api/ambulances/${id}`, {
            method: "DELETE"
        });

        if (response.status === 401) {
            window.location.href = "/";
            return;
        }

        const result = await response.json();
        alert(result.message || (response.ok ? "Ambulance deleted." : "Failed to delete ambulance."));

        if (response.ok) {
            loadAmbulances();
        }
    } catch (err) {
        console.error("Delete error:", err);
        alert("Failed to delete ambulance due to network/server issue.");
    }
}


// ============================================================
// DRIVERS
// ============================================================

function getDriverColumns() {
    return (tableSchemas.DRIVER && tableSchemas.DRIVER.length > 0)
        ? tableSchemas.DRIVER
        : DEFAULT_DRIVER_COLUMNS;
}


function renderDriverTableHeaders() {
    const thead = document.getElementById("driverTableHead");
    if (!thead) return;
    const cols = getDriverColumns();

    let ths = cols.map(c => {
        const isNew = !BASE_DRIVER_COLS.has(c.column_name.toUpperCase());
        const badge = isNew ? ` <span class="new-col-badge">New</span>` : "";
        return `<th>${escapeHtml(formatColumnLabel(c.column_name))}${badge}</th>`;
    }).join("");

    if (cols.some(c => c.column_name.toUpperCase() === "SALARY_MONTHLY")) {
        ths += `<th>Annual Salary</th>`;
    }

    ths += `<th>Actions</th>`;
    thead.innerHTML = `<tr>${ths}</tr>`;
}


function renderDriversTable(list) {
    const table = document.getElementById("driverTable");
    if (!table) return;
    table.innerHTML = "";

    const cols = getDriverColumns();
    const hasSalary = cols.some(c => c.column_name.toUpperCase() === "SALARY_MONTHLY");

    if (!list || list.length === 0) {
        const colSpan = cols.length + (hasSalary ? 1 : 0) + 1;
        table.innerHTML = `<tr><td colspan="${colSpan}" style="text-align:center; color:#6b7280; padding: 20px;">No driver records found.</td></tr>`;
        return;
    }

    list.forEach(driver => {
        const monthly = Number(driver.salary_monthly || 0);
        const annual = (driver.salary_annual !== undefined && driver.salary_annual !== null)
            ? Number(driver.salary_annual)
            : monthly * 12;

        const ageVal = (driver.age !== undefined && driver.age !== null)
            ? driver.age
            : calculateAgeFromDob(driver.dob);

        const row = document.createElement("tr");

        let tds = cols.map(c => {
            const colKey = c.column_name.toLowerCase();
            const val = driver[colKey];

            if (colKey === "driver_id") {
                return `<td><strong>#${escapeHtml(val)}</strong></td>`;
            } else if (colKey === "status") {
                return `<td>${getStatusPill(val)}</td>`;
            } else if (colKey === "dob") {
                return `<td><code style="font-size:12px;">${escapeHtml(val || "—")}</code></td>`;
            } else if (colKey === "age") {
                return `<td>${ageVal !== null && ageVal !== undefined ? `<span class="age-badge">${ageVal} yrs</span>` : "—"}</td>`;
            } else if (colKey === "license_no") {
                return `<td><code style="font-size:12px;">${escapeHtml(val || "")}</code></td>`;
            } else if (colKey === "experience_years") {
                return `<td>${escapeHtml(val !== undefined && val !== null ? val : 0)} yrs</td>`;
            } else if (colKey === "salary_monthly") {
                return `<td class="salary-cell">₹${monthly.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>`;
            } else {
                return `<td>${val !== null && val !== undefined && val !== "" ? escapeHtml(val) : '<span class="empty-dash">—</span>'}</td>`;
            }
        }).join("");

        if (hasSalary) {
            tds += `<td class="salary-cell">₹${annual.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>`;
        }

        tds += `
            <td class="actions-cell">
                <div class="actions-group">
                    <button class="edit" onclick="editDriver(${driver.driver_id})">
                        Modify
                    </button>
                    <button class="delete" onclick="deleteDriver(${driver.driver_id})">
                        Delete
                    </button>
                </div>
            </td>
        `;
        row.innerHTML = tds;
        table.appendChild(row);
    });
}


function buildDriverFormBoxes() {
    const grid = document.getElementById("driverFormGrid");
    if (!grid) return;

    const cols = getDriverColumns();
    grid.innerHTML = "";

    cols.forEach(c => {
        const colKey = c.column_name.toLowerCase();
        const upper = c.column_name.toUpperCase();
        const label = formatColumnLabel(c.column_name);
        const isReq = c.nullable === "N";
        const isNew = !BASE_DRIVER_COLS.has(upper);
        const star = isReq ? `<span class="required-star">*</span>` : "";
        const newBadge = isNew ? `<span class="new-col-badge">New</span>` : "";

        const group = document.createElement("div");
        group.className = "form-field-group";
        group.setAttribute("data-col-group", colKey);

        if (colKey === "driver_id") {
            group.innerHTML = `
                <label class="field-label" for="driver_id">${escapeHtml(label)} ${star}${newBadge}</label>
                <input type="number" id="driver_id" data-col="driver_id" placeholder="Driver ID (e.g. 201)" min="1" ${isReq ? "required" : ""}>
            `;
        } else if (colKey === "driver_name") {
            group.innerHTML = `
                <label class="field-label" for="driver_name">${escapeHtml(label)} ${star}${newBadge}</label>
                <input type="text" id="driver_name" data-col="driver_name" placeholder="Driver Full Name" maxlength="120" ${isReq ? "required" : ""}>
            `;
        } else if (colKey === "dob") {
            group.innerHTML = `
                <label class="field-label" for="driver_dob">${escapeHtml(label)} ${star}${newBadge}</label>
                <input type="text" id="driver_dob" data-col="dob" placeholder="DOB (DD-MM-YYYY)" maxlength="10" oninput="onDobInputChange()" ${isReq ? "required" : ""}>
            `;
        } else if (colKey === "age") {
            group.innerHTML = `
                <label class="field-label" for="driver_age_preview">${escapeHtml(label)} (Auto)</label>
                <input type="text" id="driver_age_preview" data-col="age" placeholder="Derived Age: —" readonly tabindex="-1" class="readonly-age-field">
            `;
        } else if (colKey === "phone") {
            group.innerHTML = `
                <label class="field-label" for="driver_phone">${escapeHtml(label)} ${star}${newBadge}</label>
                <input type="text" id="driver_phone" data-col="phone" placeholder="Phone (min 10 digits)" maxlength="20" ${isReq ? "required" : ""}>
            `;
        } else if (colKey === "license_no") {
            group.innerHTML = `
                <label class="field-label" for="license_no">${escapeHtml(label)} ${star}${newBadge}</label>
                <input type="text" id="license_no" data-col="license_no" placeholder="Commercial License Number" maxlength="50" ${isReq ? "required" : ""}>
            `;
        } else if (colKey === "experience_years") {
            group.innerHTML = `
                <label class="field-label" for="experience_years">${escapeHtml(label)} ${star}${newBadge}</label>
                <input type="number" id="experience_years" data-col="experience_years" placeholder="Experience (Years)" min="0" max="60" value="0" ${isReq ? "required" : ""}>
            `;
        } else if (colKey === "status") {
            group.innerHTML = `
                <label class="field-label" for="driver_status">${escapeHtml(label)} ${star}${newBadge}</label>
                <select id="driver_status" data-col="status" ${isReq ? "required" : ""}>
                    <option value="">Select Status</option>
                    <option value="AVAILABLE">Available</option>
                    <option value="ON DUTY">On Duty</option>
                    <option value="OFF DUTY">Off Duty</option>
                </select>
            `;
        } else if (colKey === "salary_monthly") {
            group.innerHTML = `
                <label class="field-label" for="salary_monthly">${escapeHtml(label)} ${star}${newBadge}</label>
                <input type="number" id="salary_monthly" data-col="salary_monthly" placeholder="Monthly Salary (₹)" min="0" step="0.01" ${isReq ? "required" : ""}>
            `;
        } else {
            // Dynamically added column! Box is added accordingly!
            const inputType = getInputType(c.data_type);
            group.innerHTML = `
                <label class="field-label" for="driver_col_${colKey}">${escapeHtml(label)} ${star}${newBadge}</label>
                <input type="${inputType}" id="driver_col_${colKey}" data-col="${colKey}" placeholder="Enter ${escapeHtml(label)}" ${isReq ? "required" : ""}>
            `;
        }
        grid.appendChild(group);
    });
}


async function loadDrivers() {
    try {
        const response = await fetch("/api/drivers");

        if (response.status === 401) {
            window.location.href = "/";
            return;
        }

        const data = await response.json();

        if (!response.ok || !Array.isArray(data)) {
            driversList = [];
            renderDriversTable([]);
            updateSummary();
            return;
        }

        driversList = data;
        renderDriversTable(driversList);
        updateSummary();

    } catch (err) {
        console.error("Error loading drivers:", err);
        driversList = [];
        renderDriversTable([]);
        updateSummary();
    }
}


function filterDrivers() {
    const searchText = (document.getElementById("driverSearch").value || "").toLowerCase().trim();
    const statusFilter = (document.getElementById("driverFilter").value || "").toUpperCase().trim();

    const filtered = driversList.filter(d => {
        const matchesStatus = !statusFilter || (d.status || "").toUpperCase() === statusFilter;
        const matchesSearch = !searchText || Object.values(d).some(val =>
            val !== null && val !== undefined && String(val).toLowerCase().includes(searchText)
        );
        return matchesStatus && matchesSearch;
    });

    renderDriversTable(filtered);
}


function openDriverForm() {
    editingDriver = false;
    editingDriverId = null;

    document.getElementById("driverFormTitle").innerText = "Add New Driver";
    document.getElementById("driverForm").style.display = "block";

    clearDriverForm();
}


function closeDriverForm() {
    document.getElementById("driverForm").style.display = "none";
    clearDriverForm();
}


function clearDriverForm() {
    const grid = document.getElementById("driverFormGrid");
    if (!grid) return;
    const inputs = grid.querySelectorAll("input, select");
    inputs.forEach(input => {
        if (input.id === "experience_years") {
            input.value = "0";
        } else if (input.id === "driver_age_preview") {
            input.value = "Derived Age: —";
        } else {
            input.value = "";
        }
        input.disabled = false;
    });
}


function editDriver(itemOrId) {
    let driver;
    if (typeof itemOrId === "object" && itemOrId !== null) {
        driver = itemOrId;
    } else {
        driver = driversList.find(d => d.driver_id === itemOrId);
    }

    if (!driver) return;

    editingDriver = true;
    editingDriverId = driver.driver_id;

    document.getElementById("driverFormTitle").innerText = `Modify Driver #${driver.driver_id}`;
    document.getElementById("driverForm").style.display = "block";

    const grid = document.getElementById("driverFormGrid");
    if (!grid) return;
    const inputs = grid.querySelectorAll("input, select");

    inputs.forEach(input => {
        const col = input.getAttribute("data-col");
        if (!col) return;

        if (col === "driver_id") {
            input.value = driver.driver_id;
            input.disabled = true;
        } else if (col === "age") {
            // Readonly age preview
        } else {
            input.value = driver[col] !== undefined && driver[col] !== null ? driver[col] : "";
            input.disabled = false;
        }
    });

    onDobInputChange();
}


async function saveDriver() {
    const grid = document.getElementById("driverFormGrid");
    if (!grid) return;

    const inputs = grid.querySelectorAll("input, select");
    const payload = {};

    for (const input of inputs) {
        const col = input.getAttribute("data-col");
        if (!col || col === "age") continue;

        const val = input.value.trim();

        if (input.required && !val && !editingDriver && col === "driver_id") {
            alert("Please enter a valid Driver ID.");
            input.focus();
            return;
        }

        if (input.required && !val && col !== "driver_id") {
            alert(`Please provide a value for ${formatColumnLabel(col)}.`);
            input.focus();
            return;
        }

        if (col === "driver_id") {
            const idNum = Number(val);
            if (!editingDriver && (isNaN(idNum) || idNum <= 0 || !Number.isInteger(idNum))) {
                alert("Please enter a valid positive integer for Driver ID.");
                input.focus();
                return;
            }
            payload[col] = idNum;
        } else if (col === "dob") {
            if (val) {
                const derivedAge = calculateAgeFromDob(val);
                if (derivedAge === null) {
                    alert("Invalid Date of Birth format. Please enter DOB in DD-MM-YYYY format (e.g. 15-08-1990).");
                    input.focus();
                    return;
                }
                if (derivedAge < 18 || derivedAge > 100) {
                    alert(`Derived age (${derivedAge} years) is invalid. Driver must be between 18 and 100 years old.`);
                    input.focus();
                    return;
                }
                payload["age"] = derivedAge;
            }
            payload[col] = val;
        } else if (input.type === "number" && val !== "") {
            payload[col] = Number(val);
        } else {
            payload[col] = val;
        }
    }

    try {
        let response;
        if (editingDriver) {
            response = await fetch(`/api/drivers/${editingDriverId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });
        } else {
            response = await fetch("/api/drivers", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });
        }

        if (response.status === 401) {
            alert("Session expired. Please log in again.");
            window.location.href = "/";
            return;
        }

        const result = await response.json();
        alert(result.message || (response.ok ? "Operation successful." : "An error occurred."));

        if (response.ok) {
            closeDriverForm();
            loadDrivers();
        }
    } catch (err) {
        console.error("Network error:", err);
        alert("Could not communicate with the server. Please check connection.");
    }
}


async function deleteDriver(id) {
    if (!confirm(`Are you sure you want to delete driver #${id}?`)) {
        return;
    }

    try {
        const response = await fetch(`/api/drivers/${id}`, {
            method: "DELETE"
        });

        if (response.status === 401) {
            window.location.href = "/";
            return;
        }

        const result = await response.json();
        alert(result.message || (response.ok ? "Driver deleted." : "Failed to delete driver."));

        if (response.ok) {
            loadDrivers();
        }
    } catch (err) {
        console.error("Delete error:", err);
        alert("Failed to delete driver due to network/server issue.");
    }
}


// ============================================================
// TABLE SCHEMA DDL OPERATIONS & DYNAMIC COLUMN PROPAGATION
// ============================================================

function toggleTableSchema(tableName) {
    const panelId = tableName === "AMBULANCE" ? "ambulanceSchemaPanel" : "driverSchemaPanel";
    const panel = document.getElementById(panelId);
    if (!panel) return;

    if (panel.style.display === "none" || !panel.style.display) {
        panel.style.display = "block";
        loadTableSchema();
    } else {
        panel.style.display = "none";
    }
}


function setDdlCommand(tableName, sql) {
    const inputId = tableName === "AMBULANCE" ? "ambulanceDdlInput" : "driverDdlInput";
    const outputId = tableName === "AMBULANCE" ? "ambulanceDdlOutput" : "driverDdlOutput";
    const input = document.getElementById(inputId);
    const output = document.getElementById(outputId);

    if (input) {
        input.value = sql;
        input.focus();
    }
    if (output) {
        output.style.display = "none";
        output.innerText = "";
    }
}


async function executeTableDdl(tableName) {
    const inputId = tableName === "AMBULANCE" ? "ambulanceDdlInput" : "driverDdlInput";
    const outputId = tableName === "AMBULANCE" ? "ambulanceDdlOutput" : "driverDdlOutput";
    const input = document.getElementById(inputId);
    const output = document.getElementById(outputId);

    const rawSql = input ? input.value.trim() : "";

    if (!rawSql) {
        if (output) {
            output.style.display = "block";
            output.className = "ddl-panel-output error";
            output.innerText = "✗ Invalid Command: Please enter an Oracle DDL statement.";
        }
        if (input) input.focus();
        return;
    }

    // Security check: Strictly ban all table drop commands client-side
    const cleanSql = rawSql
        .replace(/--.*$/gm, "")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .trim();
    const normalizedUpper = cleanSql.toUpperCase().replace(/\s+/g, " ");

    if (
        /\bDROP\s+(?:ONLINE\s+|GLOBAL\s+TEMPORARY\s+|TEMPORARY\s+)?TABLE\b/i.test(normalizedUpper) ||
        normalizedUpper.startsWith("DROP ") ||
        normalizedUpper.includes("DROP TABLE")
    ) {
        if (output) {
            output.style.display = "block";
            output.className = "ddl-panel-output error";
            output.innerText = "⛔ Command Prohibited: DROP TABLE commands are strictly banned to protect database integrity and prevent data loss.";
        }
        if (input) input.focus();
        return;
    }

    if (output) {
        output.style.display = "block";
        output.className = "ddl-panel-output";
        output.innerText = `Executing: ${rawSql} ...`;
    }

    try {
        const response = await fetch("/api/ddl/execute", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sql: rawSql })
        });

        if (response.status === 401) {
            alert("Session expired. Please log in again.");
            window.location.href = "/";
            return;
        }

        const data = await response.json();

        if (output) {
            if (response.ok) {
                output.className = "ddl-panel-output";
                output.innerText = `✓ Command Executed Successfully (${data.mode || "Database"}):\n${data.message || "Database schema modified successfully."}`;
            } else {
                output.className = "ddl-panel-output error";
                output.innerText = `✗ Command Failed:\n${data.message || "Syntax error or unsupported DDL statement."}`;
            }
        }

        if (response.ok) {
            // Immediately reload schema, refresh table headers, refresh form boxes, and reload table data!
            await loadTableSchema();
            await loadAmbulances();
            await loadDrivers();
        }

    } catch (err) {
        console.error("DDL execution error:", err);
        if (output) {
            output.className = "ddl-panel-output error";
            output.innerText = "✗ Network error or server unreachable.";
        }
    }
}


async function loadTableSchema() {
    const ambDiv = document.getElementById("ambulanceSchemaTable");
    const drvDiv = document.getElementById("driverSchemaTable");

    try {
        const response = await fetch("/api/ddl/schema");
        if (response.status === 401) return;

        const data = await response.json();
        const schema = data.schema || {};

        if (schema.AMBULANCE && Array.isArray(schema.AMBULANCE)) {
            tableSchemas.AMBULANCE = schema.AMBULANCE;
        }
        if (schema.DRIVER && Array.isArray(schema.DRIVER)) {
            tableSchemas.DRIVER = schema.DRIVER;
        }

        // Render DDL panel schema tables
        if (ambDiv && tableSchemas.AMBULANCE) {
            ambDiv.innerHTML = renderSchemaTableHtml(tableSchemas.AMBULANCE);
        }
        if (drvDiv && tableSchemas.DRIVER) {
            drvDiv.innerHTML = renderSchemaTableHtml(tableSchemas.DRIVER);
        }

        // Dynamically update site tables and adding boxes!
        renderAmbulanceTableHeaders();
        buildAmbulanceFormBoxes();
        renderAmbulancesTable(ambulancesList);

        renderDriverTableHeaders();
        buildDriverFormBoxes();
        renderDriversTable(driversList);

    } catch (err) {
        console.error("Failed to load table schema:", err);
    }
}


function renderSchemaTableHtml(columns) {
    if (!columns || columns.length === 0) {
        return `<p class="empty-state-text">No columns found.</p>`;
    }

    let rows = columns.map(c => `
        <tr>
            <td><code>${escapeHtml(c.column_name)}</code></td>
            <td><strong>${escapeHtml(c.data_type)}</strong></td>
            <td>${c.nullable === "N" ? '<span class="status-not-null">NOT NULL</span>' : "NULL"}</td>
            <td class="schema-key-col">${c.is_primary_key ? '<span class="key-primary">PRIMARY KEY</span>' : "—"}</td>
        </tr>
    `).join("");

    return `
        <table class="schema-mini-table">
            <thead>
                <tr>
                    <th>Column</th>
                    <th>Data Type</th>
                    <th>Null</th>
                    <th>Key</th>
                </tr>
            </thead>
            <tbody>${rows}</tbody>
        </table>
    `;
}


// ============================================================
// THEME SWITCHER (DARK / LIGHT MODE)
// ============================================================

function initTheme() {
    const savedTheme = localStorage.getItem("theme");
    const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
    const activeTheme = savedTheme || (prefersDark ? "dark" : "light");
    applyTheme(activeTheme);
}

function toggleTheme() {
    const isDark = document.documentElement.getAttribute("data-theme") === "dark";
    const nextTheme = isDark ? "light" : "dark";
    applyTheme(nextTheme);
}

function applyTheme(theme) {
    const icon = document.getElementById("themeToggleIcon");
    const text = document.getElementById("themeToggleText");

    if (theme === "dark") {
        document.documentElement.setAttribute("data-theme", "dark");
        document.body.classList.add("dark-mode");
        localStorage.setItem("theme", "dark");
        if (icon) icon.innerText = "☀️";
        if (text) text.innerText = "Light";
    } else {
        document.documentElement.removeAttribute("data-theme");
        document.body.classList.remove("dark-mode");
        localStorage.setItem("theme", "light");
        if (icon) icon.innerText = "🌙";
        if (text) text.innerText = "Dark";
    }
}


// ============================================================
// INITIAL LOAD
// ============================================================

document.addEventListener("DOMContentLoaded", async () => {
    // 0. Initialize theme (dark/light) from saved preference
    initTheme();
    // 1. First fetch active table schemas to configure dynamic columns and form boxes
    await loadTableSchema();
    // 2. Fetch and render ambulances & drivers data into the dynamically formatted tables
    await loadAmbulances();
    await loadDrivers();
});