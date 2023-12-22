const axios = require("axios");

async function getCoordinates(cepData) {
  const { cep, uf, location } = cepData;
  console.log(`Consultando CEP: ${cep}`);
  try {
    const response = await axios.get(
      `https://brasilapi.com.br/api/cep/v2/${cep}`
    );
    console.log(`CEP ${cep}: Sucesso na requisição.`);

    if (response.data.name === "CepPromiseError") {
      console.log(`Erro 'CepPromiseError' encontrado para o CEP: ${cep}`);
      return null;
    }

    const { latitude, longitude } = response.data.location.coordinates;
    const { city, state } = response.data;
    return {
      latitude,
      longitude,
      location,
      city,
      state,
      uf,
      status: "Success",
    };
  } catch (error) {
    console.error(`Erro ao consultar o CEP ${cep}:`, error.message);
    return null;
  }
}

async function searchValueSERP(cep, latitude, longitude, page) {
  const params = {
    api_key: "2CDD97EF26984549878569DC3AEF8408",
    search_type: "places",
    q: "restaurante",
    google_domain: "google.com.br",
    gl: "br",
    hl: "pt-br",
    output: "json",
    location: `lat:${latitude},lon:${longitude},zoom:20`,
    page,
  };

  console.log(params);

  try {
    const response = await axios.get("https://api.valueserp.com/search", {
      params,
    });
    if (response.data && response.data.places_results) {
      console.log(
        `ValueSERP Página ${page}: ${response.data.places_results.length} resultados encontrados.`
      );
      return { ...response.data, cep };
    } else {
      console.log(`ValueSERP Página ${page}: Resposta sem dados úteis.`);
      return null;
    }
  } catch (error) {
    if (error.response && error.response.status === 402) {
      console.error(
        "Erro ao fazer a requisição para a ValueSERP (Página 1): Request failed with status code 402"
      );
      await sendErrorMessage();
      process.kill(process.pid);
    } else {
      console.error(`Outro erro na requisição da ValueSERP: ${error.message}`);
    }
  }
}

async function sendErrorMessage() {
  try {
    const response = await axios.post(
      "https://evo.pmcholding.com.br/message/sendText/goclinica",
      {
        number: "5579991036669",
        options: {
          delay: 1200,
          presence: "composing",
          linkPreview: false,
        },
        textMessage: {
          text: "Execução interrompida",
        },
      },
      {
        headers: {
          "Content-Type": "application/json",
          apikey: "d7eaddf3431f909a7e22c57a72967bef",
        },
      }
    );

    console.log("Mensagem de erro enviada com sucesso", response.data);
  } catch (error) {
    console.error("Erro ao enviar mensagem de erro", error.message);
  }
}

module.exports = { getCoordinates, searchValueSERP };
