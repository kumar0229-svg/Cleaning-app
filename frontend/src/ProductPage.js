import React, { useState, useEffect, useRef } from "react";
import api from "./api";
import logo from "./assets/falcon-logo.svg";

// ─── WHO ATC Classification (Level 1) ─────────────────────────────────────────
const ATC_DEFAULT = [
  "A — Alimentary tract and metabolism",
  "B — Blood and blood forming organs",
  "C — Cardiovascular system",
  "D — Dermatologicals",
  "G — Genito-urinary system and sex hormones",
  "H — Systemic hormonal preparations, excl. sex hormones and insulins",
  "J — Antiinfectives for systemic use",
  "L — Antineoplastic and immunomodulating agents",
  "M — Musculo-skeletal system",
  "N — Nervous system",
  "P — Antiparasitic products, insecticides and repellents",
  "R — Respiratory system",
  "S — Sensory organs",
  "V — Various",
];

const ROA_OPTIONS = [
  "Oral",
  "Parenteral",
  "Respiratory",
  "Topical / Transdermal",
  "Rectal / Vaginal",
  "Other",
];

const USP_OPTIONS = [
  { value: "1", label: "1 — Very Soluble (<1 part)" },
  { value: "2", label: "2 — Freely Soluble (1–10 parts)" },
  { value: "3", label: "3 — Soluble (10–30 parts)" },
  { value: "4", label: "4 — Sparingly Soluble (30–100 parts)" },
  { value: "5", label: "5 — Slightly Soluble (100–1000 parts)" },
  { value: "6", label: "6 — Very Slightly Soluble (1000–10000 parts)" },
  { value: "7", label: "7 — Practically Insoluble (>10000 parts)" },
];

const PRODUCT_TYPES = ["API", "Intermediate", "KSM"];

const API_STEPS = [
  { id: "identity",    label: "Identity" },
  { id: "clinical",    label: "Clinical" },
  { id: "synthesis",   label: "Synthesis" },
  { id: "dosage",      label: "Dosage" },
  { id: "batch",       label: "Batch" },
  { id: "analytical",  label: "Analytical" },
  { id: "equipment",   label: "Equipment" },
  { id: "review",      label: "Review" },
];

const NON_API_STEPS = [
  { id: "identity",    label: "Identity" },
  { id: "synthesis",   label: "Synthesis" },
  { id: "batch",       label: "Batch" },
  { id: "analytical",  label: "Analytical" },
  { id: "equipment",   label: "Equipment" },
  { id: "review",      label: "Review" },
];

const BLANK_SYNTH = { step_name: "", iupac_name: "", soluble_solvent: "", solubility_usp: "", analytical_method: "", lod_ppm: "", loq_ppm: "" };

function ProductPage({ goHome, currentUser }) {

  // ─── Tab ──────────────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState("add");

  // ─── Wizard step ──────────────────────────────────────────────────────────────
  const [wizardStepIndex, setWizardStepIndex] = useState(0);

  // ─── Add form fields ──────────────────────────────────────────────────────────
  const [name, setName]                              = useState("");
  const [productCategory, setProductCategory]        = useState("");
  const [therapeuticCategory, setTherapeuticCategory] = useState("");
  const [routeOfAdmin, setRouteOfAdmin]              = useState("");
  const [finalProductId, setFinalProductId]          = useState("");
  const [synthSteps, setSynthSteps]                  = useState([{ ...BLANK_SYNTH }]);
  const [solubleSolvent, setSolubleSolvent]           = useState("");
  const [solubilityUsp, setSolubilityUsp]             = useState("");
  const [minDose, setMinDose]                        = useState("");
  const [maxDose, setMaxDose]                        = useState("");
  const [pdeValues, setPdeValues]                    = useState({}); // { "Oral": "1.5", "Parenteral": "0.8" }
  const [minYieldKg, setMinYieldKg]                  = useState("");
  const [maxBatchKg, setMaxBatchKg]                  = useState("");
  const [analyticalMethod, setAnalyticalMethod]      = useState("");
  const [lodPpm, setLodPpm]                          = useState("");
  const [loqPpm, setLoqPpm]                          = useState("");
  const [casNumber, setCasNumber]                    = useState("");
  const [chemicalNumber, setChemicalNumber]          = useState("");
  const [facilityId, setFacilityId]                  = useState("");
  const [selectedEquipment, setSelectedEquipment]    = useState([]);
  // Per-step equipment mapping: [{ step_index, step_name, test_compound, equipment_ids, is_product }]
  const [stepEquipmentMap, setStepEquipmentMap]      = useState([]);
  // Sequence for shared equipment: { equipment_id: [step_index, ...] } ordered by usage
  const [equipmentSequence, setEquipmentSequence]    = useState({});
  // Compounds selected for testing in review: { equipment_id: [step_index, ...] }
  const [reviewTestCompounds, setReviewTestCompounds] = useState({});
  const [addPassword, setAddPassword]                = useState("");
  const [addLoading, setAddLoading]                  = useState(false);

  // ─── ATC custom ───────────────────────────────────────────────────────────────
  const [atcCustom, setAtcCustom]    = useState([]);
  const [newAtcInput, setNewAtcInput] = useState("");

  // ─── All products (Intermediate → API mapping) ────────────────────────────────
  const [allProducts, setAllProducts] = useState([]);

  // ─── Equipment ────────────────────────────────────────────────────────────────
  const [equipmentList, setEquipmentList] = useState([]);

  // ─── View Products ────────────────────────────────────────────────────────────
  const [viewFacilityId, setViewFacilityId] = useState("");
  const [viewProducts, setViewProducts]     = useState([]);
  const [viewQueried, setViewQueried]       = useState(false);
  const [viewLoading, setViewLoading]       = useState(false);

  // ─── Product Overview ─────────────────────────────────────────────────────────
  const [ovFacilityId, setOvFacilityId]       = useState("");
  const [ovProducts, setOvProducts]           = useState([]);
  const [ovLoading, setOvLoading]             = useState(false);
  const [mapModal, setMapModal]               = useState(null); // { api: Product }
  const [mapChanges, setMapChanges]           = useState({}); // { productId: newParentId|null }
  const [mapPassword, setMapPassword]         = useState("");
  const [mapReason, setMapReason]             = useState("");
  const [mapSaving, setMapSaving]             = useState(false);

  // ─── History modal ────────────────────────────────────────────────────────────
  const [historyModal, setHistoryModal]       = useState(null);
  const [historyLogs, setHistoryLogs]         = useState([]);
  const [historyLoading, setHistoryLoading]   = useState(false);

  // ─── Steps modal (view synthesis steps) ──────────────────────────────────────
  const [stepsModal, setStepsModal]   = useState(null); // { product_id, product_name }
  const [stepsData, setStepsData]     = useState([]);
  const [stepsLoading, setStepsLoading] = useState(false);

  // ─── Restore modal ────────────────────────────────────────────────────────────
  const [restoreModal, setRestoreModal]       = useState(null);
  const [restorePassword, setRestorePassword] = useState("");
  const [restoreReason, setRestoreReason]     = useState("");
  const [restoreLoading, setRestoreLoading]   = useState(false);

  // ─── Edit modal ───────────────────────────────────────────────────────────────
  const [editModal, setEditModal]           = useState(null);
  const [editForm, setEditForm]             = useState({});
  const [editEquipment, setEditEquipment]   = useState([]);
  const [editSelectedEq, setEditSelectedEq] = useState([]);
  const [editSynthSteps, setEditSynthSteps] = useState([{ ...BLANK_SYNTH }]);
  const [editStepEquipmentMap, setEditStepEquipmentMap] = useState([]);
  const [editEquipmentSequence, setEditEquipmentSequence]     = useState({});
  const [editReviewTestCompounds, setEditReviewTestCompounds] = useState({});
  const [editEquipmentOpen, setEditEquipmentOpen] = useState(false);
  const [editPassword, setEditPassword]     = useState("");
  const [editReason, setEditReason]         = useState("");
  const [editLoading, setEditLoading]       = useState(false);

  // ─── Archive modal ────────────────────────────────────────────────────────────
  const [archiveModal, setArchiveModal]         = useState(null);
  const [archivePassword, setArchivePassword]   = useState("");
  const [archiveReason, setArchiveReason]       = useState("");
  const [archiveLoading, setArchiveLoading]     = useState(false);
  const [archivedProducts, setArchivedProducts] = useState([]);
  const [showArchived, setShowArchived]         = useState(false);
  const [archivedLoading, setArchivedLoading]   = useState(false);

  // ─── Shared ───────────────────────────────────────────────────────────────────
  const [facilities, setFacilities] = useState([]);
  const printRef = useRef();

  // ─── Computed ─────────────────────────────────────────────────────────────────
  const currentSteps = productCategory === "API" ? API_STEPS : NON_API_STEPS;
  const allAtcOptions = [...ATC_DEFAULT, ...atcCustom];
  const isAdmin = currentUser?.role === "ADMIN";

  // ─── Effects ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    fetchFacilities();
    fetchAllProducts();
    fetchAtcCustom();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (facilityId) fetchEquipment(facilityId);
    else setEquipmentList([]);
  }, [facilityId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep equipmentSequence in sync with stepEquipmentMap
  useEffect(() => {
    const usage = {};
    stepEquipmentMap.forEach(m => m.equipment_ids.forEach(eid => {
      if (!usage[eid]) usage[eid] = [];
      usage[eid].push(m.step_index);
    }));
    setEquipmentSequence(prev => {
      const next = {};
      Object.entries(usage).forEach(([eid, stepIndices]) => {
        if (stepIndices.length < 2) return;
        const prevOrder = prev[eid] || [];
        const kept    = prevOrder.filter(si => stepIndices.includes(si));
        const added   = stepIndices.filter(si => !prevOrder.includes(si));
        next[eid] = [...kept, ...added];
      });
      return next;
    });
  }, [stepEquipmentMap]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep editEquipmentSequence in sync with editStepEquipmentMap
  useEffect(() => {
    const usage = {};
    editStepEquipmentMap.forEach(m => m.equipment_ids.forEach(eid => {
      if (!usage[eid]) usage[eid] = [];
      usage[eid].push(m.step_index);
    }));
    setEditEquipmentSequence(prev => {
      const next = {};
      Object.entries(usage).forEach(([eid, stepIndices]) => {
        if (stepIndices.length < 2) return;
        const prevOrder = prev[eid] || [];
        const kept    = prevOrder.filter(si => stepIndices.includes(si));
        const added   = stepIndices.filter(si => !prevOrder.includes(si));
        next[eid] = [...kept, ...added];
      });
      return next;
    });
  }, [editStepEquipmentMap]); // eslint-disable-line react-hooks/exhaustive-deps

  // Pre-select recommended (last-in-sequence) test compounds when wizard reaches Review
  useEffect(() => {
    const { id } = currentSteps[wizardStepIndex] || {};
    if (id !== "review") return;
    setReviewTestCompounds(prev => {
      const next = { ...prev };
      Object.entries(equipmentSequence).forEach(([eid, stepIndices]) => {
        if (!next[eid]) next[eid] = [stepIndices[stepIndices.length - 1]];
      });
      return next;
    });
  }, [wizardStepIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  // Initialise per-step equipment map whenever the wizard reaches the Equipment step
  useEffect(() => {
    const { id } = currentSteps[wizardStepIndex] || {};
    if (id !== "equipment") return;
    const validSteps = synthSteps.filter(s => s.step_name || s.iupac_name);
    // Always include the product itself as the last entry
    const entries = [
      ...validSteps.map(s => ({ step_name: s.step_name, iupac_name: s.iupac_name || "", is_product: false })),
      { step_name: name || "Product", iupac_name: chemicalNumber || name || "", is_product: true },
    ];
    setStepEquipmentMap(prev =>
      entries.map((s, i) => {
        const ex = prev.find(p => p.step_index === i);
        return {
          step_index:               i,
          step_name:                s.step_name || `Step ${i + 1}`,
          test_compound:            ex !== undefined ? ex.test_compound : s.iupac_name,
          equipment_ids:            ex ? ex.equipment_ids : [],
          swab_areas:               ex ? (ex.swab_areas || {}) : {},
          rinse_areas:              ex ? (ex.rinse_areas || {}) : {},
          optional_equipment:       ex ? (ex.optional_equipment || {}) : {},
          optional_equipment_enabled: ex ? (ex.optional_equipment_enabled || {}) : {},
          optional_swab_areas:      ex ? (ex.optional_swab_areas || {}) : {},
          optional_rinse_areas:     ex ? (ex.optional_rinse_areas || {}) : {},
          is_product:               s.is_product,
        };
      })
    );
  }, [wizardStepIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Fetch helpers ────────────────────────────────────────────────────────────
  const fetchFacilities = async () => {
    try { const r = await api.get("/facility/all"); setFacilities(r.data); }
    catch (e) { console.log(e); }
  };

  const fetchAllProducts = async () => {
    try { const r = await api.get("/product/all"); setAllProducts(r.data); }
    catch (e) { console.log(e); }
  };

  const fetchEquipment = async (facId) => {
    try { const r = await api.get(`/equipment/by_facility/${facId}`); setEquipmentList(r.data); }
    catch (e) { console.log(e); }
  };

  const fetchAtcCustom = async () => {
    try { const r = await api.get("/product/atc-categories"); setAtcCustom(r.data.custom || []); }
    catch (e) { console.log(e); }
  };

  // ─── Wizard navigation ────────────────────────────────────────────────────────
  const validateStep = () => {
    const { id } = currentSteps[wizardStepIndex];
    if (id === "identity") {
      if (!name.trim()) { alert("Product name is required ❌"); return false; }
      if (!productCategory) { alert("Product type is required ❌"); return false; }
    }
    if (id === "analytical") {
      const stepsToValidate = [
        ...synthSteps.filter(s => s.step_name || s.iupac_name).map((s, i) => ({
          label: s.step_name || `Step ${i + 1}`,
          method: s.analytical_method, lod: s.lod_ppm, loq: s.loq_ppm,
        })),
        { label: name || "Product", method: analyticalMethod, lod: lodPpm, loq: loqPpm },
      ];
      for (const s of stepsToValidate) {
        if (!s.method) { alert(`Select analytical method for: ${s.label} ❌`); return false; }
        if (!s.lod)    { alert(`Enter LOD for: ${s.label} ❌`); return false; }
        if (!s.loq)    { alert(`Enter LOQ for: ${s.label} ❌`); return false; }
        const l = parseFloat(s.lod), q = parseFloat(s.loq);
        if (!isNaN(l) && !isNaN(q) && l >= q) { alert(`LOD must be less than LOQ for: ${s.label} ❌`); return false; }
      }
    }
    if (id === "dosage") {
      const minD = parseFloat(minDose), maxD = parseFloat(maxDose);
      if (!isNaN(minD) && !isNaN(maxD) && minD > maxD) {
        alert("Minimum Therapeutic Dose cannot exceed Maximum Daily Dose ❌"); return false;
      }
    }
    if (id === "synthesis") {
      const namedSteps = synthSteps.filter(s => s.step_name.trim());
      if (namedSteps.some(s => !s.iupac_name.trim())) {
        alert("IUPAC name is required for all synthesis steps ❌\n\nEvery named step must have an IUPAC name for regulatory traceability.");
        return false;
      }
    }
    if (id === "equipment") {
      if (!facilityId) { alert("Select a facility ❌"); return false; }
      const validSynthSteps = synthSteps.filter(s => s.step_name || s.iupac_name);
      if (validSynthSteps.length === 0) {
        if ((stepEquipmentMap[0]?.equipment_ids || []).length === 0) {
          alert("Select at least one equipment ❌"); return false;
        }
      } else {
        for (const m of stepEquipmentMap) {
          if (m.equipment_ids.length === 0) {
            const label = m.is_product ? `Product (${m.step_name})` : `Step ${m.step_index + 1} — ${m.step_name}`;
            alert(`Select at least one equipment for: ${label} ❌`); return false;
          }
        }
      }
    }
    return true;
  };

  const nextStep = () => {
    if (!validateStep()) return;
    setWizardStepIndex(i => Math.min(i + 1, currentSteps.length - 1));
  };

  const prevStep = () => setWizardStepIndex(i => Math.max(i - 1, 0));

  const handleTypeChange = (type) => {
    setProductCategory(type);
    setWizardStepIndex(0);
    setTherapeuticCategory("");
    setRouteOfAdmin("");
    setFinalProductId("");
    setStepEquipmentMap([]);
    setEquipmentSequence({});
  };

  // ─── Synthesis step management ────────────────────────────────────────────────
  const addSynthStep    = ()           => setSynthSteps(p => [...p, { ...BLANK_SYNTH }]);
  const removeSynthStep = (idx)        => setSynthSteps(p => p.filter((_, i) => i !== idx));
  const updateSynthStep = (idx, k, v)  => setSynthSteps(p => p.map((s, i) => i === idx ? { ...s, [k]: v } : s));

  const addEditSynthStep    = ()           => setEditSynthSteps(p => [...p, { ...BLANK_SYNTH }]);
  const removeEditSynthStep = (idx)        => setEditSynthSteps(p => p.filter((_, i) => i !== idx));
  const updateEditSynthStep = (idx, k, v)  => setEditSynthSteps(p => p.map((s, i) => i === idx ? { ...s, [k]: v } : s));

  // ─── Per-step equipment helpers (Add wizard) ──────────────────────────────────
  const toggleStepEquipment = (mapIdx, equipId) =>
    setStepEquipmentMap(prev => prev.map((m, i) => {
      if (i !== mapIdx) return m;
      const adding = !m.equipment_ids.includes(equipId);
      const newIds = adding ? [...m.equipment_ids, equipId] : m.equipment_ids.filter(id => id !== equipId);
      const newAreas = { ...(m.swab_areas || {}) };
      const newRinse = { ...(m.rinse_areas || {}) };
      const newOptional = { ...(m.optional_equipment || {}) };
      const newEnabled = { ...(m.optional_equipment_enabled || {}) };
      const newOptSwab = { ...(m.optional_swab_areas || {}) };
      const newOptRinse = { ...(m.optional_rinse_areas || {}) };
      if (adding) {
        const eqObj = equipmentList.find(e => e.equipment_id === equipId);
        const eqSqIn = eqObj ? parseFloat((eqObj.surface_area_cm2 / 6.4516).toFixed(2)) : 9;
        newAreas[equipId] = 9; newRinse[equipId] = eqSqIn; newOptional[equipId] = []; newEnabled[equipId] = false; newOptSwab[equipId] = {}; newOptRinse[equipId] = {};
      } else { delete newAreas[equipId]; delete newRinse[equipId]; delete newOptional[equipId]; delete newEnabled[equipId]; delete newOptSwab[equipId]; delete newOptRinse[equipId]; }
      return { ...m, equipment_ids: newIds, swab_areas: newAreas, rinse_areas: newRinse, optional_equipment: newOptional, optional_equipment_enabled: newEnabled, optional_swab_areas: newOptSwab, optional_rinse_areas: newOptRinse };
    }));

  const updateStepSwabArea = (mapIdx, equipId, val) =>
    setStepEquipmentMap(prev => prev.map((m, i) =>
      i === mapIdx ? { ...m, swab_areas: { ...(m.swab_areas || {}), [equipId]: val } } : m
    ));

  const updateStepRinseArea = (mapIdx, equipId, val) =>
    setStepEquipmentMap(prev => prev.map((m, i) =>
      i === mapIdx ? { ...m, rinse_areas: { ...(m.rinse_areas || {}), [equipId]: val } } : m
    ));

  const setStepOptionalEnabled = (mapIdx, equipId, enabled) =>
    setStepEquipmentMap(prev => prev.map((m, i) => {
      if (i !== mapIdx) return m;
      const newEnabled = { ...(m.optional_equipment_enabled || {}), [equipId]: enabled };
      const newOptional = { ...(m.optional_equipment || {}) };
      const newOptSwab = { ...(m.optional_swab_areas || {}) };
      const newOptRinse = { ...(m.optional_rinse_areas || {}) };
      if (!enabled) { newOptional[equipId] = []; newOptSwab[equipId] = {}; newOptRinse[equipId] = {}; }
      return { ...m, optional_equipment_enabled: newEnabled, optional_equipment: newOptional, optional_swab_areas: newOptSwab, optional_rinse_areas: newOptRinse };
    }));

  const toggleStepOptionalEquipment = (mapIdx, primaryId, optId) =>
    setStepEquipmentMap(prev => prev.map((m, i) => {
      if (i !== mapIdx) return m;
      const cur = (m.optional_equipment || {})[primaryId] || [];
      const adding = !cur.includes(optId);
      const next = adding ? [...cur, optId] : cur.filter(id => id !== optId);
      const optSwab = { ...((m.optional_swab_areas || {})[primaryId] || {}) };
      const optRinse = { ...((m.optional_rinse_areas || {})[primaryId] || {}) };
      if (adding) {
        const optObj = equipmentList.find(e => e.equipment_id === optId);
        const optSqIn = optObj ? parseFloat((optObj.surface_area_cm2 / 6.4516).toFixed(2)) : 9;
        optSwab[optId] = 9; optRinse[optId] = optSqIn;
      } else { delete optSwab[optId]; delete optRinse[optId]; }
      return { ...m, optional_equipment: { ...(m.optional_equipment || {}), [primaryId]: next }, optional_swab_areas: { ...(m.optional_swab_areas || {}), [primaryId]: optSwab }, optional_rinse_areas: { ...(m.optional_rinse_areas || {}), [primaryId]: optRinse } };
    }));

  const updateStepOptionalSwabArea = (mapIdx, primaryId, optId, val) =>
    setStepEquipmentMap(prev => prev.map((m, i) => {
      if (i !== mapIdx) return m;
      const optSwab = { ...((m.optional_swab_areas || {})[primaryId] || {}), [optId]: val };
      return { ...m, optional_swab_areas: { ...(m.optional_swab_areas || {}), [primaryId]: optSwab } };
    }));

  const updateStepOptionalRinseArea = (mapIdx, primaryId, optId, val) =>
    setStepEquipmentMap(prev => prev.map((m, i) => {
      if (i !== mapIdx) return m;
      const optRinse = { ...((m.optional_rinse_areas || {})[primaryId] || {}), [optId]: val };
      return { ...m, optional_rinse_areas: { ...(m.optional_rinse_areas || {}), [primaryId]: optRinse } };
    }));

  const updateStepTestCompound = (mapIdx, val) =>
    setStepEquipmentMap(prev => prev.map((m, i) =>
      i === mapIdx ? { ...m, test_compound: val } : m
    ));

  // ─── Per-step equipment helpers (Edit modal) ──────────────────────────────────
  const toggleEditStepEquipment = (mapIdx, equipId) =>
    setEditStepEquipmentMap(prev => prev.map((m, i) => {
      if (i !== mapIdx) return m;
      const adding = !m.equipment_ids.includes(equipId);
      const newIds = adding ? [...m.equipment_ids, equipId] : m.equipment_ids.filter(id => id !== equipId);
      const newAreas = { ...(m.swab_areas || {}) };
      const newRinse = { ...(m.rinse_areas || {}) };
      const newOptional = { ...(m.optional_equipment || {}) };
      const newEnabled = { ...(m.optional_equipment_enabled || {}) };
      const newOptSwab = { ...(m.optional_swab_areas || {}) };
      const newOptRinse = { ...(m.optional_rinse_areas || {}) };
      if (adding) {
        const eqObj = editEquipment.find(e => e.equipment_id === equipId);
        const eqSqIn = eqObj ? parseFloat((eqObj.surface_area_cm2 / 6.4516).toFixed(2)) : 9;
        newAreas[equipId] = 9; newRinse[equipId] = eqSqIn; newOptional[equipId] = []; newEnabled[equipId] = false; newOptSwab[equipId] = {}; newOptRinse[equipId] = {};
      } else { delete newAreas[equipId]; delete newRinse[equipId]; delete newOptional[equipId]; delete newEnabled[equipId]; delete newOptSwab[equipId]; delete newOptRinse[equipId]; }
      return { ...m, equipment_ids: newIds, swab_areas: newAreas, rinse_areas: newRinse, optional_equipment: newOptional, optional_equipment_enabled: newEnabled, optional_swab_areas: newOptSwab, optional_rinse_areas: newOptRinse };
    }));

  const updateEditStepSwabArea = (mapIdx, equipId, val) =>
    setEditStepEquipmentMap(prev => prev.map((m, i) =>
      i === mapIdx ? { ...m, swab_areas: { ...(m.swab_areas || {}), [equipId]: val } } : m
    ));

  const updateEditStepRinseArea = (mapIdx, equipId, val) =>
    setEditStepEquipmentMap(prev => prev.map((m, i) =>
      i === mapIdx ? { ...m, rinse_areas: { ...(m.rinse_areas || {}), [equipId]: val } } : m
    ));

  const setEditStepOptionalEnabled = (mapIdx, equipId, enabled) =>
    setEditStepEquipmentMap(prev => prev.map((m, i) => {
      if (i !== mapIdx) return m;
      const newEnabled = { ...(m.optional_equipment_enabled || {}), [equipId]: enabled };
      const newOptional = { ...(m.optional_equipment || {}) };
      const newOptSwab = { ...(m.optional_swab_areas || {}) };
      const newOptRinse = { ...(m.optional_rinse_areas || {}) };
      if (!enabled) { newOptional[equipId] = []; newOptSwab[equipId] = {}; newOptRinse[equipId] = {}; }
      return { ...m, optional_equipment_enabled: newEnabled, optional_equipment: newOptional, optional_swab_areas: newOptSwab, optional_rinse_areas: newOptRinse };
    }));

  const toggleEditStepOptionalEquipment = (mapIdx, primaryId, optId) =>
    setEditStepEquipmentMap(prev => prev.map((m, i) => {
      if (i !== mapIdx) return m;
      const cur = (m.optional_equipment || {})[primaryId] || [];
      const adding = !cur.includes(optId);
      const next = adding ? [...cur, optId] : cur.filter(id => id !== optId);
      const optSwab = { ...((m.optional_swab_areas || {})[primaryId] || {}) };
      const optRinse = { ...((m.optional_rinse_areas || {})[primaryId] || {}) };
      if (adding) {
        const optObj = editEquipment.find(e => e.equipment_id === optId);
        const optSqIn = optObj ? parseFloat((optObj.surface_area_cm2 / 6.4516).toFixed(2)) : 9;
        optSwab[optId] = 9; optRinse[optId] = optSqIn;
      } else { delete optSwab[optId]; delete optRinse[optId]; }
      return { ...m, optional_equipment: { ...(m.optional_equipment || {}), [primaryId]: next }, optional_swab_areas: { ...(m.optional_swab_areas || {}), [primaryId]: optSwab }, optional_rinse_areas: { ...(m.optional_rinse_areas || {}), [primaryId]: optRinse } };
    }));

  const updateEditStepOptionalSwabArea = (mapIdx, primaryId, optId, val) =>
    setEditStepEquipmentMap(prev => prev.map((m, i) => {
      if (i !== mapIdx) return m;
      const optSwab = { ...((m.optional_swab_areas || {})[primaryId] || {}), [optId]: val };
      return { ...m, optional_swab_areas: { ...(m.optional_swab_areas || {}), [primaryId]: optSwab } };
    }));

  const updateEditStepOptionalRinseArea = (mapIdx, primaryId, optId, val) =>
    setEditStepEquipmentMap(prev => prev.map((m, i) => {
      if (i !== mapIdx) return m;
      const optRinse = { ...((m.optional_rinse_areas || {})[primaryId] || {}), [optId]: val };
      return { ...m, optional_rinse_areas: { ...(m.optional_rinse_areas || {}), [primaryId]: optRinse } };
    }));

  const updateEditStepTestCompound = (mapIdx, val) =>
    setEditStepEquipmentMap(prev => prev.map((m, i) =>
      i === mapIdx ? { ...m, test_compound: val } : m
    ));

  // ─── Sequence reorder helpers ─────────────────────────────────────────────────
  const moveSeqUp = (eid, pos) =>
    setEquipmentSequence(prev => {
      const arr = [...prev[eid]];
      [arr[pos - 1], arr[pos]] = [arr[pos], arr[pos - 1]];
      return { ...prev, [eid]: arr };
    });

  const moveSeqDown = (eid, pos) =>
    setEquipmentSequence(prev => {
      const arr = [...prev[eid]];
      [arr[pos + 1], arr[pos]] = [arr[pos], arr[pos + 1]];
      return { ...prev, [eid]: arr };
    });

  const moveEditSeqUp = (eid, pos) =>
    setEditEquipmentSequence(prev => {
      const arr = [...prev[eid]];
      [arr[pos - 1], arr[pos]] = [arr[pos], arr[pos - 1]];
      return { ...prev, [eid]: arr };
    });

  const moveEditSeqDown = (eid, pos) =>
    setEditEquipmentSequence(prev => {
      const arr = [...prev[eid]];
      [arr[pos + 1], arr[pos]] = [arr[pos], arr[pos + 1]];
      return { ...prev, [eid]: arr };
    });

  // ─── ATC custom category ──────────────────────────────────────────────────────
  const addCustomAtc = async () => {
    if (!newAtcInput.trim()) return;
    try {
      const r = await api.post("/product/atc-categories", { category: newAtcInput.trim() });
      setAtcCustom(r.data.categories || []);
      setNewAtcInput("");
    } catch (e) { alert(e.response?.data?.detail || "Error adding category ❌"); }
  };

  // ─── Equipment toggle ─────────────────────────────────────────────────────────
  const toggleEquipment = (id) =>
    setSelectedEquipment(p => p.includes(id) ? p.filter(e => e !== id) : [...p, id]);

  // ─── Add product ──────────────────────────────────────────────────────────────
  const confirmAdd = async () => {
    if (!addPassword) { alert("Enter your password ❌"); return; }
    setAddLoading(true);
    try {
      const validSteps = synthSteps.filter(s => s.step_name || s.iupac_name);
      const allEquipmentIds = [...new Set(stepEquipmentMap.flatMap(m => m.equipment_ids))];
      const stepEqPayload = stepEquipmentMap.flatMap(m => m.equipment_ids.map(eqId => {
        const seq = equipmentSequence[eqId];
        const checked = reviewTestCompounds[eqId] || (seq ? [seq[seq.length - 1]] : null);
        return {
          step_number:      m.is_product ? 0 : m.step_index + 1,
          equipment_id:     eqId,
          test_compound:    m.test_compound || null,
          usage_sequence:   seq ? seq.indexOf(m.step_index) + 1 : null,
          is_test_compound: seq ? (checked && checked.includes(m.step_index) ? 1 : 0) : 1,
          swab_area_sqin:             (m.swab_areas || {})[eqId] ?? 9,
          rinse_sample_area_sqin:     (m.rinse_areas || {})[eqId] ?? 9,
          optional_equipment_ids:     (m.optional_equipment || {})[eqId] || [],
          optional_swab_areas:        (m.optional_swab_areas || {})[eqId] || {},
          optional_rinse_sample_areas:(m.optional_rinse_areas || {})[eqId] || {},
        };
      }));
      await api.post("/product/add", {
        product_name:    name,
        facility_id:     parseInt(facilityId),
        product_category:       productCategory || null,
        therapeutic_category:   productCategory === "API" ? (therapeuticCategory || null) : null,
        route_of_administration: productCategory === "API" ? (routeOfAdmin || null) : null,
        final_product_id: productCategory === "Intermediate" && finalProductId ? parseInt(finalProductId) : null,
        synthesis_steps: validSteps.map(s => ({
          step_name:         s.step_name || "",
          iupac_name:        s.iupac_name || "",
          soluble_solvent:   s.soluble_solvent || "",
          solubility_usp:    s.solubility_usp ? parseInt(s.solubility_usp) : null,
          analytical_method: s.analytical_method || "",
          lod_ppm:           parseFloat(s.lod_ppm) || null,
          loq_ppm:           parseFloat(s.loq_ppm) || null,
        })),
        min_therapeutic_dose_mg: parseFloat(minDose) || 0,
        max_daily_dose_mg:       parseFloat(maxDose) || 0,
        pde_mg_day:              (() => { const vals = Object.values(pdeValues).map(Number).filter(v => !isNaN(v) && v > 0); return vals.length ? Math.min(...vals) : 0; })(),
        min_yield_kg:            parseFloat(minYieldKg) || 0,
        max_batch_size_kg:       parseFloat(maxBatchKg) || 0,
        lod_ppm:                 parseFloat(lodPpm) || 0,
        loq_ppm:                 parseFloat(loqPpm) || 0,
        analytical_method: analyticalMethod,
        soluble_solvent:  solubleSolvent || "",
        solubility_usp:   solubilityUsp ? parseInt(solubilityUsp) : null,
        cas_number:     casNumber || null,
        chemical_number: chemicalNumber || null,
        equipment_ids:      allEquipmentIds,
        step_equipment_map: stepEqPayload,
        password:       addPassword,
      });
      alert("Product Added ✅");
      // Reset all
      setName(""); setProductCategory(""); setTherapeuticCategory(""); setRouteOfAdmin("");
      setFinalProductId(""); setSynthSteps([{ ...BLANK_SYNTH }]); setSolubleSolvent(""); setSolubilityUsp("");
      setMinDose(""); setMaxDose(""); setPdeValues({});
      setMinYieldKg(""); setMaxBatchKg("");
      setAnalyticalMethod(""); setLodPpm(""); setLoqPpm("");
      setCasNumber(""); setChemicalNumber("");
      setFacilityId(""); setSelectedEquipment([]); setStepEquipmentMap([]); setEquipmentSequence({}); setReviewTestCompounds({});
      setAddPassword("");
      setWizardStepIndex(0);
      fetchAllProducts();
    } catch (e) {
      const detail = e.response?.data?.detail;
      const msg = Array.isArray(detail)
        ? detail.map(d => `${(d.loc || []).slice(-1)[0] || "field"}: ${d.msg}`).join("\n")
        : (typeof detail === "string" ? detail : e.message || "Error adding product ❌");
      alert(msg);
    } finally { setAddLoading(false); }
  };

  // ─── View tab ─────────────────────────────────────────────────────────────────
  const handleViewQuery = async () => {
    setViewLoading(true); setViewQueried(true);
    try {
      const url = viewFacilityId ? `/product/all?facility_id=${viewFacilityId}` : "/product/all";
      const r = await api.get(url);
      setViewProducts(r.data);
    } catch (e) { console.log(e); setViewProducts([]); }
    finally { setViewLoading(false); }
  };

  const clearViewTab = () => { setViewProducts([]); setViewQueried(false); setViewFacilityId(""); };

  // ─── Overview helpers ─────────────────────────────────────────────────────────
  const fetchOverviewProducts = async (fid) => {
    if (!fid) return;
    setOvLoading(true);
    try {
      const r = await api.get(`/product/all?facility_id=${fid}`);
      setOvProducts((r.data || []).filter(p => !p.is_archived));
    } catch { alert("Failed to load products for overview."); }
    finally { setOvLoading(false); }
  };

  const openMapModal = (apiProduct) => {
    // Pre-populate changes with current final_product_id values
    const init = {};
    ovProducts.filter(p => p.product_category !== "API").forEach(p => {
      init[p.product_id] = p.final_product_id ?? null;
    });
    setMapChanges(init);
    setMapPassword(""); setMapReason("");
    setMapModal({ api: apiProduct });
  };

  const saveMapping = async () => {
    if (!mapReason.trim()) { alert("Please enter a reason."); return; }
    if (!mapPassword.trim()) { alert("Please enter your password."); return; }
    const original = {};
    ovProducts.filter(p => p.product_category !== "API").forEach(p => {
      original[p.product_id] = p.final_product_id ?? null;
    });
    const toUpdate = Object.entries(mapChanges).filter(
      ([id, newParent]) => newParent !== original[parseInt(id)]
    );
    if (toUpdate.length === 0) { setMapModal(null); return; }
    setMapSaving(true);
    try {
      await Promise.all(toUpdate.map(([id, newParent]) =>
        api.patch(`/product/${id}/link`, {
          final_product_id: newParent,
          password: mapPassword,
          reason: mapReason,
        })
      ));
      await fetchOverviewProducts(ovFacilityId);
      setMapModal(null);
    } catch (e) {
      alert(e.response?.data?.detail || "Failed to save mapping.");
    } finally { setMapSaving(false); }
  };

  // ─── Synthesis steps modal ────────────────────────────────────────────────────
  const openStepsModal = async (product) => {
    setStepsModal(product);
    setStepsData([]);
    setStepsLoading(true);
    try {
      const r = await api.get(`/product/${product.product_id}/synthesis-steps`);
      setStepsData(r.data);
    } catch (e) { console.log(e); }
    finally { setStepsLoading(false); }
  };

  // ─── Edit modal ───────────────────────────────────────────────────────────────
  const openEditModal = async (product) => {
    setEditForm({
      min_therapeutic_dose_mg: product.min_therapeutic_dose_mg,
      max_daily_dose_mg:       product.max_daily_dose_mg,
      pde_mg_day:              product.pde_mg_day,
      min_yield_kg:            product.min_yield_kg,
      max_batch_size_kg:       product.max_batch_size_kg,
      lod_ppm:                 product.lod_ppm,
      loq_ppm:                 product.loq_ppm,
      analytical_method:       product.analytical_method || "",
      solubility_usp:          product.solubility_usp ?? "",
      soluble_solvent:         product.soluble_solvent || "",
      product_category:        product.product_category || "",
      therapeutic_category:    product.therapeutic_category || "",
      route_of_administration: product.route_of_administration || "",
      cas_number:              product.cas_number || "",
      chemical_number:         product.chemical_number || "",
      final_product_id:        product.final_product_id || "",
    });
    setEditPassword(""); setEditReason("");
    setEditEquipment([]);
    setEditSelectedEq([]);
    setEditSynthSteps([{ ...BLANK_SYNTH }]);
    setEditStepEquipmentMap([]);
    setEditEquipmentSequence({});
    setEditReviewTestCompounds({});
    setEditEquipmentOpen(false);
    setEditModal(product);
    try {
      // Fetch each resource independently so a single failure doesn't block the rest
      const [eqR, selR, stepsR, stepEqR] = await Promise.all([
        api.get(`/equipment/by_facility/${product.facility_id}`).catch(() => ({ data: [] })),
        api.get(`/product/${product.product_id}/equipment`).catch(() => ({ data: [] })),
        api.get(`/product/${product.product_id}/synthesis-steps`).catch(() => ({ data: [] })),
        api.get(`/product/${product.product_id}/step-equipment`).catch(() => ({ data: [] })),
      ]);
      setEditEquipment(eqR.data);
      setEditSelectedEq(selR.data);
      setEditSynthSteps(stepsR.data.length > 0 ? stepsR.data : [{ ...BLANK_SYNTH }]);
      const validFetchedSteps = stepsR.data.filter(s => s.step_name || s.iupac_name);
      const stepEqEntries = stepEqR.data || [];
      const synthMap = validFetchedSteps.map((s, i) => {
        const entries = stepEqEntries.filter(e => e.step_number === s.step_number);
        const swabAreas = {};
        const rinseAreas = {};
        const optionalEquip = {};
        const optionalEnabled = {};
        const optionalSwabAreas = {};
        const optionalRinseAreas = {};
        entries.forEach(e => {
          swabAreas[e.equipment_id] = e.swab_area_sqin ?? 9;
          rinseAreas[e.equipment_id] = e.rinse_sample_area_sqin ?? 9;
          optionalEquip[e.equipment_id] = e.optional_equipment_ids || [];
          optionalEnabled[e.equipment_id] = (e.optional_equipment_ids || []).length > 0;
          const raw = e.optional_swab_areas || {};
          optionalSwabAreas[e.equipment_id] = Object.fromEntries(Object.entries(raw).map(([k, v]) => [parseInt(k), v]));
          const rawR = e.optional_rinse_sample_areas || {};
          optionalRinseAreas[e.equipment_id] = Object.fromEntries(Object.entries(rawR).map(([k, v]) => [parseInt(k), v]));
        });
        return {
          step_index:               i,
          step_name:                s.step_name || `Step ${i + 1}`,
          test_compound:            entries.length > 0 ? (entries[0].test_compound || "") : (s.iupac_name || ""),
          equipment_ids:            entries.map(e => e.equipment_id),
          swab_areas:               swabAreas,
          rinse_areas:              rinseAreas,
          optional_equipment:       optionalEquip,
          optional_equipment_enabled: optionalEnabled,
          optional_swab_areas:      optionalSwabAreas,
          optional_rinse_areas:     optionalRinseAreas,
          is_product:               false,
        };
      });
      const productEqEntries = stepEqEntries.filter(e => e.step_number === 0);
      const productSwabAreas = {};
      const productRinseAreas = {};
      const productOptionalEquip = {};
      const productOptionalEnabled = {};
      const productOptionalSwabAreas = {};
      const productOptionalRinseAreas = {};
      productEqEntries.forEach(e => {
        productSwabAreas[e.equipment_id] = e.swab_area_sqin ?? 9;
        productRinseAreas[e.equipment_id] = e.rinse_sample_area_sqin ?? 9;
        productOptionalEquip[e.equipment_id] = e.optional_equipment_ids || [];
        productOptionalEnabled[e.equipment_id] = (e.optional_equipment_ids || []).length > 0;
        const raw = e.optional_swab_areas || {};
        productOptionalSwabAreas[e.equipment_id] = Object.fromEntries(Object.entries(raw).map(([k, v]) => [parseInt(k), v]));
        const rawR = e.optional_rinse_sample_areas || {};
        productOptionalRinseAreas[e.equipment_id] = Object.fromEntries(Object.entries(rawR).map(([k, v]) => [parseInt(k), v]));
      });
      const productEntry = {
        step_index:    validFetchedSteps.length,
        step_name:     product.product_name,
        test_compound: productEqEntries.length > 0
          ? (productEqEntries[0].test_compound || "")
          : (product.chemical_number || product.product_name || ""),
        equipment_ids:               productEqEntries.map(e => e.equipment_id),
        swab_areas:                  productSwabAreas,
        rinse_areas:                 productRinseAreas,
        optional_equipment:          productOptionalEquip,
        optional_equipment_enabled:  productOptionalEnabled,
        optional_swab_areas:         productOptionalSwabAreas,
        optional_rinse_areas:        productOptionalRinseAreas,
        is_product:                  true,
      };
      // Always use per-step map when synthesis steps exist (enables swab area + optional equipment).
      // When no saved step-equipment rows exist, seed the product card from the flat selection
      // so the user's previously assigned equipment is still pre-checked.
      if (validFetchedSteps.length > 0) {
        if (stepEqEntries.length === 0) {
          const eqIds = selR.data || [];
          const seededProductEntry = {
            step_index:                validFetchedSteps.length,
            step_name:                 product.product_name,
            test_compound:             product.chemical_number || product.product_name || "",
            equipment_ids:             eqIds,
            swab_areas:                Object.fromEntries(eqIds.map(id => [id, 9])),
            rinse_areas:               Object.fromEntries(eqIds.map(id => { const eq = editEquipment.find(e => e.equipment_id === id); return [id, eq ? parseFloat((eq.surface_area_cm2 / 6.4516).toFixed(2)) : 9]; })),
            optional_equipment:        Object.fromEntries(eqIds.map(id => [id, []])),
            optional_equipment_enabled: Object.fromEntries(eqIds.map(id => [id, false])),
            optional_swab_areas:       Object.fromEntries(eqIds.map(id => [id, {}])),
            optional_rinse_areas:      Object.fromEntries(eqIds.map(id => [id, {}])),
            is_product:                true,
          };
          setEditStepEquipmentMap([...synthMap, seededProductEntry]);
        } else {
          setEditStepEquipmentMap([...synthMap, productEntry]);
        }
      } else {
        setEditStepEquipmentMap([]);
      }
      // Restore sequence for shared equipment from saved usage_sequence
      const seqMap = {};
      stepEqEntries.forEach(entry => {
        if (entry.usage_sequence == null) return;
        const si = entry.step_number === 0
          ? validFetchedSteps.length
          : validFetchedSteps.findIndex(s => s.step_number === entry.step_number);
        if (si === -1) return;
        if (!seqMap[entry.equipment_id]) seqMap[entry.equipment_id] = [];
        seqMap[entry.equipment_id].push({ si, seq: entry.usage_sequence });
      });
      const restoredSeq = {};
      Object.entries(seqMap).forEach(([eid, items]) => {
        if (items.length >= 2)
          restoredSeq[eid] = items.sort((a, b) => a.seq - b.seq).map(x => x.si);
      });
      setEditEquipmentSequence(restoredSeq);
      // Restore test-compound selections
      const restoredTestCompounds = {};
      Object.entries(restoredSeq).forEach(([eid, orderedSis]) => {
        const selected = stepEqEntries
          .filter(e => String(e.equipment_id) === eid && e.is_test_compound === 1)
          .map(e => e.step_number === 0
            ? validFetchedSteps.length
            : validFetchedSteps.findIndex(s => s.step_number === e.step_number))
          .filter(si => si !== -1);
        restoredTestCompounds[eid] = selected.length > 0
          ? selected
          : [orderedSis[orderedSis.length - 1]]; // default: last in sequence
      });
      setEditReviewTestCompounds(restoredTestCompounds);
    } catch (e) { console.log(e); }
  };

  const confirmEdit = async () => {
    if (!editReason)   { alert("Enter a reason ❌"); return; }
    if (!editPassword) { alert("Enter your password ❌"); return; }
    const _lod = parseFloat(editForm.lod_ppm), _loq = parseFloat(editForm.loq_ppm);
    if (editForm.lod_ppm && editForm.loq_ppm && !isNaN(_lod) && !isNaN(_loq) && _lod >= _loq) {
      alert("LOD must be less than LOQ for the product ❌"); return;
    }
    for (const s of editSynthSteps.filter(r => r.step_name || r.iupac_name)) {
      const sl = parseFloat(s.lod_ppm), sq = parseFloat(s.loq_ppm);
      if (s.lod_ppm && s.loq_ppm && !isNaN(sl) && !isNaN(sq) && sl >= sq) {
        alert(`LOD must be less than LOQ for step: ${s.step_name || s.iupac_name} ❌`); return;
      }
    }
    const namedEditSteps = editSynthSteps.filter(s => s.step_name?.trim());
    if (namedEditSteps.some(s => !s.iupac_name?.trim())) {
      alert("IUPAC name is required for all synthesis steps ❌"); return;
    }
    setEditLoading(true);
    try {
      const validSteps = editSynthSteps.filter(s => s.step_name || s.iupac_name);
      const hasPerStepEdit = editStepEquipmentMap.length > 0;
      const editEquipmentIds = hasPerStepEdit
        ? [...new Set(editStepEquipmentMap.flatMap(m => m.equipment_ids))]
        : editSelectedEq;
      const editStepEqPayload = hasPerStepEdit
        ? editStepEquipmentMap.flatMap(m => m.equipment_ids.map(eqId => {
            const seq = editEquipmentSequence[eqId];
            const checked = editReviewTestCompounds[eqId] || (seq ? [seq[seq.length - 1]] : null);
            return {
              step_number:      m.is_product ? 0 : m.step_index + 1,
              equipment_id:     eqId,
              test_compound:    m.test_compound || null,
              usage_sequence:   seq ? seq.indexOf(m.step_index) + 1 : null,
              is_test_compound: seq ? (checked && checked.includes(m.step_index) ? 1 : 0) : 1,
              swab_area_sqin:             (m.swab_areas || {})[eqId] ?? 9,
              rinse_sample_area_sqin:     (m.rinse_areas || {})[eqId] ?? 9,
              optional_equipment_ids:     (m.optional_equipment || {})[eqId] || [],
              optional_swab_areas:        (m.optional_swab_areas || {})[eqId] || {},
              optional_rinse_sample_areas:(m.optional_rinse_areas || {})[eqId] || {},
            };
          }))
        : [];
      await api.put(`/product/update/${editModal.product_id}`, {
        min_therapeutic_dose_mg: parseFloat(editForm.min_therapeutic_dose_mg) || 0,
        max_daily_dose_mg:       parseFloat(editForm.max_daily_dose_mg) || 0,
        pde_mg_day:              parseFloat(editForm.pde_mg_day) || 0,
        min_yield_kg:            parseFloat(editForm.min_yield_kg) || 0,
        max_batch_size_kg:       parseFloat(editForm.max_batch_size_kg) || 0,
        lod_ppm:                 parseFloat(editForm.lod_ppm) || 0,
        loq_ppm:                 parseFloat(editForm.loq_ppm) || 0,
        analytical_method:       editForm.analytical_method,
        solubility_usp:          editForm.solubility_usp ? parseInt(editForm.solubility_usp) : null,
        soluble_solvent:         editForm.soluble_solvent,
        product_category:        editForm.product_category || null,
        therapeutic_category:    editForm.therapeutic_category || null,
        route_of_administration: editForm.route_of_administration || null,
        cas_number:              editForm.cas_number || null,
        chemical_number:         editForm.chemical_number || null,
        final_product_id:        editForm.final_product_id ? parseInt(editForm.final_product_id) : null,
        synthesis_steps: validSteps.map(s => ({
          step_name:         s.step_name || "",
          iupac_name:        s.iupac_name || "",
          soluble_solvent:   s.soluble_solvent || "",
          solubility_usp:    s.solubility_usp ? parseInt(s.solubility_usp) : null,
          analytical_method: s.analytical_method || "",
          lod_ppm:           parseFloat(s.lod_ppm) || null,
          loq_ppm:           parseFloat(s.loq_ppm) || null,
        })),
        equipment_ids:      editEquipmentIds,
        step_equipment_map: editStepEqPayload,
        password: editPassword,
        reason:   editReason,
      });
      alert("Product updated ✅");
      setEditModal(null);
      if (viewQueried) handleViewQuery();
      fetchAllProducts();
    } catch (e) {
      const detail = e.response?.data?.detail;
      const msg = Array.isArray(detail)
        ? detail.map(d => `${(d.loc || []).slice(-1)[0] || "field"}: ${d.msg}`).join("\n")
        : (typeof detail === "string" ? detail : e.message || "Error updating product ❌");
      alert(msg);
    } finally { setEditLoading(false); }
  };

  // ─── History modal ────────────────────────────────────────────────────────────
  const openHistoryModal = async (product) => {
    setHistoryModal(product); setHistoryLoading(true); setHistoryLogs([]);
    try { const r = await api.get(`/audit/product/${product.product_id}`); setHistoryLogs(r.data); }
    catch (e) { console.log(e); }
    finally { setHistoryLoading(false); }
  };

  // ─── Archive / Restore ────────────────────────────────────────────────────────
  const openArchiveModal  = (p) => { setArchiveModal(p); setArchivePassword(""); setArchiveReason(""); };
  const closeArchiveModal = ()  => { setArchiveModal(null); setArchivePassword(""); setArchiveReason(""); };

  const confirmArchive = async () => {
    if (!archivePassword) { alert("Enter your password ❌"); return; }
    if (!archiveReason)   { alert("Enter a reason ❌"); return; }
    setArchiveLoading(true);
    try {
      await api.post(`/product/archive/${archiveModal.product_id}`, { password: archivePassword, reason: archiveReason });
      alert("Product archived ✅");
      setViewProducts(p => p.filter(x => x.product_id !== archiveModal.product_id));
      closeArchiveModal();
      if (showArchived) { const r = await api.get("/product/archived"); setArchivedProducts(r.data); }
      fetchAllProducts();
    } catch (e) { alert(e.response?.data?.detail || "Error archiving ❌"); }
    finally { setArchiveLoading(false); }
  };

  const toggleArchivedSection = async () => {
    const next = !showArchived; setShowArchived(next);
    if (next) {
      setArchivedLoading(true);
      try { const r = await api.get("/product/archived"); setArchivedProducts(r.data); }
      catch (e) { console.log(e); }
      finally { setArchivedLoading(false); }
    }
  };

  const openRestoreModal  = (p) => { setRestoreModal(p); setRestorePassword(""); setRestoreReason(""); };

  const confirmRestore = async () => {
    if (!restorePassword) { alert("Enter your password ❌"); return; }
    setRestoreLoading(true);
    try {
      await api.post(`/product/restore/${restoreModal.product_id}`, { password: restorePassword, reason: restoreReason });
      alert("Product restored ✅");
      setArchivedProducts(p => p.filter(x => x.product_id !== restoreModal.product_id));
      setRestoreModal(null);
      fetchAllProducts();
    } catch (e) { alert(e.response?.data?.detail || "Error restoring ❌"); }
    finally { setRestoreLoading(false); }
  };

  // ─── Print ────────────────────────────────────────────────────────────────────
  const handlePrint = () => {
    if (!printRef.current || viewProducts.length === 0) { alert("Nothing to print ❌"); return; }
    const win = window.open("", "_blank");
    win.document.write(`<html><head><title>Product Master Report</title>
      <style>body{font-family:Arial;padding:20px;font-size:12px;}
      .header{display:flex;align-items:center;border-bottom:2px solid #004f9f;padding-bottom:10px;margin-bottom:20px;}
      .header img{width:80px;margin-right:20px;}.header-text h2{margin:0;color:#004f9f;font-size:18px;}
      .header-text p{margin:4px 0 0;color:#555;font-size:12px;}
      table{width:100%;border-collapse:collapse;}
      th{background:#004f9f;color:white;padding:8px;font-size:11px;text-align:center;}
      td{border:1px solid #ddd;padding:6px 8px;font-size:11px;text-align:center;}
      tr:nth-child(even){background:#f8fafc;}
      .footer{margin-top:30px;border-top:1px solid #ccc;padding-top:10px;display:flex;justify-content:space-between;color:#888;font-size:11px;}
      </style></head><body>
      <div class="header"><img src="${logo}" alt="Falcon" />
        <div class="header-text"><h2>Cleaning Limit Software</h2>
          <p>Product Master Report</p><p>Generated: ${new Date().toLocaleString("en-IN")}</p></div></div>
      ${printRef.current.innerHTML}
      <div class="footer"><span>Falcon — Confidential</span>
        <span>Total Records: ${viewProducts.length}</span>
        <span>Printed by: ${currentUser || "Unknown"}</span></div>
      </body></html>`);
    win.document.close(); win.focus();
    setTimeout(() => { win.print(); win.close(); }, 500);
  };

  // ─── Utility ─────────────────────────────────────────────────────────────────
  const facilityName = (fid) =>
    facilities.find(f => f.facility_id === fid)?.facility_name || fid;

  const uspLabel = (v) =>
    USP_OPTIONS.find(o => o.value === String(v))?.label || "—";

  // ─── Reusable analytical fields block ────────────────────────────────────────
  const renderAnalyticalFields = (method, onMethod, lod, onLod, loq, onLoq, inputSt, labelSt) => {
    const lodN = parseFloat(lod), loqN = parseFloat(loq);
    const err = lod && loq && !isNaN(lodN) && !isNaN(loqN) && lodN >= loqN;
    return (
      <>
        <select value={method} onChange={e => onMethod(e.target.value)} style={inputSt}>
          <option value="">Select Analytical Method *</option>
          <option value="HPLC">HPLC</option>
          <option value="UV">UV Spectroscopy</option>
          <option value="TOC">TOC</option>
          <option value="GC">GC</option>
          <option value="IC">Ion Chromatography</option>
          <option value="Other">Other</option>
        </select>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginTop: "6px" }}>
          <div>
            <p style={labelSt}>LOD — Limit of Detection (ppm) *</p>
            <input type="number" min="0" placeholder="e.g. 0.5" value={lod} onChange={e => onLod(e.target.value)}
              style={{ ...inputSt, borderColor: err ? "#dc2626" : undefined, marginBottom: 0 }} />
          </div>
          <div>
            <p style={labelSt}>LOQ — Limit of Quantification (ppm) *</p>
            <input type="number" min="0" placeholder="e.g. 1.0" value={loq} onChange={e => onLoq(e.target.value)}
              style={{ ...inputSt, borderColor: err ? "#dc2626" : undefined, marginBottom: 0 }} />
          </div>
        </div>
        {err && <p style={{ color: "#dc2626", fontSize: "11px", marginTop: "4px" }}>❌ LOD must be less than LOQ</p>}
      </>
    );
  };

  // ─── Wizard step renderer ─────────────────────────────────────────────────────
  const renderStep = () => {
    const { id } = currentSteps[wizardStepIndex];

    // ── Step 1: Identity ──────────────────────────────────────────────────────
    if (id === "identity") return (
      <div>
        <p style={styles.stepTitle}>Product Identity</p>
        <p style={styles.stepHint}>Start with the product name and its manufacturing classification.</p>

        <input
          placeholder="Product Name / API Name *"
          value={name}
          onChange={e => setName(e.target.value)}
          style={styles.input}
          autoFocus
        />

        <p style={styles.fieldLabel}>Product Type *</p>
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          {PRODUCT_TYPES.map(type => (
            <button key={type} onClick={() => handleTypeChange(type)}
              style={productCategory === type ? styles.typeSelected : styles.typeUnselected}>
              {type}
            </button>
          ))}
        </div>

        {productCategory && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginTop: "18px" }}>
            <div>
              <p style={styles.fieldLabel}>CAS Registry Number</p>
              <input placeholder="e.g. 50-78-2" value={casNumber}
                onChange={e => setCasNumber(e.target.value)} style={styles.input} />
            </div>
            <div>
              <p style={styles.fieldLabel}>IUPAC Name</p>
              <input placeholder="IUPAC name of the compound" value={chemicalNumber}
                onChange={e => setChemicalNumber(e.target.value)} style={styles.input} />
            </div>
          </div>
        )}

      </div>
    );

    // ── Step 2: Clinical (API only) ───────────────────────────────────────────
    if (id === "clinical") return (
      <div>
        <p style={styles.stepTitle}>Clinical Profile</p>
        <p style={styles.stepHint}>
          Classify this API using the WHO ATC/DDD classification system and specify the route of administration.
        </p>

        <p style={styles.fieldLabel}>Therapeutic Category (WHO ATC)</p>
        <select value={therapeuticCategory} onChange={e => setTherapeuticCategory(e.target.value)} style={styles.input}>
          <option value="">— Select Category —</option>
          {allAtcOptions.map((cat, i) => <option key={i} value={cat}>{cat}</option>)}
        </select>

        {isAdmin && (
          <div style={styles.adminBox}>
            <p style={{ ...styles.fieldLabel, color: "#0369a1", marginBottom: "6px" }}>
              Add Custom ATC Category <span style={styles.adminBadge}>Admin</span>
            </p>
            <div style={{ display: "flex", gap: "8px" }}>
              <input
                placeholder="e.g. Z — Specialized Veterinary Products"
                value={newAtcInput}
                onChange={e => setNewAtcInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") addCustomAtc(); }}
                style={{ ...styles.input, flex: 1, marginBottom: 0 }}
              />
              <button onClick={addCustomAtc} style={{ ...styles.addStepBtn, padding: "10px 16px" }}>+ Add</button>
            </div>
            {atcCustom.length > 0 && (
              <p style={{ fontSize: "11px", color: "#0369a1", marginTop: "6px" }}>
                Custom: {atcCustom.join(" · ")}
              </p>
            )}
          </div>
        )}

        <p style={{ ...styles.fieldLabel, marginTop: "18px" }}>Route of Administration</p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
          {ROA_OPTIONS.map(roa => (
            <button key={roa} onClick={() => setRouteOfAdmin(roa)}
              style={routeOfAdmin === roa ? styles.typeSelected : styles.typeUnselected}>
              {roa}
            </button>
          ))}
        </div>
      </div>
    );

    // ── Step 3: Synthesis ─────────────────────────────────────────────────────
    if (id === "synthesis") return (
      <div>
        <p style={styles.stepTitle}>Synthesis Route</p>
        <p style={styles.stepHint}>
          Define each manufacturing step that involves a chemical change. Specify the step name,
          IUPAC name of the output compound, and its solubility profile for cleaning validation use.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {synthSteps.map((step, idx) => (
            <div key={idx} style={styles.synthRow}>
              <div style={styles.synthStepBadge}>Step {idx + 1}</div>
              <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                <input
                  placeholder="Step name (e.g. Nitration, Cyclization, Reduction)"
                  value={step.step_name}
                  onChange={e => updateSynthStep(idx, "step_name", e.target.value)}
                  style={styles.synthInput}
                />
                <div>
                  <input
                    placeholder="IUPAC name of output compound *"
                    value={step.iupac_name}
                    onChange={e => updateSynthStep(idx, "iupac_name", e.target.value)}
                    style={{ ...styles.synthInput, borderColor: step.step_name && !step.iupac_name ? "#dc2626" : undefined }}
                  />
                  {step.step_name && !step.iupac_name && (
                    <p style={{ color: "#dc2626", fontSize: "11px", margin: "3px 0 0 2px" }}>
                      IUPAC name is required for regulatory traceability.
                    </p>
                  )}
                </div>
                <input
                  placeholder="Soluble solvent (e.g. Water, Ethanol, DMSO)"
                  value={step.soluble_solvent}
                  onChange={e => updateSynthStep(idx, "soluble_solvent", e.target.value)}
                  style={styles.synthInput}
                />
                <select
                  value={step.solubility_usp}
                  onChange={e => updateSynthStep(idx, "solubility_usp", e.target.value)}
                  style={styles.synthInput}
                >
                  <option value="">USP Solubility Rating</option>
                  {USP_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              {synthSteps.length > 1 && (
                <button onClick={() => removeSynthStep(idx)} style={styles.synthRemoveBtn} title="Remove step">✕</button>
              )}
            </div>
          ))}
        </div>

        <button onClick={addSynthStep} style={styles.addStepBtn}>+ Add Step</button>

        <div style={{ marginTop: "16px", padding: "12px 14px", background: "#f0fdf4", border: "1px solid #86efac", borderRadius: "8px" }}>
          <p style={{ fontSize: "13px", fontWeight: "700", color: "#15803d", margin: "0 0 10px 0" }}>
            Final Product — Solubility Profile
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
            <input
              placeholder="Soluble solvent (e.g. Water, Ethanol, DMSO)"
              value={solubleSolvent}
              onChange={e => setSolubleSolvent(e.target.value)}
              style={styles.synthInput}
            />
            <select
              value={solubilityUsp}
              onChange={e => setSolubilityUsp(e.target.value)}
              style={styles.synthInput}
            >
              <option value="">USP Solubility Rating</option>
              {USP_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        </div>
      </div>
    );

    // ── Step 4: Dosage ────────────────────────────────────────────────────────
    const PDE_ROUTES = ["Oral", "Parenteral", "Respiratory", "Topical", "Rectal", "Others"];
    if (id === "dosage") return (
      <div>
        <p style={styles.stepTitle}>Dosage & Safety Parameters</p>
        <p style={styles.stepHint}>These values are used directly in MACO calculations: dose-based criterion uses Min Therapeutic Dose ÷ 1000; PDE-based criterion uses the selected PDE value.</p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
          <div>
            <p style={styles.fieldLabel}>Min Therapeutic Dose (mg)</p>
            <input placeholder="e.g. 10" value={minDose} onChange={e => setMinDose(e.target.value)}
              style={styles.input} type="number" min="0" />
          </div>
          <div>
            <p style={styles.fieldLabel}>Max Daily Dose (mg/day)</p>
            <input placeholder="e.g. 40" value={maxDose} onChange={e => setMaxDose(e.target.value)}
              style={styles.input} type="number" min="0" />
          </div>
          {(() => {
            const minD = parseFloat(minDose), maxD = parseFloat(maxDose);
            return (!isNaN(minD) && !isNaN(maxD) && minD > maxD)
              ? <p style={{ color: "#ef4444", fontSize: "12px", margin: "2px 0 0", gridColumn: "1 / -1" }}>
                  ❌ Minimum Therapeutic Dose cannot exceed Maximum Daily Dose
                </p>
              : null;
          })()}
        </div>

        <div style={{ marginTop: "18px", padding: "14px 16px", background: "#f0f9ff", border: "1px solid #bae6fd", borderRadius: "8px" }}>
          <p style={{ ...styles.fieldLabel, margin: "0 0 6px 0" }}>PDE — Permitted Daily Exposure</p>
          <p style={{ fontSize: "12px", color: "#64748b", margin: "0 0 12px 0" }}>Select one or more routes and enter the corresponding PDE value. The lowest value governs the MACO calculation.</p>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {PDE_ROUTES.map(route => {
              const active = route in pdeValues;
              return (
                <div key={route} style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <button type="button"
                    onClick={() => setPdeValues(prev => {
                      const next = { ...prev };
                      if (active) delete next[route]; else next[route] = "";
                      return next;
                    })}
                    style={{
                      minWidth: "120px", padding: "7px 14px", borderRadius: "6px", cursor: "pointer",
                      fontWeight: "600", fontSize: "13px", textAlign: "center",
                      border: `2px solid ${active ? "#004f9f" : "#d1d5db"}`,
                      background: active ? "#004f9f" : "white",
                      color: active ? "white" : "#374151",
                      transition: "all 0.15s",
                    }}>
                    {active ? "✓ " : ""}{route}
                  </button>
                  {active && (
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <input
                        type="number" min="0" step="0.001"
                        placeholder="e.g. 1.5"
                        value={pdeValues[route]}
                        onChange={e => setPdeValues(prev => ({ ...prev, [route]: e.target.value }))}
                        style={{ ...styles.input, width: "140px", marginBottom: 0 }}
                        autoFocus={pdeValues[route] === ""}
                      />
                      <span style={{ fontSize: "13px", color: "#475569" }}>mg/day</span>
                      {pdeValues[route] && !isNaN(Number(pdeValues[route])) && Number(pdeValues[route]) > 0 && (
                        <span style={{ fontSize: "11px", color: "#16a34a", fontWeight: "600" }}>✓</span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          {Object.keys(pdeValues).length > 1 && (() => {
            const vals = Object.values(pdeValues).map(Number).filter(v => !isNaN(v) && v > 0);
            const governing = vals.length ? Math.min(...vals) : null;
            const govRoute = governing !== null
              ? Object.entries(pdeValues).find(([, v]) => Number(v) === governing)?.[0]
              : null;
            return governing !== null ? (
              <div style={{ marginTop: "12px", padding: "8px 12px", background: "#dbeafe", borderRadius: "6px", fontSize: "12px", color: "#1d4ed8", fontWeight: "600" }}>
                Governing PDE: {governing} mg/day ({govRoute}) — lowest value used for MACO calculation
              </div>
            ) : null;
          })()}
        </div>
      </div>
    );

    // ── Step 5: Batch ─────────────────────────────────────────────────────────
    if (id === "batch") return (
      <div>
        <p style={styles.stepTitle}>Batch Parameters</p>
        <p style={styles.stepHint}>Max Batch Size is used for the 10 ppm MACO criterion (10 ppm × max batch size of next product).</p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
          <div>
            <p style={styles.fieldLabel}>Min Yield / Min Batch Size (kg)</p>
            <input placeholder="e.g. 80" value={minYieldKg} onChange={e => setMinYieldKg(e.target.value)}
              style={styles.input} type="number" min="0" />
          </div>
          <div>
            <p style={styles.fieldLabel}>Max Batch Size (kg)</p>
            <input placeholder="e.g. 100" value={maxBatchKg} onChange={e => setMaxBatchKg(e.target.value)}
              style={styles.input} type="number" min="0" />
          </div>
        </div>
      </div>
    );

    // ── Step 6: Analytical ────────────────────────────────────────────────────
    if (id === "analytical") {
      const analyticalSteps = synthSteps.filter(s => s.step_name || s.iupac_name);
      return (
        <div>
          <p style={styles.stepTitle}>Analytical Method</p>
          <p style={styles.stepHint}>LOQ is the acceptance criterion baseline — rinse/swab results must exceed LOQ to PASS. Each step and the final product require their own analytical details.</p>
          <div style={{ display: "flex", flexDirection: "column", gap: "14px", marginTop: "8px" }}>
            {analyticalSteps.map((s, i) => {
              const realIdx = synthSteps.indexOf(s);
              return (
                <div key={i} style={styles.stepEquipCard}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
                    <span style={styles.synthStepBadge}>Step {i + 1}</span>
                    <strong style={{ fontSize: "14px", color: "#1e293b" }}>{s.step_name || s.iupac_name}</strong>
                  </div>
                  {renderAnalyticalFields(
                    s.analytical_method,
                    v => updateSynthStep(realIdx, "analytical_method", v),
                    s.lod_ppm,
                    v => updateSynthStep(realIdx, "lod_ppm", v),
                    s.loq_ppm,
                    v => updateSynthStep(realIdx, "loq_ppm", v),
                    styles.input,
                    styles.fieldLabel
                  )}
                </div>
              );
            })}
            <div style={{ ...styles.stepEquipCard, borderColor: "#16a34a", background: "#f0fdf4" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
                <span style={styles.productStepBadge}>Product</span>
                <strong style={{ fontSize: "14px", color: "#1e293b" }}>{name || "Final Product"}</strong>
              </div>
              {renderAnalyticalFields(
                analyticalMethod, setAnalyticalMethod,
                lodPpm, setLodPpm,
                loqPpm, setLoqPpm,
                styles.input, styles.fieldLabel
              )}
            </div>
          </div>
        </div>
      );
    }

    // ── Step 7: Equipment ─────────────────────────────────────────────────────
    if (id === "equipment") {
      const validSynthSteps = synthSteps.filter(s => s.step_name || s.iupac_name);
      const usePerStep = validSynthSteps.length > 0;
      return (
        <div>
          <p style={styles.stepTitle}>Facility & Equipment Mapping</p>
          <p style={styles.stepHint}>
            Select the facility, then for each synthesis step specify which equipment is used
            and the compound that must be tested during changeover cleaning.
          </p>

          <p style={styles.fieldLabel}>Facility *</p>
          <select value={facilityId} onChange={e => setFacilityId(e.target.value)} style={styles.input}>
            <option value="">— Select Facility —</option>
            {facilities.map(f => <option key={f.facility_id} value={f.facility_id}>{f.facility_name}</option>)}
          </select>
          {facilityId && equipmentList.length === 0 && (
            <p style={{ color: "#cc0000", fontSize: "13px", marginTop: "8px" }}>No equipment found for this facility.</p>
          )}

          {facilityId && equipmentList.length > 0 && (
            usePerStep ? (
              /* Per-step equipment mapping */
              <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginTop: "16px" }}>
                {stepEquipmentMap.map((sm, mapIdx) => (
                  <div key={mapIdx} style={styles.stepEquipCard}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
                      <span style={sm.is_product ? styles.productStepBadge : styles.synthStepBadge}>
                        {sm.is_product ? "Product" : `Step ${sm.step_index + 1}`}
                      </span>
                      <strong style={{ fontSize: "14px", color: "#1e293b" }}>{sm.step_name}</strong>
                    </div>
                    <label style={styles.equipCardLabel}>Compound to test during changeover</label>
                    <input
                      value={sm.test_compound}
                      onChange={e => updateStepTestCompound(mapIdx, e.target.value)}
                      placeholder="IUPAC name of compound to test"
                      style={{ ...styles.input, marginBottom: "10px", background: "#fefce8", borderColor: "#fbbf24" }}
                    />
                    <label style={styles.equipCardLabel}>Equipment used in this step</label>
                    <div style={styles.checkboxBox}>
                      {equipmentList.filter(eq => {
                        if (sm.equipment_ids.includes(eq.equipment_id)) return true;
                        const allOptIds = new Set(sm.equipment_ids.flatMap(pid => (sm.optional_equipment || {})[pid] || []));
                        return !allOptIds.has(eq.equipment_id);
                      }).map(eq => (
                        <div key={eq.equipment_id}>
                          <label style={styles.checkboxLabel}>
                            <input type="checkbox"
                              checked={sm.equipment_ids.includes(eq.equipment_id)}
                              onChange={() => toggleStepEquipment(mapIdx, eq.equipment_id)} />
                            <span style={{ flex: 1, fontWeight: "500" }}>{eq.equipment_name}</span>
                            <span style={{ color: "#666", fontSize: "12px" }}>
                              {(eq.surface_area_cm2 / 6.4516).toFixed(2)} in² · {eq.rinse_volume_liters || 0} L
                            </span>
                          </label>
                          {sm.equipment_ids.includes(eq.equipment_id) && (
                            <div style={{ paddingLeft: "26px", marginTop: "4px", marginBottom: "8px" }}>
                              <div style={{ background: "#f0f9ff", border: "1px solid #bae6fd", borderRadius: "6px", padding: "8px 10px", marginBottom: "6px" }}>
                                <p style={{ fontSize: "11px", fontWeight: "600", color: "#0369a1", margin: "0 0 6px 0" }}>Sample Area Configuration</p>
                                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                                  <span style={{ fontSize: "11px", color: "#475569", minWidth: "180px" }}>Swab sample area (validated method):</span>
                                  <select
                                    value={(sm.swab_areas || {})[eq.equipment_id] ?? 9}
                                    onChange={e => updateStepSwabArea(mapIdx, eq.equipment_id, parseInt(e.target.value))}
                                    style={{ fontSize: "12px", padding: "2px 6px", borderRadius: "4px", border: "1px solid #cbd5e1", background: "#f8fafc", cursor: "pointer" }}>
                                    {[2,3,4,5,6,7,8,9].map(n => <option key={n} value={n}>{n} in²</option>)}
                                  </select>
                                </div>
                                <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                                  <span style={{ fontSize: "11px", color: "#475569", minWidth: "180px" }}>Rinse sample area (validated method):</span>
                                  <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                                    <input
                                      type="text"
                                      inputMode="decimal"
                                      value={(sm.rinse_areas || {})[eq.equipment_id] ?? parseFloat((eq.surface_area_cm2 / 6.4516).toFixed(2))}
                                      onChange={e => { const v = parseFloat(e.target.value); if (!isNaN(v) && v > 0) updateStepRinseArea(mapIdx, eq.equipment_id, v); }}
                                      style={{ fontSize: "12px", padding: "2px 6px", borderRadius: "4px", width: "70px",
                                        border: `1px solid ${((sm.rinse_areas || {})[eq.equipment_id] ?? parseFloat((eq.surface_area_cm2 / 6.4516).toFixed(2))) > parseFloat((eq.surface_area_cm2 / 6.4516).toFixed(2)) ? "#ef4444" : "#7dd3fc"}`,
                                        background: "#f0f9ff" }}
                                    />
                                    <span style={{ fontSize: "11px", color: "#64748b" }}>in²</span>
                                    <span style={{ fontSize: "11px", color: "#94a3b8" }}>(max: {(eq.surface_area_cm2 / 6.4516).toFixed(2)} in²)</span>
                                  </div>
                                  {((sm.rinse_areas || {})[eq.equipment_id] ?? parseFloat((eq.surface_area_cm2 / 6.4516).toFixed(2))) > parseFloat((eq.surface_area_cm2 / 6.4516).toFixed(2)) && (
                                    <span style={{ fontSize: "11px", color: "#ef4444", fontWeight: "600" }}>Cannot exceed equipment surface area</span>
                                  )}
                                </div>
                              </div>
                              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                <span style={{ fontSize: "11px", color: "#475569" }}>Optional equipment available?</span>
                                {[false, true].map(val => (
                                  <button key={String(val)}
                                    onClick={() => setStepOptionalEnabled(mapIdx, eq.equipment_id, val)}
                                    style={{ fontSize: "11px", padding: "2px 10px", borderRadius: "4px", cursor: "pointer", fontWeight: "600",
                                      border: "1px solid",
                                      borderColor: ((sm.optional_equipment_enabled || {})[eq.equipment_id] === val) ? (val ? "#16a34a" : "#94a3b8") : "#e2e8f0",
                                      background: ((sm.optional_equipment_enabled || {})[eq.equipment_id] === val) ? (val ? "#dcfce7" : "#f1f5f9") : "white",
                                      color: ((sm.optional_equipment_enabled || {})[eq.equipment_id] === val) ? (val ? "#15803d" : "#475569") : "#94a3b8",
                                    }}>
                                    {val ? "Yes" : "No"}
                                  </button>
                                ))}
                              </div>
                              {(sm.optional_equipment_enabled || {})[eq.equipment_id] === true && (() => {
                                const claimedByOthers = new Set(
                                  sm.equipment_ids
                                    .filter(pid => pid !== eq.equipment_id)
                                    .flatMap(pid => (sm.optional_equipment || {})[pid] || [])
                                );
                                const sameCatList = equipmentList.filter(oe =>
                                  oe.equipment_id !== eq.equipment_id &&
                                  !claimedByOthers.has(oe.equipment_id) &&
                                  (eq.category_id == null || oe.category_id === eq.category_id)
                                );
                                return (
                                <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "6px", padding: "8px 10px", marginTop: "6px" }}>
                                  <p style={{ fontSize: "11px", fontWeight: "600", color: "#475569", margin: "0 0 4px 0" }}>
                                    Select optional equipment for this step:
                                    {eq.category_id != null && (
                                      <span style={{ fontWeight: "400", color: "#7c3aed", marginLeft: "6px" }}>
                                        ({eq.category_name || "same category"} only)
                                      </span>
                                    )}
                                  </p>
                                  {sameCatList.length === 0 ? (
                                    <p style={{ fontSize: "11px", color: "#94a3b8", margin: 0 }}>
                                      No other {eq.category_name || "same-category"} equipment in this facility.
                                    </p>
                                  ) : (
                                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                                    {sameCatList.map(oe => {
                                      const isChecked = ((sm.optional_equipment || {})[eq.equipment_id] || []).includes(oe.equipment_id);
                                      return (
                                        <div key={oe.equipment_id}>
                                          <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", color: "#374151", cursor: "pointer" }}>
                                            <input type="checkbox"
                                              checked={isChecked}
                                              onChange={() => toggleStepOptionalEquipment(mapIdx, eq.equipment_id, oe.equipment_id)} />
                                            {oe.equipment_name}
                                            <span style={{ color: "#94a3b8", fontSize: "11px" }}>
                                              {(oe.surface_area_cm2 / 6.4516).toFixed(2)} in²
                                            </span>
                                          </label>
                                          {isChecked && (
                                            <div style={{ paddingLeft: "20px", marginTop: "3px", background: "#f0f9ff", border: "1px solid #bae6fd", borderRadius: "5px", padding: "6px 10px" }}>
                                              <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "3px" }}>
                                                <span style={{ fontSize: "11px", color: "#64748b", minWidth: "150px" }}>Swab sample area:</span>
                                                <select
                                                  value={((sm.optional_swab_areas || {})[eq.equipment_id] || {})[oe.equipment_id] ?? 9}
                                                  onChange={e => updateStepOptionalSwabArea(mapIdx, eq.equipment_id, oe.equipment_id, parseInt(e.target.value))}
                                                  style={{ fontSize: "12px", padding: "2px 6px", borderRadius: "4px", border: "1px solid #cbd5e1", background: "#f8fafc", cursor: "pointer" }}>
                                                  {[2,3,4,5,6,7,8,9].map(n => <option key={n} value={n}>{n} in²</option>)}
                                                </select>
                                              </div>
                                              <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                                                <span style={{ fontSize: "11px", color: "#64748b", minWidth: "150px" }}>Rinse sample area:</span>
                                                <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                                                  <input
                                                    type="text"
                                                    inputMode="decimal"
                                                    value={((sm.optional_rinse_areas || {})[eq.equipment_id] || {})[oe.equipment_id] ?? parseFloat((oe.surface_area_cm2 / 6.4516).toFixed(2))}
                                                    onChange={e => { const v = parseFloat(e.target.value); if (!isNaN(v) && v > 0) updateStepOptionalRinseArea(mapIdx, eq.equipment_id, oe.equipment_id, v); }}
                                                    style={{ fontSize: "12px", padding: "2px 6px", borderRadius: "4px", width: "70px",
                                                      border: `1px solid ${(((sm.optional_rinse_areas || {})[eq.equipment_id] || {})[oe.equipment_id] ?? parseFloat((oe.surface_area_cm2 / 6.4516).toFixed(2))) > parseFloat((oe.surface_area_cm2 / 6.4516).toFixed(2)) ? "#ef4444" : "#7dd3fc"}`,
                                                      background: "#f0f9ff" }}
                                                  />
                                                  <span style={{ fontSize: "11px", color: "#64748b" }}>in²</span>
                                                  <span style={{ fontSize: "11px", color: "#94a3b8" }}>(max: {(oe.surface_area_cm2 / 6.4516).toFixed(2)} in²)</span>
                                                </div>
                                                {(((sm.optional_rinse_areas || {})[eq.equipment_id] || {})[oe.equipment_id] ?? parseFloat((oe.surface_area_cm2 / 6.4516).toFixed(2))) > parseFloat((oe.surface_area_cm2 / 6.4516).toFixed(2)) && (
                                                  <span style={{ fontSize: "11px", color: "#ef4444", fontWeight: "600" }}>Cannot exceed equipment surface area</span>
                                                )}
                                              </div>
                                            </div>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                  )}
                                </div>
                                );
                              })()}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              /* No synthesis steps — product-level equipment selection with full config */
              (() => {
                const sm = stepEquipmentMap[0];
                if (!sm) return null;
                const mapIdx = 0;
                return (
                  <div style={{ marginTop: "16px" }}>
                    <label style={styles.equipCardLabel}>Equipment * (select all that are used)</label>
                    <div style={styles.checkboxBox}>
                      {equipmentList.filter(eq => {
                        if (sm.equipment_ids.includes(eq.equipment_id)) return true;
                        const allOptIds = new Set(sm.equipment_ids.flatMap(pid => (sm.optional_equipment || {})[pid] || []));
                        return !allOptIds.has(eq.equipment_id);
                      }).map(eq => (
                        <div key={eq.equipment_id}>
                          <label style={styles.checkboxLabel}>
                            <input type="checkbox"
                              checked={sm.equipment_ids.includes(eq.equipment_id)}
                              onChange={() => toggleStepEquipment(mapIdx, eq.equipment_id)} />
                            <span style={{ flex: 1, fontWeight: "500" }}>{eq.equipment_name}</span>
                            <span style={{ color: "#666", fontSize: "12px" }}>
                              {(eq.surface_area_cm2 / 6.4516).toFixed(2)} in² · {eq.rinse_volume_liters || 0} L
                            </span>
                          </label>
                          {sm.equipment_ids.includes(eq.equipment_id) && (
                            <div style={{ paddingLeft: "26px", marginTop: "4px", marginBottom: "8px" }}>
                              <div style={{ background: "#f0f9ff", border: "1px solid #bae6fd", borderRadius: "6px", padding: "8px 10px", marginBottom: "6px" }}>
                                <p style={{ fontSize: "11px", fontWeight: "600", color: "#0369a1", margin: "0 0 6px 0" }}>Sample Area Configuration</p>
                                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                                  <span style={{ fontSize: "11px", color: "#475569", minWidth: "180px" }}>Swab sample area (validated method):</span>
                                  <select
                                    value={(sm.swab_areas || {})[eq.equipment_id] ?? 9}
                                    onChange={e => updateStepSwabArea(mapIdx, eq.equipment_id, parseInt(e.target.value))}
                                    style={{ fontSize: "12px", padding: "2px 6px", borderRadius: "4px", border: "1px solid #cbd5e1", background: "#f8fafc", cursor: "pointer" }}>
                                    {[2,3,4,5,6,7,8,9].map(n => <option key={n} value={n}>{n} in²</option>)}
                                  </select>
                                </div>
                                <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                                  <span style={{ fontSize: "11px", color: "#475569", minWidth: "180px" }}>Rinse sample area (validated method):</span>
                                  <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                                    <input
                                      type="text"
                                      inputMode="decimal"
                                      value={(sm.rinse_areas || {})[eq.equipment_id] ?? parseFloat((eq.surface_area_cm2 / 6.4516).toFixed(2))}
                                      onChange={e => { const v = parseFloat(e.target.value); if (!isNaN(v) && v > 0) updateStepRinseArea(mapIdx, eq.equipment_id, v); }}
                                      style={{ fontSize: "12px", padding: "2px 6px", borderRadius: "4px", width: "70px",
                                        border: `1px solid ${((sm.rinse_areas || {})[eq.equipment_id] ?? parseFloat((eq.surface_area_cm2 / 6.4516).toFixed(2))) > parseFloat((eq.surface_area_cm2 / 6.4516).toFixed(2)) ? "#ef4444" : "#7dd3fc"}`,
                                        background: "#f0f9ff" }}
                                    />
                                    <span style={{ fontSize: "11px", color: "#64748b" }}>in²</span>
                                    <span style={{ fontSize: "11px", color: "#94a3b8" }}>(max: {(eq.surface_area_cm2 / 6.4516).toFixed(2)} in²)</span>
                                  </div>
                                  {((sm.rinse_areas || {})[eq.equipment_id] ?? parseFloat((eq.surface_area_cm2 / 6.4516).toFixed(2))) > parseFloat((eq.surface_area_cm2 / 6.4516).toFixed(2)) && (
                                    <span style={{ fontSize: "11px", color: "#ef4444", fontWeight: "600" }}>Cannot exceed equipment surface area</span>
                                  )}
                                </div>
                              </div>
                              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                <span style={{ fontSize: "11px", color: "#475569" }}>Optional equipment available?</span>
                                {[false, true].map(val => (
                                  <button key={String(val)} type="button"
                                    onClick={() => setStepOptionalEnabled(mapIdx, eq.equipment_id, val)}
                                    style={{ fontSize: "11px", padding: "2px 10px", borderRadius: "4px", cursor: "pointer", fontWeight: "600",
                                      border: "1px solid",
                                      borderColor: ((sm.optional_equipment_enabled || {})[eq.equipment_id] === val) ? (val ? "#16a34a" : "#94a3b8") : "#e2e8f0",
                                      background: ((sm.optional_equipment_enabled || {})[eq.equipment_id] === val) ? (val ? "#dcfce7" : "#f1f5f9") : "white",
                                      color: ((sm.optional_equipment_enabled || {})[eq.equipment_id] === val) ? (val ? "#15803d" : "#475569") : "#94a3b8",
                                    }}>
                                    {val ? "Yes" : "No"}
                                  </button>
                                ))}
                              </div>
                              {(sm.optional_equipment_enabled || {})[eq.equipment_id] === true && (() => {
                                const claimedByOthers = new Set(
                                  sm.equipment_ids
                                    .filter(pid => pid !== eq.equipment_id)
                                    .flatMap(pid => (sm.optional_equipment || {})[pid] || [])
                                );
                                const sameCatList = equipmentList.filter(oe =>
                                  oe.equipment_id !== eq.equipment_id &&
                                  !claimedByOthers.has(oe.equipment_id) &&
                                  (eq.category_id == null || oe.category_id === eq.category_id)
                                );
                                return (
                                  <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "6px", padding: "8px 10px", marginTop: "6px" }}>
                                    <p style={{ fontSize: "11px", fontWeight: "600", color: "#475569", margin: "0 0 4px 0" }}>
                                      Select optional equipment:
                                      {eq.category_id != null && (
                                        <span style={{ fontWeight: "400", color: "#7c3aed", marginLeft: "6px" }}>
                                          ({eq.category_name || "same category"} only)
                                        </span>
                                      )}
                                    </p>
                                    {sameCatList.length === 0 ? (
                                      <p style={{ fontSize: "11px", color: "#94a3b8", margin: 0 }}>No other same-category equipment in this facility.</p>
                                    ) : (
                                      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                                        {sameCatList.map(oe => {
                                          const isChecked = ((sm.optional_equipment || {})[eq.equipment_id] || []).includes(oe.equipment_id);
                                          return (
                                            <div key={oe.equipment_id}>
                                              <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", color: "#374151", cursor: "pointer" }}>
                                                <input type="checkbox"
                                                  checked={isChecked}
                                                  onChange={() => toggleStepOptionalEquipment(mapIdx, eq.equipment_id, oe.equipment_id)} />
                                                {oe.equipment_name}
                                                <span style={{ color: "#94a3b8", fontSize: "11px" }}>{(oe.surface_area_cm2 / 6.4516).toFixed(2)} in²</span>
                                              </label>
                                              {isChecked && (
                                                <div style={{ marginLeft: "20px", marginTop: "3px", background: "#f0f9ff", border: "1px solid #bae6fd", borderRadius: "5px", padding: "6px 10px" }}>
                                                  <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "3px" }}>
                                                    <span style={{ fontSize: "11px", color: "#64748b", minWidth: "150px" }}>Swab sample area:</span>
                                                    <select
                                                      value={((sm.optional_swab_areas || {})[eq.equipment_id] || {})[oe.equipment_id] ?? 9}
                                                      onChange={e => updateStepOptionalSwabArea(mapIdx, eq.equipment_id, oe.equipment_id, parseInt(e.target.value))}
                                                      style={{ fontSize: "12px", padding: "2px 6px", borderRadius: "4px", border: "1px solid #cbd5e1", background: "#f8fafc", cursor: "pointer" }}>
                                                      {[2,3,4,5,6,7,8,9].map(n => <option key={n} value={n}>{n} in²</option>)}
                                                    </select>
                                                  </div>
                                                  <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                                                    <span style={{ fontSize: "11px", color: "#64748b", minWidth: "150px" }}>Rinse sample area:</span>
                                                    <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                                                      <input
                                                        type="text"
                                                        inputMode="decimal"
                                                        value={((sm.optional_rinse_areas || {})[eq.equipment_id] || {})[oe.equipment_id] ?? parseFloat((oe.surface_area_cm2 / 6.4516).toFixed(2))}
                                                        onChange={e => { const v = parseFloat(e.target.value); if (!isNaN(v) && v > 0) updateStepOptionalRinseArea(mapIdx, eq.equipment_id, oe.equipment_id, v); }}
                                                        style={{ fontSize: "12px", padding: "2px 6px", borderRadius: "4px", width: "70px",
                                                          border: `1px solid ${(((sm.optional_rinse_areas || {})[eq.equipment_id] || {})[oe.equipment_id] ?? parseFloat((oe.surface_area_cm2 / 6.4516).toFixed(2))) > parseFloat((oe.surface_area_cm2 / 6.4516).toFixed(2)) ? "#ef4444" : "#7dd3fc"}`,
                                                          background: "#f0f9ff" }}
                                                      />
                                                      <span style={{ fontSize: "11px", color: "#64748b" }}>in²</span>
                                                      <span style={{ fontSize: "11px", color: "#94a3b8" }}>(max: {(oe.surface_area_cm2 / 6.4516).toFixed(2)} in²)</span>
                                                    </div>
                                                    {(((sm.optional_rinse_areas || {})[eq.equipment_id] || {})[oe.equipment_id] ?? parseFloat((oe.surface_area_cm2 / 6.4516).toFixed(2))) > parseFloat((oe.surface_area_cm2 / 6.4516).toFixed(2)) && (
                                                      <span style={{ fontSize: "11px", color: "#ef4444", fontWeight: "600" }}>Cannot exceed equipment surface area</span>
                                                    )}
                                                  </div>
                                                </div>
                                              )}
                                            </div>
                                          );
                                        })}
                                      </div>
                                    )}
                                  </div>
                                );
                              })()}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()
            )
          )}

          {/* Shared equipment sequence picker */}
          {Object.keys(equipmentSequence).length > 0 && (
            <div style={styles.seqSection}>
              <p style={{ ...styles.fieldLabel, color: "#713f12", marginBottom: "4px" }}>
                Shared Equipment — Usage Sequence
              </p>
              <p style={{ fontSize: "12px", color: "#92400e", marginBottom: "12px", lineHeight: "1.5" }}>
                The equipment below is used in more than one step. Set the order in which each step uses it for cleaning validation sequencing.
              </p>
              {Object.entries(equipmentSequence).map(([eidStr, orderedSteps]) => {
                const eid = parseInt(eidStr);
                const eq = equipmentList.find(e => e.equipment_id === eid);
                if (!eq) return null;
                return (
                  <div key={eid} style={{ marginBottom: "14px" }}>
                    <p style={{ fontSize: "13px", fontWeight: "700", color: "#374151", marginBottom: "6px" }}>
                      {eq.equipment_name}
                    </p>
                    {orderedSteps.map((stepIdx, pos) => {
                      const sm = stepEquipmentMap.find(m => m.step_index === stepIdx);
                      if (!sm) return null;
                      const isLast = pos === orderedSteps.length - 1;
                      return (
                        <div key={stepIdx} style={{ ...styles.seqRow, border: isLast ? "1px solid #86efac" : "1px solid #e2e8f0", background: isLast ? "#f0fdf4" : "white" }}>
                          <span style={{ fontSize: "12px", color: "#888", minWidth: "20px", fontWeight: "700" }}>{pos + 1}.</span>
                          <span style={{ ...(sm.is_product ? styles.productStepBadge : styles.synthStepBadge), marginTop: 0 }}>
                            {sm.is_product ? "Product" : `Step ${sm.step_index + 1}`}
                          </span>
                          <span style={{ flex: 1, fontSize: "13px", color: "#374151" }}>{sm.step_name}</span>
                          {isLast && <span style={{ fontSize: "11px", color: "#16a34a", fontWeight: "700", whiteSpace: "nowrap" }}>★ Recommended</span>}
                          <button onClick={() => moveSeqUp(eid, pos)} disabled={pos === 0} style={pos === 0 ? styles.seqBtnDisabled : styles.seqBtn} title="Used earlier">↑</button>
                          <button onClick={() => moveSeqDown(eid, pos)} disabled={pos === orderedSteps.length - 1} style={pos === orderedSteps.length - 1 ? styles.seqBtnDisabled : styles.seqBtn} title="Used later">↓</button>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      );
    }

    // ── Step 9: Review ────────────────────────────────────────────────────────
    if (id === "review") return (
      <div>
        <p style={styles.stepTitle}>Review & Submit</p>
        <p style={styles.stepHint}>Verify all information below. Once submitted an audit record is created; changes require a password and reason.</p>

        <div style={styles.reviewSection}>
          <p style={styles.reviewLabel}>Product Identity</p>
          <div style={styles.reviewGrid}>
            <span style={styles.rk}>Name</span>
            <span style={styles.rv}>{name || "—"}</span>
            <span style={styles.rk}>Type</span>
            <span style={styles.rv}>
              <span style={{ ...styles.typeBadge, background: productCategory === "API" ? "#dbeafe" : productCategory === "Intermediate" ? "#fef3c7" : "#f3f4f6", color: productCategory === "API" ? "#1d4ed8" : productCategory === "Intermediate" ? "#92400e" : "#374151" }}>
                {productCategory || "—"}
              </span>
            </span>
            <span style={styles.rk}>CAS Number</span>
            <span style={styles.rv}>{casNumber || "—"}</span>
            <span style={styles.rk}>IUPAC Name</span>
            <span style={styles.rv}>{chemicalNumber || "—"}</span>
          </div>
        </div>

        {productCategory === "API" && (
          <div style={styles.reviewSection}>
            <p style={styles.reviewLabel}>Clinical Profile</p>
            <div style={styles.reviewGrid}>
              <span style={styles.rk}>Therapeutic Category</span>
              <span style={styles.rv}>{therapeuticCategory || "—"}</span>
              <span style={styles.rk}>Route of Administration</span>
              <span style={styles.rv}>{routeOfAdmin || "—"}</span>
            </div>
          </div>
        )}

        {synthSteps.some(s => s.step_name || s.iupac_name) && (
          <div style={styles.reviewSection}>
            <p style={styles.reviewLabel}>Synthesis Route</p>
            {synthSteps.filter(s => s.step_name || s.iupac_name).map((s, i) => (
              <div key={i} style={{ fontSize: "13px", padding: "6px 4px", borderBottom: "1px solid #f1f5f9", display: "grid", gridTemplateColumns: "auto 1fr", gap: "6px 12px", alignItems: "baseline" }}>
                <span style={{ color: "#004f9f", fontWeight: "700", fontSize: "12px" }}>Step {i + 1}</span>
                <span>
                  <strong>{s.step_name || "—"}</strong>
                  {s.iupac_name && <span style={{ color: "#555" }}> → <em>{s.iupac_name}</em></span>}
                  {(s.soluble_solvent || s.solubility_usp) && (
                    <span style={{ color: "#888", fontSize: "12px", marginLeft: "8px" }}>
                      {s.soluble_solvent && `Solvent: ${s.soluble_solvent}`}
                      {s.soluble_solvent && s.solubility_usp && " · "}
                      {s.solubility_usp && `USP ${s.solubility_usp}`}
                    </span>
                  )}
                </span>
              </div>
            ))}
            {/* Final product row */}
            <div style={{ fontSize: "13px", padding: "6px 4px", marginTop: "4px", display: "grid", gridTemplateColumns: "auto 1fr", gap: "6px 12px", alignItems: "baseline", background: "#f0fdf4", borderRadius: "4px" }}>
              <span style={{ ...styles.productStepBadge, fontSize: "12px", marginTop: 0 }}>Product</span>
              <span>
                <strong>{name || "—"}</strong>
                {chemicalNumber && <span style={{ color: "#555" }}> → <em>{chemicalNumber}</em></span>}
                {(solubleSolvent || solubilityUsp) && (
                  <span style={{ color: "#888", fontSize: "12px", marginLeft: "8px" }}>
                    {solubleSolvent && `Solvent: ${solubleSolvent}`}
                    {solubleSolvent && solubilityUsp && " · "}
                    {solubilityUsp && `USP ${solubilityUsp}`}
                  </span>
                )}
              </span>
            </div>
          </div>
        )}

        <div style={styles.reviewSection}>
          <p style={styles.reviewLabel}>Dosage & Batch</p>
          <div style={styles.reviewGrid}>
            <span style={styles.rk}>Min Therapeutic Dose</span><span style={styles.rv}>{minDose ? `${minDose} mg` : "—"}</span>
            <span style={styles.rk}>Max Daily Dose</span><span style={styles.rv}>{maxDose ? `${maxDose} mg/day` : "—"}</span>
            <span style={styles.rk}>PDE</span>
            <span style={styles.rv}>
              {Object.keys(pdeValues).length > 0
                ? Object.entries(pdeValues).filter(([, v]) => v).map(([r, v]) => `${r}: ${v} mg/day`).join(" · ") || "—"
                : "—"}
            </span>
            <span style={styles.rk}>Min Yield</span><span style={styles.rv}>{minYieldKg ? `${minYieldKg} kg` : "—"}</span>
            <span style={styles.rk}>Max Batch Size</span><span style={styles.rv}>{maxBatchKg ? `${maxBatchKg} kg` : "—"}</span>
          </div>
        </div>

        <div style={styles.reviewSection}>
          <p style={styles.reviewLabel}>Analytical Method</p>
          {synthSteps.filter(s => s.step_name || s.iupac_name).map((s, i) => (
            <div key={i} style={{ marginBottom: "8px", paddingBottom: "8px", borderBottom: "1px solid #e2e8f0" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                <span style={styles.synthStepBadge}>Step {i + 1}</span>
                <span style={{ fontSize: "13px", fontWeight: "600", color: "#1e293b" }}>{s.step_name || s.iupac_name}</span>
              </div>
              <div style={styles.reviewGrid}>
                <span style={styles.rk}>Method</span><span style={styles.rv}>{s.analytical_method || "—"}</span>
                <span style={styles.rk}>LOD</span><span style={styles.rv}>{s.lod_ppm ? `${s.lod_ppm} ppm` : "—"}</span>
                <span style={styles.rk}>LOQ</span><span style={styles.rv}>{s.loq_ppm ? `${s.loq_ppm} ppm` : "—"}</span>
              </div>
            </div>
          ))}
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
              <span style={styles.productStepBadge}>Product</span>
              <span style={{ fontSize: "13px", fontWeight: "600", color: "#1e293b" }}>{name || "Final Product"}</span>
            </div>
            <div style={styles.reviewGrid}>
              <span style={styles.rk}>Method</span><span style={styles.rv}>{analyticalMethod || "—"}</span>
              <span style={styles.rk}>LOD</span><span style={styles.rv}>{lodPpm ? `${lodPpm} ppm` : "—"}</span>
              <span style={styles.rk}>LOQ</span><span style={styles.rv}>{loqPpm ? `${loqPpm} ppm` : "—"}</span>
            </div>
          </div>
        </div>

        <div style={styles.reviewSection}>
          <p style={styles.reviewLabel}>Equipment</p>
          <div style={styles.reviewGrid}>
            <span style={styles.rk}>Facility</span>
            <span style={styles.rv}>{facilityName(parseInt(facilityId)) || "—"}</span>
          </div>
          {stepEquipmentMap.length > 0 ? (
            stepEquipmentMap.map((sm, i) => (
              <div key={i} style={{ marginTop: "8px", paddingTop: "6px", borderTop: "1px solid #e2e8f0" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                  <span style={{ ...(sm.is_product ? styles.productStepBadge : styles.synthStepBadge), fontSize: "10px" }}>
                    {sm.is_product ? "Product" : `Step ${sm.step_index + 1}`}
                  </span>
                  <span style={{ fontSize: "12px", fontWeight: "600", color: "#374151" }}>{sm.step_name}</span>
                </div>
                <div style={styles.reviewGrid}>
                  <span style={styles.rk}>Test Compound</span>
                  <span style={{ ...styles.rv, fontStyle: "italic" }}>{sm.test_compound || "—"}</span>
                  <span style={styles.rk}>Equipment</span>
                  <span style={styles.rv}>
                    {sm.equipment_ids.length > 0 ? (
                      <span>
                        {equipmentList.filter(e => sm.equipment_ids.includes(e.equipment_id)).map(e => {
                          const optIds = (sm.optional_equipment || {})[e.equipment_id] || [];
                          const optNames = equipmentList.filter(oe => optIds.includes(oe.equipment_id)).map(oe => oe.equipment_name);
                          return (
                            <span key={e.equipment_id} style={{ display: "block", marginBottom: "2px" }}>
                              {e.equipment_name}
                              <span style={{ color: "#64748b", fontSize: "11px", marginLeft: "6px" }}>
                                (Swab: {(sm.swab_areas || {})[e.equipment_id] ?? 9} in² · Rinse: {(sm.rinse_areas || {})[e.equipment_id] ?? 9} in²)
                              </span>
                              {optIds.length > 0 && (
                                <span style={{ color: "#7c3aed", fontSize: "11px", marginLeft: "6px" }}>
                                  + optional: {equipmentList.filter(oe => optIds.includes(oe.equipment_id)).map(oe => {
                                    const osa = ((sm.optional_swab_areas || {})[e.equipment_id] || {})[oe.equipment_id] ?? 9;
                                    const ora = ((sm.optional_rinse_areas || {})[e.equipment_id] || {})[oe.equipment_id] ?? 9;
                                    return `${oe.equipment_name} (S:${osa} R:${ora} in²)`;
                                  }).join(", ")}
                                </span>
                              )}
                            </span>
                          );
                        })}
                      </span>
                    ) : "—"}
                  </span>
                </div>
              </div>
            ))
          ) : (
            <div style={styles.reviewGrid}>
              <span style={styles.rk}>Equipment</span>
              <span style={styles.rv}>
                {selectedEquipment.length > 0
                  ? equipmentList.filter(e => selectedEquipment.includes(e.equipment_id)).map(e => e.equipment_name).join(", ")
                  : "—"}
              </span>
            </div>
          )}
        </div>

        {Object.keys(equipmentSequence).length > 0 && (
          <div style={{ marginBottom: "14px", padding: "14px 16px", background: "#f0fdf4", border: "1px solid #86efac", borderRadius: "8px" }}>
            <p style={{ ...styles.reviewLabel, color: "#15803d", marginBottom: "6px" }}>
              Test Compound Selection — Shared Equipment
            </p>
            <p style={{ fontSize: "12px", color: "#166534", marginBottom: "12px", lineHeight: "1.5" }}>
              The final compound in the usage sequence is recommended (pre-selected). Check any additional compounds that should be tested during changeover cleaning.
            </p>
            {Object.entries(equipmentSequence).map(([eidStr, orderedSteps]) => {
              const eid = parseInt(eidStr);
              const eq = equipmentList.find(e => e.equipment_id === eid);
              if (!eq) return null;
              const lastStepIdx = orderedSteps[orderedSteps.length - 1];
              const checked = reviewTestCompounds[eid] || [lastStepIdx];
              return (
                <div key={eid} style={{ marginBottom: "14px" }}>
                  <p style={{ fontSize: "13px", fontWeight: "700", color: "#1e293b", marginBottom: "6px" }}>
                    {eq.equipment_name}
                  </p>
                  {orderedSteps.map((stepIdx, pos) => {
                    const sm = stepEquipmentMap.find(m => m.step_index === stepIdx);
                    if (!sm) return null;
                    const isLast = stepIdx === lastStepIdx;
                    const isChecked = checked.includes(stepIdx);
                    return (
                      <label key={stepIdx} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "7px 10px", background: "white", borderRadius: "6px", marginBottom: "4px", border: `1px solid ${isLast ? "#86efac" : "#e2e8f0"}`, cursor: "pointer" }}>
                        <input type="checkbox" checked={isChecked}
                          onChange={() => setReviewTestCompounds(prev => {
                            const cur = prev[eid] || [lastStepIdx];
                            return { ...prev, [eid]: cur.includes(stepIdx) ? cur.filter(si => si !== stepIdx) : [...cur, stepIdx] };
                          })} />
                        <span style={{ fontSize: "11px", color: "#888", minWidth: "18px" }}>{pos + 1}.</span>
                        <span style={{ ...(sm.is_product ? styles.productStepBadge : styles.synthStepBadge), marginTop: 0, fontSize: "10px" }}>
                          {sm.is_product ? "Product" : `Step ${sm.step_index + 1}`}
                        </span>
                        <span style={{ flex: 1, fontSize: "13px", fontStyle: "italic", color: "#374151" }}>{sm.test_compound || "—"}</span>
                        {isLast && <span style={{ fontSize: "11px", color: "#16a34a", fontWeight: "700", whiteSpace: "nowrap" }}>★ Recommended</span>}
                      </label>
                    );
                  })}
                </div>
              );
            })}
          </div>
        )}

        <div style={{ marginTop: "18px", padding: "14px 16px", background: "#fefce8", borderRadius: "8px", border: "1px solid #fde047" }}>
          <p style={{ ...styles.fieldLabel, color: "#713f12", marginBottom: "6px" }}>Confirm with Your Password</p>
          <input
            type="password"
            placeholder="Enter your login password"
            value={addPassword}
            onChange={e => setAddPassword(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") confirmAdd(); }}
            style={styles.input}
            autoFocus
          />
        </div>
      </div>
    );

    return null;
  };

  // ─── Synthesis step table in Edit modal ───────────────────────────────────────
  const renderEditSynthSteps = () => (
    <div>
      <p style={styles.editSectionLabel}>Synthesis Route</p>
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {editSynthSteps.map((step, idx) => (
          <div key={idx} style={{ ...styles.synthRow, padding: "8px", background: "#f8fafc", borderRadius: "6px" }}>
            <div style={{ ...styles.synthStepBadge, fontSize: "10px" }}>{idx + 1}</div>
            <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
              <input placeholder="Step name" value={step.step_name}
                onChange={e => updateEditSynthStep(idx, "step_name", e.target.value)}
                style={{ ...styles.modalInput, fontSize: "12px" }} />
              <div>
                <input placeholder="IUPAC output compound *" value={step.iupac_name}
                  onChange={e => updateEditSynthStep(idx, "iupac_name", e.target.value)}
                  style={{ ...styles.modalInput, fontSize: "12px", borderColor: step.step_name && !step.iupac_name ? "#dc2626" : undefined }} />
                {step.step_name && !step.iupac_name && (
                  <p style={{ color: "#dc2626", fontSize: "11px", margin: "2px 0 0 2px" }}>IUPAC name is required for regulatory traceability.</p>
                )}
              </div>
              <input placeholder="Soluble solvent" value={step.soluble_solvent}
                onChange={e => updateEditSynthStep(idx, "soluble_solvent", e.target.value)}
                style={{ ...styles.modalInput, fontSize: "12px" }} />
              <select value={step.solubility_usp || ""}
                onChange={e => updateEditSynthStep(idx, "solubility_usp", e.target.value)}
                style={{ ...styles.modalInput, fontSize: "12px" }}>
                <option value="">USP Solubility</option>
                {USP_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            {editSynthSteps.length > 1 && (
              <button onClick={() => removeEditSynthStep(idx)} style={styles.synthRemoveBtn}>✕</button>
            )}
          </div>
        ))}
      </div>
      <button onClick={addEditSynthStep} style={{ ...styles.addStepBtn, fontSize: "12px", padding: "7px 12px", marginTop: "6px" }}>+ Add Step</button>
    </div>
  );

  // ─── RENDER ───────────────────────────────────────────────────────────────────
  return (
    <div style={{ padding: "20px", fontFamily: "Arial", background: "#f1f5f9", minHeight: "100vh" }}>

      {/* Page header */}
      <div style={styles.pageHeader}>
        <h2 style={{ margin: 0 }}>Product Master</h2>
        <button onClick={goHome} style={styles.backBtn}>Back to Home</button>
      </div>

      {/* Tab bar */}
      <div style={styles.tabBar}>
        <button onClick={() => setActiveTab("add")}
          style={activeTab === "add" ? styles.tabActive : styles.tabInactive}>Add Product</button>
        <button onClick={() => setActiveTab("view")}
          style={activeTab === "view" ? styles.tabActive : styles.tabInactive}>View Products</button>
        <button onClick={() => setActiveTab("overview")}
          style={activeTab === "overview" ? styles.tabActive : styles.tabInactive}>Product Overview</button>
      </div>

      {/* ── ADD TAB — Wizard ─────────────────────────────────────────────────── */}
      {activeTab === "add" && (
        <div style={styles.wizardWrapper}>

          {/* Progress bar */}
          <div style={styles.progressBar}>
            {currentSteps.map((step, idx) => (
              <React.Fragment key={step.id}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "4px",
                    cursor: idx < wizardStepIndex ? "pointer" : "default" }}
                  onClick={() => { if (idx < wizardStepIndex) setWizardStepIndex(idx); }}>
                  <div style={{
                    width: "32px", height: "32px", borderRadius: "50%",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: "12px", fontWeight: "bold", transition: "all 0.2s",
                    background: idx < wizardStepIndex ? "#16a34a" : idx === wizardStepIndex ? "#004f9f" : "#e2e8f0",
                    color:      idx <= wizardStepIndex ? "white" : "#94a3b8",
                    border:     idx === wizardStepIndex ? "3px solid #93c5fd" : "3px solid transparent",
                    boxShadow:  idx === wizardStepIndex ? "0 0 0 3px #dbeafe" : "none",
                  }}>{idx < wizardStepIndex ? "✓" : idx + 1}</div>
                  <span style={{
                    fontSize: "10px", whiteSpace: "nowrap",
                    fontWeight: idx === wizardStepIndex ? "700" : "normal",
                    color: idx === wizardStepIndex ? "#004f9f" : idx < wizardStepIndex ? "#16a34a" : "#94a3b8",
                  }}>{step.label}</span>
                </div>
                {idx < currentSteps.length - 1 && (
                  <div style={{ flex: 1, height: "2px", marginTop: "-18px", alignSelf: "flex-start",
                    background: idx < wizardStepIndex ? "#16a34a" : "#e2e8f0" }} />
                )}
              </React.Fragment>
            ))}
          </div>

          {/* Step content */}
          <div style={styles.stepContent}>
            {renderStep()}
          </div>

          {/* Navigation */}
          <div style={styles.wizardNav}>
            <button onClick={prevStep} disabled={wizardStepIndex === 0}
              style={wizardStepIndex === 0 ? styles.navBtnDisabled : styles.navBtnBack}>
              ← Back
            </button>
            <span style={{ fontSize: "12px", color: "#888" }}>
              {wizardStepIndex + 1} / {currentSteps.length}
            </span>
            {wizardStepIndex < currentSteps.length - 1 ? (
              <button onClick={nextStep} style={styles.navBtnNext}>Next →</button>
            ) : (
              <button onClick={confirmAdd} disabled={addLoading}
                style={addLoading ? styles.navBtnDisabled : styles.submitBtn}>
                {addLoading ? "Submitting…" : "Submit Product"}
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── VIEW TAB ──────────────────────────────────────────────────────────── */}
      {activeTab === "view" && (
        <div>
          <div style={styles.filterCard}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "12px", alignItems: "flex-end" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <label style={styles.filterLabel}>Facility</label>
                <select value={viewFacilityId} onChange={e => setViewFacilityId(e.target.value)} style={styles.selectSm}>
                  <option value="">All Facilities</option>
                  {facilities.map(f => <option key={f.facility_id} value={f.facility_id}>{f.facility_name}</option>)}
                </select>
              </div>
              <button onClick={handleViewQuery} style={styles.queryBtn}>Query</button>
              {viewQueried && <button onClick={clearViewTab} style={styles.clearBtn}>Clear</button>}
              {viewQueried && viewProducts.length > 0 && (
                <button onClick={handlePrint} style={styles.printBtn}>Print PDF</button>
              )}
            </div>
          </div>

          {viewLoading ? (
            <p style={{ color: "#004f9f" }}>Loading products…</p>
          ) : !viewQueried ? (
            <div style={styles.emptyState}>
              <p style={{ margin: 0, fontSize: "15px", color: "#555" }}>
                Select a facility and click <strong>Query</strong> to view products.
              </p>
            </div>
          ) : viewProducts.length === 0 ? (
            <p style={{ color: "#888" }}>No products found.</p>
          ) : (
            <div>
              <p style={{ margin: "0 0 8px", color: "#555", fontSize: "13px" }}>
                Showing <strong>{viewProducts.length}</strong> product{viewProducts.length !== 1 ? "s" : ""}
              </p>
              <div style={{ overflowX: "auto", background: "white", borderRadius: "10px", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
                <div ref={printRef}>
                  <table style={{ borderCollapse: "collapse", width: "100%", fontSize: "13px" }}>
                    <thead>
                      <tr style={{ background: "#004f9f", color: "white" }}>
                        <th style={cell}>ID</th>
                        <th style={cell}>Product Name</th>
                        <th style={cell}>Type</th>
                        <th style={cell}>Therapeutic Cat.</th>
                        <th style={cell}>Route</th>
                        <th style={cell}>Min Dose (mg/d)</th>
                        <th style={cell}>Max Dose (mg/d)</th>
                        <th style={cell}>PDE (mg/d)</th>
                        <th style={cell}>Min Yield (kg)</th>
                        <th style={cell}>Max Batch (kg)</th>
                        <th style={cell}>Method</th>
                        <th style={cell}>LOD (ppm)</th>
                        <th style={cell}>LOQ (ppm)</th>
                        <th style={cell}>CAS No.</th>
                        <th style={cell}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {viewProducts.map((p, idx) => (
                        <tr key={p.product_id} style={{ background: idx % 2 === 0 ? "#f8fafc" : "white" }}>
                          <td style={cell}>{p.product_id}</td>
                          <td style={{ ...cell, fontWeight: "600" }}>{p.product_name}</td>
                          <td style={cell}>
                            <span style={{ ...styles.typeBadge,
                              background: p.product_category === "API" ? "#dbeafe" : p.product_category === "Intermediate" ? "#fef3c7" : "#f3f4f6",
                              color:      p.product_category === "API" ? "#1d4ed8" : p.product_category === "Intermediate" ? "#92400e" : "#374151" }}>
                              {p.product_category || "—"}
                            </span>
                          </td>
                          <td style={{ ...cell, fontSize: "11px", maxWidth: "160px", whiteSpace: "normal" }}>
                            {p.therapeutic_category || "—"}
                          </td>
                          <td style={cell}>{p.route_of_administration || "—"}</td>
                          <td style={cell}>{p.min_therapeutic_dose_mg}</td>
                          <td style={cell}>{p.max_daily_dose_mg}</td>
                          <td style={cell}>{p.pde_mg_day}</td>
                          <td style={cell}>{p.min_yield_kg ?? "—"}</td>
                          <td style={cell}>{p.max_batch_size_kg ?? "—"}</td>
                          <td style={cell}>{p.analytical_method || "—"}</td>
                          <td style={cell}>{p.lod_ppm ?? "—"}</td>
                          <td style={cell}>{p.loq_ppm ?? "—"}</td>
                          <td style={cell}>{p.cas_number || "—"}</td>
                          <td style={cell}>
                            <div style={{ display: "flex", gap: "4px", justifyContent: "center", flexWrap: "nowrap" }}>
                              <button onClick={() => openStepsModal(p)}  style={styles.stepsBtn}   title="View synthesis steps">Steps</button>
                              <button onClick={() => openEditModal(p)}   style={styles.editBtn}    title="Edit product">Edit</button>
                              <button onClick={() => openHistoryModal(p)} style={styles.historyBtn} title="Change history">Hist.</button>
                              <button onClick={() => openArchiveModal(p)} style={styles.archiveBtn} title="Archive">Archive</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Archived section */}
          <div style={{ marginTop: "24px" }}>
            <button onClick={toggleArchivedSection} style={styles.archivedToggleBtn}>
              {showArchived ? "Hide Archived Products" : "Show Archived Products"}
            </button>
            {showArchived && (
              <div style={{ marginTop: "12px" }}>
                {archivedLoading ? (
                  <p style={{ color: "#888" }}>Loading…</p>
                ) : archivedProducts.length === 0 ? (
                  <p style={{ color: "#888", fontSize: "13px" }}>No archived products.</p>
                ) : (
                  <div style={{ overflowX: "auto", background: "white", borderRadius: "10px", boxShadow: "0 2px 8px rgba(0,0,0,0.06)", border: "1px solid #f5c6cb" }}>
                    <div style={{ padding: "10px 14px", background: "#fff3cd", borderRadius: "10px 10px 0 0", borderBottom: "1px solid #f5c6cb" }}>
                      <span style={{ fontWeight: "bold", fontSize: "13px", color: "#856404" }}>
                        Archived — {archivedProducts.length} record{archivedProducts.length !== 1 ? "s" : ""}
                      </span>
                    </div>
                    <table style={{ borderCollapse: "collapse", width: "100%", fontSize: "13px" }}>
                      <thead>
                        <tr style={{ background: "#6c757d", color: "white" }}>
                          <th style={cell}>ID</th><th style={cell}>Product Name</th>
                          <th style={cell}>Type</th><th style={cell}>Facility</th>
                          <th style={cell}>Archived By</th><th style={cell}>Archived At</th>
                          <th style={cell}>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {archivedProducts.map((p, idx) => (
                          <tr key={p.product_id} style={{ background: idx % 2 === 0 ? "#f8f9fa" : "white", color: "#777" }}>
                            <td style={cell}>{p.product_id}</td>
                            <td style={{ ...cell, textDecoration: "line-through" }}>{p.product_name}</td>
                            <td style={cell}>{p.product_category || "—"}</td>
                            <td style={cell}>{facilityName(p.facility_id)}</td>
                            <td style={cell}>{p.archived_by || "—"}</td>
                            <td style={cell}>{p.archived_at ? new Date(p.archived_at).toLocaleString("en-IN") : "—"}</td>
                            <td style={cell}>
                              <button onClick={() => openRestoreModal(p)} style={styles.restoreBtn}>Restore</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── OVERVIEW TAB ─────────────────────────────────────────────────────── */}
      {activeTab === "overview" && (() => {
        const apis      = ovProducts.filter(p => p.product_category === "API");
        const nonApis   = ovProducts.filter(p => p.product_category !== "API");
        const unmapped  = nonApis.filter(p => !p.final_product_id || !ovProducts.find(op => op.product_id === p.final_product_id));

        const typeBg    = { API: "#dbeafe", Intermediate: "#fef3c7", KSM: "#f0fdf4" };
        const typeColor = { API: "#1d4ed8", Intermediate: "#92400e", KSM: "#15803d" };

        const childrenOf = (parentId) =>
          nonApis.filter(p => p.final_product_id === parentId);

        const renderTree = (products, depth = 0) =>
          products.map(p => (
            <React.Fragment key={p.product_id}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "7px 10px",
                marginLeft: depth * 28, marginBottom: "4px",
                background: depth === 0 ? "#f8fafc" : "#ffffff",
                border: `1px solid ${depth === 0 ? "#e2e8f0" : "#f1f5f9"}`,
                borderRadius: "6px" }}>
                <span style={{ padding: "2px 8px", borderRadius: "10px", fontSize: "11px", fontWeight: "700",
                  background: typeBg[p.product_category] || "#f3f4f6",
                  color: typeColor[p.product_category] || "#374151", whiteSpace: "nowrap" }}>
                  {p.product_category}
                </span>
                <span style={{ fontWeight: "600", fontSize: "13px", color: "#1e293b" }}>{p.product_name}</span>
                {p.chemical_number && <span style={{ fontSize: "11px", color: "#64748b", fontStyle: "italic" }}>{p.chemical_number}</span>}
                {p.cas_number && <span style={{ fontSize: "11px", color: "#94a3b8" }}>CAS: {p.cas_number}</span>}
                {p.analytical_method && <span style={{ fontSize: "11px", color: "#7c3aed", marginLeft: "auto" }}>{p.analytical_method}</span>}
              </div>
              {renderTree(childrenOf(p.product_id), depth + 1)}
            </React.Fragment>
          ));

        return (
          <div style={{ ...styles.wizardWrapper, marginTop: 0, borderRadius: "0 10px 10px 10px" }}>
            <p style={styles.stepTitle}>Product Overview</p>
            <p style={styles.stepHint}>Select a facility to view the full synthesis hierarchy for each API, and map intermediates and KSMs to their parent.</p>

            {/* Facility selector */}
            <div style={{ display: "flex", gap: "10px", alignItems: "center", marginBottom: "20px" }}>
              <select value={ovFacilityId}
                onChange={e => { setOvFacilityId(e.target.value); setOvProducts([]); }}
                style={{ ...styles.selectSm, minWidth: "260px" }}>
                <option value="">— Select Facility —</option>
                {facilities.map(f => <option key={f.facility_id} value={f.facility_id}>{f.facility_name}</option>)}
              </select>
              <button onClick={() => fetchOverviewProducts(ovFacilityId)} disabled={!ovFacilityId || ovLoading}
                style={{ ...styles.queryBtn, opacity: (!ovFacilityId || ovLoading) ? 0.5 : 1 }}>
                {ovLoading ? "Loading…" : "Load"}
              </button>
              {ovProducts.length > 0 && (
                <button onClick={() => { setOvProducts([]); setOvFacilityId(""); }} style={styles.clearBtn}>Clear</button>
              )}
            </div>

            {ovProducts.length > 0 && (
              <>
                {/* API cards */}
                {apis.length === 0 ? (
                  <p style={{ color: "#94a3b8", fontSize: "13px" }}>No API products found for this facility.</p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                    {apis.map(api => {
                      const direct = childrenOf(api.product_id);
                      return (
                        <div key={api.product_id} style={{ background: "white", border: "1px solid #bae6fd", borderRadius: "10px", padding: "16px", boxShadow: "0 2px 8px rgba(0,0,0,0.05)" }}>
                          {/* API header */}
                          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
                            <span style={{ padding: "3px 10px", borderRadius: "10px", fontSize: "12px", fontWeight: "700", background: "#dbeafe", color: "#1d4ed8" }}>API</span>
                            <span style={{ fontWeight: "700", fontSize: "16px", color: "#004f9f" }}>{api.product_name}</span>
                            {api.chemical_number && <span style={{ fontSize: "12px", color: "#64748b", fontStyle: "italic" }}>{api.chemical_number}</span>}
                            {api.cas_number && <span style={{ fontSize: "12px", color: "#94a3b8" }}>CAS: {api.cas_number}</span>}
                            <button onClick={() => openMapModal(api)} style={{ marginLeft: "auto", ...styles.queryBtn, fontSize: "12px", padding: "5px 14px" }}>
                              Map Products
                            </button>
                          </div>

                          {/* Key params */}
                          <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", marginBottom: "12px", fontSize: "12px", color: "#475569" }}>
                            {api.therapeutic_category && <span><b>Category:</b> {api.therapeutic_category}</span>}
                            {api.route_of_administration && <span><b>Route:</b> {api.route_of_administration}</span>}
                            {api.analytical_method && <span><b>Method:</b> {api.analytical_method}</span>}
                            {api.min_therapeutic_dose_mg > 0 && <span><b>Min Dose:</b> {api.min_therapeutic_dose_mg} mg/d</span>}
                            {api.pde_mg_day > 0 && <span><b>PDE:</b> {api.pde_mg_day} mg/d</span>}
                          </div>

                          {/* Synthesis tree */}
                          {direct.length > 0 ? (
                            <div>
                              <p style={{ fontSize: "11px", fontWeight: "700", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.4px", margin: "0 0 8px 0" }}>Synthesis Chain</p>
                              {renderTree(direct, 0)}
                            </div>
                          ) : (
                            <p style={{ fontSize: "12px", color: "#94a3b8", fontStyle: "italic" }}>No intermediates or KSMs mapped yet. Use "Map Products" to link them.</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Unmapped products */}
                {unmapped.length > 0 && (
                  <div style={{ marginTop: "20px", padding: "14px 16px", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: "10px" }}>
                    <p style={{ fontSize: "12px", fontWeight: "700", color: "#92400e", margin: "0 0 8px 0", textTransform: "uppercase", letterSpacing: "0.4px" }}>
                      Unmapped Products ({unmapped.length})
                    </p>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                      {unmapped.map(p => (
                        <span key={p.product_id} style={{ display: "flex", alignItems: "center", gap: "6px", padding: "4px 10px", borderRadius: "6px",
                          background: "white", border: "1px solid #fcd34d", fontSize: "12px" }}>
                          <span style={{ padding: "1px 6px", borderRadius: "8px", fontSize: "10px", fontWeight: "700",
                            background: typeBg[p.product_category] || "#f3f4f6",
                            color: typeColor[p.product_category] || "#374151" }}>{p.product_category}</span>
                          {p.product_name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        );
      })()}

      {/* ── MAP PRODUCTS MODAL ────────────────────────────────────────────────── */}
      {mapModal && (() => {
        const nonApiList = ovProducts.filter(p => p.product_category !== "API");
        const typeBg    = { API: "#dbeafe", Intermediate: "#fef3c7", KSM: "#f0fdf4" };
        const typeColor = { API: "#1d4ed8", Intermediate: "#92400e", KSM: "#15803d" };

        // All selectable parents: the current API + any intermediate already under it
        const allParents = [
          mapModal.api,
          ...nonApiList.filter(p => {
            let cur = p;
            while (cur.final_product_id) {
              if (cur.final_product_id === mapModal.api.product_id) return true;
              cur = ovProducts.find(op => op.product_id === cur.final_product_id) || {};
            }
            return false;
          })
        ];

        return (
          <div style={styles.modalOverlay}>
            <div style={{ ...styles.modalBox, width: "620px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
                <h3 style={{ margin: 0, fontSize: "16px", color: "#004f9f" }}>Map Products — {mapModal.api.product_name}</h3>
                <button onClick={() => setMapModal(null)} style={styles.closeBtn}>✕</button>
              </div>
              <p style={{ fontSize: "12px", color: "#64748b", margin: "0 0 14px 0" }}>
                Assign each Intermediate or KSM to its parent in the synthesis chain. Leave as "— None —" to unlink.
              </p>

              {/* Product rows */}
              <div style={{ display: "flex", flexDirection: "column", gap: "6px", maxHeight: "340px", overflowY: "auto", marginBottom: "14px" }}>
                {nonApiList.length === 0 ? (
                  <p style={{ color: "#94a3b8", fontSize: "13px" }}>No non-API products found for this facility.</p>
                ) : nonApiList.map(p => (
                  <div key={p.product_id} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "8px 10px",
                    background: "#f8fafc", borderRadius: "6px", border: "1px solid #e2e8f0" }}>
                    <span style={{ padding: "2px 8px", borderRadius: "10px", fontSize: "11px", fontWeight: "700",
                      background: typeBg[p.product_category] || "#f3f4f6",
                      color: typeColor[p.product_category] || "#374151", whiteSpace: "nowrap" }}>
                      {p.product_category}
                    </span>
                    <span style={{ flex: 1, fontSize: "13px", fontWeight: "500", color: "#1e293b" }}>{p.product_name}</span>
                    <select
                      value={mapChanges[p.product_id] ?? ""}
                      onChange={e => setMapChanges(prev => ({ ...prev, [p.product_id]: e.target.value === "" ? null : parseInt(e.target.value) }))}
                      style={{ fontSize: "12px", padding: "4px 8px", borderRadius: "4px", border: "1px solid #cbd5e1", background: "white", minWidth: "180px" }}>
                      <option value="">— None —</option>
                      {allParents.map(parent => (
                        <option key={parent.product_id} value={parent.product_id}>
                          {parent.product_category === "API" ? "API: " : "↳ "}{parent.product_name}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>

              {/* Password + Reason */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "14px" }}>
                <div>
                  <label style={styles.modalLabel}>Password *</label>
                  <input type="password" value={mapPassword} onChange={e => setMapPassword(e.target.value)}
                    style={styles.modalInput} placeholder="Your login password" />
                </div>
                <div>
                  <label style={styles.modalLabel}>Reason *</label>
                  <input value={mapReason} onChange={e => setMapReason(e.target.value)}
                    style={styles.modalInput} placeholder="e.g. Initial synthesis mapping" />
                </div>
              </div>

              <div style={{ display: "flex", gap: "10px" }}>
                <button onClick={saveMapping} disabled={mapSaving}
                  style={{ ...styles.navBtnNext, flex: 1, opacity: mapSaving ? 0.6 : 1 }}>
                  {mapSaving ? "Saving…" : "Save Mapping"}
                </button>
                <button onClick={() => setMapModal(null)} style={{ ...styles.navBtnBack, flex: 1 }}>Cancel</button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── SYNTHESIS STEPS MODAL ─────────────────────────────────────────────── */}
      {stepsModal && (
        <div style={styles.modalOverlay}>
          <div style={{ ...styles.modalBox, width: "680px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
              <h3 style={{ margin: 0, fontSize: "16px" }}>Synthesis Route — {stepsModal.product_name}</h3>
              <button onClick={() => setStepsModal(null)} style={styles.closeBtn}>✕</button>
            </div>
            {stepsLoading ? (
              <p style={{ color: "#004f9f" }}>Loading…</p>
            ) : stepsData.length === 0 ? (
              <p style={{ color: "#888", fontSize: "13px" }}>No synthesis steps recorded for this product.</p>
            ) : (
              <table style={{ borderCollapse: "collapse", width: "100%", fontSize: "13px" }}>
                <thead>
                  <tr style={{ background: "#004f9f", color: "white" }}>
                    <th style={cell}>Step</th>
                    <th style={cell}>Step Name</th>
                    <th style={cell}>Output Compound (IUPAC)</th>
                    <th style={cell}>Solvent</th>
                    <th style={cell}>USP Solubility</th>
                  </tr>
                </thead>
                <tbody>
                  {stepsData.map((s, i) => (
                    <tr key={s.step_id} style={{ background: i % 2 === 0 ? "#f8fafc" : "white" }}>
                      <td style={{ ...cell, fontWeight: "700", color: "#004f9f" }}>{s.step_number}</td>
                      <td style={cell}>{s.step_name || "—"}</td>
                      <td style={{ ...cell, fontStyle: "italic" }}>{s.iupac_name || "—"}</td>
                      <td style={cell}>{s.soluble_solvent || "—"}</td>
                      <td style={cell}>{s.solubility_usp ? uspLabel(s.solubility_usp) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ── HISTORY MODAL ────────────────────────────────────────────────────── */}
      {historyModal && (
        <div style={styles.modalOverlay}>
          <div style={{ ...styles.modalBox, width: "700px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
              <h3 style={{ margin: 0, fontSize: "16px" }}>Change History — {historyModal.product_name}</h3>
              <button onClick={() => setHistoryModal(null)} style={styles.closeBtn}>✕</button>
            </div>
            {historyLoading ? (
              <p style={{ color: "#004f9f" }}>Loading…</p>
            ) : historyLogs.length === 0 ? (
              <p style={{ color: "#888" }}>No change history found.</p>
            ) : (
              <div style={{ maxHeight: "400px", overflowY: "auto" }}>
                <table style={{ borderCollapse: "collapse", width: "100%", fontSize: "12px" }}>
                  <thead>
                    <tr style={{ background: "#004f9f", color: "white", position: "sticky", top: 0 }}>
                      <th style={cell}>Event</th><th style={cell}>Field</th>
                      <th style={cell}>Old Value</th><th style={cell}>New Value</th>
                      <th style={cell}>Changed By</th><th style={cell}>Timestamp</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historyLogs.map((l, i) => (
                      <tr key={l.audit_id} style={{ background: i % 2 === 0 ? "#f8fafc" : "white" }}>
                        <td style={cell}>
                          <span style={{ padding: "2px 6px", borderRadius: "3px", fontSize: "11px", fontWeight: "bold",
                            background: l.event_type === "CREATE" ? "#d4edda" : "#fff3cd",
                            color:      l.event_type === "CREATE" ? "#155724" : "#856404" }}>
                            {l.event_type}
                          </span>
                        </td>
                        <td style={cell}>{l.field_name || "—"}</td>
                        <td style={{ ...cell, color: "#cc0000" }}>{l.old_value || "—"}</td>
                        <td style={{ ...cell, color: "#007700" }}>{l.new_value || "—"}</td>
                        <td style={{ ...cell, fontWeight: "600" }}>{l.performed_by}</td>
                        <td style={cell}>{l.timestamp ? new Date(l.timestamp).toLocaleString("en-IN") : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── RESTORE MODAL ────────────────────────────────────────────────────── */}
      {restoreModal && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalBox}>
            <h3 style={{ margin: "0 0 6px", fontSize: "16px" }}>Restore Product</h3>
            <p style={{ margin: "0 0 16px", fontSize: "13px", color: "#555" }}>
              Restoring <strong>"{restoreModal.product_name}"</strong> will make it active again.
            </p>
            <label style={styles.modalLabel}>Your Password</label>
            <input type="password" value={restorePassword}
              onChange={e => setRestorePassword(e.target.value)}
              placeholder="Enter your login password" style={styles.modalInput} autoFocus />
            <label style={{ ...styles.modalLabel, marginTop: "10px" }}>Reason</label>
            <input type="text" value={restoreReason}
              onChange={e => setRestoreReason(e.target.value)}
              placeholder="e.g. Product reinstated" style={styles.modalInput} />
            <div style={{ display: "flex", gap: "10px", marginTop: "16px" }}>
              <button onClick={confirmRestore} disabled={restoreLoading}
                style={restoreLoading ? styles.modalConfirmBtnDisabled : { ...styles.modalConfirmBtn, background: "#28a745" }}>
                {restoreLoading ? "Restoring…" : "Confirm Restore"}
              </button>
              <button onClick={() => setRestoreModal(null)} style={styles.modalCancelBtn}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ── EDIT MODAL ───────────────────────────────────────────────────────── */}
      {editModal && (
        <div style={styles.modalOverlay}>
          <div style={{ ...styles.modalBox, width: "580px", maxHeight: "92vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
              <h3 style={{ margin: 0, fontSize: "16px" }}>Edit — {editModal.product_name}</h3>
              <button onClick={() => setEditModal(null)} style={styles.closeBtn}>✕</button>
            </div>

            {/* Classification */}
            <p style={styles.editSectionLabel}>Classification</p>
            <select value={editForm.product_category}
              onChange={e => setEditForm(f => ({ ...f, product_category: e.target.value, final_product_id: "" }))}
              style={{ ...styles.modalInput, cursor: "pointer" }}>
              <option value="">— Not Set —</option>
              <option value="API">API</option>
              <option value="Intermediate">Intermediate</option>
              <option value="KSM">KSM</option>
            </select>

            {/* Clinical (API only) */}
            {editForm.product_category === "API" && (
              <>
                <p style={styles.editSectionLabel}>Clinical Profile</p>
                <label style={styles.modalLabel}>Therapeutic Category</label>
                <select value={editForm.therapeutic_category}
                  onChange={e => setEditForm(f => ({ ...f, therapeutic_category: e.target.value }))}
                  style={{ ...styles.modalInput, cursor: "pointer", marginBottom: "8px" }}>
                  <option value="">— Select ATC Category —</option>
                  {allAtcOptions.map((cat, i) => <option key={i} value={cat}>{cat}</option>)}
                </select>
                <label style={styles.modalLabel}>Route of Administration</label>
                <select value={editForm.route_of_administration}
                  onChange={e => setEditForm(f => ({ ...f, route_of_administration: e.target.value }))}
                  style={{ ...styles.modalInput, cursor: "pointer" }}>
                  <option value="">— Select Route —</option>
                  {ROA_OPTIONS.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </>
            )}

            {/* Synthesis steps */}
            {renderEditSynthSteps()}

            {/* Dosage */}
            <p style={styles.editSectionLabel}>Dosage Information</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
              <div><label style={styles.modalLabel}>Min Therapeutic Dose (mg)</label>
                <input type="number" value={editForm.min_therapeutic_dose_mg}
                  onChange={e => setEditForm(f => ({ ...f, min_therapeutic_dose_mg: e.target.value }))}
                  style={styles.modalInput} /></div>
              <div><label style={styles.modalLabel}>Max Daily Dose (mg/day)</label>
                <input type="number" value={editForm.max_daily_dose_mg}
                  onChange={e => setEditForm(f => ({ ...f, max_daily_dose_mg: e.target.value }))}
                  style={styles.modalInput} /></div>
              <div><label style={styles.modalLabel}>PDE (mg/day)</label>
                <input type="number" value={editForm.pde_mg_day}
                  onChange={e => setEditForm(f => ({ ...f, pde_mg_day: e.target.value }))}
                  style={styles.modalInput} /></div>
            </div>

            {/* Batch */}
            <p style={styles.editSectionLabel}>Batch Information</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
              <div><label style={styles.modalLabel}>Min Yield (kg)</label>
                <input type="number" value={editForm.min_yield_kg}
                  onChange={e => setEditForm(f => ({ ...f, min_yield_kg: e.target.value }))}
                  style={styles.modalInput} /></div>
              <div><label style={styles.modalLabel}>Max Batch Size (kg)</label>
                <input type="number" value={editForm.max_batch_size_kg}
                  onChange={e => setEditForm(f => ({ ...f, max_batch_size_kg: e.target.value }))}
                  style={{ ...styles.modalInput, borderColor: "#004f9f" }} /></div>
            </div>

            {/* Analytical */}
            <p style={styles.editSectionLabel}>Analytical Method</p>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "8px" }}>
              {editSynthSteps.filter(s => s.step_name || s.iupac_name).map((s, i) => {
                const realIdx = editSynthSteps.indexOf(s);
                return (
                  <div key={i} style={{ ...styles.stepEquipCard, padding: "10px 12px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                      <span style={styles.synthStepBadge}>Step {i + 1}</span>
                      <strong style={{ fontSize: "13px", color: "#1e293b" }}>{s.step_name || s.iupac_name}</strong>
                    </div>
                    {renderAnalyticalFields(
                      s.analytical_method || "",
                      v => setEditSynthSteps(prev => prev.map((r, ri) => ri === realIdx ? { ...r, analytical_method: v } : r)),
                      s.lod_ppm || "",
                      v => setEditSynthSteps(prev => prev.map((r, ri) => ri === realIdx ? { ...r, lod_ppm: v } : r)),
                      s.loq_ppm || "",
                      v => setEditSynthSteps(prev => prev.map((r, ri) => ri === realIdx ? { ...r, loq_ppm: v } : r)),
                      styles.modalInput, styles.modalLabel
                    )}
                  </div>
                );
              })}
              <div style={{ ...styles.stepEquipCard, padding: "10px 12px", borderColor: "#16a34a", background: "#f0fdf4" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                  <span style={styles.productStepBadge}>Product</span>
                  <strong style={{ fontSize: "13px", color: "#1e293b" }}>{editForm.product_name || "Final Product"}</strong>
                </div>
                {renderAnalyticalFields(
                  editForm.analytical_method,
                  v => setEditForm(f => ({ ...f, analytical_method: v })),
                  editForm.lod_ppm,
                  v => setEditForm(f => ({ ...f, lod_ppm: v })),
                  editForm.loq_ppm,
                  v => setEditForm(f => ({ ...f, loq_ppm: v })),
                  styles.modalInput, styles.modalLabel
                )}
              </div>
            </div>

            {/* Chemical identifiers */}
            <p style={styles.editSectionLabel}>Chemical Identifiers</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
              <div><label style={styles.modalLabel}>CAS Number</label>
                <input type="text" value={editForm.cas_number}
                  onChange={e => setEditForm(f => ({ ...f, cas_number: e.target.value }))}
                  placeholder="e.g. 50-78-2" style={styles.modalInput} /></div>
              <div><label style={styles.modalLabel}>IUPAC Name</label>
                <input type="text" value={editForm.chemical_number}
                  onChange={e => setEditForm(f => ({ ...f, chemical_number: e.target.value }))}
                  placeholder="IUPAC name of the compound" style={styles.modalInput} /></div>
              <div><label style={styles.modalLabel}>Soluble Solvent</label>
                <input type="text" value={editForm.soluble_solvent}
                  onChange={e => setEditForm(f => ({ ...f, soluble_solvent: e.target.value }))}
                  placeholder="e.g. Water, Ethanol, DMSO" style={styles.modalInput} /></div>
              <div><label style={styles.modalLabel}>USP Solubility (Product)</label>
                <select value={editForm.solubility_usp || ""}
                  onChange={e => setEditForm(f => ({ ...f, solubility_usp: e.target.value }))}
                  style={{ ...styles.modalInput, cursor: "pointer" }}>
                  <option value="">— Not Set —</option>
                  {USP_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select></div>
            </div>

            {/* Equipment */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "14px", marginBottom: "6px" }}>
              <p style={{ ...styles.editSectionLabel, margin: 0 }}>Equipment</p>
              {editEquipment.length === 0 ? (
                <span style={{ fontSize: "11px", color: "#94a3b8" }}>Loading…</span>
              ) : (
                <button
                  onClick={() => setEditEquipmentOpen(o => !o)}
                  style={{ fontSize: "12px", padding: "3px 12px", borderRadius: "4px", cursor: "pointer", fontWeight: "600",
                    border: "1px solid", borderColor: editEquipmentOpen ? "#94a3b8" : "#004f9f",
                    background: editEquipmentOpen ? "#f1f5f9" : "#eff6ff",
                    color: editEquipmentOpen ? "#475569" : "#004f9f" }}>
                  {editEquipmentOpen ? "Close" : "Edit Equipment"}
                </button>
              )}
            </div>

            {/* Read-only equipment summary (always visible when loaded) */}
            {editEquipment.length > 0 && !editEquipmentOpen && (
              <div style={{ fontSize: "12px", color: "#475569", padding: "8px 10px", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "6px", marginBottom: "4px" }}>
                {editStepEquipmentMap.length > 0 ? (
                  editStepEquipmentMap.map((sm, i) => {
                    const names = editEquipment.filter(e => sm.equipment_ids.includes(e.equipment_id));
                    return (
                      <div key={i} style={{ marginBottom: i < editStepEquipmentMap.length - 1 ? "6px" : 0 }}>
                        <span style={{ ...(sm.is_product ? styles.productStepBadge : styles.synthStepBadge), fontSize: "10px", marginRight: "6px" }}>
                          {sm.is_product ? "Product" : `Step ${sm.step_index + 1}`}
                        </span>
                        <span style={{ fontWeight: "600", color: "#1e293b" }}>{sm.step_name}: </span>
                        {names.length > 0
                          ? names.map(e => {
                              const sa = (sm.swab_areas || {})[e.equipment_id] ?? 9;
                              const ra = (sm.rinse_areas || {})[e.equipment_id] ?? 9;
                              const optIds = (sm.optional_equipment || {})[e.equipment_id] || [];
                              const optNames = editEquipment.filter(oe => optIds.includes(oe.equipment_id)).map(oe => oe.equipment_name);
                              return (
                                <span key={e.equipment_id} style={{ marginRight: "8px" }}>
                                  {e.equipment_name} <span style={{ color: "#64748b" }}>(S:{sa} R:{ra} in²)</span>
                                  {optNames.length > 0 && <span style={{ color: "#7c3aed" }}> +opt: {optNames.join(", ")}</span>}
                                </span>
                              );
                            })
                          : <span style={{ color: "#94a3b8" }}>None assigned</span>}
                      </div>
                    );
                  })
                ) : (
                  <span>
                    {editEquipment.filter(e => editSelectedEq.includes(e.equipment_id)).map(e => e.equipment_name).join(", ") || "None assigned"}
                  </span>
                )}
              </div>
            )}

            {/* Editable equipment section — shown only when Edit Equipment is open */}
            {editEquipmentOpen && (editStepEquipmentMap.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {editStepEquipmentMap.map((sm, mapIdx) => (
                  <div key={mapIdx} style={{ ...styles.stepEquipCard, padding: "10px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                      <span style={{ ...(sm.is_product ? styles.productStepBadge : styles.synthStepBadge), fontSize: "10px" }}>
                        {sm.is_product ? "Product" : `Step ${sm.step_index + 1}`}
                      </span>
                      <strong style={{ fontSize: "13px", color: "#1e293b" }}>{sm.step_name}</strong>
                    </div>
                    <label style={styles.equipCardLabel}>Compound to test during changeover</label>
                    <input
                      value={sm.test_compound}
                      onChange={e => updateEditStepTestCompound(mapIdx, e.target.value)}
                      placeholder="IUPAC name of compound to test"
                      style={{ ...styles.modalInput, marginBottom: "8px", background: "#fefce8", borderColor: "#fbbf24" }}
                    />
                    <label style={styles.equipCardLabel}>Equipment used in this step</label>
                    <div style={styles.checkboxBox}>
                      {editEquipment.filter(eq => {
                        if (sm.equipment_ids.includes(eq.equipment_id)) return true;
                        const allOptIds = new Set(sm.equipment_ids.flatMap(pid => (sm.optional_equipment || {})[pid] || []));
                        return !allOptIds.has(eq.equipment_id);
                      }).map(eq => (
                        <div key={eq.equipment_id}>
                          <label style={styles.checkboxLabel}>
                            <input type="checkbox"
                              checked={sm.equipment_ids.includes(eq.equipment_id)}
                              onChange={() => toggleEditStepEquipment(mapIdx, eq.equipment_id)} />
                            <span style={{ flex: 1 }}>{eq.equipment_name}</span>
                            <span style={{ color: "#888", fontSize: "12px" }}>
                              {(eq.surface_area_cm2 / 6.4516).toFixed(2)} in² · {eq.rinse_volume_liters || 0} L
                            </span>
                          </label>
                          {sm.equipment_ids.includes(eq.equipment_id) && (
                            <div style={{ paddingLeft: "26px", marginTop: "4px", marginBottom: "8px" }}>
                              <div style={{ background: "#f0f9ff", border: "1px solid #bae6fd", borderRadius: "6px", padding: "8px 10px", marginBottom: "6px" }}>
                                <p style={{ fontSize: "11px", fontWeight: "600", color: "#0369a1", margin: "0 0 6px 0" }}>Sample Area Configuration</p>
                                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                                  <span style={{ fontSize: "11px", color: "#475569", minWidth: "180px" }}>Swab sample area (validated method):</span>
                                  <select
                                    value={(sm.swab_areas || {})[eq.equipment_id] ?? 9}
                                    onChange={e => updateEditStepSwabArea(mapIdx, eq.equipment_id, parseInt(e.target.value))}
                                    style={{ fontSize: "12px", padding: "2px 6px", borderRadius: "4px", border: "1px solid #cbd5e1", background: "#f8fafc", cursor: "pointer" }}>
                                    {[2,3,4,5,6,7,8,9].map(n => <option key={n} value={n}>{n} in²</option>)}
                                  </select>
                                </div>
                                <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                                  <span style={{ fontSize: "11px", color: "#475569", minWidth: "180px" }}>Rinse sample area (validated method):</span>
                                  <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                                    <input
                                      type="text"
                                      inputMode="decimal"
                                      value={(sm.rinse_areas || {})[eq.equipment_id] ?? parseFloat((eq.surface_area_cm2 / 6.4516).toFixed(2))}
                                      onChange={e => { const v = parseFloat(e.target.value); if (!isNaN(v) && v > 0) updateEditStepRinseArea(mapIdx, eq.equipment_id, v); }}
                                      style={{ fontSize: "12px", padding: "2px 6px", borderRadius: "4px", width: "70px",
                                        border: `1px solid ${((sm.rinse_areas || {})[eq.equipment_id] ?? parseFloat((eq.surface_area_cm2 / 6.4516).toFixed(2))) > parseFloat((eq.surface_area_cm2 / 6.4516).toFixed(2)) ? "#ef4444" : "#7dd3fc"}`,
                                        background: "#f0f9ff" }}
                                    />
                                    <span style={{ fontSize: "11px", color: "#64748b" }}>in²</span>
                                    <span style={{ fontSize: "11px", color: "#94a3b8" }}>(max: {(eq.surface_area_cm2 / 6.4516).toFixed(2)} in²)</span>
                                  </div>
                                  {((sm.rinse_areas || {})[eq.equipment_id] ?? parseFloat((eq.surface_area_cm2 / 6.4516).toFixed(2))) > parseFloat((eq.surface_area_cm2 / 6.4516).toFixed(2)) && (
                                    <span style={{ fontSize: "11px", color: "#ef4444", fontWeight: "600" }}>Cannot exceed equipment surface area</span>
                                  )}
                                </div>
                              </div>
                              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                <span style={{ fontSize: "11px", color: "#475569" }}>Optional equipment available?</span>
                                {[false, true].map(val => (
                                  <button key={String(val)}
                                    onClick={() => setEditStepOptionalEnabled(mapIdx, eq.equipment_id, val)}
                                    style={{ fontSize: "11px", padding: "2px 10px", borderRadius: "4px", cursor: "pointer", fontWeight: "600",
                                      border: "1px solid",
                                      borderColor: ((sm.optional_equipment_enabled || {})[eq.equipment_id] === val) ? (val ? "#16a34a" : "#94a3b8") : "#e2e8f0",
                                      background: ((sm.optional_equipment_enabled || {})[eq.equipment_id] === val) ? (val ? "#dcfce7" : "#f1f5f9") : "white",
                                      color: ((sm.optional_equipment_enabled || {})[eq.equipment_id] === val) ? (val ? "#15803d" : "#475569") : "#94a3b8",
                                    }}>
                                    {val ? "Yes" : "No"}
                                  </button>
                                ))}
                              </div>
                              {(sm.optional_equipment_enabled || {})[eq.equipment_id] === true && (() => {
                                const claimedByOthers = new Set(
                                  sm.equipment_ids
                                    .filter(pid => pid !== eq.equipment_id)
                                    .flatMap(pid => (sm.optional_equipment || {})[pid] || [])
                                );
                                const sameCatList = editEquipment.filter(oe =>
                                  oe.equipment_id !== eq.equipment_id &&
                                  !claimedByOthers.has(oe.equipment_id) &&
                                  (eq.category_id == null || oe.category_id === eq.category_id)
                                );
                                return (
                                <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "6px", padding: "8px 10px", marginTop: "6px" }}>
                                  <p style={{ fontSize: "11px", fontWeight: "600", color: "#475569", margin: "0 0 4px 0" }}>
                                    Select optional equipment for this step:
                                    {eq.category_id != null && (
                                      <span style={{ fontWeight: "400", color: "#7c3aed", marginLeft: "6px" }}>
                                        ({eq.category_name || "same category"} only)
                                      </span>
                                    )}
                                  </p>
                                  {sameCatList.length === 0 ? (
                                    <p style={{ fontSize: "11px", color: "#94a3b8", margin: 0 }}>
                                      No other {eq.category_name || "same-category"} equipment in this facility.
                                    </p>
                                  ) : (
                                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                                    {sameCatList.map(oe => {
                                      const isChecked = ((sm.optional_equipment || {})[eq.equipment_id] || []).includes(oe.equipment_id);
                                      return (
                                        <div key={oe.equipment_id}>
                                          <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", color: "#374151", cursor: "pointer" }}>
                                            <input type="checkbox"
                                              checked={isChecked}
                                              onChange={() => toggleEditStepOptionalEquipment(mapIdx, eq.equipment_id, oe.equipment_id)} />
                                            {oe.equipment_name}
                                            <span style={{ color: "#94a3b8", fontSize: "11px" }}>
                                              {(oe.surface_area_cm2 / 6.4516).toFixed(2)} in²
                                            </span>
                                          </label>
                                          {isChecked && (
                                            <div style={{ paddingLeft: "20px", marginTop: "3px", background: "#f0f9ff", border: "1px solid #bae6fd", borderRadius: "5px", padding: "6px 10px" }}>
                                              <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "3px" }}>
                                                <span style={{ fontSize: "11px", color: "#64748b", minWidth: "150px" }}>Swab sample area:</span>
                                                <select
                                                  value={((sm.optional_swab_areas || {})[eq.equipment_id] || {})[oe.equipment_id] ?? 9}
                                                  onChange={e => updateEditStepOptionalSwabArea(mapIdx, eq.equipment_id, oe.equipment_id, parseInt(e.target.value))}
                                                  style={{ fontSize: "12px", padding: "2px 6px", borderRadius: "4px", border: "1px solid #cbd5e1", background: "#f8fafc", cursor: "pointer" }}>
                                                  {[2,3,4,5,6,7,8,9].map(n => <option key={n} value={n}>{n} in²</option>)}
                                                </select>
                                              </div>
                                              <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                                                <span style={{ fontSize: "11px", color: "#64748b", minWidth: "150px" }}>Rinse sample area:</span>
                                                <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                                                  <input
                                                    type="text"
                                                    inputMode="decimal"
                                                    value={((sm.optional_rinse_areas || {})[eq.equipment_id] || {})[oe.equipment_id] ?? parseFloat((oe.surface_area_cm2 / 6.4516).toFixed(2))}
                                                    onChange={e => { const v = parseFloat(e.target.value); if (!isNaN(v) && v > 0) updateEditStepOptionalRinseArea(mapIdx, eq.equipment_id, oe.equipment_id, v); }}
                                                    style={{ fontSize: "12px", padding: "2px 6px", borderRadius: "4px", width: "70px",
                                                      border: `1px solid ${(((sm.optional_rinse_areas || {})[eq.equipment_id] || {})[oe.equipment_id] ?? parseFloat((oe.surface_area_cm2 / 6.4516).toFixed(2))) > parseFloat((oe.surface_area_cm2 / 6.4516).toFixed(2)) ? "#ef4444" : "#7dd3fc"}`,
                                                      background: "#f0f9ff" }}
                                                  />
                                                  <span style={{ fontSize: "11px", color: "#64748b" }}>in²</span>
                                                  <span style={{ fontSize: "11px", color: "#94a3b8" }}>(max: {(oe.surface_area_cm2 / 6.4516).toFixed(2)} in²)</span>
                                                </div>
                                                {(((sm.optional_rinse_areas || {})[eq.equipment_id] || {})[oe.equipment_id] ?? parseFloat((oe.surface_area_cm2 / 6.4516).toFixed(2))) > parseFloat((oe.surface_area_cm2 / 6.4516).toFixed(2)) && (
                                                  <span style={{ fontSize: "11px", color: "#ef4444", fontWeight: "600" }}>Cannot exceed equipment surface area</span>
                                                )}
                                              </div>
                                            </div>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                  )}
                                </div>
                                );
                              })()}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={styles.checkboxBox}>
                {editEquipment.map(e => (
                  <label key={e.equipment_id} style={styles.checkboxLabel}>
                    <input type="checkbox"
                      checked={editSelectedEq.includes(e.equipment_id)}
                      onChange={() => setEditSelectedEq(p =>
                        p.includes(e.equipment_id) ? p.filter(id => id !== e.equipment_id) : [...p, e.equipment_id]
                      )} />
                    <span style={{ flex: 1 }}>{e.equipment_name}</span>
                    <span style={{ color: "#888", fontSize: "12px" }}>
                      {(e.surface_area_cm2 / 6.4516).toFixed(2)} in² · {e.rinse_volume_liters || 0} L
                    </span>
                  </label>
                ))}
              </div>
            ))}

            {/* Shared equipment sequence picker — edit modal */}
            {Object.keys(editEquipmentSequence).length > 0 && (
              <div style={{ ...styles.seqSection, marginTop: "14px" }}>
                <p style={{ ...styles.fieldLabel, color: "#713f12", marginBottom: "4px" }}>
                  Shared Equipment — Usage Sequence
                </p>
                <p style={{ fontSize: "12px", color: "#92400e", marginBottom: "10px", lineHeight: "1.5" }}>
                  Set the order in which each step uses shared equipment.
                </p>
                {Object.entries(editEquipmentSequence).map(([eidStr, orderedSteps]) => {
                  const eid = parseInt(eidStr);
                  const eq = editEquipment.find(e => e.equipment_id === eid);
                  if (!eq) return null;
                  return (
                    <div key={eid} style={{ marginBottom: "12px" }}>
                      <p style={{ fontSize: "12px", fontWeight: "700", color: "#374151", marginBottom: "4px" }}>
                        {eq.equipment_name}
                      </p>
                      {orderedSteps.map((stepIdx, pos) => {
                        const sm = editStepEquipmentMap.find(m => m.step_index === stepIdx);
                        if (!sm) return null;
                        const isLast = pos === orderedSteps.length - 1;
                        return (
                          <div key={stepIdx} style={{ ...styles.seqRow, border: isLast ? "1px solid #86efac" : "1px solid #e2e8f0", background: isLast ? "#f0fdf4" : "white" }}>
                            <span style={{ fontSize: "11px", color: "#888", minWidth: "18px", fontWeight: "700" }}>{pos + 1}.</span>
                            <span style={{ ...(sm.is_product ? styles.productStepBadge : styles.synthStepBadge), marginTop: 0, fontSize: "10px" }}>
                              {sm.is_product ? "Product" : `Step ${sm.step_index + 1}`}
                            </span>
                            <span style={{ flex: 1, fontSize: "12px", color: "#374151" }}>{sm.step_name}</span>
                            {isLast && <span style={{ fontSize: "10px", color: "#16a34a", fontWeight: "700", whiteSpace: "nowrap" }}>★ Recommended</span>}
                            <button onClick={() => moveEditSeqUp(eid, pos)} disabled={pos === 0} style={pos === 0 ? styles.seqBtnDisabled : styles.seqBtn}>↑</button>
                            <button onClick={() => moveEditSeqDown(eid, pos)} disabled={pos === orderedSteps.length - 1} style={pos === orderedSteps.length - 1 ? styles.seqBtnDisabled : styles.seqBtn}>↓</button>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Test compound selection for shared equipment */}
            {Object.keys(editEquipmentSequence).length > 0 && (
              <div style={{ marginTop: "14px", padding: "12px 14px", background: "#f0fdf4", border: "1px solid #86efac", borderRadius: "8px" }}>
                <p style={{ ...styles.fieldLabel, color: "#15803d", marginBottom: "4px" }}>
                  Test Compound Selection — Shared Equipment
                </p>
                <p style={{ fontSize: "11px", color: "#166534", marginBottom: "10px", lineHeight: "1.5" }}>
                  Final compound is pre-selected (recommended). Check additional compounds as needed.
                </p>
                {Object.entries(editEquipmentSequence).map(([eidStr, orderedSteps]) => {
                  const eid = parseInt(eidStr);
                  const eq = editEquipment.find(e => e.equipment_id === eid);
                  if (!eq) return null;
                  const lastStepIdx = orderedSteps[orderedSteps.length - 1];
                  const checked = editReviewTestCompounds[eid] || [lastStepIdx];
                  return (
                    <div key={eid} style={{ marginBottom: "12px" }}>
                      <p style={{ fontSize: "12px", fontWeight: "700", color: "#1e293b", marginBottom: "4px" }}>{eq.equipment_name}</p>
                      {orderedSteps.map((stepIdx, pos) => {
                        const sm = editStepEquipmentMap.find(m => m.step_index === stepIdx);
                        if (!sm) return null;
                        const isLast = stepIdx === lastStepIdx;
                        const isChecked = checked.includes(stepIdx);
                        return (
                          <label key={stepIdx} style={{ display: "flex", alignItems: "center", gap: "6px", padding: "5px 8px", background: "white", borderRadius: "6px", marginBottom: "3px", border: `1px solid ${isLast ? "#86efac" : "#e2e8f0"}`, cursor: "pointer" }}>
                            <input type="checkbox" checked={isChecked}
                              onChange={() => setEditReviewTestCompounds(prev => {
                                const cur = prev[eid] || [lastStepIdx];
                                return { ...prev, [eid]: cur.includes(stepIdx) ? cur.filter(si => si !== stepIdx) : [...cur, stepIdx] };
                              })} />
                            <span style={{ fontSize: "10px", color: "#888", minWidth: "16px" }}>{pos + 1}.</span>
                            <span style={{ ...(sm.is_product ? styles.productStepBadge : styles.synthStepBadge), marginTop: 0, fontSize: "10px" }}>
                              {sm.is_product ? "Product" : `Step ${sm.step_index + 1}`}
                            </span>
                            <span style={{ flex: 1, fontSize: "12px", fontStyle: "italic", color: "#374151" }}>{sm.test_compound || "—"}</span>
                            {isLast && <span style={{ fontSize: "10px", color: "#16a34a", fontWeight: "700" }}>★</span>}
                          </label>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Confirmation */}
            <p style={styles.editSectionLabel}>Confirmation</p>
            <label style={styles.modalLabel}>Reason for Change</label>
            <input type="text" value={editReason}
              onChange={e => setEditReason(e.target.value)}
              placeholder="e.g. Batch size updated per revised batch record"
              style={styles.modalInput} />
            <label style={{ ...styles.modalLabel, marginTop: "8px" }}>Your Password</label>
            <input type="password" value={editPassword}
              onChange={e => setEditPassword(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") confirmEdit(); }}
              placeholder="Enter your login password"
              style={styles.modalInput} />
            <div style={{ display: "flex", gap: "10px", marginTop: "16px" }}>
              <button onClick={confirmEdit} disabled={editLoading || editEquipment.length === 0}
                style={(editLoading || editEquipment.length === 0) ? styles.modalConfirmBtnDisabled : { ...styles.modalConfirmBtn, background: "#004f9f" }}>
                {editLoading ? "Saving…" : editEquipment.length === 0 ? "Loading…" : "Save Changes"}
              </button>
              <button onClick={() => setEditModal(null)} style={styles.modalCancelBtn}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ── ARCHIVE MODAL ────────────────────────────────────────────────────── */}
      {archiveModal && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalBox}>
            <h3 style={{ margin: "0 0 6px", fontSize: "16px" }}>Archive Product</h3>
            <p style={{ margin: "0 0 16px", fontSize: "13px", color: "#555" }}>
              Archiving <strong>"{archiveModal.product_name}"</strong> removes it from facility mapping and MACO calculations.
            </p>
            <label style={styles.modalLabel}>Your Password</label>
            <input type="password" value={archivePassword}
              onChange={e => setArchivePassword(e.target.value)}
              placeholder="Enter your login password" style={styles.modalInput} autoFocus />
            <label style={{ ...styles.modalLabel, marginTop: "10px" }}>Reason for Archiving</label>
            <input type="text" value={archiveReason}
              onChange={e => setArchiveReason(e.target.value)}
              placeholder="e.g. Product discontinued" style={styles.modalInput} />
            <div style={{ display: "flex", gap: "10px", marginTop: "16px" }}>
              <button onClick={confirmArchive} disabled={archiveLoading}
                style={archiveLoading ? styles.modalConfirmBtnDisabled : styles.modalConfirmBtn}>
                {archiveLoading ? "Archiving…" : "Confirm Archive"}
              </button>
              <button onClick={closeArchiveModal} style={styles.modalCancelBtn}>Cancel</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

// ─── Shared cell style ────────────────────────────────────────────────────────
const cell = {
  border: "1px solid #e2e8f0", padding: "8px 10px",
  textAlign: "center", whiteSpace: "nowrap",
};

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = {
  pageHeader:   { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" },
  backBtn:      { padding: "8px 16px", background: "#004f9f", color: "white", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "bold" },
  tabBar:       { display: "flex", gap: "4px", marginBottom: "0" },
  tabActive:    { padding: "10px 28px", background: "#004f9f", color: "white", border: "none", borderRadius: "8px 8px 0 0", cursor: "pointer", fontWeight: "bold", fontSize: "16px" },
  tabInactive:  { padding: "10px 28px", background: "white", color: "#555", border: "1px solid #e2e8f0", borderRadius: "8px 8px 0 0", cursor: "pointer", fontSize: "16px" },

  // Wizard
  wizardWrapper: { background: "white", borderRadius: "0 10px 10px 10px", boxShadow: "0 2px 12px rgba(0,0,0,0.07)", padding: "28px" },
  progressBar:  { display: "flex", alignItems: "center", marginBottom: "28px" },
  stepContent:  { minHeight: "320px" },
  stepTitle:    { margin: "0 0 4px 0", fontSize: "22px", fontWeight: "700", color: "#004f9f" },
  stepHint:     { margin: "0 0 18px 0", fontSize: "15px", color: "#6b7280", lineHeight: "1.5" },
  fieldLabel:   { margin: "12px 0 4px 0", fontSize: "14px", fontWeight: "600", color: "#374151", textTransform: "uppercase", letterSpacing: "0.4px" },
  input:        { width: "100%", padding: "10px", borderRadius: "6px", border: "1px solid #d1d5db", fontSize: "15px", boxSizing: "border-box", outline: "none", marginBottom: "2px" },
  wizardNav:    { display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "24px", paddingTop: "16px", borderTop: "1px solid #e5e7eb" },
  navBtnBack:   { padding: "9px 20px", background: "white", color: "#374151", border: "1px solid #d1d5db", borderRadius: "6px", cursor: "pointer", fontWeight: "600", fontSize: "15px" },
  navBtnNext:   { padding: "9px 24px", background: "#004f9f", color: "white", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "700", fontSize: "15px" },
  navBtnDisabled: { padding: "9px 20px", background: "#e5e7eb", color: "#9ca3af", border: "none", borderRadius: "6px", cursor: "not-allowed", fontWeight: "600", fontSize: "15px" },
  submitBtn:    { padding: "10px 28px", background: "#16a34a", color: "white", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "700", fontSize: "15px" },

  // Type selector buttons
  typeSelected:   { padding: "9px 20px", background: "#004f9f", color: "white", border: "2px solid #004f9f", borderRadius: "8px", cursor: "pointer", fontWeight: "700", fontSize: "15px" },
  typeUnselected: { padding: "9px 20px", background: "white", color: "#374151", border: "2px solid #d1d5db", borderRadius: "8px", cursor: "pointer", fontWeight: "600", fontSize: "15px" },
  mappingTag:   { fontSize: "13px", color: "#92400e", margin: "4px 0 0", padding: "6px 8px", background: "#fffbeb", borderRadius: "4px", border: "1px solid #fde68a" },
  typeBadge:    { padding: "2px 8px", borderRadius: "10px", fontSize: "12px", fontWeight: "700", display: "inline-block" },

  // AI

  // Admin box (custom ATC)
  adminBox:   { marginTop: "12px", padding: "12px", background: "#f0f9ff", borderRadius: "8px", border: "1px solid #bae6fd" },
  adminBadge: { fontSize: "12px", background: "#0369a1", color: "white", padding: "1px 6px", borderRadius: "10px", marginLeft: "6px", verticalAlign: "middle" },

  // Synthesis steps
  synthRow:        { display: "flex", gap: "10px", alignItems: "flex-start", padding: "12px", background: "#f8fafc", borderRadius: "8px", border: "1px solid #e2e8f0" },
  synthStepBadge:   { minWidth: "48px", padding: "4px 6px", background: "#004f9f", color: "white", borderRadius: "6px", fontSize: "13px", fontWeight: "700", textAlign: "center", marginTop: "2px" },
  productStepBadge: { minWidth: "56px", padding: "4px 6px", background: "#16a34a", color: "white", borderRadius: "6px", fontSize: "13px", fontWeight: "700", textAlign: "center", marginTop: "2px" },
  synthInput:      { width: "100%", padding: "8px 10px", borderRadius: "6px", border: "1px solid #d1d5db", fontSize: "14px", boxSizing: "border-box" },
  synthRemoveBtn:  { padding: "6px 10px", background: "#fee2e2", color: "#dc2626", border: "1px solid #fca5a5", borderRadius: "6px", cursor: "pointer", fontWeight: "bold", fontSize: "13px", marginTop: "2px" },
  addStepBtn:      { marginTop: "10px", padding: "9px 18px", background: "#f0fdf4", color: "#16a34a", border: "1px solid #86efac", borderRadius: "6px", cursor: "pointer", fontWeight: "700", fontSize: "14px" },

  // Review
  reviewSection: { marginBottom: "14px", padding: "12px 14px", background: "#f8fafc", borderRadius: "8px", border: "1px solid #e2e8f0" },
  reviewLabel:   { margin: "0 0 8px 0", fontSize: "13px", fontWeight: "700", color: "#004f9f", textTransform: "uppercase", letterSpacing: "0.5px" },
  reviewGrid:    { display: "grid", gridTemplateColumns: "160px 1fr", gap: "4px 12px", alignItems: "baseline" },
  rk:            { fontSize: "14px", color: "#6b7280", fontWeight: "600" },
  rv:            { fontSize: "15px", color: "#111827", fontWeight: "500" },

  // View tab
  filterCard:  { background: "white", borderRadius: "0 10px 10px 10px", padding: "16px", boxShadow: "0 2px 8px rgba(0,0,0,0.06)", marginBottom: "16px" },
  filterLabel: { fontSize: "13px", fontWeight: "600", color: "#555", textTransform: "uppercase", letterSpacing: "0.4px" },
  selectSm:    { padding: "8px 10px", borderRadius: "6px", border: "1px solid #ccc", fontSize: "14px", minWidth: "200px", cursor: "pointer" },
  queryBtn:    { padding: "8px 14px", background: "#004f9f", color: "white", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "bold", fontSize: "14px" },
  clearBtn:    { padding: "8px 14px", background: "#6c757d", color: "white", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "bold", fontSize: "14px" },
  printBtn:    { padding: "8px 14px", background: "#28a745", color: "white", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "bold", fontSize: "14px" },
  emptyState:  { textAlign: "center", padding: "48px 24px", background: "white", borderRadius: "10px", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" },
  stepsBtn:    { padding: "4px 8px", background: "#e0f2fe", color: "#0369a1", border: "1px solid #bae6fd", borderRadius: "4px", cursor: "pointer", fontSize: "13px", fontWeight: "bold" },
  editBtn:     { padding: "4px 8px", background: "#004f9f", color: "white", border: "none", borderRadius: "4px", cursor: "pointer", fontSize: "13px", fontWeight: "bold" },
  historyBtn:  { padding: "4px 8px", background: "#6c757d", color: "white", border: "none", borderRadius: "4px", cursor: "pointer", fontSize: "13px", fontWeight: "bold" },
  archiveBtn:  { padding: "4px 8px", background: "#dc3545", color: "white", border: "none", borderRadius: "4px", cursor: "pointer", fontSize: "13px", fontWeight: "bold" },
  restoreBtn:  { padding: "4px 10px", background: "#28a745", color: "white", border: "none", borderRadius: "4px", cursor: "pointer", fontSize: "13px", fontWeight: "bold" },
  archivedToggleBtn: { padding: "7px 16px", background: "#6c757d", color: "white", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "bold", fontSize: "14px" },
  checkboxBox:   { display: "flex", flexDirection: "column", gap: "6px", padding: "10px", border: "1px solid #ccc", borderRadius: "6px", background: "#f8fafc" },
  checkboxLabel: { display: "flex", alignItems: "center", gap: "8px", fontSize: "14px", cursor: "pointer" },
  stepEquipCard:  { padding: "14px", background: "#f8fafc", borderRadius: "8px", border: "1px solid #e2e8f0" },
  equipCardLabel: { display: "block", fontSize: "13px", fontWeight: "600", color: "#374151", textTransform: "uppercase", letterSpacing: "0.4px", marginBottom: "4px" },
  seqSection:     { marginTop: "20px", padding: "14px 16px", background: "#fef9c3", border: "1px solid #fde047", borderRadius: "8px" },
  seqRow:         { display: "flex", alignItems: "center", gap: "8px", padding: "5px 8px", background: "white", borderRadius: "6px", marginBottom: "4px", border: "1px solid #e2e8f0" },
  seqBtn:         { padding: "3px 8px", background: "#f1f5f9", color: "#374151", border: "1px solid #d1d5db", borderRadius: "4px", cursor: "pointer", fontSize: "13px", fontWeight: "bold" },
  seqBtnDisabled: { padding: "3px 8px", background: "#f8f9fa", color: "#9ca3af", border: "1px solid #e5e7eb", borderRadius: "4px", cursor: "not-allowed", fontSize: "13px", fontWeight: "bold" },

  // Modals
  modalOverlay: { position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "20px" },
  modalBox:     { background: "white", borderRadius: "12px", padding: "28px", width: "420px", maxWidth: "95vw", boxShadow: "0 8px 32px rgba(0,0,0,0.2)", maxHeight: "90vh", overflowY: "auto" },
  modalLabel:   { display: "block", fontSize: "13px", fontWeight: "600", color: "#555", textTransform: "uppercase", letterSpacing: "0.4px", marginBottom: "4px" },
  modalInput:   { width: "100%", padding: "9px 10px", borderRadius: "6px", border: "1px solid #ccc", fontSize: "14px", boxSizing: "border-box", marginBottom: "2px" },
  modalConfirmBtn:         { flex: 1, padding: "9px", background: "#dc3545", color: "white", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "bold", fontSize: "14px" },
  modalConfirmBtnDisabled: { flex: 1, padding: "9px", background: "#aaa", color: "white", border: "none", borderRadius: "6px", cursor: "not-allowed", fontWeight: "bold", fontSize: "14px" },
  modalCancelBtn:          { flex: 1, padding: "9px", background: "#f1f5f9", color: "#333", border: "1px solid #ccc", borderRadius: "6px", cursor: "pointer", fontWeight: "bold", fontSize: "14px" },
  editSectionLabel: { margin: "14px 0 6px 0", fontWeight: "bold", fontSize: "13px", color: "#004f9f", textTransform: "uppercase", letterSpacing: "0.5px" },
  closeBtn:  { background: "none", border: "none", fontSize: "22px", cursor: "pointer", color: "#888", lineHeight: 1 },
  addBtn:    { padding: "10px 16px", background: "#004f9f", color: "white", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "bold" },
};

export default ProductPage;
