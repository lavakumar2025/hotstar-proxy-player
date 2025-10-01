<?php
if (!isset($_GET['url'])) {
    die("Missing url parameter");
}
$url = $_GET['url'];

$ch = curl_init($url);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_HEADER, false);

$headers = [
    "Origin: https://www.hotstar.com",
    "Referer: https://www.hotstar.com/",
    "User-Agent: Hotstar;in.startv.hotstar.links_macha_official(Android/15)",
    "Cookie: hdntl=exp=1759380006~acl=%2f*~id=45b2229f98f30a14224d8075ad1018b3~data=hdntl~hmac=cea70708dfefac8cdca354ece55e0577c27c937cfdd9fc8ec6cd49f79535b0ca"
];
curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);

$response = curl_exec($ch);
$httpcode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$content_type = curl_getinfo($ch, CURLINFO_CONTENT_TYPE);
curl_close($ch);

if (strpos($url, ".m3u8") !== false) {
    $base = dirname($url) . "/";
    $lines = explode("\n", $response);
    foreach ($lines as &$line) {
        $line = trim($line);
        if ($line !== "" && strpos($line, "#") !== 0) {
            if (strpos($line, "http") !== 0) {
                $line = $base . $line;
            }
            $line = "/proxy.php?url=" . urlencode($line);
        }
    }
    $response = implode("\n", $lines);
    header("Content-Type: application/vnd.apple.mpegurl");
} else {
    header("Content-Type: " . $content_type);
}

http_response_code($httpcode);
echo $response;
