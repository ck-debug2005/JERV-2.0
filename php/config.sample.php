<?php

/**
 * Copy to config.php and adjust for your MySQL instance.
 * Used by the PHP API (Google OAuth + REST endpoints).
 */
return [
    'db' => [
        'host' => getenv('DB_HOST') ?: '127.0.0.1',
        'port' => getenv('DB_PORT') ?: '3306',
        'name' => getenv('DB_NAME') ?: 'modern_shop',
        'user' => getenv('DB_USER') ?: 'root',
        'pass' => getenv('DB_PASS') ?: '',
    ],
    'jwt_secret' => getenv('JWT_SECRET') ?: 'change-this-php-mysql-secret',
    'cors_origin' => getenv('CORS_ORIGIN') ?: '*',
];
