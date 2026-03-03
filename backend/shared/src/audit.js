const db = require("./db");

const scrubBody = (body) => {
  if (!body || typeof body !== "object") return null;
  const copy = { ...body };
  if ("password" in copy) copy.password = "***";
  if ("token" in copy) copy.token = "***";
  return copy;
};

function createAuditMiddleware(serviceName) {
  return (req, res, next) => {
    if (req.path === "/health") return next();

    const startedAt = Date.now();
    const requestBody = scrubBody(req.body);
    const requestQuery = req.query || null;
    const requestParams = req.params || null;

    res.on("finish", async () => {
      try {
        await db.query(
          `INSERT INTO audit_logs(
             service_name, request_id, actor_user_id, actor_role, actor_username,
             method, endpoint, status_code, ip_address, user_agent, duration_ms, request_payload
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            serviceName,
            req.headers["x-request-id"] || null,
            req.headers["x-user-id"] || null,
            req.headers["x-user-role"] || null,
            req.headers["x-user-name"] || null,
            req.method,
            req.originalUrl,
            res.statusCode,
            req.headers["x-forwarded-for"] || req.socket.remoteAddress || null,
            req.headers["user-agent"] || null,
            Date.now() - startedAt,
            JSON.stringify({ body: requestBody, query: requestQuery, params: requestParams })
          ]
        );
      } catch (_) {
        // Audit log failures should not break business APIs.
      }
    });

    next();
  };
}

module.exports = { createAuditMiddleware };
