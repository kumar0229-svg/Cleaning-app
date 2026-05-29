import React, { useState } from "react";
import logo from "./assets/falcon-logo.svg";

const tableStyle = { borderCollapse: "collapse", width: "100%", fontSize: 13 };
const thStyle = { padding: "8px 10px", textAlign: "left", border: "1px solid #ddd" };
const tdStyle = { padding: "8px 10px", border: "1px solid #ddd", verticalAlign: "top" };
const faqItemStyle = {
  background: "#f8fafc",
  border: "1px solid #e2e8f0",
  borderRadius: 8,
  padding: "10px 14px",
  marginBottom: 10,
};

const faqGroups = [
  {
    group: "MACO Calculations",
    items: [
      {
        q: "Which MACO value should I use when multiple methods are calculated?",
        a: "Always use the governing (lowest / most restrictive) value, highlighted in green. This is the limit that must be met to protect the next product's patient.",
      },
      {
        q: "What units does the system use throughout?",
        a: "Therapeutic doses in mg, batch sizes in kg, surface area in cm², MACO results in µg, and rinse/swab acceptance limits in ppm (µg/mL or µg/cm²).",
      },
      {
        q: "What is the difference between TD-based, PDE-based, and 10 ppm methods?",
        a: "TD-based uses 1/1000th of the minimum therapeutic dose of the previous product scaled to the next product's batch. PDE-based uses the Permitted Daily Exposure (EMA guideline). The 10 ppm criterion is a general acceptance criterion based on batch size. The system computes all applicable methods and selects the most restrictive.",
      },
      {
        q: "When is a PDE value required?",
        a: "PDE is optional. If provided for the previous product, the system includes a PDE-based MACO alongside the dose-based calculation. If omitted, only dose-based and 10 ppm methods are used.",
      },
      {
        q: "How is the surface area limit (µg/cm²) derived?",
        a: "It is calculated by dividing the governing MACO (µg) by the shared surface area (cm²) of the selected equipment. This value is used for swab acceptance criteria.",
      },
      {
        q: "Can I change which calculation method governs across the system?",
        a: "Yes. An ADMIN user can set the global Calculation Policy from the Policy page. Changes are password-protected and recorded in the Audit log.",
      },
      {
        q: "Why does the MACO differ between two protocol runs for the same product pair?",
        a: "MACO is sensitive to batch size and dose values. If either product's data was edited between runs, the result will differ. Always re-generate the protocol after updating product data.",
      },
    ],
  },
  {
    group: "Products & Equipment",
    items: [
      {
        q: "What product data is required for MACO calculations?",
        a: "Batch size (kg), minimum therapeutic dose (mg), and maximum daily dose (mg/day) are mandatory. PDE (mg/day) is optional but enables the PDE-based MACO method when provided.",
      },
      {
        q: "Can I add the same product to multiple facilities?",
        a: "Products are global (not facility-specific). Equipment is assigned per facility, and protocols are generated per facility. The same product can appear in protocols for multiple facilities.",
      },
      {
        q: "What is the 2D Structure panel on the Product page?",
        a: "When you type a product name, the system queries PubChem to find a matching compound, retrieves its CAS registry number, and displays the 2D chemical structure image with a rotating animation. The CAS number is shown as a badge below the structure.",
      },
      {
        q: "Why is the CAS number or structure not showing for my product?",
        a: "PubChem may not have an exact match for the name entered. Try the INN (international nonproprietary name) or common chemical name. The structure panel is informational only and does not affect calculations.",
      },
      {
        q: "What is equipment surface area used for?",
        a: "Surface area (cm²) is used to convert the MACO (µg) into a swab acceptance limit (µg/cm²). If surface area is not entered, the swab limit column will show 'N/A'.",
      },
      {
        q: "Can I delete a product that is already used in a protocol?",
        a: "ADMIN users can delete a product, but be aware that existing archived protocols that reference the product will retain its data in the frozen snapshot. Deleting the product removes it from future protocol generation.",
      },
    ],
  },
  {
    group: "Protocol & Validation Report",
    items: [
      {
        q: "What is a protocol archive?",
        a: "A protocol archive is a frozen, version-stamped snapshot of the protocol at the time it was saved. It captures product data, MACO calculations, equipment, and sampling plan so the record cannot be changed by future edits.",
      },
      {
        q: "How is the protocol document number generated?",
        a: "Document numbers follow the format CL-PROTO-[ProductID]-[Year], e.g. CL-PROTO-0001-2026. Each new archive for the same document number increments the version.",
      },
      {
        q: "How many cycles does a cleaning validation report cover?",
        a: "Each validation report covers exactly 3 cleaning cycles (runs). Each run captures rinse and swab results for every piece of equipment in the protocol.",
      },
      {
        q: "Can I submit a partial report (only some cycles filled)?",
        a: "Yes — the system does not force all result fields to be filled before submission. However, any blank result fields will show no PASS/FAIL status in the final report.",
      },
      {
        q: "Who can approve a validation report?",
        a: "Users with the QA or ADMIN role. On the Protocol & Report page, find the report in the list, click Approve, and confirm with your password. The approver's name and timestamp are recorded permanently.",
      },
      {
        q: "Can an approved report be unapproved or edited?",
        a: "No. Approval is a one-way action to maintain data integrity. If a correction is needed, delete the report (ADMIN/QA only) and re-submit a corrected version.",
      },
      {
        q: "What happens if I delete an approved report that has CCV runs linked to it?",
        a: "The CCV runs are not automatically deleted; they retain their stored data. However, the product will no longer appear in the eligible CCV product list if no other approved report exists for it.",
      },
      {
        q: "Why does the equipment table in my report show no rows?",
        a: "The equipment table is populated from the protocol archive snapshot. If the archive was saved before equipment was added, or the archive_id is mismatched, the table will be empty. Re-generate and re-archive the protocol to pick up new equipment.",
      },
    ],
  },
  {
    group: "Continuous Cleaning Verification (CCV)",
    items: [
      {
        q: "What is the difference between a Validation Report and a CCV run?",
        a: "A validation report is the initial, formal 3-cycle study that establishes that a cleaning process is effective. CCV runs are ongoing, single-cycle monitoring records that demonstrate continued cleaning effectiveness during routine manufacturing.",
      },
      {
        q: "Why is a product not showing in the CCV eligible product list?",
        a: "A product only appears in CCV when it has at least one Approved validation report. Go to the Protocol & Report page, find the report, and approve it.",
      },
      {
        q: "Can I enter multiple CCV runs for the same product?",
        a: "Yes. Each submission creates a new run (Run 1, Run 2, …). The run number is assigned automatically based on the total number of CCV runs already recorded for that product.",
      },
      {
        q: "Where does the equipment and swab location list in CCV come from?",
        a: "Equipment is derived from the approved protocol archive snapshot. Swab sampling locations are pulled from the live sampling plan for each equipment category — so newly added sampling entries will appear in future CCV runs.",
      },
      {
        q: "What limits are shown in the CCV results table?",
        a: "The governing MACO limit from the approved validation protocol — the most restrictive value across all product pairs in that protocol. This is the same limit used in the validation report.",
      },
      {
        q: "Does a CCV run require all result fields to be filled?",
        a: "No, but any empty result field will show no status badge. It is recommended to complete all fields before submission to ensure full traceability.",
      },
      {
        q: "Can a CCV run be edited after submission?",
        a: "Direct editing of a submitted CCV run is not available from the UI. To correct a run, delete it (QA/ADMIN, password required) and re-submit with the correct data.",
      },
      {
        q: "Can I print a CCV run as a PDF?",
        a: "Yes. Open the run from the View Runs tab and click Print / Export PDF. This opens a print-formatted version that can be saved as PDF using the browser's print-to-PDF feature.",
      },
    ],
  },
  {
    group: "Sampling Plan",
    items: [
      {
        q: "What is the sampling plan used for?",
        a: "The sampling plan defines swab locations for each equipment category. When a protocol or CCV run is loaded, the system uses these entries to generate the swab rows in the results table.",
      },
      {
        q: "If I add new swab locations after a protocol is archived, will they appear in existing reports?",
        a: "No for existing validation report cycles — those results tables are built when the report is first loaded from the archive. Yes for CCV runs — swab entries are fetched live from the sampling plan each time a CCV run form is opened.",
      },
      {
        q: "How are swab locations identified in the results table?",
        a: "Each swab row shows a Sample Number (e.g. S-01) and a Location Description (e.g. inner surface, discharge port). Both come from the sampling plan entry for that equipment category.",
      },
    ],
  },
  {
    group: "User Roles & Access",
    items: [
      {
        q: "What roles are available in the system?",
        a: "ADMIN (full access including user management, policy changes, and all deletions), QA (can approve reports and delete CCV runs/reports), and USER (read and write access, no deletions or approvals).",
      },
      {
        q: "Can a regular USER submit a validation report?",
        a: "Yes. Any authenticated user can submit a report. Only QA and ADMIN users can approve it.",
      },
      {
        q: "Why can't I see the Approve button on a report?",
        a: "The Approve button is only shown to users with the QA or ADMIN role. If you need to approve reports, ask your administrator to assign you the QA role.",
      },
      {
        q: "What does password confirmation on actions do?",
        a: "Sensitive actions (submit, approve, delete) require you to re-enter your own login password. This confirms the authenticated user is intentionally performing the action and creates a clear audit trail.",
      },
      {
        q: "Can an ADMIN reset another user's password?",
        a: "Yes. From the User Management page, ADMIN users can reset any user's password without knowing the current password.",
      },
      {
        q: "Is there a session timeout?",
        a: "The JWT token issued at login has a fixed expiry. If your session expires you will be redirected to the login screen automatically on the next API request.",
      },
    ],
  },
  {
    group: "Audit Log",
    items: [
      {
        q: "What actions are recorded in the Audit log?",
        a: "Every CREATE, UPDATE, and DELETE on facilities, equipment, products, protocols, validation reports, CCV runs, users, and policy changes is logged with the user, timestamp, and before/after values.",
      },
      {
        q: "Can audit entries be deleted or modified?",
        a: "No. The audit log is append-only and read-only in the UI. It cannot be altered by any user role.",
      },
      {
        q: "How far back does the audit log go?",
        a: "The log retains all entries since the system was first deployed. Use the date-range filter on the Audit page to narrow results.",
      },
      {
        q: "Who can view the audit log?",
        a: "All authenticated users can view the audit log. There is no role restriction on reading audit entries.",
      },
    ],
  },
  {
    group: "Printing & Export",
    items: [
      {
        q: "How do I export a protocol or report as a PDF?",
        a: "Use the Print / Export PDF button on the protocol or report detail view. This opens a print-formatted page in a new tab. In the browser print dialog, set the destination to 'Save as PDF'.",
      },
      {
        q: "The printed document is missing the Falcon logo — why?",
        a: "The logo is embedded as a local asset. If printing from a different machine or browser, ensure the app is served correctly and the assets folder is accessible. The logo loads relative to the application's origin.",
      },
      {
        q: "Can I export all CCV runs at once?",
        a: "Not in bulk currently. Each run must be opened individually and printed. Filter by product on the View Runs tab to locate the runs you need.",
      },
    ],
  },
  {
    group: "System & Technical",
    items: [
      {
        q: "What browsers are supported?",
        a: "The application is tested on modern versions of Chrome, Edge, and Firefox. Internet Explorer is not supported. For best results, use the latest stable release of Chrome or Edge.",
      },
      {
        q: "Why do I see 'Failed to load' errors after the server restarts?",
        a: "The backend runs database migrations on startup. If a new column was added in an update, the first restart after deployment applies those migrations. If the error persists, check the backend console for migration errors and ensure the database user has ALTER TABLE permissions.",
      },
      {
        q: "Is data stored locally or in a central database?",
        a: "All data is stored in the central PostgreSQL database configured by your administrator. Nothing is stored in the browser beyond your login token.",
      },
      {
        q: "What happens if the PubChem or NCI CACTUS API is unavailable?",
        a: "Those panels on the Product page will show a 'Not found' or loading-error message. The APIs are informational only — you can still add, edit, and save products normally without them.",
      },
      {
        q: "Can multiple users work in the system simultaneously?",
        a: "Yes. The system is multi-user. Each user authenticates independently. There is no locking mechanism, so two users editing the same record simultaneously may overwrite each other's changes — coordinate with your team when editing shared master data.",
      },
      {
        q: "How do I report a bug or request a new feature?",
        a: "Contact your system administrator or the development team. Provide the module name, steps to reproduce, and a screenshot if possible.",
      },
    ],
  },
];

function FAQContent() {
  const [openGroup, setOpenGroup] = useState(null);
  const [openItem, setOpenItem]   = useState(null);

  const toggleGroup = (g) => {
    setOpenGroup(prev => prev === g ? null : g);
    setOpenItem(null);
  };
  const toggleItem = (key) => setOpenItem(prev => prev === key ? null : key);

  return (
    <div>
      <p style={{ marginTop: 0, color: "#555", fontSize: 13 }}>
        Click a category to expand it, then click a question to see the answer.
      </p>
      {faqGroups.map((grp, gi) => (
        <div key={gi} style={{ marginBottom: 10, border: "1px solid #e2e8f0", borderRadius: 8, overflow: "hidden" }}>
          <button
            onClick={() => toggleGroup(gi)}
            style={{
              width: "100%", textAlign: "left", padding: "11px 16px",
              background: openGroup === gi ? "#004f9f" : "#f0f4ff",
              color: openGroup === gi ? "white" : "#004f9f",
              border: "none", cursor: "pointer", fontWeight: "bold", fontSize: 14,
              display: "flex", justifyContent: "space-between", alignItems: "center",
            }}
          >
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
                    <button
                      onClick={() => toggleItem(key)}
                      style={{
                        width: "100%", textAlign: "left", padding: "9px 6px",
                        background: "transparent", border: "none", cursor: "pointer",
                        fontWeight: "600", fontSize: 13, color: "#1a1a2e",
                        display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8,
                      }}
                    >
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

const sections = [
  {
    id: "overview",
    title: "Overview",
    content: (
      <>
        <p>
          The <strong>Cleaning Limit Software</strong> helps pharmaceutical teams manage
          cleaning validation by calculating Maximum Allowable Carry-Over (MACO) limits
          between products on shared equipment.
        </p>
        <p>
          Use the home screen cards to navigate between modules. Each module is described
          below.
        </p>
      </>
    ),
  },
  {
    id: "facility",
    title: "Facility",
    content: (
      <>
        <p>Manage manufacturing facilities in your organisation.</p>
        <ul>
          <li><strong>Add</strong> a new facility by entering its name and location, then click <em>Add Facility</em>.</li>
          <li><strong>Edit</strong> a facility by clicking the pencil icon on any row.</li>
          <li><strong>Delete</strong> a facility by clicking the bin icon (admin only).</li>
        </ul>
        <p>Each facility can have multiple pieces of equipment assigned to it.</p>
      </>
    ),
  },
  {
    id: "equipment",
    title: "Equipment",
    content: (
      <>
        <p>Manage equipment pieces linked to a facility.</p>
        <ul>
          <li>Select a facility from the dropdown to filter equipment.</li>
          <li>Provide the equipment name, type, and shared surface area (cm²).</li>
          <li>Surface area is required for surface-area-based MACO calculations.</li>
        </ul>
      </>
    ),
  },
  {
    id: "product",
    title: "Product",
    content: (
      <>
        <p>Manage active pharmaceutical ingredients (APIs) and finished products.</p>
        <ul>
          <li>Enter the product name, batch size (kg), minimum therapeutic dose (mg), maximum daily dose (mg/day), and PDE (mg/day).</li>
          <li>These values are used directly in MACO calculations.</li>
        </ul>
        <h4 style={{ margin: "12px 0 6px" }}>Chemical Structure &amp; CAS Lookup</h4>
        <p>
          When a product name is entered, the system automatically queries external databases
          and displays four information panels side by side:
        </p>
        <table style={tableStyle}>
          <thead>
            <tr style={{ background: "#004f9f", color: "white" }}>
              <th style={thStyle}>Panel</th>
              <th style={thStyle}>Source</th>
              <th style={thStyle}>Information Shown</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={tdStyle}><strong>FDA</strong></td>
              <td style={tdStyle}>FDA OpenFDA API</td>
              <td style={tdStyle}>Drug label information, indications, dosage</td>
            </tr>
            <tr style={{ background: "#f8fafc" }}>
              <td style={tdStyle}><strong>PubChem</strong></td>
              <td style={tdStyle}>PubChem PUG REST</td>
              <td style={tdStyle}>CAS registry number, molecular formula, molecular weight, IUPAC name</td>
            </tr>
            <tr>
              <td style={tdStyle}><strong>2D Structure</strong></td>
              <td style={tdStyle}>PubChem (CID-based image)</td>
              <td style={tdStyle}>2D chemical structure with a rotating 3D-flip animation; CAS number badge below the image</td>
            </tr>
            <tr style={{ background: "#f8fafc" }}>
              <td style={tdStyle}><strong>NCI CACTUS</strong></td>
              <td style={tdStyle}>NCI Chemical Identifier Resolver</td>
              <td style={tdStyle}>SMILES string, InChI key, synonyms</td>
            </tr>
          </tbody>
        </table>
        <p style={{ marginTop: 10 }}>
          All four panels are fetched automatically when you type a product name. If no data
          is found for a panel it shows a "Not found" message — this does not prevent saving the product.
        </p>
      </>
    ),
  },
  {
    id: "matrix",
    title: "Matrix (MACO Calculation)",
    content: (
      <>
        <p>
          The Matrix page shows the product–equipment cleaning matrix. Select a
          <em> Previous Product</em> (the one just manufactured) and a <em>Next Product</em>
          (the one to be manufactured next), along with the shared equipment, to compute the
          MACO.
        </p>
        <h4 style={{ margin: "12px 0 6px" }}>MACO Methods</h4>
        <table style={tableStyle}>
          <thead>
            <tr style={{ background: "#004f9f", color: "white" }}>
              <th style={thStyle}>Method</th>
              <th style={thStyle}>Formula</th>
              <th style={thStyle}>When Used</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={tdStyle}><strong>Therapeutic Dose (TD)</strong></td>
              <td style={tdStyle}>
                MACO = (TDD<sub>prev</sub> / MDD<sub>next</sub>) × Batch<sub>next</sub> × 1000
              </td>
              <td style={tdStyle}>Always computed as baseline</td>
            </tr>
            <tr style={{ background: "#f8fafc" }}>
              <td style={tdStyle}><strong>PDE</strong></td>
              <td style={tdStyle}>
                MACO = (PDE<sub>prev</sub> / MDD<sub>next</sub>) × Batch<sub>next</sub> × 1000
              </td>
              <td style={tdStyle}>When PDE is available for the previous product</td>
            </tr>
            <tr>
              <td style={tdStyle}><strong>Safety Factor (SF)</strong></td>
              <td style={tdStyle}>
                MACO = TDD<sub>prev</sub> × SF × 1000
              </td>
              <td style={tdStyle}>Applied as an additional safety check</td>
            </tr>
          </tbody>
        </table>
        <p style={{ marginTop: 10 }}>
          The <strong>governing (most restrictive)</strong> method is highlighted in green.
          A surface area limit (µg/cm²) is also displayed when equipment area is provided.
        </p>
      </>
    ),
  },
  {
    id: "audit",
    title: "Audit Log",
    content: (
      <>
        <p>The Audit page records every create, update, and delete action performed in the system.</p>
        <ul>
          <li>Filter by date range, user, or action type.</li>
          <li>Each entry shows the entity changed, the action, the user, and the timestamp.</li>
          <li>Audit logs are read-only and cannot be modified.</li>
        </ul>
      </>
    ),
  },
  {
    id: "query",
    title: "NLP Query",
    content: (
      <>
        <p>
          Ask plain-English questions about your data. The system interprets your question
          and returns results as text, a table, or a bar chart.
        </p>
        <h4 style={{ margin: "12px 0 6px" }}>Example Questions</h4>
        <ul>
          <li>List facilities</li>
          <li>List equipment</li>
          <li>List products</li>
          <li>Show audit logs</li>
          <li>How many records</li>
          <li>Show MACO results</li>
        </ul>
        <p>You can also click the quick-pick chips in the Query page to pre-fill a question.</p>
      </>
    ),
  },
  {
    id: "policy",
    title: "Calculation Policy (Admin only)",
    content: (
      <>
        <p>Define the MACO calculation methodology used across the system.</p>
        <p>Administrators select the calculation policy that governs how MACO limits are computed in the Matrix.</p>
        <h4 style={{ margin: "12px 0 6px" }}>Available Policies</h4>
        <ul>
          <li><strong>All Methods — Most Conservative:</strong> Uses PDE-based, Dose-based, and 10 ppm limits; smallest value governs.</li>
          <li><strong>PDE / ADE Based Only:</strong> Uses Permitted Daily Exposure (EMA guideline EMA/CHMP/CVMP/SWP/169430/2012).</li>
          <li><strong>Dose Based Only (1/1000th):</strong> Traditional 1/1000th of minimum therapeutic dose method.</li>
          <li><strong>10 ppm Criterion Only:</strong> General 10 ppm limit based on batch size.</li>
          <li><strong>PDE + Dose — Most Conservative:</strong> Both PDE and Dose methods; smaller value governs.</li>
          <li><strong>PDE + 10 ppm — Most Conservative:</strong> PDE and 10 ppm methods; smaller value governs.</li>
        </ul>
        <p>Changes require admin password confirmation and are recorded in the Audit log.</p>
      </>
    ),
  },
  {
    id: "protocol",
    title: "Protocol & Report",
    content: (
      <>
        <p>Generate protocol documents and MACO matrices for a selected product, and submit cleaning validation reports (3 cycles).</p>
        <h4 style={{ margin: "12px 0 6px" }}>Protocol Generation</h4>
        <ul>
          <li>Select a <em>Facility</em> to filter available products.</li>
          <li>Select a <em>Source Product</em> (the product to generate a protocol for).</li>
          <li>Click <em>Generate Protocol</em> to compute MACO limits against all other products.</li>
          <li>View the matrix showing all product combinations and their MACO calculations.</li>
          <li>Use <em>Print / Export</em> to download or print the protocol document (includes document number, date, and Logo).</li>
        </ul>
        <p>The protocol document is numbered as <code>CL-PROTO-[ProductID]-[Year]</code> for reference and compliance tracking.</p>
        <h4 style={{ margin: "12px 0 6px" }}>Cleaning Validation Report (3 Cycles)</h4>
        <ul>
          <li>A report covers <strong>3 cleaning cycles</strong> (runs). Each cycle captures rinse and swab results per equipment.</li>
          <li>Results are entered against MACO limits; each entry shows a live <strong>PASS / FAIL</strong> status badge.</li>
          <li>Submit a report with password confirmation. Submitted reports are visible in the report list.</li>
        </ul>
        <h4 style={{ margin: "12px 0 6px" }}>Report Approval</h4>
        <p>
          QA and ADMIN users can <strong>approve</strong> a submitted validation report directly from the report list.
          Click the <em>Approve</em> button on any row with status <em>Submitted</em>, enter your password, and confirm.
        </p>
        <table style={tableStyle}>
          <thead>
            <tr style={{ background: "#004f9f", color: "white" }}>
              <th style={thStyle}>Status</th>
              <th style={thStyle}>Meaning</th>
              <th style={thStyle}>Who Can Set</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={tdStyle}><span style={{ background: "#fff3cd", color: "#856404", padding: "2px 8px", borderRadius: 8, fontWeight: "bold", fontSize: 12 }}>Submitted</span></td>
              <td style={tdStyle}>Report has been submitted and is pending review</td>
              <td style={tdStyle}>Any authenticated user (QA / ADMIN)</td>
            </tr>
            <tr style={{ background: "#f8fafc" }}>
              <td style={tdStyle}><span style={{ background: "#d4edda", color: "#155724", padding: "2px 8px", borderRadius: 8, fontWeight: "bold", fontSize: 12 }}>Approved</span></td>
              <td style={tdStyle}>Report reviewed and approved; product becomes eligible for CCV</td>
              <td style={tdStyle}>QA or ADMIN role only</td>
            </tr>
          </tbody>
        </table>
        <p style={{ marginTop: 10 }}>
          <strong>Only approved reports</strong> unlock the product for Continuous Cleaning Verification (CCV) monitoring runs.
        </p>
      </>
    ),
  },
  {
    id: "vmp",
    title: "Validation Master Plan",
    content: (
      <>
        <p>
          The Validation Master Plan (VMP) is a comprehensive document that outlines the strategy and approach for equipment
          and process validation in pharmaceutical manufacturing facilities.
        </p>
        <h4 style={{ margin: "12px 0 6px" }}>Sections</h4>
        <ul>
          <li><strong>Overview:</strong> Document metadata and general information about the validation program.</li>
          <li><strong>Requirements:</strong> Regulatory requirements including FDA CFR, ICH guidelines, and EMA directives.</li>
          <li><strong>Scope & Objectives:</strong> Defines the scope of validation activities and strategic objectives.</li>
          <li><strong>Schedule:</strong> Validation timeline with phases, activities, dates, and responsible parties.</li>
          <li><strong>Resources:</strong> Personnel assignments and equipment/tools required for validation activities.</li>
        </ul>
        <p>Use the <em>Export PDF</em> and <em>Print</em> buttons to generate compliance documentation for regulatory submissions.</p>
      </>
    ),
  },
  {
    id: "users",
    title: "User Management (Admin only)",
    content: (
      <>
        <p>Administrators can manage user accounts from this page.</p>
        <ul>
          <li><strong>Create</strong> new users with a username, password, and role.</li>
          <li>Roles: <code>ADMIN</code> (full access) and <code>USER</code> (read/write, no user management or delete).</li>
          <li><strong>Reset</strong> a user's password or <strong>delete</strong> a user account.</li>
        </ul>
      </>
    ),
  },
  {
    id: "ccv",
    title: "Continuous Cleaning Verification",
    content: (
      <>
        <p>
          The <strong>Continuous Cleaning Verification (CCV)</strong> module supports routine,
          post-validation cleaning monitoring. After a product's 3-cycle validation report has
          been approved, each subsequent production run can be documented here with a single
          cleaning cycle.
        </p>
        <h4 style={{ margin: "12px 0 6px" }}>Eligibility</h4>
        <ul>
          <li>A product appears in the CCV product list only when it has at least one <strong>Approved</strong> validation report.</li>
          <li>If no approved reports exist, approve the relevant report first from the <em>Protocol &amp; Report</em> page.</li>
        </ul>
        <h4 style={{ margin: "12px 0 6px" }}>Entering a New CCV Run</h4>
        <ol>
          <li>Select the <strong>Facility</strong> — only facilities with eligible products are shown.</li>
          <li>Select the <strong>Product</strong> — only products with an approved validation report appear.</li>
          <li>Select the <strong>Approved Report</strong> the run is based on. The run number increments automatically.</li>
          <li>Enter <strong>Batch Number</strong> and <strong>Run Completion Date</strong>.</li>
          <li>Fill in the <strong>equipment results table</strong> — one rinse row and one swab row per sampling location per equipment piece, each with an Inspection Lot Number and Result (ppm). Live PASS / FAIL badges appear as you type.</li>
          <li>Enter <strong>Training Details</strong> and the <strong>SOP reference</strong> followed during cleaning.</li>
          <li>Click <em>Submit CCV Run</em> and confirm with your password.</li>
        </ol>
        <h4 style={{ margin: "12px 0 6px" }}>Results Table Layout</h4>
        <table style={tableStyle}>
          <thead>
            <tr style={{ background: "#004f9f", color: "white" }}>
              <th style={thStyle}>Column</th>
              <th style={thStyle}>Description</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={tdStyle}><strong>Equipment</strong></td>
              <td style={tdStyle}>Equipment name and category; spans all rows (rinse + swabs) for that piece</td>
            </tr>
            <tr style={{ background: "#f8fafc" }}>
              <td style={tdStyle}><strong>Sample</strong></td>
              <td style={tdStyle}><em>Rinse</em> row first, then each swab location (sample number — location description)</td>
            </tr>
            <tr>
              <td style={tdStyle}><strong>Limit (ppm)</strong></td>
              <td style={tdStyle}>Governing MACO limit from the approved validation protocol (most restrictive across all product pairs)</td>
            </tr>
            <tr style={{ background: "#f8fafc" }}>
              <td style={tdStyle}><strong>Insp. Lot No.</strong></td>
              <td style={tdStyle}>Inspection / analytical lot number for traceability</td>
            </tr>
            <tr>
              <td style={tdStyle}><strong>Result (ppm)</strong></td>
              <td style={tdStyle}>Measured residue level entered by the analyst</td>
            </tr>
            <tr style={{ background: "#f8fafc" }}>
              <td style={tdStyle}><strong>Status</strong></td>
              <td style={tdStyle}>Auto-calculated: <span style={{ background: "#d4edda", color: "#155724", padding: "1px 6px", borderRadius: 4, fontWeight: "bold", fontSize: 12 }}>PASS</span> if result ≤ limit, <span style={{ background: "#f8d7da", color: "#721c24", padding: "1px 6px", borderRadius: 4, fontWeight: "bold", fontSize: 12 }}>FAIL</span> otherwise</td>
            </tr>
          </tbody>
        </table>
        <h4 style={{ margin: "14px 0 6px" }}>View Runs</h4>
        <ul>
          <li>Switch to the <em>View Runs</em> tab to see the full run history.</li>
          <li>Filter by facility and/or product, then click <em>Query</em>.</li>
          <li>Click <em>View</em> on any row to open the read-only run detail with the full results table.</li>
          <li>Use <em>Print / Export PDF</em> to generate a printable compliance record.</li>
          <li>QA / ADMIN users can <em>Delete</em> a run (password required; action is irreversible).</li>
        </ul>
      </>
    ),
  },
  {
    id: "faq",
    title: "FAQ",
    content: <FAQContent />,
  },
];

function HelpPage({ goHome }) {
  const [active, setActive] = useState("overview");
  const current = sections.find((s) => s.id === active);

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.headerRow}>
        <img src={logo} alt="Falcon" style={{ width: 44, marginRight: 10 }} />
        <span style={{ color: "white", fontWeight: "bold", fontSize: 17, flex: 1 }}>Help &amp; User Guide</span>
        <button style={styles.backBtn} onClick={goHome}>⬅ Back to Home</button>
      </div>

      <div style={styles.body}>
        {/* Sidebar nav */}
        <nav style={styles.sidebar}>
          {sections.map((s) => (
            <button
              key={s.id}
              style={s.id === active ? styles.navItemActive : styles.navItem}
              onClick={() => setActive(s.id)}
            >
              {s.title}
            </button>
          ))}
        </nav>

        {/* Content panel */}
        <div style={styles.panel}>
          <h3 style={styles.panelTitle}>{current.title}</h3>
          <div style={styles.panelContent}>{current.content}</div>
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
    gap: 20,
    alignItems: "flex-start",
  },
  sidebar: {
    display: "flex",
    flexDirection: "column",
    gap: 4,
    width: 190,
    flexShrink: 0,
    background: "white",
    borderRadius: 10,
    padding: "10px 8px",
    boxShadow: "0 2px 8px rgba(0,0,0,0.07)",
  },
  navItem: {
    textAlign: "left",
    padding: "9px 12px",
    border: "none",
    background: "transparent",
    borderRadius: 6,
    cursor: "pointer",
    fontSize: 13,
    color: "#333",
  },
  navItemActive: {
    textAlign: "left",
    padding: "9px 12px",
    border: "none",
    background: "#e8f0fe",
    borderRadius: 6,
    cursor: "pointer",
    fontSize: 13,
    color: "#004f9f",
    fontWeight: "bold",
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
  },
  panelContent: {
    fontSize: 14,
    color: "#222",
    lineHeight: 1.7,
  },
};

export default HelpPage;
