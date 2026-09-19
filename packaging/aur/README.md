# AUR package
After the GitHub release exists: fill both `sha256sums` (`sha256sum` of the release tarball and of LICENSE at the
tag) in `PKGBUILD` and `.SRCINFO`, then (from an AUR account with an SSH key):
`git clone ssh://aur@aur.archlinux.org/frost-icon-theme.git`, copy both files in, commit, push.
