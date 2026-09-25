<?php
/* Next Gen Summit admin: see, search, export and tidy up everyone who registered. */
declare(strict_types=1);

require dirname(__DIR__) . '/api/_lib.php';

header('X-Robots-Tag: noindex, nofollow');
header('Cache-Control: no-store');
header('X-Frame-Options: DENY');
header('Referrer-Policy: same-origin');

$https = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
    || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');
session_name('ngs_admin');
session_set_cookie_params(['lifetime' => 0, 'path' => '/admin/', 'secure' => $https, 'httponly' => true, 'samesite' => 'Strict']);
session_start();

if (empty($_SESSION['csrf'])) {
    $_SESSION['csrf'] = bin2hex(random_bytes(16));
}
$csrf = $_SESSION['csrf'];
$authed = !empty($_SESSION['ok']) && (int) ($_SESSION['at'] ?? 0) > time() - 8 * 3600;

function h($v): string
{
    return htmlspecialchars((string) $v, ENT_QUOTES, 'UTF-8');
}

function token_ok(): bool
{
    return isset($_POST['csrf']) && is_string($_POST['csrf']) && hash_equals((string) $_SESSION['csrf'], $_POST['csrf']);
}

function et(string $iso): string
{
    try {
        return (new DateTime($iso))->setTimezone(new DateTimeZone('America/New_York'))->format('M j, g:i A');
    } catch (Throwable $e) {
        return $iso;
    }
}

$notice = '';
if (($_SERVER['REQUEST_METHOD'] ?? '') === 'POST') {
    $action = is_string($_POST['action'] ?? null) ? $_POST['action'] : '';
    if (!token_ok()) {
        http_response_code(400);
        $notice = 'Your session expired. Please try again.';
    } elseif ($action === 'login') {
        $pw = is_string($_POST['password'] ?? null) ? $_POST['password'] : '';
        if (hash_equals(NGS_ADMIN_HASH, hash_hmac('sha256', $pw, NGS_ADMIN_SALT))) {
            session_regenerate_id(true);
            $_SESSION['ok'] = true;
            $_SESSION['at'] = time();
            header('Location: /admin/', true, 303);
            exit;
        }
        sleep(2);
        $notice = 'That password did not match.';
    } elseif ($action === 'logout') {
        $_SESSION = [];
        session_destroy();
        header('Location: /admin/', true, 303);
        exit;
    } elseif ($action === 'delete' && $authed) {
        $id = is_string($_POST['id'] ?? null) ? $_POST['id'] : '';
        if (preg_match('/^[a-f0-9]{16}$/', $id)) {
            ngs_delete($id);
        }
        $tab = ($_POST['tab'] ?? '') === 'notes' ? 'notes' : 'registrations';
        header('Location: /admin/?tab=' . $tab . '&deleted=1', true, 303);
        exit;
    }
}

$error = '';
$registrations = $notes = [];
if ($authed) {
    try {
        // waitlist sign-ups and any earlier registrations share one list, newest first
        $registrations = array_merge(ngs_all('waitlist'), ngs_all('registration'));
        usort($registrations, function ($a, $b) {
            return strcmp($b['created_at'], $a['created_at']);
        });
        $notes = array_merge(ngs_all('volunteer'), ngs_all('partner'));
        usort($notes, function ($a, $b) {
            return strcmp($b['created_at'], $a['created_at']);
        });
    } catch (Throwable $e) {
        error_log('Next Gen Summit admin error: ' . $e->getMessage());
        $error = 'The registration data could not be read. Check the PHP error log on the host.';
    }
}

// CSV export. A leading = + - @ is neutralized so spreadsheets never run a formula from a form.
if ($authed && isset($_GET['export']) && $error === '') {
    $which = $_GET['export'] === 'notes' ? 'notes' : 'registrations';
    header('Content-Type: text/csv; charset=utf-8');
    header('Content-Disposition: attachment; filename="nextgen-' . $which . '-' . gmdate('Y-m-d') . '.csv"');
    $out = fopen('php://output', 'w');
    fwrite($out, "\xEF\xBB\xBF");
    $safe = function ($v) {
        $v = (string) $v;
        return preg_match('/^[=+\-@\t\r]/', $v) ? "'" . $v : $v;
    };
    if ($which === 'registrations') {
        fputcsv($out, ['Signed up (ET)', 'List', 'Name', 'Email', 'Phone', 'Education level', 'School', 'Interested in volunteering']);
        foreach ($registrations as $r) {
            $d = $r['data'];
            fputcsv($out, array_map($safe, [et($r['created_at']), $r['kind'] === 'waitlist' ? 'Waitlist' : 'Registration', person_name($d), $d['email'] ?? '', $d['phone'] ?? '', $d['education_level'] ?? '', $d['school_name'] ?? '', $d['volunteer_interest'] ?? '']));
        }
    } else {
        fputcsv($out, ['Sent (ET)', 'Type', 'Name', 'Email', 'Campus', 'Organization']);
        foreach ($notes as $r) {
            $d = $r['data'];
            fputcsv($out, array_map($safe, [et($r['created_at']), ucfirst($r['kind']), $d['name'] ?? '', $d['email'] ?? '', $d['campus'] ?? '', $d['organization'] ?? '']));
        }
    }
    exit;
}

$tab = ($_GET['tab'] ?? '') === 'notes' ? 'notes' : 'registrations';
$q = is_string($_GET['q'] ?? null) ? trim($_GET['q']) : '';

$emailCount = [];
foreach ($registrations as $r) {
    $e = strtolower((string) ($r['data']['email'] ?? ''));
    $emailCount[$e] = ($emailCount[$e] ?? 0) + 1;
}
$stats = ['High School' => 0, 'College' => 0, 'Young Professional' => 0, 'Other' => 0, 'volunteers' => 0];
foreach ($registrations as $r) {
    $lvl = $r['data']['education_level'] ?? '';
    if (isset($stats[$lvl])) {
        $stats[$lvl]++;
    }
    if (($r['data']['volunteer_interest'] ?? '') === 'Yes') {
        $stats['volunteers']++;
    }
}

/** Waitlist sign-ups have one name field; registrations had first and last. */
function person_name(array $d): string
{
    return trim((string) ($d['name'] ?? (($d['first_name'] ?? '') . ' ' . ($d['last_name'] ?? ''))));
}

function matches(array $r, string $q): bool
{
    if ($q === '') {
        return true;
    }
    $hay = strtolower(implode(' ', array_map('strval', $r['data'])));
    return strpos($hay, strtolower($q)) !== false;
}
$shownRegs = array_values(array_filter($registrations, function ($r) use ($q) { return matches($r, $q); }));
$shownNotes = array_values(array_filter($notes, function ($r) use ($q) { return matches($r, $q); }));
?>
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Admin · Next Gen Summit</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght,SOFT,WONK@144,900,100,0&amp;family=Montserrat:wght@500;600;700;800&amp;display=swap">
<link rel="stylesheet" href="/assets/css/site.css?v=20260925-13">
<style>
  body{background:var(--paper)}
  .adm{max-width:1280px;margin:0 auto;padding:28px clamp(18px,4vw,48px) 80px}
  .adm__top{display:flex;align-items:center;justify-content:space-between;gap:16px;padding-bottom:22px;border-bottom:1px solid var(--rule)}
  .adm__mark{display:flex;align-items:baseline;gap:.6em;text-decoration:none}
  .adm__mark .wm{font-size:30px;line-height:1}
  .adm h1{margin:34px 0 8px;font-size:clamp(44px,6vw,72px);line-height:.95}
  .adm__sub{font:500 15px/1.5 var(--f-sans);color:var(--ink-2)}
  .stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:0;margin:30px 0 26px;border-top:1px solid var(--rule);border-bottom:1px solid var(--rule)}
  .stat{padding:16px 18px 16px 0}
  .stat b{display:block;font:800 34px/1 var(--f-sans);letter-spacing:-.02em}
  .stat span{display:block;margin-top:6px;font:700 11px/1.3 var(--f-sans);letter-spacing:.16em;text-transform:uppercase;color:var(--ink-2)}
  .bar{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:12px 18px;margin-bottom:16px}
  .tabs{display:flex;gap:6px}
  .tabs a{display:inline-flex;align-items:center;min-height:42px;padding:0 14px;border-radius:8px;font:700 12px/1 var(--f-sans);letter-spacing:.12em;text-transform:uppercase;text-decoration:none;color:var(--ink-2)}
  .tabs a[aria-current="page"]{background:var(--ink);color:#fff}
  .tools{display:flex;flex-wrap:wrap;gap:10px;align-items:center}
  .tools input{height:42px;min-width:220px;padding:0 12px;border:1.5px solid var(--rule-strong);border-radius:8px;font:500 15px/1 var(--f-sans);background:#fff}
  .tablewrap{overflow-x:auto;border:1px solid var(--rule);border-radius:10px;background:#fff}
  table{width:100%;border-collapse:collapse;font:500 14px/1.4 var(--f-sans)}
  th{position:sticky;top:0;background:#fff;text-align:left;padding:12px 14px;font:700 11px/1.3 var(--f-sans);letter-spacing:.14em;text-transform:uppercase;color:var(--ink-2);border-bottom:1px solid var(--rule);white-space:nowrap}
  td{padding:12px 14px;border-bottom:1px solid var(--rule);vertical-align:top}
  tr:last-child td{border-bottom:0}
  td a{color:var(--ink)}
  .dup{display:inline-block;margin-left:6px;padding:2px 6px;border-radius:4px;background:var(--paper-2);font:700 10px/1.3 var(--f-sans);letter-spacing:.08em;text-transform:uppercase;color:var(--ink-2)}
  .yes{font-weight:700;color:var(--accent-ink)}
  .del{min-height:32px;padding:0 10px;border:1.5px solid var(--rule-strong);border-radius:6px;font:700 11px/1 var(--f-sans);letter-spacing:.08em;text-transform:uppercase;color:var(--ink-2)}
  .del:hover{border-color:#8A1233;color:#8A1233}
  .empty{padding:40px 20px;text-align:center;color:var(--ink-2)}
  .note{margin:0 0 18px;padding:12px 14px;border-radius:8px;background:#FBE9EE;color:#8A1233;font:600 14px/1.45 var(--f-sans)}
  .note--ok{background:var(--paper-2);color:var(--ink)}
  .login{max-width:420px;margin:12vh auto 0}
  .login form{display:grid;gap:16px;margin-top:26px}
</style>
</head>
<body>
<?php if (!$authed): ?>
  <main class="adm">
    <div class="login">
      <a class="adm__mark" href="/"><span class="wm">nextgen</span><span class="nav__summit">Admin</span></a>
      <h1 class="wm">sign in.</h1>
      <p class="adm__sub">Sign-ups for Next Gen Summit.</p>
      <?php if ($notice !== ''): ?><p class="note" role="alert"><?= h($notice) ?></p><?php endif; ?>
      <form method="post" action="/admin/">
        <input type="hidden" name="csrf" value="<?= h($csrf) ?>">
        <input type="hidden" name="action" value="login">
        <div class="field"><label for="pw">Password</label><input id="pw" name="password" type="password" autocomplete="current-password" required autofocus></div>
        <div><button class="btn btn--lg" type="submit">Sign in <span class="arr" aria-hidden="true">→</span></button></div>
      </form>
    </div>
  </main>
<?php else: ?>
  <main class="adm">
    <div class="adm__top">
      <a class="adm__mark" href="/" target="_blank" rel="noopener"><span class="wm">nextgen</span><span class="nav__summit">Admin</span></a>
      <form method="post" action="/admin/">
        <input type="hidden" name="csrf" value="<?= h($csrf) ?>">
        <input type="hidden" name="action" value="logout">
        <button class="textlink" type="submit">Sign out</button>
      </form>
    </div>

    <h1 class="wm"><?= $tab === 'notes' ? 'notes.' : 'registrations.' ?></h1>
    <p class="adm__sub">Waitlist and registrations · Times shown in Eastern Time.</p>

    <?php if ($error !== ''): ?><p class="note" role="alert"><?= h($error) ?></p><?php endif; ?>
    <?php if (isset($_GET['deleted'])): ?><p class="note note--ok" role="status">Entry deleted.</p><?php endif; ?>

    <div class="stats">
      <div class="stat"><b><?= count($registrations) ?></b><span>Sign-ups</span></div>
      <div class="stat"><b><?= count($emailCount) ?></b><span>Unique emails</span></div>
      <?php // the waitlist no longer asks these, so they only show when earlier sign-ups answered them
      foreach (['College' => 'College', 'High School' => 'High school', 'Young Professional' => 'Young professional', 'Other' => 'Other', 'volunteers' => 'Want to volunteer'] as $k => $label):
        if ($stats[$k] > 0): ?>
      <div class="stat"><b><?= $stats[$k] ?></b><span><?= h($label) ?></span></div>
      <?php endif; endforeach; ?>
    </div>

    <div class="bar">
      <nav class="tabs" aria-label="Views">
        <a href="/admin/?tab=registrations" <?= $tab === 'registrations' ? 'aria-current="page"' : '' ?>>Registrations (<?= count($registrations) ?>)</a>
        <a href="/admin/?tab=notes" <?= $tab === 'notes' ? 'aria-current="page"' : '' ?>>Volunteer and partner notes (<?= count($notes) ?>)</a>
      </nav>
      <div class="tools">
        <form method="get" action="/admin/" role="search">
          <input type="hidden" name="tab" value="<?= h($tab) ?>">
          <label class="sr" for="q">Search</label>
          <input id="q" name="q" type="search" value="<?= h($q) ?>" placeholder="Search name, email, phone">
        </form>
        <a class="btn btn--sm" href="/admin/?export=<?= $tab === 'notes' ? 'notes' : 'registrations' ?>">Export CSV</a>
      </div>
    </div>

    <div class="tablewrap">
    <?php if ($tab === 'registrations'): ?>
      <?php if (!$shownRegs): ?>
        <p class="empty"><?= $q === '' ? 'No registrations yet.' : 'Nothing matches that search.' ?></p>
      <?php else: ?>
        <table>
          <thead><tr><th>Signed up</th><th>List</th><th>Name</th><th>Email</th><th>Phone</th><th>Level</th><th>School</th><th>Volunteer</th><th><span class="sr">Actions</span></th></tr></thead>
          <tbody>
          <?php foreach ($shownRegs as $r): $d = $r['data']; $em = strtolower((string) ($d['email'] ?? '')); ?>
            <tr>
              <td><?= h(et($r['created_at'])) ?></td>
              <td><?= $r['kind'] === 'waitlist' ? 'Waitlist' : 'Registration' ?></td>
              <td><?= h(person_name($d)) ?></td>
              <td><a href="mailto:<?= h($d['email'] ?? '') ?>"><?= h($d['email'] ?? '') ?></a><?php if (($emailCount[$em] ?? 0) > 1): ?><span class="dup" title="This email registered more than once">Repeat</span><?php endif; ?></td>
              <td><?php if (($d['phone'] ?? '') !== ''): ?><a href="tel:<?= h(preg_replace('/[^0-9+]/', '', $d['phone'])) ?>"><?= h($d['phone']) ?></a><?php endif; ?></td>
              <td><?= h($d['education_level'] ?? '') ?></td>
              <td><?= h($d['school_name'] ?? '') ?></td>
              <td><?= ($d['volunteer_interest'] ?? '') === 'Yes' ? '<span class="yes">Yes</span>' : (isset($d['volunteer_interest']) ? 'No' : '–') ?></td>
              <td>
                <form method="post" action="/admin/" onsubmit="return confirm('Delete this registration? This cannot be undone.')">
                  <input type="hidden" name="csrf" value="<?= h($csrf) ?>">
                  <input type="hidden" name="action" value="delete">
                  <input type="hidden" name="tab" value="registrations">
                  <input type="hidden" name="id" value="<?= h($r['id']) ?>">
                  <button class="del" type="submit">Delete</button>
                </form>
              </td>
            </tr>
          <?php endforeach; ?>
          </tbody>
        </table>
      <?php endif; ?>
    <?php else: ?>
      <?php if (!$shownNotes): ?>
        <p class="empty"><?= $q === '' ? 'No volunteer or partner notes yet.' : 'Nothing matches that search.' ?></p>
      <?php else: ?>
        <table>
          <thead><tr><th>Sent</th><th>Type</th><th>Name</th><th>Email</th><th>Campus or organization</th><th><span class="sr">Actions</span></th></tr></thead>
          <tbody>
          <?php foreach ($shownNotes as $r): $d = $r['data']; ?>
            <tr>
              <td><?= h(et($r['created_at'])) ?></td>
              <td><?= h(ucfirst($r['kind'])) ?></td>
              <td><?= h($d['name'] ?? '') ?></td>
              <td><a href="mailto:<?= h($d['email'] ?? '') ?>"><?= h($d['email'] ?? '') ?></a></td>
              <td><?= h(($d['organization'] ?? '') !== '' ? $d['organization'] : ($d['campus'] ?? '')) ?></td>
              <td>
                <form method="post" action="/admin/" onsubmit="return confirm('Delete this note? This cannot be undone.')">
                  <input type="hidden" name="csrf" value="<?= h($csrf) ?>">
                  <input type="hidden" name="action" value="delete">
                  <input type="hidden" name="tab" value="notes">
                  <input type="hidden" name="id" value="<?= h($r['id']) ?>">
                  <button class="del" type="submit">Delete</button>
                </form>
              </td>
            </tr>
          <?php endforeach; ?>
          </tbody>
        </table>
      <?php endif; ?>
    <?php endif; ?>
    </div>
  </main>
<?php endif; ?>
</body>
</html>
