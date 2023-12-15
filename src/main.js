require("dotenv").config({ path: "../.env" });

const {
  appendToCSV,
  loadExistingPlaceIds,
  initializeCsvFiles,
  getCsvStringifier,
} = require("./handlers/csvHandler");
const { getCoordinates, searchValueSERP } = require("./handlers/apiHandler");
const { formatOpeningHours } = require("./utils/format");

const ceps = ["01001000", "01002000", "01008000", "01008000"];

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
  { id: "current_opening_hours", title: "Current Opening Hours" },
  { id: "rating", title: "Rating" },
  { id: "reviews", title: "Reviews" },
  { id: "latitude", title: "Latitude" },
  { id: "longitude", title: "Longitude" },
  { id: "per_day_opening_hours", title: "Per Day Opening Hours" },
]);

const summaryCsvStringifier = getCsvStringifier([
  { id: "cep", title: "CEP" },
  { id: "latitude", title: "Latitude" },
  { id: "longitude", title: "Longitude" },
  { id: "status", title: "Status" },
  { id: "num_restaurants", title: "Number of Restaurants" },
]);

initializeCsvFiles("../results/output.csv", csvStringifier);
initializeCsvFiles("../results/summary_output.csv", summaryCsvStringifier);

loadExistingPlaceIds("../results/output.csv");

let existingPlaceIds = new Set();

async function main() {
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
      const response = await searchValueSERP(latitude, longitude, currentPage);

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
            current_opening_hours: place.opening_hours
              ? place.opening_hours.current
              : "",
            rating: place.rating,
            reviews: place.reviews,
            latitude: place.gps_coordinates.latitude,
            longitude: place.gps_coordinates.longitude,
            per_day_opening_hours: perDayHours,
          };

          appendToCSV(record, csvStringifier, "../results/output.csv");
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
    appendToCSV(
      summaryRecord,
      summaryCsvStringifier,
      "../results/summary_output.csv"
    );
  }

  console.log("Processo concluído.");
}

main();
