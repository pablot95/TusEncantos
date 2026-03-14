<?php
/**
 * Crea una preferencia de pago en MercadoPago.
 * Recibe JSON con: { items: [...], orderId: "..." }
 * Retorna: { init_point: "https://..." }
 */

require_once __DIR__ . '/mp-config.php';

header('Content-Type: application/json; charset=utf-8');

// CORS
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
$allowed = [SITE_URL, str_replace('https://', 'https://www.', SITE_URL), 'http://localhost'];
if (in_array($origin, $allowed, true)) {
    header("Access-Control-Allow-Origin: $origin");
}
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Método no permitido']);
    exit;
}

// Leer body JSON
$input = json_decode(file_get_contents('php://input'), true);

if (!$input || empty($input['items']) || empty($input['orderId'])) {
    http_response_code(400);
    echo json_encode(['error' => 'Datos incompletos. Se requiere items y orderId.']);
    exit;
}

$orderId = preg_replace('/[^a-zA-Z0-9_\-]/', '', $input['orderId']);
if (empty($orderId)) {
    http_response_code(400);
    echo json_encode(['error' => 'orderId inválido']);
    exit;
}

// Construir items para MercadoPago
$mpItems = [];
foreach ($input['items'] as $item) {
    if (empty($item['name']) || !isset($item['price']) || !isset($item['qty'])) {
        http_response_code(400);
        echo json_encode(['error' => 'Cada item debe tener name, price y qty']);
        exit;
    }

    $price = floatval($item['price']);
    $qty = intval($item['qty']);

    if ($price <= 0 || $qty <= 0) {
        http_response_code(400);
        echo json_encode(['error' => 'Precio y cantidad deben ser positivos']);
        exit;
    }

    $mpItems[] = [
        'title'       => mb_substr($item['name'], 0, 256),
        'quantity'    => $qty,
        'unit_price'  => $price,
        'currency_id' => 'ARS'
    ];
}

// Crear preferencia via API REST de MercadoPago
$preferenceData = [
    'items'      => $mpItems,
    'back_urls'  => [
        'success' => SITE_URL . '/checkout.html?payment=success&orderId=' . $orderId,
        'failure' => SITE_URL . '/checkout.html?payment=failure&orderId=' . $orderId,
        'pending' => SITE_URL . '/checkout.html?payment=pending&orderId=' . $orderId,
    ],
    'auto_return'        => 'approved',
    'external_reference' => $orderId,
    'notification_url'   => SITE_URL . '/api/mp-webhook.php',
    'statement_descriptor' => 'TUS ENCANTOS',
];

// Agregar payer si se envió email
if (!empty($input['payerEmail'])) {
    $preferenceData['payer'] = [
        'email' => filter_var($input['payerEmail'], FILTER_SANITIZE_EMAIL)
    ];
}

$ch = curl_init(MP_API_BASE . '/checkout/preferences');
curl_setopt_array($ch, [
    CURLOPT_HTTPHEADER     => [
        'Content-Type: application/json',
        'Authorization: Bearer ' . MP_ACCESS_TOKEN,
    ],
    CURLOPT_POST           => true,
    CURLOPT_POSTFIELDS     => json_encode($preferenceData),
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT        => 30,
    CURLOPT_SSL_VERIFYPEER => true,
]);

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$curlError = curl_error($ch);
curl_close($ch);

if ($curlError) {
    http_response_code(500);
    echo json_encode(['error' => 'Error de conexión con MercadoPago']);
    exit;
}

$data = json_decode($response, true);

if ($httpCode !== 201 || empty($data['init_point'])) {
    http_response_code(502);
    echo json_encode([
        'error' => 'MercadoPago no pudo crear la preferencia',
        'detail' => $data['message'] ?? 'Error desconocido'
    ]);
    exit;
}

echo json_encode([
    'init_point'      => $data['init_point'],
    'sandbox_init_point' => $data['sandbox_init_point'] ?? $data['init_point'],
    'preference_id'   => $data['id']
]);
