const fs = require("fs");
const createCsvStringifier = require("csv-writer").createObjectCsvStringifier;
const path = require("path");

let existingPlaceIds = new Set();

function readCEPsFromJSON(filePath) {
  return new Promise((resolve, reject) => {
    fs.readFile(filePath, (err, data) => {
      if (err) {
        reject(err);
        return;
      }
      const json = JSON.parse(data);
      const ceps = [];
      for (const uf in json) {
        for (const location in json[uf]) {
          const cepsInLocation = json[uf][location];
          for (const cep of cepsInLocation) {
            ceps.push({ cep, uf, location });
          }
        }
      }
      resolve(ceps);
    });
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
        existingPlaceIds.add(columns[4]); // Atualiza o conjunto existente
      }
    });
  }
}

function appendToCSV(record, stringifier, filePath) {
  if (existingPlaceIds.has(record.place_id)) {
    console.log(`Place ID ${record.place_id} já existe, pulando.`);
    return;
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

function getCsvStringifier(headers) {
  return createCsvStringifier({
    header: headers,
  });
}

module.exports = {
  readCEPsFromJSON,
  loadExistingPlaceIds,
  appendToCSV,
  initializeCsvFiles,
  getCsvStringifier,
  existingPlaceIds,
  loadExistingPlaceIds,
};
