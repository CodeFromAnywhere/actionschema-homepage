const explainerHtml = `<i>Each tool is a direct API endpoint with OpenAPI source and documentation, and can be used to build agents, backends, or websites in any framework. For examples, <a  style="text-decoration:none;" href="announcement.html">read the announcement</a>. For elevated access <a href="pricing.html" style="text-decoration:none;">see pricing</a>.</i>`;

class SearchResults extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._searchResults = null;
    this._latestResult = null;
  }

  static get observedAttributes() {
    return ["q"];
  }

  connectedCallback() {
    this.render();
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (name === "q" && oldValue !== newValue) {
      this.performSearch(newValue);
    }
  }

  async performSearch(query) {
    const urlParams = new URLSearchParams(window.location.search);
    const category = urlParams.get("category");

    const baseUrl = `https://search-operations.actionschema.com`;
    const q = encodeURIComponent(query).toLowerCase();

    const categorySuffix = category
      ? `&category=${encodeURIComponent(category).toLowerCase()}`
      : "";

    this.setLoading(true);

    try {
      const recentSearches = JSON.parse(localStorage.getItem("recent") || "[]");
      recentSearches.unshift(query);
      localStorage.setItem(
        "recent",
        JSON.stringify([...new Set(recentSearches)].slice(0, 10)),
      );

      const fullUrl = `${baseUrl}/search?q=${q}${categorySuffix}`;
      console.log({ fullUrl });
      const response = await fetch(fullUrl);
      if (!response.ok) {
        if (response.status === 422) {
          throw new Error("Invalid search query");
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      this.setLoading(false);

      const resultWithTimestamp = {
        ...result,
        createdAt: Date.now(),
      };

      this._searchResults = resultWithTimestamp;
      this.renderResults(resultWithTimestamp, query);
      this.dispatchEvent(
        new CustomEvent("searchCompleted", { detail: resultWithTimestamp }),
      );
    } catch (e) {
      console.error("Search error:", e);
      this.setError(`Search failed: ${e.message}`);
    } finally {
      this.setLoading(false);
    }
  }

  setLoading(loading) {
    if (loading) {
      this.shadowRoot.innerHTML = `
          <style>
            .loading-container {
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              height: 200px;
            }
            .loading-spinner {
              width: 50px;
              height: 50px;
              border: 5px solid #f3f3f3;
              border-top: 5px solid #3498db;
              border-radius: 50%;
              animation: spin 1s linear infinite;
            }
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
            .loading-text {
              margin-top: 20px;
              font-size: 18px;
              color: #333;
            }
          </style>
          <div class="loading-container">
            <div class="loading-spinner"></div>
            <div class="loading-text">Finding Your Actions</div>
          </div>
        `;
    } else {
      const loadingElement =
        this.shadowRoot.querySelector(".loading-container");
      if (loadingElement) {
        loadingElement.remove();
      }
    }
  }

  setError(error) {
    this.shadowRoot.innerHTML = `
        <style>
          .error-message {
            color: #721c24;
            background-color: #f8d7da;
            border: 1px solid #f5c6cb;
            margin-top:20px;
            border-radius: 0.25rem;
            padding: 1rem;
            margin-bottom: 1rem;
          }
        </style>

          <div style="padding:20px;"> <h2>Search Results</h2>
          ${explainerHtml}
        
          
        <div class="error-message">
          ⚠️ ${error}
        </div>
        </div>
      `;
  }

  renderResults(data, query) {
    const results = data.results || [];

    const html = `
        <style>
          .results-list {
            list-style-type: none;
            padding: 0;
            margin: 0;
            padding-top: 20px;
          }
          .result-item {
            background-color: white;
            border-radius: 0.25rem;
            box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
            margin-bottom: 1rem;
            padding: 1rem;
            transition: box-shadow 0.2s;
          }
          .result-item:hover {
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
          }
          .result-header {
            margin-bottom: 0.5rem;
          }
          .result-title {
            margin: 0;
            font-size: 1.2rem;
            color: #2c3e50;
          }

          .result-summary {
            margin: 0.5rem 0;
            color: #34495e;
          }
          .result-links {
            margin-top: 0.5rem;
          }
          .result-link {
            display: inline-block;
            margin-right: 0.5rem;
            padding: 0.25rem 0.5rem;
            border: 0.5px solid #0E499B;
            background-color: transparent;
            color: black;
            text-decoration: none;
            border-radius: 0.15rem;
            font-size: 0.9rem;
          }
          .result-link:hover {
            background-color: lightblue;

          }
          .result-link-primary {
            color:white;
            background-color: #3498db;
          }
          .result-link-primary:hover {
            background-color: #2980b9;
          }


          .timing-info {
            font-size: 0.8rem;
            color: #7f8c8d;
            margin-top: 1rem;
          }
        </style>

        <div style="padding:20px;">
          <h2>Search Results</h2>
          ${explainerHtml}

            <ul class="results-list">
              ${results
                .map((result) => this.renderResult(result, query))
                .join("")}
            </ul>

            <div class="timing-info">
              Search time: ${data.timing.total.toFixed(2)}ms 
              (Vector: ${data.timing.vector.toFixed(
                2,
              )}ms, Data: ${data.timing.redis.toFixed(2)}ms)
            </div>

            <div>
            
            </div>
        </div>
      `;

    this.shadowRoot.innerHTML = html;
  }

  renderResult(result, query) {
    const {
      id,
      operationId,
      openapiUrl,
      summary,
      providerName,
      score,
      overview,
      apiManagementUrl,
    } = result;

    const docsUrl = `search.html?q=${encodeURIComponent(
      query,
    )}&tab=reference&openapiUrl=${encodeURIComponent(
      openapiUrl,
    )}#/operations/${operationId}`;

    const operationOpenapiUrl = `https://openapi-util.actionschema.com/pruneOpenapi?openapiUrl=${encodeURIComponent(
      openapiUrl,
    )}&operationIds=${operationId}`;

    const apiKeyPart = apiManagementUrl
      ? `API Management URL: ${apiManagementUrl}\n\n`
      : "";
    const chatPrompt = `Definition: ${operationOpenapiUrl}
    
Please look up the definition using your fetch-url tool, and then build a website that demonstrates usage of the tool in the definition.

${apiKeyPart}User query:${query}`;
    const writeCodeUrl = `https://chat.actionschema.com/${encodeURIComponent(
      `https://openapi-code-agent.vercel.app/openapi.json`,
    )}?q=${encodeURIComponent(chatPrompt)}`;

    const chatUrl = `https://chat.actionschema.com/${encodeURIComponent(
      operationOpenapiUrl,
    )}?q=test+this+action`;

    const isBeta = localStorage.getItem("beta") === "true";

    return `
        <li class="result-item">
          <div class="result-header">
            <h3 class="result-title">${summary || operationId}</h3>
          </div>
          <p class="result-summary">${providerName}</p>
          <div class="result-links">
            ${
              isBeta
                ? `<a href="${writeCodeUrl}" class="result-link result-link-primary">Chat</a>`
                : ""
            }

            <a href="${docsUrl}" class="result-link">Docs</a>

            <a href="${operationOpenapiUrl}" target="_blank" class="result-link">Source</a>

            ${
              apiManagementUrl
                ? `<a href="${apiManagementUrl}" target="_blank" class="result-link">API Key</a>`
                : ""
            }
          </div>
          <div title="${overview}" style="font-size:9pt; color: gray; margin-top:10px;">ID: ${id} - Relevance Score: ${score.toFixed(
      2,
    )}</div>
        </li>
      `;
  }

  render() {
    const query = this.getAttribute("q");
    if (query) {
      this.performSearch(query);
    } else {
      this.shadowRoot.innerHTML =
        '<div style="margin-left:20px;margin-right:20px;"><p>No search query provided.</p></div>';
    }
  }

  getSearchResults() {
    return this._searchResults;
  }
}

customElements.define("search-results", SearchResults);
