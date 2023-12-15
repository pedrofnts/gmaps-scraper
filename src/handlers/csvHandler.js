const fs = require("fs");
const createCsvStringifier = require("csv-writer").createObjectCsvStringifier;
const path = require("path");
const csv = require("csv-parser");

let existingPlaceIds = new Set();

function readCEPsFromCSV(filePath) {
  return new Promise((resolve, reject) => {
    const ceps = [];
    fs.createReadStream(filePath)
      .pipe(csv())
      .on("data", (row) => {
        ceps.push(row.cep);
      })
      .on("end", () => {
        resolve(ceps);
      })
      .on("error", reject);
  });
}

function loadExistingPlaceIds(filePath) {
  console.log(`Loading existing place IDs from ${filePath}`);

  if (fs.existsSync(filePath)) {
    const data = fs.readFileSync(filePath, "utf8");
    const lines = data.split("\n");
    lines.forEach((line) => {
      const columns = line.split(",");
      if (columns.length > 4) {
        existingPlaceIds.add(columns[4]);
      }
    });
  }
}

function appendToCSV(record, stringifier, filePath) {
  if (!existingPlaceIds.has(record.place_id)) {
    console.log(`Appending record for place ID: ${record.place_id}`);
    fs.appendFile(filePath, stringifier.stringifyRecords([record]), (err) => {
      if (err) throw err;
    });
    existingPlaceIds.add(record.place_id);
  }

  try {
    fs.appendFileSync(filePath, stringifier.stringifyRecords([record]));
    existingPlaceIds.add(record.place_id);
  } catch (err) {
    console.error("Error writing to CSV file:", err);
  }
}

function initializeCsvFiles(filePath, stringifier) {
  const dir = path.dirname(filePath);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  if (!fs.existsSync(filePath)) {
    console.log(`Initializing CSV file at: ${filePath}`);

    const headerString = stringifier.getHeaderString();
    if (headerString) {
      fs.writeFileSync(filePath, headerString);
    } else {
      console.error(
        "Erro: headerString está nulo. Verifique os cabeçalhos do CSV."
      );
    }
  }
}

function readCsvFile(filePath) {
  if (fs.existsSync(filePath)) {
    return fs.readFileSync(filePath, "utf8");
  } else {
    return null;
  }
}

function writeCsvFile(records, stringifier, filePath) {
  console.log(`Writing records to CSV file at: ${filePath}`);

  const csvContent = stringifier.stringifyRecords(records);
  fs.writeFileSync(filePath, csvContent);
}

function getCsvStringifier(headers) {
  return createCsvStringifier({
    header: headers,
  });
}

module.exports = {
  readCEPsFromCSV,
  loadExistingPlaceIds,
  appendToCSV,
  initializeCsvFiles,
  readCsvFile,
  writeCsvFile,
  getCsvStringifier,
};
