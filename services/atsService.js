// services/atsService.js
const natural = require('natural');
const { callMistral } = require('./aiService');
const TfIdf = natural.TfIdf;

/**
 * Calculate ATS score using TF-IDF and cosine similarity
 * @param {string} resume - Resume text
 * @param {string} jobDescription - Job description text
 * @returns {number} Score between 0-100
 */
async function calculateATSScore(resume, jobDescription) {
 try {
  const prompt = `You are an expert ATS (Applicant Tracking System) analyzer. Your task is to analyze a resume against a job description and provide a detailed scoring analysis.

CRITICAL: You must return ONLY valid JSON. Do not include any markdown formatting, explanations, or text outside the JSON structure. Do not wrap the response in code blocks or backticks.

Analysis Requirements:
1. Calculate an overall match score (0-100) based on skills, experience, and keyword alignment
2. Categorize skill matches into strong (direct match), medium (related/transferable), and weak (tangential)
3. Categorize experience matches into strong (directly relevant), medium (somewhat relevant), and weak (minimally relevant)
4. Identify missing critical skills and experiences
5. Provide actionable recommendations for improvement

Return ONLY the following JSON structure with no additional text:

{
  "overall_score": <number between 0-100>,
  "skills_match": {
    "strong_match": ["<skill1>", "<skill2>"],
    "medium_match": ["<skill1>", "<skill2>"],
    "weak_match": ["<skill1>", "<skill2>"]
  },
  "experience_match": {
    "strong_match": ["<experience1>", "<experience2>"],
    "medium_match": ["<experience1>", "<experience2>"],
    "weak_match": ["<experience1>", "<experience2>"]
  },
  "missing_skills": ["<skill1>", "<skill2>"],
  "matched_skills": ["<skill1>", "<skill2>"],
  "missing_experience": ["<experience1>", "<experience2>"],
  "matched_experience": ["<experience1>", "<experience2>"],
  "summary": "<brief 2-3 sentence overview of the match quality>",
  "recommendations": ["<recommendation1>", "<recommendation2>", "<recommendation3>"]
}

Resume:
${resume}

Job Description:
${jobDescription}

Remember: Output ONLY the JSON object. No markdown, no code blocks, no explanatory text before or after.`
  const response = await callMistral(prompt);
  // console.log("response", response);
  
  // Parse the JSON response from the AI
  let parsedResponse;
  try {
    // Extract JSON from the response if it contains extra text
    const jsonMatch = response.match(/```json\n([\s\S]*?)\n```/) || response.match(/\{[\s\S]*\}/);
    const jsonString = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : response;
    parsedResponse = JSON.parse(jsonString);
    console.log("parsedResponse", parsedResponse);
  } catch (parseError) {
    console.error('Error parsing JSON response:', parseError);
    console.error('Raw response:', response);
    throw new Error('Failed to parse AI response as JSON');
  }
  
  const atsScore = parsedResponse.overall_score;
  const skillsMatch = parsedResponse.skills_match;
  const experienceMatch = parsedResponse.experience_match;
  const missingSkills = parsedResponse.missing_skills;
  const matchedSkills = parsedResponse.matched_skills;
  const missingExperience = parsedResponse.missing_experience;
  const matchedExperience = parsedResponse.matched_experience;
  const summary = parsedResponse.summary;
  const recommendations = parsedResponse.recommendations;
  return { atsScore, skillsMatch, experienceMatch, missingSkills, matchedSkills, missingExperience, matchedExperience, summary, recommendations };
 } catch (error) {
  console.error('Error calculating ATS score:', error);
  throw error;
 }
}

module.exports = {
  calculateATSScore
};