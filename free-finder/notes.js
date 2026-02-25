(function (globalScope) {
  function createNotesStore(initial = []) {
    let notes = [...initial];
    return {
      list(filter = {}) {
        return notes.filter((n) => !filter.category || n.category === filter.category);
      },
      add(note) {
        const item = { id: note.id || `${Date.now()}-${Math.random().toString(16).slice(2)}`, ...note };
        notes.push(item);
        return item;
      },
      remove(id) {
        notes = notes.filter((n) => n.id !== id);
      },
      export() { return [...notes]; },
      import(items = []) { notes = [...items]; }
    };
  }

  const api = { createNotesStore };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  globalScope.RecoFreeNotes = api;
})(typeof window !== "undefined" ? window : globalThis);
