<?php

declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');

function getEnvFilePath(): string
{
    return '/home/cz3i0p7j5_ssh/.env';
}

function loadDotEnv(string $path): void
{
    if (!file_exists($path)) {
        throw new RuntimeException(".env file not found at: {$path}");
    }

    if (!is_file($path)) {
        throw new RuntimeException("Path exists but is not a regular file: {$path}");
    }

    if (!is_readable($path)) {
        $permissionBits = @fileperms($path);
        $formattedPermissions = $permissionBits !== false ? decoct($permissionBits & 0777) : 'unknown';

        throw new RuntimeException(
            ".env file exists but is not readable by PHP. Path: {$path}. Permissions: {$formattedPermissions}. " .
            'This usually means the file owner or permissions do not match the web server user.'
        );
    }

    $lines = @file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    if ($lines === false) {
        throw new RuntimeException('Unable to read .env file: ' . $path);
    }

    foreach ($lines as $line) {
        $trimmed = trim($line);
        if ($trimmed === '' || str_starts_with($trimmed, '#') || str_starts_with($trimmed, ';')) {
            continue;
        }

        if (preg_match('/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)=(.*)$/', $trimmed, $matches) !== 1) {
            continue;
        }

        $key = $matches[1];
        $value = trim($matches[2]);

        if (preg_match('/^"(.*)"$/s', $value, $quotedValues) === 1 || preg_match("/^'(.*)'$/s", $value, $quotedValues) === 1) {
            $value = $quotedValues[1];
        } else {
            $value = preg_replace('/\s+#.*$/', '', $value);
            $value = trim($value);
        }

        $_ENV[$key] = $value;
        $_SERVER[$key] = $value;
        putenv("{$key}={$value}");
    }
}

try {
    loadDotEnv(getEnvFilePath());
} catch (Throwable $exception) {
    sendJson(500, [
        'success' => false,
        'error' => 'Environment configuration error',
        'details' => $exception->getMessage(),
    ]);
}

function sendJson(int $statusCode, array $payload): void
{
    http_response_code($statusCode);
    echo json_encode($payload);
    exit;
}

function readSmtpResponse($socket): string
{
    $response = '';

    while (!feof($socket)) {
        $line = fgets($socket, 515);
        if ($line === false) {
            break;
        }

        $response .= $line;

        if (preg_match('/\r\n$/', $line) === 1 && strlen($line) >= 3 && substr($line, 3, 1) === ' ') {
            break;
        }
    }

    return trim($response);
}

function sendSmtpEmail(string $htmlBody): void
{
    $host = getenv('EXCHANGE_HOST') ?: $_ENV['EXCHANGE_HOST'] ?? '';
    $port = (int) (getenv('EXCHANGE_PORT') ?: $_ENV['EXCHANGE_PORT'] ?? 465);
    $username = getenv('EXCHANGE_EMAIL_CIVITANO') ?: $_ENV['EXCHANGE_EMAIL_CIVITANO'] ?? '';
    $password = getenv('EXCHANGE_PASSWORD_CIVITANO') ?: $_ENV['EXCHANGE_PASSWORD_CIVITANO'] ?? '';
    $recipient = getenv('RECIPIENT_ADDRESS') ?: $_ENV['RECIPIENT_ADDRESS'] ?? '';

    if ($host === '' || $username === '' || $password === '' || $recipient === '') {
        throw new RuntimeException('Missing SMTP configuration. Set EXCHANGE_HOST, EXCHANGE_PORT, EXCHANGE_EMAIL_CIVITANO, EXCHANGE_PASSWORD_CIVITANO and RECIPIENT_ADDRESS.');
    }

    $connectionString = 'ssl://' . $host . ':' . $port;
    $context = stream_context_create([
        'ssl' => [
            'verify_peer' => false,
            'verify_peer_name' => false,
            'allow_self_signed' => true,
        ],
    ]);

    $socket = @stream_socket_client($connectionString, $errno, $errstr, 30, STREAM_CLIENT_CONNECT, $context);
    if ($socket === false) {
        throw new RuntimeException(sprintf('SMTP connection failed: %s (%d)', $errstr, $errno));
    }

    stream_set_timeout($socket, 30);

    $greeting = readSmtpResponse($socket);
    if (strncmp($greeting, '220', 3) !== 0) {
        fclose($socket);
        throw new RuntimeException('SMTP server did not accept the connection: ' . $greeting);
    }

    fwrite($socket, "EHLO " . gethostname() . "\r\n");
    $response = readSmtpResponse($socket);
    if (strncmp($response, '250', 3) !== 0) {
        fwrite($socket, "HELO " . gethostname() . "\r\n");
        $response = readSmtpResponse($socket);
        if (strncmp($response, '250', 3) !== 0) {
            fclose($socket);
            throw new RuntimeException('SMTP server rejected EHLO/HELO: ' . $response);
        }
    }

    fwrite($socket, "AUTH LOGIN\r\n");
    $response = readSmtpResponse($socket);
    if (strncmp($response, '334', 3) !== 0) {
        fclose($socket);
        throw new RuntimeException('SMTP AUTH LOGIN not accepted: ' . $response);
    }

    fwrite($socket, base64_encode($username) . "\r\n");
    $response = readSmtpResponse($socket);
    if (strncmp($response, '334', 3) !== 0) {
        fclose($socket);
        throw new RuntimeException('SMTP username authentication step failed: ' . $response);
    }

    fwrite($socket, base64_encode($password) . "\r\n");
    $response = readSmtpResponse($socket);
    if (strncmp($response, '235', 3) !== 0) {
        fclose($socket);
        throw new RuntimeException('SMTP authentication failed: ' . $response);
    }

    fwrite($socket, "MAIL FROM:<{$username}>\r\n");
    $response = readSmtpResponse($socket);
    if (strncmp($response, '250', 3) !== 0) {
        fclose($socket);
        throw new RuntimeException('SMTP MAIL FROM failed: ' . $response);
    }

    fwrite($socket, "RCPT TO:<{$recipient}>\r\n");
    $response = readSmtpResponse($socket);
    if (strncmp($response, '250', 3) !== 0 && strncmp($response, '251', 3) !== 0) {
        fclose($socket);
        throw new RuntimeException('SMTP RCPT TO failed: ' . $response);
    }

    fwrite($socket, "DATA\r\n");
    $response = readSmtpResponse($socket);
    if (strncmp($response, '354', 3) !== 0) {
        fclose($socket);
        throw new RuntimeException('SMTP DATA command failed: ' . $response);
    }

    $message = "From: {$username}\r\n";
    $message .= "To: {$recipient}\r\n";
    $message .= "Subject: CIVITANO\r\n";
    $message .= "MIME-Version: 1.0\r\n";
    $message .= "Content-Type: text/html; charset=UTF-8\r\n\r\n";
    $message .= $htmlBody . "\r\n." . "\r\n";

    fwrite($socket, $message);
    $response = readSmtpResponse($socket);
    if (strncmp($response, '250', 3) !== 0) {
        fclose($socket);
        throw new RuntimeException('SMTP message send failed: ' . $response);
    }

    fwrite($socket, "QUIT\r\n");
    readSmtpResponse($socket);
    fclose($socket);
}

function getFormValue(string $key, string $fallback = ''): string
{
    if (isset($_POST[$key])) {
        return trim((string) $_POST[$key]);
    }

    if (isset($_GET[$key])) {
        return trim((string) $_GET[$key]);
    }

    return $fallback;
}

try {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        sendJson(405, ['success' => false, 'error' => 'Only POST requests are supported.']);
    }

    $vorname = getFormValue('vorname');
    $nachname = getFormValue('nachname');
    $email = getFormValue('email');
    $phone = getFormValue('telefon');
    $message = getFormValue('message');
    $sprache = getFormValue('sprache');
    $interesse = getFormValue('interesse');

    $htmlBody = <<<HTML
<!DOCTYPE html>
<html>
<head>
  <meta content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=yes" name="viewport">
  <meta content="noindex,nofollow" name="robots">
</head>
<body>
  <div id="ps-kontaktanfrage">
    <p>
      Vorname:
      <span id="client_first_name">{$vorname}</span>
    </p>
    <p>
      Nachname:
      <span id="client_last_name">{$nachname}</span>
    </p>
    <p>
      E-Mail:
      <span id="client_email">{$email}</span>
    </p>
    <p>
      Telefon:
      <span id="client_phone">{$phone}</span>
    </p>
    <p>
      Sprache:
      <span id="client_locale">{$sprache}</span>
    </p>
    <p>
      Interesse:
      <span>{$interesse}</span>
    </p>
    <p>
      Nachricht:
      <span id="body">{$message}</span>
    </p>

    <hr>

    <p>civitano</p>
    <p style="display: none;">
      <span id="project_id">253480</span>
    </p>
  </div>
</body>
</html>
HTML;

    sendSmtpEmail($htmlBody);

    sendJson(200, ['success' => true]);
} catch (Throwable $exception) {
    error_log('Error processing contact form: ' . $exception->getMessage());
    sendJson(500, ['success' => false, 'error' => $exception->getMessage()]);
}
