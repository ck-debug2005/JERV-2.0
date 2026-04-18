<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/lib/Http.php';
require_once dirname(__DIR__) . '/lib/Jwt.php';

/**
 * @param PDO $pdo
 * @param array<string,mixed> $config
 */
function modern_shop_dispatch(PDO $pdo, array $config): never
{
    $secret = (string) ($config['jwt_secret'] ?? '');
    $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
    $path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';

    $requireUser = static function () use ($pdo, $secret, $config): array {
        $token = Http::bearer();
        if (!$token) {
            Http::json(['error' => 'Unauthorized'], 401);
        }
        try {
            $payload = Jwt::verify($token, $secret);
        } catch (Throwable) {
            Http::json(['error' => 'Invalid token'], 401);
        }
        $userId = (int) ($payload['sub'] ?? 0);
        $stmt = $pdo->prepare('SELECT * FROM users WHERE id = ?');
        $stmt->execute([$userId]);
        $row = $stmt->fetch();
        if (!$row) {
            Http::json(['error' => 'User not found'], 404);
        }

        return [$row, $payload];
    };

    if ($path === '/api/health' && $method === 'GET') {
        Http::json(['ok' => true]);
    }

    if ($path === '/api/categories' && $method === 'GET') {
        $rows = $pdo->query('SELECT id, name FROM categories ORDER BY name')->fetchAll();
        Http::json($rows);
    }

    if ($path === '/api/products' && $method === 'GET') {
        $categoryId = isset($_GET['categoryId']) ? (int) $_GET['categoryId'] : 0;
        $sql = 'SELECT p.id, p.name, p.description, p.price, p.image_url AS image,
                c.id AS category_id, c.name AS category
                FROM products p
                JOIN categories c ON c.id = p.category_id';
        if ($categoryId > 0) {
            $sql .= ' WHERE p.category_id = ? ORDER BY p.name';
            $stmt = $pdo->prepare($sql);
            $stmt->execute([$categoryId]);
        } else {
            $sql .= ' ORDER BY p.name';
            $stmt = $pdo->query($sql);
        }
        Http::json($stmt->fetchAll());
    }

    if ($path === '/api/auth/register' && $method === 'POST') {
        $body = Http::readJson();
        $email = strtolower(trim((string) ($body['email'] ?? '')));
        $password = (string) ($body['password'] ?? '');
        $name = trim((string) ($body['name'] ?? ''));
        if ($email === '' || $password === '' || $name === '') {
            Http::json(['error' => 'email, password, and name are required'], 400);
        }
        if (strlen($password) < 8) {
            Http::json(['error' => 'Password must be at least 8 characters'], 400);
        }
        $hash = password_hash($password, PASSWORD_BCRYPT);
        try {
            $stmt = $pdo->prepare(
                'INSERT INTO users (email, password_hash, name, role) VALUES (?,?,?, "user")',
            );
            $stmt->execute([$email, $hash, $name]);
            $id = (int) $pdo->lastInsertId();
        } catch (Throwable) {
            Http::json(['error' => 'Email already registered'], 409);
        }
        $stmt = $pdo->prepare('SELECT * FROM users WHERE id = ?');
        $stmt->execute([$id]);
        $row = $stmt->fetch();
        $user = Http::rowUser($row);
        $token = Jwt::sign(['sub' => $user['id'], 'role' => $user['role']], $secret);
        Http::json(['token' => $token, 'user' => $user], 201);
    }

    if ($path === '/api/auth/login' && $method === 'POST') {
        $body = Http::readJson();
        $email = strtolower(trim((string) ($body['email'] ?? '')));
        $password = (string) ($body['password'] ?? '');
        if ($email === '' || $password === '') {
            Http::json(['error' => 'email and password are required'], 400);
        }
        $stmt = $pdo->prepare('SELECT * FROM users WHERE email = ?');
        $stmt->execute([$email]);
        $row = $stmt->fetch();
        if (!$row || empty($row['password_hash']) || !password_verify($password, $row['password_hash'])) {
            Http::json(['error' => 'Invalid email or password'], 401);
        }
        $user = Http::rowUser($row);
        $token = Jwt::sign(['sub' => $user['id'], 'role' => $user['role']], $secret);
        Http::json(['token' => $token, 'user' => $user]);
    }

    if ($path === '/api/auth/google' && $method === 'POST') {
        $body = Http::readJson();
        $accessToken = (string) ($body['accessToken'] ?? '');
        if ($accessToken === '') {
            Http::json(['error' => 'accessToken is required'], 400);
        }
        $ctx = stream_context_create([
            'http' => [
                'header' => "Authorization: Bearer {$accessToken}\r\n",
                'timeout' => 10,
            ],
        ]);
        $raw = @file_get_contents('https://www.googleapis.com/oauth2/v3/userinfo', false, $ctx);
        if ($raw === false) {
            Http::json(['error' => 'Invalid Google token'], 401);
        }
        /** @var array<string,mixed> $profile */
        $profile = json_decode($raw, true, 512, JSON_THROW_ON_ERROR);
        $sub = (string) ($profile['sub'] ?? '');
        $email = strtolower((string) ($profile['email'] ?? ''));
        if ($sub === '' || $email === '') {
            Http::json(['error' => 'Google profile incomplete'], 400);
        }
        $stmt = $pdo->prepare('SELECT * FROM users WHERE google_sub = ?');
        $stmt->execute([$sub]);
        $row = $stmt->fetch();
        if (!$row) {
            $stmt = $pdo->prepare('SELECT * FROM users WHERE email = ?');
            $stmt->execute([$email]);
            $row = $stmt->fetch();
        }
        $name = (string) ($profile['name'] ?? 'Google User');
        $picture = (string) ($profile['picture'] ?? '');
        if ($row) {
            $nextName = $name !== '' ? $name : $row['name'];
            $stmt = $pdo->prepare(
                'UPDATE users SET google_sub = ?, picture = ?, name = ? WHERE id = ?',
            );
            $stmt->execute([$sub, $picture ?: null, $nextName, $row['id']]);
            $stmt = $pdo->prepare('SELECT * FROM users WHERE id = ?');
            $stmt->execute([$row['id']]);
            $row = $stmt->fetch();
        } else {
            $stmt = $pdo->prepare(
                'INSERT INTO users (email, password_hash, name, role, google_sub, picture) VALUES (?, NULL, ?, "user", ?, ?)',
            );
            $stmt->execute([$email, $name, $sub, $picture ?: null]);
            $id = (int) $pdo->lastInsertId();
            $stmt = $pdo->prepare('SELECT * FROM users WHERE id = ?');
            $stmt->execute([$id]);
            $row = $stmt->fetch();
        }
        $user = Http::rowUser($row);
        $token = Jwt::sign(['sub' => $user['id'], 'role' => $user['role']], $secret);
        Http::json(['token' => $token, 'user' => $user]);
    }

    if ($path === '/api/auth/me' && $method === 'GET') {
        [$row] = $requireUser();
        Http::json(Http::rowUser($row));
    }

    if ($path === '/api/users/me' && $method === 'PATCH') {
        [$row] = $requireUser();
        $body = Http::readJson();
        $name = trim((string) ($body['name'] ?? ''));
        if ($name === '') {
            Http::json(['error' => 'name is required'], 400);
        }
        $stmt = $pdo->prepare('UPDATE users SET name = ? WHERE id = ?');
        $stmt->execute([$name, $row['id']]);
        $stmt = $pdo->prepare('SELECT * FROM users WHERE id = ?');
        $stmt->execute([$row['id']]);
        Http::json(Http::rowUser($stmt->fetch()));
    }

    if ($path === '/api/orders' && $method === 'POST') {
        [$row] = $requireUser();
        $body = Http::readJson();
        $items = $body['items'] ?? null;
        if (!is_array($items) || count($items) === 0) {
            Http::json(['error' => 'items array required'], 400);
        }
        try {
            $pdo->beginTransaction();
            $subtotal = 0.0;
            $resolved = [];
            foreach ($items as $line) {
                $productId = (int) ($line['productId'] ?? 0);
                $quantity = (int) ($line['quantity'] ?? 0);
                if ($productId <= 0 || $quantity <= 0) {
                    throw new RuntimeException('BAD_ITEM');
                }
                $stmt = $pdo->prepare('SELECT id, price, name FROM products WHERE id = ?');
                $stmt->execute([$productId]);
                $product = $stmt->fetch();
                if (!$product) {
                    throw new RuntimeException('UNKNOWN_PRODUCT');
                }
                $price = (float) $product['price'];
                $subtotal += $price * $quantity;
                $resolved[] = ['product' => $product, 'quantity' => $quantity, 'unit' => $price];
            }
            $shipping = $subtotal > 0 ? 8.0 : 0.0;
            $total = $subtotal + $shipping;
            $stmt = $pdo->prepare(
                'INSERT INTO orders (user_id, status, subtotal, shipping, total) VALUES (?, "placed", ?, ?, ?)',
            );
            $stmt->execute([$row['id'], $subtotal, $shipping, $total]);
            $orderId = (int) $pdo->lastInsertId();
            $ins = $pdo->prepare(
                'INSERT INTO order_items (order_id, product_id, quantity, unit_price) VALUES (?,?,?,?)',
            );
            foreach ($resolved as $r) {
                $ins->execute([$orderId, $r['product']['id'], $r['quantity'], $r['unit']]);
            }
            $pdo->commit();
        } catch (RuntimeException $e) {
            $pdo->rollBack();
            if ($e->getMessage() === 'BAD_ITEM') {
                Http::json(['error' => 'Each item needs valid productId and quantity'], 400);
            }
            if ($e->getMessage() === 'UNKNOWN_PRODUCT') {
                Http::json(['error' => 'Unknown product in cart'], 400);
            }
            throw $e;
        } catch (Throwable $e) {
            $pdo->rollBack();
            throw $e;
        }
        $stmt = $pdo->prepare(
            'SELECT id, status, subtotal, shipping, total, created_at AS createdAt FROM orders WHERE id = ?',
        );
        $stmt->execute([$orderId]);
        Http::json($stmt->fetch(), 201);
    }

    if ($path === '/api/orders' && $method === 'GET') {
        [$row] = $requireUser();
        $stmt = $pdo->prepare(
            'SELECT id, status, subtotal, shipping, total, created_at AS createdAt FROM orders WHERE user_id = ? ORDER BY created_at DESC',
        );
        $stmt->execute([$row['id']]);
        $orders = $stmt->fetchAll();
        $itemStmt = $pdo->prepare(
            'SELECT oi.product_id AS productId, p.name, oi.quantity, oi.unit_price AS unitPrice
             FROM order_items oi
             JOIN products p ON p.id = oi.product_id
             WHERE oi.order_id = ?',
        );
        foreach ($orders as &$o) {
            $itemStmt->execute([$o['id']]);
            $o['items'] = $itemStmt->fetchAll();
        }
        unset($o);
        Http::json($orders);
    }

    Http::json(['error' => 'Not found'], 404);
}
