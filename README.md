# Next Gen Summit

The microsite for Next Gen Summit, a free event on Saturday, October 31, at Joseph Meyerhoff Symphony Hall, Baltimore.

It's plain HTML, CSS and JavaScript with one small PHP backend for the forms. There is no framework, no build step and no separate database server. Registrations are stored in a SQLite database on the host, and a password-protected admin page shows them.

```
nextgen-summit/
├── README.md
├── tools/make-config.mjs         creates public/api/config.php with a new admin password
└── public/                       everything that goes online (upload its CONTENTS)
    ├── index.html                the site, including the three forms
    ├── .htaccess                 security headers, caching, blocks data files
    ├── api/
    │   ├── register.php          receives registration, volunteer and partner forms
    │   ├── _lib.php              storage helpers (not web-accessible)
    │   ├── config.php            admin password hash and secrets (not in git, not web-accessible)
    │   ├── config.example.php    template; generate the real file with tools/make-config.mjs
    │   └── .htaccess
    ├── admin/index.php           the admin page: /admin/
    ├── data/                     fallback data folder, locked by .htaccess
    ├── registration-received/    confirmation page when JavaScript is off
    ├── thanks/                   volunteer and partner confirmation page
    └── assets/                   css, js, images
```

## Search engines

The homepage is indexable, with a canonical link to `https://nextgen2026.org/`. `robots.txt` keeps `/admin/`, `/api/` and `/data/` out of search results and points to `sitemap.xml`. The admin page, form endpoint and confirmation pages each send their own noindex.

## Hosting requirements

Any host with **PHP 7.4 or newer** and Apache or LiteSpeed (`.htaccess` support). Hostinger web hosting qualifies. SQLite (`pdo_sqlite`) is used when available, otherwise submissions go to a JSON Lines file. Netlify and other static-only hosts cannot run the forms.

## Deploying to Hostinger

1. Zip the **contents** of `public/` so `index.html` is at the top level of the zip. Include the `.htaccess` files.
2. Upload and extract into the domain's `public_html` folder (hPanel File Manager, or the Hostinger connector).
3. Turn on SSL for the domain in hPanel, then **Force HTTPS**.
4. Test: submit one registration, sign in at `/admin/`, confirm it appears, then delete it.

## Where registrations are stored

`register.php` saves every submission to `nextgen-<random>.sqlite` in a `nextgen-data` folder **next to** `public_html` (outside the website, so it can never be downloaded). If the host does not allow that, it falls back to `public_html/data/`, which `.htaccess` blocks from the web. The file name includes a random key from `config.php`.

**Back up the data** before re-deploying or deleting the site: download the CSV from the admin page, or copy the `nextgen-data` folder in File Manager. Re-uploading the site does not touch `nextgen-data`.

## The admin page

Go to `https://your-domain/admin/` and sign in with the admin password.

- Counts: total registrations, unique emails, college, high school, other, and how many want to volunteer.
- A searchable table of registrations (newest first, times in Eastern Time). Emails that registered more than once are marked "Repeat".
- A second tab for volunteer and partner notes.
- **Export CSV** for Excel or Google Sheets.
- **Delete** for test entries or duplicates.

The admin password lives in `public/api/config.php`, which is **not in this repository** (it holds the password hash and the site secrets). To create it on a new machine or server, or to change the password, run this from the project folder:

```
node tools/make-config.mjs          # creates config.php if missing and prints the password once
node tools/make-config.mjs --force  # replaces it with a new password
```

Then upload the new `config.php` to `public_html/api/`. Replacing it also changes the data key, so the site starts a fresh database file. Export your CSV first.

## Spam protection

- A hidden honeypot field (`bot-field`). Anything that fills it is quietly discarded while the bot sees a success.
- Server-side validation of every field.
- At most 30 submissions per hour from one connection (enough for a whole class on one campus network).

## Registration form fields

| Field | Name posted | Values |
|---|---|---|
| First Name | `first_name` | required |
| Last Name | `last_name` | required |
| Email Address | `email` | required, valid email |
| Education Level | `education_level` | `High School`, `College`, `Other` |
| School Name | `school_name` | required unless Education Level is Other |
| Interested in Volunteering? | `volunteer_interest` | `Yes`, `No` |

The form sends in place and shows the "you're in." confirmation. With JavaScript off, the browser posts normally and lands on `/registration-received/`. On a plain local preview (file:// or localhost) nothing is sent and the confirmation says so.

## Still to do

- Replace the draft speaker lineup, the draft taglines, and the "Soon" Contact and Instagram links.
- Host the remaining Unsplash photos locally and credit the photographers.
