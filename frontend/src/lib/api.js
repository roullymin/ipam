const getCookie = (name) => {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(`(^|;) ?${name}=([^;]*)(;|$)`);
  return match ? match[2] : null;
};

export const safeFetch = async (url, options = {}) => {
  try {
    if (window.location.protocol === 'blob:' || window.location.origin === 'null') {
      return {
        ok: false,
        status: 0,
        statusText: 'Preview Mode',
        json: async () => ({}),
        text: async () => '',
      };
    }

    if (options.method && options.method !== 'GET') {
      const token = getCookie('csrftoken');
      if (token) {
        options.headers = { ...options.headers, 'X-CSRFToken': token };
      }
    }

    return await fetch(url, options);
  } catch (error) {
    console.warn(`[SafeFetch] 请求异常: ${url}`, error);
    return {
      ok: false,
      status: 0,
      json: async () => ({}),
      text: async () => error.message,
    };
  }
};

export const fetchCsrfToken = async () => safeFetch('/api/csrf/');

export const loginRequest = async ({ username, password }) => {
  await fetchCsrfToken();
  return safeFetch('/api/login/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
};

export const fetchCurrentUser = async () => safeFetch('/api/me/');

export const logoutRequest = async () => safeFetch('/api/logout/', { method: 'POST' });

export const changePasswordRequest = async ({ current_password, new_password }) =>
  safeFetch('/api/change-password/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ current_password, new_password }),
  });
