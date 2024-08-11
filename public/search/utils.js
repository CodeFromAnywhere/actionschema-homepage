async function getSearch(query) {
  const q = encodeURIComponent(query).toLowerCase();
  const storageKey = `search.${q}`;
  const already = localStorage.getItem(storageKey);

  if (!already || JSON.parse(already).createdAt < Date.now() - 86400000) {
    setLoading(true);

    try {
      const result = await fetch(`${baseUrl}/api/search/providers?q=${q}`).then(
        (res) => res.json(),
      );

      setLoading(false);

      console.log(result);
      localStorage.setItem(storageKey, JSON.stringify(result));
      return result;
    } catch (e) {
      setError("Query could not be carried out");
      setLoading(false);
    }
  }

  setLoading(false);
  return JSON.parse(already);
}

function highlightSegments(query, actions, hoveredOperationIndex) {
  let result = [];
  let lastIndex = 0;

  const hoveredOperation =
    getData().operations && getData().operations[hoveredOperationIndex];

  actions.forEach((action, index) => {
    const startIndex = query.indexOf(action.querySegment, lastIndex);
    if (startIndex > lastIndex) {
      result.push(query.substring(lastIndex, startIndex));
    }

    const isHighlighted =
      !hoveredOperation ||
      hoveredOperation.actions.some(
        (op) => op.querySegment === action.querySegment,
      );
    const segmentClass = isHighlighted ? "bg-yellow-200 cursor-pointer" : "";
    result.push(
      `<span class="${segmentClass}" onmouseover="setHoveredSegment(${index})" onmouseout="setHoveredSegment(null)">${action.querySegment}</span>`,
    );
    lastIndex = startIndex + action.querySegment.length;
  });

  if (lastIndex < query.length) {
    result.push(query.substring(lastIndex));
  }

  return result.join("");
}

function getSelectedOperationsCount() {
  return Object.values(getSelectedOperations()).reduce(
    (sum, arr) => sum + arr.length,
    0,
  );
}

function getSelectionString() {
  const selectedOperations = getSelectedOperations();
  return Object.entries(selectedOperations)
    .map(
      ([providerSlug, operationIds]) =>
        `${providerSlug}:${operationIds.join(",")}`,
    )
    .join("&selection=");
}

function getSdkConfig() {
  const selectedOperations = getSelectedOperations();
  const data = getData();

  const openapis = Object.entries(selectedOperations).map(
    ([providerSlug, operationIds]) => {
      const openapiUrl = data.operations.find(
        (x) => x.providerSlug === providerSlug,
      )?.openapiUrl;

      return {
        openapiUrl: openapiUrl || null,
        operationIds,
      };
    },
  );

  return { openapis };
}

function copySdkConfigToClipboard() {
  const sdkConfig = getSdkConfig();
  window.navigator.clipboard.writeText(JSON.stringify(sdkConfig, undefined, 2));
  console.log({ sdkConfig });
}
