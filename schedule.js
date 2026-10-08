(function () {
  const KEY = "study_jarvis_schedule_v1";

  function read() {
    try {
      const raw = localStorage.getItem(KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (_) {
      return [];
    }
  }

  function write(items) {
    localStorage.setItem(KEY, JSON.stringify(items));
  }

  window.ScheduleStore = {
    all() { return read(); },
    add(item) {
      const items = read();
      items.push({ ...item, id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()) });
      write(items);
      return items;
    },
    remove(id) {
      const next = read().filter(item => item.id !== id);
      write(next);
      return next;
    },
    markDone(id, done = true) {
      const next = read().map(item => item.id === id ? { ...item, done } : item);
      write(next);
      return next;
    },
    clear() {
      write([]);
      return [];
    }
  };
})();
