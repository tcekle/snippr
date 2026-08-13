# account-menu.png

`docs/help/images/getting-started/account-menu.png` · 688×486 · 109 KB ·
*Signing In* → The account menu.

**One shoot, two roles.** This figure and
[`account-menu-operator.png`](account-menu-operator.md) exist to show a permission difference, so
**both must be re-shot together.** Re-shooting one alone makes the two disagree about everything
except the thing they are meant to differ on.

## What it shows

The title-bar account menu as a Supervisor sees it: the signed-in name and role, **My Account**,
**Manage Users**, **Manage Roles** and sign-out. Four callouts.

## Getting back to something close

Sign in as `aroberts` (Supervisor), click the username in the title bar, clip the open menu. Viewport
1440×900, `deviceScaleFactor: 1.5` — a detail clip renders at its own pixel width, so the scale
factor doubles as on-page zoom and 2 would draw the menu at twice the size of the body text around
it.

The account menu is one of the surfaces gated on role: anything but `Supervisor` or `Service`
silently redirects to the dashboard.

**Padding is synthesized, not captured.** The menu hangs off the title bar with nothing above it, so
there is no whitespace to extend the clip into. Composite the tight clip onto a margin sampled from
the clip's own corner pixel, so it blends into whatever the title bar is tinted rather than
hardcoding white — which would mismatch any theme darker than light. `pad-clip.mjs` in the capture
directory did this, at its default 48px on all four sides.

**The spec now crops that padding straight back off**, because the backdrop supplies the same margin
and stacking the two is worse than either — see *The backdrop* below. Keep taking the capture with the
pad: it is what makes the source usable without a backdrop, a probe can confirm the band is uniform on
all four sides, and 48 is `padClip`'s own default rather than a measured pixel of UI. If a future
re-shoot skips `padClip` altogether, delete the crop key rather than editing its numbers.

## Why it is annotated the way it is

No numbers: the account-menu section is a bullet list, not a numbered sequence.

Four callouts — *Who is signed in, and their role* / *Your own profile* / *Administrators only* /
*Ends the session*. The two administrator entries are ringed as one union rather than separately,
because what the reader needs is the boundary, not two captions repeating the menu's own text.

**The menu entries are white text rows on a white card**, so the swatch detector cannot see them at
all; they are ink clusters inside the card, taken top to bottom. A minimum-height filter drops the
1px divider rule, which is a perfectly good cluster and would otherwise consume an index slot.

**The dilation value is load-bearing and was tuned across both captures.** The account name and its
role line must merge into one block; at the default they are two clusters and every index below
shifts by one, silently ringing the wrong menu entries. An intermediate value merged them in the
Supervisor capture but not the Operator one, whose lines sit slightly further apart — so the value in
the spec is the one that works for **both** shots of the pair.

### The backdrop

All four labels sit in the derived 299px right gutter, outside the captured UI, so the backdrop rule
applies. **Free**: the figure lands at 688px against a roughly 807px column, so it still renders at
native pixels and the menu's 14px type still lands at 21.0 CSS px.

Measured on the rendered output, the labels go from 3.19:1 on the shell grey to 7.72 / 9.03 / 8.91 /
9.50:1 on the gradient.

**The interesting part is what had to come off first.** `pad-clip.mjs`'s 48px band and a backdrop are
both margin around the same clip, and a backdrop is not merely a nicer colour for the first: the drop
shadow and the hairline edge are drawn around the **screenshot rectangle**, so with the pad left in,
the thing floating on the gradient is a 468×540 slab of flat corner-sampled grey with the menu
somewhere inside it. The window silhouette stops being the window. Cropping the pad off is what makes
the menu itself the object on the gradient — and it pays for the conversion twice over, because the
figure comes out *narrower* than it was on white.

**That is the general finding for this group.** Every figure whose source went through `padClip` needs
its pad cropped when it gains a backdrop; every figure whose pad is *captured* page ground keeps it.
[`run-socket-menu.png`](run-socket-menu.md) is the worked example of the second case.

## Known issues

Edit these specs with a UTF-8-aware writer. A Python `read_text()` / `write_text()` round-trip on
Windows uses the locale codec and silently turns an em dash into three garbage characters, which
render straight into the figure.
