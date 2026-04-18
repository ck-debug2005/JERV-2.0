<?php

declare(strict_types=1);

final class Jwt
{
    public static function sign(array $payload, string $secret, int $ttlSeconds = 604800): string
    {
        $header = ['typ' => 'JWT', 'alg' => 'HS256'];
        $payload['iat'] = time();
        $payload['exp'] = time() + $ttlSeconds;

        $segments = [
            self::b64url(json_encode($header, JSON_THROW_ON_ERROR)),
            self::b64url(json_encode($payload, JSON_THROW_ON_ERROR)),
        ];
        $signing = implode('.', $segments);
        $signature = hash_hmac('sha256', $signing, $secret, true);
        $segments[] = self::b64url($signature);

        return implode('.', $segments);
    }

    public static function verify(string $jwt, string $secret): array
    {
        $parts = explode('.', $jwt);
        if (count($parts) !== 3) {
            throw new RuntimeException('Invalid token');
        }
        [$h, $p, $s] = $parts;
        $expected = hash_hmac('sha256', "$h.$p", $secret, true);
        $sigBin = self::b64urlDecode($s);
        if (!hash_equals($expected, $sigBin)) {
            throw new RuntimeException('Invalid signature');
        }
        $payload = json_decode(self::b64urlDecode($p), true, 512, JSON_THROW_ON_ERROR);
        if (($payload['exp'] ?? 0) < time()) {
            throw new RuntimeException('Token expired');
        }

        return $payload;
    }

    private static function b64url(string $data): string
    {
        return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
    }

    private static function b64urlDecode(string $data): string
    {
        $remainder = strlen($data) % 4;
        if ($remainder) {
            $data .= str_repeat('=', 4 - $remainder);
        }

        return (string) base64_decode(strtr($data, '-_', '+/'), true);
    }

}
