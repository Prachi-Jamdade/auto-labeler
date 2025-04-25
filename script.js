const core = require("@actions/core");
const github = require("@actions/github");
const axios = require("axios");

async function run() {
  try {
    const githubToken = core.getInput("github-token", { required: true });
    const deepseekApiKey = core.getInput("deepseek-api-key", {
      required: true,
    });
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

    // Create a list of available labels in the repository for validation
    const labelsResponse = await octokit.rest.issues.listLabelsForRepo({
      owner,
      repo,
    });

    const availableLabels = new Set(
      labelsResponse.data.map((label) => label.name)
    );
    core.info(`Repository has ${availableLabels.size} available labels`);

    // Validate label mapping against available labels
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

      // Skip if already labeled
      if (issue.labels && issue.labels.length > 0) {
        core.info(`${type} #${issueNumber} already has labels. Skipping.`);
        continue;
      }

      // Prepare content for analysis
      const contentToAnalyze = `Title: ${title}\n\nDescription: ${body}`;

      try {
        // Call DeepSeek API
        const categories = await analyzeWithDeepSeek(
          contentToAnalyze,
          deepseekApiKey
        );

        if (categories.length === 0) {
          core.info(
            `No categories detected with sufficient confidence for ${type} #${issueNumber}`
          );
          continue;
        }

        core.info(
          `DeepSeek detected categories for ${type} #${issueNumber}: ${categories.join(
            ", "
          )}`
        );

        // Apply labels based on categories
        const labelsToApply = categories
          .filter((category) => labelMapping[category])
          .map((category) => labelMapping[category])
          .filter((label) => availableLabels.has(label));

          if (labelsToApply.length > 0) {
            // Deduplicate labels
            const uniqueLabels = [...new Set(labelsToApply)];
            
            await octokit.rest.issues.addLabels({
              owner,
              repo,
              issue_number: issueNumber,
              labels: uniqueLabels
            });
            
            core.info(`Applied labels to ${type} #${issueNumber}: ${uniqueLabels.join(', ')}`);
            labeledCount++;
          } else {
            core.info(`No matching labels found for ${type} #${issueNumber}`);
          }


      } catch (error) {
        core.warning(`Error processing ${type} #${issueNumber}: ${error.message}`);
      }

      await new Promise(resolve => setTimeout(resolve, 500));

    }

    core.info(`Processing complete. Processed ${processedCount} items, applied labels to ${labeledCount} items.`);

  } catch (error) {
    core.setFailed(`Action failed with error: ${error}`);
  }
}


async function analyzeWithDeepSeek(content, apiKey) {
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
        "https://api.deepseek.com/openapi/v1",
        {
          model: "deepseek-reasoner",
          messages: [
            { role: "system", content: "You are a helpful assistant." },
            { role: "user", content: prompt }
          ],
          temperature: 0.2,
        },
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          timeout: 15000,
        }
      );
  
      const reply = response.data.choices[0].message.content.trim();
  
      let categories;
      try {
        categories = JSON.parse(reply);
      } catch {
        core.warning(`DeepSeek returned invalid JSON: ${reply}`);
        return [];
      }
  
      if (!Array.isArray(categories)) {
        core.warning(`DeepSeek returned non-array data: ${reply}`);
        return [];
      }
  
      return categories;
    } catch (error) {
      if (error.response) {
        core.warning(`DeepSeek API error: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
      } else {
        core.warning(`DeepSeek request failed: ${error.message}`);
      }
      return [];
    }
  }
  

run();
