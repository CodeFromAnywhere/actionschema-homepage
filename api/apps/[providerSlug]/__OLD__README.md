<!--

TODO: MAYBE USE THIS IF PEOPLE WANT TO TEST USING reference.html

This in combination with changing the server of the openapi after retrieval in reference.html should be enough to get it to work from the browser

 -->

# Next.js Openapi Proxy

This repo can be used as a template. It makes a proxy for multiple APIs in a serverless environment. To use it, put your OpenAPI JSON inside of `/public` with name `[name].json`. Your API will now be accessible at `[name].[domain].tld`.

Motivation:

- According to [Mike Ralphson's blogpost](https://blog.postman.com/what-we-learned-from-200000-openapi-files/) 21% of OpenAPIs contain mistakes in the definition. My hypothesis is that even more have unexpected behavior when actually using the endpoints.
- OpenAPIs are great but not enough by itself for a developer to use the service. Usually, we need to sign up, pay, and collect an API key, for example. Ways to smoothen this process could be beneficial.
- There are tons of things any SaaS must solve in order to expose a good API. OpenAPIs are one of them, other things include e2e testing, pentests, rate-limiting, input validation, documentation, the list goes on... If we can make good proxies, these things can be solved in a general way, as a thin layer ontop of the simpler implementation by the service.

# How to obtain an OpenAPI from a SaaS website

This is my "algorithm" to find the OpenAPI for any given SaaS Service:

- We can scrape all subdomains of the site domain and try common openapi locations, e.g. `/openapi.json` or `/openapi.yaml` or `/swagger.json`
- As stated [here](https://stackoverflow.com/questions/41660658/openapi-or-swagger-json-auto-discovery) we could first figure out the api server, then check `/api-docs`
- Look at `/.well-known/schema-discovery` (as in https://github.com/zalando/restful-api-guidelines/pull/277/files)
- Request OPTIONS at `/` of the API address (see https://www.rfc-editor.org/rfc/rfc7231#section-4.3.7)
- We can find it by searching google for `site:[domain] "openapi"`
- If we can find a swaggersite but the spec isn't available as JSON, you can still find it in sources of swagger.
- In some other docs generators it's also available in sources.
- It might be available on github or anywhere else publicly hosted. try things like `site:github.com "[sitename]" "openapi"` or `site:github.com "[sitename]" "openapi.json"`
- If it's not available publicly but there are docs that are obviously created using an OpenAPI spec (such as from readme.com) we can open an issue in their github, email the developer, or contact the SaaS, asking for the spec.
- Some other people already explored them by scraping:
  - Google BigQuery
  - SwaggerHub API
  - APIS.Guru api: https://api.apis.guru/v2/list.json

I'll probably make this into a script later.

# Challenges along the way

- `Error: A Serverless Function has exceeded the unzipped maximum size of 250 MB`. Big limitation of Vercel. Would be nice to understand why it gets so big.
- `Vercel Runtime 413 Error: the response body is too large (> 4.5MB).`. This is terrible because some apis might give us something larger than this. Although it's uncommon, we should be able to accomodate this, and now we can't. We'll solve it when we get there.
