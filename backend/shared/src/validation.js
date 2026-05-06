const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_RE = /^\d{4}-\d{2}$/;

function parsePositiveInt(value) {
  const normalized = Number(value);
  if (!Number.isInteger(normalized) || normalized <= 0) return null;
  return normalized;
}

function isIsoDate(value) {
  if (typeof value !== "string" || !DATE_RE.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function isMonthKey(value) {
  if (typeof value !== "string" || !MONTH_RE.test(value)) return false;
  const month = Number(value.slice(5, 7));
  return month >= 1 && month <= 12;
}

function requirePositiveIntParam(req, res, name) {
  const parsed = parsePositiveInt(req.params[name]);
  if (!parsed) {
    res.status(400).json({ message: `${name} must be a positive integer` });
    return null;
  }
  return parsed;
}

function requireDateRange(req, res) {
  const { from, to } = req.query;
  if (!isIsoDate(from) || !isIsoDate(to)) {
    res.status(400).json({ message: "from and to must be valid YYYY-MM-DD dates" });
    return null;
  }
  if (from > to) {
    res.status(400).json({ message: "from must be before or equal to to" });
    return null;
  }
  return { from, to };
}

function optionalMonth(value, fallback) {
  return isMonthKey(value) ? value : fallback;
}

module.exports = {
  isIsoDate,
  isMonthKey,
  optionalMonth,
  parsePositiveInt,
  requireDateRange,
  requirePositiveIntParam
};
