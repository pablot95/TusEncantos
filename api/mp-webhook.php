<?php
/**
 * Webhook de MercadoPago.
 * Recibe notificaciones IPN/Webhook cuando un pago cambia de estado.
 * Verifica el pago con la API de MercadoPago y guarda el resultado.
 */

require_once __DIR__ . '/mp-config.php';

// Siempre responder 200 OK a MercadoPago para evitar reintentos innecesarios
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(200);
    echo json_encode(['status' => 'ok']);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true);

// MercadoPago envía { type: "payment", data: { id: "123456" } }
if (empty($input['type']) || $input['type'] !== 'payment' || empty($input['data']['id'])) {
    http_response_code(200);
    echo json_encode(['status' => 'ignored']);
    exit;
}

$paymentId = intval($input['data']['id']);
if ($paymentId <= 0) {
    http_response_code(200);
    echo json_encode(['status' => 'invalid_id']);
    exit;
}

// Consultar el pago a MercadoPago para verificar
$ch = curl_init(MP_API_BASE . '/v1/payments/' . $paymentId);
curl_setopt_array($ch, [
    CURLOPT_HTTPHEADER     => [
        'Authorization: Bearer ' . MP_ACCESS_TOKEN,
    ],
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT        => 30,
    CURLOPT_SSL_VERIFYPEER => true,
]);

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

if ($httpCode !== 200) {
    error_log("MP Webhook: Error al consultar pago $paymentId - HTTP $httpCode");
    http_response_code(200);
    echo json_encode(['status' => 'mp_error']);
    exit;
}

$payment = json_decode($response, true);

// Guardar registro del pago
$logDir = __DIR__ . '/../payments/';
if (!is_dir($logDir)) {
    mkdir($logDir, 0755, true);
}

$logEntry = [
    'payment_id'         => $paymentId,
    'status'             => $payment['status'] ?? 'unknown',
    'status_detail'      => $payment['status_detail'] ?? '',
    'external_reference' => $payment['external_reference'] ?? '',
    'amount'             => $payment['transaction_amount'] ?? 0,
    'currency'           => $payment['currency_id'] ?? 'ARS',
    'payer_email'        => $payment['payer']['email'] ?? '',
    'date_approved'      => $payment['date_approved'] ?? null,
    'received_at'        => date('c'),
];

$orderId = preg_replace('/[^a-zA-Z0-9_\-]/', '', $logEntry['external_reference']);
if ($orderId) {
    $filePath = $logDir . $orderId . '.json';
    file_put_contents($filePath, json_encode($logEntry, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
}

// Log general
$allLog = $logDir . 'webhook-log.jsonl';
file_put_contents($allLog, json_encode($logEntry) . "\n", FILE_APPEND | LOCK_EX);

http_response_code(200);
echo json_encode(['status' => 'ok']);
