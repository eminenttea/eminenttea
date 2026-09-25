# Eminent Tea Catalogue

Updated 25 September 2026. A self-hosted 64-page reader with the supplied
original Eminent logo. No FlipHTML5, CDN scripts, tracking, build tools or
subscription is required.

## Update your existing GitHub website

1. Extract **Eminent-Flipbook-Update.zip** on your Mac. Do not upload the ZIP itself.
2. Open https://github.com/eminenttea/eminenttea and choose **Add file → Upload files**.
3. Upload the extracted root files: `index.html`, `styles.css`, `app.js`,
   `reader-core.js`, `README.md` and `CNAME`. Commit the changes, replacing
   the old files where names match.
4. Upload the extracted `assets` folder, then the `previews` folder, then the
   `thumbnails` folder in separate commits. Each image folder has 64 files;
   uploading separately keeps batches manageable.
5. Merge the included `pages` folder into the existing one. The update ZIP only
   includes the restored `page-45.jpg`; KEEP the other 63 original JPG files.
6. Wait for the GitHub Pages deployment to finish. Open https://eminent.lk/
   in a new private tab to check the updated files without an old cached copy.

All folders must sit beside `index.html` in the repository root, not inside
another enclosing folder. Existing `image.jpg` and `image1.jpg` may remain.
This package has not been pushed to GitHub automatically.

For a fresh installation, use **Eminent-64-Page-Flipbook-GitHub.zip** instead.
It includes all 64 original JPGs plus the optimized previews and thumbnails.
In repository **Settings → Pages**, use **Deploy from a branch → main → / (root)**.

## How to use the reader

- **Page binding:** page 1 is the front cover; spreads are 2–3, 4–5 … 62–63;
  page 64 is the back cover. Covers appear alone, intentionally.
- **Mac:** drag a page towards the spine to turn it, use the arrow buttons,
  or press Left/Right. Home/End and Page Up/Page Down also work.
- **iPhone:** drag or swipe horizontally on a page. Portrait keeps a small
  double-page spread and displays rotation instructions. Landscape enlarges it.
  The webpage cannot physically rotate your phone: turn off Portrait Orientation
  Lock in Control Centre and rotate the device yourself.
- **Zoom:** pinch with two fingers or use +/−. Drag to pan while zoomed.
  Use Fit to reset. Page navigation also resets zoom.
- **Jump:** enter a number from 1 to 64 and press Return/Go.
- **Thumbnails:** select the grid button, choose a page, or close with X/Escape.
- **Fullscreen:** uses native fullscreen when available. Otherwise, expanded
  reading mode hides the header; the browser's address bar may remain.
- **Motion:** actual front/back page images turn in 3D with shadows and a
  hand/grab cursor on mouse devices. Reduced-motion settings skip automatic
  animation; finger-directed dragging still follows your finger.

The layout uses available container space, dynamic viewport updates, safe-area
insets and 44px controls. It does not depend on screen-orientation locking.
Previews and thumbnails are small local WebP files; original JPGs load for zoom.
Do not rename the numbered files.

## HTTPS / SSL — separate from the HTML

GitHub Pages provisions the certificate when the domain and DNS are configured
correctly. There is no certificate file or paid SSL plugin to add to this reader.

1. Go to https://github.com/eminenttea/eminenttea/settings/pages
2. Set **Custom domain** to `eminent.lk` and save.
3. Wait for the DNS check and certificate provisioning to complete.
4. Enable **Enforce HTTPS**. This redirects HTTP visitors to HTTPS.

The `CNAME` file contains `eminent.lk`, but DNS and GitHub settings must also
be correct. These are the GitHub records corresponding to your earlier setup:

| Type | Name | Value |
| --- | --- | --- |
| A | @ | 185.199.108.153 |
| A | @ | 185.199.109.153 |
| A | @ | 185.199.110.153 |
| A | @ | 185.199.111.153 |
| CNAME | www | eminenttea.github.io |

Some DNS panels use `eminent.lk.` instead of `@` and `www.eminent.lk.`
instead of `www`. Do not change your nameservers or unrelated email records.
Extra conflicting address records can interfere with certificate provisioning.
If Enforce HTTPS is unavailable, read the exact status below Custom domain
before changing DNS. A screenshot of that status is useful for troubleshooting.

The account-level TXT ownership check is separate from certificate provisioning.
For that check, the hostname must be exactly the one GitHub supplies, including
the underscore: `_github-pages-challenge-eminenttea.eminent.lk`. If your DNS
form rejects underscores for TXT names, ask the DNS provider to add the exact
record. Removing the underscore will not verify the domain. Use the current
token shown by GitHub, and retain the TXT record after successful verification.

Official references:

- https://docs.github.com/en/pages/getting-started-with-github-pages/securing-your-github-pages-site-with-https
- https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/verifying-your-custom-domain-for-github-pages

## Verification and device checklist

Automated non-browser tests cover all 64 pages and 33 spreads, odd-page jumps,
first/last and keyboard navigation, drag progress and cancellation, pinch/pan,
thumbnails, fullscreen fallback, reduced motion, loading failure and retry.
Original image integrity and generated image decoding were also checked.
Developers with Node.js installed can run `node --test tests/reader.test.cjs`
from this folder. These tests are simulated interaction checks, not browser tests.
The optional `tests` folder is not needed to run the published website.

Browser preview was blocked in the editing session. Actual Safari rendering,
physical iPhone rotation and touch responsiveness have NOT been device-tested.
After deployment, check:

1. Mac Safari: logo/link, next/previous, page 3 then next (must show 4–5), drag,
   zoom/pan, thumbnails, fullscreen and Escape.
2. iPhone Safari: portrait rotation hint, landscape with Orientation Lock off,
   visible toolbar, both pages, swipe and pinch/pan.
3. Rotate while a page is moving: the reader should settle to a complete spread.
4. Confirm https://eminent.lk/ opens without a certificate warning.

All catalogue copy and artwork remain the user's supplied content.
