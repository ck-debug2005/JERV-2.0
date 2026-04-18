<?php

declare(strict_types=1);

$app = require dirname(__DIR__) . '/bootstrap.php';
/** @var PDO $pdo */
$pdo = $app['pdo'];
/** @var array<string,mixed> $config */
$config = $app['config'];

require_once dirname(__DIR__) . '/src/ApiDispatch.php';

Http::cors($config);

try {
    modern_shop_dispatch($pdo, $config);
} catch (Throwable $e) {
    error_log((string) $e);
    Http::json(['error' => 'Server error'], 500);
}
