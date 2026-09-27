# Production input contract

Canonical prose is never authored in this directory.

All book prose comes from Markdown under manuscript/ and is ordered by book.yaml. The shared extraction layer is scripts/book.py.

Use:

    npm run book:check
    npm run book:count
    npm run book:md > build/huey.md

LaTeX and HTML typesetting should begin from build/huey.md or invoke the same extraction module directly. A later production task may pin a specific typesetter and templates, but it must not copy prose into a parallel authoritative tree.

build/, dist/, reader/generated-public/, PDFs, HTML bundles, EPUBs, and LaTeX intermediates are generated artifacts. They are not canonical manuscript source.
