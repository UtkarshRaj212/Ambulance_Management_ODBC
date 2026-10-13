// ============================================================
// SEED MOCK DATA (Requirement 4: Loaded when local DB is empty)
// ============================================================
const SEED_SCHEMA = {
    AMBULANCE: [
        { column_name: "ID", data_type: "NUMBER", nullable: "N", is_primary_key: true },
        { column_name: "VEHICLE_TYPE", data_type: "VARCHAR2(20)", nullable: "N", is_primary_key: false },
        { column_name: "MODEL", data_type: "VARCHAR2(50)", nullable: "N", is_primary_key: false },
        { column_name: "STATUS", data_type: "VARCHAR2(20)", nullable: "N", is_primary_key: false },
        { column_name: "REMARKS", data_type: "VARCHAR2(100)", nullable: "Y", is_primary_key: false }
    ],
    DRIVER: [
        { column_name: "DRIVER_ID", data_type: "NUMBER", nullable: "N", is_primary_key: true },
        { column_name: "DRIVER_NAME", data_type: "VARCHAR2(120)", nullable: "N", is_primary_key: false },
        { column_name: "DOB", data_type: "VARCHAR2(10)", nullable: "N", is_primary_key: false },
        { column_name: "AGE", data_type: "NUMBER(3)", nullable: "Y", is_primary_key: false },
        { column_name: "PHONE", data_type: "VARCHAR2(20)", nullable: "N", is_primary_key: false },
        { column_name: "LICENSE_NO", data_type: "VARCHAR2(50)", nullable: "N", is_primary_key: false },
        { column_name: "EXPERIENCE_YEARS", data_type: "NUMBER(2)", nullable: "Y", is_primary_key: false },
        { column_name: "STATUS", data_type: "VARCHAR2(20)", nullable: "N", is_primary_key: false },
        { column_name: "SALARY_MONTHLY", data_type: "NUMBER(10,2)", nullable: "N", is_primary_key: false }
    ]
};

const SEED_AMBULANCES = [
    { id: 101, vehicle_type: "BASIC", model: "Force Traveller 3350", status: "AVAILABLE", remarks: "Primary city emergency unit" },
    { id: 102, vehicle_type: "ADVANCED", model: "Tata Winger Ambulance", status: "ON DUTY", remarks: "Trauma response dispatch" },
    { id: 103, vehicle_type: "ICU", model: "Mercedes-Benz Sprinter ICU", status: "AVAILABLE", remarks: "Full ICU ventilator support" },
    { id: 104, vehicle_type: "BASIC", model: "Mahindra Bolero Maxi Truck", status: "MAINTENANCE", remarks: "Scheduled brake maintenance" }
];

const SEED_DRIVERS = [
    { driver_id: 201, driver_name: "Rajesh Kumar", dob: "15-08-1988", age: 38, phone: "9876543210", license_no: "DL-0420110012345", experience_years: 5, status: "AVAILABLE", salary_monthly: 25000.0, salary_annual: 300000.0 },
    { driver_id: 202, driver_name: "Suresh Sharma", dob: "22-04-1985", age: 41, phone: "9812345678", license_no: "DL-0720150067890", experience_years: 7, status: "ON DUTY", salary_monthly: 28000.0, salary_annual: 336000.0 },
    { driver_id: 203, driver_name: "Amit Singh", dob: "10-12-1994", age: 31, phone: "9701234567", license_no: "DL-0920180054321", experience_years: 3, status: "OFF DUTY", salary_monthly: 22000.0, salary_annual: 264000.0 },
    { driver_id: 204, driver_name: "Vikram Verma", dob: "05-06-1982", age: 44, phone: "9654321098", license_no: "DL-1120200098765", experience_years: 9, status: "AVAILABLE", salary_monthly: 30000.0, salary_annual: 360000.0 }
];

function calculateAgeFromDob(dobStr) {
    if (!dobStr || typeof dobStr !== "string") return null;
    const parts = dobStr.trim().split("-");
    if (parts.length !== 3) return null;
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const year = parseInt(parts[2], 10);
    if (isNaN(day) || isNaN(month) || isNaN(year)) return null;
    const birthDate = new Date(year, month, day);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
        age--;
    }
    return age >= 0 ? age : null;
}

// ============================================================
// LOCAL BROWSER DB ENGINE (Requirements 2, 3 & 4)
// ============================================================
const LocalDB = {
    SCHEMA_KEY: "AMS_SCHEMA",
    AMBULANCES_KEY: "AMS_AMBULANCES",
    DRIVERS_KEY: "AMS_DRIVERS",

    init() {
        if (!localStorage.getItem(this.SCHEMA_KEY)) {
            localStorage.setItem(this.SCHEMA_KEY, JSON.stringify(SEED_SCHEMA));
        }
        if (!localStorage.getItem(this.AMBULANCES_KEY)) {
            localStorage.setItem(this.AMBULANCES_KEY, JSON.stringify(SEED_AMBULANCES));
        }
        if (!localStorage.getItem(this.DRIVERS_KEY)) {
            localStorage.setItem(this.DRIVERS_KEY, JSON.stringify(SEED_DRIVERS));
        }
    },

    getSchema() {
        this.init();
        try {
            return JSON.parse(localStorage.getItem(this.SCHEMA_KEY)) || SEED_SCHEMA;
        } catch {
            return SEED_SCHEMA;
        }
    },

    saveSchema(schema) {
        localStorage.setItem(this.SCHEMA_KEY, JSON.stringify(schema));
    },

    getAmbulances() {
        this.init();
        try {
            return JSON.parse(localStorage.getItem(this.AMBULANCES_KEY)) || [];
        } catch {
            return [];
        }
    },

    saveAmbulances(list) {
        localStorage.setItem(this.AMBULANCES_KEY, JSON.stringify(list));
    },

    getDrivers() {
        this.init();
        try {
            const list = JSON.parse(localStorage.getItem(this.DRIVERS_KEY)) || [];
            return list.map(d => {
                const item = { ...d };
                if (item.salary_monthly !== undefined && item.salary_annual === undefined) {
                    item.salary_annual = Number(item.salary_monthly) * 12;
                }
                if (item.dob && (item.age === undefined || item.age === null)) {
                    item.age = calculateAgeFromDob(item.dob);
                }
                return item;
            });
        } catch {
            return [];
        }
    },

    saveDrivers(list) {
        localStorage.setItem(this.DRIVERS_KEY, JSON.stringify(list));
    },

    addAmbulance(payload) {
        const list = this.getAmbulances();
        const id = Number(payload.id);
        if (!id || id <= 0 || !Number.isInteger(id)) {
            return { ok: false, status: 400, data: { message: "Invalid Ambulance ID. Must be positive integer." } };
        }
        if (list.some(a => Number(a.id) === id)) {
            return { ok: false, status: 409, data: { message: `Ambulance with ID ${id} already exists.` } };
        }
        const record = { ...payload, id };
        list.push(record);
        this.saveAmbulances(list);
        return { ok: true, status: 201, data: { message: `Ambulance #${id} created successfully.`, data: record } };
    },

    updateAmbulance(id, payload) {
        const list = this.getAmbulances();
        const targetId = Number(id);
        const index = list.findIndex(a => Number(a.id) === targetId);
        if (index === -1) {
            return { ok: false, status: 404, data: { message: `Ambulance #${targetId} not found.` } };
        }
        list[index] = { ...list[index], ...payload, id: targetId };
        this.saveAmbulances(list);
        return { ok: true, status: 200, data: { message: `Ambulance #${targetId} updated successfully.`, data: list[index] } };
    },

    deleteAmbulance(id) {
        const list = this.getAmbulances();
        const targetId = Number(id);
        const nextList = list.filter(a => Number(a.id) !== targetId);
        if (nextList.length === list.length) {
            return { ok: false, status: 404, data: { message: `Ambulance #${targetId} not found.` } };
        }
        this.saveAmbulances(nextList);
        return { ok: true, status: 200, data: { message: `Ambulance #${targetId} deleted successfully.` } };
    },

    addDriver(payload) {
        const list = this.getDrivers();
        const driverId = Number(payload.driver_id);
        if (!driverId || driverId <= 0 || !Number.isInteger(driverId)) {
            return { ok: false, status: 400, data: { message: "Invalid Driver ID. Must be positive integer." } };
        }
        if (list.some(d => Number(d.driver_id) === driverId)) {
            return { ok: false, status: 409, data: { message: `Driver with ID ${driverId} already exists.` } };
        }
        const phone = String(payload.phone || "").trim();
        if (phone.length < 10) {
            return { ok: false, status: 400, data: { message: "Phone number must be at least 10 digits." } };
        }
        if (list.some(d => String(d.phone || "").trim() === phone)) {
            return { ok: false, status: 409, data: { message: `Phone number ${phone} is already registered.` } };
        }
        const license = String(payload.license_no || "").trim();
        if (!license) {
            return { ok: false, status: 400, data: { message: "License number is required." } };
        }
        if (list.some(d => String(d.license_no || "").trim().toUpperCase() === license.toUpperCase())) {
            return { ok: false, status: 409, data: { message: `License number ${license} is already registered.` } };
        }
        const monthly = Number(payload.salary_monthly || 0);
        const age = payload.age !== undefined && payload.age !== null ? Number(payload.age) : calculateAgeFromDob(payload.dob);
        const record = {
            ...payload,
            driver_id: driverId,
            phone,
            license_no: license,
            age,
            salary_monthly: monthly,
            salary_annual: monthly * 12
        };
        list.push(record);
        this.saveDrivers(list);
        return { ok: true, status: 201, data: { message: `Driver #${driverId} created successfully.`, data: record } };
    },

    updateDriver(id, payload) {
        const list = this.getDrivers();
        const targetId = Number(id);
        const index = list.findIndex(d => Number(d.driver_id) === targetId);
        if (index === -1) {
            return { ok: false, status: 404, data: { message: `Driver #${targetId} not found.` } };
        }
        const phone = payload.phone !== undefined ? String(payload.phone).trim() : list[index].phone;
        if (phone && phone.length < 10) {
            return { ok: false, status: 400, data: { message: "Phone number must be at least 10 digits." } };
        }
        if (phone && list.some(d => Number(d.driver_id) !== targetId && String(d.phone || "").trim() === phone)) {
            return { ok: false, status: 409, data: { message: `Phone number ${phone} is already registered to another driver.` } };
        }
        const license = payload.license_no !== undefined ? String(payload.license_no).trim() : list[index].license_no;
        if (license && list.some(d => Number(d.driver_id) !== targetId && String(d.license_no || "").trim().toUpperCase() === license.toUpperCase())) {
            return { ok: false, status: 409, data: { message: `License number ${license} is already registered to another driver.` } };
        }
        const monthly = payload.salary_monthly !== undefined ? Number(payload.salary_monthly) : list[index].salary_monthly;
        const dob = payload.dob !== undefined ? payload.dob : list[index].dob;
        const age = payload.age !== undefined && payload.age !== null ? Number(payload.age) : calculateAgeFromDob(dob);

        list[index] = {
            ...list[index],
            ...payload,
            driver_id: targetId,
            phone,
            license_no: license,
            salary_monthly: monthly,
            salary_annual: monthly * 12,
            age
        };
        this.saveDrivers(list);
        return { ok: true, status: 200, data: { message: `Driver #${targetId} updated successfully.`, data: list[index] } };
    },

    deleteDriver(id) {
        const list = this.getDrivers();
        const targetId = Number(id);
        const nextList = list.filter(d => Number(d.driver_id) !== targetId);
        if (nextList.length === list.length) {
            return { ok: false, status: 404, data: { message: `Driver #${targetId} not found.` } };
        }
        this.saveDrivers(nextList);
        return { ok: true, status: 200, data: { message: `Driver #${targetId} deleted successfully.` } };
    },

    executeDdl(rawSql) {
        if (!rawSql || !rawSql.trim()) {
            return { ok: false, status: 400, data: { message: "SQL statement is required." } };
        }
        const cleanSql = rawSql
            .replace(/--.*$/gm, "")
            .replace(/\/\*[\s\S]*?\*\//g, "")
            .trim();
        const upperSql = cleanSql.toUpperCase().replace(/\s+/g, " ");

        // Strictly ban DROP TABLE commands
        if (
            /\bDROP\s+(?:ONLINE\s+|GLOBAL\s+TEMPORARY\s+|TEMPORARY\s+)?TABLE\b/i.test(upperSql) ||
            upperSql.startsWith("DROP ") ||
            upperSql.includes("DROP TABLE") ||
            /^\s*DROP\b/i.test(upperSql)
        ) {
            return {
                ok: false,
                status: 403,
                data: {
                    success: false,
                    message: "Command Prohibited: DROP TABLE commands are strictly banned to protect database integrity and prevent data loss."
                }
            };
        }

        const allowedStarts = ["ALTER ", "CREATE ", "RENAME ", "COMMENT ", "TRUNCATE "];
        if (!allowedStarts.some(cmd => upperSql.startsWith(cmd))) {
            return {
                ok: false,
                status: 400,
                data: {
                    success: false,
                    message: "Invalid command: Only Oracle DDL statements (ALTER TABLE, CREATE, RENAME, COMMENT, TRUNCATE) are permitted."
                }
            };
        }

        const schema = this.getSchema();
        let targetTable = null;
        if (upperSql.startsWith("ALTER TABLE")) {
            const parts = upperSql.split(" ");
            if (parts.length >= 3) {
                const candidate = parts[2].replace(/["']/g, "");
                if (candidate === "AMBULANCE" || candidate === "DRIVER") {
                    targetTable = candidate;
                }
            }
            if (!targetTable) {
                return {
                    ok: false,
                    status: 400,
                    data: {
                        success: false,
                        message: "Invalid command: Target table must be AMBULANCE or DRIVER."
                    }
                };
            }
        }

        if (targetTable) {
            const tableCols = schema[targetTable] || [];
            const records = targetTable === "AMBULANCE" ? this.getAmbulances() : this.getDrivers();

            // ADD COLUMN
            const addMatch = upperSql.match(/ALTER\s+TABLE\s+[A-Za-z0-9_]+\s+ADD\s*\(?\s*([A-Za-z0-9_]+)\s+([A-Za-z0-9_()]+)/i);
            if (addMatch) {
                const colName = addMatch[1].toUpperCase();
                const colType = addMatch[2].toUpperCase();
                if (tableCols.some(c => c.column_name === colName)) {
                    return { ok: false, status: 400, data: { success: false, message: `Column '${colName}' already exists in ${targetTable}.` } };
                }
                const isNullable = upperSql.includes("NOT NULL") ? "N" : "Y";
                tableCols.push({
                    column_name: colName,
                    data_type: colType,
                    nullable: isNullable,
                    is_primary_key: false
                });
                schema[targetTable] = tableCols;
                this.saveSchema(schema);

                const colKey = colName.toLowerCase();
                records.forEach(r => { r[colKey] = null; });
                if (targetTable === "AMBULANCE") this.saveAmbulances(records);
                else this.saveDrivers(records);

                return {
                    ok: true,
                    status: 200,
                    data: {
                        success: true,
                        message: `Table ${targetTable} altered. Added column '${colName}' (${colType}).`
                    }
                };
            }

            // DROP COLUMN
            const dropMatch = upperSql.match(/ALTER\s+TABLE\s+[A-Za-z0-9_]+\s+DROP\s+(?:COLUMN\s+)?\(?\s*([A-Za-z0-9_]+)\s*\)?/i);
            if (dropMatch) {
                const colName = dropMatch[1].toUpperCase();
                if (colName === "ID" || colName === "DRIVER_ID") {
                    return { ok: false, status: 400, data: { success: false, message: `Cannot drop primary key column ${colName}.` } };
                }
                const idx = tableCols.findIndex(c => c.column_name === colName);
                if (idx === -1) {
                    return { ok: false, status: 400, data: { success: false, message: `Column '${colName}' does not exist in ${targetTable}.` } };
                }
                tableCols.splice(idx, 1);
                schema[targetTable] = tableCols;
                this.saveSchema(schema);

                const colKey = colName.toLowerCase();
                records.forEach(r => { delete r[colKey]; });
                if (targetTable === "AMBULANCE") this.saveAmbulances(records);
                else this.saveDrivers(records);

                return {
                    ok: true,
                    status: 200,
                    data: {
                        success: true,
                        message: `Table ${targetTable} altered. Dropped column '${colName}'.`
                    }
                };
            }

            // RENAME COLUMN
            const renameMatch = upperSql.match(/ALTER\s+TABLE\s+[A-Za-z0-9_]+\s+RENAME\s+COLUMN\s+([A-Za-z0-9_]+)\s+TO\s+([A-Za-z0-9_]+)/i);
            if (renameMatch) {
                const oldCol = renameMatch[1].toUpperCase();
                const newCol = renameMatch[2].toUpperCase();
                const colObj = tableCols.find(c => c.column_name === oldCol);
                if (!colObj) {
                    return { ok: false, status: 400, data: { success: false, message: `Column '${oldCol}' does not exist in ${targetTable}.` } };
                }
                colObj.column_name = newCol;
                schema[targetTable] = tableCols;
                this.saveSchema(schema);

                const oldKey = oldCol.toLowerCase();
                const newKey = newCol.toLowerCase();
                records.forEach(r => {
                    if (r[oldKey] !== undefined) {
                        r[newKey] = r[oldKey];
                        delete r[oldKey];
                    }
                });
                if (targetTable === "AMBULANCE") this.saveAmbulances(records);
                else this.saveDrivers(records);

                return {
                    ok: true,
                    status: 200,
                    data: {
                        success: true,
                        message: `Table ${targetTable} altered. Renamed column '${oldCol}' to '${newCol}'.`
                    }
                };
            }

            // MODIFY COLUMN
            const modMatch = upperSql.match(/ALTER\s+TABLE\s+[A-Za-z0-9_]+\s+MODIFY\s*\(?\s*([A-Za-z0-9_]+)\s+([A-Za-z0-9_()]+)/i);
            if (modMatch) {
                const colName = modMatch[1].toUpperCase();
                const newType = modMatch[2].toUpperCase();
                const colObj = tableCols.find(c => c.column_name === colName);
                if (!colObj) {
                    return { ok: false, status: 400, data: { success: false, message: `Column '${colName}' does not exist in ${targetTable}.` } };
                }
                colObj.data_type = newType;
                schema[targetTable] = tableCols;
                this.saveSchema(schema);

                return {
                    ok: true,
                    status: 200,
                    data: {
                        success: true,
                        message: `Table ${targetTable} modified. Column '${colName}' data type updated to ${newType}.`
                    }
                };
            }
        }

        if (upperSql.startsWith("TRUNCATE TABLE")) {
            const parts = upperSql.split(" ");
            const tbl = parts[2] ? parts[2].replace(/["']/g, "") : "";
            if (tbl === "AMBULANCE") this.saveAmbulances([]);
            else if (tbl === "DRIVER") this.saveDrivers([]);
            return {
                ok: true,
                status: 200,
                data: { success: true, message: `Table ${tbl} truncated successfully.` }
            };
        }

        return {
            ok: true,
            status: 200,
            data: { success: true, message: "Command executed successfully on database." }
        };
    }
};

if (typeof window !== "undefined") {
    window.LocalDB = LocalDB;
} else if (typeof global !== "undefined") {
    global.LocalDB = LocalDB;
}

// ============================================================
// TRANSPARENT API ROUTER & FALLBACK (Requirement 2)
// Does NOT display local mode or offline indicators anywhere
// ============================================================
let isServerAvailable = null;

async function handleWithLocalDB(url, options = {}) {
    LocalDB.init();
    const method = (options.method || "GET").toUpperCase();
    let body = {};
    if (options.body) {
        try { body = typeof options.body === "string" ? JSON.parse(options.body) : options.body; } catch {}
    }

    const pathname = url.split("?")[0];
    let result = { ok: true, status: 200, data: {} };

    if (pathname === "/api/ambulances" && method === "GET") {
        result = { ok: true, status: 200, data: LocalDB.getAmbulances() };
    } else if (pathname === "/api/ambulances" && method === "POST") {
        result = LocalDB.addAmbulance(body);
    } else if (pathname.startsWith("/api/ambulances/") && method === "PUT") {
        const id = pathname.split("/").pop();
        result = LocalDB.updateAmbulance(id, body);
    } else if (pathname.startsWith("/api/ambulances/") && method === "DELETE") {
        const id = pathname.split("/").pop();
        result = LocalDB.deleteAmbulance(id);
    } else if (pathname === "/api/drivers" && method === "GET") {
        result = { ok: true, status: 200, data: LocalDB.getDrivers() };
    } else if (pathname === "/api/drivers" && method === "POST") {
        result = LocalDB.addDriver(body);
    } else if (pathname.startsWith("/api/drivers/") && method === "PUT") {
        const id = pathname.split("/").pop();
        result = LocalDB.updateDriver(id, body);
    } else if (pathname.startsWith("/api/drivers/") && method === "DELETE") {
        const id = pathname.split("/").pop();
        result = LocalDB.deleteDriver(id);
    } else if ((pathname === "/api/ddl/schema" || pathname === "/api/schema") && method === "GET") {
        result = { ok: true, status: 200, data: { schema: LocalDB.getSchema() } };
    } else if (pathname === "/api/ddl/execute" && method === "POST") {
        result = LocalDB.executeDdl(body.sql);
    } else if (pathname === "/api/db-status") {
        result = { ok: true, status: 200, data: { connected: true, mode: "Connected" } };
    } else if (pathname === "/api/login" && method === "POST") {
        const validUsers = {
            "admin": { password: "admin123", role: "admin" },
            "manager": { password: "manager123", role: "manager" },
            "chief": { password: "chief123", role: "chief" }
        };
        const u = validUsers[(body.username || "").toLowerCase()];
        if (u && u.password === body.password) {
            localStorage.setItem("AMS_CURRENT_USER", JSON.stringify({
                username: (body.username || "").toLowerCase(),
                role: u.role,
                loggedIn: true
            }));
            result = { ok: true, status: 200, data: { success: true, username: body.username, role: u.role, redirect: "dashboard.html" } };
        } else {
            result = { ok: false, status: 401, data: { success: false, message: "Invalid username or password." } };
        }
    } else if (pathname === "/api/logout") {
        localStorage.removeItem("AMS_CURRENT_USER");
        result = { ok: true, status: 200, data: { success: true, redirect: "index.html" } };
    } else {
        result = { ok: true, status: 200, data: { success: true } };
    }

    return {
        ok: result.ok !== false,
        status: result.status || 200,
        json: async () => result.data !== undefined ? result.data : result,
        text: async () => JSON.stringify(result.data !== undefined ? result.data : result)
    };
}

async function apiFetch(url, options = {}) {
    if (isServerAvailable === false) {
        return handleWithLocalDB(url, options);
    }

    try {
        const response = await fetch(url, options);
        // If static host returns 404 for an API endpoint
        if (response.status === 404 && url.startsWith("/api/")) {
            isServerAvailable = false;
            return handleWithLocalDB(url, options);
        }
        isServerAvailable = true;
        return response;
    } catch (err) {
        isServerAvailable = false;
        return handleWithLocalDB(url, options);
    }
}

// ============================================================
// AUTHENTICATION & SESSION MANAGEMENT
// ============================================================
async function handleLoginSubmit(event) {
    if (event) event.preventDefault();
    const usernameInput = document.getElementById("loginUsername");
    const passwordInput = document.getElementById("loginPassword");
    const errorP = document.getElementById("loginError");
    const submitBtn = document.getElementById("loginSubmitBtn");

    const username = usernameInput ? usernameInput.value.trim() : "";
    const password = passwordInput ? passwordInput.value.trim() : "";

    if (!username || !password) {
        if (errorP) {
            errorP.innerText = "Please enter both username and password.";
            errorP.style.display = "block";
        }
        return;
    }

    if (errorP) errorP.style.display = "none";
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerText = "Logging in...";
    }

    try {
        const response = await apiFetch("/api/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json().catch(() => ({}));

        if (response.ok && data.success) {
            localStorage.setItem("AMS_CURRENT_USER", JSON.stringify({
                username: data.username || username,
                role: data.role || "admin",
                loggedIn: true
            }));
            LocalDB.init();
            window.location.href = "dashboard.html";
        } else {
            if (errorP) {
                errorP.innerText = data.message || "Invalid username or password.";
                errorP.style.display = "block";
            }
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerText = "Login";
            }
        }
    } catch (err) {
        if (errorP) {
            errorP.innerText = "Authentication error. Please try again.";
            errorP.style.display = "block";
        }
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerText = "Login";
        }
    }
}

async function handleLogout() {
    try {
        await apiFetch("/api/logout", { method: "POST" });
    } catch {}
    localStorage.removeItem("AMS_CURRENT_USER");
    window.location.href = "index.html";
}

function initAuthAndPermissions() {
    let currentUser = null;
    try {
        currentUser = JSON.parse(localStorage.getItem("AMS_CURRENT_USER"));
    } catch {}

    const isDashboard = document.getElementById("ambulanceSection") !== null;
    if (isDashboard && (!currentUser || !currentUser.loggedIn)) {
        window.location.href = "index.html";
        return;
    }

    if (currentUser) {
        const uEl = document.getElementById("headerUsername");
        const rEl = document.getElementById("headerUserRole");
        if (uEl) uEl.innerText = currentUser.username;
        if (rEl) rEl.innerText = currentUser.role.charAt(0).toUpperCase() + currentUser.role.slice(1);

        const role = currentUser.role;
        const cardTotalAmb = document.getElementById("cardTotalAmbulances");
        const cardAvailAmb = document.getElementById("cardAvailableAmbulances");
        const cardTotalDrv = document.getElementById("cardTotalDrivers");
        const cardAvailDrv = document.getElementById("cardAvailableDrivers");
        const driverSection = document.getElementById("driverSection");

        if (role === "chief") {
            if (driverSection) driverSection.style.display = "none";
            if (cardTotalDrv) cardTotalDrv.style.display = "none";
            if (cardAvailDrv) cardAvailDrv.style.display = "none";
        } else if (role === "manager") {
            if (cardTotalAmb) cardTotalAmb.style.display = "none";
            if (cardAvailAmb) cardAvailAmb.style.display = "none";
        }
    }
}

// ============================================================
// GLOBAL STATE & SCHEMA SPECIFICATIONS
// ============================================================
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

const BASE_AMBULANCE_COLS = new Set(["ID", "VEHICLE_TYPE", "MODEL", "STATUS", "REMARKS"]);
const BASE_DRIVER_COLS = new Set(["DRIVER_ID", "DRIVER_NAME", "DOB", "AGE", "PHONE", "LICENSE_NO", "EXPERIENCE_YEARS", "STATUS", "SALARY_MONTHLY"]);

function escapeHtml(str) {
    if (str === null || str === undefined) return "";
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

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

function getInputType(dataType) {
    if (!dataType) return "text";
    const dt = dataType.toUpperCase();
    if (dt.includes("NUMBER") || dt.includes("INT") || dt.includes("FLOAT")) return "number";
    if (dt.includes("DATE")) return "date";
    return "text";
}

function getStatusPill(status) {
    const s = (status || "").toUpperCase();
    let cls = "status-pill";
    if (s === "AVAILABLE") cls += " available";
    else if (s === "ON DUTY") cls += " onduty";
    else if (s === "MAINTENANCE" || s === "OFF DUTY") cls += " maintenance";
    return `<span class="${cls}">${escapeHtml(s)}</span>`;
}

function getAmbulanceColumns() {
    return (tableSchemas.AMBULANCE && tableSchemas.AMBULANCE.length > 0)
        ? tableSchemas.AMBULANCE
        : DEFAULT_AMBULANCE_COLUMNS;
}

function getDriverColumns() {
    return (tableSchemas.DRIVER && tableSchemas.DRIVER.length > 0)
        ? tableSchemas.DRIVER
        : DEFAULT_DRIVER_COLUMNS;
}

// ============================================================
// AMBULANCE SECTION RENDERING & ACTIONS
// ============================================================
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
        const star = isReq ? '<span style="color:#ef4444;">*</span>' : "";
        const isNew = !BASE_AMBULANCE_COLS.has(upper);
        const newBadge = isNew ? ' <span class="new-col-badge">New</span>' : "";

        const box = document.createElement("div");
        box.className = "form-group";

        if (colKey === "id") {
            box.innerHTML = `
                <label class="field-label" for="amb_id">${escapeHtml(label)} ${star}</label>
                <input type="number" id="amb_id" data-col="id" placeholder="e.g. 105" min="1" ${isReq ? "required" : ""}>
            `;
        } else if (colKey === "vehicle_type") {
            box.innerHTML = `
                <label class="field-label" for="amb_vehicle_type">${escapeHtml(label)} ${star}${newBadge}</label>
                <select id="amb_vehicle_type" data-col="vehicle_type" ${isReq ? "required" : ""}>
                    <option value="">Select Type</option>
                    <option value="BASIC">BASIC</option>
                    <option value="ADVANCED">ADVANCED</option>
                    <option value="ICU">ICU</option>
                </select>
            `;
        } else if (colKey === "status") {
            box.innerHTML = `
                <label class="field-label" for="amb_status">${escapeHtml(label)} ${star}${newBadge}</label>
                <select id="amb_status" data-col="status" ${isReq ? "required" : ""}>
                    <option value="AVAILABLE">AVAILABLE</option>
                    <option value="ON DUTY">ON DUTY</option>
                    <option value="MAINTENANCE">MAINTENANCE</option>
                </select>
            `;
        } else if (colKey === "remarks") {
            box.innerHTML = `
                <label class="field-label" for="amb_remarks">${escapeHtml(label)} ${star}${newBadge}</label>
                <input type="text" id="amb_remarks" data-col="remarks" placeholder="Remarks / Service Notes (Optional)" maxlength="100" ${isReq ? "required" : ""}>
            `;
        } else {
            const inputType = getInputType(c.data_type);
            box.innerHTML = `
                <label class="field-label" for="amb_${colKey}">${escapeHtml(label)} ${star}${newBadge}</label>
                <input type="${inputType}" id="amb_${colKey}" data-col="${colKey}" placeholder="${escapeHtml(label)} (${escapeHtml(c.data_type)})" ${isReq ? "required" : ""}>
            `;
        }

        grid.appendChild(box);
    });
}

async function loadAmbulances() {
    try {
        const response = await apiFetch("/api/ambulances");

        if (response.status === 401) {
            window.location.href = "index.html";
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
    const searchInput = document.getElementById("ambulanceSearch");
    const filterSelect = document.getElementById("ambulanceFilter");
    const searchText = (searchInput ? searchInput.value : "").toLowerCase().trim();
    const statusFilter = (filterSelect ? filterSelect.value : "").toUpperCase().trim();

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

    const titleEl = document.getElementById("ambulanceFormTitle");
    const formEl = document.getElementById("ambulanceForm");
    if (titleEl) titleEl.innerText = "Add New Ambulance";
    if (formEl) formEl.style.display = "block";

    clearAmbulanceForm();
}

function closeAmbulanceForm() {
    const formEl = document.getElementById("ambulanceForm");
    if (formEl) formEl.style.display = "none";
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

    const titleEl = document.getElementById("ambulanceFormTitle");
    const formEl = document.getElementById("ambulanceForm");
    if (titleEl) titleEl.innerText = `Modify Ambulance #${ambulance.id}`;
    if (formEl) formEl.style.display = "block";

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
            response = await apiFetch(`/api/ambulances/${editingAmbulanceId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });
        } else {
            response = await apiFetch("/api/ambulances", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });
        }

        if (response.status === 401) {
            alert("Session expired. Please log in again.");
            window.location.href = "index.html";
            return;
        }

        const result = await response.json();
        alert(result.message || (response.ok ? "Operation successful." : "An error occurred."));

        if (response.ok) {
            closeAmbulanceForm();
            loadAmbulances();
        }
    } catch (err) {
        console.error("Operation error:", err);
        alert("Operation could not be completed.");
    }
}

async function deleteAmbulance(id) {
    if (!confirm(`Are you sure you want to delete ambulance #${id}?`)) {
        return;
    }

    try {
        const response = await apiFetch(`/api/ambulances/${id}`, {
            method: "DELETE"
        });

        if (response.status === 401) {
            window.location.href = "index.html";
            return;
        }

        const result = await response.json();
        alert(result.message || (response.ok ? "Ambulance deleted." : "Failed to delete ambulance."));

        if (response.ok) {
            loadAmbulances();
        }
    } catch (err) {
        console.error("Deletion error:", err);
        alert("Could not delete ambulance.");
    }
}

// ============================================================
// DRIVER SECTION RENDERING & ACTIONS
// ============================================================
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
        const star = isReq ? '<span style="color:#ef4444;">*</span>' : "";
        const isNew = !BASE_DRIVER_COLS.has(upper);
        const newBadge = isNew ? ' <span class="new-col-badge">New</span>' : "";

        const box = document.createElement("div");
        box.className = "form-group";

        if (colKey === "driver_id") {
            box.innerHTML = `
                <label class="field-label" for="driver_id">${escapeHtml(label)} ${star}</label>
                <input type="number" id="driver_id" data-col="driver_id" placeholder="e.g. 205" min="1" ${isReq ? "required" : ""}>
            `;
        } else if (colKey === "dob") {
            box.innerHTML = `
                <label class="field-label" for="dob">${escapeHtml(label)} ${star}${newBadge}</label>
                <input type="text" id="dob" data-col="dob" placeholder="DD-MM-YYYY (e.g. 15-08-1990)" pattern="\\d{2}-\\d{2}-\\d{4}" ${isReq ? "required" : ""}>
                <span style="font-size: 11px; color:#6b7280; margin-top:3px; display:block;">Format: DD-MM-YYYY</span>
            `;
        } else if (colKey === "age") {
            box.innerHTML = `
                <label class="field-label" for="driver_age_preview">Calculated Age${newBadge}</label>
                <input type="text" id="driver_age_preview" data-col="age" class="readonly-age-field" value="Derived Age: —" readonly title="Automatically calculated from Date of Birth">
            `;
        } else if (colKey === "status") {
            box.innerHTML = `
                <label class="field-label" for="driver_status">${escapeHtml(label)} ${star}${newBadge}</label>
                <select id="driver_status" data-col="status" ${isReq ? "required" : ""}>
                    <option value="AVAILABLE">AVAILABLE</option>
                    <option value="ON DUTY">ON DUTY</option>
                    <option value="OFF DUTY">OFF DUTY</option>
                </select>
            `;
        } else if (colKey === "phone") {
            box.innerHTML = `
                <label class="field-label" for="phone">${escapeHtml(label)} ${star}${newBadge}</label>
                <input type="text" id="phone" data-col="phone" placeholder="Mobile Contact (10 digits)" maxlength="20" ${isReq ? "required" : ""}>
            `;
        } else if (colKey === "license_no") {
            box.innerHTML = `
                <label class="field-label" for="license_no">${escapeHtml(label)} ${star}${newBadge}</label>
                <input type="text" id="license_no" data-col="license_no" placeholder="Commercial DL Number" maxlength="50" ${isReq ? "required" : ""}>
            `;
        } else if (colKey === "experience_years") {
            box.innerHTML = `
                <label class="field-label" for="experience_years">${escapeHtml(label)}${newBadge}</label>
                <input type="number" id="experience_years" data-col="experience_years" placeholder="Years of Experience" min="0" max="50" value="0">
            `;
        } else if (colKey === "salary_monthly") {
            box.innerHTML = `
                <label class="field-label" for="salary_monthly">${escapeHtml(label)} ${star}${newBadge}</label>
                <input type="number" id="salary_monthly" data-col="salary_monthly" placeholder="Monthly Salary (₹)" min="0" step="0.01" ${isReq ? "required" : ""}>
            `;
        } else {
            const inputType = getInputType(c.data_type);
            box.innerHTML = `
                <label class="field-label" for="drv_${colKey}">${escapeHtml(label)} ${star}${newBadge}</label>
                <input type="${inputType}" id="drv_${colKey}" data-col="${colKey}" placeholder="${escapeHtml(label)} (${escapeHtml(c.data_type)})" ${isReq ? "required" : ""}>
            `;
        }

        grid.appendChild(box);
    });

    const dobInput = document.getElementById("dob");
    if (dobInput) {
        dobInput.addEventListener("input", function() {
            const ageInput = document.getElementById("driver_age_preview");
            if (!ageInput) return;
            const age = calculateAgeFromDob(this.value);
            ageInput.value = age !== null ? `${age} yrs` : "Derived Age: —";
        });
    }
}

async function loadDrivers() {
    try {
        const response = await apiFetch("/api/drivers");

        if (response.status === 401) {
            window.location.href = "index.html";
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
    const searchInput = document.getElementById("driverSearch");
    const filterSelect = document.getElementById("driverFilter");
    const searchText = (searchInput ? searchInput.value : "").toLowerCase().trim();
    const statusFilter = (filterSelect ? filterSelect.value : "").toUpperCase().trim();

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

    const titleEl = document.getElementById("driverFormTitle");
    const formEl = document.getElementById("driverForm");
    if (titleEl) titleEl.innerText = "Add New Driver";
    if (formEl) formEl.style.display = "block";

    clearDriverForm();
}

function closeDriverForm() {
    const formEl = document.getElementById("driverForm");
    if (formEl) formEl.style.display = "none";
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

    const titleEl = document.getElementById("driverFormTitle");
    const formEl = document.getElementById("driverForm");
    if (titleEl) titleEl.innerText = `Modify Driver #${driver.driver_id}`;
    if (formEl) formEl.style.display = "block";

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
            const ageVal = driver.age !== undefined && driver.age !== null ? driver.age : calculateAgeFromDob(driver.dob);
            input.value = ageVal !== null ? `${ageVal} yrs` : "Derived Age: —";
        } else {
            input.value = driver[col] !== undefined && driver[col] !== null ? driver[col] : "";
            input.disabled = false;
        }
    });
}

async function saveDriver() {
    const grid = document.getElementById("driverFormGrid");
    if (!grid) return;

    const inputs = grid.querySelectorAll("input, select");
    const payload = {};

    for (const input of inputs) {
        const col = input.getAttribute("data-col");
        if (!col) continue;

        if (col === "age") continue;

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
        } else if (col === "dob" && val) {
            const dobPattern = /^\d{2}-\d{2}-\d{4}$/;
            if (!dobPattern.test(val)) {
                alert("Date of birth must be in DD-MM-YYYY format (e.g. 15-08-1990).");
                input.focus();
                return;
            }
            const calculatedAge = calculateAgeFromDob(val);
            if (calculatedAge === null || calculatedAge < 18 || calculatedAge > 70) {
                alert("Driver age must be between 18 and 70 years based on Date of Birth.");
                input.focus();
                return;
            }
            payload[col] = val;
            payload["age"] = calculatedAge;
        } else if (col === "phone" && val) {
            if (val.length < 10) {
                alert("Phone number must have at least 10 digits.");
                input.focus();
                return;
            }
            payload[col] = val;
        } else if (col === "salary_monthly" && val !== "") {
            const salary = Number(val);
            if (isNaN(salary) || salary < 0) {
                alert("Monthly salary cannot be negative.");
                input.focus();
                return;
            }
            payload[col] = salary;
            payload["salary_annual"] = salary * 12;
        } else if (input.type === "number" && val !== "") {
            payload[col] = Number(val);
        } else {
            payload[col] = val;
        }
    }

    try {
        let response;
        if (editingDriver) {
            response = await apiFetch(`/api/drivers/${editingDriverId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });
        } else {
            response = await apiFetch("/api/drivers", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });
        }

        if (response.status === 401) {
            alert("Session expired. Please log in again.");
            window.location.href = "index.html";
            return;
        }

        const result = await response.json();
        alert(result.message || (response.ok ? "Operation successful." : "An error occurred."));

        if (response.ok) {
            closeDriverForm();
            loadDrivers();
        }
    } catch (err) {
        console.error("Operation error:", err);
        alert("Operation could not be completed.");
    }
}

async function deleteDriver(id) {
    if (!confirm(`Are you sure you want to delete driver #${id}?`)) {
        return;
    }

    try {
        const response = await apiFetch(`/api/drivers/${id}`, {
            method: "DELETE"
        });

        if (response.status === 401) {
            window.location.href = "index.html";
            return;
        }

        const result = await response.json();
        alert(result.message || (response.ok ? "Driver deleted." : "Failed to delete driver."));

        if (response.ok) {
            loadDrivers();
        }
    } catch (err) {
        console.error("Deletion error:", err);
        alert("Could not delete driver.");
    }
}

// ============================================================
// SUMMARY CARDS UPDATE
// ============================================================
function updateSummary() {
    const totalAmb = ambulancesList.length;
    const availAmb = ambulancesList.filter(a => (a.status || "").toUpperCase() === "AVAILABLE").length;
    const totalDrv = driversList.length;
    const availDrv = driversList.filter(d => (d.status || "").toUpperCase() === "AVAILABLE").length;

    const elTotalAmb = document.getElementById("summaryTotalAmbulances");
    const elAvailAmb = document.getElementById("summaryAvailableAmbulances");
    const elTotalDrv = document.getElementById("summaryTotalDrivers");
    const elAvailDrv = document.getElementById("summaryAvailableDrivers");

    if (elTotalAmb) elTotalAmb.innerText = totalAmb;
    if (elAvailAmb) elAvailAmb.innerText = availAmb;
    if (elTotalDrv) elTotalDrv.innerText = totalDrv;
    if (elAvailDrv) elAvailDrv.innerText = availDrv;
}

// ============================================================
// TABLE SCHEMA DDL OPERATIONS & DYNAMIC COLUMN PROPAGATION
// ============================================================
function toggleTableSchema(tableName) {
    const panelId = tableName === "AMBULANCE" ? "ambulanceSchemaPanel" : "driverSchemaPanel";
    const panel = document.getElementById(panelId);
    if (!panel) return;

    const isVisible = panel.style.display !== "none";
    panel.style.display = isVisible ? "none" : "block";

    if (!isVisible) {
        loadTableSchema();
        const inputId = tableName === "AMBULANCE" ? "ambulanceDdlInput" : "driverDdlInput";
        const input = document.getElementById(inputId);
        if (input) input.focus();
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
        normalizedUpper.includes("DROP TABLE") ||
        /^\s*DROP\b/i.test(normalizedUpper)
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
        const response = await apiFetch("/api/ddl/execute", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sql: rawSql })
        });

        if (response.status === 401) {
            alert("Session expired. Please log in again.");
            window.location.href = "index.html";
            return;
        }

        const data = await response.json();

        if (output) {
            if (response.ok) {
                output.className = "ddl-panel-output";
                output.innerText = `✓ Command Executed Successfully:\n${data.message || "Database schema modified successfully."}`;
            } else {
                output.className = "ddl-panel-output error";
                output.innerText = `✗ Command Failed:\n${data.message || "Syntax error or unsupported DDL statement."}`;
            }
        }

        if (response.ok) {
            await loadTableSchema();
            await loadAmbulances();
            await loadDrivers();
        }

    } catch (err) {
        console.error("DDL execution error:", err);
        if (output) {
            output.className = "ddl-panel-output error";
            output.innerText = "✗ Command execution failed.";
        }
    }
}

async function loadTableSchema() {
    const ambDiv = document.getElementById("ambulanceSchemaTable");
    const drvDiv = document.getElementById("driverSchemaTable");

    try {
        const response = await apiFetch("/api/ddl/schema");
        if (response.status === 401) return;

        const data = await response.json();
        const schema = data.schema || {};

        if (schema.AMBULANCE && Array.isArray(schema.AMBULANCE)) {
            tableSchemas.AMBULANCE = schema.AMBULANCE;
        }
        if (schema.DRIVER && Array.isArray(schema.DRIVER)) {
            tableSchemas.DRIVER = schema.DRIVER;
        }

        if (ambDiv && tableSchemas.AMBULANCE) {
            ambDiv.innerHTML = renderSchemaTableHtml(tableSchemas.AMBULANCE);
        }
        if (drvDiv && tableSchemas.DRIVER) {
            drvDiv.innerHTML = renderSchemaTableHtml(tableSchemas.DRIVER);
        }

        renderAmbulanceTableHeaders();
        buildAmbulanceFormBoxes();
        renderDriverTableHeaders();
        buildDriverFormBoxes();

    } catch (err) {
        console.error("Error loading table schema:", err);
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
// THEME MANAGEMENT (DARK / LIGHT MODE)
// ============================================================
function initTheme() {
    const saved = localStorage.getItem("theme");
    const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
    applyTheme(saved || (prefersDark ? "dark" : "light"));
}

function toggleTheme() {
    const isDark = document.documentElement.getAttribute("data-theme") === "dark";
    applyTheme(isDark ? "light" : "dark");
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
// INITIAL LOAD HANDLER
// ============================================================
if (typeof document !== "undefined") {
    document.addEventListener("DOMContentLoaded", async () => {
        initTheme();

        const isDashboard = document.getElementById("ambulanceSection") !== null;
        if (isDashboard) {
            initAuthAndPermissions();
            await loadTableSchema();
            await loadAmbulances();
            await loadDrivers();
        }
    });
}