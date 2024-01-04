require("dotenv").config({ path: "../../.env" });
const fs = require("fs");
const csv = require("csv-parser");
const createCsvWriter = require("csv-writer").createObjectCsvWriter;
const axios = require("axios");

const csvFilePath = "../../results/output.csv";
const newCsvFilePath = "../../results/checked_output.csv";

function formatPhoneNumber(phoneNumber) {
  if (!phoneNumber || phoneNumber.trim() === "") {
    return null;
  }
  return phoneNumber.replace(/\s+/g, "").replace(/\+/g, "").replace(/-/g, "");
}

async function checkWhatsAppNumbers(numbers) {
  const baseUrl = process.env.BASE_URL;
  const instance = process.env.INSTANCE;
  const apiKey = process.env.API_KEY;

  console.log(numbers);

  try {
    const response = await axios.post(
      `${baseUrl}/chat/whatsappNumbers/${instance}`,
      numbers,
      {
        headers: { apikey: apiKey },
      }
    );

    return response.data;
  } catch (error) {
    console.error("Erro ao verificar números no WhatsApp:", error.message);
    return null;
  }
}

function readCSV(filePath) {
  return new Promise((resolve, reject) => {
    const results = [];
    fs.createReadStream(filePath)
      .pipe(csv())
      .on("data", (data) => results.push(data))
      .on("end", () => {
        resolve(results);
      })
      .on("error", reject);
  });
}

async function updateCSV() {
  const records = await readCSV(csvFilePath);

  const formattedPhoneNumbers = records
    .map((record) => formatPhoneNumber(record.Phone))
    .filter((phone) => phone !== null);

  console.log(
    "Números de telefone formatados enviados para a API:",
    formattedPhoneNumbers
  );

  const whatsappStatus = await checkWhatsAppNumbers(formattedPhoneNumbers);

  const updatedRecords = records.map((record, index) => {
    const whatsappInfo = whatsappStatus.find(
      (ws) => ws.jid === formattedPhoneNumbers[index] + "@s.whatsapp.net"
    );
    return {
      ...record,
      hasWhatsApp: whatsappInfo ? whatsappInfo.exists : false,
    };
  });

  const csvWriter = createCsvWriter({
    path: newCsvFilePath,
    header: [
      { id: "cep", title: "CEP" },
      { id: "position", title: "Position" },
      { id: "title", title: "Title" },
      { id: "link", title: "Link" },
      { id: "place_id", title: "Place ID" },
      { id: "address", title: "Address" },
      { id: "city", title: "City" },
      { id: "state", title: "State" },
      { id: "phone", title: "Phone" },
      { id: "hasWhatsApp", title: "Has WhatsApp" },
      { id: "current_opening_hours", title: "Current Opening Hours" },
      { id: "rating", title: "Rating" },
      { id: "reviews", title: "Reviews" },
      { id: "latitude", title: "Latitude" },
      { id: "longitude", title: "Longitude" },
      { id: "per_day_opening_hours", title: "Per Day Opening Hours" },
    ],
  });

  await csvWriter.writeRecords(updatedRecords);
  console.log("CSV atualizado com sucesso.");
}

setInterval(() => {
  console.log("Atualizando CSV...");
  updateCSV();
}, 240000);

updateCSV();
