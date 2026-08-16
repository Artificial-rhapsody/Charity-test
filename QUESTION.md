# Decisions to Review After Local Acceptance

The implementation follows the decisions already confirmed in chat. These remaining points were intentionally decided provisionally so development could continue without blocking.

## Current provisional decisions

1. **Local publishing bridge**
   - `node build.js --dev` runs a localhost-only write API on port `8790`.
   - The site itself is still opened through VS Code Live Server from `dev-page/`.
   - Admin publishing writes approved paths into the project source, then rebuilds `dev-page/`.

2. **Local admin access**
   - `admin.html` is accessible without Cloudflare login only on `localhost`, `127.0.0.1`, or `file://` for local acceptance.
   - On a deployed hostname, a stored user with `role: "admin"` is required; otherwise the page redirects to `index.html`.

3. **Article bundle**
   - Root `articles.json` contains article metadata and complete Markdown bodies.
   - Relative article images resolve through each article's `assetBase`.

4. **DOCX import**
   - The console loads Mammoth from jsDelivr to convert `.docx` into HTML, then performs a conservative HTML-to-Markdown conversion.
   - `.md` and `.txt` are imported directly.
   - Complex Word layout, footnotes, and advanced tables may need manual cleanup in the preview.

5. **Markdown safety**
   - Raw HTML is escaped.
   - Headings, emphasis, links, images, lists, task lists, blockquotes, tables, horizontal rules, inline code, and fenced code blocks are supported.

6. **Homepage editing interaction**
   - Editable fields are identified by `data-site-path` inside an iframe rendering the real homepage.
   - Click opens a property panel; double-clicking an image opens image selection.
   - Layout, CSS, and element positions cannot be changed.
   - Homepage contact email is currently edited as one field while phone remains separately stored in `site.json`.

7. **Remote publishing**
   - The Worker includes an administrator-only multi-file Git commit endpoint.
   - Repository owner/name, Worker secrets, CORS restrictions, and remote recursive article deletion are deliberately deferred until deployment.
   - No GitHub repository, remote, Pages site, or Worker deployment has been created.

8. **Sample content**
   - Existing homepage claims were migrated into sample articles where useful.
   - Sample reports and honors explicitly state when they are placeholders.
   - These should be replaced with verified client content before public launch.

## Questions to revisit

- Should local admin preview require a local password, or is localhost-only access sufficient?
- Should Word import preserve embedded DOCX images automatically?
- Should the homepage editor expose collection operations such as adding/removing video cards, stats, or navigation links, rather than editing existing containers only?
- Should published article editing preserve previously uploaded images even when they are not re-uploaded? The current design preserves files on disk and only overwrites submitted files.
- Should remote article deletion use a Git tree deletion commit, or should deleted articles be moved to an archive directory?
- What exact GitHub owner/repository and production domain should be written into deployment configuration?
- Which exact origins should the Worker allow in production CORS?
- Should `site.json` remain a directly edited source file, or move to `content/site.json` before deployment?
