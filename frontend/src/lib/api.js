const getCookie = (name) => {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(`(^|;) ?${name}=([^;]*)(;|$)`);
  return match ? match[2] : null;
};

const isDevFrontendOnly = () =>
  import.meta.env.DEV && typeof window !== 'undefined' && window.location.port === '5173';

const demoUser = {
  id: 1,
  username: 'admin',
  display_name: 'admin',
  role: 'admin',
  role_label: '超级管理员',
  is_staff: true,
  is_superuser: true,
  must_change_password: false,
};

const getStoredDemoUser = () => {
  try {
    const raw = localStorage.getItem('current_user_info');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const createJsonResponse = (payload, status = 200, statusText = 'OK') => {
  const response = {
    ok: status >= 200 && status < 300,
    status,
    statusText,
    json: async () => payload,
    text: async () => JSON.stringify(payload),
  };
  response.clone = () => createJsonResponse(payload, status, statusText);
  return response;
};

const getDemoApiResponse = (url, options = {}) => {
  if (!isDevFrontendOnly() || !String(url).startsWith('/api/')) return null;

  const method = String(options.method || 'GET').toUpperCase();
  if (url === '/api/csrf/') {
    return createJsonResponse({ status: 'success', csrfToken: 'dev-csrf-token' });
  }

  if (url === '/api/me/') {
    const storedUser = getStoredDemoUser();
    if (storedUser?.username) {
      return createJsonResponse({ status: 'success', user: storedUser });
    }
    return createJsonResponse({ status: 'error', message: '未登录' }, 401, 'Unauthorized');
  }

  if (url === '/api/logout/') {
    return createJsonResponse({ status: 'success' });
  }

  if (url === '/api/version/') {
    return createJsonResponse({
      backend: {
        version: 'local-dev-preview',
        commit: 'frontend-only',
        branch: 'codex/ipam-20260703',
      },
    });
  }

  if (url === '/api/system/overview/') {
    return createJsonResponse({
      backend: {
        version: 'local-dev-preview',
        commit: 'frontend-only',
        branch: 'codex/ipam-20260703',
      },
      counts: {},
      backup: { backup_count: 0 },
      data_quality: { suspected_records: 0 },
    });
  }

  if (method === 'GET') {
    return createJsonResponse({ results: [] });
  }

  return createJsonResponse({ status: 'success' });
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

    const demoResponse = getDemoApiResponse(url, options);
    if (demoResponse) return demoResponse;

    if (options.method && options.method !== 'GET') {
      const token = getCookie('csrftoken');
      if (token) {
        options.headers = { ...options.headers, 'X-CSRFToken': token };
      }
    }

    return await fetch(url, {
      credentials: 'same-origin',
      ...options,
    });
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
  if (isDevFrontendOnly()) {
    const normalizedUsername = String(username || '').trim();
    if (normalizedUsername === 'admin' && password === 'pass12345') {
      return createJsonResponse({
        status: 'success',
        csrfToken: 'dev-csrf-token',
        user: demoUser,
        requires_password_change: false,
      });
    }
    return createJsonResponse({ status: 'error', message: '本地预览账号为 admin / pass12345' }, 401, 'Unauthorized');
  }

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

export const fetchBackendVersion = async () => safeFetch('/api/version/');

export const fetchSystemOverview = async () => safeFetch('/api/system/overview/');

export const previewIpImport = async ({ file, config }) => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('config', JSON.stringify(config || {}));
  return safeFetch('/api/import-excel/preview/', { method: 'POST', body: formData });
};

export const previewDcimImport = async ({ file }) => {
  const formData = new FormData();
  formData.append('file', file);
  return safeFetch('/api/dcim/import-excel/preview/', { method: 'POST', body: formData });
};

export const previewResidentImport = async ({ file }) => {
  const formData = new FormData();
  formData.append('file', file);
  return safeFetch('/api/resident-staff/preview_import_excel/', { method: 'POST', body: formData });
};
