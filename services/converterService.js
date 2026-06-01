// services/converterService.js
const puppeteer = require('puppeteer');
const { asBlob } = require('html-docx-js');

/**
 * Enhanced candidate information extractor
 */
function extractCandidateInfo(text) {
  const info = {
    name: '',
    title: '',
    email: '',
    phone: '',
    location: '',
    linkedin: '',
    github: '',
    website: ''
  };
  
  // Extract email
  const emailMatch = text.match(/([a-zA-Z0-9._+-]+@[a-zA-Z0-9._-]+\.[a-zA-Z]{2,})/);
  if (emailMatch) info.email = emailMatch[1];
  
  // Extract phone
  const phoneMatch = text.match(/\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/);
  if (phoneMatch) info.phone = phoneMatch[0];
  
  // Extract LinkedIn
  const linkedinMatch = text.match(/(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/([\w-]+)/i);
  if (linkedinMatch) info.linkedin = `linkedin.com/in/${linkedinMatch[1]}`;
  
  // Extract GitHub
  const githubMatch = text.match(/(?:https?:\/\/)?(?:www\.)?github\.com\/([\w-]+)/i);
  if (githubMatch) info.github = `github.com/${githubMatch[1]}`;
  
  // Extract name and location together: "Name, City, State"
  const nameLocationMatch = text.match(/^([A-Z][a-z]+\s+[A-Z][a-z]+),\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*),\s+([A-Z]{2})/);
  if (nameLocationMatch) {
    info.name = nameLocationMatch[1];
    info.location = `${nameLocationMatch[2]}, ${nameLocationMatch[3]}`;
  }
  
  // Extract professional title (look for common title patterns after contact info)
  const titlePatterns = [
    /Senior\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\s+(?:Lead|Engineer|Architect|Manager|Director|Specialist)/i,
    /Lead\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\s+(?:Engineer|Architect)/i,
    /Principal\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\s+(?:Engineer|Architect)/i,
    /Chief\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\s+Officer/i
  ];
  
  for (const pattern of titlePatterns) {
    const match = text.match(pattern);
    if (match) {
      info.title = match[0];
      break;
    }
  }
  
  return info;
}

/**
 * Parse resume into structured sections
 */
function parseResumeText(text) {
  const sections = {
    summary: '',
    accomplishments: [],
    experience: [],
    skills: {
      technical: [],
      soft: [],
      tools: [],
      frameworks: []
    },
    education: [],
    certifications: []
  };
  
  // Split text into major sections
  const sectionSplits = {
    accomplishments: /(?:Highlighted?\s+Achievements?|Key\s+Achievements?):\s*/i,
    competencies: /(?:Core\s+Competencies):\s*/i,
    career: /(?:Career\s+History):\s*/i,
    education: /(?:Education):\s*/i,
    certifications: /(?:Certifications?):\s*/i,
    methodologies: /(?:Methodologies,?\s+Software,?\s+(?:and\s+)?Compliance):\s*/i
  };
  
  // Extract accomplishments
  const accomplishmentsSplit = text.split(sectionSplits.accomplishments);
  if (accomplishmentsSplit.length > 1) {
    const accomplishmentsText = accomplishmentsSplit[1].split(/(?:Core Competencies|Career History)/i)[0];
    sections.accomplishments = extractAccomplishments(accomplishmentsText);
  }
  
  // Extract core competencies
  const competenciesSplit = text.split(sectionSplits.competencies);
  if (competenciesSplit.length > 1) {
    const competenciesText = competenciesSplit[1].split(/(?:Career History|Highlighted)/i)[0];
    sections.skills.soft = extractCompetencies(competenciesText);
  }
  
  // Extract career history
  const careerSplit = text.split(sectionSplits.career);
  if (careerSplit.length > 1) {
    const careerText = careerSplit[1].split(/(?:Education|Certifications|Methodologies)/i)[0];
    sections.experience = extractExperience(careerText);
  }
  
  // Extract education
  const educationSplit = text.split(sectionSplits.education);
  if (educationSplit.length > 1) {
    const educationText = educationSplit[1].split(/(?:Certifications|Methodologies)/i)[0];
    sections.education = extractEducation(educationText);
  }
  
  // Extract certifications
  const certificationsSplit = text.split(sectionSplits.certifications);
  if (certificationsSplit.length > 1) {
    const certificationsText = certificationsSplit[1].split(/(?:Methodologies|Job Description)/i)[0];
    sections.certifications = extractCertifications(certificationsText);
  }
  
  // Extract methodologies/technologies
  const methodologiesSplit = text.split(sectionSplits.methodologies);
  if (methodologiesSplit.length > 1) {
    const methodologiesText = methodologiesSplit[1].split(/(?:Job Description|---)/i)[0];
    const methodSkills = extractMethodologies(methodologiesText);
    sections.skills.technical = methodSkills.technical;
    sections.skills.tools = methodSkills.tools;
    sections.skills.frameworks = methodSkills.frameworks;
  }
  
  // Extract summary (from beginning to first major section)
  const summaryText = text.split(/(?:Highlighted?\s+Achievements?|Core\s+Competencies)/i)[0];
  sections.summary = extractSummary(summaryText);
  
  return sections;
}

/**
 * Extract professional summary
 */
function extractSummary(text) {
  // Remove contact information
  let cleaned = text
    .replace(/^[A-Z][a-z]+\s+[A-Z][a-z]+,\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*,\s+[A-Z]{2},?\s*/, '')
    .replace(/[a-zA-Z0-9._+-]+@[a-zA-Z0-9._-]+\.[a-zA-Z]{2,},?\s*/, '')
    .replace(/\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4},?\s*/, '')
    .replace(/(?:www\.)?linkedin\.com\/in\/[\w-]+,?\s*/gi, '')
    .replace(/(?:www\.)?github\.com\/[\w-]+,?\s*/gi, '');
  
  // Extract sentences with professional context
  const sentences = cleaned.split(/\.\s+/).filter(s => s.length > 30);
  
  // Find the most relevant professional sentences
  const professionalSentences = sentences.filter(s => 
    /\d+\+?\s*years|experience|engineer|platform|architect|managing|delivered|infrastructure/i.test(s)
  ).slice(0, 3);
  
  return professionalSentences.join('. ').trim() + (professionalSentences.length > 0 ? '.' : '');
}

/**
 * Extract accomplishments
 */
function extractAccomplishments(text) {
  const accomplishments = [];
  
  // Split by achievement action verbs
  const actionVerbs = [
    'Annually recognized',
    'Established',
    'Integrated',
    'Spurred',
    'Led',
    'Identified',
    'Virtualized',
    'Achieved',
    'Delivered',
    'Drove',
    'Built',
    'Created',
    'Developed'
  ];
  
  // Find all accomplishment sentences
  const sentences = text.split(/\.\s+/);
  
  sentences.forEach(sentence => {
    const trimmed = sentence.trim();
    if (trimmed.length > 30) {
      // Check if starts with an action verb or contains quantifiable results
      const hasActionVerb = actionVerbs.some(verb => 
        new RegExp(`^${verb}`, 'i').test(trimmed) || 
        new RegExp(`\\b${verb}`, 'i').test(trimmed)
      );
      
      const hasMetrics = /\d+%|\d+K\+|\$\d+|million|billion|reduction|increase|improvement/i.test(trimmed);
      
      if (hasActionVerb || hasMetrics) {
        accomplishments.push(trimmed + (trimmed.endsWith('.') ? '' : '.'));
      }
    }
  });
  
  return accomplishments;
}

/**
 * Extract core competencies
 */
function extractCompetencies(text) {
  const competencies = text
    .split(/[,;]/)
    .map(s => s.trim())
    .filter(s => s.length > 3 && s.length < 100);
  
  return competencies;
}

/**
 * Extract work experience
 */
function extractExperience(text) {
  const experiences = [];
  
  // Pattern: Title | Company | Location | Date Range
  const jobPattern = /([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*([A-Z][a-z]{2}\s+\d{4}\s*[-–]\s*(?:[A-Z][a-z]{2}\s+\d{4}|Current|Present))/g;
  
  let match;
  const jobMatches = [];
  
  while ((match = jobPattern.exec(text)) !== null) {
    jobMatches.push({
      title: match[1].trim(),
      company: match[2].trim(),
      location: match[3].trim(),
      dates: match[4].trim(),
      startIndex: match.index,
      endIndex: match.index + match[0].length
    });
  }
  
  // Extract responsibilities for each job
  jobMatches.forEach((job, index) => {
    const nextIndex = index < jobMatches.length - 1 ? jobMatches[index + 1].startIndex : text.length;
    const jobText = text.substring(job.endIndex, nextIndex);
    
    // Split into sentences
    const responsibilities = jobText
      .split(/\.\s+/)
      .map(s => s.trim())
      .filter(s => s.length > 20 && s.length < 1000)
      .map(s => s.replace(/^[-•*]\s*/, ''));
    
    experiences.push({
      title: job.title,
      company: job.company,
      location: job.location,
      dates: job.dates,
      responsibilities: responsibilities
    });
  });
  
  return experiences;
}

/**
 * Extract education
 */
function extractEducation(text) {
  const education = [];
  
  // Pattern: Degree, Field, University
  const items = text.split(/\.\s+/);
  
  items.forEach(item => {
    const trimmed = item.trim();
    if (/Bachelor|Master|PhD|B\.?S\.?|M\.?S\.?|B\.?A\.?|M\.?A\.?|MBA|BBA|Associate/i.test(trimmed)) {
      const parts = trimmed.split(',').map(s => s.trim());
      
      education.push({
        degree: parts[0] || trimmed,
        field: parts.length > 1 ? parts[1] : '',
        institution: parts.length > 2 ? parts[2] : parts.length > 1 ? parts[1] : '',
        year: '',
        gpa: '',
        details: []
      });
    }
  });
  
  return education;
}

/**
 * Extract certifications
 */
function extractCertifications(text) {
  const certifications = [];
  
  // Look for "Achieved:" section
  const achievedMatch = text.match(/Achieved:\s*([^.]+(?:\([^)]+\))?[^.]*)/i);
  if (achievedMatch) {
    const certs = achievedMatch[1].split(',').map(s => s.trim()).filter(s => s.length > 2);
    certs.forEach(cert => {
      certifications.push({
        name: cert,
        issuer: extractIssuer(cert),
        year: '',
        status: 'Completed'
      });
    });
  }
  
  // Look for "In Progress:" section
  const inProgressMatch = text.match(/In Progress:\s*([^.]+)/i);
  if (inProgressMatch) {
    const certs = inProgressMatch[1].split(',').map(s => s.trim()).filter(s => s.length > 2);
    certs.forEach(cert => {
      certifications.push({
        name: cert,
        issuer: extractIssuer(cert),
        year: '',
        status: 'In Progress'
      });
    });
  }
  
  return certifications;
}

/**
 * Extract certification issuer
 */
function extractIssuer(certName) {
  const issuers = {
    'Microsoft': /Microsoft|Azure|MS|MCSE|MCSA/i,
    'AWS': /AWS|Amazon/i,
    'CompTIA': /CompTIA|A\+|Network\+|Security\+/i,
    'IBM': /IBM/i,
    'Linux Foundation': /Linux|LFS\d+/i,
    'Cisco': /Cisco|CCNA|CCNP/i,
    'Google': /Google|GCP/i
  };
  
  for (const [issuer, pattern] of Object.entries(issuers)) {
    if (pattern.test(certName)) return issuer;
  }
  
  return '';
}

/**
 * Extract methodologies and technologies
 */
function extractMethodologies(text) {
  const skills = {
    technical: [],
    tools: [],
    frameworks: []
  };
  
  // Pattern: Category (item1, item2, item3)
  const categoryPattern = /([^(]+)\(([^)]+)\)/g;
  
  let match;
  while ((match = categoryPattern.exec(text)) !== null) {
    const category = match[1].trim().toLowerCase();
    const items = match[2]
      .split(/[,;]/)
      .map(s => s.trim())
      .filter(s => s.length > 1);
    
    if (/virtualization|os|operating|infrastructure|network|security|storage|backup/i.test(category)) {
      skills.technical.push(...items);
    } else if (/software|enterprise|project|data|analytics/i.test(category)) {
      skills.tools.push(...items);
    } else if (/programming|scripting|web|technologies/i.test(category)) {
      skills.frameworks.push(...items);
    } else {
      skills.technical.push(...items);
    }
  }
  
  return skills;
}

/**
 * Generate professional HTML resume
 */
async function generateHTML(resumeText) {
  const candidateInfo = extractCandidateInfo(resumeText);
  const sections = parseResumeText(resumeText);
  
  const { name, title, email, phone, location, linkedin, github } = candidateInfo;
  
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Resume - ${name || 'Professional'}</title>
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body { 
  font-family: 'Calibri', 'Segoe UI', Arial, sans-serif; 
  line-height: 1.6; 
  color: #2c3e50; 
  background: #fff; 
  padding: 30px 40px; 
  max-width: 900px; 
  margin: 0 auto; 
}
.header { 
  text-align: center; 
  padding-bottom: 25px; 
  margin-bottom: 30px; 
  border-bottom: 3px solid #3498db; 
}
.header h1 { 
  font-size: 36px; 
  color: #1a252f; 
  margin-bottom: 8px; 
  font-weight: 700; 
  letter-spacing: 1px; 
}
.header .title { 
  font-size: 18px; 
  color: #3498db; 
  font-weight: 600; 
  margin-bottom: 12px; 
}
.contact-info { 
  display: flex; 
  justify-content: center; 
  flex-wrap: wrap; 
  gap: 18px; 
  font-size: 14px; 
  color: #555; 
}
.contact-info a { color: #3498db; text-decoration: none; }
.contact-info a:hover { text-decoration: underline; }
.section { 
  margin-bottom: 28px; 
  page-break-inside: avoid; 
}
.section-title { 
  font-size: 20px; 
  color: #1a252f; 
  font-weight: 700; 
  text-transform: uppercase; 
  border-bottom: 2px solid #3498db; 
  padding-bottom: 6px; 
  margin-bottom: 16px; 
  letter-spacing: 0.5px; 
}
.section-content { 
  padding-left: 5px; 
}
.section-content p { 
  margin-bottom: 12px; 
  line-height: 1.7; 
  text-align: justify;
}
.experience-item, .education-item { 
  margin-bottom: 20px; 
  page-break-inside: avoid; 
}
.item-header { 
  margin-bottom: 8px; 
}
.item-title { 
  font-size: 17px; 
  font-weight: 700; 
  color: #2c3e50; 
}
.item-subtitle { 
  font-size: 15px; 
  color: #555; 
  font-style: italic; 
  margin-top: 2px; 
}
.item-date { 
  font-size: 14px; 
  color: #7f8c8d; 
  float: right; 
}
.item-description { 
  margin-top: 10px; 
  margin-left: 20px; 
  list-style-type: disc; 
}
.item-description li { 
  margin-bottom: 6px; 
  line-height: 1.6; 
  color: #34495e; 
}
.skills-container { 
  display: flex; 
  flex-direction: column; 
  gap: 15px; 
}
.skill-category { 
  margin-bottom: 10px; 
}
.skill-category-title { 
  font-weight: 700; 
  color: #2c3e50; 
  font-size: 15px; 
  margin-bottom: 8px; 
}
.skills-grid { 
  display: flex; 
  flex-wrap: wrap; 
  gap: 8px; 
}
.skill-item { 
  background: #ecf0f1; 
  padding: 6px 14px; 
  border-radius: 4px; 
  font-size: 13px; 
  color: #2c3e50; 
  border-left: 3px solid #3498db; 
  display: inline-block; 
}
.accomplishment-item { 
  margin-bottom: 12px; 
  padding-left: 20px; 
  position: relative; 
  line-height: 1.7;
}
.accomplishment-item:before { 
  content: "✓"; 
  position: absolute; 
  left: 0; 
  color: #27ae60; 
  font-weight: bold; 
  font-size: 16px;
}
.cert-item { 
  margin-bottom: 10px; 
  padding-left: 20px; 
  position: relative; 
}
.cert-item:before { 
  content: "▪"; 
  position: absolute; 
  left: 0; 
  color: #3498db; 
  font-weight: bold; 
}
.cert-status { 
  color: #7f8c8d; 
  font-size: 12px; 
  font-style: italic; 
}
@media print { 
  body { padding: 15px; font-size: 11pt; } 
  .header h1 { font-size: 28px; } 
  .section { page-break-inside: avoid; margin-bottom: 20px; } 
  .item-description { margin-left: 15px; } 
}
</style>
</head>
<body>

<div class="header">
  <h1>${name || 'Professional Resume'}</h1>
  ${title ? `<div class="title">${title}</div>` : ''}
  <div class="contact-info">
    ${email ? `<span>✉ <a href="mailto:${email}">${email}</a></span>` : ''}
    ${phone ? `<span>📞 ${phone}</span>` : ''}
    ${location ? `<span>📍 ${location}</span>` : ''}
    ${linkedin ? `<span>🔗 <a href="https://${linkedin}" target="_blank">LinkedIn</a></span>` : ''}
    ${github ? `<span>💻 <a href="https://${github}" target="_blank">GitHub</a></span>` : ''}
  </div>
</div>

${sections.summary ? `
<div class="section">
  <h2 class="section-title">Professional Summary</h2>
  <div class="section-content">
    <p>${sections.summary}</p>
  </div>
</div>
` : ''}

${sections.accomplishments.length > 0 ? `
<div class="section">
  <h2 class="section-title">Key Achievements</h2>
  <div class="section-content">
    ${sections.accomplishments.map(acc => `<div class="accomplishment-item">${acc}</div>`).join('')}
  </div>
</div>
` : ''}

${sections.skills.soft.length > 0 ? `
<div class="section">
  <h2 class="section-title">Core Competencies</h2>
  <div class="section-content">
    <div class="skills-grid">
      ${sections.skills.soft.map(skill => `<span class="skill-item">${skill}</span>`).join('')}
    </div>
  </div>
</div>
` : ''}

${sections.experience.length > 0 ? `
<div class="section">
  <h2 class="section-title">Professional Experience</h2>
  <div class="section-content">
    ${sections.experience.map(exp => `
    <div class="experience-item">
      <div class="item-header">
        <div>
          <span class="item-title">${exp.title}</span>
          ${exp.dates ? `<span class="item-date">${exp.dates}</span>` : ''}
        </div>
        <div class="item-subtitle">${exp.company}${exp.location ? ` | ${exp.location}` : ''}</div>
      </div>
      ${exp.responsibilities.length > 0 ? `
      <ul class="item-description">
        ${exp.responsibilities.map(resp => `<li>${resp}.</li>`).join('')}
      </ul>
      ` : ''}
    </div>
    `).join('')}
  </div>
</div>
` : ''}

${sections.education.length > 0 ? `
<div class="section">
  <h2 class="section-title">Education</h2>
  <div class="section-content">
    ${sections.education.map(edu => `
    <div class="education-item">
      <div class="item-header">
        <span class="item-title">${edu.degree}${edu.field ? ` - ${edu.field}` : ''}</span>
      </div>
      ${edu.institution ? `<div class="item-subtitle">${edu.institution}</div>` : ''}
    </div>
    `).join('')}
  </div>
</div>
` : ''}

${sections.certifications.length > 0 ? `
<div class="section">
  <h2 class="section-title">Certifications & Professional Development</h2>
  <div class="section-content">
    ${sections.certifications.map(cert => `
    <div class="cert-item">
      <strong>${cert.name}</strong>${cert.issuer ? ` - ${cert.issuer}` : ''}
      ${cert.status === 'In Progress' ? ' <span class="cert-status">(In Progress)</span>' : ''}
    </div>
    `).join('')}
  </div>
</div>
` : ''}

${(sections.skills.technical.length > 0 || sections.skills.tools.length > 0 || sections.skills.frameworks.length > 0) ? `
<div class="section">
  <h2 class="section-title">Technical Proficiencies</h2>
  <div class="section-content">
    <div class="skills-container">
      ${sections.skills.technical.length > 0 ? `
      <div class="skill-category">
        <div class="skill-category-title">Infrastructure & Systems</div>
        <div class="skills-grid">
          ${[...new Set(sections.skills.technical)].map(skill => `<span class="skill-item">${skill}</span>`).join('')}
        </div>
      </div>
      ` : ''}
      ${sections.skills.tools.length > 0 ? `
      <div class="skill-category">
        <div class="skill-category-title">Enterprise Software & Tools</div>
        <div class="skills-grid">
          ${[...new Set(sections.skills.tools)].map(skill => `<span class="skill-item">${skill}</span>`).join('')}
        </div>
      </div>
      ` : ''}
      ${sections.skills.frameworks.length > 0 ? `
      <div class="skill-category">
        <div class="skill-category-title">Programming & Scripting</div>
        <div class="skills-grid">
          ${[...new Set(sections.skills.frameworks)].map(skill => `<span class="skill-item">${skill}</span>`).join('')}
        </div>
      </div>
      ` : ''}
    </div>
  </div>
</div>
` : ''}

</body>
</html>
  `;
  
  return html;
}

/**
 * Convert HTML to PDF using Puppeteer
 */
async function convertToPDF(html) {
  let browser;
  try {
    browser = await puppeteer.launch({ 
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu'
      ]
    });
    
    const page = await browser.newPage();
    await page.setContent(html, { 
      waitUntil: 'networkidle0',
      timeout: 30000
    });
    
    const pdfBuffer = await page.pdf({ 
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
      margin: { 
        top: '15mm',
        right: '15mm',
        bottom: '15mm',
        left: '15mm'
      }
    });
    
    return pdfBuffer.toString('base64');
  } catch (err) {
    console.error('PDF conversion error:', err);
    throw new Error(`PDF conversion failed: ${err.message}`);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

/**
 * Convert HTML to DOCX
 */
async function convertToDOCX(html) {
  try {
    const cleanedHTML = html
      .replace(/<style>[\s\S]*?<\/style>/gi, '')
      .replace(/class="[^"]*"/g, '');
    
    const docxBlob = await asBlob(cleanedHTML, {
      orientation: 'portrait',
      margins: { 
        top: 1440,
        right: 1440,
        bottom: 1440,
        left: 1440
      }
    });
    
    return Buffer.from(await docxBlob.arrayBuffer()).toString('base64');
  } catch (err) {
    console.error('DOCX conversion error:', err);
    throw new Error(`DOCX conversion failed: ${err.message}`);
  }
}

/**
 * Validate resume text
 */
function validateResumeText(text) {
  if (!text || typeof text !== 'string') {
    throw new Error('Resume text must be a non-empty string');
  }
  
  if (text.trim().length < 50) {
    throw new Error('Resume text is too short. Please provide more content.');
  }
  
  return true;
}

/**
 * Main conversion function
 */
async function convertResume(resumeText, format = 'pdf') {
  try {
    validateResumeText(resumeText);
    
    const html = await generateHTML(resumeText);
    
    switch (format.toLowerCase()) {
      case 'pdf':
        return await convertToPDF(html);
      case 'docx':
        return await convertToDOCX(html);
      case 'html':
        return Buffer.from(html).toString('base64');
      default:
        throw new Error(`Unsupported format: ${format}`);
    }
  } catch (err) {
    console.error('Resume conversion error:', err);
    throw err;
  }
}

module.exports = {
  generateHTML,
  convertToPDF,
  convertToDOCX,
  convertResume,
  extractCandidateInfo,
  parseResumeText,
  validateResumeText
};