# go-d1-proxy

A minimal [Cloudflare Worker](https://developers.cloudflare.com/workers/) that exposes [Cloudflare D1](https://developers.cloudflare.com/d1/) databases over an HTTP endpoint, secured by [Cloudflare Zero Trust (Access)](https://developers.cloudflare.com/cloudflare-one/applications/).

Part of the [orangegopher.dev](https://orangegopher.dev) project — because JavaScript and TypeScript are cool, but Go has a mascot. 

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/mdmourao/go-d1-proxy)

> **Project status: Beta.** APIs and behavior may change. Please open issues with feedback before relying on it in production.

## What this proxy does

- Accepts `POST` requests where the URL path is the **D1 binding name** (e.g. `POST /go_d1_db`).
- Requires a Cloudflare Access JWT (`Cf-Access-Jwt-Assertion` header) — requests without it are rejected with `403`.
- Reads a JSON body of the form `{ "sql": "...", "args": [...], "isExec": false }`.
- Calls `env[<binding>].prepare(sql).bind(...args)` and returns either:
  - **Query results** (`isExec` omitted/`false`): `{ "columns": [...], "rows": [[...], ...] }`.
  - **Execution results** (`isExec: true`): `{ "changes": <n>, "last_row_id": <n> }`.

## Endpoints

| Method | Path         | Description                                                                              |
| ------ | ------------ | ---------------------------------------------------------------------------------------- |
| `POST` | `/<binding>` | Run a SQL statement against the D1 database bound under `<binding>` in `wrangler.jsonc`. |

Any other method returns `405`. An unknown `<binding>` returns `404`. Missing Access JWT returns `403`.

### Request body

```json
{
  "sql": "SELECT * FROM mascots WHERE language = ?",
  "args": ["Go"],
  "isExec": false
}
```

| Field    | Type        | Description                                                                   |
| -------- | ----------- | ----------------------------------------------------------------------------- |
| `sql`    | `string`    | SQL statement. Use `?` placeholders for parameters.                           |
| `args`   | `unknown[]` | Optional. Bound to the `?` placeholders in order.                             |
| `isExec` | `boolean`   | Optional. `true` for `INSERT` / `UPDATE` / `DELETE` / DDL; `false` for reads. |

### Response

Reads (`isExec` not set):

```json
{
  "columns": ["id", "language", "name"],
  "rows": [[1, "Go", "Gopher"]]
}
```

Writes (`isExec: true`):

```json
{ "changes": 1, "last_row_id": 8 }
```

Errors return `{"error": "<message>"}` with status `500`.

## Trying it out with `requests.http`

The repo ships with a [requests.http](requests.http) file containing ready-to-run example calls (create a table, insert rows, run queries, run updates). It is designed for the [REST Client](https://marketplace.visualstudio.com/items?itemName=humao.rest-client) VS Code extension and reads its variables from a `.env` file in the project root via `{{$dotenv VAR}}`.

1. Copy the template:

   ```sh
   cp .env.example .env
   ```

2. Fill in your values in `.env`:

   ```dotenv
   HOST=https://d1-proxy.example.com
   DB=go_d1_db
   CF_ACCESS_CLIENT_ID=<client-id>.access
   CF_ACCESS_CLIENT_SECRET=<client-secret>
   ```

   - `HOST` — the custom domain your Worker is deployed on (no trailing slash).
   - `DB` — the D1 binding name from `wrangler.jsonc` (becomes the URL path).
   - `CF_ACCESS_CLIENT_ID` / `CF_ACCESS_CLIENT_SECRET` — the service token created in the Deploy section.

3. Open [requests.http](requests.http) in VS Code and click **Send Request** above any block.

> `.env` is gitignored. Never commit real client secrets.

## Deploy to Cloudflare

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/mdmourao/go-d1-proxy)

### 1. Configure your D1 databases

Edit [wrangler.jsonc](wrangler.jsonc) and replace the example binding with **your own** database(s). The proxy routes by binding name, so you can expose **multiple databases** from the same Worker — add as many entries under `d1_databases` as you need:

```jsonc
{
  "d1_databases": [
    {
      "binding": "go_d1_db",
      "database_name": "go-d1-db",
      "database_id": "<your-database-id>"
    },
    {
      "binding": "another_db",
      "database_name": "another-db",
      "database_id": "<your-other-database-id>"
    }
  ]
}
```

Each binding becomes a path: `POST /go_d1_db`, `POST /another_db`, etc.

Create a database with:

```sh
npx wrangler d1 create <database-name>
```

and copy the returned `database_id` into `wrangler.jsonc`.

### 2. Deploy the Worker

```sh
npm install
npx wrangler deploy
```

> **Note:** `workers_dev` is set to `false` in `wrangler.jsonc`, so the Worker is **not** exposed on `*.workers.dev`. You must attach a custom domain (next step) before it can receive traffic.

### 3. Add a custom domain

In the Cloudflare dashboard:

1. Open the Worker → **Settings** → **Domains & Routes** → **Add** → **Custom Domain**.
2. Enter the hostname you want (e.g. `d1-proxy.example.com`). The domain must be on a zone in your Cloudflare account.

Docs: [Custom domains for Workers](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/).

### 4. Create a Service Token

For non-interactive clients (CI, backends, the Go client, etc.), create a service token:

1. **Zero Trust** → **Access** → **Service Auth** → **Service Tokens** → **Create Service Token**.
2. Save the generated **Client ID** and **Client Secret** — the secret is only shown once.

Docs: [Service tokens](https://developers.cloudflare.com/cloudflare-one/identity/service-tokens/).

### 5. Create a Zero Trust Access application

The Worker rejects any request without a `Cf-Access-Jwt-Assertion` header, so the custom domain **must** be put behind Cloudflare Access.

1. **Zero Trust** → **Access** → **Applications** → **Add an application** → **Self-hosted**.
2. Set the **Application domain** to the custom domain configured in step 3.
3. Add an Access policy with action **Service Auth** that includes the service token created in step 4. 

Docs: [Self-hosted Access applications](https://developers.cloudflare.com/cloudflare-one/applications/configure-apps/self-hosted-public-app/).

Calls then look like:

```http
POST https://d1-proxy.example.com/go_d1_db
CF-Access-Client-Id: <client-id>.access
CF-Access-Client-Secret: <client-secret>
Content-Type: application/json

{ "sql": "SELECT 1" }
```

## Local development

```sh
npm install
npx wrangler dev
```

`wrangler dev` does not enforce the Access JWT — send a placeholder `Cf-Access-Jwt-Assertion` header so the Worker accepts the request.
