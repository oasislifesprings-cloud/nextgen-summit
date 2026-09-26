<?php
/* Next Gen Summit: shared helpers for the form endpoint and the admin page.
   Storage is SQLite when the server has it, otherwise an append-only JSON Lines file.
   The data folder sits outside the public web folder whenever the host allows it. */
declare(strict_types=1);

if (realpath((string) ($_SERVER['SCRIPT_FILENAME'] ?? '')) === realpath(__FILE__)) {
    http_response_code(404);
    exit;
}

require __DIR__ . '/config.php';

const NGS_KINDS = ['waitlist', 'registration', 'volunteer', 'partner', 'scholarship'];

/* Resumes. Kept in the data folder beside the database, which sits outside the web root wherever
   the host allows it and is denied by .htaccess where it does not, so an uploaded file can never
   be requested over the web or run as a script. Only the admin page hands them back, through
   api/resume.php, and only to a signed-in session. */
const NGS_RESUME_MAX = 5242880;                       // 5 MB
const NGS_RESUME_TYPES = [
    'pdf'  => ['application/pdf'],
    'doc'  => ['application/msword'],
    'docx' => ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
];

function ngs_resume_dir(): string
{
    $dir = ngs_data_dir() . '/resumes';
    if (!@is_dir($dir)) {
        @mkdir($dir, 0750, true);
    }
    ngs_protect_dir($dir);
    return $dir;
}

/** Validate and keep one uploaded resume. Returns [storedName, originalName] or null, and
    throws with a readable message when the person picked something we cannot take. */
function ngs_take_resume(string $field): ?array
{
    if (!isset($_FILES[$field]) || !is_array($_FILES[$field])) {
        return null;
    }
    $f = $_FILES[$field];
    $err = $f['error'] ?? UPLOAD_ERR_NO_FILE;
    if ($err === UPLOAD_ERR_NO_FILE) {
        return null;                                   // the resume is optional
    }
    if ($err === UPLOAD_ERR_INI_SIZE || $err === UPLOAD_ERR_FORM_SIZE) {
        throw new RuntimeException('That resume is too large. Please keep it under 5 MB.');
    }
    if ($err !== UPLOAD_ERR_OK || !is_uploaded_file($f['tmp_name'])) {
        throw new RuntimeException('That resume did not upload. Please try again.');
    }
    if (($f['size'] ?? 0) > NGS_RESUME_MAX) {
        throw new RuntimeException('That resume is too large. Please keep it under 5 MB.');
    }
    $orig = ngs_text(['n' => (string) ($f['name'] ?? '')], 'n', 120);
    $ext = strtolower(pathinfo($orig, PATHINFO_EXTENSION));
    if (!isset(NGS_RESUME_TYPES[$ext])) {
        throw new RuntimeException('Please upload a PDF, DOC or DOCX.');
    }
    $mime = '';
    if (class_exists('finfo')) {
        $fi = new finfo(FILEINFO_MIME_TYPE);
        $mime = (string) $fi->file($f['tmp_name']);
    }
    // .doc in particular is reported inconsistently, so an empty or generic type is allowed
    $loose = ['application/octet-stream', 'application/zip', 'application/CDFV2', ''];
    if ($mime !== '' && !in_array($mime, NGS_RESUME_TYPES[$ext], true) && !in_array($mime, $loose, true)) {
        throw new RuntimeException('That file did not look like a PDF, DOC or DOCX.');
    }
    $stored = gmdate('Ymd-His') . '-' . bin2hex(random_bytes(8)) . '.' . $ext;
    if (!@move_uploaded_file($f['tmp_name'], ngs_resume_dir() . '/' . $stored)) {
        throw new RuntimeException('We could not save that resume. Please try again.');
    }
    @chmod(ngs_resume_dir() . '/' . $stored, 0640);
    return [$stored, $orig];
}

/** Resolve a stored resume name to a path, refusing anything that is not one of ours. */
function ngs_resume_path(string $stored): ?string
{
    if (!preg_match('/^\d{8}-\d{6}-[a-f0-9]{16}\.(pdf|doc|docx)$/', $stored)) {
        return null;
    }
    $path = ngs_resume_dir() . '/' . $stored;
    return is_file($path) ? $path : null;
}

function ngs_text(array $src, string $key, int $max): string
{
    $v = isset($src[$key]) && is_string($src[$key]) ? trim($src[$key]) : '';
    $v = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u', '', $v) ?? '';
    return function_exists('mb_substr') ? mb_substr($v, 0, $max) : substr($v, 0, $max);
}

function ngs_protect_dir(string $dir): void
{
    $rules = "<IfModule mod_authz_core.c>\n  Require all denied\n</IfModule>\n<IfModule !mod_authz_core.c>\n  Order allow,deny\n  Deny from all\n</IfModule>\n";
    if (!file_exists($dir . '/.htaccess')) {
        @file_put_contents($dir . '/.htaccess', $rules);
    }
    if (!file_exists($dir . '/index.html')) {
        @file_put_contents($dir . '/index.html', '');
    }
}

function ngs_data_dir(): string
{
    static $dir = null;
    if ($dir !== null) {
        return $dir;
    }
    $candidates = [];
    $root = rtrim((string) ($_SERVER['DOCUMENT_ROOT'] ?? ''), '/\\');
    if ($root !== '') {
        $candidates[] = dirname($root) . '/nextgen-data';   // outside public_html on Hostinger
    }
    $candidates[] = dirname(__DIR__) . '/data';              // fallback inside, locked by .htaccess
    foreach ($candidates as $c) {
        if ((@is_dir($c) || @mkdir($c, 0750, true)) && @is_writable($c)) {
            ngs_protect_dir($c);
            return $dir = $c;
        }
    }
    throw new RuntimeException('No writable data directory.');
}

function ngs_db(): ?PDO
{
    static $pdo = false;
    if ($pdo !== false) {
        return $pdo;
    }
    $pdo = null;
    if (!class_exists('PDO') || !in_array('sqlite', PDO::getAvailableDrivers(), true)) {
        return null;
    }
    try {
        $db = new PDO('sqlite:' . ngs_data_dir() . '/nextgen-' . NGS_DATA_KEY . '.sqlite');
        $db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        $db->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
        $db->exec('PRAGMA busy_timeout = 5000');
        $db->exec('CREATE TABLE IF NOT EXISTS submissions (
            id TEXT PRIMARY KEY,
            kind TEXT NOT NULL,
            created_at TEXT NOT NULL,
            data TEXT NOT NULL,
            ip_hash TEXT,
            user_agent TEXT
        )');
        $db->exec('CREATE INDEX IF NOT EXISTS submissions_kind ON submissions (kind, created_at)');
        $db->exec('CREATE INDEX IF NOT EXISTS submissions_ip ON submissions (ip_hash, created_at)');
        $pdo = $db;
    } catch (Throwable $e) {
        error_log('Next Gen Summit: SQLite unavailable, using file storage. ' . $e->getMessage());
        $pdo = null;
    }
    return $pdo;
}

function ngs_jsonl_path(): string
{
    return ngs_data_dir() . '/nextgen-' . NGS_DATA_KEY . '.jsonl';
}

function ngs_ip_hash(): string
{
    return substr(hash_hmac('sha256', (string) ($_SERVER['REMOTE_ADDR'] ?? ''), NGS_SECRET), 0, 16);
}

function ngs_now(int $offset = 0): string
{
    return gmdate('Y-m-d\TH:i:s\Z', time() + $offset);
}

function ngs_jsonl_rows(): array
{
    $path = ngs_jsonl_path();
    if (!is_file($path)) {
        return [];
    }
    $rows = [];
    foreach (file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) ?: [] as $line) {
        $r = json_decode($line, true);
        if (is_array($r) && isset($r['id'], $r['kind'], $r['created_at'])) {
            $rows[] = $r;
        }
    }
    return $rows;
}

function ngs_recent_from_ip(string $ipHash, int $seconds): int
{
    $since = ngs_now(-$seconds);
    $db = ngs_db();
    if ($db) {
        $st = $db->prepare('SELECT COUNT(*) FROM submissions WHERE ip_hash = ? AND created_at >= ?');
        $st->execute([$ipHash, $since]);
        return (int) $st->fetchColumn();
    }
    $n = 0;
    foreach (ngs_jsonl_rows() as $r) {
        if (($r['ip_hash'] ?? '') === $ipHash && $r['created_at'] >= $since) {
            $n++;
        }
    }
    return $n;
}

function ngs_store(string $kind, array $data): string
{
    $row = [
        'id' => bin2hex(random_bytes(8)),
        'kind' => $kind,
        'created_at' => ngs_now(),
        'data' => $data,
        'ip_hash' => ngs_ip_hash(),
        'user_agent' => ngs_text($_SERVER, 'HTTP_USER_AGENT', 250),
    ];
    $db = ngs_db();
    if ($db) {
        $st = $db->prepare('INSERT INTO submissions (id, kind, created_at, data, ip_hash, user_agent) VALUES (?, ?, ?, ?, ?, ?)');
        $st->execute([$row['id'], $kind, $row['created_at'], json_encode($data, JSON_UNESCAPED_UNICODE), $row['ip_hash'], $row['user_agent']]);
        return $row['id'];
    }
    $line = json_encode($row, JSON_UNESCAPED_UNICODE) . "\n";
    if (@file_put_contents(ngs_jsonl_path(), $line, FILE_APPEND | LOCK_EX) === false) {
        throw new RuntimeException('Could not write submission.');
    }
    return $row['id'];
}

/** Every submission of one kind, newest first, with data decoded. */
function ngs_all(string $kind): array
{
    $db = ngs_db();
    $rows = [];
    if ($db) {
        $st = $db->prepare('SELECT id, kind, created_at, data FROM submissions WHERE kind = ? ORDER BY created_at DESC');
        $st->execute([$kind]);
        foreach ($st as $r) {
            $r['data'] = json_decode((string) $r['data'], true) ?: [];
            $rows[] = $r;
        }
        return $rows;
    }
    foreach (ngs_jsonl_rows() as $r) {
        if ($r['kind'] === $kind) {
            $r['data'] = is_array($r['data'] ?? null) ? $r['data'] : [];
            $rows[] = $r;
        }
    }
    usort($rows, function ($a, $b) {
        return strcmp($b['created_at'], $a['created_at']);
    });
    return $rows;
}

function ngs_delete(string $id): void
{
    $db = ngs_db();
    if ($db) {
        $db->prepare('DELETE FROM submissions WHERE id = ?')->execute([$id]);
        return;
    }
    $path = ngs_jsonl_path();
    if (!is_file($path)) {
        return;
    }
    $fh = fopen($path, 'c+');
    if (!$fh) {
        return;
    }
    flock($fh, LOCK_EX);
    $keep = '';
    while (($line = fgets($fh)) !== false) {
        $r = json_decode($line, true);
        if (is_array($r) && ($r['id'] ?? '') !== $id) {
            $keep .= rtrim($line, "\r\n") . "\n";
        }
    }
    ftruncate($fh, 0);
    rewind($fh);
    fwrite($fh, $keep);
    fflush($fh);
    flock($fh, LOCK_UN);
    fclose($fh);
}
