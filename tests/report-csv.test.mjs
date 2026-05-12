import assert from "node:assert/strict";

import csvModule from "../src/lib/reports/csv.js";

const { buildCsv, UTF8_BOM } = csvModule;

const csv = buildCsv(
  ["Vehicle ID", "Opis", "Cijena EUR"],
  [
    [1, 'Redovni servis; zamjena "filtera"', 125.5],
    [2, "Opis\nu dva reda", 90],
  ],
);

assert.ok(csv.startsWith(UTF8_BOM), "CSV mora poceti UTF-8 BOM-om za Excel.");
assert.ok(!csv.startsWith("ID"), "CSV ne smije poceti s ID jer Excel to zna prepoznati kao SYLK.");
assert.ok(!csv.startsWith(`${UTF8_BOM}ID`), "Prvi header ne smije biti samo ID.");
assert.match(csv, /^\uFEFFVehicle ID;Opis;Cijena EUR/m);
assert.match(csv, /"Redovni servis; zamjena ""filtera"""/);
assert.match(csv, /Opis u dva reda/);

console.log("report-csv tests passed");
