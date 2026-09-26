<?php
/* Next Gen Summit: receives the waitlist, registration, volunteer and partner forms.
   (Registration is paused while the waitlist is open; its handling below is kept for when it returns.)
   Answers JSON to the site's JavaScript, and redirects to a confirmation page
   when a browser posts the form directly (JavaScript off). */
declare(strict_types=1);

require __DIR__ . '/_lib.php';

header('X-Robots-Tag: noindex');
header('Cache-Control: no-store');

$wantsJson = stripos((string) ($_SERVER['HTTP_ACCEPT'] ?? ''), 'application/json') !== false;
$kind = isset($_POST['form-name']) && is_string($_POST['form-name']) ? $_POST['form-name'] : '';

function ngs_reply(bool $ok, string $kind, string $error, int $status, bool $json): void
{
    if ($json) {
        http_response_code($status);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode($ok ? ['ok' => true] : ['ok' => false, 'error' => $error]);
        exit;
    }
    if ($ok) {
        $to = '/thanks/';
        if (in_array($kind, ['waitlist', 'registration'], true)) {
            $to = '/registration-received/';
        } elseif ($kind === 'scholarship') {
            $to = '/scholarship/received/';
        }
        header('Location: ' . $to, true, 303);
        exit;
    }
    http_response_code($status);
    header('Content-Type: text/html; charset=utf-8');
    $back = in_array($kind, ['waitlist', 'registration'], true) ? '/#registration' : ($kind === 'scholarship' ? '/scholarship/' : '/#involved');
    echo '<!doctype html><html lang="en"><head><meta charset="utf-8">'
        . '<meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex">'
        . '<title>Not sent yet · Next Gen Summit</title>'
        . '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght,SOFT,WONK@144,900,100,0&amp;family=Montserrat:wght@500;600;700;800&amp;display=swap">'
        . '<link rel="stylesheet" href="/assets/css/site.css?v=20260926-01"></head><body>'
        . '<div class="received"><main class="received__main">'
        . '<p class="draft-note">Not sent yet</p><h1 class="done__title wm">almost.</h1>'
        . '<p class="done__text">' . htmlspecialchars($error, ENT_QUOTES, 'UTF-8') . '</p>'
        . '<p style="margin-top:28px"><a class="btn btn--lg" href="' . $back . '">Go back and try again</a></p>'
        . '</main></div></body></html>';
    exit;
}

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    header('Allow: POST');
    ngs_reply(false, $kind, 'Please use the form on the site.', 405, $wantsJson);
}

if (!in_array($kind, NGS_KINDS, true)) {
    ngs_reply(false, 'waitlist', 'That form was not recognized.', 400, $wantsJson);
}

// Honeypot: people never see this field, so anything in it is a bot. Pretend it worked.
if (ngs_text($_POST, 'bot-field', 200) !== '') {
    ngs_reply(true, $kind, '', 200, $wantsJson);
}

$email = ngs_text($_POST, 'email', 254);
$emailOk = filter_var($email, FILTER_VALIDATE_EMAIL) !== false;
$errors = [];

if ($kind === 'waitlist') {
    $data = [
        'name' => ngs_text($_POST, 'name', 120),
        'phone' => ngs_text($_POST, 'phone', 30),
        'email' => $email,
    ];
    if ($data['name'] === '') {
        $errors[] = 'Please add your name.';
    }
    // any common format is fine ((410) 555-0123, 410.555.0123, +1 410 555 0123); it just needs 7 to 15 digits
    $digits = preg_replace('/\D+/', '', $data['phone']) ?? '';
    if (strlen($digits) < 7 || strlen($digits) > 15 || !preg_match('/^[0-9+().\-\s]+$/', $data['phone'])) {
        $errors[] = 'Please check your phone number.';
    }
    if (!$emailOk) {
        $errors[] = 'Please check your email address.';
    }
} elseif ($kind === 'registration') {
    $data = [
        'first_name' => ngs_text($_POST, 'first_name', 80),
        'last_name' => ngs_text($_POST, 'last_name', 80),
        'email' => $email,
        'education_level' => ngs_text($_POST, 'education_level', 20),
        'school_name' => ngs_text($_POST, 'school_name', 150),
        'volunteer_interest' => ngs_text($_POST, 'volunteer_interest', 3),
    ];
    if ($data['first_name'] === '' || $data['last_name'] === '') {
        $errors[] = 'Please add your first and last name.';
    }
    if (!$emailOk) {
        $errors[] = 'Please check your email address.';
    }
    if (!in_array($data['education_level'], ['High School', 'College', 'Other'], true)) {
        $errors[] = 'Please choose your education level.';
    } elseif ($data['school_name'] === '' && $data['education_level'] !== 'Other') {
        $errors[] = 'Please add your school name.';
    }
    if (!in_array($data['volunteer_interest'], ['Yes', 'No'], true)) {
        $errors[] = 'Please tell us whether you would like to volunteer.';
    }
} elseif ($kind === 'scholarship') {
    $data = [
        'name' => ngs_text($_POST, 'name', 120),
        'email' => $email,
        'phone' => ngs_text($_POST, 'phone', 30),
        'describes' => ngs_text($_POST, 'describes', 40),
        'affiliation' => ngs_text($_POST, 'affiliation', 150),
        'why_request' => ngs_text($_POST, 'why_request', 1500),
        'why_attend' => ngs_text($_POST, 'why_attend', 1500),
        'hope_gain' => ngs_text($_POST, 'hope_gain', 1500),
        'plan_attend' => ngs_text($_POST, 'plan_attend', 10),
    ];
    if ($data['name'] === '') {
        $errors[] = 'Please add your name.';
    }
    if (!$emailOk) {
        $errors[] = 'Please check your email address.';
    }
    $digits = preg_replace('/\D+/', '', $data['phone']) ?? '';
    if (strlen($digits) < 7 || strlen($digits) > 15) {
        $errors[] = 'Please check your phone number.';
    }
    if (!in_array($data['describes'], ['High school student', 'College student', 'Young professional', 'Other'], true)) {
        $errors[] = 'Please tell us what best describes you.';
    }
    foreach ([
        'why_request' => 'Please tell us why you are requesting a scholarship ticket.',
        'why_attend' => 'Please tell us why you would like to attend.',
        'hope_gain' => 'Please tell us what you hope to gain.',
    ] as $f => $msg) {
        if ($data[$f] === '') {
            $errors[] = $msg;
        }
    }
    if (!in_array($data['plan_attend'], ['Yes', 'No', 'Unsure'], true)) {
        $errors[] = 'Please tell us whether you plan to attend.';
    }
    if (ngs_text($_POST, 'understood', 5) !== 'yes') {
        $errors[] = 'Please confirm you understand that a scholarship is not guaranteed.';
    }
    // the resume is optional, but a bad one should be said out loud rather than dropped
    if (!$errors) {
        try {
            $resume = ngs_take_resume('resume');
            if ($resume) {
                $data['resume_file'] = $resume[0];
                $data['resume_name'] = $resume[1];
            }
        } catch (RuntimeException $e) {
            $errors[] = $e->getMessage();
        }
    }
} else {
    $data = [
        'name' => ngs_text($_POST, 'name', 120),
        'email' => $email,
    ];
    if ($kind === 'partner') {   // volunteers give just a name and email
        $data['organization'] = ngs_text($_POST, 'organization', 150);
    }
    if ($data['name'] === '') {
        $errors[] = 'Please add your name.';
    }
    if (!$emailOk) {
        $errors[] = 'Please check your email address.';
    }
    if ($kind === 'partner' && $data['organization'] === '') {
        $errors[] = 'Please add your organization.';
    }
}

if ($errors) {
    ngs_reply(false, $kind, implode(' ', $errors), 422, $wantsJson);
}

try {
    // generous enough for a whole class registering on one campus network
    if (ngs_recent_from_ip(ngs_ip_hash(), 3600) >= 30) {
        ngs_reply(false, $kind, 'Too many submissions from this connection. Please try again in an hour.', 429, $wantsJson);
    }
    ngs_store($kind, $data);
} catch (Throwable $e) {
    error_log('Next Gen Summit form error: ' . $e->getMessage());
    ngs_reply(false, $kind, 'We could not save that right now. Please try again in a moment.', 500, $wantsJson);
}

ngs_reply(true, $kind, '', 200, $wantsJson);
