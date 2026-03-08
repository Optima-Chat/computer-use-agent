FROM ubuntu:22.04

ENV DEBIAN_FRONTEND=noninteractive
ENV DISPLAY=:1

RUN apt-get update && apt-get install -y \
    xvfb \
    fluxbox \
    x11vnc \
    novnc \
    websockify \
    xterm \
    xdotool \
    scrot \
    firefox \
    mousepad \
    thunar \
    python3 \
    python3-pip \
    curl \
    wget \
    ca-certificates \
    fonts-liberation \
    fonts-noto-cjk \
    dbus-x11 \
    && rm -rf /var/lib/apt/lists/*

# Create working directories
RUN mkdir -p /root/Desktop /root/Documents /tmp/screenshots /tmp/fixtures

# Copy scripts
COPY scripts/start-desktop.sh /usr/local/bin/start-desktop.sh
RUN chmod +x /usr/local/bin/start-desktop.sh

# Copy fixtures
COPY fixtures/ /tmp/fixtures/

# Copy fixture setup script
COPY scripts/setup-fixtures.sh /usr/local/bin/setup-fixtures.sh
RUN chmod +x /usr/local/bin/setup-fixtures.sh

EXPOSE 5900 6080

CMD ["/usr/local/bin/start-desktop.sh"]
