"""
Django settings for core project.
"""
import pymysql
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

# 生产环境密钥从环境变量读取
SECRET_KEY = get_env('DJANGO_SECRET_KEY', 'SECRET_KEY', default='django-insecure-default-key-change-it')

# 调试模式从环境变量读取
DEBUG = get_env_bool('DJANGO_DEBUG', 'DEBUG', default=False)

# 允许的主机
ALLOWED_HOSTS = get_env_list('DJANGO_ALLOWED_HOSTS', 'ALLOWED_HOSTS', default='*')
if not ALLOWED_HOSTS:
    ALLOWED_HOSTS = ['*']

# 🚀 修复 CSRF 信任源
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
    'ipam', # 你的应用
]

MIDDLEWARE = [
    # 'ipam.middleware.SecurityMiddleware', # ⚠️ 注释掉这行，除非你确定编写了该文件，否则会报错
    'django.middleware.security.SecurityMiddleware',
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

# --- Database Configuration (已修复：兼容 MYSQL_ 前缀变量) ---
# 优先读取 DB_ 前缀，读不到则读取 MYSQL_ 前缀 (对应 .env 文件)
DB_HOST = os.environ.get('DB_HOST', 'db')
DB_NAME = os.environ.get('DB_NAME', os.environ.get('MYSQL_DATABASE', 'ipam_system'))
DB_USER = os.environ.get('DB_USER', os.environ.get('MYSQL_USER', 'ipam_admin'))
DB_PASS = os.environ.get('DB_PASS', os.environ.get('MYSQL_PASSWORD', 'password'))

# 🖨️ 调试打印：启动时输出数据库连接信息
print(f"🚀 Django is connecting to MySQL: Host={DB_HOST}, User={DB_USER}, DB={DB_NAME}")

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

# API 设置
REST_FRAMEWORK = {
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.IsAuthenticated',
    ]
}

# --- 生产环境安全与代理设置 ---
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
