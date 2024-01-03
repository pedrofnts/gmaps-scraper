const path = require("path");

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

const {
  appendToCSV,
  initializeCsvFiles,
  loadExistingPlaceIds,
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

initializeCsvFiles(outputCsvFilePath, csvStringifier);

loadExistingPlaceIds(outputCsvFilePath);

async function main() {
  try {
    const ceps = await readCEPsFromJSON(jsonFilePath);

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

      const coords = await getCoordinates(cepData);

      if (!coords || coords.latitude === null || coords.longitude === null) {
        console.log(`Pulando CEP ${cepData.cep} devido a erro.`);
        continue;
      }

      let skipCep = false;
      let latitude = "N/A";
      let longitude = "N/A";
      let city = "Desconhecida";
      let state = "Desconhecido";

      if (!skipCep) {
        if (
          coords.status !== "Success" ||
          !coords.latitude ||
          !coords.longitude
        ) {
          skipCep = true;
        } else {
          latitude = coords.latitude;
          longitude = coords.longitude;
          city = coords.city;
          state = coords.state;
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
    }
    console.log("Processo concluído.");
  } catch (error) {
    console.error("Erro ao ler CEPs do JSON:", error.message);
  }
}

main().catch(console.error);
