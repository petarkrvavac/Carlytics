const UTF8_BOM = "\ufeff";

function escapeCsvCell(value) {
  if (value === null || value === undefined) {
    return "";
  }

  const normalized = String(value).replace(/\r?\n/g, " ");

  if (/[",;]/.test(normalized)) {
    return `"${normalized.replace(/"/g, '""')}"`;
  }

  return normalized;
}

function buildCsv(headers, rows) {
  const lines = [
    headers.map(escapeCsvCell).join(";"),
    ...rows.map((row) => row.map(escapeCsvCell).join(";")),
  ];

  return `${UTF8_BOM}${lines.join("\n")}\n`;
}

module.exports = {
  buildCsv,
  escapeCsvCell,
  UTF8_BOM,
};
