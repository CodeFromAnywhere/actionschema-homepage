class SearchResults extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._searchResults = null;
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
    const baseUrl = `https://search.actionschema.com`;
    const q = encodeURIComponent(query).toLowerCase();
    const storageKey = `search.${q}`;
    const already = localStorage.getItem(storageKey);

    if (!already || JSON.parse(already).createdAt < Date.now() - 86400000) {
      this.setLoading(true);

      try {
        const result = await fetch(
          `${baseUrl}/api/search/providers?q=${q}`,
        ).then((res) => res.json());
        this.setLoading(false);
        localStorage.setItem(storageKey, JSON.stringify(result));
        this._searchResults = result;
        this.renderResults(result);
        this.dispatchEvent(
          new CustomEvent("searchCompleted", { detail: result }),
        );
      } catch (e) {
        this.setError("Query could not be carried out");
        this.setLoading(false);
      }
    } else {
      this.setLoading(false);
      const result = JSON.parse(already);
      this._searchResults = result;
      this.renderResults(result);
      this.dispatchEvent(
        new CustomEvent("searchCompleted", { detail: result }),
      );
    }
  }

  setLoading(loading) {
    if (loading) {
      this.shadowRoot.innerHTML = `<div><i class="fas fa-spinner fa-spin"></i> Finding Your Actions</div>`;
    }
  }

  setError(error) {
    this.shadowRoot.innerHTML = `<div><i class="fas fa-error"></i>${error}</div>`;
  }

  renderResults(data) {
    const beta = localStorage.getItem("beta") === "true";
    const operations = data.operations || [];

    const html = `
            <style>
                /* Include your CSS styles here */
                .operations-list {
                    list-style-type: none;
                    padding: 0;
                    margin: 0;
                }
                .operation-item {
                    background-color: white;
                    border-radius: 0.25rem;
                    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
                    margin-bottom: 1rem;
                    padding: 1rem;
                    transition: box-shadow 0.2s;
                }
                /* Add more styles as needed */
            </style>
            <div>
                <h2>Operations</h2>
                <ul class="operations-list">
                    ${operations
                      .map((op) => this.renderOperation(op, beta))
                      .join("")}
                </ul>
            </div>
        `;

    this.shadowRoot.innerHTML = html;
  }

  renderOperation(op, beta) {
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

    return `
            <li class="operation-item">
                <div class="operation-header">
 <a href="${providerUrl}" target="_blank" class="operation-link"><h3 class="operation-title">${providerSlug}</h3></a>
                </div>

                <p class="operation-id">${operationId}</p>
                <p class="operation-summary">${
                  summary || "No summary available"
                }</p>
                <div class="operation-links">
                    <a href="search.html?openapiUrl=${encodeURIComponent(
                      prunedOpenapiUrl,
                    )}" target="_blank" class="operation-link">Reference</a>
                    ${
                      beta
                        ? `
                            <a href="${loginUrl}" class="operation-link">Login</a>
                            <a href="${buildUrl}" target="_blank" class="operation-link">Build</a>
                            <a href="${prunedOpenapiUrl}" target="_blank" class="operation-link">Definition</a>
                        `
                        : `
                            <a href="#" onclick="let yes = confirm('With BUILD developers can write code using their collected APIs using our LLM. To get early access, you may apply to the pilot program. Are you interested?'); if(yes){ window.location.href = 'https://docs.google.com/forms/d/e/1FAIpQLSckizJWBSb9i-sGiqL6-19JwnhB09LKyWaFXO7bYKXvEFo2Ug/viewform'; }" class="operation-link">Build</a>
                        `
                    }
                </div>
            </li>
        `;
  }

  render() {
    const query = this.getAttribute("q");
    if (query) {
      this.performSearch(query);
    } else {
      this.shadowRoot.innerHTML = "<p>No search query provided.</p>";
    }
  }

  getSearchResults() {
    return this._searchResults;
  }
}

customElements.define("search-results", SearchResults);
