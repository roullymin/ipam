"""
Django settings for core project.
"""
import pymysql
pymysql.version_info = (2, 2, 1, 'final', 0)
pymysql.install_as_MySQLdb()

import os
from pathlib import Path

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent


def get_env(*names, default=None):
    for name in names:
        value = os.environ.get(name)
        if value is not None:
            return value
    return default


def get_env_bool(*names, default=False):
    value = get_env(*names)
    if value is None:
        return default
    return str(value).strip().lower() in {'1', 'true', 'yes', 'on'}


def get_env_list(*names, default=''):
    raw = get_env(*names, default=default)
    if raw is None:
        return []
    return [item.strip() for item in str(raw).split(',') if item.strip()]

# Read core settings from environment variables.
SECRET_KEY = get_env('DJANGO_SECRET_KEY', 'SECRET_KEY', default='django-insecure-default-key-change-it')

DEBUG = get_env_bool('DJANGO_DEBUG', 'DEBUG', default=False)

ALLOWED_HOSTS = get_env_list('DJANGO_ALLOWED_HOSTS', 'ALLOWED_HOSTS', default='127.0.0.1,localhost')
if not ALLOWED_HOSTS:
    ALLOWED_HOSTS = ['127.0.0.1', 'localhost']
if DEBUG:
    for host in ['127.0.0.1', 'localhost']:
        if host not in ALLOWED_HOSTS:
            ALLOWED_HOSTS.append(host)

CSRF_TRUSTED_ORIGINS = get_env_list('DJANGO_CSRF_TRUSTED_ORIGINS', 'CSRF_TRUSTED_ORIGINS')
if not CSRF_TRUSTED_ORIGINS:
    trusted_hosts = [host for host in ALLOWED_HOSTS if host != '*']
    CSRF_TRUSTED_ORIGINS = [f"https://{host}" for host in trusted_hosts]

# Application definition
INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'rest_framework',
    'ipam', # 浣犵殑搴旂敤
]

MIDDLEWARE = [
    # 'ipam.middleware.SecurityMiddleware', # 鈿狅笍 娉ㄩ噴鎺夎繖琛岋紝闄ら潪浣犵‘瀹氱紪鍐欎簡璇ユ枃浠讹紝鍚﹀垯浼氭姤閿?    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'core.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'core.wsgi.application'

# --- Database Configuration (宸蹭慨澶嶏細鍏煎 MYSQL_ 鍓嶇紑鍙橀噺) ---
# 浼樺厛璇诲彇 DB_ 鍓嶇紑锛岃涓嶅埌鍒欒鍙?MYSQL_ 鍓嶇紑 (瀵瑰簲 .env 鏂囦欢)
DB_HOST = os.environ.get('DB_HOST', 'db')
DB_NAME = os.environ.get('DB_NAME', os.environ.get('MYSQL_DATABASE', 'ipam_system'))
DB_USER = os.environ.get('DB_USER', os.environ.get('MYSQL_USER', 'ipam_admin'))
DB_PASS = os.environ.get('DB_PASS', os.environ.get('MYSQL_PASSWORD', 'password'))

print(f"Django is connecting to MySQL: Host={DB_HOST}, User={DB_USER}, DB={DB_NAME}")

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.mysql',
        'NAME': DB_NAME,
        'USER': DB_USER,
        'PASSWORD': DB_PASS,
        'HOST': DB_HOST,
        'PORT': '3306',
        'OPTIONS': {
            'charset': 'utf8mb4',
        },
    }
}

# API 璁剧疆
REST_FRAMEWORK = {
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.IsAuthenticated',
    ]
}

# --- 鐢熶骇鐜瀹夊叏涓庝唬鐞嗚缃?---
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
USE_X_FORWARDED_HOST = True
USE_X_FORWARDED_PORT = True

# Password validation
AUTH_PASSWORD_VALIDATORS = [
    { 'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator', },
    { 'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator', },
    { 'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator', },
    { 'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator', },
]

# Internationalization
LANGUAGE_CODE = 'zh-hans'
TIME_ZONE = 'Asia/Shanghai'
USE_I18N = True
USE_TZ = True

# Static files
STATIC_URL = 'static/'
STATIC_ROOT = os.path.join(BASE_DIR, 'static')
MEDIA_URL = 'media/'
MEDIA_ROOT = os.path.join(BASE_DIR, 'media')
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'


