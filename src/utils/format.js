function formatOpeningHours(perDay) {
  return perDay.map((day) => `${day.name}: ${day.value}`).join("; ");
}

module.exports = { formatOpeningHours };
