// services/skillsService.js

/**
 * Analyze skills - find matching and missing skills
 * @param {string} resume - Resume text
 * @param {string} jobDescription - Job description text
 * @returns {Object} Skills analysis result
 */
async function analyzeSkills(resume, jobDescription) {
    try {
      const resumeSkills = extractSkills(resume);
      const jobSkills = extractSkills(jobDescription);
      
      // Find matching skills
      const matchingSkills = resumeSkills.filter(skill => 
        jobSkills.some(jobSkill => 
          skill.toLowerCase() === jobSkill.toLowerCase() ||
          skill.toLowerCase().includes(jobSkill.toLowerCase()) ||
          jobSkill.toLowerCase().includes(skill.toLowerCase())
        )
      );
      
      // Find missing skills
      const missingSkills = jobSkills.filter(jobSkill => 
        !resumeSkills.some(resumeSkill => 
          resumeSkill.toLowerCase() === jobSkill.toLowerCase() ||
          resumeSkill.toLowerCase().includes(jobSkill.toLowerCase()) ||
          jobSkill.toLowerCase().includes(resumeSkill.toLowerCase())
        )
      );
      
      // Generate recommendations
      const recommendations = generateRecommendations(
        resume,
        jobDescription,
        matchingSkills,
        missingSkills
      );
      
      return {
        matchingSkills: [...new Set(matchingSkills)],
        missingSkills: [...new Set(missingSkills)],
        recommendations,
        matchRate: jobSkills.length > 0 
          ? Math.round((matchingSkills.length / jobSkills.length) * 100) 
          : 0
      };
      
    } catch (error) {
      console.error('Error analyzing skills:', error);
      throw error;
    }
  }
  
  /**
   * Extract skills from text using pattern matching and common skill databases
   */
  function extractSkills(text) {
    const skills = [];
    const textLower = text.toLowerCase();
    
    // Technical skills database
    const technicalSkills = [
      // Programming Languages
      'javascript', 'python', 'java', 'c++', 'c#', 'ruby', 'php', 'swift',
      'kotlin', 'go', 'rust', 'typescript', 'scala', 'perl', 'r',
      
      // Web Technologies
      'html', 'css', 'react', 'angular', 'vue', 'node.js', 'express',
      'next.js', 'nuxt', 'svelte', 'webpack', 'vite', 'redux', 'mobx',
      
      // Backend & Databases
      'sql', 'postgresql', 'mysql', 'mongodb', 'redis', 'elasticsearch',
      'graphql', 'rest api', 'fastapi', 'django', 'flask', 'spring boot',
      'microservices', 'grpc', 'rabbitmq', 'kafka',
      
      // Cloud & DevOps
      'aws', 'azure', 'gcp', 'docker', 'kubernetes', 'jenkins', 'gitlab',
      'github actions', 'terraform', 'ansible', 'ci/cd', 'devops',
      
      // Mobile
      'react native', 'flutter', 'ios', 'android', 'xamarin',
      
      // Data & AI
      'machine learning', 'deep learning', 'tensorflow', 'pytorch',
      'scikit-learn', 'pandas', 'numpy', 'data analysis', 'nlp',
      'computer vision', 'ai', 'ml',
      
      // Testing
      'jest', 'mocha', 'pytest', 'selenium', 'cypress', 'unit testing',
      'integration testing', 'tdd', 'bdd',
      
      // Tools
      'git', 'jira', 'confluence', 'slack', 'figma', 'postman',
      'vs code', 'intellij',
      
      // Methodologies
      'agile', 'scrum', 'kanban', 'waterfall', 'lean'
    ];
    
    // Soft skills
    const softSkills = [
      'leadership', 'communication', 'teamwork', 'problem solving',
      'critical thinking', 'time management', 'adaptability',
      'collaboration', 'project management', 'mentoring'
    ];
    
    const allSkills = [...technicalSkills, ...softSkills];
    
    // Extract skills found in text
    allSkills.forEach(skill => {
      // Check for exact match or word boundary match
      const pattern = new RegExp(`\\b${skill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
      if (pattern.test(textLower)) {
        skills.push(skill);
      }
    });
    
    // Extract skills from common patterns
    const patterns = [
      /(?:proficient in|experience with|skilled in|knowledge of)\s+([^.,;]+)/gi,
      /(?:technologies|skills):\s*([^.]+)/gi
    ];
    
    patterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const extractedSkills = match[1]
          .split(/[,;&]/)
          .map(s => s.trim())
          .filter(s => s.length > 2 && s.length < 30);
        skills.push(...extractedSkills);
      }
    });
    
    // Remove duplicates and return
    return [...new Set(skills)];
  }
  
  /**
   * Generate actionable recommendations
   */
  function generateRecommendations(resume, jobDescription, matchingSkills, missingSkills) {
    const recommendations = [];
    const resumeLower = resume.toLowerCase();
    const jobLower = jobDescription.toLowerCase();
    
    // Missing skills recommendations
    if (missingSkills.length > 0) {
      recommendations.push(
        `Add experience with: ${missingSkills.slice(0, 5).join(', ')}`
      );
    }
    
    // Check for metrics
    if (!/\d+%|\d+ percent|increased by|reduced by|improved/i.test(resume)) {
      recommendations.push(
        'Add quantifiable metrics to demonstrate impact (e.g., "Increased performance by 40%")'
      );
    }
    
    // Check for action verbs
    const actionVerbs = /\b(led|managed|developed|created|implemented|designed|optimized|improved)\b/gi;
    const actionVerbCount = (resume.match(actionVerbs) || []).length;
    if (actionVerbCount < 5) {
      recommendations.push(
        'Use more action verbs (led, managed, developed, implemented, optimized)'
      );
    }
    
    // Check for leadership indicators
    if (/\b(team lead|manager|senior|principal|architect|mentor)\b/i.test(jobLower) &&
        !/\b(led|managed|mentored|supervised)\b/i.test(resumeLower)) {
      recommendations.push(
        'Highlight leadership experience and team management skills'
      );
    }
    
    // Check for project details
    if (!/\bproject\b/i.test(resumeLower)) {
      recommendations.push(
        'Include specific projects that demonstrate your skills'
      );
    }
    
    // Check for certifications
    if (/\b(certified|certification|aws|azure|pmp)\b/i.test(jobLower) &&
        !/\b(certified|certification)\b/i.test(resumeLower)) {
      recommendations.push(
        'Consider adding relevant certifications if you have them'
      );
    }
    
    // Check resume length
    const wordCount = resume.split(/\s+/).length;
    if (wordCount < 200) {
      recommendations.push(
        'Expand your resume with more details about your experience and achievements'
      );
    } else if (wordCount > 800) {
      recommendations.push(
        'Consider condensing your resume to focus on most relevant experiences'
      );
    }
    
    // Industry-specific keywords
    if (/\b(startup|fast-paced)\b/i.test(jobLower) &&
        !/\b(agile|fast-paced|startup|dynamic)\b/i.test(resumeLower)) {
      recommendations.push(
        'Emphasize agility and ability to work in fast-paced environments'
      );
    }
    
    return recommendations.slice(0, 6); // Return top 6 recommendations
  }
  
  module.exports = {
    analyzeSkills
  };