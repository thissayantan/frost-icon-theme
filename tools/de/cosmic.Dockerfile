# Headless COSMIC for looking at Frost in COSMIC Files and the panel (tools/de/run.sh cosmic). Host untouched.
FROM fedora:44
RUN dnf -y install --setopt=install_weak_deps=False --setopt=max_parallel_downloads=10 --setopt=fastestmirror=True \
      cosmic-comp cosmic-panel cosmic-applets cosmic-files cosmic-settings-daemon cosmic-icon-theme cosmic-bg \
      papirus-icon-theme mesa-dri-drivers dbus-daemon dbus-tools xorg-x11-server-Xvfb ImageMagick procps-ng \
      google-noto-sans-fonts \
 && dnf clean all
RUN useradd -m tester
USER tester
ENV LIBGL_ALWAYS_SOFTWARE=1
COPY --chown=tester session-cosmic.sh /home/tester/session.sh
ENTRYPOINT ["sh", "/home/tester/session.sh"]
