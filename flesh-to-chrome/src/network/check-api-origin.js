const assert = require("assert");
const { allowedApiOrigin, takeTicket } = require("./api-origin");

const published = "https://wxaovhjf9l.execute-api.sa-east-1.amazonaws.com";
assert.equal(allowedApiOrigin("https://evil.example/api", published, "d24.cloudfront.net"), "");
assert.equal(allowedApiOrigin("http://evil.example", published, "localhost"), "");
assert.equal(allowedApiOrigin(`${published}/me`, published, "d24.cloudfront.net"), published);
assert.equal(allowedApiOrigin("http://localhost:1234", published, "localhost"), "http://localhost:1234");
assert.equal(allowedApiOrigin("http://127.0.0.1:9999", "", "127.0.0.1"), "http://127.0.0.1:9999");
assert.equal(allowedApiOrigin("javascript:alert(1)", published, "localhost"), "");

const stripped = takeTicket("https://jogo.example/index.html?room=1&ticket=segredo");
assert.equal(stripped.ticket, "segredo");
assert.equal(stripped.href, "/index.html?room=1");
assert.equal(takeTicket("https://jogo.example/").ticket, "");

console.log("api-origin ok");
