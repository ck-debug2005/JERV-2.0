<?php

declare(strict_types=1);

final class Http
{
    public static function cors(array $config): void
    {
        $origin = $config['cors_origin'] ?? '*';
        header('Access-Control-Allow-Origin: ' . $origin);
        header('Access-Control-Allow-Methods: GET, POST, PATCH, OPTIONS');
        header('Access-Control-Allow-Headers: Authorization, Content-Type');
        if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
            http_response_code(204);
            exit;
        }
    }

    public static function json(mixed $data, int $code = 200): never
    {
        header('Content-Type: application/json; charset=utf-8');
        http_response_code($code);
        echo json_encode($data, JSON_THROW_ON_ERROR);
        exit;
    }

    public static function readJson(): array
    {
        $raw = file_get_contents('php://input') ?: '';
        if ($raw === '') {
            return [];
        }
        $data = json_decode($raw, true);
        return is_array($data) ? $data : [];
    }

    public static function bearer(): ?string
    {
        $auth = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
        if (preg_match('/Bearer\s+(\S+)/i', $auth, $m)) {
            return $m[1];
        }

        return null;
    }

    public static function rowUser(array $row): array
    {
        return [
            'id' => (int) $row['id'],
            'email' => $row['email'],
            'name' => $row['name'],
            'role' => $row['role'],
            'picture' => $row['picture'] ?: null,
            'googleLinked' => !empty($row['google_sub']),
        ];
    }
}
