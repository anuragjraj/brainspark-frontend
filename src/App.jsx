// ════════════════════════════════════════════════════════════════
//  BrainSpark AI — Complete Frontend
//  Connected to real backend (Gemini AI, Supabase DB)
//
//  SETUP:
//  1. Create src/lib/api.js from brainspark_api_client.js
//  2. Create .env file:
//       VITE_API_URL=https://your-render-url.onrender.com
//  3. npm install lucide-react
// ════════════════════════════════════════════════════════════════

import { useState, useEffect, useRef } from "react";
import {
  Brain, Send, RefreshCw, Flame, BookOpen, FileText, Layers,
  BarChart3, Target, MessageSquare, Check, X, Zap, Download,
  ArrowLeft, Sparkles, LogOut, RotateCcw, User, Settings,
  Lock, ChevronRight, Trash2, BookMarked, Save
} from "lucide-react";

// ── API client (calls YOUR backend, not Anthropic directly) ──────
const API_BASE = (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_URL)
  || "http://localhost:5000";

const TOKEN_KEY = "brainspark_token";
const USER_KEY  = "brainspark_user";

function getToken()          { return localStorage.getItem(TOKEN_KEY); }
function setToken(t)         { localStorage.setItem(TOKEN_KEY, t); }
function removeToken()       { localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(USER_KEY); }
function getCachedUser()     { try { return JSON.parse(localStorage.getItem(USER_KEY)); } catch { return null; } }
function setCachedUser(u)    { localStorage.setItem(USER_KEY, JSON.stringify(u)); }

async function apiFetch(path, options = {}) {
  const token = getToken();
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401) removeToken();
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data;
}

// Auth
const auth = {
  async register(name, email, password) {
    const data = await apiFetch("/api/auth/register", { method:"POST", body:JSON.stringify({ name, email, password }) });
    setToken(data.token); setCachedUser(data.user); return data;
  },
  async login(email, password) {
    const data = await apiFetch("/api/auth/login", { method:"POST", body:JSON.stringify({ email, password }) });
    setToken(data.token); setCachedUser(data.user); return data;
  },
  async schoolLogin(schoolCode, rollNumber, password, role="student") {
    const data = await apiFetch("/api/auth/school", { method:"POST", body:JSON.stringify({ schoolCode, rollNumber, password, role }) });
    setToken(data.token); setCachedUser(data.user); return data;
  },
  async verifyToken() {
    try {
      const user = await apiFetch("/api/auth/me");
      setCachedUser(user); return user;
    } catch { removeToken(); return null; }
  },
  logout() { removeToken(); },
};

// User/Profile
const userApi = {
  getProfile:      ()     => apiFetch("/api/user/profile"),
  updateProfile:   (data) => apiFetch("/api/user/profile",  { method:"PUT",    body:JSON.stringify(data) }),
  changePassword:  (currentPassword, newPassword) => apiFetch("/api/user/password", { method:"PUT", body:JSON.stringify({ currentPassword, newPassword }) }),
  getStats:        ()     => apiFetch("/api/user/stats"),
  getNotes:        ()     => apiFetch("/api/user/notes"),
  saveNote:        (data) => apiFetch("/api/user/notes",    { method:"POST",   body:JSON.stringify(data) }),
  deleteNote:      (id)   => apiFetch(`/api/user/notes/${id}`, { method:"DELETE" }),
  getPapers:       ()     => apiFetch("/api/user/papers"),
  savePaper:       (data) => apiFetch("/api/user/papers",   { method:"POST",   body:JSON.stringify(data) }),
  deletePaper:     (id)   => apiFetch(`/api/user/papers/${id}`, { method:"DELETE" }),
  saveQuizResult:  (data) => apiFetch("/api/user/quiz-history", { method:"POST", body:JSON.stringify(data) }),
  getQuizHistory:  ()     => apiFetch("/api/user/quiz-history"),
};

// AI — calls backend which calls Gemini (key never in browser)
const aiApi = {
  doubt:      (messages, system, subject)          => apiFetch("/api/ai/doubt",      { method:"POST", body:JSON.stringify({ messages, system, subject }) }),
  quiz:       (messages, system, subject)          => apiFetch("/api/ai/quiz",       { method:"POST", body:JSON.stringify({ messages, system, subject }) }),
  notes:      (messages, system, subject, chapter) => apiFetch("/api/ai/notes",      { method:"POST", body:JSON.stringify({ messages, system, subject, chapter }) }),
  paper:      (messages, system, subject)          => apiFetch("/api/ai/paper",      { method:"POST", body:JSON.stringify({ messages, system, subject }) }),
  flashcards: (messages, system, subject, chapter) => apiFetch("/api/ai/flashcards", { method:"POST", body:JSON.stringify({ messages, system, subject, chapter }) }),
};

// ════════════════════════════════════════════════════════════════
//  PDF helpers (unchanged)
// ════════════════════════════════════════════════════════════════
function printPDF(html) {
  const w = window.open("", "_blank");
  if (!w) { alert("Please allow popups to download PDF."); return; }
  w.document.write(html); w.document.close();
  setTimeout(() => { w.focus(); w.print(); }, 700);
}
function dlText(text, name) {
  const b = new Blob([text], { type:"text/plain" });
  const a = Object.assign(document.createElement("a"), { href:URL.createObjectURL(b), download:name+".txt" });
  a.click(); URL.revokeObjectURL(a.href);
}
function buildNotesPDF(rawText, subject, chapter, cls, style_) {
  const mdToHTML = (t) => t
    .replace(/```[\s\S]*?```/g, m => `<div class="formula">${m.replace(/```\w*/g,"").trim()}</div>`)
    .replace(/^# .+$/gm,"").replace(/^## (.+)$/gm,"<h2>$1</h2>").replace(/^### (.+)$/gm,"<h3>$1</h3>")
    .replace(/\*\*(.*?)\*\*/g,"<strong>$1</strong>").replace(/\*(.*?)\*/g,"<em>$1</em>")
    .replace(/^[-•] (.+)$/gm,"<li>$1</li>").replace(/(<li>[\s\S]*?<\/li>\n?)+/g,m=>`<ul>${m}</ul>`)
    .replace(/\n\n+/g,"</p><p>").replace(/\n/g,"<br>");
  const body = "<p>"+mdToHTML(rawText)+"</p>"
    .replace(/<p>\s*<\/p>/g,"").replace(/<p>(<h[234]>)/g,"$1").replace(/(<\/h[234]>)<\/p>/g,"$1")
    .replace(/<p>(<ul>)/g,"$1").replace(/(<\/ul>)<\/p>/g,"$1").replace(/<p>(<div)/g,"$1").replace(/(<\/div>)<\/p>/g,"$1");
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${chapter}</title><style>
  @page{size:A4;margin:2.2cm 2.5cm 2.5cm}*{margin:0;padding:0;box-sizing:border-box}
  body{font-family:Georgia,serif;font-size:10.5pt;line-height:1.65;color:#111}
  .doc-header{border-bottom:2pt solid #000;padding-bottom:7pt;margin-bottom:13pt}
  .doc-title{font-size:16pt;font-weight:bold}.doc-meta{font-size:8pt;color:#555;font-style:italic;margin-top:3pt}
  h2{font-size:10pt;font-weight:bold;text-transform:uppercase;letter-spacing:.5pt;border-bottom:.75pt solid #bbb;padding-bottom:2.5pt;margin:13pt 0 5pt}
  h3{font-size:10.5pt;font-weight:bold;margin:9pt 0 2pt}p{margin-bottom:5pt}ul{padding-left:15pt;margin:2pt 0 6pt}li{margin-bottom:2pt}
  .formula{border:.75pt solid #aaa;padding:5pt 10pt;margin:6pt 0;background:#f8f8f8;font-family:monospace;font-size:9.5pt;white-space:pre-wrap}
  .footer{position:fixed;bottom:.8cm;left:2.5cm;right:2.5cm;text-align:center;font-size:7pt;color:#bbb;border-top:.5pt solid #ddd;padding-top:3pt}
  </style></head><body>
  <div class="footer">BrainSpark AI · ${subject} · ${cls} · CBSE</div>
  <div class="doc-header"><div class="doc-title">${chapter}</div>
  <div class="doc-meta">${subject} · ${cls} · CBSE · ${style_} Notes</div></div>
  ${body}</body></html>`;
}
function buildQPPDF(text, subject, cls, marks, duration) {
  const escaped = text.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Question Paper</title><style>
  @page{size:A4;margin:2cm 2.5cm}*{margin:0;padding:0;box-sizing:border-box}
  body{font-family:'Times New Roman',serif;font-size:11pt;line-height:1.9;color:#000}
  .qp-header{text-align:center;border-bottom:2.5pt double #000;padding-bottom:10pt;margin-bottom:14pt}
  .school-line{font-size:12pt;font-weight:bold}.qp-row{display:flex;justify-content:space-between;margin-top:9pt;font-size:10.5pt}
  .content{white-space:pre-wrap;font-size:11pt;line-height:1.9}
  .footer{position:fixed;bottom:.8cm;left:2.5cm;right:2.5cm;text-align:center;font-size:7pt;color:#bbb;border-top:.5pt solid #ddd;padding-top:3pt}
  </style></head><body>
  <div class="footer">Generated by BrainSpark AI</div>
  <div class="qp-header"><div class="school-line">________________________________ SCHOOL</div>
  <div style="font-size:11pt;margin-top:4pt"><strong>${subject.toUpperCase()}</strong></div>
  <div class="qp-row"><span>Class: <strong>${cls}</strong></span><span>Time: <strong>${duration}</strong></span><span>Max Marks: <strong>${marks}</strong></span></div></div>
  <div class="content">${escaped}</div></body></html>`;
}

// ════════════════════════════════════════════════════════════════
//  Markdown formatters (unchanged)
// ════════════════════════════════════════════════════════════════
function fmtAI(text) {
  return text
    .replace(/```[\s\S]*?```/g, m=>`<pre style="background:#F1F5F9;padding:10px 13px;border-radius:7px;font-size:12.5px;overflow:auto;margin:8px 0;color:#3730A3;font-family:monospace">${m.replace(/```\w*/g,"").trim()}</pre>`)
    .replace(/\*\*(.*?)\*\*/g,"<strong>$1</strong>").replace(/\*(.*?)\*/g,"<em style='color:#6366F1'>$1</em>")
    .replace(/^### (.+)$/gm,"<h4 style='font-size:.9rem;font-weight:800;color:#4F46E5;margin:11px 0 5px'>$1</h4>")
    .replace(/^## (.+)$/gm,"<h3 style='font-size:.95rem;font-weight:800;color:#3730A3;margin:12px 0 5px;border-left:3px solid #6366F1;padding-left:9px'>$1</h3>")
    .replace(/^# (.+)$/gm,"<h2 style='font-size:1rem;font-weight:900;color:#1E293B;margin:0 0 8px'>$1</h2>")
    .replace(/^[-•] (.+)$/gm,"<li style='margin:3px 0;color:#374151'>$1</li>")
    .replace(/(<li[\s\S]*?<\/li>\n?)+/g,m=>`<ul style="padding-left:18px;margin:7px 0">${m}</ul>`)
    .replace(/\n\n/g,"<br/><br/>").replace(/\n/g,"<br/>");
}
function fmtNotes(text) {
  const S = {
    h2:`font-size:10.5px;font-weight:800;text-transform:uppercase;letter-spacing:.6px;color:#1E293B;border-bottom:1.5px solid #CBD5E1;padding-bottom:4px;margin:18px 0 7px`,
    h3:`font-size:14px;font-weight:800;color:#1E293B;margin:12px 0 4px`,
    formula:`background:#F8FAFC;border:1px solid #CBD5E1;padding:9px 13px;border-radius:6px;font-family:'Courier New',monospace;font-size:12.5px;color:#334155;margin:8px 0;white-space:pre-wrap;line-height:1.5`,
  };
  return text
    .replace(/```[\s\S]*?```/g, m=>`<div style="${S.formula}">${m.replace(/```\w*/g,"").trim()}</div>`)
    .replace(/^# .+$/gm,"").replace(/^## (.+)$/gm,`<h3 style="${S.h2}">$1</h3>`).replace(/^### (.+)$/gm,`<h4 style="${S.h3}">$1</h4>`)
    .replace(/\*\*(.*?)\*\*/g,"<strong>$1</strong>").replace(/\*(.*?)\*/g,"<em style='color:#475569'>$1</em>")
    .replace(/^[-•] (.+)$/gm,"<li style='margin:3.5px 0;line-height:1.6'>$1</li>")
    .replace(/(<li[\s\S]*?<\/li>\n?)+/g,m=>`<ul style="padding-left:18px;margin:5px 0 8px">${m}</ul>`)
    .replace(/\n\n+/g,"</p><p style='margin:0 0 6px'>").replace(/\n/g,"<br>")
    .replace(/^/,"<p style='margin:0 0 6px'>").replace(/$/,"</p>")
    .replace(/<p style='margin:0 0 6px'>\s*<\/p>/g,"")
    .replace(/<p style='margin:0 0 6px'>(<[hud])/g,"$1").replace(/(<\/[hud][l234]?>)<\/p>/g,"$1")
    .replace(/<p style='margin:0 0 6px'>(<div)/g,"$1").replace(/(<\/div>)<\/p>/g,"$1");
}

// ════════════════════════════════════════════════════════════════
//  Data (unchanged)
// ════════════════════════════════════════════════════════════════
const SUBJECTS = ["Mathematics","Physics","Chemistry","Biology","English","History","Geography","Computer Science","Economics","Political Science"];
const CLASSES  = ["Class 6","Class 7","Class 8","Class 9","Class 10","Class 11","Class 12"];
const DIFFS    = ["Easy","Medium","Hard","Mixed"];
const CHAPTERS = {
  Mathematics:{"Class 6":["Ch 1: Knowing Our Numbers","Ch 2: Whole Numbers","Ch 3: Playing with Numbers","Ch 4: Basic Geometrical Ideas","Ch 5: Understanding Elementary Shapes","Ch 6: Integers","Ch 7: Fractions","Ch 8: Decimals","Ch 9: Data Handling","Ch 10: Mensuration","Ch 11: Algebra","Ch 12: Ratio and Proportion","Ch 13: Symmetry","Ch 14: Practical Geometry"],"Class 7":["Ch 1: Integers","Ch 2: Fractions and Decimals","Ch 3: Data Handling","Ch 4: Simple Equations","Ch 5: Lines and Angles","Ch 6: Triangle and its Properties","Ch 7: Congruence of Triangles","Ch 8: Comparing Quantities","Ch 9: Rational Numbers","Ch 10: Practical Geometry","Ch 11: Perimeter and Area","Ch 12: Algebraic Expressions","Ch 13: Exponents and Powers","Ch 14: Symmetry"],"Class 8":["Ch 1: Rational Numbers","Ch 2: Linear Equations in One Variable","Ch 3: Understanding Quadrilaterals","Ch 4: Squares and Square Roots","Ch 5: Cubes and Cube Roots","Ch 6: Comparing Quantities","Ch 7: Algebraic Expressions and Identities","Ch 8: Mensuration","Ch 9: Exponents and Powers","Ch 10: Direct and Inverse Proportions","Ch 11: Factorisation","Ch 12: Introduction to Graphs"],"Class 9":["Ch 1: Number Systems","Ch 2: Polynomials","Ch 3: Coordinate Geometry","Ch 4: Linear Equations in Two Variables","Ch 5: Introduction to Euclid's Geometry","Ch 6: Lines and Angles","Ch 7: Triangles","Ch 8: Quadrilaterals","Ch 9: Circles","Ch 10: Heron's Formula","Ch 11: Surface Areas and Volumes","Ch 12: Statistics","Ch 13: Probability"],"Class 10":["Ch 1: Real Numbers","Ch 2: Polynomials","Ch 3: Pair of Linear Equations","Ch 4: Quadratic Equations","Ch 5: Arithmetic Progressions","Ch 6: Triangles","Ch 7: Coordinate Geometry","Ch 8: Introduction to Trigonometry","Ch 9: Applications of Trigonometry","Ch 10: Circles","Ch 11: Areas Related to Circles","Ch 12: Surface Areas and Volumes","Ch 13: Statistics","Ch 14: Probability"],"Class 11":["Ch 1: Sets","Ch 2: Relations and Functions","Ch 3: Trigonometric Functions","Ch 4: Complex Numbers","Ch 5: Linear Inequalities","Ch 6: Permutations and Combinations","Ch 7: Binomial Theorem","Ch 8: Sequences and Series","Ch 9: Straight Lines","Ch 10: Conic Sections","Ch 11: Introduction to 3D Geometry","Ch 12: Limits and Derivatives","Ch 13: Statistics","Ch 14: Probability"],"Class 12":["Ch 1: Relations and Functions","Ch 2: Inverse Trigonometric Functions","Ch 3: Matrices","Ch 4: Determinants","Ch 5: Continuity and Differentiability","Ch 6: Application of Derivatives","Ch 7: Integrals","Ch 8: Application of Integrals","Ch 9: Differential Equations","Ch 10: Vector Algebra","Ch 11: Three Dimensional Geometry","Ch 12: Linear Programming","Ch 13: Probability"]},
  Physics:{"Class 9":["Ch 1: Motion","Ch 2: Force and Laws of Motion","Ch 3: Gravitation","Ch 4: Work and Energy","Ch 5: Sound"],"Class 10":["Ch 1: Light – Reflection and Refraction","Ch 2: Human Eye and Colourful World","Ch 3: Electricity","Ch 4: Magnetic Effects of Electric Current","Ch 5: Sources of Energy"],"Class 11":["Ch 1: Physical World","Ch 2: Units and Measurements","Ch 3: Motion in a Straight Line","Ch 4: Motion in a Plane","Ch 5: Laws of Motion","Ch 6: Work, Energy and Power","Ch 7: Rotational Motion","Ch 8: Gravitation","Ch 9: Mechanical Properties of Solids","Ch 10: Mechanical Properties of Fluids","Ch 11: Thermal Properties of Matter","Ch 12: Thermodynamics","Ch 13: Kinetic Theory","Ch 14: Oscillations","Ch 15: Waves"],"Class 12":["Ch 1: Electric Charges and Fields","Ch 2: Electrostatic Potential","Ch 3: Current Electricity","Ch 4: Moving Charges and Magnetism","Ch 5: Magnetism and Matter","Ch 6: Electromagnetic Induction","Ch 7: Alternating Current","Ch 8: Electromagnetic Waves","Ch 9: Ray Optics","Ch 10: Wave Optics","Ch 11: Dual Nature of Radiation","Ch 12: Atoms","Ch 13: Nuclei","Ch 14: Semiconductor Electronics"]},
  Chemistry:{"Class 9":["Ch 1: Matter in Our Surroundings","Ch 2: Is Matter Around Us Pure?","Ch 3: Atoms and Molecules","Ch 4: Structure of the Atom"],"Class 10":["Ch 1: Chemical Reactions and Equations","Ch 2: Acids, Bases and Salts","Ch 3: Metals and Non-metals","Ch 4: Carbon and its Compounds","Ch 5: Periodic Classification of Elements"],"Class 11":["Ch 1: Basic Concepts of Chemistry","Ch 2: Structure of Atom","Ch 3: Classification of Elements","Ch 4: Chemical Bonding","Ch 5: States of Matter","Ch 6: Thermodynamics","Ch 7: Equilibrium","Ch 8: Redox Reactions","Ch 9: Hydrogen","Ch 10: s-Block Elements","Ch 11: p-Block Elements","Ch 12: Organic Chemistry Basics","Ch 13: Hydrocarbons","Ch 14: Environmental Chemistry"],"Class 12":["Ch 1: Solid State","Ch 2: Solutions","Ch 3: Electrochemistry","Ch 4: Chemical Kinetics","Ch 5: Surface Chemistry","Ch 6: Isolation of Elements","Ch 7: p-Block Elements","Ch 8: d and f Block Elements","Ch 9: Coordination Compounds","Ch 10: Haloalkanes and Haloarenes","Ch 11: Alcohols, Phenols and Ethers","Ch 12: Aldehydes and Ketones","Ch 13: Amines","Ch 14: Biomolecules"]},
  Biology:{"Class 9":["Ch 1: The Fundamental Unit of Life","Ch 2: Tissues","Ch 3: Diversity in Living Organisms","Ch 4: Why Do We Fall Ill","Ch 5: Natural Resources","Ch 6: Improvement in Food Resources"],"Class 10":["Ch 1: Life Processes","Ch 2: Control and Coordination","Ch 3: How Do Organisms Reproduce","Ch 4: Heredity and Evolution","Ch 5: Our Environment","Ch 6: Management of Natural Resources"],"Class 11":["Ch 1: The Living World","Ch 2: Biological Classification","Ch 3: Plant Kingdom","Ch 4: Animal Kingdom","Ch 5: Morphology of Flowering Plants","Ch 6: Anatomy of Flowering Plants","Ch 7: Cell: The Unit of Life","Ch 8: Biomolecules","Ch 9: Cell Cycle and Cell Division","Ch 10: Transport in Plants","Ch 11: Photosynthesis","Ch 12: Respiration in Plants","Ch 13: Plant Growth","Ch 14: Human Physiology"],"Class 12":["Ch 1: Reproduction in Organisms","Ch 2: Sexual Reproduction","Ch 3: Human Reproduction","Ch 4: Reproductive Health","Ch 5: Principles of Inheritance","Ch 6: Molecular Basis of Inheritance","Ch 7: Evolution","Ch 8: Human Health and Disease","Ch 9: Food Production","Ch 10: Microbes in Human Welfare","Ch 11: Biotechnology – Principles","Ch 12: Biotechnology – Applications","Ch 13: Organisms and Populations","Ch 14: Ecosystem","Ch 15: Biodiversity","Ch 16: Environmental Issues"]},
  History:{"Class 9":["Ch 1: The French Revolution","Ch 2: Russian Revolution","Ch 3: Nazism and Hitler","Ch 4: Forest Society","Ch 5: Pastoralists"],"Class 10":["Ch 1: Rise of Nationalism in Europe","Ch 2: Nationalism in India","Ch 3: Making of a Global World","Ch 4: Age of Industrialisation","Ch 5: Print Culture"],"Class 11":["Ch 1: From the Beginning of Time","Ch 2: Writing and City Life","Ch 3: An Empire Across Three Continents","Ch 4: The Central Islamic Lands","Ch 5: Nomadic Empires","Ch 6: The Three Orders","Ch 7: Changing Cultural Traditions","Ch 8: Confrontation of Cultures","Ch 9: The Industrial Revolution","Ch 10: Displacing Indigenous Peoples","Ch 11: Paths to Modernisation"],"Class 12":["Ch 1: Harappan Civilisation","Ch 2: Kings, Farmers and Towns","Ch 3: Kinship, Caste and Class","Ch 4: Thinkers and Beliefs","Ch 5: Through the Eyes of Travellers","Ch 6: Bhakti–Sufi Traditions","Ch 7: Vijayanagara","Ch 8: Peasants and Zamindars","Ch 9: Kings and Chronicles","Ch 10: Colonialism and Countryside","Ch 11: Rebels and the Raj","Ch 12: Colonial Cities","Ch 13: Mahatma Gandhi","Ch 14: Understanding Partition","Ch 15: Framing the Constitution"]},
  Geography:{"Class 9":["Ch 1: India – Size and Location","Ch 2: Physical Features","Ch 3: Drainage","Ch 4: Climate","Ch 5: Natural Vegetation","Ch 6: Population"],"Class 10":["Ch 1: Resources and Development","Ch 2: Forest and Wildlife","Ch 3: Water Resources","Ch 4: Agriculture","Ch 5: Minerals and Energy","Ch 6: Manufacturing Industries","Ch 7: Lifelines of National Economy"],"Class 11":["Ch 1: Geography as a Discipline","Ch 2: Origin of the Earth","Ch 3: Interior of the Earth","Ch 4: Oceans and Continents","Ch 5: Minerals and Rocks","Ch 6: Geomorphic Processes","Ch 7: Landforms","Ch 8: Atmosphere","Ch 9: Solar Radiation","Ch 10: Atmospheric Circulation","Ch 11: Water in Atmosphere","Ch 12: World Climate","Ch 13: Oceans","Ch 14: Ocean Movements","Ch 15: Life on the Earth","Ch 16: Biodiversity"],"Class 12":["Ch 1: Human Geography","Ch 2: World Population","Ch 3: Population Composition","Ch 4: Human Development","Ch 5: Primary Activities","Ch 6: Secondary Activities","Ch 7: Tertiary Activities","Ch 8: Transport","Ch 9: International Trade","Ch 10: Human Settlements"]},
  "Computer Science":{"Class 9":["Ch 1: Introduction to Computer","Ch 2: Software and Hardware","Ch 3: Memory and Storage","Ch 4: Input/Output Devices","Ch 5: Internet Basics","Ch 6: MS Word","Ch 7: MS Excel","Ch 8: MS PowerPoint","Ch 9: Cyber Safety"],"Class 10":["Ch 1: Networking","Ch 2: HTML Basics","Ch 3: HTML Forms","Ch 4: CSS","Ch 5: JavaScript","Ch 6: Database and SQL","Ch 7: Cyber Ethics"],"Class 11":["Ch 1: Introduction to Python","Ch 2: Data Types","Ch 3: Control Flow","Ch 4: Functions","Ch 5: Strings","Ch 6: Lists","Ch 7: Tuples and Dictionaries","Ch 8: File Handling","Ch 9: Exception Handling","Ch 10: NumPy","Ch 11: Database Concepts","Ch 12: SQL Queries","Ch 13: Societal Impact of IT"],"Class 12":["Ch 1: Python Revision","Ch 2: OOP","Ch 3: File Handling","Ch 4: Stack","Ch 5: Queue","Ch 6: Sorting and Searching","Ch 7: Database Management","Ch 8: SQL Functions","Ch 9: Networking","Ch 10: Societal Issues"]},
  Economics:{"Class 9":["Ch 1: Village Palampur","Ch 2: People as Resource","Ch 3: Poverty","Ch 4: Food Security"],"Class 10":["Ch 1: Development","Ch 2: Sectors of Economy","Ch 3: Money and Credit","Ch 4: Globalisation","Ch 5: Consumer Rights"],"Class 11":["Ch 1: Introduction to Statistics","Ch 2: Collection of Data","Ch 3: Organisation of Data","Ch 4: Presentation of Data","Ch 5: Central Tendency","Ch 6: Measures of Dispersion","Ch 7: Correlation","Ch 8: Index Numbers","Ch 9: Statistical Tools"],"Class 12":["Ch 1: Introduction to Macroeconomics","Ch 2: National Income","Ch 3: Money and Banking","Ch 4: Income and Employment","Ch 5: Government Budget","Ch 6: Open Economy"]},
  English:{"Class 9":["Beehive: Ch 1–9","Moments: Ch 1–4","Grammar: Tenses","Grammar: Reported Speech","Writing: Letter and Story"],"Class 10":["First Flight: Ch 1–7","Footprints: Ch 1–3","Grammar: Editing and Omission","Writing: Notice, Letter, Diary Entry"],"Class 12":["Flamingo: Ch 1–8","Vistas: Ch 1–4","Writing: Article, Report, Letter"]},
  "Political Science":{"Class 9":["Ch 1: What is Democracy?","Ch 2: Constitutional Design","Ch 3: Electoral Politics","Ch 4: Working of Institutions","Ch 5: Democratic Rights"],"Class 10":["Ch 1: Power Sharing","Ch 2: Federalism","Ch 3: Democracy and Diversity","Ch 4: Gender, Religion and Caste","Ch 5: Popular Struggles","Ch 6: Political Parties","Ch 7: Outcomes of Democracy","Ch 8: Challenges to Democracy"]},
};
function getChapters(s,c){ return CHAPTERS[s]?.[c]||[]; }

const LEVELS=[{name:"Novice",min:0,color:"#94A3B8",bg:"#F1F5F9",emoji:"🌱"},{name:"Scholar",min:100,color:"#10B981",bg:"#ECFDF5",emoji:"📚"},{name:"Genius",min:300,color:"#6366F1",bg:"#EEF2FF",emoji:"🧠"},{name:"Master",min:600,color:"#F97316",bg:"#FFF7ED",emoji:"🏆"},{name:"Legend",min:1000,color:"#EF4444",bg:"#FEF2F2",emoji:"⭐"}];
function getLevel(xp){for(let i=LEVELS.length-1;i>=0;i--)if(xp>=LEVELS[i].min)return{...LEVELS[i],idx:i};return{...LEVELS[0],idx:0};}
function getNextLevel(idx){return LEVELS[Math.min(idx+1,LEVELS.length-1)];}

// ════════════════════════════════════════════════════════════════
//  Shared UI Components
// ════════════════════════════════════════════════════════════════
function PageHeader({icon,title,subtitle,color}){return(<div style={{marginBottom:20}}><div style={{display:"flex",alignItems:"center",gap:9,marginBottom:3}}><span style={{fontSize:25}}>{icon}</span><h2 style={{fontFamily:"'Sora',sans-serif",fontWeight:900,fontSize:"clamp(1.15rem,2.5vw,1.55rem)",color:"#1E293B",margin:0}}>{title}</h2></div><p style={{color:"#64748B",fontSize:13,margin:0,paddingLeft:34}}>{subtitle}</p><div style={{height:3,width:44,background:color,borderRadius:2,marginTop:9,marginLeft:34}}/></div>);}
function Card({children,style={}}){return <div style={{background:"white",borderRadius:13,padding:17,border:"1px solid #E2E8F0",boxShadow:"0 2px 10px rgba(0,0,0,.05)",...style}}>{children}</div>;}
function Label({children}){return <div style={{fontSize:10.5,fontWeight:800,color:"#94A3B8",marginBottom:5,letterSpacing:.6,textTransform:"uppercase"}}>{children}</div>;}
function XPBadge({amount,label}){return(<div style={{display:"flex",alignItems:"center",marginTop:13}}><div style={{background:"#EEF2FF",padding:"5px 12px",borderRadius:20,display:"flex",alignItems:"center",gap:5,border:"1px solid #C7D2FE",color:"#6366F1",fontWeight:700,fontSize:12.5}}><Zap size={12}/> Earn +{amount} XP {label}</div></div>);}
function Spinner(){return <div style={{width:15,height:15,border:"2px solid rgba(255,255,255,.4)",borderTop:"2px solid white",borderRadius:"50%",animation:"spin .7s linear infinite"}}/>;}
function InpField({label,type="text",value,onChange,placeholder,required=true}){return(<div><div style={{fontSize:11,fontWeight:800,color:"#64748B",marginBottom:4,textTransform:"uppercase",letterSpacing:.5}}>{label}</div><input type={type} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} required={required} style={{width:"100%",padding:"10px 13px",borderRadius:9,border:"1.5px solid #E2E8F0",fontSize:14,fontFamily:"'Nunito',sans-serif",color:"#1E293B",outline:"none",boxSizing:"border-box"}} onFocus={e=>e.target.style.borderColor="#6366F1"} onBlur={e=>e.target.style.borderColor="#E2E8F0"}/></div>);}
const selSt={width:"100%",padding:"9px 11px",borderRadius:9,border:"1.5px solid #E2E8F0",fontSize:13,color:"#1E293B",background:"white",fontFamily:"'Nunito',sans-serif",outline:"none"};
const inpSt={width:"100%",padding:"10px 13px",borderRadius:9,border:"1.5px solid #E2E8F0",fontSize:13.5,color:"#1E293B",fontFamily:"'Nunito',sans-serif",outline:"none",boxSizing:"border-box"};
function pBtn(col,size="normal"){const p=size==="small"?"7px 14px":"11px 20px";return{background:`linear-gradient(135deg,${col},${col}cc)`,color:"white",padding:p,borderRadius:10,border:"none",fontWeight:800,fontSize:size==="small"?12.5:14.5,cursor:"pointer",display:"inline-flex",alignItems:"center",gap:6,fontFamily:"'Nunito',sans-serif"};}
function oBtn(col){return{background:"white",color:col,padding:"7px 14px",borderRadius:9,border:`2px solid ${col}`,fontWeight:700,fontSize:12.5,cursor:"pointer",display:"inline-flex",alignItems:"center",gap:5,fontFamily:"'Nunito',sans-serif"};}

// ════════════════════════════════════════════════════════════════
//  Auth Page — now calls real backend
// ════════════════════════════════════════════════════════════════
function AuthPage({onAuth,onBack}){
  const [mode,setMode]=useState("signin");
  const [method,setMethod]=useState("personal");
  const [loading,setLoading]=useState(false);
  const [loadingBtn,setLoadingBtn]=useState("");
  const [showEmail,setShowEmail]=useState(false);
  const [error,setError]=useState("");
  const [name,setName]=useState("");
  const [email,setEmail]=useState("");
  const [pass,setPass]=useState("");
  const [cpass,setCpass]=useState("");
  const [schoolCode,setSchoolCode]=useState("");
  const [rollNo,setRollNo]=useState("");
  const [spass,setSpass]=useState("");
  const [role,setRole]=useState("student");

  async function handleEmail(e){
    e.preventDefault();setError("");
    if(mode==="signup"&&pass!==cpass){setError("Passwords do not match.");return;}
    setLoadingBtn("email");setLoading(true);
    try{
      let data;
      if(mode==="signup") data=await auth.register(name,email,pass);
      else                data=await auth.login(email,pass);
      onAuth(data.user);
    }catch(err){setError(err.message);}
    setLoading(false);setLoadingBtn("");
  }

  async function handleSchool(e){
    e.preventDefault();setError("");
    setLoadingBtn("school");setLoading(true);
    try{
      const data=await auth.schoolLogin(schoolCode,rollNo,spass,role);
      onAuth(data.user);
    }catch(err){setError(err.message);}
    setLoading(false);setLoadingBtn("");
  }

  const solidBtn=(col)=>({width:"100%",padding:"12px 18px",borderRadius:11,border:"none",fontWeight:800,fontSize:15,cursor:loading?"not-allowed":"pointer",fontFamily:"'Nunito',sans-serif",display:"flex",alignItems:"center",justifyContent:"center",gap:9,opacity:loading?.7:1,background:col,color:"white"});
  const outlineBtn={width:"100%",padding:"11px 18px",borderRadius:11,border:"2px solid #E2E8F0",fontWeight:700,fontSize:14,cursor:loading?"not-allowed":"pointer",background:"white",color:"#1E293B",display:"flex",alignItems:"center",justifyContent:"center",gap:9,fontFamily:"'Nunito',sans-serif",opacity:loading?.7:1};

  return(
    <div style={{minHeight:"100vh",background:"linear-gradient(135deg,#6366F1,#8B5CF6 50%,#A855F7)",display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
      <div style={{background:"white",borderRadius:22,padding:"32px 28px",width:"100%",maxWidth:450,boxShadow:"0 28px 70px rgba(0,0,0,.22)",position:"relative"}}>
        <button onClick={onBack} style={{position:"absolute",top:18,left:18,background:"none",border:"none",cursor:"pointer",color:"#94A3B8",display:"flex",alignItems:"center",gap:4,fontWeight:600,fontSize:13,fontFamily:"'Nunito',sans-serif"}}><ArrowLeft size={14}/> Back</button>
        <div style={{textAlign:"center",marginBottom:22}}>
          <div style={{width:46,height:46,borderRadius:13,background:"linear-gradient(135deg,#6366F1,#8B5CF6)",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 9px"}}><Brain size={24} color="white"/></div>
          <span style={{fontFamily:"'Sora',sans-serif",fontWeight:900,fontSize:19,color:"#1E293B"}}>BrainSpark<span style={{color:"#6366F1"}}> AI</span></span>
        </div>
        <div style={{display:"flex",background:"#F1F5F9",borderRadius:11,padding:3,marginBottom:22}}>
          {["signin","signup"].map(m=>(
            <button key={m} onClick={()=>{setMode(m);setError("");setShowEmail(false);}} style={{flex:1,padding:"8px",borderRadius:9,border:"none",fontWeight:700,fontSize:14,cursor:"pointer",fontFamily:"'Nunito',sans-serif",background:mode===m?"white":"transparent",color:mode===m?"#1E293B":"#64748B",boxShadow:mode===m?"0 2px 7px rgba(0,0,0,.1)":"none"}}>
              {m==="signin"?"Sign In":"Sign Up"}
            </button>
          ))}
        </div>
        <div style={{display:"flex",gap:8,marginBottom:20}}>
          {[["personal","👤 Personal"],["school","🏫 Via School"]].map(([m,l])=>(
            <button key={m} onClick={()=>{setMethod(m);setError("");}} style={{flex:1,padding:"8px 10px",borderRadius:9,border:`2px solid ${method===m?"#6366F1":"#E2E8F0"}`,fontWeight:700,fontSize:13,cursor:"pointer",fontFamily:"'Nunito',sans-serif",background:method===m?"#EEF2FF":"white",color:method===m?"#6366F1":"#64748B"}}>{l}</button>
          ))}
        </div>
        {error&&<div style={{background:"#FEF2F2",color:"#DC2626",padding:"9px 13px",borderRadius:9,marginBottom:14,fontSize:13,fontWeight:600}}>⚠️ {error}</div>}

        {method==="personal"&&!showEmail&&(
          <div style={{display:"flex",flexDirection:"column",gap:9}}>
            <button disabled style={{...outlineBtn,opacity:.5,cursor:"not-allowed"}}>
              <svg width="17" height="17" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
              Continue with Google (setup required)
            </button>
            <div style={{display:"flex",alignItems:"center",gap:10,margin:"2px 0"}}>
              <div style={{flex:1,height:1,background:"#E2E8F0"}}/><span style={{color:"#94A3B8",fontSize:12,fontWeight:600}}>OR</span><div style={{flex:1,height:1,background:"#E2E8F0"}}/>
            </div>
            <button onClick={()=>setShowEmail(true)} style={{...outlineBtn,borderColor:"#6366F1",color:"#6366F1"}}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#6366F1" strokeWidth="2"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
              Continue with Email
            </button>
          </div>
        )}

        {method==="personal"&&showEmail&&(
          <form onSubmit={handleEmail} style={{display:"flex",flexDirection:"column",gap:11}}>
            <button type="button" onClick={()=>setShowEmail(false)} style={{background:"none",border:"none",cursor:"pointer",color:"#6366F1",fontWeight:700,fontSize:13,textAlign:"left",display:"flex",alignItems:"center",gap:4,fontFamily:"'Nunito',sans-serif",marginBottom:2}}><ArrowLeft size={13}/> Back</button>
            {mode==="signup"&&<InpField label="Full Name" value={name} onChange={setName} placeholder="Your full name"/>}
            <InpField label="Email" type="email" value={email} onChange={setEmail} placeholder="you@email.com"/>
            <InpField label="Password" type="password" value={pass} onChange={setPass} placeholder="••••••••"/>
            {mode==="signup"&&<InpField label="Confirm Password" type="password" value={cpass} onChange={setCpass} placeholder="••••••••"/>}
            <button type="submit" disabled={loading} style={solidBtn("linear-gradient(135deg,#6366F1,#8B5CF6)")}>
              {loadingBtn==="email"?<><Spinner/>{mode==="signin"?"Signing in...":"Creating account..."}</>:mode==="signin"?"Sign In":"Create Account"}
            </button>
          </form>
        )}

        {method==="school"&&(
          <form onSubmit={handleSchool} style={{display:"flex",flexDirection:"column",gap:11}}>
            <div style={{background:"#EEF2FF",padding:"9px 13px",borderRadius:9,fontSize:12.5,color:"#4338CA",fontWeight:600,lineHeight:1.5}}>🏫 Enter the School Code given by your school.</div>
            <div style={{display:"flex",gap:8}}>
              {["student","teacher"].map(r=>(
                <button key={r} type="button" onClick={()=>setRole(r)} style={{flex:1,padding:"8px",borderRadius:9,border:`2px solid ${role===r?"#6366F1":"#E2E8F0"}`,fontWeight:700,fontSize:13,cursor:"pointer",background:role===r?"#EEF2FF":"white",color:role===r?"#6366F1":"#64748B",fontFamily:"'Nunito',sans-serif"}}>
                  {r==="student"?"🎒 Student":"👨‍🏫 Teacher"}
                </button>
              ))}
            </div>
            <InpField label="School Code" value={schoolCode} onChange={setSchoolCode} placeholder="e.g. DPS001"/>
            <InpField label={role==="teacher"?"Teacher ID":"Roll Number"} value={rollNo} onChange={setRollNo} placeholder={role==="teacher"?"e.g. T-101":"e.g. 2024-042"}/>
            <InpField label="Password" type="password" value={spass} onChange={setSpass} placeholder="••••••••"/>
            <button type="submit" disabled={loading} style={solidBtn("linear-gradient(135deg,#6366F1,#8B5CF6)")}>
              {loadingBtn==="school"?<><Spinner/>Signing in...</>:"Sign In to School Account"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
//  Profile Page — real backend
// ════════════════════════════════════════════════════════════════
function ProfilePage({user,onUpdate,onBack}){
  const [form,setForm]=useState({name:user.name||"",bio:user.bio||"",phone:user.phone||"",classLevel:user.class_level||""});
  const [saving,setSaving]=useState(false);
  const [msg,setMsg]=useState("");

  async function save(){
    setSaving(true);setMsg("");
    try{
      const updated=await userApi.updateProfile(form);
      onUpdate(updated);setMsg("✅ Profile updated successfully!");
    }catch(e){setMsg("❌ "+e.message);}
    setSaving(false);
  }

  return(
    <div>
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:22}}>
        <button onClick={onBack} style={{...oBtn("#6366F1"),padding:"7px 12px"}}><ArrowLeft size={13}/> Back</button>
        <PageHeader icon="👤" title="My Profile" subtitle="Update your personal information" color="#6366F1"/>
      </div>

      <Card>
        {/* Avatar */}
        <div style={{display:"flex",alignItems:"center",gap:16,marginBottom:24,paddingBottom:20,borderBottom:"1px solid #F1F5F9"}}>
          <div style={{width:64,height:64,borderRadius:18,background:"linear-gradient(135deg,#6366F1,#8B5CF6)",display:"flex",alignItems:"center",justifyContent:"center",color:"white",fontWeight:900,fontSize:26}}>
            {user.avatar_url?<img src={user.avatar_url} alt="" style={{width:"100%",height:"100%",borderRadius:18,objectFit:"cover"}}/>:(user.name||"U").charAt(0).toUpperCase()}
          </div>
          <div>
            <div style={{fontFamily:"'Sora',sans-serif",fontWeight:800,fontSize:18,color:"#1E293B"}}>{user.name}</div>
            <div style={{fontSize:13,color:"#64748B",marginTop:2}}>{user.type==="school"?`🏫 ${user.schoolName||""} · ${user.role}`:`📧 ${user.email}`}</div>
            {user.type==="school"&&<div style={{marginTop:4,background:"#EEF2FF",display:"inline-block",padding:"2px 10px",borderRadius:20,fontSize:11,fontWeight:700,color:"#6366F1"}}>School Code: {user.schoolCode}</div>}
          </div>
        </div>

        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginBottom:14}}>
          <div><Label>Full Name</Label><input value={form.name} onChange={e=>setForm({...form,name:e.target.value})} style={inpSt} placeholder="Your name"/></div>
          <div><Label>Phone</Label><input value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})} style={inpSt} placeholder="+91 XXXXX XXXXX"/></div>
        </div>
        {user.type==="personal"&&(
          <div style={{marginBottom:14}}>
            <Label>Class</Label>
            <select value={form.classLevel} onChange={e=>setForm({...form,classLevel:e.target.value})} style={selSt}>
              <option value="">Select class</option>
              {CLASSES.map(c=><option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        )}
        <div style={{marginBottom:18}}>
          <Label>Bio</Label>
          <textarea value={form.bio} onChange={e=>setForm({...form,bio:e.target.value})} rows={3} placeholder="A short description about yourself..." style={{...inpSt,resize:"vertical"}}/>
        </div>
        {msg&&<div style={{padding:"9px 13px",borderRadius:9,marginBottom:14,fontSize:13,fontWeight:600,background:msg.startsWith("✅")?"#ECFDF5":"#FEF2F2",color:msg.startsWith("✅")?"#166534":"#DC2626"}}>{msg}</div>}
        <button onClick={save} disabled={saving} style={pBtn("#6366F1")}>
          {saving?<><Spinner/> Saving...</>:<><Save size={14}/> Save Changes</>}
        </button>
      </Card>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
//  Settings Page — real backend
// ════════════════════════════════════════════════════════════════
function SettingsPage({user,onBack,onLogout}){
  const [cp,setCp]=useState({current:"",newPass:"",confirm:""});
  const [loading,setLoading]=useState(false);
  const [msg,setMsg]=useState("");

  async function changePass(e){
    e.preventDefault();setMsg("");
    if(cp.newPass!==cp.confirm){setMsg("❌ New passwords do not match.");return;}
    if(cp.newPass.length<8){setMsg("❌ Password must be at least 8 characters.");return;}
    setLoading(true);
    try{
      await userApi.changePassword(cp.current,cp.newPass);
      setMsg("✅ Password changed successfully!");
      setCp({current:"",newPass:"",confirm:""});
    }catch(e){setMsg("❌ "+e.message);}
    setLoading(false);
  }

  return(
    <div>
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:22}}>
        <button onClick={onBack} style={{...oBtn("#6366F1"),padding:"7px 12px"}}><ArrowLeft size={13}/> Back</button>
        <PageHeader icon="⚙️" title="Settings" subtitle="Manage your account settings" color="#6366F1"/>
      </div>

      {/* Account Info */}
      <Card style={{marginBottom:14}}>
        <h3 style={{fontFamily:"'Sora',sans-serif",fontWeight:800,fontSize:15,color:"#1E293B",marginBottom:14}}>Account Information</h3>
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          {[["Name",user.name],["Email",user.email||"School account"],["Account Type",user.type==="school"?`School (${user.role})`:"Personal"],["Member Since",new Date(user.created_at||Date.now()).toLocaleDateString("en-IN",{year:"numeric",month:"long",day:"numeric"})]].map(([l,v])=>(
            <div key={l} style={{display:"flex",justifyContent:"space-between",padding:"9px 12px",background:"#F8FAFC",borderRadius:9}}>
              <span style={{fontWeight:600,color:"#64748B",fontSize:13}}>{l}</span>
              <span style={{fontWeight:700,color:"#1E293B",fontSize:13}}>{v}</span>
            </div>
          ))}
        </div>
      </Card>

      {/* Change Password */}
      {user.provider==="email"||user.type==="school"?(
        <Card style={{marginBottom:14}}>
          <h3 style={{fontFamily:"'Sora',sans-serif",fontWeight:800,fontSize:15,color:"#1E293B",marginBottom:14}}>🔒 Change Password</h3>
          <form onSubmit={changePass} style={{display:"flex",flexDirection:"column",gap:11}}>
            <InpField label="Current Password" type="password" value={cp.current} onChange={v=>setCp({...cp,current:v})} placeholder="Your current password"/>
            <InpField label="New Password" type="password" value={cp.newPass} onChange={v=>setCp({...cp,newPass:v})} placeholder="Minimum 8 characters"/>
            <InpField label="Confirm New Password" type="password" value={cp.confirm} onChange={v=>setCp({...cp,confirm:v})} placeholder="Repeat new password"/>
            {msg&&<div style={{padding:"9px 13px",borderRadius:9,fontSize:13,fontWeight:600,background:msg.startsWith("✅")?"#ECFDF5":"#FEF2F2",color:msg.startsWith("✅")?"#166534":"#DC2626"}}>{msg}</div>}
            <button type="submit" disabled={loading} style={pBtn("#6366F1")}>
              {loading?<><Spinner/> Updating...</>:<><Lock size={14}/> Update Password</>}
            </button>
          </form>
        </Card>
      ):(
        <Card style={{marginBottom:14}}>
          <p style={{color:"#64748B",fontSize:13}}>You signed in with {user.provider}. Password management is handled by {user.provider}.</p>
        </Card>
      )}

      {/* Help */}
      <Card style={{marginBottom:14}}>
        <h3 style={{fontFamily:"'Sora',sans-serif",fontWeight:800,fontSize:15,color:"#1E293B",marginBottom:14}}>❓ Help & Support</h3>
        {[["How to use Doubt Solver?","Type any question in your subject and press Send."],["How to earn XP?","Use any AI tool — doubt solving, quizzes, notes, papers."],["How to download notes as PDF?","Generate notes, then click 'Download PDF' button."],["School code not working?","Contact your school teacher or admin for the correct code."]].map(([q,a])=>(
          <div key={q} style={{padding:"10px 12px",background:"#F8FAFC",borderRadius:9,marginBottom:8}}>
            <div style={{fontWeight:700,color:"#1E293B",fontSize:13,marginBottom:3}}>{q}</div>
            <div style={{color:"#64748B",fontSize:12.5}}>{a}</div>
          </div>
        ))}
      </Card>

      {/* Sign out */}
      <Card>
        <h3 style={{fontFamily:"'Sora',sans-serif",fontWeight:800,fontSize:15,color:"#1E293B",marginBottom:12}}>Sign Out</h3>
        <p style={{color:"#64748B",fontSize:13,marginBottom:14}}>You will be signed out and returned to the home page.</p>
        <button onClick={onLogout} style={{...pBtn("#EF4444"),background:"linear-gradient(135deg,#EF4444,#DC2626)"}}>
          <LogOut size={14}/> Sign Out
        </button>
      </Card>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
//  Doubt Solver — calls real backend
// ════════════════════════════════════════════════════════════════
function DoubtSolver({onXP}){
  const [messages,setMessages]=useState([{role:"assistant",text:"👋 Hi! Ask me anything — I'll give you a **short, clear answer** with steps.\n\nType your doubt below. 🎯"}]);
  const [input,setInput]=useState("");
  const [subject,setSubject]=useState("Mathematics");
  const [cls,setCls]=useState("Class 10");
  const [loading,setLoading]=useState(false);
  const [count,setCount]=useState(0);
  const bottomRef=useRef(null);
  useEffect(()=>{bottomRef.current?.scrollIntoView({behavior:"smooth"});},[messages]);

  async function send(){
    if(!input.trim()||loading)return;
    const q=input.trim();setInput("");
    setMessages(p=>[...p,{role:"user",text:q}]);
    setLoading(true);
    try{
      const history=messages.slice(-8).map(m=>({role:m.role==="user"?"user":"assistant",content:m.text}));
      const system=`You are a ${cls} ${subject} CBSE tutor. Answer concisely and clearly.
RULES: Max 150 words. Line 1: Direct one-sentence answer. Then numbered steps only if needed.
Bold (**) key terms and formulas only. Use ## for section headings only if 2+ distinct parts.
If calculation: show working step-by-step, brief. End with one key formula or tip if relevant.
No "great question", no padding phrases.`;
      const {content:ans,xpEarned}=await aiApi.doubt([...history,{role:"user",content:q}],system,subject);
      setMessages(p=>[...p,{role:"assistant",text:ans}]);
      setCount(c=>c+1);onXP(xpEarned||15);
    }catch(e){setMessages(p=>[...p,{role:"assistant",text:`⚠️ ${e.message||"Something went wrong. Try again."}`}]);}
    setLoading(false);
  }

  return(
    <div>
      <PageHeader icon="🤖" title="AI Doubt Solver" subtitle="Short, clear, step-by-step answers — instantly" color="#6366F1"/>
      <div style={{display:"flex",gap:10,marginBottom:13,flexWrap:"wrap",alignItems:"center"}}>
        <select value={subject} onChange={e=>setSubject(e.target.value)} style={selSt}>{SUBJECTS.map(s=><option key={s}>{s}</option>)}</select>
        <select value={cls} onChange={e=>setCls(e.target.value)} style={selSt}>{CLASSES.map(c=><option key={c}>{c}</option>)}</select>
        <div style={{marginLeft:"auto",background:"#EEF2FF",padding:"6px 13px",borderRadius:9,fontWeight:700,color:"#6366F1",fontSize:13}}>✅ {count} solved</div>
      </div>
      <div style={{background:"white",borderRadius:18,border:"1px solid #E2E8F0",overflow:"hidden",boxShadow:"0 3px 16px rgba(0,0,0,.06)"}}>
        <div style={{height:410,overflowY:"auto",padding:18,display:"flex",flexDirection:"column",gap:13}}>
          {messages.map((m,i)=>(
            <div key={i} style={{display:"flex",justifyContent:m.role==="user"?"flex-end":"flex-start",alignItems:"flex-start",gap:9}}>
              {m.role==="assistant"&&<div style={{width:31,height:31,borderRadius:9,background:"linear-gradient(135deg,#6366F1,#8B5CF6)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,marginTop:2}}><Brain size={16} color="white"/></div>}
              <div style={{maxWidth:"78%",padding:"10px 14px",borderRadius:m.role==="user"?"14px 3px 14px 14px":"3px 14px 14px 14px",background:m.role==="user"?"linear-gradient(135deg,#6366F1,#8B5CF6)":"#F8FAFC",color:m.role==="user"?"white":"#1E293B",fontSize:13.5,lineHeight:1.7,border:m.role==="assistant"?"1px solid #E2E8F0":"none"}}>
                {m.role==="assistant"?<span dangerouslySetInnerHTML={{__html:fmtAI(m.text)}}/>:m.text}
              </div>
            </div>
          ))}
          {loading&&<div style={{display:"flex",gap:9,alignItems:"center"}}><div style={{width:31,height:31,borderRadius:9,background:"linear-gradient(135deg,#6366F1,#8B5CF6)",display:"flex",alignItems:"center",justifyContent:"center"}}><Brain size={16} color="white"/></div><div style={{background:"#F8FAFC",padding:"10px 14px",borderRadius:"3px 14px 14px 14px",border:"1px solid #E2E8F0",display:"flex",gap:5}}>{[0,1,2].map(j=><div key={j} style={{width:7,height:7,borderRadius:"50%",background:"#6366F1",animation:`dotBounce 1s ${j*.2}s infinite ease-in-out`}}/>)}</div></div>}
          <div ref={bottomRef}/>
        </div>
        <div style={{borderTop:"1px solid #F1F5F9",padding:13,display:"flex",gap:9}}>
          <input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&!e.shiftKey&&send()} placeholder={`Ask a ${subject} question for ${cls}...`} style={{flex:1,padding:"10px 14px",borderRadius:10,border:"1.5px solid #E2E8F0",fontSize:13.5,outline:"none",fontFamily:"'Nunito',sans-serif",color:"#1E293B"}} onFocus={e=>e.target.style.borderColor="#6366F1"} onBlur={e=>e.target.style.borderColor="#E2E8F0"}/>
          <button onClick={send} disabled={loading||!input.trim()} style={{padding:"10px 18px",borderRadius:10,background:"linear-gradient(135deg,#6366F1,#8B5CF6)",color:"white",border:"none",cursor:"pointer",opacity:loading||!input.trim()?.5:1,display:"flex",alignItems:"center",gap:6,fontWeight:700,fontFamily:"'Nunito',sans-serif"}}><Send size={14}/> Send</button>
        </div>
      </div>
      <XPBadge amount={15} label="per doubt solved"/>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
//  Notes Maker — calls real backend, save to library
// ════════════════════════════════════════════════════════════════
function NotesMaker({onXP}){
  const [subject,setSubject]=useState("Mathematics");
  const [cls,setCls]=useState("Class 10");
  const [chapter,setChapter]=useState("");
  const [customCh,setCustomCh]=useState("");
  const [style_,setStyle]=useState("Standard");
  const [notes,setNotes]=useState("");
  const [loading,setLoading]=useState(false);
  const [saving,setSaving]=useState(false);
  const [saveMsg,setSaveMsg]=useState("");
  const chapters=getChapters(subject,cls);
  const finalChapter=chapter==="__custom__"||!chapters.length?customCh:chapter;
  useEffect(()=>{setChapter("");setCustomCh("");},[subject,cls]);

  async function generate(){
    if(!finalChapter.trim()||loading)return;
    setLoading(true);setNotes("");setSaveMsg("");
    try{
      const system=`You are a CBSE textbook author. Write concise, exam-ready notes. Target: 450–650 words.
USE this structure:
# ${finalChapter}
## 1. Introduction
[2–3 sentences]
## 2. Key Concepts
### [Concept Name]
[3–5 lines. **Bold** key terms.]
## 3. Important Formulas
- **[Name]:** expression
## 4. Solved Example
**Problem:** [CBSE-level problem]
**Solution:** Step 1:... **Answer:** [result]
## 5. Key Points for Exam
- [5 one-line exam points]
## 6. Practice Questions
1. [Short answer] 2. [Application] 3. [HOT]
RULES: No emojis. No filler. Bold key terms only. Style: ${style_}.`;
      const {content:n,xpEarned}=await aiApi.notes([{role:"user",content:`Write ${style_} CBSE study notes on "${finalChapter}" for ${cls} ${subject}.`}],system,subject,finalChapter);
      setNotes(n);onXP(xpEarned||20);
    }catch(e){alert("Error: "+e.message);}
    setLoading(false);
  }

  async function saveToLibrary(){
    setSaving(true);setSaveMsg("");
    try{
      await userApi.saveNote({subject,classLevel:cls,chapter:finalChapter,style:style_,content:notes});
      setSaveMsg("✅ Saved to your library!");
    }catch(e){setSaveMsg("❌ "+e.message);}
    setSaving(false);
  }

  return(
    <div>
      <PageHeader icon="📖" title="AI Notes Generator" subtitle="Textbook-quality chapter notes — download as PDF" color="#10B981"/>
      <Card>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:11,marginBottom:13}}>
          <div><Label>Subject</Label><select value={subject} onChange={e=>setSubject(e.target.value)} style={selSt}>{SUBJECTS.map(s=><option key={s}>{s}</option>)}</select></div>
          <div><Label>Class</Label><select value={cls} onChange={e=>setCls(e.target.value)} style={selSt}>{CLASSES.map(c=><option key={c}>{c}</option>)}</select></div>
          <div><Label>Style</Label><select value={style_} onChange={e=>setStyle(e.target.value)} style={selSt}>{["Standard","Concise","Detailed","Revision-Only"].map(s=><option key={s}>{s}</option>)}</select></div>
        </div>
        <Label>Chapter</Label>
        {chapters.length>0?(
          <><select value={chapter} onChange={e=>setChapter(e.target.value)} style={{...selSt,marginBottom:chapter==="__custom__"?8:13}}>
            <option value="">— Select a chapter —</option>
            {chapters.map(c=><option key={c} value={c}>{c}</option>)}
            <option value="__custom__">Other / Custom...</option>
          </select>
          {chapter==="__custom__"&&<input value={customCh} onChange={e=>setCustomCh(e.target.value)} placeholder="Type chapter name..." style={{...inpSt,marginBottom:13}}/>}</>
        ):(
          <input value={customCh} onChange={e=>setCustomCh(e.target.value)} placeholder="Enter chapter name..." style={{...inpSt,marginBottom:13}}/>
        )}
        <button onClick={generate} disabled={loading||!finalChapter.trim()} style={pBtn("#10B981")}>
          {loading?<><RefreshCw size={14} style={{animation:"spin .8s linear infinite"}}/> Generating Notes...</>:<><BookOpen size={14}/> Generate Notes</>}
        </button>
      </Card>
      {notes&&(
        <Card style={{marginTop:18}}>
          <div style={{borderBottom:"2px solid #1E293B",paddingBottom:10,marginBottom:18}}>
            <div style={{fontFamily:"'Sora',sans-serif",fontWeight:900,fontSize:20,color:"#1E293B",lineHeight:1.25}}>{finalChapter}</div>
            <div style={{fontSize:12,color:"#64748B",marginTop:3}}>{subject} · {cls} · CBSE · {style_} Notes</div>
          </div>
          <div style={{fontSize:14,lineHeight:1.7,color:"#1E293B"}} dangerouslySetInnerHTML={{__html:fmtNotes(notes)}}/>
          <div style={{marginTop:22,paddingTop:14,borderTop:"1px solid #F1F5F9",display:"flex",gap:10,flexWrap:"wrap",alignItems:"center"}}>
            <button onClick={()=>printPDF(buildNotesPDF(notes,subject,finalChapter,cls,style_))} style={pBtn("#10B981")}><Download size={14}/> Download PDF</button>
            <button onClick={()=>dlText(notes,`${finalChapter}_notes`)} style={oBtn("#10B981")}><Download size={13}/> Plain Text</button>
            <button onClick={saveToLibrary} disabled={saving} style={oBtn("#6366F1")}>
              {saving?<><RefreshCw size={12} style={{animation:"spin .8s linear infinite"}}/> Saving...</>:<><Save size={12}/> Save to Library</>}
            </button>
            {saveMsg&&<span style={{fontSize:12,fontWeight:600,color:saveMsg.startsWith("✅")?"#10B981":"#EF4444"}}>{saveMsg}</span>}
            <span style={{marginLeft:"auto",background:"#ECFDF5",color:"#10B981",padding:"4px 12px",borderRadius:20,fontSize:12,fontWeight:700}}>+20 XP ⚡</span>
          </div>
          <p style={{fontSize:11.5,color:"#94A3B8",marginTop:8}}>PDF tip: In the print dialog, choose "Save as PDF". Select A4 paper.</p>
        </Card>
      )}
      <XPBadge amount={20} label="XP per notes generated"/>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
//  Question Paper Maker — calls real backend, save + download
// ════════════════════════════════════════════════════════════════
function QPMaker({onXP}){
  const [subject,setSubject]=useState("Mathematics");
  const [cls,setCls]=useState("Class 10");
  const [marks,setMarks]=useState("80");
  const [duration,setDuration]=useState("3 hours");
  const [description,setDesc]=useState("");
  const [loading,setLoading]=useState(false);
  const [paperText,setPaperText]=useState("");
  const [view,setView]=useState("form");
  const [saving,setSaving]=useState(false);
  const [saveMsg,setSaveMsg]=useState("");

  async function generate(){
    setLoading(true);setPaperText("");setSaveMsg("");
    try{
      const descPart=description.trim()?`\n\nTeacher's special instructions: ${description.trim()}`:"";
      const system=`You are a CBSE question paper setter. Create a formal complete question paper in plain text.
FORMAT: SCHOOL NAME: ___ / SUBJECT: ${subject.toUpperCase()} CLASS: ${cls.toUpperCase()} / TIME: ${duration} MAX MARKS: ${marks}
GENERAL INSTRUCTIONS: 1. All questions compulsory. 2. Read carefully. 3. Write neatly.
SECTION A – MCQ [1×?=? marks] / SECTION B – Short Answer I [2×?=? marks] / SECTION C – Short Answer II [3×?=? marks] / SECTION D – Long Answer [5×?=? marks]
RULES: Plain text ONLY. Total = exactly ${marks} marks. CBSE aligned for ${cls} ${subject}.`;
      const {content:p,xpEarned}=await aiApi.paper([{role:"user",content:`Create a complete ${marks}-mark ${subject} question paper for ${cls} CBSE. Duration: ${duration}.${descPart}`}],system,subject);
      setPaperText(p);setView("edit");onXP(xpEarned||25);
    }catch(e){alert("Error: "+e.message);}
    setLoading(false);
  }

  async function savePaper(){
    setSaving(true);setSaveMsg("");
    try{
      await userApi.savePaper({subject,classLevel:cls,marks:parseInt(marks),duration,description,content:paperText});
      setSaveMsg("✅ Saved to your library!");
    }catch(e){setSaveMsg("❌ "+e.message);}
    setSaving(false);
  }

  return(
    <div>
      <PageHeader icon="📄" title="Question Paper Maker" subtitle="Generate, edit, and download as PDF" color="#8B5CF6"/>
      {view==="form"&&(
        <Card>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:11,marginBottom:14}}>
            <div><Label>Subject</Label><select value={subject} onChange={e=>setSubject(e.target.value)} style={selSt}>{SUBJECTS.map(s=><option key={s}>{s}</option>)}</select></div>
            <div><Label>Class</Label><select value={cls} onChange={e=>setCls(e.target.value)} style={selSt}>{CLASSES.map(c=><option key={c}>{c}</option>)}</select></div>
            <div><Label>Total Marks</Label><select value={marks} onChange={e=>setMarks(e.target.value)} style={selSt}>{["20","30","40","50","80","100"].map(m=><option key={m}>{m}</option>)}</select></div>
            <div><Label>Duration</Label><select value={duration} onChange={e=>setDuration(e.target.value)} style={selSt}>{["1 hour","1.5 hours","2 hours","2.5 hours","3 hours"].map(d=><option key={d}>{d}</option>)}</select></div>
          </div>
          <Label>Description / Special Instructions (Optional)</Label>
          <textarea value={description} onChange={e=>setDesc(e.target.value)} rows={4} placeholder={"Describe what you need:\n• Focus on Chapter 3 and 4 only\n• Include 2 case study questions\n• Medium difficulty, for a unit test"} style={{...inpSt,resize:"vertical",marginBottom:15,lineHeight:1.6}}/>
          <button onClick={generate} disabled={loading} style={pBtn("#8B5CF6")}>
            {loading?<><RefreshCw size={14} style={{animation:"spin .8s linear infinite"}}/> Generating Paper...</>:<><FileText size={14}/> Generate Question Paper</>}
          </button>
        </Card>
      )}
      {view==="edit"&&(
        <div>
          <div style={{background:"white",borderRadius:12,padding:"11px 14px",marginBottom:12,border:"1px solid #E2E8F0",display:"flex",gap:9,alignItems:"center",flexWrap:"wrap"}}>
            <button onClick={()=>setView("form")} style={{...oBtn("#8B5CF6"),padding:"6px 13px",fontSize:12}}><ArrowLeft size={12}/> Regenerate</button>
            <span style={{background:"#F5F3FF",padding:"5px 12px",borderRadius:8,fontSize:12.5,color:"#6D28D9",fontWeight:700}}>✏️ Click anywhere to edit</span>
            <div style={{marginLeft:"auto",display:"flex",gap:8,flexWrap:"wrap"}}>
              <button onClick={()=>printPDF(buildQPPDF(paperText,subject,cls,marks,duration))} style={pBtn("#8B5CF6","small")}><Download size={12}/> Download PDF</button>
              <button onClick={()=>dlText(paperText,`${subject}_${cls}_QP`)} style={oBtn("#8B5CF6")}><Download size={12}/> Text</button>
              <button onClick={savePaper} disabled={saving} style={oBtn("#6366F1")}>
                {saving?<><RefreshCw size={12} style={{animation:"spin .8s linear infinite"}}/> Saving...</>:<><Save size={12}/> Save</>}
              </button>
              {saveMsg&&<span style={{fontSize:12,fontWeight:600,color:saveMsg.startsWith("✅")?"#10B981":"#EF4444",alignSelf:"center"}}>{saveMsg}</span>}
            </div>
          </div>
          <div style={{background:"white",borderRadius:14,border:"2px solid #DDD6FE",boxShadow:"0 4px 20px rgba(139,92,246,.1)"}}>
            <div style={{background:"linear-gradient(135deg,#8B5CF6,#A855F7)",padding:"10px 18px",borderRadius:"12px 12px 0 0",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <span style={{color:"white",fontWeight:700,fontSize:13}}>📄 {subject} — {cls} — {marks} Marks</span>
              <span style={{background:"rgba(255,255,255,.2)",color:"white",padding:"3px 11px",borderRadius:20,fontSize:11,fontWeight:700}}>+25 XP ⚡</span>
            </div>
            <textarea value={paperText} onChange={e=>setPaperText(e.target.value)} style={{width:"100%",minHeight:580,fontFamily:"'Courier New',monospace",fontSize:13,lineHeight:1.85,padding:"28px 36px",border:"none",background:"white",resize:"vertical",outline:"none",color:"#1E293B",boxSizing:"border-box"}} spellCheck={true}/>
            <div style={{padding:"9px 18px",background:"#F8F7FF",borderTop:"1px solid #EDE9FE",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <span style={{fontSize:11,color:"#94A3B8"}}>Lines: {paperText.split("\n").length} · Characters: {paperText.length}</span>
              <button onClick={()=>printPDF(buildQPPDF(paperText,subject,cls,marks,duration))} style={pBtn("#8B5CF6","small")}><Download size={12}/> Download as PDF</button>
            </div>
          </div>
          <p style={{fontSize:11.5,color:"#94A3B8",marginTop:8}}>PDF tip: In the print dialog, choose "Save as PDF". Set paper size to A4.</p>
        </div>
      )}
      <XPBadge amount={25} label="XP per paper generated"/>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
//  Quiz Generator — calls real backend, saves history
// ════════════════════════════════════════════════════════════════
function QuizGenerator({onXP}){
  const [subject,setSubject]=useState("Mathematics");
  const [cls,setCls]=useState("Class 10");
  const [topic,setTopic]=useState("");
  const [diff,setDiff]=useState("Medium");
  const [count,setCount]=useState(5);
  const [loading,setLoading]=useState(false);
  const [quiz,setQuiz]=useState(null);
  const [answers,setAnswers]=useState({});
  const [submitted,setSubmitted]=useState(false);
  const [score,setScore]=useState(0);

  async function generate(){
    if(!topic.trim()||loading)return;
    setLoading(true);setQuiz(null);setAnswers({});setSubmitted(false);
    try{
      const {content:raw}=await aiApi.quiz([{role:"user",content:`Generate ${count} ${diff} MCQ questions on "${topic}" for ${cls} ${subject} CBSE. Return ONLY a JSON array: [{"q":"Question","opts":["A","B","C","D"],"ans":0,"exp":"Brief explanation"}]`}],"Return ONLY pure JSON array, no extra text, no code fences.",subject);
      setQuiz(JSON.parse(raw.replace(/```json|```/g,"").trim()));onXP(5);
    }catch(e){alert("Could not parse quiz. Try a clearer topic.");}
    setLoading(false);
  }

  async function submit(){
    let s=0;quiz.forEach((q,i)=>{if(answers[i]===q.ans)s++;});
    setScore(s);setSubmitted(true);
    const xp=s*10;onXP(xp);
    // Save quiz result to backend
    try{await userApi.saveQuizResult({subject,topic,difficulty:diff,totalQuestions:quiz.length,correctAnswers:s,xpEarned:xp});}catch{}
  }

  return(
    <div>
      <PageHeader icon="🎯" title="Smart Quiz Builder" subtitle="Auto-generate MCQ quizzes with instant scoring" color="#F97316"/>
      <Card>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:11,marginBottom:13}}>
          <div><Label>Subject</Label><select value={subject} onChange={e=>setSubject(e.target.value)} style={selSt}>{SUBJECTS.map(s=><option key={s}>{s}</option>)}</select></div>
          <div><Label>Class</Label><select value={cls} onChange={e=>setCls(e.target.value)} style={selSt}>{CLASSES.map(c=><option key={c}>{c}</option>)}</select></div>
          <div><Label>Difficulty</Label><select value={diff} onChange={e=>setDiff(e.target.value)} style={selSt}>{DIFFS.map(d=><option key={d}>{d}</option>)}</select></div>
          <div><Label>Questions: {count}</Label><input type="range" min={3} max={10} value={count} onChange={e=>setCount(+e.target.value)} style={{width:"100%",marginTop:8}}/></div>
        </div>
        <input value={topic} onChange={e=>setTopic(e.target.value)} placeholder='e.g. "Quadratic Equations", "Photosynthesis", "French Revolution"...' style={{...inpSt,marginBottom:13}} onKeyDown={e=>e.key==="Enter"&&generate()}/>
        <button onClick={generate} disabled={loading||!topic.trim()} style={pBtn("#F97316")}>{loading?<><RefreshCw size={14} style={{animation:"spin .8s linear infinite"}}/> Generating...</>:<><Sparkles size={14}/> Generate Quiz</>}</button>
      </Card>
      {quiz&&!submitted&&(
        <div style={{marginTop:18}}>
          {quiz.map((q,i)=>(
            <Card key={i} style={{marginBottom:11}}>
              <p style={{fontWeight:700,color:"#1E293B",marginBottom:11,fontSize:14.5}}><span style={{color:"#F97316"}}>Q{i+1}.</span> {q.q}</p>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:7}}>
                {q.opts.map((opt,j)=>(<button key={j} onClick={()=>setAnswers(a=>({...a,[i]:j}))} style={{padding:"9px 11px",borderRadius:9,border:`2px solid ${answers[i]===j?"#F97316":"#E2E8F0"}`,background:answers[i]===j?"#FFF7ED":"white",color:answers[i]===j?"#F97316":"#475569",fontWeight:600,fontSize:13,cursor:"pointer",textAlign:"left",fontFamily:"'Nunito',sans-serif"}}><span style={{fontWeight:800,marginRight:5}}>{["A","B","C","D"][j]}.</span>{opt}</button>))}
              </div>
            </Card>
          ))}
          <button onClick={submit} disabled={Object.keys(answers).length<quiz.length} style={pBtn("#F97316")}>Submit ({Object.keys(answers).length}/{quiz.length} answered) →</button>
        </div>
      )}
      {submitted&&(
        <div style={{marginTop:18}}>
          <div style={{background:"linear-gradient(135deg,#F97316,#FB923C)",borderRadius:16,padding:24,textAlign:"center",color:"white",marginBottom:16}}>
            <div style={{fontSize:42,marginBottom:5}}>{score===quiz.length?"🏆":score>=quiz.length*.7?"🎉":"📚"}</div>
            <div style={{fontFamily:"'Sora',sans-serif",fontSize:28,fontWeight:900}}>{score}/{quiz.length}</div>
            <div style={{opacity:.9,marginBottom:7}}>{score===quiz.length?"Perfect!":score>=quiz.length*.7?"Great job!":"Keep practicing!"}</div>
            <div style={{background:"rgba(255,255,255,.2)",padding:"5px 16px",borderRadius:20,display:"inline-block",fontWeight:700}}>+{score*10} XP ⚡</div>
          </div>
          {quiz.map((q,i)=>(
            <Card key={i} style={{marginBottom:10,borderLeft:`4px solid ${answers[i]===q.ans?"#10B981":"#EF4444"}`}}>
              <p style={{fontWeight:700,color:"#1E293B",marginBottom:9,fontSize:14}}><span style={{color:"#94A3B8"}}>Q{i+1}.</span> {q.q}</p>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:7,marginBottom:9}}>
                {q.opts.map((opt,j)=>(<div key={j} style={{padding:"7px 11px",borderRadius:8,fontSize:12.5,fontWeight:600,background:j===q.ans?"#ECFDF5":j===answers[i]&&answers[i]!==q.ans?"#FEF2F2":"#F8FAFC",color:j===q.ans?"#10B981":j===answers[i]&&answers[i]!==q.ans?"#EF4444":"#64748B",border:`2px solid ${j===q.ans?"#10B981":j===answers[i]&&answers[i]!==q.ans?"#EF4444":"#E2E8F0"}`,display:"flex",alignItems:"center",gap:5}}>{j===q.ans?<Check size={12}/>:j===answers[i]&&answers[i]!==q.ans?<X size={12}/>:null}<span style={{fontWeight:800,marginRight:3}}>{["A","B","C","D"][j]}.</span>{opt}</div>))}
              </div>
              <div style={{background:"#F0FDF4",padding:"8px 12px",borderRadius:8,fontSize:13,color:"#166534"}}>💡 {q.exp}</div>
            </Card>
          ))}
          <button onClick={()=>{setQuiz(null);setSubmitted(false);setAnswers({});setTopic("");}} style={oBtn("#F97316")}><RefreshCw size={13}/> New Quiz</button>
        </div>
      )}
      <XPBadge amount="5–100" label="XP per quiz"/>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
//  Flashcards — calls real backend
// ════════════════════════════════════════════════════════════════
function FlashCards({onXP}){
  const [subject,setSubject]=useState("Biology");
  const [cls,setCls]=useState("Class 10");
  const [topic,setTopic]=useState("");
  const [count,setCount]=useState(6);
  const [cards,setCards]=useState([]);
  const [loading,setLoading]=useState(false);
  const [flipped,setFlipped]=useState({});
  const [current,setCurrent]=useState(0);
  const [mode,setMode]=useState("grid");

  async function generate(){
    if(!topic.trim()||loading)return;
    setLoading(true);setCards([]);setFlipped({});setCurrent(0);
    try{
      const {content:raw}=await aiApi.flashcards([{role:"user",content:`Generate ${count} flashcards for "${topic}" in ${cls} ${subject} CBSE. Return ONLY JSON: [{"front":"Term or Question","back":"Definition or Answer"}]`}],"Return ONLY pure JSON array, no extra text, no code fences.",subject,topic);
      setCards(JSON.parse(raw.replace(/```json|```/g,"").trim()));onXP(15);
    }catch(e){alert("Error generating flashcards.");}
    setLoading(false);
  }

  return(
    <div>
      <PageHeader icon="🃏" title="Smart Flashcards" subtitle="Grid mode & Study mode for fast revision" color="#EF4444"/>
      <Card>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:11,marginBottom:13}}>
          <div><Label>Subject</Label><select value={subject} onChange={e=>setSubject(e.target.value)} style={selSt}>{SUBJECTS.map(s=><option key={s}>{s}</option>)}</select></div>
          <div><Label>Class</Label><select value={cls} onChange={e=>setCls(e.target.value)} style={selSt}>{CLASSES.map(c=><option key={c}>{c}</option>)}</select></div>
          <div><Label>Cards: {count}</Label><input type="range" min={4} max={12} value={count} onChange={e=>setCount(+e.target.value)} style={{width:"100%",marginTop:8}}/></div>
        </div>
        <input value={topic} onChange={e=>setTopic(e.target.value)} placeholder='e.g. "Cell Biology", "Mughal Empire", "Trigonometry"...' style={{...inpSt,marginBottom:13}} onKeyDown={e=>e.key==="Enter"&&generate()}/>
        <button onClick={generate} disabled={loading||!topic.trim()} style={pBtn("#EF4444")}>{loading?<><RefreshCw size={14} style={{animation:"spin .8s linear infinite"}}/> Generating...</>:<><Layers size={14}/> Generate Flashcards</>}</button>
      </Card>
      {cards.length>0&&(
        <div style={{marginTop:18}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:13}}>
            <h3 style={{fontFamily:"'Sora',sans-serif",fontWeight:800,fontSize:15.5,color:"#1E293B"}}>{topic} — {cards.length} Cards</h3>
            <div style={{display:"flex",gap:7}}>
              {["grid","study"].map(m=>(<button key={m} onClick={()=>setMode(m)} style={{padding:"6px 13px",borderRadius:7,border:"none",fontWeight:700,fontSize:12,cursor:"pointer",background:mode===m?"#EF4444":"#F1F5F9",color:mode===m?"white":"#64748B",fontFamily:"'Nunito',sans-serif"}}>{m==="grid"?"⊞ Grid":"▶ Study"}</button>))}
            </div>
          </div>
          {mode==="grid"?(
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))",gap:13}}>
              {cards.map((c,i)=>(
                <div key={i} onClick={()=>setFlipped(f=>({...f,[i]:!f[i]}))} style={{height:125,borderRadius:13,cursor:"pointer",perspective:1000}}>
                  <div style={{width:"100%",height:"100%",position:"relative",transformStyle:"preserve-3d",transition:"transform .5s",transform:flipped[i]?"rotateY(180deg)":"rotateY(0)"}}>
                    <div style={{position:"absolute",inset:0,backfaceVisibility:"hidden",background:"linear-gradient(135deg,#EF4444,#F97316)",borderRadius:13,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:13,textAlign:"center"}}><span style={{fontSize:9.5,color:"rgba(255,255,255,.7)",fontWeight:700,marginBottom:5,letterSpacing:1}}>TAP TO REVEAL</span><span style={{color:"white",fontWeight:800,fontSize:13.5,lineHeight:1.4}}>{c.front}</span></div>
                    <div style={{position:"absolute",inset:0,backfaceVisibility:"hidden",transform:"rotateY(180deg)",background:"white",borderRadius:13,border:"2px solid #EF4444",display:"flex",alignItems:"center",justifyContent:"center",padding:13,textAlign:"center"}}><span style={{color:"#1E293B",fontWeight:700,fontSize:13,lineHeight:1.5}}>{c.back}</span></div>
                  </div>
                </div>
              ))}
            </div>
          ):(
            <Card style={{textAlign:"center"}}>
              <div style={{fontSize:12,color:"#94A3B8",marginBottom:6,fontWeight:600}}>Card {current+1} of {cards.length}</div>
              <div onClick={()=>setFlipped(f=>({...f,[current]:!f[current]}))} style={{height:170,background:flipped[current]?"white":"linear-gradient(135deg,#EF4444,#F97316)",borderRadius:13,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",cursor:"pointer",border:flipped[current]?"2px solid #EF4444":"none",marginBottom:16,padding:22}}>
                <span style={{fontSize:10.5,color:flipped[current]?"#94A3B8":"rgba(255,255,255,.7)",fontWeight:700,letterSpacing:1,marginBottom:9}}>{flipped[current]?"ANSWER":"QUESTION — TAP TO FLIP"}</span>
                <span style={{color:flipped[current]?"#1E293B":"white",fontWeight:800,fontSize:16.5,lineHeight:1.5}}>{flipped[current]?cards[current].back:cards[current].front}</span>
              </div>
              <div style={{display:"flex",gap:11,justifyContent:"center"}}>
                <button onClick={()=>{setCurrent(c=>Math.max(0,c-1));setFlipped({});}} disabled={current===0} style={{padding:"8px 20px",borderRadius:9,border:"1px solid #E2E8F0",background:"white",color:"#475569",fontWeight:700,cursor:"pointer",opacity:current===0?.4:1,fontFamily:"'Nunito',sans-serif"}}>← Prev</button>
                <button onClick={()=>setFlipped(f=>({...f,[current]:!f[current]}))} style={pBtn("#EF4444","small")}><RotateCcw size={13}/> Flip</button>
                <button onClick={()=>{setCurrent(c=>Math.min(cards.length-1,c+1));setFlipped({});}} disabled={current===cards.length-1} style={{padding:"8px 20px",borderRadius:9,border:"1px solid #E2E8F0",background:"white",color:"#475569",fontWeight:700,cursor:"pointer",opacity:current===cards.length-1?.4:1,fontFamily:"'Nunito',sans-serif"}}>Next →</button>
              </div>
            </Card>
          )}
          <button onClick={()=>setCards([])} style={{marginTop:13,...oBtn("#EF4444")}}><RefreshCw size={12}/> New Flashcards</button>
        </div>
      )}
      <XPBadge amount={15} label="XP per set"/>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
//  Dashboard — real stats from backend
// ════════════════════════════════════════════════════════════════
function Dashboard({user,onGoProfile,onGoSettings}){
  const [stats,setStats]=useState(null);
  const [recentActivity,setRecentActivity]=useState([]);
  const [loading,setLoading]=useState(true);

  useEffect(()=>{
    userApi.getStats().then(data=>{
      setStats(data.stats||{});
      setRecentActivity(data.recentActivity||[]);
    }).catch(()=>{}).finally(()=>setLoading(false));
  },[]);

  const xp=stats?.total_xp||0;
  const streak=stats?.current_streak||0;
  const level=getLevel(xp);
  const nextLvl=getNextLevel(level.idx);
  const progress=xp>=nextLvl.min?100:Math.round(((xp-level.min)/(nextLvl.min-level.min))*100);

  const ach=[
    {e:"🔥",t:"Hot Streak",    d:"3+ day streak",            ok:streak>=3},
    {e:"🧠",t:"Curious Mind",  d:"Ask your first doubt",     ok:(stats?.doubts_solved||0)>0},
    {e:"🎯",t:"Quiz Taker",    d:"Complete your first quiz", ok:(stats?.quizzes_done||0)>0},
    {e:"📖",t:"Note Maker",    d:"Generate study notes",     ok:(stats?.notes_made||0)>0},
    {e:"📄",t:"Paper Setter",  d:"Create a question paper",  ok:(stats?.papers_made||0)>0},
    {e:"⭐",t:"100 XP Club",   d:"Earn 100 XP",              ok:xp>=100},
    {e:"🏆",t:"Scholar",       d:"Reach Scholar level",      ok:xp>=100},
    {e:"👑",t:"Genius",        d:"Reach Genius level",       ok:xp>=300},
  ];

  const toolLabel={doubt:"Doubt Solver",quiz:"Quiz",notes:"Notes",paper:"Question Paper",flashcards:"Flashcards"};
  const toolColor={doubt:"#6366F1",quiz:"#F97316",notes:"#10B981",paper:"#8B5CF6",flashcards:"#EF4444"};

  return(
    <div>
      <PageHeader icon="📊" title="My Dashboard" subtitle="Your real-time progress, XP, and achievements" color="#6366F1"/>

      {/* User card with quick links */}
      {user&&(
        <div style={{background:"white",borderRadius:13,padding:"14px 18px",marginBottom:14,border:"1px solid #E2E8F0",display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"}}>
          <div style={{width:44,height:44,borderRadius:12,background:"linear-gradient(135deg,#6366F1,#8B5CF6)",display:"flex",alignItems:"center",justifyContent:"center",color:"white",fontWeight:900,fontSize:18,flexShrink:0}}>
            {user.avatar_url?<img src={user.avatar_url} alt="" style={{width:"100%",height:"100%",borderRadius:12,objectFit:"cover"}}/>:(user.name||"U").charAt(0).toUpperCase()}
          </div>
          <div style={{flex:1}}>
            <div style={{fontFamily:"'Sora',sans-serif",fontWeight:800,fontSize:16,color:"#1E293B"}}>{user.name}</div>
            <div style={{fontSize:12.5,color:"#64748B"}}>{user.type==="school"?`🏫 ${user.schoolName||""} · ${user.role}`:`📧 ${user.email}`}</div>
          </div>
          <div style={{display:"flex",gap:8,flexShrink:0}}>
            <button onClick={onGoProfile} style={{...oBtn("#6366F1"),padding:"6px 12px",fontSize:12}}><User size={12}/> Profile</button>
            <button onClick={onGoSettings} style={{...oBtn("#64748B"),padding:"6px 12px",fontSize:12}}><Settings size={12}/> Settings</button>
          </div>
        </div>
      )}

      {loading?(
        <div style={{textAlign:"center",padding:40,color:"#94A3B8",fontSize:14}}>Loading your stats...</div>
      ):(
        <>
          {/* Level banner */}
          <div style={{background:"linear-gradient(135deg,#6366F1,#8B5CF6,#A855F7)",borderRadius:18,padding:24,color:"white",marginBottom:16}}>
            <div style={{display:"flex",justifyContent:"space-between"}}>
              <div><div style={{fontSize:36,marginBottom:5}}>{level.emoji}</div><div style={{fontFamily:"'Sora',sans-serif",fontSize:24,fontWeight:900}}>{level.name}</div><div style={{opacity:.8,fontSize:13}}>Level {LEVELS.findIndex(l=>l.name===level.name)+1} of 5</div></div>
              <div style={{textAlign:"right"}}><div style={{fontFamily:"'Sora',sans-serif",fontSize:36,fontWeight:900}}>{xp}</div><div style={{opacity:.8,fontSize:13}}>Total XP</div></div>
            </div>
            <div style={{marginTop:16}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:5,fontSize:12,opacity:.8}}><span>To {nextLvl.name} {nextLvl.emoji}</span><span>{xp}/{nextLvl.min} XP</span></div>
              <div style={{height:8,background:"rgba(255,255,255,.25)",borderRadius:4,overflow:"hidden"}}><div style={{width:`${progress}%`,height:"100%",background:"white",borderRadius:4,transition:"width .8s ease"}}/></div>
            </div>
          </div>

          {/* Stats grid */}
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(120px,1fr))",gap:11,marginBottom:18}}>
            {[["⚡",xp,"Total XP","#EEF2FF","#6366F1"],["🔥",streak,"Day Streak","#FFF7ED","#F97316"],["🤖",stats?.doubts_solved||0,"Doubts Solved","#ECFDF5","#10B981"],["🎯",stats?.quizzes_done||0,"Quizzes Done","#F5F3FF","#8B5CF6"],["📖",stats?.notes_made||0,"Notes Made","#FEF2F2","#EF4444"],["📄",stats?.papers_made||0,"Papers Made","#FFFBEB","#F59E0B"]].map(([ic,v,l,bg,c])=>(
              <div key={l} style={{background:bg,borderRadius:13,padding:"13px 10px",textAlign:"center"}}>
                <div style={{fontSize:22}}>{ic}</div>
                <div style={{fontFamily:"'Sora',sans-serif",fontSize:20,fontWeight:900,color:c,marginTop:2}}>{v}</div>
                <div style={{color:"#64748B",fontSize:10.5,fontWeight:600}}>{l}</div>
              </div>
            ))}
          </div>

          {/* Recent Activity */}
          {recentActivity.length>0&&(
            <Card style={{marginBottom:14}}>
              <h3 style={{fontFamily:"'Sora',sans-serif",fontWeight:800,fontSize:15,color:"#1E293B",marginBottom:13}}>📈 Recent Activity</h3>
              <div style={{display:"flex",flexDirection:"column",gap:7}}>
                {recentActivity.slice(0,8).map((a,i)=>(
                  <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 11px",background:"#F8FAFC",borderRadius:9}}>
                    <div style={{display:"flex",alignItems:"center",gap:8}}>
                      <div style={{width:8,height:8,borderRadius:"50%",background:toolColor[a.tool]||"#94A3B8",flexShrink:0}}/>
                      <span style={{fontWeight:600,color:"#475569",fontSize:13}}>{toolLabel[a.tool]||a.tool}{a.subject?` · ${a.subject}`:""}</span>
                    </div>
                    <div style={{display:"flex",alignItems:"center",gap:8}}>
                      <span style={{fontWeight:700,color:"#6366F1",fontSize:12}}>+{a.xp_earned} XP</span>
                      <span style={{color:"#94A3B8",fontSize:11}}>{new Date(a.created_at).toLocaleDateString("en-IN",{day:"numeric",month:"short"})}</span>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Achievements */}
          <Card style={{marginBottom:14}}>
            <h3 style={{fontFamily:"'Sora',sans-serif",fontWeight:800,fontSize:15,color:"#1E293B",marginBottom:13}}>🏅 Achievements</h3>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(185px,1fr))",gap:9}}>
              {ach.map(a=>(<div key={a.t} style={{padding:11,borderRadius:11,background:a.ok?"#ECFDF5":"#F8FAFC",border:`1px solid ${a.ok?"#A7F3D0":"#E2E8F0"}`,opacity:a.ok?1:.6}}><div style={{fontSize:21,marginBottom:4}}>{a.e}</div><div style={{fontWeight:800,fontSize:12.5,color:a.ok?"#166534":"#1E293B"}}>{a.t}</div><div style={{fontSize:11,color:"#64748B",marginTop:2}}>{a.d}</div>{a.ok&&<div style={{marginTop:4,fontSize:10.5,fontWeight:700,color:"#10B981"}}>✅ Unlocked</div>}</div>))}
            </div>
          </Card>

          <Card>
            <h3 style={{fontFamily:"'Sora',sans-serif",fontWeight:800,fontSize:15,color:"#1E293B",marginBottom:11}}>⚡ How to Earn XP</h3>
            {[["🤖 Solve a Doubt","+15 XP"],["🎯 Complete a Quiz","+10–100 XP"],["📖 Generate Notes","+20 XP"],["📄 Create Question Paper","+25 XP"],["🃏 Make Flashcards","+15 XP"]].map(([a,b])=>(
              <div key={a} style={{display:"flex",justifyContent:"space-between",padding:"8px 11px",background:"#F8FAFC",borderRadius:8,marginBottom:5}}>
                <span style={{fontWeight:600,color:"#475569",fontSize:13}}>{a}</span>
                <span style={{fontWeight:800,color:"#6366F1",background:"#EEF2FF",padding:"2px 10px",borderRadius:20,fontSize:12}}>{b}</span>
              </div>
            ))}
          </Card>
        </>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
//  Landing Page (unchanged)
// ════════════════════════════════════════════════════════════════
function LandingPage({onStart}){
  const features=[{icon:"🤖",color:"#6366F1",bg:"#EEF2FF",title:"AI Doubt Solver",desc:"Short, crisp, step-by-step answers to any CBSE question instantly."},{icon:"🎯",color:"#F97316",bg:"#FFF7ED",title:"Smart Quiz Builder",desc:"Auto-generate MCQ quizzes on any topic with scoring and explanations."},{icon:"📖",color:"#10B981",bg:"#ECFDF5",title:"Smart Notes + PDF",desc:"Textbook-style chapter notes — clean, concise, downloadable as PDF."},{icon:"📄",color:"#8B5CF6",bg:"#F5F3FF",title:"Question Paper + PDF",desc:"Generate, edit line-by-line, and download as a print-ready PDF."},{icon:"🃏",color:"#EF4444",bg:"#FEF2F2",title:"Smart Flashcards",desc:"AI flip cards in grid or study mode for quick revision."},{icon:"🏆",color:"#F59E0B",bg:"#FFFBEB",title:"XP & Gamification",desc:"Earn XP, level up from Novice to Legend, unlock achievements."}];
  return(
    <div style={{minHeight:"100vh",background:"white",fontFamily:"'Nunito',sans-serif"}}>
      <nav style={{padding:"14px 5%",display:"flex",justifyContent:"space-between",alignItems:"center",position:"sticky",top:0,background:"rgba(255,255,255,.93)",backdropFilter:"blur(12px)",borderBottom:"1px solid #F1F5F9",zIndex:100}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}><div style={{width:38,height:38,borderRadius:11,background:"linear-gradient(135deg,#6366F1,#8B5CF6)",display:"flex",alignItems:"center",justifyContent:"center"}}><Brain size={21} color="white"/></div><span style={{fontFamily:"'Sora',sans-serif",fontWeight:900,fontSize:19,color:"#1E293B"}}>BrainSpark<span style={{color:"#6366F1"}}> AI</span></span></div>
        <div style={{display:"flex",gap:12,alignItems:"center"}}><a href="#features" style={{color:"#475569",fontWeight:600,textDecoration:"none",fontSize:14}}>Features</a><button onClick={onStart} style={{background:"white",color:"#6366F1",padding:"8px 18px",borderRadius:9,border:"2px solid #6366F1",fontWeight:700,fontSize:14,cursor:"pointer",fontFamily:"'Nunito',sans-serif"}}>Sign In</button><button onClick={onStart} style={{background:"linear-gradient(135deg,#6366F1,#8B5CF6)",color:"white",padding:"9px 20px",borderRadius:11,border:"none",fontWeight:700,fontSize:14,cursor:"pointer",fontFamily:"'Nunito',sans-serif"}}>Start for Free →</button></div>
      </nav>
      <section style={{padding:"72px 5% 52px",textAlign:"center",background:"linear-gradient(180deg,#FAFBFF,white)",position:"relative",overflow:"hidden"}}>
        <div style={{position:"absolute",top:-60,left:"50%",transform:"translateX(-50%)",width:600,height:600,borderRadius:"50%",background:"radial-gradient(circle,rgba(99,102,241,.07) 0%,transparent 70%)",pointerEvents:"none"}}/>
        <div style={{display:"inline-flex",alignItems:"center",gap:7,background:"#EEF2FF",padding:"7px 16px",borderRadius:20,marginBottom:22,border:"1px solid #C7D2FE"}}><Sparkles size={13} color="#6366F1"/><span style={{color:"#6366F1",fontWeight:700,fontSize:12.5}}>India's Smartest CBSE Study Companion</span></div>
        <h1 style={{fontFamily:"'Sora',sans-serif",fontSize:"clamp(1.9rem,5vw,3.2rem)",fontWeight:900,color:"#1E293B",lineHeight:1.15,maxWidth:780,margin:"0 auto 18px"}}>Your AI Study Partner That{" "}<span style={{background:"linear-gradient(135deg,#6366F1,#8B5CF6,#EC4899)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>Never Gets Tired</span></h1>
        <p style={{color:"#64748B",fontSize:"clamp(.95rem,2vw,1.1rem)",maxWidth:560,margin:"0 auto 32px",lineHeight:1.75}}>Instant answers, textbook-quality notes as PDF, auto quizzes, editable question papers — for Class 6–12 CBSE.</p>
        <div style={{display:"flex",gap:12,justifyContent:"center",flexWrap:"wrap"}}>
          <button onClick={onStart} style={{background:"linear-gradient(135deg,#6366F1,#8B5CF6)",color:"white",padding:"13px 30px",borderRadius:13,border:"none",fontWeight:800,fontSize:16,cursor:"pointer",display:"flex",alignItems:"center",gap:7,boxShadow:"0 8px 28px rgba(99,102,241,.35)",fontFamily:"'Nunito',sans-serif"}}><Zap size={18}/> Start Learning Free</button>
          <button onClick={onStart} style={{background:"white",color:"#6366F1",padding:"13px 28px",borderRadius:13,border:"2px solid #6366F1",fontWeight:800,fontSize:16,cursor:"pointer",fontFamily:"'Nunito',sans-serif"}}>Sign In →</button>
        </div>
      </section>
      <section style={{background:"linear-gradient(135deg,#6366F1,#8B5CF6)",padding:"30px 5%"}}>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))",gap:18,maxWidth:860,margin:"0 auto",textAlign:"center"}}>
          {[["50K+","Students Helped"],["2M+","Doubts Solved"],["100+","Topics Covered"],["24/7","Available"]].map(([v,l])=>(<div key={l}><div style={{fontSize:"clamp(1.5rem,3vw,2rem)",fontWeight:900,color:"white",fontFamily:"'Sora',sans-serif"}}>{v}</div><div style={{color:"rgba(255,255,255,.8)",fontSize:13,fontWeight:600}}>{l}</div></div>))}
        </div>
      </section>
      <section id="features" style={{padding:"64px 5%",background:"white"}}>
        <div style={{textAlign:"center",marginBottom:40}}><h2 style={{fontFamily:"'Sora',sans-serif",fontSize:"clamp(1.4rem,3vw,2rem)",fontWeight:900,color:"#1E293B",marginBottom:9}}>Everything to <span style={{color:"#6366F1"}}>Ace Your Exams</span></h2><p style={{color:"#64748B",fontSize:14,maxWidth:500,margin:"0 auto"}}>Six AI tools — all in one platform.</p></div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(260px,1fr))",gap:16,maxWidth:1020,margin:"0 auto"}}>
          {features.map(f=>(<div key={f.title} onClick={onStart} style={{background:"white",borderRadius:16,padding:24,border:"1px solid #F1F5F9",cursor:"pointer",transition:"all .2s",boxShadow:"0 2px 8px rgba(0,0,0,.04)"}} onMouseEnter={e=>{e.currentTarget.style.transform="translateY(-4px)";e.currentTarget.style.boxShadow=`0 14px 32px ${f.color}1a`;e.currentTarget.style.borderColor=f.color+"44";}} onMouseLeave={e=>{e.currentTarget.style.transform="";e.currentTarget.style.boxShadow="0 2px 8px rgba(0,0,0,.04)";e.currentTarget.style.borderColor="#F1F5F9";}}><div style={{width:48,height:48,borderRadius:13,background:f.bg,display:"flex",alignItems:"center",justifyContent:"center",fontSize:23,marginBottom:13}}>{f.icon}</div><h3 style={{fontFamily:"'Sora',sans-serif",fontWeight:800,fontSize:15.5,color:"#1E293B",marginBottom:6}}>{f.title}</h3><p style={{color:"#64748B",fontSize:13,lineHeight:1.6,margin:0}}>{f.desc}</p></div>))}
        </div>
      </section>
      <section style={{padding:"56px 5%",background:"linear-gradient(135deg,#6366F1,#8B5CF6)",textAlign:"center"}}>
        <h2 style={{fontFamily:"'Sora',sans-serif",fontSize:"clamp(1.4rem,3vw,2rem)",fontWeight:900,color:"white",marginBottom:10}}>Ready to Study Smarter?</h2>
        <p style={{color:"rgba(255,255,255,.85)",fontSize:15,marginBottom:24}}>Join thousands of students already using BrainSpark AI</p>
        <button onClick={onStart} style={{background:"white",color:"#6366F1",padding:"12px 30px",borderRadius:12,border:"none",fontWeight:800,fontSize:15,cursor:"pointer",fontFamily:"'Nunito',sans-serif"}}>🚀 Start for Free</button>
      </section>
      <footer style={{padding:"20px 5%",background:"#0F172A",textAlign:"center"}}>
        <div style={{display:"flex",alignItems:"center",gap:7,justifyContent:"center",marginBottom:7}}><Brain size={16} color="#6366F1"/><span style={{color:"white",fontWeight:800}}>BrainSpark AI</span></div>
        <p style={{color:"#64748B",fontSize:12}}>© 2025 BrainSpark AI. Empowering every student to excel.</p>
      </footer>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
//  Main App — full auth flow with token persistence
// ════════════════════════════════════════════════════════════════
export default function BrainSparkAI(){
  const [screen,setScreen]=useState("landing");  // landing | auth | app | profile | settings
  const [user,setUser]=useState(null);
  const [tab,setTab]=useState("doubt");
  const [xp,setXp]=useState(0);                  // local XP counter (real XP is in DB)
  const [authChecked,setAuthChecked]=useState(false);

  useEffect(()=>{
    // Inject fonts + global styles
    const link=document.createElement("link");
    link.href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700;800;900&family=Sora:wght@600;700;800;900&display=swap";
    link.rel="stylesheet";document.head.appendChild(link);
    const style=document.createElement("style");
    style.textContent=`*{box-sizing:border-box;margin:0;padding:0}body{margin:0;font-family:'Nunito',sans-serif}@keyframes spin{to{transform:rotate(360deg)}}@keyframes dotBounce{0%,100%{opacity:.25;transform:scale(.8)}50%{opacity:1;transform:scale(1)}}@keyframes slideUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}`;
    document.head.appendChild(style);

    // Check if user is already logged in (token in localStorage)
    const cached=getCachedUser();
    if(cached&&getToken()){
      setUser(cached);setScreen("app");
      // Silently verify token is still valid
      auth.verifyToken().then(u=>{if(u)setUser(u);else{setScreen("landing");setUser(null);}}).catch(()=>{});
    }
    setAuthChecked(true);
  },[]);

  function handleAuth(u){setUser(u);setCachedUser(u);setScreen("app");}
  function handleLogout(){auth.logout();setUser(null);setScreen("landing");setXp(0);}
  function handleUpdateUser(u){setUser(u);setCachedUser(u);}

  if(!authChecked)return null; // Avoid flash before auth check

  const tabs=[
    {id:"doubt",label:"Doubt Solver",  short:"Doubts",Icon:MessageSquare,col:"#6366F1"},
    {id:"quiz", label:"Quiz Builder",  short:"Quiz",  Icon:Target,       col:"#F97316"},
    {id:"notes",label:"Notes + PDF",   short:"Notes", Icon:BookOpen,     col:"#10B981"},
    {id:"paper",label:"Question Paper",short:"Paper", Icon:FileText,     col:"#8B5CF6"},
    {id:"flash",label:"Flashcards",    short:"Cards", Icon:Layers,       col:"#EF4444"},
    {id:"dash", label:"Dashboard",     short:"Stats", Icon:BarChart3,    col:"#F59E0B"},
  ];

  if(screen==="landing") return <LandingPage onStart={()=>setScreen("auth")}/>;
  if(screen==="auth")    return <AuthPage onAuth={handleAuth} onBack={()=>setScreen("landing")}/>;

  return(
    <div style={{minHeight:"100vh",background:"#F8FAFC",fontFamily:"'Nunito',sans-serif"}}>
      <header style={{background:"white",borderBottom:"1px solid #E2E8F0",padding:"10px 18px",display:"flex",alignItems:"center",justifyContent:"space-between",position:"sticky",top:0,zIndex:200,boxShadow:"0 2px 8px rgba(0,0,0,.05)"}}>
        <div style={{display:"flex",alignItems:"center",gap:9,cursor:"pointer"}} onClick={()=>setScreen("landing")}>
          <div style={{width:33,height:33,borderRadius:9,background:"linear-gradient(135deg,#6366F1,#8B5CF6)",display:"flex",alignItems:"center",justifyContent:"center"}}><Brain size={18} color="white"/></div>
          <span style={{fontFamily:"'Sora',sans-serif",fontWeight:900,fontSize:16.5,color:"#1E293B"}}>BrainSpark<span style={{color:"#6366F1"}}> AI</span></span>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:7,flexWrap:"wrap"}}>
          {user?.type==="school"&&<div style={{background:"#F5F3FF",padding:"4px 10px",borderRadius:20,border:"1px solid #DDD6FE",fontSize:12,fontWeight:700,color:"#7C3AED"}}>🏫 {user.schoolCode||user.school_code}</div>}
          <div style={{background:"#FFF7ED",padding:"4px 10px",borderRadius:20,border:"1px solid #FDBA74",display:"flex",alignItems:"center",gap:3}}><Flame size={13} color="#F97316"/></div>
          <div style={{background:"#EEF2FF",padding:"4px 10px",borderRadius:20}}><span style={{fontWeight:800,fontSize:12,color:"#6366F1"}}>⚡{xp}XP</span></div>
          {user&&(
            <button onClick={()=>setScreen("profile")} style={{display:"flex",alignItems:"center",gap:5,background:"#F8FAFC",padding:"4px 10px",borderRadius:20,border:"1px solid #E2E8F0",cursor:"pointer"}}>
              <div style={{width:22,height:22,borderRadius:6,background:"linear-gradient(135deg,#6366F1,#8B5CF6)",display:"flex",alignItems:"center",justifyContent:"center",color:"white",fontSize:10,fontWeight:900}}>{(user.name||"U").charAt(0).toUpperCase()}</div>
              <span style={{fontSize:12,fontWeight:700,color:"#475569",maxWidth:75,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{user.name}</span>
            </button>
          )}
          <button onClick={()=>setScreen("settings")} style={{background:"none",border:"1px solid #E2E8F0",padding:"4px 9px",borderRadius:8,cursor:"pointer",color:"#94A3B8",fontSize:12,fontWeight:600,fontFamily:"'Nunito',sans-serif",display:"flex",alignItems:"center",gap:3}}><Settings size={11}/></button>
          <button onClick={handleLogout} style={{background:"none",border:"1px solid #E2E8F0",padding:"4px 9px",borderRadius:8,cursor:"pointer",color:"#94A3B8",fontSize:12,fontWeight:600,fontFamily:"'Nunito',sans-serif",display:"flex",alignItems:"center",gap:3}}><LogOut size={11}/></button>
        </div>
      </header>

      <div style={{display:"flex"}}>
        <aside style={{width:200,background:"white",borderRight:"1px solid #E2E8F0",padding:"16px 9px",position:"sticky",top:55,height:"calc(100vh - 55px)",overflowY:"auto",flexShrink:0,display:"flex",flexDirection:"column",gap:3}}>
          {tabs.map(t=>(
            <button key={t.id} onClick={()=>{setTab(t.id);setScreen("app");}} style={{display:"flex",alignItems:"center",gap:8,padding:"9px 12px",borderRadius:10,border:"none",cursor:"pointer",fontWeight:700,fontSize:13,textAlign:"left",transition:"all .15s",background:screen==="app"&&tab===t.id?`linear-gradient(135deg,${t.col},${t.col}bb)`:"transparent",color:screen==="app"&&tab===t.id?"white":"#475569",fontFamily:"'Nunito',sans-serif"}}>
              <t.Icon size={15}/>{t.label}
            </button>
          ))}
          <div style={{height:1,background:"#F1F5F9",margin:"8px 0"}}/>
          <button onClick={()=>setScreen("profile")} style={{display:"flex",alignItems:"center",gap:8,padding:"9px 12px",borderRadius:10,border:"none",cursor:"pointer",fontWeight:700,fontSize:13,textAlign:"left",background:screen==="profile"?"#EEF2FF":"transparent",color:screen==="profile"?"#6366F1":"#475569",fontFamily:"'Nunito',sans-serif"}}><User size={15}/>My Profile</button>
          <button onClick={()=>setScreen("settings")} style={{display:"flex",alignItems:"center",gap:8,padding:"9px 12px",borderRadius:10,border:"none",cursor:"pointer",fontWeight:700,fontSize:13,textAlign:"left",background:screen==="settings"?"#EEF2FF":"transparent",color:screen==="settings"?"#6366F1":"#475569",fontFamily:"'Nunito',sans-serif"}}><Settings size={15}/>Settings</button>
        </aside>

        <main style={{flex:1, padding:"22px 32px", paddingBottom:88, minWidth:0}}>
          <div style={{animation:"slideUp .25s ease-out"}}>
            {screen==="app"&&tab==="doubt" && <DoubtSolver onXP={v=>setXp(p=>p+v)}/>}
            {screen==="app"&&tab==="quiz"  && <QuizGenerator onXP={v=>setXp(p=>p+v)}/>}
            {screen==="app"&&tab==="notes" && <NotesMaker onXP={v=>setXp(p=>p+v)}/>}
            {screen==="app"&&tab==="paper" && <QPMaker onXP={v=>setXp(p=>p+v)}/>}
            {screen==="app"&&tab==="flash" && <FlashCards onXP={v=>setXp(p=>p+v)}/>}
            {screen==="app"&&tab==="dash"  && <Dashboard user={user} onGoProfile={()=>setScreen("profile")} onGoSettings={()=>setScreen("settings")}/>}
            {screen==="profile" && <ProfilePage user={user} onUpdate={handleUpdateUser} onBack={()=>setScreen("app")}/>}
            {screen==="settings" && <SettingsPage user={user} onBack={()=>setScreen("app")} onLogout={handleLogout}/>}
          </div>
        </main>
      </div>

      {/* Mobile bottom nav */}
      <nav style={{position:"fixed",bottom:0,left:0,right:0,background:"white",borderTop:"1px solid #E2E8F0",display:"flex",padding:"4px 2px 9px",zIndex:200,boxShadow:"0 -3px 14px rgba(0,0,0,.07)"}}>
        {tabs.map(t=>(
          <button key={t.id} onClick={()=>{setTab(t.id);setScreen("app");}} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:1,padding:"3px 1px",border:"none",background:"none",cursor:"pointer",fontFamily:"'Nunito',sans-serif"}}>
            <div style={{width:28,height:28,borderRadius:7,display:"flex",alignItems:"center",justifyContent:"center",background:screen==="app"&&tab===t.id?`linear-gradient(135deg,${t.col},${t.col}bb)`:"transparent",transition:"all .15s"}}>
              <t.Icon size={14} color={screen==="app"&&tab===t.id?"white":"#94A3B8"}/>
            </div>
            <span style={{fontSize:8,fontWeight:700,color:screen==="app"&&tab===t.id?t.col:"#94A3B8"}}>{t.short}</span>
          </button>
        ))}
        <button onClick={()=>setScreen("profile")} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:1,padding:"3px 1px",border:"none",background:"none",cursor:"pointer",fontFamily:"'Nunito',sans-serif"}}>
          <div style={{width:28,height:28,borderRadius:7,display:"flex",alignItems:"center",justifyContent:"center",background:screen==="profile"?"linear-gradient(135deg,#6366F1,#8B5CF6)":"transparent"}}>
            <User size={14} color={screen==="profile"?"white":"#94A3B8"}/>
          </div>
          <span style={{fontSize:8,fontWeight:700,color:screen==="profile"?"#6366F1":"#94A3B8"}}>Profile</span>
        </button>
      </nav>
    </div>
  );
}
