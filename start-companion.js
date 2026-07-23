import http from 'http';
import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 5002;
const DATA_DIR = path.join(__dirname, 'data');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Helpers for reading/writing JSON files
const readDataFile = (fileName, defaultValue = []) => {
  const filePath = path.join(DATA_DIR, fileName);
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify(defaultValue, null, 2), 'utf8');
    return defaultValue;
  }
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(content);
  } catch (err) {
    console.error(`[Companion] Error reading ${fileName}:`, err);
    return defaultValue;
  }
};

const writeDataFile = (fileName, data) => {
  const filePath = path.join(DATA_DIR, fileName);
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error(`[Companion] Error writing ${fileName}:`, err);
  }
};

// Seed defaults
const seedDefaults = () => {
  // 1. Seed Exams
  readDataFile('exams.json', [
    {
      id: "QVVOBFE7",
      name: "Concours Médecine / Pharmacie 2024",
      school: "Médecine / Pharmacie",
      level: "2bac_pc_svt",
      year: "2024",
      tier: "freemium",
      isActive: true,
      isArchived: false,
      dateAdded: new Date().toISOString(),
      questions: Array.from({ length: 20 }, (_, i) => {
        const answers = ["C", "A", "B", "D", "C", "A", "E", "B", "C", "D", "B", "B", "A", "C", "D", "E", "B", "A", "D", "C"];
        const topics = ["Analyse", "Géométrie", "Algèbre", "Physique", "Chimie"];
        const optTexts = ["Option A", "Option B", "Option C", "Option D", "Option E"];
        return {
          id: `qvvobfe7-q-${i + 1}`,
          question: `Question ${i + 1} de concours Médecine/Pharmacie`,
          topic: topics[i % topics.length],
          correct_answer: answers[i],
          options: optTexts.map((txt, oIdx) => ({
            id: ["A", "B", "C", "D", "E"][oIdx],
            text: txt
          }))
        };
      })
    }
  ]);

  // 2. Seed Lessons
  readDataFile('lessons.json', [
    {
      id: "MOCK-TC-MATH-01",
      title: "Fiche 01 : Logique Mathématique",
      subject: "Mathématiques",
      chapter_number: "01",
      teacher: "Prof. Youssef",
      phone: "0681399067",
      schools: ["Bac BIOF"],
      content: {
        level: "common_core_sci",
        doc_type: "course",
        header: {
          prep_title: "Tronc Commun Sciences",
          schools: ["Bac BIOF"],
          subject: "Mathématiques",
          fiche_title: "Fiche 01 : Logique Mathématique",
          teacher: "Prof. Youssef",
          phone: "0681399067"
        },
        sections: [
          {
            id: "sec-tc-1",
            title: "Assertions et connecteurs logiques",
            type: "content",
            section_number: "1",
            section_header: "Résumé de cours : Logique",
            accent_text: "Définitions et propositions",
            items: [
              {
                type: "text",
                text: "Une **assertion** (ou proposition) est un énoncé mathématique qui a une valeur de vérité unique : soit **Vrai (V)** soit **Faux (F)**."
              },
              {
                type: "highlight_box",
                text: "L'implication $P \\Rightarrow Q$ est fausse uniquement dans le cas où $P$ est vraie et $Q$ est fausse. Elle est équivalente à $(\\text{non } P) \\text{ ou } Q$."
              },
              {
                type: "bullet",
                text: "La conjonction $P \\text{ et } Q$ est vraie si et seulement si les deux assertions sont vraies simultanément."
              }
            ]
          },
          {
            id: "ex-tc-1",
            title: "Exercice 1 : Négation de propositions",
            type: "exercise",
            section_number: "2",
            section_header: "Exercices d'application",
            content: "Écrire la négation mathématique de la proposition suivante :\n$$P: (\\forall x \\in \\mathbb{R})(\\exists y \\in \\mathbb{R}) : x + y > 0$$",
            solution: "Pour trouver la négation d'une proposition quantifiée, on inverse les quantificateurs et on prend la négation de l'assertion finale :\n\n- Le $\\forall x$ devient $\\exists x$\n- Le $\\exists y$ devient $\\forall y$\n- L'inégalité strict $>$ devient $\\le$\n\nAinsi, la négation est :\n$$\\text{non } P: (\\exists x \\in \\mathbb{R})(\\forall y \\in \\mathbb{R}) : x + y \\le 0$$",
            interactive_answers: [
              {
                question_idx: 1,
                label: "Entrez le symbole final de comparaison de la négation (<= ou >=) :",
                expected_answer: "<="
              }
            ]
          }
        ]
      },
      is_active: true,
      created_at: new Date(Date.now() - 3600000 * 24).toISOString(),
      updated_at: new Date().toISOString()
    }
  ]);

  // 3. Seed Users
  readDataFile('users.json', [
    { id: '1', name: 'Youssef Alaoui', email: 'youssef@massar.ma', role: 'student', tier: 'freemium', xp: 450, joined: new Date().toISOString(), school: 'Lycée Qualifiant 18 Novembre', class_id: '1BACSEF-1' },
    { id: '2', name: 'Sara Bennani', email: 'premium@lconq.ma', role: 'student', tier: 'premium', xp: 8450, joined: new Date().toISOString(), school: 'Lycée Qualifiant Zellaqa' },
    { id: '3', name: 'Aymane Idrissi', email: 'free@lconq.ma', role: 'student', tier: 'freemium', xp: 120, joined: new Date().toISOString(), school: 'Lycée Qualifiant Moulay Yacoub' }
  ]);

  // 4. Seed Config
  readDataFile('config.json', {
    branding: {
      profName: "",
      profPhone: "",
      profSite: "www.lconq.ma",
      bankName: "CIH Bank (Maroc)",
      bankRIB: "230 780 4567890123 0001 89",
      bankBeneficiary: "L'CONQ SARL",
      fbPixelId: ""
    },
    schools: ['2bac_sm', '2bac_pc_svt', '1bac_sci', 'common_core_sci', '2bac_arts', '1bac_arts', 'common_core_arts'],
    schoolBranding: {},
    plans: [
      {
        id: 'plan_lconq',
        name: "Premium L'CONQ",
        price: 99,
        durationDays: 30,
        description: "Le pack complet pour la réussite.",
        isRecommended: true,
        features: [
          "Accès à toutes les archives (2010–2025)",
          "Astuces IA exclusives pour chaque QCM",
          "Simulateur de concours chronométré",
          "Heatmaps des faiblesses"
        ],
        allowedSchools: ['Médecine / Pharmacie', 'ENSA', 'ENSAM', 'ENCG', 'INPT', 'INSEA', 'Général (Prépa)']
      },
      {
        id: 'plan_complet',
        name: "Pack Premium Global",
        price: 699,
        durationDays: 365,
        description: "La préparation ultime sur le long terme.",
        isRecommended: false,
        features: [
          "Accès à toutes les archives (2010–2025)",
          "Astuces IA exclusives pour chaque QCM",
          "Simulateur de concours chronométré",
          "Heatmaps des faiblesses",
          "Accès prioritaire aux nouveautés"
        ],
        allowedSchools: ['Médecine / Pharmacie', 'ENSA', 'ENSAM', 'ENCG', 'INPT', 'INSEA', 'Général (Prépa)']
      }
    ],
    activationCodes: [
      {
        code: 'LCONQ-PREM-TEST-30D',
        planId: 'plan_lconq',
        isUsed: false,
        usedBy: '',
        usedAt: '',
        batchName: 'Test Batch 30 Jours',
        createdDate: new Date().toISOString()
      },
      {
        code: 'LCONQ-GLOB-TEST-365',
        planId: 'plan_complet',
        isUsed: false,
        usedBy: '',
        usedAt: '',
        batchName: 'Test Batch 365 Jours',
        createdDate: new Date().toISOString()
      }
    ]
  });

  // 5. Seed Classes
  readDataFile('classes.json', []);
};

seedDefaults();

const sendJSON = (res, statusCode, data) => {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
};

const getBody = (req) => {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        reject(err);
      }
    });
  });
};

const server = http.createServer(async (req, res) => {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname;

  // Ping endpoint to verify status
  if (req.method === 'GET' && pathname === '/ping') {
    sendJSON(res, 200, { status: 'online', message: "L'Conq Companion is ready!" });
    return;
  }

  // ── Original save-icon endpoint ───────────────────────────────────────────
  if (req.method === 'POST' && pathname.startsWith('/save-icon')) {
    try {
      const size = parsedUrl.searchParams.get('size');
      const payload = await getBody(req);
      const base64Data = payload.image.replace(/^data:image\/png;base64,/, "");
      const iconsDir = path.join(__dirname, 'public', 'icons');
      if (!fs.existsSync(iconsDir)) {
        fs.mkdirSync(iconsDir, { recursive: true });
      }
      const iconPath = path.join(iconsDir, `icon-${size}.png`);
      fs.writeFileSync(iconPath, base64Data, 'base64');
      console.log(`[Companion] Icon icon-${size}.png saved successfully!`);
      sendJSON(res, 200, { success: true });
    } catch (err) {
      console.error('[Companion] Error saving icon:', err);
      sendJSON(res, 500, { success: false, error: err.message });
    }
    return;
  }

  // ── Database Exams Endpoints ──────────────────────────────────────────────
  if (pathname === '/api/exams') {
    const exams = readDataFile('exams.json');
    if (req.method === 'GET') {
      sendJSON(res, 200, exams);
    } else if (req.method === 'POST') {
      try {
        const exam = await getBody(req);
        if (!exam.id) {
          exam.id = Math.random().toString(36).substring(2, 11).toUpperCase();
        }
        const index = exams.findIndex(e => e.id === exam.id);
        if (index > -1) {
          exams[index] = { ...exams[index], ...exam, updatedAt: new Date().toISOString() };
        } else {
          exam.createdAt = new Date().toISOString();
          exams.push(exam);
        }
        writeDataFile('exams.json', exams);
        sendJSON(res, 200, { success: true, exam });
      } catch (err) {
        sendJSON(res, 500, { error: err.message });
      }
    } else if (req.method === 'DELETE') {
      const id = parsedUrl.searchParams.get('id');
      if (!id) {
        sendJSON(res, 400, { error: 'Missing exam id' });
        return;
      }
      const filtered = exams.filter(e => e.id !== id);
      writeDataFile('exams.json', filtered);
      sendJSON(res, 200, { success: true });
    }
    return;
  }

  // ── Database Lessons Endpoints ────────────────────────────────────────────
  if (pathname === '/api/lessons') {
    const lessons = readDataFile('lessons.json');
    if (req.method === 'GET') {
      sendJSON(res, 200, lessons);
    } else if (req.method === 'POST') {
      try {
        const lesson = await getBody(req);
        if (!lesson.id) {
          lesson.id = 'MOCK-L-' + Math.random().toString(36).substring(2, 11).toUpperCase();
        }
        const index = lessons.findIndex(l => l.id === lesson.id);
        if (index > -1) {
          lessons[index] = { ...lessons[index], ...lesson, updatedAt: new Date().toISOString() };
        } else {
          lesson.createdAt = new Date().toISOString();
          lessons.push(lesson);
        }
        writeDataFile('lessons.json', lessons);
        sendJSON(res, 200, { success: true, lesson });
      } catch (err) {
        sendJSON(res, 500, { error: err.message });
      }
    } else if (req.method === 'DELETE') {
      const id = parsedUrl.searchParams.get('id');
      if (!id) {
        sendJSON(res, 400, { error: 'Missing lesson id' });
        return;
      }
      const filtered = lessons.filter(l => l.id !== id);
      writeDataFile('lessons.json', filtered);
      sendJSON(res, 200, { success: true });
    }
    return;
  }

  // ── Database Classes Endpoints ────────────────────────────────────────────
  if (pathname === '/api/classes') {
    const classes = readDataFile('classes.json');
    if (req.method === 'GET') {
      sendJSON(res, 200, classes);
    } else if (req.method === 'POST') {
      try {
        const cls = await getBody(req);
        if (!cls.id) {
          cls.id = 'CLASS-' + Math.random().toString(36).substring(2, 11).toUpperCase();
        }
        const index = classes.findIndex(c => c.id === cls.id);
        if (index > -1) {
          classes[index] = { ...classes[index], ...cls, updatedAt: new Date().toISOString() };
        } else {
          cls.createdAt = new Date().toISOString();
          classes.push(cls);
        }
        writeDataFile('classes.json', classes);
        sendJSON(res, 200, { success: true, class: cls });
      } catch (err) {
        sendJSON(res, 500, { error: err.message });
      }
    } else if (req.method === 'DELETE') {
      const id = parsedUrl.searchParams.get('id');
      if (!id) {
        sendJSON(res, 400, { error: 'Missing class id' });
        return;
      }
      const filtered = classes.filter(c => c.id !== id);
      writeDataFile('classes.json', filtered);
      sendJSON(res, 200, { success: true });
    }
    return;
  }

  // ── Database Users Endpoints ──────────────────────────────────────────────
  if (pathname === '/api/users') {
    const users = readDataFile('users.json');
    if (req.method === 'GET') {
      sendJSON(res, 200, users);
    } else if (req.method === 'POST') {
      try {
        const userObj = await getBody(req);
        if (!userObj.id && !userObj.uid) {
          userObj.id = Math.random().toString(36).substring(2, 11);
          userObj.uid = userObj.id;
        }
        const id = userObj.id || userObj.uid;
        const index = users.findIndex(u => u.id === id || u.uid === id);
        if (index > -1) {
          users[index] = { ...users[index], ...userObj, updatedAt: new Date().toISOString() };
        } else {
          userObj.id = id;
          userObj.uid = id;
          userObj.joined = new Date().toISOString();
          users.push(userObj);
        }
        writeDataFile('users.json', users);
        sendJSON(res, 200, { success: true, user: users[index > -1 ? index : users.length - 1] });
      } catch (err) {
        sendJSON(res, 500, { error: err.message });
      }
    } else if (req.method === 'DELETE') {
      const id = parsedUrl.searchParams.get('id');
      if (!id) {
        sendJSON(res, 400, { error: 'Missing user id' });
        return;
      }
      const filtered = users.filter(u => u.id !== id && u.uid !== id);
      writeDataFile('users.json', filtered);
      sendJSON(res, 200, { success: true });
    }
    return;
  }

  // ── Database General Config Endpoints ─────────────────────────────────────
  if (pathname === '/api/config') {
    const config = readDataFile('config.json', {});
    if (req.method === 'GET') {
      sendJSON(res, 200, config);
    } else if (req.method === 'POST') {
      try {
        const payload = await getBody(req);
        const updatedConfig = { ...config, ...payload };
        writeDataFile('config.json', updatedConfig);
        sendJSON(res, 200, { success: true, config: updatedConfig });
      } catch (err) {
        sendJSON(res, 500, { error: err.message });
      }
    }
    return;
  }

  sendJSON(res, 404, { error: 'Not Found' });
});

server.listen(PORT, () => {
  console.log(`=================================================`);
  console.log(`🚀 L'Conq Local Companion Server & DB est en ligne !`);
  console.log(`🔌 Adresse : http://localhost:${PORT}`);
  console.log(`=================================================`);
});
