const core = require("@actions/core");
const { getOctokitClient, fetchOpenIssues, fetchAvailableLabels, addLabels } = require("./githubClient");
const { analyzeContentWithGemini } = require("./geminiClient");
const { parseLabelMapping, filterLabelsToApply } = require("./labelUtils");
const github = require("@actions/github");

async function run() {
  try {
    const githubToken = core.getInput("github-token", { required: true }); 
    const geminiApiKey = core.getInput("gemini-api-key", { required: true });
    const openaiApiKey = core.getInput("openai-api-key", { required: true });
    const labelMappingString = core.getInput("label-mapping");
    const maxIssues = parseInt(core.getInput("max-issues"));

    const labelMapping = parseLabelMapping(labelMappingString);
    const octokit = getOctokitClient(githubToken);
    const { owner, repo } = github.context.repo;

    core.info(`Starting to process issues and PRs for ${owner}/${repo}`);

    const issues = await fetchOpenIssues(octokit, owner, repo, maxIssues);
    const availableLabels = await fetchAvailableLabels(octokit, owner, repo);

    let processedCount = 0;
    let labeledCount = 0;

    for (const issue of issues) {
      const issueNumber = issue.number;
      const title = issue.title;
      const body = issue.body || "";
      const isPR = issue.pull_request !== undefined;
      const type = isPR ? "Pull Request" : "Issue";

      core.info(`🚀 Processing ${type} #${issueNumber}: ${title}`);
      processedCount++;

      if (issue.labels && issue.labels.length > 0) {
        core.info(`${type} #${issueNumber} already has labels. Skipping.`);
        continue;
      }

      const content = `Title: ${title}\n\nDescription: ${body}`;
      let categories = [];
      if(geminiApiKey) {
        categories = await analyzeContentWithGemini(content, geminiApiKey);
      } else if (openaiApiKey) {
        categories = await analyzeContentWithGemini(content, geminiApiKey);
      }

      if (categories.length === 0) {
        core.info(`No categories detected for ${type} #${issueNumber}`);
        continue;
      }

      const labelsToApply = filterLabelsToApply(categories, labelMapping, availableLabels);

      if (labelsToApply.length > 0) {
        await addLabels(octokit, owner, repo, issueNumber, labelsToApply);
        core.info(`✅ Applied labels: ${labelsToApply.join(", ")} to ${type} #${issueNumber}`);
        labeledCount++;
      } else {
        core.info(`No matching labels found for ${type} #${issueNumber}`);
      }

      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    core.info(`🔥 Processing complete. Processed ${processedCount} items, labeled ${labeledCount} items.`);
  } catch (error) {
    core.setFailed(`Action failed: ${error.message}`);
  }
}

run();
