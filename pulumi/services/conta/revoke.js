function safeErrorName(error) {
  return typeof error?.name === "string" && error.name ? error.name : "Error";
}

async function revokeRefreshToken({ domain, clientId, clientSecret, refreshToken, fetchImpl = fetch }) {
  if (!domain || !clientId || !clientSecret || !refreshToken) {
    return { status: "unavailable", errorName: "ConfigurationError" };
  }

  const authorization = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  try {
    const providerResponse = await fetchImpl(`https://${domain}/oauth2/revoke`, {
      method: "POST",
      headers: {
        authorization: `Basic ${authorization}`,
        "content-type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ token: refreshToken }),
    });
    if (providerResponse.ok) {
      return { status: "confirmed", providerStatus: providerResponse.status };
    }
    return { status: "rejected", providerStatus: providerResponse.status };
  } catch (error) {
    return { status: "unavailable", errorName: safeErrorName(error) };
  }
}

module.exports = { revokeRefreshToken };
