// TODO: unfortunatley ///reference doesn't work yet with remote definitions for some reason... it'd be great to either find an editor that supports this better or make it work in here.

const baseUrl = `https://search.actionschema.com`;
const [getData, setData] = useState({});
const [getLoading, setLoading] = useState(true);
const [getError, setError] = useState(null);

const [getHoveredOperation, setHoveredOperation] = useState(null);
const [getHoveredSegment, setHoveredSegment] = useState(null);
const [getSelectedOperations, setSelectedOperations] = useState({});

async function performSearch(query) {
  const result = await getSearch(query);
  setData(result);
}

function handleSearch(event) {
  event.preventDefault();
  const query = event.target.elements.q.value;
  performSearch(query);
  window.history.pushState({}, "", `?q=${encodeURIComponent(query)}`);
}

function toggleOperation(providerSlug, operationId) {
  const selectedOperations = getSelectedOperations();
  const newSelectedOperations = { ...selectedOperations };

  if (!newSelectedOperations[providerSlug]) {
    newSelectedOperations[providerSlug] = [];
  }

  const index = newSelectedOperations[providerSlug].indexOf(operationId);
  if (index > -1) {
    newSelectedOperations[providerSlug].splice(index, 1);
  } else {
    newSelectedOperations[providerSlug].push(operationId);
  }

  if (newSelectedOperations[providerSlug].length === 0) {
    delete newSelectedOperations[providerSlug];
  }

  setSelectedOperations(newSelectedOperations);
}

document.addEventListener("DOMContentLoaded", () => {
  const searchForm = document.getElementById("search-form");
  const searchInput = document.getElementById("search-input");

  const urlParams = new URLSearchParams(window.location.search);
  const query = urlParams.get("q");

  if (query) {
    searchInput.value = query;
    performSearch(query);
  }

  searchForm.addEventListener("submit", handleSearch);
});

reactify();
