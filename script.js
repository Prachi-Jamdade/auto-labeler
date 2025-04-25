const core = require("@actions/core");
const github = require("@actions/github");
const axios = require("axios");

async function run() {
  try {
    const githubToken = core.getInput("github-token", { required: true });
    const geminiApiKey = core.getInput("gemini-api-key", { required: true });
    const labelMappingString = core.getInput("label-mapping");
    const maxIssues = parseInt(core.getInput("max-issues"));

    let labelMapping;
    try {
      labelMapping = JSON.parse(labelMappingString);
    } catch (error) {
      core.setFailed(`Invalid label mapping JSON: ${error.message}`);
      return;
    }

    const octokit = github.getOctokit(githubToken);
    const context = github.context;
    const { owner, repo } = context.repo;

    core.info(`Starting to process issues and PRs for ${owner}/${repo}`);

    // Fetch open issues and PRs
    const issuesResponse = await octokit.rest.issues.listForRepo({
      owner,
      repo,
      state: "open",
      per_page: maxIssues,
      sort: "created",
      direction: "desc",
    });

    core.info(`Found ${issuesResponse.data.length} open issues/PRs to process`);

    const labelsResponse = await octokit.rest.issues.listLabelsForRepo({
      owner,
      repo,
    });

    const availableLabels = new Set(
      labelsResponse.data.map((label) => label.name)
    );
    core.info(`Repository has ${availableLabels.size} available labels`);

    // Validate label mapping
    for (const category in labelMapping) {
      const label = labelMapping[category];
      if (!availableLabels.has(label)) {
        core.warning(
          `Label "${label}" mapped from category "${category}" does not exist in the repository`
        );
      }
    }

    let processedCount = 0;
    let labeledCount = 0;

    for (const issue of issuesResponse.data) {
      const issueNumber = issue.number;
      const title = issue.title;
      const body = issue.body || "";
      const isPR = issue.pull_request !== undefined;
      const type = isPR ? "Pull Request" : "Issue";

      core.info(`Processing ${type} #${issueNumber}: ${title}`);
      processedCount++;

      if (issue.labels && issue.labels.length > 0) {
        core.info(`${type} #${issueNumber} already has labels. Skipping.`);
        continue;
      }

      const contentToAnalyze = `Title: ${title}\n\nDescription: ${body}`;

      try {
        const categories = await analyzeWithGemini(
          contentToAnalyze,
          geminiApiKey
        );

        if (categories.length === 0) {
          core.info(
            `No categories detected with sufficient confidence for ${type} #${issueNumber}`
          );
          continue;
        }

        core.info(
          `Gemini detected categories for ${type} #${issueNumber}: ${categories.join(", ")}`
        );

        const labelsToApply = categories
          .filter((category) => labelMapping[category])
          .map((category) => labelMapping[category])
          .filter((label) => availableLabels.has(label));

        if (labelsToApply.length > 0) {
          const uniqueLabels = [...new Set(labelsToApply)];

          await octokit.rest.issues.addLabels({
            owner,
            repo,
            issue_number: issueNumber,
            labels: uniqueLabels,
          });

          core.info(`Applied labels to ${type} #${issueNumber}: ${uniqueLabels.join(", ")}`);
          labeledCount++;
        } else {
          core.info(`No matching labels found for ${type} #${issueNumber}`);
        }
      } catch (error) {
        core.warning(`Error processing ${type} #${issueNumber}: ${error.message}`);
      }

      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    core.info(`Processing complete. Processed ${processedCount} items, applied labels to ${labeledCount} items.`);

  } catch (error) {
    core.setFailed(`Action failed with error: ${error}`);
  }
}

async function analyzeWithGemini(content, apiKey) {
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

    const reply = response.data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (!reply) {
      core.warning("No response content from Gemini.");
      return [];
    }

    let categories;
    try {
      categories = JSON.parse(reply);
    } catch {
      core.warning(`Gemini returned invalid JSON: ${reply}`);
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
        `Gemini API error: ${error.response.status} - ${JSON.stringify(error.response.data)}`
      );
    } else {
      core.warning(`Gemini request failed: ${error.message}`);
    }
    return [];
  }
}

run();
