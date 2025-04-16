require("dotenv").config();
const fetch = require("node-fetch");

const CF_AUTH_EMAIL = process.env.CF_AUTH_EMAIL;
const CF_API_TOKEN = process.env.CF_API_TOKEN;
const CF_ACCOUNT_ID = process.env.CF_ACCOUNT_ID;
const CF_PAGES_PROJECT_NAME = process.env.CF_PAGES_PROJECT_NAME;
const KEEP_FIRST_N_PAGES = parseInt(process.env.KEEP_FIRST_N_PAGES || "1", 10);
const MAX_DELETES = parseInt(process.env.MAX_DELETES || "10", 10);

const sleep = (ms) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

const headers = {
  "X-Auth-Email": CF_AUTH_EMAIL,
  "X-Auth-Key": CF_API_TOKEN,
};

/** Get the cononical deployment (the live deployment) */
async function getProductionDeploymentId() {
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/pages/projects/${CF_PAGES_PROJECT_NAME}`,
    {
      method: "GET",
      headers,
    }
  );
  const body = await response.json();
  if (!body.success) {
    throw new Error(body.errors[0].message);
  }
  const prodDeploymentId = body.result.canonical_deployment.id;

  if (!prodDeploymentId) {
    throw new Error("Unable to fetch production deployment ID");
  }
  return prodDeploymentId;
}

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
    `Deleted ${deployment.created_on} deployment ${deployment.short_id} for project ${CF_PAGES_PROJECT_NAME}`
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
  // console.log(JSON.stringify(Object.keys(body)))
  console.log(body.result_info);
  return body.result;
}

async function processAndDeleteDeployments(productionDeploymentId) {
  // First, fetch the first page to get total_pages
  let firstPageResult, totalPages;
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
    firstPageResult = body.result;
    totalPages = body.result_info.total_pages;
    console.log(`Total pages: ${totalPages}`);
    console.log(`Keeping first ${KEEP_FIRST_N_PAGES} pages of deployments`);
  } catch (err) {
    console.warn(`Failed to fetch deployments for page 1.`);
    console.warn(err);
    process.exit(1);
  }

  let total = 0;
  let deleted = 0;

  // Start from the oldest page (totalPages) and go down to 1
  outer: for (let page = totalPages; page > 0; page--) {
    // Skip deletion for the first N pages
    if (page <= KEEP_FIRST_N_PAGES) {
      console.log(
        `Skipping page ${page} as it's in the protected first ${KEEP_FIRST_N_PAGES} pages`
      );
      continue;
    }

    let result;
    try {
      result = await listDeploymentsPerPage(page);
    } catch (err) {
      console.warn(`Failed to list deployments on page ${page}.`);
      console.warn(err);
      process.exit(1);
    }

    if (!result.length) {
      continue;
    }

    for (const deployment of result) {
      total++;
      if (deployment.id !== productionDeploymentId) {
        try {
          await deleteDeployment(deployment);
          deleted++;
          await sleep(500);
        } catch (error) {
          console.log(error);
        }
        if (deleted >= MAX_DELETES) {
          console.log(`Stopped after deleting ${deleted} deployments.`);
          break outer;
        }
      } else {
        console.log(`Keeping production deployment: ${deployment.id}`);
      }
    }
    await sleep(500);
  }

  console.log(
    `Processed ${total} deployments. Deleted ${deleted} non-production deployments.`
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

  // Validate KEEP_FIRST_N_PAGES
  if (isNaN(KEEP_FIRST_N_PAGES) || KEEP_FIRST_N_PAGES < 1) {
    throw new Error("KEEP_FIRST_N_PAGES must be a positive integer");
  }

  // const testList = await listDeploymentsPerPage(10);
  // console.log(JSON.stringify(testList, null, 4));

  const productionDeploymentId = await getProductionDeploymentId();
  console.log(
    `Found live production deployment to exclude from deletion: ${productionDeploymentId}`
  );

  console.log("Processing and deleting deployments page by page...");
  await processAndDeleteDeployments(productionDeploymentId);
}

main();
