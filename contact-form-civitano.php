<?php

declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');

function getConfigPath(): string
{
    return __DIR__ . '/env.php';
}

function loadConfig(): array
{
    $configPath = getConfigPath();

    if (!file_exists($configPath)) {
        throw new RuntimeException("SMTP config file not found at: {$configPath}");
    }

    $config = require $configPath;
    if (!is_array($config)) {
        throw new RuntimeException('SMTP config file did not return an array.');
    }

    return $config;
}

try {
    $config = loadConfig();
    foreach ($config as $key => $value) {
        $_ENV[$key] = (string) $value;
        $_SERVER[$key] = (string) $value;
        putenv("{$key}=" . (string) $value);
    }
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

    $connectionString = 'tcp://' . $host . ':' . $port;
    $socket = @stream_socket_client($connectionString, $errno, $errstr, 30, STREAM_CLIENT_CONNECT);
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

    fwrite($socket, "STARTTLS\r\n");
    $response = readSmtpResponse($socket);
    if (strncmp($response, '220', 3) !== 0) {
        fclose($socket);
        throw new RuntimeException('SMTP STARTTLS not accepted: ' . $response);
    }

    stream_context_set_option($socket, 'ssl', 'verify_peer', false);
    stream_context_set_option($socket, 'ssl', 'verify_peer_name', false);
    stream_context_set_option($socket, 'ssl', 'allow_self_signed', true);
    stream_context_set_option($socket, 'ssl', 'crypto_method', STREAM_CRYPTO_METHOD_TLS_CLIENT);

    if (!stream_socket_enable_crypto($socket, true, STREAM_CRYPTO_METHOD_TLS_CLIENT)) {
        fclose($socket);
        throw new RuntimeException('SMTP TLS upgrade failed.');
    }

    fwrite($socket, "EHLO " . gethostname() . "\r\n");
    $response = readSmtpResponse($socket);
    if (strncmp($response, '250', 3) !== 0) {
        fclose($socket);
        throw new RuntimeException('SMTP server rejected EHLO after TLS upgrade: ' . $response);
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
