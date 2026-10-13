"""

!!!!!!!   CHANGE LINE 72(LIB PATH) AND REPLACE THE COMMENTED SECTION (LINE 52) ACCORDING TO YOUR SYSTEM CONFIGURATION


=============================================================================
Ambulance Management System - Oracle Database Module & PAT 4 DDL/DML Reference
=============================================================================

This module manages Oracle Database connectivity using python-oracledb.
It reads configuration from environment variables supplied by the terminal/OS.

Configuration Environment Variables:
  DB_USER               : Oracle database username (default: 25BCE1084)
  DB_PASSWORD           : Oracle database password (default: sandwa)
  DB_HOST               : Database host/IP (default: 172.16.8.54)
  DB_PORT               : Listener port (default: 1521)
  DB_SERVICE            : Service name (default: orcl)
  DB_SID                : Optional SID (e.g. xe)
  ORACLE_CLIENT_LIB_DIR : Optional path to Oracle Instant Client (Thick mode)
  ORACLE_THICK_MODE     : Set to 'true' to force Thick mode
  DB_CONNECT_TIMEOUT    : Connection timeout in seconds (default: 1.5)

Terminal Setup Instructions:
  Windows PowerShell:
    $env:DB_USER="25BCE1084"
    $env:DB_PASSWORD="sandwa"
    $env:DB_HOST="172.16.8.54"
    $env:DB_PORT="1521"
    $env:DB_SERVICE="orcl"

  Linux / macOS / Bash:
    export DB_USER="25BCE1084"
    export DB_PASSWORD="sandwa"
    export DB_HOST="172.16.8.54"
    export DB_PORT="1521"
    export DB_SERVICE="orcl"
"""

import os
import sys
import logging
import oracledb

try:
    from dotenv import load_dotenv
    load_dotenv()
except Exception:
    pass

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Oracle connection configuration from environment variables
# DB_USER = os.getenv("DB_USER", os.getenv("DB_USERNAME", "25BCE1084")).strip()
# DB_PASSWORD = os.getenv("DB_PASSWORD", "sandwa").strip()
# DB_HOST = os.getenv("DB_HOST", "172.16.8.54").strip()
# DB_PORT = int(os.getenv("DB_PORT", "1521").strip())
# DB_SERVICE = os.getenv("DB_SERVICE", "orcl").strip()
# DB_SID = os.getenv("DB_SID", "").strip()

DB_USER = os.getenv("DB_USER", os.getenv("DB_USERNAME", "utk")).strip()
DB_PASSWORD = os.getenv("DB_PASSWORD", "tiger").strip()
DB_HOST = os.getenv("DB_HOST", "localhost").strip()
DB_PORT = int(os.getenv("DB_PORT", "1521").strip())
DB_SERVICE = os.getenv("DB_SERVICE", "xe").strip()
DB_SID = os.getenv("DB_SID", "").strip()

# Oracle client mode configuration
# Default: Thin mode (pure Python, does not require Oracle Instant Client binaries).
# Set ORACLE_CLIENT_LIB_DIR or ORACLE_THICK_MODE=true to enable Thick mode.
ORACLE_CLIENT_LIB_DIR = os.getenv("ORACLE_CLIENT_LIB_DIR", r"C:\Users\rakes\Downloads\instantclient-basic-windows.x64-23.26.3.0.0\instantclient_23_26")
ORACLE_THICK_MODE = os.getenv("ORACLE_THICK_MODE", "false").strip().lower() in ("true", "1", "yes")

_thick_mode_attempted = False


def init_oracle_client_mode():
    """Initialize Thick mode if explicitly configured via environment variables."""
    global _thick_mode_attempted
    if _thick_mode_attempted:
        return

    _thick_mode_attempted = True

    if ORACLE_THICK_MODE or ORACLE_CLIENT_LIB_DIR:
        try:
            if ORACLE_CLIENT_LIB_DIR and os.path.isdir(ORACLE_CLIENT_LIB_DIR):
                oracledb.init_oracle_client(lib_dir=ORACLE_CLIENT_LIB_DIR)
                logger.info("Initialized Oracle client in Thick mode with lib_dir: %s", ORACLE_CLIENT_LIB_DIR)
            else:
                oracledb.init_oracle_client()
                logger.info("Initialized Oracle client in Thick mode with system library path.")
        except Exception as e:
            logger.warning(
                "Could not initialize Oracle Thick mode (%s). Falling back to Thin mode.",
                e
            )


def get_connection():
    """Establish and return an active Oracle database connection."""
    init_oracle_client_mode()

    if not DB_USER or not DB_PASSWORD:
        raise ValueError(
            "Oracle credentials not configured. Please set DB_USER and DB_PASSWORD environment variables."
        )

    # Build DSN based on SID or SERVICE_NAME
    if DB_SID:
        dsn = oracledb.makedsn(DB_HOST, DB_PORT, sid=DB_SID)
    else:
        dsn = f"{DB_HOST}:{DB_PORT}/{DB_SERVICE}"

    timeout = float(os.getenv("DB_CONNECT_TIMEOUT", "1.5"))

    connect_kwargs = {
        "user": DB_USER,
        "password": DB_PASSWORD,
        "dsn": dsn
    }
    if oracledb.is_thin_mode():
        connect_kwargs["tcp_connect_timeout"] = timeout

    return oracledb.connect(**connect_kwargs)


def test_connection():
    """Test the database connection and return a tuple of (bool, str)."""
    try:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT 1 FROM DUAL")
        cursor.fetchone()
        cursor.close()
        conn.close()
        mode_str = "Thin" if oracledb.is_thin_mode() else "Thick"
        return True, f"Connection successful! Connected in {mode_str} mode to {DB_HOST}:{DB_PORT}."
    except Exception as e:
        return False, f"Connection failed: {e}"


# =============================================================================
# PAT 4 ORACLE DDL STATEMENTS (SCHEMA DEFINITION)
# =============================================================================
SCHEMA_DDL = """
-- ------------------------------------------------------------
-- 1. Table: AMBULANCE
-- ------------------------------------------------------------
CREATE TABLE AMBULANCE (
    ID NUMBER PRIMARY KEY,
    VEHICLE_TYPE VARCHAR2(20) NOT NULL,
    MODEL VARCHAR2(50) NOT NULL,
    STATUS VARCHAR2(20) NOT NULL,
    REMARKS VARCHAR2(20),
    CONSTRAINT CHK_AMB_ID CHECK (ID > 0),
    CONSTRAINT CHK_AMB_VEHICLE_TYPE CHECK (VEHICLE_TYPE IN ('BASIC', 'ADVANCED', 'ICU')),
    CONSTRAINT CHK_AMB_STATUS CHECK (STATUS IN ('AVAILABLE', 'ON DUTY', 'MAINTENANCE'))
);

-- ------------------------------------------------------------
-- 2. Table: DRIVER
-- ------------------------------------------------------------
CREATE TABLE DRIVER (
    DRIVER_ID NUMBER PRIMARY KEY,
    DRIVER_NAME VARCHAR2(100) NOT NULL,
    PHONE VARCHAR2(20) NOT NULL,
    LICENSE_NO VARCHAR2(50) NOT NULL,
    STATUS VARCHAR2(20) NOT NULL,
    SALARY_MONTHLY NUMBER(10, 2) NOT NULL,
    DOB VARCHAR2(10),
    AGE NUMBER(3),
    CONSTRAINT CHK_DRV_ID CHECK (DRIVER_ID > 0),
    CONSTRAINT UQ_DRV_PHONE UNIQUE (PHONE),
    CONSTRAINT UQ_DRV_LICENSE UNIQUE (LICENSE_NO),
    CONSTRAINT CHK_DRV_STATUS CHECK (STATUS IN ('AVAILABLE', 'ON DUTY', 'OFF DUTY')),
    CONSTRAINT CHK_DRV_SALARY CHECK (SALARY_MONTHLY >= 0)
);

-- ------------------------------------------------------------
-- 3. ALTER TABLE COMMANDS
-- ------------------------------------------------------------
ALTER TABLE DRIVER ADD (EXPERIENCE_YEARS NUMBER(2) DEFAULT 0);
ALTER TABLE DRIVER ADD (DOB VARCHAR2(10));
ALTER TABLE DRIVER ADD (AGE NUMBER(3));
ALTER TABLE DRIVER ADD CONSTRAINT CHK_DRV_EXP CHECK (EXPERIENCE_YEARS >= 0);
ALTER TABLE DRIVER ADD CONSTRAINT CHK_DRV_PHONE_LEN CHECK (LENGTH(PHONE) >= 10);
ALTER TABLE DRIVER MODIFY (DRIVER_NAME VARCHAR2(120));

-- ------------------------------------------------------------
-- 4. RENAME COMMANDS
-- ------------------------------------------------------------
ALTER TABLE AMBULANCE ADD (TEMP_NOTE VARCHAR2(100));
ALTER TABLE AMBULANCE RENAME COLUMN TEMP_NOTE TO REMARKS;
CREATE TABLE VEHICLE_STAGING (STAGING_ID NUMBER PRIMARY KEY);
RENAME VEHICLE_STAGING TO VEHICLE_ARCHIVE;
-- DROP TABLE VEHICLE_ARCHIVE; -- Banned: DROP TABLE commands are strictly prohibited for database safety

-- ------------------------------------------------------------
-- 5. COMMENT ON TABLE & COLUMN
-- ------------------------------------------------------------
COMMENT ON TABLE AMBULANCE IS 'Stores ambulance fleet specifications and operational status.';
COMMENT ON COLUMN AMBULANCE.ID IS 'Primary key: Unique vehicle identification number.';
COMMENT ON COLUMN AMBULANCE.VEHICLE_TYPE IS 'Ambulance category: BASIC, ADVANCED, or ICU.';
COMMENT ON COLUMN AMBULANCE.MODEL IS 'Make and model details of the vehicle.';
COMMENT ON COLUMN AMBULANCE.STATUS IS 'Current status: AVAILABLE, ON DUTY, or MAINTENANCE.';
COMMENT ON COLUMN AMBULANCE.REMARKS IS 'Optional remarks or service notes for the ambulance.';

COMMENT ON TABLE DRIVER IS 'Stores registered driver details, commercial licensing, and monthly salary.';
COMMENT ON COLUMN DRIVER.DRIVER_ID IS 'Primary key: Unique driver identification number.';
COMMENT ON COLUMN DRIVER.DRIVER_NAME IS 'Full name of the ambulance driver.';
COMMENT ON COLUMN DRIVER.PHONE IS 'Unique mobile contact number (minimum 10 digits).';
COMMENT ON COLUMN DRIVER.LICENSE_NO IS 'Unique commercial vehicle driver license number.';
COMMENT ON COLUMN DRIVER.STATUS IS 'Current duty status: AVAILABLE, ON DUTY, or OFF DUTY.';
COMMENT ON COLUMN DRIVER.SALARY_MONTHLY IS 'Base monthly salary in INR (used to calculate annual salary).';
COMMENT ON COLUMN DRIVER.EXPERIENCE_YEARS IS 'Total years of emergency driving experience.';
COMMENT ON COLUMN DRIVER.DOB IS 'Date of birth of the driver in DD-MM-YYYY format.';
COMMENT ON COLUMN DRIVER.AGE IS 'Derived driver age in completed years.';

-- ------------------------------------------------------------
-- 6. OPTIONAL CLEANUP (DROP TABLE) - Commment out for safety
-- ------------------------------------------------------------
-- DROP TABLE DRIVER CASCADE CONSTRAINTS;
-- DROP TABLE AMBULANCE CASCADE CONSTRAINTS;
"""

# =============================================================================
# PAT 4 ORACLE DML STATEMENTS (SAMPLE DATA)
# =============================================================================
SAMPLE_DATA_DML = """
INSERT INTO AMBULANCE (ID, VEHICLE_TYPE, MODEL, STATUS, REMARKS)
VALUES (101, 'BASIC', 'Force Traveller 3350', 'AVAILABLE', 'Primary city emergency unit');

INSERT INTO AMBULANCE (ID, VEHICLE_TYPE, MODEL, STATUS, REMARKS)
VALUES (102, 'ADVANCED', 'Tata Winger Ambulance', 'ON DUTY', 'Trauma response dispatch');

INSERT INTO AMBULANCE (ID, VEHICLE_TYPE, MODEL, STATUS, REMARKS)
VALUES (103, 'ICU', 'Mercedes-Benz Sprinter ICU', 'AVAILABLE', 'Full ICU ventilator support');

INSERT INTO AMBULANCE (ID, VEHICLE_TYPE, MODEL, STATUS, REMARKS)
VALUES (104, 'BASIC', 'Mahindra Bolero Maxi Truck', 'MAINTENANCE', 'Scheduled brake maintenance');

INSERT INTO DRIVER (DRIVER_ID, DRIVER_NAME, PHONE, LICENSE_NO, STATUS, SALARY_MONTHLY, EXPERIENCE_YEARS, DOB, AGE)
VALUES (201, 'Rajesh Kumar', '9876543210', 'DL-0420110012345', 'AVAILABLE', 25000.00, 5, '15-08-1988', 38);

INSERT INTO DRIVER (DRIVER_ID, DRIVER_NAME, PHONE, LICENSE_NO, STATUS, SALARY_MONTHLY, EXPERIENCE_YEARS, DOB, AGE)
VALUES (202, 'Suresh Sharma', '9812345678', 'DL-0720150067890', 'ON DUTY', 28000.00, 7, '22-04-1985', 41);

INSERT INTO DRIVER (DRIVER_ID, DRIVER_NAME, PHONE, LICENSE_NO, STATUS, SALARY_MONTHLY, EXPERIENCE_YEARS, DOB, AGE)
VALUES (203, 'Amit Singh', '9701234567', 'DL-0920180054321', 'OFF DUTY', 22000.00, 3, '10-12-1994', 31);

INSERT INTO DRIVER (DRIVER_ID, DRIVER_NAME, PHONE, LICENSE_NO, STATUS, SALARY_MONTHLY, EXPERIENCE_YEARS, DOB, AGE)
VALUES (204, 'Vikram Verma', '9654321098', 'DL-1120200098765', 'AVAILABLE', 30000.00, 9, '05-06-1982', 44);

COMMIT;
"""


if __name__ == "__main__":
    if "--schema" in sys.argv:
        print(SCHEMA_DDL)
        sys.exit(0)

    if "--sample-data" in sys.argv:
        print(SAMPLE_DATA_DML)
        sys.exit(0)

    print("Testing Oracle connection configuration...")
    print(f"Host: {DB_HOST}, Port: {DB_PORT}, Service: {DB_SERVICE}, SID: {DB_SID or '(none)'}, User: {DB_USER or '(not set)'}")
    print(f"Configured Client Mode: {'Thick' if (ORACLE_THICK_MODE or ORACLE_CLIENT_LIB_DIR) else 'Thin (default)'}")
    success, message = test_connection()
    print(message)
    sys.exit(0 if success else 1)