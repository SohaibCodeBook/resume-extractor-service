const path = require('path');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const parseRTF = require('rtf-parser');

const SUPPORTED_EXTENSIONS = new Set(['.pdf', '.docx', '.rtf']);

class ExtractorError extends Error {
  constructor(message, code, statusCode = 400) {
    super(message);
    this.name = 'ExtractorError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

function normalizeExtension(filenameOrExtension) {
  const ext = filenameOrExtension.includes('.')
    ? path.extname(filenameOrExtension)
    : filenameOrExtension.startsWith('.')
      ? filenameOrExtension
      : `.${filenameOrExtension}`;
  return ext.toLowerCase();
}

async function extractPdf(buffer) {
  const data = await pdfParse(buffer);
  return data.text === undefined ? '' : data.text;
}

async function extractDocx(buffer) {
  const { value } = await mammoth.extractRawText({ buffer });
  return value === undefined ? '' : value;
}

function rtfDocumentToText(doc) {
  const lines = [];
  for (const para of doc.content || []) {
    let line = '';
    for (const span of para.content || []) {
      if (span.value) {
        line += span.value;
      }
    }
    lines.push(line);
  }
  return lines.join('\n');
}

function extractRtf(buffer) {
  return new Promise((resolve, reject) => {
    parseRTF.string(buffer.toString('utf8'), (err, doc) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(rtfDocumentToText(doc));
    });
  });
}

async function extractFromBuffer(buffer, filenameOrExtension) {
  const ext = normalizeExtension(filenameOrExtension);

  if (!ext || ext === '.' || !SUPPORTED_EXTENSIONS.has(ext)) {
    throw new ExtractorError(
      `Unsupported format. Supported: ${[...SUPPORTED_EXTENSIONS].join(', ')}`,
      'UNSUPPORTED_FORMAT',
      400
    );
  }

  try {
    switch (ext) {
      case '.pdf':
        return await extractPdf(buffer);
      case '.docx':
        return await extractDocx(buffer);
      case '.rtf':
        return await extractRtf(buffer);
      default:
        throw new ExtractorError(
          `Unsupported format. Supported: ${[...SUPPORTED_EXTENSIONS].join(', ')}`,
          'UNSUPPORTED_FORMAT',
          400
        );
    }
  } catch (err) {
    if (err instanceof ExtractorError) {
      throw err;
    }
    throw new ExtractorError(
      err.message || 'Failed to extract text from file',
      'EXTRACTION_FAILED',
      500
    );
  }
}

async function extractFromUpload(file) {
  if (!file || !file.buffer) {
    throw new ExtractorError(
      "Missing multipart field 'file'",
      'MISSING_FILE',
      400
    );
  }
  return extractFromBuffer(file.buffer, file.originalname || '');
}

module.exports = {
  ExtractorError,
  extractFromBuffer,
  extractFromUpload
};
