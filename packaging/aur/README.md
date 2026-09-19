# AUR package

**Blocked (2026-09-20):** AUR new-account registration is temporarily closed (HTTP 503, "a wave of
automated account creation"). Watch the aur-general list / Arch news feed; register when it reopens, add the
SSH key, then follow the steps below.

After the GitHub release exists: fill both `sha256sums` (`sha256sum` of the release tarball and of LICENSE at the
tag) in `PKGBUILD` and `.SRCINFO`, then (from an AUR account with an SSH key):
`git clone ssh://aur@aur.archlinux.org/frost-icon-theme.git`, copy both files in, commit, push.
