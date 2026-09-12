# Web Import

Requires Linelark Studio 1.14.0 or later, which is where the host API reached generation 11
and `importWebPage()` first existed.
Install `Web Import.linelarkplugin`, then choose **Plugins → Import Web Content…** or
use the Web Import panel.

1. Paste an HTTP(S) URL, a localhost URL, a `file://` URL, or an absolute HTML file path.
2. Click Load. The page runs in an isolated WebKit browser. Wait for JavaScript content,
   scroll to reveal lazy-loaded content, and interact with the page as needed.
3. Use article/main extraction, or select content in the browser and enable Selected text
   only. Include CSS selectors can choose several sections; exclude selectors remove
   navigation, footers, or any unwanted matching descendants. Invalid selectors report an error.
4. Choose Markdown or HTML and whether to include source attribution. Preview extraction
   captures the current DOM. Review the output, then Import opens a separate generated tab.
5. Save As keeps the result on disk. The original document is untouched.

Links and remote image URLs become absolute. Scripts, forms, embeds, event handlers, and
unsafe URL schemes are removed from the extracted HTML. Complex tables use embedded HTML
in Markdown. Images remain remote references; this is not an offline asset downloader.
Local files grant access only to that file, so sibling scripts/styles may not load: serve
multi-file sites on localhost for full rendering. Browser cookies are temporary and separate
from your normal browser. Closed shadow roots, iframe contents, canvas, and virtualized
content not present in the DOM are not captured. There is no automatic login, paywall bypass,
or automatic infinite scrolling. Capture is capped at 2 million output characters.

The host owns URL entry and confirmation. The plugin cannot supply a URL, silently capture
a page, or run arbitrary code in the browser. Closing the window returns no content.
The App Store edition does not support this API.

## API used

- `importWebPage()` (API 11): user-action-only, resolves to `{text, title, url, format}`
  after confirmation, or `null` on cancellation. A second active importer also returns null.
- `addCommand`, `addPanel`, `refreshPanels`, `log`, `openVirtual`.
