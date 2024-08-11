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

# Challenges along the way

- `Error: A Serverless Function has exceeded the unzipped maximum size of 250 MB`. Big limitation of Vercel. Would be nice to understand why it gets so big.
- `Vercel Runtime 413 Error: the response body is too large (> 4.5MB).`. This is terrible because some apis might give us something larger than this. Although it's uncommon, we should be able to accomodate this, and now we can't. We'll solve it when we get there.
