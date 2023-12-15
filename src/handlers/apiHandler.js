const axios = require("axios");

async function getCoordinates(cep) {
  console.log(`Consultando CEP: ${cep}`);
  try {
    const response = await axios.get(
      `https://brasilapi.com.br/api/cep/v2/${cep}`
    );
    console.log(`CEP ${cep}: Sucesso na requisição.`);
    const { latitude, longitude } = response.data.location.coordinates;
    const { city, state } = response.data;
    return { latitude, longitude, city, state, status: "Success" };
  } catch (error) {
    console.error(`Erro ao consultar o CEP ${cep}:`, error.message);
    return {
      latitude: null,
      longitude: null,
      city: null,
      state: null,
      status: "Failed",
    };
  }
}

async function searchValueSERP(latitude, longitude, page) {
  const params = {
    api_key: process.env.APIKEY,
    search_type: "places",
    q: "restaurante",
    google_domain: "google.com.br",
    gl: "br",
    hl: "pt-br",
    output: "json",
    location: `lat:${latitude},lon:${longitude},zoom:15`,
    page,
  };

  try {
    const response = await axios.get("https://api.valueserp.com/search", {
      params,
    });
    if (response.data && response.data.places_results) {
      console.log(
        `ValueSERP Página ${page}: ${response.data.places_results.length} resultados encontrados.`
      );
      return response.data;
    } else {
      console.log(`ValueSERP Página ${page}: Resposta sem dados úteis.`);
      return null;
    }
  } catch (error) {
    console.error(
      `Erro ao fazer a requisição para a ValueSERP (Página ${page}):`,
      error.message
    );
    return null;
  }
}

module.exports = { getCoordinates, searchValueSERP };
