#!/bin/sh
set -eu

SWAPFILE="${SWAPFILE:-/swapfile}"
SWAP_SIZE="${SWAP_SIZE:-2G}"

if swapon --show=NAME | grep -qx "$SWAPFILE"; then
  echo "Swap is already active at $SWAPFILE."
  exit 0
fi

if [ -f "$SWAPFILE" ]; then
  chmod 600 "$SWAPFILE"
else
  echo "Creating $SWAP_SIZE swap file at $SWAPFILE..."
  if command -v fallocate >/dev/null 2>&1; then
    fallocate -l "$SWAP_SIZE" "$SWAPFILE"
  else
    dd if=/dev/zero of="$SWAPFILE" bs=1M count=2048
  fi
  chmod 600 "$SWAPFILE"
  mkswap "$SWAPFILE"
fi

swapon "$SWAPFILE"

if ! grep -q "^$SWAPFILE " /etc/fstab; then
  printf '%s none swap sw 0 0\n' "$SWAPFILE" >> /etc/fstab
fi

echo "Swap is active:"
free -h
