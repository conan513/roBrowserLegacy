<?php
/**
 * DIRECT ACCESS
 * Only show the friendly debug page when the request is for the site root
 * or directly for index.php with no target file. Allow all other paths
 * (like /data/..., /BGM/...) to be handled as file requests.
 */
$requestPathCheck = isset($_SERVER['REQUEST_URI']) ? parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH) : '';
if ($requestPathCheck === '' || $requestPathCheck === '/' || preg_match('#^/index\.php/?$#i', $requestPathCheck)) {
    $envDebug = getenv('DEBUG');
    $isDebug = ($envDebug !== false) ? filter_var($envDebug, FILTER_VALIDATE_BOOLEAN) : false;
    if ($isDebug) {
        require_once('Debug.php');
        Debug::write('Direct access, no file requested ! You have to request a file (from the url), for example: <a href="data/clientinfo.xml">data/clientinfo.xml</a>', 'error');
        Debug::output();
    }
    header('HTTP/1.1 404 Not Found');
    echo 'Not found';
    exit;
}
$required = [
    'Debug.php',
    'LRUCache.php',
    'Grf.php',
    'GrfDES.php',
    'Bmp.php',
    'Client.php',
    'Compression.php',
    'HttpCache.php',
    'MissingFilesLog.php',
    'HealthCheck.php',
    'PathMapping.php',
    'StartupValidator.php'
];
foreach ($required as $r) {
    require_once($r);
}
$CONFIGS = require_once('configs.php');
$GLOBALS['CONFIGS'] = $CONFIGS;

// Apply configs
if ($CONFIGS['DEBUG']) {
    Debug::enable();
}

// Configure compression
Compression::configure(
    $CONFIGS['COMPRESSION_ENABLED'],
    $CONFIGS['COMPRESSION_MIN_SIZE'],
    $CONFIGS['COMPRESSION_LEVEL']
);

// Configure missing files log
MissingFilesLog::configure([
    'enabled' => $CONFIGS['MISSING_LOG_ENABLED'],
    'logFile' => $CONFIGS['MISSING_LOG_FILE'],
    'maxMemoryEntries' => $CONFIGS['MISSING_LOG_MAX_ENTRIES'],
]);

// Configure path mapping for Korean filenames
PathMapping::configure([
    'enabled' => $CONFIGS['PATH_MAPPING_ENABLED'],
    'mappingFile' => $CONFIGS['PATH_MAPPING_FILE'],
]);


Client::$path        =  '';
Client::$data_ini    =  $CONFIGS['CLIENT_DATAINI'];
Client::$AutoExtract =  (bool)$CONFIGS['CLIENT_AUTOEXTRACT'];

// Debug: Log config values
Debug::write('CACHE_ENABLED: ' . var_export($CONFIGS['CACHE_ENABLED'], true), 'info');
Debug::write('INDEX_CACHE_ENABLED: ' . var_export($CONFIGS['INDEX_CACHE_ENABLED'], true), 'info');

// Initialize client with cache configuration
// Always initialize - the .htaccess rewrite will cause this to be called multiple times,
// but init() is safe to call multiple times (it's idempotent with the $grfs array)
ini_set('memory_limit', $CONFIGS['MEMORY_LIMIT']);
Client::init($CONFIGS['CLIENT_ENABLESEARCH'], array(
    'enabled' => $CONFIGS['CACHE_ENABLED'],
    'maxFiles' => $CONFIGS['CACHE_MAX_FILES'],
    'maxMemoryMB' => $CONFIGS['CACHE_MAX_MEMORY_MB'],
), $CONFIGS['GRF_ENCODING']);

// Debug: Log GRF status after init
$indexStats = Client::getIndexStats();
Debug::write('After init - GRF count: ' . $indexStats['grfCount'] . ', Unique files: ' . $indexStats['uniqueFiles'], 'info');
if ($indexStats['grfCount'] > 0) {
    foreach ($indexStats['grfs'] as $idx => $grf) {
        Debug::write('  GRF[' . $idx . ']: ' . $grf['filename'] . ' - loaded: ' . ($grf['loaded'] ? 'yes' : 'no') . ', files: ' . $grf['fileCount'], 'info');
    }
} else {
    Debug::write('  No GRFs loaded!', 'error');
}


/**
 * API ENDPOINTS
 * Handle API requests before file serving
 */
// Use the original request URI preserved by .htaccess rewrite, fallback to REQUEST_URI
$requestUri = isset($_SERVER['REDIRECT_ORIGINAL_REQUEST_URI']) ? $_SERVER['REDIRECT_ORIGINAL_REQUEST_URI'] : (isset($_SERVER['REQUEST_URI']) ? $_SERVER['REQUEST_URI'] : '');
$requestPath = parse_url($requestUri, PHP_URL_PATH);

// Debug: Log request info
Debug::write('REQUEST_URI: ' . $requestUri, 'info');
Debug::write('REDIRECT_ORIGINAL_REQUEST_URI: ' . (isset($_SERVER['REDIRECT_ORIGINAL_REQUEST_URI']) ? $_SERVER['REDIRECT_ORIGINAL_REQUEST_URI'] : 'NOT SET'), 'info');
Debug::write('REQUEST_PATH: ' . $requestPath, 'info');

// Missing files endpoint: /api/missing-files
if (preg_match('#/api/missing-files/?$#i', $requestPath)) {
    MissingFilesLog::outputJson();
}

// Version endpoint: /api/version
if (preg_match('#/api/version/?$#i', $requestPath)) {
    http_response_code(200);
    header('Content-Type: application/json');
    header('Cache-Control: no-cache, no-store, must-revalidate');
    header('Access-Control-Allow-Origin: *');
    
    $version = HttpCache::getAssetVersionHash($CONFIGS);
    
    echo json_encode([
        'version' => $version
    ], JSON_PRETTY_PRINT);
    exit;
}

// Clear missing files log endpoint: /api/missing-files/clear (POST only)
if (preg_match('#/api/missing-files/clear/?$#i', $requestPath) && $_SERVER['REQUEST_METHOD'] === 'POST') {
    header('Content-Type: application/json');
    header('Cache-Control: no-cache, no-store, must-revalidate');
    header('Access-Control-Allow-Origin: *');
    
    $success = MissingFilesLog::clearLog();
    echo json_encode([
        'success' => $success,
        'message' => $success ? 'Log cleared successfully' : 'Failed to clear log'
    ], JSON_PRETTY_PRINT);
    exit;
}

// Health check endpoint: /api/health
if (preg_match('#/api/health/?$#i', $requestPath)) {
    HealthCheck::outputJson(false);
}

// Simple health check endpoint: /api/health/simple
if (preg_match('#/api/health/simple/?$#i', $requestPath)) {
    HealthCheck::outputJson(true);
}

// Cache stats endpoint: /api/cache-stats
if (preg_match('#/api/cache-stats/?$#i', $requestPath)) {
    header('Content-Type: application/json');
    header('Cache-Control: no-cache, no-store, must-revalidate');
    header('Access-Control-Allow-Origin: *');
    
    $stats = [
        'cache' => Client::getCacheStats(),
        'index' => Client::getIndexStats(),
    ];
    
    echo json_encode($stats, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
    exit;
}

// Path mapping stats endpoint: /api/path-mapping
if (preg_match('#/api/path-mapping/?$#i', $requestPath)) {
    PathMapping::outputJson();
}

// Validation endpoint: /api/validate
if (preg_match('#/api/validate/?$#i', $requestPath)) {
    header('Content-Type: application/json');
    header('Cache-Control: no-cache, no-store, must-revalidate');
    header('Access-Control-Allow-Origin: *');
    
    $deepEncoding = isset($_GET['deep']) && $_GET['deep'] === 'true';
    
    $validator = new StartupValidator();
    $results = $validator->validateAll(['deepEncoding' => $deepEncoding]);
    
    http_response_code($results['success'] ? 200 : 503);
    echo json_encode($validator->getStatusJSON(), JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
    exit;
}


/**
 * SEARCH ACCESS
 * This features is only used in map/rsm/str/grf viewer
 * If you are not using them, you can comment this block
 */
if (isset($_POST['filter']) && is_string($_POST['filter'])) {
    header('Status: 200 OK', true, 200);
    header('Content-type: text/plain');

    if (!$CONFIGS['CLIENT_ENABLESEARCH']) {
        exit();
    }

    $filter = ini_get('magic_quotes_gpc') ? stripslashes($_POST['filter']) : $_POST['filter'];
    $list   = Client::search($filter);

    die( implode("\n", $list) );
}



// Decode path
$path      = str_replace('\\', '/', mb_convert_encoding(urldecode($_SERVER['REQUEST_URI']),'UTF-8'));
$path      = preg_replace('/\?.*/', '', $path); // remove query
$directory = basename(dirname(__FILE__));

// Intercept Tip files
$filename = basename($path);
if (in_array(strtolower($filename), ['tipoftheday.txt', 'guildtip.txt'])) {
    $filePath = dirname(__FILE__) . '/' . (strtolower($filename) === 'tipoftheday.txt' ? 'tipOfTheDay.txt' : 'GuildTip.txt');
    if (file_exists($filePath)) {
        header('Status: 200 OK', true, 200);
        header('Content-type: text/plain; charset=utf-8');
        header('Access-Control-Allow-Origin: *');
        header('Cache-Control: no-cache');
        readfile($filePath);
        exit;
    }
}

// Check Allowed directory
if (!preg_match('/\/(?:' . preg_quote($directory, '/') . '\/)?(?:data|BGM|SystemEN)\//', $path)) {
    Debug::write('Forbidden directory, you can just access files located in data, BGM, and SystemEN folder.', 'error');
    Debug::output();
}

// Get file
$path = preg_replace('/^.*(?:' . preg_quote($directory, '/') . '\/)?((?:data|BGM|SystemEN)\/.*)$/', '$1', $path );
$path = str_replace('/', '\\', $path);
$ext  = strtolower(pathinfo($path, PATHINFO_EXTENSION));
Debug::write('Searching file hex: ' . bin2hex($path), 'info');
$file = Client::getFile($path);


// File not found, end.
if ($file === false) {
    // Log missing file
    $grf_path = str_replace('/', '\\', $path);
    MissingFilesLog::log($path, $grf_path);

    header('HTTP/1.1 404 Not Found', true, 404);
    header('Cache-Control: no-store');
    Debug::write('Failed, file not found...', 'error');
    Debug::output();
}
else {
    Debug::write('Success !', 'success');
}


// Process HTTP cache headers (ETag, Cache-Control, etc.)
// This will send 304 Not Modified if client has valid cached version
HttpCache::processCache($file, $path, $ext);


header('Status: 200 OK', true, 200);

// Set content type
header('Content-type: ' . HttpCache::getContentType($ext));

// Output
if (Debug::isEnable()) {
    Debug::output();
}

// Apply compression if appropriate (checks client support, file size, extension)
$output = Compression::compress($file, $ext);

// Set Content-Length header (important for compressed responses)
header('Content-Length: ' . strlen($output));

echo $output;