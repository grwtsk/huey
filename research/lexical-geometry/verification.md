# Recovery, review and local verification

LG-01, first research edition. Work #102; broader coverage remains #103.

## What was resumed

The interrupted attempt created source objects through tree
`e3030ed858b40d632189056b63bc1b308b328909`, but no lexical-atlas commit, branch or
pull request was present when the retry inspected the repository. The recovered
plan and source inventory were reused; no duplicate work or research issue was
created. Main at preparation was `0d15e7a1a2dedd048ef4def7340d6edb3aceb10f`.

The five unfinished files were revised after checking the public sources. This is
not a claim that the retry's rewritten research files are byte-identical to the
interrupted objects. Original object identities remain available in Git's object
store; they were not accepted source editions. The current edition also supplies
the previously missing generated source/coverage pages and entry-point links.

## Corrections and additional scope

| Record | Interrupted candidate | Current correction and basis |
|---|---|---|
| H04 | Named the 2024 Appiah DOI as *Racisms*. | Original publisher metadata identifies *Understanding racism*. The separate earlier work is not substituted. |
| H05 | Used a paraphrase of Webster's thesis as her title. | Original publisher metadata identifies *Moral status of believing in races*. |
| H09 | Assigned Shelby's 2002 article to *The Philosophical Forum*. | Original Wiley metadata identifies *Journal of Social Philosophy* 33(3), 411–420. |
| L08 | Asserted an obsolete root entry and Latin radix ancestry from limited retrieval. | The retry retrieved the root/ginger entry, but not support for that ancestry or obsolete label; those details are not retained as verified assertions. |
| L02/L03 | Narrow summaries omitted relevant labeled uses. | Is's dialectal distribution and the explicit prejudice/discrimination suffix sense are now recorded at their actual scope. |
| G01 | Canonical Cambridge endpoint unavailable. | A matching indexed primary entry is used with its exact alternative endpoint; direct access is still not claimed. |
| H06 | Recorded indexed access only. | Direct publisher abstract retrieved; this is still abstract-level, not full-article reading. |
| H07 | Synopsis status did not clearly distinguish retrieval route. | Recorded as indexed publisher synopsis, not a directly retrieved full work. |
| H10/D08 | Not present. | Added Jordan Scott's 2025 original article at selected-text scope and an attributed comparison, not an agreed universal definition. |

Sources are cited in `sources.md` and summarized separately in `atlas.json`. The
retry records 24 selected-text entries, seven indexed-primary excerpts, six
abstracts and four metadata-only targets. Two relevant PDF pages (Haslanger's
printed p.51 and ICERD's printed p.216) were visually inspected with the online
PDF screenshot tool. No OCR or independent historical case inquiry occurred.

## Checks actually performed

In the isolated candidate workspace, Python 3.13.5:

```sh
python3 -m unittest discover -s tests -p 'test_lexical_geometry.py' -v
python3 scripts/lexical_geometry.py validate
python3 scripts/lexical_geometry.py check
python3 -m compileall -q scripts tests
```

**44 new unit/CLI tests passed.** The atlas has 41 source records, 29 senses,
25 relations, eight comparisons and thirteen open research areas. The generated
pages match the data. Tests exercise malformed and oversized input, duplicate
keys/IDs, source/reference errors, access/scope drift, metadata promoted to an
argument, erasure of identity/unknown fields, forced classification, spurious
shared etymology, flag-only gap closure and read-only/no-payload-echo behavior.

One test deliberately shows that matching forged source and observation records
can remain structurally valid. The tool cannot authenticate reading, resolve a
philosophical dispute or certify semantic fidelity. The recorded observations
are the agent's retrieval account, not an independent trusted attestation.

The two edited entry-point files retain byte-identical original prefixes, checked
against their connector-returned Git blob IDs. Local internal-reference/anchor,
UTF-8/newline/whitespace and public-scope reviews supplement the code tests.
Actual source/meaning review distinguishes lexical facts, translations, source
positions, analytical synthesis and unresolved access. No private manuscript,
family particulars, source-service bindings or protected closing text are included.

## Limits

Git transport and direct container HTTP access to GitHub failed through DNS. The
candidate was assembled locally from visible connector/source content and newly
written files, not a complete Git checkout. **The existing 148 authority, catalog,
triage and RF-01 tests were not rerun.** Their modules and fixtures are unchanged.
No full-repository, hosted Actions, external review or live-service result is claimed.

The first atlas is substantive and bounded, not a completed census of all
pertinent authorities. All thirteen extension areas remain explicit. Gap closure
will require an evidence-bearing schema revision rather than changing an open
flag to completed. No new human decision is necessary for ordinary public-source
retrieval. Manuscript acceptance, private disclosure and publication remain outside
this research change. Nothing is deployed or activated by these files.
