<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET");
header("Access-Control-Allow-Headers: Content-Type");
header("Content-Type: application/json");

$code = $_GET['code'] ?? '';

$cookie = 'hdntl=exp=1759947605~acl=%2f*~id=d81260f26bbc8c776097120b5d28ce53~data=hdntl~hmac=7d06528f217b0d9c848c13f42f5ad6a0602dcb9c2c6abb8592fbdc8b2384b2a2';

// Map each code to a specific quality URL
$streams = [
  "bigglive1080" => "https://live09p.hotstar.com/mp2/inallow-bigboss-tel-s9-24x7/.../index_7.m3u8?|Cookie=$cookie",
  "bigglive720"  => "https://live09p.hotstar.com/mp2/inallow-bigboss-tel-s9-24x7/.../index_5.m3u8?|Cookie=$cookie",
  "bigglive480"  => "https://live09p.hotstar.com/mp2/inallow-bigboss-tel-s9-24x7/.../index_3.m3u8?|Cookie=$cookie",
  "bigglive360"  => "https://live09p.hotstar.com/mp2/inallow-bigboss-tel-s9-24x7/.../index_1.m3u8?|Cookie=$cookie"
];

if (!$code || !isset($streams[$code])) {
  echo json_encode(["error" => "invalid code"]);
  exit;
}

echo json_encode(["url" => $streams[$code]]);
?>
