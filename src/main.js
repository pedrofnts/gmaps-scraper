const path = require("path");
const fs = require("fs");

require("dotenv").config({ path: "../.env" });

const state = process.argv[2];

if (!state) {
  console.error(
    "Por favor, forneça um UF de estado válido. Exemplo: ac, al, ap..."
  );
  process.exit(1);
}

const jsonFilePath = path.join(__dirname, ".", "data", `${state}.json`);

const outputCsvFilePath = path.join(
  __dirname,
  "..",
  "results",
  `${state}_output.csv`
);
const summaryOutputCsvFilePath = path.join(
  __dirname,
  "..",
  "results",
  `summary_output_${process.pid}.csv`
);

const {
  appendToCSV,
  loadExistingPlaceIds,
  initializeCsvFiles,
  getCsvStringifier,
  readCEPsFromJSON,
  existingPlaceIds,
} = require("./handlers/csvHandler");
const { getCoordinates, searchValueSERP } = require("./handlers/apiHandler");

const csvStringifier = getCsvStringifier([
  { id: "cep", title: "CEP" },
  { id: "position", title: "Position" },
  { id: "title", title: "Title" },
  { id: "link", title: "Link" },
  { id: "place_id", title: "Place ID" },
  { id: "address", title: "Address" },
  { id: "city", title: "City" },
  { id: "state", title: "State" },
  { id: "phone", title: "Phone" },
  { id: "rating", title: "Rating" },
  { id: "reviews", title: "Reviews" },
  { id: "latitude", title: "Latitude" },
  { id: "longitude", title: "Longitude" },
  { id: "uf", title: "UF" },
  { id: "location", title: "Location" },
]);

const summaryCsvStringifier = getCsvStringifier([
  { id: "cep", title: "CEP" },
  { id: "latitude", title: "Latitude" },
  { id: "longitude", title: "Longitude" },
  { id: "status", title: "Status" },
  { id: "num_restaurants", title: "Number of Restaurants" },
  { id: "uf", title: "UF" },
  { id: "location", title: "Location" },
]);

initializeCsvFiles(outputCsvFilePath, csvStringifier);
initializeCsvFiles(summaryOutputCsvFilePath, summaryCsvStringifier);

loadExistingPlaceIds(outputCsvFilePath);

function loadExistingCEPs(filePath) {
  let existingCEPs = new Set();
  if (fs.existsSync(filePath)) {
    const data = fs.readFileSync(filePath, "utf8");
    const lines = data.split("\n");
    lines.forEach((line) => {
      const columns = line.split(",");
      if (columns.length > 0) {
        existingCEPs.add(columns[0]);
      }
    });
  }
  return existingCEPs;
}

async function main() {
  try {
    const ceps = await readCEPsFromJSON(jsonFilePath);
    const existingCEPs = loadExistingCEPs(summaryOutputCsvFilePath);

    let previousCep = 0;
    let originalCep = 0;

    for (const cepData of ceps) {
      let currentCep = parseInt(cepData.cep);

      if (currentCep - previousCep < 20) {
        originalCep = currentCep;
        currentCep = previousCep + 100;
        cepData.cep = currentCep.toString();
      }

      previousCep = originalCep;

      const coordinates = await getCoordinates(cepData);

      if (
        !coordinates ||
        coordinates.latitude === null ||
        coordinates.longitude === null
      ) {
        console.log(`Pulando CEP ${cepData.cep} devido a erro.`);
        continue;
      }
      let skipCep = false;
      let reasonForSkipping = "";
      let numRestaurants = 0;

      if (existingCEPs.has(cepData.cep)) {
        reasonForSkipping = "CEP já existe no resumo";
        skipCep = true;
      }

      let latitude = "N/A"; // Valor padrão
      let longitude = "N/A"; // Valor padrão
      let status = "Unknown"; // Valor padrão

      if (!skipCep) {
        const coords = await getCoordinates(cepData);
        if (
          coords.status !== "Success" ||
          coords.latitude === undefined ||
          coords.longitude === undefined
        ) {
          reasonForSkipping = "Coordenadas não disponíveis ou undefined";
          skipCep = true;
        } else {
          latitude = coords.latitude;
          longitude = coords.longitude;
        }

        let continueFetching = !skipCep;
        let currentPage = 1;
        let existingPlaceIdCount = 0;

        while (continueFetching) {
          const response = await searchValueSERP(
            cepData.cep,
            latitude,
            longitude,
            currentPage
          );

          if (response && response.places_results) {
            let newPlaceIdFound = false;

            for (const place of response.places_results) {
              if (!place.place_id) {
                console.log("Place ID undefined encontrado na resposta da API");
                continue;
              }

              if (!existingPlaceIds.has(place.place_id)) {
                newPlaceIdFound = true;
                const record = {
                  cep: cepData.cep,
                  position: place.position,
                  title: place.title,
                  link: place.link,
                  place_id: place.place_id,
                  address: place.address,
                  city,
                  state,
                  phone: place.phone,
                  rating: place.rating,
                  reviews: place.reviews,
                  latitude: place.gps_coordinates.latitude,
                  longitude: place.gps_coordinates.longitude,
                };
                appendToCSV(record, csvStringifier, outputCsvFilePath);
                existingPlaceIds.add(place.place_id);
              } else {
                existingPlaceIdCount++;
              }
            }

            numRestaurants += response.places_results.length;
            continueFetching =
              newPlaceIdFound &&
              response.places_results.length === 20 &&
              existingPlaceIdCount <= 15;
            currentPage++;
          } else {
            continueFetching = false;
          }
        }
      }

      const summaryRecord = {
        cep: cepData.cep,
        latitude: skipCep ? "N/A" : latitude,
        longitude: skipCep ? "N/A" : longitude,
        status: skipCep ? "Skipped: " + reasonForSkipping : status,
        num_restaurants: numRestaurants,
        uf: cepData.uf,
        location: cepData.location,
      };
      appendToCSV(
        summaryRecord,
        summaryCsvStringifier,
        summaryOutputCsvFilePath
      );
      existingCEPs.add(cepData.cep);
    }
    console.log("Processo concluído.");
  } catch (error) {
    console.error("Erro ao ler CEPs do JSON:", error.message);
  }
}

main().catch(console.error);
