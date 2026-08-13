# my-account-password-rejected.png

`docs/help/images/getting-started/my-account-password-rejected.png` · 1036×870 · 125 KB ·
*Signing In* → Changing your password.

**One shoot, two states.** This figure and [`my-account.png`](my-account.md) are the same form
before and after a rejected password, so **re-shoot them together.**

## What it shows

The My Account form after a new password has been refused, with the rejection message above the
form. One callout: *Which rule the password failed*.

## Getting back to something close

Same operator session on `/account`, 1440×900 at `deviceScaleFactor: 1.5`, same synthesized margin as
the first shot. Submit a password that fails the configured rules and capture the returned message.

**The rejection text is real and must stay real.** It is ASP.NET Identity's own `PasswordTooShort`
description, which `BasicAuthentication.cs` surfaces verbatim by joining `IdentityResult.Errors` on
`e.Description`. The shipped defaults in `UserAuthenticationExtensions.cs` are wide open
(`RequiredLength = 1`), so the figure depicts a system whose supervisor has tightened the rules —
which is what the article's note describes. **Do not substitute invented wording.**

## Why it is annotated the way it is

One callout, because there is exactly one thing in this capture that the other figure does not
already cover.

**The message is matched on its colour, not its position.** It only exists in the error state and it
pushes the whole form down when it appears, so anything positional would be measuring a layout that
does not exist in the other capture. The colour matched is the app's own `--danger` token.

The dilation is raised well above the default so the whole sentence merges into one cluster. At the
default the word gaps are never bridged and a largest-pick returns whichever middle fragment happens
to be biggest — a ring around three words out of the message, with nothing in the console to say so.

Rejected: everything already ringed on `my-account.png`. This figure is a delta, not a second
inventory of the form.

### The backdrop

The single label sits in the derived 333px right gutter, outside the captured form, so the rule
applies — and it must, because this figure and [`my-account.png`](my-account.md) are one pair and
converting one alone would read as a mistake.

Cropping `pad-clip.mjs`'s 48px band off (same reasoning as its pair) takes the figure from 1101 to
1036px, so the form's 14px type comes out slightly **larger** on the page than it was on white —
15.4 → 16.4 CSS px. The label scale is untouched, for the reason set out at length on the pair's page:
correct a backdrop's padding tax, do not correct a zoom.

Measured on the rendered output, the label goes from 3.82:1 on white to 8.29:1 on the gradient.

## Known issues

Its label publishes around 29.9 CSS px against 16px body copy — by some distance the largest in the
set, and visibly larger than its own pair's, which is the part a reader would notice since the two
figures sit four paragraphs apart. Neither number is the backdrop's doing: both specs carry a label
scale chosen against a 689px article column that is now roughly 807, and this figure is narrower than
its pair so the same scale inflates further. Carried across unchanged so the conversion stays one
variable. **Re-deriving the label scales across the set against the current column is outstanding
work; do the pair together when it happens.**
