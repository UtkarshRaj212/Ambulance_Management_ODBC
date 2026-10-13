import os
import re
import copy
import logging
from functools import wraps
from datetime import timedelta, datetime, date
from flask import Flask, render_template, request, jsonify, redirect, session, url_for
from werkzeug.security import generate_password_hash, check_password_hash
try:
    from dotenv import load_dotenv
    load_dotenv()
except Exception:
    pass
import oracledb
from db import get_connection, test_connection

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)

# Security & Session Configuration
app.secret_key = os.getenv("SECRET_KEY", "ambulance-management-secret-pat4")
app.config.update(
    SESSION_COOKIE_HTTPONLY=True,
    SESSION_COOKIE_SAMESITE="Lax",
    SESSION_COOKIE_SECURE=os.getenv("SESSION_COOKIE_SECURE", "false").lower() == "true",
    PERMANENT_SESSION_LIFETIME=timedelta(hours=2),
    TEMPLATES_AUTO_RELOAD=True,
    SEND_FILE_MAX_AGE_DEFAULT=0
)

# Authentication credentials & user profiles
APP_USERS = {
    os.getenv("APP_USERNAME", "admin").strip(): {
        "password": os.getenv("APP_PASSWORD", "admin123").strip(),
        "role": "admin"
    },
    "manager": {
        "password": "manager123",
        "role": "manager"
    },
    "chief": {
        "password": "chief123",
        "role": "chief"
    }
}

# Allowed constraint sets
ALLOWED_VEHICLE_TYPES = {"BASIC", "ADVANCED", "ICU"}
ALLOWED_AMBULANCE_STATUSES = {"AVAILABLE", "ON DUTY", "MAINTENANCE"}
ALLOWED_DRIVER_STATUSES = {"AVAILABLE", "ON DUTY", "OFF DUTY"}


def calculate_age_from_dob(dob_str):
    """Derive driver age in completed years from DD-MM-YYYY string."""
    if not dob_str or not isinstance(dob_str, str):
        return None
    try:
        dt = datetime.strptime(dob_str.strip(), "%d-%m-%Y").date()
        today = date.today()
        if dt > today:
            return None
        age = today.year - dt.year - ((today.month, today.day) < (dt.month, dt.day))
        return age if 0 <= age <= 120 else None
    except ValueError:
        return None





def login_required(f):
    """Decorator to protect API routes against unauthenticated access."""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not session.get("logged_in"):
            return jsonify({"message": "Unauthorized. Please log in first."}), 401
        return f(*args, **kwargs)
    return decorated_function


def handle_db_error(e, default_status=500):
    """Sanitize and format database error messages without exposing SQL or credentials."""
    logger.error("Database operation error: %s", e, exc_info=True)
    msg = str(e).lower()

    if isinstance(e, oracledb.Error):
        if "ora-00001" in msg:
            return jsonify({"message": "A record with this ID or unique value already exists."}), 409
        if "ora-02290" in msg:
            return jsonify({"message": "Data validation failed: violated database constraint."}), 400
        if "ora-12899" in msg:
            return jsonify({"message": "Input value is too long for the database field."}), 400
        if "ora-01400" in msg or "ora-01407" in msg:
            return jsonify({"message": "Required fields cannot be empty."}), 400
        if "dpy-6005" in msg or "ora-12541" in msg or "ora-12154" in msg or "timed out" in msg:
            return jsonify({"message": "Unable to connect to the Oracle database. Please check database configuration."}), 503

    if isinstance(e, ValueError):
        return jsonify({"message": str(e)}), 400

    return jsonify({"message": "A database error occurred. Please try again later."}), default_status


# ============================================================
# AUTHENTICATION ROUTES
# ============================================================

@app.route("/", methods=["GET", "POST"])
def login():
    if request.method == "POST":
        username = request.form.get("username", "").strip()
        password = request.form.get("password", "")

        user = APP_USERS.get(username)
        if user and (password == user.get("password") or check_password_hash(user.get("password_hash", ""), password)):
            session.clear()
            session["logged_in"] = True
            session["username"] = username
            session["role"] = user.get("role", "admin")
            session.permanent = True
            return redirect(url_for("dashboard"))

        return render_template(
            "login.html",
            error="Invalid username or password."
        )

    if session.get("logged_in"):
        return redirect(url_for("dashboard"))

    return render_template("login.html")


@app.route("/dashboard")
def dashboard():
    if not session.get("logged_in"):
        return redirect(url_for("login"))

    role = session.get("role", "admin")
    username = session.get("username", "admin")
    return render_template("dashboard.html", user_role=role, username=username)


@app.route("/logout")
def logout():
    session.clear()
    return redirect(url_for("login"))


# ============================================================
# SYSTEM STATUS & FALLBACK DATA STORE
# ============================================================

DEFAULT_SCHEMA = {
    "AMBULANCE": [
        {"column_name": "ID", "data_type": "NUMBER", "nullable": "N", "is_primary_key": True},
        {"column_name": "VEHICLE_TYPE", "data_type": "VARCHAR2(20)", "nullable": "N", "is_primary_key": False},
        {"column_name": "MODEL", "data_type": "VARCHAR2(50)", "nullable": "N", "is_primary_key": False},
        {"column_name": "STATUS", "data_type": "VARCHAR2(20)", "nullable": "N", "is_primary_key": False},
        {"column_name": "REMARKS", "data_type": "VARCHAR2(100)", "nullable": "Y", "is_primary_key": False},
    ],
    "DRIVER": [
        {"column_name": "DRIVER_ID", "data_type": "NUMBER", "nullable": "N", "is_primary_key": True},
        {"column_name": "DRIVER_NAME", "data_type": "VARCHAR2(120)", "nullable": "N", "is_primary_key": False},
        {"column_name": "DOB", "data_type": "VARCHAR2(10)", "nullable": "N", "is_primary_key": False},
        {"column_name": "AGE", "data_type": "NUMBER(3)", "nullable": "Y", "is_primary_key": False},
        {"column_name": "PHONE", "data_type": "VARCHAR2(20)", "nullable": "N", "is_primary_key": False},
        {"column_name": "LICENSE_NO", "data_type": "VARCHAR2(50)", "nullable": "N", "is_primary_key": False},
        {"column_name": "EXPERIENCE_YEARS", "data_type": "NUMBER(2)", "nullable": "Y", "is_primary_key": False},
        {"column_name": "STATUS", "data_type": "VARCHAR2(20)", "nullable": "N", "is_primary_key": False},
        {"column_name": "SALARY_MONTHLY", "data_type": "NUMBER(10,2)", "nullable": "N", "is_primary_key": False},
    ]
}

INITIAL_AMBULANCES = [
    {"id": 101, "vehicle_type": "BASIC", "model": "Force Traveller 3350", "status": "AVAILABLE", "remarks": "Primary city emergency unit"},
    {"id": 102, "vehicle_type": "ADVANCED", "model": "Tata Winger Ambulance", "status": "ON DUTY", "remarks": "Trauma response dispatch"},
    {"id": 103, "vehicle_type": "ICU", "model": "Mercedes-Benz Sprinter ICU", "status": "AVAILABLE", "remarks": "Full ICU ventilator support"},
    {"id": 104, "vehicle_type": "BASIC", "model": "Mahindra Bolero Maxi Truck", "status": "MAINTENANCE", "remarks": "Scheduled brake maintenance"},
]

INITIAL_DRIVERS = [
    {"driver_id": 201, "driver_name": "Rajesh Kumar", "dob": "15-08-1988", "age": 38, "phone": "9876543210", "license_no": "DL-0420110012345", "experience_years": 5, "status": "AVAILABLE", "salary_monthly": 25000.0, "salary_annual": 300000.0},
    {"driver_id": 202, "driver_name": "Suresh Sharma", "dob": "22-04-1985", "age": 41, "phone": "9812345678", "license_no": "DL-0720150067890", "experience_years": 7, "status": "ON DUTY", "salary_monthly": 28000.0, "salary_annual": 336000.0},
    {"driver_id": 203, "driver_name": "Amit Singh", "dob": "10-12-1994", "age": 31, "phone": "9701234567", "license_no": "DL-0920180054321", "experience_years": 3, "status": "OFF DUTY", "salary_monthly": 22000.0, "salary_annual": 264000.0},
    {"driver_id": 204, "driver_name": "Vikram Verma", "dob": "05-06-1982", "age": 44, "phone": "9654321098", "license_no": "DL-1120200098765", "experience_years": 9, "status": "AVAILABLE", "salary_monthly": 30000.0, "salary_annual": 360000.0},
]

in_memory_schema = copy.deepcopy(DEFAULT_SCHEMA)
in_memory_ambulances = copy.deepcopy(INITIAL_AMBULANCES)
in_memory_drivers = copy.deepcopy(INITIAL_DRIVERS)


def get_oracle_columns(cursor, table_name):
    """Fetch live columns and primary keys directly from Oracle data dictionary."""
    cursor.execute("""
        SELECT COLUMN_NAME, DATA_TYPE, DATA_LENGTH, NULLABLE
        FROM USER_TAB_COLUMNS
        WHERE TABLE_NAME = :1
        ORDER BY COLUMN_ID
    """, (table_name,))
    rows = cursor.fetchall()

    try:
        cursor.execute("""
            SELECT cc.COLUMN_NAME
            FROM USER_CONSTRAINTS c
            JOIN USER_CONS_COLUMNS cc ON c.CONSTRAINT_NAME = cc.CONSTRAINT_NAME
            WHERE c.TABLE_NAME = :1 AND c.CONSTRAINT_TYPE = 'P'
        """, (table_name,))
        pk_cols = {r[0] for r in cursor.fetchall()}
    except Exception:
        pk_cols = {"ID"} if table_name == "AMBULANCE" else {"DRIVER_ID"}

    cols = []
    for r in rows:
        col_name, dtype, dlen, nullable = r[0], r[1], r[2], r[3]
        type_str = f"{dtype}({dlen})" if "CHAR" in dtype else dtype
        cols.append({
            "column_name": col_name,
            "data_type": type_str,
            "nullable": nullable,
            "is_primary_key": col_name in pk_cols
        })
    return cols


def serialize_row(columns, row):
    """Serialize database row values into JSON-friendly dictionary."""
    d = {}
    for col, val in zip(columns, row):
        col_key = col.lower()
        if isinstance(val, (datetime, date)):
            d[col_key] = val.strftime("%d-%m-%Y")
        elif hasattr(val, '__float__') and not isinstance(val, (int, bool)):
            d[col_key] = float(val)
        else:
            d[col_key] = val
    return d


def simulate_ddl_on_memory(raw_sql, target_table):
    """Simulate ALTER TABLE commands on in-memory schema and records when offline."""
    upper = raw_sql.upper().strip().rstrip(";")
    if re.search(r"\bDROP\s+TABLE\b", upper) or upper.startswith("DROP "):
        return False, "Command Prohibited: DROP TABLE commands are strictly banned to protect database integrity."
    schema_cols = in_memory_schema.get(target_table, [])
    records = in_memory_ambulances if target_table == "AMBULANCE" else in_memory_drivers

    # ALTER TABLE <table_name> ADD (COL_NAME TYPE ...) or ADD COL_NAME TYPE
    add_match = re.search(r"ALTER\s+TABLE\s+" + target_table + r"\s+ADD\s*\(?\s*([A-Za-z0-9_]+)\s+([A-Za-z0-9_()]+)", upper)
    if add_match:
        col_name = add_match.group(1).upper()
        col_type = add_match.group(2).upper()
        if any(c["column_name"] == col_name for c in schema_cols):
            return False, f"Column '{col_name}' already exists in {target_table}."
        is_nullable = "N" if "NOT NULL" in upper else "Y"
        schema_cols.append({
            "column_name": col_name,
            "data_type": col_type,
            "nullable": is_nullable,
            "is_primary_key": False
        })
        for r in records:
            r[col_name.lower()] = None
        return True, f"Table {target_table} altered. Added column '{col_name}' ({col_type})."

    # ALTER TABLE <table_name> DROP COLUMN COL_NAME or DROP (COL_NAME)
    drop_match = re.search(r"ALTER\s+TABLE\s+" + target_table + r"\s+DROP\s+(?:COLUMN\s+)?\(?\s*([A-Za-z0-9_]+)\s*\)?", upper)
    if drop_match:
        col_name = drop_match.group(1).upper()
        if col_name in ("ID", "DRIVER_ID"):
            return False, f"Cannot drop primary key column {col_name}."
        idx = next((i for i, c in enumerate(schema_cols) if c["column_name"] == col_name), -1)
        if idx == -1:
            return False, f"Column '{col_name}' does not exist in {target_table}."
        schema_cols.pop(idx)
        for r in records:
            r.pop(col_name.lower(), None)
        return True, f"Table {target_table} altered. Dropped column '{col_name}'."

    # ALTER TABLE <table_name> RENAME COLUMN OLD_COL TO NEW_COL
    rename_match = re.search(r"ALTER\s+TABLE\s+" + target_table + r"\s+RENAME\s+COLUMN\s+([A-Za-z0-9_]+)\s+TO\s+([A-Za-z0-9_]+)", upper)
    if rename_match:
        old_col = rename_match.group(1).upper()
        new_col = rename_match.group(2).upper()
        found = False
        for c in schema_cols:
            if c["column_name"] == old_col:
                c["column_name"] = new_col
                found = True
                break
        if not found:
            return False, f"Column '{old_col}' does not exist in {target_table}."
        for r in records:
            if old_col.lower() in r:
                r[new_col.lower()] = r.pop(old_col.lower())
        return True, f"Table {target_table} altered. Renamed column '{old_col}' to '{new_col}'."

    # ALTER TABLE <table_name> MODIFY (COL_NAME TYPE)
    mod_match = re.search(r"ALTER\s+TABLE\s+" + target_table + r"\s+MODIFY\s*\(?\s*([A-Za-z0-9_]+)\s+([A-Za-z0-9_()]+)", upper)
    if mod_match:
        col_name = mod_match.group(1).upper()
        new_type = mod_match.group(2).upper()
        for c in schema_cols:
            if c["column_name"] == col_name:
                c["data_type"] = new_type
                return True, f"Table {target_table} modified. Column '{col_name}' data type updated to {new_type}."
        return False, f"Column '{col_name}' does not exist."

    return True, f"Command executed successfully on {target_table}."


@app.route("/api/db-status", methods=["GET"])
@login_required
def get_db_status():
    success, message = test_connection()
    return jsonify({
        "connected": success,
        "message": message,
        "mode": "Oracle Live" if success else "Disconnected"
    })


@app.route("/api/reset-sample-data", methods=["POST"])
@login_required
def reset_sample_data():
    global in_memory_schema, in_memory_ambulances, in_memory_drivers
    in_memory_schema = copy.deepcopy(DEFAULT_SCHEMA)
    in_memory_ambulances = copy.deepcopy(INITIAL_AMBULANCES)
    in_memory_drivers = copy.deepcopy(INITIAL_DRIVERS)
    return jsonify({"message": "Sample schema and data re-initialized."}), 200


# ============================================================
# DYNAMIC AMBULANCE API ROUTES
# ============================================================

@app.route("/api/ambulances", methods=["GET"])
@login_required
def get_ambulances():
    conn = None
    cursor = None
    try:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM AMBULANCE ORDER BY 1")
        rows = cursor.fetchall()
        columns = [col[0].lower() for col in cursor.description]
        result = [serialize_row(columns, row) for row in rows]
        return jsonify(result)
    except Exception as e:
        logger.warning("Could not fetch ambulances from Oracle (%s). Returning in-memory list.", e)
        return jsonify(copy.deepcopy(in_memory_ambulances))
    finally:
        if cursor:
            try: cursor.close()
            except Exception: pass
        if conn:
            try: conn.close()
            except Exception: pass


@app.route("/api/ambulances", methods=["POST"])
@login_required
def add_ambulance():
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return jsonify({"message": "Invalid or missing JSON data."}), 400

    try:
        amb_id = int(data.get("id"))
        if amb_id <= 0:
            return jsonify({"message": "Ambulance ID must be a positive integer."}), 400
    except (TypeError, ValueError):
        return jsonify({"message": "Ambulance ID must be a valid integer."}), 400

    vehicle_type = str(data.get("vehicle_type", "")).strip().upper()
    if vehicle_type and vehicle_type not in ALLOWED_VEHICLE_TYPES:
        return jsonify({
            "message": f"Invalid vehicle type. Allowed options: {', '.join(sorted(ALLOWED_VEHICLE_TYPES))}."
        }), 400

    status = str(data.get("status", "")).strip().upper()
    if status and status not in ALLOWED_AMBULANCE_STATUSES:
        return jsonify({
            "message": f"Invalid status. Allowed options: {', '.join(sorted(ALLOWED_AMBULANCE_STATUSES))}."
        }), 400

    conn = None
    cursor = None
    try:
        conn = get_connection()
        cursor = conn.cursor()

        db_cols = get_oracle_columns(cursor, "AMBULANCE")
        insert_cols = []
        insert_vals = []

        for col in db_cols:
            col_name = col["column_name"]
            key = col_name.lower()
            nullable = col["nullable"]
            dtype = col["data_type"].upper()

            if key in data and data[key] is not None and str(data[key]).strip() != "":
                val = data[key]
                if "NUMBER" in dtype:
                    try:
                        val = float(val) if ("." in str(val)) else int(val)
                    except ValueError:
                        return jsonify({"message": f"{col_name} must be a valid number."}), 400
                elif "CHAR" in dtype:
                    val = str(val).strip()
                insert_cols.append(col_name)
                insert_vals.append(val)
            elif nullable == "N":
                if key == "id":
                    insert_cols.append("ID")
                    insert_vals.append(amb_id)
                else:
                    return jsonify({"message": f"Field '{col_name}' is required."}), 400

        col_names_sql = ", ".join(insert_cols)
        bind_sql = ", ".join([f":{i+1}" for i in range(len(insert_cols))])
        sql = f"INSERT INTO AMBULANCE ({col_names_sql}) VALUES ({bind_sql})"

        cursor.execute(sql, tuple(insert_vals))
        conn.commit()
        return jsonify({"message": "Ambulance added successfully."}), 201

    except Exception as e:
        err_msg = str(e).lower()
        is_conn_error = any(code in err_msg for code in ["ora-12541", "ora-12154", "dpy-6005", "cannot connect", "timed out"])
        if is_conn_error:
            if any(a["id"] == amb_id for a in in_memory_ambulances):
                return jsonify({"message": "Ambulance with this ID already exists."}), 409
            new_item = {"id": amb_id}
            for col in in_memory_schema.get("AMBULANCE", []):
                k = col["column_name"].lower()
                if k != "id":
                    new_item[k] = data.get(k)
            in_memory_ambulances.append(new_item)
            return jsonify({"message": "Ambulance added successfully."}), 201

        if conn:
            try: conn.rollback()
            except Exception: pass
        return handle_db_error(e)
    finally:
        if cursor:
            try: cursor.close()
            except Exception: pass
        if conn:
            try: conn.close()
            except Exception: pass


@app.route("/api/ambulances/<int:ambulance_id>", methods=["PUT"])
@login_required
def update_ambulance(ambulance_id):
    if ambulance_id <= 0:
        return jsonify({"message": "Invalid ambulance ID."}), 400

    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return jsonify({"message": "Invalid or missing JSON data."}), 400

    vehicle_type = str(data.get("vehicle_type", "")).strip().upper()
    if vehicle_type and vehicle_type not in ALLOWED_VEHICLE_TYPES:
        return jsonify({
            "message": f"Invalid vehicle type. Allowed options: {', '.join(sorted(ALLOWED_VEHICLE_TYPES))}."
        }), 400

    status = str(data.get("status", "")).strip().upper()
    if status and status not in ALLOWED_AMBULANCE_STATUSES:
        return jsonify({
            "message": f"Invalid status. Allowed options: {', '.join(sorted(ALLOWED_AMBULANCE_STATUSES))}."
        }), 400

    conn = None
    cursor = None
    try:
        conn = get_connection()
        cursor = conn.cursor()

        db_cols = get_oracle_columns(cursor, "AMBULANCE")
        update_cols = []
        update_vals = []

        for col in db_cols:
            col_name = col["column_name"]
            if col["is_primary_key"] or col_name == "ID":
                continue
            key = col_name.lower()
            dtype = col["data_type"].upper()

            if key in data:
                val = data[key]
                if val is None or str(val).strip() == "":
                    val = None
                elif "NUMBER" in dtype:
                    try:
                        val = float(val) if ("." in str(val)) else int(val)
                    except ValueError:
                        return jsonify({"message": f"{col_name} must be a number."}), 400
                elif "CHAR" in dtype:
                    val = str(val).strip()
                update_cols.append(col_name)
                update_vals.append(val)

        if not update_cols:
            return jsonify({"message": "No fields to update."}), 400

        set_sql = ", ".join([f"{c} = :{i+1}" for i, c in enumerate(update_cols)])
        sql = f"UPDATE AMBULANCE SET {set_sql} WHERE ID = :{len(update_cols)+1}"

        cursor.execute(sql, tuple(update_vals + [ambulance_id]))
        if cursor.rowcount == 0:
            conn.rollback()
            return jsonify({"message": "Ambulance not found."}), 404

        conn.commit()
        return jsonify({"message": "Ambulance modified successfully."}), 200

    except Exception as e:
        err_msg = str(e).lower()
        is_conn_error = any(code in err_msg for code in ["ora-12541", "ora-12154", "dpy-6005", "cannot connect", "timed out"])
        if is_conn_error:
            target = next((a for a in in_memory_ambulances if a["id"] == ambulance_id), None)
            if not target:
                return jsonify({"message": "Ambulance not found."}), 404
            for col in in_memory_schema.get("AMBULANCE", []):
                k = col["column_name"].lower()
                if k != "id" and k in data:
                    target[k] = data[k]
            return jsonify({"message": "Ambulance modified successfully."}), 200

        if conn:
            try: conn.rollback()
            except Exception: pass
        return handle_db_error(e)
    finally:
        if cursor:
            try: cursor.close()
            except Exception: pass
        if conn:
            try: conn.close()
            except Exception: pass


@app.route("/api/ambulances/<int:ambulance_id>", methods=["DELETE"])
@login_required
def delete_ambulance(ambulance_id):
    if ambulance_id <= 0:
        return jsonify({"message": "Invalid ambulance ID."}), 400

    conn = None
    cursor = None
    try:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("DELETE FROM AMBULANCE WHERE ID = :1", (ambulance_id,))
        if cursor.rowcount == 0:
            conn.rollback()
            return jsonify({"message": "Ambulance not found."}), 404
        conn.commit()
        return jsonify({"message": "Ambulance deleted successfully."}), 200
    except Exception as e:
        err_msg = str(e).lower()
        is_conn_error = any(code in err_msg for code in ["ora-12541", "ora-12154", "dpy-6005", "cannot connect", "timed out"])
        if is_conn_error:
            global in_memory_ambulances
            initial_len = len(in_memory_ambulances)
            in_memory_ambulances = [a for a in in_memory_ambulances if a["id"] != ambulance_id]
            if len(in_memory_ambulances) == initial_len:
                return jsonify({"message": "Ambulance not found."}), 404
            return jsonify({"message": "Ambulance deleted successfully."}), 200

        if conn:
            try: conn.rollback()
            except Exception: pass
        return handle_db_error(e)
    finally:
        if cursor:
            try: cursor.close()
            except Exception: pass
        if conn:
            try: conn.close()
            except Exception: pass


# ============================================================
# DYNAMIC DRIVER API ROUTES
# ============================================================

@app.route("/api/drivers", methods=["GET"])
@login_required
def get_drivers():
    conn = None
    cursor = None
    try:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM DRIVER ORDER BY 1")
        rows = cursor.fetchall()
        columns = [col[0].lower() for col in cursor.description]

        result = []
        for row in rows:
            driver = serialize_row(columns, row)
            monthly_val = driver.get("salary_monthly")
            if monthly_val is not None:
                driver["salary_monthly"] = float(monthly_val)
                driver["salary_annual"] = round(float(monthly_val) * 12, 2)
            else:
                driver["salary_monthly"] = 0.0
                driver["salary_annual"] = 0.0

            if driver.get("dob") and (driver.get("age") is None or driver.get("age") == 0):
                driver["age"] = calculate_age_from_dob(driver.get("dob"))
            result.append(driver)
        return jsonify(result)
    except Exception as e:
        logger.warning("Could not fetch drivers from Oracle (%s). Returning in-memory list.", e)
        return jsonify(copy.deepcopy(in_memory_drivers))
    finally:
        if cursor:
            try: cursor.close()
            except Exception: pass
        if conn:
            try: conn.close()
            except Exception: pass


@app.route("/api/drivers", methods=["POST"])
@login_required
def add_driver():
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return jsonify({"message": "Invalid or missing JSON data."}), 400

    try:
        driver_id = int(data.get("driver_id"))
        if driver_id <= 0:
            return jsonify({"message": "Driver ID must be a positive integer."}), 400
    except (TypeError, ValueError):
        return jsonify({"message": "Driver ID must be a valid integer."}), 400

    status = str(data.get("status", "")).strip().upper()
    if status and status not in ALLOWED_DRIVER_STATUSES:
        return jsonify({
            "message": f"Invalid status. Allowed options: {', '.join(sorted(ALLOWED_DRIVER_STATUSES))}."
        }), 400

    dob = str(data.get("dob", "")).strip()
    age = None
    if dob:
        age = calculate_age_from_dob(dob)
        if age is None:
            return jsonify({"message": "Invalid DOB format. Please enter date of birth as DD-MM-YYYY (e.g. 15-08-1990)."}), 400
        if age < 18 or age > 100:
            return jsonify({"message": f"Derived age ({age} years) is invalid. Driver must be between 18 and 100 years old."}), 400
        data["age"] = age

    conn = None
    cursor = None
    try:
        conn = get_connection()
        cursor = conn.cursor()

        db_cols = get_oracle_columns(cursor, "DRIVER")
        insert_cols = []
        insert_vals = []

        for col in db_cols:
            col_name = col["column_name"]
            key = col_name.lower()
            nullable = col["nullable"]
            dtype = col["data_type"].upper()

            if key in data and data[key] is not None and str(data[key]).strip() != "":
                val = data[key]
                if "NUMBER" in dtype:
                    try:
                        val = float(val) if ("." in str(val)) else int(val)
                    except ValueError:
                        return jsonify({"message": f"{col_name} must be a valid number."}), 400
                elif "CHAR" in dtype:
                    val = str(val).strip()
                insert_cols.append(col_name)
                insert_vals.append(val)
            elif nullable == "N":
                if key == "driver_id":
                    insert_cols.append("DRIVER_ID")
                    insert_vals.append(driver_id)
                else:
                    return jsonify({"message": f"Field '{col_name}' is required."}), 400

        col_names_sql = ", ".join(insert_cols)
        bind_sql = ", ".join([f":{i+1}" for i in range(len(insert_cols))])
        sql = f"INSERT INTO DRIVER ({col_names_sql}) VALUES ({bind_sql})"

        cursor.execute(sql, tuple(insert_vals))
        conn.commit()
        return jsonify({"message": "Driver added successfully."}), 201

    except Exception as e:
        err_msg = str(e).lower()
        is_conn_error = any(code in err_msg for code in ["ora-12541", "ora-12154", "dpy-6005", "cannot connect", "timed out"])
        if is_conn_error:
            if any(d["driver_id"] == driver_id for d in in_memory_drivers):
                return jsonify({"message": "Driver with this ID already exists."}), 409
            new_item = {"driver_id": driver_id}
            for col in in_memory_schema.get("DRIVER", []):
                k = col["column_name"].lower()
                if k != "driver_id":
                    new_item[k] = data.get(k)
            new_item["salary_monthly"] = float(new_item.get("salary_monthly") or 0)
            new_item["salary_annual"] = round(new_item["salary_monthly"] * 12, 2)
            if dob and not new_item.get("age"):
                new_item["age"] = age
            in_memory_drivers.append(new_item)
            return jsonify({"message": "Driver added successfully."}), 201

        if conn:
            try: conn.rollback()
            except Exception: pass
        return handle_db_error(e)
    finally:
        if cursor:
            try: cursor.close()
            except Exception: pass
        if conn:
            try: conn.close()
            except Exception: pass


@app.route("/api/drivers/<int:driver_id>", methods=["PUT"])
@login_required
def update_driver(driver_id):
    if driver_id <= 0:
        return jsonify({"message": "Invalid driver ID."}), 400

    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return jsonify({"message": "Invalid or missing JSON data."}), 400

    status = str(data.get("status", "")).strip().upper()
    if status and status not in ALLOWED_DRIVER_STATUSES:
        return jsonify({
            "message": f"Invalid status. Allowed options: {', '.join(sorted(ALLOWED_DRIVER_STATUSES))}."
        }), 400

    dob = str(data.get("dob", "")).strip()
    if dob:
        age = calculate_age_from_dob(dob)
        if age is None:
            return jsonify({"message": "Invalid DOB format. Please enter date of birth as DD-MM-YYYY."}), 400
        if age < 18 or age > 100:
            return jsonify({"message": f"Derived age ({age} years) is invalid. Driver must be between 18 and 100 years old."}), 400
        data["age"] = age

    conn = None
    cursor = None
    try:
        conn = get_connection()
        cursor = conn.cursor()

        db_cols = get_oracle_columns(cursor, "DRIVER")
        update_cols = []
        update_vals = []

        for col in db_cols:
            col_name = col["column_name"]
            if col["is_primary_key"] or col_name == "DRIVER_ID":
                continue
            key = col_name.lower()
            dtype = col["data_type"].upper()

            if key in data:
                val = data[key]
                if val is None or str(val).strip() == "":
                    val = None
                elif "NUMBER" in dtype:
                    try:
                        val = float(val) if ("." in str(val)) else int(val)
                    except ValueError:
                        return jsonify({"message": f"{col_name} must be a number."}), 400
                elif "CHAR" in dtype:
                    val = str(val).strip()
                update_cols.append(col_name)
                update_vals.append(val)

        if not update_cols:
            return jsonify({"message": "No fields to update."}), 400

        set_sql = ", ".join([f"{c} = :{i+1}" for i, c in enumerate(update_cols)])
        sql = f"UPDATE DRIVER SET {set_sql} WHERE DRIVER_ID = :{len(update_cols)+1}"

        cursor.execute(sql, tuple(update_vals + [driver_id]))
        if cursor.rowcount == 0:
            conn.rollback()
            return jsonify({"message": "Driver not found."}), 404

        conn.commit()
        return jsonify({"message": "Driver modified successfully."}), 200

    except Exception as e:
        err_msg = str(e).lower()
        is_conn_error = any(code in err_msg for code in ["ora-12541", "ora-12154", "dpy-6005", "cannot connect", "timed out"])
        if is_conn_error:
            target = next((d for d in in_memory_drivers if d["driver_id"] == driver_id), None)
            if not target:
                return jsonify({"message": "Driver not found."}), 404
            for col in in_memory_schema.get("DRIVER", []):
                k = col["column_name"].lower()
                if k != "driver_id" and k in data:
                    target[k] = data[k]
            if "salary_monthly" in target:
                target["salary_monthly"] = float(target.get("salary_monthly") or 0)
                target["salary_annual"] = round(target["salary_monthly"] * 12, 2)
            if dob:
                target["age"] = calculate_age_from_dob(dob)
            return jsonify({"message": "Driver modified successfully."}), 200

        if conn:
            try: conn.rollback()
            except Exception: pass
        return handle_db_error(e)
    finally:
        if cursor:
            try: cursor.close()
            except Exception: pass
        if conn:
            try: conn.close()
            except Exception: pass


@app.route("/api/drivers/<int:driver_id>", methods=["DELETE"])
@login_required
def delete_driver(driver_id):
    if driver_id <= 0:
        return jsonify({"message": "Invalid driver ID."}), 400

    conn = None
    cursor = None
    try:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("DELETE FROM DRIVER WHERE DRIVER_ID = :1", (driver_id,))
        if cursor.rowcount == 0:
            conn.rollback()
            return jsonify({"message": "Driver not found."}), 404
        conn.commit()
        return jsonify({"message": "Driver deleted successfully."}), 200
    except Exception as e:
        err_msg = str(e).lower()
        is_conn_error = any(code in err_msg for code in ["ora-12541", "ora-12154", "dpy-6005", "cannot connect", "timed out"])
        if is_conn_error:
            global in_memory_drivers
            initial_len = len(in_memory_drivers)
            in_memory_drivers = [d for d in in_memory_drivers if d["driver_id"] != driver_id]
            if len(in_memory_drivers) == initial_len:
                return jsonify({"message": "Driver not found."}), 404
            return jsonify({"message": "Driver deleted successfully."}), 200

        if conn:
            try: conn.rollback()
            except Exception: pass
        return handle_db_error(e)
    finally:
        if cursor:
            try: cursor.close()
            except Exception: pass
        if conn:
            try: conn.close()
            except Exception: pass


# ============================================================
# DYNAMIC DDL OPERATIONS & SCHEMA MANAGEMENT
# ============================================================

@app.route("/api/ddl/schema", methods=["GET"])
@login_required
def get_ddl_schema():
    conn = None
    cursor = None
    try:
        conn = get_connection()
        cursor = conn.cursor()
        amb_cols = get_oracle_columns(cursor, "AMBULANCE")
        drv_cols = get_oracle_columns(cursor, "DRIVER")
        return jsonify({
            "source": "Oracle Live",
            "schema": {
                "AMBULANCE": amb_cols,
                "DRIVER": drv_cols
            }
        })
    except Exception as e:
        logger.warning("Could not fetch schema from Oracle (%s). Returning in-memory schema.", e)
        return jsonify({
            "source": "Simulated (Offline)",
            "schema": in_memory_schema
        })
    finally:
        if cursor:
            try: cursor.close()
            except Exception: pass
        if conn:
            try: conn.close()
            except Exception: pass


@app.route("/api/ddl/execute", methods=["POST"])
@login_required
def execute_ddl():
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return jsonify({"message": "Invalid JSON body."}), 400

    raw_sql = str(data.get("sql", "")).strip().rstrip(";")
    if not raw_sql:
        return jsonify({"message": "SQL statement is required."}), 400

    # Strip comments to prevent bypasses
    clean_sql = re.sub(r"--.*$", "", raw_sql, flags=re.MULTILINE)
    clean_sql = re.sub(r"/\*.*?\*/", "", clean_sql, flags=re.DOTALL)
    upper_sql = clean_sql.upper().strip()

    # Strictly ban all table drop commands and any direct DROP statements
    norm_sql = re.sub(r"\s+", " ", upper_sql)
    if (
        re.search(r"\bDROP\s+(?:ONLINE\s+|GLOBAL\s+TEMPORARY\s+|TEMPORARY\s+)?TABLE\b", norm_sql)
        or re.search(r"\bDROP\s+TABLE\b", norm_sql)
        or "DROP TABLE" in norm_sql
        or norm_sql.startswith("DROP ")
        or re.search(r"^\s*DROP\b", norm_sql)
    ):
        return jsonify({
            "success": False,
            "message": "Command Prohibited: DROP TABLE commands are strictly banned to protect database integrity and prevent data loss."
        }), 403

    allowed_starts = ("ALTER ", "CREATE ", "RENAME ", "COMMENT ", "TRUNCATE ")
    if not any(upper_sql.startswith(cmd) for cmd in allowed_starts):
        return jsonify({
            "success": False,
            "message": "Invalid command: Only Oracle DDL statements (ALTER TABLE, CREATE, RENAME, COMMENT, TRUNCATE) are permitted."
        }), 400

    target_table = None
    if upper_sql.startswith("ALTER TABLE"):
        parts = upper_sql.split()
        if len(parts) >= 3:
            candidate = parts[2].replace('"', '').replace("'", "")
            if candidate in ("AMBULANCE", "DRIVER"):
                target_table = candidate
        if not target_table:
            return jsonify({
                "success": False,
                "message": "Invalid command: Target table must be AMBULANCE or DRIVER."
            }), 400

    conn = None
    cursor = None
    try:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute(raw_sql)
        return jsonify({
            "success": True,
            "message": f"Command executed successfully on Oracle Database: '{raw_sql}'. Database updated.",
            "sql": raw_sql,
            "mode": "Oracle Live"
        }), 200
    except Exception as e:
        err_msg = str(e).lower()
        is_conn_error = any(code in err_msg for code in ["ora-12541", "ora-12154", "dpy-6005", "cannot connect", "timed out"])

        if is_conn_error and target_table:
            sim_success, sim_msg = simulate_ddl_on_memory(raw_sql, target_table)
            if sim_success:
                return jsonify({
                    "success": True,
                    "message": f"{sim_msg} (Offline Simulation Mode)",
                    "sql": raw_sql,
                    "mode": "Simulated (Offline)"
                }), 200
            else:
                return jsonify({
                    "success": False,
                    "message": f"DDL execution failed: {sim_msg}"
                }), 400

        return jsonify({
            "success": False,
            "message": f"Database command failed: {str(e)}"
        }), 400
    finally:
        if cursor:
            try: cursor.close()
            except Exception: pass
        if conn:
            try: conn.close()
            except Exception: pass


if __name__ == "__main__":
    port = int(os.getenv("PORT", "5000"))
    debug_mode = os.getenv("FLASK_DEBUG", "false").lower() in ("true", "1")
    app.run(host="127.0.0.1", port=port, debug=debug_mode)