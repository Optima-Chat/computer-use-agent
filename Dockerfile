FROM ubuntu:22.04

ENV DEBIAN_FRONTEND=noninteractive
ENV DISPLAY=:1

# Use Aliyun mirror for reliability
RUN sed -i 's|http://archive.ubuntu.com|http://mirrors.aliyun.com|g' /etc/apt/sources.list && \
    sed -i 's|http://security.ubuntu.com|http://mirrors.aliyun.com|g' /etc/apt/sources.list

# Install base packages (without firefox - snap doesn't work in Docker)
RUN apt-get update && apt-get install -y --no-install-recommends \
    xvfb \
    fluxbox \
    x11vnc \
    novnc \
    websockify \
    xterm \
    xdotool \
    scrot \
    mousepad \
    thunar \
    python3 \
    curl \
    wget \
    ca-certificates \
    fonts-liberation \
    fonts-noto-cjk \
    dbus-x11 \
    software-properties-common \
    gpg-agent \
    && rm -rf /var/lib/apt/lists/*

# Install Firefox from Mozilla PPA (real deb, not snap)
RUN add-apt-repository -y ppa:mozillateam/ppa && \
    echo 'Package: *\nPin: release o=LP-PPA-mozillateam\nPin-Priority: 1001' > /etc/apt/preferences.d/mozilla-firefox && \
    apt-get update && apt-get install -y --no-install-recommends firefox && \
    rm -rf /var/lib/apt/lists/*

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
