(function (globalScope) {
  function createStore(initial = []) {
    let searches = [...initial];
    return {
      list() { return [...searches]; },
      add(search) {
        const item = { id: search.id || `${Date.now()}-${Math.random().toString(16).slice(2)}`, ...search };
        searches.push(item);
        return item;
      },
      remove(id) {
        searches = searches.filter((s) => s.id !== id);
      },
      get(id) {
        return searches.find((s) => s.id === id) || null;
      },
      import(items = []) {
        searches = [...items];
      }
    };
  }

  const api = { createStore };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  globalScope.RecoDealSearchStore = api;
})(typeof window !== "undefined" ? window : globalThis);
