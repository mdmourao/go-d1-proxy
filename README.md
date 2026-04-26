[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/mdmourao/go-d1-proxy)

npm create cloudflare@latest . -- --type=hello-world --ts --deploy=false

npx wrangler d1 create go-d1-db

POST https://example.com/go-d1-db
Content-Type: application/json

{ "sql": "SELECT * FROM users WHERE id = ?", "args": [1] }

manual steps:

1. add custom domain
2. create Service token
3. create zero trust app