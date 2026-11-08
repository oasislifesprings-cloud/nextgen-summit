<?php
/* ============================================================================
   Are NextGen 2027 waitlist sign-ups labelled as 2027, and only those?

       php tools/test-waitlist-2027.php

   The 2026 waitlist and the 2027 waitlist share one submission kind ("waitlist"). The 2027
   form (the homepage and /2027/ tickets) posts list=2027; register.php keeps that one value
   and nothing else, and the admin labels each row with ngs_waitlist_list(). Sign-ups saved
   before the tag existed are the 2026 waitlist.

   Each post runs the REAL register.php in its own PHP process (it ends with exit), in a
   sandbox with a fake config and an empty data folder. Nothing real is read or written.
   ========================================================================= */

declare(strict_types=1);

$root = dirname(__DIR__);
$sand = rtrim(sys_get_temp_dir(), '/\\') . '/ngs-wl27-' . bin2hex(random_bytes(4));

$pass = 0;
$fail = 0;
function ok(string $label, bool $cond, string $detail = ''): void
{
    global $pass, $fail;
    if ($cond) { $pass++; echo "  PASS  $label\n"; }
    else { $fail++; echo "  FAIL  $label" . ($detail !== '' ? "\n        $detail" : '') . "\n"; }
}
function rmtree(string $d): void
{
    if (!is_dir($d)) { return; }
    foreach (scandir($d) ?: [] as $f) {
        if ($f === '.' || $f === '..') { continue; }
        $p = $d . '/' . $f;
        is_dir($p) ? rmtree($p) : @unlink($p);
    }
    @rmdir($d);
}

@mkdir($sand . '/public/api', 0777, true);
@mkdir($sand . '/data', 0777, true);
foreach (glob($root . '/public/api/*.php') ?: [] as $f) {
    // no real private config reaches the sandbox
    if (preg_match('/^config(\..+)?\.php$/', basename($f))) { continue; }
    copy($f, $sand . '/public/api/' . basename($f));
}
$dataDir = str_replace('\\', '/', $sand) . '/data';
file_put_contents($sand . '/public/api/config.php', "<?php\ndeclare(strict_types=1);\n"
    . "const NGS_ADMIN_SALT = 'abababababababababababab';\nconst NGS_ADMIN_HASH = 'cdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcd';\n"
    . "const NGS_SECRET = 'test-secret-not-a-real-one';\nconst NGS_DATA_KEY = 'wl27';\n"
    . "define('NGS_DATA_DIR', '" . $dataDir . "');\n");

/** Posts one form to the sandboxed register.php in a fresh PHP process; returns its JSON reply. */
function post(array $fields): array
{
    global $sand;
    $runner = $sand . '/run-' . bin2hex(random_bytes(3)) . '.php';
    file_put_contents($runner, "<?php\n"
        . '$_SERVER["REQUEST_METHOD"] = "POST";' . "\n"
        . '$_SERVER["HTTP_ACCEPT"] = "application/json";' . "\n"
        . '$_SERVER["REMOTE_ADDR"] = "203.0.113.' . random_int(1, 250) . '";' . "\n"
        . '$_SERVER["SCRIPT_FILENAME"] = __FILE__;' . "\n"
        . '$_POST = ' . var_export($fields, true) . ";\n"
        . 'require ' . var_export($sand . '/public/api/register.php', true) . ";\n");
    $out = shell_exec(escapeshellarg(PHP_BINARY) . ' ' . escapeshellarg($runner) . ' 2>&1');
    @unlink($runner);
    $j = json_decode((string) $out, true);
    return is_array($j) ? $j : ['raw' => (string) $out];
}

echo "2027 waitlist label\n\nsandbox  $sand\n\n";
$base = ['form-name' => 'waitlist', 'name' => 'Test Visitor', 'phone' => '(410) 555-0123', 'bot-field' => ''];

echo "=== what register.php keeps ===\n";
$r1 = post($base + ['email' => 'a2027@example.com', 'list' => '2027', 'cities' => ['baltimore', 'atlanta', 'baltimore', 'nowhere', '<b>x</b>']]);
ok('a 2027 sign-up is accepted', ($r1['ok'] ?? false) === true, json_encode($r1));
$r2 = post($base + ['email' => 'a2026@example.com']);
ok('a sign-up without a list is accepted', ($r2['ok'] ?? false) === true, json_encode($r2));
$r3 = post($base + ['email' => 'abogus@example.com', 'list' => '<b>2028</b>']);
$r5 = post($base + ['email' => 'nocity@example.com', 'list' => '2027']);
ok('a 2027 sign-up with no city is refused and names the cities field', ($r5['ok'] ?? true) === false && in_array('cities', $r5['fields'] ?? [], true), json_encode($r5));
$r6 = post($base + ['email' => 'badcity@example.com', 'list' => '2027', 'cities' => ['nowhere']]);
ok('a 2027 sign-up with only unknown cities is refused', ($r6['ok'] ?? true) === false && in_array('cities', $r6['fields'] ?? [], true), json_encode($r6));
$r7 = post($base + ['email' => 'strcity@example.com', 'list' => '2027', 'cities' => 'baltimore']);
ok('a single city sent as a plain string is refused, never stored', ($r7['ok'] ?? true) === false, json_encode($r7));
ok('any other list value is accepted but not kept', ($r3['ok'] ?? false) === true, json_encode($r3));
$r4 = post($base + ['email' => 'bad', 'list' => '2027', 'cities' => ['dc']]);
ok('the usual validation still runs for 2027 sign-ups', ($r4['ok'] ?? true) === false && in_array('email', $r4['fields'] ?? [], true), json_encode($r4));

$_SERVER['SCRIPT_FILENAME'] = __FILE__;
require $sand . '/public/api/_lib.php';
$rows = [];
foreach (ngs_all('waitlist') as $r) { $rows[$r['data']['email']] = $r; }
ok('three sign-ups were saved', count($rows) === 3, implode(', ', array_keys($rows)));
ok('the 2027 sign-up is stored with list 2027', ($rows['a2027@example.com']['data']['list'] ?? null) === '2027');
ok('its cities are kept once each, in the published order, unknown ones dropped', ($rows['a2027@example.com']['data']['cities'] ?? null) === ['atlanta', 'baltimore'], json_encode($rows['a2027@example.com']['data']['cities'] ?? null));
ok('the untagged sign-up has no cities field', !array_key_exists('cities', $rows['a2026@example.com']['data'] ?? ['cities' => 1]));
ok('the untagged sign-up has no list field', !array_key_exists('list', $rows['a2026@example.com']['data'] ?? ['list' => 1]));
ok('an unknown list value is never stored', !array_key_exists('list', $rows['abogus@example.com']['data'] ?? ['list' => 1]));

echo "\n=== what the admin shows ===\n";
ok('2027 sign-up reads "Waitlist 2027"', ngs_waitlist_list($rows['a2027@example.com'] ?? []) === 'Waitlist 2027');
ok('an earlier sign-up reads "Waitlist 2026"', ngs_waitlist_list($rows['a2026@example.com'] ?? []) === 'Waitlist 2026');
ok('a registration still reads "Registration"', ngs_waitlist_list(['kind' => 'registration', 'data' => ['list' => '2027']]) === 'Registration');
ok('the admin names the cities', ngs_waitlist_cities($rows['a2027@example.com'] ?? []) === 'Atlanta, Baltimore');
ok('a sign-up without cities shows none', ngs_waitlist_cities($rows['a2026@example.com'] ?? []) === '');
ok('Indiana is listed until leadership confirms the city', (NGS_2027_CITIES['indiana'] ?? '') === 'Indiana');

rmtree($sand);
echo "\n$pass passed, $fail failed\n";
exit($fail === 0 ? 0 : 1);
