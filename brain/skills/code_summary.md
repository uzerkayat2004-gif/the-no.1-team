# Skill: Code Summary

## When To Use
After coding is complete, return a Structured Coding Summary — not raw code.

## Format
```markdown
# Coding Summary

## What Was Built
[Brief description of what was implemented]

## Research Decisions Followed
- [Decision 1 from brainstorm] → How it was implemented
- [Decision 2] → How it was implemented

## Deviations From Plan
- [Deviation 1] — Why: [reason]
- [Deviation 2] — Why: [reason]
(If none: "No deviations — all decisions followed exactly")

## Known Issues
- [Issue 1] — Impact: [high/medium/low]
- [Issue 2] — Impact: [high/medium/low]
(If none: "No known issues")

## Files Modified
- `path/to/file1.js` — [what changed]
- `path/to/file2.css` — [what changed]

## Confidence
Overall confidence in implementation: X/10
[Reason for this score]
```

## Review Process
1. Other agents + Boss review simultaneously
2. Deviations caught → agent pinned and sent back
3. Max 3 send-backs per issue
4. After 3 → escalate to Boss
