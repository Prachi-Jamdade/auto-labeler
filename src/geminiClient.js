async function analyzeContentWithGemini(content, apiKey) {
  try {
    const maxContentLength = 4000;
    const truncatedContent =
      content.length > maxContentLength
        ? content.substring(0, maxContentLength) + "... [truncated]"
        : content;

    const prompt = `
  You are an intelligent assistant that classifies GitHub issues and pull requests into the following categories: "bug", "feature", "documentation", "question", "enhancement", "security", "performance".
  
  Given the following content, return a JSON array of category names (strings) that apply, sorted by relevance. Only include categories that are strongly relevant.
  
  Content:
  ${truncatedContent}
  
  Respond with JSON only. Example: ["bug", "performance"]
  `;

    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        contents: [
          {
            parts: [
              {
                text: prompt,
              },
            ],
          },
        ],
      },
      {
        headers: {
          "Content-Type": "application/json",
        },
        timeout: 15000,
      }
    );

    let reply =
      response.data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (!reply) {
      core.warning("No response content from Gemini.");
      return [];
    }

    // ✨ NEW: Remove ```json or ``` if Gemini wraps response in markdown
    if (reply.startsWith("```")) {
      reply = reply
        .replace(/```(json)?/gi, "")
        .replace(/```/g, "")
        .trim();
    }

    let categories;
    try {
      categories = JSON.parse(reply);
    } catch {
      core.warning(`Gemini returned invalid JSON after cleanup: ${reply}`);
      return [];
    }

    if (!Array.isArray(categories)) {
      core.warning(`Gemini returned non-array data: ${reply}`);
      return [];
    }

    return categories;
  } catch (error) {
    if (error.response) {
      core.warning(
        `Gemini API error: ${error.response.status} - ${JSON.stringify(
          error.response.data
        )}`
      );
    } else {
      core.warning(`Gemini request failed: ${error.message}`);
    }
    return [];
  }
}

module.exports = { analyzeContentWithGemini };