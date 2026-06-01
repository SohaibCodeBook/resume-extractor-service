// services/aiService.js
const axios = require('axios');

/**
 * Rewrite resume using Mistral 7B via Ollama (optimized for minimal hallucination)
 * @param {string} resume - Original resume text
 * @param {string} jobDescription - Target job description
 * @returns {string} AI-rewritten resume
 */
async function rewriteResumeWithAI(resume, jobDescription) {
  try {
   prompt = `You are rewriting a resume for clarity, readability, and style, **without changing any factual content**.

MANDATORY RULES (must follow 100%):
1. Never add, invent, or assume any skills, tools, platforms, industries, domains, certifications, achievements, or experiences not explicitly present in the original resume.
2. Do NOT drop, omit, or remove any content. All career history, work experience, education, certifications, skills, and achievements must remain exactly as in the original resume.
3. Do NOT alter the content of Experience, Work History, or Education sections beyond minor rephrasing for clarity. Keep roles, companies, dates, and responsibilities intact.
4. Updates may ONLY rephrase, reorganize, or emphasize EXISTING content from the resume.
5. Ignore all job description requirements that are not explicitly present in the original resume.
6. If unsure about any modification, **default to leaving the content exactly as it is in the original resume**.
7. Keep formatting clean, structured, and professional.
8. Response should have experience intact from resume.

MANDATORY SECTIONS (do not remove under any circumstances):
- Career History / Work Experience
- Education
- Certifications
- Achievements
- Skills / Core Competencies

OUTPUT INSTRUCTIONS:
- Return **only** the rewritten resume in plain text.
- At the end, include a section titled **“Modifications Made”** with bullet points listing exactly what was changed (e.g., “Rephrased summary for clarity,” “Reordered skills for emphasis”).
- Do not include explanations, reasoning, or commentary outside of the rewritten resume and modifications list.

Input Resume:
${resume}

Job Description:
${jobDescription}

Task:
Rewrite the resume strictly following the rules above, keeping all original content intact.`;
console.log("prompt", prompt);
    const rewrittenResume = await callMistral(prompt);

    // Verify no hallucinations
    const verifiedResume = verifyNoHallucination(rewrittenResume, resume);

    return verifiedResume;

  } catch (error) {
    console.error('Error in AI rewriting:', error.response?.data || error.message);
    return resume; // fallback
  }
}

/**
 * Build prompt for Mistral 7B
 */
// function buildTailoredPrompt(resume, jobDescription) {
//   return `You are customizing a resume to a specific job description.\n\nSTRICT RULES (must follow 100%):\n1. Do NOT add or invent anything not already in the resume.\n2. Do NOT include industries, tools, platforms, domains, certifications, or achievements that are not explicitly present in the resume.\n3. Do NOT assume experience in sectors (e.g., pharma, biotech) unless explicitly mentioned in the resume.\n4. Do NOT change or edit Experience, Work History, or Education. Leave them EXACTLY as they are.\n5. ONLY update the following sections:\n   - Summary\n   - Skills\n   - Accomplishments\n6. Updates must ONLY rephrase, reorganize, and emphasize **existing content** in the resume for clarity, conciseness, and alignment with the job description.\n7. Ignore any job description requirements that are not already represented in the resume.\n8. The rewritten resume must remain 100% factual and consistent with the original.\n\nInstructions:\n- Rewrite the resume with ONLY the updated sections (Summary, Skills, Accomplishments).\n- Keep formatting clean and professional.\n- At the end, list the specific modifications made in bullet points.\n- Return ONLY the rewritten resume and the list of modifications in plain text. Do not include explanations, extra commentary, or anything else.\n\nInput Resume:\n${resume}\n\nJob Description:\n${jobDescription}\n\nNow produce a tailored resume with only Summary, Skills, Accomplishments updated. At the end, list the modifications you made in bullet points. Return ONLY the rewritten resume in plain text.`;
// }

/**
 * Call Mistral 7B via Ollama API
 */
async function callMistral(prompt) {
  const ollamaUrl = process.env.PHI3_URL || 'http://localhost:11434/api/generate';
  const model = "gemma3:latest";
console.log("prompt", prompt);
  const response = await axios.post(
    ollamaUrl,
    {
      model,
      prompt,
      stream: false,
      options: {
        temperature: 0.0,   // deterministic output
        top_k: 1,            // minimal hallucination
        top_p: 0.1,
        repeat_penalty: 1.5,
        num_predict: 2000
      }
    },
    { headers: { 'Content-Type': 'application/json' } }
  );

  return response.data.response;
}

/**
 * Post-processing: check for hallucinated skills/certifications/achievements
 */
function verifyNoHallucination(aiText, originalResume) {
  // Extract original skills/certifications/keywords
  const keywords = new Set();
  
  // Capture core competencies, skills, certifications
  const skillMatches = originalResume.match(/Core Competencies:(.*?)(?=(Career History|Education|Certifications))/s);
  const certMatches = originalResume.match(/Certifications:(.*?)(?=(In Progress|Methodologies|$))/s);
  const allText = [skillMatches?.[1] || '', certMatches?.[1] || '', originalResume].join(' ');

  allText.split(/[,;\n]+/).map(s => s.trim()).forEach(s => { if(s) keywords.add(s.toLowerCase()); });

  // Scan AI text for potential hallucinations
  const aiWords = aiText.split(/[\s,;\n]+/);
  const hallucinations = [];

  aiWords.forEach(word => {
    const lw = word.toLowerCase().replace(/[^a-z0-9]/gi, '');
    if(lw && !keywords.has(lw)) {
      hallucinations.push(word);
    }
  });

  if(hallucinations.length > 0) {
    console.warn('Potential hallucinations detected:', Array.from(new Set(hallucinations)).slice(0, 20));
    // Optionally, you can remove or flag these from aiText
  }

  return aiText;
}

module.exports = { rewriteResumeWithAI, callMistral };
