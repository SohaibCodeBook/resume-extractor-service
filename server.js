// server.js
const express = require('express');
const cors = require('cors');
const { calculateATSScore } = require('./services/atsService');
const { analyzeSkills } = require('./services/skillsService');
const { rewriteResumeWithAI } = require('./services/aiService');
const { extractCandidateInfo, generateHTML, convertToPDF, convertToDOCX } = require('./services/converterService');
const { storeInDatabase, getAllResumes, testConnection } = require('./services/databaseService');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Main endpoint: Full resume building pipeline
app.post('/build-resume', async (req, res) => {
  try {
    const { resume, jobDescription } = req.body;

    if (!resume || !jobDescription) {
      return res.status(400).json({
        error: 'Missing required fields: resume and jobDescription'
      });
    }

    console.log('Starting resume building pipeline...');

    // Step 1: Extract candidate information from resume
    console.log('Step 1: Extracting candidate information...');
    const candidateData = extractCandidateInfo(resume);
    console.log('Extracted candidate data:', candidateData);

    // Step 2: Calculate initial ATS score
    console.log('Step 2: Calculating initial ATS score...');
    const atsScoreBefore = await calculateATSScore(resume, jobDescription);

    // Step 3: Analyze skills
    // console.log('Step 3: Analyzing skills...');
    // const skillsAnalysis = await analyzeSkills(resume, jobDescription);

    // Step 4: Rewrite resume with AI
    console.log('Step 4: Rewriting resume with AI...');
    const aiRewrittenResume = await rewriteResumeWithAI(
      resume,
      jobDescription,
    );
    console.log('AI-rewritten resume:', aiRewrittenResume);

    // Step 5: Calculate final ATS score
    console.log('Step 5: Calculating final ATS score...');
    const atsScoreAfter = await calculateATSScore(aiRewrittenResume, jobDescription);

    // Step 6: Generate HTML
    console.log('Step 6: Generating HTML...');
    const resumeHtml = await generateHTML(aiRewrittenResume);

    // Step 7: Convert to PDF
    console.log('Step 7: Converting to PDF...');
    const resumePdf = await convertToPDF(resumeHtml);

    // Step 8: Convert to DOCX
    console.log('Step 8: Converting to DOCX...');
    const resumeDocx = await convertToDOCX(resumeHtml);

    // Step 9: Prepare response data
    const responseData = {
      atsScoreBefore: atsScoreBefore.atsScore,
      atsScoreAfter: atsScoreAfter.atsScore,
      skillsMatch: atsScoreAfter.skillsMatch,
      experienceMatch: atsScoreAfter.experienceMatch,
      missingSkills: atsScoreAfter.missingSkills,
      matchedSkills: atsScoreAfter.matchedSkills,
      missingExperience: atsScoreAfter.missingExperience,
      matchedExperience: atsScoreAfter.matchedExperience,
      summary: atsScoreAfter.summary,
      recommendations: atsScoreAfter.recommendations,
      resumeText: aiRewrittenResume,
      resumeHtml,
      resumePdf,
      resumeDocx,
      metadata: {
        timestamp: new Date().toISOString(),
        improvement: atsScoreAfter.atsScore - atsScoreBefore.atsScore
      }
    };

    // Step 10: Store in database
    console.log('Step 10: Storing in database...');
    const dbRecord = await storeInDatabase(responseData, candidateData);

    console.log('Pipeline completed successfully!');

    res.json({
      ...responseData,
      databaseId: dbRecord.id
    });

  } catch (error) {
    console.error('Error in build-resume pipeline:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});




   
// Endpoint: ATS Score only
app.post('/ats-score', async (req, res) => {
  try {
    const { resume, jobDescription } = req.body;

    if (!resume || !jobDescription) {
      return res.status(400).json({
        error: 'Missing required fields: resume and jobDescription'
      });
    }

    // Call ATS function (returns an object, not an array)
    const atsResult = await calculateATSScore(resume, jobDescription);

    // Map keys to your expected response
    const response = {
      atsScore: atsResult.atsScore,
      skillsMatch: atsResult.skillsMatch,
      experienceMatch: atsResult.experienceMatch,
      missingSkills: atsResult.missingSkills,
      matchedSkills: atsResult.matchedSkills,
      missingExperience: atsResult.missingExperience,
      matchedExperience: atsResult.matchedExperience,
      summary: atsResult.summary,
      recommendations: atsResult.recommendations,
      timestamp: new Date().toISOString()
    };
    console.log("response", response);
    res.json(response);

  } catch (error) {
    console.error('Error calculating ATS score:', error);
    res.status(500).json({
      error: 'Failed to calculate ATS score',
      message: error.message
    });
  }
});


// Endpoint: Convert resume to PDF/DOCX/HTML
app.post('/convert', async (req, res) => {
  try {
    const { resume, format } = req.body;

    if (!resume || !format) {
      return res.status(400).json({
        error: 'Missing required fields: resume and format (pdf, docx, or html)'
      });
    }

    let result;
    const validFormats = ['pdf', 'docx', 'html'];
    const formatLower = format.toLowerCase();
    
    if (!validFormats.includes(formatLower)) {
      return res.status(400).json({
        error: 'Invalid format. Use "pdf", "docx", or "html"'
      });
    }

    console.log(`Converting resume to ${formatLower.toUpperCase()}...`);

    if (formatLower === 'html') {
      // Generate HTML directly
      result = await generateHTML(resume);
      // Convert to base64 for consistent response format
      // result = Buffer.from(result).toString('base64');
    } else if (formatLower === 'pdf') {
      // Generate HTML first, then convert to PDF
      const html = await generateHTML(resume);
      result = await convertToPDF(html);
    } else if (formatLower === 'docx') {
      // Generate HTML first, then convert to DOCX
      const html = await generateHTML(resume);
      result = await convertToDOCX(html);
    }

    res.json({
      format: formatLower,
      data: result,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error converting resume:', error);
    res.status(500).json({
      error: 'Failed to convert resume',
      message: error.message
    });
  }
});

// Database debugging endpoints

// Endpoint: Test database connection
app.get('/db/test', async (req, res) => {
  try {
    const result = await testConnection();
    res.json({
      ...result,
      dbType: process.env.DB_TYPE || 'postgres',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Database connection test failed:', error);
    res.status(500).json({
      connected: false,
      error: error.message,
      dbType: process.env.DB_TYPE || 'postgres',
      timestamp: new Date().toISOString()
    });
  }
});

// Endpoint: List all resumes
app.get('/db/resumes', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const resumes = await getAllResumes(limit);
    
    res.json({
      count: resumes.length,
      resumes,
      dbType: process.env.DB_TYPE || 'postgres',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching resumes:', error);
    res.status(500).json({
      error: 'Failed to fetch resumes',
      message: error.message,
      dbType: process.env.DB_TYPE || 'postgres',
      timestamp: new Date().toISOString()
    });
  }
});

// Endpoint: Get database status and configuration
app.get('/db/status', async (req, res) => {
  try {
    const dbType = process.env.DB_TYPE || 'postgres';
    const config = {
      dbType,
      timestamp: new Date().toISOString()
    };

    // Add relevant config based on DB type (without exposing sensitive info)
    switch (dbType.toLowerCase()) {
      case 'postgres':
        config.hasConnectionString = !!process.env.DATABASE_URL;
        config.connectionStringFormat = process.env.DATABASE_URL ? 
          process.env.DATABASE_URL.replace(/:[^:@]*@/, ':****@') : 'Not set';
        break;
      case 'mongodb':
        config.hasMongoUri = !!process.env.MONGODB_URI;
        config.mongoDb = process.env.MONGODB_DB || 'resume_builder';
        break;
      case 'dataverse':
        config.hasDataverseUrl = !!process.env.DATAVERSE_URL;
        config.hasClientId = !!process.env.DATAVERSE_CLIENT_ID;
        config.hasClientSecret = !!process.env.DATAVERSE_CLIENT_SECRET;
        config.hasTenantId = !!process.env.DATAVERSE_TENANT_ID;
        config.entity = process.env.DATAVERSE_ENTITY || 'cr_resumes';
        break;
    }

    // Test connection
    const connectionTest = await testConnection();
    config.connectionStatus = connectionTest;

    res.json(config);
  } catch (error) {
    console.error('Error getting database status:', error);
    res.status(500).json({
      error: 'Failed to get database status',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Resume Builder API running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});

module.exports = app;