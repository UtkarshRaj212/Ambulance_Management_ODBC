# 🚑 Ambulance Management System

A web-based fleet and emergency driver management system powered by **Python (Flask)** and **Oracle Database**. Built with a modern, responsive user interface featuring dynamic schema updates, strict DDL security controls, side-by-side action controls, and full dark/light theme support.

---

## 📑 Table of Contents (Index)

1. [About the Program](#-about-the-program)
2. [Tech Stack](#-tech-stack)
3. [Key Features](#-key-features)
4. [Database Architecture & Setup](#-database-architecture--setup)
   - [Table Schemas & Constraints](#table-schemas--constraints)
   - [Oracle DDL Initialization Scripts](#oracle-ddl-initialization-scripts)
   - [Sample DML Data](#sample-dml-data)
5. [Installation & Getting Started](#-installation--getting-started)
   - [Prerequisites](#prerequisites)
   - [Step-by-Step Setup Guide](#step-by-step-setup-guide)
6. [Configuration & Environment Variables](#-configuration--environment-variables)
7. [Default User Credentials & Roles](#-default-user-credentials--roles)
8. [Security Policies & Rules](#-security-policies--rules)
   - [Strict Table Drop Ban (`DROP TABLE`)](#strict-table-drop-ban-drop-table)
9. [API Endpoints Reference](#-api-endpoints-reference)
10. [Project Directory Structure](#-project-directory-structure)

---

## 📖 About the Program

The **Ambulance Management System** is designed to streamline emergency fleet operations for hospitals and ambulance dispatch networks. It provides real-time monitoring, maintenance scheduling, driver roster management, dynamic salary tracking, and schema-level administrative control.

### Core Objectives:
- **Fleet Allocation**: Track emergency vehicles (`BASIC`, `ADVANCED`, `ICU`) across operational states (`AVAILABLE`, `ON DUTY`, `MAINTENANCE`).
- **Driver Administration**: Record commercial driver credentials, calculate ages from dates of birth dynamically, compute monthly & annual salaries, and monitor active duty shifts.
- **Dynamic Schema Propagation**: Allow database administrators to alter table schemas (e.g. `ALTER TABLE ADD/DROP COLUMN/RENAME`) directly through a built-in interactive console. The system queries Oracle's data dictionary (`USER_TAB_COLUMNS`) and immediately updates UI tables and input forms in real-time without modifying backend code.
- **Resilience & Fallback**: Automatically connects to live Oracle Database via Thick or Thin mode. If Oracle is unreachable, the system seamlessly transitions to an in-memory simulation engine so evaluations and demonstrations continue uninterrupted.

---

## 🛠 Tech Stack

| Layer | Technology | Description |
|---|---|---|
| **Backend** | **Python 3.10+** | Core application language |
| **Framework** | **Flask (Werkzeug)** | Lightweight, secure REST API and session-based routing |
| **Database** | **Oracle Database (19c / 21c / 23ai / XE)** | Enterprise relational database storage with ACID integrity |
| **Driver / Connector** | **`python-oracledb`** | High-performance official Oracle DB driver (supports Thick & Thin mode) |
| **Frontend Structure** | **HTML5 (Jinja2 Templates)** | Semantic markup, dynamic table headers, and modal input layouts |
| **Styling (CSS)** | **Vanilla CSS3** | Custom design system with warm palette, glassmorphic headers, and persistent dark mode |
| **Scripting / Logic** | **Vanilla JavaScript (ES6+)** | Asynchronous fetch APIs, dynamic DOM generation, and client-side validation |

---

## ✨ Key Features

- **🌐 Dynamic Column Propagation**: Adding or altering table columns via DDL instantly propagates to the site tables and the Add/Modify modal input boxes with dynamic labels and badges.
- **🛡️ Strict DDL Security Guard**: **`DROP TABLE` commands are completely banned**. Any attempt to drop database tables (via GUI or API) is immediately blocked client-side and returns HTTP 403 Forbidden server-side.
- **🌓 Dark & Light Theme**: Persistent theme switcher located in the top-right corner of all pages with instant transition and zero flash of unstyled theme.
- **🖥️ Full-Width Responsive Design**: Tables automatically utilize 100% of the display width with smooth horizontal scrolling on mobile screens and fixed header navigation.
- **⚡ Side-by-Side Action Buttons**: `Modify` and `Delete` action controls are pinned in a single horizontal row with dedicated styling.
- **👥 Role-Based Access Control**:
  - `Admin`: Full read/write fleet, driver, and DDL administrative privileges.
  - `Manager`: Full fleet and driver management.
  - `Chief`: Dedicated ambulance fleet oversight with driver restrictions.
- **🔄 Sync Columns Button**: One-click re-synchronization with Oracle’s data dictionary to pick up any schema modifications made outside the web interface (e.g., via SQL*Plus or SQL Developer).

---

## 🗄 Database Architecture & Setup

The system manages two core relational tables in Oracle Database:

### Table Schemas & Constraints

#### 1. `AMBULANCE` Table
| Column Name | Data Type | Nullable | Primary Key | Constraints / Descriptions |
|---|---|---|---|---|
| `ID` | `NUMBER` | No | **PK** | Must be positive integer (`ID > 0`) |
| `VEHICLE_TYPE` | `VARCHAR2(20)` | No | No | `IN ('BASIC', 'ADVANCED', 'ICU')` |
| `MODEL` | `VARCHAR2(50)` | No | No | Vehicle make and model (e.g. 'Force Traveller 3350') |
| `STATUS` | `VARCHAR2(20)` | No | No | `IN ('AVAILABLE', 'ON DUTY', 'MAINTENANCE')` |
| `REMARKS` | `VARCHAR2(100)` | Yes | No | Fleet service notes or equipment info |

#### 2. `DRIVER` Table
| Column Name | Data Type | Nullable | Primary Key | Constraints / Descriptions |
|---|---|---|---|---|
| `DRIVER_ID` | `NUMBER` | No | **PK** | Must be positive integer (`DRIVER_ID > 0`) |
| `DRIVER_NAME` | `VARCHAR2(100)` | No | No | Full name of the licensed operator |
| `PHONE` | `VARCHAR2(20)` | No | No | Unique commercial contact; length >= 10 |
| `LICENSE_NO` | `VARCHAR2(50)` | No | No | Unique commercial driver license number |
| `STATUS` | `VARCHAR2(20)` | No | No | `IN ('AVAILABLE', 'ON DUTY', 'OFF DUTY')` |
| `SALARY_MONTHLY`| `NUMBER(10,2)` | No | No | Base monthly compensation (`SALARY_MONTHLY >= 0`) |
| `EXPERIENCE_YEARS`| `NUMBER(2)` | Yes | No | Emergency vehicle driving experience in years |
| `DOB` | `VARCHAR2(10)` | Yes | No | Date of birth in `DD-MM-YYYY` format |
| `AGE` | `NUMBER(3)` | Yes | No | Derived driver age in completed years |

---

### Oracle DDL Initialization Scripts

To initialize the tables directly in Oracle (using SQL*Plus, SQL Developer, or Oracle APEX), run the following statements:

```sql
-- 1. Create AMBULANCE Table
CREATE TABLE AMBULANCE (
    ID NUMBER PRIMARY KEY,
    VEHICLE_TYPE VARCHAR2(20) NOT NULL,
    MODEL VARCHAR2(50) NOT NULL,
    STATUS VARCHAR2(20) NOT NULL,
    REMARKS VARCHAR2(100),
    CONSTRAINT CHK_AMB_ID CHECK (ID > 0),
    CONSTRAINT CHK_AMB_VEHICLE_TYPE CHECK (VEHICLE_TYPE IN ('BASIC', 'ADVANCED', 'ICU')),
    CONSTRAINT CHK_AMB_STATUS CHECK (STATUS IN ('AVAILABLE', 'ON DUTY', 'MAINTENANCE'))
);

-- 2. Create DRIVER Table
CREATE TABLE DRIVER (
    DRIVER_ID NUMBER PRIMARY KEY,
    DRIVER_NAME VARCHAR2(100) NOT NULL,
    PHONE VARCHAR2(20) NOT NULL,
    LICENSE_NO VARCHAR2(50) NOT NULL,
    STATUS VARCHAR2(20) NOT NULL,
    SALARY_MONTHLY NUMBER(10, 2) NOT NULL,
    EXPERIENCE_YEARS NUMBER(2) DEFAULT 0,
    DOB VARCHAR2(10),
    AGE NUMBER(3),
    CONSTRAINT CHK_DRV_ID CHECK (DRIVER_ID > 0),
    CONSTRAINT UQ_DRV_PHONE UNIQUE (PHONE),
    CONSTRAINT UQ_DRV_LICENSE UNIQUE (LICENSE_NO),
    CONSTRAINT CHK_DRV_STATUS CHECK (STATUS IN ('AVAILABLE', 'ON DUTY', 'OFF DUTY')),
    CONSTRAINT CHK_DRV_SALARY CHECK (SALARY_MONTHLY >= 0),
    CONSTRAINT CHK_DRV_PHONE_LEN CHECK (LENGTH(PHONE) >= 10),
    CONSTRAINT CHK_DRV_EXP CHECK (EXPERIENCE_YEARS >= 0)
);

-- 3. Comments on Schema Objects
COMMENT ON TABLE AMBULANCE IS 'Stores ambulance fleet specifications and operational status.';
COMMENT ON COLUMN AMBULANCE.ID IS 'Primary key: Unique vehicle identification number.';
COMMENT ON TABLE DRIVER IS 'Stores registered driver details, commercial licensing, and monthly salary.';
COMMENT ON COLUMN DRIVER.DRIVER_ID IS 'Primary key: Unique driver identification number.';
```

### Sample DML Data

```sql
-- Sample Ambulances
INSERT INTO AMBULANCE (ID, VEHICLE_TYPE, MODEL, STATUS, REMARKS)
VALUES (101, 'BASIC', 'Force Traveller 3350', 'AVAILABLE', 'Primary city emergency unit');

INSERT INTO AMBULANCE (ID, VEHICLE_TYPE, MODEL, STATUS, REMARKS)
VALUES (102, 'ADVANCED', 'Tata Winger Ambulance', 'ON DUTY', 'Trauma response dispatch');

INSERT INTO AMBULANCE (ID, VEHICLE_TYPE, MODEL, STATUS, REMARKS)
VALUES (103, 'ICU', 'Mercedes-Benz Sprinter ICU', 'AVAILABLE', 'Full ICU ventilator support');

INSERT INTO AMBULANCE (ID, VEHICLE_TYPE, MODEL, STATUS, REMARKS)
VALUES (104, 'BASIC', 'Mahindra Bolero Maxi Truck', 'MAINTENANCE', 'Scheduled brake maintenance');

-- Sample Drivers
INSERT INTO DRIVER (DRIVER_ID, DRIVER_NAME, PHONE, LICENSE_NO, STATUS, SALARY_MONTHLY, EXPERIENCE_YEARS, DOB, AGE)
VALUES (201, 'Rajesh Kumar', '9876543210', 'DL-0420110012345', 'AVAILABLE', 25000.00, 5, '15-08-1988', 38);

INSERT INTO DRIVER (DRIVER_ID, DRIVER_NAME, PHONE, LICENSE_NO, STATUS, SALARY_MONTHLY, EXPERIENCE_YEARS, DOB, AGE)
VALUES (202, 'Suresh Sharma', '9812345678', 'DL-0720150067890', 'ON DUTY', 28000.00, 7, '22-04-1985', 41);

INSERT INTO DRIVER (DRIVER_ID, DRIVER_NAME, PHONE, LICENSE_NO, STATUS, SALARY_MONTHLY, EXPERIENCE_YEARS, DOB, AGE)
VALUES (203, 'Amit Singh', '9701234567', 'DL-0920180054321', 'OFF DUTY', 22000.00, 3, '10-12-1994', 31);

INSERT INTO DRIVER (DRIVER_ID, DRIVER_NAME, PHONE, LICENSE_NO, STATUS, SALARY_MONTHLY, EXPERIENCE_YEARS, DOB, AGE)
VALUES (204, 'Vikram Verma', '9654321098', 'DL-1120200098765', 'AVAILABLE', 30000.00, 9, '05-06-1982', 44);

COMMIT;
```

---

## 🚀 Installation & Getting Started

### Prerequisites

- **Python**: Version 3.10 or higher.
- **Oracle Database** (Optional for live mode): Oracle Database 19c, 21c, 23ai, or Oracle XE. (If offline, in-memory simulation runs automatically).
- **Oracle Instant Client** (Optional, only for Thick mode): Download the Basic or Basic Light package from Oracle's website.

---

### Step-by-Step Setup Guide

#### 1. Clone or Open the Repository
```bash
git clone https://github.com/UtkarshRaj212/Ambulance_Management_ODBC.git
cd Ambulance_Management_ODBC
```

#### 2. Create and Activate a Python Virtual Environment

**Windows PowerShell:**
```powershell
python -m venv venv
.\venv\Scripts\Activate.ps1
```

**Linux / macOS:**
```bash
python3 -m venv venv
source venv/bin/activate
```

#### 3. Install Dependencies
```bash
pip install -r requirements.txt
```

#### 4. Configure Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Edit `.env` with your Oracle connection credentials (see [Configuration](#-configuration--environment-variables)).

#### 5. Run the Application
```bash
python app.py
```

The application will start at:
👉 **`http://127.0.0.1:5000`**

Open your browser and navigate to the URL to access the login page.

---

### ⚡ Deployment on Vercel (Static Hosting & In-Browser DB)

The system is fully compatible with **Vercel** and static web hosts. When deployed without a Python backend, it automatically and transparently operates using an embedded **in-browser database** (`localStorage`):

1. **Push to GitHub**: Push this repository to your GitHub account.
2. **Import to Vercel**: Connect your repository in the Vercel dashboard.
3. **Deploy**: Leave build settings default (Static Site). Vercel reads `vercel.json` and immediately deploys the site.
4. **Zero-Configuration In-Browser Database**:
   - The application automatically initializes and seeds mock fleet and driver records if the browser database is empty.
   - All **DDL** (`ALTER TABLE ADD/DROP COLUMN/RENAME`) and **DML** (`Insert`, `Update`, `Delete`) operations execute seamlessly.
   - The UI runs cleanly without any offline or degraded indicators.

---

## ⚙️ Configuration & Environment Variables

The application can be configured using environment variables in a `.env` file or exported in your terminal session:

| Variable | Default Value | Description |
|---|---|---|
| `PORT` | `5000` | Port for the Flask HTTP server |
| `FLASK_DEBUG` | `false` | Enable/disable Flask debug mode |
| `SECRET_KEY` | `ambulance-management-secret-pat4` | Session signing secret key |
| `APP_USERNAME` | `admin` | Custom administrator username |
| `APP_PASSWORD` | `admin123` | Custom administrator password |
| `DB_USER` | `utk` | Oracle database user |
| `DB_PASSWORD` | `tiger` | Oracle database password |
| `DB_HOST` | `localhost` | Oracle listener host / IP address |
| `DB_PORT` | `1521` | Oracle listener port |
| `DB_SERVICE` | `xe` | Oracle service name |
| `DB_SID` | *(optional)* | Oracle SID (if using SID instead of Service) |
| `ORACLE_THICK_MODE` | `false` | Set to `true` to force Oracle Thick Mode |
| `ORACLE_CLIENT_LIB_DIR` | *(optional path)* | Absolute directory to Oracle Instant Client DLLs/binaries |
| `DB_CONNECT_TIMEOUT`| `2.0` | Timeout in seconds for connection attempts |

---

## 🔐 Default User Credentials & Roles

The system includes preconfigured role accounts:

| Username | Password | Role | Permissions |
|---|---|---|---|
| **`admin`** | `admin123` | **Administrator** | Full access to fleet, drivers, metrics, and DDL schema management |
| **`manager`**| `manager123` | **Fleet Manager** | Full access to add, modify, and delete ambulances and drivers |
| **`chief`** | `chief123` | **Ambulance Chief**| Specialized access: ambulance fleet management only (Driver module restricted) |

---

## 🛡️ Security Policies & Rules

### Strict Table Drop Ban (`DROP TABLE`)

To preserve data integrity, protect against accidents, and enforce safety:
1. **Frontend Pre-Validation**: The JavaScript client checks all submitted DDL inputs before sending. Any statement containing `DROP TABLE` or beginning with `DROP` is blocked with an alert badge:
   > `⛔ Command Prohibited: DROP TABLE commands are strictly banned to protect database integrity and prevent data loss.`
2. **Comment Stripping & Normalization**: SQL comments (`--` single-line and `/* ... */` multi-line) are stripped on the backend to prevent comment-evasion bypasses.
3. **HTTP 403 Forbidden**: If any variation of `DROP TABLE` is received, the server returns an explicit **HTTP 403 Forbidden** status code.
4. **Permitted Alterations**: Column modifications via `ALTER TABLE <table_name> ADD (...)`, `ALTER TABLE <table_name> DROP COLUMN <column_name>`, and `RENAME COLUMN` remain fully functional and propagate dynamically.

---

## 📡 API Endpoints Reference

| Method | Endpoint | Description | Role Required |
|---|---|---|---|
| `GET` | `/` | Login page view | Public |
| `POST` | `/api/login` | Authenticate user and initiate secure session | Public |
| `POST` | `/api/logout` | Terminate session | Authenticated |
| `GET` | `/dashboard` | Main dashboard template view | Authenticated |
| `GET` | `/api/db-status` | Check live Oracle connection status | Authenticated |
| `GET` | `/api/schema` | Fetch active column definitions and primary keys | Authenticated |
| `GET` | `/api/ambulances` | List all ambulance fleet records | Authenticated |
| `POST` | `/api/ambulances` | Insert a new ambulance record | Admin, Manager, Chief |
| `PUT` | `/api/ambulances/<id>` | Update an existing ambulance record | Admin, Manager, Chief |
| `DELETE`| `/api/ambulances/<id>` | Delete an ambulance record | Admin, Manager, Chief |
| `GET` | `/api/drivers` | List all registered drivers | Admin, Manager |
| `POST` | `/api/drivers` | Register a new driver record | Admin, Manager |
| `PUT` | `/api/drivers/<id>` | Update driver details | Admin, Manager |
| `DELETE`| `/api/drivers/<id>` | Delete driver record | Admin, Manager |
| `POST` | `/api/ddl/execute` | Execute permitted Oracle DDL (`ALTER TABLE`) | Admin |

---

## 📁 Project Directory Structure

```text
Ambulance_Management_ODBC/
├── app.py                  # Core Flask application, REST routes, and DDL engine
├── db.py                   # Oracle DB connection module, thick/thin config & DDL script
├── requirements.txt        # Python dependency manifest
├── .env.example            # Sample configuration template
├── README.md               # Complete project documentation
├── templates/
│   ├── dashboard.html      # Main operational dashboard template
│   └── login.html          # Authentication login template
└── static/
    ├── style.css           # Modern warm & dark theme responsive stylesheet
    └── script.js           # Client application logic & dynamic UI renderer
```

---

## 📄 License & Attribution

Developed for academic and production emergency services management demonstration. Free to use and customize under the MIT License.
