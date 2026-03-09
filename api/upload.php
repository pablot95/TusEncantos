<?php
header('Content-Type: application/json');

// CORS — ajustá el dominio en producción
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
$allowed = ['https://tusencantos.com', 'https://www.tusencantos.com', 'http://localhost'];
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

// Clave simple para evitar subidas no autorizadas
$secret = $_POST['secret'] ?? '';
if ($secret !== 'TusEncantosUpload2026!') {
    http_response_code(403);
    echo json_encode(['error' => 'No autorizado']);
    exit;
}

if (!isset($_FILES['image']) || $_FILES['image']['error'] !== UPLOAD_ERR_OK) {
    http_response_code(400);
    echo json_encode(['error' => 'No se recibió imagen válida']);
    exit;
}

$file = $_FILES['image'];

// Validar tipo MIME real
$finfo = new finfo(FILEINFO_MIME_TYPE);
$mime = $finfo->file($file['tmp_name']);
$allowedMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

if (!in_array($mime, $allowedMimes, true)) {
    http_response_code(400);
    echo json_encode(['error' => 'Tipo de archivo no permitido. Solo JPG, PNG, WebP o GIF.']);
    exit;
}

// Límite 5MB
if ($file['size'] > 5 * 1024 * 1024) {
    http_response_code(400);
    echo json_encode(['error' => 'La imagen no puede superar los 5MB']);
    exit;
}

// Extensión según MIME
$extensions = [
    'image/jpeg' => 'jpg',
    'image/png'  => 'png',
    'image/webp' => 'webp',
    'image/gif'  => 'gif',
];
$ext = $extensions[$mime];

// Nombre único
$fileName = bin2hex(random_bytes(12)) . '.' . $ext;

$uploadDir = __DIR__ . '/../uploads/';
if (!is_dir($uploadDir)) {
    mkdir($uploadDir, 0755, true);
}

$dest = $uploadDir . $fileName;

if (!move_uploaded_file($file['tmp_name'], $dest)) {
    http_response_code(500);
    echo json_encode(['error' => 'Error al guardar la imagen']);
    exit;
}

echo json_encode([
    'ok'   => true,
    'url'  => 'uploads/' . $fileName,
    'name' => $fileName
]);
