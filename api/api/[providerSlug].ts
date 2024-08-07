export const config = {
  runtime: "edge",
};

export const GET = async (request: Request) => {
  const url = new URL(request.url);
  const providerSlug = url.searchParams.get("providerSlug");

  if (!providerSlug) {
    return new Response("Not found");
  }

  const providers = await fetch(
    "https://search.actionschema.com/providers.json",
  ).then((res) => res.json());

  const provider = providers[providerSlug] as {} | undefined;

  if (!provider) {
    return new Response("Not found");
  }

  const template = await fetch(url.origin + "/provider.html").then((res) =>
    res.text(),
  );
  const data = { providerSlug, ...provider };
  const dataString = `const data = ${JSON.stringify(data, undefined, 0)}`;
  const html = template
    .replace(`const data = {};`, dataString)
    .replace(
      `<title></title>`,
      `<title>${
        providerSlug.slice(0, 1).toUpperCase() + providerSlug.slice(1)
      } - ActionSchema</title>`,
    );

  return new Response(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html",
      "Cache-Control": "max-age=3600, s-maxage=3600",
    },
  });
};
