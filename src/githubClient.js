const github = require("@actions/github");

function getOctokitClient(token) {
  return github.getOctokit(token);
}

async function fetchOpenIssues(octokit, owner, repo, maxIssues) {
  const response = await octokit.rest.issues.listForRepo({
    owner,
    repo,
    state: "open",
    per_page: maxIssues,
    sort: "created",
    direction: "desc",
  });
  return response.data;
}

async function fetchAvailableLabels(octokit, owner, repo) {
  const response = await octokit.rest.issues.listLabelsForRepo({
    owner,
    repo,
  });
  return new Set(response.data.map((label) => label.name));
}

async function addLabels(octokit, owner, repo, issueNumber, labels) {
  await octokit.rest.issues.addLabels({
    owner,
    repo,
    issue_number: issueNumber,
    labels,
  });
}

module.exports = {
  getOctokitClient,
  fetchOpenIssues,
  fetchAvailableLabels,
  addLabels,
};
