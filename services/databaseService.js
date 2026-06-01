// services/databaseService.js
const axios = require('axios');

/**
 * Store resume data in database
 * Supports: PostgreSQL, MongoDB, Dataverse API
 * @param {Object} resumeData - Resume data to store
 * @param {Object} candidateData - Candidate information
 * @returns {Object} Database record info
 */
async function storeInDatabase(resumeData, candidateData = {}) {
  const dbType = process.env.DB_TYPE || 'postgres'; // postgres, mongodb, dataverse
  
  try {
    switch (dbType.toLowerCase()) {
      case 'postgres':
        return await storeInPostgres(resumeData, candidateData);
      case 'mongodb':
        return await storeInMongoDB(resumeData, candidateData);
      case 'dataverse':
        return await storeInDataverse(resumeData, candidateData);
      default:
        console.log('No database configured, storing in memory');
        return { id: generateId(), stored: false, message: 'No database configured' };
    }
  } catch (error) {
    console.error('Error storing in database:', error);
    // Don't throw - we don't want to fail the whole pipeline if DB is down
    return { id: generateId(), stored: false, error: error.message };
  }
}

/**
 * Store in PostgreSQL
 */
async function storeInPostgres(resumeData, candidateData) {
  const { Pool } = require('pg');
  
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });
  
  try {
    // Create table if not exists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS resumes (
        id SERIAL PRIMARY KEY,
        candidate_name VARCHAR(255),
        candidate_email VARCHAR(255),
        ats_score_before INTEGER,
        ats_score_after INTEGER,
        skills_match JSONB,
        experience_match JSONB,
        missing_skills JSONB,
        matched_skills JSONB,
        missing_experience JSONB,
        matched_experience JSONB,
        summary TEXT,
        recommendations JSONB,
        resume_text TEXT,
        resume_html TEXT,
        resume_pdf TEXT,
        resume_docx TEXT,
        metadata JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Insert record
    const result = await pool.query(`
      INSERT INTO resumes (
        candidate_name, candidate_email, ats_score_before, ats_score_after,
        skills_match, experience_match, missing_skills, matched_skills,
        missing_experience, matched_experience, summary, recommendations,
        resume_text, resume_html, resume_pdf, resume_docx, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
      RETURNING id
    `, [
      candidateData.name || 'Unknown',
      candidateData.email || 'N/A',
      resumeData.atsScoreBefore,
      resumeData.atsScoreAfter,
      JSON.stringify(resumeData.skillsMatch),
      JSON.stringify(resumeData.experienceMatch),
      JSON.stringify(resumeData.missingSkills),
      JSON.stringify(resumeData.matchedSkills),
      JSON.stringify(resumeData.missingExperience),
      JSON.stringify(resumeData.matchedExperience),
      resumeData.summary,
      JSON.stringify(resumeData.recommendations),
      resumeData.resumeText,
      resumeData.resumeHtml,
      resumeData.resumePdf,
      resumeData.resumeDocx,
      JSON.stringify(resumeData.metadata)
    ]);
    
    await pool.end();
    
    return {
      id: result.rows[0].id,
      stored: true,
      database: 'PostgreSQL'
    };
    
  } catch (error) {
    console.error('PostgreSQL error:', error);
    throw error;
  }
}

/**
 * Store in MongoDB
 */
async function storeInMongoDB(resumeData, candidateData) {
  const { MongoClient } = require('mongodb');
  
  const client = new MongoClient(process.env.MONGODB_URI);
  
  try {
    await client.connect();
    
    const db = client.db(process.env.MONGODB_DB || 'resume_builder');
    const collection = db.collection('resumes');
    
    const document = {
      candidateName: candidateData.name || 'Unknown',
      candidateEmail: candidateData.email || 'N/A',
      candidatePhone: candidateData.phone,
      candidateLocation: candidateData.location,
      atsScoreBefore: resumeData.atsScoreBefore,
      atsScoreAfter: resumeData.atsScoreAfter,
      matchingSkills: resumeData.matchingSkills,
      missingSkills: resumeData.missingSkills,
      recommendations: resumeData.recommendations,
      resumeText: resumeData.resumeText,
      resumeHtml: resumeData.resumeHtml,
      resumePdf: resumeData.resumePdf,
      resumeDocx: resumeData.resumeDocx,
      metadata: resumeData.metadata,
      createdAt: new Date()
    };
    
    const result = await collection.insertOne(document);
    
    await client.close();
    
    return {
      id: result.insertedId.toString(),
      stored: true,
      database: 'MongoDB'
    };
    
  } catch (error) {
    console.error('MongoDB error:', error);
    throw error;
  }
}

/**
 * Store in Microsoft Dataverse
 */
async function storeInDataverse(resumeData, candidateData) {
  const dataverseUrl = process.env.DATAVERSE_URL;
  const accessToken = await getDataverseToken();
  
  if (!dataverseUrl || !accessToken) {
    throw new Error('Dataverse credentials not configured');
  }
  
  try {
    // Dataverse entity name (custom table)
    const entityName = process.env.DATAVERSE_ENTITY || 'cr_resumes';
    
    const data = {
      'cr_candidatename': candidateData.name || 'Unknown',
      'cr_candidateemail': candidateData.email || 'N/A',
      'cr_atsscorebefore': resumeData.atsScoreBefore,
      'cr_atsscoreafter': resumeData.atsScoreAfter,
      'cr_matchingskills': JSON.stringify(resumeData.matchingSkills),
      'cr_missingskills': JSON.stringify(resumeData.missingSkills),
      'cr_recommendations': JSON.stringify(resumeData.recommendations),
      'cr_resumetext': resumeData.resumeText,
      'cr_resumehtml': resumeData.resumeHtml,
      'cr_resumepdf': resumeData.resumePdf,
      'cr_resumedocx': resumeData.resumeDocx,
      'cr_metadata': JSON.stringify(resumeData.metadata)
    };
    
    const response = await axios.post(
      `${dataverseUrl}/api/data/v9.2/${entityName}`,
      data,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'OData-MaxVersion': '4.0',
          'OData-Version': '4.0'
        }
      }
    );
    
    const recordId = response.headers['odata-entityid'].split('(')[1].split(')')[0];
    
    return {
      id: recordId,
      stored: true,
      database: 'Dataverse'
    };
    
  } catch (error) {
    console.error('Dataverse error:', error);
    throw error;
  }
}

/**
 * Get Dataverse access token using client credentials flow
 */
async function getDataverseToken() {
  const clientId = process.env.DATAVERSE_CLIENT_ID;
  const clientSecret = process.env.DATAVERSE_CLIENT_SECRET;
  const tenantId = process.env.DATAVERSE_TENANT_ID;
  const resource = process.env.DATAVERSE_URL;
  
  if (!clientId || !clientSecret || !tenantId) {
    return null;
  }
  
  try {
    const response = await axios.post(
      `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
      new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        scope: `${resource}/.default`,
        grant_type: 'client_credentials'
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );
    
    return response.data.access_token;
    
  } catch (error) {
    console.error('Error getting Dataverse token:', error);
    return null;
  }
}

/**
 * Generate unique ID for fallback
 */
function generateId() {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Retrieve resume from database
 */
async function getResumeById(id) {
  const dbType = process.env.DB_TYPE || 'postgres';
  
  try {
    switch (dbType.toLowerCase()) {
      case 'postgres':
        return await getFromPostgres(id);
      case 'mongodb':
        return await getFromMongoDB(id);
      case 'dataverse':
        return await getFromDataverse(id);
      default:
        return null;
    }
  } catch (error) {
    console.error('Error retrieving from database:', error);
    return null;
  }
}

/**
 * Get from PostgreSQL
 */
async function getFromPostgres(id) {
  const { Pool } = require('pg');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  
  const result = await pool.query('SELECT * FROM resumes WHERE id = $1', [id]);
  await pool.end();
  
  return result.rows[0] || null;
}

/**
 * Get from MongoDB
 */
async function getFromMongoDB(id) {
  const { MongoClient, ObjectId } = require('mongodb');
  const client = new MongoClient(process.env.MONGODB_URI);
  
  await client.connect();
  const db = client.db(process.env.MONGODB_DB || 'resume_builder');
  const collection = db.collection('resumes');
  
  const document = await collection.findOne({ _id: new ObjectId(id) });
  await client.close();
  
  return document;
}

/**
 * Get from Dataverse
 */
async function getFromDataverse(id) {
  const dataverseUrl = process.env.DATAVERSE_URL;
  const accessToken = await getDataverseToken();
  const entityName = process.env.DATAVERSE_ENTITY || 'cr_resumes';
  
  const response = await axios.get(
    `${dataverseUrl}/api/data/v9.2/${entityName}(${id})`,
    {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'OData-MaxVersion': '4.0',
        'OData-Version': '4.0'
      }
    }
  );
  
  return response.data;
}

/**
 * List all resumes from database
 */
async function getAllResumes(limit = 50) {
  const dbType = process.env.DB_TYPE || 'postgres';
  
  try {
    switch (dbType.toLowerCase()) {
      case 'postgres':
        return await getAllFromPostgres(limit);
      case 'mongodb':
        return await getAllFromMongoDB(limit);
      case 'dataverse':
        return await getAllFromDataverse(limit);
      default:
        return [];
    }
  } catch (error) {
    console.error('Error retrieving all resumes:', error);
    return [];
  }
}

/**
 * Get all from PostgreSQL
 */
async function getAllFromPostgres(limit) {
  const { Pool } = require('pg');
  const pool = new Pool({ 
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });
  
  const result = await pool.query('SELECT * FROM resumes ORDER BY created_at DESC LIMIT $1', [limit]);
  await pool.end();
  
  return result.rows;
}

/**
 * Get all from MongoDB
 */
async function getAllFromMongoDB(limit) {
  const { MongoClient } = require('mongodb');
  const client = new MongoClient(process.env.MONGODB_URI);
  
  await client.connect();
  const db = client.db(process.env.MONGODB_DB || 'resume_builder');
  const collection = db.collection('resumes');
  
  const documents = await collection.find({}).sort({ createdAt: -1 }).limit(limit).toArray();
  await client.close();
  
  return documents;
}

/**
 * Get all from Dataverse
 */
async function getAllFromDataverse(limit) {
  const dataverseUrl = process.env.DATAVERSE_URL;
  const accessToken = await getDataverseToken();
  const entityName = process.env.DATAVERSE_ENTITY || 'cr_resumes';
  
  const response = await axios.get(
    `${dataverseUrl}/api/data/v9.2/${entityName}?$top=${limit}&$orderby=createdon desc`,
    {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'OData-MaxVersion': '4.0',
        'OData-Version': '4.0'
      }
    }
  );
  
  return response.data.value;
}

/**
 * Test database connection
 */
async function testConnection() {
  const dbType = process.env.DB_TYPE || 'postgres';
  
  try {
    switch (dbType.toLowerCase()) {
      case 'postgres':
        return await testPostgresConnection();
      case 'mongodb':
        return await testMongoConnection();
      case 'dataverse':
        return await testDataverseConnection();
      default:
        return { connected: false, message: 'No database type configured' };
    }
  } catch (error) {
    return { connected: false, error: error.message };
  }
}

/**
 * Test PostgreSQL connection
 */
async function testPostgresConnection() {
  const { Pool } = require('pg');
  const pool = new Pool({ 
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });
  
  const result = await pool.query('SELECT NOW() as current_time');
  await pool.end();
  
  return { 
    connected: true, 
    database: 'PostgreSQL',
    currentTime: result.rows[0].current_time 
  };
}

/**
 * Test MongoDB connection
 */
async function testMongoConnection() {
  const { MongoClient } = require('mongodb');
  const client = new MongoClient(process.env.MONGODB_URI);
  
  await client.connect();
  const admin = client.db().admin();
  const status = await admin.serverStatus();
  await client.close();
  
  return { 
    connected: true, 
    database: 'MongoDB',
    version: status.version 
  };
}

/**
 * Test Dataverse connection
 */
async function testDataverseConnection() {
  const accessToken = await getDataverseToken();
  if (!accessToken) {
    throw new Error('Failed to get Dataverse access token');
  }
  
  const dataverseUrl = process.env.DATAVERSE_URL;
  const response = await axios.get(
    `${dataverseUrl}/api/data/v9.2/WhoAmI`,
    {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'OData-MaxVersion': '4.0',
        'OData-Version': '4.0'
      }
    }
  );
  
  return { 
    connected: true, 
    database: 'Dataverse',
    userId: response.data.UserId 
  };
}

module.exports = {
  storeInDatabase,
  getResumeById,
  getAllResumes,
  testConnection
};