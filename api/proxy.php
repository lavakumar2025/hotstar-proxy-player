<?php
// proxy.php
if (!isset($_GET['url'])) {
    die("Missing url parameter");
}

$url = $_GET['url'];

// setup curl
$ch = curl_init($url);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_HEADER, false);

// required headers
$headers = [
    "Origin: https://www.hotstar.com",
    "Referer: https://www.hotstar.com/",
    "User-Agent: Hotstar;in.startv.hotstar.links_macha_official(Android/15)",
    "Cookie: hdntl=exp=1759269007~acl=%2f*~id=c40a5e786ea713d5f9bb6e3d0a86e57d~data=hdntl~hmac=fbf8d61f477cf406a086bc0ea61cd5994e2a577788586c4543f5ffe561c6fe34"
];
curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);

$response = curl_exec($ch);
$httpcode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$content_type = curl_getinfo($ch, CURLINFO_CONTENT_TYPE);
curl_close($ch);

// if playlist (m3u8), rewrite its chunk URLs
if (strpos($url, ".m3u8") !== false) {
    $base = dirname($url) . "/";
    $lines = explode("\n", $response);
    foreach ($lines as &$line) {
        $line = trim($line);
        if ($line !== "" && strpos($line, "#") !== 0) {
            // rewrite chunk url through proxy
            if (strpos($line, "http") !== 0) {
                $line = $base . $line;
            }
            $line = "api/proxy1.php?url=" . urlencode($line);
        }
    }
    $response = implode("\n", $lines);
    header("Content-Type: application/vnd.apple.mpegurl");
} else {
    header("Content-Type: " . $content_type);
}

http_response_code($httpcode);
echo $response;
?>
