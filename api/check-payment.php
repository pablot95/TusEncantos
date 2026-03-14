<?php
/**
 * Verifica el estado de pago de una orden.
 * Recibe: ?orderId=XXXXX
 * Retorna: { status: "approved"|"pending"|"rejected"|"not_found", ... }
 */

require_once __DIR__ . '/mp-config.php';

header('Content-Type: application/json; charset=utf-8');

// CORS
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
$allowed = [SITE_URL, str_replace('https://', 'https://www.', SITE_URL), 'http://localhost'];
if (in_array($origin, $allowed, true)) {
    header("Access-Control-Allow-Origin: $origin");
}
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['error' => 'Método no permitido']);
    exit;
}

$orderId = preg_replace('/[^a-zA-Z0-9_\-]/', '', $_GET['orderId'] ?? '');
if (empty($orderId)) {
    http_response_code(400);
    echo json_encode(['error' => 'orderId requerido']);
    exit;
}

$filePath = __DIR__ . '/../payments/' . $orderId . '.json';

if (!file_exists($filePath)) {
    echo json_encode(['status' => 'not_found', 'orderId' => $orderId]);
    exit;
}

$data = json_decode(file_get_contents($filePath), true);

echo json_encode([
    'status'        => $data['status'] ?? 'unknown',
    'status_detail' => $data['status_detail'] ?? '',
    'orderId'       => $orderId,
    'amount'        => $data['amount'] ?? 0,
    'payment_id'    => $data['payment_id'] ?? null,
    'date_approved' => $data['date_approved'] ?? null,
]);
