# FAQ

## What is this?

TeleWarp lets you share projects made in multiple different block-based programming languages. The
name is a wordplay on "TurboWarp".

## What programming languages are supported?

TurboWarp and OmniBlocks are supported. More will be added as TeleWarp gets a bit more stable.

## What is allowed?

Anything that follows the
[Scratch community guidelines](https://scratch.mit.edu/community_guidelines) is allowed.

## Why is my project's thumbnail turning into a question mark?

This can happen if:

- You clicked "Upload" before the thumbnail was generated
- The thumbnail somehow failed to upload
- Your project contains custom extensions outside of extensions.turbowarp.org or
  omniblocks.github.io/extensions (we don't generate thumbnails for those as some extensions may
  unknowingly perform malicious tasks specifically during the TeleWarp thumbnail generation process)

## Do extensions work?

Yes.

Extensions from extensions.turbowarp.org or omniblocks.github.io/extensions will work perfectly
fine. Others will show a confirmation box. Projects containing untrusted extensions will not have
thumbnails.

## How long does uploading take?

Uploading should generally be much faster than Scratch, as Scratch seems to upload each asset one by
one, while TeleWarp uploads every asset in your project at the same time.

## How do I modify TurboWarp's "Advanced Settings" while running a project?

Shift+click the fullscreen button to show a dialogue that lets you change advanced settings.

Please note that not all settings are supported yet.

## Do cloud variables work?

Not yet.

## Is remixing supported?

Not yet.

## Is there:

- Comments?
- A paid membership?

No.

## Are hardware extensions supported?

Our maintainers don't have any of Scratch's supported hardware, so we don't know yet. If you have
any Scratch-supported hardware, try it on TeleWarp and tell us if it works.

## Advanced: Are [TurboWarp globals](https://docs.turbowarp.org/development/globals) supported?

Only `vm` is supported, as we do not have an editor (which is the point of the other globals)
