const express = require("express");
const cors = require("cors");
const crypto = require("crypto");
require("dotenv").config({ path: "../../.env" });
const db = require("../../../shared/src/db");
const { createAuditMiddleware } = require("../../../shared/src/audit");

const app = express();
app.use(cors());
app.use(express.json());
app.use(createAuditMiddleware("biometric-service"));

const ENCRYPTION_KEY = process.env.DATA_ENCRYPTION_KEY || "";

const getKeyBuffer = () => {
  if (!ENCRYPTION_KEY || ENCRYPTION_KEY.length !== 64) return null;
  return Buffer.from(ENCRYPTION_KEY, "hex");
};

const encryptJson = (payload) => {
  const key = getKeyBuffer();
  if (!key) return null;

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(payload || {}), "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return `${iv.toString("hex")}:${encrypted.toString("hex")}:${authTag.toString("hex")}`;
};

const normalizeEvent = (item, fallback) => ({
  employee_code: item.employee_code || fallback.employee_code,
  scanner_id: item.scanner_id || fallback.scanner_id || null,
  punch_type: item.punch_type || fallback.punch_type || "VERIFY",
  device_timestamp: item.device_timestamp || fallback.device_timestamp,
  payload: item.payload || fallback.payload || {},
  source_type: item.source_type || fallback.source_type || "biometric",
  source_ref: item.source_ref || fallback.source_ref || null,
  ingested_by: item.ingested_by || fallback.ingested_by || "system"
});

app.post("/api/biometric/ingest", async (req, res) => {
  const sourceType = req.body.source_type || "api";
  const items = Array.isArray(req.body.records) ? req.body.records : [req.body];
  const ingestedBy = req.headers["x-user-name"] || req.body.ingested_by || "system";
  const normalized = items.map((item) =>
    normalizeEvent(item, { source_type: sourceType, ingested_by: ingestedBy })
  );

  for (const item of normalized) {
    if (!item.employee_code || !item.device_timestamp) {
      return res.status(400).json({ message: "employee_code and device_timestamp are required for all records" });
    }
  }

  const values = normalized.map((item) => [
    item.employee_code,
    item.scanner_id,
    item.punch_type,
    item.device_timestamp,
    JSON.stringify(item.payload || {}),
    encryptJson(item.payload || {}),
    item.source_type,
    item.source_ref,
    item.ingested_by
  ]);

  await db.query(
    `INSERT INTO biometric_events(
       employee_code, scanner_id, punch_type, device_timestamp, payload, payload_encrypted,
       source_type, source_ref, ingested_by
     ) VALUES ?`,
    [values]
  );

  res.status(201).json({ message: "records captured", count: normalized.length });
});

app.post("/api/biometric/punch", async (req, res) => {
  const { employee_code, scanner_id, punch_type, device_timestamp, payload } = req.body;

  if (!employee_code || !device_timestamp) {
    return res.status(400).json({ message: "employee_code and device_timestamp are required" });
  }

  await db.query(
    `INSERT INTO biometric_events(
       employee_code, scanner_id, punch_type, device_timestamp, payload, payload_encrypted,
       source_type, source_ref, ingested_by
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      employee_code,
      scanner_id || null,
      punch_type || "VERIFY",
      device_timestamp,
      JSON.stringify(payload || {}),
      encryptJson(payload || {}),
      "biometric",
      null,
      req.headers["x-user-name"] || "scanner"
    ]
  );

  res.status(201).json({ message: "punch captured" });
});

app.get("/health", (_, res) => res.json({ status: "ok", service: "biometric" }));

const PORT = process.env.BIOMETRIC_SERVICE_PORT || 5004;
app.listen(PORT, () => {
  console.log(`Biometric service running on ${PORT}`);
});
