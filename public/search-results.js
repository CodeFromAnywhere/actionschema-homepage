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
    const baseUrl = `https://search-operations.actionschema.com`;
    const q = encodeURIComponent(query).toLowerCase();
    const storageKey = `search.${q}`;
    const cachedResult = localStorage.getItem(storageKey);

    if (
      !cachedResult ||
      JSON.parse(cachedResult).createdAt < Date.now() - 86400000
    ) {
      this.setLoading(true);

      try {
        const response = await fetch(`${baseUrl}/search?q=${q}`);
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

        localStorage.setItem(storageKey, JSON.stringify(resultWithTimestamp));
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
    } else {
      const result = JSON.parse(cachedResult);
      this._searchResults = result;
      this.renderResults(result, query);
      this.dispatchEvent(
        new CustomEvent("searchCompleted", { detail: result }),
      );
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
            border-radius: 0.25rem;
            padding: 1rem;
            margin-bottom: 1rem;
          }
        </style>
        <div class="error-message">
          ⚠️ ${error}
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
          .result-id {
            font-size: 0.9rem;
            color: #7f8c8d;
            margin: 0.25rem 0;
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
            background-color: #3498db;
            color: white;
            text-decoration: none;
            border-radius: 0.25rem;
            font-size: 0.9rem;
          }
          .result-link:hover {
            background-color: #2980b9;
          }
          .timing-info {
            font-size: 0.8rem;
            color: #7f8c8d;
            margin-top: 1rem;
          }
        </style>
        <div style="padding:20px;">
          <h2>Tools</h2>
          ${
            results.length > 0
              ? `
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
          `
              : `
            <p>No tools found.</p>
            <p>Please <a href="https://docs.google.com/forms/d/10V-SOE4ec0WVUIZm9AAepzs9JhL2cpWutqJdB32zaBE/edit?pli=1">fill in this form</a> to provide feedback on what you are looking for, and to request early access to beta features.</a>
          `
          }
        </div>
      `;

    this.shadowRoot.innerHTML = html;
  }

  renderResult(result, query) {
    const { id, operationId, openapiUrl, summary, providerName, score } =
      result;

    const docsUrl = `search.html?q=${encodeURIComponent(
      query,
    )}&tab=reference&openapiUrl=${encodeURIComponent(
      openapiUrl,
    )}#/operations/${operationId}`;

    const operationOpenapiUrl = `https://openapi-util.actionschema.com/pruneOpenapi?openapiUrl=${encodeURIComponent(
      openapiUrl,
    )}&operationIds=${operationId}`;
    // <a href="https://chat.actionschema.com/${encodeURIComponent(operationOpenapiUrl)}" target="_blank" class="result-link">Chat</a>

    return `
        <li class="result-item">
          <div class="result-header">
            <h3 class="result-title">${providerName}/${operationId}</h3>
            <div class="result-id">ID: ${id}</div>
          </div>
          <p class="result-summary">${summary || "No summary available"}</p>
          <div class="result-links">
            <a href="${docsUrl}" class="result-link">Docs</a>
            <a href="${operationOpenapiUrl}" target="_blank" class="result-link">Source</a>
            
          </div>
          <div>Relevance Score: ${score.toFixed(2)}</div>
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
