#!/usr/bin/env python3
import re

# Read the file
with open(r'c:\Users\Admin\OneDrive\Documents\CityConnectDesk new\CityConnectDesk\client\src\pages\admin-super-dashboard.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Find and replace the corrupted emoji arrays
# Replace BASE_EMOJI_OPTIONS
base_emoji_new = '''const BASE_EMOJI_OPTIONS = [
    "🔧", "🧹", "🛠️", "⚡", "🚰", "🔌", "🔦", "🧑‍🔧", "🏠", "🧰",
    "🚿", "✨", "🧼", "🧽", "🪣", "🪜", "🔨", "⛏️",
  ];'''

# Find the start and end of BASE_EMOJI_OPTIONS
base_start = content.find('const BASE_EMOJI_OPTIONS = [')
if base_start != -1:
    base_end = content.find('];', base_start) + 2
    content = content[:base_start] + base_emoji_new + content[base_end:]

# Replace SERVICE_CATEGORY_EMOJI
service_emoji_new = '''const SERVICE_CATEGORY_EMOJI = [
    "🛡️", "🚶‍♂️", "🚧", "🎥", "🚨", "👮‍♂️", "🚗", "🚌", "🚕", "🚙",
    "🚛", "⚙️", "💡", "💧", "🌊", "🗑️", "🗺️", "🧾", "🌳", "🌾",
    "🌬️", "📋", "🪚", "🔑", "🎨", "📥", "🧱", "🏃‍♂️", "🚑", "🩺",
    "🧘‍♂️", "👨‍⚕️", "👨‍👩‍👧‍👦", "🚘", "🌱", "🏊‍♂️", "🥦", "🧺", "🐱", "🥕",
    "🦴", "🎉", "⚽", "🎊", "🎬", "🏊‍♀️", "🎮", "🎵", "🎸", "🎹",
    "📞", "🎭", "📚", "🫎", "🚙", "📅", "🏠", "💬", "🎓", "📲",
    "🎪", "⚙️", "🔐", "🎯", "🔒", "🔓", "🎈", "🎀", "📍", "✅",
  ];'''

service_start = content.find('const SERVICE_CATEGORY_EMOJI = [')
if service_start != -1:
    service_end = content.find('];', service_start) + 2
    content = content[:service_start] + service_emoji_new + content[service_end:]

# Write back
with open(r'c:\Users\Admin\OneDrive\Documents\CityConnectDesk new\CityConnectDesk\client\src\pages\admin-super-dashboard.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("Emoji fixed!")
