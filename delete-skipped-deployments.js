require("dotenv").config();
const fetch = require("node-fetch");

const CF_AUTH_EMAIL = process.env.CF_AUTH_EMAIL;
const CF_API_TOKEN = process.env.CF_API_TOKEN;
const CF_ACCOUNT_ID = process.env.CF_ACCOUNT_ID;
const CF_PAGES_PROJECT_NAME = process.env.CF_PAGES_PROJECT_NAME;
const MAX_DELETES = parseInt(process.env.MAX_DELETES || "10", 10);

const sleep = (ms) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

const headers = {
  "X-Auth-Email": CF_AUTH_EMAIL,
  "X-Auth-Key": CF_API_TOKEN,
};

async function deleteDeployment(deployment) {
  let params = "?force=true"; // Forces deletion of aliased deployments
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/pages/projects/${CF_PAGES_PROJECT_NAME}/deployments/${deployment.id}${params}`,
    {
      method: "DELETE",
      headers,
    }
  );
  const body = await response.json();
  if (!body.success) {
    throw new Error(body.errors[0].message);
  }
  console.log(
    `Deleted skipped deployment ${deployment.short_id} (created: ${deployment.created_on}) for project ${CF_PAGES_PROJECT_NAME}`
  );
}

async function listDeploymentsPerPage(page) {
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/pages/projects/${CF_PAGES_PROJECT_NAME}/deployments?per_page=10&page=${page}`,
    {
      method: "GET",
      headers,
    }
  );
  const body = await response.json();
  if (!body.success) {
    throw new Error(`Could not fetch deployments for ${CF_PAGES_PROJECT_NAME}`);
  }
  return body.result;
}

async function processAndDeleteSkippedDeployments() {
  // First, fetch the first page to get total_pages
  let totalPages;
  try {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/pages/projects/${CF_PAGES_PROJECT_NAME}/deployments?per_page=10&page=1`,
      {
        method: "GET",
        headers,
      }
    );
    const body = await response.json();
    if (!body.success) {
      throw new Error(
        `Could not fetch deployments for ${CF_PAGES_PROJECT_NAME}`
      );
    }
    totalPages = body.result_info.total_pages;
    console.log(`Total pages: ${totalPages}`);
  } catch (err) {
    console.warn(`Failed to fetch deployments for page 1.`);
    console.warn(err);
    process.exit(1);
  }

  let total = 0;
  let deleted = 0;

  // Process pages from last to first
  outer: for (let page = totalPages; page >= 1; page--) {
    console.log(`\nProcessing page ${page}/${totalPages}...`);
    let result;
    try {
      result = await listDeploymentsPerPage(page);
      console.log(`Found ${result.length} deployments on page ${page}`);
    } catch (err) {
      console.warn(`Failed to list deployments on page ${page}.`);
      console.warn(err);
      process.exit(1);
    }

    if (!result.length) {
      console.log(`No deployments found on page ${page}, skipping...`);
      continue;
    }

    // Process deployments in reverse order within each page
    for (let i = result.length - 1; i >= 0; i--) {
      const deployment = result[i];
      total++;
      if (deployment.is_skipped) {
        try {
          await deleteDeployment(deployment);
          deleted++;
          await sleep(500);
        } catch (error) {
          console.log(error);
        }
        if (deleted >= MAX_DELETES) {
          console.log(`Stopped after deleting ${deleted} skipped deployments.`);
          break outer;
        }
      }
    }
    console.log(`Finished processing page ${page}`);
    await sleep(500);
  }

  console.log(
    `\nSummary: Processed ${total} deployments. Deleted ${deleted} skipped deployments.`
  );
}

async function main() {
  if (!CF_API_TOKEN) {
    throw new Error(
      "Please set CF_API_TOKEN as an env variable to your API Token"
    );
  }

  if (!CF_ACCOUNT_ID) {
    throw new Error(
      "Please set CF_ACCOUNT_ID as an env variable to your Account ID"
    );
  }

  if (!CF_PAGES_PROJECT_NAME) {
    throw new Error(
      "Please set CF_PAGES_PROJECT_NAME as an env variable to your Pages project name"
    );
  }

  console.log("Processing and deleting skipped deployments...");
  await processAndDeleteSkippedDeployments();
}

main();
