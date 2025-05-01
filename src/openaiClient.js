const { OpenAI } = require("openai");
const core = require("@actions/core");

async function analyzeContentWithOpenAI(content, availableLabels, apiKey) {
  try {
    const truncatedContent =
      content.length > maxContentLength
        ? content.substring(0, maxContentLength) + "... [truncated]"
        : content;

    const prompt = `
    You are an intelligent assistant that classifies GitHub issues and pull requests into the following categories: ${availableLabels}.
    
    Given the following content, return a JSON array of category names (strings) that apply, sorted by relevance. Only include categories that are strongly relevant.
    
    Content:
    ${truncatedContent}
    
    Respond with JSON only. Example: ["bug", "performance"]
    `;

    const openai = new OpenAI({ apiKey: apiKey });

    const response = await openai.chat.completions.create({
      model: "gpt-4.1",
      messages: [{ role: "user", content: prompt }],
    });

    let reply = response.choices[0].message.content.trim();
    if (!reply) {
      core.warning("No response content from OpenAI.");
      return [];
    }

    // Remove ```json or ``` if OpenAI wraps response in markdown
    if (reply.startsWith("```")) {
      reply = reply
        .replace(/```(json)?/gi, "")
        .replace(/```/g, "")
        .trim();
    }

    let categories;
    try {
      categories = JSON.parse(reply);
    } catch (error) {
      core.warning(`Failed to parse OpenAI response: ${error}`);
      return [];
    }

    return categories;
  } catch (error) {
    core.error(`Error analyzing content with Gemini: ${error}`);
    return [];
  }
}

module.exports = { analyzeContentWithOpenAI };