import { OpenapiDocument, mergeObjectsArray } from "from-anywhere";
import { readJsonFile } from "from-anywhere/node";
import { existsSync } from "fs";
import path from "path";

/**
TODO: Improved proxy openapi3.0

# Full support for server spec 

- Read: https://swagger.io/docs/specification/api-host-and-base-path/
- ✅ Allow for server urls that are relative (from `/`) by prepending it with the place the openapi was hosted.
- Allow for server urls with variables (prefil default unless the variable can be filled from the query)
- Allow for overriding servers in `[path].servers` or `[path].post.servers`

# Support for non-json responses: 

- Read: https://swagger.io/docs/specification/media-types/
- ✅ Don't auto-convert to JSON
- ✅ Pass on status code as well (pass on entire Response)

# Support for path parameters

- ✅ For now, disable path validation
- Read: https://swagger.io/docs/specification/describing-parameters/#path-parameters
- Try matching the path as exact match first.
- If it doesn't match, also match it against paths with `{}` and query parameters

 */
export const handleProxyRequest = async (request: Request, method: string) => {
  const url = request.url;
  const urlObject = new URL(url);

  const chunks = urlObject.pathname.split("/");
  //second one is id (coming after /)
  chunks.shift();
  const openapiId = chunks.shift();

  const key =
    urlObject.hostname === "localhost"
      ? process.env.LOCALHOST_TEST_KEY
      : openapiId;

  const openapiPath = path.resolve(".", "public", key + ".json");

  const hasOpenapi = existsSync(openapiPath);
  // setting for allow-all cors
  const defaultResponseInit = {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  };

  if (!hasOpenapi) {
    return Response.json(
      {
        message: `Invalid domain.`,
        //openapiPath,
      },
      defaultResponseInit,
    );
  }

  const openapi = await readJsonFile<OpenapiDocument>(openapiPath);
  if (!openapi?.paths) {
    return Response.json(
      {
        message: `Failed to read.`,
        // openapiPath,
      },
      defaultResponseInit,
    );
  }

  // DISABLED Path validation for now, until we implement it

  // const operation = (openapi as any).paths?.[pathname]?.[method] as
  //   | undefined
  //   | {};

  // if (!operation) {
  //   const allowedMethods = [
  //     "get",
  //     "post",
  //     "put",
  //     "patch",
  //     "delete",
  //     "head",
  //     "options",
  //   ];
  //   const methods = mergeObjectsArray(
  //     Object.keys(openapi.paths).map((path) => {
  //       return {
  //         [path]: Object.keys((openapi as any).paths[path]).filter((method) =>
  //           allowedMethods.includes(method),
  //         ),
  //       };
  //     }),
  //   );

  //   return Response.json(
  //     {
  //       message: `Invalid method. More info at ${urlObject.origin}/${key}.json`,
  //       methods,
  //       openapiPath,
  //     },
  //     defaultResponseInit,
  //   );
  // }

  const originalServerUrl = (openapi as any)?.["x-origin-servers"]?.[0]?.url as
    | string
    | undefined;

  if (!originalServerUrl) {
    return Response.json(
      {
        message: `origin-server url could not be found`,
      },
      defaultResponseInit,
    );
  }

  const fullOriginalUrl =
    originalServerUrl + chunks.join("/") + urlObject.search + urlObject.hash;

  console.log(`FOUND ORIGINAL URL`, fullOriginalUrl);

  const result = await fetch(fullOriginalUrl, {
    method,
    body: request.body,
    //@ts-ignore
    // SEE: https://github.com/nodejs/node/issues/46221
    duplex: "half",
    headers: request.headers,
  });

  //  new Response()
  return result; //Response.json(result, defaultResponseInit);
};
