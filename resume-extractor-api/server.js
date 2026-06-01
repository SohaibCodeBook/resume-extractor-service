const express = require('express');
const cors = require('cors');
const multer = require('multer');
const {
  ExtractorError,
  extractFromUpload
} = require('./services/extractorService');

const app = express();
const PORT = process.env.PORT || 4002;

function parseMaxFileSize() {
  const raw = process.env.MAX_FILE_SIZE;
  if (!raw) {
    return '10mb';
  }
  const numeric = Number(raw);
  if (!Number.isNaN(numeric) && numeric > 0) {
    return numeric;
  }
  return raw;
}

const maxFileSize = parseMaxFileSize();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: maxFileSize }
});

app.use(cors());

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString()
  });
});

app.post('/extract', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        error: "Missing multipart field 'file'",
        code: 'MISSING_FILE'
      });
    }

    const resume = await extractFromUpload(req.file);
    res.json({ resume });
  } catch (err) {
    if (err instanceof ExtractorError) {
      return res.status(err.statusCode).json({
        error: err.message,
        code: err.code
      });
    }

    console.error('Error in POST /extract:', err);
    res.status(500).json({
      error: err.message || 'Unexpected extraction error',
      code: 'EXTRACTION_FAILED'
    });
  }
});

app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({
        error: 'File too large',
        code: 'FILE_TOO_LARGE'
      });
    }
    return res.status(400).json({
      error: err.message,
      code: err.code || 'UPLOAD_ERROR'
    });
  }

  console.error('Unhandled error:', err);
  res.status(500).json({
    error: err.message || 'Internal server error',
    code: 'INTERNAL_ERROR'
  });
});

const server = app.listen(PORT, () => {
  console.log(`Resume Extractor API running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(
      `Port ${PORT} is already in use. Set PORT in .env to another value (e.g. 4003) and retry.`
    );
    process.exit(1);
  }
  throw err;
});

module.exports = app;
