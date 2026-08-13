# Worked examples

Reference material, not required reading. These are the twenty-nine figures the skill was built
making, for the PSV / Maestro help site. **You will not recognise the screens.** Read them anyway
when you hit a problem that resembles one of theirs, because what they record is the *reasoning* —
including, unusually, the callouts that were proposed and cut.

The rules these examples support are lifted into [`../DOCTRINE.md`](../DOCTRINE.md), which is the file
to read first. This folder is where you go when DOCTRINE names a figure and you want to see the whole
argument.

## What's here

| | |
|---|---|
| [`figure-pages/`](figure-pages/) | One page per figure. Twenty-nine of them, verbatim |
| [`FIGURES-psv-original.md`](FIGURES-psv-original.md) | The original index the doctrine was extracted from, unedited — the figure table, the PSV capture prerequisites, and the outstanding-defects list |

## Why a figure gets a page at all

In the PSV set the capture script, the raw source, the spec and the golden are **all** gitignored.
Only the published PNG is committed. So the chain that produced a figure leaves with the branch it
was made on, and re-deriving a figure means re-shooting it rather than re-rendering a spec. The page
is the only thing standing between the next person and a blank screen.

If you commit your sources and specs instead — which you should, if you have the repo room — you need
these pages far less. But you still need *something*: a spec records what a callout points at, never
why it survived and what was cut instead.

## The shape of a page

Every page has the same five parts, and the fifth is the one people skip:

```markdown
# <name>.png

`path/to/published.png` · WxH · NN KB · *Article* → Section.

## What it shows
The state of the app in the picture, in a sentence or two.

## Getting back to something close
How the app was driven there. Roles, mock payloads, viewport, device scale, what had to
be asserted before the shutter, and any gotcha that will otherwise cost the next person
an hour.

## Why it is annotated the way it is
Each callout and what it says that the picture does not. The crop bounds and what they
were chosen against. The placement decisions and what they cost.

### Which callouts were rejected
**The part that stops the same argument being had twice.** Name them and say why.

## Known issues
Defects knowingly shipped. Being honest here is what makes the page trustworthy.
```

## Recording rejections — the shortest worked example

If you read nothing else here, read the `_rejected` key in
[`../example/demo.json`](../example/demo.json). The demo figure ships three callouts and cut five,
and the five are written down. Two things about that list are worth copying:

- **Four were cut for saying nothing** — the device names, the two green *Ready* chips, the
  `operator` identity in the title bar, the highlighted nav row. Each is a thing a reader can already
  see and already understand. Naming the normal state also dilutes the one abnormal state that
  matters.
- **One was cut for a different reason entirely.** *"A dash means never run, not zero"* is an
  honest, useful thing to say about the Cycles column — and it was dropped because that cell has no
  uniform fill and no detected rule around it, so the only way to point at it is a literal `rect`.
  A figure is only as durable as its weakest selector. **"Can I describe this without a
  coordinate?" is part of choosing a callout, not a check you run afterwards.**

Rejections belong wherever the next person will actually hit them: a `_rejected` key in the spec if
you commit your specs, a *Which callouts were rejected* section on the figure's page if you do not.
Somewhere, not nowhere.

## Six worth reading whatever your project is

- [`unsaved-changes`](figure-pages/unsaved-changes.md) — the contained figure. Why it gets no
  backdrop and takes `labelPlate` instead, at 1.33:1 → 8.59:1
- [`sign-in`](figure-pages/sign-in.md) — looks exactly like it needs a backdrop, and does not. The
  margin is the test, not the whitespace
- [`service-mode-banners`](figure-pages/service-mode-banners.md) — the gutter remedy, and a rejection
  that was overturned by changing the figure rather than by re-arguing the rule
- [`shell-activity-rail`](figure-pages/shell-activity-rail.md) — a figure re-framed from 7% of its
  own area to 46%
- [`run-job-bar`](figure-pages/run-job-bar.md) — the hardest selector chain in the set
- [`programmer-add`](figure-pages/programmer-add.md) — the same class of screen as
  `unsaved-changes`, resolved the opposite way. Read the two together
