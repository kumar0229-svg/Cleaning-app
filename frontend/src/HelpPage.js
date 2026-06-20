import React, { useState } from "react";
import logo from "./assets/cipla-logo.png";

const tableStyle = { borderCollapse: "collapse", width: "100%", fontSize: 13 };
const thStyle = { padding: "8px 10px", textAlign: "left", border: "1px solid #ddd", background: "#004f9f", color: "white" };
const tdStyle = { padding: "8px 10px", border: "1px solid #ddd", verticalAlign: "top" };

// ── FAQ data ───────────────────────────────────────────────────────────────
const faqGroups = [
  {
    group: "MACO Calculations",
    items: [
      { q: "Which MACO value should I use when multiple methods are calculated?", a: "Always use the governing (lowest / most restrictive) value, highlighted in green. This is the limit that must be met to protect the next product's patient." },
      { q: "What units does the system use throughout?", a: "Therapeutic doses in mg, batch sizes in kg, surface area in cm², MACO results in µg, and rinse/swab acceptance limits in ppm (µg/mL or µg/cm²)." },
      { q: "What is the difference between TD-based, PDE-based, and 10 ppm methods?", a: "TD-based uses 1/1000th of the minimum therapeutic dose of the previous product scaled to the next product's batch. PDE-based uses the Permitted Daily Exposure (EMA guideline). The 10 ppm criterion is a general acceptance criterion based on batch size. The system computes all applicable methods and selects the most restrictive." },
      { q: "When is a PDE value required?", a: "PDE is optional. If provided for the previous product, the system includes a PDE-based MACO alongside the dose-based calculation. If omitted, only dose-based and 10 ppm methods are used." },
      { q: "How is the surface area limit (µg/cm²) derived?", a: "It is calculated by dividing the governing MACO (µg) by the shared surface area (cm²) of the selected equipment. This value is used for swab acceptance criteria." },
      { q: "Can I change which calculation method governs across the system?", a: "Yes. An ADMIN user can set the global Calculation Policy from the Policy page. Changes are password-protected and recorded in the Audit log." },
      { q: "Why does the MACO differ between two protocol runs for the same product pair?", a: "MACO is sensitive to batch size and dose values. If either product's data was edited between runs, the result will differ. Always re-generate the protocol after updating product data." },
    ],
  },
  {
    group: "Products & Equipment",
    items: [
      { q: "What product data is required for MACO calculations?", a: "Batch size (kg), minimum therapeutic dose (mg), and maximum daily dose (mg/day) are mandatory. PDE (mg/day) is optional but enables the PDE-based MACO method when provided." },
      { q: "Can I add the same product to multiple facilities?", a: "Products are global (not facility-specific). Equipment is assigned per facility, and protocols are generated per facility. The same product can appear in protocols for multiple facilities." },
      { q: "What is the 2D Structure panel on the Product page?", a: "When you type a product name, the system queries PubChem to find a matching compound, retrieves its CAS registry number, and displays the 2D chemical structure image. The CAS number is shown as a badge below the structure." },
      { q: "Why is the CAS number or structure not showing for my product?", a: "PubChem may not have an exact match for the name entered. Try the INN (international nonproprietary name) or common chemical name. The structure panel is informational only and does not affect calculations." },
      { q: "What is equipment surface area used for?", a: "Surface area (cm²) is used to convert the MACO (µg) into a swab acceptance limit (µg/cm²). If surface area is not entered, the swab limit column will show 'N/A'." },
      { q: "Can I delete a product that is already used in a protocol?", a: "ADMIN users can delete a product, but existing archived protocols that reference the product will retain its data in the frozen snapshot. Deleting the product removes it from future protocol generation." },
    ],
  },
  {
    group: "Protocol & Validation Report",
    items: [
      { q: "What is a protocol archive?", a: "A protocol archive is a frozen, version-stamped snapshot of the protocol at the time it was saved. It captures product data, MACO calculations, equipment, and sampling plan so the record cannot be changed by future edits." },
      { q: "How is the protocol document number generated?", a: "Document numbers follow the format CL-PROTO-[ProductID]-[Year], e.g. CL-PROTO-0001-2026. Each new archive for the same document number increments the version." },
      { q: "How many cycles does a cleaning validation report cover?", a: "Each validation report covers exactly 3 cleaning cycles (runs). Each run captures rinse and swab results for every piece of equipment in the protocol." },
      { q: "Who can approve a validation report?", a: "Users with the QA or ADMIN role. On the Protocol & Report page, find the report in the list, click Approve, and confirm with your password. The approver's name and timestamp are recorded permanently." },
      { q: "Can an approved report be unapproved or edited?", a: "No. Approval is a one-way action to maintain data integrity. If a correction is needed, delete the report (ADMIN/QA only) and re-submit a corrected version." },
    ],
  },
  {
    group: "DEHT (Dirty Equipment Hold Time)",
    items: [
      { q: "What is a hold time in the context of DEHT?", a: "Hold time is the elapsed duration between the end of equipment use (last manufacturing activity) and the start of cleaning. It is compared to a defined maximum hold time limit. Exceeding the limit triggers a FAIL status." },
      { q: "What formulas are used to calculate DEHT acceptance limits?", a: "The system provides four formula options: 10 ppm (batch-size-based), 1/1000 Dose (therapeutic dose fraction), PDE/ADE (Permitted Daily Exposure), and NOEL (No-Observed-Effect Level). The active formula is set by an ADMIN in the Calculation Policy." },
      { q: "Can a DEHT protocol be submitted with a hold time FAIL?", a: "The system will allow submission, but the FAIL status is recorded and visible in the report. It is recommended to investigate and document a deviation before submitting." },
      { q: "Who can approve a DEHT protocol?", a: "QA or ADMIN role users. Approval is password-protected and permanently recorded with the approver's name and timestamp." },
    ],
  },
  {
    group: "Genotoxic / Nitrosamine Impurity",
    items: [
      { q: "What PDE unit does the system expect for genotoxic impurities?", a: "PDE must be entered in µg/day (micrograms per day), not mg/day. Genotoxic impurity PDEs are typically 1,000× smaller than conventional product PDEs. Using the wrong unit will produce incorrect limits." },
      { q: "How is the genotoxic MACO calculated?", a: "MACO (mg) = (PDE µg/day × Min Batch Yield kg × 1,000) ÷ Max Daily Dose mg. The ×1,000 factor converts µg to mg so the result is in mg. This MACO is then used to derive equipment-level rinse and swab limits." },
      { q: "Why are rinse limits shown in scientific notation?", a: "Genotoxic PDEs are very small, often producing limits below 0.0001 ppm. The system displays values below this threshold in scientific notation (e.g. 1.88e-6) to avoid showing a misleading zero." },
      { q: "Which target products are included in the calculated limits?", a: "All products manufactured on the same equipment as the source product are included as target products. The most restrictive (lowest) limit across all target products governs for each piece of equipment." },
      { q: "How does equipment selection in impurity mapping work?", a: "When adding or editing an impurity, select all equipment pieces that contact the source product. Limits are only calculated for the selected equipment. Equipment not selected will not show limits for that impurity." },
      { q: "Can I enter genotoxic results even if some results are above the limit?", a: "Yes — the form allows entry regardless of result value. A FAIL badge appears automatically when a result exceeds the limit, but submission is not blocked. Document any out-of-limit results through your deviation management process." },
      { q: "Are genotoxic results included in the archived report?", a: "Yes. When a report is submitted, genotoxic impurity results are frozen in the archive snapshot under §4 Genotoxic / Nitrosamine Impurity Results. The archived view is read-only and cannot be altered after approval." },
    ],
  },
  {
    group: "Continuous Cleaning Verification (CCV)",
    items: [
      { q: "What is the difference between a Validation Report and a CCV run?", a: "A validation report is the initial, formal 3-cycle study that establishes that a cleaning process is effective. CCV runs are ongoing, single-cycle monitoring records that demonstrate continued cleaning effectiveness during routine manufacturing." },
      { q: "Why is a product not showing in the CCV eligible product list?", a: "A product only appears in CCV when it has at least one Approved validation report. Go to the Protocol & Report page, find the report, and approve it." },
      { q: "Can I enter multiple CCV runs for the same product?", a: "Yes. Each submission creates a new run (Run 1, Run 2, …). The run number is assigned automatically based on the total number of CCV runs already recorded for that product." },
      { q: "Can a CCV run be edited after submission?", a: "Direct editing of a submitted CCV run is not available from the UI. To correct a run, delete it (QA/ADMIN, password required) and re-submit with the correct data." },
      { q: "Can I print a CCV run as a PDF?", a: "Yes. Open the run from the View Runs tab and click Print / Export PDF. This opens a print-formatted version that can be saved as PDF using the browser's print-to-PDF feature." },
    ],
  },
  {
    group: "User Roles & Access",
    items: [
      { q: "What roles are available in the system?", a: "ADMIN (full access including user management, policy changes, and all deletions), QA (can approve reports and delete CCV runs/reports), and USER (read and write access, no deletions or approvals)." },
      { q: "Can a regular USER submit a validation report?", a: "Yes. Any authenticated user can submit a report. Only QA and ADMIN users can approve it." },
      { q: "What does password confirmation on actions do?", a: "Sensitive actions (submit, approve, delete) require you to re-enter your own login password. This confirms the authenticated user is intentionally performing the action and creates a clear audit trail." },
      { q: "Can an ADMIN reset another user's password?", a: "Yes. From the User Management page, ADMIN users can reset any user's password without knowing the current password." },
      { q: "Is there a session timeout?", a: "Yes — the session automatically logs out after 10 minutes of inactivity. A 1-minute warning dialog appears before logout. Click 'Stay Logged In' to extend the session." },
    ],
  },
  {
    group: "Audit Log",
    items: [
      { q: "What actions are recorded in the Audit log?", a: "Every CREATE, UPDATE, and DELETE on facilities, equipment, products, protocols, validation reports, CCV runs, DEHT records, users, and policy changes is logged with the user, timestamp, and before/after values." },
      { q: "Can audit entries be deleted or modified?", a: "No. The audit log is append-only and read-only in the UI. It cannot be altered by any user role." },
      { q: "Who can view the audit log?", a: "All authenticated users can view the audit log. There is no role restriction on reading audit entries." },
    ],
  },
  {
    group: "System & Technical",
    items: [
      { q: "What browsers are supported?", a: "The application is tested on modern versions of Chrome, Edge, and Firefox. Internet Explorer is not supported. For best results, use the latest stable release of Chrome or Edge." },
      { q: "Is data stored locally or in a central database?", a: "All data is stored in the central PostgreSQL database configured by your administrator. Nothing is stored in the browser beyond your login token." },
      { q: "Can multiple users work in the system simultaneously?", a: "Yes. The system is multi-user. Each user authenticates independently. There is no locking mechanism, so coordinate with your team when editing shared master data." },
      { q: "How do I report a bug or request a new feature?", a: "Contact your system administrator or the development team. Provide the module name, steps to reproduce, and a screenshot if possible." },
    ],
  },
];

function FAQContent() {
  const [openGroup, setOpenGroup] = useState(null);
  const [openItem, setOpenItem] = useState(null);
  const toggleGroup = (g) => { setOpenGroup(prev => prev === g ? null : g); setOpenItem(null); };
  const toggleItem  = (key) => setOpenItem(prev => prev === key ? null : key);
  return (
    <div>
      <p style={{ marginTop: 0, color: "#555", fontSize: 13 }}>
        Click a category to expand it, then click a question to see the answer.
      </p>
      {faqGroups.map((grp, gi) => (
        <div key={gi} style={{ marginBottom: 8, border: "1px solid #e2e8f0", borderRadius: 8, overflow: "hidden" }}>
          <button onClick={() => toggleGroup(gi)} style={{
            width: "100%", textAlign: "left", padding: "11px 16px",
            background: openGroup === gi ? "#004f9f" : "#f0f4ff",
            color: openGroup === gi ? "white" : "#004f9f",
            border: "none", cursor: "pointer", fontWeight: "bold", fontSize: 13,
            display: "flex", justifyContent: "space-between", alignItems: "center",
          }}>
            <span>{grp.group}</span>
            <span style={{ fontSize: 18, lineHeight: 1 }}>{openGroup === gi ? "−" : "+"}</span>
          </button>
          {openGroup === gi && (
            <div style={{ padding: "8px 12px", background: "white" }}>
              {grp.items.map((item, ii) => {
                const key = `${gi}-${ii}`;
                const open = openItem === key;
                return (
                  <div key={ii} style={{ borderBottom: ii < grp.items.length - 1 ? "1px solid #f1f5f9" : "none" }}>
                    <button onClick={() => toggleItem(key)} style={{
                      width: "100%", textAlign: "left", padding: "9px 6px",
                      background: "transparent", border: "none", cursor: "pointer",
                      fontWeight: "600", fontSize: 13, color: "#1a1a2e",
                      display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8,
                    }}>
                      <span>Q: {item.q}</span>
                      <span style={{ flexShrink: 0, color: "#004f9f", fontSize: 16, marginTop: 1 }}>{open ? "▲" : "▼"}</span>
                    </button>
                    {open && (
                      <p style={{ margin: "0 0 10px 6px", fontSize: 13, color: "#444", lineHeight: 1.7 }}>
                        A: {item.a}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Section definitions ────────────────────────────────────────────────────
const navGroups = [
  {
    label: "Getting Started",
    items: [
      { id: "overview",  icon: "🏠", title: "Overview" },
    ],
  },
  {
    label: "Master Data",
    items: [
      { id: "dashboard", icon: "📊", title: "Dashboard" },
      { id: "facility",  icon: "🏭", title: "Facility" },
      { id: "equipment", icon: "⚙️",  title: "Equipment" },
      { id: "product",   icon: "💊", title: "Product" },
      { id: "matrix",    icon: "🔢", title: "Matrix (MACO)" },
    ],
  },
  {
    label: "Validation",
    items: [
      { id: "protocol",    icon: "📄", title: "Protocol & Report" },
      { id: "ccvprotocol", icon: "🔄", title: "Periodic CCV Protocol" },
      { id: "ccv",         icon: "✅", title: "Continuous CCV" },
      { id: "deht",        icon: "🧴", title: "DEHT" },
      { id: "lifecycle",   icon: "📅", title: "Life Cycle Management" },
    ],
  },
  {
    label: "Advanced",
    items: [
      { id: "genotoxic",  icon: "🧬", title: "Genotoxic Impurity" },
      { id: "audit",      icon: "🔍", title: "Audit Log" },
      { id: "query",      icon: "💬", title: "NLP Query" },
    ],
  },
  {
    label: "Administration",
    items: [
      { id: "policy",    icon: "⚖️",  title: "Calculation Policy" },
      { id: "retention", icon: "🗃️", title: "Data Retention" },
      { id: "users",     icon: "👥", title: "User Management" },
      { id: "faq",       icon: "❓", title: "FAQ" },
    ],
  },
];

const allSections = navGroups.flatMap(g => g.items);

const sectionContent = {
  overview: (
    <>
      <p>
        The <strong>Cleaning Limit Software</strong> is a comprehensive pharmaceutical cleaning
        validation platform that helps teams manage Maximum Allowable Carry-Over (MACO) calculations,
        validation protocols, hold time verification, and continuous monitoring across all shared
        manufacturing equipment.
      </p>
      <h4 style={{ margin: "14px 0 8px", color: "#004f9f" }}>Key Capabilities</h4>
      <table style={tableStyle}>
        <thead><tr><th style={thStyle}>Module</th><th style={thStyle}>Purpose</th></tr></thead>
        <tbody>
          {[
            ["Dashboard", "Real-time KPI overview of validation status across all facilities"],
            ["Facility / Equipment / Product", "Master data setup required before protocol generation"],
            ["Matrix (MACO)", "Calculates carry-over limits for any product–equipment combination"],
            ["Protocol & Report", "Generates cleaning validation protocols and captures 3-cycle results"],
            ["Periodic CCV Protocol", "Manages periodic re-validation protocols and reports"],
            ["Continuous CCV", "Records ongoing post-validation cleaning monitoring runs"],
            ["DEHT", "Studies and verifies the dirty equipment hold time limits"],
            ["Life Cycle Management", "Tracks CCV schedule and product lifecycle compliance"],
            ["Genotoxic Impurity", "ICH M7 / EMA nitrosamine impurity mapping, PDE-based limit calculation per equipment, and result entry in validation reports"],
            ["Audit Log", "Immutable record of every action performed in the system"],
            ["Admin Panel", "Centralised admin area: User Management, Calculation Policy, and Data Retention"],
          ].map(([mod, desc], i) => (
            <tr key={i} style={{ background: i % 2 === 1 ? "#f8fafc" : "white" }}>
              <td style={{ ...tdStyle, fontWeight: 600, whiteSpace: "nowrap" }}>{mod}</td>
              <td style={tdStyle}>{desc}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <h4 style={{ margin: "14px 0 8px", color: "#004f9f" }}>Recommended Setup Order</h4>
      <ol style={{ fontSize: 13, lineHeight: 2 }}>
        <li>Add <strong>Facilities</strong></li>
        <li>Add <strong>Equipment</strong> to each facility (include surface area)</li>
        <li>Add <strong>Products</strong> with dose and batch size data</li>
        <li>Configure <strong>Calculation Policy</strong> (Admin)</li>
        <li>Generate <strong>Protocols</strong> and submit 3-cycle validation reports</li>
        <li>Approve reports (QA/Admin) to unlock <strong>CCV</strong> monitoring</li>
      </ol>
    </>
  ),

  dashboard: (
    <>
      <p>
        The <strong>Dashboard</strong> provides a real-time at-a-glance summary of your entire
        cleaning validation programme across all facilities.
      </p>
      <h4 style={{ margin: "14px 0 8px", color: "#004f9f" }}>KPI Cards</h4>
      <table style={tableStyle}>
        <thead><tr><th style={thStyle}>Metric</th><th style={thStyle}>Description</th></tr></thead>
        <tbody>
          {[
            ["Products", "Total active pharmaceutical products registered in the system"],
            ["Facilities", "Total manufacturing facilities configured"],
            ["Equipment", "Total equipment pieces across all facilities"],
            ["Validation Runs", "Total 3-cycle cleaning validation reports submitted"],
            ["CCV Runs", "Total continuous cleaning verification runs completed"],
            ["Approved Reports", "Validation reports that have received QA/Admin approval"],
          ].map(([k, v], i) => (
            <tr key={i} style={{ background: i % 2 === 1 ? "#f8fafc" : "white" }}>
              <td style={{ ...tdStyle, fontWeight: 600 }}>{k}</td><td style={tdStyle}>{v}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <h4 style={{ margin: "14px 0 8px", color: "#004f9f" }}>Charts</h4>
      <ul style={{ fontSize: 13, lineHeight: 2 }}>
        <li><strong>Protocol Completion Donut:</strong> Shows the percentage of protocols marked complete vs pending across all facilities.</li>
        <li><strong>Facility Bar Chart:</strong> Compares the number of validation protocols per facility — useful for identifying facilities that are behind in validation activities.</li>
        <li><strong>Recent Activity:</strong> Lists the most recent actions recorded in the audit log for quick awareness.</li>
      </ul>
    </>
  ),

  facility: (
    <>
      <p>Manage manufacturing facilities in your organisation. Each facility hosts equipment and is used to scope protocol generation.</p>
      <h4 style={{ margin: "14px 0 8px", color: "#004f9f" }}>Actions</h4>
      <ul style={{ fontSize: 13, lineHeight: 2 }}>
        <li><strong>Add</strong> — Enter the facility name and location, then click <em>Add Facility</em>.</li>
        <li><strong>Edit</strong> — Click the pencil icon on any row to rename a facility.</li>
        <li><strong>Delete</strong> — Admin only. Deleting a facility does not delete its equipment or protocols — those records remain but the facility reference is removed.</li>
        <li><strong>Print Report</strong> — Export a facility master list as a PDF using the Print button.</li>
      </ul>
      <p style={{ background: "#fff3cd", border: "1px solid #ffc107", borderRadius: 6, padding: "8px 12px", fontSize: 13 }}>
        <strong>Note:</strong> Each facility can have multiple pieces of equipment. Equipment is facility-specific; products are global.
      </p>
    </>
  ),

  equipment: (
    <>
      <p>Manage equipment pieces linked to a facility. Surface area is critical for swab acceptance limit calculations.</p>
      <h4 style={{ margin: "14px 0 8px", color: "#004f9f" }}>Fields</h4>
      <table style={tableStyle}>
        <thead><tr><th style={thStyle}>Field</th><th style={thStyle}>Description</th><th style={thStyle}>Required</th></tr></thead>
        <tbody>
          {[
            ["Facility", "The facility this equipment belongs to", "Yes"],
            ["Equipment Name", "Descriptive name (e.g. Blender, Granulator)", "Yes"],
            ["Equipment Type / Category", "Used to match sampling plan entries", "Yes"],
            ["Surface Area (cm²)", "Shared contact surface area — used to derive swab acceptance limits (µg/cm²)", "Recommended"],
          ].map(([f, d, r], i) => (
            <tr key={i} style={{ background: i % 2 === 1 ? "#f8fafc" : "white" }}>
              <td style={{ ...tdStyle, fontWeight: 600 }}>{f}</td><td style={tdStyle}>{d}</td>
              <td style={{ ...tdStyle, color: r === "Yes" ? "#155724" : "#856404", fontWeight: 600 }}>{r}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p style={{ fontSize: 13, marginTop: 10 }}>
        If surface area is not entered, the swab limit column in protocols and CCV results will display <strong>N/A</strong>.
      </p>
    </>
  ),

  product: (
    <>
      <p>Manage active pharmaceutical ingredients (APIs) and finished products. Product data feeds directly into MACO calculations.</p>
      <h4 style={{ margin: "14px 0 8px", color: "#004f9f" }}>Required Fields for MACO</h4>
      <table style={tableStyle}>
        <thead><tr><th style={thStyle}>Field</th><th style={thStyle}>Unit</th><th style={thStyle}>Used In</th></tr></thead>
        <tbody>
          {[
            ["Batch Size", "kg", "10 ppm and dose-based MACO methods"],
            ["Minimum Therapeutic Dose (TDD)", "mg", "Dose-based MACO (1/1000th method)"],
            ["Maximum Daily Dose (MDD)", "mg/day", "Denominator in dose-based MACO"],
            ["PDE / ADE", "mg/day", "PDE-based MACO method (optional)"],
          ].map(([f, u, m], i) => (
            <tr key={i} style={{ background: i % 2 === 1 ? "#f8fafc" : "white" }}>
              <td style={{ ...tdStyle, fontWeight: 600 }}>{f}</td><td style={tdStyle}>{u}</td><td style={tdStyle}>{m}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <h4 style={{ margin: "14px 0 8px", color: "#004f9f" }}>Chemical Information Panels</h4>
      <p style={{ fontSize: 13 }}>When a product name is entered, four information panels are auto-fetched:</p>
      <table style={tableStyle}>
        <thead><tr><th style={thStyle}>Panel</th><th style={thStyle}>Source</th><th style={thStyle}>Information Shown</th></tr></thead>
        <tbody>
          {[
            ["FDA", "FDA OpenFDA API", "Drug label, indications, dosage forms"],
            ["PubChem", "PubChem PUG REST", "CAS number, molecular formula, molecular weight, IUPAC name"],
            ["2D Structure", "PubChem (CID image)", "2D chemical structure diagram; CAS badge below"],
            ["NCI CACTUS", "NCI Chemical Identifier Resolver", "SMILES string, InChI key, synonyms"],
          ].map(([p, s, i_], i) => (
            <tr key={i} style={{ background: i % 2 === 1 ? "#f8fafc" : "white" }}>
              <td style={{ ...tdStyle, fontWeight: 600 }}>{p}</td><td style={tdStyle}>{s}</td><td style={tdStyle}>{i_}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p style={{ fontSize: 13, marginTop: 10 }}>
        All panels are informational only — a "Not found" result does not prevent saving the product.
      </p>
    </>
  ),

  matrix: (
    <>
      <p>
        The <strong>Matrix</strong> page calculates MACO for a selected previous product → next product → equipment combination.
        Select a facility, previous product, next product, and equipment to compute the limits.
      </p>
      <h4 style={{ margin: "14px 0 8px", color: "#004f9f" }}>MACO Calculation Methods</h4>
      <table style={tableStyle}>
        <thead><tr><th style={thStyle}>Method</th><th style={thStyle}>Formula</th><th style={thStyle}>When Applied</th></tr></thead>
        <tbody>
          {[
            ["Dose-Based (1/1000th)", "MACO = (TDD_prev / MDD_next) × Batch_next × 1000", "Always"],
            ["PDE-Based", "MACO = (PDE_prev / MDD_next) × Batch_next × 1000", "When PDE is entered for the previous product"],
            ["10 ppm Criterion", "MACO = 10 ppm × Batch_next (kg) × 10⁶ µg/kg", "Always as a cross-check"],
          ].map(([m, f, w], i) => (
            <tr key={i} style={{ background: i % 2 === 1 ? "#f8fafc" : "white" }}>
              <td style={{ ...tdStyle, fontWeight: 600 }}>{m}</td>
              <td style={{ ...tdStyle, fontFamily: "monospace", fontSize: 11 }}>{f}</td>
              <td style={tdStyle}>{w}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p style={{ fontSize: 13, marginTop: 10 }}>
        The <strong>most restrictive (lowest) MACO</strong> governs and is highlighted in green.
        A surface area limit (µg/cm²) is also shown when equipment area is provided.
        The active Calculation Policy (set by Admin) controls which methods are included.
      </p>
    </>
  ),

  protocol: (
    <>
      <p>Generate cleaning validation protocol documents and capture 3-cycle validation results.</p>
      <h4 style={{ margin: "14px 0 8px", color: "#004f9f" }}>Protocol Generation</h4>
      <ol style={{ fontSize: 13, lineHeight: 2 }}>
        <li>Select a <strong>Facility</strong> to filter available products.</li>
        <li>Select a <strong>Source Product</strong> (the product to validate).</li>
        <li>Click <em>Generate Protocol</em> — the system calculates MACO against all other products.</li>
        <li>Review the matrix table showing all product pairs and their governing MACO.</li>
        <li>Use <em>Archive Protocol</em> to freeze the snapshot with a document number (<code>CL-PROTO-[ID]-[Year]</code>).</li>
        <li>Use <em>Print / Export PDF</em> to generate the compliance document.</li>
      </ol>
      <h4 style={{ margin: "14px 0 8px", color: "#004f9f" }}>3-Cycle Validation Report</h4>
      <ul style={{ fontSize: 13, lineHeight: 2 }}>
        <li>A report covers <strong>3 cleaning cycles</strong>. Each cycle captures rinse and swab results per equipment.</li>
        <li>Results are compared against MACO limits; live <strong>PASS / FAIL</strong> badges appear as you type.</li>
        <li>If genotoxic impurities are mapped for the product, a <strong>Genotoxic / Nitrosamine Impurity Results</strong> section appears automatically — enter Lot No. and Result (ppm) per impurity per run.</li>
        <li>Submit with password confirmation. Submitted reports appear in the report list.</li>
      </ul>
      <h4 style={{ margin: "14px 0 8px", color: "#004f9f" }}>Report Status Flow</h4>
      <table style={tableStyle}>
        <thead><tr><th style={thStyle}>Status</th><th style={thStyle}>Meaning</th><th style={thStyle}>Who Can Set</th></tr></thead>
        <tbody>
          <tr>
            <td style={tdStyle}><span style={{ background: "#fff3cd", color: "#856404", padding: "2px 10px", borderRadius: 8, fontWeight: "bold", fontSize: 12 }}>Submitted</span></td>
            <td style={tdStyle}>Report submitted, pending QA review</td>
            <td style={tdStyle}>Any authenticated user</td>
          </tr>
          <tr style={{ background: "#f8fafc" }}>
            <td style={tdStyle}><span style={{ background: "#d4edda", color: "#155724", padding: "2px 10px", borderRadius: 8, fontWeight: "bold", fontSize: 12 }}>Approved</span></td>
            <td style={tdStyle}>Report approved — product becomes eligible for CCV monitoring</td>
            <td style={tdStyle}>QA or ADMIN role only</td>
          </tr>
        </tbody>
      </table>
      <p style={{ fontSize: 13, marginTop: 10 }}>
        <strong>Only approved reports</strong> unlock the product for Continuous Cleaning Verification runs.
      </p>
    </>
  ),

  ccvprotocol: (
    <>
      <p>
        The <strong>Periodic CCV Protocol & Report</strong> module manages re-validation protocols for products
        that have completed initial 3-cycle cleaning validation. It mirrors the Protocol & Report workflow
        but is used for periodic re-validation activities as per the product lifecycle schedule.
      </p>
      <h4 style={{ margin: "14px 0 8px", color: "#004f9f" }}>When to Use</h4>
      <ul style={{ fontSize: 13, lineHeight: 2 }}>
        <li>When a product's cleaning validation is due for periodic re-qualification (typically annually or as per site VMP).</li>
        <li>When changes in batch size, equipment, or cleaning procedure require re-validation.</li>
        <li>When post-change MACO limits need to be re-established and documented.</li>
      </ul>
      <h4 style={{ margin: "14px 0 8px", color: "#004f9f" }}>Workflow</h4>
      <ol style={{ fontSize: 13, lineHeight: 2 }}>
        <li>Select the <strong>Facility</strong> and <strong>Product</strong> to re-validate.</li>
        <li>Generate the periodic protocol — MACO is recalculated using current product data.</li>
        <li>Archive the protocol with a new document number / version.</li>
        <li>Submit the single-cycle validation report under the new protocol.</li>
        <li>If genotoxic impurities are mapped, a <strong>Genotoxic / Nitrosamine Impurity Results</strong> section appears in the report form for result entry.</li>
        <li>QA/Admin approves the report, completing the periodic re-validation cycle.</li>
      </ol>
      <h4 style={{ margin: "14px 0 8px", color: "#004f9f" }}>Document Numbering</h4>
      <p style={{ fontSize: 13 }}>
        Periodic CCV protocols follow the format <code>CL-PCCV-[ProductID]-[Year]</code>, distinct from
        initial validation protocols (<code>CL-PROTO-...</code>), making them easy to differentiate in the archive.
      </p>
    </>
  ),

  ccv: (
    <>
      <p>
        The <strong>Continuous Cleaning Verification (CCV)</strong> module records ongoing single-cycle
        monitoring runs after initial validation approval. Each run documents one cleaning cycle and
        compares results against the governing MACO limit from the approved protocol.
      </p>
      <h4 style={{ margin: "14px 0 8px", color: "#004f9f" }}>Eligibility Requirement</h4>
      <p style={{ fontSize: 13 }}>
        A product appears in the CCV list only when it has at least one <strong>Approved</strong> validation report.
        Approve the report from the Protocol & Report page first.
      </p>
      <h4 style={{ margin: "14px 0 8px", color: "#004f9f" }}>Submitting a New Run</h4>
      <ol style={{ fontSize: 13, lineHeight: 2 }}>
        <li>Select <strong>Facility</strong> and <strong>Product</strong>.</li>
        <li>Select the <strong>Approved Report</strong> the run is based on. Run number auto-increments.</li>
        <li>Enter <strong>Batch Number</strong> and <strong>Run Completion Date</strong>.</li>
        <li>Fill the <strong>results table</strong> — rinse and swab rows per equipment, with Inspection Lot No. and Result (ppm).</li>
        <li>Enter <strong>Training Details</strong> and <strong>SOP reference</strong>.</li>
        <li>Click <em>Submit CCV Run</em> and confirm with your password.</li>
      </ol>
      <h4 style={{ margin: "14px 0 8px", color: "#004f9f" }}>Results Table Columns</h4>
      <table style={tableStyle}>
        <thead><tr><th style={thStyle}>Column</th><th style={thStyle}>Description</th></tr></thead>
        <tbody>
          {[
            ["Equipment", "Equipment name spanning all sample rows for that piece"],
            ["Sample", "Rinse row first, then each swab location (sample no. — description)"],
            ["Limit (ppm)", "Governing MACO from the approved protocol — most restrictive across all product pairs"],
            ["Insp. Lot No.", "Inspection/analytical lot number for traceability"],
            ["Result (ppm)", "Measured residue level entered by the analyst"],
            ["Status", "Auto-calculated: PASS if result ≤ limit, FAIL otherwise"],
          ].map(([c, d], i) => (
            <tr key={i} style={{ background: i % 2 === 1 ? "#f8fafc" : "white" }}>
              <td style={{ ...tdStyle, fontWeight: 600 }}>{c}</td><td style={tdStyle}>{d}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  ),

  deht: (
    <>
      <p>
        The <strong>DEHT (Dirty Equipment Hold Time)</strong> module validates and documents
        the maximum allowable time that equipment can remain soiled (dirty) before cleaning must commence.
      </p>
      <h4 style={{ margin: "14px 0 8px", color: "#004f9f" }}>Hold Time Verification</h4>
      <ul style={{ fontSize: 13, lineHeight: 2 }}>
        <li><strong>Usage End Time:</strong> When the last manufacturing activity finished on the equipment.</li>
        <li><strong>Cleaning Start Time:</strong> When cleaning began. The system calculates actual hold time (hours).</li>
        <li><strong>Hold Time Limit:</strong> The maximum permissible hold time defined in the protocol.</li>
        <li>A <span style={{ background: "#d4edda", color: "#155724", padding: "1px 8px", borderRadius: 4, fontWeight: "bold", fontSize: 12 }}>PASS</span> is assigned if actual hold time ≤ limit; otherwise <span style={{ background: "#f8d7da", color: "#721c24", padding: "1px 8px", borderRadius: 4, fontWeight: "bold", fontSize: 12 }}>FAIL</span>.</li>
      </ul>
      <h4 style={{ margin: "14px 0 8px", color: "#004f9f" }}>Cleaning Acceptance Results</h4>
      <ul style={{ fontSize: 13, lineHeight: 2 }}>
        <li>Captures rinse and swab results for each equipment piece.</li>
        <li>Results are compared against LOQ (Limit of Quantification) thresholds.</li>
        <li>Each entry shows a live PASS/FAIL status badge.</li>
      </ul>
      <h4 style={{ margin: "14px 0 8px", color: "#004f9f" }}>Acceptance Limit Formulas</h4>
      <table style={tableStyle}>
        <thead><tr><th style={thStyle}>Formula</th><th style={thStyle}>Basis</th></tr></thead>
        <tbody>
          {[
            ["10 ppm", "Batch-size based: 10 × batch_next (kg) in µg/g"],
            ["1/1000 Dose", "1/1000th of minimum therapeutic dose of previous product"],
            ["PDE/ADE", "Permitted Daily Exposure per EMA guideline"],
            ["NOEL", "No-Observed-Effect Level based safety threshold"],
          ].map(([f, b], i) => (
            <tr key={i} style={{ background: i % 2 === 1 ? "#f8fafc" : "white" }}>
              <td style={{ ...tdStyle, fontWeight: 600 }}>{f}</td><td style={tdStyle}>{b}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <h4 style={{ margin: "14px 0 8px", color: "#004f9f" }}>Protocol Approval</h4>
      <p style={{ fontSize: 13 }}>
        DEHT protocols follow the same Submit → Approve workflow as validation reports.
        QA/Admin approval is password-protected and permanently recorded.
      </p>
    </>
  ),

  lifecycle: (
    <>
      <p>
        The <strong>Life Cycle Management</strong> page provides a consolidated view of the cleaning
        validation lifecycle for all products — tracking which products are current, overdue for CCV,
        or require re-validation.
      </p>
      <h4 style={{ margin: "14px 0 8px", color: "#004f9f" }}>Schedule Tab</h4>
      <ul style={{ fontSize: 13, lineHeight: 2 }}>
        <li>Displays the <strong>CCV schedule</strong> — which products are due for their next CCV run and when.</li>
        <li>Shows the last completed CCV date, next due date, and run frequency per product.</li>
        <li>Allows recording a <strong>completion date</strong> inline (password confirmation required) to mark a lifecycle event as done.</li>
        <li>Progress bars indicate what percentage of scheduled runs have been completed.</li>
      </ul>
      <h4 style={{ margin: "14px 0 8px", color: "#004f9f" }}>DEHT Tab</h4>
      <ul style={{ fontSize: 13, lineHeight: 2 }}>
        <li>Embeds the DEHT module within the lifecycle view for integrated hold time and efficacy management.</li>
      </ul>
      <h4 style={{ margin: "14px 0 8px", color: "#004f9f" }}>CCV Tab</h4>
      <ul style={{ fontSize: 13, lineHeight: 2 }}>
        <li>Provides quick access to the Continuous Cleaning Verification run form directly from the lifecycle context.</li>
      </ul>
      <p style={{ background: "#e8f0fe", border: "1px solid #c2d4f8", borderRadius: 6, padding: "8px 12px", fontSize: 13 }}>
        <strong>Tip:</strong> Use Life Cycle Management as your daily dashboard for ongoing validation compliance — it shows what needs attention across all products at a glance.
      </p>
    </>
  ),

  genotoxic: (
    <>
      <p>
        The <strong>Genotoxic / Nitrosamine Impurity</strong> module manages ICH M7 and EMA nitrosamine
        impurity risk assessments. It maps impurities to source products and equipment, calculates
        equipment-level rinse and swab acceptance limits, and integrates result entry into cleaning
        validation and periodic CCV reports.
      </p>

      <h4 style={{ margin: "14px 0 8px", color: "#004f9f" }}>Workflow</h4>
      <ol style={{ fontSize: 13, lineHeight: 2 }}>
        <li>Select a <strong>Facility</strong> and <strong>Source Product</strong>.</li>
        <li>Go to the <strong>Impurity Mapping</strong> tab and click <em>Add Impurity</em>.</li>
        <li>Enter the impurity name, PDE (µg/day), analytical method, LOD, LOQ, and select the equipment it applies to.</li>
        <li>Switch to the <strong>Calculated Limits</strong> tab — limits auto-calculate for every target product / equipment combination.</li>
        <li>Limits flow automatically into the <strong>Protocol & Report</strong> and <strong>Periodic CCV</strong> report forms, where analysts enter rinse and swab results per run.</li>
      </ol>

      <h4 style={{ margin: "14px 0 8px", color: "#004f9f" }}>MACO Formula for Genotoxic Impurities</h4>
      <table style={tableStyle}>
        <thead><tr><th style={thStyle}>Parameter</th><th style={thStyle}>Details</th></tr></thead>
        <tbody>
          {[
            ["Formula", "MACO (mg) = (PDE µg/day × Min Yield kg × 1,000) ÷ Max Daily Dose mg"],
            ["PDE Unit", "µg/day (note: 1,000× smaller than product PDE which is mg/day)"],
            ["Rinse Limit", "(MACO × 9 in²) ÷ (surface area in² × rinse volume L) → ppm"],
            ["Swab Limit", "(MACO × 9 in² × 100) ÷ surface area in² → ppm"],
            ["Precision", "Values rounded to 6 decimal places; values < 0.0001 ppm displayed in scientific notation"],
          ].map(([p, d], i) => (
            <tr key={i} style={{ background: i % 2 === 1 ? "#f8fafc" : "white" }}>
              <td style={{ ...tdStyle, fontWeight: 600, whiteSpace: "nowrap" }}>{p}</td><td style={tdStyle}>{d}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h4 style={{ margin: "14px 0 8px", color: "#004f9f" }}>Impurity Mapping Tab</h4>
      <ul style={{ fontSize: 13, lineHeight: 2 }}>
        <li>Lists all impurities mapped to the selected facility / product combination.</li>
        <li><strong>Add / Edit / Delete</strong> impurities via modal dialogs (delete requires password confirmation).</li>
        <li>Equipment multi-select: choose all pieces the impurity is relevant to for a given source product.</li>
        <li>Analytical method, LOD, and LOQ are stored for traceability but do not affect limit calculations.</li>
      </ul>

      <h4 style={{ margin: "14px 0 8px", color: "#004f9f" }}>Calculated Limits Tab</h4>
      <ul style={{ fontSize: 13, lineHeight: 2 }}>
        <li>Limits are calculated for <strong>every target product</strong> manufactured on the same equipment — not just the mapped source product.</li>
        <li>Each row shows: Target Product, MACO (mg), Equipment, Rinse Limit (ppm), Swab Limit (ppm), and PASS/FAIL vs. LOQ.</li>
        <li>The <strong>governing limit</strong> (lowest across all target products per equipment) is used in the report form.</li>
      </ul>

      <h4 style={{ margin: "14px 0 8px", color: "#004f9f" }}>Result Entry in Reports</h4>
      <p style={{ fontSize: 13 }}>
        When genotoxic impurities are mapped for a product, a <strong>Genotoxic / Nitrosamine Impurity Results</strong> table
        appears automatically in the cleaning validation report entry form (§4 of the archived report).
        Each impurity shows governing rinse and swab limits, and analysts enter Inspection Lot No. and Result (ppm)
        per run. Live <strong>PASS / FAIL</strong> badges appear as values are typed.
        Results are saved with the report and frozen in the archive snapshot.
      </p>

      <h4 style={{ margin: "14px 0 8px", color: "#004f9f" }}>Regulatory Basis</h4>
      <table style={tableStyle}>
        <thead><tr><th style={thStyle}>Guideline</th><th style={thStyle}>Application</th></tr></thead>
        <tbody>
          {[
            ["ICH M7", "Genotoxic impurity assessment and TTC-based acceptable intakes"],
            ["EMA/409815/2020", "Nitrosamine impurity risk evaluation (NDMA, NDEA, NMBA, etc.)"],
            ["EMA 2022 CPCA", "Carcinogenic Potency Categorisation Approach for nitrosamines"],
          ].map(([g, a], i) => (
            <tr key={i} style={{ background: i % 2 === 1 ? "#f8fafc" : "white" }}>
              <td style={{ ...tdStyle, fontWeight: 600 }}>{g}</td><td style={tdStyle}>{a}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <p style={{ background: "#e8f0fe", border: "1px solid #c2d4f8", borderRadius: 6, padding: "8px 12px", fontSize: 13, marginTop: 12 }}>
        <strong>Tip:</strong> Surface area and rinse volume must be configured on the Equipment page for rinse limits to calculate.
        Swab limits can still be generated without a rinse volume.
      </p>
    </>
  ),

  audit: (
    <>
      <p>
        The <strong>Audit Log</strong> is an immutable, append-only record of every action
        performed in the system. It cannot be modified by any user.
      </p>
      <h4 style={{ margin: "14px 0 8px", color: "#004f9f" }}>What is Recorded</h4>
      <ul style={{ fontSize: 13, lineHeight: 2 }}>
        <li>Every <strong>CREATE, UPDATE, DELETE</strong> on facilities, equipment, products, protocols, validation reports, CCV runs, DEHT records, users, and policy changes.</li>
        <li>The <strong>user</strong> who performed the action and the exact <strong>timestamp</strong>.</li>
        <li><strong>Before and after values</strong> for update operations.</li>
      </ul>
      <h4 style={{ margin: "14px 0 8px", color: "#004f9f" }}>Filtering</h4>
      <ul style={{ fontSize: 13, lineHeight: 2 }}>
        <li>Filter by <strong>date range</strong>, <strong>user</strong>, or <strong>action type</strong> (Create / Update / Delete).</li>
        <li>Filter by <strong>entity type</strong> (e.g. Product, Equipment, Protocol).</li>
        <li>Export filtered results to CSV for regulatory submissions.</li>
      </ul>
      <p style={{ background: "#d4edda", border: "1px solid #c3e6cb", borderRadius: 6, padding: "8px 12px", fontSize: 13 }}>
        <strong>Regulatory note:</strong> The audit log satisfies 21 CFR Part 11 and EU Annex 11 requirements for electronic records in pharmaceutical systems.
      </p>
    </>
  ),

  query: (
    <>
      <div style={{ background: "#fff3cd", border: "1px solid #ffc107", borderRadius: 8, padding: "14px 16px", marginBottom: 16 }}>
        <strong>NLP Query — Coming Soon</strong>
        <p style={{ margin: "6px 0 0", fontSize: 13 }}>
          The plain-English query interface is currently under development and will be available in a future release.
        </p>
      </div>
      <h4 style={{ margin: "14px 0 8px", color: "#004f9f" }}>Planned Capability</h4>
      <p style={{ fontSize: 13 }}>
        The NLP Query module will allow users to ask plain-English questions about their data.
        The system will interpret the question and return results as text, tables, or bar charts.
      </p>
      <h4 style={{ margin: "14px 0 8px", color: "#004f9f" }}>Example Questions (Planned)</h4>
      <ul style={{ fontSize: 13, lineHeight: 2 }}>
        <li>List all facilities</li>
        <li>How many products are registered?</li>
        <li>Show audit logs for last week</li>
        <li>What is the MACO limit for Product A on Equipment B?</li>
        <li>List CCV runs for Paracetamol in 2026</li>
      </ul>
    </>
  ),

  policy: (
    <>
      <p>
        The <strong>Calculation Policy</strong> (Admin only) sets the global MACO methodology
        used in the Matrix, Protocol, and all downstream calculations.
        Changes require admin password confirmation and are recorded in the Audit log.
      </p>
      <h4 style={{ margin: "14px 0 8px", color: "#004f9f" }}>Available Policies</h4>
      <table style={tableStyle}>
        <thead><tr><th style={thStyle}>Policy</th><th style={thStyle}>Description</th></tr></thead>
        <tbody>
          {[
            ["All Methods — Most Conservative", "Computes PDE-based, Dose-based, and 10 ppm; the smallest value governs"],
            ["PDE / ADE Based Only", "Uses Permitted Daily Exposure (EMA guideline EMA/CHMP/CVMP/SWP/169430/2012)"],
            ["Dose Based Only (1/1000th)", "Traditional 1/1000th of minimum therapeutic dose method"],
            ["10 ppm Criterion Only", "General 10 ppm limit based on batch size"],
            ["PDE + Dose — Most Conservative", "Both PDE and Dose methods; smaller value governs"],
            ["PDE + 10 ppm — Most Conservative", "PDE and 10 ppm methods; smaller value governs"],
          ].map(([p, d], i) => (
            <tr key={i} style={{ background: i % 2 === 1 ? "#f8fafc" : "white" }}>
              <td style={{ ...tdStyle, fontWeight: 600 }}>{p}</td><td style={tdStyle}>{d}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p style={{ fontSize: 13, marginTop: 10 }}>
        The active policy is shown on the Matrix and Protocol pages. Changing the policy does not
        retroactively alter archived protocol snapshots — only new calculations use the updated policy.
      </p>
    </>
  ),

  retention: (
    <>
      <p>
        The <strong>Data Retention Policy</strong> (Admin only) configures how long records are
        kept in the active database before being moved to an archive. This supports data lifecycle
        management and regulatory record-keeping requirements.
      </p>
      <h4 style={{ margin: "14px 0 8px", color: "#004f9f" }}>Configurable Categories</h4>
      <table style={tableStyle}>
        <thead><tr><th style={thStyle}>Data Category</th><th style={thStyle}>Default Retention</th></tr></thead>
        <tbody>
          {[
            ["Audit Logs", "7 years"],
            ["Validation Reports", "7 years"],
            ["CCV Runs", "5 years"],
            ["DEHT Records", "5 years"],
            ["Protocol Archives", "10 years"],
            ["User Records", "3 years after deactivation"],
          ].map(([c, d], i) => (
            <tr key={i} style={{ background: i % 2 === 1 ? "#f8fafc" : "white" }}>
              <td style={{ ...tdStyle, fontWeight: 600 }}>{c}</td><td style={tdStyle}>{d}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <h4 style={{ margin: "14px 0 8px", color: "#004f9f" }}>How It Works</h4>
      <ul style={{ fontSize: 13, lineHeight: 2 }}>
        <li>Records older than the configured threshold are moved to the archive database during the next scheduled cleanup run.</li>
        <li>Archived records remain searchable and are not deleted.</li>
        <li>The <strong>Auto Cleanup</strong> toggle enables automatic archiving without manual intervention.</li>
        <li>Policy changes require admin password confirmation and are logged in the Audit trail.</li>
      </ul>
      <p style={{ background: "#f8d7da", border: "1px solid #f5c6cb", borderRadius: 6, padding: "8px 12px", fontSize: 13 }}>
        <strong>Caution:</strong> Setting a retention period to "Never archive" keeps all records permanently in the active database. Use this only for categories where indefinite active access is required.
      </p>
    </>
  ),

  users: (
    <>
      <p>Administrators manage user accounts and role assignments from this page.</p>
      <h4 style={{ margin: "14px 0 8px", color: "#004f9f" }}>Available Roles</h4>
      <table style={tableStyle}>
        <thead><tr><th style={thStyle}>Role</th><th style={thStyle}>Permissions</th></tr></thead>
        <tbody>
          {[
            ["ADMIN", "Full access — user management, policy changes, all deletions, approvals, and all read/write operations"],
            ["QA", "Can approve validation reports and DEHT protocols, delete CCV runs and reports (with password). Cannot manage users or change policies."],
            ["USER", "Read and write access — can add master data, generate protocols, submit reports and CCV runs. Cannot approve, delete, or manage users."],
          ].map(([r, p], i) => (
            <tr key={i} style={{ background: i % 2 === 1 ? "#f8fafc" : "white" }}>
              <td style={{ ...tdStyle, fontWeight: 600, color: "#004f9f" }}>{r}</td><td style={tdStyle}>{p}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <h4 style={{ margin: "14px 0 8px", color: "#004f9f" }}>Admin Actions</h4>
      <ul style={{ fontSize: 13, lineHeight: 2 }}>
        <li><strong>Create User:</strong> Enter username, initial password, and role.</li>
        <li><strong>Reset Password:</strong> Admin can reset any user's password without knowing their current password.</li>
        <li><strong>Change Role:</strong> Upgrade or downgrade a user's role at any time.</li>
        <li><strong>Delete User:</strong> Removes login access. Audit log entries created by that user are retained.</li>
      </ul>
      <p style={{ background: "#e8f0fe", border: "1px solid #c2d4f8", borderRadius: 6, padding: "8px 12px", fontSize: 13 }}>
        <strong>Note:</strong> New users are prompted to change their password on first login. Password expiry warnings appear 7 days before expiration.
      </p>
    </>
  ),

  faq: <FAQContent />,
};

// ── Main Component ──────────────────────────────────────────────────────────
function HelpPage({ goHome }) {
  const [active, setActive] = useState("overview");
  const [search, setSearch] = useState("");

  const filteredItems = search.trim()
    ? allSections.filter(s => s.title.toLowerCase().includes(search.toLowerCase()))
    : null;

  const currentTitle = allSections.find(s => s.id === active)?.title || "";

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.headerRow}>
        <img src={logo} alt="Cipla" style={{ height: 36, marginRight: 10, filter: "brightness(0) invert(1)" }} />
        <span style={{ color: "white", fontWeight: "bold", fontSize: 17, flex: 1 }}>Help &amp; User Guide</span>
        <button style={styles.backBtn} onClick={goHome}>← Back to Home</button>
      </div>

      <div style={styles.body}>
        {/* Sidebar */}
        <nav style={styles.sidebar}>
          <input
            type="text"
            placeholder="Search topics…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={styles.searchBox}
          />
          {filteredItems ? (
            filteredItems.length === 0
              ? <p style={{ fontSize: 12, color: "#94a3b8", padding: "6px 8px" }}>No results</p>
              : filteredItems.map(s => (
                  <button key={s.id} onClick={() => { setActive(s.id); setSearch(""); }}
                    style={active === s.id ? styles.navItemActive : styles.navItem}>
                    <span style={{ marginRight: 6 }}>{s.icon}</span>{s.title}
                  </button>
                ))
          ) : navGroups.map((grp, gi) => (
            <div key={gi} style={{ marginBottom: 10 }}>
              <div style={styles.groupLabel}>{grp.label}</div>
              {grp.items.map(s => (
                <button key={s.id} onClick={() => setActive(s.id)}
                  style={active === s.id ? styles.navItemActive : styles.navItem}>
                  <span style={{ marginRight: 6 }}>{s.icon}</span>{s.title}
                </button>
              ))}
            </div>
          ))}
        </nav>

        {/* Content */}
        <div style={styles.panel}>
          <h3 style={styles.panelTitle}>{currentTitle}</h3>
          <div style={styles.panelContent}>
            {sectionContent[active] || <p style={{ color: "#94a3b8" }}>Select a topic from the sidebar.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: {
    padding: "12px 16px 52px",
    fontFamily: "'Segoe UI', Arial, sans-serif",
    background: "#f1f5f9",
    minHeight: "100vh",
  },
  headerRow: {
    display: "flex",
    alignItems: "center",
    background: "#004f9f",
    padding: "8px 14px",
    borderRadius: 8,
    marginBottom: 14,
    gap: 10,
  },
  backBtn: {
    padding: "5px 12px",
    borderRadius: 6,
    border: "none",
    background: "white",
    color: "#004f9f",
    fontWeight: "bold",
    cursor: "pointer",
    fontSize: 12,
    flexShrink: 0,
  },
  body: {
    display: "flex",
    gap: 16,
    alignItems: "flex-start",
  },
  sidebar: {
    display: "flex",
    flexDirection: "column",
    gap: 2,
    width: 200,
    flexShrink: 0,
    background: "white",
    borderRadius: 10,
    padding: "10px 8px",
    boxShadow: "0 2px 8px rgba(0,0,0,0.07)",
    maxHeight: "80vh",
    overflowY: "auto",
  },
  searchBox: {
    padding: "7px 10px",
    borderRadius: 6,
    border: "1px solid #e2e8f0",
    fontSize: 12,
    marginBottom: 8,
    width: "100%",
    boxSizing: "border-box",
    outline: "none",
  },
  groupLabel: {
    fontSize: 10,
    fontWeight: "bold",
    color: "#94a3b8",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
    padding: "2px 8px 4px",
  },
  navItem: {
    textAlign: "left",
    padding: "8px 10px",
    border: "none",
    background: "transparent",
    borderRadius: 6,
    cursor: "pointer",
    fontSize: 12.5,
    color: "#374151",
    display: "flex",
    alignItems: "center",
    width: "100%",
  },
  navItemActive: {
    textAlign: "left",
    padding: "8px 10px",
    border: "none",
    background: "#e8f0fe",
    borderRadius: 6,
    cursor: "pointer",
    fontSize: 12.5,
    color: "#004f9f",
    fontWeight: "bold",
    display: "flex",
    alignItems: "center",
    width: "100%",
  },
  panel: {
    flex: 1,
    background: "white",
    borderRadius: 10,
    padding: "20px 24px",
    boxShadow: "0 2px 8px rgba(0,0,0,0.07)",
    minHeight: 400,
  },
  panelTitle: {
    margin: "0 0 14px",
    color: "#004f9f",
    borderBottom: "2px solid #e2e8f0",
    paddingBottom: 10,
    fontSize: 18,
  },
  panelContent: {
    fontSize: 13.5,
    color: "#222",
    lineHeight: 1.75,
  },
};

export default HelpPage;
