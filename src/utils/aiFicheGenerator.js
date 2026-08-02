// src/utils/aiFicheGenerator.js
// AI-Powered Official Moroccan Fiche Pédagogique Generator via Gemini AI

import { generateFichePedagogiquePDF } from './generateFichePedagogiquePDF';

export async function generateFichePedagogiqueWithAI(lesson, options = {}) {
  const geminiKey = localStorage.getItem('gemini_api_key') || import.meta.env.VITE_GEMINI_API_KEY || '';
  
  if (!geminiKey) {
    alert("⚠️ Clé API Gemini introuvable. Veuillez configurer votre clé API dans Paramètres -> Clés API pour utiliser le générateur de Fiches par IA.");
    return;
  }

  // Extract lesson text for prompt context
  let lessonText = `Titre: ${lesson.title || 'Lesson'}\nNiveau: ${lesson.level || lesson.detected_level || 'Bac'}\n`;

  if (lesson.sections && Array.isArray(lesson.sections)) {
    lesson.sections.forEach((sec, i) => {
      lessonText += `\n--- Section ${i + 1}: ${sec.title || sec.section_header || ''} ---\n`;
      if (sec.items && Array.isArray(sec.items)) {
        sec.items.forEach(it => {
          lessonText += (typeof it === 'string' ? it : (it.text || '')) + '\n';
        });
      } else if (sec.content) {
        lessonText += sec.content + '\n';
      }
    });
  } else if (lesson.content) {
    if (typeof lesson.content === 'string') {
      lessonText += lesson.content;
    } else {
      lessonText += JSON.stringify(lesson.content);
    }
  }

  // Limit text size if extremely large
  if (lessonText.length > 8000) {
    lessonText = lessonText.slice(0, 8000) + '...';
  }

  const systemInstruction = `Tu es un Inspecteur Principal de Mathématiques au Ministère de l'Éducation Nationale du Royaume du Maroc (Normes officielles BO n°6844).
Analyse le contenu du cours/chapitre fourni et génère la Fiche Pédagogique Officielle complète au format JSON strict.

Le JSON doit respecter scrupuleusement la structure suivante :
{
  "fiche_title": "Titre officiel du chapitre",
  "level": "Niveau scolaire (ex: 2ème BAC Sciences Mathématiques / PC / SVT)",
  "duration": "Durée globale estimée (ex: 6 Heures)",
  "prerequisites": [
    "Mictasabat 1 (ex: Calcul de dérivées et étude de fonctions de base)",
    "Mictasabat 2...",
    "Mictasabat 3..."
  ],
  "capacities": [
    "Capacité attendue 1 (ex: Maîtriser le raisonnement par récurrence)",
    "Capacité attendue 2...",
    "Capacité attendue 3..."
  ],
  "tools": "Manuel scolaire officiel, Data Show (Présentation interactive), Calculatrice scientifique, GeoGebra",
  "sections": [
    {
      "title": "I. Titre de la séquence/paragraphe",
      "duration": "45 min",
      "content_summary": "Résumé didactique (Activité de découverte, Définition, Propriété ou Exercice)",
      "teacher_role": "Rôle de l'enseignant (Orientations, animation, correction au tableau)",
      "student_role": "Rôle de l'élève (Recherche individuelle, prise de notes, formulation)",
      "evaluation_type": "Formative (Exercice oral / QCM / Application au tableau)"
    }
  ]
}`;

  const promptText = `Voici le contenu du cours à analyser :\n\n${lessonText}\n\nGénère la Fiche Pédagogique Officielle au format JSON.`;

  const modelToUse = localStorage.getItem('gemini_model') || 'gemini-1.5-flash';
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelToUse}:generateContent?key=${geminiKey}`;

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: promptText }]
          }
        ],
        systemInstruction: {
          parts: [{ text: systemInstruction }]
        },
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.2
        }
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Erreur API Gemini (${response.status}): ${errText}`);
    }

    const data = await response.json();
    const rawJsonText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!rawJsonText) {
      throw new Error("Réponse vide de l'IA.");
    }

    const parsedData = JSON.parse(rawJsonText);
    
    // Merge AI generated metadata into lesson object
    const enrichedLesson = {
      ...lesson,
      fiche_title: parsedData.fiche_title || lesson.title,
      detected_level: parsedData.level || lesson.level,
      duration: parsedData.duration || '6 Heures',
      prerequisites: parsedData.prerequisites || [],
      capacities: parsedData.capacities || [],
      tools: parsedData.tools || 'Manuel scolaire, Data Show, Calculatrice',
      sections: parsedData.sections && parsedData.sections.length > 0 ? parsedData.sections : lesson.sections
    };

    // Trigger printable PDF generation
    generateFichePedagogiquePDF(enrichedLesson, options);
    return enrichedLesson;

  } catch (error) {
    console.error("Failed to generate AI Fiche Pédagogique:", error);
    alert(`❌ Erreur lors de la génération de la Fiche par IA : ${error.message}\n\nFalling back to standard template.`);
    // Fallback to standard PDF generator
    generateFichePedagogiquePDF(lesson, options);
  }
}
