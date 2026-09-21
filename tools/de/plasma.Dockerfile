# Headless KDE Plasma 6 for looking at Frost in real KDE apps (tools/de/run.sh kde). Nothing here touches the host.
FROM fedora:44
RUN dnf -y install --setopt=install_weak_deps=False --setopt=max_parallel_downloads=10 --setopt=fastestmirror=True \
      kwin plasma-workspace plasma-desktop plasma-pa plasma-nm dolphin systemsettings kate \
      spectacle konsole papirus-icon-theme breeze-icon-theme mesa-dri-drivers dbus-daemon dbus-tools \
      pipewire wireplumber pipewire-pulseaudio xdg-desktop-portal-kde kf6-kconfig qt6-qtwayland \
      google-noto-sans-fonts procps-ng xorg-x11-server-Xvfb ImageMagick \
 && dnf clean all
RUN useradd -m tester
USER tester
ENV XDG_RUNTIME_DIR=/tmp/xdg LIBGL_ALWAYS_SOFTWARE=1 QT_QUICK_BACKEND=software
COPY --chown=tester session-kde.sh /home/tester/session.sh
ENTRYPOINT ["sh", "/home/tester/session.sh"]
