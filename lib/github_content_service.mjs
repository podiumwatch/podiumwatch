// Commits a file directly to the podiumwatch/podiumwatch repo's main
// branch via GitHub's REST Contents API -- the same branch Vercel's own
// GitHub integration already auto-deploys from (confirmed: every push
// this whole project's automation has ever made goes straight to main
// and triggers a real production deploy with no separate step). Used
// today for exactly one thing: turning a published Writer Portal
// article into a real Story file (lib/writer_portal_service.mjs's
// publishArticle()), but written generically -- "commit this file" --
// rather than baking in anything article-specific here.
//
// Nothing in this codebase talked to the GitHub API before this file.
// Requires GITHUB_TOKEN, a fine-grained personal access token scoped
// to this one repo with Contents: Read and write and nothing else.

const REPO_OWNER = "podiumwatch";
const REPO_NAME = "podiumwatch";
const BRANCH = "main";

function requireGithubToken() {
  const token = String(process.env.GITHUB_TOKEN || "").trim();

  if (!token) {
    const error = new Error(
      "GitHub commit access is not configured yet. Add GITHUB_TOKEN in Vercel."
    );
    error.status = 503;
    throw error;
  }

  return token;
}

async function githubRequest(path, options = {}) {
  const token = requireGithubToken();

  const response = await fetch(`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(options.headers || {})
    }
  });

  let data = {};
  try {
    data = await response.json();
  } catch {
    data = {};
  }

  return { ok: response.ok, status: response.status, data };
}

// Existence check for the slug-collision logic in publishArticle() --
// generateUniqueSlug() there only checks uniqueness within
// portal_articles, never against content/stories/'s real file list, so
// a caller needs this to know whether a given path is already taken in
// the actual repo before committing to it.
export async function repoFileExists(path) {
  const result = await githubRequest(`/contents/${encodeURIComponent(path).replaceAll("%2F", "/")}?ref=${BRANCH}`, {
    method: "GET"
  });

  if (result.status === 404) return false;
  if (!result.ok) {
    const error = new Error(result.data?.message || "Could not check the repository for an existing file.");
    error.status = result.status || 500;
    throw error;
  }

  return true;
}

// Always a create (no sha passed) -- this service is only ever asked to
// write a brand-new file at a path already confirmed free by
// repoFileExists() above, never to update an existing one. A 422 here
// (path already exists) surfaces as a clear thrown error rather than
// silently overwriting real content.
export async function commitFile({ path, content, message }) {
  const result = await githubRequest(`/contents/${encodeURIComponent(path).replaceAll("%2F", "/")}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message,
      content: Buffer.from(content, "utf8").toString("base64"),
      branch: BRANCH
    })
  });

  if (!result.ok) {
    const error = new Error(result.data?.message || "The file could not be committed to the repository.");
    error.status = result.status || 500;
    throw error;
  }

  return {
    path,
    commitSha: result.data?.commit?.sha || null,
    htmlUrl: result.data?.content?.html_url || null
  };
}

// Companion to commitFile() -- used only for cleaning up throwaway
// verification commits during development, never called from the real
// publish flow (a published story is never deleted by this system; see
// the plan's "Explicitly out of scope" note on unpublishing).
export async function deleteFile({ path, message }) {
  const existing = await githubRequest(`/contents/${encodeURIComponent(path).replaceAll("%2F", "/")}?ref=${BRANCH}`, {
    method: "GET"
  });
  if (!existing.ok) {
    const error = new Error(existing.data?.message || "That file could not be found.");
    error.status = existing.status || 404;
    throw error;
  }

  const result = await githubRequest(`/contents/${encodeURIComponent(path).replaceAll("%2F", "/")}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, sha: existing.data.sha, branch: BRANCH })
  });

  if (!result.ok) {
    const error = new Error(result.data?.message || "The file could not be deleted from the repository.");
    error.status = result.status || 500;
    throw error;
  }

  return { deleted: true };
}
