# Security

Sahne runs in the browser and draws documents it is given: avatar documents (checked and trimmed by `normalize`), place documents, scripts, stories, and kit items drawn as data (`sahne-kit/drawing`). If you find a way for such a document to run script, break out of its sandbox or exhaust a page, please report it privately through [GitHub's private vulnerability reporting](https://github.com/mehrad77/sahne/security/advisories/new) rather than in a public issue.

The same goes for `sahne-backstage`, the local editor and MCP server. It answers only requests whose `Host` and `Origin` are localhost, and it changes content only inside its content root, and only when started with `--write`. A way past any of these is a vulnerability.

Only the latest `main` is supported.
