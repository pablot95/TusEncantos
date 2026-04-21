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

if (!$input || empty($input['orderId'])) {
    http_response_code(400);
    echo json_encode(['error' => 'Datos incompletos. Se requiere orderId.']);
    exit;
}

$orderId = preg_replace('/[^a-zA-Z0-9_\-]/', '', $input['orderId']);
if (empty($orderId)) {
    http_response_code(400);
    echo json_encode(['error' => 'orderId inválido']);
    exit;
}

// ---- Leer precios desde Firestore (NUNCA confiar en los precios del cliente) ----
// Los precios se obtienen directamente de la orden guardada en Firestore,
// que fue creada con precios verificados desde la base de datos.
define('FIREBASE_PROJECT', 'tusencantos-a09c4');
define('FIREBASE_API_KEY', 'AIzaSyC8Za5OjMa1O2ScfXVSK6dI0ZIBhX_BdHk');

$fsUrl = 'https://firestore.googleapis.com/v1/projects/' . FIREBASE_PROJECT
       . '/databases/(default)/documents/orders/' . $orderId
       . '?key=' . FIREBASE_API_KEY;

$fsCh = curl_init($fsUrl);
curl_setopt_array($fsCh, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT        => 10,
    CURLOPT_SSL_VERIFYPEER => true,
]);
$fsBody     = curl_exec($fsCh);
$fsHttpCode = curl_getinfo($fsCh, CURLINFO_HTTP_CODE);
curl_close($fsCh);

if ($fsHttpCode !== 200) {
    http_response_code(400);
    echo json_encode(['error' => 'Orden no encontrada']);
    exit;
}

$orderDoc = json_decode($fsBody, true);
$fields   = $orderDoc['fields'] ?? [];

// Helper para convertir valores del formato Firestore REST
function fsVal($v) {
    if (!is_array($v)) return null;
    if (array_key_exists('stringValue',  $v)) return (string) $v['stringValue'];
    if (array_key_exists('integerValue', $v)) return (int)    $v['integerValue'];
    if (array_key_exists('doubleValue',  $v)) return (float)  $v['doubleValue'];
    if (array_key_exists('booleanValue', $v)) return (bool)   $v['booleanValue'];
    if (array_key_exists('mapValue',     $v)) {
        $map = [];
        foreach ($v['mapValue']['fields'] ?? [] as $k => $fv) $map[$k] = fsVal($fv);
        return $map;
    }
    if (array_key_exists('arrayValue', $v)) {
        $arr = [];
        foreach ($v['arrayValue']['values'] ?? [] as $fv) $arr[] = fsVal($fv);
        return $arr;
    }
    return null;
}

$orderStatus = fsVal($fields['status'] ?? []);
if ($orderStatus !== 'pending') {
    http_response_code(400);
    echo json_encode(['error' => 'La orden no está disponible para pago']);
    exit;
}

$orderItems = fsVal($fields['items'] ?? ['arrayValue' => ['values' => []]]);
if (empty($orderItems) || !is_array($orderItems)) {
    http_response_code(400);
    echo json_encode(['error' => 'La orden no tiene items']);
    exit;
}

// Construir items para MercadoPago con los precios de Firestore
$mpItems = [];
foreach ($orderItems as $item) {
    $price = floatval($item['price'] ?? 0);
    $qty   = intval($item['qty']   ?? 0);
    $name  = trim($item['name']    ?? '');

    if ($price <= 0 || $qty <= 0 || $name === '') continue;

    $mpItems[] = [
        'title'       => mb_substr($name, 0, 256),
        'quantity'    => $qty,
        'unit_price'  => $price,
        'currency_id' => 'ARS'
    ];
}

if (empty($mpItems)) {
    http_response_code(400);
    echo json_encode(['error' => 'No se pudieron construir los items del pedido']);
    exit;
}

// Email del comprador desde Firestore (no desde el cliente)
$shipping   = fsVal($fields['shipping'] ?? []);
$payerEmail = isset($shipping['email']) ? filter_var($shipping['email'], FILTER_SANITIZE_EMAIL) : '';

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

if (!empty($payerEmail)) {
    $preferenceData['payer'] = ['email' => $payerEmail];
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
    'preference_id'   => $data['id'],
]);
