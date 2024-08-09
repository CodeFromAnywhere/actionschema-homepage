function renderRoot() {
  const data = getData();
  const hoveredOperation = getHoveredOperation();
  const hoveredSegment = getHoveredSegment();
  const selectedOperations = getSelectedOperations();
  const selectedCount = getSelectedOperationsCount();

  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get("beta") === "true") {
    window.localStorage.setItem("beta", "true");
  } else if (urlParams.get("beta") === "false") {
    window.localStorage.setItem("beta", "false");
  }

  if (getLoading()) {
    return `<div><i class="fas fa-spinner fa-spin"></i> Finding Your Actions</div>`;
  }

  if (getError()) {
    return `<div><i class="fas fa-error"></i>${getError()}</div>`;
  }

  return `
        <div class="flex flex-col md:flex-row gap-8">
            <div class="w-full md:w-1/3">
                <h2 class="text-xl font-bold mb-4">Operations</h2>
                <ul class="space-y-4">
                    ${renderOperations(
                      data,
                      hoveredOperation,
                      selectedOperations,
                    )}
                </ul>
            </div>

            <div class="w-full md:w-2/3">
                <h2 class="text-xl font-bold mb-4">Query Breakdown</h2>
                <div class="p-4 bg-white rounded shadow-md">
                    <p class="text-lg mb-4">
                        ${
                          data.actions
                            ? highlightSegments(
                                data.query,
                                data.actions,
                                hoveredOperation,
                              )
                            : ""
                        }
                    </p>
                    ${renderHoveredSegment(hoveredSegment, data)}
                </div>

                <div class="mt-8">
                    ${renderSelectedOperations(selectedCount)}
                </div>
            </div>
        </div>
    `;
}

function renderOperations(data, hoveredOperation, selectedOperations) {
  if (!data.operations?.length) return "No actions found for your query";

  const beta = window.localStorage.getItem("beta") === "true";
  return data.operations
    .map((op, index) => {
      const {
        providerSlug,
        operationId,
        summary,
        referenceUrl,
        prunedOpenapiUrl,
        providerUrl,
        loginUrl,
        buildUrl,
      } = op;

      const linkClass =
        "px-2 py-2 text-blue-600 hover:bg-blue-100 transition-bg text-xs duration-200";

      return `<li class="p-4 ${
        hoveredOperation === index ? "bg-gray-200" : "bg-white"
      } rounded shadow-md hover:shadow-lg transition-shadow duration-200">
            <div class="flex items-center justify-between">
                <h3 onclick="setHoveredOperation(${index})" class="cursor-pointer hover:text-gray-600 font-semibold">${providerSlug}</h3>
                ${
                  beta
                    ? `<label class="flex items-center space-x-2">
                    <input type="checkbox" class="form-checkbox h-5 w-5 text-blue-600"
                           ${
                             selectedOperations[providerSlug]?.includes(
                               operationId,
                             )
                               ? "checked"
                               : ""
                           } onclick="toggleOperation('${providerSlug}', '${operationId}')">
                    <span class="text-sm text-gray-700">Select</span>
                </label>`
                    : ""
                }
            </div>
            <p class="text-sm text-gray-600">${operationId}</p>
            <p class="mt-2">${summary || "No summary available"}</p>
            <div class="flex items-center justify-start gap-2 -ml-2">
                <p class="mt-4"><a href="${referenceUrl}" target="_blank" class="${linkClass}">Try</a></p>


                ${
                  beta
                    ? `
<p class="mt-4"><a href="${loginUrl}" class="${linkClass}">Login</a></p>
<p class="mt-4"><a href="${buildUrl}" target="_blank" class="${linkClass}">Build</a></p>
<p class="mt-4"><a href="${prunedOpenapiUrl}" target="_blank" class="${linkClass}">Definition</a></p>`
                    : `
<p class="mt-4"><a href="#" onclick="let yes = confirm('With BUILD developers can write code using their collected APIs using our LLM. To get early access, you may apply to the pilot program. Are you interested?'); if(yes){ window.location.href = 'https://docs.google.com/forms/d/e/1FAIpQLSckizJWBSb9i-sGiqL6-19JwnhB09LKyWaFXO7bYKXvEFo2Ug/viewform'; }" class="${linkClass}">Build</a></p>
`
                }
                <p class="mt-4"><a href="${providerUrl}" target="_blank" class="${linkClass}">${providerSlug}</a></p>

                
            </div>
        </li>`;
    })
    .join("");
}

function renderHoveredSegment(hoveredSegment, data) {
  if (hoveredSegment === null || !data.actions) return "";

  return `
        <div class="mt-4 p-4 bg-gray-100 rounded">
            <h3 class="font-semibold mb-2">Segment: "${
              data.actions[hoveredSegment].querySegment
            }"</h3>
            <ul class="list-disc list-inside">
                ${data.actions[hoveredSegment].providers
                  .map(
                    (provider) => `
                    <li>
                        ${provider.providerSlug}: 
                        ${provider.operations
                          .map(
                            (op) =>
                              `${op.operationId} (${
                                op.summary || "No summary"
                              })`,
                          )
                          .join(", ")}
                    </li>
                `,
                  )
                  .join("")}
            </ul>
        </div>
    `;
}

function renderSelectedOperations(selectedCount) {
  if (selectedCount === 0) return "";

  return `
        <h2 class="text-xl font-bold mb-4">Selected Operations: ${selectedCount}</h2>
        <div class="space-y-4">
            <a href="https://auth.actionschema.com/client/create?selection=${getSelectionString()}" 
               class="inline-block px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors duration-200">
                Create New Client or Add to Existing
            </a>
            <a href="https://openapi-util.actionschema.com/generateSdk?selection=${getSelectionString()}" 
               class="inline-block px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 transition-colors duration-200">
                Generate SDK
            </a>
            <button onclick="copySdkConfigToClipboard()" 
                    class="px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600 transition-colors duration-200">
                Copy Config for ActionSchema-migrate
            </button>
        </div>
    `;
}
