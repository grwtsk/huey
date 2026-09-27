# Research and source-status notice

> [!WARNING]
> **WORKING DRAFT — CLAIM VERIFICATION INCOMPLETE.** This repository contains attributed testimony, allegations, hypotheses, normative arguments and AI-assisted drafts. Inclusion, a citation, a commit, an issue closure or a passing software test does not independently verify a claim. Some received medical assertions are unsupported or superseded. This is not a clinical guideline, medical or legal advice, or an adjudicated finding. Consult the linked verification issues for evidence, limitations, counterevidence and corrections. Publication approval is not factual endorsement or acceptance of a finished edition.

First-person experience remains attributed testimony; external verification of a broader inference is not a condition for preserving that testimony. A claim marked as needing substantial support is not thereby false, and an unflagged claim is not thereby true. Ethical proposals, spiritual correspondences, literary metaphors, clinical recommendations, binding law and case-specific findings have different evidentiary roles.

Read [the master program](https://github.com/grwtsk/huey/issues/125), [the substantial-support queue](https://github.com/grwtsk/huey/issues/176), and [the full-corpus audit](https://github.com/grwtsk/huey/issues/145). Read the original sources and the actual disposition of a verification, not merely its open/closed state. Original source content and later corrections remain separately identifiable.

## Commit-message requirement

Every new commit affecting this research, its source copies, claims, disclaimers or permissions must include this exact trailer:

    Disclaimer: Working draft; claim verification incomplete; not medical/legal advice or adjudicated findings.

Also identify the affected issues and the actual verification performed. Never rewrite old commit messages solely to make a new notice appear historical. Use the repository `.gitmessage` template for future local commits; configure it locally with `git config --local commit.template .gitmessage`. API-created commits must include the trailer explicitly. This template is guidance, not a claim that every contributor has installed a hook.

Validate a prepared message with:

    python3 planning/standard-of-care/check_support.py --message-file COMMIT_MESSAGE.txt

A successful message check validates the notice's presence, not the truth of the committed material.
