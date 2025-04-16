# Delete All Deployments

A GitHub Action that deletes all Cloudflare Pages deployments for a given project, while preserving the production deployment and the most recent N pages of deployments.

## Inputs

### `cf_auth_email`

**Required** Your Cloudflare account email.

### `cf_api_token`

**Required** Your Cloudflare API token.

### `cf_account_id`

**Required** Your Cloudflare account ID.

### `cf_pages_project_name`

**Required** The name of your Pages project.

### `keep_first_n_pages`

**Optional** Number of most recent pages of deployments to keep. Default `"1"`.

### `max_deletes`

**Optional** Maximum number of deployments to delete in one run. Default `"10"`.

## Outputs

### `deleted_count`

The number of deployments that were deleted in this run.

## Example usage

```yaml
name: Cleanup Deployments
on:
  schedule:
    - cron: "0 0 * * *" # Runs daily at midnight
  workflow_dispatch: # Allows manual triggering

jobs:
  cleanup:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Delete Old Deployments
        uses: blairanderson/delete-all-deployments@v1
        with:
          cf_auth_email: ${{ secrets.CF_AUTH_EMAIL }}
          cf_api_token: ${{ secrets.CF_API_TOKEN }}
          cf_account_id: ${{ secrets.CF_ACCOUNT_ID }}
          cf_pages_project_name: ${{ secrets.CF_PAGES_PROJECT_NAME }}
          keep_first_n_pages: 1
          max_deletes: 10
```

## Required Secrets

Add these secrets to your GitHub repository:

- `CF_AUTH_EMAIL`: Your Cloudflare account email
- `CF_API_TOKEN`: Your Cloudflare API token
- `CF_ACCOUNT_ID`: Your Cloudflare account ID
- `CF_PAGES_PROJECT_NAME`: The name of your Pages project

## Development

1. Copy the sample `.env` file and fill in your values:

```bash
cp .env.sample .env
```

2. Edit the `.env` file with your Cloudflare credentials:

```
CF_AUTH_EMAIL=your-email@example.com
CF_API_TOKEN=your-api-token
CF_ACCOUNT_ID=your-account-id
CF_PAGES_PROJECT_NAME=your-project-name
KEEP_FIRST_N_PAGES=1
MAX_DELETES=10
```

3. Install dependencies and run:

```bash
npm install
npm start
```

## License

MIT
