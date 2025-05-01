const core = require("@actions/core");

function parseLabelMapping(mappingString) {
  try {
    return JSON.parse(mappingString);
  } catch (error) {
    core.setFailed(`Invalid label mapping JSON: ${error.message}`);
    throw error;
  }
}

function filterLabelsToApply(categories, labelMapping, availableLabels) {
  const mappedLabels = categories
    .map((category) => labelMapping[category] || category) // fallback to category if no mapping
    .filter((label) => availableLabels.has(label));

  return [...new Set(mappedLabels)];
}

module.exports = {
  parseLabelMapping,
  filterLabelsToApply,
};
