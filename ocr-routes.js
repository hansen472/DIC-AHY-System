const fs = require('fs');
const path = require('path');
const multer = require('multer');
const axios = require('axios');
const FormData = require('form-data');
const { runOcrValidation } = require('./ocr-validation');

const OCR_SERVICE_URL = 'http://10.5.53.33:5000/recognize';
const FIELDS_JSON_PATH = process.env.OCR_FIELDS_PATH || path.join(__dirname, 'ocr-service', 'fields.json');

const upload = multer({ storage: multer.memoryStorage() });

function atomicWriteJson(filePath, data) {
  const dir = path.dirname(filePath);
  const tmpPath = path.join(dir, `.${path.basename(filePath)}.tmp`);
  const bakPath = `${filePath}.bak`;

  // 如果目标目录不存在则自动创建（避免在新服务器上因缺少 ocr-service 目录而 500）
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), { encoding: 'utf-8' });

  if (fs.existsSync(filePath)) {
    fs.copyFileSync(filePath, bakPath);
  }

  fs.renameSync(tmpPath, filePath);
}

function setupOcrRoutes(app, { requireAuth, requirePermission, getUsername }) {
  // 读取 OCR 字段配置
  app.get('/api/ocr/config', requireAuth, (req, res) => {
    try {
      if (!fs.existsSync(FIELDS_JSON_PATH)) {
        return res.json({ success: false, error: '配置文件不存在' });
      }
      const content = fs.readFileSync(FIELDS_JSON_PATH, { encoding: 'utf-8' });
      const config = JSON.parse(content);
      res.json({ success: true, config });
    } catch (err) {
      console.error('读取 OCR 配置失败:', err);
      res.json({ success: false, error: err.message || '读取配置失败' });
    }
  });

  // 保存 OCR 字段配置
  app.post('/api/ocr/config', requirePermission('ocr_template_design'), (req, res) => {
    try {
      if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
        return res.status(400).json({ success: false, error: '请求体必须是 JSON 对象' });
      }
      atomicWriteJson(FIELDS_JSON_PATH, req.body);
      res.json({ success: true, message: '配置已保存', path: FIELDS_JSON_PATH });
    } catch (err) {
      console.error('保存 OCR 配置失败:', err);
      res.status(500).json({ success: false, error: err.message || '保存配置失败', path: FIELDS_JSON_PATH });
    }
  });

  // 转发图片到 OCR Python 服务
  app.post('/api/ocr/recognize', requirePermission('ocr_recognize'), upload.single('image'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, error: '缺少 image 文件' });
      }

      if (!fs.existsSync(FIELDS_JSON_PATH)) {
        return res.status(400).json({ success: false, error: '本地 OCR 配置不存在' });
      }

      const configContent = fs.readFileSync(FIELDS_JSON_PATH, { encoding: 'utf-8' });

      const form = new FormData();
      form.append('image', req.file.buffer, { filename: req.file.originalname || 'image.jpg' });
      form.append('config', configContent);

      const debug = req.body.debug;
      if (debug === 'true' || debug === 'false') {
        form.append('debug', debug);
      }

      if (req.body.expected_aspect !== undefined && req.body.expected_aspect !== '') {
        form.append('expected_aspect', req.body.expected_aspect);
      }

      if (req.body.corners !== undefined && req.body.corners !== '') {
        form.append('corners', req.body.corners);
      }

      const response = await axios.post(OCR_SERVICE_URL, form, {
        headers: form.getHeaders(),
        timeout: 120000,
        maxContentLength: Infinity,
        maxBodyLength: Infinity
      });

      let result = response.data;
      if (result && result.success) {
        try {
          const config = JSON.parse(configContent);
          result = await runOcrValidation(result, config);
        } catch (validationErr) {
          console.error('OCR 业务校验失败:', validationErr.message);
          result.validation_error = validationErr.message;
        }
      }

      res.json(result);
    } catch (err) {
      console.error('OCR 识别请求失败:', err.message);
      if (err.response && err.response.data) {
        return res.status(err.response.status || 500).json(err.response.data);
      }
      res.status(500).json({ success: false, error: err.message || 'OCR 识别请求失败' });
    }
  });
}

module.exports = { setupOcrRoutes };
