const path = require("path");
require("dotenv").config({ path: "../.env" });

const listName = process.argv[2];

if (!listName || !["sp1", "rj1", "mg1", "es1"].includes(listName)) {
  console.error(
    "Por favor, forneça um nome de lista válido: sp1, rj1, mg1, ou es1"
  );
  process.exit(1);
}

const subdirectory = listName.substring(0, 2);

const csvFilePath = path.join(
  __dirname,
  ".",
  "data",
  subdirectory,
  `${listName}.csv`
);

const outputCsvFilePath = path.join(
  __dirname,
  "..",
  "results",
  `${listName}_output.csv`
);
const summaryOutputCsvFilePath = path.join(
  __dirname,
  "..",
  "results",
  "summary_output.csv"
);

const {
  appendToCSV,
  loadExistingPlaceIds,
  initializeCsvFiles,
  getCsvStringifier,
  readCEPsFromCSV,
} = require("./handlers/csvHandler");
const { getCoordinates, searchValueSERP } = require("./handlers/apiHandler");
const { formatOpeningHours } = require("./utils/format");

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
]);

const summaryCsvStringifier = getCsvStringifier([
  { id: "cep", title: "CEP" },
  { id: "latitude", title: "Latitude" },
  { id: "longitude", title: "Longitude" },
  { id: "status", title: "Status" },
  { id: "num_restaurants", title: "Number of Restaurants" },
]);

initializeCsvFiles(outputCsvFilePath, csvStringifier);
initializeCsvFiles(summaryOutputCsvFilePath, summaryCsvStringifier);

loadExistingPlaceIds(outputCsvFilePath);

async function main() {
  try {
    const ceps = await readCEPsFromCSV(csvFilePath);

    for (const cep of ceps) {
      const { latitude, longitude, city, state, status } = await getCoordinates(
        cep
      );
      let numRestaurants = 0;
      let continueFetching = status === "Success";
      let currentPage = 1;

      while (continueFetching) {
        console.log(
          `Consultando ValueSERP: Coordenadas (${latitude}, ${longitude}), Página ${currentPage}`
        );
        const response = await searchValueSERP(
          latitude,
          longitude,
          currentPage
        );

        if (response && response.places_results) {
          numRestaurants += response.places_results.length;
          response.places_results.forEach((place) => {
            const perDayHours =
              place.opening_hours && place.opening_hours.per_day
                ? formatOpeningHours(place.opening_hours.per_day)
                : "";
            const record = {
              cep,
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
          });

          continueFetching = response.places_results.length === 20;
        } else {
          console.log(
            `ValueSERP Página ${currentPage}: Sem mais resultados ou erro na requisição.`
          );
          continueFetching = false;
        }

        currentPage++;
      }

      const summaryRecord = {
        cep,
        latitude,
        longitude,
        status,
        num_restaurants: numRestaurants,
      };
      appendToCSV(summaryRecord, summaryCsvStringifier, summaryCsvFilePath);
    }
    console.log("Processo concluído.");
  } catch (error) {
    console.error("Erro ao ler CEPs do CSV:", error.message);
  }
}

main().catch(console.error);
