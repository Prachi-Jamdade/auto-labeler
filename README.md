Auto Issue and PR Labeler
=========================

A GitHub Action that automatically analyzes and labels issues and pull requests using Gemini AI. This action helps in repository management by categorizing/labeling incoming issues and PRs based on their content.

Features
--------

*   Automatically analyzes the content of new issues and PRs
    
*   Uses Gemini's AI capabilities to understand content context
    
*   Applies appropriate labels based on AI analysis
    
*   Configurable label mapping to match your repository's labeling system
    
*   Skips already labeled issues for efficiency
    
*   Limits processing to a configurable number of issues/PRs per run
    

Setup
-----

### Prerequisites

1.  A Gemini API key (get at [Google AI Studio](https://aistudio.google.com/app/apikey))
    
2.  GitHub repository where you want to deploy this action
    

### Installation

1.  Create a .github/workflows directory in your repository if it doesn't exist
    
2.  Create a new workflow file (e.g., issue-labeler.yml) with the following content:
    
```yaml
name: Label Issues and PRs

on:
  issues:
    types: [opened, reopened]
  pull_request:
    types: [opened, reopened]
  schedule:
    - cron: '0 */6 * * *'  # Run every 6 hours
  workflow_dispatch:  # Allow manual triggering

jobs:
  label:
    runs-on: ubuntu-latest

    permissions:
      issues: write  # Write permission to add labels
      pull-requests: write 
      contents: read  # Read permission to analyze the content

    steps:
      - name: Label Issues and PRs
        uses: Prachi-Jamdade/auto-labeler@main
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          gemini-api-key: ${{ secrets.GEMINI_API_KEY }}
          label-mapping: '{"bug": "bug", "feature": "enhancement", "documentation": "docs", "question": "question"}'
          max-issues: 30

```

1.  Add your Gemini API key as a secret in your repository:
    
    *   Go to your repository → `Settings` → `Secrets and variables` → `Actions`
        
    *   Click on `New repository secret`
        
    *   Name: `GEMINI_API_KEY`
        
    *   Value: Your Gemini API key

### Configuration Options

| Input            | Description                                          | Required | Default |
|------------------|------------------------------------------------------|:--------:|:-------:|
| `github-token`   | GitHub token with repository access                  | Yes      | -       |
| `gemini-api-key` | Gemini API authentication key                        | Yes      | -       |
| `label-mapping`  | JSON mapping of AI categories to GitHub labels       | No       | `{"bug": "bug", "feature": "enhancement", "documentation": "documentation", "question": "question"}` |
| `max-issues`     | Maximum number of issues to process per run          | No       | 20      |


How It Works
------------

1.  The action fetches open issues and PRs from your repository
    
2.  For each unlabeled issue or PR, it extracts the title and body content
    
3.  It sends this content to the Gemini AI for analysis
    
4.  Gemini returns categorization results
    
5.  The action applies the corresponding labels to the issue or PR
    

License
-------

MIT
