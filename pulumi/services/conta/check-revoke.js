const assert = require("assert");
const { revokeRefreshToken } = require("./revoke");

const parameters = {
  domain: "login.example.com",
  clientId: "client-id",
  clientSecret: "client-secret",
  refreshToken: "sensitive-refresh-token",
};

(async () => {
  let request;
  const confirmed = await revokeRefreshToken({
    ...parameters,
    fetchImpl: async (url, options) => {
      request = { url, options };
      return { ok: true, status: 200 };
    },
  });
  assert.deepEqual(confirmed, { status: "confirmed", providerStatus: 200 });
  assert.equal(request.url, "https://login.example.com/oauth2/revoke");
  assert.equal(request.options.method, "POST");
  assert.equal(request.options.body.get("token"), parameters.refreshToken);

  const rejected = await revokeRefreshToken({
    ...parameters,
    fetchImpl: async () => ({ ok: false, status: 400 }),
  });
  assert.deepEqual(rejected, { status: "rejected", providerStatus: 400 });
  assert.equal(JSON.stringify(rejected).includes(parameters.refreshToken), false);

  const unavailable = await revokeRefreshToken({
    ...parameters,
    fetchImpl: async () => {
      throw Object.assign(new Error("provider unavailable"), { name: "TimeoutError" });
    },
  });
  assert.deepEqual(unavailable, { status: "unavailable", errorName: "TimeoutError" });
  assert.equal(JSON.stringify(unavailable).includes(parameters.refreshToken), false);

  console.log("token revocation: sucesso, rejeicao HTTP e indisponibilidade OK");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
