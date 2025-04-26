const axios = require("axios");
const core = require("@actions/core");

async function analyzeContentWithGemini(content, apiKey) {
  try {
    const maxContentLength = 4000;
    const truncatedContent = content.length > maxContentLength
      ? content.substring(0, maxContentLength) + "... [truncated]"
      : content;

    const prompt = `
You are an intelligent assistant that classifies GitHub issues and pull requests into: "bug", "feature", "documentation", "question", "enhancement", "security", "performance".

Given the content, return a JSON array of categories strongly related.

Content:
${truncatedContent}

Respond in JSON like ["bug", "performance"]
`;

    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        contents: [{ parts: [{ text: prompt }] }],
      },
      { headers: { "Content-Type": "application/json" }, timeout: 15000 }
    );

    const reply = response.data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (!reply) {
      core.warning("No content returned from Gemini.");
      return [];
    }

    const categories = JSON.parse(reply);
    if (!Array.isArray(categories)) {
      core.warning(`Gemini returned non-array: ${reply}`);
      return [];
    }

    return categories;
  } catch (error) {
    if (error.response) {
      core.warning(`Gemini API error: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
    } else {
      core.warning(`Gemini request failed: ${error.message}`);
    }
    return [];
  }
}

module.exports = {
  analyzeContentWithGemini,
};
