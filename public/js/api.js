// Client API client for Attendance Management System
const api = {
  async get(url, params = {}) {
    const query = new URLSearchParams(params).toString();
    const endpoint = query ? `${url}?${query}` : url;
    const res = await fetch(endpoint);
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Failed to fetch data');
    return json;
  },

  async post(url, body) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Failed to submit request');
    return json;
  },

  async put(url, body) {
    const res = await fetch(url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Failed to update resource');
    return json;
  },

  async patch(url, body) {
    const res = await fetch(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Failed to update resource');
    return json;
  },

  async delete(url) {
    const res = await fetch(url, { method: 'DELETE' });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Failed to delete resource');
    return json;
  }
};

window.api = api;
