const { Redis } = require("@upstash/redis");
const redis = new Redis({
  url: "https://crucial-tahr-84904.upstash.io",
  token: "gQAAAAAAAUuoAAIgcDJmYTM1Mzc2YmU5NGU0OGI4OWRlMjgwMzk1MTg5ZmFiYw"
});

redis.ping().then(console.log).catch(console.error);
