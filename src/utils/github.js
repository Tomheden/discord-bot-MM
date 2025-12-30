const uploadTranscript = async ({
  buffer,
  fileName,
  config,
}) => {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    throw new Error("Missing GITHUB_TOKEN in environment.");
  }

  const repoConfig = config?.transcripts?.github;
  if (!repoConfig?.owner || !repoConfig?.repo || !repoConfig?.branch || !repoConfig?.dir) {
    throw new Error("Missing GitHub transcript repo configuration.");
  }

  const path = [repoConfig.dir, fileName].join("/");
  const encodedPath = path
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");

  const response = await fetch(
    `https://api.github.com/repos/${repoConfig.owner}/${repoConfig.repo}/contents/${encodedPath}`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "User-Agent": "discord-bot-mm",
        "Content-Type": "application/json",
        Accept: "application/vnd.github+json",
      },
      body: JSON.stringify({
        message: `Add transcript ${fileName}`,
        content: buffer.toString("base64"),
        branch: repoConfig.branch,
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`GitHub upload failed: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  const blobUrl = `https://github.com/${repoConfig.owner}/${repoConfig.repo}/blob/${repoConfig.branch}/${path}`;
  return {
    blobUrl,
    htmlUrl: data.content?.html_url,
    downloadUrl: data.content?.download_url,
    path,
  };
};

module.exports = {
  uploadTranscript,
};
