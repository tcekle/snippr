# account-menu-operator.png

`docs/help/images/getting-started/account-menu-operator.png` · 723×372 · 87 KB ·
*Signing In* → The account menu.

**One shoot, two roles.** This figure and [`account-menu.png`](account-menu.md) exist to show a
permission difference, so **both must be re-shot together.** Re-shooting one alone makes the two
disagree about everything except the thing they are meant to differ on.

## What it shows

The same title-bar account menu as an Operator sees it: the signed-in name and role, **My Account**
and sign-out. **Manage Users** and **Manage Roles** are absent. Two callouts.

## Getting back to something close

Identical to the Supervisor shot — click the username in the title bar, clip the open menu, 1440×900
at `deviceScaleFactor: 1.5`, margin synthesized from the clip's own corner pixel — but signed in as
an operator (`mpatel` in the fictional user set). See [`account-menu.md`](account-menu.md) for the
full recipe and the dilation note, which applies to this capture too and was in fact tuned *against*
it: the Operator's name and role lines sit slightly further apart than the Supervisor's, and the
value in both specs is the one that merges them in both.

## Why it is annotated the way it is

No numbers, for the same reason as its pair.

**The subject of this figure is an absence, and you cannot ring nothing.** So the second callout
rings the whole menu card and the label carries the meaning: *Two entries only — no Manage Users or
Manage Roles*. That is the entire design of the figure. The first callout, on the name and role
block, exists to make the comparison legible — without it a reader has to hunt for which role this
menu belongs to.

Rejected: ringing **My Account** or sign-out. Both are in the Supervisor figure already and both
print their own captions; repeating them here would dilute the one contrast the figure is for.

### The backdrop

Both labels sit in the derived 334px right gutter, outside the captured UI, so the rule applies — and
it would have had to be applied here whatever the arithmetic said, because the pair is the figure.
Converting one of two figures that exist to be compared would put a difference in front of the reader
that has nothing to do with permissions.

The arithmetic is friendly anyway. Cropping `pad-clip.mjs`'s 48px band off (the reasoning is in
[`account-menu.md`](account-menu.md), and this pair must match it) takes the figure from 802px to
723px — back under the roughly 807px column it had just crossed — so the menu's 14px type holds at
21.0 CSS px instead of the 20.5 a backdrop alone would have cost.

Measured on the rendered output, both labels go from 3.19:1 to 8.69:1 and 9.09:1.

## Known issues

The figure only works alongside its pair, and nothing in the build enforces that. If one is ever
replaced on its own, the article's two figures will differ in window size, tint or menu geometry and
a reader will read those differences as the permission difference.
